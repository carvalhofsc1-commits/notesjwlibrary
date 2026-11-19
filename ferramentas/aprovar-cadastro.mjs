// Aprova (ou recusa) cadastros pendentes direto pelo terminal, sem abrir o app (6.10.89).
// Serve para o endereço novo do Google Cloud, onde o aparelho fica na tela de cadastro até ser aprovado e por isso não chega em Ajustes.
// Uso, no PowerShell, na pasta do projeto:
//   node ferramentas/aprovar-cadastro.mjs
//   node ferramentas/aprovar-cadastro.mjs https://outro-endereco.run.app
// A senha de administrador é digitada aqui no terminal (não aparece na tela) e vai só para o servidor escolhido.
import readline from "node:readline";

const API = String(process.argv[2] || "https://notestyle-102438360.southamerica-east1.run.app").replace(/\/+$/, "");

function perguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => {
        if (s.includes(texto)) rl.output.write(texto);
        else if (s === "\r\n" || s === "\n") rl.output.write(s);
        else rl.output.write("*");
      };
    }
    rl.question(texto, (resposta) => {
      rl.close();
      if (oculto) process.stdout.write("\n");
      resolve(String(resposta || "").trim());
    });
  });
}

async function chamar(corpo) {
  const r = await fetch(`${API}/api/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://www.notestyle.com.br" },
    body: JSON.stringify(corpo),
  });
  let dados = null;
  try { dados = await r.json(); } catch (e) { /* sem corpo */ }
  if (!r.ok) throw new Error((dados && dados.erro) || `O servidor respondeu ${r.status}.`);
  return dados;
}

console.log(`Servidor: ${API}`);
const codigo = await perguntar("Senha de administrador: ", true);
if (!codigo) { console.log("Sem senha, nada feito."); process.exit(1); }

let acesso;
try {
  acesso = (await chamar({ acao: "acesso-site-ler", codigo })).acesso || {};
} catch (e) {
  console.error(`Não consegui ler os cadastros: ${e.message}`);
  process.exit(1);
}

const pendentes = Array.isArray(acesso.pendentes) ? acesso.pendentes : [];
if (!pendentes.length) {
  console.log("Nenhum cadastro pendente. Se você acabou de enviar, confira se enviou pelo endereço deste servidor.");
  process.exit(0);
}

console.log("");
console.log("Cadastros pendentes:");
pendentes.forEach((p, i) => {
  const nome = [p.nome, p.sobrenome].filter(Boolean).join(" ") || "(sem nome)";
  const quando = p.criadoEm ? new Date(p.criadoEm).toLocaleString("pt-BR") : "";
  console.log(`  ${i + 1}) ${nome} · ${p.congregacao || "sem congregação"} · aparelho ${p.aparelhoId}… · ${quando}`);
});
console.log("");

const escolha = await perguntar("Número para APROVAR (ou r + número para recusar, Enter para sair): ");
if (!escolha) process.exit(0);
const recusar = /^r/i.test(escolha);
const n = Number(escolha.replace(/^r\s*/i, ""));
const pedido = pendentes[n - 1];
if (!pedido) { console.log("Número inválido."); process.exit(1); }

try {
  await chamar({ acao: "acesso-site-decidir", id: pedido.id, aprovar: !recusar, codigo });
  console.log(recusar ? "Cadastro recusado." : "Cadastro aprovado. No celular, feche e abra o app de novo (ou toque em verificar).");
} catch (e) {
  console.error(`Não consegui ${recusar ? "recusar" : "aprovar"}: ${e.message}`);
  process.exit(1);
}
