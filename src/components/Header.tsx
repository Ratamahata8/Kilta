'use client'
import Link from 'next/link'
import { useState } from 'react'
import styles from './Site.module.css'
export function Header({ links, logo }: { links: { label: string; href: string }[]; logo?: { url?: string | null; alt?: string } | null }) {
  const [open, setOpen] = useState(false)
  return <header className={styles.header}><Link className={styles.brand} href="/" aria-label="KILTA — главная">{logo?.url ? <img src={logo.url} alt={logo.alt || 'KILTA'} /> : 'KILTA'}<span>МЕБЕЛЬ & ОБЪЕКТЫ</span></Link><button className={styles.menuButton} aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(!open)}>{open ? 'Закрыть' : 'Меню'} <span aria-hidden="true">{open ? '×' : '+'}</span></button><nav id="main-menu" className={`${styles.nav} ${open ? styles.navOpen : ''}`} aria-label="Основная навигация">{links.map((link, i) => <Link key={i} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}<Link className={styles.navContact} href="/contacts">Обсудить проект <span aria-hidden="true">↗</span></Link></nav></header>
}
