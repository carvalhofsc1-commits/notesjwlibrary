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
  const corpo = (inicio >= 0 ? html.slice(inicio) : html)
    .replace(/<div class="stdPullQuote[\s\S]*?<\/div>/g, "") // frase em destaque (repete uma do relato)
    .replace(/<div class="gen-field"[\s\S]*?<\/div>/g, "") // campo "Sua resposta" da página
    .replace(/<figure[\s\S]*?<\/figure>/g, "");
  const contexto = textoDe((corpo.match(/<p\b[^>]*class="contextTtl[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || ""); // "13 JOSUÉ"
  const titulo = textoDe((corpo.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const relato = [];
  const leia = [];
  const perguntas = [];
  let secao = "relato";
  for (const [, tag, atributos, conteudo] of corpo.matchAll(/<(h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (/contextTtl/.test(atributos)) continue;
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
  return { contexto, titulo, relato, leia: [...new Set(leia)], perguntas };
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
  for (const [, , pid, conteudo] of html.matchAll(/<(p|h2|h3)\b[^>]*data-pid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
    const n = Number(pid);
    if (n >= destino.de && n <= destino.ate) partes.push(textoDe(conteudo));
  }
  const texto = partes.filter(Boolean).join("\n").slice(0, maxCaracteres);
  return texto ? { citacao, titulo, texto } : null;
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
  partes.push(
    `PERGUNTAS ORIGINAIS DO CAPÍTULO (já fazem parte do estudo: NÃO repita nem reformule, e não trate do mesmo ponto que elas):\n${capitulo.perguntas.map((p) => `(${p.nomeQuadro}) ${p.pergunta}`).join("\n")}`
  );
  return partes.join("\n\n");
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
  const bloco = fim >= 0 ? depois.slice(0, fim) : depois;

  const titulo = textoDe(item[1]).replace(/^\d+\.\s*/, "");
  let minutos = null;
  const pontos = [];
  let reflexao = null;
  for (const [, conteudo] of bloco.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const texto = textoDe(conteudo);
    if (!texto) continue;
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
  return pontos.length ? { titulo, minutos: minutos || 10, pontos, reflexao } : null;
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
