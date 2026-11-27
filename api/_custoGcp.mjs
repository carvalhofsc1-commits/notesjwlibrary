// Consumo do mês no Google Cloud (6.15.08), lido da exportação do faturamento para o BigQuery.
// O Google grava o consumo várias vezes por dia nas tabelas "gcp_billing_export_v1_<conta>" do conjunto de dados GCP_FATURAMENTO_DATASET
// (padrão: notestyle-512212.faturamento, criado em São Paulo). O total é o "Custo total" do painel de faturamento: custo menos economia
// (os créditos chegam com valor negativo). A consulta usa a conta pessoal (GOOGLE_ALT_CREDENCIAIS), que precisa dos papéis
// "Usuário de jobs do BigQuery" no projeto e "Leitor de dados do BigQuery" no conjunto de dados. Nada é gravado: só leitura.
import { credenciaisDaConta, tokenDeAcesso } from "./_googleToken.mjs";

const CONTA = "alternativa"; // a conta pessoal (a da empresa não exporta o faturamento para cá)
const DATASET = () => String(process.env.GCP_FATURAMENTO_DATASET || "notestyle-512212.faturamento").trim();
const LOCAL = () => String(process.env.GCP_FATURAMENTO_LOCAL || "southamerica-east1").trim();
let guardado = null; // 10 minutos: os dados do Google só mudam algumas vezes por dia

async function consultar(token, projeto, sql) {
  const r = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projeto}/queries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, useLegacySql: false, location: LOCAL(), timeoutMs: 20_000 }),
    signal: AbortSignal.timeout(30_000),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d) throw Object.assign(new Error((d && d.error && d.error.message) || `HTTP ${r.status}`), { status: r.status });
  const campos = (d.schema && d.schema.fields || []).map((f) => f.name);
  return (d.rows || []).map((linha) => Object.fromEntries(linha.f.map((c, i) => [campos[i], c.v])));
}

export async function lerCustoGcp(forcar = false) {
  if (!forcar && guardado && Date.now() - guardado.em < 10 * 60 * 1000) return guardado.valor;
  const dataset = DATASET();
  if (!/^[a-z0-9-]+\.[A-Za-z0-9_]+$/.test(dataset)) throw Object.assign(new Error("GCP_FATURAMENTO_DATASET inválido."), { status: 500 });
  if (!credenciaisDaConta(CONTA)) return { configurado: false, motivo: "A conta pessoal do Google não está configurada no servidor." };
  const projeto = dataset.split(".")[0];
  const token = await tokenDeAcesso(CONTA);
  const agora = new Date();
  // O mês da fatura no fuso de São Paulo (o painel do Google usa o fuso da conta de faturamento).
  const mes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora).replace("-", "");
  const tabela = `\`${dataset}.gcp_billing_export_v1_*\``;
  const creditos = "IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)";
  let linhas;
  try {
    linhas = await consultar(token, projeto, `
      SELECT service.description AS servico, currency AS moeda, SUM(cost) AS custo, SUM(${creditos}) AS economia, MAX(export_time) AS atualizado
      FROM ${tabela} WHERE invoice.month = '${mes}' GROUP BY servico, moeda`);
  } catch (e) {
    // Sem tabela ainda (exportação recém-ligada): o Google leva algumas horas para gravar a primeira vez.
    if (e.status === 404 || /not found|does not match any table/i.test(e.message)) return { configurado: true, semDados: true, mes };
    throw e;
  }
  const num = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const servicos = linhas
    .map((l) => ({ servico: l.servico || "Outros", custo: num(l.custo), economia: num(-Number(l.economia)), total: num(Number(l.custo) + Number(l.economia)) }))
    .filter((s) => s.custo || s.economia)
    .sort((a, b) => b.total - a.total);
  const atualizados = linhas.map((l) => Number(l.atualizado)).filter(Boolean);
  const valor = {
    configurado: true,
    semDados: !linhas.length,
    mes,
    moeda: (linhas[0] && linhas[0].moeda) || "BRL",
    custo: num(servicos.reduce((s, x) => s + x.custo, 0)),
    economia: num(servicos.reduce((s, x) => s + x.economia, 0)),
    total: num(servicos.reduce((s, x) => s + x.total, 0)),
    servicos,
    // export_time vem em segundos (com fração) desde 1970
    atualizadoEm: atualizados.length ? new Date(Math.max(...atualizados) * 1000).toISOString() : null,
  };
  guardado = { valor, em: Date.now() };
  return valor;
}
