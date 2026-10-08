import { draftMode } from 'next/headers'
import { NextResponse } from 'next/server'
import { cms } from '@/lib/cms'
export async function GET(request: Request) {
  const { user } = await (await cms()).auth({ headers: request.headers })
  if (!user || !['owner', 'developer'].includes(user.role)) return NextResponse.json({ error: 'Нужен вход редактора.' }, { status: 403 })
  const path = new URL(request.url).searchParams.get('path') || '/'
  if (!/^\/(?:catalog\/[a-z0-9-]+|documents\/[a-z0-9-]+|workshop|showrooms|contacts)?$/.test(path)) return NextResponse.json({ error: 'Недопустимый путь.' }, { status: 400 })
  ;(await draftMode()).enable()
  return NextResponse.redirect(new URL(path, process.env.NEXT_PUBLIC_SERVER_URL))
}
