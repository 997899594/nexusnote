# ============================================
# Docker BuildKit 构建配置
# ============================================

variable "REGISTRY" {
  default = "ghcr.io/997899594"
}

# ============================================
# Web 应用构建目标
# ============================================
target "web" {
  dockerfile = "Dockerfile.web"
  context = "."
  tags = [
    "${REGISTRY}/nexusnote:latest",
    "${REGISTRY}/nexusnote-web:latest"
  ]
  cache-from = [
    "type=registry,ref=${REGISTRY}/nexusnote:buildcache",
    "type=local,src=/tmp/.buildx-cache"
  ]
  cache-to = [
    "type=registry,ref=${REGISTRY}/nexusnote:buildcache,mode=max",
    "type=local,dest=/tmp/.buildx-cache-new,mode=max"
  ]
}

# 默认目标（兼容旧脚本）
target "default" {
  inherits = ["web"]
}

# 多平台构建
target "multi" {
  inherits = ["web"]
  platforms = ["linux/amd64", "linux/arm64"]
}
