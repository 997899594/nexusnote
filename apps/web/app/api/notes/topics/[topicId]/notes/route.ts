import { clientEnv } from '@nexusnote/config'

const API_URL = clientEnv.NEXT_PUBLIC_API_URL

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await params

    if (!topicId) {
      return Response.json({ error: 'topicId is required', notes: [] }, { status: 400 })
    }

    const response = await fetch(`${API_URL}/notes/topics/${encodeURIComponent(topicId)}/notes`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notes API] Get topic notes failed:', error)
      return Response.json({ error: 'Failed to fetch notes', notes: [] }, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (err) {
    console.error('[Notes API] Get topic notes error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message, notes: [] }, { status: 500 })
  }
}
