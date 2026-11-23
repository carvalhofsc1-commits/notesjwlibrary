// Teste da Adoração em Família por quadros (partes puras, sem IA e sem rede). Cresce a cada fase da refatoração.
// Fase 1 (6.12.69): constante única das 10 prioridades de aplicação prática e prioridadesAplicaveis(perfil).
// Fase 2 (6.12.70): catálogo dos quadros (api/_familiaQuadros.mjs), cópia igual no app.js, migração dos perfis antigos, tela e prompt.
// Uso: node ferramentas/testar-adoracao-quadros.mjs
import assert from "node:assert/strict";

const prompts = await import("../api/_prompts.mjs");
const { PRIORIDADES_APLICACAO, prioridadesAplicaveis, prioridadesEmLista, prioridadesEmLinha, prioridadesCurtas } = prompts;

let ok = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

// ---------- Fase 1: prioridades ----------
teste("PRIORIDADES_APLICACAO: 10 itens numerados de 1 a 10, ids únicos, congelados, com a 10ª nova", () => {
  assert.equal(PRIORIDADES_APLICACAO.length, 10);
  assert.deepEqual(PRIORIDADES_APLICACAO.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(PRIORIDADES_APLICACAO.map((p) => p.id)).size, 10);
  assert.ok(PRIORIDADES_APLICACAO.every((p) => p.texto && p.curto && !/culto/i.test(p.texto + p.curto)));
  assert.ok(Object.isFrozen(PRIORIDADES_APLICACAO) && Object.isFrozen(PRIORIDADES_APLICACAO[0]));
  assert.equal(PRIORIDADES_APLICACAO[9].texto, "tratar com amor e respeito os irmãos na congregação e ser perdoador");
  assert.deepEqual(PRIORIDADES_APLICACAO.filter((p) => p.conjuge).map((p) => p.n), [7, 8]);
});

teste("formatos da lista: uma por linha, na mesma linha e nomes curtos", () => {
  const linhas = prioridadesEmLista().split("\n");
  assert.equal(linhas.length, 10);
  assert.match(linhas[0], /^1\. dirigir pelo menos 1 estudo bíblico;$/);
  assert.match(linhas[9], /^10\. tratar com amor e respeito os irmãos na congregação e ser perdoador\.$/);
  assert.match(prioridadesEmLinha(), /^1\) dirigir .*; 9\) ter equilíbrio .*\(redes sociais, séries, aplicativos de vídeo\); 10\) tratar com amor/);
  assert.equal(prioridadesCurtas().split(", ").length, 10);
});

const montados = prompts.montarPrompts({}, {});
// O texto diário: o padrão da parte (o sistema completo traz também o VOCABULARIO_FIXO, que cita a palavra proibida para proibi-la).
const padraoTextoDiario = prompts.PARTES.find((p) => p.id === "texto_diario").padrao;
const usos = {
  "texto diário (sistemaTextoDiario)": padraoTextoDiario,
  "Resumo da leitura: aplicações práticas": montados.frases.pedidos["Resumo da leitura: aplicações práticas"],
  "Resumo da leitura: base": montados.frases.pedidos["Resumo da leitura: base"],
};

teste("os 3 usos têm as 10 prioridades e nenhum resto de \"9 hábitos\"", () => {
  assert.ok(montados.sistemaTextoDiario.startsWith(padraoTextoDiario), "o sistema do texto diário começa pelo padrão da parte");
  for (const [nome, t] of Object.entries(usos)) {
    assert.ok(typeof t === "string" && t.length > 200, nome + " vazio");
    assert.doesNotMatch(t, /\b9 hábitos|nove hábitos/i, nome);
    assert.doesNotMatch(t, /\$\{|qtdPrioridades|prioridadesEm|prioridadesCurtas|PRIORIDADES_/, nome + ": interpolação que não foi resolvida");
    assert.doesNotMatch(t, /culto/i, nome);
  }
  for (const nome of ["texto diário (sistemaTextoDiario)", "Resumo da leitura: aplicações práticas"]) {
    for (const p of PRIORIDADES_APLICACAO) assert.ok(usos[nome].includes(p.texto), `${nome}: falta "${p.texto}"`);
    assert.match(usos[nome], /destes 10 hábitos/, nome);
    assert.match(usos[nome], /item 10/, nome + ": exemplo do item 10");
  }
  assert.match(usos["Resumo da leitura: base"], /reforce os 10 hábitos listados/);
  for (const p of PRIORIDADES_APLICACAO) assert.ok(usos["Resumo da leitura: base"].includes(p.curto), `base: falta "${p.curto}"`);
});

teste("texto diário: comportamento de antes mantido (lista numerada, regras de escolha e de fidelidade)", () => {
  const t = usos["texto diário (sistemaTextoDiario)"];
  assert.match(t, /APLICAÇÕES PRIORITÁRIAS \(sempre que o assunto do texto de hoje permitir, sem forçar\)/);
  assert.match(t, /\n1\. dirigir pelo menos 1 estudo bíblico;\n2\. sempre fazer revisitas;/);
  assert.match(t, /Em 4 comentários, use hábitos DIFERENTES entre si/);
  assert.match(t, /NUNCA force o texto para encaixar um item/);
});

teste("o padrão mostrado na tela de prompts (PARTES) é o mesmo texto montado", () => {
  const parte = prompts.PARTES.find((p) => p.id === "texto_diario");
  assert.ok(parte.padrao.includes(prioridadesEmLista()));
  assert.match(parte.descricao, /amor e perdão com os irmãos/);
});

teste("prioridadesAplicaveis: casal fica com as 10; sem cônjuge saem a 7 e a 8; convidados deixam as perguntas gerais", () => {
  const casal = prioridadesAplicaveis({ formacao: "Casal com filhos", membros: [{ papel: "Pai" }, { papel: "Mãe" }], convidados: { membros: [] } });
  assert.equal(casal.itens.length, 10);
  assert.equal(casal.perguntasGerais, false);
  assert.match(casal.texto, /^PRIORIDADES APLICÁVEIS/);
  assert.doesNotMatch(casal.texto, /não tem casal|convidados/);

  const porPapel = prioridadesAplicaveis({ formacao: "", membros: [{ papel: "Marido" }, { papel: "Filho" }] });
  assert.equal(porPapel.itens.length, 10);
  assert.equal(prioridadesAplicaveis({ formacao: "Família", membros: [], anosCasados: 12 }).itens.length, 10);

  const sozinho = prioridadesAplicaveis({ formacao: "Mora sozinho", membros: [{ papel: "Irmão" }] });
  assert.deepEqual(sozinho.itens.map((p) => p.n), [1, 2, 3, 4, 5, 6, 9, 10]);
  assert.match(sozinho.texto, /não faça perguntas sobre o cônjuge/);
  assert.doesNotMatch(sozinho.texto, /cônjuge com amor|comunicar-se bem com o cônjuge/);

  const maeEFilhos = prioridadesAplicaveis({ formacao: "Mãe e filhos", membros: [{ papel: "Mãe" }, { papel: "Filha" }] });
  assert.equal(maeEFilhos.itens.length, 8);

  const comConvidados = prioridadesAplicaveis({ formacao: "Casal", membros: [], convidados: { membros: [{ apelido: "Lia" }] } });
  assert.equal(comConvidados.perguntasGerais, true);
  assert.match(comConvidados.texto, /Há convidados: as perguntas de reflexão ficam gerais/);
  assert.equal(prioridadesAplicaveis({ convidados: { anotacoes: "vizinhos" } }).perguntasGerais, true);

  const vazio = prioridadesAplicaveis();
  assert.equal(vazio.itens.length, 8);
  assert.equal(vazio.perguntasGerais, false);
});

teste("prioridadesAplicaveis: a formação explícita manda (sozinhos nunca têm casal; \"Casal…\" sempre tem; avós pelos membros)", () => {
  const n = (perfil) => prioridadesAplicaveis(perfil).itens.length;
  const paiEMae = [{ papel: "Pai" }, { papel: "Mãe" }];
  // Os membros Pai e Mãe que o app pré-cria não podem virar casal numa formação sem casal (nem com anos de casados).
  for (const formacao of ["Mãe ou pai sozinho", "Quem mora sozinho", "Família monoparental"]) {
    assert.equal(n({ formacao, membros: paiEMae }), 8, formacao + " com Pai e Mãe");
    assert.equal(n({ formacao, membros: [{ papel: "Esposa" }], anosCasados: 10 }), 8, formacao + " com esposa e anos de casados");
    assert.match(prioridadesAplicaveis({ formacao, membros: paiEMae }).texto, /não tem casal/);
  }
  // "Casal com filhos" e "Casal sem filhos": sempre casal, mesmo sem membros cadastrados.
  for (const formacao of ["Casal com filhos", "Casal sem filhos"]) {
    assert.equal(n({ formacao, membros: [] }), 10, formacao + " sem membros");
    assert.equal(n({ formacao, membros: [{ papel: "Filho" }] }), 10, formacao + " só com filho");
  }
  // "Família com avós ou outros": decidida pelos membros.
  const avos = "Família com avós ou outros";
  assert.equal(n({ formacao: avos, membros: paiEMae }), 10, "avós com Pai e Mãe");
  assert.equal(n({ formacao: avos, membros: [{ papel: "Marido" }, { papel: "Avó" }] }), 10, "avós com marido");
  assert.equal(n({ formacao: avos, membros: [], anosCasados: 3 }), 10, "avós com anos de casados");
  assert.equal(n({ formacao: avos, membros: [{ papel: "Mãe" }, { papel: "Avó" }, { papel: "Filho" }] }), 8, "avós sem casal");
  assert.equal(n({ formacao: avos, membros: [] }), 8, "avós sem membros");
});

// ---------- Fase 2: catálogo dos quadros, migração, tela e o que saiu (FunPlayB, papel e lápis) ----------
const quadrosMod = await import("../api/_familiaQuadros.mjs");
const { QUADROS_FAMILIA, IDS_QUADROS, QUADROS_OBRIGATORIOS, JOGOS_FAMILIA, minutosDosQuadros, quadrosDoPedido } = quadrosMod;
const { nomeDoLivro } = await import("../api/_fontes.mjs");
const { perfilDaFamilia } = await import("../api/sugerir-formatacao.mjs");
const { readFile } = await import("node:fs/promises");
const raiz = new URL("../", import.meta.url);
const appJs = await readFile(new URL("app.js", raiz), "utf8");
const indexHtml = await readFile(new URL("index.html", raiz), "utf8");

// O bloco do app entre os marcadores, executado à parte (só dados, sem a página).
function blocoDoApp() {
  const ini = appJs.indexOf("// <quadros-familia>");
  const fim = appJs.indexOf("// </quadros-familia>");
  assert.ok(ini > 0 && fim > ini, "marcadores do bloco dos quadros no app.js");
  const codigo = appJs.slice(ini, fim);
  return new Function(codigo + "\nreturn { QUADROS_FAMILIA, IDS_QUADROS_FAMILIA, QUADROS_FAMILIA_OBRIGATORIOS, FAMILIA_JOGOS, familiaMinutosDosQuadros, familiaQuadrosMigrados };")();
}

teste("catálogo dos quadros: 12 na ordem fixa, obrigatórios, minutos (mínimo 35, todos 65) e fontes válidas", () => {
  assert.deepEqual(IDS_QUADROS, ["oracao_inicial", "abertura", "video", "principio", "personagem", "jesus", "criador", "saiba_responder", "ame_ministerio", "jogo", "canticos", "oracao_final"]);
  assert.deepEqual(QUADROS_OBRIGATORIOS, ["oracao_inicial", "abertura", "video", "principio", "personagem", "jesus", "oracao_final"]);
  assert.equal(minutosDosQuadros(QUADROS_OBRIGATORIOS), 35);
  assert.equal(minutosDosQuadros(IDS_QUADROS), 65); // 10+10+5+5+5 obrigatórios + 5+5+5+10+5 opcionais
  assert.ok(Object.isFrozen(QUADROS_FAMILIA) && QUADROS_FAMILIA.every((q) => Object.isFrozen(q) && Object.isFrozen(q.fontes.livros)));
  assert.deepEqual(QUADROS_FAMILIA.filter((q) => !q.ligadoAoTema).map((q) => q.id), ["oracao_inicial", "criador", "oracao_final"]);
  assert.ok(QUADROS_FAMILIA.every((q) => q.nome && q.emoji && (q.minutos === null) === q.id.startsWith("oracao")));
  for (const q of QUADROS_FAMILIA) for (const chave of q.fontes.livros) assert.ok(nomeDoLivro(chave), `${q.id}: livro "${chave}" não existe em LIVROS`);
  assert.deepEqual(QUADROS_FAMILIA.find((q) => q.id === "principio").perguntasPadrao, ["Que princípio podemos extrair do(s) texto(s) acima?", "Em que situações práticas esse princípio pode nos orientar?"]);
  assert.equal(JOGOS_FAMILIA.length, 6);
  assert.ok(QUADROS_FAMILIA.every((q) => !/culto/i.test(q.nome + q.saida)));
});

teste("quadrosDoPedido: pedido novo, perfis antigos (atividades, cânticos, nomes antigos) e ids inválidos", () => {
  const ob = QUADROS_OBRIGATORIOS;
  const ordem = (ids) => IDS_QUADROS.filter((id) => ids.includes(id));
  assert.deepEqual(quadrosDoPedido({ quadros: ["canticos", "xyz", "criador"] }).quadros, ordem([...ob, "criador", "canticos"]));
  assert.deepEqual(quadrosDoPedido({ quadros: [] }).quadros, ob);
  assert.deepEqual(quadrosDoPedido({}).quadros, ordem([...ob, "jogo"]), "sem nada: obrigatórios e o Jogo bíblico");
  const antigo = quadrosDoPedido({ atividades: ["Leitura de passagens bíblicas", "Jogos bíblicos", "Treino dos cânticos", "Cântico final"], jogos: ["Ordem dos acontecimentos", "Mímica", "Verdadeiro ou falso"] });
  assert.deepEqual(antigo.quadros, ordem([...ob, "jogo", "canticos"]));
  assert.equal(antigo.canticoInicial, false);
  assert.equal(antigo.canticoFinal, true);
  assert.deepEqual(antigo.jogos, ["Verdadeiro ou falso", "Ordem e data dos acontecimentos"]);
  const semJogo = quadrosDoPedido({ atividades: ["Vídeo do jw.org"], canticosInicioFim: true, jogos: ["Mímica"] });
  assert.deepEqual(semJogo.quadros, ob);
  assert.equal(semJogo.canticoInicial && semJogo.canticoFinal, true);
  assert.deepEqual(semJogo.jogos, JOGOS_FAMILIA, "sem jogo aceito válido: os 6");
  assert.deepEqual(quadrosDoPedido({ atividades: ["Jogos ou adivinhas"] }).quadros, ordem([...ob, "jogo"]));
});

const casosDeMigracao = [
  {},
  { quadros: ["jogo", "saiba_responder", "nada"], canticoInicial: true, jogos: ["Complete o versículo"] },
  { atividades: ["Jogos bíblicos", "Treino dos cânticos"], jogos: ["Ordem dos acontecimentos"] },
  { atividades: ["Cântico inicial", "Leitura de passagens bíblicas"], duracao: 60, quantidade: 2, jogoPapel: true },
  { atividades: [], canticosInicioFim: true },
  { quadros: "não é lista", atividades: ["Jogos ou adivinhas"] },
  null,
];

teste("app.js: o bloco dos quadros é igual ao do servidor (catálogo, jogos, minutos e migração)", () => {
  const app = blocoDoApp();
  const essencial = (q) => ({ id: q.id, nome: q.nome, emoji: q.emoji, minutos: q.minutos, obrigatorio: q.obrigatorio, ligadoAoTema: q.ligadoAoTema });
  assert.deepEqual(app.QUADROS_FAMILIA.map(essencial), QUADROS_FAMILIA.map(essencial));
  assert.deepEqual([...app.IDS_QUADROS_FAMILIA], [...IDS_QUADROS]);
  assert.deepEqual([...app.QUADROS_FAMILIA_OBRIGATORIOS], [...QUADROS_OBRIGATORIOS]);
  assert.deepEqual([...app.FAMILIA_JOGOS], [...JOGOS_FAMILIA]);
  assert.equal(app.familiaMinutosDosQuadros(IDS_QUADROS), 65);
  for (const caso of casosDeMigracao) assert.deepEqual(app.familiaQuadrosMigrados(caso), quadrosDoPedido(caso), JSON.stringify(caso));
});

teste("perfilDaFamilia: duração = soma dos quadros, estrutura, jogos só com o quadro Jogo, sem quantidade nem papel", () => {
  const p = perfilDaFamilia({ formacao: "Casal com filhos", membros: [{ apelido: "Ana", papel: "Mãe", idade: 40 }], quadros: ["criador", "jogo"], jogos: ["Verdadeiro ou falso"], duracao: 90, quantidade: 2, jogoPapel: true });
  assert.equal(p.duracao, minutosDosQuadros(p.quadros));
  assert.equal(p.duracao, 50);
  assert.ok(p.quadros.includes("jogo") && p.quadros.includes("criador"));
  assert.deepEqual(p.jogos, ["Verdadeiro ou falso"]);
  assert.ok(!("quantidade" in p) && !("jogoPapel" in p));
  assert.equal(p.incluirVideo, true);
  const semJogo = perfilDaFamilia({ formacao: "Casal sem filhos", quadros: [], jogos: ["Verdadeiro ou falso"] });
  assert.deepEqual(semJogo.jogos, []);
  assert.equal(semJogo.duracao, 35);
  assert.ok(Array.isArray(semJogo.estrutura) && semJogo.estrutura.length >= 3);
  assert.ok(!semJogo.estrutura.some((e) => /jogo/i.test(e)), "sem o quadro Jogo, a estrutura não tem jogo");
  assert.ok(p.estrutura.some((e) => /jogo/i.test(e)), "com o quadro Jogo, a estrutura tem o jogo");
});

teste("prompt e formato da Adoração: uma programação, os 6 jogos e nada de FunPlayB, mímica, charadas, torta ou papel e lápis", () => {
  const parte = prompts.PARTES.find((p) => p.id === "adoracao_familia");
  const formato = prompts.travadosDe({}).find((t) => t.id === "formato_adoracao_familia").texto;
  const montagem = prompts.travadosDe({}).find((t) => t.id === "montagem_pedidos").texto;
  for (const [nome, t] of [["padrão", parte.padrao], ["formato", formato]]) {
    assert.doesNotMatch(t, /funplayb|mímica|charada|torta|papel e l[aá]pis/i, nome);
    assert.doesNotMatch(t, /culto/i, nome);
  }
  assert.match(formato, /exatamente 1 item/);
  for (const j of JOGOS_FAMILIA) assert.ok(parte.padrao.includes(j.replace(/\s*\(.*$/, "")), "padrão sem o jogo " + j);
  assert.match(parte.padrao, /ADULTO BATIZADO/i);
  assert.match(montagem, /QUADROS DA PROGRAMAÇÃO ESCOLHIDOS PELO CHEFE/);
  assert.doesNotMatch(montagem, /funplayb/i);
});

teste("tela: quadros e jogos montados pelo app, campos antigos removidos, formações conhecidas e sem FunPlayB na Adoração", () => {
  for (const id of ["familiaQuadros", "familiaQuadrosTotal", "familiaQuadrosCurta", "familiaQuadrosCompleta", "familiaCanticoInicial", "familiaCanticoFinal", "familiaJogos", "familiaJogosTodos", "familiaJogosNenhum"]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`), "falta #" + id);
  }
  for (const id of ["familiaDuracao", "familiaQuantidade", "familiaJogoPapel", "familiaEstrutura", "familiaAtividades"]) {
    assert.doesNotMatch(indexHtml, new RegExp(`id="${id}"`), "sobrou #" + id);
    assert.doesNotMatch(appJs, new RegExp(`['"#]${id}['"\\s]`), "app.js ainda usa " + id);
  }
  const selFormacao = indexHtml.slice(indexHtml.indexOf('id="familiaFormacao"'), indexHtml.indexOf("</select>", indexHtml.indexOf('id="familiaFormacao"')));
  for (const f of ["Mãe ou pai sozinho", "Quem mora sozinho", "Casal com filhos", "Casal sem filhos", "Família com avós ou outros"]) assert.ok(selFormacao.includes(`value="${f}"`), "formação " + f);
  // FunPlayB: só o convite da tela Formatar continua (index.html); no app.js, só em comentários (código nenhum).
  const funplaybNoApp = appJs.split("\n").filter((l) => /funplayb/i.test(l.split("//")[0]));
  assert.deepEqual(funplaybNoApp, [], "FunPlayB no código do app.js");
  assert.doesNotMatch(appJs, /familiaQtdPedida|familiaOpcoesTexto|jogoPapel:/);
});

for (const [nome, fn] of testes) {
  try {
    await fn();
    ok++;
    console.log("ok  - " + nome);
  } catch (e) {
    console.log("ERRO - " + nome + "\n      " + (e?.message || e));
  }
}
console.log(`\n${ok} de ${testes.length} testes passaram.`);
process.exit(ok === testes.length ? 0 : 1);
