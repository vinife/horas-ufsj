import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession } from "@/lib/session"

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value
  if (!sessionId) return NextResponse.json({ user: null }, { status: 200 })

  const session = await getSession(sessionId)
  if (!session) return NextResponse.json({ user: null }, { status: 200 })

  return NextResponse.json(
    {
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        role: session.role,
        isMasterAdmin: Boolean(session.isMasterAdmin),
      },
    },
    { status: 200 },
  )
}
