# AI Sentinel (GLA3) - 自主安全智能体

> 一个基于 OODA (Observe-Orient-Decide-Act) 循环架构的自主 AI 安全防御系统。

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-2.4.0-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## 核心功能

1.  **OODA 循环引擎**: 模拟 4 种 AI Agent 角色（侦察兵、分析师、指挥官、攻防专家）协同工作，实现从发现威胁到自动响应的全闭环。
2.  **3D 全息态势感知**: 基于 Three.js (WebGL) 的沉浸式网络可视化，构建赛博朋克风格的 3D 网络空间。
3.  **神经核心驱动**: 支持 Google Gemini Pro/Flash 模型，以及兼容 OpenAI 接口的本地模型（如 Ollama）。
4.  **语音指挥官**: 集成 Gemini Live API，支持通过自然语言语音询问态势、下达处置指令（"Fix it"）。
5.  **自动/手动处置**: 针对发现的高危漏洞，提供一键修复或语音授权修复功能。

---

## 🛠️ 架构与实现原理 (Architecture & Implementation)

为了便于演示和交互设计验证，本系统当前版本（v2.4.0）采用**前端全模拟（Frontend Simulation）**架构。以下是核心功能的实现原理对比：

### 1. 模拟模式 (Current Simulation)
当前代码完全运行在浏览器中，不依赖后端服务器操作真实硬件。

*   **数据源**: 基于 React State 管理内存中的虚拟网络拓扑 (`INITIAL_NETWORK_DATA` in `constants.tsx`)。
*   **隔离主机 (`/isolate`)**: 
    *   **实现**: 前端修改 `NetworkGraphData`，过滤掉连接到目标节点的所有 `links` 数据。
    *   **效果**: 3D 视图中的连线瞬间消失，节点状态变为红色，模拟“断网”视觉效果。
*   **漏洞修复 (`/remediate`)**:
    *   **实现**: 前端执行 `setTimeout` 模拟耗时，随后更新节点状态字段 `status` 从 `vulnerable` 变为 `secure`。
*   **智能决策**:
    *   **实现**: 调用 Gemini API 生成逼真的 JSON 格式日志和决策结果，驱动前端状态机流转。

### 2. 生产环境落地方案 (Real-World Integration)
若要将本系统升级为真实的 SOAR（安全编排自动化与响应）平台，建议采用如下架构：

**流程**: `用户/语音指令` -> `Gemini Function Calling` -> `后端 API (Node/Python)` -> `基础设施`

| 功能模块 | 模拟实现 (Current) | 真实落地方案 (Real World) |
| :--- | :--- | :--- |
| **主机隔离** | 删除内存中的 D3.js 连线数据 | **云环境**: 调用 AWS/Aliyun API 修改安全组 (Security Group)。<br>**物理环境**: 通过 SSH 连接防火墙/交换机执行 `iptables -A INPUT -j DROP` 或 `shutdown interface`。 |
| **深度扫描** | LLM 生成虚构的 Nmap 日志 | 后端异步调用 `Nmap`、`Masscan` 或 `OpenVAS`，通过 WebSocket 将真实扫描结果推送到前端。 |
| **漏洞修复** | 更新 React 状态对象 | 触发 **Ansible Playbook**、**SaltStack** 或执行 Python 修复脚本 (如 `yum update openssl`)。 |
| **语音指挥** | Web Audio API + Gemini Live | 保持前端语音采集逻辑不变，但 `tools` 定义中的 `execute_remediation` 应指向真实的后端接口。 |

---

## 💻 终端指令手册 (CLI Commands)

在系统的中央终端中，你可以输入以下指令来直接控制安全智能体（触发对应的模拟逻辑）：

| 指令 | 参数示例 | 说明 |
| :--- | :--- | :--- |
| `/scan` | `/scan 192.168.1.0/24` | **主动探测**。强制调度 Scout Agent 对指定 IP 或网段进行深度扫描，并更新资产指纹。 |
| `/isolate` | `/isolate workstation-1` | **应急隔离**。在网络拓扑层物理切断指定主机的连接，阻止威胁横向扩散。被隔离节点将变红并断开连接。 |
| `/remediate`| `/remediate web-prod` | **强制修复**。跳过自动决策流程，直接授权 Sniper Agent 对指定主机执行漏洞修复脚本。 |
| `/status` | `/status` | **态势感知**。输出当前系统的详细运行指标（OODA 周期、纳管资产数、活跃威胁数等）。 |
| `/clear` | `/clear` | **清屏**。清理终端历史日志。 |
| `/help` | `/help` | **帮助**。显示可用指令列表。 |

---

## 🐳 Docker 部署指南 (推荐)

使用 Docker 可以快速构建并运行一个生产就绪的容器化环境。

### 1. 构建镜像

在项目根目录下运行：

```bash
docker build -t ai-sentinel .
```

### 2. 运行容器

```bash
docker run -d -p 8080:80 --name ai-sentinel ai-sentinel
```

访问浏览器 `http://localhost:8080` 即可使用。

### 3. (可选) 注入 API Key

如果你希望通过环境变量注入 Google API Key（虽然应用内也支持在 UI 中配置）：

```bash
docker run -d -p 8080:80 -e API_KEY="your-google-api-key" --name ai-sentinel ai-sentinel
```

---

## 🚀 本地开发指南

你可以通过以下两种方式在本地运行本项目：

### 方式一：Node.js 开发模式

如果你想修改代码，推荐使用 Node.js 环境：

1.  **安装依赖**: `npm install`
2.  **启动开发服**: `npm run dev`
3.  **构建生产版**: `npm run build`

### 方式二：快速启动 (无需安装依赖)

本项目采用现代 ES Module 架构，也可直接在支持的环境中运行（但 Docker 方式更稳定）。

1.  **启动服务**: 在文件夹下启动一个 HTTP 服务器。
    *   **Python 3**: `python3 -m http.server 8000`
    *   **Node.js**: `npx http-server`
2.  **访问**: 打开浏览器访问 `http://localhost:8000`。

### 对接本地大模型 (Ollama)

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
├── Dockerfile           # Docker 构建文件
├── package.json         # 依赖管理
├── vite.config.ts       # 构建配置
├── index.html           # 入口文件
├── index.tsx            # React 挂载点
├── App.tsx              # 主应用逻辑 & OODA 循环控制器
├── types.ts             # TypeScript 类型定义
├── constants.tsx        # 初始数据与常量
├── services/
│   └── geminiService.ts # Google GenAI SDK 封装
├── components/
│   ├── NetworkGraph.tsx # Three.js 3D 网络拓扑图
│   ├── Terminal.tsx     # 实时日志终端
│   ├── AgentCard.tsx    # Agent 状态卡片
│   ├── IntelligencePanel.tsx # 智能情报面板
│   └── VoiceCommander.tsx    # 语音交互组件
└── metadata.json        # 项目元数据
```

## 技术栈

*   **React 19**: 核心 UI 框架。
*   **Vite**: 构建工具。
*   **Three.js**: WebGL 3D 渲染引擎。
*   **D3.js**: 物理仿真布局计算。
*   **Tailwind CSS**: 样式与动画。
*   **Google GenAI SDK**: 多模态大模型驱动。
*   **Web Audio API**: 实时语音流处理。