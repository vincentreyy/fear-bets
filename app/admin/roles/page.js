import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getRolesList, getUserRoleCounts } from "@/lib/data/roles";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoles } from "@/components/AdminExtra";

export default async function AdminRolesPage() {
  await requirePermissionOrRedirect("manage_roles");
  const roles = await getRolesList();
  const users = await getUserRoleCounts();

  return (
    <ErrorBoundary>
      <AdminRoles S={{ roles, users }} />
    </ErrorBoundary>
  );
}
