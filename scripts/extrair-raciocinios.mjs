// Extrai o livro Raciocínios (wol.jw.org) para um único .txt.
// Fonte: https://wol.jw.org/pt/wol/d/r5/lp-t/1101989283
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://wol.jw.org";
const DOC = "1101989283";
const TOC_URL = `${BASE}/pt/wol/d/r5/lp-t/${DOC}`;
const AGENTE = "NoteStyleExtractor/1.0 (uso pessoal; extracao para arquivo local)";
const SAIDA = resolve("raciocinios.txt");

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
  return decodificar(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

async function baixar(url) {
  const resposta = await fetch(url, {
    headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!resposta.ok) throw new Error(`${url} → ${resposta.status}`);
  return await resposta.text();
}

function sumario(html) {
  const itens = [];
  const re = /href="\/pt\/wol\/pc\/r5\/lp-t\/1101989283\/(\d+)\/0"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const indice = Number(m[1]);
    const titulo = textoDe(m[2]);
    if (!titulo) continue;
    if (itens.some((i) => i.indice === indice)) continue;
    itens.push({ indice, titulo });
  }
  return itens.sort((a, b) => a.indice - b.indice);
}

function corpoDoCapitulo(html) {
  const bloco = (html.match(/<div class="scalableui">([\s\S]*?)<\/div>/) || [])[1] || "";
  const limpo = bloco
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<span\b[^>]*class="pageNum"[^>]*>[\s\S]*?<\/span>/gi, "");
  const paragrafos = [...limpo.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => textoDe(m[1]))
    .filter(Boolean);
  return paragrafos.join("\n\n");
}

function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const tocHtml = await baixar(TOC_URL);
const capitulos = sumario(tocHtml);
if (!capitulos.length) throw new Error("Não achei os capítulos no sumário.");

console.log(`Sumário: ${capitulos.length} assuntos.`);

const partes = [
  "Raciocínios a partir das Escrituras",
  "Fonte: https://wol.jw.org/pt/wol/d/r5/lp-t/1101989283",
  `Extraído em ${new Date().toISOString().slice(0, 10)}`,
  "",
  "========== SUMÁRIO ==========",
  ...capitulos.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${c.titulo}`),
  "",
];

for (let i = 0; i < capitulos.length; i++) {
  const cap = capitulos[i];
  const url = `${BASE}/pt/wol/pc/r5/lp-t/${DOC}/${cap.indice}/0`;
  process.stdout.write(`[${i + 1}/${capitulos.length}] ${cap.titulo}… `);
  try {
    const html = await baixar(url);
    const texto = corpoDoCapitulo(html);
    partes.push("========== " + cap.titulo.toLocaleUpperCase("pt-BR") + " ==========");
    partes.push("");
    partes.push(texto || "(sem texto)");
    partes.push("");
    console.log(texto ? `${texto.length} chars` : "vazio");
  } catch (e) {
    console.log("ERRO: " + e.message);
    partes.push("========== " + cap.titulo.toLocaleUpperCase("pt-BR") + " ==========");
    partes.push("");
    partes.push("[Falha ao baixar este capítulo: " + e.message + "]");
    partes.push("");
  }
  await dormir(250);
}

writeFileSync(SAIDA, partes.join("\n"), "utf8");
console.log(`\nPronto: ${SAIDA}`);
console.log(`Tamanho: ${(Buffer.byteLength(partes.join("\n"), "utf8") / 1024).toFixed(1)} KB`);
