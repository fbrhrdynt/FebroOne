import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordItem } from "../../../../packages/shared/catalog";
import { localDay, occurrences, checklistItems, zonedInstant } from "../../../../packages/shared/domain";
import * as store from "../store";

export type Related = {
  record: RecordItem;
  references: RecordItem[];
  children: RecordItem[];
  links: { relation: string; direction: "in" | "out"; record: RecordItem }[];
  transactions: { id: string; kind: string; category: string; date: string; description: string; recordId?: string; amount: string; reversed: boolean }[];
  files: { id: string; name: string; mime: string; size: number; created_at: string }[];
};

export const useRecords = () =>
  useQuery<RecordItem[]>({ queryKey: ["records"], queryFn: () => store.records() });
export const useFinance = () => useQuery<any>({ queryKey: ["finance"], queryFn: store.finance });
export const useIdentity = () => useQuery<any>({ queryKey: ["identity"], queryFn: store.identity, retry: false });
export const useRelated = (id?: string) =>
  useQuery<Related>({ queryKey: ["related", id], queryFn: () => store.api(`/records/${id}/related`), enabled: !!id });

export function useMutate() {
  const q = useQueryClient();
  return {
    async save(raw: any) {
      const saved = await store.saveRecord(raw);
      await Promise.all([
        q.invalidateQueries({ queryKey: ["records"] }),
        q.invalidateQueries({ queryKey: ["related"] }),
        q.invalidateQueries({ queryKey: ["record", saved.id] }),
      ]);
      return saved;
    },
    async refresh() {
      await Promise.all([
        q.invalidateQueries({ queryKey: ["records"] }),
        q.invalidateQueries({ queryKey: ["related"] }),
        q.invalidateQueries({ queryKey: ["finance"] }),
      ]);
    },
  };
}

// The person's time zone from their profile. The shell sets it before the
// pages render, so every date and time below follows the chosen zone.
let zone = "Asia/Jakarta";
export const setTimezone = (tz?: string) => {
  if (!tz || tz === zone) return;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); zone = tz; } catch { /* keep the last valid zone */ }
};
export const tz = () => zone;
/** Short zone label in Indonesian: WIB, WITA, WIT, or e.g. GMT+9. */
export const tzLabel = () =>
  new Intl.DateTimeFormat("id-ID", { timeZone: zone, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || zone;
/** A wall-clock "YYYY-MM-DDTHH:mm" in the person's zone, as an ISO instant. */
export const atLocal = (local: string) => zonedInstant(local.slice(0, 16), zone);
export const todayKey = () => localDay(new Date(), zone);
export const dayKey = (iso: string) => localDay(new Date(iso), zone);
export const addDays = (key: string, n: number) => {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: zone });
export const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(key + "T12:00:00Z").toLocaleDateString("id-ID", { ...opts, timeZone: "UTC" });
export function relDay(key: string) {
  const t = todayKey();
  if (key === t) return "Hari ini";
  if (key === addDays(t, 1)) return "Besok";
  if (key === addDays(t, -1)) return "Kemarin";
  return fmtDay(key);
}
export const rupiah = (v: unknown, compact = false) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
    ...(compact ? { notation: "compact", compactDisplay: "short" } : {}),
  }).format(Number(v || 0));
export const hours = (minutes: number) => {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? (m ? `${h}j ${m}m` : `${h} jam`) : `${m} mnt`;
};

export const isDone = (r: RecordItem) => ["Completed", "Cancelled"].includes(String(r.data.status));
export const taskDue = (r: RecordItem) => (r.data.due ? dayKey(String(r.data.due)) : null);
export function taskProgress(r: RecordItem) {
  const items = checklistItems(r.data.checklist);
  return items.length ? { done: items.filter((i) => i.checked).length, total: items.length } : null;
}

/** Events that happen on one local day, with recurrences expanded. */
export function eventsOn(records: RecordItem[], key: string) {
  const from = new Date(atLocal(key + "T00:00")), to = new Date(new Date(atLocal(addDays(key, 1) + "T00:00")).getTime() - 1);
  return records
    .filter((r) => r.kind === "events")
    .flatMap((r) => occurrences(r, from, to))
    .sort((a, b) => a.data.start.localeCompare(b.data.start));
}

/** Annual dates (birthdays, anniversaries) projected onto the coming days. */
export function upcomingDates(records: RecordItem[], from: string, days: number) {
  const out: { record: RecordItem; date: string }[] = [];
  for (const r of records.filter((r) => r.kind === "importantDates" && r.data.date)) {
    const md = String(r.data.date).slice(5, 10);
    for (let i = 0; i <= days; i++) {
      const d = addDays(from, i);
      if (r.data.annual ? d.slice(5) === md : d === String(r.data.date).slice(0, 10)) out.push({ record: r, date: d });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const monthKey = (key: string) => key.slice(0, 7);
const monthDate = (period: string, day: number) => {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period}-${String(Math.min(day, last)).padStart(2, "0")}`;
};
function inTerm(d: any, period: string) {
  if (!d.repaymentStart || period < d.repaymentStart) return false;
  if (!d.installmentCount) return true;
  const [sy, sm] = d.repaymentStart.split("-").map(Number);
  const [py, pm] = period.split("-").map(Number);
  return (py - sy) * 12 + (pm - sm) < Number(d.installmentCount);
}
/** Unpaid debt installments falling due between today and `days` ahead. */
export function dueInstallments(finance: any, from: string, days: number) {
  if (!finance) return [];
  const until = addDays(from, days);
  const periods = [...new Set([monthKey(addDays(from, -31)), monthKey(from), monthKey(until)])];
  const paid = (id: string, p: string) =>
    (finance.installments || []).some((x: any) => x.debtId === id && String(x.period).slice(0, 7) === p && x.status === "paid");
  const out: { debt: any; date: string; amount: number; overdue: boolean }[] = [];
  for (const d of (finance.debts || []).filter((d: any) => !d.settledAt && d.dueDay && d.monthlyPayment))
    for (const p of periods) {
      const date = monthDate(p, Number(d.dueDay));
      if (date <= until && inTerm(d, p) && !paid(d.id, p) && date >= addDays(from, -31))
        out.push({ debt: d, date, amount: Number(d.monthlyPayment), overdue: date < from });
    }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function monthTotals(finance: any, month = monthKey(todayKey())) {
  const rows = (finance?.transactions || []).filter((t: any) => !t.reversed && t.date.startsWith(month));
  const sum = (k: string) => rows.filter((t: any) => t.kind === k).reduce((n: number, t: any) => n + Number(t.amount), 0);
  const interest = rows.filter((t: any) => t.kind === "debt_payment").reduce((n: number, t: any) => n + Number(t.interest || 0), 0);
  return { income: sum("income"), expense: sum("expense") + interest };
}

export const recordHref = (r: { id: string }) => `/r/${r.id}`;
export function byId(records: RecordItem[] = []) {
  return new Map(records.map((r) => [r.id, r]));
}
