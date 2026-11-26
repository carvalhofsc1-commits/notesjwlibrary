// Testes das regras de créditos (6.14.63): emergência, abatimento na recarga, bloqueio e recibos. Usa uma pasta temporária (nada real).
//   node ferramentas/testar-creditos.mjs
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

process.env.HOSPEDAGEM = "local";
process.env.DADOS_DIR = await mkdtemp(join(tmpdir(), "creditos-"));
process.env.ACESSO_SITE_DIR = process.env.DADOS_DIR;
process.env.CODIGO_ADMIN = "admin-de-teste";

const acesso = await import("../api/_acessoSite.mjs");
const { detalhesDoPagamento } = await import("../api/_mercadopago.mjs");
const admin = "admin-de-teste";
const ID = "11111111-2222-4333-8444-555555555555";
const OUTRO = "99999999-2222-4333-8444-555555555555";

let ok = 0;
const passo = (t) => { ok++; console.log("✔ " + t); };
const reg = async (id = ID) => JSON.parse(await readFile(join(process.env.DADOS_DIR, "acesso-site.json"), "utf8")).aprovados[id];
const estado = async (id = ID) => (await acesso.estadoAcessoSite({ aparelhoId: id })).cadastro;
// um consumo grande: zera o saldo, qualquer que seja o preço
const gastarTudo = () => acesso.debitarCreditosUso({ aparelhoId: ID, tarefa: "estudo", entrada: 900_000_000, saida: 900_000_000 });
const podeUsar = () => acesso.mensagemSeSemCredito({ aparelhoId: ID });

async function cadastrar(id, nome) {
  const r = await acesso.pedirAcessoSite({ aparelhoId: id, nome, sobrenome: "Teste", telefone: "(11) 91111-2222", mesNascimento: 5, anoNascimento: 1985, cidade: "Goiânia", estado: "GO" });
  assert.ok(r.ok, JSON.stringify(r));
  const d = await acesso.decidirPedidoSite({ id: r.id, aprovar: true, codigoAdmin: admin });
  assert.ok(d.ok, JSON.stringify(d));
}

try {
  const { gravarConfigFaturamento } = await import("../api/_faturamento.mjs"); // sem preços, o uso não custa nada
  await gravarConfigFaturamento({ precos: { texto: { entrada: 100, saida: 100 }, esbocos: { entrada: 100, saida: 100 }, voz: { mil: 1 }, audio: { minuto: 1 } } });
  assert.ok((await acesso.definirCreditoBoasVindas({ valor: "20", codigoAdmin: admin })).ok);
  assert.equal((await acesso.lerAcessoSiteAdmin()).creditoEmergencia, 10); passo("o crédito de emergência começa em R$ 10");
  await cadastrar(ID, "Ana");
  let c = await estado();
  assert.equal(c.creditos, 20); assert.equal(c.emergenciaDivida, 0); passo("bônus de boas-vindas sem emergência");

  await gastarTudo();
  c = await estado();
  assert.equal(c.creditos, 10); assert.equal(c.emergenciaDivida, 10); passo("o consumo zerou o saldo: entrou o crédito de emergência de R$ 10");
  assert.equal(await podeUsar(), null); passo("com a emergência, a IA continua");

  await gastarTudo();
  c = await estado();
  assert.equal(c.creditos, 0); assert.equal(c.emergenciaDivida, 10); passo("gasta a emergência: não vem outra enquanto houver o que abater");
  assert.match(await podeUsar(), /crédito de emergência acabou/); passo("sem emergência, a IA para");

  // recarga menor que a dívida
  const p1 = await acesso.creditarPagamentoPix({ aparelhoId: ID, pagamentoId: "1001", valor: 4, detalhes: { pagoEm: "2026-11-26T10:00:00.000-03:00", e2e: "E" + "1".repeat(31) } });
  assert.equal(p1.abatido, 4); assert.equal(p1.creditos, 0);
  c = await estado();
  assert.equal(c.emergenciaDivida, 6); assert.match(await podeUsar(), /emergência acabou/); passo("recarga menor que a dívida só abate; continua parado e sem nova emergência");

  // recarga que quita
  const p2 = await acesso.creditarPagamentoPix({ aparelhoId: ID, pagamentoId: "1002", valor: 20 });
  assert.equal(p2.abatido, 6); assert.equal(p2.creditos, 14);
  assert.equal((await estado()).emergenciaDivida, 0); assert.equal(await podeUsar(), null); passo("a recarga abate o resto e o excedente vira saldo");
  const repetido = await acesso.creditarPagamentoPix({ aparelhoId: ID, pagamentoId: "1002", valor: 20 });
  assert.ok(repetido.jaCreditado); assert.equal(repetido.creditos, 14); passo("o mesmo Pix não credita nem abate duas vezes");

  // recibos
  let rec = (await acesso.recibosDoUsuario({ aparelhoId: ID })).recibos;
  assert.equal(rec.length, 2);
  const r2 = rec.find((r) => r.pagamentoId === "1002");
  assert.match(r2.numero, /^NS-\d{8}-[0-9A-F]{8}$/); assert.equal(r2.abatido, 6); assert.equal(r2.saldoDepois, 14); assert.equal(r2.conta.nome, "Ana Teste"); assert.equal(r2.conta.aparelho, ID);
  assert.equal(rec.find((r) => r.pagamentoId === "1001").e2e, "E" + "1".repeat(31));
  assert.equal((await estado()).ultimoRecibo, r2.numero); passo("cada compra gera um recibo com o pagamento e a conta creditada");

  // saldo parcial da emergência no momento da recarga: abate só uma vez o valor concedido
  await gastarTudo(); // gasta os 14: entra nova emergência (a anterior já foi abatida)
  c = await estado();
  assert.equal(c.creditos, 10); assert.equal(c.emergenciaDivida, 10); passo("depois de quitada, uma nova emergência é liberada quando zera de novo");
  await acesso.debitarCreditosUso({ aparelhoId: ID, tarefa: "voz", caracteres: 1000 });
  const antes = (await estado()).creditos;
  assert.ok(antes > 0 && antes < 10, "consumiu parte da emergência: " + antes);
  const usado = Math.round((10 - antes) * 10000) / 10000;
  const p3 = await acesso.creditarPagamentoPix({ aparelhoId: ID, pagamentoId: "1003", valor: 30 });
  assert.equal(p3.creditos, Math.round((30 - usado) * 10000) / 10000); passo("na recarga, o que foi consumido da emergência sai do valor recarregado");

  // valor configurável e desligado
  assert.ok((await acesso.definirCreditoEmergencia({ valor: "25,00", codigoAdmin: admin })).ok);
  assert.ok((await acesso.definirCreditoEmergencia({ valor: "abc", codigoAdmin: admin })).erro);
  assert.ok((await acesso.definirCreditoEmergencia({ valor: "5", codigoAdmin: "errado" })).erro);
  await gastarTudo();
  c = await estado();
  assert.equal(c.creditos, 25); assert.equal(c.emergenciaDivida, 25); passo("o administrador muda o valor da emergência");

  // lançamentos do administrador
  const bonus = await acesso.creditarUsuario({ aparelhoId: ID, valor: "10", codigoAdmin: admin });
  assert.equal(bonus.abatido, 25); assert.equal(bonus.creditos, 10); assert.equal(bonus.recibo, undefined); passo("bônus do administrador abate a emergência e não gera recibo");
  const pago = await acesso.creditarUsuario({ aparelhoId: ID, valor: "40", codigoAdmin: admin, pagamento: true });
  assert.equal(pago.abatido, 0); assert.equal(pago.creditos, 50); assert.ok(pago.recibo); assert.equal((await estado()).emergenciaDivida, 0); passo("pagamento lançado pelo administrador abate e gera recibo");

  // correção negativa que zera não libera emergência
  await acesso.creditarUsuario({ aparelhoId: ID, valor: "-100000", codigoAdmin: admin });
  c = await estado();
  assert.equal(c.creditos, 0); assert.equal(c.emergenciaDivida, 0); assert.match(await podeUsar(), /créditos de IA acabaram/); passo("zerar por correção não libera emergência");

  // atualizar o cadastro preserva dívida e recibos
  await acesso.creditarUsuario({ aparelhoId: ID, valor: "5", codigoAdmin: admin });
  await gastarTudo();
  const antesAtualizar = await reg();
  const up = await acesso.atualizarCadastroSite({ aparelhoId: ID, nome: "Ana", sobrenome: "Silva", telefone: "(11) 91111-2222", mesNascimento: 5, anoNascimento: 1985, cidade: "Goiânia", estado: "GO" });
  assert.ok(up.ok, JSON.stringify(up));
  const depois = await reg();
  assert.equal(depois.emergenciaDivida, antesAtualizar.emergenciaDivida); assert.equal(depois.recibos.length, antesAtualizar.recibos.length); passo("atualizar o cadastro mantém a dívida e os recibos");

  // emergência desligada; quem já estava zerado recebe ao abrir o app quando ligada
  assert.ok((await acesso.definirCreditoEmergencia({ valor: "0", codigoAdmin: admin })).ok);
  await cadastrar(OUTRO, "Bia");
  await acesso.debitarCreditosUso({ aparelhoId: OUTRO, tarefa: "estudo", entrada: 900_000_000, saida: 900_000_000 });
  assert.equal((await estado(OUTRO)).creditos, 0); assert.ok(await acesso.mensagemSeSemCredito({ aparelhoId: OUTRO })); passo("emergência em zero: sem liberação");
  await acesso.definirCreditoEmergencia({ valor: "10", codigoAdmin: admin });
  assert.equal((await estado(OUTRO)).creditos, 10); passo("quem já estava zerado pelo consumo recebe ao abrir o app");

  // Pix antigo, creditado antes dos recibos
  const bruto = await reg(OUTRO);
  assert.equal(bruto.recibos, undefined);
  // dados do Mercado Pago no recibo: só o que veio, e o E2E reconhecido pelo formato
  const e2e = "E" + "A1".repeat(15) + "Z";
  const d = detalhesDoPagamento({ date_approved: "2026-11-26T12:00:00.000-03:00", point_of_interaction: { transaction_data: { bank_info: { payer: { long_name: "Banco  Exemplo" } } } }, transaction_details: { transaction_id: e2e } });
  assert.deepEqual(d, { pagoEm: "2026-11-26T12:00:00.000-03:00", e2e, instituicaoPagador: "Banco Exemplo" });
  assert.equal(detalhesDoPagamento({ transaction_details: { transaction_id: "123456" } }).e2e, undefined); passo("dados do pagamento para o recibo");

  console.log(`\n${ok} verificações passaram.`);
} finally {
  await rm(process.env.DADOS_DIR, { recursive: true, force: true });
}
