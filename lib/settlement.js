// Pure parimutuel settlement math — no DB access, so it's cheap to call
// twice (once for a preview, once for real) and easy to unit test.
//
// Handles two shapes of race:
//   - a normal race: a full classification (position per finisher, DNS/DNF/
//     DSQ for the rest) decides P1 and, for DNS entrants, a stake refund.
//   - a season/outright market (race.kind === "season"): there's no
//     classification, just a single champion entrant id.
//
// `ruling` is one of "settle_as_entered" | "adjust" | "hold" | "void_race".
// "settle_as_entered" and "adjust" compute identically — the caller is
// responsible for having already baked any on-track-order override into
// `classifications`/`champion` before calling this; the ruling type only
// affects what gets written to the audit log, not the math.
export function computeSettlement({
  race,
  season = false,
  champion = null,
  classifications = [],
  bets = [],
  pointsScale = [],
  flBonus = 0,
  fastestLapEntrantId = null,
  driverTeamMap = null,
  ruling,
}) {
  const totalPool = bets.reduce((s, b) => s + b.stake, 0);

  if (ruling === "hold") {
    return { held: true, voided: false, totalPool };
  }

  if (ruling === "void_race") {
    const refunds = bets.map(b => ({ betId: b.id, userId: b.userId, amount: b.stake }));
    return {
      held: false, voided: true, season,
      refunds, winners: [], loserBetIds: [], pointsAwards: [], constructorPointsAwards: [],
      totalPool, netPool: 0, rakeAmount: 0,
    };
  }

  const rakePct = race.rakePct || 0;

  if (season) {
    const winnerBets = bets.filter(b => b.entrantId === champion);
    const winPool = winnerBets.reduce((s, b) => s + b.stake, 0);
    const net = totalPool * (1 - rakePct / 100);
    const winners = winnerBets.map(b => ({
      betId: b.id, userId: b.userId, entrantId: b.entrantId,
      amount: winPool ? Math.round(net * b.stake / winPool) : 0,
    }));
    const loserBetIds = bets.filter(b => b.entrantId !== champion).map(b => b.id);
    return {
      held: false, voided: false, season: true,
      champion, winners, loserBetIds,
      refunds: [], pointsAwards: [], constructorPointsAwards: [],
      totalPool, netPool: net, rakeAmount: totalPool - net,
    };
  }

  // Non-runners (DNS) are refunded like a whole-race void, scoped to just
  // their backers; DNF and DSQ settle as ordinary losing bets.
  const nonRunners = classifications.filter(c => c.status === "dns").map(c => c.entrantId);
  const refundBets = bets.filter(b => nonRunners.includes(b.entrantId));
  const refunds = refundBets.map(b => ({ betId: b.id, userId: b.userId, amount: b.stake }));
  const refundStake = refunds.reduce((s, r) => s + r.amount, 0);

  const settlingPool = totalPool - refundStake;
  const net = settlingPool * (1 - rakePct / 100);

  const order = classifications
    .filter(c => c.status === "finished" && c.position != null)
    .sort((a, b) => a.position - b.position)
    .map(c => c.entrantId);

  const p1 = order[0] || null;
  const winnerBets = p1 ? bets.filter(b => b.entrantId === p1) : [];
  const winPool = winnerBets.reduce((s, b) => s + b.stake, 0);
  const winners = winnerBets.map(b => ({
    betId: b.id, userId: b.userId, entrantId: b.entrantId,
    amount: winPool ? Math.round(net * b.stake / winPool) : 0,
  }));

  const loserBetIds = bets
    .filter(b => !nonRunners.includes(b.entrantId) && b.entrantId !== p1)
    .map(b => b.id);

  let pointsAwards = [];
  let constructorPointsAwards = [];
  if (race.countsDrivers || race.countsConstructors) {
    const perEntrant = order.map((entrantId, i) => {
      const base = pointsScale[i] || 0;
      const bonus = fastestLapEntrantId === entrantId ? (flBonus || 0) : 0;
      return { entrantId, points: base + bonus };
    }).filter(p => p.points > 0);

    if (race.countsDrivers) pointsAwards = perEntrant;

    if (race.countsConstructors && driverTeamMap) {
      const byTeam = {};
      for (const p of perEntrant) {
        const teamId = driverTeamMap[p.entrantId];
        if (!teamId) continue;
        byTeam[teamId] = (byTeam[teamId] || 0) + p.points;
      }
      constructorPointsAwards = Object.entries(byTeam).map(([teamId, points]) => ({ teamId, points }));
    }
  }

  return {
    held: false, voided: false, season: false,
    p1, order, nonRunners,
    refunds, refundStake,
    winners, loserBetIds,
    pointsAwards, constructorPointsAwards,
    totalPool, netPool: net, rakeAmount: settlingPool - net,
  };
}
