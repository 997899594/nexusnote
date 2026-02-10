# ============================================
# Docker BuildKit 构建配置
# ============================================

variable "IMAGE_TAG" {
  default = "latest"
}

variable "REGISTRY" {
  default = "ghcr.io/nexusnote"
}

# ============================================
# 目标定义
# ============================================
target "default" {
  dockerfile = "apps/web/Dockerfile"
  tags = [
    "${REGISTRY}/nexusnote:${IMAGE_TAG}",
    "${REGISTRY}/nexusnote:latest"
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

# 多平台构建
target "multi" {
  inherits = ["default"]
  platforms = ["linux/amd64", "linux/arm64"]
}

# 开发构建
target "dev" {
  dockerfile = "apps/web/Dockerfile"
  tags = ["${REGISTRY}/nexusnote:dev"]
  target = "builder"
  cache-from = [
    "type=local,src=/tmp/.buildx-cache"
  ]
  cache-to = [
    "type=local,dest=/tmp/.buildx-cache-new,mode=max"
  ]
}
