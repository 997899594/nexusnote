#!/bin/bash

# ============================================
# External Secrets Operator 安装脚本
# ============================================

set -e

echo "=== Installing External Secrets Operator ==="

# 添加 ESO Helm 仓库
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

# 安装 ESO 到 external-secrets 命名空间
helm upgrade --install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets \
  --create-namespace \
  --version 0.10.0 \
  --set installCRDs=true \
  --wait

# 验证安装
echo "=== Verifying External Secrets Operator installation ==="
kubectl wait --for=condition=available deployment/external-secrets -n external-secrets --timeout=300s

echo "=== External Secrets Operator installed successfully ==="
