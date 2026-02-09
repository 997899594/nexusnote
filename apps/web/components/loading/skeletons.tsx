/**
 * 2026 架构师标准：Skeleton 加载组件
 *
 * 用于 Suspense fallback，提供更好的用户体验
 * 参考：React 19 流式渲染最佳实践
 */

import { motion } from "framer-motion";

/**
 * 课程页面骨架屏
 */
export function CourseSkeleton() {
  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      {/* Header Skeleton */}
      <div className="border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="h-6 w-32 bg-neutral-100 animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-neutral-100 animate-pulse rounded" />
            <div className="h-8 w-8 bg-neutral-100 animate-pulse rounded" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-3">
          <div className="h-4 w-20 bg-neutral-100 animate-pulse rounded" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-neutral-50 animate-pulse rounded" />
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <div className="h-12 w-3/4 bg-neutral-100 animate-pulse rounded" />
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-neutral-50 animate-pulse rounded"
                style={{ width: `${80 + Math.random() * 20}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 章节列表骨架屏
 */
export function ChapterListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="h-12 bg-neutral-50 animate-pulse rounded-lg"
        />
      ))}
    </div>
  );
}

/**
 * 笔记列表骨架屏
 */
export function NotesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="h-32 bg-white border border-black/5 rounded-2xl p-4 space-y-3"
        >
          <div className="h-5 w-3/4 bg-neutral-100 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-neutral-50 animate-pulse rounded" />
            <div className="h-3 w-2/3 bg-neutral-50 animate-pulse rounded" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * 对话消息骨架屏
 */
export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 max-w-[95%] animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-violet-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/4 bg-neutral-100 rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-neutral-50 rounded" />
          <div className="h-3 w-5/6 bg-neutral-50 rounded" />
          <div className="h-3 w-4/6 bg-neutral-50 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * 创建页面骨架屏
 */
export function CreatePageSkeleton() {
  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="h-16 w-3/4 mx-auto bg-neutral-100 animate-pulse rounded mb-4" />
          <div className="h-6 w-1/2 mx-auto bg-neutral-50 animate-pulse rounded" />
        </div>

        {/* Chat Area */}
        <div className="space-y-6">
          <ChatMessageSkeleton />
          <div style={{ marginLeft: "auto" }} className="max-w-[95%]">
            <ChatMessageSkeleton />
          </div>
          <ChatMessageSkeleton />
        </div>
      </div>
    </div>
  );
}
