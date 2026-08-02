/*
  Service worker do Conversor para Notas do JW Library.

  A versão vem da query do próprio registro (sw.js?v=9.5), escrita pelo index.html a
  partir de APP_VERSION. Assim a versão mora num lugar só: mudar APP_VERSION troca a URL
  do worker — o que já dispara a atualização — e o nome da cache junto.
*/

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'jw-notas-' + VERSION;

// Só o essencial leve. O icon-512.png (283 KB) fica de fora de propósito: é usado
// apenas na instalação do app e entra na cache sob demanda, na primeira vez que
// o navegador pedir por ele.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'favicon-32.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll falha por inteiro se um único arquivo faltar; guardar um a um deixa a
    // instalação sobreviver a um ícone ausente numa publicação incompleta.
    await Promise.all(PRECACHE.map(async url => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.warn('[sw] não consegui pré-carregar', url, e);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(
      nomes
        .filter(nome => nome.startsWith('jw-notas-') && nome !== CACHE)
        .map(nome => caches.delete(nome))
    );
    await self.clients.claim();
  })());
});

// Busca na rede e guarda a cópia boa. Se a rede falhar, entrega o que estiver na cache.
// Usado no HTML e no defaults.json: os dois precisam ser frescos quando há conexão.
async function redePrimeiro(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const guardado = await cache.match(request, { ignoreSearch: true });
    if (guardado) return guardado;

    // Numa navegação sem rede e sem cópia exata, o index.html pré-carregado serve.
    if (request.mode === 'navigate') {
      const inicio = await cache.match('index.html');
      if (inicio) return inicio;
    }

    throw e;
  }
}

// Entrega da cache na hora e só vai à rede quando não tem nada guardado.
// Usado nos ícones e no manifest, que praticamente não mudam.
async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(redePrimeiro(request));
    return;
  }

  if (url.pathname.endsWith('defaults.json')) {
    event.respondWith(redePrimeiro(request));
    return;
  }

  if (/\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cachePrimeiro(request));
  }
});
