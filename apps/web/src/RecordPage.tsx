import { tr } from "./i18n";
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalog, type RecordItem } from '../../../packages/shared/catalog';
import { checklistItems, type ChecklistItem } from '../../../packages/shared/domain';
import { RecordFormPage } from './RecordForm';
import { Button, ErrorText, Empty, StatusBadge } from './ui';
import * as store from './store';
export default function RecordPage({edit=false}:{edit?:boolean}) {
 const {kind='tasks',id}=useParams();const navigate=useNavigate();const q=useQueryClient();
 const result=useQuery({queryKey:['record',id],queryFn:async()=>{const record=store.trial||!navigator.onLine?await store.local.records.get(id!):await store.api('/records/'+id);if(!record)throw Error('Record tidak tersedia');return record as RecordItem;},enabled:!!id});
 const back=()=>window.history.state?.idx>0?navigate(-1):navigate('/records/'+kind);
 if(!catalog[kind])return <Empty title={tr("Halaman tidak ditemukan")}/>;
 if(id && result.isPending)return <div className="skeleton"/>;
 if(result.error)return <><Button onClick={back}>{tr("← Kembali")}</Button><ErrorText error={result.error}/></>;
 if(!id||edit)return <RecordFormPage key={id||kind} kind={kind} initial={result.data} onClose={back}/>;
 return <Detail key={id} record={result.data!} back={back}/>;
}
function Detail({record,back}:{record:RecordItem;back:()=>void}) {
 const q=useQueryClient();const [busy,setBusy]=useState(false);const lock=useRef(false);const [error,setError]=useState<unknown>();
 const [adding,setAdding]=useState(false);const [text,setText]=useState('');const [editing,setEditing]=useState('');const [deleting,setDeleting]=useState('');const [trash,setTrash]=useState(false);const [purge,setPurge]=useState(false);const [confirmation,setConfirmation]=useState('');
 const items=checklistItems(record.data.checklist);const checked=items.filter(i=>i.checked).length;
 const references=useQuery({queryKey:['record-relations',record.id,record.version],queryFn:async()=>Promise.all(['companyId','categoryId','projectId'].map(async key=>({key,record:record.data[key]?await store.api('/records/'+record.data[key]):null}))) });
 async function save(next:ChecklistItem[]) {
  if(lock.current)return;lock.current=true;setBusy(true);setError(undefined);
  try {const saved=await store.saveRecord({...record,data:{...record.data,checklist:next}});q.setQueryData(['record',record.id],saved);await q.invalidateQueries({queryKey:['records']});setAdding(false);setText('');setEditing('');setDeleting('');}
  catch(e){setError(e);await q.invalidateQueries({queryKey:['record',record.id]});}
  finally{lock.current=false;setBusy(false);}
 }
 async function action(fn:()=>Promise<unknown>){if(lock.current)return;lock.current=true;setBusy(true);try{await fn();await q.invalidateQueries();back();}catch(e){setError(e);}finally{lock.current=false;setBusy(false);}}
 const input=<form className="inline-checklist-form" onSubmit={e=>{e.preventDefault();const value=text.trim();if(value)save(editing?items.map(i=>i.id===editing?{...i,text:value}:i):[...items,{id:crypto.randomUUID(),text:value,checked:false}]);}}><label>{tr("Checklist")}<input aria-label={tr("Teks checklist")} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} disabled={busy} required/></label><div className="row-actions"><Button type="submit" disabled={busy||!text.trim()}>{busy?'Menyimpan…':'Simpan'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{setAdding(false);setEditing('');setText('');}}>{tr("Batal")}</Button></div></form>;
 return <><Button variant="ghost" onClick={back}>{tr("← Kembali")}</Button><header className="page-header"><div><h1>{record.title}</h1><StatusBadge status={record.data.status||'Inbox'}/></div></header><ErrorText error={error}/>
 {record.kind==='tasks'&&<section className="panel checklist-detail" aria-busy={busy}><h2>Checklist: {checked} / {items.length} completed</h2><progress max={items.length||1} value={checked} aria-label={tr("Progres checklist")}/>
 {items.map(item=><div className="checklist-detail-item" key={item.id}>{editing===item.id?input:<><label><input type="checkbox" checked={item.checked} disabled={busy||!!record.archivedAt} onChange={e=>save(items.map(i=>i.id===item.id?{...i,checked:e.target.checked}:i))}/><span>{item.text}</span></label><div className="row-actions"><Button variant="ghost" disabled={busy||!!record.archivedAt} onClick={()=>{setAdding(false);setEditing(item.id);setText(item.text);}}>{tr("Edit")}</Button><Button variant="ghost" disabled={busy||!!record.archivedAt} onClick={()=>setDeleting(item.id)}>{tr("Hapus")}</Button></div>{deleting===item.id&&<div className="notice">{tr("Hapus item checklist ini?")}<div className="row-actions"><Button variant="danger" disabled={busy} onClick={()=>save(items.filter(i=>i.id!==item.id))}>{tr("Konfirmasi hapus")}</Button><Button variant="outline" onClick={()=>setDeleting('')}>{tr("Batal")}</Button></div></div>}</>}</div>)}
 {adding?input:<Button variant="outline" disabled={busy||!!record.archivedAt} onClick={()=>{setEditing('');setText('');setAdding(true);}}>{tr("+ Tambah Checklist")}</Button>}
 <span role="status">{busy?'Menyimpan…':''}</span></section>}
 <Link className="button primary" to={`/records/${record.kind}/${record.id}/edit`}>Edit {record.kind==='tasks'?'Task':tr(catalog[record.kind].title)}</Link>
 <section className="panel record-metadata"><h2>{tr("Detail")}</h2><dl>{references.data?.filter(r=>r.record).map(r=><div key={r.key}><dt>{({companyId:'Perusahaan',categoryId:'Kategori',projectId:'Proyek'} as any)[r.key]}</dt><dd>{r.record.title}{r.record.archivedAt?' (arsip)':''}</dd></div>)}{catalog[record.kind].fields.filter(f=>f.key!=='checklist'&&record.data[f.key]!==undefined&&record.data[f.key]!=='').map(f=><div key={f.key}><dt>{tr(f.label)}</dt><dd>{String(record.data[f.key])}</dd></div>)}</dl><Link to={`/records/${record.kind}/${record.id}/edit`}>{tr("Lampiran, relasi & riwayat →")}</Link></section>
 <section className="panel"><div className="row-actions">{record.archivedAt?<Button disabled={busy} onClick={()=>action(()=>store.restoreRecord(record.id))}>{tr("Restore")}</Button>:<Button variant="outline" disabled={busy} onClick={()=>action(()=>store.archiveRecord(record))}>{tr("Archive")}</Button>}<Button variant="danger" disabled={busy} onClick={()=>setTrash(true)}>{tr("Move to Trash")}</Button></div>{trash&&<div className="notice"><p>Pindahkan “{record.title}” ke Trash? Record dapat dipulihkan; lampiran dan relasi tetap disimpan.</p><Button variant="danger" disabled={busy} onClick={()=>action(()=>store.api('/records/'+record.id+'/trash','POST'))}>{tr("Konfirmasi Move to Trash")}</Button><Button variant="outline" onClick={()=>setTrash(false)}>{tr("Batal")}</Button></div>}{(record as any).deletedAt&&<div><Button variant="danger" onClick={()=>setPurge(true)}>{tr("Permanently Delete")}</Button>{purge&&<div className="notice"><p>Minimal 30 hari di Trash. Record dengan relasi, lampiran, atau riwayat tidak dapat dihapus permanen. Ketik judul lengkap: {record.title}</p><input aria-label={tr("Konfirmasi judul")} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><Button variant="danger" disabled={busy||confirmation!==record.title} onClick={()=>action(()=>store.api('/records/'+record.id+'/permanent','DELETE',{confirmation}))}>{tr("Konfirmasi Permanently Delete")}</Button><Button variant="outline" onClick={()=>setPurge(false)}>{tr("Batal")}</Button></div>}</div>}</section></>;
}
