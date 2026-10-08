'use client'
import styles from '@/components/Site.module.css'
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className={styles.errorPage}><h1>Не удалось загрузить страницу</h1><p>Попробуйте ещё раз чуть позже.</p><button className={styles.button} onClick={reset}>Повторить</button></section> }
