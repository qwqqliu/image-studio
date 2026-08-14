#!/usr/bin/env bash
# AI 生图 API 接口 cURL 调用范例集合

API_KEY="sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e"
BASE_URL="https://api.lk888.ai"

echo "=== 1. 提交 GPT Image 2 生图任务 ==="
CREATE_RES=$(curl -s -X POST "${BASE_URL}/v1/media/generate" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "一只未来科幻风格的机械猫，极简线条，高质感金属，3D渲染",
    "params": {
      "size": "1088x1920",
      "quality": "auto",
      "n": 1
    }
  }')

echo "返回响应: ${CREATE_RES}"
TASK_ID=$(echo "${CREATE_RES}" | grep -o '"task_id":[0-9]*' | cut -d':' -f2)

if [ -n "${TASK_ID}" ]; then
  echo ""
  echo "=== 2. 轮询任务状态 (Task ID: ${TASK_ID}) ==="
  curl -s -X GET "${BASE_URL}/v1/media/status?task_id=${TASK_ID}" \
    -H "Authorization: Bearer ${API_KEY}"
  echo ""
fi
