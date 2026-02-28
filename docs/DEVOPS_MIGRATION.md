# NexusNote CI/CD 基础设施迁移指南

**版本**: 1.0.0
**更新日期**: 2026-02-27
**目标**: 完整迁移到自托管 DevOps 平台

---

## 目录

1. [架构概览](#1-架构概览)
2. [核心组件](#2-核心组件)
3. [镜像构建配置](#3-镜像构建配置)
4. [Kubernetes 资源清单](#4-kubernetes-资源清单)
5. [ArgoCD GitOps 配置](#5-argocd-gitops-配置)
6. [Secrets 管理](#6-secrets-管理)
7. [网络与 TLS](#7-网络与-tls)
8. [数据库与持久化](#8-数据库与持久化)
9. [迁移检查清单](#9-迁移检查清单)

---

## 1. 架构概览

### 1.1 当前部署架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD Pipeline                                   │
│                                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌────────────┐ │
│  │  git push   │ ──▶ │ GitHub CI   │ ──▶ │    GHCR     │ ──▶ │   ArgoCD   │ │
│  │   (main)    │     │ (lint+build)│     │ (镜像仓库)   │     │ Image      │ │
│  └─────────────┘     └─────────────┘     └─────────────┘     │ Updater    │ │
│                                                                └─────┬──────┘ │
└──────────────────────────────────────────────────────────────────────│───────┘
                                                                       │
                                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           K3s Kubernetes Cluster                              │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        namespace: nexusnote                             │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐│  │
│  │  │ nexusnote-web  │  │nexusnote-collab│  │    nexusnote-db            ││  │
│  │  │ (Deployment)   │  │ (StatefulSet)  │  │ (PostgreSQL + pgvector)    ││  │
│  │  │    port 3000   │  │   port 1234    │  │       port 5432            ││  │
│  │  └───────┬────────┘  └───────┬────────┘  └────────────────────────────┘│  │
│  │          │                   │            ┌────────────────────────────┐│  │
│  │          │                   │            │    nexusnote-redis         ││  │
│  │          │                   │            │    (Redis 7)               ││  │
│  │          │                   │            │       port 6379            ││  │
│  │          │                   │            └────────────────────────────┘│  │
│  └──────────┼───────────────────┼─────────────────────────────────────────┘  │
│             │                   │                                              │
│  ┌──────────┴───────────────────┴─────────────────────────────────────────┐  │
│  │                    Cilium Gateway API                                   │  │
│  │  ┌────────────────────────────────────────────────────────────────┐    │  │
│  │  │  Gateway: nexusnote-gateway (LB-IP: 10.2.0.15)                  │    │  │
│  │  │  ├── HTTP  (80)  → HTTPS 重定向                                 │    │  │
│  │  │  └── HTTPS (443) → nexusnote-web / nexusnote-collab            │    │  │
│  │  └────────────────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         基础设施组件                                     │  │
│  │  ├── ArgoCD (namespace: argocd)        - GitOps 控制器                  │  │
│  │  ├── ArgoCD Image Updater              - 镜像自动更新                   │  │
│  │  ├── Infisical Operator                - Secrets 同步                   │  │
│  │  ├── Cert-Manager                      - TLS 证书管理                   │  │
│  │  └── MetalLB                           - LoadBalancer IP 分配           │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 GitOps 工作流

```
git push → GitHub Actions (lint + typecheck + build)
    ↓
Docker Build & Push → ghcr.io/997899594/nexusnote:latest
    ↓
ArgoCD Image Updater 检测镜像 digest 变化
    ↓
自动触发 ArgoCD Sync
    ↓
Helm Chart 渲染 → Kubernetes 资源
    ↓
Sync Wave 顺序部署:
  Wave -3: ConfigMap + InfisicalSecret
  Wave -2: PVC + PostgreSQL + Redis
  Wave -1: Gateway
  Wave  1: Migration Job
  Wave  2: Web Deployment
  Wave  3: HTTPRoute
```

---

## 2. 核心组件

### 2.1 版本锁定

| 组件 | 版本 | 用途 |
|------|------|------|
| K3s | latest | Kubernetes 发行版 |
| ArgoCD | 7.7.17 (Helm Chart) | GitOps 控制器 |
| ArgoCD Image Updater | stable | 镜像自动更新 |
| Infisical Operator | 0.10.23 | Secrets 管理 |
| Cert-Manager | v1.15.0 | TLS 证书 |
| PostgreSQL | pgvector/pgvector:0.8.0-pg16 | 主数据库 |
| Redis | 7-alpine | 缓存/队列 |

### 2.2 镜像仓库

```
当前: ghcr.io/997899594/nexusnote:latest
迁移: <your-registry>/nexusnote:latest
```

### 2.3 资源配置

| 服务 | CPU Request | CPU Limit | Memory Request | Memory Limit | Storage |
|------|-------------|-----------|----------------|--------------|---------|
| nexusnote-web | 100m | 500m | 128Mi | 512Mi | - |
| PostgreSQL | 500m | 1000m | 512Mi | 1Gi | 10Gi |
| Redis | 50m | 200m | 64Mi | 256Mi | 1Gi |

---

## 3. 镜像构建配置

### 3.1 Dockerfile.web

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && touch public/.gitkeep
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache dumb-init \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/logs && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next/
COPY --from=builder --chown=nextjs:nodejs /app/public ./public/
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle/

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "start"]
```

### 3.2 docker-bake.hcl

```hcl
variable "REGISTRY" {
  default = "ghcr.io/997899594"
}

target "web" {
  dockerfile = "Dockerfile.web"
  context = "."
  tags = [
    "${REGISTRY}/nexusnote:latest",
    "${REGISTRY}/nexusnote-web:latest"
  ]
  cache-from = [
    "type=registry,ref=${REGISTRY}/nexusnote:buildcache"
  ]
  cache-to = [
    "type=registry,ref=${REGISTRY}/nexusnote:buildcache,mode=max"
  ]
}

target "default" {
  inherits = ["web"]
}

target "multi" {
  inherits = ["web"]
  platforms = ["linux/amd64", "linux/arm64"]
}
```

### 3.3 GitHub Actions CI (迁移参考)

```yaml
# .github/workflows/ci.yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  packages: write

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run typecheck

  build:
    needs: quality-gate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/bake-action@v6
        with:
          files: docker-bake.hcl
          push: true
          set: |
            *.cache-from=type=gha
            *.cache-to=type=gha,mode=max
```

---

## 4. Kubernetes 资源清单

### 4.1 Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nexusnote
```

### 4.2 ConfigMap (非敏感配置)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nexusnote-config
  namespace: nexusnote
data:
  NODE_ENV: "production"
  PORT: "3000"
  HOCUSPOCUS_PORT: "1234"
  NEXT_PUBLIC_APP_URL: "https://your-domain.com"
  AUTH_TRUST_HOST: "true"
  NEXTAUTH_URL: "https://your-domain.com"
  DATABASE_HOST: "nexusnote-db"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "nexusnote"
  DATABASE_USER: "postgres"
  REDIS_HOST: "nexusnote-redis"
  REDIS_PORT: "6379"
```

### 4.3 PostgreSQL StatefulSet

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: nexusnote
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nexusnote-db
  namespace: nexusnote
spec:
  serviceName: nexusnote-db
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: pgvector/pgvector:0.8.0-pg16
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: "nexusnote"
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: nexusnote-secrets
                  key: POSTGRES_PASSWORD
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: db-data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
      volumes:
        - name: db-data
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: nexusnote-db
  namespace: nexusnote
spec:
  type: ClusterIP
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

### 4.4 Redis StatefulSet

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: nexusnote
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nexusnote-redis
  namespace: nexusnote
spec:
  serviceName: nexusnote-redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          command:
            - redis-server
            - --appendonly
            - "yes"
            - --requirepass
            - $(REDIS_PASSWORD)
          env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: nexusnote-secrets
                  key: REDIS_PASSWORD
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: redis-data
              mountPath: /data
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "256Mi"
      volumes:
        - name: redis-data
          persistentVolumeClaim:
            claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: nexusnote-redis
  namespace: nexusnote
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

### 4.5 Web Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexusnote-web
  namespace: nexusnote
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: nexusnote-web
  template:
    metadata:
      labels:
        app: nexusnote-web
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      containers:
        - name: app
          image: <your-registry>/nexusnote:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
          envFrom:
            - configMapRef:
                name: nexusnote-config
            - secretRef:
                name: nexusnote-secrets
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: nexusnote-web
  namespace: nexusnote
spec:
  type: ClusterIP
  selector:
    app: nexusnote-web
  ports:
    - port: 3000
      targetPort: 3000
```

### 4.6 Database Migration Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: nexusnote-db-migrate
  namespace: nexusnote
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: db-migrate
          image: <your-registry>/nexusnote:latest
          command:
            - /bin/sh
            - -c
            - |
              set -e
              echo "Running database migrations..."
              npx drizzle-kit push --config drizzle.config.ts
              echo "Migrations completed."
          envFrom:
            - configMapRef:
                name: nexusnote-config
            - secretRef:
                name: nexusnote-secrets
```

---

## 5. ArgoCD GitOps 配置

### 5.1 安装 ArgoCD

```bash
# Helm 安装
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --version 7.7.17 \
  --set server.extraArgs[0]="--disable-auth"
```

### 5.2 安装 ArgoCD Image Updater

```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/config/install.yaml
```

### 5.3 ArgoCD Project

```yaml
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
```

### 5.4 Root Application (App of Apps)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: <your-git-repo>
    targetRevision: main
    path: deploy/argocd/applications
    directory:
      recurse: false
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### 5.5 生产环境 Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nexusnote-prod
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: nexusnote
  source:
    repoURL: <your-git-repo>
    targetRevision: main
    path: deploy/charts/nexusnote
    helm:
      valueFiles:
        - values.yaml
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: nexusnote
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### 5.6 Image Updater 配置

```yaml
apiVersion: argocd-image-updater.argoproj.io/v1alpha1
kind: ImageUpdater
metadata:
  name: nexusnote-image-updater
  namespace: argocd
spec:
  namespace: argocd
  commonUpdateSettings:
    updateStrategy: "digest"
    allowTags: "regexp:^latest$"
    pullSecret: "pullsecret:argocd/github-registry"
  applicationRefs:
    - namePattern: "nexusnote-prod"
      images:
        - alias: "nexusnote"
          imageName: "<your-registry>/nexusnote:latest"
```

### 5.7 Git 凭证 Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: github-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: <your-git-repo>
  username: <git-username>
  password: <git-token>
```

---

## 6. Secrets 管理

### 6.1 方案一：Infisical Cloud（当前方案）

#### 安装 Operator

```bash
helm repo add infisical https://dl.cloudsmith.io/public/infisical/helm-charts/helm/charts/
helm install infisical-operator infisical/secrets-operator \
  --namespace infisical-operator-system --create-namespace \
  --version 0.10.23
```

#### InfisicalSecret CRD

```yaml
apiVersion: secrets.infisical.com/v1alpha1
kind: InfisicalSecret
metadata:
  name: nexusnote-secrets
  namespace: nexusnote
spec:
  authentication:
    universalAuth:
      credentialsRef:
        secretName: infisical-credentials
        secretNamespace: nexusnote
      secretsScope:
        projectSlug: "nexusnote"
        envSlug: "prod"
        secretsPath: /
        recursive: false
  managedSecretReference:
    secretName: nexusnote-secrets
    secretNamespace: nexusnote
    creationPolicy: Owner
```

#### Infisical 凭证

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: infisical-credentials
  namespace: nexusnote
type: Opaque
stringData:
  clientId: <client-id>
  clientSecret: <client-secret>
```

#### 必需的 Secrets 清单

| Secret Key | 说明 |
|------------|------|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@nexusnote-db:5432/nexusnote` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 |
| `REDIS_URL` | `redis://:PASSWORD@nexusnote-redis:6379` |
| `REDIS_PASSWORD` | Redis 密码 |
| `AUTH_SECRET` | NextAuth 加密密钥 (>=32 字符) |
| `JWT_SECRET` | JWT 签名密钥 (>=32 字符) |
| `AI_302_API_KEY` | AI API Key |
| `DEEPSEEK_API_KEY` | AI API Key (可选) |
| `OPENAI_API_KEY` | AI API Key (可选) |

### 6.2 方案二：Kubernetes Secret（简单方案）

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nexusnote-secrets
  namespace: nexusnote
type: Opaque
stringData:
  DATABASE_URL: "postgresql://postgres:password@nexusnote-db:5432/nexusnote"
  POSTGRES_PASSWORD: "your-password"
  REDIS_URL: "redis://:password@nexusnote-redis:6379"
  REDIS_PASSWORD: "your-redis-password"
  AUTH_SECRET: "your-auth-secret-min-32-chars"
  JWT_SECRET: "your-jwt-secret-min-32-chars"
  AI_302_API_KEY: "sk-xxx"
```

---

## 7. 网络与 TLS

### 7.1 方案一：Cilium Gateway API（当前方案）

#### Gateway

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: nexusnote-gateway
  namespace: nexusnote
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    io.cilium/lb-ipam-ips: "10.2.0.15"  # 你的 LB IP
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: "your-domain.com"
      allowedRoutes:
        namespaces:
          from: Same
    - name: https
      protocol: HTTPS
      port: 443
      hostname: "your-domain.com"
      allowedRoutes:
        namespaces:
          from: Same
      tls:
        mode: Terminate
        certificateRefs:
          - name: nexusnote-tls
```

#### HTTPRoute

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: nexusnote-route
  namespace: nexusnote
spec:
  parentRefs:
    - name: nexusnote-gateway
      sectionName: https
  hostnames:
    - "your-domain.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: nexusnote-web
          port: 3000
---
# HTTP 到 HTTPS 重定向
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: nexusnote-redirect
  namespace: nexusnote
spec:
  parentRefs:
    - name: nexusnote-gateway
      sectionName: http
  hostnames:
    - "your-domain.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
```

### 7.2 方案二：Ingress + Nginx（通用方案）

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexusnote-ingress
  namespace: nexusnote
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - your-domain.com
      secretName: nexusnote-tls
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nexusnote-web
                port:
                  number: 3000
```

### 7.3 Cert-Manager ClusterIssuer

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

---

## 8. 数据库与持久化

### 8.1 存储配置

| PVC | 大小 | 用途 |
|-----|------|------|
| postgres-pvc | 10Gi | PostgreSQL 数据 |
| redis-pvc | 1Gi | Redis AOF 持久化 |

### 8.2 备份 CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: nexusnote
spec:
  schedule: "0 2 * * *"  # 每日 2:00 UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:16
              command:
                - /bin/sh
                - -c
                - |
                  pg_dump -h nexusnote-db -U postgres nexusnote > /backup/nexusnote-$(date +%Y%m%d).sql
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: nexusnote-secrets
                      key: POSTGRES_PASSWORD
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
```

---

## 9. 迁移检查清单

### 9.1 准备阶段

- [ ] 准备目标 Kubernetes 集群 (K3s/其他)
- [ ] 配置镜像仓库访问权限
- [ ] 配置 Git 仓库访问权限
- [ ] 准备域名和 DNS 配置
- [ ] 准备 TLS 证书或配置 Cert-Manager

### 9.2 基础设施安装

- [ ] 安装 ArgoCD
- [ ] 安装 ArgoCD Image Updater
- [ ] 安装 Infisical Operator (或准备 Secrets 方案)
- [ ] 安装 Cert-Manager
- [ ] 配置 LoadBalancer (MetalLB/云 LB)

### 9.3 配置迁移

- [ ] 创建 namespace: nexusnote
- [ ] 配置 Git 凭证 Secret
- [ ] 配置镜像仓库凭证 Secret
- [ ] 配置 Infisical 凭证或手动创建 Secrets
- [ ] 更新 values-prod.yaml 中的域名
- [ ] 更新 ClusterIssuer 中的邮箱

### 9.4 部署验证

- [ ] 部署 ArgoCD Applications
- [ ] 验证 PostgreSQL 就绪
- [ ] 验证 Redis 就绪
- [ ] 验证 Migration Job 成功
- [ ] 验证 Web Deployment 就绪
- [ ] 验证 TLS 证书签发
- [ ] 验证 HTTPS 访问

### 9.5 数据迁移 (如需)

- [ ] 导出原数据库数据
- [ ] 导入到新数据库
- [ ] 验证数据完整性

### 9.6 切换流量

- [ ] 更新 DNS 记录指向新集群
- [ ] 验证服务可访问
- [ ] 监控错误日志

---

## 附录 A：Helm Chart 结构

```
deploy/charts/nexusnote/
├── Chart.yaml              # Chart 元数据
├── values.yaml             # 默认配置
├── values-prod.yaml        # 生产覆盖
└── templates/
    ├── _helpers.tpl        # 模板函数
    ├── configmap.yaml      # 非敏感配置
    ├── infisical-secret.yaml # Infisical CRD
    ├── infrastructure.yaml # Gateway + HTTPRoute
    ├── stateful.yaml       # PostgreSQL + Redis
    ├── deployment-web.yaml # Web Deployment
    ├── service.yaml        # Services
    ├── migration-job.yaml  # DB Migration
    └── backup-cronjob.yaml # 备份任务
```

## 附录 B：常用命令

```bash
# 查看 ArgoCD 应用状态
kubectl get applications -n argocd

# 手动触发同步
argocd app sync nexusnote-prod

# 查看 Pod 日志
kubectl logs -n nexusnote -l app=nexusnote-web

# 进入数据库
kubectl exec -it -n nexusnote nexusnote-db-0 -- psql -U postgres -d nexusnote

# 查看 Secrets 同步状态
kubectl describe infisicalsecret -n nexusnote

# 强制重新部署
kubectl rollout restart deployment/nexusnote-web -n nexusnote
```

## 附录 C：故障排查

### Pod 无法启动

```bash
kubectl describe pod -n nexusnote -l app=nexusnote-web
kubectl logs -n nexusnote -l app=nexusnote-web --previous
```

### Secret 未同步 (Infisical)

```bash
kubectl logs -n infisical-operator-system -l app.kubernetes.io/name=secrets-operator
kubectl describe infisicalsecret nexusnote-secrets -n nexusnote
```

### TLS 证书问题

```bash
kubectl describe certificate -n nexusnote
kubectl logs -n cert-manager -l app=cert-manager
```

### 数据库连接失败

```bash
# 检查数据库 Pod
kubectl get pods -n nexusnote -l app=postgres

# 检查连接
kubectl run pg-test --rm -it --image=postgres:16 -- \
  psql "postgresql://postgres:PASSWORD@nexusnote-db:5432/nexusnote"
```
