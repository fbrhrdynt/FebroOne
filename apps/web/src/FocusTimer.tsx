import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Square, Timer } from 'lucide-react';
import { localDay } from '../../../packages/shared/domain';
import { Button, ErrorText } from './ui';
import { ActivityCard } from './Bento';
import * as store from './store';
// Uses the existing focus-start key and timesheets contract shared with Tasks.
export default function FocusTimer() {
  const q=useQueryClient();
  const [start,setStart]=useState<number|null>(()=>Number(localStorage.getItem('focus-start'))||null);
  const [now,setNow]=useState(Date.now());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<unknown>();
  useEffect(()=>{if(!start)return;const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[start]);
  const seconds=start?Math.max(0,Math.floor((now-start)/1000)):0;
  async function toggle(){setError(undefined);if(!start){const next=Date.now();localStorage.setItem('focus-start',String(next));setNow(next);setStart(next);return;}
    setBusy(true);try{await store.saveRecord({kind:'timesheets',title:'Focus session',tags:[],data:{date:localDay(),kind:'Focus',minutes:Math.max(1,Math.round((Date.now()-start)/60000))}});localStorage.removeItem('focus-start');setStart(null);await q.invalidateQueries({queryKey:['records']});}catch(e){setError(e);}finally{setBusy(false);}}
  return <ActivityCard title="Waktu untuk fokus" className="focus-card"><div className="focus-caption"><Timer size={18}/><span>{start?'Satu hal dalam satu waktu.':'Beri ruang untuk pekerjaan terbaik.'}</span></div><div className="focus-clock" role="timer" aria-label="Durasi fokus">{String(Math.floor(seconds/60)).padStart(2,'0')}<span>:</span>{String(seconds%60).padStart(2,'0')}</div><Button variant="outline" disabled={busy} onClick={toggle}>{start?<Square size={16}/>:<Play size={16}/ >}{busy?'Menyimpan…':start?'Simpan sesi':'Mulai fokus'}</Button><p className="hint">Sesi disimpan ke catatan waktu Anda.</p><ErrorText error={error}/></ActivityCard>;
}
