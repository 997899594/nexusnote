# Next.js 16 页面边界规范

日期：2026-04-01

## 背景

NexusNote 开启了 `cacheComponents: true`。这意味着页面中只要读取了请求期数据，例如：

- `auth()`
- `requireAuth()`
- `cookies()`
- `headers()`
- `searchParams`
- `params`

就必须显式建立动态边界，并把阻塞式读取放进局部 `Suspense` 内。否则会触发：

- `DYNAMIC_SERVER_USAGE`
- `blocking-route`
- 强刷后页面先出现再回退为空白 fallback

## 规则

### 1. 不要在根布局兜底整站

禁止在 [app/layout.tsx](/Users/findbiao/projects/nexusnote/app/layout.tsx) 用空白 `Suspense` fallback 包住整个 `{children}`。

原因：

- 它会掩盖真实的页面级边界错误
- 一旦某个路由阻塞，整页会回退成 blank fallback
- 线上表现就是“强刷后短暂显示，再变空白”

### 2. 页面级动态读取必须下沉到局部边界

正确模式：

1. 页面默认导出同步组件
2. 真正的动态读取放进 `PageContent`
3. 用局部 `Suspense` 包裹 `PageContent`

```tsx
import { Suspense } from "react";

async function PageContent() {
  const session = await getDynamicPageSession();
  return <div>...</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <PageContent />
    </Suspense>
  );
}
```

### 3. 鉴权只走 `lib/server/page-auth.ts`

不要在页面里混写 `connection()` + `auth()`。

统一使用：

- [getDynamicPageSession](/Users/findbiao/projects/nexusnote/lib/server/page-auth.ts)
- [requireDynamicPageAuth](/Users/findbiao/projects/nexusnote/lib/server/page-auth.ts)
- [requireDynamicPageUserId](/Users/findbiao/projects/nexusnote/lib/server/page-auth.ts)

### 4. route layout 里如果包了 client layout，也要有局部边界

像 `/chat/[id]` 这种页面，即使 page 自己有 `Suspense`，如果外层 route layout 先挂了 client layout，也可能把未缓存动态数据冒到更高层。

这类路由要把 `Suspense` 下沉到 route layout。

## 检查清单

新增或修改页面时，逐项确认：

- 页面是否读取了 `params/searchParams`
- 页面是否读取了 `auth/cookies/headers`
- 页面是否调用了 `"use cache"` 的服务端加载函数
- 动态读取是否放在局部 `PageContent`
- 是否有明确的局部 `Suspense fallback`
- 是否错误地依赖根布局 fallback 兜底

## 已知参考实现

- [app/chat/layout.tsx](/Users/findbiao/projects/nexusnote/app/chat/layout.tsx)
- [app/editor/page.tsx](/Users/findbiao/projects/nexusnote/app/editor/page.tsx)
- [app/editor/[id]/page.tsx](/Users/findbiao/projects/nexusnote/app/editor/[id]/page.tsx)
- [app/career-trees/page.tsx](/Users/findbiao/projects/nexusnote/app/career-trees/page.tsx)
- [app/interview/page.tsx](/Users/findbiao/projects/nexusnote/app/interview/page.tsx)
- [app/learn/[id]/page.tsx](/Users/findbiao/projects/nexusnote/app/learn/[id]/page.tsx)
- [app/profile/page.tsx](/Users/findbiao/projects/nexusnote/app/profile/page.tsx)
