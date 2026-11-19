// Converte um EPUB (zip com XHTML) em .txt UTF-8: um parágrafo por bloco, separados por linha em branco.
// Sem dependências novas: Expand-Archive (PowerShell) + remoção de tags.
// Uso: node ferramentas/epub-para-txt.mjs <arquivo.epub> <saida.txt>
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const epub = resolve(process.argv[2] || "");
const saida = resolve(process.argv[3] || "");
if (!epub || !saida) {
  console.error("Uso: node ferramentas/epub-para-txt.mjs <arquivo.epub> <saida.txt>");
  process.exit(1);
}

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
    .trim();
}

function listarArquivos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) listarArquivos(caminho, acc);
    else acc.push(caminho);
  }
  return acc;
}

function paragrafosDoXhtml(html) {
  let corpo = String(html || "").replace(/\r\n?/g, "\n");
  corpo = corpo
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<span\b[^>]*class="[^"]*pageNum[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "");

  // Prefere o corpo principal quando existir.
  const bodyTxt = (corpo.match(/<div class="bodyTxt">([\s\S]*?)<\/div>\s*(?:<div class="groupFootnote"|<\/body>)/i) || [])[1];
  const article = (corpo.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || corpo;
  const fonte = bodyTxt || article;

  const partes = [];
  // Só títulos e parágrafos (evita divs/tabelas de navegação).
  for (const m of fonte.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = textoDe(m[2]);
    if (!t) continue;
    if (/^\d{1,4}$/.test(t)) continue; // número de página solto
    if (/^(sumário|índice|contents|table of contents|voltar|próximo|anterior|copyright)$/i.test(t)) continue;
    if (/^página\s*\d+$/i.test(t)) continue;
    partes.push(t);
  }
  return partes;
}

/** Ordem dos capítulos pelo content.opf (spine). */
function arquivosDoSpine(raiz) {
  const todos = listarArquivos(raiz);
  const opf = todos.find((f) => /\.opf$/i.test(f));
  if (!opf) return null;
  const xml = readFileSync(opf, "utf8");
  const pastaOpf = dirname(opf);
  const manifesto = new Map();
  for (const m of xml.matchAll(/<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*>/gi)) {
    manifesto.set(m[1], m[2].split("#")[0]);
  }
  // href pode vir antes do id
  for (const m of xml.matchAll(/<item\b[^>]*\bhref="([^"]+)"[^>]*\bid="([^"]+)"[^>]*>/gi)) {
    if (!manifesto.has(m[2])) manifesto.set(m[2], m[1].split("#")[0]);
  }
  const ordem = [];
  for (const m of xml.matchAll(/idref="([^"]+)"/gi)) {
    const href = manifesto.get(m[1]);
    if (!href) continue;
    const caminho = join(pastaOpf, href.replace(/\//g, "\\"));
    // Tenta caminho normalizado
    const alt = join(pastaOpf, ...href.split("/"));
    const arq = existsSync(alt) ? alt : existsSync(caminho) ? caminho : null;
    if (arq) ordem.push(arq);
  }
  return ordem.length ? ordem : null;
}

const pasta = mkdtempSync(join(tmpdir(), "epub-nwt-"));
const zip = join(pasta, "livro.zip");
try {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Copy-Item -LiteralPath '${epub.replace(/'/g, "''")}' -Destination '${zip.replace(/'/g, "''")}'; Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${pasta.replace(/'/g, "''")}\\out' -Force`,
    ],
    { stdio: "pipe" }
  );

  const raiz = join(pasta, "out");
  let arquivos = arquivosDoSpine(raiz);
  if (!arquivos) {
    arquivos = listarArquivos(raiz)
      .filter((f) => /\.(x?html|htm)$/i.test(f))
      .filter((f) => !/-extracted\./i.test(basename(f)))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  } else {
    // Spine às vezes inclui o *-extracted; preferimos o .xhtml “cheio”.
    arquivos = arquivos.filter((f) => !/-extracted\./i.test(basename(f)));
  }

  const paragrafos = [];
  const vistos = new Set();
  for (const arq of arquivos) {
    const nome = basename(arq).toLowerCase();
    if (/^(cover|toc|nav|titlepage)/i.test(nome)) continue;
    const html = readFileSync(arq, "utf8");
    for (const p of paragrafosDoXhtml(html)) {
      const chave = p.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      paragrafos.push(p);
    }
  }

  const texto = paragrafos.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  writeFileSync(saida, texto, "utf8");
  const uteis = paragrafos.filter((p) => p.length >= 80).length;
  console.log(
    `OK ${saida} — ${paragrafos.length} parágrafos (${uteis} ≥80), ${(Buffer.byteLength(texto) / 1024).toFixed(1)} KB (de ${arquivos.length} xhtml)`
  );
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
