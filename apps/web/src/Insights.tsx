import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import * as store from "./store";
import { Button, PageHeader, Field, ErrorText } from "./ui";
import { rp, total } from "./money";
export default function Insights() {
  const { data: rs = [], error: recordsError } = useQuery({
    queryKey: ["records"],
    queryFn: () => store.records(),
  });
  const { data: f, error: financeError } = useQuery({
    queryKey: ["finance"],
    queryFn: store.finance,
  });
  const [days, setDays] = useState(7);
  const [prompt, setPrompt] = useState("");
  const [consent, setConsent] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const ai = useQuery({
    queryKey: ["ai"],
    queryFn: () =>
      store.trial
        ? Promise.resolve({ configured: false })
        : store.api("/ai/status"),
  });
  const cutoff = Date.now() - days * 86400000;
  const current = rs.filter(
    (r) => new Date(r.data.date || r.updatedAt).getTime() >= cutoff,
  );
  const completed = current.filter(
    (r) => r.kind === "tasks" && r.data.status === "Completed",
  );
  const hours = current
    .filter((r) => r.kind === "trainings" && r.data.status === "Completed")
    .reduce((a, r) => a + Number(r.data.hours || 0), 0);
  const expenses = (f?.transactions || []).filter(
    (t: any) =>
      !t.reversed &&
      t.kind === "expense" &&
      new Date(t.date).getTime() >= cutoff,
  );
  const report = `# Review ${days} hari\n\nTugas selesai: ${completed.length}\nJam belajar: ${hours}\nPengeluaran: ${rp(total(expenses, "amount"))}\n\n## Work records\n${current
    .filter((r) => r.kind === "work")
    .map((r) => "- " + r.title + ": " + (r.data.contribution || ""))
    .join("\n")}\n\n## Achievements\n${current
    .filter((r) => r.kind === "achievements")
    .map((r) => "- " + r.title)
    .join("\n")}\n\n## Career history\n${rs
    .filter((r) => r.kind === "employments")
    .map(
      (r) =>
        `- ${r.data.startDate || ""}–${r.data.endDate || "sekarang"}: ${r.data.position || ""} · ${r.data.company || r.title}`,
    )
    .join("\n")}`;
  return (
    <>
      <PageHeader
        eyebrow="Intelligence"
        title="Review & insights"
        description="Lihat apa yang sudah bergerak, lalu pilih fokus berikutnya."
      >
        <Button
          variant="outline"
          onClick={() => store.download("febro-one-review.md", report)}
        >
          <Download size={16} />
          Export
        </Button>
      </PageHeader>
      <ErrorText error={recordsError || financeError} />
      <div className="tabs page-tabs">
        {[1, 7, 30].map((n) => (
          <button
            key={n}
            className={n === days ? "active" : ""}
            onClick={() => setDays(n)}
          >
            {n === 1 ? "Harian" : n === 7 ? "Mingguan" : "Bulanan"}
          </button>
        ))}
        <Link to="/records/reviews">Refleksi pribadi</Link>
        <Link to="/records/automations">Automation rules</Link>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span>Tugas selesai</span>
          <strong>{completed.length}</strong>
          <small>{days} hari terakhir</small>
        </div>
        <div className="stat">
          <span>Jam belajar</span>
          <strong>{hours}</strong>
          <small>Training berstatus completed</small>
        </div>
        <div className="stat">
          <span>Pengeluaran</span>
          <strong>{rp(total(expenses, "amount"))}</strong>
          <small>Transaksi expense</small>
        </div>
        <div className="stat">
          <span>Waktu fokus / kerja</span>
          <strong>
            {current
              .filter((r) => r.kind === "timesheets")
              .reduce((a, r) => a + Number(r.data.minutes || 0), 0)}{" "}
            <small>min</small>
          </strong>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Career timeline</h2>
          {rs
            .filter((r) =>
              ["employments", "trainings", "achievements"].includes(r.kind),
            )
            .sort((a, b) =>
              String(b.data.date || b.data.startDate).localeCompare(
                String(a.data.date || a.data.startDate),
              ),
            )
            .map((r) => (
              <Link to={"/records/"+r.kind} className="timeline-row" key={r.id}>
                <small>
                  {r.data.date || r.data.startDate || "Tanggal belum diisi"}
                </small>
                <strong>{r.title}</strong>
                <p>{r.data.company || r.data.provider || r.data.impact}</p>
              </Link>
            ))}
          {!rs.some((r) => r.kind === "employments") && (
            <p className="hint">
              Tambahkan riwayat kerja dan pelatihan untuk membangun timeline.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Fokus yang perlu perhatian</h2>
          {rs
            .filter(
              (r) =>
                r.kind === "tasks" &&
                r.data.status !== "Completed" &&
                r.data.due &&
                new Date(r.data.due) < new Date(),
            )
            .slice(0, 5)
            .map((r) => (
              <p key={r.id}>• {r.title} — tenggat terlewati</p>
            ))}
          <p className="hint">
            Saran ini dihitung dari tenggat tugas yang tersimpan, tanpa mengirim
            data ke AI.
          </p>
          <Link to="/records/tasks" className="text-button">
            Buka tasks →
          </Link>
        </section>
      </div>
      <section className="panel" aria-label="Pengeluaran per kategori">
        <div className="section-heading"><h2>Pengeluaran per kategori</h2><Link to="/finance">Buka keuangan →</Link></div>
        {expenses.length ? [...new Set<string>(expenses.map((t:any) => String(t.category || "Tanpa kategori")))].map(category => ({category, amount: total(expenses.filter((t:any) => String(t.category || "Tanpa kategori") === category), "amount")})).sort((a,b) => b.amount.comparedTo(a.amount)).slice(0,6).map(({category,amount}) => <div className="bento-progress-row" key={category}>
          <strong>{category}</strong><progress aria-label={category} max={total(expenses,"amount").toNumber() || 1} value={amount.toNumber()}/><span>{rp(amount)}</span>
        </div>) : <p className="hint">Belum ada pengeluaran pada periode ini.</p>}
      </section>
      <section className="panel ai-panel">
        <div className="section-heading">
          <h2>Personal AI assistant</h2>
          <span className="badge">
            {ai.data?.configured ? "Terhubung" : "Perlu konfigurasi"}
          </span>
        </div>
        {!ai.data?.configured ? (
          <p>
            {store.trial
              ? "AI eksternal tidak aktif pada trial browser. Pada VPS, atur provider dan API key di environment."
              : "Atur AI_BASE_URL, AI_MODEL, dan AI_API_KEY pada environment server untuk mengaktifkan assistant."}{" "}
            Catatan pribadi tidak dikirim otomatis.
          </p>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await store.api("/ai", "POST", { prompt, consent });
                setAnswer(r.text);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Teks yang akan dikirim ke provider">
              <textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tempel catatan yang sudah Anda periksa, lalu minta ringkasan atau draft laporan."
                required
              />
            </Field>
            <Field label="Saya setuju teks di atas dikirim ke provider AI">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
            </Field>
            <Button disabled={!consent || busy} type="submit">
              {busy ? "Memproses…" : "Kirim"}
            </Button>
          </form>
        )}
        <ErrorText error={error} />
        {answer && <pre className="ai-answer">{answer}</pre>}
      </section>
    </>
  );
}
