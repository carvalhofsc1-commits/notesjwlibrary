// Controle de acesso das tarefas de api/sugerir-formatacao.mjs, num lugar só.
// Cada tarefa declara aqui o nível de acesso que exige; o handler confere antes de despachar. Uma tarefa nova que não seja
// registrada em NIVEIS não passa por esta conferência: por isso, ao criar uma tarefa, registre-a aqui.
import { codigoDoDirigente, erro, textosIguais } from "./_comum.mjs";

export function codigoValido(informado) {
  return textosIguais(informado, process.env.CODIGO_ESTUDO);
}

// O código do dirigente vale sozinho para as tarefas do dirigente (perguntas adicionais, Estudo Bíblico do dirigente) e,
// junto com o código de pesquisa, para as que os dois cartões usam (lista de parágrafos e leitura do capítulo).
export function dirigenteValido(informado) {
  return textosIguais(informado, codigoDoDirigente());
}

// O código do S-34 (variável CODIGO_S34) libera a lista de temas e os esboços do discurso público; vale junto com o do dirigente.
export function s34Valido(informado) {
  return textosIguais(informado, process.env.CODIGO_S34);
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

// publico: sem código · pesquisa: código de pesquisa · pesquisa-ou-dirigente: um dos dois · dirigente: código do dirigente · s34: o do dirigente e o do S-34.
export const NIVEIS = {
  // Formatar (tela Formatar → Opções com IA): só com o código de pesquisa
  formatar: "pesquisa",
  sentinela: "pesquisa",
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
  "publico-lista": "s34",
  "publico-ler": "s34",
  "publico-esboco": "s34",
  publico: "s34",
  versiculos: "dirigente",
  "outros-pesquisar": "dirigente",
  "outros-ler": "dirigente",
  outros: "dirigente",
  "discurso-ler": "dirigente",
  discurso: "dirigente",
};

// Devolve true se o pedido pode seguir; senão já respondeu com o erro. Sem tarefa no corpo = formatação comum (tela Formatar).
export function exigirAcesso(res, body) {
  const tarefa = body && typeof body.tarefa === "string" && body.tarefa ? body.tarefa : "formatar";
  const nivel = Object.hasOwn(NIVEIS, tarefa) ? NIVEIS[tarefa] : "publico";
  if (nivel === "publico") return true;
  if (nivel === "dirigente") return acessoDoDirigente(res, body);
  if (nivel === "s34") {
    if (!acessoDoDirigente(res, body)) return false;
    if (!process.env.CODIGO_S34) {
      erro(res, 503, "O código do S-34 ainda não está configurado no servidor.");
      return false;
    }
    if (!s34Valido(body.codigoS34)) {
      erro(res, 403, "Código do S-34 inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
      return false;
    }
    return true;
  }
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
