// Configurações editáveis pelo administrador: prompts da IA (tom e regras) e modelos padrão do app.
// Tudo o que muda dados exige o CODIGO_ADMIN, conferido aqui no servidor. A leitura dos modelos padrão é pública.
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { escritaDisponivel, leituraDisponivel, lerItem, gravarItem } from "./_armazem.mjs";
import { PARTES, TRAVADOS, validarAlteracoes } from "./_prompts.mjs";
import { esquecerCache, gravarAlteracoes, lerAlteracoes, lerAnterior } from "./_promptsArmazenados.mjs";

const CHAVE_PADRAO = "padrao_modelos";
const MAX_BYTES_PADRAO = 200_000;
const MAX_MODELOS_PADRAO = 500;

// Tentativas erradas do código de administrador, por IP (em memória, por instância).
const erros = new Map();
const MAX_ERROS_POR_HORA = 10;

function bloqueado(ip) {
  const agora = Date.now();
  const lista = (erros.get(ip) || []).filter((t) => agora - t < 60 * 60 * 1000);
  erros.set(ip, lista);
  return lista.length >= MAX_ERROS_POR_HORA;
}

function registrarErro(ip) {
  const lista = erros.get(ip) || [];
  lista.push(Date.now());
  erros.set(ip, lista);
  if (erros.size > 5000) erros.clear();
}

function descreverArmazenamento() {
  return { leitura: leituraDisponivel(), escrita: escritaDisponivel() };
}

async function estadoDosPrompts() {
  const alteracoes = await lerAlteracoes();
  const anterior = await lerAnterior();
  return {
    partes: PARTES.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      descricao: p.descricao,
      padrao: p.padrao,
      valor: typeof alteracoes[p.id] === "string" ? alteracoes[p.id] : p.padrao,
      personalizado: typeof alteracoes[p.id] === "string" && alteracoes[p.id] !== p.padrao,
    })),
    travados: TRAVADOS.map((t) => ({ id: t.id, titulo: t.titulo, texto: t.texto })),
    armazenamento: descreverArmazenamento(),
    temAnterior: Object.keys(anterior).length > 0,
  };
}

// Só guarda o que difere do padrão.
function soDiferencas(valores) {
  const resultado = {};
  for (const p of PARTES) {
    if (typeof valores[p.id] === "string" && valores[p.id].trim() !== p.padrao.trim()) resultado[p.id] = valores[p.id];
  }
  return resultado;
}

function exigirEscrita(res) {
  if (escritaDisponivel()) return true;
  erro(res, 503, "O armazenamento (Global Config) ainda não está configurado no servidor para gravar alterações.");
  return false;
}

function padraoValido(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return "JSON inválido.";
  if (!Array.isArray(dados.templates)) return "O JSON precisa ter a lista de modelos (templates).";
  if (dados.templates.length > MAX_MODELOS_PADRAO) return "Modelos demais no JSON.";
  if (dados.preferencias !== undefined && (!dados.preferencias || typeof dados.preferencias !== "object" || Array.isArray(dados.preferencias))) return "Opções do app inválidas no JSON.";
  if (Buffer.byteLength(JSON.stringify(dados), "utf8") > MAX_BYTES_PADRAO) return "JSON grande demais para publicar como padrão.";
  return null;
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
    // Pública: os modelos padrão publicados pelo administrador (o app cai no defaults.json se não houver).
    if (acao === "padrao-ler") {
      const dados = await lerItem(CHAVE_PADRAO);
      const valido = dados && typeof dados === "object" && Array.isArray(dados.templates) ? dados : null;
      return res.status(200).json({ dados: valido });
    }

    // Daqui em diante, só o administrador.
    if (!process.env.CODIGO_ADMIN) return erro(res, 503, "O código de administrador ainda não está configurado no servidor.");

    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
    if (bloqueado(ip)) return erro(res, 429, "Muitas tentativas erradas. Tente novamente mais tarde.");
    if (!textosIguais(corpo.codigo, process.env.CODIGO_ADMIN)) {
      registrarErro(ip);
      return erro(res, 403, "Código de administrador incorreto.");
    }

    if (acao === "admin-entrar") {
      return res.status(200).json({ ok: true, armazenamento: descreverArmazenamento() });
    }

    if (acao === "prompts-ler") {
      return res.status(200).json(await estadoDosPrompts());
    }

    if (acao === "prompts-salvar") {
      if (!exigirEscrita(res)) return;
      const checagem = validarAlteracoes(corpo.alteracoes);
      if (!checagem.ok) return erro(res, 400, checagem.erro);

      const atuais = await lerAlteracoes();
      const novas = soDiferencas({ ...atuais, ...checagem.valores });
      await gravarAlteracoes(novas, atuais);
      return res.status(200).json(await estadoDosPrompts());
    }

    if (acao === "prompts-restaurar") {
      if (!exigirEscrita(res)) return;
      const id = String(corpo.id || "");
      if (!PARTES.some((p) => p.id === id)) return erro(res, 400, "Prompt desconhecido.");

      const atuais = await lerAlteracoes();
      const { [id]: _removido, ...resto } = atuais;
      await gravarAlteracoes(resto, atuais);
      return res.status(200).json(await estadoDosPrompts());
    }

    if (acao === "prompts-desfazer") {
      if (!exigirEscrita(res)) return;
      const anterior = await lerAnterior();
      const atuais = await lerAlteracoes();
      await gravarAlteracoes(anterior, atuais);
      return res.status(200).json(await estadoDosPrompts());
    }

    if (acao === "padrao-publicar") {
      if (!exigirEscrita(res)) return;
      const problema = padraoValido(corpo.dados);
      if (problema) return erro(res, 400, problema);
      await gravarItem(CHAVE_PADRAO, corpo.dados);
      return res.status(200).json({ ok: true, modelos: corpo.dados.templates.length });
    }

    return erro(res, 400, "Ação desconhecida.");
  } catch (e) {
    esquecerCache();
    console.error("Erro em /api/config:", e && e.message);
    return erro(res, 502, "Não foi possível concluir agora: " + (e && e.message ? e.message : "erro desconhecido"));
  }
}
