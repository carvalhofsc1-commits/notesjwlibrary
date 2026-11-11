// Modelo da IA de texto (respostas do estudo, perguntas, formatação, comentários do texto diário), escolhido pelo
// administrador na tela de prompts e válido para todos os usuários. Fica no Global Config (chave "ia_config"); sem nada
// guardado, valem CLAUDE_MODEL e CLAUDE_EFFORT da Vercel ou, sem elas, o Haiku 5.5 com esforço baixo.
import { lerItem, gravarItem } from "./_armazem.mjs";

const CHAVE = "ia_config";
const VALIDADE_MS = 20_000;

// Preços da Anthropic em US$ por milhão de tokens (entrada / saída), para a tela comparar os modelos. O Haiku 5.5 vale
// para pedidos de até 100 mil tokens (os deste app são bem menores).
export const MODELOS_IA = [
  { id: "claude-haiku-5-5", nome: "Haiku 5.5: rápida e econômica", entrada: 0.1, saida: 0.5 },
  { id: "claude-sonnet-5-5", nome: "Sonnet 5.5: equilíbrio entre qualidade e custo", entrada: 2, saida: 10 },
  { id: "claude-opus-5-5", nome: "Opus 5.5: a mais potente para respostas", entrada: 4, saida: 20 },
  { id: "claude-fable-5-1", nome: "Fable 5.1: a mais capaz, mais lenta e mais cara", entrada: 10, saida: 50 },
];

// Esforço: quanto a IA pensa antes de responder (mais esforço = respostas mais cuidadosas, mais demora e mais custo).
export const ESFORCOS_IA = [
  { id: "low", nome: "Baixo: mais rápido e barato" },
  { id: "medium", nome: "Médio" },
  { id: "high", nome: "Alto: mais cuidadoso, demora mais" },
];

// De onde vem o Claude: a API direta da Anthropic ou o Google Cloud (Vertex AI), cobrado na conta do Google (ver api/_clienteIa.mjs).
export const PROVEDORES_IA = [
  { id: "anthropic", nome: "Anthropic (API direta)" },
  { id: "vertex", nome: "Google Cloud (Vertex AI, conta do Google)" },
];

export const PADRAO_IA = {
  modelo: MODELOS_IA.some((m) => m.id === process.env.CLAUDE_MODEL) ? process.env.CLAUDE_MODEL : "claude-haiku-5-5",
  esforco: ESFORCOS_IA.some((e) => e.id === process.env.CLAUDE_EFFORT) ? process.env.CLAUDE_EFFORT : "low",
};

// Mantém só valores conhecidos; o que faltar ou vier errado volta ao padrão. "esbocoModelo" e "esbocoEsforco" são o modelo e o esforço
// exclusivos da Preparação de discursos e esboços e do Preparar para dirigir; vazio ("") = usa o mesmo modelo (ou esforço) de todas as outras funções.
export function validarConfigIa(entrada) {
  const c = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : {};
  return {
    provedor: PROVEDORES_IA.some((p) => p.id === c.provedor) ? c.provedor : "anthropic",
    modelo: MODELOS_IA.some((m) => m.id === c.modelo) ? c.modelo : PADRAO_IA.modelo,
    esforco: ESFORCOS_IA.some((e) => e.id === c.esforco) ? c.esforco : PADRAO_IA.esforco,
    esbocoModelo: MODELOS_IA.some((m) => m.id === c.esbocoModelo) ? c.esbocoModelo : "",
    esbocoEsforco: ESFORCOS_IA.some((e) => e.id === c.esbocoEsforco) ? c.esbocoEsforco : "",
  };
}

// O modelo e o esforço de uma tarefa: os de esboços e discursos (se o administrador escolheu outros) ou os gerais.
// "estudo-perguntas" (perguntas adicionais do estudo de A Sentinela) e "ebc-dirigente" (Estudo Bíblico) são do Preparar para dirigir, que usa o mesmo modelo dos esboços.
export const TAREFAS_DE_ESBOCOS = new Set(["tesouros", "discurso", "publico", "outros", "estudo-perguntas", "ebc-dirigente", "estudo-recap"]);
export function iaDaTarefa(config, tarefa) {
  if (!TAREFAS_DE_ESBOCOS.has(tarefa)) return { ...config, modelo: config.modelo, esforco: config.esforco };
  return { ...config, modelo: config.esbocoModelo || config.modelo, esforco: config.esbocoEsforco || config.esforco };
}

export function opcoesIa() {
  return { modelos: MODELOS_IA, esforcos: ESFORCOS_IA, provedores: PROVEDORES_IA };
}

let cache = null;
// O provedor valendo agora (atualizado a cada leitura da configuração; todo pedido lê a configuração antes de chamar a IA).
let provedorEscolhido = "anthropic";
export const provedorAtual = () => provedorEscolhido;

export async function lerConfigIa() {
  if (cache && Date.now() - cache.em < VALIDADE_MS) {
    provedorEscolhido = cache.valor.provedor;
    return cache.valor;
  }
  let guardada = null;
  try {
    guardada = await lerItem(CHAVE);
  } catch {
    // sem armazenamento: valem os padrões
  }
  const valor = validarConfigIa(guardada);
  cache = { valor, em: Date.now() };
  provedorEscolhido = valor.provedor;
  return valor;
}

export async function gravarConfigIa(entrada) {
  const valor = validarConfigIa(entrada);
  await gravarItem(CHAVE, valor);
  cache = { valor, em: Date.now() };
  provedorEscolhido = valor.provedor;
  return valor;
}

// ---------- Gasto com a IA de texto (Cost API da Anthropic) ----------
// Só funciona com uma chave de administrador da Anthropic (ANTHROPIC_ADMIN_KEY, "sk-ant-admin..."), criada no Claude
// Console por quem administra a organização; a chave comum da IA não serve. Os valores chegam em centavos de dólar
// (texto decimal) e aparecem uns 5 minutos depois de cada pedido. Guardado por 1 minuto (a API pede no máximo uma
// consulta por minuto).
const URL_CUSTO = process.env.ANTHROPIC_COST_URL || "https://api.anthropic.com/v1/organizations/cost_report";
let custoGuardado = null;

export async function lerCustoIa() {
  if (!process.env.ANTHROPIC_ADMIN_KEY) return { configurado: false };
  if (custoGuardado && Date.now() - custoGuardado.em < 60_000) return custoGuardado.valor;

  const agora = new Date();
  const inicioDoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const amanha = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1));
  const hoje = amanha.getTime() - 24 * 60 * 60 * 1000;
  let total = 0;
  let deHoje = 0;
  const porModelo = new Map();
  let pagina = null;
  for (let volta = 0; volta < 5; volta++) {
    const busca = new URLSearchParams({ starting_at: inicioDoMes.toISOString(), ending_at: amanha.toISOString(), limit: "31" });
    busca.append("group_by[]", "description");
    if (pagina) busca.set("page", pagina);
    const resposta = await fetch(`${URL_CUSTO}?${busca}`, {
      headers: { "x-api-key": process.env.ANTHROPIC_ADMIN_KEY, "anthropic-version": "2023-06-01", "User-Agent": "NoteStyle/1.0 (https://notestyle.com.br)" },
      signal: AbortSignal.timeout(15_000),
    });
    let dados = null;
    try {
      dados = await resposta.json();
    } catch {
      // resposta sem JSON
    }
    if (!resposta.ok || !dados || !Array.isArray(dados.data)) {
      const e = new Error((dados && dados.error && dados.error.message) || `HTTP ${resposta.status}`);
      e.status = resposta.status;
      throw e;
    }
    for (const balde of dados.data) {
      const doDia = Date.parse(balde.starting_at) >= hoje;
      for (const item of balde.results || []) {
        const centavos = Number(item.amount) || 0;
        total += centavos;
        if (doDia) deHoje += centavos;
        const nome = item.model || (item.cost_type === "web_search" ? "Busca na web" : item.cost_type || "Outros");
        porModelo.set(nome, (porModelo.get(nome) || 0) + centavos);
      }
    }
    if (!dados.has_more || !dados.next_page) break;
    pagina = dados.next_page;
  }
  const dolares = (centavos) => Math.round(centavos) / 100;
  const valor = {
    configurado: true,
    mes: dolares(total),
    hoje: dolares(deHoje),
    porModelo: [...porModelo].map(([modelo, centavos]) => ({ modelo, valor: dolares(centavos) })).sort((a, b) => b.valor - a.valor),
    desde: inicioDoMes.toISOString().slice(0, 10),
    atualizadoEm: agora.toISOString(),
  };
  custoGuardado = { valor, em: Date.now() };
  return valor;
}
