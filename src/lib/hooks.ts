import { APIError, type CollectionBeforeDeleteHook, type CollectionBeforeChangeHook, type CollectionAfterChangeHook, type GlobalAfterChangeHook } from 'payload'
export const stableDocumentSlug: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (originalDoc && data.slug && data.slug !== originalDoc.slug) {
    const published = await req.payload.findVersions({ collection: 'documents', where: { and: [{ parent: { equals: originalDoc.id } }, { 'version._status': { equals: 'published' } }] }, limit: 1, depth: 0, overrideAccess: true, req })
    if (originalDoc._status === 'published' || published.totalDocs) throw new APIError('Адрес опубликованного документа менять нельзя: на него уже могут вести ссылки.', 400)
  }
  return data
}
export const protectFileDelete = (collection: 'media' | 'pdfs'): CollectionBeforeDeleteHook => async ({ id, req }) => {
  const references: string[] = []
  const check = (value: unknown) => value === id || (value && typeof value === 'object' && 'id' in value && value.id === id)
  const contains = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    if (Array.isArray(value)) return value.some(contains)
    return Object.entries(value).some(([key, child]) => ((collection === 'pdfs' ? key === 'pdf' : ['image', 'logo', 'favicon', 'ogImage'].includes(key)) && check(child)) || contains(child))
  }
  for (const slug of ['items', 'categories', 'showrooms', 'documents'] as const) {
    const docs = await req.payload.find({ collection: slug, limit: 0, pagination: false, depth: 0, overrideAccess: true, req })
    for (const row of docs.docs) if (contains(row)) references.push(String(row.title))
    const versions = await req.payload.findVersions({ collection: slug, limit: 0, pagination: false, depth: 0, overrideAccess: true, req })
    for (const row of versions.docs) if (contains(row.version)) references.push(`${row.version.title} (история редакций)`)
  }
  if (collection === 'media') for (const slug of ['home', 'workshop', 'appearance', 'seo'] as const) {
    const global = await req.payload.findGlobal({ slug, draft: true, depth: 0, overrideAccess: true, req })
    if (contains(global)) references.push(slug)
    const versions = await req.payload.findGlobalVersions({ slug, limit: 0, pagination: false, depth: 0, overrideAccess: true, req })
    if (versions.docs.some(row => contains(row.version))) references.push(`${slug} (история редакций)`)
  }
  if (references.length) throw new APIError(`Файл используется: ${[...new Set(references)].join(', ')}. Сначала замените ссылки. Файлы из истории редакций сохраняются для восстановления.`, 400)
}
export const preserveRevision: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (doc._status !== 'published') return doc
  // Immutable snapshot persisted in the same transaction as publication.
  await req.payload.create({ collection: 'document-revisions', data: { document: doc.id, title: doc.title, slug: doc.slug, type: doc.type, body: doc.body, pdf: doc.pdf, publishedAt: doc.updatedAt }, overrideAccess: true, req })
  return doc
}
export const noCacheChange: GlobalAfterChangeHook = ({ doc }) => doc
