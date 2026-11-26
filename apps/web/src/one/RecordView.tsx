import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Link2, Plus, Archive, RotateCcw, X, Paperclip, Wallet, Unlink } from "lucide-react";
import { catalog, type RecordItem } from "../../../../packages/shared/catalog";
import { checklistItems } from "../../../../packages/shared/domain";
import * as store from "../store";
import { plainContent } from "../RecordForm";
import {
  useRelated, useRecords, useMutate, byId, fmtDay, fmtTime, dayKey, rupiah, hours, isDone, recordHref, todayKey, type Related,
} from "./data";
import { kindMeta, areaColor, statusLabel, priorityLabel } from "./kinds";
import { Section, Row, RecordRow, KindIcon, Chip, Check, Empty, ErrorNote, Progress, Stat, cx } from "./ui";
import { LinkPicker } from "./LinkPicker";
import { TaskLine, HabitCard } from "./Today";
import { useQuickAdd } from "./quick";

const longFields = new Set(["description", "content", "checklist", "responsibilities", "contribution", "lessons", "impact", "packing", "itinerary", "wins", "next", "payload", "inputs", "assumptions"]);
const hiddenFields = new Set(["habitId", "goalId", "taskId", "parent", "dependencies", "color", "pinned", "favorite", "exceptions", "company", "project"]);

function formatValue(type: string | undefined, v: unknown, key: string) {
  if (v === undefined || v === null || v === "") return null;
  if (type === "checkbox") return v ? "Ya" : "Tidak";
  if (type === "datetime-local") return `${fmtDay(dayKey(String(v)), { day: "numeric", month: "short", year: "numeric" })}, ${fmtTime(String(v))}`;
  if (type === "date") return fmtDay(String(v).slice(0, 10), { day: "numeric", month: "short", year: "numeric" });
  if (key === "status") return statusLabel[String(v)] || String(v);
  if (key === "priority") return priorityLabel[String(v)] || String(v);
  if (key === "minutes") return hours(Number(v));
  if (["amount", "target", "saved"].includes(key) && Number(v) > 1000) return rupiah(v);
  if (key === "url" || key === "website" || key === "resource") return <a href={String(v)} target="_blank" rel="noreferrer noopener" style={{ color: "var(--accent)" }}>{String(v).replace(/^https:\/\//, "")}</a>;
  return String(v);
}

export default function RecordView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const related = useRelated(id);
  const records = useRecords();
  const index = useMemo(() => byId(records.data), [records.data]);
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"));
  if (related.isPending) return <><div className="o-skel" style={{ height: 100 }} /><div className="o-skel" /><div className="o-skel" /></>;
  if (related.error || !related.data) return <><button className="o-back" onClick={back}><ChevronLeft size={18} /> Kembali</button><ErrorNote error={related.error || "Record tidak ditemukan"} /></>;
  return <Detail data={related.data} index={index} back={back} />;
}

function Detail({ data, index, back }: { data: Related; index: Map<string, RecordItem>; back: () => void }) {
  const { record, references, children, links, transactions, files } = data;
  const meta = kindMeta(record.kind);
  const fields = catalog[record.kind]?.fields || [];
  const quick = useQuickAdd();
  const { save, refresh } = useMutate();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const isHub = ["projects", "companies", "goals", "travel"].includes(record.kind);
  const tint = areaColor(record.kind);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await fn(); await refresh(); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const facts = fields
    .filter((f) => !longFields.has(f.key) && !hiddenFields.has(f.key) && !(record.kind === "tasks" && f.key === "progress"))
    .map((f) => ({ label: f.label, value: formatValue(f.type, record.data[f.key], f.key), key: f.key }))
    .filter((f) => f.value !== null);
  const prose = fields.filter((f) => longFields.has(f.key) && f.key !== "checklist" && record.data[f.key]).map((f) => ({ label: f.label, text: f.key === "content" ? plainContent(String(record.data[f.key])) : String(record.data[f.key]) }));

  const groups = useMemo(() => {
    const g = new Map<string, RecordItem[]>();
    for (const c of children) {
      if (c.kind === "habitEntries") continue;
      g.set(c.kind, [...(g.get(c.kind) || []), c]);
    }
    return g;
  }, [children]);
  const tasks = groups.get("tasks") || [];
  const openTasks = tasks.filter((t) => !isDone(t));
  const doneTasks = tasks.filter((t) => isDone(t));
  const minutes = (groups.get("timesheets") || []).reduce((n, t) => n + Number(t.data.minutes || 0), 0);
  const money = transactions.filter((t) => !t.reversed);
  const moneyIn = money.filter((t) => t.kind === "income").reduce((n, t) => n + Number(t.amount), 0);
  const moneyOut = money.filter((t) => t.kind !== "income" && t.kind !== "transfer").reduce((n, t) => n + Number(t.amount), 0);
  const linkedIds = [record.id, ...links.map((l) => l.record.id), ...references.map((r) => r.id)];

  return (
    <>
      <button className="o-back" onClick={back}><ChevronLeft size={18} /> Kembali</button>
      <header className="o-detail-head">
        <div className="o-detail-kind" style={{ color: tint }}><KindIcon kind={record.kind} size={15} boxed={false} /> {meta.label}{record.archivedAt && <span className="o-tag">Arsip</span>}</div>
        <h1>{record.title}</h1>
        <div className="o-detail-chips">
          {record.data.status && <span className={cx("o-tag", record.data.status === "Completed" ? "ok" : record.data.status === "In Progress" ? "accent" : "")}>{statusLabel[String(record.data.status)] || String(record.data.status)}</span>}
          {references.map((r) => <Chip key={r.id} record={r} />)}
          {record.tags.map((t) => <span key={t} className="o-tag">#{t}</span>)}
        </div>
        <div className="o-page-actions">
          <Link className="o-btn small" to={`/records/${record.kind}/${record.id}/edit`}><Pencil size={14} /> Edit</Link>
          {isHub && <button className="o-btn small" onClick={() => quick({ kind: "tasks", link: record })}><Plus size={14} /> Task</button>}
          {isHub && <button className="o-btn small" onClick={() => quick({ kind: "events", link: record })}><Plus size={14} /> Agenda</button>}
          <button className="o-btn small" onClick={() => setPicking(true)}><Link2 size={14} /> Tautkan</button>
          {record.archivedAt
            ? <button className="o-btn small" disabled={busy} onClick={() => run(() => store.restoreRecord(record.id))}><RotateCcw size={14} /> Pulihkan</button>
            : <button className="o-btn small ghost" disabled={busy} onClick={() => run(async () => { await store.archiveRecord(record); back(); })}><Archive size={14} /> Arsipkan</button>}
        </div>
      </header>
      <ErrorNote error={error} />

      {record.kind === "tasks" && <Checklist record={record} save={save} />}
      {record.kind === "habits" && <HabitHistory habit={record} entries={children.filter((c) => c.kind === "habitEntries")} />}
      {record.kind === "goals" && (
        <Section title="Progres">
          <div className="o-card" style={{ padding: 14, display: "grid", gap: 8 }}>
            <Progress value={Number(record.data.progress || 0)} total={100} tone={tint} />
            <span className="o-row-meta">{Number(record.data.progress || 0)}% · {(groups.get("milestones") || []).filter((m) => m.data.completed).length}/{(groups.get("milestones") || []).length} milestone</span>
          </div>
        </Section>
      )}

      {isHub && (tasks.length > 0 || minutes > 0 || money.length > 0) && (
        <div className="o-stats">
          <Stat label="Task terbuka" value={openTasks.length} hint={`${doneTasks.length} selesai`} tone="var(--c-work)" />
          <Stat label="Jam tercatat" value={hours(minutes)} />
          <Stat label="Uang masuk" value={rupiah(moneyIn, true)} tone="var(--c-money)" />
          <Stat label="Uang keluar" value={rupiah(moneyOut, true)} />
        </div>
      )}

      <div className="o-grid-2">
        <div>
          {facts.length > 0 && (
            <dl className="o-facts">{facts.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
          )}
          {prose.map((p) => (
            <Section key={p.label} title={p.label}><div className="o-card o-prose">{p.text}</div></Section>
          ))}

          {groups.has("projects") && (
            <Section title="Proyek" count={groups.get("projects")!.length}>
              <div className="o-list">{groups.get("projects")!.map((p) => <RecordRow key={p.id} record={p} meta={statusLabel[String(p.data.status)] || "Proyek"} />)}</div>
            </Section>
          )}
          {isHub || tasks.length ? (
            <Section title="Task" count={openTasks.length} action={<button className="o-link" onClick={() => quick({ kind: "tasks", link: record })}>+ Tambah</button>}>
              {openTasks.length ? <div className="o-list">{openTasks.map((t) => <TaskLine key={t.id} task={t} index={index} hide={record.id} />)}</div>
                : <Empty title="Tidak ada task terbuka" text={doneTasks.length ? `${doneTasks.length} task sudah selesai.` : "Tambahkan langkah pertama untuk ini."} />}
            </Section>
          ) : null}
          {[...groups.entries()].filter(([k]) => !["projects", "tasks"].includes(k)).map(([k, rows]) => (
            <Section key={k} title={kindMeta(k).plural} count={rows.length}>
              <div className="o-list">{rows.slice(0, 20).map((r) => (
                <RecordRow key={r.id} record={r} meta={
                  k === "timesheets" ? `${hours(Number(r.data.minutes || 0))} · ${r.data.date ? fmtDay(String(r.data.date)) : ""}`
                  : k === "events" ? `${fmtDay(dayKey(String(r.data.start)))} · ${fmtTime(String(r.data.start))}`
                  : k === "employments" ? `${r.data.position || ""} · ${r.data.startDate || ""}${r.data.endDate ? " – " + r.data.endDate : " – sekarang"}`
                  : undefined} />
              ))}</div>
            </Section>
          ))}
        </div>

        <div>
          <Section title="Terhubung" count={links.length} action={<button className="o-link" onClick={() => setPicking(true)}>+ Tautkan</button>}>
            {links.length ? (
              <div className="o-list">{links.map((l) => (
                <Row key={l.record.id + l.relation} to={recordHref(l.record)} icon={<KindIcon kind={l.record.kind} />} title={l.record.title}
                  meta={kindMeta(l.record.kind).label}
                  trailing={<button className="o-icon-btn" aria-label={`Lepas tautan ${l.record.title}`} disabled={busy}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); run(() => store.api("/links", "DELETE", l.direction === "out" ? { sourceId: record.id, targetId: l.record.id, relation: l.relation } : { sourceId: l.record.id, targetId: record.id, relation: l.relation })); }}>
                    <Unlink size={15} /></button>} />
              ))}</div>
            ) : <Empty icon={<Link2 size={18} />} title="Belum ada tautan" text="Hubungkan catatan, tujuan, atau record lain yang berkaitan." />}
          </Section>

          {(isHub || money.length > 0) && (
            <Section title="Uang" count={money.length} action={<Link to={`/finance/new/transaction?record=${record.id}`}>+ Catat</Link>}>
              {money.length ? (
                <div className="o-list">{money.slice(0, 15).map((t) => (
                  <Row key={t.id} to="/finance" icon={<KindIcon kind="budgets" />} title={t.description || t.category}
                    meta={<>{fmtDay(t.date)} · {t.category}{t.recordId && t.recordId !== record.id && index.get(t.recordId) && <Chip record={index.get(t.recordId)} />}</>}
                    trailing={<span className={cx("o-trailing", t.kind === "income" ? "pos" : "neg")}>{t.kind === "income" ? "+" : "−"}{rupiah(t.amount)}</span>} />
                ))}</div>
              ) : <Empty icon={<Wallet size={18} />} title="Belum ada transaksi" text="Catat pemasukan atau biaya untuk melihat untung-rugi di sini." />}
            </Section>
          )}

          {files.length > 0 && (
            <Section title="Lampiran" count={files.length}>
              <div className="o-list">{files.map((f) => (
                <Row key={f.id} onClick={() => store.downloadFile(f, true)} icon={<span className="o-kind-icon" style={{ "--tint": "var(--muted)" } as React.CSSProperties}><Paperclip size={15} /></span>}
                  title={f.name} meta={`${Math.ceil(f.size / 1024)} KB`} />
              ))}</div>
            </Section>
          )}
        </div>
      </div>

      <LinkPicker open={picking} onOpenChange={setPicking} exclude={linkedIds}
        onPick={(target) => run(() => store.addLink(record.id, target.id, "related"))} />
    </>
  );
}

function Checklist({ record, save }: { record: RecordItem; save: (r: any) => Promise<RecordItem> }) {
  const items = checklistItems(record.data.checklist);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const update = async (next: typeof items) => {
    setBusy(true);
    try { await save({ ...record, data: { ...record.data, checklist: next } }); } finally { setBusy(false); }
  };
  const done = items.filter((i) => i.checked).length;
  return (
    <Section title="Checklist" count={items.length ? done : undefined} action={items.length ? <span className="o-row-meta">{done}/{items.length}</span> : undefined}>
      <div className="o-list">
        {items.map((i) => (
          <Row key={i.id} strike={i.checked} title={i.text}
            leading={<Check checked={i.checked} busy={busy} label={i.text} onChange={() => update(items.map((x) => (x.id === i.id ? { ...x, checked: !x.checked } : x)))} />}
            trailing={<button className="o-icon-btn" aria-label={`Hapus ${i.text}`} disabled={busy} onClick={() => update(items.filter((x) => x.id !== i.id))}><X size={15} /></button>} />
        ))}
        <form className="o-capture" style={{ margin: 0, border: 0, borderRadius: 0, borderTop: items.length ? "1px solid var(--line)" : 0 }}
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) { update([...items, { id: crypto.randomUUID(), text: text.trim(), checked: false }]); setText(""); } }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tambah langkah…" aria-label="Item checklist baru" disabled={busy} />
          <button className="o-btn small" disabled={!text.trim() || busy}><Plus size={15} /></button>
        </form>
      </div>
    </Section>
  );
}

function HabitHistory({ habit, entries }: { habit: RecordItem; entries: RecordItem[] }) {
  const today = todayKey();
  return (
    <Section title="Hari ini">
      <div className="o-habits" style={{ gridTemplateColumns: "1fr" }}><HabitCard habit={habit} entries={entries} day={today} /></div>
    </Section>
  );
}
