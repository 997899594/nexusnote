'use client'

import { Home, BookOpen, Layers, Hash, Settings, Plus, Search, Command, Library, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NeoSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-transparent z-50 flex flex-col pt-4 pb-4">
      {/* User Profile (Minimal) */}
      <div className="px-4 mb-6 flex items-center gap-2 cursor-pointer group">
        <div className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold">
          F
        </div>
        <span className="text-xs font-medium text-zinc-900 group-hover:text-zinc-600 transition-colors">Findbiao</span>
        <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        <NavItem icon={Inbox} label="Inbox" count={3} active />
        <NavItem icon={BookOpen} label="My Issues" />
        <NavItem icon={Layers} label="Views" />
        
        <div className="mt-6 mb-1 px-2 flex items-center justify-between group cursor-pointer">
          <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">Favorites</span>
          <Plus className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <NavItem icon={Hash} label="Project Titan" />
        <NavItem icon={Hash} label="Design System" />
        
        <div className="mt-6 mb-1 px-2 flex items-center justify-between group cursor-pointer">
          <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">Learning</span>
        </div>
        <NavItem icon={Library} label="Rust Guide" />
        <NavItem icon={Library} label="System Arch" />
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 mt-auto">
        <NavItem icon={Settings} label="Settings" />
        <div className="mt-2 px-2 py-1 text-[10px] text-zinc-300 font-mono">v2.4.0</div>
      </div>
    </aside>
  )
}

function NavItem({ icon: Icon, label, active, count }: any) {
  return (
    <button className={cn(
      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-all duration-200 group relative",
      active 
        ? "text-zinc-900 font-medium" 
        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50"
    )}>
      {/* Active Indicator (Left Bar) */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-0.5 bg-zinc-900 rounded-full" />
      )}
      
      <Icon className={cn(
        "w-3.5 h-3.5 transition-colors", 
        active ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"
      )} />
      <span className={cn(active && "ml-0.5")}>{label}</span>
      
      {count && (
        <span className="ml-auto text-[10px] text-zinc-400 font-medium">{count}</span>
      )}
    </button>
  )
}
