// App Studio — Host half.
// 1) Serves the target app statically under /__app_preview/ with an injected
//    editing overlay (same-origin with DSH so the overlay can touch the DOM).
// 2) Streams LLM source edits over SSE at /__app_apply_sse.
// 3) Starts the app at /__app_start (POST).
export const name = 'app-studio'
export const inject = ['webServer', 'fs']

const DEFAULT_APP_DIR = '/Users/wangzhaojin/work/dsh/ai-ppt-generator'

const OVERLAY_JS = `(function () {
  if (window.__astudioOverlay) return;
  window.__astudioOverlay = true;
  var enabled = false, selected = null, hoverEl = null, drag = null;
  var overlayChanges = {};
  function post(type, payload) {
    try { window.parent.postMessage({ __appStudio: true, type: type, payload: payload || {} }, '*'); } catch (e) {}
  }
  function uid() { return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function cssEscape(v) {
    if (window.CSS && CSS.escape) return CSS.escape(v);
    return String(v).replace(/[^a-zA-Z0-9_-]/g, function (c) { return String.fromCharCode(92) + c; });
  }
  function tagPath(el) {
    var parts = [], node = el;
    while (node && node !== document.body && parts.length < 4) {
      var parent = node.parentElement; if (!parent) break;
      var idx = 1;
      for (var s = node.previousElementSibling; s; s = s.previousElementSibling) idx++;
      parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + idx + ')');
      node = parent;
    }
    return 'body > ' + parts.join(' > ');
  }
  function isUnique(sel) { try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; } }
  function bestSelector(el) {
    if (el.id) { var s = '#' + cssEscape(el.id); if (isUnique(s)) return { selector: s, fragile: false }; }
    if (el.classList && el.classList.length) {
      var cls = [];
      for (var i = 0; i < el.classList.length; i++) if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(el.classList[i])) cls.push(el.classList[i]);
      if (cls.length) { var c = el.tagName.toLowerCase() + '.' + cls.map(cssEscape).join('.'); if (isUnique(c)) return { selector: c, fragile: false }; }
    }
    return { selector: tagPath(el), fragile: true };
  }
  function setOutline(el, color) {
    if (!el) return;
    el.setAttribute('data-astudio-outline', el.style.outline);
    el.style.outline = '2px solid ' + color; el.style.outlineOffset = '2px';
  }
  function clearOutline(el) {
    if (!el) return;
    el.style.outline = el.getAttribute('data-astudio-outline') || '';
    el.removeAttribute('data-astudio-outline');
  }
  function clearHover() {
    if (hoverEl && hoverEl !== selected) clearOutline(hoverEl);
    hoverEl = null;
  }
  function hover(el) {
    if (!enabled || drag) return;
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return;
    if (el === selected || el === hoverEl) return;
    clearHover();
    hoverEl = el; setOutline(el, '#22d3ee');
  }
  function select(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return;
    if (selected && selected !== el) clearOutline(selected);
    clearHover();
    selected = el; setOutline(el, '#f59e0b');
    var s = bestSelector(el);
    post('selected', { selector: s.selector, fragile: s.fragile, tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 80) });
  }
  function record(change) {
    change.id = change.id || uid();
    overlayChanges[change.selector] = change;
    post('changed', change);
  }
  function startDrag(e) {
    if (!selected) return;
    e.preventDefault();
    var cs = getComputedStyle(selected);
    drag = { el: selected, sx: e.clientX, sy: e.clientY, ox: parseFloat(cs.left) || 0, oy: parseFloat(cs.top) || 0 };
    function move(ev) {
      if (!drag) return;
      drag.el.style.position = 'relative';
      drag.el.style.left = (drag.ox + ev.clientX - drag.sx) + 'px';
      drag.el.style.top = (drag.oy + ev.clientY - drag.sy) + 'px';
    }
    function up(ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        var s = bestSelector(drag.el);
        record({ kind: 'move', selector: s.selector, fragile: s.fragile, value: { x: dx, y: dy } });
      }
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); drag = null;
    }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }
  function applyStyle(selector, property, value) {
    var el = document.querySelector(selector); if (!el) return false;
    var original = el.style[property] || getComputedStyle(el)[property];
    el.style[property] = value;
    record({ kind: 'style', selector: selector, property: property, value: value, original: original });
    return true;
  }
  function applyText(selector, value) {
    var el = document.querySelector(selector); if (!el) return false;
    var original = el.textContent; el.textContent = value;
    record({ kind: 'text', selector: selector, value: value, original: original });
    return true;
  }
  function revertAll() {
    for (var sel in overlayChanges) {
      var el = document.querySelector(sel); if (!el) continue;
      var c = overlayChanges[sel];
      if (c.kind === 'move' || c.kind === 'resize') { el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = ''; el.style.position = ''; }
      else if (c.kind === 'style') { el.style[c.property] = c.original || ''; }
      else if (c.kind === 'text') { el.textContent = c.original || ''; }
    }
    overlayChanges = {};
    clearOutline(selected); selected = null; clearHover();
  }
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || !d.__appStudio) return;
    if (d.type === 'init') { enabled = !!d.payload.enabled; if (!enabled) { clearOutline(selected); selected = null; clearHover(); } }
    else if (d.type === 'revert') revertAll();
    else if (d.type === 'applyStyle') applyStyle(d.payload.selector, d.payload.property, d.payload.value);
    else if (d.type === 'applyText') applyText(d.payload.selector, d.payload.value);
  });
  document.addEventListener('mouseover', function (e) { hover(e.target); });
  document.addEventListener('mousedown', function (e) {
    if (!enabled) return;
    var t = e.target; if (!t || t.nodeType !== 1) return;
    if (selected && (t === selected || selected.contains(t))) startDrag(e);
  });
  document.addEventListener('click', function (e) {
    if (!enabled) return;
    var t = e.target; if (!t || t.nodeType !== 1 || t === document.body || t === document.documentElement) return;
    e.preventDefault(); e.stopPropagation(); select(t);
  }, true);
})();`

export function apply(ctx) {
  const webServer = ctx.webServer
  const fs = ctx.fs
  const appDir = (ctx.config && ctx.config.appDir) ||
    (typeof process !== 'undefined' && process.env.APP_STUDIO_APP_DIR) ||
    DEFAULT_APP_DIR
  const publicDir = appDir + '/public'
  const PREFIX = '/__app_preview'

  const disposers = []

  // Static preview with injected overlay.
  disposers.push(webServer.register({
    kind: 'prefix',
    path: PREFIX,
    handler: async (req, res) => {
      try {
        const url = req.url || '/'
        const q = url.indexOf('?')
        const pathname = q >= 0 ? url.slice(0, q) : url
        const rel = pathname.slice(PREFIX.length)
        const file = (rel === '' || rel === '/') ? 'index.html' : rel.slice(1)
        if (!/^[A-Za-z0-9._-]+$/.test(file)) { res.writeHead(404); res.end('not found'); return }
        const target = await fs.resolve(publicDir + '/' + file, { cwd: appDir })
        const stat = await fs.stat(target)
        if (stat === undefined || stat.type !== 'file') { res.writeHead(404); res.end('not found'); return }
        let body = await fs.readText(target)
        const ext = file.slice(file.lastIndexOf('.') + 1)
        const ct = ext === 'html' ? 'text/html; charset=utf-8' : ext === 'css' ? 'text/css; charset=utf-8' : ext === 'js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream'
        if (file === 'index.html') {
          body = body.replace('</body>', '<script>' + OVERLAY_JS + '</script></body>')
        }
        res.writeHead(200, { 'Content-Type': ct })
        res.end(body)
      } catch (err) {
        res.writeHead(500)
        res.end(String(err && err.message ? err.message : err))
      }
    },
  }))

  // Streaming LLM edit endpoint (SSE). Args arrive as ?d=<encodeURIComponent(JSON)>.
  const llm = ctx.get('llm')
  const agentDefaultModel = ctx.get('agentDefaultModel')
  if (llm !== undefined && agentDefaultModel !== undefined) {
    disposers.push(webServer.register({
      kind: 'exact',
      path: '/__app_apply_sse',
      handler: async (req, res) => {
        try {
          const url = req.url || '/'
          const qIdx = url.indexOf('?')
          const query = qIdx >= 0 ? url.slice(qIdx + 1) : ''
          let args = {}
          const m = /(?:^|&)d=([^&]*)/.exec(query)
          if (m) { try { args = JSON.parse(decodeURIComponent(m[1])) } catch (e) {} }
          const changes = Array.isArray(args.changes) ? args.changes : []
          const instruction = typeof args.instruction === 'string' ? args.instruction : ''

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          })
          const send = function (obj) { try { res.write('data: ' + JSON.stringify(obj) + '\n\n') } catch (e) {} }

          const rels = ['public/index.html', 'public/style.css', 'public/app.js']
          const sources = {}
          const targets = {}
          for (const rel of rels) {
            const t = await fs.resolve(appDir + '/' + rel, { cwd: appDir })
            sources[rel] = await fs.readText(t)
            targets[rel] = t
          }

          const system = [
            'You are a precise code editor for a web app.',
            'Given the app source files and a list of requested UI changes, return a JSON array of edits.',
            'Each edit: {"file": "<relative path>", "oldString": "<exact verbatim substring from that file>", "newString": "<replacement>"}.',
            'oldString must match the file exactly and be the smallest unique match. If you cannot find a match, omit that edit.',
            'Return ONLY the JSON array. No prose, no markdown fences.',
          ].join('\n')

          const user = (instruction ? 'Natural-language instruction:\n' + instruction + '\n\n' : '') +
            'Requested changes (JSON):\n' + JSON.stringify(changes, null, 2) +
            '\n\nApp source files (JSON path->content):\n' + JSON.stringify(sources)

          const sel = agentDefaultModel.currentSelection()
          if (!sel || !sel.provider || !sel.model) {
            send({ type: 'done', ok: false, error: 'no default model configured' })
            res.end(); return
          }

          const messages = [{
            id: 'app-studio-' + Date.now(),
            role: 'user',
            content: [{ type: 'text', text: user }],
            source: { kind: 'plugin', plugin: 'app-studio' },
          }]

          let text = ''
          try {
            for await (const chunk of llm.stream({ provider: sel.provider, model: sel.model, messages, system, maxTokens: 4000, reasoningEffort: 'off' })) {
              if (chunk.type === 'text-delta') {
                text += chunk.text
                send({ type: 'delta', text: chunk.text })
              } else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
                const msg = chunk.reason.failure && chunk.reason.failure.message ? chunk.reason.failure.message : 'unknown'
                send({ type: 'done', ok: false, error: 'model error: ' + msg })
                res.end(); return
              }
            }
          } catch (e) {
            send({ type: 'done', ok: false, error: 'stream failed: ' + String(e && e.message ? e.message : e) })
            res.end(); return
          }
          if (!text.trim()) {
            send({ type: 'done', ok: false, error: 'model returned empty response' })
            res.end(); return
          }

          let edits
          try {
            const cleaned = text.trim().replace(/^```[a-zA-Z]*\s*/i, '').replace(/\s*```$/, '').trim()
            const a = cleaned.indexOf('[')
            const b = cleaned.lastIndexOf(']')
            if (a < 0 || b <= a) throw new Error('no JSON array')
            edits = JSON.parse(cleaned.slice(a, b + 1))
          } catch (e) {
            send({ type: 'done', ok: false, error: 'could not parse model output: ' + String(e && e.message ? e.message : e) + ' | raw: ' + text.trim().slice(0, 300) })
            res.end(); return
          }
          if (!Array.isArray(edits) || edits.length === 0) {
            send({ type: 'done', ok: false, error: 'model returned no edits | raw: ' + text.trim().slice(0, 300) })
            res.end(); return
          }

          const edited = []
          for (const edit of edits) {
            if (!edit || typeof edit.file !== 'string' || typeof edit.oldString !== 'string' || typeof edit.newString !== 'string') continue
            if (edit.oldString === edit.newString) continue
            const target = targets[edit.file]
            if (target === undefined) continue
            try {
              await fs.editText(target, { oldString: edit.oldString, newString: edit.newString, replaceAll: false })
              edited.push(edit.file)
            } catch (e) {
              console.error('app-studio edit failed for ' + edit.file + ': ' + (e && e.message ? e.message : e))
            }
          }
          send({ type: 'done', ok: edited.length > 0, edited: edited, error: edited.length === 0 ? 'no edits applied (oldString did not match)' : undefined })
          res.end()
        } catch (err) {
          try { res.writeHead(500); res.end(String(err && err.message ? err.message : err)) } catch (e) {}
        }
      },
    }))
  }

  // App start endpoint.
  const shell = ctx.get('shell')
  if (shell !== undefined) {
    disposers.push(webServer.register({
      kind: 'exact',
      path: '/__app_start',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end('POST only'); return }
        try {
          shell.start({ command: 'npm start', workdir: appDir, timeoutMs: 0, stdoutMaxBytes: 1000000, sandboxPolicy: undefined })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ started: true }))
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ started: false, error: String(e && e.message ? e.message : e) }))
        }
      },
    }))
  }

  ctx.effect(() => () => { for (const d of disposers) d() })
}
