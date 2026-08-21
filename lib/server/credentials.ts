import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { providerCredentials } from '@/lib/db/schema'

const algorithm = 'aes-256-gcm'
function secret() {
  return createHash('sha256').update(process.env.CUSTAI_CREDENTIAL_SECRET ?? process.env.DATABASE_URL ?? 'custai-development-secret').digest()
}

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, secret(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv(algorithm, secret(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export async function listCredentials(ownerId: string) {
  return db.select({ id: providerCredentials.id, providerId: providerCredentials.providerId, keyHint: providerCredentials.keyHint, updatedAt: providerCredentials.updatedAt }).from(providerCredentials).where(eq(providerCredentials.ownerId, ownerId))
}

export async function getCredential(ownerId: string, providerId: string) {
  const [row] = await db.select().from(providerCredentials).where(and(eq(providerCredentials.ownerId, ownerId), eq(providerCredentials.providerId, providerId))).limit(1)
  return row ? decrypt(row.encryptedValue) : undefined
}

export async function saveCredential(ownerId: string, providerId: string, value: string) {
  const keyHint = value.slice(-4)
  const [row] = await db.insert(providerCredentials).values({ ownerId, providerId, encryptedValue: encrypt(value), keyHint }).onConflictDoUpdate({ target: [providerCredentials.ownerId, providerCredentials.providerId], set: { encryptedValue: encrypt(value), keyHint, updatedAt: new Date() } }).returning({ id: providerCredentials.id, providerId: providerCredentials.providerId, keyHint: providerCredentials.keyHint })
  return row
}

export async function deleteCredential(ownerId: string, providerId: string) {
  await db.delete(providerCredentials).where(and(eq(providerCredentials.ownerId, ownerId), eq(providerCredentials.providerId, providerId)))
}

export async function markCredentialTest(_ownerId: string, _providerId: string, _status: 'passed' | 'failed') {
  // The current Neon table intentionally stores only encrypted credentials and metadata.
  // Test results are returned to the caller without persisting provider response details.
}

export function ownerIdFromHeaders(headers: Headers) {
  return headers.get('x-custai-client-id')?.slice(0, 128) || 'local-development-client'
}

export function providerKeyFromRequest(request: Request) {
  return request.headers.get('x-custai-client-id')?.slice(0, 128) || 'local-development-client'
}

export { decrypt }
