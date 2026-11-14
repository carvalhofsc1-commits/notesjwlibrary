// Cadastro obrigatório de cada aparelho: todo cadastro novo fica pendente até o administrador aprovar.
// Também guarda créditos (R$) e códigos personalizados por recurso de cada usuário.
// Dados no Vercel Blob PRIVADO: "estatisticas/acesso-site.json".
// ACESSO_SITE_DIR (só testes locais) troca o Blob por uma pasta.
import { randomBytes, randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
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
const PREFIXO_CODIGO = { pesquisa: "PES", dirigente: "DIR", leitura: "LEI", texto: "AUD", resumo: "RES", s34: "S34" };

export function acessoSiteConfigurado() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.ACESSO_SITE_DIR || process.env.ESTATISTICAS_DIR);
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
function creditosDe(registro) {
  const n = Number(registro && registro.creditos);
  return Number.isFinite(n) && n > 0 ? arredondarSaldo(n) : 0;
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

// Cache curto dos códigos personalizados ativos: permite conferência síncrona nas APIs de IA.
let cacheCodigos = { em: 0, mapa: new Map() }; // codigoLower -> { recurso, aparelhoId }

function montarCacheCodigos(dados) {
  const mapa = new Map();
  for (const [aparelhoId, reg] of Object.entries((dados && dados.aprovados) || {})) {
    const codigos = codigosDe(reg);
    for (const [recurso, c] of Object.entries(codigos)) {
      if (!c.ativo || !c.codigo) continue;
      mapa.set(c.codigo.trim().toLowerCase(), { recurso, aparelhoId });
    }
  }
  cacheCodigos = { em: Date.now(), mapa };
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

// Aceita o código global do servidor ou o personalizado deste aparelho.
export function recursoCodigoValido(recurso, codigo, aparelhoId) {
  const global = codigoGlobalDoRecurso(recurso);
  if (global && textosIguais(codigo, global)) return true;
  return codigoPessoalSync(recurso, codigo, aparelhoId);
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
    codigos: codigosDe(a),
  };
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
  const dados = await lerRecente();
  const id = aparelhoIdLimpo(aparelhoId);
  if (id && dados.aprovados[id]) {
    // Os códigos personalizados não vão nesta resposta pública (só o administrador os vê, na Administração de usuários).
    const { codigos, ...cadastro } = identidadeDe(dados.aprovados[id]);
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
  return "Seus créditos de IA acabaram. Peça ao administrador para carregar mais créditos.";
}

export async function pedirAcessoSite(corpo) {
  const id = aparelhoIdLimpo(corpo && corpo.aparelhoId);
  if (!id) return { erro: "Não foi possível identificar este aparelho. Atualize o app e tente de novo." };
  const validado = camposDoCorpo(corpo);
  if (validado.erro) return { erro: validado.erro };
  const { campos } = validado;

  return comDados((dados) => {
    if (dados.aprovados[id]) return { ok: true, jaAprovado: true, identificado: true, cadastro: identidadeDe(dados.aprovados[id]) };
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
      codigos: codigosDe(anterior),
    });
    return { ok: true, atualizado: true, cadastro: identidadeDe(dados.aprovados[id]) };
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
        { pedidoId: p.id, aprovadoEm: p.decididoEm, creditos: 0, codigos: {} }
      );
    }
    return { ok: true, pedido: pedidoPublico(p) };
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
export async function creditarUsuario({ aparelhoId, valor, codigoAdmin }) {
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
    reg.creditos = Math.max(0, arredondarSaldo(creditosDe(reg) + soma));
    reg.creditosAtualizadoEm = agoraIso();
    return { ok: true, creditos: reg.creditos, aparelhoId: id };
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
      reg.creditos = Math.max(0, arredondarSaldo(creditosDe(reg) - valor));
      reg.creditosAtualizadoEm = agoraIso();
      return { ok: true, creditos: reg.creditos, debitado: valor };
    });
  } catch (e) {
    console.error("Créditos: débito falhou", e && e.message);
  }
}
