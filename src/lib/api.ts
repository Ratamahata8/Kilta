import { backend, check, publicURL } from "./supabase";
import type {
  Entry,
  Kind,
  ContentData,
  Version,
  Snapshot,
  Media,
  PublicMedia,
  Role,
} from "./types";
import { mediaIDs, validateContent } from "./validation";
async function allRows(
  table: string,
  filter?: { field: string; value: string | boolean },
  order = "id",
) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = backend()
      .from(table)
      .select("*")
      .order(order, { ascending: order === "id" })
      .range(offset, offset + 499)
      .abortSignal(AbortSignal.timeout(20000));
    if (filter) query = query.eq(filter.field, filter.value);
    const batch = check(await query);
    if (!Array.isArray(batch))
      throw new Error("Сервис вернул неверный формат данных.");
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export async function loadPublished() {
  const [content, media] = await Promise.all([
    allRows("published_content"),
    allRows("published_media"),
  ]);
  return {
    entries: content as Snapshot[],
    media: (media as PublicMedia[]).map((m) => ({
      ...m,
      url: publicURL(
        m.card_path || m.pdf_path || "",
        m.kind === "pdf" ? "kilta-public-documents" : "kilta-public",
      ),
      heroUrl: m.hero_path ? publicURL(m.hero_path) : undefined,
      cardWidth: m.width ? Math.min(m.width, 720) : undefined,
      cardHeight: m.width && m.height ? Math.round(m.height * Math.min(1, 720 / m.width)) : undefined,
      heroWidth: m.width ? Math.min(m.width, 1920) : undefined,
      heroHeight: m.width && m.height ? Math.round(m.height * Math.min(1, 1920 / m.width)) : undefined,
    })),
  };
}
export async function listDrafts() {
  return (await allRows(
    "content",
    { field: "deleted", value: false },
    "updated_at",
  )) as Entry[];
}
// Import must also see archived rows, so repeated runs never resurrect them.
export async function listImportEntries() {
  return await allRows("content") as Entry[];
}
export async function listMedia() {
  return (await allRows("media", undefined, "created_at")) as Media[];
}
export async function getRole(id: string) {
  return check(
    await backend()
      .from("user_roles")
      .select("*")
      .eq("user_id", id)
      .maybeSingle(),
  ) as Role | null;
}
export async function saveEntry(
  entry: Entry | null,
  kind: Kind,
  slug: string,
  data: ContentData,
) {
  validateContent(kind, slug, data);
  return check(
    await backend().rpc("save_content", {
      p_id: entry?.id || null,
      p_kind: kind,
      p_slug: slug,
      p_data: data,
      p_expected_revision: entry?.revision || 0,
    }),
  ) as Entry;
}
export async function preparePublicCopies(data: ContentData, media: Media[]) {
  for (const id of mediaIDs(data)) {
    const item = media.find((m) => m.id === id);
    if (!item)
      throw new Error("Изображение или PDF не найдено. Обновите медиатеку.");
    const bucket = item.kind === "pdf" ? "kilta-documents" : "kilta-originals";
    const paths =
      item.kind === "pdf"
        ? [item.original_path]
        : [item.card_path!, item.hero_path!];
    for (const path of paths) {
      const blob = check(await backend().storage.from(bucket).download(path));
      const result = await backend()
        .storage.from(
          item.kind === "pdf" ? "kilta-public-documents" : "kilta-public",
        )
        .upload(path, blob, {
          contentType: item.kind === "pdf" ? "application/pdf" : "image/webp",
          upsert: false,
        });
      // Immutable copies can already exist after a previous publication/retry.
      if (
        result.error &&
        !["409", "Duplicate"].includes(String(result.error.statusCode)) &&
        !/already exists|duplicate/i.test(result.error.message)
      )
        throw new Error(result.error.message);
    }
  }
}
export async function publishEntry(entry: Entry, media: Media[]) {
  await preparePublicCopies(entry.draft, media);
  return check(
    await backend().rpc("publish_content", {
      p_id: entry.id,
      p_expected_revision: entry.revision,
    }),
  ) as Snapshot;
}
export async function unpublish(entry: Entry) {
  check(
    await backend().rpc("unpublish_content", {
      p_id: entry.id,
      p_expected_revision: entry.revision,
    }),
  );
}
export async function removeEntry(entry: Entry) {
  check(
    await backend().rpc("delete_content", {
      p_id: entry.id,
      p_expected_revision: entry.revision,
    }),
  );
}
export async function history(id: string) {
  return (await allRows(
    "versions",
    { field: "content_id", value: id },
    "revision",
  )) as Version[];
}
export async function restore(version: Version, entry: Entry) {
  return check(
    await backend().rpc("restore_version", {
      p_version_id: version.id,
      p_expected_revision: entry.revision,
    }),
  ) as Entry;
}
export async function privateURL(item: Media, hero = false) {
  return check(
    await backend()
      .storage.from(item.kind === "pdf" ? "kilta-documents" : "kilta-originals")
      .createSignedUrl(
        hero
          ? item.hero_path || item.original_path
          : item.card_path || item.original_path,
        300,
      ),
  ).signedUrl;
}
export async function usage(id: string) {
  return check(await backend().rpc("media_usage", { p_id: id })) as {
    title: string;
    location: string;
  }[];
}
export async function deleteMedia(item: Media) {
  const references = await usage(item.id);
  if (references.length)
    throw new Error(
      `Файл используется: ${references.map((r) => `${r.title} (${r.location})`).join(", ")}.`,
    );
  // Remove metadata atomically FIRST: racing saves can no longer reference the deleted ID.
  check(await backend().rpc("delete_media", { p_id: item.id }));
  // Storage delete policies also block direct deletion while any draft/version references remain.
  try {
    check(
      await backend()
        .storage.from(
          item.kind === "pdf" ? "kilta-documents" : "kilta-originals",
        )
        .remove([
          item.original_path,
          ...[item.card_path, item.hero_path].filter((p): p is string =>
            Boolean(p),
          ),
        ]),
    );
    check(
      await backend()
        .storage.from(
          item.kind === "pdf" ? "kilta-public-documents" : "kilta-public",
        )
        .remove([
          item.original_path,
          ...[item.card_path, item.hero_path].filter((p): p is string =>
            Boolean(p),
          ),
        ]),
    );
  } catch (error) {
    throw new Error(
      `Файл удалён из медиатеки, но очистка Storage не завершена. Обновите список и обратитесь к разработчику. ${error instanceof Error ? error.message : "Ошибка очистки"}`,
    );
  }
}
