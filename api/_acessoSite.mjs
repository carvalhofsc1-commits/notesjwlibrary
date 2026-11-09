// Cadastro obrigatório de cada aparelho + opção de exigir aprovação do administrador.
// Dados no Vercel Blob PRIVADO: "estatisticas/acesso-site.json".
// Todo aparelho (inclusive o do administrador) precisa se identificar uma vez.
// Com "restringir" ligado, o cadastro fica pendente até o administrador aprovar.
// ACESSO_SITE_DIR (só testes locais) troca o Blob por uma pasta.
import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { textosIguais } from "./_comum.mjs";
import { aparelhoIdLimpo } from "./_estatisticas.mjs";

const NOME = "estatisticas/acesso-site.json";
const MAX_PEDIDOS = 500;

export function acessoSiteConfigurado() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.ACESSO_SITE_DIR || process.env.ESTATISTICAS_DIR);
}

function agoraIso() {
  return new Date().toISOString();
}

function vazio() {
  return { versao: 1, atualizadoEm: agoraIso(), restringir: false, pedidos: [], aprovados: {} };
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
    const resultado = (await mutar(dados)) || null;
    await gravarBruto(dados);
    return resultado;
  });
}

const limpar = (valor, max) =>
  typeof valor === "string" ? valor.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim().slice(0, max) : "";

function pedidoPublico(p) {
  return {
    id: p.id,
    aparelhoId: String(p.aparelhoId || "").slice(0, 8),
    nome: p.nome,
    sobrenome: p.sobrenome,
    idade: p.idade,
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

function identidadeDe(a) {
  const { nome, sobrenome } = nomeESobrenome(a);
  return {
    nome,
    sobrenome,
    nomeCompleto: `${nome} ${sobrenome}`.trim(),
    idade: a.idade || null,
    cidadeEstado: a.cidadeEstado || "",
    congregacao: a.congregacao || "",
    comoConheceu: a.comoConheceu || "",
    aprovadoEm: a.aprovadoEm || "",
    pedidoId: a.pedidoId || "",
  };
}

function camposDoCorpo(corpo) {
  const nome = limpar(corpo && corpo.nome, 60);
  const sobrenome = limpar(corpo && corpo.sobrenome, 60);
  const cidadeEstado = limpar(corpo && corpo.cidadeEstado, 80);
  const congregacao = limpar(corpo && corpo.congregacao, 100);
  const comoConheceu = limpar(corpo && corpo.comoConheceu, 200);
  const idade = Math.round(Number(corpo && corpo.idade));
  if (!nome || !sobrenome) return { erro: "Informe o nome e o sobrenome." };
  if (!Number.isFinite(idade) || idade < 12 || idade > 120) return { erro: "Informe uma idade válida." };
  if (!cidadeEstado) return { erro: "Informe a cidade e o estado." };
  if (!congregacao) return { erro: "Informe o nome da congregação." };
  if (!comoConheceu) return { erro: "Informe como você conheceu o app." };
  return { campos: { nome, sobrenome, idade, cidadeEstado, congregacao, comoConheceu } };
}

function gravarIdentidade(dados, id, campos, { pedidoId = "", statusPedido = "aprovado", aprovadoEm } = {}) {
  const agora = agoraIso();
  const pedido = {
    id: pedidoId || randomUUID(),
    aparelhoId: id,
    nome: campos.nome,
    sobrenome: campos.sobrenome,
    idade: campos.idade,
    cidadeEstado: campos.cidadeEstado,
    congregacao: campos.congregacao,
    comoConheceu: campos.comoConheceu,
    criadoEm: agora,
    status: statusPedido,
    decididoEm: statusPedido === "pendente" ? null : agora,
  };
  if (statusPedido === "pendente") {
    dados.pedidos.unshift(pedido);
    if (dados.pedidos.length > MAX_PEDIDOS) dados.pedidos.length = MAX_PEDIDOS;
    return pedido;
  }
  dados.aprovados[id] = {
    pedidoId: pedido.id,
    aprovadoEm: aprovadoEm || agora,
    nome: campos.nome,
    sobrenome: campos.sobrenome,
    idade: campos.idade,
    cidadeEstado: campos.cidadeEstado,
    congregacao: campos.congregacao,
    comoConheceu: campos.comoConheceu,
  };
  dados.pedidos.unshift(pedido);
  if (dados.pedidos.length > MAX_PEDIDOS) dados.pedidos.length = MAX_PEDIDOS;
  return pedido;
}

// Estado para o aparelho (público): cadastro obrigatório; com restrição, pode ficar pendente.
export async function estadoAcessoSite({ aparelhoId } = {}) {
  if (!acessoSiteConfigurado()) {
    return { configurado: false, restringir: false, ok: true };
  }
  const dados = (await lerBruto()) || vazio();
  const restringir = Boolean(dados.restringir);
  const id = aparelhoIdLimpo(aparelhoId);
  if (id && dados.aprovados[id]) {
    const cadastro = identidadeDe(dados.aprovados[id]);
    return {
      configurado: true,
      restringir,
      ok: true,
      identificado: true,
      nome: cadastro.nomeCompleto,
      cadastro,
    };
  }
  const pendente = id ? dados.pedidos.find((p) => p.aparelhoId === id && p.status === "pendente") : null;
  const recusado = id ? [...dados.pedidos].reverse().find((p) => p.aparelhoId === id && p.status === "recusado") : null;
  return {
    configurado: true,
    restringir,
    ok: false,
    precisaCadastro: true,
    pendente: Boolean(pendente),
    recusado: Boolean(recusado) && !pendente,
  };
}

// Usado pelas APIs: devolve null se pode seguir, ou mensagem de erro.
export async function mensagemSeBloqueado({ aparelhoId } = {}) {
  const e = await estadoAcessoSite({ aparelhoId });
  if (!e.configurado || e.ok) return null;
  if (e.pendente) return "Seu cadastro ainda está em análise. Quando for aprovado, abra o app de novo.";
  if (e.recusado) return "O cadastro deste aparelho foi recusado. Se precisar, envie um novo cadastro pelo formulário.";
  return "É preciso se identificar para usar o NoteStyle. Preencha o formulário de cadastro.";
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
    if (dados.restringir) {
      const pedido = gravarIdentidade(dados, id, campos, { statusPedido: "pendente" });
      return { ok: true, pendente: true, id: pedido.id };
    }
    const pedido = gravarIdentidade(dados, id, campos, { statusPedido: "aprovado" });
    return { ok: true, identificado: true, id: pedido.id, cadastro: identidadeDe(dados.aprovados[id]) };
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
    dados.aprovados[id] = {
      pedidoId: anterior.pedidoId || "",
      aprovadoEm: anterior.aprovadoEm || agoraIso(),
      atualizadoEm: agoraIso(),
      nome: campos.nome,
      sobrenome: campos.sobrenome,
      idade: campos.idade,
      cidadeEstado: campos.cidadeEstado,
      congregacao: campos.congregacao,
      comoConheceu: campos.comoConheceu,
    };
    return { ok: true, atualizado: true, cadastro: identidadeDe(dados.aprovados[id]) };
  });
}

export async function lerAcessoSiteAdmin() {
  const dados = (await lerBruto()) || vazio();
  const pendentes = dados.pedidos.filter((p) => p.status === "pendente").map(pedidoPublico);
  const recentes = dados.pedidos.filter((p) => p.status !== "pendente").slice(0, 40).map(pedidoPublico);
  const aprovados = Object.entries(dados.aprovados || {}).map(([aparelhoId, a]) => ({
    aparelhoId: aparelhoId.slice(0, 8),
    aparelhoIdCompleto: aparelhoId,
    ...identidadeDe(a),
  }));
  aprovados.sort((a, b) => String(b.aprovadoEm).localeCompare(String(a.aprovadoEm)));
  return {
    configurado: true,
    restringir: Boolean(dados.restringir),
    atualizadoEm: dados.atualizadoEm || "",
    pendentes,
    recentes,
    aprovados: aprovados.slice(0, 100),
  };
}

// Liga/desliga a exigência de aprovação do administrador nos cadastros novos.
export async function definirRestricaoSite(ligada) {
  return comDados((dados) => {
    dados.restringir = Boolean(ligada);
    return { restringir: dados.restringir, avos: 0 };
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
      dados.aprovados[p.aparelhoId] = {
        pedidoId: p.id,
        aprovadoEm: p.decididoEm,
        nome: p.nome,
        sobrenome: p.sobrenome,
        idade: p.idade,
        cidadeEstado: p.cidadeEstado,
        congregacao: p.congregacao,
        comoConheceu: p.comoConheceu,
      };
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
