import { requireUserOrRedirect } from "@/lib/pageGuards";
import { getMyBalanceAndTx, getMyPendingWinWd } from "@/lib/data/wallet";
import { getPoolBets } from "@/lib/data/bets";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Wallet } from "@/components/UserScreens";

export default async function WalletPage() {
  const user = await requireUserOrRedirect();
  const { balance, tx } = await getMyBalanceAndTx(user.id);
  const rawBets = await getPoolBets();
  const bets = rawBets.map(b => b.uid === user.id ? { ...b, uid: "me" } : b);
  const { pendingWin, pendingWd, myWithdrawals } = await getMyPendingWinWd(user.id);

  return (
    <ErrorBoundary>
      <Wallet S={{ balance, tx, bets, pendingWin, pendingWd, myWithdrawals }} sessionUser={user} />
    </ErrorBoundary>
  );
}
