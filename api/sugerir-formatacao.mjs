// Função serverless (Vercel) que pede à IA sugestões de formatação para as linhas do texto.
// A chave da API fica só aqui, na variável de ambiente ANTHROPIC_API_KEY (ou a conta de serviço do Google, se o administrador escolheu o Claude pelo Vertex) — nunca vai para o navegador.
import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { codigoDoDirigente, erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { acessoDoDirigente, codigoValido, dirigenteValido, exigirAcesso, recusarAcesso, resumoValido } from "./_acesso.mjs";
import { MODELOS_IA, TAREFAS_DE_ESBOCOS, iaDaTarefa, lerConfigIa, provedorAtual, provedorDoModelo } from "./_iaConfig.mjs";
import { apagarResultado, guardarResultado, idDePedidoValido, lerResultado, pedidosDisponiveis } from "./_pedidos.mjs";
import { criarClienteIa, erroSemIa, iaDisponivel } from "./_clienteIa.mjs";
import { blocoLicoesPara } from "./_memoria.mjs";
import { aparelhoIdLimpo, registrarUsoIa } from "./_estatisticas.mjs";
import { debitarCreditosUso, mensagemSeBloqueado, mensagemSeSemCredito, prepararCodigosPessoais } from "./_acessoSite.mjs";
import { emitirCupomVoz } from "./_vozCupom.mjs";
import { carregarPrompts } from "./_promptsArmazenados.mjs";
import { materiasAutomaticas, pesquisarPorPalavras } from "./_materiasWol.mjs";
import { buscarNosLivros, buscarVerbete, buscarVersiculos, versiculosDoCapitulo, fontesConfiguradas, lerCanticos, precarregarFontes, referenciasNoTexto, textoDeGruposBiblicos } from "./_fontes.mjs";
import { lerEsboco, lerIndice, minutosDoEsboco, publicacoesDaSecao, referenciasDoPublico, s34Configurado, textoDoDiscursoPublico, textoDoEsbocoImportado, textosBiblicosDoPublico, validarEsboco } from "./_s34.mjs";
import {
  QUADROS_EBC,
  garantirTrechosEbc,
  lerEstudoBiblico,
  lerCamposDoDocumento,
  lerArtigoDoWol,
  lerReuniaoDaSemana,
  lerEstudoDaSemana,
  lerEstudoDireto,
  lerImagensDaApostila,
  lerDiscursoCurto,
  lerConsideracoes,
  lerPartesDaApostila,
  textoDasConsideracoes,
  perguntasDasConsideracoes,
  lerNossaVidaCrista,
  textoDaNossaVidaCrista,
  lerJoias,
  lerTesouros,
  lerTextoDiario,
  pesquisarNoWol,
  pesquisarParagrafosNoWol,
  paragrafoDaPesquisa,
  topicosDoGuiaPara,
  entradasDoGuia,
  faixaDoDocumento,
  paragrafosPorNumero,
  assuntosDoIndicePara,
  entradasDoIndice,
  trechoDaCitacaoDoIndice,
  siglasDasPublicacoes,
  siglasPossiveis,
  pesquisaDoVersiculo,
  notasDeEstudo,
  videoDoEndereco,
  menorMp4DoVideo,
  catalogoDeVideos,
  videosPorPalavras,
  secoesDosVideos,
  videosDaSecao,
  videosPorFalas,
  MAX_VIDEOS_FALAS,
  lerTextoDoVideo,
  referenciasDeTesouros,
  referenciasDoDiscursoCurto,
  semanasDosEstudos,
  textoDaRecapitulacao,
  textoDasJoias,
  textoDoCapituloEbc,
  textoDoCapituloEbcDirigente,
  textoDoDiscursoCurto,
  textoDosGrupos,
  textoDosTesouros,
  textosBiblicosDeTesouros,
  textosBiblicosDoDiscursoCurto,
  lerProgramaPublicacao,
  listarProgramas,
} from "./_wol.mjs";

// ---------- Modelo da IA ----------
// O modelo e o esforço vêm da escolha do administrador na tela de prompts (api/_iaConfig.mjs) e chegam em P.ia em
// cada pedido. Toda chamada à IA passa por chamarIa, que monta o pedido certo para o modelo escolhido:
//  - Esforço: quanto a IA pensa antes de responder ("low" é o padrão: rápido e barato). Modelos antigos (Haiku 4.5,
//    Sonnet 4.5...) não aceitam "effort": nesses casos ele não é enviado.
//  - semPensar: nas tarefas mecânicas (formatar linhas, escrever a aplicação de um versículo, listar os parágrafos) o
//    raciocínio interno só atrasa: no Haiku 5.5 ele é desligado (aceito com esforço low, medium ou high). Sonnet 5.5,
//    Opus 5.5 e Fable 5.1 recusam "disabled", então lá ele continua ligado e o esforço controla a demora.
//    CLAUDE_RACIOCINIO=on na Vercel deixa o Haiku pensar também nessas tarefas. Nas RESPOSTAS do estudo ele fica ligado:
//    sem ele as respostas saíam incoerentes.
//  - Recusa por engano: Sonnet 5.5, Opus 5.5 e Fable 5.1 têm filtros de segurança que às vezes recusam um pedido comum;
//    nesses modelos o pedido vai com o "fallback" do servidor da Anthropic, que refaz o pedido num modelo vizinho na
//    mesma chamada (o Haiku 5.5 não tem esse recurso).
const aceitaEsforco = (modelo) => !/haiku-4|sonnet-4-5|-3-/.test(modelo);
const temFallback = (modelo) => /^claude-(sonnet-5-5|opus-5-5|fable-5-1)$/.test(modelo);

// Contexto de cada pedido: se veio com o código de administrador (a memória de lições do piloto só vale para ele) e quantas lições
// entraram na última chamada com tarefa (memoriaUsada). Por pedido, para pedidos simultâneos na mesma instância não se misturarem.
const contextoDoPedido = new AsyncLocalStorage();
const memoriaUsadaAgora = () => contextoDoPedido.getStore()?.memoriaUsada || 0;

async function chamarIa(client, P, params, { schema = null, semPensar = false, tarefa = "" } = {}) {
  let system = params.system || "";
  // Só na chamada que informa a tarefa: as voltas seguintes (pause_turn) não zeram memoriaUsada.
  const contexto = contextoDoPedido.getStore();
  if (tarefa && contexto) {
    const m = contexto.admin ? await blocoLicoesPara(tarefa) : { texto: "", usadas: 0 };
    contexto.memoriaUsada = m.usadas;
    system += m.texto || "";
  }
  const { modelo, esforco } = P.ia;
  const fallback = temFallback(modelo) && provedorAtual() === "anthropic"; // o fallback do servidor é da API direta da Anthropic
  const formato = schema ? (fallback ? betaZodOutputFormat(schema) : zodOutputFormat(schema)) : null;
  const output_config = { ...(formato ? { format: formato } : {}), ...(aceitaEsforco(modelo) ? { effort: esforco } : {}) };
  const pensar =
    semPensar && /haiku-5|gemini/.test(modelo) && process.env.CLAUDE_RACIOCINIO !== "on" ? { thinking: { type: "disabled" } } : {};
  const corpo = { ...params, system, model: modelo, ...pensar, ...(Object.keys(output_config).length ? { output_config } : {}) };
  let saida;
  if (!fallback) {
    saida = schema ? await client.messages.parse(corpo) : await client.messages.create(corpo);
  } else {
    const comFallback = { ...corpo, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
    saida = schema ? await client.beta.messages.parse(comFallback) : await client.beta.messages.create(comFallback);
  }
  // Grava tokens ainda DENTRO do pedido, antes do res.json: depois da resposta a Vercel pode
  // congelar a função e um finally perdia o uso (foi o caso do resumo de capítulo da Bíblia).
  if (contexto) {
    const entrada = saida.usage?.input_tokens || 0;
    const saidaTok = saida.usage?.output_tokens || 0;
    contexto.consultasIa = (contexto.consultasIa || 0) + 1;
    contexto.modeloIa = modelo; // para o rodapé dos esboços (o modelo que elaborou de fato)
    contexto.provedorIa = P.ia.provedorTarefa || provedorAtual();
    contexto.tokensIn = (contexto.tokensIn || 0) + entrada;
    contexto.tokensOut = (contexto.tokensOut || 0) + saidaTok;
    if (tarefa) contexto.tarefaIa = tarefa;
    if (contexto.aparelhoId) {
      try {
        const uso = {
          aparelhoId: contexto.aparelhoId,
          tarefa: contexto.tarefaIa || tarefa || "ia",
          entrada,
          saida: saidaTok,
          consultas: 1,
        };
        await registrarUsoIa(uso);
        await debitarCreditosUso(uso);
      } catch (e) {
        console.error("Estatísticas: falha ao gravar uso da IA", e && e.message);
      }
    }
  }
  return saida;
}

// Os modelos mais potentes pensam mais e demoram mais: o tempo máximo de espera dobra com eles (até 170 s, para a
// resposta e a aplicação dos textos caberem nos 300 s da função na Vercel).
// Esboços e discursos: uma chamada só, até quase o limite de 300 s da função. Uma segunda tentativa depois de um tempo esgotado nunca caberia
// nos 300 s (e fazia a função inteira estourar sem resposta).
const TEMPO_ESBOCO_MS = 275_000;
// No Gemini o raciocínio consome maxOutputTokens junto com a saída; 40 mil dá folga para pensar e devolver o JSON completo (a API direta da Anthropic limita a 21 mil sem streaming).
const tetoTokensEsboco = () => (provedorAtual() === "gemini" ? 40000 : 21000);
const tempoIa = (P, base) => (/haiku|flash/.test(P.ia.modelo) ? base : Math.min(170_000, base * 2));
// Os textos dos prompts moram em _prompts.mjs (o administrador edita o tom e as regras pelo app).
// Os limites de tamanho e de quantidade (textos, destaques, respostas, pedidos por hora...) são configuráveis pelo
// administrador e chegam por P.limites (ver LIMITES em _prompts.mjs).
const MAX_MODELOS = 60;
const MAX_CHARS_MODELO = 200;
// Instruções adicionais do usuário para um pedido (campo de cada seção das reuniões) e instruções fixas (o app limita estas a 300): passam por textoLivre.
const MAX_TEXTO_LIVRE = 800;
// As instruções adicionais para a IA (o campo de cada seção) quase não têm limite: só um teto alto, para um pedido com erro não custar uma fortuna.
const MAX_AJUSTE = 30000;

const ESTILOS = ["negrito", "italico", "negrito_italico"];
// Tipos de fonte (alfabetos Unicode do app) que a IA pode escolher para um destaque, além do negrito/itálico da fonte
// principal. Só os legíveis em palavras e frases curtas.
// O gótico (fraktur) ficou de fora a pedido do usuário.
// Regra fixa do usuário: só estas três. Script, largura cheia, letras circuladas, gótico e monoespaçado ficam de fora.
const FONTES = ["doubleStruck", "sans", "squaredDark"];
// Os tipos de citação bíblica saíram do app (as opções de textos bíblicos cuidam disso); continuam aceitos aqui só para uma instrução
// salva por um administrador antes não derrubar a resposta. Todo destaque é tratado como "geral".
const TIPOS = ["geral", "citacao_texto", "citacao_referencia"];
// Os modelos de lista que o app já tem (seção "Inserir marcadores e numeradores de lista"). A IA escolhe um deles para
// cada lista; quem escreve os marcadores e os números é o app.
const MODELOS_LISTA = [
  "blueDiamond",
  "orangeDiamond",
  "smallBlueDiamond",
  "smallOrangeDiamond",
  "diamondDot",
  "gemDiamond",
  "bullet",
  "arrow",
  "check",
  "simpleCheck",
  "numberDot",
  "numberParen",
  "circled",
  "blackCircle",
  "keycapNumber",
  "squareBlue",
  "squareAlternate",
  "circleBlue",
  "circleAlternate",
];

const Saida = z.object({
  resumo: z.string().nullable(),
  sugestoes: z.array(
    z.object({
      linha: z.number().int(),
      modeloId: z.string().nullable(),
      emoji: z.string().nullable(),
      destaques: z.array(
        z.object({
          trecho: z.string(),
          tipo: z.enum(TIPOS),
          estilo: z.enum(ESTILOS).nullable(),
          maiusculas: z.boolean(),
          fonte: z.enum(FONTES).nullable(),
        })
      ),
      lista: z.object({ modelo: z.enum(MODELOS_LISTA), grupo: z.number().int() }).nullable(),
      quebras: z.array(z.string()),
      espacoAntes: z.boolean(),
    })
  ),
  textosRelevantes: z.array(z.string()),
  verbetes: z.array(z.string()),
});

// Limite simples por IP, em memória (vale por instância; a proteção real de custo é o limite de gastos do Console).
const acessos = new Map();

function excedeuLimite(ip, limitePorHora) {
  const agora = Date.now();
  const janela = 60 * 60 * 1000;
  const lista = (acessos.get(ip) || []).filter((t) => agora - t < janela);
  if (lista.length >= limitePorHora) {
    acessos.set(ip, lista);
    return true;
  }
  lista.push(agora);
  acessos.set(ip, lista);
  if (acessos.size > 5000) acessos.clear();
  return false;
}

function ipDoPedido(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
}

async function carregarPromptsEIa(tarefa = "") {
  const [prompts, ia] = await Promise.all([carregarPrompts(), lerConfigIa()]);
  return { ...prompts, ia: iaDaTarefa(ia, tarefa) }; // a Preparação de discursos e esboços (e o Preparar para dirigir) pode ter modelo e esforço próprios
}

// Tarefas que só leem o wol.jw.org, o Blob do S-34 ou os arquivos da Bíblia: não chamam a Anthropic.
const TAREFAS_SEM_IA = new Set([
  "ebc-ler",
  "consideracao-ler",
  "nvc-ler",
  "tesouros-ler",
  "publico-lista",
  "publico-ler",
  "publico-esboco",
  "versiculos",
  "anotacoes-versiculos",
  "pesquisa-versiculos",
  "pesquisa-videos-secoes",
  "pesquisa-videos-da-secao",
  "programa-pub",
  "programas-lista",
  "anotacoes-partes-semana",
  "estudo-paragrafos",
  "outros-pesquisar",
  "outros-ler",
  "discurso-ler",
  "joias-ler",
  "apostila-imagens",
  "backup-campos",
  "backup-semanas",
  "backup-semana",
]);

// Também gratuitas (não usam a IA), embora fiquem fora da lista acima: o texto do capítulo da Bíblia, a lista dos parágrafos do estudo
// (lida no site; só se falhar a IA entra, e aí o saldo é conferido) e buscar ou apagar o resultado de um pedido já feito.
const TAREFAS_GRATUITAS = new Set(["biblia-texto", "estudo-lista", "pedido-resultado", "pedido-apagar"]);

const INTENSIDADES = ["poucas", "moderada", "muitas"];
const TAMANHOS_RESUMO = ["curto", "medio", "detalhado"];
// Nome de cada tamanho nas partes editáveis ("Tamanho do resumo: médio", "Tamanho da resposta: médio").
const NOME_TAMANHO = { curto: "curto", medio: "médio", detalhado: "detalhado" };

// Troca {{nome}} pelos valores (uma passada só: o que o usuário digitou não é trocado de novo).
function trocar(frase, valores) {
  return String(frase || "").replace(/\{\{(\w+)\}\}/g, (marca, nome) => (nome in valores ? String(valores[nome]) : marca));
}

function textoLivre(valor, max = MAX_TEXTO_LIVRE) {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function validarOpcoes(opcoes) {
  const o = opcoes && typeof opcoes === "object" ? opcoes : {};
  return {
    usarModelos: o.usarModelos !== false,
    negrito: o.negrito === true,
    italico: o.italico === true,
    negritoItalico: o.negritoItalico === true,
    maiusculas: o.maiusculas === true,
    variarFontes: o.variarFontes === true,
    emoji: o.emoji === true,
    usarListas: o.usarListas === true,
    separarIdeias: o.separarIdeias === true,
    separarFrases: o.separarFrases === true,
    resumo: o.resumo === true,
    resumoTamanho: TAMANHOS_RESUMO.includes(o.resumoTamanho) ? o.resumoTamanho : "medio",
    // Quatro formas de usar os textos bíblicos nas respostas, uma por vez: explicar e aplicar (sem transcrever nem citar
    // na resposta) > transcrever sem citar na resposta > só citar 1 ou 2 na resposta (sem transcrever) > transcrever e
    // citar na resposta (consultarBiblia).
    explicarTextos: o.explicarTextos === true,
    transcreverSemCitar: o.transcreverSemCitar === true && o.explicarTextos !== true,
    citarTextos: o.citarTextos === true && o.explicarTextos !== true && o.transcreverSemCitar !== true,
    consultarBiblia:
      o.consultarBiblia === true && o.citarTextos !== true && o.explicarTextos !== true && o.transcreverSemCitar !== true,
    // A consulta ao Perspicaz está desligada por enquanto (a opção saiu da tela); o código e os arquivos continuam prontos
    // para quando ela voltar: basta trocar para `o.consultarPerspicaz === true` e recolocar a caixa na tela.
    consultarPerspicaz: false,
    // Só para o botão "Sugerir perguntas adicionais": acrescenta perguntas de aplicação sobre os textos bíblicos.
    perguntasTextos: o.perguntasTextos === true,
    // Também só para esse botão: perguntas de entendimento e explicação dos textos em relação à matéria do parágrafo.
    perguntasEntendimento: o.perguntasEntendimento === true,
    // Seções 1 (complementares) e 2 (aplicativas) das perguntas adicionais: ligadas, a não ser que venham desmarcadas.
    perguntasComplementares: o.perguntasComplementares !== false,
    perguntasAplicativas: o.perguntasAplicativas !== false,
    intensidade: INTENSIDADES.includes(o.intensidade) ? o.intensidade : "moderada",
    instrucao: textoLivre(o.instrucao),
  };
}

// Texto acima do limite recomendado da Sugerir formatação e da resposta do texto colado: o app avisa e pergunta; se o usuário confirma, o pedido
// vai com "textoLongo" e vale até 5 vezes o limite (no máximo 30000 caracteres e 500 linhas). O app usa a mesma conta (limiteDoTextoLongo, em app.js).
const limiteDoTextoLongo = (chars, linhas) => ({ chars: Math.min(chars * 5, 30000), linhas: Math.min(linhas * 5, 500) });

function validarEntrada(body, L) {
  if (!body || typeof body !== "object") return null;

  const tarefa = body.tarefa === "sentinela" ? "sentinela" : "formatar";
  const longo = body.textoLongo === true;
  const baseChars = tarefa === "sentinela" ? L.maxCharsSentinela : L.maxCharsFormatacao;
  const baseLinhas = tarefa === "sentinela" ? L.maxLinhasSentinela : L.maxLinhasFormatacao;
  const teto = limiteDoTextoLongo(baseChars, baseLinhas);
  const maxChars = longo ? teto.chars : baseChars;
  const maxLinhas = longo ? teto.linhas : baseLinhas;

  const { linhas, modelos } = body;
  if (!Array.isArray(linhas) || !Array.isArray(modelos)) return null;
  if (!linhas.length || linhas.length > maxLinhas || modelos.length > MAX_MODELOS) return null;
  if (!linhas.every((l) => typeof l === "string")) return null;

  const total = linhas.reduce((soma, l) => soma + l.length, 0);
  if (total === 0 || total > maxChars) return null;

  const modelosOk = [];
  for (const m of modelos) {
    if (!m || typeof m.id !== "string" || typeof m.nome !== "string" || typeof m.conteudo !== "string") return null;
    modelosOk.push({
      id: m.id.slice(0, 80),
      nome: m.nome.slice(0, 80),
      conteudo: m.conteudo.slice(0, MAX_CHARS_MODELO),
    });
  }

  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores =
    modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 8000) : "";

  return {
    tarefa,
    longo,
    linhas,
    modelos: modelosOk,
    opcoes: validarOpcoes(body.opcoes),
    modo,
    ajuste: textoLivre(body.ajuste, MAX_AJUSTE),
    anteriores,
  };
}

// Preferências da formatação: uma frase por caixa (partes editáveis "Opções da formatação com IA" e "Listas").
function descreverPreferencias(o, P) {
  const f = P.frases.formatacao;
  const l = P.frases.listas;
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  return [
    f[o.usarModelos ? "Modelos: marcada" : "Modelos: desmarcada"],
    estilos.length ? trocar(f["Estilos: algum marcado"], { estilos: estilos.join(", ") }) : f["Estilos: nenhum marcado"],
    f[o.maiusculas ? "Maiúsculas: marcada" : "Maiúsculas: desmarcada"],
    f[o.emoji ? "Emoji: marcada" : "Emoji: desmarcada"],
    f["Quantidade: " + o.intensidade],
    o.variarFontes ? trocar(f["Tipos de fonte: marcada"], { fontes: f["Catálogo de fontes"] }) : f["Tipos de fonte: desmarcada"],
    o.resumo ? trocar(f["Resumo: marcada"], { tamanho: f["Tamanho do resumo: " + NOME_TAMANHO[o.resumoTamanho]] }) : f["Resumo: desmarcada"],
    o.usarListas ? trocar(l["Listas: marcada"], { modelos_de_lista: l["Catálogo de listas"] }) : l["Listas: desmarcada"],
    f[o.separarIdeias ? "Espaçamento: marcada" : "Espaçamento: desmarcada"],
  ]
    .filter(Boolean)
    .join("\n");
}

// Orientação do usuário (campo "Instruções adicionais para a IA" do pedido e instruções fixas das configurações). Vai no INÍCIO da
// mensagem, com prioridade total sobre as preferências (inclusive as opções desmarcadas). Em branco: nada é enviado.
function blocoOrientacao(opcoes, ajuste, P) {
  const f = P.frases.pedidos;
  const itens = [];
  if (ajuste) itens.push(trocar(f["Orientação: deste pedido"], { texto: ajuste }));
  if (opcoes.instrucao) itens.push(trocar(f["Orientação: instruções fixas"], { texto: opcoes.instrucao }));
  if (!itens.length) return "";
  return f["Orientação: abertura"] + "\n" + itens.map((i) => `- ${i}`).join("\n") + "\n\n";
}

// Lembrete no fim da mensagem, só quando há orientação do usuário.
function lembreteFinal(opcoes, ajuste, P) {
  return ajuste || opcoes.instrucao ? "\n\n" + P.frases.pedidos["Lembrete final"] : "";
}

const ASPAS = "\"“”„«»‘’❛❜❝❞";
const TEM_ASPAS = new RegExp(`[${ASPAS}]`);
const ASPAS_NAS_PONTAS = new RegExp(`^[\\s${ASPAS}']+|[\\s${ASPAS}']+$`, "g");

// Tira aspas e espaços das pontas do trecho, para que as aspas nunca recebam negrito/itálico.
// Regra fixa (pedida pelo usuário, permanente): a palavra "culto" nunca aparece no que a IA escreve. O prompt já proíbe
// (VOCABULARIO_FIXO em _prompts.mjs); se escapar, vira "reunião", com as palavras de antes no feminino
// ("durante o culto" -> "durante a reunião", "aos nossos cultos" -> "às nossas reuniões").
const FEMININO_ANTES_DE_REUNIAO = {
  o: "a", os: "as", do: "da", dos: "das", no: "na", nos: "nas", ao: "à", aos: "às", pelo: "pela", pelos: "pelas",
  um: "uma", uns: "umas", num: "numa", dum: "duma", este: "esta", estes: "estas", esse: "essa", esses: "essas",
  deste: "desta", desse: "dessa", neste: "nesta", nesse: "nessa", nosso: "nossa", nossos: "nossas", seu: "sua",
  seus: "suas", meu: "minha", meus: "minhas", todo: "toda", todos: "todas", próximo: "próxima", próximos: "próximas",
};
function mesmaCaixa(modelo, texto) {
  if (modelo.length > 1 && modelo === modelo.toUpperCase() && modelo !== modelo.toLowerCase()) return texto.toUpperCase();
  return modelo[0] !== modelo[0].toLowerCase() ? texto[0].toUpperCase() + texto.slice(1) : texto;
}
function semCulto(texto) {
  return texto.replace(/(^|[^\p{L}])(?:(\p{L}+)(\s+))?(?:(\p{L}+)(\s+))?(cultos?)(?!\p{L})/giu, (todo, antes, p1, e1, p2, e2, culto) => {
    const feminino = (p) => (p && FEMININO_ANTES_DE_REUNIAO[p.toLowerCase()] ? mesmaCaixa(p, FEMININO_ANTES_DE_REUNIAO[p.toLowerCase()]) : p);
    const reuniao = mesmaCaixa(culto, culto.toLowerCase() === "cultos" ? "reuniões" : "reunião");
    return antes + (p1 ? feminino(p1) + e1 : "") + (p2 ? feminino(p2) + e2 : "") + reuniao;
  });
}

function limparTrecho(trecho) {
  return typeof trecho === "string" ? semCulto(semGotica(trecho.replace(/[*`]+/g, "").replace(ASPAS_NAS_PONTAS, ""))) : "";
}

// Texto escrito pela IA (respostas e resumo): sem Markdown (* e `) e sem emojis no começo. As vezes ela escreve
// **negrito** ou repete o emoji dentro do texto, e como a formatação vem dos campos emoji/destaques, isso
// apareceria como asteriscos e emoji duplicado.
function limparTextoGerado(valor, max) {
  const texto = typeof valor === "string" ? semCulto(semGotica(valor)) : "";
  return texto
    .replace(/[*`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Emoji_Modifier}\s]*)+/u, "")
    .trim()
    .slice(0, max);
}

// Resumo dos capítulos: como limparTextoGerado, mas mantém os parágrafos (um por trecho, separados por linha em branco) e o emoji do começo de cada um.
function limparResumo(valor, max) {
  const texto = typeof valor === "string" ? semCulto(semGotica(valor)) : "";
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/[*`]+/g, "")
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, max);
}

const REGEX_EMOJI = /\p{Extended_Pictographic}/u;

function limparEmoji(valor) {
  if (typeof valor !== "string") return null;
  const partes = [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(valor.trim())]
    .map((s) => s.segment)
    .filter((g) => REGEX_EMOJI.test(g))
    .slice(0, 3);
  return partes.length ? partes.join("") : null;
}

// ---------- Respostas do estudo de A Sentinela ----------

// Destaques de um texto (linha ou resposta): mantém só os que existem nele e que as preferências permitem.
function estilosDe(opcoes) {
  return new Set([
    ...(opcoes.negrito ? ["negrito"] : []),
    ...(opcoes.italico ? ["italico"] : []),
    ...(opcoes.negritoItalico ? ["negrito_italico"] : []),
  ]);
}

function sanearDestaques(destaques, texto, opcoes, estilosPermitidos, maxDestaques) {
  const resultado = [];
  for (const d of (Array.isArray(destaques) ? destaques : []).slice(0, maxDestaques)) {
    const trecho = limparTrecho(d && d.trecho);
    if (!trecho || !texto.includes(trecho)) continue;

    const estilo = d.estilo && estilosPermitidos.has(d.estilo) ? d.estilo : null;
    const maiusculas = opcoes.maiusculas && d.maiusculas === true;
    let fonte = opcoes.variarFontes && FONTES.includes(d.fonte) ? d.fonte : null;
    // Regra fixa: a caixa escura é só para UMA palavra, duas no máximo (o trecho continua com os demais recursos).
    if (fonte === "squaredDark" && trecho.split(/\s+/).filter(Boolean).length > 2) fonte = null;
    if (!estilo && !maiusculas && !fonte) continue;
    resultado.push({ trecho, tipo: "geral", estilo, maiusculas, fonte });
  }
  return resultado;
}

// Preferências de formatação enviadas à IA quando ela escreve respostas do estudo.
function descreverFormatacaoResposta(o, P, sep) {
  const f = P.frases.respostas;
  const estilos = [];
  if (o.negrito) estilos.push("negrito");
  if (o.italico) estilos.push("italico");
  if (o.negritoItalico) estilos.push("negrito_italico");

  return [
    estilos.length ? trocar(f["Estilos: algum marcado"], { estilos: estilos.join(", ") }) : f["Estilos: nenhum marcado"],
    f[o.maiusculas ? "Maiúsculas: marcada" : "Maiúsculas: desmarcada"],
    f[o.emoji ? "Emoji: marcada" : "Emoji: desmarcada"],
    f["Destaques: " + o.intensidade],
    sep ? trocar(f["Espaçamento: marcada"], { unidade: sep === "frases" ? "frase" : "ideia" }) : f["Espaçamento: desmarcada"],
  ]
    .filter(Boolean)
    .join("\n");
}

// "PREFERÊNCIAS:" das respostas do estudo: o tamanho, a formatação e os textos bíblicos.
function preferenciasDaResposta(o, P, sep) {
  return (
    "PREFERÊNCIAS:\n" +
    P.frases.respostas["Tamanho da resposta: " + NOME_TAMANHO[o.resumoTamanho]] +
    "\n" +
    descreverFormatacaoResposta(o, P, sep) +
    descreverFontes(o, P, false)
  );
}

// ---------- Fontes de consulta: Bíblia e Estudo Perspicaz ----------
// A IA só indica as referências bíblicas e os verbetes; o servidor busca o texto exato nos arquivos (_fontes.mjs, Vercel
// Blob privado) e uma chamada curta à IA, sem ferramentas, escreve a aplicação de cada versículo e a explicação do
// verbete. Nada é escrito de memória: o versículo vem sempre do arquivo.

function chaveDeBusca(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function consultaPedida(opcoes) {
  return Boolean(
    opcoes.consultarBiblia || opcoes.transcreverSemCitar || opcoes.citarTextos || opcoes.explicarTextos || opcoes.consultarPerspicaz
  );
}

// Linhas das preferências sobre as fontes. paraTexto = "Sugerir formatação" (as referências valem para o texto todo).
function descreverFontes(opcoes, P, paraTexto) {
  // Uma forma de usar os textos por vez; paraTexto = formatação (vale para o resumo), senão respostas do estudo.
  const f = P.frases.textos;
  const alvo = paraTexto ? "Resumo" : "Respostas";
  let linhaBiblia;
  if (opcoes.explicarTextos) linhaBiblia = f[`${alvo}: explicar e aplicar`];
  else if (opcoes.transcreverSemCitar) linhaBiblia = f[`${alvo}: transcrever sem citar`];
  else if (opcoes.citarTextos) linhaBiblia = f[`${alvo}: só citar`];
  else if (opcoes.consultarBiblia) linhaBiblia = f["Transcrever e citar"] + "\n" + (paraTexto ? P.instrucoes.bibliaResumo : P.instrucoes.bibliaRelevantes);
  else linhaBiblia = f["Nenhuma opção marcada"];
  const linhas = [
    linhaBiblia,
    opcoes.consultarPerspicaz ? trocar(f["Perspicaz: ativo"], { uso_do_perspicaz: P.instrucoes.perspicazUso }) : f["Perspicaz: inativo"],
  ];
  return "\n" + linhas.join("\n") + "\n\n" + P.instrucoes.referencias;
}

const SaidaAplicacao = z.object({
  itens: z.array(
    z.object({
      indice: z.number().int(),
      aplicacoes: z.array(z.object({ referencia: z.string(), aplicacao: z.string() })),
      explicacao: z.string().nullable(),
    })
  ),
});

// Completa cada item com os versículos (texto exato do arquivo) e o verbete do Perspicaz. Item: { contexto, referencias
// (textos citados na própria pergunta), relevantes (outros textos indicados pela IA), verbetes (Perspicaz) }.
// Grava item.textos = [{ referencia, texto, aplicacao }] e item.perspicaz = { volume, verbete, explicacao } | null.
//
// REGRA FIXA (pedido do usuário): todo texto bíblico citado na PERGUNTA, no meio dela ou entre parênteses no fim, é
// sempre mencionado na resposta (a IA faz isso) e sempre transcrito e explicado logo depois dela, seja qual for a opção
// marcada. As opções valem só para os demais textos:
//   transcrever (com ou sem citar na resposta): os relevantes também são transcritos e explicados;
//   só citar: os demais ficam só mencionados na resposta (nada além dos da pergunta é transcrito);
//   explicar e aplicar: os demais (até 2) entram só com a referência e a explicação, sem o versículo.
// Se algo falhar, os itens seguem sem as fontes (a resposta já está pronta).
async function completarFontes(itens, opcoes, P, orientacao) {
  for (const item of itens) {
    item.textos = [];
    item.perspicaz = null;
  }
  const modo = opcoes.explicarTextos ? "explicar" : opcoes.citarTextos ? "citar" : "transcrever";
  const transcreveOutros = opcoes.consultarBiblia || opcoes.transcreverSemCitar;
  const pedidos = itens.map((i) => {
    const daPergunta = [...new Set(i.referencias || [])];
    const outros = [...new Set(i.relevantes || [])].filter((r) => !daPergunta.includes(r));
    return {
      daPergunta,
      outros: modo === "explicar" ? outros.slice(0, 2) : modo === "transcrever" && transcreveOutros ? outros : [],
      verbetes: opcoes.consultarPerspicaz ? i.verbetes || [] : [],
    };
  });
  if (!fontesConfiguradas() || !pedidos.some((p) => p.daPergunta.length || p.outros.length || p.verbetes.length)) return;

  try {
    const achados = await Promise.all(
      pedidos.map(async (p) => {
        // numerado: o texto que o app mostra traz o começo de cada versículo, do segundo em diante, marcado por [n]; a IA recebe só o texto corrido.
        const daPergunta = await buscarVersiculos(p.daPergunta, 6, { numerado: true }); // os da pergunta entram sempre (até 6)
        const vistos = new Set(daPergunta.map((t) => t.referencia));
        const outros = (await buscarVersiculos(p.outros, P.limites.maxTextos, { numerado: true })).filter((t) => !vistos.has(t.referencia));
        return {
          // semTexto: só a referência e a explicação (opção "explicar e aplicar", nunca para os da pergunta)
          textos: [...daPergunta.map((t) => ({ ...t, semTexto: false })), ...outros.map((t) => ({ ...t, semTexto: modo === "explicar" }))],
          verbete: p.verbetes.length ? await buscarVerbete(p.verbetes) : null,
        };
      })
    );
    const lista = [];
    achados.forEach((a, indice) => {
      // Os versículos transcritos já entram (texto exato); a explicação chega na etapa seguinte. Os "só explicar" só
      // entram se a explicação vier.
      itens[indice].textos = a.textos.filter((t) => !t.semTexto).map((t) => ({ referencia: t.referencia, texto: t.textoNumerado, aplicacao: "" }));
      if (!a.textos.length && !a.verbete) return;
      lista.push({
        indice,
        contexto: String(itens[indice].contexto || "").slice(0, 3000),
        explicar: true,
        textos: a.textos.map((t) => ({ referencia: t.referencia, texto: t.texto })),
        ...(a.verbete ? { verbete: { titulo: a.verbete.verbete, volume: a.verbete.volume, trecho: a.verbete.trecho } } : {}),
      });
    });
    if (!lista.length) return;

    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 40_000) });
    const resposta = await chamarIa(
      client,
      P,
      {
        max_tokens: 6000, // folga para o raciocínio dos modelos que não o desligam
        system: P.sistemaAplicacao,
        messages: [{ role: "user", content: (orientacao || "") + "ITENS (JSON):\n" + JSON.stringify(lista) }],
      },
      { schema: SaidaAplicacao, semPensar: true, tarefa: "aplicacao" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return;

    for (const r of resposta.parsed_output.itens) {
      const item = itens[r.indice];
      const achado = achados[r.indice];
      if (!item || !achado) continue;
      const aplicacaoDe = (t, pos) =>
        r.aplicacoes.find((x) => chaveDeBusca(x.referencia) === chaveDeBusca(t.referencia)) || r.aplicacoes[pos];
      item.textos = achado.textos
        .map((t, pos) => {
          const ap = aplicacaoDe(t, pos);
          const explicacao = ap ? limparTextoGerado(ap.aplicacao, 700) : "";
          if (t.semTexto) return explicacao ? { referencia: t.referencia, texto: "", aplicacao: explicacao } : null;
          return { referencia: t.referencia, texto: t.textoNumerado, aplicacao: explicacao };
        })
        .filter(Boolean);
      const explicacao = achado.verbete && r.explicacao ? limparTextoGerado(r.explicacao, 700) : "";
      if (explicacao) item.perspicaz = { volume: achado.verbete.volume, verbete: achado.verbete.verbete, explicacao };
    }
  } catch (e) {
    console.error("Não foi possível completar com as fontes:", e?.status, e?.message);
  }
}

const listaDeTextos = (valor, max) =>
  (Array.isArray(valor) ? valor : []).map((r) => limparLinha(r, 80)).filter(Boolean).slice(0, max);

// Lista pedida pela IA para uma linha: o modelo de lista do app e o número do grupo; quem escreve os marcadores é o app.
function sanearLista(lista) {
  if (!lista || typeof lista !== "object" || !MODELOS_LISTA.includes(lista.modelo)) return null;
  const grupo = Number(lista.grupo);
  return Number.isInteger(grupo) && grupo >= 0 && grupo <= 999 ? { modelo: lista.modelo, grupo } : null;
}

// Trechos da linha onde começa uma nova ideia (o app põe uma linha em branco antes de cada um): só valem os que existem
// literalmente na linha, fora do começo dela, sem repetir e em número razoável.
function sanearQuebras(quebras, linha) {
  const resultado = [];
  for (const q of (Array.isArray(quebras) ? quebras : []).slice(0, 60)) {
    let trecho = typeof q === "string" ? q.trim() : "";
    // Regra fixa: o texto entre parênteses fica no fim da frase anterior; se a IA quebrou antes dele, a quebra passa
    // para depois do parêntese (ou some, se nada novo começa ali).
    if (trecho.startsWith("(") && linha.includes(trecho)) {
      const abre = linha.indexOf(trecho);
      const fecha = fimDoParentese(linha, abre);
      trecho = fecha >= 0 ? pecaDepoisDe(linha, fecha + 1) : trecho;
    }
    if (trecho.length < 2 || !linha.includes(trecho) || linha.trim().startsWith(trecho) || resultado.includes(trecho)) continue;
    resultado.push(trecho);
  }
  return resultado;
}

// Como separar com linhas em branco: "frases" (uma linha em branco entre cada frase), "ideias" (entre as ideias) ou null.
// Vale a opção "Separar as ideias com linhas em branco" e também o que o usuário pedir na orientação ou nas instruções fixas.
function modoSeparacao(opcoes, ajuste) {
  const pedido = `${ajuste || ""} ${opcoes.instrucao || ""}`;
  const pedeFrases =
    /(separ\w*|quebr\w*|linhas?\s+em\s+branco|espa[çc]\w*)[^.;\n]{0,40}\bfrases?\b|\bfrases?\b[^.;\n]{0,40}(linhas?\s+em\s+branco|separad\w*|quebr\w*)/i;
  if (opcoes.separarFrases || pedeFrases.test(pedido)) return "frases";
  if (opcoes.separarIdeias || /linhas?\s+em\s+branco|separ\w*\s+(as\s+|os\s+)?(ideias|par[áa]grafos|trechos)/i.test(pedido)) return "ideias";
  return null;
}

const ABREVIACOES = new Set(["sr", "sra", "srta", "dr", "dra", "cap", "caps", "vs", "ex", "etc", "pág", "págs", "par", "pars", "nº", "v", "vv", "cf", "obs"]);

// Início de cada frase do texto, menos a primeira (o app coloca uma linha em branco antes de cada um). Cada trecho é
// copiado do próprio texto e só vale se for localizado exatamente nesse ponto.
function inicioDeFrases(texto) {
  const resultado = [];
  const re = /([.!?…]+["”’)»]*)\s+(?=["“‘(¿¡]?[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/gu;
  let m;
  while ((m = re.exec(texto)) && resultado.length < 60) {
    const palavra = (texto.slice(0, m.index).match(/(\p{L}+)$/u) || [])[1] || "";
    if (m[1] === "." && ABREVIACOES.has(palavra.toLowerCase())) continue;
    const inicio = re.lastIndex;
    // Regra fixa: texto entre parênteses fica no fim da frase anterior. Em vez de quebrar antes dele, a quebra vem
    // depois do parêntese (se uma nova frase começar ali) e a busca continua a partir daí.
    const fecha = fimDoParentese(texto, inicio);
    if (fecha >= 0) {
      re.lastIndex = fecha + 1;
      const peca = pecaDepoisDe(texto, fecha + 1);
      if (peca) resultado.push(peca);
      continue;
    }
    const peca = pecaEm(texto, inicio);
    if (peca) resultado.push(peca);
  }
  return resultado;
}

// Trecho do texto que começa exatamente em "inicio" (o app localiza a quebra pelo trecho, então ele precisa ser único
// nessa posição); "" se não der para identificar.
function pecaEm(texto, inicio) {
  for (const tamanho of [60, 120, 240]) {
    const peca = texto.slice(inicio, inicio + tamanho).trim();
    if (peca.length >= 2 && texto.indexOf(peca) === inicio) return peca;
  }
  return "";
}

// Posição do ")" que fecha o parêntese aberto em "abre" (-1 se não houver um parêntese curto ali).
function fimDoParentese(texto, abre) {
  if (texto[abre] !== "(") return -1;
  const fecha = texto.indexOf(")", abre);
  return fecha > abre && fecha - abre <= 250 ? fecha : -1;
}

// Início da frase que vem depois de um parêntese (a partir de "desde", logo depois do ")"): só vale se houver um espaço
// e uma nova frase (letra maiúscula); "" se o parêntese termina a linha, é seguido de pontuação ou de texto que continua.
function pecaDepoisDe(texto, desde) {
  const espacos = texto.slice(desde).match(/^\s+/);
  if (!espacos) return "";
  const inicio = desde + espacos[0].length;
  return /^["“‘¿¡]?[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/u.test(texto.slice(inicio, inicio + 2)) ? pecaEm(texto, inicio) : "";
}

function ehModeloDePergunta(modelo) {
  return Boolean(modelo) && /perguntas?|[❓❔]/iu.test(`${modelo.nome} ${modelo.conteudo}`);
}

function limparLinha(valor, max) {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Um item de resposta pronto para o navegador: texto limpo e destaques conferidos. As fontes entram depois
// (finalizarItens); os campos internos (contexto, referencias, relevantes, verbetes) não vão para o navegador.
function montarItem(i, opcoes, permitidos, L, sep) {
  const texto = limparTextoGerado(i.resposta, L.maxCharsResposta);
  // Linhas em branco dentro da resposta: frase a frase (calculado aqui, sem depender da IA) ou entre ideias (a IA indica).
  const quebras = sep === "frases" ? inicioDeFrases(texto) : sep ? sanearQuebras(i.quebras, texto) : [];
  return {
    paragrafos: limparLinha(i.paragrafos, 20),
    resposta: texto,
    quebras,
    emoji: opcoes.emoji ? limparEmoji(i.emoji) : null,
    destaques: sanearDestaques(i.destaques, texto, opcoes, permitidos, L.maxDestaques),
    contexto: texto,
    referencias: listaDeTextos(i.referencias, 3),
    relevantes: listaDeTextos(i.textosRelevantes, L.maxTextos),
    verbetes: listaDeTextos(i.verbetes, 2),
  };
}

// Fecha os itens antes de enviá-los ao navegador: busca as fontes e tira os campos internos.
async function finalizarItens(itens, opcoes, P, orientacao) {
  await completarFontes(itens, opcoes, P, orientacao);
  return itens.map(({ contexto, referencias, relevantes, verbetes, ...resto }) => resto);
}

// Conversa com a IA tratando pause_turn (turno longo pausado pela API, ex.: durante a leitura do site).
// Devolve a última resposta e todos os blocos de todos os turnos.
async function conversar(client, P, { system, mensagens, tools, maxTokens, voltas, tarefa = "" }) {
  let resposta;
  const blocos = [];
  const inicio = Date.now();
  const uso = { modelo: P.ia.modelo, voltas: 0, entrada: 0, saida: 0 };
  for (let volta = 0; volta < voltas; volta++) {
    // A memória só entra na 1ª volta (a tarefa só na primeira chamada); nas seguintes o system já está no histórico.
    resposta = await chamarIa(client, P, { max_tokens: maxTokens, system, messages: mensagens, tools }, { tarefa: volta === 0 ? tarefa : "" });
    uso.voltas++;
    uso.entrada += resposta.usage?.input_tokens || 0;
    uso.saida += resposta.usage?.output_tokens || 0;
    blocos.push(...resposta.content);
    if (resposta.stop_reason !== "pause_turn") break;
    mensagens = [...mensagens, { role: "assistant", content: resposta.content }];
  }
  // Para o registro: quanto tempo levou, quantos tokens e quais páginas a IA leu (diagnóstico de lentidão).
  uso.segundos = Math.round((Date.now() - inicio) / 100) / 10;
  uso.leituras = blocos.filter((b) => b.type === "server_tool_use").map((b) => String(b.input?.url || "?").replace(/^https?:\/\/wol\.jw\.org/, ""));
  uso.pensou = blocos.some((b) => b.type === "thinking" || b.type === "redacted_thinking");
  return { resposta, blocos, uso };
}

const Destaque = z.object({
  trecho: z.coerce.string().catch(""),
  tipo: z.enum(TIPOS).catch("geral"),
  estilo: z.enum(ESTILOS).nullable().optional().catch(null),
  maiusculas: z.boolean().optional().catch(false),
  fonte: z.enum(FONTES).nullable().optional().catch(null),
});

// Item de resposta lido de JSON em texto (leitura do site); os campos extras são tolerantes.
const ItemResposta = z.object({
  paragrafos: z.coerce.string(),
  resposta: z.coerce.string(),
  quebras: z.array(z.string()).optional().catch([]),
  emoji: z.string().nullable().optional().catch(null),
  destaques: z.array(Destaque).optional().catch([]),
  referencias: z.array(z.string()).optional().catch([]),
  textosRelevantes: z.array(z.string()).optional().catch([]),
  verbetes: z.array(z.string()).optional().catch([]),
});

const SaidaSentinela = z.object({
  itens: z.array(
    z.object({
      paragrafos: z.string(),
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(
        z.object({
          trecho: z.string(),
          tipo: z.enum(TIPOS),
          estilo: z.enum(ESTILOS).nullable(),
          maiusculas: z.boolean(),
        })
      ),
      referencias: z.array(z.string()),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
});

function mensagemTetoDeGastos(conta) {
  return `O teto de gastos da IA na conta atual (${conta}) foi atingido. Você pode informar o administrador sobre a situação. Também há a opção de trocar para uma conta que ainda tenha limite de gastos (opção que só o administrador pode fazer).`;
}

function tratarErro(e, res) {
  if (e instanceof Anthropic.RateLimitError) {
    return erro(res, 429, "Limite de uso da IA atingido. Tente novamente mais tarde.");
  }
  if (e instanceof Anthropic.APIError && e.status === 400 && /usage limits/i.test(String(e.message))) {
    return erro(res, 429, mensagemTetoDeGastos("Anthropic · Claude"));
  }
  // Teto de gastos do Google Cloud (Budgets → Spend cap) no Vertex AI / Gemini: a API responde 403 na hora.
  if (e && (e.status === 403 || /403/.test(String(e.message))) && /spend\s*cap/i.test(String(e.message))) {
    console.error("Teto de gastos do Google Cloud (Vertex AI) atingido:", e?.message);
    const prov = contextoDoPedido.getStore()?.provedorIa;
    const conta = prov === "gemini" ? "Google Cloud · Gemini" : prov === "vertex" ? "Google Cloud · Claude / Vertex AI" : "Google Cloud (Vertex AI / Gemini)";
    return erro(res, 429, mensagemTetoDeGastos(conta));
  }
  if (
    e &&
    (e.name === "TimeoutError" ||
      e.name === "AbortError" ||
      e instanceof Anthropic.APIConnectionTimeoutError ||
      /timeout|aborted/i.test(String(e.message)) ||
      /timeout|aborted/i.test(String(e.cause?.message)))
  ) {
    console.error("Tempo limite esgotado ao chamar a IA:", e?.status, e?.message);
    return erro(
      res,
      504,
      "A IA demorou demais para responder (tempo limite esgotado). Tente novamente ou use um modelo mais rápido (como o Gemini Flash ou esforço baixo) em Ajustes → Modelos e agentes de IA."
    );
  }
  console.error("Erro ao chamar a IA:", e?.status, e?.message);
  return erro(res, 502, "Não foi possível obter sugestões agora. Tente novamente.");
}

// Escreve as respostas do estudo a partir de um texto com as perguntas e os parágrafos: o colado pelo usuário
// (Opção 2) ou o lido pelo servidor no wol.jw.org (Opção 1). A IA pensa antes de responder (o texto é curto).
// Devolve { itens, uso } ou null se a IA não conseguiu gerar as respostas.
// Trechos dos livros (Adoração Pura, Reino de Deus, Princípios Bíblicos) que combinam com o assunto: vão como base de pesquisa no pedido à IA.
// Se a busca falhar, o pedido segue sem eles.
async function blocoLivros(P, consulta) {
  if (!fontesConfiguradas() || !consulta) return "";
  try {
    const achados = await buscarNosLivros(String(consulta).slice(0, 12000), { max: 4, maxChars: 1200 });
    if (!achados.length) return "";
    return "\n\n" + trocar(P.frases.pedidos["Livros de apoio"] || "", { trechos: achados.map((a) => `[${a.livro}] ${a.trecho}`).join("\n\n") });
  } catch (e) {
    console.error("Livros de apoio: busca falhou", e?.message);
    return "";
  }
}

async function escreverRespostas({ rotulo, texto, escopo, opcoes, modo, ajuste, anteriores, sep, P, tarefa = "sentinela", longo = false }) {
  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    (escopo ? `\n\n${escopo}` : "") +
    `\n\n${rotulo}:\n` +
    texto +
    (await blocoLivros(P, texto)) +
    lembreteFinal(opcoes, ajuste, P);

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      "\n\n" +
      P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  const permitidos = estilosDe(opcoes);
  const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, longo ? 130_000 : 90_000) });
  const inicio = Date.now();
  const resposta = await chamarIa(
    client,
    P,
    { max_tokens: longo ? 16000 : 12000 /* o raciocínio também conta aqui */, system: P.sistemaSentinela, messages: [{ role: "user", content: mensagem }] },
    { schema: SaidaSentinela, tarefa }
  );
  const uso = {
    modelo: P.ia.modelo,
    segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
    entrada: resposta.usage?.input_tokens || 0,
    saida: resposta.usage?.output_tokens || 0,
    pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
    parada: resposta.stop_reason,
  };
  if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return { itens: null, uso };

  const itens = resposta.parsed_output.itens
    .slice(0, P.limites.maxRespostas)
    .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
    .filter((i) => i.resposta);
  return { itens, uso };
}

async function responderSentinela(res, { linhas, opcoes, modo, ajuste, anteriores, longo }, P) {
  const sep = modoSeparacao(opcoes, ajuste);
  // A consulta às fontes não exige o código de pesquisa (o código vale só para a leitura do wol.jw.org).
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  // Os versículos citados na pergunta são sempre transcritos: a Bíblia começa a carregar enquanto a IA escreve.
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });

  try {
    const { itens, uso } = await escreverRespostas({ rotulo: "TEXTO COLADO", texto: linhas.join("\n"), opcoes, modo, ajuste, anteriores, sep, P, longo });
    console.log("Texto colado:", JSON.stringify(uso));
    if (!itens) return erro(res, 502, "A IA não conseguiu gerar as respostas para este texto.");
    const memoriaUsada = memoriaUsadaAgora();
    return res.status(200).json({ itens: await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P)), memoriaUsada });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// Estudo lido pelo servidor no wol.jw.org: a IA recebe só as perguntas e os parágrafos pedidos (ou, na recapitulação,
// o artigo inteiro sem as perguntas dos parágrafos e as perguntas do quadro final).
async function responderEstudoLido(res, { lido, alvo, recapitulacao, opcoes, ajuste, sep, modo, anteriores, P, inicioPedido }) {
  const leitura = Math.round((Date.now() - inicioPedido) / 100) / 10;
  let texto;
  let escopo = "";
  if (recapitulacao) {
    if (!lido.recapitulacao.length) return erro(res, 400, "Não encontrei o quadro de recapitulação neste artigo.");
    texto = textoDaRecapitulacao(lido);
    escopo = P.frases.pedidos["Escopo: recapitulação"];
  } else {
    const grupos = lido.grupos.filter((g) => g.numeros.some((n) => alvo.has(n)));
    if (!grupos.length) {
      const ultimo = Math.max(...lido.grupos.flatMap((g) => g.numeros));
      return erro(res, 400, `Não encontrei esse(s) parágrafo(s) no artigo "${lido.titulo}": ele vai do parágrafo 1 ao ${ultimo}.`);
    }
    texto = textoDosGrupos(grupos);
  }

  try {
    const { itens: gerados, uso } = await escreverRespostas({ rotulo: "TEXTO DO ESTUDO", texto, escopo, opcoes, modo, ajuste, anteriores, sep, P, tarefa: "estudo" });
    if (!gerados) return erro(res, 502, "A IA não conseguiu gerar as respostas para este estudo.");

    // Recapitulação: as perguntas do quadro vêm numeradas 1, 2, 3...; o rótulo "Recap. N" não se confunde com parágrafos.
    if (recapitulacao) {
      gerados.forEach((i, pos) => {
        const numero = (i.paragrafos.match(/\d+/) || [String(pos + 1)])[0];
        i.paragrafos = "Recap. " + numero;
        i.referencias = [...new Set([...(lido.referenciasRecapitulacao?.[Number(numero) - 1] || []), ...i.referencias])];
      });
    } else {
      // Regra fixa: os textos citados na pergunta são sempre transcritos. A página marca cada um como link, então eles
      // entram mesmo que a IA esqueça de indicá-los.
      gerados.forEach((i) => {
        const numeros = numerosDosParagrafos(i.paragrafos);
        const daPergunta = lido.grupos.filter((g) => g.numeros.some((n) => numeros.has(n))).flatMap((g) => g.referencias || []);
        i.referencias = [...new Set([...daPergunta, ...i.referencias])];
      });
    }
    // Mesmo que a IA responda a mais, só ficam os parágrafos pedidos.
    const itens = alvo
      ? gerados.filter((i) => {
          const rotulos = numerosDosParagrafos(i.paragrafos);
          return rotulos.size ? [...rotulos].some((n) => alvo.has(n)) : gerados.length === 1;
        })
      : gerados;
    console.log("Estudo (lido no site):", JSON.stringify({ pedidos: alvo ? [...alvo] : "recapitulacao", recebidos: itens.map((i) => i.paragrafos), caracteres: texto.length, leitura, ...uso }));

    const memoriaUsada = memoriaUsadaAgora();
    const inicioFontes = Date.now();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    // Para o botão do JW Library ao lado do Copiar: o documento e o parágrafo (o primeiro do grupo) onde colar a resposta.
    // Na recapitulação, cada resposta ("Recap. N") abre a pergunta N do quadro final.
    if (recapitulacao && lido.id && Array.isArray(lido.pidsRecapitulacao)) {
      for (const i of itensFinais) {
        const numero = Number((String(i.paragrafos).match(/\d+/) || [])[0]);
        const par = numero ? lido.pidsRecapitulacao[numero - 1] : null;
        if (par) i.jwl = { docid: lido.id, par };
      }
    }
    if (!recapitulacao && lido.id && lido.pids) {
      for (const i of itensFinais) {
        const primeiro = [...numerosDosParagrafos(i.paragrafos)].sort((a, b) => a - b)[0];
        if (primeiro && lido.pids[primeiro]) i.jwl = { docid: lido.id, par: lido.pids[primeiro] };
      }
    }
    console.log("Estudo (tempo):", JSON.stringify({ fontes: Math.round((Date.now() - inicioFontes) / 100) / 10, total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));

    return res.status(200).json({
      titulo: lido.titulo || null,
      erro: itens.length ? null : "A IA não respondeu ao(s) parágrafo(s) pedido(s). Tente de novo.",
      url: lido.url,
      itens: itensFinais,
      memoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo da semana: leitura do artigo no wol.jw.org ----------
// A cada clique de quem tem o código de pesquisa, o servidor lê o artigo direto no wol.jw.org (api/_wol.mjs) e manda à
// IA só as perguntas e os parágrafos pedidos. Se essa leitura falhar, a IA lê o site com a ferramenta web_fetch da
// Anthropic (só no domínio wol.jw.org), como antes. O texto do artigo não é gravado nem devolvido ao navegador: só as
// respostas, com palavras próprias, e o título do artigo lido.

// Um item com defeito vira null e é descartado (as outras respostas continuam valendo).
const SaidaEstudo = z.object({
  titulo: z.string().nullable().optional().catch(null),
  erro: z.string().nullable().optional().catch(null),
  itens: z.array(ItemResposta.nullable().catch(null)).catch([]),
});

// Aceita o número do artigo (7 dígitos), o link do artigo ou, sem nada, a página de reuniões da semana.
function urlDoEstudo(body) {
  const artigo = typeof body.artigo === "string" ? body.artigo.trim() : "";

  if (/^\d{7}$/.test(artigo)) return `https://wol.jw.org/pt/wol/d/r5/lp-t/${artigo}`;

  if (artigo) {
    try {
      const url = new URL(artigo);
      const m = url.pathname.match(/^\/pt\/wol\/d\/r5\/lp-t\/(\d{7})\/?$/);
      return url.hostname === "wol.jw.org" && m ? `https://wol.jw.org/pt/wol/d/r5/lp-t/${m[1]}` : null;
    } catch {
      return null;
    }
  }

  const ano = Number(body.ano);
  const semana = Number(body.semana);
  if (Number.isInteger(ano) && ano >= 2020 && ano <= 2100 && Number.isInteger(semana) && semana >= 1 && semana <= 53) {
    return `https://wol.jw.org/pt/wol/meetings/r5/lp-t/${ano}/${semana}`;
  }
  return null;
}

function extrairJson(texto) {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return salvarJsonCortado(texto.slice(inicio));
  }
}

// Quando a resposta da IA é cortada no meio da lista "itens", fecha a lista depois do último item completo.
function salvarJsonCortado(texto) {
  const lista = texto.indexOf('"itens"');
  if (lista < 0) return null;
  let fim = texto.length;
  for (let tentativas = 0; tentativas < 60; tentativas++) {
    fim = texto.lastIndexOf("}", fim - 1);
    if (fim <= lista) return null;
    try {
      return JSON.parse(texto.slice(0, fim + 1) + "]}");
    } catch {
      /* tenta o "}" anterior */
    }
  }
  return null;
}

// "1, 2" -> {1, 2}; "3-5" -> {3, 4, 5}; "1 e 2" -> {1, 2}. Serve para conferir se a IA respondeu só aos
// parágrafos pedidos (ela às vezes entende "8" como "até o 8" e responde aos anteriores também).
function numerosDosParagrafos(texto) {
  const numeros = new Set();
  for (const parte of String(texto || "").replace(/\s+e\s+/gi, ",").split(",")) {
    const faixa = parte.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (faixa) {
      for (let n = Number(faixa[1]); n <= Number(faixa[2]) && n < 200; n++) numeros.add(n);
    } else {
      const unico = parte.match(/\d+/);
      if (unico) numeros.add(Number(unico[0]));
    }
  }
  return numeros;
}

// opcoesDirigente.dirigente: a recapitulação pedida no Preparar para dirigir (tarefa "estudo-recap"): o código do dirigente já foi conferido, sem o de pesquisa.
async function responderEstudo(res, body, P, opcoesDirigente = {}) {
  if (!opcoesDirigente.dirigente) {
    if (!codigoValido(body.codigo, body.aparelhoId)) {
      if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
      return erro(res, 403, "Código de pesquisa inválido.");
    }
  }

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  const pedido = String(body.paragrafos || "").trim();
  // "recapitulação", "Recapitulacao", "perguntas de recapitulação" ou só "recap": o quadro final do artigo.
  const recapitulacao = /^(perguntas de )?recap/.test(pedido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  // Não existe mais "todos": é preciso dizer os parágrafos (até o máximo configurado) ou pedir a recapitulação.
  const alvo = recapitulacao || !/^[\d\s,\-–]{1,120}$/.test(pedido) ? null : numerosDosParagrafos(pedido);
  if (!recapitulacao && !(alvo && alvo.size)) return erro(res, 400, "Informe os parágrafos (ex.: 3, 1-4 ou recapitulação).");
  const maxParagrafos = P.limites.maxParagrafosEstudo;
  if (alvo && alvo.size > maxParagrafos)
    return erro(res, 400, `O máximo permitido é de ${maxParagrafos} ${maxParagrafos === 1 ? "parágrafo" : "parágrafos"} por consulta. Peça menos parágrafos de cada vez.`);
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores =
    modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 8000) : "";

  // Primeiro o servidor tenta ler o artigo direto no wol.jw.org (rápido); se não der, a IA lê o site com web_fetch.
  const inicioPedido = Date.now();
  let lido = null;
  try {
    lido = await lerEstudoDireto(url);
  } catch (e) {
    console.error("Estudo: leitura direta falhou", e?.name, e?.message);
  }
  if (lido) return responderEstudoLido(res, { lido, alvo, recapitulacao, opcoes, ajuste, sep, modo, anteriores, P, inicioPedido });

  const escopoDosParagrafos = (numeros) => trocar(P.frases.pedidos["Escopo: parágrafos (leitura pela IA)"], { numeros: numeros.join(", ") }) + "\n";
  const montarMensagem = (escopo) =>
    blocoOrientacao(opcoes, ajuste, P) + `ENDEREÇO: ${url}\n` + escopo + preferenciasDaResposta(opcoes, P, sep) + lembreteFinal(opcoes, ajuste, P);

  let mensagem = montarMensagem(alvo ? escopoDosParagrafos([...alvo]) : P.frases.pedidos["Escopo: recapitulação (leitura pela IA)"] + "\n");

  if (modo && anteriores) {
    mensagem +=
      "\n\nRESPOSTAS ANTERIORES (JSON):\n" +
      anteriores +
      "\n\n" +
      P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
  const tools = [
    { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
  ];
  // Uma leitura do artigo com a mensagem dada; devolve a resposta da IA, o texto e o JSON conferido.
  const consultar = async (conteudo) => {
    const { resposta, uso } = await conversar(client, P, {
      system: P.sistemaEstudo,
      mensagens: [{ role: "user", content: conteudo }],
      tools,
      maxTokens: 16000, // folga para muitos parágrafos (e para o raciocínio, se for religado com CLAUDE_RACIOCINIO=on)
      voltas: 5,
      tarefa: "estudo",
    });
    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");
    return { resposta, uso, texto, dados: SaidaEstudo.safeParse(extrairJson(texto)) };
  };

  try {
    const { resposta, uso, texto, dados } = await consultar(mensagem); // memoriaUsada via conversar(..., tarefa: estudo)

    if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu responder a este pedido.");
    if (!dados.success || (!dados.data.itens.some(Boolean) && !dados.data.erro)) {
      console.error("Estudo: formato inesperado", JSON.stringify({ parada: resposta.stop_reason, tamanho: texto.length, inicio: texto.slice(0, 200), fim: texto.slice(-200) }));
      return erro(
        res,
        502,
        resposta.stop_reason === "max_tokens"
          ? "A resposta ficou longa demais. Tente pedir menos parágrafos de cada vez."
          : "A IA não devolveu as respostas no formato esperado. Tente novamente."
      );
    }
    dados.data.itens = dados.data.itens.filter(Boolean);

    const limpar = limparLinha;
    const permitidos = estilosDe(opcoes);
    const itensTodos = dados.data.itens
      .slice(0, P.limites.maxRespostas)
      .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
      .filter((i) => i.resposta);

    // Recapitulação: as perguntas do quadro vêm numeradas 1, 2, 3...; o rótulo "Recap. N" não se confunde com parágrafos.
    if (recapitulacao) {
      itensTodos.forEach((i, pos) => {
        i.paragrafos = "Recap. " + ((i.paragrafos.match(/\d+/) || [String(pos + 1)])[0]);
      });
    }

    // Mesmo que a IA responda a mais, só ficam os parágrafos pedidos.
    const doEscopo = (lista) =>
      alvo
        ? lista.filter((i) => {
            const rotulos = numerosDosParagrafos(i.paragrafos);
            return rotulos.size ? [...rotulos].some((n) => alvo.has(n)) : lista.length === 1;
          })
        : lista;
    const itens = doEscopo(itensTodos);

    // Faltou algum parágrafo pedido (a IA pulou ou a resposta foi cortada)? Pede de novo só os que faltaram.
    const cobertos = new Set(itens.flatMap((i) => [...numerosDosParagrafos(i.paragrafos)]));
    const faltando = alvo && !recapitulacao && !modo ? [...alvo].filter((n) => !cobertos.has(n)) : [];
    console.log("Estudo (a IA leu o site):", JSON.stringify({ pedidos: alvo ? [...alvo] : "recapitulacao", recebidos: itens.map((i) => i.paragrafos), faltando, parada: resposta.stop_reason, ...uso }));
    if (faltando.length && itens.length) {
      try {
        const segunda = await consultar(
          montarMensagem(
            escopoDosParagrafos(faltando) +
              `Já foram respondidos os parágrafos ${[...cobertos].join(", ")}: não os repita. Se um parágrafo pedido compartilha a pergunta com um deles, devolva "itens" vazio.\n`
          )
        );
        if (segunda.dados.success) {
          const extras = doEscopo(
            segunda.dados.data.itens
              .filter(Boolean)
              .map((i) => montarItem(i, opcoes, permitidos, P.limites, sep))
              .filter((i) => i.resposta && ![...numerosDosParagrafos(i.paragrafos)].every((n) => cobertos.has(n)))
          );
          itens.push(...extras);
          const primeiro = (i) => Math.min(...numerosDosParagrafos(i.paragrafos), 999);
          itens.sort((a, b) => primeiro(a) - primeiro(b));
          console.log("Estudo (complemento):", JSON.stringify({ faltando, recebidos: extras.map((i) => i.paragrafos), ...segunda.uso }));
        }
      } catch (e) {
        console.error("Estudo: complemento falhou", e?.status, e?.message);
      }
    }

    const memoriaUsada = memoriaUsadaAgora();
    const inicioFontes = Date.now();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    console.log("Estudo (tempo):", JSON.stringify({ fontes: Math.round((Date.now() - inicioFontes) / 100) / 10, total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));

    return res.status(200).json({
      titulo: limpar(dados.data.titulo, 200) || null,
      erro: itens.length
        ? null
        : itensTodos.length
          ? "A IA não respondeu ao(s) parágrafo(s) pedido(s). Tente de novo ou recarregue a numeração dos parágrafos."
          : limpar(dados.data.erro, 300) || "Não consegui ler o artigo ou encontrar as perguntas.",
      url,
      itens: itensFinais,
      memoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Perguntas adicionais para o dirigente ----------
// Três seções por pergunta impressa: 1 ou 2 complementares (pontos do parágrafo que a pergunta impressa não cobre),
// 1 ou 2 aplicativas (aplicação prática do ponto principal) e, com as opções marcadas, a explicação dos textos bíblicos.
// O servidor lê o artigo no wol.jw.org e manda à IA só os parágrafos pedidos; ela pensa antes de sugerir (texto curto).

const SaidaPerguntas = z.object({
  itens: z.array(
    z.object({
      paragrafos: z.string(),
      complementares: z.array(z.string()),
      aplicativas: z.array(z.string()),
      perguntasTextos: z.array(z.object({ referencia: z.string(), pergunta: z.string() })),
      perguntasEntendimento: z.array(z.object({ referencia: z.string(), perguntas: z.array(z.string()) })),
    })
  ),
});

async function sugerirPerguntas(res, body, P) {
  if (!codigoDoDirigente()) return erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
  // As perguntas adicionais para o dirigente pedem só o código do dirigente.
  if (!dirigenteValido(body.codigoDirigente, body.aparelhoId)) return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  const pedido = String(body.paragrafos || "").trim();
  if (/^(perguntas de )?recap/.test(pedido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) {
    return erro(res, 400, "As perguntas adicionais são para os parágrafos: escolha um ou mais (ex.: 3 ou 1-4).");
  }
  const alvo = /^[\d\s,\-–]{1,120}$/.test(pedido) ? numerosDosParagrafos(pedido) : null;
  if (!alvo || !alvo.size) return erro(res, 400, "Informe os parágrafos (ex.: 3 ou 1-4).");
  const maxParagrafos = P.limites.maxParagrafosEstudo;
  if (alvo.size > maxParagrafos)
    return erro(res, 400, `O máximo permitido é de ${maxParagrafos} ${maxParagrafos === 1 ? "parágrafo" : "parágrafos"} por consulta. Peça menos parágrafos de cada vez.`);

  const opcoes = validarOpcoes(body.opcoes);
  if (!opcoes.perguntasComplementares && !opcoes.perguntasAplicativas && !opcoes.perguntasTextos && !opcoes.perguntasEntendimento)
    return erro(res, 400, "Marque pelo menos uma seção das perguntas.");
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  // "Outra resposta" e "Melhorar": as perguntas já sugeridas voltam ao servidor (os mesmos itens que ele devolveu).
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  const inicio = Date.now();
  let lido = null;
  try {
    lido = await lerEstudoDireto(url);
  } catch (e) {
    console.error("Perguntas: leitura direta falhou", e?.name, e?.message);
  }
  if (!lido) return erro(res, 502, "Não consegui ler o artigo no wol.jw.org agora. Tente de novo em instantes.");

  const grupos = lido.grupos.filter((g) => g.numeros.some((n) => alvo.has(n)));
  if (!grupos.length) {
    const ultimo = Math.max(...lido.grupos.flatMap((g) => g.numeros));
    return erro(res, 400, `Não encontrei esse(s) parágrafo(s) no artigo "${lido.titulo}": ele vai do parágrafo 1 ao ${ultimo}.`);
  }
  const texto = textoDosGrupos(grupos);
  // Perguntas aplicativas: os dois parágrafos seguintes ao último pedido vão só como consulta, para a IA não sugerir uma aplicação que a matéria à frente já trata.
  let textoSeguintes = "";
  if (opcoes.perguntasAplicativas) {
    const ultimoPedido = Math.max(...grupos.flatMap((g) => g.numeros.filter((n) => alvo.has(n))));
    const seguintes = lido.grupos.filter((g) => !g.numeros.some((n) => alvo.has(n)) && g.numeros.some((n) => n > ultimoPedido && n <= ultimoPedido + 2));
    if (seguintes.length) textoSeguintes = textoDosGrupos(seguintes).slice(0, 6000);
  }
  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    "PEDIDO (seções ligadas pelo usuário):\n" +
    `- Seção 1, perguntas complementares ("complementares"): ${opcoes.perguntasComplementares ? "ATIVA" : "INATIVA"}\n` +
    `- Seção 2, perguntas aplicativas ("aplicativas"): ${opcoes.perguntasAplicativas ? "ATIVA" : "INATIVA"}\n` +
    `- Seção 3, perguntas sobre os textos bíblicos ("perguntasTextos"): ${opcoes.perguntasTextos ? "ATIVAS" : "INATIVAS"}\n` +
    `- Seção 3, perguntas de entendimento dos textos bíblicos ("perguntasEntendimento"): ${opcoes.perguntasEntendimento ? "ATIVAS" : "INATIVAS"}\n` +
    "\nTEXTO DO ESTUDO:\n" +
    texto +
    (textoSeguintes
      ? "\n\nPARÁGRAFOS SEGUINTES (só para consulta: não faça perguntas sobre eles; use-os apenas para evitar uma pergunta aplicativa cuja aplicação eles já tratam):\n" + textoSeguintes
      : "") +
    (await blocoLivros(P, texto)) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem +=
      "\n\nPERGUNTAS JÁ SUGERIDAS (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Perguntas do dirigente: outras perguntas" : "Perguntas do dirigente: melhorar"];
  }

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 8000 /* o raciocínio também conta aqui */, system: P.sistemaPerguntas, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaPerguntas, tarefa: "estudo-perguntas" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu sugerir perguntas para este parágrafo.");
    }

    const primeiro = (i) => Math.min(...numerosDosParagrafos(i.paragrafos), 999);
    const itens = resposta.parsed_output.itens
      .map((i) => ({
        paragrafos: limparLinha(i.paragrafos, 20),
        complementares: opcoes.perguntasComplementares
          ? i.complementares.map((q) => limparTextoGerado(q, 400)).filter(Boolean).slice(0, 2)
          : [],
        aplicativas: opcoes.perguntasAplicativas ? i.aplicativas.map((q) => limparTextoGerado(q, 400)).filter(Boolean).slice(0, 2) : [],
        perguntasTextos: opcoes.perguntasTextos
          ? i.perguntasTextos
              .map((t) => ({ referencia: limparLinha(t.referencia, 80), pergunta: limparTextoGerado(t.pergunta, 400) }))
              .filter((t) => t.referencia && t.pergunta)
              .slice(0, 2)
          : [],
        perguntasEntendimento: opcoes.perguntasEntendimento
          ? i.perguntasEntendimento
              .map((t) => ({
                referencia: limparLinha(t.referencia, 80),
                perguntas: t.perguntas.map((q) => limparTextoGerado(q, 400)).filter(Boolean).slice(0, 2),
              }))
              .filter((t) => t.referencia && t.perguntas.length)
              .slice(0, 2)
          : [],
      }))
      .filter(
        (i) =>
          (i.complementares.length || i.aplicativas.length || i.perguntasTextos.length || i.perguntasEntendimento.length) &&
          [...numerosDosParagrafos(i.paragrafos)].some((n) => alvo.has(n))
      )
      .sort((a, b) => primeiro(a) - primeiro(b));

    console.log(
      "Perguntas adicionais:",
      JSON.stringify({
        modelo: P.ia.modelo,
        pedidos: [...alvo],
        recebidos: itens.map((i) => i.paragrafos),
        complementares: opcoes.perguntasComplementares,
        aplicativas: opcoes.perguntasAplicativas,
        paragrafosSeguintes: textoSeguintes.length,
        sobreTextos: opcoes.perguntasTextos,
        entendimento: opcoes.perguntasEntendimento,
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    // O parágrafo consultado (o primeiro dos pedidos) no app JW Library: o documento e o "par" do parágrafo.
    const parPedido = [...alvo].sort((a, b) => a - b).map((n) => lido.pids?.[n]).find(Boolean);
    return res.status(200).json({
      titulo: lido.titulo || null,
      erro: itens.length ? null : "A IA não sugeriu perguntas para esse(s) parágrafo(s). Tente de novo.",
      jwl: lido.id && parPedido ? { docid: lido.id, par: parPedido } : null,
      itens,
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo Bíblico de Congregação ----------
// O servidor lê o capítulo da semana no wol.jw.org (página de reuniões -> apostila Vida e Ministério -> link do item
// "Estudo bíblico de congregação"), com os trechos das publicações citadas nas perguntas (api/_wol.mjs). A IA responde
// às perguntas dos quadros marcados no mesmo estilo das respostas do estudo de A Sentinela (tamanho, formatação, textos
// bíblicos). O texto do capítulo não é devolvido ao navegador: só as respostas, o título e a lista das perguntas.

const SaidaEbc = z.object({
  itens: z.array(
    z.object({
      pergunta: z.string(),
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(
        z.object({
          trecho: z.string(),
          tipo: z.enum(TIPOS),
          estilo: z.enum(ESTILOS).nullable(),
          maiusculas: z.boolean(),
        })
      ),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
});

// Lê o capítulo da semana pedida; devolve o capítulo ou responde com o erro (e devolve null).
// autorizado = o chamador já conferiu o código (o do dirigente, nas tarefas dele); senão vale o código de pesquisa.
async function capituloEbc(res, body, autorizado = false) {
  if (!autorizado && !codigoValido(body.codigo, body.aparelhoId)) {
    if (!process.env.CODIGO_ESTUDO) {
      erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
      return null;
    }
    erro(res, 403, "Código de pesquisa inválido.");
    return null;
  }
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let capitulo = null;
  try {
    capitulo = await lerEstudoBiblico(url);
  } catch (e) {
    console.error("Estudo bíblico: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler o Estudo Bíblico de Congregação no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!capitulo) erro(res, 404, "Não encontrei o Estudo Bíblico de Congregação na apostila dessa semana.");
  return capitulo;
}

// O que o app mostra ao carregar: a matéria, o título e quantas perguntas há em cada quadro.
async function lerEbc(res, body) {
  // O cartão dos comentários lê com o código de pesquisa; o do dirigente, com o do dirigente.
  const autorizado = codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId);
  if (!autorizado) return recusarAcesso(res, body);
  const capitulo = await capituloEbc(res, body, true);
  if (!capitulo) return;
  return res.status(200).json({
    materia: capitulo.materia,
    titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
    url: capitulo.url,
    quadros: QUADROS_EBC.map((q) => ({ id: q.id, nome: q.nome, perguntas: capitulo.perguntas.filter((p) => p.quadro === q.id).length })),
    trechos: capitulo.trechos.length,
    imagens: capitulo.imagens || [],
  });
}

async function responderEbc(res, body, P) {
  const quadros = new Set((Array.isArray(body.quadros) ? body.quadros : []).filter((q) => QUADROS_EBC.some((x) => x.id === q)));
  if (!quadros.size) return erro(res, 400, "Marque pelo menos um quadro de perguntas.");
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  // Os versículos de "Leia o relato na Bíblia" e os citados nas perguntas vão junto: a Bíblia começa a carregar já.
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  const inicioPedido = Date.now();

  const capitulo = await capituloEbc(res, body);
  if (!capitulo) return;
  const perguntas = capitulo.perguntas.filter((p) => quadros.has(p.quadro));
  if (!perguntas.length) return erro(res, 400, "Os quadros marcados não têm perguntas neste capítulo.");

  let fontesEbc = { citadasPedidas: 0, trechosOk: 0, falhas: 0 };
  try {
    fontesEbc = await garantirTrechosEbc(capitulo, perguntas);
  } catch (e) {
    console.error("Estudo bíblico: trechos das publicações", e?.message);
  }

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...capitulo.leia, ...perguntas.flatMap((p) => p.referencias)], 12);
    } catch (e) {
      console.error("Estudo bíblico: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    "\n\n" +
    textoDoCapituloEbc(capitulo, perguntas, versiculos) +
    (await blocoLivros(P, perguntas.map((p) => p.pergunta || "").join(" ") + " " + (capitulo.titulo || "") + " " + capitulo.relato.join(" "))) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nRESPOSTAS ANTERIORES (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaEbc, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaEbc, tarefa: "ebc" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu gerar as respostas para este estudo.");
    }

    // Só as perguntas pedidas, uma vez cada, na ordem do capítulo. Diferente do estudo de A Sentinela, os textos citados
    // na pergunta não têm regra fixa (pedido do usuário): entram como os demais textos relevantes, que seguem as opções
    // de textos bíblicos marcadas (transcrever, só citar, explicar ou nenhuma).
    const permitidos = estilosDe(opcoes);
    const porId = new Map();
    for (const i of resposta.parsed_output.itens) {
      const id = limparLinha(String(i.pergunta).replace(/[[\]]/g, ""), 30);
      const pergunta = perguntas.find((p) => p.id.toLowerCase() === id.toLowerCase());
      if (!pergunta || porId.has(pergunta.id)) continue;
      const relevantes = [...new Set([...pergunta.referencias, ...(i.textosRelevantes || [])])];
      const item = montarItem({ ...i, paragrafos: pergunta.id, referencias: [], textosRelevantes: relevantes }, opcoes, permitidos, P.limites, sep);
      if (!item.resposta) continue;
      porId.set(pergunta.id, item);
    }
    const itens = perguntas.map((p) => porId.get(p.id)).filter(Boolean);

    console.log(
      "Estudo bíblico:",
      JSON.stringify({
        modelo: P.ia.modelo,
        materia: capitulo.materia,
        pedidas: perguntas.map((p) => p.id),
        respondidas: itens.map((i) => i.paragrafos),
        citadas: capitulo.citadas, // publicações citadas no capítulo inteiro
        citadasPedidas: fontesEbc.citadasPedidas,
        trechosOk: fontesEbc.trechosOk,
        trechos: capitulo.trechos.length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    const memoriaUsada = memoriaUsadaAgora();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    // Para o botão do JW Library ao lado do Copiar: o capítulo e o parágrafo da pergunta.
    const docidEbc = (String(capitulo.url || "").match(/\/wol\/d\/r5\/lp-t\/(\d+)/) || [])[1];
    if (docidEbc) {
      for (const i of itensFinais) {
        const pergunta = perguntas.find((p) => p.id === i.paragrafos);
        if (pergunta && pergunta.pid) i.jwl = { docid: docidEbc, par: pergunta.pid };
      }
    }
    console.log("Estudo bíblico (tempo):", JSON.stringify({ total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));
    const aviso =
      fontesEbc.falhas > 0
        ? `Não consegui ler ${fontesEbc.falhas} publicação(ões) citada(s) nas perguntas; a resposta pode ficar menos precisa.`
        : null;
    return res.status(200).json({
      materia: capitulo.materia,
      titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
      url: capitulo.url,
      erro: itens.length ? null : "A IA não respondeu às perguntas. Tente de novo.",
      aviso,
      itens: itensFinais,
      memoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Partes da apostila com perguntas (Preparar para comentar) ----------
// "Consideração" de Faça seu melhor no ministério (algumas semanas; ex.: "O que você diria?", com uma imagem) e Nossa vida cristã (quase toda semana,
// uma consideração com vídeo). O servidor lê a parte na apostila (com a matéria citada, a imagem e, na Nossa vida cristã, o texto da fala do vídeo,
// publicado pelo jw.org) e a IA responde como no Estudo Bíblico (mesmo formato e opções): executa a instrução, resume o vídeo e responde às
// perguntas; quando a pergunta fala da imagem, a IA recebe a própria imagem.
const PARTES_APOSTILA = {
  consideracao: {
    nome: "Consideração",
    ler: lerConsideracoes,
    texto: textoDasConsideracoes,
    sistema: (P) => P.sistemaConsideracao,
    semParte: "Esta semana não tem a parte de consideração na seção Faça seu melhor no ministério.",
    referencias: (i) => [...i.referencias, ...((i.licaoLida && i.licaoLida.referencias) || [])],
  },
  nvc: {
    nome: "Nossa vida cristã",
    ler: lerNossaVidaCrista,
    texto: textoDaNossaVidaCrista,
    sistema: (P) => P.sistemaNossaVidaCrista,
    semParte: "Esta semana a seção Nossa vida cristã não tem parte com vídeo ou perguntas.",
    referencias: (i) => [...i.referencias, ...(i.citadasLidas || []).flatMap((l) => l.referencias || [])],
  },
};

async function parteDaSemana(res, body, cfg) {
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  try {
    const dados = await cfg.ler(url);
    if (!dados) erro(res, 404, "Não encontrei a apostila dessa semana.");
    return dados;
  } catch (e) {
    console.error(cfg.nome + ": leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler a apostila no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
}

// Anotações · Reunião: os discursos e as considerações da reunião Vida e Ministério da semana (só os temas, o tipo e o tempo), para preencher
// o campo Tema / parte. Sem código: só lê os títulos da apostila no wol.jw.org.
async function partesDaSemanaParaAnotacoes(res, body) {
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) return erro(res, 400, "Semana inválida.");
  try {
    const dados = await lerPartesDaApostila(url);
    if (!dados) return erro(res, 404, "Não encontrei a apostila dessa semana no wol.jw.org.");
    return res.status(200).json(dados);
  } catch (e) {
    console.error("Anotações: partes da semana falharam", e?.name, e?.message);
    return erro(res, 502, "Não consegui ler a apostila no wol.jw.org agora. Tente de novo em instantes.");
  }
}

// O que o app mostra ao carregar (e para saber se a semana tem a parte): as partes, com o tema, o tempo, as perguntas e o vídeo. partes vazio = não tem.
async function lerParteDaSemana(res, body, cfg) {
  const autorizado = codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId);
  if (!autorizado) return recusarAcesso(res, body);
  const dados = await parteDaSemana(res, body, cfg);
  if (!dados) return;
  return res.status(200).json({
    semana: dados.semana,
    url: dados.url,
    partes: dados.itens.map((i) => ({
      numero: i.numero, titulo: i.titulo, minutos: i.minutos, texto: i.texto, perguntas: i.perguntas.map((q) => q.pergunta), imagens: i.imagens.length,
      // O texto da fala vai junto para o card "Transcrição do vídeo" (recolhido) do app.
      video: i.video ? { titulo: i.video.titulo, duracaoS: i.video.duracaoS, temTexto: Boolean(i.video.texto), texto: i.video.texto || "", fonte: i.video.fonte || "", paragrafos: true } : null,
    })),
    imagens: dados.itens.flatMap((i) => i.imagens.map((img) => ({ descricao: img.descricao, legenda: img.legenda, item: i.titulo }))),
  });
}

// ---------- Nossa vida cristã: a transcrição do vídeo formatada ----------
// A IA divide o texto da fala do vídeo em seções (título e emoji) e marca **negrito**, __itálico__ e palavras em MAIÚSCULAS, sem mudar as
// palavras. O app mostra com negrito e itálico de verdade (HTML) e guarda no aparelho. Guardada também aqui (por instância) para não pagar duas vezes.
const SaidaTranscricaoVideo = z.object({
  secoes: z.array(z.object({ titulo: z.string(), emoji: z.string().nullable(), paragrafos: z.array(z.string()) })),
});
const transcricoesFormatadas = new Map(); // título + começo do texto -> { quando, secoes }

const palavrasDe = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

async function formatarTranscricaoVideo(res, body, P) {
  const dados = await parteDaSemana(res, body, PARTES_APOSTILA.nvc);
  if (!dados) return;
  const item = dados.itens.find((i) => i.video && i.video.texto);
  if (!item) return erro(res, 404, "Esta semana não tem o texto de um vídeo na Nossa vida cristã.");
  const v = item.video;
  const chave = (v.titulo || "") + "|" + v.texto.slice(0, 200);
  const guardada = transcricoesFormatadas.get(chave);
  if (guardada && Date.now() - guardada.quando < 7 * 24 * 3600 * 1000) return res.status(200).json({ titulo: v.titulo, secoes: guardada.secoes });

  const mensagem =
    `VÍDEO: "${v.titulo || "(sem título)"}" (Nossa vida cristã, parte "${item.titulo}")\n` +
    `ASSUNTO DA PARTE (para entender o contexto; não entra na transcrição):\n${item.texto.slice(0, 1500)}\n\n` +
    `TRANSCRIÇÃO DO VÍDEO (parágrafos separados pelas pausas do vídeo):\n${v.texto}`;
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const resposta = await chamarIa(client, P, { max_tokens: 14000, system: P.sistemaTranscricaoVideo, messages: [{ role: "user", content: mensagem }] }, { schema: SaidaTranscricaoVideo, tarefa: "nvc-transcricao" });
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return erro(res, 502, "A IA não conseguiu formatar a transcrição.");
    const secoes = resposta.parsed_output.secoes
      .map((s) => ({ titulo: limparLinha(s.titulo, 120), emoji: s.emoji ? limparLinha(s.emoji, 8) : "", paragrafos: s.paragrafos.map((p) => String(p || "").trim().slice(0, 4000)).filter(Boolean) }))
      .filter((s) => s.paragrafos.length);
    // Fidelidade: as palavras da fala têm de estar quase todas lá (a IA só formata). Se faltar muito, o app fica com o texto simples.
    const originais = palavrasDe(v.texto);
    const formatadas = new Set(palavrasDe(secoes.flatMap((s) => s.paragrafos).join(" ")));
    const cobertura = originais.length ? originais.filter((w) => formatadas.has(w)).length / originais.length : 0;
    console.log("Transcrição do vídeo:", JSON.stringify({ modelo: P.ia.modelo, titulo: v.titulo, secoes: secoes.length, cobertura: Math.round(cobertura * 100) / 100, entrada: resposta.usage?.input_tokens || 0, saida: resposta.usage?.output_tokens || 0 }));
    if (!secoes.length || cobertura < 0.9) return erro(res, 502, "A formatação da IA deixou partes da fala de fora; ficou o texto simples. Tente de novo.");
    transcricoesFormatadas.set(chave, { quando: Date.now(), secoes });
    if (transcricoesFormatadas.size > 50) transcricoesFormatadas.delete(transcricoesFormatadas.keys().next().value);
    return res.status(200).json({ titulo: v.titulo, secoes });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Assistente de pesquisas ----------
// Duas etapas. "pesquisa-coletar": a IA da pesquisa (leve) escolhe as buscas; o servidor pesquisa no wol.jw.org (cada matéria aberta com a busca,
// para achar o parágrafo, a página e o número dele), nos verbetes do Perspicaz e nos livros do servidor, e devolve as fontes ao app.
// "pesquisa": a IA da resposta final escreve a pesquisa só com as fontes (que o app manda de volta), citando cada uma por [F1], [F2]…
// Cada etapa tem o seu modelo, de qualquer família (P.ia.provedorTarefa diz quem atende).
const SaidaConsultasPesquisa = z.object({ consultas: z.array(z.string()), verbetes: z.array(z.string()), livros: z.string(), internet: z.boolean(), internetBusca: z.string() });
const SaidaPesquisa = z.object({
  titulo: z.string(),
  introducao: z.string(),
  secoes: z.array(z.object({ titulo: z.string(), emoji: z.string().nullable(), paragrafos: z.array(z.string()) })),
  conclusao: z.string().nullable(),
});
const MAX_FONTES_PESQUISA = 30;
// O nome da publicação pela citação do Guia de Pesquisa ("w22.04", "wp23 N.° 1", "g 3/12", "ijwbq artigo 189"…).
const PUBLICACOES_POR_SIGLA = [
  [/^wp\d/i, "A Sentinela (Público)"], [/^ws\d/i, "A Sentinela (Fácil de Ler)"], [/^w\d/i, "A Sentinela"], [/^g\d|^g\s/i, "Despertai!"],
  [/^ijwbq/i, "Perguntas Bíblicas Respondidas (jw.org)"], [/^ijwbv/i, "Textos Bíblicos Explicados (jw.org)"], [/^ijwyp/i, "Os Jovens Perguntam (jw.org)"],
  [/^ijwfq/i, "Perguntas Frequentes (jw.org)"], [/^ijw/i, "jw.org"], [/^mrt/i, "Artigos do jw.org"], [/^lff/i, "Seja Feliz para Sempre!"], [/^lfb/i, "Lições da Bíblia"],
  [/^nwt/i, "Tradução do Novo Mundo"], [/^it-\d/i, "Estudo Perspicaz das Escrituras"], [/^cl\b/i, "Achegue-se a Jeová"], [/^cf\b/i, "“Venha Ser Meu Seguidor”"],
  [/^lv\b/i, "“Continuem no Amor de Deus”"], [/^jy\b/i, "Jesus — o Caminho, a Verdade e a Vida"], [/^rj\b/i, "Volte para Jeová"], [/^yp\d/i, "Os Jovens Perguntam"],
  [/^bhs\b/i, "O Que a Bíblia Realmente Ensina?"], [/^ia\b/i, "Imite a Sua Fé"], [/^kr\b/i, "O Reino de Deus Já Governa!"], [/^rr\b/i, "A Adoração Pura de Jeová"],
];
const publicacaoDoCodigo = (codigo) => (PUBLICACOES_POR_SIGLA.find(([re]) => re.test(codigo)) || [null, "Publicação das Testemunhas de Jeová"])[1];
const nomeDoModelo = (id) => {
  const m = MODELOS_IA.find((x) => x.id === id);
  return m ? m.nome.split(":")[0] : id;
};

// ---------- Assistente de pesquisas: vídeo do jw.org (aba Vídeo) ----------
// O usuário cola o link do vídeo. O servidor pega o texto da fala que o jw.org publica (legenda AIVTT ou a comum); sem ele, e com um modelo
// Gemini escolhido para o vídeo, manda o menor arquivo do vídeo (até 12 MB) para a IA ouvir e transcrever. Depois a IA do vídeo faz o resumo,
// os pontos principais e a transcrição em seções (sem mudar as palavras; o servidor confere se pelo menos 85% delas continuam lá).
const SaidaVideoPesquisa = z.object({
  titulo: z.string(),
  resumo: z.string(),
  pontos: z.array(z.string()),
  secoes: z.array(z.object({ titulo: z.string(), emoji: z.string().nullable(), paragrafos: z.array(z.string()) })),
});
// Vídeos longos (programas mensais, formaturas de Gileade: 1 a 2 horas, 50 a 120 mil caracteres): antes o texto era cortado em 24 mil e a
// transcrição saía pela metade. Agora o texto vem inteiro (até MAX_TEXTO_VIDEO_PESQUISA); acima de LIMITE_VIDEO_UMA_VEZ, a IA faz o resumo e os
// pontos com o texto todo (só esses campos) e a transcrição em seções por partes de ~PARTE_VIDEO caracteres, em paralelo, juntadas na ordem.
const MAX_TEXTO_VIDEO_PESQUISA = 160000;
const LIMITE_VIDEO_UMA_VEZ = 26000;
const PARTE_VIDEO = 18000;
const SaidaVideoResumo = z.object({ titulo: z.string(), resumo: z.string(), pontos: z.array(z.string()) });
const SaidaVideoSecoes = z.object({ secoes: z.array(z.object({ titulo: z.string(), emoji: z.string().nullable(), paragrafos: z.array(z.string()) })) });
// Divide o texto em partes de até "tamanho" caracteres, sempre no fim de um parágrafo (ou de uma frase, se o parágrafo for enorme).
function partesDoTexto(texto, tamanho) {
  const paragrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const partes = [];
  let atual = "";
  // Parágrafo maior que a parte: cortado no último ponto (ou espaço) antes do limite, sem perder nenhum trecho.
  const cortar = (p) => {
    const out = [];
    let s = p;
    while (s.length > tamanho) {
      let i = s.lastIndexOf(". ", tamanho);
      if (i < tamanho * 0.5) i = s.lastIndexOf(" ", tamanho);
      if (i <= 0) i = tamanho - 1;
      out.push(s.slice(0, i + 1).trim());
      s = s.slice(i + 1);
    }
    if (s.trim()) out.push(s.trim());
    return out;
  };
  for (const p of paragrafos.flatMap((p) => (p.length > tamanho ? cortar(p) : [p]))) {
    if (atual && atual.length + p.length + 2 > tamanho) { partes.push(atual); atual = ""; }
    atual = atual ? atual + "\n\n" + p : p;
  }
  if (atual) partes.push(atual);
  return partes;
}
const limparSecoes = (secoes) =>
  secoes
    .map((s) => ({ titulo: limparLinha(s.titulo, 120), emoji: s.emoji ? limparLinha(s.emoji, 8) : "", paragrafos: s.paragrafos.map((p) => String(p || "").trim().slice(0, 4000)).filter(Boolean) }))
    .filter((s) => s.paragrafos.length);
// Que parte das palavras da fala aparece na transcrição em seções (1 = todas).
function coberturaDe(texto, secoes) {
  const originais = palavrasDe(texto);
  const formatadas = new Set(palavrasDe(secoes.flatMap((s) => s.paragrafos).join(" ")));
  return originais.length ? originais.filter((w) => formatadas.has(w)).length / originais.length : 0;
}
const secaoSimples = (texto, titulo = "Transcrição") => ({ titulo, emoji: "🎬", paragrafos: texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });

// A legenda do jw.org não traz a leitura dos textos bíblicos (o versículo aparece escrito na tela): "Por favor, abra sua Bíblia em Hebreus 6:10.
// Diz assim:" e a legenda pula para depois da leitura. Quando um parágrafo termina com dois-pontos e cita um texto pouco antes, o servidor põe
// logo depois o versículo da Tradução do Novo Mundo, entre aspas e com a referência (se o texto já não vier na fala). Devolve { texto, inseridos }.
async function completarLeiturasDoVideo(texto) {
  const paragrafos = texto.split(/\n{2,}/);
  const saida = [];
  let inseridos = 0;
  const palavras = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < paragrafos.length; i++) {
    const p = paragrafos[i];
    saida.push(p);
    if (!/:\s*$/.test(p.trim())) continue;
    try {
      const refs = await referenciasNoTexto(p.slice(-300));
      if (!refs.length) continue;
      const [v] = await buscarVersiculos([refs[refs.length - 1]], 1);
      if (!v || !v.texto) continue;
      // Já lido na fala (as primeiras palavras do versículo aparecem no parágrafo seguinte): não repete.
      const inicio = palavras(v.texto).slice(0, 6).join(" ");
      if (inicio && palavras(paragrafos[i + 1] || "").join(" ").includes(inicio)) continue;
      saida.push(`“${v.texto}” (${v.referencia})`);
      inseridos++;
    } catch {
      /* sem a Bíblia agora: segue sem a leitura */
    }
  }
  return { texto: saida.join("\n\n"), inseridos };
}

async function pesquisarVideo(res, body, P) {
  const link = String(body.link || "").trim().slice(0, 1000);
  const video = videoDoEndereco(link);
  if (!video) return erro(res, 400, "Cole o link de um vídeo do jw.org (no vídeo, toque em Compartilhar → Copiar link).");
  const contexto = textoLivre(body.contexto, 800);
  const modelo = P.ia.pesquisaVideoModelo;
  const provedor = provedorDoModelo(P.ia, modelo);
  const Pv = { ...P, ia: { ...P.ia, modelo, esforco: "low", provedorTarefa: provedor } };
  try {
    let lido = await lerTextoDoVideo(video, { timeoutMs: 12000, maxCaracteres: MAX_TEXTO_VIDEO_PESQUISA });
    let fonte = lido.fonte;
    let ouvido = false;
    if (!lido.texto) {
      if (provedor !== "gemini") return erro(res, 422, "Este vídeo não tem o texto da fala publicado pelo jw.org. Para a IA ouvir o vídeo, escolha um modelo Gemini em Ajustes → Modelos e agentes de IA → Vídeo.");
      const mp4 = await menorMp4DoVideo(video, { timeoutMs: 12000, maxBytes: 12_000_000 });
      if (!mp4) return erro(res, 422, "Este vídeo não tem o texto da fala publicado pelo jw.org e é grande demais para a IA ouvir.");
      const bytes = Buffer.from(await (await fetch(mp4.url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
      const ouvinte = criarClienteIa({ maxRetries: 0, timeout: 150_000 }, "gemini");
      const r = await chamarIa(
        ouvinte,
        Pv,
        { max_tokens: 16000, system: P.sistemaVideoOuvir, messages: [{ role: "user", content: [{ type: "audio", source: { type: "base64", media_type: "video/mp4", data: bytes.toString("base64") } }, { type: "text", text: `Transcreva a fala deste vídeo${mp4.titulo ? ` ("${mp4.titulo}")` : ""}.` }] }] },
        { semPensar: true, tarefa: "pesquisa-video" }
      );
      const texto = String((r.content && r.content[0] && r.content[0].text) || "").trim().slice(0, 24000);
      if (!texto) return erro(res, 502, "A IA não conseguiu transcrever o vídeo. Tente de novo.");
      lido = { titulo: lido.titulo || mp4.titulo, duracaoS: lido.duracaoS || mp4.duracaoS, texto };
      fonte = "transcrição feita pela IA (o vídeo não tem legenda publicada)";
      ouvido = true;
    }
    // Leituras de textos bíblicos que a legenda não traz: completadas com a Tradução do Novo Mundo.
    let leituras = 0;
    if (!ouvido) {
      const c = await completarLeiturasDoVideo(lido.texto);
      if (c.inseridos) {
        lido = { ...lido, texto: c.texto };
        leituras = c.inseridos;
        fonte += `; as leituras dos textos bíblicos, que a legenda não traz, foram completadas com a Tradução do Novo Mundo (${leituras})`;
      }
    }
    const minutos = lido.duracaoS ? ` (${Math.floor(lido.duracaoS / 60)} min ${String(lido.duracaoS % 60).padStart(2, "0")} s)` : "";
    const mensagem =
      `VÍDEO: "${lido.titulo || "(sem título)"}"${minutos}\n` +
      (contexto ? `O QUE O USUÁRIO QUER SABER DO VÍDEO: ${contexto}\n` : "") +
      `\nTRANSCRIÇÃO (${fonte}; parágrafos separados pelas pausas do vídeo):\n${lido.texto}`;
    const client = criarClienteIa({ maxRetries: 1, timeout: 180_000 }, provedor);
    const maxSaida = provedor === "gemini" ? 32000 : 16000;
    let o;
    let transcricao;
    let cobertura;
    let uso = { entrada: 0, saida: 0 };
    const somar = (r) => { uso.entrada += r.usage?.input_tokens || 0; uso.saida += r.usage?.output_tokens || 0; };
    let partes = 1;
    if (lido.texto.length <= LIMITE_VIDEO_UMA_VEZ) {
      const r = await chamarIa(client, Pv, { max_tokens: maxSaida, system: P.sistemaVideoPesquisa, messages: [{ role: "user", content: mensagem }] }, { schema: SaidaVideoPesquisa, tarefa: "pesquisa-video" });
      if (r.stop_reason === "refusal" || !r.parsed_output) return erro(res, 502, "A IA não conseguiu resumir o vídeo. Tente de novo.");
      somar(r);
      o = r.parsed_output;
      transcricao = limparSecoes(o.secoes);
      // Fidelidade: a transcrição em seções precisa trazer quase toda a fala; senão fica o texto simples, em parágrafos.
      cobertura = coberturaDe(lido.texto, transcricao);
      if (!transcricao.length || cobertura < 0.85) transcricao = [secaoSimples(lido.texto)];
    } else {
      // Vídeo longo: o resumo e os pontos com o texto todo; a transcrição em seções por partes, ao mesmo tempo. Cada parte que a IA não
      // devolver inteira (menos de 85% das palavras) fica em texto simples, para nada da fala se perder.
      const blocos = partesDoTexto(lido.texto, PARTE_VIDEO);
      partes = blocos.length;
      const cabecalho = `VÍDEO: "${lido.titulo || "(sem título)"}"${minutos}\n`;
      const [rResumo, ...rPartes] = await Promise.all([
        chamarIa(client, Pv, { max_tokens: 4000, system: P.sistemaVideoPesquisa, messages: [{ role: "user", content: mensagem }] }, { schema: SaidaVideoResumo, tarefa: "pesquisa-video" }).catch((e) => ({ erro: e })),
        ...blocos.map((b, i) =>
          chamarIa(client, Pv, { max_tokens: maxSaida, system: P.sistemaVideoPesquisa, messages: [{ role: "user", content: `${cabecalho}\nTRANSCRIÇÃO — PARTE ${i + 1} DE ${blocos.length} (${fonte}; parágrafos separados pelas pausas do vídeo):\n${b}` }] }, { schema: SaidaVideoSecoes, tarefa: "pesquisa-video" }).catch((e) => ({ erro: e }))
        ),
      ]);
      if (rResumo.erro || !rResumo.parsed_output) {
        if (rResumo.erro) throw rResumo.erro;
        return erro(res, 502, "A IA não conseguiu resumir o vídeo. Tente de novo.");
      }
      somar(rResumo);
      o = rResumo.parsed_output;
      transcricao = [];
      const coberturas = [];
      blocos.forEach((b, i) => {
        const r = rPartes[i];
        if (!r.erro) somar(r);
        const secoes = !r.erro && r.parsed_output ? limparSecoes(r.parsed_output.secoes) : [];
        const c = secoes.length ? coberturaDe(b, secoes) : 0;
        coberturas.push(Math.round(c * 100) / 100);
        transcricao.push(...(secoes.length && c >= 0.85 ? secoes : [secaoSimples(b, `Transcrição (parte ${i + 1})`)]));
      });
      cobertura = coberturas.length ? Math.min(...coberturas) : 0;
    }
    console.log("Pesquisa (vídeo):", JSON.stringify({ modelo, titulo: lido.titulo, ouvido, chars: lido.texto.length, partes, leituras, secoes: transcricao.length, cobertura: Math.round(cobertura * 100) / 100, entrada: uso.entrada, saida: uso.saida }));
    return res.status(200).json({
      titulo: limparLinha(o.titulo || lido.titulo, 160),
      resumo: String(o.resumo || "").trim().slice(0, 3000),
      pontos: o.pontos.map((p) => String(p || "").trim().slice(0, 1000)).filter(Boolean).slice(0, 15),
      transcricao,
      video: { titulo: lido.titulo || "", duracaoS: lido.duracaoS || 0, fonte, link, ouvido },
      modelo: nomeDoModelo(modelo),
      data: new Date().toISOString(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Assistente de pesquisas: sugerir vídeos do jw.org por assunto (aba Vídeo) ----------
// O catálogo público de vídeos do jw.org (guardado 24 h); a IA da pesquisa (leve) transforma o assunto em buscas (o mesmo prompt das buscas da
// pesquisa), o servidor separa até 40 vídeos cujos títulos e categorias combinam e a mesma IA escolhe até 5, dizendo em uma frase por que
// cada um ajuda. Sem a IA, ficam os 5 primeiros da busca por palavras.
const SaidaVideosSugeridos = z.object({ videos: z.array(z.object({ codigo: z.string(), motivo: z.string() })) });
const MAX_VIDEOS_SUGERIDOS = 20;
// As seções dos vídeos (para o campo "Seção" da busca): [{ caminho, total }]. Só lê o catálogo público (sem IA).
async function secoesDeVideos(res) {
  try {
    const catalogo = await catalogoDeVideos(12000);
    return res.status(200).json({ secoes: secoesDosVideos(catalogo), maxFalas: MAX_VIDEOS_FALAS });
  } catch (e) {
    console.error("Vídeos: seções indisponíveis", e?.message);
    return erro(res, 502, "Não consegui consultar as seções de vídeos do jw.org agora.");
  }
}

// Os vídeos de uma seção do catálogo (sem IA), na ordem do jw.org: ao escolher a seção na aba Vídeo, a lista aparece para escolher um vídeo
// direto. Seções grandes (mais de MAX_VIDEOS_LISTA_SECAO) não são listadas: o app pede para escolher uma subseção.
const MAX_VIDEOS_LISTA_SECAO = 150;
async function videosDaSecaoParaLista(res, body) {
  const secao = textoLivre(body.secao, 200);
  if (!secao) return erro(res, 400, "Escolha uma seção.");
  try {
    const lista = videosDaSecao(await catalogoDeVideos(12000), secao);
    if (!lista.length) return erro(res, 404, "Não encontrei vídeos nessa seção.");
    if (lista.length > MAX_VIDEOS_LISTA_SECAO) return res.status(200).json({ total: lista.length, max: MAX_VIDEOS_LISTA_SECAO, videos: [] });
    return res.status(200).json({
      total: lista.length,
      max: MAX_VIDEOS_LISTA_SECAO,
      videos: lista.map((v) => ({ titulo: v.titulo, duracao: v.duracao, categoria: v.categoria, publicado: v.publicado || "", motivo: "", trechos: [], link: `https://www.jw.org/finder?srcid=share&wtlocale=T&lank=${encodeURIComponent(v.lank)}` })),
    });
  } catch (e) {
    console.error("Vídeos: lista da seção indisponível", e?.message);
    return erro(res, 502, "Não consegui ler os vídeos dessa seção agora.");
  }
}

async function sugerirVideos(res, body, P) {
  const assunto = textoLivre(body.assunto, 300);
  if (assunto.length < 3) return erro(res, 400, "Escreva o assunto do vídeo que você procura.");
  const secao = textoLivre(body.secao, 200);
  const nasFalas = body.falas === true && Boolean(secao);
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: 45_000 }, P.ia.provedorTarefa);
    let palavras = [assunto];
    try {
      const r = await chamarIa(client, P, { max_tokens: 3000, system: P.sistemaPesquisaConsultas, messages: [{ role: "user", content: `ASSUNTO: ${assunto}` }] }, { schema: SaidaConsultasPesquisa, semPensar: true, tarefa: "pesquisa-videos" });
      if (r.parsed_output) palavras = [assunto, ...r.parsed_output.consultas, ...r.parsed_output.verbetes].map((p) => limparLinha(p, 80)).filter(Boolean);
    } catch (e) {
      console.error("Vídeos: buscas da IA indisponíveis; segue com o assunto", e?.message);
    }
    const catalogoTodo = await catalogoDeVideos(12000);
    // Com uma seção escolhida, a busca fica só nos vídeos dela.
    const catalogo = videosDaSecao(catalogoTodo, secao);
    if (secao && !catalogo.length) return erro(res, 404, "Não encontrei vídeos nessa seção.");
    if (nasFalas && catalogo.length > MAX_VIDEOS_FALAS) return erro(res, 400, `Essa seção tem ${catalogo.length} vídeos. Para procurar no que é falado, escolha uma seção com até ${MAX_VIDEOS_FALAS} vídeos (uma subseção).`);
    let candidatos = videosPorPalavras(catalogo, palavras, 60);
    // "Procurar também no que é falado": as legendas dos vídeos da seção; os que falam do assunto entram primeiro, com os trechos e os tempos.
    let comFala = new Map();
    if (nasFalas) {
      const doFalado = await videosPorFalas(catalogo, palavras, 9000);
      comFala = new Map(doFalado.map((v) => [v.lank, v]));
      const doTitulo = new Map(candidatos.map((v) => [v.lank, v]));
      candidatos = [
        ...doFalado.map((v) => ({ ...v, raras: Math.max(1, (doTitulo.get(v.lank) || {}).raras || 0) })),
        ...candidatos.filter((v) => !comFala.has(v.lank)),
      ].slice(0, 60);
    }
    if (!candidatos.length) return erro(res, 404, nasFalas ? "Não encontrei esse assunto nos títulos nem no que é falado nos vídeos dessa seção." : "Não encontrei vídeos sobre esse assunto. Tente outras palavras.");
    // Não há número fixo de sugestões: entram TODOS os vídeos relevantes (até MAX_VIDEOS_SUGERIDOS, para a lista não ficar enorme).
    // Sem a IA: os da busca que têm alguma palavra rara no título (ou, se nenhum tiver, os 5 primeiros).
    const comRaras = candidatos.filter((v) => v.raras > 0);
    let escolhidos = (comRaras.length ? comRaras.slice(0, MAX_VIDEOS_SUGERIDOS) : candidatos.slice(0, 5)).map((v) => ({ ...v, motivo: "" }));
    try {
      // Com a busca nas falas, cada vídeo que fala do assunto leva o trecho da fala (com o tempo), para a IA julgar pelo conteúdo e não só pelo título.
      const lista = candidatos
        .map((v, i) => {
          const fala = comFala.get(v.lank);
          return `[V${i + 1}] "${v.titulo}" (${v.duracao}; ${v.categoria})` + (fala ? ` — FALA DO VÍDEO: ${fala.trechos.map((t) => `aos ${t.tempo}: "${t.texto}"`).join(" | ")}` : "");
        })
        .join("\n");
      const r = await chamarIa(client, P, { max_tokens: 3000, system: P.sistemaVideosSugerir, messages: [{ role: "user", content: `ASSUNTO: ${assunto}\n\nVÍDEOS DO JW.ORG:\n${lista}` }] }, { schema: SaidaVideosSugeridos, semPensar: true, tarefa: "pesquisa-videos" });
      const o = r.parsed_output;
      if (o && o.videos.length) {
        const vistos = new Set();
        const daIa = o.videos
          .map((x) => ({ v: candidatos[Number(String(x.codigo).replace(/\D/g, "")) - 1], motivo: limparLinha(x.motivo, 300) }))
          .filter((x) => x.v && !vistos.has(x.v.lank) && vistos.add(x.v.lank))
          .slice(0, MAX_VIDEOS_SUGERIDOS)
          .map((x) => ({ ...x.v, motivo: x.motivo }));
        if (daIa.length) escolhidos = daIa;
      }
    } catch (e) {
      console.error("Vídeos: escolha da IA indisponível; ficam os da busca", e?.message);
    }
    // Os vídeos que têm no título uma palavra rara do PRÓPRIO assunto digitado (não das buscas que a IA gerou, que trazem ruído como "ataques
    // terroristas") e que a IA não citou também entram, depois dos dela (sem o motivo): assim nenhum vídeo claramente do assunto fica de fora.
    const ja = new Set(escolhidos.map((v) => v.lank));
    for (const v of videosPorPalavras(catalogo, [assunto], 60)) {
      if (escolhidos.length >= MAX_VIDEOS_SUGERIDOS) break;
      if (!ja.has(v.lank) && v.raras > 0) {
        ja.add(v.lank);
        escolhidos.push({ ...v, motivo: "" });
      }
    }
    console.log("Pesquisa (vídeos sugeridos):", JSON.stringify({ secao: secao || "todas", nasFalas, comFala: comFala.size, assunto, palavras: palavras.length, catalogo: catalogo.length, candidatos: candidatos.length, escolhidos: escolhidos.length }));
    return res.status(200).json({
      videos: escolhidos.map((v) => ({ titulo: v.titulo, duracao: v.duracao, categoria: v.categoria, publicado: v.publicado || "", motivo: v.motivo, trechos: (comFala.get(v.lank) || {}).trechos || [], link: `https://www.jw.org/finder?srcid=share&wtlocale=T&lank=${encodeURIComponent(v.lank)}` })),
    });
  } catch (e) {
    console.error("Vídeos: falha ao sugerir", e?.name, e?.message);
    return erro(res, 502, "Não consegui consultar os vídeos do jw.org agora. Tente de novo em instantes.");
  }
}

// ---------- Busca na internet (opcional, desmarcada por padrão) ----------
// Roda com o modelo escolhido em Ajustes para a "Busca na internet" (Gemini: busca do Google; Claude: a busca na web da Anthropic). A lista de
// sites confiáveis vai como PREFERÊNCIA no pedido, não como filtro: o que vier de outros sites também entra, sempre com o site e o endereço
// identificados, e o usuário decide se leva em conta. Devolve [{ site, titulo, url, texto }] (até 6 páginas).
const dominioDe = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
async function buscarNaInternet({ pedido, P }) {
  const modelo = P.ia.pesquisaWebModelo;
  const provedor = provedorDoModelo(P.ia, modelo);
  const Pweb = { ...P, ia: { ...P.ia, modelo, esforco: "low", provedorTarefa: provedor } };
  const sites = (P.ia.pesquisaSites || []).slice(0, 40);
  const system = P.sistemaPesquisaInternet + (sites.length ? `\n\nSITES DE PREFERÊNCIA (dê preferência a eles, sem deixar de usar outros sites confiáveis): ${sites.join(", ")}` : "");
  const client = criarClienteIa({ maxRetries: 1, timeout: 60_000 }, provedor);
  const ferramenta = provedor === "gemini" ? { type: "web_search", name: "web_search" } : { type: "web_search_20250305", name: "web_search", max_uses: 4 };
  let mensagens = [{ role: "user", content: pedido }];
  let resposta = null;
  // A busca da Anthropic pode parar no meio ("pause_turn"): continua até 3 vezes com o que já veio.
  for (let volta = 0; volta < 3; volta++) {
    resposta = await chamarIa(client, Pweb, { max_tokens: 4000, system, messages: mensagens, tools: [ferramenta] }, { semPensar: true, tarefa: volta ? "" : "pesquisa-internet" });
    if (resposta.stop_reason !== "pause_turn") break;
    mensagens = [...mensagens, { role: "assistant", content: resposta.content }];
  }
  return fontesDaBuscaNaWeb(resposta);
}

// As páginas de uma resposta com busca na web: [{ site, titulo, url, texto }] (até 6). Exportada para os testes.
export function fontesDaBuscaNaWeb(resposta) {
  const porUrl = new Map();
  const juntar = (url, titulo, trecho) => {
    if (!url || !/^https?:\/\//.test(url) || !trecho) return;
    const item = porUrl.get(url) || { url, titulo: titulo || "", trechos: [] };
    if (!item.trechos.includes(trecho)) item.trechos.push(trecho);
    if (!item.titulo && titulo) item.titulo = titulo;
    porUrl.set(url, item);
  };
  if (resposta.grounding) {
    // Gemini: cada página (groundingChunks) com os trechos da resposta que vieram dela (groundingSupports).
    const chunks = resposta.grounding.groundingChunks || [];
    for (const s of resposta.grounding.groundingSupports || []) {
      const texto = s.segment && s.segment.text ? String(s.segment.text).trim() : "";
      for (const i of s.groundingChunkIndices || []) {
        const web = chunks[i] && chunks[i].web;
        if (web) juntar(web.uri, web.title, texto);
      }
    }
  } else {
    // Claude: os trechos citados de cada página (citations do tipo web_search_result_location).
    for (const b of resposta.content || []) {
      if (b.type !== "text" || !Array.isArray(b.citations)) continue;
      for (const c of b.citations) if (c.type === "web_search_result_location") juntar(c.url, c.title, [String(b.text || "").trim(), c.cited_text ? `"${String(c.cited_text).trim()}"` : ""].filter(Boolean).join(" "));
    }
  }
  return [...porUrl.values()].slice(0, 6).map((p) => {
    const site = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p.titulo) ? p.titulo.replace(/^www\./, "") : dominioDe(p.url);
    return { site, titulo: p.titulo && p.titulo !== site ? limparLinha(p.titulo, 200) : "", url: p.url.slice(0, 1500), texto: p.trechos.join(" ").replace(/\s+/g, " ").slice(0, 1600) };
  });
}

// O texto bíblico pedido na aba Texto bíblico: { referencia, texto, livro, capitulo, versos, palavras } ou null (pedido inválido).
function textoBiblicoDoPedido(body) {
  const livro = Number(body.livro);
  const capitulo = Number(body.capitulo);
  const referencia = limparLinha(String(body.referencia || ""), 80);
  if (!Number.isInteger(livro) || livro < 1 || livro > 66 || !Number.isInteger(capitulo) || capitulo < 1 || capitulo > 150 || !referencia) return null;
  const versos = [...new Set((Array.isArray(body.versos) ? body.versos : []).map(Number).filter((v) => Number.isInteger(v) && v >= 1 && v <= 176))].sort((a, b) => a - b).slice(0, 40);
  const palavras = (Array.isArray(body.palavras) ? body.palavras : []).map((p) => limparLinha(String(p || ""), 80)).filter(Boolean).slice(0, 3);
  return { referencia, texto: String(body.textoBiblico || "").replace(/\s+/g, " ").trim().slice(0, 4000), livro, capitulo, versos, palavras };
}

async function coletarPesquisa(res, body, P) {
  const biblico = body.modo === "texto" ? textoBiblicoDoPedido(body) : null;
  if (body.modo === "texto" && !biblico) return erro(res, 400, "Escolha o texto bíblico da pesquisa.");
  const contexto = textoLivre(body.contexto, 800);
  // Na aba Texto bíblico, o "assunto" das buscas são as palavras-chave e o contexto (o texto inteiro traria palavras demais).
  const assunto = biblico ? textoLivre([...biblico.palavras, contexto].filter(Boolean).join(", "), 300) : textoLivre(body.assunto, 300);
  if (!biblico && assunto.length < 3) return erro(res, 400, "Escreva o assunto da pesquisa.");
  precarregarFontes({ perspicaz: true, livros: true });
  // Quantas fontes de cada lugar: no texto bíblico, as do próprio versículo vêm primeiro e as do assunto só completam.
  const limite = biblico ? { guia: 4, indice: 4, wol: 6 } : { guia: 8, indice: 8, wol: 14 };

  let consultas = assunto ? [assunto] : [];
  let verbetes = [];
  let consultaLivros = (biblico ? [biblico.texto, assunto].join(" ") : assunto + " " + contexto).trim();
  let precisaInternet = false;
  let buscaInternet = "";
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: 45_000 }, P.ia.provedorTarefa);
    const pedido = biblico
      ? `TEXTO BÍBLICO: ${biblico.referencia}${biblico.texto ? ` — "${biblico.texto.slice(0, 1500)}"` : ""}` +
        (biblico.palavras.length ? `\nPALAVRAS-CHAVE (o ponto do texto que o usuário quer focar): ${biblico.palavras.join("; ")}` : "") +
        (contexto ? `\nCONTEXTO: ${contexto}` : "")
      : `ASSUNTO: ${assunto}` + (contexto ? `\nCONTEXTO: ${contexto}` : "");
    const r = await chamarIa(
      client,
      P,
      { max_tokens: 3000, system: P.sistemaPesquisaConsultas, messages: [{ role: "user", content: pedido }] },
      { schema: SaidaConsultasPesquisa, semPensar: true, tarefa: "pesquisa-coletar" }
    );
    const o = r.parsed_output;
    if (o) {
      const limpas = o.consultas.map((q) => limparLinha(q, 80).replace(/["“”]/g, "")).filter((q) => q.length >= 3);
      if (limpas.length) consultas = [...new Set(limpas)].slice(0, 4);
      verbetes = o.verbetes.map((v) => limparLinha(v, 60)).filter(Boolean).slice(0, 3);
      // As palavras do usuário ficam na frente (6.10.97): a expressão que ele digitou ("conselheiro assistente") pesa na busca dos livros.
      if (o.livros && o.livros.trim().length >= 3) consultaLivros = limparLinha((biblico ? "" : assunto + " ") + o.livros, 320);
      // A IA decide se a internet faz falta (fundo histórico, arqueologia, dados estatísticos ou científicos que as publicações não trazem) e o
      // que procurar lá. Assuntos puramente espirituais nunca vão para a internet, mesmo com a caixinha marcada.
      precisaInternet = o.internet === true;
      buscaInternet = limparLinha(o.internetBusca || "", 300);
    }
  } catch (e) {
    console.error("Pesquisa: buscas da IA indisponíveis; segue com o assunto", e?.status, e?.message);
  }

  // Busca na internet: só se o usuário marcou E a IA viu que parte do assunto não está nas publicações do jw.org. Roda junto com a coleta no wol.
  const dispensouInternet = body.internet === true && !precisaInternet;
  const internet =
    body.internet === true && precisaInternet
      ? buscarNaInternet({
          P,
          pedido: biblico
            ? `Pesquise na internet só os dados que as publicações das Testemunhas de Jeová não trazem (fundo histórico, arqueologia, costumes da época, dados estatísticos ou científicos) ligados a ${biblico.referencia}` +
              (buscaInternet ? `. O que procurar: ${buscaInternet}` : "") +
              (biblico.palavras.length ? `. Foco: ${biblico.palavras.join("; ")}` : "") +
              (contexto ? `. Contexto: ${contexto}` : "") +
              "."
            : `Pesquise na internet só os dados que as publicações das Testemunhas de Jeová não trazem (fundo histórico, arqueologia, dados estatísticos ou científicos) sobre: ${assunto}` +
              (buscaInternet ? `. O que procurar: ${buscaInternet}` : "") +
              (contexto ? `. Contexto: ${contexto}` : "") +
              ".",
        }).catch((e) => {
          console.error("Pesquisa: busca na internet falhou", e?.status, e?.message);
          return null;
        })
      : Promise.resolve([]);

  try {
    // Texto bíblico: para cada versículo (até 6), a página de pesquisa do wol: as notas de estudo da Tradução do Novo Mundo e as citações do
    // Índice das Publicações 1991-2026 que comentam o versículo (até 10, intercalando os versículos, as mais recentes primeiro; no máximo 2 do
    // Perspicaz e 2 trechos do mesmo artigo).
    const doVersiculo = await (async () => {
      if (!biblico) return { notas: [], lidas: [] };
      try {
        const versos = (biblico.versos.length ? biblico.versos : [1]).slice(0, 6);
        const paginas = await Promise.all(versos.map((v) => pesquisaDoVersiculo(biblico.livro, biblico.capitulo, v, 9000).then((p) => (p ? { v, ...p } : null)).catch(() => null)));
        const caminhosNotas = [...new Set(paginas.filter((p) => p && p.notas).map((p) => p.notas.caminho))].slice(0, 4);
        const ordenadas = paginas.filter(Boolean).map((p) =>
          p.citacoes.map((c, i) => ({ ...c, verso: p.v, pontos: (c.ano || 2012) - i * 0.3 })).sort((a, b) => b.pontos - a.pontos)
        );
        const escolhidas = [];
        const chaves = new Set();
        let doPerspicaz = 0;
        for (let i = 0; i < 30 && escolhidas.length < 10; i++) {
          for (const lista of ordenadas) {
            const c = lista[i];
            if (!c || escolhidas.length >= 10) continue;
            const chave = c.citacao.split(/\s+/).slice(0, 2).join(" ");
            if (chaves.has(chave) || (/^it-\d/i.test(c.citacao) && doPerspicaz >= 2)) continue;
            if (/^it-\d/i.test(c.citacao)) doPerspicaz++;
            chaves.add(chave);
            escolhidas.push(c);
          }
        }
        const [notas, lidasBrutas] = await Promise.all([
          Promise.all(caminhosNotas.map((c) => notasDeEstudo(c, 9000).catch(() => null))),
          Promise.all(escolhidas.map((c) => trechoDaCitacaoDoIndice(c.caminho, 9000).then((p) => (p ? { c, p } : null)).catch(() => null))),
        ]);
        const porDoc = new Map();
        const lidas = lidasBrutas.filter((x) => {
          if (!x) return false;
          porDoc.set(x.p.docId, (porDoc.get(x.p.docId) || 0) + 1);
          return porDoc.get(x.p.docId) <= 2;
        });
        return { notas: notas.filter(Boolean), lidas };
      } catch (e) {
        console.error("Pesquisa: página do versículo indisponível", e?.message);
        return { notas: [], lidas: [] };
      }
    })();
    const docsDoVersiculo = new Set(doVersiculo.lidas.map(({ p }) => p.docId));

    // Guia de Pesquisa (jw.org): os tópicos do assunto e, deles, até 8 artigos (intercalando os tópicos, na ordem do Guia, no máximo 3 por
    // subtítulo); cada um lido no wol (a faixa de parágrafos indicada pelo Guia ou, sem ela, o parágrafo com mais palavras da busca).
    const doGuia = await (async () => {
      try {
        const topicos = await topicosDoGuiaPara([assunto, ...consultas].filter(Boolean), 9000, 2);
        const listasGuia = await Promise.all(topicos.map((t) => entradasDoGuia(t, 9000).then((e) => e.map((x) => ({ ...x, topico: t.nome }))).catch(() => [])));
        const escolhidas = [];
        const porSubtitulo = new Map();
        const docs = new Set(docsDoVersiculo);
        for (let i = 0; i < 40 && escolhidas.length < limite.guia; i++) {
          for (const lista of listasGuia) {
            const e = lista[i];
            if (!e || docs.has(e.docId) || escolhidas.length >= limite.guia) continue;
            const chave = e.topico + "|" + e.subtitulo;
            if ((porSubtitulo.get(chave) || 0) >= 3) continue;
            porSubtitulo.set(chave, (porSubtitulo.get(chave) || 0) + 1);
            docs.add(e.docId);
            escolhidas.push(e);
          }
        }
        const lidas = await Promise.all(
          escolhidas.map((e) =>
            (async () => {
              if (e.de) return faixaDoDocumento(e.docId, e.de, e.ate, 9000);
              const porNumero = e.parDe ? await paragrafosPorNumero(e.docId, e.parDe, e.parAte, 9000) : null;
              return porNumero || paragrafoDaPesquisa({ docId: e.docId, consulta: consultas[0] || assunto, proximidade: "par", titulo: e.titulo }, 9000);
            })()
              .then((p) => (p ? { e, p } : null))
              .catch(() => null)
          )
        );
        return { topicos: topicos.map((t) => t.nome), lidas: lidas.filter(Boolean) };
      } catch (e) {
        console.error("Pesquisa: Guia de Pesquisa indisponível", e?.message);
        return { topicos: [], lidas: [] };
      }
    })();

    // Índice das Publicações 1991-2026 (índice de assuntos): os assuntos da pesquisa (até 2) e, deles, até 8 citações dos subtópicos que mais
    // combinam com o assunto, o contexto e as buscas (no empate, as mais recentes), sem repetir artigos do Guia. O Perspicaz (it-) já vem à parte.
    const doIndice = await (async () => {
      try {
        const textosConsulta = [assunto, contexto, ...consultas].filter(Boolean);
        const assuntos = await assuntosDoIndicePara(textosConsulta, 9000, 2);
        const listasIndice = await Promise.all(assuntos.map((a) => entradasDoIndice(a, 9000).then((e) => e.map((x) => ({ ...x, assunto: a.nome }))).catch(() => [])));
        const termos = new Set(textosConsulta.flatMap((t) => palavrasDe(t).filter((w) => w.length >= 4).map((w) => w.slice(0, 6))));
        const candidatas = [];
        for (const entrada of listasIndice.flat()) {
          const casa = palavrasDe(entrada.rotulo).filter((w) => w.length >= 4 && termos.has(w.slice(0, 6))).length;
          const experiencia = /^casos reais|hist[óo]ria de vida/i.test(entrada.rotulo) ? -1 : 0;
          entrada.citacoes.forEach((c, i) => {
            if (/^it-\d/i.test(c.citacao)) return;
            candidatas.push({ ...c, assunto: entrada.assunto, rotulo: entrada.rotulo, pontos: casa * 30 + experiencia * 10 + (c.ano ? (c.ano - 1990) / 2 : 6) - i * 0.5 });
          });
        }
        candidatas.sort((a, b) => b.pontos - a.pontos);
        const escolhidas = [];
        const chaves = new Set();
        for (const c of candidatas) {
          const chave = c.citacao.split(/\s+/).slice(0, 2).join(" "); // mesma edição (ex.: "w15 1/7") só uma vez
          if (chaves.has(chave)) continue;
          chaves.add(chave);
          escolhidas.push(c);
          if (escolhidas.length >= 10) break;
        }
        const docsGuia = new Set([...doGuia.lidas.map(({ e }) => e.docId), ...docsDoVersiculo]);
        const porDoc = new Map(); // no máximo 2 trechos do mesmo artigo
        const lidas = (await Promise.all(escolhidas.map((c) => trechoDaCitacaoDoIndice(c.caminho, 9000).then((p) => (p ? { c, p } : null)).catch(() => null))))
          .filter((x) => {
            if (!x || docsGuia.has(x.p.docId)) return false;
            porDoc.set(x.p.docId, (porDoc.get(x.p.docId) || 0) + 1);
            return porDoc.get(x.p.docId) <= 2;
          })
          .slice(0, limite.indice);
        return { assuntos: assuntos.map((a) => a.nome), lidas };
      } catch (e) {
        console.error("Pesquisa: Índice das Publicações indisponível", e?.message);
        return { assuntos: [], lidas: [] };
      }
    })();

    // wol.jw.org: os achados de cada busca, intercalados (o 1º de cada, depois o 2º…), sem repetir o documento; até 14 matérias.
    const listas = await Promise.all(consultas.map((q) => pesquisarParagrafosNoWol(q, 9000, 6).catch(() => [])));
    const achados = [];
    const vistos = new Set([...doGuia.lidas.map(({ e }) => e.docId), ...doIndice.lidas.map(({ p }) => p.docId), ...docsDoVersiculo]);
    for (let i = 0; i < 6; i++) {
      for (const lista of listas) {
        const a = lista[i];
        if (a && !vistos.has(a.docId) && achados.length < limite.wol) {
          vistos.add(a.docId);
          achados.push(a);
        }
      }
    }
    const [lidos, verbetesLidos, trechosLivros] = await Promise.all([
      Promise.all(achados.map((a) => paragrafoDaPesquisa(a, 9000).then((p) => (p ? { a, p } : null)).catch(() => null))),
      fontesConfiguradas() ? Promise.all(verbetes.slice(0, 2).map((v) => buscarVerbete([v]).catch(() => null))) : [],
      fontesConfiguradas() ? buscarNosLivros(consultaLivros, { max: 4, maxChars: 1400 }).catch(() => []) : [],
    ]);

    const fontes = [];
    const siglas = await siglasDasPublicacoes(6000).catch(() => new Map());
    const nomeDaSigla = (codigo) => siglasPossiveis(codigo).map((s) => siglas.get(s)).find(Boolean) || publicacaoDoCodigo(codigo);
    // Texto bíblico: primeiro as notas de estudo e as citações do Índice para o versículo.
    for (const n of doVersiculo.notas) {
      fontes.push({ tipo: "wol", notas: true, publicacao: "Tradução do Novo Mundo (Edição de Estudo)", codigo: "", ano: null, titulo: n.titulo, pagina: null, paragrafos: "", texto: n.texto, url: n.url, docId: n.docId, pid: n.pid });
    }
    for (const { c, p } of doVersiculo.lidas) {
      // "w24.08 2-6" -> "w24.08" (a página vem à parte); "ijwbq artigo 120" e "lff lição 15" ficam inteiros.
      const codigo = /artigos?|li[çc][õo]es?|cap\.|parte/i.test(c.citacao) ? c.citacao : c.citacao.replace(/\s+[\d\s,–-]+$/, "").trim();
      fontes.push({ tipo: "wol", indice: `texto bíblico ${biblico.referencia.replace(/:.*$/, "")}:${c.verso}`, publicacao: nomeDaSigla(codigo), codigo, ano: c.ano, titulo: p.titulo, pagina: p.pagina, paragrafos: p.paragrafos, texto: p.texto, url: p.url, docId: p.docId, pid: p.pid });
    }
    const vistosVerbete = new Set();
    for (const v of verbetesLidos) {
      if (!v || vistosVerbete.has(v.verbete)) continue;
      vistosVerbete.add(v.verbete);
      fontes.push({ tipo: "perspicaz", publicacao: "Estudo Perspicaz das Escrituras", codigo: `it-${v.volume}`, ano: null, titulo: v.verbete, pagina: null, paragrafos: "", texto: v.trecho.slice(0, 2000), url: "" });
    }
    for (const t of trechosLivros) {
      fontes.push({ tipo: "livro", publicacao: t.livro, codigo: "", ano: null, titulo: "", pagina: null, paragrafos: "", texto: t.trecho, url: "" });
    }
    for (const { e, p } of doGuia.lidas) {
      const codigo = e.codigo.replace(/\s*(?:p[áa]gs?|pars?)\.\s.*$/i, "").trim(); // "w19.11 pág. 15 par. 7" -> "w19.11" (página e parágrafo vêm à parte)
      fontes.push({ tipo: "wol", guia: [e.topico, e.subtitulo].filter(Boolean).join(" › "), publicacao: nomeDaSigla(codigo), codigo, ano: e.ano, titulo: p.titulo || e.titulo, pagina: p.pagina, paragrafos: p.paragrafos, texto: p.texto, url: p.url, docId: e.docId, pid: p.pid });
    }
    for (const { c, p } of doIndice.lidas) {
      const codigo = c.citacao.replace(/\s+[\d\s,–-]+$/, "").trim(); // "w19.11 15" -> "w19.11" (a página vem à parte)
      fontes.push({ tipo: "wol", indice: [c.assunto, c.rotulo].filter(Boolean).join(" › "), publicacao: nomeDaSigla(codigo), codigo, ano: c.ano, titulo: p.titulo, pagina: p.pagina, paragrafos: p.paragrafos, texto: p.texto, url: p.url, docId: p.docId, pid: p.pid });
    }
    for (const item of lidos) {
      if (!item) continue;
      const { a, p } = item;
      fontes.push({ tipo: "wol", publicacao: a.publicacao, codigo: a.codigo, ano: a.ano, titulo: p.titulo || a.titulo, pagina: p.pagina, paragrafos: p.paragrafos, texto: p.texto, url: p.url, docId: a.docId, pid: p.pid });
    }
    // Por último, as páginas da internet (com o site identificado): a resposta as usa só na seção de informações complementares.
    const daInternet = await internet;
    // O limite de fontes (MAX_FONTES_PESQUISA) vale para tudo junto: as da internet têm o lugar garantido, e o que sobra das publicações sai do
    // fim da lista (a pesquisa no wol, a menos certeira). Antes, as da internet vinham por último e eram cortadas quando o wol já enchia a lista.
    const paginasWeb = (daInternet || []).slice(0, 6);
    fontes.splice(Math.max(0, MAX_FONTES_PESQUISA - paginasWeb.length));
    for (const w of paginasWeb) fontes.push({ tipo: "web", publicacao: w.site, codigo: "", ano: null, titulo: w.titulo, pagina: null, paragrafos: "", texto: w.texto, url: w.url });
    fontes.forEach((f, i) => (f.id = "F" + (i + 1)));
    console.log("Pesquisa (coletar):", JSON.stringify({ modelo: P.ia.modelo, internet: body.internet === true ? (dispensouInternet ? "dispensada" : daInternet ? daInternet.length : "falhou") : "não", buscaInternet: precisaInternet ? buscaInternet : undefined, modo: biblico ? "texto" : "assunto", referencia: biblico ? biblico.referencia : undefined, notas: doVersiculo.notas.length, doVersiculo: doVersiculo.lidas.length, consultas, verbetes, guia: doGuia.topicos, doGuia: doGuia.lidas.length, indice: doIndice.assuntos, doIndice: doIndice.lidas.length, wol: lidos.filter(Boolean).length, perspicaz: vistosVerbete.size, livros: trechosLivros.length }));
    if (!fontes.length) return erro(res, 404, "Não encontrei matérias sobre esse assunto no wol.jw.org nem nos arquivos. Tente outras palavras.");
    return res.status(200).json({ consultas, verbetes, fontes, internet: body.internet === true ? (daInternet ? daInternet.length : -1) : undefined, internetDispensada: dispensouInternet || undefined });
  } catch (e) {
    console.error("Pesquisa: falha ao coletar as fontes", e?.name, e?.message);
    return erro(res, 502, "Não consegui pesquisar no wol.jw.org agora. Tente de novo em instantes.");
  }
}

// As fontes que o app manda de volta (as mesmas da etapa 1, talvez só as marcadas): só campos conhecidos e tamanhos limitados.
export function fontesDaPesquisa(lista) {
  if (!Array.isArray(lista)) return [];
  const fontes = [];
  // As da internet (até 6) sempre entram; as publicações completam até o limite.
  const web = lista.filter((f) => f && f.tipo === "web").slice(0, 6);
  const publicacoes = lista.filter((f) => f && f.tipo !== "web").slice(0, MAX_FONTES_PESQUISA - web.length);
  for (const f of [...publicacoes, ...web]) {
    if (!f || typeof f !== "object") continue;
    const id = String(f.id || "");
    const texto = String(f.texto || "").trim().slice(0, 2200);
    if (!/^F\d{1,2}$/.test(id) || texto.length < 20 || fontes.some((x) => x.id === id)) continue;
    const tipo = ["wol", "perspicaz", "livro", "web"].includes(f.tipo) ? f.tipo : "wol";
    // Endereços: do wol.jw.org nas matérias; de qualquer site (http/https) nas páginas da internet.
    const url = typeof f.url === "string" && (tipo === "web" ? /^https?:\/\/[^\s"<>]{4,1500}$/ : /^https:\/\/wol\.jw\.org\/[^\s"<>]*$/).test(f.url) ? f.url : "";
    fontes.push({
      id,
      tipo,
      publicacao: limparLinha(String(f.publicacao || ""), 120),
      codigo: limparLinha(String(f.codigo || ""), 40),
      ano: Number.isInteger(f.ano) && f.ano > 1800 && f.ano < 2200 ? f.ano : null,
      titulo: limparLinha(String(f.titulo || ""), 200),
      pagina: Number.isInteger(f.pagina) && f.pagina > 0 && f.pagina < 5000 ? f.pagina : null,
      paragrafos: limparLinha(String(f.paragrafos || ""), 20),
      guia: limparLinha(String(f.guia || ""), 160),
      indice: limparLinha(String(f.indice || ""), 200),
      texto,
      url,
    });
  }
  return fontes;
}

function cabecalhoDaFonte(f) {
  if (f.tipo === "perspicaz") return `${f.publicacao}${f.codigo ? ` (${f.codigo})` : ""}, verbete "${f.titulo}"`;
  if (f.tipo === "livro") return `Livro "${f.publicacao}"`;
  if (f.tipo === "web") return `INTERNET (fonte externa, não é publicação das Testemunhas de Jeová): site ${f.publicacao}${f.titulo ? `, "${f.titulo}"` : ""}`;
  return [f.publicacao + (f.codigo ? ` (${f.codigo})` : ""), f.ano ? String(f.ano) : "", f.titulo ? `"${f.titulo}"` : "", f.pagina ? `p. ${f.pagina}` : "", f.paragrafos ? `par. ${f.paragrafos}` : "", f.guia ? `indicada no Guia de Pesquisa (tópico ${f.guia})` : "", f.indice ? `indicada no Índice das Publicações (assunto ${f.indice})` : ""].filter(Boolean).join(", ");
}

async function responderPesquisa(res, body, P) {
  const biblico = body.modo === "texto" ? textoBiblicoDoPedido(body) : null;
  if (body.modo === "texto" && !biblico) return erro(res, 400, "Escolha o texto bíblico da pesquisa.");
  const assunto = textoLivre(body.assunto, 300);
  const contexto = textoLivre(body.contexto, 800);
  if (!biblico && assunto.length < 3) return erro(res, 400, "Escreva o assunto da pesquisa.");
  const fontes = fontesDaPesquisa(body.fontes);
  if (!fontes.length) return erro(res, 400, "Nenhuma fonte foi escolhida para a pesquisa.");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
  const cabecalho = biblico
    ? `TEXTO BÍBLICO: ${biblico.referencia}` +
      (biblico.texto ? `\n"${biblico.texto}"` : "") +
      (biblico.palavras.length ? `\nPALAVRAS-CHAVE (o ponto do texto que o usuário quer focar): ${biblico.palavras.join("; ")}` : "")
    : `ASSUNTO: ${assunto}`;
  const mensagem =
    `DATA DA PESQUISA: ${hoje}\n${cabecalho}` +
    (contexto ? `\nCONTEXTO: ${contexto}` : "") +
    (!biblico && body.direta === true ? "\nRESPOSTA DIRETA: sim" : "") + // opção "Resposta direta" (6.10.97)
    "\n\nFONTES ENCONTRADAS (use só estas e cite cada informação pelo identificador entre colchetes):\n\n" +
    fontes.map((f) => `[${f.id}] ${cabecalhoDaFonte(f)}\n${f.texto}`).join("\n\n");
  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: 240_000 }, P.ia.provedorTarefa);
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: P.ia.provedorTarefa === "gemini" ? 32000 : 16000, system: biblico ? P.sistemaPesquisaTexto : P.sistemaPesquisa, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaPesquisa, tarefa: "pesquisa" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return erro(res, 502, "A IA não conseguiu escrever a pesquisa. Tente de novo.");
    const validos = new Set(fontes.map((f) => f.id));
    const usadas = [];
    // [F1, F3] e [F1][F3] viram [F1][F3]; identificador que não veio no pedido sai.
    const limpar = (texto, max) =>
      String(texto || "")
        .replace(/\[\s*(F\d{1,2}(?:\s*[,;]\s*F?\d{1,2})*)\s*\]/gi, (todo, lista) =>
          lista
            .split(/\s*[,;]\s*/)
            .map((x) => "F" + x.replace(/\D/g, ""))
            .filter((x) => validos.has(x))
            .map((x) => {
              if (!usadas.includes(x)) usadas.push(x);
              return `[${x}]`;
            })
            .join("")
        )
        .replace(/[ \t]+([.,;:!?])/g, "$1")
        .trim()
        .slice(0, max);
    const o = resposta.parsed_output;
    const resultado = {
      titulo: limparLinha(o.titulo, 160),
      introducao: limpar(o.introducao, 3000),
      secoes: o.secoes
        .map((s) => ({ titulo: limparLinha(s.titulo, 120), emoji: s.emoji ? limparLinha(s.emoji, 8) : "", paragrafos: s.paragrafos.map((p) => limpar(p, 4000)).filter(Boolean) }))
        .filter((s) => s.titulo && s.paragrafos.length)
        .slice(0, 10),
      conclusao: o.conclusao ? limpar(o.conclusao, 2000) : "",
      fontesUsadas: usadas,
      modelo: nomeDoModelo(P.ia.modelo),
      data: new Date().toISOString(),
    };
    console.log("Pesquisa (resposta):", JSON.stringify({ modelo: P.ia.modelo, fontes: fontes.length, usadas: usadas.length, secoes: resultado.secoes.length, segundosIa: Math.round((Date.now() - inicio) / 100) / 10, entrada: resposta.usage?.input_tokens || 0, saida: resposta.usage?.output_tokens || 0 }));
    if (!resultado.secoes.length) return erro(res, 502, "A IA não conseguiu escrever a pesquisa. Tente de novo.");
    return res.status(200).json(resultado);
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Adoração em Família (6.11.02) ----------
// A tela Adoração em Família (atalho do Início e menu, liberada pelo código de pesquisa) manda o perfil da família: só apelidos, papéis e
// idades (calculadas no aparelho), as circunstâncias e as atividades marcadas, a duração e o assunto da semana (opcional). O servidor junta as
// matérias do wol.jw.org sobre o assunto, os cânticos e os vídeos do jw.org que combinam com a família, e a IA (a mesma da resposta final das
// pesquisas) prepara 3 opções completas. Nada do perfil fica guardado no servidor nem vai para o log.
const SaidaAdoracaoFamilia = z.object({
  opcoes: z.array(
    z.object({
      titulo: z.string(),
      emoji: z.string().nullable(),
      resumo: z.string(),
      objetivo: z.string(),
      partes: z.array(
        z.object({
          nome: z.string(),
          minutos: z.number(),
          responsavel: z.string().nullable(),
          descricao: z.string(),
          textos: z.array(z.string()),
          videos: z.array(z.string()),
          canticos: z.array(z.number()),
          publicacoes: z.array(z.string()),
          perguntas: z.array(z.string()),
          // Jogo da parte, todo PRONTO para jogar (6.11.24): regras, material e o conteúdo (rodadas, perguntas, personagens, abreviações…).
          jogo: z.object({ tipo: z.string(), nome: z.string(), comoJogar: z.string(), material: z.string().nullable(), itens: z.array(z.string()) }).nullable(),
        })
      ),
      preparacao: z.array(z.string()),
      tarefas: z.array(z.object({ membro: z.string(), tarefa: z.string() })),
      dicaParaOChefe: z.string().nullable(),
      // Tema personalizado do FunPlayB (só quando o jogo "FunPlayB: tema personalizado" for usado): perguntas para importar no jogo.
      funplayb: z
        .object({
          tema: z.string(),
          perguntas: z.array(z.object({ enunciado: z.string(), opcaoA: z.string(), opcaoB: z.string(), opcaoC: z.string(), opcaoD: z.string(), resposta: z.string(), dificuldade: z.string(), referencia: z.string() })),
        })
        .nullable(),
    })
  ),
});

// Os tipos de jogo que o usuário pode aceitar (os mesmos textos da tela) e o formato de importação do FunPlayB (CSV com ";").
const JOGOS_FAMILIA = [
  "Quem sou eu? (personagens bíblicos)",
  "Show do milhão bíblico (perguntas de múltipla escolha)",
  "Abreviações bíblicas (ex.: Os 12 A de C)",
  "Mímica de personagens e cenas",
  "Verdadeiro ou falso",
  "Ordem dos acontecimentos",
  "Quem disse isso? (frases da Bíblia)",
  "Jogo da memória (pares de cartas)",
  "Caça ao tesouro bíblico (pistas pela casa)",
  "Charadas e adivinhas bíblicas",
  "Bingo bíblico",
  "Complete o versículo",
  "Forca bíblica (papel e lápis)",
  "Palavras cruzadas ou caça-palavras (papel e lápis)",
  "Desenho e adivinhação (Pictionary bíblico)",
  "FunPlayB: jogar um tema de perguntas",
  "FunPlayB: tema personalizado (20 perguntas para importar)",
];
const JOGO_FUNPLAYB_PERSONALIZADO = JOGOS_FAMILIA[JOGOS_FAMILIA.length - 1];
const CABECALHO_FUNPLAYB = "tema;enunciado;opcao_a;opcao_b;opcao_c;opcao_d;resposta_correta;dificuldade;referencia";
const campoCsv = (v) => {
  const t = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const DURACOES_ADORACAO = [30, 45, 60, 90];
const MAX_MEMBROS_FAMILIA = 12;
const SITUACOES_FAMILIA = ["Batizado", "Publicador não batizado", "Removido", "Descrente", "Estudante"];
const PRIVILEGIOS_FAMILIA = ["Pioneiro regular", "Pioneiro auxiliar", "Pioneiro especial", "Ancião", "Servo ministerial", "Serviço de Betel", "Superintendente viajante", "Voluntário a distância", "Comulter", "Tempo integral especial"];
// As seções do catálogo de vídeos (nomes conferidos no catálogo em 2026-11-20), com quantos vídeos de cada (os mais novos), que entram
// conforme a família: as de família e de relatos da Bíblia sempre; a série do casamento quando há um casal; as de crianças com alguém de até
// 12 anos; as de adolescentes com alguém de 13 a 19; as adorações matinais quando não há criança (estudo pessoal, casal, adolescentes).
const SECOES_VIDEOS_FAMILIA = {
  sempre: [["Família", 65], ["A Bíblia › Relatos da Bíblia", 20], ["Produções Especiais › Tempos Bíblicos", 15], ["A Bíblia › Criação", 10]],
  casal: [["Séries › Como Ser Feliz no Casamento?", 10]],
  criancas: [["Crianças › Lições em vídeo", 40], ["Séries › Teve um Projeto?", 10], ["Séries › Sara e Jade", 10], ["Séries › Vamos Aprender com os Amigos de Jeová", 11], ["Crianças › Produções Especiais", 5], ["Crianças › Músicas", 15]],
  adolescentes: [["Adolescentes", 50], ["Séries › Vida de Adolescente", 10], ["Séries › O Que Outros Jovens Dizem", 10]],
  semCriancas: [["Programas e Eventos › Adorações Matinais", 25]],
};
// Onde procurar os vídeos das circunstâncias (bullying, luto, doença…): só nas seções ligadas à família e à vida prática, para palavras como
// "escola" não trazerem as escolas teocráticas.
const SECOES_CIRCUNSTANCIAS = ["Família", "Crianças", "Adolescentes", "Entrevistas e Casos Reais", "Nossas Reuniões e Obra de Pregação", "A Bíblia › Como Aplicar Princípios Bíblicos", "Séries › Vida de Adolescente", "Séries › O Que Outros Jovens Dizem", "Séries › Como Ser Feliz no Casamento?", "Séries › Seja Feliz para Sempre! — Vídeos", "Séries › Sara e Jade"];
const MAX_VIDEOS_FAMILIA = 300;

// Uma lista de textos curtos do pedido (circunstâncias, atividades): limpos, sem repetir e dentro dos limites.
function textosDaLista(valor, maxItens, maxChars) {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set();
  return valor
    .map((v) => textoLivre(v, maxChars))
    .filter((v) => v && !vistos.has(v.toLowerCase()) && vistos.add(v.toLowerCase()))
    .slice(0, maxItens);
}

function perfilDaFamilia(body) {
  const membros = (Array.isArray(body.membros) ? body.membros : [])
    .filter((m) => m && typeof m === "object")
    .map((m) => ({
      apelido: textoLivre(m.apelido, 30),
      papel: textoLivre(m.papel, 30),
      idade: Number.isInteger(m.idade) && m.idade >= 0 && m.idade <= 120 ? m.idade : null,
      // Situação espiritual e privilégios (6.11.17): só valores da lista; o ano não vale para "Descrente".
      situacao: SITUACOES_FAMILIA.includes(m.situacao) ? m.situacao : "",
      anoSituacao: m.situacao !== "Descrente" && Number.isInteger(m.anoSituacao) && m.anoSituacao >= 1900 && m.anoSituacao <= new Date().getFullYear() ? m.anoSituacao : null,
      privilegios: (Array.isArray(m.privilegios) ? m.privilegios : []).filter((p, i, l) => PRIVILEGIOS_FAMILIA.includes(p) && l.indexOf(p) === i),
    }))
    .filter((m) => m.apelido || m.papel)
    .slice(0, MAX_MEMBROS_FAMILIA);
  const anos = body.anosCasados;
  const atividades = textosDaLista(body.atividades, 20, 80);
  const legadoAmbos = Boolean(body.canticosInicioFim);
  const canticoInicial = Boolean(body.canticoInicial) || legadoAmbos || atividades.some((a) => /^c[aâ]ntico\s+inicial$/i.test(a));
  const canticoFinal = Boolean(body.canticoFinal) || legadoAmbos || atividades.some((a) => /^c[aâ]ntico\s+final$/i.test(a));
  const incluirVideo = atividades.some((a) => /v[ií]deo/i.test(a));
  // Jogos (6.11.24): com "Jogos ou adivinhas" marcado, só os tipos aceitos (lista da tela); sem nenhum marcado, sem jogos.
  const jogos = atividades.some((a) => /^jogos?\b/i.test(a)) ? (Array.isArray(body.jogos) ? body.jogos : []).filter((j, i, l) => JOGOS_FAMILIA.includes(j) && l.indexOf(j) === i) : [];
  return {
    jogos,
    jogoPapel: body.jogoPapel !== false,
    formacao: textoLivre(body.formacao, 80),
    membros,
    anosCasados: Number.isInteger(anos) && anos >= 0 && anos <= 80 ? anos : null,
    circunstancias: textosDaLista(body.circunstancias, 20, 80),
    outrasCircunstancias: textoLivre(body.outrasCircunstancias, 500),
    atividades,
    duracao: DURACOES_ADORACAO.includes(Number(body.duracao)) ? Number(body.duracao) : 45,
    // Quantas sugestões preparar (6.11.15): 1 ou 2; qualquer outro valor vale 2 (o padrão).
    quantidade: Number(body.quantidade) === 1 ? 1 : 2,
    assunto: textoLivre(body.assunto, 300),
    canticoInicial,
    canticoFinal,
    incluirVideo,
  };
}

// Os vídeos que a IA pode sugerir: primeiro os que combinam com o assunto (no catálogo todo) e com as circunstâncias (só nas seções de
// SECOES_CIRCUNSTANCIAS), com alguma palavra rara no título; depois os das seções da família (os mais novos de cada uma), sem repetir e até
// MAX_VIDEOS_FAMILIA.
function videosParaAFamilia(catalogo, perfil) {
  if (!catalogo.length) return [];
  const idades = perfil.membros.map((m) => m.idade).filter((i) => i !== null);
  const papeis = perfil.membros.map((m) => m.papel.toLowerCase());
  const casal = /casal|casad/i.test(perfil.formacao) || papeis.includes("marido") || papeis.includes("esposa") || (papeis.includes("pai") && papeis.includes("mãe"));
  const criancas = idades.some((i) => i <= 12);
  const secoes = [
    ...SECOES_VIDEOS_FAMILIA.sempre,
    ...(casal ? SECOES_VIDEOS_FAMILIA.casal : []),
    ...(criancas ? SECOES_VIDEOS_FAMILIA.criancas : SECOES_VIDEOS_FAMILIA.semCriancas),
    ...(idades.some((i) => i >= 13 && i <= 19) ? SECOES_VIDEOS_FAMILIA.adolescentes : []),
  ];
  const escolhidos = [];
  const vistos = new Set();
  const incluir = (v) => {
    if (v && escolhidos.length < MAX_VIDEOS_FAMILIA && !vistos.has(v.lank)) {
      vistos.add(v.lank);
      escolhidos.push(v);
    }
  };
  if (perfil.assunto) videosPorPalavras(catalogo, [perfil.assunto], 25).filter((v) => v.raras > 0).forEach(incluir);
  const circunstancias = [...perfil.circunstancias, perfil.outrasCircunstancias].filter(Boolean);
  if (circunstancias.length) {
    const daVida = catalogo.filter((v) => (v.categorias || [v.categoria]).some((c) => SECOES_CIRCUNSTANCIAS.some((s) => c === s || String(c).startsWith(s + " › "))));
    videosPorPalavras(daVida, circunstancias, 25).filter((v) => v.raras > 0).forEach(incluir);
  }
  for (const [secao, maximo] of secoes) {
    videosDaSecao(catalogo, secao)
      .slice()
      .sort((a, b) => String(b.publicadoEm || "").localeCompare(String(a.publicadoEm || "")))
      .slice(0, maximo)
      .forEach(incluir);
  }
  return escolhidos;
}

// Ajuste da programação que o usuário montou marcando partes das duas opções (6.11.20): a IA só escreve a transição entre as partes e,
// se precisar, melhora a descrição de cada uma. O servidor devolve só esses textos; o app os junta à programação dele (textos bíblicos,
// vídeos e cânticos não passam por aqui de volta).
const SaidaAjusteFamilia = z.object({
  partes: z.array(z.object({ indice: z.number(), transicao: z.string().nullable(), descricao: z.string().nullable() })),
  dicaParaOChefe: z.string().nullable(),
});

async function ajustarProgramaFamilia(res, body, P) {
  const perfil = perfilDaFamilia(body);
  const prog = body.programa && typeof body.programa === "object" ? body.programa : {};
  const partes = (Array.isArray(prog.partes) ? prog.partes : [])
    .filter((p) => p && typeof p === "object")
    .slice(0, 12)
    .map((p) => ({
      nome: textoLivre(p.nome, 120),
      minutos: Number.isFinite(Number(p.minutos)) ? Math.max(0, Math.min(300, Math.round(Number(p.minutos)))) : 0,
      responsavel: textoLivre(p.responsavel, 60),
      descricao: textoLivre(p.descricao, 1500),
      textos: textosDaLista(p.textos, 4, 80),
      videos: textosDaLista(p.videos, 3, 160),
      canticos: textosDaLista(p.canticos, 3, 120),
    }));
  if (partes.length < 2) return erro(res, 400, "Marque pelo menos duas partes para ajustar a programação.");
  const membros = perfil.membros
    .map((m) => `- ${m.apelido || "(sem apelido)"} — ${m.papel || "membro da família"}${m.idade !== null ? `, ${m.idade} anos` : ""}`)
    .join("\n");
  const soma = partes.reduce((s, p) => s + p.minutos, 0);
  const mensagem =
    `FORMAÇÃO DA FAMÍLIA: ${perfil.formacao || "não informada"}\n` +
    `MEMBROS:\n${membros || "- não informados"}\n` +
    (perfil.circunstancias.length || perfil.outrasCircunstancias ? `CIRCUNSTÂNCIAS (trate com tato): ${[...perfil.circunstancias, perfil.outrasCircunstancias].filter(Boolean).join("; ")}\n` : "") +
    `DURAÇÃO TOTAL PREVISTA: ${perfil.duracao} minutos; SOMA DAS PARTES ESCOLHIDAS: ${soma} minutos\n\n` +
    `PARTES NA ORDEM ESCOLHIDA (indice, nome, minutos, responsável, descrição, textos, vídeos, cânticos):\n` +
    partes
      .map(
        (p, i) =>
          `[${i}] ${p.nome} — ${p.minutos} min${p.responsavel ? ` — ${p.responsavel}` : ""}\n  Descrição: ${p.descricao || "(sem descrição)"}` +
          (p.textos.length ? `\n  Textos: ${p.textos.join("; ")}` : "") +
          (p.videos.length ? `\n  Vídeos: ${p.videos.join("; ")}` : "") +
          (p.canticos.length ? `\n  Cânticos: ${p.canticos.join("; ")}` : "")
      )
      .join("\n");
  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: 120_000 }, P.ia.provedorTarefa);
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: P.ia.provedorTarefa === "gemini" ? 16000 : 8000, system: P.sistemaAdoracaoFamiliaAjuste, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaAjusteFamilia, tarefa: "adoracao-familia" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return erro(res, 502, "A IA não conseguiu ajustar a programação. Tente de novo.");
    const linha = (v, max) => limparLinha(semCulto(semGotica(typeof v === "string" ? v : "")), max);
    const saida = partes.map(() => ({ transicao: "", descricao: "" }));
    for (const a of resposta.parsed_output.partes) {
      const i = Number.isInteger(a.indice) ? a.indice : -1;
      if (i < 0 || i >= saida.length) continue;
      saida[i] = { transicao: linha(a.transicao, 400), descricao: linha(a.descricao, 1500) };
    }
    console.log("Adoração em Família (ajuste):", JSON.stringify({ modelo: P.ia.modelo, partes: partes.length, segundosIa: Math.round((Date.now() - inicio) / 100) / 10, entrada: resposta.usage?.input_tokens || 0, saida: resposta.usage?.output_tokens || 0 }));
    return res.status(200).json({ partes: saida, dicaParaOChefe: linha(resposta.parsed_output.dicaParaOChefe, 600), modelo: nomeDoModelo(P.ia.modelo), data: new Date().toISOString() });
  } catch (e) {
    return tratarErro(e, res);
  }
}

async function responderAdoracaoFamilia(res, body, P) {
  if (body.programa) return ajustarProgramaFamilia(res, body, P);
  const perfil = perfilDaFamilia(body);
  if (!perfil.formacao && !perfil.membros.length) return erro(res, 400, "Descreva a família: a formação e os membros.");
  precarregarFontes({ biblia: true });
  const consulta = perfil.assunto.length >= 8 ? perfil.assunto : perfil.assunto ? perfil.assunto + " família" : "";
  const usaCanticos = perfil.canticoInicial || perfil.canticoFinal || perfil.atividades.some((a) => /c[aâ]ntico/i.test(a));
  const atividadesGerais = perfil.atividades.filter((a) => !/^c[aâ]ntico\s+(inicial|final)$/i.test(a));
  const [canticos, catalogo, materias] = await Promise.all([
    usaCanticos ? lerCanticos().catch(() => null) : Promise.resolve(null),
    perfil.incluirVideo ? catalogoDeVideos(12000).catch(() => []) : Promise.resolve([]),
    consulta ? pesquisarNoWol(consulta, 8000, 6).catch(() => []) : [],
  ]);
  const videos = videosParaAFamilia(catalogo || [], perfil);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const membros = perfil.membros
    .map(
      (m) =>
        `- ${m.apelido || "(sem apelido)"} — ${m.papel || "membro da família"}${m.idade !== null ? `, ${m.idade} ${m.idade === 1 ? "ano" : "anos"}` : ""}` +
        (m.situacao ? `; situação espiritual: ${m.situacao}${m.anoSituacao ? ` (desde ${m.anoSituacao})` : ""}` : "") +
        (m.privilegios.length ? `; privilégios de serviço: ${m.privilegios.join(", ")}` : "")
    )
    .join("\n");
  const circunstancias = [...perfil.circunstancias, perfil.outrasCircunstancias].filter(Boolean);
  const qtd = perfil.quantidade;
  const todas = qtd === 1 ? "a opção" : `TODAS as ${qtd} opções`;
  const mensagem =
    `DATA: ${hoje}\n` +
    `QUANTIDADE DE OPÇÕES: prepare EXATAMENTE ${qtd} ${qtd === 1 ? "opção" : "opções"} (onde as instruções falarem em 3 opções, vale ${qtd}).\n` +
    `FORMAÇÃO DA FAMÍLIA: ${perfil.formacao || "não informada"}\n` +
    `MEMBROS (apelido, papel, idade, situação espiritual e privilégios):\n${membros || "- não informados"}\n` +
    (perfil.membros.some((m) => m.situacao || m.privilegios.length)
      ? `USO DA SITUAÇÃO ESPIRITUAL E DOS PRIVILÉGIOS: adapte as partes e as tarefas a cada um (quem é batizado ou tem privilégios pode conduzir ou ajudar mais; publicador não batizado e estudante podem ser incentivados com carinho, sem pressão; "Removido" e "Descrente" pedem muito tato: nunca exponha, cobre ou designe parte que o constranja, e não os cite nas tarefas de forma que os diferencie dos demais). Nunca escreva a situação espiritual de ninguém no texto das opções.\n`
      : "") +
    (perfil.anosCasados !== null ? `ANOS DE CASADOS: ${perfil.anosCasados}\n` : "") +
    (circunstancias.length ? `CIRCUNSTÂNCIAS QUE O CHEFE QUIS INFORMAR (trate com tato, nunca exponha ninguém):\n${circunstancias.map((c) => `- ${c}`).join("\n")}\n` : "") +
    `ATIVIDADES QUE A FAMÍLIA ACEITA (além de oração, leitura da Bíblia e conversa): ${atividadesGerais.length ? atividadesGerais.join("; ") : "só essas"}\n` +
    `CÂNTICO INICIAL: ${perfil.canticoInicial ? "SIM (inclua cântico na abertura)" : "NÃO (não inclua cântico na abertura)"}\n` +
    `CÂNTICO FINAL: ${perfil.canticoFinal ? "SIM (inclua cântico no encerramento)" : "NÃO (não inclua cântico no encerramento)"}\n` +
    `VÍDEO DO JW.ORG: ${
      perfil.incluirVideo
        ? videos.length
          ? `OBRIGATÓRIO em ${todas} (em CADA opção, inclua obrigatoriamente pelo menos 1 vídeo da lista abaixo no campo "videos" de uma das partes, pelo identificador ex.: "V3", levando a duração dele em conta nos minutos da parte)`
          : 'marcado, mas a lista de vídeos não está disponível agora (deixe "videos" vazio)'
        : 'NÃO (opção desmarcada; deixe "videos" vazio [] em todas as partes)'
    }\n` +
    (perfil.jogos.length
      ? `JOGOS ACEITOS PELA FAMÍLIA (use SÓ estes tipos): ${perfil.jogos.join("; ")}\n` +
        `PAPEL E LÁPIS NOS JOGOS: ${perfil.jogoPapel ? "podem ser usados (opcionalmente)" : "NÃO usar papel nem lápis"}\n` +
        `JOGO OBRIGATÓRIO: em CADA opção, inclua pelo menos UMA parte com jogo, preenchendo o campo "jogo" TODO PRONTO para jogar (regras curtas, material e o conteúdo completo em "itens": as rodadas, perguntas com respostas, personagens com dicas, abreviações com a resposta etc., conforme o tipo). Escolha jogos diferentes entre as opções, ligados ao assunto e adequados às idades. Só dados bem conhecidos, nada difícil demais nem inventado.\n` +
        (perfil.jogos.includes(JOGO_FUNPLAYB_PERSONALIZADO)
          ? `FUNPLAYB PERSONALIZADO: se uma opção usar o jogo "${JOGO_FUNPLAYB_PERSONALIZADO}", preencha nessa opção (em UMA só das opções) o campo "funplayb" com o tema e EXATAMENTE 20 perguntas de múltipla escolha sobre o assunto (enunciado até 250 caracteres; cada alternativa até 100; "resposta" a, b, c ou d, variando a posição da certa; "dificuldade" facil, medio ou dificil; "referencia" com o livro, capítulo e versículo da Bíblia ou da publicação e um trecho entre aspas, até 500 caracteres; "tema" até 40 caracteres). Nas outras opções, funplayb = null.\n`
          : `FUNPLAYB PERSONALIZADO: não usar (funplayb = null em todas as opções).\n`)
      : `JOGOS: NÃO (nenhum tipo de jogo aceito; deixe "jogo" = null em todas as partes e funplayb = null).\n`) +
    `DURAÇÃO TOTAL: ${perfil.duracao} minutos\n` +
    `ASSUNTO PEDIDO PARA ESTA SEMANA: ${perfil.assunto || (qtd === 1 ? "nenhum (escolha o assunto que melhor sirva para esta família)" : `nenhum (escolha ${qtd} assuntos bem diferentes, que sirvam para esta família)`)}\n` +
    (materias.length
      ? `\nMATÉRIAS DO WOL.JW.ORG SOBRE O ASSUNTO (cite pelo identificador, ex.: "P2"):\n${materias.map((m, i) => `[P${i + 1}] "${m.titulo}" (${m.rotulo}) — ${m.trecho.slice(0, 300)}`).join("\n")}\n`
      : "") +
    (!usaCanticos
      ? `\nCÂNTICOS: o chefe optou por não incluir cânticos. Deixe "canticos" vazio ([]) em todas as partes.\n`
      : canticos && canticos.length
        ? `\nCÂNTICOS DISPONÍVEIS (número. título [assunto]):\n${canticos.map((c) => `${c.numero}. ${c.titulo}${c.assunto ? ` [${c.assunto}]` : ""}`).join("\n")}\n`
        : `\nCÂNTICOS: a lista não está disponível agora. Deixe "canticos" vazio e, na descrição, fale de um cântico à escolha da família.\n`) +
    (!perfil.incluirVideo
      ? `\nVÍDEOS: a opção de vídeo está desmarcada. Deixe "videos" vazio ([]) em todas as partes.\n`
      : videos.length
        ? `\nVÍDEOS DO JW.ORG DISPONÍVEIS (OBRIGATÓRIO incluir pelo menos 1 vídeo em CADA opção, citando pelo identificador no campo "videos", ex.: "V3"${qtd > 1 ? "; de preferência escolha vídeos diferentes entre as opções" : ""}):\n${videos.map((v, i) => `[V${i + 1}] "${v.titulo}" (${[v.duracao, v.categoria, (v.publicado || "").slice(0, 4)].filter(Boolean).join("; ")})`).join("\n")}\n`
        : `\nVÍDEOS: a lista não está disponível agora. Deixe "videos" vazio em todas as partes.\n`);
  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: 240_000 }, P.ia.provedorTarefa);
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: P.ia.provedorTarefa === "gemini" ? 32000 : 16000, system: P.sistemaAdoracaoFamilia, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaAdoracaoFamilia, tarefa: "adoracao-familia" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return erro(res, 502, "A IA não conseguiu preparar as opções. Tente de novo.");
    const linha = (v, max) => limparLinha(semCulto(semGotica(typeof v === "string" ? v : "")), max);
    const porNumero = new Map((canticos || []).map((c) => [c.numero, c]));
    // Textos bíblicos: cada referência conferida na Bíblia do servidor (com o texto); a que não for achada fica só com a referência.
    const comBiblia = fontesConfiguradas();
    const textosDe = async (refs) => {
      const saida = [];
      const vistas = new Set();
      for (const bruta of (Array.isArray(refs) ? refs : []).slice(0, 6)) {
        if (saida.length >= 4) break;
        const ref = linha(bruta, 60);
        if (!ref) continue;
        const achado = comBiblia ? (await buscarVersiculos([ref], 1).catch(() => []))[0] : null;
        const referencia = achado ? achado.referencia : ref;
        if (vistas.has(referencia)) continue;
        vistas.add(referencia);
        saida.push({ referencia, texto: achado ? limparLinha(achado.texto, 2500) : "" });
      }
      return saida;
    };
    // "V3" (ou "[V3]", "V3 - título") -> o vídeo da lista enviada; o resto sai.
    const videoDe = (codigo) => {
      const m = String(codigo || "").match(/V\s*(\d{1,3})/i);
      const v = m ? videos[Number(m[1]) - 1] : null;
      return v ? { titulo: v.titulo, duracao: v.duracao || "", link: `https://www.jw.org/finder?srcid=share&wtlocale=T&lank=${encodeURIComponent(v.lank)}` } : null;
    };
    // "P2" -> a matéria do wol.jw.org enviada (título, publicação e endereço); um nome de publicação escrito pela IA fica como veio, sem endereço.
    const publicacaoDe = (valor) => {
      const texto = linha(valor, 200);
      if (!texto) return null;
      const m = texto.match(/^\[?P\s*(\d{1,2})\]?(?![\p{L}\d])/iu);
      const materia = m ? materias[Number(m[1]) - 1] : null;
      if (m && !materia) return null;
      return materia ? { titulo: limparLinha(materia.titulo, 200), fonte: limparLinha(materia.rotulo, 120), url: materia.url } : { titulo: texto, fonte: "", url: "" };
    };
    const semRepetir = (lista, chave) => {
      const vistos = new Set();
      return lista.filter((x) => x && !vistos.has(chave(x)) && vistos.add(chave(x)));
    };
    // O jogo da parte: só com tipos aceitos; o texto é limpo e limitado (regras, material e até 25 itens prontos).
    const jogoDe = (j) => {
      if (!perfil.jogos.length || !j || typeof j !== "object") return null;
      const nomeJogo = linha(j.nome, 80);
      const comoJogar = limparTextoGerado(j.comoJogar, 1200);
      const itens = (Array.isArray(j.itens) ? j.itens : []).map((t) => limparTextoGerado(t, 500)).filter(Boolean).slice(0, 25);
      if (!nomeJogo || !comoJogar) return null;
      return { tipo: linha(j.tipo, 80), nome: nomeJogo, comoJogar, material: perfil.jogoPapel || !/papel|l[aá]pis|caneta/i.test(String(j.material || "")) ? limparTextoGerado(j.material, 300) : "", itens };
    };
    // O tema do FunPlayB: cada pergunta confere os limites do módulo de importação (senão sai); o CSV sai pronto para colar.
    const funplaybDe = (f) => {
      if (!perfil.jogos.includes(JOGO_FUNPLAYB_PERSONALIZADO) || !f || typeof f !== "object") return null;
      const tema = linha(f.tema, 40);
      if (!tema) return null;
      const letras = ["a", "b", "c", "d"];
      const perguntas = [];
      for (const q of Array.isArray(f.perguntas) ? f.perguntas : []) {
        const enunciado = linha(q.enunciado, 250);
        const alternativas = [q.opcaoA, q.opcaoB, q.opcaoC, q.opcaoD].map((x) => linha(x, 100));
        const resp = String(q.resposta || "").trim().toLowerCase().slice(0, 1);
        const dif = String(q.dificuldade || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
        const referencia = linha(q.referencia, 500);
        if (!enunciado || alternativas.some((x) => !x) || !letras.includes(resp) || !referencia) continue;
        perguntas.push({ enunciado, opcaoA: alternativas[0], opcaoB: alternativas[1], opcaoC: alternativas[2], opcaoD: alternativas[3], resposta: resp, dificuldade: dif.includes("dific") ? "dificil" : dif.includes("medi") ? "medio" : "facil", referencia });
        if (perguntas.length >= 20) break;
      }
      if (perguntas.length < 5) return null;
      const csv = [CABECALHO_FUNPLAYB, ...perguntas.map((q) => [tema, q.enunciado, q.opcaoA, q.opcaoB, q.opcaoC, q.opcaoD, q.resposta, q.dificuldade, q.referencia].map(campoCsv).join(";"))].join("\n");
      return { tema, perguntas, csv };
    };
    const opcoes = [];
    for (const o of resposta.parsed_output.opcoes.slice(0, perfil.quantidade)) {
      const partes = [];
      const partesBrutas = (o.partes || []).slice(0, 10);
      for (let idxParte = 0; idxParte < partesBrutas.length; idxParte++) {
        const p = partesBrutas[idxParte];
        const nome = linha(p.nome, 80);
        if (!nome) continue;
        const ehOracaoInicial = (idxParte === 0 && /oraç[aã]o/i.test(nome)) || /oraç[aã]o\s+inicial/i.test(nome);
        const bloquearInicial = !perfil.canticoInicial && idxParte === 0 && !/treino/i.test(nome);
        const bloquearFinal = !perfil.canticoFinal && idxParte === partesBrutas.length - 1 && idxParte > 0 && !/treino/i.test(nome);
        const bloquearCantico = bloquearInicial || bloquearFinal;
        partes.push({
          nome,
          minutos: Math.min(120, Math.max(1, Math.round(Number(p.minutos) || 0))),
          responsavel: ehOracaoInicial ? "" : linha(p.responsavel, 40),
          descricao: limparTextoGerado(p.descricao, 1500),
          textos: await textosDe(p.textos),
          videos: perfil.incluirVideo ? semRepetir((p.videos || []).map(videoDe), (v) => v.link).slice(0, 3) : [],
          canticos: bloquearCantico ? [] : semRepetir((p.canticos || []).map((n) => porNumero.get(Math.round(Number(n)))), (c) => c.numero).slice(0, 3).map((c) => ({ numero: c.numero, titulo: c.titulo })),
          publicacoes: semRepetir((p.publicacoes || []).map(publicacaoDe), (x) => x.titulo.toLowerCase()).slice(0, 4),
          perguntas: (p.perguntas || []).map((q) => limparTextoGerado(q, 300)).filter(Boolean).slice(0, 5),
          jogo: jogoDe(p.jogo),
        });
      }
      if (!partes.length) continue;
      if (perfil.incluirVideo && videos.length && !partes.some((p) => p.videos.length)) {
        for (const p of partes) {
          const citados = [...String(p.descricao || "").matchAll(/\[?V\s*(\d{1,3})\]?(?![\p{L}\d])/gi)].map((m) => videoDe(m[0]));
          const achados = semRepetir(citados, (v) => v.link).slice(0, 3);
          if (achados.length) {
            p.videos = achados;
            break;
          }
        }
      }
      opcoes.push({
        titulo: linha(o.titulo, 120) || `Opção ${opcoes.length + 1}`,
        emoji: emojiDoComentario(o.emoji),
        resumo: limparTextoGerado(o.resumo, 600),
        objetivo: limparTextoGerado(o.objetivo, 400),
        partes,
        duracaoTotal: partes.reduce((s, p) => s + p.minutos, 0),
        preparacao: (o.preparacao || []).map((t) => limparTextoGerado(t, 300)).filter(Boolean).slice(0, 8),
        tarefas: (o.tarefas || [])
          .map((t) => ({ membro: linha(t.membro, 40), tarefa: limparTextoGerado(t.tarefa, 400) }))
          .filter((t) => t.tarefa && !/fazer a oraç[aã]o inicial|^oraç[aã]o inicial$/i.test(t.tarefa))
          .slice(0, 10),
        dicaParaOChefe: o.dicaParaOChefe ? limparTextoGerado(o.dicaParaOChefe, 800) : "",
        funplayb: funplaybDe(o.funplayb),
      });
    }
    // Sem dados pessoais no log: só as contagens.
    console.log("Adoração em Família:", JSON.stringify({ modelo: P.ia.modelo, membros: perfil.membros.length, assunto: Boolean(perfil.assunto), duracao: perfil.duracao, videos: videos.length, canticos: canticos ? canticos.length : 0, materias: materias.length, opcoes: opcoes.length, segundosIa: Math.round((Date.now() - inicio) / 100) / 10, entrada: resposta.usage?.input_tokens || 0, saida: resposta.usage?.output_tokens || 0 }));
    if (!opcoes.length) return erro(res, 502, "A IA não conseguiu preparar as opções. Tente de novo.");
    return res.status(200).json({ opcoes, duracao: perfil.duracao, assunto: perfil.assunto, modelo: nomeDoModelo(P.ia.modelo), data: new Date().toISOString() });
  } catch (e) {
    return tratarErro(e, res);
  }
}

async function responderParte(res, body, P, tarefa) {
  const cfg = PARTES_APOSTILA[tarefa];
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz });
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const sep = modoSeparacao(opcoes, ajuste);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";

  const dados = await parteDaSemana(res, body, cfg);
  if (!dados) return;
  if (!dados.itens.length) return erro(res, 404, cfg.semParte);
  // A instrução de cada parte ([Instrução]) entra como o primeiro item: a IA executa o que ela pede (ex.: o resumo do ponto da brochura);
  // na Nossa vida cristã vem depois o [Resumo do vídeo] e então as perguntas.
  const perguntas = perguntasDasConsideracoes(dados);

  let versiculos = [];
  const referencias = [...new Set(dados.itens.flatMap(cfg.referencias))];
  if (fontesConfiguradas() && referencias.length) {
    try {
      versiculos = await buscarVersiculos(referencias, 10);
    } catch (e) {
      console.error(cfg.nome + ": versículos indisponíveis", e?.message);
    }
  }
  const imagens = dados.itens.flatMap((i) => i.imagens).filter((img) => img.arquivo).map((img) => ({ type: "image", source: { type: "base64", media_type: img.arquivo.media, data: img.arquivo.data } }));

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    "\n\n" +
    cfg.texto(dados, versiculos) +
    (await blocoLivros(P, perguntas.map((p) => p.pergunta).join(" "))) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nRESPOSTAS ANTERIORES (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[modo === "nova" ? "Respostas: outra sugestão" : "Respostas: melhorar"];
  }

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 12000 /* o raciocínio também conta aqui */, system: cfg.sistema(P), messages: [{ role: "user", content: imagens.length ? [...imagens, { type: "text", text: mensagem }] : mensagem }] },
      { schema: SaidaEbc, tarefa }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu gerar as respostas desta parte.");
    }
    const permitidos = estilosDe(opcoes);
    const porId = new Map();
    for (const i of resposta.parsed_output.itens) {
      const id = limparLinha(String(i.pergunta).replace(/[[\]]/g, ""), 30);
      const pergunta = perguntas.find((p) => p.id.toLowerCase() === id.toLowerCase());
      if (!pergunta || porId.has(pergunta.id)) continue;
      const item = montarItem({ ...i, paragrafos: pergunta.id, referencias: [], textosRelevantes: i.textosRelevantes || [] }, opcoes, permitidos, P.limites, sep);
      if (!item.resposta) continue;
      porId.set(pergunta.id, item);
    }
    const itens = perguntas.map((p) => porId.get(p.id)).filter(Boolean);
    console.log(
      cfg.nome + ":",
      JSON.stringify({
        modelo: P.ia.modelo,
        semana: dados.semana,
        pedidas: perguntas.length,
        respondidas: itens.length,
        imagens: imagens.length,
        videos: dados.itens.filter((i) => i.video && i.video.texto).length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
      })
    );
    const memoriaUsada = memoriaUsadaAgora();
    const itensFinais = await finalizarItens(itens, opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    for (const i of itensFinais) {
      const pergunta = perguntas.find((p) => p.id === i.paragrafos);
      if (pergunta && pergunta.pid && dados.docId) i.jwl = { docid: dados.docId, par: pergunta.pid };
    }
    const semTextoDoVideo = dados.itens.some((i) => i.video && !i.video.texto);
    return res.status(200).json({
      titulo: dados.itens.map((i) => i.titulo).join(" · "),
      url: dados.url,
      perguntas: perguntas.map((p) => ({ id: p.id, pergunta: p.pergunta, instrucao: p.instrucao, resumoVideo: Boolean(p.resumoVideo) })),
      erro: itens.length ? null : "A IA não respondeu às perguntas. Tente de novo.",
      aviso: semTextoDoVideo ? "O jw.org não publicou o texto do vídeo: as respostas saíram só da matéria e da imagem." : null,
      itens: itensFinais,
      memoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Estudo Bíblico de Congregação: perguntas adicionais para o dirigente ----------
// A IA recebe o capítulo da semana (relato, "Leia o relato na Bíblia", trechos das publicações) e as perguntas ORIGINAIS dos
// quatro quadros, e elabora 5 perguntas adicionais com resposta (sem aplicações práticas) e/ou escolhe os textos-base (2 ou 3 trechos
// pequenos e significativos para ler), conforme o usuário marcou em "O que preparar" (uma, outra ou as duas). Só quem tem o código do dirigente.

const SaidaEbcDirigente = z.object({
  perguntas: z.array(z.object({ pergunta: z.string(), resposta: z.string() })),
  textosBase: z.array(z.object({ referencia: z.string(), ponto: z.string() })),
});

// Para comparar perguntas: sem acentos, sem pontuação e sem o que vem entre parênteses (as perguntas originais trazem a
// citação da publicação no fim, ex.: "(w09 1/12 17 § 4, nota)").
const normalizarPergunta = (t) =>
  String(t || "")
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Uma é cópia da outra (igual ou uma contida na outra, quando já têm um tamanho que indique a mesma pergunta).
const mesmaPergunta = (a, b) => Boolean(a && b && (a === b || (Math.min(a.length, b.length) >= 25 && (a.includes(b) || b.includes(a)))));

async function perguntasEbcDirigente(res, body, P) {
  if (!codigoDoDirigente()) return erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
  if (!dirigenteValido(body.codigoDirigente, body.aparelhoId)) return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const modo = body.modo === "nova" || body.modo === "melhorar" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(body.anteriores).slice(0, 12000) : "";
  // "O que preparar": as perguntas adicionais (ligadas, a não ser que venham desmarcadas) e/ou os textos-base; pelo menos uma.
  const perguntasPedidas = body.perguntas !== false;
  const textosBase = body.textosBase === true;
  if (!perguntasPedidas && !textosBase) return erro(res, 400, "Marque as perguntas adicionais ou os textos bíblicos para ler.");
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const capitulo = await capituloEbc(res, body, true);
  if (!capitulo) return;

  let fontesEbc = { citadasPedidas: 0, trechosOk: 0, falhas: 0 };
  try {
    fontesEbc = await garantirTrechosEbc(capitulo, capitulo.perguntas);
  } catch (e) {
    console.error("Estudo bíblico (dirigente): trechos das publicações", e?.message);
  }

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...capitulo.leia, ...capitulo.perguntas.flatMap((p) => p.referencias)], 12);
    } catch (e) {
      console.error("Estudo bíblico (dirigente): versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: ${perguntasPedidas ? "elabore até 5 perguntas adicionais com resposta" : "NÃO elabore perguntas adicionais (\"perguntas\" fica [])"}; resumo dos textos-base ${textosBase ? "ATIVO" : "INATIVO"}.\n\n` +
    textoDoCapituloEbcDirigente(capitulo, versiculos) +
    (await blocoLivros(P, textoDoCapituloEbcDirigente(capitulo, []))) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    const f = P.frases.pedidos;
    const pedidos = [];
    if (perguntasPedidas) pedidos.push(f[modo === "nova" ? "Estudo Bíblico do dirigente: outras perguntas" : "Estudo Bíblico do dirigente: melhorar"]);
    if (textosBase) pedidos.push(f[modo === "nova" ? "Estudo Bíblico do dirigente: outros textos-base" : "Estudo Bíblico do dirigente: melhorar textos-base"]);
    mensagem += `\n\n${perguntasPedidas ? "PERGUNTAS JÁ SUGERIDAS" : "TEXTOS-BASE JÁ SUGERIDOS"} (JSON):\n` + anteriores + "\n\n" + pedidos.join("\n");
  }

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaEbcDirigente, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaEbcDirigente, tarefa: "ebc-dirigente" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar as perguntas para este capítulo.");
    }

    // No máximo 5, só as que têm pergunta e resposta e que não são cópia de uma pergunta original do capítulo.
    const originais = capitulo.perguntas.map((p) => normalizarPergunta(p.pergunta));
    const vistas = [];
    const perguntas = [];
    for (const i of perguntasPedidas ? resposta.parsed_output.perguntas : []) {
      const pergunta = limparTextoGerado(i.pergunta, 400);
      const respostaTexto = limparTextoGerado(i.resposta, 900);
      const chave = normalizarPergunta(pergunta);
      if (!pergunta || !respostaTexto || originais.some((o) => mesmaPergunta(o, chave)) || vistas.some((v) => mesmaPergunta(v, chave))) continue;
      vistas.push(chave);
      perguntas.push({ pergunta, resposta: respostaTexto });
      if (perguntas.length === 5) break;
    }
    const base = textosBase
      ? resposta.parsed_output.textosBase
          .map((t) => ({ referencia: limparLinha(limparTrecho(t.referencia), 80), ponto: limparTextoGerado(t.ponto, 400) }))
          .filter((t) => t.referencia && t.ponto)
          .slice(0, 3)
      : [];

    console.log(
      "Estudo bíblico (dirigente):",
      JSON.stringify({
        modelo: P.ia.modelo,
        materia: capitulo.materia,
        perguntasPedidas,
        perguntas: perguntas.length,
        recebidas: resposta.parsed_output.perguntas.length,
        textosBasePedidos: textosBase,
        textosBase: base.length,
        originais: capitulo.perguntas.length,
        citadasPedidas: fontesEbc.citadasPedidas,
        trechosOk: fontesEbc.trechosOk,
        trechos: capitulo.trechos.length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    const aviso =
      fontesEbc.falhas > 0
        ? `Não consegui ler ${fontesEbc.falhas} publicação(ões) citada(s) nas perguntas; a preparação pode ficar menos precisa.`
        : null;
    return res.status(200).json({
      materia: capitulo.materia,
      titulo: [capitulo.contexto, capitulo.titulo].filter(Boolean).join(": "),
      url: capitulo.url,
      erro: perguntas.length || base.length ? null : perguntasPedidas ? "A IA não elaborou perguntas diferentes das originais. Tente de novo." : "A IA não escolheu trechos dos textos bíblicos. Tente de novo.",
      aviso,
      perguntas,
      textosBase: base,
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Tesouros da Palavra de Deus: esboço do discurso de 10 minutos ----------
// O servidor lê o discurso da semana na apostila (o tema, os pontos com os textos bíblicos, a pergunta de reflexão e os trechos
// das fontes citadas; api/_wol.mjs) e a IA elabora o esboço seguindo o prompt editável "tesouros". Só com o código do dirigente.

// Partes comuns aos esboços (Tesouros e discurso curto). Regras do usuário para TODOS os esboços: só entra o que o orador pode
// dizer à assistência (ou um lembrete do que ele precisa dizer ou fazer); a introdução e a conclusão têm subtítulo próprio e são
// escritas palavra por palavra; todo texto lido (LEIA) tem uma fala antes (que cria expectativa e liga a ideia anterior ao texto) e
// uma depois (que destaca as palavras-chave do texto), e a íntegra do texto vem da Bíblia no servidor (a IA só indica onde entra).
const falaDoEsboco = () => z.object({ texto: z.string(), lista: z.array(z.string()) });
const parteDoEsboco = () => z.object({ titulo: z.string(), minutos: z.number(), blocos: z.array(falaDoEsboco()) });
const pontoDoEsboco = () =>
  z.object({
    titulo: z.string(),
    minutos: z.number(),
    desenvolvimento: z.array(
      z.object({
        argumento: z.string(),
        ideias: z.array(z.string()),
        leitura: z.object({ referencia: z.string(), introducao: z.string(), destaque: z.string() }).nullable(),
      })
    ),
    // Aplicação e ilustração são opcionais: vazias/null quando a aplicação já está clara na matéria/tema/tópico.
    aplicacao: z.string().nullable(),
    ilustracao: z.string().nullable(),
    transicao: z.string(),
  });
const corpoDoEsboco = () => ({
  tema: z.string(),
  objetivo: z.string(),
  aplicacao: z.string(),
  introducao: parteDoEsboco(),
  pontos: z.array(pontoDoEsboco()),
  conclusao: parteDoEsboco(),
});

const SaidaTesouros = z.object(corpoDoEsboco());

// Rótulos que a IA às vezes escreve no começo de uma fala ("Tema: ...", "Primeiras frases: ..."): o esboço só leva o que o orador
// diz, então o rótulo cai e fica a frase.
const ROTULO_DE_TOPICO =
  /^(?:primeiras?\s+frases?|frases?\s+de\s+abertura|tema(?:\s+principal)?|objetivo|aplica[cç][aã]o(?:\s+pr[aá]tica)?|ilustra[cç][aã]o|transi[cç][aã]o|introdu[cç][aã]o|conclus[aã]o|recapitula[cç][aã]o)(?:\s*[:：]\s*|\s+[–—-]\s+)/iu;

function semRotuloDeTopico(texto) {
  const limpo = texto.replace(ROTULO_DE_TOPICO, "").trim();
  return limpo === texto ? texto : limpo.charAt(0).toLocaleUpperCase("pt-BR") + limpo.slice(1);
}

// Emoji que a IA põe no começo de uma fala para ilustrar o assunto (regra do usuário: os esboços levam emojis): fica, com no máximo
// 4 símbolos; o resto da fala segue as mesmas limpezas dos outros textos (a limpeza comum apagaria o emoji do começo).
const EMOJI_NO_COMECO = /^(?:\p{Extended_Pictographic}[️‍\p{Emoji_Modifier}]*\s*)+/u;

// Os emojis dos esboços são opcionais (a opção "Ilustrar com emoji" das configurações): com a opção desligada, o emoji do começo cai.
function limparFala(valor, max, comEmoji = true) {
  const bruto = typeof valor === "string" ? valor.replace(/[*`]+/g, "").replace(/\s+/g, " ").trim() : "";
  const m = bruto.match(EMOJI_NO_COMECO);
  const emoji = comEmoji && m && (m[0].match(/\p{Extended_Pictographic}/gu) || []).length <= 4 ? m[0].replace(/\s+/g, "") : "";
  const resto = semRotuloDeTopico(limparTextoGerado(m ? bruto.slice(m[0].length) : bruto, max));
  return emoji && resto ? emoji + " " + resto : resto;
}

// A frase do pedido que diz à IA se os emojis das falas do esboço estão ativos ou inativos (opção das configurações; texto editável
// em "Orientação do usuário, lembrete…").
function emojisDoEsboco(opcoes, P) {
  return P.frases.pedidos[opcoes.emoji ? "Esboço: emojis ativos" : "Esboço: emojis inativos"];
}

// Número ou marcador que a IA escreve por conta própria no começo de um item de lista (o app numera os itens).
const MARCA_DE_ITEM = /^\s*(?:\d{1,2}\s*[.)]|[•◦▪‣-])\s*/u;

// O texto exato de uma leitura, tirado da Bíblia (Tradução do Novo Mundo). Sem a Bíblia no servidor (ou se a referência não for
// achada), fica só a referência e o orador lê na própria Bíblia.
async function leituraDaBiblia(referencia) {
  if (fontesConfiguradas()) {
    try {
      const [achado] = await buscarVersiculos([referencia], 1, { numerado: true });
      if (achado) return { referencia: achado.referencia, texto: achado.texto, textoNumerado: achado.textoNumerado };
    } catch (e) {
      console.error("Esboço: versículo indisponível", e?.message);
    }
  }
  return { referencia, texto: null };
}

// Cada leitura da IA ganha o texto da Bíblia: { referencia, texto, introducao, destaque }. Um texto nunca é lido duas vezes e o
// total respeita o máximo (a leitura que sobra cai, o argumento fica).
async function conferirLeituras(pontos, max = Infinity, permitidas = null, proibidas = null) {
  const lidas = new Set();
  let total = 0;
  for (const ponto of pontos) {
    for (const d of ponto.desenvolvimento) {
      if (!d.leitura) continue;
      if (total >= max) {
        d.leitura = null;
        continue;
      }
      const achada = await leituraDaBiblia(d.leitura.referencia);
      // No discurso público só se lê o que o esboço do S-34 marca com [Leia ...].
      if (permitidas && !permitidas.has(achada.referencia)) {
        d.leitura = null;
        continue;
      }
      // Os textos que o orador tirou da lista nunca ficam no esboço.
      if (proibidas && proibidas.size && proibidas.has(chaveDeBusca(achada.referencia).replace(/\s+/g, ""))) {
        d.leitura = null;
        continue;
      }
      if (lidas.has(achada.referencia)) {
        d.leitura = null;
        continue;
      }
      lidas.add(achada.referencia);
      total++;
      d.leitura = { ...d.leitura, ...achada };
    }
  }
}

// Regra do usuário: NENHUMA resposta da IA (estudo, joias, comentários, esboços…) usa as fontes gótica (fraktur) e script, comuns ou em
// negrito. Se a IA escrever com essas letras do Unicode, elas viram letras comuns (as outras fontes não mudam). As letras que ficam fora dos
// blocos principais (ℭ ℌ ℑ ℜ ℨ da gótica; ℬ ℰ ℱ ℋ ℐ ℒ ℳ ℛ ℯ ℊ ℴ do script) também. As letras duplas (ℂ ℍ ℕ ℙ ℚ ℝ ℤ) não entram.
const GOTICAS_FORA_DO_BLOCO = {
  "ℭ": "C", "ℌ": "H", "ℑ": "I", "ℜ": "R", "ℨ": "Z",
  "ℬ": "B", "ℰ": "E", "ℱ": "F", "ℋ": "H", "ℐ": "I", "ℒ": "L", "ℳ": "M", "ℛ": "R", "ℯ": "e", "ℊ": "g", "ℴ": "o",
};
// Cada bloco tem 26 letras: [primeira letra do bloco, letra comum correspondente].
const BLOCOS_GOTICA_E_SCRIPT = [
  [0x1d49c, 65], [0x1d4b6, 97], // script
  [0x1d4d0, 65], [0x1d4ea, 97], // script negrito
  [0x1d504, 65], [0x1d51e, 97], // gótica
  [0x1d56c, 65], [0x1d586, 97], // gótica negrito
];
function semGotica(texto) {
  if (typeof texto !== "string") return "";
  return Array.from(texto, (ch) => {
    if (GOTICAS_FORA_DO_BLOCO[ch]) return GOTICAS_FORA_DO_BLOCO[ch];
    const cp = ch.codePointAt(0);
    if (cp < 0x1d49c || cp > 0x1d59f) return ch;
    for (const [inicio, base] of BLOCOS_GOTICA_E_SCRIPT) {
      if (cp >= inicio && cp < inicio + 26) return String.fromCharCode(base + cp - inicio);
    }
    return ch;
  }).join("");
}
function semGoticaTudo(valor) {
  if (typeof valor === "string") return semGotica(valor);
  if (Array.isArray(valor)) return valor.map(semGoticaTudo);
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, semGoticaTudo(v)]));
  return valor;
}

// A parte do esboço que os dois discursos têm em comum, limpa e dentro dos limites (tema, objetivo, introdução e conclusão com
// subtítulo e falas, pontos com argumentos, leituras, aplicação, ilustração e transição). Devolve também os avisos (regras do
// usuário que a IA não cumpriu e que o servidor não conserta sozinho).
async function corpoDoEsbocoLimpo(saidaBruta, o) {
  const saida = semGoticaTudo(saidaBruta);
  const frase = (texto, tamanho) => limparFala(texto, tamanho, o.emoji);
  const ideias = (lista, max, tamanho) => (Array.isArray(lista) ? lista : []).map((x) => frase(x, tamanho)).filter(Boolean).slice(0, max);
  const minutos = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(o.minutosMax, Math.round(n))) : 0);
  const pontos = (Array.isArray(saida.pontos) ? saida.pontos : [])
    .slice(0, o.maxPontos)
    .map((p, i) => ({
      titulo: limparTextoGerado(p.titulo, 160),
      minutos: minutos(p.minutos),
      fontes: o.fontesDoPonto(i),
      desenvolvimento: (Array.isArray(p.desenvolvimento) ? p.desenvolvimento : [])
        .map((d) => {
          const l = d.leitura && typeof d.leitura === "object" ? d.leitura : null;
          const referencia = l ? limparLinha(limparTrecho(l.referencia), 80) : "";
          return {
            argumento: frase(d.argumento, 300),
            ideias: ideias(d.ideias, 4, 300),
            leitura: referencia ? { referencia, introducao: frase(l.introducao, 400), destaque: frase(l.destaque, 500) } : null,
          };
        })
        .filter((d) => d.argumento)
        .slice(0, o.maxArgumentos),
      aplicacao: limparTextoGerado(p.aplicacao, 400) || null,
      ilustracao: limparTextoGerado(p.ilustracao, 400) || null,
      // A transição, como a aplicação e a ilustração, já tem o emoji da própria linha no app.
      transicao: semRotuloDeTopico(limparTextoGerado(p.transicao, 300)) || null,
    }))
    .filter((p) => p.titulo);
  const proibidas = new Set((o.leiturasProibidas || []).map((r) => chaveDeBusca(r).replace(/\s+/g, "")));
  await conferirLeituras(pontos, o.maxLeituras, o.leiturasPermitidas ? new Set(o.leiturasPermitidas) : null, proibidas);

  const tema = limparTextoGerado(saida.tema, 200) || o.temaPadrao;
  // Introdução e conclusão são escritas palavra por palavra: falas curtas e, em cada uma, os itens de uma enumeração (que o app numera).
  // Sem subtítulo da IA, usam o tema (nunca as palavras "Introdução" e "Conclusão").
  const parte = (p, maxBlocos) => ({
    titulo: limparTextoGerado(p && p.titulo, 160) || tema,
    minutos: minutos(p && p.minutos),
    blocos: (Array.isArray(p && p.blocos) ? p.blocos : [])
      .map((b) => ({
        texto: frase(b && b.texto, 600),
        lista: (Array.isArray(b && b.lista) ? b.lista : []).map((x) => limparFala(typeof x === "string" ? x.replace(MARCA_DE_ITEM, "") : "", 250, o.emoji)).filter(Boolean).slice(0, 6),
      }))
      .filter((b) => b.texto)
      .slice(0, maxBlocos),
  });

  const avisos = [];
  const leituras = pontos.flatMap((p) => p.desenvolvimento.map((d) => d.leitura).filter(Boolean));
  if (o.minLeituras && leituras.length < o.minLeituras) {
    avisos.push(`A IA indicou só ${leituras.length} texto(s) para leitura (o padrão são ${o.minLeituras} ou mais). Use "Melhorar" para pedir mais.`);
  }
  if (o.leituraEmCadaPonto && pontos.some((p) => !p.desenvolvimento.some((d) => d.leitura))) {
    avisos.push('Há ponto sem texto para leitura. Use "Melhorar" para pedir um texto em cada ponto.');
  }
  if (o.leiturasObrigatorias && o.leiturasObrigatorias.length) {
    const lidas = new Set(leituras.map((l) => l.referencia));
    const faltam = [...new Set(o.leiturasObrigatorias)].filter((r) => !lidas.has(r) && !proibidas.has(chaveDeBusca(r).replace(/\s+/g, "")));
    if (faltam.length) avisos.push(`Faltou a leitura de ${faltam.join("; ")}${o.motivoObrigatorias ? ", " + o.motivoObrigatorias : ""}. Use "Melhorar" ou "Incluir texto(s)" para incluí-la.`);
  }
  if (leituras.some((l) => !l.introducao || !l.destaque)) {
    avisos.push('Algum texto ficou sem a fala antes da leitura ou sem o comentário depois dela. Use "Melhorar" para corrigir.');
  }
  return {
    esboco: {
      tema,
      objetivo: limparTextoGerado(saida.objetivo, 300),
      aplicacao: limparTextoGerado(saida.aplicacao, 300),
      introducao: parte(saida.introducao, o.maxBlocosIntro),
      pontos,
      conclusao: parte(saida.conclusao, o.maxBlocosConclusao),
    },
    avisos,
  };
}

// O esboço anterior volta para a IA (em "outra versão" e "melhorar") sem o texto dos versículos: a leitura vai só com a referência
// e as falas de antes e de depois.
function anteriorParaIa(anteriores) {
  const e = anteriores && anteriores.esboco;
  if (!e || !Array.isArray(e.pontos)) return anteriores;
  const leitura = (l) => (l && typeof l === "object" ? { referencia: l.referencia || "", introducao: l.introducao || "", destaque: l.destaque || "" } : null);
  return {
    ...anteriores,
    esboco: {
      ...e,
      pontos: e.pontos.map((p) => ({
        ...p,
        desenvolvimento: (Array.isArray(p && p.desenvolvimento) ? p.desenvolvimento : []).map((d) => ({ ...d, leitura: leitura(d && d.leitura) })),
      })),
    },
  };
}

// ---------- Textos bíblicos da matéria dos esboços ----------
// A tela mostra, em cada esboço, todos os textos bíblicos da matéria (a apostila e as fontes, ou o esboço do S-34), com o texto exato
// da Bíblia e a marca dos que a matéria manda ler ("Leia"). O orador marca os que quer ler além dos previstos e o app os manda de
// volta em "textosExtras", já na primeira elaboração ou depois, no pedido "incluir".

// A lista da tela (textosDaMateria): { referencia, texto, leia }, com os marcados com "Leia" primeiro (a ordem da matéria se mantém dentro de cada grupo).
async function textosDaMateria({ todos, leia }) {
  const itens = new Map(); // referência como a Bíblia escreve -> item
  try {
    for (const bruta of [...new Set([...(todos || []), ...(leia || [])])].slice(0, 80)) {
      const achada = await leituraDaBiblia(bruta);
      // Com a Bíblia no servidor, o que ela não acha (por exemplo, um capítulo inteiro, "Je 48") não entra: a IA não teria o texto.
      if (fontesConfiguradas() && !achada.texto) continue;
      if (!itens.has(achada.referencia)) itens.set(achada.referencia, { referencia: achada.referencia, texto: achada.texto, leia: false });
    }
    for (const bruta of leia || []) {
      const item = itens.get((await leituraDaBiblia(bruta)).referencia);
      if (item) item.leia = true;
    }
  } catch (e) {
    console.error("Textos bíblicos da matéria: lista incompleta", e?.message);
  }
  return [...itens.values()].sort((a, b) => Number(b.leia) - Number(a.leia));
}

// As referências, como a Bíblia as escreve, de uma lista de referências da matéria (para conferir se o esboço as lê).
async function referenciasDaBiblia(brutas) {
  if (!fontesConfiguradas()) return [];
  const vistas = new Set();
  for (const bruta of brutas || []) vistas.add((await leituraDaBiblia(bruta)).referencia);
  return [...vistas];
}

// Os textos que o orador escolheu ler além dos previstos: [{ referencia, texto }], conferidos na Bíblia, sem repetir (até 15).
async function textosExtrasDoPedido(body) {
  const brutos = (Array.isArray(body.textosExtras) ? body.textosExtras : []).filter((t) => typeof t === "string").map((t) => limparLinha(t, 80)).filter(Boolean).slice(0, 15);
  const vistos = new Set();
  const extras = [];
  for (const bruto of brutos) {
    const achado = await leituraDaBiblia(bruto);
    if (fontesConfiguradas() && !achado.texto) continue; // a Bíblia não achou: a IA não teria o texto exato
    if (vistos.has(achado.referencia)) continue;
    vistos.add(achado.referencia);
    extras.push(achado);
  }
  return extras;
}

// Os textos que o orador TIROU da lista (inclusive os marcados com "Leia" na matéria): "textosSem" do pedido, como a Bíblia os escreve.
async function textosTiradosDoPedido(body) {
  const brutos = (Array.isArray(body.textosSem) ? body.textosSem : []).filter((t) => typeof t === "string").map((t) => limparLinha(t, 80)).filter(Boolean).slice(0, 40);
  const tirados = new Set();
  for (const bruto of brutos) tirados.add((await leituraDaBiblia(bruto)).referencia);
  return tirados;
}

// As imagens da seção da apostila (descrição e legenda do site) e a orientação de citá-las no esboço, se ele ainda não o faz.
function blocoDeImagensDoEsboco(imagens, P) {
  const lista = (Array.isArray(imagens) ? imagens : []).filter((i) => i && (i.descricao || i.legenda));
  if (!lista.length) return "";
  const linhas = lista.map((i, n) => `Imagem ${n + 1}${i.item ? ` (${i.item})` : ""}: ${[i.descricao && `descrição: ${i.descricao}`, i.legenda && `legenda: ${i.legenda}`].filter(Boolean).join(" | ")}`);
  return "\n\nIMAGENS DA SEÇÃO DA APOSTILA (descrição e legenda do site):\n" + linhas.join("\n") + "\n\n" + P.frases.pedidos["Esboço: imagens da apostila"];
}

function blocoDeTextosTirados(tirados, P) {
  if (!tirados.size) return "";
  return "\n\n" + trocar(P.frases.pedidos["Esboço: textos tirados pelo orador"], { textos: [...tirados].join("; ") });
}

// Os trechos do pedido (frases editáveis em "Orientação do usuário, lembrete…"): os textos marcados com "Leia" na matéria e os que o
// orador escolheu, cada bloco com o texto exato dos versículos.
function blocoDeTextosMarcados(leiaDaMateria, P) {
  if (!leiaDaMateria.length) return "";
  return "\n\n" + trocar(P.frases.pedidos["Esboço: textos marcados na matéria"], { textos: leiaDaMateria.join("; ") });
}

function blocoDeTextosEscolhidos(extras, P) {
  if (!extras.length) return "";
  const versiculos = extras.filter((e) => e.texto).map((e) => `${e.referencia}: ${e.texto}`);
  return (
    "\n\n" +
    trocar(P.frases.pedidos["Esboço: textos escolhidos"], { textos: extras.map((e) => e.referencia).join("; ") }) +
    (versiculos.length ? "\nTEXTO DOS VERSÍCULOS ESCOLHIDOS:\n" + versiculos.join("\n") : "")
  );
}

// "Outra versão", "Melhorar" ou "Incluir texto(s)": o pedido que vai depois do esboço já sugerido.
function pedidoDoModo(modo, P) {
  return P.frases.pedidos[modo === "nova" ? "Esboço: outra versão" : modo === "incluir" ? "Esboço: incluir textos" : "Esboço: melhorar"];
}

// As leituras que o esboço anterior já tinha (para o pedido "incluir" não perder nenhuma).
function leiturasDoEsbocoAnterior(anteriores) {
  const pontos = anteriores && anteriores.esboco && Array.isArray(anteriores.esboco.pontos) ? anteriores.esboco.pontos : [];
  return pontos
    .flatMap((p) => (Array.isArray(p && p.desenvolvimento) ? p.desenvolvimento : []))
    .map((d) => d && d.leitura && d.leitura.referencia)
    .filter((r) => typeof r === "string" && r);
}

// Lê o discurso de Tesouros da semana pedida; devolve o discurso ou responde com o erro (e devolve null).
async function discursoDaSemana(res, body) {
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let discurso = null;
  try {
    discurso = await lerTesouros(url);
  } catch (e) {
    console.error("Tesouros: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler o discurso de Tesouros da Palavra de Deus no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!discurso) erro(res, 404, "Não encontrei o discurso de Tesouros da Palavra de Deus na apostila dessa semana.");
  return discurso;
}

// O que o app mostra ao carregar: o tema, os pontos (com os textos bíblicos e a fonte de cada um) e a pergunta de reflexão.
async function lerTesourosDaSemana(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const discurso = await discursoDaSemana(res, body);
  if (!discurso) return;
  return res.status(200).json({
    semana: discurso.semana,
    titulo: discurso.titulo,
    minutos: discurso.minutos,
    url: discurso.url,
    pontos: discurso.pontos.map((p) => ({ texto: p.texto, textos: p.referencias, fontes: p.citacoes.map((c) => c.citacao), fontesLidas: p.fontes.length })),
    reflexao: discurso.reflexao ? discurso.reflexao.texto : null,
    imagens: discurso.imagens || [],
    textosBiblicos: await textosDaMateria(textosBiblicosDeTesouros(discurso)),
  });
}

async function esbocoDeTesouros(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const discurso = await discursoDaSemana(res, body);
  if (!discurso) return;

  // Os textos marcados com "Leia" nas fontes da matéria e os que o orador escolheu ler além dos previstos.
  const materia = textosBiblicosDeTesouros(discurso);
  const extras = await textosExtrasDoPedido(body);
  const tirados = await textosTiradosDoPedido(body);
  const leiaDaMateria = (await referenciasDaBiblia(materia.leia)).filter((r) => !tirados.has(r));

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...materia.leia, ...referenciasDeTesouros(discurso)], 16);
    } catch (e) {
      console.error("Tesouros: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso de ${discurso.minutos} minutos de Tesouros da Palavra de Deus desta semana.\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDosTesouros(discurso, versiculos) +
    blocoDeImagensDoEsboco(discurso.imagens, P) +
    blocoDeTextosMarcados(leiaDaMateria, P) +
    blocoDeTextosEscolhidos(extras, P) +
    blocoDeTextosTirados(tirados, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: TEMPO_ESBOCO_MS });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: tetoTokensEsboco() /* no Gemini o raciocínio consome maxOutputTokens; 40000 dá folga para pensar e devolver o JSON completo */, system: P.sistemaTesouros, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaTesouros, tarefa: "tesouros" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    // Texto limpo e dentro dos limites; a fonte de cada ponto vem da apostila (não da IA). O padrão do usuário é ler pelo menos dois
    // textos do discurso: se a IA indicar menos, o app avisa.
    const { esboco, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: discurso.titulo,
      minutosMax: 10,
      maxPontos: 5,
      maxArgumentos: 5,
      maxBlocosIntro: 5,
      maxBlocosConclusao: 5,
      fontesDoPonto: (i) => (discurso.pontos[i] ? discurso.pontos[i].citacoes.map((c) => c.citacao) : []),
      minLeituras: 2,
      // Nenhuma leitura pode faltar: as marcadas com Leia na matéria, as que o orador escolheu e, ao incluir textos, as que o esboço já tinha.
      leiturasObrigatorias: [...leiaDaMateria, ...extras.map((e) => e.referencia), ...(modo === "incluir" ? leiturasDoEsbocoAnterior(body.anteriores) : [])],
      motivoObrigatorias: "que a matéria marca com Leia, que você escolheu ou que o esboço já tinha",
      leiturasProibidas: [...tirados],
    });
    const pontos = esboco.pontos;
    const completo = pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;

    console.log(
      "Esboço de Tesouros:",
      JSON.stringify({
        modelo: P.ia.modelo,
        semana: discurso.semana,
        tema: discurso.titulo,
        pontosDaApostila: discurso.pontos.length,
        pontos: pontos.length,
        fontesLidas: discurso.pontos.reduce((n, p) => n + p.fontes.length, 0) + (discurso.reflexao ? discurso.reflexao.fontes.length : 0),
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      semana: discurso.semana,
      titulo: discurso.titulo,
      url: discurso.url,
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      textosBiblicos: await textosDaMateria(materia),
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Faça seu melhor no ministério: esboço do discurso curto (4 a 5 minutos) ----------
// Só as semanas com um item "Discurso" nessa seção. O servidor lê o item (tema, tempo, fonte e lição do th) e, quando a fonte só
// traz o tema e alguns textos, pesquisa o tema no wol.jw.org (api/_wol.mjs); a IA elabora o esboço seguindo o prompt editável
// "discurso_curto". Só com o código do dirigente.

const SaidaDiscursoCurto = z.object({
  ...corpoDoEsboco(),
  fontes: z.array(z.string()),
  licao: z.object({ aplicada: z.boolean(), dica: z.string().nullable() }),
});

// Lê o discurso curto da semana pedida; devolve o discurso ou responde com o erro (e devolve null).
async function discursoCurtoDaSemana(res, body) {
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let discurso = null;
  try {
    discurso = await lerDiscursoCurto(url);
  } catch (e) {
    console.error("Discurso curto: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler a apostila no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!discurso) erro(res, 404, "Esta semana não tem discurso na seção Faça seu melhor no ministério da apostila (algumas semanas só têm conversas e demonstrações).");
  return discurso;
}

// O que o app mostra ao carregar: o tema, o tempo, a fonte, a lição do th e os textos indicados.
async function lerDiscursoCurtoDaSemana(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const discurso = await discursoCurtoDaSemana(res, body);
  if (!discurso) return;
  return res.status(200).json({
    semana: discurso.semana,
    titulo: discurso.titulo,
    minutos: discurso.minutos,
    url: discurso.url,
    fonte: discurso.fonteCitada,
    tipoFonte: discurso.fonte ? discurso.fonte.tipo : null,
    licao: discurso.licaoCitada ? { citacao: discurso.licaoCitada, titulo: discurso.licao ? discurso.licao.titulo : "" } : null,
    textos: discurso.referencias,
    pesquisa: discurso.pesquisa.length,
    imagens: discurso.imagens || [],
    textosBiblicos: await textosDaMateria(textosBiblicosDoDiscursoCurto(discurso)),
  });
}

async function esbocoDoDiscursoCurto(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const discurso = await discursoCurtoDaSemana(res, body);
  if (!discurso) return;

  // Os textos marcados com "Leia" na matéria e os que o orador escolheu ler além dos previstos.
  const materia = textosBiblicosDoDiscursoCurto(discurso);
  const extras = await textosExtrasDoPedido(body);
  const tirados = await textosTiradosDoPedido(body);
  const leiaDaMateria = (await referenciasDaBiblia(materia.leia)).filter((r) => !tirados.has(r));

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...materia.leia, ...referenciasDoDiscursoCurto(discurso)], 14);
    } catch (e) {
      console.error("Discurso curto: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso de ${discurso.minutos} minutos de Faça seu melhor no ministério desta semana.\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDoDiscursoCurto(discurso, versiculos) +
    blocoDeTextosMarcados(leiaDaMateria, P) +
    blocoDeTextosEscolhidos(extras, P) +
    blocoDeTextosTirados(tirados, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: TEMPO_ESBOCO_MS });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: tetoTokensEsboco() /* no Gemini o raciocínio consome maxOutputTokens; 40000 dá folga para pensar e devolver o JSON completo */, system: P.sistemaDiscursoCurto, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaDiscursoCurto, tarefa: "discurso" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    // O orador LÊ todos os textos indicados, no máximo 3 no discurso inteiro (a leitura que passar disso cai) e cada ponto deve ter
    // ao menos uma leitura (se faltar, o app avisa).
    const saida = resposta.parsed_output;
    const { esboco: corpo, avisos } = await corpoDoEsbocoLimpo(saida, {
      emoji: opcoes.emoji,
      temaPadrao: discurso.titulo,
      minutosMax: discurso.minutos,
      maxPontos: 2,
      maxArgumentos: 4,
      maxBlocosIntro: 4,
      maxBlocosConclusao: 4,
      fontesDoPonto: () => [],
      // O orador lê todos os textos indicados (até 3) e os marcados com Leia na matéria; os que ele escolher entram além disso.
      maxLeituras: Math.max(3, leiaDaMateria.length) + extras.length + (modo === "incluir" ? leiturasDoEsbocoAnterior(body.anteriores).length : 0),
      leituraEmCadaPonto: true,
      leiturasObrigatorias: [...leiaDaMateria, ...extras.map((e) => e.referencia), ...(modo === "incluir" ? leiturasDoEsbocoAnterior(body.anteriores) : [])],
      motivoObrigatorias: "que a matéria marca com Leia, que você escolheu ou que o esboço já tinha",
      leiturasProibidas: [...tirados],
    });
    const pontos = corpo.pontos;

    // Só entram em "fontes" a fonte da apostila e as publicações que vieram da pesquisa no wol.jw.org (nada de fora do wol).
    const norma = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const permitidas = [discurso.fonteCitada, ...discurso.pesquisa.map((r) => r.rotulo)].filter(Boolean);
    const usadas = (Array.isArray(saida.fontes) ? saida.fontes : [])
      .map((f) => permitidas.find((permitida) => norma(f).length >= 3 && (norma(permitida) === norma(f) || norma(permitida).includes(norma(f)) || norma(f).includes(norma(permitida)))))
      .filter(Boolean);
    const fontes = [...new Set([...(discurso.fonteCitada ? [discurso.fonteCitada] : []), ...usadas])];

    const dica = saida.licao && saida.licao.aplicada ? limparTextoGerado(saida.licao.dica, 300) : "";
    const esboco = {
      ...corpo,
      fontes,
      licao: dica && discurso.licaoCitada ? { citacao: discurso.licaoCitada, titulo: discurso.licao ? discurso.licao.titulo : "", dica } : null,
    };
    const completo = pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;

    console.log(
      "Esboço do discurso curto:",
      JSON.stringify({
        modelo: P.ia.modelo,
        semana: discurso.semana,
        tema: discurso.titulo,
        minutos: discurso.minutos,
        fonte: discurso.fonteCitada,
        pesquisa: discurso.pesquisa.length,
        licao: discurso.licaoCitada,
        licaoAplicada: Boolean(esboco.licao),
        pontos: pontos.length,
        leituras: pontos.reduce((n, p) => n + p.desenvolvimento.filter((d) => d.leitura).length, 0),
        fontesUsadas: usadas.length,
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      semana: discurso.semana,
      titulo: discurso.titulo,
      url: discurso.url,
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      textosBiblicos: await textosDaMateria(materia),
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Discurso público (S-34, 30 min) ----------
// O esboço oficial do S-34 do tema escolhido foi importado pelo administrador (api/_s34.mjs, Blob privado). O servidor o manda à IA
// com o texto exato dos versículos; a IA elabora o esboço seguindo o prompt editável "discurso_publico". Só com o código do dirigente.

const SaidaDiscursoPublico = z.object(corpoDoEsboco());

// O esboço do S-34 do tema pedido ou a resposta de erro (e null).
async function esbocoDoTema(res, body) {
  const numero = Number(body.numero);
  if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
    erro(res, 400, "Escolha um tema.");
    return null;
  }
  if (!s34Configurado()) {
    erro(res, 503, "Os esboços do S-34 ainda não foram configurados no servidor.");
    return null;
  }
  let esboco = null;
  try {
    esboco = await lerEsboco(numero);
  } catch (e) {
    console.error("Discurso público: leitura do esboço falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler o esboço agora. Tente de novo em instantes.");
    return null;
  }
  if (!esboco) erro(res, 404, "Esse tema ainda não foi importado (Ajustes → Esboços de discursos públicos).");
  return esboco;
}

// Os temas já importados, para a pessoa escolher.
async function listarTemasPublicos(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  if (!s34Configurado()) return erro(res, 503, "Os esboços do S-34 ainda não foram configurados no servidor.");
  const { temas } = await lerIndice();
  return res.status(200).json({
    temas: Object.entries(temas)
      .map(([numero, t]) => ({ numero: Number(numero), titulo: t.titulo, revisao: t.revisao || "", minutos: t.minutos || 0 }))
      .sort((a, b) => a.numero - b.numero),
  });
}

// O que o app mostra ao carregar o tema: título, revisão, seções com os tempos e as leituras marcadas.
async function lerTemaPublico(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const esboco = await esbocoDoTema(res, body);
  if (!esboco) return;
  const { leituras } = referenciasDoPublico(esboco);
  return res.status(200).json({
    numero: esboco.numero,
    titulo: esboco.titulo,
    revisao: esboco.revisao || "",
    minutos: minutosDoEsboco(esboco),
    objetivo: esboco.notaAoOrador.slice(0, 240),
    secoes: esboco.secoes.map((s) => ({ titulo: s.titulo, minutos: s.minutos })),
    leituras,
    itens: esboco.secoes.reduce((n, s) => n + s.itens.length, 0),
    textosBiblicos: await textosDaMateria(textosBiblicosDoPublico(esboco)),
  });
}

// O esboço original do S-34 do tema (títulos, tempos, itens em níveis, destaques e notas), para o orador LER no próprio app ("Ver o esboço
// original" do card Discurso público). Sem IA; só com o código do dirigente; vem do armazenamento privado, não fica guardado no aparelho.
async function verEsbocoPublico(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const esboco = await esbocoDoTema(res, body);
  if (!esboco) return;
  return res.status(200).json({ esboco });
}

async function esbocoDoDiscursoPublico(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  // Esboço importado (preparado pelo orador): no Melhorar a revisão mantém o dele e o ajusta ao S-34; as leituras dele valem como obrigatórias.
  const importado = Boolean(body.importado) && Boolean(modo);
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, importado ? 24000 : 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const tema = await esbocoDoTema(res, body);
  if (!tema) return;
  const { leituras: marcadas, citadas } = referenciasDoPublico(tema);
  const extras = await textosExtrasDoPedido(body); // os textos que o orador escolheu ler além dos marcados no S-34
  const tirados = await textosTiradosDoPedido(body); // os que ele tirou da lista (mesmo marcados no S-34)

  let versiculos = [];
  let permitidas = null; // as leituras marcadas, como a Bíblia as escreve (sem a Bíblia no servidor não dá para conferir)
  let aceitas = null;    // o que o servidor mantém: as de cima e, se o esboço marca poucas, os textos citados que a IA escolher
  // Os esboços mais antigos do S-34 (como o do tema 110, de 1995) citam os textos mas não marcam nenhum com "Leia": sem leituras o discurso sairia
  // sem nenhum texto lido. Quando as marcadas e as escolhidas pelo orador não chegam ao mínimo (limite "Textos lidos no discurso público"),
  // a IA escolhe as que faltam entre os textos citados no esboço.
  const minimoLeituras = P.limites.minLeiturasPublico || 0;
  const faltamLeituras = Math.max(0, minimoLeituras - new Set([...marcadas, ...extras.map((e) => e.referencia)]).size);
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...marcadas, ...citadas], 40);
      permitidas = [];
      for (const r of marcadas) permitidas.push((await leituraDaBiblia(r)).referencia);
      permitidas = permitidas.filter((r) => !tirados.has(r));
      // Além dos marcados no S-34, só se lê o que o orador escolheu.
      permitidas = [...new Set([...permitidas, ...extras.map((e) => e.referencia)])];
      aceitas = permitidas;
      if (faltamLeituras > 0) {
        const candidatas = [];
        for (const r of citadas) candidatas.push((await leituraDaBiblia(r)).referencia);
        aceitas = [...new Set([...permitidas, ...candidatas])];
      }
    } catch (e) {
      console.error("Discurso público: versículos indisponíveis", e?.message);
      permitidas = null;
      aceitas = null;
    }
  }
  if (importado && fontesConfiguradas()) {
    try {
      // As do orador (as do esboço importado), mais as que ele escolheu na lista, menos as que tirou; o S-34 vale como referência.
      const doOrador = [];
      for (const r of [...leiturasDoEsbocoAnterior(body.anteriores), ...extras.map((e) => e.referencia)]) doOrador.push((await leituraDaBiblia(r)).referencia);
      permitidas = [...new Set(doOrador)].filter((r) => !tirados.has(r));
      aceitas = null;
    } catch (e) {
      permitidas = null;
      aceitas = null;
    }
  }
  const aEscolher = faltamLeituras > 0 && !importado
    ? `LEITURAS A ESCOLHER: o esboço do S-34 marca ${marcadas.length} texto(s) para ler${extras.length ? ` e o orador escolheu ${extras.length}` : ""}, e o discurso precisa ter pelo menos ${minimoLeituras} leituras. ` +
      `Escolha você mais ${faltamLeituras} (ou mais, se ajudar) dentre os textos CITADOS no esboço, cujo versículo vem em "TEXTO DOS VERSÍCULOS": os que mais reforçam cada ponto, de preferência curtos e espalhados pelos pontos, ` +
      `cada um no campo "leitura" do argumento a que se liga e uma só vez. Não leia nenhum texto que o esboço não cite. Não entregue o esboço com menos de ${minimoLeituras} leituras.\n\n`
    : "";

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço do discurso público de ${minutosDoEsboco(tema)} minutos, tema "${tema.titulo}" (esboço S-34 nº ${tema.numero}).\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDoDiscursoPublico(tema, versiculos) +
    (aEscolher ? "\n\n" + aEscolher.trimEnd() + "\n\n" : "") +
    blocoDeTextosEscolhidos(extras, P) +
    blocoDeTextosTirados(tirados, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    const pedido = importado && modo === "melhorar" ? P.frases.pedidos["Esboço importado: melhorar"] || pedidoDoModo(modo, P) : pedidoDoModo(modo, P);
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedido;
  }
  // As gravuras que o orador escolheu para o tema vão como imagens anexas, antes do texto.
  const gravuras = gravurasDoPedido(body.gravuras);
  if (gravuras.length) mensagem += "\n\n" + String(P.frases.pedidos["Esboço: gravuras do orador"] || "").replace(/\{\{n\}\}/g, String(gravuras.length));
  const conteudo = gravuras.length ? [...gravuras, { type: "text", text: mensagem }] : mensagem;

  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: TEMPO_ESBOCO_MS });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: tetoTokensEsboco() /* no Gemini o raciocínio consome maxOutputTokens; 40000 dá folga para pensar e devolver o JSON completo */, system: P.sistemaDiscursoPublico, messages: [{ role: "user", content: conteudo }] },
      { schema: SaidaDiscursoPublico, tarefa: "publico" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    const { esboco, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: tema.titulo,
      minutosMax: 30,
      maxPontos: tema.secoes.length,
      maxArgumentos: 8,
      maxBlocosIntro: 4,
      maxBlocosConclusao: 4,
      // A linha "Fonte" de cada ponto traz as publicações que o esboço do S-34 cita naquela seção.
      fontesDoPonto: (i) => publicacoesDaSecao(tema.secoes[i]),
      leiturasPermitidas: aceitas,
      leiturasObrigatorias: permitidas,
      minLeituras: importado ? undefined : minimoLeituras || undefined,
      motivoObrigatorias: importado ? "que o seu esboço lia ou que você escolheu" : "que o esboço do S-34 marca ou que você escolheu",
      leiturasProibidas: [...tirados],
    });
    // Os tempos são os do esboço do S-34 (um ponto por seção); a introdução e a conclusão cabem dentro deles.
    esboco.pontos.forEach((p, i) => {
      if (tema.secoes[i]) p.minutos = tema.secoes[i].minutos || 0;
    });
    esboco.introducao.minutos = 0;
    esboco.conclusao.minutos = 0;
    if (esboco.pontos.length !== tema.secoes.length) avisos.push(`A IA fez ${esboco.pontos.length} ponto(s) e o esboço do S-34 tem ${tema.secoes.length} seções. Use "Melhorar" para ajustar.`);
    const completo = esboco.pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;

    console.log(
      "Esboço do discurso público:",
      JSON.stringify({
        modelo: P.ia.modelo,
        tema: tema.numero,
        revisao: tema.revisao || null,
        secoes: tema.secoes.length,
        pontos: esboco.pontos.length,
        leiturasMarcadas: marcadas.length,
        leiturasAEscolher: faltamLeituras,
        leituras: esboco.pontos.reduce((n, p) => n + p.desenvolvimento.filter((d) => d.leitura).length, 0),
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      semana: "Discurso público " + tema.numero,
      titulo: tema.titulo,
      url: null,
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      textosBiblicos: await textosDaMateria(textosBiblicosDoPublico(tema)),
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// Gravuras do orador (discurso público): até 7 imagens JPEG/PNG/WebP em base64, já reduzidas no aparelho (cerca de 1024 px).
const MAX_GRAVURAS = 7;
const MAX_BYTES_GRAVURA = 700_000; // tamanho do base64 de cada uma
function gravurasDoPedido(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((g) => g && typeof g.data === "string" && /^image\/(jpeg|png|webp)$/.test(g.media) && g.data.length <= MAX_BYTES_GRAVURA && /^[A-Za-z0-9+/=]+$/.test(g.data.slice(0, 200)))
    .slice(0, MAX_GRAVURAS)
    .map((g) => ({ type: "image", source: { type: "base64", media_type: g.media, data: g.data } }));
}

// ---------- Discurso público: sugerir o cântico inicial ----------
// A lista dos 151 cânticos, com as letras, fica no Blob privado (fontes/canticos.json). A IA lê o tema, as seções do S-34 e, se houver, os pontos
// do esboço que está no campo, e sugere de 3 a 5 cânticos cuja letra combina com o discurso, com o motivo e um trecho da letra.
const SaidaCanticos = z.object({
  sugestoes: z.array(z.object({ numero: z.number(), motivo: z.string(), trecho: z.string() })),
});
async function canticosDoPublico(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const tema = await esbocoDoTema(res, body);
  if (!tema) return;
  const canticos = await lerCanticos();
  if (!canticos || !canticos.length) return erro(res, 503, "A lista dos cânticos ainda não está no servidor.");
  const porNumero = new Map(canticos.map((c) => [c.numero, c]));
  const esboco = body.esboco && typeof body.esboco === "object" ? body.esboco : null;
  const pontos = esboco && Array.isArray(esboco.pontos)
    ? esboco.pontos.slice(0, 12).map((p, i) => `${i + 1}. ${limparLinha(String((p && p.titulo) || ""), 200)}`).filter((l) => l.length > 3)
    : [];
  const mensagem =
    `PEDIDO: sugira de 3 a 5 cânticos para o começo da reunião do discurso público "${tema.titulo}" (esboço S-34 nº ${tema.numero}).\n\n` +
    "TEMA E SEÇÕES DO ESBOÇO DO S-34:\n" +
    `Tema: ${tema.titulo}\n` +
    (tema.notaAoOrador ? `Objetivo: ${limparLinha(tema.notaAoOrador, 600)}\n` : "") +
    tema.secoes.map((s, i) => `Seção ${i + 1}: ${s.titulo}`).join("\n") +
    (pontos.length ? "\n\nPONTOS DO ESBOÇO PREPARADO:\n" + pontos.join("\n") : "") +
    "\n\nCÂNTICOS DISPONÍVEIS:\n" +
    canticos.map((c) => `### ${c.numero}. ${c.titulo} (${c.texto}) [${c.assunto}]\n${c.letra}`).join("\n\n");
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(client, P, { max_tokens: 6000, system: P.sistemaCanticos, messages: [{ role: "user", content: mensagem }] }, { schema: SaidaCanticos, tarefa: "publico-canticos" });
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return erro(res, 502, "A IA não conseguiu sugerir os cânticos. Tente de novo.");
    const vistos = new Set();
    const sugestoes = resposta.parsed_output.sugestoes
      .map((s) => ({ ...s, numero: Math.round(Number(s.numero)) }))
      .filter((s) => porNumero.has(s.numero) && !vistos.has(s.numero) && vistos.add(s.numero))
      .slice(0, 5)
      .map((s) => ({ numero: s.numero, titulo: porNumero.get(s.numero).titulo, texto: porNumero.get(s.numero).texto, motivo: limparTextoGerado(s.motivo, 500), trecho: limparTextoGerado(s.trecho, 300) }));
    if (sugestoes.length < 3) return erro(res, 502, "A IA sugeriu poucos cânticos. Tente de novo.");
    return res.status(200).json({ tema: tema.numero, sugestoes, memoriaUsada: memoriaUsadaAgora() });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Discurso público: importar um esboço que o orador já preparou ----------
// O app lê o arquivo (Word ou PDF) no aparelho e manda o texto com as marcas da formatação (negrito, grifo, sublinhado, cor, recuos); a IA o passa
// para o formato dos esboços do app, sem reescrever, e marca como leitura os textos que o orador escolheu ler. O esboço do S-34 do tema vai junto,
// como referência para a divisão em pontos. Nada fica guardado no servidor: o esboço convertido volta para o app, que o liga ao tema.
const MAX_TEXTO_IMPORTADO = 40000;
async function esbocoImportadoDoPublico(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const opcoes = validarOpcoes(body.opcoes);
  const texto = textoLongo(body.texto, MAX_TEXTO_IMPORTADO);
  if (texto.length < 150) return erro(res, 400, "O arquivo tem pouco texto para ser um esboço. Confira se escolheu o arquivo certo.");
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  const tema = await esbocoDoTema(res, body);
  if (!tema) return;
  let doArquivo = [];
  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      doArquivo = await referenciasNoTexto(texto.replace(/\[\/?(?:grifo|sublinhado|cor)\]|\*\*/g, ""), { max: 60 });
      versiculos = await buscarVersiculos(doArquivo, 40);
    } catch (e) {
      console.error("Esboço importado: versículos indisponíveis", e?.message);
    }
  }

  const mensagem =
    `PEDIDO: passe para o formato o esboço que o orador preparou para o discurso público de ${minutosDoEsboco(tema)} minutos, tema "${tema.titulo}" (esboço S-34 nº ${tema.numero}). ` +
    "Mantenha o conteúdo dele e marque como leitura os textos que ele escolheu ler.\n" +
    emojisDoEsboco(opcoes, P) +
    "\n\nESBOÇO DO S-34 (só referência para a divisão em pontos e os tempos):\n" +
    textoDoDiscursoPublico(tema, []) +
    "\n\nESBOÇO PREPARADO PELO ORADOR (texto do arquivo, com as marcas da formatação):\n" +
    texto +
    (versiculos.length ? "\n\nTEXTO DOS VERSÍCULOS CITADOS NO ARQUIVO:\n" + versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n") : "");

  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: TEMPO_ESBOCO_MS });
    const inicio = Date.now();
    // Passar para o formato não pede raciocínio longo: com ele o Gemini 4 Carbon chegou a 16 mil tokens e 231 s (perto dos tetos), e às vezes
    // passava do limite de saída e a resposta vinha cortada. Pensa pouco (semPensar) e, no Gemini, o teto de saída é maior (a API direta
    // da Anthropic não aceita mais de 21 mil sem streaming).
    const teto = tetoTokensEsboco();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: teto, system: P.sistemaPublicoImportado, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaDiscursoPublico, tarefa: "publico-importar", semPensar: true }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      console.error("Esboço público importado: sem resposta", JSON.stringify({ modelo: P.ia.modelo, tema: tema.numero, caracteres: texto.length, parada: resposta.stop_reason, saida: resposta.usage?.output_tokens || 0, segundos: Math.round((Date.now() - inicio) / 100) / 10 }));
      return erro(res, 502, resposta.stop_reason === "max_tokens"
        ? "O esboço é longo e a IA não terminou de passá-lo para o formato. Tente de novo; se continuar, escolha um modelo mais rápido para os esboços em Modelos e agentes de IA."
        : "A IA não conseguiu ler este esboço. Tente de novo.");
    }
    const mesmasSecoes = Array.isArray(resposta.parsed_output.pontos) && resposta.parsed_output.pontos.length === tema.secoes.length;
    const { esboco, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: tema.titulo,
      minutosMax: 60,
      maxPontos: 12,
      maxArgumentos: 12,
      maxBlocosIntro: 6,
      maxBlocosConclusao: 6,
      fontesDoPonto: (i) => (mesmasSecoes ? publicacoesDaSecao(tema.secoes[i]) : []),
      leiturasPermitidas: null, // o orador escolheu: vale o que ele marcou no arquivo
      leiturasObrigatorias: null,
    });
    // Sem tempos no arquivo, valem os do S-34 (quando os pontos batem com as seções).
    esboco.pontos.forEach((p, i) => {
      if (!p.minutos && mesmasSecoes && tema.secoes[i]) p.minutos = tema.secoes[i].minutos || 0;
    });
    const completo = esboco.pontos.length > 0;
    const leituras = esboco.pontos.flatMap((p) => p.desenvolvimento.map((d) => d.leitura && d.leitura.referencia).filter(Boolean));

    console.log(
      "Esboço público importado:",
      JSON.stringify({
        modelo: P.ia.modelo,
        tema: tema.numero,
        caracteres: texto.length,
        pontos: esboco.pontos.length,
        secoes: tema.secoes.length,
        leituras: leituras.length,
        citadosNoArquivo: doArquivo.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
      })
    );

    return res.status(200).json({
      semana: "Discurso público " + tema.numero,
      titulo: tema.titulo,
      url: null,
      importado: true,
      erro: completo ? null : "A IA não encontrou os pontos do esboço neste arquivo. Confira o arquivo e tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      // Os textos do esboço importado: os citados no arquivo e, com LEIA, os que a IA reconheceu como leitura.
      textosBiblicos: await textosDaMateria({ todos: [...doArquivo, ...leituras], leia: leituras }),
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Outros esboços (tema livre: necessidades locais, eventos especiais) ----------
// O orador informa o tema, a ideia, o tempo e, se quiser, os textos que quer ler e a matéria: um texto colado e/ou artigos do wol.jw.org
// (os endereços colados ou os que ele escolheu na pesquisa do tema na biblioteca). Nada fica no servidor: tudo vem no pedido.
// Três tarefas: outros-pesquisar (a pesquisa na biblioteca), outros-ler (lê a matéria e lista os textos bíblicos) e outros (o esboço).

const SaidaOutros = z.object(corpoDoEsboco());
const MAX_ARTIGOS_OUTROS = 5;
const MAX_CARACTERES_ARTIGO_OUTROS = 8000;
const MAX_MATERIA_OUTROS = 12000;

// Texto de várias linhas (a ideia, a matéria): quebras de linha preservadas, sem excesso de linhas em branco.
function textoLongo(valor, max) {
  return typeof valor === "string"
    ? valor.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max)
    : "";
}

// Os endereços do wol.jw.org do pedido (uma lista, ou um texto com um endereço por linha), sem repetir.
function enderecosDoOutros(valor) {
  const brutos = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(/\s+/) : [];
  return [...new Set(brutos.filter((x) => typeof x === "string").map((x) => limparLinha(x, 300)).filter(Boolean))].slice(0, MAX_ARTIGOS_OUTROS);
}

// O esboço pronto que o orador importou no aparelho (no molde do S-34), conferido e reescrito só com os campos conhecidos.
function esbocoBaseDoPedido(bruto) {
  if (!bruto || typeof bruto !== "object") return { esboco: null };
  const v = validarEsboco({ ...bruto, numero: 1 });
  return v.erro ? { erro: v.erro } : { esboco: v.esboco };
}

// O que o orador digitou no card, já limpo. Com esboço pronto importado, o tema (se vier em branco) é o dele e o tempo é a soma das seções.
function dadosDoOutros(body) {
  const minutos = Math.round(Number(body.minutos));
  const base = esbocoBaseDoPedido(body.esbocoBase);
  const doBase = base.esboco ? minutosDoEsboco(base.esboco) : 0;
  return {
    tema: limparLinha(body.tema, 200) || (base.esboco ? limparLinha(base.esboco.titulo, 200) : ""),
    ideia: textoLongo(body.ideia, 1500),
    ocasiao: limparLinha(body.ocasiao, 120),
    minutos: doBase >= 3 ? Math.min(60, doBase) : Number.isFinite(minutos) ? Math.max(3, Math.min(60, minutos)) : 30,
    textosLer: limparLinha(body.textosLer, 600),
    materia: textoLongo(body.materia, MAX_MATERIA_OUTROS),
    artigos: enderecosDoOutros(body.artigos),
    esbocoBase: base.esboco,
    erroBase: base.erro || "",
  };
}

// As leituras marcadas [Leia …] do esboço importado (como a Bíblia as escreve) e os textos que ele cita.
// Além das marcas e das citações entre parênteses (referenciasDoPublico), varre o corpo inteiro do esboço: esboços
// especiais / locais costumam trazer dezenas de textos no texto dos itens, sem "[Leia …]" nem parênteses.
async function referenciasDaBase(d) {
  if (!d.esbocoBase) return { marcadas: [], citadas: [] };
  const { leituras, citadas } = referenciasDoPublico(d.esbocoBase);
  const marcadas = fontesConfiguradas() ? [...new Set(await Promise.all(leituras.map(async (r) => (await leituraDaBiblia(r)).referencia)))] : leituras;
  const noCorpo = await referenciasNoTexto(textoDoEsbocoImportado(d.esbocoBase), { max: 60, livre: true });
  const marcadasSet = new Set(marcadas);
  const citadasSet = new Set(citadas.filter((r) => !marcadasSet.has(r)));
  for (const r of noCorpo) {
    if (!marcadasSet.has(r)) citadasSet.add(r);
  }
  return { marcadas, citadas: [...citadasSet] };
}

// Lê os artigos do wol.jw.org: { artigos: [{ titulo, url, texto, referencias }], falhas: [endereço que não deu para ler] }.
async function artigosDoOutros(d) {
  const lidos = await Promise.all(
    d.artigos.map(async (endereco) => {
      try {
        const artigo = await lerArtigoDoWol(endereco, { timeoutMs: 8000, maxCaracteres: MAX_CARACTERES_ARTIGO_OUTROS });
        return artigo ? { endereco, artigo } : { endereco, artigo: null };
      } catch (e) {
        console.error("Outros esboços: artigo não lido", e?.message);
        return { endereco, artigo: null };
      }
    })
  );
  return { artigos: lidos.filter((l) => l.artigo).map((l) => l.artigo), falhas: lidos.filter((l) => !l.artigo).map((l) => l.endereco) };
}

// Os textos que o orador pediu para ler (o campo "Textos bíblicos que quer ler"), como a Bíblia os escreve.
async function textosPedidosDoOutros(d) {
  if (!d.textosLer) return [];
  if (!fontesConfiguradas()) return d.textosLer.split(/\s*[;\n]\s*/).filter(Boolean).slice(0, 15);
  return referenciasNoTexto(d.textosLer, { max: 15, livre: true });
}

// Quantos pontos o discurso comporta, conforme o tempo.
function pontosDoOutros(minutos) {
  return minutos <= 8 ? 2 : minutos <= 15 ? 3 : minutos <= 25 ? 4 : minutos <= 45 ? 6 : 7;
}

// Os minutos das partes (introdução, pontos e conclusão) passam a somar o tempo do discurso: proporcionais ao que a IA indicou
// (ou, sem indicação, 1 min na introdução e na conclusão e o resto igual entre os pontos), com arredondamento que fecha a soma.
// Nenhuma parte fica sem tempo quando o total comporta (a IA às vezes deixa um ponto em 0).
function acertarMinutos(esboco, total) {
  const partes = [esboco.introducao, ...esboco.pontos, esboco.conclusao];
  const soma = partes.reduce((n, p) => n + (p.minutos || 0), 0);
  if (soma === total) return;
  const pesos = soma > 0
    ? partes.map((p) => (total >= partes.length ? Math.max(1, p.minutos || 0) : p.minutos || 0))
    : partes.map((_, i) => (i === 0 || i === partes.length - 1 ? 1 : Math.max(1, (total - 2) / Math.max(1, esboco.pontos.length))));
  const somaPesos = pesos.reduce((n, p) => n + p, 0);
  const exatos = pesos.map((p) => (p * total) / somaPesos);
  const minutos = exatos.map(Math.floor);
  let sobra = total - minutos.reduce((n, m) => n + m, 0);
  exatos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => b.resto - a.resto)
    .forEach(({ i }) => {
      if (sobra-- > 0) minutos[i]++;
    });
  partes.forEach((p, i) => {
    p.minutos = minutos[i];
  });
}

// O resumo do que o servidor leu (o mesmo em "outros-ler" e depois da elaboração do esboço), para a tela.
async function resumoDoOutros(d, { artigos, falhas, pedidos, daBase }) {
  // livre:true reconhece abreviações e maiúsculas/minúsculas variadas na matéria colada.
  const naMateria = await referenciasNoTexto(d.materia, { max: 60, livre: true });
  const base = d.esbocoBase ? { titulo: d.esbocoBase.titulo, minutos: minutosDoEsboco(d.esbocoBase), secoes: d.esbocoBase.secoes.length, leituras: daBase.marcadas } : null;
  return {
    semana: "",
    titulo: d.tema || "Matéria do discurso",
    url: null,
    minutos: d.minutos,
    artigos: artigos.map((a) => ({ titulo: a.titulo, url: a.url, caracteres: a.texto.length })),
    falhas,
    pedidos,
    avisoTextos: d.textosLer && !pedidos.length ? `Não reconheci nenhum texto bíblico em "${d.textosLer}". Escreva como "Mateus 6:33; Salmo 37:10, 11".` : "",
    materia: d.materia.length,
    base,
    // A lista passa de 80 textos com facilidade (um artigo traz dezenas): os pedidos, os do esboço importado e os da matéria colada vêm antes,
    // para não ficarem de fora. Os marcados "Leia" do esboço importado entram sozinhos no esboço, como os pedidos.
    textosBiblicos: await textosDaMateria({
      todos: [...pedidos, ...daBase.marcadas, ...daBase.citadas, ...naMateria, ...artigos.flatMap((a) => a.referencias)],
      leia: [...pedidos, ...daBase.marcadas],
    }),
  };
}

// A pesquisa do tema na biblioteca online (wol.jw.org): os resultados vão para a tela e o orador escolhe os que a IA vai ler.
async function pesquisarOutros(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  // O campo de pesquisa, se tiver texto; senão, o tema e a ideia do discurso.
  const digitada = limparLinha(body.consulta, 200);
  const consulta = digitada || limparLinha([limparLinha(body.tema, 100), limparLinha(body.ideia, 100)].filter(Boolean).join(" "), 200);
  if (consulta.length < 8) return erro(res, 400, "Escreva o tema e a ideia do discurso (ou as palavras da pesquisa) com pelo menos 8 letras.");
  try {
    // O que o orador digitou vai como está (ele escolheu as palavras). A wol só acha o que tem todas as palavras na mesma frase: se não achar
    // nada (ou se a consulta veio do tema e da ideia, que são frases longas), pesquisa com poucas palavras-chave deles.
    let resultados = digitada ? await pesquisarNoWol(digitada, 9000, 8) : [];
    let usada = digitada;
    if (!resultados.length) {
      const porPalavras = await pesquisarPorPalavras(digitada ? [digitada] : [limparLinha(body.tema, 200), limparLinha(body.ideia, 200)], { timeoutMs: 9000, maximo: 8, minimo: 3 });
      resultados = porPalavras.resultados;
      usada = porPalavras.consulta || consulta;
    }
    return res.status(200).json({ consulta: usada, resultados });
  } catch (e) {
    console.error("Outros esboços: pesquisa no wol falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui pesquisar na biblioteca agora. Tente de novo em instantes.");
  }
}

// Lê a matéria (os artigos do wol.jw.org e os textos bíblicos) e devolve o resumo com a lista de textos para marcar.
async function lerOutros(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const d = dadosDoOutros(body);
  if (d.erroBase) return erro(res, 400, "O esboço importado não serve: " + d.erroBase);
  if (!d.materia && !d.artigos.length && !d.textosLer && !d.esbocoBase) return erro(res, 400, "Informe a matéria (um texto colado, artigos do wol.jw.org ou um esboço importado) ou os textos bíblicos que quer ler.");
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });
  const [{ artigos, falhas }, pedidos, daBase] = await Promise.all([artigosDoOutros(d), textosPedidosDoOutros(d), referenciasDaBase(d)]);
  return res.status(200).json(await resumoDoOutros(d, { artigos, falhas, pedidos, daBase }));
}

// A mensagem dos dados do orador (a ordem e os rótulos estão na descrição da montagem, em _prompts.mjs). "pedidos" são todos os textos que a
// IA lê: os que o orador pediu e os marcados "Leia" do esboço importado.
function textoDoOutros(d, { pedidos, sugeridas, artigos, automaticas = { artigos: [], origem: "" }, versiculos }) {
  const partes = [`TEMA DO DISCURSO: ${d.tema}`, `IDEIA DO DISCURSO: ${d.ideia || "o orador não informou; use o tema."}`];
  if (d.ocasiao) partes.push(`OCASIÃO: ${d.ocasiao}`);
  partes.push(`TEMPO TOTAL: ${d.minutos} minutos`);
  partes.push(
    "TEXTOS QUE O ORADOR PEDIU PARA LER: " +
      (pedidos.length ? pedidos.join("; ") + "." : sugeridas ? `nenhum; escolha você até ${sugeridas} textos que reforcem os pontos.` : "nenhum além dos escolhidos pelo orador (indicados abaixo).")
  );
  if (d.esbocoBase) partes.push(textoDoEsbocoImportado(d.esbocoBase));
  if (d.materia) partes.push("MATÉRIA COLADA PELO ORADOR:\n" + d.materia);
  if (artigos.length) {
    partes.push("ARTIGOS DO WOL.JW.ORG LIDOS PELO SERVIDOR:\n" + artigos.map((a, i) => `[${i + 1}] ${a.titulo || "(sem título)"}\n${a.texto}`).join("\n\n"));
  }
  // As matérias que o servidor foi buscar sozinho na wol (ver api/_materiasWol.mjs).
  if (automaticas.artigos.length) {
    const rotulo = automaticas.origem === "citacoes"
      ? "MATÉRIAS COMPLEMENTARES DA WOL.JW.ORG (o servidor as consultou porque o esboço pronto cita publicações; use-as para enriquecer os itens e os argumentos da seção correspondente, sem mudar a estrutura do esboço):"
      : "MATÉRIAS DA WOL.JW.ORG PESQUISADAS PELO SERVIDOR (por tema e ideia, porque o orador não trouxe esboço pronto nem artigos; use-as como base dos argumentos e das ideias):";
    partes.push(rotulo + "\n" + automaticas.artigos.map((a, i) => `[${i + 1}] ${a.titulo || "(sem título)"}\n${a.texto}`).join("\n\n"));
  }
  if (versiculos.length) partes.push("TEXTO DOS VERSÍCULOS:\n" + versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n"));
  return partes.join("\n\n");
}

async function esbocoDeOutros(res, body, P) {
  if (!acessoDoDirigente(res, body)) return;
  const d = dadosDoOutros(body);
  if (d.erroBase) return erro(res, 400, "O esboço importado não serve: " + d.erroBase);
  if (d.tema.length < 4) return erro(res, 400, "Escreva o tema do discurso.");
  const opcoes = validarOpcoes(body.opcoes);
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  const modo = body.modo === "nova" || body.modo === "melhorar" || body.modo === "incluir" ? body.modo : null;
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(anteriorParaIa(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();
  if (fontesConfiguradas()) precarregarFontes({ biblia: true, perspicaz: false });

  // Pesquisa obrigatória na wol: sem esboço da organização nem artigos do orador, pelo tema e pela ideia; com esboço que cita publicações, por elas.
  const buscaAutomatica = materiasAutomaticas(d).then(async (auto) => ({ auto, lidas: (await artigosDoOutros({ artigos: auto.enderecos })).artigos }));
  const [{ artigos: artigosDoOrador, falhas }, pedidos, extras, daBase, { auto, lidas: artigosAuto }] = await Promise.all([artigosDoOutros(d), textosPedidosDoOutros(d), textosExtrasDoPedido(body), referenciasDaBase(d), buscaAutomatica]);
  const artigos = [...artigosDoOrador, ...artigosAuto]; // para os versículos, as fontes e o resumo da tela
  const naMateria = await referenciasNoTexto(d.materia, { max: 60, livre: true });
  const tirados = await textosTiradosDoPedido(body); // os textos que o orador tirou da lista (mesmo os marcados "Leia" do esboço importado)
  const doEsbocoAnterior = modo ? leiturasDoEsbocoAnterior(body.anteriores) : [];
  const base = d.esbocoBase;

  // Os textos lidos: os que o orador pediu, os marcados "Leia" do esboço importado e os que ele marcou na lista; sem nenhum deles, a IA
  // escolhe poucos (conforme o tempo).
  const aLer = [...new Set([...pedidos, ...daBase.marcadas])];
  const escolhidos = [...new Set([...aLer, ...extras.map((e) => e.referencia), ...doEsbocoAnterior])];
  const sugeridas = aLer.length + extras.length ? 0 : Math.max(2, Math.min(8, Math.round(d.minutos / 6)));
  const maxLeituras = sugeridas ? Math.max(escolhidos.length, sugeridas) : escolhidos.length;

  let versiculos = [];
  if (fontesConfiguradas()) {
    try {
      versiculos = await buscarVersiculos([...aLer, ...extras.map((e) => e.referencia), ...daBase.citadas, ...naMateria, ...artigos.flatMap((a) => a.referencias)], base ? 40 : 30);
    } catch (e) {
      console.error("Outros esboços: versículos indisponíveis", e?.message);
    }
  }

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    `PEDIDO: elabore o esboço de um discurso de ${d.minutos} minutos, tema "${d.tema}"${base ? ", seguindo de perto o esboço pronto importado pelo orador" : ""}.\n` +
    emojisDoEsboco(opcoes, P) + "\n\n" +
    textoDoOutros(d, { pedidos: aLer, sugeridas, artigos: artigosDoOrador, automaticas: { artigos: artigosAuto, origem: auto.origem }, versiculos }) +
    blocoDeTextosEscolhidos(extras, P) +
    blocoDeTextosTirados(tirados, P) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    mensagem += "\n\nESBOÇO JÁ SUGERIDO (JSON):\n" + anteriores + "\n\n" + pedidoDoModo(modo, P);
  }

  try {
    const client = criarClienteIa({ maxRetries: 0, timeout: TEMPO_ESBOCO_MS });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: tetoTokensEsboco() /* no Gemini o raciocínio consome maxOutputTokens; 40000 dá folga para pensar e devolver o JSON completo */, system: P.sistemaOutros, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaOutros, tarefa: "outros" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu elaborar o esboço deste discurso.");
    }

    const { esboco: corpo, avisos } = await corpoDoEsbocoLimpo(resposta.parsed_output, {
      emoji: opcoes.emoji,
      temaPadrao: d.tema,
      minutosMax: d.minutos,
      // Com esboço importado, um ponto por seção dele (como no discurso público), com a linha "Fonte" das publicações que a seção cita.
      maxPontos: base ? base.secoes.length : pontosDoOutros(d.minutos),
      maxArgumentos: base ? 8 : 5,
      maxBlocosIntro: 4,
      maxBlocosConclusao: 4,
      fontesDoPonto: base ? (i) => publicacoesDaSecao(base.secoes[i]) : () => [],
      maxLeituras,
      // Havendo textos pedidos, marcados "Leia" ou escolhidos, só se lê o que o orador indicou (e o que o esboço anterior já lia).
      leiturasPermitidas: sugeridas || !fontesConfiguradas() ? null : escolhidos,
      leiturasObrigatorias: [...aLer, ...extras.map((e) => e.referencia), ...(modo === "incluir" ? doEsbocoAnterior : [])],
      motivoObrigatorias: "que você pediu, que o esboço importado marca, que você escolheu ou que o esboço já tinha",
      leiturasProibidas: [...tirados],
    });
    // O tema é o que o orador digitou (ou o do esboço importado); as fontes são o esboço importado e os artigos do wol.jw.org que o servidor leu.
    const esboco = { ...corpo, tema: d.tema, fontes: [...(base ? ["Esboço importado: " + base.titulo] : []), ...artigos.map((a) => a.titulo).filter(Boolean)] };
    if (base) {
      // Os tempos são os das seções do esboço importado; a introdução e a conclusão cabem dentro deles.
      esboco.pontos.forEach((p, i) => {
        if (base.secoes[i]) p.minutos = base.secoes[i].minutos || 0;
      });
      esboco.introducao.minutos = 0;
      esboco.conclusao.minutos = 0;
      if (esboco.pontos.length !== base.secoes.length) avisos.push(`A IA fez ${esboco.pontos.length} ponto(s) e o esboço importado tem ${base.secoes.length} seções. Use "Melhorar" para ajustar.`);
    } else {
      acertarMinutos(esboco, d.minutos);
    }
    const completo = esboco.pontos.length > 0 && esboco.introducao.blocos.length > 0 && esboco.conclusao.blocos.length > 0;
    if (falhas.length) avisos.push(`Não consegui ler ${falhas.length === 1 ? "um artigo" : falhas.length + " artigos"} do wol.jw.org; o esboço não os usa.`);
    // O que o servidor pesquisou sozinho na wol (sem esboço nem artigos, ou por causa das publicações que o esboço cita).
    if (auto.origem && !artigosAuto.length && auto.enderecos.length) avisos.push("Achei matérias na wol.jw.org, mas não consegui lê-las agora: o esboço não as usa.");
    else avisos.push(...auto.avisos);

    console.log(
      "Esboço de outro discurso:",
      JSON.stringify({
        modelo: P.ia.modelo,
        minutos: d.minutos,
        materia: d.materia.length,
        artigos: artigosDoOrador.length,
        artigosAuto: { origem: auto.origem || null, lidas: artigosAuto.length },
        falhas: falhas.length,
        pedidos: pedidos.length,
        esbocoImportado: base ? { secoes: base.secoes.length, marcadas: daBase.marcadas.length } : null,
        extras: extras.length,
        sugeridas,
        pontos: esboco.pontos.length,
        leituras: esboco.pontos.reduce((n, p) => n + p.desenvolvimento.filter((x) => x.leitura).length, 0),
        versiculos: versiculos.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        total: Math.round((Date.now() - inicioPedido) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    return res.status(200).json({
      ...(await resumoDoOutros(d, { artigos, falhas, pedidos, daBase })),
      erro: completo ? null : "A IA não montou o esboço completo (introdução, pontos e conclusão). Tente de novo.",
      esboco: completo ? esboco : null,
      avisos: completo ? avisos : [],
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// O texto exato (Tradução do Novo Mundo) de uma lista de textos bíblicos, para o app exportar um esboço para Word com os acentos certos
// (as letras em itálico do campo de texto não têm acento). Só com o código do dirigente; sem IA, sem custo.
async function textosDosVersiculos(res, body) {
  if (!acessoDoDirigente(res, body)) return;
  const referencias = (Array.isArray(body.referencias) ? body.referencias : [])
    .filter((r) => typeof r === "string")
    .map((r) => limparLinha(r, 80))
    .filter(Boolean)
    .slice(0, 40);
  if (!referencias.length || !fontesConfiguradas()) return res.status(200).json({ versiculos: [] });
  try {
    return res.status(200).json({ versiculos: await buscarVersiculos(referencias, 40) });
  } catch (e) {
    console.error("Versículos para exportar: falhou", e?.message);
    return erro(res, 502, "Não consegui buscar os versículos agora.");
  }
}

// Anotações: mesmos versículos, com o código de resumo (barra bíblica da tela Anotações).
async function textosDosVersiculosAnotacoes(res, body) {
  const referencias = (Array.isArray(body.referencias) ? body.referencias : [])
    .filter((r) => typeof r === "string")
    .map((r) => limparLinha(r, 80))
    .filter(Boolean)
    .slice(0, 12);
  if (!referencias.length) return erro(res, 400, "Informe a referência bíblica.");
  if (!fontesConfiguradas()) return erro(res, 503, "A leitura da Bíblia ainda não está configurada no servidor.");
  try {
    return res.status(200).json({ versiculos: await buscarVersiculos(referencias, 12, { numerado: true }) });
  } catch (e) {
    console.error("Versículos (anotações): falhou", e?.message);
    return erro(res, 502, "Não consegui buscar o texto bíblico agora.");
  }
}

// Anotações: deixa o texto pronto para colar no JW Library (só emojis e maiúsculas, mantendo os negritos e itálicos que a pessoa já fez).
const SaidaAnotacoesFormatadas = z.object({ texto: z.string() });
async function formatarAnotacoes(res, body, P) {
  const bruto = typeof body.texto === "string" ? body.texto.replace(/\r\n/g, "\n").trim() : "";
  if (!bruto) return erro(res, 400, "Escreva as anotações antes de formatar.");
  if (bruto.length > 12000) return erro(res, 413, "O texto está grande demais para formatar de uma vez (limite de 12.000 caracteres). Formate por partes.");
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 12000, system: P.sistemaAnotacoesFormatar, messages: [{ role: "user", content: `ANOTAÇÕES:\n${bruto}` }] },
      { schema: SaidaAnotacoesFormatadas, semPensar: true, tarefa: "anotacoes-formatar" }
    );
    const texto = resposta.parsed_output && typeof resposta.parsed_output.texto === "string" ? semCulto(resposta.parsed_output.texto).trim() : "";
    if (resposta.stop_reason === "refusal" || !texto) return erro(res, 502, "A IA não conseguiu formatar este texto. Tente de novo.");
    return res.status(200).json({ texto });
  } catch (e) {
    console.error("Formatar anotações: falhou", e?.name, e?.message);
    return tratarErro(e, res);
  }
}

// Anotações (assembleia de circuito): quando o número de perguntas de recapitulação não bate com o de discursos, a IA organiza qual pergunta
// vai em cada parte do programa. O servidor confere o que ela devolve (índices válidos, sem repetir parte nem pergunta).
const SaidaPerguntasAtribuidas = z.object({ atribuicoes: z.array(z.object({ pergunta: z.number(), parte: z.number().nullable() })) });
async function atribuirPerguntas(res, body, P) {
  const partes = (Array.isArray(body.partes) ? body.partes : [])
    .map((p) => ({ i: Number(p && p.i), tema: limparLinha((p && p.tema) || "", 300), textoTematico: limparLinha((p && p.textoTematico) || "", 200), secao: limparLinha((p && p.secao) || "", 80) }))
    .filter((p) => Number.isInteger(p.i) && p.i >= 0 && p.tema)
    .slice(0, 80);
  const perguntas = (Array.isArray(body.perguntas) ? body.perguntas : [])
    .map((q) => ({ n: Number(q && q.n), texto: limparLinha((q && q.texto) || "", 400), refs: limparLinha((q && q.refs) || "", 200) }))
    .filter((q) => Number.isInteger(q.n) && q.n > 0 && q.texto)
    .slice(0, 30);
  if (!partes.length || !perguntas.length) return erro(res, 400, "Faltam as partes do programa ou as perguntas.");
  const lista = partes.map((p) => `[${p.i}] ${p.secao ? p.secao + " · " : ""}${p.tema}${p.textoTematico ? " — " + p.textoTematico : ""}`).join("\n");
  const quadro = perguntas.map((q) => `${q.n}. ${q.texto}${q.refs ? " (" + q.refs + ")" : ""}`).join("\n");
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 60_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 2000, system: P.sistemaAnotacoesPerguntas, messages: [{ role: "user", content: `PARTES DO PROGRAMA:\n${lista}\n\nPERGUNTAS DE RECAPITULAÇÃO:\n${quadro}` }] },
      { schema: SaidaPerguntasAtribuidas, semPensar: true, tarefa: "anotacoes-perguntas" }
    );
    const bruto = resposta.parsed_output && Array.isArray(resposta.parsed_output.atribuicoes) ? resposta.parsed_output.atribuicoes : [];
    if (resposta.stop_reason === "refusal" || !bruto.length) return erro(res, 502, "A IA não conseguiu organizar as perguntas. Tente de novo.");
    const indicesValidos = new Set(partes.map((p) => p.i));
    const numerosValidos = new Set(perguntas.map((q) => q.n));
    const partesUsadas = new Set();
    const perguntasUsadas = new Set();
    const atribuicoes = [];
    for (const a of bruto) {
      if (a.parte == null || !indicesValidos.has(a.parte) || !numerosValidos.has(a.pergunta)) continue;
      if (partesUsadas.has(a.parte) || perguntasUsadas.has(a.pergunta)) continue;
      partesUsadas.add(a.parte);
      perguntasUsadas.add(a.pergunta);
      atribuicoes.push({ pergunta: a.pergunta, parte: a.parte });
    }
    return res.status(200).json({ atribuicoes, semParte: perguntas.filter((q) => !perguntasUsadas.has(q.n)).map((q) => q.n) });
  } catch (e) {
    console.error("Atribuir perguntas: falhou", e?.name, e?.message);
    return tratarErro(e, res);
  }
}

// Anotações: lista dos programas de assembleia e congresso disponíveis na WOL (o app a mostra ao abrir a tela, sem código).
async function listaDeProgramas(res, body) {
  try {
    const itens = await listarProgramas({ forcar: Boolean(body && body.forcar) });
    if (!itens.length) return erro(res, 502, "Não consegui carregar a lista de programas agora.");
    return res.status(200).json({ programas: itens });
  } catch (e) {
    console.error("Lista de programas: falhou", e?.message);
    return erro(res, 502, "Não consegui carregar a lista de programas agora.");
  }
}

// Anotações: metadados do programa (assembleia/congresso) via pub-media e, se houver, tema na WOL.
async function lerProgramaPub(res, body) {
  const entrada = limparLinha(body.entrada || body.pub || body.url || "", 500);
  if (!entrada) return erro(res, 400, "Informe o código da publicação (ex.: CA-brpgm27) ou o link.");
  try {
    const dados = await lerProgramaPublicacao(entrada);
    if (!dados) return erro(res, 404, "Não encontrei esse programa. Confira o código ou o link.");
    return res.status(200).json(dados);
  } catch (e) {
    console.error("Programa pub: falhou", e?.message);
    return erro(res, 502, "Não consegui carregar o programa agora.");
  }
}

// ---------- Joias espirituais ----------
// O servidor lê a leitura da Bíblia da semana (capítulos com os versículos e os trechos das publicações do Índice das
// Publicações) e a seção "Joias espirituais" da apostila (api/_wol.mjs). A IA escreve até o limite de joias por capítulo
// (P.limites.maxJoiasPorCapitulo, 2 por padrão) e a resposta à pergunta da apostila, no estilo das respostas do estudo.

const DestaqueJoia = z.object({ trecho: z.string(), tipo: z.enum(TIPOS), estilo: z.enum(ESTILOS).nullable(), maiusculas: z.boolean() });
const SaidaJoias = z.object({
  pergunta: z
    .object({
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(DestaqueJoia),
      referencias: z.array(z.string()),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
    .nullable(),
  joias: z.array(
    z.object({
      capitulo: z.string(),
      referencia: z.string(),
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(DestaqueJoia),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
  // Resumo dos capítulos e resultado do modo "somente as instruções adicionais": texto puro com um título.
  outros: z.array(z.object({ titulo: z.string(), texto: z.string(), verbetes: z.array(z.string()) })),
});

// Leitura diária: mesmo esqueleto das Joias (schema JSON válido para a Anthropic), com campos extras em "outros".
// Não usar z.any() / z.null() solto / .optional() solto: o conversor exige "type" em todo nó (erro visto em produção).
const DestaqueResumoLeitura = z.object({
  trecho: z.string(),
  estilo: z.enum(ESTILOS).nullable(),
  maiusculas: z.boolean(),
  fonte: z.enum(["doubleStruck", "sans", "squaredDark"]).nullable(),
});
const SaidaResumoLeitura = z.object({
  pergunta: z
    .object({
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(DestaqueJoia),
      referencias: z.array(z.string()),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
    .nullable(),
  joias: z.array(
    z.object({
      capitulo: z.string(),
      referencia: z.string(),
      resposta: z.string(),
      quebras: z.array(z.string()),
      emoji: z.string().nullable(),
      destaques: z.array(DestaqueJoia),
      textosRelevantes: z.array(z.string()),
      verbetes: z.array(z.string()),
    })
  ),
  outros: z.array(
    z.object({
      titulo: z.string(),
      texto: z.string(),
      verbetes: z.array(z.string()),
      consultasWol: z.array(z.string()),
      destaques: z.array(DestaqueResumoLeitura),
      quebras: z.array(z.string()),
    })
  ),
});

// Versículos de uma referência do mesmo capítulo: "Jeremias 45:5" -> { capitulo: 45, versos: Set {5} }; "45:4, 6-7" -> {4, 6, 7}; null se não houver "cap:vers".
function versosDe(ref) {
  const m = String(ref || "").match(/(\d+):([\d,\s–-]+)/);
  if (!m) return null;
  const versos = new Set();
  for (const parte of m[2].split(",")) {
    const [de, ate] = parte.split(/[–-]/).map((n) => Number(n.trim()));
    for (let v = de; v <= (ate || de) && v - de < 200; v++) versos.add(v);
  }
  return { capitulo: Number(m[1]), versos };
}

// "Jeremias 45" + [4, 5] -> "Jeremias 45:4, 5"; [4, 5, 6] -> "Jeremias 45:4-6" (como as publicações escrevem).
function escreverVersos(nomeDoCapitulo, versos) {
  const grupos = [];
  for (const v of versos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && v === ultimo[1] + 1) ultimo[1] = v;
    else grupos.push([v, v]);
  }
  return `${nomeDoCapitulo}:` + grupos.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}-${b}`)).join(", ");
}

const MAX_VERSOS_DA_JOIA = 6;
const MAX_CHARS_VERSICULO_DA_JOIA = 1200;

// REGRA FIXA (pedido do usuário): toda joia da leitura mostra, ANTES do comentário, o texto bíblico completo a que ele se refere. O texto nunca
// vem da IA: são os versículos de "referencia" lidos do capítulo da própria leitura (wol.jw.org, o mesmo texto que a IA recebeu) ou, se não
// estiverem lá, da Bíblia do servidor. Devolve { referencia, texto } (a referência escrita com os versículos que couberam) ou null.
async function versiculoDaJoia(capitulo, referencia) {
  const alvo = versosDe(referencia);
  if (capitulo && alvo && alvo.capitulo === capitulo.capitulo) {
    const doCapitulo = new Map(capitulo.versiculos.map((v) => [v.verso, v.texto]));
    const incluidos = [];
    let texto = "";
    let textoNumerado = ""; // o mesmo texto com o começo de cada versículo, do segundo em diante, marcado por [n]
    for (const n of [...alvo.versos].sort((a, b) => a - b).slice(0, MAX_VERSOS_DA_JOIA)) {
      const t = doCapitulo.get(n);
      if (!t) continue;
      if (texto && texto.length + 1 + t.length > MAX_CHARS_VERSICULO_DA_JOIA) break;
      textoNumerado = texto ? `${textoNumerado} [${n}] ${t}` : t;
      texto = texto ? `${texto} ${t}` : t;
      incluidos.push(n);
    }
    if (texto) return { referencia: escreverVersos(capitulo.nome, incluidos), texto: textoNumerado };
  }
  if (fontesConfiguradas()) {
    const [achado] = await buscarVersiculos([referencia], 1, { numerado: true }).catch(() => []);
    if (achado) return { referencia: achado.referencia, texto: achado.textoNumerado };
  }
  return null;
}

async function leituraJoias(res, body) {
  if (!codigoValido(body.codigo, body.aparelhoId)) {
    if (!process.env.CODIGO_ESTUDO) {
      erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
      return null;
    }
    erro(res, 403, "Código de pesquisa inválido.");
    return null;
  }
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) {
    erro(res, 400, "Semana inválida.");
    return null;
  }
  let joias = null;
  try {
    joias = await lerJoias(url);
  } catch (e) {
    console.error("Joias: leitura falhou", e?.name, e?.message);
    erro(res, 502, "Não consegui ler a leitura da Bíblia da semana no wol.jw.org agora. Tente de novo em instantes.");
    return null;
  }
  if (!joias) erro(res, 404, "Não encontrei a leitura da Bíblia na apostila dessa semana.");
  return joias;
}

// O que o app mostra ao carregar: a semana, a leitura, os capítulos e a pergunta da apostila.
async function lerJoiasDaSemana(res, body) {
  const joias = await leituraJoias(res, body);
  if (!joias) return;
  return res.status(200).json({
    semana: joias.semana,
    leitura: joias.leitura,
    capitulos: joias.capitulos.map((c) => c.nome),
    pergunta: joias.pergunta ? joias.pergunta.texto : null,
    trechos: joias.capitulos.reduce((n, c) => n + c.trechos.length, 0),
    url: joias.url,
  });
}

// Todas as imagens da apostila Vida e Ministério da semana (descrição e legenda), mesmo as de partes que o app não trata. Só lê o wol.jw.org.
async function lerImagensDaApostilaSemana(res, body) {
  const autorizado = codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId);
  if (!autorizado) return recusarAcesso(res, body);
  const url = urlDoEstudo({ ano: body.ano, semana: body.semana });
  if (!url) return erro(res, 400, "Semana inválida.");
  let apostila = null;
  try {
    apostila = await lerImagensDaApostila(url);
  } catch (e) {
    console.error("Imagens da apostila: leitura falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui ler a apostila no wol.jw.org agora. Tente de novo em instantes.");
  }
  if (!apostila) return erro(res, 404, "Não encontrei a apostila dessa semana.");
  return res.status(200).json({ semana: apostila.semana, url: apostila.url, imagens: apostila.imagens });
}

// Busca os verbetes indicados pela IA no Perspicaz (Blob), em paralelo e sem repetir o mesmo nome no pedido.
async function buscarVerbetesDosResumos(outros) {
  const cache = new Map(); // nome trimado (minúsculo) → resultado de buscarVerbete ou null
  async function um(nome) {
    const chave = String(nome || "").trim().toLowerCase();
    if (!chave) return null;
    if (cache.has(chave)) return cache.get(chave);
    const promessa = buscarVerbete([nome]).catch(() => null);
    cache.set(chave, promessa);
    return promessa;
  }
  return Promise.all(
    outros.map(async (o) => {
      const nomes = Array.isArray(o.verbetes) ? o.verbetes : [];
      const resultados = await Promise.all(nomes.map((nome) => um(nome).then((v) => (v ? { nome, ...v } : null))));
      const lista = [];
      for (const v of resultados) {
        if (v && !lista.some((x) => x.verbete === v.verbete)) lista.push(v);
      }
      return lista;
    })
  );
}

// Resumo dos capítulos com o Estudo Perspicaz (Joias: sempre, quando há verbetes): a IA indicou, em "verbetes" de cada resumo, os nomes de
// cidades, lugares, povos, nações e personagens; o servidor busca esses verbetes no Perspicaz (Blob) e a IA reescreve os resumos com o fundo histórico
// que eles trazem. Se algo falhar, ficam os resumos da primeira etapa (sem as fontes). Devolve [{ titulo, texto, perspicaz: ["Gaza (vol. 1)"] }].
async function completarResumosComPerspicaz(outros, joias, P, opcoes, ajuste) {
  const simples = outros.map((o) => ({ titulo: o.titulo, texto: o.texto, perspicaz: [] }));
  if (!fontesConfiguradas() || !outros.length) return simples;
  try {
    const achados = await buscarVerbetesDosResumos(outros);
    if (!achados.some((l) => l.length)) return simples;
    const material = outros.map((o, indice) => ({
      indice,
      titulo: o.titulo,
      resumo: o.texto,
      verbetes: achados[indice].map((v) => ({ nome: v.nome, verbete: v.verbete, volume: v.volume, trecho: v.trecho })),
    }));
    const mensagem =
      blocoOrientacao(opcoes, ajuste, P) +
      P.frases.pedidos["Joias: resumo com o Perspicaz"] +
      "\n\n" +
      textoDasJoias(joias, { pergunta: false, leitura: false, resumo: true }) +
      "\n\nRESUMOS E VERBETES (JSON):\n" +
      JSON.stringify(material) +
      lembreteFinal(opcoes, ajuste, P);
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(client, P, { max_tokens: 12000, system: P.sistemaJoias, messages: [{ role: "user", content: mensagem }] }, { schema: SaidaJoias, semPensar: true, tarefa: "joias" });
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return simples;
    const novos = resposta.parsed_output.outros || [];
    return outros.map((o, i) => {
      const n = novos.find((x) => chaveDeBusca(x.titulo) === chaveDeBusca(o.titulo)) || novos[i];
      const texto = n ? limparResumo(n.texto, 4500) : "";
      return { titulo: o.titulo, texto: texto || o.texto, perspicaz: texto ? achados[i].map((v) => `${v.verbete} (vol. ${v.volume})`) : [] };
    });
  } catch (e) {
    console.error("Resumo com o Perspicaz falhou:", e?.status, e?.message);
    return simples;
  }
}

async function responderJoias(res, body, P) {
  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE);
  // "Executar somente estas instruções": só vale o que o usuário escreveu em "Instruções adicionais para a IA"; as caixas de "O que preparar" não contam.
  const somente = body.somenteAjuste === true;
  if (somente && !ajuste) return erro(res, 400, "Escreva as instruções adicionais para usar só elas.");
  const comPergunta = !somente && body.pergunta !== false;
  const comLeitura = !somente && body.leitura !== false;
  const comResumo = !somente && body.resumo === true;
  if (!somente && !comPergunta && !comLeitura && !comResumo) return erro(res, 400, "Marque a pergunta da apostila, as joias da leitura ou o resumo dos capítulos.");
  const opcoes = validarOpcoes(body.opcoes);
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: true, perspicaz: opcoes.consultarPerspicaz || comResumo });
  const sep = modoSeparacao(opcoes, ajuste);
  // "nova" (botão Outra resposta): outras joias, sobre outros textos; "acrescentar" (pedido de novo com resposta salva): a salva mais o que for possível; "melhorar".
  const modo = ["nova", "melhorar", "acrescentar"].includes(body.modo) ? body.modo : null;
  // O texto bíblico de cada joia é copiado da Bíblia pelo servidor a cada pedido: não precisa ir de volta à IA nas respostas anteriores.
  const semVersiculos = (a) => (a && Array.isArray(a.itens) ? { ...a, itens: a.itens.map((i) => (i && typeof i === "object" ? { ...i, versiculo: undefined } : i)) } : a);
  const anteriores = modo && body.anteriores && typeof body.anteriores === "object" ? JSON.stringify(semVersiculos(body.anteriores)).slice(0, 12000) : "";
  const inicioPedido = Date.now();

  const joias = await leituraJoias(res, body);
  if (!joias) return;
  const pergunta = comPergunta && joias.pergunta;
  if (!pergunta && !comLeitura && !comResumo && !somente) return erro(res, 400, "A apostila dessa semana não tem a pergunta das joias espirituais.");

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    preferenciasDaResposta(opcoes, P, sep) +
    `\n\nPEDIDO: pergunta da apostila ${pergunta ? "ATIVA" : "INATIVA"}; joias da leitura ${comLeitura ? `ATIVAS (no máximo ${P.limites.maxJoiasPorCapitulo} por capítulo)` : "INATIVAS"}; resumo dos capítulos ${comResumo ? "ATIVO" : "INATIVO"}.\n\n` +
    (somente ? P.frases.pedidos["Joias: somente as instruções adicionais"] + "\n\n" : "") +
    (comResumo ? P.frases.pedidos["Joias: resumo dos capítulos"] + "\n\n" : "") +
    // No modo "somente", a leitura inteira vai como material de consulta (versículos, publicações e a pergunta), sem pedir nada dela.
    textoDasJoias(joias, { pergunta: Boolean(pergunta) || somente, leitura: comLeitura || somente, resumo: comResumo || somente }) +
    (await blocoLivros(P, (joias.pergunta && joias.pergunta.pergunta) || "")) +
    lembreteFinal(opcoes, ajuste, P);
  if (modo && anteriores) {
    const frase = modo === "nova" ? "Joias: outras joias" : modo === "acrescentar" ? "Respostas: outra sugestão" : "Respostas: melhorar";
    mensagem += "\n\nRESPOSTAS ANTERIORES (JSON):\n" + anteriores + "\n\n" + P.frases.pedidos[frase];
  }
  // Outras joias: os versículos que as respostas anteriores já usaram não voltam (conferido aqui, além do pedido à IA).
  const jaUsadas = modo === "nova" && body.anteriores && Array.isArray(body.anteriores.itens) ? body.anteriores.itens.map((i) => versosDe(i && i.paragrafos)).filter(Boolean) : [];
  const repeteAnterior = (ref) => {
    const v = versosDe(ref);
    return Boolean(v && jaUsadas.some((u) => u.capitulo === v.capitulo && [...v.versos].some((n) => u.versos.has(n))));
  };

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const inicio = Date.now();
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 16000 /* o raciocínio também conta aqui */, system: P.sistemaJoias, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaJoias, tarefa: "joias" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu preparar as joias espirituais desta semana.");
    }

    const permitidos = estilosDe(opcoes);
    const saida = resposta.parsed_output;
    // A pergunta da apostila: o versículo dela entra sempre (regra fixa dos textos citados na pergunta).
    let itemPergunta = null;
    if (pergunta && saida.pergunta) {
      const rotulo = pergunta.referencias[0] || "Pergunta";
      itemPergunta = montarItem({ ...saida.pergunta, paragrafos: rotulo }, opcoes, permitidos, P.limites, sep);
      itemPergunta.referencias = [...new Set([...pergunta.referencias, ...itemPergunta.referencias])];
      if (!itemPergunta.resposta) itemPergunta = null;
    }
    // No máximo P.limites.maxJoiasPorCapitulo joias por capítulo, na ordem da leitura, e nenhuma sobre o versículo da pergunta da apostila (ela já
    // tem a resposta própria). Os capítulos da leitura são de um livro só, então basta comparar capítulo e versículo.
    const chave = (t) => chaveDeBusca(t).replace(/\s+/g, "");
    const daPergunta = joias.pergunta ? versosDe(joias.pergunta.referencias[0]) : null;
    const repetePergunta = (ref) => {
      const v = versosDe(ref);
      return Boolean(daPergunta && v && v.capitulo === daPergunta.capitulo && [...v.versos].some((n) => daPergunta.versos.has(n)));
    };
    const porCapitulo = new Map(joias.capitulos.map((c) => [chave(c.nome), []]));
    for (const j of comLeitura ? saida.joias : []) {
      const lista = porCapitulo.get(chave(j.capitulo)) || [...porCapitulo.values()].find((l, i) => chave(j.referencia).startsWith(chave(joias.capitulos[i].nome)));
      if (!lista || lista.length >= P.limites.maxJoiasPorCapitulo || repetePergunta(j.referencia) || repeteAnterior(j.referencia)) continue;
      const item = montarItem({ ...j, paragrafos: limparLinha(limparTrecho(j.referencia), 20), referencias: [] }, opcoes, permitidos, P.limites, sep);
      if (!item.resposta) continue;
      const cap = joias.capitulos.find((c) => porCapitulo.get(chave(c.nome)) === lista);
      // O texto bíblico da joia vai inteiro acima do comentário (o app o escreve); não se repete depois dele entre os "outros textos".
      const versiculo = await versiculoDaJoia(cap, j.referencia);
      if (versiculo) {
        const meus = versosDe(versiculo.referencia);
        item.relevantes = item.relevantes.filter((r) => {
          const v = versosDe(r);
          return !(meus && v && v.capitulo === meus.capitulo && [...v.versos].every((n) => meus.versos.has(n)));
        });
      }
      lista.push({ ...item, capitulo: cap.nome, versiculo });
    }
    const itensJoias = [...porCapitulo.values()].flat();
    // Resumo dos capítulos e resultado do modo "somente as instruções": texto puro, com o título limpo (sem fontes especiais nem "culto").
    let outros = (somente || comResumo ? saida.outros || [] : [])
      .map((o) => ({ titulo: limparLinha(limparTrecho(o.titulo), 120), texto: limparResumo(o.texto, 3500), verbetes: listaDeTextos(o.verbetes, 8) }))
      .filter((o) => o.texto)
      .slice(0, somente ? 10 : joias.capitulos.length);
    // O resumo dos capítulos sempre passa pelo Estudo Perspicaz (fundo histórico de cidades, povos e personagens).
    if (comResumo) outros = await completarResumosComPerspicaz(outros, joias, P, opcoes, ajuste);
    else outros = outros.map((o) => ({ titulo: o.titulo, texto: o.texto, perspicaz: [] }));

    console.log(
      "Joias espirituais:",
      JSON.stringify({
        modelo: P.ia.modelo,
        leitura: joias.leitura,
        pergunta: Boolean(itemPergunta),
        outros: outros.length,
        perspicaz: outros.reduce((n, o) => n + o.perspicaz.length, 0),
        somente,
        joias: itensJoias.map((j) => j.paragrafos),
        comTextoBiblico: itensJoias.filter((j) => j.versiculo).length,
        trechos: joias.capitulos.reduce((n, c) => n + c.trechos.length, 0),
        // Publicação citada na pergunta da apostila: null = pergunta não pedida ou sem citação; 0 = não consegui ler; senão, caracteres lidos.
        trechoPergunta: pergunta && pergunta.citacoes.length ? pergunta.trecho?.texto.length || 0 : null,
        caracteres: mensagem.length,
        segundosIa: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );

    const memoriaUsada = memoriaUsadaAgora();
    const finais = await finalizarItens([...(itemPergunta ? [itemPergunta] : []), ...itensJoias], opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    // Botão do JW Library ao lado do Copiar: a apostila no lugar de colar a resposta (a pergunta da apostila; as joias da leitura vão na pergunta geral das joias).
    if (joias.docid) {
      finais.forEach((item, pos) => {
        const par = itemPergunta && pos === 0 ? joias.pidPergunta : joias.pidGeral;
        if (par) item.jwl = { docid: joias.docid, par };
      });
    }
    console.log("Joias espirituais (tempo):", JSON.stringify({ total: Math.round((Date.now() - inicioPedido) / 100) / 10 }));
    return res.status(200).json({
      semana: joias.semana,
      leitura: joias.leitura,
      url: joias.url,
      erro: finais.length || outros.length ? null : "A IA não preparou as joias. Tente de novo.",
      pergunta: itemPergunta ? finais[0] : null,
      joias: itemPergunta ? finais.slice(1) : finais,
      outros,
      memoriaUsada,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Resumo da leitura diária da Bíblia (programa sbr) ----------
// O app envia o grupo do dia (ex.: Gênesis 1-3). O servidor lê os versículos nas fontes e a IA escreve o resumo no
// mesmo modelo das Joias espirituais (um item por capítulo, emoji + [[vv.]] no começo de cada parágrafo). Opcionalmente
// completa com o Estudo Perspicaz, como no resumo das Joias.

// Caixas marcadas no resumo da leitura diária (id enviado pelo app → nome da frase editável em "Orientação do usuário…").
const OPCOES_RESUMO_LEITURA = {
  resumo: "Resumo da leitura: gerar o resumo",
  ensina: "Resumo da leitura: o que ensina sobre Jeová",
  aplicacoes: "Resumo da leitura: aplicações práticas",
  fundo: "Resumo da leitura: fundo histórico",
  personagens: "Resumo da leitura: personagens",
  lugares: "Resumo da leitura: lugares e medidas",
  profecias: "Resumo da leitura: profecias e expressões simbólicas",
};

const SECAO_UNICA_RESUMO_LEITURA = {
  resumo: "RESUMO",
  ensina: "SOBRE JEOVÁ",
  aplicacoes: "APLICAÇÕES PRÁTICAS",
  fundo: "FUNDO HISTÓRICO",
  personagens: "PERSONAGENS",
  lugares: "LUGARES E INFORMAÇÕES GERAIS",
  profecias: "PROFECIAS E EXPRESSÕES SIMBÓLICAS",
};

function idsOpcoesResumoLeitura(valor) {
  return [...new Set((Array.isArray(valor) ? valor : []).filter((id) => typeof id === "string" && Object.hasOwn(OPCOES_RESUMO_LEITURA, id)))];
}

function blocoOpcoesResumoLeitura(ids, P) {
  const f = P.frases.pedidos;
  const linhas = ids.map((id) => f[OPCOES_RESUMO_LEITURA[id]]).filter(Boolean);
  if (!linhas.length) return "";
  return `${f["Resumo da leitura: opções marcadas"] || "OPÇÕES MARCADAS PARA ESTE RESUMO:"}\n${linhas.map((l) => `- ${l}`).join("\n")}\n\n`;
}

// Consultas ao wol.jw.org para o resumo: as que a IA pediu + referências/pedidos nas instruções + capítulo quando fundo/personagens/lugares.
async function pesquisarWolParaResumoLeitura(tituloCap, outros, ajuste, idsOpcoes) {
  const consultas = [];
  const push = (q) => {
    const t = String(q || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (t.length < 8) return;
    if (!consultas.some((c) => c.toLowerCase() === t.toLowerCase())) consultas.push(t);
  };
  const querFonte =
    idsOpcoes.includes("fundo") ||
    idsOpcoes.includes("personagens") ||
    idsOpcoes.includes("lugares") ||
    idsOpcoes.includes("profecias");
  if (querFonte && tituloCap) push(tituloCap);
  for (const o of outros) {
    for (const q of o.consultasWol || []) push(q);
    for (const nome of (o.verbetes || []).slice(0, 4)) push(`${nome} ${tituloCap || ""}`.trim());
  }
  // Referências bíblicas ou pedido explícito nas instruções adicionais.
  const textoAjuste = String(ajuste || "");
  for (const m of textoAjuste.matchAll(/\b(?:[1-3]\s*)?[A-Za-zÀ-ú]{2,}(?:\s+[A-Za-zÀ-ú]+)?\s+\d{1,3}:\d{1,3}(?:\s*[-–]\s*\d{1,3})?\b/gu)) {
    push(m[0]);
  }
  if (/(wol\.jw\.org|biblioteca|pesquise|pesquisa|publique|publicação)/i.test(textoAjuste)) {
    push(tituloCap);
  }
  if (!consultas.length) return [];
  const vistos = new Set();
  const lotes = await Promise.all(
    consultas.slice(0, 4).map(async (q) => {
      try {
        return await pesquisarNoWol(q, 8000, 2);
      } catch {
        return [];
      }
    })
  );
  const lista = [];
  for (const achados of lotes) {
    for (const a of achados) {
      if (!a?.url || vistos.has(a.url)) continue;
      vistos.add(a.url);
      lista.push({
        rotulo: a.rotulo || "",
        titulo: a.titulo || "",
        trecho: String(a.trecho || "").slice(0, 700),
        url: a.url,
      });
      if (lista.length >= 6) return lista;
    }
  }
  return lista;
}

// ----- Organização do texto do resumo (feita pelo servidor, para não depender de a IA seguir a forma à risca) -----
// A IA às vezes entrega a seção toda num parágrafo só. Aqui cada item vira um parágrafo (linha em branco entre eles), com emoji no começo
// quando a opção de emoji está ativa: um personagem ou lugar por parágrafo ("Nome: ..."), uma aplicação ou qualidade por parágrafo, e os
// trechos do resumo e do fundo histórico em blocos curtos.
const REGEX_EMOJI_INICIO = /^(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*)+/u;
const EMOJI_PADRAO_SECAO_RESUMO_LEITURA = {
  RESUMO: "📖",
  "SOBRE JEOVÁ": "🌟",
  "APLICAÇÕES PRÁTICAS": "🛠️",
  "FUNDO HISTÓRICO": "🏛️",
  PERSONAGENS: "👤",
  "LUGARES E INFORMAÇÕES GERAIS": "📍",
  "PROFECIAS E EXPRESSÕES SIMBÓLICAS": "🎺",
};
const TITULO_POR_CHAVE_RESUMO_LEITURA = new Map(Object.values(SECAO_UNICA_RESUMO_LEITURA).map((t) => [chaveDeBusca(t), t]));
const ABREVIACOES_RESUMO_LEITURA = new Set(["v", "vv", "vol", "vols", "pág", "págs", "pag", "pags", "cap", "caps", "cf", "ex", "nº", "séc", "aprox", "ss", "pp"]);
const REGEX_NOME_DE_ITEM = /(?<=[.!?…)"”]\s*)(?=(?:\p{Extended_Pictographic}\uFE0F?\s*)?(?:\p{Lu}|\d)[^\s:.,;()]*(?:\s+[^\s:.,;()]{1,14}){0,3}:\s)/u;
const REGEX_COMECA_COM_NOME = /^(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*)*[^\s:.,;()][^:.,;()]{0,48}:\s/u;

function tituloDeSecaoResumoLeitura(linha) {
  return TITULO_POR_CHAVE_RESUMO_LEITURA.get(chaveDeBusca(String(linha || "").replace(REGEX_EMOJI_INICIO, ""))) || "";
}

// Frases de um parágrafo; "v. 5", "vol. 1" e afins não encerram frase (depois do ponto só abre frase nova letra maiúscula ou emoji).
function frasesDeParagrafo(texto) {
  const pedacos = String(texto).split(/(?<=[.!?…]["”')\]]*)\s+(?=\p{Lu}|\p{Extended_Pictographic})/u);
  const frases = [];
  for (const p of pedacos) {
    const anterior = frases[frases.length - 1];
    const abrev = anterior && /(?:^|[\s(])(\p{L}{1,4})\.$/u.exec(anterior);
    if (abrev && ABREVIACOES_RESUMO_LEITURA.has(abrev[1].toLowerCase())) frases[frases.length - 1] = anterior + " " + p;
    else frases.push(p);
  }
  return frases.map((f) => f.trim()).filter(Boolean);
}

// Marcas de versículo ([[vv. 1-3]] / (v. 5) etc.) vão para o início do parágrafo (depois do emoji), nunca no fim.
function moverVersiculosParaInicioParagrafo(paragrafo) {
  const marcas = [];
  const resto = String(paragrafo || "")
    .replace(/(?:\[\[\s*|\(\s*)(vv?\.\s*[^\]\)]+?)(?:\s*\]\]|\s*\))/gi, (m, corpo) => {
      const marca = "[[" + String(corpo || "").replace(/\s+/g, " ").trim() + "]]";
      if (!marcas.some((x) => x.toLowerCase() === marca.toLowerCase())) marcas.push(marca);
      return " ";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  if (!marcas.length) return String(paragrafo || "").trim();
  const mEmoji = resto.match(REGEX_EMOJI_INICIO);
  const emoji = mEmoji ? mEmoji[0] : "";
  const corpo = resto.slice(emoji.length).trim();
  return (emoji + marcas.join(" ") + (corpo ? " " + corpo : "")).replace(/[ \t]{2,}/g, " ").trim();
}

// "Cumprimento (passado):" → "Cumprimento passado:" (a voz lê o que está entre parênteses só em casos especiais).
function normalizarRotulosProfecia(texto) {
  return String(texto || "").replace(
    /\*{0,2}(Profecia|Cumprimento)\s*(?:\((passado|presente|futuro)\)|(passado|presente|futuro))\s*:\*{0,2}/gi,
    (_, rotulo, a, b) => {
      const tempo = a || b;
      return tempo ? `${rotulo} ${tempo.toLowerCase()}:` : `${rotulo}:`;
    }
  );
}

function organizarSecaoResumoLeitura(secao, paragrafos, emojiAtivo) {
  let itens = paragrafos.map((p) => p.replace(/^[-•–]\s+/, "").trim()).filter(Boolean);
  if (secao === "PERSONAGENS" || secao === "LUGARES E INFORMAÇÕES GERAIS" || secao === "PROFECIAS E EXPRESSÕES SIMBÓLICAS") {
    // Só divide o parágrafo que já começa em "Nome: …" (a IA seguiu o formato ao menos no primeiro); assim frases comuns com dois-pontos não são cortadas.
    itens = itens.flatMap((p) => (REGEX_COMECA_COM_NOME.test(p) ? p.split(REGEX_NOME_DE_ITEM).map((x) => x.trim()).filter(Boolean) : [p]));
  } else if (itens.length === 1) {
    const frases = frasesDeParagrafo(itens[0]);
    if ((secao === "SOBRE JEOVÁ" || secao === "APLICAÇÕES PRÁTICAS") && frases.length >= 3) {
      itens = frases; // lista: uma frase (ponto) por parágrafo
    } else if ((secao === "RESUMO" || secao === "FUNDO HISTÓRICO") && frases.length >= 4) {
      itens = [];
      for (let i = 0; i < frases.length; i += 2) itens.push(frases.slice(i, i + 2).join(" ")); // blocos de duas frases
    }
  }
  if (emojiAtivo && secao) {
    const padrao = EMOJI_PADRAO_SECAO_RESUMO_LEITURA[secao];
    itens = itens.map((p) => (REGEX_EMOJI_INICIO.test(p) ? p : padrao + " " + p));
  }
  if (secao === "PROFECIAS E EXPRESSÕES SIMBÓLICAS") itens = itens.map(normalizarRotulosProfecia);
  return itens.map(moverVersiculosParaInicioParagrafo);
}

function organizarResumoLeitura(texto, emojiAtivo) {
  // A bola de cristal (adivinhação) nunca vai no resumo, mesmo que um prompt editado a peça: vira a trombeta 🎺 (6.10.74; a corneta 📯 da 6.10.74 também, 6.10.76).
  texto = String(texto || "").replace(/🔮|📯/gu, "🎺");
  const saida = [];
  let secao = "";
  let corpo = [];
  const fechar = () => {
    saida.push(...organizarSecaoResumoLeitura(secao, corpo, emojiAtivo));
    corpo = [];
  };
  for (const p of String(texto || "").split("\n\n")) {
    const titulo = tituloDeSecaoResumoLeitura(p);
    if (titulo) {
      fechar();
      secao = titulo;
      saida.push(titulo); // o subtítulo fica sozinho e sem emoji; o app põe o emoji e o negrito
    } else {
      corpo.push(p);
    }
  }
  fechar();
  return saida.join("\n\n");
}

function sanearItemResumoLeitura(o, opcoesFmt, P, maxTexto) {
  const texto = organizarResumoLeitura(limparResumo(o.texto, maxTexto), Boolean(opcoesFmt.emoji));
  const permitidos = estilosDe(opcoesFmt);
  return {
    titulo: limparLinha(o.titulo, 120),
    texto,
    verbetes: Array.isArray(o.verbetes) ? o.verbetes.map((v) => limparLinha(v, 60)).filter(Boolean).slice(0, 8) : [],
    consultasWol: Array.isArray(o.consultasWol) ? o.consultasWol.map((v) => limparLinha(v, 120)).filter(Boolean).slice(0, 4) : [],
    destaques: sanearDestaques(o.destaques, texto, opcoesFmt, permitidos, P.limites.maxDestaques),
    quebras: [], // os parágrafos já vêm organizados por organizarResumoLeitura; quebras dentro deles quebrariam as listas
  };
}

// Fundo histórico, personagens, lugares e/ou profecias: Perspicaz (+ WOL se houver consultas) e reescrita com citação de fontes.
// Não reenvia os versículos — só orientação, opções, rascunho, verbetes e trechos.
async function completarResumosLeituraComFontes(outros, P, ajuste = "", blocoOpcoes = "", tituloCap = "", idsOpcoes = [], opcoesFmt = {}, blocoFmt = "") {
  const simples = outros.map((o) => ({
    titulo: o.titulo,
    texto: o.texto,
    perspicaz: [],
    destaques: o.destaques || [],
    quebras: o.quebras || [],
  }));
  const temVerbetes = outros.some((o) => (o.verbetes || []).length);
  const temConsultas = outros.some((o) => (o.consultasWol || []).length) || Boolean(ajuste);
  if (!outros.length || (!temVerbetes && !temConsultas && !idsOpcoes.includes("fundo") && !idsOpcoes.includes("profecias"))) return simples;
  try {
    const [achados, wol] = await Promise.all([
      fontesConfiguradas() && temVerbetes ? buscarVerbetesDosResumos(outros) : Promise.resolve(outros.map(() => [])),
      pesquisarWolParaResumoLeitura(tituloCap, outros, ajuste, idsOpcoes),
    ]);
    if (!achados.some((l) => l.length) && !wol.length) return simples;
    const material = outros.map((o, indice) => ({
      indice,
      titulo: o.titulo,
      resumo: o.texto,
      verbetes: (achados[indice] || []).map((v) => ({
        nome: v.nome,
        verbete: v.verbete,
        volume: v.volume,
        trecho: v.trecho,
        citarComo: `Estudo Perspicaz, vol. ${v.volume}, "${v.verbete}"`,
      })),
    }));
    const frase =
      P.frases.pedidos["Resumo da leitura: com fontes"] ||
      P.frases.pedidos["Resumo da leitura: com o Perspicaz"] ||
      P.frases.pedidos["Joias: resumo com o Perspicaz"];
    const blocoWol = wol.length
      ? "\n\nPUBLICAÇÕES DO WOL.JW.ORG (trechos; cite o rotulo/titulo na resposta):\n" +
        JSON.stringify(wol.map((w) => ({ rotulo: w.rotulo, titulo: w.titulo, trecho: w.trecho })))
      : "";
    const mensagem =
      blocoOrientacao({}, ajuste, P) +
      `"pergunta" é null; "joias" é []. Em cada item de "outros", preencha "verbetes", "consultasWol" e "destaques" (listas; vazias se não houver) e deixe "quebras" [].\n\n` +
      frase +
      "\n\n" +
      blocoFmt +
      blocoOpcoes +
      "RESUMOS E VERBETES (JSON):\n" +
      JSON.stringify(material) +
      blocoWol +
      lembreteFinal({}, ajuste, P);
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 12000, system: P.sistemaJoias, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaResumoLeitura, semPensar: true, tarefa: "leitura-biblia" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) return simples;
    const novos = resposta.parsed_output.outros || [];
    return outros.map((o, i) => {
      const n = novos.find((x) => chaveDeBusca(x.titulo) === chaveDeBusca(o.titulo)) || novos[i];
      if (!n || !n.texto) {
        return { titulo: o.titulo, texto: o.texto, perspicaz: [], destaques: o.destaques || [], quebras: o.quebras || [] };
      }
      const saneado = sanearItemResumoLeitura(n, opcoesFmt, P, 9000);
      const fontesPersp = (achados[i] || []).map((v) => `${v.verbete} (vol. ${v.volume})`);
      const fontesWol = wol.map((w) => [w.rotulo, w.titulo].filter(Boolean).join(" — ")).filter(Boolean);
      return {
        titulo: saneado.titulo || o.titulo,
        texto: saneado.texto || o.texto,
        perspicaz: [...fontesPersp, ...fontesWol.map((f) => `WOL: ${f}`)],
        destaques: saneado.destaques,
        quebras: saneado.quebras,
      };
    });
  } catch (e) {
    console.error("Leitura diária: resumo com fontes falhou:", e?.status, e?.message);
    return simples;
  }
}

// O texto de um capítulo, versículo por versículo, para o player da Leitura diária da Bíblia mostrar o versículo em andamento.
// Sem IA: só lê a Bíblia das fontes. Exige o código de resumo, como o resumo dos capítulos.
async function textoDoCapituloBiblia(res, body) {
  if (!resumoValido(body.codigoResumo, body.aparelhoId)) {
    if (!process.env.CODIGO_RESUMO) return erro(res, 503, "O código de resumo ainda não está configurado no servidor.");
    return erro(res, 403, "Código de resumo inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  }
  if (!fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  const livro = typeof body.livro === "string" ? body.livro.trim().slice(0, 40) : "";
  if (!livro) return erro(res, 400, "Informe o livro e o capítulo.");
  let versiculos;
  try {
    versiculos = await versiculosDoCapitulo(livro, body.capitulo);
  } catch {
    return erro(res, 502, "Não foi possível consultar o texto da Bíblia agora.");
  }
  return res.status(200).json({ livro, capitulo: Number(body.capitulo), versiculos });
}

async function resumirLeituraBiblia(res, body, P) {
  if (!resumoValido(body.codigoResumo, body.aparelhoId)) {
    if (!process.env.CODIGO_RESUMO) return erro(res, 503, "O código de resumo ainda não está configurado no servidor.");
    return erro(res, 403, "Código de resumo inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  }
  if (!fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");

  const refs = (Array.isArray(body.refs) ? body.refs : [])
    .map((r) => ({
      livro: typeof r?.livro === "string" ? r.livro.trim().slice(0, 40) : "",
      rotulo: typeof r?.rotulo === "string" ? r.rotulo.trim().slice(0, 40) : "todo",
    }))
    .filter((r) => r.livro);
  if (!refs.length) return erro(res, 400, "Informe o grupo de capítulos a resumir.");
  const titulo = typeof body.titulo === "string" ? body.titulo.trim().slice(0, 120) : refs.map((r) => `${r.livro} ${r.rotulo}`).join("; ");

  const idsOpcoes = idsOpcoesResumoLeitura(body.opcoesResumo);
  if (!idsOpcoes.length) return erro(res, 400, "Marque pelo menos uma opção para gerar o texto.");
  // Compatibilidade: pedidos antigos sem a caixa "resumo" e sem outras caixas não chegam aqui; se só vierem opções
  // "extras" sem "resumo", a seção RESUMO não é pedida (o usuário desmarcou de propósito).
  // Perspicaz (e WOL na 2ª etapa) para fundo, personagens, lugares e profecias — não para só Jeová/aplicações/resumo.
  const querFontes =
    idsOpcoes.includes("personagens") ||
    idsOpcoes.includes("lugares") ||
    idsOpcoes.includes("fundo") ||
    idsOpcoes.includes("profecias");
  const opcoesFmt = validarOpcoes(body.opcoes);
  const blocoFmt =
    "FORMATAÇÃO (as mesmas preferências das respostas do app):\n" +
    descreverFormatacaoResposta(opcoesFmt, P, "") +
    "\nIndique em \"destaques\" trechos literais do \"texto\" a destacar (estilo negrito/italico/negrito_italico, maiusculas e, se permitido, fonte doubleStruck/sans/squaredDark). Deixe \"quebras\" []: a separação em parágrafos é a do próprio \"texto\" (linha em branco entre um item e outro). Os nomes de personagens e lugares (antes dos dois-pontos) o app põe em negrito sozinho; destaque outras palavras importantes. Se emoji estiver INATIVO, não comece parágrafos com emoji.\n\n";

  const anterior = typeof body.anterior === "string" ? body.anterior.replace(/\s+/g, " ").trim().slice(0, 12000) : "";
  const modoAnterior = anterior
    ? body.modoAnterior === "acrescentar-secao" || body.modoAnterior === "melhorar-secao" || body.modoAnterior === "melhorar"
      ? body.modoAnterior
      : "melhorar"
    : "";
  const secaoUnica =
    (modoAnterior === "acrescentar-secao" || modoAnterior === "melhorar-secao") &&
    typeof body.secaoUnica === "string" &&
    Object.hasOwn(SECAO_UNICA_RESUMO_LEITURA, body.secaoUnica)
      ? body.secaoUnica
      : "";

  precarregarFontes({ biblia: true, perspicaz: querFontes });
  const textoBiblia = await textoDeGruposBiblicos(refs, 32000);
  if (!textoBiblia.trim()) return erro(res, 404, "Não encontrei esses capítulos na Bíblia das fontes.");

  const ajuste = textoLivre(body.ajuste, MAX_AJUSTE); // instruções adicionais que o usuário escreveu para este resumo
  const blocoOpcoes = blocoOpcoesResumoLeitura(idsOpcoes, P);
  const f = P.frases.pedidos;
  const fraseBase = f["Resumo da leitura: base"] || f["Joias: resumo dos capítulos"];
  const fraseVerbetes = querFontes ? (f["Resumo da leitura: pedir verbetes"] || "") + "\n\n" : "";
  let blocoAnterior = "";
  if (anterior && modoAnterior === "melhorar") {
    blocoAnterior = (f["Resumo da leitura: texto já salvo (melhorar)"] || "TEXTO JÁ SALVO (base): melhore sem perder o essencial.") + "\n\n" + anterior + "\n\n";
  } else if (anterior && modoAnterior === "acrescentar-secao" && secaoUnica) {
    blocoAnterior =
      (f["Resumo da leitura: texto já salvo (acrescentar seção)"] || "Devolva só a seção nova.") +
      `\nSeção a ACRESCENTAR: ${SECAO_UNICA_RESUMO_LEITURA[secaoUnica]}.\n\nTEXTO JÁ SALVO (contexto):\n` +
      anterior +
      "\n\n";
  } else if (anterior && modoAnterior === "melhorar-secao" && secaoUnica) {
    blocoAnterior =
      (f["Resumo da leitura: texto já salvo (melhorar seção)"] || "Devolva só a seção melhorada.") +
      `\nSeção a MELHORAR: ${SECAO_UNICA_RESUMO_LEITURA[secaoUnica]}.\n\nTEXTO JÁ SALVO:\n` +
      anterior +
      "\n\n";
  }
  const avisoProfecias = idsOpcoes.includes("profecias")
    ? "OBRIGATÓRIO: o \"texto\" deve trazer o subtítulo PROFECIAS E EXPRESSÕES SIMBÓLICAS (linha sozinha) e os itens dessa seção. O detalhe das profecias e símbolos NÃO fica só no RESUMO — o RESUMO narra; a interpretação (Profecia / Cumprimento) vai na seção própria. Em cada item use exatamente um rótulo SEM parênteses: Cumprimento passado, Cumprimento presente ou Cumprimento futuro. Em Daniel 2, os pés de ferro e argila são Cumprimento presente — a potência anglo-americana atual —, não futuro.\n\n"
    : "";
  const mensagem =
    blocoOrientacao({}, ajuste, P) +
    `PEDIDO: texto da leitura diária da Bíblia (${titulo}).\n` +
    `pergunta da apostila INATIVA; joias da leitura INATIVAS; seções pedidas = opções marcadas.\n` +
    `"pergunta" é null e "joias" é []. Em cada item de "outros", preencha "verbetes", "consultasWol" e "destaques" (listas; vazias se não houver) e deixe "quebras" [].\n` +
    `Opções ATIVAS: ${idsOpcoes.join(", ")}` +
    (secaoUnica ? ` (modo seção única: só ${SECAO_UNICA_RESUMO_LEITURA[secaoUnica]}).` : ".") +
    "\n\n" +
    avisoProfecias +
    blocoAnterior +
    blocoFmt +
    fraseBase +
    "\n\n" +
    fraseVerbetes +
    blocoOpcoes +
    "LEITURA (versículos do capítulo, na ordem):\n" +
    textoBiblia +
    (await blocoLivros(P, titulo + " " + textoBiblia.slice(0, 8000))) +
    lembreteFinal({}, ajuste, P);

  const inicio = Date.now();
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 120_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 12000, system: P.sistemaJoias, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaResumoLeitura, tarefa: "leitura-biblia" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu preparar o resumo desta leitura.");
    }
    const maxTexto = idsOpcoes.length ? 9000 : 4500;
    let outros = (resposta.parsed_output.outros || [])
      .map((o) => {
        const item = sanearItemResumoLeitura(o, opcoesFmt, P, maxTexto);
        if (!querFontes) {
          item.verbetes = [];
          item.consultasWol = [];
        }
        return item;
      })
      .filter((o) => o.texto);
    const precisaEtapa2 =
      querFontes &&
      outros.some(
        (o) =>
          o.verbetes.length ||
          o.consultasWol.length ||
          idsOpcoes.includes("fundo") ||
          idsOpcoes.includes("profecias") ||
          Boolean(ajuste)
      );
    if (precisaEtapa2) {
      outros = await completarResumosLeituraComFontes(outros, P, ajuste, blocoOpcoes, titulo, idsOpcoes, opcoesFmt, blocoFmt);
    } else {
      outros = outros.map((o) => ({
        titulo: o.titulo,
        texto: o.texto,
        perspicaz: [],
        destaques: o.destaques,
        quebras: o.quebras,
      }));
    }

    console.log(
      "Leitura diária da Bíblia:",
      JSON.stringify({
        modelo: P.ia.modelo,
        titulo,
        capitulos: outros.length,
        opcoes: idsOpcoes,
        fontes: querFontes,
        verbetesAchados: outros.reduce((n, o) => n + (o.perspicaz || []).length, 0),
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
      })
    );
    return res.status(200).json({
      titulo,
      erro: outros.length ? null : "A IA não preparou o resumo. Tente de novo.",
      outros,
      memoriaUsada: memoriaUsadaAgora(),
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Comentários adicionais sobre o texto diário (tela Início) ----------
// O servidor lê o texto do dia no wol.jw.org (o mesmo da tela Início, guardado na memória) e a IA sugere aplicações
// práticas do texto temático e dos pontos principais do comentário, para alguém comentar com as próprias palavras.
// Ela pensa antes de responder (o texto é curto e a qualidade importa mais que a pressa).

const SaidaTextoDiario = z.object({
  comentarios: z.array(z.object({ ponto: z.string(), emoji: z.string().optional(), base: z.string().optional(), aplicacao: z.string() })),
});

// Só um ou dois emojis de verdade (nada de texto); senão, vazio e o app usa o seu próprio.
function emojiDoComentario(valor) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return /^(?:\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*){1,2}$/u.test(texto) ? texto : "";
}

async function comentariosDoTextoDiario(res, body, P) {
  if (!codigoValido(body.codigo, body.aparelhoId)) {
    if (!process.env.CODIGO_ESTUDO) return erro(res, 503, "O código de pesquisa ainda não está configurado no servidor.");
    return erro(res, 403, "Código de pesquisa inválido.");
  }
  const m = typeof body.data === "string" ? body.data.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!m) return erro(res, 400, "Data inválida.");

  let texto = null;
  try {
    texto = await lerTextoDiario(Number(m[1]), Number(m[2]), Number(m[3]));
  } catch (e) {
    console.error("Comentários do texto diário: leitura falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui ler o texto diário no wol.jw.org agora. Tente de novo em instantes.");
  }
  if (!texto) return erro(res, 404, "O wol.jw.org ainda não tem o texto diário dessa data.");

  const anteriores = (Array.isArray(body.anteriores) ? body.anteriores : [])
    .map((a) => limparLinha(a, 700))
    .filter(Boolean)
    .slice(0, 12);
  const mensagem =
    `TEXTO DIÁRIO:\nData: ${texto.titulo}\nTexto temático: ${texto.tema}\nComentário:\n${texto.comentario.join("\n")}` +
    (anteriores.length
      ? `\n\nCOMENTÁRIOS JÁ SUGERIDOS (outras palavras; só mude o enfoque se o texto do dia sustentar):\n${anteriores.map((a) => `- ${a}`).join("\n")}`
      : "") +
    (await blocoLivros(P, `${texto.tema} ${texto.comentario.join(" ")}`));

  const inicio = Date.now();
  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: 6000 /* o raciocínio também conta aqui */, system: P.sistemaTextoDiario, messages: [{ role: "user", content: mensagem }] },
      { schema: SaidaTextoDiario, tarefa: "texto-diario-comentarios" }
    );
    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu sugerir comentários para este texto.");
    }
    // "base" (a abertura, que o app mostra em negrito e itálico) e "aplicacao" viram um "comentario" só (o que a voz lê); a base é sempre o começo dele.
    const comentarios = resposta.parsed_output.comentarios
      .map((c) => {
        const base = limparTextoGerado(c.base || "", 350);
        const aplicacao = limparTextoGerado(c.aplicacao, 500);
        return {
          ponto: limparLinha(limparTrecho(c.ponto), 120),
          emoji: emojiDoComentario(c.emoji),
          base: base && aplicacao ? base : "",
          comentario: [base, aplicacao].filter(Boolean).join(" "),
        };
      })
      .filter((c) => c.comentario)
      .slice(0, 6);

    console.log(
      "Comentários do texto diário:",
      JSON.stringify({
        modelo: P.ia.modelo,
        data: texto.data,
        comentarios: comentarios.length,
        outros: anteriores.length > 0,
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        entrada: resposta.usage?.input_tokens || 0,
        saida: resposta.usage?.output_tokens || 0,
        pensamento: resposta.usage?.output_tokens_details?.thinking_tokens ?? null,
      })
    );
    const vozCupom = emitirCupomVoz({
      data: texto.data,
      textos: comentarios.flatMap((c) => [c.ponto, c.comentario]).filter(Boolean),
    });
    return res.status(200).json({
      data: texto.data,
      erro: comentarios.length ? null : "A IA não sugeriu comentários. Tente de novo.",
      comentarios,
      memoriaUsada: memoriaUsadaAgora(),
      vozCupom,
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Lista de parágrafos do estudo ----------
// No caminho feliz o servidor lê o artigo no wol.jw.org e devolve os grupos (sem IA). Só se essa leitura falhar
// a IA lê a página (web_fetch, só wol.jw.org) e devolve os números. O app usa a lista para navegar entre os grupos.

const SaidaLista = z.object({
  titulo: z.string().nullable().optional(),
  erro: z.string().nullable().optional(),
  artigo: z.string().nullable().optional(),
  grupos: z.array(z.string()),
  recapitulacao: z.boolean().optional(),
});

// "1 e 2" -> "1, 2"; "3 – 4" -> "3-4". Descarta o que não parecer uma lista de números.
function normalizarGrupo(grupo) {
  const texto = String(grupo || "")
    .replace(/(\d)\s*(?:e|,)\s*(?=\d)/gi, "$1, ")
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, "$1-")
    .trim();
  return /^\d{1,3}(?:(?:, |-)\d{1,3}){0,15}$/.test(texto) ? texto : null;
}

// Prefere o endereço que a ferramenta realmente leu (confiável) ao número que o modelo disser.
function idDoArtigoLido(resposta, urlPedida, informadoPelaIa) {
  const padrao = /\/pt\/wol\/d\/r5\/lp-t\/(\d{7})\/?$/;
  let id = null;
  for (const bloco of resposta.content) {
    if (bloco.type === "web_fetch_tool_result" && bloco.content && typeof bloco.content.url === "string") {
      const m = bloco.content.url.match(padrao);
      if (m) id = m[1];
    }
  }
  if (id) return id;
  const pedida = urlPedida.match(padrao);
  if (pedida) return pedida[1];
  return /^\d{7}$/.test(String(informadoPelaIa || "").trim()) ? String(informadoPelaIa).trim() : null;
}

function jsonDaListaLida(lido) {
  return {
    titulo: lido.titulo || null,
    artigo: lido.id,
    url: lido.url,
    grupos: lido.grupos.map((g) => g.rotulo).slice(0, 40),
    perguntas: lido.grupos.map((g) => g.pergunta || "").slice(0, 40), // alinhadas com "grupos": o app mostra a do parágrafo escolhido
    imagens: lido.grupos.map((g) => (g.imagens || []).map((i) => ({ descricao: i.descricao, legenda: i.legenda, pid: i.pid || null }))).slice(0, 40),
    recapitulacao: lido.recapitulacao.length > 0,
    pids: lido.pids || {}, // número do parágrafo -> data-pid (o "par" do endereço do JW Library)
    erro: null,
  };
}

// Tenta a leitura direta. Devolve true se já respondeu (sucesso ou URL inválida). false = precisa da IA.
// O texto dos parágrafos de uma pergunta do estudo (para a caixa "Ver o texto do parágrafo"): lido no wol.jw.org, sem IA.
async function textoDosParagrafosDoEstudo(res, body) {
  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido.");
  const pedido = String(body.paragrafos || "").trim();
  const alvo = /^[\d\s,\-–]{1,120}$/.test(pedido) ? numerosDosParagrafos(pedido) : null;
  if (!alvo || !alvo.size) return erro(res, 400, "Informe os parágrafos.");
  try {
    const lido = await lerEstudoDireto(url);
    if (!lido) return erro(res, 502, "Não consegui ler o artigo no wol.jw.org agora.");
    const paragrafos = lido.grupos
      .filter((g) => g.numeros.some((n) => alvo.has(n)))
      .flatMap((g) => g.paragrafos.map((p) => ({ numero: p.numero ?? null, texto: String(p.texto || "").trim() })))
      .filter((p) => p.texto);
    if (!paragrafos.length) return erro(res, 404, "Não encontrei o texto desse(s) parágrafo(s) no artigo.");
    return res.status(200).json({ paragrafos });
  } catch (e) {
    console.error("Texto dos parágrafos do estudo: falhou", e?.name, e?.message);
    return erro(res, 502, "Não consegui ler o artigo no wol.jw.org agora.");
  }
}

async function tentarListaNoSite(res, body) {
  if (!codigoValido(body.codigo, body.aparelhoId) && !dirigenteValido(body.codigoDirigente, body.aparelhoId)) {
    if (!process.env.CODIGO_ESTUDO && !codigoDoDirigente()) {
      erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
      return true;
    }
    recusarAcesso(res, body);
    return true;
  }
  const url = urlDoEstudo(body);
  if (!url) {
    erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");
    return true;
  }
  const inicio = Date.now();
  try {
    const lido = await lerEstudoDireto(url);
    if (lido) {
      console.log("Estudo-lista (lido no site):", JSON.stringify({ grupos: lido.grupos.length, recapitulacao: lido.recapitulacao.length, segundos: Math.round((Date.now() - inicio) / 100) / 10 }));
      res.status(200).json(jsonDaListaLida(lido));
      return true;
    }
  } catch (e) {
    console.error("Estudo-lista: leitura direta falhou", e?.name, e?.message);
  }
  return false;
}

async function listarParagrafos(res, body, P) {
  if (!codigoValido(body.codigo, body.aparelhoId) && !dirigenteValido(body.codigoDirigente, body.aparelhoId)) {
    if (!process.env.CODIGO_ESTUDO && !codigoDoDirigente()) return erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
    return recusarAcesso(res, body);
  }

  const url = urlDoEstudo(body);
  if (!url) return erro(res, 400, "Número ou link do artigo inválido. Use o número de 7 dígitos (ex.: 2026521) ou o link do wol.jw.org.");

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, 90_000) });
    const tools = [
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["wol.jw.org"], max_content_tokens: 60000 },
    ];

    let mensagens = [{ role: "user", content: `ENDEREÇO: ${url}` }];
    let resposta;
    for (let volta = 0; volta < 3; volta++) {
      // 4000: folga para o raciocínio dos modelos que não o desligam (no Haiku a resposta usa bem menos).
      resposta = await chamarIa(client, P, { max_tokens: 4000, system: P.sistemaLista, messages: mensagens, tools }, { semPensar: true });
      if (resposta.stop_reason !== "pause_turn") break;
      mensagens = [...mensagens, { role: "assistant", content: resposta.content }];
    }

    if (resposta.stop_reason === "refusal") return erro(res, 502, "A IA não conseguiu responder a este pedido.");

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");
    const dados = SaidaLista.safeParse(extrairJson(texto));
    if (!dados.success) return erro(res, 502, "A IA não devolveu a lista no formato esperado. Tente novamente.");

    const vistos = new Set();
    const grupos = [];
    for (const g of dados.data.grupos.slice(0, 60)) {
      const normal = normalizarGrupo(g);
      if (normal && !vistos.has(normal)) {
        vistos.add(normal);
        grupos.push(normal);
      }
    }
    if (grupos.length > 40) grupos.length = 40;

    const limpar = (valor, max) => (typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, max) : "");
    const artigo = idDoArtigoLido(resposta, url, dados.data.artigo);

    return res.status(200).json({
      titulo: limpar(dados.data.titulo, 200) || null,
      artigo,
      url,
      grupos,
      recapitulacao: dados.data.recapitulacao !== false,
      erro: grupos.length ? null : limpar(dados.data.erro, 300) || "Não consegui ler o artigo ou encontrar os parágrafos.",
    });
  } catch (e) {
    return tratarErro(e, res);
  }
}

// ---------- Tela Backup: caixas "Sua resposta" de documentos do wol.jw.org ----------
// O navegador manda só os números dos documentos (nunca o conteúdo do backup); o servidor lê as páginas no wol.jw.org e devolve o
// título, a publicação/edição e, de cada caixa de resposta, o id (TextTag), o número do parágrafo e a pergunta. Não usa a IA.
// Vale o código de pesquisa (ou o do dirigente) e tem limite próprio, para não gastar os pedidos à IA.
const acessosBackup = new Map();
function excedeuLimiteBackup(ip) {
  const agora = Date.now();
  const lista = (acessosBackup.get(ip) || []).filter((t) => agora - t < 60 * 60 * 1000);
  if (lista.length >= 60) {
    acessosBackup.set(ip, lista);
    return true;
  }
  lista.push(agora);
  acessosBackup.set(ip, lista);
  if (acessosBackup.size > 5000) acessosBackup.clear();
  return false;
}

async function lerCamposDosDocumentos(req, res) {
  const body = req.body || {};
  if (!(codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId))) return recusarAcesso(res, body);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
  const ids = [...new Set((Array.isArray(body.documentos) ? body.documentos : []).map((d) => String(d).trim()).filter((d) => /^\d{6,12}$/.test(d)))].slice(0, 10);
  if (!ids.length) return erro(res, 400, "Nenhum documento válido.");
  const documentos = {};
  const falhas = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        documentos[id] = await lerCamposDoDocumento(id);
      } catch (e) {
        console.error("Backup: documento não lido", id, e?.name, e?.message);
        falhas.push(id);
      }
    })
  );
  return res.status(200).json({ documentos, falhas });
}

// Em que semana cada artigo de estudo (A Sentinela) é estudado: o app manda só os números dos documentos e a edição de cada um.
async function lerSemanasDosDocumentos(req, res) {
  const body = req.body || {};
  if (!(codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId))) return recusarAcesso(res, body);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
  const vistos = new Set();
  const documentos = (Array.isArray(body.documentos) ? body.documentos : [])
    .map((d) => ({ id: String(d && d.id).trim(), edicao: Number(d && d.edicao) }))
    .filter((d) => /^\d{6,12}$/.test(d.id) && Number.isInteger(d.edicao) && d.edicao >= 20220100 && d.edicao <= 20991200 && Math.floor(d.edicao / 100) % 100 >= 1 && Math.floor(d.edicao / 100) % 100 <= 12)
    .filter((d) => (vistos.has(d.id) ? false : vistos.add(d.id)))
    .slice(0, 40);
  if (!documentos.length) return res.status(200).json({ semanas: {} });
  try {
    return res.status(200).json({ semanas: await semanasDosEstudos(documentos) });
  } catch (e) {
    console.error("Backup: semanas de estudo não lidas", e?.name, e?.message);
    return erro(res, 502, "Não consegui consultar as semanas agora. Tente de novo em instantes.");
  }
}

// As publicações de uma semana (o artigo de estudo de A Sentinela e a apostila Vida e Ministério), para criar respostas em documentos que
// ainda não estão no backup.
async function lerPublicacoesDaSemana(req, res) {
  const body = req.body || {};
  if (!(codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId))) return recusarAcesso(res, body);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "desconhecido";
  if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
  const ano = Number(body.ano);
  const semana = Number(body.semana);
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100 || !Number.isInteger(semana) || semana < 1 || semana > 53) return erro(res, 400, "Semana inválida.");
  try {
    const reuniao = await lerReuniaoDaSemana(ano, semana);
    // O capítulo do Estudo Bíblico só é buscado quando o cliente precisa (apostila / respostas do EBC); Sentinela sozinha não paga essa leitura.
    const incluirEstudo = body.incluirEstudo !== false;
    const estudo = incluirEstudo && reuniao.apostila ? await lerEstudoDaSemana(reuniao.apostila.id).catch(() => null) : undefined;
    return res.status(200).json(incluirEstudo ? { ...reuniao, estudo: estudo || null } : reuniao);
  } catch (e) {
    console.error("Backup: semana não lida", ano, semana, e?.name, e?.message);
    return erro(res, 502, "Não consegui ler essa semana no wol.jw.org agora. Tente de novo em instants.");
  }
}

export default async function handler(req, res) {
  const corpo = req.body && typeof req.body === "object" ? req.body : {};
  const admin = textosIguais(corpo.codigoAdmin, process.env.CODIGO_ADMIN);
  const aparelhoId = aparelhoIdLimpo(corpo.aparelhoId);
  const tarefaPedido = typeof corpo.tarefa === "string" ? corpo.tarefa : "";
  // O uso da IA é gravado em chamarIa (antes da resposta). Aqui só roda o pedido.
  return contextoDoPedido.run(
    { admin, memoriaUsada: 0, aparelhoId, consultasIa: 0, tokensIn: 0, tokensOut: 0, tarefaIa: tarefaPedido },
    () => tratarPedido(req, res)
  );
}

async function tratarPedido(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }

  if (!origemPermitida(req.headers.origin)) {
    return erro(res, 403, "Origem não permitida.");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const tarefa = body.tarefa;
  const ip = ipDoPedido(req);

  await prepararCodigosPessoais();
  const bloqueioSite = await mensagemSeBloqueado({ aparelhoId: body.aparelhoId, codigoAdmin: body.codigoAdmin });
  if (bloqueioSite) return erro(res, 403, bloqueioSite);
  // Sem saldo, só a IA fica bloqueada. As tarefas gratuitas (leituras do wol.jw.org, do S-34 e da Bíblia, a pesquisa na biblioteca, o
  // backup e buscar o resultado de um pedido já cobrado) continuam funcionando. A lista do estudo confere o saldo só se precisar da IA.
  const semCredito = () => mensagemSeSemCredito({ aparelhoId: body.aparelhoId, codigoAdmin: body.codigoAdmin });
  const gratuita = TAREFAS_SEM_IA.has(tarefa) || TAREFAS_GRATUITAS.has(tarefa) || (typeof tarefa === "string" && /^backup-/.test(tarefa));
  const bloqueioCredito = gratuita ? null : await semCredito();
  if (bloqueioCredito) return erro(res, 403, bloqueioCredito);

  // Resultado de um pedido demorado cuja conexão caiu (ver api/_pedidos.mjs): o id aleatório de 36 caracteres é a própria chave.
  if (tarefa === "pedido-resultado" || tarefa === "pedido-apagar") {
    if (!idDePedidoValido(body.pedidoId) || !pedidosDisponiveis()) return erro(res, 400, "Pedido inválido.");
    if (tarefa === "pedido-apagar") {
      await apagarResultado(body.pedidoId);
      return res.status(200).json({ apagado: true });
    }
    const guardado = await lerResultado(body.pedidoId);
    if (!guardado) return res.status(200).json({ pronto: false });
    return res.status(200).json({ pronto: true, status: guardado.status, resposta: guardado.dados });
  }

  // Pedidos demorados (esboços e Preparar para dirigir) com pedidoId: a resposta também é guardada ANTES de ser enviada, para o app
  // recuperá-la se a conexão cair no meio (a função só termina depois de enviar, então a gravação não se perde).
  if ((TAREFAS_DE_ESBOCOS.has(tarefa) || tarefa === "pesquisa" || tarefa === "pesquisa-video" || tarefa === "adoracao-familia") && idDePedidoValido(body.pedidoId) && pedidosDisponiveis()) {
    const enviar = res.json.bind(res);
    res.json = (dados) => {
      guardarResultado(body.pedidoId, res.statusCode || 200, dados)
        .catch((e) => console.error("Pedidos: não guardei o resultado", tarefa, e && e.message))
        .finally(() => enviar(dados));
      return res;
    };
  }

  // Rodapé dos esboços: o modelo que elaborou e o tempo no servidor (vai na resposta e, com ela, no resultado guardado acima).
  if (["tesouros", "discurso", "publico", "publico-importar", "outros"].includes(tarefa)) {
    const inicio = Date.now();
    const enviarComRodape = res.json.bind(res);
    res.json = (dados) => {
      const contexto = contextoDoPedido.getStore();
      if (dados && dados.esboco && (res.statusCode || 200) < 400 && contexto && contexto.modeloIa) {
        const modelo = MODELOS_IA.find((m) => m.id === contexto.modeloIa);
        dados = { ...dados, rodapeIa: { modelo: modelo ? modelo.nome.split(":")[0] : contexto.modeloIa, segundos: Math.round((Date.now() - inicio) / 1000) } };
      }
      return enviarComRodape(dados);
    };
  }

  if (typeof tarefa === "string" && /^backup-/.test(tarefa) && !exigirAcesso(res, body)) return;
  if (tarefa === "backup-campos") return lerCamposDosDocumentos(req, res);
  if (tarefa === "backup-semanas") return lerSemanasDosDocumentos(req, res);
  if (tarefa === "backup-semana") return lerPublicacoesDaSemana(req, res);

  // Leituras (wol.jw.org, S-34, Bíblia): código de acesso e o limite de consultas, sem chave nem cota da IA.
  if (TAREFAS_SEM_IA.has(tarefa)) {
    if (!exigirAcesso(res, body)) return;
    if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
    if (tarefa === "ebc-ler") return lerEbc(res, body);
    if (tarefa === "consideracao-ler") return lerParteDaSemana(res, body, PARTES_APOSTILA.consideracao);
    if (tarefa === "nvc-ler") return lerParteDaSemana(res, body, PARTES_APOSTILA.nvc);
    if (tarefa === "tesouros-ler") return lerTesourosDaSemana(res, body);
    if (tarefa === "publico-lista") return listarTemasPublicos(res, body);
    if (tarefa === "publico-ler") return lerTemaPublico(res, body);
    if (tarefa === "publico-esboco") return verEsbocoPublico(res, body);
    if (tarefa === "versiculos") return textosDosVersiculos(res, body);
    if (tarefa === "anotacoes-versiculos") return textosDosVersiculosAnotacoes(res, body);
    if (tarefa === "pesquisa-versiculos") return textosDosVersiculosAnotacoes(res, body); // Assistente de pesquisas, aba Texto bíblico (código de pesquisa)
    if (tarefa === "pesquisa-videos-secoes") return secoesDeVideos(res); // Assistente de pesquisas, aba Vídeo: as seções do catálogo
    if (tarefa === "pesquisa-videos-da-secao") return videosDaSecaoParaLista(res, body); // aba Vídeo: os vídeos de uma seção, para escolher um direto
    if (tarefa === "programa-pub") return lerProgramaPub(res, body);
    if (tarefa === "programas-lista") return listaDeProgramas(res, body);
    if (tarefa === "anotacoes-partes-semana") return partesDaSemanaParaAnotacoes(res, body);
    if (tarefa === "outros-pesquisar") return pesquisarOutros(res, body);
    if (tarefa === "outros-ler") return lerOutros(res, body);
    if (tarefa === "discurso-ler") return lerDiscursoCurtoDaSemana(res, body);
    if (tarefa === "joias-ler") return lerJoiasDaSemana(res, body);
    if (tarefa === "apostila-imagens") return lerImagensDaApostilaSemana(res, body);
  }

  if (tarefa === "estudo-paragrafos") {
    if (!exigirAcesso(res, body)) return;
    if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
    return textoDosParagrafosDoEstudo(res, body);
  }

  // Lista da Sentinela: leitura no site primeiro (sem IA). Só se falhar é que a IA lê a página.
  if (tarefa === "estudo-lista") {
    if (!exigirAcesso(res, body)) return;
    if (excedeuLimiteBackup(ip)) return erro(res, 429, "Muitas consultas. Tente novamente em alguns minutos.");
    if (await tentarListaNoSite(res, body)) return;
    const semSaldo = await semCredito(); // a leitura direta falhou: daqui em diante é a IA, que pede saldo
    if (semSaldo) return erro(res, 403, semSaldo);
    if (!(await iaDisponivel())) {
      return erro(res, 503, "Não consegui ler o artigo no wol.jw.org agora, e o recurso de IA ainda não está configurado para tentar de outro jeito.");
    }
    const Plista = await carregarPromptsEIa();
    if (excedeuLimite(ip, Plista.limites.limitePorHora)) {
      return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
    }
    return listarParagrafos(res, body, Plista);
  }

  if (!(await iaDisponivel())) {
    return erro(res, 503, erroSemIa());
  }

  // Prompts e limites atuais (padrão do código + edições do administrador, guardadas no Global Config).
  // Mais o modelo e o esforço da IA escolhidos pelo administrador (P.ia).
  const P = await carregarPromptsEIa(tarefa);

  if (excedeuLimite(ip, P.limites.limitePorHora)) {
    return erro(res, 429, "Muitas solicitações. Tente novamente em alguns minutos.");
  }

  if (!exigirAcesso(res, body)) return;
  if (tarefa === "estudo") return responderEstudo(res, body, P);
  if (tarefa === "estudo-recap") return responderEstudo(res, { ...body, paragrafos: "recapitulação" }, P, { dirigente: true });
  if (tarefa === "estudo-perguntas") return sugerirPerguntas(res, body, P);
  if (tarefa === "texto-diario-comentarios") return comentariosDoTextoDiario(res, body, P);
  if (tarefa === "anotacoes-formatar") return formatarAnotacoes(res, body, P);
  if (tarefa === "anotacoes-perguntas") return atribuirPerguntas(res, body, P);
  if (tarefa === "ebc") return responderEbc(res, body, P);
  if (tarefa === "consideracao" || tarefa === "nvc") return responderParte(res, body, P, tarefa);
  if (tarefa === "nvc-transcricao") return formatarTranscricaoVideo(res, body, P);
  if (tarefa === "pesquisa-coletar") return coletarPesquisa(res, body, P);
  if (tarefa === "pesquisa") return responderPesquisa(res, body, P);
  if (tarefa === "adoracao-familia") return responderAdoracaoFamilia(res, body, P); // Adoração em Família (código de pesquisa)
  if (tarefa === "pesquisa-video") return pesquisarVideo(res, body, P);
  if (tarefa === "pesquisa-videos") return sugerirVideos(res, body, P);
  if (tarefa === "ebc-dirigente") return perguntasEbcDirigente(res, body, P);
  if (tarefa === "tesouros") return esbocoDeTesouros(res, body, P);
  if (tarefa === "publico") return esbocoDoDiscursoPublico(res, body, P);
  if (tarefa === "publico-importar") return esbocoImportadoDoPublico(res, body, P);
  if (tarefa === "publico-canticos") return canticosDoPublico(res, body, P);
  if (tarefa === "outros") return esbocoDeOutros(res, body, P);
  if (tarefa === "discurso") return esbocoDoDiscursoCurto(res, body, P);
  if (tarefa === "joias") return responderJoias(res, body, P);
  if (tarefa === "leitura-biblia") return resumirLeituraBiblia(res, body, P);
  if (tarefa === "biblia-texto") return textoDoCapituloBiblia(res, body);

  const entrada = validarEntrada(req.body, P.limites);
  if (!entrada) {
    const sentinela = req.body && req.body.tarefa === "sentinela";
    return erro(
      res,
      400,
      `Texto inválido ou grande demais (máximo ${sentinela ? P.limites.maxCharsSentinela : P.limites.maxCharsFormatacao} caracteres e ${sentinela ? P.limites.maxLinhasSentinela : P.limites.maxLinhasFormatacao} linhas).`
    );
  }

  if (entrada.tarefa === "sentinela") return responderSentinela(res, entrada, P);

  const { linhas, modelos, opcoes, modo, ajuste, anteriores } = entrada;
  // Modelos que acrescentam aspas (ex.: ❝{texto}❞) só entram se o usuário pedir aspas.
  const permiteAspas = /aspas/i.test(`${opcoes.instrucao} ${ajuste}`);
  const modelosUsaveis = permiteAspas ? modelos : modelos.filter((m) => !TEM_ASPAS.test(m.conteudo));
  const idsValidos = new Set(modelosUsaveis.map((m) => m.id));
  // Com orientação do usuário (campo do pedido ou instruções fixas) ela manda: o que ela pedir vale mesmo com a opção
  // desmarcada (a IA só usa um recurso desmarcado se a orientação pedir). Sem orientação, valem só as opções marcadas.
  const livre = Boolean(ajuste || opcoes.instrucao);
  const falaDePerguntas = /pergunta/i.test(`${ajuste} ${opcoes.instrucao}`);
  const efetivas = livre
    ? { ...opcoes, usarModelos: true, emoji: true, negrito: true, italico: true, negritoItalico: true, maiusculas: true, usarListas: true, separarIdeias: true }
    : opcoes;
  const estilosPermitidos = new Set([
    ...(efetivas.negrito ? ["negrito"] : []),
    ...(efetivas.italico ? ["italico"] : []),
    ...(efetivas.negritoItalico ? ["negrito_italico"] : []),
  ]);

  let mensagem =
    blocoOrientacao(opcoes, ajuste, P) +
    "PREFERÊNCIAS DO USUÁRIO:\n" +
    descreverPreferencias(opcoes, P) +
    (consultaPedida(opcoes) ? descreverFontes(opcoes, P, true) : "") +
    "\n\nMODELOS DISPONÍVEIS:\n" +
    (modelosUsaveis.length
      ? modelosUsaveis.map((m) => `- id=${m.id} | nome=${m.nome} | conteúdo=${m.conteudo}`).join("\n")
      : "(nenhum)") +
    "\n\nLINHAS DO TEXTO:\n" +
    linhas.map((l, i) => `[${i}] ${l}`).join("\n") +
    lembreteFinal(opcoes, ajuste, P);

  if (modo && anteriores) {
    mensagem +=
      "\n\nSUGESTÕES ANTERIORES (JSON):\n" +
      anteriores +
      "\n\n" +
      P.frases.pedidos[modo === "nova" ? "Formatação: outra sugestão" : "Formatação: melhorar"];
  }

  // As caixas dos textos bíblicos (transcrever, só citar, explicar e aplicar) valem para o texto e para o resumo.
  if (consultaPedida(opcoes) && !fontesConfiguradas()) return erro(res, 503, "A consulta às fontes ainda não está configurada no servidor.");
  precarregarFontes({ biblia: opcoes.consultarBiblia, perspicaz: opcoes.consultarPerspicaz });

  try {
    const client = criarClienteIa({ maxRetries: 1, timeout: tempoIa(P, entrada.longo ? 110_000 : 60_000) });
    const resposta = await chamarIa(
      client,
      P,
      { max_tokens: entrada.longo ? 16000 : opcoes.intensidade === "muitas" ? 10000 : 6000, system: P.sistemaFormatacao, messages: [{ role: "user", content: mensagem }] },
      { schema: Saida, semPensar: true, tarefa: "formatar" }
    );

    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return erro(res, 502, "A IA não conseguiu gerar sugestões para este texto.");
    }
    const saida = resposta.parsed_output;

    // A IA recebe as preferências por texto, mas o servidor também as impõe: o que o usuário
    // desmarcou é descartado aqui, mesmo que o modelo tenha sugerido.
    const vistas = new Set();
    const modeloDoGrupo = new Map();
    const sugestoes = [];
    for (const s of saida.sugestoes) {
      if (s.linha < 0 || s.linha >= linhas.length || vistas.has(s.linha)) continue;

      const linha = linhas[s.linha];
      let modeloId = efetivas.usarModelos && s.modeloId && idsValidos.has(s.modeloId) ? s.modeloId : null;
      // Regra fixa: modelo de PERGUNTA só em linha que pergunta (tem "?"); uma citação bíblica, por exemplo, não é pergunta.
      // Só vale outra coisa se o próprio usuário falar de perguntas na orientação.
      if (modeloId && !falaDePerguntas && ehModeloDePergunta(modelosUsaveis.find((m) => m.id === modeloId)) && !linha.includes("?")) modeloId = null;
      const emoji = efetivas.emoji ? limparEmoji(s.emoji) : null;

      const destaques = sanearDestaques(s.destaques, linha, efetivas, estilosPermitidos, P.limites.maxDestaques);

      let lista = efetivas.usarListas ? sanearLista(s.lista) : null;
      if (lista) {
        if (!modeloDoGrupo.has(lista.grupo)) modeloDoGrupo.set(lista.grupo, lista.modelo);
        lista = { modelo: modeloDoGrupo.get(lista.grupo), grupo: lista.grupo };
      }
      const quebras = efetivas.separarIdeias ? sanearQuebras(s.quebras, linha) : [];
      const espacoAntes = efetivas.separarIdeias && s.espacoAntes === true && s.linha > 0;

      if (!modeloId && !emoji && !destaques.length && !lista && !quebras.length && !espacoAntes) continue;

      vistas.add(s.linha);
      sugestoes.push({
        linha: s.linha,
        modeloId,
        emoji,
        destaques,
        lista,
        quebras,
        espacoAntes,
        motivo: "",
      });
    }

    // Frase a frase: o servidor calcula as quebras de todas as linhas (a IA costuma separar só por ideia ou esquecer linhas).
    if (modoSeparacao(opcoes, ajuste) === "frases") {
      linhas.forEach((linha, indice) => {
        const quebras = inicioDeFrases(linha);
        if (!quebras.length) return;
        const existente = sugestoes.find((x) => x.linha === indice);
        if (existente) existente.quebras = quebras;
        else {
          sugestoes.push({ linha: indice, modeloId: null, emoji: null, destaques: [], lista: null, quebras, espacoAntes: false, motivo: "Frases separadas por linha em branco" });
        }
      });
      sugestoes.sort((a, b) => a.linha - b.linha);
    }

    const resumo =
      opcoes.resumo && typeof saida.resumo === "string" ? limparTextoGerado(saida.resumo, P.limites.maxCharsResumo) || null : null;

    // Resumo, versículos e Perspicaz são independentes: cada um aparece só se foi pedido. O versículo vem do arquivo da
    // Bíblia; a aplicação (e a explicação do Perspicaz) é escrita para o resumo, ou para o texto quando não há resumo.
    const fonte = {
      contexto: resumo || linhas.join("\n"),
      referencias: [],
      relevantes: listaDeTextos(saida.textosRelevantes, P.limites.maxTextos),
      verbetes: listaDeTextos(saida.verbetes, 2),
    };
    const memoriaUsada = memoriaUsadaAgora();
    if (consultaPedida(opcoes)) await completarFontes([fonte], opcoes, P, blocoOrientacao(opcoes, ajuste, P));
    const textos = fonte.textos || [];
    const perspicaz = fonte.perspicaz || null;

    return res.status(200).json({ resumo, sugestoes, textos, perspicaz, memoriaUsada });
  } catch (e) {
    return tratarErro(e, res);
  }
}
