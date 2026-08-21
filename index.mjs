// App Studio — Host half.
// 1) Reverse-proxies the RUNNING app under /__app_preview/<host>_<port>/ with an
//    injected editing overlay (same-origin with DSH so the overlay can touch the DOM).
// 2) Streams LLM source edits over SSE at /__app_apply_sse.
// 3) Starts the app at /__app_start (POST).
import { request as httpRequest } from 'node:http'

export const name = 'dsh-ai-ui-studio'
export const inject = ['webServer']

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
  const fs = ctx.get('fs')
  if (fs === undefined) return
  const defaultAppDir = (typeof process !== 'undefined' && process.env.APP_STUDIO_APP_DIR) || DEFAULT_APP_DIR
  const PREFIX = '/__app_preview'

  function resolveAppDir(encoded) {
    if (encoded) {
      try { const d = decodeURIComponent(encoded); if (d) return d } catch (e) {}
    }
    return defaultAppDir
  }

  const disposers = []

  // Rewrite absolute asset paths so they route back through the proxy.
  function rewriteContent(body, ct, prefix) {
    if (ct.indexOf('text/html') >= 0) {
      return body
        .replace(/(src|href)=(["'])\/(?!\/)([^"']*)\2/g, (m, a, q, p) => a + '=' + q + prefix + '/' + p + q)
        .replace('</body>', '<script>' + OVERLAY_JS + '</script></body>')
    }
    if (ct.indexOf('javascript') >= 0) {
      return body
        .replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])\/(?!\/)([^"']*)\2/g, (m, kw, q, p) => kw + q + prefix + '/' + p + q)
        .replace(/(\bfetch\s*\(\s*|\baxios\s*\.\s*(?:get|post|put|delete)\s*\(\s*)(["'`])\/(?!\/)([^"']*)\2/g, (m, kw, q, p) => kw + q + prefix + '/' + p + q)
    }
    if (ct.indexOf('text/css') >= 0) {
      return body.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/g, (m, dq, sq, bare) => {
        const p = dq || sq || bare
        if (p && p.startsWith('/') && !p.startsWith('//')) return 'url("' + prefix + '/' + p + '")'
        return m
      })
    }
    return body
  }

  // Reverse proxy to the RUNNING app, rewriting asset paths + injecting the overlay.
  function proxyTo(host, port, upstreamPath, query, req, res) {
    const prefix = PREFIX + '/' + host + '_' + port
    const headers = {}
    for (const k in req.headers) {
      if (k === 'host' || k === 'connection' || k === 'upgrade' || k === 'keep-alive') continue
      headers[k] = req.headers[k]
    }
    const upstream = httpRequest({
      hostname: host,
      port: port,
      path: upstreamPath + query,
      method: req.method,
      headers: headers,
    }, (upRes) => {
      const ct = upRes.headers['content-type'] || ''
      const shouldRewrite = ct.indexOf('text/html') >= 0 || ct.indexOf('javascript') >= 0 || ct.indexOf('text/css') >= 0
      if (shouldRewrite) {
        let body = ''
        upRes.setEncoding('utf8')
        upRes.on('data', (c) => { body += c })
        upRes.on('end', () => {
          body = rewriteContent(body, ct, prefix)
          const h = {}
          for (const k in upRes.headers) if (k !== 'content-length') h[k] = upRes.headers[k]
          res.writeHead(upRes.statusCode || 200, h)
          res.end(body)
        })
      } else {
        res.writeHead(upRes.statusCode || 200, upRes.headers)
        upRes.pipe(res)
      }
    })
    upstream.on('error', () => {
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:32px;color:#475569"><h2>应用未启动</h2><p>无法连接到 ' + host + ':' + port + '，请先点「启动」或确认应用已在运行。</p></body></html>')
    })
    req.pipe(upstream)
  }

  disposers.push(webServer.register({
    kind: 'prefix',
    path: PREFIX,
    handler: async (req, res) => {
      try {
        const url = req.url || '/'
        const q = url.indexOf('?')
        const pathname = q >= 0 ? url.slice(0, q) : url
        const query = q >= 0 ? url.slice(q) : ''
        const rel = pathname.slice(PREFIX.length).replace(/^\//, '')
        const segs = rel.split('/').filter(Boolean)
        const target = segs[0] || '127.0.0.1_3900'
        const m = /^(.+?)_(\d+)$/.exec(target)
        const host = m ? m[1] : '127.0.0.1'
        const port = m ? parseInt(m[2], 10) : 3900
        const upstreamPath = '/' + segs.slice(1).join('/')
        proxyTo(host, port, upstreamPath, query, req, res)
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
          const dm = /(?:^|&)dir=([^&]*)/.exec(query)
          const appDir = resolveAppDir(dm ? dm[1] : undefined)
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
          const url = req.url || '/'
          const qIdx = url.indexOf('?')
          const query = qIdx >= 0 ? url.slice(qIdx + 1) : ''
          const dm = /(?:^|&)dir=([^&]*)/.exec(query)
          const workdir = resolveAppDir(dm ? dm[1] : undefined)
          const spec = shell.resolve({ command: 'npm start', workdir: workdir })
          shell.start(spec)
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
