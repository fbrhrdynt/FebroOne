// Isolated browser verification: PGlite data never touches production PostgreSQL.
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { migrate } from './migrate';
import { makeApp } from '../apps/api/src/app';
import { hashPassword } from '../apps/api/src/auth';
import { modules } from '../packages/shared/catalog';
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
 const company=await api('/records','POST',{kind:'companies',title:'Browser company',data:{}});
 const project=await api('/records','POST',{kind:'projects',title:'Browser project',data:{companyId:company.id}});
 await api('/records','POST',{kind:'tasks',title:'Browser checklist',data:{companyId:company.id,projectId:project.id,priority:'High',checklist:[{id:'a',text:'Browser check',checked:false}]}});
 const paths=['/','/calendar','/finance','/debts','/tools','/insights','/settings','/more',...modules.map(m=>'/records/'+m.key)];
 const sizes=[{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1366,height:900},{width:1920,height:1080}];
 let visited=0;const overflow:string[]=[];
 for(const size of sizes){await page.setViewportSize(size);for(const path of paths){await page.goto(origin+path);await page.locator('.page-header, .empty').first().waitFor();await page.waitForTimeout(60);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))overflow.push(size.width+' '+path);visited++;}console.log('Checked '+size.width+'px '+paths.length+' routes');}
 assert.deepEqual(overflow,[],'overflow');
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.locator('.bottom-nav').getByRole('button',{name:'Quick Add',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'Task',exact:true}).click();await page.getByLabel('Judul / nama',{exact:true}).fill('Quick Add browser task');await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await api('/records?kind=tasks&q=Quick%20Add%20browser')).total,1);
 const widgetCount=await page.locator('.home-bento>.panel').count();assert.ok(widgetCount>=10,'default dashboard widgets visible');await page.getByRole('button',{name:'Ganti tema',exact:true}).click();await page.waitForTimeout(400);const theme=await page.locator('html').getAttribute('class');await page.reload();await page.locator('.sidebar').waitFor({state:'attached'});await page.getByRole('button',{name:'Ganti tema',exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('class'),theme);assert.equal((await api('/auth/me')).user.preferences.theme,theme?.includes('dark')?'dark':'light');assert.equal(await page.locator('.home-bento>.panel').count(),widgetCount,'theme preserves dashboard widgets');
 await page.screenshot({path:join(storage,'mobile.png'),fullPage:true});await page.setViewportSize({width:1366,height:900});await page.screenshot({path:join(storage,'desktop.png'),fullPage:true});
 assert.deepEqual(errors,[],'browser runtime errors');const result={visited,sizes:sizes.map(s=>s.width),overflow,errors,quickAdd:'passed',themePersistence:'passed',storage};await writeFile('/tmp/febro-bento-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));await app.close();await pg.close();}
