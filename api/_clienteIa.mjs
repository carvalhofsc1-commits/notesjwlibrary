// Cliente da IA de texto. O app fala com o Claude por dois caminhos, à escolha do administrador (tela de prompts):
//  - "anthropic": a API direta da Anthropic (ANTHROPIC_API_KEY);
//  - "vertex": o Claude do Google Cloud (Vertex AI / Plataforma do agente), cobrado na conta do Google da empresa. Usa a mesma conta de
//    serviço da voz e da transcrição (GOOGLE_TTS_CREDENCIAIS; se faltar, a de reserva) e não precisa de chave nova.
// O SDK da Anthropic é o mesmo nos dois: no Vertex ele só troca o endereço, o token e o corpo do pedido (função fetchVertex), então todo o
// resto do código (messages.parse, esforço, respostas estruturadas) continua igual.
// Variáveis opcionais na Vercel: GOOGLE_VERTEX_REGIAO (padrão "global"; ex.: "us-east5", "europe-west1").
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

export function criarClienteIa(opcoes = {}, provedor = provedorAtual()) {
  if (provedor === "vertex") return new Anthropic({ ...opcoes, apiKey: "vertex", baseURL: "https://aiplatform.googleapis.com", fetch: fetchVertex });
  return new Anthropic(opcoes);
}

// A IA do provedor escolhido está configurada no servidor? (lê a escolha do administrador antes)
export async function iaDisponivel() {
  await lerConfigIa();
  return provedorAtual() === "vertex" ? Boolean(contaVertex()) : Boolean(process.env.ANTHROPIC_API_KEY);
}

export const erroSemIa = () =>
  provedorAtual() === "vertex"
    ? "O Claude pelo Google Cloud ainda não está configurado no servidor (conta de serviço do Google)."
    : "O recurso de IA ainda não está configurado no servidor.";

// Teste do administrador: um pedido simples e um com resposta estruturada (como o app usa), no provedor e modelo dados.
export async function testarIa(provedor, modelo, esforco) {
  const semEsforco = /haiku-4|sonnet-4-5|-3-/.test(modelo);
  const resultado = { provedor, modelo, regiao: provedor === "vertex" ? regiaoVertex() : undefined };
  const rodar = async (fn) => {
    const inicio = Date.now();
    try {
      await fn();
      return { ok: true, ms: Date.now() - inicio };
    } catch (e) {
      return { ok: false, ms: Date.now() - inicio, erro: String((e && e.message) || e).slice(0, 400), status: e && e.status };
    }
  };
  if (provedor === "vertex" ? !contaVertex() : !process.env.ANTHROPIC_API_KEY) {
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
