import { NextResponse } from 'next/server'

import { createConversation, listConversations, ownerIdFromRequest } from '@/lib/server/conversations'

export async function GET(request: Request) {
  return NextResponse.json(await listConversations(ownerIdFromRequest(request)))
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title : undefined
  const providerId = typeof body.providerId === 'string' ? body.providerId : 'unknown'
  const modelId = typeof body.modelId === 'string' ? body.modelId : 'unknown'
  return NextResponse.json(await createConversation(ownerIdFromRequest(request), title, providerId, modelId), { status: 201 })
}
