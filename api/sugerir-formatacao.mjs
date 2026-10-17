// Função serverless (Vercel) que pede à IA sugestões de formatação para as linhas do texto.
// A chave da API fica só aqui, na variável de ambiente ANTHROPIC_API_KEY — nunca vai para o navegador.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";
import { buscarVerbete, buscarVersiculos, fontesConfiguradas, precarregarFontes } from "./_fontes.mjs";

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
// Os textos dos prompts moram em _prompts.mjs (o administrador edita o tom e as regras pelo app).
// Os limites de tamanho e de quantidade (textos, destaques, respostas, pedidos por hora...) são configuráveis pelo
// administrador e chegam por P.limites (ver LIMITES em _prompts.mjs).
const MAX_MODELOS = 60;
const MAX_CHARS_MODELO = 200;
const MAX_TEXTO_LIVRE = 300;

const ESTILOS = ["negrito", "italico", "negrito_italico"];
const TIPOS = ["geral", "citacao_texto", "citacao_referencia"];
// Os modelos de lista que o app já tem (seção "Inserir marcadores e numeradores de lista"). A IA escolhe um deles para
// cada lista; quem escreve os marcadores e os números é o app.
const MODELOS_LISTA = [
  "blueDiamond",
  "orangeDiamond",
  "smallBlueDiamond",
  "smallOrangeDiamond",
  "diamondDot",
  "gemDiamond",
  "bullet",
  "arrow",
  "check",
  "simpleCheck",
  "numberDot",
  "numberParen",
  "circled",
  "blackCircle",
  "keycapNumber",
  "squareBlue",
  "squareAlternate",
  "circleBlue",
  "circleAlternate",
];

const CATALOGO_LISTAS = `blueDiamond (🔷 losango azul), orangeDiamond (🔶 losango laranja), smallBlueDiamond (🔹 losango azul pequeno), smallOrangeDiamond (🔸 losango laranja pequeno), diamondDot (💠 losango com ponto), gemDiamond (💎 diamante, para itens de destaque), bullet (• ponto, o mais simples), arrow (➤ seta, para itens que levam a uma conclusão ou ação), check (✅ para itens cumpridos, vantagens ou confirmações), simpleCheck (✔ o mesmo, mais discreto), numberDot (1. 2. 3., o padrão para passos ou sequência), numberParen (1) 2) 3)), circled (① ② ③), blackCircle (❶ ❷ ❸), keycapNumber (1️⃣ 2️⃣ 3️⃣, numeração em destaque), squareBlue (🟦 quadrado azul), squareAlternate (🟦🟧🟩 quadrados que alternam de cor), circleBlue (🔵 círculo azul), circleAlternate (🔵🟣🟢 círculos que alternam de cor)`;

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
      lista: z.object({ modelo: z.enum(MODELOS_LISTA), grupo: z.number().int() }).nullable(),
      quebras: z.array(z.string()),
      espacoAntes: z.boolean(),
      motivo: z.string(),
    })
  ),
  textosRelevantes: z.array(z.string()),
  verbetes: z.array(z.string()),
});

// Limite simples por IP, em memória (vale por instância; a proteção real de custo é o limite de gastos do Console).
const acessos = new Map();

function excedeuLimite(ip, limitePorHora) {
  const agora = Date.now();
  const janela = 60 * 60 * 1000;
  const lista = (acessos.get(ip) || []).filter((t) => agora - t < janela);
  if (lista.length >= limitePorHora) {
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
    usarListas: o.usarListas === true,
    separarIdeias: o.separarIdeias === true,
    resumo: o.resumo === true,
    resumoTamanho: TAMANHOS_RESUMO.includes(o.resumoTamanho) ? o.resumoTamanho : "medio",
    consultarBiblia: o.consultarBiblia === true,
    consultarPerspicaz: o.consultarPerspicaz === true,
    intensidade: INTENSIDADES.includes(o.intensidade) ? o.intensidade : "moderada",
    instrucao: textoLivre(o.instrucao),
  };
}

function validarEntrada(body, L) {
  if (!body || typeof body !== "object") return null;

  const tarefa = body.tarefa === "sentinela" ? "sentinela" : "formatar";
  const maxChars = tarefa === "sentinela" ? L.maxCharsSentinela : L.maxCharsFormatacao;
  const maxLinhas = tarefa === "sentinela" ? L.maxLinhasSentinela : L.maxLinhasFormatacao;

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
    `- Modelos: ${o.usarModelos ? "pode usar os modelos da lista" : "NÃO use modelos (modeloId sempre null), a menos que a orientação do usuário peça"}.`,
    `- Estilos permitidos nos destaques: ${estilos.length ? estilos.join(", ") : "nenhum (estilo sempre null, a menos que a orientação do usuário peça)"}.`,
    `- Letras maiúsculas nos destaques: ${o.maiusculas ? "permitidas" : "NÃO use (maiusculas sempre false), a menos que a orientação do usuário peça"}.`,
    `- Emoji ilustrativo no início da frase: ${o.emoji ? "SIM, sugira emojis que ilustrem o assunto de cada linha destacada" : "NÃO use (emoji sempre null), a menos que a orientação do usuário peça"}.`,
    `- Quantidade de sugestões: ${o.intensidade} (a orientação do usuário pode mudar isso).`,
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
  linhas.push(
    o.usarListas
      ? `- Listas: ATIVO. Quando várias linhas formarem uma enumeração (passos, pontos, exemplos, itens), organize-as como lista preenchendo "lista" em CADA uma delas: {"modelo": um dos modelos de lista do app, "grupo": número da lista}. Linhas da mesma lista têm o mesmo grupo e o mesmo modelo; listas diferentes, grupos diferentes. Escolha o modelo que combina com o conteúdo: numerados (numberDot, numberParen, circled, blackCircle, keycapNumber) para passos ou sequência com ordem; os de símbolo para itens sem ordem. Prefira o mesmo modelo nas listas parecidas do texto. Modelos disponíveis: ${CATALOGO_LISTAS}. Só marque linhas que realmente são itens de enumeração; nas demais "lista" é null. Linhas de lista normalmente não precisam de modelo de texto nem de emoji. O app coloca os marcadores e os números; você não os escreve.`
      : '- Listas: INATIVO (lista sempre null), a menos que a ORIENTAÇÃO DO USUÁRIO peça lista, marcadores ou numeração.'
  );
  linhas.push(
    o.separarIdeias
      ? '- Espaçamento: ATIVO. Separe as ideias com linhas em branco para o texto ficar arejado, mesmo que o original seja um só parágrafo: (1) em "quebras" liste, para cada linha, os trechos (copiados LITERALMENTE da linha) onde começa uma NOVA ideia, e o app insere uma linha em branco antes de cada um (não inclua o começo da linha; só quebras no meio, entre frases completas); (2) em "espacoAntes" informe true na linha que começa uma nova ideia em relação à linha anterior, e o app insere uma linha em branco antes dela (nunca na primeira linha). Não quebre no meio de uma frase nem separe uma ideia de seus exemplos ou explicações (a menos que a ORIENTAÇÃO DO USUÁRIO peça outro critério, por exemplo uma linha em branco entre cada frase: então liste em "quebras" o início de TODAS as frases, menos a primeira da linha). O app coloca as linhas em branco; você não as escreve.'
      : '- Espaçamento: INATIVO ("quebras" sempre [] e "espacoAntes" sempre false), a menos que a ORIENTAÇÃO DO USUÁRIO peça linhas em branco ou separação entre frases, ideias ou trechos: nesse caso use "quebras" (início de cada frase ou trecho, menos o primeiro da linha) e "espacoAntes" conforme ela pedir. Para separar frases, "quebras" deve trazer o início LITERAL de cada frase seguinte da linha.'
  );
  return linhas.join("\n");
}

// Orientação do usuário (campo "Orientação para a IA" do pedido e instruções fixas das configurações). Vai no INÍCIO da
// mensagem, com prioridade total sobre as preferências (inclusive as opções desmarcadas). Em branco: nada é enviado.
function blocoOrientacao(opcoes, ajuste) {
  const itens = [];
  if (ajuste) itens.push(`Orientação para este pedido: ${ajuste}`);
  if (opcoes.instrucao) itens.push(`Instruções fixas: ${opcoes.instrucao}`);
  if (!itens.length) return "";
  return (
    "ORIENTAÇÃO DO USUÁRIO (PRIORIDADE TOTAL: cumpra à risca, em todas as linhas ou respostas, acima de qualquer preferência, " +
    'regra de estilo ou opção marcada como INATIVO / "NÃO use" abaixo; confira o resultado contra ela antes de responder):\n' +
    itens.map((i) => `- ${i}`).join("\n") +
    "\n\n"
  );
}

const LEMBRETE_ORIENTACAO =
  "\n\nLEMBRETE FINAL: cumpra a ORIENTAÇÃO DO USUÁRIO que abre esta mensagem; ela vale mais que as preferências.";

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

function sanearDestaques(destaques, texto, opcoes, estilosPermitidos, maxDestaques) {
  const resultado = [];
  for (const d of (Array.isArray(destaques) ? destaques : []).slice(0, maxDestaques)) {
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
function descreverFormatacaoResposta(o, maxDestaques, sep) {
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  const quantidade = o.intensidade === "poucas" ? "poucos (1 a 2)" : o.intensidade === "muitas" ? `vários (até ${maxDestaques})` : "alguns (2 a 3)";
  return [
    `- Estilos permitidos nos destaques: ${estilos.length ? estilos.join(", ") : "nenhum (estilo sempre null, a menos que a orientação do usuário peça)"}.`,
    `- Letras maiúsculas nos destaques: ${o.maiusculas ? "permitidas" : "NÃO use (maiusculas sempre false)"}.`,
    `- Emoji ilustrativo no início da resposta: ${o.emoji ? "SIM, 1 a 3 emojis que ilustrem o assunto da resposta" : "NÃO use (emoji sempre null)"}.`,
    `- Quantidade de destaques por resposta: ${quantidade}.`,
    sep
      ? `- Espaçamento: ATIVO. Em cada item preencha "quebras" com os trechos (copiados LITERALMENTE do campo "resposta") onde começa cada nova ${sep === "frases" ? "frase" : "ideia"}, menos o começo da resposta; o app coloca uma linha em branco antes de cada um. Não quebre no meio de uma frase.`
      : '- Espaçamento: INATIVO ("quebras" sempre []).',
    o.citacoesBiblicas
      ? '- Citações bíblicas: se a resposta mencionar um texto bíblico (ex.: Efésios 6:12), marque a referência como tipo "citacao_referencia"; use o tipo "geral" nos demais destaques.'
      : '- Use apenas o tipo "geral" nos destaques.',
  ].join("\n");
}

// ---------- Fontes de consulta: Bíblia e Estudo Perspicaz ----------
// A IA só indica as referências bíblicas e os verbetes; o servidor busca o texto exato nos arquivos (_fontes.mjs, Vercel
// Blob privado) e uma chamada curta à IA, sem ferramentas, escreve a aplicação de cada versículo e a explicação do
// verbete. Nada é escrito de memória: o versículo vem sempre do arquivo.

function chaveDeBusca(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function consultaPedida(opcoes) {
  return Boolean(opcoes.consultarBiblia || opcoes.consultarPerspicaz);
}

// Linhas das preferências sobre as fontes. paraTexto = "Sugerir formatação" (as referências valem para o texto todo).
function descreverFontes(opcoes, P, paraTexto) {
  const linhas = [
    opcoes.consultarBiblia
      ? "- Consulta à Bíblia: ATIVA.\n" + (paraTexto ? P.instrucoes.bibliaResumo : P.instrucoes.bibliaRelevantes)
      : '- Consulta à Bíblia: INATIVA ("textosRelevantes" sempre []).',
    opcoes.consultarPerspicaz
      ? `- Consulta ao Estudo Perspicaz: ATIVA. ${P.instrucoes.perspicazUso} Indique o verbete em "verbetes" (lista vazia se nenhum acrescentar algo útil).`
      : '- Consulta ao Estudo Perspicaz: INATIVA ("verbetes" sempre []).',
  ];
  return "\n" + linhas.join("\n") + "\n\n" + P.instrucoes.referencias;
}

const SaidaAplicacao = z.object({
  itens: z.array(
    z.object({
      indice: z.number().int(),
      aplicacoes: z.array(z.object({ referencia: z.string(), aplicacao: z.string() })),
      explicacao: z.string().nullable(),
    })
  ),
});

// Completa cada item com os versículos (texto exato do arquivo) e o verbete do Perspicaz. Item: { contexto, referencias
// (da pergunta, sempre), relevantes (só com a consulta à Bíblia marcada), verbetes (só com o Perspicaz marcado) }.
// Grava item.textos = [{ referencia, texto, aplicacao }] e item.perspicaz = { volume, verbete, explicacao } | null.
// Se algo falhar, os itens seguem sem as fontes (a resposta já está pronta).
async function completarFontes(itens, opcoes, P, orientacao) {
  for (const item of itens) {
    item.textos = [];
    item.perspicaz = null;
  }
  const pedidos = itens.map((i) => ({
    refs: [...new Set([...(i.referencias || []), ...(opcoes.consultarBiblia ? i.relevantes || [] : [])])],
    verbetes: opcoes.consultarPerspicaz ? i.verbetes || [] : [],
  }));
  if (!fontesConfiguradas() || !pedidos.some((p) => p.refs.length || p.verbetes.length)) return;

  try {
    const achados = await Promise.all(
      pedidos.map(async (p) => ({
        textos: await buscarVersiculos(p.refs, P.limites.maxTextos),
        verbete: p.verbetes.length ? await buscarVerbete(p.verbetes) : null,
      }))
    );
    const lista = [];
    achados.forEach((a, indice) => {
      itens[indice].textos = a.textos.map((t) => ({ ...t, aplicacao: "" }));
      if (!a.textos.length && !a.verbete) return;
      lista.push({
        indice,
        contexto: String(itens[indice].contexto || "").slice(0, 3000),
        textos: a.textos,
        ...(a.verbete ? { verbete: { titulo: a.verbete.verbete, volume: a.verbete.volume, trecho: a.verbete.trecho } } : {}),
      });
    });
    if (!lista.length) return;

    const client = new Anthropic({ maxRetries: 1, timeout: 40_000 });
    const resposta = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: P.sistemaAplicacao,
      messages: [{ role: "user", content: (orientacao || "") + "ITENS (JSON):\n" + JSON.stringify(lista) }],
      output_config: { format: zodOutputFormat(SaidaAplicacao) },
    });
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return;

    for (const r of resposta.parsed_output.itens) {
      const item = itens[r.indice];
      const achado = achados[r.indice];
      if (!item || !achado) continue;
      item.textos.forEach((t, pos) => {
        const ap = r.aplicacoes.find((x) => chaveDeBusca(x.referencia) === chaveDeBusca(t.referencia)) || r.aplicacoes[pos];
        if (ap) t.aplicacao = limparTextoGerado(ap.aplicacao, 500);
      });
      const explicacao = achado.verbete && r.explicacao ? limparTextoGerado(r.explicacao, 700) : "";
      if (explicacao) item.perspicaz = { volume: achado.verbete.volume, verbete: achado.verbete.verbete, explicacao };
    }
  } catch (e) {
    console.error("Não foi possível completar com as fontes:", e?.status, e?.message);
  }
}

const listaDeTextos = (valor, max) =>
  (Array.isArray(valor) ? valor : []).map((r) => limparLinha(r, 80)).filter(Boolean).slice(0, max);

// Lista pedida pela IA para uma linha: o modelo de lista do app e o número do grupo; quem escreve os marcadores é o app.
function sanearLista(lista) {
  if (!lista || typeof lista !== "object" || !MODELOS_LISTA.includes(lista.modelo)) return null;
  const grupo = Number(lista.grupo);
  return Number.isInteger(grupo) && grupo >= 0 && grupo <= 999 ? { modelo: lista.modelo, grupo } : null;
}

// Trechos da linha onde começa uma nova ideia (o app põe uma linha em branco antes de cada um): só valem os que existem
// literalmente na linha, fora do começo dela, sem repetir e em número razoável.
function sanearQuebras(quebras, linha) {
  const resultado = [];
  for (const q of (Array.isArray(quebras) ? quebras : []).slice(0, 60)) {
    const trecho = typeof q === "string" ? q.trim() : "";
    if (trecho.length < 2 || !linha.includes(trecho) || linha.trim().startsWith(trecho) || resultado.includes(trecho)) continue;
    resultado.push(trecho);
  }
  return resultado;
}

// Como separar com linhas em branco: "frases" (uma linha em branco entre cada frase), "ideias" (entre as ideias) ou null.
// Vale a opção "Separar as ideias com linhas em branco" e também o que o usuário pedir na orientação ou nas instruções fixas.
function modoSeparacao(opcoes, ajuste) {
  const pedido = `${ajuste || ""} ${opcoes.instrucao || ""}`;
  const pedeFrases =
    /(separ\w*|quebr\w*|linhas?\s+em\s+branco|espa[çc]\w*)[^.;\n]{0,40}\bfrases?\b|\bfrases?\b[^.;\n]{0,40}(linhas?\s+em\s+branco|separad\w*|quebr\w*)/i;
  if (pedeFrases.test(pedido)) return "frases";
  if (opcoes.separarIdeias || /linhas?\s+em\s+branco|separ\w*\s+(as\s+|os\s+)?(ideias|par[áa]grafos|trechos)/i.test(pedido)) return "ideias";
  return null;
}

const ABREVIACOES = new Set(["sr", "sra", "srta", "dr", "dra", "cap", "caps", "vs", "ex", "etc", "pág", "págs", "nº", "v", "vv", "cf", "obs"]);

// Início de cada frase do texto, menos a primeira (o app coloca uma linha em branco antes de cada um). Cada trecho é
// copiado do próprio texto e só vale se for localizado exatamente nesse ponto.
function inicioDeFrases(texto) {
  const resultado = [];
  const re = /([.!?…]+["”’)»]*)\s+(?=["“‘(¿¡]?[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/gu;
  let m;
  while ((m = re.exec(texto)) && resultado.length < 60) {
    const palavra = (texto.slice(0, m.index).match(/(\p{L}+)$/u) || [])[1] || "";
    if (m[1] === "." && ABREVIACOES.has(palavra.toLowerCase())) continue;
    const inicio = re.lastIndex;
    for (const tamanho of [60, 120, 240]) {
      const peca = texto.slice(inicio, inicio + tamanho).trim();
      if (peca.length >= 2 && texto.indexOf(peca) === inicio) {
        resultado.push(peca);
        break;
      }
    }
  }
  return resultado;
}

function limparLinha(valor, max) {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Um item de resposta pronto para o navegador: texto limpo e destaques conferidos. As fontes entram depois
// (finalizarItens); os campos internos (contexto, referencias, relevantes, verbetes) não vão para o navegador.
function montarItem(i, opcoes, permitidos, L, sep) {
  const texto = limparTextoGerado(i.resposta, L.maxCharsResposta);
  // Linhas em branco dentro da resposta: frase a frase (calculado aqui, sem depender da IA) ou entre ideias (a IA indica).
  const quebras = sep === "frases" ? inicioDeFrases(texto) : sep ? sanearQuebras(i.quebras, texto) : [];
  return {
    paragrafos: limparLinha(i.paragrafos, 20),
    resposta: texto,
    quebras,
    emoji: opcoes.emoji ? limparEmoji(i.emoji) : null,
    destaques: sanearDestaques(i.destaques, texto, opcoes, permitidos, L.maxDestaques),
    contexto: texto,
    referencias: listaDeTextos(i.referencias, 3),
    relevantes: listaDeTextos(i.textosRelevantes, L.maxTextos),
    verbetes: listaDeTextos(i.verbetes, 2),
  };
}

// Fecha os itens antes de enviá-los ao navegador: busca as fontes e tira os campos internos.
async function finalizarItens(itens, opcoes, P, orientacao) {
  await completarFontes(itens, opcoes, P, orientacao);
  return itens.map(({ contexto, referencias, relevantes, verbetes, ...resto }) => resto);
}

// Conversa com a IA tratando pause_turn (turno longo pausado pela API, ex.: durante a leitura do site).
// Devolve a última resposta e todos os blocos de todos os turnos.
async function conversar(client, { system, mensagens, tools, maxTokens, voltas }) {
  let resposta;
  const blocos = [];
  for (let volta = 0; volta < voltas; volta++) {
    resposta = await client.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: mensagens, tools });
    blocos.push(...resposta.content);
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

// Item de resposta lido de JSON em texto (leitura do site); os campos extras são tolerantes.
const ItemResposta = z.object({
  paragrafos: z.string(),
  resposta: z.string(),
  quebras: z.array(z.string()).optional().catch([]),
  emoji: z.string().nullable().optional(),
  destaques: z.array(Destaque).optional(),
  referencias: z.array(z.string()).optional().catch([]),
  textosRelevantes: z.array(z.string()).optional().catch([]),
  verbetes: z.array(z.string()).optional().catch([]),
});

const SaidaSentinela = z.object({
  itens: z.array(
    z.object({
      paragrafos: z.string(),
      resposta: z.string(),
      quebras: z.array(z.string()),
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
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
});

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
  const sep = modoSeparacao(opcoes, ajuste);
  // A consulta às fontes não exige o código de acesso (o código vale só para a leitura do wol.jw.org).
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  // Os versículos citados na pergunta são sempre transcritos: a Bíblia começa a carregar enquanto a IA escreve.
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });

  let mensagem =
    blocoOrientacao(opcoes, ajuste) +
    "PREFERÊNCIAS:\n" +
    `- Tamanho de cada resposta: ${DESCRICAO_RESPOSTA[opcoes.resumoTamanho]}.\n` +
    descreverFormatacaoResposta(opcoes, P.limites.maxDestaques, sep) +
    descreverFontes(opcoes, P, false) +
    "\n\nTEXTO COLADO:\n" +
    linhas.join("\n") +
    (ajuste || opcoes.instrucao ? LEMBRETE_ORIENTACAO : "");

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
      .slice(0, P.limites.maxRespostas)
      .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
      .filter((i) => i.resposta);

    return res.status(200).json({ itens: await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste)) });
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
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores =
    modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 8000) : "";

  let mensagem =
    blocoOrientacao(opcoes, ajuste) +
    `ENDEREÇO: ${url}\n` +
    (alvo
      ? `ESCOPO: responda SOMENTE às perguntas do(s) parágrafo(s) de número ${[...alvo].join(", ")} do artigo. São números de parágrafos (por exemplo, "8" é o parágrafo 8, e não "oito parágrafos"). NÃO responda a nenhum outro parágrafo, nem aos anteriores.\n`
      : recapitulacao
        ? 'ESCOPO: a RECAPITULAÇÃO. Responda SOMENTE às perguntas do quadro de recapitulação no fim do artigo (o quadro "Qual é a sua resposta?"), numeradas na ordem em que aparecem (1, 2, 3...). NÃO responda às perguntas dos parágrafos.\n'
        : "ESCOPO: todos os parágrafos do artigo que têm pergunta (sem o quadro de recapitulação).\n") +
    `PREFERÊNCIAS:\n- Tamanho de cada resposta: ${DESCRICAO_RESPOSTA[opcoes.resumoTamanho]}.\n` +
    descreverFormatacaoResposta(opcoes, P.limites.maxDestaques, sep) +
    descreverFontes(opcoes, P, false) +
    (ajuste || opcoes.instrucao ? LEMBRETE_ORIENTACAO : "");

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      (modo === "nova"
        ? "\n\nPEDIDO: escreva respostas DIFERENTES das anteriores (outras palavras e outro enfoque), mantendo a fidelidade ao artigo."
        : "\n\nPEDIDO: melhore as respostas anteriores, mantendo o que estava bom, seguindo a orientação específica acima (se houver).");
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: 90_000 });
    const tools = [
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
    ];

    const { resposta } = await conversar(client, {
      system: P.sistemaEstudo,
      mensagens: [{ role: "user", content: mensagem }],
      tools,
      maxTokens: 7000,
      voltas: 3,
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
    const itensTodos = dados.data.itens
      .slice(0, P.limites.maxRespostas)
      .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
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

    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste));

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

  // Prompts e limites atuais (padrão do código + edições do administrador, guardadas no Global Config).
  const P = await carregarPrompts();

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip, P.limites.limitePorHora)) {
    return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
  }

  if (req.body && req.body.tarefa === "estudo") return responderEstudo(res, req.body, P);
  if (req.body && req.body.tarefa === "estudo-lista") return listarParagrafos(res, req.body, P);

  const entrada = validarEntrada(req.body, P.limites);
  if (!entrada) {
    const sentinela = req.body && req.body.tarefa === "sentinela";
    return erro(
      res,
      400,
      `Texto inválido ou grande demais (máximo ${sentinela ? P.limites.maxCharsSentinela : P.limites.maxCharsFormatacao} caracteres e ${sentinela ? P.limites.maxLinhasSentinela : P.limites.maxLinhasFormatacao} linhas).`
    );
  }

  if (entrada.tarefa === "sentinela") return responderSentinela(res, entrada, P);

  const { linhas, modelos, opcoes, modo, ajuste, anteriores } = entrada;
  // Modelos que acrescentam aspas (ex.: ❝{texto}❞) só entram se o usuário pedir aspas.
  const permiteAspas = /aspas/i.test(`${opcoes.instrucao} ${ajuste}`);
  const modelosUsaveis = permiteAspas ? modelos : modelos.filter((m) => !TEM_ASPAS.test(m.conteudo));
  const idsValidos = new Set(modelosUsaveis.map((m) => m.id));
  // Com orientação do usuário (campo do pedido ou instruções fixas) ela manda: o que ela pedir vale mesmo com a opção
  // desmarcada (a IA só usa um recurso desmarcado se a orientação pedir). Sem orientação, valem só as opções marcadas.
  const livre = Boolean(ajuste || opcoes.instrucao);
  const efetivas = livre
    ? { ...opcoes, usarModelos: true, emoji: true, negrito: true, italico: true, negritoItalico: true, maiusculas: true, usarListas: true, separarIdeias: true }
    : opcoes;
  const estilosPermitidos = new Set([
    ...(efetivas.negrito ? ["negrito"] : []),
    ...(efetivas.italico ? ["italico"] : []),
    ...(efetivas.negritoItalico ? ["negrito_italico"] : []),
  ]);

  let mensagem =
    blocoOrientacao(opcoes, ajuste) +
    "PREFERÊNCIAS DO USUÁRIO:\n" +
    descreverPreferencias(opcoes) +
    (consultaPedida(opcoes) ? descreverFontes(opcoes, P, true) : "") +
    "\n\nMODELOS DISPONÍVEIS:\n" +
    (modelosUsaveis.length
      ? modelosUsaveis.map((m) => `- id=${m.id} | nome=${m.nome} | conteúdo=${m.conteudo}`).join("\n")
      : "(nenhum)") +
    "\n\nLINHAS DO TEXTO:\n" +
    linhas.map((l, i) => `[${i}] ${l}`).join("\n") +
    (ajuste || opcoes.instrucao ? LEMBRETE_ORIENTACAO : "");

  if (modo && anteriores) {
    mensagem +=
      "\n\nSUGESTÕES ANTERIORES (JSON):\n" +
      anteriores +
      (modo === "nova"
        ? "\n\nPEDIDO: proponha uma alternativa DIFERENTE das sugestões anteriores (outros modelos, trechos ou emojis)."
        : "\n\nPEDIDO: melhore as sugestões anteriores, mantendo o que estava bom, seguindo a orientação específica acima (se houver).");
  }

  // As caixas "Consultar textos citados" e "Consultar o Perspicaz" valem para o texto (e para o resumo, quando houver).
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: opcoes.consultarBiblia, perspicaz: opcoes.consultarPerspicaz });

  try {
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
    const saida = resposta.parsed_output;

    // A IA recebe as preferências por texto, mas o servidor também as impõe: o que o usuário
    // desmarcou é descartado aqui, mesmo que o modelo tenha sugerido.
    const vistas = new Set();
    const modeloDoGrupo = new Map();
    const sugestoes = [];
    for (const s of saida.sugestoes) {
      if (s.linha < 0 || s.linha >= linhas.length || vistas.has(s.linha)) continue;

      const linha = linhas[s.linha];
      const modeloId = efetivas.usarModelos && s.modeloId && idsValidos.has(s.modeloId) ? s.modeloId : null;
      const emoji = efetivas.emoji ? limparEmoji(s.emoji) : null;

      const destaques = sanearDestaques(s.destaques, linha, efetivas, estilosPermitidos, P.limites.maxDestaques);

      let lista = efetivas.usarListas ? sanearLista(s.lista) : null;
      if (lista) {
        if (!modeloDoGrupo.has(lista.grupo)) modeloDoGrupo.set(lista.grupo, lista.modelo);
        lista = { modelo: modeloDoGrupo.get(lista.grupo), grupo: lista.grupo };
      }
      const quebras = efetivas.separarIdeias ? sanearQuebras(s.quebras, linha) : [];
      const espacoAntes = efetivas.separarIdeias && s.espacoAntes === true && s.linha > 0;

      if (!modeloId && !emoji && !destaques.length && !lista && !quebras.length && !espacoAntes) continue;

      vistas.add(s.linha);
      sugestoes.push({
        linha: s.linha,
        modeloId,
        emoji,
        destaques,
        lista,
        quebras,
        espacoAntes,
        motivo: String(s.motivo || "").slice(0, 200),
      });
    }

    // Frase a frase: o servidor calcula as quebras de todas as linhas (a IA costuma separar só por ideia ou esquecer linhas).
    if (modoSeparacao(opcoes, ajuste) === "frases") {
      linhas.forEach((linha, indice) => {
        const quebras = inicioDeFrases(linha);
        if (!quebras.length) return;
        const existente = sugestoes.find((x) => x.linha === indice);
        if (existente) existente.quebras = quebras;
        else {
          sugestoes.push({ linha: indice, modeloId: null, emoji: null, destaques: [], lista: null, quebras, espacoAntes: false, motivo: "Frases separadas por linha em branco" });
        }
      });
      sugestoes.sort((a, b) => a.linha - b.linha);
    }

    const resumo =
      opcoes.resumo && typeof saida.resumo === "string" ? limparTextoGerado(saida.resumo, P.limites.maxCharsResumo) || null : null;

    // Resumo, versículos e Perspicaz são independentes: cada um aparece só se foi pedido. O versículo vem do arquivo da
    // Bíblia; a aplicação (e a explicação do Perspicaz) é escrita para o resumo, ou para o texto quando não há resumo.
    const fonte = {
      contexto: resumo || linhas.join("\n"),
      referencias: [],
      relevantes: listaDeTextos(saida.textosRelevantes, P.limites.maxTextos),
      verbetes: listaDeTextos(saida.verbetes, 2),
    };
    if (consultaPedida(opcoes)) await completarFontes([fonte], opcoes, P, blocoOrientacao(opcoes, ajuste));
    const textos = fonte.textos || [];
    const perspicaz = fonte.perspicaz || null;

    return res.status(200).json({ resumo, sugestoes, textos, perspicaz });
  } catch (e) {
    return tratarErro(e, res);
  }
}
