# Histórico de versões do NoteStyle

Movido do comentário da constante APP_VERSION (index.html) em 2026-10-28.

## 6.13.11

### Adoração em Família: escolha do assunto pela lista, botão só com assunto e tudo limpo depois de preparar

- **"🧩 Quadros da programação"** mostra só os quadros (com os cânticos e os jogos aceitos); os "💛 Assuntos e situações abrangidas" saíram dele.
- **Botão "💛 Escolha um tema ou assunto na lista…"** (fino, na largura toda), logo abaixo do campo do Assunto desta semana: abre a lista dos assuntos e situações numa vista própria (com ◀ Voltar e ✔ Concluir e voltar).
- **Temas no campo Assunto:** ao marcar, os títulos dos temas escolhidos vão para o campo ("Comunicação na família; Problemas no casamento") e o rótulo mostra "Assunto (2 escolhidos)". Se a pessoa digitar o assunto, o rótulo volta a ser só "Assunto". O "(opcional)" saiu: agora o assunto é obrigatório.
- **Botão Preparar desativado** sem um assunto escrito ou sem um tema marcado (ou "Outros assuntos ou situações" preenchido).
- **Depois de preparar**, todos os temas são desmarcados e o campo Assunto fica vazio: a próxima preparação pede uma escolha nova.
- Conferido no navegador por estado e medidas (sem captura): os assuntos não estão mais no card dos Quadros, a vista abre pelo botão (319 px, a largura da linha), 2 temas marcados levam o texto ao campo com "(2 escolhidos)", digitar tira o "(2 escolhidos)" e, sem nada, o botão Preparar fica desativado.

## 6.13.10

### Adoração em Família: tempo do quadro Vídeo pela duração dos vídeos e "Objetivo da matéria"

- **Tempo do Vídeo:** a parte ficava sempre com os 10 minutos do quadro, mesmo com um vídeo de 10:50. Agora o tempo é a soma das durações dos vídeos mais 1 minuto por pergunta, arredondada para cima de 5 em 5 minutos, nunca menos que os 10 do quadro (10:50 com 3 perguntas = 15 min). O total da programação e a lista de andamento mostram o tempo real.
- **Objetivo da matéria:** toda parte com uma matéria para ler (Abertura, Princípio, Personagem, Jesus, Criador, Saiba responder, Ame o ministério) mostra, depois da fonte e do título, "**Objetivo da matéria:** …" — por que ela foi escolhida e o que se quer atingir em relação ao tema da noite (ex.: "Considerem esta matéria, que vai ajudá-los a ver a importância da perseverança no trabalho de pregação"). A IA escreve o objetivo com o texto inteiro da matéria, o tema, o ângulo e o plano da noite à frente: na Abertura e no Criador junto com as perguntas de revisão; nos outros quadros numa chamada curta, sem o raciocínio longo. A regra está na parte de prompt "Perguntas de revisão da leitura" (tela de prompts). Vale também na adoração compartilhada.

## 6.13.09

### Adoração em Família: fonte exata em todo o módulo (publicação, capítulo, seção e página)

- **Por que ainda vinha só "Parágrafo 17 · O Reino de Deus Já Governa!":** a busca exata no wol.jw.org (6.13.03) usava a frase com a pontuação, e o wol não acha frases com vírgula; sem resultado, a leitura caía no trecho do arquivo, sem capítulo nem página. Agora a busca usa até 3 frases do parágrafo, sem pontuação e sem as palavras quebradas do arquivo ("ningué m"). O exemplo sai: "O Reino de Deus Já Governa! · cap. 9 — Resultados da pregação — “Os campos… estão brancos para a colheita” · págs. 92-93", seção "Por que todos os servos de Jeová têm motivo para se alegrar", parágrafos 16-19.
- **Só a mesma publicação:** a busca aceita só o resultado da publicação do livro (pela sigla: kr, rr, lv/lvs, th, it…). Alguns arquivos do servidor têm matérias de outras publicações misturadas (o de "Mantenha-se no Amor de Deus" tem um artigo de A Sentinela de 1988); nesse caso a fonte passa a ser a publicação real em que o wol achou o texto ("A Sentinela — 1988 · w88 15/11 págs. 15-20 · “Ajudemos outros a adorar a Deus”").
- **Formato da fonte:** publicação · capítulo (número e título) · páginas; o título da leitura é a seção (subtítulo); a linha mostra os parágrafos. Seção longa demais (capítulo sem subtítulos) vira uma janela em volta do parágrafo achado; no fim do capítulo, entram os parágrafos anteriores até 3.
- **Perspicaz** (Personagem e Saiba responder): "Estudo Perspicaz das Escrituras, volume 2 · verbete “REINO” · pág. 808", com o link do verbete (o wol não traz a página na busca: o servidor abre o verbete e acha a página do parágrafo).
- **Lições** (Ame as Pessoas, Melhore Sua Leitura): com a página ("Melhore Sua Leitura e Seu Ensino (th), lição 7, pág. 10") e o link da lição.
- **Publicações citadas** na parte (Criador, Saiba responder, Ame o ministério) usam a mesma fonte e o mesmo link da leitura.
- Se o wol estiver fora do ar ou não achar o texto, a fonte diz "(local não confirmado no wol.jw.org)", para nunca passar uma fonte errada por certa.
- Artigos (A Sentinela, Despertai!) e Princípios Bíblicos já traziam publicação, edição e página.

## 6.13.08

### Adoração em Família: andamento alinhado à esquerda, com o tempo de cada atividade, e botões ao terminar

- **Alinhado à esquerda:** os itens prontos ficavam centralizados porque a regra geral `.ok` do app (no celular, bloco centralizado com margem) pegava o item "ok" da lista. Agora todas as linhas ficam à esquerda; os prontos continuam azuis.
- **Tempo alinhado:** cada linha mostra o estado, o tempo da atividade ("10 min"), o ícone e o nome, em colunas fixas: os tempos ficam exatamente um embaixo do outro (conferido por medidas a 375 px: mesmas posições em todas as linhas).
- **Ao terminar:** a lista continua à vista (agora num card recolhível, "✅ Atividades montadas"), com os botões "📄 Exibir a programação" e "▶️ Iniciar a adoração (gerar o código)" embaixo. Ao tocar em Exibir, a programação aparece e a lista recolhe (dá para abrir de novo). A programação anterior sai da tela quando uma nova preparação começa.

## 6.13.07

### Adoração em Família: "Assuntos e situações abrangidas" em cards, com Qualidades cristãs e Personagens bíblicos

- "Circunstâncias" passou a se chamar **"Assuntos e situações abrangidas"** (também "Outros assuntos ou situações" no campo livre e no pedido à IA).
- Cada seção é um card recolhível que mostra só o tema e o limite: 🏠 Vida familiar (até 2), 📖 Vida cristã (até 2), 💛 Circunstâncias especiais (até 2), 💎 Qualidades cristãs (só 1) e 👤 Personagens bíblicos (só 1). O título do card mostra quantos itens dele estão marcados; as seções com algo marcado já abrem.
- **Qualidades cristãs:** "🍇 Fruto do espírito (Gálatas 5:22, 23)" — amor, alegria, paz, paciência, bondade, benignidade, fé, brandura e autodomínio (como na Tradução do Novo Mundo) — e "✨ Demais qualidades" (humildade, modéstia, coragem, lealdade, generosidade, disposição de perdoar, gratidão, honestidade, obediência, zelo, compaixão, misericórdia, sabedoria, discernimento, hospitalidade, contentamento, perseverança, integridade, confiança em Jeová, temor a Deus, razoabilidade e diligência).
- **Personagens bíblicos:** Antes do Dilúvio, Depois do Dilúvio, Nação de Israel, Profetas e Cristãos (63 personagens conhecidos).
- Uma qualidade ou um personagem é sempre item único: ao marcar, todos os outros itens travam. Vão para a IA como "Qualidade cristã: …" e "Personagem bíblico: …".

## 6.13.06

### Adoração em Família: até 2 circunstâncias relacionadas, e assunto ou circunstância obrigatório

- **No máximo 2, relacionadas:** ao marcar uma circunstância, só ficam liberadas as que combinam com ela; as outras ficam esmaecidas e travadas. Com 2 marcadas, todas as outras travam. Luto e Doença na família não liberam nenhuma; Ansiedade combina só com Desânimo espiritual; Dificuldades financeiras só com Equilíbrio no trabalho; Bullying só com os filhos (pequenos ou adolescentes); as do ministério só entre si; as de preparo para o casamento só entre si. Os grupos ficam em `FAMILIA_CIRC_GRUPOS` e `FAMILIA_CIRC_PARES` (app.js). Perfis salvos com mais de 2 (ou sem relação) ficam com 2 que combinam.
- **Assunto ou circunstância:** para preparar a programação é preciso escrever o assunto desta semana ou marcar pelo menos uma circunstância (ou escrever em "Outras circunstâncias").

## 6.13.05

### Adoração em Família: três circunstâncias de preparo para o casamento (rótulo discreto, descrição para a IA)

Em 🏠 Vida familiar: "Preparar-se para formar uma família", "Apoiar os filhos jovens rumo à vida adulta" e "Namoro e casamento segundo os padrões de Jeová". O rótulo na tela é curto e discreto; quando marcada, a circunstância vai para a IA com uma descrição completa entre parênteses (qualidades que o jovem cultiva e mostra, convívio sadio com outros jovens cristãos, paciência; o papel dos pais, sem superproteção nem pressão; padrões de Jeová para o namoro), sempre com a ordem de tratar com muito tato e não expor ninguém. As descrições ficam em `api/_prompts.mjs` (DETALHES_CIRCUNSTANCIAS_FAMILIA) e aparecem na tela de prompts ("Detalhes das circunstâncias").

## 6.13.04

### Adoração em Família: duas circunstâncias novas em Vida cristã

"Luta para fazer o que é certo e fugir de tentações" e "Vencer maus hábitos".

## 6.13.03

### Adoração em Família: matéria do livro com capítulo, páginas e seção inteira; vídeos alternando formatos

- **Local exato:** os arquivos de vários livros (A Adoração Pura, O Reino de Deus Já Governa!, Imite a Sua Fé…) não marcam os capítulos nem as páginas. Agora o servidor procura a frase do parágrafo no wol.jw.org, abre o capítulo e traz a citação certa: "A Adoração Pura de Jeová É Restaurada! (rr), cap. 18, págs. 193-194", "Parágrafos 13-15", o título do capítulo ("“O meu grande furor se acenderá”") e o link direto para o parágrafo.
- **Matéria maior:** em vez de um parágrafo solto, vem a SEÇÃO inteira do subtítulo em que o parágrafo está (com o subtítulo em negrito), com no mínimo 3 parágrafos (se a seção for curta, junta a seguinte), sem as perguntas de estudo nem as legendas. Nas brochuras de lições (lmd e th) continua a lição inteira; se o wol não responder, valem os parágrafos seguintes do arquivo.
- A linha da fonte não repete mais o parágrafo ("Parágrafo 15 · par. 15").
- **Vídeos:** o quadro Vídeo alterna o formato de uma noite para outra: dois vídeos curtos; um vídeo longo (de 8 a 16 minutos, de preferência um discurso da Adoração Matinal); ou vídeos de experiências (Entrevistas e Casos Reais). Os discursos da Adoração Matinal e as experiências passam a estar sempre na lista (antes, os discursos só para famílias sem crianças). Um vídeo longo pode passar dos 10 minutos; com dois vídeos, a soma vai até 15 minutos.

## 6.13.02

### Adoração em Família: "Ame o ministério" mais rápido e matérias inteiras

- **Demora:** nos registros do servidor, o quadro "Ame o ministério" levava de 76 a 160 s no Gemini 4 Argon (e, na última vez, estourou o limite de 170 s, erro 504), enquanto os outros saíam em 5 a 15 s. A IA lia pouco (cerca de 3 mil tokens) e escrevia pouco (cerca de 200): o tempo ia no raciocínio do modelo. Como o quadro é simples (uma situação, 1 a 3 frases e 1 ou 2 perguntas), ele passa a ser pedido sem o raciocínio longo.
- **Matéria cortada:** a leitura dos quadros com livros era um parágrafo solto (por exemplo, só o quadro "NA PREGAÇÃO:" de duas linhas, sem a lição). Agora vem a matéria inteira: nas brochuras com lições (Ame as Pessoas e Melhore Sua Leitura e Seu Ensino), a LIÇÃO toda, com o título ("Lição 1 — Comece bem") e os subtítulos ("COMO VOCÊ PODE FAZER ISSO:") em negrito; nos outros livros, o parágrafo e os seguintes do mesmo estudo (até 4), sem as notas de rodapé e sem passar para o estudo seguinte. Vale para Ame o ministério, Abertura, Personagem, Jesus, Fé no Criador e Saiba responder.

## 6.13.01

### Adoração em Família: relacionamentos em Vida cristã

"Cultivar bons relacionamentos (família, amigos, trabalho, irmãos)" e "Promover a paz nos nossos relacionamentos" passaram de 🏠 Vida familiar para 📖 Vida cristã.

## 6.13.00

### Adoração em Família: três circunstâncias novas

- 🏠 Vida familiar: "Cultivar o respeito e amor no casamento" e "Promover a paz nos nossos relacionamentos".
- 📖 Vida cristã: "Respeitar a autoridade na congregação".

(Depois de 6.12.99 vem 6.13.00: o último número não passa de 99.)

## 6.12.99

### Adoração em Família: circunstâncias em subgrupos e rótulos novos

- O card "💛 Circunstâncias" agora tem três subgrupos: 🏠 Vida familiar, 📖 Vida cristã e 💛 Circunstâncias especiais.
- "Filho adolescente" e "Criança pequena" saíram; no lugar, "Lidar com filhos adolescentes" e "Educação de filhos pequenos".
- "Parente que não serve a Jeová" virou "Lidar com familiares descrentes"; "Dificuldades com relacionamentos (família, amigos, trabalho, irmãos)" virou "Cultivar bons relacionamentos (família, amigos, trabalho, irmãos)".
- Nova: "Evitar más associações e fazer bons amigos" (em Vida cristã).
- Os perfis salvos com os nomes antigos são convertidos ao abrir: o que estava marcado continua marcado com o nome novo.

## 6.12.98

### Adoração em Família: o atalho dos quadros mostra o que está marcado

Na seção Quadros da programação, com todos os quadros marcados o botão "🌟 Completa" fica destacado (azul claro, borda azul); com qualquer quadro desmarcado, o destacado é o "🌙 Noite curta". Atualiza ao marcar ou desmarcar um quadro e ao carregar o perfil.

## 6.12.97

### Adoração em Família: programações salvas só com o título à vista

Na lista "📂 Programações salvas" da tela inicial do módulo, cada programação agora mostra só o título; a data, o tema, o resumo e as atividades ficam recolhidos e abrem ao tocar no título (▸/▾). Os botões da programação (Abrir, Selecionar, 🗑️) continuam sempre visíveis embaixo. Quem foi aberto continua aberto quando a lista é redesenhada.

## 6.12.96

### Adoração em Família: a voz lê a referência do primeiro parágrafo da matéria

A regra de voz que não lê a referência bíblica depois de um travessão no fim do parágrafo fazia o 🔊 pular o "— 1 PEDRO 5:7" do primeiro parágrafo da matéria ("A BÍBLIA DIZ: ‘Lancem sobre Deus toda a sua ansiedade…’ — 1 PEDRO 5:7."). Agora há uma exceção: o primeiro parágrafo da matéria, se for curto (até 300 caracteres), vale como título, e a referência depois do travessão é lida ("Primeira Pedro cinco sete"). Em parágrafo longo, e nos travessões do meio do artigo, a regra de não ler continua valendo.

## 6.12.95

### Adoração em Família: cabeçalho do campo da matéria em cinza e centralizado

- O cabeçalho "📖 Exibir e ler esta matéria aqui" (o que fica visível com o campo recolhido) ganhou o mesmo fundo cinza clarinho dos links, na largura toda do campo, com o texto centralizado.
- O título da matéria dentro do campo também fica centralizado (o 🔊 continua no começo da linha).

## 6.12.94

### Adoração em Família: matéria do Princípios Bíblicos formatada e antes dos textos

- **Cada texto numa linha:** a matéria do livro saía em um bloco só ("É correto orar…? Col 1:9; Tg 1:5. Relatos bíblicos importantes: 2Cr 1:8-12 — …"). Agora sai em linhas: "Versículos citados" com cada referência em negrito, e "Relatos bíblicos importantes" com a referência em negrito, o travessão e o resumo, uma linha por relato. Vem dos campos estruturados do índice (`versiculos` e `relatos`); sem eles, vale o texto corrido de antes.
- **Ordem:** primeiro a matéria com o princípio escolhido e as citações, depois a reprodução dos textos citados e depois as perguntas.
- O 🔊 lê a matéria sem os asteriscos do negrito.

## 6.12.93

### Adoração em Família: rótulos dos textos bíblicos e do áudio

- O botão de áudio do versículo agora diz "▶️ áudio do texto do JW" (com mais de um trecho, "▶️ áudio do JW: Salmo 65:2").
- O rótulo "📖 Textos" virou "📖 Textos para considerar", com uma linha em branco entre ele e o primeiro texto.

## 6.12.92

### Adoração em Família: título nos dois lugares, links de matéria padronizados e textos ajustados

- **Fonte e depois o título:** abaixo do bloco da matéria aparece primeiro a identificação da fonte (publicação, edição e página) e logo depois o título da matéria, sempre visível. O título também fica dentro do campo recolhido (o que eu havia tirado do alto na 6.12.91 volta).
- **Campo "📖 Exibir e ler esta matéria aqui"** (antes "Trecho para considerar"): o título dentro do campo tem o mesmo fundo cinza clarinho do link, uma linha separando-o do texto e o 🔊 no começo da linha do título.
- **Links:** todo link de matéria da Adoração diz "Abrir esta matéria na biblioteca wol.jw.org ↗" (a publicação citada ganha o nome em texto acima do link). Os links dos vídeos e dos cânticos também ganham a moldura fininha. O texto de todos os links fica centralizado dentro da moldura.
- **Objetivo da Abertura:** "Ler juntos a matéria sugerida, os textos e comentar as lições".

## 6.12.91

### Adoração em Família: título da matéria dentro do campo e links em moldura fininha

- **Título dentro do campo:** o título da matéria saiu do alto do bloco e passou para dentro do campo "Trecho para considerar", antes do texto. O 🔊 lê só o que está no campo: primeiro o título e depois o restante da matéria.
- **Links em moldura:** o link "Abrir este trecho no wol.jw.org" e os links das publicações ficam numa moldura bem fininha, na largura toda, com fundo cinza clarinho.

## 6.12.90

### Adoração em Família: artigo inteiro, experiência formatada e perguntas de revisão do texto lido

- **Matéria não sai mais cortada:** o texto do artigo era cortado em 2600 caracteres, no meio da experiência (o artigo "Oração: ‘Lancem sobre ele toda a sua ansiedade’" tem 3158). Agora vai até 7000 caracteres e, se passar disso, o corte é antes do último título que ainda cabe (uma seção inteira ou nenhuma), nunca no meio de uma experiência; no fim nunca sobra um título solto.
- **Formatação:** o título do quadro/experiência ("Como a Bíblia está ajudando Julian") sai em destaque, e os subtítulos (os do artigo e os curtos de dentro da experiência, como "Como a ansiedade me afeta") em negrito.
- **Perguntas sobre o que foi lido:** a IA do quadro só via o título do artigo e escrevia perguntas genéricas. Agora, depois de o servidor ler o texto, uma segunda chamada curta (nova parte de prompt "Perguntas de revisão da leitura", visível e editável na tela de prompts) escreve as perguntas com o texto inteiro à frente, cobrindo começo, meio e fim e, quando houver, pelo menos uma sobre a experiência. Vale na Abertura (3 perguntas) e no Fé no Criador (2). Sem tempo ou com erro, ficam as perguntas do quadro.
- A sessão compartilhada aceita a matéria de até 8000 caracteres, e o 🔊 reconhece os títulos e subtítulos.

## 6.12.89

### Adoração em Família: voz com a regra das referências bíblicas e ícone 🔊 dentro da moldura

- **Referências lidas do jeito certo:** a voz dos campos de texto (e das perguntas) mandava o texto cru ao Google, que lia "1 Pedro 5:7" como "um pedro cinco para sete". Agora o pedaço passa pelas mesmas regras de fala da leitura em voz alta (`textoParaVoz`, as regras do administrador), e sai "Primeira Pedro cinco sete". O servidor passa a receber o pedaço falado em `texto` e o original da programação em `original`, e confere o original (o falado não pode ser bem maior que ele).
- **Ícone no lugar certo:** o 🔊 do "Trecho para considerar" fica dentro da moldura do campo, na mesma linha de "📖 Trecho para considerar" (tocar no ícone não abre nem fecha o campo).

## 6.12.88

### Adoração em Família: perguntas logo depois de cada leitura e 🔊 só ícone em todos os campos de texto

- **Leitura e, em seguida, as perguntas dela:** na Abertura a ordem agora é matéria, perguntas sobre a matéria, relato bíblico e perguntas sobre o relato (antes as perguntas ficavam todas no fim). O servidor marca quantas das primeiras perguntas são da leitura (`perguntasLeitura`) e a sessão compartilhada guarda essa marca. Programações já geradas continuam como estavam.
- **🔊 como ícone, não botão largo:** o botão largo da 6.12.86 virou o ícone pequeno 🔊 no alto do campo, como nas perguntas. Está no "Trecho para considerar", no "Exibir a matéria na tela", na transcrição do vídeo e na letra do cântico. Lê pedaço por pedaço, pela voz do Google, sem código e sem créditos; o servidor só lê pedaços que estão no texto que a programação aponta (parte, tipo e posição em `origem`).

## 6.12.87

### Adoração em Família: o motivo de "🔄 Trocar agora" não andar aparece junto do botão

O aviso da troca (programação já compartilhada, família sem descrição, código de pesquisa ausente, preparação em andamento ou erro do serviço) ia só para a linha de status no alto do formulário, fora da vista; para quem estava no quadro, o botão parecia morto. Agora o mesmo aviso aparece logo abaixo do botão, dentro do painel da troca.

## 6.12.86

### Adoração em Família: trecho do artigo com dados da publicação, parágrafos e subtítulos, e botão de leitura

- **Dados da publicação:** o trecho de artigo da Abertura mostra agora a revista, a edição e a página, lidas do rodapé do wol (ex.: "A Sentinela Anunciando o Reino de Jeová (Público) — 2020 · wp20 N.° 3 pág. 10"), no lugar da seção do catálogo.
- **Formatação:** o texto do trecho mantém os parágrafos e os subtítulos do artigo, em negrito (antes saía tudo num bloco só).
- **🔊 Ouvir o trecho:** botão em todo campo "Trecho para considerar" na adoração ao vivo (fora do campo recolhido); lê o título e cada parágrafo pela voz do Google, sem código de leitura e sem créditos (uso "familia"; o servidor só lê o que está na programação da sessão). Se o Google falhar, continua na voz do aparelho.

## 6.12.85

### Adoração em Família: Abertura com a matéria primeiro e o local exato da fonte

- **Matéria antes do relato:** na atividade 1 (Abertura) o trecho da matéria a ser lida agora vem primeiro, e o relato bíblico (Textos) depois, na tela e na sessão compartilhada. As outras atividades ficam como estavam.
- **Local exato da fonte:** o servidor passa a guardar, para cada parágrafo dos livros, o capítulo (linha "CAPÍTULO N"), o número do parágrafo (o número que abre o texto) e a página em que o capítulo começa (pelo Sumário do livro). A Abertura mostra, por exemplo, "Parágrafo 9 · cap. 5, par. 9, o capítulo começa na pág. 47" e um link para abrir o trecho no wol.jw.org.
- Nada é inventado: os livros não trazem marcas de página no corpo, então a página é a do começo do capítulo (dita assim); livros sem numeração de capítulo ou parágrafo no arquivo mostram só o título e o link de busca no wol.

## 6.12.84

### Revisão do módulo Adoração em Família: contraste no tema escuro

Medi o contraste de texto e fundo (estilo calculado, sem capturas) na tela do módulo e na sessão ao vivo (dirigente e participante), nos dois temas. No tema escuro, vários blocos tinham fundo claro fixo e texto na cor do tema (clara), quase invisível. Corrigidos para seguirem o tema:

- **"🔒 Só você vê: …"** (o dirigente espiando a resposta): fundo claro fixo com texto claro.
- **Questão em andamento** (com dicas dadas): fundo azul claro fixo; a dica, a "Resposta escondida" e o número da questão sumiam.
- **Link "Abrir este trecho no wol.jw.org ↗"** nas leituras: ficava no azul padrão do navegador (contraste 1,56 no tema escuro).
- **Card "Adorações compartilhadas"** (fundo azul claro fixo) e o botão de limpar o sorteio (fundo rosa claro fixo).
- Ajustes finos de cor em "Questão N de M", no valor "vale N pontos agora", nos nomes do placar e no rótulo da leitura (contraste entre 2,9 e 3,2).

Resultado: nenhum texto abaixo do contraste mínimo no tema escuro em todas as telas medidas. No tema claro só sobram emojis (🔑, 🗑️) e um botão desabilitado, que não contam. O cartão de boas-vindas já tinha sido corrigido na 6.12.82.

## 6.12.83

- **Títulos dos quadros cortados no meio da palavra:** na lista do programa, "Lições da vida de Jesus: …e ainda assim ens" e "Ame o ministério: …interesse na prime" saíam cortados de forma seca (100 e 160 caracteres). Agora o título tem até 70 caracteres, cortado no fim de uma palavra (sem "e", "de"… pendurados) e com "…" (`cortarNaPalavra`). A pergunta inteira do Saiba responder continua em "perguntas", e a situação inteira do Ame o ministério abre a descrição quando o título a encurtou. Vale para as programações novas.
- **Novos modelos Gemini na lista do app:** Gemini 4 Neon e Gemini 4 Hydrogen (aparecem no Model Garden da conta da empresa e respondem nos testes simples e estruturado; preços estimados, como os outros Gemini 4). Escolha em Ajustes → Modelos e agentes de IA.

## 6.12.82

- **Adoração em família ao vivo, tema escuro:** no cartão de boas-vindas (fundo claro nos dois temas), o título da noite, o resumo e "Quem participa" ficavam com texto claro sobre fundo claro, quase invisíveis. O texto do cartão agora é escuro fixo e o quadro "Programa" dentro dele continua seguindo o tema.

## 6.12.81

### Adoração em Família por quadros: acentuação e siglas curtas (achados no teste com o Gemini)

- **Acentuação:** o Gemini 3.5 Flash escrevia alguns quadros sem acentos ("Sera que perdoar alguem…", "Jeova", "cantico", "nao"). As regras comuns de todos os pedidos (plano e quadros) ganharam a regra "ACENTUAÇÃO": escrever sempre em português do Brasil com acentos e cedilha ("Jeová", "não", "você", "cântico", "perdão", "oração"). Numa amostra de 12 quadros, os acentos ficaram corretos; o que sobrou veio dos assuntos do catálogo de cânticos, gravados sem acento.
- **Abreviações bíblicas:** o Flash fazia siglas de frases inteiras de versículos ("T L C O N E D P" para "Tão Longe Como O Nascente É Do Poente"), impossíveis de adivinhar e que passavam na conferência palavra por palavra. Agora a instrução pede **expressões bíblicas conhecidas** (nome, título, grupo, objeto ou acontecimento fixo, como "Os 12 A de C", "O P da P", "O C de D") com **no máximo 4 iniciais**, e o servidor tira a rodada de sigla longa (`siglaCurta`, `abreviacaoJogavel`). Se faltarem rodadas, o pedido de novo diz o que fazer. No teste real com o Flash, três jogos de Abreviações voltaram com 9 a 10 rodadas, todas com siglas curtas ("O Fruto do Espírito", "O Ministério da Reconciliação", "As Boas Novas da Paz").
- Instruções da IA (tela de prompts): as regras comuns, o jogo, o formato do jogo e a descrição da montagem foram atualizados.
- Testes: `testar-adoracao-quadros.mjs` passou a ter 71 testes (3 novos).

## 6.12.80

### Adoração em Família por quadros: tempo limite acompanha o modelo

- **Achado no teste com o Gemini (Google Cloud):** o plano e os quadros usavam 120 s fixos por chamada à IA. O Gemini 4 Argon com esforço alto passou disso nos jogos de 3 dicas e no Verdadeiro ou falso, e o servidor respondeu erro 504 ("A IA demorou demais"): 3 dos 6 tipos de jogo não ficaram prontos.
- **Correção:** o plano e cada chamada dos quadros agora usam `tempoIa`, a mesma regra das outras telas do app (120 s no Flash e no Haiku; o dobro, até 170 s, nos demais modelos), sempre dentro do prazo total de 270 s de cada quadro. Com o limite novo, os 3 jogos voltaram prontos no 4 Argon com esforço alto (141 s, 172 s e 258 s).
- Teste: `testar-adoracao-quadros.mjs` confere que o plano e os quadros usam `tempoIa` e que não sobrou cliente de 120 s fixo na Adoração em Família.

## 6.12.79

### Correções da revisão de código da Adoração em Família por quadros

- **Entre duas tentativas, vale a melhor:** ao refazer um quadro, a 2ª tentativa só substitui a 1ª se tiver menos problemas ou, empatando, não tiver menos rodadas (`segundaTentativaMelhor`). Antes só se contavam os problemas, e uma 1ª tentativa com 9 rodadas (falta 1) perdia para uma 2ª com 4 rodadas (também falta 1).
- **Rodada que não dá para conferir sai:** no Verdadeiro ou falso e no Quem sou eu?, a rodada sem referência, ou com referência que a Bíblia do servidor não achou, não passa mais como se tivesse sido conferida: sai do jogo, sem gastar a IA (veredito `sem_texto`, posto pelo servidor), e o pedido de novo diz por quê. A IA só confere as rodadas que têm o texto da Bíblia. Se nenhuma rodada tem texto e a Bíblia do servidor nem responde, nada é conferido e as rodadas ficam como estão (não derruba o jogo por uma falha do armazenamento). A instrução do jogo agora diz que toda rodada precisa de uma referência que o servidor ache na Bíblia.
- **Princípio bíblico:** sem nenhuma entrada do índice (arquivo indisponível), o quadro dá erro 503 sem chamar a IA e o app mostra o "🔄 Refazer este quadro", em vez de sair só com as duas perguntas fixas ("do(s) texto(s) acima") e nenhum texto. E um texto bíblico que a Bíblia não achou deixa de fazer refazer o Princípio, porque as referências dele vêm do índice, escolhidas pelo servidor, e a IA não pode corrigi-las.
- **Prazo total de cada quadro (270 s):** o app espera 290 s por quadro, mas um jogo podia encadear até 6 chamadas em série (gerar, conferir, refazer, conferir, trocar o tipo, conferir), cada uma com limite de 120 s. Agora cada chamada leva só o tempo que sobra (até 120 s) e, com menos de 40 s, o servidor não refaz, não troca o tipo do jogo nem confere: devolve o quadro como está, com o aviso "sem tempo para refazer o quadro", em vez de o app desistir enquanto o servidor ainda gasta IA.
- Instruções da IA (tela de prompts): o jogo ganhou a regra da referência obrigatória, e o formato e a descrição da montagem foram atualizados.
- Testes: `testar-adoracao-quadros.mjs` passou a ter 68 testes (5 novos).

## 6.12.78

### Jogos: conferência com a Bíblia

- **Por que:** o Verdadeiro ou falso e o Quem sou eu? são escritos inteiros pela IA, e o servidor só conferia o formato. Na geração real da 6.12.77 saíram rodadas erradas: uma afirmação verdadeira marcada "Falso" (Estêvão pediu a Jeová que não imputasse o pecado, At 7:60) e dicas com quem fez e quem recebeu trocados (José mandou a mensagem de perdão em Gn 50:16; Simei tratado com desprezo pelo rei em 2 Sm 19).
- **Conferência:** depois de montar o jogo, o servidor transcreve da Bíblia o texto da referência de cada rodada e uma **segunda chamada, curta**, diz se a rodada "confere", se o texto a "contradiz" ou se "não consta". **Só as rodadas que o texto contradiz saem.** Se a conferência falhar (erro, recusa ou sem a Bíblia no servidor), as rodadas ficam como estão. Os tokens dela entram na conta do quadro. Os outros 4 tipos não passam por ela: nascem do texto transcrito ou de dados do servidor.
- **Teste real:** a conferência tirou as 3 rodadas erradas da 6.12.77 (Estêvão, José e Simei) e uma errada de propósito, e manteve as 4 certas que foram junto. Custou cerca de 2,7 mil tokens de entrada e 0,7 mil de saída por jogo.
- **Quando faltam rodadas:** se depois da conferência ficarem menos rodadas que o mínimo do tipo, o jogo é pedido de novo uma vez, e o pedido diz quais rodadas saíram e por quê (citando o motivo), pedindo cuidado com quem fez o quê e a quem e todos os versículos que sustentam a rodada.
- **Folga nas quantidades:** o Quem sou eu? passa a pedir 10 rodadas (no mínimo 6; ficam até 8) e o Verdadeiro ou falso, 14 (no mínimo 10; ficam até 12), para sobrar o suficiente quando a conferência tirar alguma.
- **Teto de saída maior no jogo:** o quadro de jogo pode escrever até 10 mil tokens (eram 6 mil, e numa geração a resposta chegou a ser cortada no meio do JSON). É só um teto; o custo é o que a IA escreve.
- **Instruções da IA (tela de prompts):** nova parte editável "Adoração por quadros: Conferência do jogo com a Bíblia" (`adoracao_q_conferir`) e o formato dela (só leitura); a parte do Jogo avisa a IA da conferência; a descrição de como o pedido é montado foi atualizada.
- Testes: `testar-adoracao-quadros.mjs` passou a ter 63 testes (4 novos da conferência, com respostas simuladas).

## 6.12.77

### Jogos: aspas, quem fala e livros

- **Aspas sem par no Complete o versículo:** antes de pôr a lacuna, o servidor tira as aspas que ficam sem par no versículo transcrito (`semAspasSoltas`). Exemplos: o “ do começo de Mateus 5:9 e de Mateus 6:14, e o ” do fim de Mateus 18:35 e de Marcos 11:25. Aspas com par ficam. O ’ entre letras (apóstrofo, como em pé-d’água) também fica. No Quem disse isso?, a fala transcrita passa pela mesma limpeza.
- **Quem fala, conferido no Quem disse isso?:** a rodada só vale quando o nome de quem fala está no próprio versículo, antes da aspa de abertura, e o nome de quem ouve não vem antes dele (`quemFalaConfere`).
  - Gênesis 4:9: "Jeová, a Caim" vale; "Caim, a Jeová" sai.
  - Sai também a rodada que não dá para conferir: o versículo só diz "ele" ou "ela" (Lucas 2:49, Rute 2:10) ou começa já com a aspa (Ester 4:16).
  - O prompt do jogo pede primeiro quem fala e a referência começando no versículo que diz o nome dele. Por isso podem sobrar menos rodadas; a regra de 6.12.76 continua (refazer uma vez e, se faltar, trocar o tipo).
- **Grafia dos livros nas referências do jogo:** a referência escrita pela IA fica como na Bíblia do app (`referenciaPadrao` e `livroPadrao`, em `_fontes.mjs`). Exemplos: "Filemon 10" e "Filemom 10" viram "Filêmon 10"; "Salmo 103:12" vira "Salmos 103:12"; "Rom. 12:17" vira "Romanos 12:17". Vale para todos os tipos, e o que não é nome de livro fica como veio.
- A linha MONTAGEM da tela de prompts diz as três regras.

### Telas dos jogos

- **Sem compartilhar, uma questão por vez:**
  - "Questão k de N" com o valor da questão, para quem dirige parar quando o tempo acabar.
  - A 1ª dica já aparece; "💡 Próxima dica" mostra uma dica por toque.
  - A resposta fica escondida até "Mostrar resposta" (ICONE_OLHO) e aparece com a referência.
  - "◀ Anterior" e "Próxima questão ▶" guardam o estado de cada questão. Na última aparece "🏁 Última questão".
  - A lista com todas as respostas saiu da tela, mas o texto copiado e o Word continuam com elas.
- **Ordem e data sem compartilhar:** a lista embaralhada fica à mostra e a "🔑 Ordem certa (com as datas)" fica recolhida. A ordem sai também do fim de "como jogar". Vem de `jogo.ordem` ou, nas programações sem esse campo, da lista do fim de "como jogar".
- **Placar local (opcional, recolhido):**
  - Os jogadores sugeridos são os apelidos (ou papéis) do cadastro da família, e "+ jogador" acrescenta outros. Cada um ganha um bichinho de PLACAR_ANIMAIS.
  - "Quem acertou?" aparece com a resposta à mostra e dá os pontos de agora (2 e depois 1 nos jogos de 2 dicas). Tocar de novo desfaz.
  - No Ordem e data, quem dirige escolhe quem acertou a ordem e quantos pontos (de 0 até o número de eventos + 2).
  - O placar vive só na memória da tela: nada é salvo nem enviado, nem os nomes.
- **Ordem e data compartilhado:**
  - Nova ação `revelar-ordem`: quem dirige mostra a todos a ordem certa com as datas. Ela fica em `estado.ordensReveladas`; antes disso, só em `respostas.json`.
  - `pontuar` com `rodada: "ordem"` grava quem acertou e os pontos escolhidos (0 até eventos + 2) em `acertos[parte].ordem`, e revela a ordem. "Ninguém acertou" também vale.
  - `reiniciar` com `rodada: "ordem"` esconde a ordem de novo e tira esses pontos.
  - O placar compartilhado já soma esses pontos. As sessões antigas continuam iguais.
- Tudo conferido a 375 px, sem capturas de tela: os botões de cada linha ocupam a largura toda do card e crescem por igual, com cores suaves.

## 6.12.76

### Jogos conferidos e montados pelo servidor

- **Tipo do jogo:** o servidor sorteia o tipo da noite e grava o identificador fixo em `jogo.idTipo` (quem_sou_eu, verdadeiro_falso, ordem_data, quem_disse, complete_versiculo, abreviacoes). `jogo.tipo` continua sendo o nome que aparece na tela.
- **Rodadas por tipo, para caber nos 10 minutos:**
  - Quem sou eu?: pede 8, no mínimo 6. Cada rodada tem 3 dicas, por isso cabem menos.
  - Verdadeiro ou falso: pede 12, no mínimo 10.
  - Quem disse isso? e Complete o versículo: pede 12, no mínimo 8, e ficam no máximo 10.
  - Abreviações: pede 10, no mínimo 8.
  - O número vai para a IA na linha "QUANTIDADE". Com menos rodadas válidas que o mínimo, o servidor refaz uma vez dizendo o que faltou.
- **Conferência de cada tipo:**
  - Quem sou eu?: exatamente 3 dicas, sem o nome da resposta e sem repetir o personagem.
  - Verdadeiro ou falso: a resposta começa com "Verdadeiro." ou "Falso." (o servidor padroniza) e tem pelo menos 3 de cada.
  - Abreviações: a sigla confere palavra por palavra com a resposta (exemplo: "Os 12 A de C" = "Os 12 Apóstolos de Cristo"). A pergunta fica "O que significa? Dica 1: sigla Dica 2: Está em livro."
- **Complete o versículo, montado pelo servidor:**
  - A IA só escolhe a referência e a palavra. O servidor transcreve o versículo da Bíblia e põe a lacuna.
  - A pergunta fica "Complete a palavra que falta. Dica 1: “versículo com ______” Dica 2: Está em livro."
  - Não valem como lacuna: "Jeová", "Deus", palavras com menos de 4 letras, números, o nome do livro, palavras muito comuns e palavras que aparecem mais de uma vez no versículo.
- **Quem disse isso?, montado pelo servidor:**
  - A IA escolhe a referência e quem disse. O servidor transcreve a fala que está entre aspas no versículo.
  - Sai a rodada que não tem fala entre aspas, a que tem fala curta e a que traz na fala o nome de quem disse.
  - Dica 2: o livro. Se o livro tem o nome de quem disse (Jó, Rute, Ester), a Dica 2 diz a parte das Escrituras.
- **Troca do tipo:** no Complete o versículo e no Quem disse isso?, se depois de refazer ficarem menos de 6 rodadas conferidas, o servidor faz o jogo de novo com outro tipo aceito pela família e avisa.
- **Pontos:** quem acerta com a 1ª dica ganha 2 pontos; com a 2ª, 1 ponto. É a fórmula que já existia.
- **Sem a Bíblia no servidor:** o Complete o versículo e o Quem disse isso? ficam fora do sorteio.
- **Referência secreta na Adoração compartilhada:**
  - A referência de cada rodada (o texto que confirma a resposta) fica só em respostas.json, como a resposta.
  - Ela aparece para todos quando quem dirige revela ou pontua a rodada (`estado.referenciasReveladas`).
  - "Espiar" mostra a resposta e a referência só a quem dirige. "Reiniciar" esconde as duas de novo.
- **Memória entre noites:** os versículos do Complete o versículo e do Quem disse isso? entram na nova memória "jogo_versiculos" e não voltam nas noites seguintes, nem os já usados em outros quadros da mesma noite.

### Princípio e Jesus

- Os versículos do Princípio bíblico agora entram na memória "relatos". Na noite seguinte, a Abertura, o Personagem e Jesus não os repetem.
- O quadro de Jesus traz um episódio narrado (o que Jesus fez ou viveu), com pelo menos 3 versículos, e não só um ensino. Com menos de 3 versículos, o servidor refaz uma vez.
- As instruções aparecem na tela de prompts (Jesus, Jogo, os formatos e a descrição de como o pedido é montado).

## 6.12.75

### Passagens entre capítulos e texto bíblico vazio

- **Passagens que atravessam capítulos:**
  - A Bíblia do servidor agora transcreve passagens como "Atos 7:54-8:1", "Gênesis 44:18-45:15" e "Jon 3:10–4:11".
  - A passagem vai do versículo inicial até o fim do 1º capítulo, pega os capítulos do meio inteiros e termina no versículo final do último.
  - Vale para até 4 capítulos e respeita o limite de versículos de cada uso. A referência sai escrita por capítulo, como "Atos 7:54-60; 8:1".
  - Antes, essas passagens vinham sem texto. As 3 referências do Princípios Bíblicos que atravessam capítulos agora são lidas.
- **Conferência de repetição:** passagens com outro capítulo depois de ";" ("Mateus 24:14; 28:19, 20") e passagens entre capítulos ("Atos 7:54-8:1") contam os versículos certos. Antes, "Mateus 24:14; 28:19, 20" virava o versículo errado 24:28.
- **Texto bíblico não achado:** se a passagem de um quadro não for achada na Bíblia do servidor (por exemplo, uma referência mal escrita), o servidor pede o quadro de novo uma vez, avisando a IA do que faltou.

### Memória entre noites: passagens do Personagem e de Jesus

- As passagens do Personagem do dia e das Lições da vida de Jesus agora entram na memória "relatos", junto com o relato da Abertura. A passagem só entra se foi achada na Bíblia.
- Nesses dois quadros, a IA recebe a lista dos relatos das últimas semanas para evitar. Se repetir, o servidor refaz uma vez e, se ainda repetir, avisa.
- Exemplo: o Personagem de uma noite não volta como relato da Abertura na noite seguinte.
- As instruções aparecem na tela de prompts (Personagem, Jesus e a descrição de como o pedido é montado).

### Remoção do ajuste da programação montada

- Saiu a montagem da "minha programação" com partes de duas opções. Ela só servia às programações salvas antigas, que tinham duas opções.
- Saiu também o botão "✨ Ajustar com a IA" dessa montagem, e com ele a função do servidor e o prompt "Adoração em Família: ajuste da programação montada pelo usuário".
- As programações salvas antigas com duas opções continuam abrindo: cada opção aparece no seu cartão, com copiar, Word e compartilhar.
- Um app antigo ainda em cache que pedir o ajuste recebe só o aviso para atualizar, sem gastar uma chamada da IA.

## 6.12.74

### Geração em duas levas

- **Adoração em Família por quadros: os quadros saem em duas levas.**
  - **1ª leva:** Abertura, Vídeo, Princípio e Personagem.
  - **2ª leva:** Jesus, Criador, Saiba responder, Ame o ministério, Jogo e Cânticos.
  - A 2ª leva só começa quando a 1ª termina. Assim, cada quadro da 2ª leva recebe em "já usados" os textos, personagens e vídeos da 1ª. Exemplo: o quadro de Jesus não repete o texto da Abertura.
  - Continuam no máximo 4 pedidos ao mesmo tempo.
- **Instruções da IA:**
  - **Personagem do dia:** a lição do ângulo tem de estar dita ou mostrada na própria passagem transcrita.
  - **Jogo bíblico:** nenhuma pergunta que uma criança responderia (por exemplo, os três da fornalha ou as sete congregações).
  - As duas regras aparecem na tela de prompts (texto editável e formato só leitura).

### Fase 4: programação por quadros e troca de quadro

- **Programação versão 2:**
  - A programação salva marca "versao: 2".
  - Cada parte diz de que quadro é.
  - A programação guarda também o ângulo de cada quadro e o que cada um usou.
  - As programações antigas abrem como antes, só sem o botão de troca.
- **🔄 Trocar este quadro:**
  - O botão fica em cada quadro feito pela IA. As orações e os cânticos inicial e final não têm o botão.
  - Abre um campo opcional de instrução para a IA (até 300 caracteres) e o botão "🔄 Trocar agora".
  - O quadro novo vem com o mesmo ângulo e não repete o que os outros quadros usaram, nem o que o quadro trocado usava.
  - A troca atualiza a programação salva e a memória do que já foi usado.
  - Uma programação já compartilhada não pode ser trocada, e o app avisa: quem já entrou ficaria com o quadro antigo. Para trocar, apague o compartilhamento e crie outro depois.
- **Adoração compartilhada:**
  - A sessão aceita o quadro de cada parte e o rótulo do trecho da leitura.
  - No jogo "Ordem e data", a ordem certa com as datas fica só com quem dirige ("🔑 Ordem certa (só quem dirige vê)", dentro das regras). Antes, as datas iam no texto público das regras.
  - As sessões das programações antigas continuam iguais.

## 6.12.73

- **Adoração em Família por quadros: correções antes da fase 4.**
  - **Abertura:** a memória do que já foi usado agora guarda também a leitura (o trecho de livro ou o artigo) e o relato bíblico. Na noite seguinte, o trecho lido sai da lista, e a IA recebe os relatos das últimas semanas para escolher outros. Se ainda repetir um relato, o servidor refaz o quadro uma vez.
  - **Personagem do dia:**
    - A passagem vai até o fim do episódio. O servidor transcreve o intervalo inteiro, até 30 versículos; antes, cortava em 10.
    - Do verbete do Perspicaz entra só o sentido que cita a passagem, porque vários personagens têm o mesmo nome. Se nenhum sentido a citar, o verbete sai e vale o trecho do livro.
    - Nas instruções, o personagem tem de ilustrar claramente o ângulo do plano. Um personagem pouco conhecido só entra quando a ligação for clara.
  - **Saiba responder:** o texto transcrito e o link de consulta no wol.jw.org saem sem as marcas "##" e "•". A frase da busca fica dentro de um só item (não junta o título com o item) e para no fim da primeira frase.
  - **Vídeo:** com 2 vídeos, a soma das durações vai no máximo até os minutos do quadro mais 2. Se passar, fica só o primeiro.
  - **Jogo bíblico:** se faltar o mínimo, o servidor pede de novo uma vez. O mínimo é de 8 rodadas, ou 6 acontecimentos na Ordem e data. Na Ordem e data, o servidor completa até 6 com o Apêndice B. As instruções reforçam o nível de adulto batizado, sem respostas óbvias.
  - **Fortaleça sua fé no Criador:** o texto transcrito sai sem as marcas de figura, como "(5)", sem o quadradinho "◼" e sem os créditos das fotos.
  - **Ame o ministério:** as perguntas são só sobre como proceder na situação do ministério, nunca sobre sentimentos.
- **Instruções da IA visíveis:** os textos novos da Abertura, do Personagem, do Vídeo, do Jogo e do Ame o ministério aparecem na tela de prompts do administrador. Os formatos, só leitura, também foram atualizados.

## 6.12.72

- **Adoração em Família por quadros: fase 3b (os demais quadros com instruções próprias).** Agora todos os quadros têm instruções próprias; a instrução genérica saiu.
  - **Vídeo:** a IA escolhe 1 ou 2 vídeos da lista do catálogo do jw.org (já sem os usados nas últimas semanas e nesta noite) e escreve a descrição e até 3 perguntas. O título e o link são postos pelo servidor.
  - **Fortaleça sua fé no Criador:** não segue o assunto da noite. A IA escolhe um artigo de ciência do catálogo dos Ensinos Bíblicos (lido no wol.jw.org pelo docId) ou um trecho das brochuras A Vida — Teve um Criador? e A Origem da Vida. O servidor transcreve o texto.
  - **Saiba responder:** uma pergunta que as pessoas fazem, a base num trecho dos livros do quadro (ou num verbete do Perspicaz) e 1 ou 2 textos bíblicos, com o link de consulta no wol.jw.org.
  - **Ame o ministério:** uma situação real do ministério, que muda a cada semana, com uma ideia prática e 1 ou 2 perguntas, e o trecho das brochuras do ministério.
  - **Jogo bíblico:** só os 6 tipos aceitos, em nível de adulto batizado. O servidor sorteia o tipo da noite, de preferência um que não foi usado nas últimas semanas. Na Ordem e data dos acontecimentos, a IA só escolhe acontecimentos do Apêndice B da Bíblia de Estudo; o servidor embaralha e põe as datas, e a ordem certa fica guardada no jogo. As datas que não são do Apêndice B saem dos outros jogos.
  - **Treino de cânticos:** 1 cântico ligado à noite, sem repetir os da programação nem os das últimas semanas.
- **Princípio bíblico:** usa só uma entrada do índice, com o texto literal transcrito.
- **Textos lidos** (trechos de livros e artigos) são cortados no fim de uma frase, não no meio.
- **Memória do que já foi usado:** guardada no aparelho (IndexedDB), com até 40 itens por categoria: assuntos, personagens, princípios, episódios de Jesus, perguntas do Saiba responder, situações do ministério, exemplos do Criador, artigos, cânticos, jogos e vídeos. Vai junto com o plano e com cada quadro, para não repetir nas semanas seguintes. Ela fica como um item interno das Pesquisas salvas: não aparece na lista, entra no backup e continua lá mesmo quando se apagam as pesquisas.
- **Conferência de repetição:**
  - O servidor refaz o quadro uma vez, citando a repetição, quando ele repete um texto bíblico, um personagem, um vídeo ou um cântico de outro quadro da noite. Também refaz se um personagem, vídeo ou cântico já foi usado nas últimas semanas.
  - Depois que todos ficam prontos, o app confere os quadros entre si. Os que ainda repetem são refeitos uma vez. Se mesmo assim repetir, o quadro fica com um aviso "⚠️" no andamento.
- **Instruções da IA visíveis:** os novos textos aparecem e podem ser editados na tela de prompts do administrador: "Vídeo", "Fortaleça sua fé no Criador", "Saiba responder", "Ame o ministério", "Jogo bíblico" e "Treino de cânticos". Os formatos são só leitura.

## 6.12.71

- **Adoração em Família por quadros: fase 3a (preparação em duas fases).** Primeiro vem o **plano da noite**, numa chamada curta: título, objetivo, assunto, o ângulo de cada quadro e os cânticos inicial e final. Depois, **cada quadro marcado é preparado numa chamada própria**, até 4 ao mesmo tempo. O app junta tudo nesta ordem: cântico inicial, oração inicial, os quadros na ordem do catálogo, cântico final e oração final. A programação é salva uma vez só.
- **Andamento da preparação:** uma lista mostra o estado de cada quadro: ⏳ preparando, ✓ pronto, ⚠️ não ficou pronto, • na fila. O quadro que falhar fica de fora da programação e ganha o botão "🔄 Refazer este quadro", na largura toda. Quando ele fica pronto, a programação salva é **atualizada** (o mesmo item, não um novo).
- **Quadros com instruções próprias:**
  - **Abertura:** uma leitura (trecho de um livro do servidor ou artigo dos Ensinos Bíblicos lido no wol pelo docId) com até 3 perguntas, mais um relato bíblico com até 2 perguntas.
  - **Princípio bíblico:** a IA escolhe uma entrada do índice "Princípios Bíblicos para a Vida Cristã". O servidor transcreve o texto literal da entrada e os versículos, e as perguntas são as fixas do quadro. Saem as entradas sem versículos nem relatos e as que começam com "Veja".
  - **Personagem do dia:** a passagem da história (transcrita da Bíblia do servidor) e o verbete do Perspicaz; sem verbete, entra o trecho de livro escolhido.
  - **Lições da vida de Jesus:** o episódio (transcrito da Bíblia do servidor), a qualidade de Jesus e o trecho de livro escolhido.
  - Os outros quadros usam, por enquanto, uma instrução genérica (as próprias chegam na fase 3b).
- **Instruções da IA visíveis:** os novos textos aparecem e podem ser editados na tela de prompts do administrador: "Adoração · base dos quadros", "plano", "abertura", "princípio", "personagem", "Jesus" e "genérico". Os formatos são só leitura.
- **Leitura de artigos pelo docId do wol:** só vale com pelo menos 600 caracteres. As páginas que existem só no www.jw.org (vídeos, atividades com figuras, cartões bíblicos) ficam de fora. Num teste real, 21 de 30 artigos comuns foram lidos, com média de 5909 caracteres, e 17 de 20 de ciência, com média de 2483.
- A programação aceita até 16 partes. A leitura de cada parte mostra o rótulo vindo do servidor (por exemplo, "Trecho do livro"). Os quadros têm uma contagem própria no limite de pedidos por hora (4 vezes a da programação).
- Apps antigos continuam usando a geração numa só chamada.

## 6.12.70

- **Adoração em Família por quadros — fase 2 (tela e formato):** a programação agora é montada por **quadros**. Em "🧩 Quadros da programação" aparecem os 12 quadros do catálogo (Oração inicial, Abertura, Vídeo, Princípio bíblico, Personagem do dia, Lições da vida de Jesus e Oração final entram sempre, com 🔒; Fortaleça sua fé no Criador, Saiba responder, Ame o ministério, Jogo bíblico e Treino de cânticos são opcionais), com os minutos de cada um e o total ("⏱️ Total: N min + orações · K quadros"). A duração é a soma dos quadros marcados (35 min na 🌙 Noite curta, 65 min na 🌟 Completa). Cântico inicial e cântico final ficam em marcas próprias.
- **Uma programação por vez:** o botão virou "✨ Preparar a programação" e a IA devolve uma só programação (saem a quantidade de opções, a duração escolhida à parte e a lista de atividades). Programações antigas salvas com 2 opções continuam abrindo (aparecem como "Opção 1" e "Opção 2", e a mescla delas continua funcionando).
- **Jogos:** ficam só 6 tipos (Quem sou eu?, Verdadeiro ou falso, Ordem e data dos acontecimentos, Quem disse isso?, Complete o versículo e Abreviações bíblicas), todos para jogar no próprio app, no nível de um adulto batizado. Saíram mímica, charadas, torta na cara, jogos de papel e lápis e o FunPlayB (o convite do FunPlayB na tela Formatar continua).
- **Catálogo dos quadros** em `api/_familiaQuadros.mjs` (quadros, jogos e a conversão dos perfis antigos), com uma cópia no app que o teste confere ser igual à do servidor.
- **Perfis antigos convertidos:** "Jogos bíblicos" vira o quadro Jogo bíblico, "Treino dos cânticos" vira Treino de cânticos, a marca antiga dos cânticos no início e no fim marca os dois cânticos e "Ordem dos acontecimentos" vira "Ordem e data dos acontecimentos".
- **Correção das prioridades:** "Mãe ou pai sozinho" e "Quem mora sozinho" nunca têm casal, mesmo com Pai e Mãe criados pelo app; "Casal com filhos" e "Casal sem filhos" sempre têm; "Família com avós ou outros" continua decidida pelos membros (nova `familiaTemCasal`).
- O prompt "Adoração em Família" e o seu formato (tela de prompts) foram reescritos para os quadros. Prompts já editados e guardados continuam com o texto antigo até restaurar os padrões (hoje não há nenhum guardado). Até a fase 3, a programação ainda é gerada numa só chamada à IA.

## 6.12.69

- **Prioridades de aplicação prática numa fonte só, agora com 10:** os hábitos que as aplicações e as perguntas de reflexão procuram reforçar passaram a vir de uma única lista, `PRIORIDADES_APLICACAO` (`api/_prompts.mjs`), usada no prompt dos comentários adicionais do texto diário ("APLICAÇÕES PRIORITÁRIAS") e nos pedidos "Resumo da leitura: aplicações práticas" e "Resumo da leitura: base". Entrou a **10ª prioridade: tratar com amor e respeito os irmãos na congregação e ser perdoador**, com o exemplo "relacionamento com os irmãos, perdão, ofensas ou união na congregação: item 10"; os textos dizem "10 hábitos" (eram 9). O resto do comportamento ficou igual (mesmas palavras dos itens 1 a 9, mesmas regras de escolha e de fidelidade ao texto).
- **Adoração em Família por quadros — fase 1:** nova função `prioridadesAplicaveis(perfil)`, ainda sem uso (entra na geração por quadros): sem casal na formação ou nos membros, tira as prioridades do cônjuge (7 e 8); com convidados, pede perguntas gerais, sem expor ninguém.
- Prompts já editados e guardados na tela de prompts continuam com o texto antigo (9 hábitos) até restaurar os padrões; hoje não há nenhum guardado (`config/armazem/prompts_ia.json` está vazio).
- Novo teste `ferramentas/testar-adoracao-quadros.mjs` (lista, formatos, os três usos montados e `prioridadesAplicaveis`), também no `npm run check`.

## 6.12.68

- **Adoração em Família por quadros — fase 0 (só dados no servidor, nada muda na tela):**
  - **Princípios Bíblicos para a Vida Cristã (scl) reconvertido** a partir da edição de setembro de 2025 (© 2023; impressão scl-T 250918), lendo as fontes do PDF (negrito, itálico e tamanhos) para separar verbete, entrada, versículos e relatos. A edição aparece no cabeçalho de `fontes/principios_biblicos.txt` e em `config/armazem/fontes-edicoes.json`.
  - **Novo `fontes/principios.json`:** os 103 verbetes e as 764 entradas em formato estruturado (id `<verbete>.<n>`, verbete, subverbete, pergunta, versículos, "veja também" e relatos), mais as 7 categorias, com 99,9% das referências bíblicas achadas na Bíblia do servidor (as 3 que faltam são trechos que atravessam capítulos, como "He 11:1–12:3").
  - **Novo `fontes/ensinos_biblicos.json`:** catálogo da seção Ensinos Bíblicos do jw.org e dos artigos que as páginas dela listam (1518 itens: título, endereço, caminho, trecho de até ~500 caracteres e docId; nunca o texto completo). As páginas das seções de ciência (evolução ou criação, teve um projeto, exatidão científica da Bíblia e origem da vida) ficam marcadas com `ciencia`. Lido uma vez, no computador, com 1 s entre os pedidos; o servidor não acessa o jw.org.
  - **`api/_fontes.mjs`:** registra os dois arquivos novos (`principiosIndice` e `ensinosBiblicos`), ganha os leitores `lerPrincipios()` e `lerEnsinosBiblicos()` (com cache, ainda sem uso) e o inventário das fontes passa a resumir os arquivos .json (entradas, verbetes, páginas). Corrigida a sigla do livro de princípios no inventário: "(lvs)" → "(scl)".
  - **Novo teste `ferramentas/testar-fontes-adoracao.mjs`** (formato dos dois arquivos, ids únicos, referências achadas, regra de ciência, busca no txt novo) e verificação de sintaxe dele no `npm run check`.

## 6.12.67

- **Resumo da leitura da Bíblia: aplicações práticas bem mais ricas:** a seção APLICAÇÕES PRÁTICAS do resumo do capítulo (leitura diária) deixou de ser "uma aplicação curta por parágrafo" e agora pede de 6 a 9 aplicações (mais, se o capítulo sustentar), de 2 a 4 frases cada, ligadas ao versículo e à vida real (família, casamento, ministério, trabalho ou escola, amizades, decisões, sentimentos), cada uma terminando com uma **pergunta de reflexão** carinhosa. Recebeu também as mesmas **aplicações prioritárias** do texto diário: sempre que o capítulo permitir (sem forçar), reforçar estes 9 hábitos: dirigir pelo menos 1 estudo bíblico, sempre fazer revisitas, orações significativas, orar todos os dias, ler a Bíblia todos os dias, manter-se ativo no ministério, tratar o cônjuge com amor e respeito, comunicar-se com o cônjuge e ter equilíbrio nas atividades que consomem tempo (redes sociais, séries, aplicativos de vídeo). Hábitos diferentes entre as aplicações, perguntas diferentes, fidelidade ao capítulo em primeiro lugar. Mexe nos pedidos "Resumo da leitura: aplicações práticas" e "Resumo da leitura: base" (telas de prompts).

## 6.12.66

- **Texto diário: aplicações prioritárias:** o prompt dos comentários adicionais ganhou o bloco "APLICAÇÕES PRIORITÁRIAS": sempre que o assunto do texto permitir (sem forçar), a IA dá preferência a aplicações práticas por meio de perguntas de reflexão sobre estes hábitos: 1) dirigir pelo menos 1 estudo bíblico; 2) sempre fazer revisitas; 3) fazer orações significativas a Jeová; 4) orar todos os dias de forma significativa; 5) ler a Bíblia todos os dias; 6) manter-se ativo no ministério; 7) tratar o cônjuge com amor e respeito; 8) comunicar-se bem com o cônjuge; 9) equilíbrio nas atividades que consomem tempo (redes sociais, séries, aplicativos de vídeo). Cada comentário usa o hábito que mais combina com o texto do dia, hábitos diferentes entre os comentários e nunca o mesmo em dois seguidos; se o texto não tiver ligação natural com nenhum, a aplicação segue o texto (conduta, amizades, sentimentos, decisões). Sem culpar ninguém, no tom carinhoso das perguntas de reflexão.

## 6.12.65

- **Texto diário: a reflexão final é sempre uma pergunta:** no prompt dos comentários adicionais, a frase final de cada comentário deixou de alternar entre pergunta e admoestação: agora é SEMPRE uma pergunta de reflexão (terminada em "?"), em todos os comentários, ligada ao assunto, diferente a cada comentário e com tom carinhoso (sem bronca nem acusação). Exemplos no prompt: "Você está se esforçando para dirigir pelo menos um estudo bíblico?", "Marido, você sempre procura tratar a sua esposa com bondade e respeito?".

## 6.12.64

- **Comentários adicionais do texto diário terminam com uma reflexão:** o prompt "Comentários adicionais sobre o texto diário" agora manda a IA encerrar TODA "aplicacao" com uma frase que leve a pessoa a refletir se está aplicando o ponto ou a lição, alternando entre dois tipos (com 4 comentários, 2 de cada, intercalados): uma **pergunta** de reflexão ("Você está se esforçando para dirigir pelo menos um estudo bíblico?", "Marido, você sempre procura tratar a sua esposa com bondade e respeito?") e uma **admoestação prática** ("Marido, jamais deixe de tratar a sua esposa com bondade e respeito."). A frase é ligada ao assunto do comentário, com carinho (sem bronca nem acusação), e é uma só, curta. O servidor passou a aceitar até 750 caracteres na aplicação (eram 500), para a reflexão não ser cortada. Vale para "Gerar comentários" e "Gerar outros", e a voz lê a reflexão junto.

## 6.12.63

- **Adoração em Família: card "🧩 Estrutura e atividades":** um card só (substitui os cards de Circunstâncias e de Atividades da 6.12.61), com três blocos: **🧱 Estrutura da programação** (novo), **💛 Circunstâncias** e **🎨 Atividades que a família aceita**. Na estrutura o chefe marca quais atividades ficam entre a Oração inicial e a Oração final, sempre nesta ordem: 📰 trecho de uma matéria, 📖 trecho da Bíblia ou versículos (com perguntas), 🎬 um ou dois vídeos e 🎲 um jogo bíblico (pelo menos uma fica marcada). O servidor manda à IA a linha "ESTRUTURA DA PROGRAMAÇÃO ESCOLHIDA" (de 1 a 4 atividades, nenhuma a mais), sem pesquisar matéria quando ela não está na estrutura; a conferência da 6.12.62 passou a usar o número escolhido. Os "Jogos aceitos" ficaram sob a estrutura (valem quando "Um jogo bíblico" está marcado).
- **Atividades que a família aceita:** saíram Cozinhar juntos e Caminhada ou atividade ao ar livre; e as que viraram a estrutura (Leitura de passagens bíblicas, Leitura de um trecho de uma matéria, Leitura de um trecho da Bíblia e um vídeo, Jogos bíblicos e Vídeo do jw.org) deixaram de se repetir ali. Quem tinha o nome antigo "trecho da Bíblia e um vídeo" fica com leitura da Bíblia e vídeo marcados na estrutura.
- **Jogos aceitos:** saíram Jogo da memória, Caça ao tesouro, Desenho e adivinhação (Pictionary), Palavras cruzadas ou caça-palavras e Forca; também do pedido à IA (o servidor ignora esses nomes em perfis salvos). Restam 10 tipos.

## 6.12.62

- **Adoração em Família: sem atividade extra de "troca de ideias":** a estrutura fixa (Oração inicial + 4 atividades + Oração final) só era pedida à IA, e o prompt ainda dizia que "a conversa sempre pode entrar", o que levava a uma parte à parte de "Troca de ideias". Agora (1) o prompt diz que a conversa fica DENTRO de cada atividade, nas perguntas, e proíbe partes de troca de ideias, reflexão, aplicação, resumo, revisão ou encerramento; e (2) o servidor confere: se vierem mais de 4 atividades, a parte solta (só conversa, sem textos, vídeo, jogo, leitura nem publicação) sai e os minutos e as perguntas dela vão para a atividade vizinha. Parte com conteúdo nunca é apagada. Vale para as programações geradas daqui em diante.

## 6.12.61

- **Adoração em Família: Circunstâncias e Atividades em cards próprios:** saíram de dentro de "Família e definições gerais" (que agora tem só os dados da família, o dia e horário e os membros). Cada um virou um card recolhido, na ordem: 👤 Família e definições gerais, 💛 Circunstâncias, 🎨 Atividades que a família aceita (com os Jogos aceitos dentro) e 🤝 Informar convidados. Cada card mostra, embaixo do título, quantas opções estão marcadas, abre numa vista exclusiva com ◀ Voltar (como os outros) e tem o botão ✔ Concluir e voltar. As escolhas continuam guardadas no aparelho como antes.

## 6.12.60

- **Arquivos do servidor: exportar a lista para Word:** na tabela "📚 Arquivos do servidor e edições" (Ajustes → Prompts de IA → DIVERSOS), novo botão **📄 Exportar Word** ao lado de "🔄 Atualizar a lista" (os dois na mesma linha, ocupando a largura toda, também no celular). Gera uma tabela do Word (A4) com Publicação (e o arquivo embaixo), Edição, No conteúdo, Tamanho e Enviado em, do jeito que a lista está na tela, já com as edições que você acabou de anotar. Em celular que aceita compartilhar arquivos vai para o compartilhamento; senão baixa o arquivo.

## 6.12.59

- **3 brochuras novas como fonte de consulta:** Você Pode Ter uma Família Feliz! (hf), A Vida — Teve um Criador? (lc) e A Origem da Vida — Cinco Perguntas Que Merecem Resposta (lf). Convertidas dos EPUBs, subidas em `fontes/` com a edição anotada, e incluídas em `ARQUIVOS`, `LIVROS` e `NOMES_DAS_FONTES` de `api/_fontes.mjs` (busca de "Livros de apoio" e Adoração em Família).

## 6.12.58

- **11 livros novos como fonte de consulta:** Achegue-se a Jeová (cl), O Segredo de uma Família Feliz (fy), Imite a Sua Fé (ia), Jesus — o Caminho, a Verdade e a Vida (jy), Aprenda com as Histórias da Bíblia (lfb), Mantenha-se no Amor de Deus (lv), ‘Dê Testemunho Cabal’ (bt, letras grandes), ‘Venha Ser Meu Seguidor’ (cf, tipo grande), Ande Corajosamente com Deus (wcg, letras grandes) e Os Jovens Perguntam, volumes 1 e 2 (yp1, yp2). Entram em `ARQUIVOS`, `LIVROS` e `NOMES_DAS_FONTES` de `api/_fontes.mjs` (nome bonito na tabela do admin) e na busca de "Livros de apoio" de todas as pesquisas. Os arquivos foram reconvertidos dos originais (acentos soltos dos PDFs, palavras partidas e emendadas, "No é"/"Jos é" dos EPUBs) e subidos em `fontes/`.
- **Adoração em Família consulta os livros:** a geração das opções agora busca trechos nos livros do servidor pelo assunto (ou, sem assunto, pelas circunstâncias e a formação da família) e os manda à IA como base de apoio, no novo pedido editável "Livros de apoio (Adoração em Família)" (a IA pode indicar o livro e o capítulo ou a lição em "publicacoes", sem inventar página nem parágrafo). O pedido "Livros de apoio" das demais telas ficou com o texto geral (não cita mais só três livros).
- Memória do índice dos livros, medida no computador: de cerca de 156 MB para 286 MB de heap (o servidor tem 1 GiB).

## 6.12.57

- **Lista numerada com números em ícones:** nas anotações (e na resposta da pergunta de recapitulação), o botão de lista numerada agora numera as linhas selecionadas com 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ … em vez de "1.", "2.". Aplicar de novo (ou trocar para a lista com marcadores) não empilha prefixos. O rótulo do botão passou a 1️⃣ Lista.

## 6.12.56

- **Chave do Formatar com IA mais baixa:** nos botões ✨ Formatar com IA das anotações e da resposta, o ícone 🔑 desceu um pouco, para ficar alinhado com os outros ícones da linha.

## 6.12.55

- **Anotações: quatro botões numa linha só:** Copiar, ✨ Resumir (rótulo encurtado; o botão que resume o texto do campo), ✨ Formatar com IA e a lixeira ficam todos na mesma linha, preenchendo a largura toda; o Resumir é azul como os outros botões de IA.

## 6.12.54

- **Anotações: ✨ Resumir o texto do campo:** novo botão, em linha própria na largura toda, logo abaixo de Copiar / Formatar com IA. Depois que a gravação foi transcrita (ou com qualquer texto no campo), ele pede à IA o resumo do que está no campo e o coloca no fim das anotações, sob o título "Resumo do texto"; o texto de antes não muda. Usa a mesma fila e o mesmo código de texto do resumo das gravações; se o resumo falhar, nada é copiado de volta para o campo.

## 6.12.53

- **Anotações da reunião: Word começa pela prévia:** o botão 📄 Word da tela de anotações agora abre primeiro a prévia do documento (a mesma dos outros textos, com A− e A+), e de lá se exporta ou se compartilha o .docx. Antes, o arquivo era gerado direto.

## 6.12.52

- **Toda matéria citada tem link:** nas Publicações de cada atividade, a matéria sempre vira um link: o do próprio artigo no wol.jw.org ou, quando a programação só guardou o nome (como "Imite a Sua Fé, capítulo 12"), um link que abre a pesquisa dela no wol. Nas programações novas, o servidor procura o endereço da publicação já ao gerar.
- **📖 Exibir a matéria na tela (adoração ao vivo):** cada publicação citada ganha um campo recolhido que, ao abrir, mostra o texto da matéria lido pelo servidor (até 6.000 caracteres), para quem não puder abrir o link. Vale também para as programações já criadas, desde que a parte esteja liberada (o dirigente vê sempre). Nova ação `materia` em `api/familia-sessao.mjs`, que só lê o que a programação cita.

## 6.12.51

- **Matéria sempre específica:** a atividade de leitura de um trecho de matéria agora mostra o tema da matéria, a referência dos parágrafos (e a publicação), um link específico para esse trecho no wol.jw.org e o conteúdo num campo "📖 Trecho para considerar" sempre recolhido, que se abre ao tocar (como a transcrição do vídeo).
- **Livros e lições:** a IA pode indicar a publicação pelo nome ("Seja Feliz para Sempre!, lição 22"); o servidor pesquisa no wol, lê os parágrafos indicados (ou o começo da matéria, quando ela não tem parágrafos numerados) e monta o link. O prompt proíbe descrições vagas como "considerar juntos pontos do livro…". Vale para programações geradas daqui em diante; a que você já tem continua como estava (gere de novo). Quem editou o prompt precisa acrescentar a regra.

## 6.12.50

- **Novas circunstâncias:** "Manutenção do relacionamento da família" e "Dificuldades com relacionamentos (família, amigos, trabalho, irmãos)" na lista de Circunstâncias da família; o prompt as trata como assuntos delicados (com tato e de forma positiva). Quem editou o prompt precisa acrescentá-las lá.

## 6.12.49

- **Estrutura fixa da programação (prompt da Adoração em Família):** toda opção sai com 6 partes: Oração inicial, **quatro atividades sempre** (leitura de um trecho de uma matéria da pesquisa; leitura de um trecho da Bíblia ou versículos; um ou dois vídeos sobre o assunto; um jogo bíblico) e Oração final. Outras atividades aceitas pela família entram dentro dessas quatro. O prompt segue respeitando a tela: se a família desmarcou vídeos ou jogos, ou não há matérias para o assunto, a IA faz a atividade sem inventar a matéria, o vídeo ou o jogo, mantendo as quatro. Quem editou o prompt precisa acrescentar a regra.

## 6.12.48

- **Leitura de um trecho de uma matéria, com o texto pronto:** quando a IA escolhe essa atividade, ela indica a matéria da lista (P1, P2…) e os números dos parágrafos (de 2 a 6) no novo campo "leitura"; o servidor lê esses parágrafos no wol.jw.org e a atividade mostra "📰 Leitura (par. 3-6): título", o texto dos parágrafos e o link da matéria. Vale na tela da programação e na adoração ao vivo (o texto vai junto no compartilhamento). Sem matéria da lista ou sem parágrafos numerados, a atividade segue sem a leitura. O prompt orienta a IA a não inventar o texto; quem editou o prompt precisa acrescentar a regra.

## 6.12.47

- **Jogos removidos da lista:** Show do milhão bíblico, Bingo bíblico e FunPlayB "jogar um tema de perguntas". Fica só o FunPlayB "tema personalizado". Também saíram do prompt da Adoração em Família.
- **Lista de atividades melhorada:** novas atividades "Leitura de passagens bíblicas", "Leitura de um trecho (alguns parágrafos) de uma matéria (site, A Sentinela, livros, Perspicaz e outras publicações)" e "Leitura de um trecho da Bíblia e um vídeo" (esta também liga o vídeo do jw.org); o prompt explica como montar cada uma.
- **"Jogos ou adivinhas" virou "Jogos bíblicos".** Quem tinha o nome antigo salvo passa para o novo e ganha as três atividades de leitura marcadas.

## 6.12.46

- **Boas-vindas só ao entrar:** ao tocar em Iniciar a adoração (ou entrar), a tela de boas-vindas abre sempre, mesmo com a adoração já em andamento. Depois de tocar em Entrar, ela não aparece mais na página das atividades (antes ficava no topo até a primeira atividade começar). Na tela grande continua aparecendo antes de a primeira atividade começar. Quem espera nas boas-vindas segue sozinho para as atividades quando o dirigente começa.

## 6.12.45

- **Questão em andamento em azul claro:** no jogo, a questão que está sendo considerada (já com dica dada e ainda sem resposta) fica com fundo azul claro; ao ser respondida, volta ao fundo branco.

## 6.12.44

- **Textos sempre com perguntas (garantido):** além da regra no prompt, o servidor agora garante que toda atividade com textos bíblicos saia com uma ou duas perguntas sobre eles (no máximo duas): se a IA esquecer, entram "O que {texto} nos ensina?" e "Como podemos aplicar isso na nossa vida esta semana?". Na adoração ao vivo, programações já feitas (como a atividade "Jeová cuida de nós nas dificuldades") também ganham essas duas perguntas na tela; nelas a leitura com a voz do Google das perguntas simples cai na voz do aparelho, porque elas não vieram da programação.

## 6.12.43

- **Atividades brancas:** o fundo dos cards das atividades voltou a ser branco; só o topo (o card recolhido, com número, nome e tempo) tem um azul bem mais claro, igual com a atividade aberta ou fechada.

## 6.12.42

- **Controles do dirigente com espaço entre os campos:** a lista de quem entrou, os botões, o código do dirigente e o card "Só para o dirigente" estavam colados; agora há 8 px entre eles.

## 6.12.41

- **Controles do dirigente recolhíveis:** o card "👑 Controles do dirigente" agora recolhe e abre pelo título, e começa recolhido.
- **Código do dirigente recolhível:** ao tocar em "Passar a direção", o código (com Copiar e a explicação) aparece num card "🔑 Código do dirigente (só você vê)" que abre sozinho e pode ser recolhido pelo título.

## 6.12.40

- **Textos sempre com perguntas:** o prompt da Adoração em Família agora manda a IA incluir, em toda atividade que tenha textos bíblicos, uma ou duas perguntas sobre esses textos, para fazer antes de passar à próxima atividade. Vale para as programações geradas daqui para a frente; se você editou esse prompt em Prompts da IA, acrescente a regra lá.

## 6.12.39

- **Tela grande:** a linha "Boas-vindas à Adoração em Família" ficou em letra bem maior.

## 6.12.38

- **Ao entrar, só as boas-vindas:** ao entrar ou iniciar a adoração (celular), abre apenas o card de boas-vindas com o programa, e um botão **▶️ Entrar** embaixo leva à página das atividades (cabeçalho, controles do dirigente e atividades). Se alguma atividade já começou, abre direto nas atividades; quando o dirigente libera a primeira, quem estava nas boas-vindas segue para as atividades. Na tela grande o botão não aparece (o dirigente avança pelo Próxima).

## 6.12.37

- **Retornar volta às boas-vindas:** na tela grande, o botão ⏮️ Retornar agora também funciona na primeira atividade e leva de volta à tela de boas-vindas (nenhuma parte fica liberada). Nova ação `voltar-inicio` em `api/familia-sessao.mjs` (exige a chave do dirigente).

## 6.12.36

- **Família: sem "Anos de casados" para mãe ou pai sozinho:** com "Mãe ou pai sozinho" escolhido, o campo (e o valor guardado) some.
- **Tela de boas-vindas à adoração (celular e tela grande):** card elaborado com emojis, o tema da adoração, "Quem participa" (quando os nomes foram informados) e o programa com o tempo na frente de cada atividade (e a duração total). Aparece enquanto nenhuma atividade começou; no celular fica no topo, na tela grande ocupa a tela toda.
- **Tela grande segue pelas orações:** ao avançar (Próxima/Começar), a primeira atividade é a Oração inicial, e as atividades seguem até a Oração final (as orações não são mais puladas). Nelas a tela grande mostra o card da oração grande, no centro.

## 6.12.35

- **Uma só cor de fundo nas atividades:** saíram as cores diferentes (azul, roxo, laranja, vermelho…) de cada atividade; todas, liberadas ou bloqueadas, ficam com o mesmo azul claro.

## 6.12.34

- **Regras centralizado e 🔄 mais alto:** o nome do card "📜 Regras" ficou centralizado, e o ícone de reiniciar a questão subiu 4 px.

## 6.12.33

- **Sem o card geral do jogo:** saiu o card com a linha lateral laranja em volta de tudo (regras, placar, sorteio e questões); os cards de dentro continuam.
- **Sorteio da questão a ser respondida:** no card "Sorteio de jogadores", novo botão 🎯 "Sortear a questão a ser respondida": sorteia entre as questões ainda não respondidas. A questão sorteada aparece no card ("🎯 Questão sorteada: Questão 3 de 7", com 🗑️ para limpar), no título do card recolhido (junto com o "Vez de" quando há) e fica destacada com borda roxa mais grossa, para todos. Novas ações `sortear-questao` e `limpar-sorteio` com `tipo: "questao"` em `api/familia-sessao.mjs`.

## 6.12.32

- **Regras recolhidas por padrão:** o card "📜 Regras" do jogo agora é recolhível e começa recolhido; basta tocar no título para ler.

## 6.12.31

- **Todas as questões do jogo visíveis:** as questões deixam de aparecer uma de cada vez; todas ficam na tela (cada uma ainda com uma dica por vez, e quem não dirige vê "Aguardando a primeira dica" nas ainda não iniciadas).
- **🔄 só depois de respondida:** o botão de reiniciar a questão só aparece quando a questão já foi respondida (resposta revelada ou pontuada).

## 6.12.30

- **Ícone de reiniciar menor:** o 🔄 da questão ficou menor e alinhado à linha "Questão N de M", sem passar para cima da dica.

## 6.12.29

- **Reiniciar a questão (só dirigente):** ícone 🔄 (setas opostas) no canto de cada questão do jogo. Pede confirmação e volta a questão ao começo: dicas zeradas, resposta escondida de novo e pontos dessa questão tirados do placar. Nova ação `reiniciar` em `api/familia-sessao.mjs` (exige a chave do dirigente).

## 6.12.28

- **Objetivo centralizado:** o texto explicativo da atividade ("🎯 Ler juntos os textos, assistir aos vídeos e comentar as lições") fica centralizado.

## 6.12.27

- **Cabeçalho do placar mais roxo:** a faixa "Participante / Pontos" ficou num roxo ainda mais forte que o fundo do placar (e a cor não é mais sobrescrita por outras regras).

## 6.12.26

- **Cabeçalho do placar:** a faixa "Participante / Pontos" ficou num roxo mais forte, com os cantos arredondados.
- **Objetivo da atividade:** menos espaço em branco antes e depois da frase 🎯 (topo do card e linha divisória logo abaixo).

## 6.12.25

- **Linhas finas entre as seções da atividade:** Textos, Vídeos, Cânticos, Publicações e Perguntas ficam em blocos separados por uma linha divisória fina.
- **Mais espaço no topo:** o espaço entre o título da atividade e a descrição/objetivo (🎯) aumentou.

## 6.12.24

- **Linha divisória em todas as atividades:** o topo de cada atividade (número, emoji, nome e tempo) ganhou, como no jogo, um fundo um pouco mais forte e uma linha dividindo o tema do restante do card (mais grossa e mais marcada com o card aberto). As orações, que são só um card fino, ficam como estavam.

## 6.12.23

- **Borda das orações:** a Oração inicial e a Oração final têm agora a mesma borda azul mais grossa das outras atividades.
- **Emoji antes do nome de cada atividade:** colado no nome (o número fica separado, à esquerda): 🎬 vídeo, 📚 textos bíblicos (📚🎬 quando tem os dois), 🎵 cânticos, 💬 demais atividades; no jogo, o 🎲 antes do nome do jogo (seguido dos emojis do tipo de jogo). Orações e boas-vindas já tinham o 🙏 e o 👋.

## 6.12.22

- **Sem os ícones 🔒/📖 nas atividades:** saíram do topo de cada atividade (o botão Liberar/Voltar a bloquear já mostra o estado). O topo ficou número, título e tempo.
- **Correção das orações:** o card simples da Oração inicial e da Oração final estava espremido numa coluna estreita (o número sumia e o texto quebrava letra por letra); agora mostra o número à esquerda e o título centralizado.

## 6.12.21

- **Número antes do ícone:** no topo de cada atividade a ordem agora é número, ícone (🔒 ou 📖), título e tempo. O número tem uma coluna fixa, então todos ficam alinhados uns com os outros. Nas orações (card simples) o número também fica à esquerda, antes do título.

## 6.12.20

- **Número da atividade à esquerda:** em todas as atividades (inclusive Oração inicial e Oração final e as de jogo), o número fica sempre alinhado à esquerda, numa coluna própria; o título continua centralizado ao lado.

## 6.12.19

- **Jogo sem a instrução repetida:** a linha "🎯 Jogar o jogo …" (e a descrição) saiu das atividades de jogo, porque as regras já dizem tudo.
- **Regras logo depois do título do jogo:** na atividade de jogo, a ordem agora é título → 📜 Regras → 🏆 Placar → andamento das perguntas.
- **Oração inicial e Oração final como cards simples:** as duas são atividades numeradas (a numeração conta todas), mas aparecem só como um card bem fino, com moldura, o número e o nome ("1. 🙏 Oração inicial", "4. 🙏 Oração final"). Não abrem, não têm botão de liberar nem tempo, e o dirigente passa por elas na ordem das atividades.

## 6.12.18

- **Um só nome para o jogo:** a linha do objetivo ("🎯 Jogar o jogo …") dizia o nome que a IA pôs no campo do jogo ("Parceiros Fiéis no Serviço a Deus"), diferente do nome do título da atividade ("Quem sou eu?"). Agora ela usa o mesmo nome do título: "Jogar o jogo Quem sou eu?". Fica assim: nome do jogo ("Quem sou eu?") e título ("Ministros zelosos da Bíblia"), sem um terceiro nome.

## 6.12.17

- **Títulos centralizados na adoração ao vivo:** o nome da adoração e a linha do código/dirigente, e o nome de cada atividade (inclusive nome e título do jogo), ficam centralizados.

## 6.12.16

- **Título do jogo separado do nome do jogo:** na atividade de jogo, o nome do jogo (ex.: "Quem sou eu?") vem em destaque em cima, com emojis que lembram o jogo (🧑❓ para "Quem sou eu?"; ✅❌, 💡❓, 🎭🤫, 🧠🃏, 🔤❓, ❓❓ ou 🎲🎯 conforme o jogo), e embaixo o título (ex.: "Ministros zelosos da Bíblia"). Isso aparece com o card recolhido. O topo tem fundo um pouco mais forte e uma linha divisória do resto (mais grossa com o card aberto).
- **Contagem das perguntas:** cada questão agora diz "Questão 1 de 10" e, logo abaixo do placar, uma barra de andamento mostra "❓ 3 de 10 respondidas · faltam 7" (ou "🏁 Todas as 10 perguntas foram respondidas"). Conta como respondida a pergunta que teve a resposta revelada.

## 6.12.15

- **Adorações recentes:** cada card agora tem o nome da adoração bem destacado (negrito, maior), embaixo o código (destaque menor) e, por último, o texto "você dirige (toque para reabrir)" pequeno.

## 6.12.14

- **Nomes de cada sorteio:** no card de sorteio, logo abaixo de cada botão, os nomes que entram naquele sorteio, pequenos e sem destaque, separados por vírgula (quem entrou, para "Sortear entre quem entrou"; os nomes informados, para "Sortear entre os nomes"). A lista se atualiza quando alguém entra.
- **Regra dos bichinhos:** também nunca cavalo nem burro. O 🐴 saiu da lista (não havia 🐎, 🦄 nem 🫏); regra registrada no código, no CLAUDE.md e na memória.

## 6.12.13

- **Card de sorteio mais fino:** o título passa a ser "🎲 Sorteio de jogadores (opcional)" enquanto ninguém foi sorteado (com sorteado, mostra "Vez de: nome"). O card ficou mais fino e o título agora está centralizado na vertical (recolhido, tinha uma folga vazia embaixo).

## 6.12.12

- **Regra dos bichinhos dos jogadores:** nunca macaco (de nenhum tipo) nem veado ou animais parecidos. O 🐒 saiu da lista do placar e do sorteio; a regra está registrada no código, no CLAUDE.md e na memória do projeto.

## 6.12.11

- **Sorteado com a cara do placar:** o nome sorteado ("Vez de: …", no título do card e dentro dele) aparece com o mesmo bichinho e a mesma cor, em negrito, que a pessoa tem no placar.

## 6.12.10

- **Card de sorteio:** espaço entre os campos (botões de sortear e a linha da vez), que estavam colados.
- **🗑️ Limpar o nome sorteado:** ao lado do "Vez de: nome", dentro do card, o dirigente tira o nome (para sorteio acidental). O card volta a mostrar só "🎲 Sorteio de jogadores" quando recolhido e o nome some para todos. Nova ação `limpar-sorteio` em `api/familia-sessao.mjs` (exige a chave do dirigente).

## 6.12.09

- **Sorteio todo dentro do card:** o "Vez de: nome" agora fica dentro do card de sorteio, na parte de baixo. Com o card recolhido, o título mostra só "🎲 Sorteio de jogadores"; depois de um sorteio, o título vira "🎲 Vez de: nome". Quem não dirige só vê o card quando há alguém sorteado (o sorteio é opcional).

## 6.12.08

- **Placar estilizado (todos os jogos):** o título ficou no centro, com o troféu 🏆 grande e estrelinhas ✨ ao lado, e o nome PLACAR embaixo. Cada participante da tabela ganha um bichinho (águia, cavalo, pássaro, coruja…) e o nome em negrito de uma cor própria. Os bichos e as cores saem do código da adoração mais o nome: são os mesmos em todos os aparelhos, não mudam a cada atualização e não se repetem enquanto houver bichos livres.

## 6.12.07

- **Adoração ao vivo abre tudo recolhido:** ao entrar ou reabrir a tela compartilhada, nenhuma atividade vem aberta (antes as já liberadas abriam sozinhas); o "Material para jogar" também começa fechado. Depois, quando o dirigente libera uma atividade com a tela aberta, ela continua abrindo para todos.
- **Sorteio opcional num card recolhível:** as opções de sorteio do jogo (entre quem entrou / entre os nomes) ficam no card "🎲 Sorteio de quem responde (opcional)", fechado ao abrir. O nome sorteado ("Vez de: …") continua aparecendo para todos.

## 6.12.06

- **Jogo: "Ninguém acertou":** o seletor de quem acertou ganhou a opção 🚫 Ninguém acertou (depois dos nomes). Ela revela a resposta, não dá ponto a ninguém e aparece como "Ninguém acertou" na questão.
- **Jogo: ver a resposta só para o dirigente:** novo botão (olho de linhas) "Ver só para mim" em cada questão. A resposta aparece só no aparelho de quem dirige (🔒 Só você vê), sem revelar aos participantes e sem gravar nada no estado; "Esconder" a oculta de novo. Nova ação `espiar` em `api/familia-sessao.mjs`, que exige a chave do dirigente.

## 6.12.05

- **Olho de linhas:** o botão "Revelar resposta" e o aviso "Resposta escondida" do jogo da adoração ao vivo usam o olho só de linhas (aberto e riscado), no lugar do emoji 👁️ e do 🙈. Regra para todo o app: onde houver ícone de olho, sempre o de linhas.

## 6.12.04

- **Jogo de dicas, pontuação:** as opções de pontuar (quem acertou + ✅ Pontuar) não somem mais quando a resposta é revelada. Ficam na questão até alguém ser pontuado (ou se a questão for pontuada de novo, o novo nome vale). Os pontos são os da última dica dada.

## 6.12.03

- **Textos da adoração ao vivo:** uma linha em branco entre um texto bíblico e o seguinte.

## 6.12.02

- **Regra: quem tem o código da adoração não tem restrição de leitura.** Os recursos de leitura da tela da adoração compartilhada não pedem código de leitura nem código de pesquisa e não gastam créditos de ninguém: o custo fica para o app. Novo uso `familia` em `api/voz.mjs`, que só vale para uma sessão existente e para o texto que a própria programação tem (as perguntas) ou a palavra "Pergunta" (`textoDaSessaoParaLer`, em `api/familia-sessao.mjs`).
- **Perguntas com a voz do Google:** o 🔊 de cada pergunta agora usa a voz do Google ("Pergunta", pausa e a pergunta). Se o Google falhar ou o envio ao Google não for aceito, lê com a voz do aparelho.

## 6.12.01

- **Perguntas com voz:** na adoração ao vivo, cada card de pergunta ganhou um 🔊 pequeno no início. Ao tocar, a voz do aparelho diz "Pergunta", faz uma pausa e lê a pergunta; tocar de novo (⏹️) para. Começar o áudio de um texto ou de outra pergunta interrompe a leitura anterior.

## 6.12.00

- **Adorações compartilhadas:** mais espaço entre o texto explicativo do card e a adoração listada logo abaixo.

## 6.11.99

- **Card "Adorações compartilhadas":** o card "Adorações que eu dirijo" mudou de nome, ganhou fundo azul claro e mais espaço em relação ao texto explicativo acima.

## 6.11.98

- **Boas-vindas não é mais seção:** na adoração ao vivo, uma parte só de boas-vindas (nome com "boas-vindas", sem textos, vídeos nem jogo) vira, como a Oração inicial, uma linha de texto (👋 Boas-vindas), sem card, sem botão de liberar e fora da numeração. Antes só valia para partes cujo nome começava com "Oração inicial". O prompt da Adoração em Família também manda a IA não criar parte de boas-vindas (a abertura é só a Oração inicial); se você editou esse prompt em Prompts da IA, acrescente a regra lá.

## 6.11.97

- **Jogo ao vivo — Regras e Placar:** o card do enunciado agora se chama **📜 Regras**. No topo do jogo aparece o **🏆 Placar**, uma tabela com o nome de cada participante (os cadastrados ao compartilhar, quem entrou e quem já pontuou) e os pontos, do maior para o menor, visível para todos. Para pontuar, o dirigente escolhe **Quem acertou?** na questão e toca em **✅ Pontuar: N pontos** (3, 2 ou 1, conforme as dicas já dadas): os pontos entram no placar, a resposta é revelada com "🏆 Nome ganhou N pontos" e a próxima questão aparece. **Revelar resposta** continua para quando ninguém acerta. Servidor: ação `pontuar` e `acertos` no estado (4 testes novos; 39 no total).

## 6.11.96

- **Jogo de dicas ao vivo (Quem sou eu?):** agora uma questão e uma dica por vez. Só a Questão 1 aparece; o dirigente toca em **💡 Dar a 1ª dica**, depois (se precisar) em **Dar a 2ª dica** e **Dar a 3ª dica**, e todos veem as dicas aparecerem na ordem, com a pontuação caindo a cada dica ("vale 3 pontos agora", 2, 1). Ao tocar em **Revelar resposta** (alguém acertou ou desistiram), a resposta aparece com a referência e a **próxima questão** é liberada. Os participantes veem "Aguardando a primeira dica…". Servidor: nova ação `dica` e `dicas` no estado público (3 testes novos; 35 no total). Jogos sem o formato "Dica 1: … Dica 2: …" continuam como antes (todas as questões à vista).

## 6.11.95

- **Nunca nomes nas atividades (Adoração em Família):** o nome do responsável saiu dos títulos das atividades na tela ao vivo, nas sugestões, na cópia e no Word; o servidor passa a gravar o campo responsável sempre vazio e o prompt manda a IA nunca citar nomes de pessoas nos títulos, descrições, jogos, perguntas e dicas (só as tarefas do dirigente podem citar quem faz o quê). Se o prompt da Adoração em Família foi editado por você em Prompts da IA, a nova regra precisa ser acrescentada lá.
- **Jogo na adoração ao vivo:** o enunciado (título, como jogar e material) fica num card próprio; os botões Sortear e Revelar resposta ocupam a largura toda; cada questão fica num card exclusivo, com o rótulo Questão N.

## 6.11.94

- **Tela grande:** novo botão **⏮️ Retornar** na barra de baixo (à esquerda de Próxima), que volta à atividade anterior (pulando a Oração inicial). Fica desativado na primeira atividade. Os três botões dividem a largura da barra.

## 6.11.93

- **Tela grande — uma atividade por vez:** cada atividade é uma página exclusiva, sem continuidade com as outras. Só a atividade atual aparece; ao passar para a próxima, a anterior some, a próxima abre e a tela volta ao topo. Antes de liberar qualquer atividade, aparece só a linha da Oração inicial.

## 6.11.92

- **Tela grande:** o botão **⏭️ Próxima** voltou à barra de baixo (ao lado de Sair da tela grande), para o dirigente avançar de parte sem sair do modo. Ele havia sido tirado por engano na 6.11.87.

## 6.11.91

- **Adoração ao vivo — objetivo da atividade:** no topo de cada parte aparece sempre o objetivo resumido, em **negrito e cor roxa**, no lugar da descrição longa. Ele é montado pelo que a parte tem: "Ler juntos os textos e comentar as lições", "Assistir aos vídeos e comentar as lições", "Jogar o jogo …", "Cantar juntos e terminar com uma oração" (combinando quando há mais de uma coisa). Se a parte não tem textos, vídeos, jogo nem cânticos, continua a descrição de antes. Só na tela ao vivo.

## 6.11.90

- **Adoração ao vivo:** a moldura da atividade liberada fica **verde**; a das ainda bloqueadas continua azul.

## 6.11.89

- **Adoração ao vivo:** o botão do dirigente em cada parte fica com fundo **vermelho claro** antes de liberar (Liberar para todos) e **verde claro** depois de liberada (Voltar a bloquear). Exceção pedida pelo usuário à regra de não usar verde.

## 6.11.88

- **Adoração ao vivo:** saiu o selo **▶ Agora** do título das partes. Os minutos previstos continuam.

## 6.11.87

- **Tela grande:** saiu o botão Próxima da barra de baixo; ficou só **Sair da tela grande**, na largura toda.

## 6.11.86

- **Adoração ao vivo:** saiu o botão Próxima / Começar dos controles do dirigente (cada parte já tem o seu Liberar para todos; a barra da tela grande mantém o Próxima). Cada atividade ganhou uma cor de fundo própria, clara e suave (azul, roxo, laranja, vermelho, azul-turquesa e rosa, repetindo a partir da sétima), que segue o tema claro e escuro.

## 6.11.85

- **Adoração ao vivo:** sem cronômetros. Saíram o cronômetro do dirigente (Iniciar, Pausar, Zerar e o rótulo da parte), a linha de tempo no topo e o marcador de tempo correndo em cada parte. Os minutos previstos de cada parte continuam aparecendo.

## 6.11.84

- **Adoração ao vivo — cânticos:** cada cântico da parte ganha, no mesmo padrão dos vídeos, uma moldura roxa clara com o link do vídeo no jw.org (Cante de Coração para Jeová), o botão **▶️ Reproduzir aqui** (o vídeo toca na tela) e o cartão recolhido **📝 Letra do cântico**. O servidor tem a nova ação `cantico` (parte liberada ou dirigente), que busca o vídeo no jw.org e a letra em fontes/canticos.json.

## 6.11.83

- **Adoração ao vivo — Oração inicial:** deixa de ser uma parte com card: aparece só como a linha de texto **🙏 Oração inicial**, sem moldura, sem a descrição de boas-vindas, sem botão de liberar e sem minutos. O dirigente começa direto na primeira parte de verdade (o botão vira Começar: 1. …), a numeração das partes recomeça em 1 sem a oração (também no cronômetro) e o botão Próxima pula a oração. Vale para a parte cujo nome começa com Oração inicial; a programação salva e o Word não mudam.

## 6.11.82

- **Adoração ao vivo:** todas as partes (seções) passam a ter a mesma moldura forte da parte atual (borda azul e contorno fino), inclusive as ainda bloqueadas.

## 6.11.81

- **Adoração ao vivo — vídeos:** cada vídeo (o link, o botão Reproduzir aqui e o cartão da Transcrição) fica numa moldura independente, com fundo roxo claro e borda roxa fina (cores que seguem o tema claro e escuro). Só na tela ao vivo.

## 6.11.80

- **Adoração ao vivo — perguntas:** cada pergunta fica numa moldura individual (borda fina azul, fundo suave que segue o tema) e em **negrito**, sem os marcadores de lista. Só na tela ao vivo.

## 6.11.79

- **Adoração ao vivo — textos bíblicos:** saiu o link ↗ Áudio no jw.org. O botão agora se chama **▶️ áudio do texto**, é fino e fica na mesma linha, antes do texto (com mais de um trecho no mesmo texto: ▶️ áudio: Livro cap:vers). A referência aparece em **negrito** e o conteúdo do texto entre aspas e em *itálico*. Só na tela da adoração ao vivo; as sugestões e o Word não mudam.

## 6.11.78

- **Adoração em família:** os botões Abrir como dirigente (ao criar o código) e Reabrir como dirigente (em Adorações que eu dirijo) passam a se chamar **▶️ Iniciar a adoração**; os avisos que os citavam foram ajustados.

## 6.11.77

- **Tela grande:** os dois botões de baixo (Próxima e Sair da tela grande) dividem a largura toda da tela, meio a meio, com 12 px de margem de cada lado.

## 6.11.76

- **Adoração ao vivo:** saiu o texto de resumo da programação que aparecia abaixo do botão Tela grande.

## 6.11.75

- **Adoração ao vivo:** o botão 📺 Tela grande ocupa a largura toda do card.

## 6.11.74

- **Adoração em Família:** o campo de apelido do painel de compartilhar não corta mais o texto (o aviso agora é Novo apelido, que cabe inteiro; conferido a 375 px: texto de 95 px num espaço de 132 px). Na lista de programações salvas, o botão de compartilhar também passou a se chamar **🔗 Selecionar esta programação**.

## 6.11.73

- **Adoração em Família:** em cada opção, Copiar e Word dividem a primeira linha (meio a meio, com o rótulo Copiar de volta no tamanho normal) e o botão de compartilhar passa a ser **🔗 Selecionar esta programação**, sozinho na linha seguinte, na largura toda. Na lista de programações salvas o botão continua como Compartilhar.

## 6.11.72

- **Adoração em Família:** os botões de cada opção (Copiar, Word e Compartilhar) ficam numa linha só, com rótulos curtos (Copiar esta opção virou Copiar; o texto completo aparece ao segurar). Ajustar com a IA e Salvar, quando aparecem, ocupam a linha seguinte inteira. Medido a 375 px: 3 × 103 px + espaços = largura da linha, sem texto cortado.

## 6.11.71

- **↩️ Restaurar padrões originais** (Configurar formatação com IA) agora volta ao **padrão do administrador** (o publicado com Salvar para todos, buscado na hora); se ele nunca publicou, volta ao padrão de fábrica do app.

## 6.11.70

- **Saiu a opção 🧠 Aprender com esta correção** de Mais opções (só pesava no código e não era usada). A tela de administração da memória de correções em Prompts da IA não mudou.
- **Ajustes → Configurar formatação com IA:** novo botão **↩️ Restaurar padrões originais**, na largura toda, que (depois de confirmar) volta todas as opções de formatação com IA ao que o app traz de fábrica.

## 6.11.69

- **Preparar para comentar:** toda vez que se sai e se entra de novo nas opções de comentários (pelo atalho, pelo menu, pela barra ou voltando de outra tela), todos os cards recolhíveis, inclusive os de dentro de cada ferramenta, voltam recolhidos. Atalhos diretos (A Sentinela, Joias, Estudo Bíblico) continuam abrindo a ferramenta pedida.

## 6.11.68

- **Preparar para comentar → A Sentinela:** o texto do parágrafo (Ver o texto do parágrafo) agora aparece alinhado à esquerda.

## 6.11.67

- **Novo atalho principal "Adoração em família"** (Início, menu e barra de baixo) que abre uma tela com as duas opções: **Sugestões para a noite de adoração em família** (continua exigindo o código de pesquisa; sem ele o botão fica cinza com o aviso) e **Participar de uma adoração em família** (sem código de pesquisa). O botão de participar saiu de dentro da tela de sugestões e o item Participar saiu do menu. O Voltar das duas telas leva de volta a essa tela.

## 6.11.66

- **Adoração compartilhada (tela Participar / dirigente) legível e sem aperto.**
  - No tema escuro, os cards das partes, o painel do dirigente, o cronômetro, as respostas e o sorteado usavam cores claras fixas e o texto ficava quase invisível; agora todas as cores seguem o tema (contraste conferido: texto 11,9:1, link 6,3:1, minutos 5,7:1).
  - Controles do dirigente: Passar o código e Passar a direção dividem a linha meio a meio e Encerrar ocupa a linha inteira (antes era uma coluna de 52 px com o texto na vertical).
  - Cronômetro: o rótulo ocupa a linha e Iniciar, Pausar e Zerar dividem a linha seguinte, sem cortar nada na direita.
  - Medido a 375 px: linhas de botões preenchem 100% da largura do card, sem rolagem horizontal.

## 6.11.65

- **Considerações para o serviço de campo — "Sugerir outros 3 assuntos" não repete mais os mesmos.** A causa: a escolha dos 3 parágrafos de w24.05 que servem de base aos assuntos era sempre a mesma (só os parágrafos das considerações *salvas* saíam da escolha) e a IA não sabia o que já tinha sugerido, por isso voltavam os mesmos assuntos com pequenas variações. Agora:
  - o app guarda o que já foi sugerido enquanto está aberto e manda de volta os títulos e os parágrafos a cada nova rodada;
  - o servidor tira dos candidatos os parágrafos já sugeridos (como os das considerações salvas): cada rodada traz parágrafos novos (com 16 parágrafos, são mais de 5 rodadas diferentes);
  - quando os parágrafos novos acabam, o que falta vem de **lições sorteadas** das brochuras Ame as Pessoas e Melhore Sua Leitura (o sorteio muda a cada rodada);
  - a IA recebe "JÁ SUGERIDOS NESTA SESSÃO" e a ordem de trazer assuntos realmente novos (outro texto bíblico, outro ponto, outra aplicação), nunca os mesmos reescritos com outras palavras (regra também no prompt dos assuntos).

## 6.11.64

- Considerações para o serviço de campo:
  - novo card **🗂️ Considerações já salvas**, **sempre recolhido** (também ao reabrir o card principal), que lista as do histórico, das mais novas para as mais antigas, com a **data** e o que cada uma abrangeu: o tema, os textos lidos, os pontos e as aplicações, o parágrafo de w24.05 e a lição do Ame as Pessoas. O botão **Abrir esta consideração** a leva ao campo de texto. A lista acompanha as mudanças no histórico.
  - saiu o campo **Data da saída**: a data é sempre a do dia em que o esboço é elaborado (o título salvo e o pedido usam a data de hoje).

## 6.11.63

- Considerações para o serviço de campo: no esboço, **cada ponto principal fica separado por uma linha em branco** (a pergunta, cada aplicação e o comentário depois da leitura), em vez de as aplicações ficarem coladas umas nas outras. Só nesta consideração; os outros esboços mantêm as ideias coladas ao argumento, como no modelo.

## 6.11.62

- Considerações para o serviço de campo — o formulário em contêineres coloridos:
  1. **Tipo de pregação** num contêiner de fundo **azul claro**.
  2. **Campanha ou destaque do mês, Público, Assunto e Fontes** noutro contêiner de fundo **amarelo claro**; o contêiner **Fontes do esboço** (sempre recolhido) fica com fundo **vermelho claro**, dentro do amarelo.
  Os campos de texto e as caixas de marcar continuam brancos. O texto de apresentação do card também foi atualizado (sem os lembretes do dirigente; com a pergunta e a referência ao Ame as Pessoas).

## 6.11.61

- **Considerações para o serviço de campo:**
  1. A seção **Lembretes para o dirigente** foi **abolida** (campo, parte do esboço e regra do prompt). A "Dica para o dirigente" do topo continua.
  2. **Pergunta obrigatória:** toda consideração leva pelo menos uma pergunta para a assistência, baseada no texto lido (antes ou depois da leitura) ou feita depois da explicação de um ponto importante da matéria. Se a IA não trouxer nenhuma, o app avisa ("ficou sem uma pergunta… use Melhorar").
  3. **Referência obrigatória à brochura Ame as Pessoas (lmd)**, mesmo quando a matéria escolhida não é dela: 1 ou 2 frases curtas no fim (parte "❤️ Ame as Pessoas"), mostrando como um ponto da brochura concorda com o ponto considerado ou como um lembrete curto, sempre citando a lição ("lmd lição N, Nome"). O servidor garante uma lição do lmd na mensagem (a que mais combina com o assunto), mesmo com a caixa do lmd desmarcada; se a IA não citar uma lição da mensagem, entra só a referência ("Veja também a brochura Ame as Pessoas: lmd lição N, Nome"), sem dizer o que a lição ensina. A lição citada entra na lista de fontes.

## 6.11.60

- **Considerações para o serviço de campo — esboço bem menor e no formato próprio** (regras registradas só para esta consideração, no prompt "Considerações para o serviço de campo", que o administrador vê e edita na tela de prompts):
  1. **Nunca menciona horário** (manhã, tarde, noite): a saída de campo pode ser a qualquer hora.
  2. **Sem introdução nem conclusão** do esboço-padrão: os princípios gerais de esboço deixaram de entrar nesta tarefa.
  3. **Lembretes finais só para o dirigente** (ex.: "Lembrar os publicadores de…"): ficam numa parte à parte no fim, "Lembretes para o dirigente (não são falados ao grupo)", e não fazem parte do que se fala à assistência.
  4. **Sempre baseada num texto bíblico, que abre a consideração**: a leitura é o primeiro item. Pode haver UMA frase curta antes, para chamar a atenção para o texto, ou começar direto na leitura.
  5. **Depois da leitura**, as aplicações: um raciocínio da matéria escolhida e as aplicações à pregação do dia; um segundo texto, se for preciso, para reforçar ou concluir o ponto (no máximo 2 leituras).
  6. **Ilustração simples** só se for muito apropriada (opcional).
  7. **Exemplos de personagens bíblicos** (Jesus, apóstolos e evangelizadores do primeiro século, profetas…) são bem-vindos.
  8. **Sempre 5 minutos**: saiu o seletor de duração da tela; o servidor ignora qualquer outro valor.
- O esboço agora tem 1 ponto (no máximo 2) com a leitura abrindo o ponto, em vez de introdução, 3 pontos e conclusão. Se a IA não trouxer uma leitura bíblica, o app avisa e não mostra o esboço. O "Sugerir 3 assuntos" também passa a propor assuntos apoiados num texto bíblico e sem horário.

## 6.11.59

- Considerações para o serviço de campo:
  - o botão **✨ Preparar esboço** passa a mostrar, embaixo do título, o **modelo e o esforço da IA** que vai escrever (o mesmo dos outros esboços, ex.: "Modelo: … · esforço: …");
  - depois da primeira sugestão, o botão **💡 Sugerir 3 assuntos** passa a se chamar **💡 Sugerir outros 3 assuntos**;
  - o botão **Refazer com outro assunto** estava colado no **Preparar esboço**: os três botões da pilha ficam agora com 12 px de espaço entre eles.

## 6.11.58

- Considerações para o serviço de campo: removida a opção **"Logo depois de uma reunião"**. Saiu da tela, do pedido enviado ao servidor, da linha de informações do esboço e dos textos dos prompts; a duração (5, 6 ou 7 minutos) é a única que define o tamanho do esboço.

## 6.11.57

- **Considerações para o serviço de campo — alinhamentos e tamanhos:**
  - A caixa **"Logo depois de uma reunião"** estava em bloco (a regra dos rótulos do formulário vencia a das caixas de marcar) e o texto passava por cima da moldura; voltou a ser uma caixa de marcar de verdade, com a mesma altura mínima (44 px) e o texto centralizado.
  - **Data da saída** e **Duração**: no celular os dois rótulos reservam duas linhas e os campos começam na mesma linha; os dois têm a mesma altura (40 px). O campo de data do iPhone era mais alto e centralizava o texto: agora segue o padrão dos outros campos (altura, texto à esquerda).
  - O botão **Sugerir 3 assuntos** ganhou um respiro acima (antes colava na última caixa).
  - Nas linhas de dois campos (data/duração, dia/horário da adoração, duração/quantas sugestões) todos os campos têm 40 px, e o **Dia da adoração** e o **Horário** do cadastro da família ficam alinhados no celular.

## 6.11.56

- **Considerações para o serviço de campo — fontes:** as fontes agora ficam num contêiner próprio, **sempre recolhido** ("📚 Fontes do esboço", com o resumo de quantas estão marcadas). Cada artigo de A Sentinela da lista tem a sua **caixa individual** (os 8 complementares, além de w24.05 e das brochuras lmd e th e do be), com **Marcar todas / Desmarcar todas**. A caixa nova **🔎 Pesquisar outras fontes** busca no wol.jw.org as matérias **mais novas** que tratam do assunto (sem anuários, índices, texto diário nem apostila) e traz o melhor parágrafo de até 2 delas. O servidor só lê os artigos que estão marcados. O app antigo (com `sentinela: false`) continua valendo.
- **Adoração compartilhada — áudio e vídeo na tela de quem dirige e de quem participa:**
  - cada texto bíblico da parte ganha **🔊 Ouvir os versículos**, que toca **só os versículos pedidos** do áudio da jw.org (o áudio informa em que segundo começa cada versículo) e um link **↗ Áudio no jw.org** direto para esse trecho (`#t=início,fim`);
  - cada vídeo ganha o link **↗ jw.org**, o botão **▶️ Reproduzir aqui** (o player aparece abaixo) e, logo abaixo, um **cartão fino e recolhido com a transcrição** (a legenda publicada). Nova ação do servidor, `video`: vale com o código da sessão, só para partes já liberadas (o dirigente vê todas); guardada 6 h por vídeo.
- **Adoração compartilhada — reabrir e apagar:** o painel 🔗 Compartilhar de uma programação que já tem código **mostra o código de novo** (antes oferecia criar outro): **▶️ Abrir como dirigente**, copiar, compartilhar o link e **🗑️ apagar o compartilhamento** (o código deixa de valer, a sessão sai do servidor e o painel volta à criação, para criar outro código). Na tela da Adoração em Família, o novo bloco **👑 Adorações que eu dirijo** lista as sessões deste aparelho (com o tempo que falta) para **Reabrir como dirigente**, copiar o código ou o link e apagar. A lista de adorações recentes de Participar também ganhou a lixeira nas que o aparelho dirige. Os botões dessas linhas ocupam a largura toda.

## 6.11.55

- Considerações para o serviço de campo, correção dos artigos de referência:
  - O artigo "Mantenham os sentidos, sejam vigilantes!" é de A Sentinela de fevereiro de 2023 (w23.02), não de 2026: corrigido na lista.
  - Os 9 artigos de referência (w24.05 e os 8 complementares) agora têm o número do documento no wol.jw.org (docId) fixo no código e são lidos direto por ele; a busca pelo título fica só de reserva (se o título lido não bater com o da lista).
  - "Não desista!" (w21.10, págs. 24-28), que a busca não achava por ser uma frase comum demais, agora é achado. O teste com o wol confere os 9 artigos: 9 de 9 achados.

## 6.11.54

- Considerações para o serviço de campo, fase 2 (tela):
  - Novo cartão **🚶 Considerações para o serviço de campo** em Reuniões → Preparação de discursos e esboços, com o mesmo acesso dos outros esboços (código do dirigente).
  - Campos, todos com valor padrão para preparar rápido: data da saída (hoje, com o dia da semana ao lado), duração (5, 6 ou 7 minutos; padrão 5), "logo depois de uma reunião", tipo de pregação (casa em casa marcado; dá para marcar mais de um), campanha do mês, público e assunto (opcionais) e as fontes preferidas (todas marcadas).
  - **💡 Sugerir 3 assuntos**: a IA propõe 3 assuntos curtos (com o parágrafo de A Sentinela de maio de 2024 de cada um); tocar num deles o põe no campo Assunto.
  - **✨ Preparar esboço**: o esboço vai para o campo de texto (com 📋 Copiar, 📝 Word, Outra versão e Melhorar, como os outros esboços), com a fonte de cada ponto e a dica para o dirigente, e fica salvo sozinho em Pesquisas salvas → Esboços.
  - **✨ Refazer com outro assunto**: um esboço novo, sobre um assunto diferente do atual.
  - O rodízio dos parágrafos de w24.05 e a variação dos assuntos saem das considerações já salvas neste aparelho.

## 6.11.53

- Considerações para o serviço de campo, fase 1 (servidor):
  - Nova tarefa **campo** no servidor: o esboço da consideração da reunião para o serviço de campo, de 5 a 7 minutos (mais curta logo depois de uma reunião), ligado ao tipo de pregação do dia, com o mesmo formato e a mesma limpeza dos outros esboços (no máximo 3 pontos, 1 texto lido no primeiro ponto, a soma dos minutos igual à duração), a fonte de cada ponto e uma dica para o dirigente.
  - **A Sentinela de maio de 2024** ("Deixe o amor motivar você a pregar"), lida no wol.jw.org, é a fonte prioritária: cada esboço usa um parágrafo, em rodízio (os já usados nas considerações salvas ficam para depois; com assunto, vale o parágrafo que mais combina).
  - As brochuras **Ame as Pessoas (lmd)** e **Melhore Sua Leitura e Seu Ensino (th)** entram nos arquivos do servidor, lição por lição (número e nome), junto com o **Beneficie-se** e outros artigos de A Sentinela sobre o ministério, lidos no wol.jw.org. O ponto só mostra a fonte que veio de verdade no pedido; o texto diário nunca é usado.
  - Nova tarefa **campo-assuntos** (botão "Sugerir 3 assuntos" da fase 2): 3 assuntos curtos, um para cada parágrafo ainda não usado de w24.05.
  - Prompts novos e editáveis em **Esboços e discursos**: "Considerações para o serviço de campo" e "sugerir 3 assuntos" (os formatos ficam só para leitura). As duas tarefas usam o modelo e o esforço dos esboços.
  - Teste do servidor: `node ferramentas/testar-servico-campo.mjs` (com `--wol`, lê também o wol.jw.org).

## 6.11.52

- Adoração em Família: os botões das linhas de ações passam a **ocupar sempre a largura toda**. No cartão da programação salva, "📂 Abrir esta programação" ocupa a linha inteira e "🔗 Compartilhar" cresce até a lixeira, que fica com a largura fixa. Antes sobrava um espaço vazio ao lado. Vale para todas as linhas `.fam-acoes`, inclusive as da Adoração compartilhada.
- Regra registrada em `.claude/CLAUDE.md`: numa linha de botões, eles sempre preenchem a largura da página.

## 6.11.51

- Adoração em Família compartilhada, fase 5 (cronômetro e tela grande):
  - **⏱️ Cronômetro da parte**: o dirigente inicia, pausa, continua ou zera o tempo da parte atual (os minutos previstos dela); todos veem o tempo correndo no topo da tela e na própria parte. Passando do tempo, aparece **⏰ Tempo esgotado** com os minutos a mais, em tom suave. O servidor guarda só o início e o restante (ação `cronometro`); cada aparelho conta os segundos acertado pela hora do servidor.
  - **📺 Tela grande** (TV ou notebook): letra maior, sem as barras do app, só as partes liberadas e o cronômetro em destaque; tenta a tela cheia quando o aparelho deixa. O dirigente tem **⏭️ Próxima** na barra da tela grande. Sair da tela (ou da adoração) desliga o modo.
  - O placar do jogo ficou de fora nesta versão.

## 6.11.50

- Adoração em Família compartilhada, fase 4 (jogo ao vivo): na seção do jogo, cada rodada mostra a pergunta (com a referência) e **🙈 Resposta escondida** para todos, inclusive para o dirigente.
  - O dirigente toca em **👁️ Revelar resposta**, rodada por rodada; só então o servidor envia aquela resposta, e ela aparece para todos com animação suave. As outras continuam fora do aparelho.
  - **🎲 Sortear entre quem entrou** e **🎲 Sortear entre os nomes** (os nomes informados ao compartilhar): todos veem "🎲 Vez de: nome", com uma animação curta; a mesma pessoa não sai duas vezes seguidas.
  - O material sem resposta (cartela, pares, cenas) aparece normalmente; o FunPlayB continua com o botão para abrir o jogo e, no aparelho do dirigente, o CSV para copiar.

## 6.11.49

- Adoração em Família compartilhada, fase 3 (tela **Participar**): nova tela "🔗 Adoração em família ao vivo", aberta pelo menu (**Participar de uma adoração**), pelo botão na tela de Adoração em Família e pelo link `#participar=CÓDIGO` (o código já vem preenchido e é validado sozinho; o endereço passa a mostrar só `#participar`).
  - Participar exige só o código da sessão (não o código de pesquisa). Depois do código, o participante toca no seu nome (os nomes informados pelo dirigente) ou escreve um apelido; o nome fica guardado no aparelho.
  - A programação aparece em seções, uma por parte, todas recolhidas e bloqueadas (🔒) até o dirigente liberar; liberada, a parte abre para todos com animação suave e fica marcada como **▶ Agora**.
  - Dirigente (▶️ Abrir como dirigente ou adorações recentes): **▶️ Começar / ⏭️ Próxima**, **🔓 Liberar / 🔒 Voltar a bloquear** em cada parte, lista de quem entrou, **📤 Passar o código**, **🔁 Passar a direção** (código do dirigente de 8 caracteres para outro aparelho, em "Dirigir de outro aparelho") e **⏹️ Encerrar**. Preparação, tarefas, dica e FunPlayB ficam só no aparelho do dirigente.
  - Atualização ao vivo por consulta a cada 4,5 s, só com a tela aberta e visível; para ao sair da tela ou esconder a página. As respostas dos jogos continuam fora da tela.

## 6.11.48

- Adoração em Família compartilhada, fase 2 (compartilhar): botão **🔗 Compartilhar** no cartão de cada opção gerada e de cada programação salva.
  - O painel traz a lista de nomes já preenchida com os apelidos do cadastro da família e dos convidados; o dirigente tira (✕) ou acrescenta nomes (até 20, 40 caracteres cada) antes de criar a sessão.
  - **🔗 Criar o código da adoração** envia a programação (com as rodadas dos jogos já separadas, também nas programações salvas antes da 6.11.46) e mostra o código grande, com **📋 Copiar código** e **📤 Compartilhar link** (Web Share API quando existe; senão copia o convite com o link `#participar=CÓDIGO`).
  - O painel aberto (com o código criado) continua no cartão quando a lista de Programações salvas é redesenhada.
  - A chave do dirigente fica só neste aparelho (`nsFamiliaSessoesV1`); criar exige o código de pesquisa, como a Adoração em Família.
  - Servidor: `entrar` sem nome devolve `precisaNome` (com os nomes informados) sem registrar ninguém; as respostas trazem `agora` (hora do servidor, para o cronômetro).

## 6.11.47

- Adoração em Família compartilhada, fase 1 (servidor): rota nova **`/api/familia-sessao`** para compartilhar uma programação por código e acompanhá-la ao vivo, com o dirigente liberando as partes.
  - Ações: `criar` (exige o código de pesquisa ou a senha de administrador; devolve o código de 6 caracteres, sem 0/O e 1/I/L, e a chave do dirigente), `entrar` (só o código da sessão e o acesso normal ao app; devolve a programação sem respostas, o estado e o id do participante), `estado` (só `{ versao }` quando nada mudou), `liberar`, `bloquear`, `sortear` (sem repetir a pessoa em seguida), `revelar` (uma resposta por vez), `passar-direcao`/`assumir` (código do dirigente de 8 caracteres, vale 15 min e uma vez só) e `encerrar`.
  - Arquivos em `familia-sessoes/<código>/`: `programa.json` (sem respostas), `respostas.json` (só o servidor lê; a chave do dirigente fica só como hash SHA-256), `estado.json` e um arquivo por participante. A sessão vence com 48 horas sem uso e é apagada na próxima vez que alguém a acessa ou quando outra é criada.
  - Segurança: origem permitida, limite de tentativas erradas por IP, programação até 200 mil caracteres, nomes até 40 caracteres, até 20 participantes.
  - Teste local sem rede: `node ferramentas/testar-familia-sessao.mjs` (HOSPEDAGEM=local numa pasta temporária).

## 6.11.46

- Adoração em Família, jogos: nos jogos de **pergunta e resposta** (Quem sou eu?, Show do milhão, Abreviações, Verdadeiro ou falso, Quem disse isso?, Charadas, Complete o versículo, Torta na cara), cada rodada passa a vir **separada**, no campo novo `jogo.rodadas: [{ pergunta, resposta, referencia }]`: a pergunta sem a resposta, a resposta e o texto bíblico que a confirma. É a base para a futura Adoração compartilhada, em que a resposta fica escondida até o dirigente revelar. Os demais jogos (memória, bingo, mímica, desenho…) continuam em `itens`.
  - O formato da IA e o prompt pedem as rodadas separadas. Se a IA não separar, o servidor separa os itens (`separarRodada`) pelos sinais "Resposta:"/"R:", " = ", "(Verdadeiro — …)" ou o último travessão.
  - As programações salvas antes desta versão são separadas no app pela mesma regra (`familiaConteudoDoJogo`). Na tela, na cópia e no Word, cada rodada aparece como "pergunta → Resposta: … (referência)".

## 6.11.45

- Ajustes → Prompts de IA (só administrador), categoria **🧰 DIVERSOS**: novo cartão **📝 Código de resumo (anotação)** (igual aos de pesquisa, dirigente, leitura, texto e S-34: campo, 📋 Copiar e 💾 Salvar anotação; o código que vale é o da variável `CODIGO_RESUMO` no servidor). O **contador** da categoria estava fixo em 2 e agora mostra os cartões de verdade (8) e se atualiza sozinho quando a lista muda.

## 6.11.44

- Ajustes (só administrador): nova seção **📚 Arquivos do servidor e edições**, junto das Lições das correções. Uma tabela com todos os arquivos de consulta guardados no servidor (`fontes/`): nome da publicação, **edição** (anotação sua, guardada no servidor; os arquivos não trazem a edição escrita), **o que o app lê no próprio conteúdo** (no Guia de Pesquisa, a Sentinela e a apostila mais novas citadas, ex.: w26.12; na Introdução da Bíblia de Estudo, os anos dos direitos autorais; nos demais, o ano mais recente citado no texto, aproximado), tamanho e **data de envio ao servidor**. Mostra também arquivos que o código espera e ainda não foram enviados. Ações novas do servidor: `fontes-inventario` e `fontes-anotar`.

## 6.11.43

- Pesquisas: o passo do **Guia de Pesquisa** voltou a funcionar em produção. O jw.org barra o servidor do Cloud Run (responde com uma página de verificação), então o Guia online vinha sempre vazio. Agora o servidor usa o arquivo `fontes/guia_de_pesquisa.txt`: acha o tópico do assunto (ex.: ANSIEDADE), lê os artigos que o Guia indica (título, publicação, páginas e parágrafos) e acha cada um no wol pela busca da frase exata do título (se o título veio com palavras do subtítulo na frente, tenta de novo sem elas). Depois é como antes: a faixa de parágrafos indicada ou, sem ela, o parágrafo que mais combina com a pesquisa. Ficam de fora a apostila Vida e Ministério, a Bíblia, o Perspicaz e os livros de consulta (o Perspicaz já entra à parte). O Guia online (jw.org) fica só como reserva, para quem rodar fora do Cloud Run.

## 6.11.42

- Assistente de pesquisas: os cards principais — **O que você quer pesquisar?** (aba Assunto), **Texto bíblico** e **Procurar um vídeo por assunto** (aba Vídeo) — ganharam fundo **azul claro** com moldura azul fina.
- Registro (log) das pesquisas passou a dizer quantas fontes novas da Sentinela (jw.org) entraram (`sentinelaNova`).

## 6.11.41

- Pesquisas: as **Perguntas dos Leitores** das edições novas de A Sentinela agora também são lidas (antes eram deixadas de fora por engano). Foi o caso de Tiago 5:14, 15, cujo novo entendimento está na Sentinela de fevereiro de 2027. Quando um parágrafo cita o versículo, entram também os 2 seguintes (que explicam), e o limite do trecho subiu para 2200 caracteres.

## 6.11.40

- Adoração em Família: o campo **Horário** (hora) vazava para fora do cartão no iPhone (o campo de hora do iOS tem largura própria). Agora ele segue a largura da coluna, com a mesma altura dos outros campos, e o **Dia** e o **Horário** ficam alinhados embaixo mesmo quando o rótulo de um quebra em duas linhas.
- Anotações: o botão **🔑 ✨ Formatar com IA** (com a chave do código ainda não informado) estourava a largura em celular estreito. A coluna dele ficou maior que a do Copiar e o texto quebra em duas linhas, em vez de vazar.
- Pesquisas (qualquer tipo, texto bíblico ou assunto): além das que citam o versículo, entram as **edições novas de A Sentinela achadas pelas palavras da pesquisa**. O servidor lê os artigos novos do jw.org e traz o parágrafo que mais combina (e o seguinte), com no mínimo 2 palavras da pesquisa no mesmo parágrafo (ou 1 palavra, se ela estiver também no título). No máximo 3 fontes novas por pesquisa, as que citam o versículo primeiro.

## 6.11.39

- Pesquisas (texto bíblico): agora entram as edições de estudo de **A Sentinela mais novas**, lidas direto no jw.org (de 2 meses atrás até 6 meses à frente). O Índice das Publicações e a pesquisa do wol chegam meses depois (em novembro de 2026 o wol ainda não tinha a Sentinela de fevereiro de 2027), por isso uma pesquisa sobre Atos 3:21 não trazia o artigo "O maior restabelecimento de todos". O servidor acha os parágrafos que citam o versículo (pelo código do versículo no link do jw.org), junto com o parágrafo seguinte, e coloca a fonte logo depois das notas de estudo. A regra de prioridade ao mais recente também cita as edições futuras já publicadas. Fontes do jw.org passam a abrir pelo link.

## 6.11.38

- Adoração em Família: o bloco **Formação da família** (dentro de Família e definições gerais) passou a se chamar **Dados da família** e ganhou os campos **Dia da adoração** (segunda a domingo) e **Horário**, para guardar quando a família faz a adoração. Ficam só neste aparelho, aparecem no resumo do card (ex.: "Quarta às 19:30") e não vão para a IA.

## 6.11.37

- Leitura da Bíblia: o card do capítulo que está sendo lido (com Lido, Marcar aqui, player e botões) ganhou **fundo amarelo claro**. No tema escuro o amarelo se mistura com o fundo escuro.
- Leitura da Bíblia: o card **Continuar de onde parou** ganhou **fundo vermelho claro** (uma regra de cores cinzas o deixava sem cor).

## 6.11.36

- Adoração em Família: o card **Informar convidados** também abre numa **vista exclusiva** (só ele na tela), com **◀ Voltar** no topo e **✔ Concluir e voltar** no fim, igual ao card Família e definições gerais. Os dois usam a mesma regra: só um deles aberto por vez, e ao voltar a tela fica como estava.

## 6.11.35

- Adoração em Família: o card **Família e definições gerais** agora abre numa **vista exclusiva** (só o cadastro na tela, sem os demais cards), com **◀ Voltar** no topo e **✔ Concluir e voltar** no fim. Ao voltar, a tela fica como estava (mesma rolagem). O card trocou a setinha ▾ por › para mostrar que abre outra tela.

## 6.11.34

- Adoração em Família: novo jogo **Torta na cara** em "Jogos aceitos" (perguntas bíblicas fáceis; quem erra recebe, de brincadeira, uma "torta" de chantilly ou espuma de barbear, só se topar). A IA entrega 10 perguntas com resposta, o material e os cuidados (olhos, alergias, crianças pequenas). Entrou antes dos jogos do FunPlayB, que seguem como os últimos da lista.

## 6.11.33

- Adoração em Família: o bloco recolhível do topo, antes "Cadastro da família", agora se chama **Família e definições gerais**, porque guarda também circunstâncias e atividades aceitas, não só o cadastro.

## 6.11.32

- Adoração em Família: o privilégio digitado como "Comulter" passou a ser **Commuter** (nome em inglês), na lista do cadastro e na lista aceita pelo servidor.

## 6.11.31

- Tela inicial: o atalho **Joias espirituais** saiu dos atalhos. Como era o único da página 3, a página 3 e o seu ponto de navegação também saíram, e os atalhos ficam em duas páginas de 8. As joias continuam disponíveis em Reuniões → Comentários (e em Pesquisas salvas).

## 6.11.30

- Adoração em Família, card "Informar convidados": novo seletor **"Como é a família convidada"**, com as mesmas opções do cadastro da família (casal com filhos, casal sem filhos, mãe ou pai sozinho, quem mora sozinho, família com avós ou outros), junto com o campo de texto "Informação da família convidada". Os dois vão para a IA ("tipo da família convidada" e "informação sobre a família convidada"), aparecem no resumo do card e ficam salvos só no aparelho.

## 6.11.29

- Adoração em Família, instrução para a IA: ela **pode (opcionalmente) levar em conta a situação espiritual e os privilégios** dos membros e dos convidados ao preparar as sugestões, especialmente havendo crianças (quem é batizado ou tem privilégios pode conduzir ou ajudar os menores; quem está começando é incentivado sem pressão; com Removido e Descrente, muito tato, sem expor e sem escrever a situação de ninguém no texto). Está no prompt editável "Adoração em Família" (tela de prompts) e no pedido enviado.
- Novo card **"🤝 Informar convidados"**, logo abaixo de "Cadastro da família". Ao expandir: "Informação da família convidada" (texto), a lista de convidados com os mesmos campos dos membros (apelido, relação com a família, ano de nascimento, situação espiritual com o ano e privilégios) e "Anotações gerais sobre os convidados". **Ao preencher um convidado, o campo do próximo abre sozinho** (até 12). Tudo fica só no aparelho (e entra no "Apagar" de Privacidade e dados); o ano de nascimento nunca é enviado, só a idade. A IA leva os convidados em conta (idades, situação, anotações, vídeos para crianças) mas **não lhes designa tarefas**.

## 6.11.28

- Adoração em Família, programações salvas: **cada opção vira uma programação independente**. Ao preparar 2 opções, o app salva duas programações ("… · Opção 1" e "… · Opção 2"), e o card "📂 Programações salvas (n)" conta e lista cada uma separadamente, cada uma com a própria moldura, tema, tempo, resumo, atividades, "📂 Abrir esta programação" e 🗑️ (apagar só aquela). As programações salvas antes com duas opções são divididas em duas, automaticamente, uma única vez. Pesquisas salvas → Adoração em Família passa a mostrar uma entrada por opção.
- Substitui os contêineres por opção dentro de uma programação (6.11.27).

## 6.11.27

- Adoração em Família, programações salvas: cada opção fica num contêiner separado (com a própria moldura), com o tema, o tempo, o resumo e as atividades, e o seu botão "📂 Abrir só a opção N", que traz só aquela opção de volta para a tela. Quando a programação salva tem duas opções, o botão "📂 Abrir as 2 opções (para montar a sua)" continua trazendo as duas, com a montagem da própria programação; o 🗑️ apaga a programação inteira.

## 6.11.26

- Adoração em Família, caixa "Jogos aceitos": o fim da caixa foi alinhado. A opção "Pode usar papel e lápis" ocupa a largura da lista, com a caixa de marcar centralizada no texto, e "Marcar todos" e "Desmarcar todos" dividem a linha em duas colunas de mesmo tamanho, alinhadas com a lista.

## 6.11.25

- Adoração em Família: abaixo do botão da IA, novo card recolhível e fino **"📂 Programações salvas (n)"**. Ao abrir, lista todas as programações já salvas (as preparadas pela IA e as montadas por você), da mais recente para a mais antiga, cada uma com o tema (emoji e título), o tempo total, o número de atividades, um resumo do assunto e a lista das atividades, cada uma com os minutos e um resumo curto (e o jogo, quando houver). "📂 Abrir na tela" traz a programação de volta com todos os detalhes (copiar, Word, jogos, FunPlayB) e "🗑️" apaga. A lista se atualiza sozinha ao salvar ou apagar (também em Pesquisas salvas).

## 6.11.24

- Adoração em Família, jogos: em "Atividades que a família aceita" há a caixa **🎲 Jogos aceitos**, com 17 tipos para marcar (Quem sou eu?, Show do milhão bíblico, Abreviações bíblicas como "Os 12 A de C", Mímica, Verdadeiro ou falso, Ordem dos acontecimentos, Quem disse isso?, Jogo da memória, Caça ao tesouro, Charadas, Bingo, Complete o versículo, Forca, Cruzadas e caça-palavras, Pictionary bíblico e dois do FunPlayB), mais "Marcar todos", "Desmarcar todos" e a opção "Pode usar papel e lápis". Vale quando "Jogos ou adivinhas" está marcado; a escolha fica salva no aparelho.
- Com jogos aceitos, a IA inclui em cada opção pelo menos uma parte com jogo e o entrega **pronto**: nome, regras, material e o conteúdo completo (rodadas, perguntas com a resposta, personagens com dicas, abreviações com o significado…), só com fatos bíblicos bem conhecidos e adequados às idades. Na tela, cada jogo aparece na própria parte; no Word, a parte mostra o nome e o **material fica numa seção separada ("Material dos jogos"), em página nova**; "Copiar" leva tudo.
- **FunPlayB**: o jogo "jogar um tema de perguntas" manda abrir o FunPlayB; o jogo "tema personalizado" faz a IA criar um tema com **20 perguntas no formato de importação do FunPlayB** (CSV com ";": tema, enunciado, alternativas A a D, resposta, dificuldade e referência, respeitando os limites do módulo; pergunta fora dos limites é descartada pelo servidor). O cartão ganha "📋 Copiar perguntas para o FunPlayB" (cola direto no módulo de importação), "🎮 Abrir o FunPlayB" e a lista das perguntas; o Word também traz as perguntas com as respostas.
- A instrução da IA (tela de prompts, "Adoração em Família") e o formato técnico foram atualizados.

## 6.11.23

- Adoração em Família: ao lado de "📋 Copiar esta opção", novo botão **📝 Word** em cada opção e na "Minha programação". Ele abre a prévia da página no formato do Word (a mesma tela cheia dos esboços e das pesquisas, com A− e A+ para o tamanho da letra); de lá, "Exportar para Word" ou "Compartilhar" geram o arquivo "Adoração em Família - título.docx", com o logo, o título, o resumo e o objetivo, as partes (minutos e responsável, descrição, textos bíblicos, vídeos com o link, cânticos, publicações, perguntas e as transições da IA), a preparação, as tarefas e a dica.
- Na montagem da própria programação, o botão "🧹 Desmarcar tudo" ocupa a largura da página.

## 6.11.22

- Tela inicial: o atalho Adoração em Família vai para a página 1 dos atalhos, no lugar de Discursos, que passa para a página 2 (os dois trocaram de lugar).

## 6.11.21

- Adoração em Família: novo texto de abertura da tela, com a primeira frase em negrito: "**Peça sugestões para a noite de adoração em família.** A IA leva em conta as informações repassadas sobre a sua família (cadastradas por você) e monta 1 ou 2 opções completas (você escolhe), com partes, textos, vídeos e, se quiser, cânticos."

## 6.11.20

- Adoração em Família, ✨ Ajustar com a IA: o cartão "Minha programação" ganha o botão que pede à IA para finalizar o conjunto sem mexer no que você escolheu. A IA não troca, tira, reordena nem acrescenta partes, e não muda minutos, textos, vídeos nem cânticos; só escreve a transição entre as partes (➡️ Transição, na abertura, entre uma parte e outra e no encerramento), melhora a descrição de uma parte se ela precisar encaixar com as vizinhas e dá uma dica de condução (avisando se o tempo total passa ou sobra). Usa o modelo e o esforço da Adoração em Família (Ajustes → Modelos e agentes de IA) e o mesmo código de pesquisa; o servidor devolve só esses textos, e o app os junta à programação. O botão mostra o relógio enquanto trabalha e dá para ajustar de novo. A instrução da IA é nova na tela de prompts (grupo Adoração em Família: "ajuste da programação montada pelo usuário").
- Atalho da tela inicial: "Sugestões para a noite de adoração em família" (antes, "Opções para a noite da família"). Botão da barra inferior: "Adoração" (antes, "Família").

## 6.11.19

- Adoração em Família, montar a própria programação: as duas opções continuam sendo geradas separadas, e agora há o botão "🧩 Montar minha programação com partes das duas opções". Ele abre uma lista com todas as partes das duas opções, cada uma com caixa de marcação; o tempo previsto é somado a cada marcação ("⏱️ Previsto: 38 min de 45 min · faltam 7 min", em vermelho quando passa do tempo), e um número mostra a posição de cada parte, na ordem em que foi marcada. "✅ Gerar minha programação" monta o programa final (feito no aparelho, sem gastar a IA) com as partes escolhidas, a preparação e as tarefas das opções usadas, com copiar e "💾 Salvar em Pesquisas salvas" (categoria Adoração em Família). Só aparece quando há duas opções.

## 6.11.18

- Adoração em Família: o apelido do membro deixa de ter lixeira própria (ficava com duas lixeiras na linha; resta só a que remove o membro). A lixeira dos campos de texto (anos de casados, outras circunstâncias e assunto) fica sempre visível, esmaecida enquanto o campo está vazio, em vez de aparecer só com texto.

## 6.11.17

- Adoração em Família, 👤 Membros: cada membro ganha **Situação espiritual** (Batizado, Publicador não batizado, Removido, Descrente, Estudante) e **Privilégios** (vários podem ser marcados: Pioneiro regular, Pioneiro auxiliar, Pioneiro especial, Ancião, Servo ministerial, Serviço de Betel, Superintendente viajante, Voluntário a distância, Comulter, Tempo integral especial). Só "Descrente" não pede o ano; nas outras aparece um campo de ano com o rótulo da situação (ano do batismo, publicador desde, ano em que foi removido, estuda a Bíblia desde). Tudo fica só no aparelho e é enviado à IA, que adapta as partes e as tarefas (com tato com Removido e Descrente, sem escrever a situação de ninguém nas opções); o servidor só aceita valores dessas listas.

## 6.11.16

- Adoração em Família: a opção "Família monoparental" do tipo de família passa a se chamar "Mãe ou pai sozinho" (quem já tinha a escolha salva continua com ela, com o nome novo). Duração total e Quantas sugestões dividem a mesma linha no card "Duração e assunto".

## 6.11.15

- Adoração em Família: os campos de texto (apelido de cada membro, anos de casados, outras circunstâncias e assunto) têm o botão 🗑️ para limpar o campo (aparece só quando há texto), e as caixas de texto crescem e encolhem conforme o conteúdo.
- Adoração em Família, card "Duração e assunto": novo campo "Quantas sugestões", com 1 ou 2 (padrão 2; a escolha fica salva no aparelho). O botão mostra "Preparar 1 opção" ou "Preparar 2 opções"; o servidor pede à IA exatamente essa quantidade (antes eram sempre 3), e as instruções da IA e a tela de prompts foram ajustadas.

## 6.11.14

- Modelos e agentes de IA: as listas de modelos mostram só o que a conta ativa consegue usar. O servidor (`ia-disponiveis`) manda um pedido mínimo a cada modelo, pelo provedor que o atenderia (Gemini pela conta do Google; Claude pela API da Anthropic ou pelo Google Cloud/Vertex, conforme o provedor escolhido na tela) e a tela esconde os que a conta não tem (404, 403 ou aviso de modelo indisponível); falha de rede ou limite de uso não esconde nada. O resultado fica guardado 30 minutos; confere de novo ao abrir a seção, ao trocar o provedor e depois de salvar (conta do Google ou provedor mudados). Um modelo já salvo que a conta não oferece continua na lista, marcado "(indisponível nesta conta)".
- Adoração em Família: moldura fina azul em volta dos campos de cada membro da família.

## 6.11.13

- Modelos e agentes de IA: nova linha "Adoração em Família" (seção ✍️ Texto), com modelo e esforço só dela. O modelo pode ser de qualquer família (Claude ou Gemini); o provedor é o do modelo escolhido (o Gemini pela conta do Google; o Claude pelo provedor do uso geral, ou pela API da Anthropic se o geral for Gemini). "O mesmo do uso geral" e "Esforço do uso geral" (padrão) mantêm o comportamento anterior. A nota sob o botão "Preparar 3 opções" mostra esse modelo.

## 6.11.12

- Adoração em Família: o botão "Preparar 3 opções" mostra o modelo da IA sob o título (como os outros botões da IA) e, enquanto prepara, um relógio "⏳ Preparando… ⏱️ 0:42" no próprio botão e na mensagem de andamento; no fim a mensagem traz o modelo e o tempo total.
- As 3 opções geradas são salvas sozinhas em Pesquisas salvas, numa categoria própria "👨‍👩‍👧 Adoração em Família" (não depende da semana escolhida). Abrir uma delas mostra as 3 opções de volta na tela Família; dá para apagar como as outras.

## 6.11.11

- Limpeza depois da migração para o Google Cloud (a Vercel foi desligada): o armazenamento (`api/_blob.mjs` e `api/_armazem.mjs`) usa só o Cloud Storage (e a pasta local nos testes); saíram o `@vercel/blob`, o Global Config e a API da Vercel. Removidos `vercel.json`, `.vercelignore`, a pasta `.vercel` e os scripts de cópia da Vercel (`migrar-blob.mjs`, `migrar-config.mjs`). `ferramentas/subir-fontes.mjs` envia só para o bucket. A pasta `scripts/` dos extratores das publicações foi para `ferramentas/extratores/` (fora do site e do servidor).
- Textos: a Política de Privacidade (versão 2.3) e a página Sobre passam a citar o Google Cloud (servidores em São Paulo) como hospedagem, no lugar da Vercel; as dicas dos códigos de acesso falam em "servidor". README reescrito para a hospedagem atual.

## 6.11.10

- Barra de navegação: o botão 🎙️ Gravar dá lugar ao 👨‍👩‍👧 Família (Adoração em Família), bloqueado sem o código de pesquisa como o atalho do Início. Áudio em texto continua no Início e no menu.

## 6.11.09

- Adoração em Família: quando a opção "Vídeo do jw.org" está marcada nas atividades da família, a IA passa a incluir obrigatoriamente pelo menos um vídeo em cada uma das 3 opções de programação.

## 6.11.08

- Adoração em Família: a escolha de cânticos passa para dentro de "Atividades que a família aceita", separada em "Cântico inicial" e "Cântico final".

## 6.11.07

- Adoração em Família: desmarcar todas as atividades extras passa a ficar salvo ao reabrir o app; na primeira abertura (com o cadastro da família recolhido), o resumo do cabeçalho já aparece preenchido; o perfil entra separado em Ajustes → O que está guardado neste aparelho; rótulo de Circunstâncias simplificado para "(opcional)" sem a frase auxiliar e com 6 novas opções (desânimo espiritual, falta de ânimo para estudos e revisitas, falta de ânimo para ministério, equilíbrio em entretenimento, equilíbrio no trabalho e comunicação na família); opção para incluir ou não cânticos inicial e final, e abertura sem designar quem fará a oração inicial.
- Política de Privacidade (v2.2) e página Sobre: incluída a Adoração em Família e atualizada a versão exibida em Sobre.
- Mensagem de teto de gastos da IA: texto mais curto (informa a conta atual atingida, orienta que o usuário pode avisar o administrador e lembra a opção de trocar para outra conta com limite disponível, exclusiva do administrador), exibido em letras vermelhas com moldura ao redor e sem negrito.

## 6.11.06

- Adoração em Família: passa a usar o modelo e o provedor gerais de Ajustes (Anthropic / Claude ou Gemini), e não mais o modelo da resposta das pesquisas (que costuma ser Gemini). Trocar para Claude em Modelos e agentes de IA passa a valer nesta tela.

## 6.11.05

- Mensagem de erro da IA: quando o teto de gastos (spend cap) do Google Cloud no Vertex AI / Gemini está ativo, o app avisa isso de forma clara (antes aparecia só "Não foi possível obter sugestões agora").

## 6.11.04

- Início: o atalho Adoração em Família fica no lugar de Joias espirituais (página 2); Joias passa para a página 3.
- Adoração em Família: o cadastro da família (formação, membros, circunstâncias e atividades) fica num bloco recolhível no topo, que abre sempre fechado; duração, assunto e o botão de preparar as opções ficam à vista.

## 6.11.03

- Adoração em Família no celular: a tela não estoura mais a largura (rolagem horizontal). As caixas de marcar e a grade dos membros passam a caber na tela; o topo e os campos se adaptam melhor em aparelhos estreitos.

## 6.11.02

- Adoração em Família: nova tela (atalho na página 3 do Início e item no menu), liberada pelo código de pesquisa. O perfil da família fica só no aparelho (formação, apelidos, papéis, ano de nascimento → idade calculada na hora, circunstâncias, atividades, duração e assunto). A IA (a mesma da resposta final das pesquisas) prepara 3 opções completas, com partes, textos bíblicos, vídeos do jw.org, cânticos, publicações, perguntas, preparação, tarefas e dica para o chefe. Dá para copiar cada opção.

## 6.11.01

- Computador (tela a partir de 1180 px): sai o atalho Menu do centro da barra do topo, porque o mesmo menu já abre pelo ☰ à esquerda. Ficam seis atalhos (Início, Anotações, Pesquisas, Reuniões, Gravar e Bíblia). Abaixo de 1180 px e no celular o atalho Menu continua.

## 6.11.00

- Computador (tela a partir de 1180 px): os atalhos das telas (Início, Anotações, Pesquisas, Reuniões, Gravar, Bíblia e Menu) passam para o centro da barra do topo, sem cartão próprio, e a marca NoteStyle vai para o lado direito da barra; o botão ☰ continua à esquerda. Só CSS (bloco no fim do app.css). Entre 980 e 1179 px continua como antes (atalhos num cartão logo abaixo da barra) e no celular eles seguem embaixo.
- Leitura em voz alta: a conta que mantém a frase lida à vista só desconta a barra dos atalhos quando ela está embaixo (no computador ela fica em cima).

## 6.10.99

- Virada para o Google Cloud: a marca `<meta name="notestyle-api">` (index.html e sobre.html) passa a ter o endereço do Cloud Run no `content`. A partir daqui o app, em qualquer endereço (Vercel, Firebase ou Cloud Run), usa a API e os dados do Google Cloud. Antes disso, os dados da Vercel foram copiados de novo para o bucket (16 arquivos e 17 configurações, sem falhas).

## 6.10.98

- Áudio em texto: o reconhecimento de voz às vezes entrava em laço em trechos com silêncio ou ruído e repetia a última frase até o limite ("Sei lá. Sei lá. Sei lá…"). Agora o servidor junta numa só a frase (ou expressão curta) repetida 3 vezes ou mais em sequência; repetições naturais de 2 vezes ("Muito bem, muito bem") ficam. Vale para o Chirp 3 e para o Gemini; na transcrição pelo Gemini, a instrução também pede para não repetir a última frase em silêncio, música ou ruído.

## 6.10.97

- Assistente de pesquisas, resposta direta: nova regra fixa da IA (visível na tela de prompts, "resposta direta para perguntas específicas"). Pergunta específica (uma função, regra, procedimento, definição) recebe resposta direta, começando pela resposta, com os detalhes concretos da fonte que trata do assunto (instruções da organização, como o S-38, acima de artigos gerais), sem introdução, princípios, lições e aplicações. Nova opção "🎯 Resposta direta" em Opções adicionais de pesquisa para forçar esse modo (lembrada no aparelho).
- Busca nos livros do servidor: o parágrafo que traz a expressão inteira da consulta ("conselheiro assistente") ganha pontos, mais ainda quando ela está no título da seção ou no começo do parágrafo; as palavras digitadas pelo usuário ficam sempre na consulta dos livros; a pesquisa recebe até 4 trechos (antes 3). Teste com o S-38: o parágrafo 26 (conselheiro assistente) entra entre os primeiros.

## 6.10.96

- Pesquisa da IA: 14 publicações novas entram como fontes de consulta (junto com Bíblia, Perspicaz, Adoração Pura, Reino de Deus e Princípios Bíblicos): Raciocínios, Glossário da TNM, Introdução e Apêndices A–C da Bíblia de Estudo, Guia de Pesquisa, Abreviaturas, S-38, Manual da Escola, Perguntas Bíblicas Respondidas, Perguntas Frequentes sobre as TJ, Beneficie-se da Escola e Organizados. Se algum arquivo ainda não estiver no armazenamento, a busca segue com os demais (`Promise.allSettled`). Ferramentas: `epub-para-txt.mjs`, `preparar-fontes-novas.mjs` e `subir-fontes.mjs` (Vercel Blob + Google Cloud Storage).

## 6.10.95

- Texto diário: a opção "💬 Gerar e ler os comentários adicionais automaticamente" (depois da leitura do texto) vem ligada por padrão para quem começa a usar o app. Quem já usava (aparelho com cadastro confirmado) e nunca mexeu nela continua com ela desligada; a escolha fica gravada na primeira abertura.

## 6.10.94

- Senha de administrador libera tudo: com ela salva em Autorização de acessos, todas as funções (pesquisa, dirigente, leitura em voz alta, resumo, S-34 e texto) ficam habilitadas sem os códigos de cada uma. O app usa a senha no lugar do código que faltar e o servidor (`recursoCodigoValido`) aceita a senha de administrador como código de qualquer função. Os campos de código continuam mostrando só o que foi digitado neles; sem código, aparece "🛡️ Liberado pela senha de administrador". As conferências periódicas dos códigos olham só os códigos digitados.
- Leitura da Bíblia: todas as opções do resumo (resumo, Sobre Jeová, aplicações, fundo histórico, personagens, lugares e profecias) vêm marcadas por padrão. Nas preferências já salvas, todas são marcadas uma vez; o que o usuário desmarcar depois fica desmarcado.

## 6.10.93

- Migração (teste no Firebase antes da virada): a marca `<meta name="notestyle-api">` (index.html e sobre.html) ganhou `data-firebase` com o endereço do Cloud Run. Com o `content` vazio, só os endereços de teste do Firebase (`*.web.app`, `*.firebaseapp.com`) chamam a API no Cloud Run; o site na Vercel (`www.notestyle.com.br`) continua com a própria API até a virada, quando o `content` recebe o endereço. No Cloud Run, `ORIGENS_PERMITIDAS` passou a incluir `notestyle-512212.web.app` e `notestyle-512212.firebaseapp.com`.

## 6.10.92

- Firebase Hosting (`firebase.json`): a regra que deixava de fora todos os arquivos ocultos (`**/.*`) também tirava a pasta `.well-known` (o `assetlinks.json` do app Android). Agora os ocultos sigilosos são listados um a um (`.env*`, `.git`, `.claude`, `.dados-local`, `.vercel`, `*ignore`) e a `.well-known` é publicada. Conferido por simulação com a mesma biblioteca do Firebase: 62 arquivos, só os do site.

## 6.10.91

- Google Cloud (`server.mjs`): a pesquisa (e os esboços) gravam o resultado antes de enviar, e o envio sai logo depois de a função terminar. O servidor fechava a resposta vazia nesse intervalo ("A IA não conseguiu escrever a pesquisa") e depois caía ao tentar enviar. Agora ele espera o envio (até 2 minutos), como a Vercel, e uma segunda resposta é só ignorada, sem derrubar o servidor.

## 6.10.90

- Leitura em voz alta: as regras de leitura do administrador (pular as referências depois do travessão e entre parênteses) só ficam guardadas quando o servidor responde. Antes, uma falha na primeira consulta (por exemplo, com o aparelho ainda sem cadastro aprovado) deixava os padrões até fechar o app, e a voz lia "— Heb. 11:1, 6." no fim do texto diário.
- Texto diário (e leitura da Bíblia): a tela volta a acompanhar a frase lida no iPhone. O ajuste da barra de baixo do iPhone "cutucava" a rolagem e interrompia a rolagem suave no meio; agora ele espera a rolagem do app terminar, e se a frase ainda ficar fora da tela, a tela vai direto até ela.

## 6.10.89

- Migração para o Google Cloud: script `ferramentas/aprovar-cadastro.mjs`, que lista os cadastros pendentes de um servidor (padrão: o endereço do Cloud Run) e aprova ou recusa pelo terminal, com a senha de administrador digitada sem aparecer na tela. Serve para o endereço novo, onde o aparelho fica na tela de cadastro e não chega em Ajustes.

## 6.10.88

- Migração para o Google Cloud: script `ferramentas/criar-segredos.mjs`, que lê um arquivo local `.env.segredos` (fora do Git) e cria ou atualiza os segredos no Secret Manager pelo gcloud, sem mostrar os valores, e no fim mostra a linha `--set-secrets` pronta para a publicação no Cloud Run.

## 6.10.87

- Preparação da migração para o Google Cloud (sem mudar nada na Vercel): `server.mjs` (servidor do Cloud Run: site com os cabeçalhos de segurança, compactação e ETag; `/api/<nome>` chamando os mesmos handlers, com `req.body`/`req.query` como na Vercel; CORS para as origens permitidas); `api/_blob.mjs` (get/put/list/del do Vercel Blob, do Cloud Storage com `HOSPEDAGEM=gcp` ou de uma pasta com `HOSPEDAGEM=local`), usado pelos 7 módulos de arquivos; `api/_armazem.mjs` guarda as configurações do administrador em `config/armazem/<chave>.json` no bucket com `HOSPEDAGEM=gcp`; `origemPermitida` aceita endereços extras em `ORIGENS_PERMITIDAS`; o app e a página Sobre chamam a API no endereço da marca `<meta name="notestyle-api">` (vazia = o próprio site, como hoje); Dockerfile, .gcloudignore, .dockerignore, .vercelignore, firebase.json, .firebaserc e cloudbuild.yaml; scripts `ferramentas/migrar-blob.mjs` e `ferramentas/migrar-config.mjs`; dependência `@google-cloud/storage`; o endereço do aviso do Mercado Pago passa a poder vir de `MERCADOPAGO_URL_AVISO` (padrão: o atual).

## 6.10.86

- Aviso de versão nova: os botões "Atualizar agora" e "Depois" ocupam a largura toda do aviso, lado a lado.

## 6.10.85

- Extrato de créditos e consumo: retirada a nota sobre a diferença para o total do mês (só fazia sentido em novembro de 2026). O agrupamento dos consumos e o limite de 1000 movimentos continuam.

## 6.10.84

- Extrato de créditos e consumo: nota que explica por que o consumo do extrato pode ser menor que o "Total" do mês (o extrato só registra o que foi descontado do saldo desde que começou; o total do mês conta todo o uso de IA do mês, inclusive o de antes do saldo existir, em 12/11, e do extrato, em 15/11).
- Servidor: consumos seguidos do mesmo recurso em até 30 minutos viram um movimento só no extrato (com a quantidade de vezes), e o limite sobe de 400 para 1000 movimentos; antes, a transcrição de áudio lançava um movimento por trecho de 50 s e os mais antigos sumiriam em poucos dias.

## 6.10.83

- Início: o atalho Extrato troca o 📒 pelo 💰 (saldo e consumo).

## 6.10.82

- Início: a descrição do atalho Assistente de pesquisas passa a ser "Pesquisar um assunto, texto ou vídeo no wol.jw.org com auxílio da IA".

## 6.10.81

- Anotações · Transcrições na íntegra: o botão "Pôr nas anotações" aparecia cortado; os três botões (Copiar, Pôr nas anotações e a lixeira) ficam numa grade com espaço para o texto inteiro, e a lixeira passa ao vermelho claro dos botões de apagar.

## 6.10.80

- Assistente de pesquisas: os cards de entrada das abas Assunto ("O que você quer pesquisar?"), Texto bíblico e Vídeo ficam com fundo cinza claro; os campos continuam brancos.

## 6.10.79

- Extrato de créditos e consumo: a linha do saldo, no fim, fica em destaque (valor grande e em negrito, numa faixa com moldura azul). Corrigido "3 diaes" para "3 dias" nos subtotais.

## 6.10.78

- Texto diário · leitura em voz alta com os comentários adicionais automáticos: o aviso passa a ser "Aguarde" [pausa] "gerando comentários adicionais" (duas falas seguidas, que fazem a pausa), no lugar de "Aguarde... gerando comentários".

## 6.10.77

- Atalho Extrato: o card Extrato de créditos e consumo já abre expandido.
- Modelos e agentes de IA: o resumo do capítulo da Leitura da Bíblia (tarefa leitura-biblia) entra no grupo "Esboços, dirigir, texto diário e resumo do capítulo" e usa o mesmo modelo mais avançado; no faturamento, passa a ser cobrado no preço dessa categoria.
- Pesquisas e respostas salvas sai da tela Reuniões e vira uma tela própria (com ◀ Voltar para a tela de onde se veio), aberta pelo atalho do Início e pelo menu.
- Formatar passa a se chamar "Formatar notas JW Library" no atalho do Início, no menu lateral e no título da própria tela.

## 6.10.76

- Leitura da Bíblia · resumo: a seção PROFECIAS E EXPRESSÕES SIMBÓLICAS passa da corneta 📯 (difícil de reconhecer) para a trombeta 🎺, no título, nos itens, na opção e nas instruções da IA; os resumos já salvos (com 🔮 ou 📯) mostram 🎺.

## 6.10.75

- Anotações: os cards com os temas dos discursos (programa da reunião, assembleia ou congresso) ficam com fundo cinza claro; os que já têm anotações e o card aberto mantêm a cor própria.

## 6.10.74

- Leitura da Bíblia · resumo: a seção PROFECIAS E EXPRESSÕES SIMBÓLICAS deixa a bola de cristal (adivinhação, que Jeová detesta) e passa à trombeta 📯, no título, nos itens, na opção do resumo e nas instruções da IA; o servidor troca a bola de cristal mesmo que um prompt editado a peça, e os resumos já salvos mostram a trombeta. O grupo de Apocalipse (Bíblia por seções) passa de 🔮 a 👑, e a bola de cristal sai da lista de emojis.

## 6.10.73

- Leitura da Bíblia · resumo do capítulo: na seção SOBRE JEOVÁ, a qualidade que abre cada parágrafo (ex.: "(v. 8) justiça: …") sai em negrito e numa cor própria (laranja-escuro; claro no tema escuro).

## 6.10.72

- Assistente de pesquisas · Vídeo: "Procurar também no que é falado" passa para baixo do campo de busca (antes do link do vídeo).
- Setas dos cards recolhíveis em todo o app: recolhido, a seta aponta para baixo (▾); aberto, para cima (▴). Os cards com a seta nativa do navegador (▶) também passam a esse padrão.
- Atalho Extrato do Início: abre o card Consumo de IA e faturamento numa tela só dele (sem as outras opções de Ajustes), com o botão ◀ Voltar no topo.
- Consumo de IA e faturamento: o Extrato de créditos e consumo vem antes do Adicionar crédito por Pix.
- Ajustes: "Administração de usuários" passa a se chamar "Adm. de usuários e custos de IA".

## 6.10.71

- Início: removido o gesto de puxar a tela para baixo para atualizar (app instalado). Para atualizar o app, ficam o aviso "Nova versão disponível · Recarregar" e o menu.

## 6.10.70

- Assistente de pesquisas · Vídeo: a legenda do jw.org não traz a leitura dos textos bíblicos (o versículo aparece escrito na tela), e a transcrição pulava a leitura ("abra sua Bíblia em Hebreus 6:10. Diz assim:" e já seguia). Agora, quando um parágrafo termina com dois-pontos logo depois de citar um texto, o servidor põe em seguida o versículo da Tradução do Novo Mundo, entre aspas e com a referência (se ele já não vier na fala). Vale para vídeos com legenda (não para os transcritos pela IA). No JW Broadcasting de novembro, 5 leituras.

## 6.10.69

- Assistente de pesquisas · Vídeo: a transcrição de vídeos longos saía pela metade porque o texto da fala era cortado em 24 mil caracteres (o JW Broadcasting de novembro tem 41,6 mil). Agora o texto vem inteiro (até 160 mil caracteres); acima de 26 mil, a IA faz o resumo e os pontos com o texto todo e a transcrição em seções por partes de até 18 mil caracteres, ao mesmo tempo, juntadas na ordem. Parte que a IA não devolver inteira fica em texto simples, para nada da fala se perder.

## 6.10.68

- Itálico com sublinhado simples: a IA às vezes marca o itálico como _texto_ (Markdown) em vez de __texto__, e o "_" aparecia na transcrição de vídeos e nas respostas. Agora o app converte o simples em itálico de verdade na tela, ao copiar e no Word (Assistente de pesquisas e transcrição de Nossa vida cristã), sem mexer em nomes_com_sublinhado.

## 6.10.67

- Assistente de pesquisas · Novidades: fixos no topo, nesta ordem, o último Boletim do Corpo Governante (só enquanto tiver até 15 dias de publicado; depois entra na ordem de data) e o último programa mensal (sempre). Os demais seguem do mais novo para o mais antigo.

## 6.10.66

- Assistente de pesquisas · Vídeo: nova seção "🆕 Novidades", a primeira da lista, com os 40 vídeos de publicação mais recente no jw.org (do mais novo para o mais antigo). Abre a lista no painel como as outras e também serve para procurar por assunto só nos lançamentos; os vídeos continuam nas suas seções.

## 6.10.65

- Assistente de pesquisas · Vídeo: o programa mensal de novembro de 2026 não aparecia em "De Nosso Estúdio › Programas Mensais" porque está também em "Vídeos em Destaque" e o catálogo guardava cada vídeo numa só seção (a primeira lida). Agora um vídeo vale em todas as seções em que aparece (a seção mostrada no card é a que não é de destaque). O catálogo de vídeos passa a valer 6 h (antes 24 h), no servidor e no aparelho, para vídeos novos aparecerem no mesmo dia.

## 6.10.64

- Assistente de pesquisas · Vídeo: a lista dos vídeos de uma seção não aparece mais abaixo. No painel das seções, uma seção ou subseção de até 150 vídeos (marcada com ›) abre, dentro do próprio painel, a lista dos vídeos dela (com a duração), "Procurar na seção toda" e "Voltar às seções". Tocando num vídeo, só o card dele é montado abaixo, com "Usar este vídeo", "Assistir", JW Library e "Limpar o vídeo".
- Os cards de vídeo das pesquisas ganham "▶️ Assistir": o mesmo player das introduções aos livros da Bíblia, dentro do app (qualidade à escolha, link do jw.org no topo). O player passou a ser um só para qualquer vídeo do jw.org; um vídeo por vez, e ele para ao sair da tela.

## 6.10.63

- Assistente de pesquisas · Vídeo: ao escolher uma seção (ex.: A Bíblia › Criação), a lista dos vídeos dela aparece logo abaixo, cada um com "Usar este vídeo", jw.org e JW Library, para escolher um vídeo direto; quem não sabe o vídeo ainda escreve o assunto e procura só nessa seção. Seções com mais de 150 vídeos pedem uma subseção para listar. Nova tarefa do servidor "pesquisa-videos-da-secao" (sem IA, com o código de pesquisa).

## 6.10.62

- Assistente de pesquisas · Vídeo: o botão "Abrir os vídeos do jw.org" passa a se chamar "Abrir a seção de vídeos do jw.org".

## 6.10.61

- Assistente de pesquisas · Vídeo: a lixeira da busca de vídeos também volta a seção para "Todas as seções" (e desmarca a busca no que é falado).

## 6.10.60

- Barra de baixo: o botão 🔊 Leitura dá lugar ao 🔎 Pesquisas (Assistente de pesquisas), bloqueado sem o código de pesquisa como o atalho do Início. O Assistente de leitura em voz continua no Início e no menu.

## 6.10.59

- Assistente de pesquisas · Texto bíblico: o botão "Trocar o texto" passa a se chamar "🗑️ Excluir o texto" (vermelho claro, como os de limpar) e, além de tirar o texto escolhido, limpa o campo; a lixeira ao lado do campo também apaga o texto escolhido. Vídeo: nova lixeira ao lado da lupa da busca, que limpa o assunto e a lista de vídeos (também a guardada no aparelho). As etiquetas do livro e do capítulo na escolha guiada saem do laranja forte para o cinza claro.

## 6.10.58

- Assistente de pesquisas: rótulos e campos com espaço entre si (os rótulos depois da linha do texto bíblico e das palavras-chave ficavam colados); o campo do texto bíblico volta ao tamanho de letra dos outros (usava por engano a classe das referências sobrescritas) e fica na mesma altura dos botões ao lado.

## 6.10.57

- Assistente de pesquisas · Vídeo: os cards do retorno da busca de vídeos ficam com fundo cinza claro (os botões Usar este vídeo e jw.org ficam brancos para destacar; o JW Library segue roxo claro).

## 6.10.56

- Botões padronizados em todo o app: os que pedem texto à IA (pesquisa, resumo, respostas, esboços, formatação, correção, sugestões) com o mesmo azul claro, letra azul-escuro e moldura azul; os de gravação de áudio (gravar, pausar, parar, concluir, carregar gravação) em vermelho claro; os de limpar, descartar e apagar também em vermelho claro.

## 6.10.55

- Todos os botões de atalho para o JW Library (cartões das reuniões, texto diário, respostas, imagens da apostila, Anotações, Leitura da Bíblia e Assistente de pesquisas) ficam em roxo claro com a letra roxo-escuro; no cartão de Tesouros a letra aparecia quase apagada.

## 6.10.54

- Botões de ver o texto (Assistente de pesquisas) e de mostrar código ou senha (Ajustes → Acessos): o emoji do olho realista vira o olho só de linhas, o mesmo do botão Visualizar das Anotações; ao mostrar o código, o olho aparece riscado (no lugar do 🙈).

## 6.10.53

- Menos cor em todo o app: fundos só branco ou o cinza bem claro da tela Início. Os cards de escolha (Anotações, Reuniões, Bíblia e demais menus), a barra da semana, os títulos de grupos e subseções e os botões passam a cinza claro; a cor fica só na moldura fina e no texto. Os avisos de atenção seguem em laranja claro.

## 6.10.52

- Leitura em voz (todo o app): o servidor tira sublinhados, asteriscos, == e outros símbolos de formatação antes de mandar o texto à voz (ela lia "underscore"); a instrução padrão da voz também diz que símbolos ficam em silêncio.
- O recurso passa a se chamar "Assistente de leitura em voz" (menu, atalho, tela, Ajustes, extrato, Sobre e Privacidade).
- Extrato de créditos e consumo: o resumo mostra centavos e não quebra mais os valores; a linha do período fica alinhada; em vez de uma linha por consumo, um subtotal por recurso (e por tipo de crédito) que, tocado, abre os subtotais de cada dia; no fim, o saldo atual.
- Novo padrão visual suave em todo o app: só branco, cinza claro, azul claro, roxo claro, vermelho claro e laranja claro, com molduras finas na cor forte. Botões fortes viram claros (padrão cinza claro; esboços e pesquisas laranja; comentários e Sentinela roxo; dirigente e escolhas marcadas azul; gravar, desfazer e apagar vermelho). Verde e verde-água saem (viram azul ou cinza), inclusive nas mensagens de "pronto". Subseções e quadros com fundos chapados e claros.

## 6.10.51

- Todas as telas: os cartões ficam sem matiz (brancos no claro, a cor normal dos cartões no escuro); o do texto diário segue cinza claro. Os botões principais (antes azuis) passam a cinza-grafite (#4b5563; no escuro #64748b).

## 6.10.50

- Início: os botões de atalho passam do roxo suave ao cinza claro, e o cartão do texto diário ganha o mesmo cinza (no escuro, um cinza discreto).

## 6.10.49

- Início: os botões de atalho ganham um fundo roxo suave (no escuro, roxo discreto) e os ícones ficam uns 20% maiores.

## 6.10.48

- Início: os botões de atalho ficam sem cor de fundo (brancos no claro, a cor normal dos cartões no escuro); a borda colorida de cada um continua.

## 6.10.47

- Início: os cartões do texto do dia e dos atalhos ficam brancos, sem as cores (roxo e azul); no tema escuro, na cor normal dos cartões.

## 6.10.46

- Início: o cartão dos atalhos deixa o verde-água (tint-6) e passa ao azul (tint-1), no claro e no escuro.

## 6.10.45

- Pesquisa · Word: o nome NoteStyle do topo do documento fica maior (14 pt em vez de 8 pt, cinza mais escuro), em proporção com o logo, no arquivo e na prévia.

## 6.10.44

- Pesquisa · Word: o logo do NoteStyle fica na ponta direita da linha "NoteStyle" do topo do documento (no arquivo e na prévia), porque o visualizador do iPhone não mostra o cabeçalho do Word. Nesse documento o cabeçalho com o logo deixa de ir, para não repetir.

## 6.10.43

- Exportar para Word: o logo do NoteStyle aparece no cabeçalho do documento, do lado direito (1,3 cm), em todas as páginas.

## 6.10.42

- Nossa vida cristã: a transcrição do vídeo formatada pela IA (seções com emoji, negrito e itálico) aparecia como texto simples quando a gravação no aparelho falhava (armazenamento cheio): a tela só mostrava o que lia de volta do localStorage. Agora a formatada também fica na memória (por semana) e aparece mesmo se a gravação falhar.

## 6.10.41

- Anotações · Reunião: o campo Data fica mais fino (36 px de altura em vez de 46 px).

## 6.10.40

- Anotações · Reunião: o card "📋 Partes da Vida e Ministério" fica recolhível (abre recolhido). Ao tocar num tema, o card recolhe e a tela vai até o campo Tema / parte, que pisca para mostrar o tema preenchido.

## 6.10.39

- Anotações · Reunião: no quadro "Tema, orador e congregação", novo bloco "📋 Partes da Vida e Ministério". Escolha a semana nas setas (começa na semana da Data, ou na atual; mudar a Data muda a semana), toque em "Carregar discursos e considerações" e toque num tema para preencher Tema / parte. Lista: o discurso dos Tesouros, os discursos e considerações de Faça seu melhor e Nossa vida cristã (inclui Necessidades locais) e o Estudo bíblico de congregação, com o tipo, o tempo e a seção. Servidor: tarefa "anotacoes-partes-semana" (sem código, só lê os títulos da apostila no wol.jw.org; `partesDaApostila`/`lerPartesDaApostila` em `_wol.mjs`).

## 6.10.38

- Assistente de pesquisas: mesmo com "Buscar também na internet" marcada, a internet só é usada quando parte do assunto não está nas publicações do jw.org (fundo histórico, evidências arqueológicas, dados estatísticos ou científicos, mesmo que não pedidos, se enriquecerem a resposta). Assuntos puramente espirituais nunca vão para a internet. Quem decide é a primeira etapa da IA (campos "internet" e "internetBusca" das buscas; regra fixa no formato, visível na tela de prompts), que também diz o que procurar; a busca na internet procura só esses dados. Quando a internet é dispensada, um aviso sob o resultado explica.

## 6.10.37

- Assistente de pesquisas: "Buscar também na internet" e "Quero escolher as fontes" ficam dentro do quadro recolhível "⚙️ Opções adicionais de pesquisa" (título no padrão dos botões finos). Com o quadro fechado, o título mostra quantas opções estão ligadas. Na aba Vídeo o quadro some.

## 6.10.36

- Assistente de pesquisas, aba Vídeo: "Procurar também no que é falado nos vídeos" passa a funcionar em qualquer seção (o limite subiu de 80 para 700 vídeos). Medido: 110 vídeos em ~5 s; a maior seção (Programas e Eventos, 676 vídeos) em ~38 s. Seções como "De Nosso Estúdio › Discursos" (110 vídeos, sem subseções) ficavam bloqueadas.

## 6.10.35

- Assistente de pesquisas, aba Vídeo: a caixinha "🗣️ Procurar também no que é falado nos vídeos" só aparece depois de escolher uma seção específica e não fica mais deformada no celular (a regra geral de 44 px de altura dos campos esticava a caixinha; agora ela fica com 18 px, ao lado do texto, e a dica vai na linha de baixo).

## 6.10.34

- Corrigido: a caixinha "🗣️ Procurar também no que é falado nos vídeos" não aparecia na aba Vídeo (ao abrir a aba, o app escondia as opções da pesquisa comum — internet e escolha das fontes — e a escondia junto, por ter o mesmo estilo). Agora só as opções de baixo somem na aba Vídeo.
- Aba Vídeo, campo Seção: no lugar da lista nativa (toda branca), um botão que mostra a seção escolhida (com o emoji da seção) e abre um painel em forma de tabela: "🌐 Todas as seções" e cada seção principal com emoji (📜 A Bíblia, 🎒 Adolescentes, 🧸 Crianças, 🎙️ De Nosso Estúdio, 🎤 Entrevistas e Casos Reais, 👨‍👩‍👧 Família, 🎵 Músicas, 🏢 Nossa Organização, 🛠️ Nossas Atividades, 🗣️ Nossas Reuniões e Obra de Pregação, 🎬 Produções Especiais, 🎪 Programas e Eventos, 🎞️ Séries), título em destaque e fundo suave na cor dela; as subseções em linhas com traços discretos e o número de vídeos à direita; a escolhida marcada. Tocar fora fecha o painel.
- O ícone que reabre a lista de vídeos voltou a ser a setinha curva ↩️.

## 6.10.33

- Assistente de pesquisas, aba Vídeo: ao tocar em "✅ Usar este vídeo", a lista de vídeos se fecha. O botão largo "↩️ Escolher outro vídeo da lista" virou o ícone 🎞️ à direita do campo do link (aparece quando há uma lista guardada), que abre a lista de novo (com o vídeo em uso marcado) e, tocado outra vez, a fecha. Uma busca nova mostra a lista aberta.

## 6.10.32

- Assistente de pesquisas, "Procurar um vídeo por assunto": campo "Seção" com as seções e subseções de vídeos do jw.org e o número de vídeos de cada uma (lidas do catálogo ao abrir a aba Vídeo e guardadas no aparelho por 24 h; tarefa pesquisa-videos-secoes, sem IA). Com uma seção escolhida, a busca fica só nos vídeos dela.
- Nova caixinha "🗣️ Procurar também no que é falado nos vídeos", que vale com uma seção de até 80 vídeos (escolher uma subseção quando a seção é maior): o servidor lê as legendas dos vídeos da seção (de 10 em 10, guardadas 24 h na instância), procura as palavras no que é falado e põe primeiro os vídeos que falam do assunto, com os 2 trechos da fala de mais destaque e o tempo em que aparecem ("🗣️ 4:25 “…”"). A IA recebe os trechos e julga pelo conteúdo, não só pelo título, e diz no motivo o que é dito e quando. Com legendas de verdade, os 62 vídeos da seção Família foram lidos em menos de 4 segundos. A busca guardada volta com a seção e a caixinha.

## 6.10.31

- Assistente de pesquisas: o mês e o ano aparecem nas listas. Nos vídeos sugeridos, a data de publicação do vídeo no jw.org ("📅 julho de 2025 · ⏱️ 5:54 · Família"; o catálogo traz a data de todos os vídeos). Nas fontes das publicações (tela, escolha das fontes, prévia e Word), a edição tirada da citação: "w22.04" → abril de 2022, "w23 novembro" → novembro de 2023, "ws15 15/9" → setembro de 2015, "g 3/12" → março de 2012, revistas numeradas ("wp23.1", "g16.2") → N.º 1 de 2023; sem mês na citação, o ano; livros e artigos do site (cl, ijwbq…) ficam sem data.

## 6.10.30

- Assistente de pesquisas: a cor própria dos botões principais, da aba selecionada e das caixinhas passou do verde-azulado para laranja terracota (#c2410c) — nem azul nem verde, a pedido do usuário.

## 6.10.29

- Assistente de pesquisas com cor própria: os botões principais (Pesquisar, Transcrever e resumir o vídeo, 🔍, Usar este vídeo, Usar este texto, Elaborar a resposta…), a aba selecionada e as caixinhas usam verde-azulado (#0f766e), em vez do azul do resto do app.
- Aba Vídeo: "🔍 Procurar um vídeo por assunto" fica sempre à vista (não é mais um quadro recolhido), como o campo da aba Assunto; a lista de vídeos continua à vista depois de usar um, e "↩️ Escolher outro vídeo da lista" (sob o campo do link) rola a tela de volta até ela. Limpar a pesquisa mantém a lista de vídeos.

## 6.10.28

- Assistente de pesquisas, aba Vídeo: saiu o atalho experimental "🧪 Vídeos no JW Library" (no teste do usuário, o navegador do iPhone não entregou o endereço jwlibrary:/// ao app e mostrou "Não é possível acessar esse site"); fica só "🎬 Abrir os vídeos do jw.org". O botão "📖 JW Library" de cada vídeo (sugestões e fonte do resumo) passou a usar o link exatamente como o JW Library o compartilha (https://www.jw.org/finder?srcid=jwlshare&wtlocale=T&lank=…), que no celular com o app instalado abre o vídeo nele, numa aba nova.

## 6.10.27

- Assistente de pesquisas, aba Vídeo: cada vídeo sugerido pela busca por assunto ganhou o botão "📖 JW Library", que abre o vídeo no app pelo mesmo código que o JW Library usa ao compartilhar (lank=pub-… ou lank=docid-…); o "▶️ Assistir" virou "▶️ jw.org". O vídeo usado como fonte do resumo também tem o link do JW Library na lista de fontes. Na lista de sugestões, "✅ Usar este vídeo" ocupa a linha inteira e os dois links ficam embaixo, lado a lado.
- Atalho experimental "🧪 Vídeos no JW Library", ao lado de "🎬 Vídeos do jw.org": endereço provável da seção de vídeos do app (não há endereço documentado); fica se abrir a aba Vídeo do JW Library.
- Corrigido: na aba Vídeo, a página rolava para o lado no celular (a linha dos atalhos alargava o card); os blocos do card não passam mais da largura dele.

## 6.10.26

- O 🤖 deu lugar ao ✨ em todo o app: card "✨ Opções com IA" (Formatar), "✨ Modelos e agentes de IA" (Ajustes, e a dica da Leitura em voz que cita esse card), botão "✨ Organizar as perguntas com a IA" (Anotações), rodapé "✨ Esboço elaborado pela IA…" dos esboços e o título "✨ Sobre as respostas da IA" na página Sobre. O 🤖 continua só como emoji para inserir no texto (lista de caracteres).
- Assistente de pesquisas, aba Vídeo: o botão passou a se chamar "🎬 Transcrever e resumir o vídeo".

## 6.10.25

- Assistente de pesquisas, aba Vídeo: a busca de vídeos por assunto não se perde mais. A última busca (assunto e lista) fica guardada neste aparelho e volta ao abrir o app; depois de "Usar este vídeo", aparece sob o campo do link o botão "↩️ Escolher outro vídeo da lista “assunto” (N)", que reabre a lista; o vídeo em uso fica marcado ("✅ Em uso", com a borda em destaque) e a marca acompanha o link do campo. A busca mostra quantos vídeos foram encontrados.

## 6.10.24

- Assistente de pesquisas: no celular, o botão "✏️ Editar o texto" do resultado ocupa a largura do card; na linha de informações do resultado, o agente de IA aparece com ✨ (o símbolo dos botões de IA do app) em vez do 🤖.

## 6.10.23

- Assistente de pesquisas, "Procurar um vídeo por assunto": sem número fixo de sugestões — entram todos os vídeos relevantes (podem ser menos ou mais de 5; no máximo 20, para a lista não ficar enorme). A IA é orientada a marcar todos os relevantes, inclusive os de temas ligados ao assunto (para "grande tribulação": Armagedom, últimos dias, Babilônia, a Grande), e os vídeos com uma palavra rara do próprio assunto digitado no título entram sempre, depois dos dela.
- A busca no catálogo ficou mais estável: cada palavra vale pelo quanto é rara nos títulos dos vídeos (em "grande tribulação", "grande" quase não conta e "tribulação" decide), adjetivos comuns ("grande", "novo", "maior"…) valem pouco, um título com todas as palavras de uma busca vale o dobro e a IA recebe até 60 candidatos (eram 40). Antes, a palavra "grande" enchia a lista de vídeos sem relação ("grande privilégio", "Grande Instrutor") e o resultado mudava muito de uma busca para outra (5 vídeos numa, 2 na seguinte).

## 6.10.22

- Assistente de pesquisas, aba Vídeo: corrigido "Cole o link de um vídeo do jw.org" com um link certo. O servidor só reconhecia códigos de vídeo sem hífen (pub-jwbai_…), e muitos vídeos têm hífen no código (pub-jwb-128_7_VIDEO, a maior parte dos programas do JW Broadcasting) ou não têm número de faixa (pub-wys_x_VIDEO, lidos pelo mediator). Agora os 3.051 vídeos do catálogo do jw.org são reconhecidos (conferido com o catálogo inteiro). A mesma correção vale para os vídeos citados na Nossa vida cristã.

## 6.10.21

- Assistente de pesquisas, aba Vídeo: atalho "🎬 Abrir os vídeos do jw.org" (a página de vídeos do site, numa aba nova).
- Assistente de pesquisas, aba Vídeo: "🔍 Procurar um vídeo por assunto" (recolhido). O servidor lê o catálogo público de vídeos do jw.org (as categorias de Vídeos e os vídeos de cada uma: cerca de 3 mil, guardados por 24 h); a IA da pesquisa transforma o assunto em palavras de busca, o servidor separa até 40 vídeos pelo título e pela categoria e a IA escolhe até 5, com uma frase dizendo como cada um ajuda (sem a IA, ficam os primeiros da busca). Cada sugestão mostra o título, a duração e a categoria, com "✅ Usar este vídeo" (põe o link no campo, pronto para "Resumir o vídeo") e "▶️ Assistir" (abre no jw.org). Tarefa pesquisa-videos (código de pesquisa; conta no recurso do Assistente de pesquisas); prompt novo "Assistente de pesquisas: sugerir vídeos do jw.org por assunto" e o formato fixo.

## 6.10.20

- Assistente de pesquisas, fase 7: a aba 🎬 Vídeo está pronta. O usuário cola o link de um vídeo do jw.org (o de Compartilhar → Copiar link, com lank=…, ou o endereço da página de vídeos) e, se quiser, o que quer saber do vídeo; o botão vira "🎬 Resumir o vídeo" (as opções da internet e da escolha das fontes somem nessa aba). O servidor pega o texto da fala publicado pelo jw.org (legenda AIVTT ou a comum); sem legenda, e com um modelo Gemini escolhido para o vídeo em Ajustes, manda o menor arquivo do vídeo (até 12 MB) para a IA ouvir e transcrever (o app avisa). A IA do vídeo faz o resumo (que responde à pergunta, se houver), os pontos principais e a transcrição inteira em seções com título, emoji e destaques, sem mudar as palavras (o servidor confere se pelo menos 85% delas continuam; senão fica o texto simples). O resultado entra no card das pesquisas: o resumo, "📌 Pontos principais", a transcrição num quadro recolhido ("🎬 Transcrição do vídeo") e o vídeo como fonte (título, duração, de onde veio o texto e o link); cópia, prévia, Word (com a transcrição inteira), edição e salvar funcionam como nas outras abas, e a pesquisa salva reabre na aba Vídeo. Tarefa pesquisa-video (código de pesquisa; conta no recurso do Assistente de pesquisas; resultado guardado se a conexão cair). Prompts novos "Assistente de pesquisas: vídeo" e "transcrever um vídeo sem legenda" e o formato fixo.

## 6.10.19

- Assistente de pesquisas, fase 5: botão "✏️ Editar o texto" no resultado. O título e o texto ficam editáveis e aparece a barra "🎨 Formatação", no padrão da tela de Anotações: 𝐁 negrito, 𝐼 itálico, Grifo (fundo amarelo), • Lista, 1. Lista, AA (maiúsculas no trecho), os números 1️⃣ a 7️⃣ e os modelos prontos ✅ Aplicar 👉 e 🎯⚡️⚡️ IMPORTANTE 👉. A formatação é de verdade (sem letras Unicode), porque vai para o Word: o grifo sai com o fundo amarelo no arquivo. Os números das fontes ficam protegidos (não se apagam ao editar o texto em volta). "✅ Concluir a edição" passa o texto editado para a pesquisa (títulos de seção abrem uma seção nova; listas viram parágrafos com • ou 1.): a cópia, a prévia, o Word e a lista de fontes usam a versão editada, e a pesquisa já salva é atualizada.

## 6.10.18

- Assistente de pesquisas: corrigido — as fontes da internet não chegavam à IA. A busca na internet funcionava (no registro do servidor, a pesquisa do Dia dos Pais achou 6 páginas), mas elas vinham no fim da lista e o limite de 30 fontes as cortava quando o wol já trazia mais de 30. Agora as páginas da internet (até 6) têm o lugar garantido, no servidor e na coleta, e o que sobra das publicações sai do fim da lista (a pesquisa no wol, a menos certeira). A regra fixa das fontes da internet também diz que, quando o assunto ou o contexto pede um fato histórico ou atual (como a origem de uma data comemorativa), esse ponto é respondido na seção 🌐 Informações complementares.
- Assistente de pesquisas: o botão 📝 Word abre a prévia da página no padrão do Word, a mesma página em tela cheia dos esboços (A− e A+ para o tamanho da letra; Exportar para Word e Compartilhar no alto); o arquivo sai com o tamanho escolhido.
- Assistente de pesquisas: a opção de escolher as fontes ganhou o ícone 🤔.

## 6.10.17

- Ajustes gerais: novo card "📝 Formatação das notas JW", com os cards "🗂️ Gerenciar modelos e categorias" e "😀 Caracteres, ícones e emoticons" dentro dele.
- Assistente de pesquisas, fase 6: opção "🌐 Buscar também na internet (fontes externas confiáveis)", desmarcada por padrão e lembrada neste aparelho. Marcada, junto com a busca no wol o servidor pesquisa na internet com a IA da busca na internet (Ajustes → Modelos e agentes de IA; Gemini: busca do Google; Claude: busca na web), com a lista de sites de Ajustes como preferência (não como filtro): dados históricos, estatísticas oficiais, relatórios e notícias. Cada página vira uma fonte com o site, o título e o endereço (até 6), por último na lista, marcada "🌐 Fonte externa (internet): não é publicação das Testemunhas de Jeová"; na escolha das fontes dá para desmarcá-las. Regra fixa nova: a IA usa as fontes da internet só numa seção final "🌐 Informações complementares", nunca para explicar a Bíblia. Se a busca falhar ou não achar nada, a pesquisa segue só com as publicações e um aviso aparece sob o resultado. Prompt novo "Assistente de pesquisas: busca na internet"; a tarefa pesquisa-internet conta no recurso do Assistente de pesquisas.

## 6.10.16

- Assistente de pesquisas, fase 4: opção "Quero escolher as fontes antes da resposta" (sobre o botão Pesquisar, desmarcada por padrão e lembrada neste aparelho). Marcada, depois da busca aparece o card "📚 Fontes encontradas": cada fonte com uma caixinha marcada, a publicação, a marca de onde veio (notas de estudo do versículo, Guia de Pesquisa, Índice das Publicações, pesquisa no wol ou livro do servidor), as primeiras linhas do trecho ("ver tudo" mostra o trecho inteiro que vai para a IA) e o link do wol; Marcar todas / Desmarcar todas; "✍️ Elaborar a resposta (N fontes)" manda à IA só as marcadas; ✕ cancela. Desmarcada, a IA decide sozinha com todas as fontes, como antes.

## 6.10.15

- Assistente de pesquisas, fase 3: a aba 📖 Texto bíblico está pronta. O texto é escolhido como nas Anotações: digita-se o livro (com sugestões) ou toca-se em 📚 para escolher livro › capítulo › versículos (toque escolhe ou tira; toque longo faz o trecho corrido); 👁️ mostra o texto (Tradução do Novo Mundo, com os números dos versículos) e o botão 📖 JW Library abre o trecho no app; "Usar este texto" fixa o texto no card (✏️ Trocar o texto volta à escolha). Depois, até 3 palavras ou frases-chave (o campo seguinte aparece quando o anterior é preenchido) e o assunto ou contexto, ambos opcionais. Busca do texto com o código de pesquisa (tarefa pesquisa-versiculos, sem IA).
- Servidor: no modo Texto bíblico, para cada versículo (até 6) o servidor lê a página de pesquisa do wol: as notas de estudo da Tradução do Novo Mundo (o entendimento atual) e as citações do Índice das Publicações 1991-2026 para o versículo (até 10, intercalando os versículos, as mais recentes primeiro, no máximo 2 do Perspicaz e 2 trechos do mesmo artigo). O Guia de Pesquisa, o Índice de assuntos e a pesquisa no wol completam (até 4, 4 e 6), com as palavras-chave e o contexto. Prompt novo "Assistente de pesquisas: resposta sobre um texto bíblico" (entendimento mais atualizado, aplicações práticas já publicadas e foco nas palavras-chave e no contexto). Palavras comuns demais ("vida", "Deus"…) não escolhem sozinhas um tópico do Guia ou um assunto do Índice. Corrigida a sigla perdida em citações com vários números ("it-2 79, 425, 428").
- A resposta (na tela e no Word) começa pelo texto bíblico, numa faixa com a linha de destaque; o Word traz também o texto bíblico, as palavras-chave e o contexto no cabeçalho. A pesquisa salva reabre na aba Texto bíblico com o texto, as palavras-chave e o contexto.

## 6.10.14

- Assistente de pesquisas: novo botão 📝 Word, que gera a pesquisa num arquivo .docx com negrito e itálico de verdade (sem letras Unicode), os números das fontes em sobrescrito, o título, a data da pesquisa, o agente de IA, o assunto e o contexto, as seções com emoji, a conclusão destacada e a lista de fontes (com a marca do Guia de Pesquisa ou do Índice e o endereço no wol.jw.org); no topo, o nome NoteStyle pequeno e discreto, separado por uma linha (só no arquivo). No celular abre o compartilhamento; no computador, baixa o arquivo.
- Assistente de pesquisas: os botões do resultado ficam os quatro numa linha só, ocupando a largura: Copiar e Word dividem o espaço; Salvar (💾, vira ✅ depois de salvo) e Limpar (🗑️) só com o ícone. Duas fontes seguidas aparecem com vírgula entre os números.

## 6.10.13

- Assistente de pesquisas: o Índice das Publicações da Torre de Vigia 1991-2026 (índice de assuntos, no wol) entrou como fonte primária, junto com o Guia de Pesquisa. O servidor lê só as letras iniciais das palavras da pesquisa, acha os assuntos (até 2), escolhe as citações dos subtópicos que mais combinam com o assunto, o contexto e as buscas (as mais recentes no empate; "casos reais" e histórias de vida um pouco abaixo; sem o Perspicaz, que já vem à parte, sem a apostila e sem publicações de antes de 1990) e lê o trecho exato de cada citação (até 8, no máximo 2 do mesmo artigo, sem repetir os do Guia). Nas fontes: "🗂️ Indicada no Índice das Publicações: assunto › subtópico"; a IA dá preferência a elas e às do Guia.
- Assistente de pesquisas: o nome das publicações vem da lista oficial de abreviações do wol (102 siglas, lida e guardada por 24 h; ex.: w = A Sentinela (edição de estudo), scl = Princípios Bíblicos para a Vida Cristã), com a lista interna como reserva.

## 6.10.12

- Assistente de pesquisas: o Guia de Pesquisa para Testemunhas de Jeová (o atualizado, do jw.org) entrou como fonte primária. O servidor acha os tópicos do assunto (até 2, ex.: "Ansiedade", "Perdão (perdoar outros)") e lê no wol os artigos que o Guia indica (até 8, intercalando os tópicos, na ordem do Guia, no máximo 3 por subtítulo): a faixa de parágrafos que o Guia marca, os parágrafos pelo número da citação ("pág. 15 par. 7") ou, sem isso, o parágrafo com mais palavras da busca. Fora os vídeos, as ligações "Veja", a apostila e as publicações de antes de 1990. Nas fontes, essas matérias levam a marca "📑 Indicada no Guia de Pesquisa: tópico › subtítulo", e a IA dá preferência a elas. Lista de tópicos e páginas guardadas por 24 h na instância.
- Assistente de pesquisas: nas fontes, o nome de um livro do servidor (Estudo Perspicaz, Princípios Bíblicos, Adoração Pura, Reino de Deus) abre e fecha o trecho inteiro usado na pesquisa; esse trecho fica guardado com a pesquisa salva (as matérias do wol continuam só com o link).

## 6.10.11

- Assistente de pesquisas: durante a pesquisa, além do ícone girando, um contador de tempo (⏱️ 0:42) conta desde o toque em Pesquisar, nas duas etapas.
- Assistente de pesquisas: o botão Pesquisar mostra, em letra pequena, a IA da pesquisa (buscas) e a da resposta final, com o esforço (o servidor informa os modelos escolhidos em Ajustes, pela leitura pública ia-publica).
- Assistente de pesquisas: os campos "O que você quer pesquisar?" e "Contexto ou foco" começam com uma linha e crescem com o texto digitado, sem barra de rolagem.

## 6.10.10

- Assistente de pesquisas: corrigido "Código de pesquisa inválido" mesmo com o código salvo (o app não mandava o código nos pedidos da pesquisa).
- Assistente de pesquisas: as abas Assunto, Texto bíblico e Vídeo ficam sempre numa linha só, dividindo a largura (o "em breve" vai embaixo, pequeno); o botão Pesquisar ocupa a largura toda do card.

## 6.10.09

- Início → atalhos: saiu o atalho do Estudo Bíblico (continua em Comentários → Preparar para comentar). O 🔎 Assistente de pesquisas foi para a página 1, no lugar do Backup do JW Library, que passou para a página 2 (no lugar do Estudo Bíblico). A página 3 dos atalhos deixou de existir: voltam a ser duas páginas de 8.

## 6.10.08

- Novo: 🔎 Assistente de pesquisas (fase 2 do plano), com atalho no Início (página 3 dos atalhos) e item no menu; só com o código de pesquisa. Aba Assunto: o usuário escreve o assunto e, se quiser, o contexto ou foco. A IA da pesquisa (leve) prepara as buscas; o servidor pesquisa no wol.jw.org (cada matéria é aberta com a busca, para achar o parágrafo exato, a página e o número dele; ficam fora a apostila, os índices e as publicações de antes de 1990, com prioridade para as mais novas), nos verbetes do Estudo Perspicaz e nos livros do servidor (Princípios Bíblicos e os outros). A IA da resposta final escreve a pesquisa só com essas fontes (título, introdução, seções com emoji, aplicações práticas e conclusão), com negrito e itálico de verdade e cada informação ligada à fonte por um número; no fim, a lista de fontes com publicação, edição, título, página e parágrafo e os links para o wol.jw.org e o JW Library. Mostra a data e o agente de IA usado. Botões finos: Copiar (com formatação, e em texto simples com *negrito* e _itálico_ para mensagens), Salvar (no banco deste aparelho, em "🗂️ Pesquisas salvas", logo abaixo) e Limpar. As abas Texto bíblico e Vídeo aparecem como "em breve".
- Ajustes → Modelos e agentes de IA: nova seção "🔎 Assistente de pesquisas" com o modelo de cada etapa (Pesquisa/buscas, Busca na internet, Resposta final com o esforço, Vídeo), de qualquer família, independente do provedor do uso geral; padrões todos Gemini (3.5 Flash nas etapas leves e 3.1 Pro com esforço médio na resposta final), o Claude só se o administrador escolher. Lista editável de sites de preferência da busca na internet (um por linha, com "Voltar à lista padrão"). Salvar a configuração agora grava por cima da atual (um campo que a tela não mandar não volta ao padrão).
- Servidor: tarefas pesquisa-coletar e pesquisa (código de pesquisa; novo recurso "Assistente de pesquisas" no faturamento); a resposta final é guardada para ser recuperada se a conexão cair. Prompts novos na categoria "🔎 ASSISTENTE DE PESQUISAS" (buscas e resposta final) e os dois formatos fixos.

## 6.10.07

- Anotações → Reuniões congregacionais: o card "👤 Tema, orador e congregação" abre sempre recolhido e ficou mais fino (menos espaço em cima e embaixo, título um pouco menor).

## 6.10.06

- Nossa vida cristã → Transcrição do vídeo: o texto vem em parágrafos, separados pelas pausas do vídeo (trocas de cena, pelos tempos da legenda), em vez de tudo emendado. Ao abrir o quadro (uma vez por semana), a IA divide a fala em seções com título e emoji e marca negrito, itálico e MAIÚSCULAS, sem mudar as palavras (o servidor confere se pelo menos 90% das palavras continuam lá); o app mostra com negrito e itálico de verdade (HTML, sem letras Unicode) e guarda neste aparelho. Sem conexão ou se falhar, fica o texto em parágrafos.
- Servidor: tarefa nvc-transcricao (código de pesquisa; conta no recurso do Estudo Bíblico), guardada por 7 dias na instância. Prompt novo "Transcrição do vídeo da Nossa vida cristã (formatação)" e o formato fixo.

## 6.10.05

- Nossa vida cristã: a transcrição do vídeo (o texto da fala publicado pelo jw.org) fica no card, num quadro discreto "Transcrição do vídeo" — título pequeno, fino e cinza, recolhido por padrão, logo abaixo da linha do vídeo. O servidor passou a mandar o texto na leitura da parte; o que foi lido antes desta versão é lido de novo sozinho.

## 6.10.04

- Preparar para comentar → Reunião de meio de semana: novo card "🎬 Nossa vida cristã", depois de Faça seu melhor no ministério. Lê a parte da seção com vídeo e perguntas (ex.: "Mostre o VÍDEO Ajudar os Inativos. Depois, pergunte: …"): matéria, imagem, publicações citadas e o TEXTO DA FALA DO VÍDEO, que o jw.org publica pronto (arquivo AIVTT da lista de arquivos do vídeo ou, na falta, a legenda) — sem transcrever áudio. O card mostra o vídeo (título, duração, se há texto) e as perguntas; sem a parte, mostra o aviso.
- "💬 IA - Resumir o vídeo e responder às perguntas": no modelo do Estudo Bíblico — instrução da parte, "🎬 RESUMO DO VÍDEO" e as respostas baseadas no vídeo, na matéria e na imagem (enviada à IA), com copiar e JW Library. A resposta fica salva e volta ao abrir o card. Sem texto do vídeo, a IA responde com a matéria e a imagem e avisa.
- Faça seu melhor no ministério e Nossa vida cristã passaram a usar o mesmo código (no app e no servidor). Servidor: tarefas nvc-ler (sem IA) e nvc (código de pesquisa; conta no recurso do Estudo Bíblico). Prompt novo "Respostas da Nossa vida cristã (parte com vídeo)" e o formato fixo.

## 6.10.03

- Barra de baixo (iPhone), estado "topo preso" (offsetTop 68 com pageTop = rolagem): nesse estado o iOS corta o que é fixo abaixo de 826 (descida, a barra ficava cortada; sem descer, flutuava 68 acima do fim). Agora o app primeiro pede ao iOS que refaça a conta (rola 1 px e volta, no máximo a cada 4 s); se continuar preso, a barra sai da camada fixa e fica na própria página, no fim da área visível (atualizada a cada rolagem), com o espaço dela reservado no fim da página. Quando o estado passa, volta ao normal.
- Diagnóstico: linha "ajuste:" com o modo da barra (normal ou na página), quantos recálculos foram pedidos e quantas vezes ela foi para a página.

## 6.10.02

- Faça seu melhor no ministério: a resposta salva da semana volta sozinha ao abrir o card (como no Estudo Bíblico), com a linha "💾 Resposta salva · … · data". Gerar de novo na mesma semana substitui a resposta salva anterior (antes ficavam várias). Ao fechar o card, a resposta sai do campo, como nas outras matérias.

## 6.10.01

- Preparar para comentar: ao abrir uma ferramenta (Tesouros, Estudo Bíblico, A Sentinela…), o contêiner dela (Reunião de meio de semana / do final de semana) deixa de aparecer como card — sem borda, fundo, espaço interno nem título —, e a ferramenta ocupa a largura toda. Ao fechar, o contêiner volta.

## 6.10.00

- Preparar para comentar → Reunião de meio de semana: o Estudo Bíblico passou para depois de Imagens da apostila (ordem: Tesouros, Faça seu melhor no ministério, Imagens da apostila, Estudo Bíblico).

## 6.9.99

- Faça seu melhor no ministério: saiu a mensagem laranja "Esta semana não tem a parte de consideração." que aparecia embaixo ao recarregar uma semana sem a parte e ficava na tela mesmo depois de ir para uma semana com consideração (o aviso já fica no próprio card). Ao trocar de semana, a mensagem de status do card é limpa.

## 6.9.98

- Preparar para comentar: as ferramentas ficam em dois contêineres com título — "📅 Reunião de meio de semana" (Tesouros, Faça seu melhor no ministério, Estudo Bíblico e Imagens da apostila) e "📖 Reunião do final de semana" (Estudo de A Sentinela). Com uma ferramenta aberta, as outras e o contêiner sem nenhuma aberta somem, como antes.
- Faça seu melhor no ministério: saiu a frase "A IA executa a instrução da parte…" antes das perguntas.

## 6.9.97

- Preparar para comentar: o card "Faça seu melhor no ministério" fica sempre na tela. Nas semanas sem a parte de consideração, mostra "Esta semana não tem consideração" com a explicação (como o discurso curto), e o botão da IA fica travado; o Recarregar continua disponível.

## 6.9.96

- Preparar para comentar: nova ordem dos cards — Tesouros da Palavra de Deus, Faça seu melhor no ministério (quando a semana tiver a consideração), Estudo Bíblico e Estudo de A Sentinela (Imagens da apostila continua no fim). A descrição do grupo acompanha a ordem.

## 6.9.95

- Faça seu melhor no ministério (consideração): a IA também executa a instrução da parte (ex.: "Faça um resumo da lmd lição 1 ponto 4b" → o resumo do ponto), num item próprio antes das perguntas ("📋 INSTRUÇÃO DA PARTE 👉 …").
- A matéria citada vai inteira para a IA: o trecho indicado (o ponto) e a lição toda, para o contexto (com o ponto marcado). O resumo e as respostas levam em conta a matéria citada e o restante da parte (tipo de testemunho, imagem e as outras perguntas). Prompt e formato atualizados.

## 6.9.94

- Preparar para comentar → novo card "🗣️ Faça seu melhor no ministério": aparece só nas semanas em que essa seção da apostila tem uma parte de "Consideração" (ex.: "6. O que você diria?"). Ao abrir Preparar para comentar, o app pergunta ao servidor (leitura sem IA, guardada por semana) e mostra o card com a parte, a instrução e as perguntas.
- "💬 IA - Responder às perguntas": respostas no mesmo modelo do Estudo Bíblico (mesmas opções de tamanho, formatação e textos bíblicos, Outra resposta e Melhorar, botão de copiar e do JW Library em cada uma), cada uma com a pergunta acima. O servidor lê a lição citada (lmd) e manda à IA a própria imagem da parte: quando a pergunta fala da imagem, a resposta sai do que ela mostra.
- Servidor: tarefas consideracao-ler (sem IA) e consideracao (código de pesquisa; conta no recurso do Estudo Bíblico). Prompt novo "Respostas da consideração de Faça seu melhor no ministério" (editável, na categoria Comentários) e o formato fixo correspondente.

## 6.9.93

- Formatar → Outras opções → Modelos prontos e personalizados: tocar num modelo sempre o insere no texto original, na posição do cursor. Antes, se o campo tinha perdido o foco (no celular, sempre perde ao tocar no botão), o toque abria o modelo para edição em Ajustes.

## 6.9.92

- Barra de baixo (iPhone): removida a correção para cima da 6.9.89. Com o topo 0 e a área visível informada com 826 (a tela mostrava os 894), a barra era puxada 68 para cima e ficava travada no alto, com conteúdo embaixo dela. Agora a barra só desce, como na 6.9.80.

## 6.9.91

- Barra de baixo (iPhone): o iOS às vezes informa o topo da área visível "preso" em 68 enquanto o pageTop mostra deslocamento zero; a barra descia 68 e ficava cortada embaixo. Agora vale o menor entre os dois (offsetTop e pageTop − rolagem). O diagnóstico mostra o "topo usado".

## 6.9.90

- Anotações (gravação): quando o microfone cai (no iPhone acontece ao trocar de tela ou voltar de outro app), a gravação continua sozinha. O trecho gravado até ali fica guardado nas gravações do discurso, o novo começa na hora, o relógio segue e, no resumo, todos os trechos vão juntos, na ordem. O sistema confere a cada meio segundo se o gravador parou, se o microfone foi encerrado, se ficou mudo por mais de 3 s ou se o áudio parou de chegar há 6 s.
- Fora da tela Anotações aparece um aviso vermelho "🔴 Gravando 00:00 · Voltar" acima da barra de baixo; tocar nele volta para a gravação.
- Descartar apaga também os trechos guardados nas quedas do microfone.

## 6.9.89

- Barra de baixo (iPhone): quando ela fica abaixo do fim da área visível (escondida), a correção também a puxa para cima, até o fim da área visível (antes só descia).
- Diagnóstico (tocar na versão no Menu): registra as 3 últimas vezes em que a barra saiu da área visível, com as medidas do momento.

## 6.9.88

- Anotações: os campos das anotações e da resposta da recapitulação crescem com o texto, como o campo da tela Formatar (a altura mínima continua como piso), inclusive quando o texto muda por código (trocar de discurso, resumo, formatação).

## 6.9.87

- Anotações: card do orador um pouco afastado do card do tema.

## 6.9.86

- Anotações → Transcrições na íntegra: botão "☁️ Buscar no servidor" um pouco mais abaixo e na largura toda.
- Anotações: o horário, a seção e o número da parte ("10:00 · Manhã · Parte 1 de 12") passaram para dentro do card do tema, logo abaixo dele.

## 6.9.85

- Anotações (programa): "Registre a data da sua assembleia" passou a "Registre os dados da sua assembleia" (ou do congresso), com os campos Data, Cidade e Local; cidade e local ficam guardados com o evento e aparecem na linha de resumo.

## 6.9.84

- Anotações (programa): saíram os botões "Ver anotações" e "Atualizar programa"; "Exportar anotações" foi para o fim da lista dos discursos.
- Anotações (programa): "Perguntas de recapitulação" ficou recolhível, fechada por padrão.

## 6.9.83

- Anotações: os campos do orador e da congregação abrem dentro do próprio card fininho do orador.

## 6.9.82

- Ajustes → Modelos e agentes de IA: os ajustes (contas, modelos, testar, salvar) ficam direto no card principal, sem o card interno "Escolher contas e modelos".

## 6.9.81

- Anotações: o nome do orador fica num card fininho, da largura da página.
- Anotações: a transcrição na íntegra de cada gravação resumida é guardada no aparelho e no servidor (Blob privado, por aparelho; `api/_transcricoes.mjs`, ações `transcricao-salvar`, `transcricoes-listar`, `transcricao-ler` e `transcricao-apagar` em `api/transcrever.mjs`, sem gastar crédito). Card "📜 Transcrições na íntegra" com ler, copiar, pôr nas anotações, apagar e buscar no servidor; as que não subiram são reenviadas ao abrir a lista.
- Ajustes → Áudio em texto: configurações: novo card "🎚️ Qualidade da gravação nas Anotações" (64, 96, 128 ou 192 kbps; padrão 128) e opção do tratamento de voz do aparelho (padrão desligado; antes o microfone gravava com eco/ruído/ganho automático de ligação, a 64 kbps).
- Ajustes → Modelos e agentes de IA: card "Definições em vigor" removido; em "Escolher contas e modelos" o nome da opção escolhida aparece inteiro, quebrando a linha.

## 6.9.80

- Barra de baixo (iPhone): no quique do fim ou do começo da página a correção da 6.9.78 não age mais, então a barra não é empurrada para fora da tela. Quadro de diagnóstico mantido por enquanto.

## 6.9.79

Anotações: os botões de formatação da **resposta da recapitulação** ficaram alinhados como os das anotações (as linhas não se sobrepõem mais e “1. Lista” não quebra em duas linhas), e as molduras de formatação ficaram com menos espaço antes e depois.

## 6.9.78

Correção (iPhone): a barra de baixo descolando da base. O diagnóstico num iPhone com **iOS 18.7** mostrou a causa: o aparelho às vezes desloca a área visível (altura de referência 894, área visível 826 começando 68 abaixo) e a barra fica presa ao fundo errado, com um vão embaixo que, em certos momentos, cresce até o meio da tela. A compensação agora compara o fundo da barra com o **fundo da área visível de verdade** e desce a barra exatamente a diferença (ao rolar, ao mudar a área visível e a cada segundo); com o teclado aberto não mexe. A conta antiga comparava com a altura de referência e dava zero nesse caso.

## 6.9.77

Diagnóstico da barra de baixo (iPhone): tocar no texto da versão, no fim do Menu, abre um quadrinho no alto da tela com as medidas que o aparelho informa ao vivo (tamanho da tela, área visível, rolagem e posição da barra). Serve para achar a causa da barra que sobe para o meio da tela; tocar no quadrinho o fecha.

## 6.9.76

Anotações: a moldura **🎨 Formatação** ficou mais afastada do título “Anotações” (acima) e do campo de texto (abaixo).

## 6.9.75

Anotações: a linha do orador (e o campo para informar orador e congregação) usa o ícone 🧑‍💼 (pessoa de terno e gravata) no lugar do microfone, também no programa.

## 6.9.74

Anotações (assembleia e congresso):

- **Tocar no discurso abre direto a anotação.** No programa, o toque no tema não abre mais o quadro de orador/congregação: vai direto para a tela de anotações do discurso.
- **Orador e congregação dentro da anotação:** um campo logo abaixo do tema do discurso. Fica **aberto enquanto o orador não for informado**; depois de preenchido, **recolhe sozinho** e mostra só uma linha discreta (“🎤 Nome · Congregação”), que reabre ao tocar (ou ao tocar no card do tema). No programa, o orador aparece pequeno embaixo do tema.
- **Botões de formatação numa moldura recolhível** (“🎨 Formatação”), nas anotações e na resposta da recapitulação; aberta ou recolhida, a escolha fica guardada no aparelho.

## 6.9.73

Correção (iPhone/iPad, iOS 26): a barra de baixo **continuava subindo para o meio da tela** ao rolar, mesmo longe do fim da página (o elástico não era a causa). No iOS 26 as barras “fixas” (`position: fixed`) são desenhadas fora do lugar, sem que o app consiga medir o erro. Agora, no iPhone e no iPad, a barra deixou de ser “fixa” e passou a ser **“grudada” no fim da página** (`position: sticky`), que anda junto com a rolagem e não tem essa falha; o corpo da página ocupa a altura da tela, para a barra ficar embaixo mesmo com pouco conteúdo. No computador e no Android nada muda.

## 6.9.72

Correção (iPhone, iOS 26): a **barra de baixo subia para o meio da tela ao rolar até o fim** de uma página longa. É uma falha do próprio iOS 26 (relatada como corrigida no 26.1): puxar a página além do fim (o “elástico”) arrasta a barra fixa. Agora o elástico fica desligado **só no fim da página**; no topo ele continua, e o puxar para atualizar do Início também. Campos e listas que rolam por dentro e os gestos para o lado (páginas dos atalhos) não mudam.

## 6.9.71

Correção: um **emoji de número (1️⃣ a 7️⃣) num trecho em negrito, itálico ou grifo virava “1□”** no iPhone (o dígito passava para negrito e o aparelho não desenha a moldura em volta dele). Agora as formatações deixam os emojis de número intactos, e as anotações já estragadas são consertadas sozinhas ao abrir o discurso (e ao passar para maiúsculas).

## 6.9.70

Correção (iPhone): a **barra de baixo** (Início, Anotações, Leitura…) às vezes ficava **flutuando no meio da tela** depois de fechar o teclado (visto na tela Gravar), com o conteúdo aparecendo embaixo dela. Agora a barra acompanha a área visível de verdade e, ao sair de um campo, o app pede ao iPhone que refaça o cálculo da tela. Com a tela normal, nada muda.

## 6.9.69

Correção: a **leitura em voz alta do texto diário parava** no meio (“Esse trecho não faz parte do texto do dia…”) quando o texto tinha um endereço como **jw.org**. O app cortava a frase no ponto de “jw.org” e a remontava como “jw. org”, e o trecho deixava de bater com o texto autorizado. Agora um ponto colado entre letras ou números não divide a frase (vale também para a tela Leitura em voz alta), e o servidor aceita diferenças só de espaços.

## 6.9.68

Anotações (campo das anotações e campo da resposta da recapitulação):

- **Números 1️⃣ a 7️⃣:** uma linha de botões logo abaixo de Negrito/Itálico; cada um insere o número no cursor, no começo de uma linha nova (o teclado não fecha ao tocar).
- **AA (maiúsculas):** passa o trecho selecionado para MAIÚSCULAS; sem seleção, passa o texto todo do campo (com confirmação). Letras em negrito, itálico ou grifo continuam no mesmo estilo.

## 6.9.67

Anotações: **opções adicionais da gravação** (⚙️, discretas no fim do quadro da gravação, guardadas no aparelho e **ligadas por padrão**):

- **✨ Resumo automático ao parar:** ao tocar em ⏹️ Parar, a gravação é guardada no discurso e o resumo já vai para a fila; o quadro fecha. Desligada, vale o botão ✨ Resumo, como antes.
- **⏭️ Avançar gravando:** as setas ◀ ▶ do discurso passam a funcionar durante a gravação: a gravação do discurso atual é parada e guardada nele (e resumida, com a opção acima) e a do próximo começa sozinha. Desligada, continua o aviso “Pare a gravação antes de mudar de parte”.
- **🛟 Gravação salva aos poucos (sempre):** a cada 15 segundos, e ao sair do app, o que foi gravado vai para o banco do aparelho. Se o app fechar no meio de um discurso, na próxima abertura a gravação é recuperada e guardada nas gravações do discurso de onde saiu, pronta para resumir.
- O discurso de cada gravação passou a ser anotado **no início** da gravação (antes, no fim).

## 6.9.66

Revisão da tela Anotações (assembleia e congresso), com correções na gravação e no resumo em segundo plano:

- **Resumo sempre no discurso certo:** o resumo na fila passou a reconhecer o discurso pela identidade (documento, parágrafo e tema), não só pela posição. Antes, se o programa fosse **atualizado** enquanto um resumo estava na fila, as partes podiam mudar de lugar e o resumo cair no discurso errado.
- **Tela sempre ligada durante a gravação:** com a tela bloqueada o celular costuma cortar o microfone no meio de um discurso longo; agora a tela fica ligada enquanto grava (onde o aparelho permite).
- **Aviso de microfone interrompido:** se uma ligação, outro app ou um erro do gravador cortar o microfone, o quadro mostra “⚠️ Microfone interrompido” e orienta a tocar em Parar para guardar o que já foi gravado (antes o relógio seguia contando em silêncio).
- **Áudio em texto protegido:** se a transcrição de uma gravação das Anotações falhasse no meio, o texto que estava aberto na tela Áudio em texto se perdia; agora volta sempre como estava. E, se essa tela estiver transcrevendo algo, o resumo das Anotações espera a vez dela.

## 6.9.65

Início: o atalho **Extrato** agora **abre** o card **Consumo de IA e faturamento** (na 6.9.64 só levava até ele, fechado). Os campos de dentro (consumo detalhado, Pix e Extrato) continuam recolhidos.

## 6.9.64

- **Recolhidos sempre:** o card **Consumo de IA e faturamento** e o **Extrato** dentro dele abrem sempre recolhidos ao entrar em Ajustes e ao abrir o card, inclusive pelo atalho **Extrato** da tela inicial (que agora só leva até o card, sem abri-lo).
- **Nova ordem:** o campo **Total do mês · Saldo de créditos** fica logo abaixo da escolha do mês.
- **Texto de ajuda** sob o seletor de mês reduzido à primeira frase: “O que você usou de IA no mês, em cada recurso liberado pelos seus códigos, e o valor a pagar.”

## 6.9.63

Consumo de IA e faturamento: em **primeiro lugar** agora fica o campo **Total do mês · Saldo de créditos**. O **consumo detalhado** (recurso por recurso, com uso, preço e valor) abre ao tocar nesse campo (seta ▸ / ▾) e **sempre começa recolhido** ao abrir o card. O seletor de mês, o aviso de ajuda, o Pix e o extrato vêm depois.

## 6.9.62

Início: ao tocar no botão **Início** (ou voltar a ele), o **texto diário abre recolhido** (se estava aberto, fecha) e os atalhos ficam na **página 1**.

## 6.9.61

O card **📒 Extrato de créditos e consumo** também ganhou moldura em destaque, em **azul** (o Pix é verde), com halo suave e leve fundo azul.

## 6.9.60

O card **⚡ Adicionar crédito por Pix** ganhou uma **moldura verde em destaque** (borda de 2 px, halo suave e um leve fundo verde; mais escura quando aberto), para se destacar dentro de Consumo de IA e faturamento.

## 6.9.59

Texto diário: os **comentários adicionais são salvos automaticamente** neste aparelho assim que são gerados (incluindo “Gerar outros”), valendo até o fim do dia. Ao reabrir o app ou voltar ao dia, eles já aparecem, sem gerar de novo. Por isso saíram os botões **💾 Salvar** e **📂 Recuperar comentários salvos**. **🗑️ Limpar** agora apaga também a cópia salva (senão os comentários voltariam ao reabrir). Comentários de um dia que já passou não são guardados.

## 6.9.58

- **Sai a opção “💠 Pagar com PIX”** (a chave e o QR code fixos) de Consumo de IA e faturamento: fica só **⚡ Adicionar crédito por Pix**, com confirmação automática.
- **O extrato saiu do card próprio** de Ajustes e ficou **dentro de Consumo de IA e faturamento** (“📒 Extrato de créditos e consumo”); o botão “Ver extrato” deixou de existir.
- **Início, página 2:** o atalho **Discurso público** foi trocado por **Extrato**, que abre Ajustes → Consumo de IA e faturamento → Extrato, já carregado. (Discurso público continua em Reuniões → Discursos.)

## 6.9.57

**Extrato de créditos e consumo.** Nova seção em Ajustes, **📒 Extrato de créditos e consumo** (também pelo botão “Ver extrato” em Consumo de IA e faturamento), que mostra, do mais antigo para o mais novo: o **saldo inicial**, os **créditos** (boas-vindas, Pix e lançamentos do administrador), cada **consumo de IA por solicitação** (com o recurso que consumiu e o valor) e o **saldo depois de cada movimento**. Resumo no topo (créditos, consumo e saldo) e filtro por mês.

- O servidor passou a registrar cada movimento no cadastro do usuário (últimos 400; ao passar disso, o saldo do mais antigo vira o inicial). Quem já existia começa o extrato com o saldo do dia da atualização (o que veio antes não foi detalhado e a tela avisa).
- Correção: atualizar os dados do cadastro (Meus dados) não apaga mais o histórico de Pix e o extrato.

## 6.9.56

**Crédito por Pix com confirmação automática (Mercado Pago).** Em Ajustes → Consumo de IA e faturamento, nova opção **⚡ Adicionar crédito por Pix**: o usuário informa o valor, o app mostra o QR code e o copia e cola, e o crédito entra sozinho no saldo quando o pagamento cai (sem comprovante). Só aparece quando o servidor está configurado.

- **Segurança:** o servidor nunca confia no aplicativo nem no aviso: antes de creditar, lê o pagamento direto na API do Mercado Pago e só credita se estiver aprovado, for Pix em reais e a referência for de um usuário identificado. Cada pagamento credita **uma vez só** (mesmo com o aviso e a conferência juntos). Valor de R$ 1,00 a R$ 500,00; Pix válido por 30 minutos.
- **Novos arquivos:** `api/mercadopago.mjs` (criar e consultar), `api/mercadopago-webhook.mjs` (aviso do Mercado Pago) e `api/_mercadopago.mjs`.
- **Para ativar na Vercel:** variáveis `MERCADOPAGO_ACCESS_TOKEN` (obrigatória) e `MERCADOPAGO_WEBHOOK_SECRET`; webhook `https://www.notestyle.com.br/api/mercadopago-webhook` com o evento Pagamentos.

## 6.9.55

Administração de usuários: cada usuário mostra, já na lista, o **saldo** e, logo abaixo, o **consumo de IA do mês em R$** (o total da tabela de consumo que já existia dentro do card; nenhuma tabela nova nem mudança no servidor). Dentro do card, a seção de créditos agora traz **Consumo de IA no mês** e **Saldo restante** juntos, acima do campo de creditar. A linha de totais da lista soma o **consumo do mês** e o saldo dos usuários.

## 6.9.54

Administração de usuários, lista “Usuários identificados”: o **saldo** (💳 R$ 0,00) deixou de quebrar em duas linhas (“R$ 0,0 / 0”). Ele fica numa coluna própria, à direita e sempre inteiro; o nome e os dados (idade, cidade) ocupam o espaço restante e quebram em linhas sem espremer o valor.

## 6.9.53

Administração de usuários: o campo do valor de crédito e o botão (**Salvar** do crédito de boas-vindas e **Creditar** de cada usuário) agora ocupam a largura toda, lado a lado: o campo estica e o botão fica ao lado.

## 6.9.52

Início, página 2 dos atalhos: o atalho **Tesouros da Palavra** foi trocado por **Outros esboços** (abre a página Discursos já com Outros esboços aberto). Tesouros continua em Reuniões → Discursos.

## 6.9.51

Início: ao abrir ou tocar em Início, os atalhos sempre voltam à **página 1** (antes ficava na página 2 se ela era a última vista).

## 6.9.50

Início, página 2 dos atalhos: o atalho **Outros esboços** foi trocado por **Ajustes** (abre a tela de Ajustes). Os esboços continuam na tela Reuniões → Discursos.

## 6.9.49

- **Comentários do texto diário com a IA dos esboços:** a geração dos comentários adicionais passa a usar o mesmo modelo e esforço dos discursos e das perguntas do dirigente (Ajustes → Modelos e agentes de IA, linha “Esboços, dirigir e texto diário”). A nota sob o botão também mostra esse modelo.
- **Ler os comentários automaticamente:** no fim do card do texto diário, uma opção discreta (“⚙️ Instruções adicionais de áudio”) liga “Gerar e ler os comentários adicionais automaticamente”. Ligada, só quando você pede a leitura do texto (🔊) o app, ao terminar, fala “Aguarde... gerando comentários”, gera e lê os comentários (se já estão na tela, só os lê). Nada é gerado sem você pedir a leitura; pedir outra leitura cancela a rotina.
- **Início em duas páginas:** os atalhos ganharam a página 2, com 8 novos (Formatar, A Sentinela, Joias espirituais, Estudo Bíblico, Discurso público, Tesouros da Palavra, Outros esboços e Pesquisas salvas). Passe o dedo para o lado, ou use as setas e os pontos embaixo, para trocar de página. Os atalhos da ferramenta abrem a página do grupo já com ela aberta e seguem o mesmo bloqueio por código.

## 6.9.48

Outros esboços: o campo **Tema do discurso** mostra o tema **inteiro, em negrito**, sem cortar: deixou de ser uma linha que rolava para o lado e passou a crescer em linhas conforme o texto (continua sem Enter; uma quebra de linha colada vira espaço).

## 6.9.47

Outros esboços: os campos **Ideia do discurso** e **Matéria** se adaptam ao tamanho do texto, crescendo para mostrar tudo (antes só a Matéria; a Ideia tinha uma caixa fixa com rolagem). Também se ajustam ao colar um texto grande, ao preencher a ideia a partir do esboço da organização, ao liberar o passo 2 e ao girar ou redimensionar a tela.

## 6.9.46

Outros esboços: saiu a opção **“Não usar esboço pronto (só a matéria)”** da lista de esboços da organização. Importar um esboço é querer usá-lo; para deixar de usar, basta **apagá-lo** (o botão “Apagar este esboço importado”; apagado, passa a valer o próximo importado, se houver). O texto de ajuda do card diz isso.

## 6.9.45

Outros esboços:
- **Esboço da organização no passo 1:** o card para anexar o esboço da organização passou para o passo 1, antes dos campos. Com um esboço em uso, o **tema**, a **ideia (o objetivo, quando o esboço tem a nota ao orador)** e o **tempo** saem dele, e o passo 1 já fica completo (os passos 2 a 4 abrem). O tema e a ideia continuam editáveis, e o app não apaga o que você escreveu.
- **Pesquisa obrigatória na wol:** sem esboço da organização e sem artigos informados, ao elaborar o esboço o app **pesquisa sozinho na wol.jw.org** com o tema e a ideia e usa até 3 dos melhores resultados como base dos argumentos.
- **Matérias citadas pelo esboço:** com esboço da organização que cita publicações, o app as **procura na wol.jw.org**, seção por seção (até 4 seções e 6 matérias): a publicação citada, quando a pesquisa a acha pela data e pelas páginas; senão, a matéria mais próxima do assunto da seção. A IA usa esse texto para enriquecer os itens, sem mudar a estrutura do esboço.
- **A pesquisa na wol só acha o que tem todas as palavras na mesma frase:** uma frase inteira (como o tema e a ideia juntos, que a 6.9.40 passou a usar) quase nunca acha nada. Agora a pesquisa (a automática e o botão “Pesquisar na biblioteca online”, quando o campo de pesquisa está vazio) usa **poucas palavras-chave** do tema e da ideia (3, depois 2, depois 1) e mostra a consulta usada. O que você digita no campo de pesquisa continua indo como está, e só se não achar nada o app tenta com palavras-chave dele.
- Depois da elaboração, os **avisos** dizem o que foi pesquisado ou consultado na wol (ou que nada foi achado). As instruções da IA (tela de prompts) explicam as duas situações.

## 6.9.44

Outros esboços: os campos do **passo 1 são obrigatórios** (tema, ideia e tempo). Enquanto faltar algum, os **passos 2 a 4 ficam bloqueados e recolhidos**: só os títulos aparecem, apagados e com um cadeado, e o passo 1 diz o que falta. A elaboração também confere a ideia do discurso (pelo menos 8 letras) e o tema (pelo menos 4), mesmo com esboço da organização.

## 6.9.43

Outros esboços:
- O **passo 4 (Elaborar o esboço)** fica escondido até o **tema** estar preenchido (ou um esboço da organização escolhido, que traz o tema); o passo 1 avisa disso.
- O campo da pesquisa se chama **“Pesquisar matérias relacionadas com o tema na wol (opcional)”**; a dica de que, vazio, ele usa o tema e a ideia do discurso passou para dentro do campo.

## 6.9.42

Outros esboços: a tela ganhou **passos numerados**, cada um com um título e um número: **1 · Dados do discurso** (tema, ideia e tempo), **2 · Material de apoio (opcional)** (ocasião, textos, matéria, artigos, pesquisa na biblioteca e esboço da organização), **3 · Listar os textos bíblicos do material (opcional)** e **4 · Elaborar o esboço**, com uma linha de ajuda nos passos 2 e 4.

## 6.9.41

Outros esboços:
- Os **Artigos do wol.jw.org** voltaram para junto dos outros campos (depois da Matéria, antes do card da pesquisa).
- O botão “Ler a matéria e listar os textos bíblicos” virou **“Listar os textos bíblicos do material informado”**, e uma frase logo acima diz **de onde ele tira os textos**, conforme o que está preenchido: os textos bíblicos pedidos, a matéria colada, os artigos do wol.jw.org e o esboço da organização (e que ele não usa a IA). O esboço que a IA já elaborou no campo de texto não entra. O resultado também ficou com nome mais claro: “Textos bíblicos encontrados no material”.

## 6.9.40

Outros esboços:
- A **pesquisa na biblioteca** usa o campo de pesquisa, se tiver texto; senão, o **tema e a ideia do discurso** juntos (antes, só o tema). Cada um entra com até 100 caracteres, para a ideia não se perder quando o tema é longo.
- O card “Ocasião, textos, matéria e pesquisa” **saiu**: Ocasião, Textos bíblicos que quer ler e Matéria ficam no mesmo nível do Tema, da Ideia e do Tempo; os Artigos do wol.jw.org ficam logo abaixo da pesquisa, onde caem os resultados marcados.
- O campo de pesquisa e o botão **Pesquisar na biblioteca online** ganharam um **card só deles** (“🔎 Pesquisar na biblioteca online”), com os resultados dentro.

## 6.9.39

Outros esboços (necessidades locais, eventos especiais): tela mais clara.
- O card **“Ocasião, textos, matéria e pesquisa”** vem logo depois do tempo do discurso, acima do card do esboço da organização.
- O card do esboço importado passou a se chamar **“Utilizar um esboço fornecido pela organização como base (opcional)”**; o resumo dele diz “em uso” ou “nenhum em uso”, e o texto de ajuda explica para que serve.
- **Esboços importados em lista**, sempre à vista, com uma opção marcada de cada vez (“Não usar esboço pronto (só a matéria)” e os esboços, cada um com tema, tempo, seções, arquivo e data da importação). No lugar da caixa de seleção, que mostrava “Nenhum” duas vezes (no botão e no primeiro item da lista) e parecia marcar “Nenhum” mesmo com o esboço da organização à vista.
- **Esboços repetidos:** o mesmo esboço importado duas vezes (por exemplo, o original e o que o próprio app exportou, com 📜 e letras maiúsculas no título) aparecia duplicado na lista, com o tema repetido. Agora são reconhecidos como o mesmo (sem considerar o emoji nem as maiúsculas do título), e os repetidos que já estavam guardados saem sozinhos, ficando o mais novo.
- O título do esboço importado entra no campo “Tema do discurso” sem o emoji.
- O quadro de resumo depois de “Ler a matéria” não repete mais o tempo (“14 min”) que já está no campo “Tempo do discurso”; com esboço da organização, o rótulo do tempo avisa que ele vem do esboço.

## 6.9.38

Administração de usuários: o **crédito de boas-vindas** agora é configurável. Um campo “🎁 Crédito de boas-vindas (R$)” no alto da seção define quanto cada cadastro aprovado daqui para frente recebe (padrão R$ 100,00; 0 = sem crédito). Quem já foi aprovado não muda; a mensagem de boas-vindas ao usuário mostra o valor que ele recebeu (e não aparece se o crédito for zero).

## 6.9.37

Créditos de IA:
- **Crédito de boas-vindas:** todo usuário aprovado começa com **R$ 100,00** de crédito. Na primeira abertura do app depois da aprovação, ele recebe uma mensagem de boas-vindas avisando do crédito e de onde acompanhar o saldo (uma vez por aparelho). Na Administração de usuários, a aprovação avisa que o crédito foi dado.
- **Tarefas gratuitas liberadas sem saldo:** sem créditos, só o que usa a IA fica bloqueado. Continuam funcionando as leituras do wol.jw.org (matéria dos discursos, estudo, apostila, joias, imagens), do S-34 e da Bíblia (versículos e texto dos capítulos), a pesquisa na biblioteca, o backup e a recuperação de um pedido já feito. A lista de parágrafos do estudo só confere o saldo se a leitura no site falhar e precisar da IA.

## 6.9.36

Revisão geral das mudanças das versões 6.9.18 a 6.9.35.

Outros esboços (necessidades locais, eventos especiais):
- O botão **Ler a matéria e listar os textos bíblicos** sumia de vez depois da primeira leitura: quem colava mais matéria, mudava os textos pedidos ou marcava outro artigo não tinha como ler de novo (só com “Limpar os campos”). Agora, ao mudar a matéria, os textos ou os artigos, ele volta como **↻ Ler a matéria de novo**.
- Escolher um esboço importado **apagava o tema** que o orador tinha escrito. Agora o tema do esboço só entra no campo se ele estiver vazio ou com o tema de outro esboço importado; e, ao tirar o esboço (Nenhum ou apagar), o tema que tinha vindo dele sai junto.
- Com mais de um esboço importado, a lista mostrava só “1 · 30 min · 3 seções”, “2 · 30 min · 3 seções”: não dava para saber qual era qual. A lista aberta volta a mostrar o tema de cada um; o botão fechado continua só com o rótulo curto.
- O campo **Matéria** com um texto salvo de outro dia aparecia cortado em poucas linhas, sem rolagem, até a pessoa digitar algo. Agora ele se ajusta ao aparecer na tela.

Administração de usuários:
- O saldo de créditos passa a ser guardado com 4 casas decimais: cada uso de IA custa frações de centavo, e arredondar cada débito para centavos cobrava a mais (ou não cobrava). Na tela continua com 2 casas.
- Creditar aceita “R$ 10,00”, “1.234,56” e Enter no campo; um valor negativo (ex.: -5,00) corrige um lançamento errado, com confirmação.
- Revogar avisa o saldo e os códigos que serão apagados junto com o cadastro.
- Lista de usuários: quantidade nos títulos, saldo somado e quantos estão sem saldo, “sem saldo” em destaque no card e campo de busca (a partir de 6 usuários).
- Botão **📲** ao lado de cada código: envia o código pelo WhatsApp para o telefone do cadastro, com a instrução de onde informar.
- A lista “Usuários identificados” não abre mais sozinha ao entrar na seção.

Servidor:
- Cada pedido de IA lia o cadastro no armazenamento até três vezes (cadastro aprovado, saldo e códigos pessoais); agora usa uma leitura só, válida por 5 segundos (a leitura em voz faz vários pedidos seguidos).
- Buscar o resultado de um pedido demorado não é mais barrado por falta de saldo (o pedido já foi cobrado quando rodou).
- Os códigos personalizados deixam de ir na resposta pública do estado do cadastro.

## 6.9.35

Outros esboços: o tema do esboço importado aparece só no campo "Tema do discurso" (some do resumo do bloco, do seletor e do status da importação).

## 6.9.34

Outros esboços: o tema do esboço importado deixa de se repetir abaixo do seletor e no resumo após ler a matéria.

## 6.9.33

Outros esboços: o campo "Matéria: cole aqui um texto ou anotações" cresce com o tamanho do texto.

## 6.9.32

Outros esboços: "Ler a matéria…" passa a listar também os textos bíblicos citados no corpo do esboço importado (não só "[Leia …]" e citações entre parênteses) e reconhece melhor as referências na matéria colada.

## 6.9.31

Outros esboços: o resumo após ler a matéria deixa de repetir os dados do esboço importado (já mostrados no card "Esboço pronto como base").

## 6.9.30

Outros esboços: o botão "Ler a matéria e listar os textos bíblicos" passa a sumir de fato depois que o card de textos aparece (o CSS de `.ai-study-load` impedia o `hidden`).

## 6.9.29

Preparação de discursos: o botão "Carregar o esboço já salvo" fica depois de "IA - Elaborar o esboço do discurso".

## 6.9.28

Outros esboços: o botão "Ler a matéria e listar os textos bíblicos" fica abaixo do resumo do esboço; some depois que os textos bíblicos aparecem e volta ao carregar um esboço novo.

## 6.9.27

Administração de usuários: no celular, os campos e tabelas do card do usuário deixam de extrapolar a largura da tela (conteúdo empilhado e contido).

## 6.9.26

Administração de usuários: no card de cada usuário, mostra o consumo do mês por tipo de recurso (uso e valor) e o **saldo restante** de créditos.

## 6.9.25

Administração de usuários: nos dados pessoais do card, o valor fica em negrito e o rótulo em peso normal.

## 6.9.24

Administração de usuários: ícone 👥 no título da seção; dados do cadastro e códigos personalizados em layout de tabela (rótulo/valor e recurso/código/ações).

## 6.9.23

Administração de usuários: ao gerar/creditar/expirar código, o card do usuário permanece aberto (antes fechava ao redesenhar a lista) e o clique no botão não fecha o painel.

## 6.9.22

Administração de usuários → Preços do consumo de IA e PIX: remove o texto explicativo do topo e o aviso da cotação do dólar.

## 6.9.21

Administração de usuários: remove o texto explicativo do topo, a opção de exigir aprovação e os botões Aplicar/Atualizar (aprovação de cadastros novos passa a ser o padrão). No card do usuário, some “como conheceu”. Cada usuário ganha **créditos em R$** (o administrador credita; o uso de IA debita pelos preços do faturamento; sem saldo a IA fica bloqueada) e **códigos personalizados** por recurso (o administrador gera e pode expirar; o código só vale naquele aparelho; os códigos globais antigos continuam sendo aceitos).

## 6.9.20

Ajustes: a seção do administrador **Acesso ao site** passa a se chamar **Administração de usuários**.

## 6.9.19

Anotações: o ícone 🔊 do campo de texto sobe um pouco, para não ficar colado nos botões • Lista / 1. Lista.

## 6.9.18

Anotações: o botão de ouvir o texto fica só com o emoji 🔊, sem moldura e sem a chave/cadeado ao lado (o código de leitura continua sendo pedido ao tocar).

## 6.9.17

Áudio em texto, Dados do áudio: o rótulo **Título ou tema** e a opção **mesmo do arquivo** (alinhada à direita) ficaram na mesma linha, colados no campo do título (o limite de 120 caracteres continua escrito dentro do campo).

## 6.9.16

Listas de escolha (como o Tipo de áudio): abriam no meio da lista, mesmo com a primeira opção marcada (a posição era medida pela página, não pela lista). Agora a lista de tipos de áudio abre sempre no começo (Nenhum, Novo tipo… e os tipos), e as outras listas abrem no começo ou, com outra opção marcada, mostram essa opção.

## 6.9.15

Áudio em texto, tipo **Discurso em uma reunião pública das Testemunhas de Jeová**: os campos **Sobre o áudio** e **Como fazer o resumo** ficam travados (só leitura), e a explicação de que o resumo segue o padrão do app (e onde ficam as definições) aparece **dentro** do campo Como fazer o resumo, no lugar da nota de baixo. Ao trocar de tipo, os campos voltam a funcionar.

## 6.9.14

Tela de abertura: o logo do NoteStyle ficou bem maior (metade da largura do celular, até 240 px, antes 96 px), e o nome “NoteStyle” também.

## 6.9.13

Áudio em texto: com o tipo **Discurso em uma reunião pública das Testemunhas de Jeová**, o campo **Como fazer o resumo** fica desativado e vazio, com uma nota explicando que o resumo segue o padrão do app (o mesmo do resumo dos discursos na tela Anotações) e onde ficam essas definições (Ajustes → Prompts da IA → Anotações de discursos → Resumo da gravação nas anotações). Ao trocar para outro tipo, o campo volta a funcionar.

## 6.9.12

Áudio em texto: com o tipo de áudio **Discurso em uma reunião pública das Testemunhas de Jeová**, o resumo segue as **mesmas instruções do resumo das anotações** (o prompt “Resumo da gravação nas anotações”, editável na tela de prompts): tema no topo, pontos principais com o modelo IMPORTANTE e aplicações com o modelo Aplicar, textos lidos com o versículo da TNM, experiências, palavras-chave com emoji e RESUMO no fim, com a mesma formatação em negrito e itálico. O campo “Como fazer o resumo” desse tipo fica em branco (o que a pessoa escrever nele vai como instrução a mais).

## 6.9.11

Anotações, texto bíblico: o botão de visualizar ganhou um ícone de olho desenhado (só o contorno), no lugar do emoji realista; e o texto inserido entra sempre com **uma linha em branco antes e outra depois**.

## 6.9.10

Gravação das anotações: agora é **um arquivo só**, na qualidade de voz (64 kbps, cerca de 29 MB por hora). Saiu a segunda gravação em qualidade maior que era feita ao mesmo tempo só para exportar: o 💾 Exportar salva o mesmo áudio que fica guardado no app.

## 6.9.09

Anotações: novo botão **🔊** ao lado do título “✍️ Anotações” para **ouvir as anotações** em voz alta (com o código de leitura), por exemplo no dia seguinte, dirigindo. Abre o tocador da leitura em voz logo abaixo, com a barra de andamento, a velocidade e o salvar o áudio; tocar de novo no 🔊 para a leitura.

## 6.9.08

Anotações:
- **Texto bíblico:** novo botão **👁️** (visualizar) ao lado do Inserir. Mostra o texto da referência escolhida logo abaixo do campo, com **Inserir** e **✕ Fechar**; o Inserir da barra continua inserindo direto, sem visualizar.
- **Resumo em segundo plano:** o resumo (da gravação pronta, de “Resumir as gravações” e do arquivo carregado) entra numa fila e roda em segundo plano. Cada pedido guarda o discurso de onde saiu e o resultado vai para as anotações **daquele** discurso (e a resposta da recapitulação para o campo dele), mesmo que você já esteja em outra parte, gravando o próximo discurso ou fora da tela. Ao tocar em Resumo, o quadro da gravação fecha e já dá para gravar de novo; gravar ou trocar de parte também fecha sozinho o quadro de uma gravação já guardada no app. Uma linha mostra o andamento (ícone girando, o discurso, a etapa e o tempo) e quantos esperam na fila; o resumo agora entra no fim das anotações, sem mexer no cursor.

## 6.9.07

Resumo das gravações nas anotações: as **palavras-chave** saem sempre em MAIÚSCULAS, negrito e com um emoji antes: 📖 **TEXTO LIDO** (no lugar de “FOI LIDO”), 📌 **TEXTO CITADO**, 💬 **EXPERIÊNCIA**, 📜 **RELATO BÍBLICO**, 🎭 **DEMONSTRAÇÃO**, 🎤 **ENTREVISTA**, 🎬 **DRAMA**, ❓ **PERGUNTA DE REVISÃO**, ✅ **RESPOSTA**, 💡 **LIÇÃO** e 📝 **RESUMO**; outras palavras-chave seguem o mesmo padrão.

## 6.9.06

Gravações guardadas no app: o tocador da gravação recém-feita podia ficar em branco no iPhone (o áudio lido do banco logo depois de gravado não carregava). Agora a gravação feita nesta sessão toca direto da memória; e qualquer tocador que não carregar tenta de novo sozinho e, se ainda falhar, mostra **↻ Tentar de novo** no lugar da barra.

## 6.9.05

Resposta da pergunta de recapitulação no resumo das gravações: só é copiada quando o orador responde **explicitamente**. A IA só a devolve se a transcrição tiver as duas coisas: o orador anunciando a pergunta de revisão/recapitulação (“resposta à pergunta de revisão”…) e, logo depois, repetindo a pergunta, igual ou muito parecida com a do card. Ela não pode mais deduzir a resposta do conteúdo do discurso. O app também confere: sem a frase “pergunta de revisão” ou “pergunta de recapitulação” na transcrição e, logo depois, pelo menos 60% das palavras da pergunta, a resposta da IA é descartada.

## 6.9.04

Resumo das gravações nas anotações:
- A IA não deixa mais de fora as **experiências** e os **relatos** contados pelo orador (pessoas reais ou personagens bíblicos), mesmo no começo de um trecho: cada um entra no ponto em que foi contado, como “Experiência:” ou “Relato bíblico:”, com a situação, o que a pessoa fez e a lição.
- Na assembleia e no congresso, a IA recebe a **pergunta de recapitulação** da parte; se o orador respondeu a ela, a resposta é **copiada para o campo da resposta** (abaixo do que já houver, com o botão de desfazer) e não fica no resumo.

Tocador das gravações guardadas: novo botão **⏹️** (parar e voltar ao início), além do tocar/pausar.

## 6.9.03

Anotações: enquanto transcreve e resume, o botão **✨ Resumir as gravações** mostra o ícone girando e o tempo que já passou (“Resumindo… 00:42”); no fim, volta ao rótulo normal.

## 6.9.02

Gravações das anotações:
- O arquivo exportado sai em **M4A** (AAC), que toca em qualquer celular e computador; antes, o Safari novo gravava em WebM, que não abria no app Arquivos. O WebM só fica como reserva em navegador que não grave M4A.
- Exportar salva **só o áudio**: o compartilhamento mandava também o nome como título, e o iPhone salvava um arquivo de texto à parte (valia também para o Word e o backup).
- A cópia guardada no app subiu para **64 kbps** (cerca de 29 MB por hora), com som melhor.
- O primeiro toque em ▶️ não tocava quando o áudio era WebM (o app ainda estava medindo a duração); agora o áudio espera e começa do início.

## 6.9.01

Anotações, gravações guardadas no app:
- As gravações ficam num **card recolhível** (“🎧 Gravações guardadas no app (n)”), que só aparece quando a anotação tem gravação e sempre começa fechado. Várias gravações da mesma parte (os pontos altos de uma palestra, por exemplo) ficam uma abaixo da outra.
- Novo botão **✨ Resumir as gravações**, dentro do card: transcreve todas as gravações da anotação, na ordem, e insere **um resumo só** (“Resumo das gravações”). Dá para resumir depois, não só ao parar a gravação.
- O quadro da gravação pronta não mostra mais o texto explicativo, e os botões Resumo, Exportar e Concluir ficaram do mesmo tamanho, sem o rótulo encostar na borda.

## 6.9.00

Anotações: **as gravações ficam guardadas no próprio app** para ouvir depois.
- Ao parar uma gravação, ela é guardada **automaticamente** no banco do aparelho, na **qualidade de voz** (32 kbps; 48 kbps no iPhone), cerca de 14 a 22 MB por hora, ligada à anotação (a reunião ou a parte da assembleia/congresso).
- Ao mesmo tempo, o app grava uma cópia em **qualidade maior** (128 kbps), que fica só na memória: é a usada no **💾 Exportar** (o antigo Salvar) e no resumo. Se o aparelho não aceitar os dois gravadores juntos, fica só a de voz.
- Na anotação aparece **🎧 Gravações guardadas no app**, com o tocador (velocidade de 0,75× a 2×), **💾 Exportar** e **🗑️ Apagar**. O item salvo em Pesquisas e respostas salvas ganha o botão **🎧**, que abre o mesmo tocador.
- Novo botão **✔️ Concluir** no quadro da gravação pronta: fecha o quadro e a gravação continua guardada no app. **Descartar** apaga também a cópia do app.
- **Ajustes → Privacidade e dados deste aparelho → 🎧 Gravações guardadas no app**: a lista de todas as gravações, o espaço ocupado e o botão para apagar todas.
- As gravações não entram no backup (.json); para guardar para sempre, exporte o arquivo.

## 6.8.31

Leitura em voz alta: o rótulo pequeno da voz no botão **🔊 Ler** (ex.: “Voz Algenib · Gemini 2.5 Flash”) não vaza mais para o botão ao lado durante a leitura; quebra a linha dentro do botão.

## 6.8.30

Leitura em voz alta (vozes Gemini): a voz ainda falava um trecho da instrução (“faça as perguntas soarem como perguntas”) antes do texto. A instrução de leitura virou uma descrição curta do estilo da voz, sem ordens nem regras: “Narração em português do Brasil, natural e clara, de quem lê um texto em voz alta numa reunião da congregação, com entonação de pergunta nas perguntas e pausas curtas entre as ideias.” As regras saíram porque o app já faz esse trabalho antes de enviar o texto: tira as citações de publicações e escreve as referências bíblicas por extenso.

## 6.8.29

Leitura em voz alta (vozes Gemini): a voz começou a ler a própria instrução em vez do texto. A instrução da 6.8.27 tinha ficado longa, em tópicos e cheia de frases de exemplo entre aspas, e a voz as tomava como texto a ler. Voltou a ser um parágrafo curto, sem exemplos para ler, mantendo as regras: ler exatamente o texto recebido, as referências bíblicas por extenso como estão (sem trocá-las pelo versículo) e pular as citações de publicações.

## 6.8.28

Leitura em voz alta: na forma curta, a referência bíblica sai sem vírgula entre o capítulo e os versículos (“Gênesis quatro sete”, “Primeira Coríntios treze quatro a sete”, “Salmo vinte e três um”), também nos exemplos da instrução das vozes Gemini.

## 6.8.27

Leitura em voz alta (vozes Gemini): a voz deixou de trocar a referência bíblica pelo conteúdo do versículo (no texto diário de Gênesis 4:7, ela dizia “mas se não voltar a fazer o bem” em vez de “Gênesis quatro, sete”). A instrução de leitura dizia “NUNCA leia referências”, pensando nas citações de publicações, e a voz entendia que devia pular também os textos bíblicos e completava com o que sabe do versículo. Agora ela manda ler exatamente as palavras recebidas, sem acrescentar nem trocar nada, e ler os textos bíblicos por extenso como estão; só as citações de publicações (como “w25.03 18 § 15”) continuam puladas.

## 6.8.26

Acesso: o app só funciona em aparelho com **cadastro aprovado**, inclusive nos aparelhos antigos, de antes do cadastro obrigatório. Antes, o aparelho sem cadastro era liberado quando estava sem internet, quando o servidor não respondia ou quando não tinha identificação. Agora, nesses casos, só continua usando o aparelho cuja aprovação já foi confirmada pelo servidor (a confirmação fica guardada nele); os outros ficam na tela de identificação. A checagem também se repete ao voltar para o app (no máximo a cada 5 minutos), e um cadastro revogado pelo administrador volta à tela de identificação. As funções com IA, voz e transcrição já eram bloqueadas no servidor para aparelhos sem cadastro.

## 6.8.25

Anotações: os botões **🎙️ Gravar o discurso e resumir** e **📁 Carregar gravação e resumir** ficaram do mesmo tamanho; o de carregar ganhou um azul médio.

## 6.8.24

Anotações: novo botão **📁 Carregar gravação**, ao lado de “Gravar e resumir o discurso”, para transcrever e resumir um arquivo de áudio já gravado.

Resumo da gravação: o tema do discurso vem no topo, em maiúsculas e negrito; os **pontos principais** recebem o modelo **IMPORTANTE** e os pontos de **aplicação prática** o modelo **Aplicar**, com uma linha em branco entre eles; os pontos enumerados pelo orador ganham 1️⃣ 2️⃣ 3️⃣ (os outros, “•”) e emojis ilustrativos; a referência dos textos vai em negrito e o texto lido em itálico, com linha em branco antes e depois; as **perguntas de revisão** citadas pelo orador entram como “PERGUNTA DE REVISÃO:” (a pergunta em negrito e itálico) e “RESPOSTA:”. O título “Resumo da gravação” fica em negrito e itálico, seguido de uma linha em branco. No Word, o negrito e o itálico saem normais.

## 6.8.23

Anotações: o card da **pergunta de recapitulação** (com a resposta, na anotação do discurso) ficou com fundo branco.

## 6.8.22

Anotações: os cards principais passaram a se chamar **Reuniões congregacionais**, **Assembleias** e **Congressos**, e os cartões da tela ganharam fundo **roxo clarinho** (com tom próprio no tema escuro).

## 6.8.21

Tela de prompts: nova categoria **📝 Anotações de discursos**, com os prompts da tela Anotações (formatar as anotações com IA, resumo da gravação e perguntas de recapitulação da assembleia), que saíram de Formatação de texto.

Resumo da gravação nas anotações: os textos **lidos** pelo orador entram sempre como **FOI LIDO** + referência no padrão das publicações (ex.: “FOI LIDO 1 João 5:4 - …”), com a transcrição do texto e, na linha seguinte, a aplicação que o orador fez; os textos só **citados** entram com a referência, sem transcrição, e com o que foi dito e como foi aplicado. No final vem um **RESUMO** (ex.: “O orador destacou a importância da humildade…”). O servidor manda junto o texto dos versículos citados na gravação (Tradução do Novo Mundo), para a transcrição sair exata.

## 6.8.20

Anotações: os botões **💾 Salvar** e **📄 Word** do fim da tela saíram da caixa branca e ficam direto na base cinza do cartão, mais baixos (a mesma altura dos botões de formatação).

## 6.8.19

Anotações: o **resumo da gravação** de cada parte passou a ter instrução própria (prompt editável “Resumo da gravação nas anotações”): traz o conteúdo e as lições práticas da apresentação, quase sempre na terceira pessoa e às vezes na segunda (“Temos que obedecer a Jeová em tudo…”), sem narrar o que aconteceu e sem identificar quem falou (nada de “Falante 1”); demonstrações, entrevistas e dramas podem ser narrados (“Demonstração: Um irmão e sua esposa…”). O formato é RESUMO, LIÇÕES e, se houver, DEMONSTRAÇÃO. O resumo da tela Áudio em texto continua como antes.

## 6.8.18

Anotações: na pergunta de recapitulação, os botões de formatação e os modelos (Aplicar, Importante) ficam com os mesmos espaços do campo de anotações (antes o espaço entre as barras e o campo era maior).

## 6.8.17

Discurso público: o botão **📂 Carregar o esboço já salvo** (ou **importado**) fica logo abaixo do **✨ IA - Elaborar o esboço**.

## 6.8.16

Áudio em texto: **Corrigir com a IA** dava erro com o Gemini. O teto de saída de cada parte era calculado para o Claude, e no Gemini (com esforço médio) o raciocínio conta dentro dele: a resposta vinha cortada. Agora corrigir, resumir e sugerir nomes pensam pouco (são tarefas mecânicas) no Gemini e no Haiku 5.5, o teto ganha uma folga no Gemini, e as falhas ficam registradas nos logs com o motivo.

## 6.8.15

Discurso público:
- Títulos dos botões simplificados: **✨ IA - Elaborar o esboço**, **🎵 IA - Sugerir o cântico** e **💬 Enviar para o presidente** (com resumo do card **📨 Enviar para o presidente**).
- Altura dos botões reduzida para um formato mais fino e compacto (38 px de altura mínima), mantendo boa legibilidade e harmonia visual na tela.

## 6.8.14

Anotações e Discurso público:
- Tela de anotações: fonte ajustada e reduzida no botão **🎯⚡️⚡️ IMPORTANTE 👉** para não vazar a borda em telas estreitas (como 360 px ou menores).
- Discurso público: ordem dos botões reorganizada para um fluxo mais direto — o botão **📄 Ver o esboço original** fica logo abaixo do card de resumo do S-34, e a caixa **✍️ Instruções adicionais para a IA** fica logo acima do botão **✨ IA - Elaborar o esboço do discurso**.

## 6.8.13

Elaboração e refino de esboços com IA:
- Aviso claro de tempo esgotado: quando a IA demora mais do que o limite do servidor para responder (comum ao processar discursos longos com muitas gravuras e raciocínio profundo), o app avisa especificamente que o tempo limite esgotou e orienta a tentar novamente ou selecionar um modelo mais rápido (como o Gemini Flash ou esforço baixo).
- Teto de tokens ampliado para o Gemini: o limite de saída nas chamadas de todos os tipos de esboços (tesouros, discurso curto, discurso público e outros discursos) subiu para 40 mil tokens no provedor Gemini, garantindo folga suficiente para o raciocínio e geração completa do JSON.

## 6.8.12

Instruções adicionais para a IA: novo campo logo acima dos botões **Outra resposta** e **Melhorar esta resposta** (com o mesmo formato dos outros campos de instruções), para orientar o refino da resposta ou do esboço.

## 6.8.11

Gravuras do esboço: o botão **➕ Adicionar gravuras** ocupa toda a largura do cartão.

## 6.8.10

Pedidos demorados (esboços, importação e Preparar para dirigir): quando a conexão cai no meio (tela bloqueada, outro app), o app espera você voltar, sem prazo, e então busca o resultado guardado no servidor (por até 6 horas). Antes ele só tentava até uns 5 minutos e meio depois do início: quem voltava depois disso perdia o esboço que o servidor já tinha terminado (foi o que aconteceu com uma importação que deu certo no servidor e não apareceu no app). O botão do esboço salvo agora diz quando ele foi importado: **📂 Carregar o esboço importado de "arquivo" (data)**.

## 6.8.09

Importar esboço do discurso público:
- A IA pensa menos ao passar o esboço para o formato (não precisa criar nada) e, com o Gemini, o teto de saída subiu: o Gemini 4 Carbon chegava a 16 mil tokens e 231 s e às vezes passava do limite, e o app mostrava “A IA não conseguiu ler este esboço”. Se ainda faltar espaço, a mensagem diz que o esboço é longo; a falha agora fica registrada nos logs.
- Gravuras: importar o arquivo de novo troca as gravuras que vieram do arquivo anterior (as adicionadas à mão ficam), e uma imagem repetida não entra duas vezes.

## 6.8.08

Dados para o presidente da reunião: novo campo **Cidade** do orador (guardado com o nome e a congregação), que entra no texto para copiar ou enviar pelo WhatsApp (📍 Cidade).

## 6.8.07

Discurso público: o resumo do esboço escolhido ficou dividido em seções separadas por uma linha (tema, dados do esboço, objetivo e leituras). O número do esboço, a revisão, o tempo total e a palavra “Objetivo” ficam em negrito, com menos destaque que o tema.

## 6.8.06

Discurso público:
- Com o cântico inicial escolhido, o esboço elaborado (ou importado) traz logo abaixo do tema a linha **🎵 Cântico inicial: Nº X — título**. Escolher o cântico com o esboço do tema já no campo também põe (ou troca) essa linha.
- Novo cartão **📨 Dados para o presidente da reunião**: nome e congregação do orador (guardados neste aparelho, valem para todos os temas), o tema e o cântico num texto pronto, com **📋 Copiar** e **💬 Enviar pelo WhatsApp** (abre o WhatsApp com o texto; a pessoa escolhe o contato e envia).

## 6.8.05

Discurso público (e Outros esboços): no resumo do esboço escolhido, o **tema** fica em destaque, numa linha própria, maior e em negrito, acima dos detalhes (revisão, tempos, objetivo e leituras).

## 6.8.04

**Discurso público: gravuras e cântico inicial.**
- **🖼️ Gravuras do esboço** (com um tema escolhido): até 7 imagens por tema, guardadas no banco deste aparelho. As do arquivo importado (Word ou PDF) entram sozinhas, e dá para adicionar outras ou tirar. Elas vão como imagens anexas em todo pedido do esboço do tema (elaborar, outra versão, melhorar e incluir), e a IA faz referência a cada uma no ponto em que se encaixa (novo pedido editável “Esboço: gravuras do orador”).
- **🎵 IA - Sugerir o cântico inicial**: a IA lê a letra dos 151 cânticos de “Cante de Coração Para Jeová” (lista guardada só no servidor) e sugere de 3 a 5, do mais adequado para o menos, ligados ao tema e aos pontos do discurso, cada um com o motivo e um trecho da letra. O escolhido fica guardado por tema. Novo prompt editável “Sugestão do cântico inicial do discurso público”.

## 6.8.03

**Discurso público: importar um esboço já preparado.** Com um tema escolhido, o botão **📥 Importar um esboço preparado (Word ou PDF)** lê o arquivo no aparelho (do Word saem também as marcas de negrito, grifo, sublinhado, cor, recuos e listas) e a IA passa o esboço para o formato do app **sem reescrever**, reconhecendo os textos que o orador escolheu ler (LEIA, grifo ou marcação diferente, “vamos ler”…), com o esboço do S-34 do tema só como referência. O esboço fica **ligado ao tema** (salvo em Pesquisas e respostas salvas, com a marca 📂 na lista) e funciona como um esboço elaborado: a lista dos textos bíblicos citados, **Incluir texto(s)**, **Formatar** e **Melhorar** — que, num esboço importado, faz uma revisão geral mantendo o que ele tem de bom e ajustando-o ao esboço original do S-34. O rodapé diz de que arquivo veio. Novo prompt editável “Esboço de discurso público importado” e o pedido “Esboço importado: melhorar”.

## 6.8.02

Lista de temas do discurso público: no alto, o botão **📂 Mostrar só os com esboço salvo (N)** filtra a lista para os temas que já têm esboço elaborado pela IA; tocar de novo volta a mostrar todos. A escolha fica lembrada neste aparelho, e o botão fica preso no topo ao rolar.

## 6.8.01

Discurso público: com um tema escolhido, aparece um botão **🗑️** ao lado da seta ▾ para limpar a escolha (o campo volta vazio e as informações do tema somem).

## 6.8.00

A linha da lista de temas ainda escurecia ao encostar o dedo durante a rolagem: vinha da regra geral que escurece qualquer botão ao “passar o mouse”, que no iPhone gruda no botão tocado. Essa regra agora vale só com mouse (tira o mesmo efeito grudado dos outros botões no celular), e as linhas das listas de escolha nunca recebem o escurecimento.

## 6.7.99

Lista de temas do discurso público (e as outras listas de escolha): rolar com o dedo não deixa mais uma linha marcada (o realce de “passar o mouse” agora vale só com mouse, e o toque não pinta a linha). As linhas dos temas que já têm esboço preparado ficam com **fundo verde claro** e uma faixa verde à esquerda, além da etiqueta 📂 salvo.

O lembrete de backup passou a aparecer depois de **30 dias** sem backup (antes, 15).

## 6.7.98

**Pesquisas e respostas salvas num banco de dados (IndexedDB).** Antes elas ficavam no armazenamento rápido do navegador (perto de 5 MB por site), com teto de 60 itens e 1,5 milhão de caracteres: passando disso, as mais antigas eram apagadas sozinhas para caber as novas. Agora ficam no banco “notestyle-dados”, com espaço de centenas de MB, e o teto subiu para 3000 itens, sem limite de caracteres. Na primeira abertura o que já estava salvo passa sozinho para o banco. O backup inclui as pesquisas salvas e a restauração as grava direto no banco; “Apagar os dados deste aparelho” também apaga o banco. O resumo dos dados mostra o espaço do banco.

## 6.7.97

**Proteção dos dados do aparelho.** O app pede ao navegador o **armazenamento persistente** (para ele não apagar os dados quando faltar espaço no aparelho). Em Ajustes → Privacidade e dados deste aparelho, o resumo mostra o **espaço usado** (de cerca de 5 MB), se o armazenamento persistente foi concedido e a data do **último backup**. Um **lembrete de backup** aparece ao abrir o app quando há dados salvos e o último backup foi há mais de 15 dias (ou nunca foi feito), com **Fazer backup** e **Depois** (volta em 3 dias); e um aviso quando o espaço passa de 80%.

## 6.7.96

Discurso público: na lista de temas, os que já têm esboço elaborado pela IA e salvo neste aparelho ganham a marca **📂 salvo** (com uma legenda no alto da lista).

## 6.7.95

Esboços (Tesouros, discurso curto, discurso público e Outros esboços): no rodapé, uma linha diz **qual modelo de IA elaborou o esboço e quanto tempo levou** (medido no servidor, em 00:00), com a data. Ela vai junto para o esboço salvo e para a cópia.

## 6.7.94

Tempo da IA em minutos e segundos (**00:00**): no balão azul flutuante, no aviso de andamento e, agora, também no texto do botão enquanto a IA trabalha (“Consultando a IA… 01:23”).

## 6.7.93

**Esboços continuam mesmo saindo da tela.** Ao sair do app ou bloquear a tela no meio da elaboração, o iPhone cortava a espera e aparecia “Falha de conexão ao consultar a IA”, embora o servidor terminasse o esboço. Agora os pedidos demorados (esboços e Preparar para dirigir) vão com um código aleatório; o servidor guarda a resposta por algumas horas e, se a conexão cair, o app busca o resultado assim que você volta e mostra o esboço normalmente. Quando o esboço fica pronto e você está em outra tela (ou em outro app), aparece a barra **✅ O esboço ficou pronto** com o botão **Ver**, que leva até ele. Tocar em outro botão de IA enquanto o esboço é elaborado mostra “Aguarde…” em vez de não fazer nada.

## 6.7.92

Definições em vigor: novo botão **📋 Copiar as definições**, que copia a tabela inteira em texto (data e hora, as três partes e uma linha por item).

## 6.7.91

Modelos e agentes de IA: **✏️ Escolher contas e modelos** também fica recolhida e abre ao tocar no título, como as Definições em vigor.

## 6.7.90

**Modelos e agentes de IA mais simples.** A seção ficou com duas tabelas no mesmo padrão: **📋 Definições em vigor** (recolhida) e **✏️ Escolher contas e modelos**, dividida em Contas, Texto e Voz e áudio, só com os seletores (nomes curtos, esforço junto do modelo, o modelo Gemini da transcrição só aparece quando o motor for o Gemini). Um único **💾 Salvar para todos** grava o que mudou (IA de texto e áudio, conta do Google e voz), com **🧪 Testar o texto** e **▶️ Ouvir a voz** ao lado. Os textos explicativos e os preços saíram. O que é só configuração foi para seções próprias no grupo do administrador: **🔊 Leitura em voz: configurações** (tom, altura, velocidade, referências, o que pular, instruções extras, consumo, tempo e cor) e **🎙️ Áudio em texto: configurações** (tipos de áudio e limites).

## 6.7.89

Definições em vigor: a tabela fica recolhida e abre ao tocar no título, e está dividida em três partes: **🔑 Contas**, **✍️ Texto** e **🔊 Voz e áudio**.

## 6.7.88

Modelos e agentes de IA: no alto da seção, no lugar do texto explicativo, a tabela **📋 Definições em vigor** resume o que está salvo no servidor: conta para texto, conta para voz e áudio, modelo de uso geral, modelo dos esboços e dirigir, voz da leitura, motor da transcrição e modelo do resumo do Áudio em texto. Ela se atualiza ao abrir a seção e depois de cada 💾 Salvar para todos.

## 6.7.87

Modelos e agentes de IA: no cartão do modelo para uso geral o rótulo “Modelo” virou **Escolha o modelo**. No cartão **Leitura em voz: modelo para leitura**, a escolha do modelo, da voz e as configurações da leitura vêm primeiro; o tempo de espera e a cor do destaque (que valem só neste aparelho) foram para o fim do cartão.

## 6.7.86

Definição das contas: nos dois cartões o rótulo da escolha passou a ser **Escolha a conta**. Na conta para voz e áudio saiu o subtítulo “Conta do Google: escolha”, e as duas contas (principal e reserva) ficaram numa moldura só, com o rótulo acima dela.

## 6.7.85

Modelos e agentes de IA: novo contêiner **🔑 Definição das contas**, com dois cartões: **✍️ Conta para modelos de texto** (a escolha “De onde vem a IA” e o teste) e **🔊 Conta para voz e áudio** (a Conta do Google: escolha). Em **Modelos IA para voz e transcrição**, os dois cartões do Áudio em texto ficaram juntos, depois da leitura em voz. O cartão dos esboços passou a se chamar **📜 Produção de texto: modelo para preparação de discursos e esboços e preparar para dirigir**.

## 6.7.84

Modelos e agentes de IA: os cartões **🤖 Modelo da IA de texto** e **☁️ Conta do Google (voz e transcrição)** passaram a se chamar **🤖 Produção de texto: modelo para uso geral** e **☁️ Conta do Google: escolha**.

## 6.7.83

Modelos e agentes de IA: novos nomes. Os contêineres viraram **✍️ Modelos IA para texto** e **☁️ Modelos IA para voz e transcrição**; os cartões, **🎙️ Áudio em texto: modelo para transcrever e resumir**, **🔊 Leitura em voz: modelo para leitura** e **🎙️ Áudio em texto: configurações**.

## 6.7.82

Modelos e agentes de IA: saiu o atalho do menu lateral (a seção continua em Ajustes, no grupo do administrador) e saiu o contêiner do gasto com a IA de texto. Os botões ficaram padronizados: **cada cartão tem o seu 💾 Salvar para todos**, dentro dele (modelo da IA, esboços, Áudio em texto, conta do Google, voz e limites), e nenhum contêiner tem botão solto. O botão da conta do Google, que se chamava “Usar a conta escolhida”, também virou “Salvar para todos”.

## 6.7.81

Modelos e agentes de IA: o cartão **🎙️ Áudio em texto: qual IA transcreve e resume** saiu do contêiner da IA de texto e foi para o contêiner **☁️ Google Cloud: conta, voz e transcrição**, junto das outras configurações do Áudio em texto, com o seu próprio botão de salvar.

## 6.7.80

**Áudio em texto: escolha do motor da transcrição e do modelo do resumo.** Em Modelos e agentes de IA, o novo cartão **🎙️ Áudio em texto: transcrição e resumo** deixa o administrador escolher o **motor da transcrição**: o Chirp 3 (Speech-to-Text do Google, o padrão) ou um **Gemini**, que ouve cada trecho de 50 segundos e o escreve (o modelo Gemini também é escolhido ali). A identificação de quem fala continua sempre no Chirp 3. O **resumo, a sugestão de nomes e a correção** podem usar um modelo próprio, ou o mesmo da IA de texto.

A tela **Modelos e agentes de IA** ficou organizada em três contêineres com moldura e cor próprias: **✍️ IA de texto**, **💲 Gasto com a IA de texto** e **☁️ Google Cloud: conta, voz e transcrição**. O cartão do gasto acompanha o provedor salvo: com a Anthropic mostra o gasto do Claude Console; com o Gemini (ou o Claude pela Vertex) explica que o gasto está no faturamento do Google Cloud e leva até ele, sem consultar a Anthropic.

## 6.7.79

Cabeçalho de segurança do site: saiu o item `interest-cohort` (do FLoC, abandonado pelo Google), que fazia o Chrome mostrar no console o aviso “Unrecognized feature: 'interest-cohort'”. Nada muda no funcionamento.

## 6.7.78

**Modelos e agentes de IA num lugar só.** Nova seção do administrador em Ajustes, **🤖 Modelos e agentes de IA**, com atalho próprio no menu lateral (só aparece com a senha de administrador salva). Ela reúne a IA de texto (de onde vem, modelos, esforço, modelo dos esboços, teste e gasto), a **conta do Google** (principal ou reserva), a **leitura em voz alta** e as **configurações do Áudio em texto**. O modelo da IA tem agora o seu próprio botão de salvar e carrega com a senha salva, sem precisar abrir a tela de prompts; a categoria que sobrou nos prompts virou **📏 Limites**.

## 6.7.77

**Gemini (Google Cloud) como opção de IA de texto.** A tela de prompts ganhou o provedor **Google Cloud · Gemini** (Vertex AI, na conta do Google da empresa, sem chave nova). Cada provedor mostra a sua lista de modelos: Claude (Haiku, Sonnet, Opus, Fable) para Anthropic e Vertex; Gemini 3.1 Flash Lite, 3.5 Flash, 3.1 Pro, 3.8 Flash, 4 Argon e 4 Carbon para o Gemini (os três últimos com preço estimado, por falta de tabela pública confirmada). Um adaptador converte os pedidos do app para o Gemini e a resposta de volta, incluindo respostas estruturadas, nível de raciocínio e imagens; a leitura de páginas pela IA usa a ferramenta de endereços do Gemini. O botão **Testar esta escolha** funciona para o Gemini. Região opcional em `GOOGLE_GEMINI_REGIAO` (padrão “global”). Preços do Gemini são de referência; o gasto real está no faturamento do Google Cloud.

## 6.7.76

**Claude pelo Google Cloud (Vertex AI) como segunda opção de IA de texto.** Na tela de prompts, em “Modelo da IA de texto”, o administrador escolhe **De onde vem a IA**: Anthropic (API direta, como sempre) ou Google Cloud (Claude da Vertex AI, cobrado na conta do Google da empresa, usando a mesma conta de serviço da voz). Vale para todas as funções de IA de texto. O botão **Testar esta escolha** faz um pedido simples e um com resposta estruturada antes de salvar. O padrão continua sendo a Anthropic. Região opcional em `GOOGLE_VERTEX_REGIAO` (padrão “global”). Na Vertex não há o refazer automático em outro modelo, e o gasto aparece no faturamento do Google Cloud, não no painel de consumo.

## 6.7.75

Texto diário: a autorização para ouvir os comentários adicionais passou de 6 para 36 horas, para dar para ouvir à noite os comentários gerados de manhã (antes aparecia “A autorização para ouvir expirou”). Os comentários gerados antes desta versão ainda têm o prazo antigo: gere-os de novo uma vez.

## 6.7.74

**Duas contas do Google Cloud para a voz e a transcrição.** Novo painel do administrador em Ajustes → **☁️ Conta do Google**: escolhe-se a conta **principal** (variáveis `GOOGLE_TTS_CREDENCIAIS`, `GOOGLE_STT_BUCKET`) ou a **de reserva** (`GOOGLE_ALT_CREDENCIAIS`, `GOOGLE_ALT_STT_BUCKET`, opcionais `GOOGLE_ALT_PROJECT_ID` e `GOOGLE_ALT_TTS_API_KEY`). A escolha vale para todos em poucos segundos, sem novo deploy. Se a conta escolhida não estiver configurada, o servidor usa a outra.

## 6.7.73

Ajustes → Consumo de IA e faturamento: o botão Atualizar virou só o ícone 🔄, e o campo do mês/ano passa a mostrar o valor inteiro, sem cortar.

## 6.7.72

Menu lateral: o mês e o valor do consumo de IA ficam centralizados.

## 6.7.71

Anotações → Perguntas de recapitulação: o botão **Organizar de novo com a IA** (e o de organizar as perguntas) ficou mais fino e ocupa toda a largura do cartão.

## 6.7.70

Anotações → lista de assembleias e congressos: o evento já realizado (data gravada anterior à de hoje; no congresso, o último dia) ganha um fundo verde suave e o ✅ ao lado da seta.

## 6.7.69

Anotações: corrigido o calendário da data do evento, que fechava na mesma hora e deixava a data de hoje (o campo recolhia assim que o valor mudava). Agora o campo só recolhe depois que você termina de escolher e sai dele.

## 6.7.68

Anotações: o campo da data do evento fica **aberto enquanto a data não for informada** (num evento novo) e passa a ficar sempre recolhido depois que ela é registrada. Aberto, tem mais espaço entre o campo e a moldura; fechado, nada mudou.

## 6.7.67

Texto diário: o título voltou a ter uma só chave (a pequena); o 🔊 do topo, que já fica junto do título, não leva mais a chave grande.

## 6.7.66

Botão **Ver o texto do parágrafo**: o fundo que aparece ao tocar tem os cantos arredondados (antes saía quadrado).

## 6.7.65

Botão **Ver o texto do parágrafo** (Comentários e Dirigentes): corrigido, a moldura e o fundo não saíam na 6.7.64 (a regra dos botões secundários vencia). Agora é só o texto com o ícone e a setinha (▾ fechado, ▲ aberto), sem caixa nem cor.

## 6.7.64

Comentários (Estudo de A Sentinela): o botão **📖 Ver o texto do parágrafo** vira só o texto com o ícone, discreto como o “Registre a data da sua assembleia”: sem caixa ao redor e sem cor.

## 6.7.63

Revisão geral dos botões que usam a IA ou a voz: todos mostram agora **🔑** quando o código que eles exigem está salvo neste aparelho e **🔒** quando não está. Entram, entre outros: Formatar com IA e Resumo (Anotações), Gravar e resumir o discurso, Gerar resumo (Leitura da Bíblia) e o 🔊 do resumo, Iniciar a transcrição, Sugerir nomes, Corrigir e Resumir com a IA (Áudio em texto), Ler (Leitura em voz alta), comentários do texto diário, respostas e esboços das Reuniões, Outra resposta, Melhorar e Incluir texto(s).

## 6.7.62

Prompt dos esboços (regra fixa, vale em Tesouros, discurso curto, discurso público e Outros esboços): nova regra sobre **textos bíblicos não lidos**. Nem todo texto precisa ser citado, mas, quando uma explicação ou aplicação estiver diretamente ligada a um texto, o orador faz referência a ele na própria fala (por exemplo, “Conforme nos orienta a Bíblia em Mateus 5:3, nossa felicidade está diretamente ligada a satisfazer nossas necessidades espirituais” ou “Em Lucas 21:5, Jesus nos alertou que...”), sem exagero e sem adiantar o conteúdo de um texto que ainda será lido.

## 6.7.61

Outros esboços: o app reconhece o esboço já preparado e salvo mesmo quando ele veio de um esboço pronto importado (sem “Carregar a matéria”): na mesma semana, pelo título do esboço importado ou pelo tema digitado. Aparece o botão **📂 Carregar o esboço já salvo**, que traz sempre a versão mais recente e liga o esboço à pesquisa salva — com isso valem Outra versão, Melhorar e Incluir texto(s).

## 6.7.60

Reuniões → Preparação de discursos e esboços: ao recolher o card de um esboço (Discurso público, Tesouros, discurso curto ou Outros esboços) ou o grupo inteiro, o esboço também sai do campo de texto e, sem nenhum card aberto, o cartão **1. Texto original** some (como já acontecia nos cards de Comentários). O esboço continua guardado em Pesquisas e respostas salvas.

## 6.7.59

Menu lateral: uma linha separa o consumo de IA do restante do menu, por cima (por baixo já havia a do rodapé).

## 6.7.58

Menu lateral: no fim da lista, em letras pequenas e discretas, o **mês atual** e o **consumo de IA até agora** (por exemplo, “Novembro de 2026 · R$ 7,35 até agora”). Só aparece quando o aparelho tem códigos de IA salvos e internet; tocar leva a Ajustes → Consumo de IA e faturamento. Atualiza ao abrir o menu (no máximo uma vez por minuto).

## 6.7.57

Administrador: ao salvar os preços e o PIX, a mensagem “✓ Preços e PIX salvos com sucesso” aparece logo abaixo dos botões (e o botão mostra “✓ Salvo” por instantes); se der erro, o motivo aparece no mesmo lugar.

## 6.7.56

Administrador (Preços do consumo de IA e PIX): cada categoria mostra o **custo de hoje**, em reais e em dólares: a IA de texto e a dos esboços, com os preços do modelo escolhido na tela de prompts (entrada e saída, por 1 milhão de tokens); a voz (por 1.000 caracteres; o Chirp 3 HD é preço de tabela, os modelos Gemini são estimativa) e a transcrição de áudio (por minuto). O dólar é o do dia (ou o que o administrador digitar). Novo botão **Preencher os preços com custo + margem** (margem em %, padrão 100%). “Preparar para dirigir” passou para a categoria dos esboços, que é a IA que ele realmente usa.

## 6.7.55

**Consumo de IA e faturamento.** Novo módulo em Ajustes → 💳 Consumo de IA e faturamento, para o usuário comum: lista os recursos de IA que os códigos salvos no aparelho liberam, o consumo do mês em cada um (tokens de entrada e saída, caracteres lidos em voz alta, minutos de áudio transcrito), o preço de cada categoria e o valor devido, com o total do mês (dá para ver os meses anteriores). Abaixo, a seção **Pagar com PIX**, recolhida por padrão: mostra a chave, gera o QR code e o “copia e cola” (com ou sem o valor do mês). O consumo é contado por aparelho a partir desta versão.

Administrador: em Ajustes → Acesso ao site → 💳 Preços do consumo de IA e PIX, define o preço por categoria (IA de texto e esboços, por 1 milhão de tokens de entrada e de saída; voz, por 1.000 caracteres; áudio em texto, por minuto) e cadastra a chave PIX, o nome e a cidade do recebedor.

Servidor: o uso passa a ser guardado por mês e por tarefa em cada aparelho; a leitura em voz alta (caracteres), a transcrição de áudio (minutos) e o resumo, a correção e os nomes do Áudio em texto (tokens) agora também são contados.

## 6.7.54

Anotações: o botão **Gravar o discurso** passou a se chamar **Gravar e resumir o discurso**.

## 6.7.53

Anotações: as perguntas de recapitulação ficaram com o mesmo tamanho e peso (600, menos intenso) dos temas dos discursos.

## 6.7.52

Anotações: as perguntas de recapitulação (na lista do programa e no cartão da resposta) passaram a usar a mesma fonte do tema dos discursos (.94rem em destaque, linha de baixo .82rem, espaçamento de linha igual).

## 6.7.51

Anotações: logo abaixo dos botões de formatação, uma linha com dois botões finos de modelos prontos: **✅ 𝐀𝐩𝐥𝐢𝐜𝐚𝐫 👉** e **🎯⚡️⚡️ 𝑰𝑴𝑷𝑶𝑹𝑻𝑨𝑵𝑻𝑬 👉**. Tocar insere o modelo onde está o cursor (também no campo da resposta da pergunta de recapitulação).

## 6.7.50

Anotações (inserir texto bíblico): com mais de um versículo, o começo de cada um, do segundo em diante, leva o número em **negrito entre colchetes** (a mesma regra dos textos bíblicos nos comentários), por exemplo: “… contra ele? [𝟐𝟗] Ouvimos …”.

## 6.7.49

Anotações: o botão **Gravar o discurso** passou de azul para vermelho.

## 6.7.48

Anotações (assembleia): o quadro **Gravar o discurso** passou para logo abaixo do botão “Copiar e abrir no JW Library” das anotações, antes do título “Pergunta de recapitulação”.

## 6.7.47

Anotações (programa): o campo da data ficou centralizado e com menos espaço em volta (entre a linha colorida e o campo, e entre o campo e a moldura).

## 6.7.46

Anotações: na tela inicial (Reunião, Assembleia, Congresso) não aparece mais o programa do evento aberto antes; ao voltar para o menu tudo é fechado (as anotações continuam salvas e voltam ao escolher o modo de novo).

## 6.7.45

Anotações (programa): o campo da data do evento perdeu a moldura amarelada e passou a ser recolhível: fica só o texto “📅 Registre a data…” (discreto, como as instruções adicionais de áudio da leitura da Bíblia) e, ao tocar nele, abre o campo da data.

## 6.7.44

Anotações (texto bíblico): ao tocar num livro (ou capítulo) o teclado fecha e a lista de capítulos e versículos sumia da vista; agora a barra e a lista continuam fixas no topo enquanto a lista estiver aberta.

## 6.7.43

Anotações (texto bíblico): com o teclado aberto, a lista de livros, capítulos e versículos agora aparece **logo abaixo da barra fixa**, na área visível (com rolagem própria), e se atualiza conforme se digita; antes ela ficava lá no alto da página, fora da vista.

## 6.7.42

Anotações: (1) a marca ✍️ e o cartão preenchido consideram também a **resposta** à pergunta (e o título da série que a guarda); (2) formatação rápida também no campo da resposta; (3) volta o botão **Atualizar programa** (merge com a WOL sem perder anotações); (4) grupo próprio de Anotações em Privacidade e dados deste aparelho; (5) aviso se o armazenamento local das anotações ficar grande.

## 6.7.41

Anotações: (1) inserir texto bíblico, negrito/itálico/lista e colar o resumo da gravação passam a gravar o rascunho na hora; (2) **Trocar de evento** bloqueia se houver gravação em andamento ou pronta (como Voltar/Programa); (3) a barra bíblica fica fixa com o teclado também na **Reunião**; (4) organizar perguntas com a IA pede o código de pesquisa antes, com aviso claro para Ajustes.

## 6.7.40

Resumo do capítulo da Bíblia: (1) as marcas de versículos (`v.` / `vv.`) passam a ficar **sempre no início** do parágrafo/frase, em todas as seções; (2) na seção de profecias, o cumprimento fica **passado / presente / futuro** sem parênteses, para a voz ler; (3) a marcação da frase lida deixa de se adiantar ou atrasar (a voz não cria mais uma pausa falsa após o “versículos…”, e o realce ignora o que ela pula).

## 6.7.39

Leitura diária da Bíblia: o rótulo “Opções adicionais” do card de leitura passou a ser **Instruções adicionais de áudio**.

## 6.7.38

Anotações: os recados do texto bíblico (“Digite o livro…”, “Buscando…”, “Texto bíblico inserido”) aparecem agora logo abaixo do campo **Livro**, dentro da área branca da barra, que cresce enquanto o recado está na tela e some sozinho depois de alguns segundos (antes ele aparecia lá embaixo, fora da vista). O horário e o número da parte, no alto do campo de anotações, ganharam letra um pouco maior.

## 6.7.37

Anotações (texto bíblico): os contêineres passam a se chamar **Escrituras Hebraicas** e **Escrituras Gregas Cristãs** (sem a cruz; o segundo usa 🕊️). Cada seção tem uma cor só, igual para todos os livros dela (Gênesis–Deuteronômio, Josué–Rute, 1 Samuel–2 Crônicas, Esdras–Ester, Jó–Cântico de Salomão, Isaías–Daniel, Oseias–Malaquias, Mateus–João, Atos, Romanos–Hebreus, Tiago–Judas e Apocalipse); só o Salmos tem a cor da poesia mais forte.

## 6.7.36

Anotações (texto bíblico): a lista de livros agora tem **dois contêineres**, Velho Testamento e Novo Testamento, e cada livro leva o fundo suave da cor da sua seção (Pentateuco, história dos reis, poesia, profetas, evangelhos, cartas…), as mesmas cores da leitura da Bíblia.

## 6.7.35

Anotações: botões reorganizados. Cada campo de texto (anotações e resposta da pergunta) tem, logo abaixo da moldura, **Copiar**, **Formatar com IA** e a lixeira (só o ícone), bem finos, e embaixo o botão **Copiar e abrir no JW Library** na largura toda. **Salvar** e **Word** foram para o fim de tudo, numa moldura própria, os dois numa linha, depois do botão Gravar o discurso.

## 6.7.34

Anotações da assembleia: o campo da **resposta da pergunta de recapitulação** ganhou botões próprios: **Copiar**, **Copiar e abrir no JW Library** (abre a pergunta dela no documento “Preste atenção às respostas…”, para colar como nota da pergunta), **Formatar com IA** (com Desfazer) e lixeira. Os botões de baixo agem só nas anotações do discurso (Copiar e JW Library sem juntar a resposta); Salvar e Word levam o discurso todo, anotações e resposta.

## 6.7.33

Anotações: com o teclado aberto, a barra **Inserir texto bíblico** passa a ficar fixa no topo da área visível (o “sticky” não funciona com o teclado do iPhone), acompanhando a tela; ao fechar o teclado, ela volta ao lugar normal.

## 6.7.32

Anotações: a barra **Inserir texto bíblico** fica congelada no topo da tela enquanto se rola (também na resposta da pergunta de recapitulação); o texto entra no último campo em que se tocou, as anotações ou a resposta. Corrige a 6.7.31, que tinha deixado a barra de fora do topo ao agrupá-la.

## 6.7.31

Anotações da assembleia: ao tocar no campo da resposta da pergunta de recapitulação, o bloco **Inserir texto bíblico** sobe para cima desse campo (antes ficava fora da tela, com o teclado aberto) e o texto é inserido na resposta; ao tocar nas anotações ele volta ao lugar de origem.

## 6.7.30

Anotações da assembleia: tocar numa pergunta de recapitulação da lista abre a tela de anotações do discurso dela, já no campo da resposta.

## 6.7.29

Anotações (assembleia e congresso): o título **Programa da assembleia** (ou **do congresso**) ficou do lado de fora, acima do cartão dos discursos, e o título **Perguntas de recapitulação** também ficou fora, acima do cartão das perguntas.

## 6.7.28

Anotações (assembleia e congresso): a tela do programa agora tem **três contêineres** separados: 1) o alto, que termina no card da data; 2) os discursos, com Ver e Exportar anotações, até o último discurso; 3) as perguntas de recapitulação (só na assembleia de circuito).

## 6.7.27

Anotações da assembleia: o ícone ❓ saiu dos temas na lista do programa (as perguntas continuam na lista de perguntas e dentro de cada discurso).

## 6.7.26

Anotações da assembleia de circuito: o título **Pergunta de recapitulação** passou para a área cinza, fora do card da resposta; e, na página do programa, depois dos discursos, há um contêiner à parte com a **lista das perguntas de recapitulação** (cada uma mostra o discurso dela e abre esse discurso ao tocar), junto do aviso e do botão da IA.

## 6.7.25

Anotações da assembleia de circuito: **perguntas de recapitulação**. O programa traz a segunda sessão (“Preste atenção às respostas para as seguintes perguntas”); cada discurso principal que tem pergunta (não têm o batismo, as experiências e o resumo de A Sentinela; a série de discursos tem uma só) mostra a pergunta num campo próprio, abaixo das anotações, para escrever a resposta. A pergunta é atribuída sozinha pela ordem do programa; quando o número de perguntas não bate com o de discursos, a **IA organiza** qual pergunta vai em cada parte (e há um botão para organizar de novo). A pergunta e a resposta vão junto ao copiar, salvar, enviar ao JW Library e nos Words.

## 6.7.24

Anotações: a faixa do título do card aberto ficou um pouco mais escura (azul-acinzentado, na mesma cor das faixas Manhã e Tarde).

## 6.7.23

Anotações: a faixa do título do card aberto voltou a ter o fundo próprio (cinza-azulado suave), mesmo com o dedo ainda em cima.

## 6.7.22

Anotações (assembleia e congresso): as faixas **Manhã** e **Tarde** ficaram em azul-acinzentado forte, com texto branco; e os cartões das partes não mudam mais de cor ao passar o dedo ou o mouse — a cor só muda quando há anotações.

## 6.7.21

Anotações (assembleia e congresso): as faixas **Manhã** e **Tarde** passaram para um cinza-azulado mais forte (em vez da cor do modo).

## 6.7.20

Anotações (assembleia e congresso): as faixas **Manhã** e **Tarde** ganharam uma cor mais forte, na cor do modo, com uma barra mais escura na esquerda.

## 6.7.19

Anotações: os botões do topo (Voltar, Programa e Trocar de evento) têm agora o mesmo tamanho, e o **Trocar de evento** fica em duas linhas (“↩ Trocar / de evento”), sem cortar; a data do evento ganhou uma moldura com um fundo bem suave, na cor do modo.

## 6.7.18

Anotações (assembleia e congresso): o botão **Trocar de evento** passou para o topo da tela do programa, no lado direito da linha do Voltar (letra menor); a linha de botões abaixo da data fica só com Ver anotações e Exportar anotações, e some quando ainda não há anotações.

## 6.7.17

Leitura diária da Bíblia: o texto “Opções adicionais” desceu um pouco e ficou quase encostado na moldura de baixo do card de leitura.

## 6.7.16

Leitura diária da Bíblia: o bloco **Opções adicionais** do card de leitura ficou discreto: sem moldura em volta e só um texto fininho, pequeno e cinza, com pouco espaço.

## 6.7.15

Leitura diária da Bíblia: as opções de leitura saíram do alto de cada modo e foram para dentro do **card de leitura de cada capítulo**, num bloco recolhível **⚙️ Opções adicionais** logo abaixo dos botões finais (Ler na WOL, Ler no JW Library, Resumir). Por livros: tocar o próximo capítulo e o máximo de capítulos (2 a 10); por seções e temas: ler só os capítulos sugeridos para o dia; nos dois: gerar e ler o resumo automaticamente. Dá para abrir e mudar a opção enquanto lê: vale já no fim do capítulo que está tocando. Começa recolhido; o que foi aberto fica aberto nos outros cards enquanto o app está aberto.

## 6.7.14

**Leitura diária da Bíblia, opções de leitura** (agora na própria tela, em cada modo; saíram do Ajustes): em **Livros, na ordem da Bíblia**: “Ao terminar um capítulo, tocar o próximo” (que estava no Ajustes), com o **máximo de capítulos lidos automaticamente** (de 2 a 10, contando o que você iniciou); em **Seções e temas**: “Ler automaticamente só os capítulos sugeridos para o dia” (o grupo do dia: toca o próximo capítulo só enquanto for do mesmo grupo); nos dois modos: **Gerar e ler o resumo automaticamente**: ao terminar o capítulo, o app fala “Aguarde... gerando resumo”, gera o resumo (se ainda não existe) e o lê em voz alta; depois segue para o próximo, se a opção de seguir estiver ligada (precisa do código de resumo e do código de leitura).

**Estudo de A Sentinela, Preparar para comentar e dirigir**: abaixo de cada pergunta do parágrafo, um botão na largura do cartão, **📖 Ver o texto do parágrafo** (recolhido por padrão), que abre para baixo com o texto do parágrafo (ou dos parágrafos) da pergunta, lido no wol.jw.org sem IA.

## 6.7.13

Anotações: na programação, o cartão da parte que já tem orador, congregação ou anotação ganha um fundo na tonalidade da linha colorida do modo (âmbar na assembleia, verde no congresso), para ver de relance o que já foi preenchido. A lista é refeita ao voltar da anotação para o programa.

## 6.7.12

Pesquisas e respostas salvas: (1) o título da página passa a ter duas linhas (o botão da direita, que não aparece ali, não ocupa mais espaço); (2) nova seção **🗒️ Anotações**, exclusiva para as anotações salvas na tela Anotações: um grupo para as **Reuniões** e, para assembleias e congressos, **um grupo por evento**, com as anotações na ordem do programa. As anotações já salvas antes saem de “Textos” e entram aqui (o evento vem do nome).

## 6.7.11

Anotações: saiu o botão **Atualizar programa** da tela do programa; fica só o **Atualizar lista** (na tela de escolha do evento). Os botões da tela do programa voltam a dividir a mesma linha.

## 6.7.10

Anotações: dois botões para acompanhar a WOL: **🔄 Atualizar lista** (na tela de escolha do evento): busca de novo na WOL a lista de programas, ignorando o cache do aparelho e o do servidor (o servidor aceita no máximo uma busca forçada por minuto) — para quando um programa novo, como o congresso de 2027, acabou de sair; e **🔄 Atualizar programa** (na tela do programa): busca o programa do evento aberto e junta com o que já existe, mantendo anotações, orador e congregação (partes que saíram do programa mas têm anotação vão para o fim, numa seção à parte). Os botões da tela do programa ficam em duas colunas.

## 6.7.09

Anotações: corrigido o programa que traz o título de uma parte nas linhas de baixo, como o **VÍDEO PRINCIPAL:** do congresso (“A História e o Ministério de Jesus: Episódio 4 ‘Foi Por Isso Que Eu Vim’”): o título agora entra no tema da parte e as referências bíblicas vão para o texto temático. Um programa já guardado com o título incompleto é completado sozinho ao ser aberto de novo (as anotações, o orador e a congregação não mudam). No congresso, a programação agora abre com **todos os dias recolhidos**, e tocar no dia aberto o recolhe (abrir um dia continua fechando o outro).

## 6.7.08

Anotações: (1) no **congresso**, a programação de cada dia é recolhível (cartão com o dia, a data e o tema do dia) e **um dia fica aberto de cada vez**: abrir um dia fecha os outros (abre primeiro o dia de hoje, se a data do congresso foi registrada, ou o primeiro); (2) tocar no **tema do evento** (entre as duas linhas coloridas) abre o programa do evento no app JW Library.

## 6.7.07

Anotações: (1) novo botão **📄 Exportar anotações** na tela do programa (junto de Ver anotações e Trocar de evento): gera um Word com todas as anotações do evento, começando pelo tema da assembleia ou do congresso e, para cada discurso com anotação, o tema, o horário, o orador e a congregação, e as anotações; (2) no congresso, antes de cada dia vêm o nome do dia, a data e o **tema do dia** (lido do programa na WOL); (3) o texto copiado (Copiar e Copiar e abrir no JW Library), o Salvar e o Word da anotação levam **sempre**, além das notas, o tema do discurso, o horário, a data e os dados do orador. Por isso saiu da Reunião o botão “Inserir cabeçalho nas anotações”. Os discursos de uma série (que não têm horário próprio) levam o horário de início da série, e os títulos em negrito mantêm os acentos.

## 6.7.06

Anotações: o tema (do cabeçalho da parte, da moldura do programa e da lista de partes) passa a ocupar no máximo **3 linhas** (antes 2), para caber o título da série e o tema do discurso.

## 6.7.05

Anotações: nas **séries de discursos**, o título da série (“Série de discursos: …”) passa a ser só informativo, sem cartão e sem orador, como música e cântico, mas em fonte maior e em negrito (as setas também passam direto por ele); o orador é informado em cada discurso da série. O tema de cada discurso aparece com o título da série na frente e um travessão (“Busque o que traz verdadeira felicidade — Um estilo de vida simples”) no cabeçalho da anotação, no Salvar, no Copiar e no Word.

## 6.7.04

Anotações: na parte aberta do programa, nova lixeira ao lado de Iniciar/Continuar a anotação, que limpa o orador e a congregação daquela parte.

## 6.7.03

Anotações: o título acima do campo de texto bíblico passa a “📖 Inserir texto bíblico nas anotações”, em negrito.

## 6.7.02

Anotações: o campo de mensagens sob os botões (“Texto bíblico inserido.” e parecidas) deixou de mostrar o que deu certo; só aparecem os avisos do que falhou ou falta fazer. Copiar e Salvar confirmam piscando “✓ Copiado” / “✓ Salvo” no próprio botão.

## 6.7.01

Anotações: (1) **texto bíblico inserido** em novo formato: a referência (livro, capítulo e versículos) em **negrito**, depois “:” e, na mesma linha, o texto todo entre aspas e em *itálico* (os acentos continuam aparecendo no negrito e no itálico); (2) novo botão **✨ Formatar com IA**, na mesma linha do Copiar e abrir no JW Library: a IA deixa o texto pronto para colar no campo de notas do JW Library usando só emojis e letras maiúsculas para dar destaque (muitos emojis para ilustrar os pontos), mantendo os negritos e itálicos que a pessoa já fez; dá para **desfazer** a formatação (as instruções da IA estão em Prompts da IA → Formatação de texto); (3) título “📖 Inserir texto nas anotações” acima do campo de texto bíblico; (4) tocar no **card do tema e do orador** abre o programa com a parte aberta, no lugar de editar o orador e a congregação.

## 6.7.00

Anotações: um pouco mais de espaço (uns 10 px) entre a linha colorida do tema e a barra das setas / a programação. Numeração: o último número da versão nunca passa de 99 (depois da 6.6.99 vem a 6.7.00); as versões 6.6.100 a 6.6.102 foram publicadas fora dessa regra e esta é a primeira que a retoma.

## 6.6.102

Anotações: menos espaço entre a linha colorida do tema e o que vem logo abaixo (a barra das setas ou a programação).

## 6.6.101

Anotações: na gravação pronta, os botões passam a se chamar apenas **Resumo** e **Salvar**.

## 6.6.100

Anotações: depois de parar a gravação do discurso, novo botão **💾 Salvar o áudio**: baixa o arquivo (no iPhone abre o compartilhar, de onde dá para guardar em Arquivos), com o nome “Gravação - tema - data”. Depois de **Fazer o resumo**, o áudio só some da tela quando já foi salvo; senão continua disponível para salvar ou descartar.

## 6.6.99

Anotações: a linha colorida do topo (a cor do modo) também fecha o tema por baixo, nas telas do programa e da anotação.

## 6.6.98

Anotações: na moldura do programa no alto, o texto temático (por exemplo, “Salmo 37:4”) passa para a mesma linha do tema, ligado por um travessão (“Tema — Salmo 37:4”), em no máximo duas linhas.

## 6.6.97

Anotações: o cabeçalho da parte (setas e tema) ficou mais baixo; o tema e o texto temático ficam na mesma linha, ligados por um travessão ("Tema — Texto"), em no máximo duas linhas, com a fonte se ajustando à largura da tela; o nome do orador e a congregação vão numa linha só, em fonte pequena e discreta, logo abaixo do tema; o horário e “Parte x de y” passam para uma linha pequena embaixo da barra. A lista do programa também mostra tema e texto temático na mesma linha, até duas linhas. O rótulo da data passou a “Registre a data da sua assembleia” (no congresso, “Registre a data do seu congresso”), e a tela não ganha mais rolagem lateral com textos longos.

## 6.6.96

Anotações: a data do evento (e a da reunião) fica centralizada dentro do campo.

## 6.6.95

Anotações: botões mais finos e leves em toda a tela (altura menor, texto numa linha só, sem negrito e com fonte menor): Copiar, Salvar, Word e lixeira, Copiar e abrir no JW Library, Gravar o discurso, formatação (negrito, itálico…), texto bíblico, os botões do topo e os das partes do programa. O título do topo ("Anotações · Assembleia") fica em no máximo duas linhas. Saiu o aviso "O que você escreve é guardado sozinho…" abaixo do campo de texto (o salvamento automático continua).

## 6.6.94

Anotações: (1) lixeira no campo de texto bíblico, ao lado de Inserir e 📚; (2) os botões Um a um, Corrido, Capítulo todo e Limpar da escolha de versículos saíram: toque liga/desliga o versículo (2, 4, 6) e **toque longo** (ou Shift+clique) no último escolhe o trecho corrido desde o anterior; (3) o botão **📋 Programa** foi para o topo, no lado direito do Voltar; (4) o cabeçalho da parte mostra também o **horário** (e o período) do discurso; (5) **gravação** redesenhada num quadro só: Gravar → gráfico de barras reduzido, tempo, Pausar/Retomar, Parar e Descartar; depois de parada, a gravação fica pronta e **Fazer o resumo** é um botão à parte (ou Descartar); (6) Copiar, Salvar, Word e a lixeira (Limpar, só o ícone) ficam na mesma linha, o botão do JW Library vem depois e a gravação por último; o campo de texto ficou bem maior.

## 6.6.93

Anotações: o campo de data (assembleia, congresso e reunião) não sai mais da tela no iPhone: passa a seguir a largura da caixa.

## 6.6.92

Anotações, texto bíblico guiado: ao digitar no campo de texto bíblico, o app já sugere os livros (“jo” → Josué, Jó, Joel, Jonas, João, 1 João, 2 João, 3 João); ao escolher o livro, abre a grade de capítulos; ao escolher o capítulo, abre a de versículos, com três jeitos: um (toque no versículo), **intercalados** (toque em 2, 4 e 6) e **corrido** (modo “de / até”: toque no primeiro e no último), além de “Capítulo todo”. A referência vai sendo escrita no campo (por exemplo, “João 3:2-4, 6”) e o botão Inserir coloca o texto no cursor. Digitar a referência inteira continua funcionando. Livros de um capítulo só pulam a escolha do capítulo.

## 6.6.91

Anotações: corrigido o menu (Reunião, Assembleia, Congresso), que mostrava por baixo os campos de anotação (a 6.6.90 deixou a área de trabalho aparecer sempre).

## 6.6.90

Anotações: (1) espaçamento revisado, com o mesmo espaço entre todas as caixas (nada emendado); (2) o tema do evento ficou mais leve e sem moldura (nome pequeno, tema em peso médio e texto temático discreto); (3) **data do evento**: a assembleia tem uma data; o congresso, o primeiro dia (sexta-feira), e o domingo é calculado sozinho (se a data não for sexta, o app avisa). A data entra no cabeçalho das anotações (no congresso, a de cada dia: sexta, sábado ou domingo), e a reunião também ganhou o campo Data; (4) **abertura automática**: ao entrar em Assembleia ou Congresso, o app já abre o evento com data gravada que está em andamento ou começa nos próximos 30 dias (o mais próximo); senão, mostra a lista para escolher.

## 6.6.89

Anotações: o botão **Salvar** não pergunta mais o nome: guarda uma cópia em Pesquisas e respostas salvas → Textos, já ligada ao evento e à parte (ou à reunião), e salvar de novo **atualiza a mesma entrada** em vez de criar outra. Aviso fixo abaixo do campo lembra que a anotação já é guardada sozinha neste aparelho, em cada parte.

## 6.6.88

Anotações (assembleia e congresso), nova navegação em três telas: **lista de eventos → programa do evento → anotação de uma parte**. Entrar em Assembleia ou Congresso abre sempre a lista de eventos. Escolhido o evento, o tema aparece **uma vez** no alto (nome pequeno, tema grande em negrito e texto temático) e, logo abaixo, a programação, sem o título “Partes do programa” e sem o botão ＋ Parte (os programas não mudam). Na tela do programa não aparece o campo de anotações. **Voltar** sempre vai para a tela anterior (anotação → programa → lista de eventos → menu); **Trocar de evento** também leva à lista. Se o evento já tem anotações, aparece **✍️ Ver anotações**, que abre a primeira anotação na ordem do programa. As anotações ficam guardadas por evento e voltam ao escolhê-lo de novo. O tema do evento aparece também no alto da tela de anotação.

## 6.6.87

Anotações: ao sair da tela e voltar, ela abre no menu (Reunião, Assembleia, Congresso), com tudo recolhido, para escolher de novo. As anotações de cada modo continuam salvas e voltam ao escolher o modo.

## 6.6.86

Anotações (assembleia e congresso): música, cântico, oração, anúncios e intervalo passam a só informar, sem cartão e sem toque (e as setas ◀ ▶ pulam por eles); a parte aberta ganha a borda colorida em volta de tudo, inclusive do tema; o programa escolhido aparece numa moldura centralizada (nome pequeno, tema grande em negrito e texto temático embaixo); com a anotação em andamento, o cartão de seleção some e ficam só o tipo e o tema, sem moldura; novo botão **Copiar** e o do JW Library passa a **Copiar e abrir no JW Library**, no roxo do JW Library.

## 6.6.85

Anotações (assembleia e congresso): (1) a lista mostra só os programas do ano de hoje em diante; os anteriores ficam em “Mostrar programas anteriores”. (2) Cada programa mostra o tipo, o ano e o **tema** (por exemplo, “Feliz É Aquele Que Confia em Jeová”). (3) O programa é um cartão recolhível, fechado ao abrir a tela, com o título “Selecione a assembleia/o congresso que você está assistindo”. Ao escolher, as partes carregam abertas, sem barra de rolagem. Tocar numa parte abre orador, congregação e **Iniciar anotação**; ao iniciar, o tema da parte fica em destaque no alto do campo de texto, com o orador discreto embaixo, e as setas ◀ ▶ (as mesmas da semana das Reuniões) trocam de parte, carregando a anotação que já existir. Cada parte guarda a sua própria anotação; Salvar e Word levam o cabeçalho junto.

## 6.6.84

Anotações, revisão geral. **Lista automática de programas:** ao abrir Assembleia ou Congresso, o app já mostra os programas disponíveis na WOL (assembleias de circuito com o superintendente e com o representante de Betel, e congressos), do mais novo para o mais antigo; tocar num deles carrega as partes, sem digitar código (o código/link continua em “Outro programa”). O congresso carrega os três dias, com Sexta, Sábado e Domingo separados. **Visual:** a tela segue o padrão do app (barra do topo com Voltar e linha na cor do modo, atalhos grandes no menu, caixas, botões e mensagens como nas outras telas). **Correções:** os campos de um modo não passam mais para o outro; as anotações são salvas sozinhas enquanto você escreve; a gravação mostra o tempo e não deixa voltar com ela em andamento; o menu do Início ganhou cor própria.

## 6.6.83

Anotações: o programa da assembleia/congresso passa a ser lido da WOL com as partes e o `data-pid` (ex. documento 1102027242 / CA-brpgm27), não só a capa em imagem. Botão **📖 JW Library** copia as anotações e abre a parte no app para colar no campo de notas.

## 6.6.82

Nova tela **Anotações** (reunião, assembleia e congresso) no lugar do atalho Formatar: barra para inserir texto bíblico, carregar programa (código/link JW Library ou WOL, ex. CA-brpgm27), orador/congregação, formatação rápida, gravação com transcrição e resumo, salvar e exportar Word. Formatar fica só no menu.

## 6.6.81

Tela de cadastro enviado: botão "Verificar se o acesso foi liberado". Consulta o servidor; se o administrador já aprovou, abre o NoteStyle; senão, avisa que ainda está em análise.

## 6.6.80

Cadastro enviado: o formulário fecha e abre a tela institucional com o aviso "Cadastro enviado. Aguarde a aprovação do administrador." (também ao reabrir o app com o cadastro em análise). Se a pessoa tocar em Solicitar acesso de novo, o app avisa que já há um cadastro para este aparelho e sugere avisar o administrador por WhatsApp ou e-mail.

## 6.6.79

Página Sobre: "Convidar alguém" só aparece para aparelho cadastrado, sem exceção: ter a senha de administrador salva não basta (o administrador também precisa estar cadastrado).

## 6.6.78

Página Sobre: a seção "Convidar alguém" só aparece para usuários cadastrados (e para o administrador). O texto do convite continua só editável pelo administrador; os demais usuários só o veem e o enviam.

## 6.6.77

Cadastro (Identifique-se e Meus dados): campos obrigatórios marcados com * e a nota "* Campos obrigatórios". Congregação e "Como conheceu o app?" passam a ser opcionais (também no servidor).

## 6.6.76

Tela Identifique-se: corrigido o texto para "…solicite o acesso ao administrador."

## 6.6.75

Campo Telefone de contato: o exemplo da máscara agora mostra (00) 00000-0000 (antes aparecia um número real), também na mensagem de erro.

## 6.6.74

Tela Identifique-se: novo texto de apresentação ("…preencha seus dados e solicite o acesso ao administrador.") e botão "Enviar cadastro e solicitar acesso".

## 6.6.73

Tela de abertura com o logo ao abrir o app: se o aparelho já está cadastrado, abre o Início; se não, abre o cadastro. O cadastro e a tela institucional (ao cancelar) agora ocupam a tela inteira, com fundo opaco: o app não aparece mais por trás.

## 6.6.72

Cadastro e Meus dados: campo obrigatório **Telefone de contato** com máscara `(64) 98180-8090`. O número aparece na lista do administrador (pendentes e identificados). Política de Privacidade 2.1, Termos 1.2 e texto da página Sobre atualizados.

Texto diário: removido o botão "Levar para o campo de texto". Leitura da Bíblia: os botões do capítulo passam a se chamar "Ler na WOL" e "Ler no JW Library".

## 6.6.71

Cadastro na primeira abertura: botão **Cancelar** no formulário. Ao cancelar, aparece uma tela com o logo do NoteStyle, o que o app faz, o logo da Carvalho Apps e o botão **Solicitar acesso**, que volta ao formulário de cadastro.

## 6.6.70

Usuários identificados: lista compacta — só **nome, idade e cidade** à vista; ao tocar, abre o restante (nível, congregação, códigos, aparelho e revogar). **Termos de Uso 1.1** e **Política de Privacidade 2.0** atualizados com o cadastro obrigatório, a aprovação/revogação pelo administrador e as estatísticas de acesso/IA.

## 6.6.69

Uso de IA nas estatísticas: o servidor grava tokens **ainda durante** a consulta (antes de responder ao app). Antes, a gravação ficava para depois da resposta e a Vercel encerrava a função — o resumo de capítulo da Bíblia rodava, mas o uso não aparecia.

## 6.6.68

Correção das estatísticas: o perfil (admin/normal e códigos salvos) passa a sincronizar de verdade ao abrir o app ou atualizar a lista; o uso de IA (ex.: resumo de capítulo) é gravado com await e com nova tentativa se houver conflito no Blob — antes o ping do dia e a gravação em paralelo apagavam nível, códigos e tokens.

## 6.6.67

Estatísticas de acesso: cada aparelho mostra o **nome do usuário** (quando cadastrado), os **recursos de IA usados no último acesso** e quantos **tokens** foram gastos neles. Em **usuários identificados**: nível **normal** ou **admin** e quais **recursos especiais** (códigos) aquele aparelho tem salvos.

## 6.6.66

Cadastro e Meus dados: ao escolher o **estado**, o app carrega só as **cidades daquele UF** (lista IBGE, sob demanda) para escolher na lista — sem embutir as 5.570 cidades no app.

## 6.6.65

Tela de cadastro (e Ajustes → Meus dados): idade vira **mês e ano de nascimento** (listas), com idade aproximada calculada; **estado** em lista dos UFs; **como conheceu o app** com opções comuns e “Outros meios”.

## 6.6.64

Ajustes → **👤 Meus dados**: depois do cadastro obrigatório, o usuário (e o administrador) pode abrir e alterar nome, sobrenome, idade, cidade/estado, congregação e como conheceu o app. A alteração vale na hora, sem nova aprovação.

## 6.6.63

Cadastro obrigatório para **todo** aparelho (usuários antigos e administrador inclusive): ao abrir o site, quem ainda não se identificou vê a tela com nome, sobrenome, idade, cidade/estado, congregação e como conheceu o app. Sem cadastro o app fica bloqueado. A opção do administrador “Exigir minha aprovação nos cadastros novos” só decide se o cadastro libera na hora ou fica pendente.

## 6.6.62

**Restrição de acesso ao site inteiro** (card separado em Ajustes → 🚪 Acesso ao site, só administrador): com a opção ligada, aparelhos novos veem um formulário de pedido (nome, idade, cidade, congregação, como conheceu o app) e ficam bloqueados até a aprovação. Ao ligar pela primeira vez, aparelhos já vistos nas estatísticas continuam liberados. O administrador aprova/recusa pedidos e pode revogar aparelhos; no bloqueio dá para entrar com a senha de administrador. As estatísticas saíram dos prompts da IA e ficaram neste card. O servidor também recusa IA, voz, texto diário e áudio em texto se o aparelho não estiver autorizado.

## 6.6.61

Esboços e discursos: a IA tem agora até 275 segundos numa só tentativa. Antes, quando a primeira tentativa passava de 170 s, a segunda tentativa estourava os 300 s da função e o app mostrava "A IA demorou demais" (discurso público, tema 46).

## 6.6.60

Esboços e discursos (Tesouros, discurso curto, discurso público e Outros esboços): corrigido o erro "Não foi possível obter sugestões agora" ao elaborar o discurso público (tema 46). A IA gastava quase todo o espaço de resposta pensando e a resposta saía cortada. Os esboços voltam a não receber a regra de fontes da 6.6.57 e ganham mais espaço de resposta (21 mil em vez de 16 mil).

## 6.6.59

Painel **📊 Estatísticas de acesso e IA** (Ajustes → prompts, só administrador): cada aparelho recebe um identificador anônimo; o app registra visitas (novo × recorrente no dia), consultas à IA e tokens de entrada/saída por aparelho e no total. A restrição de novos acessos com formulário de autorização fica para uma próxima versão.

## 6.6.58

Preparar para dirigir → perguntas adicionais: os botões Copiar e JW Library agora aparecem logo na primeira geração, ao lado das perguntas (antes só apareciam depois de trocar de parágrafo com as setas e voltar).

## 6.6.57

(1) 🧠 Aprender com esta correção: a lição passa a ser guardada mesmo com a chave geral da memória desligada (antes o servidor recusava em silêncio; a chave só decide se as lições entram nas respostas), e o resultado aparece numa barra visível, avisando quando a chave está desligada. (2) Nova regra fixa para a IA: buscar sempre primeiro as informações nos arquivos do servidor (Bíblia, Perspicaz e livros) e, nas pesquisas no wol.jw.org, dar prioridade total às matérias mais recentes (os resultados da pesquisa também passam a vir do ano mais novo para o mais antigo).

## 6.6.56

Resumo do capítulo da Bíblia: na seção de profecias, os rótulos "Profecia:" e "Cumprimento (passado/presente/futuro):" ficam sempre em negrito, em todos os itens.

## 6.6.55

Resumo do capítulo da Bíblia: as cores e o negrito ficam só nos títulos e nos destaques curtos. Um parágrafo (ou um trecho de 100 letras ou mais) que a IA pôs em negrito não vira mais um bloco roxo: aparece como texto normal; e o destaque comprido deixa de ser marcado nos resumos novos. Também só a primeira linha (o cabeçalho "📚 …") ganha o estilo de título; um parágrafo que a IA começou com o emoji 📚 é texto normal.

## 6.6.54

Resumo da Bíblia → profecias: o cumprimento passa a ter **três** rótulos — **(passado)**, **(presente)** e **(futuro)**. Exemplo em Daniel 2: os pés de ferro e argila são Cumprimento **(presente)** (potência anglo-americana atual), não futuro; o golpe da pedra na estátua continua **(futuro)**.

## 6.6.53

(1) Resumo da Bíblia: a opção 🔮 Profecias e expressões simbólicas passa a ser marcada automaticamente uma vez nas preferências já salvas (dá para desmarcar). (2) O pedido à IA exige a seção própria **PROFECIAS E EXPRESSÕES SIMBÓLICAS** (não basta citar a visão no RESUMO) e, ao “Gerar de novo”, acrescenta essa seção se ela ainda não existir no texto salvo.

## 6.6.52

(1) Perguntas adicionais do dirigente: os botões Copiar e 📖 JW Library voltam a aparecer logo após gerar (o `semBotoes` da versão 6.6.39 escondia os dois). (2) No computador, o aviso “Não consegui abrir o JW Library” não aparece mais em falso (o app de mesa costuma abrir sem tirar o foco do navegador). (3) Cache das matérias da semana atualizado (V2): as leituras antigas sem o parágrafo (`pid`) do JW Library são descartadas; basta carregar a matéria de novo. (4) Resumo do capítulo da Bíblia: nova opção 🔮 **Esclarecer profecias e expressões simbólicas**, que gera a seção **PROFECIAS E EXPRESSÕES SIMBÓLICAS** (padrão Profecia / Cumprimento passado, presente ou futuro), com consulta ao Estudo Perspicaz e, se preciso, ao wol.jw.org — útil em Daniel, Ezequiel, Apocalipse, alguns salmos, Gênesis e outras passagens simbólicas.

## 6.6.51

Resumo do capítulo da Bíblia: o título de cada seção volta a ter o emoji dela na frente (🌟 SOBRE JEOVÁ, 🛠️ APLICAÇÕES PRÁTICAS, 🏛️ FUNDO HISTÓRICO…), também nos resumos que já estavam sem ele.

## 6.6.50

(1) Resumo do capítulo da Bíblia: os títulos das seções mantêm os traços coloridos mesmo quando a IA os põe em negrito ou com ":" no fim (antes, ao gerar de novo, esse título virava um subtítulo comum e perdia a cor). (2) Leitura em voz alta (resumo do capítulo e texto diário): a tela agora aceita rolar durante a leitura; ela só volta a acompanhar a frase lida depois de 4 segundos sem mexer, na próxima troca de frase.

## 6.6.49

Resumo do capítulo da Bíblia, com a formatação de verdade (como nos comentários adicionais do texto diário): a tela do resumo passa a desenhar o texto com títulos das seções em **cores diferentes**, **negrito e itálico de verdade, com acentos**, marcas de versículos "(vv. 1-3)" coloridas, nomes de personagens e lugares em destaque e os emojis. O texto é guardado em letras comuns, com marcas simples (**negrito** e __itálico__), então a voz lê sem tropeçar nas letras especiais. O botão ✏️ Editar mostra o texto com as marcas para corrigir; Copiar, Word e Salvar levam o texto com letras de negrito e itálico (as cores só aparecem na tela). A leitura em voz alta usa a mesma vista, com a frase lida destacada.

## 6.6.48

Resumo do capítulo da Bíblia: o texto novo sai em letras comuns (com acentos e pontuação), sem as letras especiais de negrito e itálico, que atrapalhavam a leitura em voz alta (a voz lia "vv." como "vê vê"). Ficam os emojis, os títulos das seções em maiúsculas e os parágrafos. Resumos antigos continuam como estão (a leitura em voz alta já entende as letras especiais); para trocar, gere o resumo de novo.

## 6.6.47

Barra do topo: o ícone do NoteStyle ficou um pouco maior (de 34 para 40 px), para ter a altura do bloco do nome e do slogan; a faixa não muda de altura.

## 6.6.46

Tela do resumo do capítulo: o botão de ouvir passou para o topo, junto do Fechar, só com o ícone do alto-falante (grande), como no texto diário; brilha enquanto a leitura está aberta.

## 6.6.45

(1) O gráfico de barras do player das leituras em voz (texto diário, Leitura e comentários) ficou pequeno e à direita da situação ("Lendo… 67%"), no mesmo padrão do player da leitura da Bíblia, e não mais numa linha toda. (4) No resumo, o que está entre parênteses só é lido se for referência aos versículos ("Gên. 1:3"; as marcas "vv. 1-3" são lidas por extenso) e a linha das fontes (🔎 Fontes / Estudo Perspicaz) aparece mas não é lida. (3) Na leitura em voz alta, as marcas de versículos dos resumos são lidas por extenso: "vv. 1-3" vira "versículos de um a três", "v. 5" vira "versículo cinco" e "vv. 1, 3" vira "versículos um e três". (2) Novo botão 🔊 Ouvir na tela do resumo do capítulo da Bíblia: lê o resumo em voz alta (a mesma voz da Leitura em voz alta, com o código de leitura), com a frase lida destacada e o player com o gráfico; ao parar, o campo do resumo volta.

## 6.6.44

(1) O botão "Recuperar as perguntas salvas" não aparece mais logo depois de gerar uma resposta (a resposta que acabou de ser salva já está no campo; antes o aviso automático não rodava enquanto a IA estava ocupada). (2) Os botões Copiar e JW Library no campo de texto ficam no meio do espaço entre as respostas (com mais folga embaixo), para não caírem por cima da última linha. (3) Na recapitulação do dirigente o aviso diz "respostas salvas".

## 6.6.43

Recapitulação de A Sentinela (Comentários e Dirigentes): cada resposta ganha o botão 📖 JW Library ao lado do Copiar, que copia a resposta e abre a pergunta da recapitulação no app. Só nas respostas geradas a partir de agora.

## 6.6.42

Preparar para dirigir → A Sentinela: depois do último parágrafo, a seta leva à **Recapitulação**, e o botão passa a **responder as perguntas da recapitulação** (como em Comentários, mas com o código do dirigente e o modelo de IA da elaboração das perguntas). Com resposta salva da recapitulação, ela é a base e a nova a substitui; a salva aparece sozinha ao voltar à recapitulação.

## 6.6.41

O botão 📖 JW Library das imagens (apostila, artigo de A Sentinela e dirigente) agora também copia a descrição da imagem (a mesma do Copiar, com o modelo IMAGEM) antes de abrir o app no lugar dela.

## 6.6.40

Imagens do artigo de A Sentinela (Comentários e Dirigentes): o botão 📖 JW Library aparece ao lado do Copiar da descrição de cada imagem e abre o artigo no lugar da imagem (o servidor passa a enviar o parágrafo que vem logo depois dela; para as imagens já carregadas, toque em Recarregar matéria da semana).

## 6.6.39

A barra de botões do topo do campo Texto original volta a ser a de antes (Limpar com texto). O botão 📖 JW Library das perguntas adicionais do dirigente fica no fim das perguntas, ao lado de Copiar perguntas, como no resto do app (copia as perguntas e abre o parágrafo). Perguntas salvas antes também ganham o botão: basta recarregar a matéria da semana uma vez (o servidor passa a enviar o parágrafo de cada número).

## 6.6.38

Barra de botões no topo do campo Texto original (celular): Limpar ficou só com o ícone da lixeira, para dar espaço, e nas perguntas adicionais do dirigente há um novo botão 📖 JW Library que copia as perguntas e abre o parágrafo consultado direto no app (é só colar no campo certo). O servidor passa a enviar o parágrafo consultado; perguntas salvas antes só ganham o botão ao gerar de novo.

## 6.6.37

Preparar para dirigir (perguntas adicionais do estudo de A Sentinela e preparação do Estudo Bíblico do dirigente) passa a usar o mesmo modelo e esforço da Preparação de discursos e esboços, escolhidos pelo administrador na tela de prompts (sem escolha própria, usam o modelo geral, como antes). A nota sob os botões da IA do dirigente mostra esse modelo.

## 6.6.36

Preparar para dirigir: como em Comentários, as perguntas adicionais já salvas do parágrafo (A Sentinela) e a preparação salva do Estudo Bíblico aparecem sozinhas ao abrir a matéria ou trocar de parágrafo com as setas, sem precisar do botão de recuperar; sem nada salvo, a seção some. Recolher o card recolhe também o campo de texto.

## 6.6.35

O aviso "Resposta salva · parágrafo…" fica em letras pequenas e discretas, numa linha só.

## 6.6.34

Tela Reuniões: o botão 📝 ↓ do topo não sai mais torto (a linha do topo passava da largura da tela quando ele aparecia); o título agora encolhe e o botão, quando escondido, mantém o lugar.

## 6.6.33

Preparar para comentar: recolher um card (Sentinela, Tesouros, Estudo Bíblico) recolhe também o campo Texto original: a resposta dele sai e, sem nenhum card aberto, o cartão Texto original some.

## 6.6.32

Perguntas adicionais para o dirigente: com as perguntas aplicativas marcadas, a IA também recebe os dois parágrafos seguintes (só para consulta) e é orientada a não sugerir uma aplicação que a matéria à frente já trata. A instrução fica no prompt "Perguntas adicionais para o dirigente" (editável na tela de prompts).

## 6.6.31

Imagens da apostila: (1) o cartão Texto original some por completo enquanto Imagens da apostila está aberto (a resposta que estava nele também sai); (2) depois da descrição de cada imagem, ao lado do Copiar, um botão 📖 JW Library abre o app no lugar da imagem (o servidor passa a enviar o parágrafo que vem logo depois da imagem; imagens carregadas antes só ganham o botão ao recarregar as imagens).

## 6.6.30

O card da semana volta a abrir a página de reuniões no wol.jw.org: o link do app JW Library para a semana (alias=meetings) abria o app, mas com a página em branco.

## 6.6.29

O cartão ⚙️ Mais opções volta a ter o fundo branco (a cor do cartão), mantendo o tamanho fino.

## 6.6.28

O card da semana (Reuniões e preparação do Backup) agora abre as matérias da semana no app JW Library, com o endereço que o próprio app gera (alias=meetings e a data da semana), em vez do wol.jw.org.

## 6.6.27

O cartão ⚙️ Mais opções fica mais fino e discreto: sem fundo colorido, borda leve e título pequeno em cinza.

## 6.6.26

O botão 💾 Salvar alterações fica sempre visível quando o campo tem texto (desabilitado se o texto não é de uma pesquisa salva ou não foi alterado; nesse caso uma linha diz para usar Salvar texto em Mais opções).

## 6.6.25

A opção 🧠 Aprender com esta correção (só administrador) também fica escondida dentro de ⚙️ Mais opções.

## 6.6.24

Tela de respostas (cartão Texto original) mais simples, em todas as telas: **Outra resposta** e **Melhorar esta resposta** passam para ACIMA do Salvar alterações, mais finos e leves; tudo o que vem depois do Salvar alterações fica num cartão recolhível **⚙️ Mais opções** (Salvar texto, Exportar para Word e Compartilhar na mesma linha, sem o texto explicativo e, fora da tela Formatar, as opções de formatação). Na tela Formatar as opções principais, outras opções de formatação e opções com IA continuam à vista.

## 6.6.23

Preparar para comentar: (1) só uma resposta salva por parágrafo (A Sentinela) ou por pergunta/joia (Estudo Bíblico e Joias): ao salvar uma resposta nova, a antiga do mesmo parágrafo/pergunta sai; e gerar de novo com resposta salva usa a salva como base (a IA aproveita o que tem de bom) e a nova a substitui. (2) A resposta salva aparece sozinha embaixo ao abrir a matéria da semana ou trocar de parágrafo com as setas, como se tivesse acabado de ser gerada (com Copiar, JW Library, Outra resposta e Melhorar); sem resposta salva, a seção some e não mostra a de outro parágrafo. Trocar de parágrafo/matéria troca o texto do campo mesmo que ele tenha alterações não salvas (enquanto a escolha é a mesma, o texto em edição fica). O botão "Recuperar a resposta salva" some quando a resposta já aparece (e continua em Pesquisas e respostas salvas).

## 6.6.22

O botão 📖 JW Library ao lado do Copiar agora também copia a resposta (o mesmo texto do Copiar) antes de abrir o parágrafo no app, para só colar no campo da resposta. (O JW Library não deixa outro app colocar texto nele.)

## 6.6.21

(1) Joias e apostila: o botão 📖 JW Library ao lado do Copiar também aparece nas respostas das joias, e abre a apostila no lugar de colar a resposta: a pergunta da apostila (a joia da semana) na própria pergunta e as joias da leitura na pergunta geral das joias. (2) Os botões Copiar e JW Library no campo de texto não ficam mais por cima da última linha da resposta: a posição agora é medida numa cópia real do campo, com as mesmas letras, emojis e quebras de linha.

## 6.6.20

JW Library, preparação: (1) ao lado do 📋 Copiar de cada resposta do estudo de A Sentinela e do Estudo Bíblico, um botão 📖 JW Library abre o parágrafo (ou a pergunta) no app, o lugar de colar a resposta; (2) os cartões de matéria (A Sentinela, Estudo Bíblico, Tesouros, joias, imagens da apostila) têm sempre os dois botões lado a lado, 🔗 WOL e 📖 JW Library, e o título agora abre o JW Library; (3) o texto do botão JW Library fica branco; (4) ao abrir uma resposta recuperada (ou levar um texto) no campo de texto, uma barra ◀ Voltar fica congelada no topo e volta à tela de onde veio.

## 6.6.19

Texto diário: os atalhos para o wol.jw.org e para o JW Library deixam de ser links sublinhados e viram dois botões lado a lado, como na leitura da Bíblia (🔗 WOL e 📖 JW Library).

## 6.6.18

Barra do topo: o nome NoteStyle e o slogan ficam menores, em proporção ao logo.

## 6.6.17

JW Library nas telas de preparar: os cartões de estudo bíblico, Tesouros, joias, discursos e imagens da apostila ganham o botão 📖 JW Library abaixo do título, que abre o documento no app (com o mesmo endereço que o próprio JW Library gera ao compartilhar). Texto diário: o botão agora abre o dia inteiro no app, no título do dia (em vez do versículo); o servidor passa a enviar o número do documento e o parágrafo.

## 6.6.16

Texto diário: saem os botões 📖 das referências bíblicas dos comentários e dos comentários adicionais (voltam a ficar como antes).

## 6.6.15

Texto diário: as referências bíblicas do comentário e de cada comentário adicional ganham botões 📖 (no roxo do JW Library) que abrem cada texto no app.

## 6.6.14

JW Library, texto do dia: o link volta a apontar exatamente para o versículo citado (o do versículo anterior foi descartado).

## 6.6.13

JW Library, texto do dia: o link aponta para o versículo anterior ao citado (ou para o começo do capítulo, se for o versículo 1), porque o celular abria uma linha abaixo do início do versículo.

## 6.6.12

JW Library: o link do capítulo passa a usar o versículo 000 (começo do capítulo) em vez do 001, para o celular abrir no início do texto e não uma linha abaixo.

## 6.6.11

O botão 📖 JW Library fica no roxo do logo oficial do app, com o texto em branco.

## 6.6.10

JW Library também no computador (app do Windows): o botão 📖 JW Library e o nome do capítulo, na leitura da Bíblia, deixam de ser só do celular. Texto diário: novo link “Abrir o texto do dia no JW Library”, que abre o texto bíblico do dia (o da frase temática) no app.

## 6.6.09

Barra do topo ainda mais estreita, com o logo e o nome menores. Leitura da Bíblia: no celular, o nome do livro/capítulo no painel passa a abrir o capítulo no app JW Library (no computador continua abrindo o wol.jw.org).

## 6.6.08

Barra do topo mais estreita: faixa mais baixa, logo e nome NoteStyle menores.

## 6.6.07

Leitura da Bíblia: novo botão **📖 JW Library** no painel do capítulo (só no celular/tablet) que abre o capítulo direto no app JW Library instalado. Se o app não abrir, o NoteStyle avisa e sugere o botão WOL.

## 6.6.06

Tela do resumo: o cabeçalho (título e botão Fechar) fica congelado no topo enquanto o resumo rola.

## 6.6.05

Leitura da Bíblia: **Resumir** / **Ver resumo** abre as opções de resumo (ou o resumo já feito) numa tela separada, só com o resumo e com mais espaço para ler. Ao fechar, volta ao quadro da leitura, do jeito que estava.

## 6.6.04

Texto diário (texto e comentários adicionais): a tela passa a acompanhar a frase lida levando-a para o meio da parte realmente visível, entre a barra do topo e a de baixo. Antes, a frase podia ficar escondida atrás da barra de baixo sem a tela rolar.

## 6.6.03

Texto diário, Comentários adicionais: o ícone 🔊 ficou do mesmo tamanho do 🔊 do texto (só o alto-falante, sem caixa), mais afastado da seta, e a seta de recolher/abrir ficou maior.

## 6.6.02

Leitura em voz (texto diário, Leitura, comentários e demais): o gráfico de barras do som aparece no player e se mexe enquanto a leitura está em andamento; na pausa as barras param e, ao terminar, ficam baixas.

## 6.6.01

Barra inferior: o botão **Áudio** passou a se chamar **Gravar**.

## 6.6.00

Leitura da Bíblia: o campo **Anotações do capítulo** saiu do painel do capítulo, e com ele a marca âmbar nas células. (As anotações que já tinham sido escritas continuam guardadas no aparelho, sem aparecer.)

## 6.5.99

Leitura da Bíblia: uma linha fina separa o cabeçalho do painel do capítulo (setas, nome e versículos) do restante do painel.

## 6.5.98

Menu lateral: novo visual — no topo, o logo e o nome NoteStyle; o rótulo “MENU PRINCIPAL”; e o item da tela em que se está fica numa **célula** destacada (fundo suave da cor da marca, texto em negrito nessa cor e um pontinho à direita). O botão “Buscar atualizações” saiu: no lugar fica só o ícone ↻, bem discreto, na frente do número da versão; tocar nele faz a mesma atualização.

## 6.5.97

Outra resposta / Melhorar (texto colado, estudo, EBC, perguntas do dirigente, joias e esboços): o pedido volta a enviar as respostas anteriores mesmo se o resumo na tela já tiver sido limpo — antes dependia de `aiResumo` e às vezes gerava de novo do zero em vez de refinar.

## 6.5.96

Áudio em texto: depois de **Aplicar os nomes**, a caixa dos nomes se fecha e fica só o botão “Dar nomes aos falantes”; tocar nele abre a caixa de novo para revisar.

## 6.5.95

Áudio em texto: o botão **Dar nomes aos falantes** continua à vista depois de aplicar os nomes, para revisar. Os falantes já nomeados aparecem na lista com o nome e “já aplicado”; ao mudar o nome e tocar em “Aplicar os nomes”, o rótulo das falas é trocado (e o nome no resumo); deixando o campo vazio, a pessoa volta a ser “Falante N”. Texto apagado ou novo: a lista recomeça.

## 6.5.94

Áudio em texto: (1) a caixa de marcar e o texto de “Identificar quem fala” ficam centralizados e alinhados na mesma linha. (2) **Dar nomes aos falantes**: com a transcrição separada por pessoa, um botão **👥 Dar nomes aos falantes** aparece logo abaixo do campo; ele abre a lista de falantes (com o começo da fala de cada um), onde se escreve o nome de cada um. **✨ Sugerir nomes** pede à IA os nomes mais prováveis, a partir dos nomes ouvidos no áudio e dos interlocutores de “Dados do áudio” (que também aparecem como sugestões em cada campo). **✅ Aplicar os nomes** troca “Falante N” pelo nome na transcrição e, se já existirem, no texto corrigido e no resumo.

## 6.5.93

Áudio em texto, identificar quem fala: o áudio enviado ao Google passa por um ajuste de volume quando é muito baixo (o pico sobe até cerca de 90%, no máximo 12 vezes). Uma gravação de teste muito baixa (pico de −19,7 dB, média de −41,5 dB) travava o reconhecimento em lote do Google; áudio com volume normal não é alterado.

## 6.5.92

Áudio em texto, identificar quem fala: quando o Google deixa um áudio travado sem responder (aconteceu com uma gravação de 58 s, sem erro nem resultado), o app agora espera no máximo cerca de 3 minutos (mais, para áudios longos), cancela a operação no Google, apaga o arquivo do bucket e **segue com a transcrição comum**, avisando que não foi possível separar as pessoas. Ao cancelar, a operação também é cancelada no Google.

## 6.5.91

Áudio em texto: (1) saiu o texto explicativo da caixa “Identificar quem fala”. (2) A mensagem de andamento da transcrição passa para dentro do quadro Transcrever, logo abaixo do botão Iniciar e acima da barra de progresso (com o quadro escondido, ela segue no alto, como antes). (3) Os botões Cancelar ocupam a largura toda.

## 6.5.90

Áudio em texto: enquanto o app processa, o botão da operação (Iniciar a transcrição, Corrigir com a IA ou Resumir com a IA) mostra um **símbolo girando e o tempo decorrido (m:ss)** no começo do título, para ficar claro que não travou, mesmo sem ver a mensagem de andamento.

## 6.5.89

Áudio em texto, identificação de quem fala: o acompanhamento mostra o andamento (%) quando o Google informa; o prazo agora acompanha o tamanho do áudio (no mínimo 8 minutos, ou 3 vezes a duração) e, passado ele, a transcrição é interrompida e o arquivo é apagado, em vez de esperar sem fim. O servidor registra o andamento da operação no log para diagnóstico.

## 6.5.88

Áudio em texto: nova caixa **👥 Identificar quem fala** (em Transcrever). Ligada, o áudio inteiro é enviado, de uma vez, para um bucket privado do Google Cloud por uma URL assinada (o arquivo é apagado assim que a transcrição termina, e o bucket também apaga sozinho depois de 1 dia), o servidor pede a transcrição em lote com identificação de falantes (Speech-to-Text V2, chirp_3) e o app acompanha até ficar pronta. O texto sai separado por pessoa (“Falante 1: …”, “Falante 2: …”); a correção e o resumo respeitam esses rótulos. Se o Google não devolver os falantes, o texto vem corrido, com um aviso. Leva mais tempo que a transcrição comum (em geral, alguns minutos). A transcrição comum continua igual.

## 6.5.87

Reuniões: o cartão do **Texto original** deixa de aparecer sempre nas páginas (Comentários, Dirigentes, Discursos, Pesquisas e respostas salvas): ele só aparece quando alguma função da página joga texto dentro dele (uma resposta da IA, um esboço, um texto aberto das pesquisas salvas). Muda de página, sai da tela ou toca em Limpar, e ele some de novo. Em Formatar continua sempre à vista, por ser o campo de trabalho.

## 6.5.86

Leitura da Bíblia: o botão **🎬 Vídeo: introdução ao livro** passa a aparecer no cartão do livro (leitura por livros) e no cartão do grupo que traz o capítulo 1 de um livro (leitura por seções e temas). Toca num player dentro do app, em streaming (nada é guardado no aparelho), com escolha de qualidade (360p de início, a escolha fica lembrada) e um link para abrir o vídeo no jw.org. O vídeo para ao tocar o áudio de leitura, recolher o cartão ou sair da tela; ao abrir o vídeo, a leitura em áudio é pausada.

## 6.5.85

Leitura em voz alta: os botões Ler e Concluir só ficam habilitados quando há texto no campo (digitado, colado ou vindo de um arquivo PDF ou Word); sem texto, ou enquanto o arquivo está sendo lido, ficam desabilitados.

## 6.5.84

Áudio em texto: removido o texto explicativo (“Mantenha esta tela aberta e em primeiro plano…”) que aparecia dentro da caixa de gravação.

## 6.5.83

Leitura da Bíblia: no gráfico de barras, as primeiras e as últimas barras ficam sempre pequenas e quase não oscilam; quanto mais ao meio, maior a oscilação.

## 6.5.82

Leitura da Bíblia: o nome do livro/capítulo e a quantidade de versículos, no topo do painel, ficam maiores. O gráfico de barras passa a baixar nos intervalos entre um versículo e outro (usando os marcadores do áudio) e enquanto o áudio carrega; os silêncios no meio das frases continuam simulados.

## 6.5.81

Leitura da Bíblia: “Seções e temas” e “Livros, na ordem da Bíblia” continuam abrindo juntos ao entrar na tela, mas depois nunca ficam os dois abertos: ao tocar num deles (ou abri-lo por “Continuar de onde parou”), o outro se recolhe por inteiro, com os grupos, os livros e as caixas de leitura que tinha abertos, voltando ao padrão original.

## 6.5.80

Leitura da Bíblia: na lista “Livros, na ordem da Bíblia”, o gráfico de barras do áudio aparece no topo do cartão do livro que está tocando sempre que o cartão está recolhido, mesmo quando o áudio foi iniciado pela leitura por seções (antes só aparecia se a grade de capítulos do livro já tivesse sido aberta).

## 6.5.79

Leitura da Bíblia: (1) o topo do cartão do grupo de capítulos (e do livro) ganha um tom próprio enquanto nada foi lido (o verde só vem com a leitura) e, com o cartão aberto, uma linha o separa do conteúdo, para ficar claro que é um campo clicável. (2) O equalizador fica mais realista: as faixas agudas (zona vermelha) têm o seu próprio ritmo, em rajadas como os chiados da fala, e se mexem tanto quanto as graves.

## 6.5.78

Leitura da Bíblia: (1) o gráfico de barras volta a se mexer em aparelhos com “Reduzir movimento” ligado (o equalizador ficava parado nesses aparelhos, como no iPhone do usuário). (2) Ao escolher um capítulo em outro grupo ou livro, o cartão anterior se recolhe por inteiro, com a grade de capítulos e a caixa de leitura, e fica só o topo dele.

## 6.5.77

Leitura da Bíblia: (1) com a leitura em andamento e o cartão dos capítulos aberto, mas sem o capítulo que toca escolhido (o player dele fora de vista), o gráfico de barras aparece no topo do cartão. (2) O gráfico passa a se mexer como um equalizador: as barras sobem e descem num ritmo de sílabas da voz, com pausas curtas, e as graves têm mais força que as agudas; é uma simulação (o navegador não deixa medir o áudio vindo do site da JW), que anda enquanto toca e para na pausa. (3) Só uma caixa de opções de leitura/áudio fica aberta por vez: ao escolher um capítulo, a caixa que estava aberta em outro grupo ou livro se fecha na hora.

## 6.5.76

Leitura da Bíblia: o gráfico de barras do player passa a até 150 px de largura (26 px de altura), com as mesmas 24 barras em proporção. E, com o áudio tocando e o cartão do grupo de capítulos (ou do livro) recolhido, o gráfico aparece no topo desse cartão; ao abrir o cartão, volta só ao player do painel.

## 6.5.75

Áudio em texto: o ícone da lixeira (limpar) das barras “Informe o tipo de áudio”, “Dados do áudio” e “Documentos relacionados” ficava desalinhado no computador, caindo para baixo da barra quando o título quebrava em duas linhas. Agora fica sempre centralizado na barra, à direita.

## 6.5.74

Leitura da Bíblia: o gráfico de barras do áudio no player do painel passa a ter 140 px de largura, com 24 barras mais finas e menos altas. O gráfico (e o “Cap. N v. X/Y”) que aparecia no topo do grupo de capítulos e do livro foi retirado: a situação do áudio fica só no player.

## 6.5.73

Leitura da Bíblia: o gráfico de barras do áudio dentro do player do painel fica mais largo (barras de 6 px, em vez de 4 px, e espaço maior entre elas).

## 6.5.72

Leitura da Bíblia: o capítulo que tem anotação ganha uma **marca âmbar** no canto da sua célula na grade. E, ao tocar em Resumir, a área do resumo agora abre **logo abaixo do player e dos botões WOL / Resumir**, dentro do painel do capítulo (antes ficava no fim da tela); ao fechar, o painel continua onde estava.

## 6.5.71

Leitura da Bíblia: o painel do capítulo ganhou o campo **📝 Anotações do capítulo**, abaixo de WOL e Resumir, para escrever os pontos da leitura. A anotação é guardada neste aparelho à medida que se escreve, é a mesma na leitura por seções e por livros, e entra no backup do app. “Zerar capítulos lidos” não apaga as anotações.

## 6.5.70

Leitura da Bíblia: os cartões das seções, dos grupos de livros e dos livros tinham duas molduras seguidas (a do cartão e a da barra de progresso), o que parecia grosso; agora têm uma só, fina.

## 6.5.69

Em todo o app, as molduras de tudo que fica dentro dos cartões (botões, campos de texto, seções recolhíveis, grupos, painéis, caixas) passam de 2 px para 1 px; só a moldura externa de cada cartão continua mais grossa. As caixinhas de marcar (checkbox) e as bolinhas de cor não mudaram.

## 6.5.68

Áudio em texto: as molduras dos cards internos (arquivos de áudio, tipo de áudio, dados, documentos e etapas) passam de 2 px para 1 px.

## 6.5.67

Leitura da Bíblia: na leitura automática por livros, ao passar de um capítulo para o próximo (inclusive para o livro seguinte), a tela acompanha o painel do player em vez de parar na grade de capítulos.

## 6.5.66

Áudio em texto (gravação ao vivo): corrige o caso de arquivo longo com metade muda — o app passa a vigiar o microfone e os pedaços do gravador, pausa o relógio sem sinal, avisa na tela e tenta retomar a captura (sem encher o arquivo de silêncio). Prefere WebM/Opus no Chrome (mais estável que mp4). Wake Lock reforçado. Texto deixa claro que gravar com a tela desligada / em segundo plano não é confiável nos navegadores (limitação do sistema).

## 6.5.65

Tela inicial: a Leitura diária da Bíblia passa para o 3º lugar, logo depois de Formatar um texto e Backup do JW Library.

## 6.5.64

Em todo o app, ao passar o mouse sobre um botão o fundo não vira mais azul: ele escurece (no tema escuro, clareia) na própria cor do botão. Botões desativados não reagem.

## 6.5.63

Leitura da Bíblia: ao passar o mouse sobre “Continuar de onde parou”, o fundo fica num vermelho um pouco mais forte (antes ficava azul).

## 6.5.62

Ajustes → Leitura da Bíblia: o botão “Zerar capítulos lidos” ocupa a largura toda.

## 6.5.61

Ajustes → Leitura da Bíblia: cada jeito de marcar capítulos já lidos ganhou a sua moldura, e os campos de livro, de seção e o botão “Marcar” passaram a ocupar sempre a largura toda.

## 6.5.60

Leitura da Bíblia: o texto do versículo no player fica em itálico. Em Ajustes → 📚 Leitura da Bíblia: **Marcar capítulos já lidos** (para quem começa no meio de um ciclo), com três jeitos — tudo, do começo da Bíblia até um capítulo (a fita passa para o capítulo seguinte), um livro ou alguns capítulos dele, ou uma seção inteira; os capítulos já marcados não mudam e os novos ficam sem data. E **Recomeçar o ciclo**: zera todos os capítulos lidos e tira a fita (os resumos salvos continuam). Ambos pedem confirmação.

## 6.5.59

Leitura da Bíblia: com o código de resumo, o player do painel do capítulo mostra, sob a barra de andamento, o **texto do versículo que está sendo lido** (por exemplo “5 · Davi disse…”), trocando sozinho a cada versículo, no ritmo dos marcadores do áudio. Novo pedido ao servidor (`biblia-texto`, sem IA): devolve o texto de um capítulo por vez, só com o código de resumo. Sem o código, a caixa continua como estava. Também saiu o texto explicativo de “Livros, na ordem da Bíblia”.

## 6.5.58

Leitura da Bíblia: ao abrir a tela, “Livros, na ordem da Bíblia” também abre (junto com “Seções e temas”). Durante o áudio, o gráfico de barras aparece também dentro do player do painel do capítulo (ao lado da situação), parado quando o áudio está em pausa.

## 6.5.57

Leitura da Bíblia por livros: as setas ‹ › do painel do capítulo só trocam o capítulo, sem mover a tela.

## 6.5.56

Leitura diária da Bíblia: os capítulos agora aparecem numa **grade de células quadradas**, uma por capítulo, como no wol.jw.org (na leitura por seções e na por livros), em vez de uma linha com botões para cada capítulo. Tocar numa célula abre, logo abaixo da grade, o **painel do capítulo**, um só para todos: título com o número de versículos, setas para o capítulo anterior e o seguinte, “Lido” com a data, o marcador, o **player completo** (mesmo padrão da Leitura em voz alta: ⏮️ versículo anterior, ▶️/⏸️, ⏭️ próximo versículo, ⏹️ parar, barra de andamento em que se toca ou arrasta, tempo e velocidade de 0,75× a 2×, que fica guardada), o 🔗 WOL e o Resumir (o nome do capítulo, no título, também abre o texto no wol.jw.org). Capítulos lidos ficam verdes; uma bolinha roxa marca os que têm resumo; o capítulo tocando pulsa. Nova **fita de marcador** (🔖) mostra onde a leitura parou: ao terminar um capítulo (marcado como lido ou ouvido até o fim) ela passa para o seguinte, e dá para pôr ou tirar a fita à mão (“Marcar aqui”). Ao tocar num capítulo a tela se move: na leitura por livros, até o painel de leitura dele; na por seções e temas, até o cartão do grupo de capítulos. A fita também aparece, sempre dentro do cartão (maior no botão da seção), nos cartões que levam até o capítulo: o botão da seção, o cartão do grupo de capítulos e, na leitura por livros, o cartão do grupo de livros e o do livro. Logo abaixo da barra de progresso geral e antes de “Seções e temas”, o botão “Continuar de onde parou” (com a fita vermelha grande como ícone) abre a lista, o grupo ou o livro e o capítulo da fita. Tudo se atualiza no lugar, sem refazer as listas. A leitura contínua (Ajustes) segue usando a ordem da lista em que se está.

## 6.5.55

Reuniões → Preparar para comentar: ao abrir a página (pelo atalho Comentários do Início ou pelo botão da tela Reuniões), as quatro opções de preparação (A Sentinela, Tesouros da Palavra de Deus, Estudo Bíblico e Imagens da apostila) abrem sempre recolhidas.

## 6.5.54

Página Sobre revisada: a introdução e o quadro “O que você pode fazer” agora citam a leitura diária da Bíblia (programa por seções e por livros, marcações, áudio dos capítulos e resumos com IA), o áudio em texto e o backup do aplicativo, e dizem quais recursos pedem código de acesso; também atualizados o texto de privacidade (áudio da Bíblia direto da jw.org, reconhecimento de voz) e os créditos (PDF.js).

## 6.5.53

Preparação para as lojas (Android primeiro). Política de Privacidade 1.8 (áudio da Bíblia direto da jw.org, backup do app, código de resumo; sai o item do Cloudflare). As bibliotecas JSZip, sql.js e pdf.js passam a ser entregues pelo próprio site (pasta `vendor/`, cópias idênticas às do cdnjs) e ficam numa cache própria do service worker, então o backup do JW Library e a importação de PDF funcionam **sem internet** e sem chamar terceiros. Manifesto completo (`id`, `scope`, `lang`, `categories`, atalhos para Formatar, Bíblia, Reuniões e Áudio); `/.well-known/assetlinks.json` criado vazio (para o Android); cabeçalhos de segurança (`vercel.json`: nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy). O zoom por pinça continua bloqueado (decisão do dono do app); só o último campo com letra menor que 16 px (tela de prompts do administrador) passou a 16 px. Leitura da Bíblia em celulares estreitos (320 a 380 px): o “Cap.” aparecia como “C…” na maioria das linhas e, em 320 px, o número do capítulo era cortado; agora os botões, os espaços internos e o gráfico de áudio se ajustam e nada fica cortado em 320, 360, 375 e 412 px, nos dois modos de leitura. O campo vazio da data diz só “Data”.

## 6.5.52

O botão do menu lateral passa a se chamar “🔄 Buscar atualizações”.

## 6.5.51

Novo botão “🔄 Atualizar o app” na base do menu lateral: confere a versão no servidor, remove o service worker e as cópias guardadas, baixa de novo os arquivos principais e recarrega (o texto do campo é mantido); depois mostra “App atualizado: versão X → Y” ou “Você já estava na versão mais recente”. Aviso de versão nova: tocar em “Depois” deixava de avisar até as versões seguintes durante toda a sessão (no app instalado, dias); agora o “Depois” vale só para aquela versão. Também confere ao voltar da memória do aparelho (pageshow) e ao voltar o foco ao app.

## 6.5.50

Leitura da Bíblia: o resumo dos capítulos com a IA passa a exigir um código próprio, o código de resumo (variável CODIGO_RESUMO na Vercel), informado em Ajustes → Autorização de acessos. O botão “Gerar resumo” ganha o ícone 🔑 e, sem o código salvo, fica desabilitado (🔒) com um botão que leva a Ajustes. O código de pesquisa deixa de valer para esse resumo. O ícone da função Leitura diária da Bíblia passa a ser 📚 (menu, barra inferior, atalho do Início, título da tela e seção de Ajustes).

## 6.5.49

Ajustes: nova seção “📖 Leitura da Bíblia”, com a opção “Ao terminar um capítulo, tocar o próximo” (que saiu do topo da tela da Bíblia).

## 6.5.48

Leitura da Bíblia (áudio): gráfico de barras mais esticado (9 barras, mais altas).

## 6.5.47

Leitura da Bíblia: ao tocar no botão de uma seção, a tela desce até o começo da seção aberta (a programação).

## 6.5.46

Leitura da Bíblia: o botão “Resumir” da linha do capítulo fica só com o texto (sem o ícone), para não cortar.

## 6.5.45

Leitura da Bíblia (áudio): sai a fileira “Reiniciar / Parar”; entra um botão redondo ⏹ ao lado do ▶, que pára e zera o capítulo (o ▶ volta a tocar do começo). Os botões ▶, WOL e Resumir ficam um pouco menores.

## 6.5.44

Leitura da Bíblia (áudio): gráfico de barras maior (7 barras, mais altas); opção “Ao terminar um capítulo, tocar o próximo” (desligada por padrão): ao fim de um capítulo toca o seguinte, abrindo o grupo (ou o livro) dele quando for de outro grupo; botões “↺ Reiniciar” e “⏹ Parar” na linha do capítulo em andamento (para recomeçar do início depois de pausar).

## 6.5.43

Leitura da Bíblia: as barras de áudio do cabeçalho se movem também em aparelhos com “Reduzir Movimento” ligado (no iPhone elas ficavam paradas).

## 6.5.42

Leitura da Bíblia: durante o áudio, o cabeçalho do grupo informa também o capítulo (“Cap. 4 v. 5/6”).

## 6.5.41

Leitura da Bíblia: a quantidade de versículos aparece depois do capítulo, entre parênteses e sem negrito (“Cap. 1 (31)”; nos trechos do Salmo 119, só os versículos do trecho). Nas linhas que mostram o nome do livro, os nomes compridos são abreviados (Hab. 1 (17)) e o número do capítulo nunca é cortado. Durante o áudio, o cabeçalho do grupo mostra o versículo que está sendo lido (“v. 12/31”), a partir dos marcadores do áudio da jw.org.

## 6.5.40

Leitura da Bíblia: enquanto um capítulo toca, o cabeçalho do grupo (e do livro) mostra barrinhas de áudio animadas, como o gráfico do Áudio em texto em tamanho menor; elas param quando o áudio é pausado.

## 6.5.39

Leitura da Bíblia: ao terminar de ouvir um capítulo, ele é marcado no lugar, sem refazer a lista (a tela não volta mais ao topo). Depois de gerar o resumo de um capítulo aparece o botão flutuante “📝 Resumo pronto · Ver ↓”, que leva ao texto do resumo. Ao salvar um texto em Pesquisas, o nome sugerido aparece normal, sem estar selecionado.

## 6.5.38

Leitura da Bíblia: a barra de andamento do áudio ganha espaço (não encosta mais no campo da data nem na borda da linha).

## 6.5.37

Leitura da Bíblia: botão ▶ em cada capítulo que toca a gravação do capítulo (áudio da jw.org), um capítulo por vez: o mesmo botão pausa e retoma, outro ▶ troca de capítulo e, ao terminar, o áudio para e o capítulo é marcado como lido, com a data de hoje (as duas partes do Salmo 119 juntas). Uma barra fina no pé da linha mostra o andamento. Abaixo do título da tela, a data da última leitura (“Última leitura em: dd/mm/aaaa”), em letras pequenas, com há quantos dias (hoje, ontem, há N dias): verde com ✔ se foi hoje e vermelho com ⚠️ se passou mais de um dia.

## 6.5.36

Preparação de discursos e esboços (prompt “Como elaborar um esboço”): a introdução pode abrir com história de personagem bíblico (de preferência um citado no esboço; quanto mais desconhecido, melhor; com fundo histórico breve), ilustração da vida real ou ocorrência/notícia real conhecida. Aplicação e ilustração deixam de ser obrigatórias em todo ponto — só entram quando ainda fizerem falta (muitas vezes a aplicação já está clara na matéria, no tema ou num tópico).

## 6.5.35

Ajustes → Privacidade e dados deste aparelho: backup e restauração. “Fazer backup” (ou “Compartilhar”, nos celulares) grava num arquivo .json as pesquisas e respostas salvas, as marcações e resumos da leitura da Bíblia, os esboços importados, modelos, favoritos e preferências; “Restaurar um backup” traz tudo de volta em outro aparelho ou depois de reinstalar o app. Os códigos e a senha só entram se a caixa for marcada. Ficam de fora os textos carregados do wol.jw.org e a concordância com o envio à IA.

## 6.5.34

Leitura da Bíblia: ao abrir a tela, “Seções e temas” fica expandido, sem nenhuma seção escolhida (a programação só aparece depois de escolher uma), e a lista de livros fica recolhida.

Leitura por livros: cada livro e cada grupo têm um fundo bem suave; um matiz por grupo, com tons diferentes de um livro para o outro. A leitura por seções e temas usa a mesma cor de cada livro, e o card com o nome da seção escolhida usa a cor do botão da seção.

Leitura da Bíblia: o card “Seções” é um só contêiner recolhível, com os botões das seções e, abaixo, separada por uma linha, a programação da seção escolhida (sem as molduras internas).

Leitura da Bíblia: o rótulo de cada capítulo passa a ser a abreviação “Cap. N” (o nome por extenso era cortado e escondia o número).

## 6.5.33

Leitura diária da Bíblia: nova leitura por livros, na ordem da Bíblia, num card próprio (fechado por padrão); a leitura por seções continua como padrão e agora também pode ser recolhida. Os livros ficam em grupos (Pentateuco, Conquista da terra e juízes, História dos reis, Volta do exílio, Poesia e sabedoria, Profetas maiores e menores, Evangelhos, Atos, Cartas de Paulo, Outras cartas, Apocalipse); ao abrir um livro aparecem os capítulos, com marcar, data, WOL e resumo como na leitura por seções. As marcações e os resumos são os mesmos dos dois modos, e as barras de andamento valem para livro e grupo.

## 6.5.32

O botão “Estudo Bíblico de Congregação” (preparar para comentar e para dirigir) passa a se chamar “Estudo Bíblico”.

## 6.5.31

Resumo do capítulo (leitura diária): texto organizado em parágrafos. Cada grupo de versículos, aplicação, qualidade de Jeová, personagem e lugar ganha o seu parágrafo (linha em branco entre eles), em lista, com emoji no começo; o nome de cada personagem e lugar sai em negrito e o título de cada seção, em negrito com acentos e emoji. O servidor reorganiza o texto mesmo que a IA entregue tudo num bloco só, e as instruções da IA (frases editáveis na tela de prompts) descrevem a forma de cada seção. Corrigido: com o negrito ativo o app não reconhecia mais o título da seção (acrescentar ou melhorar uma seção duplicava ou falhava). Citação das fontes padronizada. Cards das ferramentas das reuniões (A Sentinela, Joias, Estudo Bíblico…): título com faixa de cor, linha separando-o dos dados e seta maior. Leitura da Bíblia: as barras de progresso ficam âmbar enquanto falta capítulo e só ficam verdes com tudo lido.

## 6.5.30

Resumo do capítulo (leitura diária): corrige falha ao gerar (erro “Não foi possível obter sugestões agora”) causada pelo schema JSON da resposta da IA (`z.any()` / campos opcionais inválidos). Volta a aceitar o formato completo das seções adicionais.

## 6.5.29

Resumo do capítulo (leitura diária): nova opção “Gerar o resumo do capítulo” (primeira, marcada por padrão; pode desmarcar para pedir só outra seção). Se já existir texto salvo, a IA o usa como base ao gerar de novo; com uma única opção marcada, acrescenta a seção nova ou só melhora a seção que já existia, sem alterar o restante.

## 6.5.28

Resumo do capítulo (leitura diária): ao Gerar resumo, o mesmo indicador do app (“A IA está pensando…”, spinner no botão e contador). O resumo passa a usar as preferências de formatação das respostas (negrito, itálico, maiúsculas, variação de fonte, emoji, espaçamento), com destaques aplicados no texto.

## 6.5.27

Resumo do capítulo (leitura diária): opções renomeadas para “Opções adicionais para a IA (além do resumo)”; removida a dica “Opcional. Vale mais…”. Com opções marcadas, o texto sai em seções com subtítulos em maiúsculas (RESUMO, SOBRE JEOVÁ, APLICAÇÕES PRÁTICAS, FUNDO HISTÓRICO, PERSONAGENS, LUGARES E INFORMAÇÕES GERAIS). Fundo histórico, personagens e lugares disparam pesquisa no Perspicaz e, se preciso, na biblioteca wol.jw.org (consultas da IA, referências nas instruções ou o capítulo); a resposta final cita a fonte. Jeová e aplicações práticas só orientam o texto, sem pesquisa extra.

## 6.5.26

Resumo do capítulo (leitura diária): a pesquisa no Estudo Perspicaz e a 2ª chamada à IA só rodam se Personagens ou Lugares/medidas estiverem marcados; as outras opções só orientam o texto. Prompt próprio do resumo diário (sem forçar fundo histórico nem verbetes). A etapa do Perspicaz não reenvia os versículos; busca dos verbetes em paralelo e sem repetir o mesmo nome. Instruções adicionais passam a aceitar o mesmo limite das outras telas. Dica na tela sobre o que cada opção faz.

## 6.5.25

Leitura diária da Bíblia, grande reformulação do resumo e da programação: o botão Resumir de cada capítulo só abre a área do resumo (no fim da tela, com o capítulo no título), e quem pede à IA é o botão Gerar resumo, que mostra o modelo e o esforço da IA; a programação da seção fica recolhível (nome da seção numa moldura com o ícone à esquerda, ao lado do "Só as pendentes"); ao fechar o resumo, a tela volta à programação com o capítulo à vista; o resumo feito fica salvo e o botão do capítulo vira "Ver resumo" (verde); o campo do resumo cresce com o texto, sem barra de rolagem; botão Word para exportar o resumo; campo recolhível "Instruções adicionais para a IA" com cinco opções padrão (o que ensina sobre Jeová, aplicações práticas, fundo histórico, personagens e lugares/medidas, estas duas com o Perspicaz), cujas frases ficam na tela de prompts. Nos capítulos: só "Capítulo N" dentro do grupo de um livro, botões WOL e Resumir lado a lado e centralizados, campo da data que não recebe clique (tocar nele marca ou desmarca a leitura). Espaços do quadro da seção recolhida padronizados.

## 6.5.24

Leitura diária da Bíblia: o fundo do capítulo lido passa de verde para azul claro.

## 6.5.23

Leitura diária da Bíblia: ao marcar um capítulo como lido, o fundo do cartão dele fica verde suave.

## 6.5.22

Leitura diária da Bíblia: os botões WOL e Resumir de cada capítulo ficam lado a lado, na linha da data (o nome do capítulo ocupa a linha de cima).

## 6.5.21

Leitura diária da Bíblia: a moldura da barra de progresso do grupo fica colada no quadro do grupo, sem espaço entre os dois.

## 6.5.20

Leitura diária da Bíblia: moldura fina em volta da barra de progresso de cada grupo de capítulos (verde quando o grupo está completo).

## 6.5.19

Leitura diária da Bíblia: o link WOL e o botão Resumir de cada capítulo têm o mesmo tamanho e padrão, o WOL em azul e o Resumir em roxo.

## 6.5.18

Leitura diária da Bíblia: mais espaço entre a barra de progresso do grupo aberto e o primeiro capítulo.

## 6.5.17

Leitura diária da Bíblia: cada capítulo ganha o link "🔗 WOL", que abre exatamente esse capítulo na Bíblia de estudo do wol.jw.org (nos capítulos partidos, como Salmos 119:1-63, abre o capítulo inteiro).

## 6.5.16

Início: as descrições dos atalhos não somem mais em telas baixas (ficam com letra menor, e a tela rola se não couber); a data do texto diário, com o ícone e a seta ›, fica sempre numa linha só (a letra diminui se preciso).

## 6.5.15

Formatar: corrigido o corte do lado direito da tela em celulares estreitos (360 px) quando o botão 🔊 aparece no alto do texto: a linha de botões (Limpar, Copiar, 🔊 e Desfazer) era mais larga que o cartão e empurrava tudo para fora. Agora ela encolhe e os botões ficam mais compactos. A coluna única das telas também passou a poder encolher, para que um item largo nunca mais empurre o cartão para fora da tela.

## 6.5.14

Leitura diária da Bíblia: o campo da data de cada capítulo agora tem o tamanho do texto (a data, ou o aviso "Data da leitura" quando ainda não foi lido), em vez de ocupar a linha toda.

## 6.5.13

Barra de baixo: o botão Backup JW saiu e entrou o da Leitura diária da Bíblia (o Backup continua no menu e no Início).

## 6.5.12

Menu lateral: mais estreito; o botão Sair / Fechar saiu (o navegador não deixa um app fechar a si mesmo); a escolha de tema (Auto, Claro, Escuro) passou da tela de Ajustes para a base do menu; a base do menu também mostra a versão do app, os links de Termos de uso e Política de privacidade e, bem discreto, o logo da Carvalho Apps.

## 6.5.11

Leitura diária da Bíblia: cada botão de seção ganha um fundo suave de cor própria (a seção completa continua verde).

## 6.5.10

Leitura diária da Bíblia: o ícone da seção do exílio agora é uma corrente (⛓️), que lembra prisão.

## 6.5.09

Leitura diária da Bíblia: os botões das seções não ficam mais azuis ao passar o mouse; o ícone da seção de Jesus volta ao emoji do homem de barba (🧔🏽) e o rosto desenhado saiu.

## 6.5.08

Leitura diária da Bíblia: o ícone da seção da vida e do ministério de Jesus agora é um rosto desenhado (pele clara, cabelo e barba pretos), já que os emojis não têm essa combinação.

## 6.5.07

Leitura diária da Bíblia: o ícone da seção da vida e do ministério de Jesus passa para um tom de pele mais claro.

## 6.5.06

Leitura diária da Bíblia: o texto explicativo do topo saiu; as 10 seções viram botões com ícone, num quadro próprio; os grupos de capítulos de cada seção ficam num quadro e se abrem (toque no grupo) em uma linha por capítulo. A marcação de lido, o botão Resumir (com o resumo logo abaixo do capítulo) e a data valem só para o capítulo; a data não é editável e é registrada sozinha ao marcar o capítulo como lido (e some ao desmarcar). Quem já tinha grupos marcados mantém: cada capítulo do grupo aparece como lido. Também: o cartão do grupo fechado vira uma barra de andamento (enche de verde e ganha ✔ ao completar); os botões das seções têm barra de andamento e ficam verdes com ✔ quando completos; barra geral de leitura abaixo do título e no atalho do Início; linhas de capítulo mais finas; ícone de Jesus trocado por 🧔🏽; o quadro grande em volta da tela saiu.

## 6.5.05

Logo da barra do topo: o desenho do ícone cresce para ficar da altura das duas linhas de texto (nome e slogan), sem aumentar a barra.

## 6.5.04

Logo da barra do topo: o ícone fica mais perto do nome, e o nome "NoteStyle" passa a ter exatamente a largura do slogan abaixo dele (ajustada na tela, para valer em qualquer aparelho).

## 6.5.03

Logo da barra do topo: o nome volta à fonte normal (sem itálico).

## 6.5.02

Início: as descrições dos atalhos voltam a aparecer no celular (o atalho da Leitura diária da Bíblia tinha uma descrição de três linhas, que fazia o app esconder todas; ela foi encurtada e, no ajuste "aperta", ícones e letras dos atalhos ficam um pouco menores para os 8 atalhos caberem com as descrições numa tela de 852 px). Logo da barra do topo reestilizado: ícone à esquerda, nome em negrito inclinado maior e o slogan centralizado logo abaixo, da largura do nome.

## 6.5.01

Revisão da 6.5.00: logo centralizado na barra do topo (slogan encurtado para "Auxílio para estudo e preparação"); na Leitura diária da Bíblia, o resumo na caixa passa a ser sempre o do grupo selecionado (antes, ao abrir a tela com outro grupo como próximo pendente, o resumo do grupo anterior ficava na caixa e era gravado no grupo novo); nota do modelo da IA sob o botão Gerar resumo; a tecla Esc fecha o menu lateral; a entrada 6.4.81 do histórico, sobrescrita pela 6.5.00, foi restaurada.

## 6.5.00

Leitura diária da Bíblia: nova tela com o programa anual (PDF sbr), seções, datas planejadas, marcação de leitura concluída e resumo dos capítulos no estilo das Joias espirituais (gerar, copiar e salvar). Redesign da navegação: barra superior só com o menu ☰ e o logo/slogan; menu lateral à esquerda com todas as funcionalidades, Sobre e Sair/Fechar; na barra inferior, Ajustes vira Menu; no Início, Pesquisas salvas dá lugar à Leitura diária da Bíblia (Pesquisas salvas e Ajustes ficam no menu).

## 6.4.81

Texto diário: a leitura em voz alta dos Comentários adicionais agora lê o cabeçalho "Comentários adicionais do texto diário", e antes de cada comentário anuncia "Comentário número 1", "Comentário número 2" e assim por diante. Cada fala fica numa linha própria, terminada em ponto, para a voz fazer uma pausa entre uma e outra. O servidor aceita essas falas de anúncio (folga de 120 caracteres na conferência do trecho).

## 6.4.80

Áudio em texto: a lista Arquivos de áudio ficava com duas molduras, uma dentro da outra; agora cada arquivo tem uma moldura só.

## 6.4.79

Formatar → Opções com IA: campo de instruções adicionais para a IA sob o botão Sugerir formatação e sob o botão Responder a pergunta do texto colado. O texto vale mais que o prompt padrão, em todos os pedidos da seção (inclusive Outra sugestão e Melhorar), como nas outras seções.

## 6.4.78

Áudio em texto: o botão Copiar da barra dos campos de texto (transcrição, texto corrigido e resumo) ficava com o texto cortado ("Cop"); agora mostra só o ícone 📋, como o ✏️ (o nome Copiar continua na dica e na leitura de tela).

## 6.4.77

Salvar texto com nome: no Formatar (botão Salvar texto) e no Áudio em texto (transcrição, corrigido e resumo) dá para guardar o texto em Pesquisas e respostas salvas → categoria Textos, pedindo um nome. Esses textos não dependem da semana das reuniões; apagar semanas anteriores não os remove. Abrir um texto salvo coloca o conteúdo no campo Formatar.

## 6.4.76

Áudio em texto, Documentos relacionados: leitura de PowerPoint corrigida (texto nos slides); imagens liberam memória após reduzir; aviso se o pedido passar do limite de tamanho; trava ao anexar vários arquivos; contexto do resumo parcial só na 1ª fatia.

## 6.4.75

Áudio em texto, Documentos relacionados: texto explicativo revisado (mais curto, sem a frase sobre o conteúdo ser lido no aparelho e não guardado no servidor).

## 6.4.74

Áudio em texto: novo bloco Documentos relacionados. Dá para anexar Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx), texto, CSV e imagens (fotos e capturas de tela) ligados ao áudio. O conteúdo é lido no aparelho e, ao pedir o resumo, a IA lê esse material e o leva em conta no resumo e nas conclusões (o prompt do resumo ganhou orientações para isso, inclusive uma seção CONCLUSÕES no formato padrão). Nada é guardado no servidor.

## 6.4.73

Áudio em texto: (1) textos longos são resumidos em partes e depois unidos (instruções do usuário só no final); (2) o PCM decodificado fica em cache no aparelho para nova tentativa; (3) na correção, cada parte seguinte leva um trecho curto da anterior só como contexto.

## 6.4.72

Áudio em texto: (1) a transcrição sobe até 3 trechos ao mesmo tempo; (2) na correção, as informações do áudio vão só na primeira parte e as demais usam um prompt curto; (3) o resumo usa o texto corrigido quando existir, senão a transcrição bruta (corrigir continua opcional).

## 6.4.71

Instruções adicionais para a IA (campo de cada seção, inclusive a tela de esboços): o limite de 800 caracteres foi retirado; o campo aceita tudo o que for digitado (o servidor só põe um teto alto de 30000 caracteres).

## 6.4.70

Formatar, Opções com IA: a chave (🔑) passou para a mesma linha do título, em vez de ficar numa linha abaixo.

## 6.4.69

Áudio em texto: os botões do topo, com arquivos na lista, voltaram aos ícones de antes (🎧 Adicionar arquivo de áudio e 🔴 Gravar novo áudio).

## 6.4.68

Áudio em texto: com arquivos na lista, os botões do topo passam a se chamar ➕ Adicionar arquivo de áudio e ➕ Gravar novo áudio.

## 6.4.67

Áudio em texto: com arquivos na lista, os botões do topo continuam ativos e passam a se chamar Escolher ou adicionar arquivo de áudio e Gravar e adicionar novo áudio (dá para gravar ao vivo e juntar à lista). O botão Adicionar arquivo do card foi retirado.

## 6.4.66

Áudio em texto: os botões Salvar e Descartar de cada arquivo da lista passaram a dividir toda a largura do cartão.

## 6.4.65

Áudio em texto, no computador: o botão da pasta de salvamento automático ocupa toda a largura e passou a se chamar Selecionar a pasta para salvar as gravações automaticamente; depois de escolhida, a pasta aparece em letra pequena sob o título do botão.

## 6.4.64

Áudio em texto: os botões Salvar e Descartar na base de cada arquivo da lista ficaram pequenos e compridos numa linha, no mesmo padrão do Adicionar arquivo e do Descartar todos.

## 6.4.63

Áudio em texto: a gravação ao vivo agora é quebrada em partes (padrão 10 minutos, ajustável pelo administrador; a soma das partes vale o limite da gravação). A cada parte o app fecha o arquivo e começa a próxima sozinho; todas as partes entram na lista de arquivos e ficam guardadas no aparelho até serem transcritas ou descartadas (se o app fechar, elas voltam para a lista). Cada parte tem o seu Salvar, e o botão de salvar a gravação salva todas (no iPhone, pela folha de compartilhar). No computador (Chrome ou Edge) dá para escolher uma pasta onde cada parte é salva sozinha.

## 6.4.62

Configurações do Áudio em texto (administrador): cada seção (tipos deste aparelho, tipos de todos os usuários e limites do áudio) ganhou uma moldura para separar melhor. O título da seção de limites agora é Limites do áudio.

## 6.4.61

Áudio em texto: lista de arquivos. Dá para escolher vários arquivos de uma vez e adicionar outros depois (botão Adicionar arquivo no card Arquivos de áudio); cada arquivo tem o seu Descartar e há o Descartar todos. O Iniciar a transcrição transcreve os arquivos em ordem e o texto sai junto, com uma linha com o nome de cada arquivo. O administrador define quantos arquivos cabem na lista (padrão 5).

## 6.4.60

Áudio em texto: a duração máxima agora é ajustável pelo administrador (Ajustes → Configurações do Áudio em texto → Duração máxima do áudio) e separada em dois limites: arquivo escolhido na pasta do aparelho (padrão 60 minutos, antes 30) e gravação feita ao vivo no app (padrão 30 minutos).

## 6.4.59

Notas de modelo nos botões das telas Leitura e Áudio em texto: o botão Ler mostra a voz e o modelo de voz; Iniciar a transcrição mostra o reconhecimento de voz (Google Chirp 3); Corrigir e Resumir mostram o modelo e o esforço da IA. Corrigir e Resumir passaram a usar o esforço escolhido na tela de modelos (antes ficava no padrão do modelo).

## 6.4.58

Caixinha de formatação da seleção: corrigido no iPhone, onde os botões apareciam mas o toque não aplicava a formatação (o toque agora age no fim do toque, sem perder a seleção).

## 6.4.57

Resposta resumida do texto colado: texto acima do limite recomendado também só pede confirmação em vez de bloquear (até 5 vezes o limite). Novo: ao selecionar um trecho no campo do texto, uma caixinha com negrito, itálico e negrito+itálico aparece junto da seleção, para não precisar rolar até os botões da barra em textos longos.

## 6.4.56

Sugerir formatação com IA: texto acima do limite recomendado não é mais bloqueado; o app avisa o tamanho e pergunta se deseja formatar mesmo assim (vale até 5 vezes o limite, no máximo 30000 caracteres e 500 linhas). Novo: sob o campo do texto, estatísticas discretas (palavras, caracteres, linhas, parágrafos e tempo de leitura em voz alta).

## 6.4.55

Botões da IA: corrigido o aviso de modelo e esforço sob os botões, que não aparecia porque a consulta ao servidor era feita cedo demais, antes de o app terminar de carregar.

## 6.4.54

Preparação de discursos e esboços: nova orientação no prompt padrão. A IA define primeiro como o esboço termina (a admoestação final) e escreve a introdução na mesma linha de raciocínio, para que as duas se espelhem; o tema aparece com destaque na introdução e é retomado na conclusão.

## 6.4.53

Botões da IA: sob o título de cada botão que aciona a IA (responder, sugerir, preparar, elaborar o esboço, corrigir e resumir o áudio) aparece, em letra pequena e discreta, o modelo e o esforço escolhidos (nos esboços, os da Preparação de discursos e esboços). Na tela de modelos, o texto agora diz que o modelo próprio vale só para elaborar o esboço.

## 6.4.52

Preparação de discursos e esboços: nova regra fixa "Leitura sem adiantar o texto". Antes da leitura de um texto bíblico, o esboço não cita nem antecipa nada do conteúdo dele (só perguntas e problemas que a leitura responde); depois da leitura, cita e explica partes do texto à vontade. Textos que não serão lidos podem ser citados em qualquer parte.

## 6.4.51

Tela de prompts (administrador), Modelo, gasto e limites: "🤖 Modelo da IA de texto" e "📜 Preparação de discursos e esboços" ficam cada um no seu contêiner; o botão Salvar para todos fica logo abaixo dos dois.

## 6.4.50

Tela de prompts (administrador), Modelo, gasto e limites: nova opção para escolher outro modelo e outro esforço da IA só para a Preparação de discursos e esboços (Tesouros, discurso curto, discurso público e Outros esboços). Em "o mesmo de cima" (padrão) eles usam o modelo geral.

## 6.4.49

Áudio em texto: Descartar o áudio agora apaga também tudo o que está abaixo (texto transcrito, corrigido, resumo, tipo de áudio e dados do áudio), como o Limpar tudo; pede confirmação quando há texto ou gravação. O Limpar tudo também passou a limpar a linha pequena do tipo de áudio.

## 6.4.48

Esboço de Tesouros da Palavra de Deus: ao carregar a matéria da semana, o card mostra a ilustração do discurso (a que vem no começo da seção Tesouros, antes do item do discurso, e as do próprio item; descrição e legenda, com o botão Copiar), e a IA recebe essas imagens com a orientação de fazer referência a elas no esboço, se ele ainda não as menciona. As imagens dos outros itens da seção ficam de fora.

## 6.4.47

Esboços (Tesouros e discurso curto): só o que vem na matéria principal da apostila ("(Leia …)" no texto dela) e nos esboços (S-34 ou importado) é marcado como LEIA original. Os "(Leia …)" que vêm dentro das publicações citadas como fonte (artigos, trechos, ponto do apêndice) deixam de ser rotulados como LEIA na lista; esses textos continuam na lista, a IA pode sugeri-los e o orador pode marcá-los, e quando entram no esboço aparecem com LEIA dentro dele.

## 6.4.46

Esboços (Tesouros, discurso curto, discurso público e Outros esboços): os textos marcados com LEIA na matéria agora podem ser desmarcados pelo orador. Desmarcado, o texto não entra no esboço (nem fica como "falta"); se o esboço já o lia, o botão passa a "Atualizar o esboço com as mudanças nos textos" e a IA o retira, mantendo o resto. "Limpar marcação" devolve os LEIA.

## 6.4.45

A Sentinela (comentários e dirigente) e Estudo Bíblico (comentários e dirigente): o botão "Carregar perguntas" passa a "Carregar matéria da semana" (e "Recarregar matéria da semana"), e o aviso "Aguardando carregar matéria da semana".

## 6.4.44

Tesouros da Palavra de Deus: o botão "Carregar perguntas" passa a "Carregar matéria da semana" (e "Recarregar matéria da semana"), e o aviso "Aguardando carregar matéria da semana".

## 6.4.43

Áudio em texto: o quadro "Dados do áudio" (o do arquivo) passa a mostrar, numa gravação do app, o mesmo nome com que ela será salva (título + data e hora), e o nome acompanha o título enquanto você digita.

## 6.4.42

Áudio em texto: o campo Título ou tema aceita no máximo 120 caracteres (informado no rótulo e no campo); a gravação salva leva a data e a hora depois do título, ex.: Titulo-20261101-22h45s33.m4a.

## 6.4.41

Áudio em texto: ao salvar uma gravação feita no app, se o título estiver preenchido em "Dados do áudio", ele vira o nome do arquivo salvo.

## 6.4.40

Áudio em texto: com os blocos "Informe o tipo de áudio" e "Dados do áudio" recolhidos, uma linha pequena e discreta sob o título de cada um mostra o tipo de áudio escolhido e o título preenchido.

## 6.4.39

Estudo Bíblico de Congregação: os 4 quadros para responder (Para considerar, Analise mais a fundo, Medite no que aprendeu e Pense no quadro completo) começam sempre marcados.

## 6.4.38

Pesquisas e respostas salvas das joias: cada tipo de resposta (📚 Resumo dos capítulos, ❓ Joia da semana, 💎 Joias da leitura e 📌 Instruções adicionais) é salvo separado e com o nome do que é, mesmo quando foram pedidos juntos; o botão Recuperar traz os mais recentes de cada tipo, e pedir de novo parte só das salvas dos tipos pedidos. No backup do JW Library, o resumo e as instruções adicionais ficam para escolha manual.

A seção "Joias Espirituais" passa a se chamar "💎 Tesouros da Palavra de Deus"; a pergunta da apostila carregada fica numa moldura com o título "Joia espiritual da semana"; a opção vira "Resposta à joia da semana da apostila"; o botão vira "💎 IA - Preparar opção selecionada". Em "Outra resposta" das joias, a IA escolhe outros textos, diferentes dos anteriores (o servidor também descarta joias sobre versículos que já saíram).

## 6.4.37

Nova resposta sobre uma resposta salva (A Sentinela, Estudo Bíblico e Joias): quando a semana já tem resposta salva para o pedido, ela vai à IA como base e a IA a melhora acrescentando o que for possível, sem nunca tirar o que já estava; se não houver o que acrescentar, devolve a mesma resposta com algumas frases reformuladas. O botão Outra resposta passa a funcionar do mesmo jeito.

## 6.4.36

Joias Espirituais: no resumo dos capítulos, o título (ex.: RESUMO DE JEREMIAS 49) fica sempre em negrito e os versículos do início de cada parágrafo ficam sempre entre parênteses e em negrito, ex.: (vv. 1-2).

## 6.4.35

Joias Espirituais: no resumo dos capítulos, os versículos de cada trecho passam para o início do parágrafo, em negrito (antes ficavam no fim, entre parênteses).

## 6.4.34

Joias Espirituais: o resumo dos capítulos sai em parágrafos, um para cada trecho (versículos) do capítulo, cada um com um emoji que ilustra o ponto principal e os versículos entre parênteses.

## 6.4.33

Joias Espirituais: o resumo dos capítulos passa sempre pelo Estudo Perspicaz. A IA indica as cidades, lugares, povos, nações e personagens, o servidor busca os verbetes e a IA completa o resumo com o fundo histórico deles; os verbetes usados aparecem numa linha "🔎 Estudo Perspicaz".

## 6.4.32

Joias Espirituais: o resumo de cada capítulo agora indica os versículos que sustentam a explicação e explica quem são as cidades, lugares, povos, nações e personagens, com o fundo histórico (de 120 a 200 palavras por capítulo).

## 6.4.31

Joias Espirituais: nova opção "📚 Resumo de cada capítulo da leitura da semana" em "O que preparar" e, em "Instruções adicionais para a IA" das Joias, a caixa "⚡ Executar somente estas instruções", que faz a IA ignorar o que está marcado e cumprir só o que o campo pede.

## 6.4.30

Áudio em texto: o ícone de texto no título da tela passa a ser 🔡.

## 6.4.29

Áudio em texto: lixeira discreta, à direita no topo dos blocos "Informe o tipo de áudio" e "Dados do áudio", que limpa todos os campos do bloco (pede confirmação se houver texto).

## 6.4.28

Ajustes → Configurações do Áudio em texto (administrador): nova área "Tipos de áudio de todos os usuários" para editar, reordenar, apagar e criar os tipos 🌐; só vale para os outros ao tocar em Salvar para todos.

## 6.4.27

Áudio em texto: os botões "Salvar como meu tipo" e "Salvar para todos" só aparecem com a opção "➕ Novo tipo…" selecionada; nos tipos da lista não aparecem (o botão de remover dos tipos de todos saiu desta tela).

## 6.4.26

Áudio em texto: o campo "Nome do tipo" só aparece ao escolher a nova opção "➕ Novo tipo…" na lista de tipos de áudio.

## 6.4.25

Áudio em texto: em "Informe o tipo de áudio" há um campo "Nome do tipo" para digitar o nome de um tipo novo; ele vem preenchido ao escolher um tipo e é usado ao salvar como meu tipo ou para todos.

## 6.4.24

Áudio em texto: novo campo "Pauta ou assuntos tratados" em Dados do áudio (vai para a IA na correção e no resumo). Em "Informe o tipo de áudio", o que está escrito nos campos pode ser salvo como "meu tipo" (só neste aparelho) e, para o administrador, "para todos" (publicado no servidor, aparece com 🌐 para quem usa o app) ou removido dos tipos de todos.

## 6.4.23

Áudio em texto: dois novos tipos de áudio, "ATA DE REUNIÃO - Assuntos do departamento" e "ATA DE REUNIÃO - Reunião entre setores", que pedem uma ata padrão completa, com campos [PREENCHER] para o que faltar.

## 6.4.22

Leitura em voz alta: sem texto, o campo e o cartão ficam baixos; ao colar ou importar um texto, voltam a ocupar a tela.

## 6.4.21

Áudio em texto: com um áudio escolhido ou gravado, os botões "Escolher o arquivo de áudio" e "Gravar um áudio agora" ficam desabilitados até a pessoa descartá-lo.

## 6.4.20

Áudio em texto: o botão Limpar do card "Dados do áudio" passa a se chamar Descartar.

## 6.4.19

Áudio em texto: os campos "Sobre o áudio" e "Como fazer o resumo" crescem sozinhos para mostrar o texto inteiro, sem barra de rolagem.

## 6.4.18

Áudio em texto: o gráfico da gravação ficou mais baixo, com fundo azul claro e barras que mudam de cor conforme o volume (azul, verde, amarelo e vermelho).

## 6.4.17

Áudio em texto: o botão Limpar do card "Dados do áudio" fica sempre disponível (também depois de iniciar a transcrição); se a transcrição estiver andando, ela é interrompida.

## 6.4.16

Áudio em texto: o card do arquivo passa a se chamar "Dados do áudio" e, recolhido, fica baixo como os outros contêineres.

## 6.4.15

Áudio em texto: na correção e no resumo, a barra que não andava foi trocada por um indicador girando com a mensagem do que a IA está fazendo; o título do card do arquivo agora tem uma seta que recolhe e mostra os dados (o botão Ocultar/Mostrar saiu).

## 6.4.14

Áudio em texto: depois de iniciar a transcrição, o card com os dados do arquivo continua à mostra enquanto a pessoa transcreve, corrige e resume; um botão "Ocultar/Mostrar" permite recolher os dados.

## 6.4.13

Corrigir com a IA: quando o texto é uma conversa ou diálogo, a IA passa a escrever cada fala em um parágrafo com travessão (—), para mostrar que são pessoas diferentes falando.

## 6.4.12

Áudio em texto: textos curtos mostram "menos de 1 min de leitura" na linha sob o título do contêiner.

## 6.4.11

Áudio em texto: sob o título de Transcrever, Corrigir e Resumir aparece uma linha pequena com o número de palavras, de caracteres e o tempo de leitura quando já há texto, e o título do contêiner fica verde.

## 6.4.10

Áudio em texto: ao abrir os contêineres Corrigir e Resumir, o campo e as barras de formatação (A−, A+, editar, copiar, negrito, itálico, Word e Limpar tudo) já aparecem, como no Transcrever, ainda vazios até a IA responder.

## 6.4.09

Áudio em texto: a seta do ícone do título ficou mais fina (➔).

## 6.4.08

Áudio em texto: tirado o aviso "Confira os dados do arquivo e toque em Iniciar a transcrição"; o ícone do título agora mostra o microfone, uma seta e o texto (áudio vira texto).

## 6.4.07

Áudio em texto: o título "Arquivo escolhido" e o botão Limpar ficaram alinhados na vertical, e o Limpar ganhou um vermelho suave.

## 6.4.06

Corrigido: depois de ler um texto em voz alta na tela Leitura, as outras telas que usam o mesmo estilo (como o Áudio em texto) ficavam com os botões e contêineres escondidos. As regras do modo de leitura agora valem só dentro da tela Leitura.

## 6.4.05

Áudio em texto: no card do arquivo escolhido, a origem passou a ser "pasta local".

## 6.4.04

Áudio em texto: o contêiner Transcrever só aparece depois de escolher um arquivo, de finalizar uma gravação ou quando já existe texto transcrito; o botão "Iniciar a transcrição" fica fixo dentro dele (só habilita com um áudio escolhido ou gravado); espaços revisados entre o título, o botão, a barra de andamento e os botões de formatação.

## 6.4.03

Áudio em texto: Transcrever, Corrigir e Resumir viraram contêineres recolhíveis, só com o título à mostra. Dentro de cada um ficam o botão da ação, a barra de andamento e o resultado; a barra da transcrição passou para dentro do contêiner Transcrever. Corrigir e Resumir só aparecem quando há texto transcrito.

## 6.4.02

Áudio em texto: os contêineres "Corrigir com a IA" e "Resumir com a IA" só aparecem quando há um texto transcrito.

## 6.4.01

Áudio em texto: cada etapa (Iniciar a transcrição, Corrigir com a IA e Resumir com a IA) virou um contêiner só, com o botão da ação em cima e o resultado logo abaixo, que recolhe junto.

## 6.4.00

Áudio em texto: a ordem ficou Texto transcrito, botão Corrigir com a IA, Texto corrigido, botão Resumir com a IA (o último) e Resumo.

## 6.3.99

Áudio em texto: o gráfico da gravação não fica mais "grosso" nas primeiras barras com o ambiente em silêncio; o ruído de fundo constante é descontado e as barras cobrem só a faixa da voz.

## 6.3.98

Áudio em texto: enquanto grava, aparece um gráfico de barras animado (tipo equalizador) que se mexe com a voz; parado quando a gravação está pausada.

## 6.3.97

Áudio em texto: o botão "Parar e transcrever" passou a se chamar "Finalizar gravação" (a gravação já não é transcrita sozinha ao terminar).

## 6.3.96

Áudio em texto: a ordem passou a ser Texto transcrito, Corrigir com a IA (Texto corrigido) e, por último, Resumir com a IA (Resumo).

## 6.3.95

Áudio em texto: os campos "Texto transcrito", "Resumo" e o novo "Texto corrigido" ficam em contêineres recolhíveis. Novo botão "Corrigir com a IA": a IA corrige o texto transcrito sem resumir (gramática, coerência, repetições sem sentido, ruídos e trechos fora do assunto), em blocos, e o resultado aparece no contêiner "Texto corrigido".

## 6.3.94

Áudio em texto: o campo Data de "Dados do áudio" não passa mais da largura do contêiner no celular, e a caixa "mesmo do arquivo" fica alinhada com o título do campo.

## 6.3.93

O card do arquivo ganhou o botão "Limpar", para desistir do arquivo (escolhido ou gravado) antes de transcrever.

Áudio em texto: ao parar a gravação, o app não transcreve sozinho; mostra o card "Arquivo gravado" com os dados (nome, origem, tipo, tamanho, data e hora, duração), dá a opção de salvar a gravação no aparelho e só transcreve no botão "Iniciar a transcrição". O card dos dois casos passou a mostrar a origem do áudio.

## 6.3.92

Áudio em texto: novo tipo de áudio "Ligação telefônica - recebimento de denúncia" (denúncia recebida por telefone de outro colaborador ou de pessoa externa), com a descrição e o modo de resumir já preenchidos. Quem já tem a lista salva no aparelho recebe o tipo novo uma vez.

Áudio em texto: em "Dados do áudio", "Título ou tema" e "Data" ganharam a caixa "mesmo do arquivo", que preenche o campo com o nome e a data do arquivo (ou da gravação).

Áudio em texto: ao escolher um arquivo, o app mostra os dados dele (nome, tipo, tamanho e duração) e só transcreve depois do botão "Iniciar a transcrição"; o contêiner do resumo só aparece quando o resumo é pedido; "Copiar" fica na barra de cima, e "Word" e "Limpar tudo" ficam juntos embaixo de cada contêiner.

Áudio em texto: o texto transcrito e o resumo ficam cada um num contêiner, com a mesma barra de botões; o botão "Resumir com a IA" fica entre os dois; o botão "Word com resumo e transcrição" saiu (cada contêiner tem o seu Word).

Áudio em texto: novo botão "📋 Dados do áudio" (título ou tema, interlocutores — um campo novo a cada interlocutor —, evento, local e data), que vai à IA junto com o "Sobre o áudio". O limite do campo no servidor subiu para 2500 caracteres. O campo "Como fazer o resumo" deixou de ser salvo no aparelho: começa em branco a cada abertura do app e só o tipo de áudio escolhido o preenche.

## 6.3.91

Áudio em texto: os botões "Escolher o arquivo de áudio" e "Gravar um áudio agora" ficam lado a lado, dividindo a mesma linha.

## 6.3.90

Áudio em texto: a opção "⚙️ Informações e instruções para a IA (opcional)" passou a se chamar "⚙️ Informe o tipo de áudio".

## 6.3.89

O aviso "Há uma versão nova" agora aparece só uma vez por versão; ao voltar ao app, ele não é mostrado de novo para a mesma versão.

## 6.3.88

Áudio em texto: removidos os textos explicativos abaixo do seletor de tipo, de "Sobre o áudio" e de "Como fazer o resumo".

## 6.3.87

Áudio em texto: o botão "Limpar os dois campos" saiu; no seu lugar, o seletor de tipo de áudio ganhou a primeira opção "Nenhum (sem informações nem instruções)", que deixa os dois campos em branco, e o tipo escolhido continua visível. Corrigido: ao escolher um tipo, o campo "Como fazer o resumo" também é preenchido (listas salvas com esse campo vazio recebem a sugestão original).

## 6.3.86

Áudio em texto: novo botão "Limpar os dois campos" (Sobre o áudio e Como fazer o resumo), para desfazer o que um tipo de áudio preencheu.

## 6.3.85

Áudio em texto: os tipos de áudio originais agora vêm com uma sugestão pronta no campo "Como fazer o resumo" (discurso público, palestra, auditoria, reunião de equipe, de setores, com cliente, treinamento, entrevista e anotação de voz).

## 6.3.84

Áudio em texto: "Configurações do Áudio em texto" agora é exclusiva do administrador (fica no grupo 🛡️ de Ajustes) e cada tipo de áudio ganhou o campo "Como fazer o resumo", que preenche o campo de mesmo nome ao escolher o tipo.

## 6.3.83

Preparação de discursos (Tesouros e discurso curto): o botão "IA - Elaborar o esboço do discurso" não aceita clique enquanto a matéria do discurso da semana não foi carregada; libera sozinho ao carregar.

## 6.3.82

Preparação de discursos e esboços: a matéria carregada do discurso (pontos, textos, fontes e imagens da apostila) agora fica dentro de um card.

## 6.3.81

Preparação (Tesouros e discurso curto): o botão "Carregar discurso" passou a se chamar "Carregar matéria do discurso (wol.jw.org)" (e "Recarregar matéria do discurso (wol.jw.org)" depois de carregado).

## 6.3.80

Preparar para comentar e para dirigir: o card da pergunta do parágrafo ficou com fundo branco (sem cor).

## 6.3.79

Preparar para comentar e para dirigir: a pergunta do parágrafo ganhou moldura; "(opção 1 de x)" passou para a frente do título "Parágrafos", entre parênteses e sem negrito; os botões "Recuperar … salvas" ficaram num amarelo mais suave.

## 6.3.78

Preparar para comentar e para dirigir: os botões "Recuperar a resposta salva" / "Recuperar as perguntas salvas" ficaram em amarelo mais forte, para se destacar.

## 6.3.77

Preparar para comentar e para dirigir: os botões "Carregar / Recarregar perguntas" ganharam a mesma cor dos botões "IA - Responder…" do grupo.

## 6.3.76

Preparar para comentar e para dirigir: os botões "IA - Responder…", "Preparar as joias", "Responder às perguntas", "Sugerir perguntas adicionais" e "Preparar para dirigir o estudo" não aceitam clique enquanto as perguntas (a matéria) da semana escolhida não foram carregadas; ao carregar (ou ao trocar para uma semana já carregada) eles liberam sozinhos.

## 6.3.75

Estudo Bíblico de Congregação: rótulos soltos de imagem ("Imagem A") deixam de ser contados como pergunta (a numeração da Análise voltava deslocada e a fonte da pergunta 2 ia para outra); cada pergunta recebe colado o trecho da publicação que cita.

## 6.3.74

Backup JW: menos consultas ao wol.jw.org (Sentinela sem buscar o Estudo Bíblico; cache da semana compartilhado; identificar parágrafos só ao tocar no botão); joias casam melhor com a pergunta da apostila; Nova resposta lista o capítulo do EBC; respostas do dirigente entram nas preparadas.

## 6.3.73

Estudo Bíblico de Congregação: publicações citadas nas perguntas passam a ser lidas mesmo sem intervalo de parágrafo no link; o servidor garante os trechos das perguntas pedidas antes de chamar a IA e avisa se alguma fonte citada não puder ser lida.

## 6.3.72

Ajustes: o título do quadro dos esboços do S-34 passou a ser "Esboços de discursos - S-34".

## 6.3.71

Backup, resumo da mesclagem: o botão "Voltar à seleção dos arquivos" passou para o fim do quadro; a linha "Etiquetas novas" da tabela agora é ela mesma o botão que abre as etiquetas (some a segunda linha "Ver as etiquetas novas"). Backup novo: o quadro "Conteúdo do backup novo", ao abrir, mostra primeiro uma tabela de resumo só com o que já foi criado nele (respostas, notas, grifos, favoritos, marcadores, listas e etiquetas).

## 6.3.70

Backup novo (vazio): o quadro "Exportação" (planilha e CSV das notas) não aparece mais, porque o backup novo não tem notas para exportar. Nos outros backups (abertos ou mesclados) continua.

## 6.3.69

Backup, respostas preparadas: o aviso "N respostas foram incluídas no backup aberto…" saiu; depois de incluir, as respostas ficam marcadas como "incluída no backup" na lista. Só aparecem avisos quando alguma resposta não entra ou quando nada estava marcado.

## 6.3.68

Backup, respostas preparadas: na reunião do meio de semana, a linha com a data da semana (título da apostila) saiu da lista, porque a barra da semana, no alto, já mostra a data; continua aparecendo o título do capítulo do Estudo Bíblico. Em A Sentinela continua o título do artigo.

## 6.3.67

Backup, respostas preparadas: o botão "Ir para gerar o arquivo do backup" (atalho de rolagem que aparecia depois de incluir respostas) foi removido por ser confuso; o aviso depois de incluir já diz para tocar em Gerar, lá embaixo.

## 6.3.66

Backup: (1) ao criar um backup vazio, o quadro "Conteúdo do backup novo" não abre mais sozinho (o backup está vazio); (2) respostas preparadas para as reuniões: a semana agora é escolhida com a mesma barra da tela Reuniões (setas, "Semana atual", "Voltar para a semana atual") e os botões das reuniões mostram quantas respostas salvas a semana tem em cada uma; (3) o botão "Incluir respostas no backup" ficava desabilitado na reunião do meio de semana porque quase nenhuma resposta tinha pergunta de destino. Agora as joias sobre o versículo da pergunta da apostila vão para a caixa dessa pergunta, as joias da leitura da Bíblia vão juntas (numa resposta só) para a pergunta geral das joias, e as respostas do Estudo Bíblico vão para as caixas do capítulo do estudo da semana (Considerar, Analise, Medite e Quadro completo), que o servidor passou a informar (documento próprio, publicação wcg). Quando nenhuma pergunta é achada, o resumo continua dizendo de quais falta escolher a pergunta.

## 6.3.65

Backup, respostas preparadas: "Marcar todas" e "Desmarcar todas" passam a valer para todas as respostas que ainda podem entrar (antes o "Marcar todas" só marcava as que já tinham pergunta de destino e, quando nenhuma tinha, parecia não fazer nada). As marcadas sem pergunta de destino aparecem no resumo ("falta escolher a pergunta de: …"). A rolagem da tela é mantida ao tocar nos botões, e as caixas de marcar da lista ficam claras (brancas, azuis com o visto quando marcadas) em vez de pretas no tema escuro.

## 6.3.64

Início: no iPhone 17 (402 px de largura) os atalhos saíam para fora do cartão. Os textos "Requer o código do dirigente" (que não quebram de linha) alargavam as colunas da grade e empurravam o quadro da direita para além da borda. Agora as duas colunas têm largura fixa (cada uma metade do cartão, mesmo que o texto seja maior), o espaço interno dos botões no modo apertado ficou menor e a letra da frase do cadeado, um pouco menor, para o texto caber inteiro.

## 6.3.63

Áudio em texto: (1) "Informações e instruções para a IA" ficou dentro de um contêiner (caixa com borda) e os campos "Sobre o áudio" e "Como fazer o resumo" ficaram maiores (6 linhas, letra de 16 px); (2) novo seletor "Tipo de áudio" acima do campo "Sobre o áudio", com descrições prontas: discurso em uma reunião pública das Testemunhas de Jeová, palestra profissional sobre tema empresarial ou administrativo, entrevista com colaborador durante uma auditoria interna, reunião com equipe de colaboradores, reunião com setores da empresa, reunião com cliente ou fornecedor, treinamento ou aula, entrevista ou conversa geral e anotação de voz pessoal (escolher um tipo preenche o campo e pergunta antes de trocar um texto que a pessoa já escreveu); (3) nova seção em Ajustes → "🎙️ Configurações do Áudio em texto", onde se muda o nome e a descrição de cada tipo, cria tipos novos, reordena, apaga e restaura os originais (salvo neste aparelho e listado em Privacidade e dados deste aparelho).

## 6.3.62

Áudio em texto: o texto de "Como funciona" agora explica também a gravação de um áudio na hora (permissão do microfone, pausa, transcrição ao parar, tela aberta durante a gravação), o limite de 30 minutos para os dois jeitos e os recursos dos campos (Editar, negrito e itálico, A− e A+, Word).

## 6.3.61

Áudio em texto: novo botão "📄 Word com resumo e transcrição", que abre a prévia do Word com os dois num arquivo só (o resumo primeiro e, depois, o texto transcrito, cada um com o título em negrito). Só fica ativo quando existem o resumo e o texto transcrito; os botões Word de cada campo continuam como estavam.

## 6.3.60

Áudio em texto: novo botão "🔴 Gravar um áudio agora", ao lado de "Escolher o arquivo de áudio". Ele pede a permissão do microfone, mostra o tempo de gravação com Pausar/Continuar, Parar e transcrever e Descartar, e ao parar a gravação já é carregada e transcrita, como um arquivo escolhido (limite de 30 minutos; a tela fica ligada durante a gravação, quando o aparelho permite). Se o aparelho interromper a gravação (por exemplo, o app foi para o segundo plano), o que foi gravado até ali é aproveitado. Há um botão para salvar a gravação no aparelho. Política de privacidade 1.7 (uso do microfone).

## 6.3.59

Áudio em texto: os campos "Texto transcrito" e "Resumo" crescem sozinhos para mostrar o texto inteiro (como o campo de texto da Formatação) e ganharam uma barra com A− e A+ (tamanho da letra, guardado neste aparelho), ✏️ Editar e 📄 Word. Os campos ficam só para ver e formatar até tocar em Editar: aí viram texto simples para escrever e corrigir; ao tocar em Concluir edição, dá para selecionar um trecho e aplicar Negrito, Itálico ou Negrito itálico (as mesmas letras formatadas do campo de texto) ou Tirar a formatação. O botão Word abre a mesma prévia do campo de texto (com o tamanho da letra) e baixa ou compartilha o arquivo .docx, com o nome "Transcrição - nome do áudio" ou "Resumo - nome do áudio".

## 6.3.58

Tela Início: o atalho e o botão da barra de baixo (nome ao tocar e segurar) passaram de "Leitura em voz alta" para "Leitura em voz".

## 6.3.57

Backup vazio: o aviso "Backup vazio criado. Use Nova resposta…" foi retirado (o backup novo abre direto, sem a mensagem).

## 6.3.56

Leitura em voz alta: volume parelho entre as partes. Cada parte do texto é um pedido separado ao Google e o volume da voz varia de um pedido para outro (uma parte saía normal e a seguinte fraca); o destaque da frase não interferia, ele só acompanha o tempo do áudio. Agora cada parte é medida (só a fala, sem as pausas) e tocada com o ganho que a leva ao mesmo volume (entre -6 dB e +12 dB, com suavização de picos); diferenças de menos de 1 dB não são mexidas. O ajuste é feito no aparelho, em segundo plano, enquanto a parte anterior toca. O arquivo de áudio salvo continua com o áudio original.

## 6.3.55

Tela Backup: o card "Conteúdo do backup" (aberto, novo ou mesclado) agora é recolhível: toque no título para fechar ou abrir, com a seta à direita como nas outras seções. Começa aberto.

## 6.3.54

Backup: nova seção própria "📚 Respostas preparadas para as reuniões" (saiu da Nova resposta). Escolha a semana (só aparecem as que têm respostas salvas em Pesquisas salvas) e a reunião: fim de semana (A Sentinela) ou meio de semana (apostila). A lista vem toda marcada e cada resposta mostra a pergunta de destino (dá para trocar e para ver o texto); as sem pergunta correspondente ficam sem marca até você escolher o destino. Um botão "Incluir N respostas no backup" leva só as marcadas, as incluídas ficam verdes ("incluída no backup"), o aviso diz que ainda falta gerar o arquivo e há um atalho para isso. Também: Marcar/Desmarcar todas, aviso das que já têm resposta no backup e das que disputam a mesma pergunta.

## 6.3.53

Backup vazio: (1) a categoria padrão passou a ser Respostas; (2) em Nova resposta → "Carregar as publicações de uma semana", depois de carregar aparece "Levar as respostas salvas da semana" com A Sentinela e Apostila: ao marcar uma, o app procura em Pesquisas salvas as respostas dessa semana e leva todas de uma vez para o backup (A Sentinela pelo número do parágrafo e pelos quadros de recapitulação; na apostila, a pergunta das joias). Cada resposta aparece numa lista para ver o texto que foi levado; as que não casam com nenhuma pergunta ficam marcadas e podem ser ligadas à pergunta certa à mão.

## 6.3.52

Mesclar backups: a linha de contagens de cada arquivo ganhou as etiquetas (notas / respostas / grifos / marcadores / etiquetas). Os marcadores são os marcadores de página do JW Library (poucos, em posições fixas), não as etiquetas.

## 6.3.51

Tela de prompts da IA, em Diversos: nova anotação do administrador "🎙️ Código de texto (anotação)", igual às do dirigente, da leitura e do S-34 (campo, Copiar e Salvar anotação; guardada no servidor, só o administrador vê).

## 6.3.50

As funções que só funcionam porque o código delas está salvo neste aparelho ganharam um ícone pequeno e discreto, uma chave (🔑), ao lado do nome: Comentários, Dirigentes, Discursos, Leitura em voz alta e Áudio em texto (atalhos do Início), os grupos de Reuniões, Formatar → Opções com IA, o card Discurso público - lista de temas e o Texto diário. Passando o dedo ou o mouse, o ícone explica que a função depende do código salvo. Enquanto a função está bloqueada, o ícone some e vale o cadeado.

## 6.3.49

O card "Discurso público - lista de temas (esboços do S-34)" agora aparece mesmo sem o código do S-34, só que bloqueado: em lilás (cor diferente dos grupos cinza), com cadeado e o aviso "Requer o código do S-34 (Ajustes)"; não abre até o código ser salvo.

## 6.3.48

Código do S-34 (variável CODIGO_S34 na Vercel): a seção "🎙️ Discurso público - lista de temas (esboços do S-34)" só aparece para quem salvou esse código em Ajustes → 🔐 Autorização de acessos (campo novo "📜 Código do S-34"); sem ele, a seção fica escondida. O servidor também exige o código (além do do dirigente) para listar os temas, ler o esboço e gerar o esboço com IA. Se o código for trocado na Vercel, o app apaga o salvo e esconde a seção. Nova anotação do administrador "📜 Código do S-34 (anotação)" na tela de prompts da IA, em Diversos.

## 6.3.47

Tela Backup: (1) o bloco de gerar o arquivo (Gerar backup modificado / mesclado, Salvar o arquivo, Compartilhar) passou para o fim da página, depois do card de conteúdo do backup; (2) o botão "Abrir e editar backup" ficou azul bem clarinho com borda escura e texto escuro, no padrão dos outros; (3) o botão "Mesclar arquivos importados" ficou amarelo clarinho com borda escura.

## 6.3.46

Mesclar backups: cada arquivo escolhido mostra, numa linha só e separados por barra, quantas notas, respostas, grifos e marcadores tem (por exemplo, "878 notas / 266 respostas / 16.238 grifos / 10 marcadores"), e não só as notas.

## 6.3.45

Backup: o arquivo gerado (modificado, novo ou mesclado) agora sai só com a extensão .jwlibrary. Antes o iPhone (e talvez outros aparelhos) acrescentava ".zip" no fim do nome, porque o arquivo era marcado como ZIP, e o JW Library não reconhecia o backup. Agora o arquivo é marcado como arquivo comum, tanto ao baixar quanto ao compartilhar.

## 6.3.44

Backup, Nova resposta: no celular, ao tocar no campo Documento (e nos outros seletores largos), o fundo ficava azul forte e o texto "Escolha o documento…" não dava para ler. Agora o campo fica com um fundo bem suave (o mesmo das opções selecionadas) e o texto legível enquanto está tocado, aberto ou com o foco.

## 6.3.43

Backup, categoria Respostas: toda resposta aparece dentro do seu artigo, mesmo quando a edição tem só um artigo. Se o título ainda não é conhecido (o backup não o traz e o wol.jw.org ainda não foi consultado), o nível do artigo mostra "Artigo (documento N)" e troca pelo título assim que ele é identificado.

## 6.3.42

Backup: com um backup aberto, saem "Criar backup vazio" (o botão some também durante uma mesclagem; criar um vazio é uma escolha do começo) e "Mesclar: importar notas de outro backup" de dentro da seção, que passou a se chamar "📤 Exportação" (para mesclar, há o botão "Abrir outro backup para mesclar" no topo).

## 6.3.41

Mesclar backups: (1) o painel "Selecionar o que importar" tem dois botões gerais, "✅ Importar tudo" (limpa a seleção) e "⬜ Desmarcar tudo" (nada entra até marcar o que se quer); (2) o resumo "Vai importar" virou uma tabela (notas, respostas, grifos e marcadores, com "Vai entrar" e "No arquivo" e a linha de total), sem o texto explicativo; (3) a opção "Mostrar só o que veio da mesclagem" ficou num cartão, abaixo da busca; (4) no backup mesclado não aparecem mais "Nova resposta" nem o aviso dos parágrafos; (5) na árvore do conteúdo, os títulos (tipo, publicação, edição e artigo) que têm itens vindos da mesclagem ficam em verde, sublinhados e com "🆕 N" antes do total.

## 6.3.40

Mesclar backups: (1) depois de mesclar, o conteúdo abre na categoria Respostas; (2) as respostas escolhidas (e o resumo do painel) só contam as que têm texto, e o resumo mostra quantos grifos, marcadores e respostas já estavam na base (por isso "8 escolhidas" podiam virar "7 novas"); (3) no conteúdo do backup mesclado, os itens que vieram da mesclagem aparecem realçados (borda e fundo verdes e o selo "🆕 novo"), e há a caixa "🆕 Mostrar só o que veio da mesclagem"; (4) os três botões do começo da tela Backup têm cores diferentes: abrir (azul), mesclar (verde) e criar backup vazio (laranja); (5) "↩️ Voltar à seleção dos arquivos" esconde o conteúdo e o resumo, deixando só as opções da mesclagem como no começo; mesclar de novo os traz de volta, e cancelar também.

## 6.3.39

Mesclar backups: (1) a árvore "Por publicação e artigo" ordena do mais novo para o mais antigo nas edições (e na ordem do app nos livros, capítulos e artigos); (2) as listas de "Selecionar o que importar" agora se SOMAM em vez de se anularem: uma lista só vale depois que você mexe nela, e o que estiver marcado em qualquer uma que valha é importado (notas: árvore, etiquetas e uma a uma; respostas: árvore e uma a uma; grifos e marcadores: árvore); sem mexer em lista alguma, tudo vem; há "🔄 Importar tudo (limpar a seleção)" e o resumo do painel diz o que vai entrar de cada tipo; (3) o botão "Selecionar o que importar" perdeu a bolinha; (4) as opções passaram para o topo da mesclagem, abaixo do texto sobre o arquivo base, com o título "O que será mesclado" e a nova opção "Notas" (para mesclar só grifos, marcadores e respostas), em duas linhas.

## 6.3.38

Mesclar backups: (1) "Selecionar o que importar" ganhou a seção "📚 Por publicação e artigo", uma árvore (tipo > publicação > edição > artigo, como a revista A Sentinela de agosto de 2026 e o artigo dela) com caixas em cada nível: marcar ou desmarcar vale para tudo o que há ali (notas, respostas, grifos e marcadores), com busca e "marcar/desmarcar todas"; o painel mostra "Vai importar X de Y notas, respostas, grifos e marcadores"; (2) depois de mesclar, o resumo tem "↩️ Voltar à seleção dos arquivos", que reabre a primeira fase com os arquivos, a base, as regras e os filtros como estavam, para mudar e mesclar de novo (as alterações feitas no backup mesclado depois disso se perdem, com aviso); (3) "☑️ Selecionar o que importar" virou um 4º botão, abaixo de Remover, em roxo claro; (4) "Usar como base" passou a "Usar como arquivo base".

## 6.3.37

Mesclar backups: (1) as opções "grifos", "marcadores" e "respostas" ficam numa moldura fina com o título "Além das notas"; (2) os botões do começo ("Abrir e editar backup" e "Mesclar backups") somem enquanto há um backup aberto ou uma mesclagem sendo montada (para vê-los de novo, feche o backup ou cancele a mesclagem), e o botão de abrir vira "Abrir outro backup para mesclar", que inclui outro backup na mesclagem; (3) o conteúdo do backup aberto (categoria, agrupar, busca e lista) ficou num contêiner com título e explicação ("Conteúdo do backup mesclado", "Conteúdo do backup aberto"...); (4) em cada arquivo que não é a base, o texto "☑️ Selecionar o que importar" (no cabeçalho, sem ocupar linha) abre um painel para escolher o que entra: notas por etiqueta ou uma a uma, e respostas por publicação ou uma a uma, com busca e "marcar/desmarcar listadas"; o painel mostra "Vai importar X de Y notas e Z de W respostas".

## 6.3.36

Mesclar backups: (1) as respostas (campos "Sua resposta") também entram, em nova opção "Mesclar também as respostas" (se o aberto já tem resposta no mesmo campo, fica a dele; vazio, recebe a da origem); (2) em cada arquivo que não é a base há um botão discreto 🎚️ (acende quando há filtro) que abre uma lista de caixas para escolher o que importar dele: as etiquetas das notas (inclusive "sem etiqueta") e as respostas por publicação (por exemplo, só as de A Sentinela ou só as da apostila), cada lista com "todas" e "nenhuma"; sem tocar no botão, tudo é importado; (3) o resumo mostra quantas das notas que entraram são avulsas, as respostas novas e em quantos arquivos há filtro. Uma duplicada cuja versão vencedora fica de fora pelo filtro mantém a da base.

## 6.3.35

Backup: em Importação e exportação, "Mesclar: importar notas de outro backup" (num backup aberto) agora leva à mesma mesclagem de 2 a 5 arquivos: o backup que está aberto, com as alterações já feitas nele, entra como o 1º arquivo (e base) e já abre a escolha do 2º. Num backup que já é o resultado de uma mesclagem, essa opção some. A escolha de notas por etiqueta da importação antiga deixou de ser usada.

## 6.3.34

Etiquetas novas do resumo da mesclagem: na ordem alfabética, uma seção por letra (A, B, C…; as que não começam por letra ficam em "#"), como já era feito com os meses na ordem por data; os meses passaram a aparecer como "Julho de 2021" (só a primeira letra maiúscula).

## 6.3.33

Mesclar backups: dá para escolher qual arquivo é a base (botão "⭐ Usar como base" em cada arquivo; por padrão, o 1º): tudo da base fica, e dos outros arquivos entram as notas, os grifos e os marcadores que a base ainda não tem. Grifos: os que a base não tem (mesmo UserMarkGuid), com o trecho e o lugar. Marcadores: os que a base não tem (mesmo lugar, parágrafo e título), cada um no primeiro slot livre da publicação. Duas opções (marcadas por padrão) permitem deixar de fora os grifos ou os marcadores. As regras para notas duplicadas valem para qualquer arquivo-base. Depois da mesclagem aparece um "📊 Resumo da mesclagem" (notas que entraram, notas repetidas e iguais, notas duplicadas com diferenças ou "nenhuma encontrada", grifos, marcadores e etiquetas novas) com as etiquetas novas numa seção recolhível, em pílulas como no JW Library, em ordem alfabética ou por data (mês e ano da nota mais antiga que usa a etiqueta). A linha de resumo do backup aberto deixou de mostrar "formato 16" (é a versão técnica do banco de dados do JW Library) e passou a dizer "aparelho …" (quem fez o backup) ou, no mesclado, "base: …".

## 6.3.32

Backup: o botão "Abrir backup" passou a "📂 Abrir e editar backup (.jwlibrary)" e ganhou, logo abaixo, "🔀 Mesclar backups (2 a 5 arquivos)": abre uma área com um campo para cada arquivo (os dois primeiros sempre; o 3º, o 4º e o 5º aparecem depois de adicionar o anterior, como opcionais), cada um mostrando o nome e quantas notas tem, com Trocar e Remover, e o botão "🔀 Mesclar arquivos importados" (a partir de 2 arquivos). O 1º arquivo é a base e as notas dos outros entram nele, com cor, trecho grifado e etiquetas (o mesmo caminho da importação de notas que já existia). Notas repetidas: quando a mesma nota (mesmo Guid) está em mais de um arquivo com diferenças (título, texto, cor ou etiquetas), a pessoa escolhe qual versão vale: a mais recente (pela data de modificação; padrão), sempre a de um arquivo escolhido, ou uma a uma, com o botão "🔍 Resolver duplicadas (N)", que lista cada nota com as versões de cada arquivo e permite marcar várias e aplicar a todas de uma vez ("usar a mais recente" ou "usar a do arquivo X"). No fim abre a tela de edição de sempre com o "Backup mesclado", para editar e gerar o arquivo ("Backup_mesclado_NoteStyle_…jwlibrary"). Se algo falhar, nada do que estava aberto é alterado. O aviso "Cuidado" da explicação do Backup ganhou moldura fina e fundo suave.

## 6.3.31

Backup: a explicação da tela ficou mais curta (frases resumidas, letra e espaços menores) para o cartão de opções aparecer inteiro na tela do celular.

## 6.3.30

Backup: a explicação voltou ao texto completo (sem a frase sobre o envio do arquivo e o wol.jw.org) e o título passou a "Para que serve esta função"; cada tópico e o aviso de cuidado começam com um emoji; o botão da barra de baixo passou a se chamar "Backup JW", numa linha só e com os ícones alinhados.

## 6.3.29

Ajustes: mais espaço entre os rótulos "Ajustes gerais" e "Exclusivo do administrador" e o primeiro cartão de cada contêiner. Backup: o texto embaixo dos botões saiu (já está na documentação do app) e entrou, antes do cartão, uma explicação curta e recolhível do que a tela permite fazer (ver, procurar, agrupar, editar, apagar, incluir, mesclar, exportar, criar backup vazio e gerar o backup modificado), compacta para o cartão de opções continuar visível sem rolar; ela aparece aberta sem backup aberto, recolhe sozinha quando um backup é aberto e abre de novo quando ele é fechado.

## 6.3.28

Texto diário: o botão ✨ Gerar comentários adicionais não some mais depois de gerar ou recuperar os comentários (fica sempre visível). Tela Formatar: o convite para o FunPlayB ficou compacto (ícone à esquerda, texto à direita, numa moldura) para caber na tela do celular sem cortar. Ajustes: as opções ficam em dois contêineres, "Ajustes gerais" (todos os usuários) e "Exclusivo do administrador" (só aparece com a senha de administrador salva).

## 6.3.27

Comentários adicionais do texto diário: a parte que cita o ponto do texto de hoje ("Como vimos no texto de hoje, …") aparece em negrito e itálico, e a aplicação, em texto normal; cada comentário começa com um emoji do assunto, antes do ponto. A IA agora devolve o comentário em dois campos (base e aplicação) e um emoji; o servidor os junta num comentário só (o que a voz lê e o que é copiado), então comentários salvos antes continuam funcionando, só sem negrito nem emoji. O negrito e o itálico se mantêm quando a leitura em voz alta divide o comentário em frases (a base é a(s) primeira(s) frase(s)). Se a tela Prompts da IA tiver uma versão salva do prompt dos comentários do texto diário, restaure o padrão.

## 6.3.26

Comentários adicionais do texto diário (prompt do servidor): cada comentário passa a começar chamando a atenção para o ponto específico do texto de hoje em que se baseia ("Como vimos no texto de hoje…", "O texto de hoje mostrou que…", "O texto de hoje nos ajudou a entender que…", "Um dos destaques do texto de hoje foi…"), com a abertura variada, e só então traz a aplicação a um aspecto da vida cristã (família, casamento, ministério, personalidade, conduta, entretenimento etc.); de 3 a 4 frases. Se a tela Prompts da IA tiver uma versão salva desse prompt, ela vale no lugar do padrão: restaure o padrão ou cole o texto novo.

## 6.3.25

Destaque da frase lida: os cantos ficam sempre arredondados (no texto do dia e nos comentários, a frase em várias linhas ficava com cantos quadrados nas quebras de linha). Ajustes → Leitura em voz alta: o texto explicativo do campo da cor do destaque saiu (fica só a amostra) e o do tempo de espera foi resumido em uma linha.

## 6.3.24

Leitura em voz alta: a frase que está sendo lida passa a ser destacada em cor forte (antes, amarelo fraco), nos temas claro e escuro, na tela Leitura, no texto do dia e nos comentários. A cor é escolhida em Ajustes → Leitura em voz alta (amarelo, laranja, laranja escuro, roxo ou azul; padrão laranja), neste aparelho, com uma amostra ao lado.

## 6.3.23

Leitura em voz alta do texto do dia e dos comentários dele: terminada a leitura, a caixa que oferece salvar o áudio (ou fechar) se fecha sozinha depois do mesmo tempo de espera que inicia a leitura (Ajustes → Leitura em voz alta, padrão 4 s; em "Não iniciar nem fechar sozinho" ela fica aberta), se a pessoa não fez nada. A descrição do campo em Ajustes passou a explicar os dois usos. A Leitura em voz alta e as demais leituras continuam com a caixa aberta até a pessoa fechar.

## 6.3.22

Barra de baixo: o botão Pesquisas deu lugar ao 🎙️ Áudio (tela Áudio em texto; fica bloqueado sem o código de texto). As pesquisas e respostas salvas continuam no atalho "Pesquisas salvas" do Início. O botão "Escolher o arquivo de áudio" ganhou a cor dos botões principais da tela Leitura. No resumo do áudio, a troca de "culto" por "reunião" passou a ajustar o artigo (a reunião, uma reunião).

## 6.3.21

Áudio em texto: dois campos opcionais para a IA. "Sobre o áudio" (quem fala, assunto, nomes e termos; vale só para o áudio atual e é limpo em Limpar tudo) e "Como fazer o resumo" (formato, tamanho e foco; fica salvo neste aparelho para os próximos áudios). O servidor os manda à IA separados da transcrição: o contexto ajuda a entender o assunto e a grafia de nomes, e as instruções mandam no formato do resumo, sem autorizar inventar fatos. Política de Privacidade 1.6 cita os dois campos.

## 6.3.20

Início: o botão "Pesquisas salvas" (Pesquisas e respostas salvas) voltou aos atalhos (agora são 8, em pares). Quando a tela do celular não comporta tudo, os atalhos perdem a descrição e encolhem (ícone e letras menores), para o Início caber sem rolar. A tela Áudio em texto passou a ser reconhecida como tela própria na busca de onde fica cada elemento.

## 6.3.19

Áudio em texto (nova tela, atalho do Início, só com o código de texto): escolha um arquivo de áudio (mp3, m4a, wav, mp4…); o app o decodifica no aparelho, corta em trechos de ~50 s e o servidor (api/transcrever.mjs) transcreve cada trecho com a API Speech-to-Text V2 do Google (modelo chirp_3, pt-BR, região us, pontuação automática). Depois a IA pode resumir o texto. Limite de 30 minutos por arquivo; trechos em silêncio não são enviados; nada fica guardado no servidor nem no app. Novo código de texto (variável CODIGO_TEXTO) em Ajustes → Autorização de acessos. A autenticação no Google passou para api/_googleToken.mjs, compartilhada com a leitura em voz alta. Não identifica quem fala (isso exigiria o Cloud Storage e o BatchRecognize). Política de Privacidade 1.5: descreve o envio do áudio (em trechos) ao Google e do texto à Anthropic, o consentimento específico e o cuidado com a voz de terceiros.

## 6.3.18

Política de Privacidade 1.4: descreve o piloto de aprendizado com as correções (recurso exclusivo do administrador, desligado por padrão): o que é enviado à IA, que só a lição (regra curta e geral) é guardada no Blob privado, que os textos original e corrigido são descartados, que as lições só entram nos pedidos do administrador e como vê-las, desativá-las e apagá-las; a retenção no servidor foi atualizada.

## 6.3.17

Rolagem: o efeito elástico das telas (a página cede um pouco ao puxar além do topo ou do fim) voltou; a regra que o desligava (overscroll-behavior-y: none) saiu. A barra de baixo continua na sua própria camada. Puxar para atualizar continua só na tela Início.

## 6.3.16

Memória do piloto: as lições só entram nas respostas de IA quando o pedido vem do administrador (o app envia a senha de administrador salva no aparelho; o servidor a confere); para os demais usuários nada muda. A leitura da memória nas respostas passa a ter um cache de 30 s por instância (gravações a invalidam), em vez de ler o Blob a cada chamada; e `memoriaUsada` é contada por pedido, sem se misturar entre pedidos simultâneos.

## 6.3.15

Leitura em voz alta do texto diário: o código de pesquisa sozinho não basta mais para sintetizar texto arbitrário. O servidor só gera áudio de trechos cobertos por um cupom assinado emitido ao carregar o texto do dia ou ao gerar os comentários da IA.

## 6.3.14

Preferências publicadas: as 3 seções da resposta (complementares, aplicativas e entendimento) voltam a vir marcadas no padrão do Global Config. Memória do piloto: com a chave geral ligada, lições ativas entram no system prompt das respostas de IA (filtradas pela tarefa, até 8); a resposta JSON inclui `memoriaUsada` para medir o piloto.

## 6.3.13

Prompts da IA: ao abrir, se alguma parte ligada à qualidade das respostas (voz, formatação, contexto, pedidos, perguntas, texto diário, EBC dirigente) ainda diferir do texto que veio com o app, aparece um aviso listando quais — para o administrador revisar ou restaurar o padrão.

## 6.3.12

Imagens no parágrafo: traço antes e depois da descrição/legenda, para não misturar com a pergunta. Seções da resposta: as 3 primeiras opções (complementares, aplicativas e entendimento) vêm marcadas por padrão. Formatar → Opções com IA só com o código de pesquisa (sem ele, o cartão fica cinza e bloqueado). Velocidade padrão da voz em Ajustes usa as mesmas opções da barra do tocador (0,5× a 2×).

## 6.3.11

Imagens do capítulo: o botão 📋 Copiar de cada descrição fica sempre na linha de baixo do texto, alinhado à esquerda (deixou de ficar colado no fim da frase).

## 6.3.10

Ajustes → Prompts da IA: com a senha de administrador salva, deixa de piscar o aviso “Abrir Autorização de acessos” enquanto busca os textos; depois da primeira carga na sessão, reabre na hora (como Leitura em voz alta e Esboços).

## 6.3.09

Ajustes: Prompts da IA deixa de abrir numa tela separada e passa a expandir para baixo, como as outras opções; as setas ▸ dos botões da lista de Ajustes ficam maiores.

## 6.3.08

Botões de carregar perguntas, discurso, joias, imagens da apostila e de pesquisar na biblioteca passam a mostrar “Consultando o wol.jw.org…” (e o mesmo na faixa do topo), em vez de “Consultando a IA…”, porque essas consultas não usam a Anthropic. Os botões que geram respostas e esboços continuam com “Consultando a IA…”.

## 6.3.07

Consultas que só leem o wol.jw.org, o S-34 ou os versículos (carregar matéria, lista de parágrafos quando o site responde, tesouros, joias, EBC, discurso curto, temas públicos, pesquisa de outros esboços) deixam de exigir a chave da IA e de gastar o limite de pedidos por hora; se a lista da Sentinela precisar da IA porque a leitura falhou, aí sim valem a chave e a cota. Formatos travados: perguntas do EBC para o dirigente passam a ser “até 5” (sem forçar cinco); “Gerar outros” no texto diário pede outras palavras, sem outro enfoque inventado. Política de Privacidade 1.3: armazenamento local só no localStorage; pdf.js do cdnjs entra junto com JSZip e sql.js.

## 6.3.06

Ajustes: a seção "Leitura em voz alta" volta ao seu local original exclusivo do administrador (com ícone de escudo 🛡️ e agrupada após a linha separadora de opções administrativas).

## 6.3.05

Leitura em voz alta: ao tocar no botão do alto-falante 🔊 ou em "Ler", o tocador aguarda 4 segundos com contagem regressiva antes de iniciar o áudio direto se o usuário não mexer nas opções de configuração de voz (tempo configurável em Ajustes → Leitura em voz alta).

## 6.3.04

Tela Leitura em voz alta: botão "Ler" no tom pastel suave alaranjado, combinando com o botão "Importar PDF ou Word".

## 6.3.03

Tela Leitura em voz alta: suavizado o tom de laranja do botão "Ler" para um laranja mais aberto e harmonioso.

## 6.3.02

Tela Leitura em voz alta: os botões "Importar PDF ou Word" (laranja suave, na cor da página) e "Ler" (laranja forte) deixam o azul e ganham a moldura de 2px dos demais botões.

## 6.3.01

Memória do piloto: em vez de guardar o texto original e o corrigido, a IA agora compara os dois, entende o que mudou (por exemplo, o sentido de uma pergunta), o provável motivo e escreve uma regra curta e geral; só essa lição é guardada (os textos são lidos para a análise e descartados). Mudanças só de digitação ou de conteúdo pessoal não viram lição. A caixa ao salvar passou a "🧠 Aprender com esta correção" e a seção em Prompts da IA lista as lições (o que mudou, por quê, regra) para desativar ou apagar. O arquivo antigo da 6.3.00, com os textos inteiros, é apagado do Blob na primeira leitura.

## 6.3.00

Memória de correções (piloto, só administrador, por enquanto só guarda): ao tocar em Salvar alterações numa pesquisa salva que você editou, aparece a caixa "🧠 Guardar esta correção para melhorar as próximas respostas" (desmarcada, só com a senha de administrador salva). Marcada, o par "texto da IA → texto final" (com o tipo e o título) vai para o Blob privado do servidor. Em Prompts da IA há a seção "🧠 Memória de correções" com a chave geral do piloto, a lista, desativar, apagar uma e apagar todas. Nenhuma resposta da IA usa a memória ainda; o backup do JW Library nunca entra.

## 6.2.17

Prompts da IA: novo botão "♻️ Restaurar todos os padrões" no fim da tela, ao lado de "Salvar para todos" e "Voltar à versão anterior". Volta todos os textos editáveis ao padrão do app, para todos os usuários (limites e modelo da IA não mudam) e pede confirmação; "Voltar à versão anterior" desfaz.

## 6.2.16

Qualidade da IA (causa 1, só prompts do servidor): a Voz das respostas manda responder primeiro à pergunta exata, sem fechamentos do tipo "o que aprendemos" nem aplicação não pedida e sem mostrar raciocínio; emojis, fontes decorativas e listas numeradas só quando as preferências permitirem e ajudarem (fontes raras, 1 a 3 emojis, lista só com 3 ou mais pontos); a abertura da orientação do usuário passa a citar as exceções (formato JSON, fidelidade às fontes e segurança). Se a tela Prompts da IA tiver uma versão salva dessas partes, ela vale no lugar do padrão: restaure ou cole o texto novo.

## 6.2.15

Qualidade da IA (fase 0, só prompts do servidor): o contexto "Sobre mim e a congregação" virou pano de fundo com regras de uso (a pergunta e a fonte mandam; não forçar família, trabalho, serviço de campo ou casamento; variar exemplos); os pedidos "Outra sugestão"/"Outras perguntas"/"Outra versão" deixam de incentivar novidade sem fundamento (se a fonte não sustenta outro enfoque, mudam só as palavras ou devolvem menos perguntas); o Estudo Bíblico do dirigente passa a pedir "até 5" perguntas (antes pedia 5 e também dizia para não fazer pergunta sem resposta no relato).

## 6.2.14

Leitura em voz alta: o destaque da frase lida não cobre mais o que a voz pula (o que está entre parênteses, as referências a publicações e a referência depois do travessão); só os trechos realmente lidos ficam realçados. Vale na tela Leitura, no texto diário e nos comentários.

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

