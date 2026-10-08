// Requires a dedicated TEST project: creates artificial records and retained history.
// No service_role. Does not create users or modify project/visibility settings.
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
if (existsSync(".env.local")) loadEnvFile(".env.local");
const names = [
  "TEST_SUPABASE_URL",
  "TEST_SUPABASE_PUBLISHABLE_KEY",
  "TEST_OWNER_EMAIL",
  "TEST_OWNER_PASSWORD",
  "TEST_OUTSIDER_EMAIL",
  "TEST_OUTSIDER_PASSWORD",
];
const missing = names.filter((name) => !process.env[name]);
if (missing.length || process.env.TEST_ALLOW_WRITES !== "true") {
  console.error(
    `NOT RUN: missing ${missing.join(", ") || "TEST_ALLOW_WRITES=true"}; configure a dedicated Supabase TEST project securely. No credentials in chat.`,
  );
  process.exit(2);
}
const url = process.env.TEST_SUPABASE_URL,
  key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
if (key.startsWith("sb_secret_"))
  throw new Error("Use the public publishable/anon key, not a secret key.");
const client = () =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
const anonymous = client(),
  owner = client(),
  outsider = client();
const ok = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const prefix = `qa-${randomUUID()}`;
const save = (entry, kind, slug, data) =>
  owner
    .rpc("save_content", {
      p_id: entry?.id || null,
      p_kind: kind,
      p_slug: slug,
      p_data: data,
      p_expected_revision: entry?.revision || 0,
    })
    .then(ok);
const publish = (entry) =>
  owner
    .rpc("publish_content", {
      p_id: entry.id,
      p_expected_revision: entry.revision,
    })
    .then(ok);
const fresh = (id) =>
  owner.from("content").select("*").eq("id", id).single().then(ok);
let passed = 0;
const scenario = async (name, work) => {
  await work();
  passed++;
  console.log(`PASS: ${name}`);
};
try {
  const login = ok(
    await owner.auth.signInWithPassword({
      email: process.env.TEST_OWNER_EMAIL,
      password: process.env.TEST_OWNER_PASSWORD,
    }),
  );
  ok(
    await outsider.auth.signInWithPassword({
      email: process.env.TEST_OUTSIDER_EMAIL,
      password: process.env.TEST_OUTSIDER_PASSWORD,
    }),
  );
  const role = ok(
    await owner
      .from("user_roles")
      .select("*")
      .eq("user_id", login.user.id)
      .single(),
  );
  assert.equal(role.role, "owner");
  assert.equal(
    ok(await outsider.from("user_roles").select("*")).length,
    0,
    "Outsider must have NO owner/developer role",
  );
  await scenario(
    "live API role boundaries, anonymous drafts/history/users/inquiries denial",
    async () => {
      for (const table of ["content", "versions", "user_roles", "inquiries"]) {
        const result = await anonymous.from(table).select("*");
        assert.ok(
          result.error || result.data.length === 0,
          `${table} must be private`,
        );
      }
      assert.ok(
        (
          await outsider.rpc("save_content", {
            p_id: null,
            p_kind: "category",
            p_slug: `${prefix}-denied`,
            p_data: { title: "Artificial test" },
            p_expected_revision: 0,
          })
        ).error,
      );
      assert.ok(
        (
          await owner.rpc("set_user_role", {
            p_user_id: login.user.id,
            p_role: "developer",
          })
        ).error,
      );
      assert.ok(
        (
          await owner
            .from("user_roles")
            .update({ role: "developer" })
            .eq("user_id", login.user.id)
        ).error,
      );
    },
  );
  let media, product, doc;
  await scenario(
    "live Storage private upload, direct anonymous URL denial, no editor role denial",
    async () => {
      const id = randomUUID(),
        bytes = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
          "base64",
        );
      media = ok(
        await owner
          .from("media")
          .insert({
            id,
            kind: "image",
            alt: "Artificial QA pixel",
            original_path: `${id}/original.png`,
            card_path: `${id}/card.webp`,
            hero_path: `${id}/hero.webp`,
            mime_type: "image/png",
            bytes: bytes.length,
            width: 1,
            height: 1,
          })
          .select()
          .single(),
      );
      ok(
        await owner.storage
          .from("kilta-originals")
          .upload(media.original_path, bytes, { contentType: "image/png" }),
      );
      const returned = ok(
        await owner.storage
          .from("kilta-originals")
          .download(media.original_path),
      );
      assert.deepEqual(Buffer.from(await returned.arrayBuffer()), bytes);
      assert.ok(
        (
          await anonymous.storage
            .from("kilta-originals")
            .download(media.original_path)
        ).error,
      );
      assert.ok(
        (
          await outsider.storage
            .from("kilta-originals")
            .download(media.original_path)
        ).error,
      );
      const direct = owner.storage
        .from("kilta-originals")
        .getPublicUrl(media.original_path).data.publicUrl;
      assert.ok((await fetch(direct)).status >= 400);
      product = await save(null, "product", `${prefix}-private`, {
        title: "Artificial QA private image",
        priceMode: "request",
        availability: "order",
        image: id,
      });
      assert.ok((await owner.rpc("delete_media", { p_id: id })).error);
    },
  );
  await scenario(
    "live publication and independent anonymous client; draft isolation and conflict handling",
    async () => {
      product = await save(null, "product", `${prefix}-product`, {
        title: "Artificial QA published",
        priceMode: "request",
        availability: "order",
      });
      assert.equal(
        ok(
          await anonymous
            .from("published_content")
            .select("*")
            .eq("id", product.id),
        ).length,
        0,
      );
      await publish(product);
      product = await fresh(product.id);
      assert.equal(
        ok(
          await client()
            .from("published_content")
            .select("*")
            .eq("id", product.id)
            .single(),
        ).data.title,
        "Artificial QA published",
      );
      product = await save(product, "product", product.slug, {
        ...product.draft,
        title: "Artificial unpublished change",
      });
      assert.equal(
        ok(
          await anonymous
            .from("published_content")
            .select("*")
            .eq("id", product.id)
            .single(),
        ).data.title,
        "Artificial QA published",
      );
      assert.ok(
        (
          await owner.rpc("save_content", {
            p_id: product.id,
            p_kind: "product",
            p_slug: product.slug,
            p_data: product.draft,
            p_expected_revision: product.revision - 1,
          })
        ).error,
      );
      assert.ok(
        (
          await owner.rpc("save_content", {
            p_id: product.id,
            p_kind: "product",
            p_slug: product.slug,
            p_data: product.draft,
            p_expected_revision: null,
          })
        ).error,
      );
    },
  );
  await scenario(
    "live document immutable versions, stable slug and restored draft",
    async () => {
      doc = await save(null, "document", `${prefix}-document`, {
        title: "Artificial QA policy",
        documentType: "privacy",
        editionDate: "2026-10-08",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Artificial test. Not legal terms." },
              ],
            },
          ],
        },
      });
      const first = await publish(doc);
      doc = await fresh(doc.id);
      assert.ok(
        (
          await owner.rpc("save_content", {
            p_id: doc.id,
            p_kind: "document",
            p_slug: `${prefix}-changed`,
            p_data: doc.draft,
            p_expected_revision: doc.revision,
          })
        ).error,
      );
      doc = await save(doc, "document", doc.slug, {
        ...doc.draft,
        title: "Artificial QA new policy",
      });
      await publish(doc);
      doc = await fresh(doc.id);
      const restored = ok(
        await owner.rpc("restore_version", {
          p_version_id: first.version_id,
          p_expected_revision: doc.revision,
        }),
      );
      assert.equal(restored.draft.title, "Artificial QA policy");
      assert.equal(
        ok(
          await anonymous
            .from("published_content")
            .select("*")
            .eq("id", doc.id)
            .single(),
        ).data.title,
        "Artificial QA new policy",
      );
      assert.ok(
        (
          await owner
            .from("versions")
            .update({ data: { title: "Overwrite" } })
            .eq("id", first.version_id)
        ).error,
      );
    },
  );
  console.log(
    `${passed} REAL Supabase Auth/Data API/Storage scenarios passed. Browser derivative/public-media publish, frontend redeploy and backup restore still require acceptance checks. QA history/files remain in the dedicated test project.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Live integration failed",
  );
  process.exitCode = 1;
} finally {
  await Promise.all([owner.auth.signOut(), outsider.auth.signOut()]);
}
