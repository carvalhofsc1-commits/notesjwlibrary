// Leitura em voz alta: o app manda um trecho do texto (já em letras comuns, sem emojis) e o servidor pede o áudio à
// API Text-to-Speech do Google Cloud. As credenciais ficam só aqui, em variáveis secretas da Vercel; o navegador recebe
// apenas o áudio (MP3). Cada pedido custa créditos do Google, por isso exige o código de acesso da IA.
//  - GOOGLE_TTS_CREDENCIAIS: o JSON da conta de serviço (com o papel "Usuário da Plataforma de Agentes"). As vozes
//    Gemini exigem essa identidade; uma chave de API comum é recusada (403 aiplatform.endpoints.predict).
//  - GOOGLE_TTS_API_KEY: a chave de API, que basta para a voz Chirp 3 HD (a reserva).
// Modelo, voz, tom, altura e instruções extras vêm da configuração do administrador (api/_vozConfig.mjs).
import { createSign } from "node:crypto";
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";
import { ALTURAS, MODELOS_VOZ, TONS, lerConfigVoz, validarConfigVoz } from "./_vozConfig.mjs";

const URL_TTS = process.env.GOOGLE_TTS_URL || "https://texttospeech.googleapis.com/v1beta1/text:synthesize";
const URL_TOKEN = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";

function credenciais() {
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
async function tokenDeAcesso() {
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

const MAX_CARACTERES = 2000; // o app divide textos maiores em partes (o Google aceita até 4.000 bytes por parte)
const LIMITE_POR_HORA = 150; // pedidos por IP (a proteção de custo de verdade é o alerta de orçamento no Google)

const acessos = new Map();

function excedeuLimite(ip) {
  const agora = Date.now();
  const lista = (acessos.get(ip) || []).filter((t) => agora - t < 60 * 60 * 1000);
  const passou = lista.length >= LIMITE_POR_HORA;
  if (!passou) lista.push(agora);
  acessos.set(ip, lista);
  if (acessos.size > 5000) acessos.clear();
  return passou;
}

// token: o da conta de serviço (vozes Gemini); sem ele, vai a chave de API.
async function sintetizar(corpo, token) {
  const autorizacao = token ? { Authorization: `Bearer ${token}` } : { "X-Goog-Api-Key": process.env.GOOGLE_TTS_API_KEY };
  const resposta = await fetch(URL_TTS, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...autorizacao },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(60_000),
  });
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    // resposta sem JSON
  }
  if (!resposta.ok || !dados || typeof dados.audioContent !== "string") {
    const e = new Error((dados && dados.error && dados.error.message) || `HTTP ${resposta.status}`);
    e.status = resposta.status;
    throw e;
  }
  return dados.audioContent;
}

// Instrução de leitura do Gemini: a base editável ("Leitura em voz alta") + tom + altura + instruções extras.
function instrucaoDeLeitura(P, c) {
  const frases = P.frases.voz;
  const tom = TONS.find((t) => t.id === c.tom);
  const altura = ALTURAS.find((a) => a.id === c.altura);
  return [
    P.leituraVoz,
    tom && frases[tom.item],
    altura && altura.item && frases[altura.item],
    c.extra && String(frases["Instruções do administrador"] || "").split("{{texto}}").join(c.extra),
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }
  if (!origemPermitida(req.headers.origin)) return erro(res, 403, "Origem não permitida.");
  const temChave = Boolean(process.env.GOOGLE_TTS_API_KEY);
  if (!temChave && !credenciais()) return erro(res, 503, "A leitura em voz alta ainda não está configurada no servidor.");
  if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "O código de acesso da IA ainda não está configurado no servidor.");

  const body = req.body && typeof req.body === "object" ? req.body : {};
  // O exemplo do painel do administrador usa as escolhas ainda não salvas; só com o código de administrador.
  const exemplo = Boolean(body.exemplo && process.env.CODIGO_ADMIN && textosIguais(body.codigoAdmin, process.env.CODIGO_ADMIN));
  if (!exemplo && !textosIguais(body.codigo, process.env.CODIGO_ESTUDO)) return erro(res, 403, "Código de acesso inválido.");

  const texto = typeof body.texto === "string" ? body.texto.replace(/\r\n?/g, "\n").trim() : "";
  if (!texto) return erro(res, 400, "Não há texto para ler.");
  if (texto.length > MAX_CARACTERES) return erro(res, 400, `Trecho grande demais (máximo de ${MAX_CARACTERES} caracteres por parte).`);

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip)) return erro(res, 429, "Muitas leituras seguidas. Tente de novo daqui a pouco.");

  const config = exemplo ? validarConfigVoz(body.exemplo) : await lerConfigVoz();
  const modelo = MODELOS_VOZ.find((m) => m.id === config.modelo) || MODELOS_VOZ[0];
  const vozChirp = `pt-BR-Chirp3-HD-${config.voz}`;
  const pedidoChirp = { input: { text: texto }, voice: { languageCode: "pt-BR", name: vozChirp }, audioConfig: { audioEncoding: "MP3" } };
  const inicio = Date.now();
  let audio = null;
  let usada = vozChirp;
  let gemini = false;

  // Token da conta de serviço: necessário para o Gemini; se falhar, segue com a chave de API (e a reserva Chirp).
  let token = null;
  if (modelo.gemini || !temChave) {
    try {
      token = await tokenDeAcesso();
    } catch (e) {
      console.error("Voz: o Google recusou a conta de serviço", e.status, e.message);
    }
  }

  if (modelo.gemini) {
    try {
      const P = await carregarPrompts();
      audio = await sintetizar(
        {
          input: { text: texto, prompt: instrucaoDeLeitura(P, config) },
          voice: { languageCode: "pt-BR", name: config.voz, modelName: modelo.modelo },
          audioConfig: { audioEncoding: "MP3" },
        },
        token,
      );
      usada = modelo.modelo + " / " + config.voz;
      gemini = true;
    } catch (e) {
      console.error("Voz: o modelo Gemini falhou", e.status, e.message);
      // A reserva (Chirp 3 HD) precisa só da Text-to-Speech API; o Gemini também precisa da permissão da Vertex AI
      // (Agent Platform). Cota esgotada não adianta tentar de novo.
      if (e.status === 429) return erro(res, 502, "A cota da leitura em voz alta no Google acabou por agora. Tente mais tarde.");
    }
  }

  if (!audio) {
    try {
      audio = await sintetizar(pedidoChirp, temChave ? null : token);
    } catch (e) {
      console.error("Voz: a voz Chirp 3 HD falhou", e.status, e.message);
      const mensagem =
        e.status === 403 || e.status === 401
          ? "O Google recusou a chave da leitura em voz alta. Confira a chave e se a Cloud Text-to-Speech API está ativa."
          : e.status === 429
            ? "A cota da leitura em voz alta no Google acabou por agora. Tente mais tarde."
            : "Não consegui gerar o áudio agora. Tente de novo.";
      return erro(res, 502, mensagem);
    }
  }

  console.log("Voz:", JSON.stringify({ caracteres: texto.length, voz: usada, exemplo, segundos: Math.round((Date.now() - inicio) / 100) / 10 }));
  return res.status(200).json({ audio, tipo: "audio/mpeg", voz: usada, gemini });
}
