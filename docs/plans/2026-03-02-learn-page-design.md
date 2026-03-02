# 课程学习页面设计

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan.

**Goal:** 创建课程学习页面 `/learn/[sessionId]`，左右分栏布局，复用 Editor 组件，支持禅模式沉浸式学习。

**Architecture:** 左侧大纲导航 + 右侧 Tiptap 编辑器，数据从 courseSessions 和 documents 表获取。

**Tech Stack:** Next.js App Router, React 19, Framer Motion, Tiptap, Zustand

---

## 1. 路由设计

| 路由 | 描述 |
|------|------|
| `/learn/[sessionId]` | 课程学习页面，sessionId 对应 courseSessions.id |
| `/learn/[sessionId]?chapter=2` | 可选：指定章节，默认第一章 |

---

## 2. 页面布局

### 2.1 标准模式（左右分栏）

```
┌──────────────────────────────────────────────────────────────┐
│  [← 返回]  Python 入门课程                     进度 3/10    │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│  第一章        │         Editor (Tiptap)                     │
│  ✅ 环境搭建   │                                             │
│                │     # Python 环境搭建                       │
│  第二章        │                                             │
│  ✅ 基础语法   │     Python 是一门简洁优雅的编程语言...      │
│                │                                             │
│  第三章 ← 当前 │                                             │
│  ● 条件语句    │                                             │
│                │                                             │
│  第四章        │                                             │
│  ○ 循环结构    │                                             │
│                │                                             │
│  第五章        │                                             │
│  ○ 函数定义    │                                             │
│                │                    [禅模式 🧘]              │
└────────────────┴─────────────────────────────────────────────┘
```

### 2.2 禅模式（沉浸式学习）

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│                     # Python 条件语句                        │
│                                                              │
│         条件语句用于根据条件执行不同的代码块...              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                            [Esc 退出禅模式]                  │
└──────────────────────────────────────────────────────────────┘
```

**禅模式特点：**
- 隐藏左侧面板
- 隐藏顶栏
- 全屏编辑器
- 按 `Esc` 或点击按钮退出

---

## 3. 组件结构

```
app/learn/[id]/
├── page.tsx                    # 页面入口（Server Component）
├── LearnClient.tsx             # 客户端组件（状态管理）
└── components/
    ├── LearnSidebar.tsx        # 左侧边栏
    ├── ChapterList.tsx         # 章节列表
    └── ZenModeToggle.tsx       # 禅模式切换按钮
```

### 3.1 组件职责

| 组件 | 职责 |
|------|------|
| `page.tsx` | 获取课程数据，渲染 LearnClient |
| `LearnClient` | 管理当前章节、禅模式状态，布局协调 |
| `LearnSidebar` | 显示课程标题、章节列表、进度、返回按钮 |
| `ChapterList` | 章节列表渲染，点击切换章节 |
| `ZenModeToggle` | 禅模式切换按钮（悬浮或固定位置） |

---

## 4. 数据流

```
URL: /learn/[sessionId]

         │
         ▼
┌─────────────────────────────────┐
│  courseSessions 表              │
│  - id, title, outlineData       │
│  - progress (当前章节)          │
└─────────────────────────────────┘
         │
         │ outlineData.chapters
         ▼
┌─────────────────────────────────┐
│  documents 表                   │
│  - courseId = sessionId         │
│  - outlineNodeId = "chapter-1"  │
│  - content (Yjs 格式)           │
└─────────────────────────────────┘
```

### 4.1 数据获取

```typescript
// page.tsx (Server Component)
async function getCourseData(sessionId: string) {
  // 1. 获取课程会话
  const session = await db.query.courseSessions.findFirst({
    where: eq(courseSessions.id, sessionId),
  });

  // 2. 获取所有章节文档
  const chapters = await db.query.documents.findMany({
    where: and(
      eq(documents.courseId, sessionId),
      eq(documents.type, "course_chapter")
    ),
    orderBy: documents.outlineNodeId,
  });

  return { session, chapters };
}
```

---

## 5. 状态管理

### 5.1 Zustand Store

```typescript
// stores/learn.ts
interface LearnStore {
  // 当前章节索引
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;

  // 禅模式
  isZenMode: boolean;
  toggleZenMode: () => void;

  // 进度（本地缓存，定期同步到服务器）
  completedChapters: Set<number>;
  markChapterComplete: (index: number) => void;
}
```

---

## 6. 交互细节

### 6.1 章节切换

1. 用户点击左侧章节
2. 更新 `currentChapterIndex`
3. Editor 加载对应章节内容
4. URL 更新为 `?chapter=N`（不刷新页面）
5. 自动保存上一章节进度

### 6.2 进度追踪

- 滚动到章节底部 → 自动标记为已完成
- 或：用户手动点击"完成"按钮
- 进度同步到 `courseSessions.progress`

### 6.3 禅模式

| 触发方式 | 行为 |
|---------|------|
| 点击 🧘 按钮 | 进入禅模式 |
| 按 `Esc` | 退出禅模式 |
| 按 `F` | 全屏 + 禅模式 |

**动画：**
- 左侧面板滑出（`translateX(-100%)`）
- 顶栏淡出
- 编辑器居中放大

---

## 7. 响应式设计

| 屏幕尺寸 | 布局 |
|---------|------|
| Desktop (≥768px) | 左右分栏，固定左侧面板 |
| Mobile (<768px) | 底部 Tab 切换：大纲 / 内容 |

---

## 8. 文件清单

### 8.1 新建文件

| 文件 | 描述 |
|------|------|
| `app/learn/[id]/page.tsx` | 页面入口 |
| `app/learn/[id]/LearnClient.tsx` | 客户端组件 |
| `app/learn/[id]/components/LearnSidebar.tsx` | 左侧边栏 |
| `app/learn/[id]/components/ChapterList.tsx` | 章节列表 |
| `app/learn/[id]/components/ZenModeToggle.tsx` | 禅模式按钮 |
| `stores/learn.ts` | Zustand store |

### 8.2 修改文件

| 文件 | 改动 |
|------|------|
| `components/interview/OutlinePanel.tsx` | "开始学习"按钮跳转 `/learn/${courseId}` |
| `components/home/RecentSectionServer.tsx` | 链接改为 `/learn/${courseId}` |

---

## 9. 验收标准

- [ ] 访问 `/learn/[sessionId]` 显示课程学习页面
- [ ] 左侧显示课程大纲和章节列表
- [ ] 右侧显示 Editor，加载当前章节内容
- [ ] 点击章节可切换内容
- [ ] 进度正确显示（已完成/总数）
- [ ] 禅模式可进入/退出
- [ ] 移动端响应式布局正常
