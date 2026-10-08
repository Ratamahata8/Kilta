import Link from 'next/link'
import type { Metadata } from 'next'
import { globals, context } from '@/lib/cms'
import { Header } from '@/components/Header'
import styles from '@/components/Site.module.css'
export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  const { seo, appearance } = await globals()
  const icon = typeof appearance.favicon === 'object' && appearance.favicon?.url
  const og = typeof seo.ogImage === 'object' && seo.ogImage?.url
  return { metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL!), title: { default: seo.siteName, template: `%s — ${seo.siteName}` }, description: seo.description, robots: process.env.INDEXING_ENABLED === 'true' ? { index: true, follow: true } : { index: false, follow: false }, icons: icon ? { icon } : undefined, openGraph: { title: seo.siteName, description: seo.description || undefined, images: og ? [og] : [] } }
}
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { appearance, contacts, navigation } = await globals()
  const { payload, preview, user } = await context()
  const { docs } = await payload.find({ collection: 'documents', where: { and: [{ _status: { equals: 'published' } }, { showInFooter: { equals: true } }] }, depth: 0, pagination: false, limit: 0, sort: 'order', overrideAccess: false, user })
  const selected = navigation.documents?.map(d => typeof d === 'number' ? d : d.id)
  const documents = selected?.length ? docs.filter(d => selected.includes(d.id)).sort((a, b) => selected.indexOf(a.id) - selected.indexOf(b.id)) : docs
  return <html lang="ru"><body data-theme={appearance.theme || 'gallery'} data-accent={appearance.accent || 'natural'}><a className={styles.skip} href="#main">Перейти к содержимому</a>{preview && <div className={styles.preview}>Предпросмотр черновика — виден только редактору.<a href="/preview/exit">Завершить предпросмотр</a><Link href="/admin">В админку</Link></div>}<div className={styles.shell}><Header links={navigation.links || []} logo={typeof appearance.logo === 'object' ? appearance.logo : null} /><main id="main">{children}</main><footer className={styles.footer}><div className={styles.footerTop}><div><Link className={styles.brand} href="/">KILTA</Link><p style={{ marginTop: 18, fontSize: 13 }}>{navigation.footerText}</p></div><div className={styles.footerLinks}>{documents.map(d => <Link key={d.id} href={`/documents/${d.slug}`}>{d.title}</Link>)}</div><div className={styles.footerLinks}>{contacts.email && <a href={`mailto:${contacts.email}`}>{contacts.email}</a>}{contacts.phone && <a href={`tel:${contacts.phone.replace(/[^+0-9]/g, '')}`}>{contacts.phone}</a>}</div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} KILTA</span><span>Мебель. Скульптуры. Ваше пространство.</span><Link href="/admin">Для владельца</Link></div></footer></div></body></html>
}
