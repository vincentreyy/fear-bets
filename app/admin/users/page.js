import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getUsersList } from "@/lib/data/users";
import { getRolesList } from "@/lib/data/roles";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminUsers } from "@/components/AdminExtra";

export default async function AdminUsersPage() {
  await requirePermissionOrRedirect("manage_users");
  const users = await getUsersList();
  const roles = await getRolesList();

  return (
    <ErrorBoundary>
      <AdminUsers S={{ users, roles }} />
    </ErrorBoundary>
  );
}
