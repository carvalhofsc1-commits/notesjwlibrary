// Texto diário da tela Início: o app manda a data do aparelho (o dia de quem lê, não o do servidor) e recebe a data por
// extenso, o texto temático, o comentário e a citação da publicação, lidos no wol.jw.org (api/_wol.mjs). Exige o código
// de acesso da IA, para o servidor não virar uma passagem aberta para o conteúdo do site.
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { lerTextoDiario } from "./_wol.mjs";

const LIMITE_POR_HORA = 120; // pedidos por IP
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }
  if (!origemPermitida(req.headers.origin)) return erro(res, 403, "Origem não permitida.");
  if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "O código de pesquisa ainda não está configurado no servidor.");

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (!textosIguais(body.codigo, process.env.CODIGO_ESTUDO)) return erro(res, 403, "Código de pesquisa inválido.");

  const m = typeof body.data === "string" ? body.data.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const [ano, mes, dia] = m ? m.slice(1).map(Number) : [];
  const valida = m && ano >= 2000 && ano <= 2100 && new Date(Date.UTC(ano, mes - 1, dia)).getUTCDate() === dia;
  if (!valida) return erro(res, 400, "Data inválida.");

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimite(ip)) return erro(res, 429, "Muitos pedidos seguidos. Tente de novo daqui a pouco.");

  try {
    const texto = await lerTextoDiario(ano, mes, dia);
    if (!texto) return erro(res, 404, "O wol.jw.org ainda não tem o texto diário dessa data.");
    return res.status(200).json(texto);
  } catch (e) {
    console.error("Texto diário: não consegui ler o wol.jw.org", body.data, e.message);
    return erro(res, 502, "Não consegui ler o texto diário no wol.jw.org agora. Tente de novo em instantes.");
  }
}
