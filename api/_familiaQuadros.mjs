// Adoração em Família por quadros (6.12.70): o catálogo único dos quadros da programação, os 6 tipos de jogo aceitos e a leitura do pedido
// (quadros marcados, cânticos inicial e final, jogos), com a migração dos perfis antigos (atividades, jogos, duracao, quantidade).
// O app tem uma cópia do essencial (id, nome, emoji, minutos, obrigatorio, ligadoAoTema) e da migração em app.js, entre os marcadores
// "// <quadros-familia>" e "// </quadros-familia>"; o teste ferramentas/testar-adoracao-quadros.mjs confere que as duas cópias são iguais.
// As fontes são chaves de LIVROS em _fontes.mjs (nomeDoLivro) e, em "outras", as fontes que não são livros da busca.

const congelar = (o) => Object.freeze(o);

export const QUADROS_FAMILIA = Object.freeze(
  [
    {
      id: "oracao_inicial",
      nome: "Oração inicial",
      emoji: "🙏",
      minutos: null,
      obrigatorio: true,
      ligadoAoTema: false,
      fontes: { livros: [], outras: [] },
      perguntasPadrao: [],
      maxPerguntas: 0,
      saida: "Nunca designar quem ora; sem boas-vindas separadas.",
    },
    {
      id: "abertura",
      nome: "Abertura",
      emoji: "📖",
      minutos: 10,
      obrigatorio: true,
      ligadoAoTema: true,
      fontes: {
        livros: ["organizados", "mantenhaSeNoAmorDeDeus", "reinoDeDeus", "adoracaoPura", "achegueSeAJeova", "vocePodeTerFamiliaFeliz", "familiaFeliz", "jovensPerguntamV1", "jovensPerguntamV2"],
        outras: ["ensinosBiblicos"],
      },
      perguntasPadrao: [],
      maxPerguntas: 3,
      saida: "Leitura de um trecho da publicação ou do artigo com até 3 perguntas, e um relato bíblico ligado ao tema com até 2 perguntas.",
    },
    {
      id: "video",
      nome: "Vídeo",
      emoji: "🎬",
      minutos: 10,
      obrigatorio: true,
      ligadoAoTema: true,
      fontes: { livros: [], outras: ["catalogoDeVideos"] },
      perguntasPadrao: [],
      maxPerguntas: 3,
      saida: "1 ou 2 vídeos ligados ao tema, com até 3 perguntas de consideração.",
    },
    {
      id: "principio",
      nome: "Princípio bíblico",
      emoji: "🧭",
      minutos: 5,
      obrigatorio: true,
      ligadoAoTema: true,
      fontes: { livros: ["principiosBiblicos"], outras: ["principios"] },
      perguntasPadrao: ["Que princípio podemos extrair do(s) texto(s) acima?", "Em que situações práticas esse princípio pode nos orientar?"],
      maxPerguntas: 2,
      saida: "1 ou 2 princípios do índice; o servidor transcreve o texto literal e os versículos.",
    },
    {
      id: "personagem",
      nome: "Personagem do dia",
      emoji: "👤",
      minutos: 5,
      obrigatorio: true,
      ligadoAoTema: true,
      fontes: { livros: ["imiteSuaFe", "historiasDaBiblia", "andeCorajosamente"], outras: ["perspicaz"] },
      perguntasPadrao: ["Que lições aprendemos da história de [nome]?"],
      maxPerguntas: 1,
      saida: "Um personagem de preferência pouco conhecido, com o trecho bíblico da história.",
    },
    {
      id: "jesus",
      nome: "Lições da vida de Jesus",
      emoji: "✨",
      minutos: 5,
      obrigatorio: true,
      ligadoAoTema: true,
      fontes: { livros: ["venhaSerMeuSeguidor", "jesusOCaminho"], outras: [] },
      perguntasPadrao: [],
      maxPerguntas: 2,
      saida: "Um episódio da vida de Jesus com lição sobre o tema, com o trecho bíblico.",
    },
    {
      id: "criador",
      nome: "Fortaleça sua fé no Criador",
      emoji: "🔬",
      minutos: 5,
      obrigatorio: false,
      ligadoAoTema: false,
      fontes: { livros: ["vidaTeveUmCriador", "origemDaVida"], outras: ["ensinosBiblicosCiencia"] },
      perguntasPadrao: [],
      maxPerguntas: 2,
      saida: "Um ponto em que a ciência concorda com a Bíblia ou mostra que a vida não surgiu por acaso (desvinculado do tema).",
    },
    {
      id: "saiba_responder",
      nome: "Saiba responder",
      emoji: "❓",
      minutos: 5,
      obrigatorio: false,
      ligadoAoTema: true,
      fontes: {
        livros: ["raciocinios", "perguntasFrequentesTj", "perguntasBiblicasRespondidas", "glossarioNwt", "apendiceABibliaEstudo", "apendiceBBibliaEstudo", "apendiceCBibliaEstudo", "organizados"],
        outras: ["perspicaz"],
      },
      perguntasPadrao: [],
      maxPerguntas: 1,
      saida: "Uma pergunta que as pessoas fazem, com a base (Bíblia ou matéria) e o link para consulta.",
    },
    {
      id: "ame_ministerio",
      nome: "Ame o ministério",
      emoji: "🚪",
      minutos: 5,
      obrigatorio: false,
      ligadoAoTema: true,
      fontes: { livros: ["ameAsPessoas", "testemunhoCabal", "melhoreLeitura", "beneficieEscola", "raciocinios"], outras: ["apostilaVidaMinisterio"] },
      perguntasPadrao: [],
      maxPerguntas: 2,
      saida: "Uma situação do ministério com 1 ou 2 perguntas sobre como proceder e a matéria sugerida.",
    },
    {
      id: "jogo",
      nome: "Jogo bíblico",
      emoji: "🎲",
      minutos: 10,
      obrigatorio: false,
      ligadoAoTema: true,
      fontes: { livros: ["organizados"], outras: ["todasAsPublicacoes"] },
      perguntasPadrao: [],
      maxPerguntas: 0,
      saida: "Um dos 6 tipos aceitos, pronto, nível de adulto batizado.",
    },
    {
      id: "canticos",
      nome: "Treino de cânticos",
      emoji: "🎵",
      minutos: 5,
      obrigatorio: false,
      ligadoAoTema: true,
      fontes: { livros: [], outras: ["canticos"] },
      perguntasPadrao: [],
      maxPerguntas: 0,
      saida: "Um cântico ligado a um assunto ou personagem da noite, com o vídeo para tocar no app.",
    },
    {
      id: "oracao_final",
      nome: "Oração final",
      emoji: "🙏",
      minutos: null,
      obrigatorio: true,
      ligadoAoTema: false,
      fontes: { livros: [], outras: [] },
      perguntasPadrao: [],
      maxPerguntas: 0,
      saida: "",
    },
  ].map((q) => congelar({ ...q, fontes: congelar({ livros: congelar(q.fontes.livros), outras: congelar(q.fontes.outras) }), perguntasPadrao: congelar(q.perguntasPadrao) }))
);

export const IDS_QUADROS = Object.freeze(QUADROS_FAMILIA.map((q) => q.id));
export const QUADROS_OBRIGATORIOS = Object.freeze(QUADROS_FAMILIA.filter((q) => q.obrigatorio).map((q) => q.id));

// Os 6 tipos de jogo aceitos (os mesmos textos da tela). Os nomes antigos que mudaram ficam em NOMES_ANTIGOS_DOS_JOGOS (migração).
export const JOGOS_FAMILIA = Object.freeze([
  "Quem sou eu? (personagens bíblicos)",
  "Verdadeiro ou falso",
  "Ordem e data dos acontecimentos",
  "Quem disse isso? (frases da Bíblia)",
  "Complete o versículo",
  "Abreviações bíblicas (ex.: Os 12 A de C)",
]);
export const NOMES_ANTIGOS_DOS_JOGOS = Object.freeze({ "Ordem dos acontecimentos": "Ordem e data dos acontecimentos" });

// Os minutos dos quadros marcados (as orações não entram).
export function minutosDosQuadros(ids) {
  const marcados = new Set(Array.isArray(ids) ? ids : []);
  return QUADROS_FAMILIA.reduce((s, q) => s + (marcados.has(q.id) && q.minutos ? q.minutos : 0), 0);
}

// O pedido (ou o perfil salvo no aparelho) -> { quadros (ids na ordem fixa, com os obrigatórios), canticoInicial, canticoFinal, jogos }.
// Pedido novo: "quadros" com ids. Pedido ou perfil antigo (sem "quadros"): as "atividades" marcadas decidem os opcionais (jogos -> Jogo bíblico;
// "Treino dos cânticos" -> Treino de cânticos); sem nenhuma lista de atividades, valem os obrigatórios e o Jogo bíblico (o padrão de antes,
// que tinha as quatro atividades). Os jogos aceitos ficam só entre os 6 (nomes antigos renomeados); sem nenhum, valem os 6.
export function quadrosDoPedido(body) {
  const b = body && typeof body === "object" ? body : {};
  const atividades = (Array.isArray(b.atividades) ? b.atividades : []).map((a) => String(a || "").trim()).filter(Boolean);
  let marcados;
  if (Array.isArray(b.quadros)) marcados = new Set(b.quadros.filter((id) => IDS_QUADROS.includes(id)));
  else if (Array.isArray(b.atividades)) {
    marcados = new Set();
    if (atividades.some((a) => /^jogos?\b/i.test(a))) marcados.add("jogo");
    if (atividades.some((a) => /treino d[oe]s? c[aâ]nticos/i.test(a))) marcados.add("canticos");
  } else marcados = new Set(["jogo"]);
  for (const id of QUADROS_OBRIGATORIOS) marcados.add(id);
  const quadros = IDS_QUADROS.filter((id) => marcados.has(id));
  const legadoAmbos = Boolean(b.canticosInicioFim);
  const canticoInicial = Boolean(b.canticoInicial) || legadoAmbos || atividades.some((a) => /^c[aâ]ntico\s+inicial$/i.test(a));
  const canticoFinal = Boolean(b.canticoFinal) || legadoAmbos || atividades.some((a) => /^c[aâ]ntico\s+final$/i.test(a));
  const jogosBrutos = (Array.isArray(b.jogos) ? b.jogos : []).map((j) => NOMES_ANTIGOS_DOS_JOGOS[j] || j);
  let jogos = JOGOS_FAMILIA.filter((j) => jogosBrutos.includes(j));
  if (!jogos.length) jogos = JOGOS_FAMILIA.slice();
  return { quadros, canticoInicial, canticoFinal, jogos };
}
