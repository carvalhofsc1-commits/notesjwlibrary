// Função serverless (Vercel) que pede à IA sugestões de formatação para as linhas do texto.
// A chave da API fica só aqui, na variável de ambiente ANTHROPIC_API_KEY — nunca vai para o navegador.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { codigoDoDirigente, erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { lerConfigIa } from "./_iaConfig.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";
import { buscarVerbete, buscarVersiculos, fontesConfiguradas, precarregarFontes } from "./_fontes.mjs";
import {
  QUADROS_EBC,
  lerEstudoBiblico,
  lerEstudoDireto,
  lerDiscursoCurto,
  lerJoias,
  lerTesouros,
  lerTextoDiario,
  referenciasDeTesouros,
  referenciasDoDiscursoCurto,
  textoDaRecapitulacao,
  textoDasJoias,
  textoDoCapituloEbc,
  textoDoCapituloEbcDirigente,
  textoDoDiscursoCurto,
  textoDosGrupos,
  textoDosTesouros,
} from "./_wol.mjs";

// ---------- Modelo da IA ----------
// O modelo e o esforço vêm da escolha do administrador na tela de prompts (api/_iaConfig.mjs) e chegam em P.ia em
// cada pedido. Toda chamada à IA passa por chamarIa, que monta o pedido certo para o modelo escolhido:
//  - Esforço: quanto a IA pensa antes de responder ("low" é o padrão: rápido e barato). Modelos antigos (Haiku 4.5,
//    Sonnet 4.5...) não aceitam "effort": nesses casos ele não é enviado.
//  - semPensar: nas tarefas mecânicas (formatar linhas, escrever a aplicação de um versículo, listar os parágrafos) o
//    raciocínio interno só atrasa: no Haiku 5.5 ele é desligado (aceito com esforço low, medium ou high). Sonnet 5.5,
//    Opus 5.5 e Fable 5.1 recusam "disabled", então lá ele continua ligado e o esforço controla a demora.
//    CLAUDE_RACIOCINIO=on na Vercel deixa o Haiku pensar também nessas tarefas. Nas RESPOSTAS do estudo ele fica ligado:
//    sem ele as respostas saíam incoerentes.
//  - Recusa por engano: Sonnet 5.5, Opus 5.5 e Fable 5.1 têm filtros de segurança que às vezes recusam um pedido comum;
//    nesses modelos o pedido vai com o "fallback" do servidor da Anthropic, que refaz o pedido num modelo vizinho na
//    mesma chamada (o Haiku 5.5 não tem esse recurso).
const aceitaEsforco = (modelo) => !/haiku-4|sonnet-4-5|-3-/.test(modelo);
const temFallback = (modelo) => /^claude-(sonnet-5-5|opus-5-5|fable-5-1)$/.test(modelo);

async function chamarIa(client, P, params, { schema = null, semPensar = false } = {}) {
  const { modelo, esforco } = P.ia;
  const fallback = temFallback(modelo);
  const formato = schema ? (fallback ? betaZodOutputFormat(schema) : zodOutputFormat(schema)) : null;
  const output_config = { ...(formato ? { format: formato } : {}), ...(aceitaEsforco(modelo) ? { effort: esforco } : {}) };
  const pensar =
    semPensar && /haiku-5/.test(modelo) && process.env.CLAUDE_RACIOCINIO !== "on" ? { thinking: { type: "disabled" } } : {};
  const corpo = { ...params, model: modelo, ...pensar, ...(Object.keys(output_config).length ? { output_config } : {}) };
  if (!fallback) return schema ? client.messages.parse(corpo) : client.messages.create(corpo);
  const comFallback = { ...corpo, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  return schema ? client.beta.messages.parse(comFallback) : client.beta.messages.create(comFallback);
}

// Os modelos mais potentes pensam mais e demoram mais: o tempo máximo de espera dobra com eles (até 170 s, para a
// resposta e a aplicação dos textos caberem nos 300 s da função na Vercel).
const tempoIa = (P, base) => (/haiku/.test(P.ia.modelo) ? base : Math.min(170_000, base * 2));
// Os textos dos prompts moram em _prompts.mjs (o administrador edita o tom e as regras pelo app).
// Os limites de tamanho e de quantidade (textos, destaques, respostas, pedidos por hora...) são configuráveis pelo
// administrador e chegam por P.limites (ver LIMITES em _prompts.mjs).
const MAX_MODELOS = 60;
const MAX_CHARS_MODELO = 200;
const MAX_TEXTO_LIVRE = 300;

const ESTILOS = ["negrito", "italico", "negrito_italico"];
// Tipos de fonte (alfabetos Unicode do app) que a IA pode escolher para um destaque, além do negrito/itálico da fonte
// principal. Só os legíveis em palavras e frases curtas.
// O gótico (fraktur) ficou de fora a pedido do usuário.
// Regra fixa do usuário: só estas três. Script, largura cheia, letras circuladas, gótico e monoespaçado ficam de fora.
const FONTES = ["doubleStruck", "sans", "squaredDark"];
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
          fonte: z.enum(FONTES).nullable(),
        })
      ),
      lista: z.object({ modelo: z.enum(MODELOS_LISTA), grupo: z.number().int() }).nullable(),
      quebras: z.array(z.string()),
      espacoAntes: z.boolean(),
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
// Nome de cada tamanho nas partes editáveis ("Tamanho do resumo: médio", "Tamanho da resposta: médio").
const NOME_TAMANHO = { curto: "curto", medio: "médio", detalhado: "detalhado" };

// Troca {{nome}} pelos valores (uma passada só: o que o usuário digitou não é trocado de novo).
function trocar(frase, valores) {
  return String(frase || "").replace(/\{\{(\w+)\}\}/g, (marca, nome) => (nome in valores ? String(valores[nome]) : marca));
}

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
    variarFontes: o.variarFontes === true,
    emoji: o.emoji === true,
    citacoesBiblicas: o.citacoesBiblicas === true,
    usarListas: o.usarListas === true,
    separarIdeias: o.separarIdeias === true,
    resumo: o.resumo === true,
    resumoTamanho: TAMANHOS_RESUMO.includes(o.resumoTamanho) ? o.resumoTamanho : "medio",
    // Quatro formas de usar os textos bíblicos nas respostas, uma por vez: explicar e aplicar (sem transcrever nem citar
    // na resposta) > transcrever sem citar na resposta > só citar 1 ou 2 na resposta (sem transcrever) > transcrever e
    // citar na resposta (consultarBiblia).
    explicarTextos: o.explicarTextos === true,
    transcreverSemCitar: o.transcreverSemCitar === true && o.explicarTextos !== true,
    citarTextos: o.citarTextos === true && o.explicarTextos !== true && o.transcreverSemCitar !== true,
    consultarBiblia:
      o.consultarBiblia === true && o.citarTextos !== true && o.explicarTextos !== true && o.transcreverSemCitar !== true,
    // A consulta ao Perspicaz está desligada por enquanto (a opção saiu da tela); o código e os arquivos continuam prontos
    // para quando ela voltar: basta trocar para `o.consultarPerspicaz === true` e recolocar a caixa na tela.
    consultarPerspicaz: false,
    // Só para o botão "Sugerir perguntas adicionais": acrescenta perguntas de aplicação sobre os textos bíblicos.
    perguntasTextos: o.perguntasTextos === true,
    // Também só para esse botão: perguntas de entendimento e explicação dos textos em relação à matéria do parágrafo.
    perguntasEntendimento: o.perguntasEntendimento === true,
    // Seções 1 (complementares) e 2 (aplicativas) das perguntas adicionais: ligadas, a não ser que venham desmarcadas.
    perguntasComplementares: o.perguntasComplementares !== false,
    perguntasAplicativas: o.perguntasAplicativas !== false,
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

// Preferências da formatação: uma frase por caixa (partes editáveis "Opções da formatação com IA" e "Listas").
function descreverPreferencias(o, P) {
  const f = P.frases.formatacao;
  const l = P.frases.listas;
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  return [
    f[o.usarModelos ? "Modelos: marcada" : "Modelos: desmarcada"],
    estilos.length ? trocar(f["Estilos: algum marcado"], { estilos: estilos.join(", ") }) : f["Estilos: nenhum marcado"],
    f[o.maiusculas ? "Maiúsculas: marcada" : "Maiúsculas: desmarcada"],
    f[o.emoji ? "Emoji: marcada" : "Emoji: desmarcada"],
    f["Quantidade: " + o.intensidade],
    o.variarFontes ? trocar(f["Tipos de fonte: marcada"], { fontes: f["Catálogo de fontes"] }) : f["Tipos de fonte: desmarcada"],
    o.resumo ? trocar(f["Resumo: marcada"], { tamanho: f["Tamanho do resumo: " + NOME_TAMANHO[o.resumoTamanho]] }) : f["Resumo: desmarcada"],
    f[o.citacoesBiblicas ? "Citações bíblicas: marcada" : "Citações bíblicas: desmarcada"],
    o.usarListas ? trocar(l["Listas: marcada"], { modelos_de_lista: l["Catálogo de listas"] }) : l["Listas: desmarcada"],
    f[o.separarIdeias ? "Espaçamento: marcada" : "Espaçamento: desmarcada"],
  ]
    .filter(Boolean)
    .join("\n");
}

// Orientação do usuário (campo "Orientação para a IA" do pedido e instruções fixas das configurações). Vai no INÍCIO da
// mensagem, com prioridade total sobre as preferências (inclusive as opções desmarcadas). Em branco: nada é enviado.
function blocoOrientacao(opcoes, ajuste, P) {
  const f = P.frases.pedidos;
  const itens = [];
  if (ajuste) itens.push(trocar(f["Orientação: deste pedido"], { texto: ajuste }));
  if (opcoes.instrucao) itens.push(trocar(f["Orientação: instruções fixas"], { texto: opcoes.instrucao }));
  if (!itens.length) return "";
  return f["Orientação: abertura"] + "\n" + itens.map((i) => `- ${i}`).join("\n") + "\n\n";
}

// Lembrete no fim da mensagem, só quando há orientação do usuário.
function lembreteFinal(opcoes, ajuste, P) {
  return ajuste || opcoes.instrucao ? "\n\n" + P.frases.pedidos["Lembrete final"] : "";
}

const ASPAS = "\"“”„«»‘’❛❜❝❞";
const TEM_ASPAS = new RegExp(`[${ASPAS}]`);
const ASPAS_NAS_PONTAS = new RegExp(`^[\\s${ASPAS}']+|[\\s${ASPAS}']+$`, "g");

// Tira aspas e espaços das pontas do trecho, para que as aspas nunca recebam negrito/itálico.
// Regra fixa (pedida pelo usuário, permanente): a palavra "culto" nunca aparece no que a IA escreve. O prompt já proíbe
// (VOCABULARIO_FIXO em _prompts.mjs); se escapar, vira "reunião", com as palavras de antes no feminino
// ("durante o culto" -> "durante a reunião", "aos nossos cultos" -> "às nossas reuniões").
const FEMININO_ANTES_DE_REUNIAO = {
  o: "a", os: "as", do: "da", dos: "das", no: "na", nos: "nas", ao: "à", aos: "às", pelo: "pela", pelos: "pelas",
  um: "uma", uns: "umas", num: "numa", dum: "duma", este: "esta", estes: "estas", esse: "essa", esses: "essas",
  deste: "desta", desse: "dessa", neste: "nesta", nesse: "nessa", nosso: "nossa", nossos: "nossas", seu: "sua",
  seus: "suas", meu: "minha", meus: "minhas", todo: "toda", todos: "todas", próximo: "próxima", próximos: "próximas",
};
function mesmaCaixa(modelo, texto) {
  if (modelo.length > 1 && modelo === modelo.toUpperCase() && modelo !== modelo.toLowerCase()) return texto.toUpperCase();
  return modelo[0] !== modelo[0].toLowerCase() ? texto[0].toUpperCase() + texto.slice(1) : texto;
}
function semCulto(texto) {
  return texto.replace(/(^|[^\p{L}])(?:(\p{L}+)(\s+))?(?:(\p{L}+)(\s+))?(cultos?)(?!\p{L})/giu, (todo, antes, p1, e1, p2, e2, culto) => {
    const feminino = (p) => (p && FEMININO_ANTES_DE_REUNIAO[p.toLowerCase()] ? mesmaCaixa(p, FEMININO_ANTES_DE_REUNIAO[p.toLowerCase()]) : p);
    const reuniao = mesmaCaixa(culto, culto.toLowerCase() === "cultos" ? "reuniões" : "reunião");
    return antes + (p1 ? feminino(p1) + e1 : "") + (p2 ? feminino(p2) + e2 : "") + reuniao;
  });
}

function limparTrecho(trecho) {
  return typeof trecho === "string" ? semCulto(trecho.replace(/[*`]+/g, "").replace(ASPAS_NAS_PONTAS, "")) : "";
}

// Texto escrito pela IA (respostas e resumo): sem Markdown (* e `) e sem emojis no começo. As vezes ela escreve
// **negrito** ou repete o emoji dentro do texto, e como a formatação vem dos campos emoji/destaques, isso
// apareceria como asteriscos e emoji duplicado.
function limparTextoGerado(valor, max) {
  const texto = typeof valor === "string" ? semCulto(valor) : "";
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
        fonte: null,
      });
      continue;
    }

    const estilo = d.estilo && estilosPermitidos.has(d.estilo) ? d.estilo : null;
    const maiusculas = opcoes.maiusculas && d.maiusculas === true;
    let fonte = opcoes.variarFontes && FONTES.includes(d.fonte) ? d.fonte : null;
    // Regra fixa: a caixa escura é só para UMA palavra, duas no máximo (o trecho continua com os demais recursos).
    if (fonte === "squaredDark" && trecho.split(/\s+/).filter(Boolean).length > 2) fonte = null;
    if (!estilo && !maiusculas && !fonte) continue;
    resultado.push({ trecho, tipo: "geral", estilo, maiusculas, fonte });
  }
  return resultado;
}

// Preferências de formatação enviadas à IA quando ela escreve respostas do estudo.
function descreverFormatacaoResposta(o, P, sep) {
  const f = P.frases.respostas;
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  return [
    estilos.length ? trocar(f["Estilos: algum marcado"], { estilos: estilos.join(", ") }) : f["Estilos: nenhum marcado"],
    f[o.maiusculas ? "Maiúsculas: marcada" : "Maiúsculas: desmarcada"],
    f[o.emoji ? "Emoji: marcada" : "Emoji: desmarcada"],
    f["Destaques: " + o.intensidade],
    sep ? trocar(f["Espaçamento: marcada"], { unidade: sep === "frases" ? "frase" : "ideia" }) : f["Espaçamento: desmarcada"],
    f[o.citacoesBiblicas ? "Citações bíblicas: marcada" : "Citações bíblicas: desmarcada"],
  ]
    .filter(Boolean)
    .join("\n");
}

// "PREFERÊNCIAS:" das respostas do estudo: o tamanho, a formatação e os textos bíblicos.
function preferenciasDaResposta(o, P, sep) {
  return (
    "PREFERÊNCIAS:\n" +
    P.frases.respostas["Tamanho da resposta: " + NOME_TAMANHO[o.resumoTamanho]] +
    "\n" +
    descreverFormatacaoResposta(o, P, sep) +
    descreverFontes(o, P, false)
  );
}

// ---------- Fontes de consulta: Bíblia e Estudo Perspicaz ----------
// A IA só indica as referências bíblicas e os verbetes; o servidor busca o texto exato nos arquivos (_fontes.mjs, Vercel
// Blob privado) e uma chamada curta à IA, sem ferramentas, escreve a aplicação de cada versículo e a explicação do
// verbete. Nada é escrito de memória: o versículo vem sempre do arquivo.

function chaveDeBusca(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function consultaPedida(opcoes) {
  return Boolean(
    opcoes.consultarBiblia || opcoes.transcreverSemCitar || opcoes.citarTextos || opcoes.explicarTextos || opcoes.consultarPerspicaz
  );
}

// Linhas das preferências sobre as fontes. paraTexto = "Sugerir formatação" (as referências valem para o texto todo).
function descreverFontes(opcoes, P, paraTexto) {
  // Uma forma de usar os textos por vez; paraTexto = formatação (vale para o resumo), senão respostas do estudo.
  const f = P.frases.textos;
  const alvo = paraTexto ? "Resumo" : "Respostas";
  let linhaBiblia;
  if (opcoes.explicarTextos) linhaBiblia = f[`${alvo}: explicar e aplicar`];
  else if (opcoes.transcreverSemCitar) linhaBiblia = f[`${alvo}: transcrever sem citar`];
  else if (opcoes.citarTextos) linhaBiblia = f[`${alvo}: só citar`];
  else if (opcoes.consultarBiblia) linhaBiblia = f["Transcrever e citar"] + "\n" + (paraTexto ? P.instrucoes.bibliaResumo : P.instrucoes.bibliaRelevantes);
  else linhaBiblia = f["Nenhuma opção marcada"];
  const linhas = [
    linhaBiblia,
    opcoes.consultarPerspicaz ? trocar(f["Perspicaz: ativo"], { uso_do_perspicaz: P.instrucoes.perspicazUso }) : f["Perspicaz: inativo"],
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
// (textos citados na própria pergunta), relevantes (outros textos indicados pela IA), verbetes (Perspicaz) }.
// Grava item.textos = [{ referencia, texto, aplicacao }] e item.perspicaz = { volume, verbete, explicacao } | null.
//
// REGRA FIXA (pedido do usuário): todo texto bíblico citado na PERGUNTA, no meio dela ou entre parênteses no fim, é
// sempre mencionado na resposta (a IA faz isso) e sempre transcrito e explicado logo depois dela, seja qual for a opção
// marcada. As opções valem só para os demais textos:
//   transcrever (com ou sem citar na resposta): os relevantes também são transcritos e explicados;
//   só citar: os demais ficam só mencionados na resposta (nada além dos da pergunta é transcrito);
//   explicar e aplicar: os demais (até 2) entram só com a referência e a explicação, sem o versículo.
// Se algo falhar, os itens seguem sem as fontes (a resposta já está pronta).
async function completarFontes(itens, opcoes, P, orientacao) {
  for (const item of itens) {
    item.textos = [];
    item.perspicaz = null;
  }
  const modo = opcoes.explicarTextos ? "explicar" : opcoes.citarTextos ? "citar" : "transcrever";
  const transcreveOutros = opcoes.consultarBiblia || opcoes.transcreverSemCitar;
  const pedidos = itens.map((i) => {
    const daPergunta = [...new Set(i.referencias || [])];
    const outros = [...new Set(i.relevantes || [])].filter((r) => !daPergunta.includes(r));
    return {
      daPergunta,
      outros: modo === "explicar" ? outros.slice(0, 2) : modo === "transcrever" && transcreveOutros ? outros : [],
      verbetes: opcoes.consultarPerspicaz ? i.verbetes || [] : [],
    };
  });
  if (!fontesConfiguradas() || !pedidos.some((p) => p.daPergunta.length || p.outros.length || p.verbetes.length)) return;

  try {
    const achados = await Promise.all(
      pedidos.map(async (p) => {
        const daPergunta = await buscarVersiculos(p.daPergunta, 6); // os da pergunta entram sempre (até 6)
        const vistos = new Set(daPergunta.map((t) => t.referencia));
        const outros = (await buscarVersiculos(p.outros, P.limites.maxTextos)).filter((t) => !vistos.has(t.referencia));
        return {
          // semTexto: só a referência e a explicação (opção "explicar e aplicar", nunca para os da pergunta)
          textos: [...daPergunta.map((t) => ({ ...t, semTexto: false })), ...outros.map((t) => ({ ...t, semTexto: modo === "explicar" }))],
          verbete: p.verbetes.length ? await buscarVerbete(p.verbetes) : null,
        };
      })
    );
    const lista = [];
    achados.forEach((a, indice) => {
      // Os versículos transcritos já entram (texto exato); a explicação chega na etapa seguinte. Os "só explicar" só
      // entram se a explicação vier.
      itens[indice].textos = a.textos.filter((t) => !t.semTexto).map(({ semTexto, ...t }) => ({ ...t, aplicacao: "" }));
      if (!a.textos.length && !a.verbete) return;
      lista.push({
        indice,
        contexto: String(itens[indice].contexto || "").slice(0, 3000),
        explicar: true,
        textos: a.textos.map(({ semTexto, ...t }) => t),
        ...(a.verbete ? { verbete: { titulo: a.verbete.verbete, volume: a.verbete.volume, trecho: a.verbete.trecho } } : {}),
      });
    });
    if (!lista.length) return;

    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 40_000) });
    const resposta = await chamarIa(
      client,
      P,
      {
        max_tokens: 6000, // folga para o raciocínio dos modelos que não o desligam
        system: P.sistemaAplicacao,
        messages: [{ role: "user", content: (orientacao || "") + "ITENS (JSON):\n" + JSON.stringify(lista) }],
      },
      { schema: SaidaAplicacao, semPensar: true }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return;

    for (const r of resposta.parsed_output.itens) {
      const item = itens[r.indice];
      const achado = achados[r.indice];
      if (!item || !achado) continue;
      const aplicacaoDe = (t, pos) =>
        r.aplicacoes.find((x) => chaveDeBusca(x.referencia) === chaveDeBusca(t.referencia)) || r.aplicacoes[pos];
      item.textos = achado.textos
        .map((t, pos) => {
          const ap = aplicacaoDe(t, pos);
          const explicacao = ap ? limparTextoGerado(ap.aplicacao, 700) : "";
          if (t.semTexto) return explicacao ? { referencia: t.referencia, texto: "", aplicacao: explicacao } : null;
          return { referencia: t.referencia, texto: t.texto, aplicacao: explicacao };
        })
        .filter(Boolean);
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
    let trecho = typeof q === "string" ? q.trim() : "";
    // Regra fixa: o texto entre parênteses fica no fim da frase anterior; se a IA quebrou antes dele, a quebra passa
    // para depois do parêntese (ou some, se nada novo começa ali).
    if (trecho.startsWith("(") && linha.includes(trecho)) {
      const abre = linha.indexOf(trecho);
      const fecha = fimDoParentese(linha, abre);
      trecho = fecha >= 0 ? pecaDepoisDe(linha, fecha + 1) : trecho;
    }
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
    // Regra fixa: texto entre parênteses fica no fim da frase anterior. Em vez de quebrar antes dele, a quebra vem
    // depois do parêntese (se uma nova frase começar ali) e a busca continua a partir daí.
    const fecha = fimDoParentese(texto, inicio);
    if (fecha >= 0) {
      re.lastIndex = fecha + 1;
      const peca = pecaDepoisDe(texto, fecha + 1);
      if (peca) resultado.push(peca);
      continue;
    }
    const peca = pecaEm(texto, inicio);
    if (peca) resultado.push(peca);
  }
  return resultado;
}

// Trecho do texto que começa exatamente em "inicio" (o app localiza a quebra pelo trecho, então ele precisa ser único
// nessa posição); "" se não der para identificar.
function pecaEm(texto, inicio) {
  for (const tamanho of [60, 120, 240]) {
    const peca = texto.slice(inicio, inicio + tamanho).trim();
    if (peca.length >= 2 && texto.indexOf(peca) === inicio) return peca;
  }
  return "";
}

// Posição do ")" que fecha o parêntese aberto em "abre" (-1 se não houver um parêntese curto ali).
function fimDoParentese(texto, abre) {
  if (texto[abre] !== "(") return -1;
  const fecha = texto.indexOf(")", abre);
  return fecha > abre && fecha - abre <= 250 ? fecha : -1;
}

// Início da frase que vem depois de um parêntese (a partir de "desde", logo depois do ")"): só vale se houver um espaço
// e uma nova frase (letra maiúscula); "" se o parêntese termina a linha, é seguido de pontuação ou de texto que continua.
function pecaDepoisDe(texto, desde) {
  const espacos = texto.slice(desde).match(/^\s+/);
  if (!espacos) return "";
  const inicio = desde + espacos[0].length;
  return /^["“‘¿¡]?[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/u.test(texto.slice(inicio, inicio + 2)) ? pecaEm(texto, inicio) : "";
}

function ehModeloDePergunta(modelo) {
  return Boolean(modelo) && /perguntas?|[❓❔]/iu.test(`${modelo.nome} ${modelo.conteudo}`);
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
async function conversar(client, P, { system, mensagens, tools, maxTokens, voltas }) {
  let resposta;
  const blocos = [];
  const inicio = Date.now();
  const uso = { modelo: P.ia.modelo, voltas: 0, entrada: 0, saida: 0 };
  for (let volta = 0; volta < voltas; volta++) {
    resposta = await chamarIa(client, P, { max_tokens: maxTokens, system, messages: mensagens, tools });
    uso.voltas++;
    uso.entrada += resposta.usage?.input_tokens || 0;
    uso.saida += resposta.usage?.output_tokens || 0;
    blocos.push(...resposta.content);
    if (resposta.stop_reason !== "pause_turn") break;
    mensagens = [...mensagens, { role: "assistant", content: resposta.content }];
  }
  // Para o registro: quanto tempo levou, quantos tokens e quais páginas a IA leu (diagnóstico de lentidão).
  uso.segundos = Math.round((Date.now() - inicio) / 100) / 10;
  uso.leituras = blocos.filter((b) => b.type === "server_tool_use").map((b) => String(b.input?.url || "?").replace(/^https?:\/\/wol\.jw\.org/, ""));
  uso.pensou = blocos.some((b) => b.type === "thinking" || b.type === "redacted_thinking");
  return { resposta, blocos, uso };
}

const Destaque = z.object({
  trecho: z.coerce.string().catch(""),
  tipo: z.enum(TIPOS).catch("geral"),
  estilo: z.enum(ESTILOS).nullable().optional().catch(null),
  maiusculas: z.boolean().optional().catch(false),
  fonte: z.enum(FONTES).nullable().optional().catch(null),
});

// Item de resposta lido de JSON em texto (leitura do site); os campos extras são tolerantes.
const ItemResposta = z.object({
  paragrafos: z.coerce.string(),
  resposta: z.coerce.string(),
  quebras: z.array(z.string()).optional().catch([]),
  emoji: z.string().nullable().optional().catch(null),
  destaques: z.array(Destaque).optional().catch([]),
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

// Escreve as respostas do estudo a partir de um texto com as perguntas e os parágrafos: o colado pelo usuário
// (Opção 2) ou o lido pelo servidor no wol.jw.org (Opção 1). A IA pensa antes de responder (o texto é curto).
// Devolve { itens, uso } ou null se a IA não conseguiu gerar as respostas.
async function escreverRespostas({ rotulo, texto, escopo, opcoes, modo, ajuste, anteriores, sep, P }) {
  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    (escopo ? `\n\n${escopo}` : "") +
    `\n\n${rotulo}:\n` +
    texto +
    lembreteFinal(opcoes, ajuste, P);

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      "\n\n" +
      P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  const permitidos = estilosDe(opcoes);
  const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
  const inicio = Date.now();
  const resposta = await chamarIa(
    client,
    P,
    { max_tokens: 12000 /* o raciocínio também conta aqui */, system: P.sistemaSentinela, messages: [{ role: "user", content: mensagem }] },
    { schema: SaidaSentinela }
  );
  const uso = {
    modelo: P.ia.modelo,
    segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
    entrada: resposta.usage?.input_tokens || 0,
    saida: resposta.usage?.output_tokens || 0,
    pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
    parada: resposta.stop_reason,
  };
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return { itens: null, uso };

  const itens = resposta.parsed_output.itens
    .slice(0, P.limites.maxRespostas)
    .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
    .filter((i) => i.resposta);
  return { itens, uso };
}

async function responderSentinela(res, { linhas, opcoes, modo, ajuste, anteriores }, P) {
  const sep = modoSeparacao(opcoes, ajuste);
  // A consulta às fontes não exige o código de pesquisa (o código vale só para a leitura do wol.jw.org).
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  // Os versículos citados na pergunta são sempre transcritos: a Bíblia começa a carregar enquanto a IA escreve.
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });

  try {
    const { itens, uso } = await escreverRespostas({ rotulo: "TEXTO COLADO", texto: linhas.join("\n"), opcoes, modo, ajuste, anteriores, sep, P });
    console.log("Texto colado:", JSON.stringify(uso));
    if (!itens) return erro(res, 502, "A IA não conseguiu gerar as respostas para este texto.");
    return res.status(200).json({ itens: await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P)) });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// Estudo lido pelo servidor no wol.jw.org: a IA recebe só as perguntas e os parágrafos pedidos (ou, na recapitulação,
// o artigo inteiro sem as perguntas dos parágrafos e as perguntas do quadro final).
async function responderEstudoLido(res, { lido, alvo, recapitulacao, opcoes, ajuste, sep, modo, anteriores, P, inicioPedido }) {
  const leitura = Math.round((Date.now() - inicioPedido) / 100) / 10;
  let texto;
  let escopo = "";
  if (recapitulacao) {
    if (!lido.recapitulacao.length) return erro(res, 400, "Não encontrei o quadro de recapitulação neste artigo.");
    texto = textoDaRecapitulacao(lido);
    escopo = P.frases.pedidos["Escopo: recapitulação"];
  } else {
    const grupos = lido.grupos.filter((g) => g.numeros.some((n) => alvo.has(n)));
    if (!grupos.length) {
      const ultimo = Math.max(...lido.grupos.flatMap((g) => g.numeros));
      return erro(res, 400, `Não encontrei esse(s) parágrafo(s) no artigo "${lido.titulo}": ele vai do parágrafo 1 ao ${ultimo}.`);
    }
    texto = textoDosGrupos(grupos);
  }

  try {
    const { itens: gerados, uso } = await escreverRespostas({ rotulo: "TEXTO DO ESTUDO", texto, escopo, opcoes, modo, ajuste, anteriores, sep, P });
    if (!gerados) return erro(res, 502, "A IA não conseguiu gerar as respostas para este estudo.");

    // Recapitulação: as perguntas do quadro vêm numeradas 1, 2, 3...; o rótulo "Recap. N" não se confunde com parágrafos.
    if (recapitulacao) {
      gerados.forEach((i, pos) => {
        const numero = (i.paragrafos.match(/\d+/) || [String(pos + 1)])[0];
        i.paragrafos = "Recap. " + numero;
        i.referencias = [...new Set([...(lido.referenciasRecapitulacao?.[Number(numero) - 1] || []), ...i.referencias])];
      });
    } else {
      // Regra fixa: os textos citados na pergunta são sempre transcritos. A página marca cada um como link, então eles
      // entram mesmo que a IA esqueça de indicá-los.
      gerados.forEach((i) => {
        const numeros = numerosDosParagrafos(i.paragrafos);
        const daPergunta = lido.grupos.filter((g) => g.numeros.some((n) => numeros.has(n))).flatMap((g) => g.referencias || []);
        i.referencias = [...new Set([...daPergunta, ...i.referencias])];
      });
    }
    // Mesmo que a IA responda a mais, só ficam os parágrafos pedidos.
    const itens = alvo
      ? gerados.filter((i) => {
          const rotulos = numerosDosParagrafos(i.paragrafos);
          return rotulos.size ? [...rotulos].some((n) => alvo.has(n)) : gerados.length === 1;
        })
      : gerados;
    console.log("Estudo (lido no site):", JSON.stringify({ pedidos: alvo ? [...alvo] : "recapitulacao", recebidos: itens.map((i) => i.paragrafos), caracteres: texto.length, leitura, ...uso }));

    const inicioFontes = Date.now();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Estudo (tempo):", JSON.stringify({ fontes: Math.round((Date.now() - inicioFontes) / 100) / 10, total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));

    return res.status(200).json({
      titulo: lido.titulo || null,
      erro: itens.length ? null : "A IA não respondeu ao(s) parágrafo(s) pedido(s). Tente de novo.",
      url: lido.url,
      itens: itensFinais,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo da semana: leitura do artigo no wol.jw.org ----------
// A cada clique de quem tem o código de pesquisa, o servidor lê o artigo direto no wol.jw.org (api/_wol.mjs) e manda à
// IA só as perguntas e os parágrafos pedidos. Se essa leitura falhar, a IA lê o site com a ferramenta web_fetch da
// Anthropic (só no domínio wol.jw.org), como antes. O texto do artigo não é gravado nem devolvido ao navegador: só as
// respostas, com palavras próprias, e o título do artigo lido.

// Um item com defeito vira null e é descartado (as outras respostas continuam valendo).
const SaidaEstudo = z.object({
  titulo: z.string().nullable().optional().catch(null),
  erro: z.string().nullable().optional().catch(null),
  itens: z.array(ItemResposta.nullable().catch(null)).catch([]),
});

function codigoValido(informado) {
  return textosIguais(informado, process.env.CODIGO_ESTUDO);
}

// O código do dirigente vale sozinho para as tarefas do dirigente (perguntas adicionais, Estudo Bíblico do dirigente) e,
// junto com o código de pesquisa, para as que os dois cartões usam (lista de parágrafos e leitura do capítulo).
function dirigenteValido(informado) {
  return textosIguais(informado, codigoDoDirigente());
}

// Recusa com a mensagem do código que a pessoa estava usando: o do dirigente, se ele veio no pedido; senão o de pesquisa.
function recusarAcesso(res, body) {
  if (typeof body.codigoDirigente === "string" && body.codigoDirigente) {
    return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  }
  return erro(res, 403, "Código de pesquisa inválido.");
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
    return salvarJsonCortado(texto.slice(inicio));
  }
}

// Quando a resposta da IA é cortada no meio da lista "itens", fecha a lista depois do último item completo.
function salvarJsonCortado(texto) {
  const lista = texto.indexOf('"itens"');
  if (lista < 0) return null;
  let fim = texto.length;
  for (let tentativas = 0; tentativas < 60; tentativas++) {
    fim = texto.lastIndexOf("}", fim - 1);
    if (fim <= lista) return null;
    try {
      return JSON.parse(texto.slice(0, fim + 1) + "]}");
    } catch {
      /* tenta o "}" anterior */
    }
  }
  return null;
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
  if (!codigoValido(body.codigo)) return erro(res, 403, "Código de pesquisa inválido.");

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  const pedido = String(body.paragrafos || "").trim();
  // "recapitulação", "Recapitulacao", "perguntas de recapitulação" ou só "recap": o quadro final do artigo.
  const recapitulacao = /^(perguntas de )?recap/.test(pedido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  // Não existe mais "todos": é preciso dizer os parágrafos (até o máximo configurado) ou pedir a recapitulação.
  const alvo = recapitulacao || !/^[\d\s,\-–]{1,120}$/.test(pedido) ? null : numerosDosParagrafos(pedido);
  if (!recapitulacao && !(alvo && alvo.size)) return erro(res, 400, "Informe os parágrafos (ex.: 3, 1-4 ou recapitulação).");
  const maxParagrafos = P.limites.maxParagrafosEstudo;
  if (alvo && alvo.size > maxParagrafos)
    return erro(res, 400, `O máximo permitido é de ${maxParagrafos} ${maxParagrafos === 1 ? "parágrafo" : "parágrafos"} por consulta. Peça menos parágrafos de cada vez.`);
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores =
    modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 8000) : "";

  // Primeiro o servidor tenta ler o artigo direto no wol.jw.org (rápido); se não der, a IA lê o site com web_fetch.
  const inicioPedido = Date.now();
  let lido = null;
  try {
    lido = await lerEstudoDireto(url);
  } catch (e) {
    console.error("Estudo: leitura direta falhou", e?.name, e?.message);
  }
  if (lido) return responderEstudoLido(res, { lido, alvo, recapitulacao, opcoes, ajuste, sep, modo, anteriores, P, inicioPedido });

  const escopoDosParagrafos = (numeros) => trocar(P.frases.pedidos["Escopo: parágrafos (leitura pela IA)"], { numeros: numeros.join(", ") }) + "\n";
  const montarMensagem = (escopo) =>
    blocoOrientacao(opcoes, ajuste, P) + `ENDEREÇO: ${url}\n` + escopo + preferenciasDaResposta(opcoes, P, sep) + lembreteFinal(opcoes, ajuste, P);

  let mensagem = montarMensagem(alvo ? escopoDosParagrafos([...alvo]) : P.frases.pedidos["Escopo: recapitulação (leitura pela IA)"] + "\n");

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      "\n\n" +
      P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
  const tools = [
    { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
  ];
  // Uma leitura do artigo com a mensagem dada; devolve a resposta da IA, o texto e o JSON conferido.
  const consultar = async (conteudo) => {
    const { resposta, uso } = await conversar(client, P, {
      system: P.sistemaEstudo,
      mensagens: [{ role: "user", content: conteudo }],
      tools,
      maxTokens: 16000, // folga para muitos parágrafos (e para o raciocínio, se for religado com CLAUDE_RACIOCINIO=on)
      voltas: 5,
    });
    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");
    return { resposta, uso, texto, dados: SaidaEstudo.safeParse(extrairJson(texto)) };
  };

  try {
    const { resposta, uso, texto, dados } = await consultar(mensagem);

    if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu responder a este pedido.");
    if (!dados.success || (!dados.data.itens.some(Boolean) && !dados.data.erro)) {
      console.error("Estudo: formato inesperado", JSON.stringify({ parada: resposta.stop_reason, tamanho: texto.length, inicio: texto.slice(0, 200), fim: texto.slice(-200) }));
      return erro(
        res,
        502,
        resposta.stop_reason === "max_tokens"
          ? "A resposta ficou longa demais. Tente pedir menos parágrafos de cada vez."
          : "A IA não devolveu as respostas no formato esperado. Tente novamente."
      );
    }
    dados.data.itens = dados.data.itens.filter(Boolean);

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
    const doEscopo = (lista) =>
      alvo
        ? lista.filter((i) => {
            const rotulos = numerosDosParagrafos(i.paragrafos);
            return rotulos.size ? [...rotulos].some((n) => alvo.has(n)) : lista.length === 1;
          })
        : lista;
    const itens = doEscopo(itensTodos);

    // Faltou algum parágrafo pedido (a IA pulou ou a resposta foi cortada)? Pede de novo só os que faltaram.
    const cobertos = new Set(itens.flatMap((i) => [...numerosDosParagrafos(i.paragrafos)]));
    const faltando = alvo && !recapitulacao && !modo ? [...alvo].filter((n) => !cobertos.has(n)) : [];
    console.log("Estudo (a IA leu o site):", JSON.stringify({ pedidos: alvo ? [...alvo] : "recapitulacao", recebidos: itens.map((i) => i.paragrafos), faltando, parada: resposta.stop_reason, ...uso }));
    if (faltando.length && itens.length) {
      try {
        const segunda = await consultar(
          montarMensagem(
            escopoDosParagrafos(faltando) +
              `Já foram respondidos os parágrafos ${[...cobertos].join(", ")}: não os repita. Se um parágrafo pedido compartilha a pergunta com um deles, devolva "itens" vazio.\n`
          )
        );
        if (segunda.dados.success) {
          const extras = doEscopo(
            segunda.dados.data.itens
              .filter(Boolean)
              .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
              .filter((i) => i.resposta && ![...numerosDosParagrafos(i.paragrafos)].every((n) => cobertos.has(n)))
          );
          itens.push(...extras);
          const primeiro = (i) => Math.min(...numerosDosParagrafos(i.paragrafos), 999);
          itens.sort((a, b) => primeiro(a) - primeiro(b));
          console.log("Estudo (complemento):", JSON.stringify({ faltando, recebidos: extras.map((i) => i.paragrafos), ...segunda.uso }));
        }
      } catch (e) {
        console.error("Estudo: complemento falhou", e?.status, e?.message);
      }
    }

    const inicioFontes = Date.now();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Estudo (tempo):", JSON.stringify({ fontes: Math.round((Date.now() - inicioFontes) / 100) / 10, total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));

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

// ---------- Perguntas adicionais para o dirigente ----------
// Três seções por pergunta impressa: 1 ou 2 complementares (pontos do parágrafo que a pergunta impressa não cobre),
// 1 ou 2 aplicativas (aplicação prática do ponto principal) e, com as opções marcadas, a explicação dos textos bíblicos.
// O servidor lê o artigo no wol.jw.org e manda à IA só os parágrafos pedidos; ela pensa antes de sugerir (texto curto).

const SaidaPerguntas = z.object({
  itens: z.array(
    z.object({
      paragrafos: z.string(),
      complementares: z.array(z.string()),
      aplicativas: z.array(z.string()),
      perguntasTextos: z.array(z.object({ referencia: z.string(), pergunta: z.string() })),
      perguntasEntendimento: z.array(z.object({ referencia: z.string(), perguntas: z.array(z.string()) })),
    })
  ),
});

async function sugerirPerguntas(res, body, P) {
  if (!codigoDoDirigente()) return erro(res, 500, "O código do dirigente ainda não está configurado no servidor.");
  // As perguntas adicionais para o dirigente pedem só o código do dirigente.
  if (!dirigenteValido(body.codigoDirigente)) return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  const pedido = String(body.paragrafos || "").trim();
  if (/^(perguntas de )?recap/.test(pedido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) {
    return erro(res, 400, "As perguntas adicionais são para os parágrafos: escolha um ou mais (ex.: 3 ou 1-4).");
  }
  const alvo = /^[\d\s,\-–]{1,120}$/.test(pedido) ? numerosDosParagrafos(pedido) : null;
  if (!alvo || !alvo.size) return erro(res, 400, "Informe os parágrafos (ex.: 3 ou 1-4).");
  const maxParagrafos = P.limites.maxParagrafosEstudo;
  if (alvo.size > maxParagrafos)
    return erro(res, 400, `O máximo permitido é de ${maxParagrafos} ${maxParagrafos === 1 ? "parágrafo" : "parágrafos"} por consulta. Peça menos parágrafos de cada vez.`);

  const opcoes = validarOpcoes(body.opcoes);
  if (!opcoes.perguntasComplementares && !opcoes.perguntasAplicativas && !opcoes.perguntasTextos && !opcoes.perguntasEntendimento)
    return erro(res, 400, "Marque pelo menos uma seção das perguntas.");
  const ajuste = textoLivre(body.ajuste);
  const inicio = Date.now();
  let lido = null;
  try {
    lido = await lerEstudoDireto(url);
  } catch (e) {
    console.error("Perguntas: leitura direta falhou", e?.name, e?.message);
  }
  if (!lido) return erro(res, 502, "Não consegui ler o artigo no wol.jw.org agora. Tente de novo em instantes.");

  const grupos = lido.grupos.filter((g) => g.numeros.some((n) => alvo.has(n)));
  if (!grupos.length) {
    const ultimo = Math.max(...lido.grupos.flatMap((g) => g.numeros));
    return erro(res, 400, `Não encontrei esse(s) parágrafo(s) no artigo "${lido.titulo}": ele vai do parágrafo 1 ao ${ultimo}.`);
  }
  const texto = textoDosGrupos(grupos);
  const mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    "PEDIDO (seções ligadas pelo usuário):\n" +
    `- Seção 1, perguntas complementares ("complementares"): ${opcoes.perguntasComplementares ? "ATIVA" : "INATIVA"}\n` +
    `- Seção 2, perguntas aplicativas ("aplicativas"): ${opcoes.perguntasAplicativas ? "ATIVA" : "INATIVA"}\n` +
    `- Seção 3, perguntas sobre os textos bíblicos ("perguntasTextos"): ${opcoes.perguntasTextos ? "ATIVAS" : "INATIVAS"}\n` +
    `- Seção 3, perguntas de entendimento dos textos bíblicos ("perguntasEntendimento"): ${opcoes.perguntasEntendimento ? "ATIVAS" : "INATIVAS"}\n` +
    "\nTEXTO DO ESTUDO:\n" +
    texto +
    lembreteFinal(opcoes, ajuste, P);

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 8000 /* o raciocínio também conta aqui */, system: P.sistemaPerguntas, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaPerguntas }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu sugerir perguntas para este parágrafo.");
    }

    const primeiro = (i) => Math.min(...numerosDosParagrafos(i.paragrafos), 999);
    const itens = resposta.parsed_output.itens
      .map((i) => ({
        paragrafos: limparLinha(i.paragrafos, 20),
        complementares: opcoes.perguntasComplementares
          ? i.complementares.map((q) => limparTextoGerado(q, 400)).filter(Boolean).slice(0, 2)
          : [],
        aplicativas: opcoes.perguntasAplicativas ? i.aplicativas.map((q) => limparTextoGerado(q, 400)).filter(Boolean).slice(0, 2) : [],
        perguntasTextos: opcoes.perguntasTextos
          ? i.perguntasTextos
              .map((t) => ({ referencia: limparLinha(t.referencia, 80), pergunta: limparTextoGerado(t.pergunta, 400) }))
              .filter((t) => t.referencia && t.pergunta)
              .slice(0, 2)
          : [],
        perguntasEntendimento: opcoes.perguntasEntendimento
          ? i.perguntasEntendimento
              .map((t) => ({
                referencia: limparLinha(t.referencia, 80),
                perguntas: t.perguntas.map((q) => limparTextoGerado(q, 400)).filter(Boolean).slice(0, 2),
              }))
              .filter((t) => t.referencia && t.perguntas.length)
              .slice(0, 2)
          : [],
      }))
      .filter(
        (i) =>
          (i.complementares.length || i.aplicativas.length || i.perguntasTextos.length || i.perguntasEntendimento.length) &&
          [...numerosDosParagrafos(i.paragrafos)].some((n) => alvo.has(n))
      )
      .sort((a, b) => primeiro(a) - primeiro(b));

    console.log(
      "Perguntas adicionais:",
      JSON.stringify({
        modelo: P.ia.modelo,
        pedidos: [...alvo],
        recebidos: itens.map((i) => i.paragrafos),
        complementares: opcoes.perguntasComplementares,
        aplicativas: opcoes.perguntasAplicativas,
        sobreTextos: opcoes.perguntasTextos,
        entendimento: opcoes.perguntasEntendimento,
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      titulo: lido.titulo || null,
      erro: itens.length ? null : "A IA não sugeriu perguntas para esse(s) parágrafo(s). Tente de novo.",
      itens,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo Bíblico de Congregação ----------
// O servidor lê o capítulo da semana no wol.jw.org (página de reuniões -> apostila Vida e Ministério -> link do item
// "Estudo bíblico de congregação"), com os trechos das publicações citadas nas perguntas (api/_wol.mjs). A IA responde
// às perguntas dos quadros marcados no mesmo estilo das respostas do estudo de A Sentinela (tamanho, formatação, textos
// bíblicos). O texto do capítulo não é devolvido ao navegador: só as respostas, o título e a lista das perguntas.

const SaidaEbc = z.object({
  itens: z.array(
    z.object({
      pergunta: z.string(),
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
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
});

// Lê o capítulo da semana pedida; devolve o capítulo ou responde com o erro (e devolve null).
// autorizado = o chamador já conferiu o código (o do dirigente, nas tarefas dele); senão vale o código de pesquisa.
async function capituloEbc(res, body, autorizado = false) {
  if (!autorizado && !process.env.CODIGO_ESTUDO) {
    erro(res, 500, "A leitura do estudo ainda não está configurada no servidor.");
    return null;
  }
  if (!autorizado && !codigoValido(body.codigo)) {
    erro(res, 403, "Código de pesquisa inválido.");
    return null;
  }
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let capitulo = null;
  try {
    capitulo = await lerEstudoBiblico(url);
  } catch (e) {
    console.error("Estudo bíblico: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler o Estudo Bíblico de Congregação no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!capitulo) erro(res, 404, "Não encontrei o Estudo Bíblico de Congregação na apostila dessa semana.");
  return capitulo;
}

// O que o app mostra ao carregar: a matéria, o título e quantas perguntas há em cada quadro.
async function lerEbc(res, body) {
  // O cartão dos comentários lê com o código de pesquisa; o do dirigente, com o do dirigente.
  const autorizado = codigoValido(body.codigo) || dirigenteValido(body.codigoDirigente);
  if (!autorizado) return recusarAcesso(res, body);
  const capitulo = await capituloEbc(res, body, true);
  if (!capitulo) return;
  return res.status(200).json({
    materia: capitulo.materia,
    titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
    url: capitulo.url,
    quadros: QUADROS_EBC.map((q) => ({ id: q.id, nome: q.nome, perguntas: capitulo.perguntas.filter((p) => p.quadro === q.id).length })),
    trechos: capitulo.trechos.length,
  });
}

async function responderEbc(res, body, P) {
  const quadros = new Set((Array.isArray(body.quadros) ? body.quadros : []).filter((q) => QUADROS_EBC.some((x) => x.id === q)));
  if (!quadros.size) return erro(res, 400, "Marque pelo menos um quadro de perguntas.");
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  // Os versículos de "Leia o relato na Bíblia" e os citados nas perguntas vão junto: a Bíblia começa a carregar já.
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  const inicioPedido = Date.now();

  const capitulo = await capituloEbc(res, body);
  if (!capitulo) return;
  const perguntas = capitulo.perguntas.filter((p) => quadros.has(p.quadro));
  if (!perguntas.length) return erro(res, 400, "Os quadros marcados não têm perguntas neste capítulo.");

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...capitulo.leia, ...perguntas.flatMap((p) => p.referencias)], 12);
    } catch (e) {
      console.error("Estudo bíblico: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    "\n\n" +
    textoDoCapituloEbc(capitulo, perguntas, versiculos) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nRESPOSTAS ANTERIORES (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaEbc, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaEbc }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu gerar as respostas para este estudo.");
    }

    // Só as perguntas pedidas, uma vez cada, na ordem do capítulo. Diferente do estudo de A Sentinela, os textos citados
    // na pergunta não têm regra fixa (pedido do usuário): entram como os demais textos relevantes, que seguem as opções
    // de textos bíblicos marcadas (transcrever, só citar, explicar ou nenhuma).
    const permitidos = estilosDe(opcoes);
    const porId = new Map();
    for (const i of resposta.parsed_output.itens) {
      const id = limparLinha(String(i.pergunta).replace(/[[\]]/g, ""), 30);
      const pergunta = perguntas.find((p) => p.id.toLowerCase() === id.toLowerCase());
      if (!pergunta || porId.has(pergunta.id)) continue;
      const relevantes = [...new Set([...pergunta.referencias, ...(i.textosRelevantes || [])])];
      const item = montarItem({ ...i, paragrafos: pergunta.id, referencias: [], textosRelevantes: relevantes }, opcoes, permitidos, P.limites, sep);
      if (!item.resposta) continue;
      porId.set(pergunta.id, item);
    }
    const itens = perguntas.map((p) => porId.get(p.id)).filter(Boolean);

    console.log(
      "Estudo bíblico:",
      JSON.stringify({
        modelo: P.ia.modelo,
        materia: capitulo.materia,
        pedidas: perguntas.map((p) => p.id),
        respondidas: itens.map((i) => i.paragrafos),
        citadas: capitulo.citadas, // publicações citadas nas perguntas; "trechos" = quantas delas o servidor conseguiu ler
        trechos: capitulo.trechos.length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Estudo bíblico (tempo):", JSON.stringify({ total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));
    return res.status(200).json({
      materia: capitulo.materia,
      titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
      url: capitulo.url,
      erro: itens.length ? null : "A IA não respondeu às perguntas. Tente de novo.",
      itens: itensFinais,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo Bíblico de Congregação: perguntas adicionais para o dirigente ----------
// A IA recebe o capítulo da semana (relato, "Leia o relato na Bíblia", trechos das publicações) e as perguntas ORIGINAIS dos
// quatro quadros, e elabora 5 perguntas adicionais com resposta (sem aplicações práticas), mais o resumo dos textos-base se
// o usuário marcou. Só quem tem o código do dirigente.

const SaidaEbcDirigente = z.object({
  perguntas: z.array(z.object({ pergunta: z.string(), resposta: z.string() })),
  textosBase: z.array(z.object({ referencia: z.string(), ponto: z.string() })),
});

// Para comparar perguntas: sem acentos, sem pontuação e sem o que vem entre parênteses (as perguntas originais trazem a
// citação da publicação no fim, ex.: "(w09 1/12 17 § 4, nota)").
const normalizarPergunta = (t) =>
  String(t || "")
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Uma é cópia da outra (igual ou uma contida na outra, quando já têm um tamanho que indique a mesma pergunta).
const mesmaPergunta = (a, b) => Boolean(a && b && (a === b || (Math.min(a.length, b.length) >= 25 && (a.includes(b) || b.includes(a)))));

async function perguntasEbcDirigente(res, body, P) {
  if (!codigoDoDirigente()) return erro(res, 500, "O código do dirigente ainda não está configurado no servidor.");
  if (!dirigenteValido(body.codigoDirigente)) return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  const textosBase = body.textosBase === true;
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const capitulo = await capituloEbc(res, body, true);
  if (!capitulo) return;

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...capitulo.leia, ...capitulo.perguntas.flatMap((p) => p.referencias)], 12);
    } catch (e) {
      console.error("Estudo bíblico (dirigente): versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore 5 perguntas adicionais com resposta; resumo dos textos-base ${textosBase ? "ATIVO" : "INATIVO"}.\n\n` +
    textoDoCapituloEbcDirigente(capitulo, versiculos) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem +=
      "\n\nPERGUNTAS JÁ SUGERIDAS (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Estudo Bíblico do dirigente: outras perguntas" : "Estudo Bíblico do dirigente: melhorar"];
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaEbcDirigente, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaEbcDirigente }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar as perguntas para este capítulo.");
    }

    // No máximo 5, só as que têm pergunta e resposta e que não são cópia de uma pergunta original do capítulo.
    const originais = capitulo.perguntas.map((p) => normalizarPergunta(p.pergunta));
    const vistas = [];
    const perguntas = [];
    for (const i of resposta.parsed_output.perguntas) {
      const pergunta = limparTextoGerado(i.pergunta, 400);
      const respostaTexto = limparTextoGerado(i.resposta, 900);
      const chave = normalizarPergunta(pergunta);
      if (!pergunta || !respostaTexto || originais.some((o) => mesmaPergunta(o, chave)) || vistas.some((v) => mesmaPergunta(v, chave))) continue;
      vistas.push(chave);
      perguntas.push({ pergunta, resposta: respostaTexto });
      if (perguntas.length === 5) break;
    }
    const base = textosBase
      ? resposta.parsed_output.textosBase
          .map((t) => ({ referencia: limparLinha(limparTrecho(t.referencia), 80), ponto: limparTextoGerado(t.ponto, 400) }))
          .filter((t) => t.referencia && t.ponto)
          .slice(0, 3)
      : [];

    console.log(
      "Estudo bíblico (dirigente):",
      JSON.stringify({
        modelo: P.ia.modelo,
        materia: capitulo.materia,
        perguntas: perguntas.length,
        recebidas: resposta.parsed_output.perguntas.length,
        textosBase: base.length,
        originais: capitulo.perguntas.length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      materia: capitulo.materia,
      titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
      url: capitulo.url,
      erro: perguntas.length ? null : "A IA não elaborou perguntas diferentes das originais. Tente de novo.",
      perguntas,
      textosBase: base,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Tesouros da Palavra de Deus: esboço do discurso de 10 minutos ----------
// O servidor lê o discurso da semana na apostila (o tema, os pontos com os textos bíblicos, a pergunta de reflexão e os trechos
// das fontes citadas; api/_wol.mjs) e a IA elabora o esboço seguindo o prompt editável "tesouros". Só com o código do dirigente.

// Partes comuns aos esboços (Tesouros e discurso curto). Regras do usuário para TODOS os esboços: só entra o que o orador pode
// dizer à assistência (ou um lembrete do que ele precisa dizer ou fazer); a introdução e a conclusão têm subtítulo próprio, criado
// pela IA; e cada texto lido (LEIA) vem com a íntegra, que o servidor tira da Bíblia (a IA só indica onde a leitura entra).
const parteDoEsboco = () => z.object({ titulo: z.string(), minutos: z.number(), topicos: z.array(z.string()) });
const pontoDoEsboco = () =>
  z.object({
    titulo: z.string(),
    minutos: z.number(),
    desenvolvimento: z.array(z.object({ argumento: z.string(), leia: z.string().nullable(), ideias: z.array(z.string()) })),
    aplicacao: z.string(),
    ilustracao: z.string().nullable(),
    transicao: z.string().nullable(),
  });
const corpoDoEsboco = () => ({
  tema: z.string(),
  objetivo: z.string(),
  aplicacao: z.string(),
  introducao: parteDoEsboco(),
  pontos: z.array(pontoDoEsboco()),
  conclusao: parteDoEsboco(),
});

const SaidaTesouros = z.object(corpoDoEsboco());

// Rótulos que a IA às vezes escreve no começo de um tópico ("Tema: ...", "Primeiras frases: ..."): o esboço só leva o que o orador
// diz, então o rótulo cai e fica a frase.
const ROTULO_DE_TOPICO =
  /^(?:primeiras?\s+frases?|frases?\s+de\s+abertura|tema(?:\s+principal)?|objetivo|aplica[cç][aã]o(?:\s+pr[aá]tica)?|ilustra[cç][aã]o|transi[cç][aã]o|introdu[cç][aã]o|conclus[aã]o|recapitula[cç][aã]o)(?:\s*[:：]\s*|\s+[–—-]\s+)/iu;

function semRotuloDeTopico(texto) {
  const limpo = texto.replace(ROTULO_DE_TOPICO, "").trim();
  return limpo === texto ? texto : limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

// O texto exato de uma leitura, tirado da Bíblia (Tradução do Novo Mundo). Sem a Bíblia no servidor (ou se a referência não for
// achada), fica só a referência e o orador lê na própria Bíblia.
async function leituraDaBiblia(referencia) {
  if (fontesConfiguradas()) {
    try {
      const [achado] = await buscarVersiculos([referencia], 1);
      if (achado) return { referencia: achado.referencia, texto: achado.texto };
    } catch (e) {
      console.error("Esboço: versículo indisponível", e?.message);
    }
  }
  return { referencia, texto: null };
}

// Cada "leia" da IA vira { referencia, texto }. Um texto nunca é lido duas vezes; o total respeita o máximo; e, como o usuário
// pediu, o discurso fica com as leituras mínimas (completadas com os textos da apostila, no primeiro argumento do ponto que
// ainda não tem leitura) e, quando for o caso, com ao menos uma leitura em cada ponto.
async function conferirLeituras(pontos, { max = Infinity, minimo = 0, cadaPonto = false, indicadas = () => [], todas = [] }) {
  const lidas = new Set();
  let total = 0;
  for (const ponto of pontos) {
    for (const d of ponto.desenvolvimento) {
      if (!d.leia) continue;
      if (total >= max) {
        d.leia = null;
        continue;
      }
      const leitura = await leituraDaBiblia(d.leia);
      if (lidas.has(leitura.referencia)) {
        d.leia = null;
        continue;
      }
      lidas.add(leitura.referencia);
      total++;
      d.leia = leitura;
    }
  }
  const anexar = async (ponto, referencia) => {
    const argumento = ponto.desenvolvimento.find((d) => !d.leia);
    if (!argumento || total >= max) return false;
    const leitura = await leituraDaBiblia(referencia);
    if (lidas.has(leitura.referencia)) return false;
    lidas.add(leitura.referencia);
    total++;
    argumento.leia = leitura;
    return true;
  };
  if (cadaPonto) {
    for (const ponto of pontos) {
      if (ponto.desenvolvimento.some((d) => d.leia)) continue;
      for (const referencia of [...indicadas(ponto.indice), ...todas]) if (await anexar(ponto, referencia)) break;
    }
  }
  for (const ponto of pontos) {
    for (const referencia of indicadas(ponto.indice)) {
      if (total >= minimo) return;
      await anexar(ponto, referencia);
    }
  }
}

// A parte do esboço que os dois discursos têm em comum, limpa e dentro dos limites (tema, objetivo, introdução com subtítulo,
// pontos com argumentos, leituras, aplicação, ilustração e transição, e conclusão com subtítulo).
async function corpoDoEsbocoLimpo(saida, o) {
  const topicos = (lista, max, tamanho) =>
    (Array.isArray(lista) ? lista : []).map((x) => semRotuloDeTopico(limparTextoGerado(x, tamanho))).filter(Boolean).slice(0, max);
  const minutos = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(o.minutosMax, Math.round(n))) : 0);
  const pontos = (Array.isArray(saida.pontos) ? saida.pontos : [])
    .slice(0, o.maxPontos)
    .map((p, i) => ({
      indice: i,
      titulo: limparTextoGerado(p.titulo, 160),
      minutos: minutos(p.minutos),
      fontes: o.fontesDoPonto(i),
      desenvolvimento: (Array.isArray(p.desenvolvimento) ? p.desenvolvimento : [])
        .map((d) => ({
          argumento: semRotuloDeTopico(limparTextoGerado(d.argumento, 300)),
          leia: limparLinha(limparTrecho(d.leia), 80) || null,
          ideias: topicos(d.ideias, 4, 250),
        }))
        .filter((d) => d.argumento)
        .slice(0, o.maxArgumentos),
      aplicacao: limparTextoGerado(p.aplicacao, 400),
      ilustracao: limparTextoGerado(p.ilustracao, 400) || null,
      transicao: limparTextoGerado(p.transicao, 250) || null,
    }))
    .filter((p) => p.titulo);
  await conferirLeituras(pontos, o.leituras);
  for (const p of pontos) delete p.indice;

  const tema = limparTextoGerado(saida.tema, 200) || o.temaPadrao;
  // Sem subtítulo da IA, a introdução e a conclusão usam o tema (nunca as palavras "Introdução" e "Conclusão").
  const parte = (p, maxTopicos) => ({
    titulo: limparTextoGerado(p && p.titulo, 160) || tema,
    minutos: minutos(p && p.minutos),
    topicos: topicos(p && p.topicos, maxTopicos, 300),
  });
  return {
    tema,
    objetivo: limparTextoGerado(saida.objetivo, 300),
    aplicacao: limparTextoGerado(saida.aplicacao, 300),
    introducao: parte(saida.introducao, o.maxTopicosIntro),
    pontos,
    conclusao: parte(saida.conclusao, o.maxTopicosConclusao),
  };
}

// O esboço anterior volta para a IA (em "outra versão" e "melhorar") com a leitura só pela referência: o texto do versículo fica
// de fora.
function anteriorParaIa(anteriores) {
  const e = anteriores && anteriores.esboco;
  if (!e || !Array.isArray(e.pontos)) return anteriores;
  const referencia = (leia) => (leia && typeof leia === "object" ? leia.referencia || null : typeof leia === "string" ? leia : null);
  return {
    ...anteriores,
    esboco: {
      ...e,
      pontos: e.pontos.map((p) => ({
        ...p,
        desenvolvimento: (Array.isArray(p && p.desenvolvimento) ? p.desenvolvimento : []).map((d) => ({ ...d, leia: referencia(d && d.leia) })),
      })),
    },
  };
}

// Confere o código do dirigente; responde com o erro e devolve false se não valer.
function acessoDoDirigente(res, body) {
  if (!codigoDoDirigente()) {
    erro(res, 500, "O código do dirigente ainda não está configurado no servidor.");
    return false;
  }
  if (!dirigenteValido(body.codigoDirigente)) {
    erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
    return false;
  }
  return true;
}

// Lê o discurso de Tesouros da semana pedida; devolve o discurso ou responde com o erro (e devolve null).
async function discursoDaSemana(res, body) {
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let discurso = null;
  try {
    discurso = await lerTesouros(url);
  } catch (e) {
    console.error("Tesouros: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler o discurso de Tesouros da Palavra de Deus no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!discurso) erro(res, 404, "Não encontrei o discurso de Tesouros da Palavra de Deus na apostila dessa semana.");
  return discurso;
}

// O que o app mostra ao carregar: o tema, os pontos (com os textos bíblicos e a fonte de cada um) e a pergunta de reflexão.
async function lerTesourosDaSemana(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const discurso = await discursoDaSemana(res, body);
  if (!discurso) return;
  return res.status(200).json({
    semana: discurso.semana,
    titulo: discurso.titulo,
    minutos: discurso.minutos,
    url: discurso.url,
    pontos: discurso.pontos.map((p) => ({ texto: p.texto, textos: p.referencias, fontes: p.citacoes.map((c) => c.citacao), fontesLidas: p.fontes.length })),
    reflexao: discurso.reflexao ? discurso.reflexao.texto : null,
  });
}

async function esbocoDeTesouros(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const discurso = await discursoDaSemana(res, body);
  if (!discurso) return;

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos(referenciasDeTesouros(discurso), 12);
    } catch (e) {
      console.error("Tesouros: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso de ${discurso.minutos} minutos de Tesouros da Palavra de Deus desta semana.\n\n` +
    textoDosTesouros(discurso, versiculos) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Esboço: outra versão" : "Esboço: melhorar"];
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaTesouros, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaTesouros }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    // Texto limpo e dentro dos limites; a fonte de cada ponto vem da apostila (não da IA). Pelo menos dois textos do discurso
    // são lidos (padrão do usuário); se a IA indicar menos, entram os textos da apostila.
    const esboco = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      temaPadrao: discurso.titulo,
      minutosMax: 10,
      maxPontos: 5,
      maxArgumentos: 5,
      maxTopicosIntro: 5,
      maxTopicosConclusao: 5,
      fontesDoPonto: (i) => (discurso.pontos[i] ? discurso.pontos[i].citacoes.map((c) => c.citacao) : []),
      leituras: { minimo: 2, indicadas: (i) => (discurso.pontos[i] ? discurso.pontos[i].referencias : []) },
    });
    const pontos = esboco.pontos;
    const completo = pontos.length > 0 && esboco.introducao.topicos.length > 0 && esboco.conclusao.topicos.length > 0;

    console.log(
      "Esboço de Tesouros:",
      JSON.stringify({
        modelo: P.ia.modelo,
        semana: discurso.semana,
        tema: discurso.titulo,
        pontosDaApostila: discurso.pontos.length,
        pontos: pontos.length,
        fontesLidas: discurso.pontos.reduce((n, p) => n + p.fontes.length, 0) + (discurso.reflexao ? discurso.reflexao.fontes.length : 0),
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      semana: discurso.semana,
      titulo: discurso.titulo,
      url: discurso.url,
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Faça seu melhor no ministério: esboço do discurso curto (4 a 5 minutos) ----------
// Só as semanas com um item "Discurso" nessa seção. O servidor lê o item (tema, tempo, fonte e lição do th) e, quando a fonte só
// traz o tema e alguns textos, pesquisa o tema no wol.jw.org (api/_wol.mjs); a IA elabora o esboço seguindo o prompt editável
// "discurso_curto". Só com o código do dirigente.

const SaidaDiscursoCurto = z.object({
  ...corpoDoEsboco(),
  fontes: z.array(z.string()),
  licao: z.object({ aplicada: z.boolean(), dica: z.string().nullable() }),
});

// Lê o discurso curto da semana pedida; devolve o discurso ou responde com o erro (e devolve null).
async function discursoCurtoDaSemana(res, body) {
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let discurso = null;
  try {
    discurso = await lerDiscursoCurto(url);
  } catch (e) {
    console.error("Discurso curto: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler a apostila no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!discurso) erro(res, 404, "Esta semana não tem discurso na seção Faça seu melhor no ministério da apostila (algumas semanas só têm conversas e demonstrações).");
  return discurso;
}

// O que o app mostra ao carregar: o tema, o tempo, a fonte, a lição do th e os textos indicados.
async function lerDiscursoCurtoDaSemana(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const discurso = await discursoCurtoDaSemana(res, body);
  if (!discurso) return;
  return res.status(200).json({
    semana: discurso.semana,
    titulo: discurso.titulo,
    minutos: discurso.minutos,
    url: discurso.url,
    fonte: discurso.fonteCitada,
    tipoFonte: discurso.fonte ? discurso.fonte.tipo : null,
    licao: discurso.licaoCitada ? { citacao: discurso.licaoCitada, titulo: discurso.licao ? discurso.licao.titulo : "" } : null,
    textos: discurso.referencias,
    pesquisa: discurso.pesquisa.length,
  });
}

async function esbocoDoDiscursoCurto(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const discurso = await discursoCurtoDaSemana(res, body);
  if (!discurso) return;

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos(referenciasDoDiscursoCurto(discurso), 12);
    } catch (e) {
      console.error("Discurso curto: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso de ${discurso.minutos} minutos de Faça seu melhor no ministério desta semana.\n\n` +
    textoDoDiscursoCurto(discurso, versiculos) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Esboço: outra versão" : "Esboço: melhorar"];
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaDiscursoCurto, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaDiscursoCurto }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    // O orador LÊ todos os textos indicados, no máximo 3 no discurso inteiro, e cada ponto fica com pelo menos uma leitura (os
    // textos indicados na apostila entram se a IA deixou o ponto sem leitura).
    const saida = resposta.parsed_output;
    const corpo = await corpoDoEsbocoLimpo(saida, {
      temaPadrao: discurso.titulo,
      minutosMax: discurso.minutos,
      maxPontos: 2,
      maxArgumentos: 4,
      maxTopicosIntro: 4,
      maxTopicosConclusao: 4,
      fontesDoPonto: () => [],
      leituras: { max: 3, cadaPonto: true, todas: discurso.referencias },
    });
    const pontos = corpo.pontos;

    // Só entram em "fontes" a fonte da apostila e as publicações que vieram da pesquisa no wol.jw.org (nada de fora do wol).
    const norma = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const permitidas = [discurso.fonteCitada, ...discurso.pesquisa.map((r) => r.rotulo)].filter(Boolean);
    const usadas = (Array.isArray(saida.fontes) ? saida.fontes : [])
      .map((f) => permitidas.find((permitida) => norma(f).length >= 3 && (norma(permitida) === norma(f) || norma(permitida).includes(norma(f)) || norma(f).includes(norma(permitida)))))
      .filter(Boolean);
    const fontes = [...new Set([...(discurso.fonteCitada ? [discurso.fonteCitada] : []), ...usadas])];

    const dica = saida.licao && saida.licao.aplicada ? limparTextoGerado(saida.licao.dica, 300) : "";
    const esboco = {
      ...corpo,
      fontes,
      licao: dica && discurso.licaoCitada ? { citacao: discurso.licaoCitada, titulo: discurso.licao ? discurso.licao.titulo : "", dica } : null,
    };
    const completo = pontos.length > 0 && esboco.introducao.topicos.length > 0 && esboco.conclusao.topicos.length > 0;

    console.log(
      "Esboço do discurso curto:",
      JSON.stringify({
        modelo: P.ia.modelo,
        semana: discurso.semana,
        tema: discurso.titulo,
        minutos: discurso.minutos,
        fonte: discurso.fonteCitada,
        pesquisa: discurso.pesquisa.length,
        licao: discurso.licaoCitada,
        licaoAplicada: Boolean(esboco.licao),
        pontos: pontos.length,
        leituras: pontos.reduce((n, p) => n + p.desenvolvimento.filter((d) => d.leia).length, 0),
        fontesUsadas: usadas.length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      semana: discurso.semana,
      titulo: discurso.titulo,
      url: discurso.url,
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Joias espirituais ----------
// O servidor lê a leitura da Bíblia da semana (capítulos com os versículos e os trechos das publicações do Índice das
// Publicações) e a seção "Joias espirituais" da apostila (api/_wol.mjs). A IA escreve até 2 joias por capítulo e a
// resposta à pergunta da apostila, no estilo das respostas do estudo.

const DestaqueJoia = z.object({ trecho: z.string(), tipo: z.enum(TIPOS), estilo: z.enum(ESTILOS).nullable(), maiusculas: z.boolean() });
const SaidaJoias = z.object({
  pergunta: z
    .object({
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(DestaqueJoia),
      referencias: z.array(z.string()),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
    .nullable(),
  joias: z.array(
    z.object({
      capitulo: z.string(),
      referencia: z.string(),
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(DestaqueJoia),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
});

async function leituraJoias(res, body) {
  if (!process.env.CODIGO_ESTUDO) {
    erro(res, 500, "A leitura do estudo ainda não está configurada no servidor.");
    return null;
  }
  if (!codigoValido(body.codigo)) {
    erro(res, 403, "Código de pesquisa inválido.");
    return null;
  }
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let joias = null;
  try {
    joias = await lerJoias(url);
  } catch (e) {
    console.error("Joias: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler a leitura da Bíblia da semana no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!joias) erro(res, 404, "Não encontrei a leitura da Bíblia na apostila dessa semana.");
  return joias;
}

// O que o app mostra ao carregar: a semana, a leitura, os capítulos e a pergunta da apostila.
async function lerJoiasDaSemana(res, body) {
  const joias = await leituraJoias(res, body);
  if (!joias) return;
  return res.status(200).json({
    semana: joias.semana,
    leitura: joias.leitura,
    capitulos: joias.capitulos.map((c) => c.nome),
    pergunta: joias.pergunta ? joias.pergunta.texto : null,
    trechos: joias.capitulos.reduce((n, c) => n + c.trechos.length, 0),
    url: joias.url,
  });
}

async function responderJoias(res, body, P) {
  const comPergunta = body.pergunta !== false;
  const comLeitura = body.leitura !== false;
  if (!comPergunta && !comLeitura) return erro(res, 400, "Marque a pergunta da apostila ou as joias da leitura.");
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  const inicioPedido = Date.now();

  const joias = await leituraJoias(res, body);
  if (!joias) return;
  const pergunta = comPergunta && joias.pergunta;
  if (!pergunta && !comLeitura) return erro(res, 400, "A apostila dessa semana não tem a pergunta das joias espirituais.");

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    `\n\nPEDIDO: pergunta da apostila ${pergunta ? "ATIVA" : "INATIVA"}; joias da leitura ${comLeitura ? "ATIVAS (no máximo 2 por capítulo)" : "INATIVAS"}.\n\n` +
    textoDasJoias(joias, { pergunta: Boolean(pergunta), leitura: comLeitura }) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nRESPOSTAS ANTERIORES (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaJoias, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaJoias }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu preparar as joias espirituais desta semana.");
    }

    const permitidos = estilosDe(opcoes);
    const saida = resposta.parsed_output;
    // A pergunta da apostila: o versículo dela entra sempre (regra fixa dos textos citados na pergunta).
    let itemPergunta = null;
    if (pergunta && saida.pergunta) {
      const rotulo = pergunta.referencias[0] || "Pergunta";
      itemPergunta = montarItem({ ...saida.pergunta, paragrafos: rotulo }, opcoes, permitidos, P.limites, sep);
      itemPergunta.referencias = [...new Set([...pergunta.referencias, ...itemPergunta.referencias])];
      if (!itemPergunta.resposta) itemPergunta = null;
    }
    // No máximo 2 joias por capítulo, na ordem da leitura, e nenhuma sobre o versículo da pergunta da apostila (ela já
    // tem a resposta própria). Os capítulos da leitura são de um livro só, então basta comparar capítulo e versículo.
    const chave = (t) => chaveDeBusca(t).replace(/\s+/g, "");
    const versosDe = (ref) => {
      const m = String(ref || "").match(/(\d+):([\d,\s–-]+)/);
      if (!m) return null;
      const versos = new Set();
      for (const parte of m[2].split(",")) {
        const [de, ate] = parte.split(/[–-]/).map((n) => Number(n.trim()));
        for (let v = de; v <= (ate || de) && v - de < 200; v++) versos.add(v);
      }
      return { capitulo: Number(m[1]), versos };
    };
    const daPergunta = joias.pergunta ? versosDe(joias.pergunta.referencias[0]) : null;
    const repetePergunta = (ref) => {
      const v = versosDe(ref);
      return Boolean(daPergunta && v && v.capitulo === daPergunta.capitulo && [...v.versos].some((n) => daPergunta.versos.has(n)));
    };
    const porCapitulo = new Map(joias.capitulos.map((c) => [chave(c.nome), []]));
    for (const j of comLeitura ? saida.joias : []) {
      const lista = porCapitulo.get(chave(j.capitulo)) || [...porCapitulo.values()].find((l, i) => chave(j.referencia).startsWith(chave(joias.capitulos[i].nome)));
      if (!lista || lista.length >= 2 || repetePergunta(j.referencia)) continue;
      const item = montarItem({ ...j, paragrafos: limparLinha(limparTrecho(j.referencia), 20), referencias: [] }, opcoes, permitidos, P.limites, sep);
      if (item.resposta) lista.push({ ...item, capitulo: joias.capitulos.find((c) => porCapitulo.get(chave(c.nome)) === lista).nome });
    }
    const itensJoias = [...porCapitulo.values()].flat();

    console.log(
      "Joias espirituais:",
      JSON.stringify({
        modelo: P.ia.modelo,
        leitura: joias.leitura,
        pergunta: Boolean(itemPergunta),
        joias: itensJoias.map((j) => j.paragrafos),
        trechos: joias.capitulos.reduce((n, c) => n + c.trechos.length, 0),
        // Publicação citada na pergunta da apostila: null = pergunta não pedida ou sem citação; 0 = não consegui ler; senão, caracteres lidos.
        trechoPergunta: pergunta && pergunta.citacoes.length ? pergunta.trecho?.texto.length || 0 : null,
        caracteres: mensagem.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    const finais = await finalizarItens([...(itemPergunta ? [itemPergunta] : []), ...itensJoias], opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Joias espirituais (tempo):", JSON.stringify({ total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));
    return res.status(200).json({
      semana: joias.semana,
      leitura: joias.leitura,
      url: joias.url,
      erro: finais.length ? null : "A IA não preparou as joias. Tente de novo.",
      pergunta: itemPergunta ? finais[0] : null,
      joias: itemPergunta ? finais.slice(1) : finais,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Comentários adicionais sobre o texto diário (tela Início) ----------
// O servidor lê o texto do dia no wol.jw.org (o mesmo da tela Início, guardado na memória) e a IA sugere aplicações
// práticas do texto temático e dos pontos principais do comentário, para alguém comentar com as próprias palavras.
// Ela pensa antes de responder (o texto é curto e a qualidade importa mais que a pressa).

const SaidaTextoDiario = z.object({
  comentarios: z.array(z.object({ ponto: z.string(), comentario: z.string() })),
});

async function comentariosDoTextoDiario(res, body, P) {
  if (!process.env.CODIGO_ESTUDO) return erro(res, 500, "O código de pesquisa ainda não está configurado no servidor.");
  if (!codigoValido(body.codigo)) return erro(res, 403, "Código de pesquisa inválido.");
  const m = typeof body.data === "string" ? body.data.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return erro(res, 400, "Data inválida.");

  let texto = null;
  try {
    texto = await lerTextoDiario(Number(m[1]), Number(m[2]), Number(m[3]));
  } catch (e) {
    console.error("Comentários do texto diário: leitura falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui ler o texto diário no wol.jw.org agora. Tente de novo em instantes.");
  }
  if (!texto) return erro(res, 404, "O wol.jw.org ainda não tem o texto diário dessa data.");

  const anteriores = (Array.isArray(body.anteriores) ? body.anteriores : [])
    .map((a) => limparLinha(a, 700))
    .filter(Boolean)
    .slice(0, 12);
  const mensagem =
    `TEXTO DIÁRIO:\nData: ${texto.titulo}\nTexto temático: ${texto.tema}\nComentário:\n${texto.comentario.join("\n")}` +
    (anteriores.length
      ? `\n\nCOMENTÁRIOS JÁ SUGERIDOS (escreva outros, com aplicações diferentes):\n${anteriores.map((a) => `- ${a}`).join("\n")}`
      : "");

  const inicio = Date.now();
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 6000 /* o raciocínio também conta aqui */, system: P.sistemaTextoDiario, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaTextoDiario }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu sugerir comentários para este texto.");
    }
    const comentarios = resposta.parsed_output.comentarios
      .map((c) => ({ ponto: limparLinha(limparTrecho(c.ponto), 120), comentario: limparTextoGerado(c.comentario, 700) }))
      .filter((c) => c.comentario)
      .slice(0, 6);

    console.log(
      "Comentários do texto diário:",
      JSON.stringify({
        modelo: P.ia.modelo,
        data: texto.data,
        comentarios: comentarios.length,
        outros: anteriores.length > 0,
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );
    return res.status(200).json({
      data: texto.data,
      erro: comentarios.length ? null : "A IA não sugeriu comentários. Tente de novo.",
      comentarios,
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
  // Os dois cartões de A Sentinela usam esta lista: o de comentários com o código de pesquisa, o do dirigente com o do dirigente.
  if (!codigoValido(body.codigo) && !dirigenteValido(body.codigoDirigente)) return recusarAcesso(res, body);

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  // Lida direto no site, a lista é exata e sai sem chamar a IA.
  const inicio = Date.now();
  try {
    const lido = await lerEstudoDireto(url);
    if (lido) {
      console.log("Estudo-lista (lido no site):", JSON.stringify({ grupos: lido.grupos.length, recapitulacao: lido.recapitulacao.length, segundos: Math.round((Date.now() - inicio) / 100) / 10 }));
      return res.status(200).json({
        titulo: lido.titulo || null,
        artigo: lido.id,
        url: lido.url,
        grupos: lido.grupos.map((g) => g.rotulo).slice(0, 40),
        recapitulacao: lido.recapitulacao.length > 0,
        erro: null,
      });
    }
  } catch (e) {
    console.error("Estudo-lista: leitura direta falhou", e?.name, e?.message);
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const tools = [
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
    ];

    let mensagens = [{ role: "user", content: `ENDEREÇO: ${url}` }];
    let resposta;
    for (let volta = 0; volta < 3; volta++) {
      // 4000: folga para o raciocínio dos modelos que não o desligam (no Haiku a resposta usa bem menos).
      resposta = await chamarIa(client, P, { max_tokens: 4000, system: P.sistemaLista, messages: mensagens, tools }, { semPensar: true });
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
  // Mais o modelo e o esforço da IA escolhidos pelo administrador (P.ia).
  const [prompts, ia] = await Promise.all([carregarPrompts(), lerConfigIa()]);
  const P = { ...prompts, ia };

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip, P.limites.limitePorHora)) {
    return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
  }

  if (req.body && req.body.tarefa === "estudo") return responderEstudo(res, req.body, P);
  if (req.body && req.body.tarefa === "estudo-lista") return listarParagrafos(res, req.body, P);
  if (req.body && req.body.tarefa === "estudo-perguntas") return sugerirPerguntas(res, req.body, P);
  if (req.body && req.body.tarefa === "texto-diario-comentarios") return comentariosDoTextoDiario(res, req.body, P);
  if (req.body && req.body.tarefa === "ebc-ler") return lerEbc(res, req.body);
  if (req.body && req.body.tarefa === "ebc") return responderEbc(res, req.body, P);
  if (req.body && req.body.tarefa === "ebc-dirigente") return perguntasEbcDirigente(res, req.body, P);
  if (req.body && req.body.tarefa === "tesouros-ler") return lerTesourosDaSemana(res, req.body);
  if (req.body && req.body.tarefa === "tesouros") return esbocoDeTesouros(res, req.body, P);
  if (req.body && req.body.tarefa === "discurso-ler") return lerDiscursoCurtoDaSemana(res, req.body);
  if (req.body && req.body.tarefa === "discurso") return esbocoDoDiscursoCurto(res, req.body, P);
  if (req.body && req.body.tarefa === "joias-ler") return lerJoiasDaSemana(res, req.body);
  if (req.body && req.body.tarefa === "joias") return responderJoias(res, req.body, P);

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
  const falaDePerguntas = /pergunta/i.test(`${ajuste} ${opcoes.instrucao}`);
  const efetivas = livre
    ? { ...opcoes, usarModelos: true, emoji: true, negrito: true, italico: true, negritoItalico: true, maiusculas: true, usarListas: true, separarIdeias: true }
    : opcoes;
  const estilosPermitidos = new Set([
    ...(efetivas.negrito ? ["negrito"] : []),
    ...(efetivas.italico ? ["italico"] : []),
    ...(efetivas.negritoItalico ? ["negrito_italico"] : []),
  ]);

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    "PREFERÊNCIAS DO USUÁRIO:\n" +
    descreverPreferencias(opcoes, P) +
    (consultaPedida(opcoes) ? descreverFontes(opcoes, P, true) : "") +
    "\n\nMODELOS DISPONÍVEIS:\n" +
    (modelosUsaveis.length
      ? modelosUsaveis.map((m) => `- id=${m.id} | nome=${m.nome} | conteúdo=${m.conteudo}`).join("\n")
      : "(nenhum)") +
    "\n\nLINHAS DO TEXTO:\n" +
    linhas.map((l, i) => `[${i}] ${l}`).join("\n") +
    lembreteFinal(opcoes, ajuste, P);

  if (modo && anteriores) {
    mensagem +=
      "\n\nSUGESTÕES ANTERIORES (JSON):\n" +
      anteriores +
      "\n\n" +
      P.frases.pedidos[modo === "nova" ? "Formatação: outra sugestão" : "Formatação: melhorar"];
  }

  // As caixas dos textos bíblicos (transcrever, só citar, explicar e aplicar) valem para o texto e para o resumo.
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 500, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: opcoes.consultarBiblia, perspicaz: opcoes.consultarPerspicaz });

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 60_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: opcoes.intensidade === "muitas" ? 10000 : 6000, system: P.sistemaFormatacao, messages: [{ role: "user", content: mensagem }] },
      { schema: Saida, semPensar: true }
    );

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
      let modeloId = efetivas.usarModelos && s.modeloId && idsValidos.has(s.modeloId) ? s.modeloId : null;
      // Regra fixa: modelo de PERGUNTA só em linha que pergunta (tem "?"); uma citação bíblica, por exemplo, não é pergunta.
      // Só vale outra coisa se o próprio usuário falar de perguntas na orientação.
      if (modeloId && !falaDePerguntas && ehModeloDePergunta(modelosUsaveis.find((m) => m.id === modeloId)) && !linha.includes("?")) modeloId = null;
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
        motivo: "",
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
    if (consultaPedida(opcoes)) await completarFontes([fonte], opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    const textos = fonte.textos || [];
    const perspicaz = fonte.perspicaz || null;

    return res.status(200).json({ resumo, sugestoes, textos, perspicaz });
  } catch (e) {
    return tratarErro(e, res);
  }
}
