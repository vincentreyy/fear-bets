"use client";
import { useState } from "react";
import { Stat, Pagination } from "./UserScreens";
import { useServerAction } from "@/lib/useServerAction";
import { useToast } from "@/components/ToastProvider";
import { CUR, fmt, money, ago, PAGE_SIZE, PERMS, ALL_PERMS, PERM_LABEL } from "@/lib/store";
import { createUser, resetPassword, toggleUserStatus, adjustBalance } from "@/app/actions/users";
import { createRole, editRole, deleteRole, setUserRole } from "@/app/actions/roles";

function copyToClipboard(text, say) {
  navigator.clipboard.writeText(text).then(() => say("Copied to clipboard.")).catch(() => say("Couldn't copy — select and copy manually."));
}

// Shown after createUser/resetPassword succeed — the temp password is only
// ever returned once by the action, so it has to be surfaced here rather
// than looked up later.
function TempPasswordModal({ title, username, tempPassword, onClose }) {
  const { say } = useToast();
  return <div className="modal-bg" onClick={onClose}><div className="modal" style={{ maxWidth: 440 }} onClick={ev => ev.stopPropagation()}>
    <h3 className="ttl-md">{title}</h3>
    <div className="muted2" style={{ fontSize: 13, margin: "8px 0 20px" }}>Send this to @{username} — they'll be forced to set their own password on next login.</div>
    <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px" }}>
      <div className="cap" style={{ marginBottom: 6 }}>TEMPORARY PASSWORD</div>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span className="num" style={{ background: "var(--canvas)", padding: "6px 12px", borderRadius: 6, fontSize: 13 }}>{tempPassword}</span>
        <button className="btn btn-ghost btn-xs" onClick={() => copyToClipboard(tempPassword, say)}>Copy</button></div>
      <div className="cap" style={{ color: "var(--muted)", marginTop: 8 }}>Shown once — it can't be retrieved again after you close this.</div>
    </div>
    <div className="flex" style={{ marginTop: 20, justifyContent: "flex-end" }}>
      <button className="btn btn-y btn-sm" onClick={onClose}>Done</button>
    </div>
  </div></div>;
}

export function AdminUsers({ S }) {
  const run = useServerAction();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [adj, setAdj] = useState("");
  const [reason, setReason] = useState("");
  const [nu, setNu] = useState(null);
  const [pwReveal, setPwReveal] = useState(null);
  const list = S.users.filter(u => (u.name + u.ign + u.un).toLowerCase().includes(q.toLowerCase()));
  const u = S.users.find(x => x.id === open);
  const total = S.users.reduce((s, x) => s + x.bal + x.locked, 0);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pageCount);
  return <div>
    <div className="hdr" style={{ marginBottom: 20 }}>
      <div><h2 className="ttl-lg">Users</h2><div className="muted" style={{ fontSize: 13 }}>{S.users.length} accounts · {money(total)} held across confirmed balances and locked stakes</div></div>
      <div className="flex" style={{ gap: 10 }}>
        <input className="input" style={{ width: 260 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, username, character" />
        <button className="btn btn-y btn-sm" onClick={() => setNu({ name: "", ign: "", un: "", bal: "", roleId: "" })}>Create account</button>
      </div>
    </div>
    <div className="grid g4" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 24 }}>
      <div className="card"><Stat label="ACTIVE ACCOUNTS" value={S.users.filter(x => x.status === "active").length} /></div>
      <div className="card"><Stat label="SUSPENDED" value={S.users.filter(x => x.status === "suspended").length} color="var(--down)" /></div>
      <div className="card"><Stat label="FLAGGED FOR REVIEW" value={S.users.filter(x => x.flags.length).length} sub="Manual review recommended" color="var(--yellow)" /></div>
      <div className="card"><Stat label="AWAITING FIRST LOGIN" value={S.users.filter(x => x.invited).length} sub="Temporary password not yet changed" color="var(--muted-2)" /></div>
    </div>
    <div className="card">
      <div className="tblwrap tbl-wide"><table>
        <thead><tr><th>User</th><th>Character</th><th>Role</th><th style={{ textAlign: "right" }}>Balance</th><th style={{ textAlign: "right" }}>Locked</th><th style={{ textAlign: "right" }}>Net P/L</th><th style={{ textAlign: "right" }}>Status</th><th></th></tr></thead>
        <tbody>{list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(x => { const pl = x.ret - x.staked;
          return <tr key={x.id} className="rowhov">
            <td><div style={{ fontWeight: 500 }}>{x.name}</div><div className="cap">@{x.un}</div></td>
            <td><div className="muted2">{x.ign}</div><div className="cap">{x.invited ? "invited " : "joined "}{ago(x.joined)}</div></td>
            <td>{x.roleId ? <span className="badge b-lock">{(S.roles.find(r => r.id === x.roleId) || {}).name}</span> : <span className="cap muted">player</span>}</td>
            <td className="num" style={{ textAlign: "right" }}>{fmt(x.bal)}</td>
            <td className="num muted2" style={{ textAlign: "right" }}>{fmt(x.locked)}</td>
            <td className="num" style={{ textAlign: "right", color: pl >= 0 ? "var(--up)" : "var(--down)" }}>{pl >= 0 ? "+" : ""}{fmt(pl)}</td>
            <td style={{ textAlign: "right" }}><span className={"badge " + (x.invited ? "b-pend" : x.status === "active" ? "b-open" : "b-live")}>{x.invited ? "temp password" : x.status}</span>
              {x.flags.length > 0 && <div className="cap" style={{ color: "var(--yellow)", marginTop: 4 }}>{x.flags.length} flag{x.flags.length > 1 ? "s" : ""}</div>}</td>
            <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-xs" onClick={() => { setOpen(x.id); setAdj(""); setReason(""); }}>Manage</button></td>
          </tr>; })}</tbody>
      </table></div>
      {!list.length && <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>No accounts match “{q}”.</div>}
      <Pagination page={p} pageCount={pageCount} total={list.length} onChange={setPage} />
    </div>
    {nu && <div className="modal-bg" onClick={() => setNu(null)}><div className="modal" style={{ maxWidth: 520 }} onClick={ev => ev.stopPropagation()}>
      <h3 className="ttl-md">Create account</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 20px" }}>Players can't sign themselves up. You create the account and send them the temporary password — they set their own on first login. Login is username-based; no email is collected.</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label className="f">DISPLAY NAME</label><input className="input" value={nu.name} onChange={ev => setNu(v => ({ ...v, name: ev.target.value }))} placeholder="Otto Braun" /></div>
        <div><label className="f">IN-GAME CHARACTER</label><input className="input" value={nu.ign} onChange={ev => setNu(v => ({ ...v, ign: ev.target.value }))} placeholder="O. Braun" /></div>
      </div>
      <div style={{ marginTop: 12 }}><label className="f">USERNAME</label>
        <input className="input" value={nu.un} onChange={ev => setNu(v => ({ ...v, un: ev.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase() }))} placeholder="obraun" />
        <div className="cap" style={{ color: "var(--muted)", marginTop: 4 }}>What they log in with. No email is collected.</div></div>
      <div style={{ marginTop: 12 }}><label className="f">ADMIN ROLE — OPTIONAL</label>
        <select className="input" value={nu.roleId} onChange={ev => setNu(v => ({ ...v, roleId: ev.target.value }))}>
          <option value="">No admin access — regular player</option>
          {S.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select></div>
      <div style={{ marginTop: 12 }}><label className="f">OPENING BALANCE ({CUR}) — OPTIONAL</label>
        <input className="input" value={nu.bal} onChange={ev => setNu(v => ({ ...v, bal: ev.target.value.replace(/[^\d]/g, "") }))} placeholder="0" /></div>
      <div className="cap" style={{ color: "var(--muted)", marginTop: 16 }}>A temporary password will be generated automatically once the account is created. The player is forced to replace it at first login.</div>
      <div className="flex" style={{ gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setNu(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" disabled={!nu.name.trim() || !nu.ign.trim() || !nu.un.trim() || S.users.some(x => x.un === nu.un.trim())}
          onClick={async () => {
            const un = nu.un.trim();
            const res = await run(createUser, { displayName: nu.name.trim(), ign: nu.ign.trim(), username: un, roleId: nu.roleId || null, initialBalance: Number(nu.bal) || 0 });
            setNu(null);
            if (res?.ok) setPwReveal({ title: "Account created", username: un, tempPassword: res.tempPassword });
          }}>
          {S.users.some(x => x.un === nu.un.trim()) && nu.un.trim() ? "Username taken" : "Create and issue password"}</button>
      </div>
    </div></div>}
    {u && <div className="modal-bg" onClick={() => setOpen(null)}><div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><h3 className="ttl-md">{u.name}</h3><div className="muted" style={{ fontSize: 13 }}>@{u.un} · {u.ign} · {u.invited ? "invited " : "joined "}{ago(u.joined)}</div></div>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}>{u.invited && <span className="badge b-pend">temp password</span>}
          <span className={"badge " + (u.status === "active" ? "b-open" : "b-live")}>{u.status}</span>
          <button className="btn btn-ghost btn-xs" onClick={async () => {
            const res = await run(resetPassword, { userId: u.id, reason: reason.trim() || "New temporary password issued" });
            setOpen(null);
            if (res?.ok) setPwReveal({ title: "Password reset", username: u.un, tempPassword: res.tempPassword });
          }}>Reset password</button></div></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 12, margin: "20px 0" }}>
        <div className="card-flat" style={{ background: "var(--elev)", padding: 14 }}><Stat label="CONFIRMED" value={fmt(u.bal)} color="var(--yellow)" /></div>
        <div className="card-flat" style={{ background: "var(--elev)", padding: 14 }}><Stat label="LOCKED" value={fmt(u.locked)} /></div>
        <div className="card-flat" style={{ background: "var(--elev)", padding: 14 }}><Stat label="NET P/L" value={(u.ret - u.staked >= 0 ? "+" : "") + fmt(u.ret - u.staked)} color={u.ret - u.staked >= 0 ? "var(--up)" : "var(--down)"} /></div>
      </div>
      {u.flags.length > 0 && <div className="card-flat" style={{ background: "rgba(58,212,237,.08)", padding: "12px 14px", marginBottom: 16 }}>
        <div className="cap" style={{ color: "var(--yellow)", marginBottom: 4 }}>REVIEW FLAGS</div>
        <div style={{ fontSize: 13 }}>{u.flags.join(" · ")}</div></div>}
      <div className="card-flat" style={{ background: "var(--elev)", padding: "12px 14px", marginBottom: 16 }}>
        <div className="cap" style={{ marginBottom: 8 }}>ADMIN ROLE</div>
        <div className="flex" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select className="input" style={{ flex: 1, minWidth: 180 }} value={u.roleId || ""} onChange={ev => run(setUserRole, { userId: u.id, roleId: ev.target.value || null })}>
            <option value="">No admin access — regular player</option>
            {S.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="cap" style={{ color: "var(--muted)", marginTop: 8 }}>
          {u.roleId ? "Grants: " + ((S.roles.find(r => r.id === u.roleId) || { perms: [] }).perms.map(PERM_LABEL).join(" · ") || "nothing yet") : "This is how a player becomes an admin. A user holds at most one role."}</div>
      </div>
      <label className="f">BALANCE ADJUSTMENT ({CUR}) — USE NEGATIVE TO DEBIT</label>
      <input className="input" value={adj} onChange={e => setAdj(e.target.value.replace(/[^-\d]/g, ""))} placeholder="e.g. -3000" />
      <div style={{ marginTop: 12 }}><label className="f">REASON (REQUIRED, LOGGED)</label>
        <textarea className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Duplicate deposit credit reversed" /></div>
      <div className="cap" style={{ marginTop: 10, color: "var(--muted)" }}>Reminder: this also books a matching entry to the house wallet (real cash) — make sure the amount and reason are accurate.</div>
      <div className="flex" style={{ gap: 10, marginTop: 18, justifyContent: "space-between" }}>
        <div className="flex" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-sm" disabled={!reason.trim()} onClick={() => { run(toggleUserStatus, { userId: u.id, reason }); setOpen(null); }}>
            {u.status === "active" ? "Suspend account" : "Reinstate account"}</button>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          <button className="btn btn-2 btn-sm" onClick={() => setOpen(null)}>Cancel</button>
          <button className="btn btn-y btn-sm" disabled={!Number(adj) || !reason.trim()} onClick={() => { run(adjustBalance, { userId: u.id, amount: Number(adj), reason }); setOpen(null); }}>Apply adjustment</button></div>
      </div>
    </div></div>}
    {pwReveal && <TempPasswordModal {...pwReveal} onClose={() => setPwReveal(null)} />}
  </div>;
}

export function AdminAudit({ S }) {
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const kinds = ["Deposit", "Withdrawal", "Payout", "Race", "Market", "Championship", "User", "Role", "Points", "Balance"];
  const bucket = a => kinds.find(k => a.act.toLowerCase().startsWith(k.toLowerCase())) || "Other";
  const list = S.audit.filter(a => (who === "all" || a.who === who) && (kind === "all" || bucket(a) === kind)
    && (a.act + a.target + a.note).toLowerCase().includes(q.toLowerCase()));
  const admins = [...new Set(S.audit.map(a => a.who))];
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(page, pageCount);
  return <div>
    <div className="hdr" style={{ marginBottom: 20 }}>
      <div><h2 className="ttl-lg">Audit log</h2><div className="muted" style={{ fontSize: 13 }}>Append-only. Every balance- or result-affecting action is recorded with actor, target, and reason.</div></div>
      <div className="flex" style={{ gap: 10 }}>
        <input className="input" style={{ width: 220 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search entries" />
        <button className="btn btn-ghost btn-sm">Export CSV</button></div>
    </div>
    <div className="card" style={{ padding: "14px 20px", marginBottom: 16 }}>
      <div className="flex" style={{ gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}><span className="cap">ACTOR</span>
          <button className={"pill-tab" + (who === "all" ? " on" : "")} onClick={() => setWho("all")}>All</button>
          {admins.map(a => <button key={a} className={"pill-tab" + (who === a ? " on" : "")} onClick={() => setWho(a)}>{a}</button>)}</div>
        <div className="flex" style={{ gap: 6, alignItems: "center" }}><span className="cap">TYPE</span>
          <button className={"pill-tab" + (kind === "all" ? " on" : "")} onClick={() => setKind("all")}>All</button>
          {kinds.map(k => <button key={k} className={"pill-tab" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>{k}</button>)}</div>
      </div>
    </div>
    <div className="card">
      <div className="tblwrap tbl-wide"><table>
        <thead><tr><th style={{ width: 130 }}>When</th><th style={{ width: 130 }}>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead>
        <tbody>{list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE).map(a => <tr key={a.id} className="rowhov">
          <td className="muted num" style={{ fontSize: 13 }}>{ago(a.at)}</td>
          <td><span className="badge b-set">{a.who}</span></td>
          <td style={{ fontWeight: 500 }}>{a.act}</td>
          <td className="muted2 wrapcell" style={{ fontSize: 13 }}>{a.target}</td>
          <td className="muted wrapcell" style={{ fontSize: 13 }}>{a.note}</td>
        </tr>)}</tbody>
      </table></div>
      {!list.length && <div className="muted" style={{ padding: "28px 0", textAlign: "center", fontSize: 13 }}>No entries match these filters.</div>}
      <Pagination page={p} pageCount={pageCount} total={list.length} onChange={setPage} />
      <div className="cap" style={{ marginTop: 14, color: "var(--muted)" }}>Showing {list.length} of {S.audit.length} entries · retention 24 months</div>
    </div>
  </div>;
}

export function AdminRoles({ S }) {
  const run = useServerAction();
  const [sel, setSel] = useState((S.roles[1] || S.roles[0]).id);
  const role = S.roles.find(r => r.id === sel) || S.roles[0];
  const [draft, setDraft] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const holders = r => S.users.filter(u => u.roleId === r.id).length;
  const groups = [...new Set(PERMS.map(p => p.group))];
  const startNew = () => setDraft({ id: null, name: "", desc: "", perms: [] });
  const startEdit = r => setDraft({ id: r.id, name: r.name, desc: r.desc || "", perms: r.perms.slice() });
  const toggle = k => setDraft(d => ({ ...d, perms: d.perms.includes(k) ? d.perms.filter(x => x !== k) : [...d.perms, k] }));
  return <div>
    <div className="hdr" style={{ marginBottom: 20 }}>
      <div><h2 className="ttl-lg">Roles &amp; permissions</h2>
        <div className="muted" style={{ fontSize: 13 }}>A role is a named set of permissions. Build as many as you need — a user holds at most one.</div></div>
      <button className="btn btn-y btn-sm" onClick={startNew}>Create role</button>
    </div>
    <div className="grid" style={{ gap: 24, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 24 }}>
        <div className="card">
          <div className="ttl-sm" style={{ marginBottom: 14 }}>Roles</div>
          <div className="tblwrap"><table>
            <thead><tr><th>Role</th><th>Permissions</th><th style={{ textAlign: "right" }}>Held by</th><th style={{ textAlign: "right" }}></th></tr></thead>
            <tbody>{S.roles.map(r => <tr key={r.id} className="rowhov" style={{ cursor: "pointer" }} onClick={() => setSel(r.id)}>
              <td><div className="flex" style={{ gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                {r.seeded && <span className="badge b-lock">seeded</span>}
                {r.perms.includes("manage_roles") && <span className="badge b-live">manages roles</span>}</div>
                <div className="cap">{r.desc}</div></td>
              <td className="num muted2">{r.perms.length} of {ALL_PERMS.length}</td>
              <td className="num" style={{ textAlign: "right" }}>{holders(r)}</td>
              <td style={{ textAlign: "right" }}><div className="flex" style={{ gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost btn-xs" onClick={ev => { ev.stopPropagation(); startEdit(r); }}>Edit</button>
                {r.seeded ? <span className="muted" style={{ fontSize: 13 }}>—</span>
                  : <button className="btn btn-ghost btn-xs" onClick={ev => { ev.stopPropagation(); setConfirmDel(r); }}>Delete</button>}</div></td>
            </tr>)}</tbody>
          </table></div>
          <div className="cap" style={{ marginTop: 14, color: "var(--muted)" }}>The Owner role is seeded at setup with every permission and can't be deleted — otherwise nobody could create the first role or promote the first user. There's no admin signup: promote a player from User Management.</div>
        </div>
        <div className="card">
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 16 }}>
            <div><div className="ttl-sm">{role.name}</div>
              <div className="muted2" style={{ fontSize: 13, marginTop: 4 }}>{role.desc}</div></div>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(role)}>Edit permissions</button>
          </div>
          {groups.map(g => <div key={g} style={{ marginBottom: 14 }}>
            <div className="cap" style={{ marginBottom: 8 }}>{g.toUpperCase()}</div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
              {PERMS.filter(p => p.group === g).map(p => { const on = role.perms.includes(p.key);
                return <div key={p.key} className="flex" style={{ gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 6, background: on ? "var(--elev)" : "transparent", border: "1px solid " + (on ? "var(--hair)" : "transparent") }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, display: "grid", placeItems: "center", background: on ? "var(--yellow)" : "transparent", border: on ? "0" : "1px solid var(--hair)", color: "var(--ink)", fontSize: 11, fontWeight: 700, flex: "0 0 16px" }}>{on ? "✓" : ""}</span>
                  <span style={{ fontSize: 13, color: on ? "var(--body)" : "var(--muted)" }}>{p.label}</span></div>; })}
            </div>
          </div>)}
        </div>
      </div>
    </div>

    {draft && <div className="modal-bg" onClick={() => setDraft(null)}><div className="modal" style={{ maxWidth: 560 }} onClick={ev => ev.stopPropagation()}>
      <h3 className="ttl-md">{draft.id ? "Edit role" : "Create role"}</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 20px" }}>Check the actions this role can perform. Anyone holding it sees only the admin sections their permissions unlock.</div>
      <div style={{ marginBottom: 12 }}><label className="f">ROLE NAME</label>
        <input className="input" value={draft.name} onChange={ev => setDraft(d => ({ ...d, name: ev.target.value }))} placeholder="e.g. Community Manager" /></div>
      <div style={{ marginBottom: 16 }}><label className="f">DESCRIPTION</label>
        <input className="input" value={draft.desc} onChange={ev => setDraft(d => ({ ...d, desc: ev.target.value }))} placeholder="What this role is for" /></div>
      {groups.map(g => <div key={g} style={{ marginBottom: 14 }}>
        <div className="cap" style={{ marginBottom: 6 }}>{g.toUpperCase()}</div>
        {PERMS.filter(p => p.group === g).map(p => <label key={p.key} className="flex" style={{ gap: 10, alignItems: "center", padding: "6px 2px", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={draft.perms.includes(p.key)} onChange={() => toggle(p.key)} style={{ accentColor: "var(--yellow)" }} />
          <span>{p.label}</span>
          {p.sensitive && <span className="badge b-live">sensitive</span>}</label>)}
      </div>)}
      {draft.perms.includes("manage_roles") && <div className="card-flat" style={{ background: "rgba(246,70,93,.08)", border: "1px solid rgba(246,70,93,.35)", padding: "12px 14px", marginBottom: 4 }}>
        <div className="cap down" style={{ marginBottom: 4 }}>THIS ROLE CAN MANAGE ROLES</div>
        <div className="cap" style={{ color: "var(--muted-2)" }}>Anyone holding it can grant themselves or anyone else every other permission. Give it out sparingly.</div>
      </div>}
      <div className="flex" style={{ gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setDraft(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" disabled={!draft.name.trim() || !draft.perms.length}
          onClick={() => {
            run(draft.id ? editRole : createRole, draft.id ? { id: draft.id, name: draft.name, desc: draft.desc, perms: draft.perms } : { name: draft.name, desc: draft.desc, perms: draft.perms });
            setDraft(null);
          }}>
          {!draft.perms.length ? "Check at least one permission" : draft.id ? "Save role" : "Create role"}</button></div>
    </div></div>}

    {confirmDel && <div className="modal-bg" onClick={() => setConfirmDel(null)}><div className="modal" onClick={ev => ev.stopPropagation()}>
      <h3 className="ttl-md">Delete role</h3>
      <div className="muted2" style={{ fontSize: 13, margin: "8px 0 18px" }}>
        {holders(confirmDel)
          ? `${confirmDel.name} is held by ${holders(confirmDel)} ${holders(confirmDel) === 1 ? "person" : "people"}. Deleting it removes their admin access entirely — they stay regular players.`
          : `${confirmDel.name} isn't assigned to anyone, so nothing else changes.`}</div>
      <div className="flex" style={{ gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-2 btn-sm" onClick={() => setConfirmDel(null)}>Cancel</button>
        <button className="btn btn-y btn-sm" onClick={() => { run(deleteRole, { id: confirmDel.id }); setSel(S.roles[0].id); setConfirmDel(null); }}>Delete role</button></div>
    </div></div>}
  </div>;
}
