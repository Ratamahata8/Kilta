import { useState } from "react";
import { contentBundle } from "../content/source";
import { mediaIDs } from "../lib/validation";
import { importDrafts, previewImport, type ImportRow, type ImportResult } from "../content/import";
import { listImportEntries, listMedia, saveEntry } from "../lib/api";
import { uploadFile } from "../lib/uploads";
import { useAdmin } from "./context";
import { CatalogOverride } from "../lib/store";
import { demoEntries, demoMedia } from "../lib/demo";
import { ProductPage } from "../pages/PublicPages";
import { kindLabels } from "../lib/types";
import styles from "./Admin.module.css";

export function ImportContent() {
  const admin = useAdmin();
  const [plan, setPlan] = useState<ImportRow[] | null>(null), [files, setFiles] = useState(new Map<string, File>()),
    [busy, setBusy] = useState(false), [error, setError] = useState(""), [progress, setProgress] = useState(""),
    [result, setResult] = useState<ImportResult | null>(null), [preview, setPreview] = useState<ImportRow | null>(null);
  const needed = [...new Set(plan?.filter(r => r.action === "create").flatMap(r => mediaIDs(r.source.data)) || [])]
    .filter(id => !admin.media.some(m => m.id === id));
  const missingOriginals = needed.filter(id => !files.has(contentBundle.media.find(m => m.id === id)?.archiveFile || ""));
  const inspect = async () => {
    setBusy(true); setError(""); setResult(null);
    try { setPlan(previewImport(await listImportEntries())); }
    catch(e) { setError(e instanceof Error ? e.message : "Не удалось подготовить план"); }
    finally { setBusy(false); }
  };
  const run = async () => {
    if (!plan) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const imported = await importDrafts(plan, files, {
        entries: listImportEntries, media: listMedia,
        upload: (asset, file) => uploadFile(new File([file], file.name, {type: asset.originalMime}), "image", asset.alt,
          {id: asset.id, source: `KILTA; sha256=${asset.sha256}; ${asset.sourceURL}`}),
        create: (kind, slug, data) => saveEntry(null, kind, slug, data),
      }, title => setProgress(`Создаём черновик: ${title}`));
      setResult(imported);
      await admin.reload();
      setPlan(previewImport(await listImportEntries()));
    } catch(e) {
      setError(`${e instanceof Error ? e.message : "Ошибка импорта"}. Процесс остановлен; часть черновиков могла быть создана. Обновите план перед повтором.`);
      await admin.reload().catch(() => {});
    } finally { setBusy(false); setProgress(""); }
  };
  return <section className={styles.form}>
    <h2>Импорт материалов KILTA</h2>
    <p>Архив от 8 октября 2026: 14 изделий и 8 категорий. Импорт создаёт только новые черновики и приватные изображения. Существующие, переименованные и архивные записи сохраняются. Повторный запуск не перезаписывает данные и не публикует сайт.</p>
    <p className={styles.notice}>Проверьте размеры My space (В1900 мм) и LoveKA (единица «м»), цены, наличие, выставки и адреса. Политика — архивный текст для сверки; не подтверждённый юридический документ. В архиве отсутствуют одно фото «Сущности» и прежнее изображение главной.</p>
    <button className={styles.primary} disabled={busy} onClick={() => void inspect()}>Предпросмотр изменений</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {progress && <p role="status">{progress}</p>}
    {result && <div role="status" className={styles.notice}>
      Создано черновиков: {result.created}. Сохранено существующих/пропущено: {result.kept}. Ошибок: {result.issues.length}.
      {result.issues.length > 0 && <ul>{result.issues.map(i => <li key={i.title}>{i.title}: {i.message}</li>)}</ul>}
    </div>}
    {plan && <>
      <table className={styles.table}><thead><tr><th>Запись</th><th>Действие</th><th>Содержимое</th></tr></thead><tbody>
        {plan.map(row => <tr key={row.source.id}>
          <td>{kindLabels[row.source.kind]}: {row.source.data.title}</td>
          <td>{row.reason}{row.differences.length > 0 && <small>Различаются: {row.differences.join(", ")}. Эти поля не будут перезаписаны.</small>}</td>
          <td>{row.source.kind === "product" ? <button disabled={busy} onClick={() => setPreview(row)}>Посмотреть предмет</button> : <details><summary>Поля</summary><p>{row.source.data.address || row.source.data.heading || row.source.data.title}</p></details>}</td>
        </tr>)}
      </tbody></table>
      <label className={styles.field}>Папка kilta-content с оригиналами
        <input type="file" multiple ref={input => { input?.setAttribute("webkitdirectory", ""); }} disabled={busy} onChange={event => {
          const map = new Map<string, File>();
          for (const file of Array.from(event.target.files || [])) {
            const relative = file.webkitRelativePath || file.name;
            const position = relative.indexOf("images/");
            if (position >= 0) map.set(relative.slice(position), file);
          }
          setFiles(map);
        }} />
        <small>Файлы остаются на вашем компьютере до запуска импорта. Исходники проверяются по SHA-256, сохраняются в приватном Storage; WebP создаются обработчиком загрузки. Для демо импорт не требуется.</small>
      </label>
      {missingOriginals.length > 0 && <p>Нужны исходные файлы: {missingOriginals.length}. Выберите папку архива перед импортом.</p>}
      <button className={styles.primary} disabled={busy || missingOriginals.length > 0 || !plan.some(r => r.action === "create")} onClick={() => void run()}>Создать только новые черновики</button>
    </>}
    {preview && <div className={styles.panel}>
      <button onClick={() => setPreview(null)}>Закрыть предпросмотр импорта</button>
      <p className={styles.notice}>{preview.reason}</p>
      {preview.existing && <p>Текущее название в админке: {preview.existing.draft.title}. Ниже показан исходный материал для сравнения.</p>}
      <CatalogOverride entries={demoEntries} media={demoMedia}><ProductPage entry={preview.source} /></CatalogOverride>
    </div>}
  </section>;
}
