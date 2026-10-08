import { context } from '@/lib/cms'
import { ItemCard, Empty, Picture, SectionTitle } from '@/components/Content'
import styles from '@/components/Site.module.css'
export const metadata = { title: 'Шоурумы' }
export default async function Showrooms() {
  const { payload, preview, user } = await context()
  const rooms = await payload.find({ collection: 'showrooms', sort: 'order', limit: 100, depth: 2, draft: preview, user, overrideAccess: false })
  return <><SectionTitle eyebrow="KILTA / Встретимся лично" title="Шоурумы" />{rooms.docs.length ? rooms.docs.map(room => <section className={styles.showroom} key={room.id}><span className={styles.eyebrow}>{room.city}</span><h2>{room.title}</h2><p>{room.address}</p><p>{room.hours}</p><p style={{ whiteSpace: 'pre-line' }}>{room.contacts}</p>{room.routeURL && <a className={styles.textLink} href={room.routeURL} target="_blank" rel="noopener noreferrer">Открыть маршрут на карте ↗</a>}{room.gallery?.length ? <div className={styles.grid}>{room.gallery.map((g, i) => <Picture key={i} media={g.image} />)}</div> : null}{room.items?.length ? <><h3 style={{ marginTop: 35 }}>В этом шоуруме</h3><div className={styles.grid}>{room.items.filter(i => typeof i === 'object' && (preview || i._status === 'published')).map(i => typeof i === 'object' && <ItemCard key={i.id} item={i} />)}</div></> : null}</section>) : <Empty>Адреса появятся после публикации владельцем. Уточнить возможность встречи можно через контакты.</Empty>}</>
}
