// Servidor do NoteStyle fora da Vercel (Google Cloud Run, desde a 6.10.87; também serve para testes no computador).
// - Serve os arquivos do site (index.html, app.js, app.css, sw.js, dados/, vendor/…) com os mesmos cabeçalhos de segurança de vercel.json,
//   compactados (gzip ou brotli) e com ETag.
// - Recebe /api/<nome> e chama o handler de api/<nome>.mjs do mesmo jeito que a Vercel: req.body (JSON, formulário ou texto já lido),
//   req.query e um res com status(), json(), send() e setHeader().
// - CORS: o site pode ficar em outro endereço (Firebase Hosting, com www.notestyle.com.br) e chamar a API aqui; as origens aceitas são as
//   mesmas de origemPermitida (domínio próprio, localhost e ORIGENS_PERMITIDAS).
// Uso: PORT=8080 HOSPEDAGEM=gcp GCS_BUCKET=... node server.mjs   (ou HOSPEDAGEM=local para testar com uma pasta no lugar do bucket)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync, gzipSync, constants as zlibConst } from "node:zlib";
import { origemPermitida } from "./api/_comum.mjs";

const RAIZ = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORTA = Number(process.env.PORT) || 8080;
const LIMITE_CORPO = 10 * 1024 * 1024; // 10 MB (a Vercel aceitava 4,5 MB)

// Os mesmos cabeçalhos de vercel.json, em todas as respostas.
const CABECALHOS_SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
};

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".ico": "image/x-icon", ".pdf": "application/pdf", ".zip": "application/zip", ".woff": "font/woff", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".wasm": "application/wasm",
};
const COMPACTAVEIS = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".md", ".txt", ".xml", ".svg"]);

// O que nunca é servido como arquivo do site (código do servidor, ferramentas, documentos internos, dependências).
const PASTAS_PROIBIDAS = new Set(["api", "node_modules", "lojas", "avaliacao", "ferramentas", ".git", ".claude", ".dados-local"]);
const ARQUIVOS_PROIBIDOS = new Set(["server.mjs", "dockerfile", "cloudbuild.yaml", "package.json", "package-lock.json", "firebase.json", ".firebaserc", ".gcloudignore", ".dockerignore", ".gitignore"]);

function proibido(relativo) {
  const partes = relativo.split("/").filter(Boolean);
  if (!partes.length) return false;
  if (partes.some((p) => p.startsWith("."))) return true; // .env, .git e outros arquivos ocultos
  if (PASTAS_PROIBIDAS.has(partes[0])) return true;
  return partes.length === 1 && ARQUIVOS_PROIBIDOS.has(partes[0].toLowerCase());
}

const cacheArquivos = new Map(); // caminho -> { mtimeMs, size, corpo, gzip, br, etag }

async function servirArquivo(req, res, caminhoUrl) {
  let relativo;
  try {
    relativo = decodeURIComponent(caminhoUrl).replace(/^\/+/, "");
  } catch {
    return responder(res, 400, "Endereço inválido.");
  }
  if (!relativo || relativo.endsWith("/")) relativo += "index.html";
  const completo = normalize(join(RAIZ, relativo));
  if (!completo.startsWith(RAIZ + sep) || proibido(relativo.replace(/\\/g, "/"))) return responder(res, 404, "Não encontrado.");
  let info;
  try {
    info = await stat(completo);
    if (info.isDirectory()) return servirArquivo(req, res, "/" + relativo.replace(/\/?$/, "/"));
  } catch {
    return responder(res, 404, "Não encontrado.");
  }
  let item = cacheArquivos.get(completo);
  if (!item || item.mtimeMs !== info.mtimeMs || item.size !== info.size) {
    const corpo = await readFile(completo);
    item = { mtimeMs: info.mtimeMs, size: info.size, corpo, etag: `"${info.size.toString(36)}-${Math.round(info.mtimeMs).toString(36)}"` };
    cacheArquivos.set(completo, item);
  }
  const ext = extname(completo).toLowerCase();
  res.setHeader("Content-Type", TIPOS[ext] || "application/octet-stream");
  // Como na Vercel: o navegador sempre confere se o arquivo mudou (o service worker do app cuida do uso sem internet).
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("ETag", item.etag);
  res.setHeader("Vary", "Accept-Encoding");
  if (req.headers["if-none-match"] === item.etag) {
    res.statusCode = 304;
    return res.end();
  }
  let corpo = item.corpo;
  const aceita = String(req.headers["accept-encoding"] || "");
  if (COMPACTAVEIS.has(ext) && item.corpo.length > 1024) {
    if (/\bbr\b/.test(aceita)) {
      item.br ||= brotliCompressSync(item.corpo, { params: { [zlibConst.BROTLI_PARAM_QUALITY]: 9 } });
      corpo = item.br;
      res.setHeader("Content-Encoding", "br");
    } else if (/\bgzip\b/.test(aceita)) {
      item.gzip ||= gzipSync(item.corpo, { level: 9 });
      corpo = item.gzip;
      res.setHeader("Content-Encoding", "gzip");
    }
  }
  res.setHeader("Content-Length", corpo.length);
  res.statusCode = 200;
  res.end(req.method === "HEAD" ? undefined : corpo);
}

function responder(res, status, mensagem) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(mensagem);
}

// ---------- API ----------
const handlers = new Map(); // nome -> Promise<handler>
function carregarHandler(nome) {
  if (!handlers.has(nome)) {
    const p = import(pathToFileURL(join(RAIZ, "api", nome + ".mjs")).href).then((m) => m.default);
    p.catch(() => handlers.delete(nome));
    handlers.set(nome, p);
  }
  return handlers.get(nome);
}

function lerCorpo(req) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let total = 0;
    req.on("data", (pedaco) => {
      total += pedaco.length;
      if (total > LIMITE_CORPO) {
        rejeitar(Object.assign(new Error("Pedido grande demais."), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(pedaco);
    });
    req.on("end", () => resolver(Buffer.concat(partes)));
    req.on("error", rejeitar);
  });
}

// O corpo como a Vercel entrega: objeto para JSON e formulário, texto para o resto (vazio = undefined).
function interpretarCorpo(bruto, tipo) {
  if (!bruto.length) return undefined;
  const texto = bruto.toString("utf8");
  if (/application\/json/i.test(tipo)) return JSON.parse(texto);
  if (/application\/x-www-form-urlencoded/i.test(tipo)) return Object.fromEntries(new URLSearchParams(texto));
  if (/^text\//i.test(tipo)) return texto;
  return bruto;
}

function prepararResposta(res) {
  res.status = (codigo) => { res.statusCode = codigo; return res; };
  // Resposta já enviada: não tenta de novo (lançar o erro aqui, numa promessa solta, derrubava o servidor inteiro).
  const jaEnviada = () => {
    if (!res.headersSent && !res.writableEnded) return false;
    console.error("Servidor: resposta enviada duas vezes (a segunda foi ignorada)");
    return true;
  };
  res.json = (dados) => {
    if (jaEnviada()) return res;
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(dados));
    return res;
  };
  res.send = (dados) => {
    if (jaEnviada()) return res;
    if (dados !== null && typeof dados === "object" && !Buffer.isBuffer(dados)) return res.json(dados);
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", Buffer.isBuffer(dados) ? "application/octet-stream" : "text/plain; charset=utf-8");
    res.end(dados);
    return res;
  };
  return res;
}

function aplicarCors(req, res) {
  const origem = req.headers.origin;
  if (!origem || !origemPermitida(origem)) return;
  res.setHeader("Access-Control-Allow-Origin", origem);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

async function servirApi(req, res, url) {
  const nome = url.pathname.replace(/^\/api\/+/, "").replace(/\/+$/, "");
  // Só as rotas públicas: api/<nome>.mjs, sem "_" no começo (os outros são módulos internos, como na Vercel).
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(nome)) return prepararResposta(res).status(404).json({ erro: "Rota não encontrada." });
  aplicarCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  let handler;
  try {
    await stat(join(RAIZ, "api", nome + ".mjs"));
    handler = await carregarHandler(nome);
  } catch {
    return prepararResposta(res).status(404).json({ erro: "Rota não encontrada." });
  }
  prepararResposta(res);
  try {
    req.query = Object.fromEntries(url.searchParams);
    req.body = ["GET", "HEAD"].includes(req.method) ? undefined : interpretarCorpo(await lerCorpo(req), String(req.headers["content-type"] || ""));
  } catch (e) {
    return res.status(e && e.status ? e.status : 400).json({ erro: e && e.status === 413 ? "Pedido grande demais." : "Corpo do pedido inválido." });
  }
  try {
    await handler(req, res);
    // Como na Vercel, a resposta pode sair um pouco depois de a função terminar (ex.: a pesquisa e os esboços gravam o resultado antes de
    // enviar). Espera o envio por até 2 minutos e só então fecha, para a conexão não ficar presa (6.10.91).
    if (!res.writableEnded) {
      await new Promise((pronto) => {
        const limite = setTimeout(pronto, 120_000);
        const fim = () => { clearTimeout(limite); pronto(); };
        res.once("finish", fim);
        res.once("close", fim);
      });
      if (!res.writableEnded) res.end();
    }
  } catch (e) {
    console.error(`API ${nome}: erro não tratado`, e && (e.stack || e.message));
    if (!res.headersSent) res.status(500).json({ erro: "Erro interno do servidor." });
    else if (!res.writableEnded) res.end();
  }
}

const servidor = createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CABECALHOS_SEGURANCA)) res.setHeader(k, v);
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return responder(res, 400, "Endereço inválido.");
  }
  try {
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return await servirApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return responder(res, 405, "Método não permitido.");
    return await servirArquivo(req, res, url.pathname);
  } catch (e) {
    console.error("Servidor: falha", e && (e.stack || e.message));
    if (!res.headersSent) responder(res, 500, "Erro interno do servidor.");
    else if (!res.writableEnded) res.end();
  }
});
// Tarefas de IA levam até ~5 min: sem o limite padrão de 5 min do Node (o Cloud Run tem o seu, configurado no deploy).
servidor.requestTimeout = 0;
servidor.headersTimeout = 65_000;
servidor.keepAliveTimeout = 61_000;
servidor.listen(PORTA, () => console.log(`NoteStyle ouvindo na porta ${PORTA} (HOSPEDAGEM=${process.env.HOSPEDAGEM || "gcp"})`));
