// Estatísticas de acesso e uso da IA (só administrador lê o resumo).
// Cada aparelho tem um UUID anônimo enviado pelo navegador. Visitas (ping) e consultas/tokens da IA
// ficam num JSON no Vercel Blob PRIVADO: "estatisticas/uso.json".
// ESTÁTISTICAS_DIR (só testes locais) troca o Blob por uma pasta.
import { get, put } from "@vercel/blob";

const NOME = "estatisticas/uso.json";
const MAX_APARELHOS = 3000;
const MAX_DIAS = 120;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function estatisticasConfiguradas() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.ESTATISTICAS_DIR);
}

export function aparelhoIdLimpo(valor) {
  const id = String(valor || "").trim().toLowerCase();
  return ID_RE.test(id) ? id : "";
}

function diaDe(iso) {
  return String(iso || "").slice(0, 10);
}

function agoraIso() {
  return new Date().toISOString();
}

function vazio() {
  return { versao: 1, atualizadoEm: agoraIso(), aparelhos: {}, dias: {} };
}

async function lerBruto() {
  if (process.env.ESTATISTICAS_DIR) {
    const { readFile } = await import("node:fs/promises");
    try {
      return JSON.parse(await readFile(`${process.env.ESTATISTICAS_DIR}/uso.json`, "utf8"));
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  }
  const resultado = await get(NOME, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN, useCache: false }).catch((e) => {
    if (e && /not\s*found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw e;
  });
  if (!resultado || resultado.statusCode !== 200) return null;
  return JSON.parse(await new Response(resultado.stream).text());
}

async function gravarBruto(dados) {
  dados.atualizadoEm = agoraIso();
  const texto = JSON.stringify(dados);
  if (process.env.ESTATISTICAS_DIR) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(process.env.ESTATISTICAS_DIR, { recursive: true });
    await writeFile(`${process.env.ESTATISTICAS_DIR}/uso.json`, texto, "utf8");
    return;
  }
  await put(NOME, texto, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

function podar(dados) {
  const ids = Object.keys(dados.aparelhos || {});
  if (ids.length > MAX_APARELHOS) {
    ids
      .sort((a, b) => String(dados.aparelhos[a].ultimo || "").localeCompare(String(dados.aparelhos[b].ultimo || "")))
      .slice(0, ids.length - MAX_APARELHOS)
      .forEach((id) => {
        delete dados.aparelhos[id];
      });
  }
  const dias = Object.keys(dados.dias || {}).sort();
  if (dias.length > MAX_DIAS) {
    dias.slice(0, dias.length - MAX_DIAS).forEach((d) => {
      delete dados.dias[d];
    });
  }
  return dados;
}

function diaSlot(dados, dia) {
  if (!dados.dias[dia]) dados.dias[dia] = { novos: 0, recorrentes: 0, consultas: 0, tokensIn: 0, tokensOut: 0 };
  return dados.dias[dia];
}

// Uma fila por instância evita sobrescrever o JSON em gravações quase simultâneas nesta mesma máquina.
let fila = Promise.resolve();
function emFila(trabalho) {
  const proxima = fila.then(trabalho, trabalho);
  fila = proxima.catch(() => {});
  return proxima;
}

async function comDados(mutar) {
  if (!estatisticasConfiguradas()) return null;
  return emFila(async () => {
    const dados = podar((await lerBruto()) || vazio());
    if (!dados.aparelhos) dados.aparelhos = {};
    if (!dados.dias) dados.dias = {};
    const resultado = mutar(dados) || null;
    await gravarBruto(podar(dados));
    return resultado;
  });
}

// Visita do dia: a 1ª vez que o aparelho aparece conta como novo; se já existia, como recorrente (uma vez por dia).
export async function registrarPing(aparelhoId) {
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id) return { ok: false };
  try {
    return await comDados((dados) => {
      const agora = agoraIso();
      const dia = diaDe(agora);
      const slot = diaSlot(dados, dia);
      let ap = dados.aparelhos[id];
      const eraNovo = !ap;
      if (!ap) {
        ap = { primeiro: agora, ultimo: agora, visitas: 0, consultas: 0, tokensIn: 0, tokensOut: 0, porTarefa: {}, visitou: {} };
        dados.aparelhos[id] = ap;
      }
      if (!ap.visitou) ap.visitou = {};
      if (!ap.visitou[dia]) {
        ap.visitou[dia] = true;
        ap.visitas = (ap.visitas || 0) + 1;
        if (eraNovo) slot.novos += 1;
        else slot.recorrentes += 1;
        // Guarda só os últimos 14 dias de marcas de visita no aparelho (o histórico diário global já tem os totais).
        Object.keys(ap.visitou)
          .sort()
          .slice(0, -14)
          .forEach((d) => {
            delete ap.visitou[d];
          });
      }
      ap.ultimo = agora;
      return { ok: true, novo: eraNovo };
    });
  } catch (e) {
    console.error("Estatísticas: ping falhou", e && e.message);
    return { ok: false };
  }
}

// Consulta de IA (tokens da Anthropic). Fire-and-forget do handler.
export async function registrarUsoIa({ aparelhoId, tarefa, entrada, saida, consultas }) {
  const id = aparelhoIdLimpo(aparelhoId);
  const tokensIn = Math.max(0, Math.floor(Number(entrada) || 0));
  const tokensOut = Math.max(0, Math.floor(Number(saida) || 0));
  const n = Math.max(1, Math.floor(Number(consultas) || 1));
  if (!id || (!tokensIn && !tokensOut && n < 1)) return;
  const nomeTarefa = String(tarefa || "ia")
    .trim()
    .slice(0, 40) || "ia";
  try {
    await comDados((dados) => {
      const agora = agoraIso();
      const dia = diaDe(agora);
      const slot = diaSlot(dados, dia);
      let ap = dados.aparelhos[id];
      if (!ap) {
        ap = { primeiro: agora, ultimo: agora, visitas: 0, consultas: 0, tokensIn: 0, tokensOut: 0, porTarefa: {}, visitou: {} };
        dados.aparelhos[id] = ap;
        slot.novos += 1;
        ap.visitou[dia] = true;
        ap.visitas = 1;
      }
      ap.ultimo = agora;
      ap.consultas = (ap.consultas || 0) + n;
      ap.tokensIn = (ap.tokensIn || 0) + tokensIn;
      ap.tokensOut = (ap.tokensOut || 0) + tokensOut;
      if (!ap.porTarefa) ap.porTarefa = {};
      const t = ap.porTarefa[nomeTarefa] || { n: 0, in: 0, out: 0 };
      t.n += n;
      t.in += tokensIn;
      t.out += tokensOut;
      ap.porTarefa[nomeTarefa] = t;
      slot.consultas += n;
      slot.tokensIn += tokensIn;
      slot.tokensOut += tokensOut;
    });
  } catch (e) {
    console.error("Estatísticas: uso IA falhou", e && e.message);
  }
}

function somarDias(dias, chave) {
  return Object.values(dias || {}).reduce((n, d) => n + (Number(d[chave]) || 0), 0);
}

export async function resumoEstatisticas() {
  if (!estatisticasConfiguradas()) return { configurado: false };
  const dados = (await lerBruto()) || vazio();
  const hoje = diaDe(agoraIso());
  const lista = Object.entries(dados.aparelhos || {}).map(([id, ap]) => ({
    id: id.slice(0, 8),
    primeiro: ap.primeiro || "",
    ultimo: ap.ultimo || "",
    visitas: ap.visitas || 0,
    consultas: ap.consultas || 0,
    tokensIn: ap.tokensIn || 0,
    tokensOut: ap.tokensOut || 0,
    tokens: (ap.tokensIn || 0) + (ap.tokensOut || 0),
    porTarefa: ap.porTarefa || {},
  }));
  lista.sort((a, b) => b.tokens - a.tokens || b.consultas - a.consultas || String(b.ultimo).localeCompare(String(a.ultimo)));
  const diasOrdenados = Object.keys(dados.dias || {})
    .sort()
    .slice(-14)
    .map((d) => ({ dia: d, ...(dados.dias[d] || {}) }));
  const hojeSlot = dados.dias[hoje] || { novos: 0, recorrentes: 0, consultas: 0, tokensIn: 0, tokensOut: 0 };
  return {
    configurado: true,
    atualizadoEm: dados.atualizadoEm || "",
    totais: {
      aparelhos: lista.length,
      consultas: lista.reduce((n, a) => n + a.consultas, 0),
      tokensIn: lista.reduce((n, a) => n + a.tokensIn, 0),
      tokensOut: lista.reduce((n, a) => n + a.tokensOut, 0),
      novosHistorico: somarDias(dados.dias, "novos"),
      recorrentesHistorico: somarDias(dados.dias, "recorrentes"),
    },
    hoje: hojeSlot,
    dias: diasOrdenados,
    aparelhos: lista.slice(0, 100),
  };
}
