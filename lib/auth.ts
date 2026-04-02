import { cookies } from "next/headers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession } from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { E2E_EMAIL_COOKIE, E2E_ROLE_COOKIE, isE2eAuthBypassEnabled, parseE2eAuthRole } from "@/lib/e2e-auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/permissions";
import { resolveSameOriginRedirect } from "@/lib/request-origin";

process.env.NEXTAUTH_URL ||= env.NEXTAUTH_URL;
process.env.NEXTAUTH_URL_INTERNAL ||= env.NEXTAUTH_URL_INTERNAL;
process.env.AUTH_TRUST_HOST ||= env.AUTH_TRUST_HOST;

const fallbackAuthOrigin = env.NEXTAUTH_URL || env.APP_BASE_URL || "http://localhost:3000";

export function createAuthOptions(requestOrigin?: string) {
  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" as const },
    pages: { signIn: "/auth/signin" },
    providers: [
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "text" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
          if (!user || !user.isActive) return null;
          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!valid) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as AppRole
          };
        }
      })
    ],
    callbacks: {
      async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
        return resolveSameOriginRedirect(url, requestOrigin || baseUrl, fallbackAuthOrigin);
      },
      async jwt({ token, user }: { token: any; user?: any }) {
        if (user) token.role = (user as { role: string }).role;
        return token;
      },
      async session({ session, token }: { session: any; token: any }) {
        if (session.user) {
          session.user.id = token.sub || "";
          session.user.role = (token.role as AppRole) || "READ";
        }
        return session;
      }
    }
  };
}

export const authOptions = createAuthOptions();

async function resolveE2eBypassUser(roleValue?: string | null, emailValue?: string | null) {
  if (!isE2eAuthBypassEnabled()) return null;

  const role = parseE2eAuthRole(roleValue);
  if (!role) return null;

  const email = emailValue?.trim() || "admin@local";
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  if (user?.isActive) {
    return {
      id: user.id,
      email: user.email,
      role: user.role as AppRole
    };
  }

  return {
    id: `e2e-${email}`,
    email,
    role
  };
}

export async function getE2eBypassUserFromRequestCookies(cookiesLike: { get(name: string): { value: string } | undefined }) {
  return resolveE2eBypassUser(cookiesLike.get(E2E_ROLE_COOKIE)?.value, cookiesLike.get(E2E_EMAIL_COOKIE)?.value);
}

export async function getSessionUser() {
  const cookieStore = cookies();
  const bypassUser = await getE2eBypassUserFromRequestCookies(cookieStore);
  if (bypassUser) return bypassUser;

  const session = (await getServerSession(authOptions)) as { user?: { id?: string; email?: string | null } } | null;
  if (!session?.user?.id || !session.user.email) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: session.user.id }, { email: session.user.email }],
      isActive: true
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role as AppRole
  };
}
