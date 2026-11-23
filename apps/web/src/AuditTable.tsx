import { useState } from "react";
type AuditRow = { id?:string; action:string; detail?:string; date:string };
export default function AuditTable({rows}:{rows:AuditRow[]}) {
 const [page,setPage]=useState(0);const [filter,setFilter]=useState("");const size=8;
 const filtered=rows.filter(r=>(r.action+" "+(r.detail||"")).toLocaleLowerCase("id").includes(filter.toLocaleLowerCase("id")));
 const total=Math.max(1,Math.ceil(filtered.length/size));const current=Math.min(page,total-1);
 return <div className="audit-table-wrap"><div className="audit-toolbar"><input aria-label="Filter riwayat audit" placeholder="Cari aktivitas…" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}/><span>{filtered.length} aktivitas</span></div><div className="audit-scroll"><table className="audit-table"><thead><tr><th>Waktu</th><th>Aktivitas</th><th>Detail</th></tr></thead><tbody>{filtered.slice(current*size,(current+1)*size).map((r,i)=><tr key={r.id||current*size+i}><td>{r.date}</td><td>{r.action}</td><td title={r.detail}>{r.detail||"—"}</td></tr>)}{!filtered.length&&<tr><td colSpan={3}>Tidak ada aktivitas.</td></tr>}</tbody></table></div><div className="audit-pagination"><button disabled={current===0} onClick={()=>setPage(current-1)}>← Sebelumnya</button><span>{current+1} / {total}</span><button disabled={current>=total-1} onClick={()=>setPage(current+1)}>Berikutnya →</button></div></div>;
}
