
    // ---------- Telas: Início, Formatar, Reuniões, Backup e Ajustes ----------
    // É um app só: a tela escolhida (guardada no endereço, ex.: #reunioes) mostra os blocos dela e esconde os outros.
    // Formatar e Reuniões dividem o mesmo campo de texto. O app sempre abre no Início; ao recarregar a página, o endereço
    // mantém a tela em que se estava.
    const APP_SCREENS = ['inicio', 'formatar', 'reunioes', 'backup', 'ajustes', 'leitura', 'transcricao']; // "leitura" (Leitura em voz alta) abre pelo atalho do Início e não tem botão na barra
    try { localStorage.removeItem('jwLibraryNoteAplicarScreenV1'); } catch (e) { /* a tela não é mais guardada */ }

    function currentScreen() {
      return document.body.dataset.screen || 'inicio';
    }

    // Marca na barra de baixo o botão da tela aberta. Pesquisas e respostas salvas é uma página da tela Reuniões: com ela aberta, marca o botão
    // Pesquisas e não o Reuniões.
    function navMarcar() {
      const tela = currentScreen();
      const historico = tela === 'reunioes' && reunioesVistaAtual() === 'historico';
      document.querySelectorAll('#appNav button').forEach(btn => {
        const atual = btn.dataset.atalho ? btn.dataset.atalho === 'historico' && historico : btn.dataset.screenTarget === tela && !historico;
        if (atual) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      });
    }

    function showScreen(name, options) {
      const screen = APP_SCREENS.includes(name) ? name : 'inicio';
      const changed = screen !== currentScreen();
      if (changed && currentScreen() === 'leitura') leituraAoSair(); // saindo da tela Leitura, a leitura em voz alta para
      document.body.dataset.screen = screen;
      navMarcar();
      if (location.hash !== '#' + screen) history.replaceState(null, '', '#' + screen);
      if (changed && !(options && options.keepScroll)) window.scrollTo(0, 0);
      // O texto pode ter mudado enquanto o campo estava escondido: mede de novo a altura quando a tela aparece.
      requestAnimationFrame(() => {
        try { autoGrowInputText(); } catch (e) { /* ainda iniciando */ }
        inicioAjustarAltura();
        reunioesAjustarHub();
        reunioesTituloAjustar();
        if (screen === 'leitura') leituraAoEntrar().catch(() => {}); // devolve o texto gravado da Leitura em voz alta
      });
    }

    // Altura mínima do Início: do topo dele até a barra de baixo (o que sobra embaixo é o espaço da barra e as margens).
    function inicioAjustarAltura() {
      const grade = document.querySelector('.inicio-grid');
      if (!grade || currentScreen() !== 'inicio') return;
      const estilo = el => getComputedStyle(el);
      const definir = () => {
        grade.style.minHeight = '0px';
        const embaixo = parseFloat(estilo(document.body).paddingBottom) + parseFloat(estilo(grade.parentElement).paddingBottom) + parseFloat(estilo(grade).marginBottom);
        const topo = grade.getBoundingClientRect().top + window.scrollY;
        grade.style.minHeight = Math.max(0, Math.floor(window.innerHeight - topo - embaixo)) + 'px';
      };
      grade.classList.remove('aperta', 'aperta2', 'aperta3');
      definir();
      // Texto do dia longo (celular, texto fechado) e a tela não comporta tudo: aperta primeiro o texto diário e, se não bastar, os atalhos também.
      const tdAberto = !document.getElementById('tdDetalhe').hidden;
      const rola = () => document.documentElement.scrollHeight > window.innerHeight + 1;
      if (!tdAberto && window.innerWidth <= 640 && rola()) {
        grade.classList.add('aperta');
        definir();
        if (rola()) {
          grade.classList.add('aperta2');
          definir();
          if (rola()) {
            grade.classList.add('aperta3');
            definir();
          }
        }
      }
    }
    window.addEventListener('resize', inicioAjustarAltura);

    // Em que tela fica um elemento (para o app abrir a tela certa quando precisa mostrar algo que está em outra).
    function screenOf(element) {
      const holder = element && element.closest('.screen-inicio, .screen-formatar, .screen-reunioes, .screen-backup, .screen-ajustes, .screen-leitura, .screen-transcricao');
      return holder ? APP_SCREENS.find(name => holder.classList.contains('screen-' + name)) || null : null;
    }

    document.querySelectorAll('#appNav [data-screen-target]').forEach(btn => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screenTarget));
    });
    // O endereço index.html#privacidade (atalho da página Sobre) abre Ajustes já com o card Privacidade e dados deste aparelho aberto.
    function abrirPrivacidadePeloEndereco() {
      if (location.hash.slice(1) !== 'privacidade') return false;
      showScreen('ajustes', { keepScroll: true });
      const caixa = document.getElementById('privacidadeBox');
      if (caixa) {
        caixa.open = true;
        requestAnimationFrame(() => caixa.scrollIntoView({ block: 'start' }));
      }
      return true;
    }
    window.addEventListener('hashchange', () => {
      if (abrirPrivacidadePeloEndereco()) return;
      const name = location.hash.slice(1);
      if (APP_SCREENS.includes(name)) showScreen(name, { keepScroll: true });
    });
    if (!abrirPrivacidadePeloEndereco()) showScreen(location.hash.slice(1), { keepScroll: true });

    // ---------- Backup do JW Library (leitura) ----------
    // O arquivo .jwlibrary é um ZIP com o manifest.json e o banco userData.db (SQLite). Tudo é lido neste aparelho, com
    // JSZip e sql.js, que só são baixados quando se abre um backup; nada é enviado ao servidor. A organização (categorias,
    // agrupamentos em árvore e nomes das publicações em jw-publicacoes.json) segue a do JWLManager (licença MIT).
    const BACKUP_LIBS = {
      jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
      sqljs: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
      wasm: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm'
    };
    const BACKUP_PAGE = 50;
    const BACKUP_AUTO_OPEN = 60; // com a busca, até este número de resultados a árvore já vem aberta
    const BACKUP_COLORS = ['#9ca3af', '#facc15', '#4ade80', '#60a5fa', '#f87171', '#fb923c', '#c084fc'];
    const BACKUP_COLOR_NAMES = ['Cinza', 'Amarelo', 'Verde', 'Azul', 'Vermelho', 'Laranja', 'Roxo'];
    const BACKUP_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const BIBLE_BOOKS = ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
      '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes',
      'Cântico de Salomão', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oseias', 'Joel', 'Amós', 'Obadias', 'Jonas',
      'Miqueias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias', 'Mateus', 'Marcos', 'Lucas', 'João', 'Atos',
      'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses',
      '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filêmon', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João',
      '3 João', 'Judas', 'Apocalipse'];

    // Categorias e agrupamentos (como no JWLManager). Cada agrupamento é uma lista de níveis da árvore.
    // A ordem desta lista é a ordem da lista Categoria da tela Backup (Respostas em primeiro, Notas em segundo).
    const BACKUP_CATEGORIES = [
      { id: 'respostas', label: '✍️ Respostas (quadros)', groupings: ['tipo', 'titulo', 'ano'], text: true },
      { id: 'notas', label: '📝 Notas', groupings: ['tipo', 'titulo', 'idioma', 'ano', 'etiqueta', 'cor', 'duplicadas'], text: true },
      { id: 'grifos', label: '🖍️ Grifos', groupings: ['tipo', 'titulo', 'idioma', 'ano', 'cor'], text: false },
      { id: 'favoritos', label: '⭐ Favoritos', groupings: ['tipo', 'titulo', 'idioma', 'ano'], text: false },
      { id: 'marcadores', label: '🔖 Marcadores', groupings: ['tipo', 'titulo', 'idioma', 'ano'], text: true },
      { id: 'listas', label: '▶️ Listas de reprodução', groupings: ['titulo'], text: true }
    ];
    const BACKUP_GROUPINGS = {
      tipo: { label: 'Tipo', levels: ['type', 'title', 'detail1', 'detail2'] },
      titulo: { label: 'Título', levels: ['title', 'detail1', 'detail2'] },
      idioma: { label: 'Idioma', levels: ['lang', 'title', 'detail1', 'detail2'] },
      ano: { label: 'Ano', levels: ['year', 'title', 'detail1'] },
      etiqueta: { label: 'Etiqueta', levels: ['tags', 'title', 'detail1'] },
      cor: { label: 'Cor', levels: ['color', 'title', 'detail1'] },
      duplicadas: { label: 'Duplicadas', levels: ['title', 'detail1', 'detail2'] }
    };
    // Símbolos com o ano no fim ("yb17") viram publicação + ano, menos estes, em que os números fazem parte do símbolo.
    const BACKUP_CODE_KEEP = new Set(['bi', 'br', 'brg', 'kn', 'ks', 'pt', 'tp']);

    let backupLibsPromise = null;
    let backupPubsPromise = null;
    let backupPubs = null;  // { tipos, publicacoes, idiomas } de jw-publicacoes.json (null = mostra os símbolos)
    let backupState = null; // { zip, db, manifest, fileName, data: { notas: [...], grifos: [...], ... } }
    let backupCategory = 'respostas'; // todo backup aberto começa na categoria Respostas (a lista Categoria troca para as outras)
    const backupGroupingByCategory = {};

    // ---------- Backup: parágrafo de cada "Sua resposta" ----------
    // O backup só guarda o id da caixa (ex.: "tt60") e o número do documento. Para dizer a que parágrafo e pergunta cada resposta se
    // refere, o servidor lê o documento no wol.jw.org (só os números dos documentos saem do aparelho, nunca o conteúdo do backup) e
    // devolve { titulo, simbolo, edicao, campos: [{ tag, numero, pergunta }] }. O resultado fica guardado neste aparelho.
    const BACKUP_CAMPOS_KEY = 'jwLibraryNoteAplicarCamposV1';
    let backupCampos = {}; // docId -> { titulo, simbolo, edicao, campos, quando }
    try { backupCampos = JSON.parse(localStorage.getItem(BACKUP_CAMPOS_KEY) || '{}') || {}; } catch (e) { backupCampos = {}; }
    const backupCamposFalhas = new Set(); // documentos que o servidor não conseguiu ler nesta visita (não insiste)
    let backupCamposOcupado = false;

    function backupCamposGuardar() {
      const novos = {};
      Object.keys(backupCampos).sort((a, b) => (backupCampos[b].quando || 0) - (backupCampos[a].quando || 0)).slice(0, 150).forEach(id => { novos[id] = backupCampos[id]; });
      backupCampos = novos;
      safeSetItem(BACKUP_CAMPOS_KEY, JSON.stringify(backupCampos));
    }

    // Consulta o servidor para os documentos que ainda não estão guardados (de 10 em 10). Devolve '' se deu certo ou a mensagem do problema.
    async function backupCarregarCampos(docIds) {
      // Os guardados antes da versão 2 não têm o título do quadro de recapitulação: são lidos de novo.
      const faltam = [...new Set(docIds.map(String))].filter(id => !backupCampos[id] || backupCampos[id].v !== 2);
      for (let i = 0; i < faltam.length; i += 10) {
        const acesso = studyAccessError();
        if (acesso) return acesso;
        let result;
        try {
          result = await postStudy({ tarefa: 'backup-campos', codigo: codigoAcessoSalvo(), documentos: faltam.slice(i, i + 10) }, 45000);
        } catch (e) {
          return e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao consultar o wol.jw.org.';
        }
        if (!result.ok) return studyFailureMessage(result, 'Não consegui consultar o wol.jw.org agora.');
        Object.entries(result.data.documentos || {}).forEach(([id, d]) => {
          backupCampos[id] = { v: 2, titulo: d.titulo || '', simbolo: d.simbolo || null, edicao: d.edicao === undefined ? null : d.edicao, campos: d.campos || [], quando: Date.now() };
        });
        (result.data.falhas || []).forEach(id => backupCamposFalhas.add(String(id)));
        backupCamposGuardar();
      }
      return '';
    }

    // Toda resposta pertence a um artigo: enquanto o título dele não é conhecido (o backup nem sempre o traz e o wol.jw.org ainda
    // não foi consultado), a árvore mostra "Artigo (documento N)" no nível do artigo, que depois troca pelo título.
    function backupArtigoProvisorio(item) {
      if (!item.documentId) return;
      const nivel = item.hasIssue ? 'detail2' : 'detail1';
      if (item[nivel]) return;
      item[nivel] = backupLevel('Artigo (documento ' + item.documentId + ')', item.documentId);
      item.artigoProvisorio = true;
    }

    // Põe no item o parágrafo (número da pergunta), a pergunta e o título do documento, quando já se sabe.
    function backupAplicarCampo(item) {
      const info = backupCampos[item.documentId];
      if (!info) return;
      const campo = (info.campos || []).find(c => c.tag === item.textTag);
      item.heading = 'Sua resposta' + (campo && campo.numero ? ' · parágrafo ' + campo.numero : campo && campo.quadro ? ' · quadro de recapitulação' : '');
      if (campo && campo.pergunta) item.where = campo.pergunta;
      if (info.titulo) {
        const nivel = item.hasIssue ? 'detail2' : 'detail1';
        if (!item[nivel] || item.artigoProvisorio) {
          item[nivel] = backupLevel(info.titulo, item.documentId || 0);
          item.artigoProvisorio = false;
        }
      }
    }

    // Na categoria Respostas: identifica os parágrafos dos documentos que ainda não foram consultados e redesenha a lista a cada lote.
    async function backupIdentificarRespostas() {
      const info = document.getElementById('backupRespostasInfo');
      if (!backupState || backupCategory !== 'respostas' || backupCamposOcupado) return;
      const docs = [...new Set(backupState.data.respostas.map(r => r.documentId).filter(Boolean).map(String))];
      const faltam = docs.filter(id => (!backupCampos[id] || backupCampos[id].v !== 2) && !backupCamposFalhas.has(id));
      if (!faltam.length) { info.hidden = true; return; }
      const acesso = studyAccessError();
      info.hidden = false;
      if (acesso) {
        info.textContent = '🔎 Para mostrar o parágrafo de cada resposta o app consulta o wol.jw.org (só o número dos documentos é enviado). ' + acesso;
        return;
      }
      const estado = backupState;
      backupCamposOcupado = true;
      let problema = '';
      try {
        for (let i = 0; i < faltam.length && !problema; i += 10) {
          info.textContent = '🔎 Identificando os parágrafos das respostas… (' + Math.min(i + 10, faltam.length) + ' de ' + faltam.length + ' documentos)';
          problema = await backupCarregarCampos(faltam.slice(i, i + 10));
          if (backupState !== estado || backupCategory !== 'respostas') return;
          estado.data.respostas.forEach(backupAplicarCampo);
          renderBackupTree(true);
        }
      } finally {
        backupCamposOcupado = false;
      }
      if (problema) info.textContent = '🔎 Não consegui identificar os parágrafos: ' + problema;
      else info.hidden = true;
    }

    function loadScriptOnce(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src="' + src + '"]');
        if (existing) return existing.dataset.loaded ? resolve() : existing.addEventListener('load', () => resolve());
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => { script.dataset.loaded = '1'; resolve(); };
        script.onerror = () => { script.remove(); reject(new Error('sem conexão para carregar o leitor de backup.')); };
        document.head.appendChild(script);
      });
    }

    function loadBackupLibs() {
      if (!backupLibsPromise) {
        backupLibsPromise = Promise.all([loadScriptOnce(BACKUP_LIBS.jszip), loadScriptOnce(BACKUP_LIBS.sqljs)])
          .then(() => window.initSqlJs({ locateFile: () => BACKUP_LIBS.wasm }))
          .then(SQL => ({ JSZip: window.JSZip, SQL }))
          .catch(e => { backupLibsPromise = null; throw e; });
      }
      return backupLibsPromise;
    }

    // Nomes das publicações; sem eles o app continua e mostra os símbolos (ex.: "pt14").
    function loadBackupPubs() {
      if (!backupPubsPromise) {
        backupPubsPromise = fetch('jw-publicacoes.json')
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
          .then(data => { backupPubs = data; if (!data) backupPubsPromise = null; return data; });
      }
      return backupPubsPromise;
    }

    function setBackupStatus(message, isWarning) {
      const el = document.getElementById('backupStatus');
      el.className = isWarning ? 'warn' : 'ok';
      el.textContent = message;
    }

    // Linhas de uma consulta como objetos { coluna: valor }.
    function backupRows(db, sql) {
      const result = db.exec(sql);
      if (!result.length) return [];
      const { columns, values } = result[0];
      return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    }

    // 20260800 -> "agosto de 2026"; 20230115 -> "15/01/2023".
    function backupIssueLabel(issue) {
      const text = String(issue || '');
      if (!/^\d{8}$/.test(text) || text === '00000000') return '';
      const year = text.slice(0, 4), month = Number(text.slice(4, 6)), day = Number(text.slice(6, 8));
      if (!month || month > 12) return year;
      return day ? String(day).padStart(2, '0') + '/' + text.slice(4, 6) + '/' + year : BACKUP_MONTHS[month - 1] + ' de ' + year;
    }

    function backupDate(text) {
      const m = String(text || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
    }

    function backupPlain(text) {
      return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    // Um valor de nível da árvore: o texto que aparece, a chave para ordenar e se a ordem é do maior para o menor
    // (anos e edições: o mais novo primeiro).
    function backupLevel(label, key, newestFirst) {
      return { label: String(label), key: key === undefined ? null : key, desc: Boolean(newestFirst) };
    }

    function backupProcessCode(code, issue) {
      if (code === 'ws' && !issue) code = 'ws-'; // livro "Segurança mundial" tem o mesmo símbolo da Sentinela fácil de ler
      if (!code) return { code: '', year: '' };
      if (/^jwb-\d+$/.test(code)) return { code: 'jwb-', year: '' };
      const m = code.match(/^(.*?[^\d-])(\d{2})$/);
      if (m && !BACKUP_CODE_KEEP.has(m[1])) return { code: m[1], year: (Number(m[2]) >= 50 ? '19' : '20') + m[2] };
      return { code, year: '' };
    }

    // Tipo, título, idioma, ano e detalhes (edição, livro da Bíblia, capítulo, artigo) de um item ligado a um local.
    function backupDescribe(r, titleByDoc) {
      if (r.LocationId === null || r.LocationId === undefined) {
        const year = String(r.LastModified || '').slice(0, 4);
        return {
          type: backupLevel('Notas avulsas'), title: backupLevel('Notas avulsas'), lang: backupLevel('Sem idioma'),
          year: backupLevel(year || 'Sem ano', Number(year) || 0, true), detail1: null, detail2: null, where: ''
        };
      }
      const { code, year: codeYear } = backupProcessCode(r.KeySymbol, r.IssueTagNumber);
      const pub = backupPubs && backupPubs.publicacoes ? backupPubs.publicacoes[code] : null;
      const typeName = pub ? (backupPubs.tipos[String(pub[3])] || 'Outros') : (r.BookNumber ? 'Bíblias' : 'Outros');
      const titleName = pub ? pub[0] : (code || 'Outros');
      const issue = String(r.IssueTagNumber || '');
      const hasIssue = /^\d{8}$/.test(issue) && Number(issue) > 19000000;
      const year = codeYear || (hasIssue ? issue.slice(0, 4) : '') || (pub && pub[2] ? String(pub[2]) : '');
      const langName = r.MepsLanguage === null || r.MepsLanguage === undefined
        ? 'Sem idioma'
        : (backupPubs && backupPubs.idiomas && backupPubs.idiomas[String(r.MepsLanguage)]) || 'Idioma ' + r.MepsLanguage;
      const docTitle = r.LocTitle || (titleByDoc && titleByDoc.get(r.KeySymbol + '|' + r.IssueTagNumber + '|' + r.DocumentId)) || '';
      let detail1 = null;
      let detail2 = null;
      let where = docTitle;
      if (r.BookNumber) {
        const book = BIBLE_BOOKS[r.BookNumber - 1] || 'Livro ' + r.BookNumber;
        detail1 = backupLevel(book, r.BookNumber);
        if (r.ChapterNumber) detail2 = backupLevel('Capítulo ' + r.ChapterNumber, r.ChapterNumber);
        where = book + (r.ChapterNumber ? ' ' + r.ChapterNumber + (r.BlockType === 2 && r.BlockIdentifier ? ':' + r.BlockIdentifier : '') : '');
      } else if (hasIssue) {
        detail1 = backupLevel(backupIssueLabel(issue), Number(issue), true);
        if (docTitle) detail2 = backupLevel(docTitle, r.DocumentId || 0);
      } else if (docTitle) {
        detail1 = backupLevel(docTitle, r.DocumentId || 0);
      }
      return {
        type: backupLevel(typeName), title: backupLevel(titleName), lang: backupLevel(langName),
        year: backupLevel(year || 'Sem ano', Number(year) || 0, true), detail1, detail2, where, documentId: r.DocumentId, hasIssue
      };
    }

    // Notas repetidas no mesmo lugar: mesmo título, mesmo texto, ou vazias (como no JWLManager).
    function backupDuplicateIds(rows) {
      const groups = new Map();
      const add = (key, id) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(id); };
      rows.forEach(r => {
        if (r.LocationId === null || r.LocationId === undefined) return;
        const place = r.LocationId + '|' + r.BlockIdentifier + '|' + r.BlockType;
        if (r.Title) add('t|' + place + '|' + r.Title, r.NoteId);
        if (r.Content) add('c|' + place + '|' + r.Content, r.NoteId);
        if (!r.Title && !r.Content) add('v|' + place, r.NoteId);
      });
      const ids = new Set();
      groups.forEach(list => { if (list.length > 1) list.forEach(id => ids.add(id)); });
      return ids;
    }

    function readBackupData(db) {
      const titleByDoc = new Map(backupRows(db, "SELECT KeySymbol, IssueTagNumber, DocumentId, Title FROM Location WHERE Title IS NOT NULL AND Title != '' AND DocumentId IS NOT NULL")
        .map(r => [r.KeySymbol + '|' + r.IssueTagNumber + '|' + r.DocumentId, r.Title]));
      const loc = 'l.KeySymbol, l.MepsLanguage, l.IssueTagNumber, l.DocumentId, l.BookNumber, l.ChapterNumber, l.Title AS LocTitle';

      const noteRows = backupRows(db, `
        SELECT n.NoteId, n.UserMarkId, n.Title, n.Content, n.LastModified, n.BlockType, n.BlockIdentifier, n.LocationId, ${loc}, u.ColorIndex,
               (SELECT group_concat(Name, ' | ') FROM (SELECT t.Name FROM TagMap tm JOIN Tag t ON t.TagId = tm.TagId
                 WHERE tm.NoteId = n.NoteId ORDER BY t.Name)) AS Tags
        FROM Note n LEFT JOIN Location l ON l.LocationId = n.LocationId LEFT JOIN UserMark u ON u.UserMarkId = n.UserMarkId
        ORDER BY n.LastModified DESC, n.NoteId DESC`);
      const duplicates = backupDuplicateIds(noteRows);
      const notas = noteRows.map(r => {
        const color = r.ColorIndex || 0;
        return {
          id: r.NoteId, locationId: r.LocationId, userMarkId: r.UserMarkId, heading: r.Title || '', text: r.Content || '', date: backupDate(r.LastModified), colorIndex: color,
          tagsText: r.Tags || '', duplicate: duplicates.has(r.NoteId), ...backupDescribe(r, titleByDoc),
          color: backupLevel(BACKUP_COLOR_NAMES[color] || 'Cinza', color), tags: backupLevel(r.Tags || 'Sem etiqueta')
        };
      });

      const grifos = backupRows(db, `
        SELECT b.BlockRangeId, u.ColorIndex, u.LocationId, ${loc}
        FROM UserMark u JOIN Location l ON l.LocationId = u.LocationId JOIN BlockRange b ON b.UserMarkId = u.UserMarkId`).map(r => {
          const color = r.ColorIndex || 0;
          return { id: r.BlockRangeId, colorIndex: color, ...backupDescribe(r, titleByDoc), color: backupLevel(BACKUP_COLOR_NAMES[color] || 'Cinza', color) };
        });

      const favoritos = backupRows(db, `
        SELECT tm.TagMapId, tm.LocationId, ${loc}
        FROM TagMap tm JOIN Location l ON l.LocationId = tm.LocationId
        WHERE tm.NoteId IS NULL AND tm.PlaylistItemId IS NULL ORDER BY tm.Position`).map(r => ({ id: r.TagMapId, ...backupDescribe(r, titleByDoc) }));

      const marcadores = backupRows(db, `
        SELECT b.BookmarkId, b.Title AS BTitle, b.Snippet, b.LocationId, ${loc}
        FROM Bookmark b JOIN Location l ON l.LocationId = b.LocationId ORDER BY b.Slot`).map(r => ({
          id: r.BookmarkId, heading: r.BTitle || '', text: r.Snippet || '', ...backupDescribe(r, titleByDoc)
        }));

      const respostas = backupRows(db, `
        SELECT i.TextTag, i.Value, i.LocationId, ${loc}
        FROM InputField i JOIN Location l ON l.LocationId = i.LocationId
        ORDER BY l.IssueTagNumber DESC, l.DocumentId DESC, CAST(substr(i.TextTag, 3) AS INTEGER)`).map(r => ({
          id: r.LocationId + '|' + r.TextTag, locationId: r.LocationId, textTag: r.TextTag, heading: 'Sua resposta', text: r.Value || '', ...backupDescribe(r, titleByDoc)
        }));
      respostas.forEach(backupArtigoProvisorio);
      respostas.forEach(backupAplicarCampo);

      const listas = backupRows(db, `
        SELECT p.PlaylistItemId, p.Label, t.Name AS Playlist
        FROM PlaylistItem p JOIN TagMap tm ON tm.PlaylistItemId = p.PlaylistItemId JOIN Tag t ON t.TagId = tm.TagId
        WHERE t.Type = 2 ORDER BY t.Name, tm.Position`).map(r => ({
          id: r.PlaylistItemId, heading: r.Label || '(sem nome)', text: '', type: backupLevel('Listas'),
          title: backupLevel(r.Playlist || 'Lista'), detail1: null, detail2: null, where: ''
        }));

      return { notas, grifos, favoritos, marcadores, respostas, listas };
    }

    // Abre o ZIP do backup e o banco de dados dele. Devolve { zip, manifest, db } ou lança um erro com o motivo.
    async function backupReadArchive(file) {
      const [{ JSZip, SQL }] = await Promise.all([loadBackupLibs(), loadBackupPubs()]);
      let zip;
      try {
        zip = await JSZip.loadAsync(await file.arrayBuffer());
      } catch (e) {
        throw new Error('o arquivo não é um backup .jwlibrary.');
      }
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) throw new Error('não é um backup do JW Library (falta o manifest.json).');
      const manifest = JSON.parse(await manifestFile.async('string'));
      const info = manifest && manifest.userDataBackup;
      if (!info) throw new Error('não é um backup do JW Library.');
      const dbFile = zip.file(info.databaseName || 'userData.db');
      if (!dbFile) throw new Error('o banco de dados não está dentro do arquivo.');
      return { zip, manifest, db: new SQL.Database(await dbFile.async('uint8array')) };
    }

    async function openBackupFile(file) {
      if (!file) return;
      setBackupStatus('Abrindo ' + file.name + '…', false);
      try {
        const { zip, manifest, db } = await backupReadArchive(file);
        const data = readBackupData(db);
        backupCloseImport();
        if (backupState && backupState.db) backupState.db.close();
        backupState = { zip, db, manifest, fileName: file.name, data, changes: 0, generated: null };
        backupCategory = 'respostas';
        document.getElementById('backupNewNoteSlot').textContent = '';
        renderBackupView();
        setBackupStatus('', false);
      } catch (e) {
        setBackupStatus('Não consegui abrir o backup: ' + (e && e.message ? e.message : 'arquivo inválido.'), true);
      }
    }

    function backupCategoryInfo() {
      return BACKUP_CATEGORIES.find(c => c.id === backupCategory) || BACKUP_CATEGORIES.find(c => c.id === 'notas');
    }

    // Os botões do começo ("Abrir e editar backup" e "Mesclar backups") só aparecem sem nada em andamento. Com um backup aberto (ou uma mesclagem sendo montada) some
    // o que já não vale, e o botão de abrir vira "Abrir outro backup para mesclar", que inclui outro backup na mesclagem. Para ver os botões do começo de novo, é só
    // fechar o backup ou cancelar a mesclagem.
    function backupAtualizarBotoes() {
      const abrir = document.getElementById('backupOpenBtn');
      const mesclar = document.getElementById('backupMergeBtn');
      const emMesclagem = !document.getElementById('backupMesclarBox').hidden;
      abrir.textContent = backupState ? '📂 Abrir outro backup para mesclar' : '📂 Abrir e editar backup (.jwlibrary)';
      abrir.hidden = emMesclagem; // com a mesclagem aberta, os botões do começo saem (cancelar traz de volta)
      mesclar.hidden = Boolean(backupState) || emMesclagem;
      // Criar um backup vazio é uma escolha do começo: some com um backup aberto ou uma mesclagem em andamento.
      document.getElementById('backupNewBtn').hidden = Boolean(backupState) || emMesclagem;
    }

    // A explicação da tela Backup abre quando não há backup aberto e recolhe sozinha quando um backup é aberto (só nessa troca: se a pessoa a abrir ou
    // fechar à mão, a escolha dela vale até o backup abrir ou fechar de novo).
    let backupAjudaComBackup = false;

    function renderBackupView(keepOpen) {
      const ajuda = document.getElementById('backupAjuda');
      if (ajuda && backupAjudaComBackup !== Boolean(backupState)) {
        backupAjudaComBackup = Boolean(backupState);
        ajuda.open = !backupAjudaComBackup;
      }
      const view = document.getElementById('backupView');
      const resultado = document.getElementById('backupMesclarResultado');
      if (resultado && !(backupState && backupState.mesclado)) resultado.hidden = true;
      if (!(backupState && backupState.mesclado) && document.getElementById('backupMesclarBox').hidden) backupMesclarLimparSessao();
      document.getElementById('backupCloseBtn').hidden = !backupState;
      backupAtualizarBotoes();
      if (!backupState) { view.hidden = true; renderBackupSaveBox(); return; }
      view.hidden = false;
      document.getElementById('backupSoNovosBox').hidden = !(backupState.mesclado && backupState.novos);
      view.classList.toggle('mesclado', Boolean(backupState.mesclado));
      document.getElementById('backupConteudoTitulo').textContent = backupState.mesclado ? '🔀 Conteúdo do backup mesclado' : backupState.isNew ? '🆕 Conteúdo do backup novo' : '📂 Conteúdo do backup aberto';
      document.getElementById('backupConteudoDica').textContent = backupState.mesclado
        ? 'Este é o resultado da mesclagem: a base mais o que veio dos outros arquivos. Confira, edite ou apague o que quiser e gere o arquivo mesclado.'
        : 'Aqui você vê o que há no backup, procura, edita e apaga notas e respostas antes de gerar o arquivo.';
      const info = backupState.manifest.userDataBackup || {};
      document.getElementById('backupSummary').textContent = [
        backupState.isNew ? '🆕 Backup novo' : backupState.mesclado ? '🔀 Backup mesclado (' + backupState.mesclado + ' arquivos)' : backupState.fileName,
        backupState.mesclado ? backupState.baseNome && 'base: ' + backupState.baseNome : backupDate(info.lastModifiedDate) && 'feito em ' + backupDate(info.lastModifiedDate),
        !backupState.mesclado && info.deviceName && 'aparelho ' + info.deviceName
      ].filter(Boolean).join(' · ');

      const categorySelect = document.getElementById('backupCategory');
      categorySelect.textContent = '';
      BACKUP_CATEGORIES.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.label + ' (' + backupState.data[c.id].length.toLocaleString('pt-BR') + ')';
        categorySelect.appendChild(option);
      });
      categorySelect.value = backupCategory;
      renderBackupGroupingOptions();
      renderBackupTree(keepOpen);
      renderBackupSaveBox();
      backupIdentificarRespostas();
    }

    function renderBackupGroupingOptions() {
      const category = backupCategoryInfo();
      const select = document.getElementById('backupGrouping');
      select.textContent = '';
      category.groupings.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = BACKUP_GROUPINGS[id].label;
        select.appendChild(option);
      });
      select.value = backupGroupingByCategory[category.id] || category.groupings[0];
      select.disabled = category.groupings.length < 2;
      document.getElementById('backupSearch').hidden = !category.text;
      document.getElementById('backupNewNoteBtn').hidden = category.id !== 'notas';
      if (category.id !== 'notas') document.getElementById('backupNewNoteSlot').textContent = '';
      document.getElementById('backupNewAnswerBtn').hidden = category.id !== 'respostas';
      if (category.id !== 'respostas') {
        document.getElementById('backupNewAnswerSlot').textContent = '';
        document.getElementById('backupRespostasInfo').hidden = true;
      }
    }

    function backupFilteredItems() {
      const category = backupCategoryInfo();
      let items = backupState.data[category.id];
      if (document.getElementById('backupGrouping').value === 'duplicadas') items = items.filter(i => i.duplicate);
      if (backupState.novos && document.getElementById('backupSoNovos').checked) items = items.filter(i => backupState.novos[category.id] && backupState.novos[category.id].has(i.id));
      const search = category.text ? backupPlain(document.getElementById('backupSearch').value.trim()) : '';
      if (search) {
        items = items.filter(i => backupPlain([i.heading, i.text, i.tagsText, i.where, i.title && i.title.label].join(' ')).includes(search));
      }
      return { items, search };
    }

    function backupBuildTree(items, levels, ehNovo) {
      const root = { children: new Map(), items: [], count: 0, novos: 0 };
      items.forEach(item => {
        let node = root;
        const novo = Boolean(ehNovo && ehNovo(item));
        root.count++;
        if (novo) root.novos++;
        for (const level of levels) {
          const value = item[level];
          if (!value) break;
          let child = node.children.get(value.label);
          if (!child) {
            child = { label: value.label, key: value.key, desc: value.desc, level, children: new Map(), items: [], count: 0, novos: 0 };
            node.children.set(value.label, child);
          }
          child.count++;
          if (novo) child.novos++;
          node = child;
        }
        node.items.push(item);
      });
      return root;
    }

    // Anos e edições do mais novo para o mais antigo; livros da Bíblia, capítulos e artigos em ordem; o resto pela
    // quantidade (como no JWLManager).
    function backupSortedChildren(node) {
      const list = [...node.children.values()];
      if (!list.length) return list;
      const level = list[0].level;
      const numeric = list.every(c => typeof c.key === 'number');
      if (numeric && list.some(c => c.desc)) return list.sort((a, b) => (b.key || 0) - (a.key || 0));
      if (numeric && level !== 'type' && level !== 'title' && level !== 'lang' && level !== 'tags') return list.sort((a, b) => a.key - b.key);
      return list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
    }

    function renderBackupTree(keepOpen) {
      const category = backupCategoryInfo();
      const grouping = document.getElementById('backupGrouping').value;
      backupGroupingByCategory[category.id] = grouping;
      const { items, search } = backupFilteredItems();
      const total = backupState.data[category.id].length;
      const novosDaCategoria = backupState.novos && backupState.novos[category.id];
      const tree = backupBuildTree(items, BACKUP_GROUPINGS[grouping].levels, novosDaCategoria ? i => novosDaCategoria.has(i.id) : null);
      const holder = document.getElementById('backupTree');
      const openPaths = keepOpen ? [...holder.querySelectorAll('details.bk-node[open]')].map(d => d.dataset.path) : [];
      holder.textContent = '';
      const autoOpen = Boolean(search) && items.length <= BACKUP_AUTO_OPEN;
      backupRenderChildren(tree, holder, category, autoOpen, '');
      if (tree.items.length) backupRenderItems(tree.items, holder, category);
      // Reabre os ramos que estavam abertos, do mais externo para o mais interno (os internos só existem depois).
      openPaths.sort((a, b) => a.split(BACKUP_PATH_SEP).length - b.split(BACKUP_PATH_SEP).length).forEach(path => {
        const node = [...holder.querySelectorAll('details.bk-node')].find(d => d.dataset.path === path);
        if (node && !node.open) { node.open = true; node._build(); }
      });
      document.getElementById('backupCount').textContent = !items.length
        ? (search ? 'Nada encontrado.' : backupState.novos && document.getElementById('backupSoNovos').checked ? 'Nada novo nesta categoria.' : 'Nenhum item nesta categoria.')
        : (search || grouping === 'duplicadas' || (backupState.novos && document.getElementById('backupSoNovos').checked) ? items.length.toLocaleString('pt-BR') + ' de ' : '') + total.toLocaleString('pt-BR') +
          (total === 1 ? ' item.' : ' itens.');
    }

    // Os ramos só são montados quando abertos (há backups com dezenas de milhares de grifos).
    function backupRenderChildren(node, holder, category, autoOpen, parentPath) {
      backupSortedChildren(node).forEach(child => {
        const path = (parentPath ? parentPath + BACKUP_PATH_SEP : '') + child.label;
        const isLeaf = !child.children.size;
        if (isLeaf && !category.text) {
          const row = document.createElement('div');
          row.className = 'bk-leaf';
          const name = document.createElement('span');
          name.textContent = child.label;
          if (child.novos) name.classList.add('bk-tem-novos');
          const count = document.createElement('span');
          count.className = 'bk-count';
          count.textContent = (child.novos ? '🆕 ' + child.novos.toLocaleString('pt-BR') + ' · ' : '') + child.count.toLocaleString('pt-BR');
          row.append(name, count);
          holder.appendChild(row);
          return;
        }
        const details = document.createElement('details');
        details.className = 'bk-node';
        details.dataset.path = path;
        const summary = document.createElement('summary');
        const name = document.createElement('span');
        name.className = 'bk-name';
        name.textContent = child.label;
        if (child.novos) name.classList.add('bk-tem-novos'); // o título tem itens que vieram da mesclagem
        const count = document.createElement('span');
        count.className = 'bk-count';
        count.textContent = (child.novos ? '🆕 ' + child.novos.toLocaleString('pt-BR') + ' · ' : '') + child.count.toLocaleString('pt-BR');
        summary.append(name, count);
        const body = document.createElement('div');
        body.className = 'bk-children';
        details.append(summary, body);
        let built = false;
        const build = () => {
          if (built) return;
          built = true;
          backupRenderChildren(child, body, category, autoOpen, path);
          if (child.items.length && category.text) backupRenderItems(child.items, body, category);
        };
        details._build = build;
        details.addEventListener('toggle', () => { if (details.open) build(); });
        if (autoOpen) { details.open = true; build(); }
        holder.appendChild(details);
      });
    }

    function backupRenderItems(items, holder, category) {
      const list = document.createElement('div');
      list.className = 'backup-list';
      holder.appendChild(list);
      let shown = 0;
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'secondary bk-more';
      const showMore = () => {
        items.slice(shown, shown + BACKUP_PAGE).forEach(item => list.appendChild(backupItemCard(item, category)));
        shown = Math.min(items.length, shown + BACKUP_PAGE);
        more.hidden = shown >= items.length;
        more.textContent = 'Mostrar mais (' + (items.length - shown) + ')';
      };
      more.addEventListener('click', showMore);
      holder.appendChild(more);
      showMore();
    }

    function backupItemCard(item, category) {
      const card = document.createElement('article');
      card.className = 'backup-item';
      const ehNovo = Boolean(backupState && backupState.novos && backupState.novos[category.id] && backupState.novos[category.id].has(item.id));
      if (ehNovo) card.classList.add('backup-novo');
      const head = document.createElement('div');
      head.className = 'backup-item-head';
      if (category.id === 'notas') {
        const dot = document.createElement('span');
        dot.className = 'backup-dot';
        dot.style.setProperty('--cor', BACKUP_COLORS[item.colorIndex] || BACKUP_COLORS[0]);
        head.appendChild(dot);
      }
      const title = document.createElement('span');
      if (item.heading) title.textContent = item.heading;
      else { title.textContent = '(sem título)'; title.className = 'sem-titulo'; }
      head.appendChild(title);
      if (ehNovo) {
        const selo = document.createElement('span');
        selo.className = 'backup-novo-selo';
        selo.textContent = '🆕 novo';
        head.appendChild(selo);
      }
      card.appendChild(head);
      const meta = [item.where, item.date, item.tagsText && '🏷️ ' + item.tagsText].filter(Boolean).join(' · ');
      if (meta) {
        const metaEl = document.createElement('div');
        metaEl.className = 'backup-item-meta';
        metaEl.textContent = meta;
        card.appendChild(metaEl);
      }
      if (item.text) {
        const body = document.createElement('div');
        body.className = 'backup-item-body';
        body.textContent = item.text;
        card.appendChild(body);
      }
      const editable = category.id === 'notas' || category.id === 'respostas';
      if (editable) {
        const actions = document.createElement('div');
        actions.className = 'bk-row bk-actions';
        actions.append(
          backupButton('✏️ Editar', () => {
            if (card.querySelector('.bk-editor')) return;
            card.classList.add('aberto', 'editando');
            backupEditor(card, item, category.id, () => {
              const form = card.querySelector('.bk-editor');
              if (form) form.remove();
              card.classList.remove('editando');
            });
          }),
          backupButton('🗑️ Apagar', () => backupDeleteItem(item, category.id), 'secondary bk-danger')
        );
        card.appendChild(actions);
      }
      if (item.text || editable) card.addEventListener('click', () => { if (!card.classList.contains('editando')) card.classList.toggle('aberto'); });
      return card;
    }

    document.getElementById('backupOpenBtn').addEventListener('click', () => {
      if (backupState) return backupMesclarAPartirDoAberto(); // com um backup aberto, "Abrir outro backup" o inclui numa mesclagem
      document.getElementById('backupFile').click();
    });
    document.getElementById('backupFile').addEventListener('change', event => {
      openBackupFile(event.target.files && event.target.files[0]);
      event.target.value = ''; // permite abrir o mesmo arquivo de novo
    });
    document.getElementById('backupCategory').addEventListener('change', event => {
      backupCategory = event.target.value;
      document.getElementById('backupSearch').value = '';
      renderBackupGroupingOptions();
      renderBackupTree();
      if (backupCategory === 'respostas') {
        backupCamposFalhas.clear(); // trocar de categoria é uma nova tentativa
        backupIdentificarRespostas();
      }
    });
    document.getElementById('backupGrouping').addEventListener('change', () => renderBackupTree());
    document.getElementById('backupSearch').addEventListener('input', () => renderBackupTree());
    document.getElementById('backupSoNovos').addEventListener('change', () => renderBackupTree());

    // ---------- Backup do JW Library: edição (Fase 2) ----------
    // As alterações vão direto para o banco aberto na memória (sql.js). "Gerar backup modificado" monta um arquivo NOVO:
    // banco atualizado, data e "impressão digital" (SHA-256) refeitas no manifest.json e todos os outros arquivos do
    // backup (fotos, mídias) copiados como estavam. O arquivo original nunca é alterado.
    const BACKUP_PATH_SEP = '␟';

    function backupNow() {
      return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    }

    function backupUuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }

    function backupLastId(db) {
      return db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    }

    function backupMarkChanged(quantas) {
      backupState.changes = (backupState.changes || 0) + (quantas || 1);
      backupState.generated = null;
      renderBackupSaveBox();
    }

    // Lê de novo o banco e redesenha a árvore com os mesmos ramos abertos.
    function backupRefresh(message) {
      backupState.data = readBackupData(backupState.db);
      renderBackupView(true);
      setBackupStatus(message || '', false);
    }

    function backupSaveNote(item, title, text, color) {
      const db = backupState.db;
      let userMarkId = item.userMarkId || null;
      // Nota avulsa não tem cor (como no JW Library). Nas outras, a cor fica na "marca" (UserMark) da nota.
      if (item.locationId !== null && item.locationId !== undefined) {
        if (userMarkId) {
          db.run('UPDATE UserMark SET ColorIndex = ? WHERE UserMarkId = ?', [color, userMarkId]);
        } else if (color) {
          db.run('INSERT INTO UserMark (ColorIndex, LocationId, StyleIndex, UserMarkGuid, Version) VALUES (?, ?, 0, ?, 1)', [color, item.locationId, backupUuid()]);
          userMarkId = backupLastId(db);
        }
      }
      db.run('UPDATE Note SET Title = ?, Content = ?, LastModified = ?, UserMarkId = ? WHERE NoteId = ?', [title, text, backupNow(), userMarkId, item.id]);
      backupMarkChanged();
    }

    function backupDeleteNote(item) {
      const db = backupState.db;
      db.run('DELETE FROM TagMap WHERE NoteId = ?', [item.id]);
      db.run('DELETE FROM Note WHERE NoteId = ?', [item.id]);
      // A marca de cor só sai se não sobrar grifo nem outra nota usando-a.
      if (item.userMarkId) {
        db.run('DELETE FROM UserMark WHERE UserMarkId = ? AND NOT EXISTS (SELECT 1 FROM BlockRange WHERE UserMarkId = ?) AND NOT EXISTS (SELECT 1 FROM Note WHERE UserMarkId = ?)',
          [item.userMarkId, item.userMarkId, item.userMarkId]);
      }
      backupMarkChanged();
    }

    function backupCreateNote(title, text) {
      const now = backupNow();
      backupState.db.run('INSERT INTO Note (Guid, UserMarkId, LocationId, Title, Content, LastModified, Created, BlockType, BlockIdentifier) VALUES (?, NULL, NULL, ?, ?, ?, ?, 0, NULL)',
        [backupUuid(), title, text, now, now]);
      backupMarkChanged();
    }

    function backupSaveAnswer(item, text) {
      backupState.db.run('UPDATE InputField SET Value = ? WHERE LocationId = ? AND TextTag = ?', [text, item.locationId, item.textTag]);
      backupMarkChanged();
    }

    function backupDeleteAnswer(item) {
      backupState.db.run('DELETE FROM InputField WHERE LocationId = ? AND TextTag = ?', [item.locationId, item.textTag]);
      backupMarkChanged();
    }

    // ---------- Backup: criar uma resposta nova ("Sua resposta" de uma pergunta de um documento) ----------
    // A resposta vai para a caixa de uma pergunta (id da caixa = TextTag) de um documento; o JW Library guarda isso numa "Location"
    // do documento sem idioma (MepsLanguage vazio). As perguntas de cada documento vêm do wol.jw.org (servidor). Só A Sentinela de
    // estudo e a apostila Vida e Ministério podem ganhar uma Location nova; nos demais documentos vale a que o backup já tem.

    // Documentos do backup onde uma resposta nova pode entrar: os das publicações que têm caixas "Sua resposta".
    function backupAnswerDocs() {
      return backupRows(backupState.db, `
        SELECT l.KeySymbol, l.IssueTagNumber, l.DocumentId, MAX(l.Title) AS Title
        FROM Location l
        WHERE l.DocumentId IS NOT NULL AND l.DocumentId > 0 AND l.Type = 0 AND l.KeySymbol IS NOT NULL
          AND (l.KeySymbol IN ('w', 'mwb') OR l.KeySymbol IN (SELECT l2.KeySymbol FROM InputField i JOIN Location l2 ON l2.LocationId = i.LocationId))
        GROUP BY l.KeySymbol, l.IssueTagNumber, l.DocumentId
        ORDER BY l.IssueTagNumber DESC, l.DocumentId DESC LIMIT 80`);
    }

    // A semana em que cada artigo de estudo de A Sentinela é estudado (a revista só traz o mês): o servidor a acha nas páginas de reuniões do
    // wol.jw.org (só o número do documento e a edição saem do aparelho) e fica guardada aqui, porque nunca muda.
    const BACKUP_SEMANAS_KEY = 'jwLibraryNoteAplicarSemanasEstudoV1';
    let backupSemanas = {}; // docId -> "15-21 de setembro de 2025"
    try { backupSemanas = JSON.parse(localStorage.getItem(BACKUP_SEMANAS_KEY) || '{}') || {}; } catch (e) { backupSemanas = {}; }
    const backupSemanasTentadas = new Set(); // não insiste na mesma visita

    // "15-21 de setembro" -> "15-21 de setembro de 2025" (o período da virada do ano já traz os anos).
    const backupPeriodoComAno = (periodo, ano) => (/\d{4}/.test(periodo) ? periodo : periodo + ' de ' + ano);

    function backupGuardarSemanas() {
      const ids = Object.keys(backupSemanas);
      if (ids.length > 400) ids.slice(0, ids.length - 400).forEach(id => { delete backupSemanas[id]; });
      safeSetItem(BACKUP_SEMANAS_KEY, JSON.stringify(backupSemanas));
    }

    // Descobre, em segundo plano, a semana dos artigos de estudo (edições de 2022 em diante) que ainda não se conhecem; chama aoMudar a cada lote.
    async function backupResolverSemanas(linhas, aoMudar) {
      const faltam = linhas.filter(r => r.KeySymbol === 'w' && /^\d{8}$/.test(String(r.IssueTagNumber)) && Number(r.IssueTagNumber) >= 20220100
        && !backupSemanas[String(r.DocumentId)] && !backupSemanasTentadas.has(String(r.DocumentId)));
      if (!faltam.length || studyAccessError() || !navigator.onLine) return;
      faltam.forEach(r => backupSemanasTentadas.add(String(r.DocumentId)));
      for (let i = 0; i < faltam.length; i += 10) {
        let result;
        try {
          result = await postStudy({ tarefa: 'backup-semanas', codigo: codigoAcessoSalvo(), documentos: faltam.slice(i, i + 10).map(r => ({ id: String(r.DocumentId), edicao: Number(r.IssueTagNumber) })) }, 90000);
        } catch (e) { return; }
        if (!result.ok) return;
        const achadas = Object.entries(result.data.semanas || {});
        achadas.forEach(([id, semana]) => { backupSemanas[id] = backupPeriodoComAno(semana.periodo, semana.ano); });
        if (achadas.length) { backupGuardarSemanas(); aoMudar(); }
      }
    }

    function backupAnswerDocLabel(r) {
      const { code } = backupProcessCode(r.KeySymbol, r.IssueTagNumber);
      const pub = backupPubs && backupPubs.publicacoes ? backupPubs.publicacoes[code] : null;
      const issue = String(r.IssueTagNumber || '');
      const info = backupCampos[String(r.DocumentId)];
      const titulo = (info && info.titulo) || r.Title || '';
      const semana = r.KeySymbol === 'w' && backupSemanas[String(r.DocumentId)] ? 'estudo de ' + backupSemanas[String(r.DocumentId)] : '';
      return [pub ? pub[0] : code || r.KeySymbol, /^\d{8}$/.test(issue) && Number(issue) > 19000000 ? backupIssueLabel(issue) : '', semana, titulo || 'documento ' + r.DocumentId].filter(Boolean).join(' · ');
    }

    // A semana (ISO) deslocada do dia de hoje: { ano, semana, rotulo: "15 a 21 de setembro" }. Usa as funções da barra da semana das Reuniões.
    function backupSemanaDeslocada(deslocamento) {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      const segunda = new Date(hoje);
      segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7) + deslocamento * 7);
      const [ano, semana] = isoYearWeek(segunda);
      return { ano, semana, rotulo: rotuloDaSemana(segunda) };
    }

    // O número do documento a partir do endereço do wol.jw.org ("…/lp-t/2025487"), de um link com docid=… ou do próprio número.
    function backupDocIdFrom(texto) {
      const t = String(texto || '').trim();
      const m = t.match(/docid=(\d{6,12})/i) || t.match(/\/(\d{6,12})(?:[\/?#]|$)/) || t.match(/^(\d{6,12})$/);
      return m ? m[1] : '';
    }

    // Grava a resposta. Devolve '' se deu certo ou a mensagem do problema.
    function backupCreateAnswer(docId, info, tag, text) {
      const db = backupState.db;
      const doc = Number(docId);
      const dela = backupOne(db, 'SELECT l.LocationId FROM Location l JOIN InputField i ON i.LocationId = l.LocationId WHERE l.DocumentId = ? ORDER BY l.LocationId LIMIT 1', [doc]);
      let locationId = dela ? dela.LocationId : null;
      if (locationId === null) {
        // Sem resposta nesse documento ainda: a Location sem idioma é criada com a publicação e a edição que o backup já conhece (ou, se
        // o documento é novo para o backup, as que o wol.jw.org informa).
        const base = backupOne(db, 'SELECT KeySymbol, IssueTagNumber FROM Location WHERE DocumentId = ? AND KeySymbol IS NOT NULL ORDER BY LocationId LIMIT 1', [doc]);
        const simbolo = base ? base.KeySymbol : info.simbolo;
        const edicao = base ? base.IssueTagNumber : info.edicao;
        if (!simbolo || edicao === null || edicao === undefined) return 'Não consegui identificar a publicação deste documento. Só crio respostas em A Sentinela, na apostila Vida e Ministério e em documentos que já estão no backup.';
        const achada = backupOne(db, 'SELECT LocationId FROM Location WHERE DocumentId = ? AND KeySymbol IS ? AND IssueTagNumber = ? AND MepsLanguage IS NULL AND Type = 0 AND BookNumber IS NULL AND ChapterNumber IS NULL ORDER BY LocationId LIMIT 1', [doc, simbolo, edicao]);
        if (achada) locationId = achada.LocationId;
        else {
          const comTitulo = backupColumns(db, 'Location').includes('Title');
          db.run('INSERT INTO Location (KeySymbol, IssueTagNumber, MepsLanguage, DocumentId, Type' + (comTitulo ? ', Title' : '') + ') VALUES (?, ?, NULL, ?, 0' + (comTitulo ? ", ''" : '') + ')', [simbolo, edicao, doc]);
          locationId = backupLastId(db);
        }
      }
      if (backupOne(db, 'SELECT 1 AS x FROM InputField WHERE LocationId = ? AND TextTag = ?', [locationId, tag])) return 'Essa pergunta já tem resposta: edite a que existe.';
      db.run('INSERT INTO InputField (LocationId, TextTag, Value) VALUES (?, ?, ?)', [locationId, tag, text]);
      backupMarkChanged();
      return '';
    }

    function backupNewAnswerEditor(slot, onClose) {
      const form = document.createElement('div');
      form.className = 'bk-editor';
      form.addEventListener('click', event => event.stopPropagation());

      const docSelect = document.createElement('select');
      const addOption = (select, value, label, disabled) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.disabled = Boolean(disabled);
        select.appendChild(option);
      };
      addOption(docSelect, '', 'Escolha o documento…');
      addOption(docSelect, 'semana', '📅 Carregar as publicações de uma semana (estudo e apostila)…');
      addOption(docSelect, 'outro', '🔗 Outro documento (colar o endereço do wol.jw.org)');
      const documentos = backupAnswerDocs();
      documentos.forEach(r => addOption(docSelect, String(r.DocumentId), backupAnswerDocLabel(r)));
      form.appendChild(backupField('Documento', docSelect));
      // As duas opções de carregar outro documento ficam no começo do painel e em outra cor.
      backupSeletorLargo(docSelect, valor => valor === 'semana' || valor === 'outro');
      // A semana de estudo dos artigos de A Sentinela aparece no nome assim que o servidor a descobre (e fica guardada).
      backupResolverSemanas(documentos, () => {
        [...docSelect.options].forEach(option => {
          const linha = documentos.find(r => String(r.DocumentId) === option.value);
          if (linha) option.textContent = backupAnswerDocLabel(linha);
        });
      });

      // Carregar as publicações de uma semana (a atual, ou outra): o artigo de estudo de A Sentinela e a apostila Vida e Ministério,
      // mesmo que o backup ainda não tenha esses documentos.
      let deslocamento = 0;
      const semanaTexto = document.createElement('div');
      semanaTexto.className = 'bk-semana';
      const mostrarSemana = () => {
        const s = backupSemanaDeslocada(deslocamento);
        semanaTexto.textContent = '📅 ' + (deslocamento === 0 ? 'Semana atual' : deslocamento === -1 ? 'Semana passada' : deslocamento === 1 ? 'Próxima semana' : 'Outra semana') + ' · ' + s.rotulo;
      };
      mostrarSemana();
      const semanaNav = document.createElement('div');
      semanaNav.className = 'bk-semana-nav';
      semanaNav.append(backupButton('◀', () => { deslocamento--; mostrarSemana(); }), semanaTexto, backupButton('▶', () => { deslocamento++; mostrarSemana(); }));
      const semanaRow = document.createElement('div');
      semanaRow.hidden = true;
      semanaRow.append(backupField('Semana da publicação', semanaNav), (() => {
        const row = document.createElement('div');
        row.className = 'bk-row';
        row.appendChild(backupButton('🔎 Carregar as publicações desta semana', () => carregarSemana()));
        return row;
      })());
      form.appendChild(semanaRow);

      const linkInput = document.createElement('input');
      linkInput.type = 'text';
      linkInput.autocomplete = 'off';
      linkInput.placeholder = 'https://wol.jw.org/pt/wol/d/r5/lp-t/2025487';
      const linkRow = document.createElement('div');
      linkRow.hidden = true;
      linkRow.append(backupField('Endereço ou número do documento', linkInput), (() => {
        const row = document.createElement('div');
        row.className = 'bk-row';
        row.appendChild(backupButton('🔎 Buscar as perguntas', () => escolher(backupDocIdFrom(linkInput.value))));
        return row;
      })());
      form.appendChild(linkRow);

      const aviso = document.createElement('p');
      aviso.className = 'hint';
      aviso.textContent = 'As perguntas de cada documento vêm do wol.jw.org (só o número do documento é enviado).';
      form.appendChild(aviso);
      // Depois de cada resposta salva o formulário continua aberto, com a pergunta seguinte escolhida; este aviso diz o que foi salvo.
      const feito = document.createElement('p');
      feito.className = 'bk-feito ok';
      feito.setAttribute('role', 'status');
      feito.setAttribute('aria-live', 'polite');
      form.appendChild(feito);
      const mostrarFeito = (mensagem, aviso) => {
        feito.className = 'bk-feito ' + (aviso ? 'warn' : 'ok');
        feito.textContent = mensagem;
      };
      const perguntaSelect = document.createElement('select');
      perguntaSelect.disabled = true;
      form.appendChild(backupField('Pergunta (parágrafo)', perguntaSelect));
      backupSeletorLargo(perguntaSelect);
      const textArea = document.createElement('textarea');
      textArea.className = 'bk-text';
      form.appendChild(backupField('Resposta', textArea));
      form.appendChild(backupBridgeRow(textArea));

      let escolha = null; // { docId, info }
      let salvasAqui = 0; // respostas salvas neste formulário (o arquivo do backup só é gerado no fim, quando o usuário quiser)
      const rotuloDoCampo = campo => (campo && campo.numero ? 'parágrafo ' + campo.numero : campo && campo.quadro ? 'quadro de recapitulação' : 'pergunta');
      const contagem = n => (n === 1 ? '1 resposta salva' : n + ' respostas salvas');
      const salvar = backupButton('💾 Salvar e continuar', () => {
        const tag = perguntaSelect.value;
        const text = textArea.value.replace(/\s+$/, '');
        if (!escolha || !tag) return mostrarFeito('Escolha o documento e a pergunta.', true);
        if (!text.trim()) return mostrarFeito('Escreva a resposta.', true);
        const problema = backupCreateAnswer(escolha.docId, escolha.info, tag, text);
        if (problema) return mostrarFeito(problema, true);
        salvasAqui++;
        fechar.textContent = '✔️ Concluir';
        // A pergunta salva passa a "já respondida" e a próxima livre (depois dela, ou a primeira livre) já fica escolhida.
        const opcoes = [...perguntaSelect.options];
        const salva = perguntaSelect.selectedOptions[0];
        const rotulo = rotuloDoCampo((escolha.info.campos || []).find(c => c.tag === tag));
        salva.disabled = true;
        salva.textContent += ' (já respondida)';
        const seguinte = opcoes.slice(opcoes.indexOf(salva) + 1).find(o => !o.disabled) || opcoes.find(o => !o.disabled);
        textArea.value = '';
        backupRefresh(); // a lista abaixo já mostra a resposta nova; o contador de alterações do arquivo sobe
        if (seguinte) {
          perguntaSelect.value = seguinte.value;
          mostrarFeito('✅ Resposta do ' + rotulo + ' salva (' + contagem(salvasAqui) + '). A próxima pergunta já está escolhida: escreva a resposta e toque em Salvar e continuar. Quando terminar as do artigo, toque em Concluir e gere o backup.', false);
        } else {
          salvar.disabled = true;
          mostrarFeito('✅ Resposta do ' + rotulo + ' salva (' + contagem(salvasAqui) + '). Todas as perguntas deste documento já têm resposta: toque em Concluir e gere o backup.', false);
        }
        feito.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, '');
      salvar.disabled = true;
      // Fecha o formulário. Se há resposta escrita e não salva, pergunta antes; se algo foi salvo, leva o usuário ao botão de gerar o backup.
      const fechar = backupButton('✖️ Cancelar', async () => {
        if (textArea.value.trim() && !(await askConfirm('A resposta escrita ainda não foi salva. Fechar mesmo assim?', 'Fechar'))) return;
        onClose();
        if (!salvasAqui) return;
        setBackupStatus('✅ ' + contagem(salvasAqui) + ' neste backup. Toque em "Gerar backup modificado" para gravar o arquivo.', false);
        requestAnimationFrame(() => document.getElementById('backupSaveBox').scrollIntoView({ block: 'center', behavior: 'smooth' }));
      });
      const actions = document.createElement('div');
      actions.className = 'bk-row';
      actions.append(salvar, fechar);
      form.appendChild(actions);

      async function escolher(docId) {
        escolha = null;
        perguntaSelect.textContent = '';
        perguntaSelect.disabled = true;
        salvar.disabled = true;
        if (!docId) { aviso.textContent = 'Escolha um documento ou cole o endereço dele.'; return; }
        aviso.textContent = '🔎 Consultando o wol.jw.org…';
        const problema = await backupCarregarCampos([docId]);
        if (problema) { aviso.textContent = problema; return; }
        const info = backupCampos[docId];
        if (!info || !(info.campos || []).length) { aviso.textContent = 'Não encontrei caixas de resposta nesse documento.'; return; }
        const respondidas = new Set(backupAll(backupState.db,
          'SELECT i.TextTag AS tag FROM InputField i JOIN Location l ON l.LocationId = i.LocationId WHERE l.DocumentId = ?', [Number(docId)]).map(r => r.tag));
        info.campos.forEach(c => {
          const texto = (c.numero ? 'Parágrafo ' + c.numero + ' — ' : c.quadro ? 'Quadro de recapitulação — ' : '') + (c.pergunta || c.tag);
          addOption(perguntaSelect, c.tag, (texto.length > 110 ? texto.slice(0, 107) + '…' : texto) + (respondidas.has(c.tag) ? ' (já respondida)' : ''), respondidas.has(c.tag));
        });
        const livre = [...perguntaSelect.options].find(o => !o.disabled);
        aviso.textContent = '📖 ' + (info.titulo || 'documento ' + docId) + (info.simbolo === 'w' && backupSemanas[docId] ? ' · estudo de ' + backupSemanas[docId] : '') + (livre ? '' : ' — todas as perguntas já têm resposta.');
        if (!livre) return;
        perguntaSelect.value = livre.value;
        perguntaSelect.disabled = false;
        escolha = { docId, info };
        salvar.disabled = false;
      }

      // Busca no servidor o artigo de estudo e a apostila da semana escolhida e põe os dois na lista de documentos.
      async function carregarSemana() {
        const alvo = backupSemanaDeslocada(deslocamento);
        const acesso = studyAccessError();
        if (acesso) { aviso.textContent = acesso; return; }
        aviso.textContent = '🔎 Consultando o wol.jw.org…';
        let result;
        try {
          result = await postStudy({ tarefa: 'backup-semana', codigo: codigoAcessoSalvo(), ano: alvo.ano, semana: alvo.semana }, 45000);
        } catch (e) {
          aviso.textContent = e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao consultar o wol.jw.org.';
          return;
        }
        if (!result.ok) { aviso.textContent = studyFailureMessage(result, 'Não consegui ler essa semana agora.'); return; }
        const d = result.data;
        const novos = [];
        const periodo = backupPeriodoComAno(d.periodo || alvo.rotulo, d.ano);
        if (d.sentinela) {
          backupSemanas[d.sentinela.id] = periodo;
          backupGuardarSemanas();
          novos.push({ id: d.sentinela.id, rotulo: 'A Sentinela · estudo de ' + periodo + (d.sentinela.titulo ? ' · ' + d.sentinela.titulo : '') });
        }
        if (d.apostila) novos.push({ id: d.apostila.id, rotulo: 'Apostilas · ' + periodo });
        if (!novos.length) { aviso.textContent = 'Não encontrei publicações em ' + alvo.rotulo + '. Confira a semana ou cole o endereço de um documento.'; return; }
        // Entram no começo da lista (depois de "Escolha o documento…"); se já estavam, só o nome é atualizado.
        novos.slice().reverse().forEach(n => {
          const existente = [...docSelect.options].find(o => o.value === n.id);
          if (existente) existente.textContent = n.rotulo;
          else {
            const opcao = document.createElement('option');
            opcao.value = n.id;
            opcao.textContent = n.rotulo;
            docSelect.insertBefore(opcao, docSelect.options[3] || null); // depois de "Escolha…", "Carregar as publicações…" e "Outro documento"
          }
        });
        docSelect.value = novos[0].id;
        semanaRow.hidden = true;
        escolher(novos[0].id);
      }

      docSelect.addEventListener('change', () => {
        linkRow.hidden = docSelect.value !== 'outro';
        semanaRow.hidden = docSelect.value !== 'semana';
        if (docSelect.value === 'semana') {
          escolha = null;
          perguntaSelect.textContent = '';
          perguntaSelect.disabled = true;
          salvar.disabled = true;
          aviso.textContent = 'Escolha a semana e toque em Carregar: o app traz o artigo de estudo de A Sentinela e a apostila Vida e Ministério daquela semana.';
        } else if (docSelect.value === 'outro') {
          escolha = null;
          perguntaSelect.textContent = '';
          perguntaSelect.disabled = true;
          salvar.disabled = true;
          aviso.textContent = 'Cole o endereço do artigo no wol.jw.org (ou o número do documento) e toque em Buscar.';
          linkInput.focus();
        } else escolher(docSelect.value);
      });

      slot.appendChild(form);
      docSelect.focus();
      return form;
    }

    // Troca a lista nativa de um <select> por um painel largo: o select continua sendo o "modelo" (valor, opções, desabilitado e o evento
    // change funcionam como antes) e fica escondido; o botão mostra a escolha inteira (em quantas linhas precisar) e o painel lista as opções
    // com o texto inteiro. destacar(valor) diz quais opções vão no começo do painel e em outra cor.
    // opcoes.vazioEscolhivel: a opção sem valor ("Nenhum…") é uma escolha e entra no painel (nos outros seletores ela é só o texto de "nada escolhido").
    function backupSeletorLargo(select, destacar, opcoes = {}) {
      const caixa = document.createElement('div');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'bk-seletor-botao';
      botao.setAttribute('aria-haspopup', 'listbox');
      botao.setAttribute('aria-expanded', 'false');
      const lista = document.createElement('div');
      lista.className = 'bk-seletor-lista';
      lista.setAttribute('role', 'listbox');
      lista.hidden = true;
      caixa.append(botao, lista);
      select.classList.add('bk-seletor-nativo');
      select.insertAdjacentElement('afterend', caixa);

      const fechar = () => { lista.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
      const desenhar = () => {
        lista.textContent = '';
        const todas = [...select.options].filter(o => o.value !== '' || opcoes.vazioEscolhivel);
        const ordem = destacar ? [...todas.filter(o => destacar(o.value)), ...todas.filter(o => !destacar(o.value))] : todas;
        ordem.forEach(o => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'bk-seletor-item' + (destacar && destacar(o.value) ? ' destaque' : '') + (o.value === select.value ? ' selecionado' : '');
          item.setAttribute('role', 'option');
          item.disabled = o.disabled;
          item.textContent = (o.value === select.value ? '✓ ' : '') + o.textContent;
          item.addEventListener('click', event => {
            event.stopPropagation();
            fechar();
            select.value = o.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          });
          lista.appendChild(item);
        });
        if (!ordem.length) {
          const vazio = document.createElement('div');
          vazio.className = 'bk-seletor-item';
          vazio.textContent = 'Nenhuma opção.';
          lista.appendChild(vazio);
        }
      };
      const atualizar = () => {
        const escolhida = select.selectedOptions[0];
        botao.textContent = escolhida ? escolhida.textContent : '';
        botao.classList.toggle('vazio', !select.value);
        botao.disabled = select.disabled;
        if (select.disabled) fechar();
        if (!lista.hidden) desenhar();
      };
      botao.addEventListener('click', event => {
        event.stopPropagation();
        if (!lista.hidden) return fechar();
        desenhar();
        lista.hidden = false;
        botao.setAttribute('aria-expanded', 'true');
        const marcada = lista.querySelector('.selecionado');
        if (marcada) lista.scrollTop = Math.max(0, marcada.offsetTop - 60);
      });
      // O código que troca opções, o "disabled" ou o valor do select de fora também atualiza o botão.
      new MutationObserver(atualizar).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
      const original = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      Object.defineProperty(select, 'value', { configurable: true, get() { return original.get.call(this); }, set(valor) { original.set.call(this, valor); atualizar(); } });
      select.addEventListener('change', atualizar);
      atualizar();
      return { atualizar, fechar };
    }

    function backupButton(label, onClick, className) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = className === undefined ? 'secondary' : className;
      btn.textContent = label;
      btn.addEventListener('click', event => { event.stopPropagation(); onClick(); });
      return btn;
    }

    function backupField(labelText, control) {
      const wrap = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = labelText;
      wrap.append(label, control);
      return wrap;
    }

    // Ponte com o editor do NoteStyle: formatar o texto no campo principal e trazê-lo de volta para a nota ou a resposta.
    function backupBridgeRow(textArea) {
      const bridge = document.createElement('div');
      bridge.className = 'bk-row';
      bridge.append(
        backupButton('➡️ Levar para o campo de texto', async () => {
          if (input.value.trim() && !(await askConfirm('O texto do campo de texto será trocado por este texto (dá para desfazer). Continuar?', 'Levar para o campo de texto'))) return;
          setInputRange(0, input.value.length, textArea.value, { message: 'Texto no campo de texto. Formate e depois use "⬅️ Trazer do campo de texto" no Backup.' });
          autoGrowInputText();
          showScreen('formatar');
        }),
        backupButton('⬅️ Trazer do campo de texto', () => {
          if (!input.value.trim()) return setBackupStatus('O campo de texto está vazio.', true);
          textArea.value = input.value;
          setBackupStatus('Texto trazido do campo de texto. Confira e toque em 💾 Salvar.', false);
        })
      );
      return bridge;
    }

    // Formulário de edição (ou de nota nova, quando item é null) dentro do cartão.
    function backupEditor(holder, item, categoryId, onClose) {
      const form = document.createElement('div');
      form.className = 'bk-editor';
      form.addEventListener('click', event => event.stopPropagation());
      const isNote = categoryId === 'notas';
      let titleInput = null;
      if (isNote) {
        titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.autocomplete = 'off';
        titleInput.value = item ? item.heading : '';
        form.appendChild(backupField('Título', titleInput));
      }
      const textArea = document.createElement('textarea');
      textArea.className = 'bk-text';
      textArea.value = item ? item.text : '';
      form.appendChild(backupField(isNote ? 'Texto da nota' : 'Resposta', textArea));

      let color = item ? item.colorIndex || 0 : 0;
      if (isNote && item && item.locationId !== null && item.locationId !== undefined) {
        const colors = document.createElement('div');
        colors.className = 'bk-colors';
        colors.setAttribute('role', 'group');
        colors.setAttribute('aria-label', 'Cor da nota');
        BACKUP_COLORS.forEach((hex, index) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'bk-color';
          dot.style.setProperty('--cor', hex);
          dot.title = BACKUP_COLOR_NAMES[index];
          dot.setAttribute('aria-label', BACKUP_COLOR_NAMES[index]);
          dot.setAttribute('aria-pressed', index === color ? 'true' : 'false');
          dot.addEventListener('click', () => {
            color = index;
            colors.querySelectorAll('.bk-color').forEach((b, i) => b.setAttribute('aria-pressed', i === color ? 'true' : 'false'));
          });
          colors.appendChild(dot);
        });
        form.appendChild(backupField('Cor', colors));
      }

      form.appendChild(backupBridgeRow(textArea));

      const actions = document.createElement('div');
      actions.className = 'bk-row';
      actions.append(
        backupButton('💾 Salvar', () => {
          const title = titleInput ? titleInput.value.trim() : '';
          const text = textArea.value.replace(/\s+$/, '');
          if (isNote && !title && !text.trim()) return setBackupStatus('A nota está vazia: escreva um título ou um texto.', true);
          if (!item) backupCreateNote(title, text);
          else if (isNote) backupSaveNote(item, title, text, color);
          else backupSaveAnswer(item, text);
          onClose();
          backupRefresh(item ? '✅ Alteração feita. Gere o backup modificado quando terminar.' : '✅ Nota avulsa criada. Gere o backup modificado quando terminar.');
        }, ''),
        backupButton('✖️ Cancelar', onClose)
      );
      form.appendChild(actions);
      holder.appendChild(form);
      (titleInput || textArea).focus();
      return form;
    }

    async function backupDeleteItem(item, categoryId) {
      const what = categoryId === 'notas' ? 'a nota "' + (item.heading || 'sem título') + '"' : 'esta resposta';
      if (!(await askConfirm('Apagar ' + what + ' do backup? (O arquivo original não muda.)', 'Apagar'))) return;
      if (categoryId === 'notas') backupDeleteNote(item);
      else backupDeleteAnswer(item);
      backupRefresh('🗑️ Apagado. Gere o backup modificado quando terminar.');
    }

    function renderBackupSaveBox() {
      const box = document.getElementById('backupSaveBox');
      if (!backupState) { box.hidden = true; return; }
      const changes = backupState.changes || 0;
      const generated = backupState.generated;
      box.hidden = !changes && !generated && !backupState.isNew;
      document.getElementById('backupSaveInfo').textContent = generated
        ? '✅ Arquivo pronto: ' + generated.fileName
        : !changes ? 'Backup novo, ainda não gravado em arquivo.'
        : changes + (changes === 1 ? ' alteração ainda não gravada em arquivo.' : ' alterações ainda não gravadas em arquivo.');
      const generateBtn = document.getElementById('backupGenerateBtn');
      generateBtn.hidden = Boolean(generated);
      generateBtn.textContent = backupState.isNew ? '💾 Gerar o arquivo do backup novo' : backupState.mesclado ? '💾 Gerar o backup mesclado' : '💾 Gerar backup modificado';
      document.getElementById('backupFileActions').hidden = !generated;
      const shareBtn = document.getElementById('backupShareBtn');
      shareBtn.hidden = !(generated && navigator.canShare && navigator.canShare({ files: [new File([''], 'teste.jwlibrary')] }));
    }

    // Nome do arquivo novo: o do original + "_NoteStyle_" + data e hora (sem acumular sufixos de edições anteriores).
    function backupOutputName(original, date) {
      const base = String(original || 'backup').replace(/\.jwlibrary$/i, '').replace(/_NoteStyle_\d{4}-\d{2}-\d{2}_\d{4}$/, '');
      const pad = n => String(n).padStart(2, '0');
      return base + '_NoteStyle_' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + '_' + pad(date.getHours()) + pad(date.getMinutes()) + '.jwlibrary';
    }

    async function backupGenerate() {
      const st = backupState;
      if (!st) return;
      const btn = document.getElementById('backupGenerateBtn');
      btn.disabled = true;
      setBackupStatus('Gerando o arquivo…', false);
      try {
        const now = new Date();
        const stamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
        st.db.run('UPDATE LastModified SET LastModified = ?', [stamp]);
        const bytes = st.db.export();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
        const manifest = JSON.parse(JSON.stringify(st.manifest));
        const info = manifest.userDataBackup;
        // Mesmo formato de data do backup original ("…+00:00" no iPhone, "…Z" em outros).
        const sameStyle = text => (/\+00:00$/.test(String(text || '')) ? stamp.replace(/Z$/, '+00:00') : stamp);
        info.lastModifiedDate = sameStyle(info.lastModifiedDate);
        info.hash = hash;
        manifest.creationDate = sameStyle(manifest.creationDate);
        const fileName = backupOutputName(st.fileName, now);
        manifest.name = fileName;
        st.zip.file(info.databaseName || 'userData.db', bytes);
        st.zip.file('manifest.json', JSON.stringify(manifest));
        // Tipo neutro (não application/zip): com o tipo ZIP, o iPhone e outros aparelhos acrescentam ".zip" ao nome e o JW Library não reconhece o arquivo.
        const blob = await st.zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        st.manifest = manifest;
        st.changes = 0;
        st.generated = { blob, fileName };
        renderBackupSaveBox();
        setBackupStatus('✅ Backup modificado pronto. Salve ou compartilhe o arquivo.', false);
      } catch (e) {
        setBackupStatus('Não consegui gerar o arquivo: ' + (e && e.message ? e.message : 'erro desconhecido.'), true);
      } finally {
        btn.disabled = false;
      }
    }

    function backupDownload() {
      const generated = backupState && backupState.generated;
      if (!generated) return;
      const url = URL.createObjectURL(new Blob([generated.blob], { type: 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = generated.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    async function backupShare() {
      const generated = backupState && backupState.generated;
      if (!generated) return;
      const file = new File([generated.blob], generated.fileName, { type: 'application/octet-stream' });
      try {
        await navigator.share({ files: [file], title: generated.fileName });
      } catch (e) {
        if (!e || e.name !== 'AbortError') backupDownload();
      }
    }

    document.getElementById('backupGenerateBtn').addEventListener('click', backupGenerate);
    document.getElementById('backupDownloadBtn').addEventListener('click', backupDownload);
    document.getElementById('backupShareBtn').addEventListener('click', backupShare);
    document.getElementById('backupNewNoteBtn').addEventListener('click', () => {
      const slot = document.getElementById('backupNewNoteSlot');
      if (slot.firstChild) return;
      backupEditor(slot, null, 'notas', () => { slot.textContent = ''; });
    });
    document.getElementById('backupNewAnswerBtn').addEventListener('click', () => {
      const slot = document.getElementById('backupNewAnswerSlot');
      if (slot.firstChild) return;
      backupNewAnswerEditor(slot, () => { slot.textContent = ''; });
    });
    window.addEventListener('beforeunload', event => {
      if (backupState && backupState.changes) {
        event.preventDefault();
        event.returnValue = '';
      }
    });

    // ---------- Backup do JW Library: fechar, backup vazio e exportar notas ----------
    // O backup vazio (jw-backup-vazio.zip) é o "blank" do JWLManager (licença MIT): banco userData.db sem dados, no
    // formato 16, e a miniatura padrão. A exportação usa as mesmas colunas do JWLManager, para que a planilha também
    // possa ser importada nele.
    const BACKUP_EXPORT_FIELDS = ['CREATED', 'MODIFIED', 'TAGS', 'COLOR', 'RANGE', 'LANG', 'PUB', 'BK', 'CH', 'VS', 'Reference',
      'ISSUE', 'DOC', 'BLOCK', 'HEADING', 'Link', 'TITLE', 'NOTE'];
    const BACKUP_EXPORT_NUMBERS = new Set(['COLOR', 'LANG', 'BK', 'CH', 'VS', 'ISSUE', 'DOC', 'BLOCK']);

    async function backupClose() {
      if (!backupState) return;
      if (backupState.changes &&
        !(await askConfirm('As alterações deste backup ainda não foram gravadas em arquivo e serão perdidas. Fechar mesmo assim?', 'Fechar backup'))) return;
      backupCloseImport();
      if (backupState.db) backupState.db.close();
      backupState = null;
      document.getElementById('backupSearch').value = '';
      document.getElementById('backupNewNoteSlot').textContent = '';
      document.getElementById('backupTree').textContent = '';
      renderBackupView();
      setBackupStatus('Backup fechado. O arquivo original continua como estava.', false);
    }

    async function backupCreateNew() {
      if (backupState && backupState.changes &&
        !(await askConfirm('As alterações do backup aberto ainda não foram gravadas em arquivo e serão perdidas. Continuar?', 'Criar backup vazio'))) return;
      if (!(await askConfirm('Será criado um backup novo, sem nenhuma nota, grifo ou favorito, para você montar do zero.\n\n' +
        'Atenção: restaurar um backup no JW Library substitui TODOS os dados do aparelho pelos dados do backup.', 'Criar backup vazio'))) return;
      setBackupStatus('Criando o backup vazio…', false);
      try {
        const [{ JSZip, SQL }] = await Promise.all([loadBackupLibs(), loadBackupPubs()]);
        const response = await fetch('jw-backup-vazio.zip');
        if (!response.ok) throw new Error('não encontrei o modelo do backup vazio.');
        const zip = await JSZip.loadAsync(await response.arrayBuffer());
        const db = new SQL.Database(await zip.file('userData.db').async('uint8array'));
        const stamp = backupNow();
        const manifest = {
          name: 'NoteStyle', creationDate: stamp, version: 1, type: 0,
          userDataBackup: { lastModifiedDate: stamp, deviceName: 'NoteStyle', databaseName: 'userData.db', hash: '', schemaVersion: 16 }
        };
        const data = readBackupData(db);
        backupCloseImport();
        if (backupState && backupState.db) backupState.db.close();
        backupState = { zip, db, manifest, fileName: 'Backup_novo.jwlibrary', data, changes: 0, generated: null, isNew: true };
        backupCategory = 'notas';
        document.getElementById('backupSearch').value = '';
        document.getElementById('backupNewNoteSlot').textContent = '';
        renderBackupView();
        setBackupStatus('✅ Backup vazio criado. Use "➕ Nova nota avulsa" para escrever notas e depois gere o arquivo.', false);
      } catch (e) {
        setBackupStatus('Não consegui criar o backup: ' + (e && e.message ? e.message : 'erro desconhecido.'), true);
      }
    }

    // As notas do backup aberto (com as alterações ainda não gravadas), uma linha por nota, como no JWLManager.
    function backupExportRows(db) {
      const symbols = (backupPubs && backupPubs.simbolos) || { 5: 'T' };
      const rows = backupRows(db, `
        SELECT n.BlockType, n.Title, n.Content, n.BlockIdentifier, n.LastModified, n.Created,
               l.MepsLanguage, l.BookNumber, l.ChapterNumber, l.DocumentId, l.IssueTagNumber, l.KeySymbol, l.Title AS LocTitle, u.ColorIndex,
               (SELECT group_concat(Name, ' | ') FROM (SELECT t.Name FROM TagMap tm JOIN Tag t ON t.TagId = tm.TagId
                 WHERE tm.NoteId = n.NoteId ORDER BY t.Name)) AS Tags,
               (SELECT group_concat(Faixa, ';') FROM (SELECT Identifier || ':' || StartToken || '-' || EndToken AS Faixa FROM BlockRange
                 WHERE UserMarkId = n.UserMarkId ORDER BY Identifier, StartToken)) AS Ranges
        FROM Note n LEFT JOIN Location l ON l.LocationId = n.LocationId LEFT JOIN UserMark u ON u.UserMarkId = n.UserMarkId
        ORDER BY n.BlockType, n.LastModified DESC, n.NoteId DESC`);
      const valid = text => text.includes('-') && text.length >= 10;
      return rows.map(r => {
        let created = String(r.Created || '').slice(0, 19);
        let modified = String(r.LastModified || '').slice(0, 19);
        if (!valid(created)) created = backupNow().slice(0, 19);
        else if (!created.includes('T')) created = created.slice(0, 10) + 'T00:00:00';
        if (!valid(modified)) modified = created;
        else if (!modified.includes('T')) modified = modified.slice(0, 10) + 'T00:00:00';
        const item = {
          CREATED: created, MODIFIED: modified, TAGS: r.Tags || '', COLOR: r.ColorIndex || 0, RANGE: r.Ranges || '',
          LANG: r.MepsLanguage, PUB: r.KeySymbol || '', BK: r.BookNumber, CH: r.ChapterNumber, VS: r.BlockIdentifier, Reference: '',
          ISSUE: r.IssueTagNumber > 10000000 ? r.IssueTagNumber : null, DOC: r.DocumentId, BLOCK: r.BlockIdentifier,
          HEADING: r.LocTitle || '', Link: '', TITLE: r.Title || '', NOTE: String(r.Content || '').trim()
        };
        const symbol = symbols[String(item.LANG)];
        if (r.BlockType === 0 && !(item.BK || item.DOC)) { // nota avulsa
          item.BLOCK = null;
          item.VS = null;
        } else if (item.BK) { // nota na Bíblia: o bloco é o versículo
          let verse = '000';
          if (item.VS !== null && item.VS !== undefined) {
            verse = String(item.VS).padStart(3, '0');
            item.BLOCK = null;
          }
          item.Reference = String(item.BK).padStart(2, '0') + String(item.CH || 0).padStart(3, '0') + verse;
          if (symbol) item.Link = 'https://www.jw.org/finder?wtlocale=' + symbol + '&pub=' + item.PUB + '&bible=' + item.Reference;
          if (!item.HEADING) item.HEADING = (BIBLE_BOOKS[item.BK - 1] || 'Livro ' + item.BK) + ' ' + (item.CH || '');
          else if (item.VS !== null && item.VS !== undefined && !item.HEADING.includes(':')) item.HEADING += ':' + item.VS;
        } else { // nota numa publicação
          item.VS = null;
          if (symbol && item.DOC !== null && item.DOC !== undefined) {
            item.Link = 'https://www.jw.org/finder?wtlocale=' + symbol + '&docid=' + item.DOC + (item.BLOCK ? '&par=' + item.BLOCK : '');
          }
        }
        return item;
      });
    }

    function backupExportName(extension) {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      return 'Notas_JW_Library_' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.' + extension;
    }

    function backupSaveBlob(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // CSV para o Excel em português: separador ";", UTF-8 com BOM (acentos certos) e quebras de linha dentro de aspas.
    function backupCsv(items) {
      const cell = value => {
        if (value === null || value === undefined) return '';
        const text = String(value).replace(/\r\n?/g, '\n');
        return /[;"\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };
      const lines = [BACKUP_EXPORT_FIELDS.join(';')].concat(items.map(item => BACKUP_EXPORT_FIELDS.map(f => cell(item[f])).join(';')));
      return new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    }

    function backupXml(text) {
      return String(text)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function backupColumnName(index) {
      let name = '';
      for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
      return name;
    }

    // Planilha .xlsx montada à mão (é só um ZIP com alguns XML): cabeçalho em negrito, filtro e primeira linha fixa.
    async function backupXlsx(items, title, comment) {
      const strings = [];
      const stringIndex = new Map();
      const shared = text => {
        const value = String(text).replace(/\r\n?/g, '\n').slice(0, 32767); // limite de uma célula do Excel
        if (!stringIndex.has(value)) { stringIndex.set(value, strings.length); strings.push(value); }
        return stringIndex.get(value);
      };
      const last = backupColumnName(BACKUP_EXPORT_FIELDS.length - 1);
      const header = '<row r="1">' + BACKUP_EXPORT_FIELDS.map((f, i) => '<c r="' + backupColumnName(i) + '1" t="s" s="1"><v>' + shared(f) + '</v></c>').join('') + '</row>';
      const body = items.map((item, rowIndex) => {
        const r = rowIndex + 2;
        const cells = BACKUP_EXPORT_FIELDS.map((f, i) => {
          const value = item[f];
          if (value === null || value === undefined || value === '') return '';
          const ref = backupColumnName(i) + r;
          if (BACKUP_EXPORT_NUMBERS.has(f) && Number.isFinite(Number(value))) return '<c r="' + ref + '"><v>' + Number(value) + '</v></c>';
          return '<c r="' + ref + '" t="s"><v>' + shared(value) + '</v></c>';
        }).join('');
        return '<row r="' + r + '">' + cells + '</row>';
      }).join('');
      const widths = BACKUP_EXPORT_FIELDS.map((f, i) => {
        const width = i < 3 ? 20 : f === 'TITLE' ? 30 : f === 'NOTE' ? 60 : f === 'Link' ? 24 : 12;
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>';
      }).join('');
      const rowsEnd = items.length + 1;
      const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
      const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
      const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
      const zip = new window.JSZip();
      const add = (name, content) => zip.file(name, content, { createFolders: false }); // sem entradas de pasta, como o Excel
      add('[Content_Types].xml', xml + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
      add('_rels/.rels', xml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + rel + '/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="' + rel + '/extended-properties" Target="docProps/app.xml"/></Relationships>');
      add('docProps/core.xml', xml + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + backupXml(title) + '</dc:title><dc:description>' + backupXml(comment) + '</dc:description><dc:creator>NoteStyle</dc:creator>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + backupNow() + '</dcterms:created></cp:coreProperties>');
      add('docProps/app.xml', xml + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>NoteStyle</Application></Properties>');
      add('xl/_rels/workbook.xml.rels', xml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + rel + '/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="' + rel + '/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId3" Type="' + rel + '/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
      add('xl/workbook.xml', xml + '<workbook ' + ns + ' xmlns:r="' + rel + '"><sheets><sheet name="NoteStyle" sheetId="1" r:id="rId1"/></sheets>' +
        '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">NoteStyle!$A$1:$' + last + '$' + rowsEnd + '</definedName></definedNames></workbook>');
      add('xl/styles.xml', xml + '<styleSheet ' + ns + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
      add('xl/worksheets/sheet1.xml', xml + '<worksheet ' + ns + ' xmlns:r="' + rel + '"><dimension ref="A1:' + last + rowsEnd + '"/>' +
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="15"/><cols>' + widths + '</cols><sheetData>' + header + body + '</sheetData>' +
        '<autoFilter ref="A1:' + last + rowsEnd + '"/></worksheet>');
      add('xl/sharedStrings.xml', xml + '<sst ' + ns + ' count="' + strings.length + '" uniqueCount="' + strings.length + '">' +
        strings.map(s => '<si><t xml:space="preserve">' + backupXml(s) + '</t></si>').join('') + '</sst>');
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    async function backupExport(format) {
      if (!backupState) return;
      const items = backupExportRows(backupState.db);
      if (!items.length) return setBackupStatus('Este backup não tem notas para exportar.', true);
      try {
        const fileName = backupExportName(format);
        const comment = 'Exportado de ' + backupState.fileName + ' pelo NoteStyle em ' + new Date().toLocaleString('pt-BR');
        // "{NOTES=}" no título é o que o JWLManager procura para reconhecer uma planilha de notas.
        const blob = format === 'csv' ? backupCsv(items) : await backupXlsx(items, '{NOTES=}', comment);
        backupSaveBlob(blob, fileName);
        setBackupStatus('✅ ' + items.length.toLocaleString('pt-BR') + (items.length === 1 ? ' nota exportada' : ' notas exportadas') + ' em ' + fileName + '.', false);
      } catch (e) {
        setBackupStatus('Não consegui exportar: ' + (e && e.message ? e.message : 'erro desconhecido.'), true);
      }
    }

    document.getElementById('backupNewBtn').addEventListener('click', backupCreateNew);
    document.getElementById('backupCloseBtn').addEventListener('click', backupClose);
    document.getElementById('backupExportXlsxBtn').addEventListener('click', () => backupExport('xlsx'));
    document.getElementById('backupExportCsvBtn').addEventListener('click', () => backupExport('csv'));

    // ---------- Backup do JW Library: importar notas de outro backup ----------
    // Junta ao backup aberto as notas de outro arquivo .jwlibrary (por exemplo, um arquivo de pesquisas), escolhidas pelas
    // etiquetas. Nada do backup aberto é apagado: entram as notas que ainda não existem nele (mesmo Guid ou mesma nota no
    // mesmo lugar ficam de fora), com o lugar delas (Location), a cor e o trecho grifado da nota (UserMark e BlockRange) e
    // as etiquetas (criadas se não existirem). O outro arquivo só é lido.
    const BACKUP_SEM_ETIQUETA = '\u0000sem-etiqueta';
    let backupNovos = null; // durante a mesclagem: os ids dos itens que entram ({ notas, grifos, marcadores, respostas }), para marcá-los como novos
    let backupImport = null; // { db, fileName, notas: [{ id, tags: [...], nova }], escolhidas: Set }

    // Todas as linhas de uma consulta com parâmetros.
    function backupAll(db, sql, params) {
      const st = db.prepare(sql);
      const rows = [];
      try {
        st.bind(params || []);
        while (st.step()) rows.push(st.getAsObject());
      } finally {
        st.free();
      }
      return rows;
    }

    function backupOne(db, sql, params) {
      return backupAll(db, sql, params)[0] || null;
    }

    function backupColumns(db, table) {
      return backupRows(db, 'PRAGMA table_info(' + table + ')').map(r => r.name);
    }

    function backupCloseImport() {
      if (backupImport && backupImport.db) backupImport.db.close();
      backupImport = null;
      const box = document.getElementById('backupImportBox');
      box.textContent = '';
      box.hidden = true;
    }

    async function backupStartImport(file) {
      if (!file || !backupState) return;
      backupCloseImport();
      setBackupStatus('Lendo ' + file.name + '…', false);
      try {
        const { db } = await backupReadArchive(file);
        const notas = backupAll(db, `
          SELECT n.NoteId, n.Guid,
                 (SELECT group_concat(t.Name, '\u0001') FROM TagMap tm JOIN Tag t ON t.TagId = tm.TagId WHERE tm.NoteId = n.NoteId) AS Tags
          FROM Note n`).map(r => ({
            id: r.NoteId,
            tags: r.Tags ? r.Tags.split('\u0001') : [],
            nova: !backupOne(backupState.db, 'SELECT 1 AS x FROM Note WHERE Guid = ?', [r.Guid])
          }));
        if (!notas.length) {
          db.close();
          return setBackupStatus('Esse backup não tem notas para importar.', true);
        }
        backupImport = { db, fileName: file.name, notas, escolhidas: new Set() };
        renderBackupImport();
        setBackupStatus('', false);
      } catch (e) {
        setBackupStatus('Não consegui ler o outro backup: ' + (e && e.message ? e.message : 'arquivo inválido.'), true);
      }
    }

    // Etiquetas do outro backup, com quantas notas cada uma tem; "Sem etiqueta" para as notas sem nenhuma.
    function backupImportTags() {
      const contagem = new Map();
      backupImport.notas.forEach(n => {
        (n.tags.length ? n.tags : [BACKUP_SEM_ETIQUETA]).forEach(t => contagem.set(t, (contagem.get(t) || 0) + 1));
      });
      return [...contagem].sort((a, b) => (a[0] === BACKUP_SEM_ETIQUETA) - (b[0] === BACKUP_SEM_ETIQUETA) || a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
    }

    function backupImportSelected() {
      const marcadas = backupImport.escolhidas;
      return backupImport.notas.filter(n => (n.tags.length ? n.tags : [BACKUP_SEM_ETIQUETA]).some(t => marcadas.has(t)));
    }

    function renderBackupImport() {
      const box = document.getElementById('backupImportBox');
      box.textContent = '';
      box.hidden = false;
      const etiquetas = backupImportTags();
      if (!backupImport.escolhidas.size) etiquetas.forEach(([t]) => backupImport.escolhidas.add(t));
      const novas = backupImport.notas.filter(n => n.nova).length;

      const titulo = document.createElement('p');
      titulo.className = 'bk-import-title';
      titulo.textContent = '📥 Mesclar: importar notas de ' + backupImport.fileName;
      const resumo = document.createElement('p');
      resumo.className = 'hint';
      resumo.textContent = backupImport.notas.length.toLocaleString('pt-BR') + ' notas no arquivo · ' + novas.toLocaleString('pt-BR') +
        ' novas · ' + (backupImport.notas.length - novas).toLocaleString('pt-BR') + ' já estão no seu backup';

      const lista = document.createElement('div');
      lista.className = 'ai-sources bk-import-tags';
      const todas = document.createElement('label');
      todas.className = 'ai-check';
      const todasBox = document.createElement('input');
      todasBox.type = 'checkbox';
      todasBox.checked = etiquetas.every(([t]) => backupImport.escolhidas.has(t));
      todas.append(todasBox, ' Todas as etiquetas');
      lista.appendChild(todas);
      const caixas = etiquetas.map(([t, n]) => {
        const label = document.createElement('label');
        label.className = 'ai-check';
        const caixa = document.createElement('input');
        caixa.type = 'checkbox';
        caixa.checked = backupImport.escolhidas.has(t);
        caixa.addEventListener('change', () => {
          if (caixa.checked) backupImport.escolhidas.add(t);
          else backupImport.escolhidas.delete(t);
          todasBox.checked = etiquetas.every(([x]) => backupImport.escolhidas.has(x));
          atualizar();
        });
        label.append(caixa, ' ' + (t === BACKUP_SEM_ETIQUETA ? 'Sem etiqueta' : t) + ' (' + n.toLocaleString('pt-BR') + ')');
        lista.appendChild(label);
        return caixa;
      });
      todasBox.addEventListener('change', () => {
        etiquetas.forEach(([t], i) => {
          caixas[i].checked = todasBox.checked;
          if (todasBox.checked) backupImport.escolhidas.add(t);
          else backupImport.escolhidas.delete(t);
        });
        atualizar();
      });

      const importar = backupButton('', () => backupRunImport(), '');
      const acoes = document.createElement('div');
      acoes.className = 'bk-row';
      acoes.append(importar, backupButton('✖️ Cancelar', () => { backupCloseImport(); setBackupStatus('', false); }));
      const aviso = document.createElement('p');
      aviso.className = 'hint';
      aviso.textContent = 'As notas entram no backup aberto com a cor, o trecho grifado de cada nota e as etiquetas. Nada do seu backup é apagado; as notas que você já tem ficam de fora. Depois, gere o backup modificado.';

      function atualizar() {
        const escolhidas = backupImportSelected();
        const novasEscolhidas = escolhidas.filter(n => n.nova).length;
        importar.disabled = !novasEscolhidas;
        importar.textContent = novasEscolhidas
          ? '📥 Importar ' + novasEscolhidas.toLocaleString('pt-BR') + (novasEscolhidas === 1 ? ' nota' : ' notas')
          : escolhidas.length ? 'Essas notas já estão no seu backup' : 'Marque pelo menos uma etiqueta';
      }
      atualizar();
      box.append(titulo, resumo, lista, acoes, aviso);
      document.getElementById('backupTrocaBox').open = true;
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Os ajudantes de qualquer importação de um backup de origem (src) para o backup aberto: o mesmo lugar (Location), a mesma marca de cor
    // (UserMark e BlockRange) e a etiqueta, criados no backup aberto só se ainda não existirem.
    function backupImportContexto(src) {
      const dst = backupState.db;
      const colunasDestino = backupColumns(dst, 'Location');
      const colunasOrigem = new Set(backupColumns(src, 'Location'));
      const temEdicao = colunasDestino.includes('Specialty') && colunasOrigem.has('Specialty');
      const lugares = new Map();
      const marcas = new Map();
      const etiquetas = new Map();
      const resultado = { importadas: 0, existentes: 0, avulsas: 0, etiquetasNovas: [] };

      // O mesmo lugar (publicação, edição, documento ou capítulo da Bíblia) no backup aberto; criado se não existir.
      const lugar = idOrigem => {
        if (idOrigem === null || idOrigem === undefined) return null;
        if (lugares.has(idOrigem)) return lugares.get(idOrigem);
        const l = backupOne(src, 'SELECT * FROM Location WHERE LocationId = ?', [idOrigem]);
        let id = null;
        if (l) {
          const achado = backupOne(dst,
            'SELECT LocationId FROM Location WHERE BookNumber IS ? AND ChapterNumber IS ? AND DocumentId IS ? AND Track IS ? AND IssueTagNumber = ? AND KeySymbol IS ? AND MepsLanguage IS ? AND Type = ?' +
            (temEdicao ? " AND COALESCE(Specialty, '') = ? AND COALESCE(Edition, '') = ?" : ''),
            [l.BookNumber, l.ChapterNumber, l.DocumentId, l.Track, l.IssueTagNumber || 0, l.KeySymbol, l.MepsLanguage, l.Type]
              .concat(temEdicao ? [l.Specialty || '', l.Edition || ''] : []))
            || (l.BookNumber ? backupOne(dst, 'SELECT LocationId FROM Location WHERE BookNumber IS ? AND ChapterNumber IS ? AND KeySymbol IS ? AND MepsLanguage IS ? AND Type = ?',
              [l.BookNumber, l.ChapterNumber, l.KeySymbol, l.MepsLanguage, l.Type]) : null);
          if (achado) id = achado.LocationId;
          else {
            const colunas = colunasDestino.filter(c => c !== 'LocationId' && colunasOrigem.has(c));
            dst.run('INSERT INTO Location (' + colunas.join(', ') + ') VALUES (' + colunas.map(() => '?').join(', ') + ')', colunas.map(c => l[c]));
            id = backupLastId(dst);
          }
        }
        lugares.set(idOrigem, id);
        return id;
      };

      // A cor e o trecho grifado da nota; uma marca que já existe (mesmo Guid) é reaproveitada.
      const marca = idOrigem => {
        if (marcas.has(idOrigem)) return marcas.get(idOrigem);
        const m = backupOne(src, 'SELECT * FROM UserMark WHERE UserMarkId = ?', [idOrigem]);
        let id = null;
        if (m) {
          const existente = backupOne(dst, 'SELECT UserMarkId FROM UserMark WHERE UserMarkGuid = ?', [m.UserMarkGuid]);
          const local = existente ? null : lugar(m.LocationId);
          if (existente) id = existente.UserMarkId;
          else if (local !== null) {
            dst.run('INSERT INTO UserMark (ColorIndex, LocationId, StyleIndex, UserMarkGuid, Version) VALUES (?, ?, ?, ?, ?)',
              [m.ColorIndex, local, m.StyleIndex, m.UserMarkGuid, m.Version]);
            id = backupLastId(dst);
            backupAll(src, 'SELECT BlockType, Identifier, StartToken, EndToken FROM BlockRange WHERE UserMarkId = ?', [idOrigem]).forEach(b => {
              dst.run('INSERT INTO BlockRange (BlockType, Identifier, StartToken, EndToken, UserMarkId) VALUES (?, ?, ?, ?, ?)',
                [b.BlockType, b.Identifier, b.StartToken, b.EndToken, id]);
              if (backupNovos) backupNovos.grifos.add(backupLastId(dst));
            });
          }
        }
        marcas.set(idOrigem, id);
        return id;
      };

      const etiqueta = (tipo, nome) => {
        const chave = tipo + '|' + nome;
        if (etiquetas.has(chave)) return etiquetas.get(chave);
        const existente = backupOne(dst, 'SELECT TagId FROM Tag WHERE Type = ? AND Name = ?', [tipo, nome]);
        let id;
        if (existente) id = existente.TagId;
        else {
          dst.run('INSERT INTO Tag (Type, Name) VALUES (?, ?)', [tipo, nome]);
          id = backupLastId(dst);
          resultado.etiquetasNovas.push(nome);
        }
        etiquetas.set(chave, id);
        return id;
      };
      return { dst, lugar, marca, etiqueta, resultado };
    }

    // Copia as notas escolhidas para o backup aberto. Devolve { importadas, existentes, etiquetasNovas }.
    function backupImportNotes(src, ids) {
      const { dst, lugar, marca, etiqueta, resultado } = backupImportContexto(src);

      dst.run('BEGIN');
      try {
        for (const idNota of ids) {
          const n = backupOne(src, 'SELECT * FROM Note WHERE NoteId = ?', [idNota]);
          if (!n) continue;
          if (backupOne(dst, 'SELECT 1 AS x FROM Note WHERE Guid = ?', [n.Guid])) { resultado.existentes++; continue; }
          const local = lugar(n.LocationId);
          if (backupOne(dst, "SELECT 1 AS x FROM Note WHERE LocationId IS ? AND BlockIdentifier IS ? AND COALESCE(Title, '') = ? AND COALESCE(Content, '') = ?",
            [local, n.BlockIdentifier, n.Title || '', n.Content || ''])) { resultado.existentes++; continue; }
          const idMarca = n.UserMarkId ? marca(n.UserMarkId) : null;
          const agora = backupNow();
          dst.run('INSERT INTO Note (Guid, UserMarkId, LocationId, Title, Content, LastModified, Created, BlockType, BlockIdentifier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [n.Guid, idMarca, local, n.Title, n.Content, n.LastModified || agora, n.Created || n.LastModified || agora,
              local === null ? 0 : n.BlockType, local === null ? null : n.BlockIdentifier]);
          const novaId = backupLastId(dst);
          if (backupNovos) backupNovos.notas.add(novaId);
          backupAll(src, 'SELECT t.Type, t.Name FROM TagMap tm JOIN Tag t ON t.TagId = tm.TagId WHERE tm.NoteId = ? ORDER BY tm.Position', [n.NoteId]).forEach(t => {
            const idEtiqueta = etiqueta(t.Type, t.Name);
            const posicao = backupOne(dst, 'SELECT COALESCE(MAX(Position), -1) + 1 AS p FROM TagMap WHERE TagId = ?', [idEtiqueta]).p;
            dst.run('INSERT OR IGNORE INTO TagMap (TagId, NoteId, Position) VALUES (?, ?, ?)', [idEtiqueta, novaId, posicao]);
          });
          resultado.importadas++;
          if (local === null) resultado.avulsas++;
        }
        dst.run('COMMIT');
      } catch (e) {
        dst.run('ROLLBACK');
        throw e;
      }
      return resultado;
    }

    // Os grifos (marcas de cor com trecho grifado) do backup de origem que o backup aberto ainda não tem (mesmo UserMarkGuid). Devolve { novos }.
    function backupImportGrifos(src, aceitaLoc) {
      const { dst, marca } = backupImportContexto(src);
      const resultado = { novos: 0, existentes: 0 };
      dst.run('BEGIN');
      try {
        backupAll(src, 'SELECT u.UserMarkId, u.UserMarkGuid, u.LocationId FROM UserMark u WHERE EXISTS (SELECT 1 FROM BlockRange b WHERE b.UserMarkId = u.UserMarkId)').forEach(m => {
          if (aceitaLoc && !aceitaLoc(m.LocationId)) return;
          if (backupOne(dst, 'SELECT 1 AS x FROM UserMark WHERE UserMarkGuid = ?', [m.UserMarkGuid])) { resultado.existentes++; return; }
          if (marca(m.UserMarkId) !== null) resultado.novos++;
        });
        dst.run('COMMIT');
      } catch (e) {
        dst.run('ROLLBACK');
        throw e;
      }
      return resultado;
    }

    // Os marcadores do backup de origem que o backup aberto ainda não tem (mesmo lugar, parágrafo e título). Cada marcador novo vai para o primeiro slot livre
    // da publicação dele. Devolve { novos, existentes }.
    function backupImportMarcadores(src, aceitaLoc) {
      const { dst, lugar } = backupImportContexto(src);
      const resultado = { novos: 0, existentes: 0 };
      const colunasDestino = backupColumns(dst, 'Bookmark');
      const colunasOrigem = new Set(backupColumns(src, 'Bookmark'));
      if (!colunasDestino.length || !colunasOrigem.size) return resultado;
      dst.run('BEGIN');
      try {
        backupAll(src, 'SELECT * FROM Bookmark ORDER BY PublicationLocationId, Slot').forEach(b => {
          if (aceitaLoc && !aceitaLoc(b.LocationId)) return;
          const local = lugar(b.LocationId);
          const publicacao = lugar(b.PublicationLocationId);
          if (local === null || publicacao === null) return;
          if (backupOne(dst, "SELECT 1 AS x FROM Bookmark WHERE LocationId = ? AND PublicationLocationId = ? AND COALESCE(BlockIdentifier, -1) = COALESCE(?, -1) AND COALESCE(Title, '') = ?",
            [local, publicacao, b.BlockIdentifier === undefined ? null : b.BlockIdentifier, b.Title || ''])) { resultado.existentes++; return; }
          const ocupados = new Set(backupAll(dst, 'SELECT Slot FROM Bookmark WHERE PublicationLocationId = ?', [publicacao]).map(x => x.Slot));
          let slot = 0;
          while (ocupados.has(slot)) slot++;
          const colunas = colunasDestino.filter(col => col !== 'BookmarkId' && colunasOrigem.has(col));
          const valores = colunas.map(col => (col === 'LocationId' ? local : col === 'PublicationLocationId' ? publicacao : col === 'Slot' ? slot : b[col]));
          dst.run('INSERT INTO Bookmark (' + colunas.join(', ') + ') VALUES (' + colunas.map(() => '?').join(', ') + ')', valores);
          if (backupNovos) backupNovos.marcadores.add(backupLastId(dst));
          resultado.novos++;
        });
        dst.run('COMMIT');
      } catch (e) {
        dst.run('ROLLBACK');
        throw e;
      }
      return resultado;
    }

    // As respostas (campos "Sua resposta") do backup de origem que o backup aberto ainda não tem; se a dele estiver vazia, entra a da origem. O que tem
    // resposta nos dois fica como está no aberto. permitidos: ids "LocationId|TextTag" a trazer (null = todos). Devolve { novas, existentes }.
    function backupImportRespostas(src, permitidos) {
      const { dst, lugar } = backupImportContexto(src);
      const resultado = { novas: 0, existentes: 0 };
      if (!backupColumns(dst, 'InputField').length || !backupColumns(src, 'InputField').length) return resultado;
      dst.run('BEGIN');
      try {
        backupAll(src, 'SELECT LocationId, TextTag, Value FROM InputField').forEach(r => {
          if (permitidos && !permitidos.has(r.LocationId + '|' + r.TextTag)) return;
          if (!r.Value) return;
          const local = lugar(r.LocationId);
          if (local === null) return;
          const atual = backupOne(dst, 'SELECT Value FROM InputField WHERE LocationId = ? AND TextTag = ?', [local, r.TextTag]);
          if (!atual) {
            dst.run('INSERT INTO InputField (LocationId, TextTag, Value) VALUES (?, ?, ?)', [local, r.TextTag, r.Value]);
            if (backupNovos) backupNovos.respostas.add(local + '|' + r.TextTag);
            resultado.novas++;
          } else if (!atual.Value) {
            dst.run('UPDATE InputField SET Value = ? WHERE LocationId = ? AND TextTag = ?', [r.Value, local, r.TextTag]);
            if (backupNovos) backupNovos.respostas.add(local + '|' + r.TextTag);
            resultado.novas++;
          } else {
            resultado.existentes++;
          }
        });
        dst.run('COMMIT');
      } catch (e) {
        dst.run('ROLLBACK');
        throw e;
      }
      return resultado;
    }

    function backupRunImport() {
      if (!backupImport || !backupState) return;
      const ids = backupImportSelected().filter(n => n.nova).map(n => n.id);
      if (!ids.length) return;
      try {
        const r = backupImportNotes(backupImport.db, ids);
        backupCloseImport();
        if (r.importadas) backupMarkChanged(r.importadas);
        backupCategory = 'notas';
        backupRefresh('✅ ' + r.importadas.toLocaleString('pt-BR') + (r.importadas === 1 ? ' nota importada' : ' notas importadas') +
          (r.existentes ? ' (' + r.existentes.toLocaleString('pt-BR') + ' já estavam no seu backup)' : '') +
          (r.etiquetasNovas.length ? '. Etiquetas novas: ' + r.etiquetasNovas.join(', ') : '') +
          '. Gere o backup modificado quando terminar.');
      } catch (e) {
        setBackupStatus('Não consegui importar (nada foi alterado): ' + (e && e.message ? e.message : 'erro desconhecido.'), true);
      }
    }

    // ---------- Mesclar backups (2 a 5 arquivos) ----------
    // Um caminho curto para o que a seção "Importação e exportação" já faz: a pessoa escolhe de 2 a 5 backups (um campo de cada vez, o seguinte só aparece
    // depois do anterior) e o app junta tudo num backup só. O 1º arquivo é a base (tudo dele fica) e as notas dos outros entram nele, como em
    // backupImportNotes (cor, trecho grifado e etiquetas). Quando a MESMA nota (mesmo Guid) está em mais de um arquivo e as versões são diferentes, é uma
    // "duplicada": a pessoa escolhe qual versão vale (a mais recente, sempre a de um arquivo, ou uma a uma). No fim abre a tela de edição de sempre.
    const BACKUP_MESCLAR_MAX = 5;
    let backupMesclarArquivos = []; // [{ file, nome, notas, guids: Map(guid -> { heading, text, colorIndex, tagsText, date, lastModified, where }) }]
    let backupMesclarSlotEscolhido = -1;
    let backupMesclando = false;
    let backupMesclarBase = 0; // índice do arquivo-base (o que fica inteiro); os outros trazem notas, grifos e marcadores
    const backupMesclarRegra = { modo: 'recente', arquivo: 0 }; // modo: 'recente' | 'arquivo' | 'manual'
    const backupMesclarEscolhas = new Map(); // guid -> índice do arquivo (só no modo "uma a uma")
    const backupMesclarMarcadas = new Set(); // guids marcados na lista de duplicadas (para aplicar a várias de uma vez)
    const mesclarBox = document.getElementById('backupMesclarBox');
    const mesclarSlots = document.getElementById('backupMesclarSlots');
    const mesclarGoBtn = document.getElementById('backupMesclarGoBtn');
    const mesclarFile = document.getElementById('backupMesclarFile');
    const mesclarRegraBox = document.getElementById('backupMesclarRegra');
    const mesclarRegraArquivo = document.getElementById('backupMesclarRegraArquivo');
    const mesclarResolverBtn = document.getElementById('backupMesclarResolverBtn');
    const mesclarResolver = document.getElementById('backupMesclarResolver');

    // Esquece os arquivos, a base, as escolhas e os filtros da mesclagem.
    function backupMesclarLimparSessao() {
      backupMesclarArquivos = [];
      backupMesclarSlotEscolhido = -1;
      backupMesclarBase = 0;
      backupMesclarRegra.modo = 'recente';
      backupMesclarRegra.arquivo = 0;
      backupMesclarEscolhas.clear();
      backupMesclarMarcadas.clear();
    }

    // Fecha a área de mesclagem. Com manter (backup mesclado aberto), os arquivos e as escolhas ficam guardados para a pessoa voltar à seleção.
    function backupMesclarFechar(manter) {
      if (!manter) backupMesclarLimparSessao();
      mesclarBox.hidden = true;
      mesclarSlots.textContent = '';
      mesclarResolver.hidden = true;
      mesclarResolver.textContent = '';
      backupAtualizarBotoes();
    }

    // Depois de mesclar: volta à seleção dos arquivos, com tudo como estava (arquivos, base, regra e filtros), para mudar e mesclar de novo.
    async function backupMesclarReabrir() {
      if (backupMesclando || !backupMesclarArquivos.length) return;
      if (backupState && backupState.changes > (backupState.changesDaMescla || 0) &&
        !(await askConfirm('Você fez alterações no backup mesclado depois da mesclagem. Ao mesclar de novo, elas serão perdidas (a mesclagem recomeça dos arquivos). Voltar mesmo assim?', 'Voltar à seleção dos arquivos'))) return;
      mesclarBox.hidden = false;
      // Como se a mesclagem estivesse começando: some o conteúdo do backup mesclado e o resumo; voltam ao mesclar de novo (ou ao cancelar).
      document.getElementById('backupView').hidden = true;
      document.getElementById('backupMesclarResultado').hidden = true;
      backupAtualizarBotoes();
      backupMesclarRender();
      mesclarBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // As notas que estão em mais de um arquivo com versões diferentes (título, texto, cor ou etiquetas). Notas repetidas e iguais não são conflito.
    function backupMesclarConflitos() {
      const mapa = new Map();
      backupMesclarArquivos.forEach((arq, i) => arq.guids.forEach((v, guid) => {
        if (!mapa.has(guid)) mapa.set(guid, []);
        mapa.get(guid).push({ i, v });
      }));
      const conflitos = [];
      mapa.forEach((versoes, guid) => {
        if (versoes.length < 2) return;
        const a = versoes[0].v;
        if (versoes.some(x => x.v.heading !== a.heading || x.v.text !== a.text || x.v.colorIndex !== a.colorIndex || x.v.tagsText !== a.tagsText)) conflitos.push({ guid, versoes });
      });
      return conflitos;
    }

    // Qual arquivo vale para uma duplicada, pela regra escolhida (a mais recente é também o que vale quando a escolha não se aplica).
    function backupMesclarVencedor(conflito) {
      if (backupMesclarRegra.modo === 'arquivo') {
        const v = conflito.versoes.find(x => x.i === backupMesclarRegra.arquivo);
        if (v) return v.i;
      } else if (backupMesclarRegra.modo === 'manual') {
        const e = backupMesclarEscolhas.get(conflito.guid);
        if (e !== undefined && conflito.versoes.some(x => x.i === e)) return e;
      }
      return conflito.versoes.reduce((melhor, x) => (x.v.lastModified > melhor.v.lastModified ? x : melhor)).i;
    }

    function backupMesclarResumoNota(v) {
      const texto = (v.heading ? v.heading + (v.text ? ' — ' : '') : '') + v.text;
      return (v.date ? v.date + ' · ' : '') + (texto.length > 110 ? texto.slice(0, 110) + '…' : texto || '(nota vazia)');
    }

    function backupMesclarRotuloArquivo(i) {
      const nome = backupMesclarArquivos[i] ? backupMesclarArquivos[i].nome : '';
      return (i + 1) + 'º arquivo' + (nome ? ' (' + (nome.length > 28 ? nome.slice(0, 26) + '…' : nome) + ')' : '');
    }

    function backupMesclarRenderRegra() {
      const conflitos = backupMesclarArquivos.length >= 2 && document.getElementById('backupMesclarNotas').checked ? backupMesclarConflitos() : [];
      mesclarRegraBox.hidden = !conflitos.length;
      if (!conflitos.length) { mesclarResolver.hidden = true; return; }
      document.getElementById('backupMesclarConflitoInfo').textContent = conflitos.length.toLocaleString('pt-BR') + (conflitos.length === 1
        ? ' nota aparece em mais de um arquivo, com diferenças. Qual versão deve valer?'
        : ' notas aparecem em mais de um arquivo, com diferenças. Qual versão deve valer?');
      mesclarRegraArquivo.textContent = '';
      backupMesclarArquivos.forEach((arq, i) => mesclarRegraArquivo.add(new Option(backupMesclarRotuloArquivo(i), String(i))));
      if (backupMesclarRegra.arquivo >= backupMesclarArquivos.length) backupMesclarRegra.arquivo = 0;
      mesclarRegraArquivo.value = String(backupMesclarRegra.arquivo);
      mesclarRegraArquivo.disabled = backupMesclarRegra.modo !== 'arquivo';
      mesclarRegraBox.querySelectorAll('input[name="backupMesclarRegraModo"]').forEach(r => { r.checked = r.value === backupMesclarRegra.modo; });
      const manual = backupMesclarRegra.modo === 'manual';
      mesclarResolverBtn.hidden = !manual;
      mesclarResolverBtn.textContent = '🔍 Resolver duplicadas (' + conflitos.length.toLocaleString('pt-BR') + ')';
      if (!manual) mesclarResolver.hidden = true;
      else if (!mesclarResolver.hidden) backupMesclarRenderResolver(conflitos);
    }

    // A lista "Resolver duplicadas": uma linha por nota com as versões de cada arquivo, e ações para marcar várias de uma vez.
    function backupMesclarRenderResolver(conflitos) {
      mesclarResolver.textContent = '';
      const barra = document.createElement('div');
      barra.className = 'merge-barra';
      const todas = document.createElement('label');
      const todasCx = document.createElement('input');
      todasCx.type = 'checkbox';
      todasCx.checked = conflitos.every(c => backupMesclarMarcadas.has(c.guid));
      todas.append(todasCx, document.createTextNode(' Marcar todas'));
      const aplicar = document.createElement('div');
      aplicar.className = 'bk-row';
      const escolha = document.createElement('select');
      escolha.setAttribute('aria-label', 'Versão a usar nas notas marcadas');
      escolha.add(new Option('Usar a mais recente', 'recente'));
      backupMesclarArquivos.forEach((arq, i) => escolha.add(new Option('Usar a do ' + backupMesclarRotuloArquivo(i), String(i))));
      const aplicarBtn = backupButton('✅ Aplicar às marcadas', () => {
        const alvo = conflitos.filter(c => backupMesclarMarcadas.has(c.guid));
        if (!alvo.length) return setBackupStatus('Marque primeiro as notas a que isso se aplica.', true);
        alvo.forEach(c => {
          if (escolha.value === 'recente') backupMesclarEscolhas.set(c.guid, c.versoes.reduce((m, x) => (x.v.lastModified > m.v.lastModified ? x : m)).i);
          else if (c.versoes.some(x => x.i === Number(escolha.value))) backupMesclarEscolhas.set(c.guid, Number(escolha.value));
        });
        setBackupStatus('', false);
        backupMesclarRenderResolver(conflitos);
      }, '');
      aplicar.append(escolha, aplicarBtn);
      barra.append(todas, aplicar);
      mesclarResolver.appendChild(barra);
      todasCx.addEventListener('change', () => {
        conflitos.forEach(c => { if (todasCx.checked) backupMesclarMarcadas.add(c.guid); else backupMesclarMarcadas.delete(c.guid); });
        backupMesclarRenderResolver(conflitos);
      });

      conflitos.forEach(c => {
        const venc = backupMesclarVencedor(c);
        const cartao = document.createElement('div');
        cartao.className = 'merge-conflito';
        const topo = document.createElement('label');
        topo.className = 'merge-conflito-topo';
        const cx = document.createElement('input');
        cx.type = 'checkbox';
        cx.checked = backupMesclarMarcadas.has(c.guid);
        cx.addEventListener('change', () => {
          if (cx.checked) backupMesclarMarcadas.add(c.guid); else backupMesclarMarcadas.delete(c.guid);
          todasCx.checked = conflitos.every(x => backupMesclarMarcadas.has(x.guid));
        });
        const ref = c.versoes[0].v;
        topo.append(cx, document.createTextNode(' ' + (ref.where || ref.heading || 'Nota avulsa')));
        cartao.appendChild(topo);
        c.versoes.forEach(x => {
          const linha = document.createElement('label');
          linha.className = 'merge-versao' + (x.i === venc ? ' escolhida' : '');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'mesclar-' + c.guid;
          radio.checked = x.i === venc;
          radio.addEventListener('change', () => {
            backupMesclarEscolhas.set(c.guid, x.i);
            cartao.querySelectorAll('.merge-versao').forEach(l => l.classList.toggle('escolhida', l.contains(radio)));
          });
          const texto = document.createElement('span');
          texto.textContent = backupMesclarRotuloArquivo(x.i) + ': ' + backupMesclarResumoNota(x.v);
          linha.append(radio, texto);
          cartao.appendChild(linha);
        });
        mesclarResolver.appendChild(cartao);
      });
    }

    function backupMesclarRender() {
      mesclarSlots.textContent = '';
      const prontos = backupMesclarArquivos.length;
      // Sempre dois campos; depois de cada arquivo adicionado aparece o próximo, até 5.
      const visiveis = Math.min(BACKUP_MESCLAR_MAX, Math.max(2, prontos + 1));
      for (let i = 0; i < visiveis; i++) {
        const arq = backupMesclarArquivos[i];
        const slot = document.createElement('div');
        slot.className = 'merge-slot' + (arq ? ' pronto' : '');
        const rotulo = document.createElement('span');
        rotulo.className = 'merge-slot-rotulo';
        rotulo.textContent = (i + 1) + 'º arquivo' + (i === backupMesclarBase ? ' — BASE ⭐' : i >= 2 ? ' (opcional)' : '');
        const cab = document.createElement('div');
        cab.className = 'merge-slot-cab';
        cab.appendChild(rotulo);
        slot.appendChild(cab);
        if (arq) {
          // O 4º botão (só nos arquivos que não são a base), abaixo dos outros: escolher o que importar deste arquivo (por publicação e artigo, notas e respostas).
          const marca = () => '☑️ Selecionar o que importar';
          let selecionar = null;
          if (i !== backupMesclarBase && (arq.listaNotas.length || arq.listaRespostas.length || arq.folhas.size)) {
            selecionar = backupButton(marca(), () => { arq.filtroAberto = !arq.filtroAberto; backupMesclarRender(); }, 'merge-selecionar');
            selecionar.title = 'Escolher quais publicações, artigos, notas e respostas deste arquivo entram na mesclagem';
          }
          const nome = document.createElement('span');
          nome.className = 'merge-slot-nome';
          nome.textContent = '✅ ' + arq.nome + (arq.aberto ? ' (o backup que estava aberto)' : '');
          // O que há no arquivo, numa linha só: notas / respostas / grifos / marcadores.
          let grifosArq = 0;
          let marcadoresArq = 0;
          arq.folhas.forEach(x => { grifosArq += x.grifos; marcadoresArq += x.marcadores; });
          const plural = (n, um, varios) => n.toLocaleString('pt-BR') + ' ' + (n === 1 ? um : varios);
          const contagem = document.createElement('span');
          contagem.className = 'merge-slot-contagem';
          contagem.textContent = [plural(arq.notas, 'nota', 'notas'), plural(arq.listaRespostas.length, 'resposta', 'respostas'), plural(grifosArq, 'grifo', 'grifos'), plural(marcadoresArq, 'marcador', 'marcadores')].join(' / ');
          const info = document.createElement('div');
          info.append(nome, contagem);
          const acoes = document.createElement('div');
          acoes.className = 'bk-row';
          if (i !== backupMesclarBase) acoes.append(backupButton('⭐ Usar como arquivo base', () => { backupMesclarBase = i; backupMesclarRender(); }));
          acoes.append(
            backupButton('🔁 Trocar', () => { backupMesclarSlotEscolhido = i; mesclarFile.click(); }),
            backupButton('✖️ Remover', () => {
              backupMesclarArquivos.splice(i, 1);
              if (i < backupMesclarBase) backupMesclarBase--;
              else if (i === backupMesclarBase) backupMesclarBase = 0;
              backupMesclarEscolhas.clear();
              backupMesclarMarcadas.clear();
              backupMesclarRender();
            })
          );
          slot.append(info, acoes);
          if (selecionar) {
            slot.appendChild(selecionar);
            if (arq.filtroAberto) slot.appendChild(backupMesclarFiltroPainel(arq, () => { selecionar.textContent = marca(); }));
          }
        } else if (i === prontos) {
          slot.appendChild(backupButton(i >= 2 ? '➕ Adicionar o ' + (i + 1) + 'º arquivo (.jwlibrary)' : '📂 Escolher o ' + (i + 1) + 'º arquivo (.jwlibrary)', () => { backupMesclarSlotEscolhido = i; mesclarFile.click(); }, ''));
        } else {
          const espera = document.createElement('span');
          espera.className = 'merge-slot-nome hint';
          espera.textContent = 'Escolha antes o ' + i + 'º arquivo.';
          slot.appendChild(espera);
        }
        mesclarSlots.appendChild(slot);
      }
      backupMesclarRenderRegra();
      mesclarGoBtn.disabled = backupMesclando || prontos < 2;
    }

    // Lê o arquivo só para conferir que é um backup e guardar um resumo das notas (o arquivo é lido de novo na hora de mesclar).
    // O que a mesclagem precisa saber de um backup: as notas pelo Guid (para achar duplicadas), as etiquetas e a árvore de publicações e artigos (tipo, publicação, edição e
    // artigo, como em backupDescribe), com quantas notas, respostas, grifos e marcadores há em cada artigo (uma "folha"). Serve para escolher o que importar.
    // O filtro dele (nada excluído = traz tudo) fica em arq.filtro.
    const BACKUP_FOLHA_AVULSAS = 'Notas avulsas';

    function backupMesclarResumoFonte(db, data) {
      const linhas = backupAll(db, "SELECT n.NoteId, n.Guid, n.LastModified, (SELECT group_concat(t.Name, '\u0001') FROM TagMap tm JOIN Tag t ON t.TagId = tm.TagId WHERE tm.NoteId = n.NoteId) AS Tags FROM Note n");
      const brutas = new Map(linhas.map(r => [r.NoteId, r]));
      const guids = new Map();
      data.notas.forEach(n => {
        const b = brutas.get(n.id);
        if (!b) return;
        guids.set(b.Guid, { heading: n.heading, text: n.text, colorIndex: n.colorIndex, tagsText: n.tagsText, date: n.date, lastModified: String(b.LastModified || ''), where: n.where || '' });
      });
      const tags = new Map();
      let semTag = 0;
      linhas.forEach(r => {
        if (!r.Tags) { semTag++; return; }
        new Set(r.Tags.split('\u0001')).forEach(nome => tags.set(nome, (tags.get(nome) || 0) + 1));
      });

      // Cada lugar (Location) cai numa folha da árvore: tipo > publicação > edição > artigo (ou "Notas avulsas", para notas sem lugar).
      const titleByDoc = new Map(backupAll(db, "SELECT KeySymbol, IssueTagNumber, DocumentId, Title FROM Location WHERE Title IS NOT NULL AND Title != '' AND DocumentId IS NOT NULL")
        .map(r => [r.KeySymbol + '|' + r.IssueTagNumber + '|' + r.DocumentId, r.Title]));
      const folhas = new Map(); // chave -> { chave, caminho, notas, respostas, grifos, marcadores }
      const locFolha = new Map(); // LocationId -> chave
      const folha = niveis => {
        const caminho = niveis.map(x => x.label);
        const chave = caminho.join(' › ');
        if (!folhas.has(chave)) folhas.set(chave, { chave, caminho, niveis, notas: 0, respostas: 0, grifos: 0, marcadores: 0 });
        return folhas.get(chave);
      };
      backupAll(db, 'SELECT LocationId, KeySymbol, MepsLanguage, IssueTagNumber, DocumentId, BookNumber, ChapterNumber, Title AS LocTitle FROM Location').forEach(l => {
        const d = backupDescribe(l, titleByDoc);
        locFolha.set(l.LocationId, folha([d.type, d.title, d.detail1, d.detail2].filter(Boolean)).chave);
      });
      const folhaDoLugar = id => (id === null || id === undefined ? folha([{ label: BACKUP_FOLHA_AVULSAS, key: null, desc: false }]).chave : locFolha.get(id) || '');
      const contar = (sql, campo) => backupAll(db, sql).forEach(r => { const c = folhaDoLugar(r.LocationId); if (c) folhas.get(c)[campo] += r.n; });
      contar('SELECT LocationId, COUNT(*) AS n FROM Note GROUP BY LocationId', 'notas');
      contar("SELECT LocationId, COUNT(*) AS n FROM InputField WHERE Value IS NOT NULL AND Value != '' GROUP BY LocationId", 'respostas');
      contar('SELECT u.LocationId AS LocationId, COUNT(*) AS n FROM UserMark u WHERE EXISTS (SELECT 1 FROM BlockRange b WHERE b.UserMarkId = u.UserMarkId) GROUP BY u.LocationId', 'grifos');
      contar('SELECT LocationId, COUNT(*) AS n FROM Bookmark GROUP BY LocationId', 'marcadores');
      [...folhas.values()].forEach(x => { if (!x.notas && !x.respostas && !x.grifos && !x.marcadores) folhas.delete(x.chave); });

      const listaNotas = data.notas.map(n => {
        const b = brutas.get(n.id);
        return b ? { guid: b.Guid, titulo: n.heading, texto: n.text, data: n.date, onde: n.where || '', tags: b.Tags || '', folha: folhaDoLugar(n.locationId) } : null;
      }).filter(Boolean);
      const listaRespostas = data.respostas.filter(r => String(r.text || '').trim()).map(r => ({ id: r.id, texto: r.text, onde: r.where || '', publicacao: (r.title && r.title.label) || '', folha: folhaDoLugar(r.locationId) }));
      return {
        notas: linhas.length, guids, tags, semTag, folhas, locFolha, listaNotas, listaRespostas,
        tagsPorGuid: new Map(linhas.map(r => [r.Guid, r.Tags || ''])), folhaPorGuid: new Map(listaNotas.map(x => [x.guid, x.folha])),
        filtro: { tagsFora: new Set(), semTagFora: false, notasFora: new Set(), respostasFora: new Set(), folhasFora: new Set(), tocou: { arvore: false, tags: false, notas: false, respostas: false } }
      };
    }

    // As escolhas do que importar se SOMAM: uma lista só passa a valer depois que a pessoa mexe nela, e o que estiver marcado em qualquer lista que valha é importado
    // (uma lista não anula a outra). Para cada tipo de item só contam as listas que o alcançam: notas (árvore, etiquetas e notas uma a uma), respostas (árvore e respostas
    // uma a uma), grifos e marcadores (só a árvore). Sem lista alguma mexida, tudo é importado.
    const backupMesclarFiltroAtivo = arq => Object.values(arq.filtro.tocou).some(Boolean);

    // Uma nota passa pelo filtro se não tem etiqueta e "sem etiqueta" está marcado, ou se tem alguma etiqueta marcada.
    function backupMesclarTagsPassam(filtro, tagsTexto) {
      if (!tagsTexto) return !filtro.semTagFora;
      return tagsTexto.split('\u0001').some(nome => !filtro.tagsFora.has(nome));
    }

    function backupMesclarNotaPassa(arq, guid) {
      const f = arq.filtro;
      const listas = [];
      if (f.tocou.arvore) listas.push(!f.folhasFora.has(arq.folhaPorGuid.get(guid) || ''));
      if (f.tocou.tags) listas.push(backupMesclarTagsPassam(f, arq.tagsPorGuid.get(guid) || ''));
      if (f.tocou.notas) listas.push(!f.notasFora.has(guid));
      return listas.length ? listas.some(Boolean) : true;
    }

    function backupMesclarRespostaPassa(arq, r) {
      const f = arq.filtro;
      const listas = [];
      if (f.tocou.arvore) listas.push(!f.folhasFora.has(r.folha));
      if (f.tocou.respostas) listas.push(!f.respostasFora.has(r.id));
      return listas.length ? listas.some(Boolean) : true;
    }

    // Grifos e marcadores passam pelo lugar (o artigo em que estão), se a árvore foi mexida.
    const backupMesclarLugarPassa = (arq, locationId) => !arq.filtro.tocou.arvore || !arq.filtro.folhasFora.has(arq.locFolha.get(locationId) || '');
    const backupMesclarSemAcento = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // A árvore "Por publicação e artigo": tipo > publicação > edição > artigo, cada nível com a sua caixa (marca ou desmarca tudo o que há embaixo: notas, respostas, grifos e
    // marcadores) e um botão para abrir. Com texto na busca, vira uma lista dos artigos que combinam.
    function backupMesclarArvore(arq, atualizar) {
      const f = arq.filtro;
      const n = v => v.toLocaleString('pt-BR');
      const raiz = { nome: '', filhos: new Map(), folhas: null };
      [...arq.folhas.values()].forEach(x => {
        let no = raiz;
        x.niveis.forEach(nivel => {
          if (!no.filhos.has(nivel.label)) no.filhos.set(nivel.label, { nome: nivel.label, key: nivel.key, desc: nivel.desc, filhos: new Map(), folhas: null });
          no = no.filhos.get(nivel.label);
        });
        no.folha = x;
      });
      // Do mais novo para o mais antigo quando o nível tem data (as edições), na ordem do app nos outros (livros da Bíblia, capítulos, artigos), senão alfabética.
      const ordenarNos = (x, y) => {
        const temChave = x.key !== null && x.key !== undefined && y.key !== null && y.key !== undefined;
        if (temChave && x.key !== y.key) return x.desc ? y.key - x.key : x.key - y.key;
        return x.nome.localeCompare(y.nome, 'pt-BR', { numeric: true });
      };
      const todasDe = no => {
        if (!no.folhas) {
          no.folhas = no.folha ? [no.folha.chave] : [];
          no.filhos.forEach(filho => no.folhas.push(...todasDe(filho)));
        }
        return no.folhas;
      };
      const itensDe = no => todasDe(no).reduce((s, chave) => { const x = arq.folhas.get(chave); return s + x.notas + x.respostas + x.grifos + x.marcadores; }, 0);

      const det = document.createElement('details');
      det.className = 'merge-filtro-det';
      const sum = document.createElement('summary');
      sum.textContent = '📚 Por publicação e artigo (' + n(arq.folhas.size) + ')';
      const corpo = document.createElement('div');
      const barra = document.createElement('div');
      barra.className = 'merge-filtro-cab';
      const campo = document.createElement('input');
      campo.type = 'search';
      campo.placeholder = 'Buscar publicação ou artigo…';
      campo.className = 'merge-filtro-busca';
      const dica = document.createElement('p');
      dica.className = 'hint';
      dica.textContent = 'Marcar ou desmarcar uma publicação, uma edição ou um artigo vale para tudo o que há nele: notas, respostas, grifos e marcadores.';
      const area = document.createElement('div');
      area.className = 'merge-arvore';
      const caixas = []; // { no, cx } dos nós desenhados, para refletir as mudanças
      let listadas = [...arq.folhas.keys()];

      const definir = (chaves, marcado) => { f.tocou.arvore = true; chaves.forEach(chave => (marcado ? f.folhasFora.delete(chave) : f.folhasFora.add(chave))); };
      const refletir = () => caixas.forEach(({ no, cx }) => {
        const chaves = todasDe(no);
        const fora = chaves.filter(chave => f.folhasFora.has(chave)).length;
        cx.checked = fora === 0;
        cx.indeterminate = fora > 0 && fora < chaves.length;
      });
      const noUI = (no, nivel) => {
        const caixa = document.createElement('div');
        caixa.className = 'merge-no';
        const cab = document.createElement('div');
        cab.className = 'merge-no-cab';
        const abre = document.createElement('button');
        abre.type = 'button';
        abre.className = 'merge-no-abre';
        const filhos = document.createElement('div');
        filhos.className = 'merge-no-filhos';
        filhos.hidden = true;
        const temFilhos = no.filhos.size > 0;
        abre.textContent = temFilhos ? '▸' : '';
        abre.disabled = !temFilhos;
        const rotulo = document.createElement('label');
        const cx = document.createElement('input');
        cx.type = 'checkbox';
        cx.addEventListener('change', () => { definir(todasDe(no), cx.checked); refletir(); atualizar(); });
        const texto = document.createElement('span');
        texto.textContent = no.nome + ' · ' + n(itensDe(no));
        rotulo.append(cx, texto);
        cab.append(abre, rotulo);
        caixa.append(cab, filhos);
        caixas.push({ no, cx });
        abre.addEventListener('click', () => {
          filhos.hidden = !filhos.hidden;
          abre.textContent = filhos.hidden ? '▸' : '▾';
          if (!filhos.hidden && !filhos.childElementCount) {
            // os mais novos primeiro nas edições e nos artigos que são números (ex.: 2026-08), senão em ordem alfabética
            [...no.filhos.values()].sort(ordenarNos).forEach(filho => filhos.appendChild(noUI(filho, nivel + 1)));
            refletir();
          }
        });
        return caixa;
      };
      const desenhar = () => {
        area.textContent = '';
        caixas.length = 0;
        const termo = backupMesclarSemAcento(campo.value.trim());
        if (!termo) {
          listadas = [...arq.folhas.keys()];
          [...raiz.filhos.values()].sort(ordenarNos).forEach(no => area.appendChild(noUI(no, 0)));
          refletir();
          return;
        }
        listadas = [...arq.folhas.values()].filter(x => backupMesclarSemAcento(x.caminho.join(' ')).includes(termo)).map(x => x.chave);
        listadas.slice(0, 100).forEach(chave => {
          const x = arq.folhas.get(chave);
          const rotulo = document.createElement('label');
          rotulo.className = 'merge-linha';
          const cx = document.createElement('input');
          cx.type = 'checkbox';
          cx.checked = !f.folhasFora.has(chave);
          cx.addEventListener('change', () => { definir([chave], cx.checked); atualizar(); });
          const texto = document.createElement('span');
          const forte = document.createElement('strong');
          forte.textContent = x.caminho[x.caminho.length - 1];
          texto.append(forte, document.createTextNode(' ' + x.caminho.slice(0, -1).join(' › ') + ' · ' + n(x.notas + x.respostas + x.grifos + x.marcadores)));
          rotulo.append(cx, texto);
          area.appendChild(rotulo);
        });
        if (listadas.length > 100) { const mais = document.createElement('p'); mais.className = 'hint'; mais.textContent = 'Mostrando 100 de ' + n(listadas.length) + '; refine a busca.'; area.appendChild(mais); }
      };
      const marcar = valor => { definir(listadas, valor); desenhar(); atualizar(); };
      campo.addEventListener('input', desenhar);
      barra.append(campo, backupButton('marcar todas', () => marcar(true), 'merge-mini'), backupButton('desmarcar todas', () => marcar(false), 'merge-mini'));
      corpo.append(barra, dica, area);
      det.append(sum, corpo);
      desenhar();
      return det;
    }

    // O painel (aberto pelo botão "☑️ Selecionar o que importar" de cada arquivo que não é a base) para escolher o que importar: por publicação e artigo (tudo o que há neles), as notas
    // por etiqueta ou uma a uma e as respostas uma a uma. As listas se somam (veja backupMesclarNotaPassa).
    function backupMesclarFiltroPainel(arq, atualizarMarca) {
      const f = arq.filtro;
      const n = v => v.toLocaleString('pt-BR');
      const painel = document.createElement('div');
      painel.className = 'merge-filtro';
      // O que vai entrar, como numa planilha: uma linha por tipo (quanto entra e quanto há no arquivo) e o total embaixo.
      const tabela = document.createElement('table');
      tabela.className = 'merge-tabela';
      const cabecalho = tabela.createTHead().insertRow();
      ['', 'Vai entrar', 'No arquivo'].forEach(texto => { const th = document.createElement('th'); th.textContent = texto; cabecalho.appendChild(th); });
      const corpoTabela = tabela.createTBody();
      const linhasTabela = {};
      [['notas', '📝 Notas', 'backupMesclarNotas'], ['respostas', '✍️ Respostas', 'backupMesclarRespostas'], ['grifos', '🖍️ Grifos', 'backupMesclarGrifos'], ['marcadores', '🔖 Marcadores', 'backupMesclarMarcadores']]
        .forEach(([chave, rotulo, idCaixa]) => {
          const tr = corpoTabela.insertRow();
          tr.insertCell().textContent = rotulo;
          linhasTabela[chave] = { tr, entra: tr.insertCell(), total: tr.insertCell(), idCaixa };
        });
      const rodape = tabela.createTFoot().insertRow();
      rodape.insertCell().textContent = 'Σ Total';
      const somaEntra = rodape.insertCell();
      const somaTotal = rodape.insertCell();
      const atualizar = () => {
        const notas = arq.listaNotas.filter(x => backupMesclarNotaPassa(arq, x.guid)).length;
        const respostas = arq.listaRespostas.filter(x => backupMesclarRespostaPassa(arq, x)).length;
        let grifos = 0;
        let grifosTotal = 0;
        let marcadores = 0;
        let marcadoresTotal = 0;
        arq.folhas.forEach(x => {
          grifosTotal += x.grifos;
          marcadoresTotal += x.marcadores;
          if (!f.tocou.arvore || !f.folhasFora.has(x.chave)) { grifos += x.grifos; marcadores += x.marcadores; }
        });
        const valores = { notas: [notas, arq.listaNotas.length], respostas: [respostas, arq.listaRespostas.length], grifos: [grifos, grifosTotal], marcadores: [marcadores, marcadoresTotal] };
        let entra = 0;
        let total = 0;
        Object.entries(linhasTabela).forEach(([chave, l]) => {
          const ligado = document.getElementById(l.idCaixa).checked; // as caixas "O que será mesclado" do topo
          l.tr.classList.toggle('fora', !ligado);
          l.entra.textContent = ligado ? n(valores[chave][0]) : '—';
          l.total.textContent = n(valores[chave][1]);
          if (ligado) entra += valores[chave][0];
          total += valores[chave][1];
        });
        somaEntra.textContent = n(entra);
        somaTotal.textContent = n(total);
        atualizarMarca();
      };
      painel.appendChild(tabela);
      // Dois botões gerais: importar tudo (limpa a seleção) e desmarcar tudo (nada entra até a pessoa marcar o que quer).
      const geral = document.createElement('div');
      geral.className = 'bk-row merge-geral';
      geral.append(
        backupButton('✅ Importar tudo', () => {
          f.tagsFora.clear(); f.semTagFora = false; f.notasFora.clear(); f.respostasFora.clear(); f.folhasFora.clear();
          f.tocou.arvore = false; f.tocou.tags = false; f.tocou.notas = false; f.tocou.respostas = false;
          backupMesclarRender();
        }, 'merge-geral-btn'),
        backupButton('⬜ Desmarcar tudo', () => {
          arq.tags.forEach((qtd, nome) => f.tagsFora.add(nome));
          f.semTagFora = true;
          arq.listaNotas.forEach(x => f.notasFora.add(x.guid));
          arq.listaRespostas.forEach(x => f.respostasFora.add(x.id));
          arq.folhas.forEach((x, chave) => f.folhasFora.add(chave));
          f.tocou.arvore = true; f.tocou.tags = true; f.tocou.notas = true; f.tocou.respostas = true;
          backupMesclarRender();
        }, 'merge-geral-btn')
      );
      painel.appendChild(geral);
      painel.appendChild(backupMesclarArvore(arq, atualizar));

      // Uma seção recolhível; com busca (itens uma a uma) ou sem (grupos curtos).
      const secao = (titulo, itens, { busca = false, linhas = false } = {}) => {
        if (!itens.length) return;
        const det = document.createElement('details');
        det.className = 'merge-filtro-det';
        const sum = document.createElement('summary');
        sum.textContent = titulo + ' (' + n(itens.length) + ')';
        const corpo = document.createElement('div');
        const barra = document.createElement('div');
        barra.className = 'merge-filtro-cab';
        const campo = document.createElement('input');
        campo.type = 'search';
        campo.placeholder = 'Buscar…';
        campo.className = 'merge-filtro-busca';
        campo.hidden = !busca;
        const info = document.createElement('span');
        info.className = 'hint';
        const lista = document.createElement('div');
        lista.className = linhas ? 'merge-filtro-linhas' : 'merge-filtro-lista';
        let listadas = itens;
        const LIMITE = 100;
        const desenhar = () => {
          const termo = backupMesclarSemAcento(campo.value.trim());
          listadas = termo ? itens.filter(it => it.busca.includes(termo)) : itens;
          lista.textContent = '';
          listadas.slice(0, LIMITE).forEach(it => {
            const rotulo = document.createElement('label');
            rotulo.className = linhas ? 'merge-linha' : 'merge-check';
            const cx = document.createElement('input');
            cx.type = 'checkbox';
            cx.checked = it.marcado();
            cx.addEventListener('change', () => { it.definir(cx.checked); atualizar(); });
            const texto = document.createElement('span');
            if (linhas) {
              const forte = document.createElement('strong');
              forte.textContent = it.rotulo;
              texto.append(forte, document.createTextNode(it.sub ? ' ' + it.sub : ''));
            } else {
              texto.textContent = it.rotulo + ' · ' + it.n;
            }
            rotulo.append(cx, texto);
            lista.appendChild(rotulo);
          });
          info.textContent = busca ? n(listadas.length) + (listadas.length === 1 ? ' listada' : ' listadas') + (listadas.length > LIMITE ? ' (mostrando as ' + LIMITE + ' primeiras; refine a busca)' : '') : '';
        };
        const marcar = valor => { listadas.forEach(it => it.definir(valor)); desenhar(); atualizar(); };
        campo.addEventListener('input', desenhar);
        barra.append(campo, backupButton(busca ? 'marcar listadas' : 'todas', () => marcar(true), 'merge-mini'), backupButton(busca ? 'desmarcar listadas' : 'nenhuma', () => marcar(false), 'merge-mini'));
        corpo.append(barra, info, lista);
        det.append(sum, corpo);
        painel.appendChild(det);
        desenhar();
      };
      const resumoTexto = (x, max) => { const t = (x || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max) + '…' : t; };
      const chaveOrdem = nome => nome.replace(/^[^\p{L}\p{N}]+/u, '');

      const itensTags = [...arq.tags.entries()].sort((x, y) => chaveOrdem(x[0]).localeCompare(chaveOrdem(y[0]), 'pt-BR'))
        .map(([nome, qtd]) => ({ rotulo: nome, n: qtd, busca: backupMesclarSemAcento(nome), marcado: () => !f.tagsFora.has(nome), definir: v => { f.tocou.tags = true; if (v) f.tagsFora.delete(nome); else f.tagsFora.add(nome); } }));
      if (arq.semTag) itensTags.push({ rotulo: '(sem etiqueta)', n: arq.semTag, busca: 'sem etiqueta', marcado: () => !f.semTagFora, definir: v => { f.tocou.tags = true; f.semTagFora = !v; } });
      secao('🏷️ Notas por etiqueta', itensTags);
      secao('📝 Notas, uma a uma', arq.listaNotas.map(x => ({
        rotulo: x.titulo || resumoTexto(x.texto, 40) || '(nota vazia)', sub: [x.data, x.onde, x.titulo ? resumoTexto(x.texto, 60) : ''].filter(Boolean).join(' · '),
        busca: backupMesclarSemAcento([x.titulo, x.texto, x.onde, x.tags.replace(/\u0001/g, ' ')].join(' ')),
        marcado: () => !f.notasFora.has(x.guid), definir: v => { f.tocou.notas = true; if (v) f.notasFora.delete(x.guid); else f.notasFora.add(x.guid); }
      })), { busca: true, linhas: true });
      secao('✍️ Respostas, uma a uma', arq.listaRespostas.map(x => ({
        rotulo: x.publicacao || 'Resposta', sub: [x.onde, resumoTexto(x.texto, 70)].filter(Boolean).join(' · '), busca: backupMesclarSemAcento([x.publicacao, x.onde, x.texto].join(' ')),
        marcado: () => !f.respostasFora.has(x.id), definir: v => { f.tocou.respostas = true; if (v) f.respostasFora.delete(x.id); else f.respostasFora.add(x.id); }
      })), { busca: true, linhas: true });
      atualizar();
      return painel;
    }

    // Abre uma fonte da mesclagem: o arquivo escolhido ou o backup que estava aberto (uma cópia do banco, com as alterações já feitas nele).
    async function backupMesclarAbrirFonte(arq) {
      if (arq.file) return backupReadArchive(arq.file);
      const [{ SQL }] = await Promise.all([loadBackupLibs()]);
      return { zip: arq.zip, manifest: arq.manifest, db: new SQL.Database(arq.bytes) };
    }

    // "Escolher o outro backup", em Importação e exportação de um backup aberto: leva à mesclagem de sempre, com o backup aberto como o 1º arquivo (e base),
    // e já abre a escolha do 2º arquivo.
    function backupMesclarAPartirDoAberto() {
      const st = backupState;
      if (!st) return;
      backupMesclarArquivos = [{ file: null, aberto: true, zip: st.zip, manifest: st.manifest, bytes: st.db.export(), nome: st.isNew ? 'Backup novo (aberto)' : st.fileName, ...backupMesclarResumoFonte(st.db, st.data) }];
      backupMesclarBase = 0;
      backupMesclarEscolhas.clear();
      backupMesclarMarcadas.clear();
      backupMesclarRegra.modo = 'recente';
      backupMesclarRegra.arquivo = 0;
      mesclarBox.hidden = false;
      backupAtualizarBotoes();
      backupMesclarRender();
      mesclarBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      backupMesclarSlotEscolhido = 1;
      mesclarFile.click();
    }

    async function backupMesclarAdicionar(file, indice) {
      if (!file) return;
      if (backupMesclarArquivos.some((a, k) => k !== indice && a.file && a.nome === file.name && a.file.size === file.size)) {
        return setBackupStatus('Esse arquivo já está na lista de arquivos a mesclar.', true);
      }
      setBackupStatus('Lendo ' + file.name + '…', false);
      try {
        const { db } = await backupReadArchive(file);
        let arq;
        try {
          arq = { file, nome: file.name, ...backupMesclarResumoFonte(db, readBackupData(db)) };
        } finally {
          db.close();
        }
        if (indice >= 0 && indice < backupMesclarArquivos.length) backupMesclarArquivos[indice] = arq;
        else backupMesclarArquivos.push(arq);
        backupMesclarEscolhas.clear();
        backupMesclarMarcadas.clear();
        setBackupStatus('', false);
      } catch (e) {
        setBackupStatus('Não consegui ler ' + file.name + ': ' + (e && e.message ? e.message : 'arquivo inválido.'), true);
      }
      backupMesclarRender();
    }

    async function backupMesclarExecutar() {
      if (backupMesclando || backupMesclarArquivos.length < 2) return;
      // Se o backup aberto é um dos arquivos da mesclagem, as alterações dele entram junto; senão, seriam perdidas.
      if (backupState && backupState.changes > (backupState.changesDaMescla || 0) && !(!backupState.mesclado && backupMesclarArquivos.some(a => a.aberto)) &&
        !(await askConfirm('As alterações do backup que está aberto ainda não foram gravadas em arquivo e serão perdidas. Mesclar mesmo assim?', 'Mesclar backups'))) return;
      backupMesclando = true;
      mesclarGoBtn.disabled = true;
      const arquivos = backupMesclarArquivos.slice();
      const base = Math.min(backupMesclarBase, arquivos.length - 1);
      const comGrifos = document.getElementById('backupMesclarGrifos').checked;
      const comMarcadores = document.getElementById('backupMesclarMarcadores').checked;
      const comNotas = document.getElementById('backupMesclarNotas').checked;
      const comRespostas = document.getElementById('backupMesclarRespostas').checked;
      // Para cada duplicada, o arquivo que vale (decidido antes de abrir qualquer coisa).
      const vencedores = new Map(comNotas ? backupMesclarConflitos().map(c => [c.guid, backupMesclarVencedor(c)]) : []);
      const anterior = backupState;
      let novo = null;
      // Uma duplicada cuja versão vencedora é de um arquivo em que o filtro deixou a nota de fora fica com a da base (senão a nota se perderia).
      vencedores.forEach((i, guid) => { if (i !== base && !backupMesclarNotaPassa(arquivos[i], guid)) vencedores.set(guid, base); });
      const total = { importadas: 0, existentes: 0, avulsas: 0, etiquetas: [], trocadas: 0, grifos: 0, marcadores: 0, respostas: 0, grifosExist: 0, marcadoresExist: 0, respostasExist: 0 };
      backupNovos = { notas: new Set(), grifos: new Set(), marcadores: new Set(), respostas: new Set() };
      try {
        setBackupStatus('Abrindo o arquivo-base (' + arquivos[base].nome + ')…', false);
        const aberta = await backupMesclarAbrirFonte(arquivos[base]);
        novo = { zip: aberta.zip, db: aberta.db, manifest: aberta.manifest, fileName: 'Backup_mesclado.jwlibrary', data: null, changes: 0, generated: null, mesclado: arquivos.length, baseNome: arquivos[base].nome };
        backupState = novo; // as importações copiam para o backup aberto
        // Duplicada cuja versão vencedora não é a da base: a nota sai da base e entra a do arquivo vencedor.
        vencedores.forEach((i, guid) => {
          if (i === base) return;
          const n = backupOne(aberta.db, 'SELECT NoteId, UserMarkId FROM Note WHERE Guid = ?', [guid]);
          if (!n) return;
          aberta.db.run('DELETE FROM TagMap WHERE NoteId = ?', [n.NoteId]);
          aberta.db.run('DELETE FROM Note WHERE NoteId = ?', [n.NoteId]);
          if (n.UserMarkId) {
            aberta.db.run('DELETE FROM UserMark WHERE UserMarkId = ? AND NOT EXISTS (SELECT 1 FROM BlockRange WHERE UserMarkId = ?) AND NOT EXISTS (SELECT 1 FROM Note WHERE UserMarkId = ?)',
              [n.UserMarkId, n.UserMarkId, n.UserMarkId]);
          }
          total.trocadas++;
        });
        let feitos = 0;
        for (let i = 0; i < arquivos.length; i++) {
          if (i === base) continue;
          feitos++;
          setBackupStatus('Mesclando o arquivo ' + (i + 1) + ' (' + arquivos[i].nome + '), ' + feitos + ' de ' + (arquivos.length - 1) + '…', false);
          const outro = await backupMesclarAbrirFonte(arquivos[i]);
          try {
            // Notas: só entram as que não são duplicadas ou cuja versão vale (a do arquivo i).
            const ids = !comNotas ? [] : backupAll(outro.db, "SELECT n.NoteId, n.Guid, (SELECT group_concat(t.Name, '\u0001') FROM TagMap tm JOIN Tag t ON t.TagId = tm.TagId WHERE tm.NoteId = n.NoteId) AS Tags FROM Note n")
              .filter(r => (!vencedores.has(r.Guid) || vencedores.get(r.Guid) === i) && backupMesclarNotaPassa(arquivos[i], r.Guid)).map(r => r.NoteId);
            const r = comNotas ? backupImportNotes(outro.db, ids) : { importadas: 0, existentes: 0, avulsas: 0, etiquetasNovas: [] };
            total.importadas += r.importadas;
            total.existentes += r.existentes;
            total.avulsas += r.avulsas;
            r.etiquetasNovas.forEach(e => { if (!total.etiquetas.includes(e)) total.etiquetas.push(e); });
            if (comRespostas) {
              const permitidos = new Set(arquivos[i].listaRespostas.filter(x => backupMesclarRespostaPassa(arquivos[i], x)).map(x => x.id));
              const rr = backupImportRespostas(outro.db, permitidos);
              total.respostas += rr.novas;
              total.respostasExist += rr.existentes;
            }
            if (comGrifos) {
              const g = backupImportGrifos(outro.db, loc => backupMesclarLugarPassa(arquivos[i], loc));
              total.grifos += g.novos;
              total.grifosExist += g.existentes;
            }
            if (comMarcadores) {
              const m = backupImportMarcadores(outro.db, loc => backupMesclarLugarPassa(arquivos[i], loc));
              total.marcadores += m.novos;
              total.marcadoresExist += m.existentes;
            }
          } finally {
            outro.db.close();
          }
        }
      } catch (e) {
        backupNovos = null;
        if (novo && novo.db) novo.db.close();
        backupState = anterior; // nada foi alterado no que estava aberto
        backupMesclando = false;
        backupMesclarRender();
        return setBackupStatus('Não consegui mesclar (nada foi alterado): ' + (e && e.message ? e.message : 'erro desconhecido.'), true);
      }
      backupCloseImport();
      if (anterior && anterior.db) anterior.db.close();
      novo.data = readBackupData(novo.db);
      novo.novos = backupNovos; // o que veio da mesclagem: aparece realçado no conteúdo
      backupNovos = null;
      document.getElementById('backupSoNovos').checked = false;
      const mudancas = total.importadas + total.trocadas + total.grifos + total.marcadores + total.respostas;
      if (mudancas) backupMarkChanged(mudancas);
      novo.changesDaMescla = novo.changes || 0;
      backupMesclando = false;
      // A data de cada etiqueta nova: a da nota mais antiga que a usa (as etiquetas do JW Library não guardam a data em que foram criadas).
      const etiquetas = total.etiquetas.map(nome => {
        const linha = backupOne(novo.db, 'SELECT MIN(n.Created) AS d FROM Note n JOIN TagMap tm ON tm.NoteId = n.NoteId JOIN Tag t ON t.TagId = tm.TagId WHERE t.Name = ?', [nome]);
        return { nome, data: linha && linha.d ? String(linha.d) : '' };
      });
      const resumo = { base: arquivos[base].nome, arquivos: arquivos.length, notas: comNotas ? total.importadas : null, avulsas: total.avulsas, respostas: comRespostas ? total.respostas : null,
        filtros: arquivos.filter((a, k) => k !== base && backupMesclarFiltroAtivo(a)).length, repetidas: total.existentes, duplicadas: vencedores.size, trocadas: total.trocadas,
        grifos: comGrifos ? total.grifos : null, marcadores: comMarcadores ? total.marcadores : null, etiquetas,
        grifosExist: total.grifosExist, marcadoresExist: total.marcadoresExist, respostasExist: total.respostasExist };
      backupMesclarFechar(true); // os arquivos e as escolhas ficam guardados: dá para voltar à seleção pelo resumo
      backupCategory = 'respostas';
      document.getElementById('backupNewNoteSlot').textContent = '';
      backupRefresh('✅ Mesclagem pronta. Veja o resumo abaixo, edite o que quiser e gere o backup mesclado.');
      backupMesclarResultadoMostrar(resumo);
    }

    // O resumo da mesclagem: números e, recolhidas, as etiquetas novas (em "pílulas", como no JW Library), em ordem alfabética ou por data.
    function backupMesclarResultadoMostrar(d) {
      const box = document.getElementById('backupMesclarResultado');
      const n = v => v.toLocaleString('pt-BR');
      box.textContent = '';
      box.hidden = false;
      const titulo = document.createElement('h3');
      titulo.className = 'merge-resultado-titulo';
      titulo.textContent = '📊 Resumo da mesclagem';
      const base = document.createElement('p');
      base.className = 'hint';
      base.textContent = d.arquivos + ' arquivos mesclados. Base: ' + d.base + '.';
      const linhas = [
        ['📝 Notas que entraram', d.notas === null ? 'não mescladas' : n(d.notas) + (d.avulsas ? ' (' + n(d.avulsas) + (d.avulsas === 1 ? ' avulsa' : ' avulsas') + ')' : '')],
        ['♻️ Notas repetidas e iguais (ficaram uma vez só)', n(d.repetidas)],
        ['⚖️ Notas duplicadas com diferenças', d.notas === null ? 'não se aplica' : d.duplicadas ? n(d.duplicadas) + (d.trocadas ? ' (em ' + n(d.trocadas) + ' valeu a versão de outro arquivo)' : ' (valeu a da base)') : 'nenhuma encontrada'],
        ['🖍️ Grifos novos', d.grifos === null ? 'não mesclados' : n(d.grifos) + (d.grifosExist ? ' (' + n(d.grifosExist) + ' já estavam na base)' : '')],
        ['🔖 Marcadores novos', d.marcadores === null ? 'não mesclados' : n(d.marcadores) + (d.marcadoresExist ? ' (' + n(d.marcadoresExist) + ' já estavam na base)' : '')],
        ['✍️ Respostas novas', d.respostas === null ? 'não mescladas' : n(d.respostas) + (d.respostasExist ? ' (' + n(d.respostasExist) + ' já tinham resposta na base)' : '')],
        ['🏷️ Etiquetas novas', n(d.etiquetas.length)]
      ];
      if (d.filtros) linhas.push(['☑️ Arquivos em que você escolheu o que importar', n(d.filtros)]);
      const lista = document.createElement('div');
      lista.className = 'merge-stats';
      linhas.forEach(([rotulo, valor]) => {
        const l = document.createElement('div');
        l.className = 'merge-stat';
        const r = document.createElement('span');
        r.textContent = rotulo;
        const v = document.createElement('strong');
        v.textContent = valor;
        l.append(r, v);
        lista.appendChild(l);
      });
      box.append(titulo, base, lista, backupButton('↩️ Voltar à seleção dos arquivos', backupMesclarReabrir, 'merge-voltar'));
      if (!d.etiquetas.length) return;

      const detalhes = document.createElement('details');
      detalhes.className = 'merge-etiquetas';
      const resumoEl = document.createElement('summary');
      resumoEl.textContent = '🏷️ Ver as etiquetas novas (' + n(d.etiquetas.length) + ')';
      const corpo = document.createElement('div');
      corpo.className = 'merge-etiquetas-corpo';
      const ordem = document.createElement('div');
      ordem.className = 'bk-row';
      const pilulas = document.createElement('div');
      const chave = nome => nome.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
      const az = (x, y) => chave(x.nome).localeCompare(chave(y.nome), 'pt-BR') || x.nome.localeCompare(y.nome, 'pt-BR');
      const pilula = e => {
        const p = document.createElement('span');
        p.className = 'tag-pilula';
        p.textContent = e.nome;
        return p;
      };
      const desenhar = modo => {
        pilulas.textContent = '';
        botoes.forEach(([id, b]) => b.setAttribute('aria-pressed', String(id === modo)));
        if (modo === 'az') {
          // Em ordem alfabética, com uma seção por letra (as que não começam por letra ficam em "#").
          const porLetra = new Map();
          d.etiquetas.slice().sort(az).forEach(e => {
            const primeira = chave(e.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
            const letra = /[A-Z]/.test(primeira) ? primeira : '#';
            if (!porLetra.has(letra)) porLetra.set(letra, []);
            porLetra.get(letra).push(e);
          });
          [...porLetra.keys()].sort((x, y) => (x === '#' ? 1 : y === '#' ? -1 : x.localeCompare(y))).forEach(letra => {
            const cab = document.createElement('div');
            cab.className = 'tag-grupo-titulo';
            cab.textContent = letra;
            const caixa = document.createElement('div');
            caixa.className = 'tag-pilulas';
            porLetra.get(letra).forEach(e => caixa.appendChild(pilula(e)));
            pilulas.append(cab, caixa);
          });
          return;
        }
        // Por data: o mês e o ano da nota mais antiga de cada etiqueta, do mais novo para o mais antigo; dentro do mês, em ordem alfabética.
        const grupos = new Map();
        d.etiquetas.forEach(e => {
          const mes = /^\d{4}-\d{2}/.test(e.data) ? e.data.slice(0, 7) : '';
          if (!grupos.has(mes)) grupos.set(mes, []);
          grupos.get(mes).push(e);
        });
        [...grupos.keys()].sort((x, y) => (x === '' ? 1 : y === '' ? -1 : y.localeCompare(x))).forEach(mes => {
          const cab = document.createElement('div');
          cab.className = 'tag-grupo-titulo';
          const mesAno = mes ? new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Sem data';
          cab.textContent = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
          const caixa = document.createElement('div');
          caixa.className = 'tag-pilulas';
          grupos.get(mes).sort(az).forEach(e => caixa.appendChild(pilula(e)));
          pilulas.append(cab, caixa);
        });
      };
      const botoes = [['az', backupButton('🔤 A–Z', () => desenhar('az'))], ['data', backupButton('📅 Por data', () => desenhar('data'))]];
      botoes.forEach(([, b]) => ordem.appendChild(b));
      corpo.append(ordem, pilulas);
      detalhes.append(resumoEl, corpo);
      box.appendChild(detalhes);
      desenhar('az');
    }

    document.getElementById('backupMergeBtn').addEventListener('click', () => {
      if (!mesclarBox.hidden) return backupMesclarFechar();
      backupMesclarArquivos = [];
      backupMesclarBase = 0;
      backupMesclarEscolhas.clear();
      backupMesclarMarcadas.clear();
      backupMesclarRegra.modo = 'recente';
      backupMesclarRegra.arquivo = 0;
      mesclarBox.hidden = false;
      backupAtualizarBotoes();
      backupMesclarRender();
      mesclarBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    mesclarFile.addEventListener('change', event => {
      const arquivo = event.target.files && event.target.files[0];
      const indice = backupMesclarSlotEscolhido;
      event.target.value = '';
      backupMesclarAdicionar(arquivo, indice);
    });
    mesclarRegraBox.querySelectorAll('input[name="backupMesclarRegraModo"]').forEach(r => r.addEventListener('change', () => {
      backupMesclarRegra.modo = r.value;
      backupMesclarRenderRegra();
    }));
    mesclarRegraArquivo.addEventListener('change', () => { backupMesclarRegra.arquivo = Number(mesclarRegraArquivo.value) || 0; });
    mesclarResolverBtn.addEventListener('click', () => {
      mesclarResolver.hidden = !mesclarResolver.hidden;
      if (!mesclarResolver.hidden) backupMesclarRenderResolver(backupMesclarConflitos());
    });
    mesclarGoBtn.addEventListener('click', backupMesclarExecutar);
    ['backupMesclarNotas', 'backupMesclarGrifos', 'backupMesclarMarcadores', 'backupMesclarRespostas'].forEach(id => document.getElementById(id).addEventListener('change', backupMesclarRender));
    document.getElementById('backupMesclarCancelBtn').addEventListener('click', () => {
      if (backupMesclando) return;
      backupMesclarFechar(Boolean(backupState && backupState.mesclado));
      setBackupStatus('', false);
      if (backupState && backupState.mesclado) { // voltando sem mesclar de novo: o conteúdo e o resumo do backup mesclado reaparecem
        document.getElementById('backupView').hidden = false;
        document.getElementById('backupMesclarResultado').hidden = false;
      }
    });

    // ---------- Leitura em voz alta (botão 🔊 Ouvir) ----------
    // O texto do campo (ou o trecho selecionado) vira letras comuns, sem emojis e símbolos, e vai em partes ao servidor,
    // que pede o áudio à voz do Google (api/voz.mjs). As partes tocam em sequência; a seguinte já é pedida enquanto a
    // atual toca. O áudio de cada parte fica guardado nesta sessão: ouvir de novo não gasta créditos.
    const VOZ_ENDPOINT = '/api/voz';
    const VOZ_SPEED_KEY = 'jwLibraryNoteAplicarVozVelocidadeV1';
    const VOZ_ESPERA_KEY = 'jwLibraryNoteAplicarVozEsperaV1';
    function vozTempoEsperaPadrao() {
      try {
        const salvo = localStorage.getItem(VOZ_ESPERA_KEY);
        if (salvo !== null && salvo !== '') {
          const num = Number(salvo);
          if (Number.isFinite(num) && num >= 0) return num;
        }
      } catch (e) {}
      return 4; // padrão de 4 segundos
    }
    const VOZ_MAX_PARTE = 1500;
    const VOZ_PRIMEIRA_PARTE = 150; // curta, para a leitura começar logo

    // Tamanho máximo de cada parte: o que a voz Gemini consegue gerar antes da hora de tocar. Pelos registros do servidor,
    // gerar leva uns 3,5 s mais 0,024 s por caractere, e a fala anda uns 15 caracteres por segundo em 1× (mais depressa
    // em 1,15× ou 1,3×). O app pede duas partes à frente: a 2ª junto com a 1ª, e cada uma das outras quando começa a
    // tocar a que está duas antes dela, então tem o tempo dessas duas tocando para ficar pronta. Folga de 10%.
    function vozLimiteDaParte(anteriores, velocidade) {
      const n = anteriores.length;
      if (!n) return VOZ_PRIMEIRA_PARTE;
      const gerar = c => 3.5 + 0.024 * c;
      const tocar = c => c / (15 * (velocidade || 1));
      const tempo = n === 1 ? gerar(anteriores[0]) + tocar(anteriores[0]) : tocar(anteriores[n - 2]) + tocar(anteriores[n - 1]);
      const cabe = Math.floor(((tempo - 3.5) / 0.024) * 0.9);
      return Math.min(VOZ_MAX_PARTE, Math.max(VOZ_PRIMEIRA_PARTE, cabe));
    }
    const vozBar = document.getElementById('vozBar');
    const vozStatus = document.getElementById('vozStatus');
    const vozPauseBtn = document.getElementById('vozPauseBtn');
    const vozStopBtn = document.getElementById('vozStopBtn');
    const vozAvancarBtn = document.getElementById('vozAvancarBtn');
    const vozVoltarBtn = document.getElementById('vozVoltarBtn');
    const vozVelocidade = document.getElementById('vozVelocidade');
    const vozVozBtn = document.getElementById('vozVozBtn');
    const vozLista = document.getElementById('vozLista');
    // A voz que a pessoa escolheu no tocador ('' = a do administrador); vale em todas as leituras do app e fica neste aparelho.
    const VOZ_ESCOLHIDA_KEY = 'jwLibraryNoteAplicarVozEscolhidaV1';
    let vozEscolhida = '';
    try { vozEscolhida = localStorage.getItem(VOZ_ESCOLHIDA_KEY) || ''; } catch (e) { /* sem localStorage: a voz do administrador */ }
    const vozControles = vozBar.querySelector('.voz-controles');
    const vozAudio = new Audio();
    const vozCache = new Map();
    let vozSessao = 0;
    let vozInicio = null; // com o tocador aberto "pronto" (sem ler ainda): o que o ▶️ Iniciar faz
    let vozFimAtual = null;
    let vozSilencioUri = '';

    // A velocidade da lista que fica mais perto de v (a padrão do administrador ou uma guardada antes de a lista mudar).
    function vozVelocidadePerto(v) {
      const alvo = Number(v) || 1;
      return [...vozVelocidade.options].map(o => o.value).sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo))[0];
    }

    try {
      const salva = localStorage.getItem(VOZ_SPEED_KEY);
      if (salva) vozVelocidade.value = vozVelocidadePerto(salva);
    } catch (e) { /* sem localStorage: 1× */ }

    // Regras da leitura escolhidas pelo administrador (o que ler e pular, velocidade padrão). Vêm do servidor na primeira
    // leitura; sem conexão com ele, valem estes padrões.
    const VOZ_REGRAS_PADRAO = { velocidade: 1, formatoRefs: 'curta', pularRefs: false, pularFontes: true, pularParenteses: false, pularCabecalhos: false };
    let vozRegras = null;

    async function vozCarregarRegras(forcar) {
      if (vozRegras && !forcar) return vozRegras;
      try {
        const r = await postConfig({ acao: 'voz-publica' });
        vozRegras = Object.assign({}, VOZ_REGRAS_PADRAO, r.ok && r.data && r.data.voz ? r.data.voz : {});
      } catch (e) {
        vozRegras = Object.assign({}, VOZ_REGRAS_PADRAO);
      }
      return vozRegras;
    }

    // ---------- Referências bíblicas para a voz ----------
    // Nomes completos (com ou sem acento, porque as letras formatadas perdem os acentos) e as abreviações das publicações.
    const VOZ_ABREVIACOES = {
      'Gênesis': ['gên', 'gn'], 'Êxodo': ['êx', 'êxo', 'exod'], 'Levítico': ['lev', 'lv'], 'Números': ['núm', 'nm'],
      'Deuteronômio': ['deut', 'dt'], 'Josué': ['jos', 'js'], 'Juízes': ['jz', 'juí'], 'Rute': ['ru', 'rt'],
      '1 Samuel': ['1sa', '1sam', '1sm'], '2 Samuel': ['2sa', '2sam', '2sm'], '1 Reis': ['1rs', '1re'], '2 Reis': ['2rs', '2re'],
      '1 Crônicas': ['1cr', '1crô', '1crôn'], '2 Crônicas': ['2cr', '2crô', '2crôn'], 'Esdras': ['esd', 'ed'], 'Neemias': ['ne', 'nee'],
      'Ester': ['est', 'et'], 'Jó': ['jó'], 'Salmos': ['sal', 'sl', 'salmo'], 'Provérbios': ['pr', 'pro', 'prov', 'pv'],
      'Eclesiastes': ['ec', 'ecl', 'ecles'], 'Cântico de Salomão': ['cân', 'cânt', 'ct'], 'Isaías': ['is', 'isa'],
      'Jeremias': ['jer', 'jr'], 'Lamentações': ['lam', 'lm'], 'Ezequiel': ['ez', 'eze', 'ezeq'], 'Daniel': ['dan', 'dn'],
      'Oseias': ['os', 'ose'], 'Joel': ['jl'], 'Amós': ['am', 'amó'], 'Obadias': ['ob', 'obd', 'oba'], 'Jonas': ['jon', 'jn'],
      'Miqueias': ['miq', 'mq'], 'Naum': ['na'], 'Habacuque': ['hab', 'hc'], 'Sofonias': ['sof', 'sf'], 'Ageu': ['ag'],
      'Zacarias': ['zac'], 'Malaquias': ['mal', 'ml'], 'Mateus': ['mt', 'mat'], 'Marcos': ['mr', 'mar', 'mc'],
      'Lucas': ['lu', 'luc', 'lc'], 'João': ['jo'], 'Atos': ['at'], 'Romanos': ['ro', 'rom', 'rm'], '1 Coríntios': ['1co', '1cor'],
      '2 Coríntios': ['2co', '2cor'], 'Gálatas': ['gál', 'gl'], 'Efésios': ['ef', 'efé'], 'Filipenses': ['fil', 'fp', 'flp'],
      'Colossenses': ['col', 'cl'], '1 Tessalonicenses': ['1te', '1tes', '1ts'], '2 Tessalonicenses': ['2te', '2tes', '2ts'],
      '1 Timóteo': ['1ti', '1tim', '1tm'], '2 Timóteo': ['2ti', '2tim', '2tm'], 'Tito': ['tit', 'tt'], 'Filêmon': ['flm', 'filêm', 'fm'],
      'Hebreus': ['he', 'heb', 'hb'], 'Tiago': ['tg', 'tia'], '1 Pedro': ['1pe', '1ped', '1pd'], '2 Pedro': ['2pe', '2ped', '2pd'],
      '1 João': ['1jo'], '2 João': ['2jo'], '3 João': ['3jo'], 'Judas': ['jud', 'jd'], 'Apocalipse': ['ap', 'apo', 'apoc']
    };
    const VOZ_ACENTOS = { a: '[aáàâã]', e: '[eéê]', i: '[ií]', o: '[oóôõ]', u: '[uúü]', c: '[cç]' };
    const vozChave = texto => String(texto).toLowerCase().replace(/[.\s]+/g, '');
    const vozChaveSemAcento = texto => vozChave(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
    let vozRefs = null; // { regex, comAcento: Map, semAcento: Map }

    function vozReferencias() {
      if (vozRefs) return vozRefs;
      const comAcento = new Map();
      const semAcento = new Map();
      const padroes = [];
      const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      Object.entries(VOZ_ABREVIACOES).forEach(([livro, abrevs]) => {
        [livro, ...abrevs].forEach(nome => {
          if (!comAcento.has(vozChave(nome))) comAcento.set(vozChave(nome), livro);
          if (!semAcento.has(vozChaveSemAcento(nome))) semAcento.set(vozChaveSemAcento(nome), livro);
        });
        // Nome completo: aceita sem acento (letras formatadas). Nomes curtos ("Jó") ficam exatos para não virar "Jo".
        const base = livro.normalize('NFD').replace(/[̀-ͯ]/g, '');
        const flexivel = livro.length <= 2 ? escapar(livro) : [...base].map(ch => VOZ_ACENTOS[ch.toLowerCase()] || escapar(ch)).join('');
        padroes.push(flexivel.replace(/ /g, '\\s?'));
        abrevs.forEach(a => padroes.push(escapar(a).replace(/^(\d)/, '$1\\s?') + '\\.?'));
      });
      padroes.sort((a, b) => b.length - a.length);
      const versos = '\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?:\\s*,\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)*';
      const regex = new RegExp('(?<![\\p{L}\\d])(' + padroes.join('|') + ')\\s*(\\d{1,3}):(' + versos + ')((?:\\s*;\\s*\\d{1,3}:' + versos + ')*)', 'giu');
      vozRefs = { regex, comAcento, semAcento };
      return vozRefs;
    }

    // Números por extenso (capítulos e versículos): 13 -> "treze", 176 -> "cento e setenta e seis".
    const VOZ_UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const VOZ_DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const VOZ_CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    function vozNumeroFalado(numero) {
      const n = Number(numero);
      if (!Number.isInteger(n) || n < 0 || n > 999) return String(numero);
      if (n < 20) return VOZ_UNIDADES[n];
      if (n < 100) return VOZ_DEZENAS[Math.floor(n / 10)] + (n % 10 ? ' e ' + VOZ_UNIDADES[n % 10] : '');
      if (n === 100) return 'cem';
      return VOZ_CENTENAS[Math.floor(n / 100)] + (n % 100 ? ' e ' + vozNumeroFalado(n % 100) : '');
    }

    // Nome do livro como se fala: "1 Cor" -> "Primeira Coríntios", "2 Reis" -> "Segundo Reis".
    function vozLivroFalado(nome) {
      const { comAcento, semAcento } = vozReferencias();
      const livro = comAcento.get(vozChave(nome)) || semAcento.get(vozChaveSemAcento(nome)) || nome;
      const numero = livro.match(/^([123]) (.+)$/);
      if (!numero) return { livro, falado: livro };
      const masculino = /^(Samuel|Reis|Crônicas)$/.test(numero[2]);
      const ordinais = masculino ? ['Primeiro', 'Segundo', 'Terceiro'] : ['Primeira', 'Segunda', 'Terceira'];
      return { livro, falado: ordinais[Number(numero[1]) - 1] + ' ' + numero[2] };
    }

    // Versículos "4-7" ou "6, 7" -> ["4 a 7"] ou ["6", "7"] (com os números por extenso na forma curta).
    function vozVersos(lista, extenso) {
      const numero = n => (extenso ? n : vozNumeroFalado(n));
      return lista.split(',').map(v => v.trim()).filter(Boolean)
        .map(v => v.split(/\s*[-–]\s*/).map(numero).join(' a '));
    }
    const vozJuntarComE = itens => (itens.length > 1 ? itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1] : itens[0]);

    // Referência para a voz, conforme o formato escolhido pelo administrador:
    //  - curta:   "1 Coríntios 13:4-7" -> "Primeira Coríntios treze, quatro a sete"
    //  - extenso: "1 Coríntios 13:4-7" -> "Primeira Coríntios, capítulo 13, versículos 4 a 7"
    // Livros de um capítulo só vêm com capitulo null: "Judas 3" -> "Judas três" ou "Judas, versículo 3".
    function vozReferenciaFalada(nome, capitulo, versos, outros, formato) {
      const { livro, falado } = vozLivroFalado(nome);
      const curta = formato !== 'extenso';
      const trechos = [[capitulo, versos]];
      String(outros || '').split(';').map(s => s.trim()).filter(Boolean).forEach(s => {
        const m = s.match(/^(\d{1,3}):(.+)$/);
        if (m) trechos.push([m[1], m[2]]);
      });
      const falarVersos = lista => {
        const itens = vozVersos(lista, !curta);
        if (curta) return vozJuntarComE(itens);
        const plural = itens.length > 1 || itens.some(v => v.includes(' a '));
        return (plural ? 'versículos ' : 'versículo ') + vozJuntarComE(itens);
      };
      if (capitulo === null) return falado + (curta ? ' ' : ', ') + falarVersos(versos);
      if (curta) {
        // Salmos se fala pelo número do salmo: "Salmo vinte e três, um".
        const nomeFalado = livro === 'Salmos' ? (trechos.length === 1 ? 'Salmo' : 'Salmos') : falado;
        return nomeFalado + ' ' + trechos.map(([c, v]) => vozNumeroFalado(c) + ', ' + falarVersos(v)).join('; ');
      }
      if (livro === 'Salmos') return (trechos.length === 1 ? 'Salmo ' : 'Salmos ') + trechos.map(([c, v]) => c + ', ' + falarVersos(v)).join('; ');
      return falado + ', ' + trechos.map(([c, v]) => 'capítulo ' + c + ', ' + falarVersos(v)).join('; ');
    }

    // Livros de um capítulo só, citados só com o versículo: "Filêmon 8, 9", "3 João 4", "Judas 3".
    const VOZ_UM_CAPITULO = ['Obadias', 'Filêmon', '2 João', '3 João', 'Judas'];
    let vozRegexUmCapitulo = null;
    function vozUmCapitulo() {
      if (vozRegexUmCapitulo) return vozRegexUmCapitulo;
      const nomes = VOZ_UM_CAPITULO.flatMap(l => [l, l.normalize('NFD').replace(/[\u0300-\u036f]/g, '')])
        .concat(['obd', 'oba', 'flm', 'filêm', '2jo', '3jo', 'jud'])
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s?').replace(/^(\d)(?!\\s)/, '$1\\s?'))
        .sort((a, b) => b.length - a.length);
      vozRegexUmCapitulo = new RegExp('(?<![\\p{L}\\d])(' + nomes.join('|') + ')\\.?\\s+(\\d{1,2}(?:\\s*[-–]\\s*\\d{1,2})?(?:\\s*,\\s*\\d{1,2}(?:\\s*[-–]\\s*\\d{1,2})?)*)(?![\\d:])', 'giu');
      return vozRegexUmCapitulo;
    }

    // Citações de publicações: "w24.09 21 § 6", "w23.11 p. 8 §§ 3-4", "rr cap. 5 § 12", "it-1 p. 230". Um "Veja" ou
    // "Leia" logo antes sai junto, e também as outras páginas e parágrafos da mesma publicação depois de um ponto e vírgula
    // ("w25.03 18 § 15; 19 §§ 17-18").
    const VOZ_FONTE_CONTINUA = /(?:\s*;\s*(?:p\.\s*)?\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*§§?\s*\d{1,3}(?:\s*[-–,]\s*\d{1,3})*)*/;
    const VOZ_FONTES = [
      /\b(?:w|wp|g|km|mwb|ws)\d{2}\.\d{1,2}(?:\s+(?:p\.\s*)?\d{1,3}(?:\s*[-–]\s*\d{1,3})?)?(?:\s*§§?\s*\d{1,3}(?:\s*[-–,]\s*\d{1,3})*)?/,
      /\b[a-z]{1,6}(?:-\d)?\s+(?:(?:p|pp|cap|caps)\.\s*)?\d{1,4}(?:\s*[-–]\s*\d{1,4})?\s*§§?\s*\d{1,3}(?:\s*[-–,]\s*\d{1,3})*/,
      /\bit-[12]\s+(?:p\.\s*)?\d{1,4}(?:\s*[-–]\s*\d{1,4})?/
    ].map(fonte => new RegExp(/(?:\b(?:[Vv]eja|[Ll]eia|[Cc]ompare|[Cc]onfira|cf\.)(?:\s+também)?\s+)?/.source + fonte.source + VOZ_FONTE_CONTINUA.source, 'g'));
    // A data do texto diário ("Terça-feira, 20 de outubro"): o texto temático vem logo depois dela.
    const VOZ_DATA_TEXTO_DIARIO = /\b(?:domingo|segunda-feira|ter[cç]a-feira|quarta-feira|quinta-feira|sexta-feira|s[aá]bado),?\s+\d{1,2}(?:\.?º)?\s+de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi;
    let vozRegexPular = null;

    // Pula as referências bíblicas só entre parênteses e depois de um travessão no fim do parágrafo. As do meio do texto
    // ("Jesus disse em Mateus 6:33 que…") são lidas, e também a do texto temático do texto diário, a primeira depois da
    // data ("— Mat. 25:10"), mesmo no fim do parágrafo.
    function vozPularRefs(texto) {
      const { regex } = vozReferencias();
      const umCapitulo = vozUmCapitulo();
      if (!vozRegexPular) {
        const ref = '(?:' + regex.source + '|' + umCapitulo.source + ')';
        vozRegexPular = {
          tema: new RegExp('(?:[—–]|\\s-)\\s*(' + ref + ')', 'giu'),
          travessaoFinal: new RegExp('\\s*(?:[—–]|\\s-)\\s*' + ref + '(?:\\s*[;,]\\s*(?:e\\s+)?' + ref + ')*\\s*[.;]?[ \\t]*$', 'gimu')
        };
      }
      const { tema, travessaoFinal } = vozRegexPular;
      const guardadas = [];
      const datas = [...texto.matchAll(VOZ_DATA_TEXTO_DIARIO)];
      for (let i = datas.length - 1; i >= 0; i--) { // de trás para frente: as posições das datas anteriores continuam valendo
        const depoisDaData = datas[i].index + datas[i][0].length;
        const proximaData = i + 1 < datas.length ? datas[i + 1].index : Infinity;
        tema.lastIndex = depoisDaData;
        const m = tema.exec(texto);
        if (!m || m.index - depoisDaData > 600 || m.index > proximaData) continue;
        const fim = m.index + m[0].length;
        guardadas.push(m[1]);
        texto = texto.slice(0, fim - m[1].length) + '\u0002' + (guardadas.length - 1) + '\u0003' + texto.slice(fim);
      }
      texto = texto
        .replace(/\(([^()\n]*)\)/g, (todo, dentro) => {
          const resto = dentro.replace(regex, '').replace(umCapitulo, '');
          if (resto === dentro) return todo;
          // Sem nada além de "leia", "veja", "e"… os parênteses saem inteiros.
          if (!resto.replace(/\b(?:leia|veja|compare|confira|cf|também|e|com|ou)\b/gi, '').replace(/[\s.,;:]+/g, '')) return '';
          return '(' + resto.replace(/\s+e(?:\s+[.,;:]?)*\s*(?=[.,;:!?]|$)/g, '').replace(/([.,;:!?])(?:\s*[.,;:])+/g, '$1').trim() + ')';
        })
        .replace(travessaoFinal, '');
      return texto.replace(/\u0002(\d+)\u0003/g, (m, n) => guardadas[Number(n)]);
    }

    // Letras formatadas viram letras comuns; emojis, setas e símbolos decorativos saem (a voz leria o nome deles). Depois,
    // as regras do administrador: cabeçalhos, citações de publicações, parênteses e referências pulados, e as referências
    // que ficam escritas por extenso.
    function textoParaVoz(texto, regras) {
      const r = Object.assign({}, VOZ_REGRAS_PADRAO, regras || vozRegras || {});
      let t = removeUnicodeFormatting(String(texto || ''))
        .replace(/[ \t]*\[\d{1,3}(?::\d{1,3})?\][ \t]*/g, ' ') // o número do versículo (ver versiculosNumerados) não se lê em voz alta
        .replace(/\p{Extended_Pictographic}/gu, ' ')
        .replace(/\*/g, ' ') // o asterisco (em geral em volta de termos em inglês, ou nota de rodapé) não se lê: a voz diria "por" ou "para"
        .replace(/[︎️‍⃣]/g, '')
        .replace(/[←-⇿⌀-⏿■-◿☀-➿⬀-⯿•‣⁃⁌⁍∙]/g, ' ')
        .split('\n')
        .map(linha => linha.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean);
      if (r.pularCabecalhos) {
        t = t
          .map(linha => linha.replace(/^(?:RESPOSTAS?|PERGUNTAS ADICIONAIS|Recap\.)\s*[\d,\s\-–]*\.?\s*/i, ''))
          .filter(linha => linha && !/^(?:Perguntas complementares|Perguntas aplicativas|Explica[cç][aã]o dos textos)\s*$/i.test(linha));
      }
      let junto = t.join('\n');
      if (r.pularFontes) junto = VOZ_FONTES.reduce((texto, fonte) => texto.replace(fonte, ''), junto);
      if (r.pularParenteses) junto = junto.replace(/\s*\([^()\n]*\)/g, '');
      if (r.pularRefs) junto = vozPularRefs(junto);
      if (r.formatoRefs === 'curta' || r.formatoRefs === 'extenso') {
        const { regex } = vozReferencias();
        junto = junto
          .replace(regex, (m, nome, capitulo, versos, outros) => vozReferenciaFalada(nome, capitulo, versos, outros, r.formatoRefs))
          .replace(vozUmCapitulo(), (m, nome, versos) => vozReferenciaFalada(nome, null, versos, '', r.formatoRefs));
      }
      return junto
        .replace(/\s*\(\s*[.,;:\s]*\)/g, '') // parênteses que ficaram vazios
        .replace(/([.,;:!?])(?:[ \t]+[.,;:])+/g, '$1') // pontuação que sobrou do que saiu (reticências ficam)
        .split('\n')
        .map(linha => linha.replace(/[ \t]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim())
        .filter(linha => /[\p{L}\d]/u.test(linha))
        .join('\n');
    }

    // Partes cortadas entre frases, com os tamanhos de vozLimiteDaParte na velocidade de quem ouve.
    function partesParaVoz(texto, velocidade) {
      const partes = [];
      let atual = '';
      const limite = () => vozLimiteDaParte(partes.map(p => p.length), velocidade);
      const juntar = (pedaco, separador) => {
        if (atual && (atual + separador + pedaco).length > limite()) {
          partes.push(atual);
          atual = '';
        }
        atual = atual ? atual + separador + pedaco : pedaco;
      };
      // Trecho maior que o limite vai em pedaços menores (orações e, se ainda precisar, palavras); senão, inteiro.
      const dividir = (trecho, regex) => (trecho.length > limite() && trecho.match(regex)) || [trecho];
      texto.split('\n').forEach(linha => {
        let separador = '\n'; // o começo da linha começa uma linha nova; o resto segue na mesma linha
        (linha.match(/[^.!?…]+[.!?…]*/g) || [linha]).forEach(frase => {
          dividir(frase.trim(), /[^,;:]+[,;:]*/g).forEach(oracao => {
            dividir(oracao.trim(), /\S+/g).forEach(palavra => {
              for (let i = 0; i < palavra.length; i += VOZ_MAX_PARTE) {
                juntar(palavra.slice(i, i + VOZ_MAX_PARTE), separador);
                separador = ' ';
              }
            });
          });
        });
      });
      if (atual) partes.push(atual);
      return partes;
    }

    // Um instante de silêncio (WAV), tocado dentro do toque no botão: no iPhone isso libera o áudio para as partes que
    // chegam depois.
    function vozSilencio() {
      if (vozSilencioUri) return vozSilencioUri;
      const amostras = 800;
      const bytes = new Uint8Array(44 + amostras);
      const dv = new DataView(bytes.buffer);
      const escrever = (pos, txt) => [...txt].forEach((c, i) => { bytes[pos + i] = c.charCodeAt(0); });
      escrever(0, 'RIFF'); dv.setUint32(4, 36 + amostras, true); escrever(8, 'WAVE'); escrever(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
      escrever(36, 'data'); dv.setUint32(40, amostras, true);
      bytes.fill(128, 44);
      let bin = '';
      bytes.forEach(b => { bin += String.fromCharCode(b); });
      vozSilencioUri = 'data:audio/wav;base64,' + btoa(bin);
      return vozSilencioUri;
    }

    function vozMensagem(texto, aviso) {
      vozBar.hidden = false;
      vozStatus.textContent = texto;
      vozStatus.className = 'voz-status' + (aviso ? ' warn' : '');
    }

    // O botão de pausa é só um ícone: ⏸️ (pausar) lendo, ▶️ (continuar) em pausa; o estado fica em data-pausado.
    function vozPausaMostrar(pausado) {
      vozPauseBtn.dataset.pausado = pausado ? '1' : '0';
      vozPauseBtn.textContent = pausado ? '▶️' : '⏸️';
      vozPauseBtn.title = pausado ? 'Continuar' : 'Pausar';
      vozPauseBtn.setAttribute('aria-label', vozPauseBtn.title);
    }

    // Sem leitura e com a caixa do áudio aberta, a linha de controles do tocador (só o ✖️) sai: a caixa tem o seu Fechar.
    function vozBarAjustar() {
      vozBar.classList.toggle('sem-controles', !document.getElementById('vozAudioBox').hidden && vozPauseBtn.hidden);
    }

    function vozControlesAtivos(lendo) {
      vozControles.hidden = false;
      vozPauseBtn.hidden = !lendo;
      vozAvancarBtn.hidden = vozVoltarBtn.hidden = !(lendo && leitorAtivo); // só nas leituras por frases (Leitura em voz alta e texto diário)
      vozVozBtn.hidden = !(lendo && vozRegras && Array.isArray(vozRegras.vozes) && vozRegras.vozes.length); // a troca da voz vale em qualquer leitura
      if (!lendo) vozListaFechar();
      vozPausaMostrar(false);
      vozStopBtn.textContent = lendo ? '⏹️' : '✖️';
      vozStopBtn.title = lendo ? 'Parar' : 'Fechar';
      vozStopBtn.setAttribute('aria-label', vozStopBtn.title);
      vozBarAjustar();
      vozVelocidade.hidden = !lendo;
    }

    // Pede o áudio de uma parte (ou devolve o guardado nesta sessão). exemplo: as escolhas do painel do administrador.
    // uso: 'texto-diario' (código de pesquisa + cupom), 'leitura' (código de leitura) ou 'campo' (senha de administrador).
    // extras (texto-diario): { data, vozCupom, origem } — origem = texto antes das regras de pronúncia.
    // A chave do áudio guardado: o texto, mais a voz escolhida (e o exemplo do painel do administrador).
    const vozChaveCache = (texto, exemplo) => (exemplo ? JSON.stringify(exemplo) + '\u0001' : '') + (!exemplo && vozEscolhida ? vozEscolhida + '\u0002' : '') + texto;

    async function vozBuscar(texto, exemplo, uso, extras) {
      const voz = exemplo ? '' : vozEscolhida;
      const chave = vozChaveCache(texto, exemplo);
      if (vozCache.has(chave)) return vozCache.get(chave);
      // Antes do primeiro áudio o app pede a concordância com o envio do texto ao Google (o exemplo do painel do administrador não pede).
      if (!exemplo && !(await garantirConsentimentoIa())) throw new Error(MSG_SEM_CONSENTIMENTO);
      const corpo = exemplo
        ? { exemplo, codigoAdmin: vozAdminCodigo, texto }
        : uso === 'leitura'
          ? { codigoLeitura: codigoLeituraSalvo(), texto, uso }
          : uso === 'texto-diario'
          ? {
              codigo: codigoAcessoSalvo(),
              texto,
              uso,
              data: extras && extras.data,
              vozCupom: extras && extras.vozCupom,
              origem: extras && extras.origem
            }
          : { codigoAdmin: senhaAdminSalva(), texto, uso: 'campo' };
      if (voz) corpo.voz = voz;
      // A conexão do celular às vezes cai antes de a resposta chegar (o Safari avisa só "Load failed", em inglês, mesmo com o
      // servidor tendo gerado o áudio): tenta de novo uma vez e, se falhar de novo, avisa em português.
      let resposta = null;
      let dados = null;
      for (let tentativa = 1; ; tentativa++) {
        try {
          resposta = await fetch(VOZ_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo)
          });
          // Resposta sem JSON (SyntaxError) segue para a mensagem de erro de baixo; falha de rede (TypeError) vai para a nova tentativa.
          dados = await resposta.json().catch(e => (e instanceof TypeError ? Promise.reject(e) : null));
          break;
        } catch (e) {
          if (tentativa >= 2) throw new Error('A conexão caiu ao receber o áudio. Confira a internet e tente de novo.');
          await new Promise(resolver => setTimeout(resolver, 700));
        }
      }
      if (!resposta.ok || !dados || !dados.audio) {
        throw new Error((dados && dados.erro) || (resposta.status === 404 || resposta.status === 501
          ? 'A leitura em voz alta só funciona no site publicado.'
          : 'Não consegui gerar o áudio agora.'));
      }
      const entrada = { uri: 'data:' + (dados.tipo || 'audio/mpeg') + ';base64,' + dados.audio, gemini: Boolean(dados.gemini), novo: true, uso };
      vozCache.set(chave, entrada);
      vozSomarUso({ partes: 1, caracteres: texto.length, carChirp: entrada.gemini ? 0 : texto.length });
      return entrada;
    }

    function vozAplicarVelocidade() {
      const v = Number(vozVelocidade.value) || 1;
      vozAudio.defaultPlaybackRate = v;
      vozAudio.playbackRate = v;
      vozAudio.preservesPitch = true;
    }

    function vozTocar(entrada) {
      return new Promise((resolve, reject) => {
        // Os segundos entram no consumo só na primeira vez que a parte toca (repetir não custa).
        const contar = () => {
          if (!entrada.novo || vozAudio.currentSrc !== entrada.uri || !Number.isFinite(vozAudio.duration)) return;
          entrada.novo = false;
          vozSomarUso(entrada.gemini ? { segGemini: vozAudio.duration } : { segChirp: vozAudio.duration });
        };
        const limpar = () => {
          vozAudio.removeEventListener('ended', fim);
          vozAudio.removeEventListener('error', falha);
          vozAudio.removeEventListener('loadedmetadata', contar);
          vozFimAtual = null;
        };
        const fim = () => { limpar(); resolve(); };
        const falha = () => { limpar(); reject(new Error('Não consegui tocar o áudio.')); };
        vozAudio.addEventListener('ended', fim);
        vozAudio.addEventListener('error', falha);
        vozAudio.addEventListener('loadedmetadata', contar);
        vozFimAtual = fim; // "Parar" encerra a espera
        vozAudio.src = entrada.uri;
        vozAplicarVelocidade();
        vozAudio.play().catch(falha);
      });
    }

    function vozParar() {
      vozAutoCancelar();
      vozInicio = null;
      vozSessao++;
      vozAudio.pause();
      if (vozFimAtual) vozFimAtual();
      vozBar.hidden = true;
      leitorAoParar(); // tira o destaque da frase e a barra de andamento, se a leitura era a da tela Leitura ou a do texto diário
    }

    // A barra do tocador fica no campo de texto; ao ouvir o texto diário, ela vai para o cartão dele (e depois volta).
    const vozBarCasa = { pai: vozBar.parentNode, depois: vozBar.nextSibling };
    function vozBarEm(lugar) {
      vozBar.classList.remove('so-audio');
      if (lugar) lugar.appendChild(vozBar);
      else if (vozBar.parentNode !== vozBarCasa.pai) vozBarCasa.pai.insertBefore(vozBar, vozBarCasa.depois);
    }

    // Botão 🔊 do campo de texto: lê o texto do campo (ou só o trecho selecionado). Só o administrador vê o botão
    // (o servidor também só atende o campo com a senha de administrador); a leitura do texto diário é para todos.
    function vozOuvir() {
      const inicio = input.selectionStart || 0;
      const fim = input.selectionEnd || 0;
      return vozOuvirTexto(fim > inicio ? input.value.slice(inicio, fim) : input.value, fim > inicio ? 'Trecho selecionado' : 'Texto');
    }

    // Mostra os botões 🔊 do campo de texto só com a senha de administrador salva (e para uma leitura do campo em andamento
    // se a senha for apagada). Chamada ao abrir o app e quando a senha é salva ou apagada em Ajustes.
    function vozAtualizarBotoes() {
      const admin = Boolean(senhaAdminSalva());
      document.getElementById('speakTopBtn').hidden = !admin;
      document.getElementById('speakBtn').closest('.action-item').hidden = !admin;
      if (!admin && vozBar.parentNode === vozBarCasa.pai && !vozBar.hidden) vozParar();
    }

    // lugar: onde mostrar a barra do tocador (sem ele, no campo de texto).
    // uso: 'campo' (padrão, só o administrador) ou 'texto-diario' (qualquer pessoa com o código de pesquisa).
    async function vozOuvirTexto(original, rotulo, lugar, uso = 'campo') {
      if (vozSessao && !vozBar.hidden && !vozPauseBtn.hidden) vozParar(); // tocar de novo recomeça
      // Dentro do toque: libera o áudio no iPhone antes de qualquer espera.
      vozAudio.src = vozSilencio();
      vozAudio.play().catch(() => {});
      vozBarEm(lugar);

      const regras = await vozCarregarRegras();
      vozInfoMostrar();
      vozProgresso.hidden = true; // esta leitura (campo de texto) não tem barra de andamento
      let velocidadeSalva = null;
      try { velocidadeSalva = localStorage.getItem(VOZ_SPEED_KEY); } catch (e) { /* sem localStorage */ }
      if (!velocidadeSalva) vozVelocidade.value = vozVelocidadePerto(regras.velocidade);
      const texto = textoParaVoz(original, regras);
      if (!texto) {
        vozMensagem('Não há texto para ouvir.', true);
        return vozControlesAtivos(false);
      }
      const acesso = uso === 'texto-diario'
        ? studyAccessError()
        : !senhaAdminSalva() ? 'A leitura em voz alta do campo de texto é só para o administrador.' : !navigator.onLine ? 'Sem conexão com a internet.' : '';
      if (acesso) {
        vozMensagem(acesso, true);
        return vozControlesAtivos(false);
      }

      const partes = partesParaVoz(texto, Number(vozVelocidade.value) || 1);
      const sessao = ++vozSessao;
      vozControlesAtivos(true);
      vozMensagem(rotulo + ': gerando o áudio…', false);
      try {
        // Duas partes sempre sendo preparadas à frente (veja vozLimiteDaParte).
        const pedidos = [];
        const pedir = i => {
          if (i >= partes.length || pedidos[i]) return;
          pedidos[i] = vozBuscar(partes[i], null, uso);
          pedidos[i].catch(() => {}); // o erro aparece quando chegar a vez dela
        };
        pedir(0);
        pedir(1);
        for (let i = 0; i < partes.length; i++) {
          const entrada = await pedidos[i];
          if (sessao !== vozSessao) return;
          pedir(i + 2);
          vozMensagem('🔊 Lendo' + (partes.length > 1 ? ' a parte ' + (i + 1) + ' de ' + partes.length : '') + '…', false);
          await vozTocar(entrada);
          if (sessao !== vozSessao) return;
        }
        // Terminou: mostra o aviso por um instante e fecha a barra sozinha (com erro, ela fica aberta para ler a mensagem).
        vozMensagem('✅ Leitura concluída.', false);
        vozControlesAtivos(false);
        setTimeout(() => { if (sessao === vozSessao) vozBar.hidden = true; }, 1500);
      } catch (e) {
        if (sessao !== vozSessao) return;
        vozMensagem(e && e.message ? e.message : 'Não consegui ler o texto.', true);
        vozControlesAtivos(false);
      }
    }

    // Os botões Ler e 🔊 abrem o tocador "pronto" em vez de começar na hora: dá para trocar a voz e a velocidade antes.
    // Se o usuário não clicar em nada nas opções de voz durante o tempo configurado (padrão 4s), o áudio inicia direto.
    // opcoes: lugar (onde o tocador abre), texto (o aviso), acesso() (texto do erro ou ''), iniciar() (começa a leitura).
    let vozAutoTimer = null;
    let vozAutoInterval = null;
    let vozTextoProntoOriginal = '';

    function vozAutoCancelar() {
      if (vozAutoTimer) {
        clearTimeout(vozAutoTimer);
        vozAutoTimer = null;
      }
      if (vozAutoInterval) {
        clearInterval(vozAutoInterval);
        vozAutoInterval = null;
      }
      if (vozInicio && vozTextoProntoOriginal) {
        vozMensagem(vozTextoProntoOriginal, false);
      }
    }

    async function vozAbrirPronto({ lugar, texto, acesso, iniciar }) {
      if (vozSessao && !vozBar.hidden && !vozPauseBtn.hidden && !vozInicio) vozParar(); // lendo agora: a nova escolha recomeça
      vozAutoCancelar();
      vozInicio = null;
      vozTextoProntoOriginal = texto || '';
      vozBarEm(lugar);
      vozProgresso.hidden = true;
      const regras = await vozCarregarRegras();
      vozInfoMostrar();
      const erro = acesso ? acesso() : '';
      if (erro) {
        vozMensagem(erro, true);
        return vozControlesAtivos(false);
      }
      let velocidadeSalva = null;
      try { velocidadeSalva = localStorage.getItem(VOZ_SPEED_KEY); } catch (e) { /* sem localStorage */ }
      if (!velocidadeSalva) vozVelocidade.value = vozVelocidadePerto(regras.velocidade);
      vozAplicarVelocidade();
      if (!audioGerando) audioMostrar('', []);
      vozControlesAtivos(true);
      vozPausaMostrar(true); // ▶️
      vozPauseBtn.title = 'Iniciar';
      vozPauseBtn.setAttribute('aria-label', 'Iniciar a leitura');
      vozStopBtn.textContent = '✖️';
      vozStopBtn.title = 'Fechar';
      vozStopBtn.setAttribute('aria-label', 'Fechar');
      vozInicio = iniciar;

      // No clique do usuário, desbloqueia a instância de áudio no Safari/iOS para permitir play após o temporizador
      try {
        vozAudio.src = vozSilencio();
        vozAudio.play().catch(() => {});
      } catch (e) {}

      const espera = vozTempoEsperaPadrao();
      if (espera > 0) {
        let restantes = espera;
        const msgContagem = () => {
          vozMensagem(vozTextoProntoOriginal + ' (iniciando em ' + restantes + ' s…)', false);
        };
        msgContagem();
        vozAutoInterval = setInterval(() => {
          restantes--;
          if (restantes > 0) {
            msgContagem();
          } else {
            clearInterval(vozAutoInterval);
            vozAutoInterval = null;
          }
        }, 1000);
        vozAutoTimer = setTimeout(() => {
          vozAutoTimer = null;
          if (vozAutoInterval) {
            clearInterval(vozAutoInterval);
            vozAutoInterval = null;
          }
          if (vozInicio) {
            const acao = vozInicio;
            vozInicio = null;
            acao();
          }
        }, espera * 1000);
      } else {
        vozMensagem(vozTextoProntoOriginal, false);
      }
    }

    vozPauseBtn.addEventListener('click', () => {
      vozAutoCancelar();
      if (vozInicio) { // tocador "pronto": o ▶️ começa a leitura (e libera o áudio no iPhone, pois é um toque)
        const iniciar = vozInicio;
        vozInicio = null;
        iniciar();
        return;
      }
      if (vozAudio.paused) {
        vozAudio.play().catch(() => {});
        vozPausaMostrar(false);
      } else {
        vozAudio.pause();
        vozPausaMostrar(true);
      }
    });
    vozStopBtn.addEventListener('click', vozParar);

    // 🗣️ Voz: lista das 30 vozes (femininas e masculinas, com o jeito de cada uma) e a "padrão do app" (a do administrador). Ao escolher durante uma
    // leitura por frases, ela recomeça da frase em que estava com a voz nova; nas outras leituras vale a partir da próxima parte.
    function vozListaFechar() {
      vozLista.hidden = true;
      vozVozBtn.setAttribute('aria-expanded', 'false');
    }

    function vozListaItem(nome, jeito, valor, icone) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.setAttribute('role', 'menuitemradio');
      botao.setAttribute('aria-checked', String(vozEscolhida === valor));
      botao.dataset.voz = valor;
      const figura = document.createElement('span');
      figura.className = 'voz-icone';
      figura.setAttribute('aria-hidden', 'true');
      figura.textContent = icone;
      botao.append(figura, document.createTextNode(nome));
      if (jeito) {
        const pequeno = document.createElement('small');
        pequeno.textContent = jeito;
        botao.append(pequeno);
      }
      return botao;
    }

    function vozListaMontar() {
      const vozes = (vozRegras && vozRegras.vozes) || [];
      vozLista.textContent = '';
      vozLista.append(vozListaItem('Padrão do app', vozRegras && vozRegras.descricao ? vozRegras.descricao.voz : '', '', '🎙️'));
      [['F', 'Vozes femininas'], ['M', 'Vozes masculinas']].forEach(([genero, titulo]) => {
        const titulo4 = document.createElement('h4');
        titulo4.textContent = titulo;
        vozLista.append(titulo4);
        vozes.filter(v => v.genero === genero).forEach(v => vozLista.append(vozListaItem(v.nome, v.jeito, v.nome, genero === 'F' ? '👩' : '👨')));
      });
    }

    function vozListaAbrir() {
      vozListaMontar();
      vozLista.hidden = false;
      vozVozBtn.setAttribute('aria-expanded', 'true');
      const botao = vozVozBtn.getBoundingClientRect();
      const largura = Math.min(300, window.innerWidth - 16);
      vozLista.style.width = largura + 'px';
      vozLista.style.left = Math.max(8, Math.min(botao.left + botao.width / 2 - largura / 2, window.innerWidth - largura - 8)) + 'px';
      const embaixo = window.innerHeight - botao.bottom;
      if (botao.top > embaixo) { // mais lugar em cima: a lista abre para cima do botão
        vozLista.style.top = 'auto';
        vozLista.style.bottom = (window.innerHeight - botao.top + 6) + 'px';
        vozLista.style.maxHeight = Math.min(420, botao.top - 16) + 'px';
      } else {
        vozLista.style.bottom = 'auto';
        vozLista.style.top = (botao.bottom + 6) + 'px';
        vozLista.style.maxHeight = Math.min(420, embaixo - 16) + 'px';
      }
      const atual = vozLista.querySelector('[aria-checked="true"]');
      if (atual) atual.scrollIntoView({ block: 'nearest' });
    }

    vozVozBtn.addEventListener('click', () => {
      vozAutoCancelar();
      if (vozLista.hidden) vozListaAbrir(); else vozListaFechar();
    });
    document.addEventListener('click', event => { if (!vozLista.hidden && !vozLista.contains(event.target) && !vozVozBtn.contains(event.target)) vozListaFechar(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !vozLista.hidden) vozListaFechar(); });
    vozLista.addEventListener('click', event => {
      vozAutoCancelar();
      const botao = event.target.closest('button[data-voz]');
      if (!botao) return;
      vozEscolhida = botao.dataset.voz;
      safeSetItem(VOZ_ESCOLHIDA_KEY, vozEscolhida);
      vozListaFechar();
      vozInfoMostrar();
      leitorRecomecarNaFrase(); // só tem efeito nas leituras por frases
    });
    vozVelocidade.addEventListener('change', () => {
      vozAutoCancelar();
      vozAplicarVelocidade();
      safeSetItem(VOZ_SPEED_KEY, vozVelocidade.value);
    });
    vozVelocidade.addEventListener('focus', vozAutoCancelar);
    vozVelocidade.addEventListener('pointerdown', vozAutoCancelar);
    vozBar.addEventListener('click', event => {
      if (event.target !== vozPauseBtn && !vozPauseBtn.contains(event.target)) {
        vozAutoCancelar();
      }
    });
    const vozOuvirPronto = () => vozAbrirPronto({ lugar: null, texto: 'Pronto para ler o texto do campo.', iniciar: vozOuvir });
    document.getElementById('speakTopBtn').addEventListener('click', vozOuvirPronto);
    document.getElementById('speakBtn').addEventListener('click', vozOuvirPronto);

    // ---------- Leitura em voz alta de arquivos e textos (tela Leitura, atalho do Início) ----------
    // Importa um PDF ou um Word (lido neste aparelho: o arquivo não vai a servidor nenhum) ou recebe um texto colado e o lê em voz alta com a
    // mesma voz do texto diário. O texto aparece numa vista em que cada frase é tocável (a leitura recomeça dali) e a frase que está sendo
    // lida fica destacada. O áudio é pedido por partes, como em vozOuvirTexto; enquanto uma parte toca, a frase é estimada pelo ponto do áudio
    // (tempo tocado ÷ duração × caracteres da parte), já que a voz não devolve o instante de cada palavra. Vale só o código de leitura.
    const LEITURA_MAX_ARQUIVO = 40 * 1024 * 1024;
    const LEITURA_MAX_CARACTERES = 100000; // cerca de 1h30 de áudio
    const LEITURA_PDFJS = {
      script: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    };
    const leituraTexto = document.getElementById('leituraTexto');
    const leituraVista = document.getElementById('leituraVista');
    const leituraArquivo = document.getElementById('leituraArquivo');
    const leituraArquivoInfo = document.getElementById('leituraArquivoInfo');
    const leituraEstat = document.getElementById('leituraEstat');
    const leituraDados = document.getElementById('leituraDados');
    const leituraBusca = document.getElementById('leituraBusca');
    const leituraBuscaCampo = document.getElementById('leituraBuscaCampo');
    const leituraBuscaQtd = document.getElementById('leituraBuscaQtd');
    const leituraBuscaAnt = document.getElementById('leituraBuscaAnt');
    const leituraBuscaProx = document.getElementById('leituraBuscaProx');
    const LEITURA_BUSCA_MAX = 1500; // resultados marcados no máximo (uma busca de uma letra num texto enorme travaria o aparelho)
    let leituraBuscaConsulta = ''; // o que está sendo buscado (vazio: sem busca)
    let leituraBuscaEls = []; // vista: os <mark class="lb"> achados, na ordem do texto
    let leituraBuscaFaixas = []; // edição: [{ a, b }] no texto do campo
    let leituraBuscaIdx = -1;
    let leituraBuscaTimer = 0;
    const leituraLerBtn = document.getElementById('leituraLerBtn');
    const leituraEditarBtn = document.getElementById('leituraEditarBtn');
    const leituraConcluirBtn = document.getElementById('leituraConcluirBtn');
    const leituraBarra = document.getElementById('leituraBarra');
    const leituraInicioBtn = document.getElementById('leituraInicioBtn');
    // Um só texto fica gravado neste aparelho (o do último arquivo importado ou colado), para continuar a leitura depois; trocar de arquivo apaga o
    // anterior e Limpar apaga este. A posição (índice da frase em que a leitura parou) fica à parte, porque muda o tempo todo.
    const LEITURA_SALVA_KEY = 'jwLibraryNoteAplicarLeituraSalvaV1';     // { info, texto, gravadoEm }
    const LEITURA_POSICAO_KEY = 'jwLibraryNoteAplicarLeituraPosicaoV1'; // número
    let leituraInfoArquivo = ''; // a linha do arquivo importado (nome, páginas…), guardada junto com o texto
    let leituraTextoGravado = ''; // o texto que está gravado agora
    let leituraPosicao = 0;
    let leituraPosicaoGravadaEm = 0;
    let leituraRestaurada = false;
    let leituraGravarTimer = 0;
    let leituraEstatBase = ''; // o resumo do texto (palavras, caracteres, tempo); leituraBotoesAtualizar acrescenta onde a leitura parou
    let leituraUnidades = []; // as frases da vista: { texto, falado, paragrafo, el }
    let leituraDestaque = -1;
    let leituraRolouEm = 0; // quando a pessoa rolou a vista com o dedo ou o mouse (a vista não puxa de volta por uns segundos)
    // Marca-texto: os trechos que a pessoa marcou, gravados à parte do texto. Cada marca é { u, a, b, x }: a frase (u), o começo e o fim dentro do
    // texto dela (sem as marcas **) e o trecho marcado (x), que serve para achar a marca de novo se o texto for editado.
    const LEITURA_PARENTESES_KEY = 'jwLibraryNoteAplicarLeituraParentesesV1'; // '1' = ler o que está entre parênteses (padrão), '0' = pular
    const leituraParentesesCaixa = document.getElementById('leituraParenteses');
    try { if (localStorage.getItem(LEITURA_PARENTESES_KEY) === '0') leituraParentesesCaixa.checked = false; } catch (e) { /* sem localStorage: lê */ }
    const LEITURA_MARCAS_KEY = 'jwLibraryNoteAplicarLeituraMarcasV1';
    let leituraMarcas = [];
    let leituraMarcando = false; // o modo marca-texto: tocar numa frase marca em vez de ler
    let leituraSelecao = null; // o trecho que a pessoa selecionou na vista: [{ u, a, b }]
    let leituraSelTimer = 0;
    let leituraTextoDaVista = ''; // o texto que a vista mostra agora (o do Word também)
    const leituraMarcaCaixa = document.getElementById('leituraMarca');
    const leituraMarcarBtn = document.getElementById('leituraMarcarBtn');
    const leituraMarcarSelBtn = document.getElementById('leituraMarcarSelBtn');
    const leituraTirarBtn = document.getElementById('leituraTirarBtn');
    const leituraMarcaDica = document.getElementById('leituraMarcaDica');
    const leituraCorBtn = document.getElementById('leituraCorBtn');
    const leituraCorMenu = document.getElementById('leituraCorMenu');
    const leituraCores = document.getElementById('leituraCores');
    const LEITURA_COR_KEY = 'jwLibraryNoteAplicarLeituraCorV1';
    const LEITURA_CORES = ['verde', 'amarelo', 'laranja', 'rosa', 'roxo'];
    let leituraCor = 'verde'; // a cor com que as próximas marcas saem
    try { const salva = localStorage.getItem(LEITURA_COR_KEY); if (LEITURA_CORES.includes(salva)) leituraCor = salva; } catch (e) { /* sem localStorage */ }

    // A moldura dos dados do arquivo só aparece com algo dentro.
    // Cada linha dos dados cabe na largura: se não cabe, a letra diminui aos poucos (até 9 px) e, só então, o fim do texto é cortado com "…". O texto
    // inteiro fica no title. Refeito quando o texto ou a largura da tela muda.
    function leituraDadosAjustar() {
      [leituraArquivoInfo, leituraEstat].forEach(el => {
        const chave = el.textContent + '|' + el.clientWidth;
        if (el.dataset.ajuste === chave) return;
        el.style.fontSize = '';
        el.title = el.textContent;
        if (el.clientWidth) {
          let px = parseFloat(getComputedStyle(el).fontSize);
          while (el.scrollWidth > el.clientWidth && px > 9) { px -= 0.5; el.style.fontSize = px + 'px'; }
        }
        el.dataset.ajuste = el.textContent + '|' + el.clientWidth;
      });
    }
    window.addEventListener('resize', () => leituraDadosAjustar());

    const leituraDadosMostrar = () => {
      leituraDados.hidden = !(leituraArquivoInfo.textContent || leituraEstat.textContent);
      leituraBusca.hidden = !leituraTexto.value.trim(); // a busca só aparece com texto
      leituraDadosAjustar();
    };

    function leituraInfo(texto, aviso) {
      leituraArquivoInfo.textContent = texto;
      leituraArquivoInfo.className = 'hint' + (aviso ? ' warn' : '');
      leituraDadosMostrar();
    }

    // O texto sem as marcas de título (# ) e de negrito (**), como a voz e a contagem o veem.
    function leituraSemMarcas(texto) {
      return texto.replace(/^#\s+/gm, '').replace(/\*\*/g, '');
    }

    // Palavras, caracteres e tempo estimado do texto que está no campo (a ~15 caracteres por segundo a 1×; muda com a velocidade escolhida).
    // Recalculado a cada edição, ao importar, ao concluir a edição e quando a velocidade muda. Passando do limite, avisa que só o começo é lido.
    function leituraEstatAtualizar() {
      const texto = leituraTexto.value.trim();
      leituraEstat.classList.remove('warn');
      if (!texto) {
        leituraEstatBase = '';
        leituraEstat.textContent = '';
        leituraDadosMostrar();
        return;
      }
      const passou = texto.length > LEITURA_MAX_CARACTERES;
      const lido = leituraSemMarcas(passou ? texto.slice(0, LEITURA_MAX_CARACTERES) : texto);
      const palavras = lido.split(/\s+/).filter(Boolean).length;
      const velocidade = Number(vozVelocidade.value) || 1;
      const minutos = Math.max(1, Math.round(lido.length / (15 * velocidade) / 60));
      const duracao = minutos >= 60 ? Math.floor(minutos / 60) + ' h ' + String(minutos % 60).padStart(2, '0') + ' min' : minutos + ' min';
      leituraEstat.textContent = palavras.toLocaleString('pt-BR') + ' palavras · ' + lido.length.toLocaleString('pt-BR') + ' caracteres · ≈ ' + duracao +
        ' de áudio' + (velocidade !== 1 ? ' a ' + String(velocidade).replace('.', ',') + '×' : '') +
        (passou ? ' · só o começo será lido (limite de ' + Math.round(LEITURA_MAX_CARACTERES / 1000) + ' mil)' : '');
      leituraEstatBase = leituraEstat.textContent;
      leituraDadosMostrar();
      leituraEstat.classList.toggle('warn', passou);
      leituraBotoesAtualizar();
    }

    // Vista de leitura (frases destacáveis) ou campo de texto (colar e editar).
    function leituraModo(leitura) {
      leituraVista.hidden = !leitura;
      leituraTexto.hidden = leitura;
      leituraEditarBtn.hidden = !leitura;
      leituraConcluirBtn.hidden = leitura;
      document.body.classList.toggle('leitura-lendo', leitura); // só vale com a tela Leitura aberta (veja o CSS)
      if (leitura) window.scrollTo(0, 0);
      leituraBotoesAtualizar();
      leituraMarcaAtualizar();
      if (leituraBuscaCampo.value.trim()) leituraBuscar(false);
    }

    // ---- Texto → parágrafos e frases ----
    // "Jer. 45:5", "p. ex." e "3.5" não encerram a frase.
    function leituraFrases(paragrafo) {
      const protegido = paragrafo
        .replace(/(\p{L}{1,4})\.(\s+[\d\p{Ll}])/gu, '$1\u0001$2')
        .replace(/(\d)\.(\d)/g, '$1\u0001$2');
      const partes = protegido.match(/[^.!?…]+[.!?…]+[*"”’')\]]*|[^.!?…]+$/g) || [protegido];
      return partes.map(p => p.replace(/\u0001/g, '.').trim()).filter(Boolean);
    }

    // Escreve a frase na vista com o negrito das marcas **; `estado.negrito` passa de uma frase para a seguinte do mesmo parágrafo (um negrito pode
    // atravessar o ponto final). Em título e subtítulo tudo é negrito.
    function leituraRenderizarFrase(span, frase, estado, tudoNegrito) {
      frase.split('**').forEach((parte, i) => {
        if (i) estado.negrito = !estado.negrito;
        if (!parte) return;
        if (estado.negrito || tudoNegrito) {
          const forte = document.createElement('strong');
          forte.textContent = parte;
          span.appendChild(forte);
        } else {
          span.appendChild(document.createTextNode(parte));
        }
      });
    }

    // As regras de leitura do administrador, com a escolha desta tela sobre os parênteses (a caixa "Ler o que está entre parênteses").
    const leituraRegras = regras => ({ ...regras, pularParenteses: !leituraParentesesCaixa.checked });

    // O que a voz fala de uma frase da vista; título e subtítulo ganham um ponto no fim, se faltar, para a voz fazer a pausa.
    function leituraFalado(frase, cabecalho, regras) {
      let falado = textoParaVoz(frase.replace(/\*\*/g, ''), regras);
      if (cabecalho && falado && !/[.!?…:;]$/.test(falado)) falado += '.';
      return falado;
    }

    // O texto em parágrafos: "# " no começo é um título e um parágrafo todo em **negrito** é um subtítulo (cada um é uma frase só); os demais se
    // dividem em frases. É a estrutura da vista e do documento Word, na mesma ordem das frases.
    function leituraEstrutura(texto) {
      return texto.split(/\n+/).map(linha => linha.trim()).filter(Boolean).map(bruto => {
        const titulo = /^#\s+/.test(bruto);
        const corpo = bruto.replace(/^#\s+/, '');
        const subtitulo = !titulo && /^\*\*(?:(?!\*\*).)+\*\*$/.test(corpo);
        return { tipo: titulo ? 'titulo' : subtitulo ? 'subtitulo' : 'texto', frases: titulo || subtitulo ? [corpo] : leituraFrases(corpo) };
      });
    }

    // A vista: um <p> por parágrafo do texto; título e subtítulo são uma unidade só, lida de uma vez, com um ponto no fim se faltar, para a voz
    // fazer a pausa; os demais parágrafos têm uma unidade por frase.
    function leituraMontarVista(texto, aviso) {
      const regras = leituraRegras(vozRegras || VOZ_REGRAS_PADRAO);
      leituraVista.textContent = '';
      leituraUnidades = [];
      leituraDestaque = -1;
      leituraTextoDaVista = texto;
      leituraEstrutura(texto).forEach((par, pi) => {
        const cabecalho = par.tipo !== 'texto';
        const p = document.createElement('p');
        if (par.tipo === 'titulo') p.className = 'lv-titulo';
        else if (par.tipo === 'subtitulo') p.className = 'lv-subtitulo';
        const estado = { negrito: false };
        par.frases.forEach((frase, k) => {
          if (k) p.appendChild(document.createTextNode(' '));
          const span = document.createElement('span');
          span.className = 'lu';
          span.dataset.i = String(leituraUnidades.length);
          leituraRenderizarFrase(span, frase, estado, cabecalho);
          p.appendChild(span);
          leituraUnidades.push({ texto: frase, falado: leituraFalado(frase, cabecalho, regras), cabecalho, paragrafo: pi, el: span });
        });
        leituraVista.appendChild(p);
      });
      if (aviso) {
        const nota = document.createElement('p');
        nota.className = 'leitura-aviso';
        nota.textContent = aviso;
        leituraVista.appendChild(nota);
      }
      leituraUnidades.forEach(u => leituraMudosNoSpan(u.el, regras));
      leituraMarcasValidar();
      leituraMarcasGravar();
      new Set(leituraMarcas.map(m => m.u)).forEach(u => leituraMarcasNoSpan(leituraUnidades[u].el, leituraMarcas.filter(m => m.u === u)));
      leituraVista.scrollTop = 0;
    }

    // ---- Marca-texto (só com a leitura parada ou em pausa) ----
    // 🖍️ Marcar liga o modo: tocar numa frase a marca (tocar numa marca a tira) e, para marcar só um trecho, a pessoa o seleciona e toca em Marcar
    // seleção. Com a leitura em andamento a ferramenta fica indisponível. As marcas são gravadas e saem em verde no documento Word.
    const leituraPlano = u => leituraUnidades[u].texto.replace(/\*\*/g, '');

    // A leitura está em andamento (o tocador está aberto na Leitura e não está em pausa)?
    const leituraMarcaLendo = () => vozBar.parentNode === leituraBarra && !vozBar.hidden && !vozPauseBtn.hidden && vozPauseBtn.dataset.pausado !== '1';

    // Une as marcas que se tocam e refaz o trecho (x) a partir do texto da frase.
    function leituraMarcasUnir(lista) {
      const unidas = [];
      lista.slice().sort((p, q) => p.u - q.u || p.a - q.a).forEach(m => {
        const ultima = unidas[unidas.length - 1];
        if (ultima && ultima.u === m.u && ultima.c === (m.c || 'verde') && m.a <= ultima.b) ultima.b = Math.max(ultima.b, m.b);
        else unidas.push({ u: m.u, a: m.a, b: m.b, c: m.c || 'verde' });
      });
      return unidas.map(m => ({ ...m, x: leituraPlano(m.u).slice(m.a, m.b) }));
    }

    // Pinta as faixas novas ({ u, a, b, c }): onde elas cobrem uma marca de outra cor, a cor nova vale; as da mesma cor se unem.
    function leituraMarcasPintar(lista, novas) {
      let resto = lista;
      novas.forEach(n => {
        resto = resto.flatMap(m => {
          if (m.u !== n.u || (m.c || 'verde') === n.c || m.b <= n.a || m.a >= n.b) return [m];
          const sobra = [];
          if (m.a < n.a) sobra.push({ ...m, b: n.a });
          if (m.b > n.b) sobra.push({ ...m, a: n.b });
          return sobra;
        });
      });
      return leituraMarcasUnir(resto.concat(novas));
    }

    // Depois de montar a vista: a marca que já não casa com o texto (ele foi editado) vai para a frase onde o trecho está, ou sai.
    function leituraMarcasValidar() {
      const validas = [];
      leituraMarcas.forEach(m => {
        let { u, a, b } = m;
        if (!(leituraUnidades[u] && leituraPlano(u).slice(a, b) === m.x)) {
          u = -1;
          for (let k = 0; k < leituraUnidades.length && u < 0; k++) {
            const i = leituraPlano(k).indexOf(m.x);
            if (i >= 0) { u = k; a = i; b = i + m.x.length; }
          }
        }
        if (u >= 0) validas.push({ u, a, b, c: m.c, x: m.x });
      });
      leituraMarcas = leituraMarcasUnir(validas);
    }

    function leituraMarcasGravar() {
      try {
        if (leituraMarcas.length) safeSetItem(LEITURA_MARCAS_KEY, JSON.stringify(leituraMarcas));
        else localStorage.removeItem(LEITURA_MARCAS_KEY);
      } catch (e) { /* sem localStorage: as marcas ficam só na tela */ }
    }

    // O destaque da frase lida só cobre o que a voz FALA: o que ela pula (o que está entre parênteses, as referências a publicações e a referência depois
    // do travessão, conforme as regras de leitura) fica sem destaque. Acha os trechos pulados (cada candidato que, sozinho, não vira fala nenhuma) e
    // envolve o resto em <mark class="lt">; a frase ganha a classe tem-nl, que passa o destaque do .lu inteiro para os .lt.
    function leituraMudosNoSpan(span, regras) {
      leituraDesenvolver(span, 'lt');
      span.classList.remove('tem-nl');
      const texto = span.textContent;
      const mudos = [];
      const candidato = expressao => {
        for (const m of texto.matchAll(expressao)) {
          if (!m[0].trim() || /[\p{L}\d]/u.test(textoParaVoz(m[0], regras))) continue;
          mudos.push([m.index, m.index + m[0].length]);
        }
      };
      candidato(/\s*\([^()\n]*\)/g); // entre parênteses
      candidato(/\s*[—–]\s*[^—–]+$/g); // referência depois do travessão, no fim
      VOZ_FONTES.forEach(fonte => candidato(new RegExp(fonte.source, 'g'))); // citações de publicações
      if (!mudos.length) return;
      mudos.sort((a, b) => a[0] - b[0]);
      const unidos = [];
      mudos.forEach(m => {
        const ultimo = unidos[unidos.length - 1];
        if (ultimo && m[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], m[1]);
        else unidos.push([m[0], m[1]]);
      });
      const falados = [];
      let pos = 0;
      [...unidos, [texto.length, texto.length]].forEach(([ini, fim]) => {
        let a = pos;
        let b = ini;
        while (a < b && /\s/.test(texto[a])) a++;
        while (b > a && /\s/.test(texto[b - 1])) b--;
        if (b > a) falados.push({ a, b });
        pos = fim;
      });
      if (!falados.length) return;
      span.classList.add('tem-nl');
      leituraEnvolver(span, falados, 'lt');
    }

    // Envolve em <mark class="classe"> o que as faixas { a, b } (posições no texto da frase) cobrem; as faixas vêm em ordem e sem se tocar.
    function leituraEnvolver(span, faixas, classe) {
      if (!faixas.length) return;
      const nos = [];
      const percorrer = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      while (percorrer.nextNode()) nos.push(percorrer.currentNode);
      let pos = 0;
      nos.forEach(no => {
        const ini = pos;
        pos += no.data.length;
        const cortes = faixas.map(f => [Math.max(f.a, ini) - ini, Math.min(f.b, pos) - ini, f.c]).filter(c => c[1] > c[0]);
        if (!cortes.length) return;
        const pedacos = document.createDocumentFragment();
        let ate = 0;
        cortes.forEach(([c0, c1, cor]) => {
          if (c0 > ate) pedacos.append(no.data.slice(ate, c0));
          const marca = document.createElement('mark');
          marca.className = classe;
          if (cor) marca.dataset.c = cor;
          marca.textContent = no.data.slice(c0, c1);
          pedacos.append(marca);
          ate = c1;
        });
        if (ate < no.data.length) pedacos.append(no.data.slice(ate));
        no.replaceWith(pedacos);
      });
    }

    function leituraDesenvolver(span, classe) {
      span.querySelectorAll('mark.' + classe).forEach(m => m.replaceWith(...m.childNodes));
      span.normalize();
    }

    // Põe as marcas do marca-texto (faixas { a, b } dentro do texto da frase) no elemento da frase: <mark class="lm"> em volta do que foi marcado.
    // Os resultados da busca (mark.lb) saem antes e voltam depois, para as posições das marcas valerem.
    function leituraMarcasNoSpan(span, faixas) {
      leituraDesenvolver(span, 'lb');
      leituraDesenvolver(span, 'lm');
      leituraEnvolver(span, faixas, 'lm');
      if (leituraBuscaConsulta && !leituraVista.hidden) leituraEnvolver(span, leituraBuscaAchar(span.textContent, leituraBuscaConsulta), 'lb');
    }

    // ---- Busca no texto ----
    // Sem diferença entre maiúsculas e minúsculas nem entre letras com e sem acento. normalizar devolve o texto simplificado e, para cada letra
    // dele, a posição da letra no texto original (assim as faixas achadas voltam para o texto que a pessoa vê).
    function leituraBuscaNormalizar(texto) {
      let simples = '';
      const mapa = [];
      for (let i = 0; i < texto.length; i++) {
        for (const c of texto[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) { simples += c; mapa.push(i); }
      }
      return { simples, mapa };
    }

    function leituraBuscaAchar(texto, consulta, maximo = Infinity) {
      const alvo = leituraBuscaNormalizar(consulta).simples;
      if (!alvo) return [];
      const base = leituraBuscaNormalizar(texto);
      const faixas = [];
      for (let i = base.simples.indexOf(alvo); i >= 0 && faixas.length < maximo; i = base.simples.indexOf(alvo, i + alvo.length)) {
        faixas.push({ a: base.mapa[i], b: base.mapa[i + alvo.length - 1] + 1 });
      }
      return faixas;
    }

    // Leva a rolagem do campo de texto (edição) até a posição do texto, medindo onde ela cai numa cópia invisível do campo.
    function leituraBuscaRolarCampo(pos) {
      const estilo = getComputedStyle(leituraTexto);
      const copia = document.createElement('div');
      ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'tabSize']
        .forEach(propriedade => { copia.style[propriedade] = estilo[propriedade]; });
      Object.assign(copia.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', width: leituraTexto.clientWidth + 'px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
      copia.style.boxSizing = 'content-box';
      copia.style.width = leituraTexto.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight) + 'px';
      copia.append(document.createTextNode(leituraTexto.value.slice(0, pos)));
      const ponto = document.createElement('span');
      ponto.textContent = '|';
      copia.append(ponto);
      document.body.append(copia);
      const topo = ponto.offsetTop;
      copia.remove();
      leituraTexto.scrollTop = Math.max(0, topo - leituraTexto.clientHeight * 0.35);
    }

    // Vai ao resultado `indice` (circular). seleciona: no campo de texto, também seleciona o trecho (o campo ganha o foco, e em celulares o teclado).
    function leituraBuscaIr(indice, seleciona) {
      const edicao = leituraVista.hidden;
      const total = edicao ? leituraBuscaFaixas.length : leituraBuscaEls.length;
      leituraBuscaEls.forEach(m => m.classList.remove('atual'));
      leituraBuscaAnt.disabled = leituraBuscaProx.disabled = total === 0;
      if (!total) {
        leituraBuscaIdx = -1;
        leituraBuscaQtd.textContent = leituraBuscaConsulta ? 'Nenhum' : '';
        return;
      }
      leituraBuscaIdx = ((indice % total) + total) % total;
      leituraBuscaQtd.textContent = (leituraBuscaIdx + 1) + ' de ' + total + (total >= LEITURA_BUSCA_MAX ? '+' : '');
      if (edicao) {
        const faixa = leituraBuscaFaixas[leituraBuscaIdx];
        if (seleciona) {
          leituraTexto.focus({ preventScroll: true });
          leituraTexto.setSelectionRange(faixa.a, faixa.b);
        }
        leituraBuscaRolarCampo(faixa.a);
        return;
      }
      const el = leituraBuscaEls[leituraBuscaIdx];
      el.classList.add('atual');
      leituraRolouEm = Date.now(); // a leitura não puxa a vista de volta por uns segundos
      leituraVista.scrollTo({ top: Math.max(0, el.offsetTop - leituraVista.clientHeight * 0.35), behavior: 'smooth' });
    }

    // Refaz a busca: marca os resultados na vista (frase por frase) ou, na edição, só os conta no campo. ir: leva ao primeiro resultado.
    function leituraBuscar(ir) {
      leituraBuscaConsulta = leituraBuscaCampo.value.trim();
      document.getElementById('leituraBuscaLimpar').hidden = !leituraBuscaCampo.value;
      leituraBuscaEls = [];
      leituraBuscaFaixas = [];
      if (!leituraVista.hidden) {
        leituraUnidades.forEach(u => { leituraDesenvolver(u.el, 'lb'); });
        let restante = LEITURA_BUSCA_MAX;
        if (leituraBuscaConsulta) {
          leituraUnidades.forEach(u => {
            if (restante <= 0) return;
            const faixas = leituraBuscaAchar(u.el.textContent, leituraBuscaConsulta, restante);
            restante -= faixas.length;
            leituraEnvolver(u.el, faixas, 'lb');
          });
          leituraBuscaEls = [...leituraVista.querySelectorAll('mark.lb')];
        }
      } else if (leituraBuscaConsulta) {
        leituraBuscaFaixas = leituraBuscaAchar(leituraTexto.value, leituraBuscaConsulta, LEITURA_BUSCA_MAX);
      }
      if (ir) leituraBuscaIr(0, false);
      else {
        const total = leituraVista.hidden ? leituraBuscaFaixas.length : leituraBuscaEls.length;
        leituraBuscaAnt.disabled = leituraBuscaProx.disabled = total === 0;
        leituraBuscaQtd.textContent = !leituraBuscaConsulta ? '' : total ? total + (total >= LEITURA_BUSCA_MAX ? '+' : '') + (total === 1 ? ' resultado' : ' resultados') : 'Nenhum';
        leituraBuscaIdx = -1;
      }
    }

    const leituraBuscaLimpar = document.getElementById('leituraBuscaLimpar');
    leituraBuscaLimpar.addEventListener('click', () => {
      leituraBuscaCampo.value = '';
      clearTimeout(leituraBuscaTimer);
      leituraBuscar(true);
      leituraBuscaCampo.focus({ preventScroll: true });
    });
    // A− / A+: o tamanho da letra do texto (vista e campo), guardado neste aparelho.
    const LEITURA_FONTES = [0.55, 0.62, 0.7, 0.8, 0.9, 1.02, 1.15, 1.3, 1.5, 1.75]; // rem; 1,02 é o tamanho de sempre
    const LEITURA_FONTE_KEY = 'jwLibraryNoteAplicarLeituraFonteV2'; // o tamanho em rem (a V1 guardava a posição numa lista menor)
    let leituraFonteIdx = LEITURA_FONTES.indexOf(1.02);
    try {
      const guardado = localStorage.getItem(LEITURA_FONTE_KEY);
      const antigo = localStorage.getItem('jwLibraryNoteAplicarLeituraFonteV1');
      const valor = guardado !== null ? Number(guardado) : antigo !== null ? [0.8, 0.9, 1.02, 1.15, 1.3, 1.5, 1.75][Number(antigo)] : NaN;
      if (Number.isFinite(valor)) leituraFonteIdx = LEITURA_FONTES.reduce((melhor, v, i) => (Math.abs(v - valor) < Math.abs(LEITURA_FONTES[melhor] - valor) ? i : melhor), 0);
    } catch (e) { /* sem localStorage */ }
    function leituraFonteAplicar() {
      document.getElementById('leituraCard').style.setProperty('--leitura-fonte', LEITURA_FONTES[leituraFonteIdx] + 'rem');
      document.getElementById('leituraFonteMenos').disabled = leituraFonteIdx <= 0;
      document.getElementById('leituraFonteMais').disabled = leituraFonteIdx >= LEITURA_FONTES.length - 1;
    }
    function leituraFonteMudar(passo) {
      leituraFonteIdx = Math.max(0, Math.min(LEITURA_FONTES.length - 1, leituraFonteIdx + passo));
      safeSetItem(LEITURA_FONTE_KEY, String(LEITURA_FONTES[leituraFonteIdx]));
      // Mantém na tela a frase que a pessoa está lendo (a que está no alto da vista) quando as linhas mudam de lugar.
      const topo = leituraVista.hidden ? null : [...leituraVista.querySelectorAll('.lu')].find(el => el.offsetTop + el.offsetHeight > leituraVista.scrollTop);
      leituraFonteAplicar();
      if (topo) leituraVista.scrollTop = topo.offsetTop;
    }
    leituraFonteAplicar();
    document.getElementById('leituraFonteMenos').addEventListener('click', () => leituraFonteMudar(-1));
    document.getElementById('leituraFonteMais').addEventListener('click', () => leituraFonteMudar(1));
    leituraBuscaCampo.addEventListener('input', () => {
      leituraBuscaLimpar.hidden = !leituraBuscaCampo.value;
      clearTimeout(leituraBuscaTimer);
      leituraBuscaTimer = setTimeout(() => leituraBuscar(true), 200);
    });
    leituraBuscaCampo.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      clearTimeout(leituraBuscaTimer);
      if (leituraBuscaCampo.value.trim() !== leituraBuscaConsulta) {
        leituraBuscar(true);
        leituraBuscaIr(0, true);
      } else {
        leituraBuscaIr(leituraBuscaIdx + (event.shiftKey ? -1 : 1), true);
      }
    });
    leituraBuscaProx.addEventListener('click', () => leituraBuscaIr(leituraBuscaIdx + 1, true));
    leituraBuscaAnt.addEventListener('click', () => leituraBuscaIr(leituraBuscaIdx - 1, true));

    // As marcas de algumas frases mudaram: redesenha essas frases, grava e atualiza os botões.
    function leituraMarcasMudaram(unidades) {
      unidades.forEach(u => leituraMarcasNoSpan(leituraUnidades[u].el, leituraMarcas.filter(m => m.u === u)));
      leituraMarcasGravar();
      leituraMarcaAtualizar();
    }

    // Quantos caracteres da frase vêm antes do ponto (no, desloc).
    function leituraDeslocamento(frase, no, desloc) {
      const faixa = document.createRange();
      faixa.selectNodeContents(frase);
      faixa.setEnd(no, desloc);
      return faixa.toString().length;
    }

    // Toque numa frase com o modo marca-texto ligado: tocar numa marca a tira; tocar no resto marca a frase toda.
    function leituraMarcarToque(frase, alvo) {
      if (leituraMarcaLendo()) return;
      const u = Number(frase.dataset.i);
      const marca = alvo.closest('mark.lm');
      if (marca) {
        // Tocar numa marca da cor escolhida a tira; tocar numa de outra cor a pinta com a cor escolhida.
        const ponto = leituraDeslocamento(frase, marca, 0);
        const atual = leituraMarcas.find(m => m.u === u && m.a <= ponto && ponto < m.b);
        if (atual && atual.c !== leituraCor) leituraMarcas = leituraMarcasPintar(leituraMarcas, [{ u, a: atual.a, b: atual.b, c: leituraCor }]);
        else leituraMarcas = leituraMarcas.filter(m => m !== atual);
      } else {
        leituraMarcas = leituraMarcasPintar(leituraMarcas, [{ u, a: 0, b: leituraPlano(u).length, c: leituraCor }]);
      }
      leituraMarcasMudaram([u]);
    }

    // O trecho selecionado na vista, em faixas por frase (sem os espaços das pontas).
    function leituraSelecaoFaixas() {
      const selecao = window.getSelection();
      if (!selecao || selecao.rangeCount === 0 || selecao.isCollapsed) return [];
      const trecho = selecao.getRangeAt(0);
      if (!leituraVista.contains(trecho.commonAncestorContainer)) return [];
      const faixas = [];
      leituraVista.querySelectorAll('.lu').forEach(span => {
        if (!trecho.intersectsNode(span)) return;
        const texto = span.textContent;
        let a = span.contains(trecho.startContainer) ? leituraDeslocamento(span, trecho.startContainer, trecho.startOffset) : 0;
        let b = span.contains(trecho.endContainer) ? leituraDeslocamento(span, trecho.endContainer, trecho.endOffset) : texto.length;
        while (a < b && /\s/.test(texto[a])) a++;
        while (b > a && /\s/.test(texto[b - 1])) b--;
        if (b > a) faixas.push({ u: Number(span.dataset.i), a, b });
      });
      return faixas;
    }

    // Mostra ou esconde a ferramenta e acerta os botões: com a leitura em andamento o modo desliga e o botão Marcar fica indisponível.
    function leituraMarcaAtualizar() {
      const tem = !leituraVista.hidden && leituraUnidades.length > 0;
      const lendo = tem && leituraMarcaLendo();
      leituraMarcaCaixa.hidden = !tem || lendo; // lendo, a linha do marca-texto e do Word some; volta ao pausar ou parar
      if (!tem || lendo) {
        leituraMarcando = false;
        leituraSelecao = null;
      }
      leituraMarcarBtn.disabled = lendo;
      leituraMarcarBtn.title = lendo ? 'Pause a leitura para marcar' : '';
      leituraMarcarBtn.setAttribute('aria-pressed', String(leituraMarcando));
      leituraMarcarBtn.textContent = leituraMarcando ? '✅ Ok' : '🖍️ Marcar';
      leituraMarcarSelBtn.hidden = !(leituraMarcando && leituraSelecao);
      leituraTirarBtn.hidden = !leituraMarcas.length;
      leituraTirarBtn.disabled = lendo;
      leituraCorMenu.hidden = !leituraMarcando;
      leituraCorBtn.dataset.c = leituraCor;
      if (!leituraMarcando) leituraCoresFechar();
      leituraCores.querySelectorAll('.cor-opcao').forEach(op => op.setAttribute('aria-checked', String(op.dataset.c === leituraCor)));
      leituraVista.classList.toggle('marcando', leituraMarcando);
      const dica = leituraMarcando ? 'Toque numa frase para marcá-la; toque numa marca da mesma cor para tirá-la (ou de outra cor para trocar). Para marcar só um trecho, selecione-o e toque em “Marcar seleção”.' : '';
      leituraMarcaDica.textContent = dica;
      leituraMarcaDica.hidden = !dica;
    }

    // Mostra o texto do campo em frases (a vista). Falso se não há texto.
    function leituraAbrirVista() {
      let texto = leituraTexto.value.trim();
      if (!texto) return false;
      let aviso = '';
      if (texto.length > LEITURA_MAX_CARACTERES) {
        texto = texto.slice(0, LEITURA_MAX_CARACTERES);
        aviso = '⚠️ O texto passa de ' + LEITURA_MAX_CARACTERES.toLocaleString('pt-BR') + ' caracteres: o app lê só o começo. Divida o texto para ouvir o resto.';
      }
      leituraMontarVista(texto, aviso);
      leituraModo(true);
      return true;
    }

    // ---- O texto gravado e o ponto em que a leitura parou ----
    function leituraGravar() {
      clearTimeout(leituraGravarTimer);
      leituraGravarTimer = 0;
      const texto = leituraTexto.value;
      try {
        if (!texto.trim()) {
          localStorage.removeItem(LEITURA_SALVA_KEY);
          localStorage.removeItem(LEITURA_POSICAO_KEY);
          localStorage.removeItem(LEITURA_MARCAS_KEY);
          leituraMarcas = [];
          leituraTextoGravado = '';
          leituraPosicao = 0;
          return true;
        }
        localStorage.setItem(LEITURA_SALVA_KEY, JSON.stringify({ info: leituraInfoArquivo, texto, gravadoEm: new Date().toISOString() }));
        if (texto !== leituraTextoGravado) { // texto novo ou editado: a posição antiga não vale mais
          leituraTextoGravado = texto;
          leituraPosicao = 0;
          localStorage.removeItem(LEITURA_POSICAO_KEY);
        }
        return true;
      } catch (e) {
        leituraInfo('Não consegui guardar este texto no aparelho (a memória está cheia). Ele continua na tela.', true);
        return false;
      }
    }

    // Grava o que ainda não foi gravado (ao sair da página ou do app).
    function leituraGravarPendente() {
      if (leituraGravarTimer) leituraGravar();
      leituraGravarPosicao(true);
    }

    function leituraGravarPosicao(agora) {
      if (!agora && Date.now() - leituraPosicaoGravadaEm < 4000) return;
      leituraPosicaoGravadaEm = Date.now();
      try {
        if (leituraPosicao > 0 && leituraTexto.value.trim()) localStorage.setItem(LEITURA_POSICAO_KEY, String(leituraPosicao));
        else localStorage.removeItem(LEITURA_POSICAO_KEY);
      } catch (e) { /* sem localStorage */ }
      leituraBotoesAtualizar();
    }

    // Com a leitura parada no meio, o botão vira "Continuar" (e o ⏹️ volta ao início do texto).
    function leituraBotoesAtualizar() {
      const continuar = !leituraVista.hidden && leituraPosicao > 0 && leituraPosicao < leituraUnidades.length;
      const pct = leituraUnidades.length ? Math.round((leituraPosicao / leituraUnidades.length) * 100) : 0;
      leituraLerBtn.textContent = continuar ? '▶️ Continuar' : '🔊 Ler';
      leituraLerBtn.title = continuar ? 'Continuar de onde parou (' + pct + '%)' : '';
      leituraInicioBtn.hidden = leituraVista.hidden; // o ⏹️ (stop) fica ao lado do Ler/Continuar e só vale com um ponto de parada
      leituraInicioBtn.disabled = !(leituraPosicao > 0);
      leituraEstat.textContent = leituraEstatBase + (continuar ? ' · parou em ' + pct + '%' : '');
      leituraDadosAjustar();
    }

    // Sublinha a frase em que a leitura parou (o ponto de continuar).
    function leituraMarcarParou(indice) {
      leituraVista.querySelectorAll('.lu.parou').forEach(e => e.classList.remove('parou'));
      const u = leituraUnidades[indice];
      if (u && indice > 0) u.el.classList.add('parou');
    }

    // Ao abrir a tela Leitura pela primeira vez na sessão, devolve o texto gravado, já na vista de leitura, com o ponto em que parou.
    async function leituraAoEntrar() {
      if (leituraRestaurada) return;
      leituraRestaurada = true;
      if (leituraTexto.value.trim()) return;
      let salva = null;
      try { salva = JSON.parse(localStorage.getItem(LEITURA_SALVA_KEY) || 'null'); } catch (e) { salva = null; }
      if (!salva || typeof salva.texto !== 'string' || !salva.texto.trim()) return;
      leituraTexto.value = salva.texto;
      leituraTextoGravado = salva.texto;
      leituraInfoArquivo = typeof salva.info === 'string' ? salva.info : '';
      if (leituraInfoArquivo) leituraInfo(leituraInfoArquivo, false);
      leituraEstatAtualizar();
      let posicao = 0;
      try { posicao = Number(localStorage.getItem(LEITURA_POSICAO_KEY)) || 0; } catch (e) { /* sem localStorage */ }
      try {
        const gravadas = JSON.parse(localStorage.getItem(LEITURA_MARCAS_KEY) || '[]');
        leituraMarcas = Array.isArray(gravadas) ? gravadas.filter(m => m && Number.isInteger(m.u) && Number.isInteger(m.a) && Number.isInteger(m.b) && m.b > m.a && typeof m.x === 'string').map(m => ({ ...m, c: LEITURA_CORES.includes(m.c) ? m.c : 'verde' })) : [];
      } catch (e) { leituraMarcas = []; }
      await vozCarregarRegras();
      if (!leituraAbrirVista()) return;
      if (posicao > 0 && posicao < leituraUnidades.length) {
        leituraPosicao = posicao;
        leituraMarcarParou(posicao);
        const el = leituraUnidades[posicao].el;
        leituraVista.scrollTop = Math.max(0, el.offsetTop - leituraVista.clientHeight * 0.3);
      }
      leituraBotoesAtualizar();
    }

    // ---- Documento Word com as marcas ----
    // O texto da vista como o Word o recebe: [{ tipo, trechos: [{ texto, b, m }] }] (b: negrito, m: marcado), com a mesma estrutura, na mesma ordem
    // das frases e com as mesmas marcas da vista.
    function leituraModeloDoc() {
      let u = 0;
      return leituraEstrutura(leituraTextoDaVista).map(par => {
        const trechos = [];
        const estado = { negrito: false };
        par.frases.forEach((frase, k) => {
          if (k) trechos.push({ texto: ' ', b: false, m: false });
          const faixas = leituraMarcas.filter(m => m.u === u);
          u++;
          let pos = 0;
          frase.split('**').forEach((parte, i) => {
            if (i) estado.negrito = !estado.negrito;
            const cortes = [...new Set([pos, pos + parte.length, ...faixas.flatMap(f => [f.a, f.b]).filter(x => x > pos && x < pos + parte.length)])].sort((x, y) => x - y);
            for (let c = 0; c + 1 < cortes.length; c++) {
              trechos.push({ texto: parte.slice(cortes[c] - pos, cortes[c + 1] - pos), b: estado.negrito || par.tipo !== 'texto', m: (faixas.find(f => cortes[c] >= f.a && cortes[c + 1] <= f.b) || {}).c || '' });
            }
            pos += parte.length;
          });
        });
        return { tipo: par.tipo, trechos };
      });
    }

    // A prévia do documento (a mesma folha da prévia do campo de texto): os trechos marcados saem com fundo verde.
    function leituraPreviaMontar(modelo) {
      const raiz = document.createDocumentFragment();
      const dica = document.createElement('p');
      dica.className = 'visor-dica';
      dica.textContent = 'Prévia aproximada: no Word a página é A4, com margens de 1 cm, e as linhas podem quebrar em outros pontos. Os trechos que você marcou saem com a cor da marcação. Use A− e A+ para o tamanho da letra e finalize em Exportar para Word.';
      const folha = document.createElement('article');
      folha.className = 'visor-folha doc';
      modelo.forEach(par => {
        const p = document.createElement('p');
        p.className = 'doc-p leit' + (par.tipo === 'titulo' ? ' titulo' : par.tipo === 'subtitulo' ? ' sub' : '');
        par.trechos.forEach(t => {
          const pedaco = document.createElement(t.m ? 'mark' : 'span');
          pedaco.className = (t.m ? 'doc-m ' : '') + (t.b ? 'doc-b' : '');
          if (t.m) pedaco.dataset.c = t.m;
          pedaco.textContent = t.texto;
          p.append(pedaco);
        });
        folha.append(p);
      });
      raiz.append(dica, folha);
      return raiz;
    }

    // Abre a prévia (a página em tela cheia do documento Word), onde se escolhe o tamanho da letra e se baixa ou compartilha o arquivo.
    function leituraWordAbrir(origem) {
      if (!leituraTextoDaVista || leituraVista.hidden || !visor.hidden) return;
      const modelo = leituraModeloDoc();
      visorAbrir('Prévia do documento Word', origem, 'texto');
      visorDoc = { texto: '', nome: docxNomeDaLeitura(), acentos: null, modelo };
      visorBotoesDeExportar();
      visorTitulo.textContent = visorTituloDoc();
      visorCorpo.replaceChildren(leituraPreviaMontar(modelo));
      visorCorpo.scrollTop = 0;
    }

    // ---- Salvar o áudio (tela Leitura, texto diário e comentários) ----
    // O app pede ao servidor as partes do texto (as mesmas da leitura, 3 de cada vez; as que já foram ouvidas estão guardadas e não são pedidas de
    // novo), junta os MP3 num arquivo só e oferece compartilhar ou baixar. Vale por até 30 minutos (cerca de 6 MB) a partir de onde a leitura
    // parou: texto maior sai em mais de um arquivo, avançando o ponto de partida. Gerar leva uns 14 s por parte de 1.450 caracteres. O aviso e os
    // botões ficam no tocador (a caixa #vozAudioBox), que se abre sozinho quando o salvar é pedido sem leitura.
    const AUDIO_MAX_CARACTERES = 27000; // ≈ 30 min de fala (15 caracteres por segundo)
    const AUDIO_PARALELO = 3;
    const leituraAudioBtn = document.getElementById('leituraAudioBtn');
    const audioBox = document.getElementById('vozAudioBox');
    const audioTxt = document.getElementById('vozAudioTxt');
    const audioAcoes = {
      salvar: document.getElementById('vozAudioSalvar'),
      compartilhar: document.getElementById('vozAudioCompartilhar'),
      baixar: document.getElementById('vozAudioBaixar'),
      cancelar: document.getElementById('vozAudioCancelar'),
      fechar: document.getElementById('vozAudioFechar')
    };
    let audioPronto = null; // { blob, nome }
    let audioGerando = null; // { cancelado }
    let audioCtx = null; // o que o botão Salvar áudio vai gerar: { unidades, desde, uso, acesso(), base(), lugar }
    let audioLugar = null; // onde o tocador abre se a caixa precisar dele

    // Mostra a caixa do áudio; se o tocador está fechado (o salvar foi pedido sem leitura), abre só com ela.
    function audioMostrar(texto, botoes, ctx) {
      if (ctx) audioCtx = ctx;
      audioBox.hidden = !texto;
      audioTxt.textContent = texto || '';
      Object.entries(audioAcoes).forEach(([nome, botao]) => {
        botao.hidden = !(botoes || []).includes(nome) || (nome === 'compartilhar' && document.getElementById('exportarCompartilharBtn').hidden);
      });
      leituraAudioBtn.disabled = Boolean(audioGerando);
      vozBarAjustar();
      if (texto && vozBar.hidden) {
        vozBarEm(audioLugar || (audioCtx && audioCtx.lugar) || vozBar.parentNode);
        vozControlesAtivos(false);
        vozBar.classList.add('so-audio');
        vozBar.hidden = false;
      }
    }

    function audioFechar() {
      audioMostrar('', []);
      if (!leitorAtivo) {
        vozBar.hidden = true;
        vozBar.classList.remove('so-audio');
        vozProgresso.hidden = true;
      }
    }

    // Descarta o que o salvar áudio guardou (as partes da Leitura na memória e o arquivo pronto): saindo da tela Leitura, limpando o texto ou trocando o arquivo.
    function leituraAudioLimpar() {
      if (audioGerando) audioGerando.cancelado = true;
      audioGerando = null;
      audioPronto = null;
      [...vozCache.entries()].forEach(([chave, entrada]) => { if (entrada.uso === 'leitura') vozCache.delete(chave); });
      if (!leitorAtivo) audioFechar();
      else audioMostrar('', []);
    }

    // MP3 em bytes, sem a etiqueta ID3 do começo e sem o quadro Xing/Info (que descreve só aquela parte): assim as partes juntam num arquivo só.
    function audioMp3Bytes(uri) {
      const bruto = atob(uri.slice(uri.indexOf(',') + 1));
      const bytes = new Uint8Array(bruto.length);
      for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
      let i = 0;
      if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes.length > 10) i = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
      while (i + 4 < bytes.length && !(bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0)) i++;
      const versao = (bytes[i + 1] >> 3) & 3; // 3 = MPEG 1; 2 = MPEG 2; 0 = MPEG 2.5
      const camada = (bytes[i + 1] >> 1) & 3; // 1 = Layer III
      const kbps = (versao === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bytes[i + 2] >> 4] || 0;
      const hz = ({ 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }[versao] || [])[(bytes[i + 2] >> 2) & 3] || 0;
      if (camada === 1 && kbps && hz) {
        const tamanho = Math.floor((versao === 3 ? 144000 : 72000) * kbps / hz) + ((bytes[i + 2] >> 1) & 1);
        const inicio = String.fromCharCode(...bytes.subarray(i + 4, Math.min(bytes.length, i + 44)));
        if (/Xing|Info/.test(inicio)) i += tamanho;
      }
      return bytes.subarray(Math.min(i, bytes.length));
    }

    const audioDuracao = blob => new Promise(resolver => {
      const teste = new Audio();
      const url = URL.createObjectURL(blob);
      const fim = valor => { URL.revokeObjectURL(url); resolver(valor); };
      teste.preload = 'metadata';
      teste.onloadedmetadata = () => fim(Number.isFinite(teste.duration) ? teste.duration : 0);
      teste.onerror = () => fim(0);
      setTimeout(() => fim(0), 4000);
      teste.src = url;
    });

    // ctx: { unidades, desde, uso, acesso(), base(), lugar }. As unidades são as da leitura (frases com o texto falado).
    async function audioSalvar(ctx) {
      if (audioGerando) return;
      audioPronto = null;
      audioCtx = ctx;
      audioLugar = ctx.lugar || null;
      const aviso = (ctx.acesso && ctx.acesso()) || (!navigator.onLine ? 'Sem conexão com a internet.' : '');
      if (aviso) return audioMostrar(aviso, ['fechar'], ctx);
      await vozCarregarRegras();
      const { unidades, desde } = ctx;
      let fim = desde;
      let caracteres = 0;
      while (fim < unidades.length) {
        const n = unidades[fim].falado.length + 1;
        if (caracteres + n > AUDIO_MAX_CARACTERES && fim > desde) break;
        caracteres += n;
        fim++;
      }
      const partes = leitorPartes(unidades.slice(0, fim), desde, Number(vozVelocidade.value) || 1);
      if (!partes.length) return audioMostrar('Não há texto para gravar neste trecho.', ['fechar'], ctx);
      const faltam = partes.filter(p => !vozCache.has(vozChaveCache(p.texto))).length;
      const minutos = Math.max(1, Math.round(caracteres / 15 / 60));
      const ate = fim < unidades.length ? ' O texto continua depois deste trecho: para o resto, avance o ponto de partida e salve de novo.' : '';
      if (faltam) {
        const segundos = Math.ceil(faltam / AUDIO_PARALELO) * 15;
        const demora = segundos < 90 ? 'uns ' + segundos + ' segundos' : 'uns ' + Math.round(segundos / 60) + ' minutos';
        const pergunta = 'Salvar o áudio de cerca de ' + minutos + ' min' + (desde ? ', a partir de onde a leitura parou' : '') + '? Faltam gerar ' + faltam + ' de ' + partes.length +
          ' partes, o que leva ' + demora + '. As partes que você já ouviu não são cobradas de novo.' + ate;
        if (!(await askConfirm(pergunta, 'Salvar o áudio', { ok: 'Gerar', cancel: 'Cancelar' }))) return audioMostrar(audioBox.hidden ? '' : audioTxt.textContent, audioBox.hidden ? [] : ['salvar', 'fechar'], ctx);
      }
      const tarefa = { cancelado: false };
      audioGerando = tarefa;
      const entradas = new Array(partes.length);
      let feitas = partes.length - faltam;
      let proxima = 0;
      audioMostrar('Gerando o áudio… ' + feitas + ' de ' + partes.length + ' partes', ['cancelar'], ctx);
      const trabalhar = async () => {
        while (!tarefa.cancelado) {
          const i = proxima++;
          if (i >= partes.length) return;
          entradas[i] = await vozBuscar(
            partes[i].texto,
            null,
            ctx.uso,
            ctx.uso === 'texto-diario' && ctx.vozExtra
              ? { data: ctx.vozExtra.data, vozCupom: ctx.vozExtra.vozCupom, origem: partes[i].origem || '' }
              : null
          );
          feitas++;
          if (!tarefa.cancelado) audioMostrar('Gerando o áudio… ' + feitas + ' de ' + partes.length + ' partes', ['cancelar']);
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(AUDIO_PARALELO, partes.length) }, trabalhar));
        if (tarefa.cancelado) return;
        if (entradas.some(e => !e || !/^data:audio\/mpeg/.test(e.uri))) throw new Error('O servidor devolveu um áudio em formato que não dá para juntar.');
        const blob = new Blob(entradas.map(e => audioMp3Bytes(e.uri)), { type: 'audio/mpeg' });
        const base = removeUnicodeFormatting(String(ctx.base ? ctx.base() : 'Leitura')).replace(DOCX_EMOJI, ' ').replace(/[\\/:*?"<>|“”‘’]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Leitura';
        const nome = base + ' - áudio' + (desde ? ' (a partir de ' + Math.round((desde / unidades.length) * 100) + '%)' : '') + '.mp3';
        const duracao = (await audioDuracao(blob)) || caracteres / 15;
        audioPronto = { blob, nome };
        audioGerando = null;
        audioMostrar('✅ Áudio pronto: ' + leitorHora(duracao) + ' · ' + (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB.' + ate, ['compartilhar', 'baixar', 'fechar']);
      } catch (e) {
        tarefa.cancelado = true;
        if (audioGerando === tarefa) audioGerando = null;
        audioMostrar((e && e.message ? e.message : 'Não consegui gerar o áudio.') + ' As partes que deram certo ficam guardadas: tocar em Salvar áudio de novo continua de onde parou.', ['salvar', 'fechar']);
      }
    }

    audioAcoes.salvar.addEventListener('click', () => { if (audioCtx) audioSalvar(audioCtx); });
    audioAcoes.cancelar.addEventListener('click', () => {
      if (audioGerando) audioGerando.cancelado = true;
      audioGerando = null;
      audioMostrar('Geração do áudio cancelada. As partes já geradas ficam guardadas.', ['salvar', 'fechar']);
    });
    audioAcoes.fechar.addEventListener('click', audioFechar);
    [['compartilhar', true], ['baixar', false]].forEach(([nome, compartilhar]) => audioAcoes[nome].addEventListener('click', async () => {
      if (!audioPronto) return;
      const mensagem = await docxEntregar(audioPronto.blob, audioPronto.nome, compartilhar);
      if (mensagem) audioMostrar(mensagem, ['compartilhar', 'baixar', 'fechar']);
    }));

    // 💾 Áudio da tela Leitura: a partir da frase em que a leitura parou (ou do começo).
    leituraAudioBtn.addEventListener('click', () => {
      if (audioGerando || leituraVista.hidden || !leituraUnidades.length) return;
      audioSalvar({
        unidades: leituraUnidades,
        desde: leituraPosicao > 0 && leituraPosicao < leituraUnidades.length ? leituraPosicao : 0,
        uso: 'leitura',
        acesso: () => (!codigoLeituraSalvo() ? 'Salve o código de leitura em Ajustes → 🔐 Autorização de acessos.' : ''),
        base: leituraNomeBase,
        lugar: leituraBarra
      });
    });

    // ---- Leitor com destaque (tela Leitura e texto diário) ----
    // Quem chama dá as unidades (frases ou parágrafos, cada uma com o texto que será FALADO e o elemento a destacar) e o leitor cuida do resto:
    // junta em partes, pede o áudio à frente, toca, destaca a unidade que está tocando e mostra o andamento (barra e percentual).
    //
    // Qual unidade está tocando? A voz não devolve o instante de cada palavra, então o app estima. (1) De início, pelo PESO do texto: os
    // caracteres mais uma pausa para cada ponto final (7), vírgula (3) e quebra de parágrafo (5), na proporção do tempo tocado. Só por
    // caracteres, o destaque se adiantava no meio de cada parte, porque as pausas da voz atrasam a fala. (2) Assim que o áudio da parte é
    // decodificado, o app acha nele as PAUSAS (silêncio de 0,28 s ou mais) e as casa com as trocas de frase: a frase seguinte passa a ser
    // destacada quando a fala dela começa de verdade. As trocas sem pausa achada ficam na proporção do peso entre as âncoras vizinhas.
    const LEITOR_ATRASO = 0.1;     // s: a fala chega ao ouvido um pouco depois do relógio do áudio
    const LEITOR_PAUSA_MIN = 0.28; // s de silêncio que contam como pausa entre frases
    const vozProgresso = document.getElementById('vozProgresso');
    const vozProgressoPreench = document.getElementById('vozProgressoPreench');
    const vozInfo = document.getElementById('vozInfo');
    let leitorAtivo = null; // quem está lendo agora: { destacar(indice, fracaoDentroDaUnidade), limpar() }
    let leitorPct = -1;

    // Nome, qualidade, tom e altura da voz escolhidos pelo administrador em Ajustes (vêm com as regras públicas da voz). Se o servidor tiver
    // caído na voz reserva (Chirp 3 HD), avisa.
    function vozInfoMostrar(geminiReal) {
      const d = vozRegras && vozRegras.descricao;
      if (!d) {
        vozInfo.hidden = true;
        return;
      }
      const partes = ['Voz ' + (vozEscolhida || d.voz), d.qualidade];
      if (d.tom) partes.push('tom ' + d.tom.toLowerCase());
      if (d.altura) partes.push('altura ' + d.altura.toLowerCase());
      vozInfo.textContent = partes.join(' · ') + (d.gemini && geminiReal === false ? ' (agora com a voz reserva, Chirp 3 HD)' : '');
      vozInfo.hidden = false;
    }

    // 0:05, 12:40 ou 1:02:15.
    function leitorHora(segundos) {
      const total = Math.max(0, Math.round(segundos));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    }

    function leitorTempoMostrar(atual, total) {
      document.getElementById('vozTempoAtual').textContent = leitorHora(atual);
      document.getElementById('vozTempoTotal').textContent = leitorHora(total);
    }

    function leitorProgresso(fracao) {
      const pct = Math.max(0, Math.min(100, Math.round(fracao * 100)));
      vozProgressoPreench.style.width = Math.max(0, Math.min(100, fracao * 100)) + '%';
      vozProgresso.setAttribute('aria-valuenow', String(pct));
      vozProgresso.hidden = false;
      if (pct !== leitorPct && leitorAtivo) {
        leitorPct = pct;
        vozStatus.textContent = '🔊 Lendo… ' + pct + '%';
      }
    }

    // Peso de um trecho falado: caracteres mais as pausas (pontuação seguida de espaço ou do fim).
    function leitorPeso(texto) {
      return texto.length + 7 * (texto.match(/[.!?…]+(?=\s|$)/g) || []).length + 3 * (texto.match(/[,;:](?=\s|$)/g) || []).length;
    }

    // Corta um texto longo demais para uma parte (sem palavra pelo meio, se houver espaço onde cortar).
    function leitorCortar(texto, limite) {
      const pedacos = [];
      let resto = texto;
      while (resto.length > limite) {
        let corte = resto.lastIndexOf(' ', limite);
        if (corte < limite * 0.5) corte = limite;
        pedacos.push(resto.slice(0, corte).trim());
        resto = resto.slice(corte).trim();
      }
      if (resto) pedacos.push(resto);
      return pedacos;
    }

    // Junta as unidades, a partir de `desde`, em partes para o servidor (a 1ª curta, as seguintes do tamanho que vozLimiteDaParte calcula).
    // Cada parte guarda, por trecho, onde ele começa e termina no texto e o peso acumulado, para achar a unidade pelo ponto do áudio.
    function leitorPartes(unidades, desde, velocidade) {
      const partes = [];
      let atual = null;
      const limite = () => vozLimiteDaParte(partes.map(p => p.texto.length), velocidade);
      for (let i = desde; i < unidades.length; i++) {
        const u = unidades[i];
        if (!u.falado) continue;
        leitorCortar(u.falado, VOZ_MAX_PARTE).forEach(pedaco => {
          if (atual && atual.texto.length + 1 + pedaco.length > limite()) { partes.push(atual); atual = null; }
          if (!atual) atual = { texto: '', origem: '', origens: new Set(), trechos: [], paragrafo: u.paragrafo, peso: 0, tempos: null };
          const quebra = Boolean(atual.texto) && u.paragrafo !== atual.paragrafo;
          const separador = atual.texto ? (quebra ? '\n' : ' ') : '';
          if (quebra) atual.peso += 5;
          const inicio = atual.texto.length + separador.length;
          atual.texto += separador + pedaco;
          if (u.origem && !atual.origens.has(i)) {
            atual.origens.add(i);
            atual.origem = atual.origem ? atual.origem + '\n' + u.origem : u.origem;
          }
          const pesoInicio = atual.peso;
          atual.peso += leitorPeso(pedaco);
          atual.trechos.push({ indice: i, inicio, fim: atual.texto.length, pesoInicio, pesoFim: atual.peso });
          atual.paragrafo = u.paragrafo;
        });
      }
      if (atual) partes.push(atual);
      let acumulado = 0;
      partes.forEach(p => { p.pesoAntes = acumulado; acumulado += p.peso; });
      partes.pesoTotal = acumulado || 1;
      return partes;
    }

    // ---- As pausas do próprio áudio ----
    // Trechos de silêncio de LEITOR_PAUSA_MIN ou mais, fora do começo e do fim. dados: amostras em mono. O silêncio é medido contra o nível
    // da fala do próprio áudio (o percentil 90 da energia), então não depende do volume.
    function leitorPausas(dados, taxa) {
      const janela = Math.max(1, Math.round(taxa * 0.02));
      const n = Math.floor(dados.length / janela);
      if (n < 20) return [];
      const rms = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let soma = 0;
        for (let j = i * janela, fim = j + janela; j < fim; j++) soma += dados[j] * dados[j];
        rms[i] = Math.sqrt(soma / janela);
      }
      const fala = Array.from(rms).sort((a, b) => a - b)[Math.floor(n * 0.9)];
      const limite = Math.max(fala * 0.07, 0.0015);
      const minimo = Math.ceil(LEITOR_PAUSA_MIN / 0.02);
      const pausas = [];
      let inicio = -1;
      for (let i = 0; i <= n; i++) {
        const quieto = i < n && rms[i] < limite;
        if (quieto && inicio < 0) inicio = i;
        if (!quieto && inicio >= 0) {
          if (inicio > 0 && i < n && i - inicio >= minimo) pausas.push({ ini: inicio * 0.02, fim: i * 0.02 });
          inicio = -1;
        }
      }
      return pausas;
    }

    // Casa as trocas de unidade da parte com as pausas achadas no áudio (alinhamento por programação dinâmica: cada troca vai para a pausa mais
    // próxima do tempo esperado pelo peso, de preferência a mais longa; pausas sobrando, como as de vírgula, e trocas sem pausa são puladas) e
    // guarda em parte.tempos o instante em que cada trecho começa a ser falado.
    function leitorAlinhar(parte, duracao, pausas) {
      const trechos = parte.trechos;
      const tempos = trechos.map(t => (duracao * t.pesoInicio) / parte.peso); // estimativa por peso
      const trocas = []; // índices dos trechos em que começa uma unidade nova
      trechos.forEach((t, k) => { if (k && t.indice !== trechos[k - 1].indice) trocas.push(k); });
      if (!trocas.length || !pausas.length) {
        parte.tempos = tempos;
        return;
      }
      const B = trocas.length;
      const N = pausas.length;
      const janela = Math.max(1.5, duracao * 0.25);
      const PULO = 0.9; // o que custa deixar uma troca sem pausa
      const dp = Array.from({ length: B + 1 }, () => new Float32Array(N + 1));
      const escolha = Array.from({ length: B + 1 }, () => new Uint8Array(N + 1)); // 0 = pula a pausa, 1 = pula a troca, 2 = casa
      for (let b = 1; b <= B; b++) { dp[b][0] = dp[b - 1][0] - PULO; escolha[b][0] = 1; }
      for (let b = 1; b <= B; b++) {
        for (let j = 1; j <= N; j++) {
          let melhor = dp[b][j - 1];
          let como = 0;
          if (dp[b - 1][j] - PULO > melhor) { melhor = dp[b - 1][j] - PULO; como = 1; }
          const distancia = Math.abs(pausas[j - 1].fim - tempos[trocas[b - 1]]);
          if (distancia <= janela) {
            const casa = dp[b - 1][j - 1] + 1 - distancia / janela + Math.min(pausas[j - 1].fim - pausas[j - 1].ini, 1);
            if (casa > melhor) { melhor = casa; como = 2; }
          }
          dp[b][j] = melhor;
          escolha[b][j] = como;
        }
      }
      const ancoras = new Map(); // índice do trecho → instante em que a fala dele começa
      for (let b = B, j = N; b > 0 && j > 0;) {
        if (escolha[b][j] === 2) { ancoras.set(trocas[b - 1], Math.max(0, pausas[j - 1].fim - 0.04)); b--; j--; }
        else if (escolha[b][j] === 1) b--;
        else j--;
      }
      if (ancoras.size) {
        // Sem âncora, o trecho fica na proporção do peso entre a âncora anterior e a seguinte (o começo e o fim da parte também são âncoras).
        const pesoDe = k => (k >= trechos.length ? parte.peso : trechos[k].pesoInicio);
        let k0 = 0;
        let t0 = 0;
        for (let k = 0; k < trechos.length; k++) {
          if (ancoras.has(k)) {
            tempos[k] = ancoras.get(k);
            k0 = k;
            t0 = tempos[k];
            continue;
          }
          let k1 = trechos.length;
          let t1 = duracao;
          for (let m = k + 1; m < trechos.length; m++) if (ancoras.has(m)) { k1 = m; t1 = ancoras.get(m); break; }
          const faixa = pesoDe(k1) - pesoDe(k0);
          tempos[k] = faixa > 0 ? t0 + ((t1 - t0) * (pesoDe(k) - pesoDe(k0))) / faixa : t0;
        }
        for (let k = 1; k < tempos.length; k++) if (tempos[k] < tempos[k - 1]) tempos[k] = tempos[k - 1];
      }
      parte.tempos = tempos;
    }

    // Decodifica o áudio da parte (a 8 kHz em mono, bem leve) e alinha. Roda em segundo plano: até terminar, vale a estimativa por peso.
    async function leitorAnalisar(entrada, parte) {
      try {
        const Contexto = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Contexto) return;
        const bytes = await (await fetch(entrada.uri)).arrayBuffer();
        const contexto = new Contexto(1, 8000, 8000);
        const buffer = await new Promise((ok, falha) => {
          const promessa = contexto.decodeAudioData(bytes, ok, falha);
          if (promessa && promessa.catch) promessa.catch(falha);
        });
        leitorAlinhar(parte, buffer.duration, leitorPausas(buffer.getChannelData(0), buffer.sampleRate));
      } catch (e) { /* sem a análise do áudio, vale a estimativa por peso */ }
    }

    // O instante (em segundos do áudio da parte) em que começa cada trecho: o achado nas pausas do áudio ou, sem ele, a estimativa pelo peso.
    const leitorTempos = (parte, duracao) => parte.tempos || parte.trechos.map(x => (duracao * x.pesoInicio) / parte.peso);

    // ⏭️ Avançar: pula para o começo da próxima frase (o áudio da parte vai até lá) ou, na última frase da parte, para o fim dela, e a leitura segue
    // com a parte seguinte. Uma frase longa cortada em pedaços conta como uma só.
    let leitorParteAtual = null; // a parte do áudio que está tocando
    function leitorAvancar() {
      const parte = leitorParteAtual;
      const duracao = vozAudio.duration;
      if (!leitorAtivo || !parte || !Number.isFinite(duracao) || duracao <= 0) return;
      const tempos = leitorTempos(parte, duracao);
      const t = Math.max(0, vozAudio.currentTime - LEITOR_ATRASO);
      let k = 0;
      for (let i = tempos.length - 1; i > 0; i--) if (t >= tempos[i]) { k = i; break; }
      let proximo = k + 1;
      while (proximo < parte.trechos.length && parte.trechos[proximo].indice === parte.trechos[k].indice) proximo++;
      vozAudio.currentTime = proximo < parte.trechos.length ? Math.min(duracao - 0.05, tempos[proximo] + LEITOR_ATRASO + 0.02) : Math.max(0, duracao - 0.05);
    }
    vozAvancarBtn.addEventListener('click', leitorAvancar);

    // ⏮️ Voltar: leva a leitura ao começo da frase anterior. Se ela está na parte do áudio que está tocando, o áudio volta até lá; se está numa
    // parte anterior (a frase atual abre a parte), a leitura recomeça dela. No começo do texto, recomeça a primeira frase.
    let leitorUnidades = []; // as unidades da leitura em andamento
    function leitorVoltar() {
      const parte = leitorParteAtual;
      const duracao = vozAudio.duration;
      if (!leitorAtivo || !parte || !Number.isFinite(duracao) || duracao <= 0) return;
      const tempos = leitorTempos(parte, duracao);
      const t = Math.max(0, vozAudio.currentTime - LEITOR_ATRASO);
      let k = 0;
      for (let i = tempos.length - 1; i > 0; i--) if (t >= tempos[i]) { k = i; break; }
      const primeiro = j => { while (j > 0 && parte.trechos[j - 1].indice === parte.trechos[j].indice) j--; return j; };
      const inicioAtual = primeiro(k);
      if (inicioAtual > 0) {
        vozAudio.currentTime = Math.min(duracao - 0.05, tempos[primeiro(inicioAtual - 1)] + LEITOR_ATRASO + 0.02);
        return;
      }
      let anterior = parte.trechos[k].indice - 1;
      while (anterior >= 0 && !leitorUnidades[anterior].falado) anterior--;
      if (anterior < 0) { vozAudio.currentTime = 0.02; return; }
      const cfg = leitorAtivo;
      const unidades = leitorUnidades;
      leitorLer({ ...cfg, preparar: () => ({ unidades, desde: anterior }) });
    }
    vozVoltarBtn.addEventListener('click', leitorVoltar);

    // Recomeça a leitura na frase que está tocando (usado ao trocar a voz: as partes já pedidas à frente têm a voz antiga).
    function leitorRecomecarNaFrase() {
      const parte = leitorParteAtual;
      const duracao = vozAudio.duration;
      if (!leitorAtivo || !parte || !Number.isFinite(duracao) || duracao <= 0) return;
      const tempos = leitorTempos(parte, duracao);
      const t = Math.max(0, vozAudio.currentTime - LEITOR_ATRASO);
      let k = 0;
      for (let i = tempos.length - 1; i > 0; i--) if (t >= tempos[i]) { k = i; break; }
      const cfg = leitorAtivo;
      const unidades = leitorUnidades;
      const desde = parte.trechos[k].indice;
      leitorLer({ ...cfg, preparar: () => ({ unidades, desde }) });
    }

    // Peso do que vem antes da unidade `ate` (o mesmo cálculo das partes): quando a leitura recomeça no meio do texto, o andamento conta o texto todo.
    function leitorPesoAte(unidades, ate) {
      let peso = 0;
      let paragrafo = null;
      for (let i = 0; i < ate && i < unidades.length; i++) {
        if (!unidades[i].falado) continue;
        if (paragrafo !== null && unidades[i].paragrafo !== paragrafo) peso += 5;
        peso += leitorPeso(unidades[i].falado);
        paragrafo = unidades[i].paragrafo;
      }
      return peso;
    }

    // A unidade que está tocando agora, pelo ponto do áudio dentro da parte, e o andamento do texto todo.
    function leitorAcompanhar(parte, pesoTotal) {
      const duracao = vozAudio.duration;
      if (!leitorAtivo || !Number.isFinite(duracao) || duracao <= 0) return;
      const t = Math.max(0, vozAudio.currentTime - LEITOR_ATRASO);
      const tempos = leitorTempos(parte, duracao);
      let k = 0;
      for (let i = tempos.length - 1; i > 0; i--) if (t >= tempos[i]) { k = i; break; }
      const fim = k + 1 < tempos.length ? tempos[k + 1] : duracao;
      const fracao = fim > tempos[k] ? Math.min(1, Math.max(0, (t - tempos[k]) / (fim - tempos[k]))) : 0;
      leitorAtivo.destacar(parte.trechos[k].indice, fracao);
      const feito = parte.pesoAntes + Math.min(1, t / duracao) * parte.peso;
      leitorProgresso(feito / pesoTotal);
      // O tempo tocado e o total: segundos de áudio por peso de texto vêm da parte que está tocando; a velocidade escolhida encurta o tempo.
      const segundosPorPeso = duracao / parte.peso / (vozAudio.playbackRate || 1);
      leitorTempoMostrar(feito * segundosPorPeso, pesoTotal * segundosPorPeso);
    }

    // Chamada por vozParar: a leitura acabou ou foi interrompida.
    function leitorAoParar() {
      if (leitorAtivo) {
        const quem = leitorAtivo;
        leitorAtivo = null;
        try { quem.limpar(); } catch (e) { /* a tela mudou */ }
      }
      vozProgresso.hidden = true;
      leitorPct = -1;
    }

    // cfg: { lugar, uso: 'leitura' | 'texto-diario', acesso(), preparar(regras), destacar, limpar,
    //        vozExtra?: { data, vozCupom } (obrigatório em texto-diario) }
    async function leitorLer(cfg) {
      if (vozSessao && !vozBar.hidden && !vozPauseBtn.hidden) vozParar(); // tocar de novo recomeça
      // Dentro do toque: libera o áudio no iPhone antes de qualquer espera.
      vozAudio.src = vozSilencio();
      vozAudio.play().catch(() => {});
      vozBarEm(cfg.lugar);
      vozProgresso.hidden = true;
      if (!audioGerando) audioMostrar('', []); // a oferta de salvar a leitura anterior some

      const regras = await vozCarregarRegras();
      vozInfoMostrar();
      const acesso = cfg.acesso();
      if (acesso) {
        vozMensagem(acesso, true);
        return vozControlesAtivos(false);
      }
      const preparo = cfg.preparar(regras);
      if (typeof preparo === 'string') {
        vozMensagem(preparo, true);
        return vozControlesAtivos(false);
      }
      let velocidadeSalva = null;
      try { velocidadeSalva = localStorage.getItem(VOZ_SPEED_KEY); } catch (e) { /* sem localStorage */ }
      if (!velocidadeSalva) vozVelocidade.value = vozVelocidadePerto(regras.velocidade);
      const partes = leitorPartes(preparo.unidades, preparo.desde, Number(vozVelocidade.value) || 1);
      if (!partes.length) {
        vozMensagem('Não há texto para ouvir.', true);
        return vozControlesAtivos(false);
      }
      // O andamento é do texto todo: recomeçando no meio, a barra já parte do ponto em que está (e não de 0%).
      const pesoBase = leitorPesoAte(preparo.unidades, preparo.desde);
      partes.forEach(parte => { parte.pesoAntes += pesoBase; });
      partes.pesoTotal += pesoBase;
      leitorUnidades = preparo.unidades;

      leitorAtivo = cfg;
      leitorPct = Math.round((pesoBase / partes.pesoTotal) * 100); // a mensagem "Gerando o áudio…" fica até a primeira parte começar a tocar
      const sessao = ++vozSessao;
      vozControlesAtivos(true);
      vozMensagem('Gerando o áudio…', false);
      leitorProgresso(pesoBase / partes.pesoTotal);
      try {
        // Duas partes sempre sendo preparadas à frente (veja vozLimiteDaParte).
        const pedidos = [];
        const extrasDaParte = parte => (cfg.uso === 'texto-diario' && cfg.vozExtra
          ? { data: cfg.vozExtra.data, vozCupom: cfg.vozExtra.vozCupom, origem: parte.origem || '' }
          : null);
        const pedir = i => {
          if (i >= partes.length || pedidos[i]) return;
          pedidos[i] = vozBuscar(partes[i].texto, null, cfg.uso, extrasDaParte(partes[i])).then(entrada => {
            if (sessao === vozSessao) leitorAnalisar(entrada, partes[i]); // em segundo plano
            return entrada;
          });
          pedidos[i].catch(() => {}); // o erro aparece quando chegar a vez dela
        };
        pedir(0);
        pedir(1);
        for (let i = 0; i < partes.length; i++) {
          const entrada = await pedidos[i];
          if (sessao !== vozSessao) return;
          pedir(i + 2);
          if (i === 0) vozInfoMostrar(entrada.gemini);
          vozMensagem('🔊 Lendo… ' + Math.round(((partes[i].pesoAntes) / partes.pesoTotal) * 100) + '%', false);
          cfg.destacar(partes[i].trechos[0].indice, 0);
          const acompanhar = () => leitorAcompanhar(partes[i], partes.pesoTotal);
          vozAudio.addEventListener('timeupdate', acompanhar);
          leitorParteAtual = partes[i];
          try {
            await vozTocar(entrada);
          } finally {
            leitorParteAtual = null;
            vozAudio.removeEventListener('timeupdate', acompanhar);
          }
          if (sessao !== vozSessao) return;
          // As partes da Leitura ficam guardadas (cerca de 6 MB a cada 25 minutos) enquanto a tela está aberta: ouvir de novo não custa, e o áudio
          // pode ser salvo sem gerar de novo. Saindo da tela, limpando o texto ou trocando o arquivo, elas são descartadas (leituraAudioLimpar).
        }
        leitorProgresso(1);
        leitorAtivo = null;
        try {
          if (cfg.concluir) cfg.concluir(); // acabou: a próxima leitura começa do início
          cfg.limpar();
        } catch (e) { /* a tela mudou */ }
        vozMensagem('✅ Leitura concluída.', false);
        vozControlesAtivos(false);
        vozProgresso.hidden = true;
        // O tocador fica aberto com a oferta de salvar o áudio (✖️ ou Fechar o tiram): as partes ouvidas estão guardadas, então salvar não custa de novo.
        const ofertaTexto = 'Quer guardar o áudio desta leitura num arquivo MP3?';
        audioMostrar(ofertaTexto, ['salvar', 'fechar'], {
          unidades: preparo.unidades, desde: preparo.desde, uso: cfg.uso, acesso: cfg.acesso, base: cfg.nomeAudio || (() => 'Leitura'), lugar: cfg.lugar, vozExtra: cfg.vozExtra
        });
        // Só no texto diário e nos comentários dele (cfg.fecharOferta): a oferta se fecha sozinha depois do mesmo tempo de espera que inicia a
        // leitura (Ajustes → Leitura em voz alta; 0 = não fecha sozinha), se a pessoa não fez nada (não começou outra leitura, não pediu para
        // salvar e não há uma pergunta aberta na tela).
        const esperaFechar = vozTempoEsperaPadrao();
        if (cfg.fecharOferta && esperaFechar > 0) {
          setTimeout(() => {
            const intacta = sessao === vozSessao && !audioGerando && !audioBox.hidden && audioTxt.textContent === ofertaTexto && !confirmOverlay.classList.contains('open');
            if (intacta) audioFechar();
          }, esperaFechar * 1000);
        }
      } catch (e) {
        if (sessao !== vozSessao) return;
        leitorAtivo = null;
        vozProgresso.hidden = true;
        try { cfg.limpar(); } catch (erro) { /* a tela mudou */ }
        vozMensagem(e && e.message ? e.message : 'Não consegui ler o texto.', true);
        vozControlesAtivos(false);
      }
    }

    // ---- Tela Leitura: a vista de frases ----
    // Destaca a frase e a mantém à vista, a menos que a pessoa tenha acabado de rolar a vista por conta própria. A frase destacada é também o ponto
    // em que a leitura continua depois (leituraPosicao); sem destaque (-1: a leitura parou), esse ponto fica sublinhado.
    function leituraDestacar(indice) {
      if (indice === leituraDestaque) return;
      const anterior = leituraUnidades[leituraDestaque];
      if (anterior) anterior.el.classList.remove('lendo');
      leituraDestaque = indice;
      const u = leituraUnidades[indice];
      if (indice >= 0) {
        leituraMarcarParou(-1);
        leituraPosicao = indice;
        leituraGravarPosicao(false);
      } else {
        leituraMarcarParou(leituraPosicao);
      }
      if (!u) return;
      u.el.classList.add('lendo');
      if (Date.now() - leituraRolouEm < 6000) return;
      const topo = u.el.offsetTop;
      const base = topo + u.el.offsetHeight;
      if (topo < leituraVista.scrollTop + 16 || base > leituraVista.scrollTop + leituraVista.clientHeight - 16) {
        leituraVista.scrollTo({ top: Math.max(0, topo - leituraVista.clientHeight * 0.3), behavior: 'smooth' });
      }
    }

    // Saindo da tela Leitura, a leitura para (o tocador ficaria escondido).
    function leituraAoSair() {
      if (vozBar.parentNode === leituraBarra && !vozBar.hidden) vozParar();
      leituraAudioLimpar();
    }

    ['wheel', 'touchmove'].forEach(evento => leituraVista.addEventListener(evento, () => { leituraRolouEm = Date.now(); }, { passive: true }));

    // desde: índice da frase em que começar (toque numa frase da vista); sem ele, lê o texto do campo desde o início.
    function leituraCfg(desde) {
      return {
        lugar: leituraBarra,
        uso: 'leitura',
        acesso: () => (!codigoLeituraSalvo() ? 'Salve o código de leitura em Ajustes → 🔐 Autorização de acessos.' : !navigator.onLine ? 'Sem conexão com a internet.' : ''),
        preparar: () => {
          if (typeof desde === 'number') return { unidades: leituraUnidades, desde };
          leituraTexto.blur(); // some o teclado do celular
          leituraEstatAtualizar();
          if (!leituraAbrirVista()) return 'Cole um texto ou importe um arquivo para ouvir.';
          return { unidades: leituraUnidades, desde: 0 };
        },
        nomeAudio: leituraNomeBase,
        destacar: indice => leituraDestacar(indice),
        concluir: () => { leituraPosicao = 0; },
        limpar: () => {
          leituraDestacar(-1);
          leituraGravarPosicao(true);
        }
      };
    }

    const leituraLer = desde => leitorLer(leituraCfg(desde));

    // ---- Importar PDF ou Word ----
    const LEITURA_NS_WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    // Formato do texto da leitura: um parágrafo por bloco, separados por uma linha em branco; "# " no começo do parágrafo é um TÍTULO e
    // **assim** é negrito (um parágrafo todo em negrito é um subtítulo). Os arquivos importados já saem assim, e quem edita pode usar as mesmas marcas.

    // Junta trechos { negrito, texto } numa linha com **negrito**: os espaços de borda ficam fora das marcas e trechos vizinhos em negrito se fundem.
    function leituraMarcar(trechos) {
      let saida = '';
      trechos.forEach(t => {
        if (t.negrito && /\S/.test(t.texto)) {
          const m = t.texto.match(/^(\s*)([\s\S]*?)(\s*)$/);
          saida += m[1] + '**' + m[2] + '**' + m[3];
        } else {
          saida += t.texto;
        }
      });
      return saida.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
    }

    // ---- Word ----
    // Os trechos de um parágrafo do Word, na ordem, cada um com o seu negrito (w:b na formatação do trecho): texto (w:t), tabulações e quebras de
    // linha; sem o que foi apagado com alterações controladas e sem os parágrafos de dentro (caixas de texto), que viram parágrafos à parte.
    function leituraTrechosDoParagrafo(no, saida) {
      for (const filho of no.childNodes) {
        if (filho.nodeType !== 1) continue;
        const nome = filho.localName;
        if (nome === 'r') {
          let negrito = false;
          for (const parte of filho.childNodes) {
            if (parte.nodeType !== 1 || parte.localName !== 'rPr') continue;
            for (const prop of parte.childNodes) {
              if (prop.nodeType !== 1 || prop.localName !== 'b') continue;
              const valor = prop.getAttributeNS(LEITURA_NS_WORD, 'val') || prop.getAttribute('w:val');
              negrito = !(valor === '0' || valor === 'false');
            }
          }
          let texto = '';
          for (const parte of filho.childNodes) {
            if (parte.nodeType !== 1) continue;
            if (parte.localName === 't') texto += parte.textContent;
            else if (parte.localName === 'tab' || parte.localName === 'br' || parte.localName === 'cr') texto += ' ';
            else if (parte.localName === 'noBreakHyphen') texto += '-';
          }
          if (texto) saida.push({ negrito, texto });
        } else if (nome !== 'p' && nome !== 'del' && nome !== 'pPr' && nome !== 'rPr') {
          leituraTrechosDoParagrafo(filho, saida); // hiperligações, controles de conteúdo...
        }
      }
    }

    // O nível de título do parágrafo (estilo "Título 1", "Heading 2", "Title"… ou nível de tópicos do Word): 1 e 2 são títulos; os demais, subtítulos.
    function leituraNivelDoParagrafo(p) {
      for (const filho of p.childNodes) {
        if (filho.nodeType !== 1 || filho.localName !== 'pPr') continue;
        for (const prop of filho.childNodes) {
          if (prop.nodeType !== 1) continue;
          const valor = prop.getAttributeNS(LEITURA_NS_WORD, 'val') || prop.getAttribute('w:val') || '';
          if (prop.localName === 'pStyle') {
            const m = valor.match(/^(?:heading|t[ií]tulo|ttulo|title|subtitle|subt[ií]tulo)\s*(\d)?/i);
            if (m) return /^title$|^t[ií]tulo$/i.test(valor) ? 1 : Number(m[1]) || (/^sub/i.test(valor) ? 3 : 1);
          }
          if (prop.localName === 'outlineLvl' && /^\d$/.test(valor)) return Number(valor) + 1;
        }
      }
      return 0;
    }

    async function leituraLerDocx(buffer) {
      await loadScriptOnce(BACKUP_LIBS.jszip).catch(() => { throw new Error('Sem conexão para carregar o leitor de Word. Confira a internet e tente de novo.'); });
      let zip;
      try { zip = await window.JSZip.loadAsync(buffer); } catch (e) { throw new Error('Não consegui abrir este arquivo: ele não parece um documento do Word (.docx).'); }
      const principal = zip.file('word/document.xml');
      if (!principal) throw new Error('Não consegui abrir este arquivo: ele não parece um documento do Word (.docx).');
      const xml = (await principal.async('string')).replace(/^﻿/, '');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('O documento do Word está ilegível.');
      // Os cabeçalhos e rodapés do Word ficam em outros arquivos do .docx (header1.xml, footer1.xml): só word/document.xml é lido.
      const paragrafos = [];
      Array.from(doc.getElementsByTagNameNS(LEITURA_NS_WORD, 'p')).forEach(p => {
        const trechos = [];
        leituraTrechosDoParagrafo(p, trechos);
        const plano = trechos.map(t => t.texto).join('').replace(/\s+/g, ' ').trim();
        if (!plano) return;
        const nivel = leituraNivelDoParagrafo(p);
        const todoNegrito = trechos.filter(t => /\S/.test(t.texto)).every(t => t.negrito);
        if (plano.length <= 200 && nivel && nivel <= 2) paragrafos.push('# ' + plano);
        else if (plano.length <= 160 && (nivel || todoNegrito)) paragrafos.push('**' + plano + '**');
        else paragrafos.push(leituraMarcar(trechos));
      });
      return { paragrafos, paginas: 0, removidas: 0 };
    }

    // ---- PDF ----
    // O peso da fonte pelo nome dela (ex.: "AAAAAA+Arial-BoldMT", "Arial-Black"): 2 = pesada (Black/Heavy), 1 = negrito, 0 = normal.
    function leituraPesoDaFonte(nome) {
      const n = String(nome || '');
      if (/black|heavy|ultra/i.test(n)) return 2;
      if (/bold|semibold|demi/i.test(n)) return 1;
      return 0;
    }

    // As linhas de uma página do PDF (o pdf.js entrega pedaços de texto com a posição): pedaços na mesma altura formam uma linha. Cada linha
    // guarda o texto simples, o texto com **negrito**, a posição, o tamanho da letra e se está toda em negrito (e em fonte pesada).
    function leituraLinhasDaPagina(itens, pesoDaFonte) {
      const brutas = [];
      let atual = null;
      let fimX = 0;
      itens.forEach(item => {
        if (typeof item.str !== 'string') return;
        const x = item.transform[4];
        const y = item.transform[5];
        const tamanho = Math.hypot(item.transform[2], item.transform[3]) || item.height || 10;
        if (!atual || Math.abs(y - atual.y) > tamanho * 0.5) {
          atual = { y, x0: x, x1: x, tamanho, pecas: [] };
          brutas.push(atual);
          fimX = x;
        }
        let str = item.str;
        if (atual.pecas.length && x - fimX > tamanho * 0.3) {
          const ultimo = atual.pecas[atual.pecas.length - 1].texto;
          if (!/\s$/.test(ultimo) && !/^\s/.test(str)) str = ' ' + str;
        }
        // peso -1: peça neutra (espaço, emoji, símbolo), que não decide se a linha está em negrito.
        atual.pecas.push({ texto: str, peso: /[\p{L}\p{N}]/u.test(str) ? pesoDaFonte(item.fontName) : -1 });
        fimX = x + (item.width || 0);
        atual.x1 = Math.max(atual.x1, fimX);
        atual.tamanho = Math.max(atual.tamanho, tamanho);
        if (item.hasEOL) atual = null;
      });
      const linhas = [];
      brutas.forEach(b => {
        const decisivas = b.pecas.filter(p => p.peso >= 0);
        let negritoAtual = false;
        const trechos = b.pecas.map(p => {
          if (p.peso >= 0) negritoAtual = p.peso >= 1;
          return { texto: p.texto, negrito: negritoAtual };
        });
        let texto = b.pecas.map(p => p.texto).join('').replace(/\s+/g, ' ').trim();
        let marcado = leituraMarcar(trechos);
        // "---" e outras linhas só de traços e símbolos (separadores) não são texto; a marca de lista no começo também sai.
        if (!texto || /^[-–—_=~*•·.\s]{3,}$/.test(texto)) return;
        texto = texto.replace(/^[*•·▪‣◦]\s+/, '');
        marcado = marcado.replace(/^[*•·▪‣◦]\s+/, '');
        if (!texto) return;
        linhas.push({
          texto, marcado, y: b.y, x0: b.x0, x1: b.x1, tamanho: b.tamanho,
          todaNegrito: decisivas.length > 0 && decisivas.every(p => p.peso >= 1),
          pesada: decisivas.some(p => p.peso === 2)
        });
      });
      return linhas;
    }

    // Cabeçalhos e rodapés. Valem como candidatas as linhas das faixas do alto (12% da página) e do pé (10%) e as 2 primeiras e 2 últimas de cada
    // página; saem as que se repetem (com os números trocados por #) em pelo menos 40% das páginas e em 2 ou mais, mais os números de página
    // sozinhos ("12", "Página 3 de 10"). `paginas`: [{ linhas, altura }], alterado na hora. Devolve quantas linhas saíram.
    function leituraTirarCabecalhosERodapes(paginas) {
      const normalizar = texto => texto.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
      const soNumeroDePagina = /^[-–—\s]*(?:p[áa]g(?:ina)?\.?\s*)?#(?:\s*(?:de|\/|-)\s*#)?[-–—\s]*$/;
      const candidatas = pagina => pagina.linhas.map((l, i) => (l.y > pagina.altura * 0.88 || l.y < pagina.altura * 0.1 || i < 2 || i >= pagina.linhas.length - 2 ? i : -1)).filter(i => i >= 0);
      const contagem = new Map();
      paginas.forEach(pagina => {
        new Set(candidatas(pagina).map(i => normalizar(pagina.linhas[i].texto))).forEach(n => contagem.set(n, (contagem.get(n) || 0) + 1));
      });
      const minimo = Math.max(2, Math.ceil(paginas.length * 0.4));
      let removidas = 0;
      paginas.forEach(pagina => {
        const sair = new Set(candidatas(pagina).filter(i => {
          const n = normalizar(pagina.linhas[i].texto);
          return soNumeroDePagina.test(n) || contagem.get(n) >= minimo;
        }));
        if (sair.size) {
          pagina.linhas = pagina.linhas.filter((_, i) => !sair.has(i));
          removidas += sair.size;
        }
      });
      return removidas;
    }

    // O espaçamento normal entre linhas seguidas de um mesmo tamanho de letra, no documento todo (o valor abaixo do qual 30% das distâncias
    // ficam: dentro de um parágrafo as linhas estão sempre à mesma distância; entre parágrafos há um pouco mais). Map tamanho → distância.
    function leituraEspacamentos(paginas) {
      const porTamanho = new Map();
      paginas.forEach(pagina => {
        for (let i = 1; i < pagina.linhas.length; i++) {
          const d = pagina.linhas[i - 1].y - pagina.linhas[i].y;
          if (d <= 0 || Math.abs(pagina.linhas[i].tamanho - pagina.linhas[i - 1].tamanho) >= 1) continue;
          const k = Math.round(pagina.linhas[i].tamanho * 2) / 2;
          if (!porTamanho.has(k)) porTamanho.set(k, []);
          porTamanho.get(k).push(d);
        }
      });
      const normais = new Map();
      porTamanho.forEach((lista, k) => { if (lista.length >= 3) normais.set(k, lista.sort((a, b) => a - b)[Math.floor(lista.length * 0.3)]); });
      return normais;
    }

    // Das linhas de uma página aos parágrafos. Começa outro parágrafo quando: a linha é título ou subtítulo (linha toda em negrito, em fonte
    // pesada, maior que o corpo ou toda em maiúsculas); a distância da linha de cima passa do espaçamento normal desse tamanho de letra; a
    // linha de cima terminou antes da margem direita (o fim de um parágrafo); a linha é um item numerado. `corpo`: o tamanho da letra do texto
    // corrido; `normais`: leituraEspacamentos.
    function leituraParagrafosDeLinhas(linhas, corpo, normais) {
      if (!linhas.length) return [];
      const normalDoCorpo = normais.get(Math.round(corpo * 2) / 2) || corpo * 1.4;
      const normalDe = l => normais.get(Math.round(l.tamanho * 2) / 2) || (normalDoCorpo * l.tamanho) / corpo;
      const fins = linhas.filter(l => l.texto.length >= 40).map(l => l.x1).sort((a, b) => a - b);
      const direita = fins.length ? fins[Math.floor(fins.length * 0.85)] : Math.max(...linhas.map(l => l.x1));
      const esquerda = Math.min(...linhas.map(l => l.x0));
      const curta = l => l.x1 < direita - 0.12 * (direita - esquerda);
      const tipoDe = l => {
        if (l.texto.length > 160) return null;
        const maiuscula = l.texto === l.texto.toUpperCase() && l.texto.replace(/[^\p{L}]/gu, '').length >= 4;
        if (l.todaNegrito) return l.pesada || l.tamanho >= corpo * 1.15 || maiuscula ? 'titulo' : 'subtitulo';
        return l.tamanho >= corpo * 1.15 && l.texto.length <= 120 ? 'titulo' : null;
      };
      const blocos = [];
      let anterior = null;
      let tipoAnterior = null;
      linhas.forEach(l => {
        const tipo = tipoDe(l);
        const distancia = anterior ? anterior.y - l.y : 0;
        const normal = normalDe(l);
        const mesmoTitulo = tipo && tipo === tipoAnterior && distancia > 0 && distancia <= normal * 1.2;
        const continua = anterior && /^\p{Ll}/u.test(l.texto) && !/[.!?…:;"”’)]$/.test(anterior.texto);
        const novo = !anterior || (!mesmoTitulo && (tipo || tipoAnterior || distancia > normal * 1.09 || l.y - anterior.y > l.tamanho * 0.5 || (curta(anterior) && !continua) || /^(?:\d+[.)]|[a-z][.)])\s/.test(l.texto)));
        if (novo) blocos.push({ tipo, linhas: [l] });
        else blocos[blocos.length - 1].linhas.push(l);
        anterior = l;
        tipoAnterior = tipo;
      });
      return blocos.map(bloco => {
        // Palavra cortada com hífen no fim da linha é emendada.
        const juntar = campo => bloco.linhas.map(l => l[campo]).reduce((texto, proxima) => {
          if (!texto) return proxima;
          return /\p{L}-$/u.test(texto) && /^\p{Ll}/u.test(proxima) ? texto.slice(0, -1) + proxima : texto + ' ' + proxima;
        }, '');
        if (bloco.tipo === 'titulo') return '# ' + juntar('texto');
        if (bloco.tipo === 'subtitulo') return '**' + juntar('texto') + '**';
        return juntar('marcado').replace(/\*\*(\s*)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
      });
    }

    async function leituraLerPdf(buffer, aoProgresso) {
      await loadScriptOnce(LEITURA_PDFJS.script).catch(() => { throw new Error('Sem conexão para carregar o leitor de PDF. Confira a internet e tente de novo.'); });
      const pdfjs = window.pdfjsLib;
      if (!pdfjs) throw new Error('Não consegui carregar o leitor de PDF.');
      pdfjs.GlobalWorkerOptions.workerSrc = LEITURA_PDFJS.worker;
      let pdf;
      try {
        pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      } catch (e) {
        throw new Error(e && e.name === 'PasswordException' ? 'Este PDF está protegido por senha.' : 'Não consegui abrir este PDF.');
      }
      // Primeiro as linhas de todas as páginas (até o limite de caracteres): só assim dá para ver o que se repete em cada página.
      const paginas = [];
      let caracteres = 0;
      for (let n = 1; n <= pdf.numPages && caracteres <= LEITURA_MAX_CARACTERES; n++) {
        if (aoProgresso) aoProgresso(n, pdf.numPages);
        const pagina = await pdf.getPage(n);
        // O nome da fonte (Bold, Black…) só fica disponível depois que o pdf.js lê as operações da página; sem ele, valem só o tamanho e as maiúsculas.
        try { await pagina.getOperatorList(); } catch (e) { /* segue sem o nome das fontes */ }
        const conteudo = await pagina.getTextContent();
        const pesos = new Map();
        const pesoDaFonte = nome => {
          if (!pesos.has(nome)) {
            let peso = 0;
            try { peso = leituraPesoDaFonte(pagina.commonObjs.get(nome).name); } catch (e) { /* fonte não carregada */ }
            pesos.set(nome, peso);
          }
          return pesos.get(nome);
        };
        const linhas = leituraLinhasDaPagina(conteudo.items, pesoDaFonte);
        paginas.push({ linhas, altura: pagina.getViewport({ scale: 1 }).height });
        pagina.cleanup();
        caracteres += linhas.reduce((soma, l) => soma + l.texto.length + 1, 0);
      }
      const removidas = leituraTirarCabecalhosERodapes(paginas);
      // O tamanho do corpo do texto: o mais usado (em caracteres) em todo o documento.
      const porTamanho = new Map();
      paginas.forEach(p => p.linhas.forEach(l => { const k = Math.round(l.tamanho * 2) / 2; porTamanho.set(k, (porTamanho.get(k) || 0) + l.texto.length); }));
      let corpo = 10;
      let maior = 0;
      porTamanho.forEach((total, tamanho) => { if (total > maior) { maior = total; corpo = tamanho; } });
      const normais = leituraEspacamentos(paginas);
      const paragrafos = [];
      paginas.forEach(pagina => {
        const daPagina = leituraParagrafosDeLinhas(pagina.linhas, corpo, normais);
        // Frase que continua na página seguinte: emenda com o último parágrafo da anterior (títulos nunca se emendam).
        const ultimo = paragrafos[paragrafos.length - 1];
        if (daPagina.length && ultimo && !/^#\s/.test(ultimo) && !/^#\s/.test(daPagina[0]) && !/^\*\*[^*]+\*\*$/.test(daPagina[0]) && !/^\*\*[^*]+\*\*$/.test(ultimo) &&
            !/[.!?…:;"”’)\]]$/.test(ultimo.replace(/\*\*$/, '')) && /^(?:\*\*)?\p{Ll}/u.test(daPagina[0])) {
          paragrafos[paragrafos.length - 1] = (ultimo + ' ' + daPagina.shift()).replace(/\*\*(\s*)\*\*/g, '$1');
        }
        daPagina.forEach(p => paragrafos.push(p));
      });
      return { paragrafos, paginas: pdf.numPages, lidas: paginas.length, removidas };
    }

    async function leituraImportar(arquivo) {
      if (!arquivo) return;
      const nome = arquivo.name || 'arquivo';
      const tipo = (nome.match(/\.([^.]+)$/) || [])[1];
      const extensao = tipo ? tipo.toLowerCase() : '';
      if (extensao !== 'pdf' && extensao !== 'docx') {
        return leituraInfo('Formato não aceito. Escolha um arquivo PDF (.pdf) ou Word (.docx).', true);
      }
      if (arquivo.size > LEITURA_MAX_ARQUIVO) return leituraInfo('O arquivo é grande demais (máximo de 40 MB).', true);
      if (leituraTexto.value.trim() && !(await askConfirm('Substituir o texto que está na página (e o que está gravado) pelo conteúdo do arquivo?', 'Importar arquivo', { ok: 'Substituir', cancel: 'Cancelar' }))) return;
      vozParar();
      leituraAudioLimpar();
      leituraModo(false);
      leituraInfo('Lendo o arquivo…', false);
      leituraLerBtn.disabled = true;
      try {
        const buffer = await arquivo.arrayBuffer();
        const resultado = extensao === 'pdf'
          ? await leituraLerPdf(buffer, (n, total) => leituraInfo('Lendo o PDF… página ' + n + ' de ' + total, false))
          : await leituraLerDocx(buffer);
        let texto = resultado.paragrafos.join('\n\n');
        if (texto.replace(/\s/g, '').length < 20) {
          return leituraInfo(extensao === 'pdf'
            ? 'Este PDF não tem texto que o app consiga ler (provavelmente são imagens digitalizadas).'
            : 'Este documento não tem texto para ler.', true);
        }
        let aviso = '';
        if (texto.length > LEITURA_MAX_CARACTERES) {
          texto = texto.slice(0, LEITURA_MAX_CARACTERES);
          aviso = ' · só o começo: o limite é de ' + LEITURA_MAX_CARACTERES.toLocaleString('pt-BR') + ' caracteres';
        }
        leituraTexto.value = texto;
        leituraTexto.scrollTop = 0;
        const ignoradas = resultado.removidas ? ' · ' + resultado.removidas + (resultado.removidas === 1 ? ' linha' : ' linhas') + ' de cabeçalho/rodapé ignoradas' : '';
        leituraInfoArquivo = '📄 ' + nome + (resultado.paginas ? ' · ' + resultado.paginas + (resultado.paginas === 1 ? ' página' : ' páginas') : '') + ignoradas + aviso;
        leituraInfo(leituraInfoArquivo, Boolean(aviso));
        leituraEstatAtualizar();
        // O arquivo novo toma o lugar do anterior (só um fica gravado) e abre direto na vista de leitura; para editar, o botão Editar.
        leituraTextoGravado = '';
        leituraPosicao = 0;
        leituraMarcas = [];
        leituraMarcasGravar();
        leituraGravar();
        await vozCarregarRegras();
        leituraAbrirVista();
      } catch (e) {
        leituraInfo(e && e.message ? e.message : 'Não consegui ler este arquivo.', true);
      } finally {
        leituraLerBtn.disabled = false;
      }
    }

    document.getElementById('leituraArquivoBtn').addEventListener('click', () => leituraArquivo.click());
    leituraArquivo.addEventListener('change', event => {
      const arquivo = event.target.files && event.target.files[0];
      event.target.value = '';
      leituraImportar(arquivo);
    });
    // Parada no meio, a leitura continua da frase em que parou; o ⏹️ (stop) esquece o ponto e volta ao início do texto, sem ler.
    leituraLerBtn.addEventListener('click', () => {
      const desde = !leituraVista.hidden && leituraPosicao > 0 ? leituraPosicao : undefined;
      const pct = leituraUnidades.length ? Math.round((leituraPosicao / leituraUnidades.length) * 100) : 0;
      vozAbrirPronto({
        lugar: leituraBarra,
        texto: desde ? 'Pronto para continuar de onde parou (' + pct + '%).' : 'Pronto para ler o texto.',
        acesso: leituraCfg(desde).acesso,
        iniciar: () => leituraLer(desde)
      });
    });
    leituraInicioBtn.addEventListener('click', () => {
      vozParar();
      leituraPosicao = 0;
      leituraMarcarParou(-1);
      leituraGravarPosicao(true);
      leituraVista.scrollTop = 0;
    });
    leituraVista.addEventListener('click', event => {
      const frase = event.target.closest('.lu');
      if (!frase || String(window.getSelection()).trim()) return; // selecionar texto não inicia a leitura
      if (leituraMarcando) return leituraMarcarToque(frase, event.target); // com o marca-texto ligado, tocar marca em vez de ler
      leituraLer(Number(frase.dataset.i));
    });
    leituraMarcarBtn.addEventListener('click', () => {
      if (leituraMarcaLendo()) return;
      leituraMarcando = !leituraMarcando;
      leituraSelecao = null;
      window.getSelection().removeAllRanges();
      leituraMarcaAtualizar();
    });
    // O trecho selecionado fica guardado por uns segundos: em alguns celulares tocar no botão desfaz a seleção antes do toque chegar.
    document.addEventListener('selectionchange', () => {
      if (!leituraMarcando) return;
      const faixas = leituraSelecaoFaixas();
      clearTimeout(leituraSelTimer);
      if (faixas.length) {
        leituraSelecao = faixas;
        leituraMarcaAtualizar();
      } else if (leituraSelecao) {
        leituraSelTimer = setTimeout(() => { leituraSelecao = null; leituraMarcaAtualizar(); }, 4000);
      }
    });
    leituraMarcarSelBtn.addEventListener('click', () => {
      if (!leituraSelecao || leituraMarcaLendo()) return;
      const faixas = leituraSelecao;
      leituraSelecao = null;
      window.getSelection().removeAllRanges();
      leituraMarcas = leituraMarcasPintar(leituraMarcas, faixas.map(f => ({ ...f, c: leituraCor })));
      leituraMarcasMudaram([...new Set(faixas.map(f => f.u))]);
    });
    leituraTirarBtn.addEventListener('click', async () => {
      if (leituraMarcaLendo() || !leituraMarcas.length) return;
      if (!(await askConfirm('Tirar todas as marcas do texto?', 'Tirar as marcas', { ok: 'Tirar', cancel: 'Cancelar' }))) return;
      const unidades = [...new Set(leituraMarcas.map(m => m.u))];
      leituraMarcas = [];
      leituraMarcasMudaram(unidades);
    });
    document.getElementById('leituraWordBtn').addEventListener('click', event => leituraWordAbrir(event.currentTarget));
    // Cor: abre a lista de cores por cima do texto; escolher uma fecha a lista e vale para as próximas marcas. Tocar fora ou Esc também fecha.
    function leituraCoresFechar() {
      leituraCores.hidden = true;
      leituraCorBtn.setAttribute('aria-expanded', 'false');
    }
    leituraCorBtn.addEventListener('click', () => {
      leituraCores.hidden = !leituraCores.hidden;
      leituraCorBtn.setAttribute('aria-expanded', String(!leituraCores.hidden));
    });
    document.addEventListener('click', event => { if (!leituraCores.hidden && !leituraCorMenu.contains(event.target)) leituraCoresFechar(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !leituraCores.hidden) leituraCoresFechar(); });
    leituraCores.addEventListener('click', event => {
      const opcao = event.target.closest('.cor-opcao');
      if (!opcao) return;
      leituraCor = opcao.dataset.c;
      safeSetItem(LEITURA_COR_KEY, leituraCor);
      leituraCoresFechar();
      leituraMarcaAtualizar();
    });
    leituraEditarBtn.addEventListener('click', () => {
      vozParar();
      leituraModo(false);
      leituraTexto.focus();
    });
    // Termina a edição: grava o texto, mostra-o em frases (sem ler), para tocar numa frase ou em Ler.
    leituraConcluirBtn.addEventListener('click', async () => {
      leituraTexto.blur();
      await vozCarregarRegras(); // as regras de leitura do administrador valem para cada frase da vista
      leituraEstatAtualizar();
      leituraGravar();
      if (!leituraAbrirVista()) leituraInfo('Cole um texto ou importe um arquivo primeiro.', true);
    });
    // Digitar ou colar: atualiza a contagem na hora e grava um instante depois de parar de digitar.
    leituraTexto.addEventListener('input', () => {
      leituraEstatAtualizar();
      if (leituraBuscaCampo.value.trim()) leituraBuscar(false);
      clearTimeout(leituraGravarTimer);
      leituraGravarTimer = setTimeout(leituraGravar, 1500);
    });
    vozVelocidade.addEventListener('change', leituraEstatAtualizar);
    // Mudar a caixa dos parênteses refaz o que a voz fala de cada frase (a leitura em andamento segue como está; vale da próxima vez que ler).
    leituraParentesesCaixa.addEventListener('change', () => {
      vozAutoCancelar();
      safeSetItem(LEITURA_PARENTESES_KEY, leituraParentesesCaixa.checked ? '1' : '0');
      const regras = leituraRegras(vozRegras || VOZ_REGRAS_PADRAO);
      leituraUnidades.forEach(u => {
        u.falado = leituraFalado(u.texto, u.cabecalho, regras);
        leituraMudosNoSpan(u.el, regras); // o destaque acompanha o que passou a ser (ou deixou de ser) lido
      });
    });
    document.getElementById('leituraLimparBtn').addEventListener('click', () => {
      vozParar();
      leituraAudioLimpar();
      leituraModo(false);
      leituraTexto.value = '';
      leituraVista.textContent = '';
      leituraUnidades = [];
      leituraMarcas = [];
      leituraBuscaCampo.value = '';
      leituraBuscar(false);
      leituraInfoArquivo = '';
      leituraInfo('', false);
      leituraGravar(); // sem texto: apaga o gravado, a posição e as marcas
      leituraEstatAtualizar();
      leituraBotoesAtualizar();
    });
    // Com o tocador aberto (lendo ou em pausa), os botões Ler/Editar/Limpar saem da tela: o tocador já tem Continuar/Pausar e Parar. Fechado o tocador
    // (Parar ou fim da leitura), eles voltam.
    const leituraCartao = document.getElementById('leituraCard');
    // O marca-texto acompanha o tocador: indisponível lendo, disponível parado ou em pausa (o botão Pausar/Continuar muda de texto).
    const leituraMarcarTocando = () => {
      leituraCartao.classList.toggle('tocando', vozBar.parentNode === leituraBarra && !vozBar.hidden && !vozPauseBtn.hidden);
      leituraMarcaAtualizar();
    };
    const leituraObservarTocador = new MutationObserver(leituraMarcarTocando);
    leituraObservarTocador.observe(vozBar, { attributes: true, attributeFilter: ['hidden'] });
    leituraObservarTocador.observe(leituraBarra, { childList: true });
    leituraObservarTocador.observe(vozPauseBtn, { attributes: true, attributeFilter: ['hidden', 'data-pausado'] });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leituraGravarPendente(); });
    window.addEventListener('pagehide', leituraGravarPendente);

    // ---------- Consumo da voz (contado neste aparelho) ----------
    // A cada parte gerada de verdade (não a guardada na sessão), o app soma caracteres e, quando o áudio carrega, os
    // segundos. O custo é uma estimativa com os preços de referência abaixo; o valor exato fica no faturamento do Google.
    const VOZ_USO_KEY = 'jwLibraryNoteAplicarVozUsoV1';
    const VOZ_PRECOS_KEY = 'jwLibraryNoteAplicarVozPrecosV1';
    // Gemini: US$ 18 por milhão de tokens de áudio, cerca de 25 tokens por segundo (≈ US$ 0,027 por minuto).
    // Chirp 3 HD: US$ 30 por milhão de caracteres. Referências para a estimativa; o administrador pode mudar.
    const VOZ_PRECOS_PADRAO = { gemini: 0.027, chirp: 30 };

    function vozLerUso() {
      try { return JSON.parse(localStorage.getItem(VOZ_USO_KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    function vozLerPrecos() {
      try { return Object.assign({}, VOZ_PRECOS_PADRAO, JSON.parse(localStorage.getItem(VOZ_PRECOS_KEY) || '{}') || {}); } catch (e) { return Object.assign({}, VOZ_PRECOS_PADRAO); }
    }

    function vozSomarUso(campos) {
      const uso = vozLerUso();
      const mes = new Date().toISOString().slice(0, 7);
      const m = uso[mes] || (uso[mes] = { partes: 0, caracteres: 0, segGemini: 0, segChirp: 0, carChirp: 0 });
      Object.entries(campos).forEach(([campo, valor]) => { m[campo] = (m[campo] || 0) + valor; });
      safeSetItem(VOZ_USO_KEY, JSON.stringify(uso));
      vozAtualizarConsumo();
    }

    function vozAtualizarConsumo() {
      const caixa = document.getElementById('vozConsumo');
      if (!caixa) return;
      const uso = vozLerUso();
      const precos = vozLerPrecos();
      const somar = lista => lista.reduce((t, m) => {
        Object.keys(t).forEach(k => { t[k] += Number(m[k]) || 0; });
        return t;
      }, { partes: 0, caracteres: 0, segGemini: 0, segChirp: 0, carChirp: 0 });
      const mesAtual = new Date().toISOString().slice(0, 7);
      const linha = (titulo, m) => {
        const custo = (m.segGemini / 60) * precos.gemini + (m.carChirp / 1e6) * precos.chirp;
        const minutos = (m.segGemini + m.segChirp) / 60;
        return '<p><strong>' + titulo + ':</strong> ' + m.partes.toLocaleString('pt-BR') + (m.partes === 1 ? ' parte lida' : ' partes lidas') +
          ' · ' + m.caracteres.toLocaleString('pt-BR') + ' caracteres · ' + minutos.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) +
          ' min de áudio · ≈ US$ ' + custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: custo < 0.1 ? 3 : 2 }) + '</p>';
      };
      const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
      caixa.innerHTML = linha('Este mês (' + nomeMes + ')', somar([uso[mesAtual] || {}])) + linha('Desde o início', somar(Object.values(uso)));
      const g = document.getElementById('vozPrecoGemini');
      const c = document.getElementById('vozPrecoChirp');
      if (g && document.activeElement !== g) g.value = precos.gemini;
      if (c && document.activeElement !== c) c.value = precos.chirp;
    }

    // ---------- Leitura em voz alta: painel do administrador (Ajustes) ----------
    // Escolhas válidas para todos: guardadas no servidor (api/config.mjs, "voz-ler" e "voz-salvar"), com o código de
    // administrador. O exemplo usa as escolhas ainda não salvas.
    const VOZ_TEXTO_EXEMPLO = 'RESPOSTA 1. Por que devemos orar sempre? Jesus ensinou a orar com fé e humildade (leia Mateus 6:9-13). Paulo também escreveu que não devemos ficar ansiosos por coisa alguma, como mostra Filipenses 4:6, 7.';
    let vozAdminCodigo = '';
    let vozExemploTocando = false;
    const vozSection = document.getElementById('vozSection');
    const vozAutoEspera = document.getElementById('vozAutoEspera');
    if (vozAutoEspera) {
      vozAutoEspera.value = String(vozTempoEsperaPadrao());
      vozAutoEspera.addEventListener('change', () => {
        safeSetItem(VOZ_ESPERA_KEY, vozAutoEspera.value);
      });
    }
    // Cor do destaque da frase lida (neste aparelho): o atributo data-lendo do <html> escolhe a variável --lendo-cor do CSS.
    const VOZ_DESTAQUE_KEY = 'jwLibraryNoteAplicarVozDestaqueV1';
    const VOZ_DESTAQUES = ['amarelo', 'laranja', 'laranja-escuro', 'roxo', 'azul'];
    function vozDestaqueAplicar() {
      let cor = '';
      try { cor = localStorage.getItem(VOZ_DESTAQUE_KEY) || ''; } catch (e) { /* sem localStorage */ }
      document.documentElement.dataset.lendo = VOZ_DESTAQUES.includes(cor) ? cor : 'laranja';
      return document.documentElement.dataset.lendo;
    }
    const vozDestaqueCor = document.getElementById('vozDestaqueCor');
    if (vozDestaqueCor) {
      vozDestaqueCor.value = vozDestaqueAplicar();
      vozDestaqueCor.addEventListener('change', () => {
        safeSetItem(VOZ_DESTAQUE_KEY, vozDestaqueCor.value);
        vozDestaqueAplicar();
      });
    } else {
      vozDestaqueAplicar();
    }
    const vozAdminLogin = document.getElementById('vozAdminLogin');
    const vozAdminForm = document.getElementById('vozAdminForm');
    const vozAdminError = document.getElementById('vozAdminError');
    const vozAdminStatus = document.getElementById('vozAdminStatus');
    const vozExemploBtn = document.getElementById('vozExemploBtn');
    const vozCampos = {
      modelo: document.getElementById('vozModelo'),
      voz: document.getElementById('vozVoz'),
      tom: document.getElementById('vozTom'),
      altura: document.getElementById('vozAltura'),
      velocidade: document.getElementById('vozVelocidadePadrao'),
      formatoRefs: document.getElementById('vozFormatoRefs'),
      pularRefs: document.getElementById('vozPularRefs'),
      pularFontes: document.getElementById('vozPularFontes'),
      pularParenteses: document.getElementById('vozPularParenteses'),
      pularCabecalhos: document.getElementById('vozPularCabecalhos'),
      extra: document.getElementById('vozExtra')
    };

    function vozAdminMensagem(texto, aviso) {
      vozAdminStatus.className = aviso ? 'warn' : 'ok';
      vozAdminStatus.textContent = texto;
    }

    function vozPreencherSelect(select, itens) {
      select.textContent = '';
      itens.forEach(([valor, rotulo]) => {
        const op = document.createElement('option');
        op.value = valor;
        op.textContent = rotulo;
        select.appendChild(op);
      });
    }

    function vozMostrarFormulario(opcoes, config) {
      vozPreencherSelect(vozCampos.modelo, opcoes.modelos.map(m => [m.id, m.nome]));
      vozCampos.voz.textContent = '';
      [['F', 'Vozes femininas'], ['M', 'Vozes masculinas']].forEach(([genero, rotulo]) => {
        const grupo = document.createElement('optgroup');
        grupo.label = rotulo;
        opcoes.vozes.filter(v => v.genero === genero).forEach(v => {
          const op = document.createElement('option');
          op.value = v.nome;
          op.textContent = v.nome + ' (' + v.jeito + ')';
          grupo.appendChild(op);
        });
        vozCampos.voz.appendChild(grupo);
      });
      vozPreencherSelect(vozCampos.tom, opcoes.tons.map(t => [t.id, t.nome]));
      vozPreencherSelect(vozCampos.altura, opcoes.alturas.map(a => [a.id, a.nome]));
      vozPreencherSelect(vozCampos.velocidade, opcoes.velocidades.map(v => [String(v), String(v).replace('.', ',') + '×']));
      ['modelo', 'voz', 'tom', 'altura', 'formatoRefs'].forEach(campo => { vozCampos[campo].value = config[campo]; });
      vozCampos.velocidade.value = String(config.velocidade);
      ['pularRefs', 'pularFontes', 'pularParenteses', 'pularCabecalhos'].forEach(campo => { vozCampos[campo].checked = Boolean(config[campo]); });
      vozCampos.extra.value = config.extra || '';
      vozAdminLogin.hidden = true;
      vozAdminForm.hidden = false;
      vozAtualizarConsumo();
    }

    function vozLerFormulario() {
      return {
        modelo: vozCampos.modelo.value,
        voz: vozCampos.voz.value,
        tom: vozCampos.tom.value,
        altura: vozCampos.altura.value,
        velocidade: Number(vozCampos.velocidade.value) || 1,
        formatoRefs: vozCampos.formatoRefs.value,
        pularRefs: vozCampos.pularRefs.checked,
        pularFontes: vozCampos.pularFontes.checked,
        pularParenteses: vozCampos.pularParenteses.checked,
        pularCabecalhos: vozCampos.pularCabecalhos.checked,
        extra: vozCampos.extra.value.trim().slice(0, 400)
      };
    }

    // Entra com a senha de administrador salva em Autorização de acessos (sem ela, mostra o aviso e o atalho para lá).
    async function vozAdminCarregar(codigo) {
      if (!codigo) {
        vozAdminCodigo = '';
        vozAdminError.textContent = 'Para mudar a voz, salve a senha de administrador em 🔐 Autorização de acessos.';
        vozAdminLogin.hidden = false;
        vozAdminForm.hidden = true;
        return false;
      }
      vozAdminError.textContent = 'Entrando...';
      vozAdminLogin.hidden = false;
      const r = await postConfig({ acao: 'voz-ler', codigo });
      if (!r.ok) {
        vozAdminError.textContent = configErrorMessage(r, 'Não foi possível entrar agora.') + (r.status === 403 ? ' Confira a senha em 🔐 Autorização de acessos.' : '');
        vozAdminCodigo = '';
        vozAdminForm.hidden = true;
        return false;
      }
      vozAdminCodigo = codigo;
      vozAdminError.textContent = '';
      vozMostrarFormulario(r.data.opcoes, r.data.config);
      if (r.data.armazenamento && !r.data.armazenamento.escrita) vozAdminMensagem('O armazenamento do servidor ainda não permite salvar.', true);
      return true;
    }

    async function vozAdminSalvar() {
      if (!vozAdminCodigo) return;
      vozAdminMensagem('Salvando...', false);
      const r = await postConfig({ acao: 'voz-salvar', codigo: vozAdminCodigo, config: vozLerFormulario() });
      if (!r.ok) return vozAdminMensagem(configErrorMessage(r, 'Não foi possível salvar agora.'), true);
      vozCache.clear(); // os áudios guardados foram feitos com as escolhas antigas
      await vozCarregarRegras(true);
      try { localStorage.removeItem(VOZ_SPEED_KEY); } catch (e) { /* sem localStorage */ }
      vozVelocidade.value = vozVelocidadePerto(r.data.config.velocidade);
      vozAdminMensagem('✅ Salvo. As novas escolhas valem para todos em poucos segundos.', false);
    }

    async function vozExemplo() {
      if (vozExemploTocando) return vozParar();
      vozAudio.src = vozSilencio(); // dentro do toque: libera o áudio no iPhone
      vozAudio.play().catch(() => {});
      const config = vozLerFormulario();
      const texto = textoParaVoz(VOZ_TEXTO_EXEMPLO, config);
      const sessao = ++vozSessao;
      vozExemploTocando = true;
      vozExemploBtn.textContent = '⏹️ Parar o exemplo';
      vozAdminMensagem('Gerando o exemplo…', false);
      try {
        const entrada = await vozBuscar(texto, config);
        if (sessao !== vozSessao) return;
        vozAdminMensagem('🔊 Tocando: "' + texto + '"', false);
        await vozTocar(entrada);
        if (sessao === vozSessao) vozAdminMensagem(entrada.gemini ? '✅ Exemplo com a voz Gemini.' : '✅ Exemplo com a voz Chirp 3 HD (o Gemini não respondeu ou não foi escolhido).', false);
      } catch (e) {
        if (sessao === vozSessao) vozAdminMensagem(e && e.message ? e.message : 'Não consegui tocar o exemplo.', true);
      } finally {
        vozExemploTocando = false;
        vozExemploBtn.textContent = '▶️ Ouvir um exemplo';
      }
    }

    document.getElementById('vozSalvarBtn').addEventListener('click', vozAdminSalvar);
    vozExemploBtn.addEventListener('click', vozExemplo);
    // Ao abrir o painel, entra sozinho com a senha salva (ou de novo, se ela mudou).
    vozSection.addEventListener('toggle', () => {
      if (!vozSection.open) return;
      vozAtualizarConsumo();
      const codigo = senhaAdminSalva();
      if (codigo && (vozAdminForm.hidden || codigo !== vozAdminCodigo)) vozAdminCarregar(codigo);
    });
    // ---------- Esboços de discursos públicos (S-34): importação pelo administrador (Ajustes) ----------
    // O navegador lê os arquivos .docx (um por tema, ou um .zip com todos) neste aparelho: o Word guarda o texto em
    // word/document.xml e a estrutura do esboço aparece na formatação (título em negrito, seções em negrito e MAIÚSCULAS com o tempo
    // "(5 min)", níveis pelo recuo, leituras marcadas "[Leia …]", notas ao orador entre colchetes). Cada arquivo vira um JSON
    // { numero, titulo, notaAoOrador, secoes: [{ titulo, minutos, itens }], notaFinal }; um relatório mostra o que foi entendido
    // antes de enviar ao servidor (api/config.mjs, "s34-gravar"), que guarda tudo num armazenamento privado.
    const S34_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const S34_TEMPO = /\(\s*(\d+)\s*min(?:utos)?\s*\)\s*$/i;
    const S34_LIVRO = /^([1-3]?[A-Za-zÀ-ÿ]{1,6})\.?\s*(\d{1,3}\s*:\s*\d[\d,\s\-–:]*)$/;
    let s34Codigo = '';
    let s34Estado = null;   // { configurado, indice, temas } do servidor
    let s34Lidos = [];      // arquivos lidos nesta importação
    let s34Ocupado = false;
    const s34Section = document.getElementById('s34Section');
    const s34Login = document.getElementById('s34Login');
    const s34Form = document.getElementById('s34Form');
    const s34Error = document.getElementById('s34Error');
    const s34Status = document.getElementById('s34Status');

    function s34Mensagem(texto, aviso) {
      s34Status.className = aviso ? 'warn' : 'ok';
      s34Status.textContent = texto;
    }

    function s34Limpar(texto) {
      return String(texto || '').replace(/[​-‍﻿]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    }

    function s34Semacento(texto) {
      return s34Limpar(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    // Os .docx mais novos começam o XML com o BOM (o caractere invisível U+FEFF) antes de "<?xml". O Chrome aceita, mas o Safari (iPhone)
    // recusa e o app dizia "o documento do Word está ilegível": o BOM e qualquer espaço antes da declaração saem antes de ler o XML.
    const s34SemBom = xml => String(xml || '').replace(/^[﻿​\s]+/, '');

    // Os estilos do Word (word/styles.xml). Os esboços mais novos não marcam negrito, recuo e tipo de parágrafo em cada trecho, e sim por
    // estilos com nome ("JW HEADING" para o título da seção, "JW Indent 0, 1, 2…" para os níveis, "JW Note" para as notas, "JW TOTAL TIME",
    // "JW Copyright" e "JW Mnemonic" para o fim do documento). Devolve uma função: id do estilo -> { nome, left, b, i }, já somando o que
    // o estilo herda do estilo em que se baseia. Sem styles.xml (ou ilegível), devolve null.
    function s34Estilos(xml) {
      if (!xml) return null;
      const doc = new DOMParser().parseFromString(s34SemBom(xml), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) return null;
      const mapa = new Map();
      [...doc.getElementsByTagNameNS(S34_W, 'style')].forEach(st => {
        const filho = (pai, nome) => pai && [...pai.children].find(c => c.localName === nome);
        const val = el => (el ? el.getAttributeNS(S34_W, 'val') : '');
        const pPr = filho(st, 'pPr');
        const rPr = filho(st, 'rPr');
        const ind = filho(pPr, 'ind');
        const esquerda = ind ? (ind.getAttributeNS(S34_W, 'left') || ind.getAttributeNS(S34_W, 'start')) : '';
        const liga = nome => {
          const marca = filho(rPr, nome);
          if (!marca) return null;
          const valor = val(marca);
          return !(valor === '0' || valor === 'false' || valor === 'off');
        };
        mapa.set(st.getAttributeNS(S34_W, 'styleId'), { nome: val(filho(st, 'name')), base: val(filho(st, 'basedOn')), left: esquerda ? Number(esquerda) : null, b: liga('b'), i: liga('i') });
      });
      const cache = new Map();
      const resolver = (id, passou = []) => {
        if (!id || !mapa.has(id) || passou.includes(id)) return null;
        if (cache.has(id)) return cache.get(id);
        const e = mapa.get(id);
        const pai = e.base ? resolver(e.base, [...passou, id]) : null;
        const escolher = campo => (e[campo] !== null ? e[campo] : pai ? pai[campo] : null);
        const resolvido = { nome: e.nome, left: escolher('left'), b: escolher('b'), i: escolher('i') };
        cache.set(id, resolvido);
        return resolvido;
      };
      return resolver;
    }

    // Os parágrafos do documento: texto, se é (quase) todo negrito ou itálico, o recuo da esquerda (em twips) e o nome do estilo do Word.
    function s34Paragrafos(xml, estilos) {
      const doc = new DOMParser().parseFromString(s34SemBom(xml), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('o documento do Word está ilegível');
      return [...doc.getElementsByTagNameNS(S34_W, 'p')].map(p => {
        let texto = '', total = 0, negrito = 0;
        const letrasDoTexto = []; // cada caractere com o negrito e o itálico do trecho em que está
        const pPrDoParagrafo = [...p.children].find(c => c.localName === 'pPr');
        const pStyle = pPrDoParagrafo && [...pPrDoParagrafo.children].find(c => c.localName === 'pStyle');
        const estiloDoParagrafo = estilos && pStyle ? estilos(pStyle.getAttributeNS(S34_W, 'val')) : null;
        [...p.getElementsByTagNameNS(S34_W, 'r')].forEach(r => {
          const props = [...r.children].find(c => c.localName === 'rPr');
          const rStyle = props && [...props.children].find(c => c.localName === 'rStyle');
          const estiloDoTrecho = estilos && rStyle ? estilos(rStyle.getAttributeNS(S34_W, 'val')) : null;
          const ligado = nome => {
            const marca = props && [...props.children].find(c => c.localName === nome);
            if (!marca) {
              // sem marca no próprio trecho: vale o estilo do trecho e, depois, o do parágrafo
              if (estiloDoTrecho && estiloDoTrecho[nome] !== null && estiloDoTrecho[nome] !== undefined) return estiloDoTrecho[nome];
              return Boolean(estiloDoParagrafo && estiloDoParagrafo[nome]);
            }
            const valor = marca.getAttributeNS(S34_W, 'val');
            return valor !== '0' && valor !== 'false' && valor !== 'off';
          };
          let trecho = '';
          [...r.children].forEach(c => {
            if (c.localName === 't') trecho += c.textContent;
            else if (c.localName === 'tab' || c.localName === 'br') trecho += ' ';
          });
          texto += trecho;
          const letras = trecho.replace(/\s/g, '').length;
          total += letras;
          if (ligado('b')) negrito += letras;
          [...trecho].forEach(c => letrasDoTexto.push({ c, b: ligado('b'), i: ligado('i') }));
        });
        // Destaques: trechos em itálico fora de parênteses e colchetes (dentro deles o itálico é o nome da publicação citada).
        // Itálico + negrito = destaque muito importante (nível 2); só itálico = destaque importante (nível 1).
        const destaques = [];
        let profundidade = 0;
        let atual = null;
        const fechar = () => {
          if (!atual) return;
          const texto = s34Limpar(atual.texto);
          const letras = atual.texto.replace(/[^\p{L}\p{N}]/gu, '').length;
          if (letras >= 2) destaques.push({ texto, nivel: atual.negritas / Math.max(1, atual.letras) >= 0.6 ? 2 : 1 });
          atual = null;
        };
        letrasDoTexto.forEach(({ c, b, i }) => {
          if (c === '(' || c === '[') profundidade++;
          const dentro = profundidade > 0;
          if (c === ')' || c === ']') profundidade = Math.max(0, profundidade - 1);
          if (i && !dentro && c !== ')' && c !== ']') {
            if (!atual) atual = { texto: '', letras: 0, negritas: 0 };
            atual.texto += c;
            if (/\S/.test(c)) { atual.letras++; if (b) atual.negritas++; }
          } else if (atual && /\s/.test(c) && !dentro) atual.texto += c; // espaço entre dois trechos em itálico: o destaque continua
          else fechar();
        });
        fechar();
        const pPr = pPrDoParagrafo;
        const recuo = pPr && [...pPr.children].find(c => c.localName === 'ind');
        const lista = pPr && [...pPr.children].find(c => c.localName === 'numPr');
        const nivelLista = lista && [...lista.children].find(c => c.localName === 'ilvl');
        const recuoDoEstilo = estiloDoParagrafo && estiloDoParagrafo.left !== null ? estiloDoParagrafo.left : 0;
        return {
          texto: s34Limpar(texto),
          negrito: total > 0 && negrito / total >= 0.6,
          destaques,
          recuo: recuo ? Number(recuo.getAttributeNS(S34_W, 'left') || recuo.getAttributeNS(S34_W, 'start') || recuoDoEstilo) : recuoDoEstilo,
          nivelLista: nivelLista ? Number(nivelLista.getAttributeNS(S34_W, 'val') || 0) : null,
          estilo: estiloDoParagrafo ? estiloDoParagrafo.nome : ''
        };
      });
    }

    // Textos bíblicos e publicações citados entre parênteses: "(Sal 55:22; Is 41:10, 13)", "(Sentinela 15/11/15 pág. 4-5 parág. 3-6)".
    // "Ef 5:33; 6:4" continua no mesmo livro ("Ef 6:4").
    function s34Citacoes(texto) {
      const referencias = [];
      const publicacoes = [];
      for (const grupo of texto.matchAll(/\(([^()]+)\)/g)) {
        let livro = '';
        grupo[1].split(';').map(s34Limpar).filter(Boolean).forEach(parte => {
          const comLivro = parte.match(S34_LIVRO);
          if (comLivro) {
            livro = comLivro[1];
            referencias.push(parte.replace(/\s*:\s*/, ':'));
          } else if (livro && /^\d{1,3}\s*:\s*\d[\d,\s\-–:]*$/.test(parte)) {
            referencias.push(livro + ' ' + parte.replace(/\s*:\s*/, ':'));
          } else if (/p[aá]g|par[aá]g|vol\b|\d{1,2}\/\d{1,2}/i.test(parte) && /\d/.test(parte)) {
            publicacoes.push(parte);
          }
        });
      }
      return { referencias, publicacoes };
    }

    // ---------- Leituras marcadas "Leia" ----------
    // Uma referência bíblica: livro (com o número na frente e as abreviações: "1 Pe", "Lu", "Cantares de Salomão"), capítulo e versículos.
    const S34_REF = '(?:[1-3]\\s*)?[A-ZÀ-Ý][A-Za-zÀ-ÿ]*(?:\\s+(?:de|da|do)\\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]*)?\\.?\\s*\\d{1,3}\\s*:\\s*\\d+[ab]?(?:\\s*[,\\-–]\\s*\\d+[ab]?)*';
    // O "a" e o "b" depois do versículo ("2 Pedro 3:11, 12a") saem: a Bíblia do servidor lê o versículo inteiro.
    const s34LimparRef = ref => s34Limpar(ref).replace(/(\d)[ab]\b/g, '$1').replace(/[.,;\s]+$/, '');
    function s34UltimaRef(texto) {
      const todas = [...String(texto).matchAll(new RegExp(S34_REF, 'g'))];
      return todas.length ? s34LimparRef(todas[todas.length - 1][0]) : '';
    }

    // O que vem depois de "Leia" é uma leitura quando traz a referência ("Salmo 37:34", "o Salmo 37:34", "e explique Provérbios 3:5, 6", "os
    // pontos principais de Daniel 4:20-27"), "o versículo 4" / "os versículos 5, 6" (do capítulo da última referência citada) ou nada ("." ou
    // "e comente": vale a última referência citada antes). Devolve a lista de referências, ou null quando não é uma leitura ("Leia a Bíblia
    // todos os dias"). "memoria.ref" guarda a última referência dos parágrafos anteriores.
    function s34RefsDaLeitura(parte, antes, memoria) {
      const limpa = s34Limpar(parte);
      const escrita = limpa.match(new RegExp(S34_REF));
      if (escrita) return [s34LimparRef(escrita[0])];
      // O capítulo de "o versículo 4": a última referência do próprio parágrafo, um "Revelação capítulo 6" dele, a última leitura dos parágrafos
      // de antes e, por fim, a última citação.
      const capituloEscrito = [...String(antes).matchAll(/([A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+(?:de|da|do)\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+)?)\s+cap[ií]tulo\s+(\d{1,3})/g)].pop();
      const base = s34UltimaRef(antes) || (capituloEscrito ? capituloEscrito[1] + ' ' + capituloEscrito[2] : '') || memoria.ref || memoria.cit;
      const versiculos = limpa.match(/^(?:o|os)?\s*vers[ií]culos?\s+(\d+[ab]?(?:\s*(?:[,\-–]|e)\s*\d+[ab]?)*)/i);
      if (versiculos) {
        const capitulo = base.replace(/\s*:.*$/, '');
        return capitulo ? [s34LimparRef(capitulo + ':' + versiculos[1].replace(/\s+e\s+/g, ', '))] : [];
      }
      if (/^[.\s]*$/.test(limpa) || /^e\s+(?:comente|explique)\b[.\s]*$/i.test(limpa)) return base ? [base] : [];
      return null;
    }

    // Transforma os parágrafos num esboço { numero, titulo, notaAoOrador, secoes, notaFinal } e junta os avisos do que estranhou.
    // Com "livre" (esboço importado no card Outros esboços): sem número de tema, sem a conferência dos 30 minutos nem da linha de identificação.
    function s34Esboco(paragrafos, numero, livre = false) {
      const avisos = [];
      const vivos = paragrafos.filter(p => p.texto);
      if (!vivos.length) return { erro: 'o documento está vazio' };
      // Nos esboços mais novos o título vem com o número na frente ("N.º 108 Você pode encarar o futuro…"): o número já está no nome do arquivo.
      const titulo = vivos[0].texto.replace(/^N\.?\s*[º°]\s*\d{1,3}\s*[-–:.]?\s*/i, '') || vivos[0].texto;
      // Alguns esboços (como os dos temas 95, 100, 101, 104, 107 e 111) terminam repetindo o tema ("N.º 100 Título"): não é parte do discurso.
      const formaDoTitulo = s34Semacento(titulo);
      const repeteTitulo = p => { const m = p.texto.match(/^N\.?\s*[°ºo]\.?\s*\d{1,3}\s+(.+)$/i); return Boolean(m) && s34Semacento(m[1]) === formaDoTitulo; };
      // O fim do documento (identificação, tempo total e direito autoral) não entra na conta do recuo nem no esboço.
      const linhaFinal = p => repeteTitulo(p) || /^N\.?\s*[°ºo]\.?\s*\d{1,3}\s*-\s*[A-Za-z]{1,3}\b/i.test(p.texto) || /^S-?\s?34\s*-?\s*[A-Za-z]{1,3}\s+N/i.test(p.texto) || /^©/.test(p.texto) || /^TEMPO TOTAL/i.test(p.texto) || /^jw (total time|copyright|mnemonic)/i.test(p.estilo || '');
      const base = Math.min(...vivos.slice(1).filter(p => p.nivelLista === null && !linhaFinal(p)).map(p => p.recuo).concat([Infinity]));
      // Estilo "JW Indent N" do Word = nível N; sem ele, o nível vem da lista numerada ou do recuo.
      const nivelDoEstilo = p => { const m = String(p.estilo || '').match(/^jw indent (\d)/i); return m ? Math.min(4, Number(m[1])) : null; };
      const nivelDe = p => (nivelDoEstilo(p) !== null ? nivelDoEstilo(p) : p.nivelLista !== null ? p.nivelLista : Number.isFinite(base) ? Math.max(0, Math.round((p.recuo - base) / 283)) : 0);

      const esboco = { numero, titulo, revisao: '', notaAoOrador: '', secoes: [], notaFinal: '' };
      let rodape = null; // { numero, idioma, tempoTotal } da linha "N.° 15-T 12/16 TEMPO TOTAL: 30 MINUTOS" (ou "S-34-T N.º 108 10/23")
      let tempoTotalDaLinha = null; // "TEMPO TOTAL: 30 MINUTOS" numa linha só, nos esboços mais novos
      const memoria = { ref: '', proxima: '', cit: '', proximaCit: '' }; // última leitura e última citação dos parágrafos de antes (para "Leia o versículo 4")
      let secao = null;
      let naNota = false;
      vivos.slice(1).forEach(p => {
        if (memoria.proxima) { memoria.ref = memoria.proxima; memoria.proxima = ''; }
        if (memoria.proximaCit) { memoria.cit = memoria.proximaCit; memoria.proximaCit = ''; }
        // O fim do documento traz a identificação do esboço (número, idioma e revisão) e o direito autoral: não são parte do discurso.
        // Formas da linha de identificação: "N.° 15-T 12/16 TEMPO TOTAL: 30 MINUTOS", "No. 17-T 4/18 TEMPO TOTAL: 30 MINUTOS", "N.° 57-T 12/93 A SER
        // ABRANGIDO EM 45 MINUTOS" (os esboços de 45 minutos, às vezes em duas linhas: a revisão numa e o tempo na seguinte) e "S-34-T N.º 108 10/23".
        // ("N.o 174-T", "Nº. 19" e "S-34-T N.º 153-T 11/19" também existem; em alguns a identificação vem na mesma linha do ©.)
        const identificacao = p.texto.match(/^N\.?\s*[°ºo]\.?\s*(\d{1,3})\s*-\s*([A-Za-z]{1,3})\b(.*)$/i);
        const aposDoDireitoAutoral = /^©/.test(p.texto) ? p.texto.slice(Math.max(0, p.texto.search(/S-?\s?34\s*-?\s*[A-Za-z]{1,3}\s+N/i))) : p.texto;
        const identificacaoNova = !identificacao && aposDoDireitoAutoral.match(/^S-?\s?34\s*-?\s*([A-Za-z]{1,3})\s+N\.?\s*[°ºo]?\.?\s*(\d{1,3})(?:\s*-\s*[A-Za-z]{1,3})?\s+(\d{1,2}\/\d{2,4})\b/i);
        if (identificacao) {
          const revisao = identificacao[3].match(/(\d{1,2}\/\d{2,4})/);
          const minutos = identificacao[3].match(/(?:TEMPO TOTAL\s*:?|A SER ABRANGIDO EM)\s*(\d+)/i);
          if (revisao && !esboco.revisao) esboco.revisao = revisao[1];
          rodape = { numero: Number(identificacao[1]), idioma: identificacao[2].toUpperCase(), tempoTotal: minutos ? Number(minutos[1]) : (rodape && rodape.tempoTotal) || null };
          return;
        }
        if (identificacaoNova) {
          esboco.revisao = identificacaoNova[3];
          rodape = { numero: Number(identificacaoNova[2]), idioma: identificacaoNova[1].toUpperCase(), tempoTotal: (rodape && rodape.tempoTotal) || null };
          return;
        }
        const tempoTotal = p.texto.match(/^TEMPO TOTAL\s*:?\s*(\d+)\s*MINUTOS?\b/i);
        if (tempoTotal) { tempoTotalDaLinha = Number(tempoTotal[1]); return; }
        if (/^©/.test(p.texto) || repeteTitulo(p)) return;
        // A nota do começo pode vir como "Nota ao orador", "Nota para o orador" ou só "Nota" (sozinha na linha, ou seguida de ":" "." ou " - "); há esboços sem nota.
        const nota = p.texto.match(/^(?:nota\s+(?:ao|para\s+o)\s+orador\s*[:.\-–]?|nota\s*[:.]|nota\s+[\-–]|nota$)\s*(.*)$/i);
        if (nota && !secao) {
          naNota = true;
          if (nota[1]) esboco.notaAoOrador = (esboco.notaAoOrador + ' ' + nota[1]).trim();
          return;
        }
        const tempo = p.texto.match(S34_TEMPO);
        const semTempo = p.texto.replace(S34_TEMPO, '');
        if (tempo && (p.negrito || semTempo === semTempo.toLocaleUpperCase('pt-BR'))) {
          secao = { titulo: s34Limpar(semTempo), minutos: Number(tempo[1]), itens: [] };
          esboco.secoes.push(secao);
          naNota = false;
          return;
        }
        if (!secao) {
          if (naNota) {
            esboco.notaAoOrador = (esboco.notaAoOrador + ' ' + p.texto).trim();
            return;
          }
          secao = { titulo: '', minutos: null, itens: [] };
          esboco.secoes.push(secao);
          avisos.push('Há texto antes da primeira seção com tempo; ficou numa seção sem título.');
        }
        // As leituras vêm marcadas de várias formas (veja s34RefsDaLeitura): "[Leia Salmo 46:1, 2.]", "(Leia Mateus 4:17.)" (esboços mais
        // antigos), "(re 171-2; leia Revelação 11:15-18.)", "[Leia o versículo 4.]", "… Filipenses 2:14, 15. (Leia.)", e um item só com "Leia
        // Romanos 8:18.". O que sobra de um parêntese (as publicações) fica no texto; um parágrafo inteiro entre colchetes (sem Leia) é uma nota
        // ao orador.
        const leituras = [];
        const adicionar = refs => refs.forEach(r => leituras.push(r));
        let texto = p.texto
          .replace(/\[\s*Leiam?\b([^\]]*)\]/gi, (todo, dentro, offset, inteiro) => {
            s34Limpar(dentro).split(';').forEach(parte => {
              const refs = s34RefsDaLeitura(parte, inteiro.slice(0, offset), memoria);
              if (refs) adicionar(refs);
            });
            return ' ';
          })
          .replace(/\(([^()]*\bleiam?\b[^()]*)\)/gi, (todo, dentro, offset, inteiro) => {
            const restantes = [];
            let livro = '';
            dentro.split(';').map(s34Limpar).filter(Boolean).forEach(parte => {
              const depoisDeLeia = parte.match(/^leiam?\b(.*)$/i);
              const refs = depoisDeLeia ? s34RefsDaLeitura(depoisDeLeia[1], inteiro.slice(0, offset), memoria) : null;
              const continua = !refs && livro && /^\d{1,3}\s*:\s*\d[\d,\s\-–]*\.?$/.test(parte);
              if (refs || continua) {
                const lidas = refs || [s34LimparRef(livro + ' ' + parte)];
                adicionar(lidas);
                if (lidas.length) livro = (lidas[lidas.length - 1].match(/^(.*?)\s*\d{1,3}\s*:/) || [])[1] || livro;
              } else restantes.push(parte);
            });
            return restantes.length ? '(' + restantes.join('; ') + ')' : ' ';
          })
          .replace(/\s+/g, ' ')
          .trim();
        const soLeia = texto.match(/^leiam?\s+(.+)$/i);
        if (soLeia && new RegExp('^(?:(?:o|a|os|as)\\s+)?' + S34_REF + '(?:\\s*;\\s*' + S34_REF + ')*\\.?$').test(soLeia[1])) {
          soLeia[1].split(';').forEach(parte => { const refs = s34RefsDaLeitura(parte, '', memoria); if (refs) adicionar(refs); });
          texto = '';
        }
        // A última LEITURA (não qualquer citação) é o capítulo a que os "Leia o versículo 4" dos parágrafos seguintes se referem.
        if (leituras.length) memoria.proxima = leituras[leituras.length - 1];
        const citada = s34UltimaRef(p.texto);
        if (citada) memoria.proximaCit = citada;
        const entreColchetes = /^\[.*\]$/.test(texto);
        if (entreColchetes) texto = s34Limpar(texto.slice(1, -1));
        if (!texto && !leituras.length) return;
        if (!texto) {
          const anterior = secao.itens[secao.itens.length - 1];
          if (anterior) anterior.leituras.push(...leituras);
          return;
        }
        const citacoes = s34Citacoes(texto);
        secao.itens.push({
          nivel: nivelDe(p), texto, negrito: p.negrito, destaques: entreColchetes ? [] : p.destaques.filter(d => texto.includes(d.texto)), nota: entreColchetes,
          leituras, referencias: citacoes.referencias, publicacoes: citacoes.publicacoes
        });
      });

      // A nota do fim ("Siga de perto o material do esboço…") não é parte do discurso.
      const ultima = esboco.secoes[esboco.secoes.length - 1];
      const fim = ultima && ultima.itens[ultima.itens.length - 1];
      if (fim && fim.nota && /siga de perto|beneficie-se|n[aã]o h[aá] necessidade/i.test(fim.texto)) {
        esboco.notaFinal = fim.texto;
        ultima.itens.pop();
      }

      if (!esboco.secoes.some(s => s.minutos !== null)) return { erro: livre ? 'não achei nenhuma seção com tempo, como "(5 min)": o esboço precisa estar no molde do S-34 (título, seções em negrito e MAIÚSCULAS com o tempo). Se ele não está, cole o texto em "Matéria colada"' : 'não achei nenhuma seção com tempo, como "(5 min)"' };
      const total = esboco.secoes.reduce((n, s) => n + (s.minutos || 0), 0);
      const esperado = rodape && rodape.tempoTotal ? rodape.tempoTotal : tempoTotalDaLinha || (livre ? null : 30);
      if (esperado && total !== esperado) avisos.push('Os tempos das seções somam ' + total + ' min (o esboço diz ' + esperado + ').');
      if (!rodape) { if (!livre) avisos.push('Não achei a linha de identificação do fim do documento (como "N.° 15-T 12/16"): a revisão ficou em branco.'); }
      else {
        if (!livre && rodape.numero !== numero) avisos.push('O número do documento (' + rodape.numero + ') não confere com o do nome do arquivo (' + numero + ').');
        if (rodape.idioma !== 'T') avisos.push('O idioma do esboço é "' + rodape.idioma + '", não o português (T).');
      }
      esboco.secoes.forEach(s => { if (!s.itens.length && !/^v[ií]deo\b/i.test(s.titulo)) avisos.push('A seção "' + s.titulo.slice(0, 40) + '" ficou sem itens.'); });
      if (!livre && !esboco.notaAoOrador) avisos.push('Não achei a "Nota ao orador".');
      return { esboco, avisos };
    }

    // O esboço em texto, para o administrador conferir o que foi entendido.
    function s34Previa(esboco) {
      const linhas = ['« ' + esboco.titulo + ' »  (tema ' + esboco.numero + (esboco.revisao ? ', revisão ' + esboco.revisao : '') + ')'];
      if (esboco.notaAoOrador) linhas.push('Nota ao orador: ' + esboco.notaAoOrador);
      esboco.secoes.forEach(s => {
        linhas.push('', '■ ' + s.titulo + (s.minutos !== null ? ' (' + s.minutos + ' min)' : ''));
        s.itens.forEach(i => {
          const marca = i.nota ? '[nota] ' : i.negrito ? '**' : '';
          linhas.push('  '.repeat(i.nivel + 1) + (i.nivel ? '◦ ' : '• ') + marca + i.texto + (i.negrito && !i.nota ? '**' : '') +
            (i.destaques && i.destaques.length ? '   ⭐ ' + i.destaques.map(d => (d.nivel === 2 ? 'destaque máximo: ' : 'destaque: ') + '“' + d.texto + '”').join('; ') : '') + (i.leituras.length ? '   📖 LER: ' + i.leituras.join('; ') : ''));
        });
      });
      if (esboco.notaFinal) linhas.push('', 'Nota do fim: ' + esboco.notaFinal);
      return linhas.join('\n');
    }

    function s34NumeroDoNome(nome) {
      const base = String(nome || '').split(/[\\/]/).pop();
      const m = base.match(/S-?\s?34[_\s-]*(?:T[_\s-]*)?(\d{1,3})\b/i) || base.match(/(\d{1,3})(?=\.docx$)/i);
      return m ? Number(m[1]) : null;
    }

    // Lê um .docx (bytes) e devolve { esboco, avisos } ou { erro }.
    async function s34LerDocx(JSZip, nome, bytes, modificado, livre = false) {
      const numero = livre ? 0 : s34NumeroDoNome(nome);
      if (!livre && !numero) return { erro: 'não achei o número do tema no nome do arquivo (esperado algo como S-34_T_015.docx)' };
      let zip;
      try { zip = await JSZip.loadAsync(bytes); } catch (e) { return { erro: 'não é um arquivo .docx válido' }; }
      const documento = zip.file('word/document.xml');
      if (!documento) return { erro: 'o .docx não tem word/document.xml' };
      let propriedades = '';
      const core = zip.file('docProps/core.xml');
      if (core) propriedades = ((await core.async('string')).match(/<dcterms:modified[^>]*>([^<]+)</) || [])[1] || '';
      let resultado;
      try {
        const arquivoDeEstilos = zip.file('word/styles.xml');
        const estilos = arquivoDeEstilos ? s34Estilos(await arquivoDeEstilos.async('string')) : null;
        resultado = s34Esboco(s34Paragrafos(await documento.async('string'), estilos), numero, livre);
      } catch (e) { return { erro: e && e.message ? e.message : 'não consegui ler o documento' }; }
      if (resultado.erro) return resultado;
      resultado.esboco.arquivo = String(nome).split(/[\\/]/).pop();
      resultado.esboco.arquivoModificado = propriedades || (modificado ? new Date(modificado).toISOString() : '');
      return resultado;
    }

    // Lê os arquivos escolhidos (.docx e .zip com .docx dentro), de um em um, mostrando o andamento.
    async function s34LerArquivos(arquivos) {
      await loadScriptOnce(BACKUP_LIBS.jszip);
      const JSZip = window.JSZip;
      const fila = [];
      for (const arquivo of arquivos) {
        if (/\.zip$/i.test(arquivo.name)) {
          const zip = await JSZip.loadAsync(arquivo);
          zip.forEach((caminho, entrada) => {
            if (!entrada.dir && /\.docx$/i.test(caminho) && !/(^|\/)(~\$|__MACOSX)/.test(caminho)) fila.push({ nome: caminho, ler: () => entrada.async('uint8array'), modificado: entrada.date });
          });
        } else if (/\.docx$/i.test(arquivo.name)) {
          fila.push({ nome: arquivo.name, ler: async () => new Uint8Array(await arquivo.arrayBuffer()), modificado: arquivo.lastModified });
        }
      }
      const lidos = [];
      for (let i = 0; i < fila.length; i++) {
        s34Mensagem('Lendo os arquivos… ' + (i + 1) + ' de ' + fila.length, false);
        const item = fila[i];
        const resultado = await s34LerDocx(JSZip, item.nome, await item.ler(), item.modificado);
        lidos.push({ nome: String(item.nome).split(/[\\/]/).pop(), numero: s34NumeroDoNome(item.nome), ...resultado, avisos: resultado.avisos || [] });
        if (i % 8 === 7) await new Promise(r => setTimeout(r, 0)); // deixa a tela respirar
      }
      return lidos;
    }

    // Cruza com a lista de temas (quando ela foi guardada) e com os repetidos da seleção.
    function s34Conferir(lidos) {
      const temas = new Map(((s34Estado && s34Estado.temas && s34Estado.temas.itens) || []).map(t => [t.numero, t.titulo]));
      const vistos = new Map(); // número do tema -> o primeiro arquivo lido dele
      const semNomes = l => JSON.stringify({ ...l.esboco, arquivo: '', arquivoModificado: '' });
      lidos.forEach(l => {
        if (l.erro) return;
        const anterior = vistos.get(l.numero);
        if (anterior) {
          // O mesmo tema escolhido duas vezes (por exemplo, o .zip e os mesmos arquivos soltos): se o conteúdo é igual, o repetido é só
          // ignorado (não é erro); se o conteúdo for diferente, não dá para saber qual vale.
          if (semNomes(anterior) === semNomes(l)) l.repetido = true;
          else l.erro = 'o tema ' + l.numero + ' veio em dois arquivos com conteúdo diferente (' + anterior.nome + ' e ' + l.nome + '); escolha só um deles';
          return;
        }
        vistos.set(l.numero, l);
        if (temas.size) {
          if (!temas.has(l.numero)) l.avisos.push('O tema ' + l.numero + ' não está na lista de temas guardada.');
          else if (s34Semacento(temas.get(l.numero)) !== s34Semacento(l.esboco.titulo)) l.avisos.push('O título não confere com o da lista: "' + temas.get(l.numero) + '".');
        }
      });
    }

    function s34Elemento(tag, classe, texto) {
      const el = document.createElement(tag);
      if (classe) el.className = classe;
      if (texto !== undefined) el.textContent = texto;
      return el;
    }

    function s34MostrarEstado() {
      const indice = (s34Estado && s34Estado.indice && s34Estado.indice.temas) || {};
      const importados = Object.keys(indice).length;
      const lista = s34Estado && s34Estado.temas && s34Estado.temas.itens;
      const linhas = [];
      linhas.push('📚 ' + importados + (importados === 1 ? ' tema importado' : ' temas importados') + (lista ? ' de ' + lista.length + ' na lista de temas' : ''));
      const quando = s34Estado && s34Estado.indice && s34Estado.indice.atualizadoEm;
      if (quando) linhas.push('Última importação em ' + new Date(quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + '.');
      if (lista) {
        const faltam = lista.filter(t => !indice[String(t.numero)]).map(t => t.numero);
        if (faltam.length) linhas.push('Faltam importar ' + faltam.length + ': ' + faltam.slice(0, 40).join(', ') + (faltam.length > 40 ? '…' : '') + '.');
        else if (lista.length) linhas.push('✅ Todos os temas da lista foram importados.');
      }
      document.getElementById('s34Estado').textContent = linhas.join(' ');
      s34MostrarLista(lista);
    }

    // A lista dos temas, de 1 a 200 (ou até o maior número que existir), montada com os esboços importados no servidor: cada tema é uma célula
    // com o número e o título. Importado = título do esboço; "falta" = só está na lista guardada (título da lista, esmaecido); sem esboço e sem
    // título, a célula fica vazia. A caixa de texto (dentro de "Colar ou corrigir a lista") continua guardando a lista com os títulos de todos.
    const S34_TEMAS_MIN = 200;

    function s34MostrarLista(lista) {
      const caixa = document.getElementById('s34ListaTexto');
      const indice = (s34Estado && s34Estado.indice && s34Estado.indice.temas) || {};
      const guardados = new Map((lista || []).map(t => [t.numero, t.titulo]));
      const numeros = [...Object.keys(indice).map(Number), ...guardados.keys()];
      const maior = Math.max(S34_TEMAS_MIN, ...numeros);
      const ultimoConhecido = Math.max(0, ...numeros);
      const soFaltam = document.getElementById('s34GradeFaltam').checked;
      const grade = document.getElementById('s34Grade');
      grade.textContent = '';
      let importados = 0;
      for (let numero = 1; numero <= maior; numero++) {
        const tema = indice[String(numero)];
        const titulo = tema ? tema.titulo : guardados.get(numero) || '';
        const estado = tema ? 'ok' : titulo ? 'falta' : 'vazio';
        if (tema) importados++;
        // O filtro mostra o que falta: os que têm título na lista e os vazios até o último tema conhecido (não os vazios depois dele).
        if (soFaltam && (estado === 'ok' || (estado === 'vazio' && numero > ultimoConhecido))) continue;
        const celula = s34Elemento('div', 's34-celula s34-' + estado);
        celula.setAttribute('role', 'listitem');
        celula.append(s34Elemento('b', '', String(numero)), s34Elemento('span', '', titulo || '—'));
        if (estado === 'falta') celula.append(s34Elemento('em', '', 'falta importar'));
        grade.appendChild(celula);
      }
      const quando = s34Estado && s34Estado.temas && s34Estado.temas.atualizadoEm;
      document.getElementById('s34ListaTitulo').textContent = '📋 Lista de temas (' + importados + ' importados)';
      document.getElementById('s34ListaInfo').textContent = 'Montada com os esboços importados no servidor, de 1 a ' + maior + '. ✔ = importado; "falta importar" = está na lista guardada' +
        (quando ? ' (atualizada em ' + new Date(quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ')' : '') + ' mas ainda não tem esboço; "—" = sem esboço e sem título.';
      if (lista && lista.length && !caixa.value.trim()) caixa.value = lista.map(t => t.numero + '. ' + t.titulo).join('\n');
    }
    document.getElementById('s34GradeFaltam').addEventListener('change', () => s34MostrarLista(s34Estado && s34Estado.temas && s34Estado.temas.itens));

    // O relatório: um resumo e uma linha por arquivo (com o que o servidor fará e os avisos), cada uma com a prévia do que foi entendido.
    function s34Relatorio() {
      const box = document.getElementById('s34Relatorio');
      box.textContent = '';
      box.hidden = !s34Lidos.length;
      if (!s34Lidos.length) return;
      const contar = estado => s34Lidos.filter(l => l.estado === estado && !l.erro).length;
      const erros = s34Lidos.filter(l => l.erro).length;
      const comAviso = s34Lidos.filter(l => !l.erro && l.avisos.length).length;
      const resumo = s34Elemento('div', 's34-resumo');
      const partes = [s34Lidos.length + (s34Lidos.length === 1 ? ' arquivo lido' : ' arquivos lidos')];
      if (s34Lidos.some(l => l.estado)) partes.push(contar('novos') + ' novos', contar('atualizados') + ' atualizados', contar('iguais') + ' iguais (nada a fazer)');
      partes.push(erros + ' com erro', comAviso + ' com aviso');
      resumo.textContent = partes.join(' · ');
      box.appendChild(resumo);
      const lista = s34Lidos.slice().sort((a, b) => (b.erro ? 2 : b.avisos.length ? 1 : 0) - (a.erro ? 2 : a.avisos.length ? 1 : 0) || (a.numero || 0) - (b.numero || 0));
      const ul = s34Elemento('ul', 's34-lista');
      lista.forEach(l => {
        const li = s34Elemento('li', 's34-item' + (l.erro ? ' erro' : l.avisos.length ? ' aviso' : ''));
        const cab = s34Elemento('div', 's34-titulo', (l.erro ? '❌ ' : l.avisos.length ? '⚠️ ' : '✅ ') + (l.numero ? 'Tema ' + l.numero : l.nome) + (l.esboco ? ' — ' + l.esboco.titulo : ''));
        li.appendChild(cab);
        if (l.estado && !l.erro) {
          const rotulo = { novos: 'novo', atualizados: 'atualizado', iguais: 'igual (já importado)' }[l.estado] || l.estado;
          li.appendChild(s34Elemento('span', 's34-tag', l.importado ? '✔ importado' : rotulo));
        }
        if (l.esboco) {
          const itens = l.esboco.secoes.reduce((n, s) => n + s.itens.length, 0);
          const leituras = l.esboco.secoes.reduce((n, s) => n + s.itens.reduce((m, i) => m + i.leituras.length, 0), 0);
          li.appendChild(s34Elemento('div', 's34-meta', l.nome + (l.esboco.revisao ? ' · rev. ' + l.esboco.revisao : '') + ' · ' + l.esboco.secoes.length + ' seções · ' + l.esboco.secoes.reduce((n, s) => n + (s.minutos || 0), 0) + ' min · ' + itens + ' itens · ' + leituras + ' leituras'));
        }
        if (l.erro) li.appendChild(s34Elemento('div', 's34-aviso', 'Não dá para importar: ' + l.erro + '.'));
        if (l.avisos.length) {
          const avisos = s34Elemento('ul');
          l.avisos.forEach(a => avisos.appendChild(s34Elemento('li', '', a)));
          li.appendChild(avisos);
        }
        if (l.esboco) {
          const ver = document.createElement('details');
          ver.appendChild(s34Elemento('summary', '', 'Ver o que foi entendido'));
          ver.addEventListener('toggle', () => { if (ver.open && !ver.querySelector('pre')) ver.appendChild(s34Elemento('pre', '', s34Previa(l.esboco))); });
          li.appendChild(ver);
        }
        ul.appendChild(li);
      });
      box.appendChild(ul);

      const pendentes = s34Lidos.filter(l => !l.erro && (l.estado === 'novos' || l.estado === 'atualizados') && !l.importado);
      const acoes = s34Elemento('div', 'bk-row');
      const importar = document.createElement('button');
      importar.type = 'button';
      importar.textContent = pendentes.length ? '📥 Importar ' + pendentes.length + (pendentes.length === 1 ? ' esboço (novo ou atualizado)' : ' esboços (novos e atualizados)') : 'Nada novo para importar';
      importar.disabled = !pendentes.length || s34Ocupado;
      importar.addEventListener('click', () => s34Importar());
      const limpar = document.createElement('button');
      limpar.type = 'button';
      limpar.className = 'secondary';
      limpar.textContent = '✖️ Limpar o relatório';
      limpar.addEventListener('click', () => { s34Lidos = []; s34Relatorio(); s34Mensagem('', false); });
      acoes.append(importar, limpar);
      box.appendChild(acoes);
    }

    // Pergunta ao servidor (sem gravar) o que cada esboço seria: novo, atualizado ou igual ao já importado.
    async function s34ConferirNoServidor() {
      const validos = s34Lidos.filter(l => !l.erro);
      for (let i = 0; i < validos.length; i += 25) {
        s34Mensagem('Conferindo com o servidor… ' + Math.min(i + 25, validos.length) + ' de ' + validos.length, false);
        const lote = validos.slice(i, i + 25);
        const r = await postConfig({ acao: 's34-gravar', codigo: s34Codigo, somenteConferir: true, esbocos: lote.map(l => l.esboco) });
        if (!r.ok) throw new Error(configErrorMessage(r, 'Não consegui conferir com o servidor.'));
        ['novos', 'atualizados', 'iguais'].forEach(estado => (r.data[estado] || []).forEach(numero => {
          const l = lote.find(x => x.numero === numero);
          if (l) l.estado = estado;
        }));
        (r.data.invalidos || []).forEach(inv => {
          const l = lote.find(x => x.numero === Number(inv.numero));
          if (l) l.erro = inv.erro;
        });
      }
    }

    async function s34Escolhidos(arquivos) {
      if (s34Ocupado || !arquivos.length) return;
      s34Ocupado = true;
      s34Lidos = [];
      try {
        s34Lidos = await s34LerArquivos(arquivos);
        if (!s34Lidos.length) { s34Mensagem('Não achei nenhum arquivo .docx na seleção.', true); return; }
        s34Conferir(s34Lidos);
        const repetidos = s34Lidos.filter(l => l.repetido).length;
        s34Lidos = s34Lidos.filter(l => !l.repetido);
        await s34ConferirNoServidor();
        s34Relatorio();
        const erros = s34Lidos.filter(l => l.erro).length;
        const aviso = repetidos ? ' (' + repetidos + (repetidos === 1 ? ' arquivo repetido, do mesmo tema e com o mesmo conteúdo, foi ignorado)' : ' arquivos repetidos, do mesmo tema e com o mesmo conteúdo, foram ignorados)') : '';
        s34Mensagem((erros ? 'Pronto: confira os ' + erros + ' arquivo(s) com erro no relatório (eles não serão importados).' : '✅ Relatório pronto. Confira e toque em Importar.') + aviso, Boolean(erros));
      } catch (e) {
        s34Relatorio();
        s34Mensagem(e && e.message ? e.message : 'Não consegui ler os arquivos.', true);
      } finally {
        s34Ocupado = false;
        s34Relatorio();
      }
    }

    // Envia os novos e os atualizados (25 por vez) e atualiza o relatório e o estado.
    async function s34Importar() {
      if (s34Ocupado) return;
      const pendentes = s34Lidos.filter(l => !l.erro && (l.estado === 'novos' || l.estado === 'atualizados') && !l.importado);
      if (!pendentes.length) return;
      s34Ocupado = true;
      s34Relatorio();
      let feitos = 0;
      try {
        for (let i = 0; i < pendentes.length; i += 10) {
          const lote = pendentes.slice(i, i + 10);
          s34Mensagem('Importando… ' + feitos + ' de ' + pendentes.length, false);
          const r = await postConfig({ acao: 's34-gravar', codigo: s34Codigo, esbocos: lote.map(l => l.esboco) });
          if (!r.ok) throw new Error(configErrorMessage(r, 'Não consegui importar agora.'));
          const recusados = new Map((r.data.invalidos || []).map(inv => [Number(inv.numero), inv.erro]));
          lote.forEach(l => {
            if (recusados.has(l.numero)) l.erro = recusados.get(l.numero);
            else { l.importado = true; feitos++; }
          });
        }
        s34Mensagem('✅ Importação concluída: ' + feitos + (feitos === 1 ? ' esboço guardado.' : ' esboços guardados.'), false);
      } catch (e) {
        s34Mensagem((e && e.message ? e.message : 'Não consegui importar agora.') + ' (' + feitos + ' já guardados.)', true);
      } finally {
        s34Ocupado = false;
        await s34Carregar(s34Codigo, true);
        s34Relatorio();
      }
    }

    async function s34Carregar(codigo, silencioso) {
      if (!codigo) {
        s34Codigo = '';
        s34Error.textContent = 'Para importar, salve a senha de administrador em 🔐 Autorização de acessos.';
        s34Login.hidden = false;
        s34Form.hidden = true;
        return false;
      }
      if (!silencioso) { s34Error.textContent = 'Entrando...'; s34Login.hidden = false; }
      const r = await postConfig({ acao: 's34-estado', codigo });
      if (!r.ok) {
        if (!silencioso) {
          s34Error.textContent = configErrorMessage(r, 'Não foi possível entrar agora.') + (r.status === 403 ? ' Confira a senha em 🔐 Autorização de acessos.' : '');
          s34Form.hidden = true;
        }
        return false;
      }
      s34Codigo = codigo;
      s34Estado = r.data;
      s34Error.textContent = '';
      s34Login.hidden = true;
      s34Form.hidden = false;
      s34MostrarEstado();
      if (!r.data.configurado) s34Mensagem('O armazenamento privado (Blob) ainda não está configurado no servidor: dá para ler os arquivos, mas não importar.', true);
      return true;
    }

    async function s34GuardarLista() {
      const texto = document.getElementById('s34ListaTexto').value;
      if (!texto.trim()) return s34Mensagem('Cole a lista de temas (um por linha, como "1. Você conhece bem a Deus?").', true);
      s34Mensagem('Guardando a lista…', false);
      const r = await postConfig({ acao: 's34-lista-salvar', codigo: s34Codigo, texto });
      if (!r.ok) return s34Mensagem(configErrorMessage(r, 'Não consegui guardar a lista agora.'), true);
      await s34Carregar(s34Codigo, true);
      const problemas = r.data.problemas || [];
      s34Mensagem('✅ Lista guardada: ' + r.data.quantidade + ' temas.' + (problemas.length ? ' Atenção: ' + problemas.slice(0, 3).join(' ') : ''), Boolean(problemas.length));
      if (s34Lidos.length) { s34Lidos.forEach(l => { l.avisos = l.avisos.filter(a => !/lista de temas|não confere com o da lista/.test(a)); }); s34Conferir(s34Lidos); s34Relatorio(); }
    }

    document.getElementById('s34EscolherBtn').addEventListener('click', () => document.getElementById('s34Arquivos').click());
    document.getElementById('s34Arquivos').addEventListener('change', event => {
      const arquivos = [...(event.target.files || [])];
      event.target.value = ''; // permite escolher os mesmos arquivos de novo
      s34Escolhidos(arquivos);
    });
    document.getElementById('s34ListaBtn').addEventListener('click', s34GuardarLista);
    // Ao abrir o painel, entra sozinho com a senha salva (ou de novo, se ela mudou).
    s34Section.addEventListener('toggle', () => {
      if (!s34Section.open) return;
      const codigo = senhaAdminSalva();
      if (s34Form.hidden || codigo !== s34Codigo) s34Carregar(codigo, false);
    });

    [['vozPrecoGemini', 'gemini'], ['vozPrecoChirp', 'chirp']].forEach(([id, chave]) => {
      document.getElementById(id).addEventListener('change', event => {
        const precos = vozLerPrecos();
        const valor = Number(event.target.value);
        precos[chave] = Number.isFinite(valor) && valor >= 0 ? valor : VOZ_PRECOS_PADRAO[chave];
        safeSetItem(VOZ_PRECOS_KEY, JSON.stringify(precos));
        vozAtualizarConsumo();
      });
    });
    document.getElementById('vozZerarBtn').addEventListener('click', async () => {
      if (!(await askConfirm('Zerar a contagem de consumo da voz deste aparelho? (Não muda nada no Google.)', 'Zerar a contagem'))) return;
      try { localStorage.removeItem(VOZ_USO_KEY); } catch (e) { /* sem localStorage */ }
      vozAtualizarConsumo();
    });

    // ---------- Tema (Auto / Claro / Escuro) ----------

    const THEME_STORAGE_KEY = 'jwLibraryNoteAplicarThemeV1';

    function aplicarTema(escolha) {
      if (escolha === 'dark' || escolha === 'light') {
        document.documentElement.setAttribute('data-theme', escolha);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeChoice === escolha);
      });
    }

    function initThemeSwitch() {
      let salvo = 'auto';
      try {
        salvo = localStorage.getItem(THEME_STORAGE_KEY) || 'auto';
      } catch (e) {}
      aplicarTema(salvo);

      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const escolha = btn.dataset.themeChoice;
          aplicarTema(escolha);
          try { localStorage.setItem(THEME_STORAGE_KEY, escolha); } catch (e) {}
        });
      });
    }

    initThemeSwitch();

    // O app também circula como arquivo HTML avulso, aberto direto do disco. Em file://
    // não há manifest nem service worker que funcionem, então os dois só entram em cena
    // quando a página vem de um servidor.
    function servidoPelaWeb() {
      return location.protocol === 'http:' || location.protocol === 'https:';
    }

    function enableManifestWhenOnline() {
      if (!servidoPelaWeb()) return;

      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = 'manifest.webmanifest';
      document.head.appendChild(link);
    }

    function mostrarAvisoDeAtualizacao() {
      if (document.getElementById('updateBar')) return;

      const barra = document.createElement('div');
      barra.id = 'updateBar';
      barra.className = 'update-bar';
      barra.setAttribute('role', 'status');

      const texto = document.createElement('span');
      texto.textContent = 'Nova versão disponível.';

      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = 'Recarregar';
      botao.addEventListener('click', () => location.reload());

      barra.appendChild(texto);
      barra.appendChild(botao);
      document.body.appendChild(barra);
    }

    function registerServiceWorker() {
      if (!servidoPelaWeb() || !('serviceWorker' in navigator)) return;

      // A versão vai na query para o worker montar o nome da cache com ela — e para que
      // mudar APP_VERSION baste para o navegador enxergar um worker novo.
      navigator.serviceWorker.register('sw.js?v=' + APP_VERSION).then(registro => {
        registro.addEventListener('updatefound', () => {
          const novo = registro.installing;
          if (!novo) return;

          novo.addEventListener('statechange', () => {
            // controller preenchido significa que já havia um worker no comando:
            // este é um segundo acesso vendo uma versão nova, não a instalação inicial.
            if (novo.state === 'installed' && navigator.serviceWorker.controller) {
              mostrarAvisoDeAtualizacao();
            }
          });
        });
      }).catch(e => {
        console.warn('Não foi possível registrar o service worker.', e);
      });
    }

    const input = document.getElementById('inputText');
    const styleSelect = document.getElementById('styleSelect');
    const styleOptionInfo = document.getElementById('styleOptionInfo');
    const selectionInfo = document.getElementById('selectionInfo');
    const preview = document.getElementById('preview');
    const copyStatus = document.getElementById('copyStatus');
    // A pesquisa salva a que o texto do campo pertence (o esboço ou as respostas que a IA fez, ou o que foi aberto de Pesquisas e
    // respostas salvas): { id, titulo, base }. "base" é o texto do campo quando foi salvo, aberto ou gerado; mudou? há o que salvar.
    let historicoLigado = null;
    let salvarTimer = 0; // o aviso "Alterações salvas" no botão some sozinho
    const salvarBloco = document.getElementById('salvarBloco');
    const salvarBtn = document.getElementById('saveBtn');
    const salvarInfo = document.getElementById('saveInfo');
    const templateStatus = document.getElementById('templateStatus');

    const templateSelect = document.getElementById('templateSelect');
    const templateCategoryFilter = document.getElementById('templateCategoryFilter');
    const templateCategorySelect = document.getElementById('templateCategorySelect');
    const newTemplateCategoryName = document.getElementById('newTemplateCategoryName');
    const addTemplateCategoryBtn = document.getElementById('addTemplateCategoryBtn');
    const deleteTemplateCategoryBtn = document.getElementById('deleteTemplateCategoryBtn');
    const categoryManageSelect = document.getElementById('categoryManageSelect');
    const categoryModoNovaBtn = document.getElementById('categoryModoNovaBtn');
    const categoryModoAlterarBtn = document.getElementById('categoryModoAlterarBtn');
    const categoryNova = document.getElementById('categoryNova');
    const categoryAlterar = document.getElementById('categoryAlterar');
    const categoryAcoes = document.getElementById('categoryAcoes');
    const categoryModo = document.getElementById('categoryModo');
    const categoryRenameName = document.getElementById('categoryRenameName');
    const renameTemplateCategoryBtn = document.getElementById('renameTemplateCategoryBtn');
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmText = document.getElementById('confirmText');
    const confirmOkChoice = document.getElementById('confirmOkChoice');
    const cancelConfirmChoice = document.getElementById('cancelConfirmChoice');
    const categoryDeleteOverlay = document.getElementById('categoryDeleteOverlay');
    const categoryDeleteText = document.getElementById('categoryDeleteText');
    const keepTemplatesChoice = document.getElementById('keepTemplatesChoice');
    const deleteTemplatesChoice = document.getElementById('deleteTemplatesChoice');
    const cancelCategoryDeleteChoice = document.getElementById('cancelCategoryDeleteChoice');
    const templateName = document.getElementById('templateName');
    const templateContent = document.getElementById('templateContent');
    const templateExtraCategories = document.getElementById('templateExtraCategories');
    const templateExtraBox = document.getElementById('templateExtraBox');
    const templateExtraResumo = document.getElementById('templateExtraResumo');
    const templateModo = document.getElementById('templateModo');
    const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const templateModoNovoBtn = document.getElementById('templateModoNovoBtn');
    const templateModoAlterarBtn = document.getElementById('templateModoAlterarBtn');
    const templateEscolha = document.getElementById('templateEscolha');
    const templateForm = document.getElementById('templateForm');
    const categoryStatus = document.getElementById('categoryStatus');
    const moreSymbols = document.getElementById('moreSymbols');
    const symbolCategorySelect = document.getElementById('symbolCategorySelect');
    const symbolSearch = document.getElementById('symbolSearch');
    const symbolSearchInfo = document.getElementById('symbolSearchInfo');
    const symbolSearchResults = document.getElementById('symbolSearchResults');
    const quickEmojiList = document.getElementById('quickEmojiList');
    const emojiPickFavoritos = document.getElementById('emojiPickFavoritos');
    const emojiPickBusca = document.getElementById('emojiPickBusca');
    const emojiPickInfo = document.getElementById('emojiPickInfo');
    const emojiPickResultados = document.getElementById('emojiPickResultados');
    const emojiPickCategoria = document.getElementById('emojiPickCategoria');
    const emojiPickLista = document.getElementById('emojiPickLista');
    let emojiKeywords = null;        // { emoji sem FE0F e sem tom de pele: "nome e palavras-chave sem acento" }
    let emojiKeywordsPromise = null;
    const customSymbolCategory = document.getElementById('customSymbolCategory');
    const customSymbolsText = document.getElementById('customSymbolsText');
    const symbolsStatus = document.getElementById('symbolsStatus');

    const STORAGE_KEY = 'jwLibraryNoteAplicarTemplatesV2';
    const SYMBOLS_STORAGE_KEY = 'jwLibraryNoteAplicarCustomSymbolsV1';
    const FAVORITE_SYMBOLS_STORAGE_KEY = 'jwLibraryNoteAplicarFavoriteSymbolsV1';
    const QUICKBAR_STORAGE_KEY = 'jwLibraryNoteAplicarQuickBarV1';
    const CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY = 'jwLibraryNoteAplicarCustomSymbolCategoriesV1';
    const ONLINE_DEFAULTS_VERSION_STORAGE_KEY = 'jwLibraryNoteAplicarOnlineDefaultsVersionV1';
    const TEMPLATE_CATEGORIES_STORAGE_KEY = 'jwLibraryNoteAplicarTemplateCategoriesV1';
    const DEFAULT_TEMPLATE_CATEGORY = 'REUNIÕES';
    const LEGACY_DEFAULT_TEMPLATE_CATEGORY = 'Destaques';
    const DESTAQUES_CATEGORY_NAME = 'DESTAQUES';
    const APP_VERSION = '6.3.48'; // histórico de versões: CHANGELOG.md. Numeração: o último número vai de 00 a 99 (6.2.00 … 6.2.99) e só então vem 6.3.00; nunca passa de 99.
    document.getElementById('appVersionTexto').textContent = 'Versão ' + APP_VERSION;
    // O Safari do iPhone ignora user-scalable=no; este evento impede o zoom por gesto de pinça.
    document.addEventListener('gesturestart', event => event.preventDefault());

    // Grava no localStorage sem derrubar a ação em curso quando o navegador
    // recusa a escrita (aba anônima, cota cheia, armazenamento bloqueado).
    function safeSetItem(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn('Não foi possível salvar em ' + key, e);
        storageBlocked = true;
        return false;
      }
    }

    let storageBlocked = false;

    function warnIfStorageBlocked(statusEl) {
      if (!storageBlocked || !statusEl) return;
      statusEl.className = 'warn';
      statusEl.textContent = 'Atenção: este navegador não deixou salvar os dados. As mudanças valem só até fechar a página.';
      storageBlocked = false;
    }

    function cloneData(value) {
      if (typeof structuredClone === 'function') return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    }

    const defaultFavoriteSymbols = [
      '❓','✅','⚠️','▶️','⏩','➤','➜','➽','➡','⬅','👉','☛','☚','💡','🔎','📌',
      '✍🏻','👍🏻','👎🏻','😀','★','☆','✦','✧','✎','✓','✔','✕','✗','✘','🔷','🔶','🔹','🔸','💠','💎','♦️','🟦','🟧','🟪','🟥',
      '■','□','▣','◆','▲','●','○','▇','▬','❝','❞'
    ];

    const symbolCategories = [
      { id: 'setas', name: 'Setas e indicadores', text: `➤ ➜ ➽ ➡ ⬅ 👉 ☛ ☚ ☜ ☝ ☞ ☟ 👆 👇 👈 ↛ ↝ ↠ ⇝ ↣ ↦ ↬ ⇀ ⇁ ⇉ ⇏ ⇒ ⇛ ⇢ ⇥ ⇨ ⇰ ⇴ ⇶ ⇸ ⇻ ⇾ ➔ ➙ ➛ ➝ ➞ ➟ ➢ ➣ ➥ ➦ ➧ ➨ ➩ ➪ ➫ ➬ ➭ ➮ ➯ ➱ ➲ ➳ ➵ ➺ ➻ ➼ ➾ ➠ ⫸ ⫷ ▶ ⬆️ ↗️ ↘️ ⬇️ ↙️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝` },
      { id: 'marcadores', name: 'Marcadores e avisos', text: `❓ ✅ ⚠️ ⚠ ⛔ 🚫 ❌ ❗️ ❕ ❔ ‼️ ⁉️ 💯 🔅 🔆 🔱 ⚜ 〽️ 🚸 🔰 ♻️ ❇️ ✳️ ❎ 💠 🌀 ➿ ✔ ✓ ☑️ 🔘 ✖ ✕ ✗ ✘ ╳ 🎯 📌 💡 🔎 🔍 🆘 📛 💢 🚳 🚭 🚯 🚱 🚷 📵 🔞 ☢️ ☣️` },
      { id: 'formas-coloridas', name: 'Formas coloridas', text: `🔷 🔶 🔹 🔸 💠 💎 ♦️ 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛️ ⬜️ ◇ ◆ ◈ ■ □ ▢ ▣ ▤ ▥ ▦ ▧ ▨ ▩ ▲ △ ▷ ▼ ▽ ◉ ◊ ○ ◌ ◍ ◎ ● ◐ ◑ ◒ ◓ ◧ ◨ ◩ ◪ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔺 🔻 🔘 🔳 🔲` },
      { id: 'linhas', name: 'Linhas e divisores', text: `▂ ▃ ▄ ▅ ▆ ▇ █ ▉ ▊ ▋ ▌ ▍ ▎ ▏ ▬ ▭ ▁ ▇▇▇▇▇▇▇▇▇▇ ▀▄▀▄▀▄▀▄⎐⎏▀▄▀▄▀▄▀▄ ▬▭▬▭▬▭▬▭▬▭▬▭▬▭▬ ━━━━━ ───── ═════` },
      { id: 'numeros', name: 'Números especiais', text: `0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 ⓿ ❶ ❷ ❸ ❹ ❺ ❻ ❼ ❽ ❾ ❿ ⓫ ⓬ ⓭ ⓮ ⓯ ⓰ ⓱ ⓲ ⓳ ⓴ ⓵ ⓶ ⓷ ⓸ ⓹ ⓺ ⓻ ⓼ ⓽ ⓾ ➀ ➁ ➂ ➃ ➄ ➅ ➆ ➇ ➈ ➉ ➊ ➋ ➌ ➍ ➎ ➏ ➐ ➑ ➒ ➓ 🔢 #️⃣ *️⃣` },
      { id: 'letras', name: 'Letras decorativas', text: `🅰 🅱 🅲 🅳 🅴 🅵 🅶 🅷 🅸 🅹 🅺 🅻 🅼 🅽 🅾 🅿 🆀 🆁 🆂 🆃 🆄 🆅 🆆 🆇 🆈 🆉 🅸🅽🆂🆃🆁🆄🆃🅾🆁 𝘼 𝘽 𝘾 𝘿 𝙀 𝙁 𝙂 𝙃 𝙄 𝙅 𝙆 𝙇 𝙈 𝙉 𝙊 𝙋 𝙌 𝙍 𝙎 𝙏 𝙐 𝙑 𝙒 𝙓 𝙔 𝙕 𝙖 𝙗 𝙘 𝙙 𝙚 𝙛 𝙜 𝙝 𝙞 𝙟 𝙠 𝙡 𝙢 𝙣 𝙤 𝙥 𝙦 𝙧 𝙨 𝙩 𝙪 𝙫 𝙬 𝙭 𝙮 𝙯 𝐀 𝐁 𝐂 𝐃 𝐄 𝐅 𝐆 𝐇 𝐈 𝐉 𝐊 𝐋 𝐌 𝐍 𝐎 𝐏 𝐐 𝐑 𝐒 𝐓 𝐔 𝐕 𝐖 𝐗 𝐘 𝐙 𝓐 𝓑 𝓒 𝓓 𝓔 𝓕 𝓖 𝓗 𝓘 𝓙 𝓚 𝓛 𝓜 𝓝 𝓞 𝓟 𝓠 𝓡 𝓢 𝓣 𝓤 𝓥 𝓦 𝓧 𝓨 𝓩 𝓪 𝓫 𝓬 𝓭 𝓮 𝓯 𝓰 𝓱 𝓲 𝓳 𝓴 𝓵 𝓶 𝓷 𝓸 𝓹 𝓺 𝓻 𝓼 𝓽 𝓾 𝓿 𝔀 𝔁 𝔂 𝔃 Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ Ⓖ Ⓗ Ⓘ Ⓙ Ⓚ Ⓛ Ⓜ Ⓝ Ⓞ Ⓟ Ⓠ Ⓡ Ⓢ Ⓣ Ⓤ Ⓥ Ⓦ Ⓧ Ⓨ Ⓩ 🄰 🄱 🄲 🄳 🄴 🄵 🄶 🄷 🄸 🄹 🄺 🄻 🄼 🄽 🄾 🄿 🅀 🅁 🅂 🅃 🅄 🅅 🅆 🅇 🅈 🅉` },
      { id: 'emoji-carinhas', name: 'Carinhas e emoções', text: `😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😶‍🌫️ 😏 😒 🙄 😬 😮‍💨 🤥 🫨 🙂‍↔️ 🙂‍↕️ 🤠 🥳 🥸 😎 🤓 🧐` },
      { id: 'emoji-carinhas-mal', name: 'Carinhas: sono, mal-estar e preocupação', text: `😌 😔 😪 🤤 😴 🫩 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 😕 🫤 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️` },
      { id: 'emoji-fantasias', name: 'Fantasias, gatos e macacos', text: `💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊` },
      { id: 'emoji-coracoes', name: 'Corações e emoções', text: `💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💋 💯 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤` },
      { id: 'emoji-maos', name: 'Mãos e gestos', text: `👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫷 🫸 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳` },
      { id: 'emoji-corpo', name: 'Partes do corpo', text: `💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦` },
      { id: 'emoji-pessoas', name: 'Pessoas e gestos', text: `👶 🧒 👦 👧 🧑 👱 👨 🧔 🧔‍♂️ 🧔‍♀️ 👨‍🦰 👨‍🦱 👨‍🦳 👨‍🦲 👩 👩‍🦰 🧑‍🦰 👩‍🦱 🧑‍🦱 👩‍🦳 🧑‍🦳 👩‍🦲 🧑‍🦲 👱‍♀️ 👱‍♂️ 🧓 👴 👵 🙍 🙍‍♂️ 🙍‍♀️ 🙎 🙎‍♂️ 🙎‍♀️ 🙅 🙅‍♂️ 🙅‍♀️ 🙆 🙆‍♂️ 🙆‍♀️ 💁 💁‍♂️ 💁‍♀️ 🙋 🙋‍♂️ 🙋‍♀️ 🧏 🧏‍♂️ 🧏‍♀️ 🙇 🙇‍♂️ 🙇‍♀️ 🤦 🤦‍♂️ 🤦‍♀️ 🤷 🤷‍♂️ 🤷‍♀️` },
      { id: 'emoji-profissoes', name: 'Profissões e personagens', text: `🧑‍⚕️ 👨‍⚕️ 👩‍⚕️ 🧑‍🎓 👨‍🎓 👩‍🎓 🧑‍🏫 👨‍🏫 👩‍🏫 🧑‍⚖️ 👨‍⚖️ 👩‍⚖️ 🧑‍🌾 👨‍🌾 👩‍🌾 🧑‍🍳 👨‍🍳 👩‍🍳 🧑‍🔧 👨‍🔧 👩‍🔧 🧑‍🏭 👨‍🏭 👩‍🏭 🧑‍💼 👨‍💼 👩‍💼 🧑‍🔬 👨‍🔬 👩‍🔬 🧑‍💻 👨‍💻 👩‍💻 🧑‍🎤 👨‍🎤 👩‍🎤 🧑‍🎨 👨‍🎨 👩‍🎨 🧑‍✈️ 👨‍✈️ 👩‍✈️ 🧑‍🚀 👨‍🚀 👩‍🚀 🧑‍🚒 👨‍🚒 👩‍🚒 👮 👮‍♂️ 👮‍♀️ 🕵️ 🕵️‍♂️ 🕵️‍♀️ 💂 💂‍♂️ 💂‍♀️ 🥷 👷 👷‍♂️ 👷‍♀️ 🫅 🤴 👸 👳 👳‍♂️ 👳‍♀️ 👲 🧕 🤵 🤵‍♂️ 🤵‍♀️ 👰 👰‍♂️ 👰‍♀️ 🤰 🫃 🫄 🤱 👩‍🍼 👨‍🍼 🧑‍🍼 👼 🎅 🤶 🧑‍🎄 🦸 🦸‍♂️ 🦸‍♀️ 🦹 🦹‍♂️ 🦹‍♀️ 🧙 🧙‍♂️ 🧙‍♀️ 🧚 🧚‍♂️ 🧚‍♀️ 🧛 🧛‍♂️ 🧛‍♀️ 🧜 🧜‍♂️ 🧜‍♀️ 🧝 🧝‍♂️ 🧝‍♀️ 🧞 🧞‍♂️ 🧞‍♀️ 🧟 🧟‍♂️ 🧟‍♀️ 🧌` },
      { id: 'emoji-atividades-pessoas', name: 'Pessoas em atividade e esportes', text: `💆 💆‍♂️ 💆‍♀️ 💇 💇‍♂️ 💇‍♀️ 🚶 🚶‍♂️ 🚶‍♀️ 🚶‍➡️ 🚶‍♀️‍➡️ 🚶‍♂️‍➡️ 🧍 🧍‍♂️ 🧍‍♀️ 🧎 🧎‍♂️ 🧎‍♀️ 🧎‍➡️ 🧎‍♀️‍➡️ 🧎‍♂️‍➡️ 🧑‍🦯 🧑‍🦯‍➡️ 👨‍🦯 👨‍🦯‍➡️ 👩‍🦯 👩‍🦯‍➡️ 🧑‍🦼 🧑‍🦼‍➡️ 👨‍🦼 👨‍🦼‍➡️ 👩‍🦼 👩‍🦼‍➡️ 🧑‍🦽 🧑‍🦽‍➡️ 👨‍🦽 👨‍🦽‍➡️ 👩‍🦽 👩‍🦽‍➡️ 🏃 🏃‍♂️ 🏃‍♀️ 🏃‍➡️ 🏃‍♀️‍➡️ 🏃‍♂️‍➡️ 💃 🕺 🕴️ 👯 👯‍♂️ 👯‍♀️ 🧖 🧖‍♂️ 🧖‍♀️ 🧗 🧗‍♂️ 🧗‍♀️ 🤺 🏇 ⛷️ 🏂 🏌️ 🏌️‍♂️ 🏌️‍♀️ 🏄 🏄‍♂️ 🏄‍♀️ 🚣 🚣‍♂️ 🚣‍♀️ 🏊 🏊‍♂️ 🏊‍♀️ ⛹️ ⛹️‍♂️ ⛹️‍♀️ 🏋️ 🏋️‍♂️ 🏋️‍♀️ 🚴 🚴‍♂️ 🚴‍♀️ 🚵 🚵‍♂️ 🚵‍♀️ 🤸 🤸‍♂️ 🤸‍♀️ 🤼 🤼‍♂️ 🤼‍♀️ 🤽 🤽‍♂️ 🤽‍♀️ 🤾 🤾‍♂️ 🤾‍♀️ 🤹 🤹‍♂️ 🤹‍♀️ 🧘 🧘‍♂️ 🧘‍♀️ 🛀 🛌` },
      { id: 'emoji-familias', name: 'Famílias e silhuetas', text: `🧑‍🤝‍🧑 👭 👫 👬 💏 👩‍❤️‍💋‍👨 👨‍❤️‍💋‍👨 👩‍❤️‍💋‍👩 💑 👩‍❤️‍👨 👨‍❤️‍👨 👩‍❤️‍👩 👨‍👩‍👦 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👩‍👦‍👦 👨‍👩‍👧‍👧 👨‍👨‍👦 👨‍👨‍👧 👨‍👨‍👧‍👦 👨‍👨‍👦‍👦 👨‍👨‍👧‍👧 👩‍👩‍👦 👩‍👩‍👧 👩‍👩‍👧‍👦 👩‍👩‍👦‍👦 👩‍👩‍👧‍👧 👨‍👦 👨‍👦‍👦 👨‍👧 👨‍👧‍👦 👨‍👧‍👧 👩‍👦 👩‍👦‍👦 👩‍👧 👩‍👧‍👦 👩‍👧‍👧 🗣️ 👤 👥 🫂 👪 🧑‍🧑‍🧒 🧑‍🧑‍🧒‍🧒 🧑‍🧒 🧑‍🧒‍🧒 👣 🫆` },
      { id: 'emoji-animais', name: 'Animais terrestres', text: `🐵 🐒 🦍 🦧 🐶 🐕 🦮 🐕‍🦺 🐩 🐺 🦊 🦝 🐱 🐈 🐈‍⬛ 🦁 🐯 🐅 🐆 🐴 🫎 🫏 🐎 🦄 🦓 🦌 🦬 🐮 🐂 🐃 🐄 🐷 🐖 🐗 🐽 🐏 🐑 🐐 🐪 🐫 🦙 🦒 🐘 🦣 🦏 🦛 🐭 🐁 🐀 🐹 🐰 🐇 🐿️ 🦫 🦔 🦇 🐻 🐻‍❄️ 🐨 🐼 🦥 🦦 🦨 🦘 🦡 🐾` },
      { id: 'emoji-aves-mar', name: 'Aves, répteis e vida marinha', text: `🦃 🐔 🐓 🐣 🐤 🐥 🐦 🐧 🕊️ 🦅 🦆 🦢 🦉 🦤 🪶 🦩 🦚 🦜 🪽 🐦‍⬛ 🪿 🐦‍🔥 🐸 🐊 🐢 🦎 🐍 🐲 🐉 🦕 🦖 🐳 🐋 🐬 🦭 🐟 🐠 🐡 🦈 🐙 🐚 🪸 🪼 🦀 🦞 🦐 🦑 🦪` },
      { id: 'emoji-insetos', name: 'Insetos', text: `🐌 🦋 🐛 🐜 🐝 🪲 🐞 🦗 🪳 🕷️ 🕸️ 🦂 🦟 🪰 🪱 🦠` },
      { id: 'emoji-plantas', name: 'Plantas e flores', text: `💐 🌸 💮 🪷 🏵️ 🌹 🥀 🌺 🌻 🌼 🌷 🪻 🌱 🪴 🌲 🌳 🌴 🌵 🌾 🌿 ☘️ 🍀 🍁 🍂 🍃 🪹 🪺 🍄 🪾` },
      { id: 'emoji-frutas', name: 'Frutas e verduras', text: `🍇 🍈 🍉 🍊 🍋 🍋‍🟩 🍌 🍍 🥭 🍎 🍏 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🥜 🫘 🌰 🫚 🫛 🍄‍🟫 🫜` },
      { id: 'emoji-comidas', name: 'Comidas e doces', text: `🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯` },
      { id: 'emoji-bebidas', name: 'Bebidas e utensílios', text: `🍼 🥛 ☕ 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🫗 🥤 🧋 🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪 🫙 🏺` },
      { id: 'emoji-lugares', name: 'Lugares e construções', text: `🌍 🌎 🌏 🌐 🗺️ 🗾 🧭 🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🪵 🛖 🏘️ 🏚️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 ♨️ 🎠 🛝 🎡 🎢 💈 🎪 🛎️ 🧳` },
      { id: 'emoji-transportes', name: 'Transportes', text: `🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉 🚊 🚝 🚞 🚋 🚌 🚍 🚎 🚐 🚑 🚒 🚓 🚔 🚕 🚖 🚗 🚘 🚙 🛻 🚚 🚛 🚜 🏎️ 🏍️ 🛵 🦽 🦼 🛺 🚲 🛴 🛹 🛼 🚏 🛣️ 🛤️ 🛢️ ⛽ 🛞 🚨 🚥 🚦 🛑 🚧 ⚓ 🛟 ⛵ 🛶 🚤 🛳️ ⛴️ 🛥️ 🚢 ✈️ 🛩️ 🛫 🛬 🪂 💺 🚁 🚟 🚠 🚡 🛰️ 🚀 🛸` },
      { id: 'emoji-tempo', name: 'Relógios e clima', text: `⌛ ⏳ ⌚ ⏰ ⏱️ ⏲️ 🕰️ 🕛 🕧 🕐 🕜 🕑 🕝 🕒 🕞 🕓 🕟 🕔 🕠 🕕 🕡 🕖 🕢 🕗 🕣 🕘 🕤 🕙 🕥 🕚 🕦 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌙 🌚 🌛 🌜 🌡️ ☀️ 🌝 🌞 🪐 ⭐ 🌟 🌠 🌌 ☁️ ⛅ ⛈️ 🌤️ 🌥️ 🌦️ 🌧️ 🌨️ 🌩️ 🌪️ 🌫️ 🌬️ 🌀 🌈 🌂 ☂️ ☔ ⛱️ ⚡ ❄️ ☃️ ⛄ ☄️ 🔥 💧 🌊` },
      { id: 'emoji-festas', name: 'Festas e prêmios', text: `🎃 🎄 🎆 🎇 🧨 ✨ 🎈 🎉 🎊 🎋 🎍 🎎 🎏 🎐 🎑 🧧 🎀 🎁 🎗️ 🎟️ 🎫 🎖️ 🏆 🏅 🥇 🥈 🥉` },
      { id: 'emoji-esportes', name: 'Esportes e jogos', text: `⚽ ⚾ 🥎 🏀 🏐 🏈 🏉 🎾 🥏 🎳 🏏 🏑 🏒 🥍 🏓 🏸 🥊 🥋 🥅 ⛳ ⛸️ 🎣 🤿 🎽 🎿 🛷 🥌 🎯 🪀 🪁 🔫 🎱 🔮 🪄 🎮 🕹️ 🎰 🎲 🧩 🧸 🪅 🪩 🪆 ♠️ ♥️ ♦️ ♣️ ♟️ 🃏 🀄 🎴` },
      { id: 'emoji-artes', name: 'Artes e artesanato', text: `🎭 🖼️ 🎨 🧵 🪡 🧶 🪢` },
      { id: 'emoji-roupas', name: 'Roupas e acessórios', text: `👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 🪭 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 🪮 👑 👒 🎩 🎓 🧢 🪖 ⛑️ 📿 💄 💍 💎` },
      { id: 'emoji-musica', name: 'Som e música', text: `🔇 🔈 🔉 🔊 📢 📣 📯 🔔 🔕 🎼 🎵 🎶 🎙️ 🎚️ 🎛️ 🎤 🎧 📻 🎷 🪗 🎸 🎹 🎺 🎻 🪕 🥁 🪘 🪇 🪈 🪉` },
      { id: 'emoji-tecnologia', name: 'Celulares, computadores e vídeo', text: `📱 📲 ☎️ 📞 📟 📠 🔋 🪫 🔌 💻 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿 📀 🧮 🎥 🎞️ 📽️ 🎬 📺 📷 📸 📹 📼 🔍 🔎 🕯️ 💡 🔦 🏮 🪔` },
      { id: 'emoji-escritorio', name: 'Papéis, correio e escritório', text: `📔 📕 📖 📗 📘 📙 📚 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️` },
      { id: 'emoji-dinheiro', name: 'Dinheiro', text: `💰 🪙 💴 💵 💶 💷 💸 💳 🧾 💹` },
      { id: 'emoji-ferramentas', name: 'Ferramentas, ciência e saúde', text: `🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 💣 🪃 🏹 🛡️ 🪚 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️‍💥 ⛓️ 🪝 🧰 🧲 🪜 🪏 ⚗️ 🧪 🧫 🧬 🔬 🔭 📡 💉 🩸 💊 🩹 🩼 🩺 🩻` },
      { id: 'emoji-casa', name: 'Casa e objetos diversos', text: `🚪 🛗 🪞 🪟 🛏️ 🛋️ 🪑 🚽 🪠 🚿 🛁 🪤 🪒 🧴 🧷 🧹 🧺 🧻 🪣 🧼 🫧 🪥 🧽 🧯 🛒 🚬 ⚰️ 🪦 ⚱️ 🧿 🪬 🗿 🪧 🪪` },
      { id: 'emoji-sinais', name: 'Sinais de trânsito, religião e zodíaco', text: `🏧 🚮 🚰 ♿ 🚹 🚺 🚻 🚼 🚾 🛂 🛃 🛄 🛅 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 🪯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎` },
      { id: 'emoji-midia', name: 'Controles de mídia e símbolos', text: `🔀 🔁 🔂 ▶️ ⏩ ⏭️ ⏯️ ◀️ ⏪ ⏮️ 🔼 ⏫ 🔽 ⏬ ⏸️ ⏹️ ⏺️ ⏏️ 🎦 🔅 🔆 📶 🛜 📳 📴 ♀️ ♂️ ⚧️ ✖️ ➕ ➖ ➗ 🟰 ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ 💱 💲 ⚕️ ♻️ ⚜️ 🔱 📛 🔰 ⭕ ✅ ☑️ ✔️ ❌ ❎ ➰ ➿ 〽️ ✳️ ✴️ ❇️ ©️ ®️ ™️ 🫟 🔠 🔡 🔢 🔣 🔤 🅰️ 🆎 🅱️ 🆑 🆒 🆓 ℹ️ 🆔 Ⓜ️ 🆕 🆖 🅾️ 🆗 🅿️ 🆘 🆙 🆚 🈁 🈂️ 🈷️ 🈶 🈯 🉐 🈹 🈚 🈲 🉑 🈸 🈴 🈳 ㊗️ ㊙️ 🈺 🈵` },
      { id: 'emoji-bandeiras', name: 'Bandeiras', text: `🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🏴󠁧󠁢󠁥󠁮󠁧󠁿 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏴󠁧󠁢󠁷󠁬󠁳󠁿` },
      { id: 'emoji-paises', name: 'Bandeiras de países', text: `🇦🇨 🇦🇩 🇦🇪 🇦🇫 🇦🇬 🇦🇮 🇦🇱 🇦🇲 🇦🇴 🇦🇶 🇦🇷 🇦🇸 🇦🇹 🇦🇺 🇦🇼 🇦🇽 🇦🇿 🇧🇦 🇧🇧 🇧🇩 🇧🇪 🇧🇫 🇧🇬 🇧🇭 🇧🇮 🇧🇯 🇧🇱 🇧🇲 🇧🇳 🇧🇴 🇧🇶 🇧🇷 🇧🇸 🇧🇹 🇧🇻 🇧🇼 🇧🇾 🇧🇿 🇨🇦 🇨🇨 🇨🇩 🇨🇫 🇨🇬 🇨🇭 🇨🇮 🇨🇰 🇨🇱 🇨🇲 🇨🇳 🇨🇴 🇨🇵 🇨🇶 🇨🇷 🇨🇺 🇨🇻 🇨🇼 🇨🇽 🇨🇾 🇨🇿 🇩🇪 🇩🇬 🇩🇯 🇩🇰 🇩🇲 🇩🇴 🇩🇿 🇪🇦 🇪🇨 🇪🇪 🇪🇬 🇪🇭 🇪🇷 🇪🇸 🇪🇹 🇪🇺 🇫🇮 🇫🇯 🇫🇰 🇫🇲 🇫🇴 🇫🇷 🇬🇦 🇬🇧 🇬🇩 🇬🇪 🇬🇫 🇬🇬 🇬🇭 🇬🇮 🇬🇱 🇬🇲 🇬🇳 🇬🇵 🇬🇶 🇬🇷 🇬🇸 🇬🇹 🇬🇺 🇬🇼 🇬🇾 🇭🇰 🇭🇲 🇭🇳 🇭🇷 🇭🇹 🇭🇺 🇮🇨 🇮🇩 🇮🇪 🇮🇱 🇮🇲 🇮🇳 🇮🇴 🇮🇶 🇮🇷 🇮🇸 🇮🇹 🇯🇪 🇯🇲 🇯🇴 🇯🇵 🇰🇪 🇰🇬 🇰🇭 🇰🇮 🇰🇲 🇰🇳 🇰🇵 🇰🇷 🇰🇼 🇰🇾 🇰🇿 🇱🇦 🇱🇧 🇱🇨 🇱🇮 🇱🇰 🇱🇷 🇱🇸 🇱🇹 🇱🇺 🇱🇻 🇱🇾 🇲🇦 🇲🇨 🇲🇩 🇲🇪 🇲🇫 🇲🇬 🇲🇭 🇲🇰 🇲🇱 🇲🇲 🇲🇳 🇲🇴 🇲🇵 🇲🇶 🇲🇷 🇲🇸 🇲🇹 🇲🇺 🇲🇻 🇲🇼 🇲🇽 🇲🇾 🇲🇿 🇳🇦 🇳🇨 🇳🇪 🇳🇫 🇳🇬 🇳🇮 🇳🇱 🇳🇴 🇳🇵 🇳🇷 🇳🇺 🇳🇿 🇴🇲 🇵🇦 🇵🇪 🇵🇫 🇵🇬 🇵🇭 🇵🇰 🇵🇱 🇵🇲 🇵🇳 🇵🇷 🇵🇸 🇵🇹 🇵🇼 🇵🇾 🇶🇦 🇷🇪 🇷🇴 🇷🇸 🇷🇺 🇷🇼 🇸🇦 🇸🇧 🇸🇨 🇸🇩 🇸🇪 🇸🇬 🇸🇭 🇸🇮 🇸🇯 🇸🇰 🇸🇱 🇸🇲 🇸🇳 🇸🇴 🇸🇷 🇸🇸 🇸🇹 🇸🇻 🇸🇽 🇸🇾 🇸🇿 🇹🇦 🇹🇨 🇹🇩 🇹🇫 🇹🇬 🇹🇭 🇹🇯 🇹🇰 🇹🇱 🇹🇲 🇹🇳 🇹🇴 🇹🇷 🇹🇹 🇹🇻 🇹🇼 🇹🇿 🇺🇦 🇺🇬 🇺🇲 🇺🇳 🇺🇸 🇺🇾 🇺🇿 🇻🇦 🇻🇨 🇻🇪 🇻🇬 🇻🇮 🇻🇳 🇻🇺 🇼🇫 🇼🇸 🇽🇰 🇾🇪 🇾🇹 🇿🇦 🇿🇲 🇿🇼` },
      { id: 'emoji-tom-claro', name: 'Tom de pele claro', text: `👋🏻 🤚🏻 🖐🏻 ✋🏻 🖖🏻 🫱🏻 🫲🏻 🫳🏻 🫴🏻 🫷🏻 🫸🏻 👌🏻 🤌🏻 🤏🏻 ✌🏻 🤞🏻 🫰🏻 🤟🏻 🤘🏻 🤙🏻 👈🏻 👉🏻 👆🏻 🖕🏻 👇🏻 ☝🏻 🫵🏻 👍🏻 👎🏻 ✊🏻 👊🏻 🤛🏻 🤜🏻 👏🏻 🙌🏻 🫶🏻 👐🏻 🤲🏻 🤝🏻 🙏🏻 ✍🏻 💅🏻 🤳🏻 💪🏻 🦵🏻 🦶🏻 👂🏻 🦻🏻 👃🏻 👶🏻 🧒🏻 👦🏻 👧🏻 🧑🏻 👱🏻 👨🏻 🧔🏻 🧔🏻‍♂️ 🧔🏻‍♀️ 👨🏻‍🦰 👨🏻‍🦱 👨🏻‍🦳 👨🏻‍🦲 👩🏻 👩🏻‍🦰 🧑🏻‍🦰 👩🏻‍🦱 🧑🏻‍🦱 👩🏻‍🦳 🧑🏻‍🦳 👩🏻‍🦲 🧑🏻‍🦲 👱🏻‍♀️ 👱🏻‍♂️ 🧓🏻 👴🏻 👵🏻 🙍🏻 🙍🏻‍♂️ 🙍🏻‍♀️ 🙎🏻 🙎🏻‍♂️ 🙎🏻‍♀️ 🙅🏻 🙅🏻‍♂️ 🙅🏻‍♀️ 🙆🏻 🙆🏻‍♂️ 🙆🏻‍♀️ 💁🏻 💁🏻‍♂️ 💁🏻‍♀️ 🙋🏻 🙋🏻‍♂️ 🙋🏻‍♀️ 🧏🏻 🧏🏻‍♂️ 🧏🏻‍♀️ 🙇🏻 🙇🏻‍♂️ 🙇🏻‍♀️ 🤦🏻 🤦🏻‍♂️ 🤦🏻‍♀️ 🤷🏻 🤷🏻‍♂️ 🤷🏻‍♀️ 🧑🏻‍⚕️ 👨🏻‍⚕️ 👩🏻‍⚕️ 🧑🏻‍🎓 👨🏻‍🎓 👩🏻‍🎓 🧑🏻‍🏫 👨🏻‍🏫 👩🏻‍🏫 🧑🏻‍⚖️ 👨🏻‍⚖️ 👩🏻‍⚖️ 🧑🏻‍🌾 👨🏻‍🌾 👩🏻‍🌾 🧑🏻‍🍳 👨🏻‍🍳 👩🏻‍🍳 🧑🏻‍🔧 👨🏻‍🔧 👩🏻‍🔧 🧑🏻‍🏭 👨🏻‍🏭 👩🏻‍🏭 🧑🏻‍💼 👨🏻‍💼 👩🏻‍💼 🧑🏻‍🔬 👨🏻‍🔬 👩🏻‍🔬 🧑🏻‍💻 👨🏻‍💻 👩🏻‍💻 🧑🏻‍🎤 👨🏻‍🎤 👩🏻‍🎤 🧑🏻‍🎨 👨🏻‍🎨 👩🏻‍🎨 🧑🏻‍✈️ 👨🏻‍✈️ 👩🏻‍✈️ 🧑🏻‍🚀 👨🏻‍🚀 👩🏻‍🚀 🧑🏻‍🚒 👨🏻‍🚒 👩🏻‍🚒 👮🏻 👮🏻‍♂️ 👮🏻‍♀️ 🕵🏻 🕵🏻‍♂️ 🕵🏻‍♀️ 💂🏻 💂🏻‍♂️ 💂🏻‍♀️ 🥷🏻 👷🏻 👷🏻‍♂️ 👷🏻‍♀️ 🫅🏻 🤴🏻 👸🏻 👳🏻 👳🏻‍♂️ 👳🏻‍♀️ 👲🏻 🧕🏻 🤵🏻 🤵🏻‍♂️ 🤵🏻‍♀️ 👰🏻 👰🏻‍♂️ 👰🏻‍♀️ 🤰🏻 🫃🏻 🫄🏻 🤱🏻 👩🏻‍🍼 👨🏻‍🍼 🧑🏻‍🍼 👼🏻 🎅🏻 🤶🏻 🧑🏻‍🎄 🦸🏻 🦸🏻‍♂️ 🦸🏻‍♀️ 🦹🏻 🦹🏻‍♂️ 🦹🏻‍♀️ 🧙🏻 🧙🏻‍♂️ 🧙🏻‍♀️ 🧚🏻 🧚🏻‍♂️ 🧚🏻‍♀️ 🧛🏻 🧛🏻‍♂️ 🧛🏻‍♀️ 🧜🏻 🧜🏻‍♂️ 🧜🏻‍♀️ 🧝🏻 🧝🏻‍♂️ 🧝🏻‍♀️ 💆🏻 💆🏻‍♂️ 💆🏻‍♀️ 💇🏻 💇🏻‍♂️ 💇🏻‍♀️ 🚶🏻 🚶🏻‍♂️ 🚶🏻‍♀️ 🚶🏻‍➡️ 🚶🏻‍♀️‍➡️ 🚶🏻‍♂️‍➡️ 🧍🏻 🧍🏻‍♂️ 🧍🏻‍♀️ 🧎🏻 🧎🏻‍♂️ 🧎🏻‍♀️ 🧎🏻‍➡️ 🧎🏻‍♀️‍➡️ 🧎🏻‍♂️‍➡️ 🧑🏻‍🦯 🧑🏻‍🦯‍➡️ 👨🏻‍🦯 👨🏻‍🦯‍➡️ 👩🏻‍🦯 👩🏻‍🦯‍➡️ 🧑🏻‍🦼 🧑🏻‍🦼‍➡️ 👨🏻‍🦼 👨🏻‍🦼‍➡️ 👩🏻‍🦼 👩🏻‍🦼‍➡️ 🧑🏻‍🦽 🧑🏻‍🦽‍➡️ 👨🏻‍🦽 👨🏻‍🦽‍➡️ 👩🏻‍🦽 👩🏻‍🦽‍➡️ 🏃🏻 🏃🏻‍♂️ 🏃🏻‍♀️ 🏃🏻‍➡️ 🏃🏻‍♀️‍➡️ 🏃🏻‍♂️‍➡️ 💃🏻 🕺🏻 🕴🏻 🧖🏻 🧖🏻‍♂️ 🧖🏻‍♀️ 🧗🏻 🧗🏻‍♂️ 🧗🏻‍♀️ 🏇🏻 🏂🏻 🏌🏻 🏌🏻‍♂️ 🏌🏻‍♀️ 🏄🏻 🏄🏻‍♂️ 🏄🏻‍♀️ 🚣🏻 🚣🏻‍♂️ 🚣🏻‍♀️ 🏊🏻 🏊🏻‍♂️ 🏊🏻‍♀️ ⛹🏻 ⛹🏻‍♂️ ⛹🏻‍♀️ 🏋🏻 🏋🏻‍♂️ 🏋🏻‍♀️ 🚴🏻 🚴🏻‍♂️ 🚴🏻‍♀️ 🚵🏻 🚵🏻‍♂️ 🚵🏻‍♀️ 🤸🏻 🤸🏻‍♂️ 🤸🏻‍♀️ 🤽🏻 🤽🏻‍♂️ 🤽🏻‍♀️ 🤾🏻 🤾🏻‍♂️ 🤾🏻‍♀️ 🤹🏻 🤹🏻‍♂️ 🤹🏻‍♀️ 🧘🏻 🧘🏻‍♂️ 🧘🏻‍♀️ 🛀🏻 🛌🏻 🧑🏻‍🤝‍🧑🏻 👭🏻 👫🏻 👬🏻 💏🏻 👩🏻‍❤️‍💋‍👨🏻 👨🏻‍❤️‍💋‍👨🏻 👩🏻‍❤️‍💋‍👩🏻 💑🏻 👩🏻‍❤️‍👨🏻 👨🏻‍❤️‍👨🏻 👩🏻‍❤️‍👩🏻` },
      { id: 'emoji-tom-medio-claro', name: 'Tom de pele médio-claro', text: `👋🏼 🤚🏼 🖐🏼 ✋🏼 🖖🏼 🫱🏼 🫲🏼 🫳🏼 🫴🏼 🫷🏼 🫸🏼 👌🏼 🤌🏼 🤏🏼 ✌🏼 🤞🏼 🫰🏼 🤟🏼 🤘🏼 🤙🏼 👈🏼 👉🏼 👆🏼 🖕🏼 👇🏼 ☝🏼 🫵🏼 👍🏼 👎🏼 ✊🏼 👊🏼 🤛🏼 🤜🏼 👏🏼 🙌🏼 🫶🏼 👐🏼 🤲🏼 🤝🏼 🙏🏼 ✍🏼 💅🏼 🤳🏼 💪🏼 🦵🏼 🦶🏼 👂🏼 🦻🏼 👃🏼 👶🏼 🧒🏼 👦🏼 👧🏼 🧑🏼 👱🏼 👨🏼 🧔🏼 🧔🏼‍♂️ 🧔🏼‍♀️ 👨🏼‍🦰 👨🏼‍🦱 👨🏼‍🦳 👨🏼‍🦲 👩🏼 👩🏼‍🦰 🧑🏼‍🦰 👩🏼‍🦱 🧑🏼‍🦱 👩🏼‍🦳 🧑🏼‍🦳 👩🏼‍🦲 🧑🏼‍🦲 👱🏼‍♀️ 👱🏼‍♂️ 🧓🏼 👴🏼 👵🏼 🙍🏼 🙍🏼‍♂️ 🙍🏼‍♀️ 🙎🏼 🙎🏼‍♂️ 🙎🏼‍♀️ 🙅🏼 🙅🏼‍♂️ 🙅🏼‍♀️ 🙆🏼 🙆🏼‍♂️ 🙆🏼‍♀️ 💁🏼 💁🏼‍♂️ 💁🏼‍♀️ 🙋🏼 🙋🏼‍♂️ 🙋🏼‍♀️ 🧏🏼 🧏🏼‍♂️ 🧏🏼‍♀️ 🙇🏼 🙇🏼‍♂️ 🙇🏼‍♀️ 🤦🏼 🤦🏼‍♂️ 🤦🏼‍♀️ 🤷🏼 🤷🏼‍♂️ 🤷🏼‍♀️ 🧑🏼‍⚕️ 👨🏼‍⚕️ 👩🏼‍⚕️ 🧑🏼‍🎓 👨🏼‍🎓 👩🏼‍🎓 🧑🏼‍🏫 👨🏼‍🏫 👩🏼‍🏫 🧑🏼‍⚖️ 👨🏼‍⚖️ 👩🏼‍⚖️ 🧑🏼‍🌾 👨🏼‍🌾 👩🏼‍🌾 🧑🏼‍🍳 👨🏼‍🍳 👩🏼‍🍳 🧑🏼‍🔧 👨🏼‍🔧 👩🏼‍🔧 🧑🏼‍🏭 👨🏼‍🏭 👩🏼‍🏭 🧑🏼‍💼 👨🏼‍💼 👩🏼‍💼 🧑🏼‍🔬 👨🏼‍🔬 👩🏼‍🔬 🧑🏼‍💻 👨🏼‍💻 👩🏼‍💻 🧑🏼‍🎤 👨🏼‍🎤 👩🏼‍🎤 🧑🏼‍🎨 👨🏼‍🎨 👩🏼‍🎨 🧑🏼‍✈️ 👨🏼‍✈️ 👩🏼‍✈️ 🧑🏼‍🚀 👨🏼‍🚀 👩🏼‍🚀 🧑🏼‍🚒 👨🏼‍🚒 👩🏼‍🚒 👮🏼 👮🏼‍♂️ 👮🏼‍♀️ 🕵🏼 🕵🏼‍♂️ 🕵🏼‍♀️ 💂🏼 💂🏼‍♂️ 💂🏼‍♀️ 🥷🏼 👷🏼 👷🏼‍♂️ 👷🏼‍♀️ 🫅🏼 🤴🏼 👸🏼 👳🏼 👳🏼‍♂️ 👳🏼‍♀️ 👲🏼 🧕🏼 🤵🏼 🤵🏼‍♂️ 🤵🏼‍♀️ 👰🏼 👰🏼‍♂️ 👰🏼‍♀️ 🤰🏼 🫃🏼 🫄🏼 🤱🏼 👩🏼‍🍼 👨🏼‍🍼 🧑🏼‍🍼 👼🏼 🎅🏼 🤶🏼 🧑🏼‍🎄 🦸🏼 🦸🏼‍♂️ 🦸🏼‍♀️ 🦹🏼 🦹🏼‍♂️ 🦹🏼‍♀️ 🧙🏼 🧙🏼‍♂️ 🧙🏼‍♀️ 🧚🏼 🧚🏼‍♂️ 🧚🏼‍♀️ 🧛🏼 🧛🏼‍♂️ 🧛🏼‍♀️ 🧜🏼 🧜🏼‍♂️ 🧜🏼‍♀️ 🧝🏼 🧝🏼‍♂️ 🧝🏼‍♀️ 💆🏼 💆🏼‍♂️ 💆🏼‍♀️ 💇🏼 💇🏼‍♂️ 💇🏼‍♀️ 🚶🏼 🚶🏼‍♂️ 🚶🏼‍♀️ 🚶🏼‍➡️ 🚶🏼‍♀️‍➡️ 🚶🏼‍♂️‍➡️ 🧍🏼 🧍🏼‍♂️ 🧍🏼‍♀️ 🧎🏼 🧎🏼‍♂️ 🧎🏼‍♀️ 🧎🏼‍➡️ 🧎🏼‍♀️‍➡️ 🧎🏼‍♂️‍➡️ 🧑🏼‍🦯 🧑🏼‍🦯‍➡️ 👨🏼‍🦯 👨🏼‍🦯‍➡️ 👩🏼‍🦯 👩🏼‍🦯‍➡️ 🧑🏼‍🦼 🧑🏼‍🦼‍➡️ 👨🏼‍🦼 👨🏼‍🦼‍➡️ 👩🏼‍🦼 👩🏼‍🦼‍➡️ 🧑🏼‍🦽 🧑🏼‍🦽‍➡️ 👨🏼‍🦽 👨🏼‍🦽‍➡️ 👩🏼‍🦽 👩🏼‍🦽‍➡️ 🏃🏼 🏃🏼‍♂️ 🏃🏼‍♀️ 🏃🏼‍➡️ 🏃🏼‍♀️‍➡️ 🏃🏼‍♂️‍➡️ 💃🏼 🕺🏼 🕴🏼 🧖🏼 🧖🏼‍♂️ 🧖🏼‍♀️ 🧗🏼 🧗🏼‍♂️ 🧗🏼‍♀️ 🏇🏼 🏂🏼 🏌🏼 🏌🏼‍♂️ 🏌🏼‍♀️ 🏄🏼 🏄🏼‍♂️ 🏄🏼‍♀️ 🚣🏼 🚣🏼‍♂️ 🚣🏼‍♀️ 🏊🏼 🏊🏼‍♂️ 🏊🏼‍♀️ ⛹🏼 ⛹🏼‍♂️ ⛹🏼‍♀️ 🏋🏼 🏋🏼‍♂️ 🏋🏼‍♀️ 🚴🏼 🚴🏼‍♂️ 🚴🏼‍♀️ 🚵🏼 🚵🏼‍♂️ 🚵🏼‍♀️ 🤸🏼 🤸🏼‍♂️ 🤸🏼‍♀️ 🤽🏼 🤽🏼‍♂️ 🤽🏼‍♀️ 🤾🏼 🤾🏼‍♂️ 🤾🏼‍♀️ 🤹🏼 🤹🏼‍♂️ 🤹🏼‍♀️ 🧘🏼 🧘🏼‍♂️ 🧘🏼‍♀️ 🛀🏼 🛌🏼 🧑🏼‍🤝‍🧑🏼 👭🏼 👫🏼 👬🏼 💏🏼 👩🏼‍❤️‍💋‍👨🏼 👨🏼‍❤️‍💋‍👨🏼 👩🏼‍❤️‍💋‍👩🏼 💑🏼 👩🏼‍❤️‍👨🏼 👨🏼‍❤️‍👨🏼 👩🏼‍❤️‍👩🏼` },
      { id: 'emoji-tom-medio', name: 'Tom de pele médio', text: `👋🏽 🤚🏽 🖐🏽 ✋🏽 🖖🏽 🫱🏽 🫲🏽 🫳🏽 🫴🏽 🫷🏽 🫸🏽 👌🏽 🤌🏽 🤏🏽 ✌🏽 🤞🏽 🫰🏽 🤟🏽 🤘🏽 🤙🏽 👈🏽 👉🏽 👆🏽 🖕🏽 👇🏽 ☝🏽 🫵🏽 👍🏽 👎🏽 ✊🏽 👊🏽 🤛🏽 🤜🏽 👏🏽 🙌🏽 🫶🏽 👐🏽 🤲🏽 🤝🏽 🙏🏽 ✍🏽 💅🏽 🤳🏽 💪🏽 🦵🏽 🦶🏽 👂🏽 🦻🏽 👃🏽 👶🏽 🧒🏽 👦🏽 👧🏽 🧑🏽 👱🏽 👨🏽 🧔🏽 🧔🏽‍♂️ 🧔🏽‍♀️ 👨🏽‍🦰 👨🏽‍🦱 👨🏽‍🦳 👨🏽‍🦲 👩🏽 👩🏽‍🦰 🧑🏽‍🦰 👩🏽‍🦱 🧑🏽‍🦱 👩🏽‍🦳 🧑🏽‍🦳 👩🏽‍🦲 🧑🏽‍🦲 👱🏽‍♀️ 👱🏽‍♂️ 🧓🏽 👴🏽 👵🏽 🙍🏽 🙍🏽‍♂️ 🙍🏽‍♀️ 🙎🏽 🙎🏽‍♂️ 🙎🏽‍♀️ 🙅🏽 🙅🏽‍♂️ 🙅🏽‍♀️ 🙆🏽 🙆🏽‍♂️ 🙆🏽‍♀️ 💁🏽 💁🏽‍♂️ 💁🏽‍♀️ 🙋🏽 🙋🏽‍♂️ 🙋🏽‍♀️ 🧏🏽 🧏🏽‍♂️ 🧏🏽‍♀️ 🙇🏽 🙇🏽‍♂️ 🙇🏽‍♀️ 🤦🏽 🤦🏽‍♂️ 🤦🏽‍♀️ 🤷🏽 🤷🏽‍♂️ 🤷🏽‍♀️ 🧑🏽‍⚕️ 👨🏽‍⚕️ 👩🏽‍⚕️ 🧑🏽‍🎓 👨🏽‍🎓 👩🏽‍🎓 🧑🏽‍🏫 👨🏽‍🏫 👩🏽‍🏫 🧑🏽‍⚖️ 👨🏽‍⚖️ 👩🏽‍⚖️ 🧑🏽‍🌾 👨🏽‍🌾 👩🏽‍🌾 🧑🏽‍🍳 👨🏽‍🍳 👩🏽‍🍳 🧑🏽‍🔧 👨🏽‍🔧 👩🏽‍🔧 🧑🏽‍🏭 👨🏽‍🏭 👩🏽‍🏭 🧑🏽‍💼 👨🏽‍💼 👩🏽‍💼 🧑🏽‍🔬 👨🏽‍🔬 👩🏽‍🔬 🧑🏽‍💻 👨🏽‍💻 👩🏽‍💻 🧑🏽‍🎤 👨🏽‍🎤 👩🏽‍🎤 🧑🏽‍🎨 👨🏽‍🎨 👩🏽‍🎨 🧑🏽‍✈️ 👨🏽‍✈️ 👩🏽‍✈️ 🧑🏽‍🚀 👨🏽‍🚀 👩🏽‍🚀 🧑🏽‍🚒 👨🏽‍🚒 👩🏽‍🚒 👮🏽 👮🏽‍♂️ 👮🏽‍♀️ 🕵🏽 🕵🏽‍♂️ 🕵🏽‍♀️ 💂🏽 💂🏽‍♂️ 💂🏽‍♀️ 🥷🏽 👷🏽 👷🏽‍♂️ 👷🏽‍♀️ 🫅🏽 🤴🏽 👸🏽 👳🏽 👳🏽‍♂️ 👳🏽‍♀️ 👲🏽 🧕🏽 🤵🏽 🤵🏽‍♂️ 🤵🏽‍♀️ 👰🏽 👰🏽‍♂️ 👰🏽‍♀️ 🤰🏽 🫃🏽 🫄🏽 🤱🏽 👩🏽‍🍼 👨🏽‍🍼 🧑🏽‍🍼 👼🏽 🎅🏽 🤶🏽 🧑🏽‍🎄 🦸🏽 🦸🏽‍♂️ 🦸🏽‍♀️ 🦹🏽 🦹🏽‍♂️ 🦹🏽‍♀️ 🧙🏽 🧙🏽‍♂️ 🧙🏽‍♀️ 🧚🏽 🧚🏽‍♂️ 🧚🏽‍♀️ 🧛🏽 🧛🏽‍♂️ 🧛🏽‍♀️ 🧜🏽 🧜🏽‍♂️ 🧜🏽‍♀️ 🧝🏽 🧝🏽‍♂️ 🧝🏽‍♀️ 💆🏽 💆🏽‍♂️ 💆🏽‍♀️ 💇🏽 💇🏽‍♂️ 💇🏽‍♀️ 🚶🏽 🚶🏽‍♂️ 🚶🏽‍♀️ 🚶🏽‍➡️ 🚶🏽‍♀️‍➡️ 🚶🏽‍♂️‍➡️ 🧍🏽 🧍🏽‍♂️ 🧍🏽‍♀️ 🧎🏽 🧎🏽‍♂️ 🧎🏽‍♀️ 🧎🏽‍➡️ 🧎🏽‍♀️‍➡️ 🧎🏽‍♂️‍➡️ 🧑🏽‍🦯 🧑🏽‍🦯‍➡️ 👨🏽‍🦯 👨🏽‍🦯‍➡️ 👩🏽‍🦯 👩🏽‍🦯‍➡️ 🧑🏽‍🦼 🧑🏽‍🦼‍➡️ 👨🏽‍🦼 👨🏽‍🦼‍➡️ 👩🏽‍🦼 👩🏽‍🦼‍➡️ 🧑🏽‍🦽 🧑🏽‍🦽‍➡️ 👨🏽‍🦽 👨🏽‍🦽‍➡️ 👩🏽‍🦽 👩🏽‍🦽‍➡️ 🏃🏽 🏃🏽‍♂️ 🏃🏽‍♀️ 🏃🏽‍➡️ 🏃🏽‍♀️‍➡️ 🏃🏽‍♂️‍➡️ 💃🏽 🕺🏽 🕴🏽 🧖🏽 🧖🏽‍♂️ 🧖🏽‍♀️ 🧗🏽 🧗🏽‍♂️ 🧗🏽‍♀️ 🏇🏽 🏂🏽 🏌🏽 🏌🏽‍♂️ 🏌🏽‍♀️ 🏄🏽 🏄🏽‍♂️ 🏄🏽‍♀️ 🚣🏽 🚣🏽‍♂️ 🚣🏽‍♀️ 🏊🏽 🏊🏽‍♂️ 🏊🏽‍♀️ ⛹🏽 ⛹🏽‍♂️ ⛹🏽‍♀️ 🏋🏽 🏋🏽‍♂️ 🏋🏽‍♀️ 🚴🏽 🚴🏽‍♂️ 🚴🏽‍♀️ 🚵🏽 🚵🏽‍♂️ 🚵🏽‍♀️ 🤸🏽 🤸🏽‍♂️ 🤸🏽‍♀️ 🤽🏽 🤽🏽‍♂️ 🤽🏽‍♀️ 🤾🏽 🤾🏽‍♂️ 🤾🏽‍♀️ 🤹🏽 🤹🏽‍♂️ 🤹🏽‍♀️ 🧘🏽 🧘🏽‍♂️ 🧘🏽‍♀️ 🛀🏽 🛌🏽 🧑🏽‍🤝‍🧑🏽 👭🏽 👫🏽 👬🏽 💏🏽 👩🏽‍❤️‍💋‍👨🏽 👨🏽‍❤️‍💋‍👨🏽 👩🏽‍❤️‍💋‍👩🏽 💑🏽 👩🏽‍❤️‍👨🏽 👨🏽‍❤️‍👨🏽 👩🏽‍❤️‍👩🏽` },
      { id: 'emoji-tom-medio-escuro', name: 'Tom de pele médio-escuro', text: `👋🏾 🤚🏾 🖐🏾 ✋🏾 🖖🏾 🫱🏾 🫲🏾 🫳🏾 🫴🏾 🫷🏾 🫸🏾 👌🏾 🤌🏾 🤏🏾 ✌🏾 🤞🏾 🫰🏾 🤟🏾 🤘🏾 🤙🏾 👈🏾 👉🏾 👆🏾 🖕🏾 👇🏾 ☝🏾 🫵🏾 👍🏾 👎🏾 ✊🏾 👊🏾 🤛🏾 🤜🏾 👏🏾 🙌🏾 🫶🏾 👐🏾 🤲🏾 🤝🏾 🙏🏾 ✍🏾 💅🏾 🤳🏾 💪🏾 🦵🏾 🦶🏾 👂🏾 🦻🏾 👃🏾 👶🏾 🧒🏾 👦🏾 👧🏾 🧑🏾 👱🏾 👨🏾 🧔🏾 🧔🏾‍♂️ 🧔🏾‍♀️ 👨🏾‍🦰 👨🏾‍🦱 👨🏾‍🦳 👨🏾‍🦲 👩🏾 👩🏾‍🦰 🧑🏾‍🦰 👩🏾‍🦱 🧑🏾‍🦱 👩🏾‍🦳 🧑🏾‍🦳 👩🏾‍🦲 🧑🏾‍🦲 👱🏾‍♀️ 👱🏾‍♂️ 🧓🏾 👴🏾 👵🏾 🙍🏾 🙍🏾‍♂️ 🙍🏾‍♀️ 🙎🏾 🙎🏾‍♂️ 🙎🏾‍♀️ 🙅🏾 🙅🏾‍♂️ 🙅🏾‍♀️ 🙆🏾 🙆🏾‍♂️ 🙆🏾‍♀️ 💁🏾 💁🏾‍♂️ 💁🏾‍♀️ 🙋🏾 🙋🏾‍♂️ 🙋🏾‍♀️ 🧏🏾 🧏🏾‍♂️ 🧏🏾‍♀️ 🙇🏾 🙇🏾‍♂️ 🙇🏾‍♀️ 🤦🏾 🤦🏾‍♂️ 🤦🏾‍♀️ 🤷🏾 🤷🏾‍♂️ 🤷🏾‍♀️ 🧑🏾‍⚕️ 👨🏾‍⚕️ 👩🏾‍⚕️ 🧑🏾‍🎓 👨🏾‍🎓 👩🏾‍🎓 🧑🏾‍🏫 👨🏾‍🏫 👩🏾‍🏫 🧑🏾‍⚖️ 👨🏾‍⚖️ 👩🏾‍⚖️ 🧑🏾‍🌾 👨🏾‍🌾 👩🏾‍🌾 🧑🏾‍🍳 👨🏾‍🍳 👩🏾‍🍳 🧑🏾‍🔧 👨🏾‍🔧 👩🏾‍🔧 🧑🏾‍🏭 👨🏾‍🏭 👩🏾‍🏭 🧑🏾‍💼 👨🏾‍💼 👩🏾‍💼 🧑🏾‍🔬 👨🏾‍🔬 👩🏾‍🔬 🧑🏾‍💻 👨🏾‍💻 👩🏾‍💻 🧑🏾‍🎤 👨🏾‍🎤 👩🏾‍🎤 🧑🏾‍🎨 👨🏾‍🎨 👩🏾‍🎨 🧑🏾‍✈️ 👨🏾‍✈️ 👩🏾‍✈️ 🧑🏾‍🚀 👨🏾‍🚀 👩🏾‍🚀 🧑🏾‍🚒 👨🏾‍🚒 👩🏾‍🚒 👮🏾 👮🏾‍♂️ 👮🏾‍♀️ 🕵🏾 🕵🏾‍♂️ 🕵🏾‍♀️ 💂🏾 💂🏾‍♂️ 💂🏾‍♀️ 🥷🏾 👷🏾 👷🏾‍♂️ 👷🏾‍♀️ 🫅🏾 🤴🏾 👸🏾 👳🏾 👳🏾‍♂️ 👳🏾‍♀️ 👲🏾 🧕🏾 🤵🏾 🤵🏾‍♂️ 🤵🏾‍♀️ 👰🏾 👰🏾‍♂️ 👰🏾‍♀️ 🤰🏾 🫃🏾 🫄🏾 🤱🏾 👩🏾‍🍼 👨🏾‍🍼 🧑🏾‍🍼 👼🏾 🎅🏾 🤶🏾 🧑🏾‍🎄 🦸🏾 🦸🏾‍♂️ 🦸🏾‍♀️ 🦹🏾 🦹🏾‍♂️ 🦹🏾‍♀️ 🧙🏾 🧙🏾‍♂️ 🧙🏾‍♀️ 🧚🏾 🧚🏾‍♂️ 🧚🏾‍♀️ 🧛🏾 🧛🏾‍♂️ 🧛🏾‍♀️ 🧜🏾 🧜🏾‍♂️ 🧜🏾‍♀️ 🧝🏾 🧝🏾‍♂️ 🧝🏾‍♀️ 💆🏾 💆🏾‍♂️ 💆🏾‍♀️ 💇🏾 💇🏾‍♂️ 💇🏾‍♀️ 🚶🏾 🚶🏾‍♂️ 🚶🏾‍♀️ 🚶🏾‍➡️ 🚶🏾‍♀️‍➡️ 🚶🏾‍♂️‍➡️ 🧍🏾 🧍🏾‍♂️ 🧍🏾‍♀️ 🧎🏾 🧎🏾‍♂️ 🧎🏾‍♀️ 🧎🏾‍➡️ 🧎🏾‍♀️‍➡️ 🧎🏾‍♂️‍➡️ 🧑🏾‍🦯 🧑🏾‍🦯‍➡️ 👨🏾‍🦯 👨🏾‍🦯‍➡️ 👩🏾‍🦯 👩🏾‍🦯‍➡️ 🧑🏾‍🦼 🧑🏾‍🦼‍➡️ 👨🏾‍🦼 👨🏾‍🦼‍➡️ 👩🏾‍🦼 👩🏾‍🦼‍➡️ 🧑🏾‍🦽 🧑🏾‍🦽‍➡️ 👨🏾‍🦽 👨🏾‍🦽‍➡️ 👩🏾‍🦽 👩🏾‍🦽‍➡️ 🏃🏾 🏃🏾‍♂️ 🏃🏾‍♀️ 🏃🏾‍➡️ 🏃🏾‍♀️‍➡️ 🏃🏾‍♂️‍➡️ 💃🏾 🕺🏾 🕴🏾 🧖🏾 🧖🏾‍♂️ 🧖🏾‍♀️ 🧗🏾 🧗🏾‍♂️ 🧗🏾‍♀️ 🏇🏾 🏂🏾 🏌🏾 🏌🏾‍♂️ 🏌🏾‍♀️ 🏄🏾 🏄🏾‍♂️ 🏄🏾‍♀️ 🚣🏾 🚣🏾‍♂️ 🚣🏾‍♀️ 🏊🏾 🏊🏾‍♂️ 🏊🏾‍♀️ ⛹🏾 ⛹🏾‍♂️ ⛹🏾‍♀️ 🏋🏾 🏋🏾‍♂️ 🏋🏾‍♀️ 🚴🏾 🚴🏾‍♂️ 🚴🏾‍♀️ 🚵🏾 🚵🏾‍♂️ 🚵🏾‍♀️ 🤸🏾 🤸🏾‍♂️ 🤸🏾‍♀️ 🤽🏾 🤽🏾‍♂️ 🤽🏾‍♀️ 🤾🏾 🤾🏾‍♂️ 🤾🏾‍♀️ 🤹🏾 🤹🏾‍♂️ 🤹🏾‍♀️ 🧘🏾 🧘🏾‍♂️ 🧘🏾‍♀️ 🛀🏾 🛌🏾 🧑🏾‍🤝‍🧑🏾 👭🏾 👫🏾 👬🏾 💏🏾 👩🏾‍❤️‍💋‍👨🏾 👨🏾‍❤️‍💋‍👨🏾 👩🏾‍❤️‍💋‍👩🏾 💑🏾 👩🏾‍❤️‍👨🏾 👨🏾‍❤️‍👨🏾 👩🏾‍❤️‍👩🏾` },
      { id: 'emoji-tom-escuro', name: 'Tom de pele escuro', text: `👋🏿 🤚🏿 🖐🏿 ✋🏿 🖖🏿 🫱🏿 🫲🏿 🫳🏿 🫴🏿 🫷🏿 🫸🏿 👌🏿 🤌🏿 🤏🏿 ✌🏿 🤞🏿 🫰🏿 🤟🏿 🤘🏿 🤙🏿 👈🏿 👉🏿 👆🏿 🖕🏿 👇🏿 ☝🏿 🫵🏿 👍🏿 👎🏿 ✊🏿 👊🏿 🤛🏿 🤜🏿 👏🏿 🙌🏿 🫶🏿 👐🏿 🤲🏿 🤝🏿 🙏🏿 ✍🏿 💅🏿 🤳🏿 💪🏿 🦵🏿 🦶🏿 👂🏿 🦻🏿 👃🏿 👶🏿 🧒🏿 👦🏿 👧🏿 🧑🏿 👱🏿 👨🏿 🧔🏿 🧔🏿‍♂️ 🧔🏿‍♀️ 👨🏿‍🦰 👨🏿‍🦱 👨🏿‍🦳 👨🏿‍🦲 👩🏿 👩🏿‍🦰 🧑🏿‍🦰 👩🏿‍🦱 🧑🏿‍🦱 👩🏿‍🦳 🧑🏿‍🦳 👩🏿‍🦲 🧑🏿‍🦲 👱🏿‍♀️ 👱🏿‍♂️ 🧓🏿 👴🏿 👵🏿 🙍🏿 🙍🏿‍♂️ 🙍🏿‍♀️ 🙎🏿 🙎🏿‍♂️ 🙎🏿‍♀️ 🙅🏿 🙅🏿‍♂️ 🙅🏿‍♀️ 🙆🏿 🙆🏿‍♂️ 🙆🏿‍♀️ 💁🏿 💁🏿‍♂️ 💁🏿‍♀️ 🙋🏿 🙋🏿‍♂️ 🙋🏿‍♀️ 🧏🏿 🧏🏿‍♂️ 🧏🏿‍♀️ 🙇🏿 🙇🏿‍♂️ 🙇🏿‍♀️ 🤦🏿 🤦🏿‍♂️ 🤦🏿‍♀️ 🤷🏿 🤷🏿‍♂️ 🤷🏿‍♀️ 🧑🏿‍⚕️ 👨🏿‍⚕️ 👩🏿‍⚕️ 🧑🏿‍🎓 👨🏿‍🎓 👩🏿‍🎓 🧑🏿‍🏫 👨🏿‍🏫 👩🏿‍🏫 🧑🏿‍⚖️ 👨🏿‍⚖️ 👩🏿‍⚖️ 🧑🏿‍🌾 👨🏿‍🌾 👩🏿‍🌾 🧑🏿‍🍳 👨🏿‍🍳 👩🏿‍🍳 🧑🏿‍🔧 👨🏿‍🔧 👩🏿‍🔧 🧑🏿‍🏭 👨🏿‍🏭 👩🏿‍🏭 🧑🏿‍💼 👨🏿‍💼 👩🏿‍💼 🧑🏿‍🔬 👨🏿‍🔬 👩🏿‍🔬 🧑🏿‍💻 👨🏿‍💻 👩🏿‍💻 🧑🏿‍🎤 👨🏿‍🎤 👩🏿‍🎤 🧑🏿‍🎨 👨🏿‍🎨 👩🏿‍🎨 🧑🏿‍✈️ 👨🏿‍✈️ 👩🏿‍✈️ 🧑🏿‍🚀 👨🏿‍🚀 👩🏿‍🚀 🧑🏿‍🚒 👨🏿‍🚒 👩🏿‍🚒 👮🏿 👮🏿‍♂️ 👮🏿‍♀️ 🕵🏿 🕵🏿‍♂️ 🕵🏿‍♀️ 💂🏿 💂🏿‍♂️ 💂🏿‍♀️ 🥷🏿 👷🏿 👷🏿‍♂️ 👷🏿‍♀️ 🫅🏿 🤴🏿 👸🏿 👳🏿 👳🏿‍♂️ 👳🏿‍♀️ 👲🏿 🧕🏿 🤵🏿 🤵🏿‍♂️ 🤵🏿‍♀️ 👰🏿 👰🏿‍♂️ 👰🏿‍♀️ 🤰🏿 🫃🏿 🫄🏿 🤱🏿 👩🏿‍🍼 👨🏿‍🍼 🧑🏿‍🍼 👼🏿 🎅🏿 🤶🏿 🧑🏿‍🎄 🦸🏿 🦸🏿‍♂️ 🦸🏿‍♀️ 🦹🏿 🦹🏿‍♂️ 🦹🏿‍♀️ 🧙🏿 🧙🏿‍♂️ 🧙🏿‍♀️ 🧚🏿 🧚🏿‍♂️ 🧚🏿‍♀️ 🧛🏿 🧛🏿‍♂️ 🧛🏿‍♀️ 🧜🏿 🧜🏿‍♂️ 🧜🏿‍♀️ 🧝🏿 🧝🏿‍♂️ 🧝🏿‍♀️ 💆🏿 💆🏿‍♂️ 💆🏿‍♀️ 💇🏿 💇🏿‍♂️ 💇🏿‍♀️ 🚶🏿 🚶🏿‍♂️ 🚶🏿‍♀️ 🚶🏿‍➡️ 🚶🏿‍♀️‍➡️ 🚶🏿‍♂️‍➡️ 🧍🏿 🧍🏿‍♂️ 🧍🏿‍♀️ 🧎🏿 🧎🏿‍♂️ 🧎🏿‍♀️ 🧎🏿‍➡️ 🧎🏿‍♀️‍➡️ 🧎🏿‍♂️‍➡️ 🧑🏿‍🦯 🧑🏿‍🦯‍➡️ 👨🏿‍🦯 👨🏿‍🦯‍➡️ 👩🏿‍🦯 👩🏿‍🦯‍➡️ 🧑🏿‍🦼 🧑🏿‍🦼‍➡️ 👨🏿‍🦼 👨🏿‍🦼‍➡️ 👩🏿‍🦼 👩🏿‍🦼‍➡️ 🧑🏿‍🦽 🧑🏿‍🦽‍➡️ 👨🏿‍🦽 👨🏿‍🦽‍➡️ 👩🏿‍🦽 👩🏿‍🦽‍➡️ 🏃🏿 🏃🏿‍♂️ 🏃🏿‍♀️ 🏃🏿‍➡️ 🏃🏿‍♀️‍➡️ 🏃🏿‍♂️‍➡️ 💃🏿 🕺🏿 🕴🏿 🧖🏿 🧖🏿‍♂️ 🧖🏿‍♀️ 🧗🏿 🧗🏿‍♂️ 🧗🏿‍♀️ 🏇🏿 🏂🏿 🏌🏿 🏌🏿‍♂️ 🏌🏿‍♀️ 🏄🏿 🏄🏿‍♂️ 🏄🏿‍♀️ 🚣🏿 🚣🏿‍♂️ 🚣🏿‍♀️ 🏊🏿 🏊🏿‍♂️ 🏊🏿‍♀️ ⛹🏿 ⛹🏿‍♂️ ⛹🏿‍♀️ 🏋🏿 🏋🏿‍♂️ 🏋🏿‍♀️ 🚴🏿 🚴🏿‍♂️ 🚴🏿‍♀️ 🚵🏿 🚵🏿‍♂️ 🚵🏿‍♀️ 🤸🏿 🤸🏿‍♂️ 🤸🏿‍♀️ 🤽🏿 🤽🏿‍♂️ 🤽🏿‍♀️ 🤾🏿 🤾🏿‍♂️ 🤾🏿‍♀️ 🤹🏿 🤹🏿‍♂️ 🤹🏿‍♀️ 🧘🏿 🧘🏿‍♂️ 🧘🏿‍♀️ 🛀🏿 🛌🏿 🧑🏿‍🤝‍🧑🏿 👭🏿 👫🏿 👬🏿 💏🏿 👩🏿‍❤️‍💋‍👨🏿 👨🏿‍❤️‍💋‍👨🏿 👩🏿‍❤️‍💋‍👩🏿 💑🏿 👩🏿‍❤️‍👨🏿 👨🏿‍❤️‍👨🏿 👩🏿‍❤️‍👩🏿` },
      { id: 'emoji-tons-mistos', name: 'Tons de pele mistos (casais e apertos de mão)', text: `🫱🏻‍🫲🏼 🫱🏻‍🫲🏽 🫱🏻‍🫲🏾 🫱🏻‍🫲🏿 🫱🏼‍🫲🏻 🫱🏼‍🫲🏽 🫱🏼‍🫲🏾 🫱🏼‍🫲🏿 🫱🏽‍🫲🏻 🫱🏽‍🫲🏼 🫱🏽‍🫲🏾 🫱🏽‍🫲🏿 🫱🏾‍🫲🏻 🫱🏾‍🫲🏼 🫱🏾‍🫲🏽 🫱🏾‍🫲🏿 🫱🏿‍🫲🏻 🫱🏿‍🫲🏼 🫱🏿‍🫲🏽 🫱🏿‍🫲🏾 🧑🏻‍🤝‍🧑🏼 🧑🏻‍🤝‍🧑🏽 🧑🏻‍🤝‍🧑🏾 🧑🏻‍🤝‍🧑🏿 🧑🏼‍🤝‍🧑🏻 🧑🏼‍🤝‍🧑🏽 🧑🏼‍🤝‍🧑🏾 🧑🏼‍🤝‍🧑🏿 🧑🏽‍🤝‍🧑🏻 🧑🏽‍🤝‍🧑🏼 🧑🏽‍🤝‍🧑🏾 🧑🏽‍🤝‍🧑🏿 🧑🏾‍🤝‍🧑🏻 🧑🏾‍🤝‍🧑🏼 🧑🏾‍🤝‍🧑🏽 🧑🏾‍🤝‍🧑🏿 🧑🏿‍🤝‍🧑🏻 🧑🏿‍🤝‍🧑🏼 🧑🏿‍🤝‍🧑🏽 🧑🏿‍🤝‍🧑🏾 👩🏻‍🤝‍👩🏼 👩🏻‍🤝‍👩🏽 👩🏻‍🤝‍👩🏾 👩🏻‍🤝‍👩🏿 👩🏼‍🤝‍👩🏻 👩🏼‍🤝‍👩🏽 👩🏼‍🤝‍👩🏾 👩🏼‍🤝‍👩🏿 👩🏽‍🤝‍👩🏻 👩🏽‍🤝‍👩🏼 👩🏽‍🤝‍👩🏾 👩🏽‍🤝‍👩🏿 👩🏾‍🤝‍👩🏻 👩🏾‍🤝‍👩🏼 👩🏾‍🤝‍👩🏽 👩🏾‍🤝‍👩🏿 👩🏿‍🤝‍👩🏻 👩🏿‍🤝‍👩🏼 👩🏿‍🤝‍👩🏽 👩🏿‍🤝‍👩🏾 👩🏻‍🤝‍👨🏼 👩🏻‍🤝‍👨🏽 👩🏻‍🤝‍👨🏾 👩🏻‍🤝‍👨🏿 👩🏼‍🤝‍👨🏻 👩🏼‍🤝‍👨🏽 👩🏼‍🤝‍👨🏾 👩🏼‍🤝‍👨🏿 👩🏽‍🤝‍👨🏻 👩🏽‍🤝‍👨🏼 👩🏽‍🤝‍👨🏾 👩🏽‍🤝‍👨🏿 👩🏾‍🤝‍👨🏻 👩🏾‍🤝‍👨🏼 👩🏾‍🤝‍👨🏽 👩🏾‍🤝‍👨🏿 👩🏿‍🤝‍👨🏻 👩🏿‍🤝‍👨🏼 👩🏿‍🤝‍👨🏽 👩🏿‍🤝‍👨🏾 👨🏻‍🤝‍👨🏼 👨🏻‍🤝‍👨🏽 👨🏻‍🤝‍👨🏾 👨🏻‍🤝‍👨🏿 👨🏼‍🤝‍👨🏻 👨🏼‍🤝‍👨🏽 👨🏼‍🤝‍👨🏾 👨🏼‍🤝‍👨🏿 👨🏽‍🤝‍👨🏻 👨🏽‍🤝‍👨🏼 👨🏽‍🤝‍👨🏾 👨🏽‍🤝‍👨🏿 👨🏾‍🤝‍👨🏻 👨🏾‍🤝‍👨🏼 👨🏾‍🤝‍👨🏽 👨🏾‍🤝‍👨🏿 👨🏿‍🤝‍👨🏻 👨🏿‍🤝‍👨🏼 👨🏿‍🤝‍👨🏽 👨🏿‍🤝‍👨🏾 🧑🏻‍❤️‍💋‍🧑🏼 🧑🏻‍❤️‍💋‍🧑🏽 🧑🏻‍❤️‍💋‍🧑🏾 🧑🏻‍❤️‍💋‍🧑🏿 🧑🏼‍❤️‍💋‍🧑🏻 🧑🏼‍❤️‍💋‍🧑🏽 🧑🏼‍❤️‍💋‍🧑🏾 🧑🏼‍❤️‍💋‍🧑🏿 🧑🏽‍❤️‍💋‍🧑🏻 🧑🏽‍❤️‍💋‍🧑🏼 🧑🏽‍❤️‍💋‍🧑🏾 🧑🏽‍❤️‍💋‍🧑🏿 🧑🏾‍❤️‍💋‍🧑🏻 🧑🏾‍❤️‍💋‍🧑🏼 🧑🏾‍❤️‍💋‍🧑🏽 🧑🏾‍❤️‍💋‍🧑🏿 🧑🏿‍❤️‍💋‍🧑🏻 🧑🏿‍❤️‍💋‍🧑🏼 🧑🏿‍❤️‍💋‍🧑🏽 🧑🏿‍❤️‍💋‍🧑🏾 👩🏻‍❤️‍💋‍👨🏼 👩🏻‍❤️‍💋‍👨🏽 👩🏻‍❤️‍💋‍👨🏾 👩🏻‍❤️‍💋‍👨🏿 👩🏼‍❤️‍💋‍👨🏻 👩🏼‍❤️‍💋‍👨🏽 👩🏼‍❤️‍💋‍👨🏾 👩🏼‍❤️‍💋‍👨🏿 👩🏽‍❤️‍💋‍👨🏻 👩🏽‍❤️‍💋‍👨🏼 👩🏽‍❤️‍💋‍👨🏾 👩🏽‍❤️‍💋‍👨🏿 👩🏾‍❤️‍💋‍👨🏻 👩🏾‍❤️‍💋‍👨🏼 👩🏾‍❤️‍💋‍👨🏽 👩🏾‍❤️‍💋‍👨🏿 👩🏿‍❤️‍💋‍👨🏻 👩🏿‍❤️‍💋‍👨🏼 👩🏿‍❤️‍💋‍👨🏽 👩🏿‍❤️‍💋‍👨🏾 👨🏻‍❤️‍💋‍👨🏼 👨🏻‍❤️‍💋‍👨🏽 👨🏻‍❤️‍💋‍👨🏾 👨🏻‍❤️‍💋‍👨🏿 👨🏼‍❤️‍💋‍👨🏻 👨🏼‍❤️‍💋‍👨🏽 👨🏼‍❤️‍💋‍👨🏾 👨🏼‍❤️‍💋‍👨🏿 👨🏽‍❤️‍💋‍👨🏻 👨🏽‍❤️‍💋‍👨🏼 👨🏽‍❤️‍💋‍👨🏾 👨🏽‍❤️‍💋‍👨🏿 👨🏾‍❤️‍💋‍👨🏻 👨🏾‍❤️‍💋‍👨🏼 👨🏾‍❤️‍💋‍👨🏽 👨🏾‍❤️‍💋‍👨🏿 👨🏿‍❤️‍💋‍👨🏻 👨🏿‍❤️‍💋‍👨🏼 👨🏿‍❤️‍💋‍👨🏽 👨🏿‍❤️‍💋‍👨🏾 👩🏻‍❤️‍💋‍👩🏼 👩🏻‍❤️‍💋‍👩🏽 👩🏻‍❤️‍💋‍👩🏾 👩🏻‍❤️‍💋‍👩🏿 👩🏼‍❤️‍💋‍👩🏻 👩🏼‍❤️‍💋‍👩🏽 👩🏼‍❤️‍💋‍👩🏾 👩🏼‍❤️‍💋‍👩🏿 👩🏽‍❤️‍💋‍👩🏻 👩🏽‍❤️‍💋‍👩🏼 👩🏽‍❤️‍💋‍👩🏾 👩🏽‍❤️‍💋‍👩🏿 👩🏾‍❤️‍💋‍👩🏻 👩🏾‍❤️‍💋‍👩🏼 👩🏾‍❤️‍💋‍👩🏽 👩🏾‍❤️‍💋‍👩🏿 👩🏿‍❤️‍💋‍👩🏻 👩🏿‍❤️‍💋‍👩🏼 👩🏿‍❤️‍💋‍👩🏽 👩🏿‍❤️‍💋‍👩🏾 🧑🏻‍❤️‍🧑🏼 🧑🏻‍❤️‍🧑🏽 🧑🏻‍❤️‍🧑🏾 🧑🏻‍❤️‍🧑🏿 🧑🏼‍❤️‍🧑🏻 🧑🏼‍❤️‍🧑🏽 🧑🏼‍❤️‍🧑🏾 🧑🏼‍❤️‍🧑🏿 🧑🏽‍❤️‍🧑🏻 🧑🏽‍❤️‍🧑🏼 🧑🏽‍❤️‍🧑🏾 🧑🏽‍❤️‍🧑🏿 🧑🏾‍❤️‍🧑🏻 🧑🏾‍❤️‍🧑🏼 🧑🏾‍❤️‍🧑🏽 🧑🏾‍❤️‍🧑🏿 🧑🏿‍❤️‍🧑🏻 🧑🏿‍❤️‍🧑🏼 🧑🏿‍❤️‍🧑🏽 🧑🏿‍❤️‍🧑🏾 👩🏻‍❤️‍👨🏼 👩🏻‍❤️‍👨🏽 👩🏻‍❤️‍👨🏾 👩🏻‍❤️‍👨🏿 👩🏼‍❤️‍👨🏻 👩🏼‍❤️‍👨🏽 👩🏼‍❤️‍👨🏾 👩🏼‍❤️‍👨🏿 👩🏽‍❤️‍👨🏻 👩🏽‍❤️‍👨🏼 👩🏽‍❤️‍👨🏾 👩🏽‍❤️‍👨🏿 👩🏾‍❤️‍👨🏻 👩🏾‍❤️‍👨🏼 👩🏾‍❤️‍👨🏽 👩🏾‍❤️‍👨🏿 👩🏿‍❤️‍👨🏻 👩🏿‍❤️‍👨🏼 👩🏿‍❤️‍👨🏽 👩🏿‍❤️‍👨🏾 👨🏻‍❤️‍👨🏼 👨🏻‍❤️‍👨🏽 👨🏻‍❤️‍👨🏾 👨🏻‍❤️‍👨🏿 👨🏼‍❤️‍👨🏻 👨🏼‍❤️‍👨🏽 👨🏼‍❤️‍👨🏾 👨🏼‍❤️‍👨🏿 👨🏽‍❤️‍👨🏻 👨🏽‍❤️‍👨🏼 👨🏽‍❤️‍👨🏾 👨🏽‍❤️‍👨🏿 👨🏾‍❤️‍👨🏻 👨🏾‍❤️‍👨🏼 👨🏾‍❤️‍👨🏽 👨🏾‍❤️‍👨🏿 👨🏿‍❤️‍👨🏻 👨🏿‍❤️‍👨🏼 👨🏿‍❤️‍👨🏽 👨🏿‍❤️‍👨🏾 👩🏻‍❤️‍👩🏼 👩🏻‍❤️‍👩🏽 👩🏻‍❤️‍👩🏾 👩🏻‍❤️‍👩🏿 👩🏼‍❤️‍👩🏻 👩🏼‍❤️‍👩🏽 👩🏼‍❤️‍👩🏾 👩🏼‍❤️‍👩🏿 👩🏽‍❤️‍👩🏻 👩🏽‍❤️‍👩🏼 👩🏽‍❤️‍👩🏾 👩🏽‍❤️‍👩🏿 👩🏾‍❤️‍👩🏻 👩🏾‍❤️‍👩🏼 👩🏾‍❤️‍👩🏽 👩🏾‍❤️‍👩🏿 👩🏿‍❤️‍👩🏻 👩🏿‍❤️‍👩🏼 👩🏿‍❤️‍👩🏽 👩🏿‍❤️‍👩🏾` },
      { id: 'outros', name: 'Outros símbolos', text: `= ∞ $` }
    ];

    let favoriteSymbols = [];

    // Faixa rápida da tela principal: lista própria (separada dos favoritos), até 16 emojis.
    const QUICKBAR_MAX = 16;
    // Letras em emoji, fixas no fim da faixa para todos (não contam nos 16 e não são editáveis): A, B, O, P, M, I, AB, CL, X e O.
    // Com o seletor de emoji (U+FE0F) o A, o B, o O, o P, o M e o I aparecem coloridos em qualquer aparelho.
    const QUICKBAR_LETTERS = [
      { sym: '\u{1F170}\uFE0F', name: 'letra A' },
      { sym: '\u{1F171}\uFE0F', name: 'letra B' },
      { sym: '\u{1F17E}\uFE0F', name: 'letra O' },
      { sym: '\u{1F17F}\uFE0F', name: 'letra P' },
      { sym: '\u24C2\uFE0F', name: 'letra M' },
      { sym: '\u2139\uFE0F', name: 'letra i' },
      { sym: '\u{1F18E}', name: 'letras AB' },
      { sym: '\u{1F191}', name: 'letras CL' },
      { sym: '\u274C', name: 'letra X' },
      { sym: '\u2B55', name: 'letra O (círculo)' }
    ];
    const defaultQuickBar = ['❓', '✅', '⚠️', '👉', '💡', '📌', '🔎', '✍️', '🙏', '❤️', '👍', '😀', '⭐', '🔷', '▶️', '📖'];
    let quickBarSymbols = defaultQuickBar.slice();
    let quickBarSelected = -1;   // posição escolhida no editor (para mover ou tirar)
    let quickBarPicking = false; // modo "escolher para a faixa": tocar num caractere o põe na faixa
    let customSymbolCategories = {};

    const explicitMaps = {
      script: {
        A:'𝒜',B:'ℬ',C:'𝒞',D:'𝒟',E:'ℰ',F:'ℱ',G:'𝒢',H:'ℋ',I:'ℐ',J:'𝒥',K:'𝒦',L:'ℒ',M:'ℳ',N:'𝒩',O:'𝒪',P:'𝒫',Q:'𝒬',R:'ℛ',S:'𝒮',T:'𝒯',U:'𝒰',V:'𝒱',W:'𝒲',X:'𝒳',Y:'𝒴',Z:'𝒵',
        a:'𝒶',b:'𝒷',c:'𝒸',d:'𝒹',e:'ℯ',f:'𝒻',g:'ℊ',h:'𝒽',i:'𝒾',j:'𝒿',k:'𝓀',l:'𝓁',m:'𝓂',n:'𝓃',o:'ℴ',p:'𝓅',q:'𝓆',r:'𝓇',s:'𝓈',t:'𝓉',u:'𝓊',v:'𝓋',w:'𝓌',x:'𝓍',y:'𝓎',z:'𝓏'
      },
      boldScript: {
        A:'𝓐',B:'𝓑',C:'𝓒',D:'𝓓',E:'𝓔',F:'𝓕',G:'𝓖',H:'𝓗',I:'𝓘',J:'𝓙',K:'𝓚',L:'𝓛',M:'𝓜',N:'𝓝',O:'𝓞',P:'𝓟',Q:'𝓠',R:'𝓡',S:'𝓢',T:'𝓣',U:'𝓤',V:'𝓥',W:'𝓦',X:'𝓧',Y:'𝓨',Z:'𝓩',
        a:'𝓪',b:'𝓫',c:'𝓬',d:'𝓭',e:'𝓮',f:'𝓯',g:'𝓰',h:'𝓱',i:'𝓲',j:'𝓳',k:'𝓴',l:'𝓵',m:'𝓶',n:'𝓷',o:'𝓸',p:'𝓹',q:'𝓺',r:'𝓻',s:'𝓼',t:'𝓽',u:'𝓾',v:'𝓿',w:'𝔀',x:'𝔁',y:'𝔂',z:'𝔃'
      },
      fraktur: {
        A:'𝔄',B:'𝔅',C:'ℭ',D:'𝔇',E:'𝔈',F:'𝔉',G:'𝔊',H:'ℌ',I:'ℑ',J:'𝔍',K:'𝔎',L:'𝔏',M:'𝔐',N:'𝔑',O:'𝔒',P:'𝔓',Q:'𝔔',R:'ℜ',S:'𝔖',T:'𝔗',U:'𝔘',V:'𝔙',W:'𝔚',X:'𝔛',Y:'𝔜',Z:'ℨ',
        a:'𝔞',b:'𝔟',c:'𝔠',d:'𝔡',e:'𝔢',f:'𝔣',g:'𝔤',h:'𝔥',i:'𝔦',j:'𝔧',k:'𝔨',l:'𝔩',m:'𝔪',n:'𝔫',o:'𝔬',p:'𝔭',q:'𝔮',r:'𝔯',s:'𝔰',t:'𝔱',u:'𝔲',v:'𝔳',w:'𝔴',x:'𝔵',y:'𝔶',z:'𝔷'
      },
      doubleStruck: {
        A:'𝔸',B:'𝔹',C:'ℂ',D:'𝔻',E:'𝔼',F:'𝔽',G:'𝔾',H:'ℍ',I:'𝕀',J:'𝕁',K:'𝕂',L:'𝕃',M:'𝕄',N:'ℕ',O:'𝕆',P:'ℙ',Q:'ℚ',R:'ℝ',S:'𝕊',T:'𝕋',U:'𝕌',V:'𝕍',W:'𝕎',X:'𝕏',Y:'𝕐',Z:'ℤ',
        a:'𝕒',b:'𝕓',c:'𝕔',d:'𝕕',e:'𝕖',f:'𝕗',g:'𝕘',h:'𝕙',i:'𝕚',j:'𝕛',k:'𝕜',l:'𝕝',m:'𝕞',n:'𝕟',o:'𝕠',p:'𝕡',q:'𝕢',r:'𝕣',s:'𝕤',t:'𝕥',u:'𝕦',v:'𝕧',w:'𝕨',x:'𝕩',y:'𝕪',z:'𝕫',
        0:'𝟘',1:'𝟙',2:'𝟚',3:'𝟛',4:'𝟜',5:'𝟝',6:'𝟞',7:'𝟟',8:'𝟠',9:'𝟡'
      },
      circled: {
        A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ',
        a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',
        0:'⓪',1:'①',2:'②',3:'③',4:'④',5:'⑤',6:'⑥',7:'⑦',8:'⑧',9:'⑨'
      },
      blackCircled: {
        0:'⓿',1:'❶',2:'❷',3:'❸',4:'❹',5:'❺',6:'❻',7:'❼',8:'❽',9:'❾'
      },
      negativeCircled: {
        A:'🅐',B:'🅑',C:'🅒',D:'🅓',E:'🅔',F:'🅕',G:'🅖',H:'🅗',I:'🅘',J:'🅙',K:'🅚',L:'🅛',M:'🅜',N:'🅝',O:'🅞',P:'🅟',Q:'🅠',R:'🅡',S:'🅢',T:'🅣',U:'🅤',V:'🅥',W:'🅦',X:'🅧',Y:'🅨',Z:'🅩'
      },
      squaredDark: {
        A:'🅰',B:'🅱',C:'🅲',D:'🅳',E:'🅴',F:'🅵',G:'🅶',H:'🅷',I:'🅸',J:'🅹',K:'🅺',L:'🅻',M:'🅼',N:'🅽',O:'🅾',P:'🅿',Q:'🆀',R:'🆁',S:'🆂',T:'🆃',U:'🆄',V:'🆅',W:'🆆',X:'🆇',Y:'🆈',Z:'🆉'
      },
      squaredLight: {
        A:'🄰',B:'🄱',C:'🄲',D:'🄳',E:'🄴',F:'🄵',G:'🄶',H:'🄷',I:'🄸',J:'🄹',K:'🄺',L:'🄻',M:'🄼',N:'🄽',O:'🄾',P:'🄿',Q:'🅀',R:'🅁',S:'🅂',T:'🅃',U:'🅄',V:'🅅',W:'🅆',X:'🅇',Y:'🅈',Z:'🅉'
      },
      fullwidth: {
        A:'Ａ',B:'Ｂ',C:'Ｃ',D:'Ｄ',E:'Ｅ',F:'Ｆ',G:'Ｇ',H:'Ｈ',I:'Ｉ',J:'Ｊ',K:'Ｋ',L:'Ｌ',M:'Ｍ',N:'Ｎ',O:'Ｏ',P:'Ｐ',Q:'Ｑ',R:'Ｒ',S:'Ｓ',T:'Ｔ',U:'Ｕ',V:'Ｖ',W:'Ｗ',X:'Ｘ',Y:'Ｙ',Z:'Ｚ',
        a:'ａ',b:'ｂ',c:'ｃ',d:'ｄ',e:'ｅ',f:'ｆ',g:'ｇ',h:'ｈ',i:'ｉ',j:'ｊ',k:'ｋ',l:'ｌ',m:'ｍ',n:'ｎ',o:'ｏ',p:'ｐ',q:'ｑ',r:'ｒ',s:'ｓ',t:'ｔ',u:'ｕ',v:'ｖ',w:'ｗ',x:'ｘ',y:'ｙ',z:'ｚ',
        0:'０',1:'１',2:'２',3:'３',4:'４',5:'５',6:'６',7:'７',8:'８',9:'９'
      }
    };

    const styles = [
      { id:'serif', name:'Serif matemático', selectLabel:'Serif matemático — normal, negrito, itálico, N+I', variants:{ bold:'bold', italic:'italic', boldItalic:'boldItalic' } },
      { id:'bold', name:'Serif matemático negrito', hidden:true, upper:0x1D400, lower:0x1D41A, digit:0x1D7CE },
      { id:'italic', name:'Serif matemático itálico', hidden:true, upper:0x1D434, lower:0x1D44E },
      { id:'boldItalic', name:'Serif matemático negrito itálico', hidden:true, upper:0x1D468, lower:0x1D482 },
      { id:'script', name:'Script', selectLabel:'Script — normal, negrito', explicit:'script', variants:{ bold:'boldScript' } },
      { id:'boldScript', name:'Script negrito', hidden:true, explicit:'boldScript' },
      { id:'fraktur', name:'Fraktur/gótico', selectLabel:'Fraktur/gótico — normal, negrito', explicit:'fraktur', variants:{ bold:'boldFraktur' } },
      { id:'boldFraktur', name:'Fraktur/gótico negrito', hidden:true, upper:0x1D56C, lower:0x1D586 },
      { id:'doubleStruck', name:'Letra dupla', selectLabel:'Letra dupla — normal', explicit:'doubleStruck' },
      { id:'sans', name:'Sem serifa', selectLabel:'Sem serifa — normal, negrito, itálico, N+I', upper:0x1D5A0, lower:0x1D5BA, digit:0x1D7E2, variants:{ bold:'sansBold', italic:'sansItalic', boldItalic:'sansBoldItalic' } },
      { id:'sansBold', name:'Sem serifa negrito', hidden:true, upper:0x1D5D4, lower:0x1D5EE, digit:0x1D7EC },
      { id:'sansItalic', name:'Sem serifa itálico', hidden:true, upper:0x1D608, lower:0x1D622 },
      { id:'sansBoldItalic', name:'Sem serifa negrito itálico', hidden:true, upper:0x1D63C, lower:0x1D656 },
      { id:'mono', name:'Monoespaçado', selectLabel:'Monoespaçado — normal', upper:0x1D670, lower:0x1D68A, digit:0x1D7F6 },
      { id:'circled', name:'Letras circuladas', selectLabel:'Letras circuladas — normal', explicit:'circled' },
      { id:'negativeCircled', name:'Circuladas negativas', selectLabel:'Circuladas negativas — normal', explicit:'negativeCircled', uppercaseOnly:true },
      { id:'squaredDark', name:'Letras em caixa escura', selectLabel:'Letras em caixa escura — normal', explicit:'squaredDark', uppercaseOnly:true },
      { id:'squaredLight', name:'Letras em caixa clara', selectLabel:'Letras em caixa clara — normal', explicit:'squaredLight', uppercaseOnly:true },
      { id:'fullwidth', name:'Largura cheia', selectLabel:'Largura cheia — normal', explicit:'fullwidth' },
      { id:'blackCircledNumbers', name:'Números pretos', selectLabel:'Números pretos — normal', explicit:'blackCircled' }
    ];

    const sampleByStyle = {
      serif: 'Texto de exemplo 123',
      script: 'Texto de exemplo',
      fraktur: 'Texto de exemplo',
      doubleStruck: 'Texto de exemplo 123',
      sans: 'Texto de exemplo 123',
      mono: 'Texto de exemplo 123',
      circled: 'Texto de exemplo 123',
      negativeCircled: 'TEXTO',
      squaredDark: 'TEXTO',
      squaredLight: 'TEXTO',
      fullwidth: 'Texto de exemplo 123',
      blackCircledNumbers: '123'
    };

    const defaultTemplates = [
      { id:'tpl-question', name:'Pergunta', category: DEFAULT_TEMPLATE_CATEGORY, content:'❓❓❓ 𝐏𝐄𝐑𝐆𝐔𝐍𝐓𝐀 👉 ' },
      { id:'tpl-application', name:'Aplicação', category: DEFAULT_TEMPLATE_CATEGORY, content:'✅ 𝐀𝐩𝐥𝐢𝐜𝐚𝐜𝐚𝐨 👉 ' },
      { id:'tpl-custom-1780941059938-361', name:'01 - DESTAQUE', category: DEFAULT_TEMPLATE_CATEGORY, content:'⚠️⚠️  ⫸⫸⫸⫸ {texto} ⫷⫷⫷⫷' },
      { id:'tpl-custom-1781710759920-855', name:'01 - Importante', category: DEFAULT_TEMPLATE_CATEGORY, content:'🟨🟧🟩🟥𝐈𝐌𝐏𝐎𝐑𝐓𝐀𝐍𝐓𝐄👉👉👉' },
      { id:'tpl-custom-1781832234238-889', name:'Importante 01', category: DEFAULT_TEMPLATE_CATEGORY, content:'⚡💡🔎 𝑰𝑴𝑷𝑶𝑹𝑻𝑨𝑵𝑻𝑬 ➽  ' },
      { id:'tpl-custom-1788466872809-63', name:'Resposta', category: DEFAULT_TEMPLATE_CATEGORY, content:'❓❓❓ RESPOSTA 👉' }
    ];

    let templates = [];
    let templateCategories = [DEFAULT_TEMPLATE_CATEGORY];


    let lastFocusedTextField = input;

    function rememberFocusedField(event) {
      const el = event.target;
      if (el === input || el === templateContent || el === customSymbolsText || el === newTemplateCategoryName || el === categoryRenameName) {
        lastFocusedTextField = el;
      }
    }

    function getActiveInsertTarget() {
      const active = document.activeElement;
      if (active === templateContent || active === input) return active;
      return lastFocusedTextField || input;
    }

    // Escreve num campo de texto preservando o histórico de "desfazer" do navegador.
    // Atribuir direto a .value apaga a pilha do Ctrl+Z; execCommand('insertText') a mantém.
    // O cursor NUNCA vai para o campo por causa desta função: no celular isso abriria o teclado sem o usuário querer (a resposta da IA, o
    // texto apagado ou uma pesquisa salva aberta chegam ao campo sem tirar o usuário de onde ele está). Só quando o cursor já está no campo
    // (o usuário está digitando ou usando os botões de formatação com o cursor ali) o texto entra por execCommand, que mantém o desfazer do navegador;
    // fora dele entra por setRangeText (o desfazer do app, botão ↩️, continua valendo).
    function writeToField(field, start, end, text, selectStart, selectEnd) {
      const scrollTop = field.scrollTop;
      const scrollLeft = field.scrollLeft;
      const expected = field.value.slice(0, start) + text + field.value.slice(end);
      let wrote = false;

      if (document.activeElement === field) {
        field.setSelectionRange(start, end);

        if (text || start !== end) {
          try {
            wrote = text
              ? document.execCommand('insertText', false, text)
              : document.execCommand('delete');
          } catch (e) {
            wrote = false;
          }
        }
      } else if (text || start !== end) {
        field.setRangeText(text, start, end, 'end');
        field.dispatchEvent(new Event('input', { bubbles: true })); // o que depende de "input" (altura do campo…) também acompanha
        wrote = true;
      }

      if (field.value !== expected) field.value = expected;

      const finalEnd = typeof selectEnd === 'number' ? selectEnd : start + text.length;
      const finalStart = typeof selectStart === 'number' ? selectStart : finalEnd;

      field.setSelectionRange(finalStart, finalEnd);
      field.scrollTop = scrollTop;
      field.scrollLeft = scrollLeft;

      return { start: finalStart, end: finalEnd };
    }

    // ---------- Desfazer ----------
    // Cada alteração feita pelo app (formatar, inserir, limpar, aplicar a IA...) guarda o texto de antes; digitar guarda
    // um ponto a cada pausa. "Desfazer" volta um passo. As sugestões da IA contam como um passo só.
    const undoStack = [];
    const UNDO_LIMIT = 40;
    const undoButtons = [document.getElementById('undoBtn'), document.getElementById('undoTopBtn')];
    let undoSuspended = false; // dentro de um lote só o primeiro passo é guardado
    let undoWriting = false;   // o app está escrevendo no campo (o evento "input" não é digitação)
    let undoTypingAt = 0;

    function updateUndoButtons() {
      undoButtons.forEach(btn => { btn.disabled = !undoStack.length; });
    }

    function pushUndo(value) {
      if (undoStack.length && undoStack[undoStack.length - 1] === value) return;
      undoStack.push(value);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      updateUndoButtons();
    }

    function runUndoBatch(fn) {
      pushUndo(input.value);
      undoSuspended = true;
      try { return fn(); } finally { undoSuspended = false; }
    }

    function undoLastChange() {
      while (undoStack.length && undoStack[undoStack.length - 1] === input.value) undoStack.pop();
      updateUndoButtons();
      if (!undoStack.length) {
        selectionInfo.textContent = 'Não há nada para desfazer.';
        return;
      }
      const previous = undoStack.pop();
      undoSuspended = true;
      try { setInputRange(0, input.value.length, previous, { message: '↩️ Alteração desfeita.' }); } finally { undoSuspended = false; }
      autoGrowInputText();
      updateUndoButtons();
    }

    // Troca um trecho do texto original e mantém a interface em dia.
    // options.select = true mantém o resultado selecionado (para encadear formatações).
    function setInputRange(start, end, text, options) {
      const opts = options || {};
      const newEnd = start + text.length;
      if (!undoSuspended) pushUndo(input.value);
      undoWriting = true;
      let range;
      try { range = writeToField(input, start, end, text, opts.select ? start : newEnd, newEnd); } finally { undoWriting = false; }

      lastInputSelection = { start: range.start, end: range.end };
      lastFocusedTextField = input;
      updateUi();

      if (opts.message) {
        selectionInfo.textContent = opts.message;
        try { reunioesAvisarCampo(opts.message); } catch (e) { /* ainda iniciando */ }
      }
      return range;
    }

    function insertTextAtCursor(target, text) {
      if (!target) target = input;

      const start = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
      const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : target.value.length;

      if (target === input) {
        setInputRange(start, end, text);
        return;
      }

      writeToField(target, start, end, text);

      if (target === templateContent) templateStatus.textContent = '';
    }

    function newId() {
      return 'tpl-custom-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    function normalizeForMap(ch) {
      const accents = {
        'Á':'A','À':'A','Â':'A','Ã':'A','Ä':'A','É':'E','Ê':'E','È':'E','Í':'I','Ì':'I','Î':'I','Ó':'O','Ô':'O','Õ':'O','Ò':'O','Ú':'U','Ù':'U','Û':'U','Ç':'C',
        'á':'a','à':'a','â':'a','ã':'a','ä':'a','é':'e','ê':'e','è':'e','í':'i','ì':'i','î':'i','ó':'o','ô':'o','õ':'o','ò':'o','ú':'u','ù':'u','û':'u','ç':'c'
      };
      return accents[ch] || ch;
    }

    function toTitleCase(text) {
      return String(text).split(/(\s+)/).map(word => {
        // Siglas já escritas em maiúsculas ficam como estão: "JW" não vira "Jw".
        const letters = word.replace(/\P{L}/gu, '');
        if (letters.length > 1 && letters === letters.toLocaleUpperCase('pt-BR')) return word;
        return word
          .toLocaleLowerCase('pt-BR')
          .replace(/(^|[\-–—/([{“"'])\p{L}/gu, match => match.toLocaleUpperCase('pt-BR'));
      }).join('');
    }

    function applyCase(text, mode = 'normal') {
      if (mode === 'upper') return text.toLocaleUpperCase('pt-BR');
      if (mode === 'lower') return text.toLocaleLowerCase('pt-BR');
      if (mode === 'title') return toTitleCase(text);
      return text;
    }

    function applyCaseToSelection(mode = 'normal', showMessage = true) {
      const { start, end, selected } = getSelectionRange();
      if (start === end || !selected) {
        if (showMessage) selectionInfo.textContent = 'Selecione um trecho no texto original e clique em uma opção de maiúsculas/minúsculas.';
        return false;
      }

      const converted = applyCasePreservingUnicodeStyle(selected, mode);

      return replaceSelectionWith(
        converted,
        showMessage ? 'Opção aplicada ao texto selecionado. A seleção foi mantida.' : ''
      );
    }

    const listNumberSets = {
      circled: ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'],
      blackCircle: ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿','⓫','⓬','⓭','⓮','⓯','⓰','⓱','⓲','⓳','⓴'],
      keycap: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','1️⃣1️⃣','1️⃣2️⃣','1️⃣3️⃣','1️⃣4️⃣','1️⃣5️⃣','1️⃣6️⃣','1️⃣7️⃣','1️⃣8️⃣','1️⃣9️⃣','2️⃣0️⃣'],
      squareAlternate: ['🟦','🟧','🟩','🟪','🟥','🟨'],
      circleAlternate: ['🔵','🟣','🟢','🟠','🔴','🟡']
    };

    function getListPrefix(model, index) {
      const n = index + 1;
      if (model === 'blueDiamond') return '🔷 ';
      if (model === 'orangeDiamond') return '🔶 ';
      if (model === 'smallBlueDiamond') return '🔹 ';
      if (model === 'smallOrangeDiamond') return '🔸 ';
      if (model === 'diamondDot') return '💠 ';
      if (model === 'gemDiamond') return '💎 ';
      if (model === 'bullet') return '• ';
      if (model === 'arrow') return '➤ ';
      if (model === 'check') return '✅ ';
      if (model === 'simpleCheck') return '✔ ';
      if (model === 'numberDot') return n + '. ';
      if (model === 'numberParen') return n + ') ';
      if (model === 'circled') return (listNumberSets.circled[index] || n + '.') + ' ';
      if (model === 'blackCircle') return (listNumberSets.blackCircle[index] || n + '.') + ' ';
      if (model === 'keycapNumber') return (listNumberSets.keycap[index] || n + '️⃣') + ' ';
      if (model === 'squareBlue') return '🟦 ';
      if (model === 'squareAlternate') return listNumberSets.squareAlternate[index % listNumberSets.squareAlternate.length] + ' ';
      if (model === 'circleBlue') return '🔵 ';
      if (model === 'circleAlternate') return listNumberSets.circleAlternate[index % listNumberSets.circleAlternate.length] + ' ';
      return '• ';
    }

    // Marcadores que o próprio app insere. Servem para trocar de lista sem empilhar
    // prefixos: aplicar "1." duas vezes deve continuar dando "1. texto", não "1. 1. texto".
    const listSymbolPrefixes = [
      '🔷', '🔶', '🔹', '🔸', '💠', '💎', '•', '➤', '✅', '✔', '🟦', '🔵',
      ...listNumberSets.squareAlternate,
      ...listNumberSets.circleAlternate,
      ...listNumberSets.circled,
      ...listNumberSets.blackCircle,
      ...listNumberSets.keycap
    ];

    const listPrefixPattern = new RegExp(
      '^(?:' +
        listSymbolPrefixes
          .slice()
          .sort((a, b) => b.length - a.length)
          .map(escapeRegExp)
          .join('|') +
        '|\\d+[.)]' +
      ')[ \\t]*'
    );

    function stripListPrefix(content) {
      let cleaned = content;
      let previous;

      do {
        previous = cleaned;
        cleaned = cleaned.replace(listPrefixPattern, '');
      } while (cleaned !== previous);

      return cleaned;
    }

    function applyListToSelection(model) {
      const { start, end, selected } = getSelectionRange();

      if (start === end || !selected.trim()) {
        const symbol = getListPrefix(model, 0).trim();
        setInputRange(start, end, symbol, { message: 'Símbolo inserido no ponto do cursor.' });
        return true;
      }

      let itemIndex = 0;
      const lines = selected.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const formatted = lines.map(line => {
        if (!line.trim()) return line;
        const leading = line.match(/^\s*/)[0];
        const content = stripListPrefix(line.slice(leading.length));
        const prefix = getListPrefix(model, itemIndex++);
        return leading + prefix + content;
      }).join('\n');

      setInputRange(start, end, formatted, {
        select: true,
        message: itemIndex + ' item(ns) formatado(s) como lista.'
      });
      return true;
    }

    const specialMathChars = {
      italic: {
        h: 'ℎ'
      }
    };

    const LETRA_DUPLA_FORA_DO_BLOCO = new Set(['ℂ', 'ℍ', 'ℕ', 'ℙ', 'ℚ', 'ℝ', 'ℤ']);

    function convertChar(ch, style) {
      if (style.id === 'normal') return ch;

      let base = normalizeForMap(ch);
      if (style.uppercaseOnly) base = base.toUpperCase();

      if (style.explicit) {
        const map = explicitMaps[style.explicit] || {};
        const fancy = map[base] || ch;
        // Letra dupla: as sete maiúsculas C H N P Q R Z não existem no bloco matemático (vêm dos Símbolos de letras, ℂ ℍ ℕ ℙ ℚ ℝ ℤ) e em alguns
        // aparelhos (iPhone) saem como um quadrado listrado, estragando a inicial da frase. Nelas fica a letra comum (o resto da frase segue em
        // letra dupla). As ℂ ℍ… já escritas continuam sendo reconhecidas ao remover a formatação (os mapas de volta não mudam).
        if (style.explicit === 'doubleStruck' && LETRA_DUPLA_FORA_DO_BLOCO.has(fancy)) return base;
        return fancy;
      }

      const special = specialMathChars[style.id] || {};
      if (special[base]) return special[base];

      const code = base.codePointAt(0);
      if (code >= 65 && code <= 90 && style.upper) return String.fromCodePoint(style.upper + code - 65);
      if (code >= 97 && code <= 122 && style.lower) return String.fromCodePoint(style.lower + code - 97);
      if (code >= 48 && code <= 57 && style.digit) return String.fromCodePoint(style.digit + code - 48);
      return ch;
    }


    let reverseUnicodeMap = null;

    function buildReverseUnicodeMap() {
      const map = new Map();

      styles.forEach(style => {
        if (style.id === 'normal') return;

        if (style.explicit) {
          const explicit = explicitMaps[style.explicit] || {};
          Object.entries(explicit).forEach(([plain, fancy]) => map.set(fancy, plain));
        }

        if (style.upper) {
          for (let i = 0; i < 26; i++) map.set(String.fromCodePoint(style.upper + i), String.fromCharCode(65 + i));
        }
        if (style.lower) {
          for (let i = 0; i < 26; i++) map.set(String.fromCodePoint(style.lower + i), String.fromCharCode(97 + i));
        }
        if (style.digit) {
          for (let i = 0; i < 10; i++) map.set(String.fromCodePoint(style.digit + i), String.fromCharCode(48 + i));
        }

        const special = specialMathChars[style.id] || {};
        Object.entries(special).forEach(([plain, fancy]) => map.set(fancy, plain));
      });

      // Variações comuns que aparecem em alguns aparelhos/sistemas.
      '⓵⓶⓷⓸⓹⓺⓻⓼⓽⓾'.split('').forEach((ch, i) => map.set(ch, String(i + 1)));
      '➀➁➂➃➄➅➆➇➈➉'.split('').forEach((ch, i) => map.set(ch, String(i + 1)));
      '➊➋➌➍➎➏➐➑➒➓'.split('').forEach((ch, i) => map.set(ch, String(i + 1)));

      return map;
    }

    function removeUnicodeFormatting(text) {
      if (!reverseUnicodeMap) reverseUnicodeMap = buildReverseUnicodeMap();
      return [...text].map(ch => reverseUnicodeMap.get(ch) || ch).join('');
    }

    let reverseUnicodeStyleMap = null;

    function buildReverseUnicodeStyleMap() {
      const map = new Map();

      styles.forEach(style => {
        if (style.id === 'normal') return;

        if (style.explicit) {
          const explicit = explicitMaps[style.explicit] || {};
          Object.values(explicit).forEach(fancy => map.set(fancy, style.id));
        }

        if (style.upper) {
          for (let i = 0; i < 26; i++) map.set(String.fromCodePoint(style.upper + i), style.id);
        }
        if (style.lower) {
          for (let i = 0; i < 26; i++) map.set(String.fromCodePoint(style.lower + i), style.id);
        }
        if (style.digit) {
          for (let i = 0; i < 10; i++) map.set(String.fromCodePoint(style.digit + i), style.id);
        }

        const special = specialMathChars[style.id] || {};
        Object.values(special).forEach(fancy => map.set(fancy, style.id));
      });

      return map;
    }

    function detectDominantUnicodeStyleId(text) {
      if (!reverseUnicodeStyleMap) reverseUnicodeStyleMap = buildReverseUnicodeStyleMap();

      const counts = new Map();
      for (const ch of String(text || '')) {
        const styleId = reverseUnicodeStyleMap.get(ch);
        if (!styleId) continue;
        counts.set(styleId, (counts.get(styleId) || 0) + 1);
      }

      let bestStyleId = 'normal';
      let bestCount = 0;
      counts.forEach((count, styleId) => {
        if (count > bestCount) {
          bestCount = count;
          bestStyleId = styleId;
        }
      });

      return bestStyleId;
    }

    function applyCasePreservingUnicodeStyle(text, mode) {
      const styleId = detectDominantUnicodeStyleId(text);
      const plain = removeUnicodeFormatting(text);
      const cased = applyCase(plain, mode);

      if (styleId === 'normal') return cased;

      const style = styles.find(s => s.id === styleId) || styles[0];
      return [...cased].map(ch => convertChar(ch, style)).join('');
    }

    function getSelectedStyleId() {
      return styleSelect.value || 'normal';
    }

    function getStyleById(id) {
      return styles.find(s => s.id === id) || styles[0];
    }

    function getSelectedFont() {
      return getStyleById(getSelectedStyleId());
    }

    function getFontOptionParts(style) {
      const variants = style && style.variants ? style.variants : {};
      const parts = ['normal'];
      if (variants.bold) parts.push('negrito');
      if (variants.italic) parts.push('itálico');
      if (variants.boldItalic) parts.push('negrito itálico');
      return parts;
    }

    function describeFontOptions(style) {
      return 'Opções disponíveis: ' + getFontOptionParts(style).join(', ') + '.';
    }

    const fontSelectNames = {
      serif: 'Serif matemático',
      script: 'Script',
      fraktur: 'Fraktur',
      doubleStruck: 'Double Struck',
      sans: 'Sem serifa',
      mono: 'Monoespaçado',
      circled: 'Letras circuladas',
      negativeCircled: 'CIRCULADAS NEGATIVAS',
      squaredDark: 'CAIXA ESCURA',
      squaredLight: 'CAIXA CLARA',
      fullwidth: 'Largura cheia',
      blackCircledNumbers: 'Números pretos'
    };

    function makeStyleSelectLabel(style) {
      const baseName = fontSelectNames[style.id] || style.name || style.id;
      const styledName = [...baseName].map(ch => convertChar(ch, style)).join('');
      return styledName + ' — ' + getFontOptionParts(style).join(', ');
    }

    // Negrito, itálico e N+I usam a variação da fonte escolhida em "Tipos de fontes/caracteres"; se ela não tiver essa
    // variação (ex.: Letra dupla, Circuladas), usam o Serif matemático. Assim os três botões funcionam sempre.
    function resolveQuickStyleId(kind) {
      const style = getSelectedFont();
      const variants = style && style.variants ? style.variants : {};
      if (variants[kind]) return variants[kind];
      const serif = getStyleById('serif');
      return (serif.variants && serif.variants[kind]) || '';
    }

    function updateQuickButtonsAvailability() {
      const style = getSelectedFont();
      const variants = style && style.variants ? style.variants : {};
      const buttons = {
        bold: document.getElementById('quickBoldBtn'),
        italic: document.getElementById('quickItalicBtn'),
        boldItalic: document.getElementById('quickBoldItalicBtn')
      };

      Object.entries(buttons).forEach(([kind, btn]) => {
        if (!btn) return;
        const nome = kind === 'bold' ? 'negrito' : kind === 'italic' ? 'itálico' : 'negrito itálico';
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
        btn.title = variants[kind]
          ? 'Aplicar ' + nome + ' nesta fonte'
          : 'Aplicar ' + nome + ' (a fonte escolhida não tem essa variação: usa o Serif matemático)';
      });

      if (styleOptionInfo) {
        styleOptionInfo.textContent = describeFontOptions(style);
      }
    }

    // Troca só o alfabeto do texto: desestiliza as letras Unicode e reestiliza na fonte
    // escolhida. Não mexe em emojis nem em marcadores de modelo — apagá-los é tarefa
    // exclusiva do botão "Remover" (removeFormattingFromSelection).
    function convertTextWithStyle(text, styleId) {
      const style = styles.find(s => s.id === styleId) || styles[0];
      const plainText = removeUnicodeFormatting(text);
      return [...plainText].map(ch => convertChar(ch, style)).join('');
    }

    function replaceSelectionWith(replacement, message = '') {
      const { start, end, selected } = getSelectionRange();

      if (start === end || !selected) {
        selectionInfo.textContent = 'Selecione um trecho para aplicar essa formatação.';
        return false;
      }

      setInputRange(start, end, replacement, { select: true, message });
      return true;
    }

    function applySelectedStyleToSelection(showMessage = true) {
      const { start, end, selected } = getSelectionRange();
      if (start === end || !selected) {
        updateUi();
        return false;
      }

      const converted = convertTextWithStyle(selected, getSelectedStyleId());
      return replaceSelectionWith(converted, showMessage ? 'Tipo de caractere aplicado ao trecho selecionado.' : '');
    }

    function escapeRegExp(text) {
      return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function stripTemplateDecoration(line) {
      let cleaned = line;

      templates.forEach(tpl => {
        const content = tpl.content || '';
        if (!content) return;

        if (content.includes('{texto}')) {
          const parts = content.split('{texto}');
          const prefix = parts[0] || '';
          const suffix = parts.slice(1).join('{texto}') || '';

          if (prefix && cleaned.startsWith(prefix)) cleaned = cleaned.slice(prefix.length);
          if (suffix && cleaned.endsWith(suffix)) cleaned = cleaned.slice(0, -suffix.length);
        } else if (cleaned.startsWith(content)) {
          cleaned = cleaned.slice(content.length);
        }
      });

      return cleaned;
    }

    function removeLineDecoration(line) {
      let cleaned = removeUnicodeFormatting(line);

      cleaned = stripTemplateDecoration(cleaned);

      const rules = [
        [/^❓\s*(.*?)\s*👉$/u, '$1'],
        [/^▶️▶️\s*(.*?)\s*⏩⏩$/u, '$1'],
        [/^⚠️\s*(.*?)\s*👉$/u, '$1'],
        [/^➤\s*(.*?)$/u, '$1'],
        [/^✅\s*(.*?)$/u, '$1'],
        [/^★\s*(.*?)\s*★$/u, '$1'],
        [/^❝\s*(.*?)\s*❞$/u, '$1'],
        [/^▇▇▇\s*(.*?)\s*▇▇▇$/u, '$1'],
        [/^🟦 NOVO TÓPICO ➜\s*(.*?)$/u, '$1']
      ];

      rules.forEach(([regex, replacement]) => {
        cleaned = cleaned.replace(regex, replacement);
      });

      return cleaned;
    }

    function removeFormattingFromText(text) {
      return String(text || '').split('\n').map(removeLineDecoration).join('\n');
    }

    function updatePreview() {
      const style = getStyleById(styleSelect.value);
      const sample = sampleByStyle[style.id] || 'Texto de exemplo 123';
      const variants = style && style.variants ? style.variants : {};
      const previewLines = [];

      const normalText = [...sample].map(ch => convertChar(ch, style)).join('');
      previewLines.push('Normal: ' + normalText);

      if (variants.bold) {
        const boldStyle = getStyleById(variants.bold);
        previewLines.push('Negrito: ' + [...sample].map(ch => convertChar(ch, boldStyle)).join(''));
      }

      if (variants.italic) {
        const italicStyle = getStyleById(variants.italic);
        previewLines.push('Itálico: ' + [...sample].map(ch => convertChar(ch, italicStyle)).join(''));
      }

      if (variants.boldItalic) {
        const boldItalicStyle = getStyleById(variants.boldItalic);
        previewLines.push('N+I: ' + [...sample].map(ch => convertChar(ch, boldItalicStyle)).join(''));
      }

      preview.textContent = previewLines.join('\n');
      updateQuickButtonsAvailability();
    }

    let lastInputSelection = { start: 0, end: 0 };

    function rememberInputSelection() {
      if (typeof input.selectionStart !== 'number' || typeof input.selectionEnd !== 'number') return;
      lastInputSelection = {
        start: input.selectionStart || 0,
        end: input.selectionEnd || 0
      };
    }

    function getSelectionRange() {
      let start = input.selectionStart || 0;
      let end = input.selectionEnd || 0;

      if (start !== end) {
        lastInputSelection = { start, end };
        return { start, end, selected: input.value.slice(start, end) };
      }

      if (
        lastFocusedTextField === input &&
        lastInputSelection &&
        lastInputSelection.end > lastInputSelection.start &&
        lastInputSelection.end <= input.value.length
      ) {
        start = lastInputSelection.start;
        end = lastInputSelection.end;
      }

      return { start, end, selected: input.value.slice(start, end) };
    }

    function updateSelectionInfo() {
      const { start, end, selected } = getSelectionRange();

      if (start !== end && selected) {
        selectionInfo.textContent = 'Trecho selecionado: ' + selected.length + ' caractere(s). Clique numa opção para aplicar e salvar automaticamente.';
      } else {
        selectionInfo.textContent = 'Selecione um trecho para aplicar formatação. Modelos prontos podem ser inseridos no ponto do cursor.';
      }
    }

    let uiRefreshHandle = 0;

    function updateUi() {
      copyStatus.textContent = '';
      updateSelectionInfo();
      updatePreview();
      scheduleAnswerButtons();
      atualizarBotoesSalvar();
    }

    // Digitar dispara input/keyup/mouseup em sequência; agrupa tudo num quadro só
    // para não remontar o preview a cada tecla em notas longas.
    function scheduleUiRefresh() {
      if (uiRefreshHandle) return;
      uiRefreshHandle = requestAnimationFrame(() => {
        uiRefreshHandle = 0;
        updateUi();
      });
    }



    function removeIndentFromLine(line, indent) {
      if (line.startsWith(indent)) return line.slice(indent.length);
      if (line.startsWith('\t')) return line.slice(1);
      if (line.startsWith('    ')) return line.slice(4);
      if (line.startsWith('  ')) return line.slice(2);
      if (line.startsWith(' ')) return line.slice(1);
      return line;
    }

    function applyIndentToSelection(direction = 1) {
      const indent = '    ';
      const start = typeof input.selectionStart === 'number' ? input.selectionStart : 0;
      const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;

      // Sem seleção e aumentando: apenas insere o recuo onde o cursor está.
      if (start === end && direction > 0) {
        setInputRange(start, end, indent, { message: 'Recuo inserido no ponto do cursor.' });
        return true;
      }

      // Recua o bloco inteiro de linhas tocado pela seleção, como faz qualquer editor.
      // O recuo é só um prefixo na linha: Shift+Tab desfaz exatamente o que Tab fez.
      const lineStart = input.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      let lineEnd = input.value.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = input.value.length;

      const block = input.value.slice(lineStart, lineEnd);
      const changedBlock = block.split('\n').map(line => {
        if (direction < 0) return removeIndentFromLine(line, indent);
        return line.trim() ? indent + line : line;
      }).join('\n');

      if (changedBlock === block) {
        selectionInfo.textContent = 'Não há recuo para remover aqui.';
        return true;
      }

      const hadSelection = start !== end;

      setInputRange(lineStart, lineEnd, changedBlock, {
        select: hadSelection,
        message: direction < 0
          ? 'Recuo removido. A seleção foi mantida.'
          : 'Recuo aumentado. Repita para mais níveis; Shift+Tab reduz.'
      });

      if (!hadSelection) {
        // Mantém o cursor onde estava, deslocado pelo que entrou ou saiu da linha.
        const delta = changedBlock.length - block.length;
        const pos = Math.max(lineStart, start + delta);
        input.setSelectionRange(pos, pos);
        lastInputSelection = { start: pos, end: pos };
      }

      return true;
    }

    function removeFormattingFromSelection() {
      const { start, end, selected } = getSelectionRange();

      if (start === end || !selected) {
        selectionInfo.textContent = 'Selecione primeiro o trecho que deseja limpar.';
        return;
      }

      setInputRange(start, end, removeFormattingFromText(selected), {
        select: true,
        message: 'Formatação removida do trecho selecionado. A seleção foi mantida.'
      });
    }

    function quickFormat(kind) {
      const { start, end, selected } = getSelectionRange();

      if (start === end || !selected) {
        selectionInfo.textContent = 'Selecione primeiro um trecho do texto original.';
        return;
      }

      const styleId = resolveQuickStyleId(kind);
      if (!styleId) {
        selectionInfo.textContent = 'A fonte escolhida não tem essa opção. Escolha uma fonte com negrito, itálico ou N+I.';
        return;
      }

      const converted = convertTextWithStyle(selected, styleId);

      replaceSelectionWith(converted, 'Formatação aplicada ao trecho selecionado. A seleção foi mantida para nova formatação.');
    }

    // Botões da terceira fileira: aplicam direto uma fonte (Double Struck, Script, Caixa escura) ao trecho selecionado,
    // sem precisar escolher em "Tipos de fontes/caracteres".
    function quickFont(styleId, fontName) {
      const { start, end, selected } = getSelectionRange();
      if (start === end || !selected) {
        selectionInfo.textContent = 'Selecione primeiro um trecho do texto original.';
        return;
      }
      replaceSelectionWith(convertTextWithStyle(selected, styleId), 'Fonte ' + fontName + ' aplicada ao trecho selecionado. A seleção foi mantida para nova formatação.');
    }

    function cleanTemplateCategoryName(name) {
      const value = String(name || '').trim();
      if (value === LEGACY_DEFAULT_TEMPLATE_CATEGORY) return DESTAQUES_CATEGORY_NAME;
      return value || DEFAULT_TEMPLATE_CATEGORY;
    }

    function uniqueTemplateCategories(list) {
      const seen = new Set();
      const result = [];

      [DEFAULT_TEMPLATE_CATEGORY, ...(Array.isArray(list) ? list : [])].forEach(name => {
        const clean = cleanTemplateCategoryName(name);
        const key = clean.toLocaleLowerCase('pt-BR');
        if (!seen.has(key)) {
          seen.add(key);
          result.push(clean);
        }
      });

      return result;
    }

    function getTemplateCategoryList(tpl) {
      const primary = cleanTemplateCategoryName(tpl && tpl.category);
      const extras = Array.isArray(tpl && tpl.extraCategories) ? tpl.extraCategories.map(cleanTemplateCategoryName) : [];
      const seen = new Set();
      const result = [];
      [primary, ...extras].forEach(name => {
        const key = name.toLocaleLowerCase('pt-BR');
        if (!seen.has(key)) {
          seen.add(key);
          result.push(name);
        }
      });
      return result;
    }

    function templateHasCategory(tpl, name) {
      const key = cleanTemplateCategoryName(name).toLocaleLowerCase('pt-BR');
      return getTemplateCategoryList(tpl).some(c => c.toLocaleLowerCase('pt-BR') === key);
    }

    function ensureTemplateCategoriesFromTemplates() {
      templateCategories = uniqueTemplateCategories([
        ...templateCategories,
        ...templates.flatMap(getTemplateCategoryList)
      ]);
    }

    function saveTemplateCategoriesToStorage() {
      safeSetItem(TEMPLATE_CATEGORIES_STORAGE_KEY, JSON.stringify(uniqueTemplateCategories(templateCategories)));
    }

    function loadTemplateCategories() {
      try {
        const saved = localStorage.getItem(TEMPLATE_CATEGORIES_STORAGE_KEY);
        templateCategories = saved ? JSON.parse(saved) : [DEFAULT_TEMPLATE_CATEGORY];
        templateCategories = uniqueTemplateCategories(templateCategories);
      } catch (e) {
        templateCategories = [DEFAULT_TEMPLATE_CATEGORY];
      }
    }

    function normalizeTemplateItem(item) {
      const category = cleanTemplateCategoryName(item.category);
      const categoryKey = category.toLocaleLowerCase('pt-BR');
      const extraSeen = new Set();
      const extraCategories = [];
      (Array.isArray(item.extraCategories) ? item.extraCategories : []).forEach(raw => {
        const clean = cleanTemplateCategoryName(raw);
        const key = clean.toLocaleLowerCase('pt-BR');
        if (key === categoryKey || extraSeen.has(key)) return;
        extraSeen.add(key);
        extraCategories.push(clean);
      });

      return {
        id: typeof item.id === 'string' && item.id ? item.id : newId(),
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Modelo importado',
        category,
        extraCategories,
        content: typeof item.content === 'string' ? item.content : ''
      };
    }

    function getTemplateCategoryNames() {
      ensureTemplateCategoriesFromTemplates();
      return templateCategories.slice();
    }

    function renderTemplateCategoryControls(selectedCategory) {
      const categories = getTemplateCategoryNames();
      const selected = cleanTemplateCategoryName(selectedCategory || (templateCategorySelect && templateCategorySelect.value) || DEFAULT_TEMPLATE_CATEGORY);

      [templateCategorySelect, templateCategoryFilter, categoryManageSelect].forEach(select => {
        if (!select) return;
        // A lista de "Alterar existente" começa em "— Escolha a categoria —" (valor vazio): nunca sobra uma categoria escolhida sem a pessoa ter escolhido.
        const previous = select === templateCategoryFilter ? (select.value || DEFAULT_TEMPLATE_CATEGORY) : (select === categoryManageSelect ? select.value : selected);
        select.innerHTML = '';

        if (select === templateCategoryFilter) {
          const allOpt = document.createElement('option');
          allOpt.value = 'all';
          allOpt.textContent = 'Todas as categorias';
          select.appendChild(allOpt);
        }

        if (select === categoryManageSelect) {
          const nenhuma = document.createElement('option');
          nenhuma.value = '';
          nenhuma.textContent = '— Escolha a categoria —';
          select.appendChild(nenhuma);
        }

        categories.forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          select.appendChild(opt);
        });

        if ([...select.options].some(opt => opt.value === previous)) {
          select.value = previous;
        } else {
          select.value = select === categoryManageSelect ? '' : DEFAULT_TEMPLATE_CATEGORY;
        }
      });

      updateDeleteTemplateCategoryButton();
    }

    // Duas ações separadas, como nos modelos: 'nova' = "Criar nova" (só o nome da categoria nova; nenhuma categoria existente é tocada);
    // 'alterar' = "Alterar existente" (escolhe-se a categoria na lista; só então aparecem Renomear e Excluir, que valem para ela).
    // A categoria oficial (REUNIÕES) não pode ser renomeada nem excluída: ao escolhê-la as ações ficam escondidas, com o aviso.
    let categoryModoEdicao = 'nova';

    function updateDeleteTemplateCategoryButton() {
      if (!categoryManageSelect || !categoryModo) return;
      const nova = categoryModoEdicao === 'nova';
      const escolhida = nova ? '' : categoryManageSelect.value; // vazio = nada escolhido (cleanTemplateCategoryName('') devolveria REUNIÕES)
      const oficial = Boolean(escolhida) && cleanTemplateCategoryName(escolhida) === DEFAULT_TEMPLATE_CATEGORY;
      categoryModoNovaBtn.setAttribute('aria-pressed', String(nova));
      categoryModoAlterarBtn.setAttribute('aria-pressed', String(!nova));
      categoryNova.hidden = !nova;
      categoryAlterar.hidden = nova;
      categoryAcoes.hidden = nova || !escolhida || oficial;
      categoryModo.textContent = nova
        ? 'Digite o nome e toque em Criar categoria. As categorias que já existem não são mudadas.'
        : !escolhida
          ? 'Escolha na lista acima a categoria que você quer alterar.'
          : oficial
            ? '"' + DEFAULT_TEMPLATE_CATEGORY + '" é a categoria oficial do app: não pode ser renomeada nem excluída.'
            : 'Mudando a categoria "' + escolhida + '". Digite o novo nome e toque em Renomear, ou exclua a categoria.';
    }

    function setCategoryMode(modo) {
      categoryModoEdicao = modo;
      categoryManageSelect.value = '';
      newTemplateCategoryName.value = '';
      categoryRenameName.value = '';
      categoryStatus.textContent = '';
      updateDeleteTemplateCategoryButton();
    }

    function addTemplateCategory() {
      const typed = newTemplateCategoryName.value.trim();
      if (!typed) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'Digite o nome da nova categoria.';
        return;
      }
      const name = cleanTemplateCategoryName(typed);
      if (templateCategories.some(c => c.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'Já existe uma categoria chamada "' + name + '".';
        return;
      }

      templateCategories = uniqueTemplateCategories([...templateCategories, name]);
      saveTemplateCategoriesToStorage();
      renderTemplateCategoryControls(name);
      if (templateCategorySelect) templateCategorySelect.value = name;
      newTemplateCategoryName.value = '';
      categoryStatus.className = 'ok';
      categoryStatus.textContent = '✅ Categoria "' + name + '" criada. Para renomeá-la depois, use "Alterar existente".';
    }

    function renameTemplateCategory() {
      if (!categoryManageSelect.value) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'Escolha na lista a categoria que você quer renomear.';
        return;
      }
      const oldName = cleanTemplateCategoryName(categoryManageSelect.value);
      const typedName = categoryRenameName.value.trim();

      if (oldName === DEFAULT_TEMPLATE_CATEGORY) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'A categoria "' + DEFAULT_TEMPLATE_CATEGORY + '" não pode ser renomeada.';
        return;
      }
      if (!typedName) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'Digite o novo nome da categoria.';
        return;
      }

      const newName = cleanTemplateCategoryName(typedName);
      const oldKey = oldName.toLocaleLowerCase('pt-BR');
      const newKey = newName.toLocaleLowerCase('pt-BR');

      if (oldKey === newKey) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'O novo nome é igual ao atual.';
        return;
      }
      if (templateCategories.some(c => c.toLocaleLowerCase('pt-BR') === newKey)) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'Já existe uma categoria chamada "' + newName + '".';
        return;
      }

      templates = templates.map(t => {
        const isPrimary = cleanTemplateCategoryName(t.category) === oldName;
        const extras = Array.isArray(t.extraCategories) ? t.extraCategories : [];
        const hadExtra = extras.some(c => cleanTemplateCategoryName(c).toLocaleLowerCase('pt-BR') === oldKey);
        if (!isPrimary && !hadExtra) return t;

        return {
          ...t,
          category: isPrimary ? newName : t.category,
          extraCategories: hadExtra
            ? extras.map(c => cleanTemplateCategoryName(c).toLocaleLowerCase('pt-BR') === oldKey ? newName : c)
            : extras
        };
      });
      saveTemplatesToStorage();

      templateCategories = uniqueTemplateCategories(
        templateCategories.filter(c => c.toLocaleLowerCase('pt-BR') !== oldKey).concat(newName)
      );
      saveTemplateCategoriesToStorage();

      categoryRenameName.value = '';
      renderTemplateCategoryControls(newName);
      if (categoryManageSelect) categoryManageSelect.value = newName;
      updateDeleteTemplateCategoryButton();
      renderTemplates();

      categoryStatus.className = 'ok';
      categoryStatus.textContent = 'Categoria "' + oldName + '" renomeada para "' + newName + '".';
    }

    // Confirmação própria do app, em vez de confirm() nativo — alguns navegadores/extensões
    // bloqueiam diálogos nativos repetidos e o confirm() passa a retornar false sem avisar.
    // opcoes (opcional): { ok, cancel } trocam o texto dos dois botões e { extra } acrescenta um elemento (um link) ao fim do texto.
    function askConfirm(message, title, opcoes) {
      return new Promise(resolve => {
        let settled = false;
        const rotuloOk = confirmOkChoice.textContent;
        const rotuloNao = cancelConfirmChoice.textContent;

        function finish(value) {
          if (settled) return;
          settled = true;
          confirmOkChoice.textContent = rotuloOk;
          cancelConfirmChoice.textContent = rotuloNao;
          confirmOverlay.classList.remove('open');
          confirmOkChoice.removeEventListener('click', onOk);
          cancelConfirmChoice.removeEventListener('click', onCancel);
          confirmOverlay.removeEventListener('click', onOverlay);
          document.removeEventListener('keydown', onKey);
          resolve(value);
        }

        function onOk() { finish(true); }
        function onCancel() { finish(false); }
        function onOverlay(event) {
          if (event.target === confirmOverlay) finish(false);
        }
        function onKey(event) {
          if (event.key === 'Escape') finish(false);
        }

        document.getElementById('confirmTitle').textContent = title || 'Confirmar';
        confirmText.textContent = message;
        if (opcoes && opcoes.ok) confirmOkChoice.textContent = opcoes.ok;
        if (opcoes && opcoes.cancel) cancelConfirmChoice.textContent = opcoes.cancel;
        if (opcoes && opcoes.extra) confirmText.append('\n\n', opcoes.extra);

        confirmOkChoice.addEventListener('click', onOk);
        cancelConfirmChoice.addEventListener('click', onCancel);
        confirmOverlay.addEventListener('click', onOverlay);
        document.addEventListener('keydown', onKey);
        confirmOverlay.classList.add('open');
      });
    }

    // Aviso próprio do app, só com o botão OK (usa o mesmo quadro da confirmação).
    async function showAlert(message, title) {
      const okLabel = confirmOkChoice.textContent;
      confirmOverlay.classList.add('alert-only');
      cancelConfirmChoice.hidden = true;
      confirmOkChoice.textContent = 'OK';
      try {
        await askConfirm(message, title);
      } finally {
        confirmOverlay.classList.remove('alert-only');
        cancelConfirmChoice.hidden = false;
        confirmOkChoice.textContent = okLabel;
      }
    }

    // ---------- Privacidade: concordância com a IA e a voz, relato de problema e apagar os dados do aparelho ----------
    // Textos só saem do aparelho quando a pessoa toca num botão de IA ou de voz. Antes do primeiro envio o app pede a concordância (a
    // Anthropic gera os textos; o Google gera a voz). A escolha fica só neste aparelho e pode ser retirada em Ajustes.
    const CONSENT_IA_KEY = 'jwLibraryNoteAplicarConsentimentoIaV1';
    const REPORT_EMAIL = 'carvalhofsc1@gmail.com'; // o mesmo contato da página Sobre
    const MSG_SEM_CONSENTIMENTO = 'Para usar a IA e a leitura em voz alta é preciso concordar com o envio do texto. Toque no botão de novo quando quiser concordar.';
    // As tarefas do servidor que usam a IA (as outras só leem o wol.jw.org ou a Bíblia e não precisam da concordância).
    const IA_TAREFAS = new Set(['estudo', 'estudo-lista', 'estudo-perguntas', 'texto-diario-comentarios', 'ebc', 'ebc-dirigente', 'tesouros', 'publico', 'outros', 'discurso', 'joias', 'sentinela']);
    let consentimentoIaSessao = false; // vale só até fechar o app quando o aparelho não deixa gravar a escolha
    let consentimentoIaEmCurso = null;

    function consentimentoIaData() {
      try {
        const salvo = JSON.parse(localStorage.getItem(CONSENT_IA_KEY) || 'null');
        return salvo && salvo.data ? String(salvo.data) : '';
      } catch (e) { return ''; }
    }

    function consentimentoIaDado() {
      return Boolean(consentimentoIaData()) || consentimentoIaSessao;
    }

    // Mostra, em Ajustes → Privacidade e dados deste aparelho, se a pessoa já concordou (e quando).
    function consentimentoIaAtualizar() {
      const info = document.getElementById('consentimentoInfo');
      const botao = document.getElementById('consentimentoRetirarBtn');
      if (!info || !botao) return;
      const data = consentimentoIaData();
      const quando = data && !isNaN(new Date(data)) ? new Date(data).toLocaleDateString('pt-BR') : '';
      botao.disabled = !consentimentoIaDado();
      info.textContent = consentimentoIaDado()
        ? '✅ Você concordou' + (quando ? ' em ' + quando : '') + '. O texto dos seus pedidos vai à Anthropic (IA) e ao Google (voz) só quando você toca num botão de IA ou de voz.'
        : 'Você ainda não concordou. O app pergunta na primeira vez que você usar a IA ou a leitura em voz alta.';
    }

    // Devolve true se a pessoa já concordou ou concorda agora; false se escolhe "Agora não". Duas chamadas ao mesmo tempo mostram um aviso só.
    function garantirConsentimentoIa() {
      if (consentimentoIaDado()) return Promise.resolve(true);
      if (consentimentoIaEmCurso) return consentimentoIaEmCurso;
      const link = document.createElement('a');
      link.href = 'privacidade.html';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '🔒 Ler a Política de Privacidade';
      const pergunta = askConfirm(
        'Para usar a IA (formatação, respostas, perguntas e esboços) e a leitura em voz alta, o NoteStyle envia o texto do pedido, pela internet, a serviços de terceiros: a Anthropic (que gera os textos com IA) e o Google (que gera a voz).\n\n' +
        'O envio só acontece quando você toca num botão de IA ou de voz, e o texto não fica guardado no servidor do NoteStyle.\n\n' +
        'Não escreva nem cole dados pessoais ou sigilosos seus ou de outras pessoas (nomes, endereços, telefones, saúde, relatos reservados). A IA pode errar: confira sempre o resultado.\n\n' +
        'Você pode retirar a concordância quando quiser, em Ajustes → Privacidade e dados deste aparelho.',
        'Antes de usar a IA e a voz',
        { ok: '✅ Concordo', cancel: 'Agora não', extra: link }
      );
      consentimentoIaEmCurso = pergunta.then(aceitou => {
        consentimentoIaEmCurso = null;
        if (!aceitou) return false;
        consentimentoIaSessao = true;
        safeSetItem(CONSENT_IA_KEY, JSON.stringify({ v: 1, data: new Date().toISOString() }));
        consentimentoIaAtualizar();
        return true;
      });
      return consentimentoIaEmCurso;
    }

    document.getElementById('consentimentoRetirarBtn').addEventListener('click', () => {
      consentimentoIaSessao = false;
      try { localStorage.removeItem(CONSENT_IA_KEY); } catch (e) { /* sem localStorage */ }
      consentimentoIaAtualizar();
    });
    consentimentoIaAtualizar();

    // Relatar problema com a IA (só em Ajustes → Privacidade e dados deste aparelho): abre o e-mail da própria pessoa com uma mensagem pronta para
    // o desenvolvedor. Nada é enviado pelo app: só vai se ela mandar o e-mail (e pode apagar ou mudar qualquer parte antes).
    async function relatarProblemaIa() {
      const ok = await askConfirm(
        'O app vai abrir o seu aplicativo de e-mail com uma mensagem pronta para o desenvolvedor' +
        '. Você lê, escreve o que houve (por exemplo: errado, ofensivo ou inadequado) e decide se envia: o app não envia nada sozinho.\n\n' +
        'Se o e-mail não abrir, escreva para ' + REPORT_EMAIL + '.',
        'Relatar problema com a IA',
        { ok: '✉️ Abrir o e-mail', cancel: 'Agora não' }
      );
      if (!ok) return;
      const corpo = 'Descreva o problema (o que a IA escreveu de errado, ofensivo ou inadequado):\n\n\n' +
        '— Dados do aplicativo (pode apagar) —\n' +
        'Versão: ' + APP_VERSION + '\n' +
        'Tipo de pedido: ' + (typeof aiLastKind === 'string' ? aiLastKind : '') + '\n';
      location.href = 'mailto:' + REPORT_EMAIL + '?subject=' + encodeURIComponent('NoteStyle: problema com resposta da IA') + '&body=' + encodeURIComponent(corpo);
    }
    document.getElementById('relatarProblemaBtn').addEventListener('click', relatarProblemaIa);

    // ---------- Texto do convite (Ajustes → Gerenciar modelos e categorias → Texto do convite, só para o administrador) ----------
    // A página Sobre (sobre.html) mostra o convite para enviar pelo WhatsApp, compartilhar ou copiar. O texto é do administrador: fica no servidor
    // (vale para todos), só ele o muda (com a senha de administrador salva em Autorização de acessos) e, sem texto salvo, vale o original (mantenha-o
    // igual ao de sobre.html). A chave abaixo guardava o texto só no aparelho (versão 6.1.22): serve só para trazê-lo ao campo uma vez.
    const CONVITE_TEXTO_KEY = 'jwLibraryNoteAplicarConviteTextoV1';
    const CONVITE_ORIGINAL = 'Olá! Quero te apresentar o NoteStyle, um aplicativo para formatar notas do JW e ajudar na preparação para as reuniões, no estudo e nos discursos.\n\nAcesse: https://www.notestyle.com.br' +
      '\n\nNo celular, abra o endereço no navegador e use "Adicionar à Tela de Início" para instalar como aplicativo. Alguns recursos exigem um código de acesso: peça a quem te convidou.';
    const conviteTextoCaixa = document.getElementById('conviteTextoSubsection');
    const conviteTextoCampo = document.getElementById('conviteTextoPadrao');
    const conviteTextoStatus = document.getElementById('conviteTextoStatus');
    const conviteTextoSalvarBtn = document.getElementById('conviteTextoSalvarBtn');
    const conviteTextoRestaurarBtn = document.getElementById('conviteTextoRestaurarBtn');
    let conviteTextoPronto = false; // só dá para salvar depois de ler o texto do servidor (para não trocar o que já está lá sem ver)
    function conviteTextoMostrar(mensagem, aviso) {
      conviteTextoStatus.className = aviso ? 'warn' : 'ok';
      conviteTextoStatus.textContent = mensagem;
    }
    function conviteTextoBotoes() {
      conviteTextoSalvarBtn.disabled = !conviteTextoPronto;
      conviteTextoRestaurarBtn.disabled = !conviteTextoPronto;
    }
    async function conviteTextoCarregar() {
      conviteTextoPronto = false;
      conviteTextoBotoes();
      conviteTextoMostrar('Carregando o texto do servidor…', false);
      const r = await postConfig({ acao: 'convite-ler' });
      if (!r.ok) return conviteTextoMostrar(configErrorMessage(r, 'Não consegui ler o texto do servidor agora.') + ' Só dá para salvar depois de carregar.', true);
      const doServidor = String((r.data && r.data.texto) || '').trim();
      let antigo = '';
      try { antigo = (localStorage.getItem(CONVITE_TEXTO_KEY) || '').trim(); } catch (e) { /* sem localStorage */ }
      conviteTextoPronto = true;
      conviteTextoBotoes();
      if (doServidor) {
        conviteTextoCampo.value = doServidor;
        return conviteTextoMostrar('', false);
      }
      conviteTextoCampo.value = antigo || CONVITE_ORIGINAL;
      conviteTextoMostrar(antigo ? 'Este texto estava salvo só neste aparelho. Toque em Salvar texto para valer para todos.' : '', false);
    }
    async function conviteTextoGravar(texto, aviso) {
      const senha = senhaAdminSalva();
      if (!senha) return conviteTextoMostrar('Salve a senha de administrador em Autorização de acessos.', true);
      conviteTextoMostrar('Salvando…', false);
      const r = await postConfig({ acao: 'convite-salvar', codigo: senha, texto });
      if (!r.ok) return conviteTextoMostrar(configErrorMessage(r, 'Não consegui salvar agora.') + (r.status === 403 ? ' Confira a senha em Autorização de acessos.' : ''), true);
      try { localStorage.removeItem(CONVITE_TEXTO_KEY); } catch (e) { /* sem localStorage */ }
      conviteTextoCampo.value = String(r.data.texto || '') || CONVITE_ORIGINAL;
      conviteTextoMostrar(aviso, false);
    }
    // A subseção só aparece para quem tem a senha de administrador salva neste aparelho (o servidor confere a senha ao salvar).
    function conviteTextoAtualizarAdmin() {
      const admin = Boolean(senhaAdminSalva());
      conviteTextoCaixa.hidden = !admin;
      if (!admin) conviteTextoCaixa.open = false;
    }
    conviteTextoCaixa.addEventListener('toggle', () => { if (conviteTextoCaixa.open) conviteTextoCarregar(); });
    conviteTextoSalvarBtn.addEventListener('click', () => {
      const texto = conviteTextoCampo.value.trim();
      conviteTextoGravar(texto === CONVITE_ORIGINAL ? '' : texto, texto && texto !== CONVITE_ORIGINAL ? '✅ Texto do convite salvo para todos.' : '✅ Vale o texto original do convite.');
    });
    conviteTextoRestaurarBtn.addEventListener('click', () => conviteTextoGravar('', '✅ Voltou o texto original do convite (para todos).'));
    document.addEventListener('acesso-salvo', event => { if (event.detail === 'senha') conviteTextoAtualizarAdmin(); });
    conviteTextoAtualizarAdmin();
    conviteTextoBotoes();

    // ---------- Resumo do que está guardado neste aparelho ----------
    // Ajustes → Privacidade e dados deste aparelho: o tipo, a quantidade, o tamanho e as datas de tudo o que o app guardou no navegador
    // (localStorage) e os arquivos do app em cache. Só lê: nada é apagado ou enviado, e os códigos e a senha aparecem só como "salvos".
    const dadosResumoEl = document.getElementById('dadosResumo');

    function tamanhoLegivel(bytes) {
      if (bytes < 1024) return bytes + ' B';
      const numero = (valor, casas) => valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
      return bytes < 1048576 ? numero(bytes / 1024, 1) + ' KB' : numero(bytes / 1048576, 2) + ' MB';
    }

    // "em 25/10/2026" ou "de 20/10/2026 a 25/10/2026" (datas em ms ou texto ISO; as inválidas ficam de fora).
    function periodoLegivel(datas) {
      const ms = datas.map(d => (typeof d === 'number' ? d : Date.parse(d))).filter(n => Number.isFinite(n) && n > 0);
      if (!ms.length) return '';
      const dia = n => new Date(n).toLocaleDateString('pt-BR');
      const primeira = dia(Math.min(...ms));
      const ultima = dia(Math.max(...ms));
      return primeira === ultima ? 'em ' + primeira : 'de ' + primeira + ' a ' + ultima;
    }

    async function dadosAparelhoCatalogo() {
      const bruto = chave => { try { return localStorage.getItem(chave); } catch (e) { return null; } };
      const json = chave => { try { return JSON.parse(bruto(chave)); } catch (e) { return null; } };
      const bytes = chave => { const valor = bruto(chave); return valor == null ? 0 : (chave.length + valor.length) * 2; }; // o navegador guarda 2 bytes por caractere
      const objeto = chave => { const o = json(chave); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
      const lista = chave => { const o = json(chave); return Array.isArray(o) ? o : []; };
      const contar = chave => { const o = json(chave); return Array.isArray(o) ? o.length : o && typeof o === 'object' ? Object.keys(o).length : 0; };
      const usadas = new Set();
      const grupos = [];
      const adicionar = (icone, nome, chaves, qtd, [singular, plural], detalhe, datas) => {
        chaves.forEach(chave => usadas.add(chave));
        const tamanho = chaves.reduce((soma, chave) => soma + bytes(chave), 0);
        if (!tamanho) return;
        grupos.push({ icone, nome, texto: qtd + ' ' + (qtd === 1 ? singular : plural), bytes: tamanho, periodo: periodoLegivel(datas || []), detalhe: detalhe || '', chaves });
      };

      const pesquisas = lista(HISTORICO_KEY);
      const porCategoria = HISTORICO_CATEGORIAS.map(cat => ({ nome: cat.titulo.replace(/^\S+\s+/, ''), n: pesquisas.filter(item => historicoCategoriaDe(item) === cat).length })).filter(c => c.n);
      adicionar('🗂️', 'Pesquisas e respostas salvas', [HISTORICO_KEY], pesquisas.length, ['pesquisa', 'pesquisas'], porCategoria.map(c => c.nome + ': ' + c.n).join(' · '), pesquisas.map(item => item && item.data));

      const carregados = objeto(CARREGADOS_KEY);
      const estudos = objeto(AI_STUDY_CACHE_KEY);
      const rotulosCarregados = { ebc: 'Estudo Bíblico', joias: 'Joias', imagens: 'Imagens da apostila', tesouros: 'Tesouros', discurso: 'Discurso curto' };
      const porTipo = {};
      Object.keys(carregados).forEach(chave => { const tipo = chave.split('|')[0]; porTipo[tipo] = (porTipo[tipo] || 0) + 1; });
      const detalheCarregados = Object.keys(porTipo).map(tipo => (rotulosCarregados[tipo] || tipo) + ': ' + porTipo[tipo]);
      if (Object.keys(estudos).length) detalheCarregados.push('A Sentinela: ' + Object.keys(estudos).length);
      adicionar('📥', 'Leituras do wol.jw.org (perguntas, imagens e discursos já carregados)', [CARREGADOS_KEY, AI_STUDY_CACHE_KEY], Object.keys(carregados).length + Object.keys(estudos).length, ['leitura', 'leituras'],
        detalheCarregados.join(' · '), [...Object.values(carregados), ...Object.values(estudos)].map(entrada => entrada && entrada.quando));

      const leituraGravada = json(LEITURA_SALVA_KEY);
      if (leituraGravada && typeof leituraGravada.texto === 'string' && leituraGravada.texto.trim()) {
        const marcasGravadas = json(LEITURA_MARCAS_KEY);
        const qtdMarcas = Array.isArray(marcasGravadas) ? marcasGravadas.length : 0;
        adicionar('🔊', 'Texto da Leitura em voz alta (para continuar depois)', [LEITURA_SALVA_KEY, LEITURA_POSICAO_KEY, LEITURA_MARCAS_KEY], 1, ['texto', 'textos'],
          [String(leituraGravada.info || '').replace(/^📄\s*/, ''), qtdMarcas ? qtdMarcas + (qtdMarcas === 1 ? ' trecho marcado' : ' trechos marcados') : ''].filter(Boolean).join(' · '), [leituraGravada.gravadoEm]);
      }

      const comentarios = objeto(TD_SALVOS_KEY);
      adicionar('📅', 'Comentários do texto diário salvos', [TD_SALVOS_KEY], Object.keys(comentarios).length, ['dia', 'dias'], '', Object.values(comentarios).map(dia => dia && dia.salvoEm));

      const importados = lista(OUTROS_BASES_KEY);
      adicionar('📜', 'Esboços importados (Outros esboços)', [OUTROS_BASES_KEY], importados.length, ['esboço', 'esboços'], '', importados.map(base => base && base.importadoEm));

      adicionar('🧩', 'Modelos prontos e categorias', [STORAGE_KEY, TEMPLATE_CATEGORIES_STORAGE_KEY, ONLINE_DEFAULTS_VERSION_STORAGE_KEY], contar(STORAGE_KEY), ['modelo', 'modelos'], contar(TEMPLATE_CATEGORIES_STORAGE_KEY) + ' categorias', []);

      const simbolos = [SYMBOLS_STORAGE_KEY, CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY, FAVORITE_SYMBOLS_STORAGE_KEY, QUICKBAR_STORAGE_KEY];
      adicionar('😀', 'Símbolos, favoritos e barra rápida', simbolos, contar(FAVORITE_SYMBOLS_STORAGE_KEY) + contar(QUICKBAR_STORAGE_KEY) + contar(CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY), ['item', 'itens'],
        'favoritos: ' + contar(FAVORITE_SYMBOLS_STORAGE_KEY) + ' · barra rápida: ' + contar(QUICKBAR_STORAGE_KEY) + ' · categorias próprias: ' + contar(CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY), []);

      const campos = objeto(BACKUP_CAMPOS_KEY);
      adicionar('📦', 'Dados lidos para o backup do JW Library (campos e semanas)', [BACKUP_CAMPOS_KEY, BACKUP_SEMANAS_KEY], Object.keys(campos).length + Object.keys(objeto(BACKUP_SEMANAS_KEY)).length, ['registro', 'registros'], '',
        Object.values(campos).map(item => item && item.quando));

      const codigos = [['jwLibraryNoteAplicarStudyCodeV1', 'código de pesquisa'], ['jwLibraryNoteAplicarDirigenteCodeV1', 'código do dirigente'], ['jwLibraryNoteAplicarAdminSenhaV1', 'senha de administrador']].filter(([chave]) => bruto(chave));
      adicionar('🔑', 'Códigos e senha', codigos.map(([chave]) => chave), codigos.length, ['salvo', 'salvos'], codigos.map(([, nome]) => nome).join(' · '), []);

      // Todo o resto (tema, opções da IA, voz, quadros marcados, concordância, texto antes de atualizar…).
      const restantes = [];
      try { for (let i = 0; i < localStorage.length; i++) { const chave = localStorage.key(i); if (chave && !usadas.has(chave)) restantes.push(chave); } } catch (e) { /* sem localStorage */ }
      const consentimento = json(CONSENT_IA_KEY);
      adicionar('⚙️', 'Preferências e outros ajustes (tema, opções da IA, voz, avisos…)', restantes, restantes.length, ['item', 'itens'], '', consentimento && consentimento.data ? [consentimento.data] : []);

      let total = 0;
      try { for (let i = 0; i < localStorage.length; i++) total += bytes(localStorage.key(i)); } catch (e) { /* sem localStorage */ }

      // Os arquivos do app guardados para abrir sem internet (cache do navegador).
      let arquivos = 0;
      let arquivosBytes = 0;
      try {
        for (const nome of await caches.keys()) {
          if (!nome.startsWith('jw-notas-')) continue;
          const cache = await caches.open(nome);
          for (const pedido of await cache.keys()) {
            const resposta = await cache.match(pedido);
            if (resposta) { arquivos++; arquivosBytes += (await resposta.clone().blob()).size; }
          }
        }
      } catch (e) { /* sem cache do navegador */ }
      if (arquivos) grupos.push({ icone: '🗄️', nome: 'Arquivos do app (para abrir sem internet)', texto: arquivos + (arquivos === 1 ? ' arquivo' : ' arquivos'), bytes: arquivosBytes, periodo: '', detalhe: '',
        apagar: async () => { for (const nome of await caches.keys()) if (nome.startsWith('jw-notas-')) await caches.delete(nome); } });
      return { grupos, total, arquivosBytes };
    }

    async function dadosAparelhoRender() {
      dadosResumoEl.textContent = 'Calculando…';
      let resumo;
      try { resumo = await dadosAparelhoCatalogo(); } catch (e) { dadosResumoEl.textContent = 'Não consegui ler o que está guardado.'; return; }
      dadosResumoEl.textContent = '';
      if (!resumo.grupos.length) {
        dadosResumoEl.textContent = 'Nada guardado neste aparelho ainda.';
        return;
      }
      const linha = (classe, texto) => { const el = document.createElement('div'); el.className = classe; el.textContent = texto; return el; };
      resumo.grupos.forEach(grupo => {
        const bloco = document.createElement('div');
        bloco.className = 'dados-linha';
        const corpo = document.createElement('div');
        corpo.className = 'dados-corpo';
        corpo.appendChild(linha('dados-nome', grupo.icone + ' ' + grupo.nome));
        corpo.appendChild(linha('dados-meta', [grupo.texto, tamanhoLegivel(grupo.bytes), grupo.periodo].filter(Boolean).join(' · ')));
        if (grupo.detalhe) corpo.appendChild(linha('dados-detalhe', grupo.detalhe));
        // Lixeira discreta: apaga só este item (os outros ficam).
        const lixeira = document.createElement('button');
        lixeira.type = 'button';
        lixeira.className = 'dados-apagar';
        lixeira.textContent = '🗑️';
        lixeira.title = 'Apagar este item deste aparelho';
        lixeira.setAttribute('aria-label', 'Apagar: ' + grupo.nome);
        lixeira.addEventListener('click', async () => {
          const aviso = grupo.chaves && grupo.chaves.some(k => /Code|Senha|Admin|Codigo/i.test(k))
            ? 'Apagar este item (' + grupo.nome + ') deste aparelho? Você terá de informar os códigos de novo em Autorização de acessos.'
            : 'Apagar este item (' + grupo.nome + ') deste aparelho? Os outros itens ficam. Não dá para desfazer.';
          if (!(await askConfirm(aviso, 'Apagar este item', { ok: '🗑️ Apagar', cancel: 'Cancelar' }))) return;
          if (grupo.apagar) await grupo.apagar();
          else if (grupo.chaves && grupo.chaves.includes(LEITURA_SALVA_KEY)) document.getElementById('leituraLimparBtn').click(); // limpa a tela e apaga o texto, a posição e as marcas
          else grupo.chaves.forEach(chave => { try { localStorage.removeItem(chave); } catch (e) { /* sem localStorage */ } });
          if (grupo.chaves && grupo.chaves.includes(HISTORICO_KEY)) historicoRender();
          dadosAparelhoRender();
        });
        bloco.append(corpo, lixeira);
        dadosResumoEl.appendChild(bloco);
      });
      dadosResumoEl.appendChild(linha('dados-total', 'Total guardado: ' + tamanhoLegivel(resumo.total + resumo.arquivosBytes)));
    }
    document.getElementById('dadosResumoBtn').addEventListener('click', dadosAparelhoRender);
    document.getElementById('privacidadeBox').addEventListener('toggle', event => { if (event.target.open) dadosAparelhoRender(); });

    // Apagar os dados deste aparelho: tudo o que o app guardou aqui (pesquisas salvas, esboços importados, códigos, modelos e preferências).
    // O servidor não guarda dados de usuários, então não há nada a apagar lá. Depois o app recarrega como na primeira vez.
    document.getElementById('apagarDadosBtn').addEventListener('click', async () => {
      const ok = await askConfirm(
        'Isto apaga TUDO o que o NoteStyle guardou neste aparelho: pesquisas e respostas salvas, esboços importados, o texto do campo, modelos, favoritos, preferências e os códigos e a senha salvos (você terá de informá-los de novo).\n\n' +
        'Um backup do JW Library aberto no app e as alterações dele que ainda não foram gravadas em arquivo também se perdem. Os seus arquivos .jwlibrary e o JW Library não são afetados.\n\nNão dá para desfazer.',
        'Apagar os dados deste aparelho',
        { ok: '🗑️ Apagar tudo', cancel: 'Cancelar' }
      );
      if (!ok) return;
      try { localStorage.clear(); } catch (e) { /* sem localStorage */ }
      try { sessionStorage.clear(); } catch (e) { /* sem sessionStorage */ }
      // Nada mais pode ser gravado até a página recarregar (um salvamento automático pendente traria os dados de volta).
      Storage.prototype.setItem = function () {};
      backupState = null; // senão o navegador avisaria de alterações não gravadas ao recarregar
      location.replace(location.pathname);
    });

    function askCategoryDeleteMode(name, count) {
      return new Promise(resolve => {
        let settled = false;

        function finish(value) {
          if (settled) return;
          settled = true;
          categoryDeleteOverlay.classList.remove('open');
          keepTemplatesChoice.removeEventListener('click', onKeep);
          deleteTemplatesChoice.removeEventListener('click', onDeleteAll);
          cancelCategoryDeleteChoice.removeEventListener('click', onCancel);
          categoryDeleteOverlay.removeEventListener('click', onOverlay);
          document.removeEventListener('keydown', onKey);
          resolve(value);
        }

        function onKeep() { finish('move'); }
        function onDeleteAll() { finish('delete'); }
        function onCancel() { finish(null); }
        function onOverlay(event) {
          if (event.target === categoryDeleteOverlay) finish(null);
        }
        function onKey(event) {
          if (event.key === 'Escape') finish(null);
        }

        categoryDeleteText.textContent = 'A categoria "' + name + '" tem ' + count + ' modelo(s). O que deseja fazer com ' +
          (count === 1 ? 'ele' : 'eles') + ' ao excluir a categoria?';

        keepTemplatesChoice.addEventListener('click', onKeep);
        deleteTemplatesChoice.addEventListener('click', onDeleteAll);
        cancelCategoryDeleteChoice.addEventListener('click', onCancel);
        categoryDeleteOverlay.addEventListener('click', onOverlay);
        document.addEventListener('keydown', onKey);
        categoryDeleteOverlay.classList.add('open');
      });
    }

    async function deleteTemplateCategory() {
      if (!categoryManageSelect.value) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'Escolha na lista a categoria que você quer excluir.';
        return;
      }
      const name = cleanTemplateCategoryName(categoryManageSelect.value);

      if (name === DEFAULT_TEMPLATE_CATEGORY) {
        categoryStatus.className = 'warn';
        categoryStatus.textContent = 'A categoria "' + DEFAULT_TEMPLATE_CATEGORY + '" não pode ser excluída.';
        return;
      }

      const templatesNaCategoria = templates.filter(t => cleanTemplateCategoryName(t.category) === name).length;
      let mode = null;

      if (templatesNaCategoria) {
        mode = await askCategoryDeleteMode(name, templatesNaCategoria);
        if (!mode) return;
      } else {
        const ok = await askConfirm('Excluir a categoria "' + name + '"?', 'Excluir categoria');
        if (!ok) return;
        mode = 'empty';
      }

      if (mode === 'move') {
        templates = templates.map(t => cleanTemplateCategoryName(t.category) === name
          ? { ...t, category: DEFAULT_TEMPLATE_CATEGORY }
          : t);
      } else if (mode === 'delete') {
        templates = templates.filter(t => cleanTemplateCategoryName(t.category) !== name);
        if (!templates.length) templates = cloneData(defaultTemplates);
        templates = validateTemplates(templates);
      }

      // A categoria deixa de existir: tira ela de qualquer modelo que só a tinha
      // como categoria extra (o modelo em si não é afetado, só perde essa marcação).
      const nameKey = name.toLocaleLowerCase('pt-BR');
      templates = templates.map(t => {
        const extras = Array.isArray(t.extraCategories) ? t.extraCategories : [];
        if (!extras.some(c => cleanTemplateCategoryName(c).toLocaleLowerCase('pt-BR') === nameKey)) return t;
        return { ...t, extraCategories: extras.filter(c => cleanTemplateCategoryName(c).toLocaleLowerCase('pt-BR') !== nameKey) };
      });
      saveTemplatesToStorage();

      templateCategories = uniqueTemplateCategories(
        templateCategories.filter(c => c.toLocaleLowerCase('pt-BR') !== name.toLocaleLowerCase('pt-BR'))
      );
      saveTemplateCategoriesToStorage();

      renderTemplateCategoryControls(DEFAULT_TEMPLATE_CATEGORY);
      renderTemplates();

      categoryStatus.className = 'ok';
      categoryStatus.textContent = mode === 'delete'
        ? 'Categoria "' + name + '" e ' + templatesNaCategoria + ' modelo(s) excluídos.'
        : mode === 'move'
          ? 'Categoria "' + name + '" excluída e ' + templatesNaCategoria + ' modelo(s) movido(s) para "' + DEFAULT_TEMPLATE_CATEGORY + '".'
          : 'Categoria "' + name + '" excluída.';
    }

function saveTemplatesToStorage() {
      templates = validateTemplates(templates);
      ensureTemplateCategoriesFromTemplates();
      safeSetItem(STORAGE_KEY, JSON.stringify(templates));
      saveTemplateCategoriesToStorage();
    }

    function loadTemplates() {
      loadTemplateCategories();
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        templates = saved ? JSON.parse(saved) : cloneData(defaultTemplates);
        if (!Array.isArray(templates) || !templates.length) templates = cloneData(defaultTemplates);
      } catch (e) {
        templates = cloneData(defaultTemplates);
      }

      templates = validateTemplates(templates);
      ensureTemplateCategoriesFromTemplates();
    }

    function applyTemplateToInput(tpl) {
      const content = String(tpl.content || '');
      const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
      const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
      const selected = input.value.slice(start, end);
      const hasSelection = start !== end && selected.length > 0;
      const hasMarker = content.includes('{texto}');

      let insertText;
      let message;
      let keepSelected = false;

      if (hasSelection && hasMarker) {
        insertText = content.split('{texto}').join(selected);
        keepSelected = true;
        message = 'Modelo aplicado ao texto selecionado.';
      } else if (hasSelection) {
        insertText = content + selected;
        message = 'Modelo inserido antes do texto selecionado.';
      } else {
        insertText = hasMarker ? content.split('{texto}').join('') : content;
        message = 'Modelo inserido no cursor.';
      }

      setInputRange(start, end, insertText, { select: keepSelected, message });
    }

    function getTemplatesSortedByName() {
      return templates.slice().sort((a, b) => {
        const catA = cleanTemplateCategoryName(a.category);
        const catB = cleanTemplateCategoryName(b.category);
        const catCmp = catA.localeCompare(catB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        if (catCmp !== 0) return catCmp;

        const nameA = String(a.name || 'Modelo');
        const nameB = String(b.name || 'Modelo');
        return nameA.localeCompare(nameB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
    }

    function getTemplatesForCurrentFilter() {
      const filter = templateCategoryFilter ? templateCategoryFilter.value : 'all';
      const all = getTemplatesSortedByName();
      if (!filter || filter === 'all') return all;
      return all.filter(t => templateHasCategory(t, filter));
    }

    function renderTemplates() {
      const templatesBox = document.getElementById('templates');
      templatesBox.innerHTML = '';

      renderTemplateCategoryControls();

      const visibleTemplates = getTemplatesForCurrentFilter();

      if (!visibleTemplates.length) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.textContent = 'Nenhum modelo nesta categoria.';
        templatesBox.appendChild(empty);
      }

      visibleTemplates.forEach(tpl => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary mini template-card-btn';
        btn.innerHTML = '<span class="template-card-name"></span><span class="template-card-content"></span><span class="category-chip"></span>';
        btn.querySelector('.template-card-name').textContent = tpl.name || 'Modelo';
        btn.querySelector('.template-card-content').textContent = tpl.content;
        btn.querySelector('.category-chip').textContent = getTemplateCategoryList(tpl).join(' • ');
        btn.addEventListener('mousedown', event => event.preventDefault());
        btn.title = (tpl.name || 'Modelo') + ' — clique para inserir no texto original, ou carregar para edição se o texto original não estiver em uso';
        btn.addEventListener('click', () => {
          if (document.activeElement === input) {
            applyTemplateToInput(tpl);
            templateStatus.className = 'ok';
            templateStatus.textContent = 'Modelo inserido no texto original.';
            return;
          }

          const editorSubsection = document.getElementById('editorSubsection');
          // Abre toda a cadeia de seções até o editor (ele fica em Ajustes, dentro de "Configurações gerais do app").
          showScreen('ajustes', { keepScroll: true });
          if (editorSubsection) {
            for (let box = editorSubsection.parentElement.closest('details'); box; box = box.parentElement.closest('details')) box.open = true;
          }
          if (editorSubsection) editorSubsection.open = true;
          if (editorSubsection) editorSubsection.scrollIntoView({ block: 'start' });

          templateModoEdicao = 'alterar';
          templateSelect.value = tpl.id;
          loadSelectedTemplateIntoEditor();

          templateStatus.className = 'ok';
          templateStatus.textContent = 'Modelo carregado para edição.';
        });
        templatesBox.appendChild(btn);
      });

      renderTemplateSelect();
    }

    function renderTemplateSelect(selectedId) {
      const currentId = selectedId || templateSelect.value;
      templateSelect.innerHTML = '';
      // A lista só aparece em "Alterar existente". A primeira opção (sem valor) é o "nada escolhido"; os modelos vêm agrupados pela categoria principal.
      const nenhum = document.createElement('option');
      nenhum.value = '';
      nenhum.textContent = '— Escolha o modelo —';
      templateSelect.appendChild(nenhum);

      const grupos = new Map();
      getTemplatesSortedByName().forEach(tpl => {
        const categoria = cleanTemplateCategoryName(tpl.category);
        if (!grupos.has(categoria)) {
          const grupo = document.createElement('optgroup');
          grupo.label = categoria;
          grupos.set(categoria, grupo);
          templateSelect.appendChild(grupo);
        }
        const opt = document.createElement('option');
        opt.value = tpl.id;
        opt.textContent = (tpl.name || 'Modelo') + ' — ' + tpl.content;
        grupos.get(categoria).appendChild(opt);
      });

      templateSelect.value = currentId && templates.some(t => t.id === currentId) ? currentId : '';

      loadSelectedTemplateIntoEditor();
    }

    function renderExtraCategoryCheckboxes(extraCategories) {
      if (!templateExtraCategories) return;
      const primary = cleanTemplateCategoryName(templateCategorySelect ? templateCategorySelect.value : DEFAULT_TEMPLATE_CATEGORY);
      const primaryKey = primary.toLocaleLowerCase('pt-BR');
      const checked = new Set((extraCategories || []).map(c => cleanTemplateCategoryName(c).toLocaleLowerCase('pt-BR')));

      templateExtraCategories.innerHTML = '';
      const outras = getTemplateCategoryNames().filter(name => name.toLocaleLowerCase('pt-BR') !== primaryKey);
      outras.forEach(name => {
        const key = name.toLocaleLowerCase('pt-BR');
        const label = document.createElement('label');
        label.className = 'checkbox-pill';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        checkbox.checked = checked.has(key);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(name));
        templateExtraCategories.appendChild(label);
      });
      // Sem outras categorias para escolher, a opção some (em vez de mostrar uma caixa vazia).
      if (templateExtraBox) templateExtraBox.hidden = !outras.length;
      updateExtraCategoriesSummary();
    }

    function updateExtraCategoriesSummary() {
      if (!templateExtraResumo) return;
      const marcadas = getCheckedExtraCategories().length;
      templateExtraResumo.textContent = 'Aparecer também em outras categorias' + (marcadas ? ' (' + marcadas + ' marcada' + (marcadas === 1 ? '' : 's') + ')' : '');
    }

    function getCheckedExtraCategories() {
      if (!templateExtraCategories) return [];
      return Array.from(templateExtraCategories.querySelectorAll('input:checked')).map(cb => cb.value);
    }

    // Duas ações separadas, para não haver dúvida sobre o que o formulário faz:
    // 'novo' = "Criar novo": formulário em branco, sem lista de modelos, e o botão cria um modelo; nenhum modelo existente é tocado.
    // 'alterar' = "Alterar existente": escolhe-se o modelo na lista (o formulário só aparece depois) e o botão salva as mudanças nele.
    let templateModoEdicao = 'novo';

    function updateTemplateMode(tpl) {
      const novo = templateModoEdicao === 'novo';
      templateModoNovoBtn.setAttribute('aria-pressed', String(novo));
      templateModoAlterarBtn.setAttribute('aria-pressed', String(!novo));
      templateEscolha.hidden = novo;
      templateForm.hidden = !novo && !tpl;
      deleteTemplateBtn.hidden = !tpl;
      saveTemplateBtn.textContent = novo ? '💾 Criar modelo' : '💾 Salvar alterações';
      templateModo.textContent = novo
        ? 'Preencha os campos e toque em Criar modelo. Os modelos que já existem não são mudados.'
        : tpl
          ? 'Mudando "' + (tpl.name || 'Modelo') + '". As mudanças só valem depois de tocar em Salvar alterações.'
          : 'Escolha na lista acima o modelo que você quer alterar.';
    }

    function limparFormularioModelo() {
      templateName.value = '';
      templateContent.value = '';
      renderTemplateCategoryControls(DEFAULT_TEMPLATE_CATEGORY);
      if (templateCategorySelect) templateCategorySelect.value = DEFAULT_TEMPLATE_CATEGORY;
      renderExtraCategoryCheckboxes([]);
      templateExtraBox.open = false;
    }

    function setTemplateMode(modo) {
      templateModoEdicao = modo;
      templateSelect.value = ''; // nunca sobra um modelo escolhido de antes: criar começa em branco; alterar começa sem escolha
      if (modo === 'novo') limparFormularioModelo();
      templateStatus.textContent = '';
      loadSelectedTemplateIntoEditor();
    }

    function loadSelectedTemplateIntoEditor() {
      const novo = templateModoEdicao === 'novo';
      const tpl = novo ? null : templates.find(t => t.id === templateSelect.value);
      updateTemplateMode(tpl);
      if (!tpl) {
        // Criar novo: o que a pessoa já digitou fica (só a lista de categorias marcadas é redesenhada). Alterar sem escolha: o formulário fica escondido.
        if (novo) renderExtraCategoryCheckboxes(getCheckedExtraCategories());
        return;
      }
      templateName.value = tpl.name || '';
      templateContent.value = tpl.content || '';
      renderTemplateCategoryControls(tpl.category);
      if (templateCategorySelect) templateCategorySelect.value = cleanTemplateCategoryName(tpl.category);
      renderExtraCategoryCheckboxes(tpl.extraCategories);
      templateExtraBox.open = getCheckedExtraCategories().length > 0; // quem tem outras categorias já as vê marcadas
      templateStatus.textContent = '';
    }


    function uniqueTokensFromText(text) {
      const tokens = [];
      const seen = new Set();
      const parts = String(text || '').split(/\s+/).filter(Boolean);
      parts.forEach(part => {
        if (!seen.has(part)) {
          seen.add(part);
          tokens.push(part);
        }
      });
      return tokens;
    }

    function getBaseCategorySymbols(categoryId) {
      const cat = symbolCategories.find(c => c.id === categoryId);
      return cat ? uniqueTokensFromText(cat.text) : [];
    }

    // Categorias personalizadas são guardadas como { id: { name, symbols } }.
    // Versões antigas do app — e o defaults.json publicado — usam { id: [símbolos] };
    // normalizeSymbolCategories() aceita os dois formatos e sempre devolve o novo.
    function prettifyCategoryId(id) {
      const text = String(id || '').replace(/[-_]+/g, ' ').trim();
      return text ? text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1) : 'Personalizados';
    }

    function normalizeSymbolCategories(raw) {
      const result = {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;

      Object.entries(raw).forEach(([id, value]) => {
        const isNewShape = value && !Array.isArray(value) && typeof value === 'object';
        const rawSymbols = isNewShape ? value.symbols : value;
        const list = Array.isArray(rawSymbols) ? rawSymbols : uniqueTokensFromText(String(rawSymbols || ''));
        const symbols = uniqueTokensFromText(list.join(' '));
        if (!symbols.length) return;

        const name = isNewShape && value.name ? String(value.name).trim() : '';
        result[id] = { name: name || prettifyCategoryId(id), symbols };
      });

      return result;
    }

    function getCustomCategorySymbols(categoryId) {
      const entry = customSymbolCategories[categoryId];
      return entry && Array.isArray(entry.symbols) ? entry.symbols : [];
    }

    function getCustomCategoryName(categoryId) {
      const entry = customSymbolCategories[categoryId];
      return (entry && entry.name) || prettifyCategoryId(categoryId);
    }

    function getAllCustomSymbols() {
      return Object.keys(customSymbolCategories).reduce(
        (all, id) => all.concat(getCustomCategorySymbols(id)),
        []
      );
    }

    function getAllCategorySymbols(categoryId) {
      const seen = new Set();
      const combined = [];
      [...getBaseCategorySymbols(categoryId), ...getCustomCategorySymbols(categoryId)].forEach(sym => {
        if (!seen.has(sym)) {
          seen.add(sym);
          combined.push(sym);
        }
      });
      return combined;
    }

    function getAllSymbols() {
      const all = [];
      const seen = new Set();
      symbolCategories.forEach(cat => {
        getAllCategorySymbols(cat.id).forEach(sym => {
          if (!seen.has(sym)) {
            seen.add(sym);
            all.push(sym);
          }
        });
      });
      getAllCustomSymbols().forEach(sym => {
        if (!seen.has(sym)) {
          seen.add(sym);
          all.push(sym);
        }
      });
      favoriteSymbols.forEach(sym => {
        if (!seen.has(sym)) {
          seen.add(sym);
          all.push(sym);
        }
      });
      return all;
    }

    function loadCustomSymbols() {
      try {
        const savedCustom = localStorage.getItem(CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY);
        const savedOld = localStorage.getItem(SYMBOLS_STORAGE_KEY);
        customSymbolCategories = normalizeSymbolCategories(savedCustom ? JSON.parse(savedCustom) : {});

        const oldSymbols = savedOld ? JSON.parse(savedOld) : [];
        if (Array.isArray(oldSymbols) && oldSymbols.length && !customSymbolCategories['personalizados']) {
          customSymbolCategories['personalizados'] = {
            name: 'Personalizados',
            symbols: uniqueTokensFromText(oldSymbols.join(' '))
          };
        }
      } catch (e) {
        customSymbolCategories = {};
      }

      try {
        const savedFavorites = localStorage.getItem(FAVORITE_SYMBOLS_STORAGE_KEY);
        favoriteSymbols = savedFavorites ? JSON.parse(savedFavorites) : defaultFavoriteSymbols.slice();
        if (!Array.isArray(favoriteSymbols) || !favoriteSymbols.length) favoriteSymbols = defaultFavoriteSymbols.slice();
      } catch (e) {
        favoriteSymbols = defaultFavoriteSymbols.slice();
      }
    }

    function saveCustomSymbols() {
      safeSetItem(CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY, JSON.stringify(customSymbolCategories));
      // Mantido para que uma versão antiga do app instalada no mesmo navegador
      // ainda enxergue os caracteres personalizados.
      safeSetItem(SYMBOLS_STORAGE_KEY, JSON.stringify(getAllCustomSymbols()));
    }

    function saveFavoriteSymbols() {
      safeSetItem(FAVORITE_SYMBOLS_STORAGE_KEY, JSON.stringify(favoriteSymbols));
    }

    function renderSymbolCategories() {
      const current = symbolCategorySelect.value || 'setas';
      symbolCategorySelect.innerHTML = '';

      symbolCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        symbolCategorySelect.appendChild(opt);
      });

      Object.keys(customSymbolCategories).forEach(id => {
        if (symbolCategories.some(cat => cat.id === id)) return;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = 'Personalizada: ' + getCustomCategoryName(id);
        symbolCategorySelect.appendChild(opt);
      });

      if ([...symbolCategorySelect.options].some(opt => opt.value === current)) {
        symbolCategorySelect.value = current;
      } else {
        symbolCategorySelect.value = 'setas';
      }
    }

    function slugCategoryName(name) {
      return String(name || '')
        .trim()
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'personalizados';
    }

    function getCustomTargetCategoryId() {
      const typed = customSymbolCategory.value.trim();
      if (typed) return slugCategoryName(typed);
      return symbolCategorySelect.value || 'personalizados';
    }

    function getCustomTargetCategoryName() {
      const typed = customSymbolCategory.value.trim();
      if (typed) return typed;
      const opt = symbolCategorySelect.options[symbolCategorySelect.selectedIndex];
      return opt ? opt.textContent.replace(/^Personalizada:\s*/, '') : 'Personalizados';
    }

    function makeSymbolButton(sym, place, somenteInserir) {
      const isFavorite = place === 'favorite';
      const wrap = document.createElement('span');
      wrap.className = 'symbol-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'symbol-btn' + (isFavorite ? ' favorite' : '');
      btn.textContent = sym;
      btn.title = 'Clique para inserir ' + sym + ' no campo ativo.';
      btn.setAttribute('aria-label', 'Inserir ' + sym);
      btn.addEventListener('mousedown', event => event.preventDefault());
      // Inserção direta: sem espera de clique duplo, o toque no celular responde na hora.
      btn.addEventListener('click', () => {
        if (quickBarPicking && !somenteInserir) return addToQuickBar(sym);
        insertTextAtCursor(getActiveInsertTarget(), sym);
      });

      // Favoritar fica num alvo próprio, porque duplo-toque não é confiável em tela sensível.
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'symbol-star' + (isFavorite ? ' on' : '');
      star.textContent = isFavorite ? '★' : '☆';
      star.title = isFavorite ? 'Tirar dos favoritos' : 'Mandar para os favoritos';
      star.setAttribute('aria-label', (isFavorite ? 'Tirar ' : 'Mandar ') + sym + (isFavorite ? ' dos favoritos' : ' para os favoritos'));
      star.addEventListener('mousedown', event => event.preventDefault());
      star.addEventListener('click', event => {
        event.stopPropagation();
        if (isFavorite) removeFavoriteSymbol(sym);
        else addFavoriteSymbol(sym);
      });

      wrap.appendChild(btn);
      if (!somenteInserir) wrap.appendChild(star);
      return wrap;
    }

    function addFavoriteSymbol(sym) {
      if (!favoriteSymbols.includes(sym)) {
        favoriteSymbols.unshift(sym);
        saveFavoriteSymbols();
        renderSymbols();
        symbolsStatus.className = 'ok';
        symbolsStatus.textContent = 'Adicionado aos favoritos.';
        warnIfStorageBlocked(symbolsStatus);
      } else {
        symbolsStatus.className = 'warn';
        symbolsStatus.textContent = 'Esse caractere já está nos favoritos.';
      }
    }

    function removeFavoriteSymbol(sym) {
      favoriteSymbols = favoriteSymbols.filter(item => item !== sym);
      saveFavoriteSymbols();
      renderSymbols();
      symbolsStatus.className = 'ok';
      symbolsStatus.textContent = 'Removido dos favoritos.';
    }

    function resetFavoriteSymbols() {
      favoriteSymbols = defaultFavoriteSymbols.slice();
      saveFavoriteSymbols();
      renderSymbols();
      symbolsStatus.className = 'ok';
      symbolsStatus.textContent = 'Favoritos restaurados.';
    }

    function renderSymbols() {
      renderSymbolCategories();

      const symbolsBox = document.getElementById('symbols');
      symbolsBox.innerHTML = '';
      favoriteSymbols.forEach(sym => symbolsBox.appendChild(makeSymbolButton(sym, 'favorite')));

      moreSymbols.innerHTML = '';
      const currentCategory = symbolCategorySelect.value || 'setas';
      const favoriteSet = new Set(favoriteSymbols);
      getAllCategorySymbols(currentCategory).forEach(sym => {
        if (!favoriteSet.has(sym)) moreSymbols.appendChild(makeSymbolButton(sym, 'category'));
      });

      if (!moreSymbols.children.length) {
        const note = document.createElement('p');
        note.className = 'hint';
        note.textContent = 'Todos os caracteres desta categoria já estão nos favoritos, ou a categoria está vazia.';
        moreSymbols.appendChild(note);
      }

      if (symbolSearch.value.trim() && emojiKeywords) renderSymbolSearch();
      renderQuickEmojis();
      renderEmojiPicker();
    }

    // ---------- Inserir emojis no texto (tela Formatar → Outras opções de formatação) ----------
    // Só escolher e buscar: os favoritos aparecem no topo, mas se editam (estrelinha, faixa rápida, novos caracteres) em Ajustes.
    function renderEmojiPicker() {
      const atual = emojiPickCategoria.value;
      emojiPickCategoria.innerHTML = symbolCategorySelect.innerHTML;
      emojiPickCategoria.value = [...emojiPickCategoria.options].some(opt => opt.value === atual) ? atual : 'emoji-carinhas';

      emojiPickFavoritos.innerHTML = '';
      favoriteSymbols.forEach(sym => emojiPickFavoritos.appendChild(makeSymbolButton(sym, 'favorite', true)));

      emojiPickLista.innerHTML = '';
      getAllCategorySymbols(emojiPickCategoria.value).forEach(sym => emojiPickLista.appendChild(makeSymbolButton(sym, 'category', true)));

      if (emojiPickBusca.value.trim() && emojiKeywords) renderEmojiPickSearch();
    }

    emojiPickCategoria.addEventListener('change', renderEmojiPicker);

    // ---------- Faixa rápida (tela principal) e o seu editor (em "Caracteres, ícones e emoticons") ----------
    function cleanQuickBar(list) {
      return uniqueTokensFromText((Array.isArray(list) ? list : []).join(' ')).slice(0, QUICKBAR_MAX);
    }

    function loadQuickBar() {
      try {
        const saved = JSON.parse(localStorage.getItem(QUICKBAR_STORAGE_KEY) || 'null');
        if (Array.isArray(saved)) quickBarSymbols = cleanQuickBar(saved);
      } catch (e) { /* lista ilegível: fica a sugestão */ }
    }

    function saveQuickBar() {
      safeSetItem(QUICKBAR_STORAGE_KEY, JSON.stringify(quickBarSymbols));
    }

    // Mesclar: acrescenta os que faltam, até completar os 16.
    function mergeQuickBar(list) {
      cleanQuickBar(list).forEach(sym => {
        if (quickBarSymbols.length < QUICKBAR_MAX && !quickBarSymbols.includes(sym)) quickBarSymbols.push(sym);
      });
    }

    function setQuickBarStatus(message) {
      document.getElementById('quickBarStatus').textContent = message;
    }

    function renderQuickEmojis() {
      quickEmojiList.innerHTML = '';
      quickBarSymbols.forEach(sym => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = sym;
        btn.title = 'Inserir ' + sym;
        btn.setAttribute('aria-label', 'Inserir ' + sym);
        btn.addEventListener('mousedown', event => event.preventDefault()); // mantém o cursor no campo de texto
        btn.addEventListener('click', () => insertTextAtCursor(getActiveInsertTarget(), sym));
        quickEmojiList.appendChild(btn);
      });

      // Depois dos emojis do usuário, as letras fixas (rolando a faixa para o lado).
      const separator = document.createElement('span');
      separator.className = 'quick-emoji-sep';
      separator.setAttribute('aria-hidden', 'true');
      quickEmojiList.appendChild(separator);
      QUICKBAR_LETTERS.forEach(letter => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter';
        btn.textContent = letter.sym;
        btn.title = 'Inserir ' + letter.sym + ' (' + letter.name + ')';
        btn.setAttribute('aria-label', 'Inserir ' + letter.name + ' em emoji');
        btn.addEventListener('mousedown', event => event.preventDefault());
        btn.addEventListener('click', () => insertTextAtCursor(getActiveInsertTarget(), letter.sym));
        quickEmojiList.appendChild(btn);
      });
      renderQuickBarEditor();
    }

    // Com o mouse, a roda também rola a faixa para o lado (só enquanto ainda há para onde rolar; nas pontas a página rola).
    quickEmojiList.addEventListener('wheel', event => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = quickEmojiList.scrollWidth - quickEmojiList.clientWidth;
      const left = quickEmojiList.scrollLeft;
      if (max <= 0 || (event.deltaY < 0 && left <= 0) || (event.deltaY > 0 && left >= max - 1)) return;
      event.preventDefault();
      quickEmojiList.scrollLeft = Math.max(0, Math.min(max, left + event.deltaY));
    }, { passive: false });

    function renderQuickBarEditor() {
      const editor = document.getElementById('quickBarEditor');
      editor.innerHTML = '';
      for (let pos = 0; pos < QUICKBAR_MAX; pos++) {
        const sym = quickBarSymbols[pos];
        const btn = document.createElement('button');
        btn.type = 'button';
        if (sym) {
          btn.textContent = sym;
          btn.title = 'Posição ' + (pos + 1) + ': toque para mover ou tirar';
          btn.setAttribute('aria-label', sym + ', posição ' + (pos + 1));
          btn.classList.toggle('selected', pos === quickBarSelected);
          btn.addEventListener('click', () => {
            quickBarSelected = quickBarSelected === pos ? -1 : pos;
            renderQuickBarEditor();
            setQuickBarStatus(quickBarSelected >= 0 ? 'Use ◀ Mover, Mover ▶ ou ✕ Tirar.' : '');
          });
        } else {
          btn.className = 'empty';
          btn.textContent = String(pos + 1);
          btn.title = 'Espaço livre: use "➕ Escolher para a faixa"';
          btn.setAttribute('aria-label', 'Espaço livre ' + (pos + 1));
          btn.addEventListener('click', () => setQuickBarStatus('Espaço livre: toque em "➕ Escolher para a faixa" e depois num caractere da lista.'));
        }
        editor.appendChild(btn);
      }
      const actions = document.getElementById('quickBarActions');
      actions.hidden = quickBarSelected < 0;
      document.getElementById('quickBarLeft').disabled = quickBarSelected <= 0;
      document.getElementById('quickBarRight').disabled = quickBarSelected < 0 || quickBarSelected >= quickBarSymbols.length - 1;
    }

    function moveQuickBar(step) {
      const from = quickBarSelected;
      const to = from + step;
      if (from < 0 || to < 0 || to >= quickBarSymbols.length) return;
      [quickBarSymbols[from], quickBarSymbols[to]] = [quickBarSymbols[to], quickBarSymbols[from]];
      quickBarSelected = to;
      saveQuickBar();
      renderQuickEmojis();
      setQuickBarStatus('Posição salva.');
    }

    function addToQuickBar(sym) {
      if (quickBarSymbols.includes(sym)) return setQuickBarStatus(sym + ' já está na faixa.');
      if (quickBarSymbols.length >= QUICKBAR_MAX) return setQuickBarStatus('A faixa já tem 16 emojis. Tire um antes de pôr outro.');
      quickBarSymbols.push(sym);
      saveQuickBar();
      renderQuickEmojis();
      const free = QUICKBAR_MAX - quickBarSymbols.length;
      setQuickBarStatus(sym + ' entrou na faixa' + (free ? ' (sobram ' + free + ' espaço' + (free > 1 ? 's' : '') + ').' : '. A faixa está completa.'));
    }

    function setQuickBarPicking(on) {
      quickBarPicking = on;
      document.getElementById('quickBarPickBtn').textContent = on ? '✅ Concluir escolha' : '➕ Escolher para a faixa';
      document.getElementById('symbols').closest('.subsection-body').classList.toggle('quickbar-picking', on);
      setQuickBarStatus(on
        ? 'Toque nos caracteres abaixo (nos favoritos, na busca ou nas categorias) para pôr na faixa. Toque em "✅ Concluir escolha" para voltar a inserir no texto.'
        : '');
    }

    document.getElementById('quickBarLeft').addEventListener('click', () => moveQuickBar(-1));
    document.getElementById('quickBarRight').addEventListener('click', () => moveQuickBar(1));
    document.getElementById('quickBarRemove').addEventListener('click', () => {
      if (quickBarSelected < 0) return;
      const [removed] = quickBarSymbols.splice(quickBarSelected, 1);
      quickBarSelected = -1;
      saveQuickBar();
      renderQuickEmojis();
      setQuickBarStatus(removed + ' saiu da faixa.');
    });
    document.getElementById('quickBarPickBtn').addEventListener('click', () => setQuickBarPicking(!quickBarPicking));
    document.getElementById('quickBarResetBtn').addEventListener('click', () => {
      quickBarSymbols = defaultQuickBar.slice();
      quickBarSelected = -1;
      saveQuickBar();
      renderQuickEmojis();
      setQuickBarStatus('Faixa restaurada com a sugestão do app.');
    });

    // ---------- Busca de caracteres pelo nome ----------
    // Os nomes e as palavras-chave em português (do CLDR do Unicode) ficam em emoji-busca.json e só são baixados na
    // primeira busca. Os caracteres sem nome (setas, letras, linhas...) são achados pelo nome da categoria.
    function normalizeSearchText(text) {
      return String(text || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function symbolSearchKey(sym) {
      return sym.replace(/\uFE0F/g, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
    }

    function loadEmojiKeywords() {
      if (emojiKeywords) return Promise.resolve(emojiKeywords);
      if (!emojiKeywordsPromise) {
        emojiKeywordsPromise = fetch('emoji-busca.json')
          .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(data => { emojiKeywords = data; return data; })
          .catch(error => { emojiKeywordsPromise = null; throw error; });
      }
      return emojiKeywordsPromise;
    }

    const SYMBOL_SEARCH_LIMIT = 400;

    function findSymbolsByName(query) {
      const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
      if (!words.length) return [];

      const found = new Set();
      // Palavra no início de alguma palavra do texto; vale também o singular ("corações" acha "coração") e sinônimos comuns.
      const synonyms = { carinha: 'rosto', carinhas: 'rosto', cara: 'rosto', caras: 'rosto', face: 'rosto', faces: 'rosto', emoji: '', emojis: '' };
      const hasWord = (text, word) => {
        const options = [word];
        if (word.length > 3 && word.endsWith('s')) options.push(word.slice(0, -1));
        if (word.length > 4 && word.endsWith('oes')) options.push(word.slice(0, -3) + 'ao');
        if (synonyms[word] !== undefined) options.push(synonyms[word]);
        return options.some(option => option === '' || (' ' + text).includes(' ' + option));
      };

      // Nome da categoria (ex.: "setas", "bandeiras"): traz todos os caracteres dela.
      const allCategories = symbolCategories.map(cat => ({ id: cat.id, name: cat.name }))
        .concat(Object.keys(customSymbolCategories).map(id => ({ id, name: getCustomCategoryName(id) })));
      allCategories.forEach(cat => {
        const name = normalizeSearchText(cat.name).replace(/[^a-z0-9]+/g, ' ');
        if (words.every(word => hasWord(name, word))) getAllCategorySymbols(cat.id).forEach(sym => found.add(sym));
      });

      getAllSymbols().forEach(sym => {
        const keywords = emojiKeywords && emojiKeywords[symbolSearchKey(sym)];
        if (keywords && words.every(word => hasWord(keywords, word))) found.add(sym);
      });

      return [...found];
    }

    // A busca de Ajustes (com estrelinha) e a da tela Formatar (somenteInserir) usam o mesmo código.
    function renderSymbolSearchIn(campo, info, resultados, somenteInserir) {
      const query = campo.value.trim();
      resultados.innerHTML = '';
      if (!query) { info.textContent = ''; return; }

      const results = findSymbolsByName(query);
      if (!results.length) {
        info.textContent = 'Nenhum caractere encontrado para "' + query + '". Tente outra palavra (ex.: coração, sorriso, bandeira).';
        return;
      }

      const favoriteSet = new Set(favoriteSymbols);
      results.slice(0, SYMBOL_SEARCH_LIMIT).forEach(sym => {
        resultados.appendChild(makeSymbolButton(sym, favoriteSet.has(sym) ? 'favorite' : 'category', somenteInserir));
      });
      info.textContent = results.length > SYMBOL_SEARCH_LIMIT
        ? 'Mostrando ' + SYMBOL_SEARCH_LIMIT + ' de ' + results.length + ' caracteres. Digite mais letras para refinar.'
        : results.length + (results.length === 1 ? ' caractere encontrado.' : ' caracteres encontrados.');
    }

    function renderSymbolSearch() {
      renderSymbolSearchIn(symbolSearch, symbolSearchInfo, symbolSearchResults, false);
    }

    function renderEmojiPickSearch() {
      renderSymbolSearchIn(emojiPickBusca, emojiPickInfo, emojiPickResultados, true);
    }

    function ligarBuscaDeSimbolos(campo, info, resultados, somenteInserir) {
      let timer = null;
      campo.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          if (!campo.value.trim()) return renderSymbolSearchIn(campo, info, resultados, somenteInserir);
          if (!emojiKeywords) {
            info.textContent = 'Carregando os nomes dos caracteres...';
            try {
              await loadEmojiKeywords();
            } catch (e) {
              // Sem a lista de nomes, ainda dá para achar pelo nome da categoria.
              info.textContent = 'Não foi possível carregar os nomes dos emojis (sem conexão?). A busca só acha pelo nome da categoria.';
              resultados.innerHTML = '';
              const only = findSymbolsByName(campo.value);
              only.slice(0, SYMBOL_SEARCH_LIMIT).forEach(sym => resultados.appendChild(makeSymbolButton(sym, favoriteSymbols.includes(sym) ? 'favorite' : 'category', somenteInserir)));
              return;
            }
          }
          renderSymbolSearchIn(campo, info, resultados, somenteInserir);
        }, 180);
      });
    }

    ligarBuscaDeSimbolos(symbolSearch, symbolSearchInfo, symbolSearchResults, false);
    ligarBuscaDeSimbolos(emojiPickBusca, emojiPickInfo, emojiPickResultados, true);

    function addCustomSymbols() {
      const newSymbols = uniqueTokensFromText(customSymbolsText.value);
      if (!newSymbols.length) {
        symbolsStatus.className = 'warn';
        symbolsStatus.textContent = 'Cole pelo menos um caractere.';
        return;
      }

      const categoryId = getCustomTargetCategoryId();
      const categoryName = getCustomTargetCategoryName();

      if (!customSymbolCategories[categoryId]) {
        customSymbolCategories[categoryId] = { name: categoryName, symbols: [] };
      } else if (customSymbolCategory.value.trim()) {
        customSymbolCategories[categoryId].name = categoryName;
      }

      const existing = new Set(getAllSymbols());
      let added = 0;

      newSymbols.forEach(sym => {
        if (!existing.has(sym)) {
          customSymbolCategories[categoryId].symbols.push(sym);
          existing.add(sym);
          added++;
        }
      });

      saveCustomSymbols();
      customSymbolsText.value = '';
      customSymbolCategory.value = '';
      renderSymbols();
      symbolCategorySelect.value = categoryId;
      renderSymbols();
      warnIfStorageBlocked(symbolsStatus);
      symbolsStatus.className = added ? 'ok' : 'warn';
      symbolsStatus.textContent = added ? added + ' caractere(s) adicionado(s) em ' + categoryName + '.' : 'Esses caracteres já estavam na lista.';
    }

    function clearCustomSymbols() {
      const ok = confirm('Limpar todos os caracteres personalizados salvos neste navegador?');
      if (!ok) return;
      customSymbolCategories = {};
      saveCustomSymbols();
      renderSymbols();
      symbolsStatus.className = 'ok';
      symbolsStatus.textContent = 'Caracteres personalizados limpos.';
    }

    function populate() {
      styles.filter(style => !style.hidden).forEach(style => {
        const opt = document.createElement('option');
        opt.value = style.id;
        opt.textContent = makeStyleSelectLabel(style);
        opt.title = (style.name || style.id) + ' — ' + describeFontOptions(style);
        styleSelect.appendChild(opt);
      });
      styleSelect.value = 'serif';

      loadCustomSymbols();
      loadQuickBar();
      loadTemplates();
      followCachedDefaults(); // quem nunca mexeu já abre com as configurações padrão do administrador
      renderSymbols();
      renderTemplates();
    }

    // Devolve true se copiou, false se só selecionou o texto e null se não havia texto.
    async function copyResult() {
      const text = input.value;
      if (!text) return null;
      try {
        await navigator.clipboard.writeText(text);
        copyStatus.textContent = 'Texto copiado!';
        return true;
      } catch (e) {
        input.focus();
        input.select();
        copyStatus.textContent = 'Texto selecionado. Copie manualmente.';
        return false;
      }
    }

    function selectResult() {
      input.focus();
      input.select();
      lastFocusedTextField = input;
      rememberInputSelection();
      copyStatus.textContent = 'Texto selecionado.';
    }


    function insertTextMarker() {
      insertTextAtCursor(templateContent, '{texto}');
      templateStatus.className = 'ok';
      templateStatus.textContent = 'Marcador {texto} inserido. Ele será substituído pelo texto selecionado.';
    }

    function saveTemplate() {
      const name = templateName.value.trim() || 'Modelo sem nome';
      const content = templateContent.value;
      const category = cleanTemplateCategoryName(templateCategorySelect.value || DEFAULT_TEMPLATE_CATEGORY);
      const extraCategories = getCheckedExtraCategories();

      if (!content.trim()) {
        templateStatus.className = 'warn';
        templateStatus.textContent = 'Digite o texto do modelo.';
        return;
      }

      // "Criar novo" sempre cria um modelo; "Alterar existente" só muda o modelo escolhido na lista. Os dois nunca se misturam.
      const criado = templateModoEdicao === 'novo';
      let tpl = criado ? null : templates.find(t => t.id === templateSelect.value);
      if (!criado && !tpl) {
        templateStatus.className = 'warn';
        templateStatus.textContent = 'Escolha na lista o modelo que você quer alterar.';
        return;
      }

      templateCategories = uniqueTemplateCategories([...templateCategories, category, ...extraCategories]);

      if (criado) {
        tpl = { id: newId(), name, category, extraCategories, content };
        templates.push(tpl);
      } else {
        tpl.name = name;
        tpl.category = category;
        tpl.extraCategories = extraCategories;
        tpl.content = content;
      }

      saveTemplatesToStorage();
      // Criado: o formulário volta em branco, pronto para outro modelo novo. Alterado: o modelo continua escolhido, com o que ficou guardado.
      if (criado) limparFormularioModelo();
      renderTemplates();
      templateStatus.className = 'ok';
      templateStatus.textContent = criado
        ? '✅ Modelo "' + name + '" criado. Para mudá-lo depois, use "Alterar existente".'
        : '✅ Modelo "' + name + '" salvo.';
      warnIfStorageBlocked(templateStatus);
    }

    async function deleteTemplate() {
      const id = templateSelect.value;
      if (!id) {
        templateStatus.className = 'warn';
        templateStatus.textContent = 'Escolha na lista o modelo que você quer excluir.';
        return;
      }
      const tpl = templates.find(t => t.id === id);
      if (!tpl) {
        templateStatus.className = 'warn';
        templateStatus.textContent = 'Escolha na lista o modelo que você quer excluir.';
        return;
      }
      const ok = await askConfirm('Excluir o modelo "' + tpl.name + '"?', 'Excluir modelo');
      if (!ok) return;

      templates = templates.filter(t => t.id !== id);
      if (!templates.length) templates = cloneData(defaultTemplates);
      templates = validateTemplates(templates);
      saveTemplatesToStorage();
      templateSelect.value = ''; // renderTemplates() mantém a escolha atual; o modelo excluído já não existe: a lista volta a "Escolha o modelo"
      renderTemplates();
      templateStatus.className = 'ok';
      templateStatus.textContent = 'Modelo "' + tpl.name + '" excluído.';
    }

    async function resetTemplates() {
      const ok = await askConfirm('Restaurar os modelos padrão? Isso apaga os modelos e as categorias que você criou ou mudou neste aparelho.', 'Restaurar modelos padrão');
      if (!ok) return;
      templates = validateTemplates(cloneData(defaultTemplates));
      templateCategories = [DEFAULT_TEMPLATE_CATEGORY];
      saveTemplatesToStorage();
      templateSelect.value = '';
      renderTemplates();
      templateStatus.className = 'ok';
      templateStatus.textContent = 'Modelos padrão restaurados.';
    }

    // Publica uma parte das configurações padrão (modelos e categorias, caracteres...) sem mexer no resto: parte sempre do que já está publicado
    // (ou do padrão original do app, se o administrador nunca publicou), troca só o que "alterar" muda e grava de volta. Só o administrador vê
    // os botões; o servidor confere a senha. Os botões 💾 Salvar para todos dos modelos, dos caracteres e da IA usam o mesmo pacote.
    async function publicarParteDoPadrao({ codigo, botao, mensagem, titulo, confirmar, alterar, sucesso }) {
      const ok = await askConfirm(confirmar, titulo);
      if (!ok) return;

      botao.disabled = true;
      mensagem('Salvando...', false);
      try {
        cachedOnlineDefaults = null; // parte sempre da versão publicada mais recente
        const base = await fetchOnlineDefaults();
        const toSave = JSON.parse(JSON.stringify(base));
        alterar(toSave);
        toSave.exportedAt = new Date().toISOString();
        toSave.version = Number(new Date().toISOString().replace(/\D/g, '').slice(0, 12)); // AAAAMMDDhhmm
        const result = await postConfig({ acao: 'padrao-publicar', codigo, dados: toSave });
        if (!result.ok) return mensagem(configErrorMessage(result, 'Não foi possível salvar agora.') + (result.status === 403 ? ' Confira a senha em 🔐 Autorização de acessos.' : ''), true);

        cachedOnlineDefaults = null;
        defaultsOrigin = 'admin';
        savePublishedDefaultsCache(toSave);
        safeSetItem(ONLINE_DEFAULTS_VERSION_STORAGE_KEY, String(toSave.version)); // este aparelho já tem essas configurações
        defaultsInfo.textContent = 'Configurações padrão: definidas pelo administrador agora há pouco.';
        mensagem(sucesso, false);
      } catch (e) {
        mensagem('Não consegui salvar agora: ' + (e && e.message ? e.message : 'erro desconhecido'), true);
      } finally {
        botao.disabled = false;
      }
    }

    // 💾 Salvar para todos (Ajustes → Gerenciar modelos e categorias → Criar ou alterar modelo): publica os modelos e as categorias deste aparelho.
    // As mudanças ainda não salvas no formulário não entram.
    const templatePublicarBtn = document.getElementById('templatePublicarBtn');
    const templatePublicarStatus = document.getElementById('templatePublicarStatus');

    function templatePublicarMensagem(texto, aviso) {
      templatePublicarStatus.className = aviso ? 'warn' : 'ok';
      templatePublicarStatus.textContent = texto;
    }

    function templateFormularioAlterado() {
      const novo = templateModoEdicao === 'novo';
      const tpl = novo ? null : templates.find(t => t.id === templateSelect.value);
      if (!tpl) return novo && Boolean(templateName.value.trim() || templateContent.value.trim());
      const nomes = lista => lista.map(c => cleanTemplateCategoryName(c).toLocaleLowerCase('pt-BR')).sort().join('|');
      return templateName.value.trim() !== String(tpl.name || '').trim()
        || templateContent.value !== String(tpl.content || '')
        || cleanTemplateCategoryName(templateCategorySelect.value) !== cleanTemplateCategoryName(tpl.category)
        || nomes(getCheckedExtraCategories()) !== nomes(Array.isArray(tpl.extraCategories) ? tpl.extraCategories : []);
    }

    async function salvarModelosParaTodos() {
      const codigo = senhaAdminSalva();
      if (!codigo) return templatePublicarMensagem('Para salvar para todos, salve a senha de administrador em 🔐 Autorização de acessos.', true);
      if (templateFormularioAlterado()) return templatePublicarMensagem('Há um modelo no formulário que ainda não foi salvo. Toque em 💾 Criar modelo (ou Salvar alterações) primeiro; depois use Salvar para todos.', true);

      templates = validateTemplates(templates);
      ensureTemplateCategoriesFromTemplates();
      const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
      const resumo = plural(templates.length, 'modelo', 'modelos') + ' e ' + plural(templateCategories.length, 'categoria', 'categorias');
      await publicarParteDoPadrao({
        codigo,
        botao: templatePublicarBtn,
        mensagem: templatePublicarMensagem,
        titulo: 'Salvar para todos',
        confirmar: 'Os modelos e as categorias deste aparelho (' + resumo + ') passam a ser o padrão de todos os usuários. Quem nunca mudou os modelos passa a usá-los; os outros recebem um aviso para aplicar ou mesclar. Caracteres, favoritos e opções da IA padrão não mudam. Deseja continuar?',
        alterar: toSave => {
          toSave.templates = cloneData(templates);
          toSave.templateCategories = templateCategories.slice();
        },
        sucesso: '✅ ' + resumo + ' salvos como padrão para todos os usuários.'
      });
    }

    // 💾 Salvar para todos (Ajustes → Caracteres, ícones e emoticons): publica os caracteres adicionados, os favoritos, a faixa rápida e o tipo de
    // caractere escolhido (a fonte da tela Formatar). Antes isso só saía no "Salvar como padrão de todos" geral, que deixou de existir.
    const symbolsPublicarBtn = document.getElementById('symbolsPublicarBtn');
    const symbolsPublicarStatus = document.getElementById('symbolsPublicarStatus');

    function symbolsPublicarMensagem(texto, aviso) {
      symbolsPublicarStatus.className = aviso ? 'warn' : 'ok';
      symbolsPublicarStatus.textContent = texto;
    }

    async function salvarCaracteresParaTodos() {
      const codigo = senhaAdminSalva();
      if (!codigo) return symbolsPublicarMensagem('Para salvar para todos, salve a senha de administrador em 🔐 Autorização de acessos.', true);
      if (customSymbolsText.value.trim()) return symbolsPublicarMensagem('Há caracteres digitados que ainda não foram adicionados. Toque em ➕ Adicionar caracteres primeiro; depois use Salvar para todos.', true);

      const adicionados = Object.values(customSymbolCategories).reduce((total, categoria) => total + (Array.isArray(categoria && categoria.symbols) ? categoria.symbols.length : 0), 0);
      const fonteAtual = styleSelect.selectedOptions[0] ? styleSelect.selectedOptions[0].textContent.trim() : styleSelect.value;
      await publicarParteDoPadrao({
        codigo,
        botao: symbolsPublicarBtn,
        mensagem: symbolsPublicarMensagem,
        titulo: 'Salvar para todos',
        confirmar: 'Os caracteres que você adicionou (' + adicionados + '), os favoritos (' + favoriteSymbols.length + '), a faixa rápida (' + quickBarSymbols.length + ' emojis) e o tipo de caractere escolhido agora ("' + fonteAtual + '") passam a ser o padrão de todos os usuários. Quem nunca mudou esses itens passa a usá-los; os outros recebem um aviso para aplicar ou mesclar. Modelos, categorias e opções da IA padrão não mudam. Deseja continuar?',
        alterar: toSave => {
          toSave.customSymbolCategories = cloneData(customSymbolCategories);
          toSave.customSymbols = getAllCustomSymbols();
          toSave.favoriteSymbols = favoriteSymbols.slice();
          toSave.quickBar = quickBarSymbols.slice();
          toSave.preferencias = Object.assign({}, toSave.preferencias, { fonte: styleSelect.value });
        },
        sucesso: '✅ Caracteres adicionados (' + adicionados + '), favoritos (' + favoriteSymbols.length + '), faixa rápida e tipo de caractere salvos como padrão para todos os usuários.'
      });
    }


    let cachedOnlineDefaults = null;



    function normalizeDefaultsObject(data) {
      const parsed = data || {};
      const normalizedTemplates = validateTemplates(Array.isArray(parsed.templates) ? parsed.templates : (Array.isArray(parsed) ? parsed : []));
      const categoryList = Array.isArray(parsed.templateCategories) ? parsed.templateCategories : [];

      return {
        templates: normalizedTemplates,
        templateCategories: uniqueTemplateCategories([...categoryList, ...normalizedTemplates.map(t => t.category)]),
        favoriteSymbols: Array.isArray(parsed.favoriteSymbols) ? uniqueTokensFromText(parsed.favoriteSymbols.join(' ')) : [],
        quickBar: Array.isArray(parsed.quickBar) ? cleanQuickBar(parsed.quickBar) : [],
        customSymbolCategories: normalizeSymbolCategories(
          parsed.customSymbolCategories && typeof parsed.customSymbolCategories === 'object' && !Array.isArray(parsed.customSymbolCategories)
            ? parsed.customSymbolCategories
            : (Array.isArray(parsed.customSymbols) ? { personalizados: parsed.customSymbols } : {})
        )
      };
    }

    function mergeTemplates(importedTemplates) {
      const stats = mergeImportedTemplates(importedTemplates);
      return stats.added;
    }

    function mergeTemplateCategories(importedCategories) {
      const before = new Set(templateCategories.map(c => c.toLocaleLowerCase('pt-BR')));
      templateCategories = uniqueTemplateCategories([...templateCategories, ...(importedCategories || [])]);
      let added = 0;
      templateCategories.forEach(c => {
        if (!before.has(c.toLocaleLowerCase('pt-BR'))) added++;
      });
      return added;
    }

    function mergeSymbolCategories(importedCategories) {
      let added = 0;

      Object.entries(normalizeSymbolCategories(importedCategories)).forEach(([categoryId, category]) => {
        if (!customSymbolCategories[categoryId]) {
          customSymbolCategories[categoryId] = { name: category.name, symbols: [] };
        }

        const target = customSymbolCategories[categoryId];
        const existing = new Set(target.symbols);

        category.symbols.forEach(sym => {
          if (!existing.has(sym)) {
            target.symbols.push(sym);
            existing.add(sym);
            added++;
          }
        });
      });

      return added;
    }

    function mergeFavoriteSymbols(importedFavorites) {
      let added = 0;
      importedFavorites.forEach(sym => {
        if (!favoriteSymbols.includes(sym)) {
          favoriteSymbols.push(sym);
          added++;
        }
      });
      return added;
    }


    function hasLocalUserData() {
      return Boolean(
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(TEMPLATE_CATEGORIES_STORAGE_KEY) ||
        localStorage.getItem(CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY) ||
        localStorage.getItem(FAVORITE_SYMBOLS_STORAGE_KEY)
      );
    }

    function applyOnlineDefaultsData(data, mode) {
      const normalized = normalizeDefaultsObject(data);

      if (mode === 'replace') {
        templates = normalized.templates;
        templateCategories = normalized.templateCategories;
        customSymbolCategories = normalized.customSymbolCategories;
        favoriteSymbols = normalized.favoriteSymbols.length ? normalized.favoriteSymbols : defaultFavoriteSymbols.slice();
        quickBarSymbols = normalized.quickBar.length ? normalized.quickBar : defaultQuickBar.slice();
      } else {
        mergeTemplateCategories(normalized.templateCategories);
        mergeTemplates(normalized.templates);
        mergeSymbolCategories(normalized.customSymbolCategories);
        mergeFavoriteSymbols(normalized.favoriteSymbols);
        mergeQuickBar(normalized.quickBar);
      }

      saveTemplatesToStorage();
      saveCustomSymbols();
      saveFavoriteSymbols();
      saveQuickBar();
      applyPreferences(data.preferencias, mode === 'replace');

      if (data.version) {
        safeSetItem(ONLINE_DEFAULTS_VERSION_STORAGE_KEY, String(data.version));
      }

      renderTemplates();
      renderSymbols();
      updateUi();
    }






    // Aceita só chaves conhecidas, com o tipo certo (o JSON padrão vem do servidor e pode ter qualquer coisa).
    function sanitizePreferences(raw) {
      const result = { ia: null, fonte: '' };
      if (!raw || typeof raw !== 'object') return result;

      if (raw.ia && typeof raw.ia === 'object') {
        const ia = {};
        Object.keys(AI_DEFAULT_OPTIONS).forEach(key => {
          const model = AI_DEFAULT_OPTIONS[key];
          const value = raw.ia[key];
          if (typeof model === 'boolean' && typeof value === 'boolean') ia[key] = value;
          else if (typeof model === 'string' && typeof value === 'string') ia[key] = value.slice(0, 300);
        });
        result.ia = ia;
      }

      if (typeof raw.fonte === 'string' && Array.from(styleSelect.options).some(option => option.value === raw.fonte)) {
        result.fonte = raw.fonte;
      }
      return result;
    }

    // overwrite = true: o padrão sobrescreve as escolhas do usuário ("Substituir pelos padrões").
    // overwrite = false: só vale para quem ainda não escolheu nada (abertura do app e "Somar padrões aos meus").
    function applyPreferences(raw, overwrite) {
      const prefs = sanitizePreferences(raw);

      if (prefs.ia) {
        let hasSaved = false;
        try { hasSaved = localStorage.getItem(AI_OPTIONS_KEY) !== null; } catch (e) { /* sem localStorage */ }

        if (overwrite) {
          safeSetItem(AI_OPTIONS_KEY, JSON.stringify(Object.assign({}, AI_DEFAULT_OPTIONS, prefs.ia)));
          aiPublishedDefaults = {};
          loadAiOptions();
        } else if (!hasSaved && !aiOptionsTouched) {
          // Não grava: quem nunca personalizou acompanha o padrão, mesmo quando o administrador o mudar.
          aiPublishedDefaults = prefs.ia;
          loadAiOptions();
        }
      }

      if (prefs.fonte && (overwrite || !fontTouched) && styleSelect.value !== prefs.fonte) {
        styleSelect.value = prefs.fonte;
        updateUi();
      }
    }






    function validateTemplates(list) {
      return (Array.isArray(list) ? list : [])
        .filter(item => item && typeof item.content === 'string')
        .map(normalizeTemplateItem)
        .filter(item => item.content.trim());
    }

    function templateContentKey(content) {
      return String(content || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
    }

    function mergeImportedTemplates(importedTemplates) {
      const byContent = new Set(templates.map(t => templateContentKey(t.content)));
      const byId = new Set(templates.map(t => t.id));
      let added = 0;
      let skipped = 0;

      importedTemplates.forEach(item => {
        const key = templateContentKey(item.content);
        if (!key || byContent.has(key)) {
          skipped++;
          return;
        }

        const template = normalizeTemplateItem(item);
        if (!template.id || byId.has(template.id)) template.id = newId();

        templates.push(template);
        byContent.add(key);
        byId.add(template.id);
        added++;
      });

      return { added, skipped };
    }


    







    document.getElementById('quickBoldBtn').addEventListener('click', () => quickFormat('bold'));
    document.getElementById('quickItalicBtn').addEventListener('click', () => quickFormat('italic'));
    document.getElementById('quickBoldItalicBtn').addEventListener('click', () => quickFormat('boldItalic'));
    document.getElementById('quickDoubleStruckBtn').addEventListener('click', () => quickFont('doubleStruck', 'Double Struck'));
    document.getElementById('quickScriptBtn').addEventListener('click', () => quickFont('script', 'Script'));
    // Fonte CX: o botão do meio aplica a caixa na cor marcada (branca por padrão); a cor fica guardada neste aparelho.
    const CAIXA_COLOR_KEY = 'jwLibraryNoteAplicarCaixaV1';
    const caixaButtons = { white: document.getElementById('quickCaixaWhiteBtn'), black: document.getElementById('quickCaixaBlackBtn') };
    const caixaMainBtn = document.getElementById('quickCaixaBtn');
    let caixaColor = 'white';
    try { if (localStorage.getItem(CAIXA_COLOR_KEY) === 'black') caixaColor = 'black'; } catch (e) { /* sem localStorage: fica a branca */ }

    function setCaixaColor(color, save) {
      caixaColor = color === 'black' ? 'black' : 'white';
      Object.keys(caixaButtons).forEach(key => caixaButtons[key].setAttribute('aria-pressed', key === caixaColor ? 'true' : 'false'));
      const name = caixaColor === 'black' ? 'Caixa preta' : 'Caixa branca';
      caixaMainBtn.title = 'Aplicar a fonte ' + name + ' ao trecho selecionado (letras maiúsculas)';
      caixaMainBtn.setAttribute('aria-label', 'Aplicar a fonte ' + name + ' ao trecho selecionado');
      if (save) safeSetItem(CAIXA_COLOR_KEY, caixaColor);
    }

    Object.keys(caixaButtons).forEach(key => caixaButtons[key].addEventListener('click', () => setCaixaColor(key, true)));
    caixaMainBtn.addEventListener('click', () => (caixaColor === 'black' ? quickFont('squaredDark', 'Caixa preta') : quickFont('squaredLight', 'Caixa branca')));
    setCaixaColor(caixaColor, false);
    document.getElementById('removeFormattingBtn').addEventListener('click', removeFormattingFromSelection);
    document.getElementById('indentBtn').addEventListener('click', () => applyIndentToSelection(1));
    document.getElementById('clearBtn').addEventListener('click', () => {
      // Passa pelo setInputRange para que o Ctrl+Z também traga o texto apagado de volta.
      setInputRange(0, input.value.length, '', { message: 'Texto apagado. Use Desfazer para voltar.' });
      clearAiMessages();
    });
    ['undoBtn','quickBoldBtn','quickItalicBtn','quickBoldItalicBtn','quickDoubleStruckBtn','quickScriptBtn','quickCaixaWhiteBtn','quickCaixaBtn','quickCaixaBlackBtn','removeFormattingBtn','indentBtn','copyBtn','selectBtn'].forEach(id => {
      const btn = document.getElementById(id);
      btn.addEventListener('mousedown', event => event.preventDefault());
      btn.addEventListener('pointerdown', event => event.preventDefault());
    });

    document.getElementById('copyBtn').addEventListener('click', copyResult);

    // Botões do topo (só aparecem no celular): repassam para os originais e confirmam no próprio botão,
    // já que a mensagem de "copiado" fica lá embaixo, fora da vista.
    const copyTopBtn = document.getElementById('copyTopBtn');
    const copyTopLabel = copyTopBtn.innerHTML;
    document.getElementById('undoBtn').addEventListener('click', undoLastChange);
    document.getElementById('undoTopBtn').addEventListener('click', undoLastChange);
    document.getElementById('clearTopBtn').addEventListener('click', () => document.getElementById('clearBtn').click());
    copyTopBtn.addEventListener('click', async () => {
      const result = await copyResult();
      if (result === null) return;
      copyTopBtn.textContent = result ? '✓ Copiado' : '✓ Selecionado';
      setTimeout(() => { copyTopBtn.innerHTML = copyTopLabel; }, 1800);
    });
    document.getElementById('selectBtn').addEventListener('click', selectResult);

    templateCategorySelect.addEventListener('change', () => renderExtraCategoryCheckboxes(getCheckedExtraCategories()));
    templateExtraCategories.addEventListener('change', updateExtraCategoriesSummary);
    templateModoNovoBtn.addEventListener('click', () => setTemplateMode('novo'));
    templateModoAlterarBtn.addEventListener('click', () => setTemplateMode('alterar'));
    document.getElementById('insertTextMarkerBtn').addEventListener('click', insertTextMarker);
    saveTemplateBtn.addEventListener('click', saveTemplate);
    deleteTemplateBtn.addEventListener('click', deleteTemplate);
    document.getElementById('resetTemplatesBtn').addEventListener('click', resetTemplates);
    templatePublicarBtn.addEventListener('click', salvarModelosParaTodos);
    addTemplateCategoryBtn.addEventListener('click', addTemplateCategory);
    deleteTemplateCategoryBtn.addEventListener('click', deleteTemplateCategory);
    renameTemplateCategoryBtn.addEventListener('click', renameTemplateCategory);
    categoryManageSelect.addEventListener('change', updateDeleteTemplateCategoryButton);
    categoryModoNovaBtn.addEventListener('click', () => setCategoryMode('nova'));
    categoryModoAlterarBtn.addEventListener('click', () => setCategoryMode('alterar'));
    templateCategoryFilter.addEventListener('change', renderTemplates);

    // ---------- Administrador: chamadas ao servidor e página de prompts da IA ----------
    const CONFIG_ENDPOINT = '/api/config';

    // Devolve { ok, status, data, unavailable, error }. O código de administrador é conferido no servidor.
    async function postConfig(payload) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(CONFIG_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        let data = null;
        try { data = await response.json(); } catch (e) { /* resposta sem JSON */ }
        return { ok: response.ok && !!data, status: response.status, data, unavailable: response.status === 404 || response.status === 501 };
      } catch (e) {
        return { ok: false, status: 0, data: null, error: e && e.name === 'AbortError' ? 'timeout' : 'rede' };
      } finally {
        clearTimeout(timer);
      }
    }

    function configErrorMessage(result, fallback) {
      if (result.unavailable) return 'Esta função só existe no site publicado (notestyle.com.br).';
      if (result.error === 'timeout') return 'O servidor demorou demais. Tente de novo.';
      if (result.error === 'rede') return 'Falha de conexão com o servidor.';
      return (result.data && result.data.erro) || fallback;
    }

    // Busca no servidor os limites de tamanho configurados pelo administrador (sem eles, valem os padrões acima).
    async function loadPublicLimits() {
      try {
        const result = await postConfig({ acao: 'limites-ler' });
        const limits = result.ok && result.data ? result.data.limites : null;
        if (!limits) return;
        const pick = (value, current) => (Number.isInteger(value) && value > 0 ? value : current);
        AI_MAX_CHARS = pick(limits.maxCharsFormatacao, AI_MAX_CHARS);
        AI_MAX_LINES = pick(limits.maxLinhasFormatacao, AI_MAX_LINES);
        AI_SENTINELA_MAX_CHARS = pick(limits.maxCharsSentinela, AI_SENTINELA_MAX_CHARS);
        AI_SENTINELA_MAX_LINES = pick(limits.maxLinhasSentinela, AI_SENTINELA_MAX_LINES);
        AI_STUDY_MAX_PARAGRAPHS = pick(limits.maxParagrafosEstudo, AI_STUDY_MAX_PARAGRAPHS);
        const joiasQtd = document.getElementById('joiasQtd'); // Joias Espirituais: "até N por capítulo" (limite configurado)
        if (joiasQtd && Number.isInteger(limits.maxJoiasPorCapitulo) && limits.maxJoiasPorCapitulo > 0) joiasQtd.textContent = String(limits.maxJoiasPorCapitulo);
      } catch (e) { /* sem servidor: ficam os padrões */ }
    }

    const promptsSection = document.getElementById('promptsSection');
    const promptsLogin = document.getElementById('promptsLogin');
    const promptsEditor = document.getElementById('promptsEditor');
    const promptsLoginError = document.getElementById('promptsLoginError');
    const promptsStatus = document.getElementById('promptsStatus');
    const promptsList = document.getElementById('promptsList');
    const promptsLocked = document.getElementById('promptsLocked');
    const promptsSaveBtn = document.getElementById('promptsSaveBtn');
    const promptsUndoBtn = document.getElementById('promptsUndoBtn');
    const promptsResetAllBtn = document.getElementById('promptsResetAllBtn');
    let promptsState = null;   // última resposta do servidor
    let promptsCode = '';      // a senha salva em Autorização de acessos, depois de aceita pelo servidor

    // Prompts da IA abre para baixo em Ajustes (como as outras opções). Enquanto os dados chegam, a linha fica esmaecida.
    // Sem a senha, ou se o servidor recusar, aparece o aviso de área restrita dentro da própria seção.
    // Com a senha salva: não mostra o botão "Abrir Autorização de acessos" enquanto busca; se já carregou nesta sessão, reabre na hora (como Voz e Esboços).
    let promptsAbrindo = false;
    // Ao cancelar "descartar e fechar", reabrimos a seção sem disparar um novo carregamento (que apagaria as edições).
    let promptsIgnorarProximoToggle = false;
    function limparPromptsAoFechar() {
      promptsCode = '';
      promptsState = null;
      promptsList.textContent = '';
      document.getElementById('promptsLimits').textContent = '';
      promptsLocked.textContent = '';
      promptsLogin.hidden = true;
      promptsEditor.hidden = true;
      promptsLoginError.textContent = '';
      promptsStatus.textContent = '';
      document.getElementById('promptsStatusBottom').textContent = '';
    }

    function promptsDescartarEdicaoLocal() {
      if (!promptsState) {
        limparPromptsAoFechar();
        return;
      }
      renderPrompts(promptsState);
      setPromptsStatus('', false);
      iaCarregar(); // repõe modelo/esforço se o administrador tinha mudado sem salvar
    }

    async function carregarPromptsAoAbrir() {
      if (promptsAbrindo) return;
      const code = senhaAdminSalva();
      if (!code) {
        promptsLogin.hidden = false;
        promptsEditor.hidden = true;
        loginPrompts('', null);
        return;
      }
      // Já entrou nesta sessão com a mesma senha: mostra na hora, sem nova ida ao servidor.
      if (promptsState && promptsCode === code) {
        promptsLogin.hidden = true;
        promptsEditor.hidden = false;
        return;
      }
      // Com senha: esconde o aviso de acesso; a seção fica só esmaecida até os prompts chegarem.
      promptsLogin.hidden = true;
      promptsEditor.hidden = true;
      promptsLoginError.textContent = '';
      promptsStatus.textContent = '';
      document.getElementById('promptsStatusBottom').textContent = '';
      adminCodeNote.value = '';
      delete adminCodeNote.dataset.loaded;
      adminCodeStatus.textContent = '';
      adminCodeDirNote.value = '';
      delete adminCodeDirNote.dataset.loaded;
      adminCodeDirStatus.textContent = '';
      adminCodeLeituraNote.value = '';
      delete adminCodeLeituraNote.dataset.loaded;
      adminCodeLeituraStatus.textContent = '';
      adminCodeS34Note.value = '';
      delete adminCodeS34Note.dataset.loaded;
      adminCodeS34Status.textContent = '';
      promptsEditor.querySelectorAll('details').forEach(card => { card.open = false; });
      promptsAbrindo = true;
      promptsSection.setAttribute('aria-busy', 'true');
      let result = null;
      try { result = await postConfig({ acao: 'prompts-ler', codigo: code }); } finally {
        promptsAbrindo = false;
        promptsSection.removeAttribute('aria-busy');
      }
      if (!promptsSection.open) return; // fechou enquanto carregava
      loginPrompts(code, result);
    }

    // Textos que o administrador mudou na tela e ainda não salvou: { id: texto }.
    function promptsPendingChanges() {
      const changes = {};
      if (!promptsState) return changes;
      promptsList.querySelectorAll('textarea[data-prompt-id]').forEach(area => {
        const part = promptsState.partes.find(p => p.id === area.dataset.promptId);
        if (part && area.value.trim() !== part.valor.trim()) changes[part.id] = area.value;
      });
      return changes;
    }

    function confirmDiscardPrompts() {
      if (!promptsTemPendencia()) return Promise.resolve(true);
      return askConfirm('Há alterações que ainda não foram salvas. Voltar mesmo assim?', 'Voltar sem salvar');
    }

    // Limites numéricos mudados na tela e ainda não salvos: { id: número }.
    function promptsPendingLimits() {
      const changes = {};
      if (!promptsState || !Array.isArray(promptsState.limites)) return changes;
      promptsState.limites.forEach(limit => {
        const field = document.querySelector('input[data-limit-id="' + limit.id + '"]');
        if (!field) return;
        const value = Number(field.value);
        if (field.value.trim() !== '' && value !== limit.valor) changes[limit.id] = value;
      });
      return changes;
    }

    function promptsHasPending() {
      return Object.keys(promptsPendingChanges()).length > 0 || Object.keys(promptsPendingLimits()).length > 0;
    }

    // Há algo para salvar: prompts, limites ou o modelo/esforço da IA (💾 Salvar para todos salva tudo de uma vez).
    function promptsTemPendencia() {
      return promptsHasPending() || iaPendente();
    }

    // A mensagem aparece no alto da seção e também logo abaixo dos botões de salvar, onde o olhar está ao clicar.
    function setPromptsStatus(message, isError) {
      const bottom = document.getElementById('promptsStatusBottom');
      promptsStatus.className = isError ? 'warn' : 'ok';
      promptsStatus.textContent = message;
      bottom.className = (isError ? 'warn' : 'ok') + ' prompts-status-bottom';
      bottom.textContent = message;
    }

    // Todos os limites numéricos numa caixa só: um campo por limite, com a faixa aceita e o padrão do app.
    // Cartão recolhível da tela de prompts: título no summary (o resto vai dentro do details).
    function promptCard(className, titulo, aberto) {
      const box = document.createElement('details');
      box.className = 'prompt-item ' + className;
      box.open = Boolean(aberto);
      const summary = document.createElement('summary');
      const title = document.createElement('h3');
      title.textContent = titulo;
      summary.appendChild(title);
      box.appendChild(summary);
      return { box, title };
    }

    function renderLimits(state) {
      const holder = document.getElementById('promptsLimits');
      const aberto = Boolean(holder.querySelector('details[open]'));
      holder.textContent = '';
      const limits = state.limites || [];
      if (!limits.length) return;

      const { box } = promptCard('prompt-tint-limits', '🔢 Limites (números)', aberto);
      const intro = document.createElement('p');
      intro.className = 'hint';
      intro.textContent = 'Valem para todos os usuários. Nos prompts, {{max_textos}}, {{max_destaques}} e {{max_joias}} são trocados pelos números abaixo.';
      box.append(intro);

      const fields = [];
      limits.forEach(limit => {
        const label = document.createElement('label');
        label.textContent = limit.titulo;
        const field = document.createElement('input');
        field.type = 'number';
        field.inputMode = 'numeric';
        field.min = String(limit.min);
        field.max = String(limit.max);
        field.step = '1';
        field.value = String(limit.valor);
        field.dataset.limitId = limit.id;
        label.htmlFor = 'limit-' + limit.id;
        field.id = 'limit-' + limit.id;
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = limit.descricao + ' (De ' + limit.min + ' a ' + limit.max + '. Padrão do app: ' + limit.padrao + '.)';

        // Passo de cada toque: 1 nas faixas curtas, maior nas longas (ex.: 1000 em 1000 caracteres).
        const range = limit.max - limit.min;
        const stepBy = range <= 20 ? 1 : range <= 100 ? 5 : range <= 1000 ? 10 : range <= 5000 ? 100 : range <= 20000 ? 500 : 1000;
        const nudge = direction => {
          const current = Number(field.value);
          const base = Number.isFinite(current) ? current : limit.padrao;
          const next = direction > 0 ? (Math.floor(base / stepBy) + 1) * stepBy : (Math.ceil(base / stepBy) - 1) * stepBy;
          field.value = String(Math.min(limit.max, Math.max(limit.min, next)));
        };
        const makeStepBtn = (text, label, direction) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'secondary ai-week-nav';
          btn.textContent = text;
          btn.setAttribute('aria-label', label + ' ' + limit.titulo);
          btn.addEventListener('click', () => nudge(direction));
          return btn;
        };
        const inputWrap = document.createElement('div');
        inputWrap.className = 'ai-study-input';
        inputWrap.appendChild(field);
        const row = document.createElement('div');
        row.className = 'ai-study-picker limit-picker';
        row.append(makeStepBtn('−', 'Diminuir', -1), inputWrap, makeStepBtn('+', 'Aumentar', 1));

        box.append(label, row, hint);
        fields.push({ field, limit });
      });

      const defaultsBtn = document.createElement('button');
      defaultsBtn.type = 'button';
      defaultsBtn.className = 'secondary';
      defaultsBtn.textContent = 'Usar o padrão em todos os limites';
      defaultsBtn.addEventListener('click', () => { fields.forEach(item => { item.field.value = String(item.limit.padrao); }); });
      const actions = document.createElement('div');
      actions.className = 'prompt-item-actions';
      actions.appendChild(defaultsBtn);
      box.appendChild(actions);

      holder.appendChild(box);
    }

    // Agrupa as partes editáveis nas categorias do servidor (na ordem dele). Parte que não está em nenhuma vai para "OUTROS".
    function promptsAgrupadas(state) {
      const porId = new Map(state.partes.map(part => [part.id, part]));
      const grupos = (state.categorias || []).map(cat => ({ cat, partes: (cat.partes || []).map(id => porId.get(id)).filter(Boolean) }));
      const soltas = state.partes.filter(part => !grupos.some(grupo => grupo.partes.includes(part)));
      if (soltas.length) grupos.push({ cat: { id: 'outros', emoji: '🧰', titulo: 'OUTROS', cor: '#64748b' }, partes: soltas });
      return grupos.filter(grupo => grupo.partes.length);
    }

    // Categoria da tela de prompts: bloco recolhível com o emoji, o nome em maiúsculas e a quantidade de prompts.
    function promptCategoria(cat, quantidade, aberta) {
      const box = document.createElement('details');
      box.className = 'prompt-cat';
      box.dataset.cat = cat.id;
      box.open = Boolean(aberta);
      box.style.setProperty('--cat-cor', cat.cor || '#64748b');
      const summary = document.createElement('summary');
      const titulo = document.createElement('h2');
      titulo.textContent = (cat.emoji ? cat.emoji + ' ' : '') + cat.titulo;
      const qtd = document.createElement('span');
      qtd.className = 'prompt-cat-qtd';
      qtd.textContent = String(quantidade);
      qtd.setAttribute('aria-label', quantidade + (quantidade === 1 ? ' prompt' : ' prompts'));
      summary.append(titulo, qtd);
      const corpo = document.createElement('div');
      corpo.className = 'prompt-cat-corpo';
      if (cat.descricao) {
        const descricao = document.createElement('p');
        descricao.className = 'hint';
        descricao.textContent = cat.descricao;
        corpo.appendChild(descricao);
      }
      box.append(summary, corpo);
      return { box, corpo };
    }

    // Um prompt editável: cartão recolhível com a descrição, o texto e os botões.
    function promptPartCard(part, aberto) {
      const { box } = promptCard('prompt-parte', part.titulo, aberto);
      box.dataset.part = part.id;
      // O que foi salvo para todos é o padrão oficial do app: não há aviso de "personalizado". O botão abaixo só volta ao
      // texto que veio de fábrica com o app (e só fica ativo quando o texto salvo é outro).

      const description = document.createElement('p');
      description.className = 'hint prompt-descricao';
      description.textContent = part.descricao;

      const area = document.createElement('textarea');
      area.dataset.promptId = part.id;
      area.value = part.valor;
      area.spellcheck = false;
      area.setAttribute('aria-label', part.titulo);

      const actions = document.createElement('div');
      actions.className = 'prompt-item-actions';

      const count = document.createElement('span');
      count.className = 'prompt-count';
      const updateCount = () => { count.textContent = area.value.length + ' caracteres'; };
      area.addEventListener('input', updateCount);
      updateCount();

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'secondary';
      restoreBtn.textContent = 'Voltar ao texto original';
      restoreBtn.disabled = !part.personalizado;
      restoreBtn.addEventListener('click', () => restorePrompt(part));

      const resetViewBtn = document.createElement('button');
      resetViewBtn.type = 'button';
      resetViewBtn.className = 'secondary';
      resetViewBtn.textContent = 'Descartar edição';
      resetViewBtn.addEventListener('click', () => { area.value = part.valor; updateCount(); });

      actions.append(count, resetViewBtn, restoreBtn);
      box.append(description, area, actions);
      return box;
    }

    function renderPrompts(state) {
      promptsState = state;
      // Ao salvar ou restaurar, a lista é refeita: as categorias e os cartões que estavam abertos continuam abertos.
      const abertos = new Set([...promptsList.querySelectorAll('details[open][data-part]')].map(card => card.dataset.part));
      const categoriasAbertas = new Set([...promptsList.querySelectorAll('details.prompt-cat[open]')].map(box => box.dataset.cat));
      promptsList.textContent = '';
      // A anotação do código só é preenchida ao entrar; depois quem manda é o que o administrador digitou.
      if (!adminCodeNote.dataset.loaded) {
        adminCodeNote.value = typeof state.anotacao === 'string' ? state.anotacao : '';
        adminCodeNote.dataset.loaded = '1';
      }
      if (!adminCodeDirNote.dataset.loaded) {
        adminCodeDirNote.value = typeof state.anotacaoDirigente === 'string' ? state.anotacaoDirigente : '';
        adminCodeDirNote.dataset.loaded = '1';
      }
      if (!adminCodeLeituraNote.dataset.loaded) {
        adminCodeLeituraNote.value = typeof state.anotacaoLeitura === 'string' ? state.anotacaoLeitura : '';
        adminCodeLeituraNote.dataset.loaded = '1';
      }
      if (!adminCodeS34Note.dataset.loaded) {
        adminCodeS34Note.value = typeof state.anotacaoS34 === 'string' ? state.anotacaoS34 : '';
        adminCodeS34Note.dataset.loaded = '1';
      }
      renderLimits(state);

      promptsAgrupadas(state).forEach(({ cat, partes }) => {
        const { box, corpo } = promptCategoria(cat, partes.length, categoriasAbertas.has(cat.id));
        partes.forEach(part => corpo.appendChild(promptPartCard(part, abertos.has(part.id))));
        promptsList.appendChild(box);
      });

      promptsLocked.textContent = '';
      document.getElementById('catTecnicaQtd').textContent = String(state.travados.length);
      state.travados.forEach(item => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = item.titulo;
        const pre = document.createElement('pre');
        pre.textContent = item.texto;
        details.append(summary, pre);
        promptsLocked.appendChild(details);
      });

      promptsUndoBtn.disabled = !state.temAnterior;
      promptsResetAllBtn.disabled = !state.armazenamento.escrita;
      promptsSalvarHabilitado(state.armazenamento.escrita);
      if (!state.armazenamento.escrita) {
        setPromptsStatus('O armazenamento (Global Config) ainda não está configurado para gravar no servidor: dá para ler, mas não salvar.', true);
      } else {
        // Partes em que o Git já trouxe melhorias de qualidade: se o Global Config ainda tem texto antigo,
        // ele manda no lugar do padrão. O botão "Voltar ao texto original" de cada cartão restaura.
        const QUALIDADE = {
          voz: 'Voz das respostas',
          regras_resposta: 'Formatação das respostas',
          contexto_congregacao: 'Sobre mim e a congregação',
          frases_pedidos: 'Pedidos (outra sugestão / melhorar)',
          perguntas: 'Perguntas adicionais (Sentinela)',
          texto_diario: 'Comentários do texto diário',
          ebc_dirigente: 'Perguntas do EBC (dirigente)'
        };
        const divergentes = (state.partes || []).filter(p => p.personalizado && QUALIDADE[p.id]);
        if (divergentes.length) {
          setPromptsStatus(
            '⚠️ ' + divergentes.length + ' parte(s) de qualidade diferem do texto que veio com esta versão do app (o que está salvo no servidor vale para todos). Revise ou use “Voltar ao texto original”: ' +
            divergentes.map(p => QUALIDADE[p.id] || p.titulo).join('; ') + '.',
            true
          );
        } else {
          setPromptsStatus('', false);
        }
      }
    }

    // Entra com a senha de administrador salva em Autorização de acessos.
    function loginPrompts(code, result) {
      if (!code) {
        promptsLoginError.textContent = 'Para ver e editar os prompts, salve a senha de administrador em 🔐 Autorização de acessos.';
        promptsLogin.hidden = false;
        promptsEditor.hidden = true;
        return;
      }
      if (!result || !result.ok) {
        promptsLogin.hidden = false;
        promptsEditor.hidden = true;
        promptsLoginError.textContent = configErrorMessage(result || {}, 'Não foi possível entrar agora.') + (result && result.status === 403 ? ' Confira a senha em 🔐 Autorização de acessos.' : '');
        return;
      }
      promptsCode = code;
      iaCarregar();
      promptsLoginError.textContent = '';
      promptsLogin.hidden = true;
      promptsEditor.hidden = false;
      setPromptsStatus('', false);
      renderPrompts(result.data);
    }

    // Os dois botões 💾 Salvar para todos (cartão do modelo e fim da página) ligam e desligam juntos.
    function promptsSalvarHabilitado(habilitado) {
      promptsSaveBtn.disabled = !habilitado;
      document.getElementById('iaSalvarBtn').disabled = !habilitado;
    }

    async function sendPromptsAction(payload, successMessage) {
      promptsSalvarHabilitado(false);
      promptsUndoBtn.disabled = true;
      setPromptsStatus('Enviando...', false);
      const result = await postConfig(Object.assign({ codigo: promptsCode }, payload));
      if (!result.ok) {
        setPromptsStatus(configErrorMessage(result, 'Não foi possível concluir agora.'), true);
        if (promptsState) {
          promptsSalvarHabilitado(promptsState.armazenamento.escrita);
          promptsUndoBtn.disabled = !promptsState.temAnterior;
        }
        return false;
      }
      renderPrompts(result.data);
      setPromptsStatus(successMessage, false);
      return true;
    }

    // 💾 Salvar para todos: salva de uma vez o que estiver pendente (prompts, limites e/ou modelo e esforço da IA). Os dois
    // botões (cartão do modelo e fim da página) fazem a mesma coisa; a mensagem aparece nos dois lugares.
    let salvandoParaTodos = false;
    function avisoDeSalvar(mensagem, aviso) {
      setPromptsStatus(mensagem, aviso);
      iaMensagem(mensagem, aviso);
    }

    async function salvarParaTodos() {
      if (salvandoParaTodos) return;
      const textos = promptsHasPending();
      const modelo = iaPendente();
      if (!textos && !modelo) return avisoDeSalvar('Nada foi alterado.', false);
      salvandoParaTodos = true;
      try {
        if (textos) {
          const ok = await sendPromptsAction(
            { acao: 'prompts-salvar', alteracoes: promptsPendingChanges(), limites: promptsPendingLimits() },
            modelo ? 'Prompts salvos. Salvando o modelo…' : '✅ Alterações salvas com sucesso! Valem para todos os usuários em poucos segundos.'
          );
          if (!ok) return avisoDeSalvar(promptsStatus.textContent, true); // o servidor recusou: nada mais é enviado
        }
        if (modelo) {
          const r = await iaSalvarModelo();
          if (!r.ok) return avisoDeSalvar((textos ? 'Os prompts foram salvos, mas o modelo não: ' : '') + r.erro, true);
        }
        avisoDeSalvar(
          textos && modelo ? '✅ Prompts, limites e modelo da IA salvos! Valem para todos os usuários em poucos segundos.'
            : modelo ? '✅ Salvo. O novo modelo vale para todos em poucos segundos.'
            : '✅ Alterações salvas com sucesso! Valem para todos os usuários em poucos segundos.',
          false
        );
      } finally {
        salvandoParaTodos = false;
      }
    }

    async function restorePrompt(part) {
      const ok = await askConfirm('Voltar "' + part.titulo + '" ao texto original que veio com o app, para todos os usuários? O texto salvo será substituído.', 'Voltar ao texto original');
      if (!ok) return;
      await sendPromptsAction({ acao: 'prompts-restaurar', id: part.id }, '✅ Texto original do app restaurado para todos os usuários.');
    }

    // ---------- Memória de lições: lista, desativar e apagar ----------
    const memoriaStatus = document.getElementById('memoriaStatus');
    const memoriaLista = document.getElementById('memoriaLista');
    const memoriaLigadaCx = document.getElementById('memoriaLigada');

    function memoriaRender(memoria) {
      memoriaLigadaCx.checked = memoria.ligada;
      memoriaLista.textContent = '';
      document.getElementById('memoriaApagarTudoBtn').disabled = !memoria.itens.length;
      if (!memoria.itens.length) {
        memoriaStatus.textContent = 'Nenhuma lição guardada ainda.';
        return;
      }
      memoriaStatus.textContent = memoria.itens.length + ' lição(ões) guardada(s).';
      memoria.itens.forEach(i => {
        const caixa = document.createElement('div');
        caixa.className = 'memoria-item' + (i.ativo ? '' : ' inativa');
        const titulo = document.createElement('h4');
        titulo.textContent = (i.tarefa || 'Tarefa não informada') + ' · ' + i.tipoAlteracao.replace(/_/g, ' ') + ' · ' + new Date(i.criadoEm).toLocaleDateString('pt-BR');
        const mudou = document.createElement('p');
        mudou.textContent = 'O que mudou: ' + i.oQueMudou;
        const porque = document.createElement('p');
        porque.textContent = 'Por quê: ' + i.porQue;
        const regra = document.createElement('p');
        regra.textContent = 'Regra: ' + i.regra;
        regra.style.fontWeight = '700';
        const linha = document.createElement('div');
        linha.className = 'button-row';
        const ativar = document.createElement('button');
        ativar.type = 'button';
        ativar.className = 'secondary';
        ativar.textContent = i.ativo ? '⏸️ Desativar' : '▶️ Ativar';
        ativar.addEventListener('click', () => memoriaAcao({ acao: 'memoria-ativar', id: i.id, ativo: !i.ativo }));
        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.className = 'secondary';
        apagar.textContent = '🗑️ Apagar';
        apagar.addEventListener('click', async () => {
          if (await askConfirm('Apagar esta lição da memória?', 'Apagar')) memoriaAcao({ acao: 'memoria-apagar', id: i.id });
        });
        linha.append(ativar, apagar);
        caixa.append(titulo, mudou, porque, regra, linha);
        memoriaLista.appendChild(caixa);
      });
    }

    async function memoriaAcao(payload) {
      if (!promptsCode) return;
      memoriaStatus.textContent = 'Enviando...';
      const r = await postConfig(Object.assign({ codigo: promptsCode }, payload));
      if (!r.ok) {
        memoriaStatus.textContent = (r.data && r.data.erro) || 'Não foi possível concluir agora.';
        return;
      }
      memoriaRender(r.data.memoria);
    }

    document.getElementById('memoriaBox').addEventListener('toggle', e => { if (e.target.open) memoriaAcao({ acao: 'memoria-ler' }); });
    document.getElementById('memoriaAtualizarBtn').addEventListener('click', () => memoriaAcao({ acao: 'memoria-ler' }));
    memoriaLigadaCx.addEventListener('change', () => memoriaAcao({ acao: 'memoria-ligar', ligada: memoriaLigadaCx.checked }));
    document.getElementById('memoriaApagarTudoBtn').addEventListener('click', async () => {
      if (await askConfirm('Apagar TODAS as lições guardadas na memória? Não dá para desfazer.', 'Apagar todas')) memoriaAcao({ acao: 'memoria-apagar-tudo' });
    });

    async function restoreAllPrompts() {
      const ok = await askConfirm('Voltar TODOS os textos dos prompts ao padrão que veio com o app, para todos os usuários? Os textos salvos serão substituídos (os limites e o modelo da IA não mudam). Dá para desfazer em "Voltar à versão anterior".', 'Restaurar todos os padrões');
      if (!ok) return;
      await sendPromptsAction({ acao: 'prompts-restaurar-tudo' }, '✅ Todos os prompts voltaram ao padrão do app, para todos os usuários.');
    }

    async function undoPrompts() {
      const ok = await askConfirm('Voltar todos os prompts à versão anterior à última alteração salva?', 'Voltar à versão anterior');
      if (!ok) return;
      await sendPromptsAction({ acao: 'prompts-desfazer' }, '✅ Versão anterior restaurada para todos os usuários.');
    }

    // Todo o conteúdo da tela num texto só, na ordem em que aparece: limites, prompts editáveis (como estão na tela,
    // inclusive alterações ainda não salvas) e a parte técnica. Serve para ler com calma ou colar no Word.
    function buildPromptsExport() {
      if (!promptsState) return '';
      const line = '='.repeat(60);
      const thin = '-'.repeat(60);
      const out = [];
      const pending = promptsHasPending();

      out.push('PROMPTS DA IA - NoteStyle');
      out.push('Exportado em ' + new Date().toLocaleString('pt-BR') + (pending ? ' (inclui alterações ainda não salvas)' : ''));
      out.push('');

      const limits = promptsState.limites || [];
      if (limits.length) {
        out.push(line, 'LIMITES (NÚMEROS)', line, '');
        limits.forEach(limit => {
          const field = document.querySelector('input[data-limit-id="' + limit.id + '"]');
          const value = field && field.value.trim() !== '' ? field.value.trim() : String(limit.valor);
          out.push('* ' + limit.titulo + ': ' + value + ' (padrão ' + limit.padrao + '; faixa de ' + limit.min + ' a ' + limit.max + ')');
          out.push('  ' + limit.descricao);
        });
        out.push('');
      }

      out.push(line, 'PROMPTS (TOM E REGRAS)', line);
      let numero = 0;
      promptsAgrupadas(promptsState).forEach(({ cat, partes }) => {
        out.push('', '#### ' + (cat.emoji ? cat.emoji + ' ' : '') + cat.titulo + ' ####');
        partes.forEach(part => {
          numero++;
          const area = document.querySelector('textarea[data-prompt-id="' + part.id + '"]');
          const text = area ? area.value : part.valor;
          const edited = text.trim() !== part.valor.trim();
          out.push('', numero + '. ' + part.titulo + (edited ? '  [alterado, ainda não salvo]' : '  [padrão do app]'), thin);
          if (part.descricao) out.push('Para que serve: ' + part.descricao, '');
          out.push(text.trim());
        });
      });

      const locked = promptsState.travados || [];
      if (locked.length) {
        out.push('', '', line, 'PARTE TÉCNICA (SOMENTE LEITURA, NÃO EDITÁVEL)', line);
        locked.forEach((item, index) => {
          out.push('', (index + 1) + '. ' + item.titulo, thin, item.texto.trim());
        });
      }
      return out.join('\n') + '\n';
    }

    // ---------- Anotação do código de pesquisa (só o administrador vê) ----------
    const adminCodeNote = document.getElementById('adminCodeNote');
    const adminCodeStatus = document.getElementById('adminCodeStatus');
    const adminCodeDirNote = document.getElementById('adminCodeDirNote');
    const adminCodeDirStatus = document.getElementById('adminCodeDirStatus');
    const adminCodeLeituraNote = document.getElementById('adminCodeLeituraNote');
    const adminCodeLeituraStatus = document.getElementById('adminCodeLeituraStatus');
    const adminCodeS34Note = document.getElementById('adminCodeS34Note');
    const adminCodeS34Status = document.getElementById('adminCodeS34Status');

    function setAdminCodeStatus(message, isWarning) {
      adminCodeStatus.className = isWarning ? 'warn' : 'ok';
      adminCodeStatus.textContent = message;
    }

    document.getElementById('adminCodeCopyBtn').addEventListener('click', async () => {
      const text = adminCodeNote.value.trim();
      if (!text) return setAdminCodeStatus('O campo está vazio.', true);
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        adminCodeNote.focus();
        adminCodeNote.select();
        try { document.execCommand('copy'); } catch (e2) { return setAdminCodeStatus('Não foi possível copiar. Selecione e copie manualmente.', true); }
      }
      setAdminCodeStatus('✅ Código copiado.', false);
    });

    document.getElementById('adminCodeSaveBtn').addEventListener('click', async () => {
      setAdminCodeStatus('Salvando...', false);
      const result = await postConfig({ acao: 'anotacao-salvar', codigo: promptsCode, anotacao: adminCodeNote.value });
      if (!result.ok) return setAdminCodeStatus(configErrorMessage(result, 'Não foi possível salvar agora.'), true);
      adminCodeNote.value = result.data.anotacao || '';
      if (promptsState) promptsState.anotacao = adminCodeNote.value;
      setAdminCodeStatus('✅ Anotação salva.', false);
    });

    // ---------- Anotação do código do dirigente (igual à do código de pesquisa) ----------
    function setAdminCodeDirStatus(message, isWarning) {
      adminCodeDirStatus.className = isWarning ? 'warn' : 'ok';
      adminCodeDirStatus.textContent = message;
    }

    document.getElementById('adminCodeDirCopyBtn').addEventListener('click', async () => {
      const text = adminCodeDirNote.value.trim();
      if (!text) return setAdminCodeDirStatus('O campo está vazio.', true);
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        adminCodeDirNote.focus();
        adminCodeDirNote.select();
        try { document.execCommand('copy'); } catch (e2) { return setAdminCodeDirStatus('Não foi possível copiar. Selecione e copie manualmente.', true); }
      }
      setAdminCodeDirStatus('✅ Código copiado.', false);
    });

    document.getElementById('adminCodeDirSaveBtn').addEventListener('click', async () => {
      setAdminCodeDirStatus('Salvando...', false);
      const result = await postConfig({ acao: 'anotacao-dirigente-salvar', codigo: promptsCode, anotacao: adminCodeDirNote.value });
      if (!result.ok) return setAdminCodeDirStatus(configErrorMessage(result, 'Não foi possível salvar agora.'), true);
      adminCodeDirNote.value = result.data.anotacao || '';
      if (promptsState) promptsState.anotacaoDirigente = adminCodeDirNote.value;
      setAdminCodeDirStatus('✅ Anotação salva.', false);
    });

    // ---------- Anotação do código de leitura (igual às outras) ----------
    function setAdminCodeLeituraStatus(message, isWarning) {
      adminCodeLeituraStatus.className = isWarning ? 'warn' : 'ok';
      adminCodeLeituraStatus.textContent = message;
    }

    document.getElementById('adminCodeLeituraCopyBtn').addEventListener('click', async () => {
      const text = adminCodeLeituraNote.value.trim();
      if (!text) return setAdminCodeLeituraStatus('O campo está vazio.', true);
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        adminCodeLeituraNote.focus();
        adminCodeLeituraNote.select();
        try { document.execCommand('copy'); } catch (e2) { return setAdminCodeLeituraStatus('Não foi possível copiar. Selecione e copie manualmente.', true); }
      }
      setAdminCodeLeituraStatus('✅ Código copiado.', false);
    });

    document.getElementById('adminCodeLeituraSaveBtn').addEventListener('click', async () => {
      setAdminCodeLeituraStatus('Salvando...', false);
      const result = await postConfig({ acao: 'anotacao-leitura-salvar', codigo: promptsCode, anotacao: adminCodeLeituraNote.value });
      if (!result.ok) return setAdminCodeLeituraStatus(configErrorMessage(result, 'Não foi possível salvar agora.'), true);
      adminCodeLeituraNote.value = result.data.anotacao || '';
      if (promptsState) promptsState.anotacaoLeitura = adminCodeLeituraNote.value;
      setAdminCodeLeituraStatus('✅ Anotação salva.', false);
    });

    // ---------- Anotação do código do S-34 (igual às outras) ----------
    function setAdminCodeS34Status(message, isWarning) {
      adminCodeS34Status.className = isWarning ? 'warn' : 'ok';
      adminCodeS34Status.textContent = message;
    }

    document.getElementById('adminCodeS34CopyBtn').addEventListener('click', async () => {
      const text = adminCodeS34Note.value.trim();
      if (!text) return setAdminCodeS34Status('O campo está vazio.', true);
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        adminCodeS34Note.focus();
        adminCodeS34Note.select();
        try { document.execCommand('copy'); } catch (e2) { return setAdminCodeS34Status('Não foi possível copiar. Selecione e copie manualmente.', true); }
      }
      setAdminCodeS34Status('✅ Código copiado.', false);
    });

    document.getElementById('adminCodeS34SaveBtn').addEventListener('click', async () => {
      setAdminCodeS34Status('Salvando...', false);
      const result = await postConfig({ acao: 'anotacao-s34-salvar', codigo: promptsCode, anotacao: adminCodeS34Note.value });
      if (!result.ok) return setAdminCodeS34Status(configErrorMessage(result, 'Não foi possível salvar agora.'), true);
      adminCodeS34Note.value = result.data.anotacao || '';
      if (promptsState) promptsState.anotacaoS34 = adminCodeS34Note.value;
      setAdminCodeS34Status('✅ Anotação salva.', false);
    });

    async function copyAllPrompts() {
      const text = buildPromptsExport();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setPromptsStatus('✅ Todos os prompts copiados. É só colar (Ctrl+V) no Word ou em outro documento.', false);
      } catch (e) {
        setPromptsStatus('Não foi possível copiar. Use o botão de baixar o arquivo de texto.', true);
      }
    }

    function downloadAllPrompts() {
      const text = buildPromptsExport();
      if (!text) return;
      // O BOM no início faz o Word e o Bloco de Notas lerem os acentos corretamente; as quebras de linha viram as do Windows.
      const blob = new Blob(['\ufeff' + text.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'prompts-ia-notestyle-' + new Date().toISOString().slice(0, 10) + '.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPromptsStatus('✅ Arquivo de texto gerado com todos os prompts.', false);
    }

    document.getElementById('promptsCopyAllBtn').addEventListener('click', copyAllPrompts);
    document.getElementById('promptsDownloadBtn').addEventListener('click', downloadAllPrompts);
    // Tocar em "Prompts da IA" (Ajustes) abre a seção para baixo, como as outras opções.
    promptsSection.addEventListener('toggle', async () => {
      if (promptsIgnorarProximoToggle) {
        promptsIgnorarProximoToggle = false;
        return;
      }
      if (promptsSection.open) {
        await carregarPromptsAoAbrir();
        return;
      }
      if (promptsTemPendencia()) {
        if (!(await confirmDiscardPrompts())) {
          promptsIgnorarProximoToggle = true;
          promptsSection.open = true; // o usuário cancelou: mantém aberta sem recarregar
          return;
        }
        promptsDescartarEdicaoLocal(); // desfaz a edição e mantém o último carregamento para reabrir na hora
        return;
      }
      // Sem pendência: não limpa — a próxima abertura reusa o que já veio do servidor.
    });
    // Sem a senha salva (ou recusada): leva a Autorização de acessos (a seção de prompts continua aberta).
    document.getElementById('promptsIrAcessosBtn').addEventListener('click', () => abrirAcessos('senha'));
    promptsSaveBtn.addEventListener('click', salvarParaTodos);
    promptsUndoBtn.addEventListener('click', undoPrompts);
    promptsResetAllBtn.addEventListener('click', restoreAllPrompts);

    // ---------- Modelo da IA de texto e gasto com ela (tela de prompts) ----------
    // O administrador escolhe o modelo e o esforço da IA para todos (api/_iaConfig.mjs). O gasto do mês vem da Cost API
    // da Anthropic, quando há uma chave de administrador da Anthropic na Vercel (ANTHROPIC_ADMIN_KEY).
    const iaModelo = document.getElementById('iaModelo');
    const iaEsforco = document.getElementById('iaEsforco');
    const iaModeloPreco = document.getElementById('iaModeloPreco');
    const iaStatus = document.getElementById('iaStatus');
    const iaCusto = document.getElementById('iaCusto');
    let iaOpcoes = null;
    const iaDolares = valor => 'US$ ' + Number(valor || 0).toFixed(2).replace('.', ',');
    const iaPreco = valor => String(valor).replace('.', ',');

    function iaMensagem(texto, aviso) {
      iaStatus.className = aviso ? 'warn' : 'ok';
      iaStatus.textContent = texto;
    }

    function iaMostrarPreco() {
      const modelos = iaOpcoes ? iaOpcoes.modelos : [];
      const m = modelos.find(x => x.id === iaModelo.value);
      if (!m) return (iaModeloPreco.textContent = '');
      const vezes = Math.round(m.saida / modelos[0].saida);
      iaModeloPreco.textContent = 'Preço: US$ ' + iaPreco(m.entrada) + ' por milhão de tokens lidos e US$ ' + iaPreco(m.saida) + ' por milhão de tokens escritos'
        + (vezes > 1 ? ' (cerca de ' + vezes + ' vezes o Haiku 5.5).' : ' (o mais barato).');
    }

    async function iaCarregar() {
      iaMensagem('Carregando…', false);
      const r = await postConfig({ acao: 'ia-ler', codigo: promptsCode });
      if (!r.ok) return iaMensagem(configErrorMessage(r, 'Não foi possível carregar o modelo da IA.'), true);
      iaOpcoes = r.data.opcoes;
      [[iaModelo, iaOpcoes.modelos], [iaEsforco, iaOpcoes.esforcos]].forEach(([select, itens]) => {
        select.textContent = '';
        itens.forEach(item => {
          const op = document.createElement('option');
          op.value = item.id;
          op.textContent = item.nome;
          select.appendChild(op);
        });
      });
      iaModelo.value = r.data.config.modelo;
      iaEsforco.value = r.data.config.esforco;
      iaSalvo = { modelo: r.data.config.modelo, esforco: r.data.config.esforco };
      iaMostrarPreco();
      iaMensagem(r.data.armazenamento && !r.data.armazenamento.escrita ? 'O armazenamento do servidor ainda não permite salvar.' : '', true);
      iaCarregarCusto();
    }

    // Modelo e esforço como estão salvos no servidor (para saber se a escolha na tela mudou).
    let iaSalvo = null;
    function iaPendente() {
      return Boolean(iaSalvo && iaOpcoes && (iaModelo.value !== iaSalvo.modelo || iaEsforco.value !== iaSalvo.esforco));
    }

    // Envia o modelo e o esforço escolhidos; quem chama (salvarParaTodos) mostra a mensagem.
    async function iaSalvarModelo() {
      const r = await postConfig({ acao: 'ia-salvar', codigo: promptsCode, config: { modelo: iaModelo.value, esforco: iaEsforco.value } });
      if (!r.ok) return { ok: false, erro: configErrorMessage(r, 'Não foi possível salvar agora.') };
      iaModelo.value = r.data.config.modelo;
      iaEsforco.value = r.data.config.esforco;
      iaSalvo = { modelo: r.data.config.modelo, esforco: r.data.config.esforco };
      iaMostrarPreco();
      return { ok: true };
    }

    async function iaCarregarCusto() {
      iaCusto.textContent = 'Consultando o gasto na Anthropic…';
      const r = await postConfig({ acao: 'ia-custo', codigo: promptsCode });
      iaCusto.textContent = '';
      const paragrafo = (texto, classe) => {
        const p = document.createElement('p');
        if (classe) p.className = classe;
        p.textContent = texto;
        iaCusto.appendChild(p);
        return p;
      };
      if (!r.ok) return paragrafo(configErrorMessage(r, 'Não consegui consultar o gasto agora.'), 'warn');
      if (!r.data.configurado) {
        paragrafo('O gasto com a IA de texto aparece no Claude Console, pelo link abaixo.', 'hint');
        return;
      }
      const desde = r.data.desde.split('-').reverse().slice(0, 2).join('/');
      const resumo = paragrafo('', '');
      resumo.append('Este mês (desde ' + desde + '): ');
      const total = document.createElement('strong');
      total.textContent = iaDolares(r.data.mes);
      resumo.append(total, ' · Hoje: ' + iaDolares(r.data.hoje));
      if (r.data.porModelo.length) {
        const lista = document.createElement('ul');
        r.data.porModelo.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item.modelo + ': ' + iaDolares(item.valor);
          lista.appendChild(li);
        });
        iaCusto.appendChild(lista);
      }
      const hora = new Date(r.data.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      paragrafo('Valores da Anthropic, em dólares, consultados às ' + hora + '. Cada uso aparece uns 5 minutos depois.', 'hint');
    }

    iaModelo.addEventListener('change', iaMostrarPreco);
    document.getElementById('iaSalvarBtn').addEventListener('click', salvarParaTodos);
    document.getElementById('iaCustoBtn').addEventListener('click', iaCarregarCusto);

    // ---------- Configurações padrão (valem para todos os usuários) ----------
    // O administrador publica o padrão pelos botões 💾 Salvar para todos (modelos e categorias; caracteres, favoritos e faixa rápida; opções da
    // IA), cada um só com a sua parte; tudo vai para um pacote só, guardado no Global Config da Vercel (via /api/config). Cada usuário o aplica
    // ou o mescla com as suas configurações. Sem arquivos para importar ou exportar.
    const defaultsInfo = document.getElementById('defaultsInfo');
    const defaultsStatus = document.getElementById('defaultsStatus');
    let defaultsOrigin = 'original';

    // Quem nunca alterou modelos, categorias, caracteres ou favoritos acompanha as configurações padrão do administrador:
    // elas entram só na memória (nada é gravado no aparelho) e, por isso, mudam junto quando o administrador salva uma
    // versão nova. Cada grupo é independente: alterou os favoritos? Os modelos continuam acompanhando o padrão. Assim
    // que o usuário altera um grupo, o app grava o que está na tela e ele passa a ter o seu.
    const PUBLISHED_DEFAULTS_CACHE_KEY = 'jwLibraryNoteAplicarPublishedDefaultsV1';

    function storageHasKey(key) {
      try { return localStorage.getItem(key) !== null; } catch (e) { return true; } // sem acesso ao armazenamento: não mexe em nada
    }

    // Devolve true se algum grupo passou a usar o padrão.
    function followDefaults(rawData) {
      const data = normalizeDefaultsObject(rawData);
      let changed = false;

      if (!storageHasKey(STORAGE_KEY) && !storageHasKey(TEMPLATE_CATEGORIES_STORAGE_KEY) && data.templates.length) {
        templates = data.templates;
        templateCategories = data.templateCategories;
        changed = true;
      }
      if (!storageHasKey(CUSTOM_SYMBOL_CATEGORIES_STORAGE_KEY) && !storageHasKey(SYMBOLS_STORAGE_KEY) && Object.keys(data.customSymbolCategories).length) {
        customSymbolCategories = data.customSymbolCategories;
        changed = true;
      }
      if (!storageHasKey(FAVORITE_SYMBOLS_STORAGE_KEY) && data.favoriteSymbols.length) {
        favoriteSymbols = data.favoriteSymbols;
        changed = true;
      }
      if (!storageHasKey(QUICKBAR_STORAGE_KEY) && data.quickBar.length) {
        quickBarSymbols = data.quickBar;
        changed = true;
      }
      return changed;
    }

    // Guarda uma cópia das configurações padrão do administrador para o app já abrir com elas, mesmo sem internet.
    function savePublishedDefaultsCache(rawData) {
      safeSetItem(PUBLISHED_DEFAULTS_CACHE_KEY, JSON.stringify(rawData));
    }

    function followCachedDefaults() {
      try {
        const cached = JSON.parse(localStorage.getItem(PUBLISHED_DEFAULTS_CACHE_KEY) || 'null');
        if (cached && typeof cached === 'object') followDefaults(cached);
      } catch (e) { /* cópia ilegível: o app usa os modelos que já tem */ }
    }

    function setDefaultsStatus(message, isWarning) {
      defaultsStatus.className = isWarning ? 'warn' : 'ok';
      defaultsStatus.textContent = message;
    }

    function describeDefaults(data) {
      if (defaultsOrigin !== 'admin') return 'Configurações padrão: as originais do app.';
      const when = data && data.exportedAt ? new Date(data.exportedAt) : null;
      const date = when && !isNaN(when)
        ? ' em ' + when.toLocaleDateString('pt-BR') + ' às ' + when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';
      return 'Configurações padrão: definidas pelo administrador' + date + '.';
    }

    // Primeiro as configurações salvas pelo administrador (no servidor); sem elas, as originais que acompanham o app.
    async function fetchOnlineDefaults() {
      try {
        const published = await postConfig({ acao: 'padrao-ler' });
        const publishedData = published.ok ? published.data.dados : null;
        if (publishedData) {
          const normalizedPublished = normalizeDefaultsObject(publishedData);
          if (normalizedPublished.templates.length || Object.keys(normalizedPublished.customSymbolCategories).length) {
            cachedOnlineDefaults = publishedData;
            defaultsOrigin = 'admin';
            return publishedData;
          }
        }
      } catch (e) { /* sem servidor ou sem configurações salvas: usa as originais */ }

      const candidates = [new URL('defaults.json', location.href).href, location.origin + '/defaults.json'];
      let lastError = '';

      for (const url of [...new Set(candidates)]) {
        try {
          // O navegador revalida com ETag e só baixa de novo quando o arquivo muda de verdade.
          const response = await fetch(url, { cache: 'no-cache' });
          if (!response.ok) {
            lastError = 'HTTP ' + response.status;
            continue;
          }

          let data;
          try {
            data = JSON.parse(await response.text());
          } catch (e) {
            lastError = 'as configurações padrão originais não são válidas.';
            continue;
          }

          const normalized = normalizeDefaultsObject(data);
          if (!normalized.templates.length && !Object.keys(normalized.customSymbolCategories).length) {
            lastError = 'as configurações padrão originais estão vazias.';
            continue;
          }

          cachedOnlineDefaults = data;
          defaultsOrigin = 'original';
          return data;
        } catch (e) {
          lastError = e && e.message ? e.message : 'falha desconhecida.';
        }
      }

      throw new Error(lastError || 'Não foi possível carregar as configurações padrão.');
    }

    // Ao abrir o app: quem nunca escolheu opções da IA ou o tipo de caractere já acompanha o padrão, e o app avisa se há
    // configurações padrão mais novas. Modelos, categorias, caracteres e favoritos só mudam por escolha do usuário.
    async function autoCheckOnlineDefaultsOnStart() {
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

      try {
        const data = await fetchOnlineDefaults();
        applyPreferences(data.preferencias, false);
        defaultsInfo.textContent = describeDefaults(data);

        // Configurações do administrador: quem nunca mexeu em modelos, caracteres ou favoritos já passa a usá-las.
        if (defaultsOrigin === 'admin') {
          savePublishedDefaultsCache(data);
          if (followDefaults(data)) {
            renderTemplates();
            renderSymbols();
            updateUi();
          }
        }

        // O JSON traz a versão como número e o localStorage devolve texto: sem normalizar, 4 !== '4'.
        const latestVersion = String(data.version || '');
        const lastAppliedVersion = String(localStorage.getItem(ONLINE_DEFAULTS_VERSION_STORAGE_KEY) || '');
        if (hasLocalUserData() && latestVersion && latestVersion !== lastAppliedVersion) {
          setDefaultsStatus('Há configurações padrão mais recentes. Use "Aplicar" ou "Mesclar".', true);
        }
      } catch (e) {
        defaultsInfo.textContent = 'Não consegui verificar as configurações padrão agora.';
      }
    }

    // Aplicar: troca tudo pelas configurações padrão. Mesclar: só acrescenta o que o usuário ainda não tem.
    async function useDefaults(mode) {
      try {
        if (mode === 'replace') {
          const ok = await askConfirm(
            'Isso troca os seus modelos, categorias, caracteres, favoritos e as opções da IA pelas configurações padrão. Deseja continuar?',
            'Aplicar configurações padrão'
          );
          if (!ok) return;
        }

        cachedOnlineDefaults = null; // sempre a versão mais recente
        const rawData = await fetchOnlineDefaults();
        defaultsInfo.textContent = describeDefaults(rawData);

        if (mode === 'replace') {
          applyOnlineDefaultsData(rawData, 'replace');
          setDefaultsStatus('✅ Configurações padrão aplicadas.', false);
          return;
        }

        const data = normalizeDefaultsObject(rawData);
        const addedCategories = mergeTemplateCategories(data.templateCategories);
        const addedTemplates = mergeTemplates(data.templates);
        const addedSymbols = mergeSymbolCategories(data.customSymbolCategories);
        const addedFavorites = mergeFavoriteSymbols(data.favoriteSymbols);
        mergeQuickBar(data.quickBar);

        saveTemplatesToStorage();
        saveCustomSymbols();
        saveFavoriteSymbols();
        saveQuickBar();
        applyPreferences(rawData.preferencias, false);
        if (rawData.version) safeSetItem(ONLINE_DEFAULTS_VERSION_STORAGE_KEY, String(rawData.version));

        renderTemplates();
        renderSymbols();
        updateUi();

        setDefaultsStatus(
          '✅ Configurações padrão mescladas com as suas: ' + addedTemplates + ' modelo(s), ' + addedCategories + ' categoria(s), ' +
          addedSymbols + ' caractere(s) e ' + addedFavorites + ' favorito(s) acrescentados.',
          false
        );
      } catch (e) {
        setDefaultsStatus('Não consegui carregar as configurações padrão: ' + (e && e.message ? e.message : 'erro desconhecido'), true);
      }
    }

    // 💾 Salvar para todos (Ajustes → Configurar formatação com IA): publica só as opções de formatação com IA deste aparelho
    // como padrão de todos. O resto do padrão (modelos, categorias, caracteres e favoritos) fica como já está publicado
    // (ou como vem no app, se o administrador nunca publicou). Só o administrador vê o botão; o servidor confere a senha.
    const aiSalvarPadraoBtn = document.getElementById('aiSalvarPadraoBtn');
    const aiSalvarPadraoStatus = document.getElementById('aiSalvarPadraoStatus');

    function aiPadraoAtualizar() {
      document.getElementById('aiPadraoBox').hidden = !senhaAdminSalva();
    }

    function aiPadraoMensagem(texto, aviso) {
      aiSalvarPadraoStatus.className = aviso ? 'warn' : 'ok';
      aiSalvarPadraoStatus.textContent = texto;
    }

    async function salvarOpcoesIaParaTodos() {
      const codigo = senhaAdminSalva();
      if (!codigo) return aiPadraoMensagem('Para salvar para todos, salve a senha de administrador em 🔐 Autorização de acessos.', true);
      const ok = await askConfirm(
        'As opções de formatação com IA deste aparelho (caixas marcadas, tamanho do resumo, categoria, quantidade de sugestões e instruções fixas) passam a ser o padrão de todos os usuários. Quem nunca mudou as próprias opções passa a usá-las; os outros recebem um aviso. Os modelos, caracteres e favoritos padrão não mudam. Deseja continuar?',
        'Salvar para todos'
      );
      if (!ok) return;

      aiSalvarPadraoBtn.disabled = true;
      aiPadraoMensagem('Salvando...', false);
      try {
        cachedOnlineDefaults = null; // parte sempre da versão publicada mais recente
        const base = await fetchOnlineDefaults();
        const toSave = JSON.parse(JSON.stringify(base));
        toSave.preferencias = Object.assign({}, toSave.preferencias, { ia: readAiOptions() });
        toSave.exportedAt = new Date().toISOString();
        toSave.version = Number(new Date().toISOString().replace(/\D/g, '').slice(0, 12)); // AAAAMMDDhhmm
        const result = await postConfig({ acao: 'padrao-publicar', codigo, dados: toSave });
        if (!result.ok) return aiPadraoMensagem(configErrorMessage(result, 'Não foi possível salvar agora.') + (result.status === 403 ? ' Confira a senha em 🔐 Autorização de acessos.' : ''), true);

        cachedOnlineDefaults = null;
        defaultsOrigin = 'admin';
        savePublishedDefaultsCache(toSave);
        safeSetItem(ONLINE_DEFAULTS_VERSION_STORAGE_KEY, String(toSave.version)); // este aparelho já tem essas opções
        defaultsInfo.textContent = 'Configurações padrão: definidas pelo administrador agora há pouco.';
        aiPadraoMensagem('✅ Opções de formatação salvas como padrão para todos os usuários.', false);
      } catch (e) {
        aiPadraoMensagem('Não consegui salvar agora: ' + (e && e.message ? e.message : 'erro desconhecido'), true);
      } finally {
        aiSalvarPadraoBtn.disabled = false;
      }
    }
    aiSalvarPadraoBtn.addEventListener('click', salvarOpcoesIaParaTodos);

    document.getElementById('applyDefaultsBtn').addEventListener('click', () => useDefaults('replace'));
    document.getElementById('mergeDefaultsBtn').addEventListener('click', () => useDefaults('merge'));
    symbolsPublicarBtn.addEventListener('click', salvarCaracteresParaTodos);

    symbolCategorySelect.addEventListener('change', renderSymbols);
    document.getElementById('resetFavoriteSymbolsBtn').addEventListener('click', resetFavoriteSymbols);
    document.getElementById('saveCustomSymbolsBtn').addEventListener('click', addCustomSymbols);
    document.getElementById('clearCustomSymbolsBtn').addEventListener('click', clearCustomSymbols);
    templateSelect.addEventListener('change', loadSelectedTemplateIntoEditor);

    input.addEventListener('focus', event => { rememberFocusedField(event); rememberInputSelection(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        event.preventDefault();
        applyIndentToSelection(event.shiftKey ? -1 : 1);
      }
    });
    templateContent.addEventListener('focus', rememberFocusedField);
    customSymbolsText.addEventListener('focus', rememberFocusedField);
    newTemplateCategoryName.addEventListener('focus', rememberFocusedField);
    categoryRenameName.addEventListener('focus', rememberFocusedField);

    document.querySelectorAll('.option-btn[data-case]').forEach(btn => {
      btn.addEventListener('mousedown', event => event.preventDefault());
      btn.addEventListener('pointerdown', event => event.preventDefault());
      btn.addEventListener('click', () => applyCaseToSelection(btn.dataset.case, true));
    });

    document.querySelectorAll('.option-btn[data-list]').forEach(btn => {
      btn.addEventListener('mousedown', event => event.preventDefault());
      btn.addEventListener('pointerdown', event => event.preventDefault());
      btn.addEventListener('click', () => applyListToSelection(btn.dataset.list));
    });

    ['input', 'select', 'keyup', 'mouseup'].forEach(evt => {
      input.addEventListener(evt, () => {
        rememberInputSelection();
        scheduleUiRefresh();
      });
    });

    // No iPhone/Safari não existe alcinha para arrastar e redimensionar o
    // textarea manualmente, então o campo cresce sozinho conforme o texto
    // aumenta (a altura mínima do CSS continua valendo como piso).
    function autoGrowInputText() {
      // Campo escondido (outra tela, ex.: Backup): a medida daria zero e o campo ficaria travado pequeno. A altura é
      // recalculada quando a tela com o campo aparece (showScreen).
      if (!input.getClientRects().length) return;
      // Para medir, o campo encolhe (height: auto) e a página fica mais curta por um instante: com o campo longo e a tela lá embaixo, o
      // navegador puxa a rolagem para cima e, quando o campo volta ao tamanho, a tela continua no alto (a cada letra digitada, e a cada
      // toque no campo com o teclado abrindo, a tela voltava para o começo do texto). A rolagem da página é devolvida depois da medida.
      const pagina = document.scrollingElement || document.documentElement;
      const rolagem = pagina.scrollTop;
      input.style.height = 'auto';
      // scrollHeight não conta a moldura; sem somá-la sobra uma rolagem interna de poucos pixels.
      const frame = input.offsetHeight - input.clientHeight;
      input.style.height = (input.scrollHeight + frame) + 'px';
      if (pagina.scrollTop !== rolagem) pagina.scrollTop = rolagem;
    }
    input.addEventListener('input', autoGrowInputText);
    // Digitação: guarda o texto de antes quando começa uma sequência (pausa de mais de 1 s), não a cada letra.
    input.addEventListener('beforeinput', event => {
      if (undoWriting || /^history/.test(event.inputType || '')) return;
      const now = Date.now();
      if (now - undoTypingAt > 1000) pushUndo(input.value);
      undoTypingAt = now;
    });
    input.addEventListener('scroll', () => scheduleAnswerButtons());
    window.addEventListener('resize', () => scheduleAnswerButtons());
    window.addEventListener('load', autoGrowInputText);
    window.addEventListener('resize', autoGrowInputText);
    input.addEventListener('touchend', () => setTimeout(() => {
      rememberInputSelection();
      scheduleUiRefresh();
    }, 80));

    let fontTouched = false; // o usuário já escolheu um tipo de caractere nesta sessão
    styleSelect.addEventListener('change', event => {
      if (event.isTrusted) fontTouched = true;
      updateUi();
    });
    document.getElementById('applyStyleBtn').addEventListener('click', () => {
      applySelectedStyleToSelection(true);
    });

    // ---------- Sugestões de formatação com IA ----------
    // O texto vai para a função serverless /api/sugerir-formatacao (a chave da IA fica só no servidor).
    // As sugestões nunca alteram o texto sozinhas: cada uma precisa de "Aplicar".
    const aiSuggestBtn = document.getElementById('aiSuggestBtn');
    const aiSentinelaBtn = document.getElementById('aiSentinelaBtn');
    const aiAnotherBtn = document.getElementById('aiAnotherBtn');
    const aiImproveBtn = document.getElementById('aiImproveBtn');
    const aiRefineBox = document.getElementById('aiRefineBox');
    const aiStatus = document.getElementById('aiStatus');
    const aiStudyAnswerStatus = document.getElementById('aiStudyAnswerStatus');
    const leaderAnswerStatus = document.getElementById('leaderAnswerStatus');
    const leaderStudyStatus = document.getElementById('leaderStudyStatus');
    const aiResults = document.getElementById('aiResults');
    const aiProgress = document.getElementById('aiProgress');
    const aiIntensity = document.getElementById('aiIntensity');
    const aiCategory = document.getElementById('aiCategory');
    const aiSummarySize = document.getElementById('aiSummarySize');
    const aiSection = document.getElementById('aiSection');
    const aiInstruction = document.getElementById('aiInstruction');
    const aiOptionInputs = Array.from(document.querySelectorAll('[data-ai-opt]'));
    const AI_ENDPOINT = '/api/sugerir-formatacao';
    // Com a senha de administrador salva no aparelho, o pedido a leva junto: só assim o servidor usa a memória de lições do piloto.
    function corpoIa(payload) {
      const admin = senhaAdminSalva();
      let corpo = admin ? Object.assign({}, payload, { codigoAdmin: admin }) : payload;
      // As tarefas do discurso público (lista de temas, esboço original e esboço com IA) também levam o código do S-34.
      if (corpo && typeof corpo.tarefa === 'string' && /^publico(-|$)/.test(corpo.tarefa)) corpo = Object.assign({}, corpo, { codigoS34: codigoS34Salvo() });
      return JSON.stringify(corpo);
    }
    // Espera máxima por uma resposta da IA: os modelos mais potentes (escolhidos na tela de prompts) podem levar alguns
    // minutos; o servidor desiste antes disso (a função da Vercel vai até 300 s).
    const IA_ESPERA_MS = 290000;
    const AI_OPTIONS_KEY = 'jwLibraryNoteAplicarAiOptionsV1';
    // Limites de tamanho do texto enviado à IA: valem estes até o servidor informar os configurados pelo administrador.
    let AI_MAX_CHARS = 4000;
    let AI_MAX_LINES = 80;
    let AI_SENTINELA_MAX_CHARS = 12000;
    let AI_SENTINELA_MAX_LINES = 200;
    let AI_STUDY_MAX_PARAGRAPHS = 5; // parágrafos do estudo por consulta (o administrador muda na tela dos prompts)
    const AI_STYLE_KIND = { negrito: 'bold', italico: 'italic', negrito_italico: 'boldItalic' };
    const AI_FONTS = ['doubleStruck', 'sans', 'squaredDark']; // as únicas fontes decorativas que a IA pode usar
    const AI_DEFAULT_OPTIONS = {
      usarModelos: true, negrito: true, italico: false, negritoItalico: false, maiusculas: false, variarFontes: false,
      emoji: false, usarListas: false, separarIdeias: false, separarFrases: false, resumo: false, intensidade: 'moderada', instrucao: '', categoria: 'all', resumoTamanho: 'medio',
      consultarBiblia: false, transcreverSemCitar: false, citarTextos: false, explicarTextos: false, perguntasTextos: false, perguntasEntendimento: true,
      perguntasComplementares: true, perguntasAplicativas: true
    };

    // Opções padrão publicadas pelo administrador (valem para quem nunca salvou as suas) e se o usuário já mexeu nelas
    // nesta sessão (nesse caso o padrão que chega depois não as sobrescreve).
    let aiPublishedDefaults = {};
    let aiOptionsTouched = false;

    let aiSuggestions = [];   // sugestões exibidas (já resolvidas contra os modelos locais)
    let aiResumo = null;      // { texto, done, kind } quando a IA devolve um resumo ('resumo') ou respostas da Sentinela ('sentinela')
    const aiOutput = document.getElementById('aiOutput');
    const aiOutputHome = document.getElementById('aiOutputHome');
    const sentinelaOutputSlot = document.getElementById('sentinelaOutputSlot');
    // Abre a seção e todas as seções que a contêm (ex.: o grupo "Opções com IA").
    function openWithAncestors(details) {
      const screen = screenOf(details);
      if (screen && screen !== currentScreen()) showScreen(screen, { keepScroll: true });
      for (let box = details; box; box = box.parentElement && box.parentElement.closest('details')) box.open = true;
      reunioesMostrarDe(details); // na tela Reuniões em páginas, abre a página que tem esse item
    }

    // Ao abrir o app, todos os cards recolhíveis começam fechados (pedido do usuário): o app não lembra mais quais
    // ficaram abertos. Apaga o que versões anteriores guardaram sobre isso.
    try {
      ['principaisBox', 'outrasOpcoesBox', 'opcoesIaBox', 'textosBiblicosBox', 'resumoTextosBox', 'secaoReunioes', 'grupoComentarios',
        'grupoDirigir', 'secaoDiscursos', 'grupoDiscursos'].forEach(id => localStorage.removeItem('jwLibraryNoteAplicarGroup_' + id));
      ['jwLibraryNoteAplicarSentinelaBoxV1', 'jwLibraryNoteAplicarDirigenteBoxV1', 'jwLibraryNoteAplicarAiBoxV1'].forEach(key => localStorage.removeItem(key));
    } catch (e) { /* sem localStorage */ }
    // Exceção: no computador (tela larga, com o campo de texto e as opções lado a lado) as Opções principais de formatação já abrem
    // expandidas; no celular e em telas estreitas continuam recolhidas. Só vale ao abrir o app: depois disso a escolha é do usuário.
    try {
      if (window.matchMedia && matchMedia('(min-width: 980px)').matches) document.getElementById('principaisBox').open = true;
    } catch (e) { /* sem matchMedia */ }

    // O bloco da IA fica direto dentro do grupo "Opções com IA" (sem card próprio recolhível).
    const opcoesIaGroup = document.getElementById('opcoesIaBox');

    // Status, resultados e botões de aplicar/refinar aparecem junto ao botão que o usuário acabou de usar:
    // na área do texto para a formatação e no card da Sentinela para as respostas do estudo.
    function placeAiOutput(slot) {
      if (slot && aiOutput.parentElement !== slot) slot.appendChild(aiOutput);
    }

    // Os botões Outra resposta / Melhorar esta resposta ficam logo abaixo do "Salvar alterações", junto do texto que
    // eles refazem, seja qual for a tela em que o pedido foi feito. Só a formatação com IA os mantém na área das sugestões.
    function placeRefineBox() {
      if (aiLastKind === 'format') {
        if (aiRefineBox.parentElement !== aiOutput) aiOutput.appendChild(aiRefineBox);
      } else if (aiRefineBox.previousElementSibling !== salvarBloco) {
        salvarBloco.after(aiRefineBox);
      }
    }

    let aiLastKind = 'format'; // último pedido feito: 'format', 'sentinela', 'estudo', 'ebc', 'ebcdir', 'joias', 'tesouros', 'discurso', 'publico' ou 'outros' (define o que "Outra sugestão/Melhorar" refazem)
    let aiSentinelaRaw = [];  // itens crus das respostas da Sentinela, reenviados ao refinar
    let aiRaw = [];           // resposta crua da IA, reenviada ao pedir "outra" ou "melhorar"
    let aiBaseText = '';      // texto antes de qualquer sugestão ser aplicada (para desfazer)
    let aiAppliedAny = false;
    let aiAppliedSnapshot = null; // texto logo depois de colar as respostas do estudo: refazer não precisa perguntar se ele não foi editado
    // Contexto do pedido da resposta que está no campo (parágrafos e artigo, quadros marcados…): "Outra resposta" e "Melhorar" refazem o MESMO
    // pedido, mesmo que as caixas da tela tenham mudado depois ou que a resposta tenha vindo de Pesquisas e respostas salvas.
    let aiRefino = null;
    const aiRefinoDe = kind => (aiRefino && aiRefino.kind === kind ? aiRefino : null);
    let aiBusy = false;

    // Limpar o texto também apaga as mensagens informativas da IA (ex.: "3 grupos de parágrafos carregados.").
    function clearAiMessages() {
      aiStatusElements().forEach(el => { el.textContent = ''; });
    }

    // A mensagem aparece junto ao botão que o usuário usou: na área da IA (formatação e respostas do texto colado) ou nos
    // cards da Sentinela (Comentários e Dirigente).
    let aiStatusKind = 'format'; // 'format' | 'sentinela' | 'estudo' | 'lista' | 'dirigente' | 'ebc' | 'joias' | 'ebcdir' | 'tesouros' | 'discurso'
    let studyListCard = 'comentarios'; // card do último "Carregar os parágrafos": 'comentarios' ou 'dirigente'

    function aiStatusElements() {
      return [aiStatus, aiStudyAnswerStatus, aiStudyStatus, leaderAnswerStatus, leaderStudyStatus, document.getElementById('ebcStatus'), document.getElementById('joiasStatus'), document.getElementById('apostilaImgStatus'), document.getElementById('ebcDirStatus'), document.getElementById('tesourosStatus'), document.getElementById('discursoStatus'), document.getElementById('publicoStatus'), document.getElementById('outrosStatus')];
    }

    function aiStatusElement() {
      return aiStatusKind === 'estudo' ? aiStudyAnswerStatus
        : aiStatusKind === 'ebc' ? document.getElementById('ebcStatus')
          : aiStatusKind === 'ebcdir' ? document.getElementById('ebcDirStatus')
          : aiStatusKind === 'tesouros' ? document.getElementById('tesourosStatus')
          : aiStatusKind === 'discurso' ? document.getElementById('discursoStatus')
          : aiStatusKind === 'publico' ? document.getElementById('publicoStatus')
          : aiStatusKind === 'outros' ? document.getElementById('outrosStatus')
          : aiStatusKind === 'apostilaimg' ? document.getElementById('apostilaImgStatus')
          : aiStatusKind === 'joias' ? document.getElementById('joiasStatus')
          : aiStatusKind === 'dirigente' ? leaderAnswerStatus
            : aiStatusKind === 'lista' ? (studyListCard === 'dirigente' ? leaderStudyStatus : aiStudyStatus)
              : aiStatus;
    }

    function setAiStatus(message, isWarning) {
      const target = aiStatusElement();
      aiStatusElements().forEach(el => {
        if (el !== target) el.textContent = '';
      });
      target.textContent = message;
      target.className = isWarning ? 'warn' : 'ok';
    }

    // Lista "Todas" + as categorias de modelos atuais, mantendo a escolha salva (ou voltando a "Todas" se ela sumiu).
    function renderAiCategoryOptions(selected) {
      const wanted = selected !== undefined ? selected : aiCategory.value || 'all';
      aiCategory.textContent = '';

      const all = document.createElement('option');
      all.value = 'all';
      all.textContent = 'Todas as categorias';
      aiCategory.appendChild(all);

      templateCategories.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        aiCategory.appendChild(option);
      });

      aiCategory.value = Array.from(aiCategory.options).some(o => o.value === wanted) ? wanted : 'all';
    }

    // Mostra que um pedido está em andamento: botão com ícone girando, barra de progresso e contador de segundos.
    // modo "ia" (padrão): geração com Anthropic. modo "site": só leitura/pesquisa no wol.jw.org (sem IA).
    let aiLoadingTimer = null;

    // Faixa no topo da tela com o andamento, sempre à vista (o indicador do botão fica fora da tela quando a página rola).
    const aiFloating = document.getElementById('aiFloating');
    function showAiFloating(seconds, frase) {
      if (!aiFloating.classList.contains('on')) {
        const spinner = document.createElement('span');
        spinner.className = 'ai-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.id = 'aiFloatingText';
        aiFloating.replaceChildren(spinner, label);
        aiFloating.classList.add('on');
      }
      document.getElementById('aiFloatingText').textContent = frase + ' ' + seconds + ' s';
    }

    function setAiLoading(on, button, modo) {
      const all = [aiSuggestBtn, aiSentinelaBtn, aiStudyBtn, aiStudyQuestionsBtn, aiStudyLoadBtn, leaderStudyLoadBtn, aiAnotherBtn, aiImproveBtn,
        document.getElementById('tdGerarBtn'), document.getElementById('tdIaOutrosBtn'),
        document.getElementById('ebcCarregarBtn'), document.getElementById('ebcResponderBtn'),
        document.getElementById('ebcDirCarregarBtn'), document.getElementById('ebcDirPerguntasBtn'),
        document.getElementById('tesourosCarregarBtn'), document.getElementById('tesourosEsbocoBtn'),
        document.getElementById('discursoCarregarBtn'), document.getElementById('discursoEsbocoBtn'), document.getElementById('publicoEsbocoBtn'),
        document.getElementById('outrosCarregarBtn'), document.getElementById('outrosEsbocoBtn'), document.getElementById('outrosPesquisarBtn'),
        document.getElementById('joiasCarregarBtn'), document.getElementById('joiasResponderBtn'), document.getElementById('apostilaImgCarregarBtn'),
        ...(typeof ESBOCOS === 'undefined' ? [] : Object.values(ESBOCOS).map(cfg => cfg.textosUi && cfg.textosUi.incluir).filter(Boolean))];

      if (!on) {
        clearInterval(aiLoadingTimer);
        aiLoadingTimer = null;
        all.forEach(b => {
          b.disabled = false;
          b.classList.remove('is-loading');
          b.removeAttribute('aria-busy');
          if (b.dataset.label) {
            b.textContent = b.dataset.label;
            delete b.dataset.label;
          }
        });
        aiProgress.classList.remove('on');
        aiResults.removeAttribute('aria-busy');
        aiFloating.classList.remove('on');
        aiFloating.textContent = '';
        return;
      }

      const soSite = modo === 'site';
      const rotuloBotao = soSite ? 'Consultando o wol.jw.org…' : 'Consultando a IA…';
      const fraseFlutuante = soSite ? 'Consultando o wol.jw.org…' : 'A IA está pensando…';

      all.forEach(b => { b.disabled = true; });
      button.dataset.label = button.textContent;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      const spinner = document.createElement('span');
      spinner.className = 'ai-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      button.textContent = '';
      button.append(spinner, rotuloBotao);

      aiProgress.classList.add('on');
      aiResults.setAttribute('aria-busy', 'true');
      // Sem cartões fantasma: o botão, a barra de progresso e o contador de segundos já mostram o andamento.

      const startedAt = Date.now();
      const tick = () => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        showAiFloating(seconds, fraseFlutuante);
        setAiStatus(
          soSite
            ? (seconds < 12
              ? 'Consultando o wol.jw.org… ' + seconds + ' s'
              : 'Ainda consultando o wol.jw.org… ' + seconds + ' s. Aguarde.')
            : (seconds < 12
              ? 'A IA está trabalhando… ' + seconds + ' s'
              : 'Ainda trabalhando… ' + seconds + ' s (textos longos demoram mais). Aguarde.'),
          false
        );
      };
      tick();
      aiLoadingTimer = setInterval(tick, 1000);
    }

    // Desde a 6.1.62 "Perguntas para entender e explicar o texto…" (perguntas do dirigente de A Sentinela) vem marcada por padrão. Quem já tinha as opções
    // salvas, com ela desmarcada (era o padrão antigo), recebe a marcação uma única vez; depois vale a escolha de cada um.
    const ENTENDIMENTO_PADRAO_KEY = 'jwLibraryNoteAplicarEntendimentoPadraoV1';
    // Desde a 6.3.12 as 3 primeiras seções da resposta (complementares, aplicativas e entendimento) vêm marcadas por padrão.
    const SECOES_RESPOSTA_PADRAO_KEY = 'jwLibraryNoteAplicarSecoesRespostaPadraoV1';
    let entendimentoPadraoPendente = false;
    let secoesRespostaPadraoPendente = false;
    try {
      entendimentoPadraoPendente = localStorage.getItem(ENTENDIMENTO_PADRAO_KEY) === null;
      if (entendimentoPadraoPendente) localStorage.setItem(ENTENDIMENTO_PADRAO_KEY, '1');
      secoesRespostaPadraoPendente = localStorage.getItem(SECOES_RESPOSTA_PADRAO_KEY) === null;
      if (secoesRespostaPadraoPendente) localStorage.setItem(SECOES_RESPOSTA_PADRAO_KEY, '1');
    } catch (e) { /* sem localStorage */ }

    function loadAiOptions() {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(AI_OPTIONS_KEY) || '{}') || {}; } catch (e) { saved = {}; }
      if (entendimentoPadraoPendente) {
        entendimentoPadraoPendente = false;
        if (Object.keys(saved).length) {
          saved.perguntasEntendimento = true;
          safeSetItem(AI_OPTIONS_KEY, JSON.stringify(saved));
        }
      }
      // Uma vez: as 3 primeiras seções da resposta ficam marcadas mesmo se o padrão publicado antigo as tinha desligadas.
      const forcarSecoesResposta = secoesRespostaPadraoPendente;
      if (secoesRespostaPadraoPendente) {
        secoesRespostaPadraoPendente = false;
        if (Object.keys(saved).length) {
          saved.perguntasComplementares = true;
          saved.perguntasAplicativas = true;
          saved.perguntasEntendimento = true;
          safeSetItem(AI_OPTIONS_KEY, JSON.stringify(saved));
        }
      }
      const options = Object.assign({}, AI_DEFAULT_OPTIONS, aiPublishedDefaults, saved);
      if (forcarSecoesResposta) {
        options.perguntasComplementares = true;
        options.perguntasAplicativas = true;
        options.perguntasEntendimento = true;
      }
      renderAiCategoryOptions(String(options.categoria || 'all'));
      aiSummarySize.value = ['curto', 'medio', 'detalhado'].includes(options.resumoTamanho) ? options.resumoTamanho : 'medio';
      aiOptionInputs.forEach(el => { el.checked = !!options[el.dataset.aiOpt]; });
      aiIntensity.value = ['poucas', 'moderada', 'muitas'].includes(options.intensidade) ? options.intensidade : 'moderada';
      aiInstruction.value = String(options.instrucao || '').slice(0, 300);
    }

    function readAiOptions() {
      const options = {};
      aiOptionInputs.forEach(el => { options[el.dataset.aiOpt] = el.checked; });
      options.intensidade = aiIntensity.value;
      options.categoria = aiCategory.value || 'all';
      options.resumoTamanho = aiSummarySize.value;
      options.instrucao = aiInstruction.value.trim().slice(0, 300);
      return options;
    }

    function saveAiOptions() {
      safeSetItem(AI_OPTIONS_KEY, JSON.stringify(readAiOptions()));
    }

    // ---------- Instruções adicionais para a IA ----------
    // Um campo de texto logo abaixo do botão de cada pedido à IA das reuniões (comentar: A Sentinela, Joias e Estudo Bíblico; dirigir: A Sentinela e
    // Estudo Bíblico; esboços: discurso público, Tesouros e discurso curto; "Outros esboços" já tem os campos dele). O que o usuário escrever vai no
    // pedido como "ajuste": o servidor o põe no INÍCIO da mensagem, como orientação do usuário, com prioridade total sobre o prompt padrão
    // (blocoOrientacao e PRIORIDADE_ORIENTACAO em api). Vale para o pedido, "Outra resposta" e "Melhorar" da seção; não fica guardado no aparelho.
    const IA_EXTRA_CAMPOS = {
      estudo: { botao: 'aiStudyBtn', exemplo: 'Ex.: explique também como o parágrafo se aplica à família, ou dê uma resposta mais curta.' },
      joias: { botao: 'joiasResponderBtn', exemplo: 'Ex.: explique e aplique Jeremias 45:5 para quem se sente desanimado.' },
      ebc: { botao: 'ebcResponderBtn', exemplo: 'Ex.: responda com mais detalhes ao quadro "Medite no que aprendeu".' },
      dirigente: { botao: 'aiStudyQuestionsBtn', exemplo: 'Ex.: sugira perguntas voltadas aos jovens, ou sobre o texto de 1 Pedro 5:2.' },
      ebcdir: { botao: 'ebcDirPerguntasBtn', exemplo: 'Ex.: elabore as perguntas sobre a atitude de Raabe e como imitá-la hoje.' },
      publico: { botao: 'publicoEsbocoBtn', exemplo: 'Ex.: use uma ilustração do dia a dia e destaque a aplicação para os jovens.' },
      tesouros: { botao: 'tesourosEsbocoBtn', exemplo: 'Ex.: inclua uma ilustração sobre a esperança e perguntas que levem a plateia a pensar.' },
      discurso: { botao: 'discursoEsbocoBtn', exemplo: 'Ex.: faça uma introdução mais curta e foque na aplicação prática.' }
    };

    function iaExtraCriar(chave, { botao, exemplo }) {
      const alvo = document.getElementById(botao);
      if (!alvo) return;
      const bloco = document.createElement('details'); // recolhida: só a linha do título; o texto digitado fica guardado enquanto o app está aberto
      bloco.className = 'imagens-box ia-extra';
      const titulo = '✍️ Instruções adicionais para a IA';
      const rotulo = document.createElement('summary');
      rotulo.textContent = titulo;
      const campo = document.createElement('textarea');
      campo.id = 'iaExtra_' + chave;
      campo.rows = 3;
      campo.maxLength = 800;
      campo.autocomplete = 'off';
      campo.placeholder = exemplo;
      campo.setAttribute('aria-label', titulo);
      // Botão pequeno 🗑️ (limpar) na ponta direita da linha do título (aberta ou fechada), só enquanto há texto no campo; não leva o cursor ao campo.
      const limpar = document.createElement('button');
      limpar.type = 'button';
      limpar.className = 'secondary ia-extra-limpar';
      limpar.textContent = '🗑️'; // só o ícone (como o Limpar do campo de texto): o título da caixa é longo e não deixa lugar para uma palavra
      limpar.hidden = true;
      limpar.title = 'Limpar: apaga o texto das instruções adicionais';
      limpar.setAttribute('aria-label', 'Limpar as instruções adicionais para a IA');
      // Com a caixa fechada, um ✓ no título (CSS: .ia-extra.tem-texto:not([open]) > summary::after) avisa que há texto, que vai no pedido mesmo assim;
      // aberta, quem avisa é o botão 🗑️, e o título fica curto, numa linha só.
      campo.addEventListener('input', () => {
        rotulo.title = campo.value.trim() ? 'Há instruções escritas: elas vão no pedido' : '';
        limpar.hidden = campo.value === '';
        bloco.classList.toggle('tem-texto', campo.value !== ''); // mostra o ✓ (fechada) e reserva o lugar do botão (aberta)
      });
      limpar.addEventListener('click', () => {
        campo.value = '';
        campo.dispatchEvent(new Event('input')); // atualiza o ✓, esconde o botão e volta o campo ao tamanho mínimo
      });
      // O campo cresce com o texto, sem rolagem interna (como o campo de texto principal): recalcula ao digitar, ao abrir a caixa e quando a tela muda de
      // largura. Com a caixa fechada a medida daria zero, por isso ela só vale com o campo visível. Passando de 60% da altura da tela, ele rola por dentro.
      const crescer = () => {
        if (!campo.getClientRects().length) return;
        campo.style.height = 'auto';
        const moldura = campo.offsetHeight - campo.clientHeight; // scrollHeight não conta a moldura
        campo.style.height = Math.max(72, campo.scrollHeight + moldura) + 'px';
      };
      campo.addEventListener('input', crescer);
      bloco.addEventListener('toggle', crescer);
      window.addEventListener('resize', crescer);
      const dica = document.createElement('p');
      dica.className = 'hint';
      dica.textContent = 'Opcional. Valem mais que o prompt padrão, em todos os pedidos desta seção (inclusive Outra resposta e Melhorar).';
      bloco.append(rotulo, limpar, campo, dica);
      alvo.insertAdjacentElement('afterend', bloco);
    }
    Object.entries(IA_EXTRA_CAMPOS).forEach(([chave, config]) => iaExtraCriar(chave, config));

    // O texto do campo da seção (uma linha só, até 800 caracteres); vazio se a seção não tem o campo.
    function iaExtra(chave) {
      const campo = document.getElementById('iaExtra_' + chave);
      return campo ? campo.value.replace(/\s+/g, ' ').trim().slice(0, 800) : '';
    }

    // Só mudanças feitas pelo usuário (isTrusted) contam como "já mexeu".
    [...aiOptionInputs, aiSummarySize, aiIntensity, aiCategory, aiInstruction].forEach(control => {
      ['change', 'input'].forEach(type => control.addEventListener(type, event => {
        if (event.isTrusted) aiOptionsTouched = true;
      }));
    });

    // As caixas dos textos bíblicos existem em mais de uma área e valem para todas: marcar uma marca as iguais. As quatro
    // formas de usar os textos (transcrever e citar, transcrever sem citar, só citar, explicar e aplicar) não se combinam:
    // marcar uma desmarca as outras.
    const AI_BIBLE_MODES = ['consultarBiblia', 'transcreverSemCitar', 'citarTextos', 'explicarTextos'];
    AI_BIBLE_MODES.forEach(name => {
      const boxes = aiOptionInputs.filter(el => el.dataset.aiOpt === name);
      boxes.forEach(box => box.addEventListener('change', () => {
        boxes.forEach(other => { other.checked = box.checked; });
        if (box.checked) {
          aiOptionInputs
            .filter(el => AI_BIBLE_MODES.includes(el.dataset.aiOpt) && el.dataset.aiOpt !== name)
            .forEach(el => { el.checked = false; });
        }
        saveAiOptions();
      }));
    });

    // Usar os textos bíblicos leva um pouco mais de tempo (o servidor busca os versículos e a IA escreve a aplicação).
    function aiUsesSources() {
      const options = readAiOptions();
      return !!(options.consultarBiblia || options.transcreverSemCitar || options.explicarTextos);
    }

    // O negrito e o itálico das respostas da IA vêm da fonte principal escolhida no editor. Regra do usuário: as respostas NUNCA usam as
    // fontes gótica e script, mesmo que uma delas seja a fonte escolhida no editor: nesse caso valem as letras serifadas (matemático).
    const FONTES_PROIBIDAS_NA_IA = new Set(['script', 'boldScript', 'fraktur', 'boldFraktur']);
    function aiStyleIdFor(estilo) {
      const kind = AI_STYLE_KIND[estilo];
      if (!kind) return '';
      const fontVariants = (getSelectedFont() && getSelectedFont().variants) || {};
      if (fontVariants[kind] && !FONTES_PROIBIDAS_NA_IA.has(fontVariants[kind])) return fontVariants[kind];
      const fallback = getStyleById('serif');
      return (fallback.variants && fallback.variants[kind]) || '';
    }

    // Linhas em branco entre as ideias de um mesmo parágrafo: antes de cada trecho indicado pela IA, o espaço em branco
    // vira uma linha vazia. Trechos que não existem na linha, ou que estão no começo dela, são ignorados.
    function aiApplyBreaks(text, breaks) {
      if (!Array.isArray(breaks) || !breaks.length) return text;
      const positions = [];
      breaks.forEach(piece => {
        const index = typeof piece === 'string' && piece ? text.indexOf(piece) : -1;
        if (index > 0 && !positions.includes(index)) positions.push(index);
      });
      positions.sort((a, b) => a - b);
      let result = '';
      let last = 0;
      positions.forEach(index => {
        result += text.slice(last, index).replace(/\s+$/, '') + '\n\n';
        last = index;
      });
      return result + text.slice(last);
    }

    // Monta a linha final: quebras de ideia → destaques (negrito/itálico/maiúsculas) → emoji no início → modelo.
    function aiBuildLine(originalLine, suggestion) {
      const original = aiApplyBreaks(originalLine, suggestion.quebras);
      const spans = [];
      (suggestion.destaques || []).forEach(d => {
        const idx = d.trecho ? original.indexOf(d.trecho) : -1;
        if (idx < 0) return;
        // Tipo de fonte escolhido pela IA (letra dupla, sem serifa ou caixa escura): combina com negrito/itálico quando a fonte tem
        // essa variação; sem fonte, vale a fonte principal escolhida no app.
        const font = AI_FONTS.includes(d.fonte) ? getStyleById(d.fonte) : null;
        const kind = d.estilo ? AI_STYLE_KIND[d.estilo] : '';
        const styleId = font ? ((kind && font.variants && font.variants[kind]) || font.id) : (d.estilo ? aiStyleIdFor(d.estilo) : '');
        if (!styleId && !d.maiusculas) return;
        let text = d.maiusculas ? d.trecho.toUpperCase() : d.trecho;
        if (styleId) text = convertTextWithStyle(text, styleId);
        spans.push({ start: idx, end: idx + d.trecho.length, text });
      });

      spans.sort((a, b) => a.start - b.start);
      let line = '';
      let pos = 0;
      spans.forEach(span => {
        if (span.start < pos) return; // trechos sobrepostos: mantém o primeiro
        line += original.slice(pos, span.start) + span.text;
        pos = span.end;
      });
      line += original.slice(pos);

      if (suggestion.emoji) line = suggestion.emoji + ' ' + line;

      if (suggestion.modelo) {
        const content = String(suggestion.modelo.content || '');
        line = content.includes('{texto}') ? content.split('{texto}').join(line) : content + line;
      } else if (suggestion.prefixoLista) {
        // Item de lista: marcador ou número na frente da linha (linhas com modelo já têm o seu próprio rótulo).
        line = suggestion.prefixoLista + line;
      }

      return line;
    }

    // No estudo o botão refaz uma resposta; na formatação, uma sugestão. Durante o carregamento o texto do botão é o
    // do indicador de progresso, então só troca quando a IA não está ocupada.
    function updateRefineLabels() {
      if (aiBusy) return;
      const study = aiLastKind !== 'format';
      aiAnotherBtn.textContent = study ? '🔄 Outra resposta' : '🔄 Outra sugestão';
      aiImproveBtn.textContent = study ? '🛠️ Melhorar esta resposta' : '🛠️ Melhorar esta';
    }

    function updateAiControls() {
      placeRefineBox();
      updateRefineLabels();
      // Uma pesquisa reaberta do histórico traz Outra resposta/Melhorar (com os dados crus da IA, da 6.1.38 em diante; as salvas antes, com o texto
      // salvo); só o texto colado antigo e os esboços reabertos pela lista não os trazem, só o texto e os botões de copiar.
      aiRefineBox.hidden = (!aiRaw.length && !aiResumo && !aiAppliedAny) || Boolean(aiResumo && aiResumo.restaurada);
      if (!(aiResumo && aiResumo.kind === 'estudo')) clearAnswerCopyButtons();
    }

    // Rótulo que identifica o resumo no texto, no mesmo estilo dos modelos prontos.
    function aiSummaryLine() {
      if (aiResumo.kind === 'sentinela') return aiResumo.texto;
      const styleId = aiStyleIdFor('negrito');
      const label = styleId ? convertTextWithStyle('RESUMO', styleId) : 'RESUMO';
      const extras = buildSourceBlocks({ textos: aiResumo.textos, perspicaz: aiResumo.perspicaz });
      const parts = [];
      if (aiResumo.texto) parts.push('📝 ' + label + ' ➜ ' + aiResumo.texto);
      if (extras) parts.push(extras);
      return parts.join('\n\n');
    }

    function insertAiSummary(where) {
      const line = aiSummaryLine();
      const current = input.value.replace(/\s+$/, '');
      const text = where === 'replace'
        ? line
        : where === 'start'
          ? line + (current ? '\n\n' + input.value : '')
          : (current ? current + '\n\n' : '') + line;
      setInputRange(0, input.value.length, text, { message: aiResumo.kind === 'sentinela' ? 'Respostas inseridas.' : 'Resumo inserido.' });
      autoGrowInputText();
      aiResumo.done = true;
      aiAppliedAny = true;
    }

    // Substitui todo o campo de texto pelas respostas (respostas do texto colado: elas tomam o lugar dele).
    function replaceMainText(text) {
      setInputRange(0, input.value.length, text, { message: '✅ Resposta finalizada e colada no campo de texto.' });
      autoGrowInputText();
      aiAppliedAny = true;
      aiAppliedSnapshot = input.value;
    }

    // Respostas do estudo lidas direto do site: já vão para o campo de texto (sem pedir confirmação) e cada
    // parágrafo ou grupo de parágrafos ganha um botão Copiar logo abaixo do campo de texto.
    function appendToMainText(text) {
      const current = input.value.replace(/\s+$/, '');
      setInputRange(0, input.value.length, (current ? current + '\n\n' : '') + text, { message: '✅ Resposta finalizada e colada no campo de texto.' });
      autoGrowInputText();
      aiAppliedAny = true;
      aiAppliedSnapshot = input.value;
    }

    // Botões Copiar dentro do próprio campo de texto, logo abaixo de cada resposta do estudo. Um <textarea>
    // não aceita botões entre as linhas, então eles ficam numa camada por cima do campo. A posição vem de um
    // espelho invisível com o mesmo texto, fonte e largura; as respostas são localizadas no texto atual, e um
    // botão some sozinho se a resposta foi apagada ou editada (inclusive ao clicar em Limpar).
    const answerCopyLayer = document.getElementById('answerCopyLayer');
    let answerCopyButtons = []; // { btn, part }
    let answerCopyFrame = 0;
    let answerMirror = null;

    function clearAnswerCopyButtons() {
      answerCopyButtons = [];
      answerCopyLayer.textContent = '';
      input.classList.remove('has-answer-buttons');
    }

    function scheduleAnswerButtons() {
      if (answerCopyFrame || !answerCopyButtons.length) return;
      answerCopyFrame = requestAnimationFrame(() => {
        answerCopyFrame = 0;
        positionAnswerButtons();
      });
    }

    function answerMirrorFor(textarea, style) {
      if (!answerMirror) {
        answerMirror = document.createElement('div');
        answerMirror.setAttribute('aria-hidden', 'true');
        document.body.appendChild(answerMirror);
      }
      ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'wordSpacing',
        'textIndent', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
      ].forEach(prop => { answerMirror.style[prop] = style[prop]; });
      Object.assign(answerMirror.style, {
        position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', boxSizing: 'border-box',
        whiteSpace: 'pre-wrap', overflowWrap: 'break-word', border: '0', height: 'auto',
        width: textarea.clientWidth + 'px'
      });
      return answerMirror;
    }

    function positionAnswerButtons() {
      const text = input.value;
      let from = 0;
      const located = answerCopyButtons.map(entry => {
        const at = text.indexOf(entry.part.texto, from);
        if (at < 0) return { entry, end: -1 };
        from = at + entry.part.texto.length;
        return { entry, end: from };
      });

      const active = located.some(item => item.end >= 0);
      const wasActive = input.classList.contains('has-answer-buttons');
      input.classList.toggle('has-answer-buttons', active);
      if (wasActive !== active) autoGrowInputText(); // o espaço extra do último botão entra na altura do campo
      const style = getComputedStyle(input);
      const mirror = answerMirrorFor(input, style);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.25;
      const btnHeight = Math.max(18, Math.min(24, lineHeight - 2));
      const left = input.offsetLeft + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
      const borderTop = input.offsetTop + (parseFloat(style.borderTopWidth) || 0);

      located.forEach(({ entry, end }) => {
        if (end < 0) { entry.btn.hidden = true; return; }

        mirror.textContent = text.slice(0, end);
        const marker = document.createElement('span');
        marker.textContent = '​';
        mirror.appendChild(marker);

        // Última linha da resposta + 1 linha (a linha em branco que separa as respostas) centralizada.
        const top = marker.offsetTop + lineHeight + (lineHeight - btnHeight) / 2 - input.scrollTop;
        const visible = top >= 0 && top + btnHeight <= input.clientHeight;
        entry.btn.hidden = !visible;
        entry.btn.style.height = btnHeight + 'px';
        entry.btn.style.left = left + 'px';
        entry.btn.style.top = (borderTop + top) + 'px';
      });
    }

    function renderAiStudyCards() {
      clearAnswerCopyButtons();

      aiResumo.partes.forEach((part, index) => {
        const label = part.paragrafos ? '📋 Copiar ' + part.paragrafos : '📋 Copiar ' + (index + 1);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer-copy-btn';
        btn.textContent = label;
        btn.title = 'Copiar só esta resposta';
        // Mantém o foco e a seleção no campo de texto ao tocar no botão.
        btn.addEventListener('mousedown', event => event.preventDefault());
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(part.texto);
            btn.textContent = '✓ Copiado';
          } catch (e) {
            btn.textContent = 'Não foi possível copiar';
          }
          setTimeout(() => { btn.textContent = label; }, 1800);
        });

        answerCopyLayer.appendChild(btn);
        answerCopyButtons.push({ btn, part });
      });

      scheduleAnswerButtons();
    }

    // Tudo o que a IA devolve entra direto no campo de texto; só as respostas do estudo ganham botões Copiar (o esboço é copiado de
    // uma vez, sem botões).
    function renderAiSuggestions() {
      aiResults.textContent = '';
      if (aiResumo && aiResumo.kind === 'estudo') {
        if (aiResumo.semBotoes) clearAnswerCopyButtons();
        else renderAiStudyCards();
      }
      updateAiControls();
    }

    // Procura no texto atual a primeira linha idêntica à original; se o usuário já mexeu nela, não aplica.
    function applyAiSuggestion(s) {
      const parts = input.value.split('\n');
      let offset = 0;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === s.original) {
          // "Espaço antes": uma linha em branco separa esta ideia da anterior (se já não houver uma).
          const blankBefore = s.espacoAntes && i > 0 && parts[i - 1].trim() !== '';
          setInputRange(offset, offset + parts[i].length, (blankBefore ? '\n' : '') + s.novo, { message: 'Sugestão aplicada.' });
          autoGrowInputText();
          s.done = true;
          aiAppliedAny = true;
          return true;
        }
        offset += parts[i].length + 1;
      }
      setAiStatus('Uma linha foi alterada desde a sugestão e não foi aplicada. Peça novas sugestões.', true);
      s.done = true;
      return false;
    }

    function restoreAiBaseText() {
      setInputRange(0, input.value.length, aiBaseText, { message: 'Texto anterior às sugestões restaurado.' });
      autoGrowInputText();
      aiAppliedAny = false;
      aiAppliedSnapshot = null;
    }

    async function confirmAiRestore() {
      if (!aiAppliedAny || input.value === aiBaseText || input.value === aiAppliedSnapshot) return true;
      return askConfirm(
        'O texto volta ao estado de antes de aplicar as sugestões. Edições feitas depois de aplicar serão perdidas. Continuar?',
        'Voltar ao texto anterior'
      );
    }

    // Marcadores e números das listas que a IA organizou: { linha -> prefixo }. A IA escolhe, entre os modelos de lista do
    // app (🔷, •, ➤, ✅, 1., ①, 1️⃣ ...), o de cada lista e o grupo de cada linha; aqui o app escreve o marcador e numera
    // cada grupo na ordem do texto. Uma lista usa um modelo só (o do primeiro item). Linhas que já começam com marcador
    // ou número ficam como estão.
    function buildListPrefixes(raw, lines) {
      const prefixes = new Map();
      const counters = new Map();
      const modelOfGroup = new Map();
      raw
        .filter(item => item && item.lista && typeof lines[item.linha] === 'string' && !listPrefixPattern.test(lines[item.linha]))
        .sort((a, b) => a.linha - b.linha)
        .forEach(item => {
          const group = item.lista.grupo;
          if (!modelOfGroup.has(group)) modelOfGroup.set(group, item.lista.modelo);
          const index = counters.get(group) || 0;
          counters.set(group, index + 1);
          prefixes.set(item.linha, getListPrefix(modelOfGroup.get(group), index));
        });
      return prefixes;
    }

    // mode: undefined = primeira sugestão; 'nova' = alternativa diferente; 'melhorar' = refinar a anterior.
    async function requestAiSuggestions(mode) {
      if (aiBusy) return;
      aiLastKind = 'format';
      aiStatusKind = 'format';
      placeAiOutput(aiOutputHome);
      openWithAncestors(opcoesIaGroup); // o resultado aparece aqui dentro, então o grupo precisa estar aberto

      const acessoFormatar = studyAccessError();
      if (acessoFormatar) return setAiStatus(acessoFormatar, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiRaw = [];
        aiResumo = null;
        aiAppliedAny = false;
      }

      const lines = input.value.split('\n').filter(l => l.trim());
      const totalChars = lines.reduce((sum, l) => sum + l.length, 0);

      aiResults.textContent = '';
      aiSuggestions = [];
      const previousSummary = aiResumo;
      aiResumo = null;
      updateAiControls();

      if (!lines.length) return setAiStatus('Digite ou cole um texto no campo "Texto original" primeiro.', true);
      if (totalChars > AI_MAX_CHARS || lines.length > AI_MAX_LINES) {
        return setAiStatus('Texto grande demais para a IA (máximo ' + AI_MAX_CHARS + ' caracteres e ' + AI_MAX_LINES + ' linhas).', true);
      }
      if (!navigator.onLine) return setAiStatus('Sem conexão com a internet.', true);

      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      renderAiCategoryOptions();
      const category = aiCategory.value;
      const modelos = getTemplatesSortedByName()
        .filter(t => category === 'all' || templateHasCategory(t, category))
        .slice(0, 60).map(t => ({
        id: t.id,
        nome: t.name || 'Modelo',
        conteudo: String(t.content || '').slice(0, 200)
      }));

      const options = readAiOptions(); // inclui "Incluir resumo do texto" e as consultas, como estão marcados agora
      const payload = { tarefa: 'formatar', codigo: codigoAcessoSalvo(), linhas: lines, modelos, opcoes: options };
      if (mode && (aiRaw.length || previousSummary)) {
        payload.modo = mode;
        payload.anteriores = { resumo: previousSummary ? (previousSummary.texto || null) : null, textos: previousSummary ? previousSummary.textos : null, perspicaz: previousSummary ? previousSummary.perspicaz : null, sugestoes: aiRaw };
      }

      if (!(await garantirConsentimentoIa())) return setAiStatus(MSG_SEM_CONSENTIMENTO, true);
      if (aiBusy) return;
      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : aiSuggestBtn);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), aiUsesSources() ? 125000 : 60000);

      try {
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corpoIa(payload),
          signal: controller.signal
        });

        let data = null;
        try { data = await response.json(); } catch (e) { /* resposta sem JSON */ }

        if (!response.ok || !data) {
          const unavailable = response.status === 404 || response.status === 501;
          return setAiStatus(
            unavailable
              ? 'A IA só funciona no site publicado (notestyle.com.br).'
              : (data && data.erro) || 'Não foi possível obter sugestões agora.',
            true
          );
        }

        aiRaw = Array.isArray(data.sugestoes) ? data.sugestoes : [];
        const extraTexts = Array.isArray(data.textos) ? data.textos : [];
        // O resumo, os versículos e o Perspicaz são independentes: basta um deles para haver algo a inserir no fim do texto.
        aiResumo = (data.resumo || extraTexts.length || data.perspicaz)
          ? { texto: data.resumo ? String(data.resumo) : '', done: false, kind: 'resumo', textos: extraTexts, perspicaz: data.perspicaz || null }
          : null;
        const byId = new Map(getTemplatesSortedByName().map(t => [t.id, t]));
        const listPrefixes = buildListPrefixes(aiRaw, lines);
        aiSuggestions = aiRaw.map(s => {
          const original = lines[s.linha];
          if (typeof original !== 'string') return null;
          const suggestion = {
            original,
            modelo: s.modeloId ? byId.get(s.modeloId) || null : null,
            emoji: s.emoji || '',
            destaques: Array.isArray(s.destaques) ? s.destaques : [],
            prefixoLista: listPrefixes.get(s.linha) || '',
            quebras: Array.isArray(s.quebras) ? s.quebras : [],
            espacoAntes: s.espacoAntes === true,
            motivo: String(s.motivo || 'Sugestão da IA'),
            done: false
          };
          suggestion.novo = aiBuildLine(original, suggestion);
          return suggestion.novo !== original || suggestion.espacoAntes ? suggestion : null;
        }).filter(Boolean);

        // As sugestões entram direto no campo de texto: cada linha formatada no lugar da original e o resumo no fim.
        // Se não gostar, o usuário pede outra sugestão, pede para melhorar ou desfaz (volta ao texto de antes).
        let appliedCount = 0;
        runUndoBatch(() => {
          aiSuggestions.forEach(suggestion => { if (applyAiSuggestion(suggestion)) appliedCount++; });
          if (aiResumo) { insertAiSummary('end'); appliedCount++; }
        });
        aiAppliedSnapshot = input.value;

        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus(
          appliedCount
            ? '✅ Sugestão finalizada e aplicada no campo de texto.'
            : 'A IA não encontrou nada para destacar com essas opções.',
          false
        );
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente novamente.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        clearTimeout(timer);
        aiBusy = false;
        setAiLoading(false);
      }
    }

    function aiTemplateByName(name) {
      return getTemplatesSortedByName().find(t => String(t.name || '').trim().toLowerCase() === name) || null;
    }

    // Aplica o modelo do usuário (ex.: "Pergunta", "Resposta") ou um rótulo padrão se ele não existir.
    function aiLabelWith(tpl, fallback, text) {
      const content = tpl ? String(tpl.content || '') : fallback;
      if (content.includes('{texto}')) return content.split('{texto}').join(text);
      return content + (/\s$/.test(content) ? '' : ' ') + text;
    }

    // Só as respostas (sem repetir a pergunta), cada uma com o modelo "Resposta" do usuário e já formatada
    // (negrito, itálico, maiúsculas, emoji) conforme as opções da IA. Sem "Usar meus modelos", usa um rótulo simples.
    function buildSentinelaParts(items) {
      const answerTpl = readAiOptions().usarModelos ? aiTemplateByName('resposta') : null;

      return items.map(item => {
        const number = item.paragrafos ? item.paragrafos + '. ' : '';  // "3. " ou, na recapitulação, "Recap. 1. "
        const body = aiBuildLine(item.resposta, {
          destaques: Array.isArray(item.destaques) ? item.destaques : [],
          emoji: item.emoji || '',
          quebras: Array.isArray(item.quebras) ? item.quebras : []
        });
        const answer = aiLabelWith(answerTpl, '✅ RESPOSTA 👉 ', number + body);
        const extras = buildSourceBlocks(item);
        return { paragrafos: item.paragrafos || '', texto: extras ? answer + '\n\n' + extras : answer };
      });
    }

    // Consultas às fontes de uma resposta, abaixo dela (uma linha em branco antes):
    //   📖 Efésios 6:12 ➜ “texto do versículo, na fonte normal”
    //   💡 como o texto se aplica ao parágrafo (uma linha em branco entre o versículo e a aplicação)
    //   📚 Estudo Perspicaz, vol. 1, verbete “ADOÇÃO” ➜ explicação adicional
    // O versículo vem do arquivo da Bíblia e vai inteiro, entre aspas e sem estilo (preserva acentos e sinais); a explicação do Perspicaz é sempre identificada
    // pelo volume e pelo verbete.
    // REGRA FIXA (pedido do usuário): sempre que uma resposta da IA reproduz na íntegra um texto bíblico com mais de um versículo, o começo
    // de cada versículo, do segundo em diante, vem marcado com o número em negrito entre colchetes: “… contra ele? [𝟐𝟗] “Ouvimos …”.
    // O servidor manda a marca como [n] (ou [cap:n], quando o trecho passa a outro capítulo); aqui o número ganha o negrito e o resto do
    // texto, se for o caso, o estilo de `estiloDoTexto` (por exemplo, o itálico da leitura dos esboços).
    function versiculosNumerados(texto, estiloDoTexto) {
      const styleId = aiStyleIdFor('negrito');
      return String(texto).split(/\[(\d{1,3}(?::\d{1,3})?)\]/).map((parte, i) => {
        if (i % 2) return '[' + (styleId ? convertTextWithStyle(parte, styleId) : parte) + ']';
        return estiloDoTexto && parte ? estiloDoTexto(parte) : parte;
      }).join('');
    }

    function buildSourceBlocks(item) {
      const styled = (kind, text) => {
        const styleId = aiStyleIdFor(kind);
        return styleId ? convertTextWithStyle(text, styleId) : text;
      };
      const blocks = [];

      (Array.isArray(item.textos) ? item.textos : []).forEach(t => {
        if (!t || !t.referencia) return;
        // "Explicar e aplicar": só a referência e a explicação, sem transcrever o versículo.
        if (!t.texto) {
          if (t.aplicacao) blocks.push('📖 ' + styled('negrito', t.referencia) + ' ➜ ' + t.aplicacao);
          return;
        }
        blocks.push(
          '📖 ' + styled('negrito', t.referencia) + ' ➜ “' + versiculosNumerados(t.texto) + '”' +
          (t.aplicacao ? '\n\n💡 ' + t.aplicacao : '')
        );
      });

      const p = item.perspicaz;
      if (p && p.verbete && p.explicacao) {
        blocks.push('📚 ' + styled('negrito', 'Estudo Perspicaz, vol. ' + p.volume + ', verbete “' + p.verbete + '”') + ' ➜ ' + p.explicacao);
      }
      return blocks.join('\n\n');
    }

    // mode: undefined = primeira vez; 'nova' = respostas diferentes; 'melhorar' = refinar as anteriores.
    async function requestSentinelaAnswers(mode) {
      if (aiBusy) return;
      aiLastKind = 'sentinela';
      aiStatusKind = 'sentinela';
      placeAiOutput(aiOutputHome); // o botão do texto colado fica na área da formatação com IA

      const acessoFormatar = studyAccessError();
      if (acessoFormatar) return setAiStatus(acessoFormatar, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
      }

      const lines = input.value.split('\n').filter(l => l.trim());
      const totalChars = lines.reduce((sum, l) => sum + l.length, 0);

      aiResults.textContent = '';
      aiSuggestions = [];
      aiRaw = [];
      const hadPrevious = !!aiResumo && aiSentinelaRaw.length > 0;
      aiResumo = null;
      updateAiControls();

      if (!lines.length) return setAiStatus('Cole no campo "Texto original" os parágrafos e perguntas do estudo.', true);
      if (totalChars > AI_SENTINELA_MAX_CHARS || lines.length > AI_SENTINELA_MAX_LINES) {
        return setAiStatus('Texto grande demais (máximo ' + AI_SENTINELA_MAX_CHARS + ' caracteres e ' + AI_SENTINELA_MAX_LINES + ' linhas). Cole menos parágrafos por vez.', true);
      }
      if (!navigator.onLine) return setAiStatus('Sem conexão com a internet.', true);

      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      const payload = { tarefa: 'sentinela', codigo: codigoAcessoSalvo(), linhas: lines, modelos: [], opcoes: readAiOptions() };
      if (mode && hadPrevious) {
        payload.modo = mode;
        payload.anteriores = { itens: aiSentinelaRaw };
      }

      if (!(await garantirConsentimentoIa())) return setAiStatus(MSG_SEM_CONSENTIMENTO, true);
      if (aiBusy) return;
      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : aiSentinelaBtn);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IA_ESPERA_MS); // com consulta à Bíblia/Perspicaz a IA abre arquivos e demora mais

      try {
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corpoIa(payload),
          signal: controller.signal
        });

        let data = null;
        try { data = await response.json(); } catch (e) { /* resposta sem JSON */ }

        if (!response.ok || !data) {
          const unavailable = response.status === 404 || response.status === 501;
          return setAiStatus(
            unavailable
              ? 'A IA só funciona no site publicado (notestyle.com.br).'
              : (data && data.erro) || 'Não foi possível obter as respostas agora.',
            true
          );
        }

        aiSentinelaRaw = Array.isArray(data.itens) ? data.itens : [];
        if (!aiSentinelaRaw.length) {
          return setAiStatus('Não encontrei perguntas do estudo no texto. Cole os parágrafos junto com as perguntas.', true);
        }

        // As respostas substituem o texto colado no campo de texto (como na leitura do site), cada uma com seu botão Copiar.
        // "Outra resposta" e "Melhorar" restauram o texto colado, refazem e substituem de novo.
        const parts = buildSentinelaParts(aiSentinelaRaw);
        aiResumo = { texto: parts.map(part => part.texto).join('\n\n\n'), partes: parts, done: false, kind: 'estudo' };
        replaceMainText(aiResumo.texto);
        historicoSalvar({ tipo: 'colado', titulo: '📖 Respostas do texto colado', partes: parts, refino: { kind: 'sentinela', linhas: lines, itens: aiSentinelaRaw } });
        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus('✅ Resposta finalizada e colada no campo de texto.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente com menos parágrafos.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        clearTimeout(timer);
        aiBusy = false;
        setAiLoading(false);
      }
    }

    aiSuggestBtn.addEventListener('click', () => requestAiSuggestions());
    const AI_STUDY_CODE_KEY = 'jwLibraryNoteAplicarStudyCodeV1';
    const AI_STUDY_CACHE_KEY = 'jwLibraryNoteAplicarStudyListV1';
    const aiStudyBtn = document.getElementById('aiStudyBtn');
    const aiStudyQuestionsBtn = document.getElementById('aiStudyQuestionsBtn');
    const aiStudyLoadBtn = document.getElementById('aiStudyLoadBtn');
    const aiStudyParagraphs = document.getElementById('aiStudyParagraphs');
    const aiStudyInfo = document.getElementById('aiStudyInfo');
    const aiStudyArticle = document.getElementById('aiStudyArticle');
    const aiStudyArticleBox = document.getElementById('aiStudyArticleBox');
    const aiParaPrev = document.getElementById('aiParaPrev');
    const aiParaNext = document.getElementById('aiParaNext');
    const aiStudyCode = document.getElementById('aiStudyCode');
    const leaderStudyLoadBtn = document.getElementById('leaderStudyLoadBtn');
    const leaderParagraphs = document.getElementById('leaderStudyParagraphs');
    const leaderStudyArticle = document.getElementById('leaderStudyArticle');
    const leaderStudyArticleBox = document.getElementById('leaderStudyArticleBox');
    const sentinelaBox = document.getElementById('sentinelaBox');
    let aiStudy = null; // { artigo, titulo, grupos } da semana mostrada; a lista vem da IA e fica guardada neste aparelho
    try { aiStudyCode.value = localStorage.getItem(AI_STUDY_CODE_KEY) || ''; } catch (e) { /* sem localStorage */ }

    const aiStudyStatus = document.getElementById('aiStudyStatus');

    // Mensagem do carregamento da lista de parágrafos, mostrada no card em que ele foi pedido (studyListCard).
    function setStudyStatus(message, isWarning) {
      aiStatusKind = 'lista';
      setAiStatus(message, isWarning);
    }

    function studyWeekKey() { return aiWeekYear + '-' + aiWeekNumber; }

    function readStudyCache() {
      try { return JSON.parse(localStorage.getItem(AI_STUDY_CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    function saveStudyCache(entry) {
      const cache = readStudyCache();
      cache[studyWeekKey()] = Object.assign({}, entry, { quando: Date.now() }); // o "quando" serve à retenção (carregadosLimpar)
      const keys = Object.keys(cache).sort();
      while (keys.length > 10) delete cache[keys.shift()];
      safeSetItem(AI_STUDY_CACHE_KEY, JSON.stringify(cache));
    }

    const STUDY_RECAP_LABEL = 'Recapitulação';

    // Cada card da Sentinela tem o seu campo de parágrafos (com setas); a semana e a lista carregada são as mesmas.
    // O do dirigente não tem a recapitulação (as perguntas adicionais são só para os parágrafos).
    const studyPickers = [
      { card: 'comentarios', input: aiStudyParagraphs, prev: aiParaPrev, next: aiParaNext, info: aiStudyInfo, titulo: document.getElementById('aiStudyTitulo'), pergunta: document.getElementById('aiStudyPergunta'), salva: document.getElementById('aiStudySalva'), load: aiStudyLoadBtn, recap: true },
      { card: 'dirigente', input: leaderParagraphs, prev: document.getElementById('leaderParaPrev'), next: document.getElementById('leaderParaNext'),
        info: document.getElementById('leaderStudyInfo'), titulo: document.getElementById('leaderStudyTitulo'), pergunta: document.getElementById('leaderStudyPergunta'), salva: document.getElementById('leaderStudySalva'), load: leaderStudyLoadBtn, recap: false }
    ];

    // Opções navegáveis: os grupos de parágrafos que a IA listou (os que compartilham pergunta vêm juntos) e
    // "Recapitulação" (o quadro "Qual é a sua resposta?" no fim do artigo, quando existe).
    function studyOptions(picker) {
      if (!aiStudy) return [];
      return aiStudy.grupos.concat(aiStudy.recapitulacao === false || !picker.recap ? [] : [STUDY_RECAP_LABEL]);
    }

    // Sem acento e em minúsculas, para "recapitulação", "Recapitulacao" e "RECAP" valerem o mesmo.
    function plainStudyText(text) {
      return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    }

    function isRecapText(text) {
      return /^(perguntas de )?recap/.test(plainStudyText(text));
    }

    // Posição atual na lista: pelo texto exato, ou pelo grupo que contém o primeiro número digitado (-1 = fora da lista).
    function currentStudyIndex(picker) {
      const options = studyOptions(picker);
      if (!options.length) return -1;
      const text = plainStudyText(picker.input.value);
      const exact = options.findIndex(option => plainStudyText(option) === text);
      if (exact >= 0) return exact;
      if (isRecapText(text)) return options.findIndex(option => plainStudyText(option) === 'recapitulacao');
      const number = Number((text.match(/\d+/) || [])[0]);
      if (!number) return -1;
      return options.findIndex(option => studyNumbers(option).includes(number));
    }

    // "1, 2" -> [1, 2]; "3-5" -> [3, 4, 5]
    function studyNumbers(label) {
      const numbers = [];
      String(label).split(',').forEach(part => {
        const range = part.match(/(\d+)\s*-\s*(\d+)/);
        if (range) {
          for (let n = Number(range[1]); n <= Number(range[2]) && n < 200; n++) numbers.push(n);
        } else if (/\d+/.test(part)) {
          numbers.push(Number(part.match(/\d+/)[0]));
        }
      });
      return numbers;
    }

    // ---------- Imagens dos artigos (descrição e legenda) ----------
    // O wol.jw.org guarda, de cada imagem, uma descrição (o texto alternativo, que antes só vinha ao copiar um trecho por cima da imagem) e a
    // legenda. Cada imagem aparece com a descrição (e um botão pequeno que copia SÓ a descrição) e a legenda.
    async function copiarDescricaoImagem(texto, botao) {
      let copiou = false;
      try {
        await navigator.clipboard.writeText(texto);
        copiou = true;
      } catch (e) {
        const campo = document.createElement('textarea');
        campo.value = texto;
        campo.style.cssText = 'position:fixed;left:-9999px;opacity:0';
        document.body.appendChild(campo);
        campo.select();
        try { copiou = document.execCommand('copy'); } catch (e2) { /* sem cópia */ }
        campo.remove();
      }
      if (!botao.dataset.rotulo) botao.dataset.rotulo = botao.textContent;
      botao.textContent = copiou ? '✅ Copiado' : 'Não copiou';
      clearTimeout(botao._volta);
      botao._volta = setTimeout(() => { botao.textContent = botao.dataset.rotulo; }, 1600);
    }

    // O texto copiado leva no começo o modelo "IMAGEM" do usuário (ex.: "⭐📷🏞️ DESCRICAO DA IMAGEM 👉"), que avisa que é a transcrição da imagem, e logo
    // depois a descrição; lido na hora de copiar (vale o modelo como está agora). Sem esse modelo, copia só a descrição, como antes.
    function textoDaImagemCopiada(descricao) {
      const modelo = aiTemplateByName('imagem');
      return modelo && String(modelo.content || '').trim() ? aiLabelWith(modelo, '', descricao) : descricao;
    }

    function imagemBloco(imagem) {
      if (!imagem || (!imagem.descricao && !imagem.legenda)) return null;
      const bloco = document.createElement('div');
      bloco.className = 'study-imagem';
      if (imagem.descricao) {
        const desc = document.createElement('p');
        const rotulo = document.createElement('strong');
        rotulo.textContent = '🖼️ Descrição da imagem:';
        desc.append(rotulo, ' ' + imagem.descricao);
        const copiar = document.createElement('button');
        copiar.type = 'button';
        copiar.className = 'secondary study-imagem-copiar';
        copiar.textContent = '📋 Copiar';
        copiar.title = 'Copia a descrição da imagem, com o seu modelo IMAGEM no começo (se existir)';
        copiar.setAttribute('aria-label', 'Copiar a descrição da imagem, com o modelo IMAGEM no começo');
        copiar.addEventListener('click', () => copiarDescricaoImagem(textoDaImagemCopiada(imagem.descricao), copiar));
        // O botão fica na linha de baixo da descrição, à esquerda — não no fim da frase (que desalinha quando o texto tem tamanhos diferentes).
        bloco.append(desc, copiar);
      }
      if (imagem.legenda) {
        const leg = document.createElement('p');
        leg.className = 'study-imagem-legenda';
        const rotulo = document.createElement('strong');
        rotulo.textContent = '💬 Legenda:';
        leg.append(rotulo, ' ' + imagem.legenda);
        bloco.appendChild(leg);
      }
      return bloco;
    }

    // Lista recolhível "🖼️ Imagens (N)" logo depois do elemento âncora (o texto de informações do cartão); sem imagens, tira a que havia.
    function imagensRender(ancora, imagens, titulo) {
      if (!ancora) return;
      if (ancora._imagensEl) { ancora._imagensEl.remove(); ancora._imagensEl = null; }
      const blocos = (Array.isArray(imagens) ? imagens : []).map(imagemBloco).filter(Boolean);
      if (!blocos.length) return;
      const caixa = document.createElement('details');
      caixa.className = 'imagens-box';
      const resumo = document.createElement('summary');
      resumo.textContent = '🖼️ ' + (titulo || 'Imagens') + ' (' + blocos.length + ')';
      caixa.appendChild(resumo);
      blocos.forEach(b => caixa.appendChild(b));
      ancora.insertAdjacentElement('afterend', caixa);
      ancora._imagensEl = caixa;
    }

    // Perguntas dos parágrafos pedidos (o artigo traz uma por grupo de parágrafos): [{ rotulo, pergunta }]. Recapitulação e
    // listas feitas antes de o app guardar as perguntas ficam sem (recarregar os parágrafos traz as perguntas).
    function studyQuestions(picker) {
      if (!aiStudy || !Array.isArray(aiStudy.perguntas) || !aiStudy.perguntas.length) return [];
      const text = picker.input.value;
      if (isRecapText(text)) return [];
      const wanted = new Set(studyNumbers(text));
      if (!wanted.size) return [];
      const found = [];
      aiStudy.grupos.forEach((group, i) => {
        const question = aiStudy.perguntas[i];
        if (question && studyNumbers(group).some(n => wanted.has(n))) found.push({ rotulo: group, pergunta: question, imagens: (Array.isArray(aiStudy.imagens) && Array.isArray(aiStudy.imagens[i]) ? aiStudy.imagens[i] : []) });
      });
      return found.slice(0, 8);
    }

    function showStudyQuestions(picker) {
      const box = picker.pergunta;
      if (!box) return;
      box.textContent = '';
      studyQuestions(picker).forEach(item => {
        const p = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = (studyNumbers(item.rotulo).length > 1 ? 'Pergunta dos parágrafos ' : 'Pergunta do parágrafo ') + item.rotulo + ':';
        p.appendChild(label);
        p.appendChild(document.createTextNode(' ' + item.pergunta));
        box.appendChild(p);
        // As imagens do parágrafo: a descrição que o wol.jw.org guarda (antes só vinha ao copiar um trecho por cima da imagem) e a legenda.
        (item.imagens || []).forEach(imagem => {
          const bloco = imagemBloco(imagem);
          if (bloco) box.appendChild(bloco);
        });
      });
    }

    // ---------- Resposta salva do parágrafo ----------
    // As respostas de A Sentinela (e as perguntas adicionais do dirigente) ficam salvas neste aparelho (Pesquisas e respostas salvas).
    // Ao escolher parágrafos que já têm resposta salva nesta semana, o app avisa e oferece recuperá-la, sem nova consulta à IA.
    let studySalvasPronto = false; // liga depois que a semana é calculada (refreshStudyPicker)

    // O que um rótulo cobre: os números dos parágrafos ("1, 2" -> [1, 2]) ou 'recap' ("Recap. 1", "Recapitulação").
    function studyChave(rotulo) {
      return isRecapText(rotulo) ? ['recap'] : [...new Set(studyNumbers(rotulo))];
    }

    // Pesquisas do dirigente (e antigas, sem rótulo nas partes): os parágrafos vêm do fim do título ("… · parágrafos 3-5").
    function studyRotuloDoTitulo(titulo) {
      const m = String(titulo).match(/ · (?:parágrafos\s+([\d,\s–-]+)|(recap\w*))\s*$/i);
      return m ? (m[1] || m[2]).trim() : '';
    }

    function historicoQuando(item) {
      const data = new Date(item.data);
      return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // A pesquisa salva desta semana que cobre mais dos parágrafos pedidos (a mais recente, se empatar), com as partes que valem para eles.
    function studySalvas(picker) {
      const dirigente = picker.card === 'dirigente';
      if (dirigente && !codigoDirigenteSalvo()) return null;
      const wanted = studyChave(picker.input.value);
      if (!wanted.length) return null;
      const tipo = dirigente ? 'dirigente' : 'sentinela';
      const atual = historicoChaveAtual();
      let melhor = null;
      historicoLer().forEach(item => {
        if (item.tipo !== tipo || historicoChave(item) !== atual) return;
        const doTitulo = studyRotuloDoTitulo(item.titulo);
        const partes = [];
        const cobertos = new Set();
        (item.partes || []).forEach(parte => {
          const comuns = studyChave(dirigente ? doTitulo : (parte.paragrafos || doTitulo)).filter(c => wanted.includes(c));
          if (!comuns.length) return;
          partes.push(parte);
          comuns.forEach(c => cobertos.add(c));
        });
        if (!partes.length) return;
        if (!melhor || cobertos.size > melhor.cobertos.length) melhor = { item, partes, cobertos: [...cobertos], rotulo: dirigente ? doTitulo : '' };
      });
      if (!melhor) return null;
      melhor.cobertos.sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : 0));
      melhor.faltam = wanted.filter(w => w !== 'recap' && !melhor.cobertos.includes(w));
      return melhor;
    }

    function studySalvaTexto(picker, salva) {
      const coisa = picker.card === 'dirigente' ? 'perguntas adicionais salvas' : 'resposta salva';
      const lista = salva.cobertos.join(', ');
      const quem = salva.cobertos[0] === 'recap' ? 'A recapitulação já tem ' + coisa
        : salva.cobertos.length === 1 ? 'O parágrafo ' + lista + ' já tem ' + coisa
          : 'Os parágrafos ' + lista + ' já têm ' + coisa;
      const junto = salva.rotulo && plainStudyText(salva.rotulo) !== plainStudyText(picker.input.value) ? ', pedidas com os parágrafos ' + salva.rotulo : '';
      return '💾 ' + quem + ' (salva em ' + historicoQuando(salva.item) + junto + ').'
        + (salva.faltam.length ? ' Ainda sem resposta salva: ' + salva.faltam.join(', ') + '.' : '');
    }

    function showStudySaved(picker) {
      const box = picker.salva;
      if (!box) return;
      const salva = studySalvasPronto ? studySalvas(picker) : null;
      box.hidden = !salva;
      if (salva) box.querySelector('p').textContent = studySalvaTexto(picker, salva);
    }

    // Chamado quando a lista de pesquisas salvas muda (salvar, apagar, trocar de semana).
    function studySalvasAtualizar() {
      if (studySalvasPronto) studyPickers.forEach(showStudySaved);
    }

    async function studyRecuperar(picker) {
      const salva = studySalvas(picker);
      if (!salva) return studySalvasAtualizar();
      // Só parte da pesquisa vale para os parágrafos pedidos: traz só essas partes (a pesquisa com alterações suas é aberta inteira).
      const inteira = salva.partes.length === (salva.item.partes || []).length || Boolean(salva.item.textoEditado);
      const aberto = await historicoAbrir(salva.item.id, inteira ? undefined : salva.partes);
      if (!aberto) return;
      aiStatusKind = picker.card === 'dirigente' ? 'dirigente' : 'estudo';
      setAiStatus(picker.card === 'dirigente' ? '✅ Perguntas salvas colocadas no campo de texto.' : '✅ Resposta salva colocada no campo de texto.', false);
    }

    function updateStudyPicker() {
      studyPickers.forEach(picker => {
        const options = studyOptions(picker);
        const index = currentStudyIndex(picker);
        picker.prev.disabled = !options.length || index <= 0;
        picker.next.disabled = !options.length || index >= options.length - 1;
        // Durante o carregamento o botão mostra "Consultando o wol.jw.org…": o rótulo volta no fim (setAiLoading).
        if (!picker.load.dataset.label) picker.load.textContent = aiStudy ? '↻ Recarregar perguntas' : '📋 Carregar perguntas';
        const exact = options.some(option => plainStudyText(option) === plainStudyText(picker.input.value));
        picker.info.textContent = aiStudy ? (exact ? 'opção ' + (index + 1) + ' de ' + options.length : 'texto livre') : '';
        // O tema do artigo carregado é o título do cartão (em destaque); sem perguntas carregadas, "Aguardando carregar perguntas".
        if (picker.titulo) {
          const texto = aiStudy ? aiStudy.titulo || '' : 'Aguardando carregar perguntas';
          picker.titulo.textContent = texto;
          picker.titulo.hidden = !texto;
          picker.titulo.classList.toggle('study-tema', Boolean(aiStudy && texto));
          picker.titulo.classList.toggle('study-aguardando', !aiStudy);
        }
        showStudyQuestions(picker);
        showStudySaved(picker);
      });
    }

    function stepStudy(picker, delta) {
      const options = studyOptions(picker);
      if (!options.length) return;
      const next = Math.min(options.length - 1, Math.max(0, currentStudyIndex(picker) + delta));
      picker.input.value = options[next];
      updateStudyPicker();
    }

    // Ao digitar "recap", mostra "Recapitulação". Os números ficam como foram digitados (ex.: só o 4, mesmo que
    // as setas mostrem "4, 5"); as setas continuam andando a partir do grupo desse número.
    function normalizeStudyInput(picker) {
      const options = studyOptions(picker);
      const text = picker.input.value.trim();
      if (options.length && isRecapText(text)) {
        const index = currentStudyIndex(picker);
        if (index >= 0) picker.input.value = options[index];
      }
      updateStudyPicker();
    }

    // O número ou link do artigo (quando o app não acha o artigo sozinho) vale para os dois cards.
    function showStudyArticleBox(show) {
      aiStudyArticleBox.hidden = !show;
      leaderStudyArticleBox.hidden = !show;
    }
    [aiStudyArticle, leaderStudyArticle].forEach((field, i, both) => field.addEventListener('input', () => {
      both.forEach(other => { if (other !== field) other.value = field.value; });
    }));

    // Chamado ao trocar de semana: usa a lista guardada dessa semana, se existir.
    function refreshStudyPicker() {
      studySalvasPronto = true;
      const cached = readStudyCache()[studyWeekKey()];
      aiStudy = cached && Array.isArray(cached.grupos) && cached.grupos.length ? cached : null;
      studyPickers.forEach(picker => { picker.input.value = aiStudy ? aiStudy.grupos[0] : '1'; });
      aiStudyArticle.value = '';
      leaderStudyArticle.value = '';
      showStudyArticleBox(false);
      updateStudyPicker();
    }

    // Faz a chamada ao servidor das tarefas de estudo (lista e respostas). Devolve { ok, data, unavailable }.
    async function postStudy(payload, timeoutMs) {
      // As tarefas que usam a IA pedem, uma vez, a concordância com o envio do texto (as que só leem o wol.jw.org passam direto).
      if (payload && IA_TAREFAS.has(payload.tarefa) && !(await garantirConsentimentoIa())) {
        return { ok: false, data: { erro: MSG_SEM_CONSENTIMENTO }, unavailable: false };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corpoIa(payload),
          signal: controller.signal
        });
        let data = null;
        try { data = await response.json(); } catch (e) { /* resposta sem JSON */ }
        // O servidor recusou o código do S-34 salvo (variável trocada): apaga e esconde a seção.
        if (response.status === 403 && data && /^Código do S-34 inválido/.test(data.erro || '')) s34CodigoInvalido();
        // 404 ou 501 sem mensagem do servidor = a rota não existe (site fora do ar ou app aberto fora do site publicado). Com
        // "erro" na resposta o servidor respondeu de verdade (por exemplo, "esta semana não tem discurso"): a mensagem dele vale.
        return { ok: response.ok && !!data, data, unavailable: (response.status === 404 || response.status === 501) && !(data && data.erro) };
      } finally {
        clearTimeout(timer);
      }
    }

    // Acesso das funções do dirigente: só o código do dirigente (o servidor também o aceita sozinho para elas).
    function dirigenteAccessError() {
      if (!codigoDirigenteSalvo()) return 'Salve o código do dirigente em Ajustes → 🔐 Autorização de acessos.';
      if (!navigator.onLine) return 'Sem conexão com a internet.';
      return '';
    }

    // O servidor recusou o código do dirigente salvo: apaga, desabilita as opções e oferece informar o novo. Devolve true se era isso.
    async function dirigenteRecusado(result) {
      if (!/^Código do dirigente inválido/.test((result.data && result.data.erro) || '')) return false;
      dirigenteInvalido();
      if (await askConfirm('O código do dirigente que estava salvo não vale mais, e as opções do dirigente foram desabilitadas. Quer informar o novo código agora?', 'Código do dirigente')) {
        showScreen('ajustes');
        abrirAcessos('dirigente');
      }
      return true;
    }

    function studyAccessError() {
      if (!codigoAcessoSalvo()) return 'Salve o código de pesquisa em Ajustes → 🔐 Autorização de acessos.';
      if (!navigator.onLine) return 'Sem conexão com a internet.';
      return '';
    }

    // Confere os parágrafos pedidos antes de chamar a IA ('' = tudo certo). Passou do máximo: avisa também num quadro.
    function studyParagraphsError(requested, allowRecap) {
      if (isRecapText(requested)) return allowRecap ? '' : 'As perguntas adicionais são para os parágrafos: escolha um ou mais (ex.: 3 ou 1-4).';
      const count = new Set(studyNumbers(requested)).size;
      if (!count) return 'Informe os parágrafos (ex.: 3, 1-4 ou recapitulação).';
      if (count > AI_STUDY_MAX_PARAGRAPHS) {
        const max = AI_STUDY_MAX_PARAGRAPHS + (AI_STUDY_MAX_PARAGRAPHS === 1 ? ' parágrafo' : ' parágrafos');
        const message = 'Você pediu ' + count + ' parágrafos, mas o máximo permitido é de ' + max + ' por consulta. Peça menos parágrafos de cada vez.';
        showAlert(message, '⚠️ Parágrafos demais');
        return message;
      }
      return '';
    }

    function studyArticleId() {
      return (aiStudy && aiStudy.artigo) || aiStudyArticle.value.trim();
    }

    function studyFailureMessage(result, fallback) {
      if (result.unavailable) return 'A IA só funciona no site publicado (notestyle.com.br).';
      return (result.data && result.data.erro) || fallback;
    }

    // A IA lê o artigo da semana e devolve os grupos de parágrafos para navegar com as setas.
    async function requestStudyList(picker) {
      if (aiBusy) return;
      aiStatusKind = 'lista';
      studyListCard = picker.card;
      const doDirigente = picker.card === 'dirigente';
      const accessError = doDirigente ? dirigenteAccessError() : studyAccessError();
      if (accessError) return setStudyStatus(accessError, true);

      aiBusy = true;
      setStudyStatus('', false);
      setAiLoading(true, picker.load, 'site');

      try {
        const code = codigoAcessoSalvo();
        const result = await postStudy({
          tarefa: 'estudo-lista',
          codigo: code,
          ...(doDirigente ? { codigoDirigente: codigoDirigenteSalvo() } : {}),
          artigo: aiStudyArticle.value.trim(),
          ano: aiWeekYear,
          semana: aiWeekNumber
        }, IA_ESPERA_MS);
        if (!result.ok && doDirigente && await dirigenteRecusado(result)) return;

        const groups = result.ok && Array.isArray(result.data.grupos) ? result.data.grupos : [];
        if (!groups.length) {
          showStudyArticleBox(true);
          return setStudyStatus(studyFailureMessage(result, 'Não consegui listar os parágrafos.') + ' Se precisar, informe o número ou o link do artigo.', true);
        }

        aiStudy = {
          artigo: result.data.artigo || '',
          titulo: result.data.titulo || '',
          grupos: groups,
          perguntas: Array.isArray(result.data.perguntas) ? result.data.perguntas.map(q => String(q || '')) : [],
          imagens: Array.isArray(result.data.imagens) ? result.data.imagens.map(lista => (Array.isArray(lista) ? lista : []).map(i => ({ descricao: String((i && i.descricao) || ''), legenda: String((i && i.legenda) || '') }))) : [],
          recapitulacao: result.data.recapitulacao !== false
        };
        saveStudyCache(aiStudy);
        showStudyArticleBox(false);
        studyPickers.forEach(p => { p.input.value = groups[0]; });
        updateStudyPicker();
        setStudyStatus(groups.length + (groups.length === 1 ? ' pergunta carregada.' : ' perguntas carregadas.'), false);
      } catch (e) {
        setStudyStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente de novo.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
        updateStudyPicker(); // o botão volta ao texto salvo; reaplica o rótulo certo
      }
    }

    // mode: undefined = primeira vez; 'nova' = respostas diferentes; 'melhorar' = refinar as anteriores.
    // O servidor lê o artigo no wol.jw.org e manda à IA só as perguntas e os parágrafos pedidos. Se essa leitura
    // falhar, a IA lê a página (web_fetch, só wol.jw.org). Devolve só as respostas.
    async function requestStudyAnswers(mode) {
      if (aiBusy) return;
      aiLastKind = 'estudo';
      aiStatusKind = 'estudo';
      placeAiOutput(sentinelaOutputSlot);

      const refino = mode ? aiRefinoDe('estudo') : null; // refazer: o pedido da resposta que está no campo, não o que está nas caixas agora
      const requested = refino ? refino.paragrafos : aiStudyParagraphs.value.trim();
      const paragraphError = studyParagraphsError(requested, true);
      if (paragraphError) return setAiStatus(paragraphError, true);

      const accessError = studyAccessError();
      if (accessError) return setAiStatus(accessError, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
        // As respostas novas ficam sozinhas no campo de texto: o que havia antes (respostas anteriores, por exemplo) sai.
        if (input.value) {
          setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para as novas respostas.' });
          autoGrowInputText();
        }
      }

      aiResults.textContent = '';
      aiSuggestions = [];
      aiRaw = [];
      const previousAnswers = mode && aiResumo && aiSentinelaRaw.length ? aiSentinelaRaw : null;
      aiResumo = null;
      updateAiControls();

      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      const code = codigoAcessoSalvo();
      const payload = {
        tarefa: 'estudo',
        codigo: code,
        artigo: refino ? refino.artigo : studyArticleId(),
        ano: aiWeekYear,
        semana: aiWeekNumber,
        paragrafos: requested,
        opcoes: readAiOptions(),
        ajuste: iaExtra('estudo')
      };
      if (previousAnswers) {
        payload.modo = mode;
        payload.anteriores = { itens: previousAnswers };
      }

      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : aiStudyBtn);

      try {
        const result = await postStudy(payload, IA_ESPERA_MS);

        if (!result.ok) return setAiStatus(studyFailureMessage(result, 'Não foi possível ler o estudo agora.'), true);

        aiSentinelaRaw = Array.isArray(result.data.itens) ? result.data.itens : [];
        if (!aiSentinelaRaw.length) {
          showStudyArticleBox(true);
          return setAiStatus((result.data.erro || 'Não encontrei perguntas nesse artigo.') + ' Se for o caso, informe o número ou o link do artigo.', true);
        }

        const parts = buildSentinelaParts(aiSentinelaRaw);
        aiResumo = { texto: parts.map(part => part.texto).join('\n\n\n'), partes: parts, done: false, kind: 'estudo', fonte: result.data.titulo || '' };
        appendToMainText(aiResumo.texto);
        aiRefino = { kind: 'estudo', paragrafos: requested, artigo: payload.artigo };
        historicoSalvar({
          tipo: 'sentinela',
          titulo: '📖 A Sentinela' + (result.data.titulo ? ' · ' + result.data.titulo : '') + ' · ' + (/^\d/.test(requested) ? 'parágrafos ' + requested : requested),
          ano: payload.ano,
          numSemana: payload.semana,
          partes: parts,
          refino: { ...aiRefino, itens: aiSentinelaRaw }
        });
        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus('✅ Resposta finalizada e colada no campo de texto.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente com menos parágrafos.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    // Perguntas adicionais para o dirigente, em três seções por pergunta impressa: 1) complementares (pontos do parágrafo
    // que a pergunta impressa não cobre), 2) aplicativas (aplicação prática do ponto principal) e 3) explicação dos textos
    // (só com as opções marcadas: aplicação 📖 e entendimento 🔎). Seção sem perguntas não aparece. Vão para o fim do campo
    // de texto, sem apagar o que já está nele (por exemplo, as respostas). Uma linha em branco separa cada cabeçalho da
    // primeira pergunta e cada pergunta da seguinte.
    function buildStudyQuestionsText(items) {
      const bold = text => {
        const styleId = aiStyleIdFor('negrito');
        return styleId ? convertTextWithStyle(text, styleId) : text;
      };
      const list = value => (Array.isArray(value) ? value : []);
      return items.map(item => {
        const lines = ['💬 ' + bold('PERGUNTAS ADICIONAIS') + ' 👉 ' + (item.paragrafos ? item.paragrafos + '.' : '')];
        const section = (title, questions) => {
          if (questions.length) lines.push(title, ...questions);
        };
        section('1️⃣ ' + bold('Perguntas complementares'), list(item.complementares).map(q => '❔ ' + q));
        section('2️⃣ ' + bold('Perguntas aplicativas'), list(item.aplicativas).map(q => '💡 ' + q));
        section('3️⃣ ' + bold('Explicação dos textos'), [
          ...list(item.perguntasTextos).map(t => '📖 ' + bold(t.referencia) + ' ➜ ' + t.pergunta),
          ...list(item.perguntasEntendimento).flatMap(t => list(t.perguntas).map(q => '🔎 ' + bold(t.referencia) + ' ➜ ' + q))
        ]);
        return lines.join('\n\n');
      }).join('\n\n');
    }

    // mode: undefined = primeira vez; 'nova' = outras perguntas; 'melhorar' = refinar as anteriores. As perguntas novas limpam o campo de texto
    // antes de entrar (como as respostas do estudo); refazer troca só elas.
    async function requestStudyQuestions(mode) {
      if (aiBusy) return;
      aiLastKind = 'dirigente';
      aiStatusKind = 'dirigente';
      const refino = mode ? aiRefinoDe('dirigente') : null; // refazer: o pedido das perguntas que estão no campo, não o das caixas agora
      const requested = refino ? refino.paragrafos : leaderParagraphs.value.trim();
      const paragraphError = studyParagraphsError(requested, false);
      if (paragraphError) return setAiStatus(paragraphError, true);
      const sections = refino ? Object.assign({}, readAiOptions(), refino.secoes) : readAiOptions();
      if (!sections.perguntasComplementares && !sections.perguntasAplicativas && !sections.perguntasTextos && !sections.perguntasEntendimento) {
        return setAiStatus('Marque pelo menos uma seção das perguntas.', true);
      }
      const accessError = dirigenteAccessError();
      if (accessError) return setAiStatus(accessError, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
        // As perguntas novas ficam sozinhas no campo de texto (como as respostas do estudo): o que havia antes sai (o botão ↩️ desfaz).
        if (input.value) {
          setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para as novas perguntas.' });
          autoGrowInputText();
        }
      }
      const previous = mode && aiResumo && aiSentinelaRaw.length ? aiSentinelaRaw : null;
      if (!aiAppliedAny) aiBaseText = input.value;

      saveAiOptions();
      const code = codigoAcessoSalvo();
      const payload = {
        tarefa: 'estudo-perguntas',
        codigo: code,
        codigoDirigente: codigoDirigenteSalvo(),
        artigo: refino ? refino.artigo : studyArticleId(),
        ano: aiWeekYear,
        semana: aiWeekNumber,
        paragrafos: requested,
        opcoes: Object.assign(readAiOptions(), refino ? refino.secoes : {}),
        ajuste: iaExtra('dirigente')
      };
      if (previous) {
        payload.modo = mode;
        payload.anteriores = { itens: previous };
      }
      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : aiStudyQuestionsBtn);
      try {
        const result = await postStudy(payload, IA_ESPERA_MS);
        if (!result.ok) {
          if (await dirigenteRecusado(result)) return;
          return setAiStatus(studyFailureMessage(result, 'Não foi possível sugerir perguntas agora.'), true);
        }
        const items = Array.isArray(result.data.itens) ? result.data.itens : [];
        if (!items.length) return setAiStatus(result.data.erro || 'A IA não sugeriu perguntas para esse parágrafo. Tente de novo.', true);

        const current = input.value.replace(/\s+$/, '');
        const perguntasTexto = buildStudyQuestionsText(items);
        setInputRange(0, input.value.length, (current ? current + '\n\n' : '') + perguntasTexto, { message: '✅ Perguntas adicionais colocadas no fim do campo de texto.' });
        autoGrowInputText();
        aiAppliedAny = true;
        aiAppliedSnapshot = input.value;
        aiSentinelaRaw = items;
        aiResumo = { texto: perguntasTexto, partes: [{ paragrafos: 'perguntas', texto: perguntasTexto }], done: false, kind: 'estudo', semBotoes: true, fonte: result.data.titulo || '' };
        aiRefino = {
          kind: 'dirigente',
          paragrafos: requested,
          artigo: payload.artigo,
          secoes: {
            perguntasComplementares: Boolean(sections.perguntasComplementares),
            perguntasAplicativas: Boolean(sections.perguntasAplicativas),
            perguntasTextos: Boolean(sections.perguntasTextos),
            perguntasEntendimento: Boolean(sections.perguntasEntendimento)
          }
        };
        historicoSalvar({ tipo: 'dirigente', titulo: '🎤 Perguntas do dirigente · parágrafos ' + requested, partes: [{ paragrafos: 'perguntas', texto: perguntasTexto }], refino: { ...aiRefino, itens: items } });
        updateAiControls();
        aiRefineBox.hidden = false;
        setAiStatus('✅ Perguntas adicionais colocadas no fim do campo de texto.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente com menos parágrafos.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    aiStudyBtn.addEventListener('click', () => requestStudyAnswers());
    aiStudyQuestionsBtn.addEventListener('click', () => requestStudyQuestions());
    studyPickers.forEach(picker => {
      picker.load.addEventListener('click', () => requestStudyList(picker));
      picker.prev.addEventListener('click', () => stepStudy(picker, -1));
      picker.next.addEventListener('click', () => stepStudy(picker, 1));
      picker.input.addEventListener('change', () => normalizeStudyInput(picker));
      picker.input.addEventListener('input', updateStudyPicker);
      picker.salva.querySelector('button').addEventListener('click', () => studyRecuperar(picker));
    });
    updateStudyPicker();
    aiSentinelaBtn.addEventListener('click', () => requestSentinelaAnswers());
    const refineAi = mode => (
      aiLastKind === 'estudo' ? requestStudyAnswers(mode)
        : aiLastKind === 'dirigente' ? requestStudyQuestions(mode)
        : aiLastKind === 'ebc' ? requestEbcAnswers(mode)
          : aiLastKind === 'ebcdir' ? requestEbcDirigente(mode)
          : aiLastKind === 'tesouros' ? requestTesouros(mode)
          : aiLastKind === 'discurso' ? requestDiscursoCurto(mode)
          : aiLastKind === 'publico' ? requestEsboco(ESBOCOS.publico, mode)
          : aiLastKind === 'outros' ? requestEsboco(ESBOCOS.outros, mode)
          : aiLastKind === 'joias' ? requestJoias(mode)
          : aiLastKind === 'sentinela' ? requestSentinelaAnswers(mode)
            : requestAiSuggestions(mode)
    );

    // ---------- Estudo Bíblico de Congregação ----------
    // O servidor lê o capítulo da semana (página de reuniões -> apostila Vida e Ministério -> item "Estudo bíblico de
    // congregação") e a IA responde às perguntas dos quadros marcados, no mesmo estilo das respostas de A Sentinela
    // (tamanho, formatação e textos bíblicos das opções da IA). As respostas vão para o campo de texto, cada uma com o
    // botão azul de copiar. Os quadros marcados ficam guardados neste aparelho.
    const EBC_KEY = 'jwLibraryNoteAplicarEbcV1';
    const ebcInfo = document.getElementById('ebcInfo');
    const ebcCarregarBtn = document.getElementById('ebcCarregarBtn');
    const ebcResponderBtn = document.getElementById('ebcResponderBtn');
    const ebcOutputSlot = document.getElementById('ebcOutputSlot');
    const ebcQuadros = Array.from(document.querySelectorAll('[data-ebc-quadro]'));
    const ebcEscolhas = () => ({ quadros: ebcQuadros.filter(c => c.checked).map(c => c.dataset.ebcQuadro) });
    try {
      const salvo = JSON.parse(localStorage.getItem(EBC_KEY) || 'null');
      if (salvo && Array.isArray(salvo.quadros)) {
        ebcQuadros.forEach(c => { c.checked = salvo.quadros.includes(c.dataset.ebcQuadro); });
      }
    } catch (e) { /* sem localStorage: valem os padrões */ }
    ebcQuadros.forEach(c => c.addEventListener('change', () => safeSetItem(EBC_KEY, JSON.stringify(ebcEscolhas()))));

    // Cada cartão do Estudo Bíblico: onde ficam a linha de informações, o título e o botão de carregar.
    const EBC_CARTOES = [
      { info: 'ebcInfo', titulo: 'ebcTitulo', botao: 'ebcCarregarBtn' },
      { info: 'ebcDirInfo', titulo: 'ebcDirTitulo', botao: 'ebcDirCarregarBtn' }
    ];

    // Capítulo carregado: matéria e título (com o link do capítulo no wol.jw.org) viram o título do cartão, em destaque; a linha de
    // informações fica só com quantas perguntas há em cada quadro. Sem capítulo (dados vazios): "Aguardando carregar perguntas".
    function ebcMostrarInfo(dados, alvo = ebcInfo) {
      alvo.textContent = '';
      imagensRender(alvo, null);
      const cartao = EBC_CARTOES.find(c => document.getElementById(c.info) === alvo);
      const carregado = Boolean(dados && dados.titulo);
      const titulo = cartao && document.getElementById(cartao.titulo);
      if (titulo) {
        titulo.textContent = '';
        if (carregado) {
          const link = document.createElement('a');
          link.href = dados.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = [dados.materia, dados.titulo].filter(Boolean).join(' · ');
          titulo.appendChild(link);
        } else {
          titulo.textContent = 'Aguardando carregar perguntas';
        }
        titulo.classList.toggle('study-tema', carregado);
        titulo.classList.toggle('study-aguardando', !carregado);
      }
      const botao = cartao && document.getElementById(cartao.botao);
      if (botao) {
        const rotulo = carregado ? '↻ Recarregar perguntas' : '📋 Carregar perguntas';
        if (botao.dataset.label) botao.dataset.label = rotulo; // carregando: o rótulo volta ao fim (setAiLoading)
        else botao.textContent = rotulo;
      }
      if (!carregado) return;
      const quadros = (dados.quadros || []).filter(q => q.perguntas);
      if (quadros.length) alvo.append(quadros.map(q => q.nome + ': ' + q.perguntas).join(' · '));
      imagensRender(alvo, dados.imagens, 'Imagens do capítulo');
    }

    const ebcCarregado = id => document.getElementById(id).classList.contains('study-tema');

    // ---------- Dados carregados dos sites, guardados neste aparelho ----------
    // O que os botões "Carregar perguntas", "Carregar discurso" e "Carregar imagens" leem no wol.jw.org (o capítulo do Estudo Bíblico, a
    // leitura das joias, as imagens da apostila e os discursos da semana) é guardado por semana neste aparelho: ao abrir o app ou voltar a uma
    // semana já carregada, o cartão já aparece carregado, sem ler o site de novo. "Recarregar" lê outra vez e troca o que foi guardado.
    // Retenção: só ficam as semanas atual, anterior e seguinte (pela data de hoje); o que foi carregado de outra semana pode ser usado no dia
    // em que foi carregado e é apagado a partir do dia seguinte (carregadosLimpar). Além disso ficam no máximo as 40 leituras mais recentes
    // (e ~600 mil caracteres). A lista do estudo de A Sentinela (readStudyCache) segue a mesma regra de semanas.
    // Se o formato dos dados mudar numa versão futura, troque o V1 do nome da chave para o app não usar os guardados antes.
    const CARREGADOS_KEY = 'jwLibraryNoteAplicarCarregadosV1';
    const CARREGADOS_MAX = 40;
    const CARREGADOS_MAX_CARACTERES = 600000;
    const carregadoChave = tipo => tipo + '|' + aiWeekYear + '-' + aiWeekNumber;

    function carregadosLer() {
      try {
        const todos = JSON.parse(localStorage.getItem(CARREGADOS_KEY) || '{}');
        return todos && typeof todos === 'object' && !Array.isArray(todos) ? todos : {};
      } catch (e) {
        return {};
      }
    }

    // O que foi guardado de um tipo (ebc, joias, imagens, tesouros, discurso) para a semana escolhida; null se não há.
    function carregadoDe(tipo) {
      const entrada = carregadosLer()[carregadoChave(tipo)];
      return entrada && entrada.dados && typeof entrada.dados === 'object' ? entrada.dados : null;
    }

    // As semanas que a retenção mantém (ano-semana ISO): a de hoje, a anterior e a seguinte.
    function semanasRetidas() {
      const hoje = new Date();
      return new Set([-7, 0, 7].map(dias => {
        const [ano, semana] = isoYearWeek(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias));
        return ano + '-' + semana;
      }));
    }

    // Apaga o que foi carregado de uma semana fora da retenção, a não ser que tenha sido carregado hoje (sai a partir do dia seguinte), na
    // lista guardada do estudo de A Sentinela e nos demais dados carregados. Roda ao abrir o app, ao voltar a ele e a cada leitura guardada.
    function carregadosLimpar() {
      const retidas = semanasRetidas();
      const hoje = new Date().toDateString();
      const vale = (semana, quando) => retidas.has(semana) || (Number(quando) > 0 && new Date(Number(quando)).toDateString() === hoje);
      const todos = carregadosLer();
      let mudou = false;
      Object.keys(todos).forEach(chave => {
        if (!vale(chave.split('|')[1], todos[chave] && todos[chave].quando)) { delete todos[chave]; mudou = true; }
      });
      if (mudou) safeSetItem(CARREGADOS_KEY, JSON.stringify(todos));
      const estudos = readStudyCache();
      mudou = false;
      Object.keys(estudos).forEach(semana => {
        if (!vale(semana, estudos[semana] && estudos[semana].quando)) { delete estudos[semana]; mudou = true; }
      });
      if (mudou) safeSetItem(AI_STUDY_CACHE_KEY, JSON.stringify(estudos));
    }

    function carregadoGuardar(tipo, dados) {
      if (!dados || typeof dados !== 'object') return;
      carregadosLimpar();
      const todos = carregadosLer();
      todos[carregadoChave(tipo)] = { quando: Date.now(), dados };
      const chaves = Object.keys(todos).sort((a, b) => ((todos[a] && todos[a].quando) || 0) - ((todos[b] && todos[b].quando) || 0));
      while (chaves.length > CARREGADOS_MAX) delete todos[chaves.shift()];
      let json = JSON.stringify(todos);
      while (json.length > CARREGADOS_MAX_CARACTERES && chaves.length > 1) {
        delete todos[chaves.shift()];
        json = JSON.stringify(todos);
      }
      safeSetItem(CARREGADOS_KEY, json);
    }

    // Semana trocada na barra do alto (ou app aberto): mostra o capítulo guardado dessa semana, se houver; senão, "Aguardando carregar".
    function ebcSemanaMudou() {
      const guardado = carregadoDe('ebc');
      EBC_CARTOES.forEach(c => {
        const info = document.getElementById(c.info);
        if (info) ebcMostrarInfo(guardado, info);
      });
    }

    async function ebcCarregar() {
      if (aiBusy) return;
      aiStatusKind = 'ebc';
      const accessError = studyAccessError();
      if (accessError) return setAiStatus(accessError, true);
      aiBusy = true;
      setAiLoading(true, ebcCarregarBtn, 'site');
      try {
        const result = await postStudy({ tarefa: 'ebc-ler', codigo: codigoAcessoSalvo(), ano: aiWeekYear, semana: aiWeekNumber }, 60000);
        if (!result.ok) return setAiStatus(studyFailureMessage(result, 'Não consegui ler o capítulo agora.'), true);
        ebcMostrarInfo(result.data);
        carregadoGuardar('ebc', result.data);
        setAiStatus('✅ Capítulo da semana carregado.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao ler o capítulo.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    // "📖 TEXTOS-BASE": 2 ou 3 trechos de "Leia o relato na Bíblia", cada um com o ponto principal (sem o versículo).
    function ebcParteTextosBase(lista) {
      const negrito = text => {
        const styleId = aiStyleIdFor('negrito');
        return styleId ? convertTextWithStyle(text, styleId) : text;
      };
      return {
        paragrafos: 'Textos-base',
        texto: '📖 ' + negrito('TEXTOS-BASE') + '\n\n' + lista.map(t => '📖 ' + negrito(t.referencia) + ' ➜ ' + t.ponto).join('\n\n')
      };
    }

    async function requestEbcAnswers(mode) {
      if (aiBusy) return;
      aiLastKind = 'ebc';
      aiStatusKind = 'ebc';
      placeAiOutput(ebcOutputSlot);
      const refino = mode ? aiRefinoDe('ebc') : null; // refazer: os mesmos quadros da resposta que está no campo
      const escolhas = refino ? { quadros: refino.quadros } : ebcEscolhas();
      if (!escolhas.quadros.length) return setAiStatus('Marque pelo menos um quadro de perguntas.', true);
      const accessError = studyAccessError();
      if (accessError) return setAiStatus(accessError, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
        // As respostas novas ficam sozinhas no campo de texto (como nas respostas de A Sentinela).
        if (input.value) {
          setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para as novas respostas.' });
          autoGrowInputText();
        }
      }

      aiResults.textContent = '';
      aiSuggestions = [];
      aiRaw = [];
      const previousAnswers = mode && aiResumo && aiSentinelaRaw.length ? aiSentinelaRaw : null;
      aiResumo = null;
      updateAiControls();
      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      const payload = {
        tarefa: 'ebc',
        codigo: codigoAcessoSalvo(),
        ano: aiWeekYear,
        semana: aiWeekNumber,
        quadros: escolhas.quadros,
        opcoes: readAiOptions(),
        ajuste: iaExtra('ebc')
      };
      if (previousAnswers) {
        payload.modo = mode;
        payload.anteriores = { itens: previousAnswers };
      }

      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : ebcResponderBtn);
      try {
        const result = await postStudy(payload, IA_ESPERA_MS);
        if (!result.ok) return setAiStatus(studyFailureMessage(result, 'Não foi possível responder ao estudo agora.'), true);
        aiSentinelaRaw = Array.isArray(result.data.itens) ? result.data.itens : [];
        if (!aiSentinelaRaw.length) return setAiStatus(result.data.erro || 'A IA não respondeu às perguntas. Tente de novo.', true);
        if (!ebcCarregado('ebcTitulo')) ebcMostrarInfo(result.data);

        const parts = buildSentinelaParts(aiSentinelaRaw);
        aiResumo = { texto: parts.map(part => part.texto).join('\n\n\n'), partes: parts, done: false, kind: 'estudo', fonte: result.data.titulo || '' };
        appendToMainText(aiResumo.texto);
        aiRefino = { kind: 'ebc', quadros: payload.quadros };
        historicoSalvar({ tipo: 'ebc', titulo: '📚 Estudo Bíblico' + (result.data.titulo ? ' · ' + result.data.titulo : ''), ano: payload.ano, numSemana: payload.semana, partes: parts, refino: { ...aiRefino, itens: aiSentinelaRaw } });
        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus('✅ Respostas no campo de texto, cada uma com o botão de copiar.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente com menos quadros.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    ebcCarregarBtn.addEventListener('click', ebcCarregar);
    ebcResponderBtn.addEventListener('click', () => requestEbcAnswers());

    // ---------- Estudo Bíblico de Congregação: perguntas adicionais para o dirigente ----------
    // Grupo "Preparação para dirigir" (só com o código do dirigente). O servidor lê o capítulo da semana com as perguntas
    // originais e a IA elabora 5 perguntas adicionais com resposta, sem aplicações práticas, e/ou escolhe os textos-base (2 ou 3
    // trechos pequenos e significativos para ler), conforme o "O que preparar" marcado (uma, outra ou as duas). Tudo vai para o campo
    // de texto, cada parte com o botão azul de copiar.
    const EBC_DIR_KEY = 'jwLibraryNoteAplicarEbcDirV1';
    const ebcDirInfo = document.getElementById('ebcDirInfo');
    const ebcDirCarregarBtn = document.getElementById('ebcDirCarregarBtn');
    const ebcDirPerguntasBtn = document.getElementById('ebcDirPerguntasBtn');
    const ebcDirPerguntas = document.getElementById('ebcDirPerguntas');
    const ebcDirTextosBase = document.getElementById('ebcDirTextosBase');
    const ebcDirOutputSlot = document.getElementById('ebcDirOutputSlot');
    // "O que preparar": as perguntas adicionais (marcada por padrão) e/ou os textos bíblicos para ler (os textos-base).
    try {
      const salvo = JSON.parse(localStorage.getItem(EBC_DIR_KEY) || 'null');
      if (salvo) {
        ebcDirPerguntas.checked = salvo.perguntas !== false;
        ebcDirTextosBase.checked = Boolean(salvo.textosBase);
      }
    } catch (e) { /* sem localStorage: valem os padrões */ }
    [ebcDirPerguntas, ebcDirTextosBase].forEach(c => c.addEventListener('change', () => {
      safeSetItem(EBC_DIR_KEY, JSON.stringify({ perguntas: ebcDirPerguntas.checked, textosBase: ebcDirTextosBase.checked }));
    }));

    async function ebcDirCarregar() {
      if (aiBusy) return;
      aiStatusKind = 'ebcdir';
      const accessError = dirigenteAccessError();
      if (accessError) return setAiStatus(accessError, true);
      aiBusy = true;
      setAiLoading(true, ebcDirCarregarBtn, 'site');
      try {
        const result = await postStudy({ tarefa: 'ebc-ler', codigo: codigoAcessoSalvo(), codigoDirigente: codigoDirigenteSalvo(), ano: aiWeekYear, semana: aiWeekNumber }, 60000);
        if (!result.ok) {
          if (await dirigenteRecusado(result)) return;
          return setAiStatus(studyFailureMessage(result, 'Não consegui ler o capítulo agora.'), true);
        }
        ebcMostrarInfo(result.data, ebcDirInfo);
        carregadoGuardar('ebc', result.data);
        setAiStatus('✅ Capítulo da semana carregado.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao ler o capítulo.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    // Uma parte por pergunta ("❔ PERGUNTA ADICIONAL 1 👉 …" e "✅ RESPOSTA 👉 …"), cada uma com o seu botão de copiar.
    function ebcDirPartes(perguntas) {
      const negrito = text => {
        const styleId = aiStyleIdFor('negrito');
        return styleId ? convertTextWithStyle(text, styleId) : text;
      };
      const answerTpl = readAiOptions().usarModelos ? aiTemplateByName('resposta') : null;
      return perguntas.map((q, i) => ({
        paragrafos: 'Pergunta ' + (i + 1),
        texto: '❔ ' + negrito('PERGUNTA ADICIONAL ' + (i + 1)) + ' 👉 ' + q.pergunta + '\n\n' + aiLabelWith(answerTpl, '✅ RESPOSTA 👉 ', q.resposta)
      }));
    }

    async function requestEbcDirigente(mode) {
      if (aiBusy) return;
      aiLastKind = 'ebcdir';
      aiStatusKind = 'ebcdir';
      placeAiOutput(ebcDirOutputSlot);
      const refino = mode ? aiRefinoDe('ebcdir') : null; // refazer: o mesmo pedido da resposta que está no campo
      const pedirPerguntas = refino ? refino.perguntas !== false : ebcDirPerguntas.checked;
      const pedirBase = refino ? Boolean(refino.textosBase) : ebcDirTextosBase.checked;
      if (!pedirPerguntas && !pedirBase) return setAiStatus('Marque as perguntas adicionais ou os textos bíblicos para ler.', true);
      const accessError = dirigenteAccessError();
      if (accessError) return setAiStatus(accessError, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
        // As perguntas novas ficam sozinhas no campo de texto (como nas respostas do Estudo Bíblico).
        if (input.value) {
          setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para as novas perguntas.' });
          autoGrowInputText();
        }
      }

      aiResults.textContent = '';
      aiSuggestions = [];
      aiRaw = [];
      const previous = mode && aiResumo && aiSentinelaRaw.length ? aiSentinelaRaw : null;
      const baseAnterior = mode && aiResumo && refino && Array.isArray(refino.base) ? refino.base : []; // os textos-base já sugeridos
      aiResumo = null;
      updateAiControls();
      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      const payload = {
        tarefa: 'ebc-dirigente',
        codigo: codigoAcessoSalvo(),
        codigoDirigente: codigoDirigenteSalvo(),
        ano: aiWeekYear,
        semana: aiWeekNumber,
        perguntas: pedirPerguntas,
        textosBase: pedirBase,
        opcoes: readAiOptions(),
        ajuste: iaExtra('ebcdir')
      };
      if (previous || baseAnterior.length) {
        payload.modo = mode;
        payload.anteriores = { perguntas: previous || [], textosBase: baseAnterior };
      }

      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : ebcDirPerguntasBtn);
      try {
        const result = await postStudy(payload, IA_ESPERA_MS);
        if (!result.ok) {
          if (await dirigenteRecusado(result)) return;
          return setAiStatus(studyFailureMessage(result, 'Não foi possível preparar o estudo agora.'), true);
        }
        const perguntas = Array.isArray(result.data.perguntas) ? result.data.perguntas : [];
        const base = Array.isArray(result.data.textosBase) ? result.data.textosBase : [];
        if (!perguntas.length && !base.length) return setAiStatus(result.data.erro || 'A IA não preparou nada. Tente de novo.', true);
        if (!ebcCarregado('ebcDirTitulo')) ebcMostrarInfo(result.data, ebcDirInfo);

        aiSentinelaRaw = perguntas;
        const parts = ebcDirPartes(perguntas);
        if (base.length) parts.unshift(ebcParteTextosBase(base));
        aiResumo = { texto: parts.map(part => part.texto).join('\n\n\n'), partes: parts, done: false, kind: 'estudo', fonte: result.data.titulo || '' };
        appendToMainText(aiResumo.texto);
        aiRefino = { kind: 'ebcdir', perguntas: payload.perguntas, textosBase: payload.textosBase, base };
        const oQue = perguntas.length && base.length ? 'perguntas adicionais e textos para ler' : base.length ? 'textos para ler' : 'perguntas adicionais';
        historicoSalvar({ tipo: 'ebc-dirigente', titulo: '🎤 Estudo Bíblico · ' + oQue + (result.data.titulo ? ' · ' + result.data.titulo : ''), ano: payload.ano, numSemana: payload.semana, partes: parts, refino: { ...aiRefino, itens: aiSentinelaRaw } });
        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus('✅ ' + oQue.charAt(0).toUpperCase() + oQue.slice(1) + ' no campo de texto, ' + (perguntas.length && base.length ? 'cada parte' : base.length ? 'cada um' : 'cada uma') + ' com o botão de copiar.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente de novo.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    ebcDirCarregarBtn.addEventListener('click', ebcDirCarregar);
    ebcDirPerguntasBtn.addEventListener('click', () => requestEbcDirigente());

    // ---------- Esboços de discursos: Tesouros da Palavra de Deus (10 min) e Faça seu melhor no ministério (4 a 5 min) ----------
    // Grupo "Preparação de discursos e esboços" (só com o código do dirigente). O servidor lê o discurso da semana na apostila e a IA
    // elabora o esboço: tema, introdução, pontos e conclusão. Tudo vai para o campo de texto (sem botões de copiar por parte), e
    // fica em Pesquisas e respostas salvas (Esboços). Os dois cards usam o mesmo código; cada um tem o seu texto de "Carregar".
    const soComConteudo = (...itens) => itens.filter(Boolean);
    const ESBOCOS = {
      tesouros: {
        kind: 'tesouros',
        tarefaLer: 'tesouros-ler',
        tarefa: 'tesouros',
        info: document.getElementById('tesourosInfo'),
        tituloEl: document.getElementById('tesourosTitulo'),
        carregarBtn: document.getElementById('tesourosCarregarBtn'),
        esbocoBtn: document.getElementById('tesourosEsbocoBtn'),
        slot: document.getElementById('tesourosOutputSlot'),
        tituloHistorico: '📜 Esboço de Tesouros',
        falhaLer: 'Não consegui ler o discurso agora.',
        // A semana e o tema (com o link da apostila no wol.jw.org) e, ao carregar, quantos pontos há e quais textos e fontes.
        linhasDaInfo: dados => {
          const pontos = Array.isArray(dados.pontos) ? dados.pontos : [];
          const textos = [...new Set(pontos.flatMap(ponto => ponto.textos || []))];
          const fontes = [...new Set(pontos.flatMap(ponto => ponto.fontes || []))];
          return soComConteudo(
            pontos.length ? pontos.length + (pontos.length === 1 ? ' ponto' : ' pontos') + (textos.length ? ' · textos: ' + textos.join('; ') : '') + (fontes.length ? ' · fontes: ' + fontes.join('; ') : '') : '',
            dados.reflexao
          );
        }
      },
      discurso: {
        kind: 'discurso',
        tarefaLer: 'discurso-ler',
        tarefa: 'discurso',
        info: document.getElementById('discursoInfo'),
        tituloEl: document.getElementById('discursoTitulo'),
        carregarBtn: document.getElementById('discursoCarregarBtn'),
        esbocoBtn: document.getElementById('discursoEsbocoBtn'),
        slot: document.getElementById('discursoOutputSlot'),
        tituloHistorico: '🗣️ Esboço do discurso curto',
        falhaLer: 'Não consegui ler a apostila agora.',
        // O tempo (4 ou 5 minutos, como vem na apostila), a fonte, a lição do th, os textos indicados e quantos resultados a pesquisa
        // do tema no wol.jw.org trouxe (só quando a fonte não é um artigo inteiro).
        linhasDaInfo: dados => soComConteudo(
          (dados.minutos ? dados.minutos + ' min' : '') + (dados.fonte ? ' · fonte: ' + dados.fonte : '') + (dados.licao ? ' · lição: ' + dados.licao.citacao + (dados.licao.titulo ? ' (' + dados.licao.titulo + ')' : '') : ''),
          (dados.textos && dados.textos.length ? 'textos: ' + dados.textos.join('; ') : '') + (dados.pesquisa ? (dados.textos && dados.textos.length ? ' · ' : '') + 'pesquisa do tema no wol.jw.org: ' + dados.pesquisa + (dados.pesquisa === 1 ? ' resultado' : ' resultados') : '')
        )
      },
      // Discurso público: não depende da semana; o tema vem do select e o esboço do S-34 foi importado pelo administrador.
      publico: {
        kind: 'publico',
        tarefaLer: 'publico-ler',
        tarefa: 'publico',
        semSemana: true,
        info: document.getElementById('publicoInfo'),
        carregarBtn: null,
        esbocoBtn: document.getElementById('publicoEsbocoBtn'),
        slot: document.getElementById('publicoOutputSlot'),
        tituloHistorico: '🎙️ Esboço de discurso público',
        falhaLer: 'Não consegui ler o esboço agora.',
        extraPayload: () => ({ numero: Number(document.getElementById('publicoTema').value) || 0 }),
        validar: () => (document.getElementById('publicoTema').value ? '' : 'Escolha o tema do discurso.'),
        // Revisão do esboço, tempo e seções, o objetivo (nota ao orador) e as leituras que o S-34 marca.
        linhasDaInfo: dados => soComConteudo(
          'esboço S-34 nº ' + dados.numero + (dados.revisao ? ' · revisão ' + dados.revisao : '') + ' · ' + dados.minutos + ' min · ' + (dados.secoes || []).map(secao => secao.minutos + ' min').join(' + '),
          dados.objetivo ? 'objetivo: ' + dados.objetivo : '',
          dados.leituras && dados.leituras.length ? 'leituras marcadas: ' + dados.leituras.join('; ') : 'sem leituras marcadas: a IA escolhe os textos entre os citados no esboço (ou você os escolhe em Textos bíblicos da matéria)'
        )
      },
      // Outros esboços (tema livre): o tema, a ideia e a matéria vêm dos campos do card; o servidor lê os artigos do wol.jw.org e lista os
      // textos bíblicos da matéria. Fica ligado à semana escolhida no alto da tela (como os esboços da semana).
      outros: {
        kind: 'outros',
        tarefaLer: 'outros-ler',
        tarefa: 'outros',
        atualizaInfo: true,
        info: document.getElementById('outrosInfo'),
        carregarBtn: document.getElementById('outrosCarregarBtn'),
        esbocoBtn: document.getElementById('outrosEsbocoBtn'),
        slot: document.getElementById('outrosOutputSlot'),
        tituloHistorico: '📝 Esboço de outro discurso',
        falhaLer: 'Não consegui ler a matéria agora.',
        extraPayload: () => outrosCampos(),
        validar: () => outrosValidar(),
        validarLer: () => (outrosTemMateria() ? '' : 'Informe a matéria (um texto colado, artigos do wol.jw.org ou um esboço importado) ou os textos bíblicos que quer ler.'),
        // O tempo, os artigos que o servidor leu (e os que não deu para ler), os textos que o orador pediu e os que não foram reconhecidos.
        linhasDaInfo: dados => soComConteudo(
          dados.minutos + ' min' + (dados.artigos && dados.artigos.length ? ' · ' + dados.artigos.length + (dados.artigos.length === 1 ? ' artigo lido: ' : ' artigos lidos: ') + dados.artigos.map(a => '“' + a.titulo + '”').join('; ') : '') + (dados.materia ? ' · matéria colada: ' + dados.materia + ' caracteres' : ''),
          dados.falhas && dados.falhas.length ? '⚠️ Não consegui ler: ' + dados.falhas.join('; ') : '',
          dados.base ? 'esboço importado: “' + dados.base.titulo.replace(/^[‘'“"]+|[’'”"]+$/g, '') + '” · ' + dados.base.minutos + ' min · ' + dados.base.secoes + (dados.base.secoes === 1 ? ' seção' : ' seções') + ' · ' + (dados.base.leituras.length ? 'leituras marcadas: ' + dados.base.leituras.join('; ') : 'sem leituras marcadas') : '',
          dados.avisoTextos ? '⚠️ ' + dados.avisoTextos : '',
          dados.pedidos && dados.pedidos.length ? 'textos para ler: ' + dados.pedidos.join('; ') : ''
        )
      }
    };

    // Tesouros e discurso curto: o tema do discurso carregado é o título do cartão (em destaque, com a semana na linha de baixo, e o link
    // da apostila no wol.jw.org); sem discurso carregado, "Aguardando carregar discurso". O botão vira "Recarregar discurso" depois de carregado.
    function esbocoTituloAtualizar(cfg, dados) {
      const el = cfg.tituloEl;
      if (!el) return;
      const carregado = Boolean(dados && dados.titulo);
      el.textContent = '';
      if (carregado) {
        const alvo = dados.url ? document.createElement('a') : el;
        if (dados.url) {
          alvo.href = dados.url;
          alvo.target = '_blank';
          alvo.rel = 'noopener noreferrer';
          el.appendChild(alvo);
        }
        alvo.append(dados.titulo);
        if (dados.semana) {
          const linhaSemana = document.createElement('span');
          linhaSemana.className = 'titulo-semana';
          linhaSemana.textContent = dados.semana;
          alvo.appendChild(linhaSemana);
        }
      } else {
        el.textContent = 'Aguardando carregar discurso';
      }
      el.classList.toggle('study-tema', carregado);
      el.classList.toggle('study-aguardando', !carregado);
      const botao = cfg.carregarBtn;
      if (botao) {
        const rotulo = carregado ? '↻ Recarregar discurso' : '📋 Carregar discurso';
        if (botao.dataset.label) botao.dataset.label = rotulo; // carregando: o rótulo volta ao fim (setAiLoading)
        else botao.textContent = rotulo;
      }
    }

    function esbocoMostrarInfo(cfg, dados) {
      cfg.info.textContent = '';
      imagensRender(cfg.info, null);
      cfg.dadosCarregados = dados && dados.titulo ? dados : null;
      esbocoRenomearSalvos(cfg);
      esbocoSalvoAtualizar(cfg);
      esbocoTituloAtualizar(cfg, cfg.dadosCarregados);
      if (!dados || !dados.titulo) return;
      // Sem título no cartão (discurso público e outros esboços), o tema vai na primeira linha das informações.
      if (!cfg.tituloEl) {
        const titulo = '✨ ' + [cfg.semSemana ? '' : dados.semana, dados.titulo].filter(Boolean).join(' · ');
        if (dados.url) {
          const link = document.createElement('a');
          link.href = dados.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = titulo;
          cfg.info.appendChild(link);
        } else {
          cfg.info.append(titulo);
        }
      }
      (cfg.linhasDaInfo(dados) || []).filter(Boolean).forEach((linha, i) => {
        if (i > 0 || !cfg.tituloEl) cfg.info.append(document.createElement('br'));
        cfg.info.append(linha);
      });
      imagensRender(cfg.info, dados.imagens, 'Imagens da apostila');
      textosAtualizarLista(cfg, dados.textosBiblicos);
    }

    // Semana trocada na barra do alto: o discurso mostrado deixa de valer (e os textos marcados também).
    function esbocosSemanaMudou() {
      Object.values(ESBOCOS).forEach(cfg => {
        if (cfg.semSemana) return;
        cfg.info.textContent = '';
        cfg.dadosCarregados = null;
        esbocoTituloAtualizar(cfg, null);
        esbocoSalvoAtualizar(cfg);
        textosLimpar(cfg);
        const guardado = carregadoDe(cfg.kind);
        if (guardado) esbocoMostrarInfo(cfg, guardado);
      });
    }

    // ---------- Esboço já salvo do discurso carregado ----------
    // Ao carregar o discurso (o da semana, ou o tema do S-34 escolhido), o app procura em "Pesquisas e respostas salvas" um esboço já
    // gerado para ele. Se houver, um botão logo abaixo do carregar abre o MAIS RECENTE no campo de texto (outras versões salvas: pela
    // própria lista de pesquisas salvas). O esboço aberto continua com Outra versão, Melhorar e Incluir texto(s) quando foi salvo com
    // o JSON (versões novas); os antigos abrem só como texto.
    // O texto dos versículos fica no esboço salvo: o app não tem acentos nas letras em negrito e itálico, e é desse texto que a
    // exportação para Word tira os acentos do texto bíblico em itálico. O servidor ignora esse texto quando o esboço volta a ele.
    const esbocoEnxuto = esboco => JSON.parse(JSON.stringify(esboco));

    // O nome do esboço nas pesquisas salvas: o número do tema vem primeiro no discurso público ("Nº 125 - título") e a semana, nos da
    // semana ("19 a 25 de outubro - título").
    function esbocoNomeSalvo(cfg, dados, numero, ano, semana) {
      if (!dados || !dados.titulo) return cfg.tituloHistorico;
      const antes = cfg.semSemana ? (numero ? 'Nº ' + numero + ' - ' : '') : (ano && semana ? rotuloDaSemanaIso(ano, semana) + ' - ' : '');
      return cfg.tituloHistorico + ' · ' + antes + dados.titulo;
    }

    const esbocoNumeroDoTema = cfg => (cfg.semSemana && cfg.extraPayload ? cfg.extraPayload().numero : 0);
    // O nome de antes da 5.7.1 (só o título do discurso): é por ele que se reconhecem os esboços salvos antigos.
    const esbocoNomeAntigo = (cfg, dados) => cfg.tituloHistorico + (dados.titulo ? ' · ' + dados.titulo : '');

    // O esboço salvo mais recente do discurso carregado: nos da semana, o mesmo título na mesma semana; no discurso público, o mesmo
    // tema do S-34 (pelo número; os salvos antes da 5.7.1 só têm o título). A lista salva vem da mais nova para a mais antiga.
    function esbocoSalvoDe(cfg) {
      const dados = cfg.dadosCarregados;
      if (!dados) return { item: null, total: 0 };
      const antigo = esbocoNomeAntigo(cfg, dados);
      const numero = esbocoNumeroDoTema(cfg);
      const achados = historicoLer().filter(item => item.tipo === 'esboco' && String(item.titulo).startsWith(cfg.tituloHistorico) && (cfg.semSemana
        ? (item.esbocoNumero ? item.esbocoNumero === numero : item.titulo === antigo)
        : (item.titulo === antigo || item.esbocoTitulo === dados.titulo) && historicoChave(item) === historicoChaveAtual()));
      return { item: achados[0] || null, total: achados.length };
    }

    // Os esboços salvos com o nome antigo ganham o número do tema (discurso público) ou a semana (os outros) ao carregar o discurso
    // deles: o nome novo aparece em Pesquisas e respostas salvas e o esboço passa a ser achado pelo número.
    function esbocoRenomearSalvos(cfg) {
      const dados = cfg.dadosCarregados;
      if (!dados || !cfg.semSemana) return; // os da semana são acertados ao abrir o app (historicoNormalizarNomes)
      const antigo = esbocoNomeAntigo(cfg, dados);
      const numero = esbocoNumeroDoTema(cfg);
      const novo = esbocoNomeSalvo(cfg, dados, numero);
      const lista = historicoLer();
      let mudou = false;
      lista.forEach(item => {
        if (item.tipo !== 'esboco' || item.titulo !== antigo || novo === antigo) return;
        if (!cfg.semSemana && historicoChave(item) !== historicoChaveAtual()) return;
        item.titulo = novo;
        item.esbocoTitulo = dados.titulo;
        if (cfg.semSemana && numero) item.esbocoNumero = numero;
        mudou = true;
      });
      if (mudou) {
        historicoGravar(lista);
        historicoRender();
      }
    }

    function esbocoSalvoAtualizar(cfg) {
      const botao = cfg.salvoBtn;
      if (!botao) return;
      const comDirigente = Boolean(codigoDirigenteSalvo());
      const { item, total } = comDirigente ? esbocoSalvoDe(cfg) : { item: null, total: 0 };
      cfg.esbocoSalvo = item;
      botao.hidden = !item;
      if (!item) return;
      const data = new Date(item.data);
      const quando = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      botao.textContent = '📂 Carregar o esboço já salvo (' + quando + ')';
      botao.title = total > 1 ? 'O mais recente de ' + total + ' esboços salvos deste discurso. As outras versões estão em Pesquisas e respostas salvas.' : '';
    }

    function esbocosSalvosAtualizar() {
      Object.values(ESBOCOS).forEach(esbocoSalvoAtualizar);
    }

    async function esbocoSalvoCarregar(cfg) {
      const item = cfg.esbocoSalvo;
      if (!item || aiBusy) return;
      if (input.value.trim() && !(await askConfirm('O texto do campo de texto será trocado pelo esboço salvo (dá para desfazer). Continuar?', 'Carregar esboço salvo'))) return;
      aiLastKind = cfg.kind;
      aiStatusKind = cfg.kind;
      placeAiOutput(cfg.slot);
      const texto = (item.partes || []).map(p => p.texto).join('\n\n\n');
      aiRaw = [];
      aiSuggestions = [];
      aiResults.textContent = '';
      aiAppliedAny = false;
      if (input.value) {
        setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para o esboço salvo.' });
        autoGrowInputText();
      }
      aiBaseText = input.value;
      const textoNoCampo = item.textoEditado || texto; // a versão com as alterações salvas, se houver
      if (item.esbocoJson) {
        // Como um esboço recém-elaborado: vale Outra versão, Melhorar e Incluir texto(s).
        cfg.ultimoEsboco = item.esbocoJson;
        aiSentinelaRaw = [item.esbocoJson];
        aiResumo = { texto, partes: [{ paragrafos: 'Esboço', texto }], done: false, kind: 'estudo', semBotoes: true, fonte: (cfg.dadosCarregados && cfg.dadosCarregados.titulo) || '' };
        appendToMainText(textoNoCampo);
      } else {
        cfg.ultimoEsboco = null;
        aiSentinelaRaw = [];
        aiResumo = { texto, partes: item.partes || [], done: false, kind: 'estudo', restaurada: true, semBotoes: true };
        setInputRange(0, input.value.length, textoNoCampo);
        autoGrowInputText();
      }
      historicoLigar(item.id, historicoTituloExibido(item));
      updateAiControls();
      renderAiSuggestions();
      textosAtualizarMarcas(cfg);
      setAiStatus('✅ Esboço salvo no campo de texto.' + (item.esbocoJson ? '' : ' (Salvo numa versão antiga do app: abre só como texto, sem Outra versão, Melhorar nem Incluir texto(s).)'), false);
      requestAnimationFrame(() => input.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }

    // ---------- Textos bíblicos da matéria: lista para marcar ----------
    // Cada esboço mostra, num card recolhível, todos os textos bíblicos da matéria (a apostila e as fontes, ou o esboço do S-34) com o
    // texto da Bíblia para o orador analisar. Os marcados com LEIA na matéria já entram no esboço; o orador marca os que quer ler além
    // desses e eles vão ao servidor em "textosExtras": já na primeira elaboração (o esboço sai com eles) ou depois, no botão
    // "Incluir texto(s) marcado(s)", que pede à IA o mesmo esboço com os textos novos. Nada marcado: tudo como antes.
    const textosLeia = cfg => new Set(cfg.textos.filter(t => t.leia).map(t => t.referencia));

    // As referências que o esboço atual manda ler.
    function textosNoEsboco(cfg) {
      const esboco = cfg.ultimoEsboco;
      return new Set(((esboco && esboco.pontos) || []).flatMap(ponto => (ponto.desenvolvimento || []).map(d => d.leitura && d.leitura.referencia)).filter(Boolean));
    }

    // O que o servidor recebe em "textosExtras": os marcados pelo orador, na ordem da lista (os LEIA já entram sozinhos).
    function textosExtras(cfg) {
      const leia = textosLeia(cfg);
      return cfg.textos.map(t => t.referencia).filter(ref => cfg.marcados.has(ref) && !leia.has(ref));
    }

    function textosCriarCard(cfg) {
      const caixa = document.createElement('details');
      caixa.className = 'textos-box';
      caixa.hidden = true;
      const resumo = document.createElement('summary');
      const corpo = document.createElement('div');
      corpo.className = 'textos-corpo';
      const dica = document.createElement('p');
      dica.className = 'hint ai-hint';
      const acoes = document.createElement('div');
      acoes.className = 'textos-acoes';
      const incluir = document.createElement('button');
      incluir.type = 'button';
      incluir.className = 'ai-study-btn';
      const limpar = document.createElement('button');
      limpar.type = 'button';
      limpar.className = 'secondary';
      limpar.textContent = 'Limpar marcação';
      acoes.append(incluir, limpar);
      const lista = document.createElement('ul');
      lista.className = 'textos-lista';
      corpo.append(dica, acoes, lista);
      caixa.append(resumo, corpo);
      cfg.info.insertAdjacentElement('afterend', caixa);
      cfg.textosUi = { caixa, resumo, dica, incluir, limpar, lista };
      limpar.addEventListener('click', () => { cfg.marcados.clear(); textosAtualizarMarcas(cfg); });
      incluir.addEventListener('click', () => requestEsboco(cfg, 'incluir'));
    }

    // Começa de novo (semana ou tema trocado): sem lista, sem marcação e sem o esboço anterior.
    function textosLimpar(cfg) {
      cfg.textos = [];
      cfg.textosAssinatura = '';
      cfg.marcados.clear();
      cfg.ultimoEsboco = null;
      cfg.itensUi = [];
      cfg.textosUi.lista.textContent = '';
      cfg.textosUi.caixa.hidden = true;
    }

    // A lista do servidor. Se for a mesma que já está na tela, nada se refaz (as marcas e os "Ver texto" abertos ficam).
    function textosAtualizarLista(cfg, lista) {
      const nova = Array.isArray(lista) ? lista.filter(t => t && t.referencia) : [];
      const assinatura = nova.map(t => t.referencia + (t.leia ? '*' : '')).join('|');
      if (assinatura !== cfg.textosAssinatura) {
        cfg.textosAssinatura = assinatura;
        cfg.textos = nova;
        cfg.marcados = new Set(nova.filter(t => !t.leia && cfg.marcados.has(t.referencia)).map(t => t.referencia));
        cfg.textosUi.lista.textContent = '';
        cfg.itensUi = nova.map(t => {
          const item = document.createElement('li');
          const rotulo = document.createElement('label');
          rotulo.className = 'ai-check textos-check';
          const caixa = document.createElement('input');
          caixa.type = 'checkbox';
          const referencia = document.createElement('span');
          referencia.className = 'textos-ref';
          referencia.textContent = t.referencia;
          const tag = document.createElement('span');
          tag.className = 'textos-tag';
          rotulo.append(caixa, referencia, tag);
          item.appendChild(rotulo);
          if (t.texto) {
            const ver = document.createElement('details');
            ver.className = 'textos-ver';
            const sumario = document.createElement('summary');
            sumario.textContent = 'Ver texto';
            const versiculo = document.createElement('p');
            versiculo.className = 'textos-versiculo';
            versiculo.textContent = '“' + t.texto + '”';
            ver.append(sumario, versiculo);
            item.appendChild(ver);
          }
          caixa.addEventListener('change', () => {
            if (caixa.checked) cfg.marcados.add(t.referencia);
            else cfg.marcados.delete(t.referencia);
            textosAtualizarMarcas(cfg);
          });
          cfg.textosUi.lista.appendChild(item);
          return { ref: t.referencia, caixa, tag };
        });
      }
      cfg.textosUi.caixa.hidden = !cfg.textos.length;
      textosAtualizarMarcas(cfg);
    }

    // As etiquetas, os contadores e os botões, conforme o que está marcado e o que o esboço atual já lê.
    function textosAtualizarMarcas(cfg) {
      const ui = cfg.textosUi;
      const noEsboco = textosNoEsboco(cfg);
      const leia = textosLeia(cfg);
      const temEsboco = Boolean(cfg.ultimoEsboco);
      let pendentes = 0;
      cfg.itensUi.forEach(({ ref, caixa, tag }) => {
        const eLeia = leia.has(ref);
        const marcado = cfg.marcados.has(ref);
        const naoLeu = temEsboco && !noEsboco.has(ref);
        caixa.checked = eLeia || marcado;
        caixa.disabled = eLeia;
        let etiqueta = '';
        let classe = '';
        if (eLeia) { etiqueta = naoLeu ? '📌 LEIA · falta no esboço' : '📌 LEIA'; classe = naoLeu ? 'falta' : 'leia'; }
        else if (marcado && noEsboco.has(ref)) { etiqueta = '➕ incluído por você'; classe = 'incluido'; }
        else if (noEsboco.has(ref)) { etiqueta = '✅ no esboço'; classe = 'incluido'; }
        else if (marcado) { etiqueta = temEsboco ? '⏳ falta incluir' : '⏳ entra no esboço'; classe = 'pendente'; pendentes++; }
        tag.textContent = etiqueta;
        tag.className = 'textos-tag' + (classe ? ' ' + classe : '');
      });
      const nLeia = leia.size;
      const nMarcados = cfg.marcados.size;
      ui.resumo.textContent = '📖 Textos bíblicos da matéria (' + cfg.textos.length + ')' + (nLeia ? ' · ' + nLeia + ' com LEIA' : '') + (nMarcados ? ' · ' + nMarcados + (nMarcados === 1 ? ' marcado' : ' marcados') : '');
      ui.dica.textContent = temEsboco
        ? 'Marque mais textos para ler e toque em Incluir: a IA refaz o esboço com eles, mantendo o resto.'
        : 'Marque os textos que quer ler além dos que a IA indicar: o esboço já sai com eles. Os marcados com LEIA entram sozinhos.';
      ui.incluir.hidden = !temEsboco;
      if (!ui.incluir.classList.contains('is-loading')) {
        ui.incluir.textContent = '➕ Incluir texto(s) marcado(s)' + (pendentes ? ' (' + pendentes + ')' : '');
        ui.incluir.disabled = !pendentes;
      }
      ui.limpar.hidden = !nMarcados;
    }

    async function esbocoCarregar(cfg) {
      if (aiBusy) return;
      aiStatusKind = cfg.kind;
      const accessError = dirigenteAccessError() || (cfg.validarLer ? cfg.validarLer() : '');
      if (accessError) return setAiStatus(accessError, true);
      aiBusy = true;
      setAiLoading(true, cfg.carregarBtn, 'site');
      try {
        const result = await postStudy({ tarefa: cfg.tarefaLer, codigoDirigente: codigoDirigenteSalvo(), ano: aiWeekYear, semana: aiWeekNumber, ...(cfg.extraPayload ? cfg.extraPayload() : {}) }, 60000);
        if (!result.ok) {
          if (await dirigenteRecusado(result)) return;
          return setAiStatus(studyFailureMessage(result, cfg.falhaLer), true);
        }
        esbocoMostrarInfo(cfg, result.data);
        if (!cfg.semSemana) carregadoGuardar(cfg.kind, result.data); // os discursos da semana ficam guardados (o público e o de tema livre não dependem da semana)
        setAiStatus(cfg.validarLer ? '✅ Matéria lida: confira os textos bíblicos abaixo.' : '✅ Discurso da semana carregado.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao ler o discurso.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    // Uma parte para o tema, uma para a introdução, uma para cada ponto e uma para a conclusão (juntas no campo de texto).
    // Regras do usuário para TODOS os esboços: o tema e os subtítulos vão em MAIÚSCULAS e negrito, com o tempo entre parênteses e uma
    // linha em branco depois; o objetivo fica separado por linhas em branco; há uma linha em branco entre os blocos "•"; as listas
    // (os pontos anunciados, a retomada dos pontos) usam o numerador de lista do app (símbolos unicode, não o texto "1)"); toda
    // pergunta (frase que termina em "?") vai em negrito; cada texto lido é anunciado com LEIA e a íntegra em
    // itálico, com a fala de antes (que prepara o texto) e a de depois (que destaca o que ele mostra); e não aparecem "Introdução",
    // "Conclusão", "Ponto N" nem "Primeiras frases". O negrito e o itálico do app não têm letras acentuadas, então elas perdem o
    // acento (como em todo o app).
    const ESBOCO_NUMERADOR = 'keycapNumber'; // o modelo de lista colorido 1️⃣ 2️⃣ 3️⃣ (opções de formatação → numeradores de lista; outros: 'blackCircle' ❶ ❷ ❸, 'circled' ① ② ③, 'circleAlternate' 🔵🟣🟢, 'numberParen' 1) 2) 3))
    function esbocoPartes(esboco) {
      const estilo = (tipo, text) => {
        const styleId = aiStyleIdFor(tipo); // já afasta as fontes gótica e script (ver aiStyleIdFor)
        return styleId ? convertTextWithStyle(text, styleId) : text;
      };
      const negrito = text => estilo('negrito', text);
      const maiusculas = text => String(text || '').toLocaleUpperCase('pt-BR');
      // Cada frase que termina em "?" vai em negrito. O ponto de uma abreviação bíblica ("Jer. 45:5") não encerra a frase.
      const comPerguntas = text => {
        const protegido = String(text || '').replace(/(\p{L}{2,4})\.(\s+\d)/gu, '$1\u0001$2');
        const frases = protegido.match(/[^.!?…]*[.!?…]+["”’')\]]*\s*|[^.!?…]+$/g) || [protegido];
        return frases.map(frase => {
          const corpo = frase.replace(/\s+$/, '');
          if (!/\?["”’')\]]*$/.test(corpo)) return frase;
          // O emoji do começo da frase fica fora do negrito.
          const emoji = (corpo.match(/^(?:\p{Extended_Pictographic}[️‍\p{Emoji_Modifier}]*\s*)+/u) || [''])[0];
          return emoji + negrito(corpo.slice(emoji.length)) + frase.slice(corpo.length);
        }).join('').replace(/\u0001/g, '.');
      };
      const subtitulo = (titulo, minutos) => '📌 ' + negrito(maiusculas(titulo)) + (minutos ? ' (' + minutos + ' min)' : '');
      // O cabeçalho (subtítulo e, nos pontos, a fonte) fica separado do primeiro bloco por uma linha em branco, e os blocos também.
      const montar = (cabecalho, blocos) => cabecalho.join('\n') + (blocos.length ? '\n\n' + blocos.join('\n\n') : '');
      // Itens de uma enumeração, numerados com o modelo de lista do app e recuados (4 espaços, o mesmo recuo do app).
      const numerar = itens => itens.map((item, i) => '    ' + getListPrefix(ESBOCO_NUMERADOR, i) + comPerguntas(item)).join('\n');
      // Introdução e conclusão: cada fala é um bloco "•" (escritas palavra por palavra), com a lista numerada abaixo, entre uma linha
      // em branco antes dos itens e outra depois deles (o próximo bloco já vem separado por uma linha em branco).
      const falas = blocos => (blocos || []).map(bloco => '• ' + comPerguntas(bloco.texto) + (bloco.lista && bloco.lista.length ? '\n\n' + numerar(bloco.lista) : ''));
      // ➜ 🟡 📖 LEIA Livro cap:vers: “íntegra do texto, em itálico” (o texto exato vem da Bíblia, no servidor).
      // Mais de um versículo: o começo de cada um, do segundo em diante, leva o número em negrito (ver versiculosNumerados). Os esboços
      // salvos antes não têm essas marcas (só "texto").
      const textoDaLeitura = leia => versiculosNumerados(leia.textoNumerado || leia.texto, trecho => estilo('italico', trecho));
      const leitura = leia => '➜ 🟡 📖 ' + negrito('LEIA') + ' ' + negrito(leia.referencia) + (leia.texto ? ': “' + textoDaLeitura(leia) + '”' : '');
      // Como no modelo de esboço: argumentos "•" e, recuadas, as ideias que os desenvolvem. Quando há leitura, a fala que prepara o
      // texto fecha as ideias, o aviso LEIA vem entre linhas em branco e a fala que destaca o texto vem logo depois.
      const argumentos = itens => itens.flatMap(item => {
        const ideias = (item.ideias || []).map(ideia => '    ◦ ' + comPerguntas(ideia));
        const l = item.leitura;
        const argumento = comPerguntas(item.argumento);
        if (!l) return ['• ' + argumento + (ideias.length ? '\n' + ideias.join('\n') : '')];
        if (l.introducao) ideias.push('    ◦ ' + comPerguntas(l.introducao));
        const blocos = ['• ' + argumento + (ideias.length ? '\n' + ideias.join('\n') : ''), leitura(l)];
        if (l.destaque) blocos.push('    ◦ ' + comPerguntas(l.destaque));
        return blocos;
      });

      // Tema e, separados por linhas em branco, o objetivo e, só no discurso curto, a lição do th e as fontes (a da apostila e as do
      // wol.jw.org).
      const quadro = [];
      if (esboco.objetivo) quadro.push('🧭 ' + negrito('Objetivo') + ' 👉 ' + esboco.objetivo);
      if (esboco.licao) quadro.push('🎓 Lição do th (' + esboco.licao.citacao + (esboco.licao.titulo ? ': ' + esboco.licao.titulo : '') + ') 👉 ' + esboco.licao.dica);
      if (Array.isArray(esboco.fontes) && esboco.fontes.length) quadro.push('📚 Fontes 👉 ' + esboco.fontes.join('; '));
      const partes = [{
        paragrafos: 'Tema',
        texto: ['📜 ' + negrito(maiusculas(esboco.tema)), ...quadro].join('\n\n')
      }];

      const intro = esboco.introducao;
      partes.push({ paragrafos: 'Introdução', texto: montar([subtitulo(intro.titulo, intro.minutos)], falas(intro.blocos)) });
      esboco.pontos.forEach((ponto, i) => {
        const cabecalho = [subtitulo(ponto.titulo, ponto.minutos)];
        if (ponto.fontes && ponto.fontes.length) cabecalho.push('📚 Fonte: ' + ponto.fontes.join('; '));
        const blocos = argumentos(ponto.desenvolvimento || []);
        if (ponto.aplicacao) blocos.push('✅ ' + negrito('Aplicação') + ' 👉 ' + comPerguntas(ponto.aplicacao));
        if (ponto.ilustracao) blocos.push('💡 ' + negrito('Ilustração') + ' 👉 ' + comPerguntas(ponto.ilustracao));
        if (ponto.transicao) blocos.push('↪️ Transição 👉 ' + comPerguntas(ponto.transicao));
        partes.push({ paragrafos: 'Ponto ' + (i + 1), texto: montar(cabecalho, blocos) });
      });
      const fim = esboco.conclusao;
      partes.push({ paragrafos: 'Conclusão', texto: montar([subtitulo(fim.titulo, fim.minutos)], falas(fim.blocos)) });
      return partes;
    }

    async function requestEsboco(cfg, mode) {
      if (aiBusy) return;
      // "Incluir texto(s)" refaz o esboço do próprio card; se o campo de texto já mostra outra coisa, ele é limpo como num esboço novo.
      const incluir = mode === 'incluir';
      const esbocoNoCampo = aiLastKind === cfg.kind && aiResumo && aiSentinelaRaw.length && aiSentinelaRaw[0] === cfg.ultimoEsboco;
      aiLastKind = cfg.kind;
      aiStatusKind = cfg.kind;
      placeAiOutput(cfg.slot);
      const accessError = dirigenteAccessError() || (cfg.validar ? cfg.validar() : '');
      if (accessError) return setAiStatus(accessError, true);
      if (incluir && !cfg.ultimoEsboco) return setAiStatus('Elabore o esboço antes de incluir textos.', true);
      if (incluir && !textosExtras(cfg).some(ref => !textosNoEsboco(cfg).has(ref))) return setAiStatus('Marque ao menos um texto que ainda não está no esboço.', true);

      if (mode && (!incluir || esbocoNoCampo)) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
        // O esboço novo fica sozinho no campo de texto (como as perguntas do Estudo Bíblico).
        if (input.value) {
          setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para o novo esboço.' });
          autoGrowInputText();
        }
      }

      aiResults.textContent = '';
      aiSuggestions = [];
      aiRaw = [];
      const previous = incluir ? cfg.ultimoEsboco : (mode && aiResumo && aiSentinelaRaw.length ? aiSentinelaRaw[0] : null);
      aiResumo = null;
      updateAiControls();
      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      const payload = {
        tarefa: cfg.tarefa,
        codigoDirigente: codigoDirigenteSalvo(),
        ano: aiWeekYear,
        semana: aiWeekNumber,
        opcoes: readAiOptions(),
        ajuste: iaExtra(cfg.kind), // "Outros esboços" não tem o campo: tem os próprios (tema, ideia, ocasião…)
        ...(cfg.extraPayload ? cfg.extraPayload() : {})
      };
      // Os textos que o orador marcou na lista seguem em todo pedido (a primeira elaboração, outra versão, melhorar e incluir).
      const extras = textosExtras(cfg);
      if (extras.length) payload.textosExtras = extras;
      if (previous) {
        payload.modo = mode;
        payload.anteriores = { esboco: previous };
      }

      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : incluir ? cfg.textosUi.incluir : cfg.esbocoBtn);
      try {
        const result = await postStudy(payload, IA_ESPERA_MS);
        if (!result.ok) {
          if (await dirigenteRecusado(result)) return;
          return setAiStatus(studyFailureMessage(result, 'Não foi possível elaborar o esboço agora.'), true);
        }
        const esboco = result.data.esboco;
        if (!esboco) return setAiStatus(result.data.erro || 'A IA não elaborou o esboço. Tente de novo.', true);
        if (!cfg.dadosCarregados || cfg.atualizaInfo) esbocoMostrarInfo(cfg, result.data);
        else textosAtualizarLista(cfg, result.data.textosBiblicos);

        cfg.ultimoEsboco = esboco;
        aiSentinelaRaw = [esboco];
        const parts = esbocoPartes(esboco);
        aiResumo = { texto: parts.map(part => part.texto).join('\n\n\n'), partes: parts, done: false, kind: 'estudo', semBotoes: true, fonte: result.data.titulo || '' };
        appendToMainText(aiResumo.texto);
        // O esboço é guardado e copiado inteiro, não por partes.
        historicoSalvar({ tipo: 'esboco', titulo: esbocoNomeSalvo(cfg, result.data, payload.numero, payload.ano, payload.semana), ano: payload.ano, numSemana: payload.semana, partes: [{ paragrafos: 'Esboço', texto: aiResumo.texto }], esbocoJson: esbocoEnxuto(esboco), esbocoNumero: payload.numero, esbocoTitulo: result.data.titulo });
        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus((incluir ? '✅ Esboço refeito com os textos incluídos, no campo de texto.' : '✅ Esboço no campo de texto.') + (Array.isArray(result.data.avisos) && result.data.avisos.length ? ' ⚠️ ' + result.data.avisos.join(' ') : ''), false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente de novo.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
        textosAtualizarMarcas(cfg);
      }
    }

    const requestTesouros = mode => requestEsboco(ESBOCOS.tesouros, mode);
    const requestDiscursoCurto = mode => requestEsboco(ESBOCOS.discurso, mode);
    Object.values(ESBOCOS).forEach(cfg => {
      cfg.textos = [];
      cfg.textosAssinatura = '';
      cfg.marcados = new Set();
      cfg.ultimoEsboco = null;
      cfg.itensUi = [];
      textosCriarCard(cfg);
      cfg.dadosCarregados = null;
      cfg.esbocoSalvo = null;
      cfg.salvoBtn = document.createElement('button');
      cfg.salvoBtn.type = 'button';
      cfg.salvoBtn.className = 'secondary ai-study-load esbocosalvo';
      cfg.salvoBtn.hidden = true;
      cfg.salvoBtn.addEventListener('click', () => esbocoSalvoCarregar(cfg));
      cfg.info.insertAdjacentElement('beforebegin', cfg.salvoBtn); // logo abaixo do carregar (ou do tema, no discurso público)
      if (cfg.carregarBtn) cfg.carregarBtn.addEventListener('click', () => esbocoCarregar(cfg));
      cfg.esbocoBtn.addEventListener('click', () => requestEsboco(cfg));
    });

    // ---------- Discurso público: lista de temas e informações do tema escolhido ----------
    // A lista vem do servidor (só os temas que o administrador já importou) quando o card é aberto; a busca filtra por número ou título.
    const publicoBox = document.getElementById('publicoBox');
    const publicoTema = document.getElementById('publicoTema');
    const publicoBusca = document.getElementById('publicoBusca');
    let publicoTemas = [];
    let publicoCarregado = false;
    let publicoPedido = 0;
    const publicoLista = document.getElementById('publicoLista');
    const publicoSeta = document.getElementById('publicoSetaBtn');
    let publicoFiltrando = false; // a pessoa digitou e ainda não escolheu nenhum tema
    let publicoAtivo = -1;        // item destacado com as setas do teclado

    // O campo do tema é um só: digita-se o número ou parte do título (a lista abaixo filtra) ou abre-se a lista (▾) e escolhe-se. Escolhido o
    // tema, o campo passa a mostrar o nome dele ("125. Título · 30 min"). O <select> escondido guarda o número escolhido (o resto do app lê dele).
    const publicoRotulo = t => t.numero + '. ' + t.titulo.replace(/^[‘'“"]+|[’'”"]+$/g, '') + (t.minutos ? ' · ' + t.minutos + ' min' : '');

    function publicoFiltrados() {
      const filtro = publicoFiltrando ? s34Semacento(publicoBusca.value) : '';
      return publicoTemas.filter(t => !filtro || String(t.numero) === filtro || s34Semacento(t.numero + ' ' + t.titulo).includes(filtro));
    }

    function publicoMostrarEscolhido() {
      const t = publicoTemas.find(x => String(x.numero) === publicoTema.value);
      publicoBusca.value = t ? publicoRotulo(t) : '';
    }

    function publicoDesenhar() {
      const lista = publicoFiltrados();
      publicoLista.textContent = '';
      publicoAtivo = -1;
      lista.forEach(t => {
        const escolhido = String(t.numero) === publicoTema.value;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'bk-seletor-item' + (escolhido ? ' selecionado' : '');
        item.setAttribute('role', 'option');
        item.dataset.numero = String(t.numero);
        item.textContent = (escolhido ? '✓ ' : '') + publicoRotulo(t);
        item.addEventListener('mousedown', event => event.preventDefault()); // não tira o foco do campo
        item.addEventListener('click', () => publicoEscolher(t));
        publicoLista.appendChild(item);
      });
      if (!lista.length) {
        const vazio = document.createElement('div');
        vazio.className = 'bk-seletor-item';
        vazio.textContent = 'Nenhum tema encontrado.';
        publicoLista.appendChild(vazio);
      }
    }

    function publicoAbrir() {
      if (publicoBusca.disabled) return;
      publicoDesenhar();
      publicoLista.hidden = false;
      publicoBusca.setAttribute('aria-expanded', 'true');
      const marcado = publicoLista.querySelector('.selecionado');
      if (marcado && !publicoFiltrando) publicoLista.scrollTop = Math.max(0, marcado.offsetTop - 60);
    }

    function publicoFechar() {
      publicoLista.hidden = true;
      publicoBusca.setAttribute('aria-expanded', 'false');
    }

    function publicoEscolher(t) {
      const anterior = publicoTema.value;
      publicoFiltrando = false;
      publicoTema.value = String(t.numero);
      publicoMostrarEscolhido();
      publicoFechar();
      if (publicoTema.value !== anterior) publicoTemaMudou();
    }

    // Saiu do campo sem escolher: volta o nome do tema escolhido (ou, se o campo ficou vazio, desfaz a escolha).
    function publicoReverter() {
      const vazio = !publicoBusca.value.trim();
      publicoFiltrando = false;
      if (vazio && publicoTema.value) {
        publicoTema.value = '';
        publicoTemaMudou();
      }
      publicoMostrarEscolhido();
    }

    // Monta o <select> escondido com todos os temas e limpa o campo.
    function publicoPreencher() {
      publicoTema.textContent = '';
      const primeira = document.createElement('option');
      primeira.value = '';
      primeira.textContent = 'Nenhum tema escolhido';
      publicoTema.appendChild(primeira);
      publicoTemas.forEach(t => {
        const opcao = document.createElement('option');
        opcao.value = String(t.numero);
        opcao.textContent = publicoRotulo(t);
        publicoTema.appendChild(opcao);
      });
      publicoTema.value = '';
      publicoVerBtn.hidden = true;
      publicoFiltrando = false;
      publicoBusca.value = '';
      publicoBusca.placeholder = publicoTemas.length ? 'Digite o número ou o título' : 'Nenhum esboço importado';
    }

    async function publicoCarregarLista() {
      const erroDeAcesso = dirigenteAccessError() || (codigoS34Salvo() ? '' : 'Salve o código do S-34 em Ajustes → 🔐 Autorização de acessos.');
      aiStatusKind = 'publico';
      if (erroDeAcesso) return setAiStatus(erroDeAcesso, true);
      const result = await postStudy({ tarefa: 'publico-lista', codigoDirigente: codigoDirigenteSalvo() }, 30000).catch(() => null);
      if (!result || !result.ok) {
        if (result && await dirigenteRecusado(result)) return;
        return setAiStatus(result ? studyFailureMessage(result, 'Não consegui carregar os temas agora.') : 'Falha de conexão ao carregar os temas.', true);
      }
      publicoTemas = result.data.temas || [];
      publicoCarregado = true;
      document.getElementById('publicoTemaRotulo').textContent = 'Escolha o tema' + (publicoTemas.length ? ' (' + publicoTemas.length + (publicoTemas.length === 1 ? ' esboço)' : ' esboços)') : '');
      publicoNumerarSalvos(publicoTemas);
      publicoBusca.disabled = false;
      publicoSeta.disabled = false;
      publicoTema.disabled = false;
      publicoPreencher();
      setAiStatus(publicoTemas.length ? '' : 'Nenhum esboço do S-34 foi importado ainda (Ajustes → Esboços de discursos públicos).', !publicoTemas.length);
    }

    // Mostra o que o servidor sabe do tema escolhido: revisão, tempos, objetivo e leituras marcadas.
    async function publicoTemaMudou() {
      const cfg = ESBOCOS.publico;
      cfg.info.textContent = '';
      cfg.dadosCarregados = null;
      esbocoSalvoAtualizar(cfg);
      textosLimpar(cfg);
      const numero = Number(publicoTema.value);
      publicoVerBtn.hidden = !numero; // "Ver o esboço original" só com um tema escolhido
      if (!numero) return;
      const pedido = ++publicoPedido;
      cfg.info.textContent = 'Carregando o esboço do S-34…';
      const result = await postStudy({ tarefa: cfg.tarefaLer, codigoDirigente: codigoDirigenteSalvo(), numero }, 30000).catch(() => null);
      if (pedido !== publicoPedido) return;
      if (!result || !result.ok) {
        cfg.info.textContent = result ? studyFailureMessage(result, cfg.falhaLer) : 'Falha de conexão ao ler o esboço.';
        return;
      }
      esbocoMostrarInfo(cfg, result.data);
    }

    publicoBox.addEventListener('toggle', () => {
      if (publicoBox.open && !publicoCarregado && codigoDirigenteSalvo() && codigoS34Salvo()) publicoCarregarLista();
    });
    // Campo do tema (digitar ou abrir a lista): a lista é um painel largo, com o título inteiro de cada tema (a lista nativa do celular é estreita e corta o texto).
    publicoBusca.addEventListener('input', () => {
      publicoFiltrando = true;
      const texto = publicoBusca.value.trim();
      const achados = publicoFiltrados();
      // Só números e um único tema com ele: já escolhe e põe o nome no campo. Texto do título só filtra a lista (não troca o que está sendo digitado).
      if (/^\d+$/.test(texto) && achados.length === 1) return publicoEscolher(achados[0]);
      publicoAbrir();
    });
    publicoBusca.addEventListener('focus', () => {
      if (publicoBusca.disabled) return;
      publicoAbrir();
      setTimeout(() => { if (!publicoFiltrando) publicoBusca.select(); }, 0); // o que for digitado troca o nome do tema
    });
    publicoBusca.addEventListener('click', () => { if (publicoLista.hidden) publicoAbrir(); });
    publicoBusca.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement === publicoBusca) return;
      publicoFechar();
      if (publicoFiltrando) publicoReverter();
    }, 200));
    publicoBusca.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (publicoLista.hidden) publicoAbrir();
        const itens = [...publicoLista.querySelectorAll('button.bk-seletor-item')];
        if (!itens.length) return;
        publicoAtivo = (publicoAtivo + (event.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
        itens.forEach((el, i) => el.classList.toggle('ativo', i === publicoAtivo));
        itens[publicoAtivo].scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const itens = [...publicoLista.querySelectorAll('button.bk-seletor-item')];
        const exato = itens.find(el => el.dataset.numero === publicoBusca.value.trim());
        const item = itens[publicoAtivo] || exato || (publicoFiltrando ? itens[0] : null);
        if (item) item.click();
      } else if (event.key === 'Escape' && !publicoLista.hidden) {
        event.preventDefault();
        publicoFechar();
        if (publicoFiltrando) publicoReverter();
      }
    });
    // A seta ▾ abre a lista inteira sem pedir o teclado (no celular, o teclado cobriria metade da tela).
    publicoSeta.addEventListener('mousedown', event => event.preventDefault());
    publicoSeta.addEventListener('click', () => {
      if (!publicoLista.hidden) return publicoFechar();
      publicoFiltrando = false;
      publicoMostrarEscolhido();
      publicoAbrir();
    });

    // ---------- Discurso público: ver o esboço original (S-34) no próprio app ----------
    // O botão "Ver o esboço original" (com um tema escolhido) pede ao servidor o esboço importado (títulos, tempos, itens em níveis, destaques
    // e notas ao orador; só com o código do dirigente, sem IA) e o mostra numa página em tela cheia dentro do app, com as letras ajustáveis
    // (A− / A+). O esboço não fica guardado no aparelho: é pedido a cada vez.
    const publicoVerBtn = document.getElementById('publicoVerBtn');
    const visor = document.getElementById('esbocoVisor');
    const visorCorpo = document.getElementById('esbocoVisorCorpo');
    const visorTitulo = document.getElementById('esbocoVisorTitulo');
    const VISOR_KEY = 'jwLibraryNoteAplicarVisorV1';
    const VISOR_ZOOM = { min: 0.8, max: 1.8, passo: 0.1 };
    // A página serve a dois usos: 'esboco' (o esboço original do S-34 ou importado) e 'texto' (a prévia do documento Word do campo de texto
    // principal). Cada um guarda o seu tamanho de letra: "zoom" no esboço (1 = 12 pt no Word) e "zoomDoc" no texto (1 = 11 pt no Word).
    let visorModo = 'esboco';
    let visorDoc = null; // modo 'texto': { texto, nome, acentos }, a foto do campo no momento em que a prévia foi aberta
    let visorRolagem = '';
    const visorZoomLer = modo => {
      try {
        const guardado = JSON.parse(localStorage.getItem(VISOR_KEY) || '{}') || {};
        const z = Number(modo === 'texto' ? guardado.zoomDoc : guardado.zoom);
        return z >= VISOR_ZOOM.min && z <= VISOR_ZOOM.max ? z : 1;
      } catch (e) { return 1; /* sem localStorage: letras no tamanho normal */ }
    };
    let visorZoom = visorZoomLer('esboco');

    // O tamanho da letra do texto do documento, em pontos, na escala escolhida ("Prévia do Word · letra 11 pt").
    const visorTituloDoc = () => 'Prévia do Word · letra ' + (Math.round(22 * visorZoom) / 2).toString().replace('.', ',') + ' pt';

    function visorZoomAplicar(novo) {
      visorZoom = Math.round(Math.min(VISOR_ZOOM.max, Math.max(VISOR_ZOOM.min, novo)) * 10) / 10;
      visor.style.setProperty('--visor-zoom', String(visorZoom));
      document.getElementById('esbocoVisorMenos').disabled = visorZoom <= VISOR_ZOOM.min;
      document.getElementById('esbocoVisorMais').disabled = visorZoom >= VISOR_ZOOM.max;
      let guardado = {};
      try { guardado = JSON.parse(localStorage.getItem(VISOR_KEY) || '{}') || {}; } catch (e) { guardado = {}; }
      guardado[visorModo === 'texto' ? 'zoomDoc' : 'zoom'] = visorZoom;
      safeSetItem(VISOR_KEY, JSON.stringify(guardado));
      if (visorModo === 'texto' && visorDoc) visorTitulo.textContent = visorTituloDoc();
    }

    // O texto de um item cortado em pedaços [{ texto, nivel }]: nivel 0 = comum, 1 = destaque (importante, em itálico) e 2 = destaque máximo (muito
    // importante, itálico em negrito). Serve à página e ao arquivo Word.
    function visorSegmentos(texto, destaques) {
      const segmentos = [];
      const faixas = [];
      (destaques || []).forEach(d => {
        const t = String((d && d.texto) || '');
        if (!t) return;
        let ini = texto.indexOf(t);
        if (ini < 0) ini = texto.toLowerCase().indexOf(t.toLowerCase());
        if (ini < 0 || faixas.some(f => ini < f.fim && ini + t.length > f.ini)) return;
        faixas.push({ ini, fim: ini + t.length, nivel: d.nivel === 2 ? 2 : 1 });
      });
      faixas.sort((a, b) => a.ini - b.ini);
      let pos = 0;
      faixas.forEach(f => {
        if (f.ini > pos) segmentos.push({ texto: texto.slice(pos, f.ini), nivel: 0 });
        segmentos.push({ texto: texto.slice(f.ini, f.fim), nivel: f.nivel });
        pos = f.fim;
      });
      if (pos < texto.length) segmentos.push({ texto: texto.slice(pos), nivel: 0 });
      return segmentos;
    }

    // O texto de um item com os trechos destacados no esboço, sem usar innerHTML.
    function visorTextoComDestaques(texto, destaques) {
      const fragmento = document.createDocumentFragment();
      visorSegmentos(texto, destaques).forEach(s => {
        if (!s.nivel) return fragmento.append(s.texto);
        const destaque = document.createElement('em');
        destaque.className = 'visor-d' + s.nivel;
        destaque.textContent = s.texto;
        fragmento.append(destaque);
      });
      return fragmento;
    }

    // A linha de baixo do título. O esboço do S-34 tem número; o importado do aparelho (Outros esboços) não: aparece como "importado", com o
    // nome do arquivo.
    function visorSubtitulo(esboco) {
      const minutos = (esboco.secoes || []).reduce((n, s) => n + (s.minutos || 0), 0);
      const origem = Number(esboco.numero) > 0 ? 'Esboço S-34 nº ' + esboco.numero : 'Esboço importado' + (esboco.arquivo ? ' (' + esboco.arquivo + ')' : '');
      return [origem, esboco.revisao ? 'revisão ' + esboco.revisao : '', minutos ? minutos + ' min' : ''].filter(Boolean).join(' · ');
    }

    // As leituras marcadas que o texto do item não traz por extenso (entram numa etiqueta "📖 Ler: …").
    const visorLeiturasFaltando = item => (item.leituras || []).filter(l => !(item.texto || '').includes(l));

    function visorMontar(esboco) {
      const folha = document.createElement('article');
      folha.className = 'visor-folha';
      const titulo = document.createElement('h2');
      titulo.textContent = esboco.titulo;
      const sub = document.createElement('p');
      sub.className = 'visor-sub';
      sub.textContent = visorSubtitulo(esboco);
      folha.append(titulo, sub);
      const nota = (classe, rotulo, texto) => {
        const p = document.createElement('p');
        p.className = classe;
        const forte = document.createElement('strong');
        forte.textContent = rotulo + ' ';
        p.append(forte, texto);
        return p;
      };
      if (esboco.notaAoOrador) folha.append(nota('visor-objetivo', 'Nota ao orador:', esboco.notaAoOrador));
      (esboco.secoes || []).forEach(secao => {
        const bloco = document.createElement('section');
        bloco.className = 'visor-secao';
        const cabecalho = document.createElement('h3');
        const nome = document.createElement('span');
        nome.textContent = secao.titulo;
        cabecalho.append(nome);
        if (secao.minutos) {
          const tempo = document.createElement('span');
          tempo.className = 'visor-min';
          tempo.textContent = secao.minutos + ' min';
          cabecalho.append(tempo);
        }
        bloco.append(cabecalho);
        (secao.itens || []).forEach(item => {
          const p = document.createElement('p');
          p.className = 'visor-item' + (item.nota ? ' nota' : item.negrito ? ' negrito' : '');
          p.style.setProperty('--n', String(Math.max(0, Math.min(4, item.nivel || 0))));
          if (item.nota) {
            const rotulo = document.createElement('strong');
            rotulo.textContent = 'Nota ao orador: ';
            p.append(rotulo);
          }
          p.append(visorTextoComDestaques(item.texto || '', item.destaques));
          const faltam = visorLeiturasFaltando(item);
          if (faltam.length) {
            const etiqueta = document.createElement('span');
            etiqueta.className = 'visor-ler';
            etiqueta.textContent = '📖 Ler: ' + faltam.join('; ');
            p.append(' ', etiqueta);
          }
          bloco.append(p);
        });
        folha.append(bloco);
      });
      if (esboco.notaFinal) folha.append(nota('visor-fim', 'Nota:', esboco.notaFinal));
      return folha;
    }

    function visorAviso(texto) {
      const p = document.createElement('p');
      p.className = 'visor-aviso';
      p.textContent = texto;
      visorCorpo.replaceChildren(p);
    }

    let visorOrigem = null; // o botão que abriu a página (o foco volta para ele ao fechar)
    let visorEsboco = null; // o esboço que a página mostra agora (é o que "Exportar para Word" leva)
    const visorInfo = document.getElementById('esbocoVisorInfo');
    const visorDocxBtn = document.getElementById('esbocoVisorDocx');
    const visorCompartilharBtn = document.getElementById('esbocoVisorCompartilhar');

    // Escreve ou apaga a mensagem da exportação (embaixo dos botões do alto).
    function visorDizer(texto, aviso) {
      visorInfo.textContent = texto || '';
      visorInfo.classList.toggle('aviso', Boolean(aviso));
    }

    const visorTemConteudo = () => (visorModo === 'texto' ? Boolean(visorDoc) : Boolean(visorEsboco));

    function visorBotoesDeExportar() {
      visorDocxBtn.disabled = !visorTemConteudo();
      visorCompartilharBtn.disabled = !visorTemConteudo();
      visorCompartilharBtn.hidden = document.getElementById('exportarCompartilharBtn').hidden; // só onde o aparelho aceita compartilhar arquivos
    }

    function visorFechar() {
      if (visor.hidden) return;
      visor.hidden = true;
      document.body.style.overflow = visorRolagem;
      visorCorpo.textContent = '';
      visorEsboco = null;
      visorDoc = null;
      visorDizer('');
      if (visorOrigem) visorOrigem.focus({ preventScroll: true });
    }

    // Abre a página em tela cheia (com o aviso "Carregando…" até o esboço chegar); serve ao Discurso público (vem do servidor) e ao esboço
    // importado em Outros esboços (já está no aparelho).
    function visorAbrir(tituloBarra, origem, modo = 'esboco') {
      visorModo = modo;
      visorDoc = null;
      visorZoom = visorZoomLer(modo);
      visorTitulo.textContent = tituloBarra;
      visorAviso(modo === 'texto' ? 'Preparando a prévia…' : 'Carregando o esboço…');
      visorZoomAplicar(visorZoom);
      visorEsboco = null;
      visorDizer('');
      visorBotoesDeExportar();
      visorOrigem = origem;
      visorRolagem = document.body.style.overflow;
      document.body.style.overflow = 'hidden'; // a página de trás não rola enquanto o esboço está aberto
      visor.hidden = false;
      document.getElementById('esbocoVisorFechar').focus({ preventScroll: true });
    }

    // Em alguns esboços do S-34 a última linha repete o tema ("N.º 100 Título"). Os importados antes de o importador descartar essa linha a
    // guardaram como último item da última seção (e a nota do fim, "Siga de perto o material do esboço…", ficou como item antes dela): a página
    // e o arquivo Word mostram o tema só no alto, e a nota volta a ser a nota do fim. Sem a repetição, devolve o mesmo esboço.
    function visorLimpar(esboco) {
      const forma = t => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const titulo = forma(esboco.titulo);
      const repete = item => { const m = String((item && item.texto) || '').match(/^N\.?\s*[°ºo]\.?\s*\d{1,3}\s+(.+)$/i); return Boolean(m) && forma(m[1]) === titulo; };
      if (!(esboco.secoes || []).some(s => (s.itens || []).some(repete))) return esboco;
      const limpo = { ...esboco, secoes: esboco.secoes.map(s => ({ ...s, itens: (s.itens || []).filter(i => !repete(i)) })) };
      const ultima = limpo.secoes[limpo.secoes.length - 1];
      const fim = ultima && ultima.itens[ultima.itens.length - 1];
      if (!limpo.notaFinal && fim && fim.nota && /siga de perto|beneficie-se|n[aã]o h[aá] necessidade/i.test(fim.texto)) {
        limpo.notaFinal = fim.texto;
        ultima.itens = ultima.itens.slice(0, -1);
      }
      return limpo;
    }

    function visorMostrar(bruto) {
      const esboco = visorLimpar(bruto);
      visorEsboco = esboco;
      visorBotoesDeExportar();
      visorCorpo.replaceChildren(visorMontar(esboco));
      visorCorpo.scrollTop = 0;
    }

    // Exporta o esboço que está na página para Word (.docx), com as letras no tamanho escolhido em A− / A+ (como o botão do campo de texto).
    // Também finaliza a exportação do texto do campo principal (modo 'texto'): o arquivo sai com o tamanho de letra escolhido na prévia.
    async function visorExportar(compartilhar) {
      if (!visorTemConteudo()) return;
      const botao = compartilhar ? visorCompartilharBtn : visorDocxBtn;
      botao.disabled = true;
      visorDizer('Gerando o arquivo Word…');
      try {
        const doc = visorModo === 'texto' ? visorDoc : null;
        const nome = doc ? doc.nome : docxNomeDoEsboco(visorEsboco);
        const titulo = nome.replace(/\.docx$/, '');
        const blob = !doc ? await docxGerarEsboco(visorEsboco, visorZoom, titulo)
          : doc.modelo ? await docxGerarLeitura(doc.modelo, titulo, visorZoom) : await docxGerar(doc.texto, titulo, doc.acentos, visorZoom);
        const mensagem = await docxEntregar(blob, nome, compartilhar);
        visorDizer(mensagem);
        if (doc && !doc.modelo && mensagem) {
          // O resultado também aparece no card do campo de texto (some quando o texto do campo mudar).
          const info = document.getElementById('exportarInfo');
          info.textContent = mensagem;
          info.dataset.texto = doc.texto;
        }
      } catch (e) {
        visorDizer('Não consegui gerar o arquivo Word: ' + (e && e.message ? e.message : 'erro desconhecido.'), true);
      } finally {
        botao.disabled = !visorTemConteudo();
      }
    }

    // A prévia do documento Word do campo de texto: cada linha do campo vira um parágrafo, com o recuo, o negrito e o itálico que o Word vai
    // ter (o mesmo modelo do arquivo), na proporção do tamanho de letra escolhido em A− e A+. As quebras de linha seguem a largura da tela.
    function docxPreviaMontar(doc) {
      const raiz = document.createDocumentFragment();
      const dica = document.createElement('p');
      dica.className = 'visor-dica';
      dica.textContent = 'Prévia aproximada: no Word a página é A4, com margens de 1 cm, e as linhas podem quebrar em outros pontos. Use A− e A+ para o tamanho da letra e finalize em Exportar para Word.';
      const folha = document.createElement('article');
      folha.className = 'visor-folha doc';
      let primeira = true;
      docxLinhas(doc.texto).forEach(linha => {
        const p = document.createElement('p');
        p.className = 'doc-p';
        const modelo = docxLinhaModelo(linha, doc.acentos);
        if (!modelo) {
          p.classList.add('vazio');
        } else {
          if (primeira) p.classList.add('titulo'); // a primeira linha sai maior (14 pt na escala 1)
          primeira = false;
          p.style.setProperty('--esq', String(modelo.esquerda / 20));
          p.style.setProperty('--pen', modelo.marcador ? String(284 / 20) : '0');
          modelo.trechos.forEach(t => {
            const trecho = document.createElement('span');
            trecho.className = (t.f.includes('b') ? 'doc-b ' : '') + (t.f.includes('i') ? 'doc-i' : '');
            trecho.textContent = t.texto;
            p.append(trecho);
          });
        }
        folha.append(p);
      });
      raiz.append(dica, folha);
      return raiz;
    }

    // Abre a prévia do documento Word com o texto do campo (os botões "Exportar para Word (.docx)" e "Compartilhar o arquivo Word").
    async function docxPreviaAbrir(origem) {
      const texto = input.value;
      if (!texto.trim() || !visor.hidden) return;
      visorAbrir('Prévia do documento Word', origem, 'texto');
      const nome = docxNomeDoArquivo(texto);
      let acentos;
      try {
        // Nos esboços salvos, o texto dos versículos que faltam vem do servidor (só para devolver os acentos).
        const salvo = historicoLigado && historicoLigado.esboco ? historicoLer().find(i => i.id === historicoLigado.id) : null;
        acentos = docxPrepararAcentos(texto, await docxCompletarVersiculos(salvo && salvo.esbocoJson));
      } catch (e) {
        if (!visor.hidden) visorAviso('Não consegui preparar a prévia: ' + (e && e.message ? e.message : 'erro desconhecido.'));
        return;
      }
      if (visor.hidden) return; // fechou antes de ficar pronta
      visorDoc = { texto, nome, acentos };
      visorBotoesDeExportar();
      visorTitulo.textContent = visorTituloDoc();
      visorCorpo.replaceChildren(docxPreviaMontar(visorDoc));
      visorCorpo.scrollTop = 0;
    }

    async function publicoVerAbrir() {
      const numero = Number(publicoTema.value);
      if (!numero || !visor.hidden) return;
      const erroDeAcesso = dirigenteAccessError();
      if (erroDeAcesso) { aiStatusKind = 'publico'; return setAiStatus(erroDeAcesso, true); }
      const tema = publicoTemas.find(t => Number(t.numero) === numero);
      visorAbrir('Esboço original · nº ' + numero, publicoVerBtn);
      const result = await postStudy({ tarefa: 'publico-esboco', codigoDirigente: codigoDirigenteSalvo(), numero }, 30000).catch(() => null);
      if (visor.hidden) return; // fechou antes de chegar
      if (!result || !result.ok) {
        if (result && await dirigenteRecusado(result)) return visorFechar();
        return visorAviso(result ? studyFailureMessage(result, 'Não consegui ler o esboço agora.') : 'Falha de conexão ao ler o esboço.');
      }
      const esboco = result.data && result.data.esboco;
      if (!esboco) return visorAviso('O servidor não devolveu o esboço. Tente de novo.');
      visorTitulo.textContent = 'Esboço original · nº ' + numero + (tema && tema.minutos ? ' · ' + tema.minutos + ' min' : '');
      visorMostrar(esboco);
    }

    publicoVerBtn.addEventListener('click', publicoVerAbrir);
    document.getElementById('esbocoVisorFechar').addEventListener('click', visorFechar);
    document.getElementById('esbocoVisorMenos').addEventListener('click', () => { visorZoomAplicar(visorZoom - VISOR_ZOOM.passo); visorDizer(''); });
    document.getElementById('esbocoVisorMais').addEventListener('click', () => { visorZoomAplicar(visorZoom + VISOR_ZOOM.passo); visorDizer(''); });
    visorDocxBtn.addEventListener('click', () => visorExportar(false));
    visorCompartilharBtn.addEventListener('click', () => visorExportar(true));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !visor.hidden) visorFechar(); });

    // ---------- Outros esboços (tema livre) ----------
    // O orador escreve o tema, a ideia e o tempo e, se quiser, a ocasião, os textos que quer ler e a matéria: um texto colado, os endereços
    // de artigos do wol.jw.org ou os resultados da pesquisa do tema na biblioteca que ele marcar (o endereço marcado entra na caixa dos
    // artigos). O que ele escreve fica salvo só neste aparelho. "Ler a matéria" mostra o que o servidor leu e lista os textos bíblicos para
    // marcar; "Elaborar" faz o esboço, que segue o caminho dos outros esboços (campo de texto, pesquisas salvas, outra versão, melhorar).
    const OUTROS_KEY = 'jwLibraryNoteAplicarOutrosV1';
    const OUTROS_MAX_ARTIGOS = 5;
    // Os esboços prontos importados (só neste aparelho): [{ id, titulo, minutos, secoes, importadoEm, arquivo, esboco }], os mais novos primeiro.
    const OUTROS_BASES_KEY = 'jwLibraryNoteAplicarOutrosBasesV1';
    const OUTROS_MAX_BASES = 20;
    let outrosBases = [];
    let outrosBaseId = '';
    try {
      const guardadas = JSON.parse(localStorage.getItem(OUTROS_BASES_KEY) || '[]');
      if (Array.isArray(guardadas)) outrosBases = guardadas.filter(b => b && b.id && b.esboco && Array.isArray(b.esboco.secoes)).slice(0, OUTROS_MAX_BASES);
    } catch (e) { /* sem localStorage: nenhum esboço importado */ }
    const outrosBaseAtual = () => outrosBases.find(b => b.id === outrosBaseId) || null;
    const outrosCamposEl = {
      tema: document.getElementById('outrosTema'),
      ideia: document.getElementById('outrosIdeia'),
      minutos: document.getElementById('outrosMinutos'),
      ocasiao: document.getElementById('outrosOcasiao'),
      textos: document.getElementById('outrosTextos'),
      materia: document.getElementById('outrosMateria'),
      artigos: document.getElementById('outrosArtigos'),
      consulta: document.getElementById('outrosConsulta')
    };
    const outrosMateriaBox = document.getElementById('outrosMateriaBox');
    const outrosResultados = document.getElementById('outrosResultados');
    const outrosPesquisarBtn = document.getElementById('outrosPesquisarBtn');

    const outrosEnderecos = () => [...new Set(outrosCamposEl.artigos.value.split(/\s+/).map(e => e.trim()).filter(Boolean))];
    const outrosTemMateria = () => Boolean(outrosCamposEl.materia.value.trim() || outrosCamposEl.textos.value.trim() || outrosEnderecos().length || outrosBaseAtual());
    // O esboço importado vai ao servidor sem o nome do arquivo.
    const outrosBaseParaEnviar = base => { const { arquivo, arquivoModificado, ...resto } = base.esboco; return resto; };

    function outrosCampos() {
      const base = outrosBaseAtual();
      return {
        tema: outrosCamposEl.tema.value.trim(),
        ideia: outrosCamposEl.ideia.value.trim(),
        minutos: Math.round(Number(outrosCamposEl.minutos.value)) || 30,
        ocasiao: outrosCamposEl.ocasiao.value.trim(),
        textosLer: outrosCamposEl.textos.value.trim(),
        materia: outrosCamposEl.materia.value.trim(),
        artigos: outrosEnderecos(),
        ...(base ? { esbocoBase: outrosBaseParaEnviar(base) } : {})
      };
    }

    function outrosValidar() {
      const base = outrosBaseAtual();
      if (outrosCamposEl.tema.value.trim().length < 4 && !base) return 'Escreva o tema do discurso.';
      const minutos = Number(outrosCamposEl.minutos.value);
      if (!base && (!Number.isFinite(minutos) || minutos < 3 || minutos > 60)) return 'O tempo do discurso deve ficar entre 3 e 60 minutos.';
      if (outrosEnderecos().length > OUTROS_MAX_ARTIGOS) return 'Use no máximo ' + OUTROS_MAX_ARTIGOS + ' artigos do wol.jw.org.';
      return '';
    }

    // O resumo do bloco opcional mostra o que há dentro dele (com o bloco fechado, o orador sabe que a matéria está lá).
    function outrosAtualizarResumo() {
      const itens = [];
      if (outrosCamposEl.ocasiao.value.trim()) itens.push('ocasião');
      if (outrosCamposEl.textos.value.trim()) itens.push('textos');
      if (outrosCamposEl.materia.value.trim()) itens.push('matéria colada');
      const artigos = outrosEnderecos().length;
      if (artigos) itens.push(artigos + (artigos === 1 ? ' artigo' : ' artigos'));
      document.getElementById('outrosMateriaResumo').textContent = '📚 Ocasião, textos, matéria e pesquisa (opcional)' + (itens.length ? ' · ' + itens.join(', ') : '');
      const base = outrosBaseAtual();
      document.getElementById('outrosBaseResumo').textContent = '📥 Esboço pronto como base (opcional, só neste aparelho)' + (base ? ' · ' + base.titulo : '');
    }

    function outrosSalvarRascunho() {
      const dados = {};
      Object.entries(outrosCamposEl).forEach(([nome, el]) => { dados[nome] = el.value; });
      dados.baseId = outrosBaseId;
      safeSetItem(OUTROS_KEY, JSON.stringify(dados));
      outrosAtualizarResumo();
    }

    try {
      const salvo = JSON.parse(localStorage.getItem(OUTROS_KEY) || 'null');
      if (salvo && typeof salvo === 'object') {
        Object.entries(outrosCamposEl).forEach(([nome, el]) => { if (typeof salvo[nome] === 'string') el.value = salvo[nome]; });
        if (!outrosCamposEl.minutos.value) outrosCamposEl.minutos.value = '30';
        outrosMateriaBox.open = Boolean(outrosCamposEl.ocasiao.value || outrosCamposEl.textos.value || outrosCamposEl.materia.value || outrosCamposEl.artigos.value);
        if (typeof salvo.baseId === 'string' && outrosBases.some(b => b.id === salvo.baseId)) outrosBaseId = salvo.baseId;
      }
    } catch (e) { /* sem localStorage: os campos começam vazios */ }
    document.getElementById('outrosBaseBox').open = Boolean(outrosBaseId);
    outrosAtualizarResumo();

    // A caixa dos artigos e as marcas dos resultados da pesquisa andam juntas.
    function outrosMarcarResultados() {
      const enderecos = new Set(outrosEnderecos());
      outrosResultados.querySelectorAll('input[type="checkbox"]').forEach(caixa => { caixa.checked = enderecos.has(caixa.value); });
    }
    Object.values(outrosCamposEl).forEach(el => el.addEventListener('input', () => { outrosSalvarRascunho(); if (el === outrosCamposEl.artigos) outrosMarcarResultados(); }));

    function outrosMostrarResultados(lista) {
      outrosResultados.textContent = '';
      lista.forEach(r => {
        const rotulo = document.createElement('label');
        rotulo.className = 'ai-check outros-resultado';
        const caixa = document.createElement('input');
        caixa.type = 'checkbox';
        caixa.value = r.url;
        const texto = document.createElement('span');
        texto.className = 'outros-resultado-texto';
        const titulo = document.createElement('strong');
        titulo.textContent = r.titulo;
        const origem = document.createElement('span');
        origem.className = 'outros-resultado-rotulo';
        origem.textContent = r.rotulo;
        const trecho = document.createElement('span');
        trecho.className = 'outros-resultado-trecho';
        trecho.textContent = r.trecho;
        texto.append(titulo, origem, trecho);
        rotulo.append(caixa, texto);
        caixa.addEventListener('change', () => {
          const atuais = outrosEnderecos().filter(e => e !== r.url);
          if (caixa.checked) {
            if (atuais.length >= OUTROS_MAX_ARTIGOS) {
              caixa.checked = false;
              aiStatusKind = 'outros';
              return setAiStatus('Use no máximo ' + OUTROS_MAX_ARTIGOS + ' artigos.', true);
            }
            atuais.push(r.url);
          }
          outrosCamposEl.artigos.value = atuais.join('\n');
          outrosSalvarRascunho();
        });
        outrosResultados.appendChild(rotulo);
      });
      outrosResultados.hidden = !lista.length;
      outrosMarcarResultados();
    }

    async function outrosPesquisar() {
      if (aiBusy) return;
      aiStatusKind = 'outros';
      const accessError = dirigenteAccessError();
      if (accessError) return setAiStatus(accessError, true);
      if ((outrosCamposEl.consulta.value.trim() || outrosCamposEl.tema.value.trim()).length < 8) return setAiStatus('Escreva o tema (ou as palavras da pesquisa) com pelo menos 8 letras.', true);
      aiBusy = true;
      setAiLoading(true, outrosPesquisarBtn, 'site');
      try {
        const result = await postStudy({ tarefa: 'outros-pesquisar', codigoDirigente: codigoDirigenteSalvo(), tema: outrosCamposEl.tema.value.trim(), consulta: outrosCamposEl.consulta.value.trim() }, 60000);
        if (!result.ok) {
          if (await dirigenteRecusado(result)) return;
          return setAiStatus(studyFailureMessage(result, 'Não consegui pesquisar na biblioteca agora.'), true);
        }
        const lista = Array.isArray(result.data.resultados) ? result.data.resultados : [];
        outrosMostrarResultados(lista);
        setAiStatus(lista.length ? '✅ ' + lista.length + (lista.length === 1 ? ' resultado' : ' resultados') + ' para "' + result.data.consulta + '". Marque os que a IA deve ler.' : 'Nada encontrado para "' + result.data.consulta + '". Tente outras palavras.', !lista.length);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A biblioteca demorou demais. Tente de novo.' : 'Falha de conexão ao pesquisar na biblioteca.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }
    outrosPesquisarBtn.addEventListener('click', outrosPesquisar);

    // A leitura da matéria mostrada (e a lista de textos) deixa de valer quando a base muda.
    function outrosZerarLeitura() {
      const cfg = ESBOCOS.outros;
      cfg.info.textContent = '';
      cfg.dadosCarregados = null;
      esbocoSalvoAtualizar(cfg);
      textosLimpar(cfg);
    }

    // ---------- Esboço pronto importado (só neste aparelho) ----------
    // O .docx (no molde dos esboços do S-34) é lido aqui mesmo, com o leitor do S-34 (modo livre: sem número de tema), e fica guardado no
    // localStorage deste aparelho; vai ao servidor só no pedido da IA, junto com o resto, e lá não é guardado.
    const outrosBaseSelect = document.getElementById('outrosBaseSelect');
    backupSeletorLargo(outrosBaseSelect, null, { vazioEscolhivel: true });
    const outrosBaseStatus = document.getElementById('outrosBaseStatus');

    function outrosBaseDizer(texto, aviso) {
      outrosBaseStatus.textContent = texto;
      outrosBaseStatus.className = aviso ? 'warn' : 'ok';
    }

    function outrosBaseGuardar() {
      if (!safeSetItem(OUTROS_BASES_KEY, JSON.stringify(outrosBases))) outrosBaseDizer('Não coube na memória deste aparelho: o esboço vale só até fechar o app.', true);
    }

    const outrosBaseTotal = base => base.esboco.secoes.reduce((n, sc) => n + (sc.minutos || 0), 0);
    const outrosBaseLeituras = base => [...new Set(base.esboco.secoes.flatMap(sc => sc.itens.flatMap(item => item.leituras || [])))];

    // A lista, as informações do esboço escolhido e o campo de tempo (que passa a valer a soma das seções dele).
    function outrosBaseMostrar() {
      const atual = outrosBaseAtual();
      if (!atual) outrosBaseId = '';
      outrosBaseSelect.textContent = '';
      const nenhum = document.createElement('option');
      nenhum.value = '';
      nenhum.textContent = outrosBases.length ? 'Nenhum (usar só a matéria)' : 'Nenhum esboço importado';
      outrosBaseSelect.appendChild(nenhum);
      outrosBases.forEach(b => {
        const opcao = document.createElement('option');
        opcao.value = b.id;
        opcao.textContent = b.titulo.replace(/^[‘'“"]+|[’'”"]+$/g, '') + ' · ' + outrosBaseTotal(b) + ' min';
        outrosBaseSelect.appendChild(opcao);
      });
      outrosBaseSelect.value = outrosBaseId;
      const info = document.getElementById('outrosBaseInfo');
      info.textContent = '';
      if (atual) {
        const leituras = outrosBaseLeituras(atual);
        const linhas = [
          '📥 ' + atual.titulo + ' · ' + outrosBaseTotal(atual) + ' min · ' + atual.esboco.secoes.length + (atual.esboco.secoes.length === 1 ? ' seção' : ' seções') + (atual.arquivo ? ' · arquivo ' + atual.arquivo : ''),
          atual.esboco.notaAoOrador ? 'objetivo: ' + atual.esboco.notaAoOrador : '',
          leituras.length ? 'leituras marcadas: ' + leituras.join('; ') : 'sem leituras marcadas: a IA escolhe os textos (ou você os escolhe na lista, depois de ler a matéria)'
        ].filter(Boolean);
        linhas.forEach((linha, i) => { if (i) info.appendChild(document.createElement('br')); info.append(linha); });
      }
      document.getElementById('outrosBaseVerBtn').hidden = !atual; // "Ver o esboço original" só com um esboço importado escolhido
      document.getElementById('outrosBaseApagarBtn').hidden = !atual;
      outrosCamposEl.minutos.disabled = Boolean(atual);
      if (atual) outrosCamposEl.minutos.value = String(Math.max(3, Math.min(60, outrosBaseTotal(atual) || 30)));
      outrosCamposEl.tema.placeholder = atual ? atual.titulo : 'Ex.: Como enfrentar a ansiedade';
      outrosAtualizarResumo();
    }

    function outrosBaseEscolher(id) {
      outrosBaseId = id;
      const atual = outrosBaseAtual();
      if (atual && !outrosCamposEl.tema.value.trim()) outrosCamposEl.tema.value = atual.titulo.replace(/^[‘'“"]+|[’'”"]+$/g, '');
      outrosZerarLeitura();
      outrosBaseMostrar();
      outrosSalvarRascunho();
    }

    async function outrosBaseImportar(arquivos) {
      const docx = [...arquivos].filter(a => /\.docx$/i.test(a.name));
      if (!docx.length) return outrosBaseDizer('Escolha um arquivo .docx.', true);
      outrosBaseDizer('Lendo o esboço…', false);
      try {
        await loadScriptOnce(BACKUP_LIBS.jszip);
        const mensagens = [];
        let escolhido = '';
        for (const arquivoDocx of docx) {
          const resultado = await s34LerDocx(window.JSZip, arquivoDocx.name, new Uint8Array(await arquivoDocx.arrayBuffer()), arquivoDocx.lastModified, true);
          if (resultado.erro) { mensagens.push('⚠️ ' + arquivoDocx.name + ': ' + resultado.erro + '.'); continue; }
          const esboco = resultado.esboco;
          const chave = JSON.stringify({ ...esboco, arquivo: '', arquivoModificado: '' });
          const repetido = outrosBases.find(b => JSON.stringify({ ...b.esboco, arquivo: '', arquivoModificado: '' }) === chave);
          if (repetido) { escolhido = repetido.id; mensagens.push('Já estava importado: ' + repetido.titulo + '.'); continue; }
          const item = { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), titulo: esboco.titulo, importadoEm: new Date().toISOString(), arquivo: arquivoDocx.name, esboco };
          outrosBases.unshift(item);
          escolhido = item.id;
          const leituras = outrosBaseLeituras(item).length;
          mensagens.push('✅ ' + esboco.titulo + ' (' + outrosBaseTotal(item) + ' min, ' + esboco.secoes.length + ' seções, ' + (leituras ? leituras + (leituras === 1 ? ' leitura marcada' : ' leituras marcadas') : 'sem leituras marcadas') + ').' + (resultado.avisos.length ? ' Avisos: ' + resultado.avisos.join(' ') : ''));
        }
        outrosBases = outrosBases.slice(0, OUTROS_MAX_BASES);
        if (escolhido) { outrosBaseGuardar(); outrosBaseEscolher(escolhido); } else outrosBaseMostrar();
        outrosBaseDizer(mensagens.join(' '), mensagens.some(m => m.startsWith('⚠️')));
      } catch (e) {
        outrosBaseDizer('Não consegui ler o arquivo agora.', true);
      }
    }

    document.getElementById('outrosBaseImportarBtn').addEventListener('click', () => document.getElementById('outrosBaseArquivo').click());
    document.getElementById('outrosBaseArquivo').addEventListener('change', event => {
      const arquivos = [...event.target.files];
      event.target.value = ''; // permite escolher o mesmo arquivo de novo
      if (arquivos.length) outrosBaseImportar(arquivos);
    });
    outrosBaseSelect.addEventListener('change', () => outrosBaseEscolher(outrosBaseSelect.value));
    // O esboço importado já está neste aparelho: abre na mesma página do Discurso público, sem pedir nada ao servidor.
    document.getElementById('outrosBaseVerBtn').addEventListener('click', () => {
      const atual = outrosBaseAtual();
      if (!atual || !visor.hidden) return;
      visorAbrir('Esboço importado', document.getElementById('outrosBaseVerBtn'));
      visorMostrar({ ...atual.esboco, arquivo: atual.esboco.arquivo || atual.arquivo || '' });
    });
    document.getElementById('outrosBaseApagarBtn').addEventListener('click', async () => {
      const atual = outrosBaseAtual();
      if (!atual) return;
      if (!(await askConfirm('Apagar o esboço importado "' + atual.titulo + '" deste aparelho? Não dá para desfazer (é só importar o arquivo de novo).', 'Apagar esboço importado'))) return;
      outrosBases = outrosBases.filter(b => b.id !== atual.id);
      outrosBaseGuardar();
      outrosBaseEscolher('');
      outrosBaseDizer('Esboço importado apagado deste aparelho.', false);
    });
    outrosBaseMostrar();

    document.getElementById('outrosLimparBtn').addEventListener('click', async () => {
      if (!(await askConfirm('Apagar tudo o que você escreveu neste card (tema, ideia, matéria, artigos e textos)? O esboço que já está no campo de texto não muda e os esboços importados continuam guardados neste aparelho.', 'Limpar os campos'))) return;
      Object.values(outrosCamposEl).forEach(el => { el.value = ''; });
      outrosCamposEl.minutos.value = '30';
      outrosResultados.textContent = '';
      outrosResultados.hidden = true;
      outrosBaseId = '';
      outrosBaseMostrar();
      outrosZerarLeitura();
      outrosSalvarRascunho();
      aiStatusKind = 'outros';
      setAiStatus('', false);
    });

    // ---------- Joias espirituais ----------
    // O servidor lê a leitura da Bíblia da semana (no alto da apostila Vida e Ministério), os versículos de cada capítulo
    // e os trechos das publicações do Índice das Publicações, e a IA prepara até 2 joias por capítulo e a resposta à
    // pergunta da apostila. Tudo vai para o campo de texto, cada item com o botão azul de copiar.
    const JOIAS_KEY = 'jwLibraryNoteAplicarJoiasV1';
    const joiasInfo = document.getElementById('joiasInfo');
    const joiasCarregarBtn = document.getElementById('joiasCarregarBtn');
    const joiasResponderBtn = document.getElementById('joiasResponderBtn');
    const joiasPergunta = document.getElementById('joiasPergunta');
    const joiasLeitura = document.getElementById('joiasLeitura');
    const joiasOutputSlot = document.getElementById('joiasOutputSlot');
    try {
      const salvo = JSON.parse(localStorage.getItem(JOIAS_KEY) || 'null');
      if (salvo) {
        joiasPergunta.checked = salvo.pergunta !== false;
        joiasLeitura.checked = salvo.leitura !== false;
      }
    } catch (e) { /* sem localStorage: valem os padrões */ }
    [joiasPergunta, joiasLeitura].forEach(c => c.addEventListener('change', () => {
      safeSetItem(JOIAS_KEY, JSON.stringify({ pergunta: joiasPergunta.checked, leitura: joiasLeitura.checked }));
    }));

    // Leitura da semana (com o link da apostila no wol.jw.org) vira o título do cartão, em destaque; a linha de informações fica com a
    // pergunta da apostila. Sem leitura carregada: "Aguardando carregar perguntas".
    function joiasMostrarInfo(dados) {
      joiasInfo.textContent = '';
      const carregado = Boolean(dados && dados.leitura);
      const titulo = document.getElementById('joiasTitulo');
      titulo.textContent = '';
      if (carregado) {
        const link = document.createElement('a');
        link.href = dados.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const semana = String(dados.semana || '').toLowerCase();
        link.append(dados.leitura);
        if (semana) {
          const linhaSemana = document.createElement('span');
          linhaSemana.className = 'titulo-semana';
          linhaSemana.textContent = semana;
          link.appendChild(linhaSemana);
        }
        titulo.appendChild(link);
      } else {
        titulo.textContent = 'Aguardando carregar perguntas';
      }
      titulo.classList.toggle('study-tema', carregado);
      titulo.classList.toggle('study-aguardando', !carregado);
      const rotulo = carregado ? '↻ Recarregar perguntas' : '📋 Carregar perguntas';
      if (joiasCarregarBtn.dataset.label) joiasCarregarBtn.dataset.label = rotulo; // carregando: o rótulo volta ao fim (setAiLoading)
      else joiasCarregarBtn.textContent = rotulo;
      if (carregado && dados.pergunta) joiasInfo.append('❓ ' + dados.pergunta);
    }

    // ---------- Imagens da apostila (a apostila Vida e Ministério da semana inteira) ----------
    // Todas as imagens da apostila, com a descrição, a legenda e o botão que copia só a descrição, agrupadas pela parte em que estão (inclusive
    // as de partes que o app não trata, como "Nossa Vida Cristã").
    const apostilaImgInfo = document.getElementById('apostilaImgInfo');
    const apostilaImgBtn = document.getElementById('apostilaImgCarregarBtn');
    const apostilaImgLista = document.getElementById('apostilaImgLista');

    function apostilaImgMostrar(dados) {
      apostilaImgInfo.textContent = '';
      apostilaImgLista.textContent = '';
      const carregado = Boolean(dados && Array.isArray(dados.imagens));
      const titulo = document.getElementById('apostilaImgTitulo');
      titulo.textContent = '';
      if (carregado) {
        const link = document.createElement('a');
        link.href = dados.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.append('Imagens da apostila');
        const semana = String(dados.semana || '').toLowerCase();
        if (semana) {
          const linhaSemana = document.createElement('span');
          linhaSemana.className = 'titulo-semana';
          linhaSemana.textContent = semana;
          link.appendChild(linhaSemana);
        }
        titulo.appendChild(link);
      } else {
        titulo.textContent = 'Aguardando carregar imagens';
      }
      titulo.classList.toggle('study-tema', carregado);
      titulo.classList.toggle('study-aguardando', !carregado);
      const rotulo = carregado ? '↻ Recarregar imagens' : '📋 Carregar imagens';
      if (apostilaImgBtn.dataset.label) apostilaImgBtn.dataset.label = rotulo; // carregando: o rótulo volta ao fim (setAiLoading)
      else apostilaImgBtn.textContent = rotulo;
      if (!carregado) return;
      const imagens = dados.imagens;
      apostilaImgInfo.textContent = imagens.length
        ? imagens.length + (imagens.length === 1 ? ' imagem na apostila desta semana.' : ' imagens na apostila desta semana.')
        : 'A apostila desta semana não tem imagens com descrição ou legenda.';
      let parteAtual = null;
      imagens.forEach(imagem => {
        const bloco = imagemBloco(imagem);
        if (!bloco) return;
        // Uma linha separa cada imagem da anterior (e a primeira da contagem acima); a parte da apostila aparece só na primeira imagem dela.
        const item = document.createElement('div');
        item.className = 'apostila-img-item';
        const parte = [imagem.secao, imagem.item].filter(Boolean).join(' · ');
        if (parte && parte !== parteAtual) {
          const cabecalho = document.createElement('p');
          cabecalho.className = 'apostila-img-parte';
          cabecalho.textContent = parte;
          item.appendChild(cabecalho);
          parteAtual = parte;
        }
        item.appendChild(bloco);
        apostilaImgLista.appendChild(item);
      });
    }

    function apostilaImgSemanaMudou() {
      apostilaImgMostrar(carregadoDe('imagens'));
    }

    async function apostilaImgCarregar() {
      if (aiBusy) return;
      aiStatusKind = 'apostilaimg';
      const accessError = studyAccessError();
      if (accessError) return setAiStatus(accessError, true);
      aiBusy = true;
      setAiLoading(true, apostilaImgBtn, 'site');
      try {
        const result = await postStudy({ tarefa: 'apostila-imagens', codigo: codigoAcessoSalvo(), ano: aiWeekYear, semana: aiWeekNumber }, 60000);
        if (!result.ok) return setAiStatus(studyFailureMessage(result, 'Não consegui ler a apostila agora.'), true);
        apostilaImgMostrar(result.data);
        carregadoGuardar('imagens', result.data);
        setAiStatus('✅ Imagens da apostila carregadas.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao ler a apostila.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }
    apostilaImgBtn.addEventListener('click', apostilaImgCarregar);

    const joiasCarregado = () => document.getElementById('joiasTitulo').classList.contains('study-tema');

    function joiasSemanaMudou() {
      joiasMostrarInfo(carregadoDe('joias'));
    }

    async function joiasCarregar() {
      if (aiBusy) return;
      aiStatusKind = 'joias';
      const accessError = studyAccessError();
      if (accessError) return setAiStatus(accessError, true);
      aiBusy = true;
      setAiLoading(true, joiasCarregarBtn, 'site');
      try {
        const result = await postStudy({ tarefa: 'joias-ler', codigo: codigoAcessoSalvo(), ano: aiWeekYear, semana: aiWeekNumber }, 60000);
        if (!result.ok) return setAiStatus(studyFailureMessage(result, 'Não consegui ler a leitura da semana agora.'), true);
        joiasMostrarInfo(result.data);
        carregadoGuardar('joias', result.data);
        setAiStatus('✅ Leitura da semana carregada.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'O site demorou demais. Tente de novo.' : 'Falha de conexão ao ler a leitura da semana.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    // Cada joia da leitura: primeiro o texto bíblico na íntegra (copiado da Bíblia pelo servidor) e, logo depois, "💎 JOIA 👉 Jeremias 45:5. comentário",
    // formatado como as respostas (destaques, emoji, quebras); os outros textos, se houver, vêm depois do comentário.
    function joiasPartes(joias) {
      return joias.map(item => {
        const body = aiBuildLine(item.resposta, {
          destaques: Array.isArray(item.destaques) ? item.destaques : [],
          emoji: item.emoji || '',
          quebras: Array.isArray(item.quebras) ? item.quebras : []
        });
        const joia = aiLabelWith(null, '💎 JOIA 👉 ', (item.paragrafos ? item.paragrafos + '. ' : '') + body);
        const v = item.versiculo;
        const versiculo = v && v.referencia && v.texto ? buildSourceBlocks({ textos: [{ referencia: v.referencia, texto: v.texto }] }) : '';
        const extras = buildSourceBlocks(item);
        return { paragrafos: item.paragrafos || '', texto: [versiculo, joia, extras].filter(Boolean).join('\n\n') };
      });
    }

    async function requestJoias(mode) {
      if (aiBusy) return;
      aiLastKind = 'joias';
      aiStatusKind = 'joias';
      placeAiOutput(joiasOutputSlot);
      const refino = mode ? aiRefinoDe('joias') : null; // refazer: o mesmo pedido da resposta que está no campo
      const pedirPergunta = refino ? refino.pergunta : joiasPergunta.checked;
      const pedirLeitura = refino ? refino.leitura : joiasLeitura.checked;
      if (!pedirPergunta && !pedirLeitura) return setAiStatus('Marque a pergunta da apostila ou as joias da leitura.', true);
      const accessError = studyAccessError();
      if (accessError) return setAiStatus(accessError, true);

      if (mode) {
        if (!(await confirmAiRestore())) return;
        if (aiAppliedAny) restoreAiBaseText();
      } else {
        aiSentinelaRaw = [];
        aiAppliedAny = false;
        if (input.value) {
          setInputRange(0, input.value.length, '', { message: 'Campo de texto limpo para as joias.' });
          autoGrowInputText();
        }
      }

      aiResults.textContent = '';
      aiSuggestions = [];
      aiRaw = [];
      const previousAnswers = mode && aiResumo && aiSentinelaRaw.length ? aiSentinelaRaw : null;
      aiResumo = null;
      updateAiControls();
      if (!aiAppliedAny) aiBaseText = input.value;
      saveAiOptions();

      const payload = {
        tarefa: 'joias',
        codigo: codigoAcessoSalvo(),
        ano: aiWeekYear,
        semana: aiWeekNumber,
        pergunta: pedirPergunta,
        leitura: pedirLeitura,
        opcoes: readAiOptions(),
        ajuste: iaExtra('joias')
      };
      if (previousAnswers) {
        payload.modo = mode;
        payload.anteriores = { itens: previousAnswers };
      }

      aiBusy = true;
      setAiLoading(true, mode === 'nova' ? aiAnotherBtn : mode === 'melhorar' ? aiImproveBtn : joiasResponderBtn);
      try {
        const result = await postStudy(payload, IA_ESPERA_MS);
        if (!result.ok) return setAiStatus(studyFailureMessage(result, 'Não foi possível preparar as joias agora.'), true);
        const pergunta = result.data.pergunta || null;
        const joias = Array.isArray(result.data.joias) ? result.data.joias : [];
        aiSentinelaRaw = [...(pergunta ? [pergunta] : []), ...joias];
        if (!aiSentinelaRaw.length) return setAiStatus(result.data.erro || 'A IA não preparou as joias. Tente de novo.', true);
        if (!joiasCarregado()) joiasMostrarInfo(result.data);

        const parts = [...(pergunta ? buildSentinelaParts([pergunta]) : []), ...joiasPartes(joias)];
        aiResumo = { texto: parts.map(part => part.texto).join('\n\n\n'), partes: parts, done: false, kind: 'estudo', fonte: result.data.leitura || '' };
        appendToMainText(aiResumo.texto);
        aiRefino = { kind: 'joias', pergunta: payload.pergunta, leitura: payload.leitura };
        historicoSalvar({ tipo: 'joias', titulo: '💎 Joias espirituais' + (result.data.leitura ? ' · ' + result.data.leitura : ''), ano: payload.ano, numSemana: payload.semana, partes: parts, refino: { ...aiRefino, itens: aiSentinelaRaw } });
        renderAiSuggestions();
        aiRefineBox.hidden = false;
        setAiStatus('✅ Joias no campo de texto, cada uma com o botão de copiar.', false);
      } catch (e) {
        setAiStatus(e && e.name === 'AbortError' ? 'A IA demorou demais. Tente de novo.' : 'Falha de conexão ao consultar a IA.', true);
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    joiasCarregarBtn.addEventListener('click', joiasCarregar);
    joiasResponderBtn.addEventListener('click', () => requestJoias());

    // ---------- Pesquisas e respostas salvas ----------
    // Cada resultado da IA nas reuniões (A Sentinela, texto colado, Estudo Bíblico, Joias e perguntas do dirigente) é
    // guardado neste aparelho (localStorage), com o título, a semana das reuniões (ano e número ISO), a data e as partes
    // com o texto de cada resposta. A lista mostra só as pesquisas da semana escolhida no alto da tela Reuniões.
    // "Abrir" põe o texto de volta no campo de texto com os botões de copiar. Ficam as 60 mais recentes (e no máximo
    // ~1,5 milhão de caracteres, para não encher a memória do navegador); as mais antigas saem sozinhas.
    const HISTORICO_KEY = 'jwLibraryNoteAplicarHistoricoV1';
    const HISTORICO_MAX = 60;
    const HISTORICO_MAX_CARACTERES = 1500000;

    function historicoLer() {
      try {
        const lista = JSON.parse(localStorage.getItem(HISTORICO_KEY) || '[]');
        return Array.isArray(lista) ? lista.map(historicoComSemana) : [];
      } catch (e) {
        return [];
      }
    }

    // As pesquisas salvas na 4.9.1 guardavam só o texto da semana ("19 a 25 de outubro"): procura, perto do dia em que
    // foram salvas, a semana com esse texto (sem texto, fica a semana do dia em que foi salva).
    function historicoComSemana(item) {
      if (item.ano && item.numSemana) return item;
      const salvo = new Date(item.data);
      salvo.setHours(12, 0, 0, 0);
      const monday = new Date(salvo);
      monday.setDate(salvo.getDate() - ((salvo.getDay() + 6) % 7));
      let achada = monday;
      for (let k = 0; item.semana && k <= 26 && achada === monday; k++) {
        for (const passo of k ? [-k, k] : [0]) {
          const tentativa = new Date(monday);
          tentativa.setDate(monday.getDate() + passo * 7);
          if (rotuloDaSemana(tentativa) === item.semana) { achada = tentativa; break; }
        }
      }
      const [ano, numSemana] = isoYearWeek(achada);
      return { ...item, ano, numSemana };
    }

    // O rótulo da semana ISO (ano e número) como o app o escreve na barra do alto: "19 a 25 de outubro".
    function rotuloDaSemanaIso(ano, semana) {
      const quatroJan = new Date(ano, 0, 4, 12); // a semana 1 é a que tem o dia 4 de janeiro
      const segunda = new Date(quatroJan);
      segunda.setDate(quatroJan.getDate() - ((quatroJan.getDay() + 6) % 7) + (semana - 1) * 7);
      return rotuloDaSemana(segunda);
    }

    // O nome mostrado na lista: as pesquisas da matéria da semana (comentários e perguntas para dirigentes) levam a semana a que se
    // referem, logo depois do tipo ("💎 Joias espirituais · 19 a 25 de outubro - JEREMIAS 45-46"). Os esboços já trazem a semana ou o
    // número do tema no próprio nome, e o texto colado não tem semana de matéria.
    function historicoTituloExibido(item) {
      if (item.tipo === 'esboco' || item.tipo === 'colado' || !item.ano || !item.numSemana) return item.titulo;
      const rotulo = rotuloDaSemanaIso(item.ano, item.numSemana);
      const partes = String(item.titulo).split(' · ');
      if (partes.length === 1) return item.titulo + ' · ' + rotulo;
      return [partes[0], rotulo + ' - ' + partes[1], ...partes.slice(2)].join(' · ');
    }

    // Ao abrir o app: os esboços salvos antes ganham no nome a semana (os da semana) ou o número do tema (os públicos que já o guardam).
    function historicoNormalizarNomes() {
      const lista = historicoLer();
      let mudou = false;
      Object.values(ESBOCOS).forEach(cfg => {
        const prefixo = cfg.tituloHistorico + ' · ';
        lista.forEach(item => {
          if (item.tipo !== 'esboco' || !String(item.titulo).startsWith(prefixo)) return;
          if (cfg.semSemana && !item.esbocoNumero) return; // o número vem da lista de temas (publicoNumerarSalvos)
          if (!cfg.semSemana && !(item.ano && item.numSemana)) return;
          const tema = item.esbocoTitulo || item.titulo.slice(prefixo.length);
          const novo = prefixo + (cfg.semSemana ? 'Nº ' + item.esbocoNumero : rotuloDaSemanaIso(item.ano, item.numSemana)) + ' - ' + tema;
          if (novo === item.titulo && item.esbocoTitulo) return;
          item.titulo = novo;
          item.esbocoTitulo = tema;
          mudou = true;
        });
      });
      if (mudou) historicoGravar(lista);
    }

    // Os esboços públicos salvos antes de o app guardar o número do tema: o número vem da lista de temas do S-34 (pelo título).
    function publicoNumerarSalvos(temas) {
      const prefixo = ESBOCOS.publico.tituloHistorico + ' · ';
      const lista = historicoLer();
      let mudou = false;
      lista.forEach(item => {
        if (item.tipo !== 'esboco' || item.esbocoNumero || !String(item.titulo).startsWith(prefixo)) return;
        const tema = (temas || []).find(t => prefixo + t.titulo === item.titulo);
        if (!tema) return;
        item.esbocoNumero = tema.numero;
        item.esbocoTitulo = tema.titulo;
        item.titulo = prefixo + 'Nº ' + tema.numero + ' - ' + tema.titulo;
        mudou = true;
      });
      if (mudou) {
        historicoGravar(lista);
        historicoRender();
      }
    }

    // Ao abrir o app, se há esboço público salvo sem número, busca a lista de temas (sem mostrar nada) e numera. Só com o código do dirigente.
    let publicoNumeracaoTentada = false;
    async function publicoNumerarSalvosEmSilencio() {
      if (publicoNumeracaoTentada || !codigoDirigenteSalvo() || !codigoS34Salvo()) return;
      const prefixo = ESBOCOS.publico.tituloHistorico + ' · ';
      if (!historicoLer().some(i => i.tipo === 'esboco' && !i.esbocoNumero && String(i.titulo).startsWith(prefixo))) return;
      publicoNumeracaoTentada = true;
      const result = await postStudy({ tarefa: 'publico-lista', codigoDirigente: codigoDirigenteSalvo() }, 30000).catch(() => null);
      if (result && result.ok) publicoNumerarSalvos(result.data.temas || []);
    }

    // ---------- Salvar as alterações do texto numa pesquisa salva ----------
    // Depois de gerar um esboço ou respostas (ou de abrir uma pesquisa salva), o texto do campo pode ser mexido à vontade (inserir texto,
    // formatar, trocar a fonte, espaços…). O botão Salvar guarda o texto do campo na pesquisa salva (em "textoEditado", sem apagar o
    // que a IA fez) e Abrir passa a trazer essa versão. Um campo vazio desliga o texto da pesquisa salva (sem risco de sobrescrevê-la).
    function historicoLigar(id, titulo) {
      const item = historicoLer().find(i => i.id === id);
      const esboco = Boolean(item && item.tipo === 'esboco');
      historicoLigado = { id, titulo, base: input.value, esboco, nome: esboco ? item.esbocoTitulo || '' : '' };
      document.getElementById('exportarInfo').textContent = EXPORTAR_INFO_PADRAO;
      atualizarBotoesSalvar();
    }

    function atualizarBotoesSalvar() {
      if (historicoLigado && !input.value) historicoLigado = null;
      const ligado = Boolean(historicoLigado);
      const sujo = ligado && input.value !== historicoLigado.base;
      salvarBloco.hidden = !ligado;
      document.getElementById('exportarBloco').hidden = !input.value.trim();
      // O resultado da última exportação ("✅ nome.docx") sai quando o texto muda, voltando à explicação de sempre.
      const exportarInfo = document.getElementById('exportarInfo');
      if (exportarInfo.dataset.texto !== undefined && exportarInfo.dataset.texto !== input.value) {
        exportarInfo.textContent = exportarInfo.dataset.padrao || '';
        delete exportarInfo.dataset.texto;
      }
      salvarBtn.disabled = !sujo;
      const memoriaLinha = document.getElementById('memoriaUsarLinha');
      memoriaLinha.hidden = !(ligado && sujo && senhaAdminSalva());
      if (memoriaLinha.hidden) document.getElementById('memoriaUsar').checked = false;
      if (!ligado || sujo) salvarAvisoFim(); // mexeu de novo (ou trocou de texto): o aviso de salvo sai
      salvarInfo.textContent = !ligado ? '' : (sujo
        ? 'Grava o texto do campo em: '
        : (historicoLigado.salvoEm ? '✅ Salvo às ' + historicoLigado.salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '. Pesquisa salva: ' : 'Sem alterações novas. Pesquisa salva: ')) + historicoLigado.titulo;
    }

    // Retorno de que salvou: o botão mostra "Alterações salvas" por uns segundos, além da mensagem e da hora na linha abaixo dele.
    function salvarAvisoFim() {
      clearTimeout(salvarTimer);
      salvarTimer = 0;
      salvarBtn.classList.remove('salvo');
      salvarBtn.textContent = '💾 Salvar alterações';
    }

    function salvarAvisoInicio() {
      salvarBtn.classList.add('salvo');
      salvarBtn.textContent = '✅ Alterações salvas!';
      clearTimeout(salvarTimer);
      salvarTimer = setTimeout(salvarAvisoFim, 4000);
    }

    function historicoSalvarAlteracoes() {
      const ligacao = historicoLigado;
      if (!ligacao) return;
      if (input.value === ligacao.base) {
        copyStatus.textContent = 'Nada a salvar: o texto está igual ao da pesquisa salva.';
        return;
      }
      const lista = historicoLer();
      const item = lista.find(i => i.id === ligacao.id);
      if (!item) {
        historicoLigado = null;
        atualizarBotoesSalvar();
        copyStatus.textContent = 'Esta pesquisa salva não existe mais (foi apagada). Gere de novo para salvar.';
        return;
      }
      const texto = input.value;
      const original = (item.partes || []).map(p => p.texto).join('\n\n\n');
      const guardarMemoria = document.getElementById('memoriaUsar').checked && senhaAdminSalva() && texto !== original;
      if (guardarMemoria) memoriaGuardar(item, original, texto);
      if (texto === original) {
        delete item.textoEditado;
        delete item.editadoEm;
      } else {
        item.textoEditado = texto;
        item.editadoEm = new Date().toISOString();
      }
      historicoGravar(lista);
      if (!historicoLer().some(i => i.id === item.id)) {
        copyStatus.textContent = 'Não foi possível salvar: a memória do aparelho está cheia. Apague pesquisas salvas antigas e tente de novo.';
        return;
      }
      ligacao.base = texto;
      ligacao.salvoEm = new Date();
      historicoRender();
      atualizarBotoesSalvar();
      salvarAvisoInicio();
      copyStatus.textContent = '💾 Alterações salvas. Ao abrir esta pesquisa em Pesquisas e respostas salvas, o texto volta como está agora.';
    }
    salvarBtn.addEventListener('click', historicoSalvarAlteracoes);

    // ---------- Memória de lições das correções (piloto, só administrador) ----------
    // Ao salvar uma alteração com a caixa 🧠 marcada, o texto da IA e o texto final vão ao servidor só para a IA compará-los (api/_memoria.mjs):
    // ela devolve a lição (o que mudou, o porquê e uma regra) e os dois textos são descartados. Com a chave geral ligada,
    // as lições ativas entram no system prompt das respostas de IA (filtradas pela tarefa; ver api/_memoria.mjs).
    async function memoriaGuardar(item, original, final) {
      copyStatus.textContent = '🧠 A IA está analisando a correção…';
      const r = await postConfig({ acao: 'memoria-guardar', codigo: senhaAdminSalva(), tarefa: item.tipo || '', original, final });
      document.getElementById('memoriaUsar').checked = false;
      if (!r.ok) {
        copyStatus.textContent = '🧠 A lição não foi guardada: ' + ((r.data && r.data.erro) || 'sem conexão com o servidor') + '. O texto salvo no aparelho está certo.';
        return;
      }
      copyStatus.textContent = r.data.guardada
        ? '🧠 Lição guardada: ' + r.data.licao.regra
        : '🧠 Nada guardado: ' + r.data.motivo;
    }

    // ---------- Exportar o texto do campo para Word (.docx) ----------
    // O texto do campo (com as alterações do usuário) vira um documento Word, seja ele o que for: resposta, perguntas, esboço ou nota. As letras
    // formatadas (𝐧𝐞𝐠𝐫𝐢𝐭𝐨, 𝑖𝑡á𝑙𝑖𝑐𝑜, nas fontes do app) voltam a ser letras comuns com negrito e itálico de verdade; as outras fontes decorativas
    // (letra dupla, caixa escura…) viram letras comuns. Emojis e símbolos ficam. Cada linha do campo vira um parágrafo; o recuo (espaços no
    // começo da linha) vira recuo de parágrafo. O botão aparece sempre que o campo tem texto. Nos esboços salvos, o texto dos versículos que
    // faltam vem do servidor (só para devolver os acentos); o resto é montado no aparelho.
    const EXPORTAR_INFO_PADRAO = 'Abre a prévia do documento Word com o texto do campo acima (com as suas alterações), em letras comuns, com negrito e itálico de verdade e os emojis. Lá você escolhe o tamanho da letra e finaliza a exportação.';
    document.getElementById('exportarInfo').textContent = EXPORTAR_INFO_PADRAO;
    document.getElementById('exportarInfo').dataset.padrao = EXPORTAR_INFO_PADRAO;
    const DOCX_ESTILO = { bold: 'b', sansBold: 'b', boldScript: 'b', boldFraktur: 'b', italic: 'i', sansItalic: 'i', boldItalic: 'bi', sansBoldItalic: 'bi' };
    const DOCX_SEM_LETRA = new Set(['circled', 'blackCircledNumbers']); // números circulados são símbolos de lista, não "fonte": ficam como estão
    const DOCX_EMOJI = /(?:[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|\uFE0F)/gu;
    let docxMapa = null; // letra formatada -> { c: letra comum, f: '' | 'b' | 'i' | 'bi' }

    function docxMontarMapa() {
      const mapa = new Map();
      const pores = (fancy, plain, estilo) => mapa.set(fancy, { c: plain, f: DOCX_ESTILO[estilo.id] || '' });
      styles.forEach(estilo => {
        if (estilo.id === 'normal') return;
        if (estilo.explicit) {
          Object.entries(explicitMaps[estilo.explicit] || {}).forEach(([plain, fancy]) => {
            if (/\d/.test(plain) && DOCX_SEM_LETRA.has(estilo.id)) return;
            if (!/\d/.test(plain) && estilo.id === 'blackCircledNumbers') return;
            pores(fancy, plain, estilo);
          });
        }
        if (estilo.upper) for (let i = 0; i < 26; i++) pores(String.fromCodePoint(estilo.upper + i), String.fromCharCode(65 + i), estilo);
        if (estilo.lower) for (let i = 0; i < 26; i++) pores(String.fromCodePoint(estilo.lower + i), String.fromCharCode(97 + i), estilo);
        if (estilo.digit) for (let i = 0; i < 10; i++) pores(String.fromCodePoint(estilo.digit + i), String.fromCharCode(48 + i), estilo);
        Object.entries(specialMathChars[estilo.id] || {}).forEach(([plain, fancy]) => pores(fancy, plain, estilo));
      });
      return mapa;
    }

    // Os esboços salvos antes não guardam o texto dos versículos: o servidor devolve o texto exato dos que faltam (sem custo de IA).
    // Sem conexão, sem o código do dirigente ou com erro, a exportação segue sem esses acentos.
    async function docxCompletarVersiculos(json) {
      if (!json || !Array.isArray(json.pontos) || !navigator.onLine || !codigoDirigenteSalvo()) return json;
      const faltam = [...new Set(json.pontos.flatMap(p => (p.desenvolvimento || []).map(d => d.leitura)).filter(l => l && l.referencia && !l.texto).map(l => l.referencia))];
      if (!faltam.length) return json;
      try {
        const result = await postStudy({ tarefa: 'versiculos', codigoDirigente: codigoDirigenteSalvo(), referencias: faltam }, 20000);
        if (!result.ok || !result.data || !Array.isArray(result.data.versiculos)) return json;
        return { ...json, versiculosDoServidor: result.data.versiculos.map(v => v.texto).filter(Boolean) };
      } catch (e) {
        return json;
      }
    }

    // ---- Acentos ----
    // As fontes do app (negrito, itálico) não têm letras acentuadas: "oração" em negrito vira "oracao". Para o Word, os acentos voltam
    // do próprio esboço salvo (todos os textos dele, com os acentos certos) e das palavras sem formatação do texto do campo:
    // 1) um trecho formatado com 2 ou mais palavras seguidas que existe numa frase do esboço salvo recebe as palavras dela (o contexto
    //    resolve "e" e "é"); 2) uma palavra sozinha só recebe o acento se tem 5 letras ou mais e se só se conhece a forma acentuada.
    const DOCX_PALAVRA = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
    const docxChave = palavra => palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    function docxPrepararAcentos(texto, json) {
      if (!docxMapa) docxMapa = docxMontarMapa();
      const frases = [];
      const coletar = valor => {
        if (typeof valor === 'string') {
          const orig = [...valor.matchAll(DOCX_PALAVRA)].map(m => m[0].normalize('NFC'));
          if (orig.length) frases.push({ orig, chaves: orig.map(docxChave) });
        } else if (Array.isArray(valor)) valor.forEach(coletar);
        else if (valor && typeof valor === 'object') Object.values(valor).forEach(coletar);
      };
      coletar(json);
      coletar(['Aplicação', 'Ilustração', 'Transição', 'Lição']);
      const dicionario = new Map(); // chave sem acento -> Map(forma minúscula -> quantas vezes)
      const somar = palavra => {
        const forma = palavra.toLowerCase();
        const chave = docxChave(forma);
        if (!dicionario.has(chave)) dicionario.set(chave, new Map());
        dicionario.get(chave).set(forma, (dicionario.get(chave).get(forma) || 0) + 1);
      };
      frases.forEach(frase => frase.orig.forEach(somar));
      // As palavras do próprio texto sem nenhuma letra formatada têm os acentos certos.
      for (const m of String(texto || '').matchAll(DOCX_PALAVRA)) if (![...m[0]].some(ch => docxMapa.has(ch))) somar(m[0].normalize('NFC'));
      return { frases, dicionario };
    }

    function docxRestaurarAcentos(L, ac) {
      if (!ac) return L;
      let i = 0;
      while (i < L.length) {
        if (!L[i].f) { i++; continue; }
        let j = i;
        while (j < L.length && L[j].f) j++;
        const base = i;
        const palavras = [...L.slice(i, j).map(x => x.c).join('').matchAll(DOCX_PALAVRA)].map(m => ({ p: m[0], ini: base + m.index, chave: docxChave(m[0]) }));
        const aplicar = (palavra, original) => {
          const o = [...original];
          if (o.length !== palavra.p.length) return;
          o.forEach((letra, t) => {
            const alvo = L[palavra.ini + t];
            if (docxChave(letra) !== alvo.c.toLowerCase() || letra.toLowerCase() === alvo.c.toLowerCase()) return;
            alvo.c = alvo.c !== alvo.c.toLowerCase() ? letra.toUpperCase() : letra.toLowerCase();
          });
        };
        let k = 0;
        while (k < palavras.length) {
          let melhor = 0;
          let original = null;
          for (const frase of ac.frases) {
            for (let s0 = 0; s0 + 1 < frase.chaves.length; s0++) {
              let n = 0;
              while (k + n < palavras.length && s0 + n < frase.chaves.length && frase.chaves[s0 + n] === palavras[k + n].chave) n++;
              if (n > melhor) { melhor = n; original = frase.orig.slice(s0, s0 + n); }
            }
          }
          if (melhor >= 2) {
            original.forEach((forma, n) => aplicar(palavras[k + n], forma));
            k += melhor;
            continue;
          }
          const formas = ac.dicionario.get(palavras[k].chave);
          if (formas && palavras[k].chave.length >= 5 && !formas.has(palavras[k].chave) && formas.size === 1) aplicar(palavras[k], [...formas.keys()][0]);
          k++;
        }
        i = j;
      }
      return L;
    }

    // Os caracteres de uma linha: [{ c, f }] (letra comum e o estilo que a letra formatada dizia).
    function docxLetras(linha) {
      if (!docxMapa) docxMapa = docxMontarMapa();
      return [...linha].map(ch => docxMapa.get(ch) ? { ...docxMapa.get(ch) } : { c: ch, f: '' });
    }

    // As fontes do app não têm letras acentuadas nem pontuação formatadas: uma palavra com letras formatadas e acentuadas (ex.:
    // "𝐒𝐔𝐁𝐓Í𝐓𝐔𝐋𝐎") vira toda do mesmo estilo; e o espaço ou a pontuação entre duas palavras do mesmo estilo (um texto bíblico em itálico,
    // com as vírgulas) fica no estilo também.
    function docxSuavizar(L) {
      const parteDePalavra = ch => /[\p{L}\p{N}]/u.test(ch);
      let i = 0;
      while (i < L.length) {
        if (!parteDePalavra(L[i].c)) { i++; continue; }
        let j = i + 1;
        while (j < L.length && (parteDePalavra(L[j].c) || (/['’-]/.test(L[j].c) && j + 1 < L.length && parteDePalavra(L[j + 1].c)))) j++;
        const contagem = {};
        for (let k = i; k < j; k++) if (L[k].f) contagem[L[k].f] = (contagem[L[k].f] || 0) + 1;
        const melhor = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];
        if (melhor) for (let k = i; k < j; k++) L[k].f = melhor;
        i = j;
      }
      const entre = /^[\s.,;:!?…"“”‘’'()[\]\-–—/]$/;
      let ultimo = -1;
      for (let k = 0; k < L.length; k++) {
        if (!L[k].f) continue;
        if (ultimo >= 0 && k - ultimo > 1 && k - ultimo <= 7 && L[ultimo].f === L[k].f) {
          let soEntre = true;
          for (let m = ultimo + 1; m < k; m++) if (!entre.test(L[m].c)) { soEntre = false; break; }
          if (soEntre) for (let m = ultimo + 1; m < k; m++) L[m].f = L[k].f;
        }
        ultimo = k;
      }
      return L;
    }

    const docxXml = texto => String(texto).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const DOCX_MARCAS = { verde: '9DF0BE', amarelo: 'FDE68A', laranja: 'FDBA74', rosa: 'F9A8D4', roxo: 'D8B4FE' }; // as cores do marca-texto da Leitura em voz alta (as mesmas da prévia)
    const DOCX_FONTE_EMOJI = '<w:rFonts w:ascii="Segoe UI Emoji" w:hAnsi="Segoe UI Emoji" w:eastAsia="Segoe UI Emoji" w:cs="Segoe UI Emoji"/>';

    // Um trecho de texto com o mesmo estilo vira uma ou mais "runs" (os emojis ficam em runs próprias, com a fonte de emojis).
    function docxRuns(texto, f, tamanho, cor, fundo) {
      const tam = tamanho ? '<w:sz w:val="' + tamanho + '"/><w:szCs w:val="' + tamanho + '"/>' : '';
      const corXml = cor ? '<w:color w:val="' + cor + '"/>' : ''; // vem antes do tamanho, na ordem do esquema do Word
      const fundoXml = fundo ? '<w:shd w:val="clear" w:color="auto" w:fill="' + fundo + '"/>' : ''; // o sombreado vem depois do tamanho
      const run = (t, emoji) => '<w:r><w:rPr>' + (emoji ? DOCX_FONTE_EMOJI : '') + (f.includes('b') && !emoji ? '<w:b/><w:bCs/>' : '') + (f.includes('i') && !emoji ? '<w:i/><w:iCs/>' : '') + corXml + tam + fundoXml + '</w:rPr><w:t xml:space="preserve">' + docxXml(t) + '</w:t></w:r>';
      let xml = '';
      let ate = 0;
      for (const m of texto.matchAll(DOCX_EMOJI)) {
        if (m.index > ate) xml += run(texto.slice(ate, m.index), false);
        xml += run(m[0], true);
        ate = m.index + m[0].length;
      }
      if (ate < texto.length) xml += run(texto.slice(ate), false);
      return xml;
    }

    // O modelo de uma linha do campo, que serve ao arquivo Word e à prévia: o recuo (em vinte avos de ponto), se a linha começa com marcador
    // (•, ◦ ou número de lista: o recuo é deslocado para a segunda linha do item alinhar com o texto) e os trechos com o estilo de cada um
    // ('', 'b', 'i' ou 'bi'). O recuo da linha (4 espaços = um nível) vira recuo de parágrafo. Linha em branco: null.
    function docxLinhaModelo(linha, acentos) {
      const recuo = (linha.match(/^[ \t]*/)[0].replace(/\t/g, '    ')).length;
      const sem = linha.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
      if (!sem) return null;
      const marcador = /^(?:[•◦▪‣]|[0-9#*]\uFE0F?\u20E3|[❶-❿①-⑳])/u.test(sem);
      const esquerda = Math.round(recuo * 113) + (marcador ? 284 : 0);
      const L = docxRestaurarAcentos(docxSuavizar(docxLetras(sem)), acentos);
      const trechos = [];
      let i = 0;
      while (i < L.length) {
        let j = i + 1;
        while (j < L.length && L[j].f === L[i].f) j++;
        trechos.push({ texto: L.slice(i, j).map(x => x.c).join(''), f: L[i].f });
        i = j;
      }
      return { esquerda, marcador, trechos };
    }

    // Uma linha do campo -> um parágrafo. escala: o tamanho das letras escolhido na prévia (1 = 11 pt, e 14 pt na primeira linha); os
    // recuos acompanham a escala.
    function docxParagrafo(linha, primeira, acentos, escala = 1) {
      const corpo = Math.round(22 * escala);
      const modelo = docxLinhaModelo(linha, acentos);
      if (!modelo) return escala === 1 ? '<w:p/>' : '<w:p><w:pPr><w:rPr><w:sz w:val="' + corpo + '"/><w:szCs w:val="' + corpo + '"/></w:rPr></w:pPr></w:p>';
      const esquerda = Math.round(modelo.esquerda * escala);
      const ind = esquerda || modelo.marcador ? '<w:ind w:left="' + esquerda + '"' + (modelo.marcador ? ' w:hanging="' + Math.round(284 * escala) + '"' : '') + '/>' : '';
      const xml = modelo.trechos.map(t => docxRuns(t.texto, t.f, primeira ? Math.round(28 * escala) : corpo)).join('');
      return '<w:p>' + (ind ? '<w:pPr>' + ind + '</w:pPr>' : '') + xml + '</w:p>';
    }

    // As linhas do campo como o Word as recebe: no máximo 2 linhas em branco seguidas e nenhuma no começo nem no fim.
    function docxLinhas(texto) {
      return String(texto || '').replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').replace(/^\n+|\n+$/g, '').split('\n');
    }

    // O corpo do documento: uma linha do campo por parágrafo.
    function docxCorpo(texto, acentos, escala = 1) {
      let primeira = true;
      return docxLinhas(texto).map(linha => {
        const xml = docxParagrafo(linha, primeira && linha.trim() !== '', acentos, escala);
        if (linha.trim() !== '') primeira = false;
        return xml;
      }).join('');
    }

    const DOCX_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

    // O pacote .docx (um zip com as partes mínimas que o Word exige) com o texto do campo; acentos: o que docxPrepararAcentos devolveu.
    async function docxGerar(texto, titulo, acentos, escala = 1) {
      return docxPacote(docxCorpo(texto, acentos, escala), titulo);
    }

    // O pacote .docx com o corpo (os parágrafos em XML) já pronto.
    async function docxPacote(corpo, titulo) {
      await loadScriptOnce(BACKUP_LIBS.jszip);
      const zip = new window.JSZip();
      const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
      zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
      zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
      zip.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + DOCX_NS + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR" w:eastAsia="pt-BR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>');
      zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + DOCX_NS + '><w:body>' + corpo + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="283" w:footer="283" w:gutter="0"/></w:sectPr></w:body></w:document>');
      zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + docxXml(titulo || 'Esboço') + '</dc:title><dc:creator>NoteStyle</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + agora + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + agora + '</dcterms:modified></cp:coreProperties>');
      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    // O esboço original (página "Ver o esboço original") em parágrafos do Word, com as letras no tamanho escolhido na página: 12 pt na escala 1
    // (como 1rem na tela), 9,6 pt a 21,6 pt de 0,8 a 1,8; o título, os subtítulos e as notas guardam as proporções da tela. Os níveis viram
    // recuos, o tempo de cada seção fica na ponta direita da linha do título e os destaques saem em itálico (importante) e itálico em negrito
    // (muito importante), como na página.
    function docxCorpoEsboco(esboco, zoom) {
      const corpo = Math.max(16, Math.round(24 * zoom)); // meios-pontos
      const prop = k => Math.round(corpo * k);
      const cinza = '6B7280';
      const paragrafo = (props, runs) => '<w:p>' + (props ? '<w:pPr>' + props + '</w:pPr>' : '') + runs + '</w:p>';
      const run = (texto, { b = false, i = false, sz = corpo, cor = '' } = {}) => docxRuns(texto, (b ? 'b' : '') + (i ? 'i' : ''), sz, cor);
      const partes = [];
      partes.push(paragrafo('<w:keepNext/><w:spacing w:after="60"/><w:jc w:val="center"/>', run(esboco.titulo, { b: true, sz: prop(1.25) })));
      partes.push(paragrafo('<w:spacing w:after="200"/><w:jc w:val="center"/>', run(visorSubtitulo(esboco), { sz: prop(0.85), cor: cinza })));
      if (esboco.notaAoOrador) {
        partes.push(paragrafo('<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="F59E0B"/></w:pBdr><w:spacing w:after="240"/><w:ind w:left="170"/>',
          run('Nota ao orador: ', { b: true, i: true }) + run(esboco.notaAoOrador, { i: true })));
      }
      const porNivel = Math.round(1.2 * (corpo / 2) * 20); // 1,2 em por nível, em vinte avos de ponto
      (esboco.secoes || []).forEach(secao => {
        const tempo = secao.minutos ? '<w:r><w:tab/></w:r>' + run(secao.minutos + ' min', { b: true, sz: prop(0.85), cor: cinza }) : '';
        partes.push(paragrafo('<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="9CA3AF"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="10772"/></w:tabs><w:spacing w:before="360" w:after="120"/>',
          run(secao.titulo, { b: true, sz: prop(1.05) }) + tempo));
        (secao.itens || []).forEach(item => {
          const nivel = Math.max(0, Math.min(4, item.nivel || 0));
          const base = { b: Boolean(item.negrito) && !item.nota, i: false, cor: item.nota ? cinza : '' };
          let runs = item.nota ? run('Nota ao orador: ', { b: true, i: true, cor: cinza }) : '';
          visorSegmentos(item.texto || '', item.destaques).forEach(s => {
            runs += run(s.texto, { ...base, b: base.b || s.nivel === 2, i: item.nota || s.nivel > 0 });
          });
          const faltam = visorLeiturasFaltando(item);
          if (faltam.length) runs += run(' 📖 Ler: ' + faltam.join('; '), { b: true, sz: prop(0.8) });
          partes.push(paragrafo('<w:spacing w:before="100"/>' + (nivel ? '<w:ind w:left="' + nivel * porNivel + '"/>' : ''), runs));
        });
      });
      if (esboco.notaFinal) {
        partes.push(paragrafo('<w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="9CA3AF"/></w:pBdr><w:spacing w:before="320"/><w:ind w:left="170"/>',
          run('Nota: ', { b: true, i: true }) + run(esboco.notaFinal, { i: true })));
      }
      return partes.join('');
    }

    function docxGerarEsboco(esboco, zoom, titulo) {
      return docxPacote(docxCorpoEsboco(esboco, zoom), titulo);
    }

    // O texto da Leitura em voz alta (leituraModeloDoc) em parágrafos do Word, com os trechos marcados em verde: 11 pt na escala 1, o título
    // em 14 pt; título e subtítulo em negrito, com espaço antes.
    function docxCorpoLeitura(modelo, escala = 1) {
      const corpo = Math.round(22 * escala);
      return modelo.map(par => {
        const cabecalho = par.tipo !== 'texto';
        const tam = par.tipo === 'titulo' ? Math.round(28 * escala) : corpo;
        const props = '<w:pPr>' + (cabecalho ? '<w:keepNext/>' : '') + '<w:spacing w:before="' + (cabecalho ? 240 : 0) + '" w:after="120"/></w:pPr>';
        return '<w:p>' + props + par.trechos.map(t => docxRuns(t.texto, t.b ? 'b' : '', tam, '', DOCX_MARCAS[t.m] || '')).join('') + '</w:p>';
      }).join('');
    }

    function docxGerarLeitura(modelo, titulo, escala) {
      return docxPacote(docxCorpoLeitura(modelo, escala), titulo);
    }

    // "nome do arquivo importado - com marcas.docx" (sem emojis nem caracteres que o sistema de arquivos não aceita); sem arquivo, a primeira linha do texto.
    function leituraNomeBase() {
      const arquivo = leituraInfoArquivo.replace(/^📄\s*/, '').split(' · ')[0].replace(/\.(pdf|docx)$/i, '');
      const primeira = leituraSemMarcas(leituraTextoDaVista || leituraTexto.value).split('\n').map(linha => linha.trim()).find(Boolean) || '';
      const limpo = removeUnicodeFormatting(arquivo || primeira).replace(DOCX_EMOJI, ' ').replace(/[\\/:*?"<>|“”‘’]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
      return limpo || 'Leitura';
    }

    function docxNomeDaLeitura() {
      return leituraNomeBase() + (leituraMarcas.length ? ' - com marcas' : '') + '.docx';
    }

    // "Esboço original - título.docx" (sem emojis nem caracteres que o sistema de arquivos não aceita).
    function docxNomeDoEsboco(esboco) {
      const limpo = removeUnicodeFormatting(String(esboco.titulo || '')).replace(DOCX_EMOJI, ' ').replace(/[\\/:*?"<>|“”‘’]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
      return 'Esboço original - ' + (limpo || 'discurso') + '.docx';
    }

    // Entrega o arquivo: compartilha (celulares) ou baixa. Devolve a mensagem para a pessoa, ou '' se ela desistiu de compartilhar.
    async function docxEntregar(blob, nome, compartilhar) {
      if (compartilhar) {
        const arquivoWord = new File([blob], nome, { type: blob.type });
        try {
          await navigator.share({ files: [arquivoWord], title: nome });
          return '✅ Arquivo enviado para o compartilhamento do aparelho.';
        } catch (e) {
          if (e && e.name === 'AbortError') return '';
          backupSaveBlob(blob, nome);
          return '✅ ' + nome + ' (baixado).';
        }
      }
      backupSaveBlob(blob, nome);
      return '✅ ' + nome + ' (o arquivo vai para a pasta de downloads do aparelho).';
    }

    // O nome do arquivo (sem emojis nem caracteres que o sistema de arquivos não aceita): "Esboço - título do discurso.docx" nos esboços; nos
    // outros textos, o título da pesquisa salva a que o campo está ligado ou, sem ela, a primeira linha do texto.
    function docxNomeDoArquivo(texto) {
      const esboco = Boolean(historicoLigado && historicoLigado.esboco);
      const primeiraLinha = String(texto || '').split('\n').map(linha => linha.trim()).find(Boolean) || '';
      const bruto = (historicoLigado && (historicoLigado.nome || historicoLigado.titulo)) || primeiraLinha;
      const limpo = removeUnicodeFormatting(bruto).replace(DOCX_EMOJI, ' ').replace(/[\\/:*?"<>|“”‘’]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (esboco) return 'Esboço - ' + (limpo || 'discurso') + '.docx';
      return (limpo || 'NoteStyle - ' + new Date().toISOString().slice(0, 10)) + '.docx';
    }

    // Os dois botões do card abrem a prévia (página em tela cheia, a mesma do esboço original), onde se escolhe o tamanho da letra e se finaliza
    // a exportação (baixar ou compartilhar).
    document.getElementById('exportarDocxBtn').addEventListener('click', event => docxPreviaAbrir(event.currentTarget));
    document.getElementById('exportarCompartilharBtn').addEventListener('click', event => docxPreviaAbrir(event.currentTarget));
    // Compartilhar só aparece onde o aparelho aceita compartilhar arquivos (celulares).
    try {
      const teste = new File(['x'], 'x.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      document.getElementById('exportarCompartilharBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [teste] }) && /android|iphone|ipad|ipod/i.test(navigator.userAgent));
    } catch (e) { /* sem compartilhamento de arquivos */ }

    // Ano e semana num número só, para comparar (2026, semana 43 → 202643).
    const historicoChave = item => item.ano * 100 + item.numSemana;
    const historicoChaveAtual = () => aiWeekYear * 100 + aiWeekNumber;

    function historicoGravar(lista) {
      let atual = lista.slice(0, HISTORICO_MAX);
      let liberou = false;
      while (atual.length) {
        const json = JSON.stringify(atual);
        if (json.length <= HISTORICO_MAX_CARACTERES) {
          try {
            localStorage.setItem(HISTORICO_KEY, json);
            return true;
          } catch (e) {
            // Memória cheia: primeiro sai o que o app lê de novo no site (leituras carregadas e lista do estudo); só depois a pesquisa mais antiga.
            if (!liberou) {
              liberou = true;
              try { localStorage.removeItem(CARREGADOS_KEY); localStorage.removeItem(AI_STUDY_CACHE_KEY); } catch (e2) { /* sem localStorage */ }
              continue;
            }
          }
        }
        atual = atual.slice(0, -1);
      }
      return false; // nem uma coube: o que já estava guardado continua como estava
    }

    // Semana mostrada na barra do alto da tela Reuniões (ex.: "19 a 25 de outubro").
    function historicoSemana() {
      const semana = document.querySelector('[data-week="range"]');
      return semana ? semana.textContent.trim() : '';
    }

    // A semana é a do pedido à IA (ano e semana enviados ao servidor) ou, sem ela, a escolhida agora.
    function historicoSalvar({ tipo, titulo, ano, numSemana, partes, esbocoJson, esbocoNumero, esbocoTitulo, refino }) {
      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        tipo,
        titulo,
        ano: ano || aiWeekYear,
        numSemana: numSemana || aiWeekNumber,
        data: new Date().toISOString(),
        partes: (partes || []).map(p => ({ paragrafos: p.paragrafos || '', texto: p.texto }))
      };
      // Esboços: o JSON (para continuar com Outra versão, Melhorar e Incluir texto(s) depois de abrir o esboço salvo) e o número do tema do S-34.
      if (esbocoJson) item.esbocoJson = esbocoJson;
      // Respostas do estudo: os itens crus da IA e o contexto do pedido (para Outra resposta e Melhorar depois de reabrir a pesquisa salva).
      if (refino) item.refino = refino;
      if (esbocoNumero) item.esbocoNumero = esbocoNumero;
      if (esbocoTitulo) item.esbocoTitulo = esbocoTitulo;
      historicoGravar([item, ...historicoLer()]);
      if (!historicoLer().some(guardado => guardado.id === item.id)) {
        // Não coube na memória do aparelho: avisa (antes o app não dizia nada e a resposta ficava só no campo de texto).
        showAlert('Não consegui salvar esta resposta em Pesquisas e respostas salvas: a memória do aparelho está cheia. Ela continua no campo de texto; copie o que precisar. Para abrir espaço, apague pesquisas antigas ou veja o que está guardado em Ajustes → Privacidade e dados deste aparelho.', '⚠️ Resposta não salva');
        historicoRender();
        return;
      }
      historicoAbertas[historicoCategoriaDe(item).id] = true; // a categoria do item novo abre, para ele aparecer
      historicoLigar(item.id, historicoTituloExibido(item)); // o texto que está no campo é o desta pesquisa: dá para salvar as alterações nela
      historicoRender();
    }

    // As pesquisas ficam em categorias, pela natureza delas (as cores são as dos grupos da tela Reuniões). Um tipo que não
    // está em nenhuma cai em Comentários. "Dirigentes" e "Esboços" (que ainda espera os esboços) pedem o código do dirigente.
    const HISTORICO_CATEGORIAS = [
      { id: 'comentarios', titulo: '✋ Comentários', cor: '#a855f7', tipos: ['colado', 'sentinela', 'ebc', 'joias'] },
      { id: 'dirigentes', titulo: '🎤 Dirigentes', cor: '#14b8a6', tipos: ['dirigente', 'ebc-dirigente'], soDirigente: true },
      { id: 'esbocos', titulo: '📜 Esboços', cor: '#f59e0b', tipos: ['esboco'], soDirigente: true }
    ];
    const historicoAbertas = { comentarios: false, dirigentes: false, esbocos: false }; // lembra quais estão abertas ao refazer a lista
    // Ao abrir a página Pesquisas e respostas salvas (pelo botão da barra, pelo atalho ou pelo botão da tela Reuniões), todas as categorias começam recolhidas.
    function historicoRecolher() {
      Object.keys(historicoAbertas).forEach(id => { historicoAbertas[id] = false; });
      document.querySelectorAll('#historicoLista > details').forEach(caixa => { caixa.open = false; });
    }
    const historicoCategoriaDe = item => HISTORICO_CATEGORIAS.find(c => c.tipos.includes(item.tipo)) || HISTORICO_CATEGORIAS[0];

    function historicoItemEl(item) {
      const li = document.createElement('li');
      li.className = 'historico-item';
      const titulo = document.createElement('div');
      titulo.className = 'historico-titulo';
      titulo.textContent = historicoTituloExibido(item);
      const meta = document.createElement('p');
      meta.className = 'historico-meta';
      const data = new Date(item.data);
      const quando = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const respostas = (item.partes || []).length;
      meta.textContent = 'Salva em ' + quando + (respostas > 1 ? ' · ' + respostas + (item.tipo === 'esboco' ? ' partes' : ' respostas') : '') + (item.textoEditado ? ' · ✏️ com alterações suas' : '');
      const acoes = document.createElement('div');
      acoes.className = 'historico-acoes';
      const abrir = document.createElement('button');
      abrir.type = 'button';
      abrir.textContent = '📂 Abrir';
      abrir.dataset.historicoAbrir = item.id;
      const apagar = document.createElement('button');
      apagar.type = 'button';
      apagar.className = 'secondary historico-apagar';
      apagar.textContent = '🗑️';
      apagar.setAttribute('aria-label', 'Apagar esta pesquisa salva');
      apagar.dataset.historicoApagar = item.id;
      if (item.textoEditado) {
        const original = document.createElement('button');
        original.type = 'button';
        original.className = 'secondary historico-original';
        original.textContent = '↩️ Original';
        original.title = 'Voltar ao texto original da IA (apaga as alterações salvas)';
        original.dataset.historicoOriginal = item.id;
        acoes.append(abrir, original, apagar);
      } else {
        acoes.append(abrir, apagar);
      }
      li.append(titulo, meta, acoes);
      return li;
    }

    function historicoRender() {
      // As perguntas do dirigente só aparecem aqui com o código do dirigente salvo neste aparelho.
      const comDirigente = Boolean(codigoDirigenteSalvo());
      const todas = historicoLer().filter(item => comDirigente || !historicoCategoriaDe(item).soDirigente);
      const atual = historicoChaveAtual();
      const lista = todas.filter(item => historicoChave(item) === atual);
      const anteriores = todas.filter(item => historicoChave(item) < atual).length;
      const holder = document.getElementById('historicoLista');
      holder.textContent = '';
      HISTORICO_CATEGORIAS.forEach(cat => {
        // Sem o código do dirigente, a categoria Dirigentes aparece desabilitada (cinza, com cadeado) e não abre.
        const bloqueada = Boolean(cat.soDirigente) && !comDirigente;
        const itens = bloqueada ? [] : lista.filter(item => historicoCategoriaDe(item) === cat);
        const box = document.createElement('details');
        box.className = 'historico-cat' + (bloqueada ? ' historico-cat-desabilitada' : '');
        box.dataset.cat = cat.id; // a cor dos botões vem daí (CSS)
        if (!bloqueada) box.style.setProperty('--cat-cor', cat.cor);
        box.open = !bloqueada && Boolean(historicoAbertas[cat.id]);
        const titulo = document.createElement('summary');
        if (bloqueada) {
          const bloco = document.createElement('div');
          bloco.textContent = cat.titulo;
          const trava = document.createElement('span');
          trava.className = 'grupo-trava';
          trava.textContent = '🔒 Requer o código do dirigente (Ajustes)';
          bloco.appendChild(trava);
          titulo.appendChild(bloco);
          titulo.setAttribute('aria-disabled', 'true');
          titulo.addEventListener('click', event => event.preventDefault());
          box.appendChild(titulo);
          holder.appendChild(box);
          return;
        }
        box.addEventListener('toggle', () => { historicoAbertas[cat.id] = box.open; });
        titulo.textContent = cat.titulo + (itens.length ? ' (' + itens.length + ')' : '');
        box.appendChild(titulo);
        if (itens.length) {
          const ul = document.createElement('ul');
          ul.className = 'historico-lista';
          itens.forEach(item => ul.appendChild(historicoItemEl(item)));
          box.appendChild(ul);
        } else {
          const vazio = document.createElement('p');
          vazio.className = 'historico-vazio';
          vazio.textContent = 'Nenhuma pesquisa salva desta semana.';
          box.appendChild(vazio);
        }
        holder.appendChild(box);
      });
      esbocosSalvosAtualizar(); // salvar, apagar ou trocar de semana muda o botão de carregar o esboço salvo
      if (historicoLigado && !historicoLer().some(i => i.id === historicoLigado.id)) historicoLigado = null; // a pesquisa salva foi apagada
      atualizarBotoesSalvar();
      studySalvasAtualizar(); // as respostas salvas do parágrafo escolhido (Estudo de A Sentinela)
      recuperarSalvasAtualizar(); // as respostas salvas da semana (Estudo Bíblico e Joias)
      const limpar = document.getElementById('historicoLimparBtn');
      limpar.hidden = !anteriores;
      limpar.textContent = '🗑️ Apagar as pesquisas das semanas anteriores (' + anteriores + ')';
    }

    // Dados para refazer a resposta de uma pesquisa salva: os itens crus da IA e o contexto do pedido, guardados desde a 6.1.38.
    // Com soPartes (só alguns parágrafos), vão só os itens desses parágrafos e o pedido passa a ser só por eles. As pesquisas salvas antes
    // (ou sem como casar as partes) usam o texto salvo no lugar dos itens crus (ver historicoRefinoAntigo); sem como montar, null (a
    // pesquisa reabre só como texto, sem Outra resposta nem Melhorar).
    const REFINO_TIPOS = ['estudo', 'dirigente', 'ebc', 'ebcdir', 'joias', 'sentinela'];

    // Os parágrafos que um conjunto de rótulos cobre, no formato do pedido ("3, 4" ou "Recapitulação"); '' se algum não for número.
    function paragrafosDosRotulos(rotulos) {
      const lista = rotulos.map(rotulo => String(rotulo || ''));
      if (lista.length && lista.every(rotulo => isRecapText(rotulo))) return STUDY_RECAP_LABEL;
      if (!lista.length || !lista.every(rotulo => !isRecapText(rotulo) && studyNumbers(rotulo).length)) return '';
      return [...new Set(lista.flatMap(rotulo => studyNumbers(rotulo)))].sort((a, b) => a - b).join(', ');
    }

    // Pesquisas salvas antes da 6.1.38 não guardaram os dados crus da IA. O app monta os itens com o texto salvo (em letras comuns: as letras
    // em negrito e itálico voltam ao alfabeto) e o pedido com o que dá para saber (os parágrafos, pelos rótulos ou pelo título; o resto, pelas
    // caixas da tela agora). A IA lê o texto já formatado como "respostas anteriores", então o resultado é aproximado. O texto colado não
    // volta: o texto original dele não foi guardado.
    function historicoRefinoAntigo(item, partes) {
      const kind = { sentinela: 'estudo', dirigente: 'dirigente', ebc: 'ebc', 'ebc-dirigente': 'ebcdir', joias: 'joias' }[item.tipo];
      if (!kind || !partes.length) return null;
      const comuns = texto => String(texto || '').normalize('NFKC');
      const base = { kind, aproximado: true };
      if (kind === 'estudo') {
        const paragrafos = paragrafosDosRotulos(partes.map(p => p.paragrafos));
        return paragrafos ? { ...base, paragrafos, artigo: studyArticleId(), itens: partes.map(p => ({ paragrafos: p.paragrafos, resposta: comuns(p.texto) })) } : null;
      }
      if (kind === 'dirigente') {
        const paragrafos = studyRotuloDoTitulo(item.titulo);
        return paragrafos && !isRecapText(paragrafos) ? { ...base, paragrafos, artigo: studyArticleId(), itens: partes.map(p => ({ paragrafos, perguntas: comuns(p.texto) })) } : null;
      }
      if (kind === 'ebc') return { ...base, quadros: ebcEscolhas().quadros, itens: partes.map(p => ({ paragrafos: p.paragrafos, resposta: comuns(p.texto) })) };
      if (kind === 'ebcdir') return { ...base, perguntas: ebcDirPerguntas.checked, textosBase: ebcDirTextosBase.checked, itens: partes.map(p => ({ texto: comuns(p.texto) })) };
      return { ...base, pergunta: joiasPergunta.checked, leitura: joiasLeitura.checked, itens: partes.map(p => ({ paragrafos: p.paragrafos, resposta: comuns(p.texto) })) };
    }

    function historicoRefinoDe(item, soPartes) {
      const r = item.refino;
      // No Estudo Bíblico do dirigente só com os textos para ler (sem perguntas), os itens ficam vazios e os textos-base vão em r.base.
      const soTextosBase = r && r.kind === 'ebcdir' && Array.isArray(r.base) && r.base.length;
      if (r && REFINO_TIPOS.includes(r.kind) && Array.isArray(r.itens) && (r.itens.length || soTextosBase)) {
        if (!soPartes) return r;
        const todas = item.partes || [];
        const indices = r.kind === 'estudo' && todas.length === r.itens.length ? soPartes.map(p => todas.findIndex(q => q.texto === p.texto && q.paragrafos === p.paragrafos)) : [];
        if (indices.length && indices.every(i => i >= 0)) {
          const itens = indices.map(i => r.itens[i]);
          const paragrafos = paragrafosDosRotulos(itens.map(i => i && i.paragrafos));
          if (paragrafos) return { ...r, itens, paragrafos };
        }
      }
      return historicoRefinoAntigo(item, soPartes || item.partes || []);
    }

    // soPartes (opcional): abre só essas partes da pesquisa (recuperar a resposta de um parágrafo); aí o campo não fica ligado à pesquisa,
    // para o botão Salvar não trocar a pesquisa inteira por um pedaço dela. Devolve true se abriu.
    async function historicoAbrir(id, soPartes) {
      const item = historicoLer().find(i => i.id === id);
      if (!item) { historicoRender(); return false; }
      if (aiBusy) return false;
      if (input.value.trim() && !(await askConfirm('O texto do campo de texto será trocado por esta pesquisa salva (dá para desfazer). Continuar?', 'Abrir pesquisa salva'))) return false;
      const partes = soPartes || item.partes || [];
      const refino = historicoRefinoDe(item, soPartes);
      aiSentinelaRaw = refino ? refino.itens : [];
      aiRaw = [];
      aiSuggestions = [];
      aiResults.textContent = '';
      aiResumo = { texto: partes.map(p => p.texto).join('\n\n\n'), partes, done: false, kind: 'estudo', restaurada: !refino, semBotoes: item.tipo === 'esboco' };
      setInputRange(0, input.value.length, soPartes ? aiResumo.texto : item.textoEditado || aiResumo.texto); // a versão com as alterações salvas, se houver
      autoGrowInputText();
      if (refino) {
        // Como numa resposta recém-gerada: Outra resposta, Melhorar e Desfazer voltam ao texto de antes (o texto colado, ou o campo vazio).
        const { itens, ...contexto } = refino;
        aiLastKind = refino.kind;
        aiRefino = contexto;
        aiBaseText = refino.kind === 'sentinela' ? (refino.linhas || []).join('\n') : '';
        aiAppliedAny = true;
        aiAppliedSnapshot = input.value;
      } else {
        aiRefino = null;
      }
      if (soPartes) {
        historicoLigado = null;
        atualizarBotoesSalvar();
      } else {
        historicoLigar(item.id, historicoTituloExibido(item));
      }
      renderAiSuggestions();
      requestAnimationFrame(() => input.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      return true;
    }

    // ---------- Recuperar a resposta salva (Estudo Bíblico e Joias) ----------
    // Como no Estudo de A Sentinela: o cartão avisa que a semana já tem resposta salva (e quando) e um botão a abre no campo de texto, com
    // Outra resposta e Melhorar. Vale a mais recente da semana escolhida; as outras ficam em Pesquisas e respostas salvas. As perguntas do
    // dirigente só aparecem com o código do dirigente salvo (como na lista de pesquisas).
    function recuperarSalvasAtualizar() {
      const cartoes = [
        { tipo: 'ebc', caixa: 'ebcSalva', quem: 'O Estudo Bíblico desta semana já tem resposta salva' },
        { tipo: 'ebc-dirigente', caixa: 'ebcDirSalva', quem: 'O Estudo Bíblico desta semana já tem resposta salva' },
        { tipo: 'joias', caixa: 'joiasSalva', quem: 'As joias desta semana já têm resposta salva' }
      ];
      const atual = historicoChaveAtual();
      cartoes.forEach(cartao => {
        const caixa = document.getElementById(cartao.caixa);
        const itens = cartao.tipo === 'ebc-dirigente' && !codigoDirigenteSalvo() ? [] : historicoLer().filter(item => item.tipo === cartao.tipo && historicoChave(item) === atual);
        caixa.hidden = !itens.length;
        if (!itens.length) { delete caixa.dataset.item; return; }
        caixa.dataset.item = itens[0].id; // a lista guardada vem da mais nova para a mais antiga
        caixa.querySelector('p').textContent = '💾 ' + cartao.quem + ' (salva em ' + historicoQuando(itens[0]) + ')'
          + (itens.length > 1 ? '. É a mais recente de ' + itens.length + '; as outras estão em Pesquisas e respostas salvas.' : '.');
      });
    }

    [['ebcSalva', 'ebc', 'Resposta salva colocada no campo de texto.'], ['ebcDirSalva', 'ebcdir', 'Resposta salva colocada no campo de texto.'], ['joiasSalva', 'joias', 'Resposta salva colocada no campo de texto.']].forEach(([caixa, status, mensagem]) => {
      document.getElementById(caixa).querySelector('button').addEventListener('click', async () => {
        const id = document.getElementById(caixa).dataset.item;
        if (!id) return recuperarSalvasAtualizar();
        if (!(await historicoAbrir(id))) return;
        aiStatusKind = status;
        setAiStatus('✅ ' + mensagem, false);
      });
    });

    document.getElementById('historicoLista').addEventListener('click', async event => {
      const abrir = event.target.closest('[data-historico-abrir]');
      if (abrir) return historicoAbrir(abrir.dataset.historicoAbrir);
      const original = event.target.closest('[data-historico-original]');
      if (original) {
        if (!(await askConfirm('Voltar esta pesquisa salva ao texto original da IA? As alterações salvas serão apagadas da pesquisa (o texto que está no campo de texto agora não muda).', 'Voltar ao original'))) return;
        const lista = historicoLer();
        const item = lista.find(i => i.id === original.dataset.historicoOriginal);
        if (item) {
          delete item.textoEditado;
          delete item.editadoEm;
          historicoGravar(lista);
        }
        if (historicoLigado && item && historicoLigado.id === item.id) historicoLigado.base = null; // o campo tem alterações que a pesquisa já não guarda
        historicoRender();
        return;
      }
      const apagar = event.target.closest('[data-historico-apagar]');
      if (!apagar) return;
      if (!(await askConfirm('Apagar esta pesquisa salva deste aparelho?', 'Apagar pesquisa'))) return;
      historicoGravar(historicoLer().filter(i => i.id !== apagar.dataset.historicoApagar));
      historicoRender();
    });
    // Apaga as pesquisas das semanas antes da escolhida; as dela e as das semanas seguintes continuam salvas.
    document.getElementById('historicoLimparBtn').addEventListener('click', async () => {
      const atual = historicoChaveAtual();
      const anteriores = historicoLer().filter(item => historicoChave(item) < atual).length;
      if (!anteriores) return historicoRender();
      const quantas = anteriores === 1 ? 'a pesquisa salva' : 'as ' + anteriores + ' pesquisas salvas';
      if (!(await askConfirm('Apagar ' + quantas + ' das semanas anteriores a ' + historicoSemana() + '? As desta semana e das seguintes continuam salvas. Não dá para desfazer.', 'Apagar semanas anteriores'))) return;
      historicoGravar(historicoLer().filter(item => historicoChave(item) >= atual));
      historicoRender();
    });

    aiAnotherBtn.addEventListener('click', () => refineAi('nova'));
    aiImproveBtn.addEventListener('click', () => refineAi('melhorar'));

    aiOptionInputs.forEach(el => el.addEventListener('change', saveAiOptions));
    aiIntensity.addEventListener('change', saveAiOptions);
    aiCategory.addEventListener('change', saveAiOptions);
    aiSummarySize.addEventListener('change', saveAiOptions);
    aiSection.addEventListener('toggle', () => { if (aiSection.open) renderAiCategoryOptions(); });
    aiInstruction.addEventListener('change', saveAiOptions);
    loadAiOptions();

    // ---------- Atalho para o estudo de A Sentinela da semana ----------
    // O link aponta para a página de reuniões do wol.jw.org daquela semana (ano ISO + número da semana),
    // que lista o artigo de estudo. Nada é lido do site: o app só monta o endereço pela data.
    // A semana aparece nos dois cards da Sentinela (Comentários e Dirigente) e é uma só: mudar num muda o outro.
    const weekParts = name => document.querySelectorAll('[data-week="' + name + '"]');
    let aiWeekOffset = 0;
    let aiWeekYear = 0;
    let aiWeekNumber = 0;

    function isoYearWeek(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return [d.getUTCFullYear(), Math.ceil(((d - yearStart) / 86400000 + 1) / 7)];
    }

    // "19 a 25 de outubro" ou "26 de outubro a 1 de novembro", a partir da segunda-feira da semana.
    function rotuloDaSemana(monday) {
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const month = date => date.toLocaleDateString('pt-BR', { month: 'long' });
      return monday.getMonth() === sunday.getMonth()
        ? monday.getDate() + ' a ' + sunday.getDate() + ' de ' + month(sunday)
        : monday.getDate() + ' de ' + month(monday) + ' a ' + sunday.getDate() + ' de ' + month(sunday);
    }

    function renderAiWeek() {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + aiWeekOffset * 7);

      const [year, week] = isoYearWeek(monday);
      aiWeekYear = year;
      aiWeekNumber = week;
      weekParts('link').forEach(link => { link.href = 'https://wol.jw.org/pt/wol/meetings/r5/lp-t/' + year + '/' + week; });

      const range = rotuloDaSemana(monday);
      weekParts('range').forEach(el => { el.textContent = range; });

      // Textos curtos para caber numa linha entre as setas (a data vem logo abaixo).
      const names = { '-1': 'Semana passada', '0': 'Semana atual', '1': 'Próxima semana' };
      weekParts('title').forEach(el => { el.textContent = '📅 ' + (names[aiWeekOffset] || 'Semana do estudo'); });
      weekParts('today').forEach(btn => { btn.hidden = aiWeekOffset === 0; });
    }

    const changeWeek = offset => { aiWeekOffset = offset; renderAiWeek(); refreshStudyPicker(); ebcSemanaMudou(); esbocosSemanaMudou(); joiasSemanaMudou(); apostilaImgSemanaMudou(); historicoRender(); };
    weekParts('today').forEach(btn => btn.addEventListener('click', () => changeWeek(0)));
    weekParts('prev').forEach(btn => btn.addEventListener('click', () => changeWeek(aiWeekOffset - 1)));
    weekParts('next').forEach(btn => btn.addEventListener('click', () => changeWeek(aiWeekOffset + 1)));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { carregadosLimpar(); renderAiWeek(); historicoRender(); }
    });
    carregadosLimpar(); // apaga o carregado de semanas fora da atual, anterior e seguinte (a partir do dia seguinte ao carregamento)
    renderAiWeek();
    refreshStudyPicker();
    // O que já foi carregado nesta semana (Estudo Bíblico, joias, imagens e discursos da apostila) aparece sem recarregar.
    ebcSemanaMudou();
    esbocosSemanaMudou();
    joiasSemanaMudou();
    apostilaImgSemanaMudou();
    historicoNormalizarNomes();
    historicoRender();
    publicoNumerarSalvosEmSilencio();

    // ---------- Aviso de versão nova ----------
    // Um app instalado pode ficar com a página antiga na memória. Aqui o app compara a versão que
    // está rodando (APP_VERSION) com a do app.js publicado no servidor e, se mudou, oferece atualizar
    // (o texto digitado é preservado). Por isso, toda mudança publicada deve aumentar APP_VERSION.
    const UPDATE_SIGNATURE = APP_VERSION;
    const UPDATE_TEXT_KEY = 'jwLibraryNoteAplicarTextoAntesDeAtualizar';
    const UPDATE_CHECK_MS = 10 * 60 * 1000;
    let updateBanner = null;
    let updateDismissed = false;

    async function fetchLatestSignature() {
      const response = await fetch(new URL('app.js', location.href).href, { cache: 'no-store' });
      if (!response.ok) return null;

      const achado = /const APP_VERSION = '([^']+)'/.exec(await response.text());
      return achado ? achado[1] : null;
    }

    function applyUpdate() {
      try {
        if (input.value) sessionStorage.setItem(UPDATE_TEXT_KEY, input.value);
      } catch (e) { /* sem sessionStorage: o texto não é preservado */ }
      location.reload();
    }

    function showUpdateBanner() {
      if (updateBanner) return;

      updateBanner = document.createElement('div');
      updateBanner.className = 'update-banner';
      updateBanner.setAttribute('role', 'status');
      updateBanner.setAttribute('aria-live', 'polite');

      const message = document.createElement('p');
      message.textContent = '✨ Há uma versão nova do NoteStyle. Atualize para usar as novidades. Seu texto será mantido.';

      const actions = document.createElement('div');
      actions.className = 'update-banner-actions';

      const updateBtn = document.createElement('button');
      updateBtn.type = 'button';
      updateBtn.textContent = 'Atualizar agora';
      updateBtn.addEventListener('click', applyUpdate);

      const laterBtn = document.createElement('button');
      laterBtn.type = 'button';
      laterBtn.className = 'secondary';
      laterBtn.textContent = 'Depois';
      laterBtn.addEventListener('click', () => {
        updateDismissed = true;
        updateBanner.remove();
        updateBanner = null;
      });

      actions.append(updateBtn, laterBtn);
      updateBanner.append(message, actions);
      document.body.appendChild(updateBanner);
    }

    async function checkForNewVersion() {
      if (updateBanner || updateDismissed || !navigator.onLine) return;
      try {
        const latest = await fetchLatestSignature();
        if (latest && latest !== UPDATE_SIGNATURE) showUpdateBanner();
      } catch (e) { /* sem rede ou servidor indisponível: tenta de novo depois */ }
    }

    window.addEventListener('load', () => setTimeout(checkForNewVersion, 4000));
    window.addEventListener('online', checkForNewVersion);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      updateDismissed = false;
      checkForNewVersion();
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') checkForNewVersion();
    }, UPDATE_CHECK_MS);

    enableManifestWhenOnline();
    registerServiceWorker();

    populate();
    styleSelect.value = 'serif';
    updateUi();
    autoCheckOnlineDefaultsOnStart();
    loadPublicLimits();

    // ---------- Puxar a tela para baixo para atualizar ----------
    // No navegador comum o gesto já existe. No app instalado na tela inicial (iPhone e Android) ele não existe, então o
    // app faz o seu: no topo da página, puxar para baixo e soltar recarrega o app mantendo o texto digitado (como em
    // "Atualizar agora"). Não vale começando dentro de um campo de texto nem enquanto a IA está trabalhando.
    (function setupPullToRefresh() {
      const installed = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
      if (!installed || !('ontouchstart' in window)) return;

      const box = document.getElementById('pullRefresh');
      const label = document.getElementById('pullRefreshText');
      const THRESHOLD = 90;
      let startY = null;
      let distance = 0;

      const reset = () => {
        startY = null;
        distance = 0;
        box.classList.remove('ready');
        box.style.transition = 'opacity .2s ease, transform .2s ease';
        box.style.opacity = '0';
        box.style.transform = 'translate(-50%, -60px)';
      };

      window.addEventListener('touchstart', event => {
        if (event.touches.length !== 1 || window.scrollY > 0 || aiBusy) return;
        if (currentScreen() !== 'inicio') return; // o gesto de puxar para atualizar só vale na tela Início (nas outras, um puxão sem querer perdia texto e rolagem)
        if (event.target.closest('textarea, input, select, [contenteditable="true"]')) return;
        // Dentro de uma página ou janela por cima do app (o esboço original, a prévia do Word, as confirmações) o gesto de rolar não atualiza o
        // app: a tela de trás pode estar no topo e o gesto de voltar a rolar para cima recarregaria o app, fechando a página sozinha.
        if (event.target.closest('[role="dialog"]')) return;
        startY = event.touches[0].clientY;
        distance = 0;
      }, { passive: true });

      window.addEventListener('touchmove', event => {
        if (startY === null) return;
        if (window.scrollY > 0) return reset();
        distance = Math.max(0, event.touches[0].clientY - startY);
        if (distance < 12) return;
        const ready = distance >= THRESHOLD;
        box.classList.toggle('ready', ready);
        label.textContent = ready ? 'Solte para atualizar' : 'Puxe para atualizar';
        box.style.transition = 'none';
        box.style.opacity = String(Math.min(1, distance / THRESHOLD));
        box.style.transform = 'translate(-50%, ' + Math.min(0, distance * 0.6 - 60) + 'px)';
      }, { passive: true });

      window.addEventListener('touchend', () => {
        if (startY === null) return;
        if (distance >= THRESHOLD && !aiBusy) {
          label.textContent = 'Atualizando…';
          box.style.opacity = '1';
          box.style.transform = 'translate(-50%, 0)';
          applyUpdate(); // guarda o texto digitado e recarrega
          return;
        }
        reset();
      }, { passive: true });

      window.addEventListener('touchcancel', reset, { passive: true });
    })();

    // Depois de "Atualizar agora", devolve ao campo o texto que estava digitado.
    try {
      const textBeforeUpdate = sessionStorage.getItem(UPDATE_TEXT_KEY);
      if (textBeforeUpdate) {
        sessionStorage.removeItem(UPDATE_TEXT_KEY);
        input.value = textBeforeUpdate;
        autoGrowInputText();
        updateUi();
        selectionInfo.textContent = 'App atualizado. Seu texto foi mantido.';
      }
    } catch (e) { /* sem sessionStorage */ }

    // ---------- Início: texto diário e atalhos ----------
    // O texto do dia (pelo calendário deste aparelho) vem do wol.jw.org pelo servidor (api/texto-diario.mjs), com o código
    // de acesso. Como no JW Library, aparecem a data e o texto temático; um toque abre o comentário, com os botões de
    // ouvir tudo e de levar o texto para o campo de texto. Os textos já vistos ficam só na memória desta sessão.
    const TD_ENDPOINT = '/api/texto-diario';
    const td = {
      abrir: document.getElementById('tdAbrir'),
      data: document.getElementById('tdData'),
      tema: document.getElementById('tdTema'),
      detalhe: document.getElementById('tdDetalhe'),
      comentario: document.getElementById('tdComentario'),
      fonte: document.getElementById('tdFonte'),
      link: document.getElementById('tdLink'),
      linkSempre: document.getElementById('tdLinkTrava'),
      status: document.getElementById('tdStatus'),
      hojeBtn: document.getElementById('tdHojeBtn'),
      ouvirTopoBtn: document.getElementById('tdOuvirTopoBtn'),
      vozTopo: document.getElementById('tdVozTopo'),
      ouvirIaBtn: document.getElementById('tdIaOuvirBtn'),
      vozIa: document.getElementById('tdIaVoz'),
      campoBtn: document.getElementById('tdCampoBtn'),
      gerarBtn: document.getElementById('tdGerarBtn'),
      ia: document.getElementById('tdIa'),
      iaLista: document.getElementById('tdIaLista'),
      iaStatus: document.getElementById('tdIaStatus'),
      iaCopiarBtn: document.getElementById('tdIaCopiarBtn'),
      iaOutrosBtn: document.getElementById('tdIaOutrosBtn'),
      iaLimparBtn: document.getElementById('tdIaLimparBtn'),
      iaSalvarBtn: document.getElementById('tdIaSalvarBtn'),
      recuperarBtn: document.getElementById('tdRecuperarBtn'),
      iaQtd: document.getElementById('tdIaQtd')
    };
    const tdCache = new Map(); // "2026-10-20" -> texto do servidor
    const tdIaCache = new Map(); // "2026-10-20" -> comentários adicionais da IA [{ ponto, comentario }]
    let tdData = null; // dia mostrado (meia-noite, hora local)
    let tdTexto = null; // texto mostrado, quando carregou
    let tdVozCupom = ''; // cupom HMAC do texto do dia (para /api/voz)
    const tdIaVozCupons = new Map(); // data -> cupom dos comentários da IA
    let tdPedido = 0;

    const tdChave = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const tdHoje = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    const tdMais = (d, dias) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
    let tdUltimoHoje = tdChave(tdHoje());
    // Data, texto temático, comentário e citação, um por linha: é o que vai para a voz e para o campo de texto.
    const tdTextoCompleto = t => [t.titulo, t.tema, ...t.comentario, t.fonte].filter(Boolean).join('\n');
    // Para a voz, sem a linha da citação da matéria ("w25.03 18 § 15; 19 §§ 17-18"): referência não se lê, nem em parte.
    const tdTextoParaOuvir = t => [t.titulo, t.tema, ...t.comentario].filter(Boolean).join('\n');
    const tdComentariosEmTexto = lista => lista.map(c => (c.emoji || '💡') + ' ' + (c.ponto ? c.ponto + '\n' : '') + c.comentario).join('\n\n');

    // Comentários salvos (💾 Salvar): ficam neste aparelho, por dia do texto, e só valem para aquele dia. Quando o dia
    // passa, são apagados (a limpeza roda ao abrir o app, ao salvar, ao recuperar e ao voltar ao app noutro dia).
    // Formato: { "2026-10-20": { salvoEm: "2026-10-20T17:05:00.000Z", comentarios: [{ ponto, comentario }] } }
    const TD_SALVOS_KEY = 'jwLibraryNoteAplicarTextoDiarioComentariosV1';

    function tdSalvosGravar(salvos) {
      try {
        if (Object.keys(salvos).length) localStorage.setItem(TD_SALVOS_KEY, JSON.stringify(salvos));
        else localStorage.removeItem(TD_SALVOS_KEY);
      } catch (e) { /* sem localStorage ou memória cheia */ }
    }

    function tdSalvosLer() {
      let salvos = {};
      try { salvos = JSON.parse(localStorage.getItem(TD_SALVOS_KEY) || '{}'); } catch (e) { salvos = {}; }
      if (!salvos || typeof salvos !== 'object' || Array.isArray(salvos)) salvos = {};
      const hoje = tdChave(tdHoje());
      let limpou = false;
      for (const dia of Object.keys(salvos)) {
        const lista = salvos[dia] && Array.isArray(salvos[dia].comentarios)
          ? salvos[dia].comentarios.filter(c => c && typeof c.comentario === 'string' && c.comentario.trim()).map(c => ({ ponto: typeof c.ponto === 'string' ? c.ponto : '', comentario: c.comentario, emoji: typeof c.emoji === 'string' ? c.emoji : '', base: typeof c.base === 'string' ? c.base : '' }))
          : [];
        if (dia < hoje || !lista.length) { delete salvos[dia]; limpou = true; }
        else salvos[dia] = { salvoEm: salvos[dia].salvoEm, comentarios: lista, vozCupom: typeof salvos[dia].vozCupom === 'string' ? salvos[dia].vozCupom : '' };
      }
      if (limpou) tdSalvosGravar(salvos);
      return salvos;
    }

    // "20/10, às 17:05" (quando o salvamento foi feito).
    function tdQuandoSalvo(salvoEm) {
      const d = new Date(salvoEm);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Comentários adicionais da IA do dia mostrado (guardados nesta sessão; voltar ao dia não gasta outro pedido).
    function tdIaMostrar() {
      if (vozBar.parentNode === td.vozIa && !vozBar.hidden) vozParar(); // a lista vai ser remontada: a leitura dela para
      const lista = (tdTexto && tdIaCache.get(tdTexto.data)) || [];
      const salvo = tdTexto ? tdSalvosLer()[tdTexto.data] : null;
      td.recuperarBtn.hidden = !salvo || lista.length > 0;
      if (salvo) td.recuperarBtn.textContent = '📂 Recuperar comentários salvos (' + salvo.comentarios.length + ')';
      td.iaLista.textContent = '';
      lista.forEach(c => {
        const item = document.createElement('li');
        if (c.ponto) {
          // O emoji do assunto vem antes do ponto, fora dele (o ponto é lido em voz alta; o emoji não).
          const cabeca = document.createElement('span');
          cabeca.className = 'td-ia-cabeca';
          if (c.emoji) {
            const emoji = document.createElement('span');
            emoji.className = 'td-ia-emoji';
            emoji.setAttribute('aria-hidden', 'true');
            emoji.textContent = c.emoji;
            cabeca.appendChild(emoji);
          }
          const ponto = document.createElement('span');
          ponto.className = 'td-ia-ponto';
          ponto.textContent = c.ponto;
          cabeca.appendChild(ponto);
          item.appendChild(cabeca);
        }
        const texto = document.createElement('span');
        texto.className = 'td-ia-texto';
        // A parte que cita o ponto do texto de hoje (a "base", o começo do comentário) fica em negrito e itálico; a aplicação, em texto normal.
        const base = c.base && c.comentario.startsWith(c.base) && c.comentario.length > c.base.length ? c.base : '';
        if (base) {
          const destaque = document.createElement('span');
          destaque.className = 'td-ia-base';
          destaque.textContent = base;
          texto.append(destaque, document.createTextNode(c.comentario.slice(base.length)));
          texto.dataset.baseLen = String(base.length);
        } else {
          texto.textContent = c.comentario;
        }
        item.appendChild(texto);
        td.iaLista.appendChild(item);
      });
      td.iaQtd.textContent = lista.length ? '(' + lista.length + ')' : '';
      td.ia.hidden = !lista.length;
      td.gerarBtn.hidden = false; // o botão fica sempre visível: gerar de novo também vale quando já há comentários
      td.iaStatus.textContent = '';
    }

    async function tdGerarComentarios(outros) {
      if (!tdTexto || aiBusy) return;
      if (!navigator.onLine) return (td.iaStatus.textContent = 'Sem conexão com a internet.');
      const data = tdTexto.data;
      const anteriores = outros ? (tdIaCache.get(data) || []).map(c => c.comentario) : [];
      aiBusy = true;
      setAiLoading(true, outros ? td.iaOutrosBtn : td.gerarBtn);
      td.iaStatus.textContent = '';
      try {
        const result = await postStudy({ tarefa: 'texto-diario-comentarios', codigo: codigoAcessoSalvo(), data, anteriores }, IA_ESPERA_MS);
        const lista = result.ok && Array.isArray(result.data.comentarios) ? result.data.comentarios : [];
        if (!lista.length) {
          td.iaStatus.textContent = result.ok ? result.data.erro || 'A IA não sugeriu comentários. Tente de novo.' : studyFailureMessage(result, 'Não foi possível gerar os comentários agora.');
          return;
        }
        tdIaCache.set(data, lista);
        if (typeof result.data.vozCupom === 'string' && result.data.vozCupom) tdIaVozCupons.set(data, result.data.vozCupom);
        else tdIaVozCupons.delete(data);
        td.ia.open = true;
        if (tdTexto && tdTexto.data === data) tdIaMostrar();
      } catch (e) {
        td.iaStatus.textContent = e && e.name === 'AbortError' ? 'A IA demorou demais. Tente de novo.' : 'Falha de conexão ao consultar a IA.';
      } finally {
        aiBusy = false;
        setAiLoading(false);
      }
    }

    function tdMostrar(texto) {
      tdTexto = texto;
      tdVozCupom = typeof texto.vozCupom === 'string' ? texto.vozCupom : '';
      td.data.textContent = texto.titulo;
      td.tema.textContent = texto.tema;
      td.comentario.textContent = '';
      texto.comentario.forEach(paragrafo => {
        const p = document.createElement('p');
        p.textContent = paragrafo;
        td.comentario.appendChild(p);
      });
      td.fonte.textContent = texto.fonte || '';
      td.link.href = td.linkSempre.href = texto.url;
      td.ouvirTopoBtn.disabled = td.campoBtn.disabled = td.gerarBtn.disabled = false;
      tdIaMostrar();
      inicioAjustarAltura();
    }

    async function tdCarregar(data) {
      tdData = data;
      const chave = tdChave(data);
      const pedido = ++tdPedido;
      td.hojeBtn.hidden = chave === tdChave(tdHoje());
      td.status.textContent = '';
      if (tdCache.has(chave)) return tdMostrar(tdCache.get(chave));

      tdTexto = null;
      tdVozCupom = '';
      const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      td.data.textContent = dia.charAt(0).toUpperCase() + dia.slice(1);
      td.tema.textContent = 'Carregando o texto do dia…';
      td.comentario.textContent = '';
      td.fonte.textContent = '';
      td.link.href = td.linkSempre.href = 'https://wol.jw.org/pt/wol/h/r5/lp-t/' + data.getFullYear() + '/' + (data.getMonth() + 1) + '/' + data.getDate();
      td.ouvirTopoBtn.disabled = td.campoBtn.disabled = td.gerarBtn.disabled = true;
      tdIaMostrar();
      const codigo = codigoAcessoSalvo();
      if (!codigo) {
        td.tema.textContent = '🔒 Requer o código de pesquisa.';
        return;
      }
      try {
        const resposta = await fetch(TD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo, data: chave })
        });
        let dados = null;
        try { dados = await resposta.json(); } catch (e) { /* resposta sem JSON */ }
        if (pedido !== tdPedido) return;
        if (!resposta.ok || !dados || !dados.tema) {
          throw new Error((dados && dados.erro) || (resposta.status === 404 || resposta.status === 501
            ? 'O texto diário só aparece no site publicado.'
            : 'Não consegui carregar o texto diário agora.'));
        }
        tdCache.set(chave, dados);
        tdMostrar(dados);
      } catch (e) {
        if (pedido !== tdPedido) return;
        td.tema.textContent = (navigator.onLine ? (e && e.message) || 'Não consegui carregar o texto diário agora.' : 'Sem conexão com a internet.') + ' Toque aqui e use 🌐 Abrir no wol.jw.org.';
      }
    }

    td.abrir.addEventListener('click', () => {
      if (!codigoAcessoSalvo()) return; // sem o código de pesquisa o cartão fica desabilitado
      const abrir = td.detalhe.hidden;
      td.detalhe.hidden = !abrir;
      td.ouvirTopoBtn.hidden = !abrir; // o ícone 🔊 do topo só aparece com o texto expandido
      td.abrir.setAttribute('aria-expanded', String(abrir));
      inicioAjustarAltura();
    });
    document.getElementById('tdAnterior').addEventListener('click', () => tdCarregar(tdMais(tdData || tdHoje(), -1)));
    document.getElementById('tdProximo').addEventListener('click', () => tdCarregar(tdMais(tdData || tdHoje(), 1)));
    td.hojeBtn.addEventListener('click', () => tdCarregar(tdHoje()));
    // O ícone 🔊 do topo lê o texto do dia sem abrir o texto: o tocador aparece logo abaixo do título. Tocar de novo para a leitura. A frase que
    // está sendo lida fica destacada no cartão (o mesmo leitor da tela Leitura em voz alta): o cartão é remontado em frases (span.lu) e cada
    // frase falada casa com a mostrada. A voz pula algumas frases (uma referência sozinha, como "— 2 Cor. 10:3-5.", ou só um parênteses): elas ficam
    // sem som e as outras casam em ordem. Se mesmo assim as contagens não batem, o parágrafo não é marcado (melhor nada do que marcar tudo).
    // O destaque da frase lida, em quem tem as unidades e o índice destacado ({ unidades, destaque }): o texto do dia e os comentários adicionais.
    function tdLeituraDestacarEm(estado, indice) {
      if (indice === estado.destaque) return;
      const anterior = estado.unidades[estado.destaque];
      if (anterior && anterior.el) anterior.el.classList.remove('lendo');
      estado.destaque = indice;
      const u = estado.unidades[indice];
      if (!u || !u.el) return; // parágrafo que não casou com a fala: não é marcado
      u.el.classList.add('lendo');
      if (u.el.getClientRects().length) u.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // com o texto fechado, não há o que mostrar
    }

    // Casa as frases mostradas de cada linha ({ el, texto, falado }) com as faladas e devolve as unidades da leitura. Linha com `inteira` é uma
    // unidade só (o ponto que abre um comentário).
    function tdLeituraCasar(linhas, regras) {
      const unidades = [];
      linhas.forEach((linha, paragrafo) => {
        if (!linha.falado) return;
        if (linha.inteira) {
          linha.el.classList.add('lu');
          leituraMudosNoSpan(linha.el, regras);
          unidades.push({ falado: linha.falado, origem: linha.texto || '', paragrafo, el: linha.el });
          return;
        }
        const mostradas = leituraFrases(linha.texto);
        const faladas = leituraFrases(linha.falado);
        let pares = null; // [{ mostrada, falada }] ('' = frase sem som)
        if (mostradas.length === faladas.length) {
          pares = mostradas.map((mostrada, k) => ({ mostrada, falada: faladas[k] }));
        } else {
          const sozinhas = mostradas.map(mostrada => textoParaVoz(mostrada, regras));
          if (sozinhas.filter(Boolean).length === faladas.length) {
            let k = 0;
            pares = mostradas.map((mostrada, i) => ({ mostrada, falada: sozinhas[i] ? faladas[k++] : '' }));
          }
        }
        if (!pares) {
          unidades.push({ falado: linha.falado, origem: linha.texto || '', paragrafo, el: null }); // lê, mas sem marcar
        } else if (pares.length === 1) {
          linha.el.classList.add('lu'); // uma frase só: a própria linha
          leituraMudosNoSpan(linha.el, regras);
          unidades.push({ falado: pares[0].falada, origem: pares[0].mostrada || linha.texto || '', paragrafo, el: linha.el });
        } else {
          linha.el.textContent = '';
          let posicao = 0; // onde a frase começa no texto da linha (para saber se ela é da "base" em negrito e itálico dos comentários da IA)
          pares.forEach((par, k) => {
            if (k) linha.el.appendChild(document.createTextNode(' '));
            const span = document.createElement('span');
            span.className = 'lu';
            const inicio = linha.base ? linha.texto.indexOf(par.mostrada, posicao) : -1;
            if (inicio >= 0) {
              posicao = inicio + par.mostrada.length;
              if (posicao <= linha.base + 1) span.classList.add('td-ia-base');
            }
            span.textContent = par.mostrada;
            linha.el.appendChild(span);
            leituraMudosNoSpan(span, regras);
            unidades.push({ falado: par.falada, origem: par.mostrada || '', paragrafo, el: span });
          });
        }
      });
      return unidades;
    }

    const tdLeituraEstado = { unidades: [], destaque: -1 };

    function tdLeituraPreparar(regras) {
      if (!tdTexto) return 'Não há texto para ouvir.';
      // A data e o texto temático são falados juntos (a regra de pular a referência do tema depende de a data vir antes).
      const cabecalho = textoParaVoz(tdTexto.titulo + '\n' + tdTexto.tema, regras).split('\n');
      const linhas = [
        { el: td.data, texto: tdTexto.titulo, falado: cabecalho.length === 2 ? cabecalho[0] : '' },
        { el: td.tema, texto: tdTexto.tema, falado: cabecalho.length === 2 ? cabecalho[1] : cabecalho.join(' ') }
      ];
      td.comentario.textContent = '';
      tdTexto.comentario.forEach(paragrafo => {
        const p = document.createElement('p');
        p.textContent = paragrafo;
        td.comentario.appendChild(p);
        linhas.push({ el: p, texto: paragrafo, falado: textoParaVoz(paragrafo, regras) });
      });
      tdLeituraEstado.destaque = -1;
      tdLeituraEstado.unidades = tdLeituraCasar(linhas, regras);
      return { unidades: tdLeituraEstado.unidades, desde: 0 };
    }

    const tdLeituraDestacar = indice => tdLeituraDestacarEm(tdLeituraEstado, indice);

    // Os comentários adicionais: cada um (com o ponto que o abre, lido como uma frase só) vira frases tocáveis, como o texto do dia.
    const tdIaLeituraEstado = { unidades: [], destaque: -1 };

    function tdIaLeituraPreparar(regras) {
      const linhas = [];
      [...td.iaLista.children].forEach(item => {
        const ponto = item.querySelector('.td-ia-ponto');
        const texto = item.querySelector('.td-ia-texto');
        if (ponto) {
          let falado = textoParaVoz(ponto.textContent, regras);
          if (falado && !/[.!?…:;]$/.test(falado)) falado += '.'; // a voz faz uma pausa antes do comentário
          linhas.push({ el: ponto, texto: ponto.textContent, falado, inteira: true });
        }
        if (texto) linhas.push({ el: texto, texto: texto.textContent, falado: textoParaVoz(texto.textContent, regras), base: Number(texto.dataset.baseLen) || 0 });
      });
      tdIaLeituraEstado.destaque = -1;
      tdIaLeituraEstado.unidades = tdLeituraCasar(linhas, regras);
      if (!tdIaLeituraEstado.unidades.length) return 'Não há comentários para ouvir.';
      return { unidades: tdIaLeituraEstado.unidades, desde: 0 };
    }

    td.ouvirTopoBtn.addEventListener('click', () => {
      if (!tdTexto) return;
      if (vozBar.parentNode === td.vozTopo && !vozBar.hidden && !vozPauseBtn.hidden) return vozParar();
      if (!tdVozCupom) return showAlert('Recarregue o texto do dia para poder ouvi-lo.', 'Leitura em voz alta');
      const cfg = {
        lugar: td.vozTopo,
        uso: 'texto-diario',
        fecharOferta: true, // terminada a leitura, a oferta de salvar o áudio some sozinha depois do tempo de espera configurado
        acesso: studyAccessError,
        vozExtra: { data: tdTexto.data, vozCupom: tdVozCupom },
        preparar: tdLeituraPreparar,
        nomeAudio: () => 'Texto diário - ' + (tdTexto ? tdTexto.titulo : ''),
        destacar: tdLeituraDestacar,
        limpar: () => tdLeituraDestacar(-1)
      };
      vozAbrirPronto({ lugar: cfg.lugar, texto: 'Pronto para ler o texto do dia.', acesso: cfg.acesso, iniciar: () => leitorLer(cfg) });
    });
    // O ícone fica destacado enquanto o tocador está no topo e aberto.
    const tdMarcarTocando = new MutationObserver(() => td.ouvirTopoBtn.classList.toggle('tocando', vozBar.parentNode === td.vozTopo && !vozBar.hidden));
    tdMarcarTocando.observe(vozBar, { attributes: true, attributeFilter: ['hidden'] });
    tdMarcarTocando.observe(td.vozTopo, { childList: true });
    td.ouvirIaBtn.addEventListener('click', () => {
      if (!td.iaLista.children.length || !tdTexto) return;
      if (vozBar.parentNode === td.vozIa && !vozBar.hidden && !vozPauseBtn.hidden) return vozParar();
      const cupomIa = tdIaVozCupons.get(tdTexto.data) || '';
      if (!cupomIa) return showAlert('Gere os comentários de novo (ou recupere um salvamento recente) para poder ouvi-los.', 'Leitura em voz alta');
      const cfg = {
        lugar: td.vozIa,
        uso: 'texto-diario',
        fecharOferta: true,
        acesso: studyAccessError,
        vozExtra: { data: tdTexto.data, vozCupom: cupomIa },
        preparar: tdIaLeituraPreparar,
        nomeAudio: () => 'Comentários do texto diário - ' + (tdTexto ? tdTexto.titulo : ''),
        destacar: indice => tdLeituraDestacarEm(tdIaLeituraEstado, indice),
        limpar: () => tdLeituraDestacarEm(tdIaLeituraEstado, -1)
      };
      vozAbrirPronto({ lugar: cfg.lugar, texto: 'Pronto para ler os comentários.', acesso: cfg.acesso, iniciar: () => leitorLer(cfg) });
    });
    // O botão fica com contorno enquanto o tocador está nos comentários e aberto.
    const tdIaMarcarTocando = new MutationObserver(() => td.ouvirIaBtn.classList.toggle('tocando', vozBar.parentNode === td.vozIa && !vozBar.hidden));
    tdIaMarcarTocando.observe(vozBar, { attributes: true, attributeFilter: ['hidden'] });
    tdIaMarcarTocando.observe(td.vozIa, { childList: true });
    // Leva o texto do dia para o campo de texto, com os comentários adicionais no fim, se já foram gerados.
    td.campoBtn.addEventListener('click', async () => {
      if (!tdTexto) return;
      if (input.value.trim() && !(await askConfirm('O texto do campo de texto será trocado pelo texto diário (dá para desfazer). Continuar?', 'Levar para o campo de texto'))) return;
      const comentarios = tdIaCache.get(tdTexto.data) || [];
      const texto = tdTextoCompleto(tdTexto) + (comentarios.length ? '\n\n💬 COMENTÁRIOS ADICIONAIS\n\n' + tdComentariosEmTexto(comentarios) : '');
      setInputRange(0, input.value.length, texto, { message: 'Texto diário no campo de texto.' });
      autoGrowInputText();
      showScreen('formatar');
    });
    td.gerarBtn.addEventListener('click', () => tdGerarComentarios(false));
    td.iaOutrosBtn.addEventListener('click', () => tdGerarComentarios(true));
    // Limpar tira os comentários da tela. Se este dia tem comentários salvos, a cópia salva continua (📂 Recuperar); senão, para
    // vê-los de novo é preciso gerar outra vez. Para só escondê-los, basta tocar no título deles.
    td.iaLimparBtn.addEventListener('click', async () => {
      if (!tdTexto || aiBusy) return;
      const salvo = tdSalvosLer()[tdTexto.data];
      const aviso = salvo
        ? 'Tirar os comentários adicionais da tela? A cópia que você salvou continua guardada para recuperar até o fim do dia. Para só escondê-los, toque no título "Comentários adicionais".'
        : 'Apagar os comentários adicionais deste dia? Para vê-los de novo, será preciso gerar outra vez (ou salve-os antes, com 💾 Salvar). Para só escondê-los, toque no título "Comentários adicionais".';
      if (!(await askConfirm(aviso, 'Limpar os comentários'))) return;
      tdIaCache.delete(tdTexto.data);
      tdIaVozCupons.delete(tdTexto.data);
      tdIaMostrar();
    });
    // 💾 Salvar guarda neste aparelho os comentários que estão na tela, só para este dia (no dia seguinte são apagados).
    // Salvar de novo troca o que estava salvo. Dá para gerar outros e, depois, recuperar o conjunto salvo.
    td.iaSalvarBtn.addEventListener('click', () => {
      const comentarios = (tdTexto && tdIaCache.get(tdTexto.data)) || [];
      if (!comentarios.length) return;
      if (tdTexto.data < tdChave(tdHoje())) {
        td.iaStatus.textContent = 'Comentários de um dia que já passou não ficam salvos: eles valem só até o fim do próprio dia.';
        return;
      }
      const salvos = tdSalvosLer();
      salvos[tdTexto.data] = { salvoEm: new Date().toISOString(), comentarios, vozCupom: tdIaVozCupons.get(tdTexto.data) || '' };
      tdSalvosGravar(salvos);
      const gravado = tdSalvosLer()[tdTexto.data];
      td.iaStatus.textContent = gravado
        ? '💾 Comentários salvos neste aparelho. Valem até o fim deste dia; no dia seguinte são apagados.'
        : 'Não consegui salvar neste aparelho (sem espaço ou armazenamento bloqueado).';
    });
    // 📂 Recuperar põe de volta na tela os comentários salvos deste dia.
    td.recuperarBtn.addEventListener('click', () => {
      if (!tdTexto) return;
      const salvo = tdSalvosLer()[tdTexto.data];
      if (!salvo) return tdIaMostrar();
      tdIaCache.set(tdTexto.data, salvo.comentarios);
      if (salvo.vozCupom) tdIaVozCupons.set(tdTexto.data, salvo.vozCupom);
      else tdIaVozCupons.delete(tdTexto.data);
      td.ia.open = true;
      tdIaMostrar();
      const quando = tdQuandoSalvo(salvo.salvoEm);
      td.iaStatus.textContent = '📂 Comentários salvos' + (quando ? ' em ' + quando : '') + ' recuperados.';
    });
    td.iaCopiarBtn.addEventListener('click', async () => {
      const comentarios = (tdTexto && tdIaCache.get(tdTexto.data)) || [];
      if (!comentarios.length) return;
      try {
        await navigator.clipboard.writeText(tdComentariosEmTexto(comentarios));
        td.iaStatus.textContent = '✅ Comentários copiados.';
      } catch (e) {
        td.iaStatus.textContent = 'Não foi possível copiar. Use ✍️ Levar para o campo de texto.';
      }
    });
    // Código de pesquisa salvo depois (em Autorização de acessos): carrega o texto que ficou faltando.
    document.addEventListener('acesso-salvo', () => { if (!tdTexto) tdCarregar(tdData || tdHoje()); });
    // App aberto de novo noutro dia: se estava no texto de "hoje", passa para o do novo dia.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const hoje = tdChave(tdHoje());
      if (hoje === tdUltimoHoje) return;
      const estavaEmHoje = tdData && tdChave(tdData) === tdUltimoHoje;
      tdUltimoHoje = hoje;
      tdSalvosLer(); // o dia mudou: os comentários salvos dos dias que passaram são apagados
      if (estavaEmHoje) tdCarregar(tdHoje());
      else { td.hojeBtn.hidden = !tdData || tdChave(tdData) === hoje; tdIaMostrar(); }
    });
    tdCarregar(tdHoje());

    // ---------- Ajustes → Autorização de acessos ----------
    // O código de pesquisa (IA das reuniões e texto diário, com a leitura dele em voz alta), o do dirigente e a senha de administrador ficam num lugar só:
    // informados uma vez, conferidos no servidor e salvos neste aparelho. O resto do app lê daqui (codigoAcessoSalvo e
    // senhaAdminSalva) e não pede mais nenhum código em outros lugares.
    function codigoAcessoSalvo() {
      try { return (localStorage.getItem('jwLibraryNoteAplicarStudyCodeV1') || '').trim(); } catch (e) { return ''; }
    }
    function senhaAdminSalva() {
      try { return (localStorage.getItem('jwLibraryNoteAplicarAdminSenhaV1') || '').trim(); } catch (e) { return ''; }
    }
    function codigoTextoSalvo() {
      try { return (localStorage.getItem('jwLibraryNoteAplicarTextoCodeV1') || '').trim(); } catch (e) { return ''; }
    }
    function codigoLeituraSalvo() {
      try { return (localStorage.getItem('jwLibraryNoteAplicarLeituraCodeV1') || '').trim(); } catch (e) { return ''; }
    }
    function codigoS34Salvo() {
      try { return (localStorage.getItem('jwLibraryNoteAplicarS34CodeV1') || '').trim(); } catch (e) { return ''; }
    }
    function codigoDirigenteSalvo() {
      try { return (localStorage.getItem('jwLibraryNoteAplicarDirigenteCodeV1') || '').trim(); } catch (e) { return ''; }
    }

    // Abre Ajustes → Autorização de acessos com o cursor no campo pedido ('codigo', 'dirigente' ou 'senha').
    function abrirAcessos(campo) {
      const alvo = document.getElementById(campo === 'senha' ? 'adminSenha' : campo === 'dirigente' ? 'dirigenteCode' : campo === 'leitura' ? 'leituraCode' : 'aiStudyCode');
      openWithAncestors(document.getElementById('acessosSection'));
      requestAnimationFrame(() => {
        alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
        alvo.focus({ preventScroll: true });
      });
    }

    const acessos = {
      codigo: {
        campo: aiStudyCode, chave: 'jwLibraryNoteAplicarStudyCodeV1', acao: 'codigo-conferir', salvo: codigoAcessoSalvo,
        status: document.getElementById('acessoStatusCodigo'), ver: document.getElementById('acessoVerCodigo'), nome: 'O código de pesquisa',
        salvar: 'acessoSalvarCodigo', apagar: 'acessoApagarCodigo'
      },
      dirigente: {
        campo: document.getElementById('dirigenteCode'), chave: 'jwLibraryNoteAplicarDirigenteCodeV1', acao: 'dirigente-conferir', salvo: codigoDirigenteSalvo,
        status: document.getElementById('acessoStatusDirigente'), ver: document.getElementById('acessoVerDirigente'), nome: 'O código do dirigente',
        salvar: 'acessoSalvarDirigente', apagar: 'acessoApagarDirigente'
      },
      leitura: {
        campo: document.getElementById('leituraCode'), chave: 'jwLibraryNoteAplicarLeituraCodeV1', acao: 'leitura-conferir', salvo: codigoLeituraSalvo,
        status: document.getElementById('acessoStatusLeitura'), ver: document.getElementById('acessoVerLeitura'), nome: 'O código de leitura',
        salvar: 'acessoSalvarLeitura', apagar: 'acessoApagarLeitura'
      },
      s34: {
        campo: document.getElementById('s34Code'), chave: 'jwLibraryNoteAplicarS34CodeV1', acao: 's34-conferir', salvo: codigoS34Salvo,
        status: document.getElementById('acessoStatusS34'), ver: document.getElementById('acessoVerS34'), nome: 'O código do S-34',
        salvar: 'acessoSalvarS34', apagar: 'acessoApagarS34'
      },
      texto: {
        campo: document.getElementById('textoCode'), chave: 'jwLibraryNoteAplicarTextoCodeV1', acao: 'texto-conferir', salvo: codigoTextoSalvo,
        status: document.getElementById('acessoStatusTexto'), ver: document.getElementById('acessoVerTexto'), nome: 'O código de texto',
        salvar: 'acessoSalvarTexto', apagar: 'acessoApagarTexto'
      },
      senha: {
        campo: document.getElementById('adminSenha'), chave: 'jwLibraryNoteAplicarAdminSenhaV1', acao: 'admin-entrar', salvo: senhaAdminSalva,
        status: document.getElementById('acessoStatusSenha'), ver: document.getElementById('acessoVerSenha'), nome: 'A senha de administrador',
        salvar: 'acessoSalvarSenha', apagar: 'acessoApagarSenha'
      }
    };

    function acessoStatus(tipo, texto, aviso) {
      acessos[tipo].status.textContent = texto;
      acessos[tipo].status.classList.toggle('acesso-aviso', Boolean(aviso));
    }

    function acessoSituacao(tipo) {
      const a = acessos[tipo];
      a.campo.value = a.salvo();
      acessoStatus(tipo, a.salvo() ? '✅ Salvo neste aparelho.' : 'Ainda não informado.', !a.salvo());
    }

    async function acessoSalvar(tipo) {
      const a = acessos[tipo];
      const valor = a.campo.value.trim();
      if (!valor) {
        acessoStatus(tipo, 'Digite antes de salvar.', true);
        return a.campo.focus();
      }
      acessoStatus(tipo, 'Conferindo no servidor…', false);
      const r = await postConfig({ acao: a.acao, codigo: valor });
      // Recusado pelo servidor: não salva. Sem servidor (sem internet ou fora do site publicado): salva avisando.
      if (r.status === 403 || r.status === 429) return acessoStatus(tipo, configErrorMessage(r, 'Não foi aceito.') + ' Nada foi salvo.', true);
      safeSetItem(a.chave, valor);
      a.campo.value = valor;
      acessoStatus(tipo, r.ok ? '✅ Conferido e salvo neste aparelho.' : '💾 Salvo neste aparelho, mas não deu para conferir agora: ' + configErrorMessage(r, 'o servidor não respondeu.'), !r.ok);
      document.dispatchEvent(new CustomEvent('acesso-salvo', { detail: tipo }));
    }

    async function acessoApagar(tipo) {
      const a = acessos[tipo];
      if (!a.salvo()) return acessoSituacao(tipo);
      if (!(await askConfirm(a.nome + ' será apagado(a) deste aparelho. Para usar de novo os recursos que dependem dele(a), será preciso informar outra vez. Continuar?', 'Apagar deste aparelho'))) return;
      try { localStorage.removeItem(a.chave); } catch (e) { /* sem localStorage */ }
      acessoSituacao(tipo);
      document.dispatchEvent(new CustomEvent('acesso-salvo', { detail: tipo }));
    }

    Object.keys(acessos).forEach(tipo => {
      const a = acessos[tipo];
      acessoSituacao(tipo);
      document.getElementById(a.salvar).addEventListener('click', () => acessoSalvar(tipo));
      document.getElementById(a.apagar).addEventListener('click', () => acessoApagar(tipo));
      a.campo.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); acessoSalvar(tipo); } });
      a.ver.addEventListener('click', () => {
        const mostrar = a.campo.type === 'password';
        a.campo.type = mostrar ? 'text' : 'password';
        a.ver.setAttribute('aria-pressed', String(mostrar));
        a.ver.textContent = mostrar ? '🙈' : '👁️';
      });
    });
    // As opções exclusivas do administrador (marcadas com 🛡️) só aparecem para quem tem a senha de administrador salva neste aparelho; o
    // servidor confere a senha de novo em cada alteração. Sem a senha, ficam escondidas (e fechadas).
    function ajustesAdminAtualizar() {
      const admin = Boolean(senhaAdminSalva());
      document.querySelectorAll('.so-admin').forEach(el => {
        el.hidden = !admin;
        if (!admin && el.open) el.open = false;
      });
    }
    document.addEventListener('acesso-salvo', event => { if (event.detail === 'senha') ajustesAdminAtualizar(); });
    ajustesAdminAtualizar();

    // Botões "🔐 Abrir Autorização de acessos" dos avisos (voz).
    document.querySelectorAll('[data-ir-acessos]').forEach(botao => botao.addEventListener('click', () => abrirAcessos(botao.dataset.irAcessos)));
    // Senha salva ou apagada: os painéis de administrador abertos se atualizam (ou mostram o aviso).
    document.addEventListener('acesso-salvo', event => {
      if (event.detail !== 'senha') return;
      vozAtualizarBotoes();
      aiPadraoAtualizar();
      if (vozSection.open) vozAdminCarregar(senhaAdminSalva());
    });
    vozAtualizarBotoes();
    aiPadraoAtualizar();

    // Quais recursos cada código libera. Sem o código de pesquisa ficam desabilitados o grupo Preparar para comentar, o atalho
    // Comentários e o texto diário (que mantém só o link para o wol.jw.org). Sem o código do dirigente, o grupo Preparar para
    // dirigir, o atalho Dirigentes e a Preparação de discursos e esboços: o do dirigente vale sozinho para eles. Desabilitados continuam visíveis
    // (cinza, com cadeado e dizendo o que falta), para a pessoa saber que existem.
    const TRAVAS = {
      pesquisa: '🔒 Requer o código de pesquisa',
      dirigente: '🔒 Requer o código do dirigente',
      leitura: '🔒 Requer o código de leitura',
      texto: '🔒 Requer o código de texto'
    };

    function travarGrupo(id, motivo) {
      const grupo = document.getElementById(id);
      const trava = grupo.querySelector('.grupo-trava');
      grupo.classList.toggle('grupo-desabilitado', Boolean(motivo));
      if (trava) {
        trava.hidden = !motivo;
        if (motivo) trava.textContent = TRAVAS[motivo] + ' (Ajustes)';
      }
      grupo.querySelector(':scope > summary').setAttribute('aria-disabled', String(Boolean(motivo)));
      if (motivo) grupo.open = false;
    }

    function travarAtalho(nome, motivo) {
      const atalho = document.querySelector('.atalhos-grid [data-atalho="' + nome + '"]');
      const trava = atalho.querySelector('.atalho-trava');
      atalho.disabled = Boolean(motivo);
      trava.hidden = !motivo;
      if (motivo) trava.textContent = TRAVAS[motivo];
    }

    function acessosAtualizar() {
      const pesquisa = Boolean(codigoAcessoSalvo());
      const dirigente = Boolean(codigoDirigenteSalvo());
      const motivoDirigir = dirigente ? '' : 'dirigente';
      travarGrupo('grupoComentarios', pesquisa ? '' : 'pesquisa');
      travarGrupo('grupoDirigir', motivoDirigir);
      travarGrupo('grupoDiscursos', motivoDirigir);
      // Discurso público - lista de temas (esboços do S-34): só aparece com o código do S-34 (e o do dirigente, que libera o grupo).
      const s34 = Boolean(codigoS34Salvo());
      publicoBox.hidden = !s34;
      if (!s34 && publicoBox.open) publicoBox.open = false;
      // Formatar → Opções com IA (formatação e texto colado): só com o código de pesquisa; sem ele, fica cinza e não abre.
      travarGrupo('opcoesIaBox', pesquisa ? '' : 'pesquisa');
      travarAtalho('comentarios', pesquisa ? '' : 'pesquisa');
      travarAtalho('leitura', codigoLeituraSalvo() ? '' : 'leitura');
      travarAtalho('transcricao', codigoTextoSalvo() ? '' : 'texto');
      if (!codigoTextoSalvo() && currentScreen() === 'transcricao') showScreen('inicio'); // código apagado com a tela aberta: volta ao Início
      document.getElementById('navTranscricao').disabled = !codigoTextoSalvo(); // sem o código de texto, o botão da barra fica bloqueado como o atalho do Início
      document.getElementById('navLeitura').disabled = !codigoLeituraSalvo(); // sem o código de leitura, o botão da barra fica bloqueado como o atalho do Início
      if (!codigoLeituraSalvo() && currentScreen() === 'leitura') showScreen('inicio'); // código apagado com a tela aberta: volta ao Início
      travarAtalho('dirigir', motivoDirigir);
      travarAtalho('discursos', motivoDirigir);
      // Texto diário (tela Início): o cartão fica bloqueado, menos o link para o wol.jw.org, que vale sempre.
      const texto = document.getElementById('textoDiarioCard');
      texto.classList.toggle('card-desabilitado', !pesquisa);
      texto.querySelector('.td-topo').inert = !pesquisa;
      document.getElementById('tdLinkTrava').hidden = pesquisa;
      if (!pesquisa && tdTexto) { tdCache.clear(); tdCarregar(tdData || tdHoje()); } // código apagado: o cartão volta à mensagem do cadeado
      reunioesConferirVista(); // página aberta cujo grupo acabou de ser bloqueado: volta à tela principal
      reunioesAjustarHub(); // o aviso de bloqueio muda a altura dos botões
      historicoRender();
    }
    // Desabilitado, o grupo não abre (toque, Enter ou espaço no título).
    ['grupoComentarios', 'grupoDirigir', 'grupoDiscursos', 'opcoesIaBox'].forEach(id => {
      const grupo = document.getElementById(id);
      grupo.querySelector(':scope > summary').addEventListener('click', event => {
        if (grupo.classList.contains('grupo-desabilitado')) event.preventDefault();
      });
    });
    document.addEventListener('acesso-salvo', event => { if (event.detail === 'codigo' || event.detail === 'dirigente' || event.detail === 'leitura' || event.detail === 'texto' || event.detail === 's34') acessosAtualizar(); });
    acessosAtualizar();

    // O código do dirigente salvo pode deixar de valer (o administrador trocou a variável no servidor). O app confere com o
    // servidor ao abrir e ao voltar a ele (no máximo de 10 em 10 minutos); se o servidor recusar (403), apaga o código salvo e
    // esconde as opções. Sem conexão ou com erro do servidor, nada muda. Só apaga na recusa: assim não sobram tentativas
    // erradas repetidas (o servidor bloqueia o IP depois de várias).
    let dirigenteConferidoEm = 0;
    async function dirigenteVerificar(forcar) {
      const codigo = codigoDirigenteSalvo();
      if (!codigo || !navigator.onLine) return;
      if (!forcar && Date.now() - dirigenteConferidoEm < 10 * 60 * 1000) return;
      dirigenteConferidoEm = Date.now();
      const r = await postConfig({ acao: 'dirigente-conferir', codigo });
      if (r.status === 403 && codigoDirigenteSalvo() === codigo) dirigenteInvalido();
    }

    function dirigenteInvalido() {
      try { localStorage.removeItem('jwLibraryNoteAplicarDirigenteCodeV1'); } catch (e) { /* sem localStorage */ }
      acessoSituacao('dirigente');
      acessoStatus('dirigente', 'O código do dirigente que estava salvo não vale mais. Informe o novo código.', true);
      acessosAtualizar();
    }
    dirigenteVerificar(true);

    // O código de leitura salvo pode deixar de valer (o administrador trocou a variável CODIGO_LEITURA no servidor): mesma conferência do código do
    // dirigente. Só apaga se o servidor recusar (403); sem conexão ou com erro do servidor, nada muda.
    let leituraCodigoConferidoEm = 0;
    async function leituraCodigoVerificar(forcar) {
      const codigo = codigoLeituraSalvo();
      if (!codigo || !navigator.onLine) return;
      if (!forcar && Date.now() - leituraCodigoConferidoEm < 10 * 60 * 1000) return;
      leituraCodigoConferidoEm = Date.now();
      const r = await postConfig({ acao: 'leitura-conferir', codigo });
      if (r.status === 403 && codigoLeituraSalvo() === codigo) {
        try { localStorage.removeItem('jwLibraryNoteAplicarLeituraCodeV1'); } catch (e) { /* sem localStorage */ }
        acessoSituacao('leitura');
        acessoStatus('leitura', 'O código de leitura que estava salvo não vale mais. Informe o novo código.', true);
        acessosAtualizar();
      }
    }
    leituraCodigoVerificar(true);

    // O código de texto salvo também pode deixar de valer (variável CODIGO_TEXTO trocada no servidor): mesma conferência, só apaga se o servidor recusar (403).
    let textoCodigoConferidoEm = 0;
    async function textoCodigoVerificar(forcar) {
      const codigo = codigoTextoSalvo();
      if (!codigo || !navigator.onLine) return;
      if (!forcar && Date.now() - textoCodigoConferidoEm < 10 * 60 * 1000) return;
      textoCodigoConferidoEm = Date.now();
      const r = await postConfig({ acao: 'texto-conferir', codigo });
      if (r.status === 403 && codigoTextoSalvo() === codigo) {
        try { localStorage.removeItem('jwLibraryNoteAplicarTextoCodeV1'); } catch (e) { /* sem localStorage */ }
        acessoSituacao('texto');
        acessoStatus('texto', 'O código de texto que estava salvo não vale mais. Informe o novo código.', true);
        acessosAtualizar();
      }
    }
    textoCodigoVerificar(true);

    // O código do S-34 salvo também pode deixar de valer (variável CODIGO_S34 trocada no servidor): mesma conferência, só apaga se o servidor recusar (403).
    function s34CodigoInvalido() {
      if (!codigoS34Salvo()) return;
      try { localStorage.removeItem('jwLibraryNoteAplicarS34CodeV1'); } catch (e) { /* sem localStorage */ }
      acessoSituacao('s34');
      acessoStatus('s34', 'O código do S-34 que estava salvo não vale mais. Informe o novo código.', true);
      acessosAtualizar();
    }
    let s34CodigoConferidoEm = 0;
    async function s34CodigoVerificar(forcar) {
      const codigo = codigoS34Salvo();
      if (!codigo || !navigator.onLine) return;
      if (!forcar && Date.now() - s34CodigoConferidoEm < 10 * 60 * 1000) return;
      s34CodigoConferidoEm = Date.now();
      const r = await postConfig({ acao: 's34-conferir', codigo });
      if (r.status === 403 && codigoS34Salvo() === codigo) s34CodigoInvalido();
    }
    s34CodigoVerificar(true);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { dirigenteVerificar(false); leituraCodigoVerificar(false); textoCodigoVerificar(false); s34CodigoVerificar(false); } });

    // ---------- Tela Áudio em texto ----------
    // O áudio é decodificado neste aparelho (Web Audio), reamostrado para 16 kHz mono, cortado em trechos de ~50 s (o Google aceita até 1 minuto por
    // pedido direto) e cada trecho vai a /api/transcrever, que usa o Chirp 3 do Google. Depois o texto pode ser resumido pela IA. Nada fica salvo.
    const TRANSCRICAO_MAX_MIN = 30;
    const TRANSCRICAO_TRECHO_S = 50;
    const TRANSCRICAO_TAXA = 16000;
    const TRANSCRICAO_CONSENT_KEY = 'jwLibraryNoteAplicarTextoConsentV1';
    const trArquivo = document.getElementById('transcricaoArquivo');
    const trInfo = document.getElementById('transcricaoInfo');
    const trProgresso = document.getElementById('transcricaoProgresso');
    const trTexto = document.getElementById('transcricaoTexto');
    const trResumo = document.getElementById('transcricaoResumo');
    const trCancelar = document.getElementById('transcricaoCancelarBtn');
    const trEscolher = document.getElementById('transcricaoArquivoBtn');
    const trResumir = document.getElementById('transcricaoResumirBtn');
    const trContexto = document.getElementById('transcricaoContexto');
    const trInstrucoes = document.getElementById('transcricaoInstrucoes');
    const TRANSCRICAO_INSTR_KEY = 'jwLibraryNoteAplicarTextoInstrucoesV1';
    try { trInstrucoes.value = localStorage.getItem(TRANSCRICAO_INSTR_KEY) || ''; } catch (e) { /* sem localStorage */ }
    trInstrucoes.addEventListener('input', () => safeSetItem(TRANSCRICAO_INSTR_KEY, trInstrucoes.value));
    let trControle = null; // AbortController do que está em andamento

    function trAtualizarBotoes() {
      const ocupado = Boolean(trControle);
      trEscolher.disabled = ocupado;
      trResumir.disabled = ocupado || trTexto.value.trim().length < 40;
      document.getElementById('transcricaoCopiarBtn').disabled = !trTexto.value.trim();
      document.getElementById('transcricaoCopiarResumoBtn').disabled = !trResumo.value.trim();
      trCancelar.hidden = !ocupado;
    }
    trTexto.addEventListener('input', trAtualizarBotoes);
    trResumo.addEventListener('input', trAtualizarBotoes);

    function trConsentimento() {
      try { if (localStorage.getItem(TRANSCRICAO_CONSENT_KEY)) return Promise.resolve(true); } catch (e) { /* sem localStorage */ }
      const link = document.createElement('a');
      link.href = 'privacidade.html';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = '🔒 Ler a Política de Privacidade';
      return askConfirm(
        'Para transformar áudio em texto, o NoteStyle envia o áudio, em trechos e pela internet, ao Google (reconhecimento de voz) e, se você pedir o resumo, o texto transcrito à Anthropic (IA).\n\n' +
        'O envio só acontece quando você escolhe um arquivo ou toca em Resumir, e nada fica guardado no servidor do NoteStyle. O áudio pode conter vozes e conversas de outras pessoas: use só gravações que você tem direito de usar e não grave nem transcreva alguém sem avisar. A transcrição pode errar: confira sempre.\n\n' +
        'Você pode retirar a concordância quando quiser, em Ajustes → Privacidade e dados deste aparelho.',
        'Antes de transcrever um áudio',
        { ok: '✅ Concordo', cancel: 'Agora não', extra: link }
      ).then(aceitou => {
        if (aceitou) safeSetItem(TRANSCRICAO_CONSENT_KEY, JSON.stringify({ v: 1, data: new Date().toISOString() }));
        return aceitou;
      });
    }

    // Decodifica o arquivo já em 16 kHz mono (o decodeAudioData reamostra para a taxa do contexto; se o navegador não o fizer, reamostra aqui).
    async function trDecodificar(arquivo) {
      const Contexto = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Contexto) throw new Error('Este navegador não consegue processar áudio.');
      const bytes = await arquivo.arrayBuffer();
      const contexto = new Contexto(1, TRANSCRICAO_TAXA, TRANSCRICAO_TAXA);
      const buffer = await new Promise((ok, falha) => {
        const promessa = contexto.decodeAudioData(bytes, ok, falha);
        if (promessa && promessa.catch) promessa.catch(falha);
      });
      if (buffer.sampleRate === TRANSCRICAO_TAXA && buffer.numberOfChannels === 1) return buffer.getChannelData(0);
      const saida = new Contexto(1, Math.max(1, Math.ceil(buffer.duration * TRANSCRICAO_TAXA)), TRANSCRICAO_TAXA);
      const fonte = saida.createBufferSource();
      fonte.buffer = buffer;
      fonte.connect(saida.destination);
      fonte.start();
      return (await saida.startRendering()).getChannelData(0);
    }

    function trParaBase64(amostras) {
      const pcm = new Int16Array(amostras.length);
      let pico = 0;
      for (let i = 0; i < amostras.length; i++) {
        const v = Math.max(-1, Math.min(1, amostras[i]));
        if (Math.abs(v) > pico) pico = Math.abs(v);
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      const bytes = new Uint8Array(pcm.buffer);
      let texto = '';
      for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { base64: btoa(texto), pico };
    }

    async function trPost(payload, sinal) {
      try {
        const resposta = await fetch('/api/transcrever', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: sinal });
        let dados = null;
        try { dados = await resposta.json(); } catch (e) { /* resposta sem JSON */ }
        return { ok: resposta.ok && Boolean(dados), status: resposta.status, dados };
      } catch (e) {
        return { ok: false, status: 0, dados: null, cancelado: e && e.name === 'AbortError' };
      }
    }

    function trMensagem(r, padrao) {
      if (r.cancelado) return 'Cancelado.';
      if (r.status === 404 || r.status === 501) return 'A transcrição só funciona no site publicado (notestyle.com.br).';
      if (r.status === 403 && r.dados && /Código de texto/.test(r.dados.erro || '')) return r.dados.erro;
      return (r.dados && r.dados.erro) || padrao;
    }

    async function trTranscrever(arquivo) {
      if (!codigoTextoSalvo()) return (trInfo.textContent = 'Salve o código de texto em Ajustes → 🔐 Autorização de acessos.');
      if (!navigator.onLine) return (trInfo.textContent = 'Sem conexão com a internet.');
      if (!(await trConsentimento())) return (trInfo.textContent = 'Nada foi enviado.');
      trControle = new AbortController();
      trAtualizarBotoes();
      trTexto.value = '';
      trResumo.value = '';
      trProgresso.hidden = false;
      trProgresso.removeAttribute('value'); // indeterminado enquanto decodifica
      trInfo.textContent = '⏳ Preparando o áudio neste aparelho…';
      try {
        let amostras;
        try {
          amostras = await trDecodificar(arquivo);
        } catch (e) {
          return (trInfo.textContent = 'Não consegui abrir este áudio neste aparelho. Tente outro formato (mp3, m4a ou wav).');
        }
        const minutos = amostras.length / TRANSCRICAO_TAXA / 60;
        if (minutos > TRANSCRICAO_MAX_MIN) return (trInfo.textContent = 'O áudio tem ' + Math.round(minutos) + ' minutos; o limite é de ' + TRANSCRICAO_MAX_MIN + ' minutos por arquivo.');
        const porTrecho = TRANSCRICAO_TRECHO_S * TRANSCRICAO_TAXA;
        const total = Math.ceil(amostras.length / porTrecho);
        trProgresso.max = total;
        trProgresso.value = 0;
        const partes = [];
        for (let n = 0; n < total; n++) {
          if (trControle.signal.aborted) return (trInfo.textContent = 'Cancelado. O que já foi transcrito está abaixo.');
          trInfo.textContent = '🎙️ Transcrevendo o trecho ' + (n + 1) + ' de ' + total + '…';
          const { base64, pico } = trParaBase64(amostras.subarray(n * porTrecho, (n + 1) * porTrecho));
          if (pico >= 0.005) { // trecho em silêncio não é enviado (não gasta)
            let r = await trPost({ acao: 'trecho', codigoTexto: codigoTextoSalvo(), audio: base64 }, trControle.signal);
            if (!r.ok && !r.cancelado && (r.status === 0 || r.status >= 500)) r = await trPost({ acao: 'trecho', codigoTexto: codigoTextoSalvo(), audio: base64 }, trControle.signal); // uma nova tentativa
            if (!r.ok) {
              trInfo.textContent = trMensagem(r, 'Não foi possível transcrever o trecho ' + (n + 1) + '.') + (partes.length ? ' O que já foi transcrito está abaixo.' : '');
              return;
            }
            if (r.dados.texto) partes.push(r.dados.texto);
            trTexto.value = partes.join('\n\n');
          }
          trProgresso.value = n + 1;
        }
        trInfo.textContent = partes.length ? '✅ Pronto: ' + total + ' trecho(s) transcrito(s). Confira o texto e, se quiser, peça o resumo.' : 'Não encontrei fala neste áudio.';
      } finally {
        trControle = null;
        trProgresso.hidden = true;
        trAtualizarBotoes();
      }
    }

    trEscolher.addEventListener('click', () => trArquivo.click());
    trArquivo.addEventListener('change', () => {
      const arquivo = trArquivo.files && trArquivo.files[0];
      trArquivo.value = '';
      if (arquivo) trTranscrever(arquivo);
    });
    trCancelar.addEventListener('click', () => { if (trControle) trControle.abort(); });

    trResumir.addEventListener('click', async () => {
      if (!codigoTextoSalvo()) return (trInfo.textContent = 'Salve o código de texto em Ajustes → 🔐 Autorização de acessos.');
      if (!(await trConsentimento())) return;
      trControle = new AbortController();
      trAtualizarBotoes();
      trInfo.textContent = '✨ A IA está resumindo…';
      try {
        const r = await trPost({ acao: 'resumo', codigoTexto: codigoTextoSalvo(), texto: trTexto.value, contexto: trContexto.value, instrucoes: trInstrucoes.value }, trControle.signal);
        if (!r.ok) return (trInfo.textContent = trMensagem(r, 'Não foi possível resumir agora.'));
        trResumo.value = r.dados.resumo;
        trInfo.textContent = '✅ Resumo pronto. A IA pode errar: confira com o texto.';
      } finally {
        trControle = null;
        trAtualizarBotoes();
      }
    });

    async function trCopiar(campo, rotulo) {
      const texto = campo.value;
      try {
        await navigator.clipboard.writeText(texto);
      } catch (e) {
        campo.focus();
        campo.select();
        try { document.execCommand('copy'); } catch (e2) { /* sem cópia */ }
      }
      trInfo.textContent = '📋 ' + rotulo + ' copiado.';
    }
    document.getElementById('transcricaoCopiarBtn').addEventListener('click', () => trCopiar(trTexto, 'Texto'));
    document.getElementById('transcricaoCopiarResumoBtn').addEventListener('click', () => trCopiar(trResumo, 'Resumo'));
    document.getElementById('transcricaoLimparBtn').addEventListener('click', async () => {
      if (trControle) trControle.abort();
      if ((trTexto.value.trim() || trResumo.value.trim()) && !(await askConfirm('Apagar o texto transcrito e o resumo? Eles não ficam salvos em nenhum lugar.', 'Limpar tudo'))) return;
      trTexto.value = '';
      trResumo.value = '';
      trContexto.value = ''; // o "sobre o áudio" vale só para um áudio; as instruções do resumo ficam salvas
      trInfo.textContent = '';
      trAtualizarBotoes();
    });
    trAtualizarBotoes();

    // ---------- Tela Reuniões: a tela principal e as páginas ----------
    // A tela principal mostra só os botões (comentar, dirigir, discursos e pesquisas salvas) e cada um abre a sua página, com ◀ Voltar. O que
    // aparece é decidido pelo CSS, pelo atributo data-reunioes do body (hub ou o nome da página); aqui ficam quais caixas estão abertas.
    const GRUPOS_REUNIOES = ['grupoComentarios', 'grupoDirigir', 'grupoDiscursos'];
    const REUNIOES_VISTAS = {
      comentarios: { caixa: 'grupoComentarios', titulo: '✋ Preparar para comentar' },
      dirigir: { caixa: 'grupoDirigir', titulo: '🎤 Preparar para dirigir' },
      discursos: { caixa: 'grupoDiscursos', titulo: '📜 Preparação de discursos e esboços' },
      historico: { caixa: 'secaoHistorico', titulo: '🗂️ Pesquisas e respostas salvas' }
    };

    function reunioesVistaAtual() { return document.body.dataset.reunioes || 'hub'; }

    // Atalhos (Início, menus): abrem a tela Reuniões já na página pedida; os outros abrem a tela do mesmo nome.
    document.querySelectorAll('[data-atalho]').forEach(botao => {
      botao.addEventListener('click', () => {
        const destino = botao.dataset.atalho;
        if (!REUNIOES_VISTAS[destino]) return showScreen(destino);
        showScreen('reunioes');
        if (destino === 'historico') historicoRecolher();
        reunioesIr(destino);
      });
    });

    // vista: 'hub' (a tela principal) ou uma das páginas.
    function reunioesIr(vista, opcoes) {
      const destino = REUNIOES_VISTAS[vista] ? vista : 'hub';
      document.body.dataset.reunioes = destino;
      GRUPOS_REUNIOES.forEach(id => { document.getElementById(id).open = destino !== 'hub' && REUNIOES_VISTAS[destino].caixa === id; });
      document.getElementById('secaoReunioes').open = destino !== 'historico'; // na tela principal o resumo dela fica escondido
      document.getElementById('secaoHistorico').open = destino === 'historico';
      if (destino !== 'hub') {
        // O título começa com um emoji: ele vai num <span> à parte, maior que o texto.
        const tituloPagina = document.getElementById('reunioesTitulo');
        const [icone, ...resto] = REUNIOES_VISTAS[destino].titulo.split(' ');
        const spanIcone = document.createElement('span');
        spanIcone.className = 'reunioes-pagina-icone';
        spanIcone.setAttribute('aria-hidden', 'true');
        spanIcone.textContent = icone;
        const spanTexto = document.createElement('span');
        spanTexto.textContent = resto.join(' ');
        tituloPagina.replaceChildren(spanIcone, spanTexto);
        document.getElementById('reunioesTopo').dataset.cor = destino;
      }
      reunioesAvisoOcultar();
      navMarcar();
      if (!(opcoes && opcoes.keepScroll)) window.scrollTo(0, 0);
      // O campo de texto fica escondido na tela principal (a medida dele daria zero): ao abrir uma página, recalcula a altura.
      requestAnimationFrame(() => { try { autoGrowInputText(); } catch (e) { /* ainda iniciando */ } reunioesAjustarHub(); reunioesTituloAjustar(); });
    }

    // O texto do título da página (ao lado do emoji) quebra em linhas e a caixa dele fica com toda a largura disponível; centralizado nela, o texto ficava
    // longe do emoji. A caixa passa a ter a largura da linha mais larga, e o emoji fica colado ao texto (o conjunto continua centralizado na faixa).
    function reunioesTituloAjustar() {
      const texto = document.querySelector('#reunioesTitulo > span:not(.reunioes-pagina-icone)');
      if (!texto) return;
      texto.style.width = '';
      if (!texto.getClientRects().length) return; // tela principal ou outra tela: a medida daria zero
      const faixa = document.createRange();
      faixa.selectNodeContents(texto);
      const maior = Math.max(0, ...Array.from(faixa.getClientRects(), r => r.width));
      if (maior) texto.style.width = (Math.ceil(maior) + 1) + 'px';
    }
    window.addEventListener('resize', reunioesTituloAjustar);

    // Tela principal de Reuniões: reparte a altura que sobra na tela (até a barra de baixo) entre os quatro botões, sem
    // espaço vazio embaixo. Cabendo, ficam todos iguais; senão, cada um cresce a partir do seu tamanho. Fora dela, volta ao natural.
    function reunioesAjustarHub() {
      const card = document.getElementById('reunioesCard');
      if (!card) return;
      const todos = [...card.querySelectorAll(':is(.reunioes-grupo, .historico-secao) > summary')];
      todos.forEach(b => { b.style.minHeight = ''; });
      const noHub = currentScreen() === 'reunioes' && reunioesVistaAtual() === 'hub';
      if (!noHub) return;
      const botoes = todos.filter(b => b.offsetParent !== null);
      if (!botoes.length) return;
      // A medida usa as fontes e os espaços de antes (classe hub-medindo): as fontes maiores dos botões cabem nessa mesma altura, que não muda.
      document.body.classList.add('hub-medindo');
      try {
        const main = card.closest('main');
        const estilo = el => getComputedStyle(el);
        const embaixo = parseFloat(estilo(document.body).paddingBottom) + (main ? parseFloat(estilo(main).paddingBottom) : 0);
        const topo = card.getBoundingClientRect().top + window.scrollY;
        const folga = window.innerHeight - topo - embaixo - card.offsetHeight; // com os botões do tamanho do conteúdo
        if (folga <= 0) return;
        const naturais = botoes.map(b => b.offsetHeight);
        const maior = Math.max(...naturais);
        const folgaIguais = folga - (maior * botoes.length - naturais.reduce((a, b) => a + b, 0));
        const iguais = folgaIguais >= 0;
        const extra = Math.min(60, Math.floor((iguais ? folgaIguais : folga) / botoes.length));
        botoes.forEach((b, i) => { b.style.minHeight = ((iguais ? maior : naturais[i]) + extra) + 'px'; });
      } finally {
        document.body.classList.remove('hub-medindo');
      }
    }
    window.addEventListener('resize', reunioesAjustarHub);

    // Um código apagado enquanto a página do grupo estava aberta: o grupo fica bloqueado, então volta à tela principal.
    function reunioesConferirVista() {
      const vista = reunioesVistaAtual();
      if (vista === 'hub') return;
      const caixa = document.getElementById(REUNIOES_VISTAS[vista].caixa);
      if (caixa.classList.contains('grupo-desabilitado')) reunioesIr('hub', { keepScroll: true });
    }

    // Algo que está dentro de um grupo precisa aparecer (openWithAncestors): abre a página dele.
    function reunioesMostrarDe(elemento) {
      if (!elemento || !elemento.closest) return;
      const dono = elemento.closest('#grupoComentarios, #grupoDirigir, #grupoDiscursos, #secaoHistorico');
      if (!dono) return;
      const vista = Object.keys(REUNIOES_VISTAS).find(v => REUNIOES_VISTAS[v].caixa === dono.id);
      if (vista && reunioesVistaAtual() !== vista) reunioesIr(vista, { keepScroll: true });
    }

    function reunioesIrAoCampo() {
      const campo = document.querySelector('.screen-editor');
      if (campo) campo.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    // A resposta da IA vai para o campo de texto, que fica no fim da página: um botão avisa e leva até ele (só se ele não está à vista).
    function reunioesAvisoOcultar() {
      const botao = document.getElementById('reunioesAvisoCampo');
      if (!botao) return;
      clearTimeout(botao._timer);
      botao.hidden = true;
    }
    function reunioesAvisarCampo(mensagem) {
      if (!/^✅/.test(String(mensagem)) || currentScreen() !== 'reunioes' || reunioesVistaAtual() === 'hub') return;
      const campo = document.querySelector('.screen-editor');
      const botao = document.getElementById('reunioesAvisoCampo');
      if (!campo || !botao) return;
      const caixa = campo.getBoundingClientRect();
      if (caixa.top < window.innerHeight * 0.6 && caixa.bottom > 0) return; // o campo já está à vista
      botao.hidden = false;
      clearTimeout(botao._timer);
      botao._timer = setTimeout(reunioesAvisoOcultar, 12000);
    }
    document.getElementById('reunioesAvisoCampo').addEventListener('click', () => { reunioesAvisoOcultar(); reunioesIrAoCampo(); });
    document.getElementById('reunioesCampoBtn').addEventListener('click', reunioesIrAoCampo);
    document.getElementById('reunioesVoltar').addEventListener('click', () => reunioesIr('hub'));

    // Uma opção de cada vez: ao abrir uma opção de um grupo (Estudo de A Sentinela, Estudo Bíblico, Joias, Tesouros…), as outras do grupo se escondem
    // (o CSS faz isso quando o grupo tem a classe "tem-aberto"); ao recolher, elas voltam. Ao abrir, a opção é trazida para a tela (as de cima
    // somem e o texto sobe).
    function reunioesSincronizarAbertas(grupo) {
      grupo.classList.toggle('tem-aberto', [...grupo.children].some(c => c.matches('details.subsection') && c.open));
    }
    document.addEventListener('toggle', event => {
      const caixa = event.target;
      if (!(caixa instanceof HTMLDetailsElement) || !caixa.matches('.reunioes-grupo > details.subsection')) return;
      reunioesSincronizarAbertas(caixa.parentElement);
      if (caixa.open) {
        requestAnimationFrame(() => caixa.querySelector(':scope > summary').scrollIntoView({ block: 'nearest' }));
      }
    }, true);
    document.querySelectorAll('.reunioes-grupo').forEach(reunioesSincronizarAbertas);

    // Os botões da tela principal (os títulos dos grupos e das pesquisas salvas) abrem a página em vez de abrir a caixa.
    Object.keys(REUNIOES_VISTAS).forEach(vista => {
      const caixa = document.getElementById(REUNIOES_VISTAS[vista].caixa);
      caixa.querySelector(':scope > summary').addEventListener('click', event => {
        event.preventDefault();
        if (caixa.classList.contains('grupo-desabilitado')) return;
        if (vista === 'historico') historicoRecolher();
        reunioesIr(vista);
      });
    });
    // Tocar de novo em "Reuniões" na barra de baixo, estando numa página, volta à tela principal.
    document.getElementById('appNav').addEventListener('click', event => {
      const botao = event.target.closest('[data-screen-target="reunioes"]');
      if (botao && currentScreen() === 'reunioes' && reunioesVistaAtual() !== 'hub') reunioesIr('hub');
    }, true);
    // Dentro da página de um grupo, só uma ferramenta fica aberta de cada vez (abrir uma fecha as outras e leva até ela).
    GRUPOS_REUNIOES.forEach(id => {
      const grupo = document.getElementById(id);
      grupo.querySelectorAll(':scope > details.subsection').forEach(caixa => {
        caixa.addEventListener('toggle', () => {
          if (!caixa.open) return;
          grupo.querySelectorAll(':scope > details.subsection').forEach(outra => { if (outra !== caixa) outra.open = false; });
          requestAnimationFrame(() => caixa.scrollIntoView({ block: 'start', behavior: 'smooth' }));
        });
      });
    });

    // A opção "Organização da tela Reuniões" saiu (a tela em páginas é a única): apaga a escolha que versões antigas guardaram.
    try { localStorage.removeItem('jwLibraryNoteAplicarReunioesModoV1'); } catch (e) { /* sem localStorage */ }
    reunioesIr('hub', { keepScroll: true });
  