import type { Snapshot, PublicMedia } from "./types";
import { defaultData } from "./types";
const date = "2026-10-08T00:00:00Z";
const image = (
  id: string,
  file: string,
  alt: string,
  source: string,
): PublicMedia => ({
  id,
  kind: "image",
  alt,
  caption: "Демонстрационный 3D-рендер; не фотография продукции KILTA.",
  source,
  focal_x: 50,
  focal_y: 50,
  url: `${import.meta.env.BASE_URL}demo/${file}`,
  heroUrl: `${import.meta.env.BASE_URL}demo/${file}`,
});
export const demoMedia = [
  image(
    "demo-chair",
    "chair.jpg",
    "Демо: деревянное кресло с мягким сиденьем",
    "SheenChair — Eric Chadwick, Wayfair LLC, 2020, CC0. Khronos glTF Sample Assets.",
  ),
  image(
    "demo-sofa",
    "sofa.jpg",
    "Демо: деревянный диван с текстильными подушками",
    "Fran Calvente (CC0), improvements Eric Chadwick / DGG, 2024 (CC BY 4.0). Khronos glTF Sample Assets.",
  ),
];
const entry = (
  kind: Snapshot["kind"],
  slug: string,
  data: Snapshot["data"],
  id = slug,
): Snapshot => ({
  id,
  kind,
  slug,
  data,
  version_id: `demo-${id}`,
  published_at: date,
});
const categories = [
  "Шезлонги",
  "Скульптуры",
  "Консоли",
  "Комоды",
  "Ширмы",
  "Столы",
  "Стеллажи",
  "Торшеры",
];
const slugs = [
  "shezlongi",
  "skulptury",
  "konsoli",
  "komody",
  "shirmy",
  "stoly",
  "stellazhi",
  "torshery",
];
export const demoEntries: Snapshot[] = [
  ...categories.map((title, i) =>
    entry("category", slugs[i], { title, order: i }),
  ),
  entry("product", "demo-chair", {
    ...defaultData("product"),
    title: "Демо / Кресло",
    image: "demo-chair",
    gallery: ["demo-sofa"],
    categories: ["shezlongi"],
    description: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Демонстрационный предмет для знакомства с каталогом. Не является изделием KILTA. Замените изображение и описание своими материалами.",
            },
          ],
        },
      ],
    },
    materials: ["Дерево", "Текстиль"],
    dimensions: { height: 80, width: 65, depth: 70 },
    featured: true,
    demo: true,
    order: 0,
  }),
  entry("product", "demo-object", {
    ...defaultData("product"),
    title: "Демо / Объект для пространства",
    image: "demo-sofa",
    categories: ["shezlongi"],
    materials: ["Дерево", "Текстиль"],
    featured: true,
    demo: true,
    order: 1,
  }),
  ...(
    ["home", "workshop", "appearance", "contacts", "navigation", "seo"] as const
  ).map((kind) =>
    entry(kind, kind, {
      ...defaultData(kind),
      ...(kind === "home"
        ? {
            subtitle:
              "Авторские предметы, в которых встречаются форма, материал и пространство. Демонстрационная версия сайта.",
            image: "demo-sofa",
            story:
              "Здесь владелец расскажет историю семейной мастерской. Текст редактируется в админке.",
            customOrder:
              "Обсудите материалы, размеры и детали предмета, который станет частью вашего пространства.",
          }
        : {}),
      ...(kind === "workshop"
        ? {
            image: "demo-chair",
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Этот текст — демонстрационный пример. Историю мастерской предоставит владелец.",
                    },
                  ],
                },
              ],
            },
            customOrder: "Опишите свою идею и свяжитесь с мастерской.",
          }
        : {}),
      ...(kind === "seo" ? { siteName: "KILTA" } : {}),
    }),
  ),
];
