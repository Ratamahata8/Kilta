import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useCatalog, useGlobal } from "../lib/store";
import { config, configStatus } from "../lib/config";
import { Header } from "./Header";
import { DemoThemes } from "../pages/PublicPages";
import { safeURL } from "../lib/validation";
import styles from "./Site.module.css";
export function ThemeEffect() {
  const d = useGlobal("appearance");
  useEffect(() => {
    document.body.dataset.theme = d.theme || "gallery";
    document.body.dataset.accent = d.accent || "natural";
  }, [d.theme, d.accent]);
  return null;
}
export function Shell() {
  const { entries, media, error, loading, refresh } = useCatalog();
  const navigation = useGlobal("navigation"),
    contacts = useGlobal("contacts"),
    seo = useGlobal("seo"),
    appearance = useGlobal("appearance");
  const location = useLocation();
  const documents = entries
      .filter(
        (e) =>
          e.kind === "document" &&
          (navigation.documents?.length
            ? navigation.documents.includes(e.id)
            : e.data.showInFooter),
      )
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0)),
    logo = media.find((m) => m.id === appearance.logo);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const main = document.getElementById("main");
    if (location.key !== "default") main?.focus({ preventScroll: true });
  }, [location.pathname, location.key]);
  useEffect(() => {
    const item = entries.find(
      (e) =>
        `/products/${e.slug}` === location.pathname ||
        `/documents/${e.slug}` === location.pathname,
    );
    document.title = item
      ? `${item.data.seoTitle || item.data.title} — ${seo.siteName || "KILTA"}`
      : `${seo.siteName || "KILTA"} — мебель и объекты`;
    const description = document.querySelector("meta[name=description]");
    description?.setAttribute(
      "content",
      item?.data.seoDescription ||
        seo.description?.toString() ||
        "Авторская мебель и скульптуры KILTA",
    );
    const icon = media.find((m) => m.id === appearance.favicon);
    document
      .querySelector("link[rel=icon]")
      ?.setAttribute("href", icon?.url || `${config.base}favicon.svg`);
    const image = media.find((m) => m.id === (item?.data.image || seo.ogImage));
    for (const [property, value] of Object.entries({
      "og:title": document.title,
      "og:site_name": seo.siteName || "KILTA",
      "og:description": description?.getAttribute("content") || "",
      "og:url": window.location.href,
      "og:image": image?.heroUrl || image?.url || "",
    })) {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.append(meta);
      }
      meta.setAttribute("content", value);
    }
  }, [
    location.pathname,
    entries,
    seo.siteName,
    seo.description,
    seo.ogImage,
    media,
    appearance.favicon,
  ]);
  return (
    <>
      <ThemeEffect />
      <a
        className={styles.skip}
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      {!configStatus.configured && (
        <aside className={styles.configBanner} role="status">
          {config.demo
            ? "Демо-режим: только просмотр. Данные не сохраняются, Supabase не подключён. Вход в админку, загрузка файлов и отправка заявок отключены."
            : "Supabase не подключён. Контент и вход в админку недоступны; требуется настройка проекта."}
          {config.demo && (
            <>
              <DemoThemes />
              <a
                href={`${config.base}demo/LICENSE.txt`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Источники демо-изображений (CC0 / CC BY 4.0)
              </a>
            </>
          )}
          {configStatus.error && <span>{configStatus.error}</span>}
        </aside>
      )}
      <div className={styles.shell}>
        <Header links={navigation.links || []} logo={logo} />
        <main id="main" tabIndex={-1}>
          {loading && (
            <p className={styles.empty} role="status">
              Загружаем коллекцию…
            </p>
          )}
          <>
            {error && (
              <div className={styles.notice} role="alert">
                Не удалось загрузить контент: {error}{" "}
                <button onClick={() => void refresh()}>
                  Повторить загрузку
                </button>
              </div>
            )}
            <Outlet />
          </>
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <div>
              <Link className={styles.brand} to="/">
                KILTA
              </Link>
              <p style={{ marginTop: 18, fontSize: 13 }}>
                {navigation.footerText}
              </p>
            </div>
            <div className={styles.footerLinks}>
              {documents.map((d) => (
                <Link key={d.id} to={`/documents/${d.slug}`}>
                  {d.data.title}
                </Link>
              ))}
            </div>
            <div className={styles.footerLinks}>
              {contacts.email && (
                <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
              )}
              {contacts.phone && (
                <a href={`tel:${contacts.phone.replace(/[^+0-9]/g, "")}`}>
                  {contacts.phone}
                </a>
              )}
              {contacts.social
                ?.filter((s) => safeURL(s.url))
                .map((s) => (
                  <a key={s.url} href={s.url} rel="noopener noreferrer">
                    {s.label}
                  </a>
                ))}
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} KILTA</span>
            <span>Мебель. Скульптуры. Ваше пространство.</span>
            <Link to="/admin">Для владельца</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
