import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {},
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (!token) return false;
        const role = token.role as string;

        if (path.startsWith("/admin")) return role === "ADMIN";
        if (path.startsWith("/api/admin")) return role === "ADMIN";
        return true;
      }
    }
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth/signin|.*\\..*).*)"]
};
