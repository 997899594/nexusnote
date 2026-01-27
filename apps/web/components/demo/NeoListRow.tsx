'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { MoreHorizontal, PlayCircle } from 'lucide-react'

interface NeoListRowProps {
  icon?: any
  title: string
  tag: string
  time: string
  status?: 'active' | 'done' | 'pending'
}

export function NeoListRow({ icon: Icon, title, tag, time, status = 'active' }: NeoListRowProps) {
  return (
    <div className="group flex items-center gap-3 px-3 h-9 rounded-md hover:bg-zinc-50 transition-colors cursor-pointer border-b border-transparent hover:border-zinc-100/50">
      {/* Icon / Status */}
      <div className={cn(
        "w-4 h-4 flex items-center justify-center rounded text-zinc-400",
        status === 'active' && "text-amber-500",
        status === 'done' && "text-indigo-500"
      )}>
        {Icon ? <Icon className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
      </div>

      {/* Title */}
      <span className="text-[13px] font-medium text-zinc-900 truncate flex-1">{title}</span>

      {/* Ghost Actions (Hover only) */}
      <div className="hidden group-hover:flex items-center gap-1 mr-2">
        <button className="p-1 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors">
            <PlayCircle className="w-3.5 h-3.5" />
        </button>
        <button className="p-1 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Meta */}
      <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-[4px] border border-zinc-100 bg-white text-[10px] font-medium text-zinc-400 uppercase tracking-wide min-w-[60px] justify-center shadow-sm">
        {tag}
      </span>
      <span className="text-[11px] text-zinc-300 font-mono w-12 text-right group-hover:text-zinc-400 transition-colors">
        {time}
      </span>
    </div>
  )
}
