import { asc, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { conversations, messages } from '@/lib/db/schema'

export type StoredMessage = { role: 'user' | 'assistant' | 'system'; content: string }
export type Conversation = { id: string; title: string; providerId: string; modelId: string; messages: StoredMessage[]; createdAt: string; updatedAt: string }

export function ownerIdFromRequest(request: Request) {
  return request.headers.get('x-custai-client-id')?.slice(0, 128) || 'anonymous'
}

function serialize(row: typeof conversations.$inferSelect, rows: typeof messages.$inferSelect[]): Conversation {
  return {
    id: row.id,
    title: row.title,
    providerId: row.providerId,
    modelId: row.modelId,
    messages: rows.map((message) => ({ role: message.role as StoredMessage['role'], content: message.content })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listConversations(ownerId: string) {
  const rows = await db.select().from(conversations).where(eq(conversations.ownerId, ownerId)).orderBy(desc(conversations.updatedAt))
  return rows.map((row) => ({ id: row.id, title: row.title, providerId: row.providerId, modelId: row.modelId, messages: [], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))
}

export async function getConversation(id: string, ownerId: string) {
  const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!row || row.ownerId !== ownerId) return undefined
  const rows = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt))
  return serialize(row, rows)
}

export async function createConversation(ownerId: string, title = 'New conversation', providerId = 'unknown', modelId = 'unknown') {
  const [row] = await db.insert(conversations).values({ ownerId, title: title.slice(0, 120), providerId, modelId }).returning()
  return serialize(row, [])
}

export async function removeConversation(id: string, ownerId: string) {
  const deleted = await db.delete(conversations).where(eq(conversations.id, id)).returning({ id: conversations.id, ownerId: conversations.ownerId })
  return deleted[0]?.ownerId === ownerId
}

export async function appendMessages(conversationId: string, ownerId: string, entries: StoredMessage[]) {
  const conversation = await getConversation(conversationId, ownerId)
  if (!conversation) return undefined
  if (entries.length) await db.insert(messages).values(entries.map((entry) => ({ conversationId, role: entry.role, content: entry.content })))
  const [row] = await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId)).returning()
  const rows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt))
  return row ? serialize(row, rows) : undefined
}
