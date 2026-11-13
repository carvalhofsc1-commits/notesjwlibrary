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

// Mês de faturamento ("2026-11"), no horário de Brasília (UTC-3).
export function mesDe(iso) {
  const t = new Date(iso || Date.now()).getTime();
  return new Date((Number.isFinite(t) ? t : Date.now()) - 3 * 3600 * 1000).toISOString().slice(0, 7);
}
const MAX_MESES = 14;

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

function aparelhoNovo(agora) {
  return {
    primeiro: agora,
    ultimo: agora,
    visitas: 0,
    consultas: 0,
    tokensIn: 0,
    tokensOut: 0,
    porTarefa: {},
    visitou: {},
    sessao: null,
    nivel: "normal",
    recursos: {},
  };
}

// Sessão = uso no mesmo dia civil do último acesso (recursos e tokens desse dia).
function sessaoDoDia(ap, agora) {
  const dia = diaDe(agora);
  if (!ap.sessao || ap.sessao.dia !== dia) {
    ap.sessao = { dia, em: agora, consultas: 0, tokensIn: 0, tokensOut: 0, porTarefa: {} };
  } else {
    ap.sessao.em = agora;
  }
  return ap.sessao;
}

function recursosLimpos(bruto) {
  const r = bruto && typeof bruto === "object" ? bruto : {};
  return {
    pesquisa: Boolean(r.pesquisa),
    dirigente: Boolean(r.dirigente),
    leitura: Boolean(r.leitura),
    texto: Boolean(r.texto),
    resumo: Boolean(r.resumo),
    s34: Boolean(r.s34),
  };
}

function aplicarPerfil(ap, { nivel, recursos } = {}) {
  if (nivel === "admin" || nivel === "normal") ap.nivel = nivel;
  if (recursos && typeof recursos === "object") ap.recursos = recursosLimpos(recursos);
}

// Uma fila por instância evita sobrescrever o JSON em gravações quase simultâneas nesta mesma máquina.
let fila = Promise.resolve();
function emFila(trabalho) {
  const proxima = fila.then(trabalho, trabalho);
  fila = proxima.catch(() => {});
  return proxima;
}

// Lê → altera → confere se ninguém gravou no meio → grava. Em conflito, tenta de novo em cima do JSON fresco
// (ping e uso de IA em instâncias diferentes da Vercel não se apagam mutuamente).
async function comDados(mutar) {
  if (!estatisticasConfiguradas()) return null;
  return emFila(async () => {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const bruto = (await lerBruto()) || vazio();
      const marca = bruto.atualizadoEm || "";
      const dados = podar(JSON.parse(JSON.stringify(bruto)));
      if (!dados.aparelhos) dados.aparelhos = {};
      if (!dados.dias) dados.dias = {};
      const resultado = mutar(dados) || null;
      const outra = (await lerBruto()) || vazio();
      if ((outra.atualizadoEm || "") !== marca) continue;
      await gravarBruto(podar(dados));
      return resultado;
    }
    console.error("Estatísticas: desistiu após conflitos de gravação");
    return null;
  });
}

// Visita do dia: a 1ª vez que o aparelho aparece conta como novo; se já existia, como recorrente (uma vez por dia).
// Opcional: nivel ("admin"|"normal") e recursos (quais códigos estão salvos no aparelho — só flags, sem as senhas).
export async function registrarPing(aparelhoId, perfil = {}) {
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
        ap = aparelhoNovo(agora);
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
      sessaoDoDia(ap, agora);
      aplicarPerfil(ap, perfil);
      return { ok: true, novo: eraNovo };
    });
  } catch (e) {
    console.error("Estatísticas: ping falhou", e && e.message);
    return { ok: false };
  }
}

// Consulta de IA (tokens da Anthropic) ou uso medido de voz (caracteres) e de transcrição de áudio (segundos). Fire-and-forget do handler.
// Além dos totais, cada aparelho guarda o uso por mês e por tarefa (meses["2026-11"].porTarefa), que alimenta o faturamento.
export async function registrarUsoIa({ aparelhoId, tarefa, entrada, saida, consultas, caracteres, segundos }) {
  const id = aparelhoIdLimpo(aparelhoId);
  const tokensIn = Math.max(0, Math.floor(Number(entrada) || 0));
  const tokensOut = Math.max(0, Math.floor(Number(saida) || 0));
  const car = Math.max(0, Math.floor(Number(caracteres) || 0));
  const seg = Math.max(0, Math.round(Number(segundos) || 0));
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
        ap = aparelhoNovo(agora);
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
      const sessao = sessaoDoDia(ap, agora);
      sessao.consultas = (sessao.consultas || 0) + n;
      sessao.tokensIn = (sessao.tokensIn || 0) + tokensIn;
      sessao.tokensOut = (sessao.tokensOut || 0) + tokensOut;
      if (!sessao.porTarefa) sessao.porTarefa = {};
      const st = sessao.porTarefa[nomeTarefa] || { n: 0, in: 0, out: 0 };
      st.n += n;
      st.in += tokensIn;
      st.out += tokensOut;
      sessao.porTarefa[nomeTarefa] = st;
      if (!ap.meses) ap.meses = {};
      const mes = mesDe(agora);
      if (!ap.meses[mes]) ap.meses[mes] = { porTarefa: {} };
      const mt = ap.meses[mes].porTarefa[nomeTarefa] || { n: 0, in: 0, out: 0, car: 0, seg: 0 };
      mt.n += n;
      mt.in += tokensIn;
      mt.out += tokensOut;
      mt.car = (mt.car || 0) + car;
      mt.seg = (mt.seg || 0) + seg;
      ap.meses[mes].porTarefa[nomeTarefa] = mt;
      Object.keys(ap.meses)
        .sort()
        .slice(0, -MAX_MESES)
        .forEach((m) => {
          delete ap.meses[m];
        });
      slot.consultas += n;
      slot.tokensIn += tokensIn;
      slot.tokensOut += tokensOut;
    });
  } catch (e) {
    console.error("Estatísticas: uso IA falhou", e && e.message);
  }
}

// Uso deste aparelho num mês: { porTarefa, meses } (meses = os que têm uso guardado, do mais novo ao mais antigo).
export async function consumoDoAparelho(aparelhoId, mes) {
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id || !estatisticasConfiguradas()) return { porTarefa: {}, meses: [] };
  const dados = (await lerBruto()) || vazio();
  const ap = (dados.aparelhos || {})[id];
  const meses = ap && ap.meses ? ap.meses : {};
  return {
    porTarefa: (meses[mes] && meses[mes].porTarefa) || {},
    meses: Object.keys(meses).sort().reverse(),
  };
}

// Vários aparelhos de uma vez (Administração de usuários): uma leitura só do Blob.
export async function mapaConsumoBrutoDoMes(aparelhoIds, mes) {
  const out = {};
  const ids = Array.isArray(aparelhoIds) ? aparelhoIds : [];
  if (!ids.length || !estatisticasConfiguradas()) return out;
  try {
    const dados = (await lerBruto()) || vazio();
    for (const bruto of ids) {
      const id = aparelhoIdLimpo(bruto);
      if (!id) continue;
      const meses = (dados.aparelhos && dados.aparelhos[id] && dados.aparelhos[id].meses) || {};
      out[id] = (meses[mes] && meses[mes].porTarefa) || {};
    }
  } catch {
    // sem estatísticas: mapa vazio
  }
  return out;
}

function somarDias(dias, chave) {
  return Object.values(dias || {}).reduce((n, d) => n + (Number(d[chave]) || 0), 0);
}

// IDs completos dos aparelhos já vistos (para aprovar de uma vez ao ligar a restrição).
export async function listarAparelhoIds() {
  if (!estatisticasConfiguradas()) return [];
  try {
    const dados = (await lerBruto()) || vazio();
    return Object.keys(dados.aparelhos || {});
  } catch {
    return [];
  }
}

// Nomes do cadastro (acesso-site.json). Leitura direta do Blob/pasta para não criar dependência circular com _acessoSite.mjs.
async function nomesDosAparelhos() {
  try {
    const dir = process.env.ACESSO_SITE_DIR || process.env.ESTATISTICAS_DIR;
    let bruto = null;
    if (dir) {
      const { readFile } = await import("node:fs/promises");
      try {
        bruto = JSON.parse(await readFile(`${dir}/acesso-site.json`, "utf8"));
      } catch {
        bruto = null;
      }
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      const resultado = await get("estatisticas/acesso-site.json", {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        useCache: false,
      }).catch(() => null);
      if (resultado && resultado.statusCode === 200) {
        bruto = JSON.parse(await new Response(resultado.stream).text());
      }
    }
    const mapa = Object.create(null);
    const aprovados = (bruto && bruto.aprovados) || {};
    for (const [id, a] of Object.entries(aprovados)) {
      const nome = String((a && a.nome) || "").trim();
      const sobrenome = String((a && a.sobrenome) || "").trim();
      let completo = `${nome} ${sobrenome}`.trim();
      // Cadastros antigos: "nome" já vinha completo.
      if (!sobrenome && nome) completo = nome;
      if (completo) mapa[id] = completo;
    }
    return mapa;
  } catch {
    return Object.create(null);
  }
}

function sessaoPublica(sessao) {
  if (!sessao || typeof sessao !== "object") return null;
  return {
    dia: sessao.dia || "",
    em: sessao.em || "",
    consultas: sessao.consultas || 0,
    tokensIn: sessao.tokensIn || 0,
    tokensOut: sessao.tokensOut || 0,
    tokens: (sessao.tokensIn || 0) + (sessao.tokensOut || 0),
    porTarefa: sessao.porTarefa || {},
  };
}

export async function mapaPerfilAparelhos() {
  if (!estatisticasConfiguradas()) return {};
  try {
    const dados = (await lerBruto()) || vazio();
    const mapa = Object.create(null);
    for (const [id, ap] of Object.entries(dados.aparelhos || {})) {
      mapa[id] = {
        nivel: ap.nivel === "admin" ? "admin" : "normal",
        recursos: recursosLimpos(ap.recursos),
        ultimo: ap.ultimo || "",
      };
    }
    return mapa;
  } catch {
    return {};
  }
}

export async function resumoEstatisticas() {
  if (!estatisticasConfiguradas()) return { configurado: false };
  const dados = (await lerBruto()) || vazio();
  const nomes = await nomesDosAparelhos();
  const hoje = diaDe(agoraIso());
  const lista = Object.entries(dados.aparelhos || {}).map(([id, ap]) => ({
    id: id.slice(0, 8),
    aparelhoIdCompleto: id,
    nome: nomes[id] || "",
    nivel: ap.nivel === "admin" ? "admin" : "normal",
    recursos: recursosLimpos(ap.recursos),
    primeiro: ap.primeiro || "",
    ultimo: ap.ultimo || "",
    visitas: ap.visitas || 0,
    consultas: ap.consultas || 0,
    tokensIn: ap.tokensIn || 0,
    tokensOut: ap.tokensOut || 0,
    tokens: (ap.tokensIn || 0) + (ap.tokensOut || 0),
    porTarefa: ap.porTarefa || {},
    ultimoAcesso: sessaoPublica(ap.sessao),
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
