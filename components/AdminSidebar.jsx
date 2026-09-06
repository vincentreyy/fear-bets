"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSidebar({ items }) {
  const pathname = usePathname();
  return <div className="sidebar">
    {items.map(item => <Link key={item.key} href={item.href} className={"sideitem" + (pathname === item.href ? " on" : "")}>{item.label}</Link>)}
  </div>;
}
