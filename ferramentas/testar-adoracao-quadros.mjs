// Teste da Adoração em Família por quadros (partes puras, sem IA e sem rede). Cresce a cada fase da refatoração.
// Fase 1 (6.12.69): constante única das 10 prioridades de aplicação prática e prioridadesAplicaveis(perfil).
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
