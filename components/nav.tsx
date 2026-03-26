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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="text-workshop-800 dark:text-[#e6ebf2]">
          <Brand textClassName="text-lg font-semibold text-workshop-800 dark:text-[#e6ebf2]" />
        </Link>
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
          <>
            <Link className="btn-secondary" href="/admin">
              Admin
            </Link>
            <Link className="btn-secondary" href="/trash">
              Papierkorb
            </Link>
          </>
        )}
        <form action="/" className="ml-auto min-w-[220px] flex-1 sm:max-w-sm">
          <input
            className="input"
            type="text"
            name="q"
            placeholder="Code oder Name suchen (z.B. EL-KB-023)"
          />
        </form>
        <ThemeToggle />
        <Link className="btn-secondary" href="/api/auth/signout">
          Logout
        </Link>
      </div>
      {recent.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-2 text-xs text-workshop-700 dark:text-[#b6bfce]">
          Zuletzt genutzt: {recent.map((row) => row.item.labelCode).join(", ")}
        </div>
      )}
    </header>
  );
}
