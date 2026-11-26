// Testes da senha master (6.14.72): vale por todos os códigos só no aparelho do usuário, nunca como senha de administrador. Usa uma pasta
// temporária (nada real).
//   node ferramentas/testar-senha-master.mjs
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

process.env.HOSPEDAGEM = "local";
process.env.DADOS_DIR = await mkdtemp(join(tmpdir(), "master-"));
process.env.ACESSO_SITE_DIR = process.env.DADOS_DIR;
process.env.ESTATISTICAS_DIR = process.env.DADOS_DIR;
process.env.CODIGO_ADMIN = "admin-de-teste";
process.env.CODIGO_ESTUDO = "estudo-de-teste";

const acesso = await import("../api/_acessoSite.mjs");
const { exigirAcesso, NIVEIS } = await import("../api/_acesso.mjs");
const config = (await import("../api/config.mjs")).default;
const admin = "admin-de-teste";
const ID = "11111111-2222-4333-8444-555555555555";
const OUTRO = "99999999-2222-4333-8444-555555555555";

let ok = 0;
let pedidos = 0; // um endereço por pedido: o bloqueio por tentativas erradas não entra neste teste
const passo = (t) => { ok++; console.log("✔ " + t); };

function resposta() {
  const r = { codigo: 200, corpo: null, cabecalhos: {} };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (d) => { r.corpo = d; return r; };
  r.setHeader = (n, v) => { r.cabecalhos[n] = v; };
  r.end = () => r;
  return r;
}
async function pedir(body) {
  const res = resposta();
  await config({ method: "POST", body, headers: { origin: "http://localhost:8091", "x-forwarded-for": "10.0.0." + ++pedidos }, socket: {}, query: {} }, res);
  return res;
}
async function cadastrar(id, nome) {
  const r = await acesso.pedirAcessoSite({ aparelhoId: id, nome, sobrenome: "Teste", telefone: "(11) 91111-2222", mesNascimento: 5, anoNascimento: 1985, cidade: "Goiânia", estado: "GO" });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok((await acesso.decidirPedidoSite({ id: r.id, aprovar: true, codigoAdmin: admin })).ok);
}
const doAdmin = async (id = ID) => (await acesso.lerAcessoSiteAdmin()).aprovados.find((a) => a.aparelhoIdCompleto === id);
const recursos = acesso.RECURSOS_CODIGO.map((r) => r.id);

try {
  await cadastrar(ID, "Ana");
  await cadastrar(OUTRO, "Bia");

  assert.equal((await doAdmin()).master, null); passo("ninguém começa com senha master");
  let r = await pedir({ acao: "acesso-site-gerar-master", codigo: "errada", aparelhoId: ID });
  assert.equal(r.codigo, 403);
  assert.match(r.corpo.erro, /administrador/); passo("só o administrador gera");
  r = await pedir({ acao: "acesso-site-gerar-master", codigo: admin, aparelhoId: ID });
  assert.equal(r.codigo, 200, JSON.stringify(r.corpo));
  const senha = (await doAdmin()).master.codigo;
  assert.match(senha, /^NS-MASTER-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await doAdmin(OUTRO)).master, null); passo("a senha é de um usuário só");

  await acesso.prepararCodigosPessoais();
  for (const rec of recursos) assert.ok(acesso.recursoCodigoValido(rec, senha, ID), rec);
  passo("vale por todos os códigos: " + recursos.join(", "));
  assert.ok(acesso.recursoCodigoValido("pesquisa", senha.toLowerCase(), ID)); passo("não diferencia maiúsculas");
  for (const rec of recursos) assert.ok(!acesso.recursoCodigoValido(rec, senha, OUTRO), rec);
  assert.ok(!acesso.recursoCodigoValido("pesquisa", senha, "")); passo("não vale em outro aparelho nem sem aparelho");

  for (const [tarefa, nivel] of Object.entries(NIVEIS)) {
    if (nivel === "publico") continue;
    const res = resposta();
    const passou = exigirAcesso(res, { tarefa, aparelhoId: ID, codigo: senha, codigoDirigente: senha, codigoS34: senha, codigoResumo: senha });
    assert.ok(passou, tarefa + " " + JSON.stringify(res.corpo));
  }
  passo("passa em todas as tarefas da IA que pedem código");

  for (const acao of ["codigo-conferir", "dirigente-conferir", "leitura-conferir", "texto-conferir", "resumo-conferir", "s34-conferir", "master-conferir"]) {
    assert.equal((await pedir({ acao, codigo: senha, aparelhoId: ID })).codigo, 200, acao);
  }
  passo("é aceita na conferência de cada campo");

  assert.equal((await pedir({ acao: "admin-entrar", codigo: senha, aparelhoId: ID })).codigo, 403);
  assert.equal((await pedir({ acao: "acesso-site-gerar-master", codigo: senha, aparelhoId: OUTRO })).codigo, 403);
  assert.ok((await acesso.decidirPedidoSite({ id: "x", aprovar: true, codigoAdmin: senha })).erro);
  passo("não é senha de administrador");

  assert.equal((await pedir({ acao: "acesso-site-gerar-codigo", codigo: admin, aparelhoId: ID, recurso: "leitura" })).codigo, 200);
  const pessoal = (await doAdmin()).codigos.leitura.codigo;
  const publico = await acesso.estadoAcessoSite({ aparelhoId: ID });
  assert.ok(!JSON.stringify(publico).includes(senha));
  const dados = { aparelhoId: ID, nome: "Ana", sobrenome: "Nova", telefone: "(11) 91111-2222", mesNascimento: 5, anoNascimento: 1985, cidade: "Goiânia", estado: "GO" };
  const repetido = await acesso.pedirAcessoSite(dados);
  const atualizado = await acesso.atualizarCadastroSite(dados);
  assert.ok(atualizado.ok);
  assert.ok(!JSON.stringify([repetido, atualizado]).includes(senha)); passo("nunca vai nas respostas ao aparelho");
  assert.ok(!JSON.stringify([publico, repetido, atualizado]).includes(pessoal));
  assert.ok(repetido.jaAprovado && !("codigos" in repetido.cadastro) && !("codigos" in atualizado.cadastro));
  passo("os códigos personalizados também não vão ao aparelho");
  assert.equal((await doAdmin()).codigos.leitura.codigo, pessoal);
  assert.equal((await doAdmin()).master.codigo, senha); passo("atualizar o cadastro não apaga a senha nem os códigos");

  await pedir({ acao: "acesso-site-gerar-master", codigo: admin, aparelhoId: ID });
  const nova = (await doAdmin()).master.codigo;
  await acesso.prepararCodigosPessoais();
  assert.notEqual(nova, senha);
  assert.ok(!acesso.recursoCodigoValido("pesquisa", senha, ID) && acesso.recursoCodigoValido("pesquisa", nova, ID));
  passo("gerar outra invalida a anterior");

  assert.equal((await pedir({ acao: "acesso-site-expirar-master", codigo: admin, aparelhoId: ID })).codigo, 200);
  assert.equal((await doAdmin()).master.ativo, false);
  assert.ok(!acesso.recursoCodigoValido("pesquisa", nova, ID));
  assert.equal((await pedir({ acao: "master-conferir", codigo: nova, aparelhoId: ID })).codigo, 403);
  passo("expirada, deixa de valer");

  console.log(`\n${ok} testes passaram.`);
} finally {
  await rm(process.env.DADOS_DIR, { recursive: true, force: true });
}
