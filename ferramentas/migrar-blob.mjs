// Copia todos os arquivos privados do Vercel Blob para o bucket do Google Cloud Storage, com os mesmos caminhos (6.10.87).
// Pode rodar quantas vezes quiser: arquivo que já está igual no bucket (mesmo tamanho e gravado depois) é pulado.
// Uso (no computador, depois de "gcloud auth application-default login"):
//   node --env-file=.env.migracao ferramentas/migrar-blob.mjs
// O arquivo .env.migracao (fora do Git) traz BLOB_READ_WRITE_TOKEN (da Vercel) e GCS_BUCKET (ex.: notestyle-dados-pessoal).
import { get, list } from "@vercel/blob";
import { Storage } from "@google-cloud/storage";

const token = process.env.BLOB_READ_WRITE_TOKEN;
const nomeBucket = process.env.GCS_BUCKET;
if (!token || !nomeBucket) {
  console.error("Faltam BLOB_READ_WRITE_TOKEN e/ou GCS_BUCKET no arquivo .env.migracao.");
  process.exit(1);
}

const bucket = new Storage().bucket(nomeBucket);
const [existentes] = await bucket.getFiles();
const noGoogle = new Map(existentes.map((f) => [f.name, { tamanho: Number(f.metadata.size) || 0, quando: Date.parse(f.metadata.updated || 0) || 0 }]));
console.log(`Bucket ${nomeBucket}: ${noGoogle.size} arquivos antes da cópia.`);

let cursor;
let total = 0;
let copiados = 0;
let iguais = 0;
const falhas = [];
do {
  const pagina = await list({ token, cursor, limit: 1000 });
  for (const b of pagina.blobs) {
    total++;
    const g = noGoogle.get(b.pathname);
    if (g && g.tamanho === b.size && g.quando >= new Date(b.uploadedAt).getTime()) {
      iguais++;
      continue;
    }
    try {
      const r = await get(b.pathname, { access: "private", token, useCache: false });
      if (!r || r.statusCode !== 200) throw new Error(`resposta ${r ? r.statusCode : "vazia"}`);
      const conteudo = Buffer.from(await new Response(r.stream).arrayBuffer());
      const tipo = (r.blob && r.blob.contentType) || b.contentType || "application/octet-stream";
      await bucket.file(b.pathname).save(conteudo, { resumable: false, contentType: tipo, metadata: { cacheControl: "no-store" } });
      copiados++;
      console.log(`copiado  ${b.pathname}  (${conteudo.length} bytes)`);
    } catch (e) {
      falhas.push(b.pathname);
      console.error(`FALHOU   ${b.pathname}: ${e && e.message}`);
    }
  }
  cursor = pagina.hasMore ? pagina.cursor : undefined;
} while (cursor);

const [depois] = await bucket.getFiles();
console.log("");
console.log(`Vercel Blob: ${total} arquivos. Copiados agora: ${copiados}. Já iguais: ${iguais}. Falhas: ${falhas.length}.`);
console.log(`Bucket ${nomeBucket}: ${depois.length} arquivos depois da cópia.`);
if (falhas.length) {
  console.log("Rode de novo para tentar as falhas:", falhas.join(", "));
  process.exitCode = 1;
}
