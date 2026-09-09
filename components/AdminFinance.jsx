"use client";
import { useState } from "react";
import { Stat } from "./UserScreens";
import { useServerAction } from "@/lib/useServerAction";
import { money, ago } from "@/lib/store";
import { logHouseTransaction } from "@/app/actions/finance";

const TYPE_LABEL = {
  rake: "Rake", deposit: "Deposit", withdrawal: "Withdrawal",
  manual_in: "Manual in", manual_out: "Manual out",
  correction_in: "Correction in", correction_out: "Correction out",
};

export function AdminFinance({ S }) {
  const run = useServerAction();
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const n = Number(amt) || 0;

  const [type, setType] = useState("all");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const types = Object.keys(TYPE_LABEL);
  const admins = [...new Set(S.ledger.map(l => l.admin))];
  const list = S.ledger.filter(l => (type === "all" || l.type === type) && (who === "all" || l.admin === who)
    && (l.note + l.admin).toLowerCase().includes(q.toLowerCase()));

  return <div>
    <div className="hdr" style={{ marginBottom: 20 }}>
      <div><h2 className="ttl-lg">Finance</h2>
        <div className="muted" style={{ fontSize: 13 }}>The shared house wallet — real cash FEAR is holding. Most of the balance is still owed back to players; rake is the house's actual take.</div></div>
    </div>

    <div className="card" style={{ marginBottom: 12 }}>
      <Stat label="HOUSE BALANCE" value={`${money(S.balance)} (${money(S.credits)})`} sub="Deposits − withdrawals + manual · (rake + logged transactions)" color="var(--yellow)" />
    </div>

    <div className="grid g3" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 24 }}>
      <div className="card"><Stat label="TOTAL RAKE EARNED" value={money(S.totalRake)} sub="The house's actual take" color="var(--up)" /></div>
      <div className="card"><Stat label="TOTAL DEPOSITS" value={money(S.totalDeposits)} sub="Approved, all time" /></div>
      <div className="card"><Stat label="TOTAL WITHDRAWALS" value={money(Math.abs(S.totalWithdrawals))} sub="Paid, all time" /></div>
    </div>

    <div className="card" style={{ padding: "14px 20px", marginBottom: 16 }}>
      <div className="flex" style={{ gap: 20, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}><span className="cap">TYPE</span>
          <button className={"pill-tab" + (type === "all" ? " on" : "")} onClick={() => setType("all")}>All</button>
          {types.map(t => <button key={t} className={"pill-tab" + (type === t ? " on" : "")} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>)}</div>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}><span className="cap">ADMIN</span>
          <button className={"pill-tab" + (who === "all" ? " on" : "")} onClick={() => setWho("all")}>All</button>
          {admins.map(a => <button key={a} className={"pill-tab" + (who === a ? " on" : "")} onClick={() => setWho(a)}>{a}</button>)}</div>
      </div>
      <input className="input" style={{ width: 260 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search notes" />
    </div>
    <div className="grid g2" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 14 }}>Ledger</div>
        <div className="tblwrap"><table>
          <thead><tr><th style={{ width: 110 }}>When</th><th>Type</th><th>Note</th><th>Admin</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>{list.map(l => <tr key={l.id} className="rowhov">
            <td className="muted num" style={{ fontSize: 13 }}>{ago(l.at)}</td>
            <td><span className="badge b-set">{TYPE_LABEL[l.type] || l.type}</span></td>
            <td className="muted2 wrapcell" style={{ fontSize: 13 }}>{l.note}</td>
            <td className="muted2" style={{ fontSize: 13 }}>{l.admin}</td>
            <td className="num" style={{ textAlign: "right", fontWeight: 600, color: l.amount >= 0 ? "var(--up)" : "var(--down)" }}>
              {l.amount >= 0 ? "+" : ""}{money(l.amount)}</td>
          </tr>)}</tbody>
        </table></div>
        {!list.length && <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>{S.ledger.length ? "No entries match these filters." : "No ledger entries yet."}</div>}
        {!!S.ledger.length && <div className="cap" style={{ marginTop: 14, color: "var(--muted)" }}>Showing {list.length} of {S.ledger.length} entries</div>}
      </div>
      <div className="card">
        <div className="ttl-sm" style={{ marginBottom: 4 }}>Log a transaction</div>
        <div className="cap" style={{ marginBottom: 14 }}>For cash moving in or out of the house wallet outside the normal deposit/withdrawal/settlement flow.</div>
        <label className="f">AMOUNT — USE NEGATIVE FOR MONEY OUT</label>
        <input className="input" value={amt} onChange={e => setAmt(e.target.value.replace(/[^-\d]/g, ""))} placeholder="e.g. -3000" />
        <div style={{ marginTop: 12 }}><label className="f">REASON (REQUIRED, LOGGED)</label>
          <textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Cash pulled out for prize sponsorship" /></div>
        <button className="btn btn-y" style={{ width: "100%", marginTop: 16 }} disabled={!n || !note.trim()}
          onClick={() => {
            run(logHouseTransaction, { amount: n, note: note.trim() }, `${n > 0 ? "Added" : "Withdrew"} ${money(Math.abs(n))}.`);
            setAmt(""); setNote("");
          }}>{n > 0 ? "Log money in" : n < 0 ? "Log money out" : "Log transaction"}</button>
      </div>
    </div>
  </div>;
}
