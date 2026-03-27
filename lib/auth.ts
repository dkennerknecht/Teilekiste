import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession } from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/permissions";

export const authOptions = {
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

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
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
