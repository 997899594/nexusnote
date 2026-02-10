#!/bin/bash

# NexusNote 自动化部署脚本 (2026 Modern Stack)
# 使用 Helm Chart 部署到 K8s

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
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}错误: 未安装 kubectl。${NC}"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo -e "${RED}错误: 未安装 Helm。${NC}"
    exit 1
fi

# 2. 确定部署环境
ENVIRONMENT=${1:-"dev"}

if [ "$ENVIRONMENT" = "prod" ]; then
    VALUES_FILE="./deploy/k8s/chart/values-prod.yaml"
    echo -e "${BLUE}部署环境: 生产环境${NC}"
else
    VALUES_FILE="./deploy/k8s/chart/values-dev.yaml"
    echo -e "${BLUE}部署环境: 开发环境${NC}"
fi

# 3. 安装 External Secrets Operator (如果尚未安装)
echo -e "${BLUE}检查 External Secrets Operator...${NC}"
helm repo add external-secrets https://charts.external-secrets.io || true
helm repo update
helm upgrade --install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets \
  --create-namespace \
  --version 0.10.0 \
  --set installCRDs=true \
  --wait --timeout 10m || true

# 4. 应用 ESO 配置
echo -e "${BLUE}应用 SecretStore 和 ExternalSecret...${NC}"
kubectl apply -f deploy/k8s/secretstore-github.yaml
kubectl apply -f deploy/k8s/externalsecret.yaml

# 5. 等待 ExternalSecret 同步完成
echo -e "${BLUE}等待 ExternalSecret 同步...${NC}"
kubectl wait --for=condition=Ready externalsecret/nexusnote-secrets -n nexusnote --timeout=300s || {
    echo -e "${RED}ERROR: ExternalSecret 同步失败${NC}"
    exit 1
}

# 6. 使用 Helm 部署应用
echo -e "${BLUE}使用 Helm 部署应用...${NC}"
helm upgrade --install nexusnote ./deploy/k8s/chart \
  --namespace nexusnote \
  --create-namespace \
  --values "$VALUES_FILE" \
  --wait --timeout 10m

# 7. 显示部署状态
echo -e "${GREEN}==== 部署完成！ ====${NC}"
echo -e "${BLUE}资源状态:${NC}"
kubectl get pods,svc -n nexusnote

echo -e "\n${BLUE}后续步骤:${NC}"
echo -e "1. 查看 Pod 状态: npm run k8s:status"
echo -e "2. 查看 Web 日志: npm run k8s:logs"
echo -e "3. 查看 Helm 历史: npm run k8s:helm:history"
echo -e "4. 回滚部署: npm run k8s:helm:rollback"
echo -e "5. 查看 ESO 状态: npm run k8s:eso:status"
