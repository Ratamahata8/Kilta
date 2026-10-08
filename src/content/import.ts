import { singletonKinds, type ContentData, type Entry, type Kind, type Media, type Snapshot } from "../lib/types";
import { mediaIDs } from "../lib/validation";
import { contentBundle, type ContentBundle, type SourceAsset } from "./source";

export type ImportRow = { source: Snapshot; existing?: Entry; action: "create" | "keep" | "blocked"; reason: string; differences: string[] };
function match(source: Snapshot, entries: Entry[]) {
  return entries.find(e => e.kind === source.kind &&
    (e.slug === source.slug || singletonKinds.includes(source.kind) ||
      (source.data.sourceInfo?.referenceKey && e.draft.sourceInfo?.referenceKey === source.data.sourceInfo.referenceKey)));
}
export function previewImport(entries: Entry[], bundle: ContentBundle = contentBundle): ImportRow[] {
  return bundle.entries.map(source => {
    const existing = match(source, entries);
    const blocked = source.data.categories?.some(id => {
      const category = bundle.entries.find(s => s.id === id);
      return category && match(category, entries)?.deleted;
    });
    return { source, existing, action: existing ? "keep" : blocked ? "blocked" : "create",
      differences: existing ? Object.entries({title: "Название", description: "Описание", image: "Основное фото", gallery: "Галерея", price: "Цена", dimensionsText: "Размеры", body: "Текст", address: "Адрес"}).filter(([key]) => JSON.stringify(existing.draft[key as keyof ContentData]) !== JSON.stringify(source.data[key as keyof ContentData])).map(([, label]) => label) : [],
      reason: existing ? (existing.deleted ? "Архивная запись сохранена; не восстанавливаем." : "Запись уже есть; сохраняем правки клиента.")
        : blocked ? "Связанная категория в архиве; сначала проверьте её вручную." : "Создать новый черновик. Публикация отдельно." };
  });
}
export type ImportAdapter = {
  entries: () => Promise<Entry[]>;
  media: () => Promise<Media[]>;
  upload: (asset: SourceAsset, file: File) => Promise<Media>;
  create: (kind: Kind, slug: string, data: ContentData) => Promise<Entry>;
};
export type ImportResult = { created: number; kept: number; issues: { title: string; message: string }[] };
export async function importDrafts(
  reviewed: ImportRow[], files: Map<string, File>, adapter: ImportAdapter,
  onProgress: (text: string) => void = () => {}, bundle: ContentBundle = contentBundle,
): Promise<ImportResult> {
  // Only entries shown as NEW in the reviewed plan may ever be written.
  const requested = new Set(reviewed.filter(r => r.action === "create").map(r => r.source.id));
  const result: ImportResult = { created: 0, kept: 0, issues: [] };
  const ids = new Map<string, string>();
  const existingMedia = await adapter.media();
  const media = new Map(existingMedia.map(m => [m.id, m]));
  const ordered = [...bundle.entries].sort((a, b) => {
    const rank = (s: Snapshot) => s.kind === "category" ? 0 : s.kind === "product" || s.kind === "document" ? 1 : 2;
    return rank(a) - rank(b);
  });
  for (const source of ordered) {
    onProgress(source.data.title);
    // Re-read before each creation; a client edit/rename/archive always wins.
    const entries = await adapter.entries();
    for (const row of bundle.entries) {
      const current = match(row, entries);
      if (current && !current.deleted) ids.set(row.id, current.id);
    }
    if (match(source, entries) || !requested.has(source.id)) { result.kept++; continue; }
    try {
      for (const id of mediaIDs(source.data)) {
        if (media.has(id)) {
          if (media.get(id)?.kind !== "image") throw Error("Существующее медиа несовместимо с изображением импорта.");
          continue;
        }
        const asset = bundle.media.find(a => a.id === id);
        if (!asset) throw Error("Не найдено изображение в подготовленном архиве.");
        const file = files.get(asset.archiveFile);
        if (!file) throw Error("Не выбран исходный файл. Выберите папку kilta-content с оригиналами.");
        const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(v => v.toString(16).padStart(2, "0")).join("");
        if (digest !== asset.sha256) throw Error("Контрольная сумма оригинала отличается от проверенного архива.");
        const uploaded = await adapter.upload(asset, file);
        if (uploaded.id !== id) throw Error("Сервис вернул другой идентификатор медиа.");
        media.set(id, uploaded);
      }
      const reference = (id: string) => {
        const mapped = ids.get(id);
        if (!mapped) throw Error("Связанная запись ещё не создана или находится в архиве.");
        return mapped;
      };
      const data = structuredClone(source.data);
      for (const field of ["categories", "items", "documents"] as const)
        if (data[field]) data[field] = data[field]!.map(reference);
      // No upsert, no update, no publish. save_content rejects a racing duplicate.
      const created = await adapter.create(source.kind, source.slug, data);
      ids.set(source.id, created.id);
      result.created++;
    } catch (error) {
      result.issues.push({ title: source.data.title, message: error instanceof Error ? error.message : "Ошибка импорта" });
    }
  }
  return result;
}
