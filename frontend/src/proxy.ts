import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "access_token";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const onLogin = pathname === "/login";

  if (!onLogin && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (onLogin && hasSession && !searchParams.has("reason")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};