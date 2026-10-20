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
const AGENTE = "Mozilla/5.0 (compatible; NoteStyle/1.0; +https://notestyle.vercel.app)";
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

// Referências bíblicas de um trecho da página: os links de texto bíblico (class="b"). Um link sem o nome do livro
// continua o anterior: separado por vírgula, entra na mesma referência ("Filêmon 8, 9" + ", 17" -> "Filêmon 8, 9, 17");
// separado por ponto e vírgula, vira outra do mesmo livro ("Mat. 24:14;" + "28:19, 20" -> "Mat. 28:19, 20").
function referenciasDe(html) {
  const lista = [];
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
    if (comLivro) livro = comLivro[1];
    else if (lista.length && (entre === "," || entre === "")) {
      lista[lista.length - 1] += `, ${texto}`;
      continue;
    }
    lista.push(comLivro || !livro ? texto : `${livro} ${texto}`);
  }
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
  const corpo = inicio >= 0 ? html.slice(inicio) : html;
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
    if (/\b(pubRefs|themeScrp|contextTtl|noticeText)\b/.test(classe)) continue;

    const pid = (atributos.match(/data-pid="(\d+)"/) || [])[1];
    if (/\bqu\b/.test(classe)) {
      const texto = textoDe(conteudo);
      const m = texto.match(/^(\d+(?:\s*[,–-]\s*\d+)*)\s*\.\s*([\s\S]*)$/);
      atual = { rotulo: m ? m[1].replace(/\s*,\s*/g, ", ").replace(/\s*[-–]\s*/g, "-") : "", pergunta: m ? m[2] : texto, numeros: m ? numeros(m[1]) : [], paragrafos: [], legendas: [], referencias: referenciasDe(conteudo) };
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

// Texto que vai para a IA: só as perguntas pedidas, cada uma com seus parágrafos (e as legendas das imagens).
export function textoDosGrupos(grupos) {
  return grupos
    .map((g) =>
      [
        `Pergunta (${g.numeros.length > 1 ? "parágrafos" : "parágrafo"} ${g.rotulo}): ${g.pergunta}`,
        ...g.paragrafos.map((p) => `${p.numero ?? ""} ${p.texto}`.trim()),
        ...g.legendas.map((l) => `Legenda da imagem: ${l}`),
      ].join("\n")
    )
    .join("\n\n");
}

// Para a recapitulação: o artigo inteiro (subtítulos e parágrafos, sem as perguntas) e as perguntas do quadro.
export function textoDaRecapitulacao(artigo) {
  const corpo = artigo.secoes.map((s) => (s.subtitulo ? `\n${s.subtitulo}` : `${s.numero ?? ""} ${s.texto}`.trim())).join("\n");
  return (
    `ARTIGO: ${artigo.titulo}\n${corpo.trim()}\n\n` +
    `PERGUNTAS DE RECAPITULAÇÃO (responda a cada uma):\n` +
    artigo.recapitulacao.map((q, i) => `${i + 1}. ${q}`).join("\n")
  );
}
