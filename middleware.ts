import { withAuth } from "next-auth/middleware";
import { readE2eBypassRoleFromRequest } from "@/lib/e2e-auth";

export default withAuth(
  function middleware() {},
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        const bypassRole = readE2eBypassRoleFromRequest(req);
        if (bypassRole) {
          if (path.startsWith("/admin")) return bypassRole === "ADMIN";
          if (path.startsWith("/api/admin")) return bypassRole === "ADMIN";
          return true;
        }
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
