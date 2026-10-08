import type { MetadataRoute } from 'next'
export const dynamic = 'force-dynamic'
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', allow: process.env.INDEXING_ENABLED === 'true' ? '/' : undefined, disallow: process.env.INDEXING_ENABLED === 'true' ? ['/admin', '/api', '/preview'] : '/' }, sitemap: process.env.INDEXING_ENABLED === 'true' ? `${process.env.NEXT_PUBLIC_SERVER_URL}/sitemap.xml` : undefined } }
