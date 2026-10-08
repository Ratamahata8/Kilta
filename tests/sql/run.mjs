import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error(
    "Set TEST_DATABASE_URL to an isolated/local PostgreSQL SUPERUSER test target. This test creates and removes its own database. Never use production.",
  );
  process.exit(1);
}
const db = `kilta_policy_test_${randomUUID().replaceAll("-", "")}`;
const root = new pg.Client({ connectionString: url });
await root.connect();
const created = [];
let client,
  passed = 0;
const ids = {
  owner: randomUUID(),
  developer: randomUUID(),
  outsider: randomUUID(),
};
const run = async (label, fn) => {
  await fn();
  passed++;
  console.log(`PASS: ${label}`);
};
try {
  for (const role of ["anon", "authenticated"]) {
    if (
      !(await root.query("select 1 from pg_roles where rolname=$1", [role]))
        .rowCount
    ) {
      await root.query(`create role ${role} nologin`);
      created.push(role);
    }
  }
  await root.query(`create database ${db}`);
  const options = new URL(url);
  options.pathname = `/${db}`;
  client = new pg.Client({ connectionString: options.toString() });
  await client.connect();
  await client.query(`create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select on storage.objects to anon;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort())
    await client.query(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const id of Object.values(ids))
    await client.query("insert into auth.users values($1)", [id]);
  await client.query(
    "insert into public.user_roles values($1,'owner','Владелец'),($2,'developer','Разработчик')",
    [ids.owner, ids.developer],
  );
  async function actor(role, id, fn) {
    await client.query("begin");
    try {
      await client.query(`set local role ${role}`);
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id || "",
      ]);
      const result = await fn();
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  const owner = (fn) => actor("authenticated", ids.owner, fn),
    outsider = (fn) => actor("authenticated", ids.outsider, fn),
    anon = (fn) => actor("anon", null, fn);
  const save = async (id, kind, slug, data, revision) =>
    (
      await client.query("select public.save_content($1,$2,$3,$4,$5) as row", [
        id,
        kind,
        slug,
        data,
        revision,
      ])
    ).rows[0].row;
  const publish = async (row) =>
    (
      await client.query("select public.publish_content($1,$2) as row", [
        row.id,
        row.revision,
      ])
    ).rows[0].row;
  let category, product, doc, image, firstDoc;
  await run(
    "separate private/public PDF buckets enforce 10 MB independent of image limits",
    async () => {
      const buckets = (
        await client.query(
          "select id,file_size_limit,allowed_mime_types from storage.buckets",
        )
      ).rows;
      for (const name of ["kilta-documents", "kilta-public-documents"]) {
        const b = buckets.find((b) => b.id === name);
        assert.equal(Number(b.file_size_limit), 10485760);
        assert.deepEqual(b.allowed_mime_types, ["application/pdf"]);
      }
      assert.deepEqual(
        buckets.find((b) => b.id === "kilta-public").allowed_mime_types,
        ["image/webp"],
      );
    },
  );
  await run("roles do not recurse; owner reads only own role", async () => {
    const r = await owner(() =>
      client.query("select * from public.user_roles"),
    );
    assert.equal(r.rowCount, 1);
    assert.equal(r.rows[0].role, "owner");
  });
  await run(
    "anonymous cannot read drafts, users, versions or inquiries",
    async () => {
      for (const table of ["content", "user_roles", "versions", "inquiries"])
        await assert.rejects(
          anon(() => client.query(`select * from public.${table}`)),
          { code: "42501" },
        );
    },
  );
  await run(
    "unassigned authenticated user cannot edit or read private rows",
    async () => {
      assert.equal(
        (await outsider(() => client.query("select * from public.content")))
          .rowCount,
        0,
      );
      assert.equal(
        (await outsider(() => client.query("select * from public.inquiries")))
          .rowCount,
        0,
      );
      await assert.rejects(
        outsider(() =>
          save(null, "category", "blocked", { title: "Blocked" }, 0),
        ),
        { code: "42501" },
      );
    },
  );
  await run(
    "owner cannot assign developer role or modify roles directly",
    async () => {
      await assert.rejects(
        owner(() =>
          client.query("select public.set_user_role($1,'developer')", [
            ids.owner,
          ]),
        ),
        { code: "42501" },
      );
      await assert.rejects(
        owner(() =>
          client.query(
            "update public.user_roles set role='developer' where user_id=$1",
            [ids.owner],
          ),
        ),
        { code: "42501" },
      );
    },
  );
  await run("developer assigns roles through checked RPC", async () => {
    await actor("authenticated", ids.developer, () =>
      client.query("select public.set_user_role($1,'owner')", [ids.outsider]),
    );
    await actor("authenticated", ids.developer, () =>
      client.query("delete from public.user_roles where user_id=$1", [
        ids.outsider,
      ]),
    ).catch(async (error) => {
      assert.equal(error.code, "42501");
      await client.query("delete from public.user_roles where user_id=$1", [
        ids.outsider,
      ]);
    });
  });
  await run(
    "draft invisible; atomic publication creates public snapshot",
    async () => {
      category = await owner(() =>
        save(null, "category", "shezlongi", { title: "Шезлонги" }, 0),
      );
      assert.equal(
        (
          await anon(() =>
            client.query("select * from public.published_content"),
          )
        ).rowCount,
        0,
      );
      await owner(() => publish(category));
      assert.equal(
        (
          await anon(() =>
            client.query("select * from public.published_content"),
          )
        ).rowCount,
        1,
      );
    },
  );
  await run(
    "server rejects invalid prices and executable rich-text links",
    async () => {
      await assert.rejects(
        owner(() =>
          save(
            null,
            "product",
            "bad-price",
            {
              title: "Bad",
              priceMode: "exact",
              price: -1,
              availability: "order",
            },
            0,
          ),
        ),
      );
      await assert.rejects(
        owner(() =>
          save(
            null,
            "document",
            "bad-text",
            {
              title: "Bad",
              documentType: "privacy",
              editionDate: "2026-10-08",
              body: {
                type: "doc",
                content: [
                  {
                    type: "text",
                    text: "bad",
                    marks: [
                      { type: "link", attrs: { href: "javascript:alert(1)" } },
                    ],
                  },
                ],
              },
            },
            0,
          ),
        ),
      );
    },
  );
  await run(
    "private media protected by RLS and Storage object policies",
    async () => {
      const id = randomUUID();
      image = {
        id,
        kind: "image",
        alt: "Test photo",
        original_path: `${id}/original.png`,
        card_path: `${id}/card.webp`,
        hero_path: `${id}/hero.webp`,
        mime_type: "image/png",
        bytes: 100,
        width: 10,
        height: 10,
      };
      await owner(() =>
        client.query(
          "insert into public.media(id,kind,alt,original_path,card_path,hero_path,mime_type,bytes,width,height) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          Object.values(image),
        ),
      );
      await owner(() =>
        client.query(
          "insert into storage.objects(bucket_id,name) values('kilta-originals',$1)",
          [image.original_path],
        ),
      );
      assert.equal(
        (await anon(() => client.query("select * from storage.objects")))
          .rowCount,
        0,
      );
      assert.equal(
        (await outsider(() => client.query("select * from storage.objects")))
          .rowCount,
        0,
      );
      await assert.rejects(
        outsider(() =>
          client.query(
            "insert into storage.objects(bucket_id,name) values('kilta-public',$1)",
            [image.card_path],
          ),
        ),
        { code: "42501" },
      );
    },
  );
  await run(
    "publication requires prepared public copies; references prevent media deletion",
    async () => {
      product = await owner(() =>
        save(
          null,
          "product",
          "demo-product",
          {
            title: "Test product",
            priceMode: "request",
            availability: "order",
            categories: [category.id],
            image: image.id,
          },
          0,
        ),
      );
      await assert.rejects(owner(() => publish(product)));
      await assert.rejects(
        owner(() => client.query("select public.delete_media($1)", [image.id])),
      );
      const del = await owner(() =>
        client.query("delete from storage.objects where name=$1", [
          image.original_path,
        ]),
      );
      assert.equal(del.rowCount, 0);
      await owner(() =>
        client.query(
          "insert into storage.objects(bucket_id,name) values('kilta-public',$1),('kilta-public',$2)",
          [image.card_path, image.hero_path],
        ),
      );
      await owner(() => publish(product));
      assert.equal(
        (await anon(() => client.query("select * from public.published_media")))
          .rowCount,
        1,
      );
      const dimensions = await anon(() => client.query("select width,height from public.published_media where id=$1", [image.id]));
      assert.equal(dimensions.rows[0].width, image.width);
      assert.equal(dimensions.rows[0].height, image.height);
    },
  );
  await run("import metadata is validated on the server without changing private access", async () => {
    for (const extra of [{platforms: [{label: "Bad", description: "Bad", url: "javascript:alert(1)"}]}, {dimensionsText: {height: 1900}}, {contactPeople: [{name: "Bad", phone: "tel:script"}]}])
      await assert.rejects(owner(() => save(null, "contacts", `invalid-${Math.random().toString(36).slice(2)}`, {title: "Invalid import", ...extra}, 0)));
  });
  await run("draft edits never replace previous public snapshot", async () => {
    product = (
      await client.query("select * from public.content where id=$1", [
        product.id,
      ])
    ).rows[0];
    product = await owner(() =>
      save(
        product.id,
        "product",
        product.slug,
        { ...product.draft, title: "Unpublished change" },
        product.revision,
      ),
    );
    const pub = await anon(() =>
      client.query("select data from public.published_content where id=$1", [
        product.id,
      ]),
    );
    assert.equal(pub.rows[0].data.title, "Test product");
  });
  await run(
    "optimistic concurrency rejects stale revisions without changing data",
    async () => {
      await assert.rejects(
        owner(() =>
          save(
            product.id,
            "product",
            product.slug,
            { ...product.draft, title: "Stale overwrite" },
            product.revision - 1,
          ),
        ),
        { code: "40001" },
      );
      assert.equal(
        (
          await client.query("select draft from public.content where id=$1", [
            product.id,
          ])
        ).rows[0].draft.title,
        "Unpublished change",
      );
    },
  );
  await run(
    "documents have immutable IDs, stable slug and restoration as new draft",
    async () => {
      doc = await owner(() =>
        save(
          null,
          "document",
          "privacy-test",
          {
            title: "Original policy",
            documentType: "privacy",
            editionDate: "2026-10-08",
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Artificial test data" }],
                },
              ],
            },
          },
          0,
        ),
      );
      firstDoc = await owner(() => publish(doc));
      doc = (
        await client.query("select * from public.content where id=$1", [doc.id])
      ).rows[0];
      await assert.rejects(
        owner(() =>
          save(doc.id, "document", "changed-slug", doc.draft, doc.revision),
        ),
      );
      doc = await owner(() =>
        save(
          doc.id,
          "document",
          doc.slug,
          { ...doc.draft, title: "New policy" },
          doc.revision,
        ),
      );
      await owner(() => publish(doc));
      doc = (
        await client.query("select * from public.content where id=$1", [doc.id])
      ).rows[0];
      const restored = await owner(() =>
        client.query("select public.restore_version($1,$2) as row", [
          firstDoc.version_id,
          doc.revision,
        ]),
      );
      assert.equal(restored.rows[0].row.draft.title, "Original policy");
      assert.equal(
        (
          await anon(() =>
            client.query(
              "select data from public.published_content where id=$1",
              [doc.id],
            ),
          )
        ).rows[0].data.title,
        "New policy",
      );
      await assert.rejects(
        owner(() => client.query("update public.versions set data='{}'")),
        { code: "42501" },
      );
    },
  );
  await run(
    "anonymous mutations and inquiry insertion are denied",
    async () => {
      await assert.rejects(
        anon(() =>
          client.query(
            "insert into public.inquiries(name,contact) values('Synthetic','none')",
          ),
        ),
        { code: "42501" },
      );
      await assert.rejects(
        anon(() => client.query("delete from public.published_content")),
        { code: "42501" },
      );
      await assert.rejects(
        anon(() =>
          client.query("select public.publish_content($1,$2)", [doc.id, 1]),
        ),
        { code: "42501" },
      );
    },
  );
  await run(
    "unpublish removes snapshot but does not promise revocation of public files",
    async () => {
      product = (
        await client.query("select * from public.content where id=$1", [
          product.id,
        ])
      ).rows[0];
      await owner(() =>
        client.query("select public.unpublish_content($1,$2)", [
          product.id,
          product.revision,
        ]),
      );
      assert.equal(
        (
          await anon(() =>
            client.query("select * from public.published_content where id=$1", [
              product.id,
            ]),
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (await anon(() => client.query("select * from public.published_media")))
          .rowCount,
        0,
      );
      assert.equal(
        (
          await anon(() =>
            client.query(
              "select * from storage.objects where bucket_id='kilta-public'",
            ),
          )
        ).rowCount,
        2,
      );
    },
  );
  await run(
    "starter seed is idempotent and never overwrites edited user content",
    async () => {
      const seed = await readFile("supabase/seed.sql", "utf8");
      await client.query(seed);
      await client.query(
        "update public.content set draft=jsonb_set(draft,'{title}', '\"User custom title\"') where kind='category' and slug='shezlongi'",
      );
      const before = (
        await client.query("select count(*)::int as n from public.content")
      ).rows[0].n;
      await client.query(seed);
      assert.equal(
        (await client.query("select count(*)::int as n from public.content"))
          .rows[0].n,
        before,
      );
      assert.equal(
        (
          await client.query(
            "select draft->>'title' as title from public.content where kind='category' and slug='shezlongi'",
          )
        ).rows[0].title,
        "User custom title",
      );
      assert.equal(
        (
          await anon(() =>
            client.query(
              "select * from public.published_content where kind='document' and slug like 'demo-%'",
            ),
          )
        ).rowCount,
        0,
      );
    },
  );
  console.log(
    `${passed} PostgreSQL migration/RLS/RPC scenarios passed. Auth and Storage tables are test fixtures; this is NOT a live Supabase Auth/Storage gateway test.`,
  );
} finally {
  if (client) await client.end();
  await root.query(`drop database if exists ${db} with (force)`);
  for (const role of created) await root.query(`drop role ${role}`);
  await root.end();
}
