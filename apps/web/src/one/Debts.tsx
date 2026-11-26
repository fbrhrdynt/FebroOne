import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Landmark, Check as CheckIcon, Pencil, Archive, CircleCheck, Paperclip, Undo2 } from "lucide-react";
import * as store from "../store";
import { formatMoneyInput } from "../money";
import { useFinance, useRecords, todayKey, rupiah, fmtDay, relDay } from "./data";
import { Sheet, Section, Row, Empty, PageHead, Stat, Segmented, Progress, ErrorNote, Check, cx } from "./ui";

type Debt = any;
const creditorLabel: Record<string, string> = {
  bank: "Pinjaman bank", "credit-card": "Kartu kredit", paylater: "PayLater", pinjol: "Pinjaman online",
  koperasi: "Koperasi", personal: "Pribadi", other: "Lainnya",
};
const digits = (v: unknown) => String(v ?? "").replace(/[^0-9]/g, "");
const monthLabel = (p: string, short = false) =>
  new Date(p + "-01T12:00:00Z").toLocaleDateString("id-ID", { month: short ? "short" : "long", year: "numeric", timeZone: "UTC" });
const shiftMonth = (p: string, n: number) => {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};
const dueDateOf = (period: string, day?: number) => {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period}-${String(Math.min(day || 1, last)).padStart(2, "0")}`;
};

/** Every instalment period of a debt, with its paid record if any. */
function schedule(d: Debt, installments: any[], current: string) {
  const start = d.repaymentStart || current;
  const count = d.installmentCount ? Number(d.installmentCount) : Math.max(1, monthsBetween(start, current) + 4);
  const paid = new Map(installments.filter((x) => x.debtId === d.id && x.status === "paid").map((x) => [String(x.period).slice(0, 7), x]));
  return Array.from({ length: Math.min(count, 600) }, (_, i) => {
    const period = shiftMonth(start, i);
    return { period, due: dueDateOf(period, Number(d.dueDay)), paid: paid.get(period) };
  });
}

function useDebts() {
  const finance = useFinance();
  const today = todayKey(), current = today.slice(0, 7);
  return useMemo(() => {
    const debts: Debt[] = finance.data?.debts || [];
    const installments: any[] = finance.data?.installments || [];
    const rows = debts.map((d) => {
      const sched = schedule(d, installments, current);
      const unpaid = sched.filter((s) => !s.paid);
      const due = unpaid.filter((s) => s.period <= current);
      const next = unpaid[0];
      const remaining = Number(d.principal) > 0 ? Math.max(0, Number(d.principal) - Number(d.paid || 0)) : null;
      return { d, sched, due, next, remaining, paidCount: sched.length - unpaid.length };
    });
    return { rows, loading: finance.isPending, error: finance.error, accounts: finance.data?.accounts || [], today, current };
  }, [finance.data, finance.isPending, finance.error, today, current]);
}

export default function Debts() {
  const s = useDebts();
  const [tab, setTab] = useState<"active" | "settled">("active");
  const [paying, setPaying] = useState<{ d: Debt; periods: string[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Debt | null>(null);
  const active = s.rows.filter((r) => !r.d.settledAt);
  const settled = s.rows.filter((r) => r.d.settledAt);
  const toPay = active.filter((r) => r.due.length).sort((a, b) => a.due[0].due.localeCompare(b.due[0].due));
  const thisMonth = active.reduce((n, r) => n + (r.due.some((p) => p.period === s.current) ? Number(r.d.monthlyPayment || 0) : 0), 0);
  const remaining = active.reduce((n, r) => n + (r.remaining || 0), 0);
  const upcoming = active.map((r) => r.next).filter(Boolean).sort((a, b) => a!.due.localeCompare(b!.due))[0];
  const selected = s.rows.find((r) => r.d.id === open);

  if (s.loading) return <><div className="o-skel" /><div className="o-skel" /></>;
  return (
    <>
      <PageHead title="Utang" subtitle="Cicilan, jadwal, dan pelunasan."
        actions={<button className="o-btn primary small" onClick={() => setEditing({})}><Plus size={15} /> Catat utang</button>} />
      <ErrorNote error={s.error} />
      <div className="o-stats">
        <Stat label="Sisa utang" value={rupiah(remaining, true)} hint={`${active.length} utang aktif`} />
        <Stat label="Belum dibayar bulan ini" value={rupiah(thisMonth, true)} tone={thisMonth ? "var(--warn)" : "var(--c-money)"} />
        <Stat label="Jatuh tempo berikutnya" value={upcoming ? relDay(upcoming.due) : "—"} />
        <Stat label="Sudah lunas" value={settled.length} />
      </div>

      <Section title="Perlu dibayar" count={toPay.length || undefined}>
        {toPay.length ? (
          <div className="o-list">
            {toPay.map((r) => {
              const first = r.due[0];
              const lateCount = r.due.filter((p) => p.due < s.today).length;
              return (
                <Row key={r.d.id} onClick={() => setOpen(r.d.id)}
                  icon={<span className="o-kind-icon" style={{ "--tint": lateCount ? "var(--danger)" : "var(--warn)" } as React.CSSProperties}><Landmark size={16} /></span>}
                  title={r.d.name || "Utang tanpa nama"}
                  meta={lateCount
                    ? <><span className="o-tag danger">{lateCount} bulan terlambat</span><span>sejak {monthLabel(first.period, true)}</span></>
                    : <span className="o-tag warn">{relDay(first.due)}</span>}
                  trailing={<span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="o-trailing">{r.d.monthlyPayment ? rupiah(Number(r.d.monthlyPayment) * r.due.length, r.due.length > 1) : ""}</span>
                    <button className="o-btn primary small" onClick={(e) => { e.stopPropagation(); setPaying({ d: r.d, periods: [first.period] }); }}>Bayar</button>
                  </span>} />
              );
            })}
          </div>
        ) : <Empty icon={<CheckIcon size={18} />} title="Semua cicilan sudah dibayar" text={upcoming ? `Berikutnya ${relDay(upcoming.due).toLowerCase()}.` : "Tidak ada cicilan yang jatuh tempo."} />}
      </Section>

      <Segmented label="Status utang" value={tab} onChange={setTab}
        options={[{ value: "active", label: "Aktif", count: active.length }, { value: "settled", label: "Lunas", count: settled.length }]} />
      {(tab === "active" ? active : settled).length ? (
        <div className="o-cards">
          {(tab === "active" ? active : settled).map((r) => (
            <button key={r.d.id} type="button" className="o-hub-card" style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }} onClick={() => setOpen(r.d.id)}>
              <header>
                <span className="o-kind-icon" style={{ "--tint": "var(--c-money)" } as React.CSSProperties}><Landmark size={16} /></span>
                <div>
                  <h3>{r.d.name || "Utang tanpa nama"}</h3>
                  <div className="o-row-meta">
                    <span>{creditorLabel[r.d.creditorType] || "Lainnya"}</span>
                    {r.d.settledAt ? <span className="o-tag ok">Lunas</span> : r.due.some((p) => p.due < s.today) ? <span className="o-tag danger">{r.due.filter((p) => p.due < s.today).length} terlambat</span> : null}
                  </div>
                </div>
              </header>
              {r.d.installmentCount ? <Progress value={r.paidCount} total={Number(r.d.installmentCount)} tone="var(--c-money)" /> : null}
              <div className="o-hub-facts">
                {r.remaining !== null && <span>Sisa <b>{rupiah(r.remaining)}</b></span>}
                {r.d.monthlyPayment && <span><b>{rupiah(r.d.monthlyPayment)}</b>/bln</span>}
                {r.d.installmentCount ? <span><b>{r.paidCount}/{r.d.installmentCount}</b> cicilan</span> : null}
                {r.d.dueDay && <span>Tgl <b>{r.d.dueDay}</b></span>}
              </div>
            </button>
          ))}
        </div>
      ) : <Empty icon={<Landmark size={20} />} title={tab === "active" ? "Belum ada utang aktif" : "Belum ada utang lunas"} action={tab === "active" ? <button className="o-btn small" onClick={() => setEditing({})}>Catat utang</button> : undefined} />}

      {selected && <DebtSheet row={selected} today={s.today} current={s.current} onClose={() => setOpen(null)}
        onPay={(periods) => setPaying({ d: selected.d, periods })} onEdit={() => setEditing(selected.d)} />}
      {paying && <PaySheet debt={paying.d} periods={paying.periods} accounts={s.accounts}
        unpaid={s.rows.find((r) => r.d.id === paying.d.id)?.sched.filter((x) => !x.paid && x.period <= shiftMonth(s.current, 2)).map((x) => x.period) || []}
        onClose={() => setPaying(null)} />}
      {editing && <DebtForm debt={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function PaySheet({ debt, periods: initial, unpaid, accounts, onClose }: { debt: Debt; periods: string[]; unpaid: string[]; accounts: any[]; onClose: () => void }) {
  const q = useQueryClient();
  const [periods, setPeriods] = useState<string[]>(initial);
  const [amount, setAmount] = useState(formatMoneyInput(Math.round(Number(debt.monthlyPayment || 0))));
  const [date, setDate] = useState(todayKey());
  const [account, setAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const options = [...new Set([...unpaid, ...initial])].sort();
  const each = Number(digits(amount) || 0);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!periods.length || busy) return;
    setBusy(true); setError(undefined);
    try {
      await store.markDebtInstallmentPaid({ debtId: debt.id, periods, amount: each ? String(each) : undefined, paidAt: date, notes: notes || undefined, paid: true });
      if (account && each)
        await store.addTransaction({ kind: "expense", accountId: account, amount: String(each * periods.length), category: "Cicilan utang",
          date, description: `Cicilan ${debt.name || "utang"} · ${periods.map((p) => monthLabel(p, true)).join(", ")}`, key: crypto.randomUUID() });
      if (files.length) {
        const rec = await store.saveRecord({ kind: "notes", title: `Bukti pembayaran - ${debt.name || "Utang"}`, tags: ["finance", "debt-payment", debt.id, ...periods],
          data: { folder: "Keuangan/Bukti Pembayaran", kind: "Knowledge", content: `Bukti pembayaran cicilan ${debt.name || "utang"} periode ${periods.join(", ")}`, pinned: false, favorite: false } });
        for (const f of files) await store.uploadFile(rec.id, f);
      }
      await Promise.all([q.invalidateQueries({ queryKey: ["finance"] }), q.invalidateQueries({ queryKey: ["records"] })]);
      onClose();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={`Bayar ${debt.name || "utang"}`}>
      <form className="o-form" onSubmit={submit}>
        <div className="o-field"><span>Periode yang dibayar</span>
          <div className="o-link-slot">{options.map((p) => (
            <button type="button" key={p} className={cx("o-pill", periods.includes(p) && "on")} aria-pressed={periods.includes(p)}
              onClick={() => setPeriods((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p].sort()))}>{monthLabel(p, true)}</button>
          ))}</div>
        </div>
        <div className="o-form-row">
          <label className="o-field"><span>Nominal per bulan</span>
            <input className="o-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatMoneyInput(e.target.value))} placeholder="0" /></label>
          <label className="o-field"><span>Tanggal bayar</span>
            <input className="o-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayKey()} /></label>
        </div>
        <label className="o-field"><span>Dibayar dari rekening (opsional)</span>
          <select className="o-input" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Jangan catat sebagai pengeluaran</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} · {rupiah(a.balance)}</option>)}
          </select></label>
        <label className="o-field"><span>Catatan (opsional)</span>
          <input className="o-input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Contoh: transfer via m-banking" /></label>
        <label className="o-field"><span>Bukti bayar (opsional)</span>
          <input className="o-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>
        <ErrorNote error={error} />
        <button className="o-btn primary block" disabled={busy || !periods.length}>
          {busy ? "Menyimpan…" : `Tandai ${periods.length} bulan dibayar${each ? ` · ${rupiah(each * periods.length)}` : ""}`}
        </button>
      </form>
    </Sheet>
  );
}

function DebtSheet({ row, today, current, onClose, onPay, onEdit }: {
  row: ReturnType<typeof useDebts>["rows"][number]; today: string; current: string; onClose: () => void; onPay: (p: string[]) => void; onEdit: () => void;
}) {
  const q = useQueryClient();
  const records = useRecords();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [confirm, setConfirm] = useState<"" | "settle" | "archive">("");
  const [showAll, setShowAll] = useState(false);
  const { d, sched } = row;
  const run = async (fn: () => Promise<unknown>, close = false) => {
    setBusy(true); setError(undefined);
    try { await fn(); await q.invalidateQueries({ queryKey: ["finance"] }); if (close) onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const toggle = (s: (typeof sched)[number]) => s.paid
    ? run(() => store.deleteDebtInstallment(s.paid.id))
    : run(() => store.markDebtInstallmentPaid({ debtId: d.id, periods: [s.period], amount: d.monthlyPayment ? String(Math.round(Number(d.monthlyPayment))) : undefined, paidAt: s.due <= today ? s.due : today, paid: true }));
  // Show the recent past, everything due, and a few months ahead; the rest on demand.
  const visible = showAll ? sched : sched.filter((s) => s.period >= shiftMonth(current, -3) && s.period <= shiftMonth(current, 6));
  const docIds = new Set((records.data || []).filter((r) => r.tags.includes(d.id)).map((r) => r.id));
  const files = useFiles().filter((f: any) => docIds.has(f.record_id));
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={d.name || "Utang"} wide>
      <div className="o-stats" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        <Stat label="Sisa utang" value={row.remaining !== null ? rupiah(row.remaining) : "—"} />
        <Stat label="Cicilan" value={d.monthlyPayment ? rupiah(d.monthlyPayment) : "—"} hint={d.dueDay ? `Setiap tanggal ${d.dueDay}` : undefined} />
      </div>
      <div className="o-page-actions" style={{ marginBottom: 16 }}>
        {row.due.length > 0 && !d.settledAt && <button className="o-btn primary small" onClick={() => onPay(row.due.map((x) => x.period))}>Bayar {row.due.length > 1 ? `${row.due.length} bulan` : monthLabel(row.due[0].period, true)}</button>}
        <button className="o-btn small" onClick={onEdit}><Pencil size={14} /> Edit</button>
        {!d.settledAt && <button className="o-btn small" onClick={() => setConfirm("settle")}><CircleCheck size={14} /> Tandai lunas</button>}
        <button className="o-btn small ghost" onClick={() => setConfirm("archive")}><Archive size={14} /> Arsipkan</button>
      </div>
      {confirm && (
        <div className="o-card" style={{ padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
          <span>{confirm === "settle" ? "Pindahkan utang ini ke daftar Lunas? Riwayat pembayaran tetap tersimpan." : "Arsipkan utang ini? Data tidak dihapus permanen, tapi tidak tampil lagi."}</span>
          <div className="o-page-actions">
            <button className={cx("o-btn small", confirm === "archive" ? "danger" : "primary")} disabled={busy}
              onClick={() => run(() => (confirm === "settle" ? store.settleDebt(d.id) : store.archiveDebt(d.id)), true)}>{confirm === "settle" ? "Ya, lunas" : "Ya, arsipkan"}</button>
            <button className="o-btn small ghost" onClick={() => setConfirm("")}>Batal</button>
          </div>
        </div>
      )}
      <ErrorNote error={error} />
      <Section title="Jadwal cicilan" action={<span className="o-row-meta">{row.paidCount}/{sched.length} dibayar</span>}>
        <div className="o-list">
          {visible.map((s) => {
            const late = !s.paid && s.due < today;
            return (
              <Row key={s.period} strike={false} muted={!!s.paid && s.period < current}
                leading={<Check checked={!!s.paid} busy={busy} onChange={() => toggle(s)} label={`${s.paid ? "Batalkan" : "Tandai"} pembayaran ${monthLabel(s.period)}`} />}
                title={monthLabel(s.period)}
                meta={s.paid
                  ? <span>Dibayar {s.paid.paidAt ? fmtDay(String(s.paid.paidAt).slice(0, 10), { day: "numeric", month: "short", year: "numeric" }) : ""}{s.paid.amount ? ` · ${rupiah(s.paid.amount)}` : ""}</span>
                  : <span className={cx("o-tag", late ? "danger" : s.period === current ? "warn" : "")}>{late ? "Terlambat · " : "Jatuh tempo "}{fmtDay(s.due, { day: "numeric", month: "short" })}</span>}
                trailing={s.paid ? <Undo2 size={14} style={{ color: "var(--faint)" }} aria-hidden /> : undefined} />
            );
          })}
        </div>
        {sched.length > visible.length && <button className="o-btn ghost small" style={{ marginTop: 8 }} onClick={() => setShowAll(true)}>Tampilkan semua {sched.length} bulan</button>}
        <p className="o-row-meta" style={{ marginTop: 8 }}>Ketuk lingkaran untuk menandai atau membatalkan satu bulan. Untuk mencatat nominal lain atau bukti bayar, pakai tombol Bayar.</p>
      </Section>
      {(d.paymentAccount || d.agreementDate || d.notes) && (
        <Section title="Detail">
          <dl className="o-facts">
            {d.paymentAccount && <div><dt>No. kontrak / kartu</dt><dd>{d.paymentAccount}</dd></div>}
            {d.agreementDate && <div><dt>Kesepakatan</dt><dd>{fmtDay(d.agreementDate, { day: "numeric", month: "short", year: "numeric" })}</dd></div>}
            {d.installmentCount && <div><dt>Tenor</dt><dd>{d.installmentCount} bulan</dd></div>}
            {d.repaymentStart && <div><dt>Mulai</dt><dd>{monthLabel(d.repaymentStart)}</dd></div>}
          </dl>
          {d.notes && <div className="o-card o-prose">{d.notes}</div>}
        </Section>
      )}
      {files.length > 0 && (
        <Section title="Dokumen & bukti" count={files.length}>
          <div className="o-list">{files.map((f: any) => <Row key={f.id} onClick={() => store.downloadFile(f, true)} icon={<span className="o-kind-icon" style={{ "--tint": "var(--muted)" } as React.CSSProperties}><Paperclip size={15} /></span>} title={f.name} meta={`${Math.ceil(f.size / 1024)} KB`} />)}</div>
        </Section>
      )}
    </Sheet>
  );
}

function useFiles() {
  return useQuery<any[]>({ queryKey: ["files"], queryFn: store.getFiles }).data || [];
}

function DebtForm({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const q = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const isNew = !debt.id;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(undefined);
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form)) as Record<string, any>;
    const files = Array.from((form.elements.namedItem("debtFiles") as HTMLInputElement)?.files || []);
    delete raw.debtFiles;
    for (const k of Object.keys(raw)) if (raw[k] === "") delete raw[k];
    for (const k of ["principal", "monthlyPayment"]) if (raw[k] !== undefined) raw[k] = digits(raw[k]);
    const data = {
      ...raw, direction: "borrowed", repaymentMode: "installment",
      apr: debt.apr ?? 0, months: debt.months ?? 1, start: debt.start || undefined, model: debt.model || "reducing", rates: debt.rates || [],
      reminderDays: Number(raw.reminderDays || 7),
    };
    try {
      const saved = isNew ? await store.addDebt(data) : await store.updateDebt(debt.id, data);
      if (files.length) {
        const rec = await store.saveRecord({ kind: "notes", title: `Dokumen utang - ${raw.name || "Utang"}`, tags: ["finance", "debt-document", saved.id || debt.id],
          data: { folder: "Keuangan/Utang", kind: "Knowledge", content: `Dokumen dari kreditur untuk ${raw.name || "utang"}`, pinned: false, favorite: false } });
        for (const f of files) await store.uploadFile(rec.id, f);
      }
      await Promise.all([q.invalidateQueries({ queryKey: ["finance"] }), q.invalidateQueries({ queryKey: ["records"] })]);
      onClose();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  const money = (v: unknown) => (v ? formatMoneyInput(Math.round(Number(v))) : "");
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={isNew ? "Catat utang" : "Edit utang"}>
      <form className="o-form" onSubmit={submit}>
        <label className="o-field"><span>Nama bank / layanan</span><input name="name" defaultValue={debt.name || ""} placeholder="Contoh: KPR BCA, Kredivo" /></label>
        <label className="o-field"><span>Jenis</span>
          <select name="creditorType" defaultValue={debt.creditorType || "other"}>
            {Object.entries(creditorLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <div className="o-form-row">
          <label className="o-field"><span>Total utang</span><input name="principal" inputMode="numeric" defaultValue={money(debt.principal)} onInput={(e) => (e.currentTarget.value = formatMoneyInput(e.currentTarget.value))} placeholder="0" /></label>
          <label className="o-field"><span>Cicilan / bulan</span><input name="monthlyPayment" inputMode="numeric" defaultValue={money(debt.monthlyPayment)} onInput={(e) => (e.currentTarget.value = formatMoneyInput(e.currentTarget.value))} placeholder="0" /></label>
        </div>
        <div className="o-form-row">
          <label className="o-field"><span>Mulai cicilan</span><input name="repaymentStart" type="month" defaultValue={debt.repaymentStart || todayKey().slice(0, 7)} /></label>
          <label className="o-field"><span>Jatuh tempo (tanggal)</span><input name="dueDay" type="number" min={1} max={31} defaultValue={debt.dueDay || ""} placeholder="1–31" /></label>
        </div>
        <div className="o-form-row">
          <label className="o-field"><span>Tenor (bulan)</span><input name="installmentCount" type="number" min={1} max={600} defaultValue={debt.installmentCount || ""} placeholder="Kosongkan jika belum tahu" /></label>
          <label className="o-field"><span>Ingatkan</span>
            <select name="reminderDays" defaultValue={String(debt.reminderDays || 7)}>{[3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n} hari sebelumnya</option>)}</select></label>
        </div>
        <div className="o-form-row">
          <label className="o-field"><span>Tanggal kesepakatan</span><input name="agreementDate" type="date" defaultValue={debt.agreementDate || ""} /></label>
          <label className="o-field"><span>No. kontrak / kartu</span><input name="paymentAccount" defaultValue={debt.paymentAccount || ""} /></label>
        </div>
        <label className="o-field"><span>Catatan</span><textarea name="notes" rows={3} defaultValue={debt.notes || ""} /></label>
        <label className="o-field"><span>Dokumen dari kreditur (opsional)</span><input type="file" name="debtFiles" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple /></label>
        <ErrorNote error={error} />
        <button className="o-btn primary block" disabled={busy}>{busy ? "Menyimpan…" : isNew ? "Simpan utang" : "Simpan perubahan"}</button>
      </form>
    </Sheet>
  );
}

