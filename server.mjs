// Fly.io / Node 一体化服务器
// 承载前端静态资源 + 后端 API 代理（保证密钥安全）
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const DEFAULT_API_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e";
const BASE_URL = "https://api.lk888.ai";

app.use(express.json({ limit: '50mb' }));

// 健康检查接口（供 Fly.io 存活检测）
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: 查询任务状态
app.get('/api/generate', async (req, res) => {
  const { task_id } = req.query;
  if (!task_id) return res.status(400).json({ error: '缺少 task_id 参数' });

  const apiKey = req.headers['x-api-key'] || process.env.LK888_API_KEY || process.env.OPENAI_API_KEY || DEFAULT_API_KEY;

  try {
    const response = await fetch(`${BASE_URL}/v1/media/status?task_id=${task_id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: `查询任务状态失败: ${err.message}` });
  }
});

// API: 创建生图任务
app.post('/api/generate', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || process.env.LK888_API_KEY || process.env.OPENAI_API_KEY || DEFAULT_API_KEY;

  try {
    const response = await fetch(`${BASE_URL}/v1/media/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: `创建生图任务失败: ${err.message}` });
  }
});

// 静态文件服务
app.use(express.static(join(__dirname, 'dist')));

// SPA 页面回退
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Fly.io Server] 王味螺视觉工坊 running on port ${PORT}`);
});
