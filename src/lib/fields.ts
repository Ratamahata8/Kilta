import type { Field } from 'payload'
export const title: Field = { name: 'title', label: 'Название', type: 'text', required: true }
export const slug: Field = { name: 'slug', label: 'Адрес страницы', type: 'text', unique: true, required: true, index: true, admin: { description: 'Латинские буквы, цифры и дефисы. Например: derevyannaya-skulptura.' }, validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Используйте латинские буквы, цифры и дефисы.' }
export const order: Field = { name: 'order', label: 'Порядок', type: 'number', defaultValue: 0 }
export const image: Field = { name: 'image', label: 'Основное изображение', type: 'upload', relationTo: 'media' }
export const gallery: Field = { name: 'gallery', label: 'Галерея', type: 'array', fields: [{ name: 'image', label: 'Изображение', type: 'upload', relationTo: 'media', required: true }], admin: { description: 'Добавьте фотографии и перетаскивайте строки, чтобы менять порядок.' } }
export const seoFields: Field = { name: 'seo', label: 'Поисковые системы', type: 'group', fields: [{ name: 'title', label: 'Заголовок', type: 'text' }, { name: 'description', label: 'Описание', type: 'textarea', maxLength: 300 }] }
export const body: Field = { name: 'body', label: 'Текст', type: 'richText' }
export function safeURL(value: unknown) {
  if (!value) return true
  try { return ['https:', 'http:'].includes(new URL(String(value)).protocol) || 'Нужна ссылка https:// или http://' } catch { return 'Введите полный адрес ссылки.' }
}
export const pageOptions = [
  { label: 'Главная', value: '/' }, { label: 'Каталог', value: '/catalog' },
  { label: 'Мастерская', value: '/workshop' }, { label: 'Шоурумы', value: '/showrooms' }, { label: 'Контакты', value: '/contacts' },
]
