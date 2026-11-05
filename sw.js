/*
  Service worker do app Formatação de notas para o JW Library.

  A versão vem da query do próprio registro (sw.js?v=2.0), escrita pelo index.html a
  partir de APP_VERSION. Assim a versão mora num lugar só: mudar APP_VERSION troca a URL
  do worker — o que já dispara a atualização — e o nome da cache junto.
*/

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'jw-notas-' + VERSION;
// As bibliotecas de terceiros (pasta vendor/) mudam raramente: ficam numa cache própria, que NÃO muda a cada versão do app (nem é apagada na atualização),
// para não baixá-las de novo (cerca de 2,2 MB) a cada publicação. Só a cache-primeiro; se um dia uma versão delas mudar, troque o número abaixo.
const CACHE_VENDOR = 'jw-vendor-1';
const VENDOR = [
  'vendor/jszip.min.js',
  'vendor/sql-wasm.js',
  'vendor/sql-wasm.wasm',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js'
];

// Só o essencial leve. O icon-512.png (~149 KB) fica de fora de propósito: é usado
// apenas na instalação do app e entra na cache sob demanda, na primeira vez que
// o navegador pedir por ele.
const PRECACHE = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'leitura-biblia-programa.js',
  'biblia-versiculos.js',
  'exportar-pagina.js',
  'defaults.json',
  'manifest.webmanifest',
  // Os ícones vão com ?v=3 (o mesmo endereço usado no HTML e no manifesto) para trocar os antigos guardados.
  'icon-192.png?v=3',
  'favicon-32.png?v=3',
  'apple-touch-icon.png?v=3',
  'icon-header.png?v=3'
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
// Usado no HTML, no CSS, no JS e nos JSON: precisam ser frescos quando há conexão.
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

// Guarda as bibliotecas de vendor/ que ainda não estão na cache (a página pede isso depois de abrir; é o que faz o backup do JW Library e o PDF
// funcionarem sem internet). Cada arquivo que falhar é ignorado: será guardado quando for usado.
self.addEventListener('message', event => {
  if (event.data !== 'aquecer-vendor') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VENDOR);
    await Promise.all(VENDOR.map(async url => {
      try {
        if (!(await cache.match(url))) await cache.add(new Request(url, { cache: 'reload' }));
      } catch (e) { /* sem rede agora: fica para o primeiro uso */ }
    }));
  })());
});

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

  if (url.pathname.includes('/vendor/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VENDOR);
      const guardado = await cache.match(request);
      if (guardado) return guardado;
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === 'navigate' || /\.(html|css|js)$/.test(url.pathname)) {
    event.respondWith(redePrimeiro(request));
    return;
  }

  if (url.pathname.endsWith('defaults.json') || url.pathname.endsWith('emoji-busca.json')) {
    event.respondWith(redePrimeiro(request));
    return;
  }

  if (/\.(png|jpe?g|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cachePrimeiro(request));
  }
});
