// Resultado dos pedidos demorados (esboços e Preparar para dirigir), guardado por algumas horas no Vercel Blob PRIVADO (o mesmo store das
// fontes e do S-34, variável BLOB_READ_WRITE_TOKEN). O app manda um "pedidoId" aleatório junto com o pedido; se a conexão cair no meio
// (no iPhone, ao sair do app ou bloquear a tela, a espera é cortada, mas o servidor continua e termina o esboço), o app pergunta pelo
// resultado com esse id quando volta e mostra o esboço normalmente. O arquivo começa com "_" para a Vercel não publicá-lo como rota.
import { del, get, list, put } from "@vercel/blob";

const PASTA = "pedidos/";
const VALIDADE_MS = 6 * 3600_000; // os resultados que ninguém buscou são apagados depois de 6 horas
const memoria = new Map(); // ARMAZEM_TESTE=memoria: testes locais
const emTeste = () => process.env.ARMAZEM_TESTE === "memoria";
const token = () => process.env.BLOB_READ_WRITE_TOKEN;

export const idDePedidoValido = (id) => typeof id === "string" && /^[A-Za-z0-9-]{16,64}$/.test(id);
export const pedidosDisponiveis = () => emTeste() || Boolean(token());

export async function guardarResultado(id, status, dados) {
  const registro = { status, dados, em: Date.now() };
  if (emTeste()) {
    memoria.set(id, registro);
    return;
  }
  await put(PASTA + id + ".json", JSON.stringify(registro), {
    access: "private",
    token: token(),
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
  if (Math.random() < 0.1) limparAntigos().catch((e) => console.error("Pedidos: limpeza falhou", e && e.message));
}

export async function lerResultado(id) {
  if (emTeste()) return memoria.get(id) || null;
  const resultado = await get(PASTA + id + ".json", { access: "private", token: token(), useCache: false }).catch((e) => {
    if (e && /not\s*found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw e;
  });
  if (!resultado || resultado.statusCode !== 200) return null;
  return JSON.parse(await new Response(resultado.stream).text());
}

export async function apagarResultado(id) {
  if (emTeste()) {
    memoria.delete(id);
    return;
  }
  await del(PASTA + id + ".json", { token: token() }).catch(() => {});
}

async function limparAntigos() {
  const { blobs } = await list({ prefix: PASTA, token: token(), limit: 200 });
  const velhos = blobs.filter((b) => Date.now() - new Date(b.uploadedAt).getTime() > VALIDADE_MS).map((b) => b.url);
  if (velhos.length) await del(velhos, { token: token() });
}
