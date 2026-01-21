'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  const createNewDocument = () => {
    // 生成 UUID
    const id = crypto.randomUUID()
    router.push(`/editor/${id}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">NexusNote</h1>
        <p className="text-muted-foreground text-lg mb-8">
          AI-Powered Local-First Knowledge Base
        </p>

        <div className="flex gap-4 justify-center">
          <button
            onClick={createNewDocument}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            New Document
          </button>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 text-left">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Offline First</h3>
            <p className="text-sm text-muted-foreground">
              Works without internet. Auto-syncs when back online.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Real-time Collaboration</h3>
            <p className="text-sm text-muted-foreground">
              Edit together with your team in real-time.
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">AI Assistant</h3>
            <p className="text-sm text-muted-foreground">
              Smart writing with AI-powered suggestions.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
