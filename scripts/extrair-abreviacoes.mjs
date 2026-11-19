// Extrai a lista de abreviaturas das publicações (WOL) para um .txt.
// Fonte: https://wol.jw.org/pt/wol/d/r5/lp-t/1200270068
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = "https://wol.jw.org/pt/wol/d/r5/lp-t/1200270068";
const SAIDA = resolve("abreviacoes-publicacoes.txt");
const AGENTE = "NoteStyleExtractor/1.0 (uso pessoal; extracao para arquivo local)";

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

const html = await (await fetch(URL, {
  headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
  redirect: "follow",
  signal: AbortSignal.timeout(30000),
})).text();

const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "")
  || "Abreviaturas dos títulos das publicações";

const nota = textoDe((html.match(/<div class="openingContent">([\s\S]*?)<\/div>/i) || [])[1] || "");

const artigo = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || html;
const tabela = (artigo.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i) || [])[1] || "";
if (!tabela) throw new Error("Tabela de abreviaturas não encontrada.");

const linhas = [];
for (const tr of tabela.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...tr[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => textoDe(c[1]));
  if (cells.length) linhas.push(cells);
}

if (linhas.length < 2) throw new Error("Poucas linhas na tabela.");

// Cabeçalho + dados
const cabecalho = linhas[0];
const dados = linhas.slice(1).filter((r) => r.some((c) => c));

const partes = [
  titulo,
  `Fonte: ${URL}`,
  `Extraído em ${new Date().toISOString().slice(0, 10)}`,
  `Entradas: ${dados.length}`,
  "",
];
if (nota) {
  partes.push(nota);
  partes.push("");
}

partes.push("========== LISTA ==========");
partes.push("");
partes.push(
  ["Mnemônico", "Título abreviado", "Título completo (copyright)", "Formato"].join("\t")
);
partes.push("-".repeat(80));

for (const row of dados) {
  // Garante 4 colunas
  const [mnem = "", abreviado = "", completo = "", formato = ""] = row;
  partes.push([mnem, abreviado, completo, formato].join("\t"));
}

partes.push("");
partes.push("========== POR MNEMÔNICO ==========");
partes.push("");

const ordenados = [...dados].sort((a, b) =>
  String(a[0] || "").localeCompare(String(b[0] || ""), "pt", { sensitivity: "base" })
);

for (const [mnem, abreviado, completo, formato] of ordenados) {
  partes.push(`${mnem}`);
  partes.push(`  ${abreviado}`);
  partes.push(`  ${completo}`);
  if (formato) partes.push(`  Formato: ${formato}`);
  partes.push("");
}

const conteudo = partes.join("\n").replace(/\n{3,}/g, "\n\n");
writeFileSync(SAIDA, conteudo, "utf8");
console.log(`Salvo: ${SAIDA}`);
console.log(`Entradas: ${dados.length} · ${(Buffer.byteLength(conteudo, "utf8") / 1024).toFixed(1)} KB`);
console.log("Amostra:", dados.slice(0, 3).map((r) => r[0] + " → " + r[2]).join(" | "));
console.log("Cabeçalho HTML:", cabecalho.join(" | "));
