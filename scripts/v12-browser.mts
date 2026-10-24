// Isolated browser verification: PGlite data never touches production PostgreSQL.
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { migrate } from './migrate';
import { makeApp } from '../apps/api/src/app';
import { hashPassword } from '../apps/api/src/auth';
import { modules } from '../packages/shared/catalog';
import {localDay} from '../packages/shared/domain';
const playwrightPath=process.env.PLAYWRIGHT_MODULE || '/tmp/febro-browser/node_modules/playwright/index.mjs';
const { chromium } = await import(playwrightPath);
const pg=new PGlite();await pg.waitReady;
const adapter=(p:any):any=>({query:async(s:string,a?:any[])=>!a&&s.split(';').filter(Boolean).length>1?(await p.exec(s)).at(-1):p.query(s,a),transaction:(fn:any)=>p.transaction((tx:any)=>fn(adapter(tx)))});
const db=adapter(pg);await migrate(db);
const storage=await mkdtemp(join(tmpdir(),'febro-bento-browser-'));
const origin='http://127.0.0.1:4371';
const distRoot=process.env.BENTO_DIST || '.v12-stage/dist';
await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[randomUUID(),'bento@example.test','Bento QA',await hashPassword('bento-browser-test-123')]);
const app=await makeApp(db,{origin,secure:false,storage});await app.ready();
let count=0;
const server=createServer(async(req,res)=>{try{
 if(req.url?.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const response=await app.inject({method:req.method as any,url:req.url,headers:req.headers as any,payload:Buffer.concat(chunks),remoteAddress:`127.2.${Math.floor(++count/250)%250}.${count%250+1}`});res.writeHead(response.statusCode,response.headers as any);res.end(response.rawPayload);return;}
 const pathname=new URL(req.url!,origin).pathname;let file=resolve(distRoot,'.'+pathname);if(!file.startsWith(resolve(distRoot)+'/'))file=resolve(distRoot,'index.html');let data;try{data=await readFile(file)}catch{file=resolve(distRoot,'index.html');data=await readFile(file)}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'} as any)[extname(file)]||'application/octet-stream');res.end(data);
 }catch(e){res.statusCode=500;res.end('Browser fixture failed');console.error(e)}});
await new Promise<void>(r=>server.listen(4371,'127.0.0.1',r));
let browser:any;
try{
 browser=await chromium.launch({headless:true,executablePath:'/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
 let context=await browser.newContext();let page=await context.newPage();const errors:string[]=[];page.on('pageerror',(e:any)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.status()>=400&&!(r.url().endsWith('/auth/me')&&r.status()===401))console.log('HTTP',r.status(),r.url())});
 await page.goto(origin);const login=page.locator('form').filter({has:page.locator('input[name=email]')});await login.waitFor();await login.getByLabel('Email',{exact:true}).fill('bento@example.test');await login.getByLabel('Password',{exact:true}).fill('bento-browser-test-123');await Promise.all([page.waitForResponse((r:any)=>r.url().endsWith('/api/auth/login')&&r.status()===200),login.getByRole('button',{name:'Masuk',exact:true}).click()]);await page.locator('.sidebar').waitFor({state:'attached'});
 const api=async(path:string,method='GET',body?:any)=>page.evaluate(async({path,method,body}:{path:string;method:string;body?:any})=>{const me=await fetch('/api/auth/me').then(r=>r.json());const r=await fetch('/api'+path,{method,headers:{'content-type':'application/json','x-csrf-token':me.csrf},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(path+' '+r.status+' '+await r.text());return r.json()},{path,method,body});

 const company=await api('/records','POST',{kind:'companies',title:'QA Company',data:{}});
 const category=await api('/records','POST',{kind:'categories',title:'QA Category',data:{}});
 const project=await api('/records','POST',{kind:'projects',title:'QA Project',data:{companyId:company.id}});
 const task=await api('/records','POST',{kind:'tasks',title:'Checklist first QA',data:{companyId:company.id,categoryId:category.id,projectId:project.id,priority:'High',checklist:[{id:'a',text:'First step',checked:false}]}});
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/records/tasks');await page.locator('.kanban').waitFor();assert.equal(await page.locator('.kanban>section').count(),6);
 await page.getByRole('button',{name:'Checklist first QA'}).click();await page.waitForURL('**/records/tasks/'+task.id);await page.getByRole('heading',{name:'Checklist: 0 / 1 completed'}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByLabel('Judul / nama',{exact:true}).count(),0);
 await page.getByRole('button',{name:'+ Tambah Checklist',exact:true}).click();await page.getByLabel('Teks checklist').fill('Second step');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('heading',{name:'Checklist: 0 / 2 completed'}).waitFor();
 await page.reload();await page.getByText('Second step',{exact:true}).waitFor();
 let item=page.locator('.checklist-detail-item').filter({hasText:'Second step'});await item.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Teks checklist').fill('Second edited');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByText('Second edited',{exact:true}).waitFor();
 await page.locator('.checklist-detail-item').filter({hasText:'First step'}).getByRole('checkbox').click();await page.getByRole('heading',{name:'Checklist: 1 / 2 completed'}).waitFor();await page.locator('.checklist-detail-item').filter({hasText:'Second edited'}).getByRole('checkbox').click();await page.getByRole('heading',{name:'Checklist: 2 / 2 completed'}).waitFor();assert.equal((await api('/records/'+task.id)).data.status,'Completed');
 await page.locator('.checklist-detail-item').filter({hasText:'First step'}).getByRole('checkbox').click();await page.getByRole('heading',{name:'Checklist: 1 / 2 completed'}).waitFor();assert.equal((await api('/records/'+task.id)).data.status,'In Progress');
 item=page.locator('.checklist-detail-item').filter({hasText:'Second edited'});await item.getByRole('button',{name:'Hapus',exact:true}).click();await item.getByRole('button',{name:'Konfirmasi hapus',exact:true}).click();await page.getByRole('heading',{name:'Checklist: 0 / 1 completed'}).waitFor();
 await page.getByRole('link',{name:'Edit Task',exact:true}).click();await page.waitForURL('**/edit');await page.getByLabel('Judul / nama',{exact:true}).fill('Checklist edited QA');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('heading',{name:'Checklist edited QA',exact:true}).waitFor();
 const persisted=await api('/records/'+task.id);assert.equal(persisted.data.companyId,company.id);assert.equal(persisted.data.categoryId,category.id);assert.equal(persisted.data.projectId,project.id);
 await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await page.getByRole('button',{name:'Konfirmasi Move to Trash',exact:true}).click();await page.waitForURL((url:any)=>url.pathname==='/records/tasks');await page.goto(origin+'/records/tasks?trash=true');await page.getByRole('button',{name:'Checklist edited QA'}).click();await page.getByRole('button',{name:'Restore',exact:true}).click();await page.waitForURL((url:any)=>url.pathname==='/records/tasks');assert.equal((await api('/records/'+task.id)).deletedAt,null);
 await page.goto(origin+'/');await page.locator('.bottom-nav').getByRole('button',{name:'Quick Add',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Note',exact:true}).click();await page.waitForURL('**/records/notes/new');assert.equal(await page.getByRole('dialog').count(),0);await page.getByLabel('Judul / nama',{exact:true}).fill('Created route QA');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.waitForURL(origin+'/');assert.equal((await api('/records?kind=notes&q=Created%20route%20QA')).total,1);
 await page.goto(origin+'/more');await page.locator('.category-toggle').first().waitFor();assert.equal(await page.locator('.category-toggle[aria-expanded=true]').count(),0);await page.locator('.category-toggle').first().click();await page.locator('.category-toggle[aria-expanded=true]').waitFor();await page.reload();await page.locator('.category-toggle[aria-expanded=true]').waitFor();

 console.log('Core task, relationship, Trash, route and accordion workflows passed');
 await page.goto(origin+'/records/tasks/'+task.id);await page.getByRole('button',{name:'+ Tambah Checklist',exact:true}).click();await page.getByLabel('Teks checklist').fill('Preserve on failure');
 await page.route('**/api/records/'+task.id,async (route:any)=>{if(route.request().method()==='PUT'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA temporary failure'})});}else await route.continue();});
 await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByText('QA temporary failure',{exact:false}).waitFor();assert.equal(await page.getByLabel('Teks checklist').inputValue(),'Preserve on failure');await page.unroute('**/api/records/'+task.id);
 await page.getByRole('button',{name:'Simpan',exact:true}).evaluate((button:any)=>{button.click();button.click();});await page.getByText('Preserve on failure',{exact:true}).waitFor();assert.equal((await api('/records/'+task.id)).data.checklist.filter((i:any)=>i.text==='Preserve on failure').length,1);
 await page.goto(origin+'/finance/new/account');await page.getByLabel('Nama akun',{exact:true}).fill('QA Bank');await page.getByLabel('Saldo awal IDR',{exact:true}).fill('100');await page.getByRole('button',{name:'Konfirmasi & simpan',exact:true}).click();await page.waitForURL('**/finance');
 const finance=await api('/finance');const bank=finance.accounts.find((a:any)=>a.name==='QA Bank');assert.ok(bank);
 await page.goto(origin+'/finance/new/transaction');await page.locator('select[name=accountId]').selectOption(bank.id);await page.getByLabel('Nominal IDR',{exact:true}).fill('12.34');await page.getByLabel('Deskripsi',{exact:true}).fill('Route finance draft');await page.reload();await page.getByLabel('Nominal IDR',{exact:true}).waitFor();assert.equal(await page.getByLabel('Nominal IDR',{exact:true}).inputValue(),'12.34');await page.getByRole('button',{name:'Konfirmasi & simpan',exact:true}).click();await page.waitForURL('**/finance');assert.equal((await api('/finance')).transactions.filter((t:any)=>t.description==='Route finance draft').length,1);
 console.log('Failure recovery, duplicate prevention and finance route/draft workflows passed');
 const paths=['/','/calendar','/finance','/finance/new/account','/debts','/tools','/insights','/settings','/more','/records/tasks/'+task.id,'/records/tasks/'+task.id+'/edit',...modules.map(m=>'/records/'+m.key),...['tasks','notes','reminders','companies','categories','projects','work'].map(k=>'/records/'+k+'/new')];
 const overflow:string[]=[];let visited=0;const authState=await context.storageState();
 for(const width of (process.env.V12_RECHECK ? [] : [375,390,430,768,1366])){await context.close();context=await browser.newContext({storageState:authState});page=await context.newPage();page.on('pageerror',(e:any)=>errors.push(e.message));await page.setViewportSize({width,height:900});for(const path of paths){await page.goto(origin+path);await page.locator('.page-header,.record-form-page,.checklist-detail').first().waitFor();await page.waitForLoadState('networkidle');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))overflow.push(width+' '+path);visited++;}console.log('Verified responsive routes at '+width);}
 assert.deepEqual(overflow,[]);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/records/tasks/'+task.id);await page.getByRole('heading',{name:'Checklist edited QA',exact:true}).waitFor();await page.screenshot({path:'docs/v12/task-detail-390.png',fullPage:true});await page.getByRole('button',{name:'Ganti tema',exact:true}).click();await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));await page.reload();await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));await page.getByRole('heading',{name:'Checklist edited QA',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'docs/v12/task-detail-dark-390.png',fullPage:true});
 await writeFile(process.env.V12_RECHECK?'docs/v12/browser-recheck-results.json':'docs/v12/browser-results.json',JSON.stringify({visited,overflow,errors,checklistCRUD:'passed',routeForms:'passed',relationships:'passed',trashRestore:'passed',accordions:'passed',failureRecovery:'passed',duplicatePrevention:'passed',financeRoutesAndDraft:'passed',darkThemePersistence:'passed',artifactHash:createHash('sha256').update(await readFile(distRoot+'/index.html')).digest('hex')},null,2));console.log('V12 browser checks passed');
}finally{if(browser)await browser.close();await new Promise<void>(r=>server.close(()=>r()));await app.close();await pg.close();await rm(storage,{recursive:true,force:true});}
