import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, X } from "lucide-react";
import type { RecordItem } from "../../../../packages/shared/catalog";
import * as store from "../store";
import { Sheet, KindIcon, Chip, ErrorNote, cx } from "./ui";
import { LinkPicker } from "./LinkPicker";
import { useMutate, todayKey, recordHref, atLocal, tz } from "./data";
import { kindMeta, areaColor } from "./kinds";

export type QuickPreset = { kind?: string; link?: RecordItem | null; due?: string };
const types = ["tasks", "events", "notes", "projects", "goals", "money"] as const;
type QuickType = (typeof types)[number];
const label = (t: QuickType) => (t === "money" ? "Transaksi" : kindMeta(t).label);
const placeholder: Record<QuickType, string> = {
  tasks: "Apa yang perlu dikerjakan?", events: "Nama agenda", notes: "Judul catatan",
  projects: "Nama proyek", goals: "Apa yang ingin dicapai?", money: "",
};

const pad = (n: number) => String(n).padStart(2, "0");
function nextHour() {
  const h = Number(new Date(Date.now() + 3600000).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz() })) % 24;
  return `${pad(h)}:00`;
}

export function QuickAdd({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (v: boolean) => void; preset?: QuickPreset }) {
  const navigate = useNavigate();
  const { save } = useMutate();
  const [type, setType] = useState<QuickType>("tasks");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState("");
  const [link, setLink] = useState<RecordItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    if (!open) return;
    setType((preset?.kind as QuickType) && types.includes(preset!.kind as QuickType) ? (preset!.kind as QuickType) : "tasks");
    setLink(preset?.link ?? null);
    setDate(preset?.due ?? todayKey());
    setTime("");
    setTitle("");
    setError(undefined);
  }, [open, preset]);

  useEffect(() => { if (type === "events" && !time) setTime(nextHour()); }, [type, time]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "money") {
      onOpenChange(false);
      navigate(`/finance/new/transaction${link ? `?record=${link.id}` : ""}`);
      return;
    }
    if (!title.trim() || busy) return;
    setBusy(true); setError(undefined);
    try {
      const data: Record<string, unknown> = {};
      if (link?.kind === "projects") { data.projectId = link.id; if (link.data.companyId) data.companyId = link.data.companyId; }
      if (link?.kind === "companies") data.companyId = link.id;
      if (type === "tasks") Object.assign(data, { status: "To Do", priority: "Medium", ...(date ? { due: atLocal(`${date}T${time || "17:00"}`) } : {}) });
      if (type === "events") {
        const [h, m] = (time || "09:00").split(":").map(Number);
        Object.assign(data, { start: atLocal(`${date}T${time || "09:00"}`), end: atLocal(`${date}T${pad(Math.min(23, h + 1))}:${pad(m)}`), category: link ? "Work" : "Personal" });
      }
      if (type === "notes") Object.assign(data, { kind: "Note", content: "" });
      if (type === "projects") Object.assign(data, { status: "In Progress", startDate: date });
      if (type === "goals") Object.assign(data, { status: "In Progress", progress: 0 });
      if (type === "projects") delete data.projectId;
      const saved = await save({ kind: type, title: title.trim(), tags: [], data });
      // Links outside the company/project columns (goal, trip, note…) go through entity links.
      if (link && !["projects", "companies"].includes(link.kind)) await store.addLink(saved.id, link.id, "related");
      onOpenChange(false);
      if (type === "notes" || type === "projects" || type === "goals") navigate(recordHref(saved));
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title="Tambah cepat">
        <form className="o-form" onSubmit={submit}>
          <div className="o-type-grid" role="group" aria-label="Jenis">
            {types.map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                style={{ "--tint": t === "money" ? "var(--c-money)" : areaColor(t) } as React.CSSProperties}>
                <KindIcon kind={t === "money" ? "budgets" : t} size={18} />
                {label(t)}
              </button>
            ))}
          </div>
          {type !== "money" && (
            <input className="o-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholder[type]} aria-label="Judul" maxLength={240} />
          )}
          {(type === "tasks" || type === "events") && (
            <div className="o-form-row">
              <label className="o-field"><span>{type === "tasks" ? "Tenggat" : "Tanggal"}</span>
                <input className="o-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="o-field"><span>Jam</span>
                <input className="o-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
            </div>
          )}
          <div className="o-field">
            <span>{type === "money" ? "Untuk (opsional)" : "Terhubung dengan"}</span>
            <div className="o-link-slot">
              {link ? (
                <>
                  <Chip tone={areaColor(link.kind)}><KindIcon kind={link.kind} size={12} boxed={false} /> {link.title}</Chip>
                  <button type="button" className="o-icon-btn" aria-label="Lepas tautan" onClick={() => setLink(null)}><X size={16} /></button>
                </>
              ) : (
                <button type="button" className="o-btn small" onClick={() => setPicking(true)}><Link2 size={15} /> Proyek, perusahaan, tujuan…</button>
              )}
            </div>
          </div>
          <ErrorNote error={error} />
          <button className={cx("o-btn primary block")} disabled={busy || (type !== "money" && !title.trim())}>
            {type === "money" ? "Lanjut ke form transaksi" : busy ? "Menyimpan…" : `Simpan ${label(type).toLowerCase()}`}
          </button>
        </form>
      </Sheet>
      <LinkPicker open={picking} onOpenChange={setPicking} onPick={setLink}
        only={type === "projects" ? ["companies", "goals"] : ["projects", "companies", "goals", "travel"]} />
    </>
  );
}
