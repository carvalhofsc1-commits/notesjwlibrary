// Função serverless (Vercel) que pede à IA sugestões de formatação para as linhas do texto.
// A chave da API fica só aqui, na variável de ambiente ANTHROPIC_API_KEY — nunca vai para o navegador.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
// Os textos dos prompts moram em _prompts.mjs (o administrador edita o tom e as regras pelo app).
const MAX_CHARS = 4000;
const MAX_LINHAS = 80;
const MAX_CHARS_SENTINELA = 12000;
const MAX_LINHAS_SENTINELA = 200;
const MAX_MODELOS = 60;
const MAX_CHARS_MODELO = 200;
const MAX_TEXTO_LIVRE = 300;
const MAX_DESTAQUES = 5;
const LIMITE_POR_HORA = 30;

const ESTILOS = ["negrito", "italico", "negrito_italico"];
const TIPOS = ["geral", "citacao_texto", "citacao_referencia"];

const Saida = z.object({
  resumo: z.string().nullable(),
  sugestoes: z.array(
    z.object({
      linha: z.number().int(),
      modeloId: z.string().nullable(),
      emoji: z.string().nullable(),
      destaques: z.array(
        z.object({
          trecho: z.string(),
          tipo: z.enum(TIPOS),
          estilo: z.enum(ESTILOS).nullable(),
          maiusculas: z.boolean(),
        })
      ),
      motivo: z.string(),
    })
  ),
});

// Limite simples por IP, em memória (vale por instância; a proteção real de custo é o limite de gastos do Console).
const acessos = new Map();

function excedeuLimite(ip) {
  const agora = Date.now();
  const janela = 60 * 60 * 1000;
  const lista = (acessos.get(ip) || []).filter((t) => agora - t < janela);
  if (lista.length >= LIMITE_POR_HORA) {
    acessos.set(ip, lista);
    return true;
  }
  lista.push(agora);
  acessos.set(ip, lista);
  if (acessos.size > 5000) acessos.clear();
  return false;
}

const INTENSIDADES = ["poucas", "moderada", "muitas"];
const TAMANHOS_RESUMO = ["curto", "medio", "detalhado"];
const DESCRICAO_TAMANHO = {
  curto: "curto (1 a 2 frases, cerca de 30 palavras)",
  medio: "médio (3 a 4 frases, cerca de 70 palavras)",
  detalhado: "detalhado (um parágrafo de 5 a 7 frases, cerca de 120 palavras)",
};
const MAX_RESUMO = 1200;

function textoLivre(valor) {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO_LIVRE) : "";
}

function validarOpcoes(opcoes) {
  const o = opcoes && typeof opcoes === "object" ? opcoes : {};
  return {
    usarModelos: o.usarModelos !== false,
    negrito: o.negrito === true,
    italico: o.italico === true,
    negritoItalico: o.negritoItalico === true,
    maiusculas: o.maiusculas === true,
    emoji: o.emoji === true,
    citacoesBiblicas: o.citacoesBiblicas === true,
    resumo: o.resumo === true,
    resumoTamanho: TAMANHOS_RESUMO.includes(o.resumoTamanho) ? o.resumoTamanho : "medio",
    consultarBiblia: o.consultarBiblia === true,
    consultarPerspicaz: o.consultarPerspicaz === true,
    intensidade: INTENSIDADES.includes(o.intensidade) ? o.intensidade : "moderada",
    instrucao: textoLivre(o.instrucao),
  };
}

function validarEntrada(body) {
  if (!body || typeof body !== "object") return null;

  const tarefa = body.tarefa === "sentinela" ? "sentinela" : "formatar";
  const maxChars = tarefa === "sentinela" ? MAX_CHARS_SENTINELA : MAX_CHARS;
  const maxLinhas = tarefa === "sentinela" ? MAX_LINHAS_SENTINELA : MAX_LINHAS;

  const { linhas, modelos } = body;
  if (!Array.isArray(linhas) || !Array.isArray(modelos)) return null;
  if (!linhas.length || linhas.length > maxLinhas || modelos.length > MAX_MODELOS) return null;
  if (!linhas.every((l) => typeof l === "string")) return null;

  const total = linhas.reduce((soma, l) => soma + l.length, 0);
  if (total === 0 || total > maxChars) return null;

  const modelosOk = [];
  for (const m of modelos) {
    if (!m || typeof m.id !== "string" || typeof m.nome !== "string" || typeof m.conteudo !== "string") return null;
    modelosOk.push({
      id: m.id.slice(0, 80),
      nome: m.nome.slice(0, 80),
      conteudo: m.conteudo.slice(0, MAX_CHARS_MODELO),
    });
  }

  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores =
    modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 8000) : "";

  return {
    tarefa,
    linhas,
    modelos: modelosOk,
    opcoes: validarOpcoes(body.opcoes),
    modo,
    ajuste: textoLivre(body.ajuste),
    anteriores,
  };
}

function descreverPreferencias(o) {
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  const linhas = [
    `- Modelos: ${o.usarModelos ? "pode usar os modelos da lista" : "NÃO use modelos (modeloId sempre null)"}.`,
    `- Estilos permitidos nos destaques: ${estilos.length ? estilos.join(", ") : "nenhum (estilo sempre null)"}.`,
    `- Letras maiúsculas nos destaques: ${o.maiusculas ? "permitidas" : "NÃO use (maiusculas sempre false)"}.`,
    `- Emoji ilustrativo no início da frase: ${o.emoji ? "SIM, sugira emojis que ilustrem o assunto de cada linha destacada" : "NÃO use (emoji sempre null)"}.`,
    `- Quantidade de sugestões: ${o.intensidade}.`,
  ];
  linhas.push(
    o.resumo
      ? `- Resumo: ATIVO, tamanho ${DESCRICAO_TAMANHO[o.resumoTamanho]}. Preencha o campo resumo.`
      : "- Resumo: INATIVO (resumo sempre null)."
  );
  if (o.citacoesBiblicas) {
    linhas.push(
      '- Citações bíblicas: ATIVO. Identifique citações de textos bíblicos; marque o texto citado como tipo "citacao_texto" e a referência (livro, capítulo e versículos) como tipo "citacao_referencia". O servidor aplicará itálico ao texto e negrito à referência.'
    );
  } else {
    linhas.push('- Citações bíblicas: INATIVO (use apenas o tipo "geral").');
  }
  if (o.instrucao) linhas.push(`- Instruções extras do usuário: ${o.instrucao}`);
  return linhas.join("\n");
}

const ASPAS = "\"“”„«»‘’❛❜❝❞";
const TEM_ASPAS = new RegExp(`[${ASPAS}]`);
const ASPAS_NAS_PONTAS = new RegExp(`^[\\s${ASPAS}']+|[\\s${ASPAS}']+$`, "g");

// Tira aspas e espaços das pontas do trecho, para que as aspas nunca recebam negrito/itálico.
function limparTrecho(trecho) {
  return typeof trecho === "string" ? trecho.replace(/[*`]+/g, "").replace(ASPAS_NAS_PONTAS, "") : "";
}

// Texto escrito pela IA (respostas e resumo): sem Markdown (* e `) e sem emojis no começo. As vezes ela escreve
// **negrito** ou repete o emoji dentro do texto, e como a formatação vem dos campos emoji/destaques, isso
// apareceria como asteriscos e emoji duplicado.
function limparTextoGerado(valor, max) {
  const texto = typeof valor === "string" ? valor : "";
  return texto
    .replace(/[*`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Emoji_Modifier}\s]*)+/u, "")
    .trim()
    .slice(0, max);
}

const REGEX_EMOJI = /\p{Extended_Pictographic}/u;

function limparEmoji(valor) {
  if (typeof valor !== "string") return null;
  const partes = [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(valor.trim())]
    .map((s) => s.segment)
    .filter((g) => REGEX_EMOJI.test(g))
    .slice(0, 3);
  return partes.length ? partes.join("") : null;
}

// ---------- Respostas do estudo de A Sentinela ----------

// Destaques de um texto (linha ou resposta): mantém só os que existem nele e que as preferências permitem.
function estilosDe(opcoes) {
  return new Set([
    ...(opcoes.negrito ? ["negrito"] : []),
    ...(opcoes.italico ? ["italico"] : []),
    ...(opcoes.negritoItalico ? ["negrito_italico"] : []),
  ]);
}

function sanearDestaques(destaques, texto, opcoes, estilosPermitidos) {
  const resultado = [];
  for (const d of (Array.isArray(destaques) ? destaques : []).slice(0, MAX_DESTAQUES)) {
    const trecho = limparTrecho(d && d.trecho);
    if (!trecho || !texto.includes(trecho)) continue;

    if (d.tipo === "citacao_texto" || d.tipo === "citacao_referencia") {
      if (!opcoes.citacoesBiblicas) continue;
      resultado.push({
        trecho,
        tipo: d.tipo,
        estilo: d.tipo === "citacao_texto" ? "italico" : "negrito",
        maiusculas: false,
      });
      continue;
    }

    const estilo = d.estilo && estilosPermitidos.has(d.estilo) ? d.estilo : null;
    const maiusculas = opcoes.maiusculas && d.maiusculas === true;
    if (!estilo && !maiusculas) continue;
    resultado.push({ trecho, tipo: "geral", estilo, maiusculas });
  }
  return resultado;
}

// Preferências de formatação enviadas à IA quando ela escreve respostas do estudo.
function descreverFormatacaoResposta(o) {
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  const quantidade = o.intensidade === "poucas" ? "poucos (1 a 2)" : o.intensidade === "muitas" ? "vários (até 5)" : "alguns (2 a 3)";
  return [
    `- Estilos permitidos nos destaques: ${estilos.length ? estilos.join(", ") : "nenhum (estilo sempre null)"}.`,
    `- Letras maiúsculas nos destaques: ${o.maiusculas ? "permitidas" : "NÃO use (maiusculas sempre false)"}.`,
    `- Emoji ilustrativo no início da resposta: ${o.emoji ? "SIM, 1 a 3 emojis que ilustrem o assunto da resposta" : "NÃO use (emoji sempre null)"}.`,
    `- Quantidade de destaques por resposta: ${quantidade}.`,
    o.citacoesBiblicas
      ? '- Citações bíblicas: se a resposta mencionar um texto bíblico (ex.: Efésios 6:12), marque a referência como tipo "citacao_referencia"; use o tipo "geral" nos demais destaques.'
      : '- Use apenas o tipo "geral" nos destaques.',
  ].join("\n");
}

// ---------- Fontes de consulta: Bíblia e Estudo Perspicaz ----------
// Os arquivos de texto (biblia.txt, perspicaz_v1.txt, perspicaz_v2.txt) ficam na Files API da Anthropic, no mesmo
// workspace da chave. Só os identificadores (file_id) ficam aqui, em variáveis de ambiente: o navegador nunca
// informa nem recebe um file_id. Para ler os arquivos a IA usa a ferramenta de execução de código (grep no arquivo).
// O servidor só aceita um versículo ou um verbete se o texto realmente apareceu na saída dessa ferramenta.

const ID_ARQUIVO = /^file_[A-Za-z0-9_-]{8,100}$/;
const MAX_CHARS_VERSICULO = 1200;

function idDoArquivo(variavel) {
  const valor = String(process.env[variavel] || "").trim();
  return ID_ARQUIVO.test(valor) ? valor : null;
}

// Só carrega arquivos quando o usuário marcou a consulta (Bíblia e/ou Perspicaz). Sem caixa marcada nada é carregado
// aqui: os textos citados na própria pergunta são tratados num segundo passo, só se a pergunta tiver referência
// (completarComTextos). paraResumo = "Sugerir formatação + resumo". P = prompts (_prompts.mjs, com as edições do admin).
// Devolve null (sem consulta nenhuma), { erro } (pediu, mas o servidor não está configurado) ou as peças do pedido.
function prepararFontes(opcoes, P, paraResumo = false) {
  const biblia = idDoArquivo("ARQUIVO_BIBLIA_ID");
  const volume1 = idDoArquivo("ARQUIVO_PERSPICAZ_V1_ID");
  const volume2 = idDoArquivo("ARQUIVO_PERSPICAZ_V2_ID");
  if (opcoes.consultarBiblia && !biblia) return { erro: "A consulta à Bíblia ainda não está configurada no servidor." };
  if (opcoes.consultarPerspicaz && !(volume1 && volume2)) return { erro: "A consulta ao Perspicaz ainda não está configurada no servidor." };

  const usarBiblia = !!biblia && opcoes.consultarBiblia;
  const usarPerspicaz = opcoes.consultarPerspicaz;
  if (!usarBiblia && !usarPerspicaz) return null;

  const arquivos = [];
  const instrucoes = [P.instrucoes.ferramenta];
  if (usarBiblia) {
    arquivos.push({ rotulo: "Bíblia (um versículo por linha)", id: biblia });
    instrucoes.push(P.instrucoes.biblia);
    if (paraResumo) instrucoes.push(P.instrucoes.bibliaResumo);
    else {
      instrucoes.push(P.instrucoes.bibliaPergunta);
      if (opcoes.consultarBiblia) instrucoes.push(P.instrucoes.bibliaRelevantes);
    }
  }
  if (opcoes.consultarPerspicaz) {
    arquivos.push({ rotulo: "Estudo Perspicaz, volume 1", id: volume1 }, { rotulo: "Estudo Perspicaz, volume 2", id: volume2 });
    instrucoes.push(P.instrucoes.perspicaz);
  }
  instrucoes.push(paraResumo ? P.instrucoes.camposResumo : P.instrucoes.camposFontes);

  return {
    biblia: usarBiblia,
    perspicaz: usarPerspicaz,
    sistema: "\n\n" + instrucoes.join("\n\n"),
    mensagem: "\n\nARQUIVOS ENVIADOS AO AMBIENTE DE CÓDIGO:\n" + arquivos.map((a) => `- ${a.rotulo} (file_id ${a.id})`).join("\n"),
    blocos: arquivos.map((a) => ({ type: "container_upload", file_id: a.id })),
    ferramentas: [{ type: "code_execution_20260521", name: "code_execution" }],
  };
}

// Junta o que as execuções de código imprimiram: é a única prova de que a IA leu o arquivo.
function saidaDasFerramentas(blocos) {
  const partes = [];
  for (const b of blocos) {
    if (typeof b.type === "string" && b.type.endsWith("_tool_result") && b.content && typeof b.content.stdout === "string") {
      partes.push(b.content.stdout);
    }
  }
  return partes.join("\n");
}

function chaveDeBusca(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Em "Efésios 6:10 texto\nEfésios 6:11 texto", tira as referências do começo das linhas, para um trecho de vários
// versículos continuar sendo encontrado como texto corrido (também com o prefixo "123:" do grep -n).
const PREFIXO_VERSICULO = /^\s*(?:\d+[:-])?\s*(?:[1-3]\s)?[^\d\n]{2,30}?\s\d{1,3}:\d{1,3}\s+/;

function textoLido(blocos) {
  const saida = saidaDasFerramentas(blocos);
  const semReferencias = saida.split("\n").map((l) => l.replace(PREFIXO_VERSICULO, "")).join(" ");
  return { bruto: chaveDeBusca(saida), corrido: chaveDeBusca(semReferencias) };
}

function foiLido(lido, texto) {
  const chave = chaveDeBusca(texto);
  return chave.length >= 3 && (lido.corrido.includes(chave) || lido.bruto.includes(chave));
}

function sanearTextos(textos, lido, usarBiblia, maxTextos) {
  if (!usarBiblia || !Array.isArray(textos)) return [];
  const resultado = [];
  for (const t of textos.slice(0, maxTextos)) {
    if (!t || typeof t !== "object") continue;
    const referencia = limparTextoGerado(t.referencia, 60);
    const bruto = limparTrecho(t.texto).replace(/^\d{1,3}\s+/, "").replace(/\s+/g, " ");
    const aplicacao = limparTextoGerado(t.aplicacao, 500);
    if (!referencia || !bruto || bruto.length > MAX_CHARS_VERSICULO || !aplicacao) continue;
    // Só entra o versículo que apareceu na saída do arquivo; nada de citação de memória.
    if (bruto.length < 8 || !foiLido(lido, bruto)) continue;
    resultado.push({ referencia, texto: bruto, aplicacao });
  }
  return resultado;
}

function sanearPerspicaz(p, lido, usarPerspicaz) {
  if (!usarPerspicaz || !p || typeof p !== "object") return null;
  const volume = Number(p.volume) === 1 ? 1 : Number(p.volume) === 2 ? 2 : 0;
  const verbete = limparTextoGerado(String(p.verbete || "").replace(/=+/g, ""), 80);
  const explicacao = limparTextoGerado(p.explicacao, 700);
  if (!volume || !verbete || !explicacao || !foiLido(lido, verbete)) return null;
  return { volume, verbete, explicacao };
}

function limparLinha(valor, max) {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Um item de resposta pronto para o navegador: texto limpo, destaques conferidos e, se pedidos, versículos e Perspicaz.
function montarItem(i, opcoes, permitidos, lido, fontes, maxTextos) {
  const texto = limparTextoGerado(i.resposta, 1500);
  return {
    paragrafos: limparLinha(i.paragrafos, 20),
    resposta: texto,
    emoji: opcoes.emoji ? limparEmoji(i.emoji) : null,
    destaques: sanearDestaques(i.destaques, texto, opcoes, permitidos),
    textos: sanearTextos(i.textos, lido, !!(fontes && fontes.biblia), maxTextos),
    perspicaz: sanearPerspicaz(i.perspicaz, lido, !!(fontes && fontes.perspicaz)),
    referencias: (Array.isArray(i.referencias) ? i.referencias : []).map((r) => limparLinha(r, 60)).filter(Boolean).slice(0, 3),
  };
}

// Segundo passo, só quando precisa: a IA já respondeu (sem arquivo nenhum) e indicou que a pergunta cita texto bíblico.
// Então, e só então, o arquivo da Bíblia é carregado para transcrever esses versículos e aplicá-los à resposta.
// Se esse passo falhar, a resposta já pronta segue sem os versículos.
async function completarComTextos(itens, P) {
  const biblia = idDoArquivo("ARQUIVO_BIBLIA_ID");
  const alvo = biblia ? itens.filter((i) => i.referencias.length) : [];
  if (!alvo.length) return;

  try {
    const client = new Anthropic({ maxRetries: 0, timeout: 50_000 });
    const lista = alvo.map((i, indice) => ({ indice, paragrafos: i.paragrafos, resposta: i.resposta, referencias: i.referencias }));
    const { resposta, blocos } = await conversar(client, {
      system: P.sistemaComplemento,
      mensagens: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "ITENS (JSON):\n" + JSON.stringify(lista) + `\n\nARQUIVO ENVIADO AO AMBIENTE DE CÓDIGO:\n- Bíblia (um versículo por linha) (file_id ${biblia})`,
            },
            { type: "container_upload", file_id: biblia },
          ],
        },
      ],
      tools: [{ type: "code_execution_20260521", name: "code_execution" }],
      maxTokens: 4000,
      voltas: 4,
    });
    if (resposta.stop_reason === "refusal") return;

    const texto = resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const SaidaComplemento = z.object({ itens: z.array(z.object({ indice: z.coerce.number().int(), textos: TextosSchema })) });
    const dados = SaidaComplemento.safeParse(extrairJson(texto));
    if (!dados.success) return;

    const lido = textoLido(blocos);
    for (const r of dados.data.itens) {
      const item = alvo[r.indice];
      if (item) item.textos = sanearTextos(r.textos, lido, true, P.limites.maxTextos);
    }
  } catch (e) {
    console.error("Não foi possível acrescentar os textos bíblicos:", e?.status, e?.message);
  }
}

// Fecha os itens antes de enviá-los ao navegador: completa os versículos se faltarem e tira o campo interno.
async function finalizarItens(itens, fontes, P) {
  if (!(fontes && fontes.biblia)) await completarComTextos(itens, P);
  return itens.map(({ referencias, ...resto }) => resto);
}

// Conversa com a IA tratando pause_turn (turno longo pausado pela API) e reaproveitando o mesmo container, onde os
// arquivos já foram carregados. Devolve a última resposta e todos os blocos de todos os turnos.
async function conversar(client, { system, mensagens, tools, maxTokens, voltas }) {
  let resposta;
  let container = null;
  const blocos = [];
  for (let volta = 0; volta < voltas; volta++) {
    resposta = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: mensagens,
      tools,
      ...(container ? { container } : {}),
    });
    blocos.push(...resposta.content);
    if (resposta.container && resposta.container.id) container = resposta.container.id;
    if (resposta.stop_reason !== "pause_turn") break;
    mensagens = [...mensagens, { role: "assistant", content: resposta.content }];
  }
  return { resposta, blocos };
}

const Destaque = z.object({
  trecho: z.string(),
  tipo: z.enum(TIPOS).catch("geral"),
  estilo: z.enum(ESTILOS).nullable().optional(),
  maiusculas: z.boolean().optional(),
});

const TextosSchema = z.array(z.object({ referencia: z.string(), texto: z.string(), aplicacao: z.string() })).nullable().optional().catch(null);
const PerspicazSchema = z.object({ volume: z.coerce.number(), verbete: z.string(), explicacao: z.string() }).nullable().optional().catch(null);

// Resposta de "Sugerir formatação + resumo" quando a IA usa a execução de código (JSON em texto, campos tolerantes).
const SaidaResumoFontes = z.object({
  resumo: z.string().nullable().optional(),
  sugestoes: z
    .array(
      z.object({
        linha: z.coerce.number().int(),
        modeloId: z.string().nullable().optional(),
        emoji: z.string().nullable().optional(),
        destaques: z.array(Destaque).optional(),
        motivo: z.string().nullable().optional(),
      })
    )
    .optional(),
  textos: TextosSchema,
  perspicaz: PerspicazSchema,
});

// Item de resposta lido de JSON em texto (leitura do site e consulta às fontes); os campos extras são tolerantes.
const ItemResposta = z.object({
  paragrafos: z.string(),
  resposta: z.string(),
  emoji: z.string().nullable().optional(),
  destaques: z.array(Destaque).optional(),
  referencias: z.array(z.string()).optional().catch([]),
  textos: TextosSchema,
  perspicaz: PerspicazSchema,
});

const SaidaSentinela = z.object({
  itens: z.array(
    z.object({
      paragrafos: z.string(),
      resposta: z.string(),
      emoji: z.string().nullable(),
      destaques: z.array(
        z.object({
          trecho: z.string(),
          tipo: z.enum(TIPOS),
          estilo: z.enum(ESTILOS).nullable(),
          maiusculas: z.boolean(),
        })
      ),
      referencias: z.array(z.string()),
    })
  ),
});

const SaidaSentinelaFontes = z.object({ itens: z.array(ItemResposta) });

const DESCRICAO_RESPOSTA = {
  curto: "curta (1 a 2 frases)",
  medio: "média (2 a 4 frases)",
  detalhado: "detalhada (4 a 6 frases)",
};

function tratarErro(e, res) {
  if (e instanceof Anthropic.RateLimitError) {
    return erro(res, 429, "Limite de uso da IA atingido. Tente novamente mais tarde.");
  }
  if (e instanceof Anthropic.APIError && e.status === 400 && /usage limits/i.test(String(e.message))) {
    return erro(res, 429, "O limite mensal de gastos da IA foi atingido. As sugestões voltam no próximo mês.");
  }
  console.error("Erro ao chamar a IA:", e?.status, e?.message);
  return erro(res, 502, "Não foi possível obter sugestões agora. Tente novamente.");
}

async function responderSentinela(res, { linhas, opcoes, modo, ajuste, anteriores }, P) {
  // A consulta às fontes não exige o código de acesso (o código vale só para a leitura do wol.jw.org). Sem caixa
  // marcada nenhum arquivo é carregado: a resposta sai como sempre e, só se a pergunta citar texto bíblico, um segundo
  // passo busca os versículos (finalizarItens).
  const fontes = prepararFontes(opcoes, P);
  if (fontes && fontes.erro) return erro(res, 500, fontes.erro);

  let mensagem =
    "PREFERÊNCIAS:\n" +
    `- Tamanho de cada resposta: ${DESCRICAO_RESPOSTA[opcoes.resumoTamanho]}.\n` +
    descreverFormatacaoResposta(opcoes) +
    (opcoes.instrucao ? `\n- Instruções fixas do usuário: ${opcoes.instrucao}` : "") +
    (ajuste ? `\n\nORIENTAÇÃO ESPECÍFICA DO USUÁRIO PARA ESTE PEDIDO: ${ajuste}` : "") +
    "\n\nTEXTO COLADO:\n" +
    linhas.join("\n");

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      (modo === "nova"
        ? "\n\nPEDIDO: escreva respostas DIFERENTES das anteriores (outras palavras e outro enfoque), mantendo a fidelidade ao texto."
        : "\n\nPEDIDO: melhore as respostas anteriores, mantendo o que estava bom, seguindo a orientação específica acima (se houver).");
  }

  try {
    const permitidos = estilosDe(opcoes);

    // Com consulta às fontes: a IA usa a execução de código, então a resposta vem como JSON em texto.
    if (fontes) {
      const client = new Anthropic({ maxRetries: 1, timeout: 100_000 });
      const { resposta, blocos } = await conversar(client, {
        system: P.sistemaSentinela + fontes.sistema + "\n\n" + P.formatoJsonSentinela,
        mensagens: [{ role: "user", content: [{ type: "text", text: mensagem + fontes.mensagem }, ...fontes.blocos] }],
        tools: fontes.ferramentas,
        maxTokens: 8000,
        voltas: 5,
      });

      if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu gerar as respostas para este texto.");

      const texto = resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const dados = SaidaSentinelaFontes.safeParse(extrairJson(texto));
      if (!dados.success) return erro(res, 502, "A IA não devolveu as respostas no formato esperado. Tente novamente.");

      const lido = textoLido(blocos);
      const itens = dados.data.itens
        .slice(0, 40)
        .map((i) => montarItem(i, opcoes, permitidos, lido, fontes, P.limites.maxTextos))
        .filter((i) => i.resposta);
      return res.status(200).json({ itens: await finalizarItens(itens, fontes, P) });
    }

    const client = new Anthropic({ maxRetries: 1, timeout: 55_000 });
    const resposta = await client.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      system: P.sistemaSentinela,
      messages: [{ role: "user", content: mensagem }],
      output_config: { format: zodOutputFormat(SaidaSentinela) },
    });

    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu gerar as respostas para este texto.");
    }

    const itens = resposta.parsed_output.itens
      .slice(0, 40)
      .map((i) => montarItem(i, opcoes, permitidos, { bruto: "", corrido: "" }, null, P.limites.maxTextos))
      .filter((i) => i.resposta);

    return res.status(200).json({ itens: await finalizarItens(itens, null, P) });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo da semana: a IA lê o artigo no wol.jw.org ----------
// A leitura é feita pela ferramenta web_fetch da própria Anthropic, só no domínio wol.jw.org, a cada clique
// de quem tem o código de acesso. O texto do artigo não é guardado nem devolvido ao navegador: só as
// respostas, com palavras próprias, e o título do artigo lido.

const SaidaEstudo = z.object({
  titulo: z.string().nullable().optional(),
  erro: z.string().nullable().optional(),
  itens: z.array(ItemResposta),
});

function codigoValido(informado) {
  return textosIguais(informado, process.env.CODIGO_ESTUDO);
}

// Aceita o número do artigo (7 dígitos), o link do artigo ou, sem nada, a página de reuniões da semana.
function urlDoEstudo(body) {
  const artigo = typeof body.artigo === "string" ? body.artigo.trim() : "";

  if (/^\d{7}$/.test(artigo)) return `https://wol.jw.org/pt/wol/d/r5/lp-t/${artigo}`;

  if (artigo) {
    try {
      const url = new URL(artigo);
      const m = url.pathname.match(/^\/pt\/wol\/d\/r5\/lp-t\/(\d{7})\/?$/);
      return url.hostname === "wol.jw.org" && m ? `https://wol.jw.org/pt/wol/d/r5/lp-t/${m[1]}` : null;
    } catch {
      return null;
    }
  }

  const ano = Number(body.ano);
  const semana = Number(body.semana);
  if (Number.isInteger(ano) && ano >= 2020 && ano <= 2100 && Number.isInteger(semana) && semana >= 1 && semana <= 53) {
    return `https://wol.jw.org/pt/wol/meetings/r5/lp-t/${ano}/${semana}`;
  }
  return null;
}

function extrairJson(texto) {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

// "1, 2" -> {1, 2}; "3-5" -> {3, 4, 5}; "1 e 2" -> {1, 2}. Serve para conferir se a IA respondeu só aos
// parágrafos pedidos (ela às vezes entende "8" como "até o 8" e responde aos anteriores também).
function numerosDosParagrafos(texto) {
  const numeros = new Set();
  for (const parte of String(texto || "").replace(/\s+e\s+/gi, ",").split(",")) {
    const faixa = parte.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (faixa) {
      for (let n = Number(faixa[1]); n <= Number(faixa[2]) && n < 200; n++) numeros.add(n);
    } else {
      const unico = parte.match(/\d+/);
      if (unico) numeros.add(Number(unico[0]));
    }
  }
  return numeros;
}

async function responderEstudo(res, body, P) {
  if (!process.env.CODIGO_ESTUDO) return erro(res, 500, "A leitura do estudo ainda não está configurada no servidor.");
  if (!codigoValido(body.codigo)) return erro(res, 403, "Código de acesso inválido.");

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  const pedido = String(body.paragrafos || "").trim();
  // "recapitulação", "Recapitulacao", "perguntas de recapitulação" ou só "recap": o quadro final do artigo.
  const recapitulacao = /^(perguntas de )?recap/.test(pedido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const paragrafos = recapitulacao ? "recapitulacao" : /^(todos|[\d\s,\-–]{1,40})$/i.test(pedido) ? pedido : "todos";
  const alvoBruto = recapitulacao || /^todos$/i.test(paragrafos) ? null : numerosDosParagrafos(paragrafos);
  const alvo = alvoBruto && alvoBruto.size ? alvoBruto : null; // null = todos os parágrafos
  const opcoes = validarOpcoes(body.opcoes);
  const fontes = prepararFontes(opcoes, P);
  if (fontes && fontes.erro) return erro(res, 500, fontes.erro);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores =
    modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 8000) : "";

  let mensagem =
    `ENDEREÇO: ${url}\n` +
    (alvo
      ? `ESCOPO: responda SOMENTE às perguntas do(s) parágrafo(s) de número ${[...alvo].join(", ")} do artigo. São números de parágrafos (por exemplo, "8" é o parágrafo 8, e não "oito parágrafos"). NÃO responda a nenhum outro parágrafo, nem aos anteriores.\n`
      : recapitulacao
        ? 'ESCOPO: a RECAPITULAÇÃO. Responda SOMENTE às perguntas do quadro de recapitulação no fim do artigo (o quadro "Qual é a sua resposta?"), numeradas na ordem em que aparecem (1, 2, 3...). NÃO responda às perguntas dos parágrafos.\n'
        : "ESCOPO: todos os parágrafos do artigo que têm pergunta (sem o quadro de recapitulação).\n") +
    `PREFERÊNCIAS:\n- Tamanho de cada resposta: ${DESCRICAO_RESPOSTA[opcoes.resumoTamanho]}.\n` +
    descreverFormatacaoResposta(opcoes) +
    (opcoes.instrucao ? `\n- Instruções fixas do usuário: ${opcoes.instrucao}` : "") +
    (ajuste ? `\n\nORIENTAÇÃO ESPECÍFICA DO USUÁRIO PARA ESTE PEDIDO: ${ajuste}` : "");

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      (modo === "nova"
        ? "\n\nPEDIDO: escreva respostas DIFERENTES das anteriores (outras palavras e outro enfoque), mantendo a fidelidade ao artigo."
        : "\n\nPEDIDO: melhore as respostas anteriores, mantendo o que estava bom, seguindo a orientação específica acima (se houver).");
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: fontes ? 100_000 : 90_000 });
    const tools = [
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
      ...(fontes ? fontes.ferramentas : []),
    ];

    const { resposta, blocos } = await conversar(client, {
      system: P.sistemaEstudo + (fontes ? fontes.sistema : ""),
      mensagens: [
        {
          role: "user",
          content: fontes ? [{ type: "text", text: mensagem + fontes.mensagem }, ...fontes.blocos] : mensagem,
        },
      ],
      tools,
      maxTokens: fontes ? 8000 : 6000,
      voltas: fontes ? 6 : 3,
    });

    if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu responder a este pedido.");

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");
    const dados = SaidaEstudo.safeParse(extrairJson(texto));
    if (!dados.success) return erro(res, 502, "A IA não devolveu as respostas no formato esperado. Tente novamente.");

    const limpar = limparLinha;
    const permitidos = estilosDe(opcoes);
    const lido = textoLido(blocos);
    const itensTodos = dados.data.itens
      .slice(0, 40)
      .map((i) => montarItem(i, opcoes, permitidos, lido, fontes, P.limites.maxTextos))
      .filter((i) => i.resposta);

    // Recapitulação: as perguntas do quadro vêm numeradas 1, 2, 3...; o rótulo "Recap. N" não se confunde com parágrafos.
    if (recapitulacao) {
      itensTodos.forEach((i, pos) => {
        i.paragrafos = "Recap. " + ((i.paragrafos.match(/\d+/) || [String(pos + 1)])[0]);
      });
    }

    // Mesmo que a IA responda a mais, só ficam os parágrafos pedidos.
    const itens = alvo
      ? itensTodos.filter((i) => {
          const rotulos = numerosDosParagrafos(i.paragrafos);
          return rotulos.size ? [...rotulos].some((n) => alvo.has(n)) : itensTodos.length === 1;
        })
      : itensTodos;

    const itensFinais = await finalizarItens(itens, fontes, P);

    return res.status(200).json({
      titulo: limpar(dados.data.titulo, 200) || null,
      erro: itens.length
        ? null
        : itensTodos.length
          ? "A IA não respondeu ao(s) parágrafo(s) pedido(s). Tente de novo ou recarregue a numeração dos parágrafos."
          : limpar(dados.data.erro, 300) || "Não consegui ler o artigo ou encontrar as perguntas.",
      url,
      itens: itensFinais,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Lista de parágrafos do estudo ----------
// A IA lê o artigo e devolve só os números dos parágrafos, agrupados quando compartilham a mesma pergunta
// (ex.: "1, 2"). O app usa essa lista para navegar entre os grupos.

const SaidaLista = z.object({
  titulo: z.string().nullable().optional(),
  erro: z.string().nullable().optional(),
  artigo: z.string().nullable().optional(),
  grupos: z.array(z.string()),
  recapitulacao: z.boolean().optional(),
});

// "1 e 2" -> "1, 2"; "3 – 4" -> "3-4". Descarta o que não parecer uma lista de números.
function normalizarGrupo(grupo) {
  const texto = String(grupo || "")
    .replace(/(\d)\s*(?:e|,)\s*(?=\d)/gi, "$1, ")
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, "$1-")
    .trim();
  return /^\d{1,3}(?:(?:, |-)\d{1,3}){0,15}$/.test(texto) ? texto : null;
}

// Prefere o endereço que a ferramenta realmente leu (confiável) ao número que o modelo disser.
function idDoArtigoLido(resposta, urlPedida, informadoPelaIa) {
  const padrao = /\/pt\/wol\/d\/r5\/lp-t\/(\d{7})\/?$/;
  let id = null;
  for (const bloco of resposta.content) {
    if (bloco.type === "web_fetch_tool_result" && bloco.content && typeof bloco.content.url === "string") {
      const m = bloco.content.url.match(padrao);
      if (m) id = m[1];
    }
  }
  if (id) return id;
  const pedida = urlPedida.match(padrao);
  if (pedida) return pedida[1];
  return /^\d{7}$/.test(String(informadoPelaIa || "").trim()) ? String(informadoPelaIa).trim() : null;
}

async function listarParagrafos(res, body, P) {
  if (!process.env.CODIGO_ESTUDO) return erro(res, 500, "A leitura do estudo ainda não está configurada no servidor.");
  if (!codigoValido(body.codigo)) return erro(res, 403, "Código de acesso inválido.");

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 90_000 });
    const tools = [
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
    ];

    let mensagens = [{ role: "user", content: `ENDEREÇO: ${url}` }];
    let resposta;
    for (let volta = 0; volta < 3; volta++) {
      resposta = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: P.sistemaLista,
        messages: mensagens,
        tools,
      });
      if (resposta.stop_reason !== "pause_turn") break;
      mensagens = [...mensagens, { role: "assistant", content: resposta.content }];
    }

    if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu responder a este pedido.");

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");
    const dados = SaidaLista.safeParse(extrairJson(texto));
    if (!dados.success) return erro(res, 502, "A IA não devolveu a lista no formato esperado. Tente novamente.");

    const vistos = new Set();
    const grupos = [];
    for (const g of dados.data.grupos.slice(0, 60)) {
      const normal = normalizarGrupo(g);
      if (normal && !vistos.has(normal)) {
        vistos.add(normal);
        grupos.push(normal);
      }
    }
    if (grupos.length > 40) grupos.length = 40;

    const limpar = (valor, max) => (typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "");
    const artigo = idDoArtigoLido(resposta, url, dados.data.artigo);

    return res.status(200).json({
      titulo: limpar(dados.data.titulo, 200) || null,
      artigo,
      url,
      grupos,
      recapitulacao: dados.data.recapitulacao !== false,
      erro: grupos.length ? null : limpar(dados.data.erro, 300) || "Não consegui ler o artigo ou encontrar os parágrafos.",
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }

  if (!origemPermitida(req.headers.origin)) {
    return erro(res, 403, "Origem não permitida.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return erro(res, 500, "Recurso de IA ainda não configurado no servidor.");
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip)) {
    return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
  }

  // Prompts atuais (padrão do código + edições do administrador, guardadas no Global Config).
  const P = await carregarPrompts();

  if (req.body && req.body.tarefa === "estudo") return responderEstudo(res, req.body, P);
  if (req.body && req.body.tarefa === "estudo-lista") return listarParagrafos(res, req.body, P);

  const entrada = validarEntrada(req.body);
  if (!entrada) {
    const sentinela = req.body && req.body.tarefa === "sentinela";
    return erro(
      res,
      400,
      `Texto inválido ou grande demais (máximo ${sentinela ? MAX_CHARS_SENTINELA : MAX_CHARS} caracteres e ${sentinela ? MAX_LINHAS_SENTINELA : MAX_LINHAS} linhas).`
    );
  }

  if (entrada.tarefa === "sentinela") return responderSentinela(res, entrada, P);

  const { linhas, modelos, opcoes, modo, ajuste, anteriores } = entrada;
  // Modelos que acrescentam aspas (ex.: ❝{texto}❞) só entram se o usuário pedir aspas.
  const permiteAspas = /aspas/i.test(`${opcoes.instrucao} ${ajuste}`);
  const modelosUsaveis = permiteAspas ? modelos : modelos.filter((m) => !TEM_ASPAS.test(m.conteudo));
  const idsValidos = new Set(modelosUsaveis.map((m) => m.id));
  const estilosPermitidos = new Set([
    ...(opcoes.negrito ? ["negrito"] : []),
    ...(opcoes.italico ? ["italico"] : []),
    ...(opcoes.negritoItalico ? ["negrito_italico"] : []),
  ]);

  let mensagem =
    "PREFERÊNCIAS DO USUÁRIO:\n" +
    descreverPreferencias(opcoes) +
    (ajuste ? `\n\nORIENTAÇÃO ESPECÍFICA DO USUÁRIO PARA ESTE PEDIDO: ${ajuste}` : "") +
    "\n\nMODELOS DISPONÍVEIS:\n" +
    (modelosUsaveis.length
      ? modelosUsaveis.map((m) => `- id=${m.id} | nome=${m.nome} | conteúdo=${m.conteudo}`).join("\n")
      : "(nenhum)") +
    "\n\nLINHAS DO TEXTO:\n" +
    linhas.map((l, i) => `[${i}] ${l}`).join("\n");

  if (modo && anteriores) {
    mensagem +=
      "\n\nSUGESTÕES ANTERIORES (JSON):\n" +
      anteriores +
      (modo === "nova"
        ? "\n\nPEDIDO: proponha uma alternativa DIFERENTE das sugestões anteriores (outros modelos, trechos ou emojis)."
        : "\n\nPEDIDO: melhore as sugestões anteriores, mantendo o que estava bom, seguindo a orientação específica acima (se houver).");
  }

  // Com resumo, as caixas "Consultar textos citados" e "Consultar o Perspicaz" valem para o resumo; a IA usa então
  // a execução de código e a resposta vem como JSON em texto (em vez da saída estruturada).
  const fontes = opcoes.resumo ? prepararFontes(opcoes, P, true) : null;
  if (fontes && fontes.erro) return erro(res, 500, fontes.erro);

  try {
    let saida;
    let lido = null;

    if (fontes) {
      const client = new Anthropic({ maxRetries: 1, timeout: 100_000 });
      const { resposta, blocos } = await conversar(client, {
        system: P.sistemaFormatacao + fontes.sistema + "\n\n" + P.formatoJsonResumo,
        mensagens: [{ role: "user", content: [{ type: "text", text: mensagem + fontes.mensagem }, ...fontes.blocos] }],
        tools: fontes.ferramentas,
        maxTokens: 8000,
        voltas: 5,
      });
      if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu gerar sugestões para este texto.");

      const texto = resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const dados = SaidaResumoFontes.safeParse(extrairJson(texto));
      if (!dados.success) return erro(res, 502, "A IA não devolveu as sugestões no formato esperado. Tente novamente.");
      saida = { ...dados.data, sugestoes: dados.data.sugestoes || [] };
      lido = textoLido(blocos);
    } else {
      const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
      const resposta = await client.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        system: P.sistemaFormatacao,
        messages: [{ role: "user", content: mensagem }],
        output_config: { format: zodOutputFormat(Saida) },
      });

      if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
        return erro(res, 502, "A IA não conseguiu gerar sugestões para este texto.");
      }
      saida = resposta.parsed_output;
    }

    // A IA recebe as preferências por texto, mas o servidor também as impõe: o que o usuário
    // desmarcou é descartado aqui, mesmo que o modelo tenha sugerido.
    const vistas = new Set();
    const sugestoes = [];
    for (const s of saida.sugestoes) {
      if (s.linha < 0 || s.linha >= linhas.length || vistas.has(s.linha)) continue;

      const linha = linhas[s.linha];
      const modeloId = opcoes.usarModelos && s.modeloId && idsValidos.has(s.modeloId) ? s.modeloId : null;
      const emoji = opcoes.emoji ? limparEmoji(s.emoji) : null;

      const destaques = sanearDestaques(s.destaques, linha, opcoes, estilosPermitidos);

      if (!modeloId && !emoji && !destaques.length) continue;

      vistas.add(s.linha);
      sugestoes.push({
        linha: s.linha,
        modeloId,
        emoji,
        destaques,
        motivo: String(s.motivo || "").slice(0, 200),
      });
    }

    const resumo =
      opcoes.resumo && typeof saida.resumo === "string" ? limparTextoGerado(saida.resumo, MAX_RESUMO) || null : null;

    // Versículos e Perspicaz acompanham o resumo; sem resumo não há onde mostrá-los.
    const textos = resumo && fontes ? sanearTextos(saida.textos, lido, fontes.biblia, P.limites.maxTextos) : [];
    const perspicaz = resumo && fontes ? sanearPerspicaz(saida.perspicaz, lido, fontes.perspicaz) : null;

    return res.status(200).json({ resumo, sugestoes, textos, perspicaz });
  } catch (e) {
    return tratarErro(e, res);
  }
}
