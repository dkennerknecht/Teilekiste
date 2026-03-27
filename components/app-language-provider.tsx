"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppLanguage, AppMessageKey, normalizeAppLanguage, translateAppMessage } from "@/lib/app-language";

type AppLanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: AppMessageKey) => string;
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

export function AppLanguageProvider({ initialLanguage, children }: { initialLanguage?: string; children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(normalizeAppLanguage(initialLanguage));

  useEffect(() => {
    try {
      const storedLanguage = normalizeAppLanguage(window.localStorage.getItem("app-language"));
      setLanguageState((currentLanguage) => (currentLanguage === storedLanguage ? currentLanguage : storedLanguage));
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem("app-language", language);
    } catch {}
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/app-config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.language) return;
        const nextLanguage = normalizeAppLanguage(data.language);
        setLanguageState(nextLanguage);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AppLanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => setLanguageState(normalizeAppLanguage(nextLanguage)),
      t: (key) => translateAppMessage(language, key)
    }),
    [language]
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(AppLanguageContext);
  if (!context) {
    throw new Error("useAppLanguage must be used within AppLanguageProvider");
  }
  return context;
}
