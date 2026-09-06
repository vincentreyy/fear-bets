"use client";
import { createContext, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const tRef = useRef();
  const say = m => { setToast(m); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(null), 3800); };
  return <ToastContext.Provider value={{ say }}>
    {children}
    {toast && <div className="toast"><div style={{ fontSize: 13 }}>{toast}</div></div>}
  </ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used within <ToastProvider>");
  return ctx;
}
