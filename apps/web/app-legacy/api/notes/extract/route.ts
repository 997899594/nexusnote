import { API_URL } from '@/lib/config'

export const runtime = 'nodejs'

/**
 * POST /api/notes/extract
 * Proxy to backend notes extraction service
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const response = await fetch(`${API_URL}/notes/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Notes API] Extract failed:', error)
      return new Response(JSON.stringify({ error: 'Extract failed' }), {
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
    console.error('[Notes API] Extract error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
