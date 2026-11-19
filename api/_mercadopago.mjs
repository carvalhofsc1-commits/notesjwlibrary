// Crédito por Pix com confirmação automática pelo Mercado Pago (API de Pagamentos).
// O app pede um Pix com valor e a referência do aparelho; quando o dinheiro cai, o Mercado Pago avisa (webhook) e/ou o app consulta.
// NUNCA se confia no aviso nem no aplicativo: antes de creditar, o servidor lê o pagamento direto na API do Mercado Pago (com o token secreto)
// e só credita se estiver aprovado, for Pix, em reais, e a referência for de um aparelho identificado. Cada pagamento credita uma vez só.
// Variáveis na Vercel: MERCADOPAGO_ACCESS_TOKEN (obrigatória) e MERCADOPAGO_WEBHOOK_SECRET (confere a assinatura do aviso).
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { aparelhoIdentificado, creditarPagamentoPix } from "./_acessoSite.mjs";
import { aparelhoIdLimpo } from "./_estatisticas.mjs";

const API = "https://api.mercadopago.com";
export const PIX_MINIMO = 1;
export const PIX_MAXIMO = 500;
const MINUTOS_VALIDADE = 30;
// Endereço do aviso (webhook) que vai em cada Pix. No Google Cloud (6.10.87) o site fica no Firebase e a API no Cloud Run:
// lá a variável MERCADOPAGO_URL_AVISO traz "https://<endereço do Cloud Run>/api/mercadopago-webhook".
const URL_AVISO = process.env.MERCADOPAGO_URL_AVISO || "https://www.notestyle.com.br/api/mercadopago-webhook";
const PREFIXO_REFERENCIA = "ns-";

export function mercadoPagoConfigurado() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

const cabecalhos = (extra = {}) => ({
  Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
  ...extra,
});

// "10,5" / "R$ 10.50" / 10.5 → número com 2 casas (NaN se não entender).
export function valorPix(valor) {
  let s = String(valor ?? "").replace(/r\$/gi, "").replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// Validade do Pix com o fuso de Brasília (o Mercado Pago pede data com deslocamento), por exemplo 2026-11-14T22:30:00.000-03:00.
function validadeIso(minutos) {
  const t = new Date(Date.now() + minutos * 60000 - 3 * 3600 * 1000);
  return `${t.toISOString().slice(0, 23)}-03:00`;
}

async function pedidoMp(caminho, opcoes = {}) {
  const resposta = await fetch(`${API}${caminho}`, opcoes);
  let dados = null;
  try { dados = await resposta.json(); } catch { /* sem JSON */ }
  return { ok: resposta.ok, status: resposta.status, dados };
}

// Cria o Pix: devolve o número do pagamento, o código copia e cola e a imagem do QR.
export async function criarPix({ aparelhoId, valor }) {
  if (!mercadoPagoConfigurado()) return { erro: "O pagamento por Pix ainda não está configurado no servidor.", status: 503 };
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id || !(await aparelhoIdentificado(id))) return { erro: "Só usuários identificados podem adicionar crédito.", status: 403 };
  const n = valorPix(valor);
  if (!Number.isFinite(n) || n < PIX_MINIMO || n > PIX_MAXIMO) {
    return { erro: `Informe um valor entre R$ ${PIX_MINIMO},00 e R$ ${PIX_MAXIMO},00.`, status: 400 };
  }
  const corpo = {
    transaction_amount: n,
    description: "Crédito NoteStyle",
    payment_method_id: "pix",
    // O Mercado Pago exige um e-mail do pagador; usa um genérico do app (os dados do usuário não são enviados).
    payer: { email: process.env.MERCADOPAGO_PAYER_EMAIL || "pagador@notestyle.com.br" },
    external_reference: PREFIXO_REFERENCIA + id,
    notification_url: URL_AVISO,
    date_of_expiration: validadeIso(MINUTOS_VALIDADE),
  };
  const r = await pedidoMp("/v1/payments", { method: "POST", headers: cabecalhos({ "X-Idempotency-Key": randomUUID() }), body: JSON.stringify(corpo) });
  const dados = r.dados || {};
  const info = dados.point_of_interaction && dados.point_of_interaction.transaction_data;
  if (!r.ok || !dados.id || !info || !info.qr_code) {
    console.error("MercadoPago: não criou o Pix", r.status, JSON.stringify(dados).slice(0, 400));
    return { erro: "Não consegui gerar o Pix agora. Tente de novo em instantes.", status: 502 };
  }
  return { ok: true, pagamentoId: String(dados.id), valor: n, codigo: info.qr_code, qrBase64: info.qr_code_base64 || "", minutos: MINUTOS_VALIDADE };
}

// Lê o pagamento no Mercado Pago e, se estiver aprovado e válido, credita (uma vez só). Devolve o estado para o app.
// aparelhoEsperado (opcional): quando o app consulta, o pagamento precisa ser DESTE aparelho.
export async function confirmarPagamento(pagamentoId, aparelhoEsperado = "") {
  if (!mercadoPagoConfigurado()) return { erro: "O pagamento por Pix ainda não está configurado no servidor.", status: 503 };
  const pag = String(pagamentoId || "").trim();
  if (!/^\d{3,20}$/.test(pag)) return { erro: "Pagamento inválido.", status: 400 };
  const r = await pedidoMp(`/v1/payments/${pag}`, { method: "GET", headers: cabecalhos() });
  if (!r.ok || !r.dados) return { erro: "Não consegui consultar o pagamento agora.", status: 502 };
  const p = r.dados;
  const referencia = String(p.external_reference || "");
  if (!referencia.startsWith(PREFIXO_REFERENCIA)) return { ok: true, estado: "ignorado" }; // pagamento de outra coisa na mesma conta
  const aparelho = aparelhoIdLimpo(referencia.slice(PREFIXO_REFERENCIA.length));
  if (!aparelho) return { ok: true, estado: "ignorado" };
  const esperado = aparelhoIdLimpo(aparelhoEsperado);
  if (esperado && esperado !== aparelho) return { erro: "Este pagamento não é deste aparelho.", status: 403 };
  if (p.status === "pending" || p.status === "in_process" || p.status === "authorized") return { ok: true, estado: "pendente" };
  if (p.status !== "approved") return { ok: true, estado: p.status === "expired" || p.status === "cancelled" ? "expirado" : "recusado" };
  if (p.payment_method_id !== "pix" || p.currency_id !== "BRL") return { ok: true, estado: "ignorado" };
  const valor = Math.round(Number(p.transaction_amount) * 100) / 100;
  if (!Number.isFinite(valor) || valor < PIX_MINIMO || valor > PIX_MAXIMO) return { ok: true, estado: "ignorado" };
  const credito = await creditarPagamentoPix({ aparelhoId: aparelho, pagamentoId: pag, valor });
  if (!credito || credito.erro) return { erro: (credito && credito.erro) || "Não consegui creditar agora.", status: 500 };
  return { ok: true, estado: "aprovado", valor: credito.valor, creditos: credito.creditos, jaCreditado: Boolean(credito.jaCreditado), aparelhoId: aparelho };
}

// Assinatura do aviso (cabeçalho x-signature: "ts=...,v1=..."): HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a chave
// secreta do webhook. Serve de conferência extra: o crédito nunca depende dela, porque o pagamento é sempre relido na API.
export function assinaturaValida(cabecalhosReq, dataId) {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) return false;
  const assinatura = String(cabecalhosReq["x-signature"] || "");
  const partes = Object.fromEntries(assinatura.split(",").map((p) => p.trim().split("=").map((x) => x.trim())).filter((p) => p.length === 2));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifesto = `id:${id};request-id:${cabecalhosReq["x-request-id"] || ""};ts:${partes.ts};`;
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");
  try {
    const a = Buffer.from(esperado, "hex");
    const b = Buffer.from(partes.v1, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
