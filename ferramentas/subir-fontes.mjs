// Envia arquivos .txt de uma pasta para fontes/ no Vercel Blob (privado) e no Google Cloud Storage.
// Uso (token e bucket vêm do .env.migracao; NÃO imprimir o conteúdo do .env):
//   node --env-file=.env.migracao ferramentas/subir-fontes.mjs <pasta-com-os-txt>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { put } from "@vercel/blob";
import { Storage } from "@google-cloud/storage";

const pasta = resolve(process.argv[2] || "");
const token = process.env.BLOB_READ_WRITE_TOKEN;
const nomeBucket = process.env.GCS_BUCKET || "notestyle-dados-pessoal";

if (!pasta) {
  console.error("Uso: node --env-file=.env.migracao ferramentas/subir-fontes.mjs <pasta-com-os-txt>");
  process.exit(1);
}
if (!token) {
  console.error("Falta BLOB_READ_WRITE_TOKEN (use --env-file=.env.migracao).");
  process.exit(1);
}

const arquivos = readdirSync(pasta)
  .filter((n) => n.endsWith(".txt") && !n.startsWith("_"))
  .filter((n) => statSync(join(pasta, n)).isFile())
  .sort((a, b) => a.localeCompare(b, "pt"));

if (!arquivos.length) {
  console.error("Nenhum .txt na pasta:", pasta);
  process.exit(1);
}

console.log(`Pasta: ${pasta}`);
console.log(`Arquivos: ${arquivos.length}`);
console.log(`GCS bucket: ${nomeBucket}`);
console.log("");

const bucket = new Storage().bucket(nomeBucket);
let okBlob = 0;
let okGcs = 0;
const falhas = [];

for (const nome of arquivos) {
  const caminhoLocal = join(pasta, nome);
  const destino = `fontes/${nome}`;
  const conteudo = readFileSync(caminhoLocal);
  const kb = (conteudo.length / 1024).toFixed(1);

  try {
    await put(destino, conteudo, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain; charset=utf-8",
      token,
    });
    okBlob++;
    console.log(`Vercel Blob OK  ${destino} (${kb} KB)`);
  } catch (e) {
    falhas.push(`blob:${destino}`);
    console.error(`Vercel Blob FALHOU  ${destino}: ${e?.message || e}`);
  }

  try {
    await bucket.file(destino).save(conteudo, {
      resumable: false,
      contentType: "text/plain; charset=utf-8",
      metadata: { cacheControl: "no-store" },
    });
    okGcs++;
    console.log(`GCS OK         ${destino} (${kb} KB)`);
  } catch (e) {
    falhas.push(`gcs:${destino}`);
    console.error(`GCS FALHOU         ${destino}: ${e?.message || e}`);
  }
}

console.log("");
console.log(`Resumo: Blob ${okBlob}/${arquivos.length} · GCS ${okGcs}/${arquivos.length} · falhas ${falhas.length}`);
if (falhas.length) {
  console.error("Falhas:", falhas.join(", "));
  process.exitCode = 1;
}
