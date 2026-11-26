// Armazenamento dos arquivos privados do servidor (Bíblia e Perspicaz, transcrições, estatísticas, pedidos, memória da IA, S-34,
// cadastros, créditos e extrato), com as funções get, put, list e del.
// Onde fica, conforme a variável HOSPEDAGEM:
//  - "gcp" (Cloud Run): um bucket do Cloud Storage (GCS_BUCKET), com a identidade do Cloud Run (sem chave);
//  - "local": uma pasta no computador (DADOS_DIR, padrão .dados-local), só para testes.
// Sem HOSPEDAGEM vale "gcp". O "_" no nome mantém este arquivo fora das rotas públicas (/api/<nome>).
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

const modo = () => (String(process.env.HOSPEDAGEM || "").toLowerCase() === "local" ? "local" : "gcp");

// Se há armazenamento de arquivos configurado.
export function blobConfigurado() {
  if (modo() === "local") return true;
  return Boolean(process.env.GCS_BUCKET);
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

// ---------- Gravação sem perder o que outro pedido gravou (6.14.16) ----------
// get(caminho, { comVersao: true }) devolve também "versao"; put(caminho, conteúdo, { seVersao }) só grava se o arquivo ainda está nessa
// versão. Se outro pedido gravou no meio (ou o arquivo está sendo gravado depressa demais), lança um erro de conflito: quem chamou lê de
// novo e refaz. No Cloud Storage a versão é a "generation" do objeto (vale entre todas as instâncias); na pasta local, o hash do conteúdo.
export const ehConflito = (e) => Boolean(e && e.conflito);
const conflito = () => Object.assign(new Error("O arquivo mudou enquanto era gravado."), { conflito: true });
const inexistente = (e) => Boolean(e && (e.code === 404 || /no such object|not found/i.test(String(e.message))));
const versaoLocal = (conteudo) => createHash("sha1").update(conteudo).digest("hex");
const filasLocais = new Map();
function emFilaLocal(nome, tarefa) {
  const proxima = (filasLocais.get(nome) || Promise.resolve()).then(tarefa, tarefa);
  filasLocais.set(nome, proxima.catch(() => {}));
  return proxima;
}

async function lerComVersao(nome) {
  const b = await bucket();
  for (let i = 0; i < 4; i++) {
    let versao = "";
    try {
      const [dados] = await b.file(nome).getMetadata();
      versao = String(dados.generation);
      const [conteudo] = await b.file(nome, { generation: versao }).download();
      return { statusCode: 200, stream: conteudo, versao };
    } catch (e) {
      if (!inexistente(e)) throw e;
      if (!versao) return null; // não existe
      // foi gravado de novo entre as duas leituras: lê outra vez
    }
  }
  throw conflito();
}

// get(caminho, opções) → { statusCode: 200, stream } ou null quando o arquivo não existe (os módulos aceitam os dois casos).
export async function get(caminho, opcoes = {}) {
  if (modo() === "gcp") {
    if (opcoes.comVersao) return lerComVersao(nomeDe(caminho));
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
      const stream = await readFile(caminhoLocal(nomeDe(caminho)));
      return { statusCode: 200, stream, ...(opcoes.comVersao ? { versao: versaoLocal(stream) } : {}) };
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  }
}

// put(caminho, conteúdo, opções) — sobrescreve, sem sufixo aleatório (como os módulos pedem). Com opcoes.seVersao, só se não mudou.
export async function put(caminho, conteudo, opcoes = {}) {
  const nome = nomeDe(caminho);
  if (modo() === "gcp") {
    const idade = Number.isFinite(opcoes.cacheControlMaxAge) ? opcoes.cacheControlMaxAge : 0;
    try {
      await (await bucket()).file(nome).save(conteudo, {
        resumable: false,
        contentType: opcoes.contentType || "application/octet-stream",
        metadata: { cacheControl: idade > 0 ? `private, max-age=${idade}` : "no-store" },
        ...(opcoes.seVersao ? { preconditionOpts: { ifGenerationMatch: opcoes.seVersao } } : {}),
      });
    } catch (e) {
      // 412: outro pedido gravou antes; 429: gravações demais no mesmo arquivo neste instante
      if (opcoes.seVersao && e && (e.code === 412 || e.code === 429)) throw conflito();
      throw e;
    }
    return { pathname: nome, url: nome };
  }
  if (modo() === "local") {
    const arquivo = caminhoLocal(nome);
    await emFilaLocal(nome, async () => {
      if (opcoes.seVersao) {
        const atual = await readFile(arquivo).catch(() => null);
        if (!atual || versaoLocal(atual) !== opcoes.seVersao) throw conflito();
      }
      await mkdir(dirname(arquivo), { recursive: true });
      await writeFile(arquivo, conteudo);
    });
    return { pathname: nome, url: nome };
  }
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
}
