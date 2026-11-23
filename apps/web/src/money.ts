import Decimal from "decimal.js";

/** Format whole-IDR input for Indonesian numeric fields. */
export function formatMoneyInput(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(digits));
}
export const rp = (v: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));
export const total = (rows: any[], field: string) =>
  rows.reduce((a, r) => a.plus(r[field] || 0), new Decimal(0));

/** Match finance accounting: transfers/principal are not income or expenses. */
export function monthlyCashflow(transactions: import('../../../packages/shared/domain').Transaction[], month: string) {
  const current=transactions.filter(t=>!t.reversed && t.date.startsWith(month));
  return {
    income: total(current.filter(t=>t.kind==='income'),'amount'),
    expense: total(current.filter(t=>t.kind==='expense'),'amount').plus(total(current.filter(t=>t.kind==='debt_payment'),'interest')),
  };
}
