import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getRosterAndTeams } from "@/lib/data/roster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoster } from "@/components/AdminRoster";

export default async function AdminRosterPage() {
  await requirePermissionOrRedirect("manage_championships");
  const { roster, teams } = await getRosterAndTeams();

  return (
    <ErrorBoundary>
      <AdminRoster S={{ roster, teams }} />
    </ErrorBoundary>
  );
}
