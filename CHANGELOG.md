# Histórico de versões do NoteStyle

Movido do comentário da constante APP_VERSION (index.html) em 2026-10-28.

## 6.2.13

Páginas Sobre, Privacidade e Termos de Uso: botão "📄 Exportar esta página (.docx)" no fim de cada uma, visível só para o administrador (senha de administrador salva neste aparelho). Gera o Word com o conteúdo completo (títulos, parágrafos, listas, tabelas e negrito/itálico). Script: exportar-pagina.js.

## 6.2.12

Lista de temas do S-34: a coluna do número ficou mais larga e sem quebra, para o ✔ não descer nos temas de 3 dígitos (100 em diante).

## 6.2.11

Lista de temas do S-34: as células usavam a classe "ok", que já existia para mensagens (verde, negrito, centralizada); agora têm classes próprias e ficam alinhadas à esquerda.

## 6.2.10

Lista de temas do S-34: número e título alinhados à esquerda.

## 6.2.09

Ajustes → Esboços de discursos públicos (S-34): a lista de temas agora se monta sozinha, de 1 a 200, com os esboços importados no servidor, em células (número e título; "falta importar" para os que só estão na lista guardada; "—" para os vazios), com filtro "só os que faltam". Colar a lista passou para "Colar ou corrigir a lista (opcional)".

## 6.2.08

"O que está guardado neste aparelho": linha divisória entre o cabeçalho e a lista.

## 6.2.07

Prompts da IA → Diversos: anotação do código de leitura (como as do código de pesquisa e do dirigente; vai ao servidor em api/config.mjs). Ajustes → Privacidade → "O que está guardado neste aparelho": lixeira pequena em cada item para apagar só aquele (com confirmação). "Puxar para atualizar" só na tela Início. Barra de baixo: sem o elástico de rolagem e em camada própria, para não se soltar da base no iPhone ao rolar.

## 6.2.06

Tocador "pronto": os botões Ler e Continuar da tela Leitura, o 🔊 do texto diário, o dos comentários e o do campo de texto abrem o tocador sem começar a ler, para escolher a voz (🗣️) e a velocidade antes; o ▶️ Iniciar começa. Tocar numa frase da Leitura, o ⏮️ e o ⏭️ e trocar a voz durante a leitura continuam imediatos.

## 6.2.05

Caixa do áudio: o botão Compartilhar não corta mais o texto (cada botão toma a largura do seu texto e, se faltar espaço, o último desce para a linha de baixo).

## 6.2.04

Tocador mais limpo ao fim de uma leitura: sai o ✖️ largo (a caixa do áudio tem o seu Fechar) e saem os ícones 💾 do texto diário e dos comentários (o Salvar áudio da caixa basta). Sobram só os botões Salvar áudio e Fechar.

## 6.2.03

Lista das vozes refeita (ícone de mulher e de homem, nomes à esquerda e o jeito ao lado; antes o nome ficava invisível); A− chega a letras bem menores (10 tamanhos, de 0,55 a 1,75 rem); salvar o áudio de qualquer leitura: ao fim de uma leitura por frases o tocador não se fecha mais sozinho e oferece "Salvar áudio" (as partes ouvidas já estão guardadas), e o texto diário e os comentários ganharam o ícone 💾 ao lado do 🔊. A caixa do áudio agora fica no tocador, o mesmo cartão de todas as telas.

## 6.2.02

Leitura em voz alta: botão 💾 Áudio, que salva o áudio da leitura num arquivo MP3 (até 30 minutos, a partir da frase em que a leitura parou). O app pede ao servidor as partes que ainda não foram ouvidas (3 de cada vez, com aviso do que falta e do tempo), junta tudo e oferece compartilhar ou baixar. As partes da Leitura ficam guardadas na memória enquanto a tela está aberta e são descartadas ao sair da tela, limpar ou trocar o arquivo.

## 6.2.01

Leitura em voz alta, em todas as telas (o tocador é o mesmo em todas): botão 🗣️ para trocar a voz (30 vozes, femininas e masculinas, ou "Padrão do app"); a escolha fica no aparelho e, durante uma leitura por frases, ela recomeça da frase atual com a voz nova; mais velocidades (0,5× a 2×); e o tempo tocado e o total ("1:12 / 25:40") embaixo da barra de andamento. O servidor (api/voz.mjs) aceita o nome da voz e confere na lista.

## 6.2.00

Nova numeração: a versão tem três números e **o último nunca passa de 99**, sempre com dois dígitos (6.2.00, 6.2.01 … 6.2.99; depois dela vem 6.3.00, 6.3.01…). Esta versão não muda funções: ela só fecha a série 6.1 (que chegou à 6.1.113) e começa a 6.2. O `package.json` guarda o mesmo número no formato do npm, sem o zero à esquerda (6.2.0, 6.2.1 … 6.2.99).

## 6.1.113

Limpeza e organização: CSS e JS em app.css e app.js, níveis de acesso da IA em api/_acesso.mjs, histórico de versões em CHANGELOG.md, README, código morto removido e respostas 503 padronizadas

## Versões anteriores à 6.1.112

versões: 4.7.1, 4.7.2… 4.9.9 e depois 5.0.0 (e 5.0.1… 5.0.9 e então 5.1.0, …, 5.9.9 e então 6.0.0, …, 6.0.9 e então 6.1.0, 6.1.1, 6.1.2, 6.1.3, 6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.1.8, 6.1.9, 6.1.10, 6.1.11, 6.1.12, 6.1.13, 6.1.14, 6.1.15, 6.1.16, 6.1.17, 6.1.18, 6.1.19, 6.1.20, 6.1.21, 6.1.22, 6.1.23, 6.1.24, 6.1.25, 6.1.26, 6.1.27, 6.1.28, 6.1.29, 6.1.30, 6.1.31, 6.1.32, 6.1.33, 6.1.34, 6.1.35, 6.1.36, 6.1.37, 6.1.38, 6.1.39, 6.1.40, 6.1.41, 6.1.42, 6.1.43, 6.1.44, 6.1.45, 6.1.46, 6.1.47, 6.1.48, 6.1.49, 6.1.50, 6.1.51, 6.1.52, 6.1.53, 6.1.54, 6.1.55, 6.1.56, 6.1.57, 6.1.58, 6.1.59, 6.1.60, 6.1.61, 6.1.62, 6.1.63, 6.1.64, 6.1.65, 6.1.66, 6.1.67, 6.1.68, 6.1.69, 6.1.70, 6.1.71, 6.1.72, 6.1.73, 6.1.74, 6.1.75, 6.1.76…)

## 6.1.112

Leitura em voz alta: botões A− e A+ para o tamanho da letra do texto (ao lado das setas da busca, que ficou um pouco menor), texto informativo do topo um nível maior e as mesmas distâncias entre todos os campos

## 6.1.111

os dados do arquivo na Leitura em voz alta (nome e resumo) ficam em no máximo duas linhas, com letra menor que se ajusta à largura da tela

## 6.1.110

na Leitura em voz alta o campo de texto ganhou mais espaço: a caixa "Ler o que está entre parênteses" foi para baixo da barra de botões, e a busca, os botões de marcar/Word, os de ler/editar/limpar e os do tocador ficaram mais finos

## 6.1.109

no marca-texto da Leitura em voz alta, com o modo Marcar ligado aparece o botão Cor, com verde, amarelo, laranja, rosa e roxo; cada marca guarda a sua cor, e ela sai igual na prévia e no arquivo Word

## 6.1.108

o campo de busca da Leitura em voz alta ganhou um ✕ pequeno, dentro do campo, para limpar a busca

## 6.1.107

a tela Leitura em voz alta ganhou a busca no texto (campo acima do texto, sem diferença entre maiúsculas e acentos, com os resultados marcados em azul e as setas ▲ ▼ para passar de um a outro, na vista e na edição)

## 6.1.106

a página Pesquisas e respostas salvas abre com todas as categorias (Comentários, Dirigentes e Esboços) recolhidas

## 6.1.105

em Ajustes, a página Prompts da IA abre direto, sem a tela de transição ("Entrando…"): a linha fica esmaecida até os prompts chegarem e só então a página aparece

## 6.1.104

a voz não lê mais o asterisco que aparece no texto (antes dizia "por" ou "para"), e os dados do arquivo carregado na Leitura em voz alta ficam numa moldura fina e discreta

## 6.1.103

nos comentários adicionais do texto diário o botão de ouvir virou só o ícone 🔊, no canto direito do cabeçalho, com uma linha separando o cabeçalho do conteúdo

## 6.1.102

a barra de baixo ganhou os atalhos Leitura (em voz alta) e Pesquisas (e respostas salvas), com o Reuniões continuando no centro e em destaque

## 6.1.101

na Leitura em voz alta o botão ⏮️ ao lado de Continuar virou ⏹️ (stop): para a leitura e volta ao início do texto, sem começar a ler

## 6.1.100

tocador só com ícones, do mesmo tamanho e alinhados, com o novo ⏮️ para voltar à frase anterior; na Leitura em voz alta os botões Marcar e Word somem durante a leitura e voltam ao pausar ou parar; a barra de andamento passa a contar o texto todo, então ao continuar de onde parou ela já começa no ponto certo (e não em 0%)

## 6.1.99

na Leitura em voz alta o texto ocupa todo o espaço que sobra na tela (sem a área em branco no fim), com o tocador aberto ou fechado

## 6.1.98

o tocador da Leitura em voz alta e do texto diário ganhou o botão ⏭️ Avançar, que pula para a próxima frase; na Leitura em voz alta, a caixa "Ler o que está entre parênteses" (só desta tela) escolhe se a voz lê ou pula o que estiver entre parênteses

## 6.1.97

texto diário: os comentários adicionais ganharam o botão 🔊 Ouvir os comentários, com o tocador e a frase lida em destaque; Leitura em voz alta: marca-texto (🖍️ Marcar, só com a leitura parada ou em pausa; toque numa frase ou selecione um trecho; as marcas ficam gravadas com o texto) e 📄 Word, que mostra o documento marcado numa prévia e o exporta para .docx com os trechos em verde

## 6.1.96

na Leitura em voz alta, com o tocador aberto (lendo ou em pausa) os botões Ler/Continuar, Editar e Limpar ficam escondidos, para não haver duas barras com as mesmas funções; voltam ao fechar o tocador

## 6.1.95

na Leitura em voz alta o botão de continuar virou ▶️ Continuar, numa linha só (o percentual onde parou foi para o resumo do texto), e no texto diário a frase lida volta a ser marcada nos comentários com referência no fim (a voz pula a referência e o app agora casa as frases ignorando as que ficam mudas; quando não casa, não marca nada em vez de marcar o parágrafo todo)

## 6.1.94

atalhos do Início no celular com linhas de mesma altura; PDF e Word importados com títulos e negritos mantidos, parágrafos separados por linha em branco e sem cabeçalhos, rodapés, linhas --- e marcas de lista (testado com o PDF da COMIGO); o texto abre direto na vista de leitura (Editar para corrigir) e fica gravado no aparelho, um só por vez, com o ponto em que a leitura parou e o botão Continuar; o gesto de puxar para atualizar fica desligado na Leitura em voz alta

## 6.1.93

Leitura em voz alta: barra de andamento junto do percentual; tocador logo abaixo do campo de texto e botões abaixo dele; nome, qualidade, tom e altura da voz (definidos em Ajustes) em letras pequenas no tocador; destaque da frase mais certo (o app acha as pausas no áudio e as casa com as trocas de frase, em vez de só proporcional aos caracteres); cabeçalhos e rodapés repetidos dos PDFs não são lidos; o nome do arquivo importado continua à mostra depois de Concluir; e o texto diário também ganhou o destaque da frase lida

## 6.1.92

na Leitura em voz alta a linha com palavras, caracteres e tempo estimado de áudio passou a ser calculada sempre a partir do texto que está no campo: ao digitar ou colar, ao importar, ao tocar em Concluir e ao mudar a velocidade, e continua à mostra na vista de frases

## 6.1.91

na Leitura em voz alta o campo de texto passou a ocupar a tela (antes ficava com 2 linhas) com os botões à mostra, sem o cabeçalho do app e com a ajuda recolhida; novo botão ✅ Concluir, que termina a edição e mostra o texto em frases sem ler; a tela deixou de ter o botão ◀ Voltar (a barra de baixo já leva ao Início) e a cor da tela e do atalho do Início virou rosa, no lugar do verde

## 6.1.90

nova função Leitura em voz alta (atalho do Início, no lugar de Pesquisas e respostas salvas, que continua em Reuniões): importa um PDF ou um Word (lido no aparelho) ou recebe um texto colado e o lê em voz alta, com a frase que está sendo lida destacada na tela e a opção de tocar numa frase para ouvir dali; vale só para quem tem o código de leitura (variável CODIGO_LEITURA na Vercel; informado em Ajustes → Autorização de acessos)

## 6.1.89

em Ajustes, tocar em Prompts da IA (só administrador) abre direto a página de prompts; saíram o texto explicativo e o botão Visualizar e editar prompts

## 6.1.88

os botões azuis do app (como Criar modelo, Salvar para todos e o seletor Criar novo/Alterar existente) passaram a usar um azul mais claro (#60a5fa, com #3b82f6 ao passar o mouse); links, bordas e contornos mantêm o azul de antes

## 6.1.87

nas páginas de Reuniões os botões Opções principais de formatação e Outras opções de formatação ficam juntos e o texto explicativo vai para o fim; os botões ← Voltar das páginas Sobre, Privacidade e Termos de Uso voltam à tela anterior (Ajustes, quando foram abertas de lá) em vez de ir ao Início

## 6.1.86

a caixa 🛠️ Outras opções de formatação também aparece na página Pesquisas e respostas salvas, abaixo do campo de texto

## 6.1.85

o botão Pesquisas e respostas salvas, na tela Reuniões, deixou de mostrar a quantidade de pesquisas salvas, como (8)

## 6.1.84

saíram os botões ⚠️ Relatar problema com esta resposta (o relato continua em Ajustes → Privacidade e dados deste aparelho) e o grande ↩️ Desfazer formatação (vermelho); o ícone ↩️ de desfazer, no alto do campo de texto e entre as opções principais, passou a ter fundo vermelho

## 6.1.83

a caixa 🛠️ Outras opções de formatação (maiúsculas, tipos de caracteres, listas, emojis, modelos) também aparece nas páginas Preparar para comentar, Preparar para dirigir e Preparação de discursos e esboços, logo abaixo do campo de texto, e o aviso dessas páginas passou a apontar para Formatar só para as opções de formatação com IA

## 6.1.82

nas respostas da IA que reproduzem na íntegra um texto bíblico com mais de um versículo (leitura LEIA dos esboços, textos transcritos nos comentários do estudo, no resumo da formatação com IA e nas joias), o começo de cada versículo, do segundo em diante, vem marcado com o número em negrito entre colchetes, como [𝟐𝟗] (e [𝟐𝟖:𝟏𝟗] quando o trecho passa a outro capítulo); o servidor manda a marca como [n] só no texto que o app mostra, a IA continua recebendo o texto corrido, e a leitura em voz alta não lê esses números

## 6.1.81

Caracteres, ícones e emoticons ganhou o seu 💾 Salvar para todos (só para o administrador), que publica os caracteres adicionados, os favoritos, a faixa rápida e o tipo de caractere escolhido como padrão de todos, sem mexer em modelos, categorias e opções da IA; com isso o quadro geral 🛡️ Salvar como padrão de todos, em Configurações padrão do app, deixou de ser necessário e foi retirado (Aplicar e Mesclar continuam, pois são o lado de quem recebe o padrão); os botões Salvar para todos dos modelos e dos caracteres passaram a usar o mesmo código, e o aviso antes de salvar mostra quantos itens serão publicados

## 6.1.80

a tela de categorias (antes Gerenciar categorias de modelos, agora Criar ou alterar categoria) ganhou a mesma separação dos modelos: "➕ Criar nova" (só o nome da categoria nova e o botão Criar categoria; nenhuma categoria existente é mudada) e "✏️ Alterar existente" (escolhe-se a categoria numa lista que começa em "— Escolha a categoria —"; só então aparecem Renomear e Excluir, que valem para ela); a categoria oficial REUNIÕES, que não pode ser renomeada nem excluída, mostra um aviso no lugar dos botões; criar categoria sem nome ou com nome que já existe agora avisa em vez de não fazer nada ou repetir a categoria; e excluir uma categoria vazia pede confirmação pelo próprio app

## 6.1.79

a tela Criar ou alterar modelo (Ajustes → Gerenciar modelos e categorias) foi reorganizada em duas ações separadas, para não haver dúvida sobre o que o formulário faz: "➕ Criar novo" (formulário em branco, sem lista de modelos; o botão Criar modelo só cria e nenhum modelo existente é mudado; depois de criar o formulário volta em branco) e "✏️ Alterar existente" (escolhe-se o modelo numa lista agrupada por categoria, o formulário só aparece depois da escolha, e Salvar alterações e Excluir valem para esse modelo); abaixo vêm nome, texto com o botão Inserir {texto} logo abaixo e categoria; "Aparecer também em outras categorias" virou uma opção recolhida e some quando só existe uma categoria; "Restaurar modelos padrão" foi para "Mais opções" e pede confirmação pelo app; os avisos de categoria agora aparecem na própria seção de categorias; e o administrador ganhou o botão "Salvar para todos", que publica os modelos e as categorias como padrão de todos os usuários (sem mexer em caracteres, favoritos e opções da IA)

## 6.1.78

nas páginas Sobre, Política de Privacidade e Termos de Uso, o link Voltar virou um botão pequeno e discreto, centralizado na última linha da página

## 6.1.77

(1) em Ajustes, os links Sobre o app, Privacidade e Termos de Uso viraram três botões pequenos e discretos, lado a lado na mesma linha; (2) no iPhone, a barra de botões de baixo ganhou uma folga de 16 px embaixo (ou a área segura do aparelho, se for maior) para não ficar em cima do traço de rolar a tela; o mesmo vale para o espaço do fim das telas e para os avisos que ficam logo acima da barra

## 6.1.76

o campo de texto deixa de levar a tela para o começo do texto quando o texto é longo: ao digitar uma letra ou palavra, ou ao tocar no campo (com o teclado abrindo), o campo recalculava a altura encolhendo por um instante, a página ficava mais curta e o navegador puxava a rolagem para cima; agora a posição da tela é mantida

## 6.1.75

ajustes no esboço original e no arquivo Word: (1) no arquivo Word do esboço original o tema (e a linha de baixo, com o número, a revisão e o tempo) fica centralizado; (2) esboços do S-34 que terminam repetindo o tema ("N.º 100 Título", como os dos temas 95, 100, 101, 104, 107 e 111) deixam de mostrar essa repetição no fim da página e do arquivo (o importador a descarta e o servidor e a página limpam também os esboços já guardados; a nota do fim volta a ser a nota do fim); (3) o arquivo Word (esboço original e texto do campo) passa a ter margens pequenas, de 1 cm nos quatro lados (antes 2 cm); (4) corrigido o fechamento sozinho do esboço original (e da prévia do Word) ao rolar a página no celular: no app instalado, rolar para cima com a tela de trás no topo acionava o gesto de puxar para atualizar e recarregava o app; o gesto não vale mais dentro de páginas e janelas por cima do app, e a rolagem delas não passa para a tela de trás

## 6.1.74

Exportar para Word (campo de texto principal): os botões "📄 Exportar para Word (.docx)" e "📤 Compartilhar o arquivo Word" agora abrem uma prévia do documento, na mesma página em tela cheia do esboço original: uma folha branca como a do Word, com o texto do campo (recuos, negrito e itálico de verdade, emojis), a primeira linha maior, A− e A+ para o tamanho da letra (11 pt na escala 1, de 8,8 pt a 19,8 pt; o tamanho fica guardado) e, na própria página, Exportar para Word e Compartilhar para finalizar; o arquivo sai com o tamanho escolhido

## 6.1.73

a página "Ver o esboço original" (Discurso público e Outros esboços) ganha os botões "📄 Exportar para Word" e, nos celulares, "📤 Compartilhar", que geram um arquivo .docx do esboço (título, tempos, itens em níveis, destaques, notas e leituras) com as letras no tamanho escolhido em A− e A+ (12 pt na escala 1; de 9,6 pt a 21,6 pt); o arquivo se chama "Esboço original - título.docx"

## 6.1.72

Outros esboços: o botão "📄 Ver o esboço original" também aparece no card Esboço pronto como base, com um esboço .docx importado escolhido, e abre a mesma página em tela cheia do Discurso público (título, tempos, itens em níveis, destaques, notas e leituras, com A− e A+), lendo o esboço que já está no aparelho, sem pedir nada ao servidor

## 6.1.71

o botão Ver o esboço original (Discurso público) passa para depois do botão que elabora o esboço (e da caixa Instruções adicionais para a IA), no mesmo molde e tamanho dessa caixa (moldura de 2 px na cor do grupo, título pequeno e cinza, 35 px de altura), e o ícone do olho vira uma folha (📄); os botões deixam de ficar colados

## 6.1.70

Discurso público (S-34): novo botão "👁️ Ver o esboço original" (aparece com um tema escolhido) que abre o esboço importado numa página em tela cheia dentro do app, sem abrir outra janela: título, tempo de cada seção, itens em níveis, destaques em itálico, nota ao orador e leituras marcadas, com as letras ajustáveis (A− e A+, o tamanho fica guardado) e o botão Fechar; o esboço vem do servidor a cada vez (nova tarefa publico-esboco, só com o código do dirigente) e não fica guardado no aparelho

## 6.1.69

Preparar para dirigir → Estudo Bíblico de Congregação ganha o "O que preparar", como as Joias, com duas opções que podem ser marcadas juntas ou separadas: "Elaborar 5 perguntas adicionais, com resposta" (marcada por padrão) e "Escolher trechos pequenos e significativos dos textos bíblicos para ler" (o antigo resumo dos textos-base, que saiu do título "Opcional"); o botão passa a "IA - Preparar para dirigir o estudo", Outra resposta e Melhorar valem também só para os textos-base, e o aviso da resposta salva passa a "já tem resposta salva"

## 6.1.68

a mensagem que avisa da resposta (por exemplo "Resposta salva colocada no campo de texto.") passa para o fim do card, depois das caixas recolhíveis, no Estudo de A Sentinela, nas Joias e no Estudo Bíblico (Preparar para comentar) e no Estudo de A Sentinela do dirigente (depois de Seções da resposta); antes ela ficava entre o botão e essas caixas

## 6.1.67

a caixa "Instruções adicionais para a IA" ganha um botão pequeno 🗑️ (limpar) na ponta direita da linha do título, que aparece com a caixa aberta e só enquanto há texto e apaga o conteúdo do campo, sem levar o cursor para ele (o ✓ do título passa a aparecer só com a caixa fechada, para o título não quebrar em duas linhas)

## 6.1.66

no título de cada página da tela Reuniões (Preparar para comentar, Preparar para dirigir, Preparação de discursos e esboços e Pesquisas e respostas salvas) o emoji (mão, microfone…) fica colado ao texto, em vez de ficar no canto da faixa; o conjunto continua centralizado

## 6.1.65

o card recolhível "Textos bíblicos nas respostas" (A Sentinela, Joias e Estudo Bíblico de Congregação, em Preparar para comentar) fica no mesmo molde e tamanho reduzido da caixa "Instruções adicionais para a IA" (moldura de 2 px na cor do grupo, título pequeno e cinza, seta à esquerda)

## 6.1.64

o campo de Instruções adicionais para a IA cresce junto com o texto digitado (no celular ficava com a altura fixa de 3 linhas e o texto escrito ficava escondido); passando de 60% da altura da tela, ele rola por dentro

## 6.1.63

a caixa recolhida "Seções da resposta" (perguntas do dirigente de A Sentinela) fica no mesmo molde e tamanho da caixa "Instruções adicionais para a IA", logo acima dela (moldura de 2 px na cor do grupo, título pequeno e cinza)

## 6.1.62

Preparar para dirigir → Estudo de A Sentinela: a caixa "Seções da resposta" fica recolhida por padrão; as três seções ganham o mesmo formato, com um título simples, sem fundo, fora da caixa de marcar (1️⃣ Perguntas complementares, 2️⃣ Perguntas aplicativas, 3️⃣ Explicação dos textos); em 03 a opção "Perguntas para entender e explicar o texto em relação à matéria do parágrafo" sobe para o primeiro lugar e vem marcada por padrão (quem já tinha as opções salvas a recebe marcada uma única vez)

## 6.1.61

o botão 📋 Copiar da descrição de cada imagem (artigos, Estudo Bíblico e apostila) copia, no começo, o modelo IMAGEM do usuário (a transcrição da imagem) e, na sequência, a descrição; sem esse modelo, copia só a descrição como antes

## 6.1.60

Joias Espirituais: cada joia da leitura passa a trazer, ANTES do comentário, o texto bíblico completo a que ele se refere (copiado da Bíblia pelo servidor, nunca escrito pela IA), e o comentário vem logo depois; o texto da joia não se repete entre os outros textos e a resposta à pergunta da apostila continua como era

## 6.1.59

o campo Instruções adicionais para a IA fica recolhido (uma linha fina, como Imagens do capítulo) e abre ao tocar; o título ganha um ✓ quando há texto

## 6.1.58

volta o campo "Instruções adicionais para a IA", logo abaixo do botão de cada pedido: Preparar para comentar (A Sentinela, Joias e Estudo Bíblico), Preparar para dirigir (A Sentinela e Estudo Bíblico) e Preparação de discursos (discurso público, Tesouros e discurso curto); o texto vai no pedido com prioridade total sobre o prompt padrão (até 800 caracteres) e vale também para Outra resposta e Melhorar

## 6.1.57

o contorno do botão Reuniões fica mais fino (1 px, também com a tela aberta)

## 6.1.56

o botão Reuniões da barra de baixo ganha um destaque discreto: só um contorno roxo ao redor, com preenchimento bem leve, sem mudar de tamanho nem subir (o destaque grande e amarelo/roxo da 6.1.55 foi retirado)

## 6.1.55

o botão Reuniões, no centro da barra de baixo, ganha destaque: maior, no roxo do logotipo (teste) e saltando acima da barra (no computador, só na cor)

## 6.1.54

o convite para o FunPlayB fica sem a moldura ao redor (teste)

## 6.1.53

tela Formatar ganha, abaixo do campo de texto, um convite animado para o FunPlayB (jogo de perguntas bíblicas) com o ícone e o endereço jogo-perguntas-app.vercel.app

## 6.1.52

saiu a opção Organização da tela Reuniões (Ajustes): a tela Reuniões em páginas é a única e o código da tela única foi removido

## 6.1.51

o Estudo Bíblico (comentar e dirigir) e as Joias ganham o aviso "já tem resposta salva" com o botão Recuperar, como o Estudo de A Sentinela; o app avisa quando uma resposta não cabe na memória do aparelho (antes ficava calado) e, com a memória cheia, libera primeiro as leituras carregadas e não apaga mais todas as pesquisas salvas

## 6.1.50

a exportação para Word (.docx) passa a valer para qualquer texto do campo (respostas, perguntas, notas e esboços), não só para esboços: o botão fica abaixo do campo sempre que há texto, com o nome do arquivo vindo do título da pesquisa salva ou da primeira linha

## 6.1.49

as fontes dos quatro botões da tela Reuniões (Preparar para comentar, Preparar para dirigir, Preparação de discursos e esboços e Pesquisas e respostas salvas) ficam um pouco maiores, sem mudar o tamanho dos botões (o espaço em cima e embaixo do texto diminui um pouco)

## 6.1.48

Ajustes → Privacidade e dados deste aparelho ganha o resumo "O que está guardado neste aparelho": o tipo, a quantidade, o tamanho e as datas do que o app guardou (pesquisas salvas, leituras carregadas, comentários do texto diário, esboços importados, modelos, símbolos, dados do backup, códigos, preferências e arquivos do app), com o total; os códigos aparecem só como salvos

## 6.1.47

o que os botões Carregar perguntas, Carregar discurso e Carregar imagens leem no wol.jw.org (capítulo do Estudo Bíblico, leitura das joias, imagens da apostila, discursos de Tesouros e curto) fica guardado por semana neste aparelho: ao abrir o app ou voltar a uma semana já carregada, o cartão aparece carregado, sem recarregar (o botão Recarregar lê de novo); só ficam as semanas atual, anterior e seguinte (o carregado de outra semana sai a partir do dia seguinte) e até 40 leituras, e a lista do estudo de A Sentinela segue a mesma regra

## 6.1.46

a moldura do contêiner Imagens do capítulo (e Imagens da apostila nos esboços) fica mais grossa (2 px) e na cor do grupo, como as dos outros contêineres

## 6.1.45

a lista Imagens do capítulo do Estudo Bíblico (e a das imagens da apostila nos esboços) ganha a mesma linha entre as imagens

## 6.1.44

a lista do cartão Imagens da apostila ganha uma linha, na largura inteira, separando cada imagem detectada

## 6.1.43

o aviso "já tem resposta salva" do Estudo de A Sentinela (Preparar para comentar) ganha moldura e fundo roxos, a cor do grupo, no lugar do verde

## 6.1.42

tela Reuniões em páginas: some o contêiner de fora que cercava as opções de Preparar para comentar, Preparar para dirigir, Preparação de discursos e esboços e Pesquisas e respostas salvas (moldura dupla); cada opção fica solta na página, com a moldura dela

## 6.1.41

o app não leva mais o cursor ao campo de texto sozinho (a resposta da IA, Limpar, abrir uma pesquisa salva e as dicas dos botões de formatação não acionam mais o teclado do celular; o cursor só fica ali quando o usuário já está nele)

## 6.1.40

gerar novas perguntas do dirigente (A Sentinela) limpa o campo de texto antes de colá-las, como as respostas do estudo; as respostas e perguntas salvas antes da 6.1.38 também ganham Outra resposta e Melhorar esta resposta ao serem recuperadas (o app usa o texto salvo no lugar dos dados originais da IA, que elas não guardaram; o texto colado e os esboços antigos continuam sem os botões)

## 6.1.39

as perguntas adicionais do dirigente de A Sentinela ganham Outra resposta e Melhorar esta resposta (o servidor aceita os pedidos de outras perguntas e de melhorar; as perguntas salvas guardam os dados para refazer depois de reabertas)

## 6.1.38

os botões Outra resposta e Melhorar esta resposta ficam logo abaixo do Salvar alterações e voltam a funcionar numa resposta recuperada de Pesquisas e respostas salvas (Sentinela, texto colado, Estudo Bíblico, dirigente do Estudo Bíblico e Joias; as salvas antes desta versão abrem só como texto); a instrução de uma frase inteira em letra dupla saiu dos prompts; a opção Formatar citações bíblicas, obsoleta, saiu das configurações da IA

## 6.1.37

tela Reuniões em páginas: ao abrir uma opção de um grupo (por exemplo, Estudo de A Sentinela), as outras opções do mesmo grupo (Estudo Bíblico, Joias, Imagens da apostila; no dirigente e nos esboços, também) ficam escondidas, e voltam quando a opção é recolhida

## 6.1.36

novo cartão "Imagens da apostila" em Preparar para comentar: carrega TODAS as imagens da apostila Vida e Ministério da semana (descrição, legenda e o botão que copia só a descrição), agrupadas pela parte em que estão, inclusive as de partes que o app não trata, como Nossa Vida Cristã

## 6.1.35

imagens dos artigos: a descrição e a legenda de cada imagem aparecem em blocos separados, com um botão pequeno "📋 Copiar" que copia só a descrição; o mesmo vale agora para o Estudo Bíblico de Congregação (lista "Imagens do capítulo", que a IA também recebe, já que as perguntas citam "Imagem A") e para a apostila (Tesouros e discurso curto: "Imagens da apostila", quando o item tem imagens)

## 6.1.34

Estudo de A Sentinela: o app passa a ler, de cada imagem do artigo, a descrição que o wol.jw.org guarda (o texto "Conjunto de imagens: 1. … 2. …", que antes só vinha ao copiar um trecho por cima da imagem) e a legenda: a IA recebe junto do parágrafo e o app mostra abaixo da pergunta do parágrafo (recarregue as perguntas das semanas já carregadas)

## 6.1.33

Ajustes: as opções exclusivas do administrador (Prompts da IA, Leitura em voz alta e Esboços de discursos públicos — S-34) passam para o fim da lista, depois de uma linha de separação; a linha e as opções só aparecem para o administrador

## 6.1.32

letra dupla: as maiúsculas C H N P Q R Z (ℂ ℍ ℕ ℙ ℚ ℝ ℤ, que vêm de outro bloco do Unicode) saíam como um quadrado listrado no iPhone, estragando a inicial de frases como "Quando…"; agora a inicial fica em letra comum e o resto da frase em letra dupla (o texto antigo com ℂ ℍ ℕ… continua sendo reconhecido); as respostas da IA ganham uma regra de revisão da escrita (nada de palavras que não existem, em inglês ou com grafia antiga, como "prompto")

## 6.1.31

o ícone 🛡️ das opções do administrador fica colado ao texto do título (antes o summary o separava do texto)

## 6.1.30

Ajustes: as opções exclusivas do administrador (Prompts da IA, Leitura em voz alta, Esboços de discursos públicos — S-34, Salvar como padrão de todos e Texto do convite) perdem a palavra "(administrador)" e ganham o ícone 🛡️ no título, e só aparecem para quem tem a senha de administrador salva neste aparelho (Autorização de acessos)

## 6.1.29

as três instruções que ficavam na caixa Instruções fixas passam a fazer parte do app: (1) nova opção "Uma linha em branco entre cada frase" (antes só funcionava porque o servidor lia a palavra "frases" na caixa de instruções); (2) com "Variar o tipo de fonte" marcado, a IA põe pelo menos uma frase inteira em letra dupla em cada pedido (regra no prompt, no catálogo de fontes e nas regras fixas); (3) nas respostas da recapitulação, cada resposta termina com os números dos parágrafos em que se baseia, entre parênteses (nos dois escopos de recapitulação e no prompt da leitura pela IA)

## 6.1.28

as respostas da IA nunca usam as fontes gótica e script: o negrito das respostas vinha da fonte principal escolhida no editor (se ela fosse a gótica ou a script, as respostas saíam nelas; a regra valia só para os esboços e só para a gótica) e agora cai nas letras serifadas; o servidor também troca por letras comuns qualquer letra gótica ou script que a IA escreva por conta própria

## 6.1.27

o texto "Selecione uma semana" da barra da semana (Reuniões) fica com a fonte maior (de .84rem para 1.1rem)

## 6.1.26

barra da semana (Reuniões): o rótulo "Semana das reuniões (vale para tudo abaixo)" passa a "Selecione uma semana" e o botão "Esta semana" passa a "Semana atual" quando é a semana atual, também na tela Backup, em Nova resposta (os rótulos das outras semanas não mudam)

## 6.1.25

Discurso público (S-34): esboços que não marcam leituras com "Leia" (os antigos, como o do tema 110, de 1995, que só citam os textos) saíam sem nenhum texto para ler, porque o servidor descartava qualquer leitura fora das marcadas; agora, se as marcadas e as escolhidas pelo orador não chegam ao mínimo (novo limite em Prompts da IA → Limites, "Textos lidos no discurso público (mínimo)", padrão 5), a IA escolhe as que faltam entre os textos citados no esboço, o servidor as mantém e avisa quando ficam abaixo do mínimo

## 6.1.24

Discurso público - lista de temas: o campo de buscar o tema e a lista de temas viram um campo só: dá para digitar o número (com um único tema, ele é escolhido e o nome aparece no próprio campo) ou parte do título (a lista filtra) ou tocar na seta ▾ e escolher na lista

## 6.1.23

o texto do convite (página Sobre) passa a ser do administrador: fica no servidor e vale para todos; só o administrador (senha salva em Autorização de acessos) o vê e o muda, na página Sobre e em Ajustes → Gerenciar modelos e categorias → Texto do convite; os demais usuários só veem a mensagem pronta (sem poder mudá-la)

## 6.1.22

o convite para o app sai do Início (botão Convidar e rótulo Atalhos) e de Ajustes e fica só na página Sobre; o texto padrão do convite se edita em Ajustes → Gerenciar modelos e categorias → Texto do convite; a página Sobre ganha o atalho para Ajustes → Privacidade e dados deste aparelho (endereço index.html#privacidade)

## 6.1.21

Ajustes mostra a versão do app logo abaixo do logo, no topo (saiu do rodapé); a página Sobre mostra o endereço www.notestyle.com.br como link; novo convite para o app: botão Convidar na linha do título Atalhos (Início) e card Convidar alguém em Ajustes, com mensagem pronta para enviar pelo WhatsApp, compartilhar ou copiar (sem códigos de acesso)

## 6.1.20

preparação para as lojas de aplicativos: (1) antes do primeiro uso da IA ou da leitura em voz alta o app pede a concordância com o envio do texto à Anthropic (IA) e ao Google (voz), com Concordo / Agora não e link para a Política de Privacidade (a escolha fica no aparelho e se retira em Ajustes); (2) botão Relatar problema com esta resposta junto dos botões Outra sugestão / Melhorar, que abre o e-mail da própria pessoa com uma mensagem pronta (nada é enviado pelo app); (3) novo card em Ajustes, Privacidade e dados deste aparelho, com a concordância, o relato de problema e o botão Apagar os dados deste aparelho

## 6.1.19

Outros esboços, esboço pronto como base: o texto explicativo do card fica só com a primeira frase (Importe um esboço .docx no molde dos esboços do S-34)

## 6.1.18

Outros esboços, esboço pronto importado: a IA e o leitor do .docx passam a considerar que nem sempre há "Nota ao orador" (pode vir só "Nota" ou não ter nada: depois do título já começa a matéria do esboço); a mensagem à IA diz "SEM NOTA AO ORADOR" nesse caso e o objetivo vem da ideia do orador

## 6.1.17

no computador (tela de 980 px ou mais) o card Opções principais de formatação já abre expandido ao abrir o app; no celular e em telas estreitas continua recolhido

## 6.1.16

tela Backup, Nova resposta: depois de salvar uma resposta o formulário continua aberto no mesmo documento, a pergunta salva vira "já respondida", a próxima pergunta livre já vem escolhida e o campo da resposta é limpo; o aviso acima da pergunta conta quantas respostas foram salvas; o botão Cancelar vira Concluir (pergunta antes se há resposta escrita sem salvar) e leva ao botão Gerar backup modificado, para gravar o arquivo só no fim

## 6.1.15

tela Backup: todo backup aberto começa na categoria Respostas (quadros) (o backup vazio criado pelo app e a importação de notas continuam abrindo em Notas)

## 6.1.14

tela Backup: na lista Categoria, Respostas (quadros) passa para o primeiro lugar e Notas para o segundo

## 6.1.13

tela Reuniões em páginas: o ícone do título de cada página (a mão de Preparar para comentar, o microfone, etc.) fica bem maior

## 6.1.12

tela Reuniões em páginas: no topo de cada página os botões ◀ Voltar e 📝 ↓ (ir ao campo de texto) passam a ter o mesmo tamanho

## 6.1.11

tocar no logo NoteStyle do topo abre a página Sobre (que agora mostra o endereço www.notestyle.com.br logo abaixo do logo)

## 6.1.10

Prompts da IA (administrador) → Diversos: novo campo "Código do dirigente (anotação)", igual ao do código de pesquisa (guardado no servidor, só o administrador vê)

## 6.1.9

o servidor passa a aceitar pedidos só do domínio próprio (notestyle.com.br e www.notestyle.com.br, com HTTPS) e de localhost, para testes; os endereços *.vercel.app deixam de funcionar

## 6.1.8

domínio próprio notestyle.com.br (o servidor passa a aceitar notestyle.com.br e www.notestyle.com.br, sem tirar os endereços da Vercel) e a identificação do servidor nas consultas ao wol.jw.org passa a apontar para a página Sobre

## 6.1.7

página Sobre reformulada (de onde vêm as informações — wol.jw.org —, privacidade, IA, aplicativo independente, créditos) e novas páginas Política de Privacidade (privacidade.html) e Termos de Uso (termos.html), com links em Ajustes, para as lojas de aplicativos

## 6.1.6

tela Início, texto diário aberto: saiu o botão azul "Ler texto em voz alta" (o ícone 🔊 do topo já lê) e os botões "Levar para o campo de texto" e "Gerar comentários adicionais" dividem a mesma linha, centralizados

## 6.1.5

tela Início: na faixa do rótulo "Texto diário" a fonte ficou maior, o texto fica centralizado na vertical (mesma folga em cima e embaixo) e sumiu o espaço em branco acima dele (a sobra de altura do cartão passou para baixo da faixa, sem mudar o tamanho do cartão)

## 6.1.4

em Pesquisas e respostas salvas, o texto explicativo no alto saiu e ficou só o título "Pesquisas da semana selecionada", em letras de destaque e centralizado

## 6.1.3

Tesouros da Palavra de Deus e Faça seu melhor no ministério com a mesma formatação do Estudo de A Sentinela: o texto "A IA lê o discurso…" saiu, o botão passou a "Carregar discurso" ("Recarregar discurso" depois de carregado), sem discurso carregado o título mostra "Aguardando carregar discurso" (centralizado) e, carregado, o tema do discurso vira o título do cartão, em destaque, com a semana na linha de baixo (e o link da apostila); em Outros esboços saiu o texto explicativo que citava a IA

## 6.1.2

tela principal de Reuniões com os ícones dos 4 botões bem maiores; Joias Espirituais: a semana fica sozinha na linha de baixo do título (centralizada), sem os parênteses

## 6.1.1

o número de joias espirituais por capítulo da leitura passou a ser configurável na tela Prompts da IA (administrador) → 🔢 Limites (de 1 a 5; padrão 2): o servidor corta o que passar do limite, o prompt das Joias usa {{max_joias}} e o rótulo "Joias da leitura: até N por capítulo" do app acompanha

## 6.1.0

Joias Espirituais com a mesma formatação do Estudo de A Sentinela e do Estudo Bíblico: o texto de apresentação saiu, o botão passou a "Carregar perguntas" ("Recarregar perguntas" depois de carregado), sem leitura carregada o título mostra "Aguardando carregar perguntas" (centralizado) e, carregada, a leitura da semana vira o título do cartão, em destaque (com o link da apostila no wol.jw.org), saindo da linha de informações, que fica só com a pergunta da apostila; 6.0.9: Estudo Bíblico de Congregação (comentários e dirigente) com a mesma formatação do Estudo de A Sentinela: o texto de apresentação saiu, o botão passou a "Carregar perguntas" ("Recarregar perguntas" depois de carregado), sem capítulo carregado o título mostra "Aguardando carregar perguntas" (centralizado) e, carregado, a matéria e o título do capítulo viram o título do cartão, em destaque (com o link do capítulo no wol.jw.org), saindo da linha de informações, que fica só com as perguntas de cada quadro; 6.0.8: Estudo de A Sentinela (comentários e dirigente): o texto de apresentação ("A IA lê direto na biblioteca on-line…") saiu de vez; o botão passou a "Carregar perguntas" ("Recarregar perguntas" depois de carregado) e, sem perguntas carregadas, o título mostra "Aguardando carregar perguntas", centralizado; 6.0.7: Estudo de A Sentinela (comentários e dirigente): com os parágrafos carregados, o tema do artigo vira o título do cartão, em letras de destaque, no lugar do texto "A IA lê direto na biblioteca on-line…" (esse texto volta enquanto nada está carregado), e sai da linha "opção N de M"; nas ferramentas dos grupos (A Sentinela, Joias, Estudo Bíblico…) sumiu o espaço em branco entre o título da ferramenta e o conteúdo; 6.0.6: tela Reuniões em páginas: o campo de texto passa a expandir sozinho ao abrir uma página (antes ficava pequeno quando o texto chegava com o campo escondido na tela principal); a tela principal ocupa a altura da tela (botões maiores, com uma linha de descrição, sem o espaço vazio embaixo); o botão da semana ("Esta semana") ficou mais alto, com a data afastada do título; 6.0.5: tela Reuniões em páginas separadas (teste): só os botões Preparar para comentar, Preparar para dirigir, Discursos e esboços e Pesquisas salvas na tela principal, cada um abre a sua página com ◀ Voltar (a semana fica no alto, o campo de texto vem depois do conteúdo e um botão avisa quando a resposta da IA chega; uma ferramenta aberta de cada vez); em Ajustes → Organização da tela Reuniões dá para voltar à tela única de antes; 6.0.4: o aviso de resposta salva do parágrafo não informa mais quantas pesquisas salvas existem (o botão recupera sempre a mais recente); 6.0.3: no Estudo de A Sentinela (comentários e dirigente), ao escolher parágrafos que já têm resposta salva nesta semana (Pesquisas e respostas salvas) o app avisa ("O parágrafo 3 já tem resposta salva…") e mostra o botão "Recuperar a resposta salva" (ou "as perguntas salvas", no dirigente), que coloca no campo de texto só a resposta daquele parágrafo, sem nova consulta à IA; 6.0.2: atalhos da tela Início com ícone e letras maiores dentro dos mesmos cartões (menos espaço vazio por dentro), em todas as alturas de tela; se o texto do dia é muito longo e não cabe, os atalhos encolhem só o necessário (terceiro nível de aperto); 6.0.1: no Estudo de A Sentinela (comentários e dirigente), abaixo do tema do artigo aparece a pergunta do parágrafo escolhido ("Pergunta do parágrafo 3: …", ou "dos parágrafos 4, 5" quando compartilham a pergunta; vem da lista de parágrafos — recarregue uma vez para as semanas já guardadas); 6.0.0: tela Início no celular reajustada: o campo do texto diário fica mais enxuto (data numa linha só) e a altura que sobra vai para os atalhos, que ficam maiores, com ícone e letras um pouco maiores e sem espaço vazio dentro; se o texto do dia é longo e a tela não comporta tudo, o app aperta o texto diário e os atalhos sozinho (para não precisar rolar); em telas baixas as descrições dos atalhos somem; 5.9.9: a tela Início cabe numa tela de celular sem rolar (cabeçalho, texto diário e atalhos mais compactos) e ganha dois atalhos novos: "Discursos" (Ajuda na preparação de discursos e esboços; âmbar; fica com cadeado sem o código do dirigente, como o grupo) abre a Preparação de discursos e esboços e "Pesquisas e respostas salvas" (verde) abre a seção das pesquisas salvas da semana escolhida; 5.9.8: no card Discurso público o título do campo passa a ser "Escolha o tema (N esboços)" (N = os esboços do S-34 já importados); 5.9.7: o título do card passa a ser "Discurso público - lista de temas (esboços do S-34)"; 5.9.6: sai o texto explicativo do card Discurso público (esboço do S-34); 5.9.5: a lista de temas do card Discurso público (esboço do S-34) e a lista de esboços importados do card Outros esboços passam a usar o painel largo da "Nova resposta" do Backup (botão com a escolha inteira e painel da largura do formulário, com o título inteiro de cada tema; no celular a lista nativa é estreita e corta o texto); 5.9.4: Backup, Nova resposta: a lista de documentos (e a de perguntas) deixa de ser a lista estreita do celular e vira um painel da largura do formulário, com o texto inteiro; "Carregar as publicações de uma semana" e "Outro documento" vão para o começo da lista, em azul e em negrito; 5.9.3: Backup, Nova resposta: (1) o nome do artigo de A Sentinela traz a semana em que ele é estudado ("estudo de 15-21 de setembro de 2025"), descoberta pelo servidor nas páginas de reuniões do wol.jw.org e guardada no aparelho; (2) os campos do fim do artigo ganham "Quadro de recapitulação — …" (e, na lista de respostas, "Sua resposta · quadro de recapitulação"); (3) nova opção "📅 Carregar as publicações de uma semana": o app traz o artigo de estudo de A Sentinela e a apostila Vida e Ministério da semana escolhida (a atual, ou outra, com as setas), mesmo que o backup ainda não tenha esses documentos, e cria a resposta neles; 5.9.2: novo botão "📄 Exportar o esboço para Word (.docx)" abaixo do campo de texto (só quando o texto do campo é um esboço, ligado a uma pesquisa salva do tipo esboço): gera um arquivo Word com o texto do campo, com as alterações do usuário, em letras comuns (as letras Unicode formatadas voltam a ser letras normais, com negrito e itálico de verdade; as outras fontes decorativas viram letras comuns), emojis mantidos, uma linha por parágrafo com o recuo e a primeira linha (o tema) maior; os acentos que as letras em negrito e itálico do app perdem ("oracao") voltam no Word: vêm do esboço salvo (que agora guarda também o texto dos versículos) e, nos esboços salvos antes, o app pede ao servidor o texto exato dos versículos (nova tarefa "versiculos", sem IA, só com o código do dirigente); no celular há também "Compartilhar o arquivo Word"; 5.9.1: Outros esboços, etapa 2: o orador importa um esboço pronto (.docx no molde dos esboços do S-34, com qualquer nome de arquivo) que fica guardado só neste aparelho, escolhe-o como base e a IA o segue de perto como no discurso público (um ponto por seção, com os tempos dele, só as leituras marcadas "Leia" além dos textos pedidos, destaques e notas ao orador); o esboço importado vai ao servidor apenas no pedido e lá não é guardado; 5.9.0: novo card "Outros esboços" (discursos de tema livre: necessidades locais, eventos especiais) em Preparação de discursos e esboços: o orador escreve o tema, a ideia, o tempo (3 a 60 min) e, se quiser, a ocasião, os textos bíblicos que quer ler, uma matéria colada, endereços de artigos do wol.jw.org e/ou os resultados da pesquisa do tema na biblioteca online que ele marcar (a pesquisa mostra os resultados e deixa escolher); "Ler a matéria" lê os artigos e lista os textos bíblicos para marcar; a IA elabora o esboço (introdução, 2 a 7 pontos conforme o tempo, conclusão, minutos somando o tempo) só com o que foi informado, e ele segue o caminho dos outros esboços (campo de texto, pesquisas salvas com a semana, outra versão, melhorar, incluir textos); o que foi escrito no card fica salvo só neste aparelho; 5.8.9: discurso público: a importação do S-34 passa a achar as leituras marcadas "Leia" nos esboços mais antigos ("(Leia Mateus 4:17.)", "(re 171-2; leia Revelação 11:15-18.)", "Leia o Salmo 37:34", "[Leia o versículo 4.]", "(Leia.)" e um item só com "Leia Romanos 8:18."; antes só valia "[Leia …]" entre colchetes e o tema 109, por exemplo, ficava sem leituras marcadas; precisa importar de novo) e o campo do tema mostra o título inteiro (em quantas linhas precisar) e o tempo total do esboço (30 ou 45 min) depois do tema; 5.8.8: na tela de prompts a descrição de cada prompt vai numa caixa própria (fundo na cor da categoria), com mais espaço antes do campo do texto, que tem fundo neutro e borda da categoria; em Pesquisas e respostas salvas os botões de cada item deixam de ser azuis e seguem a cor da categoria (Comentários em roxo, Dirigentes em verde-azulado e Esboços em laranja; Abrir em tom forte e Original e apagar em tom suave); 5.8.7: a importação do S-34 no iPhone/Safari: os 25 arquivos .docx mais novos começam o XML com o BOM (um caractere invisível) e o Safari recusava com o erro "o documento do Word está ilegível" (o Chrome aceitava); o BOM agora é tirado antes de ler; 5.8.6: a importação do S-34 passa a entender os arquivos .docx mais novos (que usam estilos com nome do Word em vez de negrito e recuo em cada trecho: níveis, título da seção, nota ao orador, tempo total e identificação), o título com o número na frente (N.º 108), as variações da linha de identificação (No., N.o, S-34-T N.º 153-T, junto do ©) e os esboços de 45 minutos; o mesmo tema escolhido duas vezes com o mesmo conteúdo (por exemplo, o .zip e os arquivos soltos) deixa de ser erro e o repetido é só ignorado; 5.8.5: o ícone 🔊 do Texto diário perde o círculo, fica um pouco maior e só aparece com o texto expandido; 5.8.4: tela Início: ícone 🔊 ao lado do nome Texto diário, no topo do cartão, que lê o texto do dia em voz alta sem precisar abrir o texto (o tocador aparece logo abaixo do título; tocar de novo para a leitura); 5.8.3: Preparação para as reuniões com uma cor por categoria: tudo o que fica em Comentários (cards, botões, setas, campos e caixas de marcar) em roxo, em Dirigentes em verde-azulado e em Esboços em laranja; o Estudo Bíblico, as Joias e os Textos bíblicos deixam de ter cor própria (azul, verde, âmbar); 5.8.2: Ajustes → Esboços de discursos públicos: a lista de temas guardada no servidor agora aparece na caixa de texto (antes a caixa abria sempre vazia e parecia que a lista tinha sumido) e o título mostra quantos temas estão guardados; 5.8.1: ao salvar as alterações o botão mostra Alterações salvas! por uns segundos e a linha abaixo dele a hora; todas as pesquisas salvas de comentários e dirigentes mostram no nome a semana a que se referem (e os esboços da semana, também: 19 a 25 de outubro - título); o número do tema (Nº 125 - título) agora aparece nos esboços públicos já salvos assim que o app abre (o número vem da lista de temas do S-34); 5.8.0: novo botão 💾 Salvar alterações abaixo do campo de texto: depois de gerar um esboço ou respostas (ou de abrir uma pesquisa salva) dá para mexer no texto (inserir, formatar, trocar a fonte, espaços) e salvar; a pesquisa guarda a sua versão (o que a IA fez continua guardado e ↩️ Original volta a ele), e Abrir e o botão Carregar o esboço já salvo trazem a versão alterada; 5.7.2: o nome do esboço nas pesquisas salvas leva o número do tema no discurso público (Nº 125 - título) e a semana nos outros (19-25 de outubro - título); os esboços salvos antes ganham o número ou a semana quando o discurso deles é carregado; 5.7.1: ao carregar o discurso (o da semana ou o tema do S-34), se já existe esboço salvo em Pesquisas e respostas salvas, um botão logo abaixo do carregar abre o mais recente no campo de texto (os esboços salvos agora guardam também o JSON, então o aberto continua com Outra versão, Melhorar e Incluir texto(s)); 5.7.0: os três esboços (Tesouros, discurso curto e discurso público) ganham o card recolhível Textos bíblicos da matéria: lista todos os textos da apostila e das fontes (ou do S-34) com a Bíblia à mão (Ver texto), mostra os marcados com LEIA na matéria (que já entram no esboço) e deixa o orador marcar outros para ler; os marcados entram já na primeira elaboração e, depois dela, o botão Incluir texto(s) marcado(s) pede à IA o mesmo esboço com os textos novos; o servidor avisa quando um texto que devia ser lido ficou de fora; 5.6.1: a tela de Ajustes mostra a versão do app abaixo do link Sobre o app; 5.6.0: novo card Discurso público (esboço do S-34) na preparação de discursos e esboços: escolhe o tema entre os importados (com busca), mostra revisão, tempos, objetivo e leituras marcadas, e a IA elabora o esboço seguindo o S-34 (um ponto por seção com os tempos do esboço, só as leituras marcadas, destaques em itálico, notas ao orador) com as mesmas regras de formato dos outros esboços; a importação do S-34 agora guarda os destaques (itálico no meio da frase = importante; itálico + negrito = muito importante; itálico entre parênteses ou colchetes é o nome da publicação); 5.5.0: Ajustes (administrador): novo card Esboços de discursos públicos (S-34) para importar os esboços .docx (um por tema, ou um .zip): o navegador lê cada arquivo, mostra um relatório (novos, atualizados, iguais, avisos e erros, com a prévia do que foi entendido) e só depois de confirmar envia ao servidor, que guarda num armazenamento privado (Blob) com índice, revisão e lista de temas opcional; 5.4.1: esboços nunca usam a fonte gótica (fraktur): regra nos prompts, letras góticas escritas pela IA viram letras comuns no servidor e o app troca a gótica por serifada no negrito e no itálico do esboço; 5.4.0: Backup, categoria Respostas: cada Sua resposta mostra o número do parágrafo e a pergunta (o servidor lê o documento no wol.jw.org; só o número do documento é enviado) e a lista agrupa pelo título do artigo; novo botão Nova resposta (escolhe o documento do backup ou cola o endereço do wol.jw.org, escolhe a pergunta e escreve a resposta); 5.3.4: esboços sem os botões azuis de copiar (o esboço é copiado inteiro e guardado em uma parte só no histórico), lista numerada colorida (1️⃣ 2️⃣ 3️⃣) com linha em branco antes dos itens e emojis no começo das falas, opcionais pela opção Ilustrar com emoji das configurações; 5.3.3: tela Backup: exportar notas e mesclar (importar) notas de outro backup viraram dois contêineres separados, dentro da seção recolhível ↔️ Importação e exportação; 5.3.2: esboços: perguntas em negrito, listas numeradas com os símbolos unicode do app (❶ ❷ ❸), a introdução não fala de aplicação nem usa Vamos ver como aplicar isso, e a conclusão não escreve recapitulando; 5.3.1: ajustes nos esboços: objetivo separado só por linhas em branco, linha em branco depois de cada subtítulo, introdução e conclusão escritas palavra por palavra e com listas numeradas (1) 2) 3)), todo texto lido com uma fala antes (que cria expectativa e liga a ideia anterior) e um destaque depois (Conforme vimos no texto…), ligação entre todas as partes (a transição do último ponto leva à conclusão), conclusão sempre motivadora e sem as frases Nosso tema é… e A aplicação é simples; o app avisa quando a IA não cumpre o mínimo de leituras; 5.3.0: novo formato de todos os esboços (Tesouros e discurso curto): tema e subtítulos em MAIÚSCULAS e negrito com o tempo ao lado, objetivo entre duas linhas, subtítulo próprio na introdução e na conclusão (sem as palavras Introdução, Conclusão, Ponto N nem Primeiras frases), linha em branco entre os argumentos, textos lidos anunciados com ➜ 🟡 📖 LEIA e a íntegra da Bíblia em itálico, Aplicação e Ilustração em negrito separadas, e a IA só escreve o que o orador diz (sem comentários nem rótulos); 5.2.9: a leitura em voz alta tenta de novo uma vez quando a conexão cai ao receber o áudio (o Safari avisava só "Load failed") e, se falhar de novo, mostra uma mensagem em português; 5.2.8: novo card Faça seu melhor no ministério (discurso curto) em Preparação de discursos e esboços: o servidor lê só os itens "Discurso" da apostila (4 ou 5 minutos, como vier), a fonte (ponto do apêndice A ou artigo), a lição do th e, quando a fonte só traz o tema e textos, pesquisa o tema no wol.jw.org; a IA elabora o esboço com 1 ou 2 pontos e no máximo 3 textos lidos, e leva a lição do th em conta só se ela influenciar o esboço; 5.2.7: o prompt de Tesouros fica só com o que é específico do discurso (pontos e textos da apostila, fontes, leitura dos textos e tempo) e as regras de estilo comuns a todos os esboços (tema frisado, tópicos, aplicação, tom, ilustrações) vão para a parte Como elaborar um esboço; 5.2.6: o esboço de Tesouros passa a seguir o capítulo Como elaborar um esboço (Beneficie-se): nova parte editável com os princípios do esboço (objetivo, pontos principais, argumentos e ideias, sequência lógica, introdução e conclusão), e o resultado sai como no modelo, com o ponto principal em maiúsculas e as ideias recuadas; 5.2.5: Preparação de discursos e esboços ganha o card Tesouros da Palavra de Deus (esboço do discurso de 10 min com a IA, lendo a apostila e as fontes no wol.jw.org, só com o código do dirigente), o prompt editável do esboço fica na categoria Esboços e Discursos, e o trecho de cada fonte citada passa a ter só os parágrafos citados (antes vinha um a mais); 5.2.4: o botão Visualizar e editar prompts sai de Configurar formatação com IA e ganha um card próprio em Ajustes, e a tela de prompts passa a ser organizada em categorias recolhíveis com emoji (modelo/gasto/limites, base das respostas, comentários, dirigente, Bíblia, formatação, voz, diversos e parte técnica); 5.2.3: na tela de prompts o texto salvo com 💾 Salvar para todos vira o padrão oficial do app (some o aviso "personalizado") e "Restaurar padrão" passa a "Voltar ao texto original"; 5.2.2: a leitura do texto diário não lê mais a linha de referência da matéria (antes lia a parte depois do ponto e vírgula, "19 §§ 17-18"), o filtro de citações também tira essa continuação e a instrução de leitura manda nunca ler referências; 5.2.1: espaços padronizados (10px) entre o título, o campo de texto e as caixas de opções das telas Formatar e Reuniões; 5.2.0: nova opção Inserir emojis no texto em Outras opções de formatação (só escolher e buscar, favoritos no topo, sem edição) e a Preparação de discursos e esboços ganha o ícone 📜 (antes repetia o 🎤 de Preparar para dirigir); 5.1.9: na tela Reuniões o cartão do campo de texto ganha a dica "Para mais opções de formatação clique em Formatar."; 5.1.8: na tela Início o atalho Backup do JW Library sobe para a primeira linha, ao lado de Formatar um texto; 5.1.7: rótulo "Texto diário" centralizado e separado do resto do cartão por uma linha, e o aviso do cartão desabilitado fica só em "Requer o código de pesquisa."; 5.1.6: rótulo "Texto diário" no topo do cartão do texto diário; 5.1.5: Preparar para dirigir (e o atalho Dirigentes) pedem só o código do dirigente, que passa a valer sozinho no servidor para as tarefas do dirigente; 5.1.4: a Preparação de discursos e esboços vira um grupo dentro de Preparação para as reuniões e pede só o código do dirigente, a moldura de Pesquisas e respostas salvas (novo nome) ganha cor forte (verde) como as outras; 5.1.3: "Opções de formatação com IA" passa a "Opções com IA", o botão do texto colado fica separado do de formatação e dentro de um contêiner com o texto explicativo novo, e a Preparação de discursos e esboços (e a categoria Esboços das pesquisas salvas) também pedem o código do dirigente; 5.1.2: "Responder a partir do texto colado" mudou para Formatar → Opções de formatação com IA, o grupo Preparar para comentar (e o atalho Comentários) ficam desabilitados sem o código de pesquisa, o grupo e o atalho do dirigente pedem os dois códigos e o link do texto diário para o wol.jw.org fica habilitado sempre; 5.1.1: o código de acesso passa a se chamar "código de pesquisa" e os cartões que dependem dele (Joias, Estudo Bíblico, Estudo de A Sentinela do dirigente, a parte do Estudo de A Sentinela lida no site e o texto diário) ficam desabilitados sem o código; 5.1.0: sem o código do dirigente, o atalho Dirigentes, o grupo Preparar para dirigir e a categoria Dirigentes das pesquisas salvas aparecem desabilitados (cinza, com cadeado) em vez de sumir; 5.0.9: "Faça seu melhor no ministério" (semanas com discurso de 4 min) entre as opções em breve de Preparação de discursos e esboços; 5.0.8: atalho Dirigentes da tela Início volta ao nome "Dirigentes" e só a linha explicativa passa a "Ajuda na preparação para dirigir" (e a do atalho Comentários, "Ajuda na preparação para comentar"); 5.0.7: grupos da tela Reuniões renomeados para "Preparar para comentar" e "Preparar para dirigir" e atalho do Início "Ajuda na preparação para dirigir"; 5.0.6: pesquisas salvas separadas em categorias (Comentários, Dirigentes e Esboços), cada uma recolhível e na cor do grupo; 5.0.5: Estudo Bíblico de Congregação no grupo Preparação para dirigir (5 perguntas adicionais com resposta, sem aplicações práticas, e o resumo dos textos-base, que saiu do cartão dos comentários); 5.0.4: cor dos títulos dos grupos Preparação de comentários e Preparação para dirigir mais suave; 5.0.3: títulos dos grupos Preparação de comentários e Preparação para dirigir com cor forte (roxo e verde-água escuros, letra branca); 5.0.2: o aviso "Nossa Vida Cristã (em breve)" saiu do grupo Preparação de comentários; 5.0.1: os grupos "Preparação de comentários" e "Preparação para dirigir" da tela Reuniões viram contêineres com borda na cor do grupo, para o que está dentro não parecer solto; 5.0.0: atalhos da tela Início coloridos, cada um com a cor da tela que abre; 4.9.9: Ajustes → Configurar formatação com IA ganha 💾 Salvar para todos (só administrador), que salva as opções de formatação como padrão de todos os usuários; 4.9.8: tela de prompts com um só botão 💾 Salvar para todos (modelo e esforço da IA, limites e prompts) e ícones ✋ e 🎤 nos grupos de comentários e de dirigir da tela Reuniões, como nos atalhos do Início; 4.9.7: o cartão de gasto da tela de prompts não explica mais como criar a chave de administrador da Anthropic (só indica o link do Claude Console); 4.9.6: o app confere o código do dirigente salvo com o servidor e, se ele deixou de valer, apaga o código e esconde as opções do dirigente; 4.9.5: código do dirigente (Ajustes → Autorização de acessos): sem ele, as opções de preparação para dirigir ficam escondidas e o servidor não faz as perguntas do dirigente; enquanto não existir a variável CODIGO_DIRIGENTE na Vercel, vale o código de acesso; 4.9.4: texto diário com comentários adicionais que podem ser salvos e recuperados no mesmo dia (no dia seguinte são apagados) e link do wol.jw.org legível; 4.9.3: o botão 🔊 do campo de texto só aparece (e só funciona no servidor) para o administrador; a leitura em voz alta do texto diário continua para todos; 4.9.2: pesquisas salvas por semana (só as da semana escolhida; o botão apaga as das semanas anteriores); 4.9.1: pesquisas salvas (histórico das respostas da IA das reuniões neste aparelho, para reabrir depois); 4.9.0: joias espirituais com 2 joias por capítulo, sem repetir o versículo da pergunta da apostila; 4.8.9: Joias Espirituais (leitura da semana lida no wol.jw.org com as publicações do Índice das Publicações; até 2 joias por capítulo e a resposta à pergunta da apostila) e, no Estudo Bíblico, textos citados nas perguntas seguindo as opções de textos bíblicos;4.8.8: Estudo Bíblico de Congregação (capítulo da semana lido no wol.jw.org, respostas da IA por quadro, trechos das publicações citadas, resumo opcional dos textos-base) e o contexto "Sobre mim e a congregação" nos prompts; 4.8.7: cada seção da tela de prompts virou um cartão recolhível; 4.8.6: modelo da IA de texto escolhido pelo administrador na tela de prompts (Haiku, Sonnet, Opus ou Fable) e gasto do mês pela Cost API da Anthropic; 4.8.6: a barra da leitura em voz alta fecha sozinha quando a leitura termina; 4.8.5: categorias de Ajustes direto na página (sem o cartão recolhível "Configurações gerais do app"); 4.8.4: Ajustes → Autorização de acessos (código de acesso e senha de administrador informados uma vez e salvos), a IA nunca escreve "culto" (sempre reunião), comentários adicionais recolhíveis e com Limpar, atalhos Comentários e Dirigentes abrem só o grupo deles; 4.8.3: tela Início com o texto diário (do wol.jw.org; um toque abre o comentário, ler em voz alta, levar para o campo de texto e comentários adicionais da IA) e atalhos; 4.8.2: referências bíblicas lidas na forma curta ("Primeira Coríntios treze, quatro a sete"), voz com duas partes à frente (sem pausas, também em 1,15×), pular citações de publicações (w24.09 21 § 6) e referências bíblicas só entre parênteses ou depois de travessão no fim do parágrafo (o texto temático do texto diário é lido); 4.8.1: voz começa mais rápido (primeiras partes curtas) e campos de preço alinhados; 4.8.0: menu da voz para o administrador (modelo, voz, tom, o que ler e pular), consumo estimado e vozes Gemini com a conta de serviço do Google; 4.7.9: voz reserva (Chirp 3 HD) quando o Gemini é recusado; 4.7.8: botão 🔊 Ouvir (leitura em voz alta com a voz do Google); 4.7.7: Fonte CX com C preto e C branco, cada um ao lado do seu quadradinho; todos os cards começam fechados ao abrir o app; 4.7.6: tela Reuniões em dois cartões (texto e reuniões); 4.7.5: campo de texto volta a crescer depois de levar uma nota do backup; importar notas de outro backup; 4.7.4: card do desenvolvedor na largura do quadro de limitações (Sobre); 4.7.3: card recolhível "Opções principais de formatação"; 4.7.2: backup abre direto em Arquivos (sem Fototeca e câmera), cores nas seções da tela Reuniões e IA da formatação sem card recolhível a mais; 4.7.1: todas as instruções da IA na tela de prompts (frases das opções, orientação, escopo); 4.7: tela Reuniões em grupos (comentários, dirigir, discursos) e semana no alto; 4.6: card do dirigente (perguntas adicionais com seções que se ligam e desligam); 4.5: perguntas adicionais em três seções (complementares, aplicativas, explicação dos textos); 4.4: fechar backup, backup vazio e exportar notas (.xlsx/.csv); 4.3: edição do backup; 4.2: backup organizado como no JWLManager; 4.1: leitura do backup do JW Library (só leitura); 4.0: telas separadas (Formatar, Reuniões, Backup, Ajustes); 3.7: perguntas de entendimento dos textos bíblicos; 3.6: linha em branco entre as perguntas adicionais; 3.5: perguntas adicionais para o dirigente; 3.4: botão Fonte CX com caixa branca ou preta; 3.3: letras em emoji fixas no fim da faixa rápida; 3.2: regras fixas da IA (pergunta, parênteses, fontes); 3.1: estudo lido direto no wol.jw.org e limite de parágrafos; 3.0: novo nome e ícones

## 6.1.113

Limpeza e organização, sem mudança de comportamento para o usuário: histórico de versões movido para este arquivo; removidos código morto e classes CSS sem uso; o CSS e o JS saíram do index.html para app.css e app.js (o aviso de versão nova passou a comparar o APP_VERSION do app.js publicado); níveis de acesso das tarefas da IA reunidos em api/_acesso.mjs e conferidos antes de cada tarefa; respostas de 'não configurado' padronizadas em 503.

