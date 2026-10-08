import type { MetadataRoute } from 'next'
import { cms } from '@/lib/cms'
export const dynamic = 'force-dynamic'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.INDEXING_ENABLED !== 'true') return []
  const payload = await cms()
  const pages: MetadataRoute.Sitemap = ['/', '/catalog', '/workshop', '/showrooms', '/contacts'].map(path => ({ url: `${process.env.NEXT_PUBLIC_SERVER_URL}${path}` }))
  for (const collection of ['items', 'documents'] as const) { const { docs } = await payload.find({ collection, where: { _status: { equals: 'published' } }, depth: 0, limit: 0, pagination: false, overrideAccess: false }); pages.push(...docs.map(doc => ({ url: `${process.env.NEXT_PUBLIC_SERVER_URL}/${collection === 'items' ? 'catalog' : 'documents'}/${doc.slug}`, lastModified: doc.updatedAt }))) }
  return pages
}
