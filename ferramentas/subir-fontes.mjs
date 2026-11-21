// Envia arquivos .txt de uma pasta para fontes/ no Google Cloud Storage (bucket privado do NoteStyle).
// Uso (depois de "gcloud auth application-default login"):
//   node ferramentas/subir-fontes.mjs <pasta-com-os-txt>
// O bucket vem de GCS_BUCKET (padrão: notestyle-dados-pessoal). Cada publicação nova também precisa entrar em api/_fontes.mjs.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Storage } from "@google-cloud/storage";

if (!process.argv[2]) {
  console.error("Uso: node ferramentas/subir-fontes.mjs <pasta-com-os-txt>");
  process.exit(1);
}
const pasta = resolve(process.argv[2]);
const nomeBucket = process.env.GCS_BUCKET || "notestyle-dados-pessoal";

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
console.log(`Bucket: ${nomeBucket}`);
console.log("");

const bucket = new Storage().bucket(nomeBucket);
let ok = 0;
const falhas = [];

for (const nome of arquivos) {
  const destino = `fontes/${nome}`;
  const conteudo = readFileSync(join(pasta, nome));
  const kb = (conteudo.length / 1024).toFixed(1);
  try {
    await bucket.file(destino).save(conteudo, {
      resumable: false,
      contentType: "text/plain; charset=utf-8",
      metadata: { cacheControl: "no-store" },
    });
    ok++;
    console.log(`OK       ${destino} (${kb} KB)`);
  } catch (e) {
    falhas.push(destino);
    console.error(`FALHOU   ${destino}: ${e?.message || e}`);
  }
}

console.log("");
console.log(`Resumo: ${ok}/${arquivos.length} enviados · falhas ${falhas.length}`);
if (falhas.length) {
  console.error("Falhas:", falhas.join(", "));
  process.exitCode = 1;
}
