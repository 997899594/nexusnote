# NexusNote Helm Chart 架构说明

## 目录结构

```
chart/
├── Chart.yaml              # Chart 元信息（名称、版本）
├── values.yaml              # 默认配置值
├── values-prod.yaml        # 生产环境覆盖值
├── values-dev.yaml         # 开发环境覆盖值
└── templates/
    ├── namespace.yaml        # 命名空间
    ├── configmap.yaml       # 配置映射
    ├── certificate.yaml      # TLS 证书
    ├── infrastructure.yaml   # Gateway + HTTPRoute + Service
    ├── deployment-web.yaml   # Web 服务部署
    ├── deployment-collab.yaml # 协作服务部署
    ├── deployment-worker.yaml   # 后台任务部署
    ├── stateful.yaml        # StatefulSet（数据库/Redis）
    └── service.yaml         # 服务定义
```

---

## 资源关联关系图

```
外部流量
    ↓
[Cilium Gateway Controller] (自动监听 Gateway 资源)
    ↓
[Gateway: nexusnote-gateway] (80/443 端口)
    ↓
[HTTPRoute: nexusnote-route] (路由规则: juanie.art → nexusnote-service:3000)
    ↓
[Service: nexusnote-service] (LoadBalancer)
    ↓
[Deployment: nexusnote-web] (selector: app=nexusnote-web)
    ↓
[Pod: nexusnote-web-*]
    ↓
[ConfigMap: nexusnote-config] ← 环境变量来源
[Secret: nexusnote-secrets]   ← 敏感配置来源
```

---

## 各模板文件详解

### 1. namespace.yaml - 命名空间
```yaml
kind: Namespace
metadata:
  name: nexusnote  # 所有资源的隔离边界
```
**作用**：创建 `nexusnote` 命名空间，所有后续资源都在此命名空间下。

---

### 2. configmap.yaml - 配置映射
```yaml
kind: ConfigMap
metadata:
  name: nexusnote-config
data:
  NODE_ENV: "production"
  PORT: "3000"
  DATABASE_HOST: nexusnote-db
  # ... 其他公开配置
```
**被谁使用**：`deployment-*.yaml`

**关联方式**（名字引用）：
```yaml
# deployment-web.yaml
envFrom:
  - configMapRef:
      name: nexusnote-config  # 靠名字匹配
```

---

### 3. certificate.yaml - TLS 证书
```yaml
kind: Certificate
metadata:
  name: nexusnote-cert
spec:
  secretName: nexusnote-tls
  dnsNames:
    - juanie.art
```
**被谁使用**：`infrastructure.yaml` 的 Gateway

**关联方式**（名字引用）：
```yaml
# infrastructure.yaml
tls:
  certificateRefs:
    - name: nexusnote-cert  # 靠名字匹配
```

---

### 4. infrastructure.yaml - 基础设施
包含三个资源：

#### 4.1 Gateway - 流量入口
```yaml
kind: Gateway
metadata:
  name: nexusnote-gateway
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        certificateRefs:
          - name: nexusnote-cert  # 引用 Certificate
```
**谁监听**：Cilium Gateway Controller（自动）

---

#### 4.2 HTTPRoute - 路由规则
```yaml
kind: HTTPRoute
metadata:
  name: nexusnote-route
spec:
  parentRefs:
    - name: nexusnote-gateway  # 引用 Gateway
  hostnames:
    - juanie.art
  rules:
    - backendRefs:
        - name: nexusnote-service  # 引用 Service
          port: 3000
```
**作用**：将 `juanie.art` 的请求转发到 `nexusnote-service:3000`

---

#### 4.3 Service - 集群内部服务
```yaml
kind: Service
metadata:
  name: nexusnote-service
spec:
  type: LoadBalancer
  selector:
    app: nexusnote-web  # 靠标签匹配 Pod
  ports:
    - port: 3000
      targetPort: 3000
```
**作用**：为 `nexusnote-web` Pod 提供稳定的访问入口

---

### 5. deployment-web.yaml - Web 服务部署
```yaml
kind: Deployment
metadata:
  name: nexusnote-web
  labels:
    app: nexusnote-web  # 标签
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nexusnote-web  # 靠标签选择 Pod
  template:
    metadata:
      labels:
        app: nexusnote-web  # Pod 标签
    spec:
      containers:
        - name: app
          envFrom:
            - configMapRef:
                name: nexusnote-config  # 靠名字引用
            - secretRef:
                name: nexusnote-secrets  # 靠名字引用
```
**关联方式**：
- **标签关联**：`selector.app=nexusnote-web` → Service 找到 Pod
- **名字关联**：`envFrom.configMapRef` → 从 ConfigMap/Secret 读取配置

---

### 6. deployment-collab.yaml / deployment-worker.yaml
同 `deployment-web.yaml`，分别部署：
- `deployment-collab.yaml`：实时协作服务（Hocuspocus）
- `deployment-worker.yaml`：后台任务处理

---

### 7. stateful.yaml - 有状态服务
```yaml
kind: StatefulSet
metadata:
  name: nexusnote-db  # 或 nexusnote-redis
spec:
  serviceName: nexusnote-db-service
  selector:
    matchLabels:
      app: nexusnote-db
```
**作用**：部署数据库、Redis 等需要持久化存储的服务

---

## Kubernetes 关联机制总结

### 1. 名字引用（Ref）
| 资源 A | 引用资源 B | 字段 |
|---------|------------|------|
| Deployment | ConfigMap | `configMapRef.name` |
| Deployment | Secret | `secretRef.name` |
| HTTPRoute | Gateway | `parentRefs.name` |
| HTTPRoute | Service | `backendRefs.name` |
| Gateway | Certificate | `tls.certificateRefs.name` |

**特点**：跨命名空间需要完整引用（如 `namespace/name`）

---

### 2. 标签选择（Selector）
| 资源 A | 选择资源 B | 字段 |
|---------|------------|------|
| Service | Pod | `selector.matchLabels` |
| Deployment | Pod | `selector.matchLabels` |
| StatefulSet | Pod | `selector.matchLabels` |

**特点**：标签必须完全匹配，用于动态发现 Pod

---

## 部署顺序

Helm 自动处理依赖关系，但逻辑顺序是：

1. **namespace.yaml** - 创建命名空间
2. **certificate.yaml** - 创建证书
3. **configmap.yaml** - 创建配置
4. **infrastructure.yaml** - 创建 Gateway + Service
5. **stateful.yaml** - 创建数据库（Pod 启动）
6. **deployment-*.yaml** - 创建应用服务（Pod 启动）
7. **HTTPRoute** - 路由规则生效

---

## 数据流向示例

### HTTP 请求流程
```
用户浏览器: https://juanie.art
    ↓
[HTTPS 加密] (nexusnote-tls 证书)
    ↓
[Cilium Gateway Controller] (监听 Gateway 资源)
    ↓
[HTTPRoute 匹配] (hostnames: juanie.art)
    ↓
[Service: nexusnote-service] (转发到端口 3000)
    ↓
[Pod: nexusnote-web-*] (通过标签 selector: app=nexusnote-web 找到)
    ↓
[应用处理请求]
    ↓
[读取配置] envFrom → ConfigMap + Secret
    ↓
[返回响应]
```

---

## 需要的外部组件

| 组件 | 用途 | 必需性 |
|------|------|--------|
| K3s/Kubernetes | 集群运行环境 | ✅ 必需 |
| Cilium | Gateway Controller，监听 Gateway 资源 | ✅ 必需 |
| Gateway API CRD | 让 K8s 识别 Gateway/HTTPRoute 资源 | ✅ 必需 |
| cert-manager | 自动签发 TLS 证书 | ✅ 必需 |

**安装命令**：
```bash
# Gateway API CRD
kubectl apply -f https://ghproxy.com/https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml

# cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Cilium（如果未安装）
cilium install
```
