#!/usr/bin/env bash
# 快捷调用脚本：使用 Python 脚本生成图片
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${SCRIPT_DIR}/generate.py" "$@"
