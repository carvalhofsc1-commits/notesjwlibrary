// Controle de acesso das tarefas de api/sugerir-formatacao.mjs, num lugar só.
// Cada tarefa declara aqui o nível de acesso que exige; o handler confere antes de despachar. Uma tarefa nova que não seja
// registrada em NIVEIS não passa por esta conferência: por isso, ao criar uma tarefa, registre-a aqui (use "publico" só
// quando ela for aberta de propósito, como a formatação com IA).
import { codigoDoDirigente, erro, textosIguais } from "./_comum.mjs";

export function codigoValido(informado) {
  return textosIguais(informado, process.env.CODIGO_ESTUDO);
}

// O código do dirigente vale sozinho para as tarefas do dirigente (perguntas adicionais, Estudo Bíblico do dirigente) e,
// junto com o código de pesquisa, para as que os dois cartões usam (lista de parágrafos e leitura do capítulo).
export function dirigenteValido(informado) {
  return textosIguais(informado, codigoDoDirigente());
}

// Recusa com a mensagem do código que a pessoa estava usando: o do dirigente, se ele veio no pedido; senão o de pesquisa.
export function recusarAcesso(res, body) {
  if (typeof body.codigoDirigente === "string" && body.codigoDirigente) {
    return erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  }
  return erro(res, 403, "Código de pesquisa inválido.");
}

// Confere o código do dirigente; responde com o erro e devolve false se não valer.
export function acessoDoDirigente(res, body) {
  if (!codigoDoDirigente()) {
    erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
    return false;
  }
  if (!dirigenteValido(body.codigoDirigente)) {
    erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
    return false;
  }
  return true;
}

// publico: sem código · pesquisa: código de pesquisa · pesquisa-ou-dirigente: um dos dois · dirigente: código do dirigente.
export const NIVEIS = {
  // Formatação (aberta de propósito; vale o limite de pedidos por IP)
  sentinela: "publico",
  // Código de pesquisa
  estudo: "pesquisa",
  "texto-diario-comentarios": "pesquisa",
  ebc: "pesquisa",
  joias: "pesquisa",
  "joias-ler": "pesquisa",
  // Código de pesquisa ou do dirigente (os cartões de comentar e de dirigir usam a mesma leitura)
  "estudo-lista": "pesquisa-ou-dirigente",
  "ebc-ler": "pesquisa-ou-dirigente",
  "apostila-imagens": "pesquisa-ou-dirigente",
  "backup-campos": "pesquisa-ou-dirigente",
  "backup-semanas": "pesquisa-ou-dirigente",
  "backup-semana": "pesquisa-ou-dirigente",
  // Código do dirigente
  "estudo-perguntas": "dirigente",
  "ebc-dirigente": "dirigente",
  "tesouros-ler": "dirigente",
  tesouros: "dirigente",
  "publico-lista": "dirigente",
  "publico-ler": "dirigente",
  "publico-esboco": "dirigente",
  publico: "dirigente",
  versiculos: "dirigente",
  "outros-pesquisar": "dirigente",
  "outros-ler": "dirigente",
  outros: "dirigente",
  "discurso-ler": "dirigente",
  discurso: "dirigente",
};

// Devolve true se o pedido pode seguir; senão já respondeu com o erro. Tarefa fora de NIVEIS (a formatação comum) segue.
export function exigirAcesso(res, body) {
  const nivel = body && Object.hasOwn(NIVEIS, body.tarefa) ? NIVEIS[body.tarefa] : "publico";
  if (nivel === "publico") return true;
  if (nivel === "dirigente") return acessoDoDirigente(res, body);
  if (nivel === "pesquisa") {
    if (!process.env.CODIGO_ESTUDO) {
      erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
      return false;
    }
    if (!codigoValido(body.codigo)) {
      erro(res, 403, "Código de pesquisa inválido.");
      return false;
    }
    return true;
  }
  if (codigoValido(body.codigo) || dirigenteValido(body.codigoDirigente)) return true;
  recusarAcesso(res, body);
  return false;
}
