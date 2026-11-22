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
        tipo: "Quem sou eu?", nome: "Quem sou eu?", comoJogar: "Leia as pistas.", material: null,
        rodadas: [
          { pergunta: "Abri o mar Vermelho com a vara.", resposta: RESPOSTAS[0], referencia: "Êxodo 14:21" },
          { pergunta: "Venci o gigante com uma funda.", resposta: RESPOSTAS[1], referencia: "1 Samuel 17:49" },
          { pergunta: "Jonas ficou três dias no peixe.", resposta: RESPOSTAS[2], referencia: "Jonas 1:17" },
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
  assert.equal(p1.dados.programa.partes[2].jogo.rodadas[0].referencia, "Êxodo 14:21");
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
  assert.equal((await chamar({ acao: "revelar", sessao, chave, parte: 2, rodada: 7 })).status, 400); passo("rodada inexistente recusada");

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
