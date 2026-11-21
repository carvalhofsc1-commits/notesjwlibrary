# NoteStyle

PWA de formatação de notas (negrito, itálico, fontes, emojis, listas e modelos em Unicode) com um servidor Node.js no Google Cloud para IA, voz e leitura do wol.jw.org.

## Hospedagem (Google Cloud, projeto `notestyle-512212`, região `southamerica-east1`)

| O quê | Onde |
|---|---|
| Site (`index.html`, `app.js`, ícones etc.) | Firebase Hosting, em `www.notestyle.com.br` (`firebase.json`) |
| API e servidor (`server.mjs`, pasta `api/`) | Cloud Run, serviço `notestyle` (`Dockerfile`) |
| Arquivos privados e configurações | Cloud Storage, bucket `notestyle-dados-pessoal` |
| Segredos (códigos, chaves) | Secret Manager |
| Publicação | Cloud Build, gatilho `notestyle-main` (`cloudbuild.yaml`): cada `git push` na `main` publica o Cloud Run e o Firebase |

## Estrutura

| Caminho | Função |
|---|---|
| `index.html` | Estrutura (HTML) do app. |
| `app.css`, `app.js` | Estilos e lógica do app. A versão está em `APP_VERSION` (no `app.js`). |
| `sw.js` | Service worker. A cache leva o nome da versão (`sw.js?v=APP_VERSION`). |
| `defaults.json`, `emoji-busca.json`, `jw-publicacoes.json` | Dados estáticos. |
| `server.mjs` | Servidor do Cloud Run: serve o site e chama os handlers de `api/<nome>.mjs`. |
| `api/sugerir-formatacao.mjs` | Rota principal de IA (formatação, estudo, EBC, joias, discursos, backup). |
| `api/config.mjs` | Painel do administrador. |
| `api/voz.mjs`, `api/texto-diario.mjs` | Voz (Google TTS) e texto diário. |
| `api/_acesso.mjs` | Níveis de acesso de cada tarefa da IA (`NIVEIS`). Toda tarefa nova de `sugerir-formatacao.mjs` deve ser registrada ali. |
| `api/_blob.mjs`, `api/_armazem.mjs` | Armazenamento (Cloud Storage; pasta local nos testes). |
| `api/_*.mjs` | Módulos internos (o `_` os mantém fora das rotas públicas). |
| `ferramentas/` | Programas de uso no computador: `aprovar-cadastro.mjs`, `criar-segredos.mjs`, `subir-fontes.mjs`, `epub-para-txt.mjs`, `preparar-fontes-novas.mjs` e `extratores/` (extração das publicações). Ficam fora do site e do servidor. |

## Variáveis de ambiente (Cloud Run; os segredos vêm do Secret Manager)

| Variável | Uso |
|---|---|
| `HOSPEDAGEM`, `GCS_BUCKET` | `gcp` e o nome do bucket. |
| `ORIGENS_PERMITIDAS` | Endereços do site liberados para chamar a API (CORS). |
| `MERCADOPAGO_URL_AVISO`, `MERCADOPAGO_ACCESS_TOKEN` | Pagamentos. |
| `ANTHROPIC_API_KEY` | IA de texto. |
| `ANTHROPIC_ADMIN_KEY` | Opcional: gasto do mês (Cost API). |
| `CLAUDE_MODEL`, `CLAUDE_EFFORT`, `CLAUDE_RACIOCINIO` | Opcionais: padrões da IA. |
| `CODIGO_ESTUDO`, `CODIGO_DIRIGENTE`, `CODIGO_LEITURA`, `CODIGO_RESUMO`, `CODIGO_S34`, `CODIGO_TEXTO`, `CODIGO_ADMIN` | Códigos de acesso (a senha de administrador vale para todas as funções). |
| `GOOGLE_TTS_CREDENCIAIS`, `GOOGLE_STT_BUCKET`, `GOOGLE_ALT_CREDENCIAIS`, `GOOGLE_ALT_STT_BUCKET` | Voz e transcrição. |

## Desenvolvimento

- `npm run check`: confere a sintaxe de todos os arquivos de `api/`.
- Teste local: `node --env-file=.env.servidor-local server.mjs` (pasta `.dados-local` no lugar do bucket).
- Numeração: três números, e **o último nunca passa de 99** (sempre com dois dígitos: 6.2.00 … 6.2.99, depois 6.3.00). No `package.json` vai o mesmo número sem o zero à esquerda (6.2.5 para 6.2.05), porque o npm não aceita o zero.
- Ao mudar o app (`index.html`, `app.css` ou `app.js`), aumente `APP_VERSION` em `app.js`: isso renova a cache do service worker e é o que faz o app instalado avisar que há versão nova e registre a mudança em `CHANGELOG.md`.
- Deploy: `git push` na `main`; o Cloud Build publica sozinho (leva uns 3 a 4 minutos).
