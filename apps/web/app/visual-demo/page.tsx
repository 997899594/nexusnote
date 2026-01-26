'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Shield,
    Sparkles,
    Search,
    Layout,
    Ghost,
    MessageSquare,
    Zap,
    MoreVertical,
    Edit3,
    List,
    Sun,
    Moon
} from 'lucide-react'

// ============================================
// UI Components for Demo
// ============================================

const GlassPanel = ({ children, className = "", isDark = true }: { children: React.ReactNode, className?: string, isDark?: boolean }) => (
    <div className={`backdrop-blur-2xl border transition-all duration-500 rounded-3xl overflow-hidden ${isDark
            ? "bg-neutral-900/40 border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]"
            : "bg-white/60 border-black/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)]"
        } ${className}`}>
        {children}
    </div>
)

const FloatingNav = ({ theme, toggleTheme }: { theme: 'dark' | 'light', toggleTheme: () => void }) => (
    <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-8 left-1/2 -translate-x-1/2 z-[100]"
    >
        <div className={`flex items-center gap-2 p-1.5 px-4 backdrop-blur-xl border transition-all duration-500 rounded-full shadow-2xl ${theme === 'dark' ? 'bg-black/60 border-white/10' : 'bg-white/80 border-black/10'
            }`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center">
                <Edit3 className="w-4 h-4 text-white" />
            </div>
            <div className={`h-4 w-px mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

            <button
                onClick={toggleTheme}
                title="Toggle Theme"
                className={`p-2 transition-colors rounded-full ${theme === 'dark' ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-black/50 hover:text-black hover:bg-black/5'
                    }`}
            >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button className={`p-2 transition-colors ${theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'}`}><Search className="w-4 h-4" /></button>
            <button className={`p-2 transition-colors ${theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'}`}><Layout className="w-4 h-4" /></button>

            <div className={`h-4 w-px mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
            <div className="flex items-center gap-3 pl-2 pr-1">
                <span className={`text-[11px] font-bold tracking-widest uppercase ${theme === 'dark' ? 'text-white/40' : 'text-black/40'}`}>Vault Mode</span>
                <div className={`w-10 h-5 rounded-full border p-0.5 relative group cursor-pointer transition-all ${theme === 'dark' ? 'bg-violet-900/30 border-violet-500/20' : 'bg-violet-100 border-violet-200'
                    }`}>
                    <div className="w-4 h-4 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                </div>
            </div>
        </div>
    </motion.div>
)

const SidebarItem = ({ icon: Icon, label, active = false, theme = 'dark' }: any) => (
    <div className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-300 ${active
            ? (theme === 'dark' ? 'bg-white/5 text-white' : 'bg-black/5 text-black')
            : (theme === 'dark' ? 'text-white/40 hover:bg-white/5 hover:text-white/80' : 'text-black/40 hover:bg-black/5 hover:text-black/80')
        }`}>
        <Icon className={`w-4 h-4 ${active ? 'text-violet-500' : ''}`} />
        <span className="text-sm font-medium">{label}</span>
        {active && <div className="ml-auto w-1 h-4 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />}
    </div>
)

const GhostThought = ({ text, theme = 'dark' }: { text: string, theme?: 'dark' | 'light' }) => (
    <motion.div
        initial={{ scale: 0.8, opacity: 0, x: 20 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        className="fixed bottom-12 right-12 z-[100]"
    >
        <div className={`relative group p-5 max-w-xs backdrop-blur-3xl border rounded-3xl transition-all duration-500 ${theme === 'dark'
                ? 'bg-neutral-900/80 border-violet-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
                : 'bg-white/90 border-violet-200 shadow-[0_20px_50px_rgba(0,0,0,0.08)]'
            }`}>
            <div className="absolute -top-3 -left-3 w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-900/50">
                <Ghost className="w-5 h-5 text-white animate-pulse" />
            </div>
            <p className={`text-sm leading-relaxed italic pr-4 ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>"{text}"</p>
            <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-violet-300' : 'text-violet-500'}`}>Ghost Pilot</span>
                </div>
                <button className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'
                    }`}>Apply</button>
            </div>

            <div className={`absolute inset-0 blur-2xl rounded-3xl -z-10 ${theme === 'dark' ? 'bg-violet-600/5' : 'bg-violet-600/10'}`} />
        </div>
    </motion.div>
)

// ============================================
// Main Demo Page
// ============================================

export default function VisualDemo() {
    const [activeTab, setActiveTab] = useState('editor')
    const [theme, setTheme] = useState<'dark' | 'light'>('dark')

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

    return (
        <div className={`min-h-screen transition-colors duration-700 selection:bg-violet-500/30 overflow-hidden font-sans ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#fcfcfc] text-black'
            }`}>

            {/* Background Atmosphere */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[150px] rounded-full transition-colors duration-1000 ${theme === 'dark' ? 'bg-violet-900/10' : 'bg-violet-400/10'
                    }`} />
                <div className={`absolute bottom-0 right-0 w-[50%] h-[50%] blur-[180px] rounded-full transition-colors duration-1000 ${theme === 'dark' ? 'bg-indigo-900/5' : 'bg-indigo-400/10'
                    }`} />
                <div className={`absolute inset-0 bg-[url('https://grain-y.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay ${theme === 'dark' ? 'invert-0' : 'invert'
                    }`} />
            </div>

            <FloatingNav theme={theme} toggleTheme={toggleTheme} />

            <main className="max-w-[1400px] mx-auto h-screen flex gap-8 p-8 pt-24 pb-12 relative z-10">

                {/* Left Sidebar */}
                <motion.aside
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="w-72 flex flex-col gap-6"
                >
                    <GlassPanel isDark={theme === 'dark'} className="flex-1 p-4 flex flex-col gap-2 relative">
                        <div className="px-4 py-2 mb-4">
                            <h2 className={`text-[10px] uppercase tracking-[0.2em] font-black ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>Intelligence Center</h2>
                        </div>
                        <SidebarItem theme={theme} icon={List} label="Knowledge Map" active={activeTab === 'map'} />
                        <SidebarItem theme={theme} icon={MessageSquare} label="AI Assistant" active={activeTab === 'chat'} />
                        <SidebarItem theme={theme} icon={Zap} label="Command Center" />
                        <SidebarItem theme={theme} icon={Shield} label="Private Vault" />
                        <div className={`mt-auto pt-4 border-t px-2 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
                            <div className={`p-4 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border-violet-500/10' : 'bg-violet-50/50 border-violet-100'
                                }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3 h-3 text-violet-500" />
                                    <span className="text-xs font-bold">Aura Status</span>
                                </div>
                                <div className={`h-1.5 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-black/40' : 'bg-black/10'}`}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '75%' }}
                                        transition={{ duration: 1.5, delay: 0.5 }}
                                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                                    />
                                </div>
                                <p className={`text-[10px] mt-2 ${theme === 'dark' ? 'text-white/40' : 'text-black/40'}`}>75% context coherence indexed</p>
                            </div>
                        </div>
                    </GlassPanel>
                </motion.aside>

                {/* Center Canvas */}
                <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex-1"
                >
                    <GlassPanel isDark={theme === 'dark'} className="h-full relative flex flex-col">
                        <div className={`p-8 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
                            <div>
                                <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white/90' : 'text-black/90'}`}>Strategic Roadmap 2026</h1>
                                <p className={`text-xs mt-1 flex items-center gap-2 ${theme === 'dark' ? 'text-white/30' : 'text-black/30'}`}>
                                    <Edit3 className="w-3 h-3" /> Last modified 2m ago · 14 collaborators
                                </p>
                            </div>
                            <div className="flex -space-x-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`w-8 h-8 rounded-full border-2 overflow-hidden shadow-xl ${theme === 'dark' ? 'border-neutral-900 bg-neutral-800' : 'border-white bg-neutral-100'}`}>
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="user" />
                                    </div>
                                ))}
                                <div className="w-8 h-8 rounded-full bg-violet-600 border-2 border-neutral-900 flex items-center justify-center text-[10px] font-bold shadow-xl text-white">
                                    +8
                                </div>
                            </div>
                        </div>

                        {/* Mock Editor Canvas */}
                        <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                            <div className={`max-w-2xl mx-auto space-y-8 prose ${theme === 'dark' ? 'prose-invert' : ''}`}>
                                <p className={`text-lg leading-relaxed font-light ${theme === 'dark' ? 'text-white/80' : 'text-black/70'}`}>
                                    The intersection of <span className="text-violet-500 font-normal">Artificial Intelligence</span> and
                                    human intuition demands a new kind of canvas. Not just a text box, but a spatial medium
                                    where thoughts can breathe and evolve.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`p-6 rounded-3xl border transition-all duration-500 group ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 hover:border-white/10' : 'bg-black/[0.02] border-black/5 hover:border-black/10'
                                        }`}>
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-colors ${theme === 'dark' ? 'bg-white/5 group-hover:bg-violet-500/10' : 'bg-black/10 group-hover:bg-violet-500/5'
                                            }`}>
                                            <Zap className="w-5 h-5 text-violet-500" />
                                        </div>
                                        <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Latency Optimizer</h3>
                                        <p className={`text-xs ${theme === 'dark' ? 'text-white/30' : 'text-black/40'}`}>Real-time vector synchronization with &lt; 50ms drift.</p>
                                    </div>
                                    <div className={`p-6 rounded-3xl border transition-all duration-500 group ${theme === 'dark' ? 'bg-white/[0.02] border-white/5 hover:border-white/10' : 'bg-black/[0.02] border-black/5 hover:border-black/10'
                                        }`}>
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-colors ${theme === 'dark' ? 'bg-white/5 group-hover:bg-indigo-500/10' : 'bg-black/10 group-hover:bg-indigo-500/5'
                                            }`}>
                                            <MoreVertical className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <h3 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Neural Archiving</h3>
                                        <p className={`text-xs ${theme === 'dark' ? 'text-white/30' : 'text-black/40'}`}>Semantic indexing of every keystroke for long-term RAG.</p>
                                    </div>
                                </div>

                                <p className={`leading-relaxed underline decoration-violet-500/30 underline-offset-4 cursor-text ${theme === 'dark' ? 'text-white/60' : 'text-black/50'}`}>
                                    As we move forward, the "Ghost Pilot" system will act as a silent partner, injecting
                                    clarity into complex technical requirements before the user even realizes there is a conflict.
                                </p>

                                {/* Cursor Indicator Mockup */}
                                <div className="inline-block translate-y-1">
                                    <motion.div
                                        animate={{ opacity: [1, 0, 1] }}
                                        transition={{ repeat: Infinity, duration: 1 }}
                                        className="w-[1.5px] h-6 bg-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                                    />
                                </div>
                            </div>
                        </div>
                    </GlassPanel>
                </motion.div>

                {/* Floating Context Action (Spatial Element) */}
                <motion.div
                    animate={{ y: [0, -15, 0], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                    className="absolute top-1/2 right-[5%] -translate-y-1/2 scale-75 blur-[2px] pointer-events-none"
                >
                    <div className={`w-[400px] h-[400px] rounded-full border transition-colors duration-1000 ${theme === 'dark' ? 'border-white/10 bg-gradient-to-tr from-violet-600/10 to-transparent' : 'border-violet-200 bg-gradient-to-tr from-violet-200/20 to-transparent'
                        }`} />
                </motion.div>

            </main>

            {/* AI Ghost Feed */}
            <GhostThought theme={theme} text="这里的逻辑可以再抽象一层，考虑到 2026 年的扩展性，建议引入更强的原子化设计模式。" />

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
        }
      `}</style>
        </div>
    )
}
