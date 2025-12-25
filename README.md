# AI Sentinel (GLA3) - 自主安全智能体

> 一个基于 OODA (Observe-Orient-Decide-Act) 循环架构的自主 AI 安全防御系统。

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-2.4.0-green)

## 核心功能

1.  **OODA 循环引擎**: 模拟 4 种 AI Agent 角色（侦察兵、分析师、指挥官、攻防专家）协同工作，实现从发现威胁到自动响应的全闭环。
2.  **实时网络拓扑**: 基于 D3.js 的动态网络可视化，实时展示资产状态和风险传导路径。
3.  **神经核心驱动**: 支持 Google Gemini Pro/Flash 模型，以及兼容 OpenAI 接口的本地模型（如 Ollama）。
4.  **语音指挥官**: 集成 Gemini Live API，支持通过自然语言语音询问态势、下达处置指令（"Fix it"）。
5.  **自动/手动处置**: 针对发现的高危漏洞，提供一键修复或语音授权修复功能。

---

## 🚀 本地部署指南

你可以通过以下两种方式在本地运行本项目：

### 方式一：快速启动 (无需安装 Node.js 依赖)

本项目采用现代 ES Module 架构，可直接在浏览器中运行，只需一个静态文件服务器。

1.  **下载代码**: 将所有项目文件保存到本地文件夹。
2.  **启动服务**: 在该文件夹下启动一个 HTTP 服务器。
    *   **Python 3**: `python3 -m http.server 8000`
    *   **Node.js**: `npx http-server`
3.  **访问**: 打开浏览器访问 `http://localhost:8000`。

### 方式二：对接本地大模型 (Ollama)

你可以使用本地的 Llama 3 或其他模型来代替 Google Gemini，完全保护隐私且无 Rate Limit 限制。

1.  **安装 Ollama**: 从 [ollama.com](https://ollama.com) 下载并安装。
2.  **拉取模型**: 运行 `ollama run llama3` (或 `qwen2.5`, `mistral` 等)。
3.  **配置系统**:
    *   启动 AI Sentinel 系统。
    *   点击右上角 **配置 (Configuration)** 按钮。
    *   **模型选择**: 选择 `+ 自定义 / 本地模型`。
    *   **模型名称**: 输入 `llama3` (需与 Ollama 中一致)。
    *   **服务地址**: 输入 `http://localhost:11434/v1beta` (注意：Ollama 默认是 11434，Gemini SDK 需要 `/v1beta` 或兼容路径，或者使用 LiteLLM 转发)。
        *   *注意*: 原生 Ollama API 可能需要一个转换层来适配 Google GenAI SDK 格式，推荐使用 `Gemini` API Key 以获得最佳体验。
        *   或者，如果你有兼容 OpenAI 格式的本地服务，可修改代码适配。本系统默认深度集成 Google GenAI SDK。

---

## 🔑 API Key 配置与故障排除

### 遇到 `429 Quota Exceeded` 错误？

如果你看到日志中出现 `429` 错误，说明默认的共享 API Key 配额已耗尽。

**解决方法：**

1.  前往 [Google AI Studio](https://aistudio.google.com/) 免费获取自己的 API Key。
2.  在系统右上角点击 **配置 (Configuration)** 按钮。
3.  在 **Google Gemini API Key** 输入框中填入你的 Key。
4.  点击保存，配置将自动存储在浏览器的 `localStorage` 中。

---

## 目录结构

```
.
├── index.html           # 入口文件
├── index.tsx            # React 挂载点
├── App.tsx              # 主应用逻辑 & OODA 循环控制器
├── types.ts             # TypeScript 类型定义
├── constants.tsx        # 初始数据与常量
├── services/
│   └── geminiService.ts # Google GenAI SDK 封装
├── components/
│   ├── NetworkGraph.tsx # D3.js 网络拓扑图
│   ├── Terminal.tsx     # 实时日志终端
│   ├── AgentCard.tsx    # Agent 状态卡片
│   ├── IntelligencePanel.tsx # 智能情报面板
│   └── VoiceCommander.tsx    # 语音交互组件
└── metadata.json        # 项目元数据
```

## 技术栈

*   **React 19**: 核心 UI 框架。
*   **Tailwind CSS**: 样式与动画。
*   **D3.js**: 数据可视化与物理仿真。
*   **Google GenAI SDK**: 多模态大模型驱动。
*   **Web Audio API**: 实时语音流处理。
