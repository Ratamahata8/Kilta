import Link from 'next/link'
import { context, globals } from '@/lib/cms'
import { Empty, ItemCard, Picture } from '@/components/Content'
import styles from '@/components/Site.module.css'
export default async function Home() {
  const { home, workshop } = await globals()
  const { payload, preview, user } = await context()
  const options = { overrideAccess: false, user, draft: preview, depth: 1 }
  const [items, categories, showrooms] = await Promise.all([
    payload.find({ collection: 'items', ...options, sort: 'order', limit: 6, where: home.featured?.length ? { id: { in: home.featured.map(i => typeof i === 'number' ? i : i.id) } } : { featured: { equals: true } } }),
    payload.find({ collection: 'categories', ...options, sort: 'order', limit: 100 }), payload.find({ collection: 'showrooms', ...options, sort: 'order', limit: 3 }),
  ])
  const sections = home.sections || []
  return <><section className={styles.hero}><div className={styles.heroText}><div><span className={styles.eyebrow}>KILTA / Авторская мебель и скульптуры</span><h1>{home.heading}</h1></div><div className={styles.heroAside}><p>{home.subtitle}</p><Link className={styles.textLink} href="/catalog">{home.primaryLabel} <span aria-hidden="true">↗</span></Link></div></div><div className={styles.heroMedia}><Picture media={home.image} hero /></div><div className={styles.heroCaption}><span>Естественные материалы. Выразительная форма.</span><Link href="/contacts">{home.secondaryLabel} ↗</Link></div></section>{sections.filter(s => s.visible).map((s, index) => {
    if (s.section === 'featured') return <section key={index} className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>01 / Коллекция</span><h2>Избранные предметы</h2></div><Link className={styles.textLink} href="/catalog">Весь каталог ↗</Link></div>{items.docs.length ? <div className={styles.grid}>{items.docs.map(item => <ItemCard key={item.id} item={item} />)}</div> : <Empty>Коллекция готовится к публикации.</Empty>}</section>
    if (s.section === 'categories') return <section key={index} className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>02 / Найти своё</span><h2>В коллекции</h2></div></div><div className={styles.categories}>{categories.docs.map(c => <Link className={styles.category} key={c.id} href={`/catalog?category=${c.slug}`}>{c.title}<span aria-hidden="true">↗</span></Link>)}</div></section>
    if (s.section === 'workshop') return <section key={index} className={styles.section}><div className={styles.split}><Picture media={workshop.image || home.image} /><div><span className={styles.eyebrow}>03 / За каждым предметом — человек</span><h2>Мастерская KILTA</h2><p>{home.story}</p><Link className={styles.textLink} href="/workshop">Познакомиться с мастерской ↗</Link></div></div></section>
    if (s.section === 'custom') return <section key={index} className={styles.section}><div className={styles.custom}><div><span className={styles.eyebrow}>04 / В диалоге с вами</span><h2>Предмет для вашего пространства</h2></div><div><p>{home.customOrder}</p><Link className={styles.textLink} href="/contacts">Обсудить идею ↗</Link></div></div></section>
    return <section key={index} className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>05 / Встретимся лично</span><h2>Шоурумы</h2></div><Link className={styles.textLink} href="/showrooms">Адреса и контакты ↗</Link></div>{showrooms.docs.length ? showrooms.docs.map(room => <p key={room.id}>{room.title} · {room.city}, {room.address}</p>) : <Empty>Информация о шоурумах появится здесь после публикации.</Empty>}</section>
  })}</>
}
