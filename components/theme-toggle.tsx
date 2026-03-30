"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useAppLanguage } from "@/components/app-language-provider";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  localStorage.setItem("theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }, []);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        applyTheme(next);
      }}
      aria-label={tr("Light/Dark-Modus umschalten", "Toggle light/dark mode")}
      title={tr("Light/Dark-Modus umschalten", "Toggle light/dark mode")}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
