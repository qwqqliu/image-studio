# 王味螺专用视觉工坊 (文生图 & 图生图 独立版)

这是一个专门的 **文生图与图生图 (多图融合与重绘)** 独立应用，已全方位适配 **Fly.io** 容器化一键部署。

---

## 🌟 项目亮点

- **一体化部署**：采用 React 19 + Vite 构建前端 SPA，配合 Express 高性能 Node 服务器托管静态资源并安全代理 `/api/generate` 接口。
- **三大顶级视觉引擎**：整合 OpenAI (GPT Image 2)、Google Gemini 3 Pro (Nano Banana Pro) 与字节跳动即梦 (5.0 Pro)。
- **大师级画面表现**：原生支持 2K/4K 画质渲染，支持竖屏 (9:16)、横屏 (16:9)、正方形 (1:1) 等多种比例。
- **剪贴板智能粘贴与压缩**：支持 `⌘V / Ctrl+V` 直接粘贴图片，并自动将参考图优化为 1024px 高清标准 Blob，确保接口高成功率。

---

## 🚀 部署到 Fly.io 步骤

### 方式 A：Fly.io 控制台 GitHub 自动部署（推荐）
1. 在 Fly.io 控制台选择 **Launch an App from GitHub** 并选择仓库 `qwqqliu/image-studio`。
2. Region 选择 `sin` (Singapore)。
3. Internal port 填 `8080`。
4. 在 **Environment Variables** 添加：
   - Key: `LK888_API_KEY`
   - Value: `你的 API Key`
5. 点击 **Deploy** 即可全自动完成构建与上线！

### 方式 B：Fly CLI 命令行部署
```bash
# 1. 登录 Fly
fly auth login

# 2. 一键部署
fly deploy
```

---

## 🛠 本地调试 (Local Development)

```bash
# 启动本地开发服务 (http://localhost:3000)
npm run dev

# 本地打包与生产运行测试
npm run build
npm start
```
