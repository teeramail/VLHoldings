import { type NextRequest, NextResponse } from "next/server";

const ACCESS_MODES = ["public", "signed_in", "anon_create", "closed"] as const;
type AccessMode = (typeof ACCESS_MODES)[number];

function getMode(): AccessMode {
  const raw = process.env.PROJECT_ACCESS_MODE?.trim();
  return (ACCESS_MODES as readonly string[]).includes(raw ?? "")
    ? (raw as AccessMode)
    : "public";
}

function hasPasswordSession(req: NextRequest) {
  const s = req.cookies.get("dashboard_session");
  return s?.value === "authenticated";
}

function hasGoogleSession(req: NextRequest) {
  // NextAuth v5 default session cookie names.
  return (
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("next-auth.session-token") ??
    req.cookies.get("__Secure-next-auth.session-token")
  ) !== undefined;
}

export function middleware(req: NextRequest) {
  const mode = getMode();
  const hasOwner = hasPasswordSession(req);
  const hasGoogle = hasGoogleSession(req);
  const validEmail = process.env.VALID_EMAIL?.trim() ?? "";

  const path = req.nextUrl.pathname;

  // `closed` -> only owner allowed anywhere in the matcher
  if (mode === "closed") {
    if (!hasOwner) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", path);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // `signed_in` -> need Google OR password session
  if (mode === "signed_in") {
    if (!hasOwner && !hasGoogle) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", path);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // `public` / `anon_create` -> still gate `/dashboard` behind the legacy
  // owner password if VALID_EMAIL is configured (backwards-compat), unless
  // the visitor has a Google session.
  if (path.startsWith("/dashboard")) {
    if (!validEmail) return NextResponse.next();
    if (hasOwner || hasGoogle) return NextResponse.next();
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/cards/:path*"],
};
