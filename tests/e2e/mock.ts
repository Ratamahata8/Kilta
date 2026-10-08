// UI transport simulation ONLY. These fixtures are not a security/auth proof.
import type { BrowserContext, Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type {
  Entry,
  Snapshot,
  Version,
  Media,
  Role,
  ContentData,
} from "../../src/lib/types";
const owner = "11111111-1111-4111-8111-111111111111";
const category = "22222222-2222-4222-8222-222222222222";
export async function mockBackend(context: BrowserContext) {
  const drafts: Entry[] = [],
    published: Snapshot[] = [
      {
        id: category,
        kind: "category",
        slug: "shezlongi",
        data: { title: "Шезлонги" },
        version_id: randomUUID(),
        published_at: new Date().toISOString(),
      },
    ],
    versions: Version[] = [],
    media: Media[] = [];
  const roles: Role[] = [
    { user_id: owner, role: "owner", name: "Тестовый владелец" },
  ];
  const files = new Map<string, Buffer>();
  const photo = await readFile("public/demo/chair.jpg");
  const user = {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "owner@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: owner,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
        iss: "https://test.supabase.co/auth/v1",
      }),
    ).toString("base64url"),
    "transport-fixture",
  ].join(".");
  const json = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  await context.route("https://test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method();
    if (method === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
    if (path === "/auth/v1/token")
      return json(route, {
        access_token: token,
        refresh_token: "transport-fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return json(route, user);
    if (path === "/auth/v1/logout") return json(route, {});
    if (path.startsWith("/storage/v1/object/sign/") && method === "POST")
      return json(route, {
        signedURL: `/object/sign/${path.slice("/storage/v1/object/sign/".length)}?token=transport-fixture`,
      });
    if (path.startsWith("/storage/v1/object/")) {
      let key = path
        .slice("/storage/v1/object/".length)
        .replace(/^(public|sign|authenticated)\//, "");
      key = decodeURIComponent(key);
      if (method === "POST") {
        files.set(key, request.postDataBuffer() || photo);
        return json(route, { Key: key, Id: randomUUID() });
      }
      if (method === "DELETE") return json(route, []);
      const bytes = files.get(key) || photo;
      return route.fulfill({
        status: 200,
        body: bytes,
        contentType: key.endsWith(".webp") ? "image/webp" : "image/jpeg",
      });
    }
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").at(-1),
        args = request.postDataJSON();
      if (name === "save_content") {
        let entry = drafts.find((e) => e.id === args.p_id);
        if (entry && entry.revision !== args.p_expected_revision)
          return json(
            route,
            { code: "40001", message: "Конфликт редакции" },
            409,
          );
        if (!entry) {
          entry = {
            id: randomUUID(),
            kind: args.p_kind,
            slug: args.p_slug,
            draft: args.p_data,
            revision: 0,
            deleted: false,
            updated_at: new Date().toISOString(),
          };
          drafts.push(entry);
        }
        entry.slug = args.p_slug;
        entry.draft = args.p_data;
        entry.revision++;
        entry.updated_at = new Date().toISOString();
        versions.push({
          id: randomUUID(),
          content_id: entry.id,
          slug: entry.slug,
          data: structuredClone(entry.draft),
          revision: entry.revision,
          action: "draft",
          created_at: entry.updated_at,
        });
        return json(route, entry);
      }
      if (name === "publish_content") {
        const entry = drafts.find((e) => e.id === args.p_id)!;
        entry.revision++;
        const version = {
          id: randomUUID(),
          content_id: entry.id,
          slug: entry.slug,
          data: structuredClone(entry.draft),
          revision: entry.revision,
          action: "publish" as const,
          created_at: new Date().toISOString(),
        };
        versions.push(version);
        const snapshot = {
          id: entry.id,
          kind: entry.kind,
          slug: entry.slug,
          data: structuredClone(entry.draft),
          version_id: version.id,
          published_at: new Date().toISOString(),
        };
        const index = published.findIndex((p) => p.id === entry.id);
        if (index >= 0) published.splice(index, 1, snapshot);
        else published.push(snapshot);
        return json(route, snapshot);
      }
      if (name === "restore_version") {
        const version = versions.find((v) => v.id === args.p_version_id)!,
          entry = drafts.find((e) => e.id === version.content_id)!;
        entry.draft = structuredClone(version.data);
        entry.slug = version.slug;
        entry.revision++;
        versions.push({
          id: randomUUID(),
          content_id: entry.id,
          slug: entry.slug,
          data: structuredClone(entry.draft),
          revision: entry.revision,
          action: "restore",
          created_at: new Date().toISOString(),
        });
        return json(route, entry);
      }
      if (name === "media_usage") return json(route, []);
      if (name === "update_profile") return json(route, null);
      return json(route, { message: `Unhandled fixture RPC ${name}` }, 400);
    }
    if (path.startsWith("/rest/v1/")) {
      const table = path.split("/").at(-1);
      let rows: unknown[] = [];
      if (table === "user_roles") rows = roles;
      if (table === "content") rows = drafts;
      if (table === "published_content") rows = published;
      if (table === "versions") rows = versions;
      if (table === "media") {
        if (method === "POST") {
          const entry = {
            ...request.postDataJSON(),
            created_at: new Date().toISOString(),
          };
          media.push(entry);
          return json(route, entry);
        }
        if (method === "PATCH") {
          const entry = media.find(
            (m) => m.id === url.searchParams.get("id")?.replace("eq.", ""),
          )!;
          Object.assign(entry, request.postDataJSON());
          return json(route, entry);
        }
        rows = media;
      }
      if (table === "published_media") {
        const ids = published
          .flatMap((p) => [
            p.data.image,
            ...(p.data.gallery || []),
            p.data.logo,
            p.data.favicon,
            p.data.ogImage,
            p.data.pdf,
          ])
          .filter(Boolean);
        rows = media.filter((m) => ids.includes(m.id)).map(m=>({...m,pdf_path:m.kind==="pdf"?m.original_path:null}));
      }
      if (table === "inquiries") rows = [];
      for (const [key, value] of url.searchParams.entries())
        if (value.startsWith("eq."))
          rows = rows.filter(
            (r) =>
              (r as Record<string, unknown>)[key] === value.slice(3) ||
              (r as Record<string, unknown>)[key] ===
                Boolean(value.slice(3) === "true"),
          );
      if (table === "versions")
        rows.sort((a, b) => (b as Version).revision - (a as Version).revision);
      if (request.headers().accept?.includes("vnd.pgrst.object"))
        return json(route, rows[0] || null);
      return json(route, rows);
    }
    return json(route, { message: "Unknown mocked endpoint" }, 404);
  });
  return {
    drafts,
    published,
    versions,
    media,
    files,
    async publish(kind: Entry["kind"], slug: string, data: ContentData) {
      published.push({
        id: randomUUID(),
        kind,
        slug,
        data,
        version_id: randomUUID(),
        published_at: new Date().toISOString(),
      });
    },
  };
}
