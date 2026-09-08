"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, Dot, Stat, LocalTime } from "./UserScreens";
import { Check } from "./AdminChamp";
import { useEntrantLookup } from "@/lib/entrantContext";
import { useServerAction } from "@/lib/useServerAction";
import {
  CUR, fmt, money, ago, dtLocal, poolOf, raceWindow, STATUS,
  POINTS, FL_POINT, CLS_LABEL, CLS_TEXT,
} from "@/lib/store";
import {
  approveDeposit, rejectDeposit,
  approveWithdrawal, markWithdrawalPaid, rejectWithdrawal,
} from "@/app/actions/wallet";
import { approvePayout, payPayout, holdPayout } from "@/app/actions/payouts";
import { createRace as createRaceAction, editRace as editRaceAction } from "@/app/actions/races";
import { confirmSettlement } from "@/app/actions/settlement";
import { toggleRaceCounts } from "@/app/actions/championships";
import { buildSettlementInput } from "@/lib/actionAdapters/settlement";

export function AdminDash({ S, sessionUser }) {
  const openRaces = S.races.filter(r => ["open", "locked", "live"].includes(r.status));
  const circ = S.circulationTotal || 0;
  const roleName = sessionUser?.role?.name || "admin";

  const cards = [];
  if (S.winQueue) cards.push(
    <div className="card" key="payouts"><Stat label="PAYOUTS OWED" value={S.winQueue.filter(p => p.status === "pending" || p.status === "approved").length} sub={money(S.winQueue.filter(p => p.status === "pending" || p.status === "approved").reduce((s, p) => s + p.amount, 0)) + " auto-queued"} color="var(--yellow)" /></div>
  );
  if (S.depQueue) cards.push(
    <div className="card" key="deposits"><Stat label="PENDING DEPOSITS" value={S.depQueue.length} sub={money(S.depQueue.reduce((s, d) => s + d.amount, 0)) + " claimed"} color="var(--yellow)" /></div>
  );
  if (S.wdQueue) cards.push(
    <div className="card" key="withdrawals"><Stat label="PENDING WITHDRAWALS" value={S.wdQueue.filter(p => p.status === "pending" || p.status === "approved").length} sub={money(S.wdQueue.filter(p => p.status === "pending" || p.status === "approved").reduce((s, p) => s + p.amount, 0)) + " to hand off"} color="var(--yellow)" /></div>
  );
  cards.push(<div className="card" key="circ"><Stat label="CURRENCY IN CIRCULATION" value={money(circ)} sub="Confirmed balances + locked stakes" /></div>);
  cards.push(<div className="card" key="withdrawn"><Stat label="WITHDRAWN ALL-TIME" value={money(S.withdrawnAllTime?.total || 0)} sub={`Across ${S.withdrawnAllTime?.count || 0} approved cash-outs`} color="var(--up)" /></div>);

  return <div>
    <div className="hdr" style={{ marginBottom: 24 }}>
      <div><h2 className="ttl-lg">Operations dashboard</h2><div className="muted" style={{ fontSize: 13 }}>Signed in as {sessionUser?.username} · {roleName}</div></div>
      <div className="flex" style={{ gap: 10 }}><button className="btn btn-ghost btn-sm">Export CSV</button><Link href="/admin/races" className="btn btn-y btn-sm">Create race</Link></div>
    </div>
    <div className="grid g4" style={{ gridTemplateColumns: `repeat(${cards.length},1fr)`, marginBottom: 24 }}>{cards}</div>
    <div className="grid g2" style={{ gridTemplateColumns: S.audit ? "1.4fr 1fr" : "1fr" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Races needing attention</div>
        <div className="tblwrap"><table><thead><tr><th>Race</th><th>Betting closes</th><th style={{ textAlign: "right" }}>Pool</th><th style={{ textAlign: "right" }}>Bets</th><th style={{ textAlign: "right" }}>Status</th><th></th></tr></thead>
          <tbody>{openRaces.map(r => <tr key={r.id} className="rowhov">
            <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap">{r.circuit}</div></td>
            <td className="num muted2" style={{ fontSize: 13 }}><LocalTime ts={r.lock} /></td>
            <td className="num" style={{ textAlign: "right" }}>{fmt(poolOf(S.bets, r.id))}</td>
            <td className="num" style={{ textAlign: "right" }}>{S.bets.filter(b => b.raceId === r.id).length}</td>
            <td style={{ textAlign: "right" }}><Badge s={r.status} /></td>
            <td style={{ textAlign: "right" }}>{r.status === "locked" && <Link href="/admin/settle" className="btn btn-y btn-xs">Enter result</Link>}</td>
          </tr>)}</tbody></table></div>
      </div>
      {S.audit && <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Audit log</div>
        {S.audit.map(a => <div key={a.id} style={{ padding: "12px 0", borderTop: "1px solid var(--hair)" }}>
          <div className="flex" style={{ justifyContent: "space-between" }}><span style={{ fontWeight: 500, fontSize: 13 }}>{a.act}</span><span className="cap num">{ago(a.at)}</span></div>
          <div className="muted2" style={{ fontSize: 13 }}>{a.target}</div>
          <div className="cap" style={{ color: "var(--muted)" }}>{a.who} · {a.note}</div>
        </div>)}
      </div>}
    </div>
  </div>;
}

export function AdminQueues({ S }) {
  const run = useServerAction();
  const [tab, setTab] = useState("dep");
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");
  const openWd = S.wdQueue.filter(p => p.status === "pending" || p.status === "approved");
  const openWin = S.winQueue.filter(p => p.status === "pending" || p.status === "approved");
  const byRace = openWin.reduce((m, w) => { (m[w.race] = m[w.race] || []).push(w); return m; }, {});
  return <div>
    <h2 className="ttl-lg" style={{ marginBottom: 6 }}>Approval queues</h2>
    <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Payouts queue themselves the moment a race settles — nobody files a request. Deposits and withdrawals are user-initiated. All three need an admin.</div>
    <div className="flex" style={{ gap: 6, marginBottom: 16 }}>
      <button className={"pill-tab" + (tab === "win" ? " on" : "")} onClick={() => setTab("win")}>Payouts · {openWin.length}</button>
      <button className={"pill-tab" + (tab === "dep" ? " on" : "")} onClick={() => setTab("dep")}>Deposits · {S.depQueue.length}</button>
      <button className={"pill-tab" + (tab === "wd" ? " on" : "")} onClick={() => setTab("wd")}>Withdrawals · {openWd.length}</button>
    </div>
    {tab === "win" ? <div className="card">
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
        <div><div className="ttl-sm">Auto-queued payouts</div>
          <div className="cap" style={{ color: "var(--muted)" }}>Dropped here automatically at settlement — nobody files a request. Approve, arrange the handoff, then mark paid to credit the balance.</div></div>
        {!!openWin.length && <div className="flex" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="cap num">{money(openWin.reduce((s, w) => s + w.amount, 0))} owed</span>
          {!!openWin.filter(w => w.status === "pending").length && <button className="btn btn-2 btn-sm" onClick={() => run(approvePayout, { transactionIds: openWin.filter(w => w.status === "pending").map(w => w.id) })}>Approve all</button>}
          {!!openWin.filter(w => w.status === "approved").length && <button className="btn btn-y btn-sm" onClick={() => run(payPayout, { transactionIds: openWin.filter(w => w.status === "approved").map(w => w.id) })}>Mark all paid</button>}</div>}
      </div>
      {Object.keys(byRace).map(rn => <div key={rn} style={{ marginBottom: 20 }}>
        <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--elev)", borderRadius: "var(--r-md)", marginBottom: 4 }}>
          <div><span style={{ fontWeight: 600, fontSize: 13 }}>{rn}</span>
            <span className="cap muted2" style={{ marginLeft: 8 }}>{byRace[rn].length} winner{byRace[rn].length === 1 ? "" : "s"} · P1 {byRace[rn][0].driver}</span></div>
          <div className="flex" style={{ gap: 10, alignItems: "center" }}>
            <span className="num up" style={{ fontWeight: 600 }}>{money(byRace[rn].reduce((s, w) => s + w.amount, 0))}</span>
            {byRace[rn].some(w => w.status === "pending")
              ? <button className="btn btn-2 btn-xs" onClick={() => run(approvePayout, { transactionIds: byRace[rn].filter(w => w.status === "pending").map(w => w.id) })}>Approve race</button>
              : <button className="btn btn-y btn-xs" onClick={() => run(payPayout, { transactionIds: byRace[rn].filter(w => w.status === "approved").map(w => w.id) })}>Mark race paid</button>}</div>
        </div>
        <div className="tblwrap"><table><thead><tr><th>User</th><th>Character</th><th style={{ textAlign: "right" }}>Stake</th><th style={{ textAlign: "right" }}>Payout</th><th>Settled</th><th style={{ textAlign: "right" }}>Status</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
          <tbody>{byRace[rn].map(w => <tr key={w.id} className="rowhov">
            <td style={{ fontWeight: 500 }}>{w.user}</td><td className="muted2">{w.ign}</td>
            <td className="num muted2" style={{ textAlign: "right" }}>{fmt(w.stake)}</td>
            <td className="num up" style={{ textAlign: "right", fontWeight: 600 }}>{money(w.amount)}</td>
            <td className="muted num" style={{ fontSize: 13 }}>{ago(w.at)}</td>
            <td style={{ textAlign: "right" }}><span className={"badge " + (w.status === "approved" ? "b-lock" : "b-pend")}>{w.status}</span></td>
            <td style={{ textAlign: "right" }}><div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-xs" onClick={() => setReject({ ...w, mode: "win" })}>Hold</button>
              {w.status === "pending"
                ? <button className="btn btn-2 btn-xs" onClick={() => run(approvePayout, { transactionIds: [w.id] })}>Approve</button>
                : <button className="btn btn-y btn-xs" onClick={() => run(payPayout, { transactionIds: [w.id] })}>Mark paid</button>}</div></td>
          </tr>)}</tbody></table></div>
      </div>)}
      {!openWin.length && <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>Nothing owed. Payouts appear here on their own the moment a race settles.</div>}
      {!!S.winQueue.filter(w => w.status === "paid" || w.status === "held").length && <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
        <div className="cap" style={{ marginBottom: 8 }}>ALREADY PROCESSED</div>
        <div className="tblwrap"><table><thead><tr><th>User</th><th>Race</th><th style={{ textAlign: "right" }}>Payout</th><th>When</th><th style={{ textAlign: "right" }}>Status</th></tr></thead>
          <tbody>{S.winQueue.filter(w => w.status === "paid" || w.status === "held").map(w => <tr key={w.id} className="rowhov">
            <td style={{ fontWeight: 500 }}>{w.user}</td><td className="muted2" style={{ fontSize: 13 }}>{w.race}</td>
            <td className="num" style={{ textAlign: "right" }}>{money(w.amount)}</td>
            <td className="muted num" style={{ fontSize: 13 }}>{ago(w.at)}</td>
            <td style={{ textAlign: "right" }}><span className={"badge " + (w.status === "paid" ? "b-open" : "b-live")}>{w.status}</span></td>
          </tr>)}</tbody></table></div>
      </div>}
    </div> : tab === "dep" ? <div className="card">
      <div className="tblwrap"><table><thead><tr><th>User</th><th>Character</th><th>Age</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
        <tbody>{S.depQueue.map(d => <tr key={d.id} className="rowhov">
          <td style={{ fontWeight: 500 }}>{d.user}</td>
          <td className="muted2">{d.ign}</td>
          <td className="muted num" style={{ fontSize: 13 }}>{ago(d.at)}</td>
          <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{money(d.amount)}</td>
          <td style={{ textAlign: "right" }}><div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-xs" onClick={() => setReject({ ...d, mode: "dep" })}>Reject</button>
            <button className="btn btn-y btn-xs" onClick={() => run(approveDeposit, { transactionId: d.id })}>Approve</button></div></td>
        </tr>)}</tbody></table></div>
      {!S.depQueue.length && <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>Queue clear.</div>}
    </div> : <div className="card">
      <div className="cap" style={{ marginBottom: 12 }}>APPROVE TO CLEAR THE CASH-OUT, THEN MARK PAID ONCE THE IN-GAME HANDOFF IS DONE. REJECTING RETURNS THE FUNDS TO THE USER'S BALANCE.</div>
      <div className="tblwrap tbl-wide"><table><thead><tr><th>User</th><th>Character</th><th>Handoff</th><th>Age</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Status</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
        <tbody>{S.wdQueue.map(p => <tr key={p.id} className="rowhov">
          <td style={{ fontWeight: 500 }}>{p.user}</td><td className="muted2">{p.ign}</td>
          <td className="muted2" style={{ fontSize: 13 }}>{p.dest}</td>
          <td className="muted num" style={{ fontSize: 13 }}>{ago(p.at)}</td>
          <td className="num yel" style={{ textAlign: "right", fontWeight: 600 }}>{money(p.amount)}</td>
          <td style={{ textAlign: "right" }}><span className={"badge " + (p.status === "paid" ? "b-open" : p.status === "approved" ? "b-lock" : p.status === "rejected" ? "b-live" : "b-pend")}>{p.status}</span></td>
          <td style={{ textAlign: "right" }}>{p.status === "paid" || p.status === "rejected" ? <span className="muted" style={{ fontSize: 13 }}>—</span> :
            <div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-xs" onClick={() => setReject({ ...p, mode: "wd" })}>Reject</button>
              {p.status === "pending"
                ? <button className="btn btn-y btn-xs" onClick={() => run(approveWithdrawal, { transactionId: p.id })}>Approve</button>
                : <button className="btn btn-y btn-xs" onClick={() => run(markWithdrawalPaid, { transactionId: p.id })}>Mark paid</button>}</div>}</td>
        </tr>)}</tbody></table></div>
      {!S.wdQueue.length && <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>No withdrawal requests.</div>}
    </div>}
    {reject && <div className="modal-bg" onClick={() => setReject(null)}><div className="modal" onClick={e => e.stopPropagation()}>
      <h3 className="ttl-md">{reject.mode === "win" ? "Hold payout" : "Reject " + (reject.mode === "wd" ? "withdrawal" : "deposit")}</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 18px" }}>{reject.user} · {money(reject.amount)}. A reason is required and will be logged and sent to the user.{reject.mode === "wd" ? " The amount returns to their confirmed balance." : reject.mode === "win" ? " Nothing credits until you release it — use this while a result is disputed." : ""}</div>
      <label className="f">REASON</label>
      <textarea className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder={reject.mode === "wd" ? "e.g. Character not reachable for handoff" : "e.g. No matching in-game handoff found"} />
      <div className="flex" style={{ gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setReject(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" disabled={!reason.trim()} onClick={() => {
          const id = reject.id;
          if (reject.mode === "win") run(holdPayout, { transactionId: id, reason });
          else if (reject.mode === "wd") run(rejectWithdrawal, { transactionId: id, reason });
          else run(rejectDeposit, { transactionId: id, reason });
          setReject(null); setReason("");
        }}>{reject.mode === "win" ? "Hold and notify" : "Reject and notify"}</button></div>
    </div></div>}
  </div>;
}

export function AdminSettle({ S }) {
  const D = useEntrantLookup();
  const run = useServerAction();
  const settleable = S.races.filter(r => r.status !== "settled");
  const [rid, setRid] = useState((S.races.find(r => r.status === "locked") || settleable[0] || S.races[0])?.id || null);
  const race = settleable.find(r => r.id === rid) || settleable[0];
  const season = !!race && race.kind === "season";
  const ch = race && S.championships.find(c => c.id === race.champId);
  const grid = race ? race.drivers : [];
  const [cls, setCls] = useState({});
  const [pos, setPos] = useState({});
  const [why, setWhy] = useState({});
  const [fl, setFl] = useState("");
  const [champion, setChampion] = useState("");
  const [ruling, setRuling] = useState("settle");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const reset = () => { setCls({}); setPos({}); setWhy({}); setFl(""); setChampion(""); setConfirmed(false); };
  const stOf = id => cls[id] || "fin";
  const dirty = () => setConfirmed(false);
  const setStatus = (id, v) => {
    dirty();
    const nextCls = { ...cls, [id]: v };
    setCls(nextCls);
    if (fl === id && v !== "fin") setFl("");
    // re-rank the still-classified drivers to a dense P1..PN so nothing is left out of range
    setPos(p => {
      const keep = grid.filter(g => (nextCls[g] || "fin") === "fin" && p[g]).sort((a, b) => p[a] - p[b]);
      return Object.fromEntries(keep.map((g, i) => [g, i + 1]));
    });
  };
  const setP = (id, v) => { dirty(); setPos(p => { const n = { ...p }; if (v) { for (const k in n) if (n[k] === v) delete n[k]; n[id] = v; } else delete n[id]; return n; }); };
  useEffect(() => { if (race && race.id !== rid) { setRid(race.id); reset(); setReason(""); } }, [race && race.id]);
  if (!race) return <div>
    <h2 className="ttl-lg" style={{ marginBottom: 6 }}>Result and settlement</h2>
    <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Nothing is waiting on a result.</div>
    <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
      <div className="ttl-sm" style={{ marginBottom: 6 }}>Every market is settled</div>
      <div className="muted2" style={{ fontSize: 13 }}>Create a race or reopen a championship market and it will appear here once betting locks.</div>
    </div>
  </div>;

  const classified = grid.filter(id => stOf(id) === "fin");
  const retired = grid.filter(id => stOf(id) !== "fin");
  const N = classified.length;
  const ordered = classified.filter(id => pos[id]).sort((a, b) => pos[a] - pos[b]);
  const posVals = classified.map(id => pos[id]).filter(Boolean);
  const posOk = N > 0 && ordered.length === N && new Set(posVals).size === N && Math.max(...posVals) === N;
  const order = ordered;
  const needWhy = grid.filter(id => stOf(id) !== "fin");
  const whyOk = needWhy.every(id => (why[id] || "").trim());
  const complete = season ? !!champion : posOk && whyOk;
  const p1 = season ? champion : order[0];

  const allBets = S.bets.filter(b => b.raceId === race.id && b.status !== "void");
  const total = allBets.reduce((s, b) => s + b.stake, 0);
  // non-runners (DNS) are refunded like a whole-race void; DNF and DSQ settle as losses
  const nonRunners = grid.filter(id => stOf(id) === "dns");
  const refundBets = allBets.filter(b => nonRunners.includes(b.dId));
  const refundStake = refundBets.reduce((s, b) => s + b.stake, 0);
  const settling = total - refundStake;
  const net = settling * (1 - race.rake / 100);
  const winners = p1 ? allBets.filter(b => b.dId === p1) : [];
  const winPool = winners.reduce((s, b) => s + b.stake, 0);
  const pts = ch ? ch.points : POINTS;
  const flPt = ch ? ch.fl : FL_POINT;
  const paying = ruling === "settle" || ruling === "adjust";
  const CL = { fin: ["FIN", "var(--body)"], dnf: ["DNF", "var(--down)"], dns: ["DNS", "var(--muted)"], dsq: ["DSQ", "var(--yellow)"] };

  return <div>
    <h2 className="ttl-lg" style={{ marginBottom: 6 }}>Result and settlement</h2>
    <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>{race.name} · {race.circuit}
      {!season && (race.champId ? <> · counts toward {ch ? ch.name : "championship"}{race.countsD && race.countsC ? " (drivers + constructors)" : race.countsD ? " (drivers only)" : race.countsC ? " (constructors only)" : " (no points)"}</> : <> · exhibition race, no championship points</>)}</div>
    <div className="grid g2" style={{ gridTemplateColumns: "480px 1fr", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 16 }}>Enter official result</div>
        <label className="f">MARKET</label>
        <select className="input" value={rid} style={{ marginBottom: 18 }} onChange={ev => { setRid(ev.target.value); reset(); }}>
          {settleable.map(r => <option key={r.id} value={r.id}>{r.kind === "season" ? "★ " : ""}{r.name}</option>)}
        </select>

        {season ? <>
          <label className="f">{race.market === "constructors" ? "TITLE-WINNING CONSTRUCTOR" : "CHAMPION"}</label>
          <select className="input" value={champion} onChange={ev => { setChampion(ev.target.value); setConfirmed(false); }}>
            <option value="">Select a {race.market === "constructors" ? "constructor" : "driver"}…</option>
            {grid.map(id => <option key={id} value={id}>{D(id).n}</option>)}
          </select>
        </> : <>
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <label className="f" style={{ marginBottom: 0 }}>CLASSIFICATION</label>
            <div className="flex" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-xs" onClick={() => { dirty(); setCls({}); setPos(Object.fromEntries(grid.map((id, i) => [id, i + 1]))); }}>Fill from grid</button>
              <button className="btn btn-ghost btn-xs" onClick={reset}>Clear</button></div>
          </div>
          <div className="cap" style={{ color: "var(--muted)", marginBottom: 8 }}>Only classified finishers need a position. Mark anyone who retired as DNF, DNS or DSQ and they drop out of the order.</div>
          <div className="card-flat" style={{ background: "var(--canvas)", padding: "8px 10px", maxHeight: 440, overflow: "auto" }}>
            <div className="clsrow cap" style={{ color: "var(--muted)", padding: "2px 0 6px" }}>
              <span>DRIVER</span><span style={{ textAlign: "center" }}>STATUS</span><span style={{ textAlign: "center" }}>POS</span><span style={{ textAlign: "center" }}>PTS</span></div>
            {grid.map(id => { const st = stOf(id), p = pos[id];
              const base = st === "fin" && p ? (pts[p - 1] || 0) : 0, bonus = fl === id ? flPt : 0;
              return <div key={id} className="clsrow" style={{ padding: "5px 0", borderTop: "1px solid var(--hair)", opacity: st === "fin" ? 1 : .72 }}>
                <div className="flex" style={{ gap: 8, alignItems: "center", minWidth: 0 }}><Dot d={D(id)} size={22} />
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{D(id).n}</div>
                    <div className="cap" style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{D(id).t}</div></div></div>
                <div className="segmini">{Object.keys(CL).map(k => <button key={k} className={st === k ? "on" : ""}
                  style={{ color: st === k ? "var(--ink)" : CL[k][1] }} onClick={() => setStatus(id, k)}>{CL[k][0]}</button>)}</div>
                <select className="input" disabled={st !== "fin"} style={{ height: 30, fontSize: 13, padding: "4px 6px", textAlign: "center", opacity: st === "fin" ? 1 : .4 }}
                  value={p || ""} onChange={ev => setP(id, Number(ev.target.value) || 0)}>
                  <option value="">—</option>
                  {Array.from({ length: N }, (_, i) => i + 1).map(n => <option key={n} value={n}>P{n}</option>)}
                </select>
                <span className="num cap" style={{ textAlign: "center", color: base + bonus ? "var(--body)" : "var(--muted)" }}>{base + bonus}</span>
                {st !== "fin" && <input className="input clswhy" value={why[id] || ""} onChange={ev => { dirty(); setWhy(w => ({ ...w, [id]: ev.target.value })); }}
                  placeholder={st === "dns" ? "Non-runner reason, e.g. withdrawn at scrutineering" : st === "dsq" ? "Exclusion reason, e.g. technical infringement" : "Retirement reason, e.g. collision, lap 12"} />}
              </div>; })}
          </div>
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 6 }}>
            <span className="cap">{ordered.length} of {N} classified positions set{retired.length ? " · " + retired.length + " retired" : ""}</span>
            <span className="cap muted2">Points per {ch ? ch.name : "current"} scale</span></div>
          {N > 0 && !posOk && <div className="cap" style={{ color: "var(--muted)", marginTop: 6 }}>
            Give every classified finisher a unique position from P1 to P{N}.</div>}
          {posOk && !whyOk && <div className="cap" style={{ color: "var(--muted)", marginTop: 6 }}>
            Every non-finish needs a reason — it's stored on the classification and shown to backers.</div>}
          {!!nonRunners.length && <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px", marginTop: 8 }}>
            <div className="cap" style={{ marginBottom: 6 }}>NON-RUNNERS — {nonRunners.length} DNS</div>
            <div className="cap" style={{ color: "var(--muted-2)" }}>{nonRunners.map(id => D(id).n).join(", ")} never started, so {money(refundStake)} across {refundBets.length} bets is refunded and leaves the pool before it splits.</div>
          </div>}
          <div style={{ marginTop: 14 }}><label className="f">FASTEST LAP (+{flPt} PT, CLASSIFIED TOP 10 ONLY)</label>
            <select className="input" value={fl} onChange={ev => { setFl(ev.target.value); setConfirmed(false); }}>
              <option value="">None awarded</option>
              {order.slice(0, 10).map(id => <option key={id} value={id}>{D(id).n}</option>)}
            </select></div>
        </>}

        <div style={{ marginTop: 18 }}><label className="f">DISPUTE RULING</label>
          {[["settle", "Settle as entered", "Result stands, pool splits normally."],
          ["adjust", "Adjust result", "Overrides the on-track order (e.g. post-race penalty)."],
          ["hold", "Hold for investigation", "Nothing pays out. Stakes stay locked and the market freezes until you settle or void it."],
          ["void", "Void " + (season ? "market" : "race"), "All stakes refunded, no payouts, no points."]].map(([k, ti, d]) =>
            <div key={k} onClick={() => { setRuling(k); dirty(); }} className="card-flat" style={{ background: ruling === k ? "var(--elev)" : "transparent", border: "1px solid " + (ruling === k ? "var(--yellow)" : "var(--hair)"), marginBottom: 8, cursor: "pointer", padding: "12px 14px" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{ti}</div><div className="cap" style={{ color: "var(--muted)" }}>{d}</div></div>)}
        </div>
        <label className="f">RULING REASON (REQUIRED, LOGGED)</label>
        <textarea className="input" value={reason} onChange={ev => setReason(ev.target.value)} placeholder={ruling === "hold" ? "e.g. Two backers flagged a coordinated retirement — reviewing telemetry." : "e.g. Stewards confirmed no penalties; result as flagged."} />
        <button className="btn btn-y" style={{ width: "100%", marginTop: 16 }}
          disabled={(ruling !== "void" && ruling !== "hold" && !complete) || !reason.trim() || confirmed}
          onClick={() => setConfirmed(true)}>
          {confirmed ? "Preview generated" : !posOk && !season && paying ? "Set the classified order" : !whyOk && !season && paying ? "Add the missing reasons" : "Generate settlement preview"}</button>
      </div>

      <div className="card">
        <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="ttl-sm">Settlement preview</div>
          {confirmed && <span className="badge b-lock">Not yet final</span>}</div>
        {!confirmed ? <div className="muted" style={{ fontSize: 13, padding: "40px 0", textAlign: "center" }}>
          {season ? "Select a title winner" : "Classify every driver and order the finishers"} and add a ruling reason to preview payouts{season ? "" : " and championship points"}.</div> : <>
          <div className="flex" style={{ gap: 40, paddingBottom: 16, borderBottom: "1px solid var(--hair)", marginBottom: 16, flexWrap: "wrap" }}>
            <div><div className="cap">TOTAL POOL</div><div className="num yel" style={{ fontSize: 20, fontWeight: 600 }}>{money(total)}</div></div>
            {!!refundStake && <div><div className="cap">REFUNDED (NON-RUNNERS)</div><div className="num down" style={{ fontSize: 20, fontWeight: 600 }}>−{money(refundStake)}</div></div>}
            <div><div className="cap">RAKE ({race.rake}%)</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{money(settling - net)}</div></div>
            <div><div className="cap">DISTRIBUTED</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{paying ? money(net) : "—"}</div></div>
            <div><div className="cap">WINNING BETS</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{paying ? winners.length : "—"}</div></div>
            {!season && <div><div className="cap">POINTS AWARDED</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{!paying || !race.countsD ? "—" : order.reduce((s, id, i) => s + (pts[i] || 0), 0) + (fl ? flPt : 0)}</div></div>}
          </div>
          {ruling === "void" ? <div className="card-flat" style={{ background: "var(--elev)", fontSize: 13 }}>
            {season ? "Market" : "Race"} voided. All {allBets.length} stakes ({money(total)}) are refunded to confirmed balances. No payouts and no championship points.</div>
          : ruling === "hold" ? <div className="card-flat" style={{ background: "var(--elev)", fontSize: 13 }}>
            Market frozen for investigation. All {allBets.length} stakes ({money(total)}) stay locked — nothing credits, nothing refunds, and no points are awarded. The race stays on this screen until you settle or void it, and every backer is notified that their bet is under review.</div> : <>
            {!!refundBets.length && <div style={{ marginBottom: 20 }}>
              <div className="cap" style={{ marginBottom: 8 }}>NON-RUNNERS — STAKES REFUNDED</div>
              <div className="tblwrap"><table><thead><tr><th>User</th><th>Backed</th><th>Reason</th><th style={{ textAlign: "right" }}>Refund</th></tr></thead>
                <tbody>{refundBets.map(b => <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.user}</td>
                  <td><div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={D(b.dId)} size={22} /><span className="muted2">{D(b.dId).n}</span></div></td>
                  <td className="muted wrapcell" style={{ fontSize: 13 }}>{why[b.dId]}</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{fmt(b.stake)}</td></tr>)}</tbody></table></div>
            </div>}
            <div className="cap" style={{ marginBottom: 8 }}>PAYOUTS — BACKERS OF {p1 ? D(p1).n.toUpperCase() : "—"}</div>
            <div className="tblwrap"><table><thead><tr><th>User</th><th>Pick</th><th style={{ textAlign: "right" }}>Stake</th><th style={{ textAlign: "right" }}>Pool share</th><th style={{ textAlign: "right" }}>Payout</th></tr></thead>
              <tbody>{winners.map(b => <tr key={b.id}>
                <td style={{ fontWeight: 500 }}>{b.user}</td>
                <td><div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={D(b.dId)} size={22} />{D(b.dId).n}</div></td>
                <td className="num" style={{ textAlign: "right" }}>{fmt(b.stake)}</td>
                <td className="num muted2" style={{ textAlign: "right" }}>{((b.stake / winPool) * 100).toFixed(1)}%</td>
                <td className="num up" style={{ textAlign: "right", fontWeight: 600 }}>{fmt(net * b.stake / winPool)}</td></tr>)}</tbody></table></div>
            {!winners.length && <div className="muted" style={{ fontSize: 13, padding: "24px 0", textAlign: "center" }}>
              Nobody backed {p1 ? D(p1).n : "the winner"}. The full pool of {money(settling)} would carry over — confirm with a ruling note before proceeding.</div>}
            {!!retired.length && <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
              <div className="cap" style={{ marginBottom: 8 }}>NOT CLASSIFIED — {retired.length} OF {grid.length} DRIVERS</div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 8 }}>{retired.map(id => <div key={id} className="card-flat" style={{ background: "var(--elev)", padding: "10px 12px" }}>
                <div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={D(id)} size={20} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{D(id).n}</span>
                  <span className="cap" style={{ color: CL[stOf(id)][1], fontWeight: 700 }}>{CL[stOf(id)][0]}</span></div>
                <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>{why[id]}</div></div>)}</div>
              <div className="cap" style={{ color: "var(--muted)", marginTop: 8 }}>
                Retirements take no points. DNF and DSQ settle as ordinary losing bets — {fmt(allBets.filter(b => retired.includes(b.dId) && !nonRunners.includes(b.dId)).reduce((s, b) => s + b.stake, 0))} {CUR} of stake stays in the pool. Non-runners (DNS) are refunded.</div>
            </div>}
            {!season && (race.countsD || race.countsC) && <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
              <div className="cap" style={{ marginBottom: 8 }}>CHAMPIONSHIP POINTS — {ch ? ch.name.toUpperCase() : "SEASON"}</div>
              <div className="tblwrap"><table><thead><tr><th style={{ width: 46 }}>Pos</th><th>Driver</th><th>Team</th><th style={{ textAlign: "right" }}>Race pts</th><th style={{ textAlign: "right" }}>New total</th></tr></thead>
                <tbody>{order.map((id, i) => { const base = pts[i] || 0; const bonus = fl === id ? flPt : 0; const d = S.roster.find(x => x.id === id) || D(id);
                  return <tr key={id} className="rowhov">
                    <td className="num" style={{ color: base ? "var(--yellow)" : "var(--muted)", fontWeight: 600 }}>P{i + 1}</td>
                    <td><div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={D(id)} size={22} />{D(id).n}
                      {bonus > 0 && <span className="badge b-lock">FL</span>}</div></td>
                    <td className="muted2" style={{ fontSize: 13 }}>{D(id).t}</td>
                    <td className="num" style={{ textAlign: "right", color: base + bonus ? "var(--up)" : "var(--muted)" }}>{base + bonus ? "+" + (base + bonus) : "0"}</td>
                    <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{(d.pts || 0) + (race.countsD ? base + bonus : 0)}</td>
                  </tr>; })}</tbody></table></div>
              <div className="cap" style={{ color: "var(--muted)", marginTop: 10 }}>
                {race.countsD ? "Drivers' points applied." : "Drivers' points skipped for this round."} {race.countsC ? "Constructor points credited to each driver's team lineup." : "Constructor points skipped for this round."}</div>
            </div>}
          </>}
          <div className="flex" style={{ gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button className="btn btn-2 btn-sm" onClick={() => setConfirmed(false)}>Back to edit</button>
            <button className="btn btn-y btn-sm" onClick={() => {
              const payload = { race, p1, order: season ? [champion] : order, retired: retired.map(id => ({ id, st: stOf(id), why: why[id] || "" })), why, nonRunners, refundBets, refundStake, fl, ruling, reason, winners, net, winPool, pts, flPt };
              run(confirmSettlement, buildSettlementInput(payload));
              reset(); setReason("");
            }}>
              {ruling === "hold" ? "Freeze market" : "Confirm settlement"}</button></div>
          <div className="cap" style={{ color: "var(--muted)", marginTop: 10, textAlign: "right" }}>
            {ruling === "hold" ? "On freeze: stakes stay locked, backers notified, ruling written to audit log."
              : "On confirm: payouts auto-queue for approval, non-runner stakes refunded, losers marked Lost, standings recalculate, ruling written to audit log."}</div>
        </>}
      </div>
    </div>
  </div>;
}

export function AdminRaces({ S }) {
  const D = useEntrantLookup();
  const run = useServerAction();
  const [name, setName] = useState("");
  const [circuit, setCircuit] = useState("");
  const [champId, setChampId] = useState(S.championships[0]?.id || "");
  const [cd, setCd] = useState(true);
  const [cc, setCc] = useState(true);
  const [rake, setRake] = useState("0");
  const [dt, setDt] = useState(Date.now() + 72 * 3600e3);
  const [lock, setLock] = useState(Date.now() + 68 * 3600e3);
  const [gridDrivers, setGridDrivers] = useState(() => S.roster.filter(d => d.status === "active").map(d => d.id));
  const [ren, setRen] = useState(null);
  return <div>
    <h2 className="ttl-lg" style={{ marginBottom: 20 }}>Race management</h2>
    <div className="grid g2" style={{ gridTemplateColumns: "1fr 380px", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>All races</div>
        <div className="tblwrap"><table><thead><tr><th>Race</th><th>Championship</th><th>Scores points</th><th style={{ textAlign: "right" }}>Pool</th><th style={{ textAlign: "right" }}>Status</th><th></th></tr></thead>
          <tbody>{raceWindow(S.races).map(r => { const ch = S.championships.find(c => c.id === r.champId);
            return <tr key={r.id} className="rowhov">
            <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap"><LocalTime ts={r.dt} /> · {r.circuit}</div></td>
            <td style={{ fontSize: 13 }}>{ch ? <>{ch.name}<div className="cap">Round {r.round || "—"}</div></> : <span className="muted">Exhibition</span>}</td>
            <td><div className="flex" style={{ gap: 14 }}>
              {[["Drivers", "countsD"], ["Constr.", "countsC"]].map(([l, f]) => <label key={f} className="flex" style={{ gap: 6, alignItems: "center", fontSize: 12, color: "var(--muted-2)", cursor: "pointer" }}>
                <Check on={!!r[f]} onClick={() => run(toggleRaceCounts, { raceId: r.id, field: f })} />{l}</label>)}
            </div></td>
            <td className="num" style={{ textAlign: "right" }}>{fmt(poolOf(S.bets, r.id))}</td>
            <td style={{ textAlign: "right" }}><Badge s={r.status} /></td>
            <td style={{ textAlign: "right" }}>{r.status === "settled" ? <span className="muted" style={{ fontSize: 13 }}>read-only</span> : <button className="btn btn-ghost btn-xs" onClick={() => setRen({ id: r.id, name: r.name, circuit: r.circuit, dt: r.dt, lock: r.lock, rake: String(r.rake), champId: r.champId || "", round: r.round || "", countsD: !!r.countsD, countsC: !!r.countsC, status: r.status, drivers: (r.drivers || []).slice(), gridLocked: r.status !== "upcoming" })}>Edit</button>}</td>
          </tr>; })}</tbody></table></div>
        <div className="cap" style={{ marginTop: 14, color: "var(--muted)" }}>Status flow: upcoming → open → locked (posted qualifying) → live → finished → settled</div>
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Create race</div>
        <div style={{ marginBottom: 12 }}><label className="f">RACE NAME</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Grapeseed Rally" /></div>
        <div style={{ marginBottom: 12 }}><label className="f">CIRCUIT / SUBTITLE</label><input className="input" value={circuit} onChange={e => setCircuit(e.target.value)} placeholder="Harbor Street Circuit · 58 laps" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label className="f">RACE STARTS</label>
            <input className="input" type="datetime-local" value={dtLocal(dt)} onChange={e => setDt(new Date(e.target.value).getTime() || dt)} />
            <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>When the race itself begins</div></div>
          <div><label className="f">BETTING CLOSES</label>
            <input className="input" type="datetime-local" value={dtLocal(lock)} onChange={e => setLock(new Date(e.target.value).getTime() || lock)} />
            <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>Usually when qualifying is posted</div></div></div>
        {lock >= dt && <div className="cap down" style={{ marginBottom: 12 }}>Betting must close before the race starts — set an earlier closing time.</div>}
        <div style={{ marginBottom: 12 }}><label className="f">HOUSE RAKE %</label><input className="input" value={rake} onChange={e => setRake(e.target.value.replace(/[^\d]/g, ""))} /></div>
        <label className="f">CHAMPIONSHIP</label>
        <select className="input" value={champId} onChange={e => setChampId(e.target.value)}>
          {S.championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">Exhibition — no championship</option>
        </select>
        <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px", margin: "12px 0" }}>
          <div className="cap" style={{ marginBottom: 8 }}>AWARDS POINTS TOWARD</div>
          {[["Drivers' Championship", cd, setCd], ["Constructors' Championship", cc, setCc]].map(([l, v, set]) =>
            <label key={l} className="flex" style={{ gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13, cursor: champId ? "pointer" : "not-allowed", opacity: champId ? 1 : .45 }}>
              <input type="checkbox" checked={champId ? v : false} disabled={!champId} onChange={e => set(e.target.checked)} style={{ accentColor: "var(--yellow)" }} />{l}</label>)}
          {!champId && <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>Exhibition races award no points.</div>}
        </div>
        <label className="f">GRID ({gridDrivers.length} SELECTED)</label>
        <div className="card-flat" style={{ background: "var(--canvas)", maxHeight: 160, overflow: "auto", padding: 10 }}>
          {S.roster.filter(d => d.status !== "retired").map(d => <label key={d.id} className="flex" style={{ gap: 10, alignItems: "center", padding: "6px 4px", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={gridDrivers.includes(d.id)}
              onChange={e => setGridDrivers(v => e.target.checked ? [...v, d.id] : v.filter(x => x !== d.id))} style={{ accentColor: "var(--yellow)" }} />
            <Dot d={d} size={20} />{d.n}</label>)}
        </div>
        <button className="btn btn-y" style={{ width: "100%", marginTop: 16 }} disabled={!name.trim() || lock >= dt || !gridDrivers.length} onClick={() => {
          run(createRaceAction, {
            name, circuit, championshipId: champId || null,
            countsDrivers: !!champId && cd, countsConstructors: !!champId && cc, rakePct: Number(rake) || 0,
            raceDatetime: new Date(dt), qualifyingLock: new Date(lock), driverIds: gridDrivers,
          });
          setName("");
          setCircuit("");
          setDt(Date.now() + 72 * 3600e3);
          setLock(Date.now() + 68 * 3600e3);
          setGridDrivers(S.roster.filter(d => d.status === "active").map(d => d.id));
        }}>Create and open betting</button>
      </div>
    </div>
    {ren && <div className="modal-bg" onClick={() => setRen(null)}><div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
      <h3 className="ttl-md">Edit race</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 20px" }}>Name, times and rake stay editable right up to settlement. Existing bets, standings and the audit trail keep pointing at the same race.{ren.gridLocked ? " The driver list is frozen because betting has opened — no bet can end up pointing at a driver who was later removed." : ""}</div>
      <div style={{ marginBottom: 12 }}><label className="f">RACE NAME</label>
        <input className="input" value={ren.name} onChange={e => setRen(v => ({ ...v, name: e.target.value }))} /></div>
      <div style={{ marginBottom: 12 }}><label className="f">CIRCUIT / SUBTITLE</label>
        <input className="input" value={ren.circuit} onChange={e => setRen(v => ({ ...v, circuit: e.target.value }))} /></div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label className="f">RACE STARTS</label>
          <input className="input" type="datetime-local" value={dtLocal(ren.dt)} onChange={e => setRen(v => ({ ...v, dt: new Date(e.target.value).getTime() || v.dt }))} />
          <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>When the race itself begins</div></div>
        <div><label className="f">BETTING CLOSES</label>
          <input className="input" type="datetime-local" value={dtLocal(ren.lock)} onChange={e => setRen(v => ({ ...v, lock: new Date(e.target.value).getTime() || v.lock }))} />
          <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>Usually when qualifying is posted</div></div>
      </div>
      {ren.lock >= ren.dt && <div className="cap down" style={{ marginBottom: 12 }}>Betting must close before the race starts — set an earlier closing time.</div>}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label className="f">HOUSE RAKE %</label>
          <input className="input" value={ren.rake} onChange={e => setRen(v => ({ ...v, rake: e.target.value.replace(/[^\d]/g, "") }))} /></div>
        <div><label className="f">ROUND</label>
          <input className="input" value={ren.round} disabled={!ren.champId} onChange={e => setRen(v => ({ ...v, round: e.target.value.replace(/[^\d]/g, "") }))} /></div>
        <div><label className="f">STATUS</label>
          <select className="input" value={ren.status} onChange={e => setRen(v => ({ ...v, status: e.target.value }))}>
            {["upcoming", "open", "locked", "live", "finished"].map(s => <option key={s} value={s}>{(STATUS[s] || [s])[0]}</option>)}
          </select></div>
      </div>
      <div style={{ marginBottom: 12 }}><label className="f">CHAMPIONSHIP</label>
        <select className="input" value={ren.champId} onChange={e => setRen(v => ({ ...v, champId: e.target.value, countsD: e.target.value ? v.countsD : false, countsC: e.target.value ? v.countsC : false }))}>
          {S.championships.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">Exhibition — no championship</option>
        </select></div>
      <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px", marginBottom: 12 }}>
        <div className="cap" style={{ marginBottom: 8 }}>AWARDS POINTS TOWARD</div>
        {[["Drivers' Championship", "countsD"], ["Constructors' Championship", "countsC"]].map(([l, f]) =>
          <label key={f} className="flex" style={{ gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13, cursor: ren.champId ? "pointer" : "not-allowed", opacity: ren.champId ? 1 : .45 }}>
            <input type="checkbox" checked={!!ren[f]} disabled={!ren.champId} onChange={e => setRen(v => ({ ...v, [f]: e.target.checked }))} style={{ accentColor: "var(--yellow)" }} />{l}</label>)}
        {!ren.champId && <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>Exhibition races award no points.</div>}
      </div>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <label className="f">GRID ({ren.drivers.length} DRIVERS)</label>
          {ren.gridLocked && <span className="badge b-lock">locked — betting is open</span>}</div>
      <div className="card-flat" style={{ background: "var(--canvas)", maxHeight: 160, overflow: "auto", padding: 10, opacity: ren.gridLocked ? .5 : 1 }}>
        {S.roster.filter(d => d.status !== "retired").map(d => <label key={d.id} className="flex" style={{ gap: 10, alignItems: "center", padding: "6px 4px", fontSize: 13, cursor: ren.gridLocked ? "not-allowed" : "pointer" }}>
          <input type="checkbox" checked={ren.drivers.includes(d.id)} disabled={ren.gridLocked}
            onChange={e => setRen(v => ({ ...v, drivers: e.target.checked ? [...v.drivers, d.id] : v.drivers.filter(x => x !== d.id) }))} style={{ accentColor: "var(--yellow)" }} />
          <Dot d={D(d.id)} size={20} />{d.n}</label>)}
      </div>
      <div className="flex" style={{ gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setRen(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" disabled={!ren.name.trim() || ren.lock >= ren.dt || !ren.drivers.length}
          onClick={() => {
            run(editRaceAction, {
              id: ren.id, name: ren.name.trim(), circuit: ren.circuit,
              raceDatetime: new Date(ren.dt), qualifyingLock: new Date(ren.lock),
              rakePct: Number(ren.rake) || 0, championshipId: ren.champId || null, round: Number(ren.round) || null,
              countsDrivers: !!ren.countsD, countsConstructors: !!ren.countsC,
              status: ren.status, driverIds: ren.drivers,
            });
            setRen(null);
          }}>Save changes</button></div>
    </div></div>}
  </div>;
}
