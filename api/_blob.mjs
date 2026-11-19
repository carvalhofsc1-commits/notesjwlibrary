// Armazenamento dos arquivos privados do servidor (Bíblia e Perspicaz, transcrições, estatísticas, pedidos, memória da IA, S-34,
// cadastros, créditos e extrato), com as mesmas funções do @vercel/blob que o app usa: get, put, list e del.
// Onde fica, conforme a variável HOSPEDAGEM (desde a 6.10.87, para a migração ao Google Cloud):
//  - (vazia): Vercel Blob privado, como sempre (BLOB_READ_WRITE_TOKEN);
//  - "gcp": um bucket do Cloud Storage (GCS_BUCKET), com a identidade do Cloud Run (sem chave);
//  - "local": uma pasta no computador (DADOS_DIR, padrão .dados-local), só para testes.
// O "_" no nome impede a Vercel de publicar este arquivo como rota.
import * as vercelBlob from "@vercel/blob";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

const modo = () => String(process.env.HOSPEDAGEM || "").toLowerCase();

// Se há armazenamento de arquivos configurado (os módulos usavam só BLOB_READ_WRITE_TOKEN para saber).
export function blobConfigurado() {
  if (modo() === "gcp") return Boolean(process.env.GCS_BUCKET);
  if (modo() === "local") return true;
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// ---------- Google Cloud Storage ----------
let bucketPromessa = null;
function bucket() {
  if (!bucketPromessa) {
    bucketPromessa = import("@google-cloud/storage").then(({ Storage }) => new Storage().bucket(process.env.GCS_BUCKET));
    bucketPromessa.catch(() => { bucketPromessa = null; });
  }
  return bucketPromessa;
}

// ---------- Pasta local (testes) ----------
const pastaLocal = () => process.env.DADOS_DIR || ".dados-local";
const caminhoLocal = (nome) => join(pastaLocal(), ...String(nome).split("/"));

// O caminho guardado a partir de um endereço completo do Vercel Blob ou do próprio caminho.
function nomeDe(alvo) {
  const s = String(alvo || "");
  if (/^https?:\/\//i.test(s)) {
    try { return decodeURIComponent(new URL(s).pathname.replace(/^\/+/, "")); } catch { return s; }
  }
  return s.replace(/^\/+/, "");
}

// get(caminho, opções) → { statusCode: 200, stream } ou null quando o arquivo não existe (os módulos aceitam os dois casos).
export async function get(caminho, opcoes = {}) {
  if (modo() === "gcp") {
    try {
      const [conteudo] = await (await bucket()).file(nomeDe(caminho)).download();
      return { statusCode: 200, stream: conteudo };
    } catch (e) {
      if (e && (e.code === 404 || /no such object|not found/i.test(String(e.message)))) return null;
      throw e;
    }
  }
  if (modo() === "local") {
    try {
      return { statusCode: 200, stream: await readFile(caminhoLocal(nomeDe(caminho))) };
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  }
  return vercelBlob.get(caminho, opcoes);
}

// put(caminho, conteúdo, opções) — sempre sobrescreve, sem sufixo aleatório (como os módulos pedem).
export async function put(caminho, conteudo, opcoes = {}) {
  const nome = nomeDe(caminho);
  if (modo() === "gcp") {
    const idade = Number.isFinite(opcoes.cacheControlMaxAge) ? opcoes.cacheControlMaxAge : 0;
    await (await bucket()).file(nome).save(conteudo, {
      resumable: false,
      contentType: opcoes.contentType || "application/octet-stream",
      metadata: { cacheControl: idade > 0 ? `private, max-age=${idade}` : "no-store" },
    });
    return { pathname: nome, url: nome };
  }
  if (modo() === "local") {
    const arquivo = caminhoLocal(nome);
    await mkdir(dirname(arquivo), { recursive: true });
    await writeFile(arquivo, conteudo);
    return { pathname: nome, url: nome };
  }
  return vercelBlob.put(caminho, conteudo, opcoes);
}

// list({ prefix, limit }) → { blobs: [{ pathname, url, uploadedAt, size }], hasMore }.
export async function list(opcoes = {}) {
  const prefixo = String(opcoes.prefix || "");
  const limite = Number(opcoes.limit) || 1000;
  if (modo() === "gcp") {
    const [arquivos] = await (await bucket()).getFiles({ prefix: prefixo, maxResults: limite, autoPaginate: false });
    return {
      blobs: arquivos.map((f) => ({ pathname: f.name, url: f.name, uploadedAt: new Date(f.metadata.updated || f.metadata.timeCreated || 0), size: Number(f.metadata.size) || 0 })),
      hasMore: false,
    };
  }
  if (modo() === "local") {
    const raiz = pastaLocal();
    const blobs = [];
    const percorrer = async (pasta) => {
      let itens = [];
      try { itens = await readdir(pasta, { withFileTypes: true }); } catch { return; }
      for (const item of itens) {
        const completo = join(pasta, item.name);
        if (item.isDirectory()) await percorrer(completo);
        else {
          const nome = relative(raiz, completo).split(sep).join("/");
          if (!nome.startsWith(prefixo)) continue;
          const info = await stat(completo);
          blobs.push({ pathname: nome, url: nome, uploadedAt: info.mtime, size: info.size });
        }
      }
    };
    await percorrer(raiz);
    return { blobs: blobs.slice(0, limite), hasMore: blobs.length > limite };
  }
  return vercelBlob.list(opcoes);
}

// del(caminho ou endereço, ou uma lista deles). Arquivo que não existe é ignorado.
export async function del(alvos, opcoes = {}) {
  const lista = Array.isArray(alvos) ? alvos : [alvos];
  if (modo() === "gcp") {
    const b = await bucket();
    await Promise.all(lista.map((a) => b.file(nomeDe(a)).delete({ ignoreNotFound: true })));
    return;
  }
  if (modo() === "local") {
    await Promise.all(lista.map((a) => rm(caminhoLocal(nomeDe(a)), { force: true })));
    return;
  }
  return vercelBlob.del(alvos, opcoes);
}
