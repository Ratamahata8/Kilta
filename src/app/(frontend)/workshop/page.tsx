import Link from 'next/link'
import { globals } from '@/lib/cms'
import { Picture, SectionTitle, Text } from '@/components/Content'
import styles from '@/components/Site.module.css'
export const metadata = { title: 'Мастерская' }
export default async function Workshop() { const { workshop } = await globals(); return <><SectionTitle eyebrow="KILTA / О нас" title={workshop.heading || 'Мастерская'} /><section className={styles.section}><div className={styles.split}><Picture media={workshop.image} hero /><div><Text value={workshop.body} /></div></div>{workshop.gallery?.length ? <div className={styles.grid} style={{ marginTop: 35 }}>{workshop.gallery.map((g, i) => <Picture key={i} media={g.image} />)}</div> : null}</section><section className={styles.section}><h2>Индивидуальный заказ</h2><p style={{ margin: '25px 0' }}>{workshop.customOrder}</p><Link className={styles.textLink} href="/contacts">Обсудить проект ↗</Link></section></> }
