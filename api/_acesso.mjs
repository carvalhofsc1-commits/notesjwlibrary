// Controle de acesso das tarefas de api/sugerir-formatacao.mjs, num lugar só.
// Cada tarefa declara aqui o nível de acesso que exige; o handler confere antes de despachar. Uma tarefa nova que não seja
// registrada em NIVEIS não passa por esta conferência: por isso, ao criar uma tarefa, registre-a aqui.
// Aceita o código global (variável de ambiente) ou o código personalizado do aparelho (Administração de usuários).
import { codigoDoDirigente, erro } from "./_comum.mjs";
import { recursoCodigoValido } from "./_acessoSite.mjs";

export function codigoValido(informado, aparelhoId) {
  return recursoCodigoValido("pesquisa", informado, aparelhoId);
}

// O código do dirigente vale sozinho para as tarefas do dirigente (perguntas adicionais, Estudo Bíblico do dirigente) e,
// junto com o código de pesquisa, para as que os dois cartões usam (lista de parágrafos e leitura do capítulo).
export function dirigenteValido(informado, aparelhoId) {
  return recursoCodigoValido("dirigente", informado, aparelhoId);
}

// O código de resumo (variável CODIGO_RESUMO) libera só o resumo dos capítulos da Leitura diária da Bíblia com a IA; não vale para mais nada, e os outros
// códigos não valem para ele.
export function resumoValido(informado, aparelhoId) {
  return recursoCodigoValido("resumo", informado, aparelhoId);
}

// O código do S-34 (variável CODIGO_S34) libera a lista de temas e os esboços do discurso público; vale junto com o do dirigente.
export function s34Valido(informado, aparelhoId) {
  return recursoCodigoValido("s34", informado, aparelhoId);
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
  if (dirigenteValido(body.codigoDirigente, body.aparelhoId)) return true;
  if (!codigoDoDirigente()) {
    erro(res, 503, "O código do dirigente ainda não está configurado no servidor.");
    return false;
  }
  erro(res, 403, "Código do dirigente inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
  return false;
}

// publico: sem código · pesquisa: código de pesquisa · pesquisa-ou-dirigente: um dos dois · dirigente: código do dirigente · s34: o do dirigente e o do S-34 · resumo: o código de resumo.
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
  // Código de resumo (só o resumo dos capítulos da Leitura diária da Bíblia)
  "leitura-biblia": "resumo",
  "biblia-texto": "resumo",
  // Código de pesquisa ou do dirigente (os cartões de comentar e de dirigir usam a mesma leitura)
  "estudo-lista": "pesquisa-ou-dirigente",
  "estudo-paragrafos": "pesquisa-ou-dirigente", // o texto dos parágrafos de uma pergunta (sem IA)
  "ebc-ler": "pesquisa-ou-dirigente",
  "apostila-imagens": "pesquisa-ou-dirigente",
  "backup-campos": "pesquisa-ou-dirigente",
  "backup-semanas": "pesquisa-ou-dirigente",
  "backup-semana": "pesquisa-ou-dirigente",
  // Código do dirigente
  "estudo-perguntas": "dirigente",
  "estudo-recap": "dirigente", // as respostas da recapitulação de A Sentinela, no Preparar para dirigir
  "ebc-dirigente": "dirigente",
  "tesouros-ler": "dirigente",
  tesouros: "dirigente",
  "publico-lista": "s34",
  "publico-ler": "s34",
  "publico-esboco": "s34",
  publico: "s34",
  "publico-importar": "s34",
  "publico-canticos": "s34", // sugerir o cântico inicial do discurso público // passar para o formato do app um esboço que o orador já preparou (arquivo importado)
  versiculos: "dirigente",
  "outros-pesquisar": "dirigente",
  "outros-ler": "dirigente",
  outros: "dirigente",
  "discurso-ler": "dirigente",
  discurso: "dirigente",
  // Anotações: programa da assembleia/congresso (pub-media + WOL) sem código; textos bíblicos com o de resumo
  "programa-pub": "publico",
  "programas-lista": "publico",
  // Formatar as anotações com IA (tela Anotações): código de pesquisa, como a formatação da tela Formatar
  "anotacoes-formatar": "pesquisa",
  // Perguntas de recapitulação da assembleia: a IA só organiza (atribui) as perguntas aos discursos quando a ordem não bate
  "anotacoes-perguntas": "pesquisa",
  "anotacoes-versiculos": "resumo",
};

// Devolve true se o pedido pode seguir; senão já respondeu com o erro. Sem tarefa no corpo = formatação comum (tela Formatar).
export function exigirAcesso(res, body) {
  const tarefa = body && typeof body.tarefa === "string" && body.tarefa ? body.tarefa : "formatar";
  const nivel = Object.hasOwn(NIVEIS, tarefa) ? NIVEIS[tarefa] : "publico";
  if (nivel === "publico") return true;
  if (nivel === "dirigente") return acessoDoDirigente(res, body);
  if (nivel === "s34") {
    if (!acessoDoDirigente(res, body)) return false;
    if (s34Valido(body.codigoS34, body.aparelhoId)) return true;
    if (!process.env.CODIGO_S34) {
      erro(res, 503, "O código do S-34 ainda não está configurado no servidor.");
      return false;
    }
    erro(res, 403, "Código do S-34 inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
    return false;
  }
  if (nivel === "resumo") {
    if (resumoValido(body.codigoResumo, body.aparelhoId)) return true;
    if (!process.env.CODIGO_RESUMO) {
      erro(res, 503, "O código de resumo ainda não está configurado no servidor.");
      return false;
    }
    erro(res, 403, "Código de resumo inválido. Informe-o em Ajustes → 🔐 Autorização de acessos.");
    return false;
  }
  if (nivel === "pesquisa") {
    if (codigoValido(body.codigo, body.aparelhoId)) return true;
    if (!process.env.CODIGO_ESTUDO) {
      erro(res, 503, "A leitura do estudo ainda não está configurada no servidor.");
      return false;
    }
    erro(res, 403, "Código de pesquisa inválido.");
    return false;
  }
  if (codigoValido(body.codigo, body.aparelhoId) || dirigenteValido(body.codigoDirigente, body.aparelhoId)) return true;
  recusarAcesso(res, body);
  return false;
}
