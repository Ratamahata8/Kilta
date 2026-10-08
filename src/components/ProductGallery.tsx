import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useCatalog } from "../lib/store";
import styles from "./Gallery.module.css";

function preload(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    const done = (error?: Error) => { clearTimeout(timer); image.onload = null; image.onerror = null; if (error) reject(error); else resolve(); };
    const timer = window.setTimeout(() => done(Error("Фото загружается слишком долго. Повторите попытку.")), 15000);
    image.onload = () => done();
    image.onerror = () => done(Error("Не удалось загрузить фото. Повторите попытку."));
    image.src = url;
    if (image.complete && image.naturalWidth > 0) done();
  });
}
export function ProductGallery({ ids, title }: { ids: string[]; title: string }) {
  const { media } = useCatalog();
  const photos = ids.map(id => media.find(m => m.id === id)).filter(m => !!m?.url);
  const [index, setIndex] = useState(0), [previous, setPrevious] = useState<number | null>(null),
    [loading, setLoading] = useState(false), [error, setError] = useState(""), [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement>(null), request = useRef(0),
    gesture = useRef<{ x: number; y: number } | null>(null), suppressClick = useRef(false);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    const element = dialog.current;
    const trigger = opener.current;
    if (!element) return;
    if (open) element.showModal();
    else if (element.open) { element.close(); opener.current?.focus(); }
    return () => { if (element.open) { element.close(); trigger?.focus(); } };
  }, [open]);
  const currentIndex = Math.min(index, Math.max(photos.length - 1, 0));
  const active = photos[currentIndex];
  if (!active) return <p>Фотографии готовятся к публикации.</p>;
  const go = async (target: number) => {
    const next = (target + photos.length) % photos.length;
    if (next === currentIndex) return;
    const ticket = ++request.current;
    setError(""); setLoading(true);
    try {
      await preload(photos[next]!.heroUrl || photos[next]!.url!);
      if (ticket !== request.current) return;
      setPrevious(matchMedia("(prefers-reduced-motion: reduce)").matches ? null : currentIndex);
      setIndex(next);
    } catch (e) { if (ticket === request.current) setError(e instanceof Error ? e.message : "Ошибка загрузки фото"); }
    finally { if (ticket === request.current) setLoading(false); }
  };
  const keys = (event: KeyboardEvent) => {
    if (event.key === "Tab" && open && dialog.current) {
      const buttons = Array.from(dialog.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')).filter(button => button.getClientRects().length > 0);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); void go(currentIndex + (event.key === "ArrowRight" ? 1 : -1)); }
    if (event.key === "Home") { event.preventDefault(); void go(0); }
    if (event.key === "End") { event.preventDefault(); void go(photos.length - 1); }
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    gesture.current = { x: event.clientX, y: event.clientY };
    suppressClick.current = false;
    (event.target as Element).setPointerCapture(event.pointerId);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current; gesture.current = null;
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      suppressClick.current = true;
      void go(currentIndex + (dx < 0 ? 1 : -1));
    }
  };
  const controls = () => <div className={styles.controls}>
    <button type="button" disabled={photos.length < 2} onClick={() => void go(currentIndex - 1)}>Предыдущее фото</button>
    <span aria-live="polite" aria-atomic="true">{currentIndex + 1} / {photos.length}</span>
    <button type="button" disabled={photos.length < 2} onClick={() => void go(currentIndex + 1)}>Следующее фото</button>
  </div>;
  const frame = (large = false) => <div className={`${styles.stage} ${large ? styles.largeStage : ""}`}
    onPointerDown={down} onPointerUp={up} onPointerCancel={() => { gesture.current = null; }}>
    {previous !== null && photos[previous] && <img className={styles.outgoing} src={photos[previous]!.heroUrl || photos[previous]!.url} alt="" aria-hidden="true" onAnimationEnd={() => setPrevious(null)} />}
    <img key={active.id} className={previous === null ? styles.photo : `${styles.photo} ${styles.incoming}`}
      src={active.heroUrl || active.url} alt={active.alt} width={active.heroWidth || active.width || 1920} height={active.heroHeight || active.height || 1280} loading="eager" decoding="async" />
    {!large && <button ref={opener} className={styles.openButton} type="button" aria-label={`Открыть фото ${currentIndex + 1} на весь экран`} onClick={() => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      setOpen(true);
    }}><span>На весь экран</span></button>}
  </div>;
  return <div className={styles.gallery} role="region" aria-label={`Галерея: ${title}`} onKeyDown={keys}>
    {frame()}
    {active.caption && <p className={styles.caption}>{active.caption}</p>}
    {controls()}
    {loading && <p role="status">Загружаем фото…</p>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.thumbnails} aria-label="Выбор фотографии">
      {photos.map((photo, i) => <button key={photo!.id} type="button" aria-label={`Фото ${i + 1}`} aria-pressed={i === currentIndex} onClick={() => void go(i)}>
        <img src={photo!.url} alt="" width={photo!.cardWidth || photo!.width || 720} height={photo!.cardHeight || photo!.height || 900} loading="lazy" decoding="async" />
      </button>)}
    </div>
    <dialog ref={dialog} className={styles.lightbox} aria-label={`Фото: ${title}`} onCancel={event => { event.preventDefault(); setOpen(false); }}
      onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className={styles.lightboxContent}>
        <button type="button" className={styles.close} autoFocus onClick={() => setOpen(false)}>Закрыть фото</button>
        {open && frame(true)}
        {controls()}
      </div>
    </dialog>
  </div>;
}
