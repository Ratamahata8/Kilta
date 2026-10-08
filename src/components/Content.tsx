import { Link } from "react-router-dom";
import type { Snapshot } from "../lib/types";
import { useCatalog } from "../lib/store";
import { RichText } from "./RichText";
import type { RichNode } from "../lib/types";
import styles from "./Site.module.css";
export function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
export function Picture({
  id,
  hero = false,
  className = "",
}: {
  id?: string | null;
  hero?: boolean;
  className?: string;
}) {
  const { media } = useCatalog();
  const image = media.find((m) => m.id === id);
  if (!image?.url)
    return (
      <div className={`${styles.noImage} ${className}`}>
        Фотография скоро появится
      </div>
    );
  return (
    <img
      className={`${styles.image} ${className}`}
      src={hero ? image.heroUrl || image.url : image.url}
      alt={image.alt}
      width={hero ? 1920 : 720}
      height={hero ? 1280 : 900}
      loading={hero ? "eager" : "lazy"}
      style={{ objectPosition: `${image.focal_x}% ${image.focal_y}%` }}
    />
  );
}
export function Text({ value }: { value?: RichNode | string | null }) {
  return (
    <div className={styles.rich}>
      <RichText value={value} />
    </div>
  );
}
export function price(item: Snapshot) {
  return item.data.priceMode === "request" || item.data.price == null
    ? "Цена по запросу"
    : `${item.data.priceMode === "from" ? "от " : ""}${new Intl.NumberFormat("ru-RU").format(item.data.price)} ₽`;
}
export const availability = {
  order: "Под заказ",
  stock: "В наличии",
  sold: "Продано",
};
export function ItemCard({ item }: { item: Snapshot }) {
  return (
    <article className={styles.card}>
      <Link to={`/products/${item.slug}`}>
        <Picture id={item.data.image} />
        <div className={styles.cardText}>
          <div>
            <h3>{item.data.title}</h3>
            <p>
              {availability[item.data.availability || "order"]}
              {item.data.demo ? " · Демо" : ""}
            </p>
          </div>
          <span>{price(item)}</span>
        </div>
      </Link>
    </article>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
export function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className={styles.sectionTitle}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <h1>{title}</h1>
    </div>
  );
}
