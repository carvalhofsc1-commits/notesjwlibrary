// Configurações editáveis pelo administrador: prompts da IA (tom e regras) e modelos padrão do app.
// Tudo o que muda dados exige o CODIGO_ADMIN, conferido aqui no servidor. A leitura dos modelos padrão é pública.
import { codigoDoDirigente, erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { diagnosticar, escritaDisponivel, leituraDisponivel, lerItem, gravarItem } from "./_armazem.mjs";
import { CATEGORIAS, LIMITES, PARTES, aplicarLimites, categoriaDaParte, limitesPublicos, travadosDe, validarAlteracoes, validarLimites } from "./_prompts.mjs";
import { esquecerCache, gravarAlteracoes, gravarLimites, lerAlteracoes, lerAnterior, lerLimites } from "./_promptsArmazenados.mjs";
import { configPublicaVoz, gravarConfigVoz, lerConfigVoz, opcoesVoz } from "./_vozConfig.mjs";
import { gravarConfigIa, lerConfigIa, lerCustoIa, opcoesIa } from "./_iaConfig.mjs";
import { acrescentarLicao, alterarLicao, analisarCorrecao, apagarLicao, apagarTudo, ligarMemoria, lerMemoria, memoriaConfigurada } from "./_memoria.mjs";
import { apagarEsboco, gravarEsbocos, gravarTemas, lerIndice, lerTemas, s34Configurado, temasDoTexto } from "./_s34.mjs";

const CHAVE_PADRAO = "padrao_modelos";
// Anotação do administrador (ex.: o código de pesquisa, para não esquecer). Só é lida e gravada com o
// CODIGO_ADMIN; não vale como senha de nada: o código que funciona de verdade é o da variável CODIGO_ESTUDO na Vercel.
const CHAVE_ANOTACAO = "anotacao_admin";
const CHAVE_ANOTACAO_DIRIGENTE = "anotacao_dirigente"; // a mesma ideia, para o código do dirigente (variável CODIGO_DIRIGENTE)
const CHAVE_ANOTACAO_LEITURA = "anotacao_leitura"; // e para o código de leitura (variável CODIGO_LEITURA)
const MAX_CHARS_ANOTACAO = 500;
// Texto do convite para o app (página Sobre): o administrador o escreve e ele vale para todos; vazio = vale o texto original do app.
const CHAVE_CONVITE = "convite_texto";
const MAX_CHARS_CONVITE = 1500;
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
    anotacaoDirigente: await lerAnotacao(CHAVE_ANOTACAO_DIRIGENTE),
    anotacaoLeitura: await lerAnotacao(CHAVE_ANOTACAO_LEITURA),
  };
}

async function lerAnotacao(chave = CHAVE_ANOTACAO) {
  const valor = await lerItem(chave);
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

// Esboços de discursos públicos (S-34): o que está importado e a lista de temas.
async function estadoS34() {
  return { configurado: s34Configurado(), indice: await lerIndice(), temas: await lerTemas() };
}

function exigirS34(res) {
  if (s34Configurado()) return true;
  erro(res, 503, "O armazenamento privado (Blob) ainda não está configurado no servidor para os esboços S-34.");
  return false;
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

    // Pública: o texto do convite para o app que o administrador salvou (vazio = o texto original do app).
    if (acao === "convite-ler") {
      const valor = await lerItem(CHAVE_CONVITE);
      return res.status(200).json({ texto: typeof valor === "string" ? valor : "" });
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

    // Confere o código de leitura (CODIGO_LEITURA) quando ele é salvo em Ajustes: libera a tela Leitura em voz alta (api/voz.mjs, uso "leitura").
    if (acao === "leitura-conferir") {
      if (!process.env.CODIGO_LEITURA) return erro(res, 503, "O código de leitura ainda não está configurado no servidor.");
      if (!textosIguais(corpo.codigo, process.env.CODIGO_LEITURA)) {
        registrarErro(ip);
        return erro(res, 403, "Código de leitura incorreto.");
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

    // Volta TODOS os textos editáveis ao padrão do código. Os limites e o modelo da IA não mudam. Guarda os atuais como "anterior",
    // então "Voltar à versão anterior" desfaz.
    if (acao === "prompts-restaurar-tudo") {
      if (!exigirEscrita(res)) return;
      const atuais = await lerAlteracoes();
      await gravarAlteracoes({}, atuais);
      return res.status(200).json(await estadoDosPrompts());
    }

    if (acao === "prompts-desfazer") {
      if (!exigirEscrita(res)) return;
      const anterior = await lerAnterior();
      const atuais = await lerAlteracoes();
      await gravarAlteracoes(anterior, atuais);
      return res.status(200).json(await estadoDosPrompts());
    }

    // Memória de lições das correções (piloto, só administrador): por enquanto só guarda; nenhuma resposta da IA a usa.
    if (acao.startsWith("memoria-")) {
      if (!memoriaConfigurada()) return erro(res, 503, "O armazenamento privado (Blob) ainda não está configurado no servidor para a memória de correções.");
      if (acao === "memoria-ler") return res.status(200).json({ memoria: await lerMemoria() });
      if (acao === "memoria-ligar") return res.status(200).json({ memoria: await ligarMemoria(corpo.ligada) });
      if (acao === "memoria-guardar") {
        if (!(await lerMemoria()).ligada) return erro(res, 403, "A chave geral do piloto está desligada (Prompts da IA → Memória de correções).");
        // A IA compara os dois textos e devolve só a lição; os textos são descartados, nunca gravados.
        const a = await analisarCorrecao(corpo);
        if (a.erro) return erro(res, 400, a.erro);
        if (a.naoAproveitavel) return res.status(200).json({ guardada: false, motivo: a.naoAproveitavel });
        const r = await acrescentarLicao(a.licao);
        return r.erro ? erro(res, 400, r.erro) : res.status(200).json({ guardada: true, licao: r.item, memoria: r.memoria });
      }
      if (acao === "memoria-ativar") {
        const r = await alterarLicao(String(corpo.id || ""), corpo.ativo);
        return r.erro ? erro(res, 404, r.erro) : res.status(200).json({ memoria: r.memoria });
      }
      if (acao === "memoria-apagar") {
        const r = await apagarLicao(String(corpo.id || ""));
        return r.erro ? erro(res, 404, r.erro) : res.status(200).json({ memoria: r.memoria });
      }
      if (acao === "memoria-apagar-tudo") return res.status(200).json({ memoria: (await apagarTudo()).memoria });
      return erro(res, 400, "Ação desconhecida.");
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

    // Esboços de discursos públicos (S-34), importados pela tela de Ajustes.
    if (acao === "s34-estado") {
      return res.status(200).json(await estadoS34());
    }

    // Confere (somenteConferir) ou grava até 25 esboços por pedido; devolve o que é novo, atualizado, igual ou inválido.
    if (acao === "s34-gravar") {
      if (!exigirS34(res)) return;
      const esbocos = Array.isArray(corpo.esbocos) ? corpo.esbocos : [];
      if (!esbocos.length) return erro(res, 400, "Nenhum esboço enviado.");
      if (esbocos.length > 25) return erro(res, 400, "Esboços demais num pedido (no máximo 25).");
      return res.status(200).json(await gravarEsbocos(esbocos, { somenteConferir: corpo.somenteConferir === true }));
    }

    // A lista dos temas (um por linha, "1. Título"): serve para conferir os arquivos importados e ver o que falta.
    if (acao === "s34-lista-salvar") {
      if (!exigirS34(res)) return;
      const { itens, problemas } = temasDoTexto(corpo.texto);
      if (!itens.length) return erro(res, 400, "Não encontrei temas numerados (um por linha, como \"1. Você conhece bem a Deus?\").");
      await gravarTemas(itens);
      return res.status(200).json({ quantidade: itens.length, problemas, temas: await lerTemas() });
    }

    if (acao === "s34-apagar") {
      if (!exigirS34(res)) return;
      const numero = Number(corpo.numero);
      if (!Number.isInteger(numero) || numero < 1 || numero > 999) return erro(res, 400, "Número do tema inválido.");
      return res.status(200).json({ apagado: await apagarEsboco(numero), indice: await lerIndice() });
    }

    if (acao === "anotacao-salvar") {
      if (!exigirEscrita(res)) return;
      const texto = typeof corpo.anotacao === "string" ? corpo.anotacao.trim().slice(0, MAX_CHARS_ANOTACAO) : "";
      await gravarItem(CHAVE_ANOTACAO, texto);
      return res.status(200).json({ ok: true, anotacao: texto });
    }

    if (acao === "anotacao-dirigente-salvar") {
      if (!exigirEscrita(res)) return;
      const texto = typeof corpo.anotacao === "string" ? corpo.anotacao.trim().slice(0, MAX_CHARS_ANOTACAO) : "";
      await gravarItem(CHAVE_ANOTACAO_DIRIGENTE, texto);
      return res.status(200).json({ ok: true, anotacao: texto });
    }

    if (acao === "anotacao-leitura-salvar") {
      if (!exigirEscrita(res)) return;
      const texto = typeof corpo.anotacao === "string" ? corpo.anotacao.trim().slice(0, MAX_CHARS_ANOTACAO) : "";
      await gravarItem(CHAVE_ANOTACAO_LEITURA, texto);
      return res.status(200).json({ ok: true, anotacao: texto });
    }

    if (acao === "convite-salvar") {
      if (!exigirEscrita(res)) return;
      const texto = typeof corpo.texto === "string" ? corpo.texto.replace(/\r\n/g, "\n").trim().slice(0, MAX_CHARS_CONVITE) : "";
      await gravarItem(CHAVE_CONVITE, texto);
      return res.status(200).json({ ok: true, texto });
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
