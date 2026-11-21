// Extrai "Perguntas Bíblicas Respondidas" (ijwbq) para um .txt.
// Fonte: https://wol.jw.org/pt/wol/publication/r5/lp-t/ijwbq
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://wol.jw.org";
const TOC_URL = `${BASE}/pt/wol/publication/r5/lp-t/ijwbq`;
const SAIDA = resolve("perguntas-biblicas-respondidas.txt");
const AGENTE = "NoteStyleExtractor/1.0 (uso pessoal; extracao para arquivo local)";
const CONCORRENCIA = 8;

function decodificar(html) {
  return String(html || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function textoDe(html) {
  return decodificar(String(html || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

async function baixar(url, tentativas = 3) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      const resposta = await fetch(url, {
        headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (!resposta.ok) throw new Error(String(resposta.status));
      return await resposta.text();
    } catch (e) {
      ultimo = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw ultimo;
}

function docsDoSumario(html) {
  const corte = html.search(/<ul class="additionalReferenceWorks">|Outras obras de referência/i);
  const trecho = corte >= 0 ? html.slice(0, corte) : html;
  const docs = [];
  const vistos = new Set();
  const re = /href="(\/pt\/wol\/d\/r5\/lp-t\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of trecho.matchAll(re)) {
    const path = m[1];
    const id = m[2];
    if (vistos.has(id)) continue;
    const bloco = m[3];
    const card = textoDe((bloco.match(/cardLine1[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "");
    const titulo = card || textoDe(bloco) || ("Documento " + id);
    if (!titulo || /^mídias$/i.test(titulo)) continue;
    vistos.add(id);
    docs.push({ id, path, url: BASE + path, titulo });
  }
  return docs;
}

function paginasDoSumario(html) {
  const re = /href="(\/pt\/wol\/publication\/r5\/lp-t\/ijwbq\/\d+)"/g;
  const urls = [];
  const vistos = new Set();
  for (const m of html.matchAll(re)) {
    if (vistos.has(m[1])) continue;
    vistos.add(m[1]);
    urls.push(BASE + m[1]);
  }
  return urls;
}

function corpoDoDocumento(html) {
  const h1 = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");
  let bloco = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || "";
  bloco = bloco.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "");

  let texto = bloco
    .replace(/\r\n?/g, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<span\b[^>]*class="pageNum"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, __, h) => {
      const t = textoDe(h);
      return t ? `\n## ${t}\n` : "";
    })
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, p) => {
      const t = textoDe(p);
      return t ? t + "\n" : "";
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, li) => {
      const t = textoDe(li);
      return t ? "• " + t + "\n" : "";
    })
    .replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, c) => {
      const t = textoDe(c);
      return t ? "[" + t + "]\n" : "";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:div|section|header|footer|article|span|a|strong|em|b|i|u|figure)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ");

  texto = decodificar(texto)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n(## )/g, "\n\n$1")
    .trim();

  return { titulo: h1, texto };
}

async function mapaLimitado(itens, limite, fn) {
  const saida = new Array(itens.length);
  let i = 0;
  async function trabalhador() {
    while (i < itens.length) {
      const idx = i++;
      saida[idx] = await fn(itens[idx], idx);
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, () => trabalhador()));
  return saida;
}

async function coletarDocs() {
  console.log("Baixando sumário…", TOC_URL);
  const toc = await baixar(TOC_URL);
  let paginas = paginasDoSumario(toc);
  if (!paginas.length) paginas = [TOC_URL];
  console.log(`Páginas do sumário: ${paginas.length}`);

  const mapa = new Map();
  for (const url of paginas) {
    const html = url === TOC_URL ? toc : await baixar(url);
    const docs = docsDoSumario(html);
    let novos = 0;
    for (const d of docs) {
      if (!mapa.has(d.id)) {
        mapa.set(d.id, d);
        novos++;
      }
    }
    console.log(`  ${url.replace(BASE, "")} → ${docs.length} links, +${novos} novos (total ${mapa.size})`);
    await new Promise((r) => setTimeout(r, 80));
  }
  return [...mapa.values()];
}

const docs = await coletarDocs();
if (!docs.length) throw new Error("Nenhum tópico encontrado.");
console.log(`Tópicos únicos: ${docs.length}`);

let ok = 0;
let falhas = 0;
const resultados = await mapaLimitado(docs, CONCORRENCIA, async (doc, idx) => {
  try {
    const html = await baixar(doc.url);
    const { titulo, texto } = corpoDoDocumento(html);
    ok++;
    if ((idx + 1) % 25 === 0 || idx === 0 || idx === docs.length - 1) {
      console.log(`  [${idx + 1}/${docs.length}] ${titulo || doc.titulo} (${texto.length} chars)`);
    }
    return { titulo: titulo || doc.titulo, texto, url: doc.url, erro: null };
  } catch (e) {
    falhas++;
    console.log(`  [${idx + 1}/${docs.length}] ERRO ${doc.titulo}: ${e.message}`);
    return { titulo: doc.titulo, texto: "", url: doc.url, erro: e.message };
  }
});

resultados.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));

const partes = [
  "Perguntas Bíblicas Respondidas",
  `Fonte: ${TOC_URL}`,
  `Extraído em ${new Date().toISOString().slice(0, 10)}`,
  `Tópicos: ${resultados.length} (ok=${ok}, falhas=${falhas})`,
  "",
  "========== SUMÁRIO ==========",
  ...resultados.map((r, i) => `${String(i + 1).padStart(3, "0")}. ${r.titulo}`),
  "",
];

for (const r of resultados) {
  partes.push("========== " + r.titulo.toLocaleUpperCase("pt-BR") + " ==========");
  partes.push("");
  if (r.erro) partes.push("[Falha ao baixar: " + r.erro + "]");
  else partes.push(r.texto || "(sem texto)");
  partes.push("");
}

const conteudo = partes.join("\n");
writeFileSync(SAIDA, conteudo, "utf8");
console.log(`\nSalvo: ${SAIDA}`);
console.log(`Tamanho: ${(Buffer.byteLength(conteudo, "utf8") / 1024 / 1024).toFixed(2)} MB`);
