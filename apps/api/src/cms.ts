import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { DB } from './db';
export function signature(secret:string,timestamp:string,nonce:string,method:string,url:string,body:string) {
 return createHmac('sha256',secret).update([timestamp,nonce,method,url,body].join('\n')).digest('hex');
}
export function cmsConfig(){
 const secret=process.env.FEBRO_ONE_CMS_SECRET;
 const admins=(process.env.CMS_ADMIN_USER_IDS||'').split(',').filter(Boolean);
 const base=process.env.CMS_INTERNAL_URL||'http://127.0.0.1:3090';
 const u=new URL(base);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!(u.hostname==='127.0.0.1'||u.hostname==='localhost'||u.protocol==='https:'))throw new Error('Invalid CMS_INTERNAL_URL');
 return {secret,admins,base:u.origin};
}
export async function cmsCall(method:string,pathname:string,body?:unknown){
 const {secret,base}=cmsConfig();if(!secret||secret.length<32)throw Object.assign(new Error('CMS integration unavailable'),{statusCode:503});
 const raw=body===undefined?'':JSON.stringify(body), timestamp=String(Date.now()), nonce=randomUUID();
 const response=await fetch(base+pathname,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json','x-febro-timestamp':timestamp,'x-febro-nonce':nonce,'x-febro-signature':signature(secret,timestamp,nonce,method,pathname,raw)},body:method==='GET'?undefined:raw});
 const result=await response.json() as any;
 if(!response.ok)throw Object.assign(new Error(response.status>=500?'CMS service unavailable':result.error||'CMS request rejected'),{statusCode:response.status});
 return result;
}
export async function verifyCmsEvent(req:any,db:DB){
 const {secret}=cmsConfig(); const timestamp=req.headers['x-febro-timestamp'],nonce=req.headers['x-febro-nonce'],sig=req.headers['x-febro-signature'];
 if(!secret||secret.length<32||typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>300000||typeof nonce!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)||typeof sig!=='string'||! /^[a-f0-9]{64}$/.test(sig))return false;
 const expected=signature(secret,timestamp,nonce,req.method,req.url,req.rawBody||'');
 if(!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;
 const insert=await db.query('INSERT INTO cms_event_nonces(nonce) VALUES($1) ON CONFLICT DO NOTHING RETURNING nonce',[nonce]);
 await db.query("DELETE FROM cms_event_nonces WHERE created_at<now()-interval '10 minutes'");
 return !!insert.rows.length;
}
export async function registerCms(app:any,db:DB){
 const root='/api/integrations/one/v1';
 // All browser routes inherit session, origin and CSRF enforcement from makeApp.
 app.addHook('preHandler',async(req:any,reply:any)=>{
  if(req.url.startsWith('/api/cms/')&&!cmsConfig().admins.includes(req.owner))return reply.code(403).send({error:'CMS administrator access required'});
 });
 app.get('/api/cms/overview',()=>cmsCall('GET',root+'/overview'));
 app.get('/api/cms/requests',async(req:any)=>{
  const p=z.object({kind:z.preprocess(v=>v===''?undefined:v,z.enum(['document','cv','contact']).optional()),status:z.string().max(30).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0)}).parse(req.query);
  return cmsCall('GET',root+'/inbox?'+new URLSearchParams(Object.entries(p).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)])));
 });
 const params=z.object({kind:z.enum(['document','cv','contact']),id:z.string().regex(/^[1-9]\d{0,12}$/)});
 app.get('/api/cms/requests/:kind/:id',async(req:any)=>{const p=params.parse(req.params);return cmsCall('GET',`${root}/${p.kind}/${p.id}`)});
 app.post('/api/cms/requests/:kind/:id/:action',async(req:any)=>{
  const p=params.extend({action:z.enum(['approve','partial','reject','revoke','read','unread'])}).parse(req.params);
  const b=z.object({decisionId:z.uuid(),expectedStatus:z.string().max(30),hours:z.coerce.number().int().min(1).max(2160).optional(),fileIds:z.array(z.coerce.number().int().positive()).max(100).optional(),reason:z.string().max(2000).optional()}).strict().parse(req.body);
  const result=await cmsCall('POST',`${root}/${p.kind}/${p.id}/decision`,{...b,action:p.action,idempotencyKey:b.decisionId,actor:req.owner});
  await db.query('INSERT INTO audit_logs(owner_id,action) VALUES($1,$2)',[req.owner,`cms.${p.kind}.${p.id}.${p.action}:${b.decisionId}`]);
  return result;
 });
 app.post('/api/integrations/cms/events',async(req:any,reply:any)=>{
  if(!await verifyCmsEvent(req,db))return reply.code(401).send({error:'Unauthorized'});
  const p=z.object({id:z.string().max(150).regex(/^cms:(document|cv|contact):[1-9]\d*:created$/),kind:z.enum(['document','cv','contact']),requestId:z.union([z.string().regex(/^[1-9]\d*$/),z.number().int().positive()]),event:z.literal('created'),createdAt:z.string().max(60)}).strict().parse(req.body);
  if(p.id!==`cms:${p.kind}:${p.requestId}:created`)return reply.code(400).send({error:'Event identity mismatch'});
  const admins=cmsConfig().admins;if(!admins.length)return reply.code(503).send({error:'CMS administrators not configured'});
  await db.transaction(async(tx)=>{
   const inserted=await tx.query('INSERT INTO cms_events(id,kind,request_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[p.id,p.kind,String(p.requestId)]);
   if(!inserted.rows.length)return;
   for(const admin of admins)await tx.query('INSERT INTO notifications(id,owner_id,title,target_url) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[`${p.id}:${admin}`,admin,p.kind==='contact'?'New CMS contact message':'New CMS access request',`/cms/${p.kind}/${p.requestId}`]);
  });return {ok:true};
 });
}
