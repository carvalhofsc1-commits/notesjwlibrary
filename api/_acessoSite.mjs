// Cadastro obrigatório de cada aparelho: todo cadastro novo fica pendente até o administrador aprovar.
// Também guarda créditos (R$) e códigos personalizados por recurso de cada usuário.
// Dados no Vercel Blob PRIVADO: "estatisticas/acesso-site.json".
// ACESSO_SITE_DIR (só testes locais) troca o Blob por uma pasta.
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { blobConfigurado, get, put } from "./_blob.mjs";
import { codigoDoDirigente, textosIguais } from "./_comum.mjs";
import { aparelhoIdLimpo, mapaPerfilAparelhos } from "./_estatisticas.mjs";

const NOME = "estatisticas/acesso-site.json";
const MAX_PEDIDOS = 500;

// Recursos que o administrador libera com código personalizado (os mesmos da Autorização de acessos).
export const RECURSOS_CODIGO = [
  { id: "pesquisa", nome: "Pesquisa" },
  { id: "dirigente", nome: "Dirigente" },
  { id: "leitura", nome: "Leitura" },
  { id: "texto", nome: "Áudio em texto" },
  { id: "resumo", nome: "Resumo da Bíblia" },
  { id: "s34", nome: "S-34" },
];
const RECURSO_IDS = new Set(RECURSOS_CODIGO.map((r) => r.id));
export const CREDITO_BOAS_VINDAS_PADRAO = 100; // R$ que cada usuário recebe ao ter o cadastro aprovado, se o administrador não definir outro valor
const PREFIXO_CODIGO = { pesquisa: "PES", dirigente: "DIR", leitura: "LEI", texto: "AUD", resumo: "RES", s34: "S34" };

export function acessoSiteConfigurado() {
  return Boolean(blobConfigurado() || process.env.ACESSO_SITE_DIR || process.env.ESTATISTICAS_DIR);
}

function agoraIso() {
  return new Date().toISOString();
}

function vazio() {
  // restringir fica sempre ligado: cadastros novos só entram depois da aprovação.
  return { versao: 2, atualizadoEm: agoraIso(), restringir: true, pedidos: [], aprovados: {} };
}

// O saldo é guardado com 4 casas (décimos de milésimo de real): cada uso de IA costuma custar frações de centavo, e arredondar cada
// débito para centavos cobrava a mais (ou deixava de cobrar) a cada pedido. Na tela o saldo aparece com 2 casas.
const arredondarSaldo = (n) => Math.round(n * 10000) / 10000;
// O valor do crédito de boas-vindas que o administrador definiu (guardado junto do cadastro); sem definição, o padrão. Zero é válido (sem crédito).
function boasVindasDe(dados) {
  const n = Number(dados && dados.creditoBoasVindas);
  return dados && dados.creditoBoasVindas != null && Number.isFinite(n) && n >= 0 ? arredondarSaldo(n) : CREDITO_BOAS_VINDAS_PADRAO;
}
function creditosDe(registro) {
  const n = Number(registro && registro.creditos);
  return Number.isFinite(n) && n > 0 ? arredondarSaldo(n) : 0;
}

// Extrato do usuário: cada movimento do saldo (crédito ou consumo) fica registrado no cadastro dele, com o saldo depois do movimento.
// "extratoInicial" é o saldo antes do primeiro movimento guardado (para quem já existia antes do extrato, o saldo do dia em que ele começou:
// "extratoDesde"). Guarda os últimos MAX_EXTRATO movimentos; ao passar disso, o mais antigo sai e o saldo dele vira o inicial.
// 6.10.84: 1000 (antes 400) e consumos seguidos do mesmo recurso, em até 30 minutos, viram um movimento só (com "qtd"): a transcrição de
// áudio lançava um movimento por trecho de 50 s e o extrato perderia os mais antigos em poucos dias.
const MAX_EXTRATO = 1000;
const JUNTAR_CONSUMO_MS = 30 * 60 * 1000;
// delta > 0 credita; delta < 0 debita (o saldo nunca fica abaixo de zero). Devolve o valor realmente lançado (0 = nada mudou, nada é registrado).
function lancarExtrato(reg, { tipo, rotulo, delta }) {
  const antes = creditosDe(reg);
  const depois = Math.max(0, arredondarSaldo(antes + delta));
  const efetivo = arredondarSaldo(depois - antes);
  reg.creditos = depois;
  reg.creditosAtualizadoEm = agoraIso();
  if (efetivo === 0) return 0;
  if (!Array.isArray(reg.extrato)) {
    reg.extrato = [];
    reg.extratoInicial = antes;
    reg.extratoDesde = agoraIso();
  }
  const ultimo = reg.extrato[reg.extrato.length - 1];
  if (tipo === "consumo" && ultimo && ultimo.tipo === "consumo" && ultimo.rotulo === rotulo && Date.now() - Date.parse(ultimo.em) <= JUNTAR_CONSUMO_MS) {
    ultimo.valor = arredondarSaldo(ultimo.valor + efetivo);
    ultimo.saldo = depois;
    ultimo.em = agoraIso();
    ultimo.qtd = (Number(ultimo.qtd) || 1) + 1;
    return efetivo;
  }
  reg.extrato.push({ em: agoraIso(), tipo, rotulo, valor: efetivo, saldo: depois });
  if (reg.extrato.length > MAX_EXTRATO) {
    const fora = reg.extrato.splice(0, reg.extrato.length - MAX_EXTRATO);
    reg.extratoInicial = fora[fora.length - 1].saldo;
  }
  return efetivo;
}

// ---------- Crédito de emergência (6.14.63) ----------
// Quando o saldo acaba pelo consumo, o usuário recebe o crédito de emergência (valor definido pelo administrador) para continuar usando;
// o valor concedido fica como dívida (emergenciaDivida) e é abatido na próxima recarga. Um novo só é concedido depois que o anterior for
// abatido. Valor zero desliga a emergência.
export const CREDITO_EMERGENCIA_PADRAO = 10;
function emergenciaDe(dados) {
  const n = Number(dados && dados.creditoEmergencia);
  return dados && dados.creditoEmergencia != null && Number.isFinite(n) && n >= 0 ? arredondarSaldo(n) : CREDITO_EMERGENCIA_PADRAO;
}
function dividaDe(reg) {
  const n = Number(reg && reg.emergenciaDivida);
  return Number.isFinite(n) && n > 0 ? arredondarSaldo(n) : 0;
}
// Tem direito: saldo zerado, nada a abater e o último movimento foi um consumo (um zero deixado por correção ou abatimento não conta).
function temDireitoAEmergencia(reg, dados) {
  if (!reg || emergenciaDe(dados) <= 0 || creditosDe(reg) > 0 || dividaDe(reg) > 0) return false;
  const ultimo = Array.isArray(reg.extrato) ? reg.extrato[reg.extrato.length - 1] : null;
  return Boolean(ultimo && ultimo.tipo === "consumo");
}
function concederEmergencia(reg, dados) {
  if (!temDireitoAEmergencia(reg, dados)) return false;
  const valor = emergenciaDe(dados);
  lancarExtrato(reg, { tipo: "emergencia", rotulo: "Crédito de emergência (abatido na próxima recarga)", delta: valor });
  reg.emergenciaDivida = valor;
  reg.emergenciaEm = agoraIso();
  return true;
}
// Concede na hora, se for o caso, e devolve os dados já atualizados.
async function concederSePreciso(id, dados) {
  if (!id || !temDireitoAEmergencia(dados.aprovados[id], dados)) return dados;
  await comDados((novos) => ({ ok: concederEmergencia(novos.aprovados[id], novos) }));
  return lerRecente();
}
// Toda recarga (compra ou lançamento do administrador) abate primeiro o que houver do crédito de emergência. Devolve o valor abatido.
function aplicarRecarga(reg, { rotulo, soma }) {
  lancarExtrato(reg, { tipo: "credito", rotulo, delta: soma });
  const divida = dividaDe(reg);
  const abate = Math.min(divida, creditosDe(reg));
  if (abate > 0) {
    lancarExtrato(reg, { tipo: "abatimento", rotulo: "Abatimento do crédito de emergência", delta: -abate });
    reg.emergenciaDivida = arredondarSaldo(divida - abate);
  }
  return abate;
}
// Define o valor (R$) do crédito de emergência das próximas concessões (0 = sem emergência). O que já foi concedido não muda.
export async function definirCreditoEmergencia({ valor, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const n = valorEmReais(valor);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return { erro: "Informe um valor em reais entre 0 e 100.000 (0 = sem crédito de emergência)." };
  return comDados((dados) => {
    dados.creditoEmergencia = arredondarSaldo(n);
    return { ok: true, creditoEmergencia: dados.creditoEmergencia };
  });
}

// ---------- Recibos das compras de créditos (6.14.63) ----------
const MAX_RECIBOS = 500;
const contaDoRecibo = (reg, aparelhoId) => ({
  nome: `${reg.nome || ""} ${reg.sobrenome || ""}`.trim(),
  telefone: telefoneFormatado(reg.telefone),
  cidade: cidadeEstadoDe({ cidade: reg.cidade, estado: reg.estado, cidadeEstado: reg.cidadeEstado }),
  aparelho: aparelhoId,
});
function emitirRecibo(reg, aparelhoId, dadosDoPagamento) {
  const agora = agoraIso();
  const recibo = {
    numero: `NS-${agora.slice(0, 10).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`,
    emitidoEm: agora,
    ...dadosDoPagamento,
    conta: contaDoRecibo(reg, aparelhoId),
  };
  if (!Array.isArray(reg.recibos)) reg.recibos = [];
  reg.recibos.push(recibo);
  if (reg.recibos.length > MAX_RECIBOS) reg.recibos = reg.recibos.slice(-MAX_RECIBOS);
  return recibo;
}
// Os recibos do próprio aparelho, do mais novo para o mais antigo (os Pix creditados antes dos recibos também ganham um).
export async function recibosDoUsuario({ aparelhoId } = {}) {
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id || !acessoSiteConfigurado()) return { erro: "Aparelho inválido." };
  cacheDados = { em: 0, dados: null };
  const reg = (await lerRecente()).aprovados[id];
  if (!reg) return { erro: "Este aparelho ainda não está identificado." };
  const emitidos = Array.isArray(reg.recibos) ? reg.recibos : [];
  const comRecibo = new Set(emitidos.map((r) => r.pagamentoId).filter(Boolean));
  const antigos = (Array.isArray(reg.pixHistorico) ? reg.pixHistorico : [])
    .filter((p) => !comRecibo.has(p.pagamentoId))
    .map((p) => ({ numero: `NS-PIX-${p.pagamentoId}`, emitidoEm: p.em, pagoEm: p.em, valor: p.valor, forma: "Pix (Mercado Pago)", pagamentoId: p.pagamentoId, conta: contaDoRecibo(reg, id) }));
  return { ok: true, recibos: [...antigos, ...emitidos].sort((x, y) => String(y.emitidoEm).localeCompare(String(x.emitidoEm))) };
}

// O extrato do próprio aparelho (público, pelo aparelhoId): saldo inicial, movimentos em ordem de data e saldo atual.
export async function extratoDoUsuario({ aparelhoId } = {}) {
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id || !acessoSiteConfigurado()) return { erro: "Aparelho inválido." };
  cacheDados = { em: 0, dados: null };
  const dados = await lerRecente();
  const reg = dados.aprovados[id];
  if (!reg) return { erro: "Este aparelho ainda não está identificado." };
  const movimentos = Array.isArray(reg.extrato) ? reg.extrato : [];
  return {
    ok: true,
    saldo: creditosDe(reg),
    inicial: movimentos.length || reg.extratoInicial != null ? arredondarSaldo(Number(reg.extratoInicial) || 0) : creditosDe(reg),
    desde: reg.extratoDesde || reg.aprovadoEm || "",
    comHistoricoAnterior: Boolean(reg.extratoDesde && reg.extratoInicial > 0),
    movimentos: movimentos.map((m) => ({ em: m.em, tipo: m.tipo, rotulo: m.rotulo, valor: m.valor, saldo: m.saldo, qtd: Number(m.qtd) || 1 })),
  };
}

// "R$ 1.234,56", "10,5", "10.5" ou "-5" → número (NaN se não der para entender).
function valorEmReais(valor) {
  let s = String(valor ?? "").replace(/r\$/gi, "").replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return s ? Number(s) : NaN;
}

function codigosDe(registro) {
  const bruto = registro && registro.codigos && typeof registro.codigos === "object" ? registro.codigos : {};
  const out = {};
  for (const id of RECURSO_IDS) {
    const c = bruto[id];
    if (!c || typeof c !== "object") continue;
    const codigo = String(c.codigo || "").trim();
    if (!codigo) continue;
    out[id] = {
      codigo,
      ativo: c.ativo !== false,
      criadoEm: c.criadoEm || "",
      expiradoEm: c.expiradoEm || "",
    };
  }
  return out;
}

function gerarCodigoTexto(recurso) {
  const pref = PREFIXO_CODIGO[recurso] || "NS";
  const corpo = randomBytes(5).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  return `NS-${pref}-${corpo}`;
}

// Senha master (6.14.72): uma só senha, de um usuário só, que vale no lugar de todos os códigos de recurso no aparelho dele.
// Não é senha de administrador: não abre nada da administração do app. Nunca vai nas respostas ao aparelho, só na do administrador.
function masterDe(registro) {
  const m = registro && registro.master;
  if (!m || typeof m !== "object") return null;
  const codigo = String(m.codigo || "").trim();
  if (!codigo) return null;
  return { codigo, ativo: m.ativo !== false, criadoEm: m.criadoEm || "", expiradoEm: m.expiradoEm || "" };
}

function gerarMasterTexto() {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I/L, para ditar e digitar sem erro
  const bloco = () => Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join("");
  return `NS-MASTER-${bloco()}-${bloco()}-${bloco()}`;
}

// Cache curto dos códigos personalizados e das senhas master ativos: permite conferência síncrona nas APIs de IA.
let cacheCodigos = { em: 0, mapa: new Map(), masters: new Map() }; // codigoLower -> { recurso, aparelhoId } · masters: codigoLower -> aparelhoId

function montarCacheCodigos(dados) {
  const mapa = new Map();
  const masters = new Map();
  for (const [aparelhoId, reg] of Object.entries((dados && dados.aprovados) || {})) {
    const codigos = codigosDe(reg);
    for (const [recurso, c] of Object.entries(codigos)) {
      if (!c.ativo || !c.codigo) continue;
      mapa.set(c.codigo.trim().toLowerCase(), { recurso, aparelhoId });
    }
    const master = masterDe(reg);
    if (master && master.ativo) masters.set(master.codigo.toLowerCase(), aparelhoId);
  }
  cacheCodigos = { em: Date.now(), mapa, masters };
}

// Leitura recente do cadastro (até 5 s), para as conferências de cada pedido de IA (cadastro aprovado, saldo e códigos pessoais) não lerem
// o Blob três vezes por pedido: a leitura em voz, por exemplo, faz vários pedidos seguidos. Quem grava (comDados) já atualiza esta cópia.
let cacheDados = { em: 0, dados: null };
function guardarRecente(dados) {
  cacheDados = { em: Date.now(), dados };
  montarCacheCodigos(dados);
}
async function lerRecente() {
  if (cacheDados.dados && Date.now() - cacheDados.em < 5_000) return cacheDados.dados;
  const dados = (await lerBruto()) || vazio();
  if (!Array.isArray(dados.pedidos)) dados.pedidos = [];
  if (!dados.aprovados || typeof dados.aprovados !== "object") dados.aprovados = {};
  guardarRecente(dados);
  return dados;
}

export async function prepararCodigosPessoais() {
  if (!acessoSiteConfigurado()) return;
  await lerRecente();
}

// Confere se o código informado é o personalizado ativo deste aparelho para o recurso.
export function codigoPessoalSync(recurso, codigo, aparelhoId) {
  const id = aparelhoIdLimpo(aparelhoId);
  const chave = String(codigo || "").trim().toLowerCase();
  if (!id || !chave || !RECURSO_IDS.has(recurso)) return false;
  const e = cacheCodigos.mapa.get(chave);
  return Boolean(e && e.recurso === recurso && e.aparelhoId === id);
}

function codigoGlobalDoRecurso(recurso) {
  if (recurso === "pesquisa") return process.env.CODIGO_ESTUDO || "";
  if (recurso === "dirigente") return codigoDoDirigente() || "";
  if (recurso === "leitura") return process.env.CODIGO_LEITURA || "";
  if (recurso === "texto") return process.env.CODIGO_TEXTO || "";
  if (recurso === "resumo") return process.env.CODIGO_RESUMO || "";
  if (recurso === "s34") return process.env.CODIGO_S34 || "";
  return "";
}

// Confere se a senha informada é a senha master ativa deste aparelho.
export function senhaMasterValida(codigo, aparelhoId) {
  const id = aparelhoIdLimpo(aparelhoId);
  const chave = String(codigo || "").trim().toLowerCase();
  return Boolean(id && chave && cacheCodigos.masters.get(chave) === id);
}

// Aceita o código global do servidor, o personalizado deste aparelho ou a senha master dele.
export function recursoCodigoValido(recurso, codigo, aparelhoId) {
  // A senha de administrador libera todas as funções, sem depender do código de cada uma (6.10.94).
  if (process.env.CODIGO_ADMIN && textosIguais(codigo, process.env.CODIGO_ADMIN)) return true;
  const global = codigoGlobalDoRecurso(recurso);
  if (global && textosIguais(codigo, global)) return true;
  if (codigoPessoalSync(recurso, codigo, aparelhoId)) return true;
  return RECURSO_IDS.has(recurso) && senhaMasterValida(codigo, aparelhoId);
}

async function lerBruto() {
  const dir = process.env.ACESSO_SITE_DIR || process.env.ESTATISTICAS_DIR;
  if (dir) {
    const { readFile } = await import("node:fs/promises");
    try {
      return JSON.parse(await readFile(`${dir}/acesso-site.json`, "utf8"));
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
  const dir = process.env.ACESSO_SITE_DIR || process.env.ESTATISTICAS_DIR;
  if (dir) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/acesso-site.json`, texto, "utf8");
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

let fila = Promise.resolve();
function emFila(trabalho) {
  const proxima = fila.then(trabalho, trabalho);
  fila = proxima.catch(() => {});
  return proxima;
}

async function comDados(mutar) {
  if (!acessoSiteConfigurado()) return null;
  return emFila(async () => {
    const dados = (await lerBruto()) || vazio();
    if (!Array.isArray(dados.pedidos)) dados.pedidos = [];
    if (!dados.aprovados || typeof dados.aprovados !== "object") dados.aprovados = {};
    dados.restringir = true; // padrão permanente: cadastros novos pedem aprovação
    const resultado = (await mutar(dados)) || null;
    await gravarBruto(dados);
    guardarRecente(dados); // as conferências seguintes já veem o que acabou de ser gravado (saldo, códigos, aprovações)
    return resultado;
  });
}

const limpar = (valor, max) =>
  typeof valor === "string" ? valor.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim().slice(0, max) : "";

const ESTADOS_UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const COMO_CONHECEU = new Set([
  "Um amigo ou irmão da congregação",
  "Grupo de WhatsApp",
  "Pesquisa na internet",
  "Redes sociais",
  "Indicação na congregação ou reunião",
  "Outros meios",
]);

const MESES_NOME = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function idadeAprox(ano, mes) {
  const agora = new Date();
  let idade = agora.getFullYear() - ano;
  if (agora.getMonth() + 1 < mes) idade -= 1;
  return idade;
}

function telefoneLimpo(valor) {
  return String(valor || "").replace(/\D/g, "").slice(0, 11);
}

function telefoneFormatado(valor) {
  const d = telefoneLimpo(valor);
  if (!d) return "";
  if (d.length <= 2) return "(" + d;
  const resto = d.slice(2);
  if (resto.length <= 4) return "(" + d.slice(0, 2) + ") " + resto;
  if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + resto.slice(0, 4) + "-" + resto.slice(4);
  return "(" + d.slice(0, 2) + ") " + resto.slice(0, 5) + "-" + resto.slice(5, 9);
}

function telefoneValido(valor) {
  const d = telefoneLimpo(valor);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (!Number.isFinite(ddd) || ddd < 11) return false;
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}

function pedidoPublico(p) {
  return {
    id: p.id,
    aparelhoId: String(p.aparelhoId || "").slice(0, 8),
    nome: p.nome,
    sobrenome: p.sobrenome,
    telefone: p.telefone || "",
    idade: p.idade,
    anoNascimento: p.anoNascimento || null,
    mesNascimento: p.mesNascimento || null,
    cidade: p.cidade || "",
    estado: p.estado || "",
    cidadeEstado: p.cidadeEstado,
    congregacao: p.congregacao,
    comoConheceu: p.comoConheceu,
    criadoEm: p.criadoEm,
    status: p.status,
    decididoEm: p.decididoEm || null,
  };
}

// Em versões antigas "nome" podia ser o nome completo; com sobrenome separado, devolve só o primeiro nome.
function nomeESobrenome(a) {
  const sobrenome = limpar(a && a.sobrenome, 60);
  let nome = limpar(a && a.nome, 120);
  if (sobrenome && nome.toLowerCase().endsWith(" " + sobrenome.toLowerCase())) {
    nome = nome.slice(0, -(sobrenome.length + 1)).trim();
  }
  return { nome: nome.slice(0, 60), sobrenome };
}

function cidadeEstadoDe(a) {
  const cidade = limpar(a && a.cidade, 60);
  const estado = limpar(a && a.estado, 2).toUpperCase();
  if (cidade && estado) return `${cidade}, ${estado}`;
  return limpar(a && a.cidadeEstado, 80);
}

function identidadeDe(a) {
  const { nome, sobrenome } = nomeESobrenome(a);
  const cidade = limpar(a && a.cidade, 60);
  const estado = limpar(a && a.estado, 2).toUpperCase();
  let cidadeFinal = cidade;
  let estadoFinal = estado;
  if ((!cidadeFinal || !estadoFinal) && a && a.cidadeEstado) {
    const m = String(a.cidadeEstado).match(/^(.*),\s*([A-Za-z]{2})\s*$/);
    if (m) {
      if (!cidadeFinal) cidadeFinal = limpar(m[1], 60);
      if (!estadoFinal) estadoFinal = m[2].toUpperCase();
    }
  }
  const ano = Number(a && a.anoNascimento);
  const mes = Number(a && a.mesNascimento);
  const idade =
    Number.isFinite(ano) && ano >= 1900 && Number.isFinite(mes) && mes >= 1 && mes <= 12
      ? idadeAprox(ano, mes)
      : a.idade || null;
  return {
    nome,
    sobrenome,
    nomeCompleto: `${nome} ${sobrenome}`.trim(),
    idade,
    anoNascimento: Number.isFinite(ano) ? ano : null,
    mesNascimento: Number.isFinite(mes) && mes >= 1 && mes <= 12 ? mes : null,
    mesNascimentoNome: Number.isFinite(mes) && mes >= 1 && mes <= 12 ? MESES_NOME[mes] : "",
    cidade: cidadeFinal,
    estado: estadoFinal,
    cidadeEstado: cidadeEstadoDe({ cidade: cidadeFinal, estado: estadoFinal, cidadeEstado: a && a.cidadeEstado }),
    congregacao: a.congregacao || "",
    comoConheceu: a.comoConheceu || "",
    telefone: telefoneFormatado(a && a.telefone),
    aprovadoEm: a.aprovadoEm || "",
    pedidoId: a.pedidoId || "",
    creditos: creditosDe(a),
    creditoBoasVindas: Number(a.creditoBoasVindas) > 0 ? Number(a.creditoBoasVindas) : 0, // o app avisa uma vez (só nos aprovados com o crédito)
    emergenciaDivida: dividaDe(a), // 6.14.63: quanto do crédito de emergência ainda será abatido na próxima recarga
    ultimoRecibo: Array.isArray(a.recibos) && a.recibos.length ? a.recibos[a.recibos.length - 1].numero : "",
    codigos: codigosDe(a),
  };
}

// O cadastro que volta para o aparelho: sem os códigos personalizados, que só o administrador vê (Administração de usuários).
function cadastroPublico(a) {
  const { codigos, ...cadastro } = identidadeDe(a);
  return cadastro;
}

function camposDoCorpo(corpo) {
  const nome = limpar(corpo && corpo.nome, 60);
  const sobrenome = limpar(corpo && corpo.sobrenome, 60);
  const cidade = limpar(corpo && corpo.cidade, 60) || limpar(corpo && corpo.cidadeEstado, 60);
  const estado = limpar(corpo && corpo.estado, 2).toUpperCase();
  const congregacao = limpar(corpo && corpo.congregacao, 100);
  const telefone = telefoneFormatado(corpo && corpo.telefone);
  const comoOpcao = limpar(corpo && corpo.comoConheceuOpcao, 80) || limpar(corpo && corpo.comoConheceu, 80);
  const comoOutro = limpar(corpo && corpo.comoConheceuOutro, 160);
  const ano = Math.round(Number(corpo && corpo.anoNascimento));
  const mes = Math.round(Number(corpo && corpo.mesNascimento));
  const anoAtual = new Date().getFullYear();
  if (!nome || !sobrenome) return { erro: "Informe o nome e o sobrenome." };
  if (!telefoneValido(telefone)) return { erro: "Informe um telefone válido, no formato (00) 00000-0000." };
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) return { erro: "Escolha o mês de nascimento." };
  if (!Number.isFinite(ano) || ano < 1920 || ano > anoAtual - 12) return { erro: "Escolha o ano de nascimento." };
  const idade = idadeAprox(ano, mes);
  if (idade < 12 || idade > 120) return { erro: "A idade aproximada precisa ser de pelo menos 12 anos." };
  if (!cidade) return { erro: "Informe a cidade." };
  if (!ESTADOS_UF.has(estado)) return { erro: "Escolha o estado." };
  if (comoOpcao && !COMO_CONHECEU.has(comoOpcao)) return { erro: "Escolha como você conheceu o app." };
  const comoConheceu = comoOpcao === "Outros meios" ? (comoOutro ? `Outros meios: ${comoOutro}` : "Outros meios") : comoOpcao;
  return {
    campos: {
      nome,
      sobrenome,
      telefone,
      idade,
      anoNascimento: ano,
      mesNascimento: mes,
      cidade,
      estado,
      cidadeEstado: `${cidade}, ${estado}`,
      congregacao,
      comoConheceu,
    },
  };
}

function registroDeCampos(campos, extras = {}) {
  return {
    ...extras,
    nome: campos.nome,
    sobrenome: campos.sobrenome,
    telefone: campos.telefone || "",
    idade: campos.idade,
    anoNascimento: campos.anoNascimento,
    mesNascimento: campos.mesNascimento,
    cidade: campos.cidade,
    estado: campos.estado,
    cidadeEstado: campos.cidadeEstado,
    congregacao: campos.congregacao,
    comoConheceu: campos.comoConheceu,
  };
}

function gravarIdentidade(dados, id, campos, { pedidoId = "", statusPedido = "aprovado", aprovadoEm } = {}) {
  const agora = agoraIso();
  const pedido = {
    id: pedidoId || randomUUID(),
    aparelhoId: id,
    ...registroDeCampos(campos),
    criadoEm: agora,
    status: statusPedido,
    decididoEm: statusPedido === "pendente" ? null : agora,
  };
  if (statusPedido === "pendente") {
    dados.pedidos.unshift(pedido);
    if (dados.pedidos.length > MAX_PEDIDOS) dados.pedidos.length = MAX_PEDIDOS;
    return pedido;
  }
  dados.aprovados[id] = registroDeCampos(campos, {
    pedidoId: pedido.id,
    aprovadoEm: aprovadoEm || agora,
  });
  dados.pedidos.unshift(pedido);
  if (dados.pedidos.length > MAX_PEDIDOS) dados.pedidos.length = MAX_PEDIDOS;
  return pedido;
}

// Estado para o aparelho (público): cadastro obrigatório; novos ficam pendentes até a aprovação.
// recente: aceita a leitura dos últimos segundos (conferência de cada pedido de IA); sem ela, lê o Blob na hora (tela de abertura e "Verificar").
export async function estadoAcessoSite({ aparelhoId, recente = false } = {}) {
  if (!acessoSiteConfigurado()) {
    return { configurado: false, restringir: true, ok: true };
  }
  if (!recente) cacheDados = { em: 0, dados: null };
  let dados = await lerRecente();
  const id = aparelhoIdLimpo(aparelhoId);
  if (id && dados.aprovados[id]) {
    dados = await concederSePreciso(id, dados); // quem já estava com o saldo zerado pelo consumo recebe ao abrir o app
    const cadastro = cadastroPublico(dados.aprovados[id]);
    return {
      configurado: true,
      restringir: true,
      ok: true,
      identificado: true,
      nome: cadastro.nomeCompleto,
      cadastro,
      creditos: cadastro.creditos,
    };
  }
  const pendente = id ? dados.pedidos.find((p) => p.aparelhoId === id && p.status === "pendente") : null;
  const recusado = id ? [...dados.pedidos].reverse().find((p) => p.aparelhoId === id && p.status === "recusado") : null;
  return {
    configurado: true,
    restringir: true,
    ok: false,
    precisaCadastro: true,
    pendente: Boolean(pendente),
    recusado: Boolean(recusado) && !pendente,
  };
}

// Usado pelas APIs: devolve null se pode seguir, ou mensagem de erro.
export async function mensagemSeBloqueado({ aparelhoId, codigoAdmin } = {}) {
  if (codigoAdmin && textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return null;
  const e = await estadoAcessoSite({ aparelhoId, recente: true });
  if (!e.configurado || e.ok) return null;
  if (e.pendente) return "Seu cadastro ainda está em análise. Quando for aprovado, abra o app de novo.";
  if (e.recusado) return "O cadastro deste aparelho foi recusado. Se precisar, envie um novo cadastro pelo formulário.";
  return "É preciso se identificar para usar o NoteStyle. Preencha o formulário de cadastro.";
}

// Sem créditos, as APIs de IA recusam (administrador com senha no pedido passa).
export async function mensagemSeSemCredito({ aparelhoId, codigoAdmin } = {}) {
  if (codigoAdmin && textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return null;
  if (!acessoSiteConfigurado()) return null;
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id) return null;
  const dados = await lerRecente();
  if (!dados.aprovados[id]) return null; // quem ainda não cadastrou já é barrado pelo gate do site
  if (creditosDe(dados.aprovados[id]) > 0) return null;
  const atuais = await concederSePreciso(id, dados); // 6.14.63: crédito de emergência
  if (creditosDe(atuais.aprovados[id]) > 0) return null;
  return dividaDe(atuais.aprovados[id]) > 0
    ? "Seu crédito de emergência acabou. Faça uma recarga em Ajustes → Consumo de IA e faturamento para voltar a usar a IA."
    : "Seus créditos de IA acabaram. Faça uma recarga em Ajustes → Consumo de IA e faturamento ou peça ao administrador.";
}

export async function pedirAcessoSite(corpo) {
  const id = aparelhoIdLimpo(corpo && corpo.aparelhoId);
  if (!id) return { erro: "Não foi possível identificar este aparelho. Atualize o app e tente de novo." };
  const validado = camposDoCorpo(corpo);
  if (validado.erro) return { erro: validado.erro };
  const { campos } = validado;

  return comDados((dados) => {
    if (dados.aprovados[id]) return { ok: true, jaAprovado: true, identificado: true, cadastro: cadastroPublico(dados.aprovados[id]) };
    const aberto = dados.pedidos.find((p) => p.aparelhoId === id && p.status === "pendente");
    if (aberto) return { ok: true, pendente: true, id: aberto.id };
    const pedido = gravarIdentidade(dados, id, campos, { statusPedido: "pendente" });
    return { ok: true, pendente: true, id: pedido.id };
  });
}

// Atualiza o cadastro deste aparelho (já identificado). Não exige nova aprovação.
export async function atualizarCadastroSite(corpo) {
  const id = aparelhoIdLimpo(corpo && corpo.aparelhoId);
  if (!id) return { erro: "Não foi possível identificar este aparelho. Atualize o app e tente de novo." };
  const validado = camposDoCorpo(corpo);
  if (validado.erro) return { erro: validado.erro };
  const { campos } = validado;

  return comDados((dados) => {
    if (!dados.aprovados[id]) {
      return { erro: "Este aparelho ainda não tem cadastro. Preencha a tela de identificação primeiro." };
    }
    const anterior = dados.aprovados[id];
    dados.aprovados[id] = registroDeCampos(campos, {
      pedidoId: anterior.pedidoId || "",
      aprovadoEm: anterior.aprovadoEm || agoraIso(),
      atualizadoEm: agoraIso(),
      creditos: creditosDe(anterior),
      ...(anterior.creditoBoasVindas ? { creditoBoasVindas: anterior.creditoBoasVindas } : {}),
      codigos: codigosDe(anterior),
      ...(masterDe(anterior) ? { master: masterDe(anterior) } : {}), // 6.14.72: a senha master também fica
      // O extrato e os Pix creditados fazem parte do cadastro: atualizar os dados pessoais não pode apagá-los.
      ...(Array.isArray(anterior.extrato) ? { extrato: anterior.extrato, extratoInicial: anterior.extratoInicial, extratoDesde: anterior.extratoDesde } : {}),
      ...(Array.isArray(anterior.pixHistorico) ? { pixHistorico: anterior.pixHistorico } : {}),
      ...(anterior.creditosAtualizadoEm ? { creditosAtualizadoEm: anterior.creditosAtualizadoEm } : {}),
      // 6.14.63: a dívida do crédito de emergência e os recibos também ficam.
      ...(dividaDe(anterior) > 0 ? { emergenciaDivida: dividaDe(anterior), emergenciaEm: anterior.emergenciaEm } : {}),
      ...(Array.isArray(anterior.recibos) ? { recibos: anterior.recibos } : {}),
    });
    return { ok: true, atualizado: true, cadastro: cadastroPublico(dados.aprovados[id]) };
  });
}

export async function lerAcessoSiteAdmin() {
  const dados = (await lerBruto()) || vazio();
  const perfis = await mapaPerfilAparelhos();
  const pendentes = dados.pedidos.filter((p) => p.status === "pendente").map(pedidoPublico);
  const recentes = dados.pedidos.filter((p) => p.status !== "pendente").slice(0, 40).map(pedidoPublico);
  const ids = Object.keys(dados.aprovados || {});
  let consumos = {};
  try {
    const { mapaConsumoAdmin } = await import("./_faturamento.mjs");
    consumos = await mapaConsumoAdmin(ids);
  } catch {
    consumos = {};
  }
  const aprovados = ids.map((aparelhoId) => {
    const a = dados.aprovados[aparelhoId];
    const perfil = perfis[aparelhoId] || {};
    const consumo = consumos[aparelhoId] || { mes: "", recursos: [], total: 0 };
    return {
      aparelhoId: aparelhoId.slice(0, 8),
      aparelhoIdCompleto: aparelhoId,
      ...identidadeDe(a),
      nivel: perfil.nivel === "admin" ? "admin" : "normal",
      recursos: perfil.recursos || {
        pesquisa: false,
        dirigente: false,
        leitura: false,
        texto: false,
        resumo: false,
        s34: false,
      },
      consumo,
      master: masterDe(a), // 6.14.72: só nesta resposta, a do administrador
    };
  });
  aprovados.sort((a, b) => String(b.aprovadoEm).localeCompare(String(a.aprovadoEm)));
  montarCacheCodigos(dados);
  return {
    configurado: true,
    restringir: true,
    atualizadoEm: dados.atualizadoEm || "",
    pendentes,
    recentes,
    aprovados: aprovados.slice(0, 100),
    recursosCodigo: RECURSOS_CODIGO,
    creditoBoasVindas: boasVindasDe(dados),
    creditoEmergencia: emergenciaDe(dados),
  };
}

// Mantida por compatibilidade: a aprovação de cadastros novos é sempre o padrão.
export async function definirRestricaoSite() {
  return comDados((dados) => {
    dados.restringir = true;
    return { restringir: true, avos: 0 };
  });
}

export async function decidirPedidoSite({ id, aprovar, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const pedidoId = String(id || "").trim();
  if (!pedidoId) return { erro: "Pedido não informado." };
  return comDados((dados) => {
    const p = dados.pedidos.find((x) => x.id === pedidoId);
    if (!p) return { erro: "Pedido não encontrado." };
    if (p.status !== "pendente") return { erro: "Este pedido já foi decidido." };
    p.status = aprovar ? "aprovado" : "recusado";
    p.decididoEm = agoraIso();
    if (aprovar) {
      const boasVindas = boasVindasDe(dados); // o valor definido pelo administrador na hora da aprovação
      dados.aprovados[p.aparelhoId] = registroDeCampos(
        {
          nome: p.nome,
          sobrenome: p.sobrenome,
          telefone: p.telefone,
          idade: p.idade,
          anoNascimento: p.anoNascimento,
          mesNascimento: p.mesNascimento,
          cidade: p.cidade,
          estado: p.estado,
          cidadeEstado: p.cidadeEstado,
          congregacao: p.congregacao,
          comoConheceu: p.comoConheceu,
        },
        // Crédito de boas-vindas: todo usuário aprovado começa com R$ 100,00 (o app avisa uma vez, na primeira abertura depois da aprovação).
        { pedidoId: p.id, aprovadoEm: p.decididoEm, creditos: 0, ...(boasVindas > 0 ? { creditoBoasVindas: boasVindas } : {}), codigos: {} }
      );
      // O extrato começa com saldo zero e o crédito de boas-vindas como primeiro movimento.
      const novo = dados.aprovados[p.aparelhoId];
      novo.extrato = [];
      novo.extratoInicial = 0;
      novo.extratoDesde = p.decididoEm;
      lancarExtrato(novo, { tipo: "credito", rotulo: "Crédito de boas-vindas", delta: boasVindas });
    }
    return { ok: true, pedido: pedidoPublico(p) };
  });
}

// Define o crédito de boas-vindas (R$) dos próximos cadastros aprovados (0 = sem crédito). Quem já foi aprovado não muda.
export async function definirCreditoBoasVindas({ valor, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const n = valorEmReais(valor);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return { erro: "Informe um valor em reais entre 0 e 100.000 (0 = sem crédito de boas-vindas)." };
  return comDados((dados) => {
    dados.creditoBoasVindas = arredondarSaldo(n);
    return { ok: true, creditoBoasVindas: dados.creditoBoasVindas };
  });
}

export async function revogarAcessoSite({ aparelhoId, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id) return { erro: "Aparelho inválido." };
  return comDados((dados) => {
    if (!dados.aprovados[id]) return { erro: "Este aparelho não está na lista de identificados." };
    delete dados.aprovados[id];
    return { ok: true };
  });
}

// Soma créditos em R$ ao usuário (valor positivo). O saldo não fica negativo ao creditar.
// 6.14.63: pagamento = true quando é um pagamento recebido (gera recibo e conta como crédito pago); senão é bônus. Os dois abatem a emergência.
export async function creditarUsuario({ aparelhoId, valor, codigoAdmin, pagamento = false }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id) return { erro: "Aparelho inválido." };
  // Valor positivo credita; negativo corrige um lançamento errado (o saldo nunca fica abaixo de zero).
  const n = valorEmReais(valor);
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 100000) return { erro: "Informe um valor em reais, por exemplo 10,00 (ou -5,00 para corrigir um lançamento)." };
  const soma = Math.round(n * 100) / 100;
  return comDados((dados) => {
    const reg = dados.aprovados[id];
    if (!reg) return { erro: "Este aparelho não está na lista de identificados." };
    if (soma < 0) {
      lancarExtrato(reg, { tipo: "ajuste", rotulo: "Correção lançada pelo administrador", delta: soma });
      return { ok: true, creditos: reg.creditos, aparelhoId: id };
    }
    const abatido = aplicarRecarga(reg, { rotulo: pagamento ? "Recarga paga (lançada pelo administrador)" : "Crédito de bônus lançado pelo administrador", soma });
    const recibo = pagamento ? emitirRecibo(reg, id, { pagoEm: agoraIso(), valor: soma, forma: "Pagamento recebido pelo administrador", abatido, saldoDepois: creditosDe(reg) }) : null;
    return { ok: true, creditos: reg.creditos, aparelhoId: id, abatido, ...(recibo ? { recibo: recibo.numero } : {}) };
  });
}

// O aparelho está na lista de usuários identificados (aprovados)? Só eles podem comprar crédito.
export async function aparelhoIdentificado(aparelhoId) {
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id || !acessoSiteConfigurado()) return false;
  cacheDados = { em: 0, dados: null };
  const dados = await lerRecente();
  return Boolean(dados.aprovados[id]);
}

// Credita um pagamento Pix já confirmado no Mercado Pago. Cada pagamento (pelo número dele) só credita UMA vez, mesmo que o aviso (webhook) e a
// consulta do aplicativo cheguem juntos: a conferência e a gravação acontecem na mesma fila. Guarda os últimos pagamentos para dar o extrato.
const MAX_PIX_GUARDADOS = 3000;
export async function creditarPagamentoPix({ aparelhoId, pagamentoId, valor, detalhes = {} }) {
  const id = aparelhoIdLimpo(aparelhoId);
  const pag = String(pagamentoId || "").trim();
  const soma = Math.round(Number(valor) * 100) / 100;
  if (!id || !/^\d{3,20}$/.test(pag) || !Number.isFinite(soma) || soma <= 0 || soma > 100000) return { erro: "Pagamento inválido." };
  return comDados((dados) => {
    const reg = dados.aprovados[id];
    if (!reg) return { erro: "Este aparelho não está na lista de identificados." };
    if (!dados.pixPagamentos || typeof dados.pixPagamentos !== "object") dados.pixPagamentos = {};
    if (dados.pixPagamentos[pag]) return { ok: true, jaCreditado: true, creditos: creditosDe(reg), valor: dados.pixPagamentos[pag].valor };
    const abatido = aplicarRecarga(reg, { rotulo: "Crédito por Pix", soma });
    const recibo = emitirRecibo(reg, id, { ...detalhes, valor: soma, forma: "Pix (Mercado Pago)", pagamentoId: pag, abatido, saldoDepois: creditosDe(reg) });
    dados.pixPagamentos[pag] = { aparelhoId: id, valor: soma, em: agoraIso() };
    const chaves = Object.keys(dados.pixPagamentos);
    if (chaves.length > MAX_PIX_GUARDADOS) chaves.slice(0, chaves.length - MAX_PIX_GUARDADOS).forEach((k) => delete dados.pixPagamentos[k]);
    if (!Array.isArray(reg.pixHistorico)) reg.pixHistorico = [];
    reg.pixHistorico.push({ pagamentoId: pag, valor: soma, em: agoraIso() });
    if (reg.pixHistorico.length > 30) reg.pixHistorico = reg.pixHistorico.slice(-30);
    return { ok: true, jaCreditado: false, creditos: reg.creditos, valor: soma, abatido, recibo: recibo.numero };
  });
}

export async function gerarCodigoUsuario({ aparelhoId, recurso, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const id = aparelhoIdLimpo(aparelhoId);
  const rec = String(recurso || "").trim();
  if (!id) return { erro: "Aparelho inválido." };
  if (!RECURSO_IDS.has(rec)) return { erro: "Recurso inválido." };
  return comDados((dados) => {
    const reg = dados.aprovados[id];
    if (!reg) return { erro: "Este aparelho não está na lista de identificados." };
    if (!reg.codigos || typeof reg.codigos !== "object") reg.codigos = {};
    // Garante unicidade entre todos os usuários ativos.
    let codigo = "";
    for (let i = 0; i < 12; i++) {
      const candidato = gerarCodigoTexto(rec);
      let usado = false;
      for (const [outroId, outro] of Object.entries(dados.aprovados)) {
        const c = codigosDe(outro)[rec];
        if (c && c.ativo && textosIguais(c.codigo, candidato) && outroId !== id) {
          usado = true;
          break;
        }
      }
      if (!usado) {
        codigo = candidato;
        break;
      }
    }
    if (!codigo) return { erro: "Não foi possível gerar um código agora. Tente de novo." };
    reg.codigos[rec] = { codigo, ativo: true, criadoEm: agoraIso(), expiradoEm: "" };
    return { ok: true, recurso: rec, codigo, aparelhoId: id, codigos: codigosDe(reg) };
  });
}

export async function expirarCodigoUsuario({ aparelhoId, recurso, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const id = aparelhoIdLimpo(aparelhoId);
  const rec = String(recurso || "").trim();
  if (!id) return { erro: "Aparelho inválido." };
  if (!RECURSO_IDS.has(rec)) return { erro: "Recurso inválido." };
  return comDados((dados) => {
    const reg = dados.aprovados[id];
    if (!reg) return { erro: "Este aparelho não está na lista de identificados." };
    if (!reg.codigos || typeof reg.codigos !== "object" || !reg.codigos[rec] || !reg.codigos[rec].codigo) {
      return { erro: "Este usuário ainda não tem código deste recurso." };
    }
    reg.codigos[rec] = {
      ...reg.codigos[rec],
      ativo: false,
      expiradoEm: agoraIso(),
    };
    return { ok: true, recurso: rec, aparelhoId: id, codigos: codigosDe(reg) };
  });
}

// Gera (ou troca) a senha master de um usuário: a anterior deixa de valer na hora.
export async function gerarMasterUsuario({ aparelhoId, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id) return { erro: "Aparelho inválido." };
  return comDados((dados) => {
    const reg = dados.aprovados[id];
    if (!reg) return { erro: "Este aparelho não está na lista de identificados." };
    reg.master = { codigo: gerarMasterTexto(), ativo: true, criadoEm: agoraIso(), expiradoEm: "" };
    return { ok: true, codigo: reg.master.codigo, aparelhoId: id };
  });
}

export async function expirarMasterUsuario({ aparelhoId, codigoAdmin }) {
  if (!textosIguais(codigoAdmin, process.env.CODIGO_ADMIN)) return { erro: "Código de administrador incorreto." };
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id) return { erro: "Aparelho inválido." };
  return comDados((dados) => {
    const reg = dados.aprovados[id];
    if (!reg) return { erro: "Este aparelho não está na lista de identificados." };
    if (!masterDe(reg)) return { erro: "Este usuário ainda não tem senha master." };
    reg.master = { ...masterDe(reg), ativo: false, expiradoEm: agoraIso() };
    return { ok: true, aparelhoId: id };
  });
}

// Desconta do saldo o valor do uso (mesmos preços do faturamento). Fire-and-forget das APIs de IA.
export async function debitarCreditosUso({ aparelhoId, tarefa, entrada, saida, caracteres, segundos }) {
  const id = aparelhoIdLimpo(aparelhoId);
  if (!id || !acessoSiteConfigurado()) return;
  try {
    // Import dinâmico evita dependência circular com api/_faturamento.mjs.
    const { lerConfigFaturamento, RECURSOS, valorDoUso } = await import("./_faturamento.mjs");
    const nome = String(tarefa || "").trim();
    const recurso = RECURSOS.find((x) => x.tarefas.includes(nome));
    const cat = recurso ? recurso.cat : "texto";
    const config = await lerConfigFaturamento();
    const uso = {
      in: Math.max(0, Math.floor(Number(entrada) || 0)),
      out: Math.max(0, Math.floor(Number(saida) || 0)),
      car: Math.max(0, Math.floor(Number(caracteres) || 0)),
      seg: Math.max(0, Math.round(Number(segundos) || 0)),
    };
    const valor = arredondarSaldo(valorDoUso(cat, uso, config.precos));
    if (valor <= 0) return;
    await comDados((dados) => {
      const reg = dados.aprovados[id];
      if (!reg) return null;
      lancarExtrato(reg, { tipo: "consumo", rotulo: recurso ? recurso.rotulo : "Outros usos de IA", delta: -valor });
      concederEmergencia(reg, dados); // 6.14.63: o consumo zerou o saldo: entra o crédito de emergência
      return { ok: true, creditos: reg.creditos, debitado: valor };
    });
  } catch (e) {
    console.error("Créditos: débito falhou", e && e.message);
  }
}
