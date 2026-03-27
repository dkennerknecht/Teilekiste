"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { AppLanguageProvider } from "@/components/app-language-provider";

export function Providers({ children, initialLanguage }: { children: ReactNode; initialLanguage?: string }) {
  return (
    <SessionProvider>
      <AppLanguageProvider initialLanguage={initialLanguage}>{children}</AppLanguageProvider>
    </SessionProvider>
  );
}
