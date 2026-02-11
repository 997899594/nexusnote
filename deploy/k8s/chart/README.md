# NexusNote Helm Chart 架构说明

## 目录结构

```
chart/
├── Chart.yaml                 # Chart 元信息（名称、版本）
├── values.yaml               # 默认配置值（开发环境，metallb.enabled: false）
├── values-prod.yaml         # 生产环境覆盖值（metallb.enabled: true）
├── values-dev.yaml          # 开发环境覆盖值
└── templates/
    ├── namespace.yaml          # 命名空间
    ├── configmap.yaml         # 配置映射
    ├── certificate.yaml        # TLS 证书
    ├── metallb-config.yaml    # MetalLB IP 池配置（条件渲染）
    ├── infrastructure.yaml     # Gateway + HTTPRoute + Gateway Service (LoadBalancer) + App Service (ClusterIP)
    ├── deployment-web.yaml     # Web 服务部署
    ├── deployment-collab.yaml # 协作服务部署
    ├── deployment-worker.yaml  # 后台任务部署
    ├── stateful.yaml           # StatefulSet（数据库/Redis）
    └── service.yaml            # 服务定义
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
[Service: cilium-gateway-nexusnote-gateway] (LoadBalancer - MetalLB 分配外部 IP 10.2.0.15)
    ↓
[HTTPRoute: nexusnote-route] (路由规则: juanie.art → nexusnote-service:3000)
    ↓
[Service: nexusnote-service] (ClusterIP - 集群内部)
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
  name: nexusnote # 所有资源的隔离边界
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
      name: nexusnote-config # 靠名字匹配
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
    - name: nexusnote-cert # 靠名字匹配
```

---

### 4. metallb-config.yaml - MetalLB 配置（条件渲染）

```yaml
{{- if .Values.metallb.enabled }}
---
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: nexusnote-ip-pool
  namespace: metallb-system
spec:
  addresses:
    - {{ .Values.metallb.addressRange }}
  autoAssign: true
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: l2-advertisement
  namespace: metallb-system
spec:
  ipAddressPools:
    - nexusnote-ip-pool
  interfaces:
    - {{ .Values.metallb.interface }}
{{- end }}
```

**渲染条件**：

- `metallb.enabled: false`（开发环境）→ 不渲染，不创建 MetalLB 配置
- `metallb.enabled: true`（生产环境）→ 渲染，创建 IPAddressPool 和 L2Advertisement

---

## MetalLB 详解

### 为什么需要 MetalLB？

Kubernetes 原生支持 `LoadBalancer` 类型的 Service，但云提供商（AWS、GKE、Azure）才会自动分配外部 IP。在自建集群（如 K3s）中，`LoadBalancer` Service 会一直处于 `Pending` 状态，因为没有控制器来分配外部 IP。

**MetalLB 的作用**：为自建 Kubernetes 集群提供 `LoadBalancer` IP 分配能力。

---

### MetalLB 工作原理

```
用户请求: https://juanie.art
    ↓
[DNS 解析] → MetalLB 分配的外部 IP (如: 192.168.0.240)
    ↓
[L2 通告] → MetalLB 使用 ARP/NDP 协议响应 IP 请求
    ↓
[节点网络] → 数据包到达集群节点
    ↓
[Kube-proxy] → 转发到后端 Pod
    ↓
[nexusnote-web Pod] → 应用处理
```

**L2 模式工作流程**：

1. **IP 分配**：MetalLB 从 IPAddressPool 中选择一个可用 IP（如 192.168.0.240）
2. **Service 绑定**：将 IP 分配给 `nexusnote-service`（LoadBalancer 类型）
3. **L2 通告**：MetalLB Controller 通过 ARP（IPv4）或 NDP（IPv6）协议，在指定网络接口（eth0）上宣告该 IP
4. **流量接收**：外部设备访问该 IP 时，ARP/NDP 请求由 MetalLB 响应，将流量引向集群节点
5. **负载均衡**：kube-proxy 将流量分发到后端 Pod

---

### MetalLB 资源详解

#### IPAddressPool - IP 地址池

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: nexusnote-ip-pool
  namespace: metallb-system
spec:
  addresses:
    - 192.168.0.240-192.168.0.250 # 可分配的 IP 范围（10 个 IP）
  autoAssign: true # 自动分配给 LoadBalancer Service
```

**关键参数**：

| 参数            | 说明                                    | 示例                                                    |
| --------------- | --------------------------------------- | ------------------------------------------------------- |
| `addresses`     | IP 地址范围，支持 CIDR 或范围格式       | `"192.168.0.240-192.168.0.250"` 或 `"192.168.0.240/29"` |
| `autoAssign`    | 是否自动分配 IP 给 LoadBalancer Service | `true`（自动） / `false`（需手动指定）                  |
| `avoidBuggyIPs` | 避免使用网络中的特殊 IP（如 .0, .255）  | `true`                                                  |

**IP 地址选择建议**：

- 确保该 IP 段在局域网内未被使用
- 网段大小取决于需要多少 LoadBalancer Service
- 建议：至少预留 10 个 IP（可扩展）
- 腾讯云内网常见段：`192.168.0.0/16`，`10.0.0.0/8`

---

#### L2Advertisement - L2 通告

```yaml
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: l2-advertisement
  namespace: metallb-system
spec:
  ipAddressPools:
    - nexusnote-ip-pool # 宣告哪些 IP 池
  interfaces:
    - eth0 # 在哪个网络接口上宣告
```

**关键参数**：

| 参数             | 说明                       | 示例                                             |
| ---------------- | -------------------------- | ------------------------------------------------ |
| `ipAddressPools` | 要宣告的 IP 池列表         | `["nexusnote-ip-pool"]`                          |
| `interfaces`     | 宣告 IP 的网络接口         | `["eth0"]`（主网卡）                             |
| `nodeSelectors`  | 限制宣告 IP 的节点（可选） | `matchLabels: {kubernetes.io/hostname: "node1"}` |

**网络接口说明**：

```bash
# 查看服务器网络接口
ip addr show

# 输出示例
1: lo: <LOOPBACK,UP,LOWER_UP>
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP
    inet 192.168.0.15/24 brd 192.168.0.255 scope global eth0
```

- `eth0` 是主网卡，连接到局域网
- `inet 192.168.0.15` 是服务器的实际 IP
- MetalLB 会在 `eth0` 上宣告 `192.168.0.240` 等虚拟 IP

---

### 配置参数详解

#### values.yaml 中的 MetalLB 配置

```yaml
metallb:
  enabled: false # 是否启用 MetalLB 配置
  addressRange: "192.168.0.240-192.168.0.250" # IP 地址池
  interface: "eth0" # 网络接口名称
```

| 参数           | 开发环境 | 生产环境 | 说明                                      |
| -------------- | -------- | -------- | ----------------------------------------- |
| `enabled`      | `false`  | `true`   | 开发环境不需要外部 IP，使用 NodePort 即可 |
| `addressRange` | 同生产   | 同生产   | IP 段必须与服务器网络在同一网段           |
| `interface`    | 同生产   | 同生产   | 通常是 `eth0`，需根据服务器实际配置调整   |

---

### MetalLB 模式对比

| 模式         | 适用场景       | 优点                     | 缺点                                              |
| ------------ | -------------- | ------------------------ | ------------------------------------------------- |
| **L2 模式**  | 单集群、局域网 | 配置简单、无需额外设备   | 单点故障（Leader 宕机后切换需几秒）、不支持跨机房 |
| **BGP 模式** | 多集群、跨机房 | 支持跨机房、负载均衡更好 | 需要路由器支持 BGP、配置复杂                      |

**本项目选择 L2 模式**：

- 单 K3s 集群部署
- 局域网环境
- 配置简单，维护成本低

---

### 部署流程

#### 1. 安装 MetalLB Controller（一次性）

```bash
# 在 K3s 集群中安装 MetalLB
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/main/config/manifests/metallb-native.yaml

# 验证安装
kubectl get pods -n metallb-system
# 预期输出：
# NAME                          READY   STATUS    RESTARTS   AGE
# controller-xxx                1/1     Running   0          1m
# speaker-xxx                  1/1     Running   0          1m
```

**说明**：

- `controller`：管理 IP 分配、监听 Service 变化
- `speaker`：负责 L2 通告（每个节点一个 Pod）

#### 2. 部署应用时自动创建 MetalLB 配置

```bash
# Helm 部署（values-prod.yaml 中 metallb.enabled: true）
helm upgrade --install nexusnote ./chart \
  -f chart/values-prod.yaml \
  --namespace nexusnote \
  --create-namespace

# 自动创建 IPAddressPool 和 L2Advertisement
kubectl get ipaddresspool -n metallb-system
kubectl get l2advertisement -n metallb-system
```

#### 3. 验证 IP 分配

```bash
# 查看 Gateway Service 的类型（首次部署后通常是 ClusterIP）
kubectl get svc cilium-gateway-nexusnote-gateway -n nexusnote

# 预期输出（首次部署）：
# NAME                                TYPE        CLUSTER-IP       PORT(S)
# cilium-gateway-nexusnote-gateway     ClusterIP   10.43.143.90     80/TCP,443/TCP
```

#### 4. 首次部署后手动 Patch Gateway Service（必需）

由于 Cilium Gateway Controller 默认创建 ClusterIP Service，需要手动 Patch 为 LoadBalancer：

```bash
# Patch Gateway Service 为 LoadBalancer
kubectl patch svc cilium-gateway-nexusnote-gateway -n nexusnote \
  -p '{"spec":{"type":"LoadBalancer"}}'

# 验证 Service 是否获得外部 IP
kubectl get svc cilium-gateway-nexusnote-gateway -n nexusnote

# 预期输出：
# NAME                                TYPE           EXTERNAL-IP    PORT(S)
# cilium-gateway-nexusnote-gateway     LoadBalancer   10.2.0.15     80:xxxx/TCP,443:xxxx/TCP
```

**说明**：

- `10.2.0.15` 是服务器的真实内网 IP，由 MetalLB 分配
- `80:xxxx/TCP,443:xxxx/TCP` 表示 NodePort 映射
- 只需手动执行一次，后续部署会保持 LoadBalancer 类型

---

### 故障排查

#### 问题 1：Service 一直处于 Pending 状态

```bash
# 检查 Service 状态
kubectl describe svc nexusnote-service -n nexusnote

# 查看 Events
Events:
  Type     Reason                  Message
  Warning  SyncLoadBalancerFailed  Error syncing load balancer: failed to allocate IP
```

**可能原因**：

- MetalLB Controller 未运行
- IP 池中没有可用 IP
- IPAddressPool 配置错误

**解决方案**：

```bash
# 1. 检查 MetalLB Pod 状态
kubectl get pods -n metallb-system

# 2. 检查 IP 池
kubectl get ipaddresspool -n metallb-system
kubectl describe ipaddresspool nexusnote-ip-pool -n metallb-system

# 3. 查看已分配的 IP
kubectl get service -n nexusnote -o wide

# 4. 查看当前 IP 池使用情况
kubectl get ipaddresspool -n metallb-system -o jsonpath='{.items[*].spec.addresses}'
```

---

#### 问题 2：无法访问外部 IP

```bash
# 测试 IP 是否可达
ping 192.168.0.240
# 如果 ping 不通，说明 L2 通告有问题
```

**可能原因**：

- L2Advertisement 未创建
- 网络接口配置错误
- 防火墙拦截

**解决方案**：

```bash
# 1. 检查 L2Advertisement
kubectl get l2advertisement -n metallb-system
kubectl describe l2advertisement l2-advertisement -n metallb-system

# 2. 检查网络接口
ip addr show eth0

# 3. 查看 Speaker Pod 日志
kubectl logs -n metallb-system -l component=speaker

# 4. 检查防火墙规则
sudo iptables -L -n | grep 192.168.0.240
```

---

#### 问题 3：IP 冲突

```bash
# 如果分配的 IP 已被其他设备使用
```

**解决方案**：

```bash
# 1. 手动释放 IP（删除 Service 后重新创建）
kubectl delete svc nexusnote-service -n nexusnote
# MetalLB 会自动分配新的 IP

# 2. 扫描局域网，找出已占用的 IP
nmap -sn 192.168.0.240-192.168.0.250

# 3. 调整 IP 地址池范围
# 编辑 values-prod.yaml
metallb:
  addressRange: "192.168.0.245-192.168.0.250"  # 缩小范围，避开冲突 IP

# 重新部署
helm upgrade nexusnote ./chart -f chart/values-prod.yaml -n nexusnote
```

---

### 监控 MetalLB

#### 查看已分配的 IP

```bash
# 列出所有 LoadBalancer Service 及其外部 IP
kubectl get svc --all-namespaces -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.namespace}/{.metadata.name}: {.status.loadBalancer.ingress[0].ip}{"\n"}{end}'

# 输出示例：
# nexusnote/nexusnote-service: 192.168.0.240
```

#### 查看分配状态

```bash
# IPAddressPool 详细信息
kubectl get ipaddresspool nexusnote-ip-pool -n metallb-system -o yaml

# 关注字段：
# status:
#   automaticallyAllocated: []    # 自动分配的 IP 列表
```

---

### MetalLB 在整体架构中的位置

```
┌─────────────────────────────────────────────────────────┐
│                     外部网络（局域网）                   │
│                                                         │
│   用户浏览器: https://juanie.art                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓ DNS 解析
┌─────────────────────────────────────────────────────────┐
│              MetalLB 分配的外部 IP: 10.2.0.15           │
│                                                         │
│   L2Advertisement 在 eth0 接口宣告 IP                   │
│   ARP/NDP 协议响应 IP 请求                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    K3s 集群节点                         │
│                                                         │
│   ┌─────────────────────────────────────┐              │
│   │ Gateway Service (LoadBalancer)    │              │
│   │ EXTERNAL-IP: 10.2.0.15         │              │
│   │ 端口: 80, 443                   │              │
│   └─────────────────────────────────────┘              │
│          ↓                                        │
│   ┌─────────────────────────────────────┐              │
│   │ Gateway: nexusnote-gateway        │              │
│   │ (Cilium Gateway Controller 监听) │             │
│   └─────────────────────────────────────┘              │
│          ↓                                        │
│   ┌─────────────────────────────────────┐              │
│   │ HTTPRoute: nexusnote-route       │              │
│   │ juanie.art → nexusnote-service   │              │
│   └─────────────────────────────────────┘              │
│          ↓                                        │
│   ┌─────────────────────────────────────┐              │
│   │ App Service (ClusterIP)           │              │
│   │ 内网转发到 Pod                   │              │
│   └─────────────────────────────────────┘              │
│          ↓                                        │
│   ┌─────────────────────────────────────┐              │
│   │ Pod: nexusnote-web              │              │
│   │ 应用容器                        │              │
│   └─────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

---

### 最佳实践

1. **IP 地址规划**：
   - 预留足够的 IP 池（至少 10 个）
   - 记录已分配的 IP，避免冲突
   - 使用文档化管理 IP 分配情况

2. **网络接口选择**：
   - 使用连接到外部网络的主网卡
   - 避免使用 `docker0` 或 `cilium_*` 等虚拟网卡

3. **监控告警**：
   - 监控 IP 池使用率（超过 80% 时告警）
   - 监控 MetalLB Controller/Speaker Pod 状态
   - 设置 Service Pending 状态告警

4. **高可用考虑**（L2 模式局限）：
   - L2 模式存在 Leader 宕机时切换延迟（几秒）
   - 对于关键服务，可考虑部署多副本并使用健康检查
   - 未来可升级到 BGP 模式以获得更好的 HA

---

### 5. infrastructure.yaml - 基础设施

包含三个资源：

#### 5.1 Gateway - 流量入口

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
          - name: nexusnote-cert # 引用 Certificate
```

**谁监听**：Cilium Gateway Controller（自动）

---

#### 5.2 HTTPRoute - 路由规则

```yaml
kind: HTTPRoute
metadata:
  name: nexusnote-route
spec:
  parentRefs:
    - name: nexusnote-gateway # 引用 Gateway
  hostnames:
    - juanie.art
  rules:
    - backendRefs:
        - name: nexusnote-service # 引用 Service
          port: 3000
```

**作用**：将 `juanie.art` 的请求转发到 `nexusnote-service:3000`

---

#### 5.3 Service - 集群内部服务

```yaml
kind: Service
metadata:
  name: nexusnote-service
spec:
  type: LoadBalancer
  selector:
    app: nexusnote-web # 靠标签匹配 Pod
  ports:
    - port: 3000
      targetPort: 3000
```

**作用**：为 `nexusnote-web` Pod 提供稳定的访问入口
**MetalLB 集成**：当 `metallb.enabled: true` 时，MetalLB 会自动为此 Service 分配外部 IP

---

### 6. deployment-web.yaml - Web 服务部署

```yaml
kind: Deployment
metadata:
  name: nexusnote-web
  labels:
    app: nexusnote-web # 标签
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nexusnote-web # 靠标签选择 Pod
  template:
    metadata:
      labels:
        app: nexusnote-web # Pod 标签
    spec:
      containers:
        - name: app
          envFrom:
            - configMapRef:
                name: nexusnote-config # 靠名字引用
            - secretRef:
                name: nexusnote-secrets # 靠名字引用
```

**关联方式**：

- **标签关联**：`selector.app=nexusnote-web` → Service 找到 Pod
- **名字关联**：`envFrom.configMapRef` → 从 ConfigMap/Secret 读取配置

---

### 7. deployment-collab.yaml / deployment-worker.yaml

同 `deployment-web.yaml`，分别部署：

- `deployment-collab.yaml`：实时协作服务（Hocuspocus）
- `deployment-worker.yaml`：后台任务处理

---

### 8. stateful.yaml - 有状态服务

```yaml
kind: StatefulSet
metadata:
  name: nexusnote-db # 或 nexusnote-redis
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

| 资源 A     | 引用资源 B  | 字段                       |
| ---------- | ----------- | -------------------------- |
| Deployment | ConfigMap   | `configMapRef.name`        |
| Deployment | Secret      | `secretRef.name`           |
| HTTPRoute  | Gateway     | `parentRefs.name`          |
| HTTPRoute  | Service     | `backendRefs.name`         |
| Gateway    | Certificate | `tls.certificateRefs.name` |

**特点**：跨命名空间需要完整引用（如 `namespace/name`）

---

### 2. 标签选择（Selector）

| 资源 A      | 选择资源 B | 字段                   |
| ----------- | ---------- | ---------------------- |
| Service     | Pod        | `selector.matchLabels` |
| Deployment  | Pod        | `selector.matchLabels` |
| StatefulSet | Pod        | `selector.matchLabels` |

**特点**：标签必须完全匹配，用于动态发现 Pod

---

## 部署顺序

Helm 自动处理依赖关系，但逻辑顺序是：

1. **namespace.yaml** - 创建命名空间
2. **certificate.yaml** - 创建证书
3. **configmap.yaml** - 创建配置
4. **metallb-config.yaml** - 创建 MetalLB 配置（条件）
5. **infrastructure.yaml** - 创建 Gateway + Service
6. **stateful.yaml** - 创建数据库（Pod 启动）
7. **deployment-\*.yaml** - 创建应用服务（Pod 启动）
8. **HTTPRoute** - 路由规则生效

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

| 组件            | 用途                                  | 必需性          |
| --------------- | ------------------------------------- | --------------- |
| K3s/Kubernetes  | 集群运行环境                          | ✅ 必需         |
| Cilium          | Gateway Controller，监听 Gateway 资源 | ✅ 必需         |
| Gateway API CRD | 让 K8s 识别 Gateway/HTTPRoute 资源    | ✅ 必需         |
| cert-manager    | 自动签发 TLS 证书                     | ✅ 必需         |
| MetalLB         | 为 LoadBalancer Service 分配外部 IP   | ⚠️ 生产环境需要 |

**安装命令**：

```bash
# Gateway API CRD
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml

# cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# MetalLB（生产环境需要）
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/main/config/manifests/metallb-native.yaml

# Cilium（如果未安装）
cilium install
```

---

## Values 文件完整配置

### values.yaml（默认配置）

```yaml
replicaCount: 1

image:
  repository: ghcr.io/nexusnote/nexusnote
  pullPolicy: IfNotPresent
  tag: "latest"

namespace: nexusnote

env:
  NODE_ENV: "production"
  PORT: "3000"
  HOCUSPOCUS_PORT: "1234"
  NEXT_PUBLIC_APP_URL: "https://juanie.art"
  AUTH_TRUST_HOST: "true"
  NEXTAUTH_URL: "https://juanie.art"

oauth:
  github:
    id: "Ov23li5kloVVHQeOSefR"

database:
  host: nexusnote-db
  port: 5432
  name: nexusnote
  user: postgres
  password: ""

redis:
  host: nexusnote-redis
  port: 6379

metallb:
  enabled: false
  addressRange: "192.168.0.240-192.168.0.250"
  interface: "eth0"

services:
  web:
    name: web
    replicaCount: 1
    resources:
      limits:
        cpu: 500m
        memory: 512Mi
      requests:
        cpu: 100m
        memory: 128Mi
  collab:
    name: collab
    replicaCount: 1
    resources:
      limits:
        cpu: 500m
        memory: 512Mi
      requests:
        cpu: 100m
        memory: 128Mi
  worker:
    name: worker
    replicaCount: 1
    resources:
      limits:
        cpu: 500m
        memory: 512Mi
      requests:
        cpu: 100m
        memory: 128Mi
```

### values-prod.yaml（生产配置）

```yaml
namespace: nexusnote

image:
  repository: ghcr.io/nexusnote/nexusnote
  pullPolicy: IfNotPresent
  tag: "sha-${GITHUB_SHA}"

env:
  NODE_ENV: "production"
  PORT: "3000"
  HOCUSPOCUS_PORT: "1234"
  NEXT_PUBLIC_APP_URL: "https://juanie.art"
  AUTH_TRUST_HOST: "true"
  NEXTAUTH_URL: "https://juanie.art"

oauth:
  github:
    id: "Ov23li5kloVVHQeOSefR"

database:
  host: nexusnote-db
  port: 5432
  name: nexusnote
  user: postgres
  password: ""

redis:
  host: nexusnote-redis
  port: 6379

metallb:
  enabled: true
  addressRange: "192.168.0.240-192.168.0.250"
  interface: "eth0"

services:
  web:
    name: web
    replicaCount: 3
    resources:
      limits:
        cpu: "1000m"
        memory: "1Gi"
      requests:
        cpu: "200m"
        memory: "256Mi"
  collab:
    name: collab
    replicaCount: 3
    resources:
      limits:
        cpu: "1000m"
        memory: "1Gi"
      requests:
        cpu: "200m"
        memory: "256Mi"
  worker:
    name: worker
    replicaCount: 3
    resources:
      limits:
        cpu: "1000m"
        memory: "1Gi"
      requests:
        cpu: "200m"
        memory: "256Mi"
```

**生产与开发差异**：
| 配置 | 开发 (values.yaml) | 生产 (values-prod.yaml) |
|------|-------------------|----------------------|
| metallb.enabled | false | true |
| image.tag | "latest" | "sha-${GITHUB_SHA}" |
| replicaCount | 1 | 3 |
| CPU limits | 500m | 1000m |
| Memory limits | 512Mi | 1Gi |

---

## Chart.yaml 完整配置

```yaml
apiVersion: v2
name: nexusnote
description: NexusNote - AI Course Engine
type: application
version: 1.0.0
appVersion: "0.1.0"

keywords:
  - nexusnote
  - ai
  - education
  - course

maintainers:
  - name: NexusNote Team
    email: team@nexusnote.com
```

---

## 2026 IaC 最佳实践总结

### 设计原则

1. **声明式配置** - 所有资源通过 Helm 模板声明
2. **环境差异化** - 开发/生产配置分离
3. **条件渲染** - MetalLB 等可选组件通过 `{{- if }}` 控制
4. **版本控制** - 所有配置变更通过 Git 追踪
5. **自动化部署** - CI 一键部署，无需手动操作

### 架构优势

```
Git 版本控制
    ↓
Helm Chart (声明式)
    ↓
values-prod.yaml (metallb.enabled: true)
    ↓
templates/metallb-config.yaml (条件渲染)
    ↓
MetalLB IP 池自动配置
    ↓
Service (LoadBalancer) 获得外部 IP
```

### 关键特性

- **条件渲染**：`metallb.enabled` 控制是否创建 MetalLB 配置
- **名字引用**：ConfigMap、Secret、Gateway 通过名字关联
- **标签选择**：Service 通过标签匹配 Pod
- **环境隔离**：namespace 提供资源隔离边界
