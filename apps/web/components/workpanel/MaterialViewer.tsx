'use client'

import { motion } from 'framer-motion'
import { Book, ChevronDown, List, Layers, PlayCircle, Sparkles } from 'lucide-react'

export function MaterialViewer({ title }: { title: string }) {
    // Mock Chapters
    const chapters = [
        { id: '1', title: '01. 课程导论与环境搭建', active: true },
        { id: '2', title: '02. 核心语法与所有权模型', active: false },
        { id: '3', title: '03. 异步编程深度解析', active: false },
        { id: '4', title: '04. 实战：构建分布式协调器', active: false },
    ]

    return (
        <div className="h-full flex flex-col gap-6 relative">
            {/* Material Header */}
            <div className="glass-panel p-6 rounded-3xl border-white/5 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/10">
                        <Book className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/60">当前模块</span>
                        </div>
                        <h1 className="text-sm font-bold truncate text-foreground/90">{title}</h1>
                    </div>
                </div>

                <button className="w-full flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-wider hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3 text-muted-foreground/60">
                        <Layers className="w-4 h-4" />
                        <span>浏览目录大纲</span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
                </button>
            </div>

            {/* Reading Core */}
            <div className="flex-1 glass-panel p-8 md:p-10 rounded-3xl overflow-y-auto custom-scrollbar border-white/5 relative">
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground/80">
                    <h1 className="text-2xl font-bold tracking-tight mb-8 pb-4 border-b border-black/5 dark:border-white/5">
                        第一章节：系统级思考的艺术
                    </h1>

                    <p className="mb-6">
                        在探讨现代高性能计算时，我们不能忽略底层资源的分配逻辑。Rust 语言通过一套独特的所有权模型，
                        在不需要垃圾回收的情况下，实现了内存安全性。这一设计解决了 C/C++ 中常见的悬垂指针问题。
                    </p>

                    <p className="mb-8">
                        我们将这种范式称为“所有权机制”，它在编译阶段就确定了内存的生命周期，从而消除了运行时的不确定性。
                    </p>

                    <div className="my-10 aspect-video bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-black/5 dark:border-white/5 relative group cursor-pointer overflow-hidden transition-colors">
                        <PlayCircle className="w-12 h-12 text-muted-foreground/20 group-hover:text-indigo-500 transition-colors" />
                        <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/10 backdrop-blur-xl rounded-xl text-[10px] font-bold text-muted-foreground/60 border border-white/5">
                            <PlayCircle className="w-3 h-3" /> 点击观看教学视频
                        </div>
                    </div>

                    <h3 className="text-lg font-bold my-6">0x01 | 零成本抽象</h3>
                    <p className="mb-6 text-muted-foreground/80">
                        零成本抽象意味着您在享用高级抽象语法的同时，不会产生任何额外的性能损耗。
                    </p>

                    <blockquote className="border-l-4 border-indigo-500/40 bg-indigo-500/5 p-6 rounded-r-2xl my-8 italic">
                        “所有权不仅是技术约束，更是开发者与编译器之间的安全契约。”
                    </blockquote>
                </div>

                {/* Selection Prompt */}
                <div className="mt-12 border-t border-black/5 dark:border-white/5 pt-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-full mb-4">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500/60" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/40">划线以同步笔记</span>
                    </div>
                    <div className="flex justify-center gap-4">
                        {[1, 2, 3, 4].map(c => (
                            <motion.div
                                key={c}
                                whileHover={{ scale: 1.25 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className={`w-3 h-3 rounded-full cursor-pointer shadow-sm ${['bg-yellow-400/60', 'bg-blue-400/60', 'bg-emerald-400/60', 'bg-rose-400/60'][c - 1]}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Navigation */}
            <div className="h-44 glass-panel p-5 rounded-3xl overflow-y-auto no-scrollbar border-white/5">
                <div className="flex items-center gap-3 px-1 mb-4 opacity-40">
                    <List className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">课程章节</span>
                </div>
                <div className="space-y-1.5">
                    {chapters.map(ch => (
                        <motion.div
                            key={ch.id}
                            whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.02)' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className={`p-3 rounded-xl text-[11px] font-bold cursor-pointer border border-transparent ${ch.active ? 'bg-indigo-500 text-white' : 'text-muted-foreground/40 hover:text-foreground'}`}
                        >
                            {ch.title}
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}
