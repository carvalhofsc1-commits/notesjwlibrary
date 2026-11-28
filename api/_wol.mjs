import { guiaLocalTopicos, artigosDoTopicoDoGuia } from "./_fontes.mjs";

// Leitura do estudo de A Sentinela direto no wol.jw.org pelo próprio servidor (sem a IA ler a página inteira).
// O arquivo começa com "_" para a Vercel não publicá-lo como rota.
//
// A página do artigo marca cada pergunta com <p class="qu"> e cada parágrafo com data-rel-pid="[id da pergunta]",
// então dá para separar exatamente as perguntas e os parágrafos pedidos e mandar à IA só esse trecho: ela responde
// bem mais rápido e pode pensar sobre um texto curto. Se a página mudar de formato ou não puder ser lida, quem chama
// volta ao jeito antigo (a IA lê o site com a ferramenta web_fetch).
//
// O texto lido fica só na memória do servidor por alguns minutos (para pedir outros parágrafos do mesmo artigo sem
// baixar de novo); não é gravado nem devolvido ao navegador. A exceção é o texto diário (mais abaixo), que o app mostra
// na tela Início: ele também fica só na memória (algumas horas) e nunca é gravado.

const BASE = "https://wol.jw.org";
const AGENTE = "Mozilla/5.0 (compatible; NoteStyle/1.0; +https://notestyle.com.br/sobre.html)";
const MAX_BYTES = 1_500_000;
const VALIDADE_MS = 10 * 60 * 1000;
const lidos = new Map(); // url -> { quando, artigo }

const ENTIDADES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", middot: "·", copy: "©",
};

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, nome) => {
    if (nome[0] === "#") {
      const codigo = nome[1] === "x" || nome[1] === "X" ? parseInt(nome.slice(2), 16) : Number(nome.slice(1));
      return Number.isFinite(codigo) && codigo > 0 && codigo < 0x110000 ? String.fromCodePoint(codigo) : todo;
    }
    return ENTIDADES[nome.toLowerCase()] ?? todo;
  });
}

// HTML de um trecho -> texto corrido (sem marcas, sem espaços repetidos).
function textoDe(html) {
  return decodificar(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/\(\s+/g, "(").trim();
}

function semAcento(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Imagens de uma página do wol.jw.org: cada <figure> traz a descrição (o texto "alt" da <img>, que o site guarda para leitores de tela e que vai
// junto quando se copia um trecho que passa por cima da imagem) e a legenda (<figcaption>). Cada figura vira um parágrafo sintético "x-figura"
// (com o texto "§figura§"), para entrar na ordem da página; as figuras ficam na lista, na mesma ordem.
export function separarFiguras(html) {
  const figuras = [];
  const semFiguras = html.replace(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g, (todo, interno) => {
    const descricao = [...interno.matchAll(/<img\b[^>]*?\balt="([^"]*)"/g)].map((a) => textoDe(a[1])).filter(Boolean).join(" ");
    const legenda = textoDe((interno.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || "");
    figuras.push({ descricao: descricao.slice(0, 700), legenda: legenda.slice(0, 400) });
    return `<p class="x-figura" data-fig="${figuras.length - 1}">§figura§</p>`;
  });
  return { html: semFiguras, figuras };
}

// As figuras que dizem alguma coisa (as decorativas não têm descrição nem legenda), no máximo 12.
export function imagensUteis(figuras) {
  return figuras.filter((f) => f.descricao || f.legenda).slice(0, 12);
}

// ---------- Imagens da apostila inteira ----------
// Todas as imagens da apostila Vida e Ministério da semana, na ordem, cada uma com a seção e o item em que está (inclusive as de partes que
// o app não trata, como "Nossa Vida Cristã").
const imagensDasApostilas = new Map(); // url da página de reuniões -> { quando, apostila }

export function imagensDaApostila(html) {
  const { html: semFiguras, figuras } = separarFiguras(html);
  const lista = [];
  let secao = "";
  let item = "";
  let ultimoPid = null;
  for (const m of semFiguras.matchAll(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>|<p class="x-figura" data-fig="(\d+)">/g)) {
    if (m[1]) {
      ultimoPid = (m[0].match(/data-pid="(\d+)"/) || [])[1] || ultimoPid;
      const titulo = textoDe(m[2]);
      if (m[1] === "h2") {
        secao = titulo;
        item = "";
      } else item = titulo;
      continue;
    }
    const figura = figuras[Number(m[3])];
    // O "par" do endereço do JW Library: o parágrafo que vem logo depois da imagem (a imagem fica logo acima dele); sem ele, o último antes.
    const pid = (semFiguras.slice(m.index).match(/data-pid="(\d+)"/) || [])[1] || ultimoPid || null;
    if (figura && (figura.descricao || figura.legenda)) lista.push({ secao, item, descricao: figura.descricao, legenda: figura.legenda, pid });
  }
  return lista.slice(0, 30);
}

export async function lerImagensDaApostila(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = imagensDasApostilas.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.apostila;
  const id = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!id) return null;
  const url = `${BASE}/pt/wol/d/r5/lp-t/${id}`;
  const html = await baixar(url, timeoutMs);
  const apostila = { semana: leituraDaApostila(html).semana, url, imagens: imagensDaApostila(html) };
  imagensDasApostilas.set(urlReuniao, { quando: Date.now(), apostila });
  if (imagensDasApostilas.size > 20) imagensDasApostilas.delete(imagensDasApostilas.keys().next().value);
  return apostila;
}

async function baixar(url, timeoutMs) {
  const resposta = await fetch(url, {
    headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resposta.ok) throw new Error(`wol.jw.org respondeu ${resposta.status}`);
  const html = await resposta.text();
  return html.length > MAX_BYTES ? html.slice(0, MAX_BYTES) : html;
}

// Na página de reuniões da semana, o link do artigo de estudo de A Sentinela (publicação "w").
function idDoArtigoNaReuniao(html) {
  const links = [...html.matchAll(/href="\/pt\/wol\/d\/r5\/lp-t\/(\d{7})"/g)];
  const daSentinela = links.find((m) => /\bpub-w\b/.test(html.slice(Math.max(0, m.index - 800), m.index)));
  if (daSentinela) return daSentinela[1];
  const unicos = [...new Set(links.map((m) => m[1]))];
  return unicos.length === 1 ? unicos[0] : null;
}

// "4, 5" -> [4, 5]; "3-5" -> [3, 4, 5]
function numeros(rotulo) {
  const lista = [];
  for (const parte of rotulo.split(",")) {
    const faixa = parte.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (faixa) for (let n = Number(faixa[1]); n <= Number(faixa[2]) && n < 200; n++) lista.push(n);
    else if (/\d+/.test(parte)) lista.push(Number(parte.match(/\d+/)[0]));
  }
  return lista;
}

// O texto em volta de um link de texto bíblico diz que ele é para ler? Três formas: "(Leia Filipenses 4:11, 12.)" (o último "(" antes do
// link abre um grupo que começa com "Leia" e ainda não fechou), "Leia Hebreus 13:16." no meio do parágrafo (o último "Leia" fica a
// poucas palavras do link, sem fim de frase no meio) e "1 Coríntios 4:6, 7. (Leia.)" (o "(Leia.)" vem logo depois do link).
function sobLeia(antes, depois) {
  if (/^[^()]{0,14}\(\s*Leiam?\s*\.?\s*\)/i.test(depois)) return true;
  const abre = antes.lastIndexOf("(");
  if (abre >= 0 && abre > antes.lastIndexOf(")") && antes.length - abre <= 200 && /^\(\s*Leiam?\b/i.test(antes.slice(abre))) return true;
  const leia = [...antes.matchAll(/\bLeiam?\b/gi)].pop();
  if (!leia) return false;
  const entre = antes.slice(leia.index + leia[0].length);
  // Fim de frase: ponto (com ")" ou não) seguido de espaço e de algo que não é número ("Efé. 4:28" e "Tim. 6:17" são abreviaturas).
  return entre.length <= 90 && !/[?!]/.test(entre) && !/\.\)?\s+(?!\d)/.test(entre);
}

// Referências bíblicas de um trecho da página: os links de texto bíblico (class="b"). Um link sem o nome do livro
// continua o anterior: separado por vírgula, entra na mesma referência ("Filêmon 8, 9" + ", 17" -> "Filêmon 8, 9, 17");
// separado por ponto e vírgula, vira outra do mesmo livro ("Mat. 24:14;" + "28:19, 20" -> "Mat. 28:19, 20").
// Com "marcadas" (um Set), as que o texto manda ler ("Leia") também são postas nele.
export function referenciasDe(html, marcadas = null) {
  const lista = [];
  const comLeia = new Set(); // posições da lista cujo link está dentro de um "(Leia …)"
  let livro = "";
  let fimAnterior = -1;
  let pontuacaoAnterior = ""; // ";" ou "," que ficou no fim do link anterior ("Isaías 1:18;")
  for (const m of html.matchAll(/<a\b[^>]*\bclass="b"[^>]*>([\s\S]*?)<\/a>/g)) {
    // O que separa este link do anterior: a pontuação no fim dele mais o texto entre os dois.
    const entre = fimAnterior >= 0 ? (pontuacaoAnterior + textoDe(html.slice(fimAnterior, m.index))).replace(/\s+/g, "") : null;
    fimAnterior = m.index + m[0].length;
    const bruto = textoDe(m[1]);
    const texto = bruto.replace(/[;,.\s]+$/, "");
    pontuacaoAnterior = bruto.slice(texto.length);
    if (!texto) continue;
    const comLivro = texto.match(/^((?:[1-3]\s*)?\p{L}[^\d]*?)\s*\d/u);
    const leia = marcadas ? sobLeia(textoDe(html.slice(Math.max(0, m.index - 1500), m.index)), textoDe(html.slice(fimAnterior, fimAnterior + 600)).slice(0, 40)) : false;
    if (comLivro) livro = comLivro[1];
    else if (lista.length && (entre === "," || entre === "")) {
      lista[lista.length - 1] += `, ${texto}`;
      if (leia) comLeia.add(lista.length - 1);
      continue;
    }
    lista.push(comLivro || !livro ? texto : `${livro} ${texto}`);
    if (leia) comLeia.add(lista.length - 1);
  }
  if (marcadas) comLeia.forEach((i) => marcadas.add(lista[i]));
  return [...new Set(lista)];
}

// Itens que dependem do título do quadro viram uma pergunta completa (o texto só vai para a IA, então o título
// fica como está, em maiúsculas): "O QUE VOCÊ APRENDEU COM . . ." + "o apóstolo Paulo?" ou
// "QUE CONSOLO ENCONTRAMOS NOS SEGUINTES TEXTOS?" + "Isaías 42:16".
function perguntaDoQuadro(titulo, item) {
  if (!titulo) return item;
  if (/(\.\s*){3}$|…$/.test(titulo) || /^\p{Ll}/u.test(item)) return `${titulo.replace(/[\s.…]+$/, "")} ${item}`;
  return /\?\s*$/.test(item) ? item : `${titulo} — ${item}`;
}

// Separa título, perguntas com seus parágrafos (e legendas de imagem) e as perguntas de recapitulação.
export function analisarArtigo(html) {
  const inicio = html.indexOf('class="bodyTxt"');
  // As imagens do artigo entram na ordem dele (veja separarFiguras).
  const { html: corpo, figuras } = separarFiguras(inicio >= 0 ? html.slice(inicio) : html);
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/);
  const titulo = h1 ? textoDe(h1[1]).slice(0, 200) : "";

  const grupos = [];
  const porPergunta = new Map(); // data-pid da pergunta -> grupo
  const secoes = []; // para a recapitulação: o artigo inteiro, com os subtítulos
  const recapitulacao = [];
  const referenciasRecapitulacao = []; // alinhada com "recapitulacao": os textos citados em cada pergunta do quadro
  const pidsRecapitulacao = []; // alinhada com "recapitulacao": o data-pid de cada pergunta do quadro (o "par" do JW Library)
  let atual = null;
  let naRecapitulacao = false;
  let tituloRecapitulacao = "";

  const elementos = /<(h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  for (const m of corpo.matchAll(elementos)) {
    const [, tag, atributos, conteudo] = m;
    const classe = (atributos.match(/class="([^"]*)"/) || [])[1] || "";
    if (tag !== "p") {
      const texto = textoDe(conteudo);
      // O quadro final ("Qual é a sua resposta?", "O que você aprendeu com . . .") fica num bloco "blockTeach".
      if (/blockTeach/.test(corpo.slice(Math.max(0, m.index - 600), m.index)) || /qual e a sua resposta/.test(semAcento(texto))) {
        naRecapitulacao = true;
        tituloRecapitulacao = texto;
      } else if (texto && !naRecapitulacao) secoes.push({ subtitulo: texto });
      continue;
    }
    if (/\bpubRefs\b/.test(classe) && naRecapitulacao) break; // o cântico final encerra o artigo
    if (/\bx-figura\b/.test(classe)) {
      const figura0 = figuras[Number((atributos.match(/data-fig="(\d+)"/) || [])[1])];
      // O "par" do endereço do JW Library: o parágrafo que vem logo depois da imagem (a imagem fica logo acima dele).
      const pidFigura = (corpo.slice(m.index + m[0].length).match(/data-pid="(\d+)"/) || [])[1] || null;
      const figura = figura0 ? { ...figura0, pid: pidFigura } : figura0;
      if (figura && !naRecapitulacao && (figura.descricao || figura.legenda)) {
        if (atual) atual.imagens.push(figura);
        secoes.push({ imagem: figura });
      }
      continue;
    }
    if (/\b(pubRefs|themeScrp|contextTtl|noticeText)\b/.test(classe)) continue;

    const pid = (atributos.match(/data-pid="(\d+)"/) || [])[1];
    if (/\bqu\b/.test(classe)) {
      const texto = textoDe(conteudo);
      const m = texto.match(/^(\d+(?:\s*[,–-]\s*\d+)*)\s*\.\s*([\s\S]*)$/);
      atual = { rotulo: m ? m[1].replace(/\s*,\s*/g, ", ").replace(/\s*[-–]\s*/g, "-") : "", pergunta: m ? m[2] : texto, numeros: m ? numeros(m[1]) : [], paragrafos: [], legendas: [], imagens: [], referencias: referenciasDe(conteudo) };
      grupos.push(atual);
      if (pid) porPergunta.set(pid, atual);
      continue;
    }

    const relacionados = (atributos.match(/data-rel-pid="\[([^\]]*)\]"/) || [])[1];
    if (relacionados) {
      const numero = Number((conteudo.match(/data-pnum="(\d+)"/) || [])[1]) || null;
      const texto = textoDe(conteudo.replace(/<span class="parNum"[\s\S]*?<\/span>/, ""));
      if (!texto) continue;
      const paragrafo = { numero, texto, pid: pid || null }; // pid = data-pid do parágrafo no wol (o "par" do endereço do JW Library)
      secoes.push(paragrafo);
      const donos = relacionados.split(",").map((id) => porPergunta.get(id.trim())).filter(Boolean);
      for (const grupo of donos.length ? [...new Set(donos)] : atual ? [atual] : []) {
        grupo.paragrafos.push(paragrafo);
        if (numero && !grupo.numeros.includes(numero)) grupo.numeros.push(numero);
      }
      continue;
    }

    // Parágrafo sem pergunta ligada: no quadro final é pergunta de recapitulação; antes dele, legenda de imagem.
    const texto = textoDe(conteudo);
    if (!texto) continue;
    if (naRecapitulacao) {
      recapitulacao.push(perguntaDoQuadro(tituloRecapitulacao, texto));
      referenciasRecapitulacao.push(referenciasDe(conteudo));
      pidsRecapitulacao.push(pid || null);
    }
    else if (atual) atual.legendas.push(texto);
  }

  const validos = grupos.filter((g) => g.paragrafos.length && g.numeros.length);
  for (const g of validos) g.rotulo = [...g.numeros].sort((a, b) => a - b).join(", "); // "1, 2", como na lista do app
  // número do parágrafo -> data-pid (para abrir o parágrafo certo no app JW Library)
  const pids = {};
  for (const s of secoes) if (s.numero && s.pid && !pids[s.numero]) pids[s.numero] = s.pid;
  return { titulo, grupos: validos, recapitulacao, referenciasRecapitulacao, pidsRecapitulacao, secoes, pids };
}

// Lê o artigo (ou, com a página de reuniões da semana, encontra o artigo nela e o lê). null = não deu para ler.
export async function lerEstudoDireto(url, { timeoutMs = 8000 } = {}) {
  const guardado = lidos.get(url);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.artigo;

  let endereco = url;
  if (/\/wol\/meetings\//.test(url)) {
    const id = idDoArtigoNaReuniao(await baixar(url, timeoutMs));
    if (!id) return null;
    endereco = `${BASE}/pt/wol/d/r5/lp-t/${id}`;
  }
  const analisado = analisarArtigo(await baixar(endereco, timeoutMs));
  if (!analisado.grupos.length) return null;

  const artigo = { ...analisado, url: endereco, id: (endereco.match(/(\d{7})$/) || [])[1] || null };
  lidos.set(url, { quando: Date.now(), artigo });
  if (lidos.size > 20) lidos.delete(lidos.keys().next().value);
  return artigo;
}

// ---------- Texto diário (Examine as Escrituras Diariamente) ----------
// A página do dia (/wol/dt/…/ano/mês/dia) traz o texto diário num bloco "todayItem … pub-es": a data num <h2>, o texto
// temático em <p class="themeScrp"> e o comentário em <div class="bodyTxt">, que termina com a citação da publicação
// (um link para /wol/pc/, ex.: "w24.09 21 § 6"). Os outros blocos do dia (apostila, A Sentinela) ficam de fora.
export function analisarTextoDiario(html) {
  const inicio = html.search(/class="todayItem\b[^"]*\bpub-es\b/);
  if (inicio < 0) return null;
  const fim = html.indexOf('class="todayItem', inicio + 20);
  const bloco = html.slice(inicio, fim > 0 ? fim : undefined);
  const titulo = textoDe((bloco.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || "");
  const temaHtml = (bloco.match(/<p\b[^>]*class="themeScrp"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "";
  const tema = textoDe(temaHtml);
  if (!titulo || !tema) return null;
  const corpo = (bloco.match(/<div class="bodyTxt">([\s\S]*?)<\/div>/) || [])[1] || "";
  // A citação pode vir em mais de um link seguido: "w24.04 2 §§ 1," + "3".
  const citacoes = [];
  const comentario = [...corpo.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, conteudo]) =>
      textoDe(
        conteudo.replace(/<a\b[^>]*href="[^"]*\/wol\/pc\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (todo, citacao) => {
          citacoes.push(textoDe(citacao));
          return "";
        })
      )
    )
    .filter(Boolean);
  // Para abrir o dia no app JW Library (jwlibrary:///finder?...&docid=…&par=…): o número do documento e o parágrafo do título do dia.
  const docid = (html.match(/\bdocId-(\d+)/) || [])[1] || null;
  const par = (bloco.match(/<h2\b[^>]*data-pid="(\d+)"/) || [])[1] || null;
  return { titulo, tema, referencias: referenciasDe(temaHtml), comentario, fonte: citacoes.filter(Boolean).join(" "), docid, par };
}

const textosDiarios = new Map(); // "2026-10-20" -> { quando, texto }

// Texto diário de uma data (ano, mês e dia do calendário de quem lê). null = o wol.jw.org não tem o texto dessa data.
export async function lerTextoDiario(ano, mes, dia, { timeoutMs = 8000 } = {}) {
  const chave = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const guardado = textosDiarios.get(chave);
  if (guardado && Date.now() - guardado.quando < 12 * 60 * 60 * 1000) return guardado.texto;
  const analisado = analisarTextoDiario(await baixar(`${BASE}/pt/wol/dt/r5/lp-t/${ano}/${mes}/${dia}`, timeoutMs));
  if (!analisado) return null;
  const texto = { data: chave, ...analisado, url: `${BASE}/pt/wol/h/r5/lp-t/${ano}/${mes}/${dia}` };
  textosDiarios.set(chave, { quando: Date.now(), texto });
  if (textosDiarios.size > 30) textosDiarios.delete(textosDiarios.keys().next().value);
  return texto;
}

// ---------- Estudo Bíblico de Congregação ----------
// Caminho: página de reuniões da semana -> apostila Vida e Ministério (bloco "pub-mwb") -> item "Estudo bíblico de
// congregação" no fim dela, com um link /wol/pc/ (ex.: "wcg cap. 13") que redireciona para o capítulo. O número do item
// muda de semana para semana, então ele é achado pelo nome. No capítulo, o relato vem em parágrafos sem número, depois
// "Leia o relato na Bíblia" (as referências) e as perguntas em quadros; "Aprenda mais" (leituras extras) fica de fora.
// Uma pergunta pode citar outra publicação (link /wol/pc/): o servidor busca só o trecho citado e manda junto à IA.
export const QUADROS_EBC = [
  { id: "considerar", nome: "Para considerar", curto: "Considerar" },
  { id: "analise", nome: "Analise mais a fundo", curto: "Analise" },
  { id: "medite", nome: "Medite no que aprendeu", curto: "Medite" },
  { id: "quadro", nome: "Pense no quadro completo", curto: "Quadro completo" },
];

// Rótulo solto de imagem no capítulo ("Imagem A", "Imagem B"): às vezes o wol.jw.org deixa um <p> fora da <figure>
// (além da legenda). Sem pular, ele virava pergunta fantasma e deslocava a numeração (ex.: a pergunta 2 virava "Analise 3").
function ehRotuloDeImagemEbc(texto) {
  return /^imagem(\s+[a-z])?$/i.test(String(texto || "").trim()) || /^§figura§$/i.test(String(texto || "").trim());
}

export function analisarCapituloEbc(html) {
  const inicio = html.search(/<p\b[^>]*class="contextTtl|<h1\b/);
  // As imagens (descrição e legenda) saem do texto do capítulo e vão numa lista à parte: as perguntas as citam pela letra ("Imagem A").
  const { html: corpo, figuras } = separarFiguras(
    (inicio >= 0 ? html.slice(inicio) : html)
      .replace(/<div class="stdPullQuote[\s\S]*?<\/div>/g, "") // frase em destaque (repete uma do relato)
      .replace(/<div class="gen-field"[\s\S]*?<\/div>/g, "") // campo "Sua resposta" da página
  );
  const contexto = textoDe((corpo.match(/<p\b[^>]*class="contextTtl[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || ""); // "13 JOSUÉ"
  const titulo = textoDe((corpo.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const relato = [];
  const leia = [];
  const perguntas = [];
  let secao = "relato";
  for (const [, tag, atributos, conteudo] of corpo.matchAll(/<(h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (/contextTtl|x-figura/.test(atributos)) continue;
    if (tag !== "p") {
      const nome = semAcento(textoDe(conteudo)).replace(/[:\s]+$/, "");
      if (nome.startsWith("aprenda mais")) break;
      if (nome.startsWith("leia o relato")) secao = "leia";
      const quadro = QUADROS_EBC.find((q) => nome.startsWith(semAcento(q.nome)));
      if (quadro) secao = quadro.id;
      continue;
    }
    const texto = textoDe(conteudo);
    if (!texto || ehRotuloDeImagemEbc(texto)) continue;
    if (secao === "relato") relato.push(texto);
    else if (secao === "leia") leia.push(...referenciasDe(conteudo));
    else {
      const quadro = QUADROS_EBC.find((q) => q.id === secao);
      // Tira o número da lista ("1.") e a letra que liga a pergunta a uma imagem ("A").
      const pergunta = textoDe(
        conteudo.replace(/<span class="txtSrcBullet">[\s\S]*?<\/span>/, "").replace(/<span\b[^>]*>\s*<strong>[A-Z]<\/strong>\s*<\/span>/g, "")
      );
      if (!pergunta || ehRotuloDeImagemEbc(pergunta)) continue;
      const numero = perguntas.filter((p) => p.quadro === quadro.id).length + 1;
      const citacoes = [...conteudo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
      const pid = (atributos.match(/data-pid="(\d+)"/) || [])[1] || null; // o "par" do endereço do JW Library
      perguntas.push({ id: `${quadro.curto} ${numero}`, quadro: quadro.id, nomeQuadro: quadro.nome, numero, pergunta, referencias: referenciasDe(conteudo), citacoes, pid });
    }
  }
  return { contexto, titulo, relato, leia: [...new Set(leia)], perguntas, imagens: imagensUteis(figuras) };
}

// Na página de reuniões, o número da apostila Vida e Ministério da semana (bloco "pub-mwb").
function idDaApostilaNaReuniao(html) {
  return (html.match(/class="[^"]*\bpub-mwb\b[^"]*\bdocId-(\d+)/) || [])[1] || null;
}

// Na apostila, o link do item "Estudo bíblico de congregação" (ex.: { caminho: "/pt/wol/pc/…", rotulo: "wcg cap. 13" }).
function linkDoEstudoBiblico(html) {
  const titulo = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].find((m) => /estudo biblico de congregacao/.test(semAcento(textoDe(m[1]))));
  if (!titulo) return null;
  const link = html.slice(titulo.index, titulo.index + 3000).match(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  return link ? { caminho: link[1], rotulo: textoDe(link[2]) } : null;
}

// Um link /wol/pc/ responde com um redirecionamento para o artigo; o endereço traz os parágrafos citados no fim
// ("#h=7:0-8:0" = parágrafos 7 a 8). Devolve { url, de, ate, hash } (de/ate = null se não vier o intervalo). Também
// serve para os links /wol/bc/ de textos bíblicos ("#v=24:45:1-24:46:28").
async function resolverCitacao(caminho, timeoutMs) {
  const resposta = await fetch(BASE + caminho, {
    headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR,pt;q=0.9" },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const destino = resposta.headers.get("location");
  if (!destino) return null;
  const url = new URL(destino, BASE);
  const faixa = url.hash.match(/h=(\d+):\d+-(\d+):(\d+)/);
  // O fim da faixa é "parágrafo:posição": com a posição 0 o parágrafo do fim NÃO entra ("#h=8:0-9:0" é só o parágrafo 8 e
  // "#h=16:0-18:0", os parágrafos 16 e 17). Com outra posição, o parágrafo do fim entra (até aquele ponto).
  const de = faixa ? Number(faixa[1]) : null;
  let ate = faixa ? Number(faixa[2]) : null;
  if (faixa && Number(faixa[3]) === 0 && ate > de) ate -= 1;
  return { url: url.origin + url.pathname, de, ate, hash: url.hash };
}

// O trecho de outra publicação citado numa pergunta: título do artigo e os parágrafos do intervalo (até maxCaracteres).
// Sem "#h=…" no redirecionamento, lê o documento até o limite (como lerDocumentoCitado). docs: páginas já baixadas neste pedido.
async function lerTrechoCitado({ caminho, citacao }, timeoutMs, maxCaracteres = 3000, docs = null) {
  const destino = await resolverCitacao(caminho, timeoutMs);
  if (!destino) return null;
  if (docs && !docs.has(destino.url)) docs.set(destino.url, baixar(destino.url, timeoutMs));
  const html = await (docs ? docs.get(destino.url) : baixar(destino.url, timeoutMs));
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const partes = [];
  const referencias = [];
  const leias = new Set();
  for (const [, , pid, conteudo] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const n = Number(pid);
    if (destino.de !== null && (n < destino.de || n > destino.ate)) continue;
    const texto = textoDe(conteudo);
    if (texto) {
      partes.push(texto);
      referencias.push(...referenciasDe(conteudo, leias));
    }
  }
  const texto = partes.join("\n").slice(0, maxCaracteres);
  return texto ? { caminho, citacao, titulo, texto, referencias: [...new Set(referencias)], leias: [...leias] } : null;
}

const estudosBiblicos = new Map(); // url da página de reuniões -> { quando, capitulo }
const MAX_TRECHOS_EBC = 12;

// Completa capitulo.trechos com as publicações citadas nas perguntas pedidas (refaz o que faltou no cache).
// Devolve { citadasPedidas, trechosOk, falhas }.
export async function garantirTrechosEbc(capitulo, perguntas, { timeoutMs = 8000 } = {}) {
  const pedidas = [...new Map((perguntas || []).flatMap((p) => p.citacoes || []).map((c) => [c.caminho, c])).values()];
  const trechos = [...(capitulo.trechos || [])];
  const cobertos = new Set();
  for (const t of trechos) {
    if (t.caminho) cobertos.add(t.caminho);
    else {
      const c = pedidas.find((p) => p.citacao === t.citacao);
      if (c) cobertos.add(c.caminho);
    }
  }
  const faltam = pedidas.filter((c) => !cobertos.has(c.caminho)).slice(0, MAX_TRECHOS_EBC);
  if (faltam.length) {
    const docs = new Map();
    const novos = await Promise.all(faltam.map((c) => lerTrechoCitado(c, timeoutMs, 3000, docs).catch(() => null)));
    for (const t of novos) if (t) trechos.push(t);
  }
  capitulo.trechos = trechos;
  const trechosOk = pedidas.filter((c) => trechos.some((t) => t.caminho === c.caminho || t.citacao === c.citacao)).length;
  return { citadasPedidas: pedidas.length, trechosOk, falhas: pedidas.length - trechosOk };
}

// Lê o capítulo do Estudo Bíblico de Congregação da semana (e os trechos citados nas perguntas). null = não achou.
export async function lerEstudoBiblico(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = estudosBiblicos.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.capitulo;

  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const link = linkDoEstudoBiblico(await baixar(`${BASE}/pt/wol/d/r5/lp-t/${apostila}`, timeoutMs));
  if (!link) return null;
  const destino = await resolverCitacao(link.caminho, timeoutMs);
  if (!destino) return null;
  const analisado = analisarCapituloEbc(await baixar(destino.url, timeoutMs));
  if (!analisado.perguntas.length) return null;

  const citadas = [...new Map(analisado.perguntas.flatMap((p) => p.citacoes).map((c) => [c.caminho, c])).values()];
  const docs = new Map();
  const trechos = (
    await Promise.all(citadas.slice(0, MAX_TRECHOS_EBC).map((c) => lerTrechoCitado(c, timeoutMs, 3000, docs).catch(() => null)))
  ).filter(Boolean);
  console.log("Estudo bíblico (leitura):", JSON.stringify({ citadas: citadas.length, trechos: trechos.length }));

  const capitulo = { ...analisado, trechos, citadas: citadas.length, materia: link.rotulo, url: destino.url };
  estudosBiblicos.set(urlReuniao, { quando: Date.now(), capitulo });
  if (estudosBiblicos.size > 20) estudosBiblicos.delete(estudosBiblicos.keys().next().value);
  return capitulo;
}

// ---------- Joias espirituais (leitura da Bíblia da semana) ----------
// No alto da apostila Vida e Ministério vem a leitura da semana (ex.: "JEREMIAS 45-46"), com um link que leva aos
// capítulos ("#v=24:45:1-24:46:28" = livro 24, do capítulo 45 ao 46). A página de cada capítulo (Bíblia de estudo) traz
// o texto dos versículos e, para cada versículo, o "Índice das Publicações", com links para as publicações que o
// explicam: o servidor busca os trechos das mais recentes (no máximo 12 na semana, espalhadas pelos versículos) e
// manda à IA junto com o capítulo. Na apostila, "Joias espirituais" traz também uma pergunta sobre um versículo, com a
// publicação que a responde.
const MAX_TRECHOS_JOIAS = 12;

// Semana ("19-25 DE OUTUBRO") e a leitura da Bíblia ({ rotulo: "JEREMIAS 45-46", caminho do link }).
function leituraDaApostila(html) {
  const semana = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const depois = html.slice(Math.max(0, html.search(/<h1\b/)));
  const link = depois.match(/<a\b[^>]*href="(\/pt\/wol\/bc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  return { semana, leitura: link ? { caminho: link[1], rotulo: textoDe(link[2]) } : null };
}

// Seção "Joias espirituais" da apostila: a pergunta sobre um versículo (com as publicações citadas) e a pergunta geral.
function joiasDaApostila(html) {
  const titulo = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].find((m) => /joias espirituais/.test(semAcento(textoDe(m[1]))));
  if (!titulo) return { pergunta: null, geral: null, pidPergunta: null, pidGeral: null };
  const resto = html.slice(titulo.index + titulo[0].length);
  const fim = resto.search(/<h[23]\b/);
  const secao = (fim >= 0 ? resto.slice(0, fim) : resto).replace(/<div class="gen-field"[\s\S]*?<\/div>/g, "");
  let pergunta = null;
  let geral = null;
  let pidPergunta = null; // data-pid do parágrafo de cada pergunta (o "par" do endereço do JW Library)
  let pidGeral = null;
  for (const [, conteudo] of secao.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
    const texto = textoDe(conteudo);
    if (!texto) continue;
    const pid = (conteudo.match(/data-pid="(\d+)"/) || [])[1] || null;
    if (!pergunta && /class="b"/.test(conteudo)) {
      const citacoes = [...conteudo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
      pergunta = { texto, referencias: referenciasDe(conteudo), citacoes };
      pidPergunta = pid;
    } else if (!geral) {
      geral = texto;
      pidGeral = pid;
    }
  }
  return { pergunta, geral, pidPergunta, pidGeral };
}

// Versículos de um capítulo: "1 texto", "2 texto"… (sem os sinais de referência cruzada "+" e de nota "*").
function versiculosDoCapitulo(html, livro, capitulo) {
  const porVerso = new Map();
  const padrao = new RegExp(`<span id="v${livro}-${capitulo}-(\\d+)-\\d+" class="v">([\\s\\S]*?)</span>`, "g");
  for (const [, verso, conteudo] of html.matchAll(padrao)) {
    // O número do versículo (ou do capítulo, no versículo 1) é um link para o Guia de Pesquisa (/wol/dx/).
    const limpo = conteudo.replace(/<a\b[^>]*href="\/pt\/wol\/dx\/[^"]*"[^>]*>[\s\S]*?<\/a>/, "").replace(/<a\b[^>]*>\s*[+*]\s*<\/a>/g, "");
    porVerso.set(verso, `${porVerso.get(verso) || ""} ${textoDe(limpo)}`.trim());
  }
  return [...porVerso].map(([verso, texto]) => ({ verso: Number(verso), texto }));
}

// Publicações do "Índice das Publicações" de cada versículo: { verso, rotulo ("w06 15/8 17"), ano, caminho }.
function publicacoesDoCapitulo(html, livro, capitulo) {
  const lista = [];
  const blocos = html.split(`<div class="section" data-key="${livro}-${capitulo}-`).slice(1);
  for (const bloco of blocos) {
    const verso = Number((bloco.match(/^(\d+)/) || [])[1]);
    const indice = bloco.indexOf("ref-dx");
    if (!verso || indice < 0) continue;
    const fim = bloco.indexOf("</li>", indice);
    let simbolo = "";
    for (const [, caminho, rotuloHtml] of bloco.slice(indice, fim > 0 ? fim : undefined).matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      let rotulo = textoDe(rotuloHtml).replace(/[;,]\s*$/, "");
      // "jr 103," + "105" -> "jr 105": a continuação herda o símbolo da publicação anterior.
      if (/^[\d\s,–-]+$/.test(rotulo) && simbolo) rotulo = `${simbolo} ${rotulo}`;
      simbolo = (rotulo.match(/^(\S+)/) || [])[1] || simbolo;
      // Ano: "w25.07" -> 2025, "w06" -> 2006, "w80" -> 1980; sem ano (livros como "jr" ou "it"), 2000.
      const aa = rotulo.match(/^[a-z]+(\d{2})(?:\.\d{2})?\b/i);
      const ano = aa ? (Number(aa[1]) > 50 ? 1900 : 2000) + Number(aa[1]) : 2000;
      lista.push({ verso, rotulo, ano, caminho });
    }
  }
  return lista;
}

// Escolhe as publicações mais recentes, no máximo 2 por versículo e "max" no capítulo.
function escolherPublicacoes(lista, max) {
  const escolhidas = [];
  const porVerso = new Map();
  const vistos = new Set();
  for (const p of [...lista].sort((a, b) => b.ano - a.ano)) {
    if (escolhidas.length >= max) break;
    if (vistos.has(p.caminho) || (porVerso.get(p.verso) || 0) >= 2) continue;
    vistos.add(p.caminho);
    porVerso.set(p.verso, (porVerso.get(p.verso) || 0) + 1);
    escolhidas.push(p);
  }
  return escolhidas;
}

const joiasLidas = new Map(); // url da página de reuniões -> { quando, joias }

// Lê a leitura da semana (capítulos com os versículos e os trechos das publicações) e a seção "Joias espirituais".
export async function lerJoias(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = joiasLidas.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.joias;

  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const htmlApostila = await baixar(`${BASE}/pt/wol/d/r5/lp-t/${apostila}`, timeoutMs);
  const { semana, leitura } = leituraDaApostila(htmlApostila);
  if (!leitura) return null;
  const destino = await resolverCitacao(leitura.caminho, timeoutMs);
  const faixa = destino && destino.hash.match(/v=(\d+):(\d+):\d+-(\d+):(\d+):\d+/);
  if (!faixa) return null;
  const [livroIni, capIni, livroFim, capFim] = faixa.slice(1).map(Number);
  const pedidos = [];
  if (livroIni === livroFim) for (let c = capIni; c <= capFim && pedidos.length < 6; c++) pedidos.push([livroIni, c]);
  else pedidos.push([livroIni, capIni], [livroFim, capFim]);
  const raiz = destino.url.replace(/\/\d+\/\d+$/, "");

  const paginas = await Promise.all(pedidos.map(([livro, c]) => baixar(`${raiz}/${livro}/${c}`, timeoutMs)));
  const porCapitulo = Math.max(2, Math.min(5, Math.floor(MAX_TRECHOS_JOIAS / pedidos.length)));
  const docs = new Map();
  const capitulos = await Promise.all(
    pedidos.map(async ([livro, c], i) => {
      const html = paginas[i];
      const nome = textoDe((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "").split(/\s+—\s+/)[0] || `Capítulo ${c}`;
      const escolhidas = escolherPublicacoes(publicacoesDoCapitulo(html, livro, c), porCapitulo);
      const trechos = (
        await Promise.all(escolhidas.map((p) => lerTrechoCitado({ caminho: p.caminho, citacao: p.rotulo }, timeoutMs, 1500, docs).then((t) => (t ? { ...t, verso: p.verso } : null)).catch(() => null)))
      ).filter(Boolean);
      return { nome, livro, capitulo: c, versiculos: versiculosDoCapitulo(html, livro, c), trechos };
    })
  );

  const secao = joiasDaApostila(htmlApostila);
  let trechoPergunta = null;
  if (secao.pergunta && secao.pergunta.citacoes[0]) {
    trechoPergunta = await lerTrechoCitado(secao.pergunta.citacoes[0], timeoutMs, 3000, docs).catch(() => null);
  }
  const joias = {
    semana,
    leitura: leitura.rotulo,
    capitulos: capitulos.filter((c) => c.versiculos.length),
    pergunta: secao.pergunta ? { ...secao.pergunta, trecho: trechoPergunta } : null,
    geral: secao.geral,
    url: `${BASE}/pt/wol/d/r5/lp-t/${apostila}`,
    docid: apostila, // com os data-pid das duas perguntas: onde abrir a apostila no app JW Library para colar a resposta
    pidPergunta: secao.pidPergunta,
    pidGeral: secao.pidGeral,
  };
  if (!joias.capitulos.length) return null;
  joiasLidas.set(urlReuniao, { quando: Date.now(), joias });
  if (joiasLidas.size > 20) joiasLidas.delete(joiasLidas.keys().next().value);
  return joias;
}

// Texto para a IA: a leitura (cada capítulo com os versículos e os trechos das publicações) e a pergunta da apostila.
export function textoDasJoias(joias, { pergunta, leitura, resumo }) {
  const partes = [`LEITURA DA BÍBLIA DA SEMANA (${joias.semana}): ${joias.leitura}`];
  if (leitura || resumo) {
    // O versículo da pergunta da apostila já tem a resposta própria: as joias devem ser sobre outros versículos.
    if (leitura && joias.pergunta && joias.pergunta.referencias.length) {
      partes.push(`VERSÍCULO DA PERGUNTA DA APOSTILA (não use nas joias): ${joias.pergunta.referencias.join("; ")}`);
    }
    for (const c of joias.capitulos) {
      partes.push(`${c.nome.toUpperCase()}:\n${c.versiculos.map((v) => `${v.verso} ${v.texto}`).join("\n")}`);
      if (leitura && c.trechos.length) {
        partes.push(`PUBLICAÇÕES SOBRE ${c.nome.toUpperCase()} (Índice das Publicações):\n${c.trechos.map((t) => `(${t.citacao}, sobre o versículo ${c.capitulo}:${t.verso}) ${t.titulo ? `"${t.titulo}": ` : ""}${t.texto}`).join("\n\n")}`);
      }
    }
  }
  if (pergunta && joias.pergunta) {
    partes.push(`PERGUNTA DA APOSTILA: ${joias.pergunta.texto}`);
    if (joias.pergunta.trecho) partes.push(`TRECHO DA PUBLICAÇÃO CITADA NA PERGUNTA (${joias.pergunta.trecho.citacao}):\n${joias.pergunta.trecho.texto}`);
  }
  return partes.join("\n\n");
}

// Trecho já lido que casa com uma citação da pergunta (pelo caminho do link ou pelo rótulo).
function trechoDaCitacao(capitulo, citacao) {
  return (capitulo.trechos || []).find((t) => t.caminho === citacao.caminho || t.citacao === citacao.citacao) || null;
}

// Texto do capítulo para a IA: o relato, as referências de "Leia o relato na Bíblia" (com os versículos, se vierem)
// e as perguntas pedidas; cada pergunta traz colado o trecho da publicação que ela cita (fonte principal da resposta).
export function textoDoCapituloEbc(capitulo, perguntas, versiculos = []) {
  const partes = [
    `CAPÍTULO: ${[capitulo.contexto, capitulo.titulo].filter(Boolean).join(": ")}`,
    `RELATO:\n${capitulo.relato.join("\n")}`,
    `LEIA O RELATO NA BÍBLIA: ${capitulo.leia.join("; ") || "(nenhuma referência)"}`,
  ];
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  if (capitulo.imagens && capitulo.imagens.length) {
    partes.push(`IMAGENS DO CAPÍTULO (as perguntas citam cada uma pela letra, como "Imagem A"):\n${capitulo.imagens.map(textoDaImagem).join("\n\n")}`);
  }
  const blocoPerguntas = perguntas
    .map((p) => {
      const linhas = [`[${p.id}] (${p.nomeQuadro}) ${p.pergunta}`];
      for (const c of p.citacoes || []) {
        const t = trechoDaCitacao(capitulo, c);
        if (t) linhas.push(`FONTE PRINCIPAL DESTA PERGUNTA (${t.citacao})${t.titulo ? ` "${t.titulo}"` : ""}:\n${t.texto}`);
        else if (c.citacao) linhas.push(`FONTE CITADA NESTA PERGUNTA (trecho não disponível): ${c.citacao}`);
      }
      return linhas.join("\n");
    })
    .join("\n\n");
  partes.push(
    "PERGUNTAS (responda a cada uma; em \"pergunta\", use o identificador entre colchetes). Quando houver FONTE PRINCIPAL logo abaixo da pergunta, baseie a resposta nela; não invente o que a publicação não diz.\n\n" +
      blocoPerguntas
  );
  return partes.join("\n\n");
}

// Texto do capítulo para a IA preparar as perguntas adicionais do dirigente (Estudo Bíblico de Congregação): o relato, as
// referências de "Leia o relato na Bíblia" (com os versículos, se vierem), os trechos das publicações citadas e as
// perguntas ORIGINAIS dos quatro quadros, que a IA não deve repetir.
export function textoDoCapituloEbcDirigente(capitulo, versiculos = []) {
  const partes = [
    `CAPÍTULO: ${[capitulo.contexto, capitulo.titulo].filter(Boolean).join(": ")}`,
    `RELATO:\n${capitulo.relato.join("\n")}`,
    `LEIA O RELATO NA BÍBLIA: ${capitulo.leia.join("; ") || "(nenhuma referência)"}`,
  ];
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  if (capitulo.trechos.length) {
    partes.push(`TRECHOS DAS PUBLICAÇÕES CITADAS NAS PERGUNTAS:\n${capitulo.trechos.map((t) => `(${t.citacao}) ${t.titulo ? `"${t.titulo}": ` : ""}${t.texto}`).join("\n\n")}`);
    partes.push(
      "IMPORTANTE: quando uma pergunta original citar uma publicação cujo trecho está acima, leve esse trecho em conta ao elaborar perguntas adicionais. Não invente o que a publicação não diz."
    );
  }
  if (capitulo.imagens && capitulo.imagens.length) {
    partes.push(`IMAGENS DO CAPÍTULO (as perguntas citam cada uma pela letra, como "Imagem A"):\n${capitulo.imagens.map(textoDaImagem).join("\n\n")}`);
  }
  partes.push(
    `PERGUNTAS ORIGINAIS DO CAPÍTULO (já fazem parte do estudo: NÃO repita nem reformule, e não trate do mesmo ponto que elas):\n${capitulo.perguntas.map((p) => `(${p.nomeQuadro}) ${p.pergunta}`).join("\n")}`
  );
  return partes.join("\n\n");
}

// Uma imagem do artigo como a IA a recebe: a descrição do site e a legenda.
function textoDaImagem(imagem) {
  return [imagem.descricao && `Imagem (descrição do site): ${imagem.descricao}`, imagem.legenda && `Legenda da imagem: ${imagem.legenda}`].filter(Boolean).join("\n");
}

// Texto que vai para a IA: só as perguntas pedidas, cada uma com seus parágrafos (e as descrições e legendas das imagens).
export function textoDosGrupos(grupos) {
  return grupos
    .map((g) =>
      [
        `Pergunta (${g.numeros.length > 1 ? "parágrafos" : "parágrafo"} ${g.rotulo}): ${g.pergunta}`,
        ...g.paragrafos.map((p) => `${p.numero ?? ""} ${p.texto}`.trim()),
        ...g.imagens.map(textoDaImagem),
        ...g.legendas.map((l) => `Legenda da imagem: ${l}`),
      ].join("\n")
    )
    .join("\n\n");
}

// Para a recapitulação: o artigo inteiro (subtítulos e parágrafos, sem as perguntas) e as perguntas do quadro.
export function textoDaRecapitulacao(artigo) {
  const corpo = artigo.secoes.map((s) => (s.imagem ? textoDaImagem(s.imagem) : s.subtitulo ? `\n${s.subtitulo}` : `${s.numero ?? ""} ${s.texto}`.trim())).join("\n");
  return (
    `ARTIGO: ${artigo.titulo}\n${corpo.trim()}\n\n` +
    `PERGUNTAS DE RECAPITULAÇÃO (responda a cada uma):\n` +
    artigo.recapitulacao.map((q, i) => `${i + 1}. ${q}`).join("\n")
  );
}

// ---------- Tesouros da Palavra de Deus (discurso de 10 minutos) ----------
// Na apostila Vida e Ministério, o item 1 da seção "Tesouros da Palavra de Deus" traz o tema (o título do item), "(10 min)",
// normalmente três pontos (cada um é um parágrafo com o texto bíblico que o apoia e, quase sempre, a fonte de matéria: um
// link /wol/pc/ para parágrafos de uma publicação, muitas vezes um artigo de A Sentinela) e, no fim, uma pergunta de reflexão
// ("PERGUNTE-SE:", "PARA MEDITAR:"), que costuma indicar o ponto de aplicação. Depois dela pode vir a legenda de uma imagem
// (parágrafo sem links), que fica de fora. O servidor lê os trechos das fontes citadas e a IA monta o esboço com eles.
const tesouros = new Map(); // url da página de reuniões -> { quando, discurso }
const MAX_FONTES_TESOUROS = 8;

// Itens do bloco: { texto, referencias (bíblicas), citacoes (links /wol/pc/: { caminho, citacao }) }.
function itemDeTesouros(conteudo) {
  const citacoes = [...conteudo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
  const leias = new Set(); // os textos que o próprio texto da apostila manda ler ("(Leia …)")
  return { texto: textoDe(conteudo), referencias: referenciasDe(conteudo, leias), leias: [...leias], citacoes, temLinks: /<a\b/.test(conteudo) };
}

// O discurso de Tesouros no HTML da apostila (sem as fontes lidas): { titulo, minutos, pontos, reflexao } ou null.
export function discursoDeTesouros(html) {
  const secao = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].find((m) => /tesouros da palavra de deus/.test(semAcento(textoDe(m[1]))));
  if (!secao) return null;
  const resto = html.slice(secao.index + secao[0].length);
  const item = resto.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/);
  if (!item) return null;
  const depois = resto.slice(item.index + item[0].length);
  const fim = depois.search(/<h[23]\b/);
  // As imagens do item (descrição e legenda) vão à parte (veja separarFiguras).
  const { html: bloco, figuras } = separarFiguras(fim >= 0 ? depois.slice(0, fim) : depois);

  const titulo = textoDe(item[1]).replace(/^\d+\.\s*/, "");
  let minutos = null;
  const pontos = [];
  let reflexao = null;
  for (const [, conteudo] of bloco.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const texto = textoDe(conteudo);
    if (!texto || texto === "§figura§") continue;
    const tempo = texto.match(/^\((\d+)\s*min\)/);
    if (tempo) {
      minutos = Number(tempo[1]);
      continue;
    }
    const dados = itemDeTesouros(conteudo);
    // "PERGUNTE-SE: …" / "PARA MEDITAR: …": a pergunta de reflexão (ponto de aplicação).
    if (/^\p{Lu}[\p{Lu}\s-]{3,}:/u.test(texto)) {
      if (!reflexao) reflexao = dados;
      continue;
    }
    // Sem links é a legenda de uma imagem; depois da reflexão não há mais pontos.
    if (!dados.temLinks || reflexao) continue;
    pontos.push(dados);
  }
  return pontos.length ? { titulo, minutos: minutos || 10, pontos, reflexao, imagens: imagensUteis(figuras) } : null;
}

// Lê o discurso de Tesouros da semana (e os trechos das fontes citadas nos pontos e na reflexão). null = não achou.
export async function lerTesouros(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = tesouros.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.discurso;

  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const url = `${BASE}/pt/wol/d/r5/lp-t/${apostila}`;
  const html = await baixar(url, timeoutMs);
  const base = discursoDeTesouros(html);
  if (!base) return null;
  // A ilustração do discurso: a que vem no começo da seção "Tesouros da Palavra de Deus", antes do primeiro item (o do discurso), e as do próprio
  // item do discurso. As dos outros itens da seção (como a Leitura da Bíblia) ficam de fora.
  const antesDoDiscurso = imagensDaApostila(html)
    .filter((i) => /tesouros da palavra de deus/.test(semAcento(i.secao)) && !i.item)
    .map(({ descricao, legenda }) => ({ descricao, legenda }));
  const vistas = new Set();
  base.imagens = [...antesDoDiscurso, ...(base.imagens || [])].filter((i) => {
    const chave = `${i.descricao}|${i.legenda}`;
    return !vistas.has(chave) && vistas.add(chave);
  });

  // Cada publicação citada é lida uma vez só; os pontos costumam citar o mesmo artigo.
  const docs = new Map();
  const todas = [...base.pontos.flatMap((p) => p.citacoes), ...(base.reflexao ? base.reflexao.citacoes : [])];
  const unicas = [...new Map(todas.map((c) => [c.caminho, c])).values()].slice(0, MAX_FONTES_TESOUROS);
  const lidas = new Map(await Promise.all(unicas.map(async (c) => [c.caminho, await lerTrechoCitado(c, timeoutMs, 3500, docs).catch(() => null)])));
  const comFontes = ({ temLinks, ...item }) => ({ ...item, fontes: item.citacoes.map((c) => lidas.get(c.caminho)).filter(Boolean) });

  const discurso = {
    semana: leituraDaApostila(html).semana,
    titulo: base.titulo,
    minutos: base.minutos,
    pontos: base.pontos.map(comFontes),
    reflexao: base.reflexao ? comFontes(base.reflexao) : null,
    imagens: base.imagens || [],
    url,
  };
  tesouros.set(urlReuniao, { quando: Date.now(), discurso });
  if (tesouros.size > 20) tesouros.delete(tesouros.keys().next().value);
  return discurso;
}

// As referências bíblicas de todos os pontos (e da reflexão), sem repetir, na ordem da apostila.
export function referenciasDeTesouros(discurso) {
  return [...new Set([...discurso.pontos.flatMap((p) => p.referencias), ...(discurso.reflexao ? discurso.reflexao.referencias : [])])];
}

// Os textos bíblicos da matéria de Tesouros, para a lista da tela: os da apostila, os dos trechos das fontes lidas e os da reflexão (todos
// podem ser lidos no esboço: a IA sugere e o orador marca). Só os marcados com "(Leia …)" no texto da própria apostila valem como LEIA
// original; os "(Leia …)" que vêm dentro das publicações citadas como fonte (matéria de referência) não.
export function textosBiblicosDeTesouros(discurso) {
  const itens = [...discurso.pontos, ...(discurso.reflexao ? [discurso.reflexao] : [])];
  const fontes = itens.flatMap((i) => i.fontes || []);
  return {
    todos: [...itens.flatMap((i) => i.referencias || []), ...fontes.flatMap((f) => f.referencias || [])],
    leia: itens.flatMap((i) => i.leias || []),
  };
}

// Texto do discurso para a IA: o tema, cada ponto da apostila (com os textos bíblicos, a fonte e o trecho lido dela), a pergunta
// de reflexão e o texto exato dos versículos (se vierem).
export function textoDosTesouros(discurso, versiculos = []) {
  const trechos = (fontes) => fontes.map((f) => `   Trecho da fonte (${f.citacao})${f.titulo ? ` do artigo "${f.titulo}"` : ""}: ${f.texto}`);
  const partes = [
    `SEMANA: ${discurso.semana || "(não informada)"} (apostila Vida e Ministério)`,
    `DISCURSO: Tesouros da Palavra de Deus (${discurso.minutos} min)`,
    `TEMA PRINCIPAL (título do item na apostila): ${discurso.titulo}`,
  ];
  discurso.pontos.forEach((p, i) => {
    partes.push(
      [
        `PONTO ${i + 1} DA APOSTILA: ${p.texto}`,
        `   Textos bíblicos: ${p.referencias.join("; ") || "(nenhum indicado)"}`,
        `   Fonte de matéria: ${p.citacoes.map((c) => c.citacao).join("; ") || "(nenhuma indicada)"}`,
        ...trechos(p.fontes),
      ].join("\n")
    );
  });
  if (discurso.reflexao) {
    partes.push([`PERGUNTA DE REFLEXÃO DA APOSTILA (costuma indicar o ponto de aplicação): ${discurso.reflexao.texto}`, ...trechos(discurso.reflexao.fontes)].join("\n"));
  }
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  return partes.join("\n\n");
}

// ---------- Discurso curto de "Faça seu melhor no ministério" (4 a 5 minutos) ----------
// Só algumas semanas têm um item "Discurso" nessa seção (as outras trazem conversas e demonstrações), e o tempo varia (4 ou 5
// minutos): o app lê os minutos da apostila. O item é curto: "(4 min) lmd apêndice A ponto 20 — Tema: Jesus não é o Deus
// Todo-Poderoso. (th lição 7)" ou "(5 min) Discurso. ijwfq artigo 37 — Tema: … (th lição 14)". A fonte (link /wol/pc/) é um
// ponto do apêndice A da brochura Ame as Pessoas (só a frase da verdade e os textos bíblicos) ou um artigo do jw.org inteiro, e
// "th lição N" é a lição de "Aprimore sua leitura e seu ensino" que o orador vai exercitar. Quando a fonte só traz o tema e
// alguns textos, o servidor pesquisa o tema no wol.jw.org (e só lá) e manda os resultados à IA.
const discursosCurtos = new Map(); // url da página de reuniões -> { quando, discurso }
const MAX_CARACTERES_ARTIGO = 5000;
const MAX_CARACTERES_LICAO = 2500;
const MAX_RESULTADOS_PESQUISA = 5;

// O item "Discurso" no HTML da apostila (sem as fontes lidas) ou null (a semana não tem discurso nessa seção).
export function discursoCurtoDaApostila(html) {
  const secao = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].find((m) => /faca seu melhor no ministerio/.test(semAcento(textoDe(m[1]))));
  if (!secao) return null;
  const resto = html.slice(secao.index + secao[0].length);
  const fimSecao = resto.search(/<h2\b/);
  const bloco = fimSecao >= 0 ? resto.slice(0, fimSecao) : resto;
  const itens = [...bloco.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)];

  for (let i = 0; i < itens.length; i++) {
    const titulo = textoDe(itens[i][1]);
    const corpo = bloco.slice(itens[i].index + itens[i][0].length, i + 1 < itens.length ? itens[i + 1].index : undefined);
    const paragrafo = (corpo.match(/<p\b[^>]*>(\s*\(\s*\d+\s*min\)[\s\S]*?)<\/p>/) || [])[1];
    if (!paragrafo) continue;
    const texto = textoDe(paragrafo);
    // "7. Discurso" ou "(5 min) Discurso. …" (a "Demonstração" e as conversas ficam de fora).
    if (!/^\d+\.\s*discurso\b/i.test(titulo) && !/^\(\s*\d+\s*min\)\s*discurso\b/i.test(texto)) continue;

    const minutos = Number((texto.match(/^\(\s*(\d+)\s*min\)/) || [])[1]) || null;
    const tema = ((texto.match(/Tema:\s*(.+?)\s*(?:\(\s*th\b|$)/i) || [])[1] || "").replace(/\s*[.;]+$/, "").trim();
    const links = [...paragrafo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
    const licao = links.find((l) => /^th\b/i.test(l.citacao)) || null;
    const fonte = links.find((l) => !/^th\b/i.test(l.citacao)) || null;
    const leias = new Set();
    const referencias = referenciasDe(paragrafo, leias);
    return { titulo: tema || texto.replace(/^\(\s*\d+\s*min\)\s*(?:discurso\.?)?\s*/i, ""), minutos, texto, fonte, licao, referencias, leias: [...leias], imagens: imagensUteis(separarFiguras(corpo).figuras) };
  }
  return null;
}

// Um documento do wol (a página inteira ou os parágrafos da faixa): título, texto e referências bíblicas.
async function lerDocumentoCitado(citado, timeoutMs, maxCaracteres) {
  const destino = await resolverCitacao(citado.caminho, timeoutMs);
  if (!destino) return null;
  const html = await baixar(destino.url, timeoutMs);
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const partes = [];
  const brutos = [];
  for (const [, , pid, conteudo] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const n = Number(pid);
    if (destino.de !== null && (n < destino.de || n > destino.ate)) continue;
    const texto = textoDe(conteudo);
    if (texto) {
      partes.push(texto);
      brutos.push(conteudo);
    }
  }
  if (!partes.length) return null;
  const leias = new Set();
  const referencias = referenciasDe(brutos.join(" "), leias);
  return {
    tipo: destino.de !== null ? "ponto" : "documento",
    citacao: citado.citacao,
    titulo,
    texto: partes.join("\n").slice(0, maxCaracteres),
    referencias: referencias.slice(0, 40),
    leias: [...leias],
  };
}

// Pesquisa o tema no wol.jw.org (só lá) e devolve até 5 trechos de publicações: [{ rotulo, titulo, trecho, url }]. Primeiro as
// palavras na mesma frase; se houver pouco, no mesmo parágrafo. Ficam de fora a própria apostila, o ponto do apêndice A (que já vem
// à parte), o glossário e as publicações antigas (A Sentinela de antes de 1990).
export async function pesquisarNoWol(tema, timeoutMs, maximo = MAX_RESULTADOS_PESQUISA) {
  const consulta = String(tema || "").replace(/[“”"]/g, "").replace(/[?!.]+$/, "").trim();
  if (consulta.length < 8) return [];
  const buscar = async (proximidade) => {
    const url = `${BASE}/pt/wol/s/r5/lp-t?q=${encodeURIComponent(consulta)}&p=${proximidade}&r=occ&st=a`;
    const html = (await baixar(url, timeoutMs)).replace(/&lrm;/g, "");
    return html
      .split('<ul class="results resultContentDocument">')
      .slice(1)
      .map((bloco) => {
        const cabeca = bloco.match(/<a class="lnk" href="\/pt\/wol\/d\/r5\/lp-t\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
        const ref = textoDe((bloco.match(/<li class="ref">([\s\S]*?)<\/li>/) || [])[1] || "");
        const trecho = [...bloco.matchAll(/<div class="document">([\s\S]*?)<\/div>/g)].map((m) => textoDe(m[1])).join(" ").slice(0, 700);
        return cabeca && trecho ? { rotulo: ref.split(" - ")[0].trim(), ano: Number((ref.match(/—\s*(\d{4})\s*$/) || [])[1]) || null, titulo: textoDe(cabeca[2]), trecho, url: `${BASE}/pt/wol/d/r5/lp-t/${cabeca[1]}` } : null;
      })
      .filter(Boolean);
  };
  const aproveita = (r) => !/^(?:mwb\d*|lmd|nwtstg)\b/i.test(r.rotulo) && !(r.ano && r.ano < 1990);
  let achados = (await buscar("sen")).filter(aproveita);
  if (achados.length < 3) {
    const vistos = new Set(achados.map((r) => r.url));
    achados = achados.concat((await buscar("par")).filter((r) => aproveita(r) && !vistos.has(r.url)));
  }
  // A prioridade é das matérias mais recentes: ordem do ano mais novo para o mais antigo (sem ano, por último; no mesmo ano vale a ordem do site).
  achados = achados.map((r, i) => ({ r, i })).sort((a, b) => (b.r.ano || 0) - (a.r.ano || 0) || a.i - b.i).map(({ r }) => r);
  return achados.slice(0, maximo).map(({ ano, ...r }) => r);
}

// 6.13.03: a SEÇÃO inteira de um livro no wol a partir de uma frase de um parágrafo (o trecho achado nos livros guardados no servidor, que
// não trazem capítulo nem página): pesquisa a frase exata, abre o capítulo e devolve o subtítulo em que o parágrafo está, com os parágrafos dessa
// seção (sem as perguntas de estudo nem as legendas), os números dos parágrafos, a página de cada um e a citação do capítulo.
// Se a seção tiver menos de minParagrafos, junta a seção seguinte (até maxChars). null = a frase não foi achada ou o capítulo não abriu.
// { url, citacao: "rr cap. 18 págs. 189-199", capitulo: 18, tituloCapitulo, subtitulo, paginas: "193-194", paragrafos: "13-15", texto }
// 6.13.09: frases para a busca exata no wol, tiradas de um trecho: de cada frase do texto, até 8 palavras SEM pontuação (a busca exata do wol
// não acha a frase com vírgula, ponto e vírgula, aspas…) e sem palavras quebradas do arquivo ("ningué m"). Até `max` frases, a primeira antes.
export function frasesParaBuscaNoWol(texto, max = 3) {
  const limpo = String(texto || "").replace(/^\s*#{1,3}\s+/gm, "").replace(/^\s*\d{1,3}\s+/gm, "").replace(/\s+/g, " ").trim();
  const frases = limpo.split(/(?<=[.!?…])\s+(?=["“‘(]?\p{Lu})/u);
  const saida = [];
  for (const f of frases) {
    const palavras = f.replace(/\([^)]*\)/g, " ").replace(/[“”"«»‘’'.,;:!?…()[\]—–-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const oito = palavras.slice(0, 8);
    if (oito.length < 5) continue;
    // palavra quebrada no arquivo ("ningué m", "desobedeç am"): uma letra solta que não é palavra (a, e, o, à, é) ou um pedaço sem vogal
    if (oito.some((p) => (/^\p{Ll}$/u.test(p) && !["a", "e", "o", "à", "é"].includes(p)) || (/^\p{Ll}{2,3}$/u.test(p) && !/[aeiouáéíóúâêôãõ]/.test(p)))) continue;
    saida.push(oito.join(" "));
    if (saida.length >= max) break;
  }
  return saida;
}

// A busca exata de uma frase no wol: o 1.º resultado { docId, titulo, citacao } ou null. Com `sigla` ("kr", "it", "th"…), só vale um resultado
// dessa publicação (a mesma frase pode estar numa Sentinela antiga, e a fonte seria de outra publicação).
async function primeiroResultadoNoWol(frase, timeoutMs, sigla = "") {
  const busca = (await baixar(`${BASE}/pt/wol/s/r5/lp-t?q=${encodeURIComponent(`"${frase}"`)}&p=par&r=occ&st=a`, timeoutMs)).replace(/&lrm;/g, "");
  const s = String(sigla || "").trim().toLowerCase();
  for (const bloco of busca.split('<ul class="results resultContentDocument">').slice(1)) {
    const cab = bloco.match(/<a class="lnk" href="\/pt\/wol\/d\/r5\/lp-t\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!cab) continue;
    const ref = textoDe((bloco.match(/<li class="ref">([\s\S]*?)<\/li>/) || [])[1] || "");
    const citacao = ref.split(" - ")[0].trim();
    // a sigla pode ter uma letra a mais na edição revisada ("lv" → "lvs") e o volume ("it" → "it-2")
    if (s && !new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z]?(?:-\\d)?\\b`, "i").test(citacao)) continue;
    return { docId: cab[1], titulo: textoDe(cab[2]), citacao, publicacao: ref.split(" - ").slice(1).join(" - ").trim() };
  }
  return null;
}

// 6.13.09: só a citação de onde está um texto (verbete do Perspicaz, lição de brochura…): tenta até 3 frases. { url, titulo, citacao } ou null.
export async function citacaoNoWol(texto, { timeoutMs = 8000, sigla = "" } = {}) {
  for (const frase of frasesParaBuscaNoWol(texto, 3)) {
    const r = await primeiroResultadoNoWol(frase, timeoutMs, sigla).catch(() => null);
    if (!r || !r.citacao) continue;
    const url = `${BASE}/pt/wol/d/r5/lp-t/${r.docId}`;
    // Sem página na citação ("it-2 “Reino”"): abre o documento e acha a página do parágrafo da frase.
    if (!/\bp(?:ágs?|p)?\.\s*\d/i.test(r.citacao)) {
      const html = await baixar(url, timeoutMs).catch(() => "");
      const { blocos } = blocosDoDocumento(html);
      const alvo = normalizarFrase(frase);
      const b = blocos.find((x) => x.tag === "p" && normalizarFrase(x.texto).includes(alvo));
      if (b && b.pagina) return { url: `${url}#p${b.pid}`, titulo: r.titulo, citacao: `${r.citacao} pág. ${b.pagina}` };
    }
    return { url, titulo: r.titulo, citacao: r.citacao };
  }
  return null;
}

// Os blocos (p, h1, h2, h3) de um documento do wol em ordem, com a página em que cada um começa.
function blocosDoDocumento(html) {
  const blocos = [];
  let pagina = 0;
  for (const m of String(html || "").matchAll(/<span[^>]*class="pageNum"[^>]*data-no="(\d+)"[^>]*>|<(p|h1|h2|h3)\b([^>]*)data-pid="(\d+)"([^>]*)>([\s\S]*?)<\/\2>/g)) {
    if (m[1]) { pagina = Number(m[1]); continue; }
    const conteudo = m[6];
    const marcas = [...conteudo.matchAll(/class="pageNum"[^>]*data-no="(\d+)"/g)];
    const antes = marcas.length ? textoDe(conteudo.slice(0, marcas[0].index).replace(/<span[^>]*$/, "")) : "x";
    if (marcas.length && !antes) pagina = Number(marcas[0][1]);
    const classe = ((m[3] + m[5]).match(/class="([^"]*)"/) || [])[1] || "";
    blocos.push({ tag: m[2], classe, pid: Number(m[4]), pagina, texto: textoDe(conteudo) });
    if (marcas.length) pagina = Number(marcas[marcas.length - 1][1]);
  }
  return { blocos };
}

export async function secaoDoWolPelaFrase(frase, { timeoutMs = 8000, minParagrafos = 3, maxParagrafos = 99, maxChars = 6500, sigla = "" } = {}) {
  // 6.13.09: até 3 frases do trecho, sem pontuação (com vírgula a busca exata do wol não acha nada), só na publicação da sigla
  let achado = null;
  let palavras = "";
  const frases = frasesParaBuscaNoWol(frase, 3);
  for (const f of frases) {
    achado = await primeiroResultadoNoWol(f, timeoutMs, sigla).catch(() => null);
    if (achado) { palavras = f; break; }
  }
  // 6.13.09: o trecho não está na publicação esperada (há arquivos com matérias de outras publicações misturadas): vale a publicação em que o
  // wol realmente achou o texto, e o resultado diz isso (outraPublicacao), para a fonte nunca apontar o lugar errado.
  let outraPublicacao = false;
  if (!achado && sigla) {
    for (const f of frases) {
      achado = await primeiroResultadoNoWol(f, timeoutMs, "").catch(() => null);
      if (achado) { palavras = f; outraPublicacao = true; break; }
    }
  }
  if (!achado) return null;
  const cab = [null, achado.docId, achado.titulo];
  const citacao = achado.citacao;
  const url = `${BASE}/pt/wol/d/r5/lp-t/${cab[1]}`;
  const html = await baixar(url, timeoutMs);
  // Os blocos em ordem, com a página em que cada um começa (as marcas de página vêm dentro dos parágrafos ou soltas entre eles).
  const blocos = [];
  let pagina = 0;
  for (const m of html.matchAll(/<span[^>]*class="pageNum"[^>]*data-no="(\d+)"[^>]*>|<(p|h1|h2|h3)\b([^>]*)data-pid="(\d+)"([^>]*)>([\s\S]*?)<\/\2>/g)) {
    if (m[1]) { pagina = Number(m[1]); continue; }
    const conteudo = m[6];
    const marcas = [...conteudo.matchAll(/class="pageNum"[^>]*data-no="(\d+)"/g)];
    const antes = marcas.length ? textoDe(conteudo.slice(0, marcas[0].index).replace(/<span[^>]*$/, "")) : "x";
    if (marcas.length && !antes) pagina = Number(marcas[0][1]); // a página começa junto com o bloco
    const classe = ((m[3] + m[5]).match(/class="([^"]*)"/) || [])[1] || "";
    blocos.push({ tag: m[2], classe, pid: Number(m[4]), pagina, texto: textoDe(conteudo) });
    if (marcas.length) pagina = Number(marcas[marcas.length - 1][1]);
  }
  const alvo = normalizarFrase(palavras);
  const i = blocos.findIndex((b) => b.tag === "p" && normalizarFrase(b.texto).includes(alvo));
  if (i < 0) return null;
  const ehSubtitulo = (b) => b.tag === "h2" || b.tag === "h3";
  // Livros com parágrafos numerados (os de estudo) e, nos outros (brochuras, livros sem número), os parágrafos do corpo do texto.
  const numeradoNoTexto = (b) => b.tag === "p" && /^\d{1,3}\s/.test(b.texto) && !/\bqu\b/.test(b.classe);
  const temNumerados = blocos.filter(numeradoNoTexto).length >= 3;
  const ehParagrafo = (b) =>
    temNumerados ? numeradoNoTexto(b) : b.tag === "p" && b.texto.length >= 60 && !/\b(qu|sc|fn|figcaption|themeScrp|contextTtl|sa|sm|se)\b/.test(b.classe);
  let ini = i;
  while (ini > 0 && !ehSubtitulo(blocos[ini - 1]) && blocos[ini - 1].tag !== "h1") ini--;
  const subtitulo = ini > 0 && ehSubtitulo(blocos[ini - 1]) ? blocos[ini - 1].texto : "";
  // A seção inteira (e as seguintes, até ter minParagrafos), sem perguntas de estudo, legendas e quadros.
  const secao = [];
  let paragrafos = 0;
  for (let k = ini; k < blocos.length; k++) {
    const b = blocos[k];
    if (ehSubtitulo(b)) {
      if (k > i && paragrafos >= minParagrafos) break; // a seção acabou e já tem o mínimo
      secao.push({ ...b, subtitulo: true, k });
      continue;
    }
    if (b.tag !== "p") continue;
    const numerado = ehParagrafo(b);
    const primeiro = temNumerados && /\bsb\b/.test(b.classe) && !numerado && !secao.some((e) => !e.subtitulo); // o 1.º parágrafo do capítulo não tem número
    if (!numerado && !primeiro && k !== i) continue;
    secao.push({ ...b, k });
    paragrafos++;
  }
  // 6.13.09: no fim do capítulo a seção pode ter menos que o mínimo: entram os parágrafos anteriores (e o subtítulo deles), até o mínimo.
  if (paragrafos < minParagrafos) {
    for (let k = ini - 1; k >= 0 && paragrafos < minParagrafos; k--) {
      const b = blocos[k];
      if (b.tag === "h1") break;
      if (ehSubtitulo(b)) { secao.unshift({ ...b, subtitulo: true, k }); continue; }
      if (b.tag !== "p" || !ehParagrafo(b)) continue;
      secao.unshift({ ...b, k });
      paragrafos++;
    }
  }
  // 6.13.09: seção longa demais (capítulos sem subtítulos): fica uma janela em volta do parágrafo achado (o anterior, ele e os seguintes),
  // até maxChars, com pelo menos minParagrafos.
  let escolhidos = secao;
  const tamanho = (lista) => lista.reduce((s, b) => s + (b.subtitulo ? 0 : b.texto.length), 0);
  // 6.13.16: também quando a seção tem parágrafos demais (a matéria da noite é curta: até maxParagrafos)
  const qtdParagrafos = (lista) => lista.filter((b) => !b.subtitulo).length;
  if (tamanho(secao) > maxChars || qtdParagrafos(secao) > maxParagrafos) {
    const pos = Math.max(0, secao.findIndex((b) => b.k === i));
    let inicio = pos;
    let n = 0;
    for (let k = pos - 1; k >= 0 && n < 1; k--) { inicio = k; if (!secao[k].subtitulo) n++; }
    const janela = [];
    let total = 0;
    let qtd = 0;
    for (let k = inicio; k < secao.length; k++) {
      const b = secao[k];
      if (!b.subtitulo && (total + b.texto.length > maxChars || qtd >= maxParagrafos) && qtd >= minParagrafos && k > pos) break;
      janela.push(b);
      if (!b.subtitulo) { total += b.texto.length; qtd++; }
    }
    // perto do fim da seção, completa o mínimo com os parágrafos anteriores
    for (let k = inicio - 1; k >= 0 && qtd < minParagrafos; k--) {
      janela.unshift(secao[k]);
      if (!secao[k].subtitulo) qtd++;
    }
    escolhidos = janela;
  }
  escolhidos = escolhidos.slice();
  while (escolhidos.length && escolhidos[escolhidos.length - 1].subtitulo) escolhidos.pop();
  const pars = escolhidos.filter((b) => !b.subtitulo);
  if (!pars.length) return null;
  const nums = pars.map((b) => Number((b.texto.match(/^(\d{1,3})\s/) || [])[1])).filter(Boolean);
  const pags = [...new Set(pars.map((b) => b.pagina).filter(Boolean))];
  const linhas = [...(subtitulo ? ["## " + subtitulo] : []), ...escolhidos.map((b) => (b.subtitulo ? "## " + b.texto : b.texto))];
  return {
    url: `${url}#p${pars[0].pid}`,
    citacao,
    publicacao: achado.publicacao || "",
    outraPublicacao,
    capitulo: Number((citacao.match(/\bcap\.\s*(\d{1,3})/) || [])[1]) || 0,
    tituloCapitulo: cab[2],
    subtitulo,
    paginas: pags.length ? (pags.length > 1 ? `${Math.min(...pags)}-${Math.max(...pags)}` : String(pags[0])) : "",
    paragrafos: nums.length ? (nums.length > 1 && nums[nums.length - 1] !== nums[0] ? `${nums[0]}-${nums[nums.length - 1]}` : String(nums[0])) : "",
    texto: linhas.join("\n"),
  };
}
const normalizarFrase = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Um artigo do wol.jw.org pelo endereço (colado pelo orador no card Outros esboços): título, texto (até maxCaracteres) e textos bíblicos.
// Só aceita endereços do próprio wol (/pt/wol/d/r5/lp-t/<número do documento>; com "#h=7:0-9:0" na ponta, só os parágrafos daquela faixa).
// null = não é um endereço de artigo do wol ou o artigo não tem texto.
// 6.12.86: com "estruturado", os subtítulos (h2/h3) saem com "## " na frente (um por linha, como os parágrafos) e o resultado traz os dados da
// publicação do rodapé do wol ("A Sentinela … — 2020" e "wp20 N.° 3 pág. 10").
export async function lerArtigoDoWol(endereco, { timeoutMs = 8000, maxCaracteres = MAX_CARACTERES_ARTIGO, estruturado = false } = {}) {
  let url;
  try {
    url = new URL(String(endereco || "").trim());
  } catch {
    return null;
  }
  const doc = url.pathname.match(/^\/pt\/wol\/d\/r5\/lp-t\/(\d{5,12})\/?$/);
  if (url.protocol !== "https:" || url.hostname !== "wol.jw.org" || !doc) return null;
  const faixa = url.hash.match(/h=(\d+):\d+-(\d+):(\d+)/);
  const de = faixa ? Number(faixa[1]) : null;
  let ate = faixa ? Number(faixa[2]) : null;
  if (faixa && Number(faixa[3]) === 0 && ate > de) ate -= 1;
  const html = await baixar(BASE + "/pt/wol/d/r5/lp-t/" + doc[1], timeoutMs);
  // O título é o h1; as publicações antigas não o têm e o título fica só na aba da página ("Título — BIBLIOTECA ON-LINE…").
  const daAba = textoDe((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "") || daAba;
  const partes = [];
  const brutos = [];
  // 6.12.90: com "estruturado" entram também os títulos de quadro/experiência (div boxTtl, marcados "# "); os subtítulos (h2/h3 e os parágrafos curtos
  // sem ponto final, como "Como a Bíblia me ajuda") saem com "## ".
  for (const [, tag1, pid1, conteudo1, , pid2, conteudo2] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>|<(div)\b(?=[^>]*\bboxTtl\b)[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/div>/g)) {
    const caixa = pid2 !== undefined;
    const tag = caixa ? "div" : tag1;
    const pid = caixa ? pid2 : pid1;
    const conteudo = caixa ? conteudo2 : conteudo1;
    if (caixa && !estruturado) continue;
    const n = Number(pid);
    if (de !== null && (n < de || n > ate)) continue;
    const texto = textoDe(conteudo);
    if (texto) {
      const curtoSemPonto = tag === "p" && texto.length <= 70 && /^\p{Lu}/u.test(texto) && !/[.!?…”’"'»:;,)\d]$/u.test(texto);
      partes.push(estruturado ? (caixa ? "# " : tag !== "p" || curtoSemPonto ? "## " : "") + texto : texto);
      brutos.push(conteudo);
    }
  }
  if (!partes.length) return null;
  const rodape = (html.match(/<div id="documentCitationInformation">([\s\S]{0,600}?<\/strong>)/) || [])[1] || "";
  const divs = [textoDe((rodape.match(/<div>(?!<)([\s\S]*?)<\/div>/) || [])[1] || ""), textoDe((rodape.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || "")];
  return {
    titulo,
    texto: partes.join("\n").slice(0, maxCaracteres),
    referencias: referenciasDe(brutos.join(" ")).slice(0, 40),
    url: BASE + "/pt/wol/d/r5/lp-t/" + doc[1],
    ...(estruturado ? { publicacao: divs[0] || "", citacao: divs[1] || "" } : {}),
  };
}

// Lê o discurso curto da semana (a fonte, a lição do th e, se a fonte só traz o tema e textos, a pesquisa no wol). null = a semana
// não tem discurso na seção Faça seu melhor no ministério (ou não achou a apostila).
export async function lerDiscursoCurto(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = discursosCurtos.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.discurso;

  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const url = `${BASE}/pt/wol/d/r5/lp-t/${apostila}`;
  const html = await baixar(url, timeoutMs);
  const base = discursoCurtoDaApostila(html);
  if (!base) return null;

  const [fonte, licao] = await Promise.all([
    base.fonte ? lerDocumentoCitado(base.fonte, timeoutMs, MAX_CARACTERES_ARTIGO).catch(() => null) : null,
    base.licao ? lerDocumentoCitado(base.licao, timeoutMs, MAX_CARACTERES_LICAO).catch(() => null) : null,
  ]);
  // Com um artigo inteiro como fonte não precisa pesquisar; só com o tema (e os textos do ponto do apêndice) a pesquisa ajuda.
  const pesquisa = fonte && fonte.tipo === "documento" ? [] : await pesquisarNoWol(base.titulo, timeoutMs).catch(() => []);
  const indicadas = [...new Set([...base.referencias, ...(fonte && fonte.tipo === "ponto" ? fonte.referencias : [])])];

  const discurso = {
    semana: leituraDaApostila(html).semana,
    titulo: base.titulo,
    minutos: base.minutos || 4,
    fonte,
    fonteCitada: base.fonte ? base.fonte.citacao : null,
    licao,
    licaoCitada: base.licao ? base.licao.citacao : null,
    pesquisa,
    referencias: indicadas,
    leias: [...new Set(base.leias || [])], // o LEIA original vale só para o que a apostila manda ler (os da fonte não são LEIA original)
    imagens: base.imagens || [],
    url,
  };
  discursosCurtos.set(urlReuniao, { quando: Date.now(), discurso });
  if (discursosCurtos.size > 20) discursosCurtos.delete(discursosCurtos.keys().next().value);
  return discurso;
}

// ---------- "Consideração" de Faça seu melhor no ministério ----------
// Algumas semanas trazem nessa seção um item "Consideração" (ex.: "6. O que você diria?" — "(5 min) Consideração. DE CASA EM CASA. Faça um
// resumo da lmd lição 1 ponto 4b. Mostre a imagem. Depois, pergunte:"), com uma imagem e perguntas em lista, cada uma com a caixa "Sua
// resposta". O app responde a essas perguntas como no Estudo Bíblico; quando elas falam da imagem, a IA recebe a própria imagem.
const consideracoes = new Map(); // url da página de reuniões -> { quando, dados }
const MAX_IMAGENS_CONSIDERACAO = 3;
const MAX_BYTES_IMAGEM = 3_000_000;

// Os itens "Consideração" no HTML da apostila (sem a lição lida nem as imagens baixadas); [] se a semana não tem nenhum.
export function consideracoesDaApostila(html) {
  const secao = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].find((m) => /faca seu melhor no ministerio/.test(semAcento(textoDe(m[1]))));
  if (!secao) return [];
  const resto = html.slice(secao.index + secao[0].length);
  const fimSecao = resto.search(/<h2\b/);
  const bloco = fimSecao >= 0 ? resto.slice(0, fimSecao) : resto;
  const itens = [...bloco.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)];
  const lista = [];
  for (let i = 0; i < itens.length; i++) {
    const tituloH3 = textoDe(itens[i][1]);
    const corpo = bloco.slice(itens[i].index + itens[i][0].length, i + 1 < itens.length ? itens[i + 1].index : undefined);
    const primeiro = corpo.match(/<p\b[^>]*>(\s*\(\s*\d+\s*min\)[\s\S]*?)<\/p>/);
    if (!primeiro) continue;
    const texto = textoDe(primeiro[1]);
    if (!/^\(\s*\d+\s*min\)\s*consideracao\b/.test(semAcento(texto))) continue;
    const minutos = Number((texto.match(/^\(\s*(\d+)\s*min\)/) || [])[1]) || null;
    const links = [...primeiro[1].matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
    // As perguntas: cada <li> com o parágrafo (data-pid = o "par" do JW Library); sem lista, os parágrafos seguintes que terminam em "?".
    const depois = corpo.slice(primeiro.index + primeiro[0].length);
    let perguntas = [...depois.matchAll(/<li\b[^>]*>\s*<p\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)].map(([, pid, p]) => ({ pid, pergunta: textoDe(p) }));
    if (!perguntas.length) {
      perguntas = [...depois.matchAll(/<p\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)].map(([, pid, p]) => ({ pid, pergunta: textoDe(p) })).filter((q) => /\?\s*$/.test(q.pergunta));
    }
    perguntas = perguntas.filter((q) => q.pergunta).slice(0, 12);
    if (!perguntas.length) continue;
    const imagens = [...corpo.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g)].map(([, interno]) => {
      const img = interno.match(/<img\b[^>]*>/);
      const src = img ? (img[0].match(/\bsrc="([^"]+)"/) || [])[1] || "" : "";
      const pequena = img ? (img[0].match(/\bdata-img-small-src="([^"]+)"/) || [])[1] || "" : "";
      const descricao = img ? textoDe((img[0].match(/\balt="([^"]*)"/) || [])[1] || "").slice(0, 700) : "";
      const legenda = textoDe((interno.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || "").slice(0, 400);
      return { src, pequena, descricao, legenda };
    }).filter((f) => f.src || f.descricao || f.legenda);
    lista.push({
      titulo: tituloH3.replace(/^\d+\.\s*/, ""),
      numero: Number((tituloH3.match(/^(\d+)\./) || [])[1]) || null,
      minutos,
      texto,
      pidInstrucao: (primeiro[0].match(/data-pid="(\d+)"/) || [])[1] || null,
      licao: links[0] || null,
      perguntas,
      referencias: referenciasDe(corpo),
      imagens,
    });
  }
  return lista;
}

// Baixa uma imagem do wol.jw.org e a devolve em base64 (para a IA ver); null se não der.
async function imagemEmBase64(caminho, timeoutMs) {
  if (!caminho || !/^\/pt\/wol\//.test(caminho)) return null;
  try {
    const resposta = await fetch(BASE + caminho, { headers: { "User-Agent": AGENTE }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (!resposta.ok) return null;
    const tipo = String(resposta.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(tipo)) return null;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES_IMAGEM) return null;
    return { media: tipo, data: bytes.toString("base64") };
  } catch {
    return null;
  }
}

// A "Consideração" da semana: { semana, url, docId, itens: [...] } com a lição citada (lmd) lida e as imagens em base64. itens vazio = a semana
// não tem esse item (null = não achou a apostila).
// Anotações · Reunião: os discursos e as considerações da reunião Vida e Ministério da semana. Cada item numerado da apostila ("1. Tema") com o
// tempo e o tipo: o 1º dos Tesouros é sempre um discurso; nos outros, a instrução começa com "Discurso" ou "Consideração"; "Necessidades
// locais" é discurso; o Estudo bíblico de congregação também entra. Leitura da Bíblia, Joias e as demonstrações ficam de fora.
export function partesDaApostila(html) {
  const secoes = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({ inicio: m.index, nome: textoDe(m[1]) }));
  const secaoDe = (pos) => {
    let nome = "";
    for (const s of secoes) if (s.inicio < pos) nome = s.nome;
    return nome;
  };
  const itens = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)];
  const partes = [];
  for (let i = 0; i < itens.length; i++) {
    const tituloH3 = textoDe(itens[i][1]);
    const num = tituloH3.match(/^(\d+)\.\s*(.+)$/);
    if (!num) continue;
    const titulo = num[2].trim();
    const corpo = html.slice(itens[i].index + itens[i][0].length, i + 1 < itens.length ? itens[i + 1].index : undefined);
    const p = corpo.match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
    const instrucao = p ? textoDe(p[1]) : "";
    const minutos = Number((instrucao.match(/^\(\s*(\d+)\s*min\)/) || [])[1]) || null;
    const depois = semAcento(instrucao.replace(/^\(\s*\d+\s*min\)\s*/, ""));
    const secao = secaoDe(itens[i].index);
    const s = semAcento(secao);
    const t = semAcento(titulo);
    let tipo = "";
    if (/estudo biblico de congregacao/.test(t)) tipo = "Estudo bíblico";
    else if (/joias espirituais|leitura da biblia/.test(t)) tipo = "";
    else if (/^discurso\b/.test(depois) || /necessidades locais/.test(t)) tipo = "Discurso";
    else if (/^consideracao\b/.test(depois)) tipo = "Consideração";
    else if (/tesouros/.test(s) && !partes.some((x) => /tesouros/.test(semAcento(x.secao)))) tipo = "Discurso";
    if (!tipo) continue;
    const nomeSecao = /tesouros/.test(s) ? "Tesouros da Palavra de Deus" : /faca seu melhor/.test(s) ? "Faça Seu Melhor no Ministério" : /nossa vida crista/.test(s) ? "Nossa Vida Cristã" : secao;
    partes.push({ numero: Number(num[1]), titulo, tipo, minutos, secao: nomeSecao });
  }
  return partes;
}

const partesLidas = new Map(); // url da reunião -> { quando, dados }
export async function lerPartesDaApostila(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = partesLidas.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.dados;
  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const html = await baixar(`${BASE}/pt/wol/d/r5/lp-t/${apostila}`, timeoutMs);
  const { semana, leitura } = leituraDaApostila(html);
  const dados = { semana, leitura: leitura ? leitura.rotulo : "", partes: partesDaApostila(html) };
  partesLidas.set(urlReuniao, { quando: Date.now(), dados });
  if (partesLidas.size > 30) partesLidas.delete(partesLidas.keys().next().value);
  return dados;
}

export async function lerConsideracoes(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = consideracoes.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.dados;
  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const url = `${BASE}/pt/wol/d/r5/lp-t/${apostila}`;
  const html = await baixar(url, timeoutMs);
  const itens = consideracoesDaApostila(html);
  let restantes = MAX_IMAGENS_CONSIDERACAO;
  for (const item of itens) {
    item.licaoLida = item.licao ? await lerLicaoComContexto(item.licao, timeoutMs).catch(() => null) : null;
    for (const img of item.imagens) {
      if (restantes <= 0) break;
      img.arquivo = (await imagemEmBase64(img.src, timeoutMs)) || (await imagemEmBase64(img.pequena, timeoutMs));
      if (img.arquivo) restantes--;
    }
  }
  const dados = { semana: leituraDaApostila(html).semana, url, docId: apostila, itens };
  consideracoes.set(urlReuniao, { quando: Date.now(), dados });
  if (consideracoes.size > 20) consideracoes.delete(consideracoes.keys().next().value);
  return dados;
}

// A matéria citada na instrução (ex.: "lmd lição 1 ponto 4b"): o trecho indicado (os parágrafos da faixa do link) e a lição inteira, para o
// contexto (o ponto sozinho costuma ser uma frase). null se não der para ler.
const MAX_CARACTERES_LICAO_INTEIRA = 9000;
async function lerLicaoComContexto(citado, timeoutMs, maxCaracteres = MAX_CARACTERES_LICAO_INTEIRA) {
  const destino = await resolverCitacao(citado.caminho, timeoutMs);
  if (!destino) return null;
  const html = await baixar(destino.url, timeoutMs);
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const todas = [];
  const indicadas = [];
  const brutos = [];
  for (const [, , pid, conteudo] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const texto = textoDe(conteudo);
    if (!texto) continue;
    const n = Number(pid);
    const naFaixa = destino.de !== null && n >= destino.de && n <= destino.ate;
    todas.push(naFaixa ? `>>> ${texto}` : texto);
    if (naFaixa) indicadas.push(texto);
    brutos.push(conteudo);
  }
  if (!todas.length) return null;
  return {
    citacao: citado.citacao,
    titulo,
    trecho: indicadas.join("\n"),
    texto: todas.join("\n").slice(0, maxCaracteres),
    referencias: referenciasDe(brutos.join(" ")).slice(0, 40),
  };
}

// A lista do que a IA deve responder, com os identificadores: em cada parte, primeiro a instrução ([Instrução], para executar o que ela
// pede, como o resumo de um ponto da brochura) e depois as perguntas ([Pergunta 1], [Pergunta 2]…, numeradas em todas as partes).
// Na Nossa vida cristã, a parte com vídeo ganha também o [Resumo do vídeo] (feito com o texto da fala do vídeo), entre a instrução e as perguntas.
export function perguntasDasConsideracoes(dados) {
  const lista = [];
  let n = 0;
  const comVideo = dados.itens.filter((i) => i.video && i.video.texto).length;
  let nVideo = 0;
  dados.itens.forEach((item, k) => {
    lista.push({ id: dados.itens.length > 1 ? `Instrução ${k + 1}` : "Instrução", instrucao: true, pergunta: item.texto, pid: item.pidInstrucao, parte: k });
    if (item.video && item.video.texto) {
      nVideo++;
      lista.push({ id: comVideo > 1 ? `Resumo do vídeo ${nVideo}` : "Resumo do vídeo", resumoVideo: true, pergunta: `Vídeo "${item.video.titulo || "da parte"}"`, pid: item.pidVideo || item.pidInstrucao, parte: k });
    }
    item.perguntas.forEach((q) => lista.push({ id: `Pergunta ${++n}`, instrucao: false, pergunta: q.pergunta, pid: q.pid, parte: k }));
  });
  return lista;
}

// ---------- Nossa vida cristã: partes com vídeo e perguntas ----------
// Quase toda semana a seção traz uma consideração com um vídeo ("Mostre o VÍDEO Ajudar os Inativos. Depois, pergunte: …"). O servidor lê a
// parte (matéria, imagem, perguntas, publicações citadas) e o TEXTO DA FALA DO VÍDEO, que o jw.org publica pronto: o arquivo "AIVTT" (legenda
// em português gerada pelo jw.org) da lista de arquivos do vídeo ou, na falta dele, a legenda comum. Sem texto publicado, a IA responde com a
// matéria e a imagem (e avisa). Ficam de fora o cântico, o Estudo bíblico de congregação e os comentários finais.
const nossasVidasCristas = new Map(); // url da página de reuniões -> { quando, dados }
const MAX_CARACTERES_VIDEO = 24000;

// O vídeo citado num trecho da apostila: { pub, issue, track } ou { docid, track } ou { lank }; null se não houver.
function videoDoTrecho(html) {
  const dv = html.match(/data-video="webpubvid:\/\/\?([^"]+)"/);
  if (dv) {
    const q = new URLSearchParams(decodificar(dv[1]));
    if (q.get("pub")) return { pub: q.get("pub"), issue: q.get("issue") || "", track: q.get("track") || "", docid: q.get("docid") || "" };
    if (q.get("docid")) return { docid: q.get("docid"), track: q.get("track") || "" };
  }
  const lank = (decodificar(html).match(/[?&]lank=([A-Za-z0-9_-]+)/) || [])[1];
  if (lank) {
    const p = lank.match(/^pub-([a-z0-9][a-z0-9-]*?)_(?:(\d+)_)?(\d+)_VIDEO$/i);
    if (p) return { pub: p[1], issue: p[2] || "", track: p[3], lank };
    const d = lank.match(/^docid-(\d+)_(\d+)_VIDEO$/i);
    if (d) return { docid: d[1], track: d[2], lank };
    return { lank };
  }
  return null;
}

// WebVTT -> texto em parágrafos (sem os tempos, sem falas repetidas seguidas). Uma pausa de 2,5 s ou mais entre duas falas (troca de cena)
// começa outro parágrafo; um parágrafo muito longo também é quebrado no fim de uma frase.
const segundosVtt = (t) => t.split(":").reduce((s, p) => s * 60 + Number(p), 0);
function textoDoVtt(vtt) {
  const paragrafos = [];
  let atual = [];
  let fimAnterior = null;
  let ultima = "";
  const fechar = () => { if (atual.length) paragrafos.push(atual.join(" ")); atual = []; };
  for (const bloco of String(vtt || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const linhas = bloco.split("\n");
    const iTempo = linhas.findIndex((l) => /-->/.test(l));
    if (iTempo < 0) continue;
    const tempos = linhas[iTempo].match(/((?:\d+:)?\d+:\d+(?:\.\d+)?)\s*-->\s*((?:\d+:)?\d+:\d+(?:\.\d+)?)/);
    const fala = linhas.slice(iTempo + 1).map((l) => decodificar(l.replace(/<[^>]+>/g, "")).trim()).filter(Boolean).join(" ");
    if (!fala || fala === ultima) continue;
    ultima = fala;
    const inicio = tempos ? segundosVtt(tempos[1]) : null;
    if (fimAnterior !== null && inicio !== null && inicio - fimAnterior >= 2.5) fechar();
    else if (atual.join(" ").length > 650 && /[.!?…"”]$/.test(atual[atual.length - 1] || "")) fechar();
    atual.push(fala);
    fimAnterior = tempos ? segundosVtt(tempos[2]) : fimAnterior;
  }
  fechar();
  return paragrafos.join("\n\n");
}

async function baixarJson(url, timeoutMs) {
  const r = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) return null;
  return r.json();
}

// O texto da fala do vídeo: { titulo, duracaoS, texto, fonte } (texto vazio se o jw.org não publicou nenhum).
// maxCaracteres: o corte do texto (24 mil nas partes da apostila; o Assistente de pesquisas pede mais, para vídeos de 1 a 2 horas).
export async function lerTextoDoVideo(video, { timeoutMs = 8000, maxCaracteres = MAX_CARACTERES_VIDEO } = {}) {
  const a = await legendaDoVideo(video, timeoutMs);
  const texto = a.vtt ? textoDoVtt(a.vtt).slice(0, maxCaracteres) : "";
  return { titulo: a.titulo, duracaoS: a.duracaoS, texto, fonte: texto ? a.fonte : "" };
}

// A legenda do vídeo (WebVTT, com os tempos): { titulo, duracaoS, vtt, fonte } — vtt vazio se o jw.org não publicou nenhuma.
export async function legendaDoVideo(video, timeoutMs = 8000) {
  let titulo = "";
  let duracaoS = 0;
  let urlTexto = "";
  let fonte = "";
  try {
    if (video.pub || video.docid) {
      const q = video.pub
        ? `pub=${encodeURIComponent(video.pub)}${video.issue ? `&issue=${encodeURIComponent(video.issue)}` : ""}`
        : `docid=${encodeURIComponent(video.docid)}`;
      const dados = await baixarJson(`https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&${q}${video.track ? `&track=${encodeURIComponent(video.track)}` : ""}&langwritten=T&alllangs=0&txtCMSLang=T`, timeoutMs);
      const arquivos = (dados && dados.files && dados.files.T) || {};
      const mp4 = (arquivos.MP4 || [])[0];
      if (mp4) { titulo = mp4.title || ""; duracaoS = Math.round(mp4.duration || 0); }
      const ai = (arquivos.AIVTT || [])[0];
      if (ai && ai.file && ai.file.url) { urlTexto = ai.file.url; fonte = "texto da fala publicado pelo jw.org"; }
      if (!urlTexto) {
        const comLegenda = Object.values(arquivos).flat().find((f) => f && f.subtitles && f.subtitles.url);
        if (comLegenda) { urlTexto = comLegenda.subtitles.url; fonte = "legenda do vídeo"; }
      }
    }
    if (!urlTexto) {
      const lank = video.lank || (video.pub ? `pub-${video.pub}_${video.issue ? video.issue + "_" : ""}${video.track}_VIDEO` : video.docid ? `docid-${video.docid}_${video.track || 1}_VIDEO` : "");
      if (lank) {
        const m = await baixarJson(`https://b.jw-cdn.org/apis/mediator/v1/media-items/T/${encodeURIComponent(lank)}?clientType=www`, timeoutMs);
        const item = m && m.media && m.media[0];
        if (item) {
          titulo = titulo || item.title || "";
          duracaoS = duracaoS || Math.round(item.duration || 0);
          const comLegenda = (item.files || []).find((f) => f.subtitles && f.subtitles.url);
          if (comLegenda) { urlTexto = comLegenda.subtitles.url; fonte = "legenda do vídeo"; }
        }
      }
    }
    const vtt = urlTexto ? await (await fetch(urlTexto, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(timeoutMs) })).text() : "";
    return { titulo, duracaoS, vtt, fonte: vtt ? fonte : "" };
  } catch {
    return { titulo, duracaoS, vtt: "", fonte: "" };
  }
}

// As partes da Nossa vida cristã com perguntas ou vídeo (sem o cântico, o Estudo bíblico de congregação e os comentários finais).
export function nossaVidaCristaDaApostila(html) {
  const secao = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].find((m) => /nossa vida crista/.test(semAcento(textoDe(m[1]))));
  if (!secao) return [];
  const resto = html.slice(secao.index + secao[0].length);
  const fimSecao = resto.search(/<h2\b/);
  const bloco = fimSecao >= 0 ? resto.slice(0, fimSecao) : resto;
  const itens = [...bloco.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)];
  const lista = [];
  for (let i = 0; i < itens.length; i++) {
    const tituloH3 = textoDe(itens[i][1]);
    const nome = semAcento(tituloH3);
    if (/^cantico\b|estudo biblico de congregacao|comentarios finais/.test(nome.replace(/^\d+\.\s*/, ""))) continue;
    // Até o próximo h3 ou o fim do conteúdo da apostila (o que vem depois do último item é a página, não a apostila).
    let corpo = bloco.slice(itens[i].index + itens[i][0].length, i + 1 < itens.length ? itens[i + 1].index : undefined);
    const fimDoc = corpo.search(/<!--\s*Root element of lightbox|id="questionContainer"/);
    if (fimDoc >= 0) corpo = corpo.slice(0, fimDoc);
    const semListas = corpo.replace(/<li\b[\s\S]*?<\/li>/g, "");
    const paragrafos = [...semListas.matchAll(/<p\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)].map(([, pid, p]) => ({ pid, texto: textoDe(p), html: p })).filter((p) => p.texto);
    const perguntas = [...corpo.matchAll(/<li\b[^>]*>\s*<p\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)].map(([, pid, p]) => ({ pid, pergunta: textoDe(p) })).filter((q) => q.pergunta).slice(0, 12);
    const video = videoDoTrecho(corpo);
    if (!perguntas.length && !video) continue;
    const pVideo = paragrafos.find((p) => videoDoTrecho(p.html));
    const minutos = Number(((paragrafos[0] && paragrafos[0].texto) || "").match(/^\(\s*(\d+)\s*min\)/)?.[1]) || null;
    const citadas = [...corpo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) })).filter((c) => !/^c[aâ]ntico/i.test(c.citacao)).slice(0, 2);
    const imagens = [...corpo.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g)].map(([, interno]) => {
      const img = interno.match(/<img\b[^>]*>/);
      return {
        src: img ? (img[0].match(/\bsrc="([^"]+)"/) || [])[1] || "" : "",
        pequena: img ? (img[0].match(/\bdata-img-small-src="([^"]+)"/) || [])[1] || "" : "",
        descricao: img ? textoDe((img[0].match(/\balt="([^"]*)"/) || [])[1] || "").slice(0, 700) : "",
        legenda: textoDe((interno.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || "").slice(0, 400),
      };
    }).filter((f) => f.src || f.descricao || f.legenda);
    lista.push({
      titulo: tituloH3.replace(/^\d+\.\s*/, ""),
      numero: Number((tituloH3.match(/^(\d+)\./) || [])[1]) || null,
      minutos,
      texto: paragrafos.map((p) => p.texto).join("\n"),
      pidInstrucao: (pVideo || paragrafos[0] || {}).pid || null,
      pidVideo: pVideo ? pVideo.pid : null,
      perguntas,
      referencias: referenciasDe(corpo),
      imagens,
      citadas,
      videoRef: video,
    });
  }
  return lista;
}

// A Nossa vida cristã da semana: { semana, url, docId, itens } com o texto do vídeo, as publicações citadas e as imagens em base64.
export async function lerNossaVidaCrista(urlReuniao, { timeoutMs = 8000 } = {}) {
  const guardado = nossasVidasCristas.get(urlReuniao);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.dados;
  const apostila = idDaApostilaNaReuniao(await baixar(urlReuniao, timeoutMs));
  if (!apostila) return null;
  const url = `${BASE}/pt/wol/d/r5/lp-t/${apostila}`;
  const html = await baixar(url, timeoutMs);
  const itens = nossaVidaCristaDaApostila(html);
  let restantes = MAX_IMAGENS_CONSIDERACAO;
  for (const item of itens) {
    item.video = item.videoRef ? await lerTextoDoVideo(item.videoRef, { timeoutMs }) : null;
    item.citadasLidas = [];
    for (const c of item.citadas) {
      const lida = await lerLicaoComContexto(c, timeoutMs, 6000).catch(() => null);
      if (lida) item.citadasLidas.push(lida);
    }
    for (const img of item.imagens) {
      if (restantes <= 0) break;
      img.arquivo = (await imagemEmBase64(img.src, timeoutMs)) || (await imagemEmBase64(img.pequena, timeoutMs));
      if (img.arquivo) restantes--;
    }
  }
  const dados = { semana: leituraDaApostila(html).semana, url, docId: apostila, itens };
  nossasVidasCristas.set(urlReuniao, { quando: Date.now(), dados });
  if (nossasVidasCristas.size > 20) nossasVidasCristas.delete(nossasVidasCristas.keys().next().value);
  return dados;
}

// Texto da Nossa vida cristã para a IA: cada parte (tema, matéria, imagens, publicações citadas, o texto da fala do vídeo) e o que responder.
export function textoDaNossaVidaCrista(dados, versiculos = []) {
  const partes = [`SEMANA: ${dados.semana || "(não informada)"} (apostila Vida e Ministério, seção Nossa vida cristã)`];
  const lista = perguntasDasConsideracoes(dados);
  let nImagem = 0;
  dados.itens.forEach((item, k) => {
    const doItem = lista.filter((q) => q.parte === k);
    const instrucao = doItem.find((q) => q.instrucao);
    const resumo = doItem.find((q) => q.resumoVideo);
    const bloco = [`PARTE${item.numero ? ` ${item.numero}` : ""}: ${item.titulo}${item.minutos ? ` (${item.minutos} min)` : ""}`, `[${instrucao.id}] MATÉRIA E INSTRUÇÃO DA APOSTILA (execute o que ela pede):\n${item.texto}`];
    item.imagens.forEach((img) => {
      nImagem++;
      bloco.push(`IMAGEM ${nImagem}${img.arquivo ? " (anexa a este pedido, na mesma ordem)" : " (não anexada)"}: ${[img.descricao && `descrição do site: ${img.descricao}`, img.legenda && `legenda: ${img.legenda}`].filter(Boolean).join(" | ") || "(sem descrição)"}`);
    });
    if (item.video) {
      const v = item.video;
      const cab = `VÍDEO DA PARTE: "${v.titulo || "(sem título)"}"${v.duracaoS ? ` (${Math.floor(v.duracaoS / 60)} min ${v.duracaoS % 60} s)` : ""}`;
      bloco.push(v.texto ? `${cab}${resumo ? ` — resuma em [${resumo.id}]` : ""}\nTEXTO DA FALA DO VÍDEO (${v.fonte}; sem as cenas sem fala):\n${v.texto}` : `${cab}\nTEXTO DA FALA DO VÍDEO: não disponível (o jw.org não publicou texto deste vídeo). Responda com a matéria e as imagens e diga, na resposta que depender do vídeo, que ela foi feita sem o conteúdo do vídeo.`);
    }
    item.citadasLidas.forEach((l) => {
      bloco.push(`PUBLICAÇÃO CITADA NA PARTE (${l.citacao}${l.titulo ? ` — "${l.titulo}"` : ""}):${l.trecho ? `\nTRECHO INDICADO:\n${l.trecho}` : ""}\nCONTEXTO (as linhas com >>> são o trecho indicado):\n${l.texto}`);
    });
    const perguntas = doItem.filter((q) => !q.instrucao && !q.resumoVideo);
    bloco.push("PERGUNTAS:\n" + (perguntas.length ? perguntas.map((q) => `[${q.id}] ${q.pergunta}`).join("\n") : "(nenhuma)"));
    partes.push(bloco.join("\n"));
  });
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  return partes.join("\n\n");
}

// Texto da "Consideração" para a IA: a semana, cada item (tema, instrução da apostila, lição lida, imagens) e as perguntas com o identificador.
export function textoDasConsideracoes(dados, versiculos = []) {
  const partes = [`SEMANA: ${dados.semana || "(não informada)"} (apostila Vida e Ministério, seção Faça seu melhor no ministério)`];
  const lista = perguntasDasConsideracoes(dados);
  let nImagem = 0;
  dados.itens.forEach((item, k) => {
    const doItem = lista.filter((q) => q.parte === k);
    const instrucao = doItem.find((q) => q.instrucao);
    const bloco = [`PARTE${item.numero ? ` ${item.numero}` : ""}: ${item.titulo}${item.minutos ? ` (${item.minutos} min)` : ""}`, `[${instrucao.id}] INSTRUÇÃO DA APOSTILA (execute o que ela pede): ${item.texto}`];
    item.imagens.forEach((img) => {
      nImagem++;
      bloco.push(`IMAGEM ${nImagem}${img.arquivo ? " (anexa a este pedido, na mesma ordem)" : " (não anexada)"}: ${[img.descricao && `descrição do site: ${img.descricao}`, img.legenda && `legenda: ${img.legenda}`].filter(Boolean).join(" | ") || "(sem descrição)"}`);
    });
    if (item.licaoLida) {
      const l = item.licaoLida;
      bloco.push(`MATÉRIA CITADA NA INSTRUÇÃO (${l.citacao}${l.titulo ? ` — "${l.titulo}"` : ""}, brochura Ame as Pessoas — Faça Discípulos):`);
      if (l.trecho) bloco.push(`TRECHO INDICADO (o ponto citado; base principal do que a instrução pede):\n${l.trecho}`);
      bloco.push(`LIÇÃO INTEIRA, PARA O CONTEXTO (as linhas com >>> são o trecho indicado):\n${l.texto}`);
    } else if (item.licao) bloco.push(`MATÉRIA CITADA NA INSTRUÇÃO: ${item.licao.citacao} (o texto não pôde ser lido).`);
    bloco.push("PERGUNTAS:\n" + doItem.filter((q) => !q.instrucao).map((q) => `[${q.id}] ${q.pergunta}`).join("\n"));
    partes.push(bloco.join("\n"));
  });
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  return partes.join("\n\n");
}

// As referências bíblicas para buscar o texto: as indicadas na apostila (e no ponto do apêndice) ou, com um artigo como fonte, as dele.
export function referenciasDoDiscursoCurto(discurso) {
  if (discurso.referencias.length) return discurso.referencias;
  return discurso.fonte && discurso.fonte.tipo === "documento" ? discurso.fonte.referencias : [];
}

// Os textos bíblicos da matéria do discurso curto, para a lista da tela: os indicados e os da fonte (artigo ou ponto do apêndice) entram, para
// a IA sugerir e o orador marcar; só os marcados com "(Leia …)" na apostila valem como LEIA original (os da fonte não).
export function textosBiblicosDoDiscursoCurto(discurso) {
  return {
    todos: [...discurso.referencias, ...(discurso.fonte ? discurso.fonte.referencias || [] : [])],
    leia: discurso.leias || [],
  };
}

// Texto do discurso para a IA: o tema, a fonte indicada, a lição do th, o texto dos versículos e a pesquisa do tema no wol.jw.org.
export function textoDoDiscursoCurto(discurso, versiculos = []) {
  const partes = [
    `SEMANA: ${discurso.semana || "(não informada)"} (apostila Vida e Ministério)`,
    `DISCURSO: Faça seu melhor no ministério (${discurso.minutos} min)`,
    `TEMA: ${discurso.titulo}`,
  ];
  if (discurso.fonte) {
    const f = discurso.fonte;
    partes.push(`FONTE DE MATÉRIA INDICADA NA APOSTILA (${f.citacao}${f.titulo ? ` — "${f.titulo}"` : ""}${f.tipo === "ponto" ? ", um ponto do apêndice A, só com a verdade e os textos bíblicos" : ", artigo"}):\n${f.texto}`);
  } else {
    partes.push("FONTE DE MATÉRIA INDICADA NA APOSTILA: nenhuma (só o tema).");
  }
  partes.push(`TEXTOS BÍBLICOS INDICADOS: ${discurso.referencias.join("; ") || "(nenhum: se a fonte for um artigo, escolha até 3 textos dele)"}`);
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  if (discurso.licao) {
    partes.push(`LIÇÃO QUE O ORADOR VAI EXERCITAR (${discurso.licao.citacao}, do livro Aprimore sua leitura e seu ensino${discurso.licao.titulo ? ` — "${discurso.licao.titulo}"` : ""}):\n${discurso.licao.texto}`);
  } else if (discurso.licaoCitada) {
    partes.push(`LIÇÃO QUE O ORADOR VAI EXERCITAR: ${discurso.licaoCitada} (o texto da lição não pôde ser lido).`);
  }
  if (discurso.pesquisa.length) {
    partes.push(
      `RESULTADOS DA PESQUISA DO TEMA NO WOL.JW.ORG (feita pelo servidor; use só estes, e só se ajudarem; cite a publicação pelo rótulo entre colchetes):\n` +
        discurso.pesquisa.map((r) => `[${r.rotulo}] "${r.titulo}": ${r.trecho}`).join("\n\n")
    );
  }
  return partes.join("\n\n");
}

// ---------- Caixas "Sua resposta" de um documento (tela Backup) ----------
// Cada caixa de texto do documento (<textarea id="tt58">) fica num <div class="gen-field">, logo depois da pergunta: nos artigos
// de estudo, <p class="qu"><strong>4.</strong> pergunta</p> (o número é o do parágrafo); nas apostilas e nos quadros do fim do
// artigo, o texto que vem antes da caixa. O JW Library guarda a resposta com esse id (TextTag) e o número do documento (docId).
// Só o título, os números e as perguntas voltam ao navegador (nada do backup do usuário passa por aqui).

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const VALIDADE_CAMPOS_MS = 60 * 60 * 1000;
const camposLidos = new Map(); // docId -> { quando, dados }

// No capítulo do Estudo Bíblico de Congregação, a qual pergunta (id das perguntas da leitura do estudo: "Considerar 1", "Analise 3", "Medite 2",
// "Quadro completo 1") pertence cada caixa "Sua resposta": à última pergunta do quadro antes dela. Devolve Map(tag -> id); vazio se o documento não é um capítulo.
function idsEbcDosCampos(html) {
  const inicio = html.search(/<p\b[^>]*class="contextTtl|<h1\b/);
  const marcado = (inicio >= 0 ? html.slice(inicio) : html)
    .replace(/<div class="stdPullQuote[\s\S]*?<\/div>/g, "")
    .replace(/<div class="gen-field"[^>]*>[\s\S]*?<textarea id="(tt\d+)"[^>]*>/g, (todo, tag) => `<i data-campo="${tag}"></i>`);
  const { html: corpo } = separarFiguras(marcado);
  const ids = new Map();
  const contagem = {};
  let secao = "relato";
  let ultimo = "";
  for (const m of corpo.matchAll(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>|<p\b([^>]*)>([\s\S]*?)<\/p>|<i data-campo="(tt\d+)"><\/i>/g)) {
    if (m[1]) {
      const nome = semAcento(textoDe(m[2])).replace(/[:\s]+$/, "");
      if (nome.startsWith("aprenda mais")) break;
      if (nome.startsWith("leia o relato")) secao = "leia";
      const quadro = QUADROS_EBC.find((q) => nome.startsWith(semAcento(q.nome)));
      if (quadro) secao = quadro.id;
      ultimo = "";
    } else if (m[5]) {
      if (ultimo) ids.set(m[5], ultimo);
    } else {
      const texto = textoDe(m[4]);
      if (/contextTtl|x-figura/.test(m[3] || "") || !texto || ehRotuloDeImagemEbc(texto)) continue;
      const quadro = QUADROS_EBC.find((q) => q.id === secao);
      if (!quadro) continue;
      contagem[quadro.id] = (contagem[quadro.id] || 0) + 1;
      ultimo = `${quadro.curto} ${contagem[quadro.id]}`;
    }
  }
  return ids;
}

export function camposDoDocumento(html) {
  const titulo = textoDe((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1]).replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
  // A publicação e a edição, como no JW Library: "w25 julho págs. 20-25" -> w, 20250700; "mwb26 setembro págs. 14-15" -> mwb, 20260900.
  const ref = html.match(/\b(w|mwb)(\d{2})\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i);
  // Os capítulos do Estudo Bíblico de Congregação são de um livro ("wcg cap. 13 págs. 66-69"): publicação wcg, sem edição (0).
  const livro = ref ? null : html.match(/\b(wcg)\s+cap\./i);
  const simbolo = ref ? ref[1].toLowerCase() : livro ? livro[1].toLowerCase() : null;
  const edicao = ref ? (2000 + Number(ref[2])) * 10000 + (MESES.indexOf(ref[3].toLowerCase()) + 1) * 100 : livro ? 0 : null;

  const campos = [];
  let fim = 0;
  for (const m of html.matchAll(/<div class="gen-field"[^>]*>[\s\S]*?<textarea id="(tt\d+)"[^>]*>/g)) {
    const antes = html.slice(Math.max(fim, m.index - 4000), m.index);
    fim = m.index + m[0].length;
    let numero = null;
    let pergunta = "";
    const perguntas = [...antes.matchAll(/<p\b[^>]*class="[^"]*\bqu\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g)];
    if (perguntas.length) {
      const texto = textoDe(perguntas[perguntas.length - 1][1]);
      const partes = texto.match(/^(\d+(?:\s*[,–-]\s*\d+)*)\s*\.\s*(.*)$/);
      if (partes) {
        numero = partes[1].replace(/\s+/g, " ");
        pergunta = partes[2];
      } else {
        pergunta = texto;
      }
    } else {
      // Sem pergunta numerada: o último texto antes da caixa (título do quadro, pergunta da apostila), sem o rótulo "Sua resposta".
      const linhas = decodificar(antes.replace(/<\/(?:p|h[1-6]|li|div|label|header|section)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter((l) => l && !/^sua resposta$/i.test(l));
      pergunta = linhas.length ? linhas[linhas.length - 1] : "";
    }
    const campo = { tag: m[1], numero, pergunta: pergunta.slice(0, 200) };
    // No fim dos artigos de estudo há um quadro (de recapitulação) com uma caixa para cada item: sem pergunta numerada, a caixa está
    // dentro do último quadro (título em <div class="boxTtl"><h2>…</h2>) que vem antes dela.
    if (simbolo === "w" && numero === null) {
      const quadros = [...html.slice(0, m.index).matchAll(/<div\b[^>]*class="[^"]*\bboxTtl\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
      const quadro = quadros.length ? textoDe(quadros[quadros.length - 1][1]) : "";
      if (quadro) {
        campo.quadro = quadro.slice(0, 160);
        // O item de um quadro que continua o título ("O QUE VOCÊ APRENDEU COM . . ." + "o apóstolo Paulo?") vira a pergunta inteira.
        if (/(\s*\.){3}\s*$|…\s*$/.test(quadro) || /^\p{Ll}/u.test(campo.pergunta)) {
          const frase = quadro === quadro.toLocaleUpperCase("pt-BR") ? quadro.charAt(0) + quadro.slice(1).toLocaleLowerCase("pt-BR") : quadro;
          campo.pergunta = perguntaDoQuadro(frase, campo.pergunta).slice(0, 200);
        }
      }
    }
    campos.push(campo);
    if (campos.length >= 120) break;
  }
  const ebc = simbolo === "wcg" ? idsEbcDosCampos(html) : new Map();
  campos.forEach((c) => { if (ebc.has(c.tag)) c.ebc = ebc.get(c.tag); });
  return { titulo, simbolo, edicao, campos };
}

// ---------- Semana de estudo dos artigos e publicações de uma semana (tela Backup) ----------
// O artigo de A Sentinela não diz em que semana é estudado; quem diz é a página de reuniões da semana (/meetings/r5/lp-t/ano/semana,
// semana ISO), que traz o período no título e os links do artigo de estudo e da apostila Vida e Ministério daquela semana.
const reunioesLidas = new Map(); // "ano/semana" -> { quando, dados }
const VALIDADE_REUNIAO_MS = 6 * 60 * 60 * 1000;

// Ano e número da semana ISO de uma data (em UTC).
export function anoSemanaIso(data) {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { ano: d.getUTCFullYear(), semana: Math.ceil(((d - inicio) / 86400000 + 1) / 7) };
}

// { ano, semana, periodo: "15-21 de setembro", sentinela: { id, titulo } | null, apostila: { id, titulo } | null }
export async function lerReuniaoDaSemana(ano, semana, { timeoutMs = 8000 } = {}) {
  const chave = ano + "/" + semana;
  const guardado = reunioesLidas.get(chave);
  if (guardado && Date.now() - guardado.quando < VALIDADE_REUNIAO_MS) return guardado.dados;
  const html = await baixar(`${BASE}/pt/wol/meetings/r5/lp-t/${ano}/${semana}`, timeoutMs);
  const periodo = textoDe((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1]).replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
  let sentinela = null;
  let apostila = null;
  for (const m of html.matchAll(/<a\b[^>]*href="\/pt\/wol\/d\/r5\/lp-t\/(\d{6,12})"[^>]*>([\s\S]*?)<\/a>/g)) {
    const texto = textoDe(m[2]);
    if (!sentinela && /A Sentinela \(Estudo\)/i.test(texto)) sentinela = { id: m[1], titulo: texto.replace(/\s*A Sentinela \(Estudo\).*$/i, "").trim() };
    if (!apostila && /Apostila Vida e Ministério/i.test(texto)) apostila = { id: m[1], titulo: texto.replace(/\s*Apostila Vida e Ministério.*$/i, "").trim() };
  }
  if (!sentinela) {
    const id = idDoArtigoNaReuniao(html);
    if (id) sentinela = { id, titulo: "" };
  }
  const dados = { ano, semana, periodo, sentinela, apostila };
  reunioesLidas.set(chave, { quando: Date.now(), dados });
  if (reunioesLidas.size > 400) reunioesLidas.delete(reunioesLidas.keys().next().value);
  return dados;
}

// O capítulo do Estudo Bíblico de Congregação da semana (a apostila traz o link; o link /wol/pc/ redireciona para o capítulo): { id, titulo: "wcg cap. 13" } ou null.
const estudosDaSemana = new Map(); // id da apostila -> { quando, dados }
export async function lerEstudoDaSemana(apostilaId, { timeoutMs = 8000 } = {}) {
  const guardado = estudosDaSemana.get(apostilaId);
  if (guardado && Date.now() - guardado.quando < VALIDADE_REUNIAO_MS) return guardado.dados;
  const link = linkDoEstudoBiblico(await baixar(`${BASE}/pt/wol/d/r5/lp-t/${apostilaId}`, timeoutMs));
  const destino = link ? await resolverCitacao(link.caminho, timeoutMs) : null;
  const id = destino ? (destino.url.match(/\/(\d{6,12})\/?$/) || [])[1] : null;
  const dados = id ? { id, titulo: link.rotulo } : null;
  estudosDaSemana.set(apostilaId, { quando: Date.now(), dados });
  if (estudosDaSemana.size > 200) estudosDaSemana.delete(estudosDaSemana.keys().next().value);
  return dados;
}

// Em que semana cada artigo de estudo é estudado: docs = [{ id, edicao }] (edicao = 20250700 para "julho de 2025"). A edição de um mês é
// estudada a partir de uns dois meses depois (a de julho, de meados de setembro a meados de outubro); a busca começa duas semanas antes
// do primeiro dia do segundo mês seguinte e vai até 12 semanas, parando quando acha todos os artigos da edição. Devolve { id: { ano, semana, periodo } }.
export async function semanasDosEstudos(docs, { concorrencia = 6, limiteMs = 40000 } = {}) {
  const inicio = Date.now();
  const achados = {};
  const porEdicao = new Map();
  for (const d of docs) {
    if (!porEdicao.has(d.edicao)) porEdicao.set(d.edicao, new Set());
    porEdicao.get(d.edicao).add(String(d.id));
  }
  for (const [edicao, ids] of porEdicao) {
    const ano = Math.floor(edicao / 10000);
    const mes = Math.floor(edicao / 100) % 100;
    const base = Date.UTC(ano, mes - 1 + 2, 1) - 14 * 86400000;
    const semanas = Array.from({ length: 12 }, (_, k) => anoSemanaIso(new Date(base + k * 7 * 86400000)));
    for (let i = 0; i < semanas.length && ids.size && Date.now() - inicio < limiteMs; i += concorrencia) {
      const lote = await Promise.all(semanas.slice(i, i + concorrencia).map((s) => lerReuniaoDaSemana(s.ano, s.semana).catch(() => null)));
      for (const r of lote) {
        if (r && r.sentinela && ids.has(r.sentinela.id)) {
          achados[r.sentinela.id] = { ano: r.ano, semana: r.semana, periodo: r.periodo };
          ids.delete(r.sentinela.id);
        }
      }
    }
  }
  return achados;
}

// Lê o documento (número do wol.jw.org, em português) e devolve o título, a publicação/edição e as caixas "Sua resposta".
export async function lerCamposDoDocumento(docId, { timeoutMs = 8000 } = {}) {
  const guardado = camposLidos.get(docId);
  if (guardado && Date.now() - guardado.quando < VALIDADE_CAMPOS_MS) return guardado.dados;
  const dados = camposDoDocumento(await baixar(`${BASE}/pt/wol/d/r5/lp-t/${docId}`, timeoutMs));
  camposLidos.set(docId, { quando: Date.now(), dados });
  if (camposLidos.size > 300) camposLidos.delete(camposLidos.keys().next().value);
  return dados;
}

// ---------- Programas de assembleia / congresso (pub-media + página WOL, se houver) ----------
// Entrada: código da publicação (CA-brpgm27), link jw.org/finder?pub=…, link wol /d/… ou caminho da biblioteca.
// Devolve título, tema (se a WOL tiver), URL do PDF (para o app extrair as partes) e link da WOL quando existir.
function pubDoTexto(bruto) {
  const t = String(bruto || "");
  const m =
    t.match(/\b((?:CA|CO|CR|ca|co|cr)-[A-Za-z0-9]+)\b/) ||
    t.match(/\b([A-Za-z]{1,6}-[A-Za-z0-9]*pgm[A-Za-z0-9]*)\b/i);
  return m ? m[1] : "";
}

function pubDeEntrada(entrada) {
  const bruto = String(entrada || "").trim();
  if (!bruto) return { pub: "", docId: "", wolUrl: "" };
  try {
    const u = new URL(bruto);
    // docid do finder (jw.org/finder?docid=…) ou da WOL (/wol/d/…) — mais específico que o pub=
    const docParam = (u.searchParams.get("docid") || u.searchParams.get("docId") || "").trim();
    if (/^\d{5,12}$/.test(docParam)) {
      return { pub: (u.searchParams.get("pub") || "").trim(), docId: docParam, wolUrl: `${BASE}/pt/wol/d/r5/lp-t/${docParam}` };
    }
    const doc = u.pathname.match(/\/wol\/d\/r5\/lp-t\/(\d{5,12})\/?$/);
    if (doc) return { pub: (u.searchParams.get("pub") || "").trim(), docId: doc[1], wolUrl: `${BASE}/pt/wol/d/r5/lp-t/${doc[1]}` };
    // Página da biblioteca da WOL (a lista de programas do app): os documentos do programa estão ligados nela.
    if (u.hostname === "wol.jw.org" && /\/wol\/library\//.test(u.pathname)) return { pub: "", docId: "", wolUrl: u.href, biblioteca: true };
    const pubParam = (u.searchParams.get("pub") || "").trim();
    if (pubParam) return { pub: pubParam, docId: "", wolUrl: "" };
    const pubPath = pubDoTexto(decodeURIComponent(u.pathname + " " + u.search));
    if (pubPath) {
      const wolUrl = /wol\.jw\.org/i.test(u.hostname) ? u.href : "";
      return { pub: pubPath, docId: "", wolUrl };
    }
  } catch {
    /* não é URL */
  }
  const soPub = bruto.match(/^([A-Za-z]{1,6}-[A-Za-z0-9]+)$/i);
  if (soPub) return { pub: soPub[1], docId: "", wolUrl: "" };
  const docSo = bruto.match(/^(\d{5,12})$/);
  if (docSo) return { pub: "", docId: docSo[1], wolUrl: `${BASE}/pt/wol/d/r5/lp-t/${docSo[1]}` };
  return { pub: pubDoTexto(bruto), docId: "", wolUrl: "" };
}

function docsNoHtml(html) {
  return [...new Set([...String(html || "").matchAll(/\/wol\/d\/r5\/lp-t\/(\d{5,12})/g)].map((m) => m[1]))];
}

function docsEmPaginaJw(html) {
  // Páginas jw.org misturam dezenas de docids do menu; os da publicação na WOL são 11xxxxxxxxx (ex.: 1102027242).
  return [...new Set([...String(html || "").matchAll(/\b(11\d{8,10})\b/g)].map((m) => m[1]))];
}

// Partes do programa (horário + tema) a partir do HTML da WOL; cada item leva o data-pid para abrir no JW Library.
function partesDoProgramaHtml(html, docId) {
  const partes = [];
  let secao = "";
  let esperaTitulo = false;
  const blocos = [...String(html || "").matchAll(/<(h2|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  for (const m of blocos) {
    const tag = m[1].toLowerCase();
    const pid = (m[2].match(/data-pid="(\d+)"/) || [])[1] || "";
    if (!pid) continue;
    const texto = textoDe(m[3]).replace(/\s+/g, " ").trim();
    if (!texto) continue;
    if (tag === "h2") {
      secao = texto;
      esperaTitulo = false;
      continue;
    }
    const hora = texto.match(/^(\d{1,2})[:h](\d{2})\s+(.*)$/i);
    const sub = texto.match(/^[•·]\s*(.+)$/);
    // "10:10 VÍDEO PRINCIPAL:" traz o título do vídeo nos parágrafos de baixo (sem horário nem marcador): eles completam a parte, e as
    // referências bíblicas finais (entre parênteses) vão para o texto temático.
    if (!hora && !sub) {
      if (esperaTitulo && partes.length) {
        const ultimo = partes[partes.length - 1];
        const refs = texto.match(/^(.*?)\s*\(([^()]*\d[^()]*)\)\s*$/);
        const titulo = refs && refs[1] ? refs[1] : texto;
        ultimo.tema = (ultimo.tema + " " + titulo).replace(/\s+/g, " ").trim();
        if (refs && refs[1]) ultimo.textoTematico = [ultimo.textoTematico, refs[2].trim()].filter(Boolean).join("; ");
      }
      continue;
    }
    esperaTitulo = false;
    let horario = "";
    let resto = texto;
    if (hora) {
      horario = hora[1].padStart(2, "0") + ":" + hora[2];
      resto = hora[3].trim();
    }
    let tema = resto;
    let textoTematico = "";
    const sep = resto.split(/\s*[—–]\s*/);
    if (sep.length >= 2) {
      tema = sep[0].trim();
      textoTematico = sep.slice(1).join(" — ").trim();
    }
    if (tema.length < 2) continue;
    partes.push({
      horario,
      tema,
      textoTematico,
      secao,
      docid: String(docId || ""),
      par: pid,
      orador: "",
      congregacao: "",
    });
    esperaTitulo = !sub && /:$/.test(tema) && !textoTematico;
  }
  return partes;
}

// Perguntas de recapitulação da assembleia de circuito ("Preste atenção às respostas para as seguintes perguntas"): parágrafos numerados
// ("1. Como podemos…? (Sal. 37:4)") seguidos do campo "Sua resposta". Devolve [] em qualquer outro documento.
export function perguntasDoDocHtml(html, docId) {
  const perguntas = [];
  for (const m of String(html || "").matchAll(/<p\b[^>]*data-pid="(\d+)"[^>]*>\s*<span class="txtSrcBullet">\s*(\d{1,2})\.\s*<\/span>([\s\S]*?)<\/p>\s*<div class="gen-field"/gi)) {
    const bruto = m[3];
    const refs = [...bruto.matchAll(/<a\b[^>]*class="b"[^>]*>([\s\S]*?)<\/a>/gi)].map((r) => textoDe(r[1])).join(" ").replace(/\s+/g, " ").replace(/\s+([,;])/g, "$1").trim();
    const texto = textoDe(bruto.replace(/\([^()]*<a\b[\s\S]*$/i, "")).replace(/\s+/g, " ").trim();
    if (texto.length > 4) perguntas.push({ n: Number(m[2]), texto, refs, docid: String(docId || ""), par: m[1] });
  }
  return perguntas;
}

// Partes do programa que têm pergunta de recapitulação: os discursos principais, na ordem. Ficam de fora música, cântico, oração, intervalo,
// anúncios, batismo, experiências e o resumo de A Sentinela; uma série de discursos conta como UMA parte (a do título da série), sem os discursos dela.
const SEM_PERGUNTA_RE = /^(música|vídeo musical|cântico|oração|intervalo|anúncios)\b|batismo|experi[êe]ncias|resumo de a sentinela/i;
export function partesComPergunta(partes) {
  const indices = [];
  (partes || []).forEach((p, i) => {
    const tema = String((p && p.tema) || "").trim();
    if (!p || !p.horario || /^[•·]/.test(tema) || SEM_PERGUNTA_RE.test(tema)) return;
    indices.push(i);
  });
  return indices;
}

async function lerDocPrograma(docId, timeoutMs) {
  const html = await baixar(`${BASE}/pt/wol/d/r5/lp-t/${docId}`, timeoutMs);
  const titulo =
    textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "") ||
    textoDe((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
  const temaHtml = (html.match(/<p\b[^>]*class="[^"]*themeScrp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "";
  return {
    docId: String(docId),
    titulo,
    tema: textoDe(temaHtml),
    // Congresso: o tema do dia é o parágrafo logo abaixo do nome do dia (“Felizes os que… ” — Mateus 5:3).
    diaTema: (() => {
      const t = textoDe((html.match(/<p\b[^>]*data-pid="2"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "").replace(/\s+/g, " ").trim();
      return /^\d{1,2}[:h]\d{2}/.test(t) ? "" : t;
    })(),
    referencias: referenciasDe(temaHtml),
    wolUrl: `${BASE}/pt/wol/d/r5/lp-t/${docId}`,
    partes: partesDoProgramaHtml(html, docId),
    perguntas: perguntasDoDocHtml(html, docId),
    ligados: docsNoHtml(html).filter((id) => id !== String(docId)),
    pub: ((html.match(/\bpub-([A-Za-z]{1,6}-[A-Za-z0-9]+)/) || [])[1] || ""),
  };
}

async function descobrirDocsDoPub(pub, timeoutMs) {
  const codigo = String(pub || "").trim();
  if (!codigo) return [];
  const urls = [
    `https://www.jw.org/finder?srcid=jwlshare&wtlocale=T&prefer=lang&pub=${encodeURIComponent(codigo)}`,
    `${BASE}/pt/wol/s/r5/lp-t?q=${encodeURIComponent(codigo)}`,
  ];
  const achados = new Set();
  for (const url of urls) {
    try {
      const html = await baixar(url, timeoutMs);
      docsEmPaginaJw(html).forEach((id) => achados.add(id));
      docsNoHtml(html).forEach((id) => achados.add(id));
    } catch {
      /* tenta a próxima */
    }
  }
  return [...achados].slice(0, 12);
}

async function metaPubMedia(pub, timeoutMs) {
  const codigo = String(pub || "").trim();
  if (!codigo) return null;
  const url =
    "https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&fileformat=PDF,JWPUB&langwritten=T&pub=" +
    encodeURIComponent(codigo);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/json", "Accept-Language": "pt-BR,pt;q=0.9" },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    const pdf = j && j.files && j.files.T && j.files.T.PDF && j.files.T.PDF[0];
    return {
      pub: j.pub || codigo,
      titulo: (pdf && pdf.title) || j.pubName || codigo,
      pdfUrl: pdf && pdf.file && pdf.file.url ? pdf.file.url : "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function temaDoDocWol(docId, timeoutMs) {
  if (!docId) return { tema: "", referencias: [], wolUrl: "" };
  try {
    const html = await baixar(`${BASE}/pt/wol/d/r5/lp-t/${docId}`, timeoutMs);
    const titulo =
      textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "") ||
      textoDe((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
    const temaHtml = (html.match(/<p\b[^>]*class="[^"]*themeScrp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "";
    const tema = textoDe(temaHtml);
    return {
      titulo,
      tema,
      referencias: referenciasDe(temaHtml),
      wolUrl: `${BASE}/pt/wol/d/r5/lp-t/${docId}`,
    };
  } catch {
    return { titulo: "", tema: "", referencias: [], wolUrl: "" };
  }
}

async function temaDaPaginaWol(url, timeoutMs) {
  if (!url || !/^https:\/\/wol\.jw\.org\//i.test(url)) return { titulo: "", tema: "", referencias: [], wolUrl: "" };
  try {
    const html = await baixar(url, timeoutMs);
    const titulo =
      textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "") ||
      textoDe((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
    const temaHtml = (html.match(/<p\b[^>]*class="[^"]*themeScrp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "";
    return {
      titulo,
      tema: textoDe(temaHtml),
      referencias: referenciasDe(temaHtml),
      wolUrl: url,
    };
  } catch {
    return { titulo: "", tema: "", referencias: [], wolUrl: url };
  }
}

// "FELICIDADE ETERNA" -> "Felicidade Eterna" (só quando o título vem todo em maiúsculas).
function capitalizarTitulo(texto) {
  const t = String(texto || "").trim();
  if (!t || t !== t.toUpperCase()) return t;
  const pequenas = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "para", "com", "por", "na", "no"]);
  return t
    .toLowerCase()
    .split(/(\s+)/)
    .map((p, i) => (/^\s+$/.test(p) || (i > 0 && pequenas.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

export async function lerProgramaPublicacao(entrada, { timeoutMs = 12000 } = {}) {
  const { pub, docId, wolUrl: wolDaEntrada, biblioteca } = pubDeEntrada(entrada);
  if (!pub && !docId && !wolDaEntrada) return null;

  const candidatos = new Set();
  if (docId) candidatos.add(String(docId));

  const [meta, htmlPagina, docsPub] = await Promise.all([
    pub ? metaPubMedia(pub, timeoutMs) : Promise.resolve(null),
    wolDaEntrada && !docId ? baixar(wolDaEntrada, timeoutMs).catch(() => "") : Promise.resolve(""),
    !docId && pub ? descobrirDocsDoPub(pub, timeoutMs) : Promise.resolve([]),
  ]);
  let tituloDaPagina = "";
  if (htmlPagina) {
    docsNoHtml(htmlPagina).forEach((id) => candidatos.add(id));
    // Páginas da WOL só têm os documentos do programa; as do jw.org misturam os do menu (os da publicação começam com 11).
    if (!/^https:\/\/wol\.jw\.org\//i.test(wolDaEntrada)) docsEmPaginaJw(htmlPagina).forEach((id) => candidatos.add(id));
    if (biblioteca) {
      tituloDaPagina =
        textoDe((htmlPagina.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "") ||
        textoDe((htmlPagina.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
    }
  }
  docsPub.forEach((id) => candidatos.add(id));

  // Sem candidatos ainda: tenta o finder da publicação (jw.org) quando só veio o código.
  if (!candidatos.size && pub) {
    (await descobrirDocsDoPub(pub, timeoutMs)).forEach((id) => candidatos.add(id));
  }

  const ler = async (ids) => (await Promise.all(ids.map((id) => lerDocPrograma(id, timeoutMs).catch(() => null)))).filter(Boolean);
  const lidos = await ler([...candidatos].slice(0, 8));
  // Documentos ligados descobertos nos já lidos (capa → programa). Na página da biblioteca a lista já está completa.
  if (!biblioteca) {
    const novos = [];
    lidos.forEach((doc) => doc.ligados.forEach((ligado) => {
      if (!candidatos.has(ligado) && candidatos.size + novos.length < 12 && !novos.includes(ligado)) novos.push(ligado);
    }));
    lidos.push(...(await ler(novos)));
  }

  if (!lidos.length && !meta) return null;

  // Os documentos com a grade de horários formam o programa (um congresso tem um por dia, em ordem de documento); a capa traz só o tema.
  const comPartes = lidos.filter((d) => d.partes.length).sort((a, b) => Number(a.docId) - Number(b.docId));
  const programa = comPartes[0] || lidos[0] || null;
  const capa = lidos.find((d) => d.tema && d.partes.length === 0) || lidos.find((d) => d.tema) || programa;

  // Capa: título longo da publicação + tema bíblico; programa: grade com horários (docid/par para o JW Library).
  const titulo =
    tituloDaPagina ||
    (capa && capa.partes.length === 0 && capa.titulo) ||
    (meta && meta.titulo) ||
    (capa && capa.titulo) ||
    (programa && programa.titulo) ||
    pub ||
    docId ||
    "";
  let tema = (capa && capa.tema) || (programa && programa.tema) || "";
  let docidCapa = (capa && capa.docId) || (programa && programa.docId) || "";
  // Congresso: o tema é o título (em maiúsculas) do primeiro documento, a capa do programa.
  if (!tema && biblioteca) {
    const primeiro = [...lidos].sort((x, y) => Number(x.docId) - Number(y.docId))[0];
    if (primeiro && !primeiro.partes.length && primeiro.titulo) {
      tema = capitalizarTitulo(primeiro.titulo);
      docidCapa = primeiro.docId; // congresso: a capa do programa
    }
  }
  const referencias = (capa && capa.referencias && capa.referencias.length ? capa.referencias : null)
    || (programa && programa.referencias)
    || [];
  const wolUrl = (programa && programa.wolUrl) || (capa && capa.wolUrl) || wolDaEntrada || "";
  const docPrograma = (programa && programa.docId) || docId || "";

  // Com vários dias, cada parte leva o nome do dia na seção ("Sábado · Manhã").
  const varios = comPartes.length > 1;
  const partes = comPartes.flatMap((doc) =>
    doc.partes.map((p) => (varios && doc.titulo ? { ...p, secao: p.secao ? `${doc.titulo} · ${p.secao}` : doc.titulo, dia: doc.titulo, diaTema: doc.diaTema || "" } : p)),
  );

  // Só a assembleia de circuito tem a segunda sessão (perguntas de recapitulação). Com o mesmo número de perguntas e de partes que têm pergunta,
  // cada pergunta vai para a parte da mesma posição (perguntaN); senão fica "pendente" e o app pede à IA que organize.
  const perguntas = (lidos.find((d) => d.perguntas && d.perguntas.length) || {}).perguntas || [];
  let atribuicao = "";
  if (perguntas.length) {
    const elegiveis = partesComPergunta(partes);
    if (elegiveis.length === perguntas.length) {
      elegiveis.forEach((indice, k) => { partes[indice].perguntaN = perguntas[k].n; });
      atribuicao = "auto";
    } else {
      atribuicao = "pendente";
    }
  }

  return {
    pub: (meta && meta.pub) || pub || (capa && capa.pub) || (programa && programa.pub) || "",
    titulo,
    tema,
    referencias,
    pdfUrl: (meta && meta.pdfUrl) || "",
    wolUrl,
    docid: docPrograma,
    docidCapa: String(docidCapa || docPrograma || ""),
    partes,
    perguntas,
    atribuicao,
  };
}

// ---------- Lista dos programas disponíveis (assembleias de circuito e congressos) ----------
// Lida das categorias "Programas" da biblioteca da WOL; o app mostra a lista já ao abrir a tela Anotações, sem código nem link.
const PROGRAMAS_BIBLIOTECA = `${BASE}/pt/wol/library/r5/lp-t/todas-as-publica%C3%A7%C3%B5es/programas`;
const CATEGORIAS_PROGRAMAS = [
  { caminho: "congresso", tipo: "congresso", grupo: "Congresso" },
  { caminho: "assembleia-de-circuito-com-o-superintendente-de-circuito", tipo: "assembleia", grupo: "Superintendente de Circuito" },
  { caminho: "assembleia-de-circuito-com-o-representante-da-filial", tipo: "assembleia", grupo: "Representante de Betel" },
];
const VALIDADE_PROGRAMAS_MS = 6 * 60 * 60 * 1000;
let programasLidos = null; // { quando, itens }

export function programasDaCategoria(html, categoria) {
  const itens = [];
  const vistos = new Set();
  for (const m of String(html || "").matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let href = m[1];
    try {
      href = decodeURIComponent(href);
    } catch {
      /* mantém o original */
    }
    const dentro = href.split(`/programas/${categoria.caminho}/`)[1];
    if (!dentro || dentro.includes("/") || vistos.has(href)) continue;
    const titulo = textoDe(m[2]).replace(/\s+/g, " ").trim();
    const anos = titulo.match(/(\d{4})(?:\s*[-–]\s*(\d{4}))?/);
    if (!anos) continue;
    vistos.add(href);
    const ano = anos[2] ? `${anos[1]}-${anos[2]}` : anos[1];
    itens.push({
      tipo: categoria.tipo,
      grupo: categoria.grupo,
      ano,
      ordem: Number(anos[2] || anos[1]),
      titulo: categoria.tipo === "congresso" ? `Congresso ${ano}` : `Assembleia de Circuito ${ano}`,
      url: href.startsWith("http") ? href : BASE + href,
    });
  }
  return itens;
}

// O tema de cada programa está nos links da página dele: congresso = "PROGRAMA Felicidade Eterna"; assembleia = o 2º link (“Feliz É Aquele…”).
export function temaDoProgramaHtml(html, tipo) {
  const links = [...String(html || "").matchAll(/<a\b[^>]*href="[^"]*\/wol\/d\/r5\/lp-t\/\d+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => textoDe(m[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (tipo === "congresso") {
    const capa = links.find((t) => /^PROGRAMA\s+/i.test(t));
    return capa ? capitalizarTitulo(capa.replace(/^PROGRAMA\s+/i, "")) : "";
  }
  const tema = links[1] || "";
  return /^(preste aten|programa d)/i.test(tema) ? "" : tema;
}

async function acrescentarTemas(itens, { concorrencia = 8, timeoutMs = 6000 } = {}) {
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const item = itens[proximo++];
      try {
        item.tema = temaDoProgramaHtml(await baixar(item.url, timeoutMs), item.tipo);
      } catch {
        item.tema = "";
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concorrencia, itens.length) }, trabalhador));
}

export async function listarProgramas({ timeoutMs = 10000, forcar = false } = {}) {
  // Com "forcar" (botão Atualizar lista) o cache de 6 h é ignorado, mas no máximo uma vez por minuto.
  const validade = forcar ? 60 * 1000 : VALIDADE_PROGRAMAS_MS;
  if (programasLidos && Date.now() - programasLidos.quando < validade) return programasLidos.itens;
  const paginas = await Promise.all(
    CATEGORIAS_PROGRAMAS.map((c) => baixar(`${PROGRAMAS_BIBLIOTECA}/${c.caminho}`, timeoutMs).then((html) => programasDaCategoria(html, c)).catch(() => [])),
  );
  const itens = paginas.flat().sort((a, b) => b.ordem - a.ordem || a.grupo.localeCompare(b.grupo, "pt-BR"));
  if (!itens.length) return programasLidos ? programasLidos.itens : [];
  await acrescentarTemas(itens);
  programasLidos = { quando: Date.now(), itens };
  return itens;
}

/// ---------- Assistente de pesquisas ----------
// A pesquisa de um assunto no wol.jw.org devolve, para cada matéria encontrada, o parágrafo exato: a publicação, a edição, a página e o
// número do parágrafo, com o texto dele (e o seguinte, para dar contexto). O resultado da busca nem sempre diz qual parágrafo achou: o artigo
// é aberto com a mesma busca (o wol marca as palavras achadas com <span class="mk">) e vale o parágrafo com mais palavras da consulta. A página
// vem das marcas de página do artigo (pageNum) que ficam antes do parágrafo; o número, do data-pnum. Com isso a resposta da IA cita as fontes
// com precisão, sem depender dela.
const docsDaPesquisa = new Map(); // url do documento (com a busca) -> { quando, html }

async function documentoDaPesquisa(url, timeoutMs) {
  const guardado = docsDaPesquisa.get(url);
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.html;
  const html = await baixar(url, timeoutMs);
  docsDaPesquisa.set(url, { quando: Date.now(), html });
  if (docsDaPesquisa.size > 60) docsDaPesquisa.delete(docsDaPesquisa.keys().next().value);
  return html;
}

// "ws15 15/9 págs. 15-20 - A Sentinela (Fácil de Ler) — 2015" -> { codigo: "ws15 15/9", publicacao: "A Sentinela (Fácil de Ler)", ano: 2015 }
function referenciaDaBusca(ref) {
  const texto = String(ref || "");
  const [antes, ...depois] = texto.split(" - ");
  const resto = depois.join(" - ");
  const ano = Number((resto.match(/—\s*(\d{4})\s*$/) || [])[1]) || Number((texto.match(/\b((?:19|20)\d{2})\b/) || [])[1]) || null;
  return {
    codigo: antes.replace(/\s*p[áa]gs?\.\s*[\d\s,–-]+$/i, "").trim(),
    publicacao: resto.replace(/\s*—\s*\d{4}\s*$/, "").replace(/\s*\([a-z0-9-]{1,8}\)\s*$/, "").trim() || antes.trim(),
    ano,
  };
}

// Pesquisa a consulta no wol (palavras no mesmo parágrafo; se vier pouco, no mesmo documento) e devolve até "maximo" achados:
// [{ docId, consulta, titulo, codigo, publicacao, ano }]. Ficam os 16 primeiros da ordem do site (os de mais ocorrências) e, deles, os mais
// novos. Fora: a apostila Vida e Ministério, o glossário e as publicações de antes de 1990.
export async function pesquisarParagrafosNoWol(consulta, timeoutMs, maximo = 8) {
  const q = String(consulta || "").replace(/[“”"]/g, "").replace(/[?!.]+$/, "").trim().slice(0, 200);
  if (q.length < 3) return [];
  const buscar = async (proximidade) => {
    const url = `${BASE}/pt/wol/s/r5/lp-t?q=${encodeURIComponent(q)}&p=${proximidade}&r=occ&st=a`;
    const html = (await baixar(url, timeoutMs)).replace(/&lrm;/g, "");
    return html
      .split('<ul class="results resultContentDocument">')
      .slice(1)
      .map((bloco) => {
        const cabeca = bloco.match(/<a class="lnk" href="\/pt\/wol\/d\/r5\/lp-t\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
        if (!cabeca) return null;
        const ref = textoDe((bloco.match(/<li class="ref">([\s\S]*?)<\/li>/) || [])[1] || "");
        return { docId: cabeca[1], consulta: q, proximidade, titulo: textoDe(cabeca[2]).replace(/­/g, ""), ...referenciaDaBusca(ref) };
      })
      // Fora também os índices (Guia de Pesquisa, Índice das Publicações): só listam referências, não explicam.
      .filter((r) => r && !/^(?:mwb\d*|nwtstg|rsg\d*|dx\d*)\b/i.test(r.codigo) && !/^(?:guia de pesquisa|[íi]ndice)/i.test(r.publicacao) && !(r.ano && r.ano < 1990));
  };
  let achados = (await buscar("par")).slice(0, 16);
  if (achados.length < 4) {
    const vistos = new Set(achados.map((r) => r.docId));
    achados = achados.concat((await buscar("doc")).filter((r) => !vistos.has(r.docId)).slice(0, 16 - achados.length));
  }
  achados = achados.map((r, i) => ({ r, i })).sort((a, b) => (b.r.ano || 0) - (a.r.ano || 0) || a.i - b.i).map(({ r }) => r);
  // O Examine as Escrituras (um documento por mês, com um texto por dia) aparece muito: no máximo 2 por consulta, para sobrar lugar às matérias.
  let textosDiarios = 0;
  achados = achados.filter((r) => !/^es\d/.test(r.codigo) || ++textosDiarios <= 2);
  return achados.slice(0, maximo);
}

// As matérias MAIS NOVAS do wol que tratam da consulta (6.11.56, "Pesquisar outras fontes" do esboço do serviço de campo): a busca no mesmo
// documento, da edição mais nova para a mais antiga (a ordem por ocorrências traz só Anuários). Fora, por padrão, o que não é matéria para
// o ministério: anuários, índices, o texto diário, a apostila, o Perspicaz, a Bíblia e os glossários.
export async function pesquisarMateriasNovasNoWol(consulta, timeoutMs, maximo = 8, { excluir = /^(?:yb|dx|rsg|es\d|mwb|it-|rbi|nwt|g\s*\d|lmd|th\b)/i } = {}) {
  const q = String(consulta || "").replace(/[“”"]/g, "").replace(/[?!.]+$/, "").trim().slice(0, 200);
  if (q.length < 3) return [];
  const url = `${BASE}/pt/wol/s/r5/lp-t?q=${encodeURIComponent(q)}&p=doc&r=newest&st=a`;
  const html = (await baixar(url, timeoutMs)).replace(/&lrm;/g, "");
  const vistos = new Set();
  return html
    .split('<ul class="results resultContentDocument">')
    .slice(1)
    .map((bloco) => {
      const cabeca = bloco.match(/<a class="lnk" href="\/pt\/wol\/d\/r5\/lp-t\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      if (!cabeca) return null;
      const ref = textoDe((bloco.match(/<li class="ref">([\s\S]*?)<\/li>/) || [])[1] || "");
      return { docId: cabeca[1], consulta: q, proximidade: "doc", titulo: textoDe(cabeca[2]).replace(/­/g, ""), ...referenciaDaBusca(ref) };
    })
    .filter((r) => r && !excluir.test(r.codigo) && !/^(?:guia de pesquisa|[íi]ndice)/i.test(r.publicacao) && !(r.ano && r.ano < 1990) && !vistos.has(r.docId) && vistos.add(r.docId))
    .slice(0, maximo);
}

// O parágrafo achado na pesquisa, lido no artigo: { titulo, pagina, paragrafos, pid, texto, url }. Vale o elemento com mais palavras
// diferentes da consulta marcadas; se for a pergunta de um parágrafo (class "qu"), vale o parágrafo (ou parágrafos) que ela pergunta; senão,
// o parágrafo e o seguinte (contexto). null = não deu para ler.
export async function paragrafoDaPesquisa(achado, timeoutMs, maxCaracteres = 1600) {
  const url = `${BASE}/pt/wol/d/r5/lp-t/${achado.docId}`;
  const html = await documentoDaPesquisa(`${url}?q=${encodeURIComponent(achado.consulta || "")}&p=${achado.proximidade || "par"}`, timeoutMs);
  const titulo = (textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "") || achado.titulo).replace(/­/g, "");
  const elementos = [...html.matchAll(/<(p|h2|h3|h4)\b([^>]*\bdata-pid="(\d+)"[^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    pid: Number(m[3]),
    atributos: m[2],
    conteudo: m[4],
    posicao: m.index,
  }));
  if (!elementos.length) return null;
  const pergunta = (e) => /\bclass="qu\b/.test(e.atributos);
  // Pontos de cada elemento: palavras diferentes marcadas (as de 3 letras ou mais valem; "os", "de" quase não contam) e, no empate, o total.
  let melhor = -1;
  let pontosMelhor = 0;
  elementos.forEach((e, i) => {
    const marcadas = [...e.conteudo.matchAll(/<span class="mk">([\s\S]*?)<\/span>/g)].map((m) => semAcento(textoDe(m[1])));
    if (!marcadas.length) return;
    const diferentes = new Set(marcadas.filter((w) => w.length >= 3));
    const pontos = diferentes.size * 100 + Math.min(marcadas.length, 50) + (pergunta(e) ? 0 : 1);
    if (pontos > pontosMelhor) {
      pontosMelhor = pontos;
      melhor = i;
    }
  });
  if (melhor < 0) melhor = elementos.findIndex((e) => !pergunta(e) && textoDe(e.conteudo).length > 120);
  if (melhor < 0) return null;
  let escolhidos;
  if (pergunta(elementos[melhor])) {
    const id = String(elementos[melhor].pid);
    escolhidos = elementos.filter((e) => {
      const rel = (e.atributos.match(/data-rel-pid="\[([^\]]*)\]"/) || [])[1];
      return rel && rel.split(",").map((x) => x.trim()).includes(id);
    });
    if (!escolhidos.length) escolhidos = elementos.slice(melhor + 1, melhor + 2);
  } else {
    escolhidos = [elementos[melhor]];
    const proximo = elementos[melhor + 1];
    if (proximo && textoDe(proximo.conteudo).length > 60 && !pergunta(proximo) && !/^h/.test(proximo.conteudo)) escolhidos.push(proximo);
  }
  if (!escolhidos.length) return null;
  // A página: a última marca de página antes do primeiro parágrafo escolhido (ou dentro dele, logo no começo).
  const antes = html.slice(0, escolhidos[0].posicao + 300);
  const marcas = [...antes.matchAll(/class="pageNum"[^>]*data-no="(\d+)"/g)];
  const pagina = marcas.length ? Number(marcas[marcas.length - 1][1]) : null;
  const numeros = escolhidos.map((e) => (e.conteudo.match(/data-pnum="(\d+)"/) || [])[1]).filter(Boolean);
  const texto = escolhidos.map((e) => textoDe(e.conteudo).replace(/­/g, "")).filter(Boolean).join("\n").slice(0, maxCaracteres);
  const primeiroPid = escolhidos[0].pid;
  const ultimoPid = escolhidos[escolhidos.length - 1].pid;
  // Destaque no wol: do primeiro ao último parágrafo escolhido, se estiverem juntos (um quadro no meio deixa só o primeiro).
  const fimDestaque = (ultimoPid >= primeiroPid && ultimoPid - primeiroPid <= 3 ? ultimoPid : primeiroPid) + 1;
  if (!texto) return null;
  return {
    titulo,
    pagina,
    paragrafos: numeros.length ? (numeros.length > 1 ? `${numeros[0]}-${numeros[numeros.length - 1]}` : numeros[0]) : "",
    pid: escolhidos[0].pid,
    texto,
    url: `${url}#h=${primeiroPid}:0-${fimDestaque}:0`,
  };
}

// ---------- Matéria de capa da página inicial do jw.org (6.15.23) ----------
// O destaque do alto da página inicial (div "billboard"): título, resumo, endereço e o número do documento (classe "docId-102026005" do botão
// "Saiba mais"), que é o mesmo no wol.jw.org — o texto é lido lá. Guardada por 1 hora na instância (a capa muda poucas vezes por semana).
let capaJw = null; // { quando, capa }
const VALIDADE_CAPA_MS = 3600 * 1000;
export function capaDaPaginaInicial(html) {
  const ini = String(html || "").indexOf('class="billboard');
  if (ini < 0) return null;
  const bloco = html.slice(ini, ini + 12000);
  const a = bloco.match(/<h3\b[^>]*billboardTitle[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (!a) return null;
  const titulo = textoDe(a[2]);
  const descricao = textoDe((bloco.match(/billboardDescription[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "");
  const docId = (bloco.match(/\bdocId-(\d{6,12})\b/) || [])[1] || "";
  const link = a[1].startsWith("/") ? BASE_JW + a[1] : a[1];
  if (!titulo || !/^https:\/\/www\.jw\.org\/pt\//.test(link)) return null;
  return { titulo, descricao, link, docId };
}
// 6.15.31: o jw.org responde aos servidores na nuvem com uma verificação anti-robô (202, página vazia), então a capa não é mais lida de lá:
// a pessoa cola o link da matéria (copiado do jw.org no celular) e o servidor acha a MESMA matéria no wol.jw.org — pela revista do link
// (Despertai!/A Sentinela, número e ano → sumário da edição no wol) ou, se não for revista, pela pesquisa do wol com o título exato.
const slugDe = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const BIBLIOTECA_WOL = BASE + "/pt/wol/library/r5/lp-t/todas-as-publicações/";
function linksDoWol(html) {
  const ini = html.indexOf('id="content"');
  const corpo = ini > 0 ? html.slice(ini) : html;
  return [...corpo.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: decodificar(m[1]), texto: textoDe(m[2]) }));
}
function documentosDoWol(html) {
  const vistos = new Set();
  const lista = [];
  for (const { href, texto } of linksDoWol(html)) {
    const d = href.match(/^\/pt\/wol\/d\/r5\/lp-t\/(\d{6,12})(?:[?#]|$)/);
    if (!d || vistos.has(d[1]) || !texto) continue;
    vistos.add(d[1]);
    lista.push({ docId: d[1], titulo: texto });
  }
  return lista;
}
// O título do wol corresponde ao fim do endereço do jw.org ("COMO VENCER A SOLIDÃO Ajude outros" ↔ "ajude-outros")?
function tituloCombina(titulo, artigo) {
  const s = slugDe(titulo);
  if (!s || !artigo) return 0;
  if (s === artigo) return 3;
  if (s.endsWith("-" + artigo)) return 2;
  const palavras = artigo.split("-").filter((p) => p.length > 2);
  const doTitulo = new Set(s.split("-"));
  return palavras.length >= 2 && palavras.every((p) => doTitulo.has(p)) ? 1 : 0;
}
async function sumarioDaRevistaNoWol(revista, timeoutMs) {
  let m = revista.match(/^despertai-no(\d+)-(\d{4})$/);
  if (m) return BIBLIOTECA_WOL + `despertai/despertai-${m[2]}/n-${m[1]}`;
  m = revista.match(/^(?:a-)?sentinela-no(\d+)-(\d{4})$/);
  if (m) return BIBLIOTECA_WOL + `a-sentinela/a-sentinela-${m[2]}/edição-para-o-público/n-${m[1]}`;
  m = revista.match(/^(?:a-)?sentinela-estudo-([a-z]+)-(\d{4})$/);
  if (m) {
    const edicoes = await baixar(encodeURI(BIBLIOTECA_WOL + `a-sentinela/a-sentinela-${m[2]}/edição-de-estudo`), timeoutMs);
    const achou = linksDoWol(edicoes).find((l) => /\/edi/.test(l.href) && slugDe(l.texto).includes(m[1]));
    return achou ? BASE + achou.href : null;
  }
  return null;
}
export async function capaPeloLinkDoJw(link, { timeoutMs = 9000 } = {}) {
  let url;
  try {
    url = new URL(String(link || "").trim());
  } catch {
    return { erro: "link" };
  }
  if (url.protocol !== "https:" || !/^(www\.)?jw\.org$/.test(url.hostname)) return { erro: "link" };
  // 6.15.32: o link do botão Compartilhar do jw.org ("https://www.jw.org/finder?wtlocale=T&docid=102026005&srcid=share") já traz o
  // número do documento, que é o mesmo no wol (wtlocale=T = português).
  if (/^\/finder\/?$/.test(url.pathname)) {
    const docId = url.searchParams.get("docid") || "";
    if (!/^\d{6,12}$/.test(docId) || (url.searchParams.get("wtlocale") || "T") !== "T") return { erro: "link" };
    return montarCapaDoWol({ docId, titulo: "" }, `https://www.jw.org/finder?wtlocale=T&docid=${docId}`, timeoutMs);
  }
  if (!url.pathname.startsWith("/pt/")) return { erro: "link" };
  const partes = url.pathname.split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const artigo = slugDe(partes[partes.length - 1]);
  if (!artigo || partes.length < 3) return { erro: "link" };
  const ano = (url.pathname.match(/(20\d\d)/) || [])[1] || "";
  let candidatos = [];
  const iRev = partes.indexOf("revistas");
  if (iRev >= 0 && partes[iRev + 1] && partes.length > iRev + 2) {
    const sumario = await sumarioDaRevistaNoWol(slugDe(partes[iRev + 1]), timeoutMs).catch(() => null);
    if (sumario) candidatos = documentosDoWol(await baixar(encodeURI(sumario), timeoutMs).catch(() => ""));
  }
  let melhor = null;
  for (const c of candidatos) {
    const n = tituloCombina(c.titulo, artigo);
    if (n && (!melhor || n > melhor.n)) melhor = { ...c, n };
  }
  if (!melhor) {
    // Pesquisa do wol pelas palavras do endereço; só vale título que combine (os mais novos e do mesmo ano primeiro).
    const q = encodeURIComponent('"' + artigo.replace(/-/g, " ") + '"');
    const html = await baixar(BASE + `/pt/wol/s/r5/lp-t?q=${q}&p=doc`, timeoutMs).catch(() => "");
    for (const c of documentosDoWol(html)) {
      const n = tituloCombina(c.titulo, artigo) * 2 + (ano && c.docId.includes(ano) ? 1 : 0);
      if (tituloCombina(c.titulo, artigo) >= 2 && (!melhor || n > melhor.n)) melhor = { ...c, n };
    }
  }
  if (!melhor) return { erro: "nao-achou" };
  return montarCapaDoWol(melhor, url.origin.replace("//jw.org", "//www.jw.org") + url.pathname, timeoutMs);
}
async function montarCapaDoWol(melhor, link, timeoutMs) {
  const a = await lerArtigoDoWol(`${BASE}/pt/wol/d/r5/lp-t/${melhor.docId}`, { timeoutMs, maxCaracteres: 3000, estruturado: true }).catch(() => null);
  if (!a) return { erro: "nao-achou" };
  const linhas = a.texto.split("\n");
  const primeiro = linhas.find((l) => !l.startsWith("#") && l.length > 60) || "";
  // A série vem antes do título — no sumário ("COMO VENCER A SOLIDÃO Ajude outros") ou na 1.ª linha da matéria ("COMO VENCER A SOLIDÃO") —
  // e fica "Como vencer a solidão — Ajude outros".
  let titulo = a.titulo || melhor.titulo;
  let serie = melhor.titulo && melhor.titulo.endsWith(titulo) ? melhor.titulo.slice(0, -titulo.length).trim() : "";
  if (!serie) {
    const l1 = (linhas[0] || "").replace(/^#+\s*/, "").trim();
    if (l1 && l1 !== titulo && /\p{Lu}/u.test(l1) && l1 === l1.toUpperCase() && l1.length <= 70) serie = l1;
  }
  if (serie && serie === serie.toUpperCase()) titulo = serie.charAt(0) + serie.slice(1).toLowerCase() + " — " + titulo;
  return {
    capa: {
      titulo,
      descricao: primeiro.length > 260 ? primeiro.slice(0, 257).replace(/\s+\S*$/, "") + "…" : primeiro,
      link,
      docId: melhor.docId,
    },
  };
}

// 6.15.30: no servidor a página inicial às vezes vinha sem o destaque (resposta 502 em 0,2 s). Agora: tenta de novo com o agente de navegador
// comum, procura o número do documento na própria matéria quando o botão "Saiba mais" não o traz e registra no log o que veio, para diagnóstico.
const AGENTE_NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
async function baixarJw(url, timeoutMs, agente) {
  const resposta = await fetch(url, {
    headers: { "User-Agent": agente, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = resposta.ok ? (await resposta.text()).slice(0, MAX_BYTES) : "";
  return { status: resposta.status, url: resposta.url, html };
}
export async function lerCapaDoJw({ timeoutMs = 9000, forcar = false } = {}) {
  if (!forcar && capaJw && Date.now() - capaJw.quando < VALIDADE_CAPA_MS) return capaJw.capa;
  let capa = null;
  const vistos = [];
  for (const agente of [AGENTE, AGENTE_NAVEGADOR]) {
    const r = await baixarJw(BASE_JW + "/pt/", timeoutMs, agente);
    capa = capaDaPaginaInicial(r.html);
    vistos.push(`${agente === AGENTE ? "app" : "navegador"}: ${r.status} ${r.url} ${r.html.length} bytes, billboard=${r.html.includes('class="billboard')}, título="${textoDe((r.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").slice(0, 80)}"`);
    if (capa) break;
  }
  if (capa && !capa.docId) {
    try {
      const r = await baixarJw(capa.link, timeoutMs, AGENTE_NAVEGADOR);
      capa.docId = (r.html.match(/\bdocId-(\d{6,12})\b/) || [])[1] || "";
      if (!capa.docId) vistos.push(`matéria sem docId: ${r.status} ${capa.link}`);
    } catch (e) {
      vistos.push(`matéria: ${e?.message}`);
    }
  }
  if (!capa || !capa.docId) console.error("Matéria de capa do jw.org: não achada.", vistos.join(" | "));
  if (capa && capa.docId) capaJw = { quando: Date.now(), capa };
  return capa;
}

// ---------- Guia de Pesquisa para Testemunhas de Jeová (jw.org) ----------
// O Guia de Pesquisa atualizado fica no jw.org (o do wol, edição 2019, parou no tempo): uma página por tópico ("Ansiedade", "Perdão (perdoar
// outros)"…), com subtítulos ("Como lidar", "Informações para jovens"…) e, em cada um, os artigos recomendados, dos mais novos para os mais
// antigos. Cada artigo traz o número do documento no wol (data-page-id="mid2022360" = /pt/wol/d/r5/lp-t/2022360), às vezes a faixa exata de
// parágrafos (data-highlightrange="p43-p48") e a citação ("w22.04 págs. 2-3"). O servidor acha os tópicos do assunto e lê no wol os parágrafos
// de cada artigo indicado: são as fontes mais certeiras da pesquisa.
const BASE_JW = "https://www.jw.org";
const CAMINHO_GUIA = "/pt/biblioteca/indices/guia-de-pesquisa/";
let topicosGuia = null; // { quando, lista: [{ nome, url, palavras }] }
const paginasGuia = new Map(); // url do tópico -> { quando, entradas }
const VALIDADE_GUIA_MS = 24 * 3600 * 1000;
const PALAVRAS_FRACAS = new Set("como para sobre entre quando onde porque pelos pelas pela pelo dos das nos nas uma umas uns com sem que mais muito outros outras".split(" "));

// Palavras comuns demais para escolher sozinhas um tópico do Guia ou um assunto do Índice ("prioridades na vida" não é sobre "Vida dupla").
// Também os adjetivos comuns ("grande" está em muitos títulos de vídeo: "grande privilégio", "Grande Instrutor"…).
const GENERICAS = new Set(["vida", "deus", "jeova", "biblia", "biblic", "cristao", "crista", "cristae", "pessoa", "mundo", "coisas", "tempo", "dia", "parte", "grande", "pequen", "novo", "nova", "novos", "novas", "maior", "melhor", "muito", "muitos", "todos", "todas"]);

const raizes = (texto) =>
  semAcento(String(texto || ""))
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 4 && !PALAVRAS_FRACAS.has(w))
    .map((w) => w.slice(0, 6));

export async function topicosDoGuia(timeoutMs) {
  if (topicosGuia && Date.now() - topicosGuia.quando < VALIDADE_GUIA_MS) return topicosGuia.lista;
  const html = await baixar(BASE_JW + CAMINHO_GUIA, timeoutMs);
  const vistos = new Set();
  const lista = [];
  for (const m of html.matchAll(/href="(\/pt\/biblioteca\/indices\/guia-de-pesquisa\/[^"#?]+?)\/?"[^>]*>\s*([^<]+?)\s*<\/a>/g)) {
    const url = BASE_JW + m[1] + "/";
    const nome = textoDe(m[2]);
    if (!nome || vistos.has(url) || url === BASE_JW + CAMINHO_GUIA) continue;
    vistos.add(url);
    lista.push({ nome, url, palavras: [...new Set(raizes(nome))] });
  }
  if (lista.length) topicosGuia = { quando: Date.now(), lista };
  return lista;
}

// Os tópicos do Guia que combinam com o assunto e as buscas (até "maximo"): os que têm todas as palavras na consulta vêm primeiro (os de mais
// palavras, mais específicos, antes); depois os que têm pelo menos metade.
export async function topicosDoGuiaPara(textos, timeoutMs, maximo = 2) {
  const consulta = new Set(textos.flatMap(raizes));
  if (!consulta.size) return [];
  const lista = await topicosDoGuia(timeoutMs);
  return lista
    .map((t) => {
      const achadas = t.palavras.filter((w) => consulta.has(w)).length;
      const fortes = t.palavras.filter((w) => consulta.has(w) && !GENERICAS.has(w)).length;
      return { t, achadas, fortes, parte: t.palavras.length ? achadas / t.palavras.length : 0 };
    })
    .filter((x) => x.fortes && x.parte >= 0.5)
    .sort((a, b) => b.parte - a.parte || b.achadas - a.achadas || a.t.nome.length - b.t.nome.length)
    .slice(0, maximo)
    .map((x) => ({ nome: x.t.nome, url: x.t.url }));
}

// Os artigos de um tópico, na ordem da página: [{ subtitulo, titulo, docId, de, ate, codigo, ano }]. Ficam fora os vídeos (sem documento no
// wol), a apostila Vida e Ministério e as publicações de antes de 1990.
export async function entradasDoGuia(topico, timeoutMs) {
  const guardado = paginasGuia.get(topico.url);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.entradas;
  const html = await baixar(topico.url, timeoutMs);
  const entradas = [];
  let subtitulo = "";
  const marcas = /<summary\b[^>]*>([\s\S]*?)<\/summary>|<a\b([^>]*\bdata-page-id="mid(\d+)"[^>]*)>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(marcas)) {
    if (m[1] !== undefined) {
      subtitulo = textoDe(m[1]);
      continue;
    }
    // A citação (<em>) vem logo depois do link, antes do próximo link (senão seria a do artigo seguinte).
    let depois = html.slice(m.index + m[0].length, m.index + m[0].length + 700);
    const proximoLink = depois.search(/<a\b/);
    if (proximoLink >= 0) depois = depois.slice(0, proximoLink);
    const codigo = textoDe((depois.match(/<em>([\s\S]*?)<\/em>/) || [])[1] || "");
    const faixa = m[2].match(/data-highlightrange=['"]p(\d+)-p(\d+)['"]/);
    // Os parágrafos pelo número, quando a citação os traz ("w19.11 pág. 15 par. 7", "cl cap. 21 pars. 6-8").
    const pars = codigo.match(/\bpars?\.\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
    const aa = (codigo.match(/^[a-z-]+?(\d{2})\b/i) || codigo.match(/^g\s+\d{1,2}\/(\d{2})\b/i) || [])[1];
    const ano = aa ? (Number(aa) > 50 ? 1900 : 2000) + Number(aa) : null;
    // Sem citação = "Veja: …" (ligação para outro tópico do Guia), não é artigo.
    if (!codigo || /^mwb/i.test(codigo) || (ano && ano < 1990)) continue;
    entradas.push({
      subtitulo,
      titulo: textoDe(m[4]),
      docId: m[3],
      de: faixa ? Number(faixa[1]) : null,
      ate: faixa ? Number(faixa[2]) : null,
      parDe: pars ? Number(pars[1]) : null,
      parAte: pars ? Number(pars[2] || pars[1]) : null,
      codigo,
      ano,
    });
  }
  paginasGuia.set(topico.url, { quando: Date.now(), entradas });
  if (paginasGuia.size > 80) paginasGuia.delete(paginasGuia.keys().next().value);
  return entradas;
}

// ---------- Guia de Pesquisa lido do arquivo do servidor (o jw.org barra o servidor) ----------
// Os tópicos e os artigos vêm do arquivo (fontes/guia_de_pesquisa.txt, veja _fontes.mjs); aqui se escolhe o tópico e se acha o artigo no wol
// pelo título (busca da frase exata). Daí em diante é igual ao Guia online: faixa de parágrafos, parágrafos pelo número ou o melhor parágrafo.
export async function topicosDoGuiaDoArquivoPara(textos, maximo = 2) {
  const consulta = new Set(textos.flatMap(raizes));
  if (!consulta.size) return [];
  const lista = await guiaLocalTopicos();
  return lista
    .map((t) => {
      t.palavras = t.palavras || [...new Set(raizes(t.nome))];
      const achadas = t.palavras.filter((w) => consulta.has(w)).length;
      const fortes = t.palavras.filter((w) => consulta.has(w) && !GENERICAS.has(w)).length;
      return { t, achadas, fortes, parte: t.palavras.length ? achadas / t.palavras.length : 0 };
    })
    .filter((x) => x.fortes && x.parte >= 0.5 && artigosDoTopicoDoGuia(x.t).length) // tópico só de "Veja: …" não tem artigos
    .sort((a, b) => b.parte - a.parte || b.achadas - a.achadas || a.t.nome.length - b.t.nome.length)
    .slice(0, maximo)
    .map((x) => x.t);
}

const docsDoGuia = new Map(); // "título|ano" -> { quando, docId }
const igualTitulo = (a, b) => semAcento(a).replace(/[^a-z0-9]+/g, " ").trim() === semAcento(b).replace(/[^a-z0-9]+/g, " ").trim();

// O documento do wol de um artigo do Guia (pelo título e, se o código trouxer, o ano): docId ou null.
export async function docDoArtigoDoGuia(artigo, timeoutMs) {
  const chave = `${artigo.titulo}|${artigo.ano || ""}|${artigo.edicao || ""}`;
  const guardado = docsDoGuia.get(chave);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.docId;
  let docId = null;
  // O título que o Guia traz às vezes vem com palavras do subtítulo na frente ("Irmãos na fé “Chame os anciãos”"): se a frase inteira não
  // acha, tenta de novo sem as 1 a 4 primeiras palavras (no máximo 5 buscas por artigo).
  const palavras = artigo.titulo.replace(/[“”"‘’:;|—–]/g, " ").replace(/[?!.…]+$/, "").trim().split(/\s+/);
  const tentativas = [0, 1, 2, 3, 4].filter((n) => palavras.length - n >= (n ? 3 : 1)).map((n) => palavras.slice(n).join(" ").slice(0, 150));
  for (const frase of tentativas) {
    try {
      const url = `${BASE}/pt/wol/s/r5/lp-t?q=${encodeURIComponent('"' + frase + '"')}&p=par&r=occ&st=a`;
      const html = (await baixar(url, timeoutMs)).replace(/&lrm;/g, "");
      const achados = html
        .split('<ul class="results resultContentDocument">')
        .slice(1)
        .map((bloco) => {
          const cabeca = bloco.match(/<a class="lnk" href="\/pt\/wol\/d\/r5\/lp-t\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
          if (!cabeca) return null;
          const ref = textoDe((bloco.match(/<li class="ref">([\s\S]*?)<\/li>/) || [])[1] || "");
          return { docId: cabeca[1], titulo: textoDe(cabeca[2]).replace(/­/g, ""), ...referenciaDaBusca(ref) };
        })
        .filter(Boolean)
        .slice(0, artigo.edicao ? 40 : 10);
      // Com a edição ("w18 outubro", campo edicao), um título curto e comum ("Ensine a verdade") é achado entre os 40 resultados (6.11.53).
      const daEdicao = (r) => !artigo.edicao || semAcento(r.codigo || "").startsWith(semAcento(artigo.edicao));
      const certo = achados.find((r) => igualTitulo(r.titulo, frase) && daEdicao(r) && (!artigo.ano || !r.ano || r.ano === artigo.ano)) || (!artigo.edicao && achados.find((r) => igualTitulo(r.titulo, frase)));
      if (certo) { docId = certo.docId; break; }
    } catch {
      break; // o wol não respondeu: não adianta insistir
    }
  }
  docsDoGuia.set(chave, { quando: Date.now(), docId });
  if (docsDoGuia.size > 400) docsDoGuia.delete(docsDoGuia.keys().next().value);
  return docId;
}

// Os parágrafos de número parDe..parAte (data-pnum) de um documento do wol, como faixaDoDocumento. null = não achou esses números.
export async function paragrafosPorNumero(docId, parDe, parAte, timeoutMs) {
  const html = await documentoDaPesquisa(`${BASE}/pt/wol/d/r5/lp-t/${docId}`, timeoutMs);
  const pids = [...html.matchAll(/<p\b[^>]*\bdata-pid="(\d+)"[^>]*>(?:(?!<\/p>)[\s\S])*?data-pnum="(\d+)"/g)]
    .filter((m) => Number(m[2]) >= parDe && Number(m[2]) <= parAte)
    .map((m) => Number(m[1]));
  if (!pids.length) return null;
  return faixaDoDocumento(docId, Math.min(...pids), Math.max(...pids), timeoutMs, 2200);
}

// Os parágrafos de uma faixa (de..ate) de um documento do wol: { titulo, pagina, paragrafos, pid, texto, url }, como paragrafoDaPesquisa.
export async function faixaDoDocumento(docId, de, ate, timeoutMs, maxCaracteres = 1600) {
  const url = `${BASE}/pt/wol/d/r5/lp-t/${docId}`;
  const html = await documentoDaPesquisa(url, timeoutMs);
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/­/g, "");
  const escolhidos = [...html.matchAll(/<(p|h2|h3|h4)\b([^>]*\bdata-pid="(\d+)"[^>]*)>([\s\S]*?)<\/\1>/g)]
    .map((m) => ({ pid: Number(m[3]), atributos: m[2], conteudo: m[4], posicao: m.index }))
    .filter((e) => e.pid >= de && e.pid <= ate && !/\bclass="qu\b/.test(e.atributos));
  if (!escolhidos.length) return null;
  const marcasPagina = [...html.slice(0, escolhidos[0].posicao + 300).matchAll(/class="pageNum"[^>]*data-no="(\d+)"/g)];
  const numeros = escolhidos.map((e) => (e.conteudo.match(/data-pnum="(\d+)"/) || [])[1]).filter(Boolean);
  const texto = escolhidos.map((e) => textoDe(e.conteudo).replace(/­/g, "")).filter(Boolean).join("\n").slice(0, maxCaracteres);
  if (!texto) return null;
  return {
    titulo,
    pagina: marcasPagina.length ? Number(marcasPagina[marcasPagina.length - 1][1]) : null,
    paragrafos: numeros.length ? (numeros.length > 1 ? `${numeros[0]}-${numeros[numeros.length - 1]}` : numeros[0]) : "",
    pid: escolhidos[0].pid,
    texto,
    url: `${url}#h=${de}:0-${ate + 1}:0`,
  };
}

// Todos os parágrafos numerados (data-pnum) de um documento do wol, sem as perguntas (class="qu"): { titulo, url, paragrafos: [{ numero, pid,
// subtitulo, texto }] }. O subtítulo é o último <h2>/<h3> antes do parágrafo. Usado pelas considerações para o serviço de campo (6.11.53),
// que citam um artigo pelo número do parágrafo. null = o documento não tem parágrafos numerados.
export async function paragrafosDoDocumento(docId, timeoutMs) {
  const url = `${BASE}/pt/wol/d/r5/lp-t/${docId}`;
  const html = await documentoDaPesquisa(url, timeoutMs);
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/­/g, "");
  const paragrafos = [];
  let subtitulo = "";
  for (const m of html.matchAll(/<(p|h2|h3)\b([^>]*\bdata-pid="(\d+)"[^>]*)>([\s\S]*?)<\/\1>/g)) {
    const [, marca, atributos, pid, conteudo] = m;
    if (marca !== "p") { subtitulo = textoDe(conteudo).replace(/­/g, ""); continue; }
    if (/\bclass="qu\b/.test(atributos)) continue;
    const numero = Number((conteudo.match(/data-pnum="(\d+)"/) || [])[1]);
    if (!numero) continue;
    const texto = textoDe(conteudo.replace(/<a\b[^>]*\bclass="fn"[^>]*>[\s\S]*?<\/a>/g, "")).replace(/­/g, "").replace(new RegExp(`^${numero}\\s+`), "");
    if (texto) paragrafos.push({ numero, pid: Number(pid), subtitulo, texto });
  }
  return paragrafos.length ? { titulo, url, paragrafos } : null;
}

// "it-2 79, 425, 428" vem em três links ("it-2 79", "425", "428"): cada número solto continua a citação anterior e herda a sigla e o ano.
// Uso: lista.map(continuarCitacao()) (guarda a última citação completa entre as chamadas).
function continuarCitacao() {
  let anterior = null;
  return (c) => {
    if (/^[\d\s,–-]+$/.test(c.citacao) && anterior) {
      const completa = { ...c, citacao: anterior.citacao.replace(/\s[\d\s,–-]+$/, "") + " " + c.citacao, ano: anterior.ano };
      anterior = completa;
      return completa;
    }
    anterior = c;
    return c;
  };
}

// ---------- Siglas das publicações (lista oficial do wol) ----------
// A tabela "Abreviações das publicações" do Índice das Publicações: sigla -> nome. Lida no wol e guardada por 24 h na instância.
const URL_SIGLAS = `${BASE}/pt/wol/d/r5/lp-t/1200270068`;
let siglasLidas = null; // { quando, mapa: Map(sigla -> nome) }

export async function siglasDasPublicacoes(timeoutMs) {
  if (siglasLidas && Date.now() - siglasLidas.quando < VALIDADE_GUIA_MS) return siglasLidas.mapa;
  const html = await baixar(URL_SIGLAS, timeoutMs);
  const mapa = new Map();
  for (const [, linha] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const celulas = [...linha.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => textoDe(m[1]).replace(/ /g, " "));
    if (celulas.length < 3 || !/^[a-z][a-z0-9-]*$/i.test(celulas[0])) continue;
    const [sigla, curto, completo, tipo = ""] = celulas;
    // Periódicos: o nome curto ("A Sentinela (edição de estudo)"); os outros: o nome completo, sem os anos das edições.
    const semAnos = completo.replace(/\s*\([^)]*\d{4}[^)]*\)\s*$/, "").trim();
    const nome = /peri[óo]dico/i.test(tipo) && curto && curto !== "—" ? curto : semAnos || curto;
    if (nome && nome !== "—") mapa.set(sigla.toLowerCase(), nome);
  }
  if (mapa.size) siglasLidas = { quando: Date.now(), mapa };
  return mapa;
}

// As siglas possíveis de uma citação: "w22.04" -> "w", "wp23.1" -> "wp", "it-1 145" -> "it-1", "yp1" -> "yp1", "g 3/12" -> "g".
export function siglasPossiveis(codigo) {
  const primeira = String(codigo || "").trim().split(/\s+/)[0].toLowerCase();
  const opcoes = [primeira, primeira.replace(/[.\d]+$/, ""), primeira.replace(/\d.*$/, "")];
  return [...new Set(opcoes.filter(Boolean))];
}

// ---------- Índice das Publicações da Torre de Vigia 1991-2026: índice de assuntos ----------
// Uma página por letra (lista dos assuntos, cada um com o seu documento) e um documento por assunto, com subtópicos (parágrafos "su" e,
// dentro deles, "sv") e as citações (links /wol/pc/ que levam ao trecho exato). O servidor acha o assunto, escolhe as citações dos
// subtópicos que mais combinam com a pesquisa (as mais recentes primeiro) e lê os parágrafos de cada uma.
const URL_INDICE = `${BASE}/pt/wol/library/r5/lp-t/todas-as-publica%C3%A7%C3%B5es/%C3%ADndice/%C3%ADndice-de-publica%C3%A7%C3%B5es/%C3%ADndice-1991-2026/%C3%ADndice-de-assuntos`;
const letrasIndice = new Map(); // letra -> { quando, lista: [{ nome, docId, palavras }] }
const assuntosIndice = new Map(); // docId -> { quando, entradas }

async function assuntosDaLetra(letra, timeoutMs) {
  const guardado = letrasIndice.get(letra);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.lista;
  const html = await baixar(`${URL_INDICE}/${letra}`, timeoutMs);
  const lista = [];
  const vistos = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href="\/pt\/wol\/d\/r5\/lp-t\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const nome = textoDe(m[2]);
    if (!nome || vistos.has(m[1])) continue;
    vistos.add(m[1]);
    lista.push({ nome, docId: m[1], palavras: [...new Set(raizes(nome))] });
  }
  if (lista.length) {
    letrasIndice.set(letra, { quando: Date.now(), lista });
    if (letrasIndice.size > 26) letrasIndice.delete(letrasIndice.keys().next().value);
  }
  return lista;
}

// Os assuntos do índice que combinam com os textos (até "maximo"), como topicosDoGuiaPara. Só lê as letras iniciais das palavras da consulta.
export async function assuntosDoIndicePara(textos, timeoutMs, maximo = 2) {
  const palavras = textos.flatMap((t) => semAcento(String(t || "")).replace(/[^a-z0-9]+/g, " ").split(" ")).filter((w) => w.length >= 4 && !PALAVRAS_FRACAS.has(w));
  const consulta = new Set(palavras.map((w) => w.slice(0, 6)));
  const letras = [...new Set(palavras.map((w) => w[0]).filter((l) => /[a-z]/.test(l)))].slice(0, 4);
  if (!consulta.size || !letras.length) return [];
  const listas = await Promise.all(letras.map((l) => assuntosDaLetra(l, timeoutMs).catch(() => [])));
  return listas
    .flat()
    .map((t) => {
      const achadas = t.palavras.filter((w) => consulta.has(w)).length;
      const fortes = t.palavras.filter((w) => consulta.has(w) && !GENERICAS.has(w)).length;
      return { t, achadas, fortes, parte: t.palavras.length ? achadas / t.palavras.length : 0 };
    })
    .filter((x) => x.fortes && x.parte >= 0.5)
    .sort((a, b) => b.parte - a.parte || b.achadas - a.achadas || a.t.nome.length - b.t.nome.length)
    .slice(0, maximo)
    .map((x) => ({ nome: x.t.nome, docId: x.t.docId }));
}

// Os subtópicos de um assunto: [{ rotulo, citacoes: [{ caminho, citacao, ano }] }]. Um "sv" fica com o rótulo do "su" acima ("casos reais ›
// crise econômica"). Fora a apostila Vida e Ministério e as publicações de antes de 1990.
export async function entradasDoIndice(assunto, timeoutMs) {
  const guardado = assuntosIndice.get(assunto.docId);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.entradas;
  const html = await baixar(`${BASE}/pt/wol/d/r5/lp-t/${assunto.docId}`, timeoutMs);
  const entradas = [];
  let pai = "";
  for (const [, classe, conteudo] of html.matchAll(/<p\b[^>]*class="(su|sv|sw)"[^>]*>([\s\S]*?)<\/p>/g)) {
    const rotuloProprio = textoDe(conteudo.replace(/<a\b[\s\S]*$/, "")).replace(/:\s*$/, "").trim();
    if (classe === "su") pai = rotuloProprio;
    const rotulo = classe === "su" ? rotuloProprio : [pai, rotuloProprio].filter(Boolean).join(" › ");
    const citacoes = [...conteudo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(([, caminho, rot]) => {
        const citacao = textoDe(rot).replace(/[;,]\s*$/, "").trim();
        const aa = (citacao.match(/^[a-z-]+?(\d{2})\b/i) || citacao.match(/^g\s+\d{1,2}\/(\d{2})\b/i) || [])[1];
        return { caminho, citacao, ano: aa ? (Number(aa) > 50 ? 1900 : 2000) + Number(aa) : null };
      })
      // "w15 1/7 3, 6-7" vem em dois links: o segundo ("6-7") continua o primeiro e herda a publicação e o ano.
      .map(continuarCitacao())
      .filter((c) => !/^mwb/i.test(c.citacao) && !(c.ano && c.ano < 1990));
    if (citacoes.length) entradas.push({ rotulo, citacoes });
  }
  assuntosIndice.set(assunto.docId, { quando: Date.now(), entradas });
  if (assuntosIndice.size > 80) assuntosIndice.delete(assuntosIndice.keys().next().value);
  return entradas;
}

// O trecho de uma citação do índice (/wol/pc/…): o artigo e a faixa de parágrafos do redirecionamento (no máximo 7). null = não deu para ler.
export async function trechoDaCitacaoDoIndice(caminho, timeoutMs) {
  const destino = await resolverCitacao(caminho, timeoutMs);
  if (!destino || destino.de === null) return null;
  const docId = (destino.url.match(/\/lp-t\/(\d+)/) || [])[1];
  if (!docId) return null;
  const lido = await faixaDoDocumento(docId, destino.de, Math.min(destino.ate, destino.de + 6), timeoutMs, 1800);
  return lido ? { ...lido, docId } : null;
}

// ---------- Pesquisa de um texto bíblico (página de pesquisa de cada versículo no wol) ----------
// Na Bíblia de estudo do wol (/pt/wol/b/r5/lp-t/nwtsty/<livro>/<capítulo>), cada versículo (<span id="v43-3-16-1">) começa com o link da
// página de pesquisa dele (/pt/wol/dx/…). Essa página tem cartões: o do Índice das Publicações 1991-2026 (pub-dx86-26), com as citações
// (links /wol/pc/) que comentam o versículo, e o das notas de estudo da Tradução do Novo Mundo (pub-nwtsty), cujo link já traz a faixa de
// parágrafos das notas daquele versículo. Juntos dão o entendimento atual e as aplicações já publicadas.
const capitulosLidos = new Map(); // "livro/cap" -> { quando, html }
const paginasDoVersiculo = new Map(); // "livro/cap/verso" -> { quando, pagina }

async function capituloDeEstudo(livro, capitulo, timeoutMs) {
  const chave = livro + "/" + capitulo;
  const guardado = capitulosLidos.get(chave);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.html;
  const html = await baixar(`${BASE}/pt/wol/b/r5/lp-t/nwtsty/${livro}/${capitulo}`, timeoutMs);
  capitulosLidos.set(chave, { quando: Date.now(), html });
  if (capitulosLidos.size > 30) capitulosLidos.delete(capitulosLidos.keys().next().value);
  return html;
}

// { notas: { caminho } | null, citacoes: [{ caminho, citacao, ano }] } de um versículo. null = não achou a página de pesquisa.
export async function pesquisaDoVersiculo(livro, capitulo, verso, timeoutMs) {
  const chave = `${livro}/${capitulo}/${verso}`;
  const guardado = paginasDoVersiculo.get(chave);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.pagina;
  const cap = await capituloDeEstudo(livro, capitulo, timeoutMs);
  const inicio = cap.indexOf(`id="v${livro}-${capitulo}-${verso}-1"`);
  if (inicio < 0) return null;
  const dx = (cap.slice(inicio, inicio + 600).match(/href="(\/pt\/wol\/dx\/r5\/lp-t\/[\d/]+)"/) || [])[1];
  if (!dx) return null;
  const html = (await baixar(BASE + dx, timeoutMs)).replace(/&#x3D;/g, "=");
  let notas = null;
  const citacoes = [];
  for (const bloco of html.split('class="linkCard"').slice(1)) {
    const simbolo = (bloco.match(/data-pub-symbol="([^"]+)"/) || [])[1] || "";
    if (/^nwtsty$/i.test(simbolo) && !notas) {
      const link = (bloco.match(/href="(\/pt\/wol\/d\/r5\/lp-t\/\d+#h=[^"]+)"/) || [])[1];
      if (link) notas = { caminho: link };
    }
    // O Índice das Publicações mais recente (dx86-26; o número final muda a cada ano): as citações vêm no resultado logo depois do cartão.
    if (/^dx\d+-\d+$/i.test(simbolo) && !citacoes.length) {
      const resultado = bloco.slice(bloco.indexOf('class="result"'));
      for (const [, caminho, rot] of resultado.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const citacao = textoDe(rot).replace(/[;,]\s*$/, "").trim();
        const aa = (citacao.match(/^[a-z-]+?(\d{2})\b/i) || citacao.match(/^g\s+\d{1,2}\/(\d{2})\b/i) || [])[1];
        citacoes.push({ caminho, citacao, ano: aa ? (Number(aa) > 50 ? 1900 : 2000) + Number(aa) : null });
      }
    }
  }
  // "w15 1/7 3, 6-7" vem em dois links: o segundo continua o primeiro e herda a publicação e o ano.
  const completas = citacoes
    .map(continuarCitacao())
    .filter((c) => !/^mwb/i.test(c.citacao) && !(c.ano && c.ano < 1990));
  const pagina = { notas, citacoes: completas };
  paginasDoVersiculo.set(chave, { quando: Date.now(), pagina });
  if (paginasDoVersiculo.size > 200) paginasDoVersiculo.delete(paginasDoVersiculo.keys().next().value);
  return pagina;
}

// ---------- Texto bíblico: as edições novas de A Sentinela (estudo) que ainda não estão no wol nem no Índice ----------
// O Índice das Publicações (dx91-26) e a pesquisa do wol chegam alguns meses depois da publicação: a edição de estudo de fevereiro já está no
// jw.org em novembro, mas não no wol. Aqui o servidor lê no jw.org as edições de estudo de 2 meses atrás até 6 meses à frente e traz os
// parágrafos que citam o versículo (o link do versículo no jw.org traz data-targetverses="LLCCCVVV": livro, capítulo e versículo).
const MESES_SENTINELA = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const NOMES_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const edicoesSentinela = new Map(); // "mes-ano" -> { quando, artigos: [url] | null }
const artigosSentinela = new Map(); // url -> { quando, artigo: { titulo, paragrafos: [{ n, texto, versos: [início, fim][] }] } | null }
const VALIDADE_SENTINELA_MS = 6 * 3600 * 1000;

async function edicaoDeEstudo(mes, ano, timeoutMs) {
  const chave = `${mes}-${ano}`;
  const guardado = edicoesSentinela.get(chave);
  if (guardado && Date.now() - guardado.quando < VALIDADE_SENTINELA_MS) return guardado.artigos;
  let artigos = null;
  for (const slug of [MESES_SENTINELA[mes], mes === 2 ? "mar%C3%A7o" : null]) { // março: o jw.org usa um dos dois nomes
    if (!slug) continue;
    const base = `/pt/biblioteca/revistas/sentinela-estudo-${slug}-${ano}/`;
    try {
      const html = await baixar(BASE_JW + base, timeoutMs);
      const links = [...new Set([...html.matchAll(new RegExp(`href="(${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"/#?]+/)"`, "g"))].map((m) => m[1]))];
      artigos = links.map((l) => BASE_JW + l); // inclui as Perguntas dos Leitores (trazem entendimentos novos de textos)
      if (artigos.length) break;
    } catch {
      // edição ainda não publicada (404) ou site fora do ar
    }
  }
  edicoesSentinela.set(chave, { quando: Date.now(), artigos });
  if (edicoesSentinela.size > 40) edicoesSentinela.delete(edicoesSentinela.keys().next().value);
  return artigos;
}

async function artigoDeEstudo(url, timeoutMs) {
  const guardado = artigosSentinela.get(url);
  if (guardado && Date.now() - guardado.quando < VALIDADE_SENTINELA_MS) return guardado.artigo;
  let artigo = null;
  try {
    const html = await baixar(url, timeoutMs);
    const titulo = textoDe((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s*\|.*$/, "");
    const paragrafos = [];
    for (const [, atributos, conteudo] of html.matchAll(/<p\b([^>]*\bdata-pid="\d+"[^>]*)>([\s\S]*?)<\/p>/g)) {
      if (/class="[^"]*\b(qu|pubRefs|themeScrp|contextTtl)\b/.test(atributos)) continue; // perguntas do estudo, referências e texto-tema
      const n = Number((conteudo.match(/data-pnum="(\d+)"/) || [])[1]) || null;
      const versos = [...conteudo.matchAll(/data-targetverses="([\d,\-–]+)"/g)].flatMap((m) =>
        m[1].split(",").map((faixa) => {
          const [a, b] = faixa.split(/[-–]/);
          return [Number(a), Number(b || a)];
        })
      );
      const texto = textoDe(conteudo.replace(/<span class="parNum[^>]*>[\s\S]*?<\/span>/g, " "));
      if (texto.length > 40) paragrafos.push({ n, texto, versos });
    }
    if (titulo && paragrafos.length) artigo = { titulo, paragrafos };
  } catch {
    // artigo indisponível agora
  }
  artigosSentinela.set(url, { quando: Date.now(), artigo });
  if (artigosSentinela.size > 120) artigosSentinela.delete(artigosSentinela.keys().next().value);
  return artigo;
}

// Os parágrafos que citam o versículo nas edições de estudo novas, da edição mais nova para a mais antiga:
// [{ titulo, publicacao, codigo, ano, paragrafos: "1, 2", texto, url }]. Vazio se nada novo cita o versículo (ou o jw.org não respondeu).
// Os artigos das edições de estudo novas (de 2 meses atrás a 6 meses à frente) já lidos: [{ mes, ano, url, artigo }].
async function artigosNovosDaSentinela(timeoutMs, hoje) {
  const meses = [];
  for (let d = -2; d <= 6; d++) {
    const data = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + d, 1));
    meses.push({ mes: data.getUTCMonth(), ano: data.getUTCFullYear() });
  }
  const edicoes = await Promise.all(meses.map(({ mes, ano }) => edicaoDeEstudo(mes, ano, timeoutMs).then((artigos) => ({ mes, ano, artigos }))));
  const lidos = await Promise.all(
    edicoes
      .filter((e) => e.artigos && e.artigos.length)
      .flatMap((e) => e.artigos.map((url) => ({ e, url })))
      .map(async ({ e, url }) => ({ mes: e.mes, ano: e.ano, url, artigo: await artigoDeEstudo(url, timeoutMs) }))
  );
  return lidos.filter((x) => x.artigo);
}

const dadosDaEdicao = (e) => ({
  ordem: e.ano * 12 + e.mes,
  publicacao: `A Sentinela (Estudo), ${NOMES_MESES[e.mes]} de ${e.ano}`,
  codigo: `w${String(e.ano).slice(2)}.${String(e.mes + 1).padStart(2, "0")}`,
  ano: e.ano,
});

// Assunto (palavras): nos mesmos artigos novos, o parágrafo que mais combina com as palavras da pesquisa (e o seguinte), como a busca
// do wol faria. Só vale um parágrafo que traga pelo menos 2 palavras diferentes da pesquisa (ou 1, se a pesquisa só tiver 1 palavra útil).
// [{ titulo, publicacao, codigo, ano, paragrafos, texto, url, pontos }], os mais certeiros primeiro (no empate, o mais novo).
export async function buscaNovaNaSentinela(textos, { timeoutMs = 9000, hoje = new Date(), max = 3 } = {}) {
  const termos = [...new Set((Array.isArray(textos) ? textos : [textos]).flatMap((t) => raizes(t)).filter((r) => !GENERICAS.has(r)))];
  if (!termos.length) return [];
  const exigidos = Math.min(2, termos.length);
  const lidos = await artigosNovosDaSentinela(timeoutMs, hoje);
  const achados = [];
  for (const { mes, ano, url, artigo } of lidos) {
    let melhor = null;
    artigo.paragrafos.forEach((p, i) => {
      const nos = new Set(raizes(p.texto));
      const casam = termos.filter((t) => nos.has(t)).length;
      if (casam >= exigidos && (!melhor || casam > melhor.casam)) melhor = { casam, i };
    });
    if (!melhor) continue;
    const titulo = new Set(raizes(artigo.titulo));
    const casaTitulo = termos.filter((t) => titulo.has(t)).length;
    const escolhidos = [artigo.paragrafos[melhor.i], artigo.paragrafos[melhor.i + 1]].filter(Boolean);
    achados.push({
      ...dadosDaEdicao({ mes, ano }),
      titulo: artigo.titulo,
      paragrafos: escolhidos.map((p) => p.n).filter(Boolean).join(", "),
      texto: escolhidos.map((p) => p.texto).join("\n").slice(0, 1800),
      url,
      pontos: melhor.casam + casaTitulo * 2,
    });
  }
  return achados
    .filter((a) => a.pontos >= 2) // com uma palavra só, só vale se ela estiver também no título do artigo
    .sort((a, b) => b.pontos - a.pontos || b.ordem - a.ordem)
    .slice(0, max)
    .map(({ ordem, ...resto }) => resto);
}

export async function citacoesNovasDaSentinela(livro, capitulo, verso, { timeoutMs = 9000, hoje = new Date(), max = 3 } = {}) {
  const alvo = livro * 1_000_000 + capitulo * 1000 + verso;
  const achados = [];
  for (const { mes, ano, url, artigo } of await artigosNovosDaSentinela(timeoutMs, hoje)) {
    // Os parágrafos que citam o versículo (até 2) e, de cada um, os 2 seguintes, que costumam explicar o texto citado.
    const indices = [];
    let achou = 0;
    artigo.paragrafos.forEach((p, i) => {
      if (achou < 2 && p.versos.some(([a, b]) => alvo >= a && alvo <= b)) {
        achou++;
        for (const j of [i, i + 1, i + 2]) if (j < artigo.paragrafos.length && !indices.includes(j)) indices.push(j);
      }
    });
    const citam = indices.sort((x, y) => x - y).map((i) => artigo.paragrafos[i]);
    if (!citam.length) continue;
    achados.push({
      ...dadosDaEdicao({ mes, ano }),
      titulo: artigo.titulo,
      paragrafos: citam.map((p) => p.n).filter(Boolean).join(", "),
      texto: citam.map((p) => p.texto).join("\n").slice(0, 2200),
      url,
    });
  }
  return achados.sort((a, b) => b.ordem - a.ordem).slice(0, max).map(({ ordem, ...resto }) => resto);
}

// As notas de estudo de um versículo (o link do cartão já traz a faixa de parágrafos): como faixaDoDocumento, com o docId.
export async function notasDeEstudo(caminho, timeoutMs) {
  const m = String(caminho || "").match(/\/lp-t\/(\d+)#h=(\d+):\d+-(\d+):(\d+)/);
  if (!m) return null;
  const de = Number(m[2]);
  let ate = Number(m[3]);
  if (Number(m[4]) === 0 && ate > de) ate -= 1;
  const lido = await faixaDoDocumento(m[1], de, Math.min(ate, de + 8), timeoutMs, 3000);
  return lido ? { ...lido, docId: m[1] } : null;
}

// ---------- Assistente de pesquisas: vídeo do jw.org pelo link ----------
// O link de compartilhar do jw.org traz o código do vídeo ("lank"): pub-jwbai_201511_1_VIDEO (publicação, edição e faixa) ou
// docid-702017124_1_VIDEO. Ele aparece no ?lank=, no ?item= ou no fim do endereço da página de vídeos (#pt/mediaitems/…/pub-…_VIDEO).
// null = o endereço não é de um vídeo do jw.org.
export function videoDoEndereco(endereco) {
  let texto = String(endereco || "").trim();
  try {
    texto = decodeURIComponent(texto);
  } catch {
    // endereço com % solto: fica como veio
  }
  if (!/(^|\/\/|\.)jw\.org\b|jw-cdn\.org/i.test(texto) && !/^(pub|docid)-/i.test(texto)) return null;
  // O código da publicação pode ter hífen (pub-jwb-128_7_VIDEO, pub-jwbvod25-12_3_VIDEO).
  // Alguns vídeos não têm número de faixa (pub-wys_x_VIDEO): vão só pelo código, lidos no mediator.
  const lank = (texto.match(/\b(pub-[a-z0-9][a-z0-9-]*?(?:_\d+)?_(?:\d+|x)_VIDEO|docid-\d+_\d+_VIDEO)\b/i) || [])[1];
  if (!lank) return null;
  if (/_x_VIDEO$/i.test(lank)) return { lank };
  const p = lank.match(/^pub-([a-z0-9][a-z0-9-]*?)_(?:(\d+)_)?(\d+)_VIDEO$/i);
  if (p) return { pub: p[1], issue: p[2] || "", track: p[3], lank };
  const d = lank.match(/^docid-(\d+)_(\d+)_VIDEO$/i);
  return d ? { docid: d[1], track: d[2], lank } : null;
}

// O menor arquivo MP4 do vídeo (para a IA ouvir quando não há legenda): { url, tamanho, titulo, duracaoS } ou null. Só até maxBytes.
export async function menorMp4DoVideo(video, { timeoutMs = 8000, maxBytes = 18_000_000 } = {}) {
  try {
    let arquivos = [];
    let titulo = "";
    if (video.pub || video.docid) {
      const q = video.pub ? `pub=${encodeURIComponent(video.pub)}${video.issue ? `&issue=${encodeURIComponent(video.issue)}` : ""}` : `docid=${encodeURIComponent(video.docid)}`;
      const dados = await baixarJson(`https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&${q}${video.track ? `&track=${encodeURIComponent(video.track)}` : ""}&langwritten=T&alllangs=0&txtCMSLang=T`, timeoutMs);
      arquivos = ((dados && dados.files && dados.files.T && dados.files.T.MP4) || []).map((f) => ({ url: f.file && f.file.url, tamanho: f.filesize || 0, titulo: f.title || "", duracaoS: Math.round(f.duration || 0) }));
    }
    if (!arquivos.length && video.lank) {
      const m = await baixarJson(`https://b.jw-cdn.org/apis/mediator/v1/media-items/T/${encodeURIComponent(video.lank)}?clientType=www`, timeoutMs);
      const item = m && m.media && m.media[0];
      if (item) {
        titulo = item.title || "";
        arquivos = (item.files || []).map((f) => ({ url: f.progressiveDownloadURL, tamanho: f.filesize || 0, titulo, duracaoS: Math.round(item.duration || 0) }));
      }
    }
    const validos = arquivos.filter((f) => f.url && f.tamanho > 0 && f.tamanho <= maxBytes).sort((a, b) => a.tamanho - b.tamanho);
    return validos[0] || null;
  } catch {
    return null;
  }
}

// O vídeo para tocar no navegador (6.11.56): o MP4 de 360p (ou o que houver mais perto) e a imagem de capa, do mesmo serviço público do jw.org
// que dá os arquivos (o navegador toca direto do endereço do jw-cdn.org). null = não achou.
export async function playerDoVideo(video, { timeoutMs = 8000 } = {}) {
  const ordemDeQualidade = (rotulo) => { const n = parseInt(rotulo, 10); return Number.isFinite(n) ? Math.abs(n - 360) : 9999; };
  const melhor = (arquivos) => arquivos.filter((f) => f.url && /^https:\/\//.test(f.url)).sort((a, b) => ordemDeQualidade(a.rotulo) - ordemDeQualidade(b.rotulo) || (a.tamanho || 0) - (b.tamanho || 0))[0] || null;
  try {
    let arquivos = [];
    let poster = "";
    if (video.pub || video.docid) {
      const q = video.pub ? `pub=${encodeURIComponent(video.pub)}${video.issue ? `&issue=${encodeURIComponent(video.issue)}` : ""}` : `docid=${encodeURIComponent(video.docid)}`;
      const dados = await baixarJson(`https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&${q}${video.track ? `&track=${encodeURIComponent(video.track)}` : ""}&langwritten=T&alllangs=0&txtCMSLang=T`, timeoutMs);
      arquivos = ((dados && dados.files && dados.files.T && dados.files.T.MP4) || []).map((f) => ({ url: f.file && f.file.url, tamanho: f.filesize || 0, rotulo: f.label || "" }));
      const capa = dados && dados.files && dados.files.T && dados.files.T.MP4 && dados.files.T.MP4[0] && dados.files.T.MP4[0].trackImage;
      poster = (capa && capa.url) || "";
    }
    if (!arquivos.length && video.lank) {
      const m = await baixarJson(`https://b.jw-cdn.org/apis/mediator/v1/media-items/T/${encodeURIComponent(video.lank)}?clientType=www`, timeoutMs);
      const item = m && m.media && m.media[0];
      if (item) {
        arquivos = (item.files || []).map((f) => ({ url: f.progressiveDownloadURL, tamanho: f.filesize || 0, rotulo: f.label || "" }));
        const imgs = item.images || {};
        poster = (imgs.wss && (imgs.wss.md || imgs.wss.sm)) || (imgs.lss && (imgs.lss.md || imgs.lss.sm)) || "";
      }
    }
    const f = melhor(arquivos);
    return f ? { mp4: f.url, poster: /^https:\/\//.test(poster) ? poster : "", qualidade: f.rotulo } : null;
  } catch {
    return null;
  }
}

// ---------- Catálogo de vídeos do jw.org (para sugerir vídeos por assunto) ----------
// O mesmo serviço público que o app já usa para ler os vídeos (mediator): as categorias de "Vídeos" (VideoOnDemand) e, em cada uma, as
// subcategorias com os vídeos (título, código "lank", duração). Lido uma vez e guardado por 24 h na instância: [{ lank, titulo, duracao, categoria }].
const URL_MEDIATOR = "https://b.jw-cdn.org/apis/mediator/v1/categories/T";
let catalogoVideos = null; // { quando, lista }

// O catálogo vale 6 h (antes 24 h): vídeos novos, como o programa do mês, aparecem no mesmo dia.
const VALIDADE_CATALOGO_MS = 6 * 3600 * 1000;
export async function catalogoDeVideos(timeoutMs = 12000) {
  if (catalogoVideos && Date.now() - catalogoVideos.quando < VALIDADE_CATALOGO_MS) return catalogoVideos.lista;
  const raiz = await baixarJson(`${URL_MEDIATOR}/VideoOnDemand?detailed=0&clientType=www`, timeoutMs);
  const chaves = ((raiz && raiz.category && raiz.category.subcategories) || []).map((s) => s.key).filter((k) => k && !/AudioDescriptions/i.test(k));
  const porLank = new Map();
  const percorrer = (cat, caminho) => {
    const nome = [caminho, cat.name].filter(Boolean).join(" › ");
    for (const m of cat.media || []) {
      const lank = m.languageAgnosticNaturalKey || m.naturalKey;
      if (!lank || !/_VIDEO$/i.test(lank)) continue;
      // O mesmo vídeo pode estar em várias seções (o programa do mês fica em "Vídeos em Destaque" e em "Programas Mensais"): vale em todas.
      // A seção mostrada (categoria) é a primeira que não é de destaque, que muda todo mês.
      const ja = porLank.get(lank);
      if (ja) {
        if (!ja.categorias.includes(nome)) ja.categorias.push(nome);
        if (/Destaque/i.test(ja.categoria) && !/Destaque/i.test(nome)) ja.categoria = nome;
        continue;
      }
      const em = /^\d{4}-\d{2}/.test(m.firstPublished || "") ? String(m.firstPublished) : "";
      porLank.set(lank, { lank, titulo: String(m.title || "").trim(), duracao: m.durationFormattedHHMM || "", categoria: nome, categorias: [nome], publicado: em.slice(0, 7), publicadoEm: em });
    }
    for (const s of cat.subcategories || []) percorrer(s, nome);
  };
  const categorias = await Promise.all(chaves.map((k) => baixarJson(`${URL_MEDIATOR}/${encodeURIComponent(k)}?detailed=1&clientType=www`, timeoutMs).catch(() => null)));
  for (const c of categorias) if (c && c.category) percorrer(c.category, "");
  const lista = [...porLank.values()].filter((v) => v.titulo);
  if (lista.length) catalogoVideos = { quando: Date.now(), lista };
  return lista;
}

// Os vídeos do catálogo que mais combinam com as buscas: até "maximo", com os pontos de cada um ({ ...video, pontos }).
// Cada palavra vale pelo quanto é rara nos títulos do catálogo (em "grande tribulação", "grande" aparece em dezenas de títulos e quase não
// conta; "tribulação" decide). No título vale 3 vezes mais que na categoria, e um título com TODAS as palavras de uma busca vale o dobro.
const raridadeDosTitulos = new WeakMap(); // lista do catálogo -> { n, df: Map(raiz -> nº de títulos com ela) }
function raridade(lista) {
  let r = raridadeDosTitulos.get(lista);
  if (!r) {
    const df = new Map();
    for (const v of lista) for (const t of new Set(raizes(v.titulo))) df.set(t, (df.get(t) || 0) + 1);
    r = { n: lista.length, df };
    raridadeDosTitulos.set(lista, r);
  }
  return r;
}
export function videosPorPalavras(lista, palavras, maximo = 40) {
  const buscas = palavras.map((p) => [...new Set(raizes(p))]).filter((b) => b.length);
  if (!buscas.length) return [];
  const { n, df } = raridade(lista);
  // Palavras genéricas (GENERICAS) valem um quinto.
  const peso = (t) => Math.log(1 + n / (1 + (df.get(t) || 0))) * (GENERICAS.has(t) ? 0.2 : 1);
  return lista
    .map((v) => {
      const titulo = new Set(raizes(v.titulo));
      const categoria = new Set(raizes(v.categoria));
      let pontos = 0;
      let raras = 0; // palavras da busca no título que aparecem em poucos títulos do catálogo (até 1%): sinal de que o vídeo é mesmo do assunto
      for (const b of buscas) {
        const noTitulo = b.filter((t) => titulo.has(t));
        raras += noTitulo.filter((t) => !GENERICAS.has(t) && (df.get(t) || 0) <= Math.max(5, n * 0.01)).length;
        let p = noTitulo.reduce((s, t) => s + 3 * peso(t), 0) + b.filter((t) => categoria.has(t)).reduce((s, t) => s + peso(t), 0);
        if (b.length > 1 && noTitulo.length === b.length) p *= 2;
        pontos += p;
      }
      return { ...v, pontos, raras };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, maximo);
}

// ---------- Vídeos: seções do catálogo e busca no que é falado (legendas) ----------
// As seções vêm do caminho de categorias de cada vídeo ("Família › Namoro e Casamento"): a seção principal e cada subseção, com o número de
// vídeos. A busca nas falas lê as legendas dos vídeos de UMA seção (até MAX_VIDEOS_FALAS), guardadas por 24 h na instância, e devolve os
// trechos com o tempo em que as palavras aparecem.
// Medido em 2026-11-17: 110 vídeos em ~5 s e a maior seção (Programas e Eventos, 676 vídeos) em ~38 s. Assim qualquer seção pode ser lida.
export const MAX_VIDEOS_FALAS = 700;
const falasLidas = new Map(); // lank -> { quando, falas: [{ inicio, texto }] }

// "Novidades": uma seção a mais, a primeira da lista, com os lançamentos (os MAX_NOVIDADES vídeos de publicação mais recente no jw.org, do
// mais novo para o mais antigo). Os vídeos continuam também nas suas seções.
export const SECAO_NOVIDADES = "Novidades";
const MAX_NOVIDADES = 40;
// Fixos no topo, nesta ordem: o último Boletim do Corpo Governante, se publicado nos últimos 15 dias (depois disso entra na ordem de data), e
// o último programa mensal (JW Broadcasting, seção Programas Mensais), sempre. Os demais seguem do mais novo para o mais antigo.
const BOLETIM_FIXO_MS = 15 * 24 * 3600 * 1000;
function novidadesDe(lista) {
  const porData = lista.filter((v) => v.publicadoEm).sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
  const boletim = porData.find((v) => /^Boletim do Corpo Governante/i.test(v.titulo));
  const fixos = [];
  if (boletim && Date.now() - Date.parse(boletim.publicadoEm) <= BOLETIM_FIXO_MS) fixos.push(boletim);
  const programa = porData.find((v) => (v.categorias || [v.categoria]).some((c) => /Programas Mensais/i.test(c)));
  if (programa) fixos.push(programa);
  return [...fixos, ...porData.filter((v) => !fixos.includes(v))].slice(0, MAX_NOVIDADES);
}

export function secoesDosVideos(lista) {
  return [{ caminho: SECAO_NOVIDADES, total: novidadesDe(lista).length }, ...secoesDoCatalogo(lista)];
}
function secoesDoCatalogo(lista) {
  const contagem = new Map();
  for (const v of lista) {
    // Cada vídeo conta uma vez em cada seção (e seção principal) em que aparece.
    const caminhos = new Set();
    for (const cat of v.categorias || [v.categoria]) {
      const partes = String(cat || "").split(" › ").filter(Boolean);
      for (let i = 1; i <= partes.length; i++) caminhos.add(partes.slice(0, i).join(" › "));
    }
    for (const caminho of caminhos) contagem.set(caminho, (contagem.get(caminho) || 0) + 1);
  }
  return [...contagem.entries()].map(([caminho, total]) => ({ caminho, total })).sort((a, b) => a.caminho.localeCompare(b.caminho, "pt"));
}

export const videosDaSecao = (lista, secao) =>
  !secao ? lista
  : secao === SECAO_NOVIDADES ? novidadesDe(lista)
  : lista.filter((v) => (v.categorias || [v.categoria]).some((c) => c === secao || String(c).startsWith(secao + " › ")));

// As falas da legenda de um vídeo: [{ inicio (s), texto }], sem repetições seguidas. [] = sem legenda publicada.
export async function falasDoVideo(lank, timeoutMs = 9000) {
  const guardado = falasLidas.get(lank);
  if (guardado && Date.now() - guardado.quando < VALIDADE_GUIA_MS) return guardado.falas;
  const video = videoDoEndereco("https://www.jw.org/finder?lank=" + lank);
  if (!video) return [];
  const { vtt } = await legendaDoVideo(video, timeoutMs);
  const falas = [];
  let ultima = "";
  for (const bloco of String(vtt || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const linhas = bloco.split("\n");
    const iTempo = linhas.findIndex((l) => /-->/.test(l));
    if (iTempo < 0) continue;
    const t = linhas[iTempo].match(/((?:\d+:)?\d+:\d+(?:\.\d+)?)\s*-->/);
    const texto = linhas.slice(iTempo + 1).map((l) => decodificar(l.replace(/<[^>]+>/g, "")).trim()).filter(Boolean).join(" ");
    if (!texto || texto === ultima) continue;
    ultima = texto;
    falas.push({ inicio: t ? Math.round(segundosVtt(t[1])) : 0, texto });
  }
  falasLidas.set(lank, { quando: Date.now(), falas });
  if (falasLidas.size > 500) falasLidas.delete(falasLidas.keys().next().value);
  return falas;
}

// Procura as buscas nas falas de cada vídeo: [{ ...video, pontosFala, trechos: [{ tempo: "3:25", texto }] }] dos que têm alguma palavra rara
// da busca na fala, do que mais fala do assunto para o que menos fala. Lê as legendas de 10 em 10, para não sobrecarregar o jw.org.
export async function videosPorFalas(videos, palavras, timeoutMs = 9000) {
  const buscas = palavras.map((p) => [...new Set(raizes(p))].filter((t) => !GENERICAS.has(t))).filter((b) => b.length);
  if (!buscas.length) return [];
  const todas = [];
  for (let i = 0; i < videos.length; i += 10) {
    const lote = videos.slice(i, i + 10);
    todas.push(...(await Promise.all(lote.map((v) => falasDoVideo(v.lank, timeoutMs).then((falas) => ({ v, falas })).catch(() => ({ v, falas: [] }))))));
  }
  const mmss = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const achados = [];
  for (const { v, falas } of todas) {
    if (!falas.length) continue;
    const marcadas = [];
    falas.forEach((f, i) => {
      const r = new Set(raizes(f.texto));
      let pontos = 0;
      for (const b of buscas) {
        const tem = b.filter((t) => r.has(t)).length;
        if (tem) pontos += tem === b.length ? 2 * tem : tem;
      }
      if (pontos) marcadas.push({ i, pontos });
    });
    if (!marcadas.length) continue;
    const pontosFala = marcadas.reduce((s, m) => s + m.pontos, 0);
    // Os 2 trechos com mais palavras da busca (sem repetir trechos vizinhos), com a fala de antes e a de depois para dar contexto.
    const trechos = [];
    const usados = new Set();
    for (const m of [...marcadas].sort((a, b) => b.pontos - a.pontos)) {
      if (trechos.length >= 2 || [m.i - 1, m.i, m.i + 1].some((j) => usados.has(j))) continue;
      usados.add(m.i);
      const texto = [falas[m.i - 1], falas[m.i], falas[m.i + 1]].filter(Boolean).map((f) => f.texto).join(" ").slice(0, 320);
      trechos.push({ tempo: mmss(falas[m.i].inicio), texto });
    }
    trechos.sort((a, b) => falas.findIndex((f) => mmss(f.inicio) === a.tempo) - falas.findIndex((f) => mmss(f.inicio) === b.tempo));
    achados.push({ ...v, pontosFala, trechos });
  }
  return achados.sort((a, b) => b.pontosFala - a.pontosFala);
}
