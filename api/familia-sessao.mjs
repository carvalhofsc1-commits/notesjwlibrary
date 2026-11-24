// Adoração em Família compartilhada (6.11.47): quem preparou a programação (o dirigente) cria uma sessão e passa o código aos
// participantes; o dirigente libera as partes, sorteia quem responde e revela as respostas dos jogos, e todos acompanham ao vivo
// (o app consulta o estado a cada poucos segundos; sem WebSocket, porque o Cloud Run escala para zero e pode ter várias instâncias).
//
// Ações (POST, campo "acao"): criar · entrar · estado · liberar · bloquear · sortear · revelar · passar-direcao · assumir · encerrar.
// Arquivos em familia-sessoes/<CODIGO>/ (api/_blob.mjs):
//  - programa.json      a programação SEM as respostas dos jogos (não muda depois de criada);
//  - respostas.json     só o servidor lê: as respostas e as referências das rodadas dos jogos (6.12.76), o hash (SHA-256) das chaves do
//                       dirigente e os extras dele (preparação, tarefas, dica, a ordem certa do "Ordem e data");
//  - estado.json        só as ações do dirigente gravam: partes liberadas, sorteio, respostas (e referências) reveladas e o número da versão;
//  - participantes/<id>.json  um arquivo por participante (ninguém grava no arquivo do outro).
// A chave do dirigente nunca é guardada em texto; a sessão vence depois de 48 horas sem uso e é apagada na próxima vez que alguém
// tenta abri-la (ou quando outra sessão é criada).
import { createHash, randomBytes, randomInt } from "node:crypto";
import { erro, origemPermitida, textosIguais } from "./_comum.mjs";
import { blobConfigurado, del, get, list, put } from "./_blob.mjs";
import { mensagemSeBloqueado, prepararCodigosPessoais, recursoCodigoValido } from "./_acessoSite.mjs";
import { lerArtigoDoWol, lerTextoDoVideo, pesquisarNoWol, playerDoVideo, videoDoEndereco } from "./_wol.mjs";
import { lerCanticos } from "./_fontes.mjs";

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

// Tentativas erradas (código de sessão inexistente, chave ou código do dirigente errados), por IP (em memória, por instância), como em config.mjs.
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

// O estado da sessão, ou null se ela não existe ou venceu (e então é apagada).
async function lerEstado(cod) {
  const estado = await lerJson(caminho(cod, "estado.json"));
  if (!estado) return null;
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
  return itens.filter((p) => p && p.id && p.nome).sort((a, b) => (a.entrouEm || 0) - (b.entrouEm || 0)).map((p) => ({ id: p.id, nome: p.nome }));
}
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
    // 6.12.77: a ordem certa do "Ordem e data" que quem dirige já revelou ({ parte: [{ data, evento }] }); antes disso ela fica só em respostas.json.
    ordensReveladas: e.ordensReveladas && typeof e.ordensReveladas === "object" ? e.ordensReveladas : {},
    sorteio: e.sorteio || null,
    sorteioQuestao: e.sorteioQuestao || null, // { parte, rodada, n }: a questão sorteada para ser respondida
    cronometro: e.cronometro || null,
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
      const rodadas = lista(j.rodadas, 60, (r) => (r && typeof r === "object" && texto(r.pergunta, 600) ? { pergunta: texto(r.pergunta, 600), resposta: texto(r.resposta, 600), referencia: texto(r.referencia, 120) } : null));
      if (rodadas.length) respostas[i] = rodadas.map((r) => r.resposta);
      // 6.12.76: a referência de cada rodada também é resposta (no Complete o versículo e no Quem disse isso? ela entrega a resposta): vai
      // para respostas.json e só chega a todos quando quem dirige revela a rodada (estado.referenciasReveladas).
      if (rodadas.some((r) => r.referencia)) referencias[i] = rodadas.map((r) => r.referencia);
      const ordem = lista(j.ordem, 12, (o) => (o && typeof o === "object" && texto(o.evento, 300) ? { data: texto(o.data, 40), evento: texto(o.evento, 300) } : null));
      if (ordem.length) ordens[i] = ordem;
      parte.jogo = {
        tipo: texto(j.tipo, 120),
        nome: texto(j.nome, 160),
        comoJogar: texto(ordem.length ? String(j.comoJogar || "").replace(SUFIXO_ORDEM_CERTA, "") : j.comoJogar, 3000),
        material: texto(j.material, 600),
        rodadas: rodadas.map((r) => ({ pergunta: r.pergunta })),
        itens: lista(j.itens, 80, (t) => texto(t, 600)),
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
  const extras = {
    preparacao: lista(op.preparacao, 20, (t) => texto(t, 400)),
    tarefas: lista(op.tarefas, 20, (t) => (t && typeof t === "object" ? { membro: texto(t.membro, 60), tarefa: texto(t.tarefa, 300) } : null)),
    dicaParaOChefe: texto(op.dicaParaOChefe, 800),
    // 6.12.70: o FunPlayB saiu (extras.funplayb não é mais guardado; programações antigas com ele continuam sendo compartilhadas sem esse extra).
  };
  if (Object.keys(ordens).length) extras.ordens = ordens; // { índice da parte: [{ data, evento }] } (só quem dirige)
  return { programa, respostas, referencias, extras };
}

// ---------- Handler ----------
export default async function handler(req, res) {
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
  if (bloqueado(ip)) return erro(res, 429, "Muitas tentativas erradas. Tente novamente mais tarde.");

  try {
    // ----- criar: exige o mesmo acesso da Adoração em Família (código de pesquisa ou senha de administrador) -----
    if (acao === "criar") {
      await prepararCodigosPessoais();
      const bloqueio = await mensagemSeBloqueado({ aparelhoId: corpo.aparelhoId, codigoAdmin: corpo.codigoAdmin });
      if (bloqueio) return erro(res, 403, bloqueio);
      if (!recursoCodigoValido("pesquisa", corpo.codigo, corpo.aparelhoId)) {
        registrarErro(ip);
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
      await gravarJson(caminho(cod, "estado.json"), { versao: 1, liberadas: [], atual: null, reveladas: {}, sorteio: null, cronometro: null, atualizadoEm: agora });
      return res.status(200).json({ sessao: cod, chave });
    }

    // ----- As outras ações começam pelo código da sessão -----
    const cod = codigoLimpo(corpo.sessao);
    if (!cod) {
      registrarErro(ip);
      return erro(res, 400, "Código da adoração inválido. São 6 letras e números.");
    }
    const estado = await lerEstado(cod);
    if (!estado) {
      registrarErro(ip);
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
      registrarErro(ip);
      erro(res, 403, "Só quem dirige a adoração pode fazer isso.");
      return false;
    };
    const gravarEstado = async (mudar) => {
      mudar(estado);
      estado.versao = (Number(estado.versao) || 0) + 1;
      estado.atualizadoEm = Date.now();
      await gravarJson(caminho(cod, "estado.json"), estado);
      const qtd = await contarParticipantes(cod);
      return res.status(200).json({ versao: versaoDe(estado, qtd), estado: estadoPublico(estado), participantes: await lerParticipantes(cod), agora: Date.now() });
    };

    // ----- entrar: a programação sem respostas, o estado e o id do participante (o dirigente pode entrar sem nome) -----
    if (acao === "entrar") {
      const bloqueio = await mensagemSeBloqueado({ aparelhoId: corpo.aparelhoId, codigoAdmin: corpo.codigoAdmin });
      if (bloqueio) return erro(res, 403, bloqueio);
      const dirigente = await ehDirigente();
      if (typeof corpo.chave === "string" && corpo.chave && !dirigente) {
        registrarErro(ip);
        return erro(res, 403, "A chave de dirigente deste aparelho não vale para esta adoração.");
      }
      const programa = await lerJson(caminho(cod, "programa.json"));
      if (!programa) return erro(res, 404, "A programação desta adoração não foi encontrada.");
      const nome = nomeLimpo(corpo.nome);
      let participanteId = "";
      if (nome) {
        participanteId = idLimpo(corpo.participanteId);
        const existente = participanteId ? await lerJson(caminho(cod, `participantes/${participanteId}.json`)) : null;
        if (!existente) {
          if ((await contarParticipantes(cod)) >= MAX_PARTICIPANTES) return erro(res, 409, `Esta adoração já tem ${MAX_PARTICIPANTES} participantes.`);
          participanteId = randomBytes(12).toString("base64url");
        }
        await gravarJson(caminho(cod, `participantes/${participanteId}.json`), { id: participanteId, nome, entrouEm: existente ? existente.entrouEm : Date.now() });
      } else if (!dirigente) {
        // Sem nome: só confere o código e devolve o título e os nomes informados, para a pessoa escolher o dela (não entra ainda).
        return res.status(200).json({ sessao: cod, precisaNome: true, titulo: programa.titulo, emoji: programa.emoji, nomes: programa.nomes || [] });
      }
      const resposta = { sessao: cod, programa, participanteId, dirigente, agora: Date.now() };
      if (dirigente) {
        const qtd = await contarParticipantes(cod);
        Object.assign(resposta, { versao: versaoDe(estado, qtd), estado: estadoPublico(estado), participantes: await lerParticipantes(cod), extras: segredo.extras || null });
      } else Object.assign(resposta, { versao: versaoDe(estado), estado: estadoPublico(estado) });
      return res.status(200).json(resposta);
    }

    // ----- estado: só o número da versão quando nada mudou -----
    if (acao === "estado") {
      const dirigente = await ehDirigente();
      const qtd = dirigente ? await contarParticipantes(cod) : null;
      const versao = versaoDe(estado, qtd);
      if (String(corpo.versao || "") === versao) return res.status(200).json({ versao, agora: Date.now() });
      const r = { versao, estado: estadoPublico(estado), agora: Date.now() };
      if (dirigente) r.participantes = await lerParticipantes(cod);
      return res.status(200).json(r);
    }

    // ----- video (6.11.56): o vídeo de uma parte para tocar na tela da adoração, com a transcrição (a legenda publicada). Vale para quem tem o
    // código da sessão, e só para partes que o dirigente já liberou (o dirigente vê todas). Guardado 6 h na instância, por vídeo. -----
    if (acao === "video") {
      const parte = Number(corpo.parte);
      const indice = Number(corpo.video);
      const programa = await lerJson(caminho(cod, "programa.json"));
      const v = programa && Number.isInteger(parte) && Number.isInteger(indice) && programa.partes && programa.partes[parte] && (programa.partes[parte].videos || [])[indice];
      if (!v || !v.link) return erro(res, 404, "Esse vídeo não está nesta programação.");
      if (!(estado.liberadas || []).includes(parte) && !(await ehDirigente())) return erro(res, 403, "Esta parte ainda não foi liberada pelo dirigente.");
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
      if (!(estado.liberadas || []).includes(parte) && !(await ehDirigente())) return erro(res, 403, "Esta parte ainda não foi liberada pelo dirigente.");
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
      if (!(estado.liberadas || []).includes(parte) && !(await ehDirigente())) return erro(res, 403, "Esta parte ainda não foi liberada pelo dirigente.");
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
        registrarErro(ip);
        return erro(res, 403, "Código do dirigente inválido ou vencido. Peça um novo a quem está dirigindo.");
      }
      const chave = randomBytes(32).toString("base64url");
      segredo.chaves = [...(segredo.chaves || []), hash(chave)].slice(-MAX_CHAVES);
      segredo.direcao = null; // uso único
      await gravarJson(caminho(cod, "respostas.json"), segredo);
      return res.status(200).json({ sessao: cod, chave });
    }

    // ----- Daqui em diante, só o dirigente -----
    if (!(await exigirDirigente())) return;
    const programa = ["liberar", "bloquear", "revelar", "revelar-ordem", "dica", "pontuar", "reiniciar", "sortear", "sortear-questao", "limpar-sorteio", "cronometro"].includes(acao) ? await lerJson(caminho(cod, "programa.json")) : null;
    const parteValida = (i) => programa && Number.isInteger(i) && i >= 0 && i < programa.partes.length;
    // 6.12.76: a referência secreta da rodada (respostas.json; sessões antigas não a têm) e a revelação dela junto com a resposta.
    const referenciaDaRodada = (parte, rodada) => String((((segredo && segredo.referencias) || {})[parte] || [])[rodada] || "");
    const revelarReferencia = (e, parte, rodada) => {
      const ref = referenciaDaRodada(parte, rodada);
      if (!ref) return;
      e.referenciasReveladas = e.referenciasReveladas || {};
      e.referenciasReveladas[parte] = { ...(e.referenciasReveladas[parte] || {}), [rodada]: ref };
    };
    // 6.12.77: a ordem certa do "Ordem e data" (respostas.json, extras.ordens) e a revelação dela para todos (estado.ordensReveladas).
    const ordemDaParte = (parte) => {
      const o = (((segredo && segredo.extras) || {}).ordens || {})[parte];
      return Array.isArray(o) && o.length ? o : null;
    };
    const revelarOrdem = (e, parte, ordem) => {
      e.ordensReveladas = { ...(e.ordensReveladas || {}), [parte]: ordem };
    };

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
      if (!Number.isInteger(rodada) || rodada < 0 || rodada >= respostas.length) return erro(res, 400, "Rodada inválida.");
      return gravarEstado((e) => {
        e.reveladas = e.reveladas || {};
        e.reveladas[parte] = { ...(e.reveladas[parte] || {}), [rodada]: respostas[rodada] };
        revelarReferencia(e, parte, rodada);
      });
    }

    // ----- revelar-ordem (6.12.77): no "Ordem e data", mostra a todos a ordem certa com as datas (sem pontuar ninguém) -----
    if (acao === "revelar-ordem") {
      const parte = Number(corpo.parte);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      const ordem = ordemDaParte(parte);
      if (!ordem) return erro(res, 400, "Esta parte não tem ordem para revelar.");
      return gravarEstado((e) => revelarOrdem(e, parte, ordem));
    }

    // ----- espiar (6.12.06): só o dirigente vê a resposta da rodada, sem revelá-la aos participantes (nada é gravado no estado) -----
    // 6.12.76: com a referência da rodada (o texto bíblico que confirma), que também fica escondida dos participantes.
    if (acao === "espiar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const respostas = (segredo.respostas || {})[parte] || [];
      if (!Number.isInteger(parte) || !Number.isInteger(rodada) || rodada < 0 || rodada >= respostas.length) return erro(res, 400, "Rodada inválida.");
      return res.status(200).json({ resposta: String(respostas[rodada] || ""), referencia: referenciaDaRodada(parte, rodada) });
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
        if (dadas < total) e.dicas[parte] = { ...mapa, [rodada]: dadas + 1 };
      });
    }

    // ----- pontuar (6.11.97): quem acertou a rodada ganha os pontos de agora (total de dicas − dicas dadas + 1) e a resposta é revelada -----
    if (acao === "pontuar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      const ninguem = corpo.ninguem === true; // 6.12.06: "Ninguém acertou": revela a resposta sem pontuar ninguém
      const nome = ninguem ? "" : nomeLimpo(corpo.nome);
      if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
      // 6.12.77: no "Ordem e data" (rodada "ordem"), quem dirige escolhe quem acertou e quantos pontos (0 até o número de eventos + 2); a ordem é revelada.
      if (corpo.rodada === "ordem") {
        const ordem = ordemDaParte(parte);
        if (!ordem) return erro(res, 400, "Esta parte não tem ordem para pontuar.");
        if (!nome && !ninguem) return erro(res, 400, "Escolha quem acertou.");
        const ptsOrdem = Number(corpo.pts);
        if (!ninguem && (!Number.isInteger(ptsOrdem) || ptsOrdem < 0 || ptsOrdem > ordem.length + 2)) return erro(res, 400, "Pontos inválidos.");
        return gravarEstado((e) => {
          e.acertos = e.acertos || {};
          e.acertos[parte] = { ...(e.acertos[parte] || {}), ordem: ninguem ? { nome: "", pts: 0, ninguem: true } : { nome, pts: ptsOrdem } };
          revelarOrdem(e, parte, ordem);
        });
      }
      const r = programa.partes[parte].jogo && (programa.partes[parte].jogo.rodadas || [])[rodada];
      const respostas = (segredo.respostas || {})[parte] || [];
      if (!Number.isInteger(rodada) || !r || rodada >= respostas.length) return erro(res, 400, "Rodada inválida.");
      if (!nome && !ninguem) return erro(res, 400, "Escolha quem acertou.");
      const total = Math.max(1, (String(r.pergunta).match(/Dica\s*\d+\s*:/gi) || []).length);
      const dadas = Math.min(total, Number(((estado.dicas || {})[parte] || {})[rodada]) || 0);
      if (!dadas && !ninguem) return erro(res, 400, "Dê ao menos a primeira dica antes de pontuar.");
      const pts = ninguem ? 0 : Math.max(1, total - dadas + 1);
      return gravarEstado((e) => {
        e.acertos = e.acertos || {};
        e.acertos[parte] = { ...(e.acertos[parte] || {}), [rodada]: ninguem ? { nome: "", pts: 0, ninguem: true } : { nome, pts } };
        e.reveladas = e.reveladas || {};
        e.reveladas[parte] = { ...(e.reveladas[parte] || {}), [rodada]: respostas[rodada] };
        revelarReferencia(e, parte, rodada);
      });
    }

    // ----- reiniciar (6.12.29): volta a questão ao começo: sem dicas dadas, resposta escondida de novo e sem pontos (quem tinha pontuado perde esses pontos) -----
    if (acao === "reiniciar") {
      const parte = Number(corpo.parte);
      const rodada = Number(corpo.rodada);
      // 6.12.77: "ordem" esconde de novo a ordem certa do "Ordem e data" e tira os pontos dela.
      if (corpo.rodada === "ordem") {
        if (!parteValida(parte)) return erro(res, 400, "Parte inválida.");
        return gravarEstado((e) => {
          if (e.acertos && e.acertos[parte]) {
            const copia = { ...e.acertos[parte] };
            delete copia.ordem;
            e.acertos = { ...e.acertos, [parte]: copia };
          }
          if (e.ordensReveladas) {
            const copia = { ...e.ordensReveladas };
            delete copia[parte];
            e.ordensReveladas = copia;
          }
        });
      }
      if (!parteValida(parte) || !Number.isInteger(rodada) || rodada < 0) return erro(res, 400, "Rodada inválida.");
      return gravarEstado((e) => {
        for (const campo of ["dicas", "reveladas", "acertos", "referenciasReveladas"]) {
          if (e[campo] && e[campo][parte]) {
            const copia = { ...e[campo][parte] };
            delete copia[rodada];
            e[campo] = { ...e[campo], [parte]: copia };
          }
        }
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
    console.error("familia-sessao:", acao, e && (e.stack || e.message));
    return erro(res, 500, "Não consegui acessar a adoração compartilhada agora. Tente de novo.");
  }
}
