// Considerações para o serviço de campo (6.11.53): as fontes do esboço da reunião para o serviço de campo (a consideração que o
// dirigente faz antes de sair para pregar). Tudo o que não depende da IA fica aqui, para ser testado sem rede de IA:
// - A Sentinela de maio de 2024, "Deixe o amor motivar você a pregar" (fonte prioritária), lida no wol.jw.org (o www.jw.org barra o
//   servidor), com o rodízio dos parágrafos guardado no aparelho (o app manda os números já usados);
// - os artigos complementares de A Sentinela sobre o ministério (até 2 por esboço, o que mais combina com o assunto primeiro);
// - as lições das brochuras Ame as Pessoas (lmd) e Melhore Sua Leitura e Seu Ensino (th) e trechos do Beneficie-se (be), dos arquivos
//   do servidor;
// - os dados do pedido, conferidos.
// Nada aqui inventa conteúdo: o que não for achado fica de fora (e o título que não for achado na wol vai para o registro).
import { docDoArtigoDoGuia, paragrafosDoDocumento } from "./_wol.mjs";
import { licoesDaBrochura, buscarNosLivros, nomeDoLivro } from "./_fontes.mjs";

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

// A fonte principal. A edição de A Sentinela e o título exato (o título no wol termina com "!", que a busca ignora).
export const W24 = { codigo: "w24.05", ano: 2024, titulo: "Deixe o amor motivar você a pregar" };

// Os artigos complementares, do mais novo para o mais antigo (no empate, vale o mais novo). "edicao" só quando o título é curto e
// comum demais para ser achado sem ela (a busca do wol confere o começo da referência, ex.: "w18 outubro págs. 11-16").
export const COMPLEMENTARES = [
  { codigo: "w26.09", ano: 2026, titulo: "Seja rápido em ajudar quem mostra interesse nas boas novas" },
  { codigo: "w26.03", ano: 2026, titulo: "Como melhorar nossa arte de ensino" },
  { codigo: "w26.02", ano: 2026, titulo: "Mantenham os sentidos e sejam vigilantes" },
  { codigo: "w25.03", ano: 2025, titulo: "Imite o zelo de Jesus na pregação" },
  { codigo: "w22.11", ano: 2022, titulo: "Como Jeová nos ajuda a cumprir nosso ministério?" },
  { codigo: "w21.10", ano: 2021, titulo: "Não desista" },
  { codigo: "w21.07", ano: 2021, titulo: "Você pode ajudar no trabalho de fazer discípulos?" },
  { codigo: "w18.10", ano: 2018, edicao: "w18 outubro", titulo: "Ensine a verdade" },
];

// Os tipos de pregação da tela (o app manda os ids).
export const TIPOS_DE_PREGACAO = [
  { id: "casa", nome: "casa em casa" },
  { id: "publico", nome: "testemunho público (carrinho, ruas, praças, pontos de ônibus)" },
  { id: "revisitas", nome: "revisitas e estudos bíblicos" },
  { id: "cartas", nome: "cartas e telefone" },
  { id: "rural", nome: "território rural" },
  { id: "informal", nome: "testemunho informal" },
];

// Textos bíblicos que as regras do esboço citam (boas maneiras e conversa com o companheiro): o servidor manda o texto exato deles.
export const TEXTOS_DAS_REGRAS = ["2 Coríntios 6:3", "Lucas 10:4-6", "1 Tessalonicenses 5:11"];

// ---------- Comparação de palavras ----------
// A mesma ideia das buscas de _fontes.mjs: sem acentos, palavras de 4 letras ou mais, as comuns fora, e só as 6 primeiras letras
// ("pregar", "pregação" e "pregamos" contam como a mesma palavra).
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const COMUNS = new Set(
  ("para como mais isso essa esse esta este estes estas pelo pela pelos pelas seus suas quando porque sobre entre depois antes ainda muito " +
    "muitos muita muitas tambem pode podem podemos fazer outro outra outros outras nossa nosso nossos nossas vamos todos todas cada mesmo " +
    "mesma qual quais onde dela dele delas deles elas eles voce voces sera sempre assim tudo nada algo alguem coisa coisas isto aquele aquela " +
    "desde apenas somente seja sejam foram estao estava tinha temos tenha fazem fazer dois duas tres umas uns numa num aqui quem")
    .split(" ")
);
export function raizesDe(texto) {
  return [...new Set(semAcento(texto).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !COMUNS.has(w)).map((w) => w.slice(0, 6)))];
}
// Quantas palavras (raízes) da consulta aparecem no texto.
export function pontuar(raizes, texto) {
  if (!raizes.length) return 0;
  const doTexto = new Set(raizesDe(texto));
  return raizes.filter((r) => doTexto.has(r)).length;
}
const cortar = (texto, max) => {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, "") + "…";
};
const linha = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

// ---------- Artigos no wol.jw.org ----------
// Cada artigo (o principal e os complementares) é achado pelo título exato e lido parágrafo por parágrafo; fica guardado 24 horas
// (o que não foi achado, 1 hora, para não repetir a busca a cada pedido). O título não achado vai para o registro uma vez.
const artigosGuardados = new Map(); // codigo -> { quando, dados }
const naoAchadosAvisados = new Set();
export async function artigoDoWol(artigo, timeoutMs = 9000) {
  const guardado = artigosGuardados.get(artigo.codigo);
  if (guardado && Date.now() - guardado.quando < (guardado.dados ? DIA_MS : HORA_MS)) return guardado.dados;
  let dados = null;
  let falhou = false;
  try {
    const docId = await docDoArtigoDoGuia({ titulo: artigo.titulo, ano: artigo.ano, ...(artigo.edicao ? { edicao: artigo.edicao } : {}) }, timeoutMs);
    const doc = docId ? await paragrafosDoDocumento(docId, timeoutMs) : null;
    if (doc && doc.paragrafos.length) dados = { ...doc, docId };
  } catch (e) {
    falhou = true; // o wol não respondeu: tenta de novo no próximo pedido
    console.error("Serviço de campo: wol indisponível", artigo.codigo, e?.name, e?.message);
  }
  if (falhou) return null;
  artigosGuardados.set(artigo.codigo, { quando: Date.now(), dados });
  if (!dados && !naoAchadosAvisados.has(artigo.codigo)) {
    naoAchadosAvisados.add(artigo.codigo);
    console.log(`Serviço de campo: artigo não achado no wol.jw.org: ${artigo.codigo} "${artigo.titulo}"`);
  }
  return dados;
}

export const paragrafosW24 = (timeoutMs = 9000) => artigoDoWol(W24, timeoutMs);

// ---------- Rodízio dos parágrafos de w24.05 ----------
// Cada esboço usa pelo menos um parágrafo de w24.05. Os já usados (os das considerações salvas no aparelho) ficam para depois; quando
// todos já foram usados, o rodízio recomeça. Com assunto, vale o parágrafo que mais combina com ele (dos não usados; se nenhum
// combinar, de todos); sem assunto, o primeiro não usado (o parágrafo é que dá o assunto do dia).
function livresDoRodizio(paragrafos, usados) {
  const usadosSet = new Set((usados || []).map(Number));
  const livres = paragrafos.filter((p) => !usadosSet.has(p.numero));
  return livres.length ? { livres, reiniciou: false } : { livres: paragrafos, reiniciou: true };
}
const notaDoParagrafo = (raizes, p) => pontuar(raizes, `${p.subtitulo || ""} ${p.texto}`);

export function escolherParagrafoW24({ consulta = "", usados = [], paragrafos = [] } = {}) {
  if (!paragrafos.length) return null;
  const { livres, reiniciou } = livresDoRodizio(paragrafos, usados);
  const raizes = raizesDe(consulta);
  if (raizes.length) {
    const melhor = (lista) =>
      lista
        .map((p) => ({ p, n: notaDoParagrafo(raizes, p) }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n || a.p.numero - b.p.numero)[0];
    const achado = melhor(livres) || melhor(paragrafos);
    if (achado) return { paragrafo: achado.p, reiniciou, porAssunto: true };
  }
  return { paragrafo: livres[0], reiniciou, porAssunto: false };
}

// Os parágrafos candidatos para "Sugerir 3 assuntos": os não usados, de preferência os que combinam com o tipo de pregação e a
// campanha; sem combinação, espalhados pelo artigo (começo, meio e fim dos que restam), para os assuntos saírem diferentes.
export function candidatosW24({ consulta = "", usados = [], paragrafos = [], n = 3 } = {}) {
  if (!paragrafos.length) return [];
  const { livres } = livresDoRodizio(paragrafos, usados);
  const raizes = raizesDe(consulta);
  const comNota = livres.map((p) => ({ p, n: notaDoParagrafo(raizes, p) }));
  const escolhidos = comNota.filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.p.numero - b.p.numero).slice(0, n).map((x) => x.p);
  for (let k = 0; escolhidos.length < Math.min(n, livres.length) && k < n * 2; k++) {
    const p = livres[Math.min(livres.length - 1, Math.floor((k * livres.length) / n))];
    if (!escolhidos.includes(p)) escolhidos.push(p);
  }
  for (const p of livres) if (escolhidos.length < Math.min(n, livres.length) && !escolhidos.includes(p)) escolhidos.push(p);
  return escolhidos.sort((a, b) => a.numero - b.numero);
}

// ---------- Artigos complementares ----------
// Até "max" artigos que combinam com o assunto: nota = palavras do título × 2 + o melhor parágrafo; no empate, o mais novo. De cada
// um vão os 2 parágrafos que mais combinam, com o número (para o esboço citar o parágrafo).
export function escolherComplementares(consulta, docs, { max = 2 } = {}) {
  const raizes = raizesDe(consulta);
  if (!raizes.length) return [];
  return COMPLEMENTARES.map((artigo, ordem) => {
    const doc = docs[ordem];
    if (!doc) return null;
    const pars = doc.paragrafos
      .map((p) => ({ p, n: notaDoParagrafo(raizes, p) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.p.numero - b.p.numero);
    if (!pars.length) return null;
    return { artigo, doc, ordem, nota: pontuar(raizes, artigo.titulo) * 2 + pars[0].n, paragrafos: pars.slice(0, 2).map((x) => x.p).sort((a, b) => a.numero - b.numero) };
  })
    .filter(Boolean)
    .sort((a, b) => b.nota - a.nota || a.ordem - b.ordem)
    .slice(0, max)
    .map((x) => ({ codigo: x.artigo.codigo, titulo: x.doc.titulo || x.artigo.titulo, url: x.doc.url, paragrafos: x.paragrafos }));
}

export async function complementares(consulta, { max = 2, timeoutMs = 9000 } = {}) {
  const docs = await Promise.all(COMPLEMENTARES.map((a) => artigoDoWol(a, timeoutMs)));
  return {
    artigos: escolherComplementares(consulta, docs, { max }),
    naoAchados: COMPLEMENTARES.filter((_, i) => !docs[i]).map((a) => a.codigo),
  };
}

// ---------- Brochuras e Beneficie-se ----------
// As lições que mais combinam com o assunto (o nome da lição vale 3 vezes): primeiro a melhor de cada brochura marcada, depois as
// seguintes, até "max". O texto vai cortado (o esboço só precisa da ideia e da referência).
export function escolherLicoes(consulta, listas, { max = 3, maxChars = 900 } = {}) {
  const raizes = raizesDe(consulta);
  if (!raizes.length) return [];
  const ordenadas = listas.map((lista) =>
    (lista || [])
      .map((l) => ({ l, n: pontuar(raizes, l.nome) * 3 + pontuar(raizes, l.texto) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.l.licao - b.l.licao)
  );
  const escolhidas = ordenadas.map((o) => o[0]).filter(Boolean);
  const resto = ordenadas.flatMap((o) => o.slice(1)).sort((a, b) => b.n - a.n);
  return [...escolhidas, ...resto]
    .slice(0, max)
    .map(({ l }) => ({ sigla: l.sigla, licao: l.licao, nome: l.nome, texto: cortar(l.texto, maxChars) }));
}

export async function licoesQueCombinam(consulta, { lmd = true, th = true, max = 3 } = {}) {
  try {
    const listas = await Promise.all([lmd ? licoesDaBrochura("ameAsPessoas") : [], th ? licoesDaBrochura("melhoreLeitura") : []]);
    return escolherLicoes(consulta, listas, { max });
  } catch (e) {
    console.error("Serviço de campo: brochuras indisponíveis", e?.message);
    return [];
  }
}

export async function trechosBe(consulta) {
  try {
    return await buscarNosLivros(consulta, { max: 2, maxChars: 700, livros: [nomeDoLivro("beneficieEscola")] });
  } catch (e) {
    console.error("Serviço de campo: Beneficie-se indisponível", e?.message);
    return [];
  }
}

// ---------- Dados do pedido ----------
function hojeNoBrasil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function dadosDoCampo(body) {
  const b = body && typeof body === "object" ? body : {};
  const dataValida = typeof b.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.data) && !Number.isNaN(Date.parse(b.data + "T12:00:00Z"));
  const minutos = [5, 6, 7].includes(Number(b.minutos)) ? Number(b.minutos) : 5; // nunca mais de 7
  const tipos = Array.isArray(b.tipos) ? [...new Set(b.tipos.filter((t) => TIPOS_DE_PREGACAO.some((x) => x.id === t)))] : [];
  const f = b.fontes && typeof b.fontes === "object" ? b.fontes : {};
  const marcada = (k) => f[k] !== false; // todas marcadas por padrão
  return {
    data: dataValida ? b.data : hojeNoBrasil(),
    aposReuniao: b.aposReuniao === true,
    minutos,
    tipos: tipos.length ? tipos : ["casa"],
    campanha: linha(b.campanha, 200),
    publico: linha(b.publico, 200),
    assunto: linha(b.assunto, 200),
    fontes: { w24: marcada("w24"), lmd: marcada("lmd"), th: marcada("th"), sentinela: marcada("sentinela"), be: marcada("be") },
    usados: [...new Set((Array.isArray(b.usados) ? b.usados : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 200))].slice(0, 200),
    recentes: (Array.isArray(b.recentes) ? b.recentes : []).map((t) => linha(t, 160)).filter(Boolean).slice(0, 5),
    evitar: linha(b.evitar, 200),
  };
}

export const nomesDosTipos = (tipos) => tipos.map((id) => (TIPOS_DE_PREGACAO.find((t) => t.id === id) || {}).nome).filter(Boolean);

// "sábado, 21 de novembro de 2026" e "sáb 21/11" (para o título salvo).
export function dataPorExtenso(iso) {
  const d = new Date(iso + "T12:00:00Z");
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}
export function dataCurta(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" }).format(d).replace(/\.$/, "");
  return `${dia} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// A consulta que escolhe as lições, os artigos e os trechos: o assunto digitado; sem ele, o parágrafo de w24.05 do dia (que dá o
// assunto), com os tipos de pregação e a campanha.
export function consultaDoCampo(d, paragrafo) {
  if (d.assunto) return [d.assunto, d.campanha].filter(Boolean).join(" ");
  return [paragrafo ? `${paragrafo.subtitulo || ""} ${paragrafo.texto}` : "", nomesDosTipos(d.tipos).join(" "), d.campanha, "pregação ministério"].filter(Boolean).join(" ");
}

// ---------- Fontes no esboço ----------
// As siglas que um ponto pode citar na linha "Fonte": as das fontes que foram na mensagem (e a Bíblia não conta como fonte aqui).
export function siglasPermitidas({ paragrafo, licoes = [], artigos = [], be = [] }) {
  const siglas = new Set();
  if (paragrafo) siglas.add(W24.codigo);
  for (const l of licoes) siglas.add(l.sigla);
  for (const a of artigos) siglas.add(a.codigo);
  if (be.length) siglas.add("be");
  return [...siglas];
}

// A fonte que a IA indicou no ponto fica só se citar uma sigla permitida (ex.: "w24.05, § 7", "lmd lição 3", "th lição 4").
export function fonteDoPonto(texto, siglas) {
  const t = linha(texto, 160).replace(/^fontes?\s*:\s*/i, "");
  if (!t) return "";
  const n = semAcento(t);
  return siglas.some((s) => new RegExp(`(^|[^a-z0-9.])${semAcento(s).replace(/\./g, "\\.")}(?![a-z0-9])`).test(n)) ? t : "";
}

// O texto das fontes para a mensagem da IA (os rótulos estão na descrição da montagem, em _prompts.mjs).
export function textoDasFontesDoCampo({ paragrafo, reiniciou = false, licoes = [], artigos = [], be = [] }) {
  const partes = [];
  if (paragrafo) {
    partes.push(
      `A SENTINELA DE MAIO DE 2024, "${W24.titulo}" (fonte prioritária; use este parágrafo e cite "${W24.codigo}, § ${paragrafo.numero}")` +
        (reiniciou ? " [todos os parágrafos já tinham sido usados: o rodízio recomeçou]" : "") +
        `:\n§ ${paragrafo.numero}${paragrafo.subtitulo ? ` (subtítulo: ${paragrafo.subtitulo})` : ""}: ${paragrafo.texto}`
    );
  }
  if (licoes.length) {
    partes.push(
      "LIÇÕES DAS BROCHURAS (cite pelo número e pelo nome, ex.: \"lmd lição 3, Seja natural\"):\n" +
        licoes.map((l) => `[${l.sigla} lição ${l.licao}, ${l.nome}]\n${l.texto}`).join("\n\n")
    );
  }
  if (artigos.length) {
    partes.push(
      "OUTROS ARTIGOS DE A SENTINELA SOBRE O MINISTÉRIO (cite o parágrafo, ex.: \"w26.03, § 4\"):\n" +
        artigos.map((a) => `[${a.codigo}] ${a.titulo}\n` + a.paragrafos.map((p) => `§ ${p.numero}: ${p.texto}`).join("\n")).join("\n\n")
    );
  }
  if (be.length) {
    partes.push("BENEFICIE-SE DA ESCOLA DO MINISTÉRIO TEOCRÁTICO (be):\n" + be.map((t) => t.trecho).join("\n\n"));
  }
  return partes.join("\n\n");
}

// A lista de fontes do fim do esboço: a de w24.05 (sempre, quando entrou) e as que a IA citou de verdade.
export function listaDeFontes({ paragrafo, licoes = [], artigos = [], be = [] }, citado) {
  const n = semAcento(citado);
  const cita = (s) => new RegExp(`(^|[^a-z0-9.])${semAcento(s).replace(/\./g, "\\.")}(?![a-z0-9])`).test(n);
  const lista = [];
  if (paragrafo) lista.push(`${W24.codigo} — "${W24.titulo}", § ${paragrafo.numero}`);
  for (const l of licoes) if (cita(`${l.sigla} lição ${l.licao}`) || cita(`${l.sigla} lic ${l.licao}`) || n.includes(semAcento(l.nome))) lista.push(`${l.sigla} lição ${l.licao} — ${l.nome}`);
  for (const a of artigos) if (cita(a.codigo)) lista.push(`${a.codigo} — "${a.titulo}"`);
  if (be.length && cita("be")) lista.push("be — Beneficie-se da Escola do Ministério Teocrático");
  return lista;
}
