import type { Media } from "../lib/types";
import styles from "./Admin.module.css";
export function MediaSelect({
  label,
  value,
  onChange,
  media,
  urls,
  kind = "image",
}: {
  label: string;
  value?: string | null;
  onChange: (id: string | null) => void;
  media: Media[];
  urls: Record<string, string>;
  kind?: "image" | "pdf";
}) {
  const selected = media.find((m) => m.id === value);
  return (
    <div className={styles.selectedMedia}>
      <label className={styles.field}>
        {label}
        <select
          aria-label={label}
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Не выбрано</option>
          {media
            .filter((m) => m.kind === kind)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.alt}
              </option>
            ))}
        </select>
        <small>
          Загрузите файлы в разделе «Изображения и PDF», затем выберите здесь.
        </small>
      </label>
      {selected?.kind === "image" && urls[selected.id] && (
        <img src={urls[selected.id]} alt={selected.alt} />
      )}
    </div>
  );
}
export function GalleryField({
  value,
  onChange,
  media,
  urls,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  media: Media[];
  urls: Record<string, string>;
}) {
  const move = (index: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [id] = next.splice(index, 1);
    next.splice(to, 0, id);
    onChange(next);
  };
  return (
    <div className={styles.selectedMedia}>
      <label className={styles.field}>
        Галерея
        <select
          aria-label="Добавить в галерею"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value]);
          }}
        >
          <option value="">Добавить существующую фотографию…</option>
          {media
            .filter((m) => m.kind === "image" && !value.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.alt}
              </option>
            ))}
        </select>
        <small>
          Перетаскивайте строки или используйте кнопки «Выше» и «Ниже».
        </small>
      </label>
      {value.map((id, index) => {
        const item = media.find((m) => m.id === id);
        return (
          <div
            key={id}
            className={styles.picked}
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData("text/plain", String(index))
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (Number.isInteger(from) && from >= 0 && from < value.length)
                move(from, index);
            }}
          >
            {urls[id] && <img src={urls[id]} alt={item?.alt || ""} />}
            <span>
              {index + 1}. {item?.alt || "Файл недоступен"}
            </span>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
              aria-label={`Выше: ${item?.alt}`}
            >
              Выше
            </button>
            <button
              type="button"
              disabled={index === value.length - 1}
              onClick={() => move(index, index + 1)}
              aria-label={`Ниже: ${item?.alt}`}
            >
              Ниже
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Убрать: ${item?.alt}`}
            >
              Убрать
            </button>
          </div>
        );
      })}
    </div>
  );
}
