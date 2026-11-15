// Aviso (webhook) do Mercado Pago: "pagamento criado/atualizado". Não confia no conteúdo: só usa o número do pagamento e o relê na API
// do Mercado Pago (confirmarPagamento), que credita uma vez só. Sempre responde 200 quando o aviso foi entendido, para o Mercado Pago não reenviar.
import { assinaturaValida, confirmarPagamento, mercadoPagoConfigurado } from "./_mercadopago.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  try {
    const corpo = req.body && typeof req.body === "object" ? req.body : {};
    const consulta = req.query || {};
    const tipo = String(corpo.type || consulta.type || consulta.topic || "");
    const dataId = String((corpo.data && corpo.data.id) || consulta["data.id"] || consulta.id || "");
    if (tipo !== "payment" || !/^\d{3,20}$/.test(dataId)) return res.status(200).json({ ok: true, ignorado: true });
    if (!mercadoPagoConfigurado()) return res.status(503).json({ erro: "Não configurado." });
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET && !assinaturaValida(req.headers, dataId)) {
      console.warn("MercadoPago: assinatura do aviso não conferiu (o pagamento é relido na API de qualquer forma).");
    }
    const r = await confirmarPagamento(dataId);
    if (r.erro) {
      console.error("MercadoPago: aviso não processado", r.erro);
      return res.status(r.status && r.status >= 500 ? 500 : 200).json({ erro: r.erro }); // 500 faz o Mercado Pago tentar de novo
    }
    return res.status(200).json({ ok: true, estado: r.estado });
  } catch (e) {
    console.error("MercadoPago: aviso falhou", e && e.message);
    return res.status(500).json({ erro: "Falha ao processar." });
  }
}
