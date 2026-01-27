'use client'

import { ArrowRight, BookOpen, Clock, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'

interface LuminaCourseCardProps {
  title: string
  progress: number
  category: string
  lastActive: string
  coverColor?: string
}

export function LuminaCourseCard({ title, progress, category, lastActive, coverColor = 'bg-zinc-100' }: LuminaCourseCardProps) {
  return (
    <div className="group relative bg-white rounded-xl border border-zinc-200 p-5 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-zinc-300 hover:-translate-y-1 cursor-pointer overflow-hidden">
      
      {/* Top Meta */}
      <div className="mb-4 flex justify-between items-start z-10 relative">
        <span className="inline-flex items-center px-2 py-1 rounded-md bg-zinc-50 border border-zinc-100 text-[10px] font-medium text-zinc-500 uppercase tracking-wide group-hover:border-zinc-200 transition-colors">
          {category}
        </span>
        
        <button className="text-zinc-300 hover:text-zinc-600 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="z-10 relative">
        <h3 className="text-lg font-semibold text-zinc-900 leading-snug tracking-tight mb-2 font-sans group-hover:text-black transition-colors">
          {title}
        </h3>
        
        <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed mb-6">
          Master the fundamentals of memory safety, concurrency, and zero-cost abstractions in this comprehensive guide.
        </p>

        {/* Footer Info */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 mb-6">
            <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{lastActive}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-200" />
            <div>12 Chapters</div>
        </div>

        {/* Progress Bar (Minimal) */}
        <div className="relative h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div 
                className="absolute top-0 left-0 h-full bg-zinc-900 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
            />
        </div>
      </div>

      {/* Hover Action (Ghost UI) */}
      <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center shadow-lg text-white">
            <ArrowRight className="w-4 h-4" />
        </div>
      </div>
      
      {/* Decorative Gradient Line */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/0 group-hover:via-indigo-500/40 transition-all duration-500 opacity-0 group-hover:opacity-100" />
    </div>
  )
}
