// Teste das Considerações para o serviço de campo (api/_servicoCampo.mjs, as brochuras de api/_fontes.mjs e os prompts), sem IA e
// sem gravar em produção: copia os arquivos das fontes para uma pasta temporária (FONTES_DIR) e chama as funções direto.
// Uso: node ferramentas/testar-servico-campo.mjs [pasta das fontes] [--wol]
//   A pasta padrão é C:\Softs\AppNotesJW_Diversos (subpastas Fontes e Fontes_preparadas). Com --wol, lê também o wol.jw.org.
import { mkdtemp, rm, copyFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";

const argumentos = process.argv.slice(2);
const comWol = argumentos.includes("--wol");
const base = argumentos.find((a) => !a.startsWith("--")) || "C:\\Softs\\AppNotesJW_Diversos";
const ORIGENS = {
  "ame_as_pessoas.txt": join(base, "Fontes", "ame_as_pessoas.txt"),
  "melhore_leitura_ensino.txt": join(base, "Fontes", "melhore_leitura_ensino.txt"),
  "biblia.txt": join(base, "Fontes", "biblia.txt"),
  "beneficie_escola.txt": join(base, "Fontes_preparadas", "beneficie_escola.txt"),
};

const pasta = await mkdtemp(join(tmpdir(), "servico-campo-"));
let comFontes = true;
for (const [nome, origem] of Object.entries(ORIGENS)) {
  try {
    await access(origem);
    await copyFile(origem, join(pasta, nome));
  } catch {
    comFontes = false;
    console.log(`(sem ${origem}: os testes das brochuras ficam de fora)`);
  }
}
process.env.HOSPEDAGEM = "local";
process.env.DADOS_DIR = pasta;
process.env.FONTES_DIR = pasta;
process.env.CODIGO_ADMIN = "admin-de-teste";
process.env.CODIGO_ESTUDO = "codigo-de-teste";
delete process.env.CODIGO_DIRIGENTE;

const fontes = await import("../api/_fontes.mjs");
const campo = await import("../api/_servicoCampo.mjs");
const prompts = await import("../api/_prompts.mjs");

let ok = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

// ---------- Brochuras e Beneficie-se ----------
if (comFontes) {
  teste("lmd tem 12 lições e th tem 20, com número e nome", async () => {
    const lmd = await fontes.licoesDaBrochura("ameAsPessoas");
    const th = await fontes.licoesDaBrochura("melhoreLeitura");
    assert.equal(lmd.length, 12);
    assert.equal(th.length, 20);
    assert.deepEqual(lmd.map((l) => l.licao), [...Array(12)].map((_, i) => i + 1));
    assert.deepEqual(th.map((l) => l.licao), [...Array(20)].map((_, i) => i + 1));
    assert.match(lmd[0].nome, /Interesse pelas pessoas/i);
    assert.match(th[0].nome, /Comece bem/i);
    assert.ok(lmd.every((l) => l.sigla === "lmd" && l.nome && l.texto.length > 200));
    assert.ok(th.every((l) => l.sigla === "th" && l.nome && l.texto.length > 200));
  });

  teste("buscarNosLivros filtra pelo livro (lmd, th e be)", async () => {
    for (const chave of ["ameAsPessoas", "melhoreLeitura", "beneficieEscola"]) {
      const nome = fontes.nomeDoLivro(chave);
      assert.ok(nome, chave);
      const r = await fontes.buscarNosLivros("interesse pelas pessoas na pregação e na apresentação", { max: 3, livros: [nome] });
      assert.ok(r.length > 0, `nada achado em ${chave}`);
      assert.ok(r.every((x) => x.livro === nome), `veio outro livro em ${chave}`);
    }
  });

  teste("licoesQueCombinam e trechosBe acham algo para um assunto de pregação", async () => {
    const licoes = await campo.licoesQueCombinam("como iniciar conversas com interesse pelas pessoas", { max: 3 });
    assert.ok(licoes.length > 0 && licoes.length <= 3);
    assert.ok(licoes.every((l) => ["lmd", "th"].includes(l.sigla) && l.texto.length <= 902));
    const be = await campo.trechosBe("interesse pelas pessoas na pregação e na apresentação");
    assert.ok(be.length > 0 && be.length <= 2);
  });
}

// ---------- Dados do pedido ----------
teste("dadosDoCampo: padrões e limites", () => {
  const d = campo.dadosDoCampo({});
  assert.match(d.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(d.minutos, 5);
  assert.deepEqual(d.tipos, ["casa"]);
  assert.equal(d.aposReuniao, false);
  assert.deepEqual(d.fontes, { w24: true, lmd: true, th: true, be: true, outros: true, artigos: ["w26.09", "w26.03", "w25.03", "w23.02", "w22.11", "w21.10", "w21.07", "w18.10"] });
  const e = campo.dadosDoCampo({ minutos: 9, tipos: ["xyz"], data: "2026-13-45", usados: [3, "4", 0, -1, 3, "a", 2.5], recentes: ["a", "", "b", "c", "d", "e", "f"], fontes: { be: false }, aposReuniao: true });
  assert.equal(e.minutos, 5);
  assert.deepEqual(e.tipos, ["casa"]);
  assert.notEqual(e.data, "2026-13-45");
  assert.deepEqual(e.usados, [3, 4]);
  assert.equal(e.recentes.length, 5);
  assert.equal(e.fontes.be, false);
  // 6.11.56: cada artigo de A Sentinela tem a sua caixa; desmarcar um tira só ele, e "sentinela: false" (app antigo) tira todos.
  const so = campo.dadosDoCampo({ fontes: { artigos: { "w26.03": false, "w18.10": false }, outros: false } });
  assert.deepEqual(so.fontes.artigos, ["w26.09", "w25.03", "w23.02", "w22.11", "w21.10", "w21.07"]);
  assert.equal(so.fontes.outros, false);
  assert.deepEqual(campo.dadosDoCampo({ fontes: { sentinela: false } }).fontes.artigos, []);
  assert.equal(e.aposReuniao, true);
  assert.equal(campo.dadosDoCampo({ minutos: "7" }).minutos, 7);
  assert.deepEqual(campo.dadosDoCampo({ tipos: ["publico", "rural", "publico"] }).tipos, ["publico", "rural"]);
});

teste("datas: dataCurta e dataPorExtenso", () => {
  assert.equal(campo.dataCurta("2026-11-21"), "sáb 21/11");
  assert.match(campo.dataPorExtenso("2026-11-21"), /sábado, 21 de novembro de 2026/);
});

// ---------- Rodízio de w24.05 ----------
const pars = [
  { numero: 1, subtitulo: "", texto: "O amor a Jeová nos motiva a falar dele." },
  { numero: 2, subtitulo: "", texto: "Jesus sentia compaixão das pessoas." },
  { numero: 3, subtitulo: "Revisitas", texto: "Voltar a visitar quem mostrou interesse exige persistência." },
  { numero: 4, subtitulo: "", texto: "Testemunho informal no trabalho e na escola." },
  { numero: 5, subtitulo: "", texto: "A alegria de ajudar as pessoas a conhecer Jeová." },
];
teste("escolherParagrafoW24: rodízio e assunto", () => {
  assert.equal(campo.escolherParagrafoW24({ paragrafos: pars }).paragrafo.numero, 1);
  assert.equal(campo.escolherParagrafoW24({ paragrafos: pars, usados: [1, 2] }).paragrafo.numero, 3);
  const r = campo.escolherParagrafoW24({ paragrafos: pars, consulta: "persistência nas revisitas" });
  assert.equal(r.paragrafo.numero, 3);
  assert.equal(r.porAssunto, true);
  const todos = campo.escolherParagrafoW24({ paragrafos: pars, usados: [1, 2, 3, 4, 5] });
  assert.equal(todos.reiniciou, true);
  assert.equal(todos.paragrafo.numero, 1);
  // O assunto só combina com um parágrafo já usado: vale esse parágrafo.
  assert.equal(campo.escolherParagrafoW24({ paragrafos: pars, usados: [3], consulta: "revisitas persistência" }).paragrafo.numero, 3);
  assert.equal(campo.escolherParagrafoW24({ paragrafos: [] }), null);
});

teste("candidatosW24: 3 diferentes e não usados", () => {
  const c = campo.candidatosW24({ paragrafos: pars, usados: [1], n: 3 });
  assert.equal(c.length, 3);
  assert.equal(new Set(c.map((p) => p.numero)).size, 3);
  assert.ok(!c.some((p) => p.numero === 1));
  const c2 = campo.candidatosW24({ paragrafos: pars, usados: [1, 2, 3, 4], n: 3 });
  assert.deepEqual(c2.map((p) => p.numero), [5]);
});

// ---------- Escolhas puras ----------
teste("escolherComplementares: no empate, o mais novo", () => {
  // Uma palavra que não está em nenhum título: todos empatam e vale a ordem da lista (do mais novo para o mais antigo).
  const doc = { titulo: "X", url: "u", paragrafos: [{ numero: 1, texto: "xilofone no ministério" }] };
  const docs = campo.COMPLEMENTARES.map(() => doc);
  const r = campo.escolherComplementares("xilofone", docs, { max: 2 });
  assert.equal(r.length, 2);
  assert.equal(r[0].codigo, campo.COMPLEMENTARES[0].codigo);
  assert.equal(r[1].codigo, campo.COMPLEMENTARES[1].codigo);
  // A palavra do título pesa: "zelo" leva ao w25.03, mesmo sendo mais antigo.
  assert.equal(campo.escolherComplementares("zelo", campo.COMPLEMENTARES.map(() => ({ titulo: "X", url: "u", paragrafos: [{ numero: 2, texto: "zelo" }] })), { max: 1 })[0].codigo, "w25.03");
  assert.deepEqual(campo.escolherComplementares("", docs), []);
  assert.deepEqual(campo.escolherComplementares("xilofone", campo.COMPLEMENTARES.map(() => null)), []);
});

teste("artigos de referência: docId fixo e w23.02 no lugar de w26.02", () => {
  const todos = [campo.W24, ...campo.COMPLEMENTARES];
  assert.equal(todos.length, 9);
  assert.ok(todos.every((a) => Number.isInteger(a.docId) && a.docId > 2000000), "todo artigo tem docId");
  assert.equal(new Set(todos.map((a) => a.docId)).size, 9);
  const w23 = campo.COMPLEMENTARES.find((a) => a.codigo === "w23.02");
  assert.ok(w23 && w23.ano === 2023 && w23.docId === 2023285);
  assert.ok(!todos.some((a) => a.codigo === "w26.02"));
  assert.equal(campo.COMPLEMENTARES.find((a) => a.codigo === "w21.10").docId, 2021605);
  // O título lido no docId tem de bater (sem "!", aspas e acentos); outro artigo não passa.
  assert.ok(campo.tituloBate("“Mantenham os sentidos, sejam vigilantes!”", w23.titulo));
  assert.ok(campo.tituloBate("Não desista!", "Nao desista"));
  assert.ok(!campo.tituloBate("Reconstruindo sua amizade com Jeová", "Não desista"));
  assert.ok(!campo.tituloBate("", "Não desista"));
});

teste("escolherLicoes: a melhor de cada brochura primeiro", () => {
  const lmd = [
    { sigla: "lmd", licao: 1, nome: "Interesse pelas pessoas", texto: "mostre interesse" },
    { sigla: "lmd", licao: 2, nome: "Seja natural", texto: "converse com naturalidade e interesse" },
  ];
  const th = [{ sigla: "th", licao: 1, nome: "Comece bem", texto: "uma introdução que desperte interesse" }];
  const r = campo.escolherLicoes("interesse", [lmd, th], { max: 3 });
  assert.deepEqual(r.map((l) => `${l.sigla} ${l.licao}`), ["lmd 1", "th 1", "lmd 2"]);
  assert.equal(campo.escolherLicoes("interesse", [lmd, th], { max: 1 }).length, 1);
});

// ---------- Fontes no esboço ----------
const f = {
  paragrafo: { numero: 7, subtitulo: "", texto: "Texto do parágrafo 7." },
  licoes: [{ sigla: "lmd", licao: 3, nome: "Seja natural", texto: "..." }],
  artigos: [{ codigo: "w26.03", titulo: "Artigo", url: "u", paragrafos: [{ numero: 4, texto: "..." }] }],
  be: [{ livro: "be", trecho: "Trecho do be." }],
};
teste("fonteDoPonto aceita só as siglas da mensagem", () => {
  const siglas = campo.siglasPermitidas(f);
  assert.deepEqual(siglas.sort(), ["be", "lmd", "w24.05", "w26.03"].sort());
  assert.equal(campo.fonteDoPonto("w24.05, § 7", siglas), "w24.05, § 7");
  assert.equal(campo.fonteDoPonto("Fonte: lmd lição 3, Seja natural", siglas), "lmd lição 3, Seja natural");
  assert.equal(campo.fonteDoPonto("w99.01, § 2", siglas), "");
  assert.equal(campo.fonteDoPonto("th lição 4", siglas), "");
  assert.equal(campo.fonteDoPonto("", siglas), "");
});

teste("textoDasFontesDoCampo e listaDeFontes", () => {
  const t = campo.textoDasFontesDoCampo(f);
  for (const r of ["A SENTINELA DE MAIO DE 2024", "w24.05, § 7", "LIÇÕES DAS BROCHURAS", "[lmd lição 3, Seja natural]", "OUTROS ARTIGOS", "§ 4:", "BENEFICIE-SE"]) assert.ok(t.includes(r), r);
  assert.equal(campo.textoDasFontesDoCampo({}), "");
  const l = campo.listaDeFontes(f, JSON.stringify({ a: "lmd lição 3", b: "w26.03, § 4" }));
  assert.equal(l.length, 3);
  assert.match(l[0], /^w24\.05/);
  assert.ok(l.some((x) => x.startsWith("lmd lição 3")));
  assert.ok(l.some((x) => x.startsWith("w26.03")));
  assert.ok(!l.some((x) => x.startsWith("be")));
});

// ---------- Prompts ----------
teste("prompts: sistemaCampo e sistemaCampoAssuntos com o formato; partes e travados", () => {
  const P = prompts.montarPrompts({});
  assert.ok(P.sistemaCampo.includes("FORMATO DO ESBOÇO DAS CONSIDERAÇÕES PARA O SERVIÇO DE CAMPO"));
  assert.ok(P.sistemaCampo.includes("dicaDirigente"));
  assert.ok(P.sistemaCampo.includes("VOCABULÁRIO"));
  assert.ok(P.sistemaCampo.includes("texto diário"));
  assert.ok(P.sistemaCampoAssuntos.includes("FORMATO DOS ASSUNTOS SUGERIDOS"));
  const ids = prompts.PARTES.map((p) => p.id);
  assert.ok(ids.includes("servico_campo") && ids.includes("servico_campo_assuntos"));
  const cat = prompts.CATEGORIAS.find((c) => c.id === "esbocos");
  assert.ok(cat.partes.includes("servico_campo") && cat.partes.includes("servico_campo_assuntos"));
  const travados = prompts.travadosDe({}).map((t) => t.id);
  assert.ok(travados.includes("formato_servico_campo") && travados.includes("formato_servico_campo_assuntos"));
  // "culto" só pode aparecer nas frases que o proíbem.
  for (const p of prompts.PARTES.filter((x) => x.id.startsWith("servico_campo"))) {
    const semRegra = p.padrao.replace(/nunca\s+["“]?culto["”]?/gi, "");
    assert.ok(!/\bculto/i.test(semRegra), p.id);
  }
});

// ---------- O handler inteiro, com uma IA de mentira ----------
// Um servidor local faz o papel da API da Anthropic (ANTHROPIC_BASE_URL): devolve um esboço pronto e guarda o pedido, para conferir a
// mensagem e a limpeza do servidor (no máximo 3 pontos, a soma dos minutos, as fontes só da mensagem). Sem rede: w24.05 e os
// artigos do wol ficam desmarcados.
if (comFontes) {
  const pedidos = [];
  let respostaDaIa = null;
  const ia = createServer((req, res) => {
    let corpo = "";
    req.on("data", (c) => (corpo += c));
    req.on("end", () => {
      pedidos.push(JSON.parse(corpo || "{}"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_teste", type: "message", role: "assistant", model: "teste",
        content: [{ type: "text", text: JSON.stringify(respostaDaIa) }],
        stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
      }));
    });
  });
  await new Promise((ok) => ia.listen(0, "127.0.0.1", ok));
  process.env.ANTHROPIC_API_KEY = "chave-de-teste";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${ia.address().port}`;
  const { default: handler } = await import("../api/sugerir-formatacao.mjs");
  const chamar = async (corpo) => {
    const req = { method: "POST", headers: { origin: "http://localhost:8091", "x-forwarded-for": "10.0.0.9" }, body: { codigoAdmin: "admin-de-teste", codigoDirigente: "codigo-de-teste", ...corpo } };
    const res = {
      statusCode: 200, corpo: null,
      setHeader() {}, status(c) { this.statusCode = c; return this; }, json(d) { this.corpo = d; return this; },
    };
    await handler(req, res);
    return res;
  };
  const ponto = (titulo, fonte, leitura = null) => ({
    titulo, minutos: 2, fonte, aplicacao: null, ilustracao: null, transicao: "E agora...",
    desenvolvimento: [{ argumento: "Um argumento.", ideias: ["Uma ideia."], leitura }],
  });
  const fontesSemRede = { w24: false, outros: false, artigos: Object.fromEntries(campo.COMPLEMENTARES.map((a) => [a.codigo, false])), lmd: true, th: true, be: true };

  teste("handler campo: mensagem, limpeza e resposta", async () => {
    respostaDaIa = {
      tema: "Interesse sincero pelas pessoas", objetivo: "Mostrar interesse hoje.", aplicacao: "Ouvir mais.",
      introducao: { titulo: "Quem está do outro lado da porta?", minutos: 1, blocos: [{ texto: "Pense na última conversa que você teve na pregação.", lista: [] }] },
      pontos: [
        ponto("Jeová se interessa pelas pessoas", "w24.05, § 3", { referencia: "Filipenses 2:4", introducao: "O que Paulo recomendou?", destaque: "Vimos no texto que..." }),
        ponto("Ouça antes de falar", "lmd lição 1, Interesse pelas pessoas"),
        ponto("Uma frase-modelo para hoje", ""),
        ponto("Um quarto ponto que sobra", "w99.01, § 2"),
      ],
      conclusao: { titulo: "Vamos com interesse", minutos: 2, blocos: [{ texto: "Portanto, esteja determinado a ouvir.", lista: ["As duplas", "O território"] }] },
      dicaDirigente: "Tenha o território já separado.",
    };
    const r = await chamar({ tarefa: "campo", data: "2026-11-21", minutos: 6, tipos: ["publico"], assunto: "interesse pelas pessoas", evitar: "Boas maneiras na porta", recentes: ["Boas maneiras na porta"], fontes: fontesSemRede });
    assert.equal(r.statusCode, 200, JSON.stringify(r.corpo));
    const p = pedidos.at(-1);
    assert.ok(p.system.includes("FORMATO DO ESBOÇO DAS CONSIDERAÇÕES PARA O SERVIÇO DE CAMPO"));
    const msg = p.messages[0].content;
    for (const t of ["DURAÇÃO: 6 minutos", "TIPO DE PREGAÇÃO: ", "ASSUNTO PEDIDO PELO DIRIGENTE: interesse pelas pessoas", "EVITAR:", "LIÇÕES DAS BROCHURAS", "CONSIDERAÇÕES RECENTES", "sábado, 21 de novembro de 2026"]) assert.ok(msg.includes(t), t);
    assert.ok(!msg.includes("A SENTINELA DE MAIO DE 2024"), "w24.05 desmarcada não pode ir");
    const { esboco, titulo, minutos } = r.corpo;
    assert.equal(minutos, 6);
    assert.match(titulo, /^Serviço de campo · sáb 21\/11$/);
    assert.ok(esboco.pontos.length <= 3, `pontos: ${esboco.pontos.length}`);
    const soma = esboco.introducao.minutos + esboco.conclusao.minutos + esboco.pontos.reduce((s, x) => s + x.minutos, 0);
    assert.equal(soma, 6);
    const fontesCitadas = esboco.pontos.flatMap((x) => x.fontes || []);
    assert.ok(!fontesCitadas.some((x) => /w24\.05|w99/.test(x)), `fontes: ${fontesCitadas}`);
    assert.equal(esboco.dicaDirigente, "Tenha o território já separado.");
    assert.equal(esboco.paragrafoW24, null);
    assert.ok(Array.isArray(esboco.fontes));
  });

  teste("handler campo-assuntos: 3 assuntos, sem parágrafo inventado", async () => {
    respostaDaIa = { assuntos: [1, 2, 3].map((n) => ({ titulo: `Assunto ${n}`, resumo: "Resumo.", paragrafoW24: 99 })) };
    const r = await chamar({ tarefa: "campo-assuntos", fontes: fontesSemRede });
    assert.equal(r.statusCode, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.assuntos.length, 3);
    assert.ok(r.corpo.assuntos.every((a) => a.paragrafoW24 === null));
    assert.ok(pedidos.at(-1).system.includes("FORMATO DOS ASSUNTOS SUGERIDOS"));
  });

  teste("handler campo: sem o código do dirigente, recusa", async () => {
    const r = await chamar({ tarefa: "campo", codigoDirigente: "errado" });
    assert.equal(r.statusCode, 403);
  });
  testes.push(["(fecha a IA de mentira)", () => new Promise((ok) => ia.close(ok))]);
}

// ---------- wol.jw.org (só com --wol) ----------
if (comWol) {
  teste("wol: w24.05 tem 16 parágrafos e os complementares são achados", async () => {
    const w = await campo.paragrafosW24(15000);
    assert.ok(w, "w24.05 não lido");
    assert.equal(w.paragrafos.length, 16);
    const r = await campo.complementares("pregação alegria amor", { max: 2, timeoutMs: 15000 });
    console.log("   artigos não achados no wol:", r.naoAchados.join(", ") || "nenhum");
    assert.ok(r.artigos.length > 0);
  });
  teste("wol: os 9 artigos de referência são achados pelo docId", async () => {
    const todos = [campo.W24, ...campo.COMPLEMENTARES];
    const lidos = [];
    for (const a of todos) {
      const d = await campo.artigoDoWol(a, 15000);
      lidos.push(d);
      console.log(`   ${a.codigo} docId ${a.docId}:`, d ? `"${d.titulo}" (${d.paragrafos.length} §§, docId lido ${d.docId})` : "NÃO ACHADO");
    }
    const achados = lidos.filter(Boolean).length;
    console.log(`   ${achados} de ${todos.length} artigos achados`);
    assert.equal(achados, todos.length);
    assert.ok(lidos.every((d, i) => d.docId === todos[i].docId), "todos lidos pelo docId fixo");
  });
}

try {
  for (const [nome, fn] of testes) {
    try {
      await fn();
      ok++;
      console.log("ok  -", nome);
    } catch (e) {
      console.log("FALHOU -", nome, "\n   ", e.message);
      process.exitCode = 1;
    }
  }
  console.log(`\n${ok} de ${testes.length} testes passaram.`);
} finally {
  await rm(pasta, { recursive: true, force: true });
}
