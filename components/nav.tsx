import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brand } from "@/components/brand";

export async function Nav() {
  const user = await getSessionUser();
  if (!user) return null;

  const recent = await prisma.recentView.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { lastViewedAt: "desc" },
    take: 5
  });

  return (
    <header className="border-b border-workshop-200 bg-white dark:border-[#2a313d] dark:bg-[#121822]">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/" className="min-w-0 flex-1 text-workshop-800 dark:text-[#e6ebf2]">
            <Brand textClassName="text-base font-semibold text-workshop-800 sm:text-lg dark:text-[#e6ebf2]" />
          </Link>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <Link className="btn-secondary" href="/items/new">
              Neues Item
            </Link>
            <Link className="btn-secondary" href="/inventory">
              Inventur
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
            {user.role === "ADMIN" && (
              <details className="relative">
                <summary className="btn-secondary list-none cursor-pointer">Admin</summary>
                <div className="absolute right-0 top-full z-20 mt-2 flex w-52 flex-col gap-1 rounded-xl border border-workshop-200 bg-white p-2 shadow-lg dark:border-[#2a313d] dark:bg-[#171d26]">
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100 dark:text-[#e6ebf2] dark:hover:bg-[#222b38]" href="/admin">
                    Admin
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100 dark:text-[#e6ebf2] dark:hover:bg-[#222b38]" href="/admin/audit">
                    Audit
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100 dark:text-[#e6ebf2] dark:hover:bg-[#222b38]" href="/trash">
                    Papierkorb
                  </Link>
                  <div className="my-1 border-t border-workshop-200 dark:border-[#2a313d]" />
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100 dark:text-[#e6ebf2] dark:hover:bg-[#222b38]" href="/api/export/csv">
                    CSV Export
                  </a>
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100 dark:text-[#e6ebf2] dark:hover:bg-[#222b38]" href="/api/export/json">
                    JSON Export
                  </a>
                  <a className="rounded-lg px-3 py-2 text-sm text-workshop-800 hover:bg-workshop-100 dark:text-[#e6ebf2] dark:hover:bg-[#222b38]" href="/api/export/ptouch">
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

          <details className="w-full lg:hidden">
            <summary className="btn-secondary list-none">Menue</summary>
            <div className="mt-2 flex flex-col gap-2 rounded-xl border border-workshop-200 bg-workshop-50 p-3 dark:border-[#2a313d] dark:bg-[#171d26]">
              <Link className="btn-secondary w-full" href="/items/new">
                Neues Item
              </Link>
              <Link className="btn-secondary w-full" href="/inventory">
                Inventur
              </Link>
              <Link className="btn-secondary w-full" href="/locations">
                Lagerorte
              </Link>
              <Link className="btn-secondary w-full" href="/shopping">
                Einkaufsliste
              </Link>
              <Link className="btn-secondary w-full" href="/scanner">
                Scanner
              </Link>
              {user.role === "ADMIN" && (
                <div className="mt-1 border-t border-workshop-200 pt-3 dark:border-[#2a313d]">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-workshop-700 dark:text-[#b6bfce]">
                    Admin
                  </p>
                  <div className="flex flex-col gap-2">
                    <Link className="btn-secondary w-full" href="/admin">
                      Admin
                    </Link>
                    <Link className="btn-secondary w-full" href="/admin/audit">
                      Audit
                    </Link>
                    <Link className="btn-secondary w-full" href="/trash">
                      Papierkorb
                    </Link>
                    <a className="btn-secondary w-full" href="/api/export/csv">
                      CSV Export
                    </a>
                    <a className="btn-secondary w-full" href="/api/export/json">
                      JSON Export
                    </a>
                    <a className="btn-secondary w-full" href="/api/export/ptouch">
                      P-touch CSV
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Link className="btn-secondary flex-1" href="/api/auth/signout">
                  Logout
                </Link>
              </div>
            </div>
          </details>
        </div>
      </div>
      {recent.length > 0 && (
        <div className="mx-auto max-w-7xl px-3 pb-2 text-xs text-workshop-700 sm:px-4 dark:text-[#b6bfce]">
          Zuletzt genutzt: {recent.map((row) => row.item.labelCode).join(", ")}
        </div>
      )}
    </header>
  );
}
