// Cupom HMAC para a leitura em voz alta do texto diário: o servidor só sintetiza trechos
// cobertos por um cupom emitido ao carregar o texto do dia ou ao gerar os comentários da IA.
// O arquivo começa com "_" para a Vercel não publicá-lo como rota.
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_TEXTOS = 24;
const MAX_CHARS_TEXTO = 4000; // parágrafos do texto diário e comentários da IA

function segredo() {
  return process.env.CODIGO_ADMIN || process.env.CODIGO_ESTUDO || "";
}

export function normalizarParaCupom(texto) {
  return String(texto || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function assinatura(payload) {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}

// data: YYYY-MM-DD; textos: trechos que o cliente pode pedir para sintetizar (origem, antes das regras de voz).
export function emitirCupomVoz({ data, textos, horas = 6 } = {}) {
  if (!segredo() || typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";
  const lista = (Array.isArray(textos) ? textos : [])
    .map((t) => (typeof t === "string" ? t.replace(/\r\n?/g, "\n").trim().slice(0, MAX_CHARS_TEXTO) : ""))
    .filter(Boolean)
    .slice(0, MAX_TEXTOS);
  if (!lista.length) return "";
  const corpo = { data, textos: lista, exp: Date.now() + Math.max(1, Number(horas) || 6) * 3600_000 };
  const payload = Buffer.from(JSON.stringify(corpo), "utf8").toString("base64url");
  return payload + "." + assinatura(payload);
}

function origemCoberta(origem, textos) {
  const o = normalizarParaCupom(origem);
  if (!o) return false;
  const corpus = normalizarParaCupom(textos.join("\n"));
  if (corpus.includes(o)) return true;
  // Parte cortada: a origem da unidade inteira ainda precisa estar no corpus.
  return textos.some((t) => {
    const n = normalizarParaCupom(t);
    return n && (n.includes(o) || o.includes(n));
  });
}

// Confere cupom + data + origem. O texto falado (já com regras de pronúncia) não pode ser bem maior que a origem.
export function validarCupomVoz(cupom, { data, origem, texto } = {}) {
  if (!segredo()) return { ok: false, erro: "A leitura em voz alta ainda não está configurada no servidor." };
  if (typeof cupom !== "string" || !cupom.includes(".")) return { ok: false, erro: "Recarregue o texto do dia (ou gere os comentários de novo) para ouvir." };
  const ponto = cupom.indexOf(".");
  const payload = cupom.slice(0, ponto);
  const sig = cupom.slice(ponto + 1);
  let esperada;
  try {
    esperada = assinatura(payload);
  } catch {
    return { ok: false, erro: "Não foi possível conferir a autorização da leitura." };
  }
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, erro: "Recarregue o texto do dia (ou gere os comentários de novo) para ouvir." };
    }
  } catch {
    return { ok: false, erro: "Recarregue o texto do dia (ou gere os comentários de novo) para ouvir." };
  }
  let corpo;
  try {
    corpo = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, erro: "Recarregue o texto do dia (ou gere os comentários de novo) para ouvir." };
  }
  if (!corpo || corpo.data !== data || !Array.isArray(corpo.textos)) {
    return { ok: false, erro: "Recarregue o texto do dia (ou gere os comentários de novo) para ouvir." };
  }
  if (typeof corpo.exp !== "number" || corpo.exp < Date.now()) {
    return { ok: false, erro: "A autorização para ouvir expirou. Recarregue o texto do dia ou gere os comentários de novo." };
  }
  if (!origemCoberta(origem, corpo.textos)) {
    return { ok: false, erro: "Esse trecho não faz parte do texto do dia (nem dos comentários autorizados)." };
  }
  const falado = typeof texto === "string" ? texto : "";
  const origemStr = typeof origem === "string" ? origem : "";
  // A pronúncia pode alongar um pouco; texto bem maior que a origem seria abuso com origem curta do corpus.
  if (falado.length > Math.max(Math.ceil(origemStr.length * 2.5), 80)) {
    return { ok: false, erro: "Trecho de áudio não corresponde ao texto autorizado." };
  }
  return { ok: true };
}
