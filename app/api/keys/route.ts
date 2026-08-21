import { NextResponse } from 'next/server'
import { allProviderMetadata, getProvider, safeProviderMessage } from '@/lib/providers/types'
import { deleteCredential, getCredential, listCredentials, markCredentialTest, ownerIdFromHeaders, saveCredential } from '@/lib/server/credentials'

function owner(request: Request) { return ownerIdFromHeaders(request.headers) }

export async function GET(request: Request) {
  try {
    const saved = await listCredentials(owner(request))
    const configured = new Map(saved.map((item) => [item.providerId, item]))
    return NextResponse.json(allProviderMetadata().map((provider) => ({ providerId: provider.id, providerName: provider.name, configured: configured.has(provider.id), credential: configured.get(provider.id) ? `••••••••${configured.get(provider.id)!.keyHint}` : null, updatedAt: configured.get(provider.id)?.updatedAt ?? null, lastTestedAt: null, lastTestStatus: null })))
  } catch { return NextResponse.json({ error: 'Unable to load API keys.' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (typeof body?.providerId !== 'string' || typeof body?.apiKey !== 'string' || body.apiKey.trim().length < 8 || body.apiKey.length > 500) return NextResponse.json({ error: 'Enter a valid provider key.' }, { status: 400 })
    if (!getProvider(body.providerId)) return NextResponse.json({ error: 'Provider is not available.' }, { status: 404 })
    const result = await saveCredential(owner(request), body.providerId, body.apiKey.trim())
    return NextResponse.json({ ...result, credential: `••••••••${result.keyHint}` }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Unable to save API key.' }, { status: 500 }) }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    if (typeof body?.providerId !== 'string') return NextResponse.json({ error: 'Provider is required.' }, { status: 400 })
    await deleteCredential(owner(request), body.providerId)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Unable to remove API key.' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const providerId = body?.providerId
    if (typeof providerId !== 'string') return NextResponse.json({ error: 'Provider is required.' }, { status: 400 })
    const key = await getCredential(owner(request), providerId)
    if (!key) return NextResponse.json({ error: 'Provider is not configured.' }, { status: 400 })
    const provider = getProvider(providerId)
    if (!provider) return NextResponse.json({ error: 'Provider is not available.' }, { status: 404 })
    await provider.chat({ provider: providerId, model: provider.getModels()[0]?.id ?? '', messages: [{ role: 'user', content: 'Reply with OK.' }], credential: key })
    await markCredentialTest(owner(request), providerId, 'passed')
    return NextResponse.json({ ok: true, status: 'passed' })
  } catch (error) {
    try { const body = await request.clone().json(); if (typeof body?.providerId === 'string') await markCredentialTest(owner(request), body.providerId, 'failed') } catch {}
    return NextResponse.json({ error: safeProviderMessage(error) }, { status: 502 })
  }
}
