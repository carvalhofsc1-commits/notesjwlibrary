// Avaliação da memória de lições: roda os mesmos pedidos SEM e COM as lições e grava os pares, em ordem sorteada, para você escolher
// a melhor resposta sem saber qual é qual (avaliação cega).
//
//   node avaliacao/rodar.mjs [--simular] [--grupo ajuste|reserva] [--so id1,id2]
//
// Precisa de ANTHROPIC_API_KEY (cada caso faz 2 chamadas à IA: tem custo) e de acesso às lições: BLOB_READ_WRITE_TOKEN (as lições da
// produção) ou MEMORIA_DIR (pasta local com licoes.json). Com --simular nada é enviado à IA e se mostra só o que seria enviado.
// As respostas aqui são em TEXTO (sem o JSON da produção): servem para comparar conteúdo, enfoque e estilo, não o formato técnico.
// Os casos (avaliacao/casos.json) e os resultados (avaliacao/resultados/) não vão para o GitHub.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { blocoLicoesPara } from "../api/_memoria.mjs";
import { lerConfigIa } from "../api/_iaConfig.mjs";
import { montarPrompts } from "../api/_prompts.mjs";

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const valor = (nome) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : null);
const grupo = valor("--grupo");
const so = valor("--so") ? valor("--so").split(",") : null;

const NOTA_AVALIACAO = "\n\n(Avaliação: escreva só o texto da resposta, em português, sem JSON.)";

let bruto;
try {
  bruto = await readFile(new URL("./casos.json", import.meta.url), "utf8");
} catch {
  console.error("Falta avaliacao/casos.json (copie avaliacao/casos.exemplo.json e preencha).");
  process.exit(1);
}
const casos = (JSON.parse(bruto).casos || []).filter((c) => (!grupo || c.grupo === grupo) && (!so || so.includes(c.id)));
if (!casos.length) {
  console.error("Nenhum caso para rodar com esses filtros.");
  process.exit(1);
}

const prompts = montarPrompts({}, {});
const modelo = process.env.CLAUDE_MODEL || (await lerConfigIa()).modelo;
console.log(`Modelo: ${modelo} · casos: ${casos.length} · ${simular ? "SIMULAÇÃO (nada é enviado)" : "chamadas reais (2 por caso)"}`);

let client = null;
if (!simular) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY.");
    process.exit(1);
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  client = new Anthropic({ maxRetries: 1, timeout: 120_000 });
}

async function responder(system, entrada) {
  if (simular) return "(simulação: sem resposta)";
  const r = await client.messages.create({ model: modelo, max_tokens: 3000, system, messages: [{ role: "user", content: entrada + NOTA_AVALIACAO }] });
  return r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

const resultados = [];
for (const caso of casos) {
  const base = prompts[caso.prompt || "sistemaSentinela"];
  if (!base) {
    console.error(`Caso ${caso.id}: prompt "${caso.prompt}" não existe em montarPrompts.`);
    continue;
  }
  const memoria = await blocoLicoesPara(caso.tarefa || "sentinela");
  const [sem, com] = await Promise.all([responder(base, caso.entrada), responder(base + (memoria.texto || ""), caso.entrada)]);
  // Sorteio de qual resposta aparece como "1": quem avalia não sabe qual tem memória.
  const comPrimeiro = randomInt(2) === 0;
  resultados.push({
    id: caso.id,
    grupo: caso.grupo || "ajuste",
    licoesUsadas: memoria.usadas,
    o_que_observar: caso.o_que_observar || "",
    entrada: caso.entrada,
    resposta1: comPrimeiro ? com : sem,
    resposta2: comPrimeiro ? sem : com,
    chave: { resposta1: comPrimeiro ? "com_memoria" : "sem_memoria", resposta2: comPrimeiro ? "sem_memoria" : "com_memoria" },
  });
  console.log(`  ✓ ${caso.id} (${memoria.usadas} lição(ões) no prompt)`);
}

const agora = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const pasta = new URL("./resultados/", import.meta.url);
await mkdir(pasta, { recursive: true });
const nomeBase = `avaliacao-${agora}`;

// Arquivo para ler e avaliar (sem a chave), arquivo da chave (não abra antes de escolher) e arquivo das escolhas (você preenche).
const md = [
  `# Avaliação cega — ${agora}`,
  "",
  `Para cada caso, leia as duas respostas e escreva em ${nomeBase}.escolhas.json (ao lado deste arquivo) a melhor: 1, 2 ou empate. Depois rode: node avaliacao/contar.mjs ${nomeBase}`,
  "",
  ...resultados.flatMap((r) => [
    `## ${r.id} (${r.grupo})`,
    r.o_que_observar ? `*Observar:* ${r.o_que_observar}` : "",
    "",
    "**Pedido**",
    "",
    r.entrada,
    "",
    "**Resposta 1**",
    "",
    r.resposta1,
    "",
    "**Resposta 2**",
    "",
    r.resposta2,
    "",
    "---",
    "",
  ]),
].join("\n");
await writeFile(new URL(`${nomeBase}.md`, pasta), md, "utf8");
await writeFile(new URL(`${nomeBase}.chave.json`, pasta), JSON.stringify(resultados.map(({ id, grupo, licoesUsadas, chave }) => ({ id, grupo, licoesUsadas, chave })), null, 2), "utf8");
await writeFile(new URL(`${nomeBase}.escolhas.json`, pasta), JSON.stringify(Object.fromEntries(resultados.map((r) => [r.id, ""])), null, 2), "utf8");
console.log(`\nPronto. Leia: avaliacao/resultados/${nomeBase}.md\nPreencha: avaliacao/resultados/${nomeBase}.escolhas.json  (1, 2 ou empate)\nDepois: node avaliacao/contar.mjs ${nomeBase}`);
