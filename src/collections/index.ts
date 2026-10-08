import path from 'node:path'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { APIError, type CollectionConfig, type CollectionBeforeOperationHook } from 'payload'
import { developer, editor, published, selfOrDeveloper, fileRead } from '@/lib/access'
import { title, slug, order, image, gallery, body, seoFields, safeURL } from '@/lib/fields'
import { preserveRevision, protectFileDelete, stableDocumentSlug } from '@/lib/hooks'
const versions = { drafts: { autosave: false }, maxPerDoc: 50 }
const access = { read: published, create: editor, update: editor, delete: editor, readVersions: editor }
const previews = (prefix: string) => ({ preview: (doc: { slug?: string }) => `/preview?path=${prefix}/${doc.slug || ''}` })
export const Users: CollectionConfig = {
  slug: 'users', labels: { singular: 'Пользователь', plural: 'Пользователи' },
  auth: { maxLoginAttempts: 5, lockTime: 600000 },
  admin: { useAsTitle: 'email', group: 'Управление' },
  access: { read: selfOrDeveloper, create: developer, update: selfOrDeveloper, delete: developer, admin: editor },
  endpoints: [{ path: '/first-register', method: 'post', handler: () => Response.json({ errors: [{ message: 'Первый пользователь создаётся только CLI-командой.' }] }, { status: 403 }) }],
  fields: [
    { name: 'name', label: 'Имя', type: 'text', required: true },
    { name: 'role', label: 'Роль', type: 'select', required: true, defaultValue: 'owner', options: [{ label: 'Владелец', value: 'owner' }, { label: 'Разработчик', value: 'developer' }], access: { create: developer, update: developer }, admin: { description: 'Роли назначает только разработчик.' } },
  ],
}
const validateUpload = (pdf: boolean): CollectionBeforeOperationHook => async ({ req, operation }) => {
  if (!['create', 'update'].includes(operation) || !req.file) return
  const file = req.file
  const max = (pdf ? 10 : 20) * 1024 * 1024
  if (file.size > max) throw new APIError(`Размер файла не должен превышать ${pdf ? 10 : 20} МБ.`, 400)
  const type = await fileTypeFromBuffer(file.data)
  const allowed = pdf ? ['application/pdf'] : ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!type || !allowed.includes(type.mime) || type.mime !== file.mimetype) throw new APIError('Содержимое файла не соответствует разрешённому формату.', 400)
  if (!pdf) {
    try { await sharp(file.data, { limitInputPixels: 60000000 }).metadata() } catch { throw new APIError('Изображение повреждено или слишком большое.', 400) }
  }
}
export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: 'Изображение', plural: 'Изображения' },
  admin: { useAsTitle: 'alt', group: 'Контент', description: 'JPEG, PNG, WebP, AVIF, до 20 МБ. Неиспользуемые и черновые файлы доступны только редакторам.' },
  access: { read: fileRead('media'), create: editor, update: editor, delete: editor },
  upload: { staticDir: path.resolve(process.env.MEDIA_DIR || 'media', 'images'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], pasteURL: false, focalPoint: true, imageSizes: [{ name: 'card', width: 720, height: 900, fit: 'cover', formatOptions: { format: 'webp' } }, { name: 'hero', width: 1920, height: 1280, fit: 'cover', formatOptions: { format: 'webp' } }], adminThumbnail: 'card' },
  hooks: { beforeOperation: [validateUpload(false)], beforeDelete: [protectFileDelete('media')] },
  fields: [{ name: 'alt', label: 'Описание для доступности', type: 'text', required: true }, { name: 'caption', label: 'Подпись', type: 'text' }, { name: 'source', label: 'Автор / источник', type: 'text' }],
}
export const PDFs: CollectionConfig = {
  slug: 'pdfs', labels: { singular: 'PDF документа', plural: 'PDF документов' }, admin: { group: 'Контент' },
  access: { read: fileRead('pdfs'), create: editor, update: editor, delete: editor },
  upload: { staticDir: path.resolve(process.env.MEDIA_DIR || 'media', 'pdfs'), mimeTypes: ['application/pdf'], pasteURL: false },
  hooks: { beforeOperation: [validateUpload(true)], beforeDelete: [protectFileDelete('pdfs')] },
  fields: [{ name: 'title', label: 'Название', type: 'text', required: true }],
}
export const Categories: CollectionConfig = {
  slug: 'categories', labels: { singular: 'Категория', plural: 'Категории' }, admin: { useAsTitle: 'title', group: 'Каталог' }, access, versions,
  fields: [title, slug, image, { name: 'description', label: 'Описание', type: 'textarea' }, order],
}
export const Items: CollectionConfig = {
  slug: 'items', labels: { singular: 'Предмет', plural: 'Предметы' }, admin: { useAsTitle: 'title', group: 'Каталог', ...previews('/catalog') }, access, versions,
  fields: [title, slug, { name: 'categories', label: 'Категории', type: 'relationship', relationTo: 'categories', hasMany: true }, image, gallery, { name: 'description', label: 'Описание', type: 'richText' },
    { name: 'materials', label: 'Материалы', type: 'array', fields: [{ name: 'name', label: 'Материал', type: 'text', required: true }] },
    { name: 'dimensions', label: 'Размеры', type: 'group', fields: ['height', 'width', 'depth'].map((name, i) => ({ name, label: ['Высота', 'Ширина', 'Глубина'][i], type: 'number', min: 0 })).concat([]) as import('payload').Field[] },
    { name: 'unit', label: 'Единица размеров', type: 'select', options: [{ label: 'см', value: 'cm' }, { label: 'мм', value: 'mm' }], defaultValue: 'cm', required: true },
    { name: 'priceMode', label: 'Как показывать цену', type: 'select', required: true, defaultValue: 'request', options: [{ label: 'Цена по запросу', value: 'request' }, { label: 'Точная цена', value: 'exact' }, { label: 'Цена от', value: 'from' }] },
    { name: 'price', label: 'Стоимость, ₽', type: 'number', min: 0, admin: { condition: data => data.priceMode !== 'request' }, validate: (value, { data }) => data?.priceMode === 'request' || (typeof value === 'number' && value >= 0) || 'Укажите стоимость.' },
    { name: 'currency', label: 'Валюта', type: 'select', options: ['RUB'], defaultValue: 'RUB', required: true, admin: { readOnly: true } },
    { name: 'availability', label: 'Наличие', type: 'select', defaultValue: 'order', required: true, options: [{ label: 'Под заказ', value: 'order' }, { label: 'В наличии', value: 'stock' }, { label: 'Продано', value: 'sold' }] },
    { name: 'leadTime', label: 'Срок изготовления', type: 'text' }, { name: 'options', label: 'Варианты исполнения', type: 'textarea' },
    { name: 'featured', label: 'На главной', type: 'checkbox' }, { name: 'demo', label: 'Демонстрационный предмет', type: 'checkbox', defaultValue: false }, order, seoFields],
}
export const Showrooms: CollectionConfig = {
  slug: 'showrooms', labels: { singular: 'Шоурум', plural: 'Шоурумы' }, admin: { useAsTitle: 'title', group: 'Контент' }, access, versions,
  fields: [title, slug, { name: 'city', label: 'Город', type: 'text', required: true }, { name: 'address', label: 'Адрес', type: 'text', required: true }, { name: 'hours', label: 'Время работы', type: 'text' }, { name: 'contacts', label: 'Контакты', type: 'textarea' }, gallery, { name: 'routeURL', label: 'Ссылка на маршрут', type: 'text', validate: safeURL, admin: { description: 'Проверьте ссылку перед публикацией. Карта открывается только по нажатию.' } }, { name: 'items', label: 'Предметы в шоуруме', type: 'relationship', relationTo: 'items', hasMany: true }, order],
}
const documentTypes = [{ label: 'Политика', value: 'privacy' }, { label: 'Согласие', value: 'consent' }, { label: 'Оферта', value: 'offer' }, { label: 'Доставка и оплата', value: 'delivery' }, { label: 'Возврат и гарантия', value: 'returns' }, { label: 'Реквизиты', value: 'details' }, { label: 'Cookie', value: 'cookies' }]
export const Documents: CollectionConfig = {
  slug: 'documents', labels: { singular: 'Документ', plural: 'Документы' }, admin: { useAsTitle: 'title', group: 'Контент', ...previews('/documents') }, access, versions,
  hooks: { beforeChange: [stableDocumentSlug], afterChange: [preserveRevision] },
  fields: [title, slug, { name: 'type', label: 'Тип документа', type: 'select', required: true, options: documentTypes }, body, { name: 'editionDate', label: 'Дата редакции', type: 'date', required: true }, { name: 'effectiveDate', label: 'Дата вступления в силу', type: 'date' }, { name: 'pdf', label: 'PDF', type: 'upload', relationTo: 'pdfs' }, { name: 'showInFooter', label: 'Показывать в подвале', type: 'checkbox', defaultValue: true }, order],
}
export const Revisions: CollectionConfig = {
  slug: 'document-revisions', labels: { singular: 'Опубликованная редакция', plural: 'Опубликованные редакции' },
  admin: { hidden: true }, access: { read: editor, create: () => false, update: () => false, delete: () => false },
  fields: [{ name: 'document', label: 'Документ', type: 'relationship', relationTo: 'documents', required: true }, title, { ...slug, unique: false }, { name: 'type', label: 'Тип', type: 'select', options: documentTypes }, body, { name: 'pdf', label: 'PDF', type: 'upload', relationTo: 'pdfs' }, { name: 'publishedAt', label: 'Опубликовано', type: 'date', required: true }],
}
export const Inquiries: CollectionConfig = {
  slug: 'inquiries', labels: { singular: 'Заявка', plural: 'Заявки' }, admin: { useAsTitle: 'name', group: 'Обращения', defaultColumns: ['name', 'contact', 'status', 'createdAt'] },
  access: { read: editor, create: () => false, update: editor, delete: developer },
  fields: [{ name: 'item', label: 'Предмет', type: 'relationship', relationTo: 'items' }, { name: 'name', label: 'Имя', type: 'text', required: true }, { name: 'contact', label: 'Контакт', type: 'text', required: true }, { name: 'channel', label: 'Способ связи', type: 'select', options: [{ label: 'Email', value: 'email' }, { label: 'Телефон', value: 'phone' }], required: true }, { name: 'message', label: 'Сообщение', type: 'textarea' }, { name: 'consent', label: 'Согласие дано', type: 'checkbox', required: true }, { name: 'consentRevision', label: 'Неизменяемая редакция согласия', type: 'relationship', relationTo: 'document-revisions', required: true }, { name: 'privacyRevision', label: 'Неизменяемая редакция политики', type: 'relationship', relationTo: 'document-revisions', required: true }, { name: 'status', label: 'Обработка', type: 'select', defaultValue: 'new', options: [{ label: 'Новая', value: 'new' }, { label: 'В работе', value: 'progress' }, { label: 'Завершена', value: 'done' }] }],
}
export const RateLimits: CollectionConfig = {
  slug: 'rate-limits', admin: { hidden: true }, access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [{ name: 'key', type: 'text', unique: true, required: true }, { name: 'count', type: 'number', required: true }, { name: 'expiresAt', type: 'date', required: true }],
}
