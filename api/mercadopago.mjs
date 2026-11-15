// Crédito por Pix (Mercado Pago), chamado pelo app: "criar" gera o Pix com o valor; "consultar" confere o pagamento e credita quando aprovado.
import { erro, origemPermitida } from "./_comum.mjs";
import { acessoSiteConfigurado } from "./_acessoSite.mjs";
import { confirmarPagamento, criarPix, mercadoPagoConfigurado, PIX_MAXIMO, PIX_MINIMO } from "./_mercadopago.mjs";

// Limite simples por aparelho (em memória, por instância): evita rajadas de Pix criados sem pagar.
const criados = new Map();
function limiteCriar(aparelhoId) {
  const agora = Date.now();
  const lista = (criados.get(aparelhoId) || []).filter((t) => agora - t < 10 * 60000);
  if (lista.length >= 5) return false;
  lista.push(agora);
  criados.set(aparelhoId, lista);
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }
  if (!origemPermitida(req.headers.origin)) return erro(res, 403, "Origem não permitida.");
  const corpo = req.body && typeof req.body === "object" ? req.body : {};
  const acao = String(corpo.acao || "");
  try {
    if (acao === "estado") {
      return res.status(200).json({ configurado: mercadoPagoConfigurado() && acessoSiteConfigurado(), minimo: PIX_MINIMO, maximo: PIX_MAXIMO });
    }
    if (!acessoSiteConfigurado()) return erro(res, 503, "O armazenamento privado (Blob) ainda não está configurado no servidor.");
    if (acao === "criar") {
      if (!limiteCriar(String(corpo.aparelhoId || ""))) return erro(res, 429, "Muitos Pix gerados em pouco tempo. Aguarde alguns minutos.");
      const r = await criarPix({ aparelhoId: corpo.aparelhoId, valor: corpo.valor });
      if (r.erro) return erro(res, r.status || 400, r.erro);
      return res.status(200).json(r);
    }
    if (acao === "consultar") {
      const r = await confirmarPagamento(corpo.pagamentoId, corpo.aparelhoId);
      if (r.erro) return erro(res, r.status || 400, r.erro);
      return res.status(200).json(r);
    }
    return erro(res, 400, "Ação desconhecida.");
  } catch (e) {
    console.error("MercadoPago: falhou", e && e.message);
    return erro(res, 502, "Não consegui falar com o Mercado Pago agora. Tente de novo.");
  }
}
