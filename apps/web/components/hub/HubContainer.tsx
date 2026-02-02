'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, StickyNote, Clock, CheckCircle, Zap } from 'lucide-react'
import { AppSidebar } from '../layout/AppSidebar'
import { ProCourseCard, ProNoteRow, CommandBar } from './HubComponents'
import { learningStore, LocalLearningContent, LocalLearningProgress } from '@/lib/storage'

// Interface for Notes fetched from API
interface Note {
    id: string
    title: string
    content: string
    createdAt: string
    tags?: string[]
}

interface CourseWithProgress extends LocalLearningContent {
    progress?: LocalLearningProgress
}

export function HubContainer() {
    const router = useRouter()
    const { data: session } = useSession()
    const [courses, setCourses] = useState<CourseWithProgress[]>([])
    const [notes, setNotes] = useState<Note[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        activeCourses: 0,
        completedHours: 0,
        notesCount: 0
    })



    useEffect(() => {
        loadData()
    }, [session?.user?.id])

    const loadData = async () => {
        setLoading(true)
        try {
            // 1. Load Courses (Local-First)
            const contents = await learningStore.getAllContents()
            const coursesWithProgress: CourseWithProgress[] = []
            let totalHours = 0

            for (const content of contents) {
                const progress = await learningStore.getProgress(content.id)
                coursesWithProgress.push({ ...content, progress })
                if (progress) {
                    totalHours += Math.floor((progress.totalTimeSpent || 0) / 60)
                }
            }

            // Sort by last accessed
            coursesWithProgress.sort((a, b) => {
                const aTime = a.progress?.lastAccessedAt || a.createdAt
                const bTime = b.progress?.lastAccessedAt || b.createdAt
                return bTime - aTime
            })
            setCourses(coursesWithProgress)

            // 2. Load Notes (Server-First)
            const userId = session?.user?.id
            let fetchedNotesCount = 0
            if (userId) {
                const response = await fetch(`/api/notes/topics?userId=${encodeURIComponent(userId)}`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.topics) {
                        const allNotes: Note[] = []
                        data.topics.forEach((topic: any) => {
                            if (topic.notes) {
                                allNotes.push(...topic.notes)
                            }
                        })
                        allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        setNotes(allNotes.slice(0, 5)) // Take top 5 for dense list
                        fetchedNotesCount = allNotes.length
                    }
                }
            }

            setStats({
                activeCourses: contents.length,
                completedHours: totalHours,
                notesCount: fetchedNotesCount
            })

        } catch (error) {
            console.error('Failed to load hub data:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000)
        if (seconds < 60) return 'Just now'
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }



    return (
        <div className="min-h-screen bg-[#fafafa]">
            <AppSidebar />

            <main className="pl-[240px] min-h-screen">
                <div className="max-w-6xl mx-auto px-10 py-10 space-y-10">

                    {/* 1. Functional Header & Stats */}
                    <div className="flex items-end justify-between border-b border-black/[0.04] pb-6">
                        <div className="space-y-4 w-full">
                            <h1 className="text-xl font-bold tracking-tight text-black flex items-center gap-2">
                                <Zap className="w-5 h-5 text-black" />
                                Executive Terminal
                            </h1>
                            <div className="flex items-center gap-12">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-black/30 uppercase tracking-wider">Active Courses</div>
                                    <div className="text-2xl font-bold text-black tracking-tight">{loading ? '-' : stats.activeCourses}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-black/30 uppercase tracking-wider">Hours Learned</div>
                                    <div className="text-2xl font-bold text-black tracking-tight">{loading ? '-' : stats.completedHours}h</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-black/30 uppercase tracking-wider">Total Notes</div>
                                    <div className="text-2xl font-bold text-black tracking-tight">{loading ? '-' : stats.notesCount}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Command Bar (Omnibar) */}
                    <section>
                        <CommandBar />
                    </section>

                    <div className="grid grid-cols-12 gap-10">
                        {/* 3. Main Stream: Active Courses */}
                        <section className="col-span-8 space-y-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-black/30">Active Projects</h2>
                                <button className="text-[10px] font-bold bg-black/5 hover:bg-black/10 px-2 py-1 rounded text-black/60 transition-colors">View All</button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} className="h-48 bg-black/[0.03] rounded-lg animate-pulse" />
                                    ))
                                ) : (
                                    <>
                                        {courses.map((course) => (
                                            <ProCourseCard
                                                key={course.id}
                                                title={course.title}
                                                progress={course.progress?.masteryLevel || 0}
                                                color={(course as any).color || 'violet'}
                                                lastActive={course.progress?.lastAccessedAt ? formatTimeAgo(course.progress.lastAccessedAt) : 'New'}
                                                onClick={() => router.push(`/editor/${course.id}`)}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        </section>

                        {/* 4. Side Stream: Recent Intelligence (Notes) */}
                        <section className="col-span-4 space-y-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-black/30">Quick Notes</h2>
                                <button className="text-[10px] font-bold bg-black/5 hover:bg-black/10 px-2 py-1 rounded text-black/60 transition-colors">View All</button>
                            </div>

                            <div className="space-y-3">
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} className="h-12 bg-black/[0.03] rounded-lg animate-pulse" />
                                    ))
                                ) : notes.length > 0 ? (
                                    notes.map(note => (
                                        <ProNoteRow
                                            key={note.id}
                                            title={note.title || 'Untitled Note'}
                                            preview={note.content}
                                            date={new Date(note.createdAt).toLocaleDateString()}
                                            tags={note.tags}
                                            onClick={() => {/* Navigate to note view */ }}
                                        />
                                    ))
                                ) : (
                                    <div className="p-6 border border-dashed border-black/[0.1] rounded-lg text-center">
                                        <span className="text-xs font-medium text-black/30">No active notes</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>


            </main>
        </div>
    )
}
