import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, CalendarDays, Sun } from "lucide-react";
import type { RecordItem } from "../../../../packages/shared/catalog";
import { streak } from "../../../../packages/shared/domain";
import {
  useRecords, useFinance, useIdentity, useMutate, todayKey, addDays, dayKey, fmtTime, fmtDay, relDay,
  eventsOn, upcomingDates, dueInstallments, monthTotals, rupiah, isDone, taskDue, taskProgress, byId, recordHref,
} from "./data";
import { Section, Row, KindIcon, Chip, Check, Empty, Stat, cx } from "./ui";
import { priorityLabel } from "./kinds";
import * as store from "../store";

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }));
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
}

/** Chips for the company / project a record belongs to. */
export function Context({ record, index, hide }: { record: RecordItem; index: Map<string, RecordItem>; hide?: string }) {
  const ids = [record.data.projectId, record.data.companyId].filter((id) => id && id !== hide);
  const refs = (ids.length > 1 ? ids.slice(0, 1) : ids).map((id) => index.get(String(id))).filter(Boolean) as RecordItem[];
  return <>{refs.map((r) => <Chip key={r.id} record={r} />)}</>;
}

export function TaskLine({ task, index, showDue = true, hide }: { task: RecordItem; index: Map<string, RecordItem>; showDue?: boolean; hide?: string }) {
  const { save } = useMutate();
  const [busy, setBusy] = useState(false);
  const done = task.data.status === "Completed";
  const due = taskDue(task);
  const overdue = !done && due && due < todayKey();
  const progress = taskProgress(task);
  const toggle = async () => {
    setBusy(true);
    try { await save({ ...task, data: { ...task.data, status: done ? "To Do" : "Completed" } }); }
    finally { setBusy(false); }
  };
  return (
    <Row to={recordHref(task)} strike={done}
      leading={<Check checked={done} busy={busy} onChange={toggle} label={`Tandai "${task.title}" selesai`} />}
      title={task.title}
      meta={<>
        {showDue && due && <span className={cx("o-tag", overdue ? "danger" : due === todayKey() ? "warn" : "")}>{overdue ? "Terlambat · " : ""}{relDay(due)}{task.data.due ? " " + fmtTime(String(task.data.due)) : ""}</span>}
        {["High", "Urgent"].includes(String(task.data.priority)) && <span className="o-tag danger">{priorityLabel[String(task.data.priority)]}</span>}
        {progress && <span>{progress.done}/{progress.total} checklist</span>}
        <Context record={task} index={index} hide={hide} />
      </>} />
  );
}

export function HabitCard({ habit, entries, day }: { habit: RecordItem; entries: RecordItem[]; day: string }) {
  const { save, refresh } = useMutate();
  const [busy, setBusy] = useState(false);
  const mine = entries.filter((e) => e.data.habitId === habit.id);
  const todays = mine.find((e) => e.data.date === day && Number(e.data.value) > 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const toggle = async () => {
    setBusy(true);
    try {
      if (todays) { await store.archiveRecord(todays); await refresh(); }
      else await save({ kind: "habitEntries", title: habit.title, tags: [], data: { habitId: habit.id, date: day, value: Number(habit.data.target || 1) } });
    } finally { setBusy(false); }
  };
  const s = streak(entries, habit.id, day);
  return (
    <button type="button" className={cx("o-habit", todays && "done")} onClick={toggle} disabled={busy} aria-pressed={!!todays}>
      <div className="o-habit-top">
        <strong>{habit.title}</strong>
        <Check checked={!!todays} onChange={toggle} busy={busy} label={`Check-in ${habit.title}`} />
      </div>
      <div className="o-dots" aria-hidden>{week.map((d) => <i key={d} className={mine.some((e) => e.data.date === d && Number(e.data.value) > 0) ? "on" : ""} />)}</div>
      <small>{s ? `🔥 ${s} hari beruntun` : habit.data.target ? `Target ${habit.data.target} ${habit.data.unit || ""}` : "Mulai hari ini"}</small>
    </button>
  );
}

export default function Today() {
  const records = useRecords();
  const finance = useFinance();
  const identity = useIdentity();
  const { save } = useMutate();
  const [capture, setCapture] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayKey();
  const all = records.data || [];
  const index = useMemo(() => byId(all), [all]);
  const now = Date.now();

  const events = useMemo(() => eventsOn(all, today), [all, today]);
  const tasks = useMemo(() => {
    const open = all.filter((r) => r.kind === "tasks" && !isDone(r));
    const dueSoon = open.filter((t) => { const d = taskDue(t); return d && d <= today; });
    const doing = open.filter((t) => t.data.status === "In Progress" && !dueSoon.includes(t));
    const doneToday = all.filter((t) => t.kind === "tasks" && t.data.status === "Completed" && dayKey(t.updatedAt) === today);
    const sortKey = (t: RecordItem) => `${taskDue(t) || "9999"}${t.data.due || ""}`;
    return { now: [...dueSoon.sort((a, b) => sortKey(a).localeCompare(sortKey(b))), ...doing], doneToday, overdue: dueSoon.filter((t) => taskDue(t)! < today).length };
  }, [all, today]);
  const habits = all.filter((r) => r.kind === "habits");
  const entries = all.filter((r) => r.kind === "habitEntries");
  const habitsDone = habits.filter((h) => entries.some((e) => e.data.habitId === h.id && e.data.date === today)).length;
  const installments = useMemo(() => dueInstallments(finance.data, today, 7), [finance.data, today]);
  const totals = monthTotals(finance.data);
  const ahead = useMemo(() => {
    const out: { date: string; node: React.ReactNode; key: string }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, i);
      for (const e of eventsOn(all, d)) out.push({ date: d, key: e.id + e.occurrence, node: <Row key={e.id + e.occurrence} to={recordHref(e)} icon={<KindIcon kind="events" />} title={e.title} meta={<><span>{relDay(d)} · {fmtTime(e.data.start)}</span><Context record={e} index={index} /></>} /> });
      for (const t of all.filter((r) => r.kind === "tasks" && !isDone(r) && taskDue(r) === d)) out.push({ date: d, key: t.id, node: <TaskLine key={t.id} task={t} index={index} /> });
    }
    for (const { record, date } of upcomingDates(all, addDays(today, 1), 14))
      out.push({ date, key: record.id + date, node: <Row key={record.id + date} to={recordHref(record)} icon={<KindIcon kind="importantDates" />} title={record.title} meta={relDay(date)} /> });
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  }, [all, today, index]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!capture.trim() || busy) return;
    setBusy(true);
    try { await save({ kind: "tasks", title: capture.trim(), tags: [], data: { status: "To Do", priority: "Medium", due: `${today}T17:00` } }); setCapture(""); }
    finally { setBusy(false); }
  }

  if (records.isPending) return <><div className="o-skel" style={{ height: 90 }} /><div className="o-skel" /><div className="o-skel" /></>;
  const name = String(identity.data?.user?.name || "").split(" ")[0];
  const nextEvent = events.find((e) => new Date(e.data.end).getTime() > now);

  return (
    <>
      <div className="o-hero">
        <div className="o-eyebrow">{fmtDay(today, { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1>{greeting()}{name ? `, ${name}` : ""}.</h1>
        <p>{nextEvent ? <>Berikutnya: <b>{nextEvent.title}</b> pukul {fmtTime(nextEvent.data.start)}</> : events.length ? "Agenda hari ini sudah selesai." : "Tidak ada agenda hari ini."}</p>
      </div>

      <div className="o-pills">
        <Link className="o-pill" to="/calendar" style={{ "--tint": "var(--c-today)" } as React.CSSProperties}><CalendarDays size={15} /><b>{events.length}</b> agenda</Link>
        <span className="o-pill" style={{ "--tint": tasks.overdue ? "var(--danger)" : "var(--c-work)" } as React.CSSProperties}><b>{tasks.now.length}</b> task{tasks.overdue ? <> · <b>{tasks.overdue}</b> terlambat</> : ""}</span>
        {habits.length > 0 && <span className="o-pill" style={{ "--tint": "var(--c-life)" } as React.CSSProperties}><b>{habitsDone}/{habits.length}</b> kebiasaan</span>}
        {installments.length > 0 && <Link className="o-pill" to="/debts" style={{ "--tint": "var(--warn)" } as React.CSSProperties}><b>{installments.length}</b> cicilan perlu dibayar</Link>}
      </div>

      <form className="o-capture" onSubmit={add}>
        <input value={capture} onChange={(e) => setCapture(e.target.value)} placeholder="Tambah task untuk hari ini…" aria-label="Task baru untuk hari ini" maxLength={240} />
        <button className="o-btn primary small" disabled={!capture.trim() || busy} aria-label="Tambah"><ArrowUp size={16} /></button>
      </form>

      <div className="o-grid-2">
        <div>
          <Section title="Jadwal hari ini" count={events.length} action={<Link to="/calendar">Kalender</Link>}>
            {events.length ? (
              <div className="o-timeline">
                {events.map((e) => {
                  const start = new Date(e.data.start).getTime(), end = new Date(e.data.end).getTime();
                  return (
                    <div key={e.id + e.occurrence} className={cx("o-event", now >= start && now < end && "now", now >= end && "past")}>
                      <time>{e.data.allDay ? "Hari ini" : fmtTime(e.data.start)}{!e.data.allDay && <small>{fmtTime(e.data.end)}</small>}</time>
                      <Link to={recordHref(e)} className="o-event-card" style={e.data.color ? ({ "--tint": e.data.color } as React.CSSProperties) : undefined}>
                        <strong>{e.title}</strong>
                        <span className="o-row-meta">{e.data.location && <span>{e.data.location}</span>}<Context record={e} index={index} /></span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : <Empty icon={<Sun size={20} />} title="Hari yang lega" text="Belum ada agenda. Tambahkan lewat tombol + kapan saja." />}
          </Section>

          <Section title="Perlu dikerjakan" count={tasks.now.length} action={<Link to="/work/tasks">Semua task</Link>}>
            {tasks.now.length ? (
              <div className="o-list">{tasks.now.map((t) => <TaskLine key={t.id} task={t} index={index} />)}</div>
            ) : <Empty title="Semua beres" text="Tidak ada task yang jatuh tempo hari ini." />}
            {tasks.doneToday.length > 0 && (
              <div className="o-list" style={{ marginTop: 8 }}>{tasks.doneToday.map((t) => <TaskLine key={t.id} task={t} index={index} showDue={false} />)}</div>
            )}
          </Section>
        </div>

        <div>
          {habits.length > 0 && (
            <Section title="Kebiasaan" action={<Link to="/life">Kelola</Link>}>
              <div className="o-habits">{habits.map((h) => <HabitCard key={h.id} habit={h} entries={entries} day={today} />)}</div>
            </Section>
          )}

          <Section title="Uang" action={<Link to="/finance">Buka</Link>}>
            <div className="o-stats" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: installments.length ? 10 : 0 }}>
              <Stat label="Masuk bulan ini" value={rupiah(totals.income, true)} tone="var(--c-money)" />
              <Stat label="Keluar bulan ini" value={rupiah(totals.expense, true)} />
            </div>
            {installments.length > 0 && (
              <div className="o-list">
                {installments.map((i) => (
                  <Row key={i.debt.id + i.date} to="/debts" icon={<KindIcon kind="debts" />} title={i.debt.name}
                    meta={<span className={cx("o-tag", i.overdue ? "danger" : "warn")}>{i.overdue ? "Lewat · " : ""}{relDay(i.date)}</span>}
                    trailing={<span className="o-trailing">{rupiah(i.amount)}</span>} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Minggu ini" count={ahead.length}>
            {ahead.length ? <div className="o-list">{ahead.map((a) => a.node)}</div> : <Empty title="Minggu yang tenang" text="Belum ada agenda atau tenggat 7 hari ke depan." />}
          </Section>
        </div>
      </div>
    </>
  );
}
