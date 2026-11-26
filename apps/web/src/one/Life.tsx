import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Repeat, Target } from "lucide-react";
import type { RecordItem } from "../../../../packages/shared/catalog";
import { useRecords, byId, todayKey, fmtDay, upcomingDates, relDay, isDone, recordHref } from "./data";
import { Section, RecordRow, KindIcon, Empty, PageHead, Segmented, Progress, cx } from "./ui";
import { statusLabel } from "./kinds";
import { HabitCard } from "./Today";
import { useQuickAdd } from "./quick";

type Tab = "habits" | "goals" | "journal" | "dates" | "travel";
const mood: Record<string, string> = { Great: "😄 Sangat baik", Good: "🙂 Baik", Okay: "😐 Biasa", Low: "😕 Kurang", Difficult: "😣 Berat" };

export default function Life() {
  const { tab = "habits" } = useParams();
  const navigate = useNavigate();
  const quick = useQuickAdd();
  const records = useRecords();
  const all = records.data || [];
  const index = useMemo(() => byId(all), [all]);
  const today = todayKey();
  const of = (k: string) => all.filter((r) => r.kind === k);
  const add: Record<string, React.ReactNode> = {
    habits: <Link className="o-btn primary small" to="/records/habits/new"><Plus size={15} /> Kebiasaan</Link>,
    goals: <button className="o-btn primary small" onClick={() => quick({ kind: "goals" })}><Plus size={15} /> Tujuan</button>,
    journal: <Link className="o-btn primary small" to="/records/wellness/new"><Plus size={15} /> Jurnal</Link>,
    dates: <Link className="o-btn primary small" to="/records/importantDates/new"><Plus size={15} /> Tanggal</Link>,
    travel: <Link className="o-btn primary small" to="/records/travel/new"><Plus size={15} /> Perjalanan</Link>,
  };
  return (
    <>
      <PageHead title={({ habits: "Kebiasaan", goals: "Tujuan", journal: "Jurnal", dates: "Tanggal penting", travel: "Perjalanan" } as Record<string, string>)[tab] || "Hidup"} actions={add[tab]} />
      <Segmented<Tab> label="Bagian hidup" value={tab as Tab} onChange={(v) => navigate(`/life/${v}`, { replace: true })}
        options={[
          { value: "habits", label: "Kebiasaan", count: of("habits").length },
          { value: "goals", label: "Tujuan", count: of("goals").filter((g) => !isDone(g)).length },
          { value: "journal", label: "Jurnal" },
          { value: "dates", label: "Tanggal" },
          { value: "travel", label: "Perjalanan" },
        ]} />
      {records.isPending ? <div className="o-skel" /> : tab === "goals" ? <Goals all={all} />
        : tab === "journal" ? <Journal all={all} />
        : tab === "dates" ? <Dates all={all} today={today} />
        : tab === "travel" ? <Travel all={all} />
        : <Habits all={all} today={today} index={index} />}
    </>
  );
}

function Habits({ all, today }: { all: RecordItem[]; today: string; index: Map<string, RecordItem> }) {
  const habits = all.filter((r) => r.kind === "habits");
  const entries = all.filter((r) => r.kind === "habitEntries");
  if (!habits.length) return <Empty icon={<Repeat size={20} />} title="Belum ada kebiasaan" text="Mulai dari satu kebiasaan kecil — check-in setiap hari langsung dari halaman Hari Ini." />;
  return (
    <>
      <Section title="Check-in hari ini"><div className="o-habits">{habits.map((h) => <HabitCard key={h.id} habit={h} entries={entries} day={today} />)}</div></Section>
      <Section title="Semua kebiasaan"><div className="o-list">{habits.map((h) => <RecordRow key={h.id} record={h} meta={`${h.data.frequency === "Weekly" ? "Mingguan" : "Harian"}${h.data.target ? ` · ${h.data.target} ${h.data.unit || ""}` : ""}`} />)}</div></Section>
    </>
  );
}

function Goals({ all }: { all: RecordItem[] }) {
  const goals = all.filter((r) => r.kind === "goals").sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
  const milestones = all.filter((r) => r.kind === "milestones");
  if (!goals.length) return <Empty icon={<Target size={20} />} title="Belum ada tujuan" text="Tujuan bisa ditautkan ke task, kebiasaan, tabungan, dan catatan agar progresnya terlihat." />;
  return (
    <div className="o-cards">
      {goals.map((g) => {
        const ms = milestones.filter((m) => m.data.goalId === g.id);
        return (
          <Link key={g.id} to={recordHref(g)} className="o-hub-card">
            <header><KindIcon kind="goals" /><div><h3>{g.title}</h3>
              <div className="o-row-meta"><span className={cx("o-tag", isDone(g) ? "ok" : "accent")}>{statusLabel[String(g.data.status)] || "Tujuan"}</span>{g.data.targetDate && <span>Target {fmtDay(String(g.data.targetDate), { month: "short", year: "numeric" })}</span>}</div></div></header>
            <Progress value={Number(g.data.progress || 0)} total={100} tone="var(--c-life)" />
            <div className="o-hub-facts"><span><b>{Number(g.data.progress || 0)}%</b></span>{ms.length > 0 && <span><b>{ms.filter((m) => m.data.completed).length}/{ms.length}</b> milestone</span>}</div>
          </Link>
        );
      })}
    </div>
  );
}

function Journal({ all }: { all: RecordItem[] }) {
  const rows = all.filter((r) => ["wellness", "reviews", "activities"].includes(r.kind) || (r.kind === "notes" && r.data.kind === "Daily journal"))
    .sort((a, b) => String(b.data.date || b.updatedAt).localeCompare(String(a.data.date || a.updatedAt)));
  if (!rows.length) return <Empty title="Jurnal masih kosong" text="Catat suasana hati, energi, dan refleksi singkat. Polanya akan terlihat seiring waktu." action={<Link className="o-btn small" to="/records/wellness/new">Tulis jurnal pertama</Link>} />;
  return <div className="o-list">{rows.map((r) => <RecordRow key={r.id} record={r} meta={<>{r.data.date && <span>{fmtDay(String(r.data.date))}</span>}{r.data.mood && <span>{mood[String(r.data.mood)]}</span>}</>} />)}</div>;
}

function Dates({ all, today }: { all: RecordItem[]; today: string }) {
  const soon = upcomingDates(all, today, 60);
  const rows = all.filter((r) => r.kind === "importantDates");
  if (!rows.length) return <Empty title="Belum ada tanggal penting" text="Ulang tahun dan hari jadi akan muncul otomatis di halaman Hari Ini menjelang harinya." />;
  return (
    <>
      {soon.length > 0 && <Section title="60 hari ke depan"><div className="o-list">{soon.map(({ record, date }) => <RecordRow key={record.id + date} record={record} meta={`${relDay(date)}${record.data.person ? " · " + record.data.person : ""}`} />)}</div></Section>}
      <Section title="Semua" count={rows.length}><div className="o-list">{rows.map((r) => <RecordRow key={r.id} record={r} meta={`${r.data.annual ? "Tahunan · " : ""}${String(r.data.date || "").slice(5) || ""}`} />)}</div></Section>
    </>
  );
}

function Travel({ all }: { all: RecordItem[] }) {
  const rows = all.filter((r) => r.kind === "travel").sort((a, b) => String(b.data.startDate || "").localeCompare(String(a.data.startDate || "")));
  if (!rows.length) return <Empty title="Belum ada perjalanan" text="Rencanakan perjalanan, lalu tautkan agenda, catatan, dan pengeluarannya." />;
  return <div className="o-list">{rows.map((r) => <RecordRow key={r.id} record={r} meta={`${r.data.destination || ""}${r.data.startDate ? " · " + fmtDay(String(r.data.startDate)) : ""}`} />)}</div>;
}
