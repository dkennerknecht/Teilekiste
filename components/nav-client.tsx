"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brand } from "@/components/brand";
import { useAppLanguage } from "@/components/app-language-provider";

type NavClientProps = {
  role: string;
  recentLabels: string[];
};

export function NavClient({ role, recentLabels }: NavClientProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);
  const { t } = useAppLanguage();

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setMobileAdminOpen(false);
  }

  useEffect(() => {
    closeMobileMenu();
  }, [pathname]);

  return (
    <header className="border-b border-workshop-200 bg-[var(--app-surface)]">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href="/"
              className="inline-flex max-w-full text-workshop-800"
              onClick={closeMobileMenu}
              aria-label="Zur Startseite"
              title="Startseite"
            >
              <Brand textClassName="text-base font-semibold text-workshop-800 sm:text-lg" />
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-workshop-300 bg-[var(--app-surface)] text-workshop-800 shadow-sm lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Menue schliessen" : "Menue oeffnen"}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <Link className="btn-secondary" href="/items/new">
              {t("navNewItem")}
            </Link>
            <Link className="btn-secondary" href="/inventory">
              {t("navInventoryAudit")}
            </Link>
            <Link className="btn-secondary" href="/archive">
              {t("navArchive")}
            </Link>
            <Link className="btn-secondary" href="/locations">
              {t("navLocations")}
            </Link>
            <Link className="btn-secondary" href="/shopping">
              {t("navShopping")}
            </Link>
            <Link className="btn-secondary" href="/scanner">
              {t("navScanner")}
            </Link>
            {role === "ADMIN" && (
              <details className="relative">
                <summary className="btn-secondary list-none cursor-pointer">{t("navAdmin")}</summary>
                <div className="absolute right-0 top-full z-20 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-2 shadow-lg">
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/admin">
                    {t("navAdmin")}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/admin/audit">
                    {t("navAudit")}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/trash">
                    {t("navTrash")}
                  </Link>
                  <div className="my-1 border-t border-workshop-200" />
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/api/export/csv">
                    {t("navCsvExport")}
                  </a>
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/api/export/json">
                    {t("navJsonExport")}
                  </a>
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/api/export/ptouch">
                    {t("navPtouchExport")}
                  </a>
                </div>
              </details>
            )}
          </div>

          <form action="/" className="order-2 w-full lg:order-none lg:ml-auto lg:max-w-sm lg:flex-1">
            <input
              className="input"
              type="text"
              name="q"
              placeholder={t("navSearchPlaceholder")}
            />
          </form>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <Link className="btn-secondary" href="/api/auth/signout">
              {t("navLogout")}
            </Link>
          </div>

          {mobileMenuOpen && (
            <div
              id="mobile-menu"
              className="order-4 w-full lg:hidden"
            >
              <div className="mt-1 flex flex-col gap-2 rounded-xl border border-workshop-200 bg-workshop-50 p-3">
                <Link className="btn-secondary w-full" href="/" onClick={closeMobileMenu}>
                  {t("navInventory")}
                </Link>
                <Link className="btn-secondary w-full" href="/items/new" onClick={closeMobileMenu}>
                  {t("navNewItem")}
                </Link>
                <Link className="btn-secondary w-full" href="/inventory" onClick={closeMobileMenu}>
                  {t("navInventoryAudit")}
                </Link>
                <Link className="btn-secondary w-full" href="/archive" onClick={closeMobileMenu}>
                  {t("navArchive")}
                </Link>
                <Link className="btn-secondary w-full" href="/locations" onClick={closeMobileMenu}>
                  {t("navLocations")}
                </Link>
                <Link className="btn-secondary w-full" href="/shopping" onClick={closeMobileMenu}>
                  {t("navShopping")}
                </Link>
                <Link className="btn-secondary w-full" href="/scanner" onClick={closeMobileMenu}>
                  {t("navScanner")}
                </Link>
                {role === "ADMIN" && (
                  <div className="mt-1 border-t border-workshop-200 pt-3">
                    <button
                      type="button"
                      className="btn-secondary w-full justify-between"
                      onClick={() => setMobileAdminOpen((open) => !open)}
                      aria-expanded={mobileAdminOpen}
                    >
                      <span>{t("navAdmin")}</span>
                      <span>{mobileAdminOpen ? "-" : "+"}</span>
                    </button>
                    {mobileAdminOpen && (
                      <div className="mt-2 flex flex-col gap-2">
                        <Link className="btn-secondary w-full" href="/admin" onClick={closeMobileMenu}>
                          {t("navAdmin")}
                        </Link>
                        <Link className="btn-secondary w-full" href="/admin/audit" onClick={closeMobileMenu}>
                          {t("navAudit")}
                        </Link>
                        <Link className="btn-secondary w-full" href="/trash" onClick={closeMobileMenu}>
                          {t("navTrash")}
                        </Link>
                        <a className="btn-secondary w-full" href="/api/export/csv" onClick={closeMobileMenu}>
                          {t("navCsvExport")}
                        </a>
                        <a className="btn-secondary w-full" href="/api/export/json" onClick={closeMobileMenu}>
                          {t("navJsonExport")}
                        </a>
                        <a className="btn-secondary w-full" href="/api/export/ptouch" onClick={closeMobileMenu}>
                          {t("navPtouchExport")}
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Link className="btn-secondary flex-1" href="/api/auth/signout" onClick={closeMobileMenu}>
                    {t("navLogout")}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {recentLabels.length > 0 && (
        <div className="mx-auto max-w-7xl px-3 pb-2 text-xs text-workshop-700 sm:px-4">
          {t("navRecent")}: {recentLabels.join(", ")}
        </div>
      )}
    </header>
  );
}
