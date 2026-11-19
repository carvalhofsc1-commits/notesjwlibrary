// Cria (ou atualiza) os segredos do NoteStyle no Secret Manager do Google Cloud a partir de um arquivo local (6.10.88).
// Uso, no PowerShell, na pasta do projeto:
//   node --env-file=.env.segredos ferramentas/criar-segredos.mjs
// O arquivo .env.segredos (fora do Git por causa de .env*) traz NOME=valor, um por linha. Para as chaves JSON do Google, em vez do
// valor use NOME_ARQUIVO=C:\caminho\do\arquivo.json (o script lê o arquivo). Linhas com o valor ainda em branco ou com "COLE_AQUI" são puladas.
// Os valores nunca aparecem na tela: vão direto para o gcloud pela entrada padrão.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const NOMES = [
  "CODIGO_ADMIN", "CODIGO_ESTUDO", "CODIGO_DIRIGENTE", "CODIGO_LEITURA", "CODIGO_RESUMO", "CODIGO_S34", "CODIGO_TEXTO",
  "ANTHROPIC_API_KEY", "ANTHROPIC_ADMIN_KEY", "CLAUDE_MODEL",
  "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "MERCADOPAGO_PAYER_EMAIL",
  "GOOGLE_TTS_CREDENCIAIS", "GOOGLE_STT_BUCKET", "GOOGLE_PROJECT_ID", "GOOGLE_TTS_API_KEY",
  "GOOGLE_ALT_CREDENCIAIS", "GOOGLE_ALT_STT_BUCKET", "GOOGLE_ALT_PROJECT_ID", "GOOGLE_ALT_TTS_API_KEY",
];

// Roda o gcloud (no Windows ele é um .cmd, chamado pelo cmd.exe); os argumentos são só nomes fixos, o valor vai pela entrada.
const WINDOWS = process.platform === "win32";
function gcloud(args, entrada) {
  const r = WINDOWS
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "gcloud", ...args], { input: entrada, encoding: "utf8" })
    : spawnSync("gcloud", args, { input: entrada, encoding: "utf8" });
  return { ok: r.status === 0, saida: `${r.stdout || ""}`.trim(), erro: `${r.stderr || ""}`.trim() };
}

const conf = gcloud(["config", "get-value", "project"]);
const projeto = conf.saida.split(/\r?\n/).pop();
if (!conf.ok || !/^[a-z][a-z0-9-]{4,}$/.test(projeto || "")) {
  console.error("Não consegui usar o gcloud. Confira se ele está instalado (abra um terminal novo depois de instalar) e se o projeto está escolhido:");
  console.error("  gcloud config set project notestyle-512212");
  process.exit(1);
}
console.log(`Projeto do gcloud: ${projeto}`);

const criados = [];
const pulados = [];
const falhas = [];
for (const nome of NOMES) {
  let valor = process.env[nome];
  const arquivo = process.env[`${nome}_ARQUIVO`];
  if (arquivo && arquivo.trim() && !/COLE_AQUI/i.test(arquivo)) {
    try {
      valor = readFileSync(arquivo.trim(), "utf8").replace(/^\uFEFF/, "");
    } catch (e) {
      falhas.push(`${nome} (não consegui ler o arquivo ${arquivo})`);
      continue;
    }
  }
  if (!valor || !valor.trim() || /COLE_AQUI/i.test(valor)) {
    pulados.push(nome);
    continue;
  }
  valor = valor.replace(/\r?\n$/, ""); // sem a quebra de linha do fim
  const existe = gcloud(["secrets", "describe", nome]).ok;
  if (!existe) {
    const c = gcloud(["secrets", "create", nome, "--replication-policy=automatic"]);
    if (!c.ok) {
      falhas.push(`${nome} (criar: ${(c.erro || c.saida).split(/\r?\n/).pop()})`);
      continue;
    }
  }
  const v = gcloud(["secrets", "versions", "add", nome, "--data-file=-"], valor);
  if (!v.ok) {
    falhas.push(`${nome} (gravar: ${(v.erro || v.saida).split(/\r?\n/).pop()})`);
    continue;
  }
  criados.push(nome);
  console.log(`${existe ? "atualizado" : "criado    "}  ${nome}`);
}

console.log("");
console.log(`Gravados: ${criados.length}. Pulados (sem valor): ${pulados.length}. Falhas: ${falhas.length}.`);
if (pulados.length) console.log(`Pulados: ${pulados.join(", ")}`);
if (falhas.length) {
  console.log(`Falhas: ${falhas.join(" | ")}`);
  process.exitCode = 1;
}
if (criados.length) {
  console.log("");
  console.log("Para o passo 8 (comando de publicação), use:");
  console.log(`--set-secrets ${criados.map((n) => `${n}=${n}:latest`).join(",")}`);
}
