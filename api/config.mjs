// Configurações editáveis pelo administrador: prompts da IA (tom e regras) e modelos padrão do app.
// Tudo o que muda dados exige o CODIGO_ADMIN, conferido aqui no servidor. A leitura dos modelos padrão é pública.
import { codigoDoDirigente, erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { diagnosticar, escritaDisponivel, leituraDisponivel, lerItem, gravarItem } from "./_armazem.mjs";
import { CATEGORIAS, LIMITES, PARTES, aplicarLimites, categoriaDaParte, limitesPublicos, travadosDe, validarAlteracoes, validarLimites } from "./_prompts.mjs";
import { esquecerCache, gravarAlteracoes, gravarLimites, lerAlteracoes, lerAnterior, lerLimites } from "./_promptsArmazenados.mjs";
import { configPublicaVoz, gravarConfigVoz, lerConfigVoz, opcoesVoz } from "./_vozConfig.mjs";
import { gravarConfigIa, lerConfigIa, lerCustoIa, opcoesIa } from "./_iaConfig.mjs";

const CHAVE_PADRAO = "padrao_modelos";
// Anotação do administrador (ex.: o código de pesquisa, para não esquecer). Só é lida e gravada com o
// CODIGO_ADMIN; não vale como senha de nada: o código que funciona de verdade é o da variável CODIGO_ESTUDO na Vercel.
const CHAVE_ANOTACAO = "anotacao_admin";
const MAX_CHARS_ANOTACAO = 500;
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
  const limites = aplicarLimites(await lerLimites());
  return {
    limites: LIMITES.map((l) => ({
      id: l.id,
      titulo: l.titulo,
      descricao: l.descricao,
      padrao: l.padrao,
      min: l.min,
      max: l.max,
      valor: limites[l.id],
    })),
    categorias: CATEGORIAS.map((cat) => ({ id: cat.id, emoji: cat.emoji, titulo: cat.titulo, cor: cat.cor, descricao: cat.descricao, partes: cat.partes })),
    partes: PARTES.map((p) => ({
      id: p.id,
      categoria: categoriaDaParte(p.id),
      titulo: p.titulo,
      descricao: p.descricao,
      padrao: p.padrao,
      valor: typeof alteracoes[p.id] === "string" ? alteracoes[p.id] : p.padrao,
      // Só diz se o texto salvo é diferente do original do app (habilita "Voltar ao texto original"); a tela não mostra mais
      // aviso de "personalizado": o que foi salvo para todos é o padrão oficial.
      personalizado: typeof alteracoes[p.id] === "string" && alteracoes[p.id] !== p.padrao,
    })),
    travados: travadosDe(limites).map((t) => ({ id: t.id, titulo: t.titulo, texto: t.texto })),
    armazenamento: descreverArmazenamento(),
    temAnterior: Object.keys(anterior).length > 0,
    anotacao: await lerAnotacao(),
  };
}

async function lerAnotacao() {
  const valor = await lerItem(CHAVE_ANOTACAO);
  return typeof valor === "string" ? valor : "";
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

    // Pública: os limites de tamanho que o navegador usa para avisar antes de enviar um texto grande demais.
    if (acao === "limites-ler") {
      return res.status(200).json({ limites: limitesPublicos(aplicarLimites(await lerLimites())) });
    }

    // Pública: as regras da leitura em voz alta que o navegador aplica ao texto (o resto fica no servidor).
    if (acao === "voz-publica") {
      return res.status(200).json({ voz: configPublicaVoz(await lerConfigVoz()) });
    }

    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
    if (bloqueado(ip)) return erro(res, 429, "Muitas tentativas erradas. Tente novamente mais tarde.");

    // Confere o código de pesquisa (CODIGO_ESTUDO) quando ele é salvo em Ajustes → Autorização de acessos.
    if (acao === "codigo-conferir") {
      if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "O código de pesquisa ainda não está configurado no servidor.");
      if (!textosIguais(corpo.codigo, process.env.CODIGO_ESTUDO)) {
        registrarErro(ip);
        return erro(res, 403, "Código de pesquisa incorreto.");
      }
      return res.status(200).json({ ok: true });
    }

    // Confere o código do dirigente (CODIGO_DIRIGENTE; sem a variável, o código de pesquisa) quando ele é salvo em Ajustes.
    if (acao === "dirigente-conferir") {
      const esperado = codigoDoDirigente();
      if (!esperado) return erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
      if (!textosIguais(corpo.codigo, esperado)) {
        registrarErro(ip);
        return erro(res, 403, "Código do dirigente incorreto.");
      }
      return res.status(200).json({ ok: true });
    }

    // Daqui em diante, só o administrador.
    if (!process.env.CODIGO_ADMIN) return erro(res, 503, "O código de administrador ainda não está configurado no servidor.");
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
      const checagem = validarAlteracoes(corpo.alteracoes || {});
      if (!checagem.ok) return erro(res, 400, checagem.erro);
      const checagemLimites = validarLimites(corpo.limites);
      if (!checagemLimites.ok) return erro(res, 400, checagemLimites.erro);

      if (Object.keys(checagem.valores).length) {
        const atuais = await lerAlteracoes();
        const novas = soDiferencas({ ...atuais, ...checagem.valores });
        await gravarAlteracoes(novas, atuais);
      }
      if (Object.keys(checagemLimites.valores).length) {
        // Só guarda o que difere do padrão.
        const juntos = { ...(await lerLimites()), ...checagemLimites.valores };
        const diferencas = {};
        for (const l of LIMITES) if (juntos[l.id] !== undefined && Number(juntos[l.id]) !== l.padrao) diferencas[l.id] = Number(juntos[l.id]);
        await gravarLimites(diferencas);
      }
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

    if (acao === "voz-ler") {
      return res.status(200).json({ config: await lerConfigVoz(), opcoes: opcoesVoz(), armazenamento: descreverArmazenamento() });
    }

    if (acao === "voz-salvar") {
      if (!exigirEscrita(res)) return;
      return res.status(200).json({ config: await gravarConfigVoz(corpo.config) });
    }

    // Modelo e esforço da IA de texto (tela de prompts).
    if (acao === "ia-ler") {
      return res.status(200).json({ config: await lerConfigIa(), opcoes: opcoesIa(), armazenamento: descreverArmazenamento() });
    }

    if (acao === "ia-salvar") {
      if (!exigirEscrita(res)) return;
      return res.status(200).json({ config: await gravarConfigIa(corpo.config) });
    }

    // Gasto do mês com a IA de texto, pela Cost API da Anthropic (precisa de ANTHROPIC_ADMIN_KEY).
    if (acao === "ia-custo") {
      try {
        return res.status(200).json(await lerCustoIa());
      } catch (e) {
        console.error("Custo da IA: a Anthropic recusou a consulta", e.status, e.message);
        const mensagem =
          e.status === 401 || e.status === 403
            ? "A Anthropic recusou a chave de administrador (ANTHROPIC_ADMIN_KEY). Confira a chave no Claude Console."
            : "Não consegui consultar o gasto na Anthropic agora. Tente de novo.";
        return erro(res, 502, mensagem);
      }
    }

    if (acao === "anotacao-salvar") {
      if (!exigirEscrita(res)) return;
      const texto = typeof corpo.anotacao === "string" ? corpo.anotacao.trim().slice(0, MAX_CHARS_ANOTACAO) : "";
      await gravarItem(CHAVE_ANOTACAO, texto);
      return res.status(200).json({ ok: true, anotacao: texto });
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
    const motivo = e && e.message ? e.message : "erro desconhecido";
    // Recusa da Vercel ao gravar: junta um resumo do que o token enxerga (sem segredos) para facilitar o conserto.
    const diagnostico = /recusou/.test(motivo) ? " Diagnóstico: " + (await diagnosticar().catch(() => "indisponível")) + "." : "";
    return erro(res, 502, "Não foi possível concluir agora: " + motivo + diagnostico);
  }
}
