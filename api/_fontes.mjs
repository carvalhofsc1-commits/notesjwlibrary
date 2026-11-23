// Fontes de consulta da IA: Bíblia (Tradução do Novo Mundo) e Estudo Perspicaz das Escrituras, vols. 1 e 2.
// O arquivo começa com "_" para a Vercel não publicá-lo como rota.
//
// Os textos ficam num Vercel Blob PRIVADO (store "jwnotes-fontes", ligado ao projeto pela variável
// BLOB_READ_WRITE_TOKEN): só esta função os lê; o navegador nunca recebe os arquivos, só os versículos e as explicações
// pedidos. Cada instância do servidor baixa um arquivo uma vez e guarda o índice em memória, então a busca de um
// versículo ou de um verbete leva milissegundos (antes a IA abria os arquivos num ambiente de execução de código, o
// que levava dezenas de segundos).
import { blobConfigurado, get } from "./_blob.mjs";

const ARQUIVOS = {
  biblia: "fontes/biblia.txt",
  perspicaz1: "fontes/perspicaz_v1.txt",
  perspicaz2: "fontes/perspicaz_v2.txt",
  adoracaoPura: "fontes/adoracao_pura.txt",
  reinoDeDeus: "fontes/reino_de_deus.txt",
  principiosBiblicos: "fontes/principios_biblicos.txt",
  // Publicações adicionais (consulta da IA; arquivos privados em fontes/).
  raciocinios: "fontes/raciocinios.txt",
  glossarioNwt: "fontes/glossario_nwt.txt",
  introducaoBibliaEstudo: "fontes/introducao_biblia_estudo.txt",
  apendiceABibliaEstudo: "fontes/apendice_a_biblia_estudo.txt",
  apendiceBBibliaEstudo: "fontes/apendice_b_biblia_estudo.txt",
  apendiceCBibliaEstudo: "fontes/apendice_c_biblia_estudo.txt",
  guiaDePesquisa: "fontes/guia_de_pesquisa.txt",
  abreviacoesPublicacoes: "fontes/abreviacoes_publicacoes.txt",
  s38InstrucoesReuniao: "fontes/s38_instrucoes_reuniao_vida_e_ministerio.txt",
  manualEscolaMinisterio: "fontes/manual_escola_ministerio.txt",
  perguntasBiblicasRespondidas: "fontes/perguntas_biblicas_respondidas.txt",
  perguntasFrequentesTj: "fontes/perguntas_frequentes_tj.txt",
  beneficieEscola: "fontes/beneficie_escola.txt",
  organizados: "fontes/organizados.txt",
  // Brochuras do ministério (6.11.53): usadas nas considerações para o serviço de campo (e na busca dos livros).
  ameAsPessoas: "fontes/ame_as_pessoas.txt",
  melhoreLeitura: "fontes/melhore_leitura_ensino.txt",
  // Livros para a Adoração em Família e as demais consultas (6.12.58). Os de letras/tipo grande trazem o mesmo texto das edições comuns.
  achegueSeAJeova: "fontes/achegue_se_a_jeova.txt",
  familiaFeliz: "fontes/familia_feliz.txt",
  imiteSuaFe: "fontes/imite_sua_fe.txt",
  jesusOCaminho: "fontes/jesus_o_caminho.txt",
  historiasDaBiblia: "fontes/historias_da_biblia.txt",
  mantenhaSeNoAmorDeDeus: "fontes/mantenha_se_no_amor_de_deus.txt",
  testemunhoCabal: "fontes/testemunho_cabal.txt",
  venhaSerMeuSeguidor: "fontes/venha_ser_meu_seguidor.txt",
  andeCorajosamente: "fontes/ande_corajosamente.txt",
  jovensPerguntamV1: "fontes/jovens_perguntam_v1.txt",
  jovensPerguntamV2: "fontes/jovens_perguntam_v2.txt",
  // Brochuras (6.12.59).
  vocePodeTerFamiliaFeliz: "fontes/voce_pode_ter_familia_feliz.txt",
  vidaTeveUmCriador: "fontes/vida_teve_um_criador.txt",
  origemDaVida: "fontes/origem_da_vida.txt",
  // "Cante de Coração Para Jeová" (só letras): [{ numero, titulo, texto, assunto, letra }], gerado por converter_canticos_pdf.py (fora do repositório).
  canticos: "fontes/canticos.json",
  // Princípios Bíblicos para a Vida Cristã (scl) estruturado (6.12.68): verbetes → subverbetes → entradas, com ids estáveis
  // ("<verbete>.<n>"), versículos, relatos e o texto literal; gerado por scl_estruturado.py (fora do repositório).
  principiosIndice: "fontes/principios.json",
  // Catálogo de jw.org/pt/ensinos-biblicos/ (6.12.68): só título, caminho, link e trecho de ~500 caracteres (nunca o texto completo).
  ensinosBiblicos: "fontes/ensinos_biblicos.json",
};

const MAX_VERSICULOS_POR_REFERENCIA = 10;
const MAX_CHARS_VERSICULOS = 1200;
const MAX_CHARS_TRECHO_VERBETE = 2500;

export function fontesConfiguradas() {
  return Boolean(blobConfigurado() || process.env.FONTES_DIR);
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
  { chave: "raciocinios", nome: "Raciocínios à Base das Escrituras" },
  { chave: "glossarioNwt", nome: "Glossário da Tradução do Novo Mundo" },
  { chave: "introducaoBibliaEstudo", nome: "Introdução — Bíblia de Estudo (Tradução do Novo Mundo)" },
  { chave: "apendiceABibliaEstudo", nome: "Apêndice A — Bíblia de Estudo" },
  { chave: "apendiceBBibliaEstudo", nome: "Apêndice B — Bíblia de Estudo" },
  { chave: "apendiceCBibliaEstudo", nome: "Apêndice C — Bíblia de Estudo" },
  { chave: "guiaDePesquisa", nome: "Guia de Pesquisa para Testemunhas de Jeová" },
  { chave: "abreviacoesPublicacoes", nome: "Abreviaturas dos Títulos das Publicações" },
  { chave: "s38InstrucoesReuniao", nome: "Instruções para a Reunião Vida e Ministério (S-38)" },
  { chave: "manualEscolaMinisterio", nome: "Manual da Escola do Ministério Teocrático" },
  { chave: "perguntasBiblicasRespondidas", nome: "Perguntas Bíblicas Respondidas" },
  { chave: "perguntasFrequentesTj", nome: "Perguntas Frequentes sobre as Testemunhas de Jeová" },
  { chave: "beneficieEscola", nome: "Beneficie-se da Escola do Ministério Teocrático" },
  { chave: "organizados", nome: "Organizados para Fazer a Vontade de Jeová" },
  { chave: "ameAsPessoas", nome: "Ame as Pessoas — Faça Discípulos (lmd)" },
  { chave: "melhoreLeitura", nome: "Melhore Sua Leitura e Seu Ensino (th)" },
  { chave: "achegueSeAJeova", nome: "Achegue-se a Jeová (cl)" },
  { chave: "familiaFeliz", nome: "O Segredo de uma Família Feliz (fy)" },
  { chave: "imiteSuaFe", nome: "Imite a Sua Fé (ia)" },
  { chave: "jesusOCaminho", nome: "Jesus — o Caminho, a Verdade e a Vida (jy)" },
  { chave: "historiasDaBiblia", nome: "Aprenda com as Histórias da Bíblia (lfb)" },
  { chave: "mantenhaSeNoAmorDeDeus", nome: "Mantenha-se no Amor de Deus (lv)" },
  { chave: "testemunhoCabal", nome: "‘Dê Testemunho Cabal’ sobre o Reino de Deus (bt)" },
  { chave: "venhaSerMeuSeguidor", nome: "‘Venha Ser Meu Seguidor’ (cf)" },
  { chave: "andeCorajosamente", nome: "Ande Corajosamente com Deus (wcg)" },
  { chave: "jovensPerguntamV1", nome: "Os Jovens Perguntam — Respostas Práticas, volume 1 (yp1)" },
  { chave: "jovensPerguntamV2", nome: "Os Jovens Perguntam — Respostas Práticas, volume 2 (yp2)" },
  { chave: "vocePodeTerFamiliaFeliz", nome: "Você Pode Ter uma Família Feliz! (hf)" },
  { chave: "vidaTeveUmCriador", nome: "A Vida — Teve um Criador? (lc)" },
  { chave: "origemDaVida", nome: "A Origem da Vida — Cinco Perguntas Que Merecem Resposta (lf)" },
];

// O nome de um livro da busca pela chave (ex.: "beneficieEscola"), para filtrar os resultados de buscarNosLivros.
export function nomeDoLivro(chave) {
  return (LIVROS.find((l) => l.chave === chave) || {}).nome || "";
}

// A primeira linha de alguns arquivos é o cabeçalho da edição ("AME AS PESSOAS — FAÇA DISCÍPULOS (lmd). Edição de maio de 2023 · ©…"):
// não é matéria e fica fora da busca.
const CABECALHO_DA_EDICAO = /^[^\n]{0,140}\([a-z0-9-]{1,8}\)\.\s+Edição de /;
const PALAVRAS_COMUNS = new Set("a o as os um uma de do da dos das em no na nos nas por para com sem sobre entre que se e ou mas como mais muito ao aos ela ele eles elas seu sua seus suas nao ja foi ser sao era tem ter isso este esta esse essa aquele quando onde qual quais".split(" "));
let livros = null; // Promise<{ paragrafos: [{ livro, texto, palavras: Set }], df: Map }>

function palavrasDe(texto) {
  return normalizar(texto).split(" ").filter((w) => w.length > 2 && !PALAVRAS_COMUNS.has(w));
}

function carregarLivros() {
  if (!livros) {
    // allSettled: se um arquivo ainda não estiver no armazenamento, os demais continuam disponíveis.
    livros = Promise.allSettled(LIVROS.map((l) => baixar(ARQUIVOS[l.chave]))).then((resultados) => {
      const paragrafos = [];
      const df = new Map();
      resultados.forEach((resultado, i) => {
        if (resultado.status !== "fulfilled") {
          console.error(`Fonte indisponível (${LIVROS[i].chave}): ${ARQUIVOS[LIVROS[i].chave]}`, resultado.reason?.message || resultado.reason);
          return;
        }
        for (const bruto of resultado.value.split(/\r?\n\s*\r?\n/)) {
          const texto = bruto.replace(/\s+/g, " ").trim();
          if (texto.length < 80 || (texto.length < 200 && /\?$/.test(texto))) continue; // fora: sobras de quadro e perguntas soltas
          if (CABECALHO_DA_EDICAO.test(texto)) continue;
          const sequencia = palavrasDe(texto);
          const palavras = new Set(sequencia);
          for (const w of palavras) df.set(w, (df.get(w) || 0) + 1);
          // Pares de palavras seguidas ("conselheiro assistente"), para premiar o parágrafo que traz a expressão inteira (6.10.97);
          // os do começo (título da seção + primeira frase) contam à parte.
          const pares = new Set();
          for (let k = 1; k < sequencia.length; k++) pares.add(sequencia[k - 1] + " " + sequencia[k]);
          const paresInicio = new Set(sequencia.slice(0, 12).map((w, k, s) => (k ? s[k - 1] + " " + w : "")).filter(Boolean));
          paragrafos.push({ livro: LIVROS[i].nome, texto, palavras, pares, paresInicio });
        }
      });
      return { paragrafos, df };
    });
    livros.catch(() => (livros = null));
  }
  return livros;
}

// Os parágrafos dos livros que mais combinam com a consulta: [{ livro, trecho }]. "livros" (nomes, opcional) limita a busca a esses livros.
export async function buscarNosLivros(consulta, { max = 4, maxChars = 1500, livros: soEstes = null } = {}) {
  const todos = [...new Set(palavrasDe(consulta))];
  if (!todos.length || !fontesConfiguradas()) return [];
  const { paragrafos, df } = await carregarLivros();
  const n = paragrafos.length;
  const peso = (t) => (df.has(t) ? Math.log(1 + n / df.get(t)) : 0);
  // Consulta longa (um parágrafo do estudo, um capítulo): ficam as 14 palavras mais raras, que dizem do que ela trata.
  const termos = todos.map((t) => [t, peso(t)]).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  if (!termos.length) return [];
  const pesos = termos.map(peso);
  // Expressões da consulta (pares de palavras seguidas, na ordem digitada): "conselheiro assistente", "vida ministerio"…
  const seqConsulta = palavrasDe(consulta);
  const paresConsulta = [...new Set(seqConsulta.slice(1).map((w, k) => seqConsulta[k] + " " + w))]
    .map((par) => [par, par.split(" ").reduce((s, w) => s + peso(w), 0)])
    .filter(([, p]) => p > 0);
  const pontuados = [];
  for (const p of paragrafos) {
    if (soEstes && !soEstes.includes(p.livro)) continue;
    let pontos = 0;
    let achadas = 0;
    termos.forEach((t, i) => { if (p.palavras.has(t) && pesos[i]) { pontos += pesos[i]; achadas++; } });
    if (achadas < Math.min(2, termos.length)) continue;
    pontos *= 1 + achadas / termos.length;
    // A expressão inteira vale mais; no começo do parágrafo (título da seção ou primeira frase), mais ainda: é o parágrafo que trata do assunto.
    for (const [par, p2] of paresConsulta) {
      if (p.paresInicio.has(par)) pontos += p2 * 3;
      else if (p.pares.has(par)) pontos += p2 * 0.6;
    }
    pontuados.push({ p, pontos });
  }
  pontuados.sort((a, b) => b.pontos - a.pontos || a.p.texto.length - b.p.texto.length);
  return pontuados.slice(0, max).map(({ p }) => {
    let trecho = p.texto;
    if (trecho.length > maxChars) { const corte = trecho.lastIndexOf(". ", maxChars); trecho = trecho.slice(0, corte > 300 ? corte + 1 : maxChars); }
    return { livro: p.livro, trecho };
  });
}

// ---------- Brochuras do ministério, lição por lição (6.11.53) ----------
// Ame as Pessoas — Faça Discípulos (lmd) e Melhore Sua Leitura e Seu Ensino (th), para as considerações para o serviço de campo citarem a
// lição pelo número e pelo nome. O índice do começo do arquivo dá os números e os nomes ("Interesse pelas pessoas 1" no lmd; "1 Comece bem"
// no th); no corpo, cada lição começa numa linha com o nome (no th, com o número na frente; às vezes o nome vem cortado, "9 Use desenhos,",
// ou sem o número). A lição vai até a próxima (ou até um título em letras espaçadas, "A P Ê N D I C E A", "R E G I S T R E…").
const BROCHURAS = {
  ameAsPessoas: { sigla: "lmd", numeroNoFim: true },
  melhoreLeitura: { sigla: "th", numeroNoFim: false },
};
const licoesGuardadas = new Map(); // chave -> Promise<[{ sigla, licao, nome, texto }]>

export function separarLicoes(conteudo, { sigla = "", numeroNoFim = false } = {}) {
  const linhas = String(conteudo || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const formato = numeroNoFim ? /^(.{3,90}?) (\d{1,2})$/ : /^(\d{1,2}) (.{3,90})$/;
  // O índice: as linhas "nome número" (ou "número nome") com os números em sequência, desde 1.
  const indice = [];
  let fimDoIndice = -1;
  for (let i = 0; i < linhas.length && i - Math.max(fimDoIndice, 0) < 40; i++) {
    const m = linhas[i].match(formato);
    if (!m) continue;
    const numero = Number(numeroNoFim ? m[2] : m[1]);
    const nome = numeroNoFim ? m[1] : m[2];
    if (numero === indice.length + 1) {
      indice.push({ licao: numero, nome });
      fimDoIndice = i;
    } else if (numero === 1 && indice.length) break; // voltou ao 1: é o corpo
  }
  if (!indice.length) return [];
  const prefixoDoNome = (linha, licao) => {
    const sem = linha.replace(new RegExp(`^${licao}\\s+`), "");
    if (sem.length > 90) return "";
    return normalizar(sem);
  };
  const ehTituloEspacado = (linha) => /^(?:\S{1,2} ){3,}\S{1,2}$/.test(linha);
  // O começo de cada lição no corpo, em ordem.
  const inicios = [];
  let desde = fimDoIndice + 1;
  for (const item of indice) {
    const nome = normalizar(item.nome);
    let achou = -1;
    for (let i = desde; i < linhas.length; i++) {
      const p = prefixoDoNome(linhas[i], item.licao);
      if (p.length >= 6 && nome.startsWith(p) && (p === nome || linhas[i].startsWith(item.licao + " "))) { achou = i; break; }
      if (p === nome) { achou = i; break; }
    }
    inicios.push(achou);
    if (achou >= 0) desde = achou + 1;
  }
  const licoes = [];
  indice.forEach((item, k) => {
    const inicio = inicios[k];
    if (inicio < 0) return;
    let fim = linhas.length;
    const proximo = inicios.slice(k + 1).find((x) => x > inicio);
    if (proximo !== undefined) fim = proximo;
    // No lmd, antes do nome da lição vêm a seção ("INICIANDO CONVERSAS") e o texto-base: são da lição seguinte.
    if (numeroNoFim && proximo !== undefined) {
      for (let j = proximo - 1; j > inicio && j >= proximo - 2; j--) {
        if (linhas[j] === linhas[j].toUpperCase() && /[A-ZÀ-Ý]{4}/.test(linhas[j])) { fim = j; break; }
      }
    }
    // No th, quando o nome da próxima lição vem cortado, o resto dele aparece numa linha logo antes ("você leu o texto"): não é desta lição.
    const nomeSeguinte = proximo !== undefined ? normalizar(indice[inicios.indexOf(proximo)]?.nome || "") : "";
    const corpo = [];
    for (let i = inicio + 1; i < fim; i++) {
      const l = linhas[i].replace(/\s+\($/, "");
      if (ehTituloEspacado(l)) break;
      if (/^LEITURA E ENSINO \d+/.test(l) || l === "(") continue; // rodapés de página e sobras
      if (i >= fim - 3 && nomeSeguinte && l.length < 40 && nomeSeguinte.endsWith(normalizar(l))) continue;
      corpo.push(l);
    }
    licoes.push({ sigla, licao: item.licao, nome: item.nome.replace(/[,\s]+$/, ""), texto: corpo.join("\n") });
  });
  return licoes;
}

// As lições de uma brochura (chave "ameAsPessoas" ou "melhoreLeitura"): [{ sigla, licao, nome, texto }]. [] se o arquivo não estiver disponível.
export function licoesDaBrochura(chave) {
  const config = BROCHURAS[chave];
  if (!config || !fontesConfiguradas()) return Promise.resolve([]);
  if (!licoesGuardadas.has(chave)) {
    const promessa = baixar(ARQUIVOS[chave]).then((conteudo) => separarLicoes(conteudo, config));
    promessa.catch(() => licoesGuardadas.delete(chave));
    licoesGuardadas.set(chave, promessa);
  }
  return licoesGuardadas.get(chave);
}

// ---------- Guia de Pesquisa (arquivo do servidor) ----------
// O Guia de Pesquisa para Testemunhas de Jeová em texto (fontes/guia_de_pesquisa.txt): uma linha por tópico ("ANSIEDADE. Veja: …" e blocos
// "### Subtítulo título código págs. 2-3 título código…"). O jw.org barra o servidor, então o Guia não pode mais ser lido de lá; daqui saem os
// tópicos e, de cada um, os artigos (título, código da publicação e páginas/parágrafos). O wol é quem entrega o texto (veja _wol.mjs).
let guiaLocal = null; // Promise<[{ nome, texto }]>

function lerTopicosDoGuia(texto) {
  const topicos = [];
  let atual = null;
  const cabecalho = /^([A-ZÀ-Ý0-9][A-ZÀ-Ý0-9 ,'’“”()\-:/.·ªº]*?)\.(?: (.*))?$/;
  for (const linha of texto.replace(/[⁠­]/g, "").split(/\r?\n/)) {
    if (!linha.trim() || linha.startsWith("## ")) continue; // as linhas "## 5:14 …" são o índice de textos bíblicos
    const m = linha.startsWith("###") ? null : linha.match(cabecalho);
    if (m && /[A-ZÀ-Ý]{2}/.test(m[1]) && m[1] === m[1].toUpperCase()) {
      if ((m[2] || "").startsWith("##")) { atual = null; continue; } // "TIAGO. ## 1:1 …": começa a seção de versículos do livro
      atual = { nome: m[1], texto: m[2] || "" };
      topicos.push(atual);
      continue;
    }
    if (atual) atual.texto += "\n" + linha;
  }
  return topicos;
}

export function guiaLocalTopicos() {
  if (!fontesConfiguradas()) return Promise.resolve([]);
  if (!guiaLocal) {
    guiaLocal = baixar(ARQUIVOS.guiaDePesquisa).then(lerTopicosDoGuia);
    guiaLocal.catch(() => (guiaLocal = null));
  }
  return guiaLocal;
}

// Códigos que não são artigo para ler no wol: apostila Vida e Ministério, Bíblia, Perspicaz, Raciocínios, índices e outros.
const NAO_ARTIGO_GUIA = /^(?:mwb\d*|nwt\w*|si|rs|scl|it|dx\d*|es\d*|km|yb\d*|kl|od|ia|bh|bhs|fy|rsg\d*)$/i;
const SUBTITULOS_DO_GUIA = /^(?:Informações gerais|Como lidar|Ajudar outros|Ajuda de outros|Experiências pessoais|Personagens da Bíblia|Vida cristã|Lições|Profecias|Membros da família|Exatidão da Bíblia e arqueologia|Tempos bíblicos|Mapas e geografia|Títulos e funções|História das Testemunhas de Jeová|Orientações para a congregação|Cronologia|Costumes|Mostrar a outros|Reuniões|Pregação|Casamento)\s+/i;
const LOCALIZADOR_DO_GUIA = /(?<![\p{L}\d.\-])([a-z]{1,6}(?:-\d)?(?:\d{2}(?:\.\d{2})?)?(?:\s\d{1,2}\/\d{1,2})?(?:\sN\.°\s?\d+)?)\s+((?:págs?\.\s*\d+(?:\s*[-–]\s*\d+)?(?:,\s*\d+(?:[-–]\d+)?)*|artigo\s+\d+|lição\s+\d+|cap\.\s*\d+))((?:\s+pars?\.\s*\d+(?:\s*[-–]\s*\d+)?(?:,\s*\d+(?:[-–]\d+)?)*)?)(?:\s+pontos?\s+[\d–-]+)?/gu;

// Os artigos de um tópico, na ordem do Guia: [{ subtitulo, titulo, codigo, ano, parDe, parAte }].
export function artigosDoTopicoDoGuia(topico) {
  if (topico.artigos) return topico.artigos;
  const artigos = [];
  const vistos = new Set();
  for (const parte of String(topico.texto || "").split(/(?:^|\s)###\s+/).slice(1)) {
    const subtitulo = (parte.match(SUBTITULOS_DO_GUIA) || [""])[0].trim() || parte.split(/\s+/).slice(0, 2).join(" ");
    let texto = parte
      .replace(/it-\d\s+“[^”]*”(?:\s+n\.º\s*[\d\sn.º–-]+)?(?:\s+pars?\.\s*[\d\s,–-]+)?/g, " ") // verbetes do Perspicaz: o servidor já os lê à parte
      .replace(/\s+/g, " ");
    texto = texto.replace(SUBTITULOS_DO_GUIA, "").replace(SUBTITULOS_DO_GUIA, ""); // até dois níveis ("Vida cristã Casamento")
    let ultimo = 0;
    for (const m of texto.matchAll(LOCALIZADOR_DO_GUIA)) {
      let titulo = texto.slice(ultimo, m.index);
      ultimo = m.index + m[0].length;
      const codigo = m[1].trim();
      if (NAO_ARTIGO_GUIA.test((codigo.match(/^[a-z]+/i) || [""])[0])) continue;
      titulo = titulo.replace(/^.*\S\.v\s+/, "").replace(/^\d+\s*\|?\s*/, "").replace(/^[\s|]+/, "").trim(); // sem o vídeo anterior (código ".v") e sem o número da lista
      if (titulo.length < 6 || titulo.length > 170 || /^veja:/i.test(titulo)) continue;
      const aa = (codigo.match(/^[a-z-]+?(\d{2})\b/i) || codigo.match(/^g\s+\d{1,2}\/(\d{2})\b/i) || [])[1];
      const ano = aa ? (Number(aa) > 50 ? 1900 : 2000) + Number(aa) : null;
      if (ano && ano < 1990) continue;
      const chave = codigo + "|" + m[2] + "|" + m[3];
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const pars = String(m[3] || "").match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
      artigos.push({ subtitulo, titulo, codigo: `${codigo} ${m[2]}${m[3] || ""}`.trim(), ano, parDe: pars ? Number(pars[1]) : null, parAte: pars ? Number(pars[2] || pars[1]) : null });
    }
  }
  topico.artigos = artigos;
  return artigos;
}

// ---------- Inventário dos arquivos de consulta (página do administrador em Ajustes) ----------
// Para cada arquivo de fontes/: nome da publicação, tamanho, data de envio ao servidor e o que dá para ler no próprio conteúdo sobre a edição
// (a Sentinela mais nova citada no Guia, o ano dos direitos autorais, o ano mais recente citado). A edição "de verdade" é anotada pelo
// administrador (config "fontes-edicoes"), porque os arquivos não trazem a edição escrita.
const NOMES_DAS_FONTES = {
  biblia: "Bíblia — Tradução do Novo Mundo (texto dos versículos)",
  perspicaz_v1: "Estudo Perspicaz das Escrituras, volume 1 (it-1)",
  perspicaz_v2: "Estudo Perspicaz das Escrituras, volume 2 (it-2)",
  adoracao_pura: "A Adoração Pura de Jeová É Restaurada! (rr)",
  reino_de_deus: "O Reino de Deus Já Governa! (kr)",
  principios_biblicos: "Princípios Bíblicos para a Vida Cristã (scl)",
  principios: "Princípios Bíblicos para a Vida Cristã (scl) — estruturado (verbetes e entradas)",
  ensinos_biblicos: "Ensinos Bíblicos do jw.org — catálogo (títulos, links e trechos)",
  raciocinios: "Raciocínios à Base das Escrituras (rs)",
  glossario_nwt: "Glossário da Tradução do Novo Mundo",
  introducao_biblia_estudo: "Introdução — Bíblia de Estudo (nwtsty)",
  apendice_a_biblia_estudo: "Apêndice A — Bíblia de Estudo",
  apendice_b_biblia_estudo: "Apêndice B — Bíblia de Estudo",
  apendice_c_biblia_estudo: "Apêndice C — Bíblia de Estudo",
  guia_de_pesquisa: "Guia de Pesquisa para Testemunhas de Jeová",
  abreviacoes_publicacoes: "Abreviaturas dos Títulos das Publicações",
  s38_instrucoes_reuniao_vida_e_ministerio: "Instruções para a Reunião Vida e Ministério (S-38)",
  manual_escola_ministerio: "Manual da Escola do Ministério Teocrático",
  perguntas_biblicas_respondidas: "Perguntas Bíblicas Respondidas",
  perguntas_frequentes_tj: "Perguntas Frequentes sobre as Testemunhas de Jeová",
  beneficie_escola: "Beneficie-se da Escola do Ministério Teocrático",
  organizados: "Organizados para Fazer a Vontade de Jeová (od)",
  ame_as_pessoas: "Ame as Pessoas — Faça Discípulos (lmd)",
  melhore_leitura_ensino: "Melhore Sua Leitura e Seu Ensino (th)",
  achegue_se_a_jeova: "Achegue-se a Jeová (cl)",
  familia_feliz: "O Segredo de uma Família Feliz (fy)",
  imite_sua_fe: "Imite a Sua Fé (ia)",
  jesus_o_caminho: "Jesus — o Caminho, a Verdade e a Vida (jy)",
  historias_da_biblia: "Aprenda com as Histórias da Bíblia (lfb)",
  mantenha_se_no_amor_de_deus: "Mantenha-se no Amor de Deus (lv)",
  testemunho_cabal: "‘Dê Testemunho Cabal’ sobre o Reino de Deus (bt) — letras grandes",
  venha_ser_meu_seguidor: "‘Venha Ser Meu Seguidor’ (cf) — tipo grande",
  ande_corajosamente: "Ande Corajosamente com Deus (wcg) — letras grandes",
  jovens_perguntam_v1: "Os Jovens Perguntam — Respostas Práticas, volume 1 (yp1)",
  jovens_perguntam_v2: "Os Jovens Perguntam — Respostas Práticas, volume 2 (yp2)",
  voce_pode_ter_familia_feliz: "Você Pode Ter uma Família Feliz! (hf)",
  vida_teve_um_criador: "A Vida — Teve um Criador? (lc)",
  origem_da_vida: "A Origem da Vida — Cinco Perguntas Que Merecem Resposta (lf)",
  canticos: "Cante de Coração Para Jeová (letras dos cânticos)",
};
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const detectadoCache = new Map(); // caminho -> { atualizado, texto }

// A edição mais nova entre os códigos "w26.12" do texto, como "w26.12 (dezembro de 2026)".
function maisNovoCodigo(texto, simbolo) {
  let melhor = null;
  for (const m of texto.matchAll(new RegExp(`(?<![A-Za-z0-9])${simbolo}(\\d{2})\\.(\\d{2})(?!\\d)`, "g"))) {
    const ano = 2000 + Number(m[1]);
    const mes = Number(m[2]);
    if (mes < 1 || mes > 12 || ano > new Date().getFullYear() + 2) continue;
    if (!melhor || ano * 12 + mes > melhor.ano * 12 + melhor.mes) melhor = { ano, mes, codigo: `${simbolo}${m[1]}.${m[2]}` };
  }
  return melhor ? `${melhor.codigo} (${MESES_PT[melhor.mes - 1]} de ${melhor.ano})` : "";
}

function detectarEdicao(chave, texto) {
  const partes = [];
  if (chave === "guia_de_pesquisa") {
    const w = maisNovoCodigo(texto, "w");
    const mwb = maisNovoCodigo(texto, "mwb");
    if (w) partes.push("A Sentinela mais nova citada: " + w);
    if (mwb) partes.push("Apostila mais nova citada: " + mwb);
  }
  const direitos = (texto.match(/©\s*((?:19|20)\d{2}(?:\s*,\s*(?:19|20)\d{2})*)/) || [])[1];
  if (direitos) partes.push("Direitos autorais: " + direitos.replace(/\s+/g, " "));
  if (!partes.length) {
    // Sem nada mais claro: o ano mais recente que o texto cita (aproximado; vale como pista).
    const anos = [...texto.matchAll(/(?<!\d)((?:19|20)\d{2})(?!\d)/g)].map((m) => Number(m[1])).filter((a) => a >= 1950 && a <= new Date().getFullYear() + 1);
    if (anos.length >= 2) partes.push("Ano mais recente citado no texto: " + Math.max(...anos) + " (aproximado)");
  }
  return partes.join(" · ");
}

// O que um arquivo JSON de fontes/ traz: cânticos (lista), princípios (verbetes/entradas) ou o catálogo dos Ensinos Bíblicos (artigos).
export function resumoDoJson(conteudo) {
  try {
    const j = JSON.parse(conteudo);
    if (Array.isArray(j)) return `${j.length} cânticos`;
    const partes = [];
    if (Array.isArray(j?.entradas)) partes.push(`${j.entradas.length} entradas`, `${(j.verbetes || []).length} verbetes`);
    if (Array.isArray(j?.artigos)) partes.push(`${j.artigos.length} páginas`, `${j.artigos.filter((a) => a.ciencia).length} de ciência`);
    if (j?.edicao) partes.push(j.edicao);
    if (j?.gerado) partes.push("gerado em " + j.gerado);
    return partes.join(" · ");
  } catch {
    return "";
  }
}

// [{ caminho, chave, nome, tamanho, enviadoEm, detectado }] de todos os arquivos de fontes/ (mais as que estão no código e ainda não foram enviadas).
export async function inventarioDasFontes() {
  const { list } = await import("./_blob.mjs");
  const noServidor = new Map();
  try {
    const r = await list({ prefix: "fontes/", limit: 500 });
    for (const b of r.blobs || []) noServidor.set(b.pathname, b);
  } catch (e) {
    console.error("Inventário das fontes: não consegui listar o armazenamento", e?.message);
  }
  const itens = [];
  const caminhosCodigo = new Map(Object.entries(ARQUIVOS).map(([chave, caminho]) => [caminho, chave]));
  const todos = new Set([...noServidor.keys(), ...caminhosCodigo.keys()]);
  for (const caminho of [...todos].sort()) {
    const arquivo = noServidor.get(caminho);
    const nomeArquivo = caminho.split("/").pop().replace(/\.[a-z]+$/i, "");
    let detectado = "";
    if (arquivo) {
      const atualizado = new Date(arquivo.uploadedAt).getTime();
      const guardado = detectadoCache.get(caminho);
      if (guardado && guardado.atualizado === atualizado) detectado = guardado.texto;
      else {
        try {
          const conteudo = await baixar(caminho);
          detectado = caminho.endsWith(".json") ? resumoDoJson(conteudo) : detectarEdicao(nomeArquivo, conteudo);
        } catch { detectado = ""; }
        detectadoCache.set(caminho, { atualizado, texto: detectado });
      }
    }
    itens.push({
      caminho,
      nome: NOMES_DAS_FONTES[nomeArquivo] || nomeArquivo,
      tamanho: arquivo ? arquivo.size : null,
      enviadoEm: arquivo ? new Date(arquivo.uploadedAt).toISOString() : null,
      noServidor: Boolean(arquivo),
      detectado,
    });
  }
  return itens;
}

// Começa a baixar os arquivos enquanto a IA ainda escreve a resposta, para a busca não esperar o download depois.
export function precarregarFontes({ biblia: comBiblia, perspicaz: comPerspicaz, livros: comLivros }) {
  if (!fontesConfiguradas()) return;
  if (comBiblia) carregarBiblia().catch(() => {});
  if (comPerspicaz) carregarPerspicaz().catch(() => {});
  if (comLivros) carregarLivros().catch(() => {});
}

// O texto bruto de uma fonte pela chave de ARQUIVOS (ex.: "apendiceBBibliaEstudo", para as datas do jogo "Ordem e data" da Adoração em
// Família, 6.12.72). null se a chave não existir ou o arquivo estiver indisponível.
export async function lerTextoDoLivro(chave) {
  if (!ARQUIVOS[chave] || !fontesConfiguradas()) return null;
  try {
    return await baixar(ARQUIVOS[chave]);
  } catch (e) {
    console.error(`Fonte indisponível (${chave})`, e?.message);
    return null;
  }
}

// Os 151 cânticos com a letra (para sugerir o cântico inicial do discurso público). null se o arquivo ainda não foi enviado ao Blob.
let canticosGuardados = null;
export async function lerCanticos() {
  if (canticosGuardados) return canticosGuardados;
  try {
    const lista = JSON.parse(await baixar(ARQUIVOS.canticos));
    canticosGuardados = Array.isArray(lista) ? lista.filter((c) => c && Number.isInteger(c.numero) && c.titulo && c.letra) : [];
    return canticosGuardados;
  } catch (e) {
    console.error("Cânticos: arquivo indisponível", e?.message);
    return null;
  }
}

// Princípios Bíblicos (scl) estruturado: { publicacao, sigla, edicao, gerado, categorias, verbetes, entradas }, com as entradas
// filtradas às válidas (id, verbete e texto). null se o arquivo ainda não foi enviado ao armazenamento.
let principiosGuardados = null;
export async function lerPrincipios() {
  if (principiosGuardados) return principiosGuardados;
  try {
    const j = JSON.parse(await baixar(ARQUIVOS.principiosIndice));
    if (!j || !Array.isArray(j.entradas)) throw new Error("formato inesperado");
    principiosGuardados = { ...j, entradas: j.entradas.filter((e) => e && e.id && e.verbete && e.texto) };
    return principiosGuardados;
  } catch (e) {
    console.error("Princípios: arquivo indisponível", e?.message);
    return null;
  }
}

// Catálogo dos Ensinos Bíblicos do jw.org: { fonte, gerado, total, artigos: [{ id, secao, caminho, titulo, url, trecho, ciencia, tipo
// ("artigo" | "indice"), video, docId, listadoEm?, externo? }] }. "externo": artigo listado numa seção, mas guardado fora de
// /pt/ensinos-biblicos/ (ex.: revistas); "listadoEm": ids das páginas-índice que o listam. null se o arquivo ainda não foi enviado.
let ensinosGuardados = null;
export async function lerEnsinosBiblicos() {
  if (ensinosGuardados) return ensinosGuardados;
  try {
    const j = JSON.parse(await baixar(ARQUIVOS.ensinosBiblicos));
    if (!j || !Array.isArray(j.artigos)) throw new Error("formato inesperado");
    ensinosGuardados = { ...j, artigos: j.artigos.filter((a) => a && a.id && a.titulo && a.url) };
    return ensinosGuardados;
  } catch (e) {
    console.error("Ensinos Bíblicos: arquivo indisponível", e?.message);
    return null;
  }
}
