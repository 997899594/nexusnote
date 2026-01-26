import { API_URL } from '@/lib/config'

export const runtime = 'nodejs'

/**
 * GET /api/notes/topics?userId=xxx
 * Proxy to backend notes service
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required', topics: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(`${API_URL}/notes/topics?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notes API] Get topics failed:', error)
      return new Response(JSON.stringify({ error: 'Failed to fetch topics', topics: [] }), {
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
    console.error('[Notes API] Get topics error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message, topics: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
