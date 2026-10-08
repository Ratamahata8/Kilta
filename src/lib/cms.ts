import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { draftMode, headers } from 'next/headers'
export const cms = cache(async () => getPayload({ config }))
export const context = cache(async () => {
  const payload = await cms()
  const preview = (await draftMode()).isEnabled
  const { user } = preview ? await payload.auth({ headers: await headers() }) : { user: null }
  return { payload, preview: Boolean(preview && user && ['owner', 'developer'].includes(user.role)), user: user || undefined }
})
export const globals = cache(async () => {
  const { payload, preview, user } = await context()
  const options = { draft: preview, user, overrideAccess: false, depth: 2 }
  const [home, appearance, contacts, navigation, seo, workshop] = await Promise.all([
    payload.findGlobal({ slug: 'home', ...options }), payload.findGlobal({ slug: 'appearance', ...options }),
    payload.findGlobal({ slug: 'contacts', ...options }), payload.findGlobal({ slug: 'navigation', ...options }),
    payload.findGlobal({ slug: 'seo', ...options }), payload.findGlobal({ slug: 'workshop', ...options }),
  ])
  return { home, appearance, contacts, navigation, seo, workshop }
})
