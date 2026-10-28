// Configuração da leitura em voz alta (botão 🔊 Ouvir), escolhida pelo administrador e válida para todos os usuários:
// modelo (qualidade), voz, tom, altura, velocidade padrão, o que ler e pular, e instruções extras. Fica no Global Config
// (chave "voz_config"); sem nada guardado, valem os padrões abaixo.
import { lerItem, gravarItem } from "./_armazem.mjs";

const CHAVE = "voz_config";
const VALIDADE_MS = 20_000;
const MAX_EXTRA = 400;

// Modelos da API Text-to-Speech do Google. Os Gemini seguem a instrução de leitura (tom, altura, instruções extras);
// o Chirp 3 HD é o mais simples e lê sem instruções.
export const MODELOS_VOZ = [
  { id: "gemini-3.1-flash", nome: "Gemini 3.1 Flash: a mais nova, segue as instruções de leitura", modelo: "gemini-3.1-flash-tts-preview", gemini: true },
  { id: "gemini-2.5-pro", nome: "Gemini 2.5 Pro: a mais expressiva, custa mais", modelo: "gemini-2.5-pro-tts", gemini: true },
  { id: "gemini-2.5-flash", nome: "Gemini 2.5 Flash: segue as instruções de leitura", modelo: "gemini-2.5-flash-tts", gemini: true },
  { id: "chirp", nome: "Chirp 3 HD: a mais simples e barata, não segue as instruções", modelo: null, gemini: false },
];

// As 30 vozes (as mesmas no Gemini e no Chirp 3 HD), com o jeito de cada uma.
export const VOZES = [
  ["Achernar", "F", "suave"], ["Aoede", "F", "leve"], ["Autonoe", "F", "clara"], ["Callirrhoe", "F", "tranquila"],
  ["Despina", "F", "macia"], ["Erinome", "F", "nítida"], ["Gacrux", "F", "madura"], ["Kore", "F", "firme"],
  ["Laomedeia", "F", "animada"], ["Leda", "F", "jovem"], ["Pulcherrima", "F", "expressiva"], ["Sulafat", "F", "calorosa"],
  ["Vindemiatrix", "F", "gentil"], ["Zephyr", "F", "brilhante"],
  ["Achird", "M", "amigável"], ["Algenib", "M", "rouca"], ["Algieba", "M", "macia"], ["Alnilam", "M", "firme"],
  ["Charon", "M", "informativa"], ["Enceladus", "M", "sussurrada"], ["Fenrir", "M", "empolgada"], ["Iapetus", "M", "nítida"],
  ["Orus", "M", "firme"], ["Puck", "M", "animada"], ["Rasalgethi", "M", "informativa"], ["Sadachbia", "M", "viva"],
  ["Sadaltager", "M", "experiente"], ["Schedar", "M", "equilibrada"], ["Umbriel", "M", "tranquila"], ["Zubenelgenubi", "M", "descontraída"],
].map(([nome, genero, jeito]) => ({ nome, genero, jeito }));

// Tom e altura: cada um corresponde a um item da parte "frases_voz" da tela dos prompts.
export const TONS = [
  { id: "calmo", nome: "Calmo e respeitoso", item: "Tom: calmo e respeitoso" },
  { id: "caloroso", nome: "Caloroso e animado", item: "Tom: caloroso e animado" },
  { id: "serio", nome: "Sério e firme", item: "Tom: sério e firme" },
  { id: "narracao", nome: "Narração", item: "Tom: narração" },
];
export const ALTURAS = [
  { id: "natural", nome: "Natural", item: null },
  { id: "grave", nome: "Um pouco mais grave", item: "Altura: mais grave" },
  { id: "aguda", nome: "Um pouco mais aguda", item: "Altura: mais aguda" },
];
export const VELOCIDADES = [0.85, 1, 1.15, 1.3];
// Como ler as referências bíblicas: "Primeira Coríntios treze, quatro a sete" (curta), "…, capítulo 13, versículos 4 a 7"
// (extenso) ou como estão escritas.
export const FORMATOS_REFS = ["curta", "extenso", "original"];

export const PADRAO_VOZ = {
  modelo: "gemini-3.1-flash",
  voz: "Achernar",
  tom: "calmo",
  altura: "natural",
  velocidade: 1,
  formatoRefs: "curta",
  pularRefs: false,
  pularFontes: true,
  pularParenteses: false,
  pularCabecalhos: false,
  extra: "",
};

// Mantém só valores conhecidos; o que faltar ou vier errado volta ao padrão.
export function validarConfigVoz(entrada) {
  const c = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : {};
  const escolher = (valor, opcoes, padrao) => (opcoes.includes(valor) ? valor : padrao);
  return {
    modelo: escolher(c.modelo, MODELOS_VOZ.map((m) => m.id), PADRAO_VOZ.modelo),
    voz: escolher(c.voz, VOZES.map((v) => v.nome), PADRAO_VOZ.voz),
    tom: escolher(c.tom, TONS.map((t) => t.id), PADRAO_VOZ.tom),
    altura: escolher(c.altura, ALTURAS.map((a) => a.id), PADRAO_VOZ.altura),
    velocidade: escolher(Number(c.velocidade), VELOCIDADES, PADRAO_VOZ.velocidade),
    // Configuração antiga (antes da 4.8.2) tinha só "refsExtenso": desmarcada, as referências eram lidas como escritas.
    formatoRefs: escolher(c.formatoRefs, FORMATOS_REFS, c.refsExtenso === false ? "original" : PADRAO_VOZ.formatoRefs),
    pularRefs: c.pularRefs === true,
    pularFontes: typeof c.pularFontes === "boolean" ? c.pularFontes : PADRAO_VOZ.pularFontes,
    pularParenteses: c.pularParenteses === true,
    pularCabecalhos: c.pularCabecalhos === true,
    extra: typeof c.extra === "string" ? c.extra.replace(/\s+/g, " ").trim().slice(0, MAX_EXTRA) : "",
  };
}

// O que o navegador precisa para preparar o texto antes de mandar (o resto fica só no servidor).
export function configPublicaVoz(c) {
  const modelo = MODELOS_VOZ.find((m) => m.id === c.modelo) || MODELOS_VOZ[0];
  const tom = TONS.find((x) => x.id === c.tom);
  const altura = ALTURAS.find((x) => x.id === c.altura);
  return {
    // Só para mostrar no tocador (o nome, a qualidade, o tom e a altura da voz que o administrador escolheu). Tom e altura só valem nos modelos
    // Gemini: o Chirp 3 HD não segue instruções.
    descricao: {
      voz: c.voz,
      qualidade: modelo.nome.split(":")[0],
      gemini: modelo.gemini,
      tom: modelo.gemini && tom ? tom.nome : null,
      altura: modelo.gemini && altura ? altura.nome : null,
    },
    velocidade: c.velocidade,
    formatoRefs: c.formatoRefs,
    pularRefs: c.pularRefs,
    pularFontes: c.pularFontes,
    pularParenteses: c.pularParenteses,
    pularCabecalhos: c.pularCabecalhos,
  };
}

export function opcoesVoz() {
  return {
    modelos: MODELOS_VOZ.map(({ id, nome }) => ({ id, nome })),
    vozes: VOZES,
    tons: TONS.map(({ id, nome }) => ({ id, nome })),
    alturas: ALTURAS.map(({ id, nome }) => ({ id, nome })),
    velocidades: VELOCIDADES,
  };
}

let cache = null;

export async function lerConfigVoz() {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.valor;
  let guardada = null;
  try {
    guardada = await lerItem(CHAVE);
  } catch {
    // sem armazenamento: valem os padrões
  }
  const valor = validarConfigVoz(guardada);
  cache = { valor, em: Date.now() };
  return valor;
}

export async function gravarConfigVoz(entrada) {
  const valor = validarConfigVoz(entrada);
  await gravarItem(CHAVE, valor);
  cache = { valor, em: Date.now() };
  return valor;
}
