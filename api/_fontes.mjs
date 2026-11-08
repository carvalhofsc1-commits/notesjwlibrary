// Fontes de consulta da IA: Bíblia (Tradução do Novo Mundo) e Estudo Perspicaz das Escrituras, vols. 1 e 2.
// O arquivo começa com "_" para a Vercel não publicá-lo como rota.
//
// Os textos ficam num Vercel Blob PRIVADO (store "jwnotes-fontes", ligado ao projeto pela variável
// BLOB_READ_WRITE_TOKEN): só esta função os lê; o navegador nunca recebe os arquivos, só os versículos e as explicações
// pedidos. Cada instância do servidor baixa um arquivo uma vez e guarda o índice em memória, então a busca de um
// versículo ou de um verbete leva milissegundos (antes a IA abria os arquivos num ambiente de execução de código, o
// que levava dezenas de segundos).
import { get } from "@vercel/blob";

const ARQUIVOS = {
  biblia: "fontes/biblia.txt",
  perspicaz1: "fontes/perspicaz_v1.txt",
  perspicaz2: "fontes/perspicaz_v2.txt",
  adoracaoPura: "fontes/adoracao_pura.txt",
  reinoDeDeus: "fontes/reino_de_deus.txt",
  principiosBiblicos: "fontes/principios_biblicos.txt",
};

const MAX_VERSICULOS_POR_REFERENCIA = 10;
const MAX_CHARS_VERSICULOS = 1200;
const MAX_CHARS_TRECHO_VERBETE = 2500;

export function fontesConfiguradas() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.FONTES_DIR);
}

const textos = new Map(); // caminho -> Promise<string>

function baixar(caminho) {
  if (!textos.has(caminho)) {
    const promessa = (async () => {
      // Só para testes no computador: FONTES_DIR aponta para a pasta local com os mesmos arquivos.
      if (process.env.FONTES_DIR) {
        const { readFile } = await import("node:fs/promises");
        return await readFile(`${process.env.FONTES_DIR}/${caminho.split("/").pop()}`, "utf8");
      }
      // Token explícito: a leitura não depende do OIDC (que muda de identidade se o projeto for renomeado na Vercel).
      const resultado = await get(caminho, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (!resultado || resultado.statusCode !== 200) throw new Error(`Arquivo de consulta não encontrado: ${caminho}`);
      return await new Response(resultado.stream).text();
    })();
    // Se falhar, a próxima consulta tenta de novo.
    promessa.catch(() => textos.delete(caminho));
    textos.set(caminho, promessa);
  }
  return textos.get(caminho);
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------- Bíblia ----------

// Abreviações usadas nas publicações (as duas formas: "Efé." e "Ef") e variações comuns. A chave é escrita em
// minúsculas, sem pontos nem espaços; primeiro se tenta com acento (para separar Jó de João), depois sem.
const ABREVIACOES_LIVROS = {
  "Gênesis": ["gên", "gn"],
  "Êxodo": ["êx", "êxo", "exod"],
  "Levítico": ["le", "lev", "lv"],
  "Números": ["núm", "nm"],
  "Deuteronômio": ["de", "deut", "dt"],
  "Josué": ["jos", "js"],
  "Juízes": ["jz", "juí"],
  "Rute": ["ru", "rt"],
  "1 Samuel": ["1sa", "1sam", "1sm"],
  "2 Samuel": ["2sa", "2sam", "2sm"],
  "1 Reis": ["1rs", "1re"],
  "2 Reis": ["2rs", "2re"],
  "1 Crônicas": ["1cr", "1crô", "1crôn"],
  "2 Crônicas": ["2cr", "2crô", "2crôn"],
  "Esdras": ["esd", "ed"],
  "Neemias": ["ne", "nee"],
  "Ester": ["est", "et"],
  "Jó": ["jó"],
  "Salmos": ["sal", "sl", "salmo", "ps"],
  "Provérbios": ["pr", "pro", "prov", "pv"],
  "Eclesiastes": ["ec", "ecl", "ecles"],
  "Cântico de Salomão": ["cân", "cânt", "cântico", "cânticos", "cantares", "ct"],
  "Isaías": ["is", "isa"],
  "Jeremias": ["je", "jer", "jr"],
  "Lamentações": ["la", "lam", "lm"],
  "Ezequiel": ["ez", "eze", "ezeq"],
  "Daniel": ["da", "dan", "dn"],
  "Oseias": ["os", "ose", "oséias"],
  "Joel": ["jl"],
  "Amós": ["am", "amó"],
  "Obadias": ["ob", "obd", "oba"],
  "Jonas": ["jon", "jn"],
  "Miqueias": ["miq", "mq", "miquéias"],
  "Naum": ["na"],
  "Habacuque": ["hab", "hc"],
  "Sofonias": ["sof", "sf"],
  "Ageu": ["ag"],
  "Zacarias": ["za", "zac"],
  "Malaquias": ["mal", "ml"],
  "Mateus": ["mt", "mat"],
  "Marcos": ["mr", "mar", "mc"],
  "Lucas": ["lu", "luc", "lc"],
  "João": ["jo"],
  "Atos": ["at"],
  "Romanos": ["ro", "rom", "rm"],
  "1 Coríntios": ["1co", "1cor"],
  "2 Coríntios": ["2co", "2cor"],
  "Gálatas": ["gál", "gl"],
  "Efésios": ["ef", "efé"],
  "Filipenses": ["fil", "fp", "flp"],
  "Colossenses": ["col", "cl"],
  "1 Tessalonicenses": ["1te", "1tes", "1ts"],
  "2 Tessalonicenses": ["2te", "2tes", "2ts"],
  "1 Timóteo": ["1ti", "1tim", "1tm"],
  "2 Timóteo": ["2ti", "2tim", "2tm"],
  "Tito": ["tit", "tt"],
  "Filêmon": ["flm", "filêm", "fm"],
  "Hebreus": ["he", "heb", "hb"],
  "Tiago": ["tg", "tia"],
  "1 Pedro": ["1pe", "1ped", "1pd"],
  "2 Pedro": ["2pe", "2ped", "2pd"],
  "1 João": ["1jo"],
  "2 João": ["2jo"],
  "3 João": ["3jo"],
  "Judas": ["ju", "jud", "jd"],
  "Apocalipse": ["ap", "apo", "apoc", "re", "rev", "revelação"],
};

const chaveComAcento = (texto) => String(texto || "").toLowerCase().replace(/[.\s]+/g, "");
const chaveSemAcento = (texto) => chaveComAcento(texto).normalize("NFD").replace(/[̀-ͯ]/g, "");

let biblia = null; // Promise<{ versiculos: Map, capitulos: Map, comAcento: Map, semAcento: Map }>

function carregarBiblia() {
  if (!biblia) {
    biblia = baixar(ARQUIVOS.biblia).then((conteudo) => {
      const versiculos = new Map();
      const capitulos = new Map(); // livro -> último capítulo (1 = livro de um capítulo só, como Filêmon e Judas)
      const livros = [];
      // O arquivo tem quebras de linha do Windows (\r\n); o "." da expressão não aceita o \r.
      for (const linha of conteudo.split(/\r?\n/)) {
        const m = linha.match(/^(.+?) (\d{1,3}):(\d{1,3}) (.+)$/);
        if (!m) continue;
        if (livros[livros.length - 1] !== m[1]) livros.push(m[1]);
        versiculos.set(`${m[1]}|${Number(m[2])}|${Number(m[3])}`, m[4].trim());
        capitulos.set(m[1], Math.max(capitulos.get(m[1]) || 0, Number(m[2])));
      }
      const comAcento = new Map();
      const semAcento = new Map();
      const registrar = (apelido, livro) => {
        if (!comAcento.has(chaveComAcento(apelido))) comAcento.set(chaveComAcento(apelido), livro);
        if (!semAcento.has(chaveSemAcento(apelido))) semAcento.set(chaveSemAcento(apelido), livro);
      };
      // Primeiro os nomes completos do arquivo, depois as abreviações.
      for (const livro of livros) registrar(livro, livro);
      for (const [livro, apelidos] of Object.entries(ABREVIACOES_LIVROS)) {
        if (livros.includes(livro)) apelidos.forEach((a) => registrar(a, livro));
      }
      return { versiculos, capitulos, comAcento, semAcento };
    });
    biblia.catch(() => (biblia = null));
  }
  return biblia;
}

function acharLivro(nome, indice) {
  return indice.comAcento.get(chaveComAcento(nome)) || indice.semAcento.get(chaveSemAcento(nome)) || null;
}

// "11, 12" -> [11, 12]; "10-12" -> [10, 11, 12]; "11, 13-15" -> [11, 13, 14, 15].
function numerosDosVersiculos(texto) {
  const numeros = [];
  for (const parte of String(texto).split(/[,.]/)) {
    const faixa = parte.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
    if (faixa) {
      for (let n = Number(faixa[1]); n <= Number(faixa[2]) && numeros.length < MAX_VERSICULOS_POR_REFERENCIA; n++) numeros.push(n);
    } else {
      const unico = parte.match(/\d{1,3}/);
      if (unico && numeros.length < MAX_VERSICULOS_POR_REFERENCIA) numeros.push(Number(unico[0]));
    }
  }
  return [...new Set(numeros)];
}

// Uma referência pode ter vários trechos do mesmo livro: "Mateus 24:14; 28:19, 20". Devolve a referência com o nome
// do livro como está na Bíblia e o texto exato dos versículos encontrados (em ordem, separados por espaço).
function lerReferencia(referencia, indice) {
  let livro = null;
  const partes = [];
  const trechos = [];
  for (const segmento of String(referencia || "").split(";")) {
    // O nome do livro é opcional depois do primeiro trecho ("28:19, 20" continua no mesmo livro).
    const m = segmento.trim().match(/^(?:((?:[1-3]\s*)?\p{L}[^\d:]*?)\s*)?(\d{1,3})\s*:\s*([\d\s,.\-–—]+)$/u);
    // Livro de um capítulo só, citado como nas publicações, sem o capítulo: "Filêmon 8, 9, 17", "Judas 3", "3 João 4".
    const s = m ? null : segmento.trim().match(/^(?:((?:[1-3]\s*)?\p{L}[^\d:]*?)\s*)?([\d\s,.\-–—]+)$/u);
    if (!m && !s) continue;
    const nome = m ? m[1] : s[1];
    if (nome && nome.trim()) livro = acharLivro(nome, indice);
    if (!livro) continue;
    if (s && indice.capitulos.get(livro) !== 1) continue;
    const capitulo = m ? Number(m[2]) : 1;
    const versos = numerosDosVersiculos(m ? m[3] : s[2]);
    const achados = versos.filter((v) => indice.versiculos.has(`${livro}|${capitulo}|${v}`));
    if (!achados.length) continue;
    partes.push({ livro, capitulo, versos: achados });
    achados.forEach((v) => trechos.push({ livro, capitulo, verso: v, texto: indice.versiculos.get(`${livro}|${capitulo}|${v}`) }));
  }
  if (!partes.length) return null;

  // "texto" é o texto corrido; "textoNumerado" é o mesmo texto com o começo de cada versículo, do segundo em diante, marcado por
  // [n] (ou [cap:n] quando o trecho passa a outro capítulo). O app escreve esses números em negrito na leitura (LEIA).
  let texto = "";
  let textoNumerado = "";
  let anterior = null;
  for (const t of trechos) {
    if (texto && (texto + " " + t.texto).length > MAX_CHARS_VERSICULOS) break;
    const marca = anterior ? `[${anterior.livro === t.livro && anterior.capitulo === t.capitulo ? t.verso : `${t.capitulo}:${t.verso}`}] ` : "";
    texto = texto ? texto + " " + t.texto : t.texto;
    textoNumerado = textoNumerado ? textoNumerado + " " + marca + t.texto : t.texto;
    anterior = t;
  }

  // Referência escrita do jeito das publicações: "Efésios 6:11, 12"; "Mateus 24:14; 28:19, 20".
  const versosEscritos = (versos) => {
    const grupos = [];
    for (const v of versos) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && v === ultimo[1] + 1) ultimo[1] = v;
      else grupos.push([v, v]);
    }
    return grupos.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}-${b}`)).join(", ");
  };
  // Nos livros de um capítulo só, as publicações escrevem só os versículos: "Filêmon 8, 9, 17".
  const escrita = partes
    .map((p, i) => (i === 0 || p.livro !== partes[i - 1].livro ? `${p.livro} ` : "") + (indice.capitulos.get(p.livro) === 1 ? "" : `${p.capitulo}:`) + versosEscritos(p.versos))
    .join("; ");
  return { referencia: escrita, texto, textoNumerado };
}

// Busca as referências (no máximo `max`, sem repetir) e devolve [{ referencia, texto }] só das encontradas. Com `numerado`, cada
// item traz também "textoNumerado" (o texto com o começo dos versículos, do segundo em diante, marcado por [n]); sem ele, a IA e
// as outras telas recebem só o texto corrido.
// O texto de UM capítulo, versículo por versículo: [{ n, texto }]. Usado pelo player da Leitura diária da Bíblia, que mostra o versículo
// que está sendo lido. Devolve [] se o livro ou o capítulo não existem.
export async function versiculosDoCapitulo(nomeLivro, capitulo) {
  const indice = await carregarBiblia();
  const livro = acharLivro(String(nomeLivro || ""), indice);
  const cap = Number(capitulo);
  if (!livro || !Number.isInteger(cap) || cap < 1) return [];
  return versosDoCapitulo(indice, livro, cap).map((n) => ({ n, texto: indice.versiculos.get(`${livro}|${cap}|${n}`) }));
}

export async function buscarVersiculos(referencias, max, { numerado = false } = {}) {
  const lista = (Array.isArray(referencias) ? referencias : []).filter((r) => typeof r === "string" && r.trim());
  if (!lista.length) return [];
  const indice = await carregarBiblia();
  const resultado = [];
  const vistas = new Set();
  for (const ref of lista) {
    if (resultado.length >= max) break;
    const achado = lerReferencia(ref, indice);
    if (!achado || vistas.has(achado.referencia)) continue;
    vistas.add(achado.referencia);
    resultado.push(numerado ? achado : { referencia: achado.referencia, texto: achado.texto });
  }
  return resultado;
}

// Versículos de um capítulo (1…N) que existem no índice da Bíblia.
function versosDoCapitulo(indice, livro, capitulo) {
  const versos = [];
  for (let v = 1; v <= 200; v++) {
    if (!indice.versiculos.has(`${livro}|${capitulo}|${v}`)) {
      if (v > 1) break;
      continue;
    }
    versos.push(v);
  }
  return versos;
}

// Expande um rótulo do programa de leitura ("1-3", "32", "todo", "116-119:63", "119:64-176") em capítulos com seus versículos.
function expandirRotuloCapitulos(rotulo, livro, indice) {
  const ultimo = indice.capitulos.get(livro) || 1;
  const r = String(rotulo || "todo").trim();
  if (!r || r === "todo") {
    return Array.from({ length: ultimo }, (_, i) => i + 1).map((c) => ({ capitulo: c, versos: versosDoCapitulo(indice, livro, c) }));
  }
  // "119:64-176" (um capítulo, faixa de versículos) ou "116-119:63" (capítulos inteiros até o último, que vai só até o verso indicado).
  const comVerso = r.match(/^(\d{1,3})(?:-(\d{1,3}))?:(\d{1,3})(?:-(\d{1,3}))?$/);
  if (comVerso) {
    const c1 = Number(comVerso[1]);
    const c2 = comVerso[2] ? Number(comVerso[2]) : c1;
    const v1 = Number(comVerso[3]);
    const v2 = comVerso[4] ? Number(comVerso[4]) : null;
    const out = [];
    for (let c = c1; c <= c2; c++) {
      const todos = versosDoCapitulo(indice, livro, c);
      if (!todos.length) continue;
      if (c1 === c2) {
        // Um capítulo só: "119:64-176" ou "119:64".
        out.push({ capitulo: c, versos: todos.filter((v) => v >= v1 && v <= (v2 ?? v1)) });
      } else if (c === c2) {
        // Último capítulo da faixa: versículos 1…v1 (ex.: Salmos 116-119:63 → 119:1-63).
        out.push({ capitulo: c, versos: todos.filter((v) => v <= v1) });
      } else {
        out.push({ capitulo: c, versos: todos });
      }
    }
    return out;
  }
  const faixa = r.match(/^(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!faixa) return [];
  const a = Number(faixa[1]);
  const b = faixa[2] ? Number(faixa[2]) : a;
  const out = [];
  for (let c = a; c <= b; c++) {
    const versos = versosDoCapitulo(indice, livro, c);
    if (versos.length) out.push({ capitulo: c, versos });
  }
  return out;
}

// Texto dos capítulos/grupos do programa de leitura diária da Bíblia, para a IA resumir (estilo Joias).
// refs: [{ livro, rotulo }]. Devolve string com os capítulos e versículos, cortada em maxChars.
export async function textoDeGruposBiblicos(refs, maxChars = 32000) {
  if (!fontesConfiguradas()) return "";
  const indice = await carregarBiblia();
  const partes = [];
  let total = 0;
  for (const ref of Array.isArray(refs) ? refs : []) {
    const livro = acharLivro(ref && ref.livro, indice);
    if (!livro) continue;
    for (const faixa of expandirRotuloCapitulos(ref.rotulo, livro, indice)) {
      const linhas = faixa.versos
        .map((v) => {
          const t = indice.versiculos.get(`${livro}|${faixa.capitulo}|${v}`);
          return t ? `${v} ${t}` : "";
        })
        .filter(Boolean);
      if (!linhas.length) continue;
      const bloco = `${livro} ${faixa.capitulo}\n${linhas.join("\n")}`;
      if (total + bloco.length + 2 > maxChars) {
        const resto = maxChars - total - 2;
        if (resto > 80) partes.push(bloco.slice(0, resto));
        return partes.join("\n\n");
      }
      partes.push(bloco);
      total += bloco.length + 2;
    }
  }
  return partes.join("\n\n");
}

// As referências bíblicas escritas num texto livre (as anotações que o orador colou): "Mateus 6:33", "Sl 37:10, 11", "Mt 24:14; 28:19, 20".
// Só entram as que a Bíblia confirma (o livro existe e o versículo também), escritas como a Bíblia as escreve, sem repetir. Um trecho sem o
// nome do livro só vale depois de ";" (continua o livro anterior). Num texto corrido o livro tem de começar por maiúscula (ou número), para
// "reunião de 9:15" não virar Deuteronômio; com "livre" (o campo em que a pessoa digita só os textos) vale qualquer caixa ("mt 6:33").
export async function referenciasNoTexto(texto, { max = 60, livre = false } = {}) {
  const bruto = String(texto || "").slice(0, 20000);
  if (!bruto.trim() || !fontesConfiguradas()) return [];
  const indice = await carregarBiblia();
  const padrao = /(?:((?:[1-3]\s?)?\p{L}\p{L}{0,18})\.?\s*)?(\d{1,3}):(\d{1,3}(?:\s*[-–]\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)*)/gu;
  const achadas = [];
  const vistas = new Set();
  let livro = "";
  let fimAnterior = -1;
  for (const m of bruto.matchAll(padrao)) {
    if (achadas.length >= max) break;
    const nome = m[1] && (livre || /^[1-3]|^\p{Lu}/u.test(m[1])) ? m[1] : "";
    const continua = fimAnterior >= 0 && /^\s*;\s*$/.test(bruto.slice(fimAnterior, m.index));
    const doLivro = nome || (continua ? livro : "");
    if (!doLivro) continue;
    const achado = lerReferencia(`${doLivro} ${m[2]}:${m[3]}`, indice);
    if (!achado) continue;
    if (nome) livro = nome;
    fimAnterior = m.index + m[0].length;
    if (vistas.has(achado.referencia)) continue;
    vistas.add(achado.referencia);
    achadas.push(achado.referencia);
  }
  return achadas;
}

// ---------- Estudo Perspicaz ----------

let perspicaz = null; // Promise<Map<chave, { volume, titulo, texto }>>

function indexarVolume(conteudo, volume, mapa) {
  const partes = conteudo.split(/^=== (.+?) ===\s*$/m);
  // partes = [antes, título1, texto1, título2, texto2, ...]
  for (let i = 1; i < partes.length; i += 2) {
    const titulo = partes[i].trim().replace(/\.$/, "");
    const texto = (partes[i + 1] || "").trim();
    const verbete = { volume, titulo, texto };
    const chaves = [titulo, ...titulo.split(/[,;]/)].map(normalizar).filter(Boolean);
    for (const chave of chaves) if (!mapa.has(chave)) mapa.set(chave, verbete);
  }
}

function carregarPerspicaz() {
  if (!perspicaz) {
    perspicaz = Promise.all([baixar(ARQUIVOS.perspicaz1), baixar(ARQUIVOS.perspicaz2)]).then(([v1, v2]) => {
      const mapa = new Map();
      indexarVolume(v1, 1, mapa);
      indexarVolume(v2, 2, mapa);
      return mapa;
    });
    perspicaz.catch(() => (perspicaz = null));
  }
  return perspicaz;
}

function acharVerbete(nome, mapa) {
  const chave = normalizar(nome);
  if (!chave) return null;
  const variantes = [chave];
  if (chave.endsWith("s")) variantes.push(chave.slice(0, -1));
  else variantes.push(chave + "s");
  if (chave.endsWith("oes")) variantes.push(chave.slice(0, -3) + "ao");
  for (const v of variantes) {
    let verbete = mapa.get(v);
    // Verbete só de remissão ("Veja ARÃO."): segue a remissão uma vez.
    const remissao = verbete && verbete.texto.length < 200 && verbete.texto.match(/^Veja\s+([^.;\n]+)/);
    if (remissao) verbete = mapa.get(normalizar(remissao[1])) || verbete;
    if (verbete && verbete.texto.length >= 40) return verbete;
  }
  return null;
}

// Primeiro verbete encontrado entre os nomes sugeridos: { volume, verbete, trecho } (trecho = começo do verbete).
export async function buscarVerbete(nomes) {
  const lista = (Array.isArray(nomes) ? nomes : []).filter((n) => typeof n === "string" && n.trim()).slice(0, 3);
  if (!lista.length) return null;
  const mapa = await carregarPerspicaz();
  for (const nome of lista) {
    const verbete = acharVerbete(nome, mapa);
    if (!verbete) continue;
    let trecho = verbete.texto.replace(/\s+/g, " ");
    if (trecho.length > MAX_CHARS_TRECHO_VERBETE) {
      const corte = trecho.lastIndexOf(". ", MAX_CHARS_TRECHO_VERBETE);
      trecho = trecho.slice(0, corte > 500 ? corte + 1 : MAX_CHARS_TRECHO_VERBETE);
    }
    return { volume: verbete.volume, verbete: verbete.titulo, trecho };
  }
  return null;
}

// ---------- Livros (Adoração Pura, Reino de Deus, Princípios Bíblicos) ----------
// Texto corrido em parágrafos (separados por linha em branco). A busca é por palavras: cada parágrafo recebe pontos pelas palavras da
// consulta que contém (as raras valem mais) e vêm os melhores, com o nome do livro.

const LIVROS = [
  { chave: "adoracaoPura", nome: "A Adoração Pura de Jeová É Restaurada!" },
  { chave: "reinoDeDeus", nome: "O Reino de Deus Já Governa!" },
  { chave: "principiosBiblicos", nome: "Princípios Bíblicos para a Vida Cristã" },
];
const PALAVRAS_COMUNS = new Set("a o as os um uma de do da dos das em no na nos nas por para com sem sobre entre que se e ou mas como mais muito ao aos ela ele eles elas seu sua seus suas nao ja foi ser sao era tem ter isso este esta esse essa aquele quando onde qual quais".split(" "));
let livros = null; // Promise<{ paragrafos: [{ livro, texto, palavras: Set }], df: Map }>

function palavrasDe(texto) {
  return normalizar(texto).split(" ").filter((w) => w.length > 2 && !PALAVRAS_COMUNS.has(w));
}

function carregarLivros() {
  if (!livros) {
    livros = Promise.all(LIVROS.map((l) => baixar(ARQUIVOS[l.chave]))).then((conteudos) => {
      const paragrafos = [];
      const df = new Map();
      conteudos.forEach((conteudo, i) => {
        for (const bruto of conteudo.split(/\r?\n\s*\r?\n/)) {
          const texto = bruto.replace(/\s+/g, " ").trim();
          if (texto.length < 80 || (texto.length < 200 && /\?$/.test(texto))) continue; // fora: sobras de quadro e perguntas soltas
          const palavras = new Set(palavrasDe(texto));
          for (const w of palavras) df.set(w, (df.get(w) || 0) + 1);
          paragrafos.push({ livro: LIVROS[i].nome, texto, palavras });
        }
      });
      return { paragrafos, df };
    });
    livros.catch(() => (livros = null));
  }
  return livros;
}

// Os parágrafos dos livros que mais combinam com a consulta: [{ livro, trecho }].
export async function buscarNosLivros(consulta, { max = 4, maxChars = 1500 } = {}) {
  const todos = [...new Set(palavrasDe(consulta))];
  if (!todos.length || !fontesConfiguradas()) return [];
  const { paragrafos, df } = await carregarLivros();
  const n = paragrafos.length;
  const peso = (t) => (df.has(t) ? Math.log(1 + n / df.get(t)) : 0);
  // Consulta longa (um parágrafo do estudo, um capítulo): ficam as 14 palavras mais raras, que dizem do que ela trata.
  const termos = todos.map((t) => [t, peso(t)]).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  if (!termos.length) return [];
  const pesos = termos.map(peso);
  const pontuados = [];
  for (const p of paragrafos) {
    let pontos = 0;
    let achadas = 0;
    termos.forEach((t, i) => { if (p.palavras.has(t) && pesos[i]) { pontos += pesos[i]; achadas++; } });
    if (achadas >= Math.min(2, termos.length)) pontuados.push({ p, pontos: pontos * (1 + achadas / termos.length) });
  }
  pontuados.sort((a, b) => b.pontos - a.pontos);
  return pontuados.slice(0, max).map(({ p }) => {
    let trecho = p.texto;
    if (trecho.length > maxChars) { const corte = trecho.lastIndexOf(". ", maxChars); trecho = trecho.slice(0, corte > 300 ? corte + 1 : maxChars); }
    return { livro: p.livro, trecho };
  });
}

// Começa a baixar os arquivos enquanto a IA ainda escreve a resposta, para a busca não esperar o download depois.
export function precarregarFontes({ biblia: comBiblia, perspicaz: comPerspicaz, livros: comLivros }) {
  if (!fontesConfiguradas()) return;
  if (comBiblia) carregarBiblia().catch(() => {});
  if (comPerspicaz) carregarPerspicaz().catch(() => {});
  if (comLivros) carregarLivros().catch(() => {});
}
