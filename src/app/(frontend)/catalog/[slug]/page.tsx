import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { context } from '@/lib/cms'
import { Picture, Text, price, availability } from '@/components/Content'
import styles from '@/components/Site.module.css'
const find = cache(async (slug: string) => {
  const { payload, preview, user } = await context()
  return (await payload.find({ collection: 'items', where: { slug: { equals: slug } }, limit: 1, draft: preview, user, depth: 1, overrideAccess: false })).docs[0]
})
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const item = await find((await params).slug); return { title: item?.seo?.title || item?.title || 'Предмет не найден', description: item?.seo?.description || undefined } }
export default async function Item({ params }: { params: Promise<{ slug: string }> }) {
  const item = await find((await params).slug)
  if (!item) notFound()
  const photos = [item.image, ...(item.gallery || []).map(g => g.image)].filter((m, i, a) => m && a.findIndex(p => (typeof p === 'number' ? p : p?.id) === (typeof m === 'number' ? m : m?.id)) === i)
  return <><div className={styles.breadcrumb}><Link href="/catalog">Коллекция</Link> / {item.title}</div><article className={styles.product}><div className={styles.productGallery}>{photos.length ? photos.map((media, i) => <figure key={i}><Picture media={media} hero={i === 0} />{typeof media === 'object' && media?.caption && <figcaption>{media.caption}</figcaption>}</figure>) : <Picture />}</div><div className={styles.productDetails}><span className={styles.eyebrow}>{item.categories?.map(c => typeof c === 'object' ? c.title : '').filter(Boolean).join(' / ') || 'KILTA'}</span><h1>{item.title}</h1>{item.demo && <p className={styles.notice} style={{ marginTop: 24 }}>Демонстрационный предмет. Изображение и характеристики — примеры для проверки сайта.</p>}<p className={styles.productPrice}>{price(item)}</p><p style={{ color: 'var(--muted)', fontSize: 13 }}>{availability[item.availability]}</p><div style={{ marginTop: 30 }}><Text value={item.description} /></div><dl className={styles.productFacts}><dt>Материалы</dt><dd>{item.materials?.map(m => m.name).join(', ') || 'Уточняются'}</dd><dt>Размеры</dt><dd>{['height', 'width', 'depth'].map((key, i) => { const value = item.dimensions?.[key as 'height']; return value != null ? `${['В', 'Ш', 'Г'][i]} ${value}` : null }).filter(Boolean).join(' × ') || 'Уточняются'} {item.unit === 'mm' ? 'мм' : 'см'}</dd>{item.leadTime && <><dt>Срок изготовления</dt><dd>{item.leadTime}</dd></>}{item.options && <><dt>Варианты</dt><dd>{item.options}</dd></>}</dl><Link className={styles.button} href={`/contacts?item=${item.id}`}>Обсудить этот предмет ↗</Link></div></article></>
}
