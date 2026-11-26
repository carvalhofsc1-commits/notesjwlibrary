// Adoração em Família compartilhada (6.11.47): quem preparou a programação (o dirigente) cria uma sessão e passa o código aos
// participantes; o dirigente libera as partes, sorteia quem responde e revela as respostas dos jogos, e todos acompanham ao vivo
// (o app consulta o estado a cada poucos segundos; sem WebSocket, porque o Cloud Run escala para zero e pode ter várias instâncias).
//
// Ações (POST, campo "acao"): criar · entrar · estado · liberar · bloquear · sortear · revelar · passar-direcao · assumir · encerrar.
// Arquivos em familia-sessoes/<CODIGO>/ (api/_blob.mjs):
//  - programa.json      a programação SEM as respostas dos jogos (não muda depois de criada);
//  - respostas.json     só o servidor lê: as respostas e as referências das rodadas dos jogos (6.12.76), o hash (SHA-256) das chaves do
//                       dirigente e os extras dele (preparação, tarefas, dica, a ordem certa do "Ordem e data");
//  - estado.json        partes liberadas, sorteio, respostas (e referências) reveladas, respostas enviadas, pontos e o número da versão
//                       (gravado só se não mudou desde a leitura: ACOES_QUE_GRAVAM);
//  - participantes/<id>.json  um arquivo por participante (ninguém grava no arquivo do outro).
// A chave do dirigente nunca é guardada em texto; a sessão vence depois de 48 horas sem uso e é apagada na próxima vez que alguém
// tenta abri-la (ou quando outra sessão é criada).
import { createHash, randomBytes, randomInt } from "node:crypto";
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { blobConfigurado, del, ehConflito, get, list, put } from "./_blob.mjs";
import { estadoAcessoSite, mensagemSeBloqueado, prepararCodigosPessoais, recursoCodigoValido } from "./_acessoSite.mjs";
import { lerArtigoDoWol, lerTextoDoVideo, pesquisarNoWol, playerDoVideo, videoDoEndereco } from "./_wol.mjs";
import { lerCanticos } from "./_fontes.mjs";
import { respostaConfere } from "./_familiaGeracao.mjs";

const PASTA = "familia-sessoes/";
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0/O e 1/I/L, que se confundem
const TAM_CODIGO = 6;
const TAM_CODIGO_DIRIGENTE = 8;
const VALIDADE_MS = 48 * 60 * 60 * 1000;
const VALIDADE_DIRECAO_MS = 15 * 60 * 1000; // o código para passar a direção vale 15 minutos e uma vez só
const MAX_PROGRAMA = 200_000; // caracteres do JSON da programação recebida
const MAX_NOME = 40;
const MAX_PARTICIPANTES = 20;
const MAX_NOMES = 20; // nomes informados pelo dirigente (família e convidados)
const MAX_CHAVES = 5; // aparelhos que podem dirigir a mesma sessão (o criador e os que assumiram)
const LIMPEZA_POR_VEZ = 20;

// Tentativas erradas (código de sessão inexistente, chave ou código do dirigente errados), em memória, por instância. 6.14.16: contam por
// aparelho (10 por hora), para os erros de um não bloquearem os outros no mesmo Wi-Fi; a rede toda (o IP) só é bloqueada com muitas (60).
const erros = new Map();
const MAX_ERROS_POR_HORA = 10;
const MAX_ERROS_DA_REDE_POR_HORA = 60;
const chavesDeErro = ({ ip, aparelho }) => [[`${ip}|${aparelho}`, MAX_ERROS_POR_HORA], [ip, MAX_ERROS_DA_REDE_POR_HORA]];
function bloqueado(pedinte) {
  const agora = Date.now();
  return chavesDeErro(pedinte).some(([chave, maximo]) => {
    const lista = (erros.get(chave) || []).filter((t) => agora - t < 60 * 60 * 1000);
    if (lista.length) erros.set(chave, lista);
    else erros.delete(chave);
    return lista.length >= maximo;
  });
}
function registrarErro(pedinte) {
  for (const [chave] of chavesDeErro(pedinte)) erros.set(chave, [...(erros.get(chave) || []), Date.now()]);
  if (erros.size > 5000) erros.clear();
}

// ---------- Utilidades ----------
const hash = (texto) => createHash("sha256").update(String(texto)).digest("hex");
const gerarCodigo = (n) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const codigoLimpo = (v, n = TAM_CODIGO) => {
  const c = String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return c.length === n && [...c].every((ch) => ALFABETO.includes(ch)) ? c : "";
};
const idLimpo = (v) => (/^[A-Za-z0-9_-]{8,40}$/.test(String(v || "")) ? String(v) : "");
// Texto de uma linha (ou de várias, com quebras), sem caracteres de controle, cortado no limite.
const texto = (v, max = 2000) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const nomeLimpo = (v) => texto(v, MAX_NOME).replace(/\s+/g, " ");
const lista = (v, max, f) => (Array.isArray(v) ? v.slice(0, max).map(f).filter((x) => x !== null && x !== "") : []);
const caminho = (cod, arquivo) => `${PASTA}${cod}/${arquivo}`;

async function lerJson(nome) {
  const r = await get(nome);
  if (!r || !r.stream) return null;
  try {
    return JSON.parse(Buffer.from(r.stream).toString("utf8"));
  } catch {
    return null;
  }
}
const gravarJson = (nome, dados) => put(nome, JSON.stringify(dados), { contentType: "application/json; charset=utf-8" });

async function apagarSessao(cod) {
  const { blobs } = await list({ prefix: `${PASTA}${cod}/` });
  if (blobs.length) await del(blobs.map((b) => b.pathname));
}

// Apaga as sessões vencidas (até LIMPEZA_POR_VEZ por vez): a data de uso é a do arquivo mais novo da pasta.
async function limparVencidas() {
  const { blobs } = await list({ prefix: PASTA });
  const ultimo = new Map();
  for (const b of blobs) {
    const cod = b.pathname.slice(PASTA.length).split("/")[0];
    const t = new Date(b.uploadedAt).getTime() || 0;
    if (t > (ultimo.get(cod) || 0)) ultimo.set(cod, t);
  }
  const agora = Date.now();
  const vencidas = [...ultimo].filter(([, t]) => agora - t > VALIDADE_MS).slice(0, LIMPEZA_POR_VEZ).map(([cod]) => cod);
  for (const cod of vencidas) await apagarSessao(cod);
  return { codigos: new Set(ultimo.keys()), apagadas: vencidas.length };
}

// 6.14.16: várias pessoas jogando ao mesmo tempo. O estado.json é um arquivo só: quem vai mudá-lo lê a versão dele e só grava se ela não
// mudou (gravarEstadoLido); se outro pedido gravou no meio, a ação inteira é refeita com o estado novo (e as conferências valem de novo:
// "fulano já respondeu"). Dentro da instância, as ações que gravam de uma mesma sessão também esperam a vez.
const versoesDoEstado = new WeakMap();
const gravarEstadoLido = (cod, estado) => put(caminho(cod, "estado.json"), JSON.stringify(estado), { contentType: "application/json; charset=utf-8", seVersao: versoesDoEstado.get(estado) });
const ACOES_QUE_GRAVAM = new Set(["responder", "voltar-inicio", "liberar", "bloquear", "revelar", "revelar-ordem", "espiar", "dica", "modo-dicas", "sortear-dica", "pontuar", "reiniciar", "novo-jogo", "sortear", "limpar-sorteio", "sortear-questao", "julgar", "julgamento-ia", "foco", "cronometro", "assumir", "passar-direcao", "enviar-ordem"]);
const TENTATIVAS_DE_GRAVAR = 12;
const filasDasSessoes = new Map();
function naVezDaSessao(cod, tarefa) {
  const proxima = (filasDasSessoes.get(cod) || Promise.resolve()).then(tarefa, tarefa);
  const fim = proxima.catch(() => {}).then(() => { if (filasDasSessoes.get(cod) === fim) filasDasSessoes.delete(cod); });
  filasDasSessoes.set(cod, fim);
  return proxima;
}

// 6.14.18: no "Quem sou eu?", cada questão já abre com a 1ª dica (ela conta como dada: a questão começa valendo o máximo). "so" limita a
// uma questão ({ parte, rodada }, no reiniciar) ou a uma parte ({ parte }).
function abrirComPrimeiraDica(e, programa, so = null) {
  (programa && Array.isArray(programa.partes) ? programa.partes : []).forEach((p, parte) => {
    const jogo = p && p.jogo;
    if (!jogo || (so && so.parte !== parte) || !(jogo.idTipo === "quem_sou_eu" || /quem sou eu/i.test(String(jogo.tipo || "")))) return;
    (jogo.rodadas || []).forEach((r, rodada) => {
      if ((so && so.rodada !== undefined && so.rodada !== rodada) || !/Dica\s*1\s*:/i.test(String((r && r.pergunta) || ""))) return;
      e.dicas = { ...(e.dicas || {}) };
      e.dicas[parte] = { ...(e.dicas[parte] || {}), [rodada]: Math.max(1, Number((e.dicas[parte] || {})[rodada]) || 0) };
    });
  });
}

// O estado da sessão, ou null se ela não existe ou venceu (e então é apagada). comVersao: para quem vai gravar.
async function lerEstado(cod, comVersao = false) {
  const lido = await get(caminho(cod, "estado.json"), { comVersao });
  let estado = null;
  try {
    estado = lido && lido.stream ? JSON.parse(Buffer.from(lido.stream).toString("utf8")) : null;
  } catch {
    estado = null;
  }
  if (!estado) return null;
  if (comVersao) versoesDoEstado.set(estado, lido.versao);
  if (Date.now() - (Number(estado.atualizadoEm) || 0) > VALIDADE_MS) {
    // O estado parado não basta: alguém pode ter entrado depois (os participantes gravam só o próprio arquivo).
    const { blobs } = await list({ prefix: `${PASTA}${cod}/` });
    const recente = Math.max(0, ...blobs.map((b) => new Date(b.uploadedAt).getTime() || 0));
    if (Date.now() - recente > VALIDADE_MS) {
      await apagarSessao(cod);
      return null;
    }
  }
  return estado;
}

async function lerParticipantes(cod) {
  const { blobs } = await list({ prefix: `${PASTA}${cod}/participantes/` });
  const itens = await Promise.all(blobs.map((b) => lerJson(b.pathname)));
  return itens.filter((p) => p && p.id && p.nome).sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0)).map((p) => ({ id: p.id, nome: p.nome, vistoEm: p.vistoEm || p.entrouEm || 0 }));
}
// 6.13.31: quem está na adoração agora (painel "Quem está participando", visível para todos): só o nome, sem o id, e só quem deu sinal nos
// últimos PRESENCA_MS (o app manda o sinal a cada consulta; o arquivo do participante é regravado no máximo a cada SINAL_MS).
const PRESENCA_MS = 150_000;
const SINAL_MS = 60_000;
const presentes = (lista) => lista.filter((p) => Date.now() - (p.vistoEm || 0) <= PRESENCA_MS).map((p) => ({ nome: p.nome }));
async function contarParticipantes(cod) {
  const { blobs } = await list({ prefix: `${PASTA}${cod}/participantes/` });
  return blobs.length;
}

// O que vai para todos (nunca as respostas que ainda não foram reveladas: essas nem estão no estado).
function estadoPublico(e) {
  return {
    liberadas: Array.isArray(e.liberadas) ? e.liberadas : [],
    atual: Number.isInteger(e.atual) ? e.atual : null,
    reveladas: e.reveladas && typeof e.reveladas === "object" ? e.reveladas : {},
    // 6.12.76: a referência das rodadas reveladas ({ parte: { rodada: "Livro c:v" } }); antes da revelação ela fica só em respostas.json.
    referenciasReveladas: e.referenciasReveladas && typeof e.referenciasReveladas === "object" ? e.referenciasReveladas : {},
    dicas: e.dicas && typeof e.dicas === "object" ? e.dicas : {}, // quantas dicas de cada rodada já foram dadas: { parte: { rodada: n } }
    acertos: e.acertos && typeof e.acertos === "object" ? e.acertos : {}, // quem acertou cada rodada e quantos pontos ganhou: { parte: { rodada: { nome, pts } } }
    // 6.12.77: a ordem certa do "Ordem e data" já revelada ({ parte: { rodada: [{ data, evento }] } }); antes disso ela fica só em respostas.json.
    ordensReveladas: e.ordensReveladas && typeof e.ordensReveladas === "object" ? e.ordensReveladas : {},
    // 6.14.21: em grupo, quem já enviou a sua ordem e quantos acertou ({ parte: { rodada: [{ nome, certos, total, certa }] } }), sem a ordem enviada
    ordensEnviadas: e.ordensEnviadas && typeof e.ordensEnviadas === "object" ? e.ordensEnviadas : {},
    sorteio: e.sorteio || null,
    sorteioQuestao: e.sorteioQuestao || null, // { parte, rodada, n }: a questão sorteada para ser respondida
    cronometro: e.cronometro || null,
    // 6.13.17: as respostas que os participantes enviaram pelo app ({ parte: { rodada: { nome, texto, em, status: "pendente" | "certa" } } }) e as
    // julgadas erradas ({ parte: { rodada: [{ nome, texto }] } }).
    envios: e.envios && typeof e.envios === "object" ? e.envios : {},
    erradas: e.erradas && typeof e.erradas === "object" ? e.erradas : {},
    // 6.13.28: quem viu a resposta de uma questão em "Ver só para mim" (o presidente da reunião que também joga) não responde mais a ela
    // ({ parte: { rodada: [nome] } }).
    espiaram: e.espiaram && typeof e.espiaram === "object" ? e.espiaram : {},
    // 6.13.46: Perfil bíblico com dicas sorteadas: a ordem em que as dicas saíram ({ parte: { rodada: [índices] } }) e as partes em modo sorteio ({ parte: true }).
    dicasOrdem: e.dicasOrdem && typeof e.dicasOrdem === "object" ? e.dicasOrdem : {},
    sorteioDicas: e.sorteioDicas && typeof e.sorteioDicas === "object" ? e.sorteioDicas : {},
    // 6.14.00: a questão em foco que quem administra o jogo escolheu para todos ({ parte: { rodada, n } }; n muda a cada escolha)
    foco: e.foco && typeof e.foco === "object" ? e.foco : {},
    // 6.14.15: quantas vezes o jogo desta sessão foi trocado por um novo (o aparelho recarrega as perguntas quando muda)
    programaN: Number(e.programaN) || 0,
  };
}
// O dirigente recebe também a lista de quem entrou; a versão dele inclui a quantidade de participantes (muda quando alguém entra).
const versaoDe = (e, qtd) => (qtd == null ? String(e.versao || 0) : `${e.versao || 0}.${qtd}`);

// 6.12.02: leitura em voz alta (Google) para quem está numa adoração compartilhada. api/voz.mjs (uso "familia") chama esta função:
// vale só para a sessão que existe e só para o texto que a própria programação tem (as perguntas) ou a palavra "Pergunta".
// Quem tem o código da adoração não precisa de código de leitura nem gasta créditos: o custo é do app.
export async function textoDaSessaoParaLer(codigo, texto, origem = null) {
  const cod = codigoLimpo(codigo);
  if (!cod || !blobConfigurado()) return false;
  const lido = String(texto || "").trim();
  if (!lido) return false;
  if (/^pergunta[.,!]?$/i.test(lido)) return Boolean(await lerEstado(cod));
  const [estado, programa] = await Promise.all([lerEstado(cod), lerJson(caminho(cod, "programa.json"))]);
  if (!estado || !programa || !Array.isArray(programa.partes)) return false;
  // 6.12.86: também a matéria da atividade (título, referência da publicação e parágrafos/subtítulos do trecho), lida de um pedaço por vez.
  const daLeitura = (p) => {
    const l = p && p.leitura;
    if (!l || typeof l !== "object") return false;
    const linhas = String(l.texto || "").split(/\r?\n/).map((x) => x.replace(/^#{1,2}\s+/, "").replace(/\*\*/g, "").trim());
    return [String(l.titulo || "").trim(), String(l.fonte || "").trim(), ...linhas].includes(lido.replace(/^#{1,2}\s+/, ""));
  };
  if (programa.partes.some((p) => p && ((Array.isArray(p.perguntas) && p.perguntas.some((q) => String(q).trim() === lido)) || daLeitura(p)))) return true;
  // 6.12.88: textos que o servidor abre sob demanda (matéria na tela, transcrição do vídeo, letra do cântico): o pedaço lido tem de estar no texto
  // que a programação aponta (parte, tipo e posição vêm em "origem").
  const o = origem && typeof origem === "object" ? origem : null;
  if (!o || lido.length > 2500) return false;
  const parte = Number(o.parte);
  const indice = Number(o.indice);
  const p = Number.isInteger(parte) && Number.isInteger(indice) ? programa.partes[parte] : null;
  if (!p) return false;
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
  let fonte = "";
  try {
    if (o.tipo === "video") {
      const v = (p.videos || [])[indice];
      fonte = v && v.link ? (await dadosDoVideo(v.link))?.texto : "";
    } else if (o.tipo === "cantico") {
      const c = (p.canticos || [])[indice];
      fonte = c ? (await dadosDoCantico(c.numero))?.texto : "";
    } else if (o.tipo === "materia") {
      const pub = (p.publicacoes || [])[indice];
      const artigo = pub ? await lerMateriaDaPublicacao(pub) : null;
      fonte = artigo ? `${artigo.titulo}\n${artigo.texto}`.replace(/^##\s+/gm, "") : "";
    }
  } catch {
    return false;
  }
  const alvo = norm(lido.replace(/^##\s+/gm, ""));
  return Boolean(alvo) && norm(fonte).includes(alvo);
}

// 6.13.60: a chave de quem administra o jogo vale para esta sessão? (api/transcrever.mjs, "trecho-jogo": a resposta falada de quem administra
// o jogo ou joga sozinho não pede código de texto nem gasta créditos: o custo é do app.)
export async function chaveDeDirigenteValida(sessao, chave) {
  const cod = codigoLimpo(sessao);
  if (!cod || !blobConfigurado() || typeof chave !== "string" || chave.length < 20 || chave.length > 100) return false;
  const [estado, segredo] = await Promise.all([lerEstado(cod), lerJson(caminho(cod, "respostas.json"))]);
  if (!estado || !segredo || !Array.isArray(segredo.chaves)) return false;
  const h = hash(chave);
  return segredo.chaves.some((c) => textosIguais(h, c));
}

// 6.13.60: "🤖 Apelar para a IA": quem dirige (administrador do jogo ou quem joga sozinho) pede à IA que julgue de novo uma resposta que ficou
// como errada. api/sugerir-formatacao.mjs (fase "apelar") chama esta função: confere a chave de quem dirige e devolve a pergunta, a resposta
// esperada (com a referência) e a resposta dada, que ficam só no servidor. Devolve { erro: [status, mensagem] } ou os dados.
export async function dadosDaApelacao(corpo) {
  const cod = codigoLimpo(corpo && corpo.sessao);
  if (!cod || !blobConfigurado()) return { erro: [400, "Código do jogo inválido."] };
  const chave = corpo.chave;
  if (typeof chave !== "string" || chave.length < 20 || chave.length > 100) return { erro: [403, "Só quem administra o jogo pode apelar para a IA."] };
  const [estado, programa, segredo] = await Promise.all([lerEstado(cod), lerJson(caminho(cod, "programa.json")), lerJson(caminho(cod, "respostas.json"))]);
  if (!estado || !programa || !segredo) return { erro: [404, "Não encontrei este jogo (ou ele já terminou)."] };
  const h = hash(chave);
  if (!Array.isArray(segredo.chaves) || !segredo.chaves.some((c) => textosIguais(h, c))) return { erro: [403, "Só quem administra o jogo pode apelar para a IA."] };
  const parte = Number(corpo.parte);
  const rodada = Number(corpo.rodada);
  const indice = Number(corpo.indice);
  const jogo = Number.isInteger(parte) && programa.partes && programa.partes[parte] && programa.partes[parte].jogo;
  const r = jogo && Number.isInteger(rodada) ? (jogo.rodadas || [])[rodada] : null;
  if (!r) return { erro: [400, "Questão inválida."] };
  if (jogo.idTipo === "verdadeiro_falso") return { erro: [400, "No Verdadeiro ou falso só há duas respostas: não há o que apelar."] };
  if (((estado.reveladas || {})[parte] || {})[rodada] || ((estado.acertos || {})[parte] || {})[rodada]) return { erro: [409, "Esta questão já foi respondida."] };
  const item = (((estado.erradas || {})[parte] || {})[rodada] || [])[indice];
  if (!item) return { erro: [400, "Não encontrei essa resposta errada."] };
  if (item.ia) return { erro: [409, "A IA já julgou esta resposta."] };
  const certa = String((((segredo.respostas || {})[parte] || [])[rodada]) || "");
  if (!certa) return { erro: [400, "Esta questão não tem resposta para comparar."] };
  const referencia = String((((segredo.referencias || {})[parte] || [])[rodada]) || "");
  return { pergunta: String(r.pergunta || ""), certa, referencia, idTipo: String(jogo.idTipo || ""), tipo: String(jogo.tipo || jogo.nome || ""), nome: item.nome, texto: item.texto };
}

// O texto de uma publicação citada na parte: o endereço do wol da própria publicação ou o primeiro resultado da pesquisa pelo nome dela.
async function lerMateriaDaPublicacao(pub) {
  let url = /^https:\/\/wol\.jw\.org\/pt\/wol\/d\/r5\/lp-t\/\d{5,12}/i.test(String(pub.url || "")) ? pub.url.split("#")[0] : "";
  if (!url) {
    const achados = await pesquisarNoWol([pub.titulo, pub.fonte].filter(Boolean).join(" ").replace(/[()]/g, " "), 8000, 1).catch(() => []);
    url = achados[0] && achados[0].url ? achados[0].url : "";
  }
  const artigo = url ? await lerArtigoDoWol(url, { timeoutMs: 9000, maxCaracteres: 6000 }).catch(() => null) : null;
  return artigo && artigo.texto ? { titulo: artigo.titulo || pub.titulo, texto: artigo.texto, url: artigo.url || url } : null;
}

// ---------- Vídeo da parte: o MP4 para tocar e a transcrição (legenda publicada), guardados 6 h por vídeo ----------
const videosGuardados = new Map(); // lank -> { quando, dados }
const VALIDADE_VIDEO_MS = 6 * 60 * 60 * 1000;
export async function dadosDoVideo(link) {
  const video = videoDoEndereco(link);
  if (!video) return null;
  const guardado = videosGuardados.get(video.lank);
  if (guardado && Date.now() - guardado.quando < VALIDADE_VIDEO_MS) return guardado.dados;
  const [lido, player] = await Promise.all([
    lerTextoDoVideo(video, { timeoutMs: 12000, maxCaracteres: 30000 }).catch(() => null),
    playerDoVideo(video, { timeoutMs: 12000 }).catch(() => null),
  ]);
  if (!player && !(lido && lido.texto)) return null; // nada para mostrar: o app volta ao link do jw.org (sem guardar a falha)
  const dados = { titulo: (lido && lido.titulo) || "", mp4: player ? player.mp4 : "", poster: player ? player.poster : "", texto: lido ? lido.texto : "", fonte: lido ? lido.fonte : "" };
  videosGuardados.set(video.lank, { quando: Date.now(), dados });
  if (videosGuardados.size > 60) videosGuardados.delete(videosGuardados.keys().next().value);
  return dados;
}

// ---------- Cântico da parte (6.11.84): o vídeo do cântico (Cante de Coração para Jeová, pub sjjm) e a letra (fontes/canticos.json), guardados 6 h ----------
const canticosGuardadosVivo = new Map(); // número -> { quando, dados }
export const enderecoDoCantico = (n) => `https://www.jw.org/pt/biblioteca/videos/#pt/mediaitems/VODSJJMeetings/pub-sjjm_${n}_VIDEO`;
export async function dadosDoCantico(numero) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n < 1 || n > 400) return null;
  const guardado = canticosGuardadosVivo.get(n);
  if (guardado && Date.now() - guardado.quando < VALIDADE_VIDEO_MS) return guardado.dados;
  const video = videoDoEndereco(enderecoDoCantico(n));
  const [player, canticos] = await Promise.all([
    video ? playerDoVideo(video, { timeoutMs: 12000 }).catch(() => null) : null,
    lerCanticos().catch(() => null),
  ]);
  const c = (canticos || []).find((x) => x.numero === n);
  if (!player && !(c && c.letra)) return null;
  const dados = { titulo: c ? c.titulo : "", mp4: player ? player.mp4 : "", poster: player ? player.poster : "", texto: c ? String(c.letra) : "", fonte: c ? "letra do cântico (Cante de Coração para Jeová)" : "" };
  canticosGuardadosVivo.set(n, { quando: Date.now(), dados });
  if (canticosGuardadosVivo.size > 60) canticosGuardadosVivo.delete(canticosGuardadosVivo.keys().next().value);
  return dados;
}

// ---------- A programação recebida: só os campos conhecidos, com limites; as respostas dos jogos saem para respostas.json ----------
// 6.12.74 (programação por quadros, versao 2): cada parte pode trazer o id do quadro (quadro); a leitura, o rótulo do trecho; e o jogo "Ordem e
// data", a ordem certa (jogo.ordem: [{ data, evento }]). A ordem é resposta: vai para respostas.json (extras.ordens, só quem dirige recebe) e sai
// também do fim de "comoJogar", que é público. As programações antigas (sem esses campos) continuam iguais.
const QUADRO_VALIDO = /^[a-z_]{2,40}$/;
const ID_TIPO_VALIDO = /^[a-z_]{2,30}$/;
const SUFIXO_ORDEM_CERTA = /\s*Ordem certa \(datas do Apêndice B[\s\S]*$/;
function limparPrograma(op) {
  const respostas = {};
  const referencias = {};
  const ordens = {};
  // Só as partes válidas, antes de numerar: o índice da parte é a chave das respostas dela.
  const brutas = (Array.isArray(op.partes) ? op.partes : []).filter((p) => p && typeof p === "object").slice(0, 30);
  const partes = brutas.map((p, i) => {
    const parte = {
      nome: texto(p.nome, 120) || "Parte",
      minutos: Math.max(0, Math.min(180, Math.round(Number(p.minutos) || 0))),
      responsavel: texto(p.responsavel, 80),
      descricao: texto(p.descricao, 3000),
      textos: lista(p.textos, 12, (t) => (t && typeof t === "object" ? { referencia: texto(t.referencia, 120), texto: texto(t.texto, 2000) } : null)),
      videos: lista(p.videos, 8, (v) => (v && typeof v === "object" ? { titulo: texto(v.titulo, 200), duracao: texto(v.duracao, 20), objetivo: texto(v.objetivo, 300), link: /^https:\/\//i.test(String(v.link || "")) ? texto(v.link, 500) : "" } : null)),
      canticos: lista(p.canticos, 6, (c) => (c && Number.isInteger(Number(c.numero)) ? { numero: Number(c.numero), titulo: texto(c.titulo, 150) } : null)),
      publicacoes: lista(p.publicacoes, 8, (u) => (u && typeof u === "object" ? { titulo: texto(u.titulo, 200), fonte: texto(u.fonte, 240), url: /^https:\/\//i.test(String(u.url || "")) ? texto(u.url, 500) : "" } : null)),
      perguntas: lista(p.perguntas, 15, (q) => texto(q, 500)),
      // 6.12.88: quantas das primeiras perguntas são da leitura (vêm logo depois dela, antes dos textos bíblicos).
      perguntasLeitura: Math.max(0, Math.min(15, Math.round(Number(p.perguntasLeitura) || 0))),
      // 6.12.48: o trecho da matéria que o servidor leu no wol para a leitura da atividade.
      leitura: p.leitura && typeof p.leitura === "object" && texto(p.leitura.texto, 12000)
        ? { titulo: texto(p.leitura.titulo, 200), fonte: texto(p.leitura.fonte, 240).replace(/\s+/g, " "), primeiro: p.leitura.primeiro === true, objetivo: texto(p.leitura.objetivo, 400), paragrafos: texto(p.leitura.paragrafos, 20), texto: texto(p.leitura.texto, 12000), rotulo: texto(p.leitura.rotulo, 80), url: /^https:\/\/wol\.jw\.org\//i.test(String(p.leitura.url || "")) ? texto(p.leitura.url, 500) : "" }
        : null,
      transicao: texto(p.transicao, 600),
      jogo: null,
    };
    if (QUADRO_VALIDO.test(String(p.quadro || ""))) parte.quadro = String(p.quadro);
    const j = p.jogo;
    if (j && typeof j === "object") {
      const rodadas = lista(j.rodadas, 60, (r) => (r && typeof r === "object" && texto(r.pergunta, 1800) ? { pergunta: texto(r.pergunta, 1800), resposta: texto(r.resposta, 600), referencia: texto(r.referencia, 120) } : null));
      if (rodadas.length) respostas[i] = rodadas.map((r) => r.resposta);
      // 6.12.76: a referência de cada rodada também é resposta (no Complete o versículo e no Quem disse isso? ela entrega a resposta): vai
      // para respostas.json e só chega a todos quando quem dirige revela a rodada (estado.referenciasReveladas).
      if (rodadas.some((r) => r.referencia)) referencias[i] = rodadas.map((r) => r.referencia);
      // 6.14.21: "Ordem e data": cada rodada é uma tabela de acontecimentos (j.tabelas: [{ itens, ordem }]); os jogos preparados antes, com
      // uma ordem só, viram 1 rodada. A ordem certa de cada tabela é a resposta (respostas.json, extras.ordens).
      const eventosDaOrdem = (v) => lista(v, 12, (o) => (o && typeof o === "object" && texto(o.evento, 300) ? { data: texto(o.data, 40), evento: texto(o.evento, 300) } : null));
      const tabelas = (Array.isArray(j.tabelas) && j.tabelas.length ? j.tabelas : [{ itens: j.itens, ordem: j.ordem }])
        .slice(0, 5)
        .map((t) => ({ itens: lista(t && t.itens, 12, (x) => texto(x, 600)), ordem: eventosDaOrdem(t && t.ordem) }))
        .filter((t) => t.ordem.length >= 2 && t.itens.length === t.ordem.length);
      if (tabelas.length) {
        ordens[i] = tabelas.map((t) => t.ordem);
        respostas[i] = tabelas.map(() => "ordem");
        delete referencias[i];
      }
      parte.jogo = {
        tipo: texto(j.tipo, 120),
        nome: texto(j.nome, 160),
        comoJogar: texto(tabelas.length ? String(j.comoJogar || "").replace(SUFIXO_ORDEM_CERTA, "") : j.comoJogar, 3000),
        material: texto(j.material, 600),
        rodadas: tabelas.length ? tabelas.map((t, k) => ({ pergunta: `Ordem ${k + 1}`, itens: t.itens })) : rodadas.map((r) => ({ pergunta: r.pergunta })),
        itens: tabelas.length ? [] : lista(j.itens, 80, (t) => texto(t, 600)),
      };
      // 6.12.76: o identificador fixo do tipo do jogo (quem_sou_eu, verdadeiro_falso, ordem_data, quem_disse, complete_versiculo, abreviacoes).
      if (ID_TIPO_VALIDO.test(String(j.idTipo || ""))) parte.jogo.idTipo = String(j.idTipo);
    }
    return parte;
  });
  const programa = {
    titulo: texto(op.titulo, 200) || "Adoração em Família",
    emoji: texto(op.emoji, 8),
    resumo: texto(op.resumo, 1500),
    objetivo: texto(op.objetivo, 800),
    partes,
  };
  if (op.versao === 2) programa.versao = 2;
  // 6.13.36: jogo avulso da tela 🎲 Jogos bíblicos (uma parte só, o jogo); a tela ao vivo é a mesma, com os textos de jogo.
  if (op.modo === "jogos") programa.modo = "jogos";
  // 6.13.50: partida sozinho (só no jogo avulso): quem cria já entra jogando, e o placar mostra só a pontuação.
  if (op.modo === "jogos" && op.solo === true) programa.solo = true;
  const extras = {
    preparacao: lista(op.preparacao, 20, (t) => texto(t, 400)),
    tarefas: lista(op.tarefas, 20, (t) => (t && typeof t === "object" ? { membro: texto(t.membro, 60), tarefa: texto(t.tarefa, 300) } : null)),
    dicaParaOChefe: texto(op.dicaParaOChefe, 800),
    // 6.12.70: o FunPlayB saiu (extras.funplayb não é mais guardado; programações antigas com ele continuam sendo compartilhadas sem esse extra).
  };
  if (Object.keys(ordens).length) extras.ordens = ordens; // { índice da parte: [tabela: [{ data, evento }]] } (só quem dirige)
  return { programa, respostas, referencias, extras };
}

// 6.14.21: revela a todos a ordem certa (com as datas) de uma rodada do "Ordem e data"; a rodada conta como respondida.
function revelarOrdemDaRodada(e, parte, rodada, ordem) {
  const antes = (campo) => ((e[campo] || {})[parte]) || {};
  e.ordensReveladas = { ...(e.ordensReveladas || {}), [parte]: { ...antes("ordensReveladas"), [rodada]: ordem } };
  e.reveladas = { ...(e.reveladas || {}), [parte]: { ...antes("reveladas"), [rodada]: "ordem" } };
}

// ---------- Handler ----------
export default async function handler(req, res) {
  const corpo = req.body && typeof req.body === "object" ? req.body : {};
  const cod = codigoLimpo(corpo.sessao);
  if (!cod || !ACOES_QUE_GRAVAM.has(String(corpo.acao || ""))) return atender(req, res);
  return naVezDaSessao(cod, async () => {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await atender(req, res);
      } catch (e) {
        if (!ehConflito(e)) throw e;
        if (tentativa >= TENTATIVAS_DE_GRAVAR) return erro(res, 503, "Muita gente respondendo ao mesmo tempo. Tente de novo.");
        await new Promise((ok) => setTimeout(ok, 30 * tentativa + Math.random() * 120));
      }
    }
  });
}

async function atender(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return erro(res, 405, "Método não permitido.");
  }
  if (!origemPermitida(req.headers.origin)) return erro(res, 403, "Origem não permitida.");
  if (!blobConfigurado()) return erro(res, 503, "O armazenamento do servidor não está configurado.");

  const corpo = req.body && typeof req.body === "object" ? req.body : {};
  const acao = String(corpo.acao || "");
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "desconhecido";
  const pedinte = { ip, aparelho: idLimpo(corpo.aparelhoId) };
  if (bloqueado(pedinte)) return erro(res, 429, "Muitas tentativas erradas. Tente novamente mais tarde.");

  try {
    // ----- criar: exige o mesmo acesso da Adoração em Família (código de pesquisa ou senha de administrador) -----
    if (acao === "criar") {
      await prepararCodigosPessoais();
      const bloqueio = await mensagemSeBloqueado({ aparelhoId: corpo.aparelhoId, codigoAdmin: corpo.codigoAdmin });
      if (bloqueio) return erro(res, 403, bloqueio);
      if (!recursoCodigoValido("pesquisa", corpo.codigo, corpo.aparelhoId)) {
        registrarErro(pedinte);
        return erro(res, 403, "Código de pesquisa inválido.");
      }
      const op = corpo.programa;
      if (!op || typeof op !== "object" || !Array.isArray(op.partes) || !op.partes.length) return erro(res, 400, "Programação inválida.");
      if (JSON.stringify(op).length > MAX_PROGRAMA) return erro(res, 413, "A programação é grande demais para compartilhar.");
      const { programa, respostas, referencias, extras } = limparPrograma(op);
      if (!programa.partes.length) return erro(res, 400, "Programação sem partes.");
      const vistos = new Set();
      programa.nomes = lista(corpo.nomes, MAX_NOMES, nomeLimpo).filter((n) => !vistos.has(n.toLowerCase()) && vistos.add(n.toLowerCase()));

      const { codigos } = await limparVencidas();
      let cod = "";
      for (let i = 0; i < 20 && !cod; i++) {
        const c = gerarCodigo(TAM_CODIGO);
        if (!codigos.has(c) && !(await lerJson(caminho(c, "estado.json")))) cod = c;
      }
      if (!cod) return erro(res, 503, "Não consegui gerar um código livre. Tente de novo.");
      const chave = randomBytes(32).toString("base64url");
      const agora = Date.now();
      programa.criadoEm = agora;
      await gravarJson(caminho(cod, "respostas.json"), { chaves: [hash(chave)], respostas, referencias, extras, direcao: null });
      await gravarJson(caminho(cod, "programa.json"), programa);
      // 6.13.36: no jogo avulso o jogo (a parte 0) já começa liberado e aberto
      const jogoAvulso = programa.modo === "jogos";
      const inicial = { versao: 1, liberadas: jogoAvulso ? [0] : [], atual: jogoAvulso ? 0 : null, reveladas: {}, sorteio: null, cronometro: null, atualizadoEm: agora };
      abrirComPrimeiraDica(inicial, programa);
      await gravarJson(caminho(cod, "estado.json"), inicial);
      return res.status(200).json({ sessao: cod, chave });
    }

    // ----- As outras ações começam pelo código da sessão -----
    const cod = codigoLimpo(corpo.sessao);
    if (!cod) {
      registrarErro(pedinte);
      return erro(res, 400, "Código da adoração inválido. São 6 letras e números.");
    }
    const estado = await lerEstado(cod, ACOES_QUE_GRAVAM.has(acao));
    if (!estado) {
      registrarErro(pedinte);
      return erro(res, 404, "Não encontrei uma adoração com esse código (ou ela já terminou).");
    }

    // A chave do dirigente (só confere o hash; a chave errada conta como tentativa errada).
    let segredo = null;
    const ehDirigente = async () => {
      if (typeof corpo.chave !== "string" || corpo.chave.length < 20 || corpo.chave.length > 100) return false;
      segredo ||= await lerJson(caminho(cod, "respostas.json"));
      const h = hash(corpo.chave);
      return Boolean(segredo && Array.isArray(segredo.chaves) && segredo.chaves.some((c) => textosIguais(h, c)));
    };
    const exigirDirigente = async () => {
      if (await ehDirigente()) return true;
      registrarErro(pedinte);
      erro(res, 403, "Só o presidente da reunião pode fazer isso.");
      return false;
    };
    // 6.13.17: dá os pontos de quem acertou (total de dicas − dicas dadas + 1, no mínimo 1), revela a resposta e a referência da rodada.
    const darPontos = (e, parte, rodada, r, nome, resposta) => {
      const total = Math.max(1, (String(r.pergunta || "").match(/Dica\s*\d+\s*:/gi) || []).length);
      const dadas = Math.min(total, Number(((e.dicas || {})[parte] || {})[rodada]) || 0);
      e.acertos = e.acertos || {};
      // 6.13.98: cada resposta errada de quem acertou, nesta mesma questão, tira 1 ponto (nunca abaixo de zero; não passa para outras questões)
      const erros = ((((e.erradas || {})[parte] || {})[rodada]) || []).filter((x) => x && x.nome === nome).length;
      e.acertos[parte] = { ...(e.acertos[parte] || {}), [rodada]: { nome, pts: Math.max(0, Math.max(1, total - dadas + 1) - erros) } };
      e.reveladas = e.reveladas || {};
      e.reveladas[parte] = { ...(e.reveladas[parte] || {}), [rodada]: resposta };
      const ref = String((((segredo && segredo.referencias) || {})[parte] || [])[rodada] || "");
      if (ref) {
        e.referenciasReveladas = e.referenciasReveladas || {};
        e.referenciasReveladas[parte] = { ...(e.referenciasReveladas[parte] || {}), [rodada]: ref };
      }
    };
    // 6.13.20: a questão foi fechada por quem dirige (Revelar ou Pontuar): a resposta enviada que esperava julgamento vira certa, se foi de quem
    // pontuou, ou entra na lista das erradas (antes ela sumia da tela, e parecia que a pessoa tinha respondido uma vez só).
    const fecharEnvio = (e, parte, rodada, nomeQueAcertou) => {
      const env = ((e.envios || {})[parte] || {})[rodada];
      if (!env || env.status !== "pendente") return;
      if (nomeQueAcertou && env.nome === nomeQueAcertou) {
        e.envios[parte] = { ...e.envios[parte], [rodada]: { ...env, status: "certa" } };
        return;
      }
      e.erradas = e.erradas || {};
      e.erradas[parte] = { ...(e.erradas[parte] || {}), [rodada]: [...(((e.erradas[parte] || {})[rodada]) || []), { nome: env.nome, texto: env.texto }].slice(-10) };
      const copia = { ...e.envios[parte] };
      delete copia[rodada];
      e.envios = { ...e.envios, [parte]: copia };
    };
    const gravarEstado = async (mudar) => {
      mudar(estado);
      estado.versao = (Number(estado.versao) || 0) + 1;
      estado.atualizadoEm = Date.now();
      await gravarEstadoLido(cod, estado);
      const lista = await lerParticipantes(cod);
      // 6.13.31: a lista com os ids só vai para o presidente da reunião; todos recebem os presentes (só os nomes)
      const saida = { versao: versaoDe(estado, lista.length), estado: estadoPublico(estado), presentes: presentes(lista), agora: Date.now() };
      if (await ehDirigente()) saida.participantes = lista.map(({ id, nome }) => ({ id, nome }));
      return res.status(200).json(saida);
    };

    // ----- entrar: a programação sem respostas, o estado e o id do participante (o dirigente pode entrar sem nome) -----
    if (acao === "entrar") {
      // 6.14.66: quem entra só como participante (sem a chave) não precisa de cadastro: o convite é o código da sessão. Com a chave (o
      // presidente da reunião ou o administrador do jogo) vale o cadastro do aparelho, como sempre.
      if (typeof corpo.chave === "string" && corpo.chave) {
        const bloqueio = await mensagemSeBloqueado({ aparelhoId: corpo.aparelhoId, codigoAdmin: corpo.codigoAdmin });
        if (bloqueio) return erro(res, 403, bloqueio);
      }
      const dirigente = await ehDirigente();
      if (typeof corpo.chave === "string" && corpo.chave && !dirigente) {
        registrarErro(pedinte);
        return erro(res, 403, "A chave de presidente da reunião deste aparelho não vale para esta adoração.");
      }
      const programa = await lerJson(caminho(cod, "programa.json"));
      if (!programa) return erro(res, 404, "A programação desta adoração não foi encontrada.");
      let nome = nomeLimpo(corpo.nome);
      // 6.13.50: partida sozinho: o administrador já entra jogando, com um nome fixo (que o placar não mostra).
      if (!nome && dirigente && programa.solo) nome = "Jogador";
      // 6.13.30: o presidente da reunião que abre a adoração sem nome é identificado pelo cadastro do aparelho (o primeiro nome) e já entra no
      // jogo com ele, como qualquer participante. Sem cadastro (ou testes locais), continua sem nome e pode usar o "🎮 Jogar também".
      if (!nome && dirigente && corpo.aparelhoId) {
        const ac = await estadoAcessoSite({ aparelhoId: corpo.aparelhoId }).catch(() => null);
        if (ac && ac.identificado && ac.cadastro) nome = nomeLimpo(String(ac.cadastro.nome || ac.nome || "").trim().split(/\s+/)[0]);
      }
      let participanteId = "";
      if (nome) {
        participanteId = idLimpo(corpo.participanteId);
        const existente = participanteId ? await lerJson(caminho(cod, `participantes/${participanteId}.json`)) : null;
        if (!existente) {
          if ((await contarParticipantes(cod)) >= MAX_PARTICIPANTES) return erro(res, 409, `Esta adoração já tem ${MAX_PARTICIPANTES} participantes.`);
          participanteId = randomBytes(12).toString("base64url");
        }
        await gravarJson(caminho(cod, `participantes/${participanteId}.json`), { id: participanteId, nome, entrouEm: existente ? existente.entrouEm : Date.now(), vistoEm: Date.now() });
      } else if (!dirigente) {
        // Sem nome: só confere o código e devolve o título e os nomes informados, para a pessoa escolher o dela (não entra ainda).
        return res.status(200).json({ sessao: cod, precisaNome: true, titulo: programa.titulo, emoji: programa.emoji, nomes: programa.nomes || [] });
      }
      const resposta = { sessao: cod, programa, participanteId, dirigente, agora: Date.now(), ...(participanteId ? { nome } : {}) };
      // 6.13.31: todos recebem quem está presente (painel "Quem está participando"); a versão de todos conta os participantes (quem entra ou sai
      // muda a versão e todos atualizam).
      const lista = await lerParticipantes(cod);
      Object.assign(resposta, { versao: versaoDe(estado, lista.length), estado: estadoPublico(estado), presentes: presentes(lista) });
      if (dirigente) Object.assign(resposta, { participantes: lista.map(({ id, nome: n }) => ({ id, nome: n })), extras: segredo.extras || null });
      return res.status(200).json(resposta);
    }

    // ----- estado: só o número da versão quando nada mudou -----
    // 6.13.31: com o participanteId, o aparelho dá sinal de presença (o arquivo é regravado no máximo a cada SINAL_MS); com presenca: true
    // (o app manda de tempos em tempos), a resposta traz a lista de presentes mesmo sem mudança, para tirar do painel quem fechou o app.
    if (acao === "estado") {
      const dirigente = await ehDirigente();
      const pid = idLimpo(corpo.participanteId);
      if (pid) {
        const eu = await lerJson(caminho(cod, `participantes/${pid}.json`)).catch(() => null);
        if (eu && eu.id && Date.now() - (eu.vistoEm || 0) > SINAL_MS) await gravarJson(caminho(cod, `participantes/${pid}.json`), { ...eu, vistoEm: Date.now() });
      }
      const qtd = await contarParticipantes(cod);
      const versao = versaoDe(estado, qtd);
      if (String(corpo.versao || "") === versao && corpo.presenca !== true) return res.status(200).json({ versao, agora: Date.now() });
      const lista = await lerParticipantes(cod);
      const r = { versao, estado: estadoPublico(estado), agora: Date.now(), presentes: presentes(lista) };
      if (dirigente) r.participantes = lista.map(({ id, nome }) => ({ id, nome }));
      return res.status(200).json(r);
    }

    // ----- sair (6.13.31): quem sai da tela da adoração sai do painel de participantes (os pontos e as respostas, pelo nome, continuam) -----
    if (acao === "sair") {
      const pid = idLimpo(corpo.participanteId);
      if (pid && (await lerJson(caminho(cod, `participantes/${pid}.json`)).catch(() => null))) await del([caminho(cod, `participantes/${pid}.json`)]);
      return res.status(200).json({ ok: true });
    }

    // ----- video (6.11.56): o vídeo de uma parte para tocar na tela da adoração, com a transcrição (a legenda publicada). Vale para quem tem o
    // código da sessão, e só para partes que o dirigente já liberou (o dirigente vê todas). Guardado 6 h na instância, por vídeo. -----
    if (acao === "video") {
      const parte = Number(corpo.parte);
      const indice = Number(corpo.video);
      const programa = await lerJson(caminho(cod, "programa.json"));
      const v = programa && Number.isInteger(parte) && Number.isInteger(indice) && programa.partes && programa.partes[parte] && (programa.partes[parte].videos || [])[indice];
      if (!v || !v.link) return erro(res, 404, "Esse vídeo não está nesta programação.");
      if (!(estado.liberadas || []).includes(parte) && !(await ehDirigente())) return erro(res, 403, "Esta parte ainda não foi liberada pelo presidente da reunião.");
      const dados = await dadosDoVideo(v.link);
      if (!dados) return erro(res, 502, "Não consegui abrir o vídeo agora. Use o link para assistir no jw.org.");
      return res.status(200).json(dados);
    }

    // ----- cantico (6.11.84): o vídeo e a letra de um cântico da parte, nas mesmas condições do vídeo (parte liberada ou dirigente) -----
    if (acao === "cantico") {
      const parte = Number(corpo.parte);
      const indice = Number(corpo.cantico);
      const programa = await lerJson(caminho(cod, "programa.json"));
      const c = programa && Number.isInteger(parte) && Number.isInteger(indice) && programa.partes && programa.partes[parte] && (programa.partes[parte].canticos || [])[indice];
      if (!c) return erro(res, 404, "Esse cântico não está nesta programação.");
      if (!(estado.liberadas || []).includes(parte) && !(await ehDirigente())) return erro(res, 403, "Esta parte ainda não foi liberada pelo presidente da reunião.");
      const dados = await dadosDoCantico(c.numero);
      if (!dados) return erro(res, 502, "Não consegui abrir o cântico agora. Use o link para assistir no jw.org.");
      return res.status(200).json(dados);
    }

    // ----- materia (6.12.52): o texto de uma publicação citada na parte (para exibir na tela), nas mesmas condições do vídeo (parte liberada ou dirigente).
    // Só lê o que a programação cita: o endereço do wol da própria publicação ou o primeiro resultado da pesquisa pelo nome dela. -----
    if (acao === "materia") {
      const parte = Number(corpo.parte);
      const indice = Number(corpo.publicacao);
      const programa = await lerJson(caminho(cod, "programa.json"));
      const pub = programa && Number.isInteger(parte) && Number.isInteger(indice) && programa.partes && programa.partes[parte] && (programa.partes[parte].publicacoes || [])[indice];
      if (!pub) return erro(res, 404, "Essa matéria não está nesta programação.");
      if (!(estado.liberadas || []).includes(parte) && !(await ehDirigente())) return erro(res, 403, "Esta parte ainda não foi liberada pelo presidente da reunião.");
      const artigo = await lerMateriaDaPublicacao(pub);
      if (!artigo) return erro(res, 502, "Não consegui abrir a matéria agora. Use o link para ler no wol.jw.org.");
      return res.status(200).json(artigo);
    }

    // ----- assumir: troca o código do dirigente (passado por quem dirige) por uma chave nova neste aparelho -----
    if (acao === "assumir") {
      segredo = await lerJson(caminho(cod, "respostas.json"));
      const informado = codigoLimpo(corpo.codigoDirigente, TAM_CODIGO_DIRIGENTE);
      const d = segredo && segredo.direcao;
      if (!informado || !d || Date.now() > d.expira || !textosIguais(hash(informado), d.hash)) {
        registrarErro(pedinte);
        return erro(res, 403, "Código do presidente da reunião inválido ou vencido. Peça um novo a quem está presidindo.");
      }
      const chave = randomBytes(32).toString("base64url");
      segredo.chaves = [...(segredo.chaves || []), hash(chave)].slice(-MAX_CHAVES);
      segredo.direcao = null; // uso único
      await gravarJson(caminho(cod, "respostas.json"), segredo);
      return res.status(200).json({ sessao: cod, chave });
    }

    // ----- responder (6.13.17): o participante manda a resposta de uma questão do jogo pelo próprio app. A primeira resposta trava a questão
    // até ser julgada. Se bater com a resposta certa, o servidor já dá os pontos e revela a resposta; senão, quem dirige julga (julgar).
    // Com alguém sorteado (para esta parte), só ele responde; com uma questão sorteada, só ela pode ser respondida. -----
    if (acao === "responder") {
      const participanteId = idLimpo(corpo.participanteId);
      const quem = participanteId ? await lerJson(caminho(cod, `participantes/${participanteId}.json`)) : null;
      if (!quem || !quem.nome) return erro(res, 403, "Entre na adoração com o seu nome para responder.");
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const programa = await lerJson(caminho(cod, "programa.json"));
      const jogo = programa && Number.isInteger(parte) && programa.partes && programa.partes[parte] && programa.partes[parte].jogo;
      const r = jogo && Number.isInteger(rodada) ? (jogo.rodadas || [])[rodada] : null;
      if (!r) return erro(res, 400, "Questão inválida.");
      if (!(estado.liberadas || []).includes(parte)) return erro(res, 403, "Esta parte ainda não foi liberada pelo presidente da reunião.");
      const textoResp = texto(corpo.texto, 200).replace(/\s+/g, " ");
      if (!textoResp) return erro(res, 400, "Escreva a resposta.");
      if (((estado.reveladas || {})[parte] || {})[rodada] || ((estado.acertos || {})[parte] || {})[rodada]) return erro(res, 409, "Esta questão já foi respondida.");
      const pendente = ((estado.envios || {})[parte] || {})[rodada];
      if (pendente && pendente.status === "pendente") return erro(res, 409, `${pendente.nome} já respondeu: espere o julgamento.`);
      // 6.13.28: quem viu a resposta (Ver só para mim) não responde mais a esta questão
      if ((((estado.espiaram || {})[parte] || {})[rodada] || []).includes(quem.nome)) return erro(res, 403, "Você viu a resposta desta questão (Ver só para mim) e não pode mais responder a ela.");
      const s = estado.sorteio;
      if (s && s.nome && (s.parte == null || s.parte === parte) && s.nome !== quem.nome) return erro(res, 403, `Agora é a vez de ${s.nome}.`);
      const sq = estado.sorteioQuestao;
      if (sq && sq.parte === parte && sq.rodada !== rodada && !((estado.reveladas || {})[parte] || {})[sq.rodada]) return erro(res, 403, `Responda a questão sorteada (questão ${sq.rodada + 1}).`);
      segredo ||= await lerJson(caminho(cod, "respostas.json"));
      const certa = String((((segredo && segredo.respostas) || {})[parte] || [])[rodada] || "");
      const confere = certa && respostaConfere(textoResp, certa, jogo.idTipo || "");
      // 6.13.45: no Verdadeiro ou falso só há duas respostas, sem interpretação: o servidor julga na hora. Quem erra fica na lista das erradas e
      // a resposta é revelada (sem pontos para ninguém); quem acerta ganha os pontos como sempre.
      if (jogo.idTipo === "verdadeiro_falso" && certa && !confere) {
        return gravarEstado((e) => {
          e.erradas = e.erradas || {};
          e.erradas[parte] = { ...(e.erradas[parte] || {}), [rodada]: [...(((e.erradas[parte] || {})[rodada]) || []), { nome: quem.nome, texto: textoResp }].slice(-10) };
          e.reveladas = e.reveladas || {};
          e.reveladas[parte] = { ...(e.reveladas[parte] || {}), [rodada]: certa };
          const ref = String((((segredo && segredo.referencias) || {})[parte] || [])[rodada] || "");
          if (ref) {
            e.referenciasReveladas = e.referenciasReveladas || {};
            e.referenciasReveladas[parte] = { ...(e.referenciasReveladas[parte] || {}), [rodada]: ref };
          }
        });
      }
      // 6.13.60: partida sozinho: não há quem julgue, então o servidor julga na hora: errou, a resposta vai para a lista das erradas e a questão
      // continua aberta (dá para tentar de novo, apelar para a IA ou revelar).
      if (programa.solo && certa && !confere) {
        return gravarEstado((e) => {
          e.erradas = e.erradas || {};
          e.erradas[parte] = { ...(e.erradas[parte] || {}), [rodada]: [...(((e.erradas[parte] || {})[rodada]) || []), { nome: quem.nome, texto: textoResp }].slice(-10) };
        });
      }
      return gravarEstado((e) => {
        e.envios = e.envios || {};
        e.envios[parte] = { ...(e.envios[parte] || {}), [rodada]: { nome: quem.nome, texto: textoResp, em: Date.now(), status: confere ? "certa" : "pendente" } };
        if (confere) darPontos(e, parte, rodada, r, quem.nome, certa);
      });
    }

    // ----- enviar-ordem (6.14.21): no "Ordem e data", cada jogador arruma a sua ordem de uma rodada e envia; o servidor confere na hora.
    // Sozinho: dá para tentar de novo (1 ponto por acontecimento, menos 1 por conferência errada) e, acertando, a ordem é revelada.
    // Em grupo: um envio por jogador em cada rodada; todos veem quantos cada um acertou; os pontos são de quem enviar primeiro a ordem toda
    // certa; a ordem certa aparece quando todos os presentes enviarem (ou quando o administrador revelar). -----
    if (acao === "enviar-ordem") {
      const participanteId = idLimpo(corpo.participanteId);
      const quem = participanteId ? await lerJson(caminho(cod, `participantes/${participanteId}.json`)) : null;
      if (!quem || !quem.nome) return erro(res, 403, "Entre com o seu nome para enviar a sua ordem.");
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const programa = await lerJson(caminho(cod, "programa.json"));
      segredo ||= await lerJson(caminho(cod, "respostas.json"));
      const jogo = programa && Number.isInteger(parte) && programa.partes && programa.partes[parte] && programa.partes[parte].jogo;
      const r = jogo && Number.isInteger(rodada) ? (jogo.rodadas || [])[rodada] : null;
      const certa = (((((segredo && segredo.extras) || {}).ordens || {})[parte]) || [])[rodada];
      if (!r || !Array.isArray(r.itens) || !Array.isArray(certa)) return erro(res, 400, "Rodada inválida.");
      if (!(estado.liberadas || []).includes(parte)) return erro(res, 403, "Esta parte ainda não foi liberada pelo presidente da reunião.");
      if (((estado.reveladas || {})[parte] || {})[rodada]) return erro(res, 409, "A ordem desta rodada já foi revelada.");
      const sorteado = estado.sorteio;
      if (sorteado && sorteado.nome && (sorteado.parte == null || sorteado.parte === parte) && sorteado.nome !== quem.nome) return erro(res, 403, `Agora é a vez de ${sorteado.nome}.`);
      const tentativa = lista(corpo.ordem, 12, (t) => texto(t, 600));
      if (tentativa.length !== certa.length) return erro(res, 400, "Mande todos os acontecimentos, na sua ordem.");
      const chave = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 280);
      const certos = tentativa.map((t, i) => (chave(t) === chave(certa[i].evento) ? i : -1)).filter((i) => i >= 0);
      const acertou = certos.length === certa.length;
      const daRodada = (campo) => ((((estado[campo] || {})[parte]) || {})[rodada]) || [];
      if (programa.solo) {
        const feitas = daRodada("erradas");
        if (feitas.length && JSON.stringify(feitas[feitas.length - 1].ordem) === JSON.stringify(tentativa)) return erro(res, 409, "Mude a ordem antes de conferir de novo.");
        return gravarEstado((e) => {
          if (acertou) {
            e.acertos = e.acertos || {};
            e.acertos[parte] = { ...(e.acertos[parte] || {}), [rodada]: { nome: quem.nome, pts: Math.max(0, certa.length - feitas.length) } };
            revelarOrdemDaRodada(e, parte, rodada, certa);
          } else {
            e.erradas = e.erradas || {};
            e.erradas[parte] = { ...(e.erradas[parte] || {}), [rodada]: [...feitas, { nome: quem.nome, ordem: tentativa, certos }].slice(-20) };
          }
        });
      }
      const enviadas = daRodada("ordensEnviadas");
      if (enviadas.some((x) => x.nome === quem.nome)) return erro(res, 409, "Você já enviou a sua ordem desta rodada.");
      const aqui = presentes(await lerParticipantes(cod)).map((p) => p.nome);
      return gravarEstado((e) => {
        const todas = [...enviadas, { nome: quem.nome, certos: certos.length, total: certa.length, certa: acertou }];
        e.ordensEnviadas = { ...(e.ordensEnviadas || {}), [parte]: { ...(((e.ordensEnviadas || {})[parte]) || {}), [rodada]: todas } };
        if (acertou && !(((e.acertos || {})[parte] || {})[rodada])) {
          e.acertos = e.acertos || {};
          e.acertos[parte] = { ...(e.acertos[parte] || {}), [rodada]: { nome: quem.nome, pts: certa.length } };
        }
        if (aqui.length && aqui.every((nome) => todas.some((x) => x.nome === nome))) revelarOrdemDaRodada(e, parte, rodada, certa);
      });
    }

    // ----- Daqui em diante, só o dirigente -----
    if (!(await exigirDirigente())) return;
    const programa = ["liberar", "bloquear", "revelar", "revelar-ordem", "dica", "pontuar", "reiniciar", "sortear", "sortear-questao", "limpar-sorteio", "cronometro", "julgar", "sortear-dica", "modo-dicas", "julgamento-ia", "foco"].includes(acao) ? await lerJson(caminho(cod, "programa.json")) : null;
    const parteValida = (i) => programa && Number.isInteger(i) && i >= 0 && i < programa.partes.length;
    // 6.12.76: a referência secreta da rodada (respostas.json; sessões antigas não a têm) e a revelação dela junto com a resposta.
    const referenciaDaRodada = (parte, rodada) => String((((segredo && segredo.referencias) || {})[parte] || [])[rodada] || "");
    const revelarReferencia = (e, parte, rodada) => {
      const ref = referenciaDaRodada(parte, rodada);
      if (!ref) return;
      e.referenciasReveladas = e.referenciasReveladas || {};
      e.referenciasReveladas[parte] = { ...(e.referenciasReveladas[parte] || {}), [rodada]: ref };
    };
    // 6.14.21: a rodada é do "Ordem e data" (uma tabela de acontecimentos)? Essas não têm "revelar", "pontuar" nem "julgar" de texto.
    const rodadaDeOrdem = (parte, rodada) => Boolean(((((((programa || {}).partes || [])[parte] || {}).jogo || {}).rodadas || [])[rodada] || {}).itens);

    // ----- voltar-inicio (6.12.37): volta à tela de boas-vindas: nenhuma parte liberada e nenhuma atual -----
    if (acao === "voltar-inicio") {
      return gravarEstado((e) => {
        e.liberadas = [];
        e.atual = null;
      });
    }

    if (acao === "liberar" || acao === "bloquear") {
      const parte = Number(corpo.parte);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      return gravarEstado((e) => {
        const set = new Set(e.liberadas || []);
        if (acao === "liberar") set.add(parte);
        else set.delete(parte);
        e.liberadas = [...set].sort((a, b) => a - b);
        if (acao === "liberar") e.atual = parte;
        else if (e.atual === parte) e.atual = e.liberadas.length ? e.liberadas[e.liberadas.length - 1] : null;
      });
    }

    if (acao === "revelar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const respostas = (segredo.respostas || {})[parte] || [];
      if (!Number.isInteger(rodada) || rodada < 0 || rodada >= respostas.length || rodadaDeOrdem(parte, rodada)) return erro(res, 400, "Rodada inválida.");
      return gravarEstado((e) => {
        e.reveladas = e.reveladas || {};
        e.reveladas[parte] = { ...(e.reveladas[parte] || {}), [rodada]: respostas[rodada] };
        revelarReferencia(e, parte, rodada);
        fecharEnvio(e, parte, rodada, "");
      });
    }

    // ----- revelar-ordem (6.12.77): no "Ordem e data", mostra a todos a ordem certa de uma rodada, com as datas (sem pontuar ninguém) -----
    if (acao === "revelar-ordem") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const ordem = (((((segredo.extras || {}).ordens || {})[parte]) || [])[rodada]);
      if (!Array.isArray(ordem) || !rodadaDeOrdem(parte, rodada)) return erro(res, 400, "Esta rodada não tem ordem para revelar.");
      return gravarEstado((e) => revelarOrdemDaRodada(e, parte, rodada, ordem));
    }

    // ----- espiar (6.12.06): só o dirigente vê a resposta da rodada, sem revelá-la aos participantes (nada é gravado no estado) -----
    // 6.12.76: com a referência da rodada (o texto bíblico que confirma), que também fica escondida dos participantes.
    if (acao === "espiar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const respostas = (segredo.respostas || {})[parte] || [];
      if (!Number.isInteger(parte) || !Number.isInteger(rodada) || rodada < 0 || rodada >= respostas.length) return erro(res, 400, "Rodada inválida.");
      const saida = { resposta: String(respostas[rodada] || ""), referencia: referenciaDaRodada(parte, rodada) };
      // 6.13.28: o presidente da reunião que também joga (participanteId) e viu a resposta fica fora desta questão: o nome dele entra em
      // estado.espiaram e o "responder" recusa a resposta dele. A resposta que ele já tinha mandado continua valendo.
      const pid = idLimpo(corpo.participanteId);
      const quem = pid ? await lerJson(caminho(cod, `participantes/${pid}.json`)) : null;
      if (quem && quem.nome) {
        const lista = ((estado.espiaram || {})[parte] || {})[rodada] || [];
        if (!lista.includes(quem.nome)) {
          estado.espiaram = estado.espiaram || {};
          estado.espiaram[parte] = { ...(estado.espiaram[parte] || {}), [rodada]: [...lista, quem.nome].slice(-20) };
          estado.versao = (Number(estado.versao) || 0) + 1;
          estado.atualizadoEm = Date.now();
          await gravarEstadoLido(cod, estado);
        }
        const todos = await lerParticipantes(cod);
        Object.assign(saida, { versao: versaoDe(estado, todos.length), estado: estadoPublico(estado), presentes: presentes(todos), participantes: todos.map(({ id, nome }) => ({ id, nome })), agora: Date.now() });
      }
      return res.status(200).json(saida);
    }

    // ----- dica (6.11.96): dá a próxima dica da rodada (Dica 1, Dica 2, Dica 3…), uma de cada vez; no máximo as que a pergunta tem -----
    if (acao === "dica") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const r = programa.partes[parte].jogo && (programa.partes[parte].jogo.rodadas || [])[rodada];
      if (!Number.isInteger(rodada) || !r) return erro(res, 400, "Rodada inválida.");
      const total = Math.max(1, (String(r.pergunta).match(/Dica\s*\d+\s*:/gi) || []).length);
      return gravarEstado((e) => {
        e.dicas = e.dicas || {};
        const mapa = e.dicas[parte] || {};
        const dadas = Number(mapa[rodada]) || 0;
        if (dadas >= total) return;
        e.dicas[parte] = { ...mapa, [rodada]: dadas + 1 };
        // 6.13.46: se as dicas desta questão já vinham sendo sorteadas, a próxima "em ordem" é a menor que ainda não saiu
        const ordem = ((e.dicasOrdem || {})[parte] || {})[rodada];
        if (Array.isArray(ordem)) {
          let prox = 0;
          while (ordem.includes(prox)) prox++;
          e.dicasOrdem[parte] = { ...e.dicasOrdem[parte], [rodada]: [...ordem, prox] };
        }
      });
    }

    // ----- modo-dicas (6.13.46): só no Perfil bíblico, quem dirige escolhe se as dicas são sorteadas ou dadas em ordem -----
    if (acao === "modo-dicas") {
      const parte = Number(corpo.parte);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      if ((programa.partes[parte].jogo || {}).idTipo !== "perfil_biblico") return erro(res, 400, "O sorteio de dicas vale só para o Perfil bíblico.");
      const sorteio = corpo.sorteio === true;
      return gravarEstado((e) => {
        e.sorteioDicas = { ...(e.sorteioDicas || {}) };
        if (sorteio) e.sorteioDicas[parte] = true;
        else delete e.sorteioDicas[parte];
      });
    }

    // ----- sortear-dica (6.13.46): sorteia, entre as dicas que ainda não saíram, a próxima da rodada; os pontos seguem a quantidade de dicas dadas -----
    if (acao === "sortear-dica") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const jogo = programa.partes[parte].jogo;
      const r = jogo && (jogo.rodadas || [])[rodada];
      if (!Number.isInteger(rodada) || !r) return erro(res, 400, "Rodada inválida.");
      if (jogo.idTipo !== "perfil_biblico") return erro(res, 400, "O sorteio de dicas vale só para o Perfil bíblico.");
      if (((estado.reveladas || {})[parte] || {})[rodada]) return erro(res, 409, "Esta questão já foi respondida.");
      const total = Math.max(1, (String(r.pergunta).match(/Dica\s*\d+\s*:/gi) || []).length);
      const dadas = Math.min(total, Number(((estado.dicas || {})[parte] || {})[rodada]) || 0);
      const jaSairam = ((estado.dicasOrdem || {})[parte] || {})[rodada] || Array.from({ length: dadas }, (_, i) => i);
      const faltam = Array.from({ length: total }, (_, i) => i).filter((i) => !jaSairam.includes(i));
      if (!faltam.length) return erro(res, 400, "Todas as dicas já saíram.");
      const sorteada = faltam[randomInt(faltam.length)];
      return gravarEstado((e) => {
        e.dicasOrdem = e.dicasOrdem || {};
        e.dicasOrdem[parte] = { ...(e.dicasOrdem[parte] || {}), [rodada]: [...jaSairam, sorteada] };
        e.dicas = e.dicas || {};
        e.dicas[parte] = { ...(e.dicas[parte] || {}), [rodada]: jaSairam.length + 1 };
      });
    }

    // ----- pontuar (6.11.97): quem acertou a rodada ganha os pontos de agora (total de dicas − dicas dadas + 1) e a resposta é revelada -----
    if (acao === "pontuar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const ninguem = corpo.ninguem === true; // 6.12.06: "Ninguém acertou": revela a resposta sem pontuar ninguém
      const nome = ninguem ? "" : nomeLimpo(corpo.nome);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const r = programa.partes[parte].jogo && (programa.partes[parte].jogo.rodadas || [])[rodada];
      const respostas = (segredo.respostas || {})[parte] || [];
      if (!Number.isInteger(rodada) || !r || rodada >= respostas.length || r.itens) return erro(res, 400, "Rodada inválida.");
      if (!nome && !ninguem) return erro(res, 400, "Escolha quem acertou.");
      const total = Math.max(1, (String(r.pergunta).match(/Dica\s*\d+\s*:/gi) || []).length);
      const dadas = Math.min(total, Number(((estado.dicas || {})[parte] || {})[rodada]) || 0);
      if (!dadas && !ninguem) return erro(res, 400, "Dê ao menos a primeira dica antes de pontuar.");
      // 6.13.98: o mesmo desconto de 1 ponto por resposta errada de quem acertou, nesta questão (nunca abaixo de zero)
      const errosDoNome = ((((estado.erradas || {})[parte] || {})[rodada]) || []).filter((x) => x && x.nome === nome).length;
      const pts = ninguem ? 0 : Math.max(0, Math.max(1, total - dadas + 1) - errosDoNome);
      return gravarEstado((e) => {
        e.acertos = e.acertos || {};
        e.acertos[parte] = { ...(e.acertos[parte] || {}), [rodada]: ninguem ? { nome: "", pts: 0, ninguem: true } : { nome, pts } };
        e.reveladas = e.reveladas || {};
        e.reveladas[parte] = { ...(e.reveladas[parte] || {}), [rodada]: respostas[rodada] };
        revelarReferencia(e, parte, rodada);
        fecharEnvio(e, parte, rodada, ninguem ? "" : nome);
      });
    }

    // ----- reiniciar (6.12.29): volta a questão ao começo: sem dicas dadas, resposta escondida de novo e sem pontos (quem tinha pontuado perde esses pontos) -----
    if (acao === "reiniciar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      // 6.14.14: "tudo" ("Jogar novamente", no fim do jogo): a parte inteira volta ao começo, de uma vez.
      if (corpo.rodada === "tudo") {
        if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
        return gravarEstado((e) => {
          for (const campo of ["dicas", "dicasOrdem", "reveladas", "acertos", "referenciasReveladas", "envios", "erradas", "ordensReveladas", "ordensEnviadas"]) {
            if (e[campo] && e[campo][parte] !== undefined) {
              const copia = { ...e[campo] };
              delete copia[parte];
              e[campo] = copia;
            }
          }
          if (e.sorteioQuestao && e.sorteioQuestao.parte === parte) e.sorteioQuestao = null;
          abrirComPrimeiraDica(e, programa, { parte });
        });
      }
      if (!parteValida(parte) || !Number.isInteger(rodada) || rodada < 0) return erro(res, 400, "Rodada inválida.");
      return gravarEstado((e) => {
        for (const campo of ["dicas", "dicasOrdem", "reveladas", "acertos", "referenciasReveladas", "envios", "erradas", "ordensReveladas", "ordensEnviadas"]) {
          if (e[campo] && e[campo][parte]) {
            const copia = { ...e[campo][parte] };
            delete copia[rodada];
            e[campo] = { ...e[campo], [parte]: copia };
          }
        }
        abrirComPrimeiraDica(e, programa, { parte, rodada });
      });
    }

    // ----- novo-jogo (6.14.15): "Jogar com novas perguntas": troca o jogo desta mesma sessão (só no jogo avulso), do começo; o código, a chave,
    // os nomes e quem está participando continuam. "programaN" muda no estado, para cada aparelho carregar o jogo novo.
    if (acao === "novo-jogo") {
      await prepararCodigosPessoais();
      if (!recursoCodigoValido("pesquisa", corpo.codigo, corpo.aparelhoId)) {
        registrarErro(pedinte);
        return erro(res, 403, "Código de pesquisa inválido.");
      }
      const op = corpo.programa;
      if (!op || typeof op !== "object" || !Array.isArray(op.partes) || !op.partes.length) return erro(res, 400, "Programação inválida.");
      if (JSON.stringify(op).length > MAX_PROGRAMA) return erro(res, 413, "A programação é grande demais para compartilhar.");
      const atual = await lerJson(caminho(cod, "programa.json"));
      if (!atual || atual.modo !== "jogos") return erro(res, 400, "Só um jogo pode ser trocado.");
      const { programa, respostas, referencias, extras } = limparPrograma({ ...op, modo: "jogos", solo: atual.solo === true });
      if (!programa.partes.length) return erro(res, 400, "Programação sem partes.");
      programa.nomes = atual.nomes || [];
      programa.criadoEm = atual.criadoEm;
      segredo = { ...segredo, respostas, referencias, extras };
      await gravarJson(caminho(cod, "respostas.json"), segredo);
      await gravarJson(caminho(cod, "programa.json"), programa);
      return gravarEstado((e) => {
        for (const campo of ["dicas", "dicasOrdem", "reveladas", "acertos", "referenciasReveladas", "envios", "erradas", "ordensReveladas", "ordensEnviadas", "espiaram", "sorteioDicas", "foco"]) delete e[campo];
        e.reveladas = {};
        e.sorteio = null;
        e.sorteioQuestao = null;
        e.programaN = (Number(e.programaN) || 0) + 1;
        abrirComPrimeiraDica(e, programa);
      });
    }

    if (acao === "sortear") {
      // Entre os participantes que entraram ou entre os nomes informados; evita repetir quem foi sorteado por último.
      const fonte = corpo.fonte === "nomes" ? "nomes" : "participantes";
      const candidatos = [...new Set(fonte === "nomes" ? programa.nomes || [] : (await lerParticipantes(cod)).map((p) => p.nome))];
      if (!candidatos.length) return erro(res, 400, fonte === "nomes" ? "Não há nomes informados para sortear." : "Ninguém entrou ainda para sortear.");
      const anterior = estado.sorteio && estado.sorteio.nome;
      const opcoes = candidatos.length > 1 ? candidatos.filter((n) => n !== anterior) : candidatos;
      const nome = opcoes[randomInt(opcoes.length)];
      return gravarEstado((e) => {
        e.sorteio = { nome, em: Date.now(), n: ((e.sorteio && e.sorteio.n) || 0) + 1, parte: Number.isInteger(Number(corpo.parte)) ? Number(corpo.parte) : null };
      });
    }

    // ----- limpar-sorteio (6.12.10): tira o nome sorteado (sorteio acidental); o card volta a mostrar só as opções de sorteio -----
    if (acao === "limpar-sorteio") {
      const soQuestao = corpo.tipo === "questao";
      return gravarEstado((e) => {
        if (soQuestao) e.sorteioQuestao = null;
        else e.sorteio = null;
      });
    }

    // ----- sortear-questao (6.12.33): sorteia, entre as questões do jogo ainda não respondidas, a próxima a ser respondida -----
    if (acao === "sortear-questao") {
      const parte = Number(corpo.parte);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const rodadas = (programa.partes[parte].jogo && programa.partes[parte].jogo.rodadas) || [];
      const reveladas = (estado.reveladas || {})[parte] || {};
      const livres = rodadas.map((_, k) => k).filter((k) => reveladas[k] == null || reveladas[k] === "");
      if (!livres.length) return erro(res, 400, "Todas as questões já foram respondidas.");
      const anterior = estado.sorteioQuestao && estado.sorteioQuestao.parte === parte ? estado.sorteioQuestao.rodada : -1;
      const opcoes = livres.length > 1 ? livres.filter((k) => k !== anterior) : livres;
      const rodada = opcoes[randomInt(opcoes.length)];
      return gravarEstado((e) => {
        e.sorteioQuestao = { parte, rodada, n: ((e.sorteioQuestao && e.sorteioQuestao.n) || 0) + 1 };
      });
    }

    // ----- julgar (6.13.17): quem dirige diz se a resposta enviada está certa (ganha os pontos e a resposta é revelada) ou errada (fica na lista
    // das erradas e a questão volta a aceitar respostas) -----
    if (acao === "julgar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const r = programa.partes[parte].jogo && (programa.partes[parte].jogo.rodadas || [])[rodada];
      const envio = ((estado.envios || {})[parte] || {})[rodada];
      if (!r || !envio || envio.status !== "pendente") return erro(res, 400, "Não há resposta esperando julgamento nesta questão.");
      const respostas = (segredo.respostas || {})[parte] || [];
      return gravarEstado((e) => {
        if (corpo.certo === true) {
          e.envios[parte][rodada] = { ...envio, status: "certa" };
          darPontos(e, parte, rodada, r, envio.nome, respostas[rodada]);
        } else {
          e.erradas = e.erradas || {};
          e.erradas[parte] = { ...(e.erradas[parte] || {}), [rodada]: [...(((e.erradas[parte] || {})[rodada]) || []), { nome: envio.nome, texto: envio.texto }].slice(-10) };
          const copia = { ...e.envios[parte] };
          delete copia[rodada];
          e.envios = { ...e.envios, [parte]: copia };
        }
      });
    }

    // ----- julgamento-ia (6.13.60): o resultado do "🤖 Apelar para a IA" sobre uma resposta da lista das erradas (indice). Certo: a resposta passa a
    // valer (pontos, resposta revelada). Errado: a resposta fica na lista, marcada como já julgada pela IA (só uma apelação por resposta).
    // O comentário divertido da IA fica junto, para todos verem. Quem dirige é quem pede (a IA é consultada em api/sugerir-formatacao.mjs). -----
    if (acao === "julgamento-ia") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const indice = Number(corpo.indice);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const r = programa.partes[parte].jogo && (programa.partes[parte].jogo.rodadas || [])[rodada];
      const lista = ((estado.erradas || {})[parte] || {})[rodada] || [];
      const item = lista[indice];
      if (!r || !item) return erro(res, 400, "Não encontrei essa resposta errada.");
      if (item.ia) return erro(res, 409, "A IA já julgou esta resposta.");
      if (((estado.reveladas || {})[parte] || {})[rodada] || ((estado.acertos || {})[parte] || {})[rodada]) return erro(res, 409, "Esta questão já foi respondida.");
      const comentario = texto(corpo.comentario, 240).replace(/\s+/g, " ");
      const respostas = (segredo.respostas || {})[parte] || [];
      return gravarEstado((e) => {
        if (corpo.certo === true) {
          e.erradas[parte][rodada] = lista.filter((_, i) => i !== indice);
          e.envios = e.envios || {};
          e.envios[parte] = { ...(e.envios[parte] || {}), [rodada]: { nome: item.nome, texto: item.texto, em: Date.now(), status: "certa", ia: comentario || "A IA aceitou a resposta." } };
          darPontos(e, parte, rodada, r, item.nome, respostas[rodada]);
        } else {
          e.erradas[parte][rodada] = lista.map((x, i) => (i === indice ? { ...x, ia: comentario || "A IA manteve o julgamento." } : x));
        }
      });
    }

    // ----- foco (6.14.00): quem administra o jogo escolhe a questão que todos veem; cada jogador pode mudar a sua tela depois, mas a próxima escolha
    // de quem administra leva todos para ela de novo (o "n" muda a cada escolha, e os aparelhos só seguem um "n" novo) -----
    if (acao === "foco") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const rodadas = (programa.partes[parte].jogo && programa.partes[parte].jogo.rodadas) || [];
      if (!Number.isInteger(rodada) || rodada < 0 || rodada >= rodadas.length) return erro(res, 400, "Questão inválida.");
      return gravarEstado((e) => {
        const f = e.foco && typeof e.foco === "object" ? e.foco : {};
        e.foco = { ...f, [parte]: { rodada, n: (Number((f[parte] || {}).n) || 0) + 1 } };
      });
    }

    if (acao === "cronometro") {
      // Cronômetro da parte (6.11.51): o servidor guarda só o início e o tempo restante; cada aparelho conta os segundos sozinho,
      // acertando o relógio pela hora do servidor (agora).
      const parte = Number(corpo.parte);
      const comando = String(corpo.comando || "");
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      if (!["iniciar", "pausar", "zerar"].includes(comando)) return erro(res, 400, "Comando do cronômetro inválido.");
      const totalMs = Math.min(180, Math.max(1, Math.round(Number(programa.partes[parte].minutos) || 5))) * 60000;
      return gravarEstado((e) => {
        const agora = Date.now();
        const c = e.cronometro && e.cronometro.parte === parte ? e.cronometro : { parte, totalMs, restanteMs: totalMs, inicio: null, rodando: false };
        if (comando === "iniciar" && !c.rodando) Object.assign(c, { inicio: agora, rodando: true });
        else if (comando === "pausar" && c.rodando) Object.assign(c, { restanteMs: c.restanteMs - (agora - c.inicio), inicio: null, rodando: false });
        else if (comando === "zerar") Object.assign(c, { restanteMs: c.totalMs, inicio: null, rodando: false });
        e.cronometro = c;
      });
    }

    if (acao === "passar-direcao") {
      const codigoDirigente = gerarCodigo(TAM_CODIGO_DIRIGENTE);
      segredo.direcao = { hash: hash(codigoDirigente), expira: Date.now() + VALIDADE_DIRECAO_MS };
      await gravarJson(caminho(cod, "respostas.json"), segredo);
      return res.status(200).json({ codigoDirigente, validoAte: segredo.direcao.expira });
    }

    if (acao === "encerrar") {
      await apagarSessao(cod);
      return res.status(200).json({ ok: true });
    }

    return erro(res, 400, "Ação desconhecida.");
  } catch (e) {
    if (ehConflito(e) && ACOES_QUE_GRAVAM.has(acao)) throw e; // outro pedido gravou no meio: o handler refaz a ação
    console.error("familia-sessao:", acao, e && (e.stack || e.message));
    return erro(res, 500, "Não consegui acessar a adoração compartilhada agora. Tente de novo.");
  }
}
