// Considerações para o serviço de campo (6.11.53): as fontes do esboço da reunião para o serviço de campo (a consideração que o
// dirigente faz antes de sair para pregar). Tudo o que não depende da IA fica aqui, para ser testado sem rede de IA:
// - A Sentinela de maio de 2024, "Deixe o amor motivar você a pregar" (fonte prioritária), lida no wol.jw.org (o www.jw.org barra o
//   servidor), com o rodízio dos parágrafos guardado no aparelho (o app manda os números já usados);
// - os artigos complementares de A Sentinela sobre o ministério (até 2 por esboço, o que mais combina com o assunto primeiro);
// - as lições das brochuras Ame as Pessoas (lmd) e Melhore Sua Leitura e Seu Ensino (th) e trechos do Beneficie-se (be), dos arquivos
//   do servidor;
// - os dados do pedido, conferidos.
// Nada aqui inventa conteúdo: o que não for achado fica de fora (e o título que não for achado na wol vai para o registro).
import { docDoArtigoDoGuia, paragrafosDoDocumento, pesquisarMateriasNovasNoWol, paragrafoDaPesquisa, lerArtigoDoWol } from "./_wol.mjs";

// Matéria de capa do jw.org (6.15.23): a sigla que os pontos citam e o texto da matéria, lido no wol.jw.org pelo número do documento.
export const SIGLA_CAPA = "jw.org";
export async function textoDaCapa(capa, timeoutMs = 9000) {
  if (!capa || !capa.docId) return null;
  try {
    const a = await lerArtigoDoWol(`https://wol.jw.org/pt/wol/d/r5/lp-t/${capa.docId}`, { timeoutMs, maxCaracteres: 7000, estruturado: true });
    return a && a.texto ? { ...capa, titulo: capa.titulo || a.titulo, texto: a.texto } : null;
  } catch (e) {
    console.error("Serviço de campo: matéria de capa indisponível no wol", e?.message);
    return null;
  }
}
import { licoesDaBrochura, buscarNosLivros, nomeDoLivro } from "./_fontes.mjs";

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

// A fonte principal. A edição de A Sentinela e o título exato (o título no wol termina com "!", que a busca ignora).
// "docId" (6.11.55): o número do documento no wol.jw.org (https://wol.jw.org/pt/wol/d/r5/lp-t/<docId>), achado uma vez navegando
// pela edição; é lido direto, e a busca pelo título fica só de reserva (se o docId mudar ou o título lido não bater).
export const W24 = { codigo: "w24.05", ano: 2024, docId: 2024406, titulo: "Deixe o amor motivar você a pregar" };

// Os artigos complementares, do mais novo para o mais antigo (no empate, vale o mais novo). "edicao" só quando o título é curto e
// comum demais para ser achado sem ela (a busca do wol confere o começo da referência, ex.: "w18 outubro págs. 11-16").
// "Não desista!" (w21.10, págs. 24-28) não é achado pela busca (a frase é comum demais): só o docId o acha.
export const COMPLEMENTARES = [
  { codigo: "w26.09", ano: 2026, docId: 2025566, titulo: "Seja rápido em ajudar quem mostra interesse nas boas novas" },
  { codigo: "w26.03", ano: 2026, docId: 2026320, titulo: "Como melhorar nossa arte de ensino" },
  { codigo: "w25.03", ano: 2025, docId: 2025322, titulo: "Imite o zelo de Jesus na pregação" },
  { codigo: "w23.02", ano: 2023, docId: 2023285, titulo: "Mantenham os sentidos, sejam vigilantes" },
  { codigo: "w22.11", ano: 2022, docId: 2022640, titulo: "Como Jeová nos ajuda a cumprir nosso ministério?" },
  { codigo: "w21.10", ano: 2021, docId: 2021605, edicao: "w21 outubro", titulo: "Não desista" },
  { codigo: "w21.07", ano: 2021, docId: 2021480, titulo: "Você pode ajudar no trabalho de fazer discípulos?" },
  { codigo: "w18.10", ano: 2018, docId: 2018604, edicao: "w18 outubro", titulo: "Ensine a verdade" },
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
// Cada artigo (o principal e os complementares) é lido pelo docId fixo (6.11.55) e, se não der, achado pelo título exato; é lido
// parágrafo por parágrafo e fica guardado 24 horas (o que não foi achado, 1 hora, para não repetir a busca a cada pedido). O título
// não achado vai para o registro uma vez.
const artigosGuardados = new Map(); // codigo -> { quando, dados }
const naoAchadosAvisados = new Set();
// O título lido no docId tem de bater com o da lista (sem acentos, pontuação e "!"; o da lista pode ser só o começo), para que um
// docId errado não traga outro artigo.
const soLetras = (t) => semAcento(t).replace(/[^a-z0-9]+/g, " ").trim();
export const tituloBate = (lido, esperado) => {
  const a = soLetras(lido);
  const b = soLetras(esperado);
  return !!a && !!b && (a === b || a.startsWith(b + " "));
};
export async function artigoDoWol(artigo, timeoutMs = 9000) {
  const guardado = artigosGuardados.get(artigo.codigo);
  if (guardado && Date.now() - guardado.quando < (guardado.dados ? DIA_MS : HORA_MS)) return guardado.dados;
  let dados = null;
  let falhou = false;
  try {
    if (artigo.docId) {
      const doc = await paragrafosDoDocumento(artigo.docId, timeoutMs).catch(() => null);
      if (doc && doc.paragrafos.length && tituloBate(doc.titulo, artigo.titulo)) dados = { ...doc, docId: artigo.docId };
      else console.log(`Serviço de campo: docId ${artigo.docId} não confere com ${artigo.codigo}; tentando pelo título`);
    }
    if (!dados) {
      const docId = await docDoArtigoDoGuia({ titulo: artigo.titulo, ano: artigo.ano, ...(artigo.edicao ? { edicao: artigo.edicao } : {}) }, timeoutMs);
      const doc = docId ? await paragrafosDoDocumento(docId, timeoutMs) : null;
      if (doc && doc.paragrafos.length) dados = { ...doc, docId };
    }
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
export function escolherComplementares(consulta, docs, { max = 2, lista = COMPLEMENTARES } = {}) {
  const raizes = raizesDe(consulta);
  if (!raizes.length) return [];
  return lista.map((artigo, ordem) => {
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

// "codigos": só os artigos marcados na tela (6.11.56: cada artigo tem a sua caixa); sem a lista, todos.
export async function complementares(consulta, { max = 2, timeoutMs = 9000, codigos = null } = {}) {
  const lista = codigos ? COMPLEMENTARES.filter((a) => codigos.includes(a.codigo)) : COMPLEMENTARES;
  const docs = await Promise.all(lista.map((a) => artigoDoWol(a, timeoutMs)));
  return {
    artigos: escolherComplementares(consulta, docs, { max, lista }),
    naoAchados: lista.filter((_, i) => !docs[i]).map((a) => a.codigo),
  };
}

// 6.11.56 — "Pesquisar outras fontes": busca a consulta no wol.jw.org (outras edições de A Sentinela e outras publicações sobre o ministério)
// e traz o melhor parágrafo de até "max" matérias que NÃO sejam as já listadas (o artigo de maio de 2024 e os complementares). Cada uma
// vira um "artigo" no mesmo formato dos complementares, com o código da publicação para o esboço citar.
export async function outrasFontes(consulta, { max = 2, timeoutMs = 9000 } = {}) {
  try {
    const conhecidos = new Set([W24.docId, ...COMPLEMENTARES.map((a) => a.docId)].filter(Boolean).map(String));
    const achados = (await pesquisarMateriasNovasNoWol(consulta.slice(0, 180), timeoutMs, 10)).filter((a) => !conhecidos.has(String(a.docId)));
    const lidos = await Promise.all(achados.slice(0, max + 2).map((a) => paragrafoDaPesquisa(a, timeoutMs).then((p) => (p ? { a, p } : null)).catch(() => null)));
    return lidos
      .filter(Boolean)
      .slice(0, max)
      .map(({ a, p }) => ({ codigo: a.codigo || a.publicacao, titulo: p.titulo || a.titulo, url: p.url, paragrafos: [{ numero: p.paragrafos || "", texto: cortar(p.texto, 900) }] }));
  } catch (e) {
    console.error("Serviço de campo: pesquisa em outras fontes falhou", e?.message);
    return [];
  }
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

// 6.11.61: toda consideração faz referência à brochura Ame as Pessoas (lmd). Se nenhuma lição dela combinou com o assunto, entra a que mais se
// aproxima (a primeira, no empate), para a IA ter sempre uma lição da brochura para citar.
export async function garantirLicaoLmd(consulta, licoes) {
  if (licoes.some((l) => l.sigla === "lmd")) return licoes;
  try {
    const lista = await licoesDaBrochura("ameAsPessoas");
    if (!lista || !lista.length) return licoes;
    const raizes = raizesDe(consulta);
    const melhor = lista
      .map((l) => ({ l, n: pontuar(raizes, l.nome) * 3 + pontuar(raizes, l.texto) }))
      .sort((a, b) => b.n - a.n || a.l.licao - b.l.licao)[0].l;
    return [...licoes, { sigla: melhor.sigla, licao: melhor.licao, nome: melhor.nome, texto: cortar(melhor.texto, 900) }];
  } catch (e) {
    console.error("Serviço de campo: lição do lmd indisponível", e?.message);
    return licoes;
  }
}

// A frase da brochura vale se citar uma das lições do lmd que foram na mensagem ("lmd lição 3"); senão, vai só a referência (sem dizer o que a
// lição ensina, para não inventar). Devolve { texto, citada } — texto "" quando não há lição do lmd.
export function brochuraDaConsideracao(texto, licoesLmd) {
  const limpo = linha(texto, 400);
  if (!licoesLmd.length) return { texto: "", citada: null };
  const citada = licoesLmd.find((l) => new RegExp(`lmd\\s*(?:li[cç][aã]o|lic\\.?)\\s*${l.licao}(?!\\d)`, "i").test(limpo));
  if (limpo && citada) return { texto: limpo, citada };
  const l = licoesLmd[0];
  return { texto: `Veja também a brochura Ame as Pessoas: lmd lição ${l.licao}, ${l.nome}.`, citada: l };
}

// Lições das brochuras (lmd e th) sorteadas, para completar os candidatos de "Sugerir assuntos" quando os parágrafos de w24.05 já foram todos
// sugeridos ou usados: [{ sigla, licao, nome, texto }] (o texto curto). Sorteio (não a ordem fixa) para os assuntos não saírem sempre os mesmos.
export async function licoesParaAssuntos(n, { excluirNomes = [] } = {}) {
  if (n <= 0) return [];
  try {
    const listas = await Promise.all([licoesDaBrochura("ameAsPessoas"), licoesDaBrochura("melhoreLeitura")]);
    const jaFalou = excluirNomes.map((t) => semAcento(t));
    const todas = listas.flat().filter((l) => l && l.nome && !jaFalou.some((t) => t.includes(semAcento(l.nome))));
    for (let i = todas.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [todas[i], todas[j]] = [todas[j], todas[i]]; }
    return todas.slice(0, n).map((l) => ({ sigla: l.sigla, licao: l.licao, nome: l.nome, texto: cortar(l.texto, 500) }));
  } catch (e) {
    console.error("Serviço de campo: lições para os assuntos indisponíveis", e?.message);
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
  const minutos = 5; // a consideração é sempre de 5 minutos (6.11.60); o app não manda mais a duração
  const tipos = Array.isArray(b.tipos) ? [...new Set(b.tipos.filter((t) => TIPOS_DE_PREGACAO.some((x) => x.id === t)))] : [];
  const f = b.fontes && typeof b.fontes === "object" ? b.fontes : {};
  const marcada = (k) => f[k] !== false; // todas marcadas por padrão
  // Cada artigo de A Sentinela tem a sua caixa (6.11.56). "sentinela: false" (versões antigas do app) desmarca todos de uma vez.
  const art = f.artigos && typeof f.artigos === "object" ? f.artigos : {};
  const artigos = COMPLEMENTARES.filter((a) => f.sentinela !== false && art[a.codigo] !== false).map((a) => a.codigo);
  // A matéria de capa do jw.org escolhida no app: só o número do documento, o título e o endereço do próprio jw.org (o texto é lido no servidor).
  const c = b.capa && typeof b.capa === "object" ? b.capa : null;
  const capa = c && /^\d{6,12}$/.test(String(c.docId || ""))
    ? { docId: String(c.docId), titulo: linha(c.titulo, 200), link: /^https:\/\/(www\.jw\.org\/(pt\/[^\s"<>]*|finder\?wtlocale=T&docid=\d{6,12})|wol\.jw\.org\/pt\/wol\/d\/r5\/lp-t\/\d{6,12})$/.test(String(c.link || "")) ? String(c.link).slice(0, 300) : "" }
    : null;
  return {
    capa,
    data: dataValida ? b.data : hojeNoBrasil(),
    minutos,
    tipos: tipos.length ? tipos : ["casa"],
    campanha: linha(b.campanha, 200),
    publico: linha(b.publico, 200),
    assunto: linha(b.assunto, 200),
    fontes: { w24: marcada("w24"), lmd: marcada("lmd"), th: marcada("th"), be: marcada("be"), outros: marcada("outros"), artigos },
    usados: [...new Set((Array.isArray(b.usados) ? b.usados : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 200))].slice(0, 200),
    // "Sugerir assuntos" repetido (6.11.65): o que o app já sugeriu nesta sessão (títulos e parágrafos de w24.05), para não voltar com os mesmos.
    jaSugeridos: (Array.isArray(b.jaSugeridos) ? b.jaSugeridos : []).map((t) => linha(t, 160)).filter(Boolean).slice(0, 40),
    parSugeridos: [...new Set((Array.isArray(b.parSugeridos) ? b.parSugeridos : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 200))].slice(0, 100),
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
export function siglasPermitidas({ capa = null, paragrafo, licoes = [], artigos = [], be = [] }) {
  const siglas = new Set();
  if (capa) siglas.add(SIGLA_CAPA);
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
export function textoDasFontesDoCampo({ capa = null, paragrafo, reiniciou = false, licoes = [], artigos = [], be = [] }) {
  const partes = [];
  if (capa) {
    partes.push(`MATÉRIA ESCOLHIDA DA BIBLIOTECA ON-LINE, "${capa.titulo}" (fonte prioritária: é o assunto da consideração; cite "${SIGLA_CAPA}"):\n${capa.texto}`);
  }
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
export function listaDeFontes({ capa = null, paragrafo, licoes = [], artigos = [], be = [] }, citado) {
  const n = semAcento(citado);
  const cita = (s) => new RegExp(`(^|[^a-z0-9.])${semAcento(s).replace(/\./g, "\\.")}(?![a-z0-9])`).test(n);
  const lista = [];
  if (capa) lista.push(`${SIGLA_CAPA} — "${capa.titulo}" (matéria escolhida da Biblioteca On-line)${capa.link ? ` — ${capa.link}` : ""}`);
  if (paragrafo) lista.push(`${W24.codigo} — "${W24.titulo}", § ${paragrafo.numero}`);
  for (const l of licoes) if (cita(`${l.sigla} lição ${l.licao}`) || cita(`${l.sigla} lic ${l.licao}`) || n.includes(semAcento(l.nome))) lista.push(`${l.sigla} lição ${l.licao} — ${l.nome}`);
  for (const a of artigos) if (cita(a.codigo)) lista.push(`${a.codigo} — "${a.titulo}"`);
  if (be.length && cita("be")) lista.push("be — Beneficie-se da Escola do Ministério Teocrático");
  return lista;
}
