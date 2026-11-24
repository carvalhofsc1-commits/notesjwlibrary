// Teste da Adoração em Família por quadros (partes puras, sem IA e sem rede). Cresce a cada fase da refatoração.
// Fase 1 (6.12.69): constante única das 10 prioridades de aplicação prática e prioridadesAplicaveis(perfil).
// Fase 2 (6.12.70): catálogo dos quadros (api/_familiaQuadros.mjs), cópia igual no app.js, migração dos perfis antigos, tela e prompt.
// Fase 3a (6.12.71): candidatos (princípios e artigos), escolhas da IA, formatos zod, montagem no app, fases no servidor e prompts.
// Fase 3b (6.12.72): quadros próprios (Vídeo, Criador, Saiba responder, Ame o ministério, Jogo, Cânticos), memória "evitar", repetição,
// datas do Apêndice B, corte no fim da frase e o item interno da memória no app.
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
  const ids = ["adoracao_q_base", "adoracao_q_plano", "adoracao_q_abertura", "adoracao_q_principio", "adoracao_q_personagem", "adoracao_q_jesus", "adoracao_q_video", "adoracao_q_criador", "adoracao_q_saiba", "adoracao_q_ministerio", "adoracao_q_jogo", "adoracao_q_canticos"];
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
  assert.deepEqual([...ger.CATEGORIAS_EVITAR], ["assuntos", "personagens", "principios", "jesus", "saiba", "ministerio", "criador", "artigos", "canticos", "jogos", "videos", "leituras", "relatos"]);
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
  assert.match(s.jogo, /de 8 a 12 "rodadas" \(no mínimo 8/);
  assert.match(s.jogo, /SEM RESPOSTAS ÓBVIAS/);
  assert.match(s.jogo, /de 6 a 8 identificadores \[B#\]/);
  assert.match(s.ministerio, /SÓ sobre COMO PROCEDER/);
  assert.match(s.ministerio, /Nunca perguntas sobre sentimentos/);
  assert.match(s.abertura, /Fuja das leituras e dos relatos bíblicos já usados/);
  assert.match(s.video, /até 12 minutos/);
  // As partes editáveis e os formatos não dizem "culto" (o sistema montado traz o VOCABULÁRIO, que cita a palavra para proibi-la).
  for (const id of ["adoracao_q_personagem", "adoracao_q_jogo", "adoracao_q_ministerio", "adoracao_q_abertura", "adoracao_q_video", "adoracao_q_criador", "adoracao_q_saiba"]) assert.doesNotMatch(prompts.PARTES.find((x) => x.id === id).padrao, /\bcultos?\b/i, id);
  for (const t of prompts.travadosDe({}).filter((x) => /^formato_familia_quadro_/.test(x.id))) assert.doesNotMatch(String(t.texto || t.padrao || ""), /\bcultos?\b/i, t.id);
  assert.match(QUADROS_FAMILIA.find((q) => q.id === "personagem").saida, /ilustre o ângulo/);
});

teste("6.12.73: jogo pede de novo quando faltam rodadas (8) ou acontecimentos (6)", async () => {
  const pedido = await montarPedidoQuadroFamilia(corpoFamilia({ quadro: "jogo", jogos: ["Verdadeiro ou falso"] }), montados);
  assert.ok(!pedido.erro);
  const rodada = (i) => ({ pergunta: `Afirmação ${i}`, resposta: i % 2 ? "Verdadeiro" : "Falso", referencia: "Gênesis 1:1" });
  const curta = await pedido.prep.montar({ descricao: "d", nome: "V ou F", comoJogar: "Regras.", rodadas: [1, 2, 3].map(rodada), eventos: [] });
  assert.match(curta.falta, /^vieram 3 rodadas válidas; mande de 8 a 12 rodadas, em nível de adulto batizado/);
  const cheia = await pedido.prep.montar({ descricao: "d", nome: "V ou F", comoJogar: "Regras.", rodadas: [1, 2, 3, 4, 5, 6, 7, 8].map(rodada), eventos: [] });
  assert.equal(cheia.falta, "");
  assert.equal(cheia.contagens.rodadas, 8);
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
  assert.match(mefi.leitura.fonte, /\(sentido 2\)$/);
  assert.match(mefi.leitura.texto, /^Filho de Jonatã/);
  assert.equal(mefi.contagens.sentido, 2);
  const abigail = await pedido.prep.montar({ nome: "Abigail", referencia: "1 Samuel 25:14-35", descricao: "d", escolha: null, verbete: "Abigail" });
  assert.equal(abigail.textos[0].referencia, "1 Samuel 25:14-35");
  assert.match(abigail.leitura.fonte, /\(sentido 1\)$/);
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
    assert.doesNotMatch(parte.leitura.texto, /(^|\n)\s*(##|•)/);
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
  assert.match(servidorJs, /const semTexto = fontesConfiguradas\(\) \? parte\.textos\.filter\(\(t\) => t && t\.referencia && !t\.texto\)/);
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
