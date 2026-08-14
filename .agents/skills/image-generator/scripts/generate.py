#!/usr/bin/env python3
"""
AI Image Generation Script (LK888 AI Engine)
Supports text-to-image (T2I) and image-to-image (I2I) with automatic polling and downloading.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request

DEFAULT_API_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e"
BASE_URL = "https://api.lk888.ai"

# Aspect Ratio to GPT Image size mapping helper
GPT_SIZE_MAP = {
    "9:16": "1088x1920",
    "16:9": "1920x1088",
    "1:1": "1024x1024",
    "3:4": "1088x1450",
    "4:3": "1450x1088"
}

def encode_image_to_base64(image_input, max_side=1024):
    """Encodes a file path or URL to a base64 data URI (data:image/jpeg;base64,...)"""
    if image_input.startswith("data:image"):
        return image_input
    
    if image_input.startswith("http://") or image_input.startswith("https://"):
        req = urllib.request.Request(image_input, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            mime = resp.headers.get_content_type() or "image/jpeg"
            b64 = base64.b64encode(data).decode('utf-8')
            return f"data:{mime};base64,{b64}"
    
    if os.path.exists(image_input):
        # Try resizing with PIL if available
        try:
            from PIL import Image
            import io
            with Image.open(image_input) as img:
                img = img.convert('RGB')
                w, h = img.size
                if max(w, h) > max_side:
                    if w > h:
                        new_w = max_side
                        new_h = int(h * max_side / w)
                    else:
                        new_h = max_side
                        new_w = int(w * max_side / h)
                    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format='JPEG', quality=85)
                b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
                return f"data:image/jpeg;base64,{b64}"
        except Exception:
            with open(image_input, 'rb') as f:
                data = f.read()
                ext = os.path.splitext(image_input)[1].lower().replace('.', '')
                mime = f"image/{ext}" if ext in ['png', 'jpg', 'jpeg', 'webp'] else "image/jpeg"
                b64 = base64.b64encode(data).decode('utf-8')
                return f"data:{mime};base64,{b64}"
    
    raise ValueError(f"Invalid image path or URL: {image_input}")

def create_task(api_key, model, prompt, aspect_ratio="9:16", size="2K", quality="auto", ref_images=None):
    url = f"{BASE_URL}/v1/media/generate"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    images_payload = []
    if ref_images:
        for img in ref_images:
            images_payload.append(encode_image_to_base64(img))

    payload = {
        "model": model,
        "prompt": prompt,
        "params": {}
    }

    if model == "gpt-image-2":
        gpt_size = GPT_SIZE_MAP.get(aspect_ratio, size if "x" in size else "1088x1920")
        payload["params"] = {
            "size": gpt_size,
            "quality": quality,
            "n": 1
        }
        if images_payload:
            payload["params"]["images"] = images_payload
    elif model == "gemini-3-pro-image-preview":
        payload["params"] = {
            "aspectRatio": aspect_ratio,
            "imageSize": size if size in ["1K", "2K", "4K"] else "2K"
        }
        if images_payload:
            payload["params"]["images"] = images_payload
    elif model == "doubao-seedream-5-0-pro-260628":
        payload["params"] = {
            "aspect_ratio": aspect_ratio,
            "size": size if size in ["1K", "2K", "4K"] else "2K"
        }
        if images_payload:
            payload["params"]["images"] = images_payload[:10]
    else:
        payload["params"] = {
            "aspect_ratio": aspect_ratio,
            "size": size
        }
        if images_payload:
            payload["params"]["images"] = images_payload

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))

    task_id = res_data.get("task_id") or res_data.get("data", {}).get("task_id")
    if not task_id and isinstance(res_data.get("data"), dict):
        task_ids = res_data.get("data", {}).get("task_ids") or res_data.get("data", {}).get("任务ids")
        if task_ids and len(task_ids) > 0:
            task_id = task_ids[0]
            
    if not task_id:
        direct_url = (res_data.get("url") or 
                      res_data.get("data", {}).get("url") or 
                      (isinstance(res_data.get("data"), list) and res_data["data"][0].get("url")))
        if direct_url:
            return {"direct_url": direct_url, "res_data": res_data}
        raise RuntimeError(f"Failed to create task, response: {json.dumps(res_data, ensure_ascii=False)}")

    return {"task_id": str(task_id), "res_data": res_data}

def poll_task_status(api_key, task_id, timeout=180, interval=3.0):
    url = f"{BASE_URL}/v1/media/status?task_id={task_id}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    start_time = time.time()
    attempts = 0

    while time.time() - start_time < timeout:
        attempts += 1
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            sys.stderr.write(f"[WARN] Status poll network jitter ({attempts}): {e}\n")
            time.sleep(interval)
            continue

        data = res_data.get("data") if (isinstance(res_data.get("data"), dict) and "is_final" in res_data["data"]) else res_data

        is_final = data.get("is_final", False)
        state = data.get("state", "running")
        progress = data.get("progress", "0")
        result_url = data.get("result_url") or data.get("url")

        sys.stderr.write(f"\r[STATUS] Task {task_id}: {state} ({progress}%) ... ")
        sys.stderr.flush()

        if is_final:
            sys.stderr.write("\n")
            if state == "success" and result_url:
                return result_url
            else:
                fail_msg = data.get("error") or data.get("msg") or f"Task state: {state}"
                raise RuntimeError(f"Image generation failed: {fail_msg}")

        time.sleep(interval)

    sys.stderr.write("\n")
    raise TimeoutError(f"Task {task_id} timed out after {timeout} seconds")

def download_image(url, output_path):
    sys.stderr.write(f"[INFO] Downloading generated image from {url} to {output_path}\n")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read()
    
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(content)
    sys.stderr.write(f"[SUCCESS] Saved image to {output_path}\n")

def main():
    parser = argparse.ArgumentParser(description="LK888 AI Image Generator CLI")
    parser.add_argument("--prompt", "-p", required=True, help="Image prompt text")
    parser.add_argument("--model", "-m", default="gpt-image-2", choices=["gpt-image-2", "gemini-3-pro-image-preview", "doubao-seedream-5-0-pro-260628"], help="AI Model ID")
    parser.add_argument("--aspect-ratio", "-ar", default="9:16", help="Aspect ratio (e.g., 9:16, 16:9, 1:1)")
    parser.add_argument("--size", "-s", default="2K", help="Image size / resolution (e.g. 2K, 4K, 1088x1920)")
    parser.add_argument("--quality", "-q", default="auto", choices=["auto", "hd", "standard"], help="GPT image quality")
    parser.add_argument("--ref-images", "-i", nargs="*", help="Reference image paths or URLs for Image-to-Image (I2I)")
    parser.add_argument("--output", "-o", help="Output file path to save the generated image (e.g. result.jpg)")
    parser.add_argument("--api-key", default=os.getenv("LK888_API_KEY", DEFAULT_API_KEY), help="LK888 API Key")
    parser.add_argument("--timeout", type=int, default=180, help="Polling timeout in seconds")

    args = parser.parse_args()

    try:
        sys.stderr.write(f"[START] Submitting image generation task...\n")
        sys.stderr.write(f" Model: {args.model}\n Prompt: {args.prompt}\n Aspect Ratio: {args.aspect_ratio}\n")

        task_res = create_task(
            api_key=args.api_key,
            model=args.model,
            prompt=args.prompt,
            aspect_ratio=args.aspect_ratio,
            size=args.size,
            quality=args.quality,
            ref_images=args.ref_images
        )

        if "direct_url" in task_res:
            image_url = task_res["direct_url"]
        else:
            task_id = task_res["task_id"]
            sys.stderr.write(f"[CREATED] Task ID: {task_id}\n")
            image_url = poll_task_status(args.api_key, task_id, timeout=args.timeout)

        if args.output:
            download_image(image_url, args.output)

        out_json = {
            "status": "success",
            "model": args.model,
            "prompt": args.prompt,
            "image_url": image_url,
            "saved_file": os.path.abspath(args.output) if args.output else None
        }
        print(json.dumps(out_json, ensure_ascii=False, indent=2))

    except Exception as e:
        sys.stderr.write(f"[ERROR] {e}\n")
        err_json = {
            "status": "error",
            "error": str(e)
        }
        print(json.dumps(err_json, ensure_ascii=False, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
