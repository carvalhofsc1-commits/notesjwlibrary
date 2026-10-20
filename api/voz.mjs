// Leitura em voz alta: o app manda um trecho do texto (já em letras comuns, sem emojis) e o servidor pede o áudio à
// API Text-to-Speech do Google Cloud. A chave fica só aqui, na variável secreta GOOGLE_TTS_API_KEY da Vercel; o
// navegador recebe apenas o áudio (MP3). Cada pedido custa créditos do Google, por isso exige o código de acesso da IA.
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";

const URL_TTS = process.env.GOOGLE_TTS_URL || "https://texttospeech.googleapis.com/v1beta1/text:synthesize";
// Modelo Gemini (lê seguindo a instrução de estilo) e a voz. Dá para trocar na Vercel sem mudar o código.
const MODELO = process.env.GOOGLE_TTS_MODELO || "gemini-3.1-flash-tts-preview";
const VOZ = process.env.GOOGLE_TTS_VOZ || "Achernar";
// Se o modelo Gemini falhar (por exemplo, a prévia ficar indisponível), a voz Chirp 3 HD de mesmo nome lê o trecho,
// só que sem a instrução de estilo.
const VOZ_RESERVA = process.env.GOOGLE_TTS_VOZ_RESERVA || `pt-BR-Chirp3-HD-${VOZ}`;
const MAX_CARACTERES = 2000; // o app divide textos maiores em partes
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

async function sintetizar(corpo) {
  const resposta = await fetch(URL_TTS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_TTS_API_KEY },
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }
  if (!origemPermitida(req.headers.origin)) return erro(res, 403, "Origem não permitida.");
  if (!process.env.GOOGLE_TTS_API_KEY) return erro(res, 503, "A leitura em voz alta ainda não está configurada no servidor.");
  if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "O código de acesso da IA ainda não está configurado no servidor.");

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (!textosIguais(body.codigo, process.env.CODIGO_ESTUDO)) return erro(res, 403, "Código de acesso inválido.");

  const texto = typeof body.texto === "string" ? body.texto.replace(/\r\n?/g, "\n").trim() : "";
  if (!texto) return erro(res, 400, "Não há texto para ler.");
  if (texto.length > MAX_CARACTERES) return erro(res, 400, `Trecho grande demais (máximo de ${MAX_CARACTERES} caracteres por parte).`);

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip)) return erro(res, 429, "Muitas leituras seguidas. Tente de novo daqui a pouco.");

  // A instrução de estilo é editável na tela dos prompts ("Leitura em voz alta").
  const P = await carregarPrompts();
  const inicio = Date.now();
  let audio = null;
  let usada = MODELO + " / " + VOZ;
  try {
    audio = await sintetizar({
      input: { text: texto, prompt: P.leituraVoz },
      voice: { languageCode: "pt-BR", name: VOZ, modelName: MODELO },
      audioConfig: { audioEncoding: "MP3" },
    });
  } catch (e) {
    console.error("Voz: o modelo Gemini falhou", e.status, e.message);
    // A reserva (Chirp 3 HD) precisa só da Text-to-Speech API; o Gemini também depende da Vertex AI API (Agent
    // Platform) ligada no projeto. Por isso qualquer falha do Gemini tenta a reserva, menos a cota esgotada.
    let falha = e;
    if (e.status !== 429) {
      try {
        usada = VOZ_RESERVA;
        audio = await sintetizar({
          input: { text: texto },
          voice: { languageCode: "pt-BR", name: VOZ_RESERVA },
          audioConfig: { audioEncoding: "MP3" },
        });
      } catch (e2) {
        console.error("Voz: a voz reserva também falhou", e2.status, e2.message);
        falha = e2;
      }
    }
    if (!audio) {
      const mensagem =
        falha.status === 403 || falha.status === 401
          ? "O Google recusou a chave da leitura em voz alta. Confira a chave e se a Cloud Text-to-Speech API está ativa."
          : falha.status === 429
            ? "A cota da leitura em voz alta no Google acabou por agora. Tente mais tarde."
            : "Não consegui gerar o áudio agora. Tente de novo.";
      return erro(res, 502, mensagem);
    }
  }

  console.log("Voz:", JSON.stringify({ caracteres: texto.length, voz: usada, segundos: Math.round((Date.now() - inicio) / 100) / 10 }));
  return res.status(200).json({ audio, tipo: "audio/mpeg", voz: usada });
}
