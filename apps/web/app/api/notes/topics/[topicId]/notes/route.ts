import { API_URL } from '@/lib/config'

export const runtime = 'nodejs'

/**
 * GET /api/notes/topics/:topicId/notes
 * Proxy to backend notes service to get all notes in a topic
 */
export async function GET(
  req: Request,
  { params }: { params: { topicId: string } }
) {
  try {
    const { topicId } = params

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'topicId is required', notes: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(`${API_URL}/notes/topics/${encodeURIComponent(topicId)}/notes`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notes API] Get topic notes failed:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch notes', notes: [] }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[Notes API] Get topic notes error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message, notes: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
