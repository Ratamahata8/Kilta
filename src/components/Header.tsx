import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Arrow } from "./Content";
import styles from "./Site.module.css";
export function Header({
  links,
  logo,
}: {
  links: { label: string; href: string }[];
  logo?: { url?: string; alt?: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  return (
    <header className={styles.header}>
      <Link className={styles.brand} to="/" aria-label="KILTA — главная">
        {logo?.url ? <img src={logo.url} alt={logo.alt || "KILTA"} /> : "KILTA"}
        <span>МЕБЕЛЬ & ОБЪЕКТЫ</span>
      </Link>
      <button
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="main-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? "Закрыть" : "Меню"}{" "}
        <span aria-hidden="true">{open ? "×" : "+"}</span>
      </button>
      <nav
        id="main-menu"
        className={`${styles.nav} ${open ? styles.navOpen : ""}`}
        aria-label="Основная навигация"
      >
        {links.map((link, i) => (
          <Link key={i} to={link.href}>
            {link.label}
          </Link>
        ))}
        <Link className={styles.navContact} to="/contacts">
          Обсудить проект <Arrow />
        </Link>
      </nav>
    </header>
  );
}
