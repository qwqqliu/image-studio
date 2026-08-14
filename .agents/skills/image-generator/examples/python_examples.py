#!/usr/bin/env python3
"""
Python API 调用范例集合
包含: 文生图、图生图(参考图垫图)、多图融合及轮询逻辑
"""

import urllib.request
import json
import time
import base64

API_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e"
BASE_URL = "https://api.lk888.ai"

def generate_image_t2i():
    """1. 文生图 (Text to Image) 示例"""
    url = f"{BASE_URL}/v1/media/generate"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "gpt-image-2",
        "prompt": "一只穿雨衣的小狗在雨中踩水坑，可爱插画风格，高细节，色彩丰富",
        "params": {
            "size": "1088x1920",
            "quality": "auto",
            "n": 1
        }
    }

    print("[T2I] 正在提交任务...")
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
    
    task_id = res.get("data", {}).get("task_id") or res.get("task_id")
    print(f"[T2I] 任务提交成功，Task ID: {task_id}")
    return task_id

def poll_status(task_id):
    """2. 任务状态轮询"""
    url = f"{BASE_URL}/v1/media/status?task_id={task_id}"
    headers = {"Authorization": f"Bearer {API_KEY}"}

    for attempt in range(60):
        time.sleep(3)
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            st = data.get("data", data)
            print(f"轮询状态: {st.get('state')} ({st.get('progress')}%)")
            if st.get("is_final"):
                if st.get("state") == "success":
                    print("生成完成! 图片地址:", st.get("result_url"))
                    return st.get("result_url")
                else:
                    raise RuntimeError(f"生成失败: {st.get('error')}")
    raise TimeoutError("任务超时")

if __name__ == "__main__":
    task_id = generate_image_t2i()
    if task_id:
        poll_status(task_id)
