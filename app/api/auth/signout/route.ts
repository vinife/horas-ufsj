import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { deleteSession } from "@/lib/session"

function clearAuthCookies(response: NextResponse) {
  const expired = new Date(0)
  for (const name of [
    "session",
    "oauth_state_google",
    "oauth_nonce_google",
    "oauth_pkce_google",
  ]) {
    response.cookies.set({
      name,
      value: "",
      expires: expired,
      path: "/",
      httpOnly: name === "session",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    })
  }
}

async function signout(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value
  if (sessionId) {
    await deleteSession(sessionId)
  }
}

export async function GET(request: NextRequest) {
  await signout(request)

  const response = NextResponse.redirect(new URL("/login", request.url))
  clearAuthCookies(response)
  return response
}

export async function POST(request: NextRequest) {
  await signout(request)

  const response = NextResponse.json({ ok: true }, { status: 200 })
  clearAuthCookies(response)
  return response
}
