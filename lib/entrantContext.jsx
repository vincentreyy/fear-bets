"use client";
import { createContext, useContext, useMemo } from "react";

// Replaces the old module-level ENTRANTS/D()/registerEntrant() singleton
// from lib/store.js, which was a global mutable cache shared across every
// concurrent request in the same Node process — safe only when every
// request fetched the entire roster (the old monolithic getInitialData).
// Now that routes fetch partial data, each page must supply its own
// request-scoped lookup. A Context works on both SSR and the browser,
// unlike AsyncLocalStorage (no browser equivalent) or a module singleton.
const EntrantContext = createContext(null);
const FALLBACK = { n: "—", c: "#555", ab: "—", t: "" };

export function EntrantProvider({ drivers, teams, children }) {
  const lookup = useMemo(() => {
    const map = new Map();
    for (const d of drivers || []) map.set(d.id, d);
    for (const t of teams || []) map.set(t.id, t);
    return map;
  }, [drivers, teams]);
  const D = id => lookup.get(id) || FALLBACK;
  return <EntrantContext.Provider value={D}>{children}</EntrantContext.Provider>;
}

export function useEntrantLookup() {
  const D = useContext(EntrantContext);
  if (!D) throw new Error("useEntrantLookup() must be used within <EntrantProvider>");
  return D;
}
