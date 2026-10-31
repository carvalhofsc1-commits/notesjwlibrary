// Conta o resultado da avaliação cega: node avaliacao/contar.mjs avaliacao-AAAAMMDDHHMM
// Lê <nome>.chave.json (qual resposta tinha memória) e <nome>.escolhas.json (a sua escolha: 1, 2 ou empate).
import { readFile } from "node:fs/promises";

const nome = process.argv[2];
if (!nome) {
  console.error("Uso: node avaliacao/contar.mjs avaliacao-AAAAMMDDHHMM");
  process.exit(1);
}
const ler = async (sufixo) => JSON.parse(await readFile(new URL(`./resultados/${nome}.${sufixo}.json`, import.meta.url), "utf8"));
const chaves = await ler("chave");
const escolhas = await ler("escolhas");

const zero = () => ({ com_memoria: 0, sem_memoria: 0, empate: 0, semEscolha: 0 });
const total = zero();
const porGrupo = {};
for (const c of chaves) {
  const e = String(escolhas[c.id] || "").trim().toLowerCase();
  const g = (porGrupo[c.grupo] ||= zero());
  let quem;
  if (e === "1" || e === "2") quem = c.chave["resposta" + e];
  else if (e === "empate") quem = "empate";
  else quem = "semEscolha";
  total[quem]++;
  g[quem]++;
}
const linha = (t) => `com memória ${t.com_memoria} · sem memória ${t.sem_memoria} · empate ${t.empate}` + (t.semEscolha ? ` · sem escolha ${t.semEscolha}` : "");
console.log("Total:   " + linha(total));
for (const [g, t] of Object.entries(porGrupo)) console.log(`${g.padEnd(8)} ${linha(t)}`);
const decididos = total.com_memoria + total.sem_memoria;
console.log(
  decididos < 10
    ? "\nPoucos casos decididos: não conclua nada ainda (use pelo menos 20)."
    : `\n${Math.round((100 * total.com_memoria) / decididos)}% das escolhas decididas foram para a resposta com memória.`
);
