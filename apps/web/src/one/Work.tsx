import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FolderKanban, Building2, Plus, Search } from "lucide-react";
import type { RecordItem } from "../../../../packages/shared/catalog";
import { useRecords, useFinance, byId, isDone, taskDue, todayKey, addDays, hours, rupiah, fmtDay, recordHref } from "./data";
import { Section, Row, RecordRow, KindIcon, Chip, Empty, PageHead, Segmented, Progress, Stat, cx } from "./ui";
import { statusLabel } from "./kinds";
import { TaskLine, Context } from "./Today";
import { useQuickAdd } from "./quick";

type Tab = "projects" | "tasks" | "companies" | "time" | "career";

function useWorkIndex() {
  const records = useRecords();
  const finance = useFinance();
  const all = records.data || [];
  return useMemo(() => {
    const index = byId(all);
    const stats = new Map<string, { open: number; done: number; minutes: number; income: number; expense: number; projects: number }>();
    const bump = (id: unknown, f: (s: any) => void) => {
      if (!id) return;
      const s = stats.get(String(id)) || { open: 0, done: 0, minutes: 0, income: 0, expense: 0, projects: 0 };
      f(s); stats.set(String(id), s);
    };
    for (const r of all) {
      const targets = [r.data.projectId, r.data.companyId];
      if (r.kind === "tasks") targets.forEach((t) => bump(t, (s) => (isDone(r) ? s.done++ : s.open++)));
      if (r.kind === "timesheets") targets.forEach((t) => bump(t, (s) => (s.minutes += Number(r.data.minutes || 0))));
      if (r.kind === "projects") bump(r.data.companyId, (s) => s.projects++);
    }
    for (const t of finance.data?.transactions || []) {
      if (t.reversed || !t.recordId) continue;
      const rec = index.get(t.recordId);
      const ids = [t.recordId, rec?.kind === "projects" ? rec.data.companyId : null];
      ids.forEach((id) => bump(id, (s) => (t.kind === "income" ? (s.income += Number(t.amount)) : t.kind !== "transfer" && (s.expense += Number(t.amount)))));
    }
    return { all, index, stats, loading: records.isPending };
  }, [all, finance.data]);
}

export default function Work() {
  const { tab = "projects" } = useParams();
  const navigate = useNavigate();
  const quick = useQuickAdd();
  const w = useWorkIndex();
  const count = (k: string, f: (r: RecordItem) => boolean = () => true) => w.all.filter((r) => r.kind === k && f(r)).length;
  return (
    <>
      <PageHead title={({ projects: "Proyek", tasks: "Task", companies: "Perusahaan", time: "Jam kerja", career: "Karier" } as Record<string, string>)[tab] || "Kerja"}
        actions={<button className="o-btn primary small" onClick={() => quick({ kind: tab === "projects" ? "projects" : "tasks" })}><Plus size={15} /> {tab === "projects" ? "Proyek" : "Task"}</button>} />
      <Segmented<Tab> label="Bagian kerja" value={tab as Tab} onChange={(v) => navigate(`/work/${v}`, { replace: true })}
        options={[
          { value: "projects", label: "Proyek", count: count("projects", (r) => !isDone(r)) },
          { value: "tasks", label: "Task", count: count("tasks", (r) => !isDone(r)) },
          { value: "companies", label: "Perusahaan" },
          { value: "time", label: "Jam" },
          { value: "career", label: "Karier" },
        ]} />
      {w.loading ? <><div className="o-skel" /><div className="o-skel" /></>
        : tab === "tasks" ? <Tasks w={w} />
        : tab === "companies" ? <Companies w={w} />
        : tab === "time" ? <Time w={w} />
        : tab === "career" ? <Career w={w} />
        : <Projects w={w} />}
    </>
  );
}

type W = ReturnType<typeof useWorkIndex>;

function HubFacts({ s }: { s?: { open: number; done: number; minutes: number; income: number; expense: number; projects: number } }) {
  if (!s) return <div className="o-hub-facts"><span>Belum ada aktivitas</span></div>;
  return (
    <div className="o-hub-facts">
      {s.projects > 0 && <span><b>{s.projects}</b> proyek</span>}
      <span><b>{s.open}</b> task terbuka</span>
      {s.minutes > 0 && <span><b>{hours(s.minutes)}</b></span>}
      {(s.income > 0 || s.expense > 0) && <span><b style={{ color: s.income - s.expense >= 0 ? "var(--c-money)" : "var(--text)" }}>{rupiah(s.income - s.expense, true)}</b> bersih</span>}
    </div>
  );
}

function Projects({ w }: { w: W }) {
  const [showDone, setShowDone] = useState(false);
  const projects = w.all.filter((r) => r.kind === "projects").sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || b.updatedAt.localeCompare(a.updatedAt));
  const visible = projects.filter((p) => showDone || !isDone(p));
  if (!projects.length) return <Empty icon={<FolderKanban size={20} />} title="Belum ada proyek" text="Proyek mengikat task, agenda, jam kerja, catatan, dan uang dalam satu tempat." />;
  return (
    <>
      <div className="o-cards">
        {visible.map((p) => {
          const s = w.stats.get(p.id);
          const total = (s?.open || 0) + (s?.done || 0);
          const company = w.index.get(String(p.data.companyId));
          return (
            <Link key={p.id} to={recordHref(p)} className="o-hub-card">
              <header>
                <KindIcon kind="projects" />
                <div>
                  <h3>{p.title}</h3>
                  <div className="o-row-meta">
                    <span className={cx("o-tag", p.data.status === "In Progress" ? "accent" : isDone(p) ? "ok" : "")}>{statusLabel[String(p.data.status)] || "Proyek"}</span>
                    {company && <Chip record={company} />}
                    {p.data.endDate && <span>s.d. {fmtDay(String(p.data.endDate))}</span>}
                  </div>
                </div>
              </header>
              {total > 0 && <Progress value={s!.done} total={total} tone="var(--c-work)" />}
              <HubFacts s={s} />
            </Link>
          );
        })}
      </div>
      {projects.some(isDone) && <button className="o-btn ghost small" style={{ marginTop: 12 }} onClick={() => setShowDone((v) => !v)}>{showDone ? "Sembunyikan yang selesai" : `Tampilkan ${projects.filter(isDone).length} proyek selesai`}</button>}
    </>
  );
}

function Tasks({ w }: { w: W }) {
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const today = todayKey();
  const tasks = w.all.filter((r) => r.kind === "tasks" && (!filter || r.data.projectId === filter || r.data.companyId === filter) && (!q || r.title.toLowerCase().includes(q.toLowerCase())));
  const open = tasks.filter((t) => !isDone(t));
  const bucket = (t: RecordItem) => {
    const d = taskDue(t);
    if (d && d < today) return "Terlambat";
    if (d === today) return "Hari ini";
    if (t.data.status === "In Progress") return "Berjalan";
    if (d && d <= addDays(today, 7)) return "Minggu ini";
    if (d) return "Nanti";
    return t.data.status === "Inbox" ? "Inbox" : "Tanpa tenggat";
  };
  const order = ["Terlambat", "Hari ini", "Berjalan", "Minggu ini", "Nanti", "Tanpa tenggat", "Inbox"];
  const groups = order.map((g) => [g, open.filter((t) => bucket(t) === g).sort((a, b) => String(a.data.due || "").localeCompare(String(b.data.due || "")))] as const).filter(([, l]) => l.length);
  const done = tasks.filter((t) => t.data.status === "Completed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);
  const contexts = w.all.filter((r) => (r.kind === "projects" && !isDone(r)) || r.kind === "companies");
  return (
    <>
      <label className="o-search"><Search size={16} /><input placeholder="Cari task…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari task" /></label>
      {contexts.length > 0 && (
        <div className="o-pills" style={{ marginBottom: 14 }}>
          <button className="o-pill" style={{ cursor: "pointer", ...(filter === "" ? { borderColor: "var(--accent)" } : {}) }} onClick={() => setFilter("")}>Semua</button>
          {contexts.map((c) => (
            <button key={c.id} className="o-pill" style={{ cursor: "pointer", ...(filter === c.id ? { borderColor: "var(--accent)" } : {}) }} onClick={() => setFilter(filter === c.id ? "" : c.id)}>
              <KindIcon kind={c.kind} size={13} boxed={false} />{c.title}
            </button>
          ))}
        </div>
      )}
      {groups.length ? groups.map(([g, list]) => (
        <Section key={g} title={g} count={list.length}>
          <div className="o-list">{list.map((t) => <TaskLine key={t.id} task={t} index={w.index} showDue={g !== "Tanpa tenggat" && g !== "Inbox"} />)}</div>
        </Section>
      )) : <Empty title="Tidak ada task terbuka" text={filter ? "Tidak ada task terbuka untuk pilihan ini." : "Tambah task dari tombol +."} />}
      {done.length > 0 && (
        <Section title="Baru selesai" count={done.length}>
          <div className="o-list">{done.map((t) => <TaskLine key={t.id} task={t} index={w.index} showDue={false} />)}</div>
        </Section>
      )}
    </>
  );
}

function Companies({ w }: { w: W }) {
  const companies = w.all.filter((r) => r.kind === "companies");
  const roles = w.all.filter((r) => r.kind === "employments");
  if (!companies.length) return <Empty icon={<Building2 size={20} />} title="Belum ada perusahaan" text="Perusahaan menghubungkan riwayat kerja, proyek, task, dan pemasukan." />;
  return (
    <div className="o-cards">
      {companies.map((c) => {
        const role = roles.filter((r) => r.data.companyId === c.id).sort((a, b) => String(b.data.startDate).localeCompare(String(a.data.startDate)))[0];
        return (
          <Link key={c.id} to={recordHref(c)} className="o-hub-card">
            <header>
              <KindIcon kind="companies" />
              <div>
                <h3>{c.title}</h3>
                <div className="o-row-meta">
                  {role ? <span>{role.data.position || role.title} · {role.data.endDate ? `s.d. ${String(role.data.endDate).slice(0, 4)}` : <span className="o-tag ok">Saat ini</span>}</span> : <span>{c.data.industry || "Perusahaan"}</span>}
                </div>
              </div>
            </header>
            <HubFacts s={w.stats.get(c.id)} />
          </Link>
        );
      })}
    </div>
  );
}

function Time({ w }: { w: W }) {
  const today = todayKey();
  const sheets = w.all.filter((r) => r.kind === "timesheets").sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  const week = sheets.filter((s) => String(s.data.date) >= addDays(today, -6));
  const month = sheets.filter((s) => String(s.data.date).startsWith(today.slice(0, 7)));
  const sum = (l: RecordItem[]) => l.reduce((n, s) => n + Number(s.data.minutes || 0), 0);
  const perProject = new Map<string, number>();
  for (const s of month) perProject.set(String(s.data.projectId || s.data.companyId || ""), (perProject.get(String(s.data.projectId || s.data.companyId || "")) || 0) + Number(s.data.minutes || 0));
  return (
    <>
      <div className="o-stats">
        <Stat label="7 hari terakhir" value={hours(sum(week))} tone="var(--c-work)" />
        <Stat label="Bulan ini" value={hours(sum(month))} />
      </div>
      {perProject.size > 0 && (
        <Section title="Bulan ini per proyek">
          <div className="o-list">{[...perProject.entries()].sort((a, b) => b[1] - a[1]).map(([id, m]) => {
            const r = w.index.get(id);
            return r ? <RecordRow key={id} record={r} trailing={<span className="o-trailing">{hours(m)}</span>} />
              : <Row key="none" title="Tanpa proyek" trailing={<span className="o-trailing">{hours(m)}</span>} />;
          })}</div>
        </Section>
      )}
      <Section title="Catatan jam" count={sheets.length}>
        {sheets.length ? <div className="o-list">{sheets.slice(0, 40).map((s) => (
          <RecordRow key={s.id} record={s} meta={<>{fmtDay(String(s.data.date))}<Context record={s} index={w.index} /></>} trailing={<span className="o-trailing">{hours(Number(s.data.minutes || 0))}</span>} />
        ))}</div> : <Empty title="Belum ada jam tercatat" text="Catat jam kerja dari halaman proyek atau lewat Edit → Jam kerja." action={<Link className="o-btn small" to="/records/timesheets/new">+ Catat jam</Link>} />}
      </Section>
    </>
  );
}

function Career({ w }: { w: W }) {
  const employments = w.all.filter((r) => r.kind === "employments").sort((a, b) => String(b.data.startDate || "").localeCompare(String(a.data.startDate || "")));
  const growth = w.all.filter((r) => ["trainings", "certificates", "achievements", "competencies", "learning"].includes(r.kind))
    .sort((a, b) => String(b.data.date || b.data.issued || b.updatedAt).localeCompare(String(a.data.date || a.data.issued || a.updatedAt)));
  return (
    <>
      <Section title="Riwayat kerja" count={employments.length} action={<Link to="/records/employments/new">+ Tambah</Link>}>
        {employments.length ? <div className="o-list">{employments.map((e) => {
          const company = w.index.get(String(e.data.companyId));
          return <RecordRow key={e.id} record={e} meta={<>{String(e.data.startDate || "").slice(0, 7)} – {e.data.endDate ? String(e.data.endDate).slice(0, 7) : "sekarang"}{company && <Chip record={company} />}</>} />;
        })}</div> : <Empty title="Belum ada riwayat kerja" />}
      </Section>
      <Section title="Pelatihan, sertifikat & prestasi" count={growth.length} action={<span style={{ display: "flex", gap: 10 }}><Link to="/records/trainings/new">+ Pelatihan</Link><Link to="/records/certificates/new">+ Sertifikat</Link></span>}>
        {growth.length ? <div className="o-list">{growth.map((g) => <RecordRow key={g.id} record={g} />)}</div>
          : <Empty title="Belum ada catatan pengembangan diri" text="Simpan pelatihan, sertifikat, dan prestasi di sini — bisa ditautkan ke perusahaan." />}
      </Section>
    </>
  );
}
