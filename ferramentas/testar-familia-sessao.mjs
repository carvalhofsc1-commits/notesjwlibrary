// Teste da Adoração em Família compartilhada (api/familia-sessao.mjs), sem rede e sem gravar em produção:
// usa HOSPEDAGEM=local com uma pasta temporária e chama o handler direto, com pedidos e respostas de mentira.
// Uso: node ferramentas/testar-familia-sessao.mjs
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

process.env.HOSPEDAGEM = "local";
process.env.DADOS_DIR = await mkdtemp(join(tmpdir(), "familia-sessao-"));
process.env.CODIGO_ESTUDO = "codigo-de-teste";
// O cadastro do aparelho (acesso normal ao app) vale também aqui; nos testes, a senha de administrador libera o aparelho de mentira.
process.env.CODIGO_ADMIN = "admin-de-teste";

const { default: handler } = await import("../api/familia-sessao.mjs");

let ipAtual = "10.0.0.1";
async function chamar(corpo, origem = "http://localhost:8091", semCadastro = false) {
  const req = { method: "POST", headers: { origin: origem, "x-forwarded-for": ipAtual }, body: semCadastro ? corpo : { codigoAdmin: "admin-de-teste", ...corpo } };
  const res = {
    statusCode: 200, cabecalhos: {}, corpo: null,
    setHeader(k, v) { this.cabecalhos[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(d) { this.corpo = d; return this; },
  };
  await handler(req, res);
  return { status: res.statusCode, dados: res.corpo };
}

const RESPOSTAS = ["Moisés", "Davi", "Verdadeiro"];
const programa = {
  titulo: "Coragem nas provas", emoji: "🛡️", resumo: "Uma noite sobre coragem.", objetivo: "Confiar em Jeová.",
  partes: [
    { nome: "Oração inicial", minutos: 2, descricao: "Um da família ora." },
    { nome: "Leitura", minutos: 10, textos: [{ referencia: "1 Samuel 17:45", texto: "Você vem contra mim…" }], videos: [{ titulo: "Um vídeo", duracao: "3:00", link: "https://www.jw.org/finder?srcid=share&wtlocale=T&lank=pub-jwb-128_7_VIDEO" }], canticos: [{ numero: 131, titulo: "O que Jeová uniu" }] },
    {
      nome: "Jogo", minutos: 15, descricao: "Quem sou eu?",
      jogo: {
        tipo: "Quem sou eu?", idTipo: "quem_sou_eu", nome: "Quem sou eu?", comoJogar: "Leia as pistas.", material: null,
        rodadas: [
          { pergunta: "Abri o mar Vermelho com a vara.", resposta: RESPOSTAS[0], referencia: "Êxodo 14:21" },
          { pergunta: "Venci o gigante com uma funda.", resposta: RESPOSTAS[1], referencia: "1 Samuel 17:49" },
          { pergunta: "Dica 1: Fiquei três dias no peixe. Dica 2: Fui enviado a Nínive. Dica 3: Sou profeta.", resposta: RESPOSTAS[2], referencia: "Jonas 1:17" },
        ],
        itens: ["Cartão extra sem resposta"],
      },
    },
  ],
  preparacao: ["Separar a Bíblia"], dicaParaOChefe: "Elogie cada um.",
};
const semResposta = (obj, rotulo) => {
  const s = JSON.stringify(obj);
  for (const r of RESPOSTAS) assert.ok(!s.includes(r), `${rotulo}: a resposta "${r}" vazou antes de ser revelada`);
};

let ok = 0;
const passo = (t) => { ok++; console.log("✔ " + t); };

try {
  // Origem e acesso
  assert.equal((await chamar({ acao: "criar", programa }, "https://exemplo.com")).status, 403); passo("origem de fora recusada");
  assert.equal((await chamar({ acao: "criar", programa, codigo: "errado" })).status, 403); passo("criar sem o código de pesquisa recusado");

  // Criar
  const criada = await chamar({ acao: "criar", programa, codigo: "codigo-de-teste", nomes: ["Pai", "Mãe", "Ana", "ana", "x".repeat(60)] });
  assert.equal(criada.status, 200, JSON.stringify(criada.dados));
  const { sessao, chave } = criada.dados;
  assert.match(sessao, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/); passo(`sessão criada: ${sessao} (sem 0/O/1/I/L)`);
  assert.ok(chave.length >= 40); passo("chave do dirigente longa");

  // Arquivos gravados: a chave só como hash; respostas fora do programa.json
  const { readFile } = await import("node:fs/promises");
  const pasta = join(process.env.DADOS_DIR, "familia-sessoes", sessao);
  const programaArq = await readFile(join(pasta, "programa.json"), "utf8");
  const respostasArq = await readFile(join(pasta, "respostas.json"), "utf8");
  const estadoArq = await readFile(join(pasta, "estado.json"), "utf8");
  semResposta(programaArq, "programa.json");
  assert.ok(!respostasArq.includes(chave) && !programaArq.includes(chave) && !estadoArq.includes(chave)); passo("chave do dirigente não está em texto em nenhum arquivo");
  assert.ok(RESPOSTAS.every((r) => respostasArq.includes(r))); passo("respostas guardadas só em respostas.json");
  const nomes = JSON.parse(programaArq).nomes;
  assert.deepEqual(nomes, ["Pai", "Mãe", "Ana", "x".repeat(40)]); passo("nomes informados sem repetição e com até 40 caracteres");

  // Dois participantes
  const p1 = await chamar({ acao: "entrar", sessao: sessao.toLowerCase(), nome: "  Ana  " });
  const p2 = await chamar({ acao: "entrar", sessao, nome: "Pedro" });
  assert.equal(p1.status, 200, JSON.stringify(p1.dados)); assert.equal(p2.status, 200);
  semResposta(p1.dados, "entrar (Ana)"); semResposta(p2.dados, "entrar (Pedro)");
  assert.equal(p1.dados.programa.partes[2].jogo.rodadas[0].pergunta, "Abri o mar Vermelho com a vara.");
  // 6.12.76: a referência da rodada (o texto que confirma a resposta) também fica só em respostas.json até a rodada ser revelada.
  assert.ok(!("referencia" in p1.dados.programa.partes[2].jogo.rodadas[0]));
  assert.deepEqual(Object.keys(p1.dados.programa.partes[2].jogo.rodadas[0]), ["pergunta"]);
  for (const [rotulo, s] of [["programa.json", programaArq], ["entrar", JSON.stringify(p1.dados)]]) assert.ok(!s.includes("Êxodo 14:21") && !s.includes("1 Samuel 17:49"), rotulo);
  assert.deepEqual(JSON.parse(respostasArq).referencias, { 2: ["Êxodo 14:21", "1 Samuel 17:49", "Jonas 1:17"] });
  assert.equal(p1.dados.programa.partes[2].jogo.idTipo, "quem_sou_eu"); passo("referências das rodadas só em respostas.json (nem no programa nem no entrar); idTipo do jogo guardado");
  assert.equal(p1.dados.dirigente, false);
  assert.ok(!("extras" in p1.dados) && !("participantes" in p1.dados)); passo("participantes entram sem receber respostas, extras do dirigente nem a lista");
  const volta = await chamar({ acao: "entrar", sessao, nome: "Aninha", participanteId: p1.dados.participanteId });
  assert.equal(volta.dados.participanteId, p1.dados.participanteId); passo("voltar com o mesmo id não duplica o participante");
  const semNome = await chamar({ acao: "entrar", sessao, nome: "   " });
  assert.equal(semNome.dados.precisaNome, true); assert.ok(!semNome.dados.participanteId && !semNome.dados.programa);
  assert.deepEqual(semNome.dados.nomes, nomes); passo("sem nome, só confere o código e devolve os nomes para escolher (não entra)");
  const semCad = await chamar({ acao: "entrar", sessao, nome: "Visita", aparelhoId: "aparelho-sem-cadastro-123" }, undefined, true);
  assert.equal(semCad.status, 403); assert.match(semCad.dados.erro, /cadastro|identificar/i); passo("aparelho sem o acesso normal ao app não entra");

  // Estado
  const e1 = await chamar({ acao: "estado", sessao, versao: "" });
  semResposta(e1.dados, "estado");
  const e2 = await chamar({ acao: "estado", sessao, versao: e1.dados.versao });
  assert.deepEqual(Object.keys(e2.dados), ["versao", "agora"]); passo("estado sem mudança devolve só { versao } (e a hora do servidor)");

  // Dirigente
  const d = await chamar({ acao: "entrar", sessao, chave });
  assert.equal(d.dados.dirigente, true);
  assert.deepEqual(d.dados.participantes.map((p) => p.nome), ["Aninha", "Pedro"]);
  assert.equal(d.dados.extras.dicaParaOChefe, "Elogie cada um.");
  semResposta(d.dados, "entrar (dirigente)"); passo("dirigente entra sem nome, vê quem entrou e os extras, mas também sem respostas");

  // Chave errada: todas as ações do dirigente recusam
  ipAtual = "10.0.0.2";
  const errada = chave.slice(0, -4) + "AAAA";
  for (const acao of ["liberar", "bloquear", "sortear", "revelar", "passar-direcao", "encerrar"]) {
    const r = await chamar({ acao, sessao, chave: errada, parte: 2, rodada: 0 });
    assert.equal(r.status, 403, acao);
  }
  assert.equal((await chamar({ acao: "liberar", sessao, parte: 0 })).status, 403); passo("ações do dirigente recusam chave errada ou ausente");
  for (let i = 0; i < 6; i++) await chamar({ acao: "estado", sessao: "ZZZZZZ" });
  assert.equal((await chamar({ acao: "estado", sessao })).status, 429); passo("muitas tentativas erradas bloqueiam o IP");
  ipAtual = "10.0.0.1";

  // Liberar, sortear, revelar
  const lib = await chamar({ acao: "liberar", sessao, chave, parte: 2 });
  assert.deepEqual(lib.dados.estado.liberadas, [2]); assert.equal(lib.dados.estado.atual, 2);
  semResposta(lib.dados, "liberar");
  const e3 = await chamar({ acao: "estado", sessao, versao: e1.dados.versao });
  assert.deepEqual(e3.dados.estado.liberadas, [2]); semResposta(e3.dados, "estado depois de liberar"); passo("liberar muda a versão e todos veem a parte liberada");
  assert.equal((await chamar({ acao: "liberar", sessao, chave, parte: 9 })).status, 400); passo("parte inexistente recusada");
  // Vídeo da parte (6.11.56): só de partes liberadas (sem rede aqui: só as recusas), e vídeo que não existe dá 404.
  assert.equal((await chamar({ acao: "video", sessao, parte: 1, video: 0 })).status, 403); passo("vídeo de parte ainda bloqueada recusado ao participante");
  assert.equal((await chamar({ acao: "video", sessao, parte: 2, video: 0 })).status, 404); passo("vídeo que não está na programação: 404");
  assert.equal((await chamar({ acao: "video", sessao, parte: 1, video: 5, chave })).status, 404); passo("índice de vídeo inexistente: 404");
  assert.equal((await chamar({ acao: "cantico", sessao, parte: 1, cantico: 0 })).status, 403); passo("cântico de parte ainda bloqueada recusado ao participante");
  assert.equal((await chamar({ acao: "cantico", sessao, parte: 1, cantico: 5, chave })).status, 404); passo("índice de cântico inexistente: 404");

  const sorteados = [];
  for (let i = 0; i < 6; i++) sorteados.push((await chamar({ acao: "sortear", sessao, chave, fonte: "participantes" })).dados.estado.sorteio.nome);
  assert.ok(sorteados.every((n, i) => i === 0 || n !== sorteados[i - 1]), sorteados.join(",")); passo("sorteio entre participantes nunca repete a pessoa em seguida: " + sorteados.join(", "));
  const sn = await chamar({ acao: "sortear", sessao, chave, fonte: "nomes" });
  assert.ok(nomes.includes(sn.dados.estado.sorteio.nome)); passo("sorteio entre os nomes informados");

  const rev = await chamar({ acao: "revelar", sessao, chave, parte: 2, rodada: 1 });
  assert.equal(rev.dados.estado.reveladas[2][1], "Davi");
  const e4 = await chamar({ acao: "estado", sessao, versao: "" });
  const s4 = JSON.stringify(e4.dados);
  assert.ok(s4.includes("Davi") && !s4.includes("Moisés") && !s4.includes("Verdadeiro")); passo("revelar mostra só a resposta escolhida");
  assert.equal(e4.dados.estado.referenciasReveladas[2][1], "1 Samuel 17:49");
  assert.ok(!s4.includes("Êxodo 14:21") && !s4.includes("Jonas 1:17")); passo("revelar mostra a referência só da rodada revelada (estado.referenciasReveladas)");
  const esp = await chamar({ acao: "espiar", sessao, chave, parte: 2, rodada: 0 });
  assert.deepEqual(esp.dados, { resposta: "Moisés", referencia: "Êxodo 14:21" });
  assert.ok(!JSON.stringify((await chamar({ acao: "estado", sessao, versao: "" })).dados).includes("Êxodo 14:21")); passo("espiar devolve resposta e referência só a quem dirige, sem gravar no estado");
  const rei = await chamar({ acao: "reiniciar", sessao, chave, parte: 2, rodada: 1 });
  assert.ok(!(1 in (rei.dados.estado.referenciasReveladas[2] || {})) && !(1 in (rei.dados.estado.reveladas[2] || {}))); passo("reiniciar esconde de novo a resposta e a referência");
  assert.equal((await chamar({ acao: "revelar", sessao, chave, parte: 2, rodada: 7 })).status, 400); passo("rodada inexistente recusada");

  // Dicas (6.11.96): uma de cada vez, no máximo as que a pergunta tem (3 na rodada 2; a rodada 0 não tem marcadores e vale 1)
  assert.equal((await chamar({ acao: "dica", sessao, parte: 2, rodada: 2 })).status, 403); passo("dica sem a chave do dirigente recusada");
  const d1 = await chamar({ acao: "dica", sessao, chave, parte: 2, rodada: 2 });
  assert.equal(d1.dados.estado.dicas[2][2], 1);
  await chamar({ acao: "dica", sessao, chave, parte: 2, rodada: 2 });
  await chamar({ acao: "dica", sessao, chave, parte: 2, rodada: 2 });
  const d4 = await chamar({ acao: "dica", sessao, chave, parte: 2, rodada: 2 });
  assert.equal(d4.dados.estado.dicas[2][2], 3); passo("dicas: 1, 2, 3 e para no máximo da pergunta");
  const d0 = await chamar({ acao: "dica", sessao, chave, parte: 2, rodada: 0 });
  assert.equal(d0.dados.estado.dicas[2][0], 1);
  assert.equal((await chamar({ acao: "dica", sessao, chave, parte: 2, rodada: 9 })).status, 400); passo("rodada sem marcadores vale 1 dica; rodada inexistente recusada");

  // Pontuar (6.11.97): quem acertou ganha total − dicas dadas + 1 e a resposta é revelada
  assert.equal((await chamar({ acao: "pontuar", sessao, parte: 2, rodada: 2, nome: "Ana" })).status, 403); passo("pontuar sem a chave do dirigente recusado");
  assert.equal((await chamar({ acao: "pontuar", sessao, chave, parte: 2, rodada: 1, nome: "Ana" })).status, 400); passo("pontuar antes da primeira dica recusado");
  assert.equal((await chamar({ acao: "pontuar", sessao, chave, parte: 2, rodada: 2, nome: "" })).status, 400); passo("pontuar sem escolher quem acertou recusado");
  const pt = await chamar({ acao: "pontuar", sessao, chave, parte: 2, rodada: 2, nome: "Ana" });
  assert.deepEqual(pt.dados.estado.acertos[2][2], { nome: "Ana", pts: 1 });
  assert.equal(pt.dados.estado.reveladas[2][2], "Verdadeiro"); passo("3 dicas dadas: Ana ganha 1 ponto e a resposta é revelada");

  const blo = await chamar({ acao: "bloquear", sessao, chave, parte: 2 });
  assert.deepEqual(blo.dados.estado.liberadas, []); assert.equal(blo.dados.estado.atual, null); passo("voltar a bloquear");

  // Cronômetro da parte (6.11.51)
  const c1 = await chamar({ acao: "cronometro", sessao, chave, parte: 1, comando: "iniciar" });
  assert.equal(c1.status, 200);
  assert.deepEqual([c1.dados.estado.cronometro.parte, c1.dados.estado.cronometro.totalMs, c1.dados.estado.cronometro.rodando], [1, 600000, true]);
  await new Promise((r) => setTimeout(r, 40));
  const c2 = await chamar({ acao: "cronometro", sessao, chave, parte: 1, comando: "pausar" });
  assert.equal(c2.dados.estado.cronometro.rodando, false);
  assert.ok(c2.dados.estado.cronometro.restanteMs < 600000 && c2.dados.estado.cronometro.restanteMs > 590000);
  const c3 = await chamar({ acao: "cronometro", sessao, chave, parte: 1, comando: "zerar" });
  assert.equal(c3.dados.estado.cronometro.restanteMs, 600000);
  assert.equal((await chamar({ acao: "cronometro", sessao, parte: 1, comando: "iniciar" })).status, 403);
  assert.equal((await chamar({ acao: "cronometro", sessao, chave, parte: 9, comando: "iniciar" })).status, 400);
  assert.equal((await chamar({ acao: "estado", sessao })).dados.estado.cronometro.parte, 1);
  passo("cronômetro da parte: iniciar, pausar e zerar, só o dirigente, e todos veem no estado");

  // Passar a direção
  const pd = await chamar({ acao: "passar-direcao", sessao, chave });
  assert.match(pd.dados.codigoDirigente, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  assert.equal((await chamar({ acao: "assumir", sessao, codigoDirigente: "ABCDEFGH" })).status, 403);
  const as = await chamar({ acao: "assumir", sessao, codigoDirigente: pd.dados.codigoDirigente });
  assert.equal(as.status, 200);
  assert.equal((await chamar({ acao: "liberar", sessao, chave: as.dados.chave, parte: 0 })).status, 200);
  assert.equal((await chamar({ acao: "assumir", sessao, codigoDirigente: pd.dados.codigoDirigente })).status, 403); passo("código do dirigente passa a direção e vale uma vez só");

  // Limite de participantes
  for (let i = 0; i < 18; i++) await chamar({ acao: "entrar", sessao, nome: "P" + i });
  assert.equal((await chamar({ acao: "entrar", sessao, nome: "Sobrando" })).status, 409); passo("no máximo 20 participantes");

  // Validade: sessão parada há mais de 48 h é apagada ao acessar
  const { utimes, writeFile } = await import("node:fs/promises");
  const velho = JSON.parse(await readFile(join(pasta, "estado.json"), "utf8"));
  velho.atualizadoEm = Date.now() - 49 * 3600 * 1000;
  await writeFile(join(pasta, "estado.json"), JSON.stringify(velho));
  const { readdir } = await import("node:fs/promises");
  const antigo = new Date(Date.now() - 49 * 3600 * 1000);
  const todos = async (p) => (await readdir(p, { withFileTypes: true })).flatMap((f) => (f.isDirectory() ? [] : [join(p, f.name)]));
  for (const f of [...(await todos(pasta)), ...(await todos(join(pasta, "participantes")))]) await utimes(f, antigo, antigo);
  assert.equal((await chamar({ acao: "estado", sessao })).status, 404); passo("sessão vencida (48 h sem uso) some ao acessar");

  // Programação por quadros (6.12.74, versao 2): quadro em cada parte, rótulo da leitura e a ordem certa do "Ordem e data" só para quem dirige
  const DATA_SECRETA = "4026 a.C.";
  const v2 = {
    versao: 2, titulo: "Perdoar", emoji: "🤝", resumo: "Uma noite sobre perdão.", objetivo: "Perdoar.",
    partes: [
      { quadro: "abertura", nome: "Abertura", minutos: 8, leitura: { titulo: "Um artigo", fonte: "w23.02", texto: "Texto lido no wol.", rotulo: "Parágrafos 3 e 4", url: "https://wol.jw.org/pt/wol/d/r5/lp-t/2023123" } },
      { quadro: "X Y!", nome: "Quadro com id inválido", minutos: 5, descricao: "Sem quadro." },
      {
        quadro: "jogo", nome: "Ordem e data", minutos: 10,
        jogo: {
          tipo: "Ordem e data", nome: "Ordem e data", comoJogar: "Coloquem os cartões em ordem. Ordem certa (datas do Apêndice B da Bíblia de Estudo): 1. " + DATA_SECRETA + " — Criação de Adão; 2. 2370 a.C. — Dilúvio.",
          itens: ["Criação de Adão", "Dilúvio"],
          ordem: [{ data: DATA_SECRETA, evento: "Criação de Adão" }, { data: "2370 a.C.", evento: "Dilúvio" }],
        },
      },
    ],
  };
  const cv2 = (await chamar({ acao: "criar", programa: v2, codigo: "codigo-de-teste" })).dados;
  const prog2 = JSON.parse(await readFile(join(process.env.DADOS_DIR, "familia-sessoes", cv2.sessao, "programa.json"), "utf8"));
  assert.equal(prog2.versao, 2);
  assert.deepEqual(prog2.partes.map((p) => p.quadro), ["abertura", undefined, "jogo"]);
  assert.equal(prog2.partes[0].leitura.rotulo, "Parágrafos 3 e 4"); passo("versao 2: quadro válido em cada parte (id inválido descartado) e rótulo da leitura guardados");
  assert.ok(!JSON.stringify(prog2).includes(DATA_SECRETA) && !prog2.partes[2].jogo.comoJogar.includes("Ordem certa"));
  assert.equal(prog2.partes[2].jogo.comoJogar, "Coloquem os cartões em ordem."); passo("a ordem certa sai do programa.json e do fim de \"comoJogar\" (público)");
  const part2 = await chamar({ acao: "entrar", sessao: cv2.sessao, nome: "Ana" });
  assert.ok(!JSON.stringify(part2.dados).includes(DATA_SECRETA) && !("extras" in part2.dados)); passo("participante não recebe a ordem nem as datas");
  const dir2 = await chamar({ acao: "entrar", sessao: cv2.sessao, chave: cv2.chave });
  assert.deepEqual(dir2.dados.extras.ordens["2"], v2.partes[2].jogo.ordem); passo("quem dirige recebe a ordem certa em extras.ordens[índice da parte]");
  // 6.13.36: jogo avulso (tela Jogos bíblicos): programa.modo = "jogos" e o jogo já começa liberado e aberto
  const avulso = (await chamar({ acao: "criar", programa: { modo: "jogos", titulo: "Quem sou eu?", emoji: "🕵️", partes: [v2.partes[2]] }, codigo: "codigo-de-teste" })).dados;
  const entAvulso = await chamar({ acao: "entrar", sessao: avulso.sessao, nome: "Ana" });
  assert.equal(entAvulso.dados.programa.modo, "jogos");
  assert.deepEqual(entAvulso.dados.estado.liberadas, [0]);
  assert.equal(entAvulso.dados.estado.atual, 0); passo("jogo avulso: modo \"jogos\" guardado e o jogo já liberado e aberto");
  assert.ok(!("modo" in prog2)); passo("programação da Adoração continua sem modo");
  const progAntigo = JSON.parse(programaArq);
  assert.ok(!("versao" in progAntigo) && progAntigo.partes.every((p) => !("quadro" in p)) && !("ordens" in d.dados.extras)); passo("programação antiga continua sem versao, quadro e ordens");

  // 6.12.77: "Ordem e data": revelar a ordem a todos, pontuar de boca (quem acertou e quantos pontos) e esconder de novo
  assert.deepEqual(part2.dados.estado.ordensReveladas, {}); passo("estado público começa com ordensReveladas vazio");
  assert.equal((await chamar({ acao: "revelar-ordem", sessao: cv2.sessao, parte: 2 })).status, 403); passo("revelar-ordem sem a chave do dirigente recusado");
  assert.equal((await chamar({ acao: "revelar-ordem", sessao: cv2.sessao, chave: cv2.chave, parte: 0 })).status, 400); passo("revelar-ordem numa parte sem ordem recusado");
  const ro = await chamar({ acao: "revelar-ordem", sessao: cv2.sessao, chave: cv2.chave, parte: 2 });
  assert.equal(ro.status, 200);
  assert.deepEqual(ro.dados.estado.ordensReveladas["2"], v2.partes[2].jogo.ordem); passo("revelar-ordem mostra a todos a ordem certa com as datas");
  const est2 = await chamar({ acao: "estado", sessao: cv2.sessao });
  assert.ok(JSON.stringify(est2.dados.estado.ordensReveladas).includes(DATA_SECRETA)); passo("o participante recebe a ordem revelada no estado");
  assert.equal((await chamar({ acao: "pontuar", sessao: cv2.sessao, chave: cv2.chave, parte: 2, rodada: "ordem", nome: "Ana", pts: 5 })).status, 400); passo("pontuar a ordem com mais pontos que eventos + 2 recusado");
  assert.equal((await chamar({ acao: "pontuar", sessao: cv2.sessao, chave: cv2.chave, parte: 2, rodada: "ordem", nome: "", pts: 2 })).status, 400); passo("pontuar a ordem sem escolher quem acertou recusado");
  const po = await chamar({ acao: "pontuar", sessao: cv2.sessao, chave: cv2.chave, parte: 2, rodada: "ordem", nome: "Ana", pts: 4 });
  assert.equal(po.status, 200);
  assert.deepEqual(po.dados.estado.acertos["2"].ordem, { nome: "Ana", pts: 4 }); passo("pontuar a ordem grava quem acertou e os pontos escolhidos (acertos[parte].ordem)");
  const pn = await chamar({ acao: "pontuar", sessao: cv2.sessao, chave: cv2.chave, parte: 2, rodada: "ordem", ninguem: true });
  assert.deepEqual(pn.dados.estado.acertos["2"].ordem, { nome: "", pts: 0, ninguem: true }); passo("\"Ninguém acertou\" na ordem: sem pontos");
  const reo = await chamar({ acao: "reiniciar", sessao: cv2.sessao, chave: cv2.chave, parte: 2, rodada: "ordem" });
  assert.equal(reo.status, 200);
  assert.ok(!("ordem" in (reo.dados.estado.acertos["2"] || {})) && !("2" in reo.dados.estado.ordensReveladas)); passo("reiniciar a ordem esconde de novo a ordem e tira os pontos");
  const po2 = await chamar({ acao: "pontuar", sessao: cv2.sessao, chave: cv2.chave, parte: 2, rodada: "ordem", nome: "Ana", pts: 0 });
  assert.deepEqual(po2.dados.estado.ordensReveladas["2"], v2.partes[2].jogo.ordem); passo("pontuar a ordem (mesmo com 0 ponto) também revela a ordem");
  await chamar({ acao: "encerrar", sessao: cv2.sessao, chave: cv2.chave });

  // 6.13.45: Verdadeiro ou falso é julgado na hora pelo servidor (certa: pontos; errada: resposta revelada, sem pontos, sem esperar o presidente)
  {
    const pvf = JSON.parse(JSON.stringify(programa));
    pvf.partes[2].jogo = { tipo: "Verdadeiro ou falso", idTipo: "verdadeiro_falso", nome: "Verdadeiro ou falso", comoJogar: "Diga.", material: null, rodadas: [
      { pergunta: "Noé construiu uma arca.", resposta: "Verdadeiro. Gênesis 6.", referencia: "Gênesis 6:14" },
      { pergunta: "Jonas foi engolido por um leão.", resposta: "Falso. Foi um peixe.", referencia: "Jonas 1:17" },
    ] };
    const sv = (await chamar({ acao: "criar", programa: pvf, codigo: "codigo-de-teste" })).dados;
    const idV = (await chamar({ acao: "entrar", sessao: sv.sessao, nome: "Ana" })).dados.participanteId;
    await chamar({ acao: "liberar", sessao: sv.sessao, chave: sv.chave, parte: 2 });
    const vc = await chamar({ acao: "responder", sessao: sv.sessao, participanteId: idV, parte: 2, rodada: 0, texto: "Verdadeiro" });
    assert.equal(vc.dados.estado.envios["2"]["0"].status, "certa");
    assert.equal(vc.dados.estado.acertos["2"]["0"].nome, "Ana"); passo("Verdadeiro ou falso: resposta certa pontua na hora");
    const ve = await chamar({ acao: "responder", sessao: sv.sessao, participanteId: idV, parte: 2, rodada: 1, texto: "Verdadeiro" });
    assert.equal(ve.status, 200);
    assert.equal((ve.dados.estado.envios || {})["2"]?.["1"], undefined);
    assert.equal(ve.dados.estado.acertos["2"]?.["1"], undefined);
    assert.deepEqual(ve.dados.estado.erradas["2"]["1"], [{ nome: "Ana", texto: "Verdadeiro" }]);
    assert.ok(String(ve.dados.estado.reveladas["2"]["1"]).startsWith("Falso")); passo("Verdadeiro ou falso: resposta errada é julgada na hora, sem pontos, e a resposta é revelada");
    await chamar({ acao: "encerrar", sessao: sv.sessao, chave: sv.chave });
  }

  // 6.13.46: Perfil bíblico com dicas sorteadas: sem repetir, pontos pela quantidade de dicas dadas, só no Perfil bíblico
  {
    const pp = JSON.parse(JSON.stringify(programa));
    pp.partes[2].jogo = { tipo: "Perfil bíblico", idTipo: "perfil_biblico", nome: "Perfil bíblico", comoJogar: "Adivinhe.", material: null, rodadas: [
      { pergunta: "Pessoa. Dica 1: A. Dica 2: B. Dica 3: C. Dica 4: D.", resposta: "Davi", referencia: "1 Samuel 17:49" },
    ] };
    const sp = (await chamar({ acao: "criar", programa: pp, codigo: "codigo-de-teste" })).dados;
    const idP = (await chamar({ acao: "entrar", sessao: sp.sessao, nome: "Ana" })).dados.participanteId;
    await chamar({ acao: "liberar", sessao: sp.sessao, chave: sp.chave, parte: 2 });
    const modo = await chamar({ acao: "modo-dicas", sessao: sp.sessao, chave: sp.chave, parte: 2, sorteio: true });
    assert.equal(modo.dados.estado.sorteioDicas["2"], true); passo("modo de dicas sorteadas ligado pelo presidente");
    let est;
    for (let i = 0; i < 4; i++) est = (await chamar({ acao: "sortear-dica", sessao: sp.sessao, chave: sp.chave, parte: 2, rodada: 0 })).dados.estado;
    assert.deepEqual([...est.dicasOrdem["2"]["0"]].sort(), [0, 1, 2, 3]);
    assert.equal(est.dicas["2"]["0"], 4); passo("4 sorteios saem 4 dicas diferentes e a quantidade de dicas dadas acompanha");
    assert.equal((await chamar({ acao: "sortear-dica", sessao: sp.sessao, chave: sp.chave, parte: 2, rodada: 0 })).status, 400); passo("sem dicas restantes o sorteio é recusado");
    const pp2 = await chamar({ acao: "pontuar", sessao: sp.sessao, chave: sp.chave, parte: 2, rodada: 0, nome: "Ana" });
    assert.equal(pp2.dados.estado.acertos["2"]["0"].pts, 1); passo("pontos seguem a quantidade de dicas dadas (4 de 4 = 1 ponto)");
    await chamar({ acao: "reiniciar", sessao: sp.sessao, chave: sp.chave, parte: 2, rodada: 0 });
    const re = await chamar({ acao: "sortear-dica", sessao: sp.sessao, chave: sp.chave, parte: 2, rodada: 0 });
    assert.equal(re.dados.estado.dicasOrdem["2"]["0"].length, 1); passo("reiniciar zera as dicas sorteadas");
    // dica "em ordem" depois de uma sorteada: a menor que ainda não saiu
    const sai = re.dados.estado.dicasOrdem["2"]["0"][0];
    const ord = await chamar({ acao: "dica", sessao: sp.sessao, chave: sp.chave, parte: 2, rodada: 0 });
    assert.equal(ord.dados.estado.dicasOrdem["2"]["0"][1], sai === 0 ? 1 : 0); passo("dica em ordem depois de sorteio dá a menor que ainda não saiu");
    // fora do Perfil bíblico: recusado
    const sq = (await chamar({ acao: "criar", programa, codigo: "codigo-de-teste" })).dados;
    assert.equal((await chamar({ acao: "modo-dicas", sessao: sq.sessao, chave: sq.chave, parte: 2, sorteio: true })).status, 400); passo("sorteio de dicas só vale no Perfil bíblico");
    await chamar({ acao: "encerrar", sessao: sq.sessao, chave: sq.chave });
    await chamar({ acao: "encerrar", sessao: sp.sessao, chave: sp.chave });
  }

  // 6.13.17: responder pelo app e julgar
  {
    const s3 = (await chamar({ acao: "criar", programa, codigo: "codigo-de-teste" })).dados;
    const pA = await chamar({ acao: "entrar", sessao: s3.sessao, nome: "Ana" });
    const pB = await chamar({ acao: "entrar", sessao: s3.sessao, nome: "Beto" });
    const idA = pA.dados.participanteId, idB = pB.dados.participanteId;
    assert.equal((await chamar({ acao: "responder", sessao: s3.sessao, participanteId: idA, parte: 2, rodada: 0, texto: "Moisés" })).status, 403); passo("responder antes de liberar a parte recusado");
    await chamar({ acao: "liberar", sessao: s3.sessao, chave: s3.chave, parte: 2 });
    assert.equal((await chamar({ acao: "responder", sessao: s3.sessao, parte: 2, rodada: 0, texto: "Moisés" })).status, 403); passo("responder sem ter entrado com nome recusado");
    const certa = await chamar({ acao: "responder", sessao: s3.sessao, participanteId: idA, parte: 2, rodada: 0, texto: "moises" });
    assert.equal(certa.status, 200);
    assert.equal(certa.dados.estado.envios["2"]["0"].status, "certa");
    assert.deepEqual(certa.dados.estado.acertos["2"]["0"], { nome: "Ana", pts: 2 });
    assert.equal(certa.dados.estado.reveladas["2"]["0"], "Moisés"); passo("resposta que bate (sem acento) é dada como certa na hora: pontos e resposta revelada");
    assert.equal((await chamar({ acao: "responder", sessao: s3.sessao, participanteId: idB, parte: 2, rodada: 0, texto: "Moisés" })).status, 409); passo("questão já respondida não aceita outra resposta");
    const pend = await chamar({ acao: "responder", sessao: s3.sessao, participanteId: idA, parte: 2, rodada: 1, texto: "Golias" });
    assert.equal(pend.dados.estado.envios["2"]["1"].status, "pendente"); passo("resposta que não bate fica esperando o julgamento");
    const trava = await chamar({ acao: "responder", sessao: s3.sessao, participanteId: idB, parte: 2, rodada: 1, texto: "Davi" });
    assert.equal(trava.status, 409); assert.match(trava.dados.erro, /Ana já respondeu/); passo("a primeira resposta trava a questão para os outros");
    assert.equal((await chamar({ acao: "julgar", sessao: s3.sessao, parte: 2, rodada: 1, certo: false })).status, 403); passo("julgar sem a chave do dirigente recusado");
    const errada = await chamar({ acao: "julgar", sessao: s3.sessao, chave: s3.chave, parte: 2, rodada: 1, certo: false });
    assert.deepEqual(errada.dados.estado.erradas["2"]["1"], [{ nome: "Ana", texto: "Golias" }]);
    assert.ok(!("1" in errada.dados.estado.envios["2"])); passo("julgada errada: vai para a lista das erradas e a questão volta a aceitar respostas");
    await chamar({ acao: "responder", sessao: s3.sessao, participanteId: idB, parte: 2, rodada: 1, texto: "o rei Davi" });
    const ok2 = await chamar({ acao: "julgar", sessao: s3.sessao, chave: s3.chave, parte: 2, rodada: 1, certo: true });
    assert.deepEqual(ok2.dados.estado.acertos["2"]["1"], { nome: "Beto", pts: 2 });
    assert.equal(ok2.dados.estado.envios["2"]["1"].status, "certa"); passo("julgada certa: ganha os pontos e a resposta é revelada");
    await chamar({ acao: "sortear", sessao: s3.sessao, chave: s3.chave, fonte: "participantes", parte: 2 });
    const est = (await chamar({ acao: "estado", sessao: s3.sessao })).dados.estado;
    const fora = est.sorteio.nome === "Ana" ? idB : idA;
    const vez = await chamar({ acao: "responder", sessao: s3.sessao, participanteId: fora, parte: 2, rodada: 2, texto: "Jonas" });
    assert.equal(vez.status, 403); assert.match(vez.dados.erro, /Agora é a vez de/); passo("com alguém sorteado, só ele responde");
    const rei = await chamar({ acao: "reiniciar", sessao: s3.sessao, chave: s3.chave, parte: 2, rodada: 1 });
    assert.ok(!("1" in (rei.dados.estado.envios["2"] || {})) && !("1" in (rei.dados.estado.erradas["2"] || {}))); passo("reiniciar a questão apaga as respostas enviadas e as erradas");
    await chamar({ acao: "encerrar", sessao: s3.sessao, chave: s3.chave });
  }
  // 6.13.20: revelar ou pontuar com uma resposta esperando julgamento
  {
    const s4 = (await chamar({ acao: "criar", programa, codigo: "codigo-de-teste" })).dados;
    const id4 = (await chamar({ acao: "entrar", sessao: s4.sessao, nome: "Ana" })).dados.participanteId;
    await chamar({ acao: "liberar", sessao: s4.sessao, chave: s4.chave, parte: 2 });
    await chamar({ acao: "responder", sessao: s4.sessao, participanteId: id4, parte: 2, rodada: 0, texto: "Arão" });
    await chamar({ acao: "julgar", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 0, certo: false });
    await chamar({ acao: "responder", sessao: s4.sessao, participanteId: id4, parte: 2, rodada: 0, texto: "Josué" });
    const rv = await chamar({ acao: "revelar", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 0 });
    assert.deepEqual(rv.dados.estado.erradas["2"]["0"], [{ nome: "Ana", texto: "Arão" }, { nome: "Ana", texto: "Josué" }]);
    assert.ok(!("0" in (rv.dados.estado.envios["2"] || {}))); passo("revelar com resposta esperando julgamento: ela entra nas erradas (todas as tentativas aparecem)");
    await chamar({ acao: "responder", sessao: s4.sessao, participanteId: id4, parte: 2, rodada: 1, texto: "o pastor" });
    const pt = await chamar({ acao: "pontuar", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 1, nome: "Ana" });
    assert.equal(pt.status, 400, "pontuar ainda pede a 1ª dica nas rodadas de dicas");
    await chamar({ acao: "dica", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 1 });
    const pt2 = await chamar({ acao: "pontuar", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 1, nome: "Ana" });
    assert.equal(pt2.dados.estado.envios["2"]["1"].status, "certa"); passo("pontuar quem tinha a resposta esperando: ela vira certa");
    // 6.13.28: o presidente da reunião joga também (entra com a chave e um nome) e, se vê a resposta, não responde mais àquela questão
    const pres = await chamar({ acao: "entrar", sessao: s4.sessao, chave: s4.chave, nome: "Pai" });
    assert.equal(pres.dados.dirigente, true);
    assert.ok(pres.dados.participanteId); passo("presidente da reunião entra no jogo com um nome (continua presidente)");
    const esp0 = await chamar({ acao: "espiar", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 2 });
    assert.ok(esp0.dados.resposta && !esp0.dados.estado, "ver sem jogar não registra nada");
    const esp = await chamar({ acao: "espiar", sessao: s4.sessao, chave: s4.chave, parte: 2, rodada: 2, participanteId: pres.dados.participanteId });
    assert.deepEqual(esp.dados.estado.espiaram["2"]["2"], ["Pai"]);
    const bloq = await chamar({ acao: "responder", sessao: s4.sessao, participanteId: pres.dados.participanteId, parte: 2, rodada: 2, texto: "qualquer" });
    assert.equal(bloq.status, 403);
    assert.match(bloq.dados.erro, /Ver só para mim/); passo("presidente que viu a resposta (Ver só para mim) não responde mais àquela questão");
    // 6.13.31: painel de quem está participando, para todos (só os nomes), atualizado quando alguém entra ou sai
    const est1 = await chamar({ acao: "estado", sessao: s4.sessao, participanteId: id4 });
    assert.deepEqual(est1.dados.presentes.map((p) => p.nome).sort(), ["Ana", "Pai"]);
    assert.ok(!("participantes" in est1.dados), "a lista com os ids não vai para quem participa");
    const bia = (await chamar({ acao: "entrar", sessao: s4.sessao, nome: "Bia" })).dados;
    assert.deepEqual(bia.presentes.map((p) => p.nome).sort(), ["Ana", "Bia", "Pai"]);
    const est2 = await chamar({ acao: "estado", sessao: s4.sessao, participanteId: id4, versao: est1.dados.versao });
    assert.ok(est2.dados.estado && est2.dados.presentes.length === 3, "quem entra muda a versão de todos"); passo("todos veem quem está participando (entrou alguém: a versão muda)");
    await chamar({ acao: "sair", sessao: s4.sessao, participanteId: bia.participanteId });
    const est3 = await chamar({ acao: "estado", sessao: s4.sessao, participanteId: id4, versao: est2.dados.versao });
    assert.deepEqual(est3.dados.presentes.map((p) => p.nome).sort(), ["Ana", "Pai"]); passo("quem sai some do painel (a versão muda)");
    const est4 = await chamar({ acao: "estado", sessao: s4.sessao, participanteId: id4, versao: est3.dados.versao, presenca: true });
    assert.ok(Array.isArray(est4.dados.presentes), "com presenca: true a lista vem mesmo sem mudança"); passo("a lista de presentes vem de tempos em tempos (presenca)");
    await chamar({ acao: "encerrar", sessao: s4.sessao, chave: s4.chave });
  }

  // Encerrar
  const outra = (await chamar({ acao: "criar", programa, codigo: "codigo-de-teste" })).dados;
  assert.equal((await chamar({ acao: "encerrar", sessao: outra.sessao, chave: outra.chave })).status, 200);
  assert.equal((await chamar({ acao: "entrar", sessao: outra.sessao, nome: "Ana" })).status, 404); passo("encerrar apaga a sessão");

  console.log(`\n${ok} verificações passaram.`);
} catch (e) {
  console.error("✘ Falhou:", e.message);
  process.exitCode = 1;
} finally {
  await rm(process.env.DADOS_DIR, { recursive: true, force: true });
}
