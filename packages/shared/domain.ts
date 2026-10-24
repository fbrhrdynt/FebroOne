import Decimal from "decimal.js";
import { z } from "zod";
import { catalog, type RecordItem } from "./catalog";
export const id = z.string().uuid();
export const money = z
  .string()
  .regex(
    /^\d{1,14}(\.\d{1,2})?$/,
    "Gunakan nominal positif, maksimal 2 desimal",
  );
export function minor(v: string): bigint {
  if (!money.safeParse(v).success) throw new Error("Nominal tidak valid");
  return BigInt(new Decimal(v).mul(100).toFixed(0));
}
export const major = (v: string | bigint) =>
  new Decimal(v.toString()).div(100).toFixed(2);
export const recordSchema = z.object({
  id: id.optional(),
  kind: z.string().refine((k) => !!catalog[k]),
  title: z.string().trim().min(1).max(240),
  tags: z.array(z.string().trim().max(50)).max(30).default([]),
  data: z.record(z.string(), z.unknown()),
  version: z.number().int().positive().optional(),
});
export function validateRecord(raw: unknown) {
  const r = recordSchema.parse(raw);
  const fields = catalog[r.kind].fields;
  const allowed = new Set(fields.map((f) => f.key));
  for (const k of ["companyId", "categoryId", "projectId"]) {
    allowed.add(k); if(r.data[k]) id.parse(r.data[k]);
  }
  if(r.kind === "tasks") {
    allowed.add("reminder"); allowed.add("reminderRepeat");
    if(r.data.reminder) z.iso.datetime().parse(r.data.reminder);
    if(r.data.reminderRepeat) z.enum(["None","Daily","Weekly","Monthly"]).parse(r.data.reminderRepeat);
    r.data.checklist = checklistItems(r.data.checklist).map(i=>({...i,text:i.text.trim()}));
    const items = r.data.checklist as ChecklistItem[];
    if(items.some(i=>!i.text.trim())) throw new Error("Checklist text is required");
    const state = checklistState(items, String(r.data.status === "Completed" && !r.version ? "To Do" : r.data.status || "To Do"));
    if(items.length) Object.assign(r.data,state);
  }
  for (const k of Object.keys(r.data))
    if (!allowed.has(k)) throw new Error(`Field tidak dikenal: ${k}`);
  for (const f of fields) {
    const v = r.data[f.key];
    if (f.required && (v === undefined || v === ""))
      throw new Error(`${f.label} wajib diisi`);
    if (v === undefined || v === "") continue;
    if(r.kind === "tasks" && f.key === "checklist") continue;
    if (f.type === "checkbox") {
      if (typeof v !== "boolean") throw new Error(`${f.label} tidak valid`);
    } else if (typeof v !== "string" && typeof v !== "number")
      throw new Error(`${f.label} tidak valid`);
    if (String(v).length > 100000) throw new Error("Teks terlalu panjang");
    if (f.type === "number" && (!Number.isFinite(Number(v)) || Number(v) < 0))
      throw new Error(`${f.label} harus non-negatif`);
    if (f.options && !f.options.includes(String(v)))
      throw new Error(`${f.label} tidak valid`);
    if (f.type === "url" && !/^https:\/\//i.test(String(v)))
      throw new Error("URL harus HTTPS");
    if (
      ["date", "datetime-local"].includes(f.type || "") &&
      !Number.isFinite(Date.parse(String(v)))
    )
      throw new Error("Tanggal tidak valid");
    if(f.type==='datetime-local' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(String(v)))r.data[f.key]=new Date(String(v)+'+07:00').toISOString();
  }
  if (
    r.kind === "events" &&
    new Date(String(r.data.end)) < new Date(String(r.data.start))
  )
    throw new Error("Waktu selesai sebelum mulai");
  if (r.kind === "tasks" && Number(r.data.progress) > 100)
    throw new Error("Progres maksimal 100");
  if (r.kind === "budgets") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(r.data.month)))
      throw new Error("Bulan harus YYYY-MM");
    minor(String(r.data.amount));
  }
  return r;
}
export type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: string;
};
export type Transaction = {
  id: string;
  kind:
    | "income"
    | "expense"
    | "transfer"
    | "opening"
    | "debt_payment"
    | "reversal"
    | "reconciliation";
  accountId: string;
  toAccountId?: string;
  amount: string;
  category: string;
  date: string;
  description: string;
  key: string;
  reversed?: boolean;
  debtId?: string;
  principal?: string;
  interest?: string;
};
export const txSchema = z.object({
  id: id.optional(),
  kind: z.enum(["income", "expense", "transfer", "reconciliation"]),
  adjustmentDirection: z.enum(['increase','decrease']).optional(),
  accountId: id,
  toAccountId: id.optional(),
  amount: money.refine((v) => minor(v) > 0n),
  category: z.string().max(120).default("Uncategorized"),
  date: z.iso.date(),
  description: z.string().max(1000).default(""),
  key: id,
});
export function postings(t: {
  kind: string;
  accountId: string;
  toAccountId?: string;
  amount: string;
  adjustmentDirection?: 'increase'|'decrease';
}) {
  let a = minor(t.amount);
  if (t.kind === "transfer") {
    if (!t.toAccountId || t.toAccountId === t.accountId)
      throw new Error("Pilih dua akun berbeda");
    return [
      { accountId: t.accountId, amount: -a },
      { accountId: t.toAccountId, amount: a },
      { accountId: null, amount: 0n },
    ];
  }
  let sign = ["expense", "debt_payment"].includes(t.kind) || t.kind==='reconciliation'&&t.adjustmentDirection==='decrease' ? -1n : 1n;
  return [
    { accountId: t.accountId, amount: a * sign },
    { accountId: null, amount: -a * sign },
  ];
}
export const debtSchema = z.object({
  name: z.string().trim().min(1).max(200),
  principal: money.refine((v) => minor(v) > 0n),
  apr: z.coerce.number().min(0).max(100),
  months: z.coerce.number().int().min(1).max(600),
  start: z.iso.date(),
  direction: z.enum(["borrowed", "lent"]),
  model: z.enum(["reducing", "flat"]),
  rates: z
    .array(
      z.object({
        month: z.number().int().min(1).max(600),
        apr: z.number().min(0).max(100),
      }),
    )
    .default([]),
});
export type Debt = z.infer<typeof debtSchema> & { id: string; paid: string };
export function amortize(
  principal: string,
  apr: number,
  months: number,
  model = "reducing",
  extra = "0",
  rates: { month: number; apr: number }[] = [],
) {
  let balance = new Decimal(principal),
    initial = balance,
    totalInterest = new Decimal(0);
  const rows = [];
  let rate = new Decimal(apr).div(1200),
    payment = rate.eq(0)
      ? balance.div(months)
      : balance
          .mul(rate)
          .div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-months)));
  if (model === "flat") payment = balance.div(months).plus(balance.mul(rate));
  for (let n = 1; n <= months && balance.gt(0); n++) {
    const change = rates.find((r) => r.month === n);
    if (change) {
      rate = new Decimal(change.apr).div(1200);
      const left = months - n + 1;
      payment = rate.eq(0)
        ? balance.div(left)
        : balance
            .mul(rate)
            .div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-left)));
      if (model === "flat") payment = balance.div(left).plus(initial.mul(rate));
    }
    const interest = (model === "flat" ? initial : balance)
      .mul(rate)
      .toDecimalPlaces(2);
    let paid = Decimal.min(
      balance,
      Decimal.max(0, payment.plus(extra).minus(interest).toDecimalPlaces(2)),
    );
    if (n === months) paid = balance;
    balance = balance.minus(paid).toDecimalPlaces(2);
    totalInterest = totalInterest.plus(interest);
    rows.push({
      month: n,
      principal: paid.toFixed(2),
      interest: interest.toFixed(2),
      payment: paid.plus(interest).toFixed(2),
      balance: balance.toFixed(2),
    });
  }
  return { rows, totalInterest: totalInterest.toFixed(2), months: rows.length };
}
export function localDay(d = new Date(), tz = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export function nextOccurrence(value: string, rule: string) {
  const d = new Date(value);
  const day = d.getDate();
  if (rule === "Daily") d.setDate(day + 1);
  else if (rule === "Weekly") d.setDate(day + 7);
  else if (rule === "Monthly") {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(
      Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
    );
  } else if (rule === "Yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else return null;
  return d.toISOString();
}
export function occurrences(r: RecordItem, from: Date, to: Date) {
  if (!r.data.start) return [];
  const out: (RecordItem & { occurrence: string })[] = [];
  let start = new Date(r.data.start);
  const duration = new Date(r.data.end).getTime() - start.getTime();
  const exceptions = String(r.data.exceptions || "")
    .split(",")
    .map((s) => s.trim());
  for (let i = 0; i < 10000 && start <= to; i++) {
    if (r.data.until && localDay(start) > r.data.until) break;
    if (
      start.getTime() + duration >= from.getTime() &&
      !exceptions.includes(localDay(start))
    )
      out.push({
        ...r,
        occurrence: start.toISOString(),
        data: {
          ...r.data,
          start: start.toISOString(),
          end: new Date(start.getTime() + duration).toISOString(),
        },
      });
    const next = nextOccurrence(start.toISOString(), r.data.recurrence);
    if (!next) break;
    start = new Date(next);
  }
  return out;
}
export function streak(
  entries: RecordItem[],
  habitId: string,
  today = localDay(),
) {
  const dates = new Set(
    entries
      .filter((r) => r.data.habitId === habitId && Number(r.data.value) > 0)
      .map((r) => r.data.date),
  );
  let d = new Date(today + "T12:00:00Z");
  if (!dates.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (dates.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}
export function dueNotifications(records: RecordItem[], now = new Date()) {
  return records.flatMap((r) => {
    let due = r.data.due || r.data.expiry;
    if (r.kind === "events")
      due = new Date(
        new Date(r.data.start).getTime() -
          Number(r.data.reminderMinutes || 0) * 60000,
      ).toISOString();
    if (!due || r.data.done || r.data.status === "Completed") return [];
    const delta = new Date(due).getTime() - now.getTime();
    const days = ["certificates", "documents"].includes(r.kind)
      ? Number(r.data.reminderDays ?? 30)
      : 0;
    return delta <= days * 86400000
      ? [
          {
            id: `${r.id}:${due}`,
            recordId: r.id,
            title: r.title,
            kind: r.kind,
            due,
            overdue: delta < 0,
          },
        ]
      : [];
  });
}
export type CalcSpec = {
  key: string;
  name: string;
  formula: string;
  unit: string;
  inputs: { key: string; label: string; unit: string; min?: number }[];
  assumptions: string;
  run: (x: Record<string, number>) => number;
};
export const calculators: CalcSpec[] = [
  {
    key: "cylinder",
    name: "Volume silinder",
    formula: "V = π × d² / 4 × L",
    unit: "m³",
    inputs: [
      { key: "d", label: "Diameter", unit: "m", min: 0 },
      { key: "l", label: "Panjang", unit: "m", min: 0 },
    ],
    assumptions: "Silinder penuh, diameter dalam, tanpa displacement.",
    run: (x) => ((Math.PI * x.d * x.d) / 4) * x.l,
  },
  {
    key: "box",
    name: "Volume tangki persegi",
    formula: "V = L × W × H",
    unit: "m³",
    inputs: [
      { key: "l", label: "Panjang", unit: "m", min: 0 },
      { key: "w", label: "Lebar", unit: "m", min: 0 },
      { key: "h", label: "Tinggi isi", unit: "m", min: 0 },
    ],
    assumptions: "Dinding tegak; dimensi internal.",
    run: (x) => x.l * x.w * x.h,
  },
  {
    key: "flow",
    name: "Debit aliran",
    formula: "Q = V / t",
    unit: "m³/s",
    inputs: [
      { key: "v", label: "Volume", unit: "m³", min: 0 },
      { key: "t", label: "Waktu", unit: "s", min: 0.000001 },
    ],
    assumptions: "Debit rata-rata untuk interval pengukuran.",
    run: (x) => x.v / x.t,
  },
  {
    key: "ohm",
    name: "Arus DC (Ohm)",
    formula: "I = V / R",
    unit: "A",
    inputs: [
      { key: "v", label: "Tegangan", unit: "V", min: 0 },
      { key: "r", label: "Resistansi", unit: "Ω", min: 0.000001 },
    ],
    assumptions: "Beban resistif; suhu dan resistansi konstan.",
    run: (x) => x.v / x.r,
  },
  {
    key: "threephase",
    name: "Arus motor 3-fasa",
    formula: "I = Pout / (√3 × VLL × PF × η)",
    unit: "A",
    inputs: [
      { key: "p", label: "Daya output", unit: "W", min: 0 },
      { key: "v", label: "Tegangan antar fasa", unit: "V", min: 0.000001 },
      { key: "pf", label: "Power factor", unit: "0–1", min: 0.000001 },
      { key: "eff", label: "Efisiensi", unit: "0–1", min: 0.000001 },
    ],
    assumptions:
      "Beban seimbang, sinusoidal. PF dan η ≤ 1. Bukan pemilihan proteksi/kabel.",
    run: (x) => {
      if (x.pf > 1 || x.eff > 1) throw new Error("PF dan efisiensi maksimal 1");
      return x.p / (Math.sqrt(3) * x.v * x.pf * x.eff);
    },
  },
  {
    key: "torque",
    name: "Torsi poros",
    formula: "T = P × 60 / (2π × n)",
    unit: "N·m",
    inputs: [
      { key: "p", label: "Daya poros", unit: "W", min: 0 },
      { key: "rpm", label: "Putaran", unit: "rpm", min: 0.000001 },
    ],
    assumptions: "Daya mekanis poros, kondisi steady-state.",
    run: (x) => (x.p * 60) / (2 * Math.PI * x.rpm),
  },
  {
    key: "pressure",
    name: "Tekanan hidrostatik",
    formula: "p = ρ × g × h",
    unit: "Pa",
    inputs: [
      { key: "rho", label: "Densitas", unit: "kg/m³", min: 0 },
      { key: "h", label: "Kedalaman", unit: "m", min: 0 },
    ],
    assumptions: "Tekanan gauge; g = 9.80665 m/s²; densitas konstan.",
    run: (x) => x.rho * 9.80665 * x.h,
  },
];
export const conversions = {
  pressure: {
    Pa: 1,
    kPa: 1000,
    MPa: 1000000,
    bar: 100000,
    psi: 6894.757293168,
  },
  density: { "kg/m³": 1, "g/cm³": 1000, "lb/US gal": 119.826427316 },
  volume: { "m³": 1, L: 0.001, "US gal": 0.003785411784, bbl: 0.158987294928 },
  flow: { "m³/s": 1, "L/min": 1 / 60000, "US gpm": 0.003785411784 / 60 },
  length: { m: 1, mm: 0.001, ft: 0.3048, in: 0.0254 },
};
export function calculate(key: string, input: Record<string, number>) {
  const c = calculators.find((c) => c.key === key);
  if (!c) throw new Error("Rumus tidak ada");
  for (const f of c.inputs)
    if (!Number.isFinite(input[f.key]) || input[f.key] < (f.min ?? -Infinity))
      throw new Error(`${f.label} tidak valid`);
  const result = c.run(input);
  if (!Number.isFinite(result)) throw new Error("Hasil tidak valid");
  return {
    formula: c.formula,
    result,
    unit: c.unit,
    assumptions: c.assumptions,
    steps: c.inputs
      .map((f) => `${f.label} = ${input[f.key]} ${f.unit}`)
      .concat(`${c.formula} = ${result.toPrecision(8)} ${c.unit}`),
  };
}

export type ChecklistItem = {id:string; text:string; checked:boolean};
export function checklistItems(value: unknown): ChecklistItem[] {
  if(value === undefined || value === "") return [];
  if(typeof value === "string") return value.split("\n").filter(s=>s.trim()).map((text,i)=>({id:`legacy-${i}`,text:text.replace(/^\s*\[[ xX]\]\s*/,""),checked:/^\s*\[[xX]\]/.test(text)}));
  const items=z.array(z.object({id:z.string().min(1).max(100),text:z.string().max(2000),checked:z.boolean()})).parse(value);
  if(new Set(items.map(i=>i.id)).size!==items.length) throw new Error("Checklist IDs must be unique");
  return items;
}
export function zonedInput(iso:string,zone='Asia/Jakarta'){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso)).replace(' ','T');
}
export function zonedInstant(local:string,zone='Asia/Jakarta'){
 const target=Date.parse(local+'Z');let instant=target;
 for(let i=0;i<4;i++){const seen=Date.parse(zonedInput(new Date(instant).toISOString(),zone)+'Z');const delta=target-seen;if(!delta)return new Date(instant).toISOString();instant+=delta;}
 throw new Error('Waktu tidak tersedia pada zona waktu ini');
}
export function nextZonedReminder(iso:string,rule:string,zone='Asia/Jakarta'){
 const local=zonedInput(iso,zone);const next=nextOccurrence(local+'Z',rule);return next?zonedInstant(next.slice(0,16),zone):null;
}

export function checklistState(items: ChecklistItem[], status: string) {
 const checked=items.filter(i=>i.checked).length;
 const progress=items.length?Math.round(checked/items.length*100):0;
 if(["Cancelled","On Hold"].includes(status)) return {progress,status};
 if(!items.length) return {progress,status:status==="Completed"?"Completed":status};
 return {progress,status:checked===items.length?"Completed":checked>0||["Completed","In Progress"].includes(status)?"In Progress":status==="Inbox"?"Inbox":"To Do"};
}
