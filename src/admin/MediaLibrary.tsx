import { useState } from "react";
import { useAdmin, useSignedImages } from "./context";
import { uploadFile } from "../lib/uploads";
import { backend, check } from "../lib/supabase";
import { usage, deleteMedia } from "../lib/api";
import type { Media } from "../lib/types";
import styles from "./Admin.module.css";
export function MediaLibrary() {
  const { media, reload } = useAdmin(),
    urls = useSignedImages(media);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [kind, setKind] = useState<"image" | "pdf">("image"),
    [editing, setEditing] = useState<Media | null>(null),
    [deleting, setDeleting] = useState<Media | null>(null);
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка операции");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.panel}>
      <h2>Изображения и PDF</h2>
      <p className={styles.hint}>
        Оригиналы и черновики — в приватном хранилище. Публичные WebP-копии
        создаются только при публикации. История редакций сохраняет используемые
        файлы.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      <form
        className={styles.form}
        style={{ margin: "25px 0" }}
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form),
            files = (data.getAll("files") as File[]).filter((f) => f.size);
          void action(async () => {
            let count = 0;
            const failures: string[] = [];
            for (const file of files) {
              try {
                await uploadFile(file, kind, String(data.get("alt") || ""));
                count++;
              } catch (error) {
                failures.push(
                  `${file.name}: ${error instanceof Error ? error.message : "Ошибка загрузки"}`,
                );
              }
            }
            await reload();
            if (failures.length)
              throw new Error(
                `Загружено файлов: ${count}. Не удалось загрузить: ${failures.join("; ")}`,
              );
            form.reset();
            setMessage(
              `Загружено файлов: ${count}. Проверьте описание каждого изображения.`,
            );
          });
        }}
      >
        <div className={styles.fields}>
          <label className={styles.field}>
            Тип файла
            <select
              aria-label="Тип файла"
              value={kind}
              onChange={(e) => setKind(e.target.value as "image" | "pdf")}
              disabled={busy}
            >
              <option value="image">Изображения (до 20 МБ)</option>
              <option value="pdf">PDF документов (до 10 МБ)</option>
            </select>
          </label>
          <label className={styles.field}>
            Описание для доступности
            <input name="alt" maxLength={400} />
            <small>
              Для нескольких файлов можно оставить пустым и заполнить описания
              отдельно после загрузки.
            </small>
          </label>
        </div>
        <label className={styles.field}>
          Файлы
          <input
            aria-label="Файлы"
            name="files"
            type="file"
            multiple
            required
            disabled={busy}
            accept={
              kind === "image"
                ? "image/jpeg,image/png,image/webp,image/avif"
                : "application/pdf"
            }
          />
        </label>
        <div>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Загружаем…" : "Загрузить файлы"}
          </button>
        </div>
      </form>
      {editing && (
        <form
          className={`${styles.dialog} ${styles.form}`}
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              check(
                await backend()
                  .from("media")
                  .update({
                    alt: editing.alt,
                    caption: editing.caption,
                    source: editing.source,
                    focal_x: editing.focal_x,
                    focal_y: editing.focal_y,
                  })
                  .eq("id", editing.id)
                  .select()
                  .single(),
              );
              await reload();
              setEditing(null);
              setMessage(
                "Описание файла сохранено. На публичном сайте оно обновится при следующей публикации связанной записи.",
              );
            });
          }}
        >
          <h3>Описание файла</h3>
          {editing.kind === "image" && urls[editing.id] && (
            <img
              src={urls[editing.id]}
              alt={editing.alt}
              style={{
                height: 220,
                width: "100%",
                objectFit: "cover",
                objectPosition: `${editing.focal_x}% ${editing.focal_y}%`,
              }}
            />
          )}
          {(["alt", "caption", "source"] as const).map((key, i) => (
            <label key={key} className={styles.field}>
              {["Описание для доступности", "Подпись", "Автор / источник"][i]}
              <input
                required={key === "alt"}
                maxLength={key === "alt" ? 400 : 1000}
                value={editing[key]}
                onChange={(e) =>
                  setEditing({ ...editing, [key]: e.target.value })
                }
              />
            </label>
          ))}
          {editing.kind === "image" && (
            <div className={styles.fields}>
              {(["focal_x", "focal_y"] as const).map((key, i) => (
                <label className={styles.field} key={key}>
                  Фокус: {i ? "по вертикали" : "по горизонтали"} ({editing[key]}
                  %)
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editing[key]}
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <div className={styles.inline}>
            <button disabled={busy} className={styles.primary}>
              Сохранить описание
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </form>
      )}
      {deleting && (
        <div
          className={styles.dialog}
          role="alertdialog"
          aria-label="Удаление файла"
        >
          <p>Удалить «{deleting.alt}»? Это действие нельзя отменить.</p>
          <div className={styles.inline}>
            <button
              disabled={busy}
              className={styles.danger}
              onClick={() =>
                void action(async () => {
                  await deleteMedia(deleting);
                  await reload();
                  setDeleting(null);
                  setMessage("Файл удалён.");
                })
              }
            >
              Да, удалить файл
            </button>
            <button onClick={() => setDeleting(null)}>Отмена</button>
          </div>
        </div>
      )}
      <div className={styles.gallery}>
        {media.map((item) => (
          <article className={styles.mediaCard} key={item.id}>
            {item.kind === "image" && urls[item.id] ? (
              <img
                src={urls[item.id]}
                alt={item.alt}
                style={{ objectPosition: `${item.focal_x}% ${item.focal_y}%` }}
              />
            ) : (
              <p>PDF · {Math.ceil(item.bytes / 1024)} КБ</p>
            )}
            <h3>{item.alt}</h3>
            <p>{item.caption}</p>
            <div className={styles.mediaActions}>
              <button onClick={() => setEditing({ ...item })}>
                Описание и фокус
              </button>
              <button
                onClick={() =>
                  void action(async () => {
                    const refs = await usage(item.id);
                    setMessage(
                      refs.length
                        ? `Используется: ${refs.map((r) => `${r.title} (${r.location})`).join(", ")}`
                        : "Файл пока не используется.",
                    );
                  })
                }
              >
                Где используется
              </button>
              <button disabled={busy} onClick={() => setDeleting(item)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
      {!media.length && (
        <p className={styles.notice}>
          Медиатека пока пуста. Загрузите свои изображения.
        </p>
      )}
    </div>
  );
}
