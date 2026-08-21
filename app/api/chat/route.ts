import { NextResponse } from 'next/server'

import { getProvider, safeProviderMessage, type ChatMessage } from '@/lib/providers/types'
import { appendMessages, ownerIdFromRequest } from '@/lib/server/conversations'
import { getCredential } from '@/lib/server/credentials'

const buckets = new Map<string, { count: number; reset: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 20

function rateLimited(request: Request) {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.reset < now) { buckets.set(key, { count: 1, reset: now + WINDOW_MS }); return false }
  current.count += 1
  return current.count > MAX_REQUESTS
}

export async function POST(request: Request) {
  if (rateLimited(request)) return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  try {
    const body = await request.json()
    if (!body || typeof body.provider !== 'string' || typeof body.model !== 'string' || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) return NextResponse.json({ error: 'Invalid chat request.' }, { status: 400 })
    const messages = body.messages as ChatMessage[]
    if (messages.some((message) => !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 50_000)) return NextResponse.json({ error: 'Invalid message format.' }, { status: 400 })
    const provider = getProvider(body.provider)
    if (!provider) return NextResponse.json({ error: 'Provider is not available.' }, { status: 404 })
    if (!provider.getModels().some((item) => item.id === body.model)) return NextResponse.json({ error: 'Model is unavailable.' }, { status: 400 })
    const credential = await getCredential(ownerIdFromRequest(request), body.provider)
    const result = await provider.chat({ provider: body.provider, model: body.model, messages, signal: request.signal, credential })
    if (typeof body.conversationId === 'string') {
      await appendMessages(body.conversationId, ownerIdFromRequest(request), [
        ...(body.regenerate ? [] : messages.filter((message) => message.role === 'user').slice(-1)),
        { role: 'assistant', content: result.content },
      ])
    }
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: safeProviderMessage(error) }, { status: error instanceof Error && error.message === 'Missing provider credential' ? 503 : 502 })
  }
}
