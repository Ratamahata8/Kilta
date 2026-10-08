import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Media, Item } from '@/payload-types'
import styles from './Site.module.css'
export function Picture({ media, hero = false, className = '' }: { media?: number | Media | null; hero?: boolean; className?: string }) {
  if (!media || typeof media === 'number' || !media.url) return <div className={`${styles.noImage} ${className}`}>Фотография скоро появится</div>
  const src = (hero ? media.sizes?.hero?.url : media.sizes?.card?.url) || media.url
  return <img className={`${styles.image} ${className}`} src={src} alt={media.alt} width={hero ? 1920 : 720} height={hero ? 1280 : 900} loading={hero ? 'eager' : 'lazy'} style={{ objectPosition: `${media.focalX ?? 50}% ${media.focalY ?? 50}%` }} />
}
export function Text({ value }: { value?: SerializedEditorState | null }) { return value ? <div className={styles.rich}><RichText data={value} /></div> : null }
export function price(item: Item) { return item.priceMode === 'request' || item.price == null ? 'Цена по запросу' : `${item.priceMode === 'from' ? 'от ' : ''}${new Intl.NumberFormat('ru-RU').format(item.price)} ₽` }
export const availability = { order: 'Под заказ', stock: 'В наличии', sold: 'Продано' }
export function ItemCard({ item }: { item: Item }) { return <article className={styles.card}><Link href={`/catalog/${item.slug}`}><Picture media={item.image} /><div className={styles.cardText}><div><h3>{item.title}</h3><p>{availability[item.availability]}{item.demo ? ' · Демо' : ''}</p></div><span>{price(item)}</span></div></Link></article> }
export function Empty({ children }: { children: React.ReactNode }) { return <p className={styles.empty}>{children}</p> }
export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) { return <div className={styles.sectionTitle}>{eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}<h1>{title}</h1></div> }
