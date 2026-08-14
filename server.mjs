// Render.com 一体化部署服务器
// 同时承载前端静态文件 + 后端 API 代理（密钥安全保留在服务端）
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.LK888_API_KEY || process.env.OPENAI_API_KEY || "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e";
const BASE_URL = "https://api.lk888.ai";

app.use(express.json({ limit: '50mb' }));

// API: 查询任务状态
app.get('/api/generate', async (req, res) => {
  const { task_id } = req.query;
  if (!task_id) return res.status(400).json({ error: '缺少 task_id 参数' });

  try {
    const response = await fetch(`${BASE_URL}/v1/media/status?task_id=${task_id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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
  try {
    const response = await fetch(`${BASE_URL}/v1/media/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`王味螺专用视觉工坊 running on port ${PORT}`);
});
