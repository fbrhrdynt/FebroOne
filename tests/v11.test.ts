import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {checklistItems,validateRecord,zonedInstant,zonedInput,nextZonedReminder} from '../packages/shared/domain';
test('legacy checklists preserve text and checks; statuses are derived',()=>{
 const legacy=checklistItems('[x] Done\n[ ] Next');assert.equal(legacy[0].checked,true);assert.equal(legacy[1].text,'Next');
 const r=validateRecord({kind:'tasks',title:'Legacy',data:{checklist:'[x] Done\n[ ] Next'}});assert.equal(r.data.progress,50);assert.equal(r.data.status,'In Progress');
 assert.throws(()=>validateRecord({kind:'tasks',title:'Invalid',data:{checklist:[{id:'a',text:'',checked:false}]}}));
});
test('user timezone and recurring local clock including DST',()=>{
 assert.equal(zonedInstant('2026-10-23T09:00','Asia/Jakarta'),'2026-10-23T02:00:00.000Z');
 assert.equal(zonedInput('2026-10-23T02:00:00Z','Asia/Jakarta'),'2026-10-23T09:00');
 assert.equal(nextZonedReminder('2026-03-07T14:00:00Z','Daily','America/New_York'),'2026-03-08T13:00:00.000Z');
});
test('PWA manifest, PNG icons, private API exclusion and push handlers',async()=>{
 const manifest=JSON.parse(await readFile('apps/web/public/manifest.webmanifest','utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');
 for(const size of [192,512]){const icon=manifest.icons.find((i:any)=>i.sizes===`${size}x${size}`);assert.ok(icon);const png=await readFile('apps/web/public'+icon.src);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
 const handlers:any={};const self={addEventListener:(name:string,fn:any)=>handlers[name]=fn};
 vm.runInNewContext(await readFile('apps/web/public/sw.js','utf8'),{self,URL,location:{origin:'https://one.febro.id'}});
 let handled=false;for(const pathname of ['/api/records','/api/files/private','/api/push'])handlers.fetch({request:{method:'GET',url:'https://one.febro.id'+pathname},respondWith:()=>handled=true});assert.equal(handled,false);assert.equal(typeof handlers.push,'function');assert.equal(typeof handlers.notificationclick,'function');
});
