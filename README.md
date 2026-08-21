# dsh-ai-ui-studio

AI UI Studio —— 用 AI 有效调整前端样式。在 DSH 里**预览 + 可视化编辑**你的 Web 应用（原生 HTML/CSS/JS，以及 Vue/React 等框架的运行时页面）。右下角一个「🛠 App Studio」悬浮按钮，打开可拖拽面板，内嵌同源预览你的应用：

- **拖拽移动**元素、**点选**任意元素切换
- 属性面板改**文字 / 颜色 / 背景 / 字号 / 宽 / 高**，实时预览
- **AI 流式改**：用自然语言描述改动，模型边生成边显示，写回源码
- 「确认写回」把改动清单交给 DeepSeek 定位并落盘到源码文件

> 机制：Host 把目标应用静态托管到 `/__app_preview/` 并注入编辑脚本，iframe 同源加载；改动先在预览里临时覆盖，点「确认/AI 改」才调用 LLM 写回源码。SSE 流式接口为 `/__app_apply_sse`。

## 安装

作为依赖引入（例如放到 DSH 的 plugin 依赖清单里）：

```bash
npm i github:<your-name>/dsh-ai-ui-studio
# 或本地链接
npm i /path/to/dsh-ai-ui-studio
```

## 使用（组合行）

在 Host 组合里加一行（`webServer`、`fs` 是硬依赖，由 host 组合提供）：

```yaml
- id: app-studio
  name: '@deepseek-ai/dsh-ai-ui-studio'
  config:
    appDir: /Users/you/work/my-web-app
```

`appDir` 指向你的应用根目录（下面要有 `public/index.html`、`public/style.css`、`public/app.js`）。缺省时读 `APP_STUDIO_APP_DIR` 环境变量，再缺省是 `ai-ppt-generator` 的路径——记得按你的项目改。

Client 半由 DSH 前端自动加载（包内 `./client` 导出）。

## 依赖的服务

| 面 | 服务 |
| --- | --- |
| Host | `webServer`、`fs`（必需）；`llm`、`agentDefaultModel`、`shell`（可选） |
| Client | `slots`（必需）；`react` |

`llm` + `agentDefaultModel` 用于 AI 写回；缺失时预览/拖拽仍可用，仅「确认写回 / AI 改」不可用。`shell` 用于「启动」按钮。

## 已知限制

- 预览是**静态托管**（Host 动态环境无原始 HTTP 流式代理能力），应用后端 `/api/*`（如 SSE 生成）不在预览内可用；真实运行时功能请用原应用端口。
- AI 写回依赖模型定位质量；JS 动态渲染的元素（如模板字符串里的 slide）映射回源码时可能不精确，v1 用于验证并迭代提示词。

## License

MIT
