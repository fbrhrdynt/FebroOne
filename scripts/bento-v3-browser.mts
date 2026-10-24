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
const distRoot=process.env.BENTO_DIST || 'dist';
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
 const context=await browser.newContext();const page=await context.newPage();const errors:string[]=[];page.on('pageerror',(e:any)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.status()>=400&&!(r.url().endsWith('/auth/me')&&r.status()===401))console.log('HTTP',r.status(),r.url())});
 await page.goto(origin);const login=page.locator('form').filter({has:page.locator('input[name=email]')});await login.waitFor();await login.getByLabel('Email',{exact:true}).fill('bento@example.test');await login.getByLabel('Password',{exact:true}).fill('bento-browser-test-123');await Promise.all([page.waitForResponse((r:any)=>r.url().endsWith('/api/auth/login')&&r.status()===200),login.getByRole('button',{name:'Masuk',exact:true}).click()]);await page.locator('.sidebar').waitFor({state:'attached'});
 const api=async(path:string,method='GET',body?:any)=>page.evaluate(async({path,method,body}:{path:string;method:string;body?:any})=>{const me=await fetch('/api/auth/me').then(r=>r.json());const r=await fetch('/api'+path,{method,headers:{'content-type':'application/json','x-csrf-token':me.csrf},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(path+' '+r.status+' '+await r.text());return r.json()},{path,method,body});
 for(const width of [375,390,430,768,1366,1920]){await page.setViewportSize({width,height:900});await page.goto(origin);await page.locator('.completion-card').waitFor();await page.waitForLoadState('networkidle');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'empty dashboard overflow '+width);}
 const company=await api('/records','POST',{kind:'companies',title:'Browser company',data:{}});
 const project=await api('/records','POST',{kind:'projects',title:'Browser project',data:{companyId:company.id}});
 const checklist=await api('/records','POST',{kind:'tasks',title:'Browser checklist',data:{companyId:company.id,projectId:project.id,priority:'High',checklist:[{id:'a',text:'Browser check',checked:false}]}});
 const day=localDay();
 for(const row of [
   {kind:'events',title:'Product review',data:{start:day+'T09:00',end:day+'T10:00',calendar:'Work'}},
   {kind:'reminders',title:'Prepare weekly review',data:{due:day+'T17:00'}},
   {kind:'notes',title:'Ideas for a better week',data:{folder:'Personal'}},
   {kind:'habits',title:'Read ten pages',data:{}},
   {kind:'goals',title:'Make room for learning',data:{progress:35}},
   {kind:'documents',title:'Reference documents',data:{folder:'Personal'}},
 ]) await api('/records','POST',row);
 const bank=await api('/accounts','POST',{name:'QA account',type:'Bank',opening:'1000'});
 await api('/transactions','POST',{kind:'income',accountId:bank.id,amount:'100.10',date:day,category:'Work',description:'QA income',key:randomUUID()});
 await api('/transactions','POST',{kind:'expense',accountId:bank.id,amount:'20.15',date:day,category:'Food',description:'QA expense',key:randomUUID()});
 const paths=['/','/calendar','/finance','/debts','/tools','/insights','/settings','/more',...modules.map(m=>'/records/'+m.key)];
 const sizes=[{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1366,height:900},{width:1920,height:1080}];
 let visited=0;const overflow:string[]=[];
 for(const size of (process.env.BENTO_INTERACTIONS_ONLY ? [] : sizes)){await page.setViewportSize(size);for(const path of paths){await page.goto(origin+path);await page.locator('.page-header, .empty').first().waitFor();await page.waitForLoadState("networkidle");if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))overflow.push(size.width+' '+path);visited++;}console.log('Checked '+size.width+'px '+paths.length+' routes');}
 assert.deepEqual(overflow,[],'overflow');
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.locator('.bottom-nav').getByRole('button',{name:'Quick Add',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'Task',exact:true}).click();await page.getByLabel('Judul / nama',{exact:true}).fill('Quick Add browser task');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Quick Add',{},{timeout:5000}).catch(async (e:unknown)=>{console.log('Focus debug',await page.evaluate(()=>({active:document.activeElement?.outerHTML,dialogs:[...document.querySelectorAll('[role=dialog]')].map(d=>d.getAttribute('data-state'))})));throw e;});assert.equal((await api('/records?kind=tasks&q=Quick%20Add%20browser')).total,1);
 // Exercise checklist controls in the real responsive Tasks UI.
 await page.goto(origin+'/records/tasks');
 const task=page.locator('.record-row').filter({hasText:'Browser checklist'});
 await task.locator('summary').click();await task.getByLabel('Browser check',{exact:true}).click();
 await page.waitForFunction(async()=>{const d=await fetch('/api/records?kind=tasks&q=Browser%20checklist').then(r=>r.json());return d.items[0]?.data.status==='Completed'&&d.items[0]?.data.progress===100;});
 await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('.task-checklist input')?.checked===true);
 await task.getByLabel('Browser check',{exact:true}).click();
 await page.waitForFunction(async()=>{const d=await fetch('/api/records?kind=tasks&q=Browser%20checklist').then(r=>r.json());return d.items[0]?.data.status==='In Progress'&&d.items[0]?.data.progress===0;});
 await page.goto(origin);
 await page.getByRole('button',{name:'Mulai fokus',exact:true}).click();
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Simpan sesi',exact:true}).click();
 await page.getByRole('button',{name:'Mulai fokus',exact:true}).waitFor();
 assert.equal((await api('/records?kind=timesheets')).items[0].data.kind,'Focus');
 await page.goto(origin+'/calendar');await page.locator('.calendar-agenda').waitFor();
 await page.getByRole('button',{name:'Bulan',exact:true}).click();
 await page.locator('.calendar-cell:not(.muted-day) .day-number').first().click();assert.equal(await page.locator('.calendar-cell:not(.muted-day) .day-number').first().getAttribute('aria-pressed'),'true');
 for(const name of ['Minggu','Hari','Agenda']){await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'calendar '+name);}
 const user=(await api('/auth/me')).user;
 await api('/preferences','PUT',{name:user.name,timezone:'Asia/Jakarta',theme:'light',maskMoney:true,widgets:['tasks','agenda','finance','career','notes']});
 await page.goto(origin+'/finance');await page.locator('.stat').first().waitFor();
 assert.match(await page.locator('.stat').first().innerText(),/••••••/);
 await page.goto(origin);await page.locator('.balance').waitFor();assert.equal((await page.locator('.balance').innerText()).trim(),'••••••');
 await api('/preferences','PUT',{name:user.name,timezone:'Asia/Jakarta',theme:'light',maskMoney:false,widgets:['tasks','agenda','finance','career','notes']});
 await page.reload();await page.locator('.balance').waitFor();
 assert.match(await page.locator('.balance').innerText(),/1[.,]079[,.]95/);
 await page.screenshot({path:'docs/bento-v3/mobile-light.png',fullPage:true});
 await page.setViewportSize({width:1366,height:900});await page.screenshot({path:'docs/bento-v3/desktop-light.png',fullPage:true});
 await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();await page.reload();await page.locator('.app.collapsed').waitFor();
 await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 const widgetCount=await page.locator('.home-bento>.panel').count();assert.ok(widgetCount>=10,'default dashboard widgets visible');await page.getByRole('button',{name:'Ganti tema',exact:true}).click();await page.waitForTimeout(400);const theme=await page.locator('html').getAttribute('class');await page.reload();await page.locator('.sidebar').waitFor({state:'attached'});await page.getByRole('button',{name:'Ganti tema',exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('class'),theme);assert.equal((await api('/auth/me')).user.preferences.theme,theme?.includes('dark')?'dark':'light');assert.equal(await page.locator('.home-bento>.panel').count(),widgetCount,'theme preserves dashboard widgets');
 await page.screenshot({path:join(storage,'mobile.png'),fullPage:true});await page.setViewportSize({width:1366,height:900});await page.screenshot({path:join(storage,'desktop.png'),fullPage:true});
 for(const width of [375,390,430,768,1366,1920]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'dark dashboard overflow '+width);}
 const a11yResults=[];
 for(const width of [375,390,430,768,1366]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:4371');await page.locator('.completion-card').waitFor();await page.waitForLoadState('networkidle');
  const top=await page.locator('.topbar').boundingBox();const heading=await page.getByRole('heading',{level:1}).boundingBox();assert.ok(heading!.y>=top!.y+top!.height,'heading below header');
  const trigger=width<=800?page.locator('.bottom-nav button'):page.locator('.desktop-quick');await trigger.click();await page.getByRole('dialog').waitFor();
  const dialog=await page.getByRole('dialog').boundingBox();assert.ok(dialog!.x>=-1&&dialog!.x+dialog!.width<=width+1&&dialog!.y>=0&&dialog!.y+dialog!.height<=901,'dialog fits');
  await page.keyboard.press('Tab');assert.ok(await page.getByRole('dialog').evaluate((el:any)=>el.contains(document.activeElement)),'keyboard focus inside dialog');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Quick Add'||document.activeElement?.classList.contains('desktop-quick'),{},{timeout:5000});assert.ok(await trigger.evaluate((el:any)=>el===document.activeElement),'focus restored');
  if(width<=800){for(const target of await page.locator('.bottom-nav>a,.bottom-nav>button').all()){const box=await target.boundingBox();assert.ok(box!.width>=44&&box!.height>=44,'mobile navigation touch target');}await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));const footer=await page.locator('.main-footer').boundingBox();const nav=await page.locator('.bottom-nav').boundingBox();assert.ok(footer!.y+footer!.height<nav!.y,'last content clears navigation');}
  a11yResults.push({width,dialog:'passed',keyboardFocus:'passed',headerOverlap:false,navigationClearance:'passed'});
 }
 await writeFile('docs/bento-v3/accessibility-results.json',JSON.stringify(a11yResults,null,2));
 await page.getByRole('button',{name:'Profile menu',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Masuk',exact:true}).waitFor();
 assert.deepEqual(errors,[],'browser runtime errors');const result={artifactHash:createHash('sha256').update(await readFile(join(distRoot,'index.html'))).digest('hex'),visited,sizes:sizes.map(s=>s.width),overflow,errors,quickAdd:'passed',themePersistence:'passed',checklistTransitions:'passed',focusTimesheet:'passed',privacyPreference:'passed',sidebarPersistence:'passed',logout:'passed',calendarViews:'passed',emptyDashboard:'passed',keyboardDialogs:'passed',storage};await writeFile('docs/bento-v3/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));await app.close();await pg.close();}
