import { clientEnv } from '@nexusnote/config'

const API_URL = clientEnv.NEXT_PUBLIC_API_URL

export const runtime = 'nodejs'

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
      return Response.json({ error: 'Extract failed' }, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (err) {
    console.error('[Notes API] Extract error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
