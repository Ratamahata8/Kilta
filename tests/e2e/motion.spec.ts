import { test, expect } from "@playwright/test";
import { contentBundle } from "../../src/content/source";
const demo = "http://127.0.0.1:4174/Kilta/";

test("all real products have their own ordered photographs and source prices", async ({page}) => {
  const failures: string[] = [];
  page.on("response", response => { if (response.status() >= 400) failures.push(response.url()); });
  for (const product of contentBundle.entries.filter(e => e.kind === "product")) {
    await page.goto(`${demo}#/products/${product.slug}`);
    await page.reload();
    await expect(page.getByRole("heading", {name: product.data.title, exact: true})).toBeVisible();
    const gallery = page.getByRole("region", {name: `Галерея: ${product.data.title}`});
    const ordered = [...new Set([product.data.image!, ...product.data.gallery!])];
    await expect(gallery.locator('span[aria-live]').first()).toHaveText(`1 / ${ordered.length}`);
    const asset = contentBundle.media.find(m => m.id === ordered[0])!;
    await expect(gallery.locator('img:not([alt=""]):not([aria-hidden])').first()).toHaveAttribute("src", `/Kilta/${asset.hero.path}`);
    await expect.poll(() => gallery.locator("img").first().evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(page.getByText(product.data.dimensionsText!, {exact: true}).last()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  expect(failures).toEqual([]);
});

test("category colour reveal, focus and fast hover keep geometry stable in all three themes", async ({page}) => {
  await page.goto(`${demo}#/`);
  const first = page.locator('a[href="#/catalog?category=loungechairs"]');
  const second = page.locator('a[href="#/catalog?category=sculpture"]');
  await expect(page.locator('a[href^="#/catalog?category="]')).toHaveCount(8);
  for (const theme of ["gallery", "warm", "dark"]) {
    await page.getByLabel("Предпросмотр темы").selectOption(theme);
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator("..")).toHaveCSS("opacity", "1");
    await page.mouse.move(0, 0);
    const gray = first.locator('div[aria-hidden="true"]');
    await expect(gray).toHaveCSS("filter", "grayscale(1)");
    await expect(gray).toHaveCSS("opacity", "1");
    const before = await first.boundingBox();
    await first.hover(); await second.hover(); await first.hover();
    await expect(gray).toHaveCSS("opacity", "0");
    expect(await first.boundingBox()).toEqual(before);
    await page.mouse.move(0, 0);
    await page.keyboard.press("Tab"); await first.focus();
    await expect(first).toBeFocused(); await expect(gray).toHaveCSS("opacity", "0");
    await expect(first).toHaveCSS("outline-style", "solid");
    await first.evaluate(element => (element as HTMLElement).blur());
  }
  await page.goto(`${demo}#/catalog`);
  const image = page.locator('article img').first();
  await expect(image).toHaveCSS("filter", "none");
});

test("gallery preloads before crossfade; keyboard, lightbox focus trap and Escape work", async ({page}) => {
  await page.goto(`${demo}#/products/geometria`);
  const gallery = page.getByRole("region", {name: "Галерея: Шезлонг «Геометрия»"});
  const product = contentBundle.entries.find(e => e.slug === "geometria")!;
  const next = contentBundle.media.find(m => m.id === product.data.gallery![1])!;
  await page.route(`**/${next.hero.path}`, async route => {
    await new Promise(resolve => setTimeout(resolve, 400)); await route.continue();
  });
  await gallery.getByRole("button", {name: "Следующее фото", exact: true}).first().click();
  await expect(gallery.locator('span[aria-live]').first()).toHaveText("1 / 6");
  await expect(gallery.locator('img:not([alt=""]):not([aria-hidden])').first()).toBeVisible();
  await expect(gallery.locator('span[aria-live]').first()).toHaveText("2 / 6");
  const opener = gallery.getByRole("button", {name: /Открыть фото .* на весь экран/});
  await opener.click();
  const dialog = page.getByRole("dialog", {name: "Фото: Шезлонг «Геометрия»"});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", {name: "Закрыть фото"})).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator('span[aria-live]')).toHaveText("3 / 6");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
});

test("touch shows colour immediately, first tap navigates, gallery swipe avoids opening a modal", async ({browser}) => {
  const context = await browser.newContext({viewport: {width: 360, height: 850}, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  await page.goto(`${demo}#/`);
  const category = page.locator('a[href="#/catalog?category=loungechairs"]');
  await category.scrollIntoViewIfNeeded();
  await expect(category.locator('div[aria-hidden="true"]')).toHaveCSS("display", "none");
  await category.tap();
  await expect(page).toHaveURL(/catalog\?category=loungechairs/);
  await expect(page.locator('article')).toHaveCount(2);
  await page.goto(`${demo}#/products/geometria`);
  const stage = page.getByRole("button", {name: "Открыть фото 1 на весь экран"});
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height / 2, x = box.x + box.width * .8;
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x, y}]});
  await client.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: x - 100, y}]});
  await client.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
  await expect(page.locator('span[aria-live]').first()).toHaveText("2 / 6");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await context.close();
});

test("reduced motion and missing IntersectionObserver keep colour and content visible", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto(`${demo}#/`);
  const category = page.locator('a[href="#/catalog?category=loungechairs"]');
  await category.scrollIntoViewIfNeeded(); await category.hover();
  await expect(category.locator('div[aria-hidden="true"]')).toHaveCSS("display", "none");
  await expect(category.locator('img').first()).toHaveCSS("transform", "none");
  await expect(category.locator('img').first()).toHaveCSS("transition-duration", "0s");
  await expect(category.locator("..")).toHaveCSS("opacity", "1");
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.addInitScript(() => { Object.defineProperty(window, "IntersectionObserver", {value: undefined}); });
  await page.reload(); await category.scrollIntoViewIfNeeded();
  await expect(category.locator("..")).toHaveCSS("opacity", "1");
  await expect(page.locator('img[loading="eager"]').first()).toBeVisible();
});
