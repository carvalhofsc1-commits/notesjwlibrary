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
// 6.13.13: com a pergunta e a subentrada (tópico), para a fonte dizer exatamente de onde é: "… verbete “Conduta cristã” · “Que qualidades os
// cristãos devem ter?” › “Perseverar; não desistir” · pág. 31".
export function fonteDoPrincipio(e) {
  const aspas = (s) => `“${String(s).trim()}”`;
  const caminho = [e?.subverbete, e?.pergunta, e?.topico].filter((x) => x && String(x).trim()).map(aspas).join(" › ");
  return (
    `Princípios Bíblicos para a Vida Cristã, verbete ${aspas(e?.verbete || "")}` +
    (caminho ? ` · ${caminho}` : "") +
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

// 6.12.83: o título curto de um quadro ("Lições da vida de Jesus: <episódio>"): o texto até "max" caracteres, cortado no fim de uma palavra (sem
// deixar "e", "de"… pendurados) e com "…". Antes o corte era seco em 100 ou 160 caracteres e a lista do programa mostrava "…e ainda assim ens".
export const MAX_TITULO_DO_QUADRO = 70;
export function cortarNaPalavra(texto, max = MAX_TITULO_DO_QUADRO) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const espaco = t.lastIndexOf(" ", max - 1);
  const base = (espaco > max * 0.5 ? t.slice(0, espaco) : t.slice(0, max - 1))
    .replace(/[\s,;:—–-]+$/, "")
    .replace(/\s+(?:e|ou|de|da|do|das|dos|em|na|no|nas|nos|a|o|as|os|que|para|por|com|um|uma|ao|à|se|como|mas)$/i, "")
    .replace(/[\s,;:—–-]+$/, "");
  return `${base}…`;
}

// ---------- Memória "evitar" (no aparelho) e o que cada quadro usou (6.12.72) ----------
// O app guarda, por categoria, o que as últimas programações usaram (uns 40 por categoria, os mais novos primeiro) e manda com o plano e com
// cada quadro; o servidor tira esses itens das listas (ou os põe por último) e os cita na mensagem como "EVITAR". Nada de dados pessoais:
// só assuntos escolhidos pela IA, nomes de personagens bíblicos, ids de princípios e artigos, perguntas, situações, números de cânticos,
// tipos de jogo e códigos de vídeo.

export const MAX_EVITAR_POR_CATEGORIA = 40;
export const MAX_CARACTERES_EVITAR = 120;
// 6.12.73: "leituras" (o trecho de livro lido na Abertura, pela chave "trecho:…") e "relatos" (as referências dos relatos bíblicos da Abertura;
// 6.12.75: também as passagens do Personagem do dia e das Lições da vida de Jesus; 6.12.76: também os versículos do Princípio bíblico).
// 6.12.76: "jogo_versiculos" (os versículos usados no Complete o versículo e no Quem disse isso?, para a próxima noite não repetir).
export const CATEGORIAS_EVITAR = Object.freeze(["assuntos", "personagens", "principios", "jesus", "saiba", "ministerio", "criador", "artigos", "canticos", "jogos", "videos", "leituras", "relatos", "jogo_versiculos", "jogo_cartas"]);

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
  let cap = Number(m[2]);
  const chaves = [];
  for (const bruto of m[3].split(/[,;]/)) {
    let pedaco = bruto.trim();
    // 6.12.75: "8:1" depois de ";" muda o capítulo no mesmo livro ("Atos 7:54-60; 8:1", como a Bíblia do servidor escreve o trecho que
    // passa para outro capítulo; "Mateus 24:14; 28:19, 20").
    const outroCap = pedaco.match(/^(\d{1,3})\s*:\s*(.+)$/);
    if (outroCap) {
      cap = Number(outroCap[1]);
      pedaco = outroCap[2].trim();
    }
    // 6.12.75: "54-8:1" (o trecho como a IA escreve, sem a Bíblia à mão para saber onde o capítulo acaba): a metade das chaves fica para o
    // começo do 2º capítulo (1…v2) e o resto vai do v1 em diante no 1º; chave de versículo que não existe não atrapalha a comparação.
    const cruza = pedaco.match(/^(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*:\s*(\d{1,3})$/);
    if (cruza) {
      const [v1, c2, v2] = [cruza[1], cruza[2], cruza[3]].map(Number);
      const doSegundo = Math.min(v2, Math.floor((max - chaves.length) / 2));
      for (let v = v1; chaves.length < max - doSegundo; v++) chaves.push(`${livro} ${cap}:${v}`);
      for (let v = 1; v <= doSegundo && chaves.length < max; v++) chaves.push(`${livro} ${c2}:${v}`);
      cap = c2;
      continue;
    }
    const r = pedaco.match(/^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
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

// ---------- Jogos conferidos e montados pelo servidor (6.12.76) ----------

// O identificador fixo de cada um dos 6 tipos (jogo.idTipo), posto pelo servidor. jogo.tipo continua o nome da tela (o app o mostra).
export const ID_DOS_JOGOS = Object.freeze({
  "Quem sou eu? (personagens bíblicos)": "quem_sou_eu",
  "Verdadeiro ou falso": "verdadeiro_falso",
  "Ordem e data dos acontecimentos": "ordem_data",
  "Quem disse isso? (frases da Bíblia)": "quem_disse",
  "Complete o versículo": "complete_versiculo",
  "Abreviações bíblicas (ex.: Os 12 A de C)": "abreviacoes",
  "Perfil bíblico (dicas de pessoas, lugares, coisas e anos)": "perfil_biblico",
});

// 6.13.17: a resposta que o participante escreveu (ou escolheu) bate com a resposta certa? Sem acentos, maiúsculas, pontuação e palavrinhas
// (o, a, os, as, de, da, do, das, dos, e). No Verdadeiro ou falso vale a primeira palavra ("Verdadeiro"/"Falso"); no Quem disse isso?, quem
// falou (o que vem antes da vírgula: "Rute, a Noemi"). Quando não bate, o servidor deixa a resposta para quem dirige julgar.
const PALAVRINHAS = new Set(["o", "a", "os", "as", "de", "da", "do", "das", "dos", "e", "um", "uma"]);
const nucleoDaResposta = (s) => normalizarTexto(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !PALAVRINHAS.has(w)).join(" ");
export function respostaConfere(texto, resposta, idTipo = "") {
  const t = nucleoDaResposta(texto);
  if (!t) return false;
  const r = String(resposta || "");
  if (idTipo === "verdadeiro_falso") {
    const certa = (normalizarTexto(r).match(/^(verdadeiro|falso)/) || [])[1];
    return Boolean(certa) && (t === certa || t.split(" ")[0] === certa);
  }
  if (idTipo === "quem_disse") {
    const quem = nucleoDaResposta(r.split(",")[0]);
    return t === quem || t === nucleoDaResposta(r);
  }
  // 6.13.22: no Perfil bíblico, num ano vale o número ("539", "539 a.C." = "539 AEC").
  if (idTipo === "perfil_biblico" && /^\d+(?:\s*(?:aec|ec))?$/.test(nucleoDaResposta(r))) {
    const num = nucleoDaResposta(r).replace(/\D/g, "");
    return t.replace(/\D/g, "") === num && !(/\b(?:ec|dc|d c)\b/.test(t) && /aec/.test(nucleoDaResposta(r)));
  }
  return t === nucleoDaResposta(r);
}

// O nome do tipo (o da tela ou um parecido) -> o identificador; "" quando não é um dos 6.
export function idDoJogo(nome) {
  const t = normalizarTexto(nome);
  if (/^quem sou/.test(t)) return "quem_sou_eu";
  if (/^verdadeiro/.test(t)) return "verdadeiro_falso";
  if (/^ordem/.test(t)) return "ordem_data";
  if (/^quem disse/.test(t)) return "quem_disse";
  if (/^complete/.test(t)) return "complete_versiculo";
  if (/^abrevia/.test(t)) return "abreviacoes";
  if (/^perfil/.test(t)) return "perfil_biblico";
  return "";
}

// Quantas rodadas cabem nos 10 minutos do quadro: pedir (o que se pede à IA), min (com menos, refaz uma vez) e max (o que fica).
// Quem sou eu? tem 3 dicas por rodada (mais demorado); Verdadeiro ou falso é rápido; nos montados pelo servidor pede-se folga.
export const RODADAS_DO_JOGO = Object.freeze({
  // 6.12.78: Quem sou eu? e Verdadeiro ou falso passam pela conferência com a Bíblia (que pode tirar rodadas): pede-se mais do que ficam.
  quem_sou_eu: Object.freeze({ pedir: 10, min: 6, max: 8 }),
  verdadeiro_falso: Object.freeze({ pedir: 14, min: 10, max: 12 }),
  quem_disse: Object.freeze({ pedir: 12, min: 8, max: 10 }),
  complete_versiculo: Object.freeze({ pedir: 12, min: 8, max: 10 }),
  abreviacoes: Object.freeze({ pedir: 10, min: 8, max: 10 }),
  ordem_data: Object.freeze({ pedir: 8, min: 6, max: 8 }),
  // 6.13.22: Perfil bíblico: 4 cartas de 10 dicas (cada uma leva uns 2 minutos); a IA escreve as cartas dos verbetes oferecidos (até 3 ficam)
  // e o servidor completa com as cartas prontas.
  perfil_biblico: Object.freeze({ pedir: 4, min: 2, max: 3 }),
});

// ---------- Perfil bíblico (6.13.22) ----------
// Cada carta: a categoria (Pessoa, Lugar, Coisa, Qualidade ou Ano) e de 8 a 12 dicas, da mais difícil para a mais fácil, mostradas uma por vez
// por quem dirige; quem acerta com menos dicas ganha mais pontos (total de dicas − dicas dadas + 1).
export const MIN_DICAS_PERFIL = 8;
export const MAX_DICAS_PERFIL = 12;
export const CARTAS_DO_PERFIL = 4;
export const REGRAS_DO_PERFIL =
  "Quem dirige mostra uma dica por vez, da mais difícil para a mais fácil. Quem descobrir primeiro diz (ou envia pelo app) a resposta. Quanto menos dicas, mais pontos: com 10 dicas, acertar na 1ª vale 10 pontos, na 2ª vale 9, e assim por diante.";
// As dicas escritas pela IA ("Dica 1: … Dica 2: …", ou uma lista) -> [texto], sem as dicas que entregam a resposta (o nome, uma palavra
// importante dele ou o número do ano) e sem as repetidas.
export function dicasDoPerfil(textoOuLista, resposta) {
  const brutas = Array.isArray(textoOuLista)
    ? textoOuLista
    : String(textoOuLista || "")
        .split(/\s*Dica\s*\d+\s*:\s*/i)
        .slice(1);
  const resp = normalizarTexto(resposta);
  const palavras = resp.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 || /^\d+$/.test(w));
  const vistas = new Set();
  return brutas
    .map((d) => String(d || "").replace(/\s+/g, " ").trim().slice(0, 220))
    .filter((d) => {
      const n = normalizarTexto(d);
      if (d.length < 12 || vistas.has(n)) return false;
      vistas.add(n);
      const ws = n.split(/[^a-z0-9]+/);
      return !palavras.some((p) => ws.includes(p));
    })
    .slice(0, MAX_DICAS_PERFIL);
}
export function perguntaDoPerfil(categoria, dicas) {
  return `Perfil bíblico: ${categoria}. Dica 1: ${dicas.map((d, i) => (i ? `Dica ${i + 1}: ` : "") + d.replace(/\s*Dica\s*\d+\s*:\s*/gi, " ")).join(" ")}`;
}
// Complete o versículo e Quem disse isso?: com menos que isto depois de refazer, o servidor troca o tipo do jogo.
export const MIN_RODADAS_PARA_MANTER_O_TIPO = 6;

// "1 Samuel 17:45" -> "1 Samuel"; sem capítulo e versículo -> "".
export function livroDaReferencia(ref) {
  const m = String(ref || "").trim().match(/^(.+?)\s+\d{1,3}:/);
  return m ? m[1].trim() : "";
}

const LIVROS_GREGOS = new Set(
  "mateus marcos lucas joao atos romanos corintios galatas efesios filipenses colossenses tessalonicenses timoteo tito filemom filemon hebreus tiago pedro judas apocalipse".split(" ")
);
const semNumeroDoLivro = (livro) => normalizarTexto(livro).replace(/^\d\s*/, "");
// "Escrituras Gregas Cristãs" ou "Escrituras Hebraicas" (pelo nome do livro).
export function parteDasEscrituras(livro) {
  return LIVROS_GREGOS.has(semNumeroDoLivro(livro)) ? "Escrituras Gregas Cristãs" : "Escrituras Hebraicas";
}

// A fala entre aspas de um versículo (Tradução do Novo Mundo, aspas “ ”): do “ até o ” que o fecha (ou até o fim, quando a fala continua no
// versículo seguinte); só com o ” (a fala começou no versículo de antes), do começo até ele. Sem aspas, "" (a rodada sai). Pelo menos 4
// palavras; cortada no fim de uma frase (até max caracteres).
export function falaEntreAspas(texto, max = 300) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  let fala = "";
  const abre = t.indexOf("“");
  if (abre >= 0) {
    let nivel = 0;
    let fim = -1;
    for (let i = abre; i < t.length; i++) {
      if (t[i] === "“") nivel++;
      else if (t[i] === "”" && --nivel === 0) {
        fim = i;
        break;
      }
    }
    fala = t.slice(abre + 1, fim >= 0 ? fim : t.length);
  } else {
    const fecha = t.indexOf("”");
    if (fecha > 0) fala = t.slice(0, fecha);
  }
  fala = fala.replace(/[“”]/g, "").replace(/\s+/g, " ").trim();
  if (fala.split(" ").filter((p) => /\p{L}/u.test(p)).length < 4) return "";
  return cortarNoFimDaFrase(fala, max);
}

// Palavras que não servem de lacuna no Complete o versículo (além das de menos de 4 letras, dos números e do nome do livro da Dica 2).
// "Jeová" e "Deus" estão aqui porque são óbvias (decisão do usuário na 6.12.76).
const PALAVRAS_SEM_LACUNA = new Set(
  (
    "jeova deus para porque como quando pois mais isso isto esse essa esses essas este esta estes estas aquele aquela aqueles aquelas aquilo " +
    "eles elas voce voces tambem sobre entre todo todos toda todas seus suas meus minha minhas teus tuas nosso nossa nossos nossas " +
    "pelo pelos pela pelas onde aqui ainda assim entao muito muitos muita muitas nunca sempre mesmo mesma mesmos mesmas outro outra outros outras " +
    "dele dela deles delas nele nela neles nelas qual quais quem cujo cuja desde contra depois antes porem embora havia tinha seja sejam eram estava estavam"
  ).split(" ")
);

// Complete o versículo: troca a palavra escolhida pela IA por "______" no texto transcrito pelo servidor. Devolve { texto, resposta } (a
// resposta como está no versículo) ou null: palavra com espaço, número ou menos de 4 letras; palavra vazia ou proibida ("Jeová", "Deus");
// igual ao nome do livro (que é a Dica 2); ausente do versículo ou repetida nele (a lacuna ficaria ambígua).
export function lacunaNoVersiculo(texto, palavra, livro = "") {
  const t = String(texto || "");
  const p = String(palavra || "").trim().replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
  if (!t || !p || /\s/.test(p) || /\d/.test(p) || !/^[\p{L}\p{M}]+$/u.test(p)) return null;
  const alvo = normalizarTexto(p);
  if (alvo.length < 4 || PALAVRAS_SEM_LACUNA.has(alvo)) return null;
  const nomeDoLivro = semNumeroDoLivro(livro);
  if (nomeDoLivro && alvo === nomeDoLivro) return null;
  const achados = [...t.matchAll(/[\p{L}\p{M}]+/gu)].filter((m) => normalizarTexto(m[0]) === alvo);
  if (achados.length !== 1) return null;
  const m = achados[0];
  return { texto: `${t.slice(0, m.index)}______${t.slice(m.index + m[0].length)}`, resposta: m[0] };
}

// Abreviações bíblicas: as iniciais da sigla conferem, na ordem, com as palavras da resposta ("Os 12 A de C" = "Os 12 Apóstolos de
// Cristo"). Letra maiúscula sozinha (ou com ponto; "A.T." vale por duas) = a primeira letra da palavra; número = o mesmo número; as outras
// palavras (de, da, do, e, os…) iguais. O que vier entre parênteses ou depois de travessão no fim da resposta não conta. Precisa de ao
// menos uma inicial.
export function confereAbreviacao(sigla, resposta) {
  const tokensDaSigla = String(sigla || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap((t) => (/^(?:\p{Lu}\.){2,}$/u.test(t) ? t.split(".").filter(Boolean) : [t.replace(/[,;:!?]+$/, "")]));
  const limpa = String(resposta || "")
    .replace(/\s*\([^)]*\)\s*\.?$/, "")
    .replace(/\s+[—–-]\s+.*$/, "")
    .replace(/[.,;:!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const palavras = limpa.split(" ").filter(Boolean);
  if (!tokensDaSigla.length || tokensDaSigla.length !== palavras.length) return false;
  let iniciais = 0;
  for (let i = 0; i < tokensDaSigla.length; i++) {
    const s = tokensDaSigla[i];
    const w = palavras[i];
    if (/^\d+$/.test(s)) {
      if (s !== w.replace(/[^\d]/g, "") || !/^\d+$/.test(w.replace(/[.,]$/, ""))) return false;
    } else if (/^\p{Lu}\.?$/u.test(s)) {
      if (normalizarTexto(w).charAt(0) !== normalizarTexto(s).charAt(0)) return false;
      iniciais++;
    } else if (normalizarTexto(s) === normalizarTexto(w)) {
      // a palavra por extenso (de, da, "Os", "Uma"…)
    } else if (/^\p{Lu}\p{Ll}{1,2}$/u.test(s) && normalizarTexto(w).startsWith(normalizarTexto(s))) {
      // 6.13.22: o começo da palavra com 2 ou 3 letras ("C Go" = Corpo Governante, "G Mu" = Grande Multidão), para desfazer a dúvida
      iniciais++;
    } else return false;
  }
  return iniciais > 0;
}
// Palavras curtas com maiúscula que, numa sigla, costumam vir por extenso (não contam como iniciais).
const PALAVRAS_POR_EXTENSO_NA_SIGLA = new Set(["as", "os", "um", "uma", "so", "por", "com", "em", "ao", "aos", "na", "no", "nas", "nos", "da", "do", "de", "das", "dos"]);

// 6.12.81: a sigla de um jogo de Abreviações tem de ser curta e jogável: de 1 a MAX_INICIAIS_NA_SIGLA iniciais (maiúscula sozinha; "A.T." vale 2) e
// até 7 palavras ao todo. Os testes com o Gemini mostraram siglas de frases inteiras de versículos ("T L C O N E D P" para "Tão Longe Como O Nascente É
// Do Poente"), que não dá para adivinhar nem jogar, e que passavam na conferência palavra por palavra. "Os 12 A de C" (2 iniciais), "O P da P" (2)
// e "O V U da P" (4) são jogáveis.
export const MAX_INICIAIS_NA_SIGLA = 4;
export function siglaCurta(sigla) {
  const tokens = String(sigla || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap((t) => (/^(?:\p{Lu}\.){2,}$/u.test(t) ? t.split(".").filter(Boolean) : [t.replace(/[,;:!?]+$/, "")]));
  const iniciais = tokens.filter((t) => /^\p{Lu}\.?$/u.test(t) || (/^\p{Lu}\p{Ll}{1,2}$/u.test(t) && !PALAVRAS_POR_EXTENSO_NA_SIGLA.has(normalizarTexto(t)))).length;
  return iniciais >= 1 && iniciais <= MAX_INICIAIS_NA_SIGLA && tokens.length <= 7;
}

// 6.13.22: as dicas de uma rodada de Abreviações: quantas palavras, onde está (o livro da Bíblia ou o tipo da sigla) e o começo de cada
// palavra ("Gr Mu" para "Grande Multidão": as 2 primeiras letras; números e palavras de até 2 letras ficam inteiros).
export function comecoDasPalavras(resposta) {
  return String(resposta || "")
    .replace(/[.,;:!?]+$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) || w.replace(/[^\p{L}]/gu, "").length <= 2 ? w : w.replace(/^(\P{L}*\p{L}\p{L}).*$/u, "$1")))
    .join(" ");
}
export function perguntaDaAbreviacao(sigla, resposta, onde) {
  const n = String(resposta || "").trim().split(/\s+/).filter(Boolean).length;
  return `O que significa a sigla “${sigla}”? Dica 1: A resposta tem ${n} ${n === 1 ? "palavra" : "palavras"}. Dica 2: ${onde}. Dica 3: O começo de cada palavra: “${comecoDasPalavras(resposta)}”.`;
}

// A rodada de Abreviações vale se a sigla é curta e confere, palavra por palavra, com a resposta.
export function abreviacaoJogavel(sigla, resposta) {
  return siglaCurta(sigla) && confereAbreviacao(sigla, resposta);
}

// Verdadeiro ou falso: a resposta tem de começar com "Verdadeiro" ou "Falso". Devolve { valor: "V" | "F", texto: "Verdadeiro. …" } ou null.
export function respostaVF(resposta) {
  const t = String(resposta || "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(verdadeir[oa]|fals[oa])(?![\p{L}])[\s.,:;!—–-]*/iu);
  if (!m) return null;
  const valor = /^v/i.test(m[1]) ? "V" : "F";
  const resto = t.slice(m[0].length).trim();
  return { valor, texto: `${valor === "V" ? "Verdadeiro" : "Falso"}.${resto ? ` ${resto.charAt(0).toUpperCase()}${resto.slice(1)}` : ""}` };
}

const TITULOS_DE_PESSOAS = new Set("rei rainha profeta profetisa apostolo sacerdote juiz juiza filho filha esposa marido mae pai irmao irma servo serva anjo".split(" "));
// Palavras curtas que podem vir com maiúscula no começo da resposta e não são nomes (os nomes de 2 letras, como "Jó" e "Ló", contam).
const CURTAS_QUE_NAO_SAO_NOMES = new Set("os as um em da de do no na ao eu tu ele ela se ou".split(" "));
// Os nomes próprios de uma resposta ("Rei Josias" -> ["josias"]; "Abigail, esposa de Nabal" -> ["abigail", "nabal"]; "Jó" -> ["jo"]), sem os títulos.
export function nomesDaResposta(resposta) {
  return [...String(resposta || "").matchAll(/\p{Lu}[\p{L}\p{M}]+/gu)]
    .map((m) => normalizarTexto(m[0]))
    .filter((n) => n && !TITULOS_DE_PESSOAS.has(n) && !CURTAS_QUE_NAO_SAO_NOMES.has(n));
}
const temPalavra = (texto, palavra) => ` ${normalizarTexto(texto)} `.includes(` ${palavra} `);

// Quem sou eu?: exatamente 3 dicas ("Dica 1: … Dica 2: … Dica 3: …") e nenhum nome da resposta na pergunta.
export function quemSouEuValida(rodada) {
  const r = rodada && typeof rodada === "object" ? rodada : {};
  const dicas = (String(r.pergunta || "").match(/Dica\s*\d+\s*:/gi) || []).length;
  if (dicas !== 3) return false;
  const nomes = nomesDaResposta(r.resposta);
  return nomes.length > 0 && !nomes.some((n) => temPalavra(r.pergunta, n));
}

// Quem disse isso?: a fala não pode trazer o nome de quem disse (entregaria a resposta).
export function falaSemONome(fala, quem) {
  return !nomesDaResposta(quem).some((n) => temPalavra(fala, n));
}

// A Dica 2 do Quem disse isso?: "Está em {livro}", ou, quando o livro tem o nome de quem disse (Jó, Rute, Ester…), a parte das Escrituras.
export function dicaDoLivro(livro, quem = "") {
  const nome = semNumeroDoLivro(livro);
  if (!nome) return "";
  return nomesDaResposta(quem).includes(nome) ? `Está nas ${parteDasEscrituras(livro)}` : `Está em ${livro}`;
}

// ---------- Patch 6.12.77: aspas soltas e quem fala ----------

// Tira as aspas que ficaram sem par no versículo transcrito (a fala começou no versículo de antes ou continua no seguinte): “ sem o ”
// que a fecha, ” sem o “ que a abre, e o mesmo com ‘ ’ (o ’ entre duas letras é apóstrofo e fica). Assim o Complete o versículo não
// mostra "“‘Pois…" nem termina em "’".
export function semAspasSoltas(texto) {
  const t = String(texto || "");
  const tirar = new Set();
  const parear = (abre, fecha, ehFecho = () => true) => {
    const abertas = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === abre) abertas.push(i);
      else if (t[i] === fecha && ehFecho(i)) {
        if (abertas.length) abertas.pop();
        else tirar.add(i);
      }
    }
    abertas.forEach((i) => tirar.add(i));
  };
  parear("“", "”");
  parear("‘", "’", (i) => !(/\p{L}/u.test(t[i - 1] || "") && /\p{L}/u.test(t[i + 1] || "")));
  if (!tirar.size) return t;
  let limpo = "";
  for (let i = 0; i < t.length; i++) if (!tirar.has(i)) limpo += t[i];
  return limpo.replace(/\s{2,}/g, " ").trim();
}

// Quem disse isso?: a rodada só vale se dá para conferir quem fala no próprio texto transcrito. O primeiro nome da resposta (quem fala:
// "Jeová, a Caim" -> "jeova") tem de estar escrito ANTES da primeira aspa de abertura, e nenhum outro nome da resposta (o ouvinte, ou
// sobre quem se fala) pode vir antes dele. Sem aspa de abertura (a fala começou no versículo de antes), sem o nome ou com o ouvinte
// antes, a rodada sai. Ex.: Gênesis 4:9, "Jeová perguntou a Caim: “Onde está Abel…”": "Jeová, a Caim" vale; "Caim, a Jeová" sai.
export function quemFalaConfere(texto, resposta) {
  const t = String(texto || "");
  const abre = t.indexOf("“");
  if (abre <= 0) return false;
  const antes = ` ${normalizarTexto(t.slice(0, abre))} `;
  const nomes = nomesDaResposta(resposta);
  if (!nomes.length) return false;
  const onde = (nome) => antes.indexOf(` ${nome} `);
  const quem = onde(nomes[0]);
  if (quem < 0) return false;
  return nomes.slice(1).every((n) => n === nomes[0] || onde(n) < 0 || onde(n) > quem);
}

// ---------- 6.12.78: conferência com a Bíblia dos jogos que a IA escreve por conta própria ----------

// Verdadeiro ou falso e Quem sou eu? são escritos inteiros pela IA (o servidor só confere o formato), e na geração real da 6.12.77 saíram rodadas
// erradas (uma afirmação verdadeira marcada "Falso"; dicas com quem fez e quem recebeu trocados). Por isso, depois da montagem, uma segunda
// chamada curta à IA confere cada rodada com o TEXTO da referência, transcrito da Bíblia do servidor, e o servidor tira as que o texto contradiz.
// Os outros 4 tipos já nascem do texto transcrito (ou de dados do servidor) e não precisam dela.
export const JOGOS_CONFERIDOS_NA_BIBLIA = Object.freeze(["quem_sou_eu", "verdadeiro_falso"]);
// "sem_texto" não vem da IA: é posto pelo servidor na rodada sem referência ou com referência que a Bíblia do servidor não achou (6.12.79),
// porque uma rodada que não dá para conferir não pode passar como se tivesse sido conferida.
export const TIPOS_DE_VEREDITO = Object.freeze(["confere", "contradiz", "nao_consta", "sem_texto"]);

// O veredito escrito pela IA vira um dos três (qualquer outra coisa, ou vazio, vale "nao_consta": só "contradiz" e "sem_texto" tiram a rodada).
export function vereditoDaConferencia(valor) {
  const t = normalizarTexto(valor).replace(/\s+/g, "_");
  if (t.startsWith("contradiz") || t === "errada" || t === "errado") return "contradiz";
  if (t.startsWith("sem_texto")) return "sem_texto";
  if (t.startsWith("confere")) return "confere";
  return "nao_consta";
}

// 6.12.79: separa as rodadas que têm o texto da Bíblia (vão à IA) das que não têm (referência vazia ou não achada: saem com o motivo, sem
// gastar a IA). textos[i] é o texto da referência da rodada i. Devolve { aConferir: [{ indice, rodada, texto }], semTexto: [{ n, veredito, motivo }] }.
export function separarPorTexto(rodadas, textos = []) {
  const aConferir = [];
  const semTexto = [];
  (Array.isArray(rodadas) ? rodadas : []).forEach((r, i) => {
    const texto = String((Array.isArray(textos) && textos[i]) || "").trim();
    if (texto) aConferir.push({ indice: i, rodada: r, texto });
    else semTexto.push({ n: i + 1, veredito: "sem_texto", motivo: r && r.referencia ? `o texto de ${r.referencia} não foi achado na Bíblia` : "a rodada veio sem referência" });
  });
  return { aConferir, semTexto };
}

// Os itens que a IA devolveu para as rodadas enviadas (n = posição entre as enviadas) com o n da posição na lista original.
export function itensNaPosicaoOriginal(itens, aConferir) {
  return (Array.isArray(itens) ? itens : [])
    .map((it) => {
      const alvo = (aConferir || [])[Math.round(Number(it && it.n)) - 1];
      return alvo ? { ...it, n: alvo.indice + 1 } : null;
    })
    .filter(Boolean);
}

// A mensagem da conferência: cada rodada com o que ela diz, a resposta dada e o texto da Bíblia da sua referência (textos[i], pela ordem).
export function mensagemDeConferenciaDoJogo(idTipo, rodadas, textos = []) {
  const vf = idTipo === "verdadeiro_falso";
  const blocos = (Array.isArray(rodadas) ? rodadas : []).map((r, i) => {
    const texto = String(textos[i] || "").replace(/\s+/g, " ").trim();
    return (
      `[${i + 1}] ${vf ? "AFIRMAÇÃO" : "DICAS"}: ${String(r.pergunta || "").replace(/\s+/g, " ").trim()}\n` +
      `RESPOSTA DADA: ${String(r.resposta || "").replace(/\s+/g, " ").trim()}\n` +
      `REFERÊNCIA: ${r.referencia || "(nenhuma)"}\n` +
      `TEXTO DA BÍBLIA: ${texto || "(o servidor não achou o texto desta referência: responda nao_consta)"}`
    );
  });
  return `TIPO DO JOGO: ${vf ? "Verdadeiro ou falso" : "Quem sou eu?"}\nRODADAS A CONFERIR (${blocos.length}), cada uma com o texto da Bíblia transcrito pelo servidor:\n\n${blocos.join("\n\n")}\n`;
}

// Aplica o que a conferência devolveu ([{ n, veredito, motivo }], com n a partir de 1): "contradiz" (o texto mostra que a rodada está errada)
// e "sem_texto" (não deu para conferir) tiram a rodada; "confere" e "nao_consta" ficam. Sem resposta válida da IA (itens que não é lista),
// todas ficam. Devolve { mantidas, rejeitadas: [{ rodada, motivo }] }.
export function aplicarConferenciaDoJogo(rodadas, itens) {
  const lista = Array.isArray(rodadas) ? rodadas : [];
  if (!Array.isArray(itens)) return { mantidas: lista.slice(), rejeitadas: [] };
  const fora = new Map();
  for (const it of itens) {
    const n = Math.round(Number(it && it.n));
    const veredito = vereditoDaConferencia(it && it.veredito);
    if (n >= 1 && n <= lista.length && !fora.has(n) && (veredito === "contradiz" || veredito === "sem_texto")) fora.set(n, String(it.motivo || "").replace(/\s+/g, " ").trim().slice(0, 300));
  }
  return { mantidas: lista.filter((_, i) => !fora.has(i + 1)), rejeitadas: [...fora].map(([n, motivo]) => ({ rodada: lista[n - 1], motivo })) };
}

// 6.12.79: entre a 1ª e a 2ª tentativa de um quadro, a 2ª só vale se tiver menos problemas (repetições e "falta", que conta 1) ou, empatando,
// não tiver menos rodadas. Antes só se contavam os problemas e o `<=` escolhia a 2ª no empate: duas tentativas abaixo do mínimo (9 rodadas contra
// 4) empatavam em 1 problema e o jogo com 4 rodadas ficava. Cada tentativa: { repeticoes: [], falta: "", contagens: { rodadas } }.
export function segundaTentativaMelhor(primeira, segunda) {
  if (!segunda) return false;
  const problemas = (x) => (Array.isArray(x && x.repeticoes) ? x.repeticoes.length : 0) + (x && x.falta ? 1 : 0);
  const rodadas = (x) => (x && x.contagens && Number.isFinite(x.contagens.rodadas) ? x.contagens.rodadas : 0);
  if (problemas(segunda) !== problemas(primeira)) return problemas(segunda) < problemas(primeira);
  return rodadas(segunda) >= rodadas(primeira);
}

// O que se diz à IA, ao pedir o jogo de novo, sobre as rodadas que a conferência tirou (até 4, curtas).
export function textoDasRejeitadas(rejeitadas) {
  const lista = Array.isArray(rejeitadas) ? rejeitadas : [];
  if (!lista.length) return "";
  const curto = (t, n) => {
    const s = String(t || "").replace(/\s+/g, " ").trim();
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
  };
  return `a conferência com a Bíblia tirou ${lista.length} ${lista.length === 1 ? "rodada" : "rodadas"} por contrariar o texto ou por não terem um texto conferível (confira quem fez o quê e a quem, e ponha em "referencia", sempre, TODOS os versículos que sustentam a rodada, com o livro escrito como na Bíblia): ${lista
    .slice(0, 4)
    .map((x) => `"${curto(x.rodada && x.rodada.pergunta, 110)}" (${curto(x.motivo, 140) || "contraria o texto"})`)
    .join("; ")}`;
}
