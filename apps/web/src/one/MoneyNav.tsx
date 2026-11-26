import { NavLink, useLocation } from "react-router-dom";

/** One sub-navigation for every money screen, so moving between them never loses it. */
export const moneyTabs = [
  { to: "/finance", label: "Ringkasan", match: (p: string) => p === "/finance" || p.startsWith("/finance/new") },
  { to: "/debts", label: "Utang", match: (p: string) => p.startsWith("/debts") },
  { to: "/finance/plans", label: "Rencana", match: (p: string) => p.startsWith("/finance/plans") },
  { to: "/records/budgets", label: "Anggaran", match: (p: string) => p.startsWith("/records/budgets") },
  { to: "/records/bills", label: "Tagihan", match: (p: string) => p.startsWith("/records/bills") },
  { to: "/records/savings", label: "Tabungan", match: (p: string) => p.startsWith("/records/savings") },
  { to: "/records/assets", label: "Aset", match: (p: string) => p.startsWith("/records/assets") },
  { to: "/records/categories", label: "Kategori", match: (p: string) => p.startsWith("/records/categories") },
];
export const moneyKinds = ["budgets", "bills", "savings", "assets", "categories"];
export const isMoneyPath = (p: string) => moneyTabs.some((t) => t.match(p));

export function MoneyNav() {
  const { pathname } = useLocation();
  return (
    <nav className="o-seg o-money-nav" aria-label="Menu uang">
      {moneyTabs.map((t) => (
        <NavLink key={t.to} to={t.to} role="tab" aria-selected={t.match(pathname)} className={t.match(pathname) ? "on" : ""}
          ref={(el) => { if (el && t.match(pathname)) el.scrollIntoView({ block: "nearest", inline: "center" }); }}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
