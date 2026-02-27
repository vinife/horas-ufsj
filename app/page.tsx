import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"

export default async function Home() {
  const sessionId = (await cookies()).get("session")?.value
  if (!sessionId) redirect("/login")

  const session = await getSession(sessionId)
  if (!session) redirect("/login")

  redirect(session.role === "admin" ? "/admin" : "/student")
}
