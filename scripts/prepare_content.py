"""Validate the supplied archive and produce only referenced, colour-correct WebP copies.

Run: python3 -m pip install -r scripts/requirements-content.txt
     python3 scripts/prepare_content.py
Originals and source HTML stay in kilta-content and never enter public/dist.
"""
import hashlib
import json
from pathlib import Path
import uuid
import re

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "kilta-content"
OUT = ROOT / "public/kilta"
OUT.mkdir(parents=True, exist_ok=True)
catalog = json.loads((SOURCE / "catalog.json").read_text())
assets = json.loads((SOURCE / "assets.json").read_text())
pages = {p["slug"]: p for p in json.loads((SOURCE / "pages.json").read_text())}
manifest = {a["file"]: a for a in assets}
missing = []
for asset in assets:
    path = SOURCE / asset["file"]
    if not path.exists():
        missing.append(asset["file"])
        continue
    if hashlib.sha256(path.read_bytes()).hexdigest() != asset["sha256"]:
        raise ValueError(f"Archive checksum mismatch: {asset['file']}")
    with Image.open(path) as image:
        image.verify()


def uid(key):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://kilta.ru/import/{key}"))


def rich(text):
    return {"type": "doc", "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": line}]}
        for line in text.split("\n\n") if line
    ]}


media = {}


def image_id(file, alt):
    if file not in manifest:
        raise ValueError(f"Image absent from manifest: {file}")
    if file in missing:
        return None
    asset = manifest[file]
    ident = uid(f"media/{asset['sha256']}")
    if ident in media:
        return ident
    with Image.open(SOURCE / file) as original:
        mime = Image.MIME[original.format]
        image = ImageOps.exif_transpose(original)
        # Respect embedded colour profiles instead of increasing saturation.
        if image.info.get("icc_profile"):
            from PIL import ImageCms
            import io
            profile = ImageCms.ImageCmsProfile(io.BytesIO(image.info["icc_profile"]))
            if profile.profile.xcolor_space.strip() == "RGB" and image.mode != "RGB":
                image = image.convert("RGB")
            image = ImageCms.profileToProfile(image, profile, ImageCms.createProfile("sRGB"), outputMode="RGB")
        else:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        sizes = {}
        for label, maximum in [("card", 720), ("hero", 1680)]:
            copy = image.copy()
            copy.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
            path = f"kilta/{asset['sha256'][:20]}-{label}.webp"
            copy.save(ROOT / "public" / path, "WEBP", quality=86, method=6)
            sizes[label] = {"path": path, "width": copy.width, "height": copy.height}
        media[ident] = {"id": ident, "kind": "image", "alt": alt,
            "caption": "", "source": "KILTA", "focal_x": 50, "focal_y": 50,
            "width": image.width, "height": image.height, "card": sizes["card"], "hero": sizes["hero"],
            "archiveFile": file, "sourceURL": asset["source_url"], "sha256": asset["sha256"], "originalMime": mime}
    return ident


entries = []


def entry(kind, slug, data, url=None):
    data["sourceInfo"] = {"url": url or catalog["source"], "extractedAt": catalog["extracted_at"], "referenceKey": f"{kind}/{slug}"}
    row = {"id": uid(f"{kind}/{slug}"), "kind": kind, "slug": slug, "data": data,
        "version_id": uid(f"version/{kind}/{slug}/{catalog['extracted_at']}"), "published_at": catalog["extracted_at"] + "T00:00:00Z"}
    entries.append(row)
    return row


for i, c in enumerate(catalog["categories"]):
    entry("category", c["slug"], {"title": c["title"], "order": i, "image": image_id(c["cover"], c["title"])}, c["source_url"])
for i, p in enumerate(catalog["products"]):
    gallery = [ident for j, file in enumerate(p["gallery"]) if (ident := image_id(file, f"{p['title']} — фото {j+1}"))]
    notes = list(p["review_notes"])
    if p["slug"] == "loveka":
        notes.append("В источнике LoveKA единица размера записана как «м», а не «мм»; требуется подтверждение владельца.")
    notes.extend(f"В архиве отсутствует фото {j+1} из галереи." for j, f in enumerate(p["gallery"]) if f in missing)
    data = {"title": p["title"], "description": rich(p["description"]), "materials": [p["material_text"]] if p["material_text"] else [],
        "dimensionsText": p["dimensions_text"] or "", "yearText": p["year_text"] or "", "exhibitionsText": p["exhibitions_text"] or "",
        "priceNote": p["price_text"] or "", "priceMode": {"from": "from", "fixed": "exact", "on_request": "request"}[p["pricing_mode"]],
        "price": p["price_rub"], "currency": "RUB", "unit": "mm", "availability": "order", "availabilityConfirmed": False,
        "categories": [uid(f"category/{p['category_slug']}")], "image": image_id(p["cover"], p["title"]), "gallery": gallery,
        "featured": i in [0, 1, 4, 6, 7, 13], "order": i, "reviewNotes": notes}
    if not data["image"]:
        raise ValueError(f"Product cover is missing: {p['slug']}")
    entry("product", p["slug"], data, p["source_url"])

about = next(b["text"] for b in pages["about"]["blocks"] if b["id"] == "rec1550980861")
workshop_image = image_id("images/eb166a82b79b-___.jpg", "Семейная мастерская KILTA")
entry("workshop", "workshop", {"title": "Мастерская", "heading": "Мастерская KILTA", "body": rich(about.replace("\n", "\n\n")), "image": workshop_image,
    "customOrder": about.split("\n")[2]}, pages["about"]["source_url"])
hero = image_id(catalog["products"][1]["cover"], catalog["products"][1]["title"])
entry("home", "home", {"title": "Главная", "heading": pages["home"]["title"], "subtitle": about.split("\n")[0], "image": hero,
    "primaryLabel": "Смотреть коллекцию", "secondaryLabel": "Обсудить заказ", "story": about.split("\n")[1],
    "customOrder": about.split("\n")[2], "sections": [{"section": s, "visible": True} for s in ["featured", "categories", "workshop", "custom", "showrooms"]]})
note = "По наличию конкретных работ просьба предварительно уточнять."
entry("showroom", "roommate", {"title": "Шоурум ROOMMATE", "city": "Москва", "address": "г. Москва, пер. Б. Козихинский, д. 22, стр. 2.", "contacts": note, "order": 0}, pages["showrooms"]["source_url"])
entry("showroom", "predmety", {"title": "Шоурум Предметы", "city": "Москва", "address": "г. Москва, Саввинская набережная д. 15", "contacts": note, "order": 1}, pages["showrooms"]["source_url"])
entry("contacts", "contacts", {"title": "Контакты", "phone": "+7 977 322 56 88", "contactPeople": [
    {"name": "Кузнецов Илья", "phone": "+7 977 322 56 88"}, {"name": "Кузнецова Татьяна", "phone": "+7 968 559 85 32"}],
    "image": image_id("images/e4e276c2cafd-1_resized.jpg", "Предмет KILTA"), "platforms": [
    {"label": "TEO by COSMOSCOW", "description": "Онлайн-платформа современного искусства", "url": "https://teodorus.art/"},
    {"label": "MANNER & MATTER", "description": "Онлайн-платформа российского предметного дизайна", "url": "https://manner-matter.ru/"}]}, pages["feedback"]["source_url"])
policy = pages["politic"]["text"].split("Политика в отношении обработки персональных данных", 1)[1].split("*Инстаграм", 1)[0].strip()
policy_nodes = []
for line in policy.splitlines():
    heading = re.match(r"^\d+\. (?:Общие положения|Основные понятия, используемые в Политике|Оператор может обрабатывать следующие персональные данные Пользователя|Цели обработки персональных данных|Правовые основания обработки персональных данных|Порядок сбора, хранения, передачи и других видов обработки персональных данных|Трансграничная передача персональных данных|Заключительные положения)", line)
    if heading:
        policy_nodes.append({"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": heading[0]}]})
        line = line[len(heading[0]):].strip()
    if line:
        policy_nodes.extend(rich(line)["content"])
privacy = entry("document", "privacy-archive", {"title": "Политика обработки персональных данных — архив", "body": {"type": "doc", "content": policy_nodes},
    "documentType": "privacy", "editionDate": catalog["extracted_at"], "requiresReview": True, "showInFooter": True,
    "reviewNotes": ["Архивный текст не подтверждён как актуальный. Сверить оператора, домены kilta.ru и ikvwood.ru, контакты и положения о cookie/аналитике; здесь трекеры не установлены."]}, pages["politic"]["source_url"])
entry("navigation", "navigation", {"title": "Навигация", "links": [{"label": label, "href": href} for label, href in [
    ("Коллекция", "/catalog"), ("Мастерская", "/workshop"), ("Шоурумы", "/showrooms"), ("Контакты", "/contacts")]],
    "documents": [privacy["id"]], "footerText": "Мастерская Ильи и Татьяны Кузнецовых"})
entry("appearance", "appearance", {"title": "Оформление", "theme": "gallery", "accent": "natural"})
entry("seo", "seo", {"title": "SEO", "siteName": "KILTA", "description": pages["home"]["title"], "ogImage": hero})
bundle = {"extractedAt": catalog["extracted_at"], "entries": entries, "media": list(media.values()),
    "audit": {"manifestCount": len(assets), "verifiedCount": len(assets)-len(missing), "missingFiles": missing,
    "notes": ["Цены, наличие, выставки и адреса требуют подтверждения владельца перед реальным запуском.", "My space: сохранить В1900 мм; LoveKA: сохранить единицу «м».", "Политика импортируется только черновиком, без исправлений юридических сведений."]}}
(ROOT / "src/content").mkdir(exist_ok=True)
(ROOT / "src/content/kilta.generated.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n")
used_files = {size["path"] for m in media.values() for size in [m["card"], m["hero"]]}
for file in OUT.glob("*.webp"):
    if str(file.relative_to(ROOT / "public")) not in used_files:
        file.unlink()
(OUT / "SOURCE.txt").write_text("Материалы KILTA предоставлены владельцем для переноса сайта. Источник: https://kilta.ru/\nДата извлечения: 8 октября 2026. Фото и описания принадлежат KILTA.\nЦены, наличие, размеры и адреса требуют подтверждения перед запуском. Демо не принимает заявки.\n")
print(f"Prepared {len(catalog['products'])} products, {len(catalog['categories'])} categories and {len(media)} referenced images; {len(missing)} archive files missing.")
