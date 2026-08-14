#!/usr/bin/env python3
"""
Zeabur 一键部署脚本
通过 Zeabur GraphQL API + Upload API 完成全自动部署
"""

import json
import os
import ssl
import sys
import zipfile
import io
import urllib.request
import urllib.parse
import time

ZEABUR_TOKEN = "zat_6a7e93d450c907e4f227bc29_bwctdc5bxamkizoiuteq2cksdolfummq"
API_URL = "https://api.zeabur.com/graphql"
PROJECT_NAME = "image-studio"
SERVICE_NAME = "image-studio"

# 跳过 SSL 验证（本机代理可能干扰证书链）
ctx = ssl._create_unverified_context()

def graphql(query, variables=None):
    """发送 GraphQL 请求"""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, headers={
        "Authorization": f"Bearer {ZEABUR_TOKEN}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, context=ctx) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    if "errors" in body:
        print(f"[GraphQL Error] {json.dumps(body['errors'], ensure_ascii=False, indent=2)}")
    return body.get("data", body)

def get_me():
    """获取当前用户信息"""
    print("[1/6] 正在验证 Zeabur Token...")
    data = graphql("query { me { _id username email } }")
    me = data.get("me", {})
    print(f"  ✅ 登录成功: {me.get('username', 'unknown')} ({me.get('email', '')})")
    return me

def list_projects():
    """获取项目列表"""
    data = graphql("""
        query {
            me {
                projects {
                    _id
                    name
                    services {
                        _id
                        name
                    }
                    environments {
                        _id
                        name
                    }
                }
            }
        }
    """)
    return data.get("me", {}).get("projects", [])

def create_project(region="hkg"):
    """创建新项目"""
    print(f"[2/6] 正在创建 Zeabur 项目 ({PROJECT_NAME})...")
    data = graphql("""
        mutation($name: String!, $region: String!) {
            createProject(name: $name, region: $region) {
                _id
                name
            }
        }
    """, {"name": PROJECT_NAME, "region": region})
    project = data.get("createProject", {})
    print(f"  ✅ 项目已创建: {project.get('name', '')} (ID: {project.get('_id', '')})")
    return project

def get_environments(project_id):
    """获取项目环境列表"""
    data = graphql("""
        query($projectID: ObjectID!) {
            project(_id: $projectID) {
                environments {
                    _id
                    name
                }
            }
        }
    """, {"projectID": project_id})
    return data.get("project", {}).get("environments", [])

def create_service(project_id):
    """创建服务"""
    print(f"[3/6] 正在创建服务 ({SERVICE_NAME})...")
    data = graphql("""
        mutation($projectID: ObjectID!, $name: String!) {
            createService(projectID: $projectID, template: PREBUILT, name: $name) {
                _id
                name
            }
        }
    """, {"projectID": project_id, "name": SERVICE_NAME})
    service = data.get("createService", {})
    print(f"  ✅ 服务已创建: {service.get('name', '')} (ID: {service.get('_id', '')})")
    return service

def create_zip_buffer(dist_dir):
    """将 dist 目录打包为 ZIP（内存中）"""
    print("[4/6] 正在打包构建产物...")
    buf = io.BytesIO()
    file_count = 0
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(dist_dir):
            # 排除 node_modules 和隐藏目录
            dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '.agents', 'skills')]
            for f in files:
                filepath = os.path.join(root, f)
                arcname = os.path.relpath(filepath, dist_dir)
                zf.write(filepath, arcname)
                file_count += 1
    buf.seek(0)
    size_kb = len(buf.getvalue()) / 1024
    print(f"  ✅ 打包完成: {file_count} 个文件, {size_kb:.1f} KB")
    return buf

def deploy_zip(project_id, service_id, environment_id, zip_buffer):
    """通过 Upload API 部署 ZIP"""
    print("[5/6] 正在上传并部署到 Zeabur...")
    
    # 使用 multipart/form-data 上传
    boundary = "----ZeaburDeployBoundary"
    
    # 构建 multipart body
    body_parts = []
    
    # 添加 environment_id 字段
    body_parts.append(f"--{boundary}\r\n")
    body_parts.append(f'Content-Disposition: form-data; name="environment_id"\r\n\r\n')
    body_parts.append(f"{environment_id}\r\n")
    
    # 添加 ZIP 文件
    body_parts.append(f"--{boundary}\r\n")
    body_parts.append(f'Content-Disposition: form-data; name="code"; filename="code.zip"\r\n')
    body_parts.append(f"Content-Type: application/zip\r\n\r\n")
    
    # 构建完整的二进制 body
    pre_file = "".join(body_parts).encode("utf-8")
    post_file = f"\r\n--{boundary}--\r\n".encode("utf-8")
    zip_data = zip_buffer.read()
    
    full_body = pre_file + zip_data + post_file
    
    upload_url = f"https://api.zeabur.com/v2/deploy/zip?projectID={project_id}&serviceID={service_id}"
    
    req = urllib.request.Request(upload_url, data=full_body, headers={
        "Authorization": f"Bearer {ZEABUR_TOKEN}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }, method="POST")
    
    with urllib.request.urlopen(req, context=ctx) as resp:
        result = resp.read().decode("utf-8")
        print(f"  ✅ 部署请求已提交!")
        try:
            return json.loads(result)
        except:
            return {"raw": result}

def add_domain(service_id, environment_id):
    """为服务添加自动域名"""
    print("[6/6] 正在生成访问域名...")
    data = graphql("""
        mutation($serviceID: ObjectID!, $environmentID: ObjectID!, $isGenerated: Boolean!) {
            addDomain(serviceID: $serviceID, environmentID: $environmentID, isGenerated: $isGenerated) {
                domain
            }
        }
    """, {"serviceID": service_id, "environmentID": environment_id, "isGenerated": True})
    domain = data.get("addDomain", {}).get("domain", "")
    if domain:
        print(f"  ✅ 域名已分配: https://{domain}")
    return domain

def main():
    # 构建 dist
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
    if not os.path.exists(dist_dir):
        print("[BUILD] dist 目录不存在, 先执行 npm run build...")
        os.system("npm run build")
    
    if not os.path.exists(dist_dir):
        print("[ERROR] 构建失败，dist 目录不存在")
        sys.exit(1)
    
    # Step 1: 验证身份
    me = get_me()
    
    # Step 2: 查找或创建项目
    projects = list_projects()
    project = None
    for p in projects:
        if p.get("name") == PROJECT_NAME:
            project = p
            print(f"[2/6] 找到已有项目: {p['name']} (ID: {p['_id']})")
            break
    
    if not project:
        project = create_project()
    
    project_id = project["_id"]
    
    # 获取环境 ID
    environments = get_environments(project_id)
    if not environments:
        print("[WARN] 未找到环境，使用默认 production 环境")
        environment_id = None
    else:
        environment_id = environments[0]["_id"]
        print(f"  环境: {environments[0]['name']} (ID: {environment_id})")
    
    # Step 3: 查找或创建服务
    service = None
    for s in project.get("services", []):
        if s.get("name") == SERVICE_NAME:
            service = s
            print(f"[3/6] 找到已有服务: {s['name']} (ID: {s['_id']})")
            break
    
    if not service:
        service = create_service(project_id)
    
    service_id = service["_id"]
    
    # Step 4: 打包 dist
    zip_buf = create_zip_buffer(dist_dir)
    
    # Step 5: 上传部署
    result = deploy_zip(project_id, service_id, environment_id, zip_buf)
    print(f"  部署结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    # Step 6: 生成域名
    if environment_id:
        domain = add_domain(service_id, environment_id)
    
    print("\n" + "=" * 60)
    print("🎉 部署完成！请稍等 1-2 分钟等待构建完成后访问。")
    print("=" * 60)

if __name__ == "__main__":
    main()
