// Adoração em Família por quadros (6.12.71): as funções PURAS da geração por quadros (sem rede, sem IA e sem arquivos), usadas por
// sugerir-formatacao.mjs e conferidas em ferramentas/testar-adoracao-quadros.mjs.
// A geração tem duas fases: o PLANO (uma chamada curta: título, objetivo, assunto e o ângulo de cada quadro ligado ao tema) e os
// QUADROS (uma chamada por quadro, até 4 ao mesmo tempo, feitas pelo app). Aqui ficam a escolha dos candidatos que vão à IA (princípios
// do índice e artigos do catálogo dos Ensinos Bíblicos), a leitura das escolhas da IA ("PR3", "[A2]", "L1") e as constantes da leitura.

import { QUADROS_FAMILIA } from "./_familiaQuadros.mjs";

// Um artigo do catálogo só vale como leitura se o wol devolver pelo menos isto de texto (o teste real da Fase 3 achou páginas com 74 a
// 105 caracteres, como as de "Teve um Projeto?").
export const MIN_CARACTERES_ARTIGO = 600;
// Quantos quadros o app pede ao mesmo tempo.
export const MAX_QUADROS_EM_PARALELO = 4;
// Os quadros que têm geração própria (as orações não passam pela IA: o app as põe no lugar).
export const QUADROS_GERADOS = Object.freeze(QUADROS_FAMILIA.filter((q) => q.minutos).map((q) => q.id));
// Os que já têm chamada especializada (6.12.71); os demais usam a chamada genérica até a 6.12.72.
export const QUADROS_ESPECIALIZADOS = Object.freeze(["abertura", "principio", "personagem", "jesus"]);

// Endereços do catálogo que o wol não tem (404) ou que não trazem texto para ler (vídeos, atividades, figuras, tabelas, "Teve um Projeto?").
export const URL_SEM_TEXTO_NO_WOL = /\/videos?\/|atividades-com-figuras|cartoes-biblicos|historias-biblicas-ilustradas|exercicios-biblicos|guias-de-estudo|tabelas|teve-um-projeto/i;

const PALAVRAS_COMUNS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sobre entre que se e ou mas como mais muito ao aos ela ele eles elas seu sua seus suas nao ja foi ser sao era tem ter isso este esta esse essa aquele quando onde qual quais nosso nossa nossos nossas voce voces familia".split(" ")
);

// Minúsculas, sem acentos e só letras e números (para comparar palavras).
export function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// As palavras que dizem do que o tema trata (sem as comuns), reduzidas aos 5 primeiros caracteres ("perdoar", "perdão" e "perdoando"
// viram "perdo"/"perda"…: basta para aproximar singular, plural e verbo).
export function palavrasDoTema(tema) {
  return [...new Set(normalizarTexto(tema).split(" ").filter((w) => w.length > 2 && !PALAVRAS_COMUNS.has(w)).map((w) => w.slice(0, 5)))];
}

// Quantas palavras do tema aparecem no texto (cada uma conta uma vez).
export function pontuarPorTema(texto, palavras) {
  if (!palavras || !palavras.length) return 0;
  const doTexto = new Set(normalizarTexto(texto).split(" ").filter((w) => w.length > 2).map((w) => w.slice(0, 5)));
  return palavras.reduce((s, p) => s + (doTexto.has(p) ? 1 : 0), 0);
}

// Embaralha de um jeito reproduzível (a mesma semente dá a mesma ordem), para variar os candidatos sem perder os testes.
export function embaralhar(lista, semente = 1) {
  const copia = lista.slice();
  let s = Math.abs(Math.floor(Number(semente) || 1)) % 2147483647 || 1;
  for (let i = copia.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Os que mais combinam com o tema primeiro (os empates na ordem embaralhada); faltando, completa com outros, embaralhados.
function melhoresPorTema(lista, textoDe, tema, max, semente) {
  const palavras = palavrasDoTema(tema);
  const ordem = embaralhar(lista, semente);
  const pontuados = ordem.map((item, i) => ({ item, i, pontos: pontuarPorTema(textoDe(item), palavras) }));
  const comPontos = pontuados.filter((p) => p.pontos > 0).sort((a, b) => b.pontos - a.pontos || a.i - b.i);
  const escolhidos = comPontos.slice(0, max).map((p) => p.item);
  if (escolhidos.length < max) {
    const ja = new Set(escolhidos);
    for (const item of ordem) {
      if (escolhidos.length >= max) break;
      if (!ja.has(item)) escolhidos.push(item);
    }
  }
  return escolhidos;
}

// ---------- Princípio bíblico (índice do Princípios Bíblicos para a Vida Cristã, principios.json) ----------

// Ficam fora as entradas sem versículos nem relatos (só remetem a outro verbete) e as que começam com "Veja".
export function principiosCandidatos(entradas) {
  return (Array.isArray(entradas) ? entradas : []).filter(
    (e) =>
      e &&
      e.id &&
      e.verbete &&
      typeof e.texto === "string" &&
      ((Array.isArray(e.versiculos) && e.versiculos.length > 0) || (Array.isArray(e.relatos) && e.relatos.length > 0)) &&
      !/^veja\b/i.test(e.texto.trim())
  );
}

// Até "max" princípios para a IA escolher: os que combinam com o tema e o ângulo primeiro; os já usados (evitar: ids) ficam para o fim.
export function candidatosPrincipio(entradas, tema, { max = 25, semente = 1, evitar = [] } = {}) {
  const evitados = new Set(Array.isArray(evitar) ? evitar : []);
  const validos = principiosCandidatos(entradas);
  const novos = validos.filter((e) => !evitados.has(e.id));
  const base = novos.length >= max ? novos : validos;
  return melhoresPorTema(base, (e) => [e.verbete, e.subverbete, e.pergunta, e.texto].filter(Boolean).join(" "), tema, max, semente);
}

// As referências bíblicas da entrada: os versículos e as dos relatos, sem repetir (até max).
export function referenciasDoPrincipio(e, max = 4) {
  const refs = [...(Array.isArray(e?.versiculos) ? e.versiculos : []), ...(Array.isArray(e?.relatos) ? e.relatos.map((r) => r && r.referencia) : [])]
    .map((r) => String(r || "").trim())
    .filter(Boolean);
  return [...new Set(refs)].slice(0, max);
}

// A fonte da transcrição: "Princípios Bíblicos para a Vida Cristã, verbete "Adoração" · subverbete "…" · pág. 10".
export function fonteDoPrincipio(e) {
  return (
    `Princípios Bíblicos para a Vida Cristã, verbete "${String(e?.verbete || "").trim()}"` +
    (e?.subverbete ? ` · subverbete "${String(e.subverbete).trim()}"` : "") +
    (Number.isInteger(e?.pagina) ? ` · pág. ${e.pagina}` : "")
  );
}

// ---------- Artigos do catálogo dos Ensinos Bíblicos (ensinos_biblicos.json), lidos no wol pelo docId ----------

export function urlWolDoDocId(docId) {
  return /^\d{5,12}$/.test(String(docId || "")) ? `https://wol.jw.org/pt/wol/d/r5/lp-t/${docId}` : "";
}

// Só artigos com docId, sem vídeo e fora dos endereços sem texto no wol. ciencia: true = só os de A Ciência e a Bíblia.
export function artigosLegiveis(artigos, { ciencia = false } = {}) {
  return (Array.isArray(artigos) ? artigos : []).filter(
    (a) => a && a.tipo === "artigo" && !a.video && urlWolDoDocId(a.docId) && a.titulo && !URL_SEM_TEXTO_NO_WOL.test(String(a.url || "")) && (!ciencia || a.ciencia === true)
  );
}

export function candidatosArtigos(artigos, tema, { ciencia = false, max = 10, semente = 1, evitar = [] } = {}) {
  const evitados = new Set(Array.isArray(evitar) ? evitar : []);
  const validos = artigosLegiveis(artigos, { ciencia });
  const novos = validos.filter((a) => !evitados.has(a.id) && !evitados.has(String(a.docId)));
  const base = novos.length >= max ? novos : validos;
  return melhoresPorTema(base, (a) => [a.titulo, a.secao, ...(Array.isArray(a.caminho) ? a.caminho : []), a.trecho].filter(Boolean).join(" "), tema, max, semente);
}

// ---------- Escolhas da IA ----------

// "PR3", "[PR3]", "pr 3 - título" -> 2 (índice na lista, a partir de 0); o que não for do prefixo ou passar do tamanho -> -1.
export function idDaEscolha(valor, prefixo, tamanho = Infinity) {
  const p = String(prefixo || "").replace(/[^A-Za-z]/g, "");
  if (!p) return -1;
  const m = String(valor || "").trim().match(new RegExp(`^\\[?\\s*${p}\\s*(\\d{1,3})\\s*\\]?(?![\\p{L}\\d])`, "iu"));
  if (!m) return -1;
  const i = Number(m[1]) - 1;
  return i >= 0 && i < tamanho ? i : -1;
}

// Os índices das escolhas válidas, na ordem dada pela IA e sem repetir.
export function escolhasValidas(valores, prefixo, tamanho, max = 2) {
  const vistos = new Set();
  const saida = [];
  for (const v of Array.isArray(valores) ? valores : [valores]) {
    const i = idDaEscolha(v, prefixo, tamanho);
    if (i >= 0 && !vistos.has(i)) {
      vistos.add(i);
      saida.push(i);
      if (saida.length >= max) break;
    }
  }
  return saida;
}
