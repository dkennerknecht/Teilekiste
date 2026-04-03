import { NextRequest, NextResponse } from "next/server";
import { getSessionTokenPayloadFromRequest } from "@/lib/auth-token";
import { readE2eBypassRoleFromRequest } from "@/lib/e2e-auth";
import { getRequestOrigin } from "@/lib/request-origin";

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/auth/signin", `${getRequestOrigin(request)}/`);
  signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const bypassRole = readE2eBypassRoleFromRequest(request);

  if (bypassRole) {
    if (isAdminPath(pathname) && bypassRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", `${getRequestOrigin(request)}/`));
    }
    return NextResponse.next();
  }

  const token = await getSessionTokenPayloadFromRequest(request);
  if (!token) return redirectToSignIn(request);

  if (isAdminPath(pathname) && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", `${getRequestOrigin(request)}/`));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth/signin|.*\\..*).*)"]
};
