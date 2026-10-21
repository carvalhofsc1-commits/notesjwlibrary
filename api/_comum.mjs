// Funções compartilhadas pelas rotas da API (o "_" no nome impede a Vercel de publicar este arquivo como rota).
import { createHash, timingSafeEqual } from "node:crypto";

export function origemPermitida(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    // Nome antigo do projeto (notesjwlibrary) e o novo (notestyle), com os endereços de prévia de cada um.
    return (
      hostname === "notesjwlibrary.vercel.app" ||
      hostname === "notestyle.vercel.app" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^(notesjwlibrary|notestyle)-[a-z0-9-]+\.vercel\.app$/.test(hostname)
    );
  } catch {
    return false;
  }
}

export function erro(res, status, mensagem) {
  res.status(status).json({ erro: mensagem });
}

// Código do dirigente (variável CODIGO_DIRIGENTE na Vercel): libera as opções de preparação para dirigir. Enquanto a variável
// não existir, vale o código de pesquisa (CODIGO_ESTUDO), para o recurso já funcionar; criada a variável, só o código dela serve.
export function codigoDoDirigente() {
  return process.env.CODIGO_DIRIGENTE || process.env.CODIGO_ESTUDO || "";
}

// Compara dois textos sem vazar, pelo tempo de resposta, quantos caracteres coincidem.
export function textosIguais(informado, esperado) {
  if (!esperado || typeof informado !== "string") return false;
  const hash = (texto) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(hash(informado), hash(String(esperado)));
}
