import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/permissions";

// Page/layout-level auth guards. Unlike requireUser()/requirePermission()
// in lib/permissions.js (which throw, for Server Actions to turn into
// {ok:false} responses), these redirect — the right behavior for a
// Server Component that's rendering a whole page.

export async function requireUserOrRedirect(to = "/login") {
  const user = await getOptionalUser();
  if (!user) redirect(to);
  return user;
}

export async function requirePermissionOrRedirect(perm, { to = "/admin" } = {}) {
  const user = await requireUserOrRedirect("/login");
  if (!user.role || !user.role.perms.includes(perm)) redirect(to);
  return user;
}

export async function requireAnyPermissionOrRedirect(perms, { to = "/dashboard" } = {}) {
  const user = await requireUserOrRedirect("/login");
  if (!user.role || !perms.some(p => user.role.perms.includes(p))) redirect(to);
  return user;
}
