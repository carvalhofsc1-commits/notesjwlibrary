// Transcrições na íntegra das gravações das Anotações, guardadas no servidor (Vercel Blob PRIVADO) para cada aparelho.
// O arquivo começa com "_" para a Vercel não publicá-lo como rota; quem chama é api/transcrever.mjs (com o código de texto já conferido).
//  - transcricoes/<aparelho>/indice.json: a lista (id, título, data, duração, tamanho), mais recente primeiro;
//  - transcricoes/<aparelho>/<id>.txt: o texto de cada transcrição.
// <aparelho> é um resumo (SHA-256) do identificador do aparelho: o identificador em si não aparece no caminho.
// TRANSCRICOES_DIR (só para testes no computador) troca o Blob por uma pasta local.
import { createHash, randomUUID } from "node:crypto";
import { blobConfigurado, del, get, put } from "./_blob.mjs";

const MAX_ITENS = 200;
const MAX_TEXTO = 400_000; // caracteres (várias horas de fala)
const MAX_TITULO = 200;
const ID_VALIDO = /^[0-9a-f-]{36}$/;
const APARELHO_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function transcricoesConfiguradas() {
  return Boolean(blobConfigurado() || process.env.TRANSCRICOES_DIR);
}

function pasta(aparelhoId) {
  if (!APARELHO_VALIDO.test(String(aparelhoId || ""))) {
    const e = new Error("Aparelho não identificado.");
    e.status = 400;
    throw e;
  }
  return "transcricoes/" + createHash("sha256").update(String(aparelhoId).toLowerCase()).digest("hex").slice(0, 32);
}

async function ler(nome) {
  if (process.env.TRANSCRICOES_DIR) {
    const { readFile } = await import("node:fs/promises");
    try {
      return await readFile(`${process.env.TRANSCRICOES_DIR}/${nome}`, "utf8");
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  }
  const r = await get(nome, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN, useCache: false }).catch((e) => {
    if (e && /not\s*found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw e;
  });
  if (!r || r.statusCode !== 200) return null;
  return await new Response(r.stream).text();
}

async function gravar(nome, texto, tipo) {
  if (process.env.TRANSCRICOES_DIR) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const caminho = `${process.env.TRANSCRICOES_DIR}/${nome}`;
    await mkdir(caminho.slice(0, caminho.lastIndexOf("/")), { recursive: true });
    await writeFile(caminho, texto, "utf8");
    return;
  }
  await put(nome, texto, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: tipo,
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

async function apagar(nome) {
  try {
    if (process.env.TRANSCRICOES_DIR) {
      const { unlink } = await import("node:fs/promises");
      await unlink(`${process.env.TRANSCRICOES_DIR}/${nome}`).catch(() => {});
    } else {
      await del(nome, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
  } catch (e) {
    console.error("Transcrições: não apagou", nome, e && e.message);
  }
}

async function lerIndice(base) {
  try {
    const bruto = await ler(base + "/indice.json");
    const dados = bruto ? JSON.parse(bruto) : null;
    return Array.isArray(dados && dados.itens) ? dados.itens : [];
  } catch {
    return [];
  }
}

const gravarIndice = (base, itens) => gravar(base + "/indice.json", JSON.stringify({ itens }), "application/json");

export async function salvarTranscricao({ aparelhoId, titulo, texto, duracaoS }) {
  const base = pasta(aparelhoId);
  const corpo = String(texto || "").replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXTO);
  if (corpo.length < 2) {
    const e = new Error("Transcrição vazia.");
    e.status = 400;
    throw e;
  }
  const id = randomUUID();
  const item = {
    id,
    titulo: String(titulo || "Gravação").replace(/\s+/g, " ").trim().slice(0, MAX_TITULO) || "Gravação",
    em: new Date().toISOString(),
    duracaoS: Math.max(0, Math.min(86400, Math.round(Number(duracaoS) || 0))) || null,
    caracteres: corpo.length,
  };
  await gravar(`${base}/${id}.txt`, corpo, "text/plain; charset=utf-8");
  const itens = [item, ...(await lerIndice(base)).filter((i) => i && i.id !== id)];
  const sobra = itens.splice(MAX_ITENS);
  await gravarIndice(base, itens);
  for (const velho of sobra) await apagar(`${base}/${velho.id}.txt`);
  return item;
}

export async function listarTranscricoes({ aparelhoId }) {
  return await lerIndice(pasta(aparelhoId));
}

export async function lerTranscricao({ aparelhoId, id }) {
  if (!ID_VALIDO.test(String(id || ""))) return null;
  const base = pasta(aparelhoId);
  const item = (await lerIndice(base)).find((i) => i && i.id === id);
  if (!item) return null;
  const texto = await ler(`${base}/${id}.txt`);
  return texto === null ? null : { ...item, texto };
}

// 6.15.15: exclusão do cadastro: apaga todas as transcrições do aparelho no servidor (os textos e o índice).
export async function apagarTodasTranscricoes({ aparelhoId }) {
  const base = pasta(aparelhoId);
  const itens = await lerIndice(base);
  for (const i of itens) if (i && ID_VALIDO.test(String(i.id || ""))) await apagar(`${base}/${i.id}.txt`);
  await apagar(base + "/indice.json");
  return itens.length;
}

export async function apagarTranscricao({ aparelhoId, id }) {
  if (!ID_VALIDO.test(String(id || ""))) return false;
  const base = pasta(aparelhoId);
  const itens = await lerIndice(base);
  const resto = itens.filter((i) => i && i.id !== id);
  if (resto.length === itens.length) return false;
  await gravarIndice(base, resto);
  await apagar(`${base}/${id}.txt`);
  return true;
}
