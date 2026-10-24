import { useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Paperclip,
  Link2,
  History,
  Download,
  Trash2,
  Save,
} from "lucide-react";
import { catalog, type RecordItem } from "../../../packages/shared/catalog";
import { checklistItems,zonedInput,zonedInstant } from "../../../packages/shared/domain";
import * as store from "./store";
import { Button, Modal, Field, ErrorText, SearchableSelect } from "./ui";
const Editor = lazy(() => import("./Editor"));
export function plainContent(content: string) {
  try {
    const tree = JSON.parse(content);
    const walk = (n: any): string =>
      n.text || (n.content || []).map(walk).join(n.type === "doc" ? "\n" : "");
    return walk(tree);
  } catch {
    return content;
  }
}
export function RecordFormPage({
  kind,
  initial,
  onClose,
}: {
  kind: string;
  initial?: RecordItem;
  onClose: () => void;
}) {
  const m = catalog[kind];
  const identity=useQuery({queryKey:["identity"],queryFn:store.identity});
  const timezone=identity.data?.user.preferences?.timezone||"Asia/Jakarta";
  const [title, setTitle] = useState(initial?.title || "");
  const [tags, setTags] = useState(initial?.tags.join(", ") || "");
  const [data, setData] = useState<Record<string, any>>(
    initial?.data ||
      Object.fromEntries(
        m.fields
          .filter((f) => f.type === "select")
          .map((f) => [f.key, f.options?.[0]]),
      ),
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("edit");
  const [rich, setRich] = useState(true);
  const [deleteFileId,setDeleteFileId]=useState("");
  const [target, setTarget] = useState("");
  const [relation, setRelation] = useState("related");
  const query = useQueryClient();
  const [lookupSearch,setLookupSearch]=useState("");const [lookupPage,setLookupPage]=useState(0);
  const all = useQuery<RecordItem[]>({
    queryKey: ["records","form-options",tab,kind,lookupSearch,lookupPage],
    queryFn: async () => store.trial ? store.records() : (await store.api("/records?limit=100&offset="+lookupPage*100+"&q="+encodeURIComponent(lookupSearch)+(tab==="edit"&&kind==="notes"?"&kind=templates":""))).items,
  });
  const fs = useQuery({ queryKey: ["files"], queryFn: store.getFiles });
  const links = useQuery({ queryKey: ["links"], queryFn: store.getLinks });
  const history = useQuery({
    queryKey: ["versions", initial?.id],
    queryFn: () => store.versions(initial!.id),
    enabled: !!initial && tab === "history",
  });
  const draftKey = "draft:" + kind + ":" + (initial?.id || "new");
  const [draft, setDraft] = useState<any>();
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftSaved=useRef(false);const latestDraft=useRef({title,tags,data});latestDraft.current={title,tags,data};
  useEffect(()=>()=>{if(!draftSaved.current&&latestDraft.current.title.trim())void store.putState(draftKey,{...latestDraft.current,saved:new Date().toISOString()});},[draftKey]);
  useEffect(() => {
    store.getState(draftKey, null).then(value => { setDraft(value); setDraftLoaded(true); });
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoaded || (draft && !title)) return;
    const t = setTimeout(
      () =>
        !draftSaved.current && store.putState(draftKey, {
          title,
          tags,
          data,
          saved: new Date().toISOString(),
        }),
      700,
    );
    return () => clearTimeout(t);
  }, [title, tags, data, draftKey, draftLoaded]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if(busy) return;
    setBusy(true);
    setError(null);
    try {
      await store.saveRecord({
        id: initial?.id,
        version: initial?.version,
        kind,
        title,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        data: Object.fromEntries(Object.entries(data).map(([key,value])=>[key, m.fields.find(f=>f.key===key)?.type==="datetime-local" && value && !/(Z|[+-]\d{2}:\d{2})$/.test(String(value)) ? zonedInstant(String(value),timezone):value])),
      });
      draftSaved.current=true;
      await store.local.state.delete(draftKey);
      await query.invalidateQueries();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const attached =
    fs.data?.filter((f: any) => f.record_id === initial?.id) || [];
  const connected = (links.data || []).filter(
    (l: any) => l.source_id === initial?.id || l.target_id === initial?.id,
  );
  return (
    <section className="panel record-form-page"><header><Button variant="ghost" onClick={onClose}>← Kembali</Button><h1>{initial ? "Edit " + m.title : "Tambah " + m.title}</h1><p>{m.description}</p></header>
      <div className="tabs">
        <button
          className={tab === "edit" ? "active" : ""}
          onClick={() => setTab("edit")}
        >
          Detail
        </button>
        {initial && (
          <>
            <button
              onClick={() => setTab("files")}
              className={tab === "files" ? "active" : ""}
            >
              <Paperclip size={15} /> Lampiran {attached.length || ""}
            </button>
            <button
              onClick={() => setTab("links")}
              className={tab === "links" ? "active" : ""}
            >
              <Link2 size={15} /> Tautan
            </button>
            <button
              onClick={() => setTab("history")}
              className={tab === "history" ? "active" : ""}
            >
              <History size={15} /> Riwayat
            </button>
          </>
        )}
      </div>
      {(tab==="links" || (kind==="notes"&&!initial&&tab==="edit"))&&<details className="lookup-tools"><summary>Cari template / record terkait</summary><input type="search" aria-label="Cari record terkait" value={lookupSearch} onChange={e=>{setLookupSearch(e.target.value);setLookupPage(0)}}/><div className="row-actions"><Button type="button" variant="ghost" disabled={!lookupPage} onClick={()=>setLookupPage(lookupPage-1)}>Sebelumnya</Button><span>{lookupPage+1}</span><Button type="button" variant="ghost" disabled={(all.data?.length||0)<100} onClick={()=>setLookupPage(lookupPage+1)}>Berikutnya</Button></div></details>}
      <ErrorText error={error || all.error} />
      {tab === "edit" && (
        <form onSubmit={save} className="form-stack">
          {draft && (draft.title !== title || draft.tags !== tags || JSON.stringify(draft.data)!==JSON.stringify(data)) && (
            <div className="notice">
              Draft lokal tersedia.{" "}
              <button
                type="button"
                onClick={() => {
                  setTitle(draft.title);
                  setTags(draft.tags);
                  setData(draft.data);
                  setDraft(null);
                }}
              >
                Pulihkan draft
              </button>
            </div>
          )}
          <Field label="Judul / nama">
            <input
              autoFocus
              required
              maxLength={240}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {kind === "notes" && !initial && (
            <Field label="Gunakan template">
              <select
                onChange={(e) => {
                  const t = all.data?.find((r) => r.id === e.target.value);
                  if (t) setData({ ...data, content: t.data.content || "" });
                }}
              >
                <option value="">Tanpa template</option>
                {all.data
                  ?.filter((r) => r.kind === "templates")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <div className="form-grid">
            {m.fields.filter(f=>!(["tasks","work","employments","trainings","certificates","projects","achievements","competencies","timesheets"].includes(kind)&&["company","category","project"].includes(f.key))).map((f) => (
              <div
                key={f.key}
                className={f.type === "textarea" ? "span-2" : ""}
              >
                <Field label={f.label}>
                  {f.key === "checklist" && kind === "tasks" ? (
                    <div className="form-stack">{checklistItems(data.checklist).map((item,index,items)=><div className="checklist-row" key={item.id}>
                    <input aria-label="Selesai" type="checkbox" checked={item.checked} onChange={e=>setData({...data,checklist:items.map((v,i)=>i===index?{...v,checked:e.target.checked}:v)})}/>
                    <input aria-label="Checklist item" value={item.text} onChange={e=>setData({...data,checklist:items.map((v,i)=>i===index?{...v,text:e.target.value}:v)})}/>
                    <button type="button" disabled={!index} aria-label="Naik" onClick={()=>{[items[index-1],items[index]]=[items[index],items[index-1]];setData({...data,checklist:items})}}>↑</button>
                    <button type="button" disabled={index===items.length-1} aria-label="Turun" onClick={()=>{[items[index+1],items[index]]=[items[index],items[index+1]];setData({...data,checklist:items})}}>↓</button>
                    <button type="button" aria-label="Hapus item" onClick={()=>setData({...data,checklist:items.filter((_,i)=>i!==index)})}>×</button>
                    </div>)}<button type="button" onClick={()=>setData({...data,checklist:[...checklistItems(data.checklist),{id:crypto.randomUUID(),text:"Item baru",checked:false}]})}>+ Tambah checklist</button>
                    <small>{checklistItems(data.checklist).length ? Math.round(checklistItems(data.checklist).filter(i=>i.checked).length/checklistItems(data.checklist).length*100):0}% selesai · Status otomatis jika memiliki checklist</small></div>
                  ) : f.key === "parent" && kind === "tasks" ? <RelationshipPicker name="parent" value={data.parent||""} records={all.data||[]} onChange={value=>setData({...data,parent:value})}/> : f.key === "content" && kind === "notes" ? (
                    <div>
                      <div className="tabs">
                        <button
                          type="button"
                          onClick={() => setRich(true)}
                          className={rich ? "active" : ""}
                        >
                          Editor
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setData({
                              ...data,
                              content: plainContent(data.content || ""),
                            });
                            setRich(false);
                          }}
                          className={!rich ? "active" : ""}
                        >
                          Markdown / teks
                        </button>
                      </div>
                      {rich ? (
                        <Suspense fallback={<div className="skeleton" />}>
                          <Editor
                            value={data.content || ""}
                            onChange={(v) =>
                              setData((d) => ({ ...d, content: v }))
                            }
                          />
                        </Suspense>
                      ) : (
                        <textarea
                          rows={10}
                          value={data.content || ""}
                          onChange={(e) =>
                            setData({ ...data, content: e.target.value })
                          }
                        />
                      )}
                    </div>
                  ) : f.type === "textarea" ? (
                    <textarea
                      rows={4}
                      value={data[f.key] || ""}
                      onChange={(e) =>
                        setData({ ...data, [f.key]: e.target.value })
                      }
                    />
                  ) : f.type === "select" ? (
                    <select
                      value={data[f.key] || f.options?.[0]}
                      onChange={(e) =>
                        setData({ ...data, [f.key]: e.target.value })
                      }
                    >
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={!!data[f.key]}
                      onChange={(e) =>
                        setData({ ...data, [f.key]: e.target.checked })
                      }
                    />
                  ) : (
                    <input
                      required={f.required}
                      type={f.type || "text"}
                      readOnly={kind==="tasks"&&f.key==="progress"&&checklistItems(data.checklist).length>0}
                      step={f.type === "number" ? "any" : undefined}
                      min={f.type === "number" ? 0 : undefined}
                      value={
                        f.type === "datetime-local" && data[f.key]
                          ? (/(Z|[+-]\d{2}:\d{2})$/.test(data[f.key]) ? zonedInput(data[f.key],timezone) : data[f.key].slice(0,16))
                          : (data[f.key] ??
                            (f.type === "color" ? "#4688c8" : ""))
                      }
                      onChange={(e) =>
                        setData({ ...data, [f.key]: e.target.value })
                      }
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
          {["tasks","work","employments","trainings","certificates","projects","achievements","competencies","timesheets"].includes(kind)&&["company","category",...(kind === "projects" ? [] : ["project"])].map((name)=><RelationshipPicker key={name} name={name} companyId={data.companyId} value={data[name+"Id"]||""} records={(all.data||[]).filter(r=>r.kind===({company:"companies",category:"categories",project:"projects",parent:"tasks"}[name])&&(name!=="project"||!data.companyId||r.data.companyId===data.companyId))} onChange={value=>setData({...data,[name+"Id"]:value,...(name==="company"&&value!==data.companyId?{projectId:""}:{})})}/>)}
          {kind === "tasks" && <><Field label={"Pengingat ("+timezone+")"}><input type="datetime-local" value={data.reminder?zonedInput(data.reminder,timezone):""} onChange={e=>setData({...data,reminder:e.target.value?zonedInstant(e.target.value,timezone):""})}/></Field><Field label="Pengulangan pengingat"><select value={data.reminderRepeat||"None"} onChange={e=>setData({...data,reminderRepeat:e.target.value})}>{["None","Daily","Weekly","Monthly"].map(v=><option key={v}>{v}</option>)}</select></Field></>}
          <Field label="Tags (pisahkan dengan koma)">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="personal, penting"
            />
          </Field>
          <footer className="form-footer">
            <small>Draft disimpan otomatis di perangkat ini.</small><Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button disabled={busy} type="submit">
              <Save size={16} />
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </footer>
        </form>
      )}
      {tab === "files" && (
        <div className="form-stack">
          <Field label="Unggah PDF / gambar · maks. 10 MB">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                if (!e.target.files?.[0]) return;
                try {
                  await store.uploadFile(initial!.id, e.target.files[0]);
                  await query.invalidateQueries({ queryKey: ["files"] });
                } catch (e) {
                  setError(e);
                }
              }}
            />
          </Field>
          {attached.map((f: any) => (
            <div className="row" key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <small>{(f.size / 1024).toFixed(0)} KB</small>
              </div>
              <div className="row-actions">
                <Button
                  variant="ghost"
                  onClick={() => store.downloadFile(f, true).catch(setError)}
                >
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Unduh"
                  onClick={() => store.downloadFile(f).catch(setError)}
                >
                  <Download size={17} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label="Hapus file"
                  onClick={async () => {
                    if(deleteFileId!==f.id){setDeleteFileId(f.id);return;}
                    await store.deleteFile(f.id);
                    await query.invalidateQueries({ queryKey: ["files"] });
                  }}
                >
                  {deleteFileId===f.id?"Konfirmasi hapus permanen":<Trash2 size={17} />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "links" && (
        <div className="form-stack">
          <Field label="Hubungkan record">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Pilih record</option>
              {all.data
                ?.filter((r) => r.id !== initial?.id)
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    {catalog[r.kind]?.title} · {r.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Hubungan">
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            >
              {[
                "related",
                "evidence",
                "training",
                "certificate",
                "skill",
                "expense",
                "project",
                "parent",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Button
            disabled={!target}
            onClick={async () => {
              try {
                await store.addLink(initial!.id, target, relation);
                await query.invalidateQueries({ queryKey: ["links"] });
              } catch (e) {
                setError(e);
              }
            }}
          >
            Hubungkan
          </Button>
          {connected.map((l: any, i: number) => (
            <div className="row" key={i}>
              {l.relation} ·{" "}
              {all.data?.find(
                (r) =>
                  r.id ===
                  (l.source_id === initial?.id ? l.target_id : l.source_id),
              )?.title || "Record tidak tersedia"}
            </div>
          ))}
        </div>
      )}
      {tab === "history" && (
        <div className="form-stack">
          {history.data?.length === 0 && <p>Belum ada versi sebelumnya.</p>}
          {history.data?.map((v: any) => (
            <div className="panel" key={v.version}>
              <strong>
                Versi {v.version} · {v.snapshot.title}
              </strong>
              <small>{new Date(v.created_at).toLocaleString("id-ID")}</small>
              <pre>{JSON.stringify(v.snapshot.data, null, 2)}</pre>
              <Button
                variant="outline"
                onClick={() => {
                  setTitle(v.snapshot.title);
                  setData(v.snapshot.data);
                  setTags(v.snapshot.tags.join(", "));
                  setTab("edit");
                }}
              >
                Gunakan versi ini
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RelationshipPicker({name,value,records,onChange,companyId}:{name:string;value:string;records:RecordItem[];onChange:(value:string)=>void;companyId?:string}) {
 const label=({company:"Perusahaan",category:"Kategori",project:"Proyek",parent:"Tugas induk"} as Record<string,string>)[name];
 const [search,setSearch]=useState("");const [page,setPage]=useState(0);
 const kind=({company:"companies",category:"categories",project:"projects",parent:"tasks"} as Record<string,string>)[name];
 const result=useQuery({queryKey:["master-options",kind,search,page,companyId],queryFn:()=>store.api(`/records?kind=${kind}&limit=30&offset=${page*30}&q=${encodeURIComponent(search)}${name==="project"&&companyId?"&companyId="+companyId:""}`),enabled:!store.trial});
 const selected=useQuery({queryKey:["master-selected",value],queryFn:()=>store.api('/records/'+value),enabled:!!value&&!store.trial});
 const options:RecordItem[]=store.trial?records:result.data?.items||[];
 const selectedRow=selected.data||records.find(r=>r.id===value);
 return <div className="relationship-picker"><label>{label}<input type="search" aria-label={"Cari "+label} placeholder={"Cari "+label} value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/></label><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="">Tanpa {label.toLowerCase()}</option>{selectedRow&&!options.some(r=>r.id===value)&&<option value={value}>{selectedRow.title} {selectedRow.archivedAt?'(arsip)':''}</option>}{options.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select><ErrorText error={result.error}/>{result.data?.total>30&&<div className="row-actions"><Button type="button" variant="ghost" disabled={!page} onClick={()=>setPage(page-1)}>Sebelumnya</Button><span>{page+1}</span><Button type="button" variant="ghost" disabled={(page+1)*30>=result.data.total} onClick={()=>setPage(page+1)}>Berikutnya</Button></div>}</div>;
}
export default function RecordForm({kind,initial,onClose}:{kind:string;initial?:RecordItem;onClose:()=>void}) {
 const navigate=useNavigate();const routed=useRef(false);
 useEffect(()=>{if(routed.current)return;routed.current=true;onClose();navigate(`/records/${kind}/${initial ? initial.id+(kind==="tasks"?"":"/edit") : "new"}`);},[]);
 return null;
}
