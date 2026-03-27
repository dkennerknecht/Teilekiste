import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavClient } from "@/components/nav-client";

export async function Nav() {
  const user = await getSessionUser();
  if (!user) return null;

  const recent = await prisma.recentView.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { lastViewedAt: "desc" },
    take: 5
  });

  return <NavClient role={user.role} recentLabels={recent.map((row) => row.item.labelCode)} />;
}
