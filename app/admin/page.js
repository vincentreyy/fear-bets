import { getOptionalUser } from "@/lib/permissions";
import { getRaceList } from "@/lib/data/races";
import { getPoolBets } from "@/lib/data/bets";
import { getDepositQueue, getWinQueue, getWithdrawalQueue } from "@/lib/data/adminQueues";
import { getCirculationTotal, getWithdrawnAllTime, getAuditLogRecent } from "@/lib/data/adminDash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminDash } from "@/components/AdminScreens";

export default async function AdminDashPage() {
  // Already verified as "some admin role" by app/admin/layout.js; re-derive
  // perms here to decide which cards this specific admin gets to see.
  const user = await getOptionalUser();
  const perms = user.role.perms;
  const has = p => perms.includes(p);

  const races = await getRaceList();
  const bets = await getPoolBets();
  const depQueue = has("approve_deposits") ? await getDepositQueue() : null;
  const winQueue = has("approve_payouts") ? await getWinQueue() : null;
  const wdQueue = has("approve_withdrawals") ? await getWithdrawalQueue() : null;
  const circulationTotal = await getCirculationTotal();
  const withdrawnAllTime = await getWithdrawnAllTime();
  const audit = has("view_audit_log") ? await getAuditLogRecent() : null;

  return (
    <ErrorBoundary>
      <AdminDash S={{ races, bets, depQueue, winQueue, wdQueue, circulationTotal, withdrawnAllTime, audit }} sessionUser={user} />
    </ErrorBoundary>
  );
}
