import { getAuthStrategy } from "@/lib/auth/auth-factory";
import { authProviderSchema } from "@/lib/schemas/auth.schema";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const parseResult = authProviderSchema.safeParse(provider);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Provedor de autenticação inválido." },
      { status: 400 },
    );
  }

  const strategy = getAuthStrategy(provider);
  const { url, cookies } = await strategy.getLoginUrl();
  const res = NextResponse.redirect(url);

  if (cookies && provider === "google") {
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    for (const [name, value] of Object.entries(cookies)) {
      res.cookies.set({
        name,
        value,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires,
      });
    }
  }

  return res;
}
