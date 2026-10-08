'use client'
import { useEffect, useRef, useState } from 'react'
import { Text } from './Content'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import styles from './Site.module.css'
export function DocumentText({ value }: { value?: SerializedEditorState | null }) {
  const root = useRef<HTMLDivElement>(null)
  const [headings, setHeadings] = useState<{ id: string; title: string }[]>([])
  useEffect(() => {
    const rows = Array.from(root.current?.querySelectorAll('h2, h3') || []).map((heading, i) => { const id = `section-${i + 1}`; heading.id = id; return { id, title: heading.textContent || '' } })
    setHeadings(rows)
  }, [value])
  return <>{headings.length > 2 && <nav className={styles.toc} aria-label="Оглавление"><strong>Содержание</strong><ul>{headings.map(h => <li key={h.id}><a href={`#${h.id}`}>{h.title}</a></li>)}</ul></nav>}<div ref={root}><Text value={value} /></div></>
}
