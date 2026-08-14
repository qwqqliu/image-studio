// Vercel Serverless Function: /api/generate
const DEFAULT_API_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e";
const BASE_URL = "https://api.lk888.ai";

export default async function handler(req, res) {
  const apiKey = req.headers['x-api-key'] || process.env.LK888_API_KEY || process.env.OPENAI_API_KEY || DEFAULT_API_KEY;

  // 1. 处理轮询查询请求 (GET /api/generate?task_id=xxx)
  if (req.method === 'GET') {
    const { task_id } = req.query;
    if (!task_id) {
      return res.status(400).json({ error: '缺少 task_id 参数' });
    }

    try {
      const response = await fetch(`${BASE_URL}/v1/media/status?task_id=${task_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      console.error('[API Status Error]', err);
      const causeMsg = err.cause ? ` (${err.cause.message || err.cause})` : '';
      return res.status(500).json({ error: `查询任务状态失败: ${err.message}${causeMsg}` });
    }
  }

  // 2. 处理创建任务请求 (POST /api/generate)
  if (req.method === 'POST') {
    try {
      const bodyData = req.body;
      const response = await fetch(`${BASE_URL}/v1/media/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err) {
      console.error('[API Generate Error]', err);
      const causeMsg = err.cause ? ` (${err.cause.message || err.cause})` : '';
      return res.status(500).json({ error: `创建生图任务失败: ${err.message}${causeMsg}` });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
