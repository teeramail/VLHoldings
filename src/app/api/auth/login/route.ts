import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dashboard_session";
const SESSION_VALUE = "authenticated";

export async function POST(req: NextRequest) {
  const validEmail = process.env.VALID_EMAIL?.trim() ?? "";
  const validPassword = process.env.VALID_PASSWORD ?? "";

  if (!validEmail) {
    return NextResponse.json({ ok: true, authDisabled: true });
  }

  const body = (await req.json()) as { email?: string; password?: string };

  if (body.email === validEmail && body.password === validPassword) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, SESSION_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  }

  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
}
