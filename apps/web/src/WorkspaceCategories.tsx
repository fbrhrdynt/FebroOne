import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { modules,groupNames } from '../../../packages/shared/catalog';
import * as store from './store';
import {ModuleIcon} from './Bento';
import { Wallet, CreditCard } from "lucide-react";
export default function WorkspaceCategories(){
 const q=useQueryClient();const identity=useQuery({queryKey:['identity'],queryFn:store.identity});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const expanded:string[]=identity.data?.user.preferences?.expandedCategories ?? [];
 async function save(value:string[]){setBusy(true);try{if(store.trial){const u=(await store.identity()).user;await store.preferences({...u.preferences,name:u.name,expandedCategories:value});}else await store.api('/preferences/workspace','PATCH',{expandedCategories:value});await q.invalidateQueries({queryKey:['identity']});setError('');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <div className="workspace-compact">
  <div className="workspace-toolbar"><span>{modules.length + 2} fitur</span><div><button disabled={busy} onClick={()=>save(groupNames)}>Buka semua</button><button disabled={busy} onClick={()=>save([])}>Tutup semua</button></div></div>
  {error&&<p role="alert">{error}</p>}
  <section className="workspace-finance-shortcuts" aria-label="Keuangan">
    <Link to="/finance"><Wallet size={17}/><span><strong>Keuangan</strong><small>Akun, transaksi, anggaran, tabungan</small></span><span>↗</span></Link>
    <Link to="/debts"><CreditCard size={17}/><span><strong>Utang & piutang</strong><small>Pinjaman, cicilan, dan pembayaran</small></span><span>↗</span></Link>
  </section>
  <div className="workspace-compact-grid">{groupNames.map(g=>{const items=modules.filter(m=>m.group===g);const isOpen=expanded.includes(g);return <section className="workspace-group" key={g}>
    <button className="workspace-group-toggle" aria-expanded={isOpen} disabled={busy} onClick={()=>save(isOpen?expanded.filter(v=>v!==g):[...expanded,g])}>
      <span><ModuleIcon group={g}/><strong>{g}</strong><small>{items.length}</small></span><span className="workspace-chevron">{isOpen?'−':'+'}</span>
    </button>
    {isOpen&&<div className="workspace-group-items">{items.map(m=><Link key={m.key} to={m.key==='events'?'/calendar':'/records/'+m.key}>{m.title}<span>↗</span></Link>)}</div>}
  </section>})}</div>
 </div>;
}
