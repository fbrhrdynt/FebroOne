import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  Check,
  Sun,
  CalendarDays,
  FileText,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Inbox,
} from "lucide-react";
import { localDay, occurrences, checklistItems } from "../../../packages/shared/domain";
import * as store from "./store";
import { Button, PageHeader, Empty, Modal, Field, ErrorText } from "./ui";
import RecordForm from "./RecordForm";
import { rp, total, monthlyCashflow } from "./money";
import { ActivityCard, ChartCard, CompletionRing, QuickAction, StatusDot } from "./Bento";
import FocusTimer from "./FocusTimer";
export default function Home() {
  const q = useQueryClient();
  const data = useQuery({
    queryKey: ["records"],
    queryFn: () => store.records(),
  });
  const fin = useQuery({ queryKey: ["finance"], queryFn: store.finance });
  const profile = useQuery({ queryKey: ["identity"], queryFn: store.identity });
  const [kind, setKind] = useState("");
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<unknown>();
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const cms = useQuery({queryKey:["cms","overview"],queryFn:()=>store.api("/cms/overview"),enabled:!store.trial,retry:false,refetchInterval:60000});
  const rs = data.data || [];
  const prefs = profile.data?.user.preferences || {};
  const extraWidgets = ["reminders", "projects", "habits", "documents", "goals"];
  const widgets = prefs.widgets || [
    "tasks",
    "agenda",
    "finance",
    "career",
    "notes",
  ];
  const visibleWidgets = [...widgets, ...extraWidgets];
  const today = localDay();
  const tasks = rs.filter(
    (r) =>
      r.kind === "tasks" && !["Completed", "Cancelled"].includes(r.data.status),
  );
  const allTasks = rs.filter(r => r.kind === "tasks" && r.data.status !== "Cancelled");
  const completed = allTasks.filter(r => r.data.status === "Completed").length;
  const month = today.slice(0, 7);
  const cashflow = monthlyCashflow(fin.data?.transactions || [], month);
  const recentTx = (fin.data?.transactions || []).filter((t: any) => !t.reversed && !["opening", "reversal"].includes(t.kind)).sort((a: any,b: any) => b.date.localeCompare(a.date)).slice(0, 4);
  const money = (value: any) => fin.isPending ? "Memuat…" : fin.isError ? "Tidak tersedia" : prefs.maskMoney ? "••••••" : rp(value);
  const overdue = tasks.filter(
    (r) => r.data.due && new Date(r.data.due) < new Date(),
  );
  const events = rs
    .filter((r) => r.kind === "events")
    .flatMap((r) =>
      occurrences(
        r,
        new Date(today + "T00:00:00+07:00"),
        new Date(today + "T23:59:59+07:00"),
      ),
    )
    .sort((a, b) => a.data.start.localeCompare(b.data.start));
  const certs = rs.filter(
    (r) =>
      r.kind === "certificates" &&
      r.data.expiry &&
      new Date(r.data.expiry).getTime() - Date.now() < 30 * 86400000,
  );
  const notes = rs.filter((r) => r.kind === "notes").slice(0, 4);
  const greeting =
    new Date().getHours() < 11
      ? "Selamat pagi"
      : new Date().getHours() < 15
        ? "Selamat siang"
        : new Date().getHours() < 18
          ? "Selamat sore"
          : "Selamat malam";
  if (data.isError && !data.data) return <><PageHeader title="Workspace belum dapat dimuat"/><ErrorText error={data.error}/><Button onClick={()=>data.refetch()}>Coba lagi</Button></>;
  if (data.isPending) return <><PageHeader title="Hari Anda, dalam satu tempat." description="Memuat workspace…"/><div className="dashboard-loading skeleton" role="status" aria-label="Memuat dashboard"/></>;
  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        title={greeting + ", " + (profile.data?.user.name?.split(" ")[0] || "Anda") + "."}
        description="Satu tempat untuk hari Anda."
      >
        <Button
          variant="outline"
          onClick={() => setCustom(true)}
          aria-label="Atur widget"
        >
          <SlidersHorizontal size={17} />
          <span className="desktop-only">Atur tampilan</span>
        </Button>
      </PageHeader>
      <ErrorText error={error || data.error || fin.error} />
      {data.isLoading && <div className="skeleton" role="status" aria-label="Memuat dashboard" />}
      <section className="day-intro">
        <div>
          <div className="eyebrow">
            <Sun size={16} /> MY DAY
          </div>
          <h2>Apa fokus Anda hari ini?</h2>
          <p>
            {tasks.length
              ? `${tasks.length} tugas terbuka${overdue.length ? `, ${overdue.length} melewati tenggat` : ""}. Ambil satu langkah berikutnya.`
              : "Mulai dengan satu tugas, ide, atau rencana kecil."}
          </p>
        </div>
        <Button onClick={() => setKind("tasks")}>
          <Plus size={17} /> Tambah tugas
        </Button>
      </section>
      <div className="quick-capture">
        <QuickAction icon={<FileText size={18}/>} onClick={() => setKind("notes")}>Tangkap ide</QuickAction>
        <QuickAction icon={<CalendarDays size={18}/>} onClick={() => setKind("events")}>Buat agenda</QuickAction>
        <QuickAction icon={<Check size={18}/>} onClick={() => setKind("habits")}>Bangun kebiasaan</QuickAction>
      </div>

      <div className="dashboard-grid home-bento" aria-label="Asisten AI dan CMS">
        <section className="panel">
          <div className="section-heading"><h2><Sparkles size={19}/> Tanya AI</h2><Link to="/insights">Buka AI <ArrowRight size={15}/></Link></div>
          <p className="hint">Secara default hanya pertanyaan yang dikirim. Aktifkan izin tambahan untuk menyertakan daftar tugas belum selesai.</p>
          <form className="form-stack" onSubmit={async e=>{
            e.preventDefault();
            if(!aiConsent||!aiPrompt.trim()||aiBusy)return;
            setAiBusy(true);setAiError("");setAiAnswer("");
            try{const result=await store.api("/ai","POST",{prompt:aiPrompt.trim(),consent:true,includeTasks});setAiAnswer(String(result.text||"Tidak ada respons."));}
            catch(err){setAiError(err instanceof Error?err.message:"Gagal menghubungi AI.");}
            finally{setAiBusy(false);}
          }}>
            <textarea aria-label="Pertanyaan untuk AI" rows={3} maxLength={12000} value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Apa yang ingin Anda tanyakan?" style={{width:"100%",resize:"vertical"}}/>
            <label className="hint"><input type="checkbox" checked={includeTasks} onChange={e=>setIncludeTasks(e.target.checked)}/> Sertakan daftar tugas belum selesai dari Febro One dalam pertanyaan ini</label>
            <label className="hint"><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/> Saya setuju pertanyaan dikirim ke provider AI</label>
            <Button type="submit" disabled={!aiConsent||!aiPrompt.trim()||aiBusy}>{aiBusy?"Mengirim…":"Tanya AI"}</Button>
          </form>
          {aiError&&<p role="alert" style={{color:"#b42318"}}>{aiError}</p>}
          {aiAnswer&&<div className="panel" role="status" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{aiAnswer}</div>}
        </section>
        <section className="panel">
          <div className="section-heading"><h2><Inbox size={19}/> CMS febro.id</h2><Link to="/cms">Buka CMS <ArrowRight size={15}/></Link></div>
          <p className="hint">Permintaan akses dokumen, CV, dan pesan kontak.</p>
          {cms.isSuccess?<div className="stat-grid"><div className="stat"><span>Menunggu persetujuan</span><strong>{cms.data?.totals?.pending??0}</strong></div><div className="stat"><span>Pesan belum dibaca</span><strong>{cms.data?.totals?.unread??0}</strong></div></div>:<p className="hint">{cms.isPending?"Memuat ringkasan CMS…":"Ringkasan CMS belum tersedia."}</p>}
          <Link className="text-button" to="/cms?status=pending">Lihat permintaan menunggu <ArrowRight size={15}/></Link>
        </section>
      </div>
      <div className="dashboard-grid home-bento" aria-busy={data.isPending}>
        <ActivityCard title="Setiap langkah berarti" to="/records/tasks" className="completion-card">
          <div className="completion-content"><CompletionRing value={allTasks.length ? completed / allTasks.length * 100 : 0} label="Tugas selesai"/><div><strong className="completion-total">{data.isPending ? "…" : completed}<span> / {data.isPending ? "…" : allTasks.length}</span></strong><p>tugas selesai</p><small>{allTasks.length ? `${tasks.length} tugas menunggu langkah Anda` : "Tambahkan tugas untuk mulai melacak progres."}</small></div></div>
          <Link className="text-button" to="/records/tasks">Lihat semua tugas <ArrowRight size={15}/></Link>
        </ActivityCard>
        <FocusTimer/>
        <ActivityCard title="Akses cepat" className="capture-card"><QuickAction icon={<Plus size={18}/>} onClick={()=>setKind("tasks")}>Tugas baru</QuickAction><QuickAction icon={<FileText size={18}/>} onClick={()=>setKind("notes")}>Catatan baru</QuickAction><QuickAction icon={<CalendarDays size={18}/>} onClick={()=>setKind("reminders")}>Pengingat baru</QuickAction></ActivityCard>
        {widgets.includes("tasks") && (
          <section className="panel dashboard-tasks">
            <div className="section-heading">
              <h2>Langkah berikutnya</h2>
              <Link to="/records/tasks">
                Semua <ArrowUpRight size={15} />
              </Link>
            </div>
            {tasks.length ? (
              tasks.slice(0, 6).map((t) => (
                <div className="task-line" key={t.id}>
                  <button
                    className="check-button"
                    aria-label={"Selesaikan " + t.title}
                    onClick={async () => {
                      try {
                        await store.saveRecord({
                          ...t,
                          data: {
                            ...t.data,
                            status: "Completed",
                            progress: 100,
                            ...(checklistItems(t.data.checklist).length ? { checklist: checklistItems(t.data.checklist).map(item => ({...item, checked: true})) } : {}),
                          },
                        });
                        await q.invalidateQueries();
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  />
                  <Link to="/records/tasks">
                    <strong>{t.title}</strong>
                    <small>
                      {t.data.due
                        ? new Date(t.data.due).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })
                        : "Tanpa tenggat"}{" "}
                      · {t.data.priority || "Medium"}
                    </small>
                  </Link>
                  <div className="task-progress"><span className="badge"><StatusDot status={t.data.status || "To Do"}/>{t.data.status || "To Do"}</span>{checklistItems(t.data.checklist).length > 0 && <><progress max={checklistItems(t.data.checklist).length} value={checklistItems(t.data.checklist).filter(i=>i.checked).length} aria-label={"Checklist " + t.title}/><small>{checklistItems(t.data.checklist).filter(i=>i.checked).length}/{checklistItems(t.data.checklist).length} langkah</small></>}</div>
                </div>
              ))
            ) : (
              <Empty
                title="Ruang untuk hal baru"
                text="Tugas yang Anda buat akan muncul di sini."
                onAdd={() => setKind("tasks")}
              />
            )}
          </section>
        )}
        {widgets.includes("agenda") && (
          <section className="panel">
            <div className="section-heading">
              <h2>Agenda hari ini</h2>
              <Link to="/calendar" aria-label="Buka agenda hari ini">
                <ArrowUpRight size={17} />
              </Link>
            </div>
            {events.length ? (
              events.map((e) => (
                <Link
                  to="/calendar"
                  className="agenda-row"
                  key={e.id + e.occurrence}
                >
                  <time>
                    {e.data.allDay
                      ? "All day"
                      : new Date(e.data.start).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </time>
                  <div>
                    <strong>{e.title}</strong>
                    <p>{e.data.location || e.data.calendar || "Personal"}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="quiet-empty">
                <CalendarDays size={26} />
                <h3>Hari yang masih lapang</h3>
                <p>Belum ada agenda hari ini.</p>
                <button
                  className="text-button"
                  onClick={() => setKind("events")}
                >
                  Tambah event →
                </button>
              </div>
            )}
          </section>
        )}
        {widgets.includes("finance") && (
          <section className="panel">
            <div className="section-heading">
              <h2>Keuangan sekilas</h2>
              <Link to="/finance" aria-label="Buka keuangan">
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <span className="muted">Total saldo rekening</span>
            <strong className="balance">
              {money(total(fin.data?.accounts || [], "balance"))}
            </strong>
            <p>
              {fin.data?.accounts.length || 0} akun ·{" "}
              {(fin.data?.debts || []).length} utang / piutang
            </p>
            <Link className="text-button" to="/finance">
              Lihat transaksi <ArrowRight size={15} />
            </Link>
          </section>
        )}
        {widgets.includes("career") && (
          <section className="panel">
            <div className="section-heading">
              <h2>Karier & belajar</h2>
              <Link to="/records/trainings" aria-label="Buka karier dan belajar">
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="mini-stats">
              <div>
                <strong>
                  {rs
                    .filter(
                      (r) =>
                        r.kind === "trainings" && r.data.status === "Completed",
                    )
                    .reduce((a, r) => a + Number(r.data.hours || 0), 0)}
                </strong>
                <span>jam belajar</span>
              </div>
              <div>
                <strong>{rs.filter((r) => r.kind === "work").length}</strong>
                <span>catatan kerja</span>
              </div>
            </div>
            {certs.length ? (
              <Link className="notice" to="/records/certificates">
                {certs.length} sertifikat perlu diperiksa masa berlakunya →
              </Link>
            ) : (
              <p>Masa berlaku sertifikat akan dipantau di sini.</p>
            )}
          </section>
        )}
        {widgets.includes("finance") && <>
          <ChartCard title="Arus kas bulan ini" description={new Date(today+"T12:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"})}>
            <div className="cashflow-bars">{[{label:"Pemasukan",value:cashflow.income,tone:"income"},{label:"Pengeluaran",value:cashflow.expense,tone:"expense"}].map(item=><div key={item.label}><div className="cashflow-label"><span>{item.label}</span><strong>{money(item.value)}</strong></div><div className={"cashflow-track "+item.tone} aria-hidden="true"><span style={{width:prefs.maskMoney?"0%":Math.max(0,Math.min(100,item.value.div(cashflow.income.plus(cashflow.expense).isZero()?1:cashflow.income.plus(cashflow.expense)).mul(100).toNumber()))+"%"}}/></div></div>)}</div><p className="hint">Transfer dan pokok cicilan dikecualikan.</p>
          </ChartCard>
          <ActivityCard title="Transaksi terbaru" to="/finance" className="transactions-card">{fin.isPending?<p role="status">Memuat transaksi…</p>:recentTx.length?recentTx.map((t:any)=><Link className="transaction-preview" key={t.id} to="/finance"><span className={"transaction-icon "+(t.kind==="income"?"income":"expense")}><ArrowUpRight size={17}/></span><div><strong>{t.description || t.category || t.kind}</strong><small>{new Date(t.date+"T12:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short"})} · {t.category || t.kind}</small></div><b>{money(t.amount)}</b></Link>):<div className="quiet-empty"><p>{fin.isError?"Transaksi belum dapat dimuat.":"Belum ada transaksi tersimpan."}</p><Link className="text-button" to="/finance?quick=expense">Catat transaksi →</Link></div>}</ActivityCard>
        </>}
        {widgets.includes("notes") && (
          <section className="panel span-2 notes-panel">
            <div className="section-heading">
              <h2>Catatan terbaru</h2>
              <Link to="/records/notes">
                Buka notes <ArrowUpRight size={15} />
              </Link>
            </div>
            {notes.length ? (
              <div className="notes-preview">
                {notes.map((n) => (
                  <Link key={n.id} to="/records/notes">
                    <FileText size={18} />
                    <strong>{n.title}</strong>
                    <small>{n.data.folder || "Notes"}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <button className="add-note" onClick={() => setKind("notes")}>
                <Plus size={18} /> Simpan ide pertama Anda
              </button>
            )}
          </section>
        )}
        {extraWidgets.filter(w => visibleWidgets.includes(w)).map(widget => {
          const titles: Record<string, string> = {reminders: "Pengingat berikutnya", projects: "Proyek aktif", habits: "Kebiasaan hari ini", documents: "Dokumen", goals: "Tujuan pribadi"};
          const items = rs.filter(r => r.kind === widget && (widget !== "reminders" || !r.data.done) && (!["projects", "goals"].includes(widget) || !["Completed", "Cancelled"].includes(r.data.status)))
            .sort((a, b) => widget === "reminders" ? String(a.data.due).localeCompare(String(b.data.due)) : b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
          return <section className={"panel dashboard-summary summary-"+widget} key={widget}>
            <div className="section-heading"><h2>{titles[widget]}</h2><Link to={"/records/" + widget} aria-label={"Buka " + titles[widget]}><ArrowUpRight size={17}/></Link></div>
            {items.length ? items.map(r => {
              const checkedToday = widget === "habits" && rs.some(entry => entry.kind === "habitEntries" && entry.data.habitId === r.id && entry.data.date === today);
              const relatedTasks = widget === "projects" ? rs.filter(t => t.kind === "tasks" && t.data.projectId === r.id) : [];
              const progress = widget === "goals" ? Math.min(100, Math.max(0, Number(r.data.progress || 0))) : relatedTasks.length ? Math.round(relatedTasks.filter(t => t.data.status === "Completed").length / relatedTasks.length * 100) : undefined;
              return <div key={r.id} className="bento-progress-row">
                <Link className="bento-record-link" to={"/records/" + widget}><strong>{r.title}</strong><small>{widget === "habits" ? checkedToday ? "Sudah check-in" : "Belum check-in" : widget === "reminders" ? new Date(r.data.due).toLocaleString("id-ID", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : widget === "documents" ? r.data.expiry ? "Berlaku hingga " + new Date(r.data.expiry).toLocaleDateString("id-ID") : r.data.folder || "Dokumen tersimpan" : progress !== undefined ? progress + "% selesai" : r.data.status || "Belum ada tugas terkait"}</small></Link>
                {progress !== undefined && <progress max={100} value={progress} aria-label={"Progres " + r.title}/>}
                {widget === "habits" && <Button variant="outline" disabled={checkedToday} onClick={async () => {try { await store.saveRecord({kind:"habitEntries", title:r.title, tags:[], data:{habitId:r.id,date:today,value:1}}); await q.invalidateQueries({queryKey:["records"]}); } catch(e) {setError(e);} }}><Check size={15}/>{checkedToday ? "Tercatat" : "Check-in"}</Button>}
              </div>;
            }) : <Empty title={widget === "reminders" ? "Tidak ada pengingat aktif" : "Belum ada " + titles[widget].toLowerCase()} onAdd={() => setKind(widget)} />}
          </section>;
        })}
      </div>
      <div className="section-heading">
        <h2>Aktivitas terbaru</h2>
        <Link to="/insights">Review →</Link>
      </div>
      <div className="activity-list">
        {rs.slice(0, 5).map((r) => (
          <Link key={r.id} to={"/records/" + r.kind}>
            <span className="activity-dot" />
            <strong>{r.title}</strong>
            <time>
              {new Date(r.updatedAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </time>
          </Link>
        ))}
        {!rs.length && (
          <p className="hint">
            Aktivitas tersimpan akan tampil setelah Anda mulai menggunakan
            workspace.
          </p>
        )}
      </div>
      {kind && <RecordForm kind={kind} onClose={() => setKind("")} />}
      <Modal open={custom} onOpenChange={setCustom} title="Atur dashboard">
        <div className="form-stack">
          {["tasks", "agenda", "finance", "career", "notes"].map((w) => (
            <Field key={w} label={w}>
              <input
                type="checkbox"
                checked={widgets.includes(w)}
                onChange={async (e) => {
                  const next = e.target.checked
                    ? [...widgets, w]
                    : widgets.filter((x: string) => x !== w);
                  await store.preferences({
                    name: profile.data?.user.name || "Workspace saya",
                    timezone: prefs.timezone || "Asia/Jakarta",
                    theme: prefs.theme || "light",
                    maskMoney: !!prefs.maskMoney,
                    widgets: next,
                  });
                  await q.invalidateQueries({ queryKey: ["identity"] });
                }}
              />
            </Field>
          ))}
        </div>
      </Modal>
    </>
  );
}
