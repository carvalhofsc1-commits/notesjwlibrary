// Memória de correções do piloto (só administrador). O arquivo começa com "_" para a Vercel não publicá-lo como rota.
//
// Guarda pares "texto que a IA escreveu → texto como o usuário deixou", cada um só quando o usuário marca, na hora de salvar, que quer
// usar aquela correção para melhorar as próximas respostas. Fica num JSON no Vercel Blob PRIVADO (o mesmo store dos esboços S-34),
// em "memoria/correcoes.json". O navegador só lê e muda esses dados com o código de administrador, conferido em api/config.mjs.
// Nesta fase as correções SÓ SÃO GUARDADAS: nenhuma resposta da IA as usa ainda (isso virá depois, com comparação medida).
//
// MEMORIA_DIR (só para testes no computador) troca o Blob por uma pasta local.
import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";

const NOME = "memoria/correcoes.json";
const MAX_ITENS = 300;
const MAX_TEXTO = 8000;

export function memoriaConfigurada() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.MEMORIA_DIR);
}

async function lerBruto() {
  if (process.env.MEMORIA_DIR) {
    const { readFile } = await import("node:fs/promises");
    try {
      return JSON.parse(await readFile(`${process.env.MEMORIA_DIR}/correcoes.json`, "utf8"));
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  }
  const resultado = await get(NOME, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN, useCache: false }).catch((e) => {
    if (e && /not\s*found|404/i.test(`${e.name} ${e.message}`)) return null;
    throw e;
  });
  if (!resultado || resultado.statusCode !== 200) return null;
  return JSON.parse(await new Response(resultado.stream).text());
}

async function gravarBruto(dados) {
  const texto = JSON.stringify(dados);
  if (process.env.MEMORIA_DIR) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(process.env.MEMORIA_DIR, { recursive: true });
    await writeFile(`${process.env.MEMORIA_DIR}/correcoes.json`, texto, "utf8");
    return;
  }
  await put(NOME, texto, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

const limpar = (valor, max) => (typeof valor === "string" ? valor.replace(/\r\n?/g, "\n").replace(/​/g, "").trim().slice(0, max) : "");

// Devolve sempre { ligada, itens } com os campos conhecidos (o que vier do arquivo é reescrito, não confiado).
export async function lerMemoria() {
  const bruto = await lerBruto();
  const itens = Array.isArray(bruto && bruto.itens) ? bruto.itens : [];
  return {
    ligada: Boolean(bruto && bruto.ligada),
    itens: itens
      .filter((i) => i && typeof i.id === "string")
      .map((i) => ({
        id: i.id.slice(0, 64),
        criadoEm: limpar(i.criadoEm, 40),
        tipo: limpar(i.tipo, 40),
        titulo: limpar(i.titulo, 200),
        original: limpar(i.original, MAX_TEXTO),
        final: limpar(i.final, MAX_TEXTO),
        ativo: i.ativo !== false,
      }))
      .slice(0, MAX_ITENS),
  };
}

export async function ligarMemoria(ligada) {
  const memoria = await lerMemoria();
  memoria.ligada = Boolean(ligada);
  await gravarBruto(memoria);
  return memoria;
}

// Acrescenta uma correção. Recusa se não houver diferença real ou se o limite de itens foi atingido.
export async function acrescentarCorrecao(bruto) {
  const original = limpar(bruto && bruto.original, MAX_TEXTO);
  const final = limpar(bruto && bruto.final, MAX_TEXTO);
  if (original.length < 20 || final.length < 20) return { erro: "Texto curto demais para virar uma correção." };
  if (original === final) return { erro: "O texto final é igual ao original: não há correção a guardar." };
  const memoria = await lerMemoria();
  if (memoria.itens.length >= MAX_ITENS) return { erro: `Limite de ${MAX_ITENS} correções atingido: apague alguma para guardar outra.` };
  memoria.itens.unshift({
    id: randomUUID(),
    criadoEm: new Date().toISOString(),
    tipo: limpar(bruto.tipo, 40),
    titulo: limpar(bruto.titulo, 200),
    original,
    final,
    ativo: true,
  });
  await gravarBruto(memoria);
  return { memoria };
}

export async function alterarCorrecao(id, ativo) {
  const memoria = await lerMemoria();
  const item = memoria.itens.find((i) => i.id === id);
  if (!item) return { erro: "Correção não encontrada." };
  item.ativo = Boolean(ativo);
  await gravarBruto(memoria);
  return { memoria };
}

export async function apagarCorrecao(id) {
  const memoria = await lerMemoria();
  const antes = memoria.itens.length;
  memoria.itens = memoria.itens.filter((i) => i.id !== id);
  if (memoria.itens.length === antes) return { erro: "Correção não encontrada." };
  await gravarBruto(memoria);
  return { memoria };
}

export async function apagarTudo() {
  const memoria = await lerMemoria();
  memoria.itens = [];
  await gravarBruto(memoria);
  return { memoria };
}
