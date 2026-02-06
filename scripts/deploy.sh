#!/bin/bash

# NexusNote 自动化部署脚本 (2026 Modern Stack)
# 支持环境: Local Development, Production (VPS/Tencent Cloud)
# 服务器: 49.232.237.136
# 域名: www.juanie.art

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
cd "$PROJECT_ROOT"

echo -e "${BLUE}==== NexusNote 部署脚本启动 ====${NC}"

# 1. 检查基础环境
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: 未安装 Docker。${NC}"
    exit 1
fi

# 2. 准备环境变量
if [ ! -f .env ]; then
    echo -e "${BLUE}正在从 .env.example 创建 .env 文件...${NC}"
    cp .env.example .env
    
    # 生成随机密钥
    AUTH_SECRET=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 32)
    
    # 使用 Python 进行跨平台替换 (macOS/Linux sed 差异较大)
    python3 -c "
import sys
content = open('.env').read()
content = content.replace('your-random-32-char-auth-secret-change-in-production', '$AUTH_SECRET')
content = content.replace('your-random-32-char-secret-key-change-in-production', '$JWT_SECRET')
open('.env', 'w').write(content)
"
    
    # 设置域名相关的环境变量
    echo "PUBLIC_API_URL=https://www.juanie.art/api" >> .env
    echo "PUBLIC_COLLAB_URL=wss://www.juanie.art/collab" >> .env
    
    echo -e "${GREEN}已生成 .env 文件。请手动编辑并填入 AI API Key (AI_302_API_KEY 等)。${NC}"
    echo -e "${BLUE}命令: nano .env${NC}"
    
    # 如果是交互式终端，则退出引导用户修改；否则继续尝试启动
    if [ -t 0 ]; then
        exit 0
    fi
fi

# 3. 执行部署操作 (K3s 现代化流程)
echo -e "${BLUE}正在执行 K3s 现代化部署流程...${NC}"

# 1. 确保命名空间存在
kubectl create namespace nexusnote --dry-run=client -o yaml | kubectl apply -f -

# 2. 更新 Secret
if [ -f .env ]; then
    kubectl create secret generic nexusnote-secrets --from-env-file=.env -n nexusnote --dry-run=client -o yaml | kubectl apply -f -
else
    echo -e "${RED}错误: 未找到 .env 文件。${NC}"
    exit 1
fi

# 3. 应用 Kubernetes 配置
echo -e "${BLUE}应用基础架构、有状态服务和应用配置...${NC}"
kubectl apply -f deploy/k8s/infrastructure.yaml
kubectl apply -f deploy/k8s/stateful.yaml

# 处理 app.yaml 中的镜像占位符
IMAGE_TAG=${1:-"williambridges/juanie:latest"}
sed "s|IMAGE_PLACEHOLDER|$IMAGE_TAG|g" deploy/k8s/app.yaml | kubectl apply -f -

# 4. 滚动更新
echo -e "${BLUE}执行滚动更新...${NC}"
kubectl rollout restart deployment/nexusnote-app -n nexusnote
kubectl rollout status deployment/nexusnote-app -n nexusnote

echo -e "${GREEN}==== K3s 部署完成！ ====${NC}"
echo -e "${BLUE}资源状态:${NC}"
kubectl get pods,svc,gateway,httproute -n nexusnote

echo -e "\n${BLUE}后续步骤:${NC}"
echo -e "1. 查看应用日志: kubectl logs -f deployment/nexusnote-app -n nexusnote"
echo -e "2. 检查网关状态: kubectl get gateway -n nexusnote"
