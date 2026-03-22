declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "ADMIN" | "READ_WRITE" | "READ";
    };
  }

  interface User {
    role: "ADMIN" | "READ_WRITE" | "READ";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "READ_WRITE" | "READ";
  }
}
