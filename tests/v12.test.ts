import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord} from '../packages/shared/domain';
test('V1.2 checklist automation matrix preserves holds and cancellations',()=>{
 for(const status of ['Inbox','To Do','In Progress','Completed','Cancelled','On Hold']){
  for(const checks of [[],[false],[true],[true,false]]){
   const row=validateRecord({kind:'tasks',title:'Matrix',version:2,data:{status,checklist:checks.map((checked,i)=>({id:String(i),text:' Item ',checked}))}});
   if(['Cancelled','On Hold'].includes(status))assert.equal(row.data.status,status);
   else if(checks.length && checks.every(Boolean))assert.equal(row.data.status,'Completed');
   else if(checks.length && (checks.some(Boolean)||['Completed','In Progress'].includes(status)))assert.equal(row.data.status,'In Progress');
   else if(status==='Completed'&&!checks.length)assert.equal(row.data.status,'Completed');
   else assert.notEqual(row.data.status,'Completed');
  }
 }
});

test('V1.2 service worker opens same-origin notification deep links and rejects external destinations',async()=>{
 const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');const handlers:any={};let destination='';let pending:Promise<any>=Promise.resolve();
 const self={addEventListener:(key:string,fn:any)=>handlers[key]=fn};
 const clients={matchAll:async()=>[],openWindow:async(url:string)=>{destination=url;}};
 vm.runInNewContext(await readFile('apps/web/public/sw.js','utf8'),{self,clients,URL,location:{origin:'https://one.febro.id'}});
 for(const [url,expected] of [['/records/tasks/123','/records/tasks/123'],['https://evil.example/phishing','/']]){
 handlers.notificationclick({notification:{data:{url},close(){}},waitUntil:(p:Promise<any>)=>pending=p});await pending;assert.equal(destination,expected);
 }
});
