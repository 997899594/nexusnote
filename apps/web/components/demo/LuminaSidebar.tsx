'use client'

import { Home, BookOpen, Library, Hash, Settings, Plus, Search, Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export function LuminaSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-zinc-50/50 backdrop-blur-xl border-r border-zinc-200/60 z-50 flex flex-col font-sans">
      {/* Brand: 极简，无背景色块 */}
      <div className="h-14 flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 bg-zinc-900 rounded-md flex items-center justify-center shadow-sm">
            <span className="text-white text-[10px] font-bold">N</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">NexusNote</span>
        </div>
      </div>

      {/* Quick Action */}
      <div className="px-3 mb-2">
        <button className="w-full flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200/80 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm">
          <Search className="w-3.5 h-3.5" />
          <span>Quick Find...</span>
          <span className="ml-auto flex items-center gap-0.5 text-[10px] bg-zinc-100 px-1 rounded border border-zinc-200">
            <Command className="w-2.5 h-2.5" /> K
          </span>
        </button>
      </div>

      {/* Main Nav: 强调“选中态”的微妙变化 */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <NavItem icon={Home} label="Inbox" active />
        <NavItem icon={BookOpen} label="Knowledge" />
        <NavItem icon={Library} label="Learning" />
        
        <div className="mt-8 mb-2 px-3 flex items-center justify-between group cursor-pointer">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider group-hover:text-zinc-600 transition-colors">Projects</span>
          <Plus className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-200 rounded" />
        </div>
        <NavItem icon={Hash} label="Rust Advanced" />
        <NavItem icon={Hash} label="System Design" />
        <NavItem icon={Hash} label="AI Architecture" />
      </nav>

      {/* User: 底部悬浮感 */}
      <div className="p-3 border-t border-zinc-200/60">
        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white hover:shadow-sm hover:border-zinc-200 border border-transparent transition-all group">
          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
            FB
          </div>
          <div className="flex-1 text-left">
            <div className="text-xs font-medium text-zinc-900">Findbiao</div>
            <div className="text-[10px] text-zinc-500">Pro Plan</div>
          </div>
          <Settings className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
        </button>
      </div>
    </aside>
  )
}

function NavItem({ icon: Icon, label, active }: any) {
  return (
    <button className={cn(
      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-200 group",
      active 
        ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-zinc-200/60 font-medium" 
        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50"
    )}>
      <Icon className={cn(
        "w-4 h-4 transition-colors", 
        active ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-500"
      )} />
      {label}
    </button>
  )
}
