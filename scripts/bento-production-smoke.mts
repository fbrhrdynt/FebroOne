// Run as the service user with --env-file=.env. Only this synthetic owner is removed.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {database} from '../apps/api/src/db';
import {hashPassword} from '../apps/api/src/auth';
import {modules} from '../packages/shared/catalog';
const c=database(process.env.DATABASE_URL!);const id=randomUUID();const email=`bento-${id}@example.test`;const password=randomBytes(24).toString('hex');const origin='https://one.febro.id';let cookie='',csrf='';
async function request(path:string,method='GET',body?:unknown){const r=await fetch(origin+'/api'+path,{method,headers:{origin,cookie,'x-csrf-token':csrf,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200,path+' '+await r.clone().text());return {r,data:await r.json()};}
try{
 const html=await fetch(origin).then(r=>{assert.equal(r.status,200);return r.text()});for(const m of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)){const r=await fetch(origin+m[1]);assert.equal(r.status,200,m[1]);assert.ok(!r.headers.get('content-type')?.includes('text/html'),m[1]);}
 for(const path of ['/','/calendar','/finance','/debts','/tools','/insights','/settings','/more',...modules.map(m=>'/records/'+m.key)]){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.equal(await r.text(),html,path);}
 console.log('PASS: linked static assets and all 42 HTTPS SPA routes');
 await c.db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[id,email,'Temporary deployment QA',await hashPassword(password)]);
 const login=await request('/auth/login','POST',{email,password});cookie=login.r.headers.get('set-cookie')!.split(';')[0];csrf=login.data.csrf;assert.match(login.r.headers.get('set-cookie')!,/Secure/i);assert.equal((await request('/auth/me')).data.user.email,email);
 for(const kind of ['tasks','notes','events','certificates','work']){let row=(await request('/records','POST',{kind,title:'Deployment smoke',data:kind==='events'?{start:'2026-10-24T10:00',end:'2026-10-24T11:00'}:{}})).data;row=(await request('/records/'+row.id,'PUT',{...row,title:'Verified persistence'})).data;assert.equal((await request('/records?kind='+kind)).data.items[0].title,'Verified persistence');await request('/records/'+row.id,'DELETE');await request('/records/'+row.id+'/restore','POST');}
 for(const path of ['/finance','/notifications','/auth/sessions','/push'])await request(path);
 console.log('PASS: HTTPS login, secure cookie, identity, five-module CRUD/archive/restore, finance, notifications, sessions, push');
}finally{await c.db.transaction(async tx=>{await tx.query('DELETE FROM records WHERE owner_id=$1',[id]);await tx.query('DELETE FROM audit_logs WHERE owner_id=$1',[id]);await tx.query('DELETE FROM users WHERE id=$1 AND email=$2',[id,email]);});assert.equal((await c.db.query('SELECT id FROM users WHERE id=$1',[id])).rows.length,0);await c.close();console.log('Temporary test owner and records removed');}
