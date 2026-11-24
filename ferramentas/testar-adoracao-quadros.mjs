// Teste da Adoração em Família por quadros (partes puras, sem IA e sem rede). Cresce a cada fase da refatoração.
// Fase 1 (6.12.69): constante única das 10 prioridades de aplicação prática e prioridadesAplicaveis(perfil).
// Fase 2 (6.12.70): catálogo dos quadros (api/_familiaQuadros.mjs), cópia igual no app.js, migração dos perfis antigos, tela e prompt.
// Fase 3a (6.12.71): candidatos (princípios e artigos), escolhas da IA, formatos zod, montagem no app, fases no servidor e prompts.
// Fase 3b (6.12.72): quadros próprios (Vídeo, Criador, Saiba responder, Ame o ministério, Jogo, Cânticos), memória "evitar", repetição,
// datas do Apêndice B, corte no fim da frase e o item interno da memória no app.
// Patch 6.12.76: jogos conferidos pelo servidor (idTipo, quantidade por tipo, Complete o versículo e Quem disse isso? montados com a Bíblia,
// troca do tipo, memória jogo_versiculos), Princípio em "relatos" e Jesus com um episódio.
// Patch 6.12.77: aspas soltas no Complete o versículo, quem fala conferido no Quem disse isso? e a grafia dos livros nas referências.
// Com FONTES_DIR, confere também as fontes reais (principios.json e as referências abreviadas na Bíblia).
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

// ---------- Fase 3a (6.12.71): geração por quadros (plano + Abertura, Princípio, Personagem e Jesus) ----------
const ger = await import("../api/_familiaGeracao.mjs");
const { SaidaPlanoFamilia, SAIDAS_QUADRO_FAMILIA } = await import("../api/sugerir-formatacao.mjs");
const servidorJs = await readFile(new URL("api/sugerir-formatacao.mjs", raiz), "utf8");
const sessaoJs = await readFile(new URL("api/familia-sessao.mjs", raiz), "utf8");
const fontesMod = await import("../api/_fontes.mjs");
const comFontes = fontesMod.fontesConfiguradas();

const entradaPr = (id, extra) => Object.assign({ id, verbete: "Perdão", subverbete: "", pergunta: "", texto: "Texto da entrada " + id, versiculos: ["Mt 6:14"], relatos: [] }, extra);

teste("princípios: saem as entradas sem versículos nem relatos e as que começam com \"Veja\" (sintético e real)", async () => {
  const lista = [
    entradaPr("a"),
    entradaPr("b", { versiculos: [], relatos: [] }),
    entradaPr("c", { versiculos: [], relatos: [{ referencia: "Gên 50:15-21" }] }),
    entradaPr("d", { texto: "Veja também Amor" }),
    entradaPr("e", { texto: "  veja Perdão" }),
    null,
    { id: "f", verbete: "X", texto: 3, versiculos: ["Jo 3:16"] },
  ];
  assert.deepEqual(ger.principiosCandidatos(lista).map((e) => e.id), ["a", "c"]);
  if (comFontes) {
    const dados = await fontesMod.lerPrincipios();
    const todas = dados.entradas;
    const fora = todas.filter((e) => !((e.versiculos || []).length || (e.relatos || []).length) || /^veja\b/i.test(String(e.texto || "").trim()));
    const ficam = ger.principiosCandidatos(todas);
    assert.equal(ficam.length, todas.length - fora.length);
    assert.ok(ficam.every((e) => !/^veja\b/i.test(e.texto.trim()) && ((e.versiculos || []).length || (e.relatos || []).length)));
    console.log(`      principios.json: ${todas.length} entradas, ${fora.length} fora, ${ficam.length} candidatas`);
  }
});

teste("candidatosPrincipio: tema primeiro, evitar vai para o fim, semente reproduzível; referências e fonte", () => {
  const lista = [
    entradaPr("p1", { verbete: "Trabalho" }),
    entradaPr("p2", { verbete: "Perdão", pergunta: "Por que perdoar?" }),
    entradaPr("p3", { verbete: "Paciência" }),
    entradaPr("p4", { verbete: "Perdão", subverbete: "entre irmãos" }),
  ];
  const c = ger.candidatosPrincipio(lista, "perdão em família", { max: 2, semente: 7 });
  assert.deepEqual(c.map((e) => e.id).sort(), ["p2", "p4"]);
  assert.deepEqual(ger.candidatosPrincipio(lista, "perdão", { max: 4, semente: 7 }).map((e) => e.id), ger.candidatosPrincipio(lista, "perdão", { max: 4, semente: 7 }).map((e) => e.id));
  const semP2 = ger.candidatosPrincipio(lista, "perdão", { max: 2, semente: 3, evitar: ["p2"] });
  assert.ok(!semP2.some((e) => e.id === "p2"), "o evitado não volta quando há outros suficientes");
  const e = entradaPr("x", { verbete: "Adoração", subverbete: "a Jeová", pagina: 10, versiculos: ["Êx 34:14", "De 5:8-10", "Êx 34:14"], relatos: [{ referencia: "Mt 4:8-10" }] });
  assert.deepEqual(ger.referenciasDoPrincipio(e, 4), ["Êx 34:14", "De 5:8-10", "Mt 4:8-10"]);
  assert.deepEqual(ger.referenciasDoPrincipio(e, 1), ["Êx 34:14"]);
  assert.equal(ger.fonteDoPrincipio(e), 'Princípios Bíblicos para a Vida Cristã, verbete "Adoração" · subverbete "a Jeová" · pág. 10');
});

teste("artigos do catálogo: só com docId, sem vídeo e fora da lista sem texto no wol; ciência; evitar", () => {
  const art = (id, extra) => Object.assign({ id, tipo: "artigo", titulo: "Como perdoar " + id, secao: "Família", docId: "1102010341", url: "https://www.jw.org/pt/ensinos-biblicos/familia/" + id }, extra);
  const lista = [
    art("ok1"),
    art("sem-doc", { docId: "" }),
    art("video", { video: true }),
    art("fig", { url: "https://www.jw.org/pt/biblioteca/atividades-com-figuras/x/" }),
    art("projeto", { url: "https://www.jw.org/pt/ensinos-biblicos/ciencia/teve-um-projeto/x/", ciencia: true }),
    art("cien", { ciencia: true, titulo: "A ciência e a Bíblia" }),
    art("outro", { tipo: "video" }),
  ];
  assert.deepEqual(ger.artigosLegiveis(lista).map((a) => a.id), ["ok1", "cien"]);
  assert.deepEqual(ger.artigosLegiveis(lista, { ciencia: true }).map((a) => a.id), ["cien"]);
  assert.equal(ger.urlWolDoDocId("1102010341"), "https://wol.jw.org/pt/wol/d/r5/lp-t/1102010341");
  assert.equal(ger.urlWolDoDocId("abc"), "");
  assert.ok(ger.URL_SEM_TEXTO_NO_WOL.test("/pt/biblioteca/videos/x") && ger.URL_SEM_TEXTO_NO_WOL.test("tabelas/y") && !ger.URL_SEM_TEXTO_NO_WOL.test("/ensinos-biblicos/familia/"));
  const muitos = Array.from({ length: 12 }, (_, i) => art("a" + i, { docId: String(1000000 + i) }));
  const sem = ger.candidatosArtigos(muitos, "perdoar", { max: 5, evitar: ["a0", "1000001"] });
  assert.equal(sem.length, 5);
  assert.ok(!sem.some((a) => a.id === "a0" || a.id === "a1"));
  assert.equal(ger.MIN_CARACTERES_ARTIGO, 600);
});

teste("escolhas da IA: \"PR3\", \"[A2]\", \"L 1 - título\"; fora do tamanho ou de outro prefixo = -1; sem repetir", () => {
  assert.equal(ger.idDaEscolha("PR3", "PR", 5), 2);
  assert.equal(ger.idDaEscolha("[A2]", "A", 5), 1);
  assert.equal(ger.idDaEscolha("L 1 - Imite a Sua Fé", "L", 5), 0);
  assert.equal(ger.idDaEscolha("A9", "A", 5), -1);
  assert.equal(ger.idDaEscolha("L1", "A", 5), -1);
  assert.equal(ger.idDaEscolha("PR1", "P", 5), -1, "P não confunde com PR");
  assert.equal(ger.idDaEscolha("A0", "A", 5), -1);
  assert.equal(ger.idDaEscolha("Abertura", "A", 5), -1);
  assert.deepEqual(ger.escolhasValidas(["PR2", "PR2", "x", "PR9", "PR1", "PR3"], "PR", 5, 2), [1, 0]);
  assert.deepEqual(ger.escolhasValidas("PR4", "PR", 5), [3]);
});

teste("constantes: quadros gerados = os 10 com minutos; todos especializados (6.12.72); 4 em paralelo (servidor e app)", () => {
  assert.deepEqual([...ger.QUADROS_GERADOS], QUADROS_FAMILIA.filter((q) => q.minutos).map((q) => q.id));
  assert.equal(ger.QUADROS_GERADOS.length, 10);
  assert.deepEqual([...ger.QUADROS_ESPECIALIZADOS].sort(), [...ger.QUADROS_GERADOS].sort());
  for (const id of ger.QUADROS_ESPECIALIZADOS) assert.match(servidorJs, new RegExp(`\\r?\\n  async ${id}\\(ctx\\) \\{`), "PREPARAR_QUADRO_FAMILIA." + id);
  assert.doesNotMatch(servidorJs, /generico|prepararQuadroGenerico|JogoDoQuadroFamilia/);
  assert.equal(ger.MAX_QUADROS_EM_PARALELO, 4);
  assert.match(appJs, /const FAMILIA_QUADROS_EM_PARALELO = 4;/);
});

teste("formatos (zod): plano e cada quadro aceitam uma saída de exemplo e recusam a incompleta", () => {
  const plano = { titulo: "Perdoar como Jeová", emoji: "🕊️", resumo: "r", objetivo: "o", assunto: "perdão", angulos: [{ quadro: "abertura", angulo: "a" }], preparacao: [], tarefas: [{ membro: "Pai", tarefa: "ler" }], dicaParaOChefe: null, canticoInicial: 12, canticoFinal: null };
  assert.ok(SaidaPlanoFamilia.safeParse(plano).success);
  assert.ok(!SaidaPlanoFamilia.safeParse({ ...plano, angulos: undefined }).success);
  const exemplos = {
    abertura: { descricao: "d", escolhas: ["A1"], perguntasLeitura: ["p"], relato: { referencia: "Gên 50:15-21", perguntas: ["q"] } },
    principio: { descricao: "d", escolha: "PR1" },
    personagem: { nome: "José", referencia: "Gên 45:1-15", descricao: "d", escolha: null, verbete: "José" },
    jesus: { episodio: "O filho pródigo", referencia: "Lu 15:11-32", qualidade: "misericórdia", descricao: "d", escolha: "L1", perguntas: [] },
    video: { descricao: "d", videos: ["V1"], perguntas: ["p"] },
    criador: { descricao: "d", escolha: "A1", perguntas: ["p"] },
    saiba: { pergunta: "Deus se importa?", descricao: "d", escolha: "L1", verbete: null, textos: ["1Pe 5:7"] },
    ministerio: { cenario: "Uma pessoa diz que não tem tempo", descricao: "d", escolha: null, perguntas: ["p"] },
    jogo: { descricao: "d", nome: "Ordem", comoJogar: "c", rodadas: [], eventos: ["B1", "B2"] },
    canticos: { numero: 3, descricao: "d" },
  };
  assert.deepEqual(Object.keys(SAIDAS_QUADRO_FAMILIA).sort(), Object.keys(exemplos).sort());
  for (const [id, ex] of Object.entries(exemplos)) {
    assert.ok(SAIDAS_QUADRO_FAMILIA[id].safeParse(ex).success, id);
    assert.ok(!SAIDAS_QUADRO_FAMILIA[id].safeParse({}).success, id + " vazio");
  }
});

// O bloco da montagem do app (entre os marcadores), executado à parte.
function montagemDoApp() {
  const ini = appJs.indexOf("// <montagem-familia>");
  const fim = appJs.indexOf("// </montagem-familia>");
  assert.ok(ini > 0 && fim > ini, "marcadores da montagem no app.js");
  return new Function(appJs.slice(ini, fim) + "\nreturn familiaMontarPrograma;")();
}

teste("montagem no app: cântico inicial → oração → quadros na ordem do catálogo (falhas saem) → cântico final → oração; soma dos minutos", () => {
  const montar = montagemDoApp();
  const parte = (id, min) => ({ nome: "Parte " + id, minutos: min, responsavel: "Ana", descricao: "d", textos: [{ referencia: "Jo 3:16", texto: "t" }], perguntas: ["q"], quadro: "outro" });
  const quadros = ["oracao_inicial", "abertura", "video", "principio", "personagem", "jesus", "jogo", "oracao_final"];
  const plano = { titulo: "Perdoar", emoji: "🕊️", resumo: "r", objetivo: "o", assunto: "perdão", preparacao: ["p"], tarefas: [{ membro: "Pai", tarefa: "ler" }], dicaParaOChefe: "dica", canticoInicial: { numero: 12, titulo: "Jeová, o grande Deus" }, canticoFinal: { numero: 3, titulo: "x" } };
  // fora de ordem, com o Vídeo faltando (falhou) e um quadro não marcado (criador), que não entra
  const partes = { jogo: parte("jogo", 10), jesus: parte("jesus", 5), abertura: parte("abertura", 10), principio: parte("principio", 5), personagem: parte("personagem", 5), criador: parte("criador", 5) };
  const op = montar(plano, partes, quadros, QUADROS_FAMILIA);
  assert.deepEqual(op.partes.map((p) => p.quadro), ["cantico_inicial", "oracao_inicial", "abertura", "principio", "personagem", "jesus", "jogo", "cantico_final", "oracao_final"]);
  assert.equal(op.duracaoTotal, 35);
  assert.equal(op.partes[0].canticos[0].numero, 12);
  assert.equal(op.partes[0].minutos, 0);
  assert.ok(op.partes.every((p) => p.responsavel === ""), "nunca nomes nas atividades");
  assert.equal(op.titulo, "Perdoar");
  assert.equal(op.dicaParaOChefe, "dica");
  assert.deepEqual(op.tarefas, [{ membro: "Pai", tarefa: "ler" }]);
  const semCanticos = montar({ titulo: "", canticoInicial: null, canticoFinal: null }, { abertura: parte("abertura", 10) }, quadros, QUADROS_FAMILIA);
  assert.deepEqual(semCanticos.partes.map((p) => p.nome), ["Oração inicial", "Parte abertura", "Oração final"]);
  assert.equal(semCanticos.titulo, "Adoração em Família");
  assert.equal(semCanticos.duracaoTotal, 10);
});

teste("servidor: fases plano/quadro, limite 16 partes, limite por hora dos quadros e leitura com rótulo na sessão", () => {
  assert.match(servidorJs, /if \(body\.fase === "plano"\) return gerarPlanoFamilia\(res, body, P\);/);
  assert.match(servidorJs, /if \(body\.fase === "quadro"\) return gerarQuadroFamilia\(res, body, P\);/);
  assert.match(servidorJs, /const partesBrutas = \(o\.partes \|\| \[\]\)\.slice\(0, 16\);/);
  assert.doesNotMatch(servidorJs, /const partesBrutas = \(o\.partes \|\| \[\]\)\.slice\(0, 10\);/);
  // 6.12.75: o ajuste da programação montada (ajustarProgramaFamilia) saiu; um app antigo recebe 410 sem chamar a IA.
  assert.ok(!servidorJs.includes("ajustarProgramaFamilia"), "ajustarProgramaFamilia saiu");
  assert.match(servidorJs, /if \(body\.programa\) return erro\(res, 410, /);
  assert.match(servidorJs, /const quadroFamilia = tarefa === "adoracao-familia" && body\.fase === "quadro";/);
  assert.match(servidorJs, /excedeuLimite\(quadroFamilia \? ip \+ "\|quadro" : ip, quadroFamilia \? P\.limites\.limitePorHora \* 4 : P\.limites\.limitePorHora\)/);
  assert.match(sessaoJs, /rotulo: texto\(p\.leitura\.rotulo, 80\)/);
  // Nada do perfil no log dos quadros: só contagens.
  const logs = servidorJs.split("\n").filter((l) => /console\.log\("Adoração em Família \((plano|quadro)\)/.test(l));
  assert.equal(logs.length, 2);
  for (const l of logs) assert.doesNotMatch(l, /apelido|perfil\.assunto[^)]|membros\.map|circunstancias/);
});

teste("prompts dos quadros: partes editáveis na categoria, sem \"culto\", sistemas montados com vocabulário, fontes e formato travado", () => {
  const ids = ["adoracao_q_base", "adoracao_q_plano", "adoracao_q_abertura", "adoracao_q_principio", "adoracao_q_personagem", "adoracao_q_jesus", "adoracao_q_video", "adoracao_q_criador", "adoracao_q_saiba", "adoracao_q_ministerio", "adoracao_q_jogo", "adoracao_q_conferir", "adoracao_q_canticos"];
  assert.ok(!prompts.PARTES.some((x) => x.id === "adoracao_q_generico"), "a parte genérica saiu");
  const cat = prompts.CATEGORIAS.find((c) => (c.partes || []).includes("adoracao_familia"));
  assert.ok(cat, "categoria da Adoração");
  for (const id of ids) {
    const p = prompts.PARTES.find((x) => x.id === id);
    assert.ok(p && typeof p.padrao === "string" && p.padrao.length >= 20, id);
    assert.doesNotMatch(p.padrao, /culto/i, id);
    assert.ok(cat.partes.includes(id), id + " fora da categoria");
  }
  const travados = prompts.travadosDe({}).map((t) => t.id);
  for (const id of ["formato_familia_plano", "formato_familia_quadro_abertura", "formato_familia_quadro_principio", "formato_familia_quadro_personagem", "formato_familia_quadro_jesus", "formato_familia_quadro_video", "formato_familia_quadro_criador", "formato_familia_quadro_saiba", "formato_familia_quadro_ministerio", "formato_familia_quadro_jogo", "formato_familia_quadro_canticos"]) assert.ok(travados.includes(id), id);
  assert.ok(!travados.includes("formato_familia_quadro_generico"));
  const vocab = /VOCABULÁRIO \(regra fixa, vale sempre\)/;
  const fontes = /FONTES: PRIORIDADE E ATUALIDADE/;
  assert.match(montados.sistemaFamiliaPlano, vocab);
  assert.match(montados.sistemaFamiliaPlano, fontes);
  assert.deepEqual(Object.keys(montados.sistemaFamiliaQuadro).sort(), ["abertura", "canticos", "criador", "jesus", "jogo", "ministerio", "personagem", "principio", "saiba", "video"]);
  for (const [id, s] of Object.entries(montados.sistemaFamiliaQuadro)) {
    assert.match(s, vocab, id);
    assert.match(s, fontes, id);
    assert.ok(s.startsWith(prompts.PARTES.find((x) => x.id === "adoracao_q_base").padrao), id + " começa pela base");
  }
  assert.match(prompts.travadosDe({}).find((t) => t.id === "montagem_pedidos").texto, /por quadros/);
});

teste("app: plano e quadros (fase), andamento com Refazer, rótulo da leitura e #familiaProgresso na tela", () => {
  assert.match(appJs, /fase: 'plano'/);
  assert.match(appJs, /fase: 'quadro',\n\s+quadro: id,/);
  assert.match(appJs, /🔄 Refazer este quadro/);
  assert.match(appJs, /parte\.leitura\.rotulo \|\| 'Trecho inicial da matéria'/);
  assert.match(indexHtml, /<div id="familiaProgresso" class="fam-progresso"[^>]*hidden><\/div>/);
  const gerar = appJs.slice(appJs.indexOf("async function familiaGerar()"), appJs.indexOf("// Relógio do preparo (6.11.12)"));
  assert.doesNotMatch(gerar, /culto/i);
  assert.match(gerar, /historicoSalvar|familiaMostrarESalvar/);
});

// ---------- Fase 3b (6.12.72): quadros próprios, memória "evitar", repetição e datas do Apêndice B ----------
const apendiceSintetico = [
  "=== ÉPOCAS ===",
  "Depois de 4026 a.C.",
  "Criação de Adão",
  "• 1513 a.C. Israelitas saem do Egito",
  "Babilônia",
  "607 a.C. Rei Nabucodonosor destrói Jerusalém",
  "• Derramamento do espírito santo Pentecostes de 33 d.C.",
  "1077-1038 a.C.",
  "Reinado de Davi",
  "Futuro",
  "Armagedom",
].join("\n");

teste("cortarNoFimDaFrase: corta no fim da última frase que cabe, sem cortar abreviação; sem frase, no espaço com …", () => {
  const t = "Primeira frase completa aqui. Segunda frase também completa! Terceira frase que não cabe inteira no limite dado.";
  assert.equal(ger.cortarNoFimDaFrase(t, 1000), t);
  assert.equal(ger.cortarNoFimDaFrase(t, 70), "Primeira frase completa aqui. Segunda frase também completa!");
  const abrev = "Leia o cap. 3 com calma e atenção a cada detalhe do relato. Depois conversem sobre o que aprenderam juntos hoje.";
  assert.equal(ger.cortarNoFimDaFrase(abrev, 80), "Leia o cap. 3 com calma e atenção a cada detalhe do relato.");
  const semPonto = "palavra ".repeat(60).trim();
  const c = ger.cortarNoFimDaFrase(semPonto, 50);
  assert.ok(c.endsWith("…") && c.length <= 50 && !/\s…$/.test(c), c);
  assert.match(servidorJs, /const leituraLimpa = \(texto\) => cortarNoFimDaFrase\(limparTextoGerado\(texto, 6000\), 2600\);/);
});

teste("Apêndice B: acontecimentos (4 formatos), valor das datas, datas permitidas e rodadas com data de fora descartadas", async () => {
  const ev = ger.eventosDoApendiceB(apendiceSintetico);
  const datas = ev.map((e) => e.data);
  assert.deepEqual(datas, ["Depois de 4026 a.C.", "1513 a.C.", "607 a.C.", "33 d.C.", "1077-1038 a.C.", "Futuro"]);
  assert.equal(ev[0].evento, "Criação de Adão");
  assert.equal(ev[2].evento, "Babilônia: Rei Nabucodonosor destrói Jerusalém");
  assert.equal(ev[3].evento, "Derramamento do espírito santo Pentecostes");
  assert.ok(ger.valorDaData("1513 a.C.") < ger.valorDaData("607 a.C.") && ger.valorDaData("607 a.C.") < ger.valorDaData("33 d.C.") && ger.valorDaData("33 d.C.") < ger.valorDaData("Futuro"));
  assert.ok(ger.valorDaData("Depois de 4026 a.C.") > ger.valorDaData("4026 a.C."));
  assert.ok(Number.isNaN(ger.valorDaData("sem data")));
  const ok = ger.datasPermitidas(apendiceSintetico);
  for (const d of ["1513 a.C.", "607 a.C.", "33 d.C.", "1077-1038 a.C.", "1077 a.C.", "1038 a.C."]) assert.ok(ok.has(d), d);
  const rodadas = [{ p: "Quando saíram do Egito? 1513 a.C." }, { p: "Em que ano? 1000 a.C." }, { p: "Quem foi Davi?" }];
  assert.deepEqual(ger.semDatasForaDoApendice(rodadas, (r) => r.p, ok).map((r) => r.p), ["Quando saíram do Egito? 1513 a.C.", "Quem foi Davi?"]);
  assert.equal(ger.semDatasForaDoApendice(rodadas, (r) => r.p, null).length, 1, "sem Apêndice, nenhuma data vale");
  if (comFontes) {
    const real = (await fontesMod.lerTextoDoLivro("apendiceBBibliaEstudo")) || "";
    const reais = ger.eventosDoApendiceB(real);
    console.log(`      Apêndice B real: ${reais.length} acontecimentos com data`);
    assert.ok(reais.length >= 20, "poucos acontecimentos no Apêndice B real");
    assert.ok(reais.every((e) => e.data && e.evento.length >= 4 && (/^futuro$/i.test(e.data) || !Number.isNaN(ger.valorDaData(e.data)))));
  }
});

teste("memória evitar: categorias conhecidas, até 40 por categoria e 120 caracteres, sem repetir", () => {
  assert.equal(ger.MAX_EVITAR_POR_CATEGORIA, 40);
  assert.deepEqual([...ger.CATEGORIAS_EVITAR], ["assuntos", "personagens", "principios", "jesus", "saiba", "ministerio", "criador", "artigos", "canticos", "jogos", "videos", "leituras", "relatos", "jogo_versiculos"]);
  const muitos = Array.from({ length: 60 }, (_, i) => "Personagem " + i);
  const e = ger.normalizarEvitar({ personagens: [...muitos, "personagem 0"], assuntos: ["x".repeat(300)], intruso: ["a"], canticos: [12, "12", { n: 1 }] });
  assert.equal(e.personagens.length, 40);
  assert.equal(e.assuntos[0].length, 120);
  assert.ok(!("intruso" in e));
  assert.deepEqual(e.canticos, ["12"]);
  assert.deepEqual(ger.normalizarEvitar(null).videos, []);
  assert.deepEqual(ger.normalizarEvitar(["a"]).assuntos, []);
});

teste("repetição: versículos por faixa, personagem, vídeo e cântico (desta noite e das últimas semanas)", () => {
  assert.deepEqual(ger.chavesDosVersiculos("Lucas 15:11-13"), ["lucas 15:11", "lucas 15:12", "lucas 15:13"]);
  assert.deepEqual(ger.chavesDosVersiculos("Rom. 5:12, 18"), ["rom 5:12", "rom 5:18"]);
  assert.equal(ger.lankDoLink("https://www.jw.org/finder?wtlocale=T&lank=pub-mwbv_202401_1_VIDEO&applanguage=T"), "pub-mwbv_202401_1_VIDEO");
  const parte = { textos: [{ referencia: "Lucas 15:12" }], videos: [{ link: "https://www.jw.org/finder?lank=V9" }], canticos: [{ numero: 12 }] };
  const usados = ger.usadosDaParte(parte, { personagens: ["Davi"] });
  assert.deepEqual(usados.versiculos, ["lucas 15:12"]);
  assert.deepEqual(usados.videos, ["V9"]);
  assert.deepEqual(usados.canticos, ["12"]);
  const outra = ger.usadosDaParte({ textos: [{ referencia: "Lucas 15:11-14" }] }, { personagens: ["davi"] });
  const rep = ger.repeticoesDaParte(usados, outra, { videos: ["V9"], canticos: ["12"] });
  assert.deepEqual(rep, ["o texto Lucas 15:12 já está em outro quadro", "o personagem Davi já está em outro quadro", "o vídeo foi usado nas últimas semanas", "o cântico 12 foi usado nas últimas semanas"]);
  assert.deepEqual(ger.repeticoesDaParte(usados, {}, {}), []);
});

teste("jogo: tipo entre os aceitos, sem os recentes; sem Apêndice B, sem Ordem e data; link de consulta no wol", () => {
  const todos = ["Quem sou eu? (personagens bíblicos)", "Verdadeiro ou falso", "Ordem e data dos acontecimentos", "Quem disse isso? (frases da Bíblia)", "Complete o versículo", "Abreviações bíblicas (ex.: Os 12 A de C)"];
  assert.equal(ger.tipoDoJogo(["Verdadeiro ou falso", "Complete o versículo"], todos, { semente: 3, evitar: ["Verdadeiro ou falso"] }), "Complete o versículo");
  assert.equal(ger.tipoDoJogo(["Ordem e data dos acontecimentos"], todos, { comApendice: true }), "Ordem e data dos acontecimentos");
  assert.notEqual(ger.tipoDoJogo(["Ordem e data dos acontecimentos"], todos, { comApendice: false }), "Ordem e data dos acontecimentos");
  for (let s = 1; s < 30; s++) assert.ok(todos.includes(ger.tipoDoJogo([], todos, { semente: s })), "só os 6 tipos");
  const link = ger.linkDeConsultaWol("“Deus se importa com você.” Essa é uma verdade que consola muita gente hoje.");
  assert.ok(link.startsWith("https://wol.jw.org/pt/wol/s/r5/lp-t?q="), link);
  // 6.12.73: a busca para no fim da primeira frase quando ela já tem 5 palavras.
  assert.ok(decodeURIComponent(link).includes('q="Deus se importa com você"&'), decodeURIComponent(link));
  assert.equal(ger.linkDeConsultaWol(""), "");
  assert.doesNotMatch(link, /www\.jw\.org/);
});

const { montarPedidoQuadroFamilia, montarPedidoPlanoFamilia } = await import("../api/sugerir-formatacao.mjs");
const corpoFamilia = (extra) =>
  Object.assign(
    {
      formacao: "Casal com filhos",
      membros: [{ papel: "Pai", idade: 40 }, { papel: "Filho", idade: 12 }],
      quadros: QUADROS_FAMILIA.map((q) => q.id),
      canticoInicial: true,
      canticoFinal: true,
      assunto: "",
    },
    extra
  );

teste("pedidos ao servidor: EVITAR e ASSUNTOS DAS ÚLTIMAS SEMANAS no plano; JÁ USADOS e quadro fora do tema na mensagem do quadro", async () => {
  const evitar = { assuntos: ["Paciência na família"], personagens: ["Gideão"], jesus: ["O filho pródigo"], canticos: ["12"] };
  const plano = await montarPedidoPlanoFamilia(corpoFamilia({ evitar }), montados);
  assert.ok(!plano.erro, JSON.stringify(plano.erro));
  assert.match(plano.mensagem, /ASSUNTOS DAS ÚLTIMAS SEMANAS \(evite repetir\): Paciência na família/);
  assert.match(plano.mensagem, /EVITAR \(personagens usados nas últimas semanas — escolha outros\): Gideão/);
  assert.match(plano.mensagem, /EVITAR \(episódios da vida de Jesus usados/);
  const comAssunto = await montarPedidoPlanoFamilia(corpoFamilia({ evitar, assunto: "Perdão" }), montados);
  assert.doesNotMatch(comAssunto.mensagem, /ASSUNTOS DAS ÚLTIMAS SEMANAS/, "com assunto pedido, a lista não vai");
  const jaUsados = { referencias: ["Lucas 15:11-14"], versiculos: ["lucas 15:11"], personagens: ["Davi"], canticos: ["3"] };
  const ministerio = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "ame_ministerio", evitar, jaUsados, assunto: "Perdão", angulo: "x" }), montados);
  assert.ok(!ministerio.erro, JSON.stringify(ministerio.erro));
  assert.match(ministerio.mensagem, /JÁ USADOS NOS OUTROS QUADROS DESTA NOITE \(não repita\): textos bíblicos: Lucas 15:11-14 — personagens: Davi — cânticos: 3/);
  assert.match(ministerio.mensagem, /ÂNGULO DESTE QUADRO: x/);
  assert.equal(ministerio.sistema, montados.sistemaFamiliaQuadro.ministerio);
  // O Criador é o único que não segue o assunto da noite.
  assert.deepEqual(QUADROS_FAMILIA.filter((q) => q.minutos && !q.ligadoAoTema).map((q) => q.id), ["criador"]);
  const criador = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "criador", evitar, assunto: "Perdão", angulo: "x" }), montados);
  assert.ok(!criador.erro, JSON.stringify(criador.erro));
  assert.match(criador.mensagem, /ASSUNTO: este quadro não segue o assunto da noite/);
  assert.doesNotMatch(criador.mensagem, /ÂNGULO DESTE QUADRO|Perdão/);
  assert.equal(criador.ctx.tema, "");
  const personagem = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "personagem", evitar, assunto: "Perdão", angulo: "perdoar irmãos" }), montados);
  assert.match(personagem.mensagem, /ÂNGULO DESTE QUADRO: perdoar irmãos/);
  assert.match(personagem.mensagem, /EVITAR \(personagens usados nas últimas semanas — escolha outros\): Gideão/);
  for (const q of ["criador"]) assert.equal(QUADROS_FAMILIA.find((x) => x.id === q).ligadoAoTema, false, q + " não segue o tema");
  assert.deepEqual(await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "generico" }), montados), { erro: [400, "Quadro desconhecido."] });
});

teste("jogo no servidor: tipo da noite na mensagem; Ordem e data com [B#] do Apêndice B e a ordem certa posta pelo servidor (com FONTES_DIR)", async () => {
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Ordem e data dos acontecimentos"] }), montados);
  assert.ok(!pedido.erro);
  assert.match(pedido.mensagem, /TIPO DO JOGO DESTA NOITE \(use só este\): /);
  if (!comFontes) return console.log("      (sem FONTES_DIR: [B#] pulado)");
  assert.match(pedido.mensagem, /TIPO DO JOGO DESTA NOITE \(use só este\): Ordem e data dos acontecimentos/);
  assert.match(pedido.mensagem, /\[B1\] .+ — .+/);
  const parte = await pedido.prep.montar({ descricao: "Vamos ver [B2] juntos.", nome: "Linha do tempo", comoJogar: "Ponham em ordem.", rodadas: [], eventos: ["B1", "B5", "B9", "B12", "B20"] });
  assert.equal(parte.descricao, "Vamos ver juntos.", "sem identificadores na descrição");
  const ordem = parte.jogo.ordem;
  assert.ok(ordem.length >= 5 && ordem.length <= 8);
  const valores = ordem.map((e) => ger.valorDaData(e.data));
  assert.deepEqual(valores, valores.slice().sort((a, b) => a - b), "ordem certa pela data");
  const textoApendice = await fontesMod.lerTextoDoLivro("apendiceBBibliaEstudo");
  const doApendice = ger.eventosDoApendiceB(textoApendice);
  for (const e of ordem) assert.ok(doApendice.some((x) => x.data === e.data && x.evento === e.evento), "fora do Apêndice B: " + e.data);
  assert.deepEqual(parte.jogo.itens.slice().sort(), ordem.map((e) => e.evento).sort());
  assert.match(parte.jogo.comoJogar, /Ordem certa \(datas do Apêndice B da Bíblia de Estudo\): 1\. /);
  assert.deepEqual(parte.memoria, { jogos: ["Ordem e data dos acontecimentos"] });
});

teste("princípio: uma entrada só (escolha), texto cortado no fim da frase (com FONTES_DIR)", async () => {
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "principio", assunto: "perdão", evitar: {} }), montados);
  assert.ok(!pedido.erro);
  assert.match(montados.sistemaFamiliaQuadro.principio, /"escolha"/);
  if (!comFontes) return console.log("      (sem FONTES_DIR: pulado)");
  const parte = await pedido.prep.montar({ descricao: "d", escolha: "PR2" });
  assert.ok(parte.leitura && parte.leitura.texto.length <= 2600);
  assert.equal(parte.memoria.principios.length, 1);
  assert.ok(parte.textos.length >= 1);
});

// O bloco da memória no app (entre os marcadores), executado com uma lista falsa de pesquisas salvas.
function evitarDoApp(cache) {
  const ini = appJs.indexOf("// <evitar-familia>");
  const fim = appJs.indexOf("// </evitar-familia>");
  assert.ok(ini > 0 && fim > ini, "marcadores da memória no app.js");
  const historicoLer = () => structuredClone(cache);
  const historicoGravar = (lista) => (cache.splice(0, cache.length, ...lista), true);
  return new Function("historicoCache", "historicoLer", "historicoGravar", appJs.slice(ini, fim) + "\nreturn { familiaEvitarLer, familiaEvitarRegistrar, familiaJaUsados, familiaUsadosCruzam };")(cache, historicoLer, historicoGravar);
}

teste("app: memória num item interno (fora das listas), novos primeiro, até 40; jaUsados com os cânticos do plano; cruzamento", () => {
  const cache = [{ id: "1", tipo: "nota", titulo: "x", partes: [] }];
  const m = evitarDoApp(cache);
  assert.deepEqual(m.familiaEvitarLer().personagens, []);
  m.familiaEvitarRegistrar([{ personagens: ["Davi"], canticos: ["12"] }, null, { personagens: ["Rute", "davi"] }]);
  assert.equal(cache[0].tipo, "familia-evitar");
  assert.equal(cache.length, 2);
  assert.deepEqual(m.familiaEvitarLer().personagens, ["Rute", "davi"], "os mais novos primeiro, sem repetir");
  assert.deepEqual(m.familiaEvitarLer().canticos, ["12"]);
  for (let i = 0; i < 50; i++) m.familiaEvitarRegistrar([{ assuntos: ["Assunto " + i] }]);
  const ev = m.familiaEvitarLer();
  assert.equal(ev.assuntos.length, 40);
  assert.equal(ev.assuntos[0], "Assunto 49");
  assert.equal(cache.filter((g) => g.tipo === "familia-evitar").length, 1);
  const g = {
    ids: ["abertura", "personagem", "jesus"],
    estado: { abertura: "ok", personagem: "ok", jesus: "erro" },
    usados: { abertura: { versiculos: ["lucas 15:11"], personagens: [] }, personagem: { personagens: ["Davi"] }, jesus: { personagens: ["Pedro"] } },
    plano: { canticoInicial: { numero: 12, titulo: "t" }, canticoFinal: null },
  };
  const j = m.familiaJaUsados(g, g.ids);
  assert.deepEqual(j.versiculos, ["lucas 15:11"]);
  assert.deepEqual(j.personagens, ["Davi"], "o quadro com erro não entra");
  assert.deepEqual(j.canticos, ["12"]);
  assert.ok(m.familiaUsadosCruzam({ personagens: ["davi"] }, j));
  assert.ok(m.familiaUsadosCruzam({ canticos: ["12"] }, j));
  assert.ok(!m.familiaUsadosCruzam({ versiculos: ["lucas 15:12"] }, j));
  // Na lista do app: historicoLer sem os internos; historicoGravar devolve os internos à frente.
  assert.match(appJs, /const HISTORICO_TIPOS_INTERNOS = new Set\(\['familia-evitar'\]\);/);
  assert.match(appJs, /const lista = opcoes && opcoes\.internos \? historicoCache : historicoCache\.filter\(g => !historicoInterno\(g\)\);/);
  assert.match(appJs, /if \(!lista\.some\(historicoInterno\)\) lista = \[\.\.\.historicoCache\.filter\(historicoInterno\), \.\.\.lista\];/);
});

teste("app: evitar no plano e nos quadros, jaUsados, conferência final com refazerRepetido e avisos no andamento", () => {
  assert.match(appJs, /fase: 'plano', evitar: ger\.evitar/);
  assert.match(appJs, /evitar: ger\.evitar,\n\s+jaUsados: familiaJaUsados\(ger, ger\.ids\.filter\(x => x !== id\)\)/);
  assert.match(appJs, /opcoes\.conferencia \? \{ refazerRepetido: true \} : \{\}/);
  assert.match(appJs, /await familiaConferirRepeticoes\(ger\);/);
  assert.match(appJs, /ger\.avisos && ger\.avisos\[id\] \? '⚠️ ' \+ ger\.avisos\[id\]/);
  assert.match(appJs, /function familiaRegistrarMemoria\(ger\)/);
  const gerar = appJs.slice(appJs.indexOf("async function familiaGerarQuadros"), appJs.indexOf("// Relógio do preparo (6.11.12)"));
  assert.doesNotMatch(gerar, /culto/i);
});

teste("fontes reais (com FONTES_DIR): a Bíblia do servidor entende as referências abreviadas do Princípios Bíblicos", async () => {
  if (!comFontes) return console.log("      (sem FONTES_DIR: pulado)");
  const dados = await fontesMod.lerPrincipios();
  const cands = ger.principiosCandidatos(dados.entradas);
  const amostra = ger.embaralhar(cands, 42).slice(0, 40).flatMap((e) => ger.referenciasDoPrincipio(e, 2));
  let achadas = 0;
  const falhas = [];
  for (const r of amostra) {
    const v = (await fontesMod.buscarVersiculos([r], 1).catch(() => []))[0];
    if (v && v.texto) achadas++;
    else falhas.push(r);
  }
  console.log(`      referências abreviadas achadas na Bíblia: ${achadas} de ${amostra.length}${falhas.length ? " (sem: " + falhas.slice(0, 6).join("; ") + ")" : ""}`);
  assert.ok(amostra.length >= 40 && achadas / amostra.length >= 0.9, `só ${achadas} de ${amostra.length}`);
});

// ---------- Patch 6.12.73: leituras e relatos na memória, sentido do Perspicaz, passagem inteira, soma dos vídeos, mínimo do jogo, marcas ----------

// Livros de teste para as funções puras (a função real vem de resolvedorDeLivros, com a Bíblia do servidor).
const LIVROS_TESTE = { "1sa": "1 Samuel", "1 samuel": "1 Samuel", "2sa": "2 Samuel", "2 samuel": "2 Samuel", jos: "Josué", "núm": "Números", "1cr": "1 Crônicas", "gênesis": "Gênesis", mateus: "Mateus" };
const livroTeste = (t) => LIVROS_TESTE[String(t).trim().toLowerCase().replace(/\s+/g, " ")] || null;
const MEFIBOSETE =
  "1. Um dos dois filhos do Rei Saul com Rispa, filha de Aiá. (2Sa 21:8) Estava entre os sete descendentes de Saul. (Veja Núm 25:4.) Davi mandou juntar os ossos deles. — 2Sa 21:1-14.\r\n" +
  "2. Filho de Jonatã; neto do Rei Saul. Nesta ocasião, ‘ele sofreu uma queda e ficou manco’. (2Sa 4:4) Sem dúvida, lembrando-se do seu pacto com Jonatã (1Sa 20:12-17, 42), Davi quis usar de benevolência. Depois disso, ele morou em Jerusalém. — 2Sa 9.\r\n" +
  "Quando Davi fugiu de Jerusalém, Ziba foi ao encontro dele. (2Sa 16:1-4)";
const ABIGAIL =
  "[(Meu) Pai se Fez Alegre]. 1. Uma das esposas de Davi. Originalmente, a esposa do abastado Nabal. (1Sa 25:2, 3; Jos 15:20, 55) Davi agradeceu a Deus. — 1Sa 25:32-35.\r\n" +
  "2. Irmã ou meia-irmã de Davi. — 1Cr 2:16, 17.";

teste("6.12.73: sentidos do verbete, referências citadas e o sentido que cita a passagem (Mefibosete 2, Abigail 1)", () => {
  assert.deepEqual(ger.sentidosDoVerbete(MEFIBOSETE).map((s) => s.numero), [1, 2]);
  assert.match(ger.sentidosDoVerbete(MEFIBOSETE)[1].texto, /^2\. Filho de Jonatã[\s\S]*Ziba/);
  assert.deepEqual(ger.sentidosDoVerbete(ABIGAIL).map((s) => s.numero), [1, 2], "o 1. depois de \"]. \"");
  assert.deepEqual(ger.sentidosDoVerbete("Um só sentido, sem números. (2Sa 9:1)").map((s) => s.numero), [0]);
  assert.deepEqual(ger.referenciasCitadas("(1Sa 25:2, 3; Jos 15:20, 55) e — 2Sa 9. e (1Sa 26:1; 27:2-4)", livroTeste), [
    { livro: "1 Samuel", capitulo: 25, versos: [2, 3] },
    { livro: "Josué", capitulo: 15, versos: [20, 55] },
    { livro: "2 Samuel", capitulo: 9, versos: [] },
    { livro: "1 Samuel", capitulo: 26, versos: [1] },
    { livro: "1 Samuel", capitulo: 27, versos: [2, 3, 4] },
  ]);
  assert.deepEqual(ger.referenciasCitadas("Veja 2Sa 4:4", livroTeste), [{ livro: "2 Samuel", capitulo: 4, versos: [4] }], "a palavra antes do número não engole o livro");
  assert.equal(ger.sentidoQueCitaAPassagem(MEFIBOSETE, "2 Samuel 9:1-13", livroTeste).numero, 2);
  assert.equal(ger.sentidoQueCitaAPassagem(MEFIBOSETE, "2 Samuel 21:1-14", livroTeste).numero, 1);
  assert.equal(ger.sentidoQueCitaAPassagem(MEFIBOSETE, "Gênesis 1:1-5", livroTeste), null, "nenhum sentido cita: o verbete sai");
  assert.equal(ger.sentidoQueCitaAPassagem(ABIGAIL, "1 Samuel 25:14-35", livroTeste).numero, 1);
});

teste("6.12.73: marcas \"##\" e \"•\" (texto e link do wol), marcas de figura, chave do trecho, soma dos vídeos e relatos repetidos", () => {
  const saiba = "## Perdoar não significa...\n• Fechar os olhos para o erro do outro ou fingir que nada aconteceu.\n• Esquecer.";
  const limpo = ger.semMarcasDoTexto(saiba);
  assert.doesNotMatch(limpo, /##|•/);
  assert.match(limpo, /^Perdoar não significa\.\.\.\nFechar os olhos/);
  const link = decodeURIComponent(ger.linkDeConsultaWol(saiba));
  assert.doesNotMatch(link, /##|•/);
  assert.ok(link.includes('"Fechar os olhos para o erro do outro"'), link);
  assert.equal(ger.chaveDoTrecho(saiba), ger.chaveDoTrecho(limpo));
  assert.ok(ger.chaveDoTrecho(saiba).startsWith("trecho:"));
  const longo = "palavra ".repeat(30);
  // Marcas no meio da linha (como vem do livro guardado): a busca fica no item, sem juntar o título.
  const naLinha = decodeURIComponent(ger.linkDeConsultaWol("## Perdoar não significa... • Fechar os olhos aos erros de outros. Na verdade, a Bíblia condena"));
  assert.ok(naLinha.includes('q="Fechar os olhos aos erros de outros"'), naLinha);
  const credito = ger.semMarcasDeFigura("Teve um Projeto? A ventilação do cupinzeiro ◼ Os cupinzeiros são maravilhas.\nÉ evidência de um projeto? [Créditos das fotos na página 25] No alto: Stockbyte/Getty Images");
  assert.equal(credito, "Teve um Projeto? A ventilação do cupinzeiro Os cupinzeiros são maravilhas.\nÉ evidência de um projeto?");
  assert.deepEqual(ger.normalizarEvitar({ leituras: [ger.chaveDoTrecho(longo)] }).leituras, [ger.chaveDoTrecho(longo)], "a chave sobrevive à memória (sem espaço no fim)");
  const figura = ger.semMarcasDeFigura("Os ribossomos (5) fabricam proteínas. O DNA (6), a molécula da vida (7).\n(8)\nVeja Salmo 139:14 (Salmo 139:14) e (12 anos).");
  assert.doesNotMatch(figura, /\(\d{1,2}\)/);
  assert.match(figura, /Os ribossomos fabricam proteínas\. O DNA, a molécula da vida\./);
  assert.match(figura, /\(Salmo 139:14\) e \(12 anos\)/, "referências e outros parênteses ficam");
  assert.equal(ger.duracaoEmSegundos("9:40"), 580);
  assert.equal(ger.duracaoEmSegundos("1:02:03"), 3723);
  assert.equal(ger.duracaoEmSegundos("9 min 40 s"), 580);
  assert.ok(Number.isNaN(ger.duracaoEmSegundos("")));
  const v = (d, n) => ({ titulo: n, duracao: d, link: n });
  assert.equal(ger.videosQueCabem([v("9:40", "a"), v("2:15", "b")], 10).length, 2, "11:55 cabe em 10 + 2");
  assert.deepEqual(ger.videosQueCabem([v("9:40", "a"), v("5:05", "b")], 10).map((x) => x.titulo), ["a"], "14:45 passa: só o primeiro");
  assert.equal(ger.videosQueCabem([v("9:40", "a"), v("", "b")], 10).length, 2, "duração desconhecida: fica como veio");
  const usados = ger.usadosDaParte({ textos: [{ referencia: "Mateus 18:21-30" }] });
  assert.deepEqual(ger.repeticoesDaParte(usados, {}, { relatos: ["Mateus 18:23-35"] }), ["o texto Mateus 18:21-30 foi usado nas últimas semanas"]);
  assert.deepEqual(ger.repeticoesDaParte(usados, {}, { relatos: ["Lucas 15:11-32"] }), []);
  assert.deepEqual(ger.normalizarEvitar({ leituras: ["trecho:x"], relatos: ["Mateus 18:21-35"] }).relatos, ["Mateus 18:21-35"]);
});

teste("6.12.73: prompts do Personagem (ângulo), do Jogo (8 a 12, sem respostas óbvias), do Ministério (como proceder) e da Abertura (EVITAR)", () => {
  const s = montados.sistemaFamiliaQuadro;
  assert.match(s.personagem, /ILUSTRE CLARAMENTE O ÂNGULO/);
  assert.match(s.personagem, /pouco conhecido SÓ quando a ligação com o ângulo for clara/);
  assert.match(s.personagem, /EPISÓDIO INTEIRO, do começo ao desfecho/);
  assert.match(s.jogo, /QUANTIDADE: mande o número de "rodadas" pedido na linha QUANTIDADE/);
  assert.match(s.jogo, /SEM RESPOSTAS ÓBVIAS/);
  assert.match(s.jogo, /de 6 a 8 identificadores \[B#\]/);
  assert.match(s.ministerio, /SÓ sobre COMO PROCEDER/);
  assert.match(s.ministerio, /Nunca perguntas sobre sentimentos/);
  assert.match(s.abertura, /Fuja das leituras e dos relatos bíblicos já usados/);
  assert.match(s.video, /até 15 minutos/);
  // As partes editáveis e os formatos não dizem "culto" (o sistema montado traz o VOCABULÁRIO, que cita a palavra para proibi-la).
  for (const id of ["adoracao_q_personagem", "adoracao_q_jogo", "adoracao_q_ministerio", "adoracao_q_abertura", "adoracao_q_video", "adoracao_q_criador", "adoracao_q_saiba"]) assert.doesNotMatch(prompts.PARTES.find((x) => x.id === id).padrao, /\bcultos?\b/i, id);
  for (const t of prompts.travadosDe({}).filter((x) => /^formato_familia_quadro_/.test(x.id))) assert.doesNotMatch(String(t.texto || t.padrao || ""), /\bcultos?\b/i, t.id);
  assert.match(QUADROS_FAMILIA.find((q) => q.id === "personagem").saida, /ilustre o ângulo/);
});

teste("6.12.73/6.12.76: jogo pede de novo quando faltam rodadas (mínimo do tipo) ou acontecimentos (6)", async () => {
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Verdadeiro ou falso"] }), montados);
  assert.ok(!pedido.erro);
  assert.match(pedido.mensagem, /QUANTIDADE: mande 14 rodadas \(no mínimo 10; ficam até 12\)\./);
  const rodada = (i) => ({ pergunta: `Afirmação ${i}`, resposta: i % 2 ? "Verdadeiro. Está no relato." : "falso, foi outro", referencia: "Gênesis 1:1" });
  const curta = await pedido.prep.montar({ descricao: "d", nome: "V ou F", comoJogar: "Regras.", rodadas: [1, 2, 3].map(rodada), eventos: [] });
  assert.match(curta.falta, /^vieram 3 rodadas válidas; mande 14 rodadas \(no mínimo 10\), em nível de adulto batizado/);
  const cheia = await pedido.prep.montar({ descricao: "d", nome: "V ou F", comoJogar: "Regras.", rodadas: Array.from({ length: 13 }, (_, i) => rodada(i + 1)), eventos: [] });
  assert.equal(cheia.falta, "");
  assert.equal(cheia.contagens.rodadas, 12, "ficam até 12");
  assert.equal(cheia.jogo.rodadas[1].resposta, "Falso. Foi outro", "resposta normalizada");
  assert.equal(cheia.jogo.idTipo, "verdadeiro_falso");
  assert.equal(cheia.trocarTipo, "", "Verdadeiro ou falso não troca de tipo");
  const soVerdadeiras = await pedido.prep.montar({ descricao: "d", nome: "V ou F", comoJogar: "R.", rodadas: Array.from({ length: 10 }, (_, i) => ({ pergunta: `A ${i}`, resposta: "Verdadeiro." })), eventos: [] });
  assert.match(soVerdadeiras.falta, /^vieram 10 verdadeiras e 0 falsas; mande pelo menos 3 verdadeiras e 3 falsas$/);
  const semVF = await pedido.prep.montar({ descricao: "d", nome: "V ou F", comoJogar: "R.", rodadas: [{ pergunta: "A", resposta: "Talvez" }, { pergunta: "B", resposta: "Verdadeiramente" }], eventos: [] });
  assert.equal(semVF.contagens.rodadas, 0, "resposta sem Verdadeiro/Falso sai");
  if (!comFontes) return console.log("      (sem FONTES_DIR: Ordem e data pulada)");
  const ordem = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Ordem e data dos acontecimentos"] }), montados);
  assert.match(ordem.mensagem, /escolha de 6 a 8 em "eventos"/);
  const parte = await ordem.prep.montar({ descricao: "d", nome: "Linha", comoJogar: "Ordem.", rodadas: [], eventos: ["B1", "B5", "B9"] });
  assert.match(parte.falta, /^vieram 3 acontecimentos válidos/);
  assert.ok(parte.jogo.ordem.length >= 6, "completa até 6 com o Apêndice B");
});

teste("6.12.73: Abertura guarda leitura e relato; o trecho lido sai da lista na outra noite; EVITAR dos relatos (com FONTES_DIR)", async () => {
  const evitar = { relatos: ["Mateus 18:21-35"] };
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "abertura", assunto: "perdoar os irmãos", angulo: "perdoar de coração", evitar }), montados);
  assert.ok(!pedido.erro);
  assert.match(pedido.mensagem, /EVITAR \(relatos bíblicos usados nas últimas semanas — escolha outros\): Mateus 18:21-35/);
  if (!comFontes) return console.log("      (sem FONTES_DIR: leitura pulada)");
  assert.match(pedido.mensagem, /\[L1\] /);
  const parte = await pedido.prep.montar({ descricao: "d", escolhas: ["L1"], perguntasLeitura: ["?"], relato: { referencia: "Lucas 17:3, 4", perguntas: ["?"] } });
  assert.ok(parte.memoria.leituras[0].startsWith("trecho:"), JSON.stringify(parte.memoria));
  assert.deepEqual(parte.memoria.relatos, ["Lucas 17:3, 4"]);
  const primeiro = pedido.mensagem.match(/\[L1\] [^:]+: ([^\n]{40})/)[1];
  const outra = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "abertura", assunto: "perdoar os irmãos", angulo: "perdoar de coração", evitar: { leituras: parte.memoria.leituras } }), montados);
  assert.ok(!outra.mensagem.includes(primeiro), `o trecho lido na noite anterior não volta: ${primeiro}`);
  assert.equal(outra.prep.contagens.leiturasEvitadas, 1);
});

teste("6.12.73: Personagem com a passagem inteira e o sentido certo do Perspicaz; sem sentido, o trecho do livro (com FONTES_DIR)", async () => {
  if (!comFontes) return console.log("      (sem FONTES_DIR: pulado)");
  assert.equal((await fontesMod.buscarVersiculos(["1 Samuel 25:14-35"], 1))[0].referencia, "1 Samuel 25:14-23", "padrão de antes: 10 versículos");
  assert.equal((await fontesMod.buscarVersiculos(["1 Samuel 25:14-35"], 1, { maxVersiculos: 30, maxChars: 4500 }))[0].referencia, "1 Samuel 25:14-35");
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "personagem", assunto: "perdoar os irmãos", angulo: "bondade leal", evitar: {} }), montados);
  const mefi = await pedido.prep.montar({ nome: "Mefibosete", referencia: "2 Samuel 9:1-13", descricao: "d", escolha: null, verbete: "Mefibosete" });
  assert.equal(mefi.textos[0].referencia, "2 Samuel 9:1-13", "o episódio inteiro (13 versículos)");
  assert.match(mefi.leitura.fonte, /\(sentido 2\)( · pág\. \d+)?$/);
  assert.match(mefi.leitura.texto, /^Filho de Jonatã/);
  assert.equal(mefi.contagens.sentido, 2);
  const abigail = await pedido.prep.montar({ nome: "Abigail", referencia: "1 Samuel 25:14-35", descricao: "d", escolha: null, verbete: "Abigail" });
  assert.equal(abigail.textos[0].referencia, "1 Samuel 25:14-35");
  assert.match(abigail.leitura.fonte, /\(sentido 1\)( · pág\. \d+)?$/);
  const semSentido = await pedido.prep.montar({ nome: "Mefibosete", referencia: "Gênesis 1:1-5", descricao: "d", escolha: null, verbete: "Mefibosete" });
  assert.notEqual(semSentido.leitura && semSentido.leitura.rotulo, "Verbete do Perspicaz", "sem sentido que cite a passagem, o verbete sai");
  assert.equal(semSentido.contagens.sentido, -1);
});

teste("6.12.73: Criador sem marcas de figura e Saiba responder sem \"##\" e \"•\" (com FONTES_DIR)", async () => {
  if (!comFontes) return console.log("      (sem FONTES_DIR: pulado)");
  for (let semente = 1; semente <= 6; semente++) {
    const c = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "criador", semente, evitar: {} }), montados);
    if (!c.prep.contagens.livros) continue;
    const parte = await c.prep.montar({ descricao: "d", escolha: "L1", perguntas: ["?"] });
    assert.doesNotMatch(parte.leitura.texto, /(^|\s)\(\d{1,2}\)(?=[\s.,;:!?)]|$)/m, "semente " + semente);
  }
  const s = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "saiba_responder", assunto: "perdoar os irmãos", angulo: "o que é perdoar", evitar: {} }), montados);
  if (!s.prep.contagens.livros) return console.log("      (sem trechos para o Saiba responder)");
  for (let i = 1; i <= s.prep.contagens.livros; i++) {
    const parte = await s.prep.montar({ pergunta: "Perdoar é esquecer?", descricao: "d", escolha: `L${i}`, verbete: null, textos: ["Colossenses 3:13"] });
    // 6.13.03: "## " no começo da linha é o subtítulo da seção (vindo do wol ou da lição) e sai em negrito; marcas soltas dos arquivos não
    assert.doesNotMatch(parte.leitura.texto, /(^|\n)\s*•|(^|\n)##(?! \S)|#{3,}|\S ##/);
    assert.doesNotMatch(decodeURIComponent(parte.publicacoes[0].url), /##|•/);
  }
});

teste("6.12.73: app guarda leituras e relatos na memória", () => {
  const cache = [];
  const m = evitarDoApp(cache);
  m.familiaEvitarRegistrar([{ leituras: ["trecho:abc"], relatos: ["Mateus 18:21-35"] }]);
  assert.deepEqual(m.familiaEvitarLer().leituras, ["trecho:abc"]);
  assert.deepEqual(m.familiaEvitarLer().relatos, ["Mateus 18:21-35"]);
});

// ---------- Fase 4 (6.12.74): duas levas, programação versão 2 e 🔄 Trocar este quadro ----------

teste("6.12.74: montagem com versao 2, ângulos (objeto ou lista) e usados só dos quadros presentes", () => {
  const montar = montagemDoApp();
  const parte = (id) => ({ nome: "Parte " + id, minutos: 5, descricao: "d" });
  const quadros = ["abertura", "personagem", "jesus"];
  const usados = { abertura: { versiculos: ["mateus 18:21"] }, jesus: { personagens: ["Pedro"] }, criador: { referencias: ["Jó 38"] } };
  const comObjeto = montar({ angulos: { abertura: " perdoar de coração ", jesus: "x".repeat(400), criador: "fora" } }, { abertura: parte("abertura"), jesus: parte("jesus") }, quadros, QUADROS_FAMILIA, usados);
  assert.equal(comObjeto.versao, 2);
  assert.deepEqual(Object.keys(comObjeto.angulos).sort(), ["abertura", "jesus"]);
  assert.equal(comObjeto.angulos.abertura, "perdoar de coração");
  assert.equal(comObjeto.angulos.jesus.length, 300);
  assert.deepEqual(Object.keys(comObjeto.usados).sort(), ["abertura", "jesus"], "o Criador não está na programação");
  const comLista = montar({ angulos: [{ quadro: "abertura", angulo: "a" }, null, { quadro: "personagem", angulo: "b" }] }, { abertura: parte("abertura"), personagem: parte("personagem") }, quadros, QUADROS_FAMILIA);
  assert.deepEqual(comLista.angulos, { abertura: "a", personagem: "b" });
  assert.deepEqual(comLista.usados, {});
});

teste("6.12.74: geração em duas levas (1ª Abertura, Vídeo, Princípio, Personagem; 2ª o resto, com jaUsados da 1ª)", () => {
  const ini = appJs.indexOf("const FAMILIA_LEVAS");
  const fim = appJs.indexOf("const familiaProgressoEl");
  assert.ok(ini > 0 && fim > ini, "FAMILIA_LEVAS e familiaLevasDe no app.js");
  const levasDe = new Function(appJs.slice(ini, fim) + "\nreturn familiaLevasDe;")();
  assert.deepEqual(levasDe(IDS_QUADROS.filter((id) => QUADROS_FAMILIA.find((q) => q.id === id).minutos)), [
    ["abertura", "video", "principio", "personagem"],
    ["jesus", "criador", "saiba_responder", "ame_ministerio", "jogo", "canticos"],
  ]);
  assert.deepEqual(levasDe(["abertura", "jesus", "jogo"]), [["abertura"], ["jesus", "jogo"]]);
  assert.deepEqual(levasDe(["jesus", "novo_quadro"]), [["jesus", "novo_quadro"]], "leva vazia sai; quadro fora das levas vai para a última");
  assert.match(appJs, /for \(const leva of familiaLevasDe\(ger\.ids\)\) \{\n\s+await familiaGerarQuadros\(ger, leva\);/);
  // Cada quadro recebe o que os outros já fizeram (familiaJaUsados com os já prontos), então a 2ª leva recebe o da 1ª.
  assert.match(appJs, /jaUsados: familiaJaUsados\(ger, ger\.ids\.filter\(x => x !== id\)\)/);
});

teste("6.12.74: jaUsados da programação salva (troca) junta os usados de todos os quadros e os cânticos inicial e final", () => {
  const ini = appJs.indexOf("// <evitar-familia>");
  const fim = appJs.indexOf("// </evitar-familia>");
  const f = new Function("historicoCache", "historicoLer", "historicoGravar", appJs.slice(ini, fim) + "\nreturn familiaJaUsadosDoPrograma;")([], () => [], () => true);
  const op = {
    versao: 2,
    usados: { abertura: { versiculos: ["mateus 18:21"], referencias: ["Mateus 18:21, 22"] }, personagem: { personagens: ["José"] }, jesus: null },
    partes: [{ quadro: "cantico_inicial", canticos: [{ numero: 12 }] }, { quadro: "abertura", canticos: [{ numero: 99 }] }, { quadro: "cantico_final", canticos: [{ numero: 3 }] }],
  };
  const j = f(op);
  assert.deepEqual(j.versiculos, ["mateus 18:21"]);
  assert.deepEqual(j.referencias, ["Mateus 18:21, 22"]);
  assert.deepEqual(j.personagens, ["José"]);
  assert.deepEqual(j.canticos.map(String), ["12", "3"], "só os cânticos inicial e final");
  assert.deepEqual(f({}).personagens, [], "programação sem usados não quebra");
});

teste("6.12.74: pedido de troca leva TROCA DESTE QUADRO e a instrução (sem \"culto\"); sem troca, nenhuma das duas", async () => {
  const troca = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "personagem", assunto: "perdão", angulo: "perdoar", evitar: {}, troca: true, instrucao: "use alguém do culto antigo" }), montados);
  assert.ok(!troca.erro, JSON.stringify(troca.erro));
  assert.match(troca.mensagem, /TROCA DESTE QUADRO: /);
  assert.match(troca.mensagem, /INSTRUÇÃO DE QUEM DIRIGE PARA ESTE QUADRO \(siga se não contrariar as regras\): use alguém/);
  assert.doesNotMatch(troca.mensagem, /culto/i);
  const normal = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "personagem", assunto: "perdão", angulo: "perdoar", evitar: {}, instrucao: "" }), montados);
  assert.doesNotMatch(normal.mensagem, /TROCA DESTE QUADRO|INSTRUÇÃO DE QUEM DIRIGE/);
});

teste("6.12.74: prompts reforçados (Personagem: lição dita ou mostrada na passagem; Jogo: nada que uma criança responderia) e MONTAGEM", async () => {
  const pers = prompts.PARTES.find((x) => x.id === "adoracao_q_personagem");
  const jogo = prompts.PARTES.find((x) => x.id === "adoracao_q_jogo");
  assert.match(pers.padrao, /DITA OU MOSTRADA NA PRÓPRIA PASSAGEM/);
  assert.match(jogo.padrao, /NENHUMA PERGUNTA QUE UMA CRIANÇA RESPONDERIA/);
  assert.match(montados.sistemaFamiliaQuadro.personagem, /DITA OU MOSTRADA/);
  assert.match(montados.sistemaFamiliaQuadro.jogo, /criança responderia/i);
  for (const t of [pers.padrao, jogo.padrao]) assert.doesNotMatch(t, /culto/i);
  const promptsJs = await readFile(new URL("api/_prompts.mjs", raiz), "utf8");
  assert.match(promptsJs, /6\.12\.74: duas levas/);
  assert.match(promptsJs, /TROCA DESTE QUADRO/);
});

teste("6.12.74: app com 🔄 Trocar este quadro (troca: true, evitar e jaUsados), bloqueio na sessão; sessão com a ordem só para quem dirige", () => {
  assert.ok(appJs.includes("🔄 Trocar este quadro"));
  const trocar = appJs.slice(appJs.indexOf("async function familiaTrocarQuadro"), appJs.indexOf("async function familiaTrocarQuadro") + 6000);
  assert.match(trocar, /fase: 'quadro'/);
  assert.match(trocar, /troca: true/);
  assert.match(trocar, /evitar: familiaEvitarLer\(\)/);
  assert.match(trocar, /jaUsados: familiaJaUsadosDoPrograma\(op\)/);
  assert.match(trocar, /familiaSessaoDoCartao\(/);
  assert.match(trocar, /historicoGravar\(/);
  assert.doesNotMatch(trocar, /culto/i);
  assert.match(appJs, /const FAMILIA_QUADROS_TROCAVEIS = /);
  assert.match(sessaoJs, /const SUFIXO_ORDEM_CERTA = /);
  assert.match(sessaoJs, /extras\.ordens = ordens/);
  assert.match(sessaoJs, /if \(op\.versao === 2\) programa\.versao = 2;/);
});

// ---------- Patch 6.12.75: passagens entre capítulos, texto vazio refaz, passagens do Personagem e de Jesus na memória, ajuste removido ----------

teste("6.12.75: chaves de versículos com outro capítulo (\"; 8:1\", \"54-8:1\") e relatos repetidos entre capítulos", () => {
  const atos = ger.chavesDosVersiculos("Atos 7:54-60; 8:1");
  assert.ok(atos.includes("atos 7:54") && atos.includes("atos 7:60") && atos.includes("atos 8:1"), atos.join());
  assert.ok(!atos.includes("atos 7:61"));
  assert.deepEqual(ger.chavesDosVersiculos("Mateus 24:14; 28:19, 20"), ["mateus 24:14", "mateus 28:19", "mateus 28:20"], "antes saía \"mateus 24:28\"");
  const bruto = ger.chavesDosVersiculos("Atos 7:54-8:1");
  assert.ok(bruto.includes("atos 7:54") && bruto.includes("atos 8:1"), bruto.join());
  assert.deepEqual(ger.chavesDosVersiculos("Lucas 15:11-13"), ["lucas 15:11", "lucas 15:12", "lucas 15:13"], "faixa comum como antes");
  const usados = ger.usadosDaParte({ textos: [{ referencia: "Atos 7:54-60; 8:1" }] });
  assert.deepEqual(ger.repeticoesDaParte(usados, {}, { relatos: ["Atos 8:1-3"] }), ["o texto Atos 7:54-60; 8:1 foi usado nas últimas semanas"]);
  assert.deepEqual(ger.repeticoesDaParte(usados, {}, { relatos: ["Atos 9:1-9"] }), []);
});

teste("6.12.75: servidor guarda as passagens do Personagem e de Jesus em \"relatos\", com EVITAR dos relatos, e refaz quando o texto bíblico vem vazio", () => {
  assert.match(servidorJs, /const QUADROS_COM_RELATO = Object\.freeze\(\["abertura", "personagem", "jesus"\]\);/);
  assert.match(servidorJs, /const evitarDaParte = QUADROS_COM_RELATO\.includes\(id\) \? ctx\.evitar : \{ \.\.\.ctx\.evitar, relatos: \[\] \};/);
  assert.equal((servidorJs.match(/\.\.\.memoriaDaPassagem\(textos\)/g) || []).length, 2, "Personagem e Jesus");
  assert.equal((servidorJs.match(/listaEvitar\("relatos bíblicos", ctx\.evitar\.relatos\)/g) || []).length >= 3, true, "Abertura, Personagem e Jesus");
  assert.match(servidorJs, /const semTexto = fontesConfiguradas\(\) && id !== "principio" \? parte\.textos\.filter\(\(t\) => t && t\.referencia && !t\.texto\)/); // 6.12.79: menos no Princípio
  assert.match(servidorJs, /não foi achado na Bíblia/);
  assert.match(montados.sistemaFamiliaQuadro.personagem, /Fuja dos relatos bíblicos que vierem em EVITAR/);
  assert.match(montados.sistemaFamiliaQuadro.jesus, /Fuja dos relatos bíblicos que vierem em EVITAR/);
});

teste("6.12.75: ajuste da programação montada removido (servidor, prompts, app e estilos)", async () => {
  assert.ok(!prompts.PARTES.some((x) => x.id === "adoracao_familia_ajuste"), "parte de ajuste saiu");
  assert.ok(!prompts.CATEGORIAS.some((c) => (c.partes || []).includes("adoracao_familia_ajuste")), "fora das categorias");
  assert.ok(!("sistemaAdoracaoFamiliaAjuste" in montados), "sistema de ajuste saiu");
  assert.ok(!servidorJs.includes("SaidaAjusteFamilia"));
  for (const nome of ["familiaMesclaMontar", "fam-mescla", "fam-ajustar-ia", "cfg.ajustar", "cfg.salvar"]) assert.ok(!appJs.includes(nome), nome);
  const css = await readFile(new URL("app.css", raiz), "utf8");
  assert.ok(!css.includes(".fam-mescla"), "estilos da mescla saíram");
  // As programações salvas antigas (com duas opções) continuam abrindo: cada opção vira um cartão.
  assert.match(appJs, /function familiaRenderOpcoes\(opcoes, numeros, itemId\)/);
  const promptsJs = await readFile(new URL("api/_prompts.mjs", raiz), "utf8");
  assert.match(promptsJs, /6\.12\.75: passagens entre capítulos/);
});

teste("6.12.75: passagens entre capítulos na Bíblia do servidor (Princípios e Personagem) (com FONTES_DIR)", async () => {
  if (!comFontes) return console.log("      (sem FONTES_DIR: pulado)");
  const ler = async (r, op) => (await fontesMod.buscarVersiculos([r], 1, op).catch(() => []))[0];
  const atos = await ler("Atos 7:54-8:1", { numerado: true });
  assert.ok(atos && atos.texto, "Atos 7:54-8:1");
  assert.equal(atos.referencia, "Atos 7:54-60; 8:1");
  assert.match(atos.textoNumerado, /\[8:1\] /);
  const genesis = await ler("Gênesis 44:18-45:15", { maxVersiculos: 30, maxChars: 4500 });
  assert.equal(genesis.referencia, "Gênesis 44:18-34; 45:1-13", "até 30 versículos (17 + 13)");
  assert.equal((await ler("Gên 44:18-45:15")).referencia, "Gênesis 44:18-27", "padrão: 10 versículos");
  assert.equal(await ler("Atos 7:54-12:1"), undefined, "mais de 4 capítulos: não lê");
  // As referências do Princípios Bíblicos que atravessam capítulos.
  const dados = await fontesMod.lerPrincipios();
  const cruzam = [...new Set(ger.principiosCandidatos(dados.entradas).flatMap((e) => ger.referenciasDoPrincipio(e, 50)).filter((r) => /\d+:\d+\s*[-–—]\s*\d+:\d+/.test(r)))];
  let lidas = 0;
  for (const r of cruzam) if ((await ler(r))?.texto) lidas++;
  console.log(`      referências do Princípios que atravessam capítulos: ${lidas} de ${cruzam.length} lidas (${cruzam.join("; ")})`);
  assert.ok(cruzam.length >= 1 && lidas === cruzam.length, `${lidas} de ${cruzam.length}`);
  // Personagem com a passagem entre capítulos: texto transcrito e a passagem na memória "relatos".
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "personagem", assunto: "perdoar os irmãos", angulo: "perdoar quem nos fere", evitar: {} }), montados);
  const estevao = await pedido.prep.montar({ nome: "Estêvão", referencia: "Atos 7:54-8:1", descricao: "d", escolha: null, verbete: null });
  assert.ok(estevao.textos[0].texto, "texto da passagem");
  assert.deepEqual(estevao.memoria.relatos, ["Atos 7:54-60; 8:1"]);
  assert.deepEqual(estevao.memoria.personagens, ["Estêvão"]);
  const jp = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jesus", assunto: "perdoar os irmãos", angulo: "perdoar sempre", evitar: {} }), montados);
  const jesus = await jp.prep.montar({ episodio: "Jesus ensina a perdoar 77 vezes", referencia: "Mateus 18:21-35", qualidade: "misericórdia", escolha: null, descricao: "d", perguntas: ["?"] });
  assert.deepEqual(jesus.memoria.relatos, [jesus.textos[0].referencia]);
  assert.ok(jesus.memoria.jesus && jesus.memoria.jesus.length === 1);
  const sem = await pedido.prep.montar({ nome: "Fulano", referencia: "Livro Inventado 3:1-5", descricao: "d", escolha: null, verbete: null });
  assert.ok(!sem.memoria.relatos, "passagem não achada não entra na memória");
});

// ---------- Patch 6.12.76: jogos conferidos pelo servidor (tipo, quantidade, referência secreta, Complete e Quem disse montados pelo servidor) ----------

teste("6.12.76: idTipo dos 6 jogos, quantidade de rodadas por tipo e categoria jogo_versiculos", () => {
  assert.deepEqual(Object.keys(ger.ID_DOS_JOGOS).sort(), JOGOS_FAMILIA.slice().sort());
  for (const nome of JOGOS_FAMILIA) assert.equal(ger.idDoJogo(nome), ger.ID_DOS_JOGOS[nome], nome);
  assert.equal(ger.idDoJogo("Mímica"), "");
  assert.deepEqual(Object.keys(ger.RODADAS_DO_JOGO).sort(), Object.values(ger.ID_DOS_JOGOS).sort());
  for (const [id, l] of Object.entries(ger.RODADAS_DO_JOGO)) assert.ok(l.min <= l.pedir && l.min <= l.max && l.max <= 12, id);
  assert.equal(ger.RODADAS_DO_JOGO.quem_sou_eu.min, 6, "Quem sou eu? (3 dicas por rodada): 6 cabem nos 10 minutos");
  assert.equal(ger.MIN_RODADAS_PARA_MANTER_O_TIPO, 6);
  assert.ok(ger.CATEGORIAS_EVITAR.includes("jogo_versiculos"));
  assert.deepEqual(ger.normalizarEvitar({ jogo_versiculos: ["Provérbios 15:1", "Provérbios 15:1"] }).jogo_versiculos, ["Provérbios 15:1"]);
  assert.match(appJs, /FAMILIA_EVITAR_CATEGORIAS = \[[^\]]*'jogo_versiculos'/);
});

teste("6.12.76: conferências dos jogos (fala entre aspas, lacuna, sigla, Verdadeiro/Falso, Quem sou eu?, Dica 2 do livro)", () => {
  assert.equal(ger.livroDaReferencia("1 Samuel 17:45"), "1 Samuel");
  assert.equal(ger.livroDaReferencia("Gênesis"), "");
  assert.equal(ger.parteDasEscrituras("1 João"), "Escrituras Gregas Cristãs");
  assert.equal(ger.parteDasEscrituras("Rute"), "Escrituras Hebraicas");
  // Fala entre aspas: aberta e sem fechar (continua no versículo seguinte), só com o fechamento, sem aspas, curta demais.
  const rute = "Mas Rute disse: “Não insista comigo para abandoná-la, para deixar de acompanhá-la; pois, aonde a senhora for, eu irei.";
  assert.equal(ger.falaEntreAspas(rute), "Não insista comigo para abandoná-la, para deixar de acompanhá-la; pois, aonde a senhora for, eu irei.");
  assert.equal(ger.falaEntreAspas("Mas Agripa disse a Paulo: “Em pouco tempo você me persuadiria a me tornar cristão.” E ele saiu."), "Em pouco tempo você me persuadiria a me tornar cristão.");
  assert.equal(ger.falaEntreAspas("o nosso Deus pode nos livrar da fornalha ardente.” Então o rei se irou."), "o nosso Deus pode nos livrar da fornalha ardente.");
  assert.equal(ger.falaEntreAspas("Embora vocês quisessem me fazer o mal, Deus quis que as coisas acabassem bem."), "", "sem aspas: a rodada sai");
  assert.equal(ger.falaEntreAspas("Então José disse: “Aproximem-se, por favor.” E eles se aproximaram."), "", "menos de 4 palavras");
  // Lacuna do Complete o versículo.
  const prov = "Uma resposta branda acalma o furor, Mas uma palavra dura atiça a ira.";
  assert.deepEqual(ger.lacunaNoVersiculo(prov, "branda", "Provérbios"), { texto: "Uma resposta ______ acalma o furor, Mas uma palavra dura atiça a ira.", resposta: "branda" });
  assert.deepEqual(ger.lacunaNoVersiculo(prov, "Furor.", "Provérbios"), { texto: "Uma resposta branda acalma o ______, Mas uma palavra dura atiça a ira.", resposta: "furor" });
  const miq = "E o que Jeová pede de você? Apenas que ande modestamente com o seu Deus! Os 12 dias.";
  for (const p of ["Jeová", "Deus", "ira", "12", "seu Deus", "palavrão", "uma"]) assert.equal(ger.lacunaNoVersiculo(`${miq} ${prov}`, p, "Miqueias"), null, p);
  assert.equal(ger.lacunaNoVersiculo("Os provérbios de Salomão, filho de Davi.", "provérbios", "Provérbios"), null, "o nome do livro (a Dica 2)");
  assert.equal(ger.lacunaNoVersiculo("perdoar uns aos outros liberalmente; Jeová os perdoou liberalmente.", "liberalmente", "Colossenses"), null, "palavra repetida no versículo");
  // Sigla das Abreviações bíblicas.
  assert.equal(ger.confereAbreviacao("Os 12 A de C", "Os 12 Apóstolos de Cristo"), true);
  assert.equal(ger.confereAbreviacao("Os 12 A de C", "Os Doze Apóstolos de Cristo"), false);
  assert.equal(ger.confereAbreviacao("A.T.", "Antigo Testamento"), true);
  assert.equal(ger.confereAbreviacao("N de J", "Nome de Jeová (Isaías 42:8)."), true, "parênteses no fim não contam");
  assert.equal(ger.confereAbreviacao("A de C", "Apóstolos do Cristo"), false);
  assert.equal(ger.confereAbreviacao("de", "de"), false, "precisa de ao menos uma inicial");
  // Verdadeiro ou falso.
  assert.deepEqual(ger.respostaVF("verdadeiro, ele voltou"), { valor: "V", texto: "Verdadeiro. Ele voltou" });
  assert.deepEqual(ger.respostaVF("Falsa — foram sete dias"), { valor: "F", texto: "Falso. Foram sete dias" });
  assert.equal(ger.respostaVF("Talvez"), null);
  assert.equal(ger.respostaVF("Verdadeiramente"), null);
  // Quem sou eu? e Quem disse isso?
  assert.equal(ger.quemSouEuValida({ pergunta: "Dica 1: a. Dica 2: b. Dica 3: c.", resposta: "Rei Josias" }), true);
  assert.equal(ger.quemSouEuValida({ pergunta: "Dica 1: a. Dica 2: Josias reinou. Dica 3: c.", resposta: "Rei Josias" }), false, "nome na dica");
  assert.equal(ger.quemSouEuValida({ pergunta: "Dica 1: a. Dica 2: b.", resposta: "Josias" }), false, "2 dicas");
  assert.deepEqual(ger.nomesDaResposta("Abigail, esposa de Nabal"), ["abigail", "nabal"]);
  assert.deepEqual(ger.nomesDaResposta("Os irmãos de Jó"), ["jo"], "nome de 2 letras conta; \"Os\" não");
  assert.equal(ger.falaSemONome("Eu sou José, seu irmão", "José, a seus irmãos"), false);
  assert.equal(ger.falaSemONome("Aproximem-se de mim", "José, a seus irmãos"), true);
  assert.equal(ger.dicaDoLivro("Jó", "Jó"), "Está nas Escrituras Hebraicas", "o livro tem o nome de quem disse");
  assert.equal(ger.dicaDoLivro("1 João", "João, aos irmãos"), "Está nas Escrituras Gregas Cristãs");
  assert.equal(ger.dicaDoLivro("Atos", "Agripa, a Paulo"), "Está em Atos");
});

teste("6.12.76: prompts (Jesus traz um episódio; Jogo com QUANTIDADE e o servidor transcrevendo) e MONTAGEM; troca do tipo no servidor", async () => {
  const s = montados.sistemaFamiliaQuadro;
  assert.match(s.jesus, /EPISÓDIO/);
  assert.match(s.jogo, /o SERVIDOR transcreve a fala/);
  assert.match(s.jogo, /o SERVIDOR transcreve o versículo e põe a lacuna/);
  assert.match(s.jogo, /nunca "Jeová", "Deus", um número ou o nome do livro/);
  assert.match(s.jogo, /NÍVEL DE ADULTO BATIZADO/);
  assert.match(s.jogo, /NENHUMA PERGUNTA QUE UMA CRIANÇA RESPONDERIA/);
  assert.doesNotMatch(prompts.PARTES.find((x) => x.id === "adoracao_q_jogo").padrao, /\bcultos?\b/i);
  const promptsJs = await readFile(new URL("api/_prompts.mjs", raiz), "utf8");
  assert.match(promptsJs, /6\.12\.76: /);
  assert.match(promptsJs, /memória "jogo_versiculos"/);
  assert.match(promptsJs, /a resposta e a referência de cada rodada ficam só no servidor \(respostas\.json\)/);
  assert.match(servidorJs, /jogoFora: textoLivre\(body\.jogoFora, 80\)/);
  assert.match(servidorJs, /não teve rodadas suficientes conferidas na Bíblia; foi trocado por/);
  // jogoFora: o tipo que não deu certo fica fora do sorteio.
  const fora = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Verdadeiro ou falso", "Quem sou eu? (personagens bíblicos)"], jogoFora: "Verdadeiro ou falso" }), montados);
  assert.equal(fora.prep.tipo, "Quem sou eu? (personagens bíblicos)");
  assert.match(fora.mensagem, /QUANTIDADE: mande 10 rodadas \(no mínimo 6; ficam até 8\)\./);
  // Sem a Bíblia no servidor, nada de Complete o versículo nem Quem disse isso?
  const complete = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Complete o versículo"] }), montados);
  if (comFontes) assert.equal(complete.prep.tipo, "Complete o versículo");
  else assert.ok(!["complete_versiculo", "quem_disse"].includes(ger.idDoJogo(complete.prep.tipo)), complete.prep.tipo);
});

teste("6.12.76: Quem sou eu? e Abreviações conferidos pelo servidor; Princípio guarda os versículos em relatos", async () => {
  const qse = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Quem sou eu? (personagens bíblicos)"] }), montados);
  const nomes = ["Josias", "Abigail", "Mefibosete", "Gideão", "Débora", "Barnabé"];
  const boas = nomes.map((n, i) => ({ pergunta: `Dica 1: fato ${i}. Dica 2: outro ${i}. Dica 3: mais ${i}.`, resposta: n, referencia: "Juízes 4:4" }));
  const ruins = [
    { pergunta: "Dica 1: Josias reinou. Dica 2: b. Dica 3: c.", resposta: "Rei Josias" },
    { pergunta: "Dica 1: a. Dica 2: b.", resposta: "Ester" },
    { pergunta: "Dica 1: x. Dica 2: y. Dica 3: z.", resposta: "Gideão" },
  ];
  const p1 = await qse.prep.montar({ descricao: "d", nome: "Quem sou eu?", comoJogar: "R.", rodadas: [...boas, ...ruins], eventos: [] });
  assert.equal(p1.contagens.rodadas, 6);
  assert.equal(p1.falta, "", "6 é o mínimo do Quem sou eu?");
  assert.equal(p1.contagens.tiradas, 3);
  assert.equal(p1.jogo.idTipo, "quem_sou_eu");
  assert.deepEqual(p1.memoria, { jogos: ["Quem sou eu? (personagens bíblicos)"] });
  const ab = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Abreviações bíblicas (ex.: Os 12 A de C)"] }), montados);
  const p2 = await ab.prep.montar({ descricao: "d", nome: "Siglas", comoJogar: "R.", rodadas: [{ pergunta: "Os 12 A de C", resposta: "Os 12 Apóstolos de Cristo", referencia: "Mateus 10:2" }, { pergunta: "O que significa? Os 12 A de C", resposta: "Os 12 Apóstolos de Cristo", referencia: "Mateus 10:2" }, { pergunta: "R de D", resposta: "Reino dos Céus", referencia: "Mateus 5:3" }], eventos: [] });
  assert.equal(p2.contagens.rodadas, 1, "sigla repetida e sigla que não confere saem");
  assert.equal(p2.jogo.rodadas[0].pergunta, "O que significa? Dica 1: Os 12 A de C Dica 2: Está em Mateus.");
  assert.match(p2.falta, /^vieram 1 rodadas válidas; mande 10 rodadas \(no mínimo 8\)/);
  assert.equal(p2.trocarTipo, "", "Abreviações não troca de tipo");
  if (!comFontes) return console.log("      (sem FONTES_DIR: Princípio pulado)");
  const pr = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "principio", assunto: "perdão", evitar: {} }), montados);
  const parte = await pr.prep.montar({ descricao: "d", escolha: "PR1" });
  assert.deepEqual(parte.memoria.relatos, parte.textos.filter((t) => t.texto).map((t) => t.referencia));
  assert.ok(parte.memoria.relatos.length >= 1);
  // Jesus: um episódio narrado (pelo menos 3 versículos); uma frase só faz o servidor refazer com "FALTOU".
  const jp = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jesus", assunto: "perdoar os irmãos", angulo: "perdoar sempre", evitar: {} }), montados);
  const curta = await jp.prep.montar({ episodio: "Perdoar sete vezes", referencia: "Lucas 17:3, 4", qualidade: "paciência", escolha: null, descricao: "d", perguntas: ["?"] });
  assert.match(curta.falta, /^a passagem Lucas 17:3, 4 tem só 2 versículos: escolha um EPISÓDIO narrado/);
  const longa = await jp.prep.montar({ episodio: "O escravo que não perdoou", referencia: "Mateus 18:21-35", qualidade: "misericórdia", escolha: null, descricao: "d", perguntas: ["?"] });
  assert.ok(!longa.falta, longa.falta);
});

teste("6.12.76: Complete o versículo e Quem disse isso? montados pelo servidor com o texto da Bíblia; troca do tipo com poucas rodadas (com FONTES_DIR)", async () => {
  if (!comFontes) return console.log("      (sem FONTES_DIR: pulado)");
  const boas = [["Provérbios 15:1", "branda"], ["Mateus 5:9", "pacificadores"], ["Colossenses 3:13", "queixa"], ["Provérbios 17:9", "transgressão"], ["Efésios 4:32", "compassivos"], ["Provérbios 19:11", "perspicácia"], ["Miqueias 6:8", "modestamente"], ["Salmo 86:5", "invocam"]];
  const ruins = [["Miqueias 6:8", "Jeová"], ["Mateus 6:14", "Pai"], ["Colossenses 3:13", "liberalmente"], ["Gênesis 50:20", "palavra"], ["Livro Inventado 3:1", "nada"]];
  const rodadas = [...ruins, ...boas, ["Provérbios 15:1", "furor"]].map(([referencia, resposta]) => ({ pergunta: "", resposta, referencia }));
  const cp = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Complete o versículo"], evitar: { jogo_versiculos: ["Lucas 23:34"] } }), montados);
  assert.match(cp.mensagem, /QUANTIDADE: mande 12 rodadas \(no mínimo 8; ficam até 10\)\./);
  assert.match(cp.mensagem, /EVITAR \(versículos dos jogos usados nas últimas semanas — escolha outros\): Lucas 23:34/);
  const c1 = await cp.prep.montar({ descricao: "d", nome: "Complete", comoJogar: "R.", rodadas, eventos: [] });
  assert.equal(c1.contagens.rodadas, 8, JSON.stringify(c1.jogo && c1.jogo.rodadas));
  assert.equal(c1.falta, "");
  assert.equal(c1.trocarTipo, "");
  assert.equal(c1.jogo.idTipo, "complete_versiculo");
  assert.deepEqual(c1.jogo.rodadas[0], { pergunta: "Complete a palavra que falta. Dica 1: “Uma resposta ______ acalma o furor, Mas uma palavra dura atiça a ira.” Dica 2: Está em Provérbios.", resposta: "branda", referencia: "Provérbios 15:1" });
  assert.match(c1.jogo.rodadas[1].pergunta, /Dica 1: “Felizes os ______, porque/, "6.12.77: a aspa sem par do começo do Sermão sai");
  assert.deepEqual(c1.memoria.jogo_versiculos, boas.map(([r]) => (r === "Salmo 86:5" ? "Salmos 86:5" : r)));
  for (const r of c1.jogo.rodadas) assert.match(r.pergunta, /^Complete a palavra que falta\. Dica 1: “.+” Dica 2: Está em .+\.$/);
  // Versículos das últimas semanas e os já usados nesta noite saem; com menos de 6, o servidor pede a troca do tipo.
  const cp2 = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Complete o versículo"], evitar: { jogo_versiculos: ["Provérbios 15:1", "Mateus 5:9"] }, jaUsados: { versiculos: ["efesios 4:32"] } }), montados);
  const c2 = await cp2.prep.montar({ descricao: "d", nome: "Complete", comoJogar: "R.", rodadas: boas.map(([referencia, resposta]) => ({ pergunta: "", resposta, referencia })), eventos: [] });
  assert.equal(c2.contagens.rodadas, 5);
  assert.match(c2.falta, /^vieram 5 rodadas válidas; mande 12 rodadas \(no mínimo 8\)/);
  assert.equal(c2.trocarTipo, "Complete o versículo");
  // Quem disse isso?: a fala transcrita entre aspas; sem fala entre aspas (ou curta), a rodada sai. 6.12.77: e só quando o nome de quem
  // fala está no texto antes da aspa (Rute 2:10 "ela", Lucas 2:49 "ele", Jó 1:21 "disse", Ester 4:16 começa com a aspa) e antes do
  // ouvinte (Gênesis 4:9 "Caim, a Jeová" sai; "Jeová, a Caim" fica).
  const qd = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Quem disse isso? (frases da Bíblia)"] }), montados);
  const falas = [["Gênesis 4:9", "Caim, a Jeová"], ["Rute 1:16", "Rute, a Noemi"], ["Atos 26:28", "Agripa, a Paulo"], ["Gênesis 50:20", "José, a seus irmãos"], ["Rute 2:10", "Rute, a Boaz"], ["Lucas 2:49", "Jesus, a seus pais"], ["Jó 1:21", "Jó"], ["Ester 4:16", "Ester, a Mardoqueu"], ["Gênesis 4:9", "Jeová, a Caim"], ["Lucas 23:34", "Jesus, ao Pai"], ["Gênesis 13:8", "Abrão, a Ló"], ["Gênesis 33:9", "Esaú, a Jacó"], ["Números 12:13", "Moisés, a Jeová, em favor de Miriã"], ["Mateus 18:21", "Pedro, a Jesus"], ["Atos 9:13", "Ananias, a Jesus"]];
  const q1 = await qd.prep.montar({ descricao: "d", nome: "Quem disse?", comoJogar: "R.", rodadas: falas.map(([referencia, resposta]) => ({ pergunta: "", resposta, referencia })), eventos: [] });
  assert.equal(q1.contagens.rodadas, 9, JSON.stringify(q1.jogo && q1.jogo.rodadas.map((r) => r.referencia)));
  assert.equal(q1.contagens.tiradas, 6, "Caim, a Jeová; Gênesis 50:20 sem aspas; Rute 2:10, Lucas 2:49, Jó 1:21 e Ester 4:16 sem o nome antes da fala");
  assert.equal(q1.jogo.idTipo, "quem_disse");
  assert.equal(q1.falta, "");
  assert.match(q1.jogo.rodadas[0].pergunta, /^Quem disse isso\? Dica 1: “Não insista comigo para abandoná-la, .+” Dica 2: Está nas Escrituras Hebraicas\.$/);
  assert.equal(q1.jogo.rodadas[1].pergunta, "Quem disse isso? Dica 1: “Em pouco tempo você me persuadiria a me tornar cristão.” Dica 2: Está em Atos.");
  const gn49 = q1.jogo.rodadas.find((r) => r.referencia === "Gênesis 4:9");
  assert.equal(gn49.resposta, "Jeová, a Caim");
  assert.equal(gn49.pergunta, "Quem disse isso? Dica 1: “Onde está Abel, seu irmão?” Dica 2: Está em Gênesis.");
  assert.ok(!q1.jogo.rodadas.some((r) => ["Rute 2:10", "Lucas 2:49", "Jó 1:21", "Ester 4:16"].includes(r.referencia)));
  assert.equal(q1.jogo.rodadas[1].referencia, "Atos 26:28");
  assert.equal(q1.memoria.jogo_versiculos.length, 9);
  for (const r of q1.jogo.rodadas) assert.ok(r.pergunta.length <= 400, r.referencia);
  // 6.12.77: Complete o versículo sem as aspas soltas (Mateus 6:14 começa com “ e Mateus 18:35 e Marcos 11:25 terminam com ”, sem par).
  const cp3 = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Complete o versículo"] }), montados);
  const c3 = await cp3.prep.montar({ descricao: "d", nome: "Complete", comoJogar: "R.", rodadas: [["Mateus 6:14", "celestial"], ["Mateus 18:35", "coração"], ["Marcos 11:25", "orando"]].map(([referencia, resposta]) => ({ pergunta: "", resposta, referencia })), eventos: [] });
  assert.equal(c3.jogo.rodadas.length, 3);
  assert.equal(c3.jogo.rodadas[0].pergunta, "Complete a palavra que falta. Dica 1: “Pois, se vocês perdoarem aos homens as falhas deles, o seu Pai ______ também perdoará vocês;” Dica 2: Está em Mateus.");
  assert.match(c3.jogo.rodadas[1].pergunta, /ao seu irmão\.” Dica 2: Está em Mateus\.$/);
  assert.match(c3.jogo.rodadas[2].pergunta, /as falhas de vocês\.” Dica 2: Está em Marcos\.$/);
  for (const r of c3.jogo.rodadas) assert.doesNotMatch(r.pergunta, /[‘’]/, r.referencia);
  // 6.12.77: a referência escrita pela IA com outra grafia do livro é lida e fica como na Bíblia.
  const c4 = await cp3.prep.montar({ descricao: "d", nome: "Complete", comoJogar: "R.", rodadas: [{ pergunta: "", resposta: "transgressões", referencia: "Salmo 103:12" }, { pergunta: "", resposta: "prisão", referencia: "Filemom 10" }], eventos: [] });
  assert.deepEqual(c4.jogo.rodadas.map((r) => r.referencia), ["Salmos 103:12", "Filêmon 10"]);
});

// ---------- Patch 6.12.77: aspas soltas, quem fala no Quem disse isso? e a grafia dos livros ----------

teste("6.12.77: semAspasSoltas, quemFalaConfere (com Gênesis 4:9) e referenciaPadrao", async () => {
  // Aspas sem par saem; as que têm par ficam; o ’ entre letras (apóstrofo) fica.
  assert.equal(ger.semAspasSoltas("“Pois, se vocês perdoarem aos homens as falhas deles;"), "Pois, se vocês perdoarem aos homens as falhas deles;");
  assert.equal(ger.semAspasSoltas("se cada um de vocês não perdoar de coração ao seu irmão.”"), "se cada um de vocês não perdoar de coração ao seu irmão.");
  assert.equal(ger.semAspasSoltas("Ele disse: “Venha.” E foi."), "Ele disse: “Venha.” E foi.");
  assert.equal(ger.semAspasSoltas("o fim da fala.” Então ele disse: “Outra fala"), "o fim da fala. Então ele disse: Outra fala");
  assert.equal(ger.semAspasSoltas("se ele apenas lhe disse: ‘Lave-se e fique puro.’”"), "se ele apenas lhe disse: ‘Lave-se e fique puro.’");
  assert.equal(ger.semAspasSoltas("‘Lave-se e fique puro."), "Lave-se e fique puro.");
  assert.equal(ger.semAspasSoltas("um pé-d’água forte"), "um pé-d’água forte");
  assert.equal(ger.semAspasSoltas(""), "");
  // Quem fala: o nome de quem fala antes da 1ª aspa e antes do ouvinte (o caso de Gênesis 4:9).
  const gn49 = "Mais tarde, Jeová perguntou a Caim: “Onde está Abel, seu irmão?” E Caim respondeu: “Não sei. Será que eu sou guardião do meu irmão?”";
  assert.equal(ger.quemFalaConfere(gn49, "Jeová, a Caim"), true);
  assert.equal(ger.quemFalaConfere(gn49, "Caim, a Jeová"), false, "o ouvinte vem antes de quem fala");
  assert.equal(ger.quemFalaConfere(gn49, "Caim"), true, "o nome está antes da aspa (a regra não lê o sentido)");
  assert.equal(ger.quemFalaConfere("Mas Agripa disse a Paulo: “Em pouco tempo você me persuadiria.”", "Agripa, a Paulo"), true);
  assert.equal(ger.quemFalaConfere("Mas Agripa disse a Paulo: “Em pouco tempo você me persuadiria.”", "Paulo, a Agripa"), false);
  assert.equal(ger.quemFalaConfere("Mas ele lhes disse: “Por que estavam procurando por mim?”", "Jesus, a seus pais"), false, "sem o nome: não dá para conferir");
  assert.equal(ger.quemFalaConfere("“Vá, reúna todos os judeus que estão em Susã.”", "Ester, a Mardoqueu"), false, "começa com a aspa");
  assert.equal(ger.quemFalaConfere("o nosso Deus pode nos livrar.” Então o rei se irou.", "Sadraque"), false, "sem aspa de abertura");
  assert.equal(ger.quemFalaConfere("E Moisés começou a clamar a Jeová: “Ó Deus, por favor! Cura-a, por favor!”", "Moisés, a Jeová, em favor de Miriã"), true, "Miriã não está antes da aspa");
  assert.equal(ger.quemFalaConfere("Mas Jesus dizia: “Pai, perdoa-lhes.”", "Jesus, ao Pai"), true);
  assert.equal(ger.quemFalaConfere("Mas Jesus dizia: “Pai, perdoa-lhes.”", ""), false);
  // Grafia dos livros: como na Bíblia do app; o que não é livro fica como veio.
  const { referenciaPadrao, livroPadrao } = fontesMod;
  assert.equal(referenciaPadrao("Filemon 10-12"), "Filêmon 10-12");
  assert.equal(referenciaPadrao("Filemom 10"), "Filêmon 10");
  assert.equal(referenciaPadrao("Filêmon 16"), "Filêmon 16");
  assert.equal(referenciaPadrao("Salmo 103:12"), "Salmos 103:12");
  assert.equal(referenciaPadrao("Rom. 12:17-19"), "Romanos 12:17-19");
  assert.equal(referenciaPadrao("1 sam 25:24"), "1 Samuel 25:24");
  assert.equal(referenciaPadrao("Jo 3:16"), "João 3:16");
  assert.equal(referenciaPadrao("Jó 42:10"), "Jó 42:10");
  assert.equal(referenciaPadrao("genesis 4:9; exodo 3:14"), "Gênesis 4:9; Êxodo 3:14");
  assert.equal(referenciaPadrao("Livro Inventado 3:1"), "Livro Inventado 3:1");
  assert.equal(referenciaPadrao(""), "");
  assert.equal(livroPadrao("Cantares"), "Cântico de Salomão");
  assert.equal(livroPadrao("Mímica"), "");
  // O servidor usa as três no jogo e o prompt reforça quem fala.
  assert.match(servidorJs, /lacunaNoVersiculo\(semAspasSoltas\(v\.texto\), resposta, livro\)/);
  assert.match(servidorJs, /!quemFalaConfere\(v\.texto, resposta\)/);
  assert.match(servidorJs, /referencia: referenciaPadrao\(linhaFamilia\(b\.referencia, 120\)\)/);
  const s = montados.sistemaFamiliaQuadro;
  assert.match(s.jogo, /QUEM FALA CONFERIDO/);
  assert.match(s.jogo, /"Jeová, a Caim", nunca "Caim, a Jeová"/);
  const promptsJs = await readFile(new URL("api/_prompts.mjs", raiz), "utf8");
  assert.match(promptsJs, /6\.12\.77: no Complete o versículo, sem as aspas que ficam sem par/);
  // Quem sou eu? sem a Bíblia: a referência com outra grafia já sai padronizada.
  const qse = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Quem sou eu? (personagens bíblicos)"] }), montados);
  const nomes = ["Josias", "Abigail", "Mefibosete", "Gideão", "Débora", "Onésimo"];
  const p = await qse.prep.montar({ descricao: "d", nome: "Quem sou eu?", comoJogar: "R.", rodadas: nomes.map((n, i) => ({ pergunta: `Dica 1: a ${i}. Dica 2: b ${i}. Dica 3: c ${i}.`, resposta: n, referencia: n === "Onésimo" ? "Filemon 10-12" : "Salmo 23:1" })), eventos: [] });
  assert.equal(p.jogo.rodadas.find((r) => r.resposta === "Onésimo").referencia, "Filêmon 10-12");
  assert.equal(p.jogo.rodadas[0].referencia, "Salmos 23:1");
});

teste("6.12.77: telas dos jogos (uma questão por vez, Mostrar resposta, ordem recolhida, revelar a ordem e placar local)", async () => {
  const css = await readFile(new URL("app.css", raiz), "utf8");
  // Sem compartilhar: o jogo da programação passa por familiaJogoLocalMontar (a lista com as respostas fica só na cópia e no Word).
  assert.match(appJs, /else if \(parte\.jogo\) bloco\.appendChild\(familiaJogoLocalMontar\(parte\.jogo\)\)/);
  assert.ok(!appJs.includes("'Material pronto para jogar ('"), "a lista com as respostas saiu da tela");
  assert.match(appJs, /familiaJogoTextos\(j\)\.forEach\(\(t, i\) => l\.push/, "o texto copiado continua com as respostas");
  assert.match(appJs, /'Questão ' \+ \(k \+ 1\) \+ ' de ' \+ rod\.length/);
  assert.match(appJs, /'💡 Próxima dica \(vale '/);
  assert.match(appJs, /ICONE_OLHO \+ ' Mostrar resposta'/);
  assert.match(appJs, /'💡 Resposta: ' \+ r\.resposta \+ \(r\.referencia \? ' \(' \+ r\.referencia \+ '\)' : ''\)/, "a referência só aparece com a resposta");
  assert.match(appJs, /'🔑 Ordem certa \(com as datas\)'/);
  assert.match(appJs, /'🏆 Placar \(opcional, não é salvo\)'/);
  assert.match(appJs, /const bicho = nome => PLACAR_ANIMAIS\[/);
  assert.match(appJs, /'\+ jogador'/);
  // O placar local não é salvo nem enviado: nada de localStorage, IndexedDB ou servidor dentro de familiaJogoLocalMontar.
  const ini = appJs.indexOf("function familiaJogoLocalMontar(j)");
  const fim = appJs.indexOf("\n    }\n", ini);
  const corpo = appJs.slice(ini, fim);
  assert.ok(ini > 0 && fim > ini);
  for (const proibido of ["localStorage", "indexedDB", "historicoGravar", "familiaSessaoPedir", "fetch("]) assert.ok(!corpo.includes(proibido), proibido);
  // A ordem certa: jogo.ordem ou, nas programações sem ela, a lista do fim de "como jogar".
  const fonteOrdem = appJs.slice(appJs.indexOf("function familiaOrdemDoJogo(j)"), appJs.indexOf("// A pergunta de uma rodada separada"));
  const familiaOrdemDoJogo = new Function(fonteOrdem + "; return familiaOrdemDoJogo;")();
  assert.deepEqual(familiaOrdemDoJogo({ ordem: [{ data: "4026 a.C.", evento: "Criação de Adão" }] }), [{ data: "4026 a.C.", evento: "Criação de Adão" }]);
  assert.deepEqual(familiaOrdemDoJogo({ comoJogar: "Coloquem em ordem. Ordem certa (datas do Apêndice B da Bíblia de Estudo): 1. 4026 a.C. — Criação de Adão; 2. 2370 a.C. — Dilúvio." }),
    [{ data: "4026 a.C.", evento: "Criação de Adão" }, { data: "2370 a.C.", evento: "Dilúvio" }]);
  assert.deepEqual(familiaOrdemDoJogo({ comoJogar: "Sem ordem." }), []);
  // Compartilhada: revelar a ordem a todos e pontuar de boca (rodada "ordem"), com o estado.ordensReveladas.
  assert.match(appJs, /participarAcao\(\{ acao: 'revelar-ordem', parte: parteIdx \}/);
  assert.match(appJs, /rodada: 'ordem', nome: o\.sel\.value, pts: Number\(o\.selPts\.value\)/);
  assert.match(appJs, /rodada: 'ordem' \}, o\.btnReiniciar\)/);
  assert.match(appJs, /e\.ordensReveladas \|\| \{\}\)\[i\]/);
  // CSS: botões na largura toda (crescem e quebram a linha), sem verde.
  const bloco = css.slice(css.indexOf("6.12.77: jogo sem compartilhar"));
  assert.match(bloco, /\.fam-jogo-questao-botoes > button, \.fam-jogo-questao-nav > button \{ flex: 1 1 140px/);
  assert.match(bloco, /#participarSessao \.fam-sessao-ordem \.fam-sessao-revelar \{[^}]*width: 100%/);
  assert.ok(!/#(?:22c55e|16a34a|10b981|059669|4ade80)|green/i.test(bloco), "sem verde");
  assert.ok(!/culto/i.test(corpo + bloco));
});

// ---------- Patch 6.12.78: conferência dos jogos escritos pela IA com o texto da Bíblia ----------

teste("6.12.78: funções puras da conferência (veredito, mensagem, o que sai e o que volta no pedido de novo)", () => {
  assert.deepEqual([...ger.JOGOS_CONFERIDOS_NA_BIBLIA], ["quem_sou_eu", "verdadeiro_falso"]);
  assert.equal(ger.vereditoDaConferencia("contradiz"), "contradiz");
  assert.equal(ger.vereditoDaConferencia("Contradiz"), "contradiz");
  assert.equal(ger.vereditoDaConferencia("errada"), "contradiz");
  assert.equal(ger.vereditoDaConferencia("CONFERE"), "confere");
  assert.equal(ger.vereditoDaConferencia("nao_consta"), "nao_consta");
  assert.equal(ger.vereditoDaConferencia("não consta"), "nao_consta");
  assert.equal(ger.vereditoDaConferencia(""), "nao_consta", "vazio nunca tira a rodada");
  assert.equal(ger.vereditoDaConferencia(undefined), "nao_consta");
  assert.equal(ger.vereditoDaConferencia("talvez erre"), "nao_consta", "na dúvida, fica");

  // A mensagem: cada rodada com a resposta dada, a referência e o texto da Bíblia; sem texto, o aviso para responder nao_consta.
  const vf = [
    { pergunta: "Estêvão pediu a Jeová que não imputasse aquele pecado.", resposta: "Falso. Foi a Jesus.", referencia: "Atos 7:59, 60" },
    { pergunta: "Outra afirmação.", resposta: "Verdadeiro.", referencia: "" },
  ];
  const m1 = ger.mensagemDeConferenciaDoJogo("verdadeiro_falso", vf, ["Atos 7:60 Então, ajoelhando-se,   ele clamou: “Jeová, não os condenes por este pecado.”", ""]);
  assert.match(m1, /^TIPO DO JOGO: Verdadeiro ou falso\nRODADAS A CONFERIR \(2\)/);
  assert.match(m1, /\[1\] AFIRMAÇÃO: Estêvão pediu a Jeová que não imputasse aquele pecado\.\nRESPOSTA DADA: Falso\. Foi a Jesus\.\nREFERÊNCIA: Atos 7:59, 60\nTEXTO DA BÍBLIA: Atos 7:60 Então, ajoelhando-se, ele clamou/);
  assert.match(m1, /\[2\] AFIRMAÇÃO: Outra afirmação\.\nRESPOSTA DADA: Verdadeiro\.\nREFERÊNCIA: \(nenhuma\)\nTEXTO DA BÍBLIA: \(o servidor não achou o texto desta referência: responda nao_consta\)/);
  const m2 = ger.mensagemDeConferenciaDoJogo("quem_sou_eu", [{ pergunta: "Dica 1: a. Dica 2: b. Dica 3: c.", resposta: "José", referencia: "Gênesis 50:16" }], ["Eles mandaram dizer a José"]);
  assert.match(m2, /^TIPO DO JOGO: Quem sou eu\?\nRODADAS A CONFERIR \(1\)/);
  assert.match(m2, /\[1\] DICAS: Dica 1: a\. Dica 2: b\. Dica 3: c\.\nRESPOSTA DADA: José\n/);
  assert.equal(ger.mensagemDeConferenciaDoJogo("verdadeiro_falso", [], []).includes("RODADAS A CONFERIR (0)"), true);

  // Só "contradiz" tira a rodada; n fora da lista, repetido ou sem veredito válido não tira nada.
  const rodadas = [1, 2, 3, 4].map((i) => ({ pergunta: `P${i}`, resposta: `R${i}`, referencia: "Gênesis 1:1" }));
  const r = ger.aplicarConferenciaDoJogo(rodadas, [
    { n: 2, veredito: "contradiz", motivo: "  O texto diz o\ncontrário. " },
    { n: 2, veredito: "contradiz", motivo: "repetido" },
    { n: 3, veredito: "nao_consta", motivo: "" },
    { n: 4, veredito: "confere", motivo: "" },
    { n: 9, veredito: "contradiz", motivo: "n fora da lista" },
    { n: 0, veredito: "contradiz", motivo: "n zero" },
    { veredito: "contradiz", motivo: "sem n" },
  ]);
  assert.deepEqual(r.mantidas.map((x) => x.pergunta), ["P1", "P3", "P4"]);
  assert.equal(r.rejeitadas.length, 1);
  assert.equal(r.rejeitadas[0].rodada.pergunta, "P2");
  assert.equal(r.rejeitadas[0].motivo, "O texto diz o contrário.");
  for (const ruim of [null, undefined, "contradiz", {}, 5]) {
    const x = ger.aplicarConferenciaDoJogo(rodadas, ruim);
    assert.equal(x.mantidas.length, 4, "sem resposta válida da IA, todas ficam");
    assert.equal(x.rejeitadas.length, 0);
  }
  assert.deepEqual(ger.aplicarConferenciaDoJogo(rodadas, []).mantidas, rodadas);
  assert.notEqual(ger.aplicarConferenciaDoJogo(rodadas, []).mantidas, rodadas, "devolve uma cópia");

  // O que volta no pedido de novo: até 4 rodadas, curtas, com o motivo.
  assert.equal(ger.textoDasRejeitadas([]), "");
  assert.equal(ger.textoDasRejeitadas(undefined), "");
  const cinco = [1, 2, 3, 4, 5].map((i) => ({ rodada: { pergunta: `Afirmação ${i} ${"x".repeat(200)}` }, motivo: i === 1 ? "" : `motivo ${i}` }));
  const t = ger.textoDasRejeitadas(cinco);
  assert.match(t, /^a conferência com a Bíblia tirou 5 rodadas por contrariar o texto/);
  assert.equal((t.match(/"Afirmação /g) || []).length, 4, "só 4 aparecem");
  assert.match(t, /\(contraria o texto\)/, "sem motivo, o texto padrão");
  assert.match(t, /…"/, "a afirmação é cortada");
  assert.match(ger.textoDasRejeitadas([cinco[1]]), /^a conferência com a Bíblia tirou 1 rodada por contrariar/);
  // As quantidades pedidas deixam folga para o que a conferência tirar.
  assert.deepEqual({ ...ger.RODADAS_DO_JOGO.verdadeiro_falso }, { pedir: 14, min: 10, max: 12 });
  assert.deepEqual({ ...ger.RODADAS_DO_JOGO.quem_sou_eu }, { pedir: 10, min: 6, max: 8 });
});

teste("6.12.78: prompt da conferência (editável), formato travado, sistema montado e o jogo avisa da conferência", () => {
  const parte = prompts.PARTES.find((x) => x.id === "adoracao_q_conferir");
  assert.ok(parte && parte.padrao.length > 400 && parte.descricao.length > 80);
  assert.doesNotMatch(parte.padrao, /\bcultos?\b/i);
  assert.match(parte.padrao, /ETAPA: CONFERÊNCIA DE UM JOGO BÍBLICO/);
  assert.match(parte.padrao, /Baseie-se SÓ no texto recebido/);
  assert.match(parte.padrao, /QUEM fez o quê e A QUEM/);
  assert.match(parte.padrao, /Na dúvida, use "nao_consta", NUNCA "contradiz"/);
  assert.match(parte.padrao, /não os condenes por este pecado/, "o caso de Estêvão está no prompt");
  const cat = prompts.CATEGORIAS.find((c) => (c.partes || []).includes("adoracao_familia"));
  assert.ok(cat.partes.includes("adoracao_q_conferir"), "a parte aparece na tela de prompts");
  const travado = prompts.travadosDe({}).find((x) => x.id === "formato_familia_conferir_jogo");
  assert.ok(travado, "o formato é só leitura na tela de prompts");
  assert.match(travado.texto, /"veredito": "confere"/);
  assert.doesNotMatch(travado.texto, /\bcultos?\b/i);
  // O sistema montado: a parte editável + vocabulário + formato (sem as regras comuns dos quadros).
  const s = montados.sistemaFamiliaConferir;
  assert.ok(typeof s === "string" && s.startsWith(parte.padrao));
  assert.match(s, /VOCABULÁRIO \(regra fixa, vale sempre\)/);
  assert.match(s, /FORMATO DA CONFERÊNCIA DO JOGO/);
  assert.ok(!Object.keys(montados.sistemaFamiliaQuadro).includes("conferir"), "não é um quadro");
  // A parte do jogo avisa a IA da conferência; o formato e a descrição da montagem também.
  const jogo = prompts.PARTES.find((x) => x.id === "adoracao_q_jogo").padrao;
  assert.match(jogo, /CONFERÊNCIA COM A BÍBLIA \(Verdadeiro ou falso e Quem sou eu\?\)/);
  assert.match(jogo, /TODOS os versículos que sustentam/);
  assert.doesNotMatch(jogo, /\bcultos?\b/i);
  assert.match(montados.sistemaFamiliaQuadro.jogo, /ainda passam por uma conferência com a Bíblia/);
  const montagem = prompts.travadosDe({}).find((x) => x.id === "montagem_pedidos").texto;
  assert.match(montagem, /6\.12\.78: o Verdadeiro ou falso e o Quem sou eu\? passam por uma conferência com a Bíblia/);
  assert.match(montagem, /Quem sou eu\? 10, no mínimo 6, ficam até 8; Verdadeiro ou falso 14, no mínimo 10, ficam até 12/);
});

teste("6.12.78: servidor liga a conferência ao jogo (só os 2 tipos, com a Bíblia, tokens contados, falha não tira rodadas)", () => {
  assert.match(servidorJs, /export const SaidaConferenciaJogo = z\.object\(/);
  assert.match(servidorJs, /const conferirJogoFamilia = async \(idTipo, rodadas\) => \{/);
  assert.match(servidorJs, /pd\.ctx\.conferirJogo = conferirJogoFamilia;/);
  assert.match(servidorJs, /id === "jogo" \? 10000 : 6000, system: pd\.sistema/, "o jogo tem teto de saída maior (a saída chegou a ser cortada com 6000)");
  assert.match(servidorJs, /ctx\.conferirJogo && comBiblia && JOGOS_CONFERIDOS_NA_BIBLIA\.includes\(idTipo\) && conferidas\.length/);
  assert.match(servidorJs, /system: P\.sistemaFamiliaConferir/);
  // Os tokens da conferência entram na conta do quadro (entrada e saída) e uma falha devolve null (as rodadas ficam).
  const ini = servidorJs.indexOf("const conferirJogoFamilia = async");
  const fim = servidorJs.indexOf("const gerarUma = async", ini);
  const corpo = servidorJs.slice(ini, fim);
  assert.ok(ini > 0 && fim > ini);
  assert.match(corpo, /entrada \+= resposta\.usage\?\.input_tokens \|\| 0;/);
  assert.match(corpo, /saida \+= resposta\.usage\?\.output_tokens \|\| 0;/);
  assert.match(corpo, /catch \(e\) \{\r?\n\s+return null;/);
  assert.match(corpo, /buscarVersiculos\(\[r\.referencia\], 1, \{ maxVersiculos: 8, maxChars: 1800 \}\)/);
  // O motivo das rodadas tiradas volta no pedido de novo (FALTOU) e a contagem entra no log.
  assert.match(servidorJs, /textoDasRejeitadas\(rejeitadasNaBiblia\)/);
  assert.match(servidorJs, /contagensDaConferencia = \{ conferenciaNaBiblia: conferidasNaBiblia, rejeitadasNaBiblia: rejeitadasNaBiblia\.length \}/);
  assert.match(servidorJs, /\.\.\.contagensDaConferencia \},/);
  // Nada do perfil nem do texto das rodadas no log.
  const logs = servidorJs.split("\n").filter((l) => /console\.log\("Adoração em Família \((plano|quadro)\)/.test(l));
  for (const l of logs.filter((x) => /\(quadro\)/.test(x))) assert.doesNotMatch(l, /\.pergunta|\.resposta\b|motivo|rejeitadas\b|textos\.map/);
});

teste("6.12.78: Verdadeiro ou falso e Quem sou eu? com a conferência simulada (com FONTES_DIR): sai só o que o texto contradiz", async () => {
  const chamadas = [];
  const vf = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Verdadeiro ou falso"] }), montados);
  const rodada = (i) => ({ pergunta: `Afirmação ${i}`, resposta: i % 2 ? "Verdadeiro. Está no relato." : "Falso. Foi outro.", referencia: "Gênesis 1:1" });
  const saida = (o) => ({ descricao: "d", nome: "V ou F", comoJogar: "Regras.", rodadas: Array.from({ length: 14 }, (_, i) => rodada(i + 1)), eventos: [], ...o });
  // Sem conferirJogo no contexto (como nos testes antigos) nada muda.
  const semConferencia = await vf.prep.montar(saida());
  assert.equal(semConferencia.contagens.rodadas, 12);
  assert.equal(semConferencia.contagens.conferenciaNaBiblia, 0);
  assert.equal(semConferencia.contagens.rejeitadasNaBiblia, 0);
  // Com a conferência: a IA (simulada) diz que as rodadas 2 e 9 contradizem o texto.
  vf.ctx.conferirJogo = async (idTipo, rodadas) => {
    chamadas.push({ idTipo, n: rodadas.length, referencias: rodadas.map((r) => r.referencia) });
    return rodadas.map((_, i) => ({ n: i + 1, veredito: i + 1 === 2 || i + 1 === 9 ? "contradiz" : i + 1 === 5 ? "nao_consta" : "confere", motivo: i + 1 === 2 ? "O texto diz o contrário." : "" }));
  };
  const comConferencia = await vf.prep.montar(saida());
  if (!comFontes) {
    assert.equal(chamadas.length, 0, "sem a Bíblia no servidor, a conferência não roda");
    assert.equal(comConferencia.contagens.conferenciaNaBiblia, 0);
    return console.log("      (sem FONTES_DIR: conferência simulada pulada)");
  }
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].idTipo, "verdadeiro_falso");
  assert.equal(chamadas[0].n, 14, "as 14 rodadas válidas vão à conferência");
  assert.equal(comConferencia.contagens.conferenciaNaBiblia, 1);
  assert.equal(comConferencia.contagens.rejeitadasNaBiblia, 2);
  assert.equal(comConferencia.contagens.rodadas, 12, "14 - 2 = 12 ficam");
  assert.ok(!comConferencia.jogo.rodadas.some((r) => r.pergunta === "Afirmação 2" || r.pergunta === "Afirmação 9"));
  assert.ok(comConferencia.jogo.rodadas.some((r) => r.pergunta === "Afirmação 5"), "nao_consta fica");
  assert.equal(comConferencia.falta, "", "ainda sobram mais que o mínimo");
  // Com muitas tiradas faltam rodadas: o pedido de novo traz o motivo.
  vf.ctx.conferirJogo = async (idTipo, rodadas) => rodadas.map((_, i) => ({ n: i + 1, veredito: i < 6 ? "contradiz" : "confere", motivo: i === 0 ? "Quem pediu foi outro." : "" }));
  const muitas = await vf.prep.montar(saida());
  assert.match(muitas.falta, /^vieram 8 rodadas válidas; mande 14 rodadas \(no mínimo 10\), em nível de adulto batizado/);
  assert.match(muitas.falta, /; a conferência com a Bíblia tirou 6 rodadas por contrariar o texto/);
  assert.match(muitas.falta, /"Afirmação 1" \(Quem pediu foi outro\.\)/);
  // A conferência falhou (null, erro ou resposta que não é lista): as rodadas ficam como estão.
  for (const falha of [async () => null, async () => { throw new Error("IA fora do ar"); }, async () => ({ rodadas: [] })]) {
    vf.ctx.conferirJogo = falha;
    const f = await vf.prep.montar(saida());
    assert.equal(f.contagens.rodadas, 12);
    assert.equal(f.contagens.conferenciaNaBiblia, 0);
  }
  // Quem sou eu?: a rodada que o texto contradiz (dica com os papéis trocados) sai.
  const qse = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Quem sou eu? (personagens bíblicos)"] }), montados);
  const nomes = ["Josias", "Abigail", "Mefibosete", "Gideão", "Débora", "Onésimo", "Rute", "Jonas"];
  const rodadasQse = nomes.map((n, i) => ({ pergunta: `Dica 1: a ${i}. Dica 2: b ${i}. Dica 3: c ${i}.`, resposta: n, referencia: "Salmo 23:1" }));
  qse.ctx.conferirJogo = async (idTipo, rodadas) => {
    chamadas.push({ idTipo, n: rodadas.length });
    return rodadas.map((r, i) => ({ n: i + 1, veredito: r.resposta === "Mefibosete" ? "contradiz" : "confere", motivo: "papéis trocados" }));
  };
  const q = await qse.prep.montar({ descricao: "d", nome: "Quem sou eu?", comoJogar: "R.", rodadas: rodadasQse, eventos: [] });
  assert.equal(chamadas[chamadas.length - 1].idTipo, "quem_sou_eu");
  assert.equal(q.contagens.rejeitadasNaBiblia, 1);
  assert.ok(!q.jogo.rodadas.some((r) => r.resposta === "Mefibosete"));
  assert.equal(q.jogo.rodadas.length, 7);
  // Os outros tipos não passam pela conferência (nascem do texto transcrito ou do servidor).
  const chamadasAntes = chamadas.length;
  const ab = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Abreviações bíblicas (ex.: Os 12 A de C)"] }), montados);
  ab.ctx.conferirJogo = async () => { chamadas.push({ idTipo: "abreviacoes" }); return []; };
  await ab.prep.montar({ descricao: "d", nome: "Abreviações", comoJogar: "R.", rodadas: [{ pergunta: "P da P", resposta: "Príncipe da Paz", referencia: "Isaías 9:6" }], eventos: [] });
  assert.equal(chamadas.length, chamadasAntes, "Abreviações não é conferido pela IA");
});

// ---------- Patch 6.12.79: os 4 pontos da revisão de código ----------

teste("6.12.79 (1): entre duas tentativas, vale a que tem menos problemas e, empatando, mais rodadas", () => {
  const t = (rodadas, falta = "", repeticoes = []) => ({ repeticoes, falta, contagens: { rodadas } });
  // O caso da revisão: 9 rodadas (falta 1) contra 4 rodadas (também falta 1): a de 4 NÃO substitui a de 9.
  assert.equal(ger.segundaTentativaMelhor(t(9, "vieram 9"), t(4, "vieram 4")), false);
  assert.equal(ger.segundaTentativaMelhor(t(4, "vieram 4"), t(9, "vieram 9")), true);
  assert.equal(ger.segundaTentativaMelhor(t(9, "vieram 9"), t(9, "vieram 9")), true, "empate total: vale a 2ª (como antes)");
  // Menos problemas ganha, mesmo com menos rodadas; mais problemas perde, mesmo com mais rodadas.
  assert.equal(ger.segundaTentativaMelhor(t(9, "vieram 9"), t(8)), true);
  assert.equal(ger.segundaTentativaMelhor(t(10), t(12, "vieram 12 e faltam falsas")), false);
  assert.equal(ger.segundaTentativaMelhor(t(10, "", ["o personagem X já está em outro quadro"]), t(10)), true);
  assert.equal(ger.segundaTentativaMelhor(t(10, "f", ["a"]), t(10, "f", ["a", "b"])), false);
  // Quadros sem rodadas (nenhum é jogo): empate de problemas = a 2ª, como sempre foi.
  assert.equal(ger.segundaTentativaMelhor({ repeticoes: ["a"], falta: "", contagens: {} }, { repeticoes: ["a"], falta: "", contagens: {} }), true);
  assert.equal(ger.segundaTentativaMelhor(t(9, "x"), null), false);
  assert.equal(ger.segundaTentativaMelhor(t(9, "x"), undefined), false);
  assert.match(servidorJs, /if \(segundaTentativaMelhor\(r, r2\)\) r = r2;/);
  assert.ok(!servidorJs.includes("problemas(r2).length <= problemas(r).length"), "a comparação antiga saiu");
});

teste("6.12.79 (2): rodada sem texto conferível sai (separarPorTexto, sem_texto) e a conferência só roda com a Bíblia respondendo", () => {
  assert.equal(ger.vereditoDaConferencia("sem_texto"), "sem_texto");
  assert.equal(ger.vereditoDaConferencia("Sem texto"), "sem_texto");
  assert.deepEqual([...ger.TIPOS_DE_VEREDITO], ["confere", "contradiz", "nao_consta", "sem_texto"]);
  const rodadas = [
    { pergunta: "A", resposta: "Verdadeiro.", referencia: "Atos 7:59, 60" },
    { pergunta: "B", resposta: "Falso.", referencia: "" },
    { pergunta: "C", resposta: "Verdadeiro.", referencia: "Ato 99:1" },
    { pergunta: "D", resposta: "Falso.", referencia: "Gênesis 50:16" },
  ];
  const textos = ["Atos 7:59 Enquanto apedrejavam Estêvão…", "", "", "Gênesis 50:16 Por isso, eles mandaram dizer a José"];
  const { aConferir, semTexto } = ger.separarPorTexto(rodadas, textos);
  assert.deepEqual(aConferir.map((x) => x.indice), [0, 3]);
  assert.deepEqual(semTexto.map((x) => x.n), [2, 3]);
  assert.ok(semTexto.every((x) => x.veredito === "sem_texto"));
  assert.equal(semTexto[0].motivo, "a rodada veio sem referência");
  assert.equal(semTexto[1].motivo, "o texto de Ato 99:1 não foi achado na Bíblia");
  // A IA recebe só as rodadas com texto (n de 1 a 2); os itens voltam com o n da lista original (1 e 4).
  const daIa = [{ n: 1, veredito: "confere", motivo: "" }, { n: 2, veredito: "contradiz", motivo: "os papéis estão trocados" }, { n: 7, veredito: "contradiz", motivo: "fora da lista" }];
  const originais = ger.itensNaPosicaoOriginal(daIa, aConferir);
  assert.deepEqual(originais.map((x) => [x.n, x.veredito]), [[1, "confere"], [4, "contradiz"]], "o n fora da lista de enviadas sai");
  assert.deepEqual(ger.itensNaPosicaoOriginal(null, aConferir), []);
  // Aplicadas: contradiz (D) e sem_texto (B e C) saem; só A fica.
  const ap = ger.aplicarConferenciaDoJogo(rodadas, [...originais, ...semTexto]);
  assert.deepEqual(ap.mantidas.map((r) => r.pergunta), ["A"]);
  assert.deepEqual(ap.rejeitadas.map((x) => x.rodada.pergunta).sort(), ["B", "C", "D"]);
  assert.match(ger.textoDasRejeitadas(ap.rejeitadas), /por contrariar o texto ou por não terem um texto conferível/);
  assert.match(ger.textoDasRejeitadas(ap.rejeitadas), /\(a rodada veio sem referência\)/);
  assert.match(ger.textoDasRejeitadas(ap.rejeitadas), /\(o texto de Ato 99:1 não foi achado na Bíblia\)/);
  // O servidor usa tudo isso e testa se a Bíblia responde antes de dar as rodadas por inconferíveis.
  assert.match(servidorJs, /const \{ aConferir, semTexto \} = separarPorTexto\(rodadas, textos\);/);
  assert.match(servidorJs, /const prova = await buscarVersiculos\(\["Gênesis 1:1"\], 1\)\.catch\(\(\) => \[\]\);/);
  assert.match(servidorJs, /return prova\.length \? semTexto : null;/);
  assert.match(servidorJs, /return \[\.\.\.itensNaPosicaoOriginal\(resposta\.parsed_output\.rodadas, aConferir\), \.\.\.semTexto\];/);
  assert.match(servidorJs, /mensagemDeConferenciaDoJogo\(idTipo, aConferir\.map\(\(x\) => x\.rodada\), aConferir\.map\(\(x\) => x\.texto\)\)/);
  const jogoPrompt = prompts.PARTES.find((x) => x.id === "adoracao_q_jogo").padrao;
  assert.match(jogoPrompt, /TODA rodada precisa de uma "referencia" que o servidor ache na Bíblia/);
  assert.match(montados.sistemaFamiliaQuadro.jogo, /também sai \(não dá para conferi-la\)/);
});

teste("6.12.79 (2): com a conferência simulada devolvendo sem_texto, a rodada sai e o pedido de novo diz por quê (com FONTES_DIR)", async () => {
  const vf = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Verdadeiro ou falso"] }), montados);
  const rodada = (i) => ({ pergunta: `Afirmação ${i}`, resposta: i % 2 ? "Verdadeiro. Está no relato." : "Falso. Foi outro.", referencia: i <= 4 ? "" : "Gênesis 1:1" });
  const saida = { descricao: "d", nome: "V ou F", comoJogar: "Regras.", rodadas: Array.from({ length: 14 }, (_, i) => rodada(i + 1)), eventos: [] };
  vf.ctx.conferirJogo = async (idTipo, rodadas) => rodadas.map((r, i) => (r.referencia ? { n: i + 1, veredito: "confere", motivo: "" } : { n: i + 1, veredito: "sem_texto", motivo: "a rodada veio sem referência" }));
  const r = await vf.prep.montar(saida);
  if (!comFontes) return console.log("      (sem FONTES_DIR: conferência simulada pulada)");
  assert.equal(r.contagens.rejeitadasNaBiblia, 4);
  assert.equal(r.contagens.rodadas, 10, "14 - 4 sem referência = 10");
  assert.ok(!r.jogo.rodadas.some((x) => ["Afirmação 1", "Afirmação 2", "Afirmação 3", "Afirmação 4"].includes(x.pergunta)));
  assert.equal(r.falta, "", "10 é o mínimo do tipo: não pede de novo");
  const poucas = await vf.prep.montar({ ...saida, rodadas: Array.from({ length: 12 }, (_, i) => rodada(i + 1)) });
  assert.match(poucas.falta, /^vieram 8 rodadas válidas; mande 14 rodadas \(no mínimo 10\)/);
  assert.match(poucas.falta, /a conferência com a Bíblia tirou 4 rodadas por contrariar o texto ou por não terem um texto conferível/);
  assert.match(poucas.falta, /\(a rodada veio sem referência\)/);
});

teste("6.12.79 (3): Princípio sem entradas do índice não chama a IA (503) e texto não achado não faz refazer o Princípio", async () => {
  assert.match(servidorJs, /if \(prep\.indisponivel\) return erro\(res, 503, prep\.indisponivel\);/);
  assert.match(servidorJs, /indisponivel: cands\.length \? "" : "A lista de Princípios Bíblicos não está disponível agora\./);
  assert.match(servidorJs, /fontesConfiguradas\(\) && id !== "principio" \? parte\.textos\.filter/);
  const pr = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "principio" }), montados);
  assert.ok(!pr.erro);
  if (comFontes) assert.equal(pr.prep.indisponivel, "", "com o índice, o quadro segue");
  else assert.match(pr.prep.indisponivel, /^A lista de Princípios Bíblicos não está disponível agora\./, "sem o índice, o quadro não chama a IA");
  // Os outros quadros não têm esse campo (seguem como sempre).
  const jesus = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jesus" }), montados);
  assert.ok(!jesus.prep.indisponivel);
});

teste("6.12.79 (4): prazo total do quadro (270 s): cada chamada com o tempo que sobra e, sem tempo, nada de refazer, trocar o tipo ou conferir", () => {
  assert.match(servidorJs, /const PRAZO_TOTAL_MS = 270_000;/);
  assert.match(servidorJs, /const PRAZO_MINIMO_MS = 40_000;/);
  assert.match(servidorJs, /const restante = \(\) => PRAZO_TOTAL_MS - \(Date\.now\(\) - inicio\);/);
  assert.match(servidorJs, /const clienteComPrazo = \(\) => criarClienteIa\(\{ maxRetries: 0, timeout: Math\.max\(10_000, Math\.min\(tempoIa\(P, 120_000\), restante\(\) - 5_000\)\) \}, P\.ia\.provedorTarefa\);/);
  // 6.12.80: o limite de cada chamada acompanha o modelo (tempoIa), no quadro e no plano; o 4 Argon com esforço alto estourava os 120 fixos.
  assert.match(servidorJs, /const client = criarClienteIa\(\{ maxRetries: 0, timeout: tempoIa\(P, 120_000\) \}, P\.ia\.provedorTarefa\); \/\/ 6\.12\.80/);
  assert.ok(!/maxRetries: 0, timeout: 120_000 \}, P\.ia\.provedorTarefa\)/.test(servidorJs), "nenhum cliente de 120 s fixo na Adoração em Família");
  // O prazo cabe no que o app espera (IA_ESPERA_MS = 290 s).
  const espera = Number((appJs.match(/const IA_ESPERA_MS = (\d+);/) || [])[1]);
  assert.ok(espera >= 280000, "IA_ESPERA_MS");
  assert.ok(270000 + 5000 < espera, "o prazo do servidor termina antes de o app desistir");
  // Todas as chamadas do quadro usam o cliente com prazo (nenhum cliente de 120 s fixo sobrou na função).
  const ini = servidorJs.indexOf("async function gerarQuadroFamilia(res, body, P)");
  const fim = servidorJs.indexOf("// Chamada única de antes (versões antigas do app, sem \"fase\").", ini);
  const corpo = servidorJs.slice(ini, fim);
  assert.ok(ini > 0 && fim > ini);
  assert.ok(!/criarClienteIa\(\{ maxRetries: 0, timeout: 120_000 \}/.test(corpo), "sem cliente de 120 s fixo");
  assert.equal((corpo.match(/chamarIa\(\r?\n\s+clienteComPrazo\(\),/g) || []).length, 3, "geração, conferência e revisão da leitura");
  assert.match(corpo, /if \(!fontesConfiguradas\(\) \|\| !P\.sistemaFamiliaConferir \|\| !comTempo\(\)\) return null;/);
  assert.match(corpo, /if \(problemas\(r\)\.length && body\.refazerRepetido !== true && comTempo\(\)\) \{/);
  assert.match(corpo, /if \(id === "jogo" && r\.trocarTipo && body\.refazerRepetido !== true && comTempo\(\)\) \{/);
  assert.match(corpo, /tipoNovo && idDoJogo\(tipoNovo\) !== idDoJogo\(r\.trocarTipo\) && comTempo\(\)/);
  assert.match(corpo, /"sem tempo para refazer o quadro"/);
  // O CHANGELOG e a descrição da montagem registram o patch.
  assert.match(prompts.travadosDe({}).find((x) => x.id === "montagem_pedidos").texto, /6\.12\.79: a rodada do Verdadeiro ou falso e do Quem sou eu\? sem referência/);
});

// ---------- Patch 6.12.83: títulos dos quadros curtos e cortados no fim de uma palavra ----------

teste("6.12.83: título do quadro cortado no fim de uma palavra (cortarNaPalavra) e usado em Jesus, Saiba responder e Ame o ministério", () => {
  const f = ger.cortarNaPalavra;
  assert.equal(f("Jesus visita Zaqueu"), "Jesus visita Zaqueu", "curto fica igual");
  const longo = "Jesus convida os apóstolos para descansar após uma intensa viagem de pregação e ainda assim ensina a multidão";
  const c = f(longo);
  assert.ok(c.length <= 71 && c.endsWith("…"), c);
  assert.ok(longo.startsWith(c.slice(0, -1)), "é um começo do texto, sem palavra cortada ao meio");
  assert.match(longo.slice(c.length - 1), /^[\s,;:]/, "o corte é no fim de uma palavra");
  assert.equal(f("Fazendo uma revisita rápida a uma pessoa muito ocupada ou com pressa que demonstrou interesse na primeira visita"), "Fazendo uma revisita rápida a uma pessoa muito ocupada ou com pressa…");
  assert.equal(f("Com a rotina tão corrida hoje em dia, por que vocês ainda tiram tempo toda semana para falar da Bíblia?", 40), "Com a rotina tão corrida hoje em dia…", "sem ' por que' nem vírgula pendurada");
  assert.ok(!/\s(e|de|da|do|em|que|para|com)…$/i.test(f("a ".repeat(40) + "palavra de Deus e muito mais coisas para falar", 30)), "sem palavrinha pendurada");
  assert.equal(f("", 10), "");
  assert.equal(ger.MAX_TITULO_DO_QUADRO, 70);
  for (const trecho of ["nome: episodio ? `${ctx.quadro.nome}: ${cortarNaPalavra(episodio)}`", "nome: pergunta ? `${ctx.quadro.nome}: ${cortarNaPalavra(pergunta)}`", "nome: cenario ? `${ctx.quadro.nome}: ${cortarNaPalavra(cenario)}`"]) assert.ok(servidorJs.includes(trecho), trecho);
  assert.match(servidorJs, /`Situação: \$\{cenario\.replace\(\/\[\.\\s\]\+\$\/, ""\)\}\. \$\{o\.descricao \|\| ""\}`/);
});

// ---------- Patch 6.12.81: acentuação e siglas curtas nas Abreviações (achados no teste com o Gemini) ----------

teste("6.12.81 (1): a regra de acentuação está nas regras comuns e chega ao plano e a todos os quadros", () => {
  const base = prompts.PARTES.find((x) => x.id === "adoracao_q_base");
  assert.match(base.padrao, /- ACENTUAÇÃO: escreva SEMPRE em português do Brasil com a acentuação e a cedilha corretas/);
  assert.match(base.padrao, /"Jeová", "não", "você", "cântico", "perdão", "oração", e nunca "Jeova", "nao", "voce", "cantico", "perdao", "oracao"/);
  assert.match(base.descricao, /acentuação correta do português/);
  assert.doesNotMatch(base.padrao, /\bcultos?\b/i);
  const regra = /ACENTUAÇÃO: escreva SEMPRE em português do Brasil/;
  assert.match(montados.sistemaFamiliaPlano, regra, "plano");
  for (const [id, s] of Object.entries(montados.sistemaFamiliaQuadro)) assert.match(s, regra, id);
  assert.match(prompts.travadosDe({}).find((x) => x.id === "montagem_pedidos").texto, /6\.12\.81: a regra "ACENTUAÇÃO"/);
});

teste("6.12.81 (2): sigla curta nas Abreviações (siglaCurta, abreviacaoJogavel) e prompt com as expressões bíblicas conhecidas", () => {
  assert.equal(ger.MAX_INICIAIS_NA_SIGLA, 4);
  // Jogáveis: nomes, títulos e grupos conhecidos.
  for (const s of ["Os 12 A de C", "O P da P", "O C de D", "O L da V", "As B N da P", "O V U da P", "O P V de U", "200 C e 20 B", "100 T de P", "A.T.", "N de J"]) assert.equal(ger.siglaCurta(s), true, s);
  // Siglas de frases inteiras de versículos (as do Gemini 3.5 Flash) não valem.
  for (const s of ["T L C O N E D P", "P L U A O", "C A S U A O", "P P A A O", "P O E E P P A A T", "P D C A S I", "S P O A E T C", "F P A P C O S I"]) assert.equal(ger.siglaCurta(s), false, s);
  assert.equal(ger.siglaCurta("de da"), false, "sem nenhuma inicial");
  assert.equal(ger.siglaCurta(""), false);
  assert.equal(ger.siglaCurta("A B C D E"), false, "5 iniciais");
  assert.equal(ger.siglaCurta("A B C D"), true, "4 iniciais");
  // Jogável = curta e conferida palavra por palavra com a resposta.
  assert.equal(ger.abreviacaoJogavel("Os 12 A de C", "Os 12 Apóstolos de Cristo"), true);
  assert.equal(ger.abreviacaoJogavel("O P da P", "O Príncipe da Paz"), true);
  assert.equal(ger.abreviacaoJogavel("O P da P", "O Pai da Paz e da Vida"), false, "não confere com a resposta");
  assert.equal(ger.abreviacaoJogavel("T L C O N E D P", "Tão Longe Como O Nascente É Do Poente"), false, "confere, mas é longa demais");
  assert.equal(ger.confereAbreviacao("T L C O N E D P", "Tão Longe Como O Nascente É Do Poente"), true, "a conferência palavra por palavra continua a mesma");
  // O prompt do jogo e o servidor dizem o mesmo.
  const jogo = prompts.PARTES.find((x) => x.id === "adoracao_q_jogo").padrao;
  assert.match(jogo, /Abreviações bíblicas: use EXPRESSÕES BÍBLICAS CONHECIDAS/);
  assert.match(jogo, /NUNCA um pedaço de frase ou de versículo \(errado: "P L U A O"/);
  assert.match(jogo, /a sigla tem no MÁXIMO 4 iniciais \(o servidor tira a rodada com mais\)/);
  assert.doesNotMatch(jogo, /\bcultos?\b/i);
  assert.match(montados.sistemaFamiliaQuadro.jogo, /Abreviações com a sigla curta \(no máximo 4 iniciais; a rodada com mais sai\)/);
  assert.match(servidorJs, /!abreviacaoJogavel\(sigla, r\.resposta\)/);
  assert.ok(!servidorJs.includes("!confereAbreviacao(sigla, r.resposta)"), "o servidor não usa mais só a conferência palavra por palavra");
  assert.match(servidorJs, /abreviacoes: "a sigla na pergunta curta \(no máximo 4 iniciais\), de uma expressão bíblica conhecida/);
});

teste("6.12.81 (2): o jogo de Abreviações tira as siglas longas e o pedido de novo diz o que fazer", async () => {
  const ab = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Abreviações bíblicas (ex.: Os 12 A de C)"] }), montados);
  assert.ok(!ab.erro);
  const boas = [["O P da P", "O Príncipe da Paz", "Isaías 9:6"], ["O C de D", "O Cordeiro de Deus", "João 1:29"], ["O L da V", "O Livro da Vida", "Filipenses 4:3"], ["O P da V", "O Pão da Vida", "João 6:35"], ["A L do M", "A Luz do Mundo", "João 8:12"], ["Os 12 A de C", "Os 12 Apóstolos de Cristo", "Mateus 10:2"]];
  const longas = [["T L C O N E D P", "Tão Longe Como O Nascente É Do Poente", "Salmos 103:12"], ["P L U A O", "Perdoando-se Liberalmente Uns Aos Outros", "Efésios 4:32"], ["P P A A O", "Passar Por Alto A Ofensa", "Provérbios 19:11"]];
  const rodadas = [...longas.slice(0, 1), ...boas, ...longas.slice(1)].map(([pergunta, resposta, referencia]) => ({ pergunta, resposta, referencia }));
  const r = await ab.prep.montar({ descricao: "d", nome: "Abreviações", comoJogar: "R.", rodadas, eventos: [] });
  assert.equal(r.contagens.rodadas, 6, JSON.stringify(r.jogo && r.jogo.rodadas.map((x) => x.pergunta)));
  assert.equal(r.contagens.tiradas, 3, "as 3 siglas longas saem");
  assert.ok(!r.jogo.rodadas.some((x) => /T L C O|P L U A|P P A A/.test(x.pergunta)));
  assert.match(r.jogo.rodadas[0].pergunta, /^O que significa\? Dica 1: O P da P Dica 2: Está em Isaías\.$/);
  // 6 < 8: o pedido de novo traz a exigência nova.
  assert.match(r.falta, /^vieram 6 rodadas válidas; mande 10 rodadas \(no mínimo 8\)/);
  assert.match(r.falta, /a sigla na pergunta curta \(no máximo 4 iniciais\), de uma expressão bíblica conhecida \(nome, título ou grupo, nunca um pedaço de frase de versículo\)/);
});

teste("6.12.85: Abertura — matéria antes do relato e local exato da fonte (capítulo, parágrafo, página)", async () => {
  const { paginasDosCapitulos, localDoTrecho } = await import(new URL("api/_fontes.mjs", raiz));
  const sumario = ["Capítulo", "1 “Vejam! Este é o nosso Deus!” 7", "2 É mesmo possível ‘achegar-se a Deus’? 16", "SEÇÃO 1 — “Atemorizante poder”", "3 “Santo, santo, santo é Jeová” 26", "4 “Jeová é . . . grande em poder” 37"];
  const mapa = paginasDosCapitulos(sumario);
  assert.equal(mapa.get(2), 16);
  assert.equal(mapa.get(4), 37);
  assert.equal(paginasDosCapitulos(["1 Um 5", "2 Dois 9"]).size, 0, "menos de 3 capítulos: não vale");
  assert.equal(localDoTrecho({ capitulo: 5, numero: 3, pagina: 37 }), "cap. 5, par. 3, o capítulo começa na pág. 37");
  assert.equal(localDoTrecho({ numero: 12 }), "par. 12");
  assert.equal(localDoTrecho({}), "");
  assert.ok(servidorJs.includes("if (leitura) leitura.primeiro = true;"));
  assert.ok(servidorJs.includes("fonte: [l.livro, localDoTrecho({ ...l, numero: 0 })].filter(Boolean).join(\", \"), paragrafos: l.numero"));
  assert.ok(sessaoJs.includes("primeiro: p.leitura.primeiro === true"));
  assert.ok(appJs.includes("if (parte.leitura && parte.leitura.primeiro) { // 6.12.85"));
  assert.ok(appJs.indexOf("{ // 6.12.85: Abertura") < appJs.indexOf("addLista('📖 Textos para considerar'"));
});

teste("6.12.86: artigo da Abertura com dados da publicação, parágrafos e subtítulos, e botão de leitura do trecho", async () => {
  const wolJs = await readFile(new URL("api/_wol.mjs", raiz), "utf8");
  assert.ok(wolJs.includes('estruturado ? (caixa ? "# " : tag !== "p" || curtoSemPonto ? "## " : "") + texto : texto'));
  assert.ok(wolJs.includes('documentCitationInformation'));
  assert.ok(servidorJs.includes("estruturado: true"));
  assert.ok(servidorJs.includes("texto: leituraEmParagrafos(lido.texto)"));
  assert.ok(sessaoJs.includes("daLeitura"));
  assert.ok(appJs.includes("leitura: (pedacos, abrirRefs) => participarLeituraVozBotao(pedacos, undefined, abrirRefs)"));
  assert.ok(appJs.includes("fam-leitura-par fam-leitura-sub"));
  assert.ok(appJs.includes("aoVivo.leitura(pedacosVoz, iPrimeiraCurta)"));
});

teste("6.12.88: perguntas da leitura logo depois dela; 🔊 só ícone nos campos de texto (matéria, transcrição, letra)", async () => {
  assert.ok(servidorJs.includes("perguntasLeitura: daLeitura.length"));
  assert.ok(sessaoJs.includes("perguntasLeitura: Math.max(0"));
  assert.ok(sessaoJs.includes("textoDaSessaoParaLer(codigo, texto, origem = null)"));
  assert.ok(appJs.includes("addLista('❓ Perguntas sobre a matéria'"));
  assert.ok(appJs.indexOf("addLista('❓ Perguntas sobre a matéria'") < appJs.indexOf("addLista('📖 Textos para considerar'"));
  assert.ok(appJs.includes("participarVozNoCampo(t, "));
  assert.ok(appJs.includes("tipo: cantico ? 'cantico' : 'video'"));
  const css = await readFile(new URL("app.css", raiz), "utf8");
  assert.ok(!css.includes(".fam-leitura-voz { width: 100%"), "sem botão largo");
});

teste("6.12.89: a voz da adoração usa as regras de fala das referências bíblicas e o ícone fica dentro da moldura do campo", async () => {
  const vozJs = await readFile(new URL("api/voz.mjs", raiz), "utf8");
  assert.ok(appJs.includes("const falado = textoParaVoz(pedaco, pedaco === pedacos[abrirRefs]"));
  assert.ok(appJs.includes("{ origem, original: pedaco }"));
  assert.ok(appJs.includes("{ original: pergunta }"));
  assert.ok(appJs.includes("ptm.appendChild(aoVivo.leitura(pedacosVoz, iPrimeiraCurta))"));
  assert.ok(vozJs.includes("textoDaSessaoParaLer(body.sessao, original || texto, body.origem)"));
  assert.ok(vozJs.includes("texto.length > original.length * 2 + 120"));
});

teste("6.12.90: artigo inteiro (corte só entre seções), títulos e subtítulos, e perguntas de revisão escritas depois da leitura", async () => {
  const wolJs = await readFile(new URL("api/_wol.mjs", raiz), "utf8");
  const prompts = await import(new URL("api/_prompts.mjs", raiz));
  assert.ok(wolJs.includes("boxTtl"));
  assert.ok(wolJs.includes("curtoSemPonto"));
  assert.ok(servidorJs.includes("function leituraEmParagrafos(bruto, max = 7000)"));
  assert.ok(servidorJs.includes("maxCaracteres: 12000, estruturado: true"));
  assert.ok(servidorJs.includes("const perguntarLeituraFamilia = async (leitura, jaEscritas, quantas)"));
  assert.ok(servidorJs.includes("pd.ctx.perguntarLeitura = perguntarLeituraFamilia;"));
  assert.ok(servidorJs.includes("(await ctx.perguntarLeitura(leitura, [], 3)) || daLeitura"));
  assert.ok(servidorJs.includes("ctx.perguntarLeitura(leitura, [], 2)"));
  assert.ok(sessaoJs.includes("texto(p.leitura.texto, 8000)"));
  const parte = prompts.PARTES.find((x) => x.id === "adoracao_q_revisao");
  assert.ok(parte, "a parte existe");
  assert.match(parte.padrao, /EXPERIÊNCIA/);
  const cat = prompts.CATALOGO ? prompts.CATALOGO.find((x) => x.id === "adoracao_familia") : null;
  if (cat) assert.ok(cat.partes.includes("adoracao_q_revisao"));
  assert.ok(prompts.travadosDe({}).some((x) => x.id === "formato_familia_revisao_leitura"));
  assert.ok(appJs.includes("fam-leitura-par fam-leitura-sub fam-leitura-tit"));
});

teste("6.12.92: fonte, depois título (fora e dentro do campo), 🔊 na linha do título, links em moldura com rótulo padrão e objetivo da Abertura", async () => {
  const css = await readFile(new URL("app.css", raiz), "utf8");
  assert.ok(appJs.includes("const ROTULO_LINK_MATERIA = 'Abrir esta matéria na biblioteca wol.jw.org ↗';"));
  assert.ok(appJs.includes("a.textContent = ROTULO_LINK_MATERIA;"));
  assert.ok(appJs.includes("sm.textContent = '📖 Exibir e ler esta matéria aqui';"));
  // a fonte (ref) vem antes do título fora do campo, e o título antes do link
  const iRef = appJs.indexOf("lei.appendChild(ref);");
  const iTit = appJs.indexOf("lt.className = 'fam-secao-titulo fam-leitura-titulo-fora';");
  const iLink = appJs.indexOf("a.textContent = ROTULO_LINK_MATERIA;");
  assert.ok(iRef > 0 && iRef < iTit && iTit < iLink);
  assert.ok(appJs.includes("ptm.className = 'fam-leitura-materia';"));
  assert.ok(appJs.includes("acoes.push('ler juntos a matéria sugerida')"));
  assert.ok(appJs.includes("materiaPrimeiro ? 'os textos' : 'ler juntos os textos'"));
  assert.equal((appJs.match(/a.className = 'fam-link-moldura'/g) || []).length >= 4, true, "leitura, vídeo, cântico e publicação");
  assert.ok(/a.fam-link-moldura {[^}]*text-align: center/.test(css));
});

teste("6.12.94: Princípios Bíblicos em linhas, referência em negrito e a matéria antes dos textos", async () => {
  assert.ok(servidorJs.includes("function textoDoPrincipioEmLinhas(e)"));
  assert.ok(servidorJs.includes("texto: textoDoPrincipioEmLinhas(e), url: \"\", rotulo: \"Princípios Bíblicos para a Vida Cristã\", primeiro: true"));
  assert.ok(servidorJs.includes('"## Versículos citados"'));
  assert.ok(appJs.includes("par.match(/^\\*\\*(.+?)\\*\\*(.*)$/)"));
  assert.ok(sessaoJs.includes('.replace(/\\*\\*/g, "")'));
});

teste("6.12.96: o primeiro parágrafo curto da matéria vale como título e lê a referência depois do travessão", async () => {
  assert.ok(appJs.includes("function participarLeituraVozBotao(pedacos, origem, abrirRefs)"));
  assert.ok(appJs.includes("pedaco === pedacos[abrirRefs] ? Object.assign({}, regras, { pularRefs: false }) : regras"));
  assert.ok(appJs.includes("linhas[iLinha1].length <= 300 ? iLinha1 + 1 : -1"));
  assert.ok(appJs.includes("aoVivo.leitura(pedacosVoz, iPrimeiraCurta)"));
});

teste("6.12.97: programações salvas com só o título à vista, detalhes recolhidos e botões sempre visíveis", async () => {
  const css = await readFile(new URL("app.css", raiz), "utf8");
  assert.ok(appJs.includes("det.className = 'fam-salva-det';"));
  assert.ok(appJs.includes("const h = document.createElement('summary');"));
  assert.ok(appJs.includes("det.append(h, meta, tema);"));
  assert.ok(appJs.includes("det.appendChild(ul);") && appJs.includes("art.appendChild(det);"));
  assert.ok(appJs.includes("const familiaSalvasAbertas = new Set();"));
  assert.ok(css.includes(".fam-salva-det > summary.fam-salva-titulo"));
  // os botões (acoes) são filhos do cartão, fora do details
  assert.ok(appJs.indexOf("art.appendChild(det);") < appJs.indexOf("art.appendChild(acoes);", appJs.indexOf("art.appendChild(det);")));
});

teste("6.13.02: Ame o ministério sem raciocínio longo e leitura com a lição/matéria inteira (com FONTES_DIR)", async () => {
  assert.ok(servidorJs.includes("semPensar: true,"), "o quadro Ame o ministério pede sem raciocínio");
  assert.ok(servidorJs.includes("semPensar: pd.prep.semPensar === true"), "a geração do quadro respeita o pedido");
  assert.ok(servidorJs.includes("async function leituraCompletaDoTrecho(l)"));
  assert.equal(servidorJs.split("await leituraCompletaDoTrecho(").length - 1 >= 6, true, "abertura (2), personagem, jesus, criador, saiba e ministério");
  if (!comFontes) return console.log("      (sem FONTES_DIR: matéria real pulada)");
  const fontes = await import(new URL("api/_fontes.mjs", raiz));
  const nomes = ["ameAsPessoas", "testemunhoCabal", "melhoreLeitura", "beneficieEscola", "raciocinios"].map(fontes.nomeDoLivro);
  const r = await fontes.buscarNosLivros("pessoa com pressa ministério conversa pregação", { livros: nomes, max: 6, maxChars: 1200 });
  const th = r.find((l) => l.livro.includes("(th)"));
  if (th) {
    const m = await fontes.materiaDoTrecho(th);
    assert.ok(m && /^Lição \d+ — /.test(m.titulo), "a lição inteira do th");
    assert.ok(m.texto.length > th.trecho.length, "mais que o parágrafo solto");
    assert.ok(!/^## .*\d+:\d+/m.test(m.texto), "referência bíblica não vira subtítulo");
  }
  for (const l of r) {
    const m = await fontes.materiaDoTrecho(l);
    if (m) assert.ok(!/^\^ /m.test(m.texto), "sem notas de rodapé");
  }
});

teste("6.13.03: seção do livro pelo wol (capítulo, páginas e parágrafos), mínimo de 3 parágrafos, e vídeos alternando formatos", async () => {
  const wolJs = await readFile(new URL("api/_wol.mjs", raiz), "utf8");
  assert.ok(wolJs.includes("export async function secaoDoWolPelaFrase(frase"));
  assert.ok(servidorJs.includes("secaoDoWolPelaFrase(l.trecho, { timeoutMs: 8000, minParagrafos: 3, maxChars: 4500, sigla: siglaDoLivro(l.livro) })"));
  assert.ok(servidorJs.includes("const FORMATOS_VIDEO_FAMILIA = Object.freeze(["));
  assert.ok(servidorJs.includes("FORMATO DESTA NOITE:"));
  assert.ok(servidorJs.includes('["Programas e Eventos › Adorações Matinais", 15], ["Entrevistas e Casos Reais", 15]'));
  assert.ok(servidorJs.includes("videosQueCabem(lista, ctx.quadro.minutos, 5)"));
  const { videosQueCabem } = await import(new URL("api/_familiaGeracao.mjs", raiz));
  assert.equal(videosQueCabem([{ duracao: "7:00" }, { duracao: "7:30" }], 10, 5).length, 2, "dois vídeos somando 14:30 cabem");
  assert.equal(videosQueCabem([{ duracao: "9:00" }, { duracao: "8:00" }], 10, 5).length, 1, "17 min: fica só o primeiro");
  assert.equal(videosQueCabem([{ duracao: "15:40" }], 10, 5).length, 1, "um vídeo longo sozinho fica");
});

teste("6.13.05: circunstâncias de preparo para o casamento com rótulo discreto e descrição para a IA (visível na tela de prompts)", async () => {
  const prompts = await import(new URL("api/_prompts.mjs", raiz));
  const html = await readFile(new URL("index.html", raiz), "utf8");
  for (const rotulo of ["Preparar-se para formar uma família", "Apoiar os filhos jovens rumo à vida adulta", "Namoro e casamento segundo os padrões de Jeová"]) {
    assert.ok(html.includes(`value="${rotulo}"`), "na tela: " + rotulo);
    assert.ok(rotulo.length <= 80, "cabe no limite de 80 caracteres do servidor");
    assert.ok(prompts.DETALHES_CIRCUNSTANCIAS_FAMILIA[rotulo], "descrição para a IA: " + rotulo);
  }
  assert.match(prompts.DETALHES_CIRCUNSTANCIAS_FAMILIA["Apoiar os filhos jovens rumo à vida adulta"], /sem superproteção/);
  const travado = prompts.travadosDe({}).find((x) => x.id === "detalhes_circunstancias_familia");
  assert.ok(travado && /Preparar-se para formar uma família:/.test(travado.texto), "visível na tela de prompts");
  assert.ok(servidorJs.includes("circunstancias.map((c) => `- ${circunstanciaParaIa(c)}`)"));
  assert.ok(servidorJs.includes("circ.map(circunstanciaParaIa).join"));
});

teste("6.13.06: até 2 circunstâncias relacionadas (Luto sozinha, ministério só com ministério) e assunto ou circunstância obrigatório", async () => {
  const html = await readFile(new URL("index.html", raiz), "utf8");
  const bloco = html.slice(html.indexOf('id="familiaCircunstancias"'), html.indexOf('id="familiaOutrasCirc"'));
  const valores = [...bloco.matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
  const ini = appJs.indexOf("const FAMILIA_CIRC_GRUPOS");
  const fim = appJs.indexOf("function familiaCircAplicarLimite");
  const { familiaCircCompativeis, FAMILIA_CIRC_GRUPOS, FAMILIA_CIRC_PARES } = new Function(appJs.slice(ini, fim) + "; return { familiaCircCompativeis, FAMILIA_CIRC_GRUPOS, FAMILIA_CIRC_PARES };")();
  for (const c of [...FAMILIA_CIRC_GRUPOS.flat(), ...FAMILIA_CIRC_PARES.flat()]) assert.ok(valores.includes(c), "nome igual ao da tela: " + c);
  assert.equal(familiaCircCompativeis("Luto").size, 0);
  assert.equal(familiaCircCompativeis("Doença na família").size, 0);
  assert.deepEqual([...familiaCircCompativeis("Falta de ânimo para ministério")], ["Falta de ânimo para estudos e revisitas"]);
  // a relação é de mão dupla
  for (const a of valores) for (const b of familiaCircCompativeis(a)) assert.ok(familiaCircCompativeis(b).has(a), a + " <-> " + b);
  assert.ok(appJs.includes("i.disabled = !livre;"));
  assert.ok(appJs.includes("familiaCircAplicarLimite(e.target); familiaPerfilSalvar();"));
  assert.ok(appJs.includes("if (!assuntoValido && !perfil.circunstancias.length && !perfil.outrasCircunstancias) {"));
});

teste("6.13.08: andamento à esquerda com o tempo alinhado; ao terminar a lista fica (card) com Exibir e Iniciar", async () => {
  const css = await readFile(new URL("app.css", raiz), "utf8");
  assert.ok(appJs.includes("linha.append(icone, tempo, emo, nome);"));
  assert.ok(appJs.includes("exibir.textContent = '📄 Exibir a programação';"));
  assert.ok(appJs.includes("familiaBotaoCompartilhar(ger.op, familiaProgressoEl, ger.itemId, '▶️ Iniciar a adoração (gerar o código)')"));
  assert.ok(appJs.includes("if (ger.exibido) familiaRenderOpcoes([op], undefined, ger.itemId);"), "a programação só aparece depois de Exibir");
  assert.ok(!/const falhas = familiaFalhasTexto\(ger\);\s*if \(!falhas\) familiaProgressoLimpar\(\);/.test(appJs), "a lista não fecha mais ao terminar");
  assert.ok(css.includes(".fam-prog-lista > .fam-prog-item.ok { display: grid; width: auto; margin: 0; text-align: left; }"));
  assert.ok(/\.fam-prog-linha \{[^}]*grid-template-columns: 1\.4em 4\.2em 1\.6em minmax\(0, 1fr\)/.test(css));
});

teste("6.13.09: fonte exata em todo o módulo (busca no wol sem pontuação, só na mesma publicação, verbete e lição com página)", async () => {
  const wol = await import(new URL("api/_wol.mjs", raiz));
  const fontes = await import(new URL("api/_fontes.mjs", raiz));
  // frases sem pontuação (com vírgula a busca exata do wol não acha) e sem palavras quebradas do arquivo
  assert.deepEqual(wol.frasesParaBuscaNoWol("17 Primeiro, nos alegramos ao ver a mão de Jeová na obra. Quando pregamos a mensagem do Reino, estamos lançando sementes.", 2), ["Primeiro nos alegramos ao ver a mão de", "Quando pregamos a mensagem do Reino estamos lançando"]);
  assert.ok(!wol.frasesParaBuscaNoWol("Jeová não deseja que ningué m seja destruído por nada. Outra frase com cinco palavras aqui.", 3).some((f) => /ningué m/.test(f)));
  assert.equal(fontes.siglaDoLivro("O Reino de Deus Já Governa!"), "kr");
  assert.equal(fontes.siglaDoLivro("Mantenha-se no Amor de Deus (lv)"), "lv");
  assert.equal(fontes.siglaDoLivro("Raciocínios à Base das Escrituras"), "rs");
  assert.ok(servidorJs.includes("async function leituraDoVerbete(verbete, texto, sentido = 0)"));
  assert.ok(servidorJs.includes("(local não confirmado no wol.jw.org)"));
  assert.ok(servidorJs.includes("w.outraPublicacao"));
  assert.ok(servidorJs.includes("publicacoes: publicacaoDaLeitura(leitura, l)"));
  assert.ok(sessaoJs.includes("fonte: texto(u.fonte, 240)"));
});

teste("6.13.10: tempo do quadro Vídeo pela duração dos vídeos e \"Objetivo da matéria\" em toda leitura", async () => {
  const prompts = await import(new URL("api/_prompts.mjs", raiz));
  // um vídeo de 10:50 com 3 perguntas: 10,8 + 3 = 13,8 → 15 minutos; um de 4:00 com 2 perguntas: fica nos 10 do quadro
  const mins = (seg, perg, base = 10) => Math.max(base, Math.ceil((seg / 60 + perg) / 5) * 5);
  assert.equal(mins(650, 3), 15);
  assert.equal(mins(240, 2), 10);
  assert.ok(servidorJs.includes("const minutosVideo = Math.max(ctx.quadro.minutos, Math.ceil((segundosVideos / 60 + perguntasVideo.length) / 5) * 5);"));
  assert.ok(servidorJs.includes("return { minutos: minutosVideo,"));
  assert.ok(servidorJs.includes("if (montado.leitura && montado.leitura.texto && !montado.leitura.objetivo) await perguntarLeituraFamilia(montado.leitura, [], 0);"));
  assert.ok(servidorJs.includes("if (objetivo) leitura.objetivo = objetivo;"));
  assert.ok(servidorJs.includes("export const SaidaRevisaoLeitura = z.object({ objetivo: z.string(), perguntas: z.array(z.string()) });"));
  assert.match(prompts.PARTES.find((x) => x.id === "adoracao_q_revisao").padrao, /"objetivo": UMA frase/);
  assert.ok(sessaoJs.includes("objetivo: texto(p.leitura.objetivo, 400)"));
  assert.ok(appJs.includes("rot.textContent = 'Objetivo da matéria:';"));
  assert.ok(appJs.indexOf("lei.appendChild(lt);") < appJs.indexOf("rot.textContent = 'Objetivo da matéria:';"), "o objetivo vem depois da fonte e do título");
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
