import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, updateSession } from "@/lib/session";

const adminRoutes = ["/admin"];
const protectedRoutes = ["/student", "/admin"];
const publicRoutes = ["/login"];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = request.cookies.get("session")?.value;
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route),
  );

  if (path === "/" && session) {
    const data = await getSession(session);
    if (!data) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const home = data.role === "admin" ? "/admin" : "/student";
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (path === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isProtectedRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (publicRoutes.includes(path) && session) {
    const data = await getSession(session);
    if (!data) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const home = data.role === "admin" ? "/admin" : "/student";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
