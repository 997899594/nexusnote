# Next 16 Dynamic Boundary Architecture

日期：2026-03-31

## Why This Exists

NexusNote has `cacheComponents: true` enabled in [next.config.js](/Users/findbiao/projects/nexusnote/next.config.js).

That means Server Components are evaluated under Next.js 16 Cache Components / Partial Prerendering
rules. Under this model, any page or server island that reads request-bound state must establish an
explicit dynamic boundary first.

Typical request-bound state includes:

- `auth()`
- `requireAuth()`
- `cookies()`
- `headers()`
- request-derived redirects

If we do not declare the boundary explicitly, production can fail with:

- `DYNAMIC_SERVER_USAGE`
- hidden 500s in Server Components render

## Architecture Rule

Use this split everywhere:

1. Static or cacheable data:
   - keep in `"use cache"` server functions
   - use `cacheTag()` / `cacheLife()` for invalidation
2. Request-bound auth/session logic:
   - always enter through `await connection()`
3. Personalized islands inside otherwise cacheable pages:
   - isolate into a small Server Component
   - wrap with `Suspense`
   - call `connection()` only inside that island

## Project Standard

Use [page-auth.ts](/Users/findbiao/projects/nexusnote/lib/server/page-auth.ts) instead of manually
mixing `connection()` and `auth()`.

Available helpers:

- `getDynamicPageSession()`
- `requireDynamicPageAuth(callbackUrl?)`
- `requireDynamicPageUserId(callbackUrl?)`
- `redirectIfUnauthenticated(callbackUrl)`

These helpers encode the invariant:

- page-level auth access must be dynamic
- redirect logic must happen after the dynamic boundary is established

## Approved Patterns

### 1. Auth-required page

```ts
import { requireDynamicPageAuth } from "@/lib/server/page-auth";

export default async function Page() {
  const session = await requireDynamicPageAuth("/target");
  return <div>{session.user.email}</div>;
}
```

### 2. Optional session in a server island

```ts
import { getDynamicPageSession } from "@/lib/server/page-auth";

export async function PersonalizedIsland() {
  const session = await getDynamicPageSession();
  if (!session?.user) return <AnonymousView />;
  return <SignedInView />;
}
```

### 3. Static page + dynamic island

```tsx
<Suspense fallback={<Skeleton />}>
  <PersonalizedIsland />
</Suspense>
```

## Anti-Patterns

Do not do these:

- call `auth()` directly in an app page without `connection()`
- call `requireAuth()` directly in an app page without `connection()`
- put request-bound auth reads inside `"use cache"` functions
- use page-wide dynamic rendering when only one small island needs session data

## Current Coverage

This rule is now applied to:

- [app/interview/page.tsx](/Users/findbiao/projects/nexusnote/app/interview/page.tsx)
- [app/profile/page.tsx](/Users/findbiao/projects/nexusnote/app/profile/page.tsx)
- [app/career-trees/page.tsx](/Users/findbiao/projects/nexusnote/app/career-trees/page.tsx)
- [app/editor/page.tsx](/Users/findbiao/projects/nexusnote/app/editor/page.tsx)
- [app/chat/[id]/page.tsx](/Users/findbiao/projects/nexusnote/app/chat/[id]/page.tsx)
- [app/editor/[id]/page.tsx](/Users/findbiao/projects/nexusnote/app/editor/[id]/page.tsx)
- [app/learn/[id]/page.tsx](/Users/findbiao/projects/nexusnote/app/learn/[id]/page.tsx)
- [components/home/RecentSectionServer.tsx](/Users/findbiao/projects/nexusnote/components/home/RecentSectionServer.tsx)

## Operational Note

A code fix alone is not enough if deployment still serves an old image.

Release correctness for this class of issue requires:

1. code merged
2. GHCR image published for the target SHA
3. deployment updated to that SHA image
4. rollout verified
5. live endpoint checked

Without step 2, Kubernetes may remain on an old working image or get stuck in
`ImagePullBackOff`.
