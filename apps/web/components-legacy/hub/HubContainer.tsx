'use client'

import { motion } from 'framer-motion'
import { Plus, ArrowRight } from 'lucide-react'
import { CourseCard } from './HubComponents'
import { useRouter } from 'next/navigation'

export function HubContainer() {
    const router = useRouter()

    const mockCourses = [
        { id: '1', title: '现代物理学导论：从量子到宇宙', progress: 65, color: 'violet' },
        { id: '2', title: 'Rust 语言系统级编程：高性能之道', progress: 42, color: 'indigo' },
        { id: '3', title: '机器学习数学基础：线性代数篇', progress: 88, color: 'emerald' },
    ]

    return (
        <div className="max-w-4xl mx-auto px-6 py-20 space-y-32">

            {/* 1. The Intent Island: AI Chat/Search Box */}
            <section className="space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter">你想学习什么？</h1>
                    <p className="text-xs font-bold uppercase tracking-[0.4em] opacity-20">输入领域、问题或粘贴链接</p>
                </div>

                <div className="relative group max-w-2xl mx-auto">
                    <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/10 to-indigo-500/5 rounded-[2.5rem] blur opacity-20 group-focus-within:opacity-100 transition duration-500" />
                    <div className="relative flex items-center bg-white border border-black/[0.05] rounded-[2rem] p-4 shadow-sm group-focus-within:shadow-2xl group-focus-within:border-violet-500/20 transition-all">
                        <input
                            type="text"
                            placeholder="描述一个你想钻研的知识领域..."
                            className="flex-1 bg-transparent px-6 py-4 outline-none text-lg font-medium placeholder:opacity-20"
                        />
                        <button className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-violet-600 transition-all shadow-xl">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* 2. The Course Shelf: Active Knowledge */}
            <section className="space-y-10">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-20 flex items-center gap-3">
                        <ArrowRight className="w-4 h-4" /> 继续学习
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {mockCourses.map((course) => (
                        <CourseCard
                            key={course.id}
                            {...course}
                            onClick={() => router.push(`/editor/${course.id}`)}
                        />
                    ))}

                    {/* Minimal Add Course Placeholder */}
                    <div className="p-10 border-2 border-dashed border-black/[0.03] rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-black/10 hover:text-violet-500/40 hover:border-violet-500/10 hover:bg-violet-500/[0.01] transition-all cursor-pointer group">
                        <Plus className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase tracking-widest">浏览全部课程库</span>
                    </div>
                </div>
            </section>
        </div>
    )
}
