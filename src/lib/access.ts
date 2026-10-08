import type { Access, PayloadRequest, Where } from 'payload'
export const editor: Access = ({ req }) => Boolean(req.user && ['developer', 'owner'].includes(req.user.role))
export const developer: Access = ({ req }) => req.user?.role === 'developer'
export const published: Access = ({ req }) => req.user ? Boolean(editor({ req })) : { _status: { equals: 'published' } }
export const selfOrDeveloper: Access = ({ req }) => req.user?.role === 'developer' ? true : req.user ? { id: { equals: req.user.id } } : false

const idOf = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v && typeof v.id === 'number') return v.id
  return null
}
// Resolve only CURRENT PUBLISHED references. Explicit internal access bypass is narrowly
// scoped to reference discovery; no private content is returned to the caller.
export async function publicFileIDs(req: PayloadRequest, collection: 'media' | 'pdfs') {
  const ids = new Set<number>()
  const add = (value: unknown) => { const id = idOf(value); if (id !== null) ids.add(id) }
  const rows = await Promise.all(['items', 'categories', 'showrooms', 'documents'].map(async slug => {
    const found = await req.payload.find({ collection: slug as 'items', where: { _status: { equals: 'published' } }, depth: 0, limit: 0, pagination: false, overrideAccess: true, req })
    return found.docs as unknown as Record<string, unknown>[]
  }))
  for (const row of rows.flat()) {
    if (collection === 'pdfs') add(row.pdf)
    else {
      add(row.image)
      for (const image of (row.gallery || row.photos || []) as { image?: unknown }[]) add(image.image)
    }
  }
  if (collection === 'media') {
    for (const slug of ['home', 'workshop', 'appearance', 'seo'] as const) {
      const value = await req.payload.findGlobal({ slug, depth: 0, draft: false, overrideAccess: true, req })
      if (value._status !== 'published') continue
      const row = value as unknown as Record<string, unknown>
      for (const key of ['image', 'logo', 'favicon', 'ogImage']) add(row[key])
      for (const entry of (row.gallery || []) as { image?: unknown }[]) add(entry.image)
    }
  }
  return [...ids]
}
export const fileRead = (collection: 'media' | 'pdfs'): Access => async ({ req }) => {
  if (req.user) return Boolean(editor({ req }))
  const ids = await publicFileIDs(req, collection)
  return ids.length ? { id: { in: ids } } as Where : false
}
