// Autenticação no Google Cloud com a conta de serviço (variável GOOGLE_TTS_CREDENCIAIS), usada pela leitura em voz alta (api/voz.mjs) e
// pela transcrição de áudio (api/transcrever.mjs). O arquivo começa com "_" para a Vercel não publicá-lo como rota.
import { createSign } from "node:crypto";

export const URL_TOKEN = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";

export function credenciais() {
  try {
    // O JSON é colado inteiro na Vercel (com quebras de linha e, às vezes, espaços ou BOM no começo).
    const c = JSON.parse(String(process.env.GOOGLE_TTS_CREDENCIAIS || "").replace(/^﻿/, "").trim());
    return c && typeof c.client_email === "string" && typeof c.private_key === "string" ? c : null;
  } catch {
    return null;
  }
}

// Token de acesso da conta de serviço (vale 1 hora; é guardado e renovado um pouco antes de vencer).
let tokenGuardado = null;
export async function tokenDeAcesso() {
  const c = credenciais();
  if (!c) return null;
  if (tokenGuardado && tokenGuardado.vence > Date.now() + 60_000) return tokenGuardado.token;
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
  tokenGuardado = { token: dados.access_token, vence: Date.now() + (Number(dados.expires_in) || 3600) * 1000 };
  return tokenGuardado.token;
}
