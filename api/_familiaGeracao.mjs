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
// Todos os quadros gerados têm chamada especializada (6.12.71: Abertura, Princípio, Personagem e Jesus; 6.12.72: os demais). A chamada
// genérica saiu na 6.12.72.
export const QUADROS_ESPECIALIZADOS = Object.freeze(["abertura", "video", "principio", "personagem", "jesus", "criador", "saiba_responder", "ame_ministerio", "jogo", "canticos"]);

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

// ---------- Leituras cortadas no fim de uma frase (6.12.72) ----------

// A palavra antes do ponto é abreviação? Com ponto no meio ("a.C", "i.e"), uma letra só ("J"), ou curta antes de um número ("Gên. 3:15",
// "pág. 10", "cap. 2", "vol. 1").
function ehAbreviacao(antes, depois) {
  const palavra = (String(antes).match(/(\S+)$/) || ["", ""])[1].replace(/^["“‘«(]+/, "");
  if (!palavra) return false;
  if (/\p{L}\.\p{L}/u.test(palavra)) return true;
  if (/^\p{Lu}$/u.test(palavra)) return true;
  if (/^\p{L}{1,5}$/u.test(palavra) && /^\s+\d/.test(depois)) return true;
  return /^(sr|sra|srta|dr|dra|prof|profa|p|pp|cf|ex|obs|séc)$/i.test(palavra);
}

// O texto até "max" caracteres, cortado no fim da última frase que coube (ponto, exclamação, interrogação ou reticências seguidos de espaço e
// de uma letra maiúscula, de aspas ou do fim). Sem frase que caiba (ou só uma muito curta), corta no último espaço e põe "…".
export function cortarNoFimDaFrase(texto, max) {
  const t = String(texto || "").trim();
  if (!(max > 0) || t.length <= max) return t;
  const re = /[.!?…]["”’»)]*(?=\s+["“‘«(]?[\p{Lu}\d—–]|\s*$)/gu;
  let corte = -1;
  let m;
  while ((m = re.exec(t))) {
    const fim = m.index + m[0].length;
    if (fim > max) break;
    if (m[0][0] === "." && ehAbreviacao(t.slice(0, m.index), t.slice(fim))) continue;
    corte = fim;
  }
  if (corte >= Math.min(200, Math.floor(max * 0.4))) return t.slice(0, corte).trim();
  const espaco = t.lastIndexOf(" ", max - 1);
  return (espaco > 0 ? t.slice(0, espaco) : t.slice(0, max - 1)).replace(/[\s,;:—–-]+$/, "") + "…";
}

// ---------- Memória "evitar" (no aparelho) e o que cada quadro usou (6.12.72) ----------
// O app guarda, por categoria, o que as últimas programações usaram (uns 40 por categoria, os mais novos primeiro) e manda com o plano e com
// cada quadro; o servidor tira esses itens das listas (ou os põe por último) e os cita na mensagem como "EVITAR". Nada de dados pessoais:
// só assuntos escolhidos pela IA, nomes de personagens bíblicos, ids de princípios e artigos, perguntas, situações, números de cânticos,
// tipos de jogo e códigos de vídeo.

export const MAX_EVITAR_POR_CATEGORIA = 40;
export const MAX_CARACTERES_EVITAR = 120;
// 6.12.73: "leituras" (o trecho de livro lido na Abertura, pela chave "trecho:…") e "relatos" (as referências dos relatos bíblicos da Abertura).
export const CATEGORIAS_EVITAR = Object.freeze(["assuntos", "personagens", "principios", "jesus", "saiba", "ministerio", "criador", "artigos", "canticos", "jogos", "videos", "leituras", "relatos"]);

const listaCurta = (valor, max, maxChars = MAX_CARACTERES_EVITAR) => {
  const vistos = new Set();
  return (Array.isArray(valor) ? valor : [])
    .map((x) => (typeof x === "string" || typeof x === "number" ? String(x) : "").replace(/\s+/g, " ").trim().slice(0, maxChars))
    .filter((x) => {
      const k = normalizarTexto(x);
      return k && !vistos.has(k) && vistos.add(k);
    })
    .slice(0, max);
};

// { categoria: [textos] } conferido: só as categorias conhecidas, até 40 por categoria e 120 caracteres por item, sem repetir.
export function normalizarEvitar(valor) {
  const v = valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  const saida = {};
  for (const cat of CATEGORIAS_EVITAR) saida[cat] = listaCurta(v[cat], MAX_EVITAR_POR_CATEGORIA);
  return saida;
}

// O que já foi usado nos outros quadros da mesma noite (o app junta os "usados" de cada quadro pronto).
export function normalizarUsados(valor) {
  const v = valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  return {
    referencias: listaCurta(v.referencias, 60),
    versiculos: listaCurta(v.versiculos, 600, 60),
    personagens: listaCurta(v.personagens, 30),
    videos: listaCurta(v.videos, 30),
    canticos: listaCurta(v.canticos, 30),
  };
}

// "Lucas 15:11-14" -> ["lucas 15:11", …, "lucas 15:14"] (até max); "Rom. 5:12, 18" -> 2 chaves; o que não der para separar fica inteiro.
export function chavesDosVersiculos(ref, max = 40) {
  const t = String(ref || "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.+?)\s+(\d{1,3}):(.+)$/);
  if (!m) return t ? [normalizarTexto(t)] : [];
  const livro = normalizarTexto(m[1]);
  const cap = Number(m[2]);
  const chaves = [];
  for (const pedaco of m[3].split(/[,;]/)) {
    const r = pedaco.trim().match(/^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
    if (!r) {
      // "1–2:3" (passa para outro capítulo): fica o primeiro versículo.
      const so = pedaco.trim().match(/^(\d{1,3})/);
      if (so && chaves.length < max) chaves.push(`${livro} ${cap}:${Number(so[1])}`);
      break;
    }
    const ini = Number(r[1]);
    const fim = r[2] ? Math.max(ini, Number(r[2])) : ini;
    for (let v = ini; v <= fim && chaves.length < max; v++) chaves.push(`${livro} ${cap}:${v}`);
  }
  return chaves.length ? chaves : [normalizarTexto(t)];
}

// O código do vídeo (lank) no link do jw.org.
export function lankDoLink(link) {
  const m = String(link || "").match(/[?&]lank=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// O que a parte usou (textos bíblicos, personagem, vídeos e cânticos), para conferir a repetição com os outros quadros.
export function usadosDaParte(parte, memoria = {}) {
  const p = parte && typeof parte === "object" ? parte : {};
  const referencias = (Array.isArray(p.textos) ? p.textos : []).map((t) => String((t && t.referencia) || "").trim()).filter(Boolean);
  return normalizarUsados({
    referencias,
    versiculos: referencias.flatMap((r) => chavesDosVersiculos(r)),
    personagens: (memoria && memoria.personagens) || [],
    videos: (Array.isArray(p.videos) ? p.videos : []).map((v) => lankDoLink(v && v.link)).filter(Boolean),
    canticos: (Array.isArray(p.canticos) ? p.canticos : []).map((c) => String((c && c.numero) ?? "")).filter(Boolean),
  });
}

// As repetições, em frases curtas: o mesmo texto bíblico, personagem, vídeo ou cântico de outro quadro da noite (jaUsados), e o personagem,
// o vídeo ou o cântico das últimas semanas (evitar). [] = nada repetido.
export function repeticoesDaParte(usados, jaUsados, evitar) {
  const u = normalizarUsados(usados);
  const j = normalizarUsados(jaUsados);
  const e = normalizarEvitar(evitar);
  const conjunto = (l) => new Set(l.map(normalizarTexto));
  const saida = [];
  const versiculosUsados = new Set(j.versiculos);
  // 6.12.73: os relatos bíblicos das últimas semanas (memória "relatos") também contam como repetição.
  const versiculosRecentes = new Set(e.relatos.flatMap((r) => chavesDosVersiculos(r)));
  for (const ref of u.referencias) {
    const chaves = chavesDosVersiculos(ref);
    if (chaves.some((k) => versiculosUsados.has(k))) saida.push(`o texto ${ref} já está em outro quadro`);
    else if (chaves.some((k) => versiculosRecentes.has(k))) saida.push(`o texto ${ref} foi usado nas últimas semanas`);
  }
  const [jp, ep] = [conjunto(j.personagens), conjunto(e.personagens)];
  for (const nome of u.personagens) {
    const k = normalizarTexto(nome);
    if (jp.has(k)) saida.push(`o personagem ${nome} já está em outro quadro`);
    else if (ep.has(k)) saida.push(`o personagem ${nome} foi usado nas últimas semanas`);
  }
  const [jv, ev] = [new Set(j.videos), new Set(e.videos)];
  for (const lank of u.videos) {
    if (jv.has(lank)) saida.push("o vídeo já está em outro quadro");
    else if (ev.has(lank)) saida.push("o vídeo foi usado nas últimas semanas");
  }
  const [jc, ec] = [new Set(j.canticos), new Set(e.canticos)];
  for (const n of u.canticos) {
    if (jc.has(n)) saida.push(`o cântico ${n} já está nesta noite`);
    else if (ec.has(n)) saida.push(`o cântico ${n} foi usado nas últimas semanas`);
  }
  return [...new Set(saida)];
}

// ---------- Datas do Apêndice B da Bíblia de Estudo (jogo "Ordem e data dos acontecimentos", 6.12.72) ----------

const DATA_AC_DC = String.raw`\d{1,4}(?:\s*[-–]\s*\d{1,4})?\s*(?:a\.\s?C\.|d\.\s?C\.)`;
const resumirEvento = (texto) => {
  let s = String(texto || "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+[—–]\s+/)[0];
  s = s.replace(/\s*\([^)]*\d+:\d+[^)]*\)[\s\S]*$/, "");
  const p = s.search(/[.!?](?=\s+["“]?\p{Lu})/u);
  if (p > 20) s = s.slice(0, p);
  s = s.replace(/[\s.;,:]+$/, "").trim();
  return s.length > 160 ? s.slice(0, s.lastIndexOf(" ", 157)) + "…" : s;
};

// Os acontecimentos com data do Apêndice B: [{ data, evento }], na ordem do arquivo e sem repetir. Formatos: a data sozinha numa linha e o
// acontecimento na seguinte ("Depois de 4026 a.C.", "1914 d.C. ou um pouco depois", "Futuro"); "• 1513 a.C. Israelitas saem do Egito";
// "607 a.C. Rei Nabucodonosor destrói Jerusalém" (com o nome da potência do título de antes, quando falta o sujeito); "• Derramamento do
// espírito santo Pentecostes de 33 d.C." (a data no fim).
export function eventosDoApendiceB(texto) {
  const linhas = String(texto || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const eventos = [];
  const vistos = new Set();
  let titulo = "";
  const incluir = (data, evento) => {
    const d = String(data || "").replace(/\s+/g, " ").trim();
    const ev = resumirEvento(evento);
    if (!d || ev.length < 4) return;
    const k = normalizarTexto(`${d} ${ev}`);
    if (vistos.has(k)) return;
    vistos.add(k);
    eventos.push({ data: d, evento: ev });
  };
  const soData = new RegExp(`^((?:Depois de |Antes de |c\\.\\s*)?${DATA_AC_DC}(?: ou um pouco depois)?|Futuro)$`);
  const dataNoComeco = new RegExp(`^(•\\s*)?((?:c\\.\\s*)?${DATA_AC_DC})\\s+(.{4,})$`);
  const dataNoFim = new RegExp(`^•\\s*(.{4,}?)\\s+(?:de\\s+)?((?:c\\.\\s*)?${DATA_AC_DC})\\.?$`);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l) continue;
    if (/^=+/.test(l)) {
      titulo = "";
      continue;
    }
    let m;
    if ((m = l.match(soData))) {
      let prox = "";
      for (let k = i + 1; k < Math.min(linhas.length, i + 8) && !prox; k++) if (linhas[k] && !/^=+/.test(linhas[k])) prox = linhas[k];
      if (prox && !soData.test(prox)) incluir(m[1], prox);
      continue;
    }
    if ((m = l.match(dataNoComeco))) {
      const ev = m[3];
      incluir(m[2], !m[1] && titulo && !normalizarTexto(ev).includes(normalizarTexto(titulo)) ? `${titulo}: ${ev}` : ev);
      continue;
    }
    if ((m = l.match(dataNoFim))) {
      incluir(m[2], m[1]);
      continue;
    }
    if (l.length <= 40 && !/\d/.test(l) && !l.startsWith("•")) titulo = l;
  }
  return eventos;
}

// Um número para pôr as datas em ordem: a.C. negativo, d.C. positivo; "Depois de" um pouco depois; "Futuro" por último; NaN sem data.
export function valorDaData(data) {
  const t = String(data || "").trim();
  if (/^futuro$/i.test(t)) return 1e6;
  const m = t.match(/(\d{1,4})(?:\s*[-–]\s*\d{1,4})?\s*(a|d)\.\s?C\./i);
  if (!m) return NaN;
  const n = Number(m[1]);
  return (m[2].toLowerCase() === "a" ? -n : n) + (/depois/i.test(t) ? 0.5 : 0);
}

// As datas de um texto, normalizadas ("1077-1038 a.C.", "33 d.C.").
export function datasDoTexto(texto) {
  return [...String(texto || "").matchAll(/(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s*(a|d)\.\s?C\./gi)].map((m) => `${m[1]}${m[2] ? `-${m[2]}` : ""} ${m[3].toLowerCase()}.C.`);
}

// As datas aceitas num jogo: as do Apêndice B (as faixas valem inteiras e por cada ponta).
export function datasPermitidas(textoDoApendice) {
  const ok = new Set();
  for (const d of datasDoTexto(textoDoApendice)) {
    ok.add(d);
    const m = d.match(/^(\d+)-(\d+) (.\.C\.)$/);
    if (m) {
      ok.add(`${m[1]} ${m[3]}`);
      ok.add(`${m[2]} ${m[3]}`);
    }
  }
  return ok;
}

// Tira da lista o que traz alguma data fora do Apêndice B (permitidas vazio = nenhuma data aceita).
export function semDatasForaDoApendice(lista, textoDe, permitidas) {
  const ok = permitidas instanceof Set ? permitidas : new Set();
  return (Array.isArray(lista) ? lista : []).filter((item) => datasDoTexto(textoDe(item)).every((d) => ok.has(d)));
}

// Link para consultar um trecho de livro no wol.jw.org: a busca da frase exata das primeiras palavras (o trecho veio do livro guardado no
// servidor; o endereço do livro no wol não é conhecido).
// 6.12.73: sem as marcas "##" e "•"; usa a primeira linha com pelo menos 5 palavras (a frase não passa de um item da lista para o outro).
export function linkDeConsultaWol(trecho) {
  // As marcas no meio da linha ("## Título... • Item") separam parágrafos no wol: a frase da busca fica dentro de um só.
  const linhas = semMarcasDoTexto(String(trecho || "").replace(/(^|\s)#{1,6}\s+|\s+[•▪●◦‣]\s+/g, "\n"))
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const linha = linhas.find((l) => l.split(" ").length >= 5) || linhas[0] || "";
  const todas = linha
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8);
  // Para no fim da primeira frase quando ela já tem 5 palavras (a busca não atravessa para a frase seguinte).
  const fimDaFrase = todas.findIndex((p, i) => i >= 4 && /[.!?]$/.test(p) && !/\.\.\.$|…$/.test(p));
  const palavras = (fimDaFrase >= 0 ? todas.slice(0, fimDaFrase + 1) : todas)
    .join(" ")
    .replace(/[.,;:!?…—–-]+$/, "");
  return palavras ? `https://wol.jw.org/pt/wol/s/r5/lp-t?q=${encodeURIComponent(`"${palavras}"`)}&p=par&r=occ&st=a` : "";
}

// O tipo do jogo da noite: entre os aceitos pela família, de preferência um que não foi usado nas últimas semanas (evitar.jogos); sem as
// datas do Apêndice B, a "Ordem e data dos acontecimentos" fica de fora (se for o único aceito, vale o primeiro dos outros tipos).
export function tipoDoJogo(aceitos, todos, { semente = 1, evitar = [], comApendice = true } = {}) {
  const lista = (Array.isArray(aceitos) && aceitos.length ? aceitos : todos).filter((j) => comApendice || !/^ordem e data/i.test(j));
  const base = lista.length ? lista : (todos || []).filter((j) => !/^ordem e data/i.test(j));
  const usados = new Set((Array.isArray(evitar) ? evitar : []).map(normalizarTexto));
  const novos = base.filter((j) => !usados.has(normalizarTexto(j)));
  return embaralhar(novos.length ? novos : base, semente)[0] || "";
}

// ---------- Ajustes da 6.12.73 ----------

// A chave de um trecho de livro na memória "evitar" ("trecho:" + o começo do texto normalizado), para não ler o mesmo trecho de novo.
export function chaveDoTrecho(trecho) {
  const t = normalizarTexto(semMarcasDoTexto(typeof trecho === "string" ? trecho : (trecho && trecho.trecho) || ""));
  // .trim() depois do corte: a memória (listaCurta) tira o espaço do fim, e a chave tem de continuar igual.
  return t ? `trecho:${t.slice(0, 100).trim()}` : "";
}

// Tira as marcas de título ("## ") e de lista ("• ", "▪ ") que alguns livros guardados trazem; o texto continua o mesmo.
export function semMarcasDoTexto(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*[•▪●◦‣]\s*/, "")
        .replace(/(^|\s)#{1,6}\s+/g, "$1")
        .replace(/\s+[•▪●◦‣]\s+/g, " ")
    )
    .join("\n");
}

// Tira as marcas de figura das brochuras sobre a criação ("os ribossomos (5)", "(7)"): número de 1 ou 2 algarismos entre parênteses,
// sozinho, seguido de espaço, pontuação ou do fim. Referências como "(Salmo 139:14)" ficam.
export function semMarcasDeFigura(texto) {
  return String(texto || "")
    .replace(/(^|[ \t])\(\d{1,2}\)(?=[\s.,;:!?)]|$)/gm, "$1")
    // Os créditos das fotos ("[Créditos das fotos na página 25] …", até o fim da linha) e o quadradinho "◼" das revistas.
    .replace(/\[Cr[ée]ditos? d[ae]s? (?:fotos?|imagens?|ilustra[çc][õo]es?)[^\]]*\][^\n]*/gi, "")
    .replace(/[ \t]*[◼■][ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/^[ \t]+|[ \t]+$/gm, "");
}

// "9:40" -> 580; "1:02:03" -> 3723; "9 min 40 s" -> 580; o que não der para ler -> NaN.
export function duracaoEmSegundos(duracao) {
  const t = String(duracao || "").trim();
  let m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = t.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(?:(\d{1,3})\s*min)?\s*(?:(\d{1,2})\s*s)?$/i);
  if (m && (m[1] || m[2])) return Number(m[1] || 0) * 60 + Number(m[2] || 0);
  return NaN;
}

// Os vídeos do quadro cabem no tempo: com 2 vídeos, a soma das durações pode ir até os minutos do quadro mais a folga (2 minutos); se
// passar, fica só o primeiro. Duração desconhecida: a lista fica como veio.
export function videosQueCabem(lista, minutos, folga = 2) {
  const l = Array.isArray(lista) ? lista.filter(Boolean) : [];
  if (l.length < 2) return l;
  const segundos = l.map((v) => duracaoEmSegundos(v.duracao));
  if (segundos.some((s) => !Number.isFinite(s))) return l;
  const total = segundos.reduce((a, b) => a + b, 0);
  return total <= (Number(minutos) + folga) * 60 ? l : l.slice(0, 1);
}

// Os sentidos de um verbete do Perspicaz: [{ numero, texto }]. Os sentidos começam com "1. ", "2. "… no começo de uma linha ou depois
// de "]. " ou de um ponto (em sequência: 1, 2, 3…, seguidos de letra maiúscula). Sem "1." o verbete inteiro é um sentido só (numero 0).
export function sentidosDoVerbete(texto) {
  const t = String(texto || "").replace(/\r\n?/g, "\n");
  const marcas = [];
  let esperado = 1;
  for (const m of t.matchAll(/(^|\n|[\].)]\s+)(\d{1,2})\.\s+(?=["“]?\p{Lu})/gu)) {
    if (Number(m[2]) !== esperado) continue;
    marcas.push({ numero: esperado, inicio: m.index + m[1].length });
    esperado++;
  }
  if (marcas.length < 2) return t.trim() ? [{ numero: 0, texto: t.trim() }] : [];
  return marcas.map((m, i) => ({ numero: m.numero, texto: t.slice(m.inicio, i + 1 < marcas.length ? marcas[i + 1].inicio : t.length).trim() }));
}

const VERSOS_CITADOS = String.raw`\d{1,3}(?:\s*[-–]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)*`;
const versosDaCitacao = (texto) => {
  const versos = [];
  for (const pedaco of String(texto || "").split(",")) {
    const r = pedaco.trim().match(/^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
    if (!r) continue;
    const ini = Number(r[1]);
    const fim = r[2] ? Math.max(ini, Number(r[2])) : ini;
    for (let v = ini; v <= fim && v - ini < 200; v++) versos.push(v);
  }
  return versos;
};

// As referências bíblicas citadas num texto ("(2Sa 21:8)", "— 2Sa 9.", "(1Sa 25:2, 3; Jos 15:20, 55)", "2 Samuel 9:1-10"):
// [{ livro, capitulo, versos }] (versos [] quando só o capítulo foi citado). livroDe(token) devolve o nome do livro ou null.
export function referenciasCitadas(texto, livroDe) {
  const saida = [];
  if (typeof livroDe !== "function") return saida;
  const re = new RegExp(String.raw`((?:[1-3]\s?)?\p{Lu}\p{Ll}{0,14})\.?\s+(\d{1,3})(?![\p{L}\d])(?::(${VERSOS_CITADOS}))?((?:\s*;\s*\d{1,3}(?::${VERSOS_CITADOS})?(?![\p{L}\d:]))*)`, "gu");
  for (const m of String(texto || "").matchAll(re)) {
    const livro = livroDe(m[1]);
    if (!livro) continue;
    saida.push({ livro, capitulo: Number(m[2]), versos: versosDaCitacao(m[3]) });
    for (const c of String(m[4] || "").matchAll(new RegExp(String.raw`;\s*(\d{1,3})(?::(${VERSOS_CITADOS}))?`, "g"))) {
      saida.push({ livro, capitulo: Number(c[1]), versos: versosDaCitacao(c[2]) });
    }
  }
  return saida;
}

// O sentido do verbete que cita a passagem do personagem (o mesmo livro e capítulo; os versículos em comum valem mais): { numero, texto } ou
// null (nenhum sentido cita a passagem). Vários personagens têm o mesmo nome (MEFIBOSETE 1 e 2): assim a leitura fala do personagem certo.
export function sentidoQueCitaAPassagem(textoDoVerbete, referencia, livroDe) {
  const alvos = referenciasCitadas(referencia, livroDe);
  if (!alvos.length) return null;
  let melhor = null;
  for (const s of sentidosDoVerbete(textoDoVerbete)) {
    let pontos = 0;
    for (const c of referenciasCitadas(s.texto, livroDe)) {
      for (const a of alvos) {
        if (c.livro !== a.livro || c.capitulo !== a.capitulo) continue;
        const comuns = c.versos.filter((v) => a.versos.includes(v)).length;
        pontos += 1 + comuns;
      }
    }
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { numero: s.numero, texto: s.texto, pontos };
  }
  return melhor ? { numero: melhor.numero, texto: melhor.texto } : null;
}
