"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { money } from "@/lib/store";
import { logout } from "@/app/actions/auth";

const USER_NAV = [
  ["/dashboard", "Dashboard"],
  ["/races", "Races"],
  ["/championship", "Championship"],
  ["/bets", "My bets"],
  ["/wallet", "Wallet"],
];

// sessionUser/balance/adminHref are computed server-side once in the root
// layout. adminHref is the first admin section this user's role permits
// (or null if they hold no admin role at all) — used for the "Admin"
// nav button's target.
export function Nav({ sessionUser, balance, adminHref }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = pathname.startsWith("/admin");

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  return <div className="nav"><div className="wrap-wide flex" style={{ alignItems: "center", gap: 32, width: "100%" }}>
    <Link href={sessionUser ? "/dashboard" : "/"} className="brand">
      <div className="brand-name">EXECUTIVE1 <span>BETS</span></div>
      <div className="brand-by"><em>powered by</em><img src="/assets/logo-mark.png" alt="AEAR" /></div>
    </Link>
    {isAdmin ? <span className="badge b-lock">Admin panel</span> : sessionUser && <div className="navlinks">
      {USER_NAV.map(([href, l]) => <Link key={href} href={href} className={"navlink" + (pathname === href ? " on" : "")}>{l}</Link>)}
    </div>}
    <div className="navright">
      {sessionUser && !isAdmin && <>
        <div style={{ textAlign: "right", marginRight: 8 }}><div className="cap">BALANCE</div><div className="num yel" style={{ fontWeight: 600 }}>{money(balance)}</div></div>
        <Link href="/wallet" className="btn btn-2 btn-sm">Deposit</Link>
      </>}
      {!sessionUser && !isAdmin && <Link href="/login" className="btn btn-y btn-sm">Log in</Link>}
      {sessionUser && <button className="btn btn-t btn-sm" onClick={handleLogout}>Log out</button>}
      {adminHref && <Link href={isAdmin ? "/dashboard" : adminHref} className="btn btn-t btn-sm">{isAdmin ? "Exit admin" : "Admin"}</Link>}
    </div>
  </div></div>;
}
