import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAdmin, useSignedImages } from "./context";
import { useCatalog } from "../lib/store";
import {
  defaultData,
  kindLabels,
  singletonKinds,
  type Entry,
  type Kind,
  type ContentData,
  type Version,
} from "../lib/types";
import {
  saveEntry,
  publishEntry,
  history,
  restore,
  unpublish,
  removeEntry,
} from "../lib/api";
import { RichEditor } from "./RichEditor";
import { MediaSelect, GalleryField } from "./MediaFields";
import styles from "./Admin.module.css";
const docTypes = [
  ["privacy", "Политика"],
  ["consent", "Согласие"],
  ["offer", "Оферта"],
  ["delivery", "Доставка и оплата"],
  ["returns", "Возврат и гарантия"],
  ["details", "Реквизиты"],
  ["cookies", "Cookie"],
];
const pages = [
  ["/", "Главная"],
  ["/catalog", "Каталог"],
  ["/workshop", "Мастерская"],
  ["/showrooms", "Шоурумы"],
  ["/contacts", "Контакты"],
];
function transliterate(value: string) {
  const letters: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return value
    .toLowerCase()
    .split("")
    .map((c) => letters[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function EditorRoute() {
  const { kind, id } = useParams();
  if (!kind || !(kind in kindLabels)) return <p>Раздел не найден.</p>;
  return <Editor key={kind} kind={kind as Kind} id={id || "new"} />;
}
function Editor({ kind, id }: { kind: Kind; id: string }) {
  const admin = useAdmin(),
    catalog = useCatalog(),
    navigate = useNavigate(),
    urls = useSignedImages(admin.media);
  const original =
    id === "new"
      ? null
      : admin.entries.find((e) => e.id === id && e.kind === kind) || null;
  const [entry, setEntry] = useState<Entry | null>(original),
    [data, setData] = useState<ContentData>(
      original?.draft || defaultData(kind),
    ),
    [slug, setSlug] = useState(
      original?.slug || (singletonKinds.includes(kind) ? kind : ""),
    ),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [versions, setVersions] = useState<Version[] | null>(null),
    [confirm, setConfirm] = useState<"publish" | "unpublish" | "delete" | null>(
      null,
    );
  const routeID = useRef(id);
  useEffect(() => {
    if (routeID.current === id) return;
    routeID.current = id;
    if (entry?.id === id) return;
    setEntry(original);
    setData(original?.draft || defaultData(kind));
    setSlug(original?.slug || (singletonKinds.includes(kind) ? kind : ""));
    setDirty(false);
    setMessage("");
    setError("");
    setVersions(null);
  }, [id, kind, entry?.id, original]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const set = <K extends keyof ContentData>(key: K, value: ContentData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  if (id !== "new" && !original && !entry)
    return <p className={styles.notice}>Запись не найдена или была удалена.</p>;
  const field = (
    key: keyof ContentData,
    label: string,
    type = "text",
    help?: string,
  ) => (
    <label className={styles.field}>
      {label}
      {type === "textarea" ? (
        <textarea
          aria-label={label}
          value={String(data[key] ?? "")}
          onChange={(e) => set(key, e.target.value as ContentData[typeof key])}
        />
      ) : (
        <input
          aria-label={label}
          type={type}
          value={String(data[key] ?? "")}
          onChange={(e) =>
            set(
              key,
              (type === "number"
                ? e.target.value === ""
                  ? undefined
                  : Number(e.target.value)
                : e.target.value) as ContentData[typeof key],
            )
          }
        />
      )}{" "}
      {help && <small>{help}</small>}
    </label>
  );
  const checkbox = (
    key: "featured" | "demo" | "showInFooter",
    label: string,
  ) => (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={Boolean(data[key])}
        onChange={(e) => set(key, e.target.checked)}
      />
      {label}
    </label>
  );
  const pick = (
    key: "image" | "pdf" | "logo" | "favicon" | "ogImage",
    label: string,
  ) => (
    <MediaSelect
      label={label}
      value={data[key]}
      onChange={(id) => set(key, id)}
      media={admin.media}
      urls={urls}
      kind={key === "pdf" ? "pdf" : "image"}
    />
  );
  const references = (
    key: "categories" | "items" | "documents",
    target: Kind,
    label: string,
  ) => (
    <fieldset className={styles.checkList}>
      <legend>{label}</legend>
      {admin.entries
        .filter((e) => e.kind === target)
        .map((e) => (
          <label key={e.id} className={styles.checkbox}>
            <input
              type="checkbox"
              checked={data[key]?.includes(e.id) || false}
              onChange={(event) =>
                set(
                  key,
                  event.target.checked
                    ? [...(data[key] || []), e.id]
                    : (data[key] || []).filter((i) => i !== e.id),
                )
              }
            />
            {e.draft.title}
          </label>
        ))}
      {!admin.entries.some((e) => e.kind === target) && (
        <span className={styles.hint}>
          Сначала создайте записи в разделе «{kindLabels[target]}».
        </span>
      )}
    </fieldset>
  );
  const operation = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Операция не выполнена");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const row = await saveEntry(entry, kind, slug, data);
    setEntry(row);
    setDirty(false);
    await admin.reload();
    if (id === "new")
      navigate(`/admin/edit/${kind}/${row.id}`, { replace: true });
    return row;
  };
  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <h2>
          {entry ? "Редактирование" : "Новая запись"} · {kindLabels[kind]}
        </h2>
        <Link to={`/admin/content/${kind}`}>К списку</Link>
      </div>
      <p className={styles.hint}>
        {dirty
          ? "Есть несохранённые изменения. Сохраните их перед переходом в другой раздел."
          : entry
            ? `Редакция ${entry.revision}. Черновик отделён от опубликованной страницы.`
            : "Сначала сохраните черновик."}
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
      {confirm && (
        <div
          className={styles.dialog}
          role="alertdialog"
          aria-label="Подтверждение действия"
        >
          <p>
            {confirm === "publish"
              ? "Опубликовать изменения? Выбранные изображения и PDF станут доступны всем посетителям."
              : confirm === "unpublish"
                ? "Снять публикацию? Уже скачанные или ранее публичные копии файлов отозвать нельзя."
                : "Удалить запись? История останется в базе для сохранности редакций."}
          </p>
          <div className={styles.inline}>
            <button
              disabled={busy}
              className={styles.primary}
              onClick={() =>
                void operation(async () => {
                  if (confirm === "publish") {
                    const row = dirty || !entry ? await save() : entry;
                    await publishEntry(row, admin.media);
                    const fresh = await admin.reload();
                    setEntry(
                      fresh.entries.find((e) => e.id === row.id) || null,
                    );
                    await catalog.refresh();
                    setMessage(
                      "Опубликовано. Изменения видны посетителям после обновления страницы; пересборка не нужна.",
                    );
                  } else if (confirm === "unpublish" && entry) {
                    await unpublish(entry);
                    const fresh = await admin.reload();
                    setEntry(
                      fresh.entries.find((e) => e.id === entry.id) || null,
                    );
                    await catalog.refresh();
                    setMessage(
                      "Публикация снята. Уже опубликованные копии файлов могли быть скачаны.",
                    );
                  } else if (confirm === "delete" && entry) {
                    await removeEntry(entry);
                    await admin.reload();
                    await catalog.refresh();
                    navigate(`/admin/content/${kind}`);
                  }
                  setConfirm(null);
                })
              }
            >
              Подтвердить
            </button>
            <button type="button" onClick={() => setConfirm(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void operation(async () => {
            await save();
            setMessage("Черновик сохранён. Публичная страница не изменилась.");
          });
        }}
      >
        <div className={styles.fields}>
          <label className={styles.field}>
            Название
            <input
              required
              maxLength={160}
              value={data.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!entry && !singletonKinds.includes(kind))
                  setSlug(transliterate(e.target.value));
              }}
            />
          </label>
          <label className={styles.field}>
            Адрес страницы
            <input
              aria-label="Адрес страницы"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              readOnly={
                singletonKinds.includes(kind) ||
                (kind === "document" &&
                  catalog.entries.some((e) => e.id === entry?.id))
              }
              onChange={(e) => {
                setSlug(e.target.value);
                setDirty(true);
              }}
            />
            <small>
              Латинские буквы, цифры, дефисы. Адрес опубликованного документа
              сохраняется навсегда.
            </small>
          </label>
        </div>
        {(kind === "product" ||
          kind === "category" ||
          kind === "home" ||
          kind === "workshop") &&
          pick(
            "image",
            kind === "home"
              ? "Изображение первого экрана"
              : "Основное изображение",
          )}
        {kind === "category" && field("description", "Описание", "textarea")}
        {kind === "product" && (
          <>
            {references("categories", "category", "Категории")}
            <GalleryField
              value={data.gallery || []}
              onChange={(ids) => set("gallery", ids)}
              media={admin.media}
              urls={urls}
            />
            <RichEditor
              label="Описание предмета"
              value={
                typeof data.description === "object"
                  ? data.description
                  : undefined
              }
              onChange={(value) => set("description", value)}
            />
            <label className={styles.field}>
              Материалы
              <input
                value={data.materials?.join(", ") || ""}
                onChange={(e) =>
                  set(
                    "materials",
                    e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
              <small>Перечислите через запятую. Например: дуб, текстиль.</small>
            </label>
            <div className={styles.fields}>
              {(["height", "width", "depth"] as const).map((key, i) => (
                <label key={key} className={styles.field}>
                  {["Высота", "Ширина", "Глубина"][i]}
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={data.dimensions?.[key] ?? ""}
                    onChange={(e) =>
                      set("dimensions", {
                        ...data.dimensions,
                        [key]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <label className={styles.field}>
                Единица размеров
                <select
                  value={data.unit || "cm"}
                  onChange={(e) => set("unit", e.target.value as "cm" | "mm")}
                >
                  <option value="cm">см</option>
                  <option value="mm">мм</option>
                </select>
              </label>
            </div>
            <div className={styles.fields}>
              <label className={styles.field}>
                Как показывать цену
                <select
                  value={data.priceMode}
                  onChange={(e) =>
                    set("priceMode", e.target.value as ContentData["priceMode"])
                  }
                >
                  <option value="request">Цена по запросу</option>
                  <option value="exact">Точная цена</option>
                  <option value="from">Цена от</option>
                </select>
              </label>
              {data.priceMode !== "request" && (
                <label className={styles.field}>
                  Стоимость, ₽
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={data.price ?? ""}
                    onChange={(e) =>
                      set(
                        "price",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
              )}
              <label className={styles.field}>
                Наличие
                <select
                  value={data.availability}
                  onChange={(e) =>
                    set(
                      "availability",
                      e.target.value as ContentData["availability"],
                    )
                  }
                >
                  <option value="order">Под заказ</option>
                  <option value="stock">В наличии</option>
                  <option value="sold">Продано</option>
                </select>
              </label>
              {field("leadTime", "Срок изготовления")}
            </div>
            {field("options", "Варианты исполнения", "textarea")}
            {checkbox(
              "featured",
              "Показывать на главной, если вручную не выбраны избранные",
            )}
            {checkbox(
              "demo",
              "Демонстрационный предмет — не настоящее изделие",
            )}
            {field("seoTitle", "Заголовок для поисковых систем")}
            {field(
              "seoDescription",
              "Описание для поисковых систем",
              "textarea",
            )}
          </>
        )}
        {kind === "showroom" && (
          <>
            <div className={styles.fields}>
              {field("city", "Город")}
              {field("address", "Адрес")}
              {field("hours", "Время работы")}
              {field("routeURL", "Проверенная ссылка на маршрут", "url")}
            </div>
            {field("contacts", "Контакты шоурума", "textarea")}
            <GalleryField
              value={data.gallery || []}
              onChange={(ids) => set("gallery", ids)}
              media={admin.media}
              urls={urls}
            />
            {references("items", "product", "Предметы в шоуруме")}
          </>
        )}
        {kind === "document" && (
          <>
            <div className={styles.fields}>
              <label className={styles.field}>
                Тип документа
                <select
                  value={data.documentType}
                  onChange={(e) =>
                    set(
                      "documentType",
                      e.target.value as ContentData["documentType"],
                    )
                  }
                >
                  {docTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {field("editionDate", "Дата редакции", "date")}
              {field("effectiveDate", "Дата вступления в действие", "date")}
            </div>
            <p className={styles.notice}>
              Юридический текст предоставляет владелец. Демонстрационные
              документы сохраняйте как черновики.
            </p>
            <RichEditor
              label="Текст документа"
              value={data.body}
              onChange={(value) => set("body", value)}
            />
            {pick("pdf", "PDF документа")}
            {checkbox("showInFooter", "Показывать ссылку в подвале")}
          </>
        )}
        {kind === "home" && (
          <>
            {field("heading", "Заголовок первого экрана")}
            {field("subtitle", "Подпись первого экрана", "textarea")}
            <div className={styles.fields}>
              {field("primaryLabel", "Текст кнопки каталога")}
              {field("secondaryLabel", "Текст кнопки обращения")}
            </div>
            {references(
              "items",
              "product",
              "Избранные предметы (если не выбраны — по отметке в предметах)",
            )}
            {field("story", "История семейной мастерской", "textarea")}
            {field("customOrder", "Индивидуальный заказ", "textarea")}
            <fieldset>
              <legend>Порядок и видимость секций</legend>
              {data.sections?.map((row, i) => (
                <div key={row.section} className={styles.row}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={row.visible}
                      onChange={(e) =>
                        set(
                          "sections",
                          data.sections?.map((s, index) =>
                            index === i
                              ? { ...s, visible: e.target.checked }
                              : s,
                          ),
                        )
                      }
                    />
                    {
                      {
                        featured: "Избранные",
                        categories: "Категории",
                        workshop: "Мастерская",
                        custom: "Индивидуальный заказ",
                        showrooms: "Шоурумы",
                      }[row.section]
                    }
                  </label>
                  <div className={styles.inline}>
                    {[-1, 1].map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        disabled={
                          i + dir < 0 || i + dir >= (data.sections?.length || 0)
                        }
                        onClick={() => {
                          const next = [...(data.sections || [])];
                          [next[i], next[i + dir]] = [next[i + dir], next[i]];
                          set("sections", next);
                        }}
                      >
                        {dir === -1 ? "Выше" : "Ниже"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          </>
        )}
        {kind === "workshop" && (
          <>
            {field("heading", "Заголовок страницы")}
            <RichEditor
              label="История мастерской"
              value={data.body}
              onChange={(value) => set("body", value)}
            />
            <GalleryField
              value={data.gallery || []}
              onChange={(ids) => set("gallery", ids)}
              media={admin.media}
              urls={urls}
            />
            {field("customOrder", "Блок индивидуального заказа", "textarea")}
          </>
        )}
        {kind === "appearance" && (
          <>
            <label className={styles.field}>
              Тема
              <select
                aria-label="Тема"
                value={data.theme}
                onChange={(e) =>
                  set("theme", e.target.value as ContentData["theme"])
                }
              >
                <option value="gallery">Светлая галерея</option>
                <option value="warm">Тёплая мастерская</option>
                <option value="dark">Тёмный арт-каталог</option>
              </select>
              <small>
                Сохраните и опубликуйте, чтобы применить на сайте. Пересборка не
                требуется.
              </small>
            </label>
            <label className={styles.field}>
              Акцент
              <select
                value={data.accent || "natural"}
                onChange={(e) =>
                  set("accent", e.target.value as ContentData["accent"])
                }
              >
                <option value="natural">Нейтральный</option>
                <option value="clay">Терракота</option>
                <option value="olive">Оливковый</option>
              </select>
              <small>
                Палитры подобраны для контраста. Произвольный JavaScript и CSS
                не поддерживаются.
              </small>
            </label>
            {pick("logo", "Логотип")}
            {pick("favicon", "Иконка сайта")}
          </>
        )}
        {kind === "contacts" && (
          <>
            <div className={styles.fields}>
              {field("phone", "Телефон")}
              {field("email", "Email", "email")}
            </div>
            {field("address", "Адрес", "textarea")}
            {field("seller", "Реквизиты продавца", "textarea")}
            <p className={styles.hint}>
              Изменение реквизитов не переписывает юридические документы
              автоматически.
            </p>
            <h3>Социальные сети</h3>
            {data.social?.map((row, i) => (
              <div className={styles.inline} key={i}>
                <label>
                  Название
                  <input
                    value={row.label}
                    onChange={(e) =>
                      set(
                        "social",
                        data.social?.map((s, n) =>
                          n === i ? { ...s, label: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Ссылка
                  <input
                    type="url"
                    value={row.url}
                    onChange={(e) =>
                      set(
                        "social",
                        data.social?.map((s, n) =>
                          n === i ? { ...s, url: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "social",
                      data.social?.filter((_, n) => n !== i),
                    )
                  }
                >
                  Убрать
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                set("social", [...(data.social || []), { label: "", url: "" }])
              }
            >
              Добавить социальную сеть
            </button>
          </>
        )}
        {kind === "navigation" && (
          <>
            <h3>Меню</h3>
            {data.links?.map((row, i) => (
              <div className={styles.inline} key={i}>
                <label>
                  Название
                  <input
                    value={row.label}
                    onChange={(e) =>
                      set(
                        "links",
                        data.links?.map((s, n) =>
                          n === i ? { ...s, label: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Страница
                  <select
                    value={row.href}
                    onChange={(e) =>
                      set(
                        "links",
                        data.links?.map((s, n) =>
                          n === i ? { ...s, href: e.target.value } : s,
                        ),
                      )
                    }
                  >
                    {pages.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...(data.links || [])];
                    [next[i], next[i - 1]] = [next[i - 1], next[i]];
                    set("links", next);
                  }}
                >
                  Выше
                </button>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "links",
                      data.links?.filter((_, n) => n !== i),
                    )
                  }
                >
                  Убрать
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                set("links", [
                  ...(data.links || []),
                  { label: "Коллекция", href: "/catalog" },
                ])
              }
            >
              Добавить пункт меню
            </button>
            {field("footerText", "Текст в подвале", "textarea")}
            {references(
              "documents",
              "document",
              "Документы в подвале (пусто — по отметке в документах)",
            )}
          </>
        )}
        {kind === "seo" && (
          <>
            {field("siteName", "Название сайта")}
            {field("description", "Описание по умолчанию", "textarea")}
            {pick("ogImage", "Изображение для социальных сетей")}
            <p className={styles.notice}>
              Hash-маршруты и загрузка контента в браузере ограничивают SEO и
              превью отдельных предметов в мессенджерах. Эта версия — noindex.
            </p>
          </>
        )}
        {!singletonKinds.includes(kind) && field("order", "Порядок", "number")}
        <div className={styles.actions}>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Выполняем…" : "Сохранить черновик"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void operation(async () => {
                const row = dirty || !entry ? await save() : entry;
                navigate(`/admin/preview/${row.id}`);
              })
            }
          >
            Предпросмотр
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm("publish")}
          >
            Опубликовать
          </button>
          {entry && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void operation(async () =>
                    setVersions(await history(entry.id)),
                  )
                }
              >
                История редакций
              </button>
              {catalog.entries.some((e) => e.id === entry.id) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm("unpublish")}
                >
                  Снять публикацию
                </button>
              )}
              {!singletonKinds.includes(kind) && (
                <button
                  type="button"
                  disabled={busy}
                  className={styles.danger}
                  onClick={() => setConfirm("delete")}
                >
                  Удалить запись
                </button>
              )}
            </>
          )}
        </div>
      </form>
      {versions && (
        <section>
          <h3>История редакций</h3>
          <p className={styles.hint}>
            Восстановление создаёт новый черновик. Чтобы заменить публичную
            страницу, опубликуйте его.
          </p>
          {versions.map((version) => (
            <article key={version.id} className={styles.version}>
              <strong>
                Редакция {version.revision} ·{" "}
                {
                  {
                    draft: "Черновик",
                    publish: "Публикация",
                    restore: "Восстановление",
                  }[version.action]
                }
              </strong>
              <p>
                {new Date(version.created_at).toLocaleString("ru-RU")} ·{" "}
                {version.data.title}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void operation(async () => {
                    if (!entry) return;
                    const restored = await restore(version, entry);
                    setEntry(restored);
                    setData(restored.draft);
                    setSlug(restored.slug);
                    setDirty(false);
                    await admin.reload();
                    setVersions(await history(entry.id));
                    setMessage(
                      "Редакция восстановлена в новый черновик. Публичная страница не изменилась.",
                    );
                  })
                }
              >
                Восстановить в черновик
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
