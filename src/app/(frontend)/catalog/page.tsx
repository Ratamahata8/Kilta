import Link from 'next/link'
import type { Where } from 'payload'
import { context } from '@/lib/cms'
import { ItemCard, Empty, SectionTitle } from '@/components/Content'
import styles from '@/components/Site.module.css'
export const metadata = { title: 'Коллекция' }
export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams
  const { payload, preview, user } = await context()
  const options = { overrideAccess: false, user, draft: preview }
  const categories = await payload.find({ collection: 'categories', ...options, limit: 100, sort: 'order' })
  const all = await payload.find({ collection: 'items', ...options, depth: 0, limit: 0, pagination: false, select: { materials: true } })
  const materials = [...new Set(all.docs.flatMap(i => i.materials?.map(m => m.name) || []))].sort()
  const conditions: Where[] = []
  if (filters.category) conditions.push({ categories: { contains: categories.docs.find(c => c.slug === filters.category)?.id || -1 } })
  if (filters.availability && ['stock', 'order', 'sold'].includes(filters.availability)) conditions.push({ availability: { equals: filters.availability } })
  if (filters.material) conditions.push({ 'materials.name': { equals: filters.material.slice(0, 100) } })
  for (const [key, op] of [['min', 'greater_than_equal'], ['max', 'less_than_equal']] as const) if (filters[key] && Number.isFinite(Number(filters[key])) && Number(filters[key]) >= 0) { conditions.push({ price: { [op]: Number(filters[key]) } }, { priceMode: { not_equals: 'request' } }) }
  const page = Math.max(1, Math.floor(Number(filters.page) || 1))
  const items = await payload.find({ collection: 'items', ...options, where: conditions.length ? { and: conditions } : undefined, limit: 12, page, sort: 'order', depth: 1 })
  const pageURL = (n: number) => { const params = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1]))); params.set('page', String(n)); return `/catalog?${params}` }
  return <><SectionTitle eyebrow="KILTA / Коллекция" title="Предметы и объекты" /><form className={styles.filters} action="/catalog"><label className={styles.field}>Категория<select name="category" defaultValue={filters.category || ''}><option value="">Все категории</option>{categories.docs.map(c => <option key={c.id} value={c.slug}>{c.title}</option>)}</select></label><label className={styles.field}>Наличие<select name="availability" defaultValue={filters.availability || ''}><option value="">Любое</option><option value="stock">В наличии</option><option value="order">Под заказ</option><option value="sold">Продано</option></select></label><label className={styles.field}>Материал<select name="material" defaultValue={filters.material || ''}><option value="">Все материалы</option>{materials.map(m => <option key={m}>{m}</option>)}</select></label><label className={styles.field}>Цена от, ₽<input type="number" name="min" min="0" defaultValue={filters.min} /></label><label className={styles.field}>Цена до, ₽<input type="number" name="max" min="0" defaultValue={filters.max} /></label><button className={styles.button}>Показать</button></form><p className={styles.results}>{items.totalDocs ? `Найдено предметов: ${items.totalDocs}` : 'Предметы не найдены'} · <Link className={styles.textLink} href="/catalog">Сбросить фильтры</Link></p>{items.docs.length ? <div className={styles.grid}>{items.docs.map(item => <ItemCard key={item.id} item={item} />)}</div> : <Empty>В этой подборке пока нет предметов. Попробуйте другие фильтры.</Empty>}<nav className={styles.pagination} aria-label="Страницы каталога">{items.hasPrevPage && <Link href={pageURL(page - 1)}>← Назад</Link>}{items.totalPages > 1 && <span>{items.page} / {items.totalPages}</span>}{items.hasNextPage && <Link href={pageURL(page + 1)}>Далее →</Link>}</nav></>
}
