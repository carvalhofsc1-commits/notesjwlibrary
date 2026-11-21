// Completa no guia-de-pesquisa.txt os tópicos que saíram sem texto.
// Preferível: reexecutar scripts/extrair-guia-pesquisa.mjs (extração completa e formatada).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOC_URL = "https://www.jw.org/pt/biblioteca/indices/guia-de-pesquisa/";
const BASE = "https://www.jw.org";
const AGENTE = "NoteStyleExtractor/1.0 (uso pessoal; extracao para arquivo local)";
const ARQUIVO = resolve("guia-de-pesquisa.txt");
const CONCORRENCIA = 6;

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
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
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
  return [...mapa.entries()].map(([path, slug]) => ({ path, slug, url: BASE + path }));
}

function corpoDoTopico(html) {
  const titulo = textoDe((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");
  let bloco = (html.match(/<div class="bodyTxt">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/article>/i) || [])[1];
  if (!bloco) bloco = (html.match(/<div class="contentBody">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/article>/i) || [])[1];
  if (!bloco) {
    // Último recurso: tudo entre <article> e </article>, sem o rodapé de idioma/compartilhar.
    const art = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] || "";
    bloco = art.replace(/Selecione seu idioma[\s\S]*$/i, "").replace(/Compartilhar[\s\S]*$/i, "");
  }

  let texto = String(bloco || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (_, s) => `\n\n### ${textoDe(s)}\n`)
    .replace(/<\/?(details|div|section|header|footer)[^>]*>/gi, "\n")
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, p) => textoDe(p) + "\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, li) => "• " + textoDe(li) + "\n")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, __, h) => "\n## " + textoDe(h) + "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  texto = decodificar(texto).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { titulo: titulo || "Sem título", texto };
}

const atual = readFileSync(ARQUIVO, "utf8");
const vazios = [];
for (const m of atual.matchAll(/\n========== ([^=]+) ==========\n\n\(sem texto\)\n/g)) {
  vazios.push(m[1].trim());
}
console.log("Vazios no arquivo:", vazios.length);

const toc = await baixar(TOC_URL);
const topicos = listarTopicos(toc);
const porTitulo = new Map();
for (const t of topicos) {
  // slug → vamos baixar e comparar título real
  porTitulo.set(t.slug.toLocaleLowerCase("pt"), t);
  porTitulo.set(t.slug.toLocaleUpperCase("pt-BR"), t);
}

// Mapear título do arquivo → URL pelo slug aproximado
function acharUrl(tituloArquivo) {
  const alvo = tituloArquivo.toLocaleLowerCase("pt");
  for (const t of topicos) {
    const slug = t.slug.toLocaleLowerCase("pt").replace(/-/g, " ");
    if (slug === alvo.replace(/[“”"]/g, "").toLocaleLowerCase("pt")) return t;
  }
  // fallback: normaliza acentos fracos
  const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nAlvo = norm(tituloArquivo);
  for (const t of topicos) {
    if (norm(t.slug.replace(/-/g, " ")) === nAlvo) return t;
  }
  return null;
}

let i = 0;
const fila = [...vazios];
const atualizacoes = new Map();

async function trabalhador() {
  while (fila.length) {
    const titulo = fila.shift();
    const t = acharUrl(titulo);
    i++;
    if (!t) {
      console.log(`[${i}/${vazios.length}] sem URL: ${titulo}`);
      continue;
    }
    try {
      const html = await baixar(t.url);
      const { titulo: tit, texto } = corpoDoTopico(html);
      atualizacoes.set(titulo, { titulo: tit || titulo, texto });
      console.log(`[${i}/${vazios.length}] ${tit || titulo}: ${texto.length} chars`);
    } catch (e) {
      console.log(`[${i}/${vazios.length}] ERRO ${titulo}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

await Promise.all(Array.from({ length: CONCORRENCIA }, () => trabalhador()));

let novo = atual;
for (const [tituloAntigo, { texto }] of atualizacoes) {
  const bloco = `\n========== ${tituloAntigo} ==========\n\n(sem texto)\n`;
  const refeito = `\n========== ${tituloAntigo} ==========\n\n${texto || "(sem texto)"}\n`;
  if (novo.includes(bloco)) novo = novo.replace(bloco, refeito);
  else {
    // título no arquivo pode estar em maiúsculas
    const bloco2 = `\n========== ${tituloAntigo.toLocaleUpperCase("pt-BR")} ==========\n\n(sem texto)\n`;
    const refeito2 = `\n========== ${tituloAntigo.toLocaleUpperCase("pt-BR")} ==========\n\n${texto || "(sem texto)"}\n`;
    if (novo.includes(bloco2)) novo = novo.replace(bloco2, refeito2);
  }
}

writeFileSync(ARQUIVO, novo, "utf8");
const ainda = [...novo.matchAll(/\n========== ([^=]+) ==========\n\n\(sem texto\)\n/g)].map((m) => m[1].trim());
console.log("\nAtualizados:", atualizacoes.size);
console.log("Ainda vazios:", ainda.length);
if (ainda.length) console.log(ainda.join(", "));
console.log("Arquivo:", ARQUIVO);
