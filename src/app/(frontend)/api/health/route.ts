import { cms } from '@/lib/cms'
export const dynamic = 'force-dynamic'
export async function GET() { try { await (await cms()).count({ collection: 'categories', overrideAccess: true }); return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } }) } catch { return Response.json({ status: 'unavailable' }, { status: 503 }) } }
