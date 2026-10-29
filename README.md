# NoteStyle

PWA estático de formatação de notas (negrito, itálico, fontes, emojis, listas e modelos em Unicode) com funções serverless na Vercel para IA, voz e leitura do wol.jw.org.

## Estrutura

| Caminho | Função |
|---|---|
| `index.html` | Estrutura (HTML) do app. |
| `app.css`, `app.js` | Estilos e lógica do app. A versão está em `APP_VERSION` (no `app.js`). |
| `sw.js` | Service worker. A cache leva o nome da versão (`sw.js?v=APP_VERSION`). |
| `defaults.json`, `emoji-busca.json`, `jw-publicacoes.json` | Dados estáticos. |
| `api/sugerir-formatacao.mjs` | Rota principal de IA (formatação, estudo, EBC, joias, discursos, backup). |
| `api/config.mjs` | Painel do administrador. |
| `api/voz.mjs`, `api/texto-diario.mjs` | Voz (Google TTS) e texto diário. |
| `api/_acesso.mjs` | Níveis de acesso de cada tarefa da IA (`NIVEIS`). Toda tarefa nova de `sugerir-formatacao.mjs` deve ser registrada ali. |
| `api/_*.mjs` | Módulos internos (o `_` impede a Vercel de publicá-los como rota). |

## Variáveis de ambiente (Vercel)

| Variável | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | IA de texto. |
| `ANTHROPIC_ADMIN_KEY` | Opcional: gasto do mês (Cost API). |
| `CLAUDE_MODEL`, `CLAUDE_EFFORT`, `CLAUDE_RACIOCINIO` | Opcionais: padrões da IA. |
| `CODIGO_ESTUDO`, `CODIGO_DIRIGENTE`, `CODIGO_LEITURA`, `CODIGO_ADMIN` | Códigos de acesso. |
| `GLOBAL_CONFIG` (ou `EDGE_CONFIG`), `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID` | Armazenamento das configurações do administrador. |
| `BLOB_READ_WRITE_TOKEN` | Esboços S-34 e fontes (Vercel Blob). |
| `GOOGLE_TTS_CREDENCIAIS`, `GOOGLE_TTS_API_KEY` | Voz. |

## Desenvolvimento

- `npm run check`: confere a sintaxe de todos os arquivos de `api/`.
- Numeração: três números, e **o último nunca passa de 99** (sempre com dois dígitos: 6.2.00 … 6.2.99, depois 6.3.00). No `package.json` vai o mesmo número sem o zero à esquerda (6.2.5 para 6.2.05), porque o npm não aceita o zero.
- Ao mudar o app (`index.html`, `app.css` ou `app.js`), aumente `APP_VERSION` em `app.js`: isso renova a cache do service worker e é o que faz o app instalado avisar que há versão nova e registre a mudança em `CHANGELOG.md`.
- Deploy: push para o repositório conectado à Vercel.
