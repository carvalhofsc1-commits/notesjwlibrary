// Consumo de IA e faturamento: o consumo mensal de cada aparelho (api/_estatisticas.mjs) multiplicado pelos preços que o administrador cadastra,
// mais a chave PIX (e o código "copia e cola" do PIX, que o app transforma em QR code).
// Preços e PIX ficam no Global Config (chave "faturamento_config"). Valores em reais.
//  - IA de texto e esboços: reais por 1 milhão de tokens, com um preço para a entrada e outro para a saída.
//  - Leitura em voz alta: reais por 1.000 caracteres lidos.
//  - Áudio em texto (transcrição): reais por minuto de áudio.
import { codigoDoDirigente, textosIguais } from "./_comum.mjs";
import { gravarItem, lerItem } from "./_armazem.mjs";
import { consumoDoAparelho, mesDe } from "./_estatisticas.mjs";
import { MODELOS_IA, iaDaTarefa, lerConfigIa } from "./_iaConfig.mjs";
import { MODELOS_VOZ, lerConfigVoz } from "./_vozConfig.mjs";

const CHAVE = "faturamento_config";
const VALIDADE_MS = 20_000;

export const CATEGORIAS = [
  { id: "texto", nome: "IA de texto", unidade: "1 milhão de tokens", campos: ["entrada", "saida"] },
  { id: "esbocos", nome: "Esboços e discursos (a IA mais cara)", unidade: "1 milhão de tokens", campos: ["entrada", "saida"] },
  { id: "voz", nome: "Leitura em voz alta", unidade: "1.000 caracteres", campos: ["mil"] },
  { id: "audio", nome: "Áudio em texto (transcrição)", unidade: "minuto de áudio", campos: ["minuto"] },
];

export const PRECOS_PADRAO = {
  texto: { entrada: 0, saida: 0 },
  esbocos: { entrada: 0, saida: 0 },
  voz: { mil: 0 },
  audio: { minuto: 0 },
};

// acesso: basta um dos códigos (o do dirigente para o S-34 vale junto com o do S-34).
export const RECURSOS = [
  { id: "formatar", rotulo: "Formatar com IA (Formatar e Anotações)", cat: "texto", acesso: ["pesquisa"], tarefas: ["formatar", "aplicacao", "anotacoes-formatar", "anotacoes-perguntas"] },
  { id: "sentinela", rotulo: "A Sentinela (comentários do estudo)", cat: "texto", acesso: ["pesquisa"], tarefas: ["sentinela", "estudo"] },
  { id: "ebc", rotulo: "Estudo Bíblico de Congregação", cat: "texto", acesso: ["pesquisa"], tarefas: ["ebc"] },
  { id: "joias", rotulo: "Joias espirituais", cat: "texto", acesso: ["pesquisa"], tarefas: ["joias"] },
  { id: "texto-diario", rotulo: "Comentários do texto diário", cat: "texto", acesso: ["pesquisa"], tarefas: ["texto-diario-comentarios"] },
  { id: "dirigir", rotulo: "Preparar para dirigir (perguntas e recapitulação)", cat: "esbocos", acesso: ["dirigente"], tarefas: ["estudo-perguntas", "estudo-recap", "ebc-dirigente"] },
  { id: "esbocos", rotulo: "Esboços: Tesouros, discurso curto e outros", cat: "esbocos", acesso: ["dirigente"], tarefas: ["tesouros", "discurso", "outros"] },
  { id: "publico", rotulo: "Esboço do discurso público (S-34)", cat: "esbocos", acesso: ["s34"], tarefas: ["publico"] },
  { id: "leitura-biblia", rotulo: "Resumo da leitura diária da Bíblia", cat: "texto", acesso: ["resumo"], tarefas: ["leitura-biblia"] },
  { id: "audio-ia", rotulo: "Áudio em texto: correção, nomes e resumo (IA)", cat: "texto", acesso: ["texto"], tarefas: ["audio-correcao", "audio-nomes", "audio-resumo"] },
  { id: "voz", rotulo: "Leitura em voz alta", cat: "voz", acesso: ["leitura", "pesquisa"], tarefas: ["voz"] },
  { id: "audio", rotulo: "Áudio em texto: transcrição", cat: "audio", acesso: ["texto"], tarefas: ["audio"] },
];
const OUTROS = { id: "outros", rotulo: "Outros usos de IA", cat: "texto" };

const numero = (x) => {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.min(100000, Math.round(n * 10000) / 10000) : 0;
};

// ---------- PIX ("copia e cola" no padrão EMV do Banco Central) ----------
const soAscii = (texto, max, { maiusculas = true, restrito = true } = {}) => {
  let t = String(texto || "").normalize("NFD").replace(/\p{M}/gu, "");
  if (maiusculas) t = t.toUpperCase();
  t = t.replace(restrito ? /[^A-Z0-9 ]/g : /[^\x20-\x7E]/g, "");
  return t.replace(/\s+/g, " ").trim().slice(0, max);
};
const tlv = (id, valor) => id + String(valor.length).padStart(2, "0") + valor;

export function crc16(texto) {
  let crc = 0xffff;
  for (const ch of texto) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// valor > 0 entra no código (o app do banco já abre com ele); sem valor, a pessoa digita o valor ao pagar.
export function codigoPix(pix, valor) {
  const chave = String((pix && pix.chave) || "").trim();
  if (!chave) return "";
  const conta = tlv("00", "br.gov.bcb.pix") + tlv("01", chave) + (pix.descricao ? tlv("02", soAscii(pix.descricao, 40, { maiusculas: false, restrito: false })) : "");
  const quantia = Number(valor) >= 0.01 ? Number(valor).toFixed(2) : "";
  const corpo =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("26", conta) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (quantia ? tlv("54", quantia) : "") +
    tlv("58", "BR") +
    tlv("59", soAscii(pix.nome, 25) || "RECEBEDOR") +
    tlv("60", soAscii(pix.cidade, 15) || "BRASIL") +
    tlv("62", tlv("05", "***")) +
    "6304";
  return corpo + crc16(corpo);
}

// ---------- configuração do administrador ----------
export function validarConfigFaturamento(entrada) {
  const c = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : {};
  const p = c.precos && typeof c.precos === "object" ? c.precos : {};
  const precos = {};
  for (const cat of CATEGORIAS) {
    precos[cat.id] = {};
    const bruto = p[cat.id] && typeof p[cat.id] === "object" ? p[cat.id] : {};
    for (const campo of cat.campos) precos[cat.id][campo] = numero(bruto[campo]);
  }
  const dolar = Number(String(c.dolar ?? "").replace(",", "."));
  const margem = Number(String(c.margem ?? "").replace(",", "."));
  const x = c.pix && typeof c.pix === "object" ? c.pix : {};
  const limpa = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
  return {
    precos,
    // Cotação do dólar usada só nas contas de custo da tela do administrador (0 = a do dia) e a margem sobre o custo (%).
    dolar: Number.isFinite(dolar) && dolar >= 1 && dolar <= 50 ? Math.round(dolar * 100) / 100 : 0,
    margem: Number.isFinite(margem) && margem >= 0 && margem <= 1000 ? Math.round(margem) : 100,
    pix: {
      chave: limpa(x.chave, 77).replace(/\s/g, ""),
      nome: limpa(x.nome, 25),
      cidade: limpa(x.cidade, 15),
      descricao: limpa(x.descricao, 40),
    },
  };
}

let cache = null;
export async function lerConfigFaturamento() {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.valor;
  let guardada = null;
  try {
    guardada = await lerItem(CHAVE);
  } catch {
    // sem armazenamento: valem os padrões (preço zero)
  }
  const valor = validarConfigFaturamento(guardada);
  cache = { valor, em: Date.now() };
  return valor;
}

export async function gravarConfigFaturamento(entrada) {
  const valor = validarConfigFaturamento(entrada);
  await gravarItem(CHAVE, valor);
  cache = { valor, em: Date.now() };
  return valor;
}

// ---------- cálculo ----------
const arredondar = (n) => Math.round(n * 100) / 100;

function somar(tarefas, porTarefa) {
  const t = { n: 0, in: 0, out: 0, car: 0, seg: 0 };
  for (const nome of tarefas) {
    const u = porTarefa[nome];
    if (!u) continue;
    t.n += u.n || 0;
    t.in += u.in || 0;
    t.out += u.out || 0;
    t.car += u.car || 0;
    t.seg += u.seg || 0;
  }
  return t;
}

export function valorDoUso(cat, uso, precos) {
  const p = (precos && precos[cat]) || {};
  if (cat === "voz") return (uso.car / 1000) * (p.mil || 0);
  if (cat === "audio") return (uso.seg / 60) * (p.minuto || 0);
  return (uso.in / 1e6) * (p.entrada || 0) + (uso.out / 1e6) * (p.saida || 0);
}

// Quais códigos o aparelho informou e o servidor confere (nada é gravado).
export function acessosDoPedido(corpo) {
  const b = corpo && typeof corpo === "object" ? corpo : {};
  const dirigente = Boolean(codigoDoDirigente()) && textosIguais(b.codigoDirigente, codigoDoDirigente());
  return {
    pesquisa: Boolean(process.env.CODIGO_ESTUDO) && textosIguais(b.codigo, process.env.CODIGO_ESTUDO),
    dirigente,
    s34: dirigente && Boolean(process.env.CODIGO_S34) && textosIguais(b.codigoS34, process.env.CODIGO_S34),
    resumo: Boolean(process.env.CODIGO_RESUMO) && textosIguais(b.codigoResumo, process.env.CODIGO_RESUMO),
    leitura: Boolean(process.env.CODIGO_LEITURA) && textosIguais(b.codigoLeitura, process.env.CODIGO_LEITURA),
    texto: Boolean(process.env.CODIGO_TEXTO) && textosIguais(b.codigoTexto, process.env.CODIGO_TEXTO),
  };
}

export async function consumoDoUsuario(corpo) {
  const pedido = corpo && typeof corpo.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(corpo.mes) ? corpo.mes : "";
  const atual = mesDe(new Date().toISOString());
  const mes = pedido || atual;
  const [{ porTarefa, meses }, config] = await Promise.all([consumoDoAparelho(corpo.aparelhoId, mes), lerConfigFaturamento()]);
  const acessos = acessosDoPedido(corpo);
  const conhecidas = new Set(RECURSOS.flatMap((r) => r.tarefas));
  const recursos = [];
  for (const r of RECURSOS) {
    const uso = somar(r.tarefas, porTarefa);
    // Aparece quem tem acesso (código válido) e também quem já usou no mês (o código pode ter sido trocado depois).
    if (!r.acesso.some((a) => acessos[a]) && !uso.n) continue;
    recursos.push({ id: r.id, rotulo: r.rotulo, categoria: r.cat, consultas: uso.n, entrada: uso.in, saida: uso.out, caracteres: uso.car, segundos: uso.seg, valor: valorDoUso(r.cat, uso, config.precos) });
  }
  const resto = somar(Object.keys(porTarefa).filter((t) => !conhecidas.has(t)), porTarefa);
  if (resto.n) recursos.push({ id: OUTROS.id, rotulo: OUTROS.rotulo, categoria: OUTROS.cat, consultas: resto.n, entrada: resto.in, saida: resto.out, caracteres: resto.car, segundos: resto.seg, valor: valorDoUso(OUTROS.cat, resto, config.precos) });
  const total = arredondar(recursos.reduce((n, r) => n + r.valor, 0));
  const mesesLista = [...new Set([atual, ...meses])].sort().reverse();
  const pix = config.pix;
  return {
    mes,
    meses: mesesLista,
    recursos,
    total,
    categorias: CATEGORIAS.map(({ id, nome, unidade }) => ({ id, nome, unidade, preco: config.precos[id] })),
    pix: {
      configurado: Boolean(pix.chave),
      chave: pix.chave,
      nome: pix.nome,
      cidade: pix.cidade,
      descricao: pix.descricao,
      codigo: codigoPix(pix, total),
      codigoLivre: codigoPix(pix, 0),
    },
  };
}

// ---------- custo de referência (para o administrador decidir o preço) ----------
// Dólares. IA de texto: os preços do modelo que o administrador escolheu (api/_iaConfig.mjs). Voz: a Google cobra o Chirp 3 HD por caractere
// (US$ 30 por milhão); os modelos Gemini, por token (áudio gerado a 25 tokens por segundo, mais o texto), e a conta por 1.000 caracteres
// (uns 70 segundos de fala) é uma estimativa. Áudio em texto: Speech-to-Text V2, US$ 0,016 por minuto. Conferido na tabela de preços do Google em nov/2026.
const CUSTO_VOZ_USD_MIL = { chirp: 0.03, "gemini-2.5-flash": 0.018, "gemini-2.5-pro": 0.036, "gemini-3.1-flash": 0.036 };
const CUSTO_AUDIO_USD_MINUTO = 0.016;
const COTACAO_PADRAO = 5.5;
let cotacao = null;

// Cotação do dólar do dia (API pública do mercado, sem chave); em caso de falha, null.
async function dolarDoDia() {
  if (cotacao && Date.now() - cotacao.em < 60 * 60 * 1000) return cotacao.valor;
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { signal: AbortSignal.timeout(4000) });
    const n = Number((await r.json())?.USDBRL?.bid);
    if (Number.isFinite(n) && n > 1 && n < 50) {
      cotacao = { valor: Math.round(n * 100) / 100, em: Date.now() };
      return cotacao.valor;
    }
  } catch {
    // sem cotação do dia: vale a que o administrador digitou ou a padrão
  }
  return null;
}

export async function custosDeReferencia() {
  const ia = await lerConfigIa();
  const voz = await lerConfigVoz();
  const modeloDe = (id) => MODELOS_IA.find((m) => m.id === id) || MODELOS_IA[0];
  const texto = modeloDe(ia.modelo);
  const esbocos = modeloDe(iaDaTarefa(ia, "tesouros").modelo);
  const vozModelo = MODELOS_VOZ.find((m) => m.id === voz.modelo) || MODELOS_VOZ[0];
  return {
    dolarDoDia: await dolarDoDia(),
    dolarPadrao: COTACAO_PADRAO,
    texto: { modelo: texto.nome.split(":")[0], entrada: texto.entrada, saida: texto.saida },
    esbocos: { modelo: esbocos.nome.split(":")[0], entrada: esbocos.entrada, saida: esbocos.saida },
    voz: { modelo: vozModelo.nome.split(":")[0], mil: CUSTO_VOZ_USD_MIL[vozModelo.id] ?? CUSTO_VOZ_USD_MIL.chirp, estimado: !/chirp/i.test(vozModelo.id) },
    audio: { modelo: "Speech-to-Text V2 (Chirp 3)", minuto: CUSTO_AUDIO_USD_MINUTO },
  };
}

export function opcoesFaturamento() {
  return { categorias: CATEGORIAS.map(({ id, nome, unidade, campos }) => ({ id, nome, unidade, campos })) };
}
