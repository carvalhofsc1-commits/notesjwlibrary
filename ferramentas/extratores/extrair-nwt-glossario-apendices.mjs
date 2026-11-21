// Extrai Glossário e Apêndices/Introdução da Bíblia de Estudo (WOL) em arquivos .txt separados.
// Não inclui a seção "Outras obras de referência".
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://wol.jw.org";
const AGENTE = "NoteStyleExtractor/1.0 (uso pessoal; extracao para arquivo local)";
const CONCORRENCIA = 6;

const FONTES = [
  {
    url: `${BASE}/pt/wol/publication/r5/lp-t/nwtstg`,
    arquivo: "glossario-nwt.txt",
    titulo: "Glossário — Tradução do Novo Mundo",
    paginadoPorLetra: true,
  },
  {
    url: `${BASE}/pt/wol/publication/r5/lp-t/nwtsty/0`,
    arquivo: "introducao-biblia-estudo.txt",
    titulo: "Introdução — Bíblia de Estudo (nwtsty)",
  },
  {
    url: `${BASE}/pt/wol/publication/r5/lp-t/nwtsty/98`,
    arquivo: "apendice-a-biblia-estudo.txt",
    titulo: "Apêndice A — Bíblia de Estudo (nwtsty)",
  },
  {
    url: `${BASE}/pt/wol/publication/r5/lp-t/nwtsty/117`,
    arquivo: "apendice-b-biblia-estudo.txt",
    titulo: "Apêndice B — Bíblia de Estudo (nwtsty)",
  },
  {
    url: `${BASE}/pt/wol/publication/r5/lp-t/nwtsty/140`,
    arquivo: "apendice-c-biblia-estudo.txt",
    titulo: "Apêndice C — Bíblia de Estudo (nwtsty)",
  },
];

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
        signal: AbortSignal.timeout(25000),
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

// Lista documentos do sumário, parando em "Outras obras de referência".
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

function paginasDeLetra(html, pubSlug) {
  const re = new RegExp(`href="(/pt/wol/publication/r5/lp-t/${pubSlug}/\\d+)"`, "g");
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
  let bloco =
    (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || [])[1] ||
    (html.match(/<div class="bodyTxt">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/article>/i) || [])[1] ||
    "";

  // Evita repetir o título (h1) no corpo.
  bloco = bloco.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "");

  const limpo = bloco
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<span\b[^>]*class="pageNum"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, __, h) => `\n\n## ${textoDe(h)}\n\n`)
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, p) => {
      const t = textoDe(p);
      return t ? t + "\n\n" : "";
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, li) => {
      const t = textoDe(li);
      return t ? "• " + t + "\n" : "";
    })
    .replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, c) => {
      const t = textoDe(c);
      return t ? "[" + t + "]\n\n" : "";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const texto = decodificar(limpo).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { titulo: h1, texto };
}

async function mapaLimitado(itens, limite, fn) {
  const saida = new Array(itens.length);
  let i = 0;
  async function trabalhador() {
    while (i < itens.length) {
      const idx = i++;
      saida[idx] = await fn(itens[idx], idx);
      await new Promise((r) => setTimeout(r, 80));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, () => trabalhador()));
  return saida;
}

async function coletarDocs(fonte) {
  const toc = await baixar(fonte.url);
  if (!fonte.paginadoPorLetra) return docsDoSumario(toc);

  const letras = paginasDeLetra(toc, "nwtstg");
  const paginas = letras.length ? letras : [fonte.url];
  console.log(`  Páginas por letra: ${paginas.length}`);
  const todos = [];
  const vistos = new Set();
  for (const url of paginas) {
    const html = await baixar(url);
    for (const doc of docsDoSumario(html)) {
      if (vistos.has(doc.id)) continue;
      vistos.add(doc.id);
      todos.push(doc);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return todos;
}

for (const fonte of FONTES) {
  console.log(`\n=== ${fonte.titulo} ===`);
  console.log(`Sumário: ${fonte.url}`);
  const docs = await coletarDocs(fonte);
  console.log(`Documentos (sem "Outras obras"): ${docs.length}`);
  if (!docs.length) {
    console.log("Nenhum documento — pulando.");
    continue;
  }

  const resultados = await mapaLimitado(docs, CONCORRENCIA, async (doc, idx) => {
    try {
      const html = await baixar(doc.url);
      const { titulo, texto } = corpoDoDocumento(html);
      if ((idx + 1) % 25 === 0 || idx === 0 || idx === docs.length - 1) {
        console.log(`  [${idx + 1}/${docs.length}] ${titulo || doc.titulo} (${texto.length} chars)`);
      }
      return { titulo: titulo || doc.titulo, texto, url: doc.url, erro: null };
    } catch (e) {
      console.log(`  [${idx + 1}/${docs.length}] ERRO ${doc.titulo}: ${e.message}`);
      return { titulo: doc.titulo, texto: "", url: doc.url, erro: e.message };
    }
  });

  const partes = [
    fonte.titulo,
    `Fonte: ${fonte.url}`,
    `Extraído em ${new Date().toISOString().slice(0, 10)}`,
    `Documentos: ${resultados.length}`,
    "",
    "========== SUMÁRIO ==========",
    ...resultados.map((r, i) => `${String(i + 1).padStart(2, "0")}. ${r.titulo}`),
    "",
  ];

  for (const r of resultados) {
    partes.push("========== " + r.titulo.toLocaleUpperCase("pt-BR") + " ==========");
    partes.push("");
    if (r.erro) partes.push("[Falha ao baixar: " + r.erro + "]");
    else partes.push(r.texto || "(sem texto)");
    partes.push("");
  }

  const saida = resolve(fonte.arquivo);
  const conteudo = partes.join("\n");
  writeFileSync(saida, conteudo, "utf8");
  console.log(`Salvo: ${saida} (${(Buffer.byteLength(conteudo, "utf8") / 1024).toFixed(1)} KB)`);
}

console.log("\nConcluído.");
