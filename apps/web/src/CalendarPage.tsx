import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import { occurrences, localDay } from "../../../packages/shared/domain";
import type { RecordItem } from "../../../packages/shared/catalog";
import * as store from "./store";
import RecordForm from "./RecordForm";
import { Button, PageHeader, Empty, ErrorText } from "./ui";
const dayNames = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export default function CalendarPage() {
  const q = useQueryClient();
  const result = useQuery({
    queryKey: ["records", "events"],
    queryFn: () => store.records("events"),
  });
  const linked = useQuery({queryKey:["records","calendar-linked"],queryFn:async()=>(await Promise.all([store.records("tasks"),store.records("reminders")])).flat()});
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(() => matchMedia("(max-width: 800px)").matches ? "agenda" : "month");
  const [calendar, setCalendar] = useState("all");
  const [editing, setEditing] = useState<RecordItem>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>();
  const [ics, setIcs] = useState<any[] | null>(null);
  const year = date.getFullYear(),
    month = date.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const monthDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          return d;
        })
      : view === "day"
        ? [date]
        : monthDays;
  const eventOccurrences = (result.data || [])
    .filter(
      (r) => calendar === "all" || (r.data.calendar || "Personal") === calendar,
    )
    .flatMap((r) =>
      occurrences(r, new Date(year - 1, 11, 1), new Date(year + 1, 1, 1)),
    );
  const expanded: (RecordItem & {occurrence?: string})[] = [...eventOccurrences, ...(linked.data || []).filter(r=>r.kind==="tasks" ? r.data.status!=="Completed" && r.data.due : !r.data.done && r.data.due).map(r=>({...r,data:{...r.data,start:r.data.due,end:r.data.due,allDay:!String(r.data.due).includes("T"),calendar:r.kind==="tasks"?"Tasks":"Reminders"},occurrence:"linked"})).filter(r=>calendar==="all"||r.data.calendar===calendar)];
  function editItem(r: RecordItem) {
    setEditing((r.kind === "events" ? result.data : linked.data)?.find(x=>x.id===r.id));
    setOpen(true);
  }
  function events(d: Date) {
    return expanded.filter(
      (r) =>
        dayKey(new Date(r.data.start)) <= dayKey(d) &&
        dayKey(new Date(r.data.end)) >= dayKey(d),
    );
  }
  function move(n: number) {
    const d = new Date(date);
    if (view === "year") d.setFullYear(year + n);
    else if (view === "month" || view === "agenda") d.setMonth(month + n, 1);
    else d.setDate(d.getDate() + n * (view === "week" ? 7 : 1));
    setDate(d);
  }
  async function exportICS() {
    const ICAL = (await import("ical.js")).default;
    const cal = new ICAL.Component(["vcalendar", [], []]);
    cal.updatePropertyWithValue("version", "2.0");
    cal.updatePropertyWithValue("prodid", "-//Febro One//Calendar//ID");
    for (const r of result.data || []) {
      const ev = new ICAL.Component("vevent");
      ev.updatePropertyWithValue("uid", r.id + "@febro-one");
      ev.updatePropertyWithValue("summary", r.title);
      ev.updatePropertyWithValue("description", r.data.description || "");
      ev.updatePropertyWithValue(
        "dtstart",
        ICAL.Time.fromJSDate(new Date(r.data.start), true),
      );
      ev.updatePropertyWithValue(
        "dtend",
        ICAL.Time.fromJSDate(new Date(r.data.end), true),
      );
      if (r.data.recurrence && r.data.recurrence !== "None") {
        let rr = "FREQ=" + r.data.recurrence.toUpperCase();
        if (r.data.until)
          rr += ";UNTIL=" + r.data.until.replaceAll("-", "") + "T235959Z";
        ev.updatePropertyWithValue("rrule", ICAL.Recur.fromString(rr));
      }
      for (const ex of String(r.data.exceptions || "")
        .split(",")
        .filter(Boolean)) {
        const d = new Date(ex + "T" + r.data.start.slice(11, 19));
        ev.addPropertyWithValue("exdate", ICAL.Time.fromJSDate(d, true));
      }
      cal.addSubcomponent(ev);
    }
    store.download("febro-one-calendar.ics", cal.toString(), "text/calendar");
  }
  async function importICS(file: File) {
    try {
      if (file.size > 1048576) throw new Error("ICS maksimal 1 MB");
      const ICAL = (await import("ical.js")).default;
      const cal = new ICAL.Component(ICAL.parse(await file.text()));
      const rows = cal.getAllSubcomponents("vevent").map((c: any) => {
        const ev = new ICAL.Event(c);
        const rule = c.getFirstPropertyValue("rrule");
        if (
          rule &&
          (rule.interval !== 1 ||
            rule.count ||
            Object.keys(rule.parts || {}).length)
        )
          throw new Error(
            "ICS dengan INTERVAL/COUNT/BYDAY belum didukung; impor ditolak agar tidak mengubah jadwal.",
          );
        return {
          kind: "events",
          title: ev.summary || "Untitled event",
          tags: ["ics-import"],
          data: {
            start: ev.startDate.toJSDate().toISOString(),
            end: ev.endDate.toJSDate().toISOString(),
            description: ev.description || "",
            calendar: "Imported",
            recurrence: rule
              ? rule.freq[0] + rule.freq.slice(1).toLowerCase()
              : "None",
            ...(rule?.until
              ? { until: rule.until.toJSDate().toISOString().slice(0, 10) }
              : {}),
          },
        };
      });
      if (rows.length > 500) throw new Error("Maksimal 500 event");
      setIcs(rows);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Produktivitas"
        title="Calendar"
        description="Buat ruang untuk hal yang berarti."
      >
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus size={17} />
          Event
        </Button>
      </PageHeader>
      <div className="calendar-toolbar">
        <div className="row-actions">
          <Button
            variant="ghost"
            aria-label="Sebelumnya"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={19} />
          </Button>
          <h2>
            {view === "year"
              ? year
              : date.toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                  ...(view === "day" ? { day: "numeric" } : {}),
                })}
          </h2>
          <Button
            variant="ghost"
            aria-label="Berikutnya"
            onClick={() => move(1)}
          >
            <ChevronRight size={19} />
          </Button>
          <Button variant="outline" onClick={() => setDate(new Date())}>
            Hari ini
          </Button>
        </div>
        <div className="tabs">
          {["day", "week", "month", "year", "agenda"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={view === v ? "active" : ""}
            >
              {
                (
                  {
                    day: "Hari",
                    week: "Minggu",
                    month: "Bulan",
                    year: "Tahun",
                    agenda: "Agenda",
                  } as any
                )[v]
              }
            </button>
          ))}
        </div>
      </div>
      <div className="list-toolbar">
        <select
          aria-label="Kalender"
          value={calendar}
          onChange={(e) => setCalendar(e.target.value)}
        >
          <option value="all">Semua kalender</option>
          {[
            ...new Set([...(result.data?.map((r) => r.data.calendar || "Personal") || []), "Tasks", "Reminders"]),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button variant="ghost" onClick={() => exportICS().catch(setError)}>
          <Download size={16} />
          Export ICS
        </Button>
        <label className="button ghost">
          <Upload size={16} />
          Import ICS
          <input
            className="sr-only"
            type="file"
            accept=".ics"
            onChange={(e) =>
              e.target.files?.[0] && importICS(e.target.files[0])
            }
          />
        </label>
      </div>
      <ErrorText error={error || result.error || linked.error} />
      {ics && (
        <div className="notice">
          Preview: {ics.length} event.{" "}
          {ics
            .slice(0, 3)
            .map((r) => r.title)
            .join(", ")}
          .{" "}
          <Button
            onClick={async () => {
              try {
                for (const r of ics) {
                  if (
                    !result.data?.some(
                      (x) =>
                        x.title === r.title && x.data.start === r.data.start,
                    )
                  )
                    await store.saveRecord(r);
                }
                setIcs(null);
                await q.invalidateQueries();
              } catch (e) {
                setError(e);
              }
            }}
          >
            Konfirmasi impor
          </Button>
          <Button variant="ghost" onClick={() => setIcs(null)}>
            Batal
          </Button>
        </div>
      )}
      {view === "year" ? (
        <div className="year-grid">
          {Array.from({ length: 12 }, (_, m) => (
            <button
              key={m}
              className="mini-month"
              onClick={() => {
                setDate(new Date(year, m, 1));
                setView("month");
              }}
            >
              <h3>
                {new Date(year, m, 1).toLocaleDateString("id-ID", {
                  month: "long",
                })}
              </h3>
              <p>
                {
                  expanded.filter(
                    (r) =>
                      new Date(r.data.start).getMonth() === m &&
                      new Date(r.data.start).getFullYear() === year,
                  ).length
                }{" "}
                event
              </p>
              <div className="mini-days">
                {Array.from(
                  { length: new Date(year, m + 1, 0).getDate() },
                  (_, i) => (
                    <span
                      key={i}
                      className={
                        events(new Date(year, m, i + 1)).length
                          ? "has-event"
                          : ""
                      }
                    >
                      {i + 1}
                    </span>
                  ),
                )}
              </div>
            </button>
          ))}
        </div>
      ) : view === "agenda" ? (
        <div className="record-list calendar-agenda">
          {!expanded.some(r=>new Date(r.data.start).getMonth() === month && new Date(r.data.start).getFullYear() === year) && <Empty title="Ruang untuk rencana baru" text="Agenda, tugas, dan pengingat bulan ini tampil di sini." onAdd={()=>{setEditing(undefined);setOpen(true);}}/>}
          {expanded
            .filter(
              (r) =>
                new Date(r.data.start).getMonth() === month &&
                new Date(r.data.start).getFullYear() === year,
            )
            .sort((a, b) => a.data.start.localeCompare(b.data.start))
            .map((r) => (
              <button
                className={"agenda-row event-"+r.kind}
                key={r.id + r.occurrence}
                onClick={() => {
                  editItem(r);
                }}
              >
                <time>
                  {new Date(r.data.start).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
                <div>
                  <strong>{r.title}</strong>
                  <p>
                    {r.data.allDay
                      ? "Sepanjang hari"
                      : new Date(r.data.start).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                    · {r.data.calendar || "Personal"}
                  </p>
                </div>
              </button>
            ))}
        </div>
      ) : (
        <div
          className={"calendar-grid " + (view === "day" ? "single-day" : "")}
        >
          {view !== "day" &&
            dayNames.map((n) => (
              <div key={n} className="day-heading">
                {n}
              </div>
            ))}
          {days.map((d) => (
            <div
              className={
                "calendar-cell " +
                (d.getMonth() !== month ? "muted-day" : "") +
                (dayKey(d) === localDay() ? " today" : "") +
                (dayKey(d) === dayKey(date) ? " selected" : "")
              }
              key={d.toISOString()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const r = result.data?.find(
                  (r) => r.id === e.dataTransfer.getData("text/plain"),
                );
                if (!r) return;
                if (r.data.recurrence && r.data.recurrence !== "None") {
                  setError(
                    "Untuk event berulang, edit seri atau isi tanggal pengecualian.",
                  );
                  return;
                }
                const a = new Date(r.data.start),
                  b = new Date(r.data.end),
                  duration = b.getTime() - a.getTime();
                a.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                try {
                  await store.saveRecord({
                    ...r,
                    data: {
                      ...r.data,
                      start: a.toISOString(),
                      end: new Date(a.getTime() + duration).toISOString(),
                    },
                  });
                  await q.invalidateQueries();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <button className="day-number" aria-label={d.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} aria-current={dayKey(d) === localDay() ? "date" : undefined} aria-pressed={dayKey(d) === dayKey(date)} onClick={()=>setDate(d)}>{d.getDate()}</button>
              {events(d).map((r) => (
                <button
                  draggable={r.kind === "events"}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", r.id)
                  }
                  className={"calendar-event event-"+r.kind}
                  style={{ borderLeftColor: r.data.color || (r.kind === "tasks" ? "#3478F6" : r.kind === "reminders" ? "#BD792E" : r.data.calendar === "Work" ? "#8655B7" : "#278765") }}
                  key={r.id + r.occurrence}
                  onClick={() => {
                    editItem(r);
                  }}
                >
                  {!r.data.allDay && (
                    <small>
                      {new Date(r.data.start).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  )}
                  <span>{r.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {!expanded.length && (
        <p className="hint">
          Kalender masih kosong. Tambahkan event pertama melalui tombol Event.
        </p>
      )}
      {open && (
        <RecordForm
          kind={editing?.kind || "events"}
          initial={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
