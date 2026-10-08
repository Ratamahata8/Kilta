import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCatalog, useGlobal } from "../lib/store";
import {
  Picture,
  Text,
  ItemCard,
  Empty,
  SectionTitle,
  price,
  availability,
  Arrow,
} from "../components/Content";
import { headings } from "../components/RichText";
import { safeURL } from "../lib/validation";
import type { Snapshot } from "../lib/types";
import styles from "../components/Site.module.css";
export function HomePage() {
  const home = useGlobal("home"),
    workshop = useGlobal("workshop");
  const { entries } = useCatalog();
  const products = entries
    .filter(
      (e) =>
        e.kind === "product" &&
        (home.items?.length ? home.items.includes(e.id) : e.data.featured),
    )
    .sort((a, b) => (a.data.order || 0) - (b.data.order || 0))
    .slice(0, 6);
  const categories = entries
      .filter((e) => e.kind === "category")
      .sort((a, b) => (a.data.order || 0) - (b.data.order || 0)),
    rooms = entries.filter((e) => e.kind === "showroom");
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <div>
            <span className={styles.eyebrow}>
              KILTA / Авторская мебель и скульптуры
            </span>
            <h1>{home.heading || "Предметы с характером"}</h1>
          </div>
          <div className={styles.heroAside}>
            <p>{home.subtitle}</p>
            <Link className={styles.textLink} to="/catalog">
              {home.primaryLabel || "Смотреть коллекцию"} <Arrow />
            </Link>
          </div>
        </div>
        <div className={styles.heroMedia}>
          <Picture id={home.image} hero />
        </div>
        <div className={styles.heroCaption}>
          <span>Естественные материалы. Выразительная форма.</span>
          <Link to="/contacts">
            {home.secondaryLabel || "Обсудить заказ"} <Arrow />
          </Link>
        </div>
      </section>
      {home.sections
        ?.filter((s) => s.visible)
        .map((section, i) => {
          if (section.section === "featured")
            return (
              <section key={i} className={styles.section}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.eyebrow}>01 / Коллекция</span>
                    <h2>Избранные предметы</h2>
                  </div>
                  <Link className={styles.textLink} to="/catalog">
                    Весь каталог <Arrow />
                  </Link>
                </div>
                {products.length ? (
                  <div className={styles.grid}>
                    {products.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <Empty>Коллекция готовится к публикации.</Empty>
                )}
              </section>
            );
          if (section.section === "categories")
            return (
              <section key={i} className={styles.section}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.eyebrow}>02 / Найти своё</span>
                    <h2>В коллекции</h2>
                  </div>
                </div>
                <div className={styles.categories}>
                  {categories.map((c) => (
                    <Link
                      className={styles.category}
                      key={c.id}
                      to={`/catalog?category=${c.slug}`}
                    >
                      {c.data.title}
                      <Arrow />
                    </Link>
                  ))}
                </div>
              </section>
            );
          if (section.section === "workshop")
            return (
              <section key={i} className={styles.section}>
                <div className={styles.split}>
                  <Picture id={workshop.image || home.image} />
                  <div>
                    <span className={styles.eyebrow}>
                      03 / За каждым предметом — человек
                    </span>
                    <h2>Мастерская KILTA</h2>
                    <p>{home.story}</p>
                    <Link className={styles.textLink} to="/workshop">
                      Познакомиться с мастерской <Arrow />
                    </Link>
                  </div>
                </div>
              </section>
            );
          if (section.section === "custom")
            return (
              <section key={i} className={styles.section}>
                <div className={styles.custom}>
                  <div>
                    <span className={styles.eyebrow}>
                      04 / В диалоге с вами
                    </span>
                    <h2>Предмет для вашего пространства</h2>
                  </div>
                  <div>
                    <p>{home.customOrder}</p>
                    <Link className={styles.textLink} to="/contacts">
                      Обсудить идею <Arrow />
                    </Link>
                  </div>
                </div>
              </section>
            );
          return (
            <section key={i} className={styles.section}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>05 / Встретимся лично</span>
                  <h2>Шоурумы</h2>
                </div>
                <Link className={styles.textLink} to="/showrooms">
                  Адреса и контакты <Arrow />
                </Link>
              </div>
              {rooms.length ? (
                rooms.map((r) => (
                  <p key={r.id}>
                    {r.data.title} · {r.data.city}, {r.data.address}
                  </p>
                ))
              ) : (
                <Empty>
                  Адреса шоурумов появятся после публикации владельцем.
                </Empty>
              )}
            </section>
          );
        })}
    </>
  );
}
export function CatalogPage() {
  const { entries } = useCatalog();
  const [params, setParams] = useSearchParams();
  const categories = entries.filter((e) => e.kind === "category"),
    products = entries.filter((e) => e.kind === "product"),
    materials = [
      ...new Set(products.flatMap((e) => e.data.materials || [])),
    ].sort();
  const selected = categories.find((e) => e.slug === params.get("category"));
  const filtered = products
    .filter((e) => {
      const d = e.data;
      return (
        (!params.get("category") ||
          (selected && d.categories?.includes(selected.id))) &&
        (!params.get("availability") ||
          d.availability === params.get("availability")) &&
        (!params.get("material") ||
          d.materials?.includes(params.get("material")!)) &&
        (!params.get("min") ||
          (d.priceMode !== "request" &&
            d.price != null &&
            d.price >= Number(params.get("min")))) &&
        (!params.get("max") ||
          (d.priceMode !== "request" &&
            d.price != null &&
            d.price <= Number(params.get("max"))))
      );
    })
    .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1)),
    total = Math.ceil(filtered.length / 12),
    visible = filtered.slice((page - 1) * 12, page * 12);
  const next = (n: number) => {
    const p = new URLSearchParams(params);
    p.set("page", String(n));
    setParams(p);
  };
  return (
    <>
      <SectionTitle eyebrow="KILTA / Коллекция" title="Предметы и объекты" />
      <form
        key={params.toString()}
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setParams(
            new URLSearchParams(
              [...data.entries()]
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => [k, String(v)]),
            ),
          );
        }}
      >
        <label className={styles.field}>
          Категория
          <select name="category" defaultValue={params.get("category") || ""}>
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.data.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Наличие
          <select
            name="availability"
            defaultValue={params.get("availability") || ""}
          >
            <option value="">Любое</option>
            <option value="stock">В наличии</option>
            <option value="order">Под заказ</option>
            <option value="sold">Продано</option>
          </select>
        </label>
        <label className={styles.field}>
          Материал
          <select name="material" defaultValue={params.get("material") || ""}>
            <option value="">Все материалы</option>
            {materials.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Цена от, ₽
          <input
            type="number"
            name="min"
            min="0"
            defaultValue={params.get("min") || ""}
          />
        </label>
        <label className={styles.field}>
          Цена до, ₽
          <input
            type="number"
            name="max"
            min="0"
            defaultValue={params.get("max") || ""}
          />
        </label>
        <button className={styles.button}>Показать</button>
      </form>
      <p className={styles.results}>
        Найдено предметов: {filtered.length} ·{" "}
        <Link className={styles.textLink} to="/catalog">
          Сбросить фильтры
        </Link>
      </p>
      {visible.length ? (
        <div className={styles.grid}>
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty>
          В этой подборке пока нет предметов. Попробуйте другие фильтры.
        </Empty>
      )}
      <nav className={styles.pagination} aria-label="Страницы каталога">
        {page > 1 && (
          <button className={styles.button} onClick={() => next(page - 1)}>
            ← Назад
          </button>
        )}
        {total > 1 && (
          <span>
            {page} / {total}
          </span>
        )}
        {page < total && (
          <button className={styles.button} onClick={() => next(page + 1)}>
            Далее →
          </button>
        )}
      </nav>
    </>
  );
}
export function ProductPage({ entry }: { entry?: Snapshot }) {
  const { slug } = useParams();
  const { entries, media } = useCatalog();
  const item =
    entry || entries.find((e) => e.kind === "product" && e.slug === slug);
  if (!item) return <NotFoundPage />;
  const d = item.data,
    photos = [
      ...new Set(
        [d.image, ...(d.gallery || [])].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    ];
  return (
    <>
      <div className={styles.breadcrumb}>
        <Link to="/catalog">Коллекция</Link> / {d.title}
      </div>
      <article className={styles.product}>
        <div className={styles.productGallery}>
          {photos.length ? (
            photos.map((id, i) => {
              const photo = media.find((m) => m.id === id);
              return (
                <figure key={id}>
                  <Picture id={id} hero={i === 0} />
                  {photo?.caption && <figcaption>{photo.caption}</figcaption>}
                </figure>
              );
            })
          ) : (
            <Picture />
          )}
        </div>
        <div className={styles.productDetails}>
          <span className={styles.eyebrow}>
            {entries
              .filter(
                (e) => e.kind === "category" && d.categories?.includes(e.id),
              )
              .map((e) => e.data.title)
              .join(" / ") || "KILTA"}
          </span>
          <h1>{d.title}</h1>
          {d.demo && (
            <p className={styles.notice} style={{ marginTop: 24 }}>
              Демонстрационный предмет. Изображение и характеристики — примеры
              для проверки сайта.
            </p>
          )}
          <p className={styles.productPrice}>{price(item)}</p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            {availability[d.availability || "order"]}
          </p>
          <div style={{ marginTop: 30 }}>
            <Text value={d.description} />
          </div>
          <dl className={styles.productFacts}>
            <dt>Материалы</dt>
            <dd>{d.materials?.join(", ") || "Уточняются"}</dd>
            <dt>Размеры</dt>
            <dd>
              {(["height", "width", "depth"] as const)
                .map((key, i) =>
                  d.dimensions?.[key] != null
                    ? `${["В", "Ш", "Г"][i]} ${d.dimensions[key]}`
                    : null,
                )
                .filter(Boolean)
                .join(" × ") || "Уточняются"}{" "}
              {d.unit === "mm" ? "мм" : "см"}
            </dd>
            {d.leadTime && (
              <>
                <dt>Срок изготовления</dt>
                <dd>{d.leadTime}</dd>
              </>
            )}
            {d.options && (
              <>
                <dt>Варианты</dt>
                <dd>{d.options}</dd>
              </>
            )}
          </dl>
          <Link className={styles.button} to={`/contacts?item=${item.id}`}>
            Обсудить этот предмет <Arrow />
          </Link>
        </div>
      </article>
    </>
  );
}
export function WorkshopPage() {
  const d = useGlobal("workshop");
  return (
    <>
      <SectionTitle
        eyebrow="KILTA / О нас"
        title={d.heading || "Мастерская KILTA"}
      />
      <section className={styles.section}>
        <div className={styles.split}>
          <Picture id={d.image} hero />
          <div>
            <Text value={d.body} />
          </div>
        </div>
        {d.gallery?.length ? (
          <div className={styles.grid} style={{ marginTop: 35 }}>
            {d.gallery.map((id) => (
              <Picture key={id} id={id} />
            ))}
          </div>
        ) : null}
      </section>
      <section className={styles.section}>
        <h2>Индивидуальный заказ</h2>
        <p style={{ margin: "25px 0" }}>{d.customOrder}</p>
        <Link className={styles.textLink} to="/contacts">
          Обсудить проект <Arrow />
        </Link>
      </section>
    </>
  );
}
export function ShowroomsPage() {
  const { entries } = useCatalog();
  const rooms = entries.filter((e) => e.kind === "showroom");
  return (
    <>
      <SectionTitle eyebrow="KILTA / Встретимся лично" title="Шоурумы" />
      {rooms.length ? (
        rooms.map((room) => (
          <section className={styles.showroom} key={room.id}>
            <span className={styles.eyebrow}>{room.data.city}</span>
            <h2>{room.data.title}</h2>
            <p>{room.data.address}</p>
            <p>{room.data.hours}</p>
            <p style={{ whiteSpace: "pre-line" }}>{room.data.contacts}</p>
            {safeURL(room.data.routeURL) && (
              <a
                className={styles.textLink}
                href={room.data.routeURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть маршрут на карте <Arrow />
              </a>
            )}
            {room.data.gallery?.length ? (
              <div className={styles.grid}>
                {room.data.gallery.map((id) => (
                  <Picture key={id} id={id} />
                ))}
              </div>
            ) : null}
            {room.data.items?.length ? (
              <>
                <h3 style={{ marginTop: 35 }}>В этом шоуруме</h3>
                <div className={styles.grid}>
                  {entries
                    .filter(
                      (e) =>
                        e.kind === "product" && room.data.items?.includes(e.id),
                    )
                    .map((e) => (
                      <ItemCard key={e.id} item={e} />
                    ))}
                </div>
              </>
            ) : null}
          </section>
        ))
      ) : (
        <Empty>
          Адреса появятся после публикации владельцем. Уточнить возможность
          встречи можно через контакты.
        </Empty>
      )}
    </>
  );
}
export function ContactsPage() {
  const d = useGlobal("contacts");
  const { entries } = useCatalog();
  const [params] = useSearchParams();
  const product = entries.find(
    (e) => e.kind === "product" && e.id === params.get("item"),
  );
  return (
    <>
      <SectionTitle
        eyebrow="KILTA / В диалоге с вами"
        title="Обсудим вашу идею"
      />
      <div className={styles.contactGrid}>
        <div className={styles.contactInfo}>
          <h2>Контакты</h2>
          {d.email && (
            <a
              href={`mailto:${d.email}${product ? `?subject=${encodeURIComponent(product.data.title)}` : ""}`}
            >
              {d.email}
            </a>
          )}
          {d.phone && (
            <a href={`tel:${d.phone.replace(/[^+0-9]/g, "")}`}>{d.phone}</a>
          )}
          {d.address && <p style={{ whiteSpace: "pre-line" }}>{d.address}</p>}
          {d.social
            ?.filter((s) => safeURL(s.url))
            .map((s, i) => (
              <a key={i} href={s.url} rel="noopener noreferrer" target="_blank">
                {s.label} <Arrow />
              </a>
            ))}
          {!d.email && !d.phone && (
            <Empty>Владелец ещё не опубликовал контактные данные.</Empty>
          )}
          {d.seller && (
            <>
              <h3>Реквизиты</h3>
              <p style={{ whiteSpace: "pre-line" }}>{d.seller}</p>
            </>
          )}
        </div>
        <div>
          <h2 style={{ fontSize: 34, marginBottom: 25 }}>
            {product
              ? `О предмете «${product.data.title}»`
              : "Индивидуальный заказ"}
          </h2>
          <p className={styles.notice}>
            Форма отправки заявок пока отключена. Если опубликованы контакты,
            свяжитесь с мастерской напрямую. Сайт не сохраняет обращения и не
            имитирует отправку.
          </p>
        </div>
      </div>
    </>
  );
}
export function DocumentPage({ entry }: { entry?: Snapshot }) {
  const { slug } = useParams();
  const { entries, media } = useCatalog();
  const doc =
    entry || entries.find((e) => e.kind === "document" && e.slug === slug);
  if (!doc) return <NotFoundPage />;
  const d = doc.data,
    toc = headings(d.body),
    pdf = media.find((m) => m.id === d.pdf);
  return (
    <article className={styles.document}>
      <span className={styles.eyebrow}>KILTA / Документы</span>
      <h1>{d.title}</h1>
      <p className={styles.documentMeta}>
        Редакция от{" "}
        {d.editionDate
          ? new Date(d.editionDate).toLocaleDateString("ru-RU")
          : "—"}
        {d.effectiveDate
          ? ` · Вступает в силу ${new Date(d.effectiveDate).toLocaleDateString("ru-RU")}`
          : ""}
      </p>
      {toc.length > 2 && (
        <nav className={styles.toc} aria-label="Оглавление">
          <strong>Содержание</strong>
          <ul>
            {toc.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(h.id)
                      ?.scrollIntoView({
                        behavior: matchMedia("(prefers-reduced-motion: reduce)")
                          .matches
                          ? "instant"
                          : "smooth",
                      });
                  }}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Text value={d.body} />
      {pdf?.url && (
        <a
          className={styles.textLink}
          href={pdf.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Скачать PDF
        </a>
      )}
    </article>
  );
}
export function NotFoundPage() {
  return (
    <section className={styles.errorPage}>
      <span className={styles.eyebrow}>404 / Страница не найдена</span>
      <h1>Поищем в коллекции?</h1>
      <p>Этот адрес больше не существует или страница ещё не опубликована.</p>
      <Link className={styles.button} to="/catalog">
        Перейти в каталог <Arrow />
      </Link>
    </section>
  );
}
export function DocumentTitle({ title }: { title: string }) {
  const seo = useGlobal("seo");
  useEffect(() => {
    document.title = `${title} — ${seo.siteName || "KILTA"}`;
  }, [title, seo.siteName]);
  return null;
}
export function DemoThemes() {
  const [theme, setTheme] = useState(document.body.dataset.theme || "gallery");
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      Предпросмотр темы
      <select
        aria-label="Предпросмотр темы"
        value={theme}
        onChange={(e) => {
          setTheme(e.target.value);
          document.body.dataset.theme = e.target.value;
        }}
      >
        <option value="gallery">Светлая галерея</option>
        <option value="warm">Тёплая мастерская</option>
        <option value="dark">Тёмный арт-каталог</option>
      </select>
    </label>
  );
}
