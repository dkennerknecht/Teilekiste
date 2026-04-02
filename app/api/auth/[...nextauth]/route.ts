import NextAuth from "next-auth/next";
import type { NextRequest } from "next/server";
import { createAuthOptions } from "@/lib/auth";
import { getRequestOrigin } from "@/lib/request-origin";

type RouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

async function handler(req: NextRequest, context: RouteContext) {
  return NextAuth(req, context, createAuthOptions(getRequestOrigin(req)));
}

export { handler as GET, handler as POST };
