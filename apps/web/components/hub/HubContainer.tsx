'use client'

import { motion } from 'framer-motion'
import { Plus, GraduationCap, Zap, Brain, Calendar, ArrowRight } from 'lucide-react'
import { CourseCard, HubStatsCard, HubAIRecommendation } from './HubComponents'
import { useRouter } from 'next/navigation'

export function HubContainer() {
    const router = useRouter()

    const mockCourses = [
        { id: '1', title: '现代物理学导论：从量子到宇宙', progress: 65, lastActive: '2小时前', type: 'course' },
        { id: '2', title: 'Rust 语言系统级编程：高性能之道', progress: 42, lastActive: '昨天', type: 'course' },
        { id: '3', title: '机器学习数学基础：线性代数篇', progress: 88, lastActive: '3天前', type: 'book' },
    ]

    return (
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-20 space-y-12">

            {/* Utility Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-black/5 dark:border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 text-violet-500 mb-1">
                        <GraduationCap className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">学习枢纽 / Dashboard</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">学习概览</h1>
                </div>
                <button
                    onClick={() => router.push(`/editor/${crypto.randomUUID()}`)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl shrink-0 font-bold text-sm hover:opacity-90 transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    新建笔记
                </button>
            </header>

            {/* Primary Metrics */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <HubStatsCard icon={Zap} title="待复习" value="24" label="张卡片" trend={12} color="violet" />
                <HubStatsCard icon={Brain} title="知识库规模" value="1,402" label="个节点" trend={5} color="indigo" />
                <HubStatsCard icon={Calendar} title="学习打卡" value="15" label="天" color="emerald" />
            </section>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">

                {/* Active Material List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-lg font-bold">正在学习</h2>
                        <button className="text-[11px] font-bold text-violet-500 flex items-center gap-1 hover:underline">
                            查看全部 <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mockCourses.map((course) => (
                            <CourseCard key={course.id} {...course} onClick={() => router.push(`/editor/${course.id}`)} />
                        ))}

                        <div className="border-2 border-dashed border-black/5 dark:border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground/50 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all cursor-pointer group">
                            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold">添加教材</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar Actions/Intelligence */}
                <aside className="space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">智能建议</h2>
                        <HubAIRecommendation text="监测到您在《分布式系统》的所有权机制下存在 3 个关联卡片已逾期，建议优先完成复习。" />
                    </div>

                    <div className="glass-panel p-6 rounded-3xl bg-black/[0.01] dark:bg-white/[0.01]">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-4">学习动态</h4>
                        <div className="h-32 flex flex-col items-center justify-center gap-3 border border-dashed border-black/5 dark:border-white/10 rounded-2xl grayscale opacity-30">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Syncing Data...</div>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-2 h-2 rounded-full bg-muted-foreground" />)}
                            </div>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    )
}
