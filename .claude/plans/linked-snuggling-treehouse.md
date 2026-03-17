# HeroInput 默认走 Interview + Notes 笔记页

## 背景

NexusNote 是课程为主的学习平台，但 HeroInput 目前默认走 `/chat`。需要：
1. **HeroInput 默认走 `/interview`**，加"随便聊聊"开关切回 `/chat`
2. **新建 `/notes` 页面**，集中查看用户笔记 + 课程标注

---

## Feature 1: HeroInput 默认走 Interview

### 改动文件

**`components/home/HeroInput.tsx`**
- 新增 `mode` state: `"learn"` (默认) | `"chat"`
- `handleSubmit` 分两条路径：
  - `learn` 模式: `startExpand(rect, '/interview?msg=${encodeURIComponent(message)}', message)` — 复用现有 TransitionOverlay
  - `chat` 模式: 保持现有流程 (`setPendingChat` + `/chat/${id}`)
- 输入框下方加一个模式切换按钮（小 pill），用 `GraduationCap` 和 `MessageSquare` 图标

**`app/interview/page.tsx`**
- `InterviewContent` 里加 `markReady()` 调用（复用 `useTransitionStore` 的现有模式，和 ChatPanel 一样）
- 让 TransitionOverlay 在 interview 页加载后正常退场

**`components/chat/ChatPanel.tsx`**
- 删除 `quickIntentDetect` 意图路由（lines 117-123），因为默认路径已经是 interview 了

---

## Feature 2: Notes 笔记页

### 数据来源
1. **用户笔记**: `documents` 表 `type = "document"`，通过 `workspaces.ownerId` 过滤（复用 `RecentSectionServer` 的 join 模式）
2. **课程标注**: `documents` 表 `type = "course_section"`，`metadata->'annotations'` 非空，通过 `courseSessions.userId` 过滤

### 改动文件

**`app/notes/page.tsx`** (新建)
- Server Component，复用 `auth()` + `db` 查询模式（参照 `RecentSectionServer.tsx`）
- 复用 `formatTime` 函数（从 RecentSectionServer 提取或复制）
- 查询用户笔记 + 课程标注数据，传给客户端组件

**`app/notes/NotesClient.tsx`** (新建)
- 两个 tab: "我的笔记" / "课程标注"
- 笔记 tab: 复用 `RecentCard` 组件展示文档列表（title, preview, time, link → `/editor/${id}`）
- 标注 tab: 按课程分组展示标注（高亮文本、笔记内容、颜色标记）
- 复用 `useIsMobile` hook 做响应式
- 复用 `Annotation` 类型（from `hooks/useAnnotations.ts`）

**`components/shared/layout/AppSidebar.tsx`**
- "笔记" href: `/editor` → `/notes`

**`components/shared/layout/MobileNav.tsx`**
- "发现" 替换为 "笔记" (`FileText` 图标, `/notes`)

---

## 复用清单

| 已有代码 | 位置 | 用途 |
|---------|------|------|
| `useTransitionStore.markReady()` | `stores/transition.ts` | Interview 页过渡退场 |
| `TransitionOverlay` | `components/chat/TransitionOverlay.tsx` | 无需改动，支持任意 URL |
| `RecentCard` | `components/home/RecentCard.tsx` | Notes 页笔记列表卡片 |
| `formatTime` | `components/home/RecentSectionServer.tsx` | Notes 页时间显示 |
| `useIsMobile` | `hooks/useIsMobile.ts` | Notes 页响应式 |
| `Annotation` 类型 | `hooks/useAnnotations.ts` | 课程标注数据类型 |
| `auth()` | `lib/auth` | 服务端鉴权 |
| DB join 模式 | `RecentSectionServer.tsx` L133-144 | workspace → documents 查询 |

---

## 验证

1. `bun run lint` + `bun run typecheck` 通过
2. 首页输入 → 默认跳 `/interview?msg=xxx`，过渡动画丝滑
3. 切换"随便聊聊" → 跳 `/chat/${id}`，过渡动画丝滑
4. `/notes` 页：两个 tab 正常显示数据
5. 侧边栏/底部导航"笔记"链接指向 `/notes`
