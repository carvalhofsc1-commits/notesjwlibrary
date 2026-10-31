// Função serverless (Vercel) que pede à IA sugestões de formatação para as linhas do texto.
// A chave da API fica só aqui, na variável de ambiente ANTHROPIC_API_KEY — nunca vai para o navegador.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { codigoDoDirigente, erro, origemPermitida } from "./_comum.mjs";
import { acessoDoDirigente, codigoValido, dirigenteValido, exigirAcesso, recusarAcesso } from "./_acesso.mjs";
import { lerConfigIa } from "./_iaConfig.mjs";
import { blocoLicoesPara } from "./_memoria.mjs";
import { emitirCupomVoz } from "./_vozCupom.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";
import { buscarVerbete, buscarVersiculos, fontesConfiguradas, precarregarFontes, referenciasNoTexto } from "./_fontes.mjs";
import { lerEsboco, lerIndice, minutosDoEsboco, publicacoesDaSecao, referenciasDoPublico, s34Configurado, textoDoDiscursoPublico, textoDoEsbocoImportado, textosBiblicosDoPublico, validarEsboco } from "./_s34.mjs";
import {
  QUADROS_EBC,
  lerEstudoBiblico,
  lerCamposDoDocumento,
  lerArtigoDoWol,
  lerReuniaoDaSemana,
  lerEstudoDireto,
  lerImagensDaApostila,
  lerDiscursoCurto,
  lerJoias,
  lerTesouros,
  lerTextoDiario,
  pesquisarNoWol,
  referenciasDeTesouros,
  referenciasDoDiscursoCurto,
  semanasDosEstudos,
  textoDaRecapitulacao,
  textoDasJoias,
  textoDoCapituloEbc,
  textoDoCapituloEbcDirigente,
  textoDoDiscursoCurto,
  textoDosGrupos,
  textoDosTesouros,
  textosBiblicosDeTesouros,
  textosBiblicosDoDiscursoCurto,
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

// Quantas lições da memória entraram no último chamarIa com tarefa (para devolver memoriaUsada na resposta).
let ultimoMemoriaUsada = 0;

async function chamarIa(client, P, params, { schema = null, semPensar = false, tarefa = "" } = {}) {
  let system = params.system || "";
  // Só na chamada que informa a tarefa: as voltas seguintes (pause_turn) não zeram memoriaUsada.
  if (tarefa) {
    const m = await blocoLicoesPara(tarefa);
    ultimoMemoriaUsada = m.usadas;
    system += m.texto || "";
  }
  const { modelo, esforco } = P.ia;
  const fallback = temFallback(modelo);
  const formato = schema ? (fallback ? betaZodOutputFormat(schema) : zodOutputFormat(schema)) : null;
  const output_config = { ...(formato ? { format: formato } : {}), ...(aceitaEsforco(modelo) ? { effort: esforco } : {}) };
  const pensar =
    semPensar && /haiku-5/.test(modelo) && process.env.CLAUDE_RACIOCINIO !== "on" ? { thinking: { type: "disabled" } } : {};
  const corpo = { ...params, system, model: modelo, ...pensar, ...(Object.keys(output_config).length ? { output_config } : {}) };
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
// Instruções adicionais do usuário para um pedido (campo de cada seção das reuniões) e instruções fixas (o app limita estas a 300): passam por textoLivre.
const MAX_TEXTO_LIVRE = 800;

const ESTILOS = ["negrito", "italico", "negrito_italico"];
// Tipos de fonte (alfabetos Unicode do app) que a IA pode escolher para um destaque, além do negrito/itálico da fonte
// principal. Só os legíveis em palavras e frases curtas.
// O gótico (fraktur) ficou de fora a pedido do usuário.
// Regra fixa do usuário: só estas três. Script, largura cheia, letras circuladas, gótico e monoespaçado ficam de fora.
const FONTES = ["doubleStruck", "sans", "squaredDark"];
// Os tipos de citação bíblica saíram do app (as opções de textos bíblicos cuidam disso); continuam aceitos aqui só para uma instrução
// salva por um administrador antes não derrubar a resposta. Todo destaque é tratado como "geral".
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

function ipDoPedido(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
}

async function carregarPromptsEIa() {
  const [prompts, ia] = await Promise.all([carregarPrompts(), lerConfigIa()]);
  return { ...prompts, ia };
}

// Tarefas que só leem o wol.jw.org, o Blob do S-34 ou os arquivos da Bíblia: não chamam a Anthropic.
const TAREFAS_SEM_IA = new Set([
  "ebc-ler",
  "tesouros-ler",
  "publico-lista",
  "publico-ler",
  "publico-esboco",
  "versiculos",
  "outros-pesquisar",
  "outros-ler",
  "discurso-ler",
  "joias-ler",
  "apostila-imagens",
]);

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
    usarListas: o.usarListas === true,
    separarIdeias: o.separarIdeias === true,
    separarFrases: o.separarFrases === true,
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
    o.usarListas ? trocar(l["Listas: marcada"], { modelos_de_lista: l["Catálogo de listas"] }) : l["Listas: desmarcada"],
    f[o.separarIdeias ? "Espaçamento: marcada" : "Espaçamento: desmarcada"],
  ]
    .filter(Boolean)
    .join("\n");
}

// Orientação do usuário (campo "Instruções adicionais para a IA" do pedido e instruções fixas das configurações). Vai no INÍCIO da
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
  return typeof trecho === "string" ? semCulto(semGotica(trecho.replace(/[*`]+/g, "").replace(ASPAS_NAS_PONTAS, ""))) : "";
}

// Texto escrito pela IA (respostas e resumo): sem Markdown (* e `) e sem emojis no começo. As vezes ela escreve
// **negrito** ou repete o emoji dentro do texto, e como a formatação vem dos campos emoji/destaques, isso
// apareceria como asteriscos e emoji duplicado.
function limparTextoGerado(valor, max) {
  const texto = typeof valor === "string" ? semCulto(semGotica(valor)) : "";
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
        // numerado: o texto que o app mostra traz o começo de cada versículo, do segundo em diante, marcado por [n]; a IA recebe só o texto corrido.
        const daPergunta = await buscarVersiculos(p.daPergunta, 6, { numerado: true }); // os da pergunta entram sempre (até 6)
        const vistos = new Set(daPergunta.map((t) => t.referencia));
        const outros = (await buscarVersiculos(p.outros, P.limites.maxTextos, { numerado: true })).filter((t) => !vistos.has(t.referencia));
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
      itens[indice].textos = a.textos.filter((t) => !t.semTexto).map((t) => ({ referencia: t.referencia, texto: t.textoNumerado, aplicacao: "" }));
      if (!a.textos.length && !a.verbete) return;
      lista.push({
        indice,
        contexto: String(itens[indice].contexto || "").slice(0, 3000),
        explicar: true,
        textos: a.textos.map((t) => ({ referencia: t.referencia, texto: t.texto })),
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
      { schema: SaidaAplicacao, semPensar: true, tarefa: "aplicacao" }
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
          return { referencia: t.referencia, texto: t.textoNumerado, aplicacao: explicacao };
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
  if (opcoes.separarFrases || pedeFrases.test(pedido)) return "frases";
  if (opcoes.separarIdeias || /linhas?\s+em\s+branco|separ\w*\s+(as\s+|os\s+)?(ideias|par[áa]grafos|trechos)/i.test(pedido)) return "ideias";
  return null;
}

const ABREVIACOES = new Set(["sr", "sra", "srta", "dr", "dra", "cap", "caps", "vs", "ex", "etc", "pág", "págs", "par", "pars", "nº", "v", "vv", "cf", "obs"]);

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
async function conversar(client, P, { system, mensagens, tools, maxTokens, voltas, tarefa = "" }) {
  let resposta;
  const blocos = [];
  const inicio = Date.now();
  const uso = { modelo: P.ia.modelo, voltas: 0, entrada: 0, saida: 0 };
  for (let volta = 0; volta < voltas; volta++) {
    // A memória só entra na 1ª volta (a tarefa só na primeira chamada); nas seguintes o system já está no histórico.
    resposta = await chamarIa(client, P, { max_tokens: maxTokens, system, messages: mensagens, tools }, { tarefa: volta === 0 ? tarefa : "" });
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
async function escreverRespostas({ rotulo, texto, escopo, opcoes, modo, ajuste, anteriores, sep, P, tarefa = "sentinela" }) {
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
    { schema: SaidaSentinela, tarefa }
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
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  // Os versículos citados na pergunta são sempre transcritos: a Bíblia começa a carregar enquanto a IA escreve.
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });

  try {
    const { itens, uso } = await escreverRespostas({ rotulo: "TEXTO COLADO", texto: linhas.join("\n"), opcoes, modo, ajuste, anteriores, sep, P });
    console.log("Texto colado:", JSON.stringify(uso));
    if (!itens) return erro(res, 502, "A IA não conseguiu gerar as respostas para este texto.");
    const memoriaUsada = ultimoMemoriaUsada;
    return res.status(200).json({ itens: await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P)), memoriaUsada });
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
    const { itens: gerados, uso } = await escreverRespostas({ rotulo: "TEXTO DO ESTUDO", texto, escopo, opcoes, modo, ajuste, anteriores, sep, P, tarefa: "estudo" });
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

    const memoriaUsada = ultimoMemoriaUsada;
    const inicioFontes = Date.now();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Estudo (tempo):", JSON.stringify({ fontes: Math.round((Date.now() - inicioFontes) / 100) / 10, total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));

    return res.status(200).json({
      titulo: lido.titulo || null,
      erro: itens.length ? null : "A IA não respondeu ao(s) parágrafo(s) pedido(s). Tente de novo.",
      url: lido.url,
      itens: itensFinais,
      memoriaUsada,
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
  if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
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
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
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
      tarefa: "estudo",
    });
    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");
    return { resposta, uso, texto, dados: SaidaEstudo.safeParse(extrairJson(texto)) };
  };

  try {
    const { resposta, uso, texto, dados } = await consultar(mensagem); // memoriaUsada via conversar(..., tarefa: estudo)

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

    const memoriaUsada = ultimoMemoriaUsada;
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
      memoriaUsada,
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
  if (!codigoDoDirigente()) return erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
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
  // "Outra resposta" e "Melhorar": as perguntas já sugeridas voltam ao servidor (os mesmos itens que ele devolveu).
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
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
  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    "PEDIDO (seções ligadas pelo usuário):\n" +
    `- Seção 1, perguntas complementares ("complementares"): ${opcoes.perguntasComplementares ? "ATIVA" : "INATIVA"}\n` +
    `- Seção 2, perguntas aplicativas ("aplicativas"): ${opcoes.perguntasAplicativas ? "ATIVA" : "INATIVA"}\n` +
    `- Seção 3, perguntas sobre os textos bíblicos ("perguntasTextos"): ${opcoes.perguntasTextos ? "ATIVAS" : "INATIVAS"}\n` +
    `- Seção 3, perguntas de entendimento dos textos bíblicos ("perguntasEntendimento"): ${opcoes.perguntasEntendimento ? "ATIVAS" : "INATIVAS"}\n` +
    "\nTEXTO DO ESTUDO:\n" +
    texto +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem +=
      "\n\nPERGUNTAS JÁ SUGERIDAS (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Perguntas do dirigente: outras perguntas" : "Perguntas do dirigente: melhorar"];
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 8000 /* o raciocínio também conta aqui */, system: P.sistemaPerguntas, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaPerguntas, tarefa: "estudo-perguntas" }
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
      memoriaUsada: ultimoMemoriaUsada,
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
    erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
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
    imagens: capitulo.imagens || [],
  });
}

async function responderEbc(res, body, P) {
  const quadros = new Set((Array.isArray(body.quadros) ? body.quadros : []).filter((q) => QUADROS_EBC.some((x) => x.id === q)));
  if (!quadros.size) return erro(res, 400, "Marque pelo menos um quadro de perguntas.");
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
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
      { schema: SaidaEbc, tarefa: "ebc" }
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

    const memoriaUsada = ultimoMemoriaUsada;
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Estudo bíblico (tempo):", JSON.stringify({ total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));
    return res.status(200).json({
      materia: capitulo.materia,
      titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
      url: capitulo.url,
      erro: itens.length ? null : "A IA não respondeu às perguntas. Tente de novo.",
      itens: itensFinais,
      memoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo Bíblico de Congregação: perguntas adicionais para o dirigente ----------
// A IA recebe o capítulo da semana (relato, "Leia o relato na Bíblia", trechos das publicações) e as perguntas ORIGINAIS dos
// quatro quadros, e elabora 5 perguntas adicionais com resposta (sem aplicações práticas) e/ou escolhe os textos-base (2 ou 3 trechos
// pequenos e significativos para ler), conforme o usuário marcou em "O que preparar" (uma, outra ou as duas). Só quem tem o código do dirigente.

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
  if (!codigoDoDirigente()) return erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
  if (!dirigenteValido(body.codigoDirigente)) return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  // "O que preparar": as perguntas adicionais (ligadas, a não ser que venham desmarcadas) e/ou os textos-base; pelo menos uma.
  const perguntasPedidas = body.perguntas !== false;
  const textosBase = body.textosBase === true;
  if (!perguntasPedidas && !textosBase) return erro(res, 400, "Marque as perguntas adicionais ou os textos bíblicos para ler.");
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
    `PEDIDO: ${perguntasPedidas ? "elabore até 5 perguntas adicionais com resposta" : "NÃO elabore perguntas adicionais (\"perguntas\" fica [])"}; resumo dos textos-base ${textosBase ? "ATIVO" : "INATIVO"}.\n\n` +
    textoDoCapituloEbcDirigente(capitulo, versiculos) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    const f = P.frases.pedidos;
    const pedidos = [];
    if (perguntasPedidas) pedidos.push(f[modo === "nova" ? "Estudo Bíblico do dirigente: outras perguntas" : "Estudo Bíblico do dirigente: melhorar"]);
    if (textosBase) pedidos.push(f[modo === "nova" ? "Estudo Bíblico do dirigente: outros textos-base" : "Estudo Bíblico do dirigente: melhorar textos-base"]);
    mensagem += `\n\n${perguntasPedidas ? "PERGUNTAS JÁ SUGERIDAS" : "TEXTOS-BASE JÁ SUGERIDOS"} (JSON):\n` + anteriores + "\n\n" + pedidos.join("\n");
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaEbcDirigente, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaEbcDirigente, tarefa: "ebc-dirigente" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar as perguntas para este capítulo.");
    }

    // No máximo 5, só as que têm pergunta e resposta e que não são cópia de uma pergunta original do capítulo.
    const originais = capitulo.perguntas.map((p) => normalizarPergunta(p.pergunta));
    const vistas = [];
    const perguntas = [];
    for (const i of perguntasPedidas ? resposta.parsed_output.perguntas : []) {
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
        perguntasPedidas,
        perguntas: perguntas.length,
        recebidas: resposta.parsed_output.perguntas.length,
        textosBasePedidos: textosBase,
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
      erro: perguntas.length || base.length ? null : perguntasPedidas ? "A IA não elaborou perguntas diferentes das originais. Tente de novo." : "A IA não escolheu trechos dos textos bíblicos. Tente de novo.",
      perguntas,
      textosBase: base,
      memoriaUsada: ultimoMemoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Tesouros da Palavra de Deus: esboço do discurso de 10 minutos ----------
// O servidor lê o discurso da semana na apostila (o tema, os pontos com os textos bíblicos, a pergunta de reflexão e os trechos
// das fontes citadas; api/_wol.mjs) e a IA elabora o esboço seguindo o prompt editável "tesouros". Só com o código do dirigente.

// Partes comuns aos esboços (Tesouros e discurso curto). Regras do usuário para TODOS os esboços: só entra o que o orador pode
// dizer à assistência (ou um lembrete do que ele precisa dizer ou fazer); a introdução e a conclusão têm subtítulo próprio e são
// escritas palavra por palavra; todo texto lido (LEIA) tem uma fala antes (que cria expectativa e liga a ideia anterior ao texto) e
// uma depois (que destaca as palavras-chave do texto), e a íntegra do texto vem da Bíblia no servidor (a IA só indica onde entra).
const falaDoEsboco = () => z.object({ texto: z.string(), lista: z.array(z.string()) });
const parteDoEsboco = () => z.object({ titulo: z.string(), minutos: z.number(), blocos: z.array(falaDoEsboco()) });
const pontoDoEsboco = () =>
  z.object({
    titulo: z.string(),
    minutos: z.number(),
    desenvolvimento: z.array(
      z.object({
        argumento: z.string(),
        ideias: z.array(z.string()),
        leitura: z.object({ referencia: z.string(), introducao: z.string(), destaque: z.string() }).nullable(),
      })
    ),
    aplicacao: z.string(),
    ilustracao: z.string().nullable(),
    transicao: z.string(),
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

// Rótulos que a IA às vezes escreve no começo de uma fala ("Tema: ...", "Primeiras frases: ..."): o esboço só leva o que o orador
// diz, então o rótulo cai e fica a frase.
const ROTULO_DE_TOPICO =
  /^(?:primeiras?\s+frases?|frases?\s+de\s+abertura|tema(?:\s+principal)?|objetivo|aplica[cç][aã]o(?:\s+pr[aá]tica)?|ilustra[cç][aã]o|transi[cç][aã]o|introdu[cç][aã]o|conclus[aã]o|recapitula[cç][aã]o)(?:\s*[:：]\s*|\s+[–—-]\s+)/iu;

function semRotuloDeTopico(texto) {
  const limpo = texto.replace(ROTULO_DE_TOPICO, "").trim();
  return limpo === texto ? texto : limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

// Emoji que a IA põe no começo de uma fala para ilustrar o assunto (regra do usuário: os esboços levam emojis): fica, com no máximo
// 4 símbolos; o resto da fala segue as mesmas limpezas dos outros textos (a limpeza comum apagaria o emoji do começo).
const EMOJI_NO_COMECO = /^(?:\p{Extended_Pictographic}[️‍\p{Emoji_Modifier}]*\s*)+/u;

// Os emojis dos esboços são opcionais (a opção "Ilustrar com emoji" das configurações): com a opção desligada, o emoji do começo cai.
function limparFala(valor, max, comEmoji = true) {
  const bruto = typeof valor === "string" ? valor.replace(/[*`]+/g, "").replace(/\s+/g, " ").trim() : "";
  const m = bruto.match(EMOJI_NO_COMECO);
  const emoji = comEmoji && m && (m[0].match(/\p{Extended_Pictographic}/gu) || []).length <= 4 ? m[0].replace(/\s+/g, "") : "";
  const resto = semRotuloDeTopico(limparTextoGerado(m ? bruto.slice(m[0].length) : bruto, max));
  return emoji && resto ? emoji + " " + resto : resto;
}

// A frase do pedido que diz à IA se os emojis das falas do esboço estão ativos ou inativos (opção das configurações; texto editável
// em "Orientação do usuário, lembrete…").
function emojisDoEsboco(opcoes, P) {
  return P.frases.pedidos[opcoes.emoji ? "Esboço: emojis ativos" : "Esboço: emojis inativos"];
}

// Número ou marcador que a IA escreve por conta própria no começo de um item de lista (o app numera os itens).
const MARCA_DE_ITEM = /^\s*(?:\d{1,2}\s*[.)]|[•◦▪‣-])\s*/u;

// O texto exato de uma leitura, tirado da Bíblia (Tradução do Novo Mundo). Sem a Bíblia no servidor (ou se a referência não for
// achada), fica só a referência e o orador lê na própria Bíblia.
async function leituraDaBiblia(referencia) {
  if (fontesConfiguradas()) {
    try {
      const [achado] = await buscarVersiculos([referencia], 1, { numerado: true });
      if (achado) return { referencia: achado.referencia, texto: achado.texto, textoNumerado: achado.textoNumerado };
    } catch (e) {
      console.error("Esboço: versículo indisponível", e?.message);
    }
  }
  return { referencia, texto: null };
}

// Cada leitura da IA ganha o texto da Bíblia: { referencia, texto, introducao, destaque }. Um texto nunca é lido duas vezes e o
// total respeita o máximo (a leitura que sobra cai, o argumento fica).
async function conferirLeituras(pontos, max = Infinity, permitidas = null) {
  const lidas = new Set();
  let total = 0;
  for (const ponto of pontos) {
    for (const d of ponto.desenvolvimento) {
      if (!d.leitura) continue;
      if (total >= max) {
        d.leitura = null;
        continue;
      }
      const achada = await leituraDaBiblia(d.leitura.referencia);
      // No discurso público só se lê o que o esboço do S-34 marca com [Leia ...].
      if (permitidas && !permitidas.has(achada.referencia)) {
        d.leitura = null;
        continue;
      }
      if (lidas.has(achada.referencia)) {
        d.leitura = null;
        continue;
      }
      lidas.add(achada.referencia);
      total++;
      d.leitura = { ...d.leitura, ...achada };
    }
  }
}

// Regra do usuário: NENHUMA resposta da IA (estudo, joias, comentários, esboços…) usa as fontes gótica (fraktur) e script, comuns ou em
// negrito. Se a IA escrever com essas letras do Unicode, elas viram letras comuns (as outras fontes não mudam). As letras que ficam fora dos
// blocos principais (ℭ ℌ ℑ ℜ ℨ da gótica; ℬ ℰ ℱ ℋ ℐ ℒ ℳ ℛ ℯ ℊ ℴ do script) também. As letras duplas (ℂ ℍ ℕ ℙ ℚ ℝ ℤ) não entram.
const GOTICAS_FORA_DO_BLOCO = {
  "ℭ": "C", "ℌ": "H", "ℑ": "I", "ℜ": "R", "ℨ": "Z",
  "ℬ": "B", "ℰ": "E", "ℱ": "F", "ℋ": "H", "ℐ": "I", "ℒ": "L", "ℳ": "M", "ℛ": "R", "ℯ": "e", "ℊ": "g", "ℴ": "o",
};
// Cada bloco tem 26 letras: [primeira letra do bloco, letra comum correspondente].
const BLOCOS_GOTICA_E_SCRIPT = [
  [0x1d49c, 65], [0x1d4b6, 97], // script
  [0x1d4d0, 65], [0x1d4ea, 97], // script negrito
  [0x1d504, 65], [0x1d51e, 97], // gótica
  [0x1d56c, 65], [0x1d586, 97], // gótica negrito
];
function semGotica(texto) {
  if (typeof texto !== "string") return "";
  return Array.from(texto, (ch) => {
    if (GOTICAS_FORA_DO_BLOCO[ch]) return GOTICAS_FORA_DO_BLOCO[ch];
    const cp = ch.codePointAt(0);
    if (cp < 0x1d49c || cp > 0x1d59f) return ch;
    for (const [inicio, base] of BLOCOS_GOTICA_E_SCRIPT) {
      if (cp >= inicio && cp < inicio + 26) return String.fromCharCode(base + cp - inicio);
    }
    return ch;
  }).join("");
}
function semGoticaTudo(valor) {
  if (typeof valor === "string") return semGotica(valor);
  if (Array.isArray(valor)) return valor.map(semGoticaTudo);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, semGoticaTudo(v)]));
  return valor;
}

// A parte do esboço que os dois discursos têm em comum, limpa e dentro dos limites (tema, objetivo, introdução e conclusão com
// subtítulo e falas, pontos com argumentos, leituras, aplicação, ilustração e transição). Devolve também os avisos (regras do
// usuário que a IA não cumpriu e que o servidor não conserta sozinho).
async function corpoDoEsbocoLimpo(saidaBruta, o) {
  const saida = semGoticaTudo(saidaBruta);
  const frase = (texto, tamanho) => limparFala(texto, tamanho, o.emoji);
  const ideias = (lista, max, tamanho) => (Array.isArray(lista) ? lista : []).map((x) => frase(x, tamanho)).filter(Boolean).slice(0, max);
  const minutos = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(o.minutosMax, Math.round(n))) : 0);
  const pontos = (Array.isArray(saida.pontos) ? saida.pontos : [])
    .slice(0, o.maxPontos)
    .map((p, i) => ({
      titulo: limparTextoGerado(p.titulo, 160),
      minutos: minutos(p.minutos),
      fontes: o.fontesDoPonto(i),
      desenvolvimento: (Array.isArray(p.desenvolvimento) ? p.desenvolvimento : [])
        .map((d) => {
          const l = d.leitura && typeof d.leitura === "object" ? d.leitura : null;
          const referencia = l ? limparLinha(limparTrecho(l.referencia), 80) : "";
          return {
            argumento: frase(d.argumento, 300),
            ideias: ideias(d.ideias, 4, 300),
            leitura: referencia ? { referencia, introducao: frase(l.introducao, 400), destaque: frase(l.destaque, 500) } : null,
          };
        })
        .filter((d) => d.argumento)
        .slice(0, o.maxArgumentos),
      aplicacao: limparTextoGerado(p.aplicacao, 400),
      ilustracao: limparTextoGerado(p.ilustracao, 400) || null,
      // A transição, como a aplicação e a ilustração, já tem o emoji da própria linha no app.
      transicao: semRotuloDeTopico(limparTextoGerado(p.transicao, 300)) || null,
    }))
    .filter((p) => p.titulo);
  await conferirLeituras(pontos, o.maxLeituras, o.leiturasPermitidas ? new Set(o.leiturasPermitidas) : null);

  const tema = limparTextoGerado(saida.tema, 200) || o.temaPadrao;
  // Introdução e conclusão são escritas palavra por palavra: falas curtas e, em cada uma, os itens de uma enumeração (que o app numera).
  // Sem subtítulo da IA, usam o tema (nunca as palavras "Introdução" e "Conclusão").
  const parte = (p, maxBlocos) => ({
    titulo: limparTextoGerado(p && p.titulo, 160) || tema,
    minutos: minutos(p && p.minutos),
    blocos: (Array.isArray(p && p.blocos) ? p.blocos : [])
      .map((b) => ({
        texto: frase(b && b.texto, 600),
        lista: (Array.isArray(b && b.lista) ? b.lista : []).map((x) => limparFala(typeof x === "string" ? x.replace(MARCA_DE_ITEM, "") : "", 250, o.emoji)).filter(Boolean).slice(0, 6),
      }))
      .filter((b) => b.texto)
      .slice(0, maxBlocos),
  });

  const avisos = [];
  const leituras = pontos.flatMap((p) => p.desenvolvimento.map((d) => d.leitura).filter(Boolean));
  if (o.minLeituras && leituras.length < o.minLeituras) {
    avisos.push(`A IA indicou só ${leituras.length} texto(s) para leitura (o padrão são ${o.minLeituras} ou mais). Use "Melhorar" para pedir mais.`);
  }
  if (o.leituraEmCadaPonto && pontos.some((p) => !p.desenvolvimento.some((d) => d.leitura))) {
    avisos.push('Há ponto sem texto para leitura. Use "Melhorar" para pedir um texto em cada ponto.');
  }
  if (o.leiturasObrigatorias && o.leiturasObrigatorias.length) {
    const lidas = new Set(leituras.map((l) => l.referencia));
    const faltam = [...new Set(o.leiturasObrigatorias)].filter((r) => !lidas.has(r));
    if (faltam.length) avisos.push(`Faltou a leitura de ${faltam.join("; ")}${o.motivoObrigatorias ? ", " + o.motivoObrigatorias : ""}. Use "Melhorar" ou "Incluir texto(s)" para incluí-la.`);
  }
  if (leituras.some((l) => !l.introducao || !l.destaque)) {
    avisos.push('Algum texto ficou sem a fala antes da leitura ou sem o comentário depois dela. Use "Melhorar" para corrigir.');
  }
  return {
    esboco: {
      tema,
      objetivo: limparTextoGerado(saida.objetivo, 300),
      aplicacao: limparTextoGerado(saida.aplicacao, 300),
      introducao: parte(saida.introducao, o.maxBlocosIntro),
      pontos,
      conclusao: parte(saida.conclusao, o.maxBlocosConclusao),
    },
    avisos,
  };
}

// O esboço anterior volta para a IA (em "outra versão" e "melhorar") sem o texto dos versículos: a leitura vai só com a referência
// e as falas de antes e de depois.
function anteriorParaIa(anteriores) {
  const e = anteriores && anteriores.esboco;
  if (!e || !Array.isArray(e.pontos)) return anteriores;
  const leitura = (l) => (l && typeof l === "object" ? { referencia: l.referencia || "", introducao: l.introducao || "", destaque: l.destaque || "" } : null);
  return {
    ...anteriores,
    esboco: {
      ...e,
      pontos: e.pontos.map((p) => ({
        ...p,
        desenvolvimento: (Array.isArray(p && p.desenvolvimento) ? p.desenvolvimento : []).map((d) => ({ ...d, leitura: leitura(d && d.leitura) })),
      })),
    },
  };
}

// ---------- Textos bíblicos da matéria dos esboços ----------
// A tela mostra, em cada esboço, todos os textos bíblicos da matéria (a apostila e as fontes, ou o esboço do S-34), com o texto exato
// da Bíblia e a marca dos que a matéria manda ler ("Leia"). O orador marca os que quer ler além dos previstos e o app os manda de
// volta em "textosExtras", já na primeira elaboração ou depois, no pedido "incluir".

// A lista da tela (textosDaMateria): { referencia, texto, leia }, com os marcados com "Leia" primeiro (a ordem da matéria se mantém dentro de cada grupo).
async function textosDaMateria({ todos, leia }) {
  const itens = new Map(); // referência como a Bíblia escreve -> item
  try {
    for (const bruta of [...new Set([...(todos || []), ...(leia || [])])].slice(0, 80)) {
      const achada = await leituraDaBiblia(bruta);
      // Com a Bíblia no servidor, o que ela não acha (por exemplo, um capítulo inteiro, "Je 48") não entra: a IA não teria o texto.
      if (fontesConfiguradas() && !achada.texto) continue;
      if (!itens.has(achada.referencia)) itens.set(achada.referencia, { referencia: achada.referencia, texto: achada.texto, leia: false });
    }
    for (const bruta of leia || []) {
      const item = itens.get((await leituraDaBiblia(bruta)).referencia);
      if (item) item.leia = true;
    }
  } catch (e) {
    console.error("Textos bíblicos da matéria: lista incompleta", e?.message);
  }
  return [...itens.values()].sort((a, b) => Number(b.leia) - Number(a.leia));
}

// As referências, como a Bíblia as escreve, de uma lista de referências da matéria (para conferir se o esboço as lê).
async function referenciasDaBiblia(brutas) {
  if (!fontesConfiguradas()) return [];
  const vistas = new Set();
  for (const bruta of brutas || []) vistas.add((await leituraDaBiblia(bruta)).referencia);
  return [...vistas];
}

// Os textos que o orador escolheu ler além dos previstos: [{ referencia, texto }], conferidos na Bíblia, sem repetir (até 15).
async function textosExtrasDoPedido(body) {
  const brutos = (Array.isArray(body.textosExtras) ? body.textosExtras : []).filter((t) => typeof t === "string").map((t) => limparLinha(t, 80)).filter(Boolean).slice(0, 15);
  const vistos = new Set();
  const extras = [];
  for (const bruto of brutos) {
    const achado = await leituraDaBiblia(bruto);
    if (fontesConfiguradas() && !achado.texto) continue; // a Bíblia não achou: a IA não teria o texto exato
    if (vistos.has(achado.referencia)) continue;
    vistos.add(achado.referencia);
    extras.push(achado);
  }
  return extras;
}

// Os trechos do pedido (frases editáveis em "Orientação do usuário, lembrete…"): os textos marcados com "Leia" na matéria e os que o
// orador escolheu, cada bloco com o texto exato dos versículos.
function blocoDeTextosMarcados(leiaDaMateria, P) {
  if (!leiaDaMateria.length) return "";
  return "\n\n" + trocar(P.frases.pedidos["Esboço: textos marcados na matéria"], { textos: leiaDaMateria.join("; ") });
}

function blocoDeTextosEscolhidos(extras, P) {
  if (!extras.length) return "";
  const versiculos = extras.filter((e) => e.texto).map((e) => `${e.referencia}: ${e.texto}`);
  return (
    "\n\n" +
    trocar(P.frases.pedidos["Esboço: textos escolhidos"], { textos: extras.map((e) => e.referencia).join("; ") }) +
    (versiculos.length ? "\nTEXTO DOS VERSÍCULOS ESCOLHIDOS:\n" + versiculos.join("\n") : "")
  );
}

// "Outra versão", "Melhorar" ou "Incluir texto(s)": o pedido que vai depois do esboço já sugerido.
function pedidoDoModo(modo, P) {
  return P.frases.pedidos[modo === "nova" ? "Esboço: outra versão" : modo === "incluir" ? "Esboço: incluir textos" : "Esboço: melhorar"];
}

// As leituras que o esboço anterior já tinha (para o pedido "incluir" não perder nenhuma).
function leiturasDoEsbocoAnterior(anteriores) {
  const pontos = anteriores && anteriores.esboco && Array.isArray(anteriores.esboco.pontos) ? anteriores.esboco.pontos : [];
  return pontos
    .flatMap((p) => (Array.isArray(p && p.desenvolvimento) ? p.desenvolvimento : []))
    .map((d) => d && d.leitura && d.leitura.referencia)
    .filter((r) => typeof r === "string" && r);
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
    imagens: discurso.imagens || [],
    textosBiblicos: await textosDaMateria(textosBiblicosDeTesouros(discurso)),
  });
}

async function esbocoDeTesouros(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const discurso = await discursoDaSemana(res, body);
  if (!discurso) return;

  // Os textos marcados com "Leia" nas fontes da matéria e os que o orador escolheu ler além dos previstos.
  const materia = textosBiblicosDeTesouros(discurso);
  const extras = await textosExtrasDoPedido(body);
  const leiaDaMateria = await referenciasDaBiblia(materia.leia);

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...materia.leia, ...referenciasDeTesouros(discurso)], 16);
    } catch (e) {
      console.error("Tesouros: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso de ${discurso.minutos} minutos de Tesouros da Palavra de Deus desta semana.\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDosTesouros(discurso, versiculos) +
    blocoDeTextosMarcados(leiaDaMateria, P) +
    blocoDeTextosEscolhidos(extras, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaTesouros, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaTesouros, tarefa: "tesouros" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    // Texto limpo e dentro dos limites; a fonte de cada ponto vem da apostila (não da IA). O padrão do usuário é ler pelo menos dois
    // textos do discurso: se a IA indicar menos, o app avisa.
    const { esboco, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: discurso.titulo,
      minutosMax: 10,
      maxPontos: 5,
      maxArgumentos: 5,
      maxBlocosIntro: 5,
      maxBlocosConclusao: 5,
      fontesDoPonto: (i) => (discurso.pontos[i] ? discurso.pontos[i].citacoes.map((c) => c.citacao) : []),
      minLeituras: 2,
      // Nenhuma leitura pode faltar: as marcadas com Leia na matéria, as que o orador escolheu e, ao incluir textos, as que o esboço já tinha.
      leiturasObrigatorias: [...leiaDaMateria, ...extras.map((e) => e.referencia), ...(modo === "incluir" ? leiturasDoEsbocoAnterior(body.anteriores) : [])],
      motivoObrigatorias: "que a matéria marca com Leia, que você escolheu ou que o esboço já tinha",
    });
    const pontos = esboco.pontos;
    const completo = pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;

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
      avisos: completo ? avisos : [],
      textosBiblicos: await textosDaMateria(materia),
      memoriaUsada: ultimoMemoriaUsada,
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
    imagens: discurso.imagens || [],
    textosBiblicos: await textosDaMateria(textosBiblicosDoDiscursoCurto(discurso)),
  });
}

async function esbocoDoDiscursoCurto(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const discurso = await discursoCurtoDaSemana(res, body);
  if (!discurso) return;

  // Os textos marcados com "Leia" na matéria e os que o orador escolheu ler além dos previstos.
  const materia = textosBiblicosDoDiscursoCurto(discurso);
  const extras = await textosExtrasDoPedido(body);
  const leiaDaMateria = await referenciasDaBiblia(materia.leia);

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...materia.leia, ...referenciasDoDiscursoCurto(discurso)], 14);
    } catch (e) {
      console.error("Discurso curto: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso de ${discurso.minutos} minutos de Faça seu melhor no ministério desta semana.\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDoDiscursoCurto(discurso, versiculos) +
    blocoDeTextosMarcados(leiaDaMateria, P) +
    blocoDeTextosEscolhidos(extras, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaDiscursoCurto, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaDiscursoCurto, tarefa: "discurso" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    // O orador LÊ todos os textos indicados, no máximo 3 no discurso inteiro (a leitura que passar disso cai) e cada ponto deve ter
    // ao menos uma leitura (se faltar, o app avisa).
    const saida = resposta.parsed_output;
    const { esboco: corpo, avisos } = await corpoDoEsbocoLimpo(saida, {
      emoji: opcoes.emoji,
      temaPadrao: discurso.titulo,
      minutosMax: discurso.minutos,
      maxPontos: 2,
      maxArgumentos: 4,
      maxBlocosIntro: 4,
      maxBlocosConclusao: 4,
      fontesDoPonto: () => [],
      // O orador lê todos os textos indicados (até 3) e os marcados com Leia na matéria; os que ele escolher entram além disso.
      maxLeituras: Math.max(3, leiaDaMateria.length) + extras.length + (modo === "incluir" ? leiturasDoEsbocoAnterior(body.anteriores).length : 0),
      leituraEmCadaPonto: true,
      leiturasObrigatorias: [...leiaDaMateria, ...extras.map((e) => e.referencia), ...(modo === "incluir" ? leiturasDoEsbocoAnterior(body.anteriores) : [])],
      motivoObrigatorias: "que a matéria marca com Leia, que você escolheu ou que o esboço já tinha",
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
    const completo = pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;

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
        leituras: pontos.reduce((n, p) => n + p.desenvolvimento.filter((d) => d.leitura).length, 0),
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
      avisos: completo ? avisos : [],
      textosBiblicos: await textosDaMateria(materia),
      memoriaUsada: ultimoMemoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Discurso público (S-34, 30 min) ----------
// O esboço oficial do S-34 do tema escolhido foi importado pelo administrador (api/_s34.mjs, Blob privado). O servidor o manda à IA
// com o texto exato dos versículos; a IA elabora o esboço seguindo o prompt editável "discurso_publico". Só com o código do dirigente.

const SaidaDiscursoPublico = z.object(corpoDoEsboco());

// O esboço do S-34 do tema pedido ou a resposta de erro (e null).
async function esbocoDoTema(res, body) {
  const numero = Number(body.numero);
  if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
    erro(res, 400, "Escolha um tema.");
    return null;
  }
  if (!s34Configurado()) {
    erro(res, 503, "Os esboços do S-34 ainda não foram configurados no servidor.");
    return null;
  }
  let esboco = null;
  try {
    esboco = await lerEsboco(numero);
  } catch (e) {
    console.error("Discurso público: leitura do esboço falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler o esboço agora. Tente de novo em instantes.");
    return null;
  }
  if (!esboco) erro(res, 404, "Esse tema ainda não foi importado (Ajustes → Esboços de discursos públicos).");
  return esboco;
}

// Os temas já importados, para a pessoa escolher.
async function listarTemasPublicos(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  if (!s34Configurado()) return erro(res, 503, "Os esboços do S-34 ainda não foram configurados no servidor.");
  const { temas } = await lerIndice();
  return res.status(200).json({
    temas: Object.entries(temas)
      .map(([numero, t]) => ({ numero: Number(numero), titulo: t.titulo, revisao: t.revisao || "", minutos: t.minutos || 0 }))
      .sort((a, b) => a.numero - b.numero),
  });
}

// O que o app mostra ao carregar o tema: título, revisão, seções com os tempos e as leituras marcadas.
async function lerTemaPublico(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const esboco = await esbocoDoTema(res, body);
  if (!esboco) return;
  const { leituras } = referenciasDoPublico(esboco);
  return res.status(200).json({
    numero: esboco.numero,
    titulo: esboco.titulo,
    revisao: esboco.revisao || "",
    minutos: minutosDoEsboco(esboco),
    objetivo: esboco.notaAoOrador.slice(0, 240),
    secoes: esboco.secoes.map((s) => ({ titulo: s.titulo, minutos: s.minutos })),
    leituras,
    itens: esboco.secoes.reduce((n, s) => n + s.itens.length, 0),
    textosBiblicos: await textosDaMateria(textosBiblicosDoPublico(esboco)),
  });
}

// O esboço original do S-34 do tema (títulos, tempos, itens em níveis, destaques e notas), para o orador LER no próprio app ("Ver o esboço
// original" do card Discurso público). Sem IA; só com o código do dirigente; vem do armazenamento privado, não fica guardado no aparelho.
async function verEsbocoPublico(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const esboco = await esbocoDoTema(res, body);
  if (!esboco) return;
  return res.status(200).json({ esboco });
}

async function esbocoDoDiscursoPublico(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const tema = await esbocoDoTema(res, body);
  if (!tema) return;
  const { leituras: marcadas, citadas } = referenciasDoPublico(tema);
  const extras = await textosExtrasDoPedido(body); // os textos que o orador escolheu ler além dos marcados no S-34

  let versiculos = [];
  let permitidas = null; // as leituras marcadas, como a Bíblia as escreve (sem a Bíblia no servidor não dá para conferir)
  let aceitas = null;    // o que o servidor mantém: as de cima e, se o esboço marca poucas, os textos citados que a IA escolher
  // Os esboços mais antigos do S-34 (como o do tema 110, de 1995) citam os textos mas não marcam nenhum com "Leia": sem leituras o discurso sairia
  // sem nenhum texto lido. Quando as marcadas e as escolhidas pelo orador não chegam ao mínimo (limite "Textos lidos no discurso público"),
  // a IA escolhe as que faltam entre os textos citados no esboço.
  const minimoLeituras = P.limites.minLeiturasPublico || 0;
  const faltamLeituras = Math.max(0, minimoLeituras - new Set([...marcadas, ...extras.map((e) => e.referencia)]).size);
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...marcadas, ...citadas], 40);
      permitidas = [];
      for (const r of marcadas) permitidas.push((await leituraDaBiblia(r)).referencia);
      // Além dos marcados no S-34, só se lê o que o orador escolheu.
      permitidas = [...new Set([...permitidas, ...extras.map((e) => e.referencia)])];
      aceitas = permitidas;
      if (faltamLeituras > 0) {
        const candidatas = [];
        for (const r of citadas) candidatas.push((await leituraDaBiblia(r)).referencia);
        aceitas = [...new Set([...permitidas, ...candidatas])];
      }
    } catch (e) {
      console.error("Discurso público: versículos indisponíveis", e?.message);
      permitidas = null;
      aceitas = null;
    }
  }
  const aEscolher = faltamLeituras > 0
    ? `LEITURAS A ESCOLHER: o esboço do S-34 marca ${marcadas.length} texto(s) para ler${extras.length ? ` e o orador escolheu ${extras.length}` : ""}, e o discurso precisa ter pelo menos ${minimoLeituras} leituras. ` +
      `Escolha você mais ${faltamLeituras} (ou mais, se ajudar) dentre os textos CITADOS no esboço, cujo versículo vem em "TEXTO DOS VERSÍCULOS": os que mais reforçam cada ponto, de preferência curtos e espalhados pelos pontos, ` +
      `cada um no campo "leitura" do argumento a que se liga e uma só vez. Não leia nenhum texto que o esboço não cite. Não entregue o esboço com menos de ${minimoLeituras} leituras.\n\n`
    : "";

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso público de ${minutosDoEsboco(tema)} minutos, tema "${tema.titulo}" (esboço S-34 nº ${tema.numero}).\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDoDiscursoPublico(tema, versiculos) +
    (aEscolher ? "\n\n" + aEscolher.trimEnd() + "\n\n" : "") +
    blocoDeTextosEscolhidos(extras, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaDiscursoPublico, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaDiscursoPublico, tarefa: "publico" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    const { esboco, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: tema.titulo,
      minutosMax: 30,
      maxPontos: tema.secoes.length,
      maxArgumentos: 8,
      maxBlocosIntro: 4,
      maxBlocosConclusao: 4,
      // A linha "Fonte" de cada ponto traz as publicações que o esboço do S-34 cita naquela seção.
      fontesDoPonto: (i) => publicacoesDaSecao(tema.secoes[i]),
      leiturasPermitidas: aceitas,
      leiturasObrigatorias: permitidas,
      minLeituras: minimoLeituras || undefined,
      motivoObrigatorias: "que o esboço do S-34 marca ou que você escolheu",
    });
    // Os tempos são os do esboço do S-34 (um ponto por seção); a introdução e a conclusão cabem dentro deles.
    esboco.pontos.forEach((p, i) => {
      if (tema.secoes[i]) p.minutos = tema.secoes[i].minutos || 0;
    });
    esboco.introducao.minutos = 0;
    esboco.conclusao.minutos = 0;
    if (esboco.pontos.length !== tema.secoes.length) avisos.push(`A IA fez ${esboco.pontos.length} ponto(s) e o esboço do S-34 tem ${tema.secoes.length} seções. Use "Melhorar" para ajustar.`);
    const completo = esboco.pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;

    console.log(
      "Esboço do discurso público:",
      JSON.stringify({
        modelo: P.ia.modelo,
        tema: tema.numero,
        revisao: tema.revisao || null,
        secoes: tema.secoes.length,
        pontos: esboco.pontos.length,
        leiturasMarcadas: marcadas.length,
        leiturasAEscolher: faltamLeituras,
        leituras: esboco.pontos.reduce((n, p) => n + p.desenvolvimento.filter((d) => d.leitura).length, 0),
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      semana: "Discurso público " + tema.numero,
      titulo: tema.titulo,
      url: null,
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      textosBiblicos: await textosDaMateria(textosBiblicosDoPublico(tema)),
      memoriaUsada: ultimoMemoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Outros esboços (tema livre: necessidades locais, eventos especiais) ----------
// O orador informa o tema, a ideia, o tempo e, se quiser, os textos que quer ler e a matéria: um texto colado e/ou artigos do wol.jw.org
// (os endereços colados ou os que ele escolheu na pesquisa do tema na biblioteca). Nada fica no servidor: tudo vem no pedido.
// Três tarefas: outros-pesquisar (a pesquisa na biblioteca), outros-ler (lê a matéria e lista os textos bíblicos) e outros (o esboço).

const SaidaOutros = z.object(corpoDoEsboco());
const MAX_ARTIGOS_OUTROS = 5;
const MAX_CARACTERES_ARTIGO_OUTROS = 8000;
const MAX_MATERIA_OUTROS = 12000;

// Texto de várias linhas (a ideia, a matéria): quebras de linha preservadas, sem excesso de linhas em branco.
function textoLongo(valor, max) {
  return typeof valor === "string"
    ? valor.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
    : "";
}

// Os endereços do wol.jw.org do pedido (uma lista, ou um texto com um endereço por linha), sem repetir.
function enderecosDoOutros(valor) {
  const brutos = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(/\s+/) : [];
  return [...new Set(brutos.filter((x) => typeof x === "string").map((x) => limparLinha(x, 300)).filter(Boolean))].slice(0, MAX_ARTIGOS_OUTROS);
}

// O esboço pronto que o orador importou no aparelho (no molde do S-34), conferido e reescrito só com os campos conhecidos.
function esbocoBaseDoPedido(bruto) {
  if (!bruto || typeof bruto !== "object") return { esboco: null };
  const v = validarEsboco({ ...bruto, numero: 1 });
  return v.erro ? { erro: v.erro } : { esboco: v.esboco };
}

// O que o orador digitou no card, já limpo. Com esboço pronto importado, o tema (se vier em branco) é o dele e o tempo é a soma das seções.
function dadosDoOutros(body) {
  const minutos = Math.round(Number(body.minutos));
  const base = esbocoBaseDoPedido(body.esbocoBase);
  const doBase = base.esboco ? minutosDoEsboco(base.esboco) : 0;
  return {
    tema: limparLinha(body.tema, 200) || (base.esboco ? limparLinha(base.esboco.titulo, 200) : ""),
    ideia: textoLongo(body.ideia, 1500),
    ocasiao: limparLinha(body.ocasiao, 120),
    minutos: doBase >= 3 ? Math.min(60, doBase) : Number.isFinite(minutos) ? Math.max(3, Math.min(60, minutos)) : 30,
    textosLer: limparLinha(body.textosLer, 600),
    materia: textoLongo(body.materia, MAX_MATERIA_OUTROS),
    artigos: enderecosDoOutros(body.artigos),
    esbocoBase: base.esboco,
    erroBase: base.erro || "",
  };
}

// As leituras marcadas [Leia …] do esboço importado (como a Bíblia as escreve) e os textos que ele só cita.
async function referenciasDaBase(d) {
  if (!d.esbocoBase) return { marcadas: [], citadas: [] };
  const { leituras, citadas } = referenciasDoPublico(d.esbocoBase);
  const marcadas = fontesConfiguradas() ? [...new Set(await Promise.all(leituras.map(async (r) => (await leituraDaBiblia(r)).referencia)))] : leituras;
  return { marcadas, citadas };
}

// Lê os artigos do wol.jw.org: { artigos: [{ titulo, url, texto, referencias }], falhas: [endereço que não deu para ler] }.
async function artigosDoOutros(d) {
  const lidos = await Promise.all(
    d.artigos.map(async (endereco) => {
      try {
        const artigo = await lerArtigoDoWol(endereco, { timeoutMs: 8000, maxCaracteres: MAX_CARACTERES_ARTIGO_OUTROS });
        return artigo ? { endereco, artigo } : { endereco, artigo: null };
      } catch (e) {
        console.error("Outros esboços: artigo não lido", e?.message);
        return { endereco, artigo: null };
      }
    })
  );
  return { artigos: lidos.filter((l) => l.artigo).map((l) => l.artigo), falhas: lidos.filter((l) => !l.artigo).map((l) => l.endereco) };
}

// Os textos que o orador pediu para ler (o campo "Textos bíblicos que quer ler"), como a Bíblia os escreve.
async function textosPedidosDoOutros(d) {
  if (!d.textosLer) return [];
  if (!fontesConfiguradas()) return d.textosLer.split(/\s*[;\n]\s*/).filter(Boolean).slice(0, 15);
  return referenciasNoTexto(d.textosLer, { max: 15, livre: true });
}

// Quantos pontos o discurso comporta, conforme o tempo.
function pontosDoOutros(minutos) {
  return minutos <= 8 ? 2 : minutos <= 15 ? 3 : minutos <= 25 ? 4 : minutos <= 45 ? 6 : 7;
}

// Os minutos das partes (introdução, pontos e conclusão) passam a somar o tempo do discurso: proporcionais ao que a IA indicou
// (ou, sem indicação, 1 min na introdução e na conclusão e o resto igual entre os pontos), com arredondamento que fecha a soma.
// Nenhuma parte fica sem tempo quando o total comporta (a IA às vezes deixa um ponto em 0).
function acertarMinutos(esboco, total) {
  const partes = [esboco.introducao, ...esboco.pontos, esboco.conclusao];
  const soma = partes.reduce((n, p) => n + (p.minutos || 0), 0);
  if (soma === total) return;
  const pesos = soma > 0
    ? partes.map((p) => (total >= partes.length ? Math.max(1, p.minutos || 0) : p.minutos || 0))
    : partes.map((_, i) => (i === 0 || i === partes.length - 1 ? 1 : Math.max(1, (total - 2) / Math.max(1, esboco.pontos.length))));
  const somaPesos = pesos.reduce((n, p) => n + p, 0);
  const exatos = pesos.map((p) => (p * total) / somaPesos);
  const minutos = exatos.map(Math.floor);
  let sobra = total - minutos.reduce((n, m) => n + m, 0);
  exatos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => b.resto - a.resto)
    .forEach(({ i }) => {
      if (sobra-- > 0) minutos[i]++;
    });
  partes.forEach((p, i) => {
    p.minutos = minutos[i];
  });
}

// O resumo do que o servidor leu (o mesmo em "outros-ler" e depois da elaboração do esboço), para a tela.
async function resumoDoOutros(d, { artigos, falhas, pedidos, daBase }) {
  const naMateria = await referenciasNoTexto(d.materia, { max: 40 });
  const base = d.esbocoBase ? { titulo: d.esbocoBase.titulo, minutos: minutosDoEsboco(d.esbocoBase), secoes: d.esbocoBase.secoes.length, leituras: daBase.marcadas } : null;
  return {
    semana: "",
    titulo: d.tema || "Matéria do discurso",
    url: null,
    minutos: d.minutos,
    artigos: artigos.map((a) => ({ titulo: a.titulo, url: a.url, caracteres: a.texto.length })),
    falhas,
    pedidos,
    avisoTextos: d.textosLer && !pedidos.length ? `Não reconheci nenhum texto bíblico em "${d.textosLer}". Escreva como "Mateus 6:33; Salmo 37:10, 11".` : "",
    materia: d.materia.length,
    base,
    // A lista passa de 80 textos com facilidade (um artigo traz dezenas): os pedidos, os do esboço importado e os da matéria colada vêm antes,
    // para não ficarem de fora. Os marcados "Leia" do esboço importado entram sozinhos no esboço, como os pedidos.
    textosBiblicos: await textosDaMateria({
      todos: [...pedidos, ...daBase.marcadas, ...daBase.citadas, ...naMateria, ...artigos.flatMap((a) => a.referencias)],
      leia: [...pedidos, ...daBase.marcadas],
    }),
  };
}

// A pesquisa do tema na biblioteca online (wol.jw.org): os resultados vão para a tela e o orador escolhe os que a IA vai ler.
async function pesquisarOutros(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const consulta = limparLinha(body.consulta, 200) || limparLinha(body.tema, 200);
  if (consulta.length < 8) return erro(res, 400, "Escreva o tema (ou as palavras da pesquisa) com pelo menos 8 letras.");
  try {
    const resultados = await pesquisarNoWol(consulta, 9000, 8);
    return res.status(200).json({ consulta, resultados });
  } catch (e) {
    console.error("Outros esboços: pesquisa no wol falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui pesquisar na biblioteca agora. Tente de novo em instantes.");
  }
}

// Lê a matéria (os artigos do wol.jw.org e os textos bíblicos) e devolve o resumo com a lista de textos para marcar.
async function lerOutros(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const d = dadosDoOutros(body);
  if (d.erroBase) return erro(res, 400, "O esboço importado não serve: " + d.erroBase);
  if (!d.materia && !d.artigos.length && !d.textosLer && !d.esbocoBase) return erro(res, 400, "Informe a matéria (um texto colado, artigos do wol.jw.org ou um esboço importado) ou os textos bíblicos que quer ler.");
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });
  const [{ artigos, falhas }, pedidos, daBase] = await Promise.all([artigosDoOutros(d), textosPedidosDoOutros(d), referenciasDaBase(d)]);
  return res.status(200).json(await resumoDoOutros(d, { artigos, falhas, pedidos, daBase }));
}

// A mensagem dos dados do orador (a ordem e os rótulos estão na descrição da montagem, em _prompts.mjs). "pedidos" são todos os textos que a
// IA lê: os que o orador pediu e os marcados "Leia" do esboço importado.
function textoDoOutros(d, { pedidos, sugeridas, artigos, versiculos }) {
  const partes = [`TEMA DO DISCURSO: ${d.tema}`, `IDEIA DO DISCURSO: ${d.ideia || "o orador não informou; use o tema."}`];
  if (d.ocasiao) partes.push(`OCASIÃO: ${d.ocasiao}`);
  partes.push(`TEMPO TOTAL: ${d.minutos} minutos`);
  partes.push(
    "TEXTOS QUE O ORADOR PEDIU PARA LER: " +
      (pedidos.length ? pedidos.join("; ") + "." : sugeridas ? `nenhum; escolha você até ${sugeridas} textos que reforcem os pontos.` : "nenhum além dos escolhidos pelo orador (indicados abaixo).")
  );
  if (d.esbocoBase) partes.push(textoDoEsbocoImportado(d.esbocoBase));
  if (d.materia) partes.push("MATÉRIA COLADA PELO ORADOR:\n" + d.materia);
  if (artigos.length) {
    partes.push("ARTIGOS DO WOL.JW.ORG LIDOS PELO SERVIDOR:\n" + artigos.map((a, i) => `[${i + 1}] ${a.titulo || "(sem título)"}\n${a.texto}`).join("\n\n"));
  }
  if (versiculos.length) partes.push("TEXTO DOS VERSÍCULOS:\n" + versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n"));
  return partes.join("\n\n");
}

async function esbocoDeOutros(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const d = dadosDoOutros(body);
  if (d.erroBase) return erro(res, 400, "O esboço importado não serve: " + d.erroBase);
  if (d.tema.length < 4) return erro(res, 400, "Escreva o tema do discurso.");
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const [{ artigos, falhas }, pedidos, extras, daBase] = await Promise.all([artigosDoOutros(d), textosPedidosDoOutros(d), textosExtrasDoPedido(body), referenciasDaBase(d)]);
  const naMateria = await referenciasNoTexto(d.materia, { max: 40 });
  const doEsbocoAnterior = modo ? leiturasDoEsbocoAnterior(body.anteriores) : [];
  const base = d.esbocoBase;

  // Os textos lidos: os que o orador pediu, os marcados "Leia" do esboço importado e os que ele marcou na lista; sem nenhum deles, a IA
  // escolhe poucos (conforme o tempo).
  const aLer = [...new Set([...pedidos, ...daBase.marcadas])];
  const escolhidos = [...new Set([...aLer, ...extras.map((e) => e.referencia), ...doEsbocoAnterior])];
  const sugeridas = aLer.length + extras.length ? 0 : Math.max(2, Math.min(8, Math.round(d.minutos / 6)));
  const maxLeituras = sugeridas ? Math.max(escolhidos.length, sugeridas) : escolhidos.length;

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...aLer, ...extras.map((e) => e.referencia), ...daBase.citadas, ...naMateria, ...artigos.flatMap((a) => a.referencias)], base ? 40 : 30);
    } catch (e) {
      console.error("Outros esboços: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço de um discurso de ${d.minutos} minutos, tema "${d.tema}"${base ? ", seguindo de perto o esboço pronto importado pelo orador" : ""}.\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDoOutros(d, { pedidos: aLer, sugeridas, artigos, versiculos }) +
    blocoDeTextosEscolhidos(extras, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaOutros, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaOutros, tarefa: "outros" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    const { esboco: corpo, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: d.tema,
      minutosMax: d.minutos,
      // Com esboço importado, um ponto por seção dele (como no discurso público), com a linha "Fonte" das publicações que a seção cita.
      maxPontos: base ? base.secoes.length : pontosDoOutros(d.minutos),
      maxArgumentos: base ? 8 : 5,
      maxBlocosIntro: 4,
      maxBlocosConclusao: 4,
      fontesDoPonto: base ? (i) => publicacoesDaSecao(base.secoes[i]) : () => [],
      maxLeituras,
      // Havendo textos pedidos, marcados "Leia" ou escolhidos, só se lê o que o orador indicou (e o que o esboço anterior já lia).
      leiturasPermitidas: sugeridas || !fontesConfiguradas() ? null : escolhidos,
      leiturasObrigatorias: [...aLer, ...extras.map((e) => e.referencia), ...(modo === "incluir" ? doEsbocoAnterior : [])],
      motivoObrigatorias: "que você pediu, que o esboço importado marca, que você escolheu ou que o esboço já tinha",
    });
    // O tema é o que o orador digitou (ou o do esboço importado); as fontes são o esboço importado e os artigos do wol.jw.org que o servidor leu.
    const esboco = { ...corpo, tema: d.tema, fontes: [...(base ? ["Esboço importado: " + base.titulo] : []), ...artigos.map((a) => a.titulo).filter(Boolean)] };
    if (base) {
      // Os tempos são os das seções do esboço importado; a introdução e a conclusão cabem dentro deles.
      esboco.pontos.forEach((p, i) => {
        if (base.secoes[i]) p.minutos = base.secoes[i].minutos || 0;
      });
      esboco.introducao.minutos = 0;
      esboco.conclusao.minutos = 0;
      if (esboco.pontos.length !== base.secoes.length) avisos.push(`A IA fez ${esboco.pontos.length} ponto(s) e o esboço importado tem ${base.secoes.length} seções. Use "Melhorar" para ajustar.`);
    } else {
      acertarMinutos(esboco, d.minutos);
    }
    const completo = esboco.pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;
    if (falhas.length) avisos.push(`Não consegui ler ${falhas.length === 1 ? "um artigo" : falhas.length + " artigos"} do wol.jw.org; o esboço não os usa.`);

    console.log(
      "Esboço de outro discurso:",
      JSON.stringify({
        modelo: P.ia.modelo,
        minutos: d.minutos,
        materia: d.materia.length,
        artigos: artigos.length,
        falhas: falhas.length,
        pedidos: pedidos.length,
        esbocoImportado: base ? { secoes: base.secoes.length, marcadas: daBase.marcadas.length } : null,
        extras: extras.length,
        sugeridas,
        pontos: esboco.pontos.length,
        leituras: esboco.pontos.reduce((n, p) => n + p.desenvolvimento.filter((x) => x.leitura).length, 0),
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      ...(await resumoDoOutros(d, { artigos, falhas, pedidos, daBase })),
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      memoriaUsada: ultimoMemoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// O texto exato (Tradução do Novo Mundo) de uma lista de textos bíblicos, para o app exportar um esboço para Word com os acentos certos
// (as letras em itálico do campo de texto não têm acento). Só com o código do dirigente; sem IA, sem custo.
async function textosDosVersiculos(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const referencias = (Array.isArray(body.referencias) ? body.referencias : [])
    .filter((r) => typeof r === "string")
    .map((r) => limparLinha(r, 80))
    .filter(Boolean)
    .slice(0, 40);
  if (!referencias.length || !fontesConfiguradas()) return res.status(200).json({ versiculos: [] });
  try {
    return res.status(200).json({ versiculos: await buscarVersiculos(referencias, 40) });
  } catch (e) {
    console.error("Versículos para exportar: falhou", e?.message);
    return erro(res, 502, "Não consegui buscar os versículos agora.");
  }
}

// ---------- Joias espirituais ----------
// O servidor lê a leitura da Bíblia da semana (capítulos com os versículos e os trechos das publicações do Índice das
// Publicações) e a seção "Joias espirituais" da apostila (api/_wol.mjs). A IA escreve até o limite de joias por capítulo
// (P.limites.maxJoiasPorCapitulo, 2 por padrão) e a resposta à pergunta da apostila, no estilo das respostas do estudo.

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

// Versículos de uma referência do mesmo capítulo: "Jeremias 45:5" -> { capitulo: 45, versos: Set {5} }; "45:4, 6-7" -> {4, 6, 7}; null se não houver "cap:vers".
function versosDe(ref) {
  const m = String(ref || "").match(/(\d+):([\d,\s–-]+)/);
  if (!m) return null;
  const versos = new Set();
  for (const parte of m[2].split(",")) {
    const [de, ate] = parte.split(/[–-]/).map((n) => Number(n.trim()));
    for (let v = de; v <= (ate || de) && v - de < 200; v++) versos.add(v);
  }
  return { capitulo: Number(m[1]), versos };
}

// "Jeremias 45" + [4, 5] -> "Jeremias 45:4, 5"; [4, 5, 6] -> "Jeremias 45:4-6" (como as publicações escrevem).
function escreverVersos(nomeDoCapitulo, versos) {
  const grupos = [];
  for (const v of versos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && v === ultimo[1] + 1) ultimo[1] = v;
    else grupos.push([v, v]);
  }
  return `${nomeDoCapitulo}:` + grupos.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}-${b}`)).join(", ");
}

const MAX_VERSOS_DA_JOIA = 6;
const MAX_CHARS_VERSICULO_DA_JOIA = 1200;

// REGRA FIXA (pedido do usuário): toda joia da leitura mostra, ANTES do comentário, o texto bíblico completo a que ele se refere. O texto nunca
// vem da IA: são os versículos de "referencia" lidos do capítulo da própria leitura (wol.jw.org, o mesmo texto que a IA recebeu) ou, se não
// estiverem lá, da Bíblia do servidor. Devolve { referencia, texto } (a referência escrita com os versículos que couberam) ou null.
async function versiculoDaJoia(capitulo, referencia) {
  const alvo = versosDe(referencia);
  if (capitulo && alvo && alvo.capitulo === capitulo.capitulo) {
    const doCapitulo = new Map(capitulo.versiculos.map((v) => [v.verso, v.texto]));
    const incluidos = [];
    let texto = "";
    let textoNumerado = ""; // o mesmo texto com o começo de cada versículo, do segundo em diante, marcado por [n]
    for (const n of [...alvo.versos].sort((a, b) => a - b).slice(0, MAX_VERSOS_DA_JOIA)) {
      const t = doCapitulo.get(n);
      if (!t) continue;
      if (texto && texto.length + 1 + t.length > MAX_CHARS_VERSICULO_DA_JOIA) break;
      textoNumerado = texto ? `${textoNumerado} [${n}] ${t}` : t;
      texto = texto ? `${texto} ${t}` : t;
      incluidos.push(n);
    }
    if (texto) return { referencia: escreverVersos(capitulo.nome, incluidos), texto: textoNumerado };
  }
  if (fontesConfiguradas()) {
    const [achado] = await buscarVersiculos([referencia], 1, { numerado: true }).catch(() => []);
    if (achado) return { referencia: achado.referencia, texto: achado.textoNumerado };
  }
  return null;
}

async function leituraJoias(res, body) {
  if (!process.env.CODIGO_ESTUDO) {
    erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
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

// Todas as imagens da apostila Vida e Ministério da semana (descrição e legenda), mesmo as de partes que o app não trata. Só lê o wol.jw.org.
async function lerImagensDaApostilaSemana(res, body) {
  const autorizado = codigoValido(body.codigo) || dirigenteValido(body.codigoDirigente);
  if (!autorizado) return recusarAcesso(res, body);
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) return erro(res, 400, "Semana inválida.");
  let apostila = null;
  try {
    apostila = await lerImagensDaApostila(url);
  } catch (e) {
    console.error("Imagens da apostila: leitura falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui ler a apostila no wol.jw.org agora. Tente de novo em instantes.");
  }
  if (!apostila) return erro(res, 404, "Não encontrei a apostila dessa semana.");
  return res.status(200).json({ semana: apostila.semana, url: apostila.url, imagens: apostila.imagens });
}

async function responderJoias(res, body, P) {
  const comPergunta = body.pergunta !== false;
  const comLeitura = body.leitura !== false;
  if (!comPergunta && !comLeitura) return erro(res, 400, "Marque a pergunta da apostila ou as joias da leitura.");
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  // O texto bíblico de cada joia é copiado da Bíblia pelo servidor a cada pedido: não precisa ir de volta à IA nas respostas anteriores.
  const semVersiculos = (a) => (a && Array.isArray(a.itens) ? { ...a, itens: a.itens.map((i) => (i && typeof i === "object" ? { ...i, versiculo: undefined } : i)) } : a);
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(semVersiculos(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();

  const joias = await leituraJoias(res, body);
  if (!joias) return;
  const pergunta = comPergunta && joias.pergunta;
  if (!pergunta && !comLeitura) return erro(res, 400, "A apostila dessa semana não tem a pergunta das joias espirituais.");

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    `\n\nPEDIDO: pergunta da apostila ${pergunta ? "ATIVA" : "INATIVA"}; joias da leitura ${comLeitura ? `ATIVAS (no máximo ${P.limites.maxJoiasPorCapitulo} por capítulo)` : "INATIVAS"}.\n\n` +
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
      { schema: SaidaJoias, tarefa: "joias" }
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
    // No máximo P.limites.maxJoiasPorCapitulo joias por capítulo, na ordem da leitura, e nenhuma sobre o versículo da pergunta da apostila (ela já
    // tem a resposta própria). Os capítulos da leitura são de um livro só, então basta comparar capítulo e versículo.
    const chave = (t) => chaveDeBusca(t).replace(/\s+/g, "");
    const daPergunta = joias.pergunta ? versosDe(joias.pergunta.referencias[0]) : null;
    const repetePergunta = (ref) => {
      const v = versosDe(ref);
      return Boolean(daPergunta && v && v.capitulo === daPergunta.capitulo && [...v.versos].some((n) => daPergunta.versos.has(n)));
    };
    const porCapitulo = new Map(joias.capitulos.map((c) => [chave(c.nome), []]));
    for (const j of comLeitura ? saida.joias : []) {
      const lista = porCapitulo.get(chave(j.capitulo)) || [...porCapitulo.values()].find((l, i) => chave(j.referencia).startsWith(chave(joias.capitulos[i].nome)));
      if (!lista || lista.length >= P.limites.maxJoiasPorCapitulo || repetePergunta(j.referencia)) continue;
      const item = montarItem({ ...j, paragrafos: limparLinha(limparTrecho(j.referencia), 20), referencias: [] }, opcoes, permitidos, P.limites, sep);
      if (!item.resposta) continue;
      const cap = joias.capitulos.find((c) => porCapitulo.get(chave(c.nome)) === lista);
      // O texto bíblico da joia vai inteiro acima do comentário (o app o escreve); não se repete depois dele entre os "outros textos".
      const versiculo = await versiculoDaJoia(cap, j.referencia);
      if (versiculo) {
        const meus = versosDe(versiculo.referencia);
        item.relevantes = item.relevantes.filter((r) => {
          const v = versosDe(r);
          return !(meus && v && v.capitulo === meus.capitulo && [...v.versos].every((n) => meus.versos.has(n)));
        });
      }
      lista.push({ ...item, capitulo: cap.nome, versiculo });
    }
    const itensJoias = [...porCapitulo.values()].flat();

    console.log(
      "Joias espirituais:",
      JSON.stringify({
        modelo: P.ia.modelo,
        leitura: joias.leitura,
        pergunta: Boolean(itemPergunta),
        joias: itensJoias.map((j) => j.paragrafos),
        comTextoBiblico: itensJoias.filter((j) => j.versiculo).length,
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

    const memoriaUsada = ultimoMemoriaUsada;
    const finais = await finalizarItens([...(itemPergunta ? [itemPergunta] : []), ...itensJoias], opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Joias espirituais (tempo):", JSON.stringify({ total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));
    return res.status(200).json({
      semana: joias.semana,
      leitura: joias.leitura,
      url: joias.url,
      erro: finais.length ? null : "A IA não preparou as joias. Tente de novo.",
      pergunta: itemPergunta ? finais[0] : null,
      joias: itemPergunta ? finais.slice(1) : finais,
      memoriaUsada,
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
  if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "O código de pesquisa ainda não está configurado no servidor.");
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
      ? `\n\nCOMENTÁRIOS JÁ SUGERIDOS (outras palavras; só mude o enfoque se o texto do dia sustentar):\n${anteriores.map((a) => `- ${a}`).join("\n")}`
      : "");

  const inicio = Date.now();
  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 6000 /* o raciocínio também conta aqui */, system: P.sistemaTextoDiario, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaTextoDiario, tarefa: "texto-diario-comentarios" }
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
    const vozCupom = emitirCupomVoz({
      data: texto.data,
      textos: comentarios.flatMap((c) => [c.ponto, c.comentario]).filter(Boolean),
    });
    return res.status(200).json({
      data: texto.data,
      erro: comentarios.length ? null : "A IA não sugeriu comentários. Tente de novo.",
      comentarios,
      memoriaUsada: ultimoMemoriaUsada,
      vozCupom,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Lista de parágrafos do estudo ----------
// No caminho feliz o servidor lê o artigo no wol.jw.org e devolve os grupos (sem IA). Só se essa leitura falhar
// a IA lê a página (web_fetch, só wol.jw.org) e devolve os números. O app usa a lista para navegar entre os grupos.

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

function jsonDaListaLida(lido) {
  return {
    titulo: lido.titulo || null,
    artigo: lido.id,
    url: lido.url,
    grupos: lido.grupos.map((g) => g.rotulo).slice(0, 40),
    perguntas: lido.grupos.map((g) => g.pergunta || "").slice(0, 40), // alinhadas com "grupos": o app mostra a do parágrafo escolhido
    imagens: lido.grupos.map((g) => (g.imagens || []).map((i) => ({ descricao: i.descricao, legenda: i.legenda }))).slice(0, 40),
    recapitulacao: lido.recapitulacao.length > 0,
    erro: null,
  };
}

// Tenta a leitura direta. Devolve true se já respondeu (sucesso ou URL inválida). false = precisa da IA.
async function tentarListaNoSite(res, body) {
  if (!process.env.CODIGO_ESTUDO) {
    erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
    return true;
  }
  if (!codigoValido(body.codigo) && !dirigenteValido(body.codigoDirigente)) {
    recusarAcesso(res, body);
    return true;
  }
  const url = urlDoEstudo(body);
  if (!url) {
    erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");
    return true;
  }
  const inicio = Date.now();
  try {
    const lido = await lerEstudoDireto(url);
    if (lido) {
      console.log("Estudo-lista (lido no site):", JSON.stringify({ grupos: lido.grupos.length, recapitulacao: lido.recapitulacao.length, segundos: Math.round((Date.now() - inicio) / 100) / 10 }));
      res.status(200).json(jsonDaListaLida(lido));
      return true;
    }
  } catch (e) {
    console.error("Estudo-lista: leitura direta falhou", e?.name, e?.message);
  }
  return false;
}

async function listarParagrafos(res, body, P) {
  if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
  if (!codigoValido(body.codigo) && !dirigenteValido(body.codigoDirigente)) return recusarAcesso(res, body);

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

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

// ---------- Tela Backup: caixas "Sua resposta" de documentos do wol.jw.org ----------
// O navegador manda só os números dos documentos (nunca o conteúdo do backup); o servidor lê as páginas no wol.jw.org e devolve o
// título, a publicação/edição e, de cada caixa de resposta, o id (TextTag), o número do parágrafo e a pergunta. Não usa a IA.
// Vale o código de pesquisa (ou o do dirigente) e tem limite próprio, para não gastar os pedidos à IA.
const acessosBackup = new Map();
function excedeuLimiteBackup(ip) {
  const agora = Date.now();
  const lista = (acessosBackup.get(ip) || []).filter((t) => agora - t < 60 * 60 * 1000);
  if (lista.length >= 60) {
    acessosBackup.set(ip, lista);
    return true;
  }
  lista.push(agora);
  acessosBackup.set(ip, lista);
  if (acessosBackup.size > 5000) acessosBackup.clear();
  return false;
}

async function lerCamposDosDocumentos(req, res) {
  const body = req.body || {};
  if (!(codigoValido(body.codigo) || dirigenteValido(body.codigoDirigente))) return recusarAcesso(res, body);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
  const ids = [...new Set((Array.isArray(body.documentos) ? body.documentos : []).map((d) => String(d).trim()).filter((d) => /^\d{6,12}$/.test(d)))].slice(0, 10);
  if (!ids.length) return erro(res, 400, "Nenhum documento válido.");
  const documentos = {};
  const falhas = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        documentos[id] = await lerCamposDoDocumento(id);
      } catch (e) {
        console.error("Backup: documento não lido", id, e?.name, e?.message);
        falhas.push(id);
      }
    })
  );
  return res.status(200).json({ documentos, falhas });
}

// Em que semana cada artigo de estudo (A Sentinela) é estudado: o app manda só os números dos documentos e a edição de cada um.
async function lerSemanasDosDocumentos(req, res) {
  const body = req.body || {};
  if (!(codigoValido(body.codigo) || dirigenteValido(body.codigoDirigente))) return recusarAcesso(res, body);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
  const vistos = new Set();
  const documentos = (Array.isArray(body.documentos) ? body.documentos : [])
    .map((d) => ({ id: String(d && d.id).trim(), edicao: Number(d && d.edicao) }))
    .filter((d) => /^\d{6,12}$/.test(d.id) && Number.isInteger(d.edicao) && d.edicao >= 20220100 && d.edicao <= 20991200 && Math.floor(d.edicao / 100) % 100 >= 1 && Math.floor(d.edicao / 100) % 100 <= 12)
    .filter((d) => (vistos.has(d.id) ? false : vistos.add(d.id)))
    .slice(0, 40);
  if (!documentos.length) return res.status(200).json({ semanas: {} });
  try {
    return res.status(200).json({ semanas: await semanasDosEstudos(documentos) });
  } catch (e) {
    console.error("Backup: semanas de estudo não lidas", e?.name, e?.message);
    return erro(res, 502, "Não consegui consultar as semanas agora. Tente de novo em instantes.");
  }
}

// As publicações de uma semana (o artigo de estudo de A Sentinela e a apostila Vida e Ministério), para criar respostas em documentos que
// ainda não estão no backup.
async function lerPublicacoesDaSemana(req, res) {
  const body = req.body || {};
  if (!(codigoValido(body.codigo) || dirigenteValido(body.codigoDirigente))) return recusarAcesso(res, body);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
  const ano = Number(body.ano);
  const semana = Number(body.semana);
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100 || !Number.isInteger(semana) || semana < 1 || semana > 53) return erro(res, 400, "Semana inválida.");
  try {
    return res.status(200).json(await lerReuniaoDaSemana(ano, semana));
  } catch (e) {
    console.error("Backup: semana não lida", ano, semana, e?.name, e?.message);
    return erro(res, 502, "Não consegui ler essa semana no wol.jw.org agora. Tente de novo em instantes.");
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

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const tarefa = body.tarefa;
  const ip = ipDoPedido(req);

  if (typeof tarefa === "string" && /^backup-/.test(tarefa) && !exigirAcesso(res, body)) return;
  if (tarefa === "backup-campos") return lerCamposDosDocumentos(req, res);
  if (tarefa === "backup-semanas") return lerSemanasDosDocumentos(req, res);
  if (tarefa === "backup-semana") return lerPublicacoesDaSemana(req, res);

  // Leituras (wol.jw.org, S-34, Bíblia): código de acesso e o limite de consultas, sem chave nem cota da IA.
  if (TAREFAS_SEM_IA.has(tarefa)) {
    if (!exigirAcesso(res, body)) return;
    if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
    if (tarefa === "ebc-ler") return lerEbc(res, body);
    if (tarefa === "tesouros-ler") return lerTesourosDaSemana(res, body);
    if (tarefa === "publico-lista") return listarTemasPublicos(res, body);
    if (tarefa === "publico-ler") return lerTemaPublico(res, body);
    if (tarefa === "publico-esboco") return verEsbocoPublico(res, body);
    if (tarefa === "versiculos") return textosDosVersiculos(res, body);
    if (tarefa === "outros-pesquisar") return pesquisarOutros(res, body);
    if (tarefa === "outros-ler") return lerOutros(res, body);
    if (tarefa === "discurso-ler") return lerDiscursoCurtoDaSemana(res, body);
    if (tarefa === "joias-ler") return lerJoiasDaSemana(res, body);
    if (tarefa === "apostila-imagens") return lerImagensDaApostilaSemana(res, body);
  }

  // Lista da Sentinela: leitura no site primeiro (sem IA). Só se falhar é que a IA lê a página.
  if (tarefa === "estudo-lista") {
    if (!exigirAcesso(res, body)) return;
    if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
    if (await tentarListaNoSite(res, body)) return;
    if (!process.env.ANTHROPIC_API_KEY) {
      return erro(res, 503, "Não consegui ler o artigo no wol.jw.org agora, e o recurso de IA ainda não está configurado para tentar de outro jeito.");
    }
    const Plista = await carregarPromptsEIa();
    if (excedeuLimite(ip, Plista.limites.limitePorHora)) {
      return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
    }
    return listarParagrafos(res, body, Plista);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return erro(res, 503, "Recurso de IA ainda não configurado no servidor.");
  }

  // Prompts e limites atuais (padrão do código + edições do administrador, guardadas no Global Config).
  // Mais o modelo e o esforço da IA escolhidos pelo administrador (P.ia).
  const P = await carregarPromptsEIa();

  if (excedeuLimite(ip, P.limites.limitePorHora)) {
    return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
  }

  if (!exigirAcesso(res, body)) return;
  if (tarefa === "estudo") return responderEstudo(res, body, P);
  if (tarefa === "estudo-perguntas") return sugerirPerguntas(res, body, P);
  if (tarefa === "texto-diario-comentarios") return comentariosDoTextoDiario(res, body, P);
  if (tarefa === "ebc") return responderEbc(res, body, P);
  if (tarefa === "ebc-dirigente") return perguntasEbcDirigente(res, body, P);
  if (tarefa === "tesouros") return esbocoDeTesouros(res, body, P);
  if (tarefa === "publico") return esbocoDoDiscursoPublico(res, body, P);
  if (tarefa === "outros") return esbocoDeOutros(res, body, P);
  if (tarefa === "discurso") return esbocoDoDiscursoCurto(res, body, P);
  if (tarefa === "joias") return responderJoias(res, body, P);

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
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: opcoes.consultarBiblia, perspicaz: opcoes.consultarPerspicaz });

  try {
    const client = new Anthropic({ maxRetries: 1, timeout: tempoIa(P, 60_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: opcoes.intensidade === "muitas" ? 10000 : 6000, system: P.sistemaFormatacao, messages: [{ role: "user", content: mensagem }] },
      { schema: Saida, semPensar: true, tarefa: "formatar" }
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
    const memoriaUsada = ultimoMemoriaUsada;
    if (consultaPedida(opcoes)) await completarFontes([fonte], opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    const textos = fonte.textos || [];
    const perspicaz = fonte.perspicaz || null;

    return res.status(200).json({ resumo, sugestoes, textos, perspicaz, memoriaUsada });
  } catch (e) {
    return tratarErro(e, res);
  }
}
