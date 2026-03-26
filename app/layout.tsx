import "@/styles/globals.css";
import { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";

export const metadata = {
  title: "Teilekiste Inventory",
  description: "Werkstatt-Inventarverwaltung",
  icons: {
    icon: "/logo-refined.svg",
    shortcut: "/logo-refined.svg",
    apple: "/logo-refined.svg"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = (stored === 'dark' || stored === 'light') ? stored : (prefersDark ? 'dark' : 'light');
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `
          }}
        />
        <Providers>
          <Nav />
          <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
