#!/bin/bash
# ===========================================
# NexusNote Bootstrap - 2026 最现代化版本
# ===========================================
# 服务器端执行脚本，自动完成所有初始化工作
# 支持幂等执行，可以重复运行

# ===========================================
# 版本锁定
# ===========================================
ARGOCD_VERSION="stable"
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
# 错误处理
# ===========================================
set -E
trap 'log_error "命令执行失败: $BASH_COMMAND (行 $LINENO)"; exit 1' ERR

# ===========================================
# 检查依赖
# ===========================================
check_dependencies() {
    log_info "检查依赖..."

    local missing=()

    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing+=("helm")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "缺少依赖: ${missing[*]}"
        log_info "安装方法:"
        log_info "  kubectl: curl -LO https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        log_info "  helm: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
        exit 1
    fi

    if ! kubectl cluster-info &>/dev/null; then
        log_error "无法连接到 Kubernetes 集群"
        exit 1
    fi

    log_success "依赖检查通过"
}

# ===========================================
# 检查环境变量
# ===========================================
check_env_vars() {
    log_info "检查环境变量..."

    local missing=()

    [[ -z "$GITHUB_TOKEN" ]] && missing+=("GITHUB_TOKEN")
    [[ -z "$GITHUB_USERNAME" ]] && missing+=("GITHUB_USERNAME")
    [[ -z "$INFISICAL_CLIENT_ID" ]] && missing+=("INFISICAL_CLIENT_ID")
    [[ -z "$INFISICAL_CLIENT_SECRET" ]] && missing+=("INFISICAL_CLIENT_SECRET")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "缺少环境变量: ${missing[*]}"
        echo ""
        echo "请设置以下环境变量:"
        echo "  export GITHUB_USERNAME=xxx"
        echo "  export GITHUB_TOKEN=ghp_xxx"
        echo "  export INFISICAL_CLIENT_ID=xxx"
        echo "  export INFISICAL_CLIENT_SECRET=xxx"
        exit 1
    fi

    # 设置默认值
    ENVIRONMENT="${ENVIRONMENT:-prod}"
    INFISICAL_PROJECT_SLUG="${INFISICAL_PROJECT_SLUG:-nexusnote}"
    INFISICAL_ENV_SLUG="${INFISICAL_ENV_SLUG:-$ENVIRONMENT}"

    log_success "环境变量检查通过"
}

# ===========================================
# 1. 安装 ArgoCD
# ===========================================
install_argocd() {
    log_info "[1/7] 安装 ArgoCD..."

    # Core 版本使用 argocd-repo-server 而不是 argocd-server
    if kubectl get namespace argocd &>/dev/null && \
       kubectl get deployment argocd-repo-server -n argocd &>/dev/null; then
        log_warn "ArgoCD 已安装，跳过"
        return
    fi

    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

    local manifest_path="/root/nexusnote-deploy/argocd-install.yaml"

    if [[ -f "$manifest_path" ]]; then
        log_info "使用本地上传的 manifests..."
        kubectl apply -n argocd -f "$manifest_path"
    else
        log_info "从网络下载 manifests..."
        kubectl apply -n argocd -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/core-install.yaml"
    fi

    log_info "等待 ArgoCD 就绪..."
    kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s

    log_success "ArgoCD 安装完成"
}

# ===========================================
# 2. 安装 Infisical Operator
# ===========================================
install_infisical_operator() {
    log_info "[2/7] 安装 Infisical Operator..."

    if kubectl get namespace infisical-operator-system &>/dev/null && \
       kubectl get deployment -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator &>/dev/null; then
        log_warn "Infisical Operator 已安装，跳过"
        return
    fi

    local chart_path="/root/nexusnote-deploy/secrets-operator.tgz"

    if [[ -f "$chart_path" ]]; then
        log_info "使用本地 Helm Chart..."
        helm upgrade --install infisical-operator "$chart_path" \
            --namespace infisical-operator-system \
            --create-namespace \
            --wait
    else
        log_info "从网络下载 Helm Chart..."
        helm repo add infisical-helm-charts 'https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts/' --force-update 2>/dev/null || true
        helm repo update
        helm upgrade --install infisical-operator infisical-helm-charts/secrets-operator \
            --namespace infisical-operator-system \
            --create-namespace \
            --wait
    fi

    log_success "Infisical Operator 安装完成"
}

# ===========================================
# 3. 安装 Cert-Manager
# ===========================================
install_cert_manager() {
    log_info "[3/7] 安装 Cert-Manager..."

    if kubectl get namespace cert-manager &>/dev/null && \
       kubectl get deployment cert-manager -n cert-manager &>/dev/null; then
        log_warn "Cert-Manager 已安装，跳过"
        return
    fi

    helm repo add jetstack https://charts.jetstack.io --force-update 2>/dev/null || true
    helm repo update
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set crds.enabled=true \
        --version "$CERT_MANAGER_VERSION" \
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
  name: default
  namespace: argocd
spec:
  description: Default Project
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

    kubectl create namespace nexusnote --dry-run=client -o yaml | kubectl apply -f - > /dev/null

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
  url: https://github.com/997899594/nexusnote
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

    local root_app_path="/root/nexusnote-deploy/root-app.yaml"

    if [[ -f "$root_app_path" ]]; then
        kubectl apply -f "$root_app_path"
        log_success "Root App 部署完成"
    else
        log_warn "未找到 root-app.yaml，请手动部署"
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

    # ArgoCD (Core 版本检查 repo-server)
    if kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-repo-server -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running"; then
        echo -e "  ArgoCD:             ${GREEN}✅ Running${NC}"
    else
        echo -e "  ArgoCD:             ${YELLOW}⏳ 启动中${NC}"
    fi

    # Infisical Operator
    if kubectl get pods -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running"; then
        echo -e "  Infisical Operator: ${GREEN}✅ Running${NC}"
    else
        echo -e "  Infisical Operator: ${YELLOW}⏳ 启动中${NC}"
    fi

    # Cert-Manager
    if kubectl get pods -n cert-manager -l app.kubernetes.io/name=cert-manager -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running"; then
        echo -e "  Cert-Manager:       ${GREEN}✅ Running${NC}"
    else
        echo -e "  Cert-Manager:       ${YELLOW}⏳ 启动中${NC}"
    fi

    # Root App
    local sync_status=$(kubectl get application root-app -n argocd -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "Unknown")
    case $sync_status in
        Synced) echo -e "  Root App:           ${GREEN}✅ Synced${NC}" ;;
        Unknown|OutOfSync) echo -e "  Root App:           ${YELLOW}⏳ $sync_status${NC}" ;;
        *) echo -e "  Root App:           ${RED}❌ $sync_status${NC}" ;;
    esac

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ===========================================
# 主流程
# ===========================================
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     NexusNote Bootstrap v1.0.0             ║${NC}"
    echo -e "${BLUE}║     2026 最现代化部署工具                   ║${NC}"
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
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           ✅ Bootstrap 完成！               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    echo "环境: $ENVIRONMENT"
    echo "Infisical Project: $INFISICAL_PROJECT_SLUG"
    echo "Infisical Env: $INFISICAL_ENV_SLUG"
    echo ""
    echo "查看应用状态:"
    echo "  kubectl get applications -n argocd"
    echo "  kubectl get pods -n nexusnote"
    echo ""
    echo "访问 ArgoCD:"
    echo "  kubectl port-forward svc/argocd-server -n argocd 8080:443"
    echo "  https://localhost:8080"
    echo ""
    echo "获取 ArgoCD 密码:"
    echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
    echo ""
}

main
