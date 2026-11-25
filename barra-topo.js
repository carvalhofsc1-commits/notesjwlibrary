// 6.13.79: a barra do topo das páginas Sobre, Termos de uso e Política de privacidade (documentos à parte do app): sempre visível, com o menu à
// esquerda, o logo no centro (leva ao app) e a seta Voltar à direita (a mesma lógica do botão "← Voltar" do fim da página). Usa as cores da própria
// página (--card, --line, --text, --brand), então acompanha o tema claro e o escuro.
(function () {
  if (document.getElementById('barraTopoEstatica')) return;
  var estilo = document.createElement('style');
  estilo.textContent =
    '#barraTopoEstatica{position:sticky;top:0;z-index:1400;display:flex;align-items:center;gap:10px;padding:1px 12px;min-height:46px;box-sizing:border-box;background:var(--card,#fff);color:var(--text,#1f2937);border-bottom:1px solid var(--line,#d1d5db);}' +
    '#barraTopoEstatica button,#barraTopoEstatica a{font:inherit;}' +
    '#barraTopoEstatica .bt-menu,#barraTopoEstatica .bt-voltar{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;margin:0;padding:0;cursor:pointer;color:var(--text,#1f2937);}' +
    '#barraTopoEstatica .bt-menu{width:36px;height:36px;border:0;border-radius:12px;background:transparent;font-size:1.5rem;line-height:1;}' +
    '#barraTopoEstatica .bt-voltar{width:42px;height:30px;margin:0 -3px;border:1px solid #c4c9d1;border-radius:10px;background:#f1f2f4;color:#4f46e5;}' +
    '#barraTopoEstatica .bt-logo{flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;color:var(--text,#1f2937);font-weight:800;font-size:1.25rem;}' +
    '#barraTopoEstatica .bt-logo img{width:30px;height:30px;display:block;}' +
    '#barraTopoEstatica .bt-logo b{color:var(--brand,#5b3fb5);}' +
    '#barraTopoEstatica .bt-lista{position:absolute;left:8px;top:calc(100% + 4px);min-width:230px;display:none;flex-direction:column;padding:6px;background:var(--card,#fff);border:1px solid var(--line,#d1d5db);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);}' +
    '#barraTopoEstatica .bt-lista.aberta{display:flex;}' +
    '#barraTopoEstatica .bt-lista a{padding:10px 12px;border-radius:8px;text-decoration:none;color:var(--text,#1f2937);font-size:.98rem;}' +
    '#barraTopoEstatica .bt-lista a:hover{background:var(--soft,#eef2ff);}';
  document.head.appendChild(estilo);

  var barra = document.createElement('header');
  barra.id = 'barraTopoEstatica';
  barra.innerHTML =
    '<button type="button" class="bt-menu" aria-label="Abrir o menu" aria-expanded="false" aria-controls="btLista">☰</button>' +
    '<a class="bt-logo" href="index.html#inicio" aria-label="Ir para o NoteStyle"><img src="icon-header.png?v=3" alt="" width="30" height="30"><span>Note<b>Style</b></span></a>' +
    '<button type="button" class="bt-voltar" aria-label="Voltar" title="Voltar"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H5"/><path d="M11 5.5 4.5 12 11 18.5"/></svg></button>' +
    '<nav class="bt-lista" id="btLista" aria-label="Menu">' +
    '<a href="index.html#inicio">🏠 Início do app</a>' +
    '<a href="sobre.html">ℹ️ Sobre o NoteStyle</a>' +
    '<a href="termos.html">📄 Termos de uso</a>' +
    '<a href="privacidade.html">🔒 Política de privacidade</a>' +
    '</nav>';
  document.body.insertBefore(barra, document.body.firstChild);

  var menu = barra.querySelector('.bt-menu');
  var lista = barra.querySelector('.bt-lista');
  function alternar(abrir) {
    lista.classList.toggle('aberta', abrir);
    menu.setAttribute('aria-expanded', String(abrir));
  }
  menu.addEventListener('click', function (e) { e.stopPropagation(); alternar(!lista.classList.contains('aberta')); });
  document.addEventListener('click', function () { alternar(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') alternar(false); });

  // Voltar: à tela anterior (o app ou outra página de informações); sem ter vindo do app (endereço direto, outro site), vai a Ajustes.
  barra.querySelector('.bt-voltar').addEventListener('click', function () {
    var origem = '';
    try { origem = new URL(document.referrer).origin; } catch (erro) { }
    if (origem && origem === location.origin && history.length > 1) history.back();
    else location.href = 'index.html#ajustes';
  });
})();
