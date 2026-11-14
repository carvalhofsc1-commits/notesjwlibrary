// Matérias da wol.jw.org que o servidor consulta SOZINHO ao elaborar um esboço de "Outros esboços" (api/sugerir-formatacao.mjs):
//  1) sem esboço da organização e sem artigos informados pelo orador: pesquisa o tema e a ideia na wol e usa os melhores resultados;
//  2) com esboço da organização que cita publicações: procura essas publicações na wol, seção por seção (a publicação citada, se a
//     pesquisa a achar pela data e pelas páginas; senão, a matéria mais próxima do assunto da seção).
// O arquivo começa com "_" para a Vercel não publicá-lo como rota. Só devolve endereços e avisos: a leitura dos artigos é de quem chama.
import { pesquisarNoWol } from "./_wol.mjs";
import { publicacoesDaSecao } from "./_s34.mjs";

export const MAX_AUTO_SEM_BASE = 3; // matérias lidas quando o orador não trouxe nenhuma
export const MAX_AUTO_COM_BASE = 6; // matérias lidas por causa das publicações citadas no esboço da organização
const MAX_SECOES_COM_CITACAO = 4;

// A pesquisa da wol só acha o que tem TODAS as palavras na mesma frase (ou parágrafo): uma frase inteira ("Como enfrentar a ansiedade Mostrar
// que Jeová cuida de nós…") não acha nada. Por isso a pesquisa automática usa poucas palavras-chave (as do tema primeiro) e, se não achar, tira palavras.
const PARADAS = new Set(
  ("como para pelo pela pelos pelas sobre entre quando onde quem qual quais isso isto esse essa esses essas este esta estes estas aquele aquela " +
    "mais muito muita muitos muitas seus suas nosso nossa nossos nossas voce voces depende depender mostrar mostra explicar ensinar ajudar " +
    "motivar incentivar fazer fazem faz tenha tenham ter tem ser seja foram sido cada outro outra outros outras tudo todo toda todos todas " +
    "depois antes ainda sempre nunca apenas somente quer querem deve devemos devem pode podem podemos vamos assim porque pois mas tambem " +
    "uma umas uns tema discurso ideia ocasiao alcancar colocar lugar primeiro primeira maneira forma").split(" ")
);
// Palavras que aparecem em quase toda matéria da wol: servem para pesquisar, mas não provam que a matéria fala do assunto.
const GENERICAS = new Set(["jeova", "deus"]);
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// As palavras de conteúdo dos textos (4 letras ou mais, sem as de ligação), sem repetir, na ordem em que aparecem (o primeiro texto vem primeiro).
export function palavrasChave(...textos) {
  const vistas = new Set();
  const lista = [];
  for (const texto of textos) {
    for (const palavra of String(texto || "").split(/[^\p{L}\p{N}]+/u)) {
      const chave = semAcento(palavra);
      if (palavra.length < 4 || PARADAS.has(chave) || vistas.has(chave)) continue;
      vistas.add(chave);
      lista.push(palavra);
    }
  }
  return lista;
}

// A matéria "fala do assunto" se o título ou o trecho têm pelo menos 2 das palavras-chave (sem as genéricas, como Jeová).
export function pontosDeRelevancia(resultado, textos) {
  const palavras = palavrasChave(...textos).filter((p) => !GENERICAS.has(semAcento(p))).slice(0, 6);
  const titulo = semAcento(resultado.titulo);
  const trecho = semAcento(resultado.trecho);
  // Uma palavra no título vale mais (3) que no trecho (1).
  return palavras.reduce((n, p) => n + (titulo.includes(semAcento(p)) ? 3 : trecho.includes(semAcento(p)) ? 1 : 0), 0);
}
export function relevanciaDe(resultado, textos) {
  const total = palavrasChave(...textos).filter((p) => !GENERICAS.has(semAcento(p))).length;
  return total > 0 && pontosDeRelevancia(resultado, textos) >= Math.min(2, total);
}

// Pesquisa na wol com poucas palavras-chave dos textos: 3, depois 2, depois 1 (as primeiras); para quando acha o mínimo de resultados.
// Devolve os melhores resultados que achou e a consulta usada.
export async function pesquisarPorPalavras(textos, { timeoutMs = 9000, maximo = 6, minimo = 2 } = {}) {
  const palavras = palavrasChave(...textos);
  // As primeiras palavras (as do tema) e, se não achar, as mais compridas (que costumam ser as do assunto): 3, 2 e 1 palavra.
  const maisLongas = (n) => {
    const escolhidas = new Set([...palavras].sort((a, b) => b.length - a.length).slice(0, n));
    return palavras.filter((p) => escolhidas.has(p));
  };
  const candidatas = [palavras.slice(0, 3), palavras.slice(0, 2), maisLongas(3), maisLongas(2), palavras.slice(0, 1), maisLongas(1)];
  const tentativas = [...new Set(candidatas.map((c) => c.join(" ")))].filter((c) => c.length >= 8);
  let melhor = { resultados: [], consulta: "" };
  for (const consulta of tentativas) {
    const resultados = (await pesquisarNoWol(consulta, timeoutMs, maximo).catch(() => [])) || [];
    if (resultados.length > melhor.resultados.length) melhor = { resultados, consulta };
    if (resultados.length >= minimo) break;
  }
  return melhor;
}

const linha = (valor, max) => String(valor || "").replace(/\s+/g, " ").trim().slice(0, max);
const semUrlExtra = (url) => String(url || "").replace(/[#?].*$/, "");
const rotuloCurto = (r) => (r.rotulo ? ` (${r.rotulo})` : "");
const aspas = (titulos) => titulos.map((t) => `«${t}»`).join("; ");

// A que publicações o rótulo de um resultado ("w15 1/7 págs. 10-11") corresponde a esta citação do esboço ("Sentinela 15/11/15 pág. 4-5
// parág. 3-6", "Despertai! 8/1/96 pág. 19")? Pontuação: o ano e a data iguais valem 2 cada; páginas que se cruzam, 1. Pelo menos 3 = a mesma.
export function pontuacaoDaCitacao(citacao, rotulo) {
  const c = String(citacao || "");
  const r = String(rotulo || "");
  const rot = r.match(/^([a-z]+)(\d{2})\b(?:\s+(\d{1,2})\/(\d{1,2}))?/i);
  if (!rot) return 0;
  const simbolo = rot[1].toLowerCase();
  // O nome da publicação, quando o esboço o diz, tem de ser o do símbolo do rótulo.
  const porNome = [
    [/sentinela|watchtower/i, ["w", "ws", "wp"]],
    [/despertai/i, ["g"]],
    [/minist[eé]rio do reino/i, ["km"]],
  ].find(([padrao]) => padrao.test(c));
  if (porNome && !porNome[1].includes(simbolo)) return 0;
  let pontos = 0;
  const data = c.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  const simboloAno = c.match(/\b(w|ws|wp|g|km)\s?(\d{2})\b/i);
  const ano = data ? Number(data[3]) % 100 : simboloAno ? Number(simboloAno[2]) : null;
  if (ano !== null && ano === Number(rot[2])) pontos += 2;
  else return 0;
  if (data && rot[3] && Number(data[1]) === Number(rot[3]) && Number(data[2]) === Number(rot[4])) pontos += 2;
  const paginas = c.match(/p[aá]gs?\.?\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?/i);
  const doRotulo = r.match(/p[aá]gs?\.?\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?/i);
  if (paginas && doRotulo) {
    const [a1, a2] = [Number(paginas[1]), Number(paginas[2] || paginas[1])];
    const [b1, b2] = [Number(doRotulo[1]), Number(doRotulo[2] || doRotulo[1])];
    if (a1 <= b2 && b1 <= a2) pontos += 1;
  }
  return pontos;
}

async function porPesquisa(d, ja, timeoutMs) {
  // Sem esboço nem artigos: palavras-chave do tema e da ideia do orador.
  const { resultados } = await pesquisarPorPalavras([d.tema, d.ideia], { timeoutMs, maximo: 8, minimo: 3 });
  // A pesquisa da wol traz de tudo (texto do dia, programas de assembleia, anuário…): ficam as matérias em que aparecem pelo menos 2
  // palavras-chave do tema e da ideia (no título ou no trecho), as que mais as têm primeiro.
  const achados = resultados
    .filter((r) => !ja.has(semUrlExtra(r.url)) && !/^(?:es\d|km\b|mwb|yb\d|lmd)/i.test(r.rotulo) && relevanciaDe(r, [d.tema, d.ideia]))
    .map((r, i) => ({ r, i, pontos: pontosDeRelevancia(r, [d.tema, d.ideia]) }))
    .sort((a, b) => b.pontos - a.pontos || a.i - b.i)
    .slice(0, MAX_AUTO_SEM_BASE)
    .map((x) => x.r);
  return {
    origem: "pesquisa",
    enderecos: achados.map((r) => r.url),
    avisos: [
      achados.length
        ? `Você não informou esboço da organização nem artigos, então pesquisei na wol.jw.org com o tema e a ideia e usei: ${aspas(achados.map((r) => r.titulo + rotuloCurto(r)))}.`
        : "Você não informou esboço da organização nem artigos e a pesquisa na wol.jw.org não achou matérias que combinem com o tema e a ideia: o esboço usa só a Bíblia e o que você informou. Dica: pesquise você mesmo no passo 2 e marque os artigos.",
    ],
  };
}

async function porCitacoes(d, ja, timeoutMs) {
  const secoes = d.esbocoBase.secoes.filter((s) => publicacoesDaSecao(s).length).slice(0, MAX_SECOES_COM_CITACAO);
  if (!secoes.length) return { origem: "", enderecos: [], avisos: [] }; // o esboço não cita publicações: nada a consultar
  const buscas = await Promise.all(
    secoes.map(async (secao) => {
      const citacoes = publicacoesDaSecao(secao);
      const textosDaSecao = [secao.titulo, ...secao.itens.slice(0, 2).map((i) => i.texto)];
      const { resultados } = await pesquisarPorPalavras(textosDaSecao, { timeoutMs, maximo: 8, minimo: 3 });
      const pontuados = resultados.map((r) => ({
        r,
        pontos: Math.max(0, ...citacoes.map((c) => pontuacaoDaCitacao(c, r.rotulo))), // 3 ou mais: a publicação citada
        // Sem achar a citada, só serve a matéria que fala do assunto da seção (pelo menos 2 palavras-chave no título ou no trecho).
        relevante: relevanciaDe(r, textosDaSecao),
        relevancia: pontosDeRelevancia(r, textosDaSecao),
      }));
      return { pontuados, citacoes };
    })
  );
  const escolhidos = [];
  const vistos = new Set(ja);
  let exatas = 0;
  buscas.forEach(({ pontuados }) => {
    const exata = pontuados.filter((p) => p.pontos >= 3).sort((a, b) => b.pontos - a.pontos)[0];
    const proxima = exata || [...pontuados].filter((p) => p.relevante && !vistos.has(semUrlExtra(p.r.url))).sort((a, b) => b.relevancia - a.relevancia)[0];
    if (!proxima || vistos.has(semUrlExtra(proxima.r.url)) || escolhidos.length >= MAX_AUTO_COM_BASE) return;
    vistos.add(semUrlExtra(proxima.r.url));
    if (exata) exatas++;
    escolhidos.push(proxima.r);
  });
  const aviso = escolhidos.length
    ? `O esboço cita publicações; consultei na wol.jw.org: ${aspas(escolhidos.map((r) => r.titulo + rotuloCurto(r)))}.` +
      (exatas < escolhidos.length ? " Nem todas as publicações citadas foram localizadas pelo nome: nas outras usei a matéria mais próxima do assunto da seção." : "")
    : "O esboço cita publicações, mas não consegui consultá-las na wol.jw.org agora: elas valem só como referência.";
  return { origem: "citacoes", enderecos: escolhidos.map((r) => r.url), avisos: [aviso] };
}

// d: os dados do pedido (tema, ideia, artigos, esbocoBase). Devolve { origem, enderecos, avisos }; nunca falha o esboço.
export async function materiasAutomaticas(d, { timeoutMs = 9000 } = {}) {
  const ja = new Set((d.artigos || []).map(semUrlExtra));
  try {
    if (d.esbocoBase) return await porCitacoes(d, ja, timeoutMs);
    if ((d.artigos || []).length) return { origem: "", enderecos: [], avisos: [] }; // o orador trouxe os artigos: valem eles
    return await porPesquisa(d, ja, timeoutMs);
  } catch (e) {
    console.error("Outros esboços: pesquisa automática na wol falhou", e?.name, e?.message);
    return { origem: "", enderecos: [], avisos: ["A pesquisa automática na wol.jw.org falhou agora: o esboço usa só o que você informou."] };
  }
}
