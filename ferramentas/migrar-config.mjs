// Copia as configurações que o administrador edita no app (prompts, modelos de IA, voz, faturamento, conta do Google…) do Vercel
// Global Config para o bucket do Google Cloud Storage: cada chave vira "config/armazem/<chave>.json", o formato que api/_armazem.mjs
// lê com HOSPEDAGEM=gcp (6.10.87). Pode rodar de novo: regrava todas as chaves com o valor atual da Vercel.
// Uso (no computador, depois de "gcloud auth application-default login"):
//   node --env-file=.env.migracao ferramentas/migrar-config.mjs
// O arquivo .env.migracao (fora do Git) traz GLOBAL_CONFIG (a conexão, copiada da Vercel) e GCS_BUCKET.
import { Storage } from "@google-cloud/storage";

const conexao = process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG;
const nomeBucket = process.env.GCS_BUCKET;
if (!conexao || !nomeBucket) {
  console.error("Faltam GLOBAL_CONFIG e/ou GCS_BUCKET no arquivo .env.migracao.");
  process.exit(1);
}

const endereco = new URL(conexao);
const tokenLeitura = endereco.searchParams.get("token");
if (!tokenLeitura) {
  console.error("A conexão do GLOBAL_CONFIG não tem o token de leitura (…?token=…).");
  process.exit(1);
}
const resposta = await fetch(`${endereco.origin}${endereco.pathname.replace(/\/$/, "")}/items`, { headers: { Authorization: `Bearer ${tokenLeitura}` } });
if (!resposta.ok) {
  console.error(`O Global Config respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  process.exit(1);
}
const itens = await resposta.json();
const chaves = Object.keys(itens || {});
console.log(`Global Config: ${chaves.length} chaves.`);

const bucket = new Storage().bucket(nomeBucket);
for (const chave of chaves) {
  const texto = JSON.stringify(itens[chave]);
  await bucket.file(`config/armazem/${encodeURIComponent(chave)}.json`).save(texto, { resumable: false, contentType: "application/json", metadata: { cacheControl: "no-store" } });
  console.log(`copiada  ${chave}  (${texto.length} caracteres)`);
}
console.log("");
console.log(`Pronto: ${chaves.length} chaves gravadas em gs://${nomeBucket}/config/armazem/.`);
