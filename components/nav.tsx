import { getSessionUser } from "@/lib/auth";
import { NavClient } from "@/components/nav-client";

export async function Nav() {
  const user = await getSessionUser();
  if (!user) return null;

  return <NavClient role={user.role} />;
}
