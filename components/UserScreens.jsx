"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEntrantLookup } from "@/lib/entrantContext";
import { useServerAction } from "@/lib/useServerAction";
import { login, changePassword } from "@/app/actions/auth";
import { placeBet as placeBetAction } from "@/app/actions/bets";
import { requestDeposit, requestWithdrawal } from "@/app/actions/wallet";
import {
  CUR, fmt, money, poolOf, driverPools, countdown, when, ago,
  seasonWindow, raceWindow, STATUS, PAGE_SIZE,
  finishOf, classifyOrder, CLS_LABEL, CLS_TEXT,
} from "@/lib/store";

export function Badge({ s }) { const [t, c] = STATUS[s] || ["—", "b-set"]; return <span className={"badge " + c}>{t}</span>; }
export function Dot({ d, size = 28 }) { return <span className="dot" style={{ background: d.c, width: size, height: size, fontSize: size < 26 ? 9 : 11 }}>{d.ab}</span>; }
export function Stat({ label, value, sub, color }) {
  return <div className="stat"><div className="cap">{label}</div><div className="num" style={{ fontSize: 24, fontWeight: 600, color: color || "var(--white)" }}>{value}</div>{sub && <div className="cap" style={{ color: "var(--muted)" }}>{sub}</div>}</div>;
}
export function Countdown({ to }) {
  const [label, setLabel] = useState(null);
  useEffect(() => {
    const update = () => setLabel(countdown(to - Date.now()));
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [to]);
  return <span className="num">{label ?? " "}</span>;
}

// Renders on the client only — `when()`'s toLocaleString() is timezone-
// dependent, so computing it during SSR would mismatch a server running in
// a different timezone than the viewer's browser.
export function LocalTime({ ts }) {
  const [label, setLabel] = useState(null);
  useEffect(() => { setLabel(when(ts)); }, [ts]);
  return <span suppressHydrationWarning>{label ?? "—"}</span>;
}

// Client-side pagination over an already-fetched array — matches how
// filtering already works in this codebase (inline useState, no shared
// hook). Renders nothing when everything fits on one page. Shows a
// "1–100 of 12,920" range rather than "Page X of Y".
export function Pagination({ page, pageCount, total, pageSize = PAGE_SIZE, onChange }) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return <div className="flex" style={{ justifyContent: "center", gap: 10, alignItems: "center", marginTop: 16 }}>
    <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
    <span className="cap num">{fmt(start)}–{fmt(end)} of {fmt(total)}</span>
    <button className="btn btn-ghost btn-xs" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>›</button>
  </div>;
}

/* ---------- Landing ---------- */
export function Landing({ S, sessionUser }) {
  const D = useEntrantLookup();
  const race = raceWindow(S.races).find(r => r.status === "open") || S.races.find(r => r.status === "open");
  const pools = race ? driverPools(S.bets, race).sort((a, b) => b.pool - a.pool) : [];
  const total = race ? poolOf(S.bets, race.id) : 0;
  return <div>
    <div className="wrap g2" style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 64, padding: "72px 24px 80px", alignItems: "center" }}>
      <div>
        <div className="flex" style={{ gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <span className="badge b-lock">In-game currency only · No real money</span>
          <span className="badge b-set">Accounts issued by admins</span></div>
        <h1 style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.06, letterSpacing: "-1px" }}>
          BET THE GRID.<br /><span className="yel">SPLIT THE POOL.</span>
        </h1>
        <p style={{ fontSize: 16, color: "var(--muted-2)", maxWidth: 460, marginTop: 20 }}>
          Parimutuel racing betting for the Executive FiveM roleplay server, created and managed by FEAR. Back a driver to finish P1, and winners split the entire race pool proportional to their stake. No bookmaker, no set odds, no house exposure.
        </p>
        <div className="flex" style={{ gap: 12, marginTop: 32 }}>
          <Link href={sessionUser ? "/wallet" : "/login"} className="btn btn-y btn-pill">{sessionUser ? "Wallet" : "Log in"}</Link>
          <Link href="/races" className="btn btn-2 btn-pill">View live pools</Link>
        </div>
        <div className="flex" style={{ gap: 48, marginTop: 56 }}>
          <div><div className="big yel num">{fmt(total)}</div><div className="cap">CR in the current race pool</div></div>
          <div><div className="big yel num">{S.roster.length}</div><div className="cap">Drivers on the grid</div></div>
        </div>
      </div>
      {race ? <div className="card" style={{ padding: 24 }}>
        <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="ttl-sm">{race.name}</div><Badge s={race.status} />
        </div>
        <div className="cap" style={{ marginBottom: 18 }}>Betting closes in <Countdown to={race.lock} /></div>
        <div className="tblwrap"><table>
          <thead><tr><th>Driver</th><th style={{ textAlign: "right" }}>Pool</th><th style={{ textAlign: "right" }}>Pool share</th><th style={{ textAlign: "right" }}>Pays</th></tr></thead>
          <tbody>{pools.slice(0, 6).map(p => { const d = D(p.id); return <tr key={p.id} className="rowhov">
            <td><div className="flex" style={{ gap: 10, alignItems: "center" }}><Dot d={d} size={24} /><div><div style={{ fontWeight: 500 }}>{d.n}</div><div className="cap">{d.t}</div></div></div></td>
            <td className="num" style={{ textAlign: "right" }}>{fmt(p.pool)}</td>
            <td className="num muted2" style={{ textAlign: "right" }}>{(p.share * 100).toFixed(1)}%</td>
            <td className="num up" style={{ textAlign: "right" }}>{p.mult ? p.mult.toFixed(2) + "×" : "—"}</td>
          </tr>; })}</tbody>
        </table></div>
        <Link href="/races" className="btn btn-y" style={{ width: "100%", marginTop: 20, display: "flex" }}>Place a bet</Link>
      </div> : <div className="card" style={{ padding: 24, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div className="ttl-sm" style={{ marginBottom: 6 }}>No race is open for betting right now</div>
        <div className="muted2" style={{ fontSize: 13 }}>Check back once an admin opens the next race.</div>
      </div>}
    </div>
    <div className="wrap" style={{ paddingBottom: 80 }}>
      <div className="grid g3" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        {[["Pooled odds, not bookmaker odds", "Every stake on a race goes into one pool. When the result is in, winners split it in proportion to what they staked. The house never creates or destroys currency — it redistributes."],
        ["Payouts queue themselves", "The moment a race settles, every winner's payout drops into the admin queue automatically. There is no “request payout” button to forget."],
        ["Betting closes at qualifying", "The moment qualifying results are posted, the race auto-locks. Nobody bets on a grid they've already seen."],
        ["Manual handoff, audited ledger", "Top-ups and cash-outs happen in-game with an admin. Every balance-affecting action is logged with who, what, when, and why."]].map(([t, b]) => <div className="card-flat" key={t} style={{ padding: 24 }}>
          <div className="ttl-sm" style={{ marginBottom: 8 }}>{t}</div><div className="muted2" style={{ fontSize: 13 }}>{b}</div>
        </div>)}
      </div>
    </div>
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>Need an account or a top-up? Call an admin</h3>
        <div className="cap" style={{ color: "var(--muted)" }}>Accounts are issued by hand — reach any of them in game</div>
      </div>
      <div className="grid g3" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[["Grizelle Nymera", "47493198"], ["Zoraya Yuvika", "62966544"], ["Raiden Dragneel", "91718956"]].map(([name, num]) => (
          <div className="card-flat" key={name} style={{ padding: 20 }}>
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div className="num yel" style={{ marginTop: 4 }}>{num}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="wrap"><div className="card" style={{ padding: 48, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
      <div><h2 style={{ fontSize: 32, letterSpacing: "-.3px" }}>Four steps from top-up to cash-out</h2>
        <div className="muted2" style={{ marginTop: 10 }}>An admin creates your account and sends a temporary password. Then: deposit → bet → the race settles and your payout queues itself for release → request a withdrawal when you want it in hand.</div></div>
      <Link href={sessionUser ? "/wallet" : "/login"} className="btn btn-y">{sessionUser ? "Wallet" : "Log in"}</Link>
    </div></div>
    <div className="footer"><div className="wrap">
      <div className="brand brand-foot">
        <div className="brand-name">FEAR <span>BETS</span></div>
        <div className="brand-by"><em>powered by</em><img src="/assets/logo-mark.png" alt="AEAR" /></div></div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, maxWidth: 280 }}>An in-game betting sandbox for the Executive FiveM roleplay server, created and managed by FEAR. All currency is fictional and has no cash value.</div>
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--hair)", fontSize: 12, color: "var(--muted)" }}>
        © FEAR 2026.
      </div>
    </div></div>
  </div>;
}

/* ---------- Auth ---------- */
export function Auth({ forcePasswordChange = false } = {}) {
  const router = useRouter();
  const [step, setStep] = useState(forcePasswordChange ? 2 : 1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const weak = pw.length > 0 && pw.length < 8;

  const onAuthenticated = () => { router.push("/dashboard"); router.refresh(); };

  const submitLogin = async () => {
    setError(""); setBusy(true);
    const result = await login({ username, password });
    setBusy(false);
    if (!result?.ok) { setError(result?.error || "Could not log in."); return; }
    if (result.mustChangePassword) setStep(2);
    else onAuthenticated();
  };

  const submitPassword = async () => {
    setError(""); setBusy(true);
    const result = await changePassword({ newPassword: pw });
    setBusy(false);
    if (!result?.ok) { setError(result?.error || "Could not set password."); return; }
    onAuthenticated();
  };
  return <div style={{ display: "grid", placeItems: "center", padding: "72px 24px" }}>
    <div className="card" style={{ width: 440, padding: 32 }}>
      {step === 1 ? <>
        <h2 className="ttl-lg">Log in</h2>
        <div className="muted2" style={{ fontSize: 13, marginTop: 6, marginBottom: 24 }}>Accounts are issued by the <span className="yel">FEAR</span> admin team. Use the username and temporary password they sent you.</div>
        <div style={{ marginBottom: 16 }}><label className="f">USERNAME</label><input className="input" value={username} onChange={ev => setUsername(ev.target.value)} /></div>
        <div style={{ marginBottom: 16 }}><label className="f">PASSWORD</label><input className="input" type="password" value={password} onChange={ev => setPassword(ev.target.value)} /></div>
        {error && <div className="cap down" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-y" style={{ width: "100%", marginTop: 8 }} disabled={busy || !username || !password} onClick={submitLogin}>{busy ? "Logging in…" : "Log in"}</button>
      </> : <>
        <h2 className="ttl-lg">Set your password</h2>
        <div className="muted2" style={{ fontSize: 13, marginTop: 6, marginBottom: 24 }}>You logged in with a temporary password. Choose your own before you start betting.</div>
        <div style={{ marginBottom: 12 }}><label className="f">NEW PASSWORD</label>
          <input className="input" type="password" value={pw} onChange={ev => setPw(ev.target.value)} placeholder="At least 8 characters" /></div>
        <div><label className="f">CONFIRM PASSWORD</label>
          <input className="input" type="password" value={pw2} onChange={ev => setPw2(ev.target.value)} /></div>
        <div className="cap" style={{ marginTop: 8, color: weak ? "var(--down)" : "var(--muted)", minHeight: 18 }}>
          {weak ? "Too short — use at least 8 characters." : pw && pw2 && pw !== pw2 ? "Passwords don't match." : " "}</div>
        {error && <div className="cap down" style={{ marginTop: 4 }}>{error}</div>}
        <button className="btn btn-y" style={{ width: "100%", marginTop: 8 }} disabled={busy || pw.length < 8 || pw !== pw2} onClick={submitPassword}>{busy ? "Saving…" : "Save and go to dashboard"}</button>
      </>}
      <div className="muted" style={{ fontSize: 13, textAlign: "center", marginTop: 20 }}>
        No account? Forgot password? Contact <span className="yel">FEAR</span> directly IC.
      </div>
    </div>
  </div>;
}

/* ---------- Dashboard ---------- */
export function Dashboard({ S, sessionUser }) {
  const D = useEntrantLookup();
  const open = S.bets.filter(b => b.uid === "me" && b.status === "pending");
  const locked = open.reduce((s, b) => s + b.stake, 0);
  const pendingDeposits = S.tx.filter(t => t.type === "deposit" && t.status === "pending").reduce((s, t) => s + t.amount, 0);
  const calendar = raceWindow(S.races).slice().sort((a, b) => b.dt - a.dt);
  const [calPage, setCalPage] = useState(1);
  const calPageCount = Math.max(1, Math.ceil(calendar.length / PAGE_SIZE));
  const calP = Math.min(calPage, calPageCount);
  return <div className="wrap-wide" style={{ padding: "32px 24px 80px" }}>
    <div className="hdr" style={{ marginBottom: 24 }}>
      <div><h2 className="ttl-lg">Welcome back, {(sessionUser?.displayName || "").split(" ")[0] || sessionUser?.username}</h2><div className="muted" style={{ fontSize: 13 }}>Character: {sessionUser?.ign || "—"}</div></div>
      <div className="flex" style={{ gap: 12 }}><Link href="/wallet" className="btn btn-2 btn-sm">Deposit</Link><Link href="/races" className="btn btn-y btn-sm">Place a bet</Link></div>
    </div>
    <div className="grid g4" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
      <div className="card"><Stat label="CONFIRMED BALANCE" value={money(S.balance)} sub="Available to stake" color="var(--yellow)" /></div>
      <div className="card"><Stat label="LOCKED IN OPEN BETS" value={money(locked)} sub={open.length + " open bets"} /></div>
      <div className="card"><Stat label="PENDING WINNINGS" value={money(S.pendingWin || 0)} sub="Auto-queued, awaiting admin payout" color="var(--up)" /></div>
      <div className="card"><Stat label="PENDING DEPOSITS" value={money(pendingDeposits)} sub="Awaiting admin approval" color="var(--muted-2)" /></div>
    </div>
    <div className="grid g2" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
      <div className="card">
        <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="ttl-sm">Race calendar</div><div className="cap">Times shown in your local timezone</div></div>
        <div className="tblwrap"><table><thead><tr><th>Race</th><th>Bets close</th><th>Starts</th><th style={{ textAlign: "right" }}>Total pool</th><th style={{ textAlign: "right" }}>Status</th><th></th></tr></thead>
          <tbody>{calendar.slice((calP - 1) * PAGE_SIZE, calP * PAGE_SIZE).map(r => <tr key={r.id} className="rowhov">
            <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap">{r.circuit}</div></td>
            <td className="num muted2" style={{ fontSize: 13 }}><LocalTime ts={r.lock} /></td>
            <td className="num muted2" style={{ fontSize: 13 }}><LocalTime ts={r.dt} /></td>
            <td className="num" style={{ textAlign: "right" }}>{fmt(poolOf(S.bets, r.id))}</td>
            <td style={{ textAlign: "right" }}><Badge s={r.status} /></td>
            <td style={{ textAlign: "right" }}>{r.status === "open"
              ? <Link href={`/races/${r.id}`} className="btn btn-y btn-xs">Bet</Link>
              : <Link href={`/races/${r.id}`} className="btn btn-ghost btn-xs">View</Link>}</td>
          </tr>)}</tbody></table></div>
        <Pagination page={calP} pageCount={calPageCount} total={calendar.length} onChange={setCalPage} />
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--hair)" }}>
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="ttl-sm">Season championship markets</div>{seasonWindow(S.races)[0] && <div className="cap">{seasonWindow(S.races)[0].circuit}</div>}</div>
          <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {seasonWindow(S.races).map(m => { const ps = driverPools(S.bets, m).sort((a, b) => b.pool - a.pool); const lead = ps[0];
              return <div key={m.id} className="card-flat" style={{ background: "var(--elev)", padding: 18 }}>
                <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div><Badge s={m.status} /></div>
                <div className="num yel" style={{ fontSize: 20, fontWeight: 600, marginTop: 10 }}>{money(poolOf(S.bets, m.id))}</div>
                <div className="cap">Outright pool · {S.bets.filter(b => b.raceId === m.id).length} bets</div>
                <div className="flex" style={{ gap: 8, alignItems: "center", marginTop: 12 }}>
                  {lead ? <>
                    <Dot d={D(lead.id)} size={22} />
                    <div style={{ fontSize: 13 }}>{D(lead.id).n}<span className="muted"> most backed · {(lead.share * 100).toFixed(0)}%</span></div>
                  </> : <div className="cap" style={{ color: "var(--muted)" }}>No entrants yet</div>}</div>
                <Link href={`/championship/${m.id}`} className="btn btn-y btn-sm" style={{ width: "100%", marginTop: 14, display: "flex", justifyContent: "center" }}>Bet outright</Link>
              </div>; })}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 16 }}>Your open bets</div>
        {open.map(b => { const d = D(b.dId), r = S.races.find(x => x.id === b.raceId); const p = driverPools(S.bets, r).find(x => x.id === b.dId);
          return <div key={b.id} style={{ padding: "14px 0", borderTop: "1px solid var(--hair)" }}>
            <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="flex" style={{ gap: 10, alignItems: "center" }}><Dot d={d} size={24} />
                <div><div style={{ fontWeight: 500 }}>{d.n}</div><div className="cap">{r.name}</div></div></div>
              <div style={{ textAlign: "right" }}><div className="num">{fmt(b.stake)} {CUR}</div>
                <div className="cap up">est. {fmt(b.stake * p.mult)} back</div></div>
            </div></div>; })}
        <div style={{ borderTop: "1px solid var(--hair)", paddingTop: 14, marginTop: 6 }}>
          <Link href="/bets" className="btn btn-2 btn-sm" style={{ width: "100%", display: "flex", justifyContent: "center" }}>View all bets</Link></div>
      </div>
    </div>
  </div>;
}

/* ---------- Races index ---------- */
export function RacesIndex({ S }) {
  const router = useRouter();
  const list = raceWindow(S.races).slice().sort((a, b) => b.dt - a.dt);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pageCount);
  return <div className="wrap-wide" style={{ padding: "32px 24px 80px" }}>
    <h2 className="ttl-lg" style={{ marginBottom: 20 }}>Races</h2>
    {list.length ? <div className="card">
      <div className="tblwrap"><table>
        <thead><tr><th>Race</th><th>Bets close</th><th>Starts</th><th style={{ textAlign: "right" }}>Total pool</th><th style={{ textAlign: "right" }}>Status</th></tr></thead>
        <tbody>{list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(r => <tr key={r.id} className="rowhov" style={{ cursor: "pointer" }} onClick={() => router.push(`/races/${r.id}`)}>
          <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap">{r.circuit}</div></td>
          <td className="num muted2" style={{ fontSize: 13 }}><LocalTime ts={r.lock} /></td>
          <td className="num muted2" style={{ fontSize: 13 }}><LocalTime ts={r.dt} /></td>
          <td className="num" style={{ textAlign: "right" }}>{fmt(poolOf(S.bets, r.id))}</td>
          <td style={{ textAlign: "right" }}><Badge s={r.status} /></td>
        </tr>)}</tbody>
      </table></div>
      <Pagination page={p} pageCount={pageCount} total={list.length} onChange={setPage} />
    </div> : <div className="card" style={{ padding: 48, textAlign: "center" }}>
      <div className="ttl-sm" style={{ marginBottom: 6 }}>No races yet</div>
      <div className="muted2" style={{ fontSize: 13 }}>Check back once an admin creates one.</div>
    </div>}
  </div>;
}

/* ---------- Championships index ---------- */
export function ChampionshipsIndex({ S }) {
  const router = useRouter();
  const list = seasonWindow(S.races);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pageCount);
  return <div className="wrap-wide" style={{ padding: "32px 24px 80px" }}>
    <h2 className="ttl-lg" style={{ marginBottom: 20 }}>Championships</h2>
    {list.length ? <div className="card">
      <div className="tblwrap"><table>
        <thead><tr><th>Market</th><th style={{ textAlign: "right" }}>Total pool</th><th style={{ textAlign: "right" }}>Status</th></tr></thead>
        <tbody>{list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(r => <tr key={r.id} className="rowhov" style={{ cursor: "pointer" }} onClick={() => router.push(`/championship/${r.id}`)}>
          <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap">{r.circuit}</div></td>
          <td className="num" style={{ textAlign: "right" }}>{fmt(poolOf(S.bets, r.id))}</td>
          <td style={{ textAlign: "right" }}><Badge s={r.status} /></td>
        </tr>)}</tbody>
      </table></div>
      <Pagination page={p} pageCount={pageCount} total={list.length} onChange={setPage} />
    </div> : <div className="card" style={{ padding: 48, textAlign: "center" }}>
      <div className="ttl-sm" style={{ marginBottom: 6 }}>No championship markets yet</div>
      <div className="muted2" style={{ fontSize: 13 }}>Check back once an admin creates a championship.</div>
    </div>}
  </div>;
}

/* ---------- Race betting page ---------- */
export function RacePage({ S, race, siblings, basePath, sessionUser }) {
  const D = useEntrantLookup();
  const run = useServerAction();
  const season = race.kind === "season";
  const [sel, setSel] = useState(null);
  const [stake, setStake] = useState("");
  const pools = driverPools(S.bets, race);
  const total = poolOf(S.bets, race.id);
  const canBet = race.status === "open";
  const selP = pools.find(p => p.id === sel);
  const st = Number(stake) || 0;
  const est = selP && st ? (total + st) * (1 - race.rake / 100) * (st / (selP.pool + st)) : 0;
  const myBets = S.bets.filter(b => b.uid === "me" && b.raceId === race.id);
  useEffect(() => { setSel(null); setStake(""); }, [race.id]);

  return <div className="wrap-wide" style={{ padding: "24px 24px 80px" }}>
    <div className="grid g2" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
      <div>
        <div className="card" style={{ marginBottom: 24, padding: "20px 24px" }}>
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div><div className="flex" style={{ gap: 12, alignItems: "center" }}><h2 className="ttl-lg">{race.name}</h2><Badge s={race.status} /></div>
              <div className="cap" style={{ marginTop: 6 }}>{race.circuit} · {season ? "Title decided at the final round" : "Race starts " + when(race.dt)}</div></div>
            <div style={{ textAlign: "right" }}>
              <div className="cap">{race.status === "open" ? (season ? "MARKET CLOSES BEFORE FINAL ROUND" : "BETTING CLOSES IN") : "BETTING CLOSED"}</div>
              <div className="num" style={{ fontSize: season && canBet ? 15 : 24, fontWeight: 600, color: canBet ? "var(--yellow)" : "var(--muted)" }}>
                {canBet ? (season ? "Locks with the final round" : <Countdown to={race.lock} />) : race.status === "settled" ? "Settled" : "At qualifying"}</div></div>
          </div>
          <div className="flex" style={{ gap: 40, marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--hair)" }}>
            <div><div className="cap">TOTAL POOL</div><div className="num yel" style={{ fontSize: 20, fontWeight: 600 }}>{money(total)}</div></div>
            <div><div className="cap">BETS PLACED</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{S.bets.filter(b => b.raceId === race.id).length}</div></div>
            <div><div className="cap">HOUSE RAKE</div><div className="num" style={{ fontSize: 20, fontWeight: 600 }}>{race.rake}%</div></div>
            {race.result && <div><div className="cap">{season ? "CHAMPION" : "OFFICIAL P1"}</div><div className="num up" style={{ fontSize: 20, fontWeight: 600 }}>{D(race.result).n}</div></div>}
          </div>
        </div>
        <div className="card">
          <div className="flex" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div className="ttl-sm">{season ? (race.market === "constructors" ? "Outright market — constructor to win the title" : "Outright market — driver to win the title") : "Win market — driver to finish P1"}</div>
            <div className="cap">{race.status === "settled" ? "Final classification" : "Payout multiples move as the pool moves"}</div></div>
          <div className="driverrow" style={{ padding: "0 16px 10px", cursor: "default" }}>
            <div className="cap" style={{ textAlign: "center" }}>{race.status === "settled" && !season ? "POS" : ""}</div><div className="cap">{season ? (race.market === "constructors" ? "CONSTRUCTOR" : "DRIVER") : "DRIVER"}</div><div className="cap" style={{ textAlign: "right" }}>{season ? "OUTRIGHT POOL" : "DRIVER POOL"}</div>
            <div className="cap" style={{ textAlign: "right" }}>POOL SHARE</div><div className="cap" style={{ textAlign: "right" }}>PAYS</div></div>
          {(classifyOrder(race, pools.map(x => x.id)) || pools.map(x => x.id)).map(pid => pools.find(x => x.id === pid)).map(p => { const d = D(p.id); const win = race.result === p.id; const f = finishOf(race, p.id); const out = f && f.st;
            return <div key={p.id} className={"driverrow" + (sel === p.id ? " sel" : "") + (win ? " win" : out ? " out" : "")} onClick={() => canBet && setSel(p.id)}>
              {f ? <span className={"poschip" + (f.pos === 1 ? " p1" : out ? " out" : "")}>{out ? CLS_LABEL[f.st] : "P" + f.pos}</span> : <Dot d={d} />}
              <div><div className="flex" style={{ gap: 8, alignItems: "center", fontWeight: 500 }}>
                {f && <Dot d={d} size={20} />}<span>{d.n}</span>
                {win && <span className="badge b-open">Winner</span>}
                {race.fl === p.id && <span className="badge b-lock">Fastest lap</span>}</div>
                <div className="cap">{out ? CLS_TEXT[f.st] + ((race.why || {})[p.id] ? " — " + race.why[p.id] : "") + " · " + d.t : season ? (((race.market === "constructors" ? S.teams : S.roster).find(x => x.id === p.id) || {}).pts || 0) + " pts · " + d.t : d.t + " · " + p.backers + " backers"}</div></div>
              <div style={{ textAlign: "right" }}><div className="num">{fmt(p.pool)}</div><div className="cap">{CUR}</div></div>
              <div style={{ textAlign: "right" }}><div className="num muted2">{(p.share * 100).toFixed(1)}%</div>
                <div className="poolbar" style={{ marginTop: 5 }}><i style={{ width: Math.max(2, p.share * 100) + "%" }} /></div></div>
              <div className="num" style={{ textAlign: "right", fontWeight: 600, color: p.mult >= 1 ? "var(--up)" : "var(--down)" }}>{p.mult ? p.mult.toFixed(2) + "×" : "—"}</div>
            </div>; })}
        </div>
      </div>
      <div style={{ position: "sticky", top: 88, display: "grid", gap: 16 }}>
        <div className="card">
          <div className="ttl-sm" style={{ marginBottom: 4 }}>Bet slip</div>
          <div className="cap" style={{ marginBottom: 16 }}>Balance {money(S.balance)}</div>
          {!canBet ? <div className="card-flat" style={{ background: "var(--elev)", fontSize: 13, color: "var(--muted-2)" }}>
            {race.status === "held" ? "This market is frozen while the admins investigate the result. Your stake stays locked until they settle or void it." : race.status === "locked" ? "Qualifying results are posted — this race is locked and no longer accepting bets." : race.status === "settled" ? "This market has settled. Payouts were auto-queued for every backer of the winner." : "Betting has not opened for this race yet."}
          </div> : !selP ? <div className="card-flat" style={{ background: "var(--elev)", fontSize: 13, color: "var(--muted-2)" }}>{sessionUser ? "Select a driver from the win market to build your slip." : <>Select a driver, then <Link href="/login">log in</Link> to place a bet.</>}</div> : <>
            <div className="flex" style={{ gap: 10, alignItems: "center", marginBottom: 16 }}><Dot d={D(sel)} />
              <div><div style={{ fontWeight: 500 }}>{D(sel).n}</div><div className="cap">{season ? (race.market === "constructors" ? "To win the Constructors' Championship" : "To win the Drivers' Championship") : "To finish P1"} · {race.name}</div></div></div>
            <label className="f">STAKE ({CUR})</label>
            <input className="input input-lg" value={stake} placeholder="0" onChange={e => setStake(e.target.value.replace(/[^\d]/g, ""))} />
            <div className="flex" style={{ gap: 8, marginTop: 10 }}>
              {[1000, 5000, 10000].map(v => <button key={v} className="btn btn-ghost btn-xs" onClick={() => setStake(String(v))}>{fmt(v)}</button>)}
              <button className="btn btn-ghost btn-xs" onClick={() => setStake(String(S.balance))}>Max</button></div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
              <div className="kv"><span className="muted">{season ? (race.market === "constructors" ? "Constructor" : "Driver") : "Driver"} pool after bet</span><span className="num">{fmt(selP.pool + st)} {CUR}</span></div>
              <div className="kv"><span className="muted">Total pool after bet</span><span className="num">{fmt(total + st)} {CUR}</span></div>
              <div className="kv"><span className="muted">Your share of that pool</span><span className="num">{selP.pool + st ? ((st / (selP.pool + st)) * 100).toFixed(1) : "0.0"}%</span></div>
              <div className="kv" style={{ borderTop: "1px solid var(--hair)", marginTop: 6, paddingTop: 12 }}>
                <span style={{ fontWeight: 600 }}>Estimated return if {season ? "champion" : "P1"}</span><span className="num up" style={{ fontWeight: 600 }}>{fmt(est)} {CUR}</span></div>
              <div className="cap" style={{ color: "var(--muted)", marginTop: 8 }}>{season ? "Estimate only. Season pools keep moving until the market closes ahead of the final round." : "Estimate only. The final split is calculated from the pool as it stands at lock."}</div>
            </div>
            <button className="btn btn-y" style={{ width: "100%", marginTop: 16 }} disabled={!st || st > S.balance}
              onClick={() => {
                run(placeBetAction, { raceId: race.id, entrantId: sel, stake: st }, `Bet confirmed — ${money(st)} on ${D(sel).n} ${season ? (race.market === "constructors" ? "to win the Constructors' Championship" : "to win the Drivers' Championship") : "to finish P1"}.`);
                setSel(null); setStake("");
              }}>
              {st > S.balance ? "Insufficient balance" : "Confirm bet"}</button>
          </>}
        </div>
        {myBets.length > 0 && <div className="card"><div className="ttl-sm" style={{ marginBottom: 10 }}>Your bets on this {season ? "market" : "race"}</div>
          {myBets.map(b => <div key={b.id} className="flex" style={{ justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--hair)" }}>
            <div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={D(b.dId)} size={22} /><span style={{ fontSize: 13 }}>{D(b.dId).n}</span></div>
            <span className="num">{fmt(b.stake)} {CUR}</span></div>)}</div>}
      </div>
    </div>
  </div>;
}

/* ---------- Wallet ---------- */
export function Wallet({ S, sessionUser }) {
  const run = useServerAction();
  const ign = sessionUser?.ign || sessionUser?.displayName || "your character";
  const [side, setSide] = useState("deposit");
  const [step, setStep] = useState(1);
  const [amt, setAmt] = useState("10000");
  const [wamt, setWamt] = useState("");
  const [dest, setDest] = useState("Cash handoff · Mirror Park garage");
  const [wstep, setWstep] = useState(1);
  const locked = S.bets.filter(b => b.uid === "me" && b.status === "pending").reduce((s, b) => s + b.stake, 0);
  const pendWd = S.pendingWd || 0;
  const w = Number(wamt) || 0;
  const TT = { deposit: ["Deposit", "var(--up)"], win: ["Win", "var(--up)"], bet: ["Bet", "var(--body)"], withdrawal: ["Withdrawal", "var(--yellow)"], adjustment: ["Adjustment", "var(--muted-2)"] };
  const DESTS = ["Cash handoff · Mirror Park garage", "Cash handoff · Vinewood casino lot", "Bank transfer · Fleeca Legion Sq."];
  const [txPage, setTxPage] = useState(1);
  const txPageCount = Math.max(1, Math.ceil(S.tx.length / PAGE_SIZE));
  const txP = Math.min(txPage, txPageCount);
  return <div className="wrap-wide" style={{ padding: "32px 24px 80px" }}>
    <h2 className="ttl-lg" style={{ marginBottom: 20 }}>Wallet</h2>
    <div className="grid g2" style={{ gridTemplateColumns: "1fr 380px", alignItems: "start" }}>
      <div>
        <div className="grid g3" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 24 }}>
          <div className="card"><Stat label="CONFIRMED" value={money(S.balance)} sub="Available to stake or withdraw" color="var(--yellow)" /></div>
          <div className="card"><Stat label="LOCKED IN BETS" value={money(locked)} sub="Released when races settle" /></div>
          <div className="card"><Stat label="PENDING WINNINGS" value={money(S.pendingWin || 0)} sub="Auto-queued, awaiting admin payout" color="var(--up)" /></div>
          <div className="card"><Stat label="PENDING WITHDRAWAL" value={money(pendWd)} sub="Awaiting admin approval" color="var(--muted-2)" /></div>
        </div>
        <div className="card">
          <div className="ttl-sm" style={{ marginBottom: 14 }}>Transaction history</div>
          <div className="tblwrap"><table><thead><tr><th>Type</th><th>Detail</th><th>When</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Status</th></tr></thead>
            <tbody>{S.tx.slice((txP - 1) * PAGE_SIZE, txP * PAGE_SIZE).map(t => <tr key={t.id} className="rowhov">
              <td style={{ fontWeight: 500, color: (TT[t.type] || [])[1] }}>{(TT[t.type] || [t.type])[0]}</td>
              <td className="muted2" style={{ fontSize: 13 }}>{t.note}</td>
              <td className="muted num" style={{ fontSize: 13 }}>{ago(t.at)}</td>
              <td className="num" style={{ textAlign: "right", color: t.amount > 0 ? "var(--up)" : "var(--body)" }}>{t.amount > 0 ? "+" : ""}{fmt(t.amount)}</td>
              <td style={{ textAlign: "right" }}><span className={"badge " + (t.status === "pending" ? "b-pend" : t.status === "refunded" ? "b-live" : "b-set")}>{t.status}</span></td>
            </tr>)}</tbody></table></div>
          <Pagination page={txP} pageCount={txPageCount} total={S.tx.length} onChange={setTxPage} />
        </div>
      </div>
      <div className="card">
        <div className="flex" style={{ gap: 6, marginBottom: 16 }}>
          <button className={"pill-tab" + (side === "deposit" ? " on" : "")} onClick={() => setSide("deposit")}>Deposit</button>
          <button className={"pill-tab" + (side === "withdraw" ? " on" : "")} onClick={() => setSide("withdraw")}>Withdraw</button>
        </div>
        {side === "deposit" ? <>
          <div className="ttl-sm" style={{ marginBottom: 4 }}>Deposit request</div>
          <div className="cap" style={{ marginBottom: 18 }}>Step {step} of 2</div>
          {step === 1 && <>
            <label className="f">AMOUNT TO TOP UP ({CUR})</label>
            <input className="input input-lg" value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d]/g, ""))} />
            <div className="flex" style={{ gap: 8, marginTop: 10 }}>{[5000, 10000, 25000].map(v => <button key={v} className="btn btn-ghost btn-xs" onClick={() => setAmt(String(v))}>{fmt(v)}</button>)}</div>
            <button className="btn btn-y" style={{ width: "100%", marginTop: 18 }} disabled={!Number(amt)} onClick={() => { run(requestDeposit, { amount: Number(amt) }, `Deposit request for ${money(Number(amt))} sent to the admin queue.`); setStep(2); }}>Request deposit</button>
          </>}
          {step === 2 && <>
            <div className="card-flat" style={{ background: "var(--elev)", textAlign: "center", padding: 24 }}>
              <div className="badge b-pend" style={{ marginBottom: 12 }}>Pending admin approval</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700 }}>{money(Number(amt))}</div>
              <div className="cap" style={{ marginTop: 8 }}>Sitting in the admin deposit queue. You'll be notified when it's credited or rejected.</div>
            </div>
            <button className="btn btn-2" style={{ width: "100%", marginTop: 16 }} onClick={() => setStep(1)}>New deposit request</button>
          </>}
        </> : <>
          <div className="ttl-sm" style={{ marginBottom: 4 }}>Withdraw</div>
          <div className="cap" style={{ marginBottom: 18 }}>Step {wstep} of 2 · every cash-out is approved by an admin by hand</div>
          {wstep === 1 ? <>
            <label className="f">AMOUNT TO WITHDRAW ({CUR})</label>
            <input className="input input-lg" value={wamt} placeholder="0" onChange={e => setWamt(e.target.value.replace(/[^\d]/g, ""))} />
            <div className="flex" style={{ gap: 8, marginTop: 10 }}>
              {[5000, 25000].map(v => <button key={v} className="btn btn-ghost btn-xs" disabled={v > S.balance} onClick={() => setWamt(String(v))}>{fmt(v)}</button>)}
              <button className="btn btn-ghost btn-xs" onClick={() => setWamt(String(S.balance))}>All ({fmt(S.balance)})</button></div>
            <div style={{ marginTop: 16 }}><label className="f">WHERE TO HAND IT OVER</label>
              <select className="input" value={dest} onChange={e => setDest(e.target.value)}>{DESTS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--hair)" }}>
              <div className="kv"><span className="muted">Confirmed balance</span><span className="num">{fmt(S.balance)} {CUR}</span></div>
              <div className="kv"><span className="muted">This request</span><span className="num">−{fmt(w)} {CUR}</span></div>
              <div className="kv" style={{ borderTop: "1px solid var(--hair)", marginTop: 6, paddingTop: 12 }}>
                <span style={{ fontWeight: 600 }}>Balance after</span><span className="num" style={{ fontWeight: 600 }}>{fmt(Math.max(0, S.balance - w))} {CUR}</span></div>
              <div className="cap" style={{ color: "var(--muted)", marginTop: 8 }}>The amount leaves your balance now and is held until an admin approves it. Rejected requests come straight back.</div>
            </div>
            <button className="btn btn-y" style={{ width: "100%", marginTop: 16 }} disabled={!w || w > S.balance}
              onClick={() => setWstep(2)}>{w > S.balance ? "Exceeds balance" : "Review request"}</button>
          </> : <>
            <div className="card-flat" style={{ background: "var(--elev)", padding: 20, marginBottom: 16 }}>
              <div className="cap" style={{ marginBottom: 8 }}>REQUESTING</div>
              <div className="num yel" style={{ fontSize: 28, fontWeight: 700 }}>{money(w)}</div>
              <div className="kv" style={{ marginTop: 10 }}><span className="muted">To</span><span>{ign}</span></div>
              <div className="kv"><span className="muted">Handoff</span><span style={{ textAlign: "right" }}>{dest}</span></div>
            </div>
            <button className="btn btn-y" style={{ width: "100%" }} onClick={() => { run(requestWithdrawal, { amount: w, destination: dest }); setWamt(""); setWstep(1); }}>Submit for approval</button>
            <button className="btn btn-t btn-sm" style={{ width: "100%", marginTop: 6 }} onClick={() => setWstep(1)}>Back</button>
          </>}
          {pendWd > 0 && <div className="card-flat" style={{ background: "var(--elev)", marginTop: 16, padding: "12px 14px" }}>
            <div className="cap" style={{ marginBottom: 6 }}>IN THE QUEUE</div>
            {(S.myWithdrawals || []).map(x =>
              <div key={x.id} className="flex" style={{ justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
                <span className="muted2">{x.dest}</span>
                <span className="flex" style={{ gap: 8, alignItems: "center" }}><span className="num">{fmt(x.amount)}</span>
                  <span className={"badge " + (x.status === "approved" ? "b-lock" : "b-pend")}>{x.status}</span></span></div>)}
          </div>}
        </>}
        <div className="card-flat" style={{ background: "var(--elev)", marginTop: 16, padding: "14px 16px" }}>
          <div className="cap" style={{ marginBottom: 8 }}>CONTACT FOR HANDOFF</div>
          {CONTACTS.map(c => <div key={c.number} className="flex" style={{ justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
            <span className="muted2">{c.name}</span><span className="num">{c.number}</span>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}
const CONTACTS = [
  { name: "Grizelle Nymera", number: "47493198" },
  { name: "Zoraya Yuvika", number: "62966544" },
  { name: "Raiden Dragneel", number: "91718956" },
];

/* ---------- My bets ---------- */
export function MyBets({ S }) {
  const D = useEntrantLookup();
  const [tab, setTab] = useState("all");
  const mine = S.bets;
  const list = mine.filter(b => tab === "all" || (tab === "open" && b.status === "pending") || (tab === "settled" && b.status !== "pending"));
  const won = mine.filter(b => b.status === "won"), staked = mine.reduce((s, b) => s + b.stake, 0), ret = mine.reduce((s, b) => s + b.payout, 0);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pageCount);
  return <div className="wrap-wide" style={{ padding: "32px 24px 80px" }}>
    <h2 className="ttl-lg" style={{ marginBottom: 20 }}>My bets</h2>
    <div className="grid g4" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
      <div className="card"><Stat label="BETS PLACED" value={mine.length} /></div>
      <div className="card"><Stat label="TOTAL STAKED" value={money(staked)} /></div>
      <div className="card"><Stat label="TOTAL RETURNED" value={money(ret)} color="var(--up)" /></div>
      <div className="card"><Stat label="HIT RATE" value={Math.round(won.length / mine.filter(b => b.status !== "pending").length * 100) + "%"} sub={won.length + (won.length === 1 ? " win" : " wins") + " from settled bets"} /></div>
    </div>
    <div className="card">
      <div className="flex" style={{ gap: 6, marginBottom: 14 }}>
        {[["all", "All"], ["open", "Open"], ["settled", "Settled"]].map(([k, l]) => <button key={k} className={"pill-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="tblwrap"><table><thead><tr><th>Race</th><th>Pick</th><th>Placed</th><th style={{ textAlign: "right" }}>Stake</th><th style={{ textAlign: "right" }}>Returned</th><th style={{ textAlign: "right" }}>Result</th></tr></thead>
        <tbody>{list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(b => { const r = S.races.find(x => x.id === b.raceId), d = D(b.dId);
          return <tr key={b.id} className="rowhov">
            <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="cap">{r.circuit}</div></td>
            <td><div className="flex" style={{ gap: 8, alignItems: "center" }}><Dot d={d} size={22} /><div>{d.n}
              {(() => { const f = finishOf(r, b.dId); return f ? <div className="cap" style={{ color: f.pos === 1 ? "var(--yellow)" : f.st ? "var(--down)" : "var(--muted)" }}>
                {f.st ? CLS_LABEL[f.st] + ((r.why || {})[b.dId] ? " — " + r.why[b.dId] : "") : "finished P" + f.pos}</div> : null; })()}</div></div></td>
            <td className="muted num" style={{ fontSize: 13 }}>{ago(b.at)}</td>
            <td className="num" style={{ textAlign: "right" }}>{fmt(b.stake)}</td>
            <td className="num" style={{ textAlign: "right", color: b.payout ? "var(--up)" : "var(--muted)" }}>{b.payout ? "+" + fmt(b.payout) : "—"}</td>
            <td style={{ textAlign: "right" }}><span className={"badge " + (b.status === "won" ? "b-open" : b.status === "lost" ? "b-live" : "b-pend")}>{b.status === "pending" ? (r.status === "locked" ? "locked" : "open") : b.status}</span></td>
          </tr>; })}</tbody></table></div>
      <Pagination page={p} pageCount={pageCount} total={list.length} onChange={setPage} />
    </div>
  </div>;
}
