// Armazenamento das configurações que o administrador edita pelo app (prompts da IA e modelos padrão), no Vercel
// Global Config (antes chamado Edge Config).
//  - Leitura: a variável GLOBAL_CONFIG (ou EDGE_CONFIG, nome antigo), criada quando o armazenamento é conectado ao
//    projeto, traz o endereço e o token de leitura; a leitura é um GET simples nesse endereço.
//  - Escrita: API da Vercel, com um token em VERCEL_API_TOKEN (e VERCEL_TEAM_ID, porque o projeto é de uma equipe).
// Sem nada disso configurado o app continua funcionando com os textos e arquivos que acompanham o código.
// ARMAZEM_TESTE=memoria troca tudo por um Map em memória (só para testes locais).

const memoria = new Map();
const emTeste = () => process.env.ARMAZEM_TESTE === "memoria";

function conexao() {
  return process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG || "";
}

export function leituraDisponivel() {
  return emTeste() || Boolean(conexao());
}

export function escritaDisponivel() {
  return emTeste() || Boolean(conexao() && process.env.VERCEL_API_TOKEN);
}

function idDoArmazenamento() {
  const m = /ecfg_[A-Za-z0-9]+/.exec(conexao());
  return m ? m[0] : null;
}

// Devolve o valor guardado ou null (inclusive quando o armazenamento não está configurado ou falha).
export async function lerItem(chave) {
  if (emTeste()) return memoria.has(chave) ? memoria.get(chave) : null;

  const texto = conexao();
  if (!texto) return null;
  try {
    const endereco = new URL(texto);
    const token = endereco.searchParams.get("token");
    if (!token) return null;
    const resposta = await fetch(`${endereco.origin}${endereco.pathname.replace(/\/$/, "")}/item/${encodeURIComponent(chave)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const valor = await resposta.json();
    return valor === undefined ? null : valor;
  } catch (e) {
    console.error("Falha ao ler o Global Config:", e && e.message);
    return null;
  }
}

export async function gravarItem(chave, valor) {
  if (emTeste()) {
    memoria.set(chave, valor);
    return;
  }

  const id = idDoArmazenamento();
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) throw new Error("O armazenamento não tem permissão de escrita no servidor.");

  const equipe = process.env.VERCEL_TEAM_ID;
  const consulta = equipe ? `?teamId=${encodeURIComponent(equipe)}` : "";
  const corpo = JSON.stringify({ items: [{ operation: "upsert", key: chave, value: valor }] });

  // A Vercel renomeou Edge Config para Global Config; tenta o caminho novo e, se ele não existir, o antigo.
  let ultimo = null;
  for (const caminho of ["global-config", "edge-config"]) {
    const resposta = await fetch(`https://api.vercel.com/v1/${caminho}/${id}/items${consulta}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: corpo,
    });
    if (resposta.ok) return;
    ultimo = `${resposta.status}: ${(await resposta.text()).slice(0, 200)}`;
    if (resposta.status !== 404) break;
  }
  throw new Error(`A Vercel recusou a gravação (${ultimo}).`);
}
