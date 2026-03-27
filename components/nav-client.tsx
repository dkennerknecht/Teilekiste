"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brand } from "@/components/brand";

type NavClientProps = {
  role: string;
  recentLabels: string[];
};

export function NavClient({ role, recentLabels }: NavClientProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false);

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
          <Link href="/" className="min-w-0 flex-1 text-workshop-800" onClick={closeMobileMenu}>
            <Brand textClassName="text-base font-semibold text-workshop-800 sm:text-lg" />
          </Link>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <Link className="btn-secondary" href="/items/new">
              Neues Item
            </Link>
            <Link className="btn-secondary" href="/inventory">
              Inventur
            </Link>
            <Link className="btn-secondary" href="/archive">
              Archiv
            </Link>
            <Link className="btn-secondary" href="/locations">
              Lagerorte
            </Link>
            <Link className="btn-secondary" href="/shopping">
              Einkaufsliste
            </Link>
            <Link className="btn-secondary" href="/scanner">
              Scanner
            </Link>
            {role === "ADMIN" && (
              <details className="relative">
                <summary className="btn-secondary list-none cursor-pointer">Admin</summary>
                <div className="absolute right-0 top-full z-20 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-2 shadow-lg">
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/admin">
                    Admin
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/admin/audit">
                    Audit
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/trash">
                    Papierkorb
                  </Link>
                  <div className="my-1 border-t border-workshop-200" />
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/api/export/csv">
                    CSV Export
                  </a>
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/api/export/json">
                    JSON Export
                  </a>
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100" href="/api/export/ptouch">
                    P-touch CSV
                  </a>
                </div>
              </details>
            )}
          </div>

          <form action="/" className="order-3 w-full lg:order-none lg:ml-auto lg:max-w-sm lg:flex-1">
            <input
              className="input"
              type="text"
              name="q"
              placeholder="Code oder Name suchen (z.B. EL-KB-023)"
            />
          </form>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <Link className="btn-secondary" href="/api/auth/signout">
              Logout
            </Link>
          </div>

          <div className="w-full lg:hidden">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              Menue
            </button>
            {mobileMenuOpen && (
              <div
                id="mobile-menu"
                className="mt-2 flex flex-col gap-2 rounded-xl border border-workshop-200 bg-workshop-50 p-3"
              >
                <Link className="btn-secondary w-full" href="/" onClick={closeMobileMenu}>
                  Inventory
                </Link>
                <Link className="btn-secondary w-full" href="/items/new" onClick={closeMobileMenu}>
                  Neues Item
                </Link>
                <Link className="btn-secondary w-full" href="/inventory" onClick={closeMobileMenu}>
                  Inventur
                </Link>
                <Link className="btn-secondary w-full" href="/archive" onClick={closeMobileMenu}>
                  Archiv
                </Link>
                <Link className="btn-secondary w-full" href="/locations" onClick={closeMobileMenu}>
                  Lagerorte
                </Link>
                <Link className="btn-secondary w-full" href="/shopping" onClick={closeMobileMenu}>
                  Einkaufsliste
                </Link>
                <Link className="btn-secondary w-full" href="/scanner" onClick={closeMobileMenu}>
                  Scanner
                </Link>
                {role === "ADMIN" && (
                  <div className="mt-1 border-t border-workshop-200 pt-3">
                    <button
                      type="button"
                      className="btn-secondary w-full justify-between"
                      onClick={() => setMobileAdminOpen((open) => !open)}
                      aria-expanded={mobileAdminOpen}
                    >
                      <span>Admin</span>
                      <span>{mobileAdminOpen ? "-" : "+"}</span>
                    </button>
                    {mobileAdminOpen && (
                      <div className="mt-2 flex flex-col gap-2">
                        <Link className="btn-secondary w-full" href="/admin" onClick={closeMobileMenu}>
                          Admin
                        </Link>
                        <Link className="btn-secondary w-full" href="/admin/audit" onClick={closeMobileMenu}>
                          Audit
                        </Link>
                        <Link className="btn-secondary w-full" href="/trash" onClick={closeMobileMenu}>
                          Papierkorb
                        </Link>
                        <a className="btn-secondary w-full" href="/api/export/csv" onClick={closeMobileMenu}>
                          CSV Export
                        </a>
                        <a className="btn-secondary w-full" href="/api/export/json" onClick={closeMobileMenu}>
                          JSON Export
                        </a>
                        <a className="btn-secondary w-full" href="/api/export/ptouch" onClick={closeMobileMenu}>
                          P-touch CSV
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Link className="btn-secondary flex-1" href="/api/auth/signout" onClick={closeMobileMenu}>
                    Logout
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {recentLabels.length > 0 && (
        <div className="mx-auto max-w-7xl px-3 pb-2 text-xs text-workshop-700 sm:px-4">
          Zuletzt genutzt: {recentLabels.join(", ")}
        </div>
      )}
    </header>
  );
}
