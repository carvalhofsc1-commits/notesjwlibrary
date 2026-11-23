// Teste dos dados novos da Adoração em Família (6.12.68): Princípios Bíblicos estruturado (principios.json), o txt reconvertido
// (principios_biblicos.txt) e o catálogo dos Ensinos Bíblicos do jw.org (ensinos_biblicos.json). Sem IA e sem rede: copia os
// arquivos para uma pasta temporária (FONTES_DIR) e chama as funções de api/_fontes.mjs direto.
// Uso: node ferramentas/testar-fontes-adoracao.mjs [pasta das fontes]
//   A pasta padrão é C:\Softs\AppNotesJW_Diversos\Fontes. Sem os arquivos, só os testes puros rodam.
import { mkdtemp, rm, copyFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = process.argv.slice(2).find((a) => !a.startsWith("--")) || "C:\\Softs\\AppNotesJW_Diversos\\Fontes";
const ARQS = ["principios.json", "principios_biblicos.txt", "ensinos_biblicos.json", "biblia.txt"];
const pasta = await mkdtemp(join(tmpdir(), "fontes-adoracao-"));
const presentes = new Set();
for (const nome of ARQS) {
  try {
    await access(join(base, nome));
    await copyFile(join(base, nome), join(pasta, nome));
    presentes.add(nome);
  } catch {
    console.log(`(sem ${join(base, nome)}: os testes que dependem dele ficam de fora)`);
  }
}
process.env.HOSPEDAGEM = "local";
process.env.DADOS_DIR = pasta;
process.env.FONTES_DIR = pasta;

const fontes = await import("../api/_fontes.mjs");
let ok = 0;
const teste = async (nome, fn) => {
  try {
    await fn();
    ok++;
    console.log("ok  -", nome);
  } catch (e) {
    console.error("FALHOU -", nome, "\n", e);
    process.exitCode = 1;
  }
};

// ---------- Puros ----------
await teste("resumoDoJson: cânticos, princípios, catálogo e JSON inválido", () => {
  assert.equal(fontes.resumoDoJson("[1,2,3]"), "3 cânticos");
  const p = fontes.resumoDoJson(JSON.stringify({ entradas: [{}, {}], verbetes: [{}], edicao: "Edição X", gerado: "2026-11-23" }));
  assert.equal(p, "2 entradas · 1 verbetes · Edição X · gerado em 2026-11-23");
  const c = fontes.resumoDoJson(JSON.stringify({ artigos: [{ ciencia: true }, { ciencia: false }] }));
  assert.equal(c, "2 páginas · 1 de ciência");
  assert.equal(fontes.resumoDoJson("{não é json"), "");
});

// ---------- Princípios Bíblicos (scl) ----------
const TITULO_CORROMPIDO = /_|\b(?:[A-ZÀ-Ý] ){2,}[A-ZÀ-Ý]\b|[A-ZÀ-Ý]{2,} [A-ZÀ-Ý]{1,3}(?:ÇÕES|ÕES|ÇÃO|ÚME)\b/;
if (presentes.has("principios.json")) {
  const p = await fontes.lerPrincipios();
  await teste("lerPrincipios: formato, 103 verbetes e edição", () => {
    assert.ok(p, "lerPrincipios devolveu null");
    assert.equal(p.sigla, "scl");
    assert.match(p.edicao, /setembro de 2025/);
    assert.equal(p.verbetes.length, 103);
    assert.ok(p.entradas.length >= 700, `só ${p.entradas.length} entradas`);
    assert.equal(Object.keys(p.categorias).length, 7);
  });
  await teste("lerPrincipios: guarda em cache (mesmo objeto)", async () => {
    assert.strictEqual(await fontes.lerPrincipios(), p);
  });
  await teste("principios.json: ids únicos e estáveis (<verbete>.<n>) e campos de cada entrada", () => {
    const ids = new Set();
    const nomes = new Set(p.verbetes.map((v) => v.verbete));
    for (const e of p.entradas) {
      assert.match(e.id, /^[a-z0-9-]+\.\d+$/, e.id);
      assert.ok(!ids.has(e.id), "id repetido " + e.id);
      ids.add(e.id);
      assert.ok(nomes.has(e.verbete), `verbete desconhecido em ${e.id}: ${e.verbete}`);
      assert.equal(typeof e.confiavel, "boolean", e.id);
      assert.ok(Array.isArray(e.versiculos) && Array.isArray(e.relatos), e.id);
      assert.ok(e.vejaTambem && Array.isArray(e.vejaTambem.versiculos) && Array.isArray(e.vejaTambem.assuntos), e.id);
      assert.ok(Number.isInteger(e.pagina) && e.pagina > 0, e.id);
      assert.ok(e.texto.length > 3, e.id);
    }
    // Ids estáveis: o número segue a ordem dentro do verbete, sem buracos.
    const porVerbete = new Map();
    for (const e of p.entradas) {
      const [slug, n] = e.id.split(".");
      porVerbete.set(slug, [...(porVerbete.get(slug) || []), Number(n)]);
    }
    for (const [slug, ns] of porVerbete) assert.deepEqual(ns, ns.map((_, i) => i + 1), slug);
  });
  await teste("principios.json: nenhum título corrompido nem \"culto\"", () => {
    for (const v of p.verbetes) assert.doesNotMatch(v.verbete, TITULO_CORROMPIDO, v.verbete);
    for (const e of p.entradas) {
      assert.doesNotMatch(e.subverbete || "", TITULO_CORROMPIDO, e.id);
      assert.doesNotMatch(e.texto, /_{2,}|\bcultos?\b/i, e.id);
    }
  });
  await teste("principios.json: referências no formato da Bíblia (livro cap:vers)", () => {
    const REF = /^[1-3]?[A-ZÀ-Ý][a-zà-ÿ]{0,3} \d+(?::\d+(?:[-–]\d+(?::\d+)?)?(?:, \d+(?:-\d+)?)*)?$|^(?:Ob|Flm|2Jo|3Jo|Ju) \d+(?:-\d+)?(?:, \d+(?:-\d+)?)*$/;
    const ruins = [];
    for (const e of p.entradas)
      for (const r of [...e.versiculos, ...e.vejaTambem.versiculos, ...e.relatos.flatMap((x) => x.versiculos)]) if (!REF.test(r)) ruins.push(`${e.id}: ${r}`);
    assert.deepEqual(ruins.slice(0, 10), []);
  });
  if (presentes.has("biblia.txt")) {
    await teste("principios.json: ≥ 99,5% das referências achadas na Bíblia do servidor", async () => {
      let total = 0;
      let achadas = 0;
      for (const e of p.entradas)
        for (const r of [...e.versiculos, ...e.relatos.flatMap((x) => x.versiculos)]) {
          total++;
          const v = await fontes.buscarVersiculos([r], 1);
          if (v.length && v[0].texto) achadas++;
        }
      console.log(`      ${achadas}/${total} referências achadas (${((achadas / total) * 100).toFixed(2)}%)`);
      assert.ok(achadas / total >= 0.995);
    });
  }
}

if (presentes.has("principios_biblicos.txt")) {
  await teste("principios_biblicos.txt: cabeçalho da edição e busca nos livros", async () => {
    const { readFile } = await import("node:fs/promises");
    const txt = await readFile(join(pasta, "principios_biblicos.txt"), "utf8");
    assert.match(txt.split("\n")[0], /^PRINCÍPIOS BÍBLICOS PARA A VIDA CRISTÃ \(scl\)\. Edição de setembro de 2025/);
    assert.doesNotMatch(txt, /EFERI_|CELEBR AÇÕES|CI_+ÚME/);
    // Só o livro scl está na pasta: os avisos de "Fonte indisponível" dos outros livros ficam calados neste teste.
    const erroOriginal = console.error;
    console.error = (...a) => { if (!/^Fonte indisponível/.test(String(a[0]))) erroOriginal(...a); };
    let r;
    try {
      r = await fontes.buscarNosLivros("ciúme inveja", { livros: [fontes.nomeDoLivro("principiosBiblicos")], max: 3 });
    } finally {
      console.error = erroOriginal;
    }
    assert.ok(r.length > 0, "a busca não achou nada no livro");
    assert.ok(r.every((x) => /ciúme|inveja/i.test(x.trecho)), "trecho sem as palavras buscadas");
    assert.ok(r.every((x) => !/\(scl\)\. Edição/.test(x.trecho)), "o cabeçalho entrou na busca");
  });
}

// ---------- Catálogo dos Ensinos Bíblicos ----------
const PREFIXOS_CIENCIA = [
  "https://www.jw.org/pt/ensinos-biblicos/ciencia/evolucao-ou-criacao/",
  "https://www.jw.org/pt/ensinos-biblicos/ciencia/teve-um-projeto/",
  "https://www.jw.org/pt/ensinos-biblicos/ciencia/exatidao-cientifica-biblia/",
  "https://www.jw.org/pt/ensinos-biblicos/ciencia/origem-vida-teorias-fatos/",
];
if (presentes.has("ensinos_biblicos.json")) {
  const c = await fontes.lerEnsinosBiblicos();
  await teste("lerEnsinosBiblicos: formato, ids únicos, links do jw.org e trechos curtos", async () => {
    assert.ok(c, "lerEnsinosBiblicos devolveu null");
    assert.strictEqual(await fontes.lerEnsinosBiblicos(), c, "cache");
    assert.ok(c.artigos.length >= 800, `só ${c.artigos.length} páginas`);
    const ids = new Set();
    for (const a of c.artigos) {
      assert.ok(!ids.has(a.id), "id repetido " + a.id);
      ids.add(a.id);
      assert.ok(a.url.startsWith("https://www.jw.org/pt/"), a.url);
      assert.ok(a.externo || a.url.startsWith("https://www.jw.org/pt/ensinos-biblicos/"), a.url);
      if (a.externo) assert.ok(Array.isArray(a.listadoEm) && a.listadoEm.length, "artigo externo sem a seção que o lista: " + a.id);
      assert.ok(typeof a.secao === "string" && a.secao, a.id);
      assert.ok(Array.isArray(a.caminho), a.id);
      assert.ok(typeof a.trecho === "string" && a.trecho.length <= 501, `${a.id}: trecho com ${a.trecho.length} caracteres`);
      assert.ok(["artigo", "indice"].includes(a.tipo), a.id);
      // Página de layout antigo já pegou o título do modal de idiomas ou do botão de compartilhar.
      assert.ok(a.titulo && !/^(Selecione seu idioma|Compartilhar)$/i.test(a.titulo), `${a.id}: título errado "${a.titulo}"`);
    }
    const semTrecho = c.artigos.filter((a) => !a.trecho);
    assert.ok(semTrecho.length <= 5, `${semTrecho.length} páginas sem trecho`);
  });
  await teste("lerEnsinosBiblicos: ciencia:true só (e sempre) nas 4 seções de ciência (páginas delas e artigos listados nelas)", () => {
    // Id da página-índice de cada seção (ex.: "ciencia--teve-um-projeto"): os artigos listados nela também são de ciência.
    const idsCiencia = PREFIXOS_CIENCIA.map((p) => p.slice("https://www.jw.org/pt/ensinos-biblicos/".length).replace(/\/$/, "").replace(/\//g, "--"));
    const listadoNaCiencia = (a) => (a.listadoEm || []).some((id) => idsCiencia.some((c) => id === c || id.startsWith(c + "--")));
    for (const a of c.artigos) {
      const esperado = PREFIXOS_CIENCIA.some((p) => a.url.startsWith(p)) || (a.tipo === "artigo" && listadoNaCiencia(a));
      assert.equal(a.ciencia, esperado, a.url);
    }
    for (let i = 0; i < PREFIXOS_CIENCIA.length; i++) {
      const p = PREFIXOS_CIENCIA[i];
      const n = c.artigos.filter((a) => a.ciencia && a.tipo === "artigo" && (a.url.startsWith(p) || (a.listadoEm || []).includes(idsCiencia[i]))).length;
      assert.ok(n >= 5, `só ${n} artigos de ciência em ${p}`);
    }
  });
}

await rm(pasta, { recursive: true, force: true });
console.log(`\n${ok} testes passaram${process.exitCode ? " (houve falhas)" : ""}.`);
