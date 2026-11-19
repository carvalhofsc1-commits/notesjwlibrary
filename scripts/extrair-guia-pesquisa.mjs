// Extrai o Guia de Pesquisa (jw.org) para um único .txt.
// Fonte: https://www.jw.org/pt/biblioteca/indices/guia-de-pesquisa/
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOC_URL = "https://www.jw.org/pt/biblioteca/indices/guia-de-pesquisa/";
const BASE = "https://www.jw.org";
const AGENTE = "NoteStyleExtractor/1.0 (uso pessoal; extracao para arquivo local)";
const SAIDA = resolve("guia-de-pesquisa.txt");
const CONCORRENCIA = 8;
const PAUSA_MS = 80;

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
        signal: AbortSignal.timeout(45000),
      });
      if (!resposta.ok) throw new Error(`${resposta.status}`);
      return await resposta.text();
    } catch (e) {
      ultimo = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw ultimo;
}

function listarTopicos(html) {
  const mapa = new Map();
  const re = /href="(\/pt\/biblioteca\/indices\/guia-de-pesquisa\/[^"#?]+\/)"/g;
  for (const m of html.matchAll(re)) {
    const path = m[1];
    if (path.endsWith("/guia-de-pesquisa/")) continue;
    if (!mapa.has(path)) mapa.set(path, decodeURIComponent(path.replace(/\/+$/, "").split("/").pop()));
  }
  return [...mapa.entries()]
    .map(([path, slug]) => ({ path, slug, url: BASE + path }))
    .sort((a, b) => a.slug.localeCompare(b.slug, "pt"));
}

/** Extrai o interior de um <div class="..."> com balanceamento de tags. */
function blocoBalanceado(html, className) {
  const marker = `<div class="${className}">`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m[0].startsWith("</")) {
      depth--;
      if (depth === 0) return html.slice(start + marker.length, m.index);
    } else {
      depth++;
    }
  }
  return "";
}

function formatarCorpo(bloco) {
  let s = String(bloco || "").replace(/\r\n?/g, "\n");

  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Botão de áudio / UI
    .replace(/<[^>]*\bREPRODUZIR\b[^>]*>/gi, "")
    .replace(/\bREPRODUZIR\b/g, "");

  // Versículos (livros bíblicos): <a class='jsBibleLink'><strong>1:1</strong></a>
  s = s.replace(
    /<p\b[^>]*>\s*<a\b[^>]*jsBibleLink[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/a>\s*<\/p>/gi,
    (_, v) => `\n## ${textoDe(v)}\n`
  );

  // Seções (accordion)
  s = s.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (_, x) => `\n### ${textoDe(x)}\n`);

  // Citações (linha subordinada)
  s = s.replace(/<p\b[^>]*>\s*<em>([\s\S]*?)<\/em>\s*<\/p>/gi, (_, e) => {
    const t = textoDe(e);
    return t ? `  ${t}\n` : "";
  });

  // Demais parágrafos (títulos de artigo / "Veja:")
  s = s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, p) => {
    const t = textoDe(p);
    return t ? `${t}\n` : "";
  });

  s = s
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, __, h) => {
      const t = textoDe(h);
      return t ? `\n## ${t}\n` : "";
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, li) => {
      const t = textoDe(li);
      return t ? `• ${t}\n` : "";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    // Não transformar div/details em newline — só remove
    .replace(/<\/?(?:details|div|section|header|footer|article|span|a|strong|em|b|i|u|figure|figcaption)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ");

  s = decodificar(s)
    .replace(/[ \t]+\n/g, "\n")
    // Remove linhas em branco extras; reabre só antes de seção/versículo
    .replace(/\n{2,}/g, "\n")
    .replace(/\n(### )/g, "\n\n$1")
    .replace(/\n(## )/g, "\n\n$1")
    .trim();

  return s;
}

function corpoDoTopico(html) {
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");
  let bloco = blocoBalanceado(html, "bodyTxt");
  if (!bloco) bloco = blocoBalanceado(html, "contentBody");
  if (!bloco) {
    const art = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || "";
    bloco = art.replace(/Selecione seu idioma[\s\S]*$/i, "").replace(/Compartilhar[\s\S]*$/i, "");
  }

  let texto = formatarCorpo(bloco);

  // Remove linha inicial que só repete o título
  if (titulo) {
    const reTitulo = new RegExp(
      `^##\\s*${titulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n+`,
      "i"
    );
    texto = texto.replace(reTitulo, "");
  }

  return { titulo: titulo || "Sem título", texto };
}

async function mapaLimitado(itens, limite, fn) {
  const saida = new Array(itens.length);
  let i = 0;
  async function trabalhador() {
    while (i < itens.length) {
      const idx = i++;
      saida[idx] = await fn(itens[idx], idx);
      if (PAUSA_MS) await new Promise((r) => setTimeout(r, PAUSA_MS));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, () => trabalhador()));
  return saida;
}

console.log("Baixando sumário…");
const tocHtml = await baixar(TOC_URL);
const topicos = listarTopicos(tocHtml);
if (!topicos.length) throw new Error("Não achei os tópicos do Guia de Pesquisa.");
console.log(`Sumário: ${topicos.length} tópicos.`);

let ok = 0;
let falhas = 0;
let charsTotal = 0;
const resultados = await mapaLimitado(topicos, CONCORRENCIA, async (t, idx) => {
  try {
    const html = await baixar(t.url);
    const { titulo, texto } = corpoDoTopico(html);
    ok++;
    charsTotal += texto.length;
    if ((idx + 1) % 50 === 0 || idx === 0 || idx === topicos.length - 1) {
      console.log(`[${idx + 1}/${topicos.length}] ${titulo} (${texto.length} chars) · ok=${ok} falhas=${falhas}`);
    }
    return { titulo, texto, url: t.url, erro: null };
  } catch (e) {
    falhas++;
    console.log(`[${idx + 1}/${topicos.length}] ERRO ${t.slug}: ${e.message}`);
    return { titulo: t.slug, texto: "", url: t.url, erro: e.message };
  }
});

resultados.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));

const vazios = resultados.filter((r) => !r.erro && !r.texto).length;
const partes = [
  "Guia de Pesquisa",
  "Fonte: https://www.jw.org/pt/biblioteca/indices/guia-de-pesquisa/",
  `Extraído em ${new Date().toISOString().slice(0, 10)}`,
  `Tópicos: ${resultados.length} (ok=${ok}, falhas=${falhas}, vazios=${vazios})`,
  "",
  "========== SUMÁRIO ==========",
  ...resultados.map((r, i) => `${String(i + 1).padStart(4, "0")}. ${r.titulo}`),
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
console.log(`\nPronto: ${SAIDA}`);
console.log(`Tamanho: ${(Buffer.byteLength(conteudo, "utf8") / 1024 / 1024).toFixed(2)} MB`);
console.log(`Chars de corpo: ${(charsTotal / 1024 / 1024).toFixed(2)} MB · vazios=${vazios}`);
