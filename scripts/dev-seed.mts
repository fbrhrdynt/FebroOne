// Fills a local development database with fictional sample data through the
// public API, so the UI can be reviewed without touching real records.
// Usage: node scripts/dev-seed.mts http://127.0.0.1:4174 dev@febro.local <password>
const [base = "http://127.0.0.1:4174", email = "dev@febro.local", password = ""] = process.argv.slice(2);
const origin = new URL(base).origin;
let cookie = "", csrf = "";
async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: { origin, cookie, "x-csrf-token": csrf, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error}`);
  return data;
}
// Dates are Jakarta-local, matching how the app reads them.
const day = (offset: number, time = "09:00") => {
  const d = new Date(Date.now() + 7 * 3600000 + offset * 86400000);
  return `${d.toISOString().slice(0, 10)}T${time}`;
};
const date = (offset: number) => day(offset).slice(0, 10);
const rec = (kind: string, title: string, data: Record<string, unknown> = {}, tags: string[] = []) =>
  api("/records", "POST", { kind, title, data, tags });

csrf = (await api("/auth/login", "POST", { email, password })).csrf;

const nusantara = await rec("companies", "PT Nusantara Digital", { industry: "Software", location: "Jakarta" });
const logistik = await rec("companies", "Logisource", { industry: "Logistik", location: "Surabaya" });
const freelance = await rec("companies", "Freelance", { industry: "Konsultan" });
await rec("employments", "Product Engineer", { companyId: nusantara.id, company: "PT Nusantara Digital", position: "Product Engineer", startDate: "2024-03-01", location: "Jakarta" });
await rec("employments", "Operations Analyst", { companyId: logistik.id, company: "Logisource", position: "Operations Analyst", startDate: "2021-06-01", endDate: "2024-02-28" });

const crm = await rec("projects", "Redesign CRM", { companyId: nusantara.id, status: "In Progress", startDate: date(-20), endDate: date(25), role: "Lead" });
const app = await rec("projects", "Aplikasi Tracking Armada", { companyId: logistik.id, status: "To Do", startDate: date(3) });
const site = await rec("projects", "Website Klinik Sehat", { companyId: freelance.id, status: "In Progress", endDate: date(10) });

const t1 = await rec("tasks", "Review desain dashboard CRM", { companyId: nusantara.id, projectId: crm.id, status: "In Progress", priority: "High", due: day(0, "15:00"), checklist: [{ id: crypto.randomUUID(), text: "Cek alur onboarding", checked: true }, { id: crypto.randomUUID(), text: "Tulis catatan untuk tim", checked: false }] });
await rec("tasks", "Kirim invoice Klinik Sehat", { companyId: freelance.id, projectId: site.id, status: "To Do", priority: "Urgent", due: day(-1, "17:00") });
await rec("tasks", "Siapkan demo tracking armada", { companyId: logistik.id, projectId: app.id, status: "To Do", priority: "Medium", due: day(2, "10:00") });
await rec("tasks", "Perpanjang STNK motor", { status: "To Do", priority: "Medium", due: day(5, "09:00") });
await rec("tasks", "Beli hadiah ulang tahun Ibu", { status: "Inbox", priority: "Low" });

await rec("events", "Standup tim CRM", { companyId: nusantara.id, projectId: crm.id, start: day(0, "09:30"), end: day(0, "09:45"), category: "Work", recurrence: "Daily" });
await rec("events", "Meeting klien Klinik Sehat", { companyId: freelance.id, projectId: site.id, start: day(0, "13:00"), end: day(0, "14:00"), category: "Work", location: "Zoom" });
await rec("events", "Futsal", { start: day(0, "19:30"), end: day(0, "21:00"), category: "Personal", location: "GOR Senayan" });
await rec("events", "Makan malam keluarga", { start: day(1, "18:30"), end: day(1, "20:00"), category: "Family" });

const run = await rec("habits", "Lari pagi", { target: 1, unit: "sesi", frequency: "Daily" });
const read = await rec("habits", "Baca 20 menit", { target: 20, unit: "menit", frequency: "Daily" });
await rec("habits", "Minum 8 gelas air", { target: 8, unit: "gelas", frequency: "Daily" });
for (const [h, offs] of [[run, [-1, -2, -3]], [read, [-1, -2]]] as const)
  for (const o of offs) await rec("habitEntries", "Check-in", { habitId: h.id, date: date(o), value: 1 });

await rec("timesheets", "Desain dashboard", { companyId: nusantara.id, projectId: crm.id, taskId: t1.id, date: date(-1), minutes: 180, kind: "Work" });
await rec("timesheets", "Wireframe klinik", { companyId: freelance.id, projectId: site.id, date: date(-2), minutes: 120, kind: "Work" });

const goal = await rec("goals", "Dana darurat 6 bulan", { targetDate: date(180), progress: 35, status: "In Progress", category: "Keuangan" });
await rec("milestones", "Terkumpul 3 bulan", { goalId: goal.id, date: date(60) });
const kickoff = await rec("notes", "Catatan kickoff CRM", { kind: "Meeting", content: "Fokus: onboarding pelanggan dan laporan penjualan mingguan.", pinned: true });
await api("/links", "POST", { sourceId: kickoff.id, targetId: crm.id, relation: "related" });
await rec("notes", "Ide konten LinkedIn", { kind: "Idea", content: "Tulis pengalaman migrasi CRM." });
await rec("importantDates", "Ulang tahun Ibu", { date: "1965-12-03", person: "Ibu", annual: true });

const bank = await api("/accounts", "POST", { name: "BCA", type: "Bank", opening: "12500000.00" });
const wallet = await api("/accounts", "POST", { name: "GoPay", type: "E-wallet", opening: "350000.00" });
const tx = (kind: string, accountId: string, amount: string, category: string, description: string, offset: number, recordId?: string) =>
  api("/transactions", "POST", { kind, accountId, amount, category, description, date: date(offset), key: crypto.randomUUID(), ...(recordId ? { recordId } : {}) });
await tx("income", bank.id, "15000000.00", "Gaji", "Gaji November", -5, nusantara.id);
await tx("income", bank.id, "4500000.00", "Proyek", "DP Website Klinik Sehat", -8, site.id);
await tx("expense", bank.id, "650000.00", "Software", "Lisensi Figma & hosting", -3, crm.id);
await tx("expense", wallet.id, "85000.00", "Makan", "Makan siang", -1);
await tx("expense", bank.id, "1200000.00", "Tabungan", "Setor dana darurat", -4, goal.id);
await api("/debts", "POST", { name: "KPR Rumah", principal: "350000000.00", apr: 7.5, months: 180, start: date(-400), creditorType: "bank", repaymentMode: "installment", dueDay: Number(date(3).slice(8, 10)), monthlyPayment: "3250000.00", repaymentStart: date(-400).slice(0, 7), installmentCount: 180, paymentBank: "BCA" });
await api("/debts", "POST", { name: "Paylater Shopee", principal: "1800000.00", apr: 0, months: 3, start: date(-30), creditorType: "paylater", repaymentMode: "installment", dueDay: Number(date(6).slice(8, 10)), monthlyPayment: "600000.00", repaymentStart: date(-30).slice(0, 7), installmentCount: 3 });
console.log("Seeded sample data");
