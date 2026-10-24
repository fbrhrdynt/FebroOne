// Run as the service user with --env-file=.env. Only this synthetic owner is removed.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {database} from '../apps/api/src/db';
import {hashPassword} from '../apps/api/src/auth';
import {modules} from '../packages/shared/catalog';
const c=database(process.env.DATABASE_URL!);const id=randomUUID();const email=`bento-${id}@example.test`;const password=randomBytes(24).toString('hex');const origin='https://one.febro.id';let cookie='',csrf='';
async function request(path:string,method='GET',body?:unknown,expected=200){const r=await fetch(origin+'/api'+path,{method,headers:{origin,cookie,'x-csrf-token':csrf,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,expected,path+' '+await r.clone().text());return {r,data:await r.json()};}
try{
 const html=await fetch(origin).then(r=>{assert.equal(r.status,200);return r.text()});for(const m of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)){const r=await fetch(origin+m[1]);assert.equal(r.status,200,m[1]);assert.ok(!r.headers.get('content-type')?.includes('text/html'),m[1]);}
 for(const path of ['/','/calendar','/finance','/debts','/tools','/insights','/settings','/more',...modules.map(m=>'/records/'+m.key)]){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.equal(await r.text(),html,path);}
 console.log('PASS: linked static assets and all 42 HTTPS SPA routes');
 await c.db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[id,email,'Temporary deployment QA',await hashPassword(password)]);
 const login=await request('/auth/login','POST',{email,password});cookie=login.r.headers.get('set-cookie')!.split(';')[0];csrf=login.data.csrf;assert.match(login.r.headers.get('set-cookie')!,/Secure/i);assert.equal((await request('/auth/me')).data.user.email,email);
 for(const kind of ['tasks','notes','events','certificates','work']){let row=(await request('/records','POST',{kind,title:'Deployment smoke',data:kind==='events'?{start:'2026-10-24T10:00',end:'2026-10-24T11:00'}:{}})).data;row=(await request('/records/'+row.id,'PUT',{...row,title:'Verified persistence'})).data;assert.equal((await request('/records?kind='+kind)).data.items[0].title,'Verified persistence');await request('/records/'+row.id,'DELETE');await request('/records/'+row.id+'/restore','POST');}

 const company=(await request('/records','POST',{kind:'companies',title:'V12 smoke company',data:{}})).data;
 const category=(await request('/records','POST',{kind:'categories',title:'V12 smoke category',data:{}})).data;
 const project=(await request('/records','POST',{kind:'projects',title:'V12 smoke project',data:{companyId:company.id}})).data;
 let task=(await request('/records','POST',{kind:'tasks',title:'V12 smoke checklist',data:{status:'To Do',companyId:company.id,categoryId:category.id,projectId:project.id,checklist:[{id:'a',text:'Smoke first',checked:false}]}})).data;
 const save=async(data:any)=>{task=(await request('/records/'+task.id,'PUT',{...task,data:{...task.data,...data}})).data;};
 await save({checklist:task.data.checklist.map((i:any)=>({...i,checked:true}))});assert.equal(task.data.status,'Completed');
 await save({checklist:[...task.data.checklist,{id:'b',text:'Smoke next',checked:false}]});assert.equal(task.data.status,'In Progress');
 for(const status of ['Cancelled','On Hold']){await save({status});await save({checklist:task.data.checklist.map((i:any)=>({...i,checked:true}))});assert.equal(task.data.status,status);}
 assert.equal((await request('/records/'+task.id)).data.data.projectId,project.id);
 await request('/records/'+task.id+'/trash','POST',{});assert.equal((await request('/records?kind=tasks&trash=true')).data.items[0].id,task.id);assert.equal((await request('/records?kind=tasks&q=V12%20smoke%20checklist')).data.total,0);
 await request('/records/'+task.id+'/restore','POST',{});assert.equal((await request('/records/'+task.id)).data.deletedAt,null);
 await request('/auth/logout','POST',{});const relogin=await request('/auth/login','POST',{email,password});cookie=relogin.r.headers.get('set-cookie')!.split(';')[0];csrf=relogin.data.csrf;assert.equal((await request('/records/'+task.id)).data.data.checklist.length,2);

 const purge=(await request('/records','POST',{kind:'notes',title:'V12 disposable purge fixture',data:{}})).data;
 await request('/records/'+purge.id+'/trash','POST',{});
 await request('/records/'+purge.id+'/permanent','DELETE',{confirmation:purge.title},409);
 await c.db.query("UPDATE records SET deleted_at=now()-interval '31 days' WHERE id=$1 AND owner_id=$2",[purge.id,id]);
 await request('/records/'+purge.id+'/permanent','DELETE',{confirmation:purge.title});await request('/records/'+purge.id,'GET',undefined,404);
 console.log('PASS: real PostgreSQL permanent-delete retention guard and removal of an aged synthetic unlinked record');
 console.log('PASS: authenticated checklist completion/reopening, protected statuses, master relationships, Trash/restore and persistence after re-login');
 for(const path of ['/finance','/notifications','/auth/sessions','/push'])await request(path);
 console.log('PASS: HTTPS login, secure cookie, identity, five-module CRUD/archive/restore, finance, notifications, sessions, push');
}finally{await c.db.transaction(async tx=>{await tx.query('DELETE FROM records WHERE owner_id=$1',[id]);await tx.query('DELETE FROM audit_logs WHERE owner_id=$1',[id]);await tx.query('DELETE FROM users WHERE id=$1 AND email=$2',[id,email]);});assert.equal((await c.db.query('SELECT id FROM users WHERE id=$1',[id])).rows.length,0);await c.close();console.log('Temporary test owner and records removed');}
