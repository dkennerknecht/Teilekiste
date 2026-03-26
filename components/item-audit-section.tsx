"use client";

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  summary: string;
  user?: { name?: string | null; email?: string | null } | null;
};

export function ItemAuditSection({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return null;

  return (
    <section className="rounded-xl border border-[#d7d7dc] bg-white p-4 dark:border-[#2a313d] dark:bg-[#171d26]">
      <h3 className="mb-3 text-lg font-semibold text-[#1b1d24] dark:text-[#e6ebf2]">Audit History</h3>
      <ul className="space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-[#e6e6eb] p-3 dark:border-[#2f3746]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.summary}</p>
              <span className="text-[#616474] dark:text-[#aab4c7]">
                {new Date(entry.createdAt).toLocaleString("de-DE")}
              </span>
            </div>
            <p className="mt-1 text-[#616474] dark:text-[#aab4c7]">
              {entry.action}
              {entry.user ? ` • ${entry.user.name || entry.user.email}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
