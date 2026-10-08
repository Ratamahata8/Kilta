import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import catalog from "../../kilta-content/catalog.json";
import assets from "../../kilta-content/assets.json";
import { contentBundle, type ContentBundle } from "../../src/content/source";
import { previewImport, importDrafts, type ImportAdapter } from "../../src/content/import";
import type { Entry, Snapshot } from "../../src/lib/types";

describe("supplied KILTA content", () => {
  it("keeps all 14 products and 8 original categories with exact descriptions and prices", () => {
    const products = contentBundle.entries.filter(e => e.kind === "product");
    expect(products).toHaveLength(14);
    expect(contentBundle.entries.filter(e => e.kind === "category").map(e => e.slug)).toEqual(catalog.categories.map(c => c.slug));
    for (const source of catalog.products) {
      const actual = products.find(p => p.slug === source.slug)!;
      expect(actual.data.title).toBe(source.title);
      const text = typeof actual.data.description === "object" ? actual.data.description.content?.map(p => p.content?.[0].text).join("\n\n") : actual.data.description;
      expect(text).toBe(source.description);
      expect(actual.data.price).toBe(source.price_rub);
      expect(actual.data.priceMode).toBe(({from: "from", fixed: "exact", on_request: "request"} as Record<string, string>)[source.pricing_mode]);
      expect(actual.data.dimensionsText).toBe(source.dimensions_text);
      expect(actual.data.yearText).toBe(source.year_text || "");
      expect(actual.data.exhibitionsText).toBe(source.exhibitions_text || "");
      expect(actual.data.availabilityConfirmed).toBe(false);
    }
  });
  it("preserves product-specific gallery order by checksum, with an explicit missing-file audit", () => {
    const media = new Map(contentBundle.media.map(m => [m.id, m]));
    const manifest = new Map(assets.map(a => [a.file, a.sha256]));
    expect(contentBundle.audit.verifiedCount).toBe(100);
    expect(contentBundle.audit.missingFiles).toEqual(["images/e05f71023ae4-Airbrush-image-exten.jpeg", "images/e23df7f47ff4-DSC_7737.jpg"]);
    for (const source of catalog.products) {
      const data = contentBundle.entries.find(e => e.kind === "product" && e.slug === source.slug)!.data;
      expect(media.get(data.image!)!.sha256).toBe(manifest.get(source.cover));
      expect(data.gallery!.map(id => media.get(id)!.sha256)).toEqual(source.gallery.filter(f => !contentBundle.audit.missingFiles.includes(f)).map(f => manifest.get(f)));
    }
  });
  it("ships only existing WebP derivatives with reserved dimensions", async () => {
    for (const image of contentBundle.media) for (const size of [image.card, image.hero]) {
      expect(size.width).toBeGreaterThan(0); expect(size.height).toBeGreaterThan(0);
      expect(Math.abs(size.width / size.height - image.width / image.height)).toBeLessThan(.006);
      expect((await stat(`public/${size.path}`)).size).toBeGreaterThan(0);
      const bytes = await readFile(`public/${size.path}`);
      expect(bytes.subarray(0, 4).toString()).toBe("RIFF"); expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
    }
  });
  it("keeps questionable source dimensions and flags the archived policy", () => {
    expect(contentBundle.entries.find(e => e.slug === "myspace")!.data.dimensionsText).toContain("В1900");
    expect(contentBundle.entries.find(e => e.slug === "loveka")!.data.dimensionsText).toContain("400 м");
    expect(contentBundle.entries.find(e => e.kind === "document")!.data.requiresReview).toBe(true);
    expect(contentBundle.entries.filter(e => e.kind === "showroom")).toHaveLength(2);
    expect(contentBundle.entries.find(e => e.kind === "contacts")!.data.contactPeople).toHaveLength(2);
  });
});

const category: Snapshot = {id: "source-cat", kind: "category", slug: "source-cat", data: {title: "Категория"}, version_id: "v", published_at: "2026-10-08"};
const product: Snapshot = {id: "source-product", kind: "product", slug: "source-product", data: {title: "Изделие", categories: [category.id], sourceInfo: {url: "https://kilta.ru/", extractedAt: "2026-10-08", referenceKey: "product/source-product"}}, version_id: "v2", published_at: "2026-10-08"};
const bundle: ContentBundle = {extractedAt: "2026-10-08", entries: [product, category], media: [], audit: {manifestCount: 0, verifiedCount: 0, missingFiles: [], notes: []}};
function adapter(records: Entry[]): ImportAdapter {
  return {entries: async () => structuredClone(records), media: async () => [], upload: async () => {throw Error("Unexpected upload");}, create: async (kind, slug, data) => {
    const entry: Entry = {id: `db-${records.length}`, kind, slug, draft: structuredClone(data), revision: 1, deleted: false, updated_at: "now"}; records.push(entry); return entry;
  }};
}
describe("reviewed draft import", () => {
  it("creates dependency-ordered drafts, remaps IDs and preserves client changes on every rerun", async () => {
    const records: Entry[] = [];
    const api = adapter(records);
    const first = await importDrafts(previewImport(records, bundle), new Map(), api, undefined, bundle);
    expect(first).toEqual({created: 2, kept: 0, issues: []});
    expect(records[1].draft.categories).toEqual([records[0].id]);
    records[1].draft.title = "Правка клиента"; records[1].slug = "renamed";
    const second = await importDrafts(previewImport(records, bundle), new Map(), api, undefined, bundle);
    expect(second.created).toBe(0); expect(records).toHaveLength(2);
    expect(records[1].draft.title).toBe("Правка клиента"); expect(records[1].slug).toBe("renamed");
    records[0].deleted = true;
    expect(previewImport(records, bundle).find(r => r.source.id === category.id)?.action).toBe("keep");
  });
  it("rechecks the backend after preview and never replaces a concurrently created client record", async () => {
    const records: Entry[] = [];
    const plan = previewImport(records, bundle);
    records.push({id: "client", kind: "product", slug: product.slug, draft: {title: "Клиент создал сам"}, revision: 2, deleted: false, updated_at: "now"});
    const result = await importDrafts(plan, new Map(), adapter(records), undefined, bundle);
    expect(result.created).toBe(1); expect(records[0].draft.title).toBe("Клиент создал сам");
  });
  it("rejects mismatching originals before upload and reports partial results honestly", async () => {
    const image = contentBundle.media[0];
    const withImage: ContentBundle = {...bundle, entries: [{...category, data: {title: "Фото", image: image.id}}], media: [image]};
    const records: Entry[] = [];
    const result = await importDrafts(previewImport([], withImage), new Map([[image.archiveFile, new File(["wrong bytes"], "image.jpg")]]), adapter(records), undefined, withImage);
    expect(result.created).toBe(0); expect(result.issues[0].message).toContain("Контрольная сумма"); expect(records).toHaveLength(0);
  });
});
