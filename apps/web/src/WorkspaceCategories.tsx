import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { modules,groupNames } from '../../../packages/shared/catalog';
import * as store from './store';
import {ModuleIcon} from './Bento';
export default function WorkspaceCategories(){
 const q=useQueryClient();const identity=useQuery({queryKey:['identity'],queryFn:store.identity});const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const expanded:string[]=identity.data?.user.preferences?.expandedCategories ?? [];
 async function save(value:string[]){setBusy(true);try{if(store.trial){const u=(await store.identity()).user;await store.preferences({...u.preferences,name:u.name,expandedCategories:value});}else await store.api('/preferences/workspace','PATCH',{expandedCategories:value});await q.invalidateQueries({queryKey:['identity']});setError('');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <><div className="tabs"><button disabled={busy} onClick={()=>save(groupNames)}>Expand All</button><button disabled={busy} onClick={()=>save([])}>Collapse All</button></div>{error&&<p role="alert">{error}</p>}<div className="more-grid">{groupNames.map(g=><section className="panel" key={g}><button className="category-toggle" aria-expanded={expanded.includes(g)} disabled={busy} onClick={()=>save(expanded.includes(g)?expanded.filter(v=>v!==g):[...expanded,g])}>{g}<span>{expanded.includes(g)?'−':'+'}</span></button>{expanded.includes(g)&&<div>{modules.filter(m=>m.group===g).map(m=><Link key={m.key} to={m.key==='events'?'/calendar':'/records/'+m.key}><ModuleIcon group={m.group}/>{m.title}<span>›</span></Link>)}</div>}</section>)}</div></>;
}
