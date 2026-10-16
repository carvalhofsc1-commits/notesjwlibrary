// Alterações dos prompts feitas pelo administrador, guardadas no Global Config (só o que difere do padrão).
import { lerItem, gravarItem } from "./_armazem.mjs";
import { montarPrompts } from "./_prompts.mjs";

const CHAVE = "prompts_ia";
const CHAVE_ANTERIOR = "prompts_ia_anterior";
const CHAVE_LIMITES = "limites_ia";
const VALIDADE_MS = 20_000; // cada instância relê no máximo a cada 20 s; uma alteração vale para todos em instantes

let cache = null;
let cacheLimites = null;

export function esquecerCache() {
  cache = null;
  cacheLimites = null;
}

function objetoSimples(valor) {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

export async function lerAlteracoes() {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.valor;
  const valor = objetoSimples(await lerItem(CHAVE));
  cache = { valor, em: Date.now() };
  return valor;
}

export async function lerLimites() {
  if (cacheLimites && Date.now() - cacheLimites.em < VALIDADE_MS) return cacheLimites.valor;
  const valor = objetoSimples(await lerItem(CHAVE_LIMITES));
  cacheLimites = { valor, em: Date.now() };
  return valor;
}

export async function gravarLimites(novos) {
  await gravarItem(CHAVE_LIMITES, novos);
  cacheLimites = { valor: novos, em: Date.now() };
}

export async function lerAnterior() {
  return objetoSimples(await lerItem(CHAVE_ANTERIOR));
}

export async function carregarPrompts() {
  return montarPrompts(await lerAlteracoes(), await lerLimites());
}

// Grava as alterações atuais e guarda as anteriores (uma versão de volta).
export async function gravarAlteracoes(novas, anteriores) {
  await gravarItem(CHAVE_ANTERIOR, anteriores);
  await gravarItem(CHAVE, novas);
  cache = { valor: novas, em: Date.now() };
}
