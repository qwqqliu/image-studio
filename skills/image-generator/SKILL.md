---
name: image-generator
description: AI 智能体无障碍图像生成与编辑技能包（Image Generation Skill）。支持 GPT Image 2、Google Gemini 3 Pro (Nano Banana Pro)、字节即梦 5.0 Pro 等顶级 AI 大模型。包含了 API 密钥、一键生图 CLI 脚本、REST API 接口规范、状态轮询机制及多语言代码示例。
---

# AI 图像生成与编辑技能包 (Image Generator Skill)

本技能包为 AI 智能体（Agent）及开发者提供无障碍生图能力。内部集成顶级 AI 生图模型（GPT Image 2、Gemini 3 Pro、即梦 5.0 Pro），内置有效 API 密钥，开箱即用。

---

## ⚡ 1. 快速使用 (Quick Start)

### 方式一：使用内置 Python CLI 脚本（推荐 AI Agent 直接执行）

技能包自带全功能 Python 脚本 `.agents/skills/image-generator/scripts/generate.py`，无第三方依赖包，自动完成**任务提交 -> 状态轮询 -> 结果下载**全流程。

#### 1. 文生图 (Text-to-Image) 基础命令
```bash
python3 .agents/skills/image-generator/scripts/generate.py \
  --prompt "一张超现实主义赛博朋克城市夜景，4K高清，高细节，发光霓虹灯" \
  --model gpt-image-2 \
  --aspect-ratio 9:16 \
  --output ./cyberpunk.png
```

#### 2. 图生图 (Image-to-Image / 参考图垫图) 命令
```bash
python3 .agents/skills/image-generator/scripts/generate.py \
  --prompt "将参考图中的人物转换为动漫水彩风格，保持人物动作与发型一致" \
  --model doubao-seedream-5-0-pro-260628 \
  --ref-images ./input_avatar.jpg \
  --output ./anime_result.png
```

#### 3. 命令行参数说明
| 参数名 | 简写 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | **是** | - | 生成提示词 (Prompt) |
| `--model` | `-m` | 否 | `gpt-image-2` | 模型选择: `gpt-image-2`, `gemini-3-pro-image-preview`, `doubao-seedream-5-0-pro-260628` |
| `--aspect-ratio` | `-ar` | 否 | `9:16` | 画面比例: `9:16`, `16:9`, `1:1`, `4:3`, `3:4` |
| `--size` | `-s` | 否 | `2K` | 分辨率等级: `1K`, `2K`, `4K` (对应模型支持的输出尺寸) |
| `--quality` | `-q` | 否 | `auto` | GPT 模型画质设置: `auto`, `hd`, `standard` |
| `--ref-images` | `-i` | 否 | - | 参考图路径、URL 或 Base64 编码字符串（支持多张） |
| `--output` | `-o` | 否 | - | 图片自动下载保存的目标路径（例如 `./result.png`） |
| `--api-key` | - | 否 | *内置 Key* | 自定义 API Key |
| `--timeout` | - | 否 | `180` | 轮询等待最大超时时间（秒） |

---

## 🔑 2. 接口认证与密钥 (Authentication)

- **内置 API Key**: `sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e`
- **Base URL**: `https://api.lk888.ai`
- **请求头配置**:
  ```http
  Authorization: Bearer sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e
  Content-Type: application/json
  ```

---

## 🎨 3. 支持的大模型与参数规范 (Models & Parameters)

| 模型 ID (`model`) | 供应商名称 | 优势说明 | 专属参数构造示例 |
| :--- | :--- | :--- | :--- |
| `gpt-image-2` | OpenAI 旗舰 | 盲测第一，擅长文字海报、复杂构图与排版 | `{"size": "1088x1920", "quality": "auto", "n": 1}` |
| `gemini-3-pro-image-preview` | Google Gemini 3 Pro | 支持原生 4K 输出，多语言文字与品牌一致性极佳 | `{"aspectRatio": "9:16", "imageSize": "2K"}` |
| `doubao-seedream-5-0-pro-260628` | 字节即梦 5.0 Pro | 空间理解与光影还原强，支持最多 10 张多图融合 | `{"aspect_ratio": "9:16", "size": "2K"}` |

---

## 📡 4. REST API 接口对接规范 (API Reference)

智能体如需直接发起 HTTP 请求，请遵循以下标准流程：

### 步骤 1：创建生成任务 (POST `/v1/media/generate`)

**请求地址**: `https://api.lk888.ai/v1/media/generate`

**请求示例 (POST JSON)**:
```json
{
  "model": "gpt-image-2",
  "prompt": "一只戴着墨镜的酷炫猫咪，朋克发型，霓虹灯背景，高清大图",
  "params": {
    "size": "1088x1920",
    "quality": "auto",
    "n": 1
  }
}
```

**若包含参考图 (图生图模式)**：在 `params` 中增加 `images` 数组，元素为 `data:image/jpeg;base64,...`。

**响应示例 (200 OK)**:
```json
{
  "code": 200,
  "msg": "任务创建成功",
  "data": {
    "task_id": 102090894,
    "task_ids": [102090894]
  }
}
```

---

### 步骤 2：轮询任务状态 (GET `/v1/media/status`)

生图任务为异步计算，需要轮询查询任务进度直至完成。

**请求地址**: `https://api.lk888.ai/v1/media/status?task_id={task_id}`

**轮询逻辑**:
- 建议轮询间隔: `3` 秒。
- 超时保护: `180` 秒。
- 结束标志: 当返回数据中 `is_final == true` 时停止轮询。

**处理中响应示例**:
```json
{
  "task_id": 102090894,
  "state": "running",
  "progress": "45%",
  "is_final": false
}
```

**生成成功响应示例**:
```json
{
  "task_id": 102090894,
  "state": "success",
  "progress": "100%",
  "is_final": true,
  "result_url": "https://media.lk888.ai/generated/2026/08/12/img_xxx.png"
}
```

---

## 💻 5. 代码示例 (Code Examples)

### Python API 原生调用示例
```python
import urllib.request
import json
import time

API_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e"
BASE_URL = "https://api.lk888.ai"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 1. 提交任务
gen_payload = {
    "model": "gpt-image-2",
    "prompt": "极简北欧风客厅，阳光照进来，4K建筑摄影",
    "params": {"size": "1920x1088", "quality": "auto", "n": 1}
}
req = urllib.request.Request(f"{BASE_URL}/v1/media/generate", data=json.dumps(gen_payload).encode(), headers=headers)
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    task_id = res.get("data", {}).get("task_id") or res.get("task_id")

# 2. 轮询状态
status_url = f"{BASE_URL}/v1/media/status?task_id={task_id}"
for _ in range(60):
    time.sleep(3)
    req = urllib.request.Request(status_url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        st = json.loads(resp.read().decode())
        data = st.get("data", st)
        if data.get("is_final"):
            print("生成成功！图片URL:", data.get("result_url"))
            break
```

### cURL 示例
```bash
# 提交任务
curl -X POST "https://api.lk888.ai/v1/media/generate" \
  -H "Authorization: Bearer sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "高级奢华香水产品广告拍摄，光影感",
    "params": { "size": "1088x1920", "quality": "auto", "n": 1 }
  }'

# 查询状态 (将 102090894 替换为返回的 task_id)
curl -X GET "https://api.lk888.ai/v1/media/status?task_id=102090894" \
  -H "Authorization: Bearer sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e"
```

---

## 🛠️ 6. 常见问题与最佳实践

1. **图生图（垫图）大小优化**：
   - 上传参考图时，建议将图片最长边限制在 1024px 以内并转为 JPEG/PNG Base64，避免 Payload 过大导致请求失败。
2. **多图融合模式**：
   - 使用 `doubao-seedream-5-0-pro-260628` 支持最多 10 张图融合，在 `params.images` 中传入 base64 数组即可。
3. **网络异常重试**：
   - 轮询过程中若遭遇瞬间网络抖动，系统会自动进行 retry，无需直接放弃任务。
