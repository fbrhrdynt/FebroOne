import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Archive,
  Check,
  Pin,
  ExternalLink,
  Download,
  Timer,
  Play,
  Square,
} from "lucide-react";
import {
  catalog,
  statuses,
  type RecordItem,
} from "../../../packages/shared/catalog";
import { checklistItems, streak, localDay } from "../../../packages/shared/domain";
import * as store from "./store";
import DataTable from "./DataTable";
import RecordForm, { plainContent } from "./RecordForm";
import { Button, Empty, PageHeader, ErrorText, StatusBadge } from "./ui";
export default function RecordsPage() {
  const { kind = "tasks" } = useParams();
  const m = catalog[kind];
  const navigate=useNavigate();const [url,setUrl]=useSearchParams();
  const [trash,setTrash]=useState(url.get("trash")==="true");
  const q = useQueryClient();
  const [editing, setEditing] = useState<RecordItem | undefined>();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(url.get("search") || (""));
  const [view, setView] = useState(url.get("view") || (kind==="tasks"?"board":"list"));
  const [archived, setArchived] = useState(url.get("archived")==="true");
  const [filter, setFilter] = useState(url.get("filter") || ("all"));
  const [priority, setPriority] = useState(url.get("priority") || (""));
  const [page, setPage] = useState(Number(url.get("page"))||0);
  const [sort,setSort]=useState(url.get("sort") || ("updated"));
  const [referenceSearch,setReferenceSearch]=useState("");
  const [related,setRelated]=useState(url.get("related") || (""));
  const [error, setError] = useState<unknown>();
  const [undo, setUndo] = useState<string>();
  const [timer, setTimer] = useState<number | null>(
    Number(localStorage.getItem("focus-start")) || null,
  );
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setElapsed(timer ? Math.floor((Date.now() - timer) / 1000) : 0),
      1000,
    );
    return () => clearInterval(t);
  }, [timer]);
  const result = useQuery({
    queryKey: ["records", kind, archived, trash, search, filter, priority, related, sort, page, view],
    queryFn: async () => {
      if(store.trial) return {items:await store.records(kind,archived),total:0};
      const params=new URLSearchParams({kind,archived:String(archived),trash:String(trash),q:search,sort,limit:"30",offset:String(page*30)});
      if(view === "completed") params.set("status","Completed");
      else if(filter!=="all")params.set("status",filter);
      if(priority)params.set("priority",priority);
      if(related)params.set("related",related);
      return store.api("/records?"+params.toString()) as Promise<{items:RecordItem[];total:number;statusCounts?:{status:string;count:number}[];references?:RecordItem[]}>;
    },
  });
  const all = useQuery({
    queryKey: ["records", "references", kind,referenceSearch],
    queryFn: async () => (await Promise.all(["companies","categories","projects",...(kind==="habits"?["habitEntries"]:[])].map(async k=>store.trial||k==="habitEntries"?store.records(k):(await store.api("/records?limit=100&kind="+k+"&q="+encodeURIComponent(referenceSearch))).items))).flat(),
  });
  useEffect(()=>{setUrl({search,view,filter,priority,related,sort,page:String(page),archived:String(archived),trash:String(trash)},{replace:true});},[search,view,filter,priority,related,sort,page,archived,trash]);
  const referenceRows=[...(result.data && "references" in result.data?result.data.references||[]:[]),...(all.data||[])];
  if (!m) return <Empty title="Halaman tidak ditemukan" />;
  const serverPaged=!store.trial;
  let rows = (result.data?.items || []).filter(
    (r) => serverPaged ||
      (r.title + " " + r.tags.join(" ") + " " + Object.values(r.data).join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (view === "completed" ? r.data.status === "Completed" : (filter === "all" || r.data.status === filter || r.data.kind === filter)) && (!priority || r.data.priority === priority) && (!related || [r.data.companyId,r.data.categoryId,r.data.projectId].includes(related)),
  );
  if(!serverPaged) rows.sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned));
  if(sort==="title") rows.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort==="due") rows.sort((a,b)=>String(a.data.due||"9999").localeCompare(String(b.data.due||"9999")));
  const total=serverPaged ? result.data?.total||0 : rows.length;
  const visible = serverPaged ? rows : rows.slice(page * 30, (page + 1) * 30);
  const edit = (r?: RecordItem) => {
    navigate(`/records/${kind}/${r?r.id:"new"}`);
  };
  async function update(r: RecordItem, data: any) {
    try {
      await store.saveRecord({ ...r, data: { ...r.data, ...data } });
      await q.invalidateQueries();
    } catch (e) {
      setError(e);
    }
  }
  async function remove(r: RecordItem) {
    try {
      await store.archiveRecord(r);
      setUndo(r.id);
      await q.invalidateQueries();
    } catch (e) {
      setError(e);
    }
  }
  async function stopFocus() {
    if (!timer) return;
    await store.saveRecord({
      kind: "timesheets",
      title: "Focus session",
      tags: [],
      data: {
        date: localDay(),
        kind: "Focus",
        minutes: Math.max(1, Math.round((Date.now() - timer) / 60000)),
      },
    });
    setTimer(null);
    localStorage.removeItem("focus-start");
    await q.invalidateQueries();
  }
  function row(r: RecordItem) {
    const due = r.data.due || r.data.expiry || r.data.date || r.data.targetDate;
    const expired =
      due && new Date(due) < new Date() && r.data.status !== "Completed";
    return (
      <article
        className={"record-row " + (kind === "notes" ? "note-card" : "")}
        key={r.id}
      >
        <button className="record-main" onClick={() => edit(r)}>
          <div className="record-title">
            {r.data.pinned && <Pin size={14} />}
            <strong>{r.title}</strong>
            {r.data.priority &&
              ["High", "Urgent"].includes(r.data.priority) && (
                <span className="badge warm">{r.data.priority}</span>
              )}
          </div>
          {kind === "notes" ? (
            <p>
              {plainContent(r.data.content || "").slice(0, 180) ||
                "Catatan kosong"}
            </p>
          ) : (
            <p>
              {[
                r.data.description,
                r.data.company,
                r.data.provider,
                r.data.destination,
                r.data.skill,
                r.data.category,
              ]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 140)}
            </p>
          )}
          <div className="meta">
            {r.data.status && <StatusBadge status={r.data.status}/>}
            {kind==="tasks"&&<><span>{r.data.progress||0}%</span>{r.data.priority&&<span>{r.data.priority}</span>}</>}
            {[r.data.companyId,r.data.categoryId,r.data.projectId].map(id=>referenceRows.find(v=>v.id===id)).filter(Boolean).map(v=><span key={v!.id}>{v!.title}</span>)}
            {due && (
              <span className={expired ? "text-warn" : ""}>
                {new Date(due).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {r.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
            {kind === "competencies" && (
              <span>
                {r.data.level} → {r.data.targetLevel}
              </span>
            )}
          </div>
          {r.data.progress !== undefined && (
            <progress max={100} value={r.data.progress} />
          )}
        </button>
        <div className="row-actions">
          {kind === "habits" && (
            <Button
              variant="outline"
              onClick={async () => {
                const exists = all.data?.some(
                  (x) =>
                    x.kind === "habitEntries" &&
                    x.data.habitId === r.id &&
                    x.data.date === localDay(),
                );
                if (exists) {
                  setError("Sudah check-in hari ini");
                  return;
                }
                await store.saveRecord({
                  kind: "habitEntries",
                  title: r.title,
                  tags: [],
                  data: { habitId: r.id, date: localDay(), value: 1 },
                });
                await q.invalidateQueries();
              }}
            >
              <Check size={15} />
              {streak(all.data || [], r.id)} hari
            </Button>
          )}
          {kind === "integrations" && r.data.url && (
            <a
              className="button outline"
              href={r.data.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={"Buka " + r.title}
            >
              <ExternalLink size={16} />
            </a>
          )}
          {archived || trash ? (
            <Button
              variant="ghost"
              onClick={async () => {
                await store.restoreRecord(r.id);
                await q.invalidateQueries();
              }}
            >
              Pulihkan
            </Button>
          ) : (
            <Button
              variant="ghost"
              aria-label={"Arsipkan " + r.title}
              onClick={() => remove(r)}
            >
              <Archive size={16} />
            </Button>
          )}
        </div>
      </article>
    );
  }
  return (
    <>
      <PageHeader eyebrow={m.group} title={m.title} description={m.description}>
        <Button onClick={() => edit()}>
          <Plus size={17} />
          Tambah
        </Button>
      </PageHeader>
      {kind === "tasks" && (
        <div className="focus-bar">
          <div>
            <Timer size={18} />
            <strong>Focus session</strong>
            <span>
              {timer
                ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
                : "Luangkan waktu untuk satu hal."}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (timer) stopFocus().catch(setError);
              else {
                const n = Date.now();
                setTimer(n);
                localStorage.setItem("focus-start", String(n));
              }
            }}
          >
            {timer ? <Square size={14} /> : <Play size={14} />}{" "}
            {timer ? "Simpan sesi" : "Mulai fokus"}
          </Button>
        </div>
      )}
      <div className="list-toolbar">
        <select aria-label="Urutkan" value={sort} onChange={e=>{setSort(e.target.value);setPage(0)}}><option value="updated">Terbaru</option><option value="title">Judul A–Z</option><option value="due">Tenggat</option></select>
        <input type="search" aria-label="Cari opsi relasi" placeholder="Cari perusahaan / kategori / proyek" value={referenceSearch} onChange={e=>setReferenceSearch(e.target.value)}/><select aria-label="Filter relasi" value={related} onChange={e=>{setRelated(e.target.value);setPage(0)}}><option value="">Semua perusahaan / kategori / proyek</option>{all.data?.filter(r=>["companies","categories","projects"].includes(r.kind)).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>
        <Button variant="ghost" onClick={()=>{const cell=(v:any)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';store.download(m.key+'.csv', ['Title,Status,Priority,Due,Company,Category,Project',...rows.map(r=>[r.title,r.data.status,r.data.priority,r.data.due,...[r.data.companyId,r.data.categoryId,r.data.projectId].map(id=>referenceRows.find(v=>v.id===id)?.title||'')].map(cell).join(','))].join('\r\n'),'text/csv;charset=utf-8')}}>{serverPaged?"CSV halaman ini":"CSV export"}</Button>
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Cari catatan"
            placeholder={"Cari di " + m.title.toLowerCase()}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {kind === "tasks" && (
          <>
            <select aria-label="Filter prioritas" value={priority} onChange={e=>{setPriority(e.target.value);setPage(0)}}><option value="">Semua prioritas</option>{["Low","Medium","High","Urgent"].map(p=><option key={p}>{p}</option>)}</select>
            <select
              aria-label="Filter status"
              value={filter}
              onChange={(e) => {setFilter(e.target.value);setPage(0)}}
            >
              <option value="all">Semua status</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="tabs compact">
              <button
                className={view === "list" ? "active" : ""}
                onClick={() => {setView("list");setPage(0)}}
              >
                List
              </button>
              <button
                className={view === "board" ? "active" : ""}
                onClick={() => {setView("board");setPage(0)}}
              >
                Board
              </button>
              <button className={view === "completed" ? "active" : ""} onClick={()=>{setView("completed");setPage(0)}}>Completed</button>
            </div>
          </>
        )}
        <Button variant="ghost" onClick={()=>{setTrash(!trash);setPage(0)}}>{trash?"Keluar Trash":"Trash"}</Button>
        <Button variant="ghost" onClick={() => {setTrash(false);setArchived(!archived);setPage(0)}}>
          <Archive size={16} />
          {archived ? "Aktif" : "Arsip"}
        </Button>
        <Button
          variant="ghost"
          aria-label="Export"
          onClick={() =>
            store.download(
              m.key + ".md",
              rows
                .map(
                  (r) =>
                    "# " +
                    r.title +
                    "\n\n" +
                    Object.entries(r.data)
                      .map(
                        ([k, v]) =>
                          k +
                          ": " +
                          (k === "content" ? plainContent(String(v)) : v),
                      )
                      .join("\n"),
                )
                .join("\n\n---\n\n"),
            )
          }
        >
          <Download size={17} />
        </Button>
      </div>
      <ErrorText error={error || result.error} />
      {undo && (
        <div className="notice">
          Record diarsipkan.{" "}
          <button
            onClick={async () => {
              await store.restoreRecord(undo);
              setUndo(undefined);
              await q.invalidateQueries();
            }}
          >
            Urungkan
          </button>
        </div>
      )}
      {result.isLoading ? (
        <div className="skeleton" />
      ) : rows.length === 0 && view!=="board" ? (
        <Empty onAdd={() => edit()} />
      ) : view === "board" ? (
        <div className="kanban">
          {statuses.map((s) => (
            <section key={s}>
              <h3>
                {s}
                <span>{result.data && "statusCounts" in result.data ? result.data.statusCounts?.find(c=>c.status===s)?.count||0 : rows.filter((r)=>(r.data.status||"Inbox")===s).length}</span>
              </h3>
              {rows
                .filter((r) => (r.data.status || "Inbox") === s)
                .map((r) => (
                  <div className="kanban-card" key={r.id}>
                    {row(r)}

                  </div>
                ))}
            </section>
          ))}
        </div>
      ) : !["notes","tasks"].includes(kind) ? <DataTable rows={visible} card={row} onOpen={edit} columns={[
        {key:"title",label:"Nama",render:r=>r.title},
        {key:"status",label:"Status",render:r=>r.data.status||"—"},
        {key:"company",label:"Company",render:r=>referenceRows.find(v=>v.id===r.data.companyId)?.title||r.data.company||"—"},
        {key:"category",label:"Category",render:r=>referenceRows.find(v=>v.id===r.data.categoryId)?.title||r.data.category||"—"},
        {key:"project",label:"Project",render:r=>referenceRows.find(v=>v.id===r.data.projectId)?.title||r.data.project||"—"},
        {key:"archive",label:"Arsip",render:r=><button onClick={()=>remove(r)}>Arsipkan</button>}
      ]}/> : (
        <div className={kind === "notes" ? "notes-grid" : "record-list"}>
          {visible.map(row)}
        </div>
      )}
      {total > 30 && (
        <div className="pagination">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <span>
            {page + 1} / {Math.ceil(total / 30)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * 30 >= total}
            onClick={() => setPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}
      {[
        "work",
        "employments",
        "achievements",
        "trainings",
        "competencies",
      ].includes(kind) && (
        <div className="subtle-links">
          <Link to="/insights">Lihat ringkasan karier & laporan →</Link>
        </div>
      )}
      {open && (
        <RecordForm
          key={editing?.id || "new"}
          kind={kind}
          initial={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
