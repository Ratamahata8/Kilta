import Link from 'next/link'
import styles from '@/components/Site.module.css'
export default function NotFound() { return <section className={styles.errorPage}><span className={styles.eyebrow}>404 / Страница не найдена</span><h1>Поищем в коллекции?</h1><p>Этот адрес больше не существует или страница ещё не опубликована.</p><Link className={styles.button} href="/catalog">Перейти в каталог ↗</Link></section> }
