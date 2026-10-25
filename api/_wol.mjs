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
  for (const m of semFiguras.matchAll(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>|<p class="x-figura" data-fig="(\d+)">/g)) {
    if (m[1]) {
      const titulo = textoDe(m[2]);
      if (m[1] === "h2") {
        secao = titulo;
        item = "";
      } else item = titulo;
      continue;
    }
    const figura = figuras[Number(m[3])];
    if (figura && (figura.descricao || figura.legenda)) lista.push({ secao, item, descricao: figura.descricao, legenda: figura.legenda });
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
      const figura = figuras[Number((atributos.match(/data-fig="(\d+)"/) || [])[1])];
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
      const paragrafo = { numero, texto };
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
    }
    else if (atual) atual.legendas.push(texto);
  }

  const validos = grupos.filter((g) => g.paragrafos.length && g.numeros.length);
  for (const g of validos) g.rotulo = [...g.numeros].sort((a, b) => a - b).join(", "); // "1, 2", como na lista do app
  return { titulo, grupos: validos, recapitulacao, referenciasRecapitulacao, secoes };
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
  return { titulo, tema, referencias: referenciasDe(temaHtml), comentario, fonte: citacoes.filter(Boolean).join(" ") };
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
    if (!texto) continue;
    if (secao === "relato") relato.push(texto);
    else if (secao === "leia") leia.push(...referenciasDe(conteudo));
    else {
      const quadro = QUADROS_EBC.find((q) => q.id === secao);
      const numero = perguntas.filter((p) => p.quadro === quadro.id).length + 1;
      const citacoes = [...conteudo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
      // Tira o número da lista ("1.") e a letra que liga a pergunta a uma imagem ("A").
      const pergunta = textoDe(
        conteudo.replace(/<span class="txtSrcBullet">[\s\S]*?<\/span>/, "").replace(/<span\b[^>]*>\s*<strong>[A-Z]<\/strong>\s*<\/span>/g, "")
      );
      perguntas.push({ id: `${quadro.curto} ${numero}`, quadro: quadro.id, nomeQuadro: quadro.nome, numero, pergunta, referencias: referenciasDe(conteudo), citacoes });
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
// docs: páginas já baixadas neste pedido (várias citações costumam apontar para o mesmo artigo).
async function lerTrechoCitado({ caminho, citacao }, timeoutMs, maxCaracteres = 3000, docs = null) {
  const destino = await resolverCitacao(caminho, timeoutMs);
  if (!destino || destino.de === null) return null;
  if (docs && !docs.has(destino.url)) docs.set(destino.url, baixar(destino.url, timeoutMs));
  const html = await (docs ? docs.get(destino.url) : baixar(destino.url, timeoutMs));
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const partes = [];
  const referencias = [];
  const leias = new Set();
  for (const [, , pid, conteudo] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const n = Number(pid);
    if (n >= destino.de && n <= destino.ate) {
      partes.push(textoDe(conteudo));
      referencias.push(...referenciasDe(conteudo, leias));
    }
  }
  const texto = partes.filter(Boolean).join("\n").slice(0, maxCaracteres);
  return texto ? { citacao, titulo, texto, referencias: [...new Set(referencias)], leias: [...leias] } : null;
}

const estudosBiblicos = new Map(); // url da página de reuniões -> { quando, capitulo }

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
  const trechos = (await Promise.all(citadas.slice(0, 6).map((c) => lerTrechoCitado(c, timeoutMs).catch(() => null)))).filter(Boolean);

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
  if (!titulo) return { pergunta: null, geral: null };
  const resto = html.slice(titulo.index + titulo[0].length);
  const fim = resto.search(/<h[23]\b/);
  const secao = (fim >= 0 ? resto.slice(0, fim) : resto).replace(/<div class="gen-field"[\s\S]*?<\/div>/g, "");
  let pergunta = null;
  let geral = null;
  for (const [, conteudo] of secao.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
    const texto = textoDe(conteudo);
    if (!texto) continue;
    if (!pergunta && /class="b"/.test(conteudo)) {
      const citacoes = [...conteudo.matchAll(/<a\b[^>]*href="(\/pt\/wol\/pc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, caminho, rotulo]) => ({ caminho, citacao: textoDe(rotulo) }));
      pergunta = { texto, referencias: referenciasDe(conteudo), citacoes };
    } else if (!geral) geral = texto;
  }
  return { pergunta, geral };
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
  };
  if (!joias.capitulos.length) return null;
  joiasLidas.set(urlReuniao, { quando: Date.now(), joias });
  if (joiasLidas.size > 20) joiasLidas.delete(joiasLidas.keys().next().value);
  return joias;
}

// Texto para a IA: a leitura (cada capítulo com os versículos e os trechos das publicações) e a pergunta da apostila.
export function textoDasJoias(joias, { pergunta, leitura }) {
  const partes = [`LEITURA DA BÍBLIA DA SEMANA (${joias.semana}): ${joias.leitura}`];
  if (leitura) {
    // O versículo da pergunta da apostila já tem a resposta própria: as joias devem ser sobre outros versículos.
    if (joias.pergunta && joias.pergunta.referencias.length) {
      partes.push(`VERSÍCULO DA PERGUNTA DA APOSTILA (não use nas joias): ${joias.pergunta.referencias.join("; ")}`);
    }
    for (const c of joias.capitulos) {
      partes.push(`${c.nome.toUpperCase()}:\n${c.versiculos.map((v) => `${v.verso} ${v.texto}`).join("\n")}`);
      if (c.trechos.length) {
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

// Texto do capítulo para a IA: o relato, as referências de "Leia o relato na Bíblia" (com os versículos, se vierem),
// os trechos das publicações citadas e as perguntas pedidas, cada uma com o identificador entre colchetes.
export function textoDoCapituloEbc(capitulo, perguntas, versiculos = []) {
  const partes = [
    `CAPÍTULO: ${[capitulo.contexto, capitulo.titulo].filter(Boolean).join(": ")}`,
    `RELATO:\n${capitulo.relato.join("\n")}`,
    `LEIA O RELATO NA BÍBLIA: ${capitulo.leia.join("; ") || "(nenhuma referência)"}`,
  ];
  if (versiculos.length) partes.push(`TEXTO DOS VERSÍCULOS:\n${versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n")}`);
  if (capitulo.trechos.length) {
    partes.push(`TRECHOS DAS PUBLICAÇÕES CITADAS NAS PERGUNTAS:\n${capitulo.trechos.map((t) => `(${t.citacao}) ${t.titulo ? `"${t.titulo}": ` : ""}${t.texto}`).join("\n\n")}`);
  }
  if (capitulo.imagens && capitulo.imagens.length) {
    partes.push(`IMAGENS DO CAPÍTULO (as perguntas citam cada uma pela letra, como "Imagem A"):\n${capitulo.imagens.map(textoDaImagem).join("\n\n")}`);
  }
  partes.push(`PERGUNTAS (responda a cada uma; em "pergunta", use o identificador entre colchetes):\n${perguntas.map((p) => `[${p.id}] (${p.nomeQuadro}) ${p.pergunta}`).join("\n")}`);
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
  return { texto: textoDe(conteudo), referencias: referenciasDe(conteudo), citacoes, temLinks: /<a\b/.test(conteudo) };
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

// Os textos bíblicos da matéria de Tesouros, para a lista da tela: os da apostila, os dos trechos das fontes lidas e os da reflexão
// (todos), e os marcados com "(Leia …)" nessas fontes.
export function textosBiblicosDeTesouros(discurso) {
  const itens = [...discurso.pontos, ...(discurso.reflexao ? [discurso.reflexao] : [])];
  const fontes = itens.flatMap((i) => i.fontes || []);
  return {
    todos: [...itens.flatMap((i) => i.referencias || []), ...fontes.flatMap((f) => f.referencias || [])],
    leia: fontes.flatMap((f) => f.leias || []),
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
  return achados.slice(0, maximo).map(({ ano, ...r }) => r);
}

// Um artigo do wol.jw.org pelo endereço (colado pelo orador no card Outros esboços): título, texto (até maxCaracteres) e textos bíblicos.
// Só aceita endereços do próprio wol (/pt/wol/d/r5/lp-t/<número do documento>; com "#h=7:0-9:0" na ponta, só os parágrafos daquela faixa).
// null = não é um endereço de artigo do wol ou o artigo não tem texto.
export async function lerArtigoDoWol(endereco, { timeoutMs = 8000, maxCaracteres = MAX_CARACTERES_ARTIGO } = {}) {
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
  for (const [, , pid, conteudo] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const n = Number(pid);
    if (de !== null && (n < de || n > ate)) continue;
    const texto = textoDe(conteudo);
    if (texto) {
      partes.push(texto);
      brutos.push(conteudo);
    }
  }
  if (!partes.length) return null;
  return { titulo, texto: partes.join("\n").slice(0, maxCaracteres), referencias: referenciasDe(brutos.join(" ")).slice(0, 40), url: BASE + "/pt/wol/d/r5/lp-t/" + doc[1] };
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
    leias: [...new Set([...(base.leias || []), ...(fonte && fonte.tipo === "ponto" ? fonte.leias || [] : [])])],
    imagens: base.imagens || [],
    url,
  };
  discursosCurtos.set(urlReuniao, { quando: Date.now(), discurso });
  if (discursosCurtos.size > 20) discursosCurtos.delete(discursosCurtos.keys().next().value);
  return discurso;
}

// As referências bíblicas para buscar o texto: as indicadas na apostila (e no ponto do apêndice) ou, com um artigo como fonte, as dele.
export function referenciasDoDiscursoCurto(discurso) {
  if (discurso.referencias.length) return discurso.referencias;
  return discurso.fonte && discurso.fonte.tipo === "documento" ? discurso.fonte.referencias : [];
}

// Os textos bíblicos da matéria do discurso curto, para a lista da tela: os indicados, os da fonte e os marcados com "(Leia …)".
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

export function camposDoDocumento(html) {
  const titulo = textoDe((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1]).replace(/\s*[—–-]\s*BIBLIOTECA ON-LINE.*$/i, "");
  // A publicação e a edição, como no JW Library: "w25 julho págs. 20-25" -> w, 20250700; "mwb26 setembro págs. 14-15" -> mwb, 20260900.
  const ref = html.match(/\b(w|mwb)(\d{2})\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i);
  const simbolo = ref ? ref[1].toLowerCase() : null;
  const edicao = ref ? (2000 + Number(ref[2])) * 10000 + (MESES.indexOf(ref[3].toLowerCase()) + 1) * 100 : null;

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
