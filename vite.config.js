import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e";
const BASE_URL = "https://api.lk888.ai";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const activeKey = env.LK888_API_KEY || env.OPENAI_API_KEY || process.env.LK888_API_KEY || process.env.OPENAI_API_KEY || DEFAULT_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'local-api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url.startsWith('/api/generate')) {
              const apiKey = req.headers['x-api-key'] || activeKey;

              // 1. 本地轮询查询 GET /api/generate?task_id=xxx
              if (req.method === 'GET') {
                const urlObj = new URL(req.url, `http://${req.headers.host}`);
                const taskId = urlObj.searchParams.get('task_id');
                try {
                  const response = await fetch(`${BASE_URL}/v1/media/status?task_id=${taskId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                  });
                  const data = await response.json();
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify(data));
                } catch (e) {
                  console.error('[API Proxy Status Error]', e);
                  const causeMsg = e.cause ? ` (${e.cause.message || e.cause})` : '';
                  res.statusCode = 500;
                  return res.end(JSON.stringify({ error: `查询任务状态失败: ${e.message}${causeMsg}` }));
                }
              }

              // 2. 本地创建任务 POST /api/generate
              if (req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', async () => {
                  try {
                    console.log(`[API Proxy] 正在发送任务请求到 ${BASE_URL}/v1/media/generate`);
                    const response = await fetch(`${BASE_URL}/v1/media/generate`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: bodyStr
                    });
                    
                    const data = await response.json();
                    console.log('[API Proxy Response]', response.status, data);
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify(data));
                  } catch (e) {
                    console.error('[API Proxy Generate Error]', e);
                    const causeMsg = e.cause ? ` (${e.cause.message || e.cause})` : '';
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ error: `提交任务失败: ${e.message}${causeMsg}` }));
                  }
                });
                return;
              }
            }
            next();
          });
        }
      }
    ],
    server: {
      port: 3000,
    },
  };
});
