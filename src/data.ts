import type { Member, HealthStatus } from './types'

export async function getMembers(kv: KVNamespace): Promise<Member[]> {
  const raw = await kv.get('members')
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getMemberBySlug(kv: KVNamespace, slug: string): Promise<Member | null> {
  const members = await getMembers(kv)
  return members.find((m) => m.slug === slug) ?? null
}

export async function getActiveMembers(kv: KVNamespace): Promise<Member[]> {
  const members = await getMembers(kv)
  return members.filter((m) => m.active)
}

export async function setMembers(kv: KVNamespace, members: Member[]): Promise<void> {
  await kv.put('members', JSON.stringify(members))
}

export async function getRingOrder(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get('ring-order')
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function setRingOrder(kv: KVNamespace, order: string[]): Promise<void> {
  await kv.put('ring-order', JSON.stringify(order))
}

export async function getHealthStatus(kv: KVNamespace, slug: string): Promise<HealthStatus | null> {
  const raw = await kv.get(`health:${slug}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as HealthStatus
  } catch {
    return null
  }
}

export async function setHealthStatus(kv: KVNamespace, slug: string, status: HealthStatus): Promise<void> {
  await kv.put(`health:${slug}`, JSON.stringify(status))
}
