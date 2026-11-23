import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Wallet, Check, Cloud, CloudOff } from "lucide-react";
import { Link } from "react-router-dom";
import * as store from "./store";
import { Button, Field, ErrorText } from "./ui";

type Income={id:string;name:string;amount:string};
type Item={id:string;name:string;amount:string;checked:boolean};
type PlanData={incomeSources:Income[];plannedItems:Item[]};
const makeId=()=>crypto.randomUUID();
const numberValue=(v:string)=>Number(String(v).replace(/\D/g,""))||0;
const formatNumber=(v:string|number)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(typeof v==="number"?v:numberValue(v));
const rupiah=(v:number)=>"Rp"+formatNumber(v);
const monthNow=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit"}).format(new Date());
function parsePlan(data:any):PlanData{
 if(data?.payload&&typeof data.payload==="string"){
  try{const parsed=JSON.parse(data.payload);return {incomeSources:Array.isArray(parsed.incomeSources)?parsed.incomeSources:[],plannedItems:Array.isArray(parsed.plannedItems)?parsed.plannedItems:[]};}catch{}
 }
 return {incomeSources:Array.isArray(data?.incomeSources)?data.incomeSources:[],plannedItems:Array.isArray(data?.plannedItems)?data.plannedItems:[]};
}
export default function FinancePlanPage(){
 const query=useQuery({queryKey:["records","incomePlans"],queryFn:()=>store.records("incomePlans"),staleTime:60_000});
 const client=useQueryClient();
 const [month,setMonth]=useState(monthNow);
 const [incomes,setIncomes]=useState<Income[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState<unknown>();
 const [saveState,setSaveState]=useState<"saved"|"saving"|"error">("saved");
 const [editing,setEditing]=useState<string[]>([]);
 const activeRef=useRef<any>(null);
 const dirtyRef=useRef(false);
 const signatureRef=useRef("");
 const plans=query.data||[];
 const active=plans.find(r=>r.data.month===month);
 useEffect(()=>{
  if(!query.isSuccess)return;
  const found=plans.find(r=>r.data.month===month)||null;
  const data=parsePlan(found?.data);
  activeRef.current=found;
  setIncomes(data.incomeSources);
  setItems(data.plannedItems);
  setLoaded(true);
  dirtyRef.current=false;
  signatureRef.current=JSON.stringify({month,...data});
 },[query.data,query.isSuccess,month]);
 const totalIncome=useMemo(()=>incomes.reduce((s,v)=>s+numberValue(v.amount),0),[incomes]);
 const allocated=useMemo(()=>items.filter(v=>v.checked).reduce((s,v)=>s+numberValue(v.amount),0),[items]);
 const planned=useMemo(()=>items.reduce((s,v)=>s+numberValue(v.amount),0),[items]);
 const remaining=totalIncome-allocated;
 function markDirty(){dirtyRef.current=true;setSaveState("saving");}
 function changeMonth(value:string){if(value&&value!==month){void persist().finally(()=>{setLoaded(false);setMonth(value);});}}
 function updateIncome(id:string,patch:Partial<Income>){markDirty();setIncomes(v=>v.map(x=>x.id===id?{...x,...patch}:x));}
 function updateItem(id:string,patch:Partial<Item>){markDirty();setItems(v=>v.map(x=>x.id===id?{...x,...patch}:x));}
 async function persist(){
  const snapshot={month,incomeSources:incomes,plannedItems:items};
  const signature=JSON.stringify(snapshot);
  if(!dirtyRef.current||signature===signatureRef.current)return;
  setSaveState("saving");setError(undefined);
  try{
   const saved=await store.saveRecord({id:activeRef.current?.id,version:activeRef.current?.version,kind:"incomePlans",title:"Rencana keuangan "+month,tags:["keuangan","rencana-bulanan"],data:{month,payload:JSON.stringify({incomeSources:incomes,plannedItems:items})}});
   activeRef.current=saved;
   signatureRef.current=signature;
   dirtyRef.current=false;
   client.setQueryData(["records","incomePlans"],(old:any)=>[...(old||[]).filter((r:any)=>r.id!==saved.id),saved]);
   client.setQueryData(["records"],(old:any)=>old?.map((r:any)=>r.id===saved.id?saved:r));
   setSaveState("saved");
  }catch(e){setError(e);setSaveState("error");}
 }
 useEffect(()=>{
  if(!loaded||!dirtyRef.current)return;
  const timer=window.setTimeout(()=>void persist(),650);
  return ()=>window.clearTimeout(timer);
 },[month,incomes,items,loaded]);
 useEffect(()=>()=>{if(dirtyRef.current)void persist();},[]);
 function addIncome(){const value={id:makeId(),name:"",amount:"0"};markDirty();setIncomes(v=>[...v,value]);}
 function addItem(){const value={id:makeId(),name:"",amount:"0",checked:false};markDirty();setItems(v=>[...v,value]);setEditing(v=>[...v,value.id]);}
 function updateAmount(value:string,change:(v:string)=>void){change(formatNumber(value));}
 return <div className="finance-plan">
  <header className="page-header"><div><Link to="/finance" className="text-button"><ArrowLeft size={14}/> Keuangan</Link><h1>Rencana keuangan</h1><p>Atur pemasukan dan tentukan ke mana uang akan dialokasikan.</p></div></header>
  <ErrorText error={error||query.error}/>
  <div className="plan-actions"><Field label="Periode"><input type="month" value={month} onChange={e=>changeMonth(e.target.value)}/></Field><span className="plan-save-state" aria-live="polite">{saveState==="saving"?<><Cloud size={14}/> Menyimpan otomatis…</>:saveState==="error"?<><CloudOff size={14}/> Gagal menyimpan</>:<><Check size={14}/> Tersimpan</>}</span></div>
  <section className="plan-summary">
   <div className="plan-stat"><span>Total pemasukan</span><strong>{rupiah(totalIncome)}</strong></div>
   <div className="plan-stat"><span>Sudah dialokasikan</span><strong>{rupiah(allocated)}</strong></div>
   <div className="plan-stat"><span>Sisa tersedia</span><strong>{rupiah(remaining)}</strong></div>
  </section>
  <section className="panel">
   <div className="plan-actions"><div><h2><Wallet size={16}/> Sumber pemasukan</h2><small>Tambahkan gaji, lembur, freelance, bonus, atau pemasukan lain.</small></div><Button variant="outline" onClick={addIncome}><Plus size={14}/> Tambah sumber</Button></div>
   {incomes.map(v=><div className="plan-row plan-income" key={v.id}><input aria-label="Nama pemasukan" placeholder="Contoh: Gaji bulanan" value={v.name} onChange={e=>updateIncome(v.id,{name:e.target.value})}/><input aria-label="Nominal pemasukan" inputMode="numeric" type="text" value={formatNumber(v.amount)} onChange={e=>updateAmount(e.target.value,value=>updateIncome(v.id,{amount:value.replace(/\./g,"")}))}/><button aria-label="Hapus pemasukan" onClick={()=>{markDirty();setIncomes(x=>x.filter(i=>i.id!==v.id));}}><Trash2 size={15}/></button></div>)}
   {!incomes.length&&<p className="hint">Belum ada sumber pemasukan. Tambahkan pemasukan untuk mulai membuat rencana.</p>}
  </section>
  <section className="panel">
   <div className="plan-actions"><div><h2>Alokasi pengeluaran</h2><small>Centang kebutuhan yang sudah dialokasikan. Klik dua kali nama untuk mengedit.</small></div><Button variant="outline" onClick={addItem}><Plus size={14}/> Tambah kebutuhan</Button></div>
   {items.map(v=><div className="plan-row plan-expense" key={v.id}>
    <label className={"plan-check "+(v.checked?"done":"")}><input type="checkbox" checked={v.checked} onChange={e=>updateItem(v.id,{checked:e.target.checked})}/></label>
    {editing.includes(v.id)?<input className="plan-item-name" autoFocus aria-label="Nama kebutuhan" placeholder="Nama kebutuhan" value={v.name} onChange={e=>updateItem(v.id,{name:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();setEditing(x=>x.filter(k=>k!==v.id));}}} onBlur={()=>setEditing(x=>x.filter(k=>k!==v.id))}/>:<button type="button" className={"plan-item-text "+(v.checked?"done":"")} onDoubleClick={()=>setEditing(x=>[...x,v.id])} title="Klik dua kali untuk edit nama">{v.name||"Kebutuhan baru"}</button>}
    <input className="plan-item-amount" aria-label="Nominal kebutuhan" inputMode="numeric" type="text" value={formatNumber(v.amount)} onChange={e=>updateAmount(e.target.value,value=>updateItem(v.id,{amount:value.replace(/\./g,"")}))}/>
    <button aria-label="Hapus kebutuhan" onClick={()=>{markDirty();setItems(x=>x.filter(i=>i.id!==v.id));}}><Trash2 size={15}/></button>
   </div>)}
   {!items.length&&<p className="hint">Contoh: makan, transportasi, cicilan, keluarga, tabungan, dan hiburan.</p>}
   <div className="plan-total"><span>Total semua rencana</span><strong>{rupiah(planned)}</strong><small>{items.length} kebutuhan · {items.filter(v=>v.checked).length} dicentang</small></div>
  </section>
 </div>;
}
