import { test, expect } from "@playwright/test";
import { mockBackend } from "./mock";
import { readFile } from "node:fs/promises";
const login = async (page: import("@playwright/test").Page) => {
  await page.goto("#/admin");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("transport-only-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Управление KILTA" }),
  ).toBeVisible();
};
test("import preview reads actual source content without creating or publishing records", async ({page, context}) => {
  const state = await mockBackend(context);
  const original = structuredClone({drafts: state.drafts, published: state.published});
  await login(page);
  await page.getByRole("link", {name: "Импорт материалов", exact: true}).click();
  await page.getByRole("button", {name: "Предпросмотр изменений", exact: true}).click();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(31);
  await expect(page.getByRole("button", {name: "Создать только новые черновики", exact: true})).toBeDisabled();
  await page.getByRole("button", {name: "Посмотреть предмет", exact: true}).first().click();
  await expect(page.getByRole("heading", {name: "Шезлонг «Геометрия»", exact: true})).toBeVisible();
  expect(state.drafts).toEqual(original.drafts); expect(state.published).toEqual(original.published);
});
test("read-only demo: hash routes, three themes, responsive layouts and keyboard", async ({
  page,
}) => {
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:\/\/[^/]*\.supabase\./i.test(request.url()))
      backendRequests.push(request.url());
  });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("http://127.0.0.1:4174/Kilta/#/");
    await expect(
      page.getByText("Демо-режим: только просмотр.", { exact: false }),
    ).toBeVisible();
    for (const theme of ["gallery", "warm", "dark"]) {
      await page.getByLabel("Предпросмотр темы").selectOption(theme);
      const values = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return {
          fg: style.color,
          bg: style.backgroundColor,
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          theme: document.body.dataset.theme,
        };
      });
      expect(values.theme).toBe(theme);
      expect(values.scroll).toBeLessThanOrEqual(values.width);
      const luminance = (s: string) => {
        const rgb = s
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const n = v / 255;
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const a = luminance(values.fg),
        b = luminance(values.bg);
      expect(
        (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
    await page.goto("http://127.0.0.1:4174/Kilta/#/products/geometria");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Шезлонг «Геометрия»", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.goto("http://127.0.0.1:4174/Kilta/#/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к содержимому" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.goto("http://127.0.0.1:4174/Kilta/#/admin");
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("загрузка файлов и отправка заявок отключены", { exact: false })).toBeVisible();
  expect(backendRequests).toEqual([]);
});
test("missing configuration, empty catalogue and genuine request failure states", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:4175/Kilta/#/catalog");
  await expect(
    page.getByText("Supabase не подключён. Контент и вход", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("В этой подборке пока нет предметов.", { exact: false }),
  ).toBeVisible();
  await context.route("https://test.supabase.co/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Test service unavailable" }),
    }),
  );
  await page.goto("http://127.0.0.1:4173/Kilta/#/catalog");
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить контент",
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("button", { name: "Повторить загрузку" }),
  ).toBeVisible();
});
test("owner UI: upload, draft, preview, publication, independent visitor and theme without rebuild", async ({
  page,
  context,
  browser,
}) => {
  const state = await mockBackend(context);
  await login(page);
  await page
    .getByRole("link", { name: "Изображения и PDF", exact: true })
    .click();
  await page.getByLabel("Файлы", { exact: true }).setInputFiles([
    {
      name: "chair-one.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile("kilta-content/images/fe18c61f2f5a-___Smith2.jpg"),
    },
    {
      name: "chair-two.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile("kilta-content/images/fe18c61f2f5a-___Smith2.jpg"),
    },
  ]);
  await page
    .getByRole("button", { name: "Загрузить файлы", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Загружено файлов: 2");
  expect(state.media).toHaveLength(2);
  expect(state.files.size).toBe(6);
  await page.getByRole("link", { name: "Предметы", exact: true }).click();
  await page.getByRole("link", { name: "Создать запись" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Проверка кресла");
  await page
    .getByLabel("Основное изображение", { exact: true })
    .selectOption(state.media[0].id);
  await page.getByLabel("Добавить в галерею").selectOption(state.media[0].id);
  await page.getByLabel("Добавить в галерею").selectOption(state.media[1].id);
  await page.getByRole("button", { name: "Выше: chair-two" }).click();
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Черновик сохранён");
  expect(state.drafts[0].draft.gallery?.[0]).toBe(state.media[1].id);
  const visitor = await browser.newContext();
  await visitor.route("https://test.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/rest/v1/published_content")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(state.published),
      });
    if (path === "/rest/v1/published_media")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(state.media),
      });
    return route.fulfill({
      status: 200,
      body: await readFile("kilta-content/images/fe18c61f2f5a-___Smith2.jpg"),
      contentType: "image/jpeg",
    });
  });
  const other = await visitor.newPage();
  await other.goto("http://127.0.0.1:4173/Kilta/#/catalog");
  await expect(
    other.getByRole("heading", { name: "Проверка кресла", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(
    page.getByText("Предпросмотр черновика. Не является публичной страницей.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Проверка кресла", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Вернуться в редактор" }).click();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Опубликовано");
  await other.reload();
  await expect(
    other.getByRole("heading", { name: "Проверка кресла", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Название", { exact: true })
    .fill("Неопубликованные правки");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Черновик сохранён");
  await other.reload();
  await expect(
    other.getByRole("heading", { name: "Проверка кресла", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole("heading", {
      name: "Неопубликованные правки",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Оформление", exact: true }).click();
  await page.getByRole("link", { name: "Настроить страницу" }).click();
  await page.getByLabel("Тема", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Опубликовано");
  await other.reload();
  await expect(other.locator("body")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Управление KILTA" }),
  ).toBeVisible();
  await expect(page.getByLabel("Тема", { exact: true })).toHaveValue("dark");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Вход в KILTA" }),
  ).toBeVisible();
  await visitor.close();
});
test("document UI: rich text, stable published address, history and restoring a new draft", async ({
  page,
  context,
}) => {
  const state = await mockBackend(context);
  await login(page);
  await page.getByRole("link", { name: "Документы", exact: true }).click();
  await page.getByRole("link", { name: "Создать запись" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Тестовая политика");
  await page
    .getByRole("textbox", { name: "Текст документа", exact: true })
    .fill("Искусственные тестовые данные. Не юридический документ.");
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Опубликовано");
  await expect(
    page.getByLabel("Адрес страницы", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await page
    .getByLabel("Название", { exact: true })
    .fill("Новая редакция политики");
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Опубликовано");
  await page.getByRole("button", { name: "История редакций" }).click();
  const original = page.locator("article").filter({
    has: page.getByText("Редакция 2 · Публикация", { exact: true }),
  });
  await original
    .getByRole("button", { name: "Восстановить в черновик" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Редакция восстановлена",
  );
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Тестовая политика",
  );
  expect(state.published.find((p) => p.kind === "document")?.data.title).toBe(
    "Новая редакция политики",
  );
  expect(state.versions.at(-1)?.action).toBe("restore");
});

test("PDF UI uses a separate 10 MB public bucket and published document link", async ({
  page,
  context,
}) => {
  const state = await mockBackend(context);
  await login(page);
  await page
    .getByRole("link", { name: "Изображения и PDF", exact: true })
    .click();
  await page.getByLabel("Тип файла", { exact: true }).selectOption("pdf");
  await page
    .getByLabel("Файлы", { exact: true })
    .setInputFiles({
      name: "qa-policy.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
      ),
    });
  await page
    .getByRole("button", { name: "Загрузить файлы", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Загружено файлов: 1");
  await page.getByRole("link", { name: "Документы", exact: true }).click();
  await page.getByRole("link", { name: "Создать запись" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Документ с PDF");
  await page
    .getByLabel("PDF документа", { exact: true })
    .selectOption(state.media[0].id);
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Опубликовано");
  expect([...state.files.keys()]).toContain(
    `kilta-public-documents/${state.media[0].original_path}`,
  );
  await page.goto(
    `#/documents/${state.published.find((p) => p.kind === "document")!.slug}`,
  );
  await expect(page.getByRole("link", { name: "Скачать PDF" })).toHaveAttribute(
    "href",
    `https://test.supabase.co/storage/v1/object/public/kilta-public-documents/${state.media[0].original_path}`,
  );
});
