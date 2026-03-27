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
    <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
      <h3 className="mb-3 text-lg font-semibold text-[var(--app-text)]">Audit History</h3>
      <ul className="space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-workshop-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.summary}</p>
              <span className="theme-muted">
                {new Date(entry.createdAt).toLocaleString("de-DE")}
              </span>
            </div>
            <p className="theme-muted mt-1">
              {entry.action}
              {entry.user ? ` • ${entry.user.name || entry.user.email}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
