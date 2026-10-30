// Exporta o conteúdo completo de uma página fixa (Sobre, Privacidade, Termos de Uso) para um arquivo Word (.docx).
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
    var aviso = document.createElement('div');
    aviso.setAttribute('role', 'status');
    aviso.style.cssText = 'margin-top:8px;font-size:.85rem;opacity:.8';
    botao.addEventListener('click', async function () {
      botao.disabled = true;
      aviso.textContent = 'Gerando o arquivo Word…';
      try {
        var blob = await gerar();
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = nomeDoArquivo();
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        aviso.textContent = '✅ ' + link.download + ' (vai para a pasta de downloads do aparelho).';
      } catch (e) {
        aviso.textContent = 'Não consegui gerar o arquivo: ' + (e && e.message ? e.message : 'erro desconhecido.');
      } finally {
        botao.disabled = false;
      }
    });
    caixa.append(botao, aviso);
    principal.appendChild(caixa);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
