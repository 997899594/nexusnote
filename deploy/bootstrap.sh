#!/bin/bash
# ===========================================
# NexusNote Bootstrap - 2026 最现代化版本
# ===========================================
# 服务器端执行脚本，自动完成所有初始化工作
# 支持幂等执行，自动处理冲突

set -e

# ===========================================
# 版本锁定
# ===========================================
ARGOCD_VERSION="7.7.17"
INFISICAL_OPERATOR_VERSION="0.10.23"
CERT_MANAGER_VERSION="v1.15.0"

# ===========================================
# 颜色输出
# ===========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ===========================================
# 日志函数
# ===========================================
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ===========================================
# 工作目录
# ===========================================
WORK_DIR="/root/nexusnote-deploy"

# ===========================================
# 检查依赖
# ===========================================
check_dependencies() {
    log_info "检查依赖..."

    command -v kubectl >/dev/null 2>&1 || { log_error "缺少 kubectl"; exit 1; }
    command -v helm >/dev/null 2>&1 || { log_error "缺少 helm"; exit 1; }

    kubectl cluster-info &>/dev/null || { log_error "无法连接 Kubernetes"; exit 1; }

    log_success "依赖检查通过"
}

# ===========================================
# 检查环境变量
# ===========================================
check_env_vars() {
    log_info "检查环境变量..."

    [[ -z "$GITHUB_TOKEN" ]] && { log_error "缺少 GITHUB_TOKEN"; exit 1; }
    [[ -z "$GITHUB_USERNAME" ]] && { log_error "缺少 GITHUB_USERNAME"; exit 1; }
    [[ -z "$INFISICAL_CLIENT_ID" ]] && { log_error "缺少 INFISICAL_CLIENT_ID"; exit 1; }
    [[ -z "$INFISICAL_CLIENT_SECRET" ]] && { log_error "缺少 INFISICAL_CLIENT_SECRET"; exit 1; }

    ENVIRONMENT="${ENVIRONMENT:-prod}"
    INFISICAL_PROJECT_SLUG="${INFISICAL_PROJECT_SLUG:-nexusnote}"
    INFISICAL_ENV_SLUG="${INFISICAL_ENV_SLUG:-$ENVIRONMENT}"

    log_success "环境变量检查通过"
}

# ===========================================
# 安全删除资源（忽略不存在和错误）
# ===========================================
safe_delete() {
    local resource_type="$1"
    shift
    for resource in "$@"; do
        kubectl delete "$resource_type" "$resource" --ignore-not-found 2>/dev/null || true
    done
}

# ===========================================
# 1. 安装 ArgoCD
# ===========================================
install_argocd() {
    log_info "[1/7] 安装 ArgoCD..."

    if kubectl get deployment argocd-application-controller -n argocd &>/dev/null; then
        log_warn "ArgoCD 已安装，跳过"
        return
    fi

    local chart="$WORK_DIR/argo-cd-${ARGOCD_VERSION}.tgz"
    [[ ! -f "$chart" ]] && { log_error "未找到 $chart"; exit 1; }

    helm upgrade --install argocd "$chart" \
        --namespace argocd --create-namespace \
        --set server.extraArgs[0]="--disable-auth" \
        --wait --timeout 5m

    log_success "ArgoCD 安装完成"
}

# ===========================================
# 2. 安装 Infisical Operator
# ===========================================
install_infisical_operator() {
    log_info "[2/7] 安装 Infisical Operator..."

    if kubectl get deployment -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator &>/dev/null; then
        log_warn "Infisical Operator 已安装，跳过"
        return
    fi

    local chart="$WORK_DIR/secrets-operator-${INFISICAL_OPERATOR_VERSION}.tgz"
    [[ ! -f "$chart" ]] && { log_error "未找到 $chart"; exit 1; }

    helm upgrade --install infisical-operator "$chart" \
        --namespace infisical-operator-system --create-namespace \
        --wait

    log_success "Infisical Operator 安装完成"
}

# ===========================================
# 3. 安装 Cert-Manager
# ===========================================
install_cert_manager() {
    log_info "[3/7] 安装 Cert-Manager..."

    if kubectl get deployment cert-manager -n cert-manager &>/dev/null; then
        log_warn "Cert-Manager 已安装，跳过"
        return
    fi

    # 彻底清理旧资源
    log_info "清理旧资源..."
    kubectl get crd -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} --ignore-not-found 2>/dev/null || true
    kubectl get clusterrole -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} --ignore-not-found 2>/dev/null || true
    kubectl get clusterrolebinding -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} --ignore-not-found 2>/dev/null || true
    kubectl get role -n kube-system -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} -n kube-system --ignore-not-found 2>/dev/null || true
    kubectl get rolebinding -n kube-system -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} -n kube-system --ignore-not-found 2>/dev/null || true
    kubectl get validatingwebhookconfiguration -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} --ignore-not-found 2>/dev/null || true
    kubectl get mutatingwebhookconfiguration -o name 2>/dev/null | grep cert-manager | xargs -I{} kubectl delete {} --ignore-not-found 2>/dev/null || true
    kubectl delete namespace cert-manager --ignore-not-found 2>/dev/null || true

    local chart="$WORK_DIR/cert-manager-${CERT_MANAGER_VERSION}.tgz"
    [[ ! -f "$chart" ]] && { log_error "未找到 $chart"; exit 1; }

    helm upgrade --install cert-manager "$chart" \
        --namespace cert-manager --create-namespace \
        --set crds.enabled=true \
        --wait

    log_success "Cert-Manager 安装完成"
}

# ===========================================
# 4. 创建 ArgoCD Project
# ===========================================
create_argocd_project() {
    log_info "[4/7] 创建 ArgoCD Project..."

    kubectl apply -f - <<EOF >/dev/null
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: nexusnote
  namespace: argocd
spec:
  description: NexusNote Project
  sourceRepos:
    - '*'
  destinations:
    - namespace: '*'
      server: '*'
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'
EOF

    log_success "ArgoCD Project 创建完成"
}

# ===========================================
# 5. 创建 Namespace
# ===========================================
create_namespace() {
    log_info "[5/7] 创建 Namespace..."

    kubectl create namespace nexusnote --dry-run=client -o yaml | kubectl apply -f - >/dev/null

    log_success "Namespace 创建完成"
}

# ===========================================
# 6. 配置 Git 凭证
# ===========================================
configure_git_credentials() {
    log_info "[6/7] 配置 Git 凭证..."

    kubectl apply -f - <<EOF >/dev/null
apiVersion: v1
kind: Secret
metadata:
  name: github-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: https://gitclone.com/github.com/997899594/nexusnote
  username: ${GITHUB_USERNAME}
  password: ${GITHUB_TOKEN}
EOF

    log_success "Git 凭证配置完成"
}

# ===========================================
# 7. 配置 Infisical 凭证
# ===========================================
configure_infisical_credentials() {
    log_info "[7/7] 配置 Infisical 凭证..."

    kubectl apply -f - <<EOF >/dev/null
apiVersion: v1
kind: Secret
metadata:
  name: infisical-credentials
  namespace: nexusnote
type: Opaque
stringData:
  clientId: ${INFISICAL_CLIENT_ID}
  clientSecret: ${INFISICAL_CLIENT_SECRET}
EOF

    log_success "Infisical 凭证配置完成"
}

# ===========================================
# 8. 部署 Root App
# ===========================================
deploy_root_app() {
    log_info "[8/8] 部署 Root App..."

    local root_app="$WORK_DIR/root-app.yaml"
    if [[ -f "$root_app" ]]; then
        kubectl apply -f "$root_app"
        log_success "Root App 部署完成"
    else
        log_warn "未找到 root-app.yaml"
    fi
}

# ===========================================
# 健康检查
# ===========================================
health_check() {
    log_info "执行健康检查..."

    echo ""
    echo "组件状态:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-server -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running" \
        && echo -e "  ArgoCD:             ${GREEN}✅ Running${NC}" \
        || echo -e "  ArgoCD:             ${YELLOW}⏳ 启动中${NC}"

    kubectl get pods -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running" \
        && echo -e "  Infisical Operator: ${GREEN}✅ Running${NC}" \
        || echo -e "  Infisical Operator: ${YELLOW}⏳ 启动中${NC}"

    kubectl get pods -n cert-manager -l app.kubernetes.io/name=cert-manager -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running" \
        && echo -e "  Cert-Manager:       ${GREEN}✅ Running${NC}" \
        || echo -e "  Cert-Manager:       ${YELLOW}⏳ 启动中${NC}"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ===========================================
# 主流程
# ===========================================
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     NexusNote Bootstrap v1.0.0             ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""

    check_dependencies
    check_env_vars

    install_argocd
    install_infisical_operator
    install_cert_manager
    create_argocd_project
    create_namespace
    configure_git_credentials
    configure_infisical_credentials
    deploy_root_app

    health_check

    echo ""
    echo -e "${GREEN}✅ Bootstrap 完成！${NC}"
    echo ""
    echo "环境: $ENVIRONMENT"
    echo ""
    echo "查看状态: kubectl get pods -A | grep -E 'argocd|infisical|cert-manager'"
    echo "访问 ArgoCD: kubectl port-forward svc/argocd-server -n argocd 8080:443"
    echo "获取密码: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
    echo ""
}

main
