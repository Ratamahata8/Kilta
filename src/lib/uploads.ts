import { backend, check } from "./supabase";
import type { Media } from "./types";
export function detectMime(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  const text = new TextDecoder().decode(bytes.slice(0, 64));
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP")
    return "image/webp";
  if (text.slice(4, 8) === "ftyp" && /avif|avis/.test(text))
    return "image/avif";
  if (text.startsWith("%PDF-")) return "application/pdf";
  return null;
}
export async function verifyFile(file: File, kind: "image" | "pdf") {
  if (file.size === 0 || file.size > (kind === "image" ? 20 : 10) * 1024 * 1024)
    throw new Error(
      `Файл должен быть не больше ${kind === "image" ? 20 : 10} МБ и не пустым.`,
    );
  const mime = detectMime(
    new Uint8Array(await file.slice(0, 64).arrayBuffer()),
  );
  if (
    mime !== file.type ||
    (kind === "pdf" ? mime !== "application/pdf" : !mime?.startsWith("image/"))
  )
    throw new Error(
      "Формат и содержимое файла не совпадают. Разрешены JPEG, PNG, WebP, AVIF; PDF загружается отдельно.",
    );
  return mime!;
}
async function derivative(bitmap: ImageBitmap, width: number): Promise<Blob> {
  const scale = Math.min(1, width / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не поддерживает обработку изображений.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob?.type === "image/webp"
          ? resolve(blob)
          : reject(
              new Error(
                "Браузер не может создать WebP. Используйте современный Chrome, Firefox или Safari.",
              ),
            ),
      "image/webp",
      0.86,
    ),
  );
}
export async function uploadFile(
  file: File,
  kind: "image" | "pdf",
  alt: string,
  imported?: { id: string; source: string },
): Promise<Media> {
  const mime = await verifyFile(file, kind);
  const id = imported?.id || crypto.randomUUID(),
    ext =
      kind === "pdf"
        ? "pdf"
        : (
            {
              "image/jpeg": "jpg",
              "image/png": "png",
              "image/webp": "webp",
              "image/avif": "avif",
            } as Record<string, string>
          )[mime];
  let card: Blob | undefined,
    hero: Blob | undefined,
    width: number | undefined,
    height: number | undefined;
  if (kind === "image") {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(
        "Не удалось декодировать изображение. Оно повреждено или формат не поддерживается этим браузером.",
      );
    }
    try {
      width = bitmap.width;
      height = bitmap.height;
      if (width * height > 60000000)
        throw new Error(
          "Изображение слишком большое: максимум 60 мегапикселей.",
        );
      [card, hero] = await Promise.all([
        derivative(bitmap, 720),
        derivative(bitmap, 1920),
      ]);
    } finally {
      bitmap.close();
    }
  }
  const metadata = {
    id,
    kind,
    alt: alt.trim() || file.name.replace(/\.[^.]+$/, ""),
    caption: "",
    source: imported?.source || "",
    focal_x: 50,
    focal_y: 50,
    original_path: `${id}/original.${ext}`,
    card_path: card ? `${id}/card.webp` : null,
    hero_path: hero ? `${id}/hero.webp` : null,
    mime_type: mime,
    bytes: file.size,
    width,
    height,
  };
  const row = check(
    await backend().from("media").insert(metadata).select().single(),
  ) as Media;
  const bucket = kind === "pdf" ? "kilta-documents" : "kilta-originals";
  const paths = [
    row.original_path,
    ...(card ? [row.card_path!, row.hero_path!] : []),
  ];
  try {
    check(
      await backend()
        .storage.from(bucket)
        .upload(row.original_path, file, { contentType: mime, upsert: false }),
    );
    if (card && hero)
      for (const [path, blob] of [
        [row.card_path!, card],
        [row.hero_path!, hero],
      ] as const)
        check(
          await backend()
            .storage.from(bucket)
            .upload(path, blob, { contentType: "image/webp", upsert: false }),
        );
    return row;
  } catch (error) {
    // Best-effort cleanup of this new, unreferenced upload. Never report false success.
    await backend().storage.from(bucket).remove(paths);
    await backend().rpc("delete_media", { p_id: id });
    throw error;
  }
}
