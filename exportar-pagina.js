// Exporta o conteúdo completo de uma página fixa (Sobre, Privacidade, Termos de Uso) para um arquivo Word (.docx), sempre passando pela prévia.
// O botão só aparece para o administrador: quando a senha de administrador está salva neste aparelho (Ajustes → Autorização de acessos).
(function () {
  var SENHA_KEY = 'jwLibraryNoteAplicarAdminSenhaV1';
  var JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

  function admin() {
    try { return Boolean((localStorage.getItem(SENHA_KEY) || '').trim()); } catch (e) { return false; }
  }

  function carregarJsZip() {
    if (window.JSZip) return Promise.resolve();
    return new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = JSZIP;
      s.onload = ok;
      s.onerror = function () { falha(new Error('Sem conexão para carregar o gerador de Word. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
  }

  var xml = function (t) {
    return String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  function run(texto, f, tam) {
    if (!texto) return '';
    var pr = (f.b ? '<w:b/><w:bCs/>' : '') + (f.i ? '<w:i/><w:iCs/>' : '') + (tam ? '<w:sz w:val="' + tam + '"/><w:szCs w:val="' + tam + '"/>' : '');
    return '<w:r>' + (pr ? '<w:rPr>' + pr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + xml(texto) + '</w:t></w:r>';
  }

  // O texto em linha de um elemento: negrito, itálico e quebras de linha; listas dentro dele ficam de fora (têm parágrafos próprios).
  function runs(no, f, tam) {
    var saida = '';
    no.childNodes.forEach(function (c) {
      if (c.nodeType === 3) {
        saida += run(c.nodeValue.replace(/\s+/g, ' '), f, tam);
      } else if (c.nodeType === 1) {
        var t = c.tagName;
        // Os elementos de bloco têm os seus próprios parágrafos (blocos): aqui entra só o texto em linha.
        if (c.hidden || /^(SCRIPT|STYLE|IMG|BUTTON|UL|OL|TABLE|P|H[1-6]|DIV|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|MAIN|NAV|DETAILS|SUMMARY|BLOCKQUOTE)$/.test(t) || c.hasAttribute('data-nao-exportar')) return;
        if (t === 'BR') saida += '<w:r><w:br/></w:r>';
        else saida += runs(c, { b: f.b || /^(STRONG|B)$/.test(t), i: f.i || /^(EM|I)$/.test(t) }, tam);
      }
    });
    return saida;
  }

  function paragrafo(conteudo, opcoes) {
    var o = opcoes || {};
    var pr = (o.manter ? '<w:keepNext/>' : '') + '<w:spacing w:before="' + (o.antes || 0) + '" w:after="' + (o.depois === undefined ? 120 : o.depois) + '"/>' + (o.recuo ? '<w:ind w:left="' + o.recuo + '" w:hanging="' + (o.pendente || 0) + '"/>' : '');
    return '<w:p><w:pPr>' + pr + '</w:pPr>' + conteudo + '</w:p>';
  }

  function tabela(el) {
    var linhas = '';
    el.querySelectorAll('tr').forEach(function (tr) {
      var celulas = '';
      tr.querySelectorAll(':scope > th, :scope > td').forEach(function (td) {
        var cab = td.tagName === 'TH';
        celulas += '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>' + (cab ? '<w:shd w:val="clear" w:color="auto" w:fill="E5E7EB"/>' : '') + '</w:tcPr>' +
          paragrafo(runs(td, { b: cab, i: false }, 20), { depois: 40 }) + '</w:tc>';
      });
      if (celulas) linhas += '<w:tr>' + celulas + '</w:tr>';
    });
    var borda = function (n) { return '<w:' + n + ' w:val="single" w:sz="4" w:space="0" w:color="9CA3AF"/>'; };
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borda).join('') +
      '</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>' + linhas + '</w:tbl>' + paragrafo('', { depois: 120 });
  }

  function lista(el, nivel) {
    var saida = '';
    var numero = 0;
    var ordenada = el.tagName === 'OL';
    Array.prototype.forEach.call(el.children, function (li) {
      if (li.tagName !== 'LI') return;
      numero++;
      var marca = ordenada ? numero + '. ' : (nivel ? '◦ ' : '• ');
      saida += paragrafo(run(marca, {}, 0) + runs(li, {}, 0), { depois: 60, recuo: 360 + nivel * 360, pendente: 280 });
      Array.prototype.forEach.call(li.children, function (filho) {
        if (/^(UL|OL)$/.test(filho.tagName)) saida += lista(filho, nivel + 1);
      });
    });
    return saida + (nivel === 0 ? paragrafo('', { depois: 60 }) : '');
  }

  function blocos(el) {
    var saida = '';
    Array.prototype.forEach.call(el.children, function (c) {
      var t = c.tagName;
      if (c.hidden || /^(SCRIPT|STYLE|IMG|BUTTON|NAV)$/.test(t) || c.hasAttribute('data-nao-exportar')) return;
      if (t === 'H1') saida += paragrafo(runs(c, { b: true }, 36), { antes: 120, depois: 160, manter: true });
      else if (t === 'H2') saida += paragrafo(runs(c, { b: true }, 28), { antes: 240, depois: 100, manter: true });
      else if (/^H[3-6]$/.test(t)) saida += paragrafo(runs(c, { b: true }, 24), { antes: 160, depois: 80, manter: true });
      else if (t === 'SUMMARY') saida += paragrafo(runs(c, { b: true }, 24), { antes: 160, depois: 80, manter: true });
      else if (/^(UL|OL)$/.test(t)) saida += lista(c, 0);
      else if (t === 'TABLE') saida += tabela(c);
      else if (/^(DIV|SECTION|ARTICLE|ASIDE|HEADER|FOOTER|MAIN|DETAILS|BLOCKQUOTE)$/.test(t)) {
        var proprio = runs(c, {}, 0).replace(/<w:r><w:t xml:space="preserve"> <\/w:t><\/w:r>/g, '');
        if (proprio) saida += paragrafo(proprio);
        saida += blocos(c);
      } else {
        var conteudo = runs(c, {}, 0);
        if (conteudo.replace(/<w:r><w:t xml:space="preserve"> <\/w:t><\/w:r>/g, '')) saida += paragrafo(conteudo);
      }
    });
    return saida;
  }

  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  async function gerar() {
    await carregarJsZip();
    var principal = document.querySelector('main') || document.body;
    var corpo = blocos(principal);
    var zip = new window.JSZip();
    var agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    var cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    zip.file('[Content_Types].xml', cab + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels', cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/styles.xml', cab + '<w:styles ' + NS + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>');
    zip.file('word/document.xml', cab + '<w:document ' + NS + '><w:body>' + corpo + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>');
    zip.file('docProps/core.xml', cab + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xml(document.title) + '</dc:title><dc:creator>NoteStyle</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + agora + '</dcterms:created></cp:coreProperties>');
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  function nomeDoArquivo() {
    var base = document.title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'NoteStyle';
    return base.slice(0, 80) + '.docx';
  }

  var ESTILO_PREVIA = [
    '#previaWord{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;background:#e5e7eb}',
    '#previaWord .pw-topo{padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 8px;background:#fff;border-bottom:1px solid #cbd5e1}',
    '#previaWord .pw-botoes{display:flex;flex-wrap:wrap;gap:8px;max-width:780px;margin:0 auto}',
    '#previaWord .pw-botoes button{flex:1 1 130px;margin:0;padding:10px 12px;border:1px solid #94a3b8;border-radius:10px;background:#f1f5f9;color:#0f172a;font:inherit;font-weight:700;cursor:pointer}',
    '#previaWord .pw-botoes button[hidden]{display:none}',
    '#previaWord .pw-aviso{max-width:780px;margin:6px auto 0;text-align:center;font-size:.85rem;color:#334155}',
    '#previaWord .pw-corpo{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:14px 14px calc(env(safe-area-inset-bottom,0px) + 28px)}',
    '#previaWord .pw-folha{max-width:780px;margin:0 auto;padding:18px 16px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;font-family:Calibri,Carlito,"Segoe UI",system-ui,sans-serif;font-size:11pt;line-height:1.35;overflow-wrap:anywhere}',
    '#previaWord .pw-folha *{color:#111827!important;background:transparent!important;box-shadow:none!important;text-shadow:none!important}',
    '#previaWord .pw-folha h1{font-size:18pt;margin:6pt 0 8pt}',
    '#previaWord .pw-folha h2{font-size:14pt;margin:12pt 0 5pt}',
    '#previaWord .pw-folha h3,#previaWord .pw-folha h4,#previaWord .pw-folha summary{font-size:12pt;margin:8pt 0 4pt}',
    '#previaWord .pw-folha p{margin:0 0 6pt}',
    '#previaWord .pw-folha table{width:100%;border-collapse:collapse;font-size:10pt}',
    '#previaWord .pw-folha th,#previaWord .pw-folha td{border:1px solid #9ca3af;padding:3px 5px;text-align:left;vertical-align:top}'
  ].join('');

  function podeCompartilharWord() {
    try {
      var teste = new File(['x'], 'x.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      return Boolean(navigator.canShare && navigator.canShare({ files: [teste] }) && /android|iphone|ipad|ipod/i.test(navigator.userAgent));
    } catch (e) { return false; }
  }

  function baixar(blob, nome) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return '✅ ' + nome + ' (vai para a pasta de downloads do aparelho).';
  }

  // Gera o arquivo e entrega: compartilha (celulares) ou baixa. Devolve a mensagem, ou '' se a pessoa desistiu de compartilhar.
  async function entregar(compartilhar) {
    var blob = await gerar();
    var nome = nomeDoArquivo();
    if (compartilhar) {
      try {
        await navigator.share({ files: [new File([blob], nome, { type: blob.type })] });
        return '✅ Arquivo enviado para o compartilhamento do aparelho.';
      } catch (e) {
        if (e && e.name === 'AbortError') return '';
      }
    }
    return baixar(blob, nome);
  }

  // A prévia em tela cheia: o mesmo conteúdo que vai para o Word. Só dela se exporta ou se compartilha o arquivo.
  function abrirPrevia(origem) {
    if (document.getElementById('previaWord')) return;
    var novo = function (tag, classe, texto) {
      var el = document.createElement(tag);
      if (classe) el.className = classe;
      if (texto) el.textContent = texto;
      return el;
    };
    if (!document.getElementById('previaWordEstilo')) {
      var estilo = novo('style', '', ESTILO_PREVIA);
      estilo.id = 'previaWordEstilo';
      document.head.appendChild(estilo);
    }
    var principal = document.querySelector('main') || document.body;
    var folha = novo('article', 'pw-folha');
    Array.prototype.forEach.call(principal.children, function (c) { folha.appendChild(c.cloneNode(true)); });
    folha.querySelectorAll('script, style, img, button, nav, [hidden], [data-nao-exportar]').forEach(function (el) { el.remove(); });
    folha.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
    folha.querySelectorAll('details').forEach(function (el) { el.open = true; });

    var tela = novo('div');
    tela.id = 'previaWord';
    tela.setAttribute('role', 'dialog');
    tela.setAttribute('aria-modal', 'true');
    tela.setAttribute('aria-label', 'Prévia do documento Word');
    tela.setAttribute('data-nao-exportar', '');
    var topo = novo('div', 'pw-topo');
    var botoes = novo('div', 'pw-botoes');
    var fechar = novo('button', '', '✕ Fechar');
    var exportar = novo('button', '', '📄 Exportar para Word');
    var compartilhar = novo('button', '', '📤 Compartilhar');
    [fechar, exportar, compartilhar].forEach(function (b) { b.type = 'button'; botoes.appendChild(b); });
    compartilhar.hidden = !podeCompartilharWord();
    var aviso = novo('div', 'pw-aviso', 'Prévia aproximada do documento Word.');
    aviso.setAttribute('role', 'status');
    topo.append(botoes, aviso);
    var corpo = novo('div', 'pw-corpo');
    corpo.appendChild(folha);
    tela.append(topo, corpo);

    var rolagem = document.body.style.overflow;
    function sair() {
      tela.remove();
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = rolagem;
      origem.focus({ preventScroll: true });
    }
    function tecla(e) { if (e.key === 'Escape') sair(); }
    async function finalizar(botao, comCompartilhar) {
      botao.disabled = true;
      aviso.textContent = 'Gerando o arquivo Word…';
      try {
        aviso.textContent = await entregar(comCompartilhar);
      } catch (e) {
        aviso.textContent = 'Não consegui gerar o arquivo: ' + (e && e.message ? e.message : 'erro desconhecido.');
      } finally {
        botao.disabled = false;
      }
    }
    fechar.addEventListener('click', sair);
    exportar.addEventListener('click', function () { finalizar(exportar, false); });
    compartilhar.addEventListener('click', function () { finalizar(compartilhar, true); });
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(tela);
    fechar.focus({ preventScroll: true });
  }

  function iniciar() {
    if (!admin()) return;
    var principal = document.querySelector('main') || document.body;
    var caixa = document.createElement('div');
    caixa.setAttribute('data-nao-exportar', '');
    caixa.style.cssText = 'margin:24px 0 8px;text-align:center';
    var botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = '📄 Exportar esta página (.docx)';
    botao.title = 'Só o administrador vê este botão';
    botao.style.cssText = 'padding:10px 16px;border:1px solid #94a3b8;border-radius:10px;background:#f1f5f9;color:#0f172a;font:inherit;font-weight:700;cursor:pointer';
    botao.addEventListener('click', function () { abrirPrevia(botao); });
    caixa.append(botao);
    principal.appendChild(caixa);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
