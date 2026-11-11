// Autenticação no Google Cloud com a conta de serviço, usada pela leitura em voz alta (api/voz.mjs) e pela transcrição de áudio (api/transcrever.mjs).
// O arquivo começa com "_" para a Vercel não publicá-lo como rota.
//
// O app aceita DUAS contas do Google Cloud ao mesmo tempo; o administrador escolhe qual usar (Ajustes → Conta do Google) e a outra fica de reserva:
//  - principal: GOOGLE_TTS_CREDENCIAIS (JSON da conta de serviço), GOOGLE_STT_BUCKET, GOOGLE_PROJECT_ID (opcional) e GOOGLE_TTS_API_KEY (opcional);
//  - alternativa: GOOGLE_ALT_CREDENCIAIS, GOOGLE_ALT_STT_BUCKET, GOOGLE_ALT_PROJECT_ID (opcional) e GOOGLE_ALT_TTS_API_KEY (opcional).
// A escolha fica no Global Config (chave "google_conta"). Se a conta escolhida não estiver configurada, vale a outra.
import { createSign } from "node:crypto";
import { gravarItem, lerItem } from "./_armazem.mjs";

export const URL_TOKEN = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";

const CHAVE = "google_conta";
const VALIDADE_MS = 20_000;
export const CONTAS = ["principal", "alternativa"];
const BUCKET_PADRAO = "notestyle-audio-512212"; // só para a conta principal, por compatibilidade
const VARIAVEIS = {
  principal: { credenciais: "GOOGLE_TTS_CREDENCIAIS", apiKey: "GOOGLE_TTS_API_KEY", bucket: "GOOGLE_STT_BUCKET", projeto: "GOOGLE_PROJECT_ID" },
  alternativa: { credenciais: "GOOGLE_ALT_CREDENCIAIS", apiKey: "GOOGLE_ALT_TTS_API_KEY", bucket: "GOOGLE_ALT_STT_BUCKET", projeto: "GOOGLE_ALT_PROJECT_ID" },
};

export function credenciaisDaConta(conta) {
  try {
    // O JSON é colado inteiro na Vercel (com quebras de linha e, às vezes, espaços ou BOM no começo).
    const c = JSON.parse(String(process.env[VARIAVEIS[conta].credenciais] || "").replace(/^\uFEFF/, "").trim());
    return c && typeof c.client_email === "string" && typeof c.private_key === "string" ? c : null;
  } catch {
    return null;
  }
}

// A conta que está valendo nesta requisição (definida por prepararConta, no começo de cada handler).
let contaEmUso = "principal";
export const contaAtual = () => contaEmUso;
export function credenciais() {
  return credenciaisDaConta(contaEmUso);
}

// Chave de API, bucket da transcrição e projeto da conta (a atual, se não for dita).
export function variaveisDaConta(conta = contaEmUso) {
  const v = VARIAVEIS[conta];
  const c = credenciaisDaConta(conta);
  return {
    apiKey: process.env[v.apiKey] || "",
    bucket: process.env[v.bucket] || (conta === "principal" ? BUCKET_PADRAO : ""),
    projeto: process.env[v.projeto] || (c && c.project_id) || "",
  };
}

let escolhaGuardada = null;
export async function lerContaEscolhida() {
  if (escolhaGuardada && Date.now() - escolhaGuardada.em < VALIDADE_MS) return escolhaGuardada.valor;
  let valor = "principal";
  try {
    const guardado = await lerItem(CHAVE);
    if (guardado && CONTAS.includes(guardado.conta)) valor = guardado.conta;
  } catch {
    // sem armazenamento: vale a principal
  }
  escolhaGuardada = { valor, em: Date.now() };
  return valor;
}

export async function gravarContaEscolhida(conta) {
  if (!CONTAS.includes(conta)) throw Object.assign(new Error("Conta inválida."), { status: 400 });
  if (!credenciaisDaConta(conta)) throw Object.assign(new Error("Esta conta ainda não está configurada nas variáveis do servidor."), { status: 400 });
  await gravarItem(CHAVE, { conta });
  escolhaGuardada = { valor: conta, em: Date.now() };
  return conta;
}

// Define a conta em uso: a escolhida pelo administrador; se ela não estiver configurada, a outra.
export async function prepararConta() {
  const escolhida = await lerContaEscolhida();
  const outra = escolhida === "principal" ? "alternativa" : "principal";
  contaEmUso = credenciaisDaConta(escolhida) ? escolhida : credenciaisDaConta(outra) ? outra : escolhida;
  return contaEmUso;
}

// O que o painel do administrador mostra de cada conta (nada secreto: só o e-mail da conta de serviço, o projeto e o bucket).
export async function descreverContas() {
  const contas = {};
  for (const conta of CONTAS) {
    const c = credenciaisDaConta(conta);
    const v = variaveisDaConta(conta);
    contas[conta] = { configurada: Boolean(c), email: c ? c.client_email : "", projeto: v.projeto, bucket: v.bucket, temChaveApi: Boolean(v.apiKey) };
  }
  return { escolhida: await lerContaEscolhida(), emUso: await prepararConta(), contas };
}

// Token de acesso da conta de serviço (vale 1 hora; é guardado por conta e renovado um pouco antes de vencer).
const tokensGuardados = {};
export async function tokenDeAcesso(conta = contaEmUso) {
  const c = credenciaisDaConta(conta);
  if (!c) return null;
  const guardado = tokensGuardados[conta];
  if (guardado && guardado.vence > Date.now() + 60_000) return guardado.token;
  const agora = Math.floor(Date.now() / 1000);
  const parte = (objeto) => Buffer.from(JSON.stringify(objeto)).toString("base64url");
  const conteudo =
    parte({ alg: "RS256", typ: "JWT" }) +
    "." +
    parte({ iss: c.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: URL_TOKEN, iat: agora, exp: agora + 3600 });
  const assinatura = createSign("RSA-SHA256").update(conteudo).sign(c.private_key, "base64url");
  const resposta = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: conteudo + "." + assinatura }),
    signal: AbortSignal.timeout(15_000),
  });
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    // resposta sem JSON
  }
  if (!resposta.ok || !dados || !dados.access_token) {
    const e = new Error((dados && (dados.error_description || dados.error)) || `HTTP ${resposta.status}`);
    e.status = resposta.status;
    throw e;
  }
  tokensGuardados[conta] = { token: dados.access_token, vence: Date.now() + (Number(dados.expires_in) || 3600) * 1000 };
  return tokensGuardados[conta].token;
}
