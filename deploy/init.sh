#!/bin/bash
# ===========================================
# NexusNote Deploy - 2026 最现代化部署工具
# ===========================================
# 本地执行入口，自动完成所有部署工作
#
# 用法：
#   ./deploy.sh                    # 交互式输入
#   ./deploy.sh --config deploy.env # 从配置文件读取
#   ./deploy.sh --env prod         # 指定环境

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认值
DEFAULT_ENV="prod"
DEFAULT_SERVER=""
CONFIG_FILE=""
AUTO_CONFIRM=false

# ===========================================
# 帮助信息
# ===========================================
show_help() {
    echo ""
    echo -e "${BLUE}NexusNote Deploy - 2026 最现代化部署工具${NC}"
    echo ""
    echo "用法："
    echo "  ./deploy.sh                        # 交互式输入"
    echo "  ./deploy.sh --config deploy.env    # 从配置文件读取"
    echo "  ./deploy.sh --env prod --server root@1.2.3.4"
    echo ""
    echo "选项："
    echo "  -c, --config FILE    配置文件路径"
    echo "  -e, --env ENV        环境 (dev/staging/prod)"
    echo "  -s, --server SERVER  服务器地址 (root@ip)"
    echo "  -y, --yes            跳过确认"
    echo "  -h, --help           显示帮助"
    echo "  -v, --version        显示版本"
    echo ""
    echo "首次部署："
    echo "  1. 复制配置文件: cp deploy.env.example deploy.env"
    echo "  2. 编辑配置文件: vim deploy.env"
    echo "  3. 执行部署: ./deploy.sh --config deploy.env"
    echo ""
}

# ===========================================
# 解析参数
# ===========================================
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--server)
            SERVER="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "NexusNote Deploy v1.0.0"
            exit 0
            ;;
        -y|--yes)
            AUTO_CONFIRM=true
            shift
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# ===========================================
# 加载配置
# ===========================================
load_config() {
    if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
        echo -e "${BLUE}📁 加载配置文件: $CONFIG_FILE${NC}"
        set -a
        source "$CONFIG_FILE"
        set +a
    fi

    # 设置默认值
    ENVIRONMENT="${ENVIRONMENT:-$DEFAULT_ENV}"
    SERVER="${SERVER:-$DEFAULT_SERVER}"
}

# ===========================================
# 交互式输入
# ===========================================
interactive_input() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     NexusNote 部署配置向导                  ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""

    # 服务器地址
    if [[ -z "$SERVER" ]]; then
        read -p "🖥️  服务器地址 (如 root@1.2.3.4): " SERVER
    fi

    # 环境
    if [[ -z "$ENVIRONMENT" ]]; then
        echo ""
        echo "选择部署环境:"
        echo "  1) dev (开发)"
        echo "  2) staging (预发布)"
        echo "  3) prod (生产)"
        read -p "请选择 [1-3, 默认 3]: " env_choice
        case $env_choice in
            1) ENVIRONMENT="dev" ;;
            2) ENVIRONMENT="staging" ;;
            *) ENVIRONMENT="prod" ;;
        esac
    fi

    # GitHub Token
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo ""
        echo -e "${YELLOW}需要 GitHub Personal Access Token 访问私有仓库${NC}"
        echo "创建地址: https://github.com/settings/tokens"
        read -p "🔑 GitHub Token: " GITHUB_TOKEN
    fi

    # GitHub 用户名
    if [[ -z "$GITHUB_USERNAME" ]]; then
        read -p "👤 GitHub 用户名 (或输入 x-access-token): " GITHUB_USERNAME
        GITHUB_USERNAME="${GITHUB_USERNAME:-x-access-token}"
    fi

    # Infisical 凭证
    if [[ -z "$INFISICAL_CLIENT_ID" ]]; then
        echo ""
        echo -e "${YELLOW}需要 Infisical Machine Identity 凭证${NC}"
        echo "获取地址: https://app.infisical.com/settings/access/machine-identities"
        read -p "🔐 Infisical Client ID: " INFISICAL_CLIENT_ID
    fi

    if [[ -z "$INFISICAL_CLIENT_SECRET" ]]; then
        read -p "🔐 Infisical Client Secret: " INFISICAL_CLIENT_SECRET
    fi

    echo ""
}

# ===========================================
# 验证配置
# ===========================================
validate_config() {
    local missing=()

    [[ -z "$SERVER" ]] && missing+=("SERVER (服务器地址)")
    [[ -z "$GITHUB_TOKEN" ]] && missing+=("GITHUB_TOKEN (GitHub Token)")
    [[ -z "$INFISICAL_CLIENT_ID" ]] && missing+=("INFISICAL_CLIENT_ID")
    [[ -z "$INFISICAL_CLIENT_SECRET" ]] && missing+=("INFISICAL_CLIENT_SECRET")

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo -e "${RED}❌ 缺少必要配置:${NC}"
        for item in "${missing[@]}"; do
            echo -e "   - $item"
        done
        echo ""
        echo "请设置环境变量或使用 --config 指定配置文件"
        exit 1
    fi

    # 验证服务器连接
    echo -e "${BLUE}🔍 验证服务器连接...${NC}"
    echo -e "${YELLOW}   如果需要密码，请输入${NC}"
    if ! ssh -o ConnectTimeout=30 "$SERVER" "echo 'connection ok'"; then
        echo -e "${RED}❌ 无法连接到服务器: $SERVER${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 服务器连接正常${NC}"
}

# ===========================================
# 打包文件
# ===========================================
prepare_files() {
    echo ""
    echo -e "${BLUE}📦 准备部署文件...${NC}"

    TEMP_DIR=$(mktemp -d)

    # 1. 复制脚本和配置
    cp "$SCRIPT_DIR/bootstrap.sh" "$TEMP_DIR/"
    cp "$SCRIPT_DIR/argocd/root-app.yaml" "$TEMP_DIR/"

    # 2. 下载 Helm Chart（始终在本地下载）
    echo -e "${BLUE}   下载 Infisical Operator Helm Chart...${NC}"
    if [[ -f "$SCRIPT_DIR/secrets-operator.tgz" ]]; then
        echo -e "${GREEN}   使用已缓存的文件${NC}"
        cp "$SCRIPT_DIR/secrets-operator.tgz" "$TEMP_DIR/"
    else
        curl -sLo "$TEMP_DIR/secrets-operator.tgz" \
            "https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts/secrets-operator-0.10.23.tgz"
        # 缓存到本地，下次不用重新下载
        cp "$TEMP_DIR/secrets-operator.tgz" "$SCRIPT_DIR/"
    fi

    # 3. 下载 ArgoCD manifests（可选，加速国内服务器）
    echo -e "${BLUE}   下载 ArgoCD manifests...${NC}"
    if [[ -f "$SCRIPT_DIR/argocd-install.yaml" ]]; then
        echo -e "${GREEN}   使用已缓存的文件${NC}"
        cp "$SCRIPT_DIR/argocd-install.yaml" "$TEMP_DIR/"
    else
        curl -sLo "$TEMP_DIR/argocd-install.yaml" \
            "https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/core-install.yaml"
        cp "$TEMP_DIR/argocd-install.yaml" "$SCRIPT_DIR/"
    fi

    echo -e "${GREEN}✅ 文件准备完成${NC}"
}

# ===========================================
# 上传文件
# ===========================================
upload_files() {
    echo ""
    echo -e "${BLUE}📤 上传文件到服务器...${NC}"

    ssh "$SERVER" "mkdir -p /root/nexusnote-deploy"
    scp "$TEMP_DIR"/* "$SERVER:/root/nexusnote-deploy/"

    echo -e "${GREEN}✅ 文件上传完成${NC}"
}

# ===========================================
# 执行部署
# ===========================================
execute_deploy() {
    echo ""
    echo -e "${BLUE}🚀 开始部署...${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    ssh "$SERVER" \
        "ENVIRONMENT='$ENVIRONMENT' \
         GITHUB_USERNAME='$GITHUB_USERNAME' \
         GITHUB_TOKEN='$GITHUB_TOKEN' \
         INFISICAL_CLIENT_ID='$INFISICAL_CLIENT_ID' \
         INFISICAL_CLIENT_SECRET='$INFISICAL_CLIENT_SECRET' \
         bash /root/nexusnote-deploy/bootstrap.sh"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ===========================================
# 清理
# ===========================================
cleanup() {
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup EXIT

# ===========================================
# 主流程
# ===========================================
main() {
    load_config

    # 如果必要配置缺失，进入交互式输入
    if [[ -z "$SERVER" || -z "$GITHUB_TOKEN" || -z "$INFISICAL_CLIENT_ID" ]]; then
        interactive_input
    fi

    validate_config

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           部署配置确认                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  服务器: $SERVER"
    echo "  环境:   $ENVIRONMENT"
    echo "  仓库:   https://github.com/997899594/nexusnote"
    echo ""

    if [[ "$AUTO_CONFIRM" == true ]]; then
        echo "  [自动确认]"
    else
        read -p "确认开始部署? [y/N]: " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "已取消"
            exit 0
        fi
    fi

    prepare_files
    upload_files
    execute_deploy

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           ✅ 部署完成！                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    echo "后续操作:"
    echo ""
    echo "  1. 访问应用: https://juanie.art"
    echo ""
    echo "  2. 查看 ArgoCD:"
    echo "     kubectl port-forward svc/argocd-server -n argocd 8080:443"
    echo "     打开 https://localhost:8080"
    echo ""
    echo "  3. 获取 ArgoCD 密码:"
    echo "     kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
    echo ""
    echo "  4. 日常更新只需:"
    echo "     git push"
    echo ""
}

main
