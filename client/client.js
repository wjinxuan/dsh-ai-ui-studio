window.__ModuleLoader__.load({ id: "dsh-ai-ui-studio", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const react = require("react");

const name = "dsh-ai-ui-studio";
const inject = ["slots"];
const PREVIEW = "/__app_preview/";
const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
function icon() { return react.createElement("span", { style: { display: "inline-flex", alignItems: "center" }, dangerouslySetInnerHTML: { __html: ICON } }); }

const CSS = `
  .astudio-entry{background:transparent;border:none;cursor:pointer;font-size:13px;padding:6px 8px;color:#94a3b8;display:inline-flex;align-items:center;gap:4px;}
  .astudio-entry:hover{color:#e2e8f0;}
  .astudio-fab{position:fixed;right:20px;bottom:20px;z-index:9999;background:#6366f1;color:#fff;border:none;border-radius:999px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:auto;display:inline-flex;align-items:center;gap:6px;}
  .astudio-fab:hover{background:#4f46e5;}
  .astudio-panel{position:fixed;right:0;top:0;bottom:0;width:520px;z-index:9999;
    background:#0f172a;color:#e2e8f0;border-left:1px solid #334155;
    box-shadow:-20px 0 60px rgba(0,0,0,.4);display:flex;flex-direction:column;
    font-family:system-ui,-apple-system,sans-serif;pointer-events:auto;overflow:hidden;}
  .astudio-panel.max{width:calc(100vw - 40px);}
  .astudio-header{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1e293b;user-select:none;flex:none;}
  .astudio-header span{font-weight:600;flex:1;font-size:13px;}
  .astudio-header button,.astudio-footer button{background:#334155;color:#e2e8f0;border:none;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;}
  .astudio-header button:hover,.astudio-footer button:hover{background:#475569;}
  .astudio-frame{flex:1;border:none;background:#fff;width:100%;min-height:0;}
  .astudio-dir{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid #1e293b;flex:none;}
  .astudio-dir label{width:36px;color:#94a3b8;flex-shrink:0;font-size:12px;}
  .astudio-dir input{flex:1;background:#0b1120;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:4px 6px;font-size:12px;}
  .astudio-dir button{background:#334155;color:#e2e8f0;border:none;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;}
  .astudio-dir button:hover{background:#475569;}
  .astudio-status{padding:6px 10px;font-size:11px;color:#94a3b8;border-top:1px solid #1e293b;flex:none;}
  .astudio-props{padding:8px 10px;border-top:1px solid #1e293b;display:flex;flex-direction:column;gap:6px;max-height:160px;overflow:auto;flex:none;}
  .astudio-prop-row{display:flex;align-items:center;gap:6px;font-size:12px;}
  .astudio-prop-row label{width:36px;color:#94a3b8;flex-shrink:0;}
  .astudio-prop-row input{flex:1;background:#0b1120;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:4px 6px;font-size:12px;}
  .astudio-footer{padding:8px 10px;border-top:1px solid #1e293b;display:flex;flex-direction:column;gap:6px;flex:none;}
  .astudio-actions{display:flex;align-items:center;gap:8px;}
  .astudio-log{font-size:11px;color:#94a3b8;flex:1;}
  .astudio-stream{background:#0b1120;border:1px solid #334155;border-radius:6px;padding:6px 8px;font-size:11px;color:#a5f3fc;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto;font-family:ui-monospace,Menlo,monospace;}
`;

function apply(ctx) {
  const slots = ctx.slots;

  const STYLE_ID = "dsh-ai-ui-studio-style";
  let styleTag;
  if (typeof document !== "undefined" && document.getElementById(STYLE_ID) === null) {
    styleTag = document.createElement("style");
    styleTag.id = STYLE_ID;
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);
  }

  // Shared open state between the sidebar button and the docked panel.
  let open = false;
  const subs = new Set();
  function setOpen(v) { open = v; subs.forEach((f) => f()); }
  function subscribe(f) { subs.add(f); return function () { subs.delete(f); }; }
  function useOpen() {
    const p = react.useState(open);
    const v = p[0]; const setV = p[1];
    react.useEffect(function () { return subscribe(function () { setV(open); }); }, []);
    return [v, setOpen];
  }

  function StudioPanel(props) {
    const openPair = useOpen();
    const isOpen = openPair[0];
    const toggleOpen = openPair[1];

    const wsList = props && props.useWorkspaces ? props.useWorkspaces((s) => s.items) : null;
    const curSession = props && props.useSessions ? props.useSessions((s) => s.current) : null;
    let wsPath = "";
    if (wsList && curSession) {
      const w = wsList.find((x) => x.sessionIds && x.sessionIds.indexOf(curSession) >= 0);
      if (w) wsPath = w.path;
    }
    const dirState = react.useState("");
    const dirInput = dirState[0];
    const setDirInput = dirState[1];
    const appDir = dirInput ? dirInput : wsPath;
    const addrState = react.useState("127.0.0.1:3900");
    const addrInput = addrState[0];
    const setAddrInput = addrState[1];
    const editState = react.useState(false);
    const editMode = editState[0];
    const setEditMode = editState[1];
    const selState = react.useState(null);
    const selected = selState[0];
    const setSelected = selState[1];
    const chState = react.useState([]);
    const changes = chState[0];
    const setChanges = chState[1];
    const busyState = react.useState(false);
    const busy = busyState[0];
    const setBusy = busyState[1];
    const logState = react.useState("");
    const log = logState[0];
    const setLog = logState[1];
    const streamState = react.useState("");
    const stream = streamState[0];
    const setStream = streamState[1];
    const aiState = react.useState("");
    const aiText = aiState[0];
    const setAiText = aiState[1];

    function frame() { return document.getElementById("astudio-frame"); }
    function previewSrc() {
      let a = (addrInput || "127.0.0.1:3900").replace(/^https?:\/\//, "");
      const slash = a.indexOf("/");
      const hash = a.indexOf("#");
      let cut = a.length;
      if (slash >= 0 && slash < cut) cut = slash;
      if (hash >= 0 && hash < cut) cut = hash;
      const hostPort = a.slice(0, cut);
      const tail = a.slice(cut);
      return PREVIEW + hostPort.replace(":", "_") + "/" + tail.replace(/^\//, "");
    }
    function post(type, payload) { const f = frame(); if (f && f.contentWindow) f.contentWindow.postMessage({ __appStudio: true, type: type, payload: payload || {} }, "*"); }
    function refresh() { const f = frame(); if (f) f.src = previewSrc() + "?_=" + Date.now(); }
    function applyStyle(prop, val) { if (selected) post("applyStyle", { selector: selected.selector, property: prop, value: val }); }
    function applyText(val) { if (selected) post("applyText", { selector: selected.selector, value: val }); }
    function revert() { post("revert"); setChanges([]); setSelected(null); }

    function streamApply(args) {
      setBusy(true); setStream(""); setLog("生成中…");
      const q = encodeURIComponent(JSON.stringify(args));
      const es = new EventSource("/__app_apply_sse?d=" + q + (appDir ? "&dir=" + encodeURIComponent(appDir) : ""));
      es.onmessage = function (e) {
        let p;
        try { p = JSON.parse(e.data); } catch (err) { return; }
        if (p.type === "delta") setStream(function (prev) { return prev + p.text; });
        else if (p.type === "done") {
          if (p.ok) { setLog("已写回: " + (p.edited || []).join(", ")); setChanges([]); setSelected(null); refresh(); }
          else setLog("失败: " + (p.error || "未知错误"));
          setBusy(false); es.close();
        }
      };
      es.onerror = function () { setLog("失败: 流连接中断"); setBusy(false); es.close(); };
    }

    function startApp() {
      const u = "/__app_start" + (appDir ? "?dir=" + encodeURIComponent(appDir) : "");
      fetch(u, { method: "POST" })
        .then(function (r) { return r.json(); })
        .then(function (r) { setLog(r && r.started ? "已启动" : ("启动失败" + (r && r.error ? ": " + r.error : ""))); })
        .catch(function (e) { setLog("启动失败: " + String(e && e.message ? e.message : e)); });
    }

    react.useEffect(function () {
      if (!isOpen) return;
      function onMsg(e) {
        const d = e.data;
        if (!d || !d.__appStudio) return;
        if (d.type === "selected") setSelected(d.payload);
        else if (d.type === "changed") {
          setChanges(function (prev) {
            const p = d.payload;
            const key = p.kind === "style" ? p.selector + "::" + p.property : p.selector;
            const rest = prev.filter(function (c) { return (c.kind === "style" ? c.selector + "::" + c.property : c.selector) !== key; });
            return rest.concat(p);
          });
        }
      }
      window.addEventListener("message", onMsg);
      return function () { window.removeEventListener("message", onMsg); };
    }, [isOpen]);

    react.useEffect(function () {
      if (!isOpen) return;
      post("init", { enabled: editMode });
    }, [editMode, isOpen]);

    react.useEffect(function () {
      if (!isOpen) return;
      refresh();
    }, [addrInput, isOpen]);

    if (!isOpen) {
      return react.createElement("button", { className: "astudio-fab", title: "App Studio", onClick: function () { setOpen(true); } }, icon(), " App Studio");
    }

    return react.createElement("div", { className: "astudio-panel" },
      react.createElement("div", { className: "astudio-header" },
        react.createElement("span", null, icon(), " App Studio"),
        react.createElement("button", { onClick: function () { setEditMode(!editMode); } }, editMode ? "编辑中" : "预览"),
        react.createElement("button", { onClick: revert }, "撤销"),
        react.createElement("button", { onClick: refresh }, "刷新"),
        react.createElement("button", { onClick: startApp }, "启动"),
        react.createElement("button", { onClick: function () { toggleOpen(false); } }, "×"),
      ),
      react.createElement("div", { className: "astudio-dir" },
        react.createElement("label", null, "地址"),
        react.createElement("input", { placeholder: "127.0.0.1:9528", value: addrInput, onChange: function (e) { setAddrInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") refresh(); } }),
        react.createElement("button", { onClick: refresh }, "刷新"),
      ),
      react.createElement("div", { className: "astudio-dir" },
        react.createElement("label", null, "目录"),
        react.createElement("input", { placeholder: appDir || "留空跟随当前工作区", value: dirInput, onChange: function (e) { setDirInput(e.target.value); } }),
      ),
      react.createElement("iframe", { id: "astudio-frame", className: "astudio-frame", src: previewSrc() }),
      react.createElement("div", { className: "astudio-status" },
        selected ? ("选中: <" + selected.tag + "> " + selected.selector + (selected.fragile ? " (脆弱)" : "")) : (editMode ? "编辑模式: 悬停高亮 · 点击选中 · 拖拽移动" : "预览模式")),
      selected ? react.createElement("div", { className: "astudio-props", key: selected.selector },
        react.createElement("div", { className: "astudio-prop-row" },
          react.createElement("label", null, "文字"),
          react.createElement("input", { defaultValue: selected.text, onBlur: function (e) { applyText(e.target.value); } }),
        ),
        react.createElement("div", { className: "astudio-prop-row" },
          react.createElement("label", null, "颜色"),
          react.createElement("input", { type: "color", onChange: function (e) { applyStyle("color", e.target.value); } }),
        ),
        react.createElement("div", { className: "astudio-prop-row" },
          react.createElement("label", null, "背景"),
          react.createElement("input", { type: "color", onChange: function (e) { applyStyle("backgroundColor", e.target.value); } }),
        ),
        react.createElement("div", { className: "astudio-prop-row" },
          react.createElement("label", null, "字号"),
          react.createElement("input", { type: "number", placeholder: "px", onBlur: function (e) { if (e.target.value) applyStyle("fontSize", e.target.value + "px"); } }),
        ),
      ) : null,
      react.createElement("div", { className: "astudio-footer" },
        react.createElement("div", { className: "astudio-prop-row" },
          react.createElement("input", { placeholder: "用自然语言描述改动…", value: aiText, onChange: function (e) { setAiText(e.target.value); } }),
          react.createElement("button", { onClick: function () { if (aiText.trim()) streamApply({ instruction: aiText, changes: changes }); }, disabled: busy }, "AI 改"),
        ),
        react.createElement("div", { className: "astudio-actions" },
          react.createElement("button", { onClick: function () { streamApply({ changes: changes }); }, disabled: busy || changes.length === 0 }, "确认写回 (" + changes.length + ")"),
          react.createElement("span", { className: "astudio-log" }, log),
        ),
        stream ? react.createElement("div", { className: "astudio-stream" }, stream) : null,
      ),
    );
  }

  const disposeEntry = slots.inject("sidebar.footer.action", function () { return slots.register(
    { name: "sidebar.footer.action", id: "app-studio", order: 20, label: "App Studio" },
    function () { return react.createElement("button", { className: "astudio-entry", title: "App Studio", onClick: function () { setOpen(!open); } }, icon(), " App Studio"); },
  ); });

  const disposePanel = slots.inject("shell.overlay", function () { return slots.register(
    { name: "shell.overlay", id: "app-studio", order: 100 },
    function (props) { return react.createElement(StudioPanel, props); },
  ); });

  ctx.effect(() => () => {
    if (styleTag) styleTag.remove();
    disposeEntry();
    disposePanel();
  });
}

exports.name = name;
exports.inject = inject;
exports.apply = apply;
return module.exports;
}});
