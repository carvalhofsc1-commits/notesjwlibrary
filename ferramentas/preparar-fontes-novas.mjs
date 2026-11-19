// Prepara as 14 publicações novas: normaliza .txt e converte os 2 EPUB.
// Escreve em pasta temporária FORA do repositório (não entra no Git).
// Uso: node ferramentas/preparar-fontes-novas.mjs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

const ORIGEM = resolve("C:/Softs/AppNotesJW_Diversos/Fontes");
const DESTINO = resolve("C:/Softs/AppNotesJW_Diversos/Fontes_preparadas");
const ROOT = resolve(".");

mkdirSync(DESTINO, { recursive: true });

/** Remove BOM e normaliza quebras; garante parágrafos separados por linha em branco. */
function normalizarParagrafos(texto) {
  let t = String(texto || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  // Já tem blocos separados por linha em branco? Mantém e limpa espaços internos.
  if (/\n\s*\n/.test(t)) {
    return t
      .split(/\n\s*\n/)
      .map((p) => p.replace(/[ \t]+\n/g, "\n").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n") + "\n";
  }
  // Um parágrafo por linha (sem linha em branco): vira blocos.
  return t
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n") + "\n";
}

/**
 * Arquivos no formato ========== SEÇÃO ========== (extrações WOL):
 * cada seção vira um ou mais parágrafos; o sumário é descartado.
 */
function normalizarSecoes(texto) {
  const t = String(texto || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const partes = t.split(/^==========\s*(.+?)\s*==========\s*$/m);
  // partes[0] = cabeçalho; depois [titulo, corpo, titulo, corpo, ...]
  const paragrafos = [];
  for (let i = 1; i < partes.length; i += 2) {
    const titulo = (partes[i] || "").trim();
    if (/^SUMÁRIO$/i.test(titulo)) continue;
    let corpo = (partes[i + 1] || "").trim();
    if (!corpo || corpo === "(sem texto)") continue;

    // Se o corpo já tem linhas em branco, cada bloco é um parágrafo (com o título na frente do 1º).
    if (/\n\s*\n/.test(corpo)) {
      const blocos = corpo
        .split(/\n\s*\n/)
        .map((b) => b.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (!blocos.length) continue;
      paragrafos.push(`${titulo}. ${blocos[0]}`);
      for (const b of blocos.slice(1)) paragrafos.push(b);
      continue;
    }

    // Corpo denso (uma linha por frase): junta em parágrafos de ~400–800 chars.
    const linhas = corpo
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!linhas.length) continue;

    let atual = titulo + ".";
    for (const linha of linhas) {
      // Cabeçalhos de subseção viram novo parágrafo.
      if (/^#{1,3}\s/.test(linha) || /^##\s/.test(linha) || /^###\s/.test(linha)) {
        if (atual.replace(/\s+/g, " ").trim().length >= 40) paragrafos.push(atual.replace(/\s+/g, " ").trim());
        atual = linha.replace(/^#+\s*/, "") + ".";
        continue;
      }
      const candidato = `${atual} ${linha}`.replace(/\s+/g, " ").trim();
      if (candidato.length > 900 && atual.length >= 80) {
        paragrafos.push(atual);
        atual = linha;
      } else {
        atual = candidato;
      }
    }
    if (atual.replace(/\s+/g, " ").trim().length >= 40) {
      paragrafos.push(atual.replace(/\s+/g, " ").trim());
    }
  }
  return paragrafos.join("\n\n") + "\n";
}

function salvar(nome, conteudo) {
  const caminho = join(DESTINO, nome);
  const texto = conteudo.endsWith("\n") ? conteudo : conteudo + "\n";
  writeFileSync(caminho, texto, { encoding: "utf8" });
  const paras = texto.split(/\n\s*\n/).filter((p) => p.replace(/\s+/g, " ").trim().length >= 80);
  const kb = (Buffer.byteLength(texto) / 1024).toFixed(1);
  console.log(`  ${nome}: ${paras.length} parágrafos (≥80), ${kb} KB`);
  return { nome, paragrafos: paras.length, bytes: Buffer.byteLength(texto) };
}

const mapa = [
  // [arquivo origem, nome destino, tipo: secoes|plano]
  ["raciocinios.txt", "raciocinios.txt", "secoes"],
  ["glossario-nwt.txt", "glossario_nwt.txt", "secoes"],
  ["introducao-biblia-estudo.txt", "introducao_biblia_estudo.txt", "secoes"],
  ["apendice-a-biblia-estudo.txt", "apendice_a_biblia_estudo.txt", "secoes"],
  ["apendice-b-biblia-estudo.txt", "apendice_b_biblia_estudo.txt", "secoes"],
  ["apendice-c-biblia-estudo.txt", "apendice_c_biblia_estudo.txt", "secoes"],
  ["guia-de-pesquisa.txt", "guia_de_pesquisa.txt", "secoes"],
  ["abreviacoes-publicacoes.txt", "abreviacoes_publicacoes.txt", "plano"],
  ["s38-t_intrucoes_reuniao_vida_e_ministerio.txt", "s38_instrucoes_reuniao_vida_e_ministerio.txt", "plano"],
  ["manual-escola-ministerio.txt", "manual_escola_ministerio.txt", "secoes"],
  ["perguntas-biblicas-respondidas.txt", "perguntas_biblicas_respondidas.txt", "secoes"],
  ["perguntas-frequentes-tj.txt", "perguntas_frequentes_tj.txt", "secoes"],
];

console.log("Destino:", DESTINO);
console.log("\n=== TXT ===");
const stats = [];
for (const [origemNome, destinoNome, tipo] of mapa) {
  const origem = join(ORIGEM, origemNome);
  if (!existsSync(origem)) {
    console.error(`FALTA: ${origem}`);
    process.exitCode = 1;
    continue;
  }
  const bruto = readFileSync(origem, "utf8");
  const texto = tipo === "secoes" ? normalizarSecoes(bruto) : normalizarParagrafos(bruto);
  stats.push(salvar(destinoNome, texto));
}

console.log("\n=== EPUB ===");
for (const [epubNome, destinoNome] of [
  ["be_T_beneficie-se_da_escola.epub", "beneficie_escola.txt"],
  ["od_T_ORGANIZADOS.epub", "organizados.txt"],
]) {
  const epub = join(ORIGEM, epubNome);
  const saida = join(DESTINO, destinoNome);
  if (!existsSync(epub)) {
    console.error(`FALTA: ${epub}`);
    process.exitCode = 1;
    continue;
  }
  execFileSync(process.execPath, [join(ROOT, "ferramentas/epub-para-txt.mjs"), epub, saida], {
    stdio: "inherit",
  });
  // Reaplica normalização de parágrafos no resultado.
  const texto = normalizarParagrafos(readFileSync(saida, "utf8"));
  stats.push(salvar(destinoNome, texto));
}

console.log("\nPronto. Pasta:", DESTINO);
writeFileSync(join(DESTINO, "_stats.json"), JSON.stringify(stats, null, 2), "utf8");
