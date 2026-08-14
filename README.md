# 王味螺专用视觉工坊 (文生图 & 图生图 独立版)

这是一个专门的 **文生图与图生图 (多图融合与重绘)** 独立应用，已针对 **Vercel 一键部署** 进行了全方位优化。

---

## 🌟 项目亮点

- **零后端依赖**：采用 React 19 + Vite 构建前端 SPA，支持通过自带的 Vercel Serverless Function `/api/generate` 自动转发请求。
- **三大顶级视觉引擎**：整合 OpenAI (GPT Image 2)、Google Gemini 3 Pro (Nano Banana Pro) 与字节跳动即梦 (5.0 Pro)。
- **大师级画面表现**：原生支持 2K/4K 画质渲染，支持竖屏 (9:16)、横屏 (16:9)、正方形 (1:1) 等多种比例。
- **剪贴板智能粘贴与压缩**：支持 `⌘V / Ctrl+V` 直接粘贴图片，并自动将参考图优化为 1024px 高清标准 Blob，确保接口高成功率。

---

## 🚀 部署到 Vercel 步骤

### 步骤 1：在 Vercel 配置环境变量
在 Vercel 项目设置的 `Environment Variables` 中，添加：
- 键：`LK888_API_KEY`（或 `OPENAI_API_KEY`）
- 值：`你的 API Key`

### 步骤 2：一键部署
在项目文件夹 `image-studio` 内执行：

```bash
cd image-studio
npx vercel
```
*跟随提示回车完成初始化，即可获得一个由 Vercel 自动分配的公网 URL。*

---

## 🛠 本地调试 (Local Development)

本地专属密钥文件为 `.env.local`。

```bash
# 启动本地开发服务 (http://localhost:3000)
npm run dev

# 本地打包测试
npm run build
```
