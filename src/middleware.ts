import { type NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const validEmail = process.env.VALID_EMAIL?.trim() ?? "";
  if (!validEmail) {
    return NextResponse.next();
  }

  const session = req.cookies.get("dashboard_session");

  if (!session || session.value !== "authenticated") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
