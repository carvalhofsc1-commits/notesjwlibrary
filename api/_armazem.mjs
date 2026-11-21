// Armazenamento das configurações que o administrador edita pelo app (prompts da IA e modelos padrão).
// Cada chave vira um arquivo JSON "config/armazem/<chave>.json" no mesmo armazenamento dos arquivos privados (api/_blob.mjs: bucket do
// Google Cloud Storage em produção, pasta local nos testes), com um cache curto em memória.
// Sem armazenamento configurado o app continua funcionando com os textos e arquivos que acompanham o código.
// ARMAZEM_TESTE=memoria troca tudo por um Map em memória (só para testes locais).
import { blobConfigurado, get as blobGet, put as blobPut } from "./_blob.mjs";

const memoria = new Map();
const emTeste = () => process.env.ARMAZEM_TESTE === "memoria";
const arquivoDaChave = (chave) => `config/armazem/${encodeURIComponent(chave)}.json`;
const cacheBlob = new Map(); // chave -> { em, valor }
const VALIDADE_CACHE_MS = 15_000;

export function leituraDisponivel() {
  return emTeste() || blobConfigurado();
}

export function escritaDisponivel() {
  return emTeste() || blobConfigurado();
}

// Devolve o valor guardado ou null (inclusive quando o armazenamento não está configurado ou falha).
export async function lerItem(chave) {
  if (emTeste()) return memoria.has(chave) ? memoria.get(chave) : null;
  if (!blobConfigurado()) return null;
  const guardado = cacheBlob.get(chave);
  if (guardado && Date.now() - guardado.em < VALIDADE_CACHE_MS) return guardado.valor;
  try {
    const r = await blobGet(arquivoDaChave(chave), { access: "private", useCache: false });
    const valor = r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : null;
    cacheBlob.set(chave, { em: Date.now(), valor });
    return valor;
  } catch (e) {
    console.error("Falha ao ler a configuração no armazenamento:", e && e.message);
    return null;
  }
}

export async function gravarItem(chave, valor) {
  if (emTeste()) {
    memoria.set(chave, valor);
    return;
  }
  if (!blobConfigurado()) throw new Error("O armazenamento não está configurado no servidor.");
  await blobPut(arquivoDaChave(chave), JSON.stringify(valor), { access: "private", contentType: "application/json", allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 0 });
  cacheBlob.set(chave, { em: Date.now(), valor });
}

// Resumo, sem segredos, do armazenamento em uso; só é mostrado ao administrador, na mensagem de erro de uma gravação.
export async function diagnosticar() {
  if (emTeste()) return "armazenamento em memória (teste)";
  if (String(process.env.HOSPEDAGEM || "").toLowerCase() === "local") return "armazenamento local (teste)";
  return `Cloud Storage (${blobConfigurado() ? "configurado" : "sem GCS_BUCKET"})`;
}
