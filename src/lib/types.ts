export type Kind =
  | "product"
  | "category"
  | "showroom"
  | "document"
  | "home"
  | "workshop"
  | "appearance"
  | "contacts"
  | "navigation"
  | "seo";
export type Theme = "gallery" | "warm" | "dark";
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
export type ContentData = {
  title: string;
  image?: string | null;
  gallery?: string[];
  description?: string | RichNode;
  body?: RichNode;
  categories?: string[];
  materials?: string[];
  dimensions?: {
    height?: number | null;
    width?: number | null;
    depth?: number | null;
  };
  unit?: "cm" | "mm";
  priceMode?: "request" | "exact" | "from";
  price?: number | null;
  currency?: "RUB";
  availability?: "order" | "stock" | "sold";
  leadTime?: string;
  options?: string;
  featured?: boolean;
  demo?: boolean;
  order?: number;
  seoTitle?: string;
  seoDescription?: string;
  city?: string;
  address?: string;
  hours?: string;
  contacts?: string;
  routeURL?: string;
  items?: string[];
  documentType?:
    | "privacy"
    | "consent"
    | "offer"
    | "delivery"
    | "returns"
    | "details"
    | "cookies";
  editionDate?: string;
  effectiveDate?: string;
  pdf?: string | null;
  showInFooter?: boolean;
  heading?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  story?: string;
  customOrder?: string;
  sections?: {
    section: "featured" | "categories" | "workshop" | "custom" | "showrooms";
    visible: boolean;
  }[];
  theme?: Theme;
  accent?: "natural" | "clay" | "olive";
  logo?: string | null;
  favicon?: string | null;
  phone?: string;
  email?: string;
  seller?: string;
  social?: { label: string; url: string }[];
  links?: { label: string; href: string }[];
  documents?: string[];
  footerText?: string;
  siteName?: string;
  ogImage?: string | null;
};
// Featured product IDs use items[]; featured is a product checkbox.
export type Entry = {
  id: string;
  kind: Kind;
  slug: string;
  draft: ContentData;
  revision: number;
  deleted: boolean;
  updated_at: string;
};
export type Snapshot = {
  id: string;
  kind: Kind;
  slug: string;
  data: ContentData;
  version_id: string;
  published_at: string;
};
export type Version = {
  id: string;
  content_id: string;
  slug: string;
  data: ContentData;
  revision: number;
  action: "draft" | "publish" | "restore";
  created_at: string;
};
export type Media = {
  id: string;
  kind: "image" | "pdf";
  alt: string;
  caption: string;
  source: string;
  focal_x: number;
  focal_y: number;
  original_path: string;
  card_path?: string | null;
  hero_path?: string | null;
  mime_type: string;
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
};
export type PublicMedia = Pick<
  Media,
  | "id"
  | "kind"
  | "alt"
  | "caption"
  | "source"
  | "focal_x"
  | "focal_y"
  | "card_path"
  | "hero_path"
> & { pdf_path?: string | null; url?: string; heroUrl?: string };
export type Role = {
  user_id: string;
  role: "owner" | "developer";
  name: string;
};
export const kindLabels: Record<Kind, string> = {
  product: "Предметы",
  category: "Категории",
  showroom: "Шоурумы",
  document: "Документы",
  home: "Главная",
  workshop: "Мастерская",
  appearance: "Оформление",
  contacts: "Контакты и реквизиты",
  navigation: "Навигация и подвал",
  seo: "SEO",
};
export const singletonKinds: Kind[] = [
  "home",
  "workshop",
  "appearance",
  "contacts",
  "navigation",
  "seo",
];
export const emptyRich: RichNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
export const defaultData = (kind: Kind): ContentData => ({
  title: kindLabels[kind],
  order: 0,
  ...(kind === "product"
    ? {
        priceMode: "request",
        availability: "order",
        currency: "RUB",
        unit: "cm",
        materials: [],
        categories: [],
        gallery: [],
        description: emptyRich,
      }
    : {}),
  ...(kind === "document"
    ? {
        documentType: "privacy",
        editionDate: new Date().toISOString().slice(0, 10),
        showInFooter: true,
        body: emptyRich,
      }
    : {}),
  ...(kind === "appearance" ? { theme: "gallery", accent: "natural" } : {}),
  ...(kind === "home"
    ? {
        heading: "Предметы с характером",
        primaryLabel: "Смотреть коллекцию",
        secondaryLabel: "Обсудить заказ",
        sections: [
          "featured",
          "categories",
          "workshop",
          "custom",
          "showrooms",
        ].map((section) => ({
          section,
          visible: true,
        })) as ContentData["sections"],
      }
    : {}),
  ...(kind === "navigation"
    ? {
        links: [
          { label: "Коллекция", href: "/catalog" },
          { label: "Мастерская", href: "/workshop" },
          { label: "Шоурумы", href: "/showrooms" },
          { label: "Контакты", href: "/contacts" },
        ],
        footerText: "Авторская мебель и скульптуры",
      }
    : {}),
});
