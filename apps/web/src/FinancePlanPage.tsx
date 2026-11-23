import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Save, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import * as store from "./store";
import { Button, Field, ErrorText } from "./ui";

type Income={id:string;name:string;amount:string};
type Item={id:string;name:string;amount:string;checked:boolean};
const id=()=>crypto.randomUUID();
const rupiah=(v:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v||0);
const numeric=(v:string)=>Math.max(0,Number(v)||0);
const monthNow=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"}).slice(0,7);
export default function FinancePlanPage(){
 const query=useQuery({queryKey:["records","incomePlans"],queryFn:()=>store.records("incomePlans")});
 const client=useQueryClient();
 const [month,setMonth]=useState(monthNow());
 const [incomes,setIncomes]=useState<Income[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState<unknown>();
 const [busy,setBusy]=useState(false);
 const plans=query.data||[];
 const active=plans.find(r=>r.data.month===month);
 if(!loaded&&query.isSuccess){
   const data=active?.data;
   if(data){setIncomes(Array.isArray(data.incomeSources)?data.incomeSources:[]);setItems(Array.isArray(data.plannedItems)?data.plannedItems:[]);}
   else {setIncomes([]);setItems([]);}
   setLoaded(true);
 }
 const totalIncome=useMemo(()=>incomes.reduce((s,v)=>s+numeric(v.amount),0),[incomes]);
 const allocated=useMemo(()=>items.filter(v=>v.checked).reduce((s,v)=>s+numeric(v.amount),0),[items]);
 const planned=useMemo(()=>items.reduce((s,v)=>s+numeric(v.amount),0),[items]);
 const remaining=totalIncome-allocated;
 function changeMonth(value:string){setMonth(value);setLoaded(false);}
 function updateIncome(id:string,patch:Partial<Income>){setIncomes(v=>v.map(x=>x.id===id?{...x,...patch}:x));}
 function updateItem(id:string,patch:Partial<Item>){setItems(v=>v.map(x=>x.id===id?{...x,...patch}:x));}
 async function save(){
   setBusy(true);setError(null);
   try{
     await store.saveRecord({id:active?.id,version:active?.version,kind:"incomePlans",title:"Rencana keuangan "+month,tags:["keuangan","rencana-bulanan"],data:{month,incomeSources:incomes,plannedItems:items}});
     await client.invalidateQueries({queryKey:["records","incomePlans"]});
     await client.invalidateQueries({queryKey:["records"]});
   }catch(e){setError(e);}finally{setBusy(false);}
 }
 return <div className="finance-plan">
  <header className="page-header"><div><Link to="/finance" className="text-button"><ArrowLeft size={14}/> Keuangan</Link><h1>Rencana keuangan</h1><p>Atur pemasukan dan tentukan ke mana uang akan dialokasikan.</p></div></header>
  <ErrorText error={error||query.error}/>
  <div className="plan-actions"><Field label="Periode"><input type="month" value={month} onChange={e=>changeMonth(e.target.value)}/></Field><Button onClick={save} disabled={busy||!month}>{busy?"Menyimpan…":<><Save size={15}/> Simpan rencana</>}</Button></div>
  <section className="plan-summary">
   <div className="plan-stat"><span>Total pemasukan</span><strong>{rupiah(totalIncome)}</strong></div>
   <div className="plan-stat"><span>Sudah dialokasikan</span><strong>{rupiah(allocated)}</strong></div>
   <div className="plan-stat"><span>Sisa tersedia</span><strong>{rupiah(remaining)}</strong></div>
  </section>
  <section className="panel">
   <div className="plan-actions"><div><h2><Wallet size={16}/> Sumber pemasukan</h2><small>Tambahkan gaji, lembur, freelance, bonus, atau pemasukan lain.</small></div><Button variant="outline" onClick={()=>setIncomes(v=>[...v,{id:id(),name:"",amount:"0"}])}><Plus size={14}/> Tambah sumber</Button></div>
   {incomes.map(v=><div className="plan-row" key={v.id}><input aria-label="Nama pemasukan" placeholder="Contoh: Gaji bulanan" value={v.name} onChange={e=>updateIncome(v.id,{name:e.target.value})}/><input aria-label="Nominal pemasukan" type="number" min="0" step="1000" value={v.amount} onChange={e=>updateIncome(v.id,{amount:e.target.value})}/><button aria-label="Hapus pemasukan" onClick={()=>setIncomes(x=>x.filter(i=>i.id!==v.id))}><Trash2 size={15}/></button></div>)}
   {!incomes.length&&<p className="hint">Belum ada sumber pemasukan. Tambahkan pemasukan untuk mulai membuat rencana.</p>}
  </section>
  <section className="panel">
   <div className="plan-actions"><div><h2>Alokasi pengeluaran</h2><small>Centang saat dana sudah dialokasikan atau dibayarkan. Nilainya mengurangi sisa tersedia.</small></div><Button variant="outline" onClick={()=>setItems(v=>[...v,{id:id(),name:"",amount:"0",checked:false}])}><Plus size={14}/> Tambah kebutuhan</Button></div>
   {items.map(v=><div className="plan-row" key={v.id}><label className={"plan-check "+(v.checked?"done":"")}><input type="checkbox" checked={v.checked} onChange={e=>updateItem(v.id,{checked:e.target.checked})}/><span>{v.name||"Kebutuhan baru"}</span></label><input aria-label="Nominal kebutuhan" type="number" min="0" step="1000" value={v.amount} onChange={e=>updateItem(v.id,{amount:e.target.value})}/><button aria-label="Hapus kebutuhan" onClick={()=>setItems(x=>x.filter(i=>i.id!==v.id))}><Trash2 size={15}/></button><input className="plan-name-edit" aria-label="Nama kebutuhan" placeholder="Nama kebutuhan" value={v.name} onChange={e=>updateItem(v.id,{name:e.target.value})}/></div>)}
   {!items.length&&<p className="hint">Contoh: makan, transportasi, cicilan, keluarga, tabungan, dan hiburan.</p>}
   <div className="plan-actions"><small>Total semua rencana: {rupiah(planned)} · Dicentang: {rupiah(allocated)}</small><strong>{remaining<0?"Melebihi pemasukan: ":"Sisa dana: "}{rupiah(Math.abs(remaining))}</strong></div>
  </section>
 </div>;
}
