// Pure payload shaping for confirmSettlement(), extracted from the old
// App.jsx act("settle", ...) case so AdminSettle can call the Server
// Action directly via useServerAction() without inlining this logic.
export function buildSettlementInput(payload) {
  const race = payload.race;
  const isSeason = race.kind === "season";
  const classifications = isSeason ? [] : race.drivers.map(id => {
    const pos = payload.order.indexOf(id);
    if (pos > -1) return { entrantId: id, position: pos + 1, status: "finished" };
    const r = payload.retired.find(x => x.id === id);
    return { entrantId: id, position: null, status: r ? r.st : "dns", reason: r ? r.why : undefined };
  });
  const rulingMap = { settle: "settle_as_entered", adjust: "adjust", hold: "hold", void: "void_race" };
  return {
    raceId: race.id, season: isSeason,
    champion: isSeason ? payload.p1 : null,
    classifications,
    fastestLapEntrantId: payload.fl || null,
    ruling: rulingMap[payload.ruling] || payload.ruling,
    reason: payload.reason,
  };
}
