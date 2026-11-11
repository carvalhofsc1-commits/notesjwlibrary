// Cliente da IA de texto. O app fala com a IA por três caminhos, à escolha do administrador (tela de prompts):
//  - "gemini": o Gemini do Google Cloud (Vertex AI), na conta do Google da empresa; um adaptador (abaixo) converte o pedido no formato da
//    Anthropic, que o resto do código usa, para o do Gemini e a resposta de volta;
//  - "anthropic": a API direta da Anthropic (ANTHROPIC_API_KEY);
//  - "vertex": o Claude do Google Cloud (Vertex AI / Plataforma do agente), cobrado na conta do Google da empresa. Usa a mesma conta de
//    serviço da voz e da transcrição (GOOGLE_TTS_CREDENCIAIS; se faltar, a de reserva) e não precisa de chave nova.
// O SDK da Anthropic é o mesmo nos dois: no Vertex ele só troca o endereço, o token e o corpo do pedido (função fetchVertex), então todo o
// resto do código (messages.parse, esforço, respostas estruturadas) continua igual.
// Variáveis opcionais na Vercel: GOOGLE_VERTEX_REGIAO (Claude) e GOOGLE_GEMINI_REGIAO (Gemini), padrão "global" (ex.: "us-east5", "europe-west1").
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { credenciaisDaConta, tokenDeAcesso, variaveisDaConta } from "./_googleToken.mjs";
import { lerConfigIa, provedorAtual } from "./_iaConfig.mjs";

const VERSAO_VERTEX = "vertex-2023-10-16";

const regiaoVertex = () => String(process.env.GOOGLE_VERTEX_REGIAO || "global").trim() || "global";
// A conta do Google do Claude: a principal (a da empresa) e, se ela não existir, a de reserva.
const contaVertex = () => (credenciaisDaConta("principal") ? "principal" : credenciaisDaConta("alternativa") ? "alternativa" : null);

export function urlDoModeloVertex(modelo, stream = false) {
  const conta = contaVertex();
  const projeto = conta ? variaveisDaConta(conta).projeto : "";
  const regiao = regiaoVertex();
  const host = regiao === "global" ? "aiplatform.googleapis.com" : `${regiao}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projeto}/locations/${regiao}/publishers/anthropic/models/${modelo}:${stream ? "streamRawPredict" : "rawPredict"}`;
}

// Troca o pedido do SDK ("/v1/messages", chave x-api-key, modelo no corpo) pelo formato da Vertex (modelo na URL, token do Google).
async function fetchVertex(url, init = {}) {
  const conta = contaVertex();
  if (!conta) throw Object.assign(new Error("A conta do Google (GOOGLE_TTS_CREDENCIAIS) não está configurada no servidor."), { status: 503 });
  const token = await tokenDeAcesso(conta);
  if (!token) throw Object.assign(new Error("Não consegui autenticar na conta do Google."), { status: 503 });
  const corpo = JSON.parse(typeof init.body === "string" ? init.body : "{}");
  const modelo = corpo.model;
  delete corpo.model;
  corpo.anthropic_version = VERSAO_VERTEX;
  const headers = new Headers(init.headers);
  headers.delete("x-api-key");
  headers.delete("anthropic-version");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(urlDoModeloVertex(modelo, Boolean(corpo.stream)), { ...init, headers, body: JSON.stringify(corpo) });
}

// ---------- Gemini (Vertex AI) ----------
// O resto do app conversa com um "cliente" no formato do SDK da Anthropic (messages.create / messages.parse, content, usage, stop_reason,
// parsed_output). Este cliente aceita esse mesmo pedido e o traduz para o generateContent do Gemini; a resposta volta no formato da Anthropic.
const regiaoGemini = () => String(process.env.GOOGLE_GEMINI_REGIAO || "global").trim() || "global";
const NIVEL_RACIOCINIO = { low: "LOW", medium: "MEDIUM", high: "HIGH" };
const BLOQUEIOS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT"]);

function partesGemini(conteudo) {
  if (typeof conteudo === "string") return [{ text: conteudo }];
  const partes = [];
  for (const b of Array.isArray(conteudo) ? conteudo : []) {
    if (b && b.type === "text" && typeof b.text === "string") partes.push({ text: b.text });
    else if (b && (b.type === "image" || b.type === "audio") && b.source && b.source.type === "base64") partes.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
    // blocos de ferramenta ou de raciocínio da Anthropic não existem no Gemini: ficam de fora
  }
  return partes.length ? partes : [{ text: "" }];
}

function corpoGemini(p) {
  const sistema = typeof p.system === "string" ? p.system : (Array.isArray(p.system) ? p.system.map((b) => (b && b.text) || "").join("\n\n") : "");
  const formato = p.output_config && p.output_config.format;
  const esforco = p.output_config && p.output_config.effort;
  const desligado = p.thinking && p.thinking.type === "disabled";
  const nivel = desligado ? "LOW" : NIVEL_RACIOCINIO[esforco];
  const geracao = { maxOutputTokens: p.max_tokens || 4096 };
  if (formato && formato.schema) {
    geracao.responseMimeType = "application/json";
    geracao.responseJsonSchema = formato.schema;
  }
  if (nivel) geracao.thinkingConfig = { thinkingLevel: nivel };
  const corpo = {
    contents: (p.messages || []).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: partesGemini(m.content) })),
    generationConfig: geracao,
  };
  if (sistema) corpo.systemInstruction = { parts: [{ text: sistema }] };
  // A leitura de páginas pela IA (web_fetch da Anthropic) vira a ferramenta de leitura de endereços do Gemini.
  if (Array.isArray(p.tools) && p.tools.some((t) => t && /web_fetch/.test(t.type || t.name || ""))) corpo.tools = [{ urlContext: {} }];
  return corpo;
}

function respostaDaAnthropic(d, formato) {
  const cand = d.candidates && d.candidates[0];
  const partes = (cand && cand.content && cand.content.parts) || [];
  const texto = partes.filter((x) => !x.thought && typeof x.text === "string").map((x) => x.text).join("");
  const fim = cand && cand.finishReason;
  const recusado = Boolean((d.promptFeedback && d.promptFeedback.blockReason) || (fim && BLOQUEIOS.has(fim)) || (!cand && !texto));
  const parada = recusado ? "refusal" : fim === "MAX_TOKENS" ? "max_tokens" : "end_turn";
  const um = d.usageMetadata || {};
  const pensou = um.thoughtsTokenCount || 0;
  const r = {
    id: "gemini",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: texto }],
    stop_reason: parada,
    usage: { input_tokens: um.promptTokenCount || 0, output_tokens: (um.candidatesTokenCount || 0) + pensou, output_tokens_details: { thinking_tokens: pensou } },
  };
  if (formato && typeof formato.parse === "function") r.parsed_output = parada === "end_turn" && texto ? formato.parse(texto) : null;
  return r;
}

async function chamarGemini(p, { maxRetries = 0, timeout = 90_000 } = {}, comEsquema) {
  const conta = contaVertex();
  if (!conta) throw Object.assign(new Error("A conta do Google (GOOGLE_TTS_CREDENCIAIS) não está configurada no servidor."), { status: 503 });
  const token = await tokenDeAcesso(conta);
  if (!token) throw Object.assign(new Error("Não consegui autenticar na conta do Google."), { status: 503 });
  const projeto = variaveisDaConta(conta).projeto;
  const regiao = regiaoGemini();
  const host = regiao === "global" ? "aiplatform.googleapis.com" : `${regiao}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${projeto}/locations/${regiao}/publishers/google/models/${p.model}:generateContent`;
  let corpo = corpoGemini(p);
  let ultimo = null;
  for (let tentativa = 0; tentativa <= maxRetries + 1; tentativa++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeout),
      });
      const texto = await resp.text();
      let dados = null;
      try {
        dados = JSON.parse(texto);
      } catch {
        // resposta sem JSON
      }
      if (resp.ok && dados) return respostaDaAnthropic(dados, comEsquema);
      const mensagem = (dados && dados.error && dados.error.message) || texto.slice(0, 300) || `HTTP ${resp.status}`;
      ultimo = Object.assign(new Error(`${resp.status} ${mensagem}`), { status: resp.status });
      // Alguns modelos não aceitam o nível de raciocínio pedido: tenta de novo sem ele.
      if (resp.status === 400 && /thinking/i.test(mensagem) && corpo.generationConfig.thinkingConfig) {
        const { thinkingConfig, ...resto } = corpo.generationConfig;
        corpo = { ...corpo, generationConfig: resto };
        continue;
      }
      if (![429, 500, 502, 503, 504].includes(resp.status) || tentativa >= maxRetries) throw ultimo;
    } catch (e) {
      if (e === ultimo) throw e;
      ultimo = e;
      if (tentativa >= maxRetries) throw e;
    }
    await new Promise((ok) => setTimeout(ok, 800 * (tentativa + 1)));
  }
  throw ultimo;
}

function clienteGemini(opcoes) {
  const formatoDe = (p) => (p.output_config && p.output_config.format) || null;
  const mensagens = {
    create: (p) => chamarGemini(p, opcoes, null),
    parse: (p) => chamarGemini(p, opcoes, formatoDe(p)),
  };
  return { messages: mensagens, beta: { messages: mensagens } };
}

export function criarClienteIa(opcoes = {}, provedor = provedorAtual()) {
  if (provedor === "gemini") return clienteGemini(opcoes);
  if (provedor === "vertex") return new Anthropic({ ...opcoes, apiKey: "vertex", baseURL: "https://aiplatform.googleapis.com", fetch: fetchVertex });
  return new Anthropic(opcoes);
}

// A IA do provedor escolhido está configurada no servidor? (lê a escolha do administrador antes)
export async function iaDisponivel() {
  await lerConfigIa();
  return provedorAtual() === "anthropic" ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(contaVertex());
}

export const erroSemIa = () =>
  provedorAtual() === "anthropic"
    ? "O recurso de IA ainda não está configurado no servidor."
    : "A IA pelo Google Cloud ainda não está configurada no servidor (conta de serviço do Google).";

// Teste do administrador: um pedido simples e um com resposta estruturada (como o app usa), no provedor e modelo dados.
export async function testarIa(provedor, modelo, esforco) {
  const semEsforco = /haiku-4|sonnet-4-5|-3-/.test(modelo);
  const resultado = { provedor, modelo, regiao: provedor === "vertex" ? regiaoVertex() : provedor === "gemini" ? regiaoGemini() : undefined };
  const rodar = async (fn) => {
    const inicio = Date.now();
    try {
      await fn();
      return { ok: true, ms: Date.now() - inicio };
    } catch (e) {
      return { ok: false, ms: Date.now() - inicio, erro: String((e && e.message) || e).slice(0, 400), status: e && e.status };
    }
  };
  if (provedor === "anthropic" ? !process.env.ANTHROPIC_API_KEY : !contaVertex()) {
    return { ...resultado, simples: { ok: false, erro: "Este provedor não está configurado no servidor." } };
  }
  const client = criarClienteIa({ maxRetries: 0, timeout: 60_000 }, provedor);
  resultado.simples = await rodar(async () => {
    await client.messages.create({ model: modelo, max_tokens: 60, messages: [{ role: "user", content: "Responda apenas: ok" }] });
  });
  const Esquema = z.object({ resposta: z.string() });
  resultado.estruturada = await rodar(async () => {
    const r = await client.messages.parse({
      model: modelo,
      max_tokens: 400,
      messages: [{ role: "user", content: 'Devolva {"resposta": "ok"}.' }],
      output_config: { format: zodOutputFormat(Esquema), ...(semEsforco ? {} : { effort: esforco || "low" }) },
    });
    if (!r.parsed_output) throw new Error("A resposta não veio no formato pedido.");
  });
  return resultado;
}
