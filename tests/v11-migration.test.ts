import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {migrate} from '../scripts/migrate';
import type {DB} from '../apps/api/src/db';
test('v1.0 records migrate to reusable owner-specific IDs without losing legacy data',async()=>{
 const pg=new PGlite();await pg.waitReady;
 function adapter(p:any):DB{return {query:async(s,args)=>!args&&s.split(';').filter(Boolean).length>1?(await p.exec(s)).at(-1):p.query(s,args),transaction:fn=>p.transaction((tx:any)=>fn(adapter(tx)))}}
 const db=adapter(pg);
 try{
  const initial=await readFile('packages/db/migrations/001_initial.sql','utf8');await db.query(initial);
  await db.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',['001_initial.sql',createHash('sha256').update(initial).digest('hex')]);
  const owners=[randomUUID(),randomUUID()];const ids:string[]=[];
  for(const owner of owners){await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[owner,owner+'@test.example','Migration test','!']);for(const kind of ['tasks','work','employments','trainings','certificates']){const id=randomUUID();ids.push(id);await db.query('INSERT INTO records(id,owner_id,kind,title,data) VALUES($1,$2,$3,$4,$5)',[id,owner,kind,'Legacy record',JSON.stringify({company:'Shared name',category:'Learning',project:'Upgrade',description:'Keep me',...(kind==='tasks'?{checklist:'[x] Legacy done\n[ ] Legacy next'}:{})})]);}}
  await migrate(db);await migrate(db);
  for(const id of ids){const r=(await db.query('SELECT * FROM records WHERE id=$1',[id])).rows[0];assert.equal(r.data.description,'Keep me');assert.equal(r.data.company,'Shared name');assert.equal(r.version,1);assert.equal(r.company_id,r.data.companyId);assert.ok(r.category_id);assert.ok(r.project_id);const company=(await db.query('SELECT * FROM records WHERE id=$1',[r.company_id])).rows[0];assert.equal(company.owner_id,r.owner_id);assert.equal(company.kind,'companies');}
  assert.equal((await db.query("SELECT count(*)::int n FROM records WHERE kind='companies'")).rows[0].n,2);
 }finally{await pg.close();}
});
