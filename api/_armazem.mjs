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

  const enviar = (caminho, operacao) =>
    fetch(`https://api.vercel.com/v1/${caminho}/${id}/items${consulta}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: operacao, key: chave, value: valor }] }),
    });

  // A operação "upsert" não serve para chaves novas, e "update" num item que não existe responde 404 ou 400
  // ("Can not update non-existing..."): então atualiza e, se o item não existir, cria (e, se alguém criou ao mesmo
  // tempo, atualiza de novo). A Vercel também renomeou Edge Config para Global Config e os dois caminhos da API
  // convivem: tenta um e, se ele recusar, o outro, e só então desiste (contando o que cada um respondeu).
  const falhas = [];
  for (const caminho of ["global-config", "edge-config"]) {
    let operacao = "update";
    let resposta = await enviar(caminho, operacao);
    if (resposta.ok) return;

    let texto = await resposta.text();
    if (resposta.status === 404 || (resposta.status === 400 && /non-existing|not found|does not exist/i.test(texto))) {
      operacao = "create";
      resposta = await enviar(caminho, operacao);
      if (resposta.ok) return;

      texto = await resposta.text();
      if (resposta.status === 409 || (resposta.status === 400 && /already exists|exists/i.test(texto))) {
        operacao = "update";
        resposta = await enviar(caminho, operacao);
        if (resposta.ok) return;
        texto = await resposta.text();
      }
    }

    falhas.push(`${caminho}/${operacao} -> ${resposta.status}: ${texto.slice(0, 160)}`);
  }
  throw new Error(`A Vercel recusou a gravação (${falhas.join(" | ")}).`);
}

// Resumo, sem segredos, do que o token de escrita enxerga: dono, escopos, função na equipe e se vê o armazenamento.
// Serve para entender uma recusa de permissão ao gravar; só é mostrado ao administrador, na mensagem de erro.
export async function diagnosticar() {
  const token = process.env.VERCEL_API_TOKEN;
  const id = idDoArmazenamento();
  const equipe = process.env.VERCEL_TEAM_ID;
  if (!token) return "sem VERCEL_API_TOKEN";

  const consulta = equipe ? `?teamId=${encodeURIComponent(equipe)}` : "";
  const partes = [];
  const pedir = async (rotulo, url) => {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        partes.push(`${rotulo} ${r.status}`);
        return null;
      }
      return await r.json();
    } catch (e) {
      partes.push(`${rotulo} falhou`);
      return null;
    }
  };

  const info = await pedir("token", "https://api.vercel.com/v5/user/tokens/current");
  if (info) {
    const t = info.token || info;
    const escopos = Array.isArray(t.scopes) ? t.scopes.map((e) => `${e.type}:${e.teamId || e.origin || "?"}`).join(",") : "?";
    partes.push(`escopos=[${escopos}]`);
  }
  const eu = await pedir("usuario", "https://api.vercel.com/v2/user");
  if (eu && eu.user) partes.push(`usuario=${eu.user.username}`);

  if (equipe) {
    const t = await pedir("equipe", `https://api.vercel.com/v2/teams/${encodeURIComponent(equipe)}`);
    if (t) partes.push(`funcao=${(t.membership && t.membership.role) || "?"}`);
  }

  if (id) {
    const loja = await pedir("armazenamento", `https://api.vercel.com/v1/edge-config/${id}${consulta}`);
    if (loja) partes.push(`armazenamento visivel (dono=${loja.ownerId || "?"})`);
    const itens = await pedir("itens", `https://api.vercel.com/v1/edge-config/${id}/items${consulta}`);
    if (itens) partes.push(`itens=${Array.isArray(itens) ? itens.length : "?"}`);
  }
  return partes.join("; ");
}
