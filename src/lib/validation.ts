import type { ContentData, Kind, RichNode } from "./types";
export const safeURL = (value: unknown) =>
  typeof value === "string" &&
  /^(https?:\/\/|mailto:|tel:)/i.test(value) &&
  !Array.from(value).some((c) => c.charCodeAt(0) <= 32);
export function validateRich(node: RichNode, depth = 0): boolean {
  if (
    !node ||
    depth > 30 ||
    ![
      "doc",
      "paragraph",
      "text",
      "heading",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "hardBreak",
      "horizontalRule",
    ].includes(node.type)
  )
    return false;
  if (node.type === "heading" && ![1, 2, 3].includes(Number(node.attrs?.level)))
    return false;
  if (
    node.marks?.some(
      (m) =>
        !["bold", "italic", "underline", "strike", "code", "link"].includes(
          m.type,
        ) ||
        (m.type === "link" && !safeURL(m.attrs?.href)),
    )
  )
    return false;
  return !node.content || node.content.every((n) => validateRich(n, depth + 1));
}
export function validateContent(kind: Kind, slug: string, data: ContentData) {
  for (const key of ["dimensionsText", "yearText", "exhibitionsText", "priceNote"] as const)
    if (data[key] != null && (typeof data[key] !== "string" || data[key]!.length > 5000))
      throw new Error("Импортированное текстовое поле должно быть строкой до 5000 символов.");
  for (const key of ["availabilityConfirmed", "requiresReview"] as const)
    if (data[key] != null && typeof data[key] !== "boolean") throw new Error("Проверьте отметку подтверждения.");
  if (data.contactPeople && (!Array.isArray(data.contactPeople) || data.contactPeople.length > 10 || data.contactPeople.some(p => typeof p.name !== "string" || !/^[+0-9 ()-]+$/.test(p.phone))))
    throw new Error("Проверьте имена и телефоны контактных лиц.");
  if (data.platforms && (!Array.isArray(data.platforms) || data.platforms.length > 30 || data.platforms.some(p => !safeURL(p.url) || !/^https?:\/\//.test(p.url) || typeof p.label !== "string" || typeof p.description !== "string")))
    throw new Error("Проверьте название и http(s)-ссылку площадки.");
  if (!data.title.trim() || data.title.length > 160)
    throw new Error("Укажите название, не длиннее 160 символов.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error("Адрес: латинские буквы, цифры и дефисы.");
  if (
    (data.body && !validateRich(data.body)) ||
    (typeof data.description === "object" && !validateRich(data.description))
  )
    throw new Error("Недопустимый формат текста.");
  if (
    kind === "product" &&
    data.priceMode !== "request" &&
    (typeof data.price !== "number" || data.price < 0)
  )
    throw new Error("Укажите неотрицательную цену.");
  if (kind === "document" && !data.editionDate)
    throw new Error("Укажите дату редакции.");
  if (kind === "showroom" && (!data.city || !data.address))
    throw new Error("Укажите город и адрес шоурума.");
  if (data.routeURL && !/^https?:\/\//.test(data.routeURL))
    throw new Error("Маршрут должен начинаться с https:// или http://.");
  if (data.social?.some((link) => !/^https?:\/\//.test(link.url)))
    throw new Error(
      "Социальная ссылка должна начинаться с https:// или http://.",
    );
}
export function mediaIDs(data: ContentData) {
  return [
    ...new Set(
      [
        data.image,
        data.pdf,
        data.logo,
        data.favicon,
        data.ogImage,
        ...(data.gallery || []),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
}
