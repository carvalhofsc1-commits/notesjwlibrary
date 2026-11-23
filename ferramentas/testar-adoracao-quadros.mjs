// Teste da Adoração em Família por quadros (partes puras, sem IA e sem rede). Cresce a cada fase da refatoração.
// Fase 1 (6.12.69): constante única das 10 prioridades de aplicação prática e prioridadesAplicaveis(perfil).
// Fase 2 (6.12.70): catálogo dos quadros (api/_familiaQuadros.mjs), cópia igual no app.js, migração dos perfis antigos, tela e prompt.
// Fase 3a (6.12.71): candidatos (princípios e artigos), escolhas da IA, formatos zod, montagem no app, fases no servidor e prompts.
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

teste("constantes: quadros gerados = os 10 com minutos; especializados da 3a; 4 em paralelo (servidor e app)", () => {
  assert.deepEqual([...ger.QUADROS_GERADOS], QUADROS_FAMILIA.filter((q) => q.minutos).map((q) => q.id));
  assert.equal(ger.QUADROS_GERADOS.length, 10);
  assert.deepEqual([...ger.QUADROS_ESPECIALIZADOS], ["abertura", "principio", "personagem", "jesus"]);
  for (const id of ger.QUADROS_ESPECIALIZADOS) assert.match(servidorJs, new RegExp(`\\n  async ${id}\\(ctx\\) \\{`), "PREPARAR_QUADRO_FAMILIA." + id);
  assert.equal(ger.MAX_QUADROS_EM_PARALELO, 4);
  assert.match(appJs, /const FAMILIA_QUADROS_EM_PARALELO = 4;/);
});

teste("formatos (zod): plano e cada quadro aceitam uma saída de exemplo e recusam a incompleta", () => {
  const plano = { titulo: "Perdoar como Jeová", emoji: "🕊️", resumo: "r", objetivo: "o", assunto: "perdão", angulos: [{ quadro: "abertura", angulo: "a" }], preparacao: [], tarefas: [{ membro: "Pai", tarefa: "ler" }], dicaParaOChefe: null, canticoInicial: 12, canticoFinal: null };
  assert.ok(SaidaPlanoFamilia.safeParse(plano).success);
  assert.ok(!SaidaPlanoFamilia.safeParse({ ...plano, angulos: undefined }).success);
  const exemplos = {
    abertura: { descricao: "d", escolhas: ["A1"], perguntasLeitura: ["p"], relato: { referencia: "Gên 50:15-21", perguntas: ["q"] } },
    principio: { descricao: "d", escolhas: ["PR1"] },
    personagem: { nome: "José", referencia: "Gên 45:1-15", descricao: "d", escolha: null, verbete: "José" },
    jesus: { episodio: "O filho pródigo", referencia: "Lu 15:11-32", qualidade: "misericórdia", descricao: "d", escolha: "L1", perguntas: [] },
    generico: { descricao: "d", textos: ["Jo 3:16"], videos: ["V1"], canticos: [3], publicacoes: [], perguntas: [], jogo: null },
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
  const ajuste = servidorJs.slice(servidorJs.indexOf("async function ajustarProgramaFamilia"), servidorJs.indexOf("async function ajustarProgramaFamilia") + 600);
  assert.match(ajuste, /\.slice\(0, 16\)/);
  assert.match(servidorJs, /const quadroFamilia = tarefa === "adoracao-familia" && body\.fase === "quadro";/);
  assert.match(servidorJs, /excedeuLimite\(quadroFamilia \? ip \+ "\|quadro" : ip, quadroFamilia \? P\.limites\.limitePorHora \* 4 : P\.limites\.limitePorHora\)/);
  assert.match(sessaoJs, /rotulo: texto\(p\.leitura\.rotulo, 80\)/);
  // Nada do perfil no log dos quadros: só contagens.
  const logs = servidorJs.split("\n").filter((l) => /console\.log\("Adoração em Família \((plano|quadro)\)/.test(l));
  assert.equal(logs.length, 2);
  for (const l of logs) assert.doesNotMatch(l, /apelido|perfil\.assunto[^)]|membros\.map|circunstancias/);
});

teste("prompts dos quadros: partes editáveis na categoria, sem \"culto\", sistemas montados com vocabulário, fontes e formato travado", () => {
  const ids = ["adoracao_q_base", "adoracao_q_plano", "adoracao_q_abertura", "adoracao_q_principio", "adoracao_q_personagem", "adoracao_q_jesus", "adoracao_q_generico"];
  const cat = prompts.CATEGORIAS.find((c) => (c.partes || []).includes("adoracao_familia"));
  assert.ok(cat, "categoria da Adoração");
  for (const id of ids) {
    const p = prompts.PARTES.find((x) => x.id === id);
    assert.ok(p && typeof p.padrao === "string" && p.padrao.length >= 20, id);
    assert.doesNotMatch(p.padrao, /culto/i, id);
    assert.ok(cat.partes.includes(id), id + " fora da categoria");
  }
  const travados = prompts.travadosDe({}).map((t) => t.id);
  for (const id of ["formato_familia_plano", "formato_familia_quadro_abertura", "formato_familia_quadro_principio", "formato_familia_quadro_personagem", "formato_familia_quadro_jesus", "formato_familia_quadro_generico"]) assert.ok(travados.includes(id), id);
  const vocab = /VOCABULÁRIO \(regra fixa, vale sempre\)/;
  const fontes = /FONTES: PRIORIDADE E ATUALIDADE/;
  assert.match(montados.sistemaFamiliaPlano, vocab);
  assert.match(montados.sistemaFamiliaPlano, fontes);
  assert.deepEqual(Object.keys(montados.sistemaFamiliaQuadro).sort(), ["abertura", "generico", "jesus", "personagem", "principio"]);
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
