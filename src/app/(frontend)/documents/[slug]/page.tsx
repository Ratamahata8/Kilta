import { cache } from 'react'
import { notFound } from 'next/navigation'
import { context } from '@/lib/cms'
import { DocumentText } from '@/components/DocumentText'
import styles from '@/components/Site.module.css'
const find = cache(async (slug: string) => { const { payload, preview, user } = await context(); return (await payload.find({ collection: 'documents', where: { slug: { equals: slug } }, limit: 1, draft: preview, user, depth: 1, overrideAccess: false })).docs[0] })
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return { title: (await find((await params).slug))?.title || 'Документ' } }
export default async function Document({ params }: { params: Promise<{ slug: string }> }) { const doc = await find((await params).slug); if (!doc) notFound(); return <article className={styles.document}><span className={styles.eyebrow}>KILTA / Документы</span><h1>{doc.title}</h1><p className={styles.documentMeta}>Редакция от {new Date(doc.editionDate).toLocaleDateString('ru-RU')}{doc.effectiveDate ? ` · Вступает в силу ${new Date(doc.effectiveDate).toLocaleDateString('ru-RU')}` : ''}</p><DocumentText value={doc.body} />{typeof doc.pdf === 'object' && doc.pdf?.url && <a className={styles.textLink} href={doc.pdf.url}>Скачать PDF</a>}</article> }
