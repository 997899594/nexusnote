# ============================================
# Docker BuildKit 构建配置
# ============================================

variable "REGISTRY" {
  default = "ghcr.io/997899594"
}

# ============================================
# 目标定义
# ============================================
target "default" {
  dockerfile = "apps/web/Dockerfile"
  tags = [
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

# 数据库迁移专用镜像（基于 builder 阶段，含完整依赖）
target "migration" {
  dockerfile = "apps/web/Dockerfile"
  target = "migration"
  tags = [
    "${REGISTRY}/nexusnote-migration:latest"
  ]
  cache-from = [
    "type=registry,ref=${REGISTRY}/nexusnote:buildcache"
  ]
}

# 多平台构建
target "multi" {
  inherits = ["default"]
  platforms = ["linux/amd64", "linux/arm64"]
}
