import webpush from 'web-push';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DB } from './db';
import { nextZonedReminder } from '../../../packages/shared/domain';
const subscriptionSchema=z.object({endpoint:z.url().max(4096).refine(v=>{const u=new URL(v);return u.protocol==='https:' && !u.port && (u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='web.push.apple.com');},'Unsupported push provider'),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(80).max(100),auth:z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(20).max(30)})});
export async function pushKeys(db:DB) {
 let key=(await db.query('SELECT * FROM push_config WHERE id=1')).rows[0];
 if(!key){ const pair=webpush.generateVAPIDKeys(); await db.query('INSERT INTO push_config(id,public_key,private_key) VALUES(1,$1,$2) ON CONFLICT DO NOTHING',[pair.publicKey,pair.privateKey]); key=(await db.query('SELECT * FROM push_config WHERE id=1')).rows[0]; }
 return key;
}
export async function registerPush(app:any,db:DB) {
 app.get('/api/push',async(req:any)=>({publicKey:(await pushKeys(db)).public_key,devices:(await db.query('SELECT id,label,created_at FROM push_subscriptions WHERE owner_id=$1 ORDER BY created_at DESC',[req.owner])).rows}));
 app.post('/api/push',async(req:any,reply:any)=>{const p=z.object({subscription:subscriptionSchema,label:z.string().trim().min(1).max(100)}).parse(req.body);const existing=(await db.query('SELECT owner_id FROM push_subscriptions WHERE endpoint=$1',[p.subscription.endpoint])).rows[0]; if(existing&&existing.owner_id!==req.owner) return reply.code(409).send({error:'Device belongs to another account; unsubscribe first'}); await db.query('INSERT INTO push_subscriptions(id,owner_id,endpoint,subscription,label) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription,label=excluded.label WHERE push_subscriptions.owner_id=excluded.owner_id',[randomUUID(),req.owner,p.subscription.endpoint,JSON.stringify(p.subscription),p.label]); return {ok:true};});
 app.delete('/api/push/:id',async(req:any)=>{await db.query('DELETE FROM push_subscriptions WHERE id=$1 AND owner_id=$2',[z.uuid().parse(req.params.id),req.owner]);return {ok:true};});
}
export async function runPush(db:DB,now=new Date(),send:typeof webpush.sendNotification=webpush.sendNotification) {
 const due=(await db.query("SELECT id FROM records WHERE kind='tasks' AND archived_at IS NULL AND reminder_at<=$1 AND COALESCE(data->>'status','')<>'Completed'",[now])).rows;
 for(const r of due) await db.transaction(async tx=>{
  const task=(await tx.query('SELECT * FROM records WHERE id=$1 FOR UPDATE',[r.id])).rows[0];
  if(!task.reminder_at || new Date(task.reminder_at)>now || task.archived_at || task.data.status==='Completed')return;
  const at=new Date(task.reminder_at).toISOString();
  await tx.query('INSERT INTO notifications(id,owner_id,title,record_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[`reminder:${task.id}:${at}`,task.owner_id,task.title,task.id]);
  const user=(await tx.query("SELECT preferences FROM users WHERE id=$1",[task.owner_id])).rows[0];
  const zone=user.preferences?.timezone||"Asia/Jakarta";
  let next=nextZonedReminder(at,task.reminder_repeat,zone); while(next && new Date(next)<=now) next=nextZonedReminder(next,task.reminder_repeat,zone);
  await tx.query('UPDATE records SET reminder_at=$1 WHERE id=$2',[next,task.id]);
 });
 const pending=(await db.query("SELECT s.*,n.id notification_id,n.record_id,n.target_url,r.kind record_kind FROM push_subscriptions s JOIN notifications n ON n.owner_id=s.owner_id LEFT JOIN records r ON r.id=n.record_id AND r.owner_id=n.owner_id WHERE n.read_at IS NULL AND n.created_at>=s.created_at AND NOT EXISTS(SELECT 1 FROM push_deliveries d WHERE d.subscription_id=s.id AND d.notification_id=n.id AND (d.status='sent' OR d.claimed_at>now()-interval '5 minutes')) ORDER BY n.created_at LIMIT 100")).rows;
 if(!pending.length)return;
 const keys=await pushKeys(db);
 for(const s of pending){
  const claim=await db.query(`INSERT INTO push_deliveries(subscription_id,notification_id) VALUES($1,$2) ON CONFLICT(subscription_id,notification_id) DO UPDATE SET status='claimed',claimed_at=now() WHERE push_deliveries.status<>'sent' AND push_deliveries.claimed_at<=now()-interval '5 minutes' RETURNING subscription_id`,[s.id,s.notification_id]); if(!claim.rows.length)continue;
  try { await send(s.subscription,JSON.stringify({title:'Febro One',body:s.target_url?'Ada pesan atau permintaan CMS baru.':'Anda memiliki pengingat baru.',url:s.target_url|| (s.record_id&&s.record_kind?`/records/${s.record_kind}/${s.record_id}`:'/'),tag:s.notification_id}),{vapidDetails:{subject:'https://one.febro.id',publicKey:keys.public_key,privateKey:keys.private_key},TTL:3600,timeout:10000}); await db.query("UPDATE push_deliveries SET status='sent' WHERE subscription_id=$1 AND notification_id=$2",[s.id,s.notification_id]); }
  catch(e:any){if([404,410].includes(e.statusCode))await db.query('DELETE FROM push_subscriptions WHERE id=$1',[s.id]);else await db.query("UPDATE push_deliveries SET status='failed' WHERE subscription_id=$1 AND notification_id=$2",[s.id,s.notification_id]);}
 }
}
