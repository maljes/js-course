/* Code-Heft – course engine
 * Provides <js-console>, <js-editor>, <html-playground>, navigation and progress tracking.
 * All user-facing text is German; all code is English.
 */
(() => {
  'use strict';

  const LESSONS = [
    { file: 'index.html', title: 'Start: Was ist Programmieren?' },
    { file: 'lesson-01.html', title: 'Die Konsole' },
    { file: 'lesson-02.html', title: 'Variablen' },
    { file: 'lesson-03.html', title: 'Datentypen & Vergleiche' },
    { file: 'lesson-04.html', title: 'Entscheidungen mit if' },
    { file: 'lesson-05.html', title: 'Schleifen' },
    { file: 'lesson-06.html', title: 'Funktionen' },
    { file: 'lesson-07.html', title: 'Arrays (Listen)' },
    { file: 'lesson-08.html', title: 'Objekte' },
    { file: 'lesson-09.html', title: 'HTML-Grundlagen' },
    { file: 'lesson-10.html', title: 'JavaScript trifft HTML' },
    { file: 'lesson-11.html', title: 'Projekt: Zahlenraten' },
    { file: 'lesson-12.html', title: 'Projekt: Schere, Stein, Papier' },
    { file: 'lesson-13.html', title: 'Projekt: Quiz' },
  ];

  const MAX_LOOP_ITERATIONS = 5000000;
  const MAX_RUN_MS = 2000;
  const MAX_OUTPUT_LINES = 1000;
  const MAX_VISIBLE_LINES = 2000;
  const STORAGE_PREFIX = 'codeheft:';
  const INFINITE_LOOP = 'INFINITE_LOOP';
  const OUTPUT_LIMIT = 'OUTPUT_LIMIT';

  /* ---------- Storage (may be unavailable, e.g. private mode) ---------- */
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
    },
    remove(key) {
      try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* ignore */ }
    },
  };

  const currentPage = () => location.pathname.split('/').pop() || 'index.html';

  /* ---------- Value formatting, similar to browser dev tools ----------
   * Must not use closures: it is copied via toString() into the playground iframe. */
  function formatValue(value, depth, seen, raw) {
    depth = depth || 0;
    seen = seen || [];
    var type = typeof value;
    if (value === null) return 'null';
    if (type === 'undefined') return 'undefined';
    if (type === 'string') return raw && depth === 0 ? value : JSON.stringify(value);
    if (type === 'number' || type === 'boolean') return String(value);
    if (type === 'bigint') return String(value) + 'n';
    if (type === 'symbol') return value.toString();
    if (type === 'function') {
      var source = Function.prototype.toString.call(value);
      if (source.indexOf('class') === 0) return 'class ' + (value.name || '');
      return 'ƒ ' + (value.name || 'anonym') + '()';
    }
    if (seen.indexOf(value) >= 0) return '[Kreisverweis]';
    var tag = Object.prototype.toString.call(value);
    try {
      if (value.nodeType === 1) {
        return '<' + value.tagName.toLowerCase() + (value.id ? ' id="' + value.id + '"' : '') + '>';
      }
      if (value.nodeType) return '#' + value.nodeName;
      if (value.window === value) return '[Fenster]';
    } catch (e) { /* fall through */ }
    if (tag === '[object Error]') return value.name + ': ' + value.message;
    if (tag === '[object Date]') return value.toLocaleString('de-DE');
    if (depth > 2) return Array.isArray(value) ? '[…]' : '{…}';
    seen = seen.concat([value]);
    if (Array.isArray(value)) {
      var items = [];
      for (var i = 0; i < Math.min(value.length, 100); i++) items.push(formatValue(value[i], depth + 1, seen));
      if (value.length > 100) items.push('… (' + (value.length - 100) + ' weitere)');
      return '[' + items.join(', ') + ']';
    }
    var keys = Object.keys(value);
    if (!keys.length) return '{}';
    var pairs = [];
    for (var j = 0; j < Math.min(keys.length, 40); j++) {
      var key = keys[j];
      var label = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      var content;
      try { content = formatValue(value[key], depth + 1, seen); } catch (e) { content = '?'; }
      pairs.push(label + ': ' + content);
    }
    if (keys.length > 40) pairs.push('…');
    return '{ ' + pairs.join(', ') + ' }';
  }

  /* ---------- Beginner-friendly explanations of error messages (Chrome, Firefox, Safari) ---------- */
  function explainError(name, message) {
    message = String(message || '');
    let m;
    if (message === INFINITE_LOOP) {
      return 'Deine Schleife lief über ' + MAX_LOOP_ITERATIONS.toLocaleString('de-DE') +
        ' Mal oder länger als ' + MAX_RUN_MS / 1000 + ' Sekunden – wahrscheinlich hört sie nie auf. ' +
        'Prüfe die Bedingung: Wird sie irgendwann false?';
    }
    if (message === OUTPUT_LIMIT) {
      return 'Dein Programm wollte mehr als ' + MAX_OUTPUT_LINES.toLocaleString('de-DE') +
        ' Zeilen ausgeben. Ich habe abgebrochen, damit der Browser nicht hängen bleibt. ' +
        'Steckt console.log in einer Schleife, die nie aufhört?';
    }
    if ((m = message.match(/^'?(.+?)'? is not defined$/)) || (m = message.match(/^Can't find variable: (.+)$/))) {
      return `JavaScript kennt „${m[1]}“ nicht. Tippfehler? Groß-/Kleinschreibung beachtet? ` +
        `Wenn es ein Text sein soll, brauchst du Anführungszeichen: "${m[1]}".`;
    }
    if ((m = message.match(/Identifier '(.+)' has already been declared/)) ||
        (m = message.match(/redeclaration of (?:let|const|class) (.+)/)) ||
        (m = message.match(/Cannot declare a (?:let|const) variable twice: '(.+)'/))) {
      return `„${m[1]}“ gibt es schon. Um den Wert zu ändern, lass das let weg: ${m[1]} = …  ` +
        '(Oder klick auf „Neu starten“.)';
    }
    if (/Assignment to constant variable|invalid assignment to const|Attempted to assign to readonly/.test(message)) {
      return 'Eine const-Variable kann man nicht mehr ändern. Nimm let, wenn sich der Wert ändern soll.';
    }
    if ((m = message.match(/^(.+?) is not a function/))) {
      return `„${m[1]}“ ist keine Funktion – die runden Klammern () gehen nur bei Funktionen. Tippfehler im Namen?`;
    }
    if ((m = message.match(/Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(.+)'\))?/)) ||
        (m = message.match(/^(?:.+ )?is (undefined|null)$/))) {
      return `Du willst etwas aus ${m[1]} herausholen${m[2] ? ` (nämlich „${m[2]}“)` : ''}. ` +
        'Der Wert davor ist leer – gibt es die Variable oder das HTML-Element wirklich?';
    }
    if (/Cannot set propert/.test(message)) {
      return 'Du willst etwas in einen leeren Wert (undefined/null) schreiben. Hat querySelector das Element gefunden?';
    }
    if (/missing \) after argument list|expected '\)'|Expected '\)'/.test(message)) {
      return 'Hier fehlt eine schließende Klammer ) – oder ein Komma zwischen zwei Werten.';
    }
    if (/Unexpected end of input|end of script|Unexpected EOF/i.test(message)) {
      return 'Der Code hört mittendrin auf. Meistens fehlt eine schließende Klammer } oder ).';
    }
    if (/Invalid or unexpected token|unterminated string|Unterminated string|Unexpected token '?ILLEGAL/.test(message)) {
      return 'Hier stimmt etwas mit den Zeichen nicht. Oft fehlt ein Anführungszeichen am Ende eines Textes.';
    }
    if ((m = message.match(/Unexpected token '?([^']+)'?/)) || (m = message.match(/unexpected token: '?([^']+)'?/))) {
      return `Das Zeichen „${m[1]}“ steht an einer Stelle, wo JavaScript es nicht erwartet. ` +
        'Prüfe die Zeile auf vergessene Klammern, Kommas oder Anführungszeichen.';
    }
    if (/Unexpected identifier|unexpected identifier/.test(message)) {
      return 'Zwei Wörter stehen direkt nebeneinander. Fehlt ein Operator (+), ein Komma oder ein Anführungszeichen?';
    }
    if (/Invalid left-hand side in assignment|invalid assignment left-hand side/.test(message)) {
      return 'Links vom = muss eine Variable stehen. Wolltest du vergleichen? Dann nimm === statt =.';
    }
    if (/Maximum call stack size exceeded|too much recursion/.test(message)) {
      return 'Eine Funktion ruft sich immer wieder selbst auf und hört nie auf.';
    }
    if (name === 'SyntaxError') {
      return 'JavaScript versteht den Satzbau nicht. Prüfe Klammern und Anführungszeichen.';
    }
    return null;
  }

  /* ---------- Run guard: keeps runaway learner code from freezing the tab ----------
   * Every loop condition is wrapped as `__loopGuard() && (condition)`. Unlike inserting a call
   * into the loop body, this also covers loops without braces such as `while (x) i++;` or `for (;;);`.
   * Console output is limited separately, because a loop that logs on every pass floods the page
   * with DOM nodes (or postMessage calls) long before the iteration limit is reached. */
  const skipString = (code, i) => {
    const quote = code[i];
    i++;
    while (i < code.length && code[i] !== quote) { if (code[i] === '\\') i++; i++; }
    return i;
  };

  function findClosingParen(code, start) {
    let depth = 0;
    for (let i = start; i < code.length; i++) {
      const c = code[i];
      if (c === '"' || c === "'" || c === '`') { i = skipString(code, i); continue; }
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) return i;
    }
    return -1;
  }

  // Splits a for-header like "let i = 0; i < 3; i++" at semicolons that are not nested in brackets or strings.
  function splitForHeader(header) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < header.length; i++) {
      const c = header[i];
      if (c === '"' || c === "'" || c === '`') { i = skipString(header, i); continue; }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ';' && depth === 0) { parts.push(header.slice(start, i)); start = i + 1; }
    }
    parts.push(header.slice(start));
    return parts;
  }

  // Keeps the condition's whitespace (including line breaks) so error line numbers stay correct.
  const guardCondition = (condition) => `__loopGuard() && (${condition.trim() ? guardLoops(condition) : 'true'})`;

  function guardLoops(code) {
    const n = code.length;
    let out = '';
    let i = 0;
    const skipSpace = (k) => { while (k < n && /\s/.test(code[k])) k++; return k; };

    while (i < n) {
      const c = code[i];
      if (c === '/' && code[i + 1] === '/') {
        const nl = code.indexOf('\n', i);
        const end = nl < 0 ? n : nl;
        out += code.slice(i, end); i = end; continue;
      }
      if (c === '/' && code[i + 1] === '*') {
        const close = code.indexOf('*/', i + 2);
        const end = close < 0 ? n : close + 2;
        out += code.slice(i, end); i = end; continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        const end = skipString(code, i);
        out += code.slice(i, end + 1); i = end + 1; continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < n && /[\w$]/.test(code[j])) j++;
        const word = code.slice(i, j);
        const isKeywordPosition = !/[\w$.]/.test(code[i - 1] || '');
        const open = skipSpace(j);
        const close = isKeywordPosition && (word === 'for' || word === 'while') && code[open] === '('
          ? findClosingParen(code, open) : -1;
        if (close > 0) {
          const header = code.slice(open + 1, close);
          // Line breaks inside the header are kept, so error line numbers stay correct.
          if (word === 'while') {
            out += `while (${guardCondition(header)})`;
            i = close + 1; continue;
          }
          const parts = splitForHeader(header);
          if (parts.length === 3) {
            out += `for (${guardLoops(parts[0])};${guardCondition(parts[1])};${guardLoops(parts[2])})`;
            i = close + 1; continue;
          }
          // for…of / for…in: no condition to wrap, so guard the body if it has braces.
          const brace = skipSpace(close + 1);
          if (code[brace] === '{') {
            out += code.slice(i, brace + 1) + '__loopGuard();';
            i = brace + 1; continue;
          }
        }
        out += word; i = j; continue;
      }
      out += c; i++;
    }
    return out;
  }

  // Kept as source text so it can also run inside the playground iframe.
  // Counters reset on the next macrotask, so the limits apply per synchronous run.
  const RUN_GUARD_SOURCE = `(function(){var loops=0,outputs=0,start=0,scheduled=false;` +
    `function begin(){if(!scheduled){scheduled=true;start=Date.now();setTimeout(function(){loops=0;outputs=0;scheduled=false;},0);}}` +
    `window.__loopGuard=function(){begin();` +
    `if(++loops>${MAX_LOOP_ITERATIONS}||(loops%1024===0&&Date.now()-start>${MAX_RUN_MS}))throw new Error('${INFINITE_LOOP}');return true;};` +
    `window.__outputGuard=function(){begin();if(++outputs>${MAX_OUTPUT_LINES})throw new Error('${OUTPUT_LIMIT}');};})();`;

  // Turns anything thrown into { name, message } and strips DOM wrapper text learners would not understand.
  function normalizeError(thrown) {
    const isObject = thrown && typeof thrown === 'object';
    const message = String(isObject && thrown.message !== undefined ? thrown.message : thrown);
    return {
      name: (isObject && thrown.name) || 'Error',
      message: message.replace(/^Failed to execute '\w+' on '\w+': /, ''),
    };
  }

  /* ---------- Sandbox: hidden same-origin iframe that executes learner code ---------- */
  class Sandbox {
    constructor(onOutput) {
      this.onOutput = onOutput;
      this.reset();
    }

    reset() {
      this.frame?.remove();
      const frame = document.createElement('iframe');
      frame.hidden = true;
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(frame);
      this.frame = frame;
      this.win = frame.contentWindow;
      this.syncError = null;
      this.running = false;

      const win = this.win;
      win.eval(RUN_GUARD_SOURCE);
      const forward = (kind) => (...args) => {
        win.__outputGuard();
        this.onOutput(kind, args.map((arg) => formatValue(arg, 0, [], true)).join(' '));
      };
      win.console = {
        log: forward('log'), info: forward('log'), debug: forward('log'), table: forward('log'),
        warn: forward('warn'), error: forward('error'),
        clear: () => this.onOutput('clear'),
      };
      // Dialogs from a hidden iframe can be suppressed by browsers, so route them to the top window.
      win.alert = (text) => window.alert(text === undefined ? '' : String(text));
      win.prompt = (text, initial) => window.prompt(text === undefined ? '' : String(text), initial);
      win.confirm = (text) => window.confirm(text === undefined ? '' : String(text));

      win.addEventListener('error', (event) => {
        event.preventDefault();
        const error = normalizeError(event.error !== undefined ? event.error : event.message);
        error.line = event.lineno;
        if (this.running) this.syncError = error;
        else this.onOutput('error-object', error);
      });
      win.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        this.onOutput('error-object', normalizeError(event.reason));
      });
    }

    // Programs run as a classic <script>: top-level let/const persist and line numbers stay correct.
    runScript(code) {
      this.syncError = null;
      this.running = true;
      const script = this.win.document.createElement('script');
      script.textContent = guardLoops(code);
      try {
        this.win.document.documentElement.appendChild(script);
      } catch (error) {
        // Chrome throws some parse errors (e.g. redeclared let) from appendChild instead of firing "error".
        this.syncError = this.syncError || normalizeError(error);
      }
      script.remove();
      this.running = false;
      return { error: this.syncError };
    }

    // Console input: expressions return a value; declarations must run as script to persist.
    runInput(code) {
      if (/(^|[;{}\n])\s*(let|const|class)\s/.test(code)) {
        return { ...this.runScript(code), isDeclaration: true };
      }
      try {
        // Calling win.eval from outside is an indirect eval, so it runs in the iframe's global scope.
        const value = this.win.eval(guardLoops(code));
        return { value, hasValue: true };
      } catch (error) {
        return { error: normalizeError(error) };
      }
    }

    evaluate(expression) {
      try { return this.win.eval(expression); } catch { return undefined; }
    }

    destroy() {
      this.frame?.remove();
      this.frame = null;
    }
  }

  /* ---------- DOM helpers ---------- */
  const h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value !== false && value !== undefined) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children) if (child) node.append(child);
    return node;
  };

  function renderError(error, showLine) {
    const name = error.name || 'Error';
    const message = error.message === undefined ? String(error) : error.message;
    const title = message === INFINITE_LOOP ? 'Abgebrochen: Endlosschleife'
      : message === OUTPUT_LIMIT ? 'Abgebrochen: zu viele Ausgaben'
      : `${name}: ${message}`;
    // Guard aborts are thrown from the guard's own code, so their line number would point there.
    const isGuardAbort = message === INFINITE_LOOP || message === OUTPUT_LIMIT;
    const lineLabel = isGuardAbort ? '' : error.lineLabel || (error.line ? `Zeile ${error.line}` : '');
    const line = showLine && lineLabel ? `  (${lineLabel})` : '';
    const row = h('div', { class: 'line error' }, h('span', { class: 'error-title', text: title + line }));
    const explanation = explainError(name, message);
    if (explanation) row.append(h('span', { class: 'margin-note', text: explanation }));
    return row;
  }

  function appendOutput(container, kind, content, showLine) {
    if (kind === 'clear') { container.textContent = ''; return; }
    if (kind === 'error-object') container.append(renderError(content, showLine));
    else if (kind === 'input') container.append(highlightInto(h('div', { class: 'line input' }), content, 'javascript'));
    else container.append(h('div', { class: `line ${kind}`, text: content }));
    while (container.childElementCount > MAX_VISIBLE_LINES) container.firstElementChild.remove();
    scrollToEnd(container);
  }

  // Scrolling forces a layout, so do it at most once per frame instead of once per line.
  const pendingScrolls = new WeakSet();
  function scrollToEnd(container) {
    if (pendingScrolls.has(container)) return;
    pendingScrolls.add(container);
    requestAnimationFrame(() => {
      pendingScrolls.delete(container);
      container.scrollTop = container.scrollHeight;
    });
  }

  /* ---------- Code editing: CodeMirror when available, plain textarea as fallback ---------- */
  const MODES = { html: 'htmlmixed', css: 'css', js: 'javascript', javascript: 'javascript' };

  function highlightInto(node, text, mode) {
    if (window.CodeMirror?.runMode) {
      window.CodeMirror.runMode(text, mode, node);
      node.classList.add('cm-s-default');
    } else {
      node.textContent = text;
    }
    return node;
  }

  function highlightStaticCode(root) {
    for (const code of root.querySelectorAll('pre > code')) {
      const text = code.textContent;
      const lang = code.parentElement.dataset.lang || (text.trimStart().startsWith('<') ? 'html' : 'js');
      code.textContent = '';
      highlightInto(code, text, MODES[lang]);
      code.classList.add('highlighted');
    }
  }

  // Returns a small uniform API so components don't care which implementation is active.
  function createCodeEditor(parent, { value, lang, label, placeholder, autoHeight, onChange, onRun }) {
    const CM = window.CodeMirror;
    if (CM) {
      // Escape releases Tab so keyboard users can leave the editor (no keyboard trap).
      let tabReleased = false;
      const cm = CM(parent, {
        value,
        mode: MODES[lang],
        lineNumbers: true,
        tabSize: 2,
        indentUnit: 2,
        indentWithTabs: false,
        matchBrackets: true,
        placeholder: placeholder || '',
        screenReaderLabel: label,
        viewportMargin: autoHeight ? Infinity : 10,
        extraKeys: {
          Tab: (editor) => {
            if (tabReleased) return CM.Pass;
            if (editor.somethingSelected()) editor.indentSelection('add');
            else editor.replaceSelection('  ', 'end');
          },
          'Shift-Tab': (editor) => editor.indentSelection('subtract'),
          Esc: () => { tabReleased = true; },
          'Ctrl-Enter': () => onRun?.(),
          'Cmd-Enter': () => onRun?.(),
          'Ctrl-/': 'toggleComment',
          'Cmd-/': 'toggleComment',
        },
      });
      cm.on('keydown', (_, event) => {
        if (event.key !== 'Escape' && event.key !== 'Tab') tabReleased = false;
      });
      cm.on('change', () => onChange?.());
      return {
        getValue: () => cm.getValue(),
        setValue: (text) => cm.setValue(text),
        focus: () => cm.focus(),
        refresh: () => cm.refresh(),
      };
    }

    const textarea = h('textarea', {
      class: 'fallback-editor', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off',
      'aria-label': label, placeholder: placeholder || '',
    });
    textarea.value = value;
    parent.append(textarea);
    const resize = () => { if (autoHeight) autoGrow(textarea); };
    textarea.addEventListener('input', () => { resize(); onChange?.(); });
    enableCodeKeys(textarea, () => onRun?.());
    requestAnimationFrame(resize);
    return {
      getValue: () => textarea.value,
      setValue: (text) => { textarea.value = text; resize(); },
      focus: () => textarea.focus(),
      refresh: resize,
    };
  }

  const isLogKind = (kind) => kind === 'log' || kind === 'warn' || kind === 'error';

  const autoGrow = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Tab inserts spaces, Enter keeps indentation, Ctrl/Cmd+Enter runs.
  // Escape releases the Tab key so keyboard users can leave the field.
  function enableCodeKeys(textarea, onRun) {
    let tabReleased = false;
    const insert = (text) => {
      textarea.focus();
      // execCommand keeps the browser's undo history intact.
      if (!document.execCommand || !document.execCommand('insertText', false, text)) {
        textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
        textarea.dispatchEvent(new Event('input'));
      }
    };
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { tabReleased = true; return; }
      if (event.key === 'Tab' && !tabReleased && !event.shiftKey) { event.preventDefault(); insert('  '); return; }
      if (event.key !== 'Tab') tabReleased = false;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onRun(); return; }
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        const before = textarea.value.slice(0, textarea.selectionStart);
        const currentLine = before.slice(before.lastIndexOf('\n') + 1);
        let indent = currentLine.match(/^\s*/)[0];
        if (/[{([]\s*$/.test(currentLine)) indent += '  ';
        event.preventDefault();
        insert('\n' + indent);
      }
    });
  }

  const trimTemplate = (text) => text.replace(/^\n/, '').replace(/\s+$/, '') + '\n';

  function readTemplate(host) {
    const source = host.querySelector('textarea');
    return trimTemplate(source ? source.value : host.textContent);
  }

  /* ---------- Progress ---------- */
  const progress = {
    all() { return storage.get('progress', {}); },
    has(id) { return !!this.all()[id]; },
    set(id, done) {
      const state = this.all();
      if (done) state[id] = true;
      else delete state[id];
      storage.set('progress', state);
      document.dispatchEvent(new CustomEvent('progresschange'));
    },
  };

  /* ---------- Exercise checks, registered per page via Course.check() ---------- */
  const checks = {};

  /* ========== <js-console> ========== */
  class JsConsole extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      const examples = [...this.querySelectorAll('code')].map((code) => code.textContent);
      this.textContent = '';
      this.history = [];
      this.historyIndex = 0;

      this.output = h('div', { class: 'console-output', role: 'log', 'aria-live': 'polite' });
      this.input = h('textarea', {
        rows: 1, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
        'aria-label': 'JavaScript-Befehl eingeben, mit Enter ausführen',
        placeholder: 'Befehl eingeben und Enter drücken …',
      });
      const header = h('div', { class: 'board-header' },
        h('span', { class: 'board-title', text: 'Konsole' }),
        h('span', { class: 'board-actions' },
          h('button', { type: 'button', text: 'Leeren', onclick: () => this.clear() }),
          h('button', { type: 'button', text: 'Neu starten', title: 'Vergisst alle Variablen', onclick: () => this.restart() })));

      const board = h('div', { class: 'board console' }, header, this.output,
        h('label', { class: 'console-input' },
          h('span', { class: 'prompt', 'aria-hidden': 'true', text: '›' }), this.input));
      board.addEventListener('click', (event) => {
        if (event.target === board || event.target === this.output) this.input.focus();
      });
      this.append(board);

      if (examples.length) {
        const bar = h('div', { class: 'examples' }, h('span', { text: 'Probier mal:' }));
        for (const example of examples) {
          bar.append(h('button', {
            type: 'button', class: 'example', title: 'In die Konsole übernehmen',
            onclick: () => { this.input.value = example; autoGrow(this.input); this.input.focus(); },
          }, h('code', { text: example })));
        }
        this.append(bar);
      }

      this.input.addEventListener('input', () => autoGrow(this.input));
      this.input.addEventListener('keydown', (event) => this.handleKey(event));
      this.sandbox = new Sandbox((kind, content) => this.print(kind, content));
    }

    disconnectedCallback() { this.sandbox?.destroy(); }

    handleKey(event) {
      const input = this.input;
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.execute(input.value);
        return;
      }
      const onFirstLine = !input.value.slice(0, input.selectionStart).includes('\n');
      const onLastLine = !input.value.slice(input.selectionEnd).includes('\n');
      if (event.key === 'ArrowUp' && onFirstLine && this.historyIndex > 0) {
        event.preventDefault();
        this.historyIndex--;
        input.value = this.history[this.historyIndex];
        autoGrow(input);
      } else if (event.key === 'ArrowDown' && onLastLine && this.historyIndex < this.history.length) {
        event.preventDefault();
        this.historyIndex++;
        input.value = this.history[this.historyIndex] ?? '';
        autoGrow(input);
      }
    }

    execute(code) {
      if (!code.trim()) return;
      this.history.push(code);
      this.historyIndex = this.history.length;
      this.input.value = '';
      autoGrow(this.input);
      this.print('input', code);
      this.logCount = 0;
      const result = this.sandbox.runInput(code);
      if (result.error) this.print('error-object', result.error);
      // Like dev tools, but hide the confusing "undefined" after console.log().
      else if (result.hasValue && !(result.value === undefined && this.logCount)) {
        this.print('result', formatValue(result.value));
      }
    }

    print(kind, content) {
      if (isLogKind(kind)) this.logCount++;
      appendOutput(this.output, kind, content, false);
    }

    clear() {
      this.output.textContent = '';
      this.input.focus();
    }

    restart() {
      this.sandbox.reset();
      this.output.textContent = '';
      this.print('info', 'Neu gestartet – alle Variablen sind vergessen.');
      this.input.focus();
    }
  }

  /* ========== <js-editor> ========== */
  let editorCount = 0;

  class JsEditor extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.template = readTemplate(this);
      this.checkName = this.getAttribute('check');
      this.storageId = this.getAttribute('name') || this.checkName || `${currentPage()}#${editorCount++}`;
      this.textContent = '';

      this.output = h('div', { class: 'editor-output', role: 'log', 'aria-live': 'polite' });
      this.feedback = h('div', { class: 'check-result', 'aria-live': 'polite' });
      const area = h('div', { class: 'editor-area' });

      const runLabel = this.checkName ? 'Ausführen & prüfen' : 'Ausführen';
      const header = h('div', { class: 'board-header' },
        h('span', { class: 'board-title', text: this.getAttribute('label') || 'Programm' }),
        h('span', { class: 'board-actions' },
          h('button', { type: 'button', text: 'Zurücksetzen', title: 'Stellt den ursprünglichen Code wieder her', onclick: () => this.restoreTemplate() }),
          h('button', { type: 'button', class: 'primary', text: runLabel, onclick: () => this.run() })));

      this.append(h('div', { class: 'board editor' }, header, area, this.output), this.feedback);

      this.editor = createCodeEditor(area, {
        value: storage.get('code:' + this.storageId, this.template),
        lang: 'js',
        label: 'JavaScript-Editor. Strg+Enter führt aus. Escape, dann Tab verlässt das Feld.',
        autoHeight: true,
        onChange: () => storage.set('code:' + this.storageId, this.editor.getValue()),
        onRun: () => this.run(),
      });

      if (this.checkName && progress.has('exercise:' + this.storageId)) {
        this.showSuccess('Schon gelöst. Du kannst trotzdem weiter experimentieren.');
      } else {
        this.output.append(h('div', { class: 'line info', text: `Klick auf „${runLabel}“ oder drück Strg+Enter.` }));
      }
    }

    disconnectedCallback() { this.lastSandbox?.destroy(); }

    restoreTemplate() {
      if (this.editor.getValue() !== this.template && !confirm('Deinen Code durch die ursprüngliche Vorlage ersetzen?')) return;
      this.editor.setValue(this.template);
      storage.remove('code:' + this.storageId);
      this.output.textContent = '';
    }

    // Each run gets a fresh sandbox so re-running never trips over "already declared".
    execute(code, onOutput) {
      const logs = [];
      const sandbox = new Sandbox((kind, content) => {
        if (isLogKind(kind)) logs.push(content);
        onOutput?.(kind, content);
      });
      const { error } = sandbox.runScript(code);
      return { logs, error, sandbox };
    }

    run() {
      const code = this.editor.getValue();
      this.output.textContent = '';
      this.feedback.textContent = '';
      this.feedback.className = 'check-result';
      this.lastSandbox?.destroy();

      const result = this.execute(code, (kind, content) => appendOutput(this.output, kind, content, true));
      this.lastSandbox = result.sandbox;
      if (result.error) appendOutput(this.output, 'error-object', result.error, true);
      else if (!result.logs.length) {
        appendOutput(this.output, 'info', 'Fertig – aber es gab keine Ausgabe. (console.log vergessen?)');
      }

      const check = this.checkName && checks[this.checkName];
      if (!check) return;
      if (result.error) { this.showHint('Erst den Fehler beheben, dann kann ich prüfen.'); return; }

      const api = {
        code,
        logs: result.logs,
        output: result.logs.join('\n'),
        value: (expression) => result.sandbox.evaluate(expression),
        type: (name) => result.sandbox.evaluate('typeof ' + name),
        // Returns the source with the initial value of a declared variable swapped, or null if not found.
        // Pass a previous result as `source` to chain several replacements.
        replaceValue: (name, newValue, source = code) => {
          if (source === null) return null;
          const declaration = new RegExp(`((?:let|const|var)\\s+${name}\\s*=\\s*)[^;\\n]+`);
          return declaration.test(source) ? source.replace(declaration, `$1${JSON.stringify(newValue)}`) : null;
        },
        run: (otherCode) => {
          const other = this.execute(otherCode);
          other.sandbox.destroy();
          return { logs: other.logs, output: other.logs.join('\n'), error: other.error };
        },
      };

      let verdict;
      try {
        verdict = check(api);
      } catch (error) {
        verdict = error && (error.message === INFINITE_LOOP || error.message === OUTPUT_LIMIT)
          ? 'Beim Testen ist eine Endlosschleife passiert.'
          : 'Beim Testen ist ein Fehler aufgetreten: ' + (error && error.message ? error.message : error);
      }
      if (verdict === true) {
        progress.set('exercise:' + this.storageId, true);
        this.showSuccess(this.getAttribute('success') || 'Geschafft! Die Aufgabe ist gelöst.');
      } else {
        this.showHint(verdict || 'Noch nicht ganz.');
      }
    }

    showSuccess(text) {
      this.feedback.className = 'check-result success';
      this.feedback.textContent = text;
    }

    showHint(text) {
      this.feedback.className = 'check-result hint';
      this.feedback.textContent = text;
    }
  }

  /* ========== <html-playground> ========== */
  let playgroundCount = 0;

  const PLAYGROUND_PANES = [
    { lang: 'html', title: 'HTML', placeholder: 'HTML hier … (nur der Inhalt von <body>)' },
    { lang: 'css', title: 'CSS', placeholder: 'CSS hier …' },
    { lang: 'js', title: 'JS', placeholder: 'JavaScript hier …' },
  ];

  // Injected into the preview: guards loops and forwards console output and errors to the parent page.
  const previewBridge = (channel) => `<script>${RUN_GUARD_SOURCE}(function(){var formatValue=${formatValue.toString()};` +
    `function send(kind,content){parent.postMessage({channel:${JSON.stringify(channel)},kind:kind,content:content},'*');}` +
    `function forward(kind){return function(){window.__outputGuard();var parts=[];for(var i=0;i<arguments.length;i++)parts.push(formatValue(arguments[i],0,[],true));send(kind,parts.join(' '));};}` +
    `console.log=forward('log');console.info=forward('log');console.warn=forward('warn');console.error=forward('error');` +
    `window.addEventListener('error',function(e){var x=e.error;send('error-object',{name:x&&x.name||'Error',message:x&&x.message!==undefined?x.message:e.message,line:e.lineno});});` +
    `})();<\/script>`;

  const guardInlineScripts = (html) => html.replace(
    /(<script\b(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_, open, body, close) => open + guardLoops(body) + close);

  // Like CodePen: separate HTML (body content), CSS and JS panes, combined into one document.
  class HtmlPlayground extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.template = { html: '', css: '', js: '' };
      for (const source of this.querySelectorAll('textarea')) {
        this.template[source.dataset.lang || 'html'] = trimTemplate(source.value);
      }
      this.storageId = this.getAttribute('name') || `${currentPage()}#html${playgroundCount}`;
      this.channel = 'playground-' + playgroundCount++;
      this.textContent = '';
      const saved = storage.get('code:' + this.storageId, null);
      const initial = saved && typeof saved === 'object' ? { ...this.template, ...saved } : this.template;

      this.preview = h('iframe', { title: 'Vorschau', sandbox: 'allow-scripts allow-modals allow-forms' });
      const height = this.getAttribute('height');
      if (height) this.preview.style.height = height + 'px';
      this.consoleOutput = h('div', { class: 'editor-output', role: 'log', 'aria-live': 'polite' });

      const tabs = h('div', { class: 'playground-tabs', role: 'tablist', 'aria-label': 'Code-Bereich wählen' });
      this.editorsBox = h('div', { class: 'playground-editors' });
      const editorHeight = this.getAttribute('editor-height');
      if (editorHeight) this.editorsBox.style.height = editorHeight + 'px';
      this.editors = {};

      let debounce;
      const onChange = () => {
        storage.set('code:' + this.storageId, this.values());
        clearTimeout(debounce);
        debounce = setTimeout(() => this.render(), 700);
      };

      // Start on the first pane that has content, so learners see the interesting part on small screens.
      const firstFilled = PLAYGROUND_PANES.find((pane) => initial[pane.lang].trim()) || PLAYGROUND_PANES[0];
      for (const pane of PLAYGROUND_PANES) {
        const tab = h('button', {
          type: 'button', role: 'tab', class: `tab-${pane.lang}`, text: pane.title,
          onclick: () => this.showPane(pane.lang),
        });
        tabs.append(tab);
        const host = h('div', { class: 'playground-editor' });
        this.editorsBox.append(h('section', { class: `playground-pane pane-${pane.lang}`, 'data-lang': pane.lang },
          h('div', { class: 'pane-title' }, h('span', { class: `pane-badge badge-${pane.lang}`, text: pane.title })),
          host));
        this.editors[pane.lang] = createCodeEditor(host, {
          value: initial[pane.lang],
          lang: pane.lang,
          label: `${pane.title}-Editor. Strg+Enter lädt die Vorschau neu. Escape, dann Tab verlässt das Feld.`,
          placeholder: pane.placeholder,
          onChange,
          onRun: () => this.render(),
        });
      }
      this.tabs = tabs;

      const header = h('div', { class: 'board-header' },
        h('span', { class: 'board-title', text: this.getAttribute('label') || 'Spielwiese' }),
        h('span', { class: 'board-actions' },
          h('button', { type: 'button', text: 'Zurücksetzen', title: 'Stellt den ursprünglichen Code wieder her', onclick: () => this.restoreTemplate() }),
          h('button', { type: 'button', text: 'Als Datei speichern', title: 'Lädt alles als eine komplette HTML-Datei herunter', onclick: () => this.download() }),
          h('button', { type: 'button', text: 'Im neuen Tab', title: 'Seite groß in einem eigenen Tab öffnen', onclick: () => this.openInTab() }),
          this.fullscreenButton = h('button', { type: 'button', 'aria-pressed': 'false', title: 'Spielwiese auf das ganze Fenster vergrößern (Escape beendet)', onclick: () => this.toggleFullscreen() }),
          h('button', { type: 'button', class: 'primary', text: 'Ausführen', onclick: () => this.render() })));

      this.board = h('div', { class: 'board playground' });
      this.append(this.board);
      this.board.append(header, tabs, this.editorsBox,
        h('div', { class: 'playground-result' }, h('div', { class: 'pane-title', text: 'Vorschau' }), this.preview),
        h('div', { class: 'playground-console' }, h('div', { class: 'pane-title', text: 'Konsole' }), this.consoleOutput));
      this.setFullscreen(false);

      this.handleKeydown = (event) => {
        if (event.key === 'Escape' && this.board.classList.contains('is-fullscreen')) this.setFullscreen(false);
      };
      document.addEventListener('keydown', this.handleKeydown);

      this.showPane(firstFilled.lang);
      // CodeMirror measures its size; re-measure whenever the pane area changes
      // (first layout, tab switch, container query breakpoint, dragging the resize handle).
      this.resizeObserver = new ResizeObserver(() => {
        for (const editor of Object.values(this.editors)) editor.refresh();
      });
      this.resizeObserver.observe(this.editorsBox);

      this.handleMessage = (event) => {
        if (event.source !== this.preview.contentWindow || event.data?.channel !== this.channel) return;
        let content = event.data.content;
        if (event.data.kind === 'error-object' && content.line >= this.jsStartLine) {
          content = { ...content, lineLabel: `JS-Zeile ${content.line - this.jsStartLine + 1}` };
        } else if (event.data.kind === 'error-object') {
          content = { ...content, line: undefined };
        }
        appendOutput(this.consoleOutput, event.data.kind, content, true);
      };
      window.addEventListener('message', this.handleMessage);
      this.render();
    }

    disconnectedCallback() {
      window.removeEventListener('message', this.handleMessage);
      document.removeEventListener('keydown', this.handleKeydown);
      this.resizeObserver?.disconnect();
      this.setFullscreen(false);
    }

    toggleFullscreen() {
      this.setFullscreen(!this.board.classList.contains('is-fullscreen'));
    }

    // An in-page overlay rather than the Fullscreen API: works everywhere and keeps dialogs (alert/prompt) usable.
    setFullscreen(on) {
      this.board.classList.toggle('is-fullscreen', on);
      document.documentElement.classList.toggle('playground-fullscreen', on);
      this.fullscreenButton.textContent = on ? 'Vollbild beenden' : 'Vollbild';
      this.fullscreenButton.setAttribute('aria-pressed', String(on));
    }

    showPane(lang) {
      this.editorsBox.dataset.active = lang;
      for (const tab of this.tabs.children) {
        tab.setAttribute('aria-selected', String(tab.classList.contains(`tab-${lang}`)));
      }
      this.editors[lang].refresh();
    }

    values() {
      return Object.fromEntries(Object.entries(this.editors).map(([lang, editor]) => [lang, editor.getValue()]));
    }

    // mode: 'preview' (guard + console bridge), 'tab' (guard only) or 'file' (exactly the learner's code).
    buildDocument(mode) {
      const { html, css, js } = this.values();
      const guarded = mode !== 'file';
      const injected = mode === 'preview' ? previewBridge(this.channel)
        : mode === 'tab' ? `<script>${RUN_GUARD_SOURCE}<\/script>` : '';
      const head = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Meine Seite</title>',
        injected,
        css.trim() ? `<style>\n${css.trimEnd()}\n</style>` : '',
      ].filter(Boolean).map((line) => '  ' + line).join('\n');
      const before = `<!doctype html>\n<html lang="de">\n<head>\n${head}\n</head>\n<body>\n` +
        (guarded ? guardInlineScripts(html) : html).trimEnd() + '\n';
      // The JS pane goes last in <body>, so every element already exists when it runs.
      this.jsStartLine = before.split('\n').length + 1;
      const script = js.trim() ? `<script>\n${guarded ? guardLoops(js) : js}\n<\/script>\n` : '';
      return before + script + '</body>\n</html>\n';
    }

    render() {
      this.consoleOutput.textContent = '';
      this.preview.srcdoc = this.buildDocument('preview');
    }

    openInTab() {
      const url = URL.createObjectURL(new Blob([this.buildDocument('tab')], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    download() {
      const url = URL.createObjectURL(new Blob([this.buildDocument('file')], { type: 'text/html' }));
      const link = h('a', { href: url, download: (this.getAttribute('file-name') || 'meine-seite') + '.html' });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    restoreTemplate() {
      const current = this.values();
      const changed = Object.keys(this.template).some((lang) => current[lang] !== this.template[lang]);
      if (changed && !confirm('Deinen Code durch die ursprüngliche Vorlage ersetzen?')) return;
      for (const [lang, editor] of Object.entries(this.editors)) editor.setValue(this.template[lang]);
      storage.remove('code:' + this.storageId);
      this.render();
    }
  }

  /* ---------- Page frame: sidebar navigation, lesson completion, prev/next ---------- */
  function buildFrame() {
    const page = currentPage();
    const index = LESSONS.findIndex((lesson) => lesson.file === page);
    const lessonId = (lesson) => 'lesson:' + lesson.file;

    const list = h('ol', { class: 'toc', start: '0' });
    LESSONS.forEach((lesson, i) => {
      const link = h('a', { href: lesson.file },
        h('span', { class: 'toc-number', text: String(i) }),
        h('span', { class: 'toc-title', text: lesson.title }));
      if (i === index) link.setAttribute('aria-current', 'page');
      list.append(h('li', {}, link));
    });

    const status = h('p', { class: 'toc-status' });
    const refreshStatus = () => {
      const done = LESSONS.filter((lesson) => progress.has(lessonId(lesson))).length;
      status.textContent = `${done} von ${LESSONS.length} Lektionen erledigt`;
      list.querySelectorAll('a').forEach((link, i) => link.classList.toggle('done', progress.has(lessonId(LESSONS[i]))));
    };
    refreshStatus();
    document.addEventListener('progresschange', refreshStatus);

    const toggle = h('details', { class: 'toc-toggle' },
      h('summary', {},
        h('span', { text: 'Inhalt' }),
        h('span', { class: 'toc-current', text: index >= 0 ? `${index} · ${LESSONS[index].title}` : '' })),
      list, status);
    const nav = h('nav', { class: 'sidebar', 'aria-label': 'Lektionen' },
      h('a', { class: 'brand', href: 'index.html' },
        h('span', { class: 'brand-name', text: 'Code-Heft' }),
        h('span', { class: 'brand-tagline', text: 'JavaScript & HTML für Einsteiger' })),
      toggle);
    document.body.prepend(nav);

    const wide = matchMedia('(min-width: 900px)');
    const syncToggle = () => { toggle.open = wide.matches; };
    syncToggle();
    wide.addEventListener('change', syncToggle);

    const main = document.querySelector('main');
    if (!main || index < 0) return;

    const id = lessonId(LESSONS[index]);
    const completeButton = h('button', { type: 'button', class: 'complete' });
    const refreshButton = () => {
      const done = progress.has(id);
      completeButton.textContent = done ? '✓ Lektion erledigt' : 'Lektion als erledigt markieren';
      completeButton.setAttribute('aria-pressed', String(done));
    };
    completeButton.addEventListener('click', () => { progress.set(id, !progress.has(id)); refreshButton(); });
    refreshButton();

    const previous = LESSONS[index - 1];
    const next = LESSONS[index + 1];
    main.append(h('footer', { class: 'pager' },
      completeButton,
      h('div', { class: 'pager-links' },
        previous ? h('a', { href: previous.file, class: 'pager-prev' }, h('small', { text: 'Zurück' }), previous.title) : null,
        next ? h('a', { href: next.file, class: 'pager-next' }, h('small', { text: 'Weiter' }), next.title) : null)));
  }

  window.Course = {
    check(name, fn) { checks[name] = fn; },
    resetProgress() {
      if (!confirm('Wirklich deinen gesamten Fortschritt und alle gespeicherten Programme löschen?')) return;
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith(STORAGE_PREFIX))
          .forEach((key) => localStorage.removeItem(key));
      } catch { /* ignore */ }
      location.reload();
    },
  };

  /* ---------- Startup ---------- */
  // Resolved now: document.currentScript is only set while this file is executing.
  const VENDOR_URL = new URL('vendor/codemirror/', document.currentScript.src);
  const CODEMIRROR_FILES = [
    'codemirror.min.js',
    'mode/xml/xml.min.js',
    'mode/javascript/javascript.min.js',
    'mode/css/css.min.js',
    'mode/htmlmixed/htmlmixed.min.js',
    'addon/edit/matchbrackets.min.js',
    'addon/comment/comment.min.js',
    'addon/display/placeholder.min.js',
    'addon/runmode/runmode.min.js',
  ];

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });

  async function loadCodeMirror() {
    // Prepend so course.css (loaded later in <head>) wins over the library defaults.
    document.head.prepend(h('link', { rel: 'stylesheet', href: new URL('codemirror.min.css', VENDOR_URL).href }));
    try {
      for (const file of CODEMIRROR_FILES) await loadScript(new URL(file, VENDOR_URL).href);
    } catch {
      // Editors fall back to plain textareas.
    }
  }

  buildFrame();
  loadCodeMirror().then(() => {
    highlightStaticCode(document);
    customElements.define('js-console', JsConsole);
    customElements.define('js-editor', JsEditor);
    customElements.define('html-playground', HtmlPlayground);
  });
})();
