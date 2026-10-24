// Esboços de discursos públicos (S-34). O arquivo começa com "_" para a Vercel não publicá-lo como rota.
//
// Cada tema fica num JSON no Vercel Blob PRIVADO (o mesmo store das fontes, ligado pela variável BLOB_READ_WRITE_TOKEN), em
// "s34/NNN.json", com um índice ("s34/indice.json": título, hash do conteúdo, data da importação) e a lista de temas
// ("s34/temas.json"). O navegador nunca lê esses arquivos: o administrador os importa pela tela de Ajustes e o servidor só manda
// à IA o esboço do tema pedido. Nada disso vai para o repositório (que é público).
//
// S34_DIR (só para testes no computador) troca o Blob por uma pasta local.
import { createHash } from "node:crypto";
import { get, put, del } from "@vercel/blob";

export function s34Configurado() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.S34_DIR);
}

const nomeDoEsboco = (numero) => `${String(numero).padStart(3, "0")}.json`;
const caminho = (nome) => `s34/${nome}`;

async function lerJson(nome) {
  if (process.env.S34_DIR) {
    const { readFile } = await import("node:fs/promises");
    try {
      return JSON.parse(await readFile(`${process.env.S34_DIR}/${nome}`, "utf8"));
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  }
  // useCache: false porque os arquivos são regravados quando o administrador importa uma versão nova.
  const resultado = await get(caminho(nome), { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN, useCache: false }).catch((e) => {
    if (e && /not\s*found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw e;
  });
  if (!resultado || resultado.statusCode !== 200) return null;
  return JSON.parse(await new Response(resultado.stream).text());
}

async function gravarJson(nome, dados) {
  const texto = JSON.stringify(dados);
  if (process.env.S34_DIR) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(process.env.S34_DIR, { recursive: true });
    await writeFile(`${process.env.S34_DIR}/${nome}`, texto, "utf8");
    return;
  }
  await put(caminho(nome), texto, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
  });
}

async function apagarJson(nome) {
  if (process.env.S34_DIR) {
    const { unlink } = await import("node:fs/promises");
    await unlink(`${process.env.S34_DIR}/${nome}`).catch(() => {});
    return;
  }
  await del(caminho(nome), { token: process.env.BLOB_READ_WRITE_TOKEN });
}

// ---------- Validação ----------
// O que chega do navegador é conferido e reescrito só com os campos conhecidos (e nos tamanhos permitidos).

const texto = (valor, max) => (typeof valor === "string" ? valor.replace(/​/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const lista = (valor, max, tamanho) => (Array.isArray(valor) ? valor.map((x) => texto(x, tamanho)).filter(Boolean).slice(0, max) : []);

// Devolve { esboco } com o conteúdo normalizado ou { erro }.
export function validarEsboco(bruto) {
  if (!bruto || typeof bruto !== "object") return { erro: "Esboço inválido." };
  const numero = Number(bruto.numero);
  if (!Number.isInteger(numero) || numero < 1 || numero > 999) return { erro: "Número do tema inválido (use de 1 a 999)." };
  const titulo = texto(bruto.titulo, 200);
  if (titulo.length < 3) return { erro: "O esboço está sem título." };
  if (!Array.isArray(bruto.secoes) || !bruto.secoes.length) return { erro: "O esboço não tem seções." };
  if (bruto.secoes.length > 15) return { erro: "Seções demais no esboço." };

  const secoes = [];
  for (const s of bruto.secoes) {
    if (!s || typeof s !== "object" || !Array.isArray(s.itens)) return { erro: "Seção inválida." };
    if (s.itens.length > 100) return { erro: "Itens demais numa seção." };
    const minutos = s.minutos === null || s.minutos === undefined ? null : Number(s.minutos);
    if (minutos !== null && (!Number.isInteger(minutos) || minutos < 0 || minutos > 60)) return { erro: "Tempo de seção inválido." };
    secoes.push({
      titulo: texto(s.titulo, 200),
      minutos,
      itens: s.itens.map((i) => ({
        nivel: Math.max(0, Math.min(4, Math.round(Number(i && i.nivel) || 0))),
        texto: texto(i && i.texto, 1500),
        negrito: Boolean(i && i.negrito),
        destaques: (Array.isArray(i && i.destaques) ? i.destaques : [])
          .map((d) => ({ texto: texto(d && d.texto, 300), nivel: Number(d && d.nivel) === 2 ? 2 : 1 }))
          .filter((d) => d.texto)
          .slice(0, 6),
        nota: Boolean(i && i.nota),
        leituras: lista(i && i.leituras, 8, 100),
        referencias: lista(i && i.referencias, 20, 100),
        publicacoes: lista(i && i.publicacoes, 10, 200),
      })).filter((i) => i.texto),
    });
  }
  return {
    esboco: {
      numero,
      titulo,
      revisao: texto(bruto.revisao, 20),
      notaAoOrador: texto(bruto.notaAoOrador, 3000),
      secoes,
      notaFinal: texto(bruto.notaFinal, 3000),
    },
  };
}

// O mesmo conteúdo dá sempre o mesmo hash (a ordem dos campos é a de validarEsboco); o nome do arquivo e a data dele não contam.
export function hashDoEsboco(esboco) {
  return createHash("sha256").update(JSON.stringify(esboco)).digest("hex").slice(0, 16);
}

function resumoDe(esboco, hash, meta) {
  const itens = esboco.secoes.reduce((n, s) => n + s.itens.length, 0);
  return {
    titulo: esboco.titulo,
    revisao: esboco.revisao,
    hash,
    minutos: esboco.secoes.reduce((n, s) => n + (s.minutos || 0), 0),
    secoes: esboco.secoes.length,
    itens,
    importadoEm: new Date().toISOString(),
    arquivo: texto(meta && meta.arquivo, 120),
    arquivoModificado: texto(meta && meta.arquivoModificado, 40),
  };
}

// ---------- Índice, esboços e lista de temas ----------

export async function lerIndice() {
  const indice = await lerJson("indice.json");
  return indice && typeof indice === "object" && indice.temas && typeof indice.temas === "object" ? indice : { temas: {} };
}

export async function lerEsboco(numero) {
  return lerJson(nomeDoEsboco(numero));
}

// Confere e (se somenteConferir for falso) grava os esboços. Devolve, por número, o que aconteceu:
// { novos: [n], atualizados: [n], iguais: [n], invalidos: [{ numero, erro }] }.
export async function gravarEsbocos(esbocos, { somenteConferir = false } = {}) {
  const indice = await lerIndice();
  const resultado = { novos: [], atualizados: [], iguais: [], invalidos: [] };
  const vistos = new Set();
  let mudou = false;
  for (const bruto of esbocos) {
    const validado = validarEsboco(bruto);
    if (validado.erro) {
      resultado.invalidos.push({ numero: bruto && bruto.numero, erro: validado.erro });
      continue;
    }
    const { esboco } = validado;
    if (vistos.has(esboco.numero)) {
      resultado.invalidos.push({ numero: esboco.numero, erro: "Tema repetido nesta importação." });
      continue;
    }
    vistos.add(esboco.numero);
    const hash = hashDoEsboco(esboco);
    const atual = indice.temas[String(esboco.numero)];
    if (atual && atual.hash === hash) {
      resultado.iguais.push(esboco.numero);
      continue;
    }
    (atual ? resultado.atualizados : resultado.novos).push(esboco.numero);
    if (somenteConferir) continue;
    await gravarJson(nomeDoEsboco(esboco.numero), esboco);
    indice.temas[String(esboco.numero)] = resumoDe(esboco, hash, bruto);
    mudou = true;
  }
  if (mudou) {
    indice.atualizadoEm = new Date().toISOString();
    await gravarJson("indice.json", indice);
  }
  return resultado;
}

export async function apagarEsboco(numero) {
  const indice = await lerIndice();
  if (!indice.temas[String(numero)]) return false;
  await apagarJson(nomeDoEsboco(numero));
  delete indice.temas[String(numero)];
  indice.atualizadoEm = new Date().toISOString();
  await gravarJson("indice.json", indice);
  return true;
}

// "1. Você conhece bem a Deus?" por linha -> [{ numero, titulo }] e os problemas encontrados.
export function temasDoTexto(entrada) {
  const itens = [];
  const problemas = [];
  const vistos = new Set();
  String(entrada || "")
    .split(/\r?\n/)
    .forEach((linha) => {
      const limpa = linha.replace(/​/g, "").trim();
      if (!limpa) return;
      const m = limpa.match(/^(\d{1,3})\s*[.)\-–—:]\s*(.+)$/);
      if (!m) {
        if (!/^esbo[cç]os?\b/i.test(limpa)) problemas.push(`Linha ignorada (sem número): "${limpa.slice(0, 60)}"`);
        return;
      }
      const numero = Number(m[1]);
      if (vistos.has(numero)) {
        problemas.push(`O número ${numero} aparece mais de uma vez.`);
        return;
      }
      vistos.add(numero);
      itens.push({ numero, titulo: texto(m[2], 200) });
    });
  itens.sort((a, b) => a.numero - b.numero);
  return { itens: itens.slice(0, 500), problemas };
}

export async function lerTemas() {
  const dados = await lerJson("temas.json");
  return dados && Array.isArray(dados.itens) ? dados : null;
}

export async function gravarTemas(itens) {
  await gravarJson("temas.json", { itens, atualizadoEm: new Date().toISOString() });
}

// ---------- Para a IA: o esboço do tema escolhido em texto ----------

// As leituras marcadas "[Leia ...]" e os textos citados entre parênteses (sem repetir), nessa ordem.
export function referenciasDoPublico(esboco) {
  const itens = esboco.secoes.flatMap((s) => s.itens);
  const leituras = [...new Set(itens.flatMap((i) => i.leituras || []))];
  const citadas = [...new Set(itens.flatMap((i) => i.referencias || []))].filter((r) => !leituras.includes(r));
  return { leituras, citadas };
}

// As publicações citadas numa seção (só as referências), para a linha "Fonte" do ponto.
export function publicacoesDaSecao(secao) {
  return [...new Set((secao ? secao.itens : []).flatMap((i) => i.publicacoes || []))];
}

export function minutosDoEsboco(esboco) {
  return esboco.secoes.reduce((n, s) => n + (s.minutos || 0), 0);
}

// As seções do esboço como a IA as recebe: título com o tempo e os itens em níveis, com as marcas [LER], [DESTAQUE], [DESTAQUE MÁXIMO],
// [NOTA AO ORADOR] e [EM NEGRITO NO ESBOÇO]. Uma string por seção.
function textoDasSecoes(esboco) {
  return esboco.secoes.map((secao, i) => {
    const linhas = [`SEÇÃO ${i + 1} — ${secao.titulo}${secao.minutos ? ` (${secao.minutos} min)` : ""}`];
    secao.itens.forEach((item) => {
      const marcas = [];
      if (item.negrito && !item.nota) marcas.push("EM NEGRITO NO ESBOÇO");
      (item.leituras || []).forEach((l) => marcas.push(`LER: ${l}`));
      (item.destaques || []).forEach((d) => marcas.push(`${d.nivel === 2 ? "DESTAQUE MÁXIMO" : "DESTAQUE"}: “${d.texto}”`));
      const base = item.nota ? `[NOTA AO ORADOR: ${item.texto}]` : item.texto;
      linhas.push(`${"  ".repeat(item.nivel || 0)}- ${base}${marcas.length ? ` [${marcas.join("] [")}]` : ""}`);
    });
    return linhas.join("\n");
  });
}

// O esboço do S-34 como a IA o recebe: seções com tempo, itens em níveis e as marcas [LER], [DESTAQUE], [DESTAQUE MÁXIMO] e
// [NOTA AO ORADOR]; depois a nota do fim e o texto exato dos versículos.
export function textoDoDiscursoPublico(esboco, versiculos = []) {
  const partes = [
    `TEMA DO DISCURSO PÚBLICO: ${esboco.titulo} (esboço S-34 nº ${esboco.numero}${esboco.revisao ? `, revisão ${esboco.revisao}` : ""}; ${minutosDoEsboco(esboco)} minutos)`,
  ];
  if (esboco.notaAoOrador) partes.push(`NOTA AO ORADOR (objetivo do esboço): ${esboco.notaAoOrador}`);
  partes.push(...textoDasSecoes(esboco));
  if (esboco.notaFinal) partes.push(`NOTA DO FIM DO ESBOÇO: ${esboco.notaFinal}`);
  if (versiculos.length) {
    partes.push("TEXTO DOS VERSÍCULOS (as leituras e os textos citados, na Tradução do Novo Mundo):\n" + versiculos.map((v) => `${v.referencia}: ${v.texto}`).join("\n"));
  }
  return partes.join("\n\n");
}

// Um esboço pronto que o orador importou no aparelho (no molde do S-34) como matéria do card Outros esboços: o mesmo texto, sem o
// número do S-34 nem os versículos (estes vão à parte, junto dos demais textos da mensagem).
export function textoDoEsbocoImportado(esboco) {
  const partes = [`ESBOÇO PRONTO IMPORTADO PELO ORADOR: ${esboco.titulo}${esboco.revisao ? ` (revisão ${esboco.revisao})` : ""} (${minutosDoEsboco(esboco)} minutos)`];
  // Nem todo esboço tem a nota ao orador (ou só traz "Nota"): sem ela a matéria começa logo depois do título.
  partes.push(esboco.notaAoOrador ? `NOTA AO ORADOR (objetivo do esboço): ${esboco.notaAoOrador}` : "SEM NOTA AO ORADOR: o esboço não traz nota; a matéria começa logo depois do título.");
  partes.push(...textoDasSecoes(esboco));
  if (esboco.notaFinal) partes.push(`NOTA DO FIM DO ESBOÇO: ${esboco.notaFinal}`);
  return partes.join("\n\n");
}

// Os textos bíblicos do esboço do S-34 para a lista da tela: as leituras marcadas "[Leia …]" e os textos citados.
export function textosBiblicosDoPublico(esboco) {
  const { leituras, citadas } = referenciasDoPublico(esboco);
  return { todos: [...leituras, ...citadas], leia: leituras };
}
