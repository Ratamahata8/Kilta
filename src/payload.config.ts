import path from 'node:path'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { ru } from '@payloadcms/translations/languages/ru'
import sharp from 'sharp'
import { Users, Media, PDFs, Categories, Items, Showrooms, Documents, Revisions, Inquiries, RateLimits } from './collections'
import { Home, Workshop, Appearance, Contacts, Navigation, SEO } from './globals'
if (existsSync('.env')) loadEnvFile('.env')
const required = ['DATABASE_URI', 'PAYLOAD_SECRET', 'NEXT_PUBLIC_SERVER_URL'] as const
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`)
if (process.env.PAYLOAD_SECRET!.length < 32) throw new Error('PAYLOAD_SECRET must contain at least 32 characters')
const serverURL = new URL(process.env.NEXT_PUBLIC_SERVER_URL!).origin
const s3 = process.env.S3_BUCKET
if (s3) for (const key of ['S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) if (!process.env[key]) throw new Error(`Missing ${key}`)
export default buildConfig({
  serverURL,
  secret: process.env.PAYLOAD_SECRET!,
  admin: { user: 'users', importMap: { baseDir: path.resolve('src') }, meta: { titleSuffix: '— KILTA' } },
  i18n: { supportedLanguages: { ru }, fallbackLanguage: 'ru' },
  collections: [Users, Media, PDFs, Categories, Items, Showrooms, Documents, Revisions, Inquiries, RateLimits],
  globals: [Home, Workshop, Appearance, Contacts, Navigation, SEO],
  editor: lexicalEditor(), sharp,
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI }, push: false, migrationDir: path.resolve('src/migrations') }),
  typescript: { outputFile: path.resolve('src/payload-types.ts') },
  cors: [serverURL], csrf: [serverURL],
  upload: { limits: { fileSize: 20 * 1024 * 1024 }, abortOnLimit: true },
  plugins: s3 ? [s3Storage({ bucket: s3, collections: { media: { prefix: 'images' }, pdfs: { prefix: 'pdfs' } }, config: { region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: Boolean(process.env.S3_ENDPOINT), credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } } })] : [],
})
