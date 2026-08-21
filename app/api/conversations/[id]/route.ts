import { NextResponse } from 'next/server'

import { getConversation, ownerIdFromRequest, removeConversation } from '@/lib/server/conversations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const item = await getConversation((await params).id, ownerIdFromRequest(request))
  return item ? NextResponse.json(item) : NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const removed = await removeConversation((await params).id, ownerIdFromRequest(request))
  return removed ? new Response(null, { status: 204 }) : NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
}
