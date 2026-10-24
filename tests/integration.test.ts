import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrate } from "../scripts/migrate";
import { makeApp, runAutomation } from "../apps/api/src/app";
import { hashPassword } from "../apps/api/src/auth";
import { catalog } from "../packages/shared/catalog";
import type { DB } from "../apps/api/src/db";
let pg: PGlite,
  db: DB,
  app: any,
  storage: string,
  cookie = "",
  csrf = "",
  otherCookie = "",
  otherCsrf = "";
const owner = randomUUID(),
  other = randomUUID();
const origin = "http://localhost:4173";
function adapter(p: any): DB {
  return {
    query: async (s: string, args?: any[]) => {
      if (!args && s.split(";").filter(Boolean).length > 1) {
        const results = await p.exec(s);
        return results.at(-1) || { rows: [] };
      }
      return p.query(s, args);
    },
    transaction: (fn) => p.transaction((tx: any) => fn(adapter(tx))),
  };
}
async function req(
  method: string,
  url: string,
  payload?: any,
  foreign = false,
) {
  return app.inject({
    method,
    url,
    payload,
    headers: {
      origin,
      cookie: foreign ? otherCookie : cookie,
      "x-csrf-token": foreign ? otherCsrf : csrf,
    },
  });
}
before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = adapter(pg);
  await migrate(db);
  storage = await mkdtemp(path.join(os.tmpdir(), "febro-test-"));
  const hash = await hashPassword("test-only-password-123");
  await db.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4),($5,$6,$7,$8)",
    [
      owner,
      "owner@example.test",
      "Owner",
      hash,
      other,
      "other@example.test",
      "Other",
      hash,
    ],
  );
  app = await makeApp(db, { origin, secure: false, storage });
  await app.ready();
  for (const foreign of [false, true]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin },
      payload: {
        email: foreign ? "other@example.test" : "owner@example.test",
        password: "test-only-password-123",
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    const c = r.headers["set-cookie"].split(";")[0];
    if (foreign) {
      otherCookie = c;
      otherCsrf = r.json().csrf;
    } else {
      cookie = c;
      csrf = r.json().csrf;
    }
  }
});
after(async () => {
  await app?.close();
  await pg?.close();
  if (storage) await rm(storage, { recursive: true, force: true });
});
test("migration repeat is idempotent", async () => {
  await migrate(db);
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM schema_migrations"))
      .rows[0].count,
    3,
  );
});
test("authentication, origin and CSRF controls", async () => {
  assert.equal(
    (await app.inject({ method: "GET", url: "/api/records" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin },
        payload: { email: "owner@example.test", password: "wrong" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/records",
        headers: { origin, cookie },
        payload: {},
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/records",
        headers: { origin: "https://evil.test", cookie, "x-csrf-token": csrf },
        payload: {},
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await req("GET", "/api/auth/me")).json().user.email,
    "owner@example.test",
  );
});
let note: any;
test("note CRUD, persistence, version conflict, archive restore", async () => {
  const a = await req("POST", "/api/records", {
    kind: "notes",
    title: "Persistent note",
    data: { content: "Hello", folder: "Personal" },
    tags: ["one"],
  });
  assert.equal(a.statusCode, 200, a.body);
  note = a.json();
  assert.equal(
    (await req("GET", "/api/records?kind=notes")).json().items[0].data.content,
    "Hello",
  );
  const b = await req("PUT", "/api/records/" + note.id, {
    ...note,
    title: "Updated",
  });
  assert.equal(b.statusCode, 200, b.body);
  assert.equal(
    (
      await req("PUT", "/api/records/" + note.id, {
        ...note,
        title: "Conflict",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await req("GET", "/api/records/" + note.id + "/versions")).json().length,
    1,
  );
  assert.equal(
    (await req("DELETE", "/api/records/" + note.id)).statusCode,
    200,
  );
  assert.equal(
    (await req("GET", "/api/records?kind=notes")).json().items.length,
    0,
  );
  assert.equal(
    (await req("POST", "/api/records/" + note.id + "/restore")).statusCode,
    200,
  );
});
test("owner isolation across records and versions", async () => {
  assert.equal(
    (await req("GET", "/api/records", undefined, true)).json().items.length,
    0,
  );
  assert.equal(
    (
      await req(
        "PUT",
        "/api/records/" + note.id,
        { ...note, title: "Intrusion" },
        true,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await req("GET", "/api/records/" + note.id + "/versions", undefined, true)
    ).json().length,
    0,
  );
  assert.equal(
    (await req("DELETE", "/api/records/" + note.id, undefined, true))
      .statusCode,
    400,
  );
});
test("all module forms validate and persist", async () => {
  for (const m of Object.values(catalog)) {
    const data: any = {};
    for (const f of m.fields) {
      if (f.type === "select") data[f.key] = f.options![0];
      if (f.required)
        data[f.key] =
          f.type === "datetime-local"
            ? "2026-10-23T10:00"
            : f.type === "url"
              ? "https://example.com"
              : f.type === "number"
                ? "100"
                : f.key === "month"
                  ? "2026-10"
                  : "Value";
    }
    if (m.key === "events") data.end = "2026-10-23T11:00";
    const r = await req("POST", "/api/records", {
      kind: m.key,
      title: "Module test " + m.key,
      tags: [],
      data,
    });
    assert.equal(r.statusCode, 200, m.key + ": " + r.body);
  }
});
test("task dependencies block completion; recurrence creates one next task", async () => {
  const dep = (
    await req("POST", "/api/records", {
      kind: "tasks",
      title: "Dependency",
      data: { status: "To Do" },
      tags: [],
    })
  ).json();
  const task = (
    await req("POST", "/api/records", {
      kind: "tasks",
      title: "Recurring task",
      data: {
        status: "To Do",
        due: "2026-10-23T10:00",
        recurrence: "Daily",
        dependencies: dep.id,
      },
      tags: [],
    })
  ).json();
  assert.equal(
    (
      await req("PUT", "/api/records/" + task.id, {
        ...task,
        data: { ...task.data, status: "Completed" },
      })
    ).statusCode,
    400,
  );
  await req("PUT", "/api/records/" + dep.id, {
    ...dep,
    data: { status: "Completed" },
  });
  const done = await req("PUT", "/api/records/" + task.id, {
    ...task,
    data: { ...task.data, status: "Completed" },
  });
  assert.equal(done.statusCode, 200, done.body);
  const all = (await req("GET", "/api/records?kind=tasks"))
    .json()
    .items.filter((r: any) => r.title === "Recurring task");
  assert.equal(all.length, 2);
  assert.equal(
    (
      await req("PUT", "/api/records/" + task.id, {
        ...task,
        data: { ...task.data, status: "Completed" },
      })
    ).statusCode,
    409,
  );
});
let a: string, b: string, txid: string, debt: string;
test("finance opening, expense, transfer, ledger invariant and replay", async () => {
  a = (
    await req("POST", "/api/accounts", {
      name: "Bank",
      type: "Bank",
      opening: "1000.00",
    })
  ).json().id;
  b = (
    await req("POST", "/api/accounts", {
      name: "Cash",
      type: "Cash",
      opening: "0",
    })
  ).json().id;
  const expense = {
    kind: "expense",
    accountId: a,
    amount: "0.10",
    category: "Food",
    date: "2026-10-23",
    description: "Test",
    key: randomUUID(),
  };
  const r = await req("POST", "/api/transactions", expense);
  assert.equal(r.statusCode, 200, r.body);
  txid = r.json().id;
  assert.equal(
    (await req("POST", "/api/transactions", expense)).json().id,
    txid,
  );
  assert.equal(
    (await req("POST", "/api/transactions", { ...expense, amount: "0.20" }))
      .statusCode,
    400,
  );
  const t = await req("POST", "/api/transactions", {
    kind: "transfer",
    accountId: a,
    toAccountId: b,
    amount: "200.20",
    date: "2026-10-23",
    key: randomUUID(),
  });
  assert.equal(t.statusCode, 200, t.body);
  const state = (await req("GET", "/api/finance")).json();
  assert.equal(state.accounts.find((r: any) => r.id === a).balance, "799.70");
  assert.equal(state.accounts.find((r: any) => r.id === b).balance, "200.20");
  assert.equal(
    state.transactions.filter((t: any) => t.kind === "income").length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM (SELECT transaction_id FROM ledger_postings GROUP BY transaction_id HAVING sum(amount)<>0) x",
      )
    ).rows[0].n,
    0,
  );
});
test("financial reversal restores balances and forbids double reversal", async () => {
  assert.equal(
    (await req("POST", "/api/transactions/" + txid + "/reverse")).statusCode,
    200,
  );
  assert.equal(
    (await req("POST", "/api/transactions/" + txid + "/reverse")).statusCode,
    400,
  );
  assert.equal(
    (await req("GET", "/api/finance"))
      .json()
      .accounts.find((x: any) => x.id === a).balance,
    "799.80",
  );
});
test("debt payments exactly once, interest, overpayment and reversal", async () => {
  const d = await req("POST", "/api/debts", {
    name: "Loan",
    principal: "500",
    apr: 12,
    months: 12,
    start: "2026-10-23",
    direction: "borrowed",
    model: "reducing",
    rates: [],
  });
  assert.equal(d.statusCode, 200, d.body);
  debt = d.json().id;
  const pay = {
    accountId: a,
    principal: "100",
    interest: "5",
    date: "2026-10-23",
    key: randomUUID(),
  };
  const r = await req("POST", "/api/debts/" + debt + "/pay", pay);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await req("POST", "/api/debts/" + debt + "/pay", pay)).json().id,
    r.json().id,
  );
  const state = (await req("GET", "/api/finance")).json();
  assert.equal(state.debts[0].paid, "100.00");
  assert.equal(state.accounts.find((x: any) => x.id === a).balance, "694.80");
  assert.equal(
    (
      await req("POST", "/api/debts/" + debt + "/pay", {
        ...pay,
        principal: "401",
        key: randomUUID(),
      })
    ).statusCode,
    400,
  );
  await req("POST", "/api/transactions/" + r.json().id + "/reverse");
  assert.equal((await req("GET", "/api/finance")).json().debts[0].paid, "0.00");
});
test("financial ownership and API validation", async () => {
  assert.equal(
    (
      await req(
        "POST",
        "/api/transactions",
        {
          kind: "expense",
          accountId: a,
          amount: "1",
          date: "2026-10-23",
          key: randomUUID(),
        },
        true,
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (await req("GET", "/api/finance", undefined, true)).json().accounts.length,
    0,
  );
  assert.equal(
    (
      await req("POST", "/api/transactions", {
        kind: "expense",
        accountId: a,
        amount: "1.001",
        date: "bad",
        key: randomUUID(),
      })
    ).statusCode,
    400,
  );
});
test("training certificate evidence and cross-owner link integrity", async () => {
  const t = (
    await req("POST", "/api/records", {
      kind: "trainings",
      title: "Training",
      tags: [],
      data: { hours: 4, status: "Completed" },
    })
  ).json();
  const c = (
    await req("POST", "/api/records", {
      kind: "certificates",
      title: "Certificate",
      tags: [],
      data: { expiry: "2026-10-25", reminderDays: 30 },
    })
  ).json();
  assert.equal(
    (
      await req("POST", "/api/links", {
        sourceId: t.id,
        targetId: c.id,
        relation: "evidence",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await req(
        "POST",
        "/api/links",
        { sourceId: t.id, targetId: c.id, relation: "intrusion" },
        true,
      )
    ).statusCode,
    409,
  );
  await runAutomation(db, new Date("2026-10-23"));
  const n = (await req("GET", "/api/notifications")).json();
  assert.ok(n.some((x: any) => x.record_id === c.id));
});
function multipart(
  file: Buffer,
  name = "certificate.pdf",
  mime = "application/pdf",
) {
  const boundary = "FebroTestBoundary";
  return {
    boundary,
    body: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`,
      ),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
test("certificate upload magic validation, private download and deletion", async () => {
  const m = multipart(Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"));
  const r = await app.inject({
    method: "POST",
    url: "/api/files/" + note.id,
    headers: {
      origin,
      cookie,
      "x-csrf-token": csrf,
      "content-type": "multipart/form-data; boundary=" + m.boundary,
    },
    payload: m.body,
  });
  assert.equal(r.statusCode, 200, r.body);
  const fid = r.json().id;
  assert.equal((await req("GET", "/api/files/" + fid)).statusCode, 200);
  assert.equal(
    (await req("GET", "/api/files/" + fid, undefined, true)).statusCode,
    404,
  );
  const evil = multipart(Buffer.from("<script>alert(1)</script>"));
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/files/" + note.id,
        headers: {
          origin,
          cookie,
          "x-csrf-token": csrf,
          "content-type": "multipart/form-data; boundary=" + evil.boundary,
        },
        payload: evil.body,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await req("DELETE", "/api/files/" + fid, undefined, true)).statusCode,
    400,
  );
  assert.equal((await req("DELETE", "/api/files/" + fid)).statusCode, 200);
});
test("automation scheduled task runs once", async () => {
  await req("POST", "/api/records", {
    kind: "automations",
    title: "Scheduled action",
    tags: [],
    data: {
      due: "2020-01-01T00:00",
      action: "Create task",
      repeat: "None",
      enabled: true,
    },
  });
  await runAutomation(db);
  await runAutomation(db);
  assert.equal(
    (await req("GET", "/api/records?kind=tasks"))
      .json()
      .items.filter((r: any) => r.title === "Scheduled action").length,
    1,
  );
});
test("AI unconfigured setup and authenticated export", async () => {
  assert.equal((await req("GET", "/api/ai/status")).json().configured, false);
  assert.equal(
    (await req("POST", "/api/ai", { prompt: "Hello", consent: true }))
      .statusCode,
    400,
  );
  assert.equal((await req("GET", "/api/export")).json().format, "febro-one-v1");
});

test('batch import is atomic and replay-safe', async () => {
  const row = {kind:'income',accountId:a,amount:'10.00',category:'Import',date:'2026-10-23',description:'batch test',key:randomUUID()};
  const before = (await req('GET','/api/finance')).json();
  const bad = await req('POST','/api/transactions/import',{rows:[row,{...row,accountId:randomUUID(),key:randomUUID()}]});
  assert.notEqual(bad.statusCode,200);
  assert.deepEqual((await req('GET','/api/finance')).json().accounts,before.accounts);
  const good = await req('POST','/api/transactions/import',{rows:[row]});
  assert.equal(good.statusCode,200,good.body);
  const once = (await req('GET','/api/finance')).json().accounts;
  assert.equal((await req('POST','/api/transactions/import',{rows:[row]})).statusCode,200);
  assert.deepEqual((await req('GET','/api/finance')).json().accounts,once);
});

test('v1.1 checklist CRUD, transitions, relationships, parent cycles and restart persistence',async()=>{
 const company=(await req('POST','/api/records',{kind:'companies',title:'Linked Company',data:{}})).json();
 const category=(await req('POST','/api/records',{kind:'categories',title:'Linked Category',data:{}})).json();
 const project=(await req('POST','/api/records',{kind:'projects',title:'Linked Project',data:{}})).json();
 const create=await req('POST','/api/records',{kind:'tasks',title:'Checklist regression',data:{status:'Completed',checklist:[{id:'a',text:'First',checked:false},{id:'b',text:'Second',checked:false}],companyId:company.id,categoryId:category.id,projectId:project.id}});
 assert.equal(create.statusCode,200,create.body);let row=create.json();assert.equal(row.data.status,'To Do');assert.equal(row.data.progress,0);
 const save=async(data:any)=>{const response=await req('PUT','/api/records/'+row.id,{...row,data:{...row.data,...data}});assert.equal(response.statusCode,200,response.body);row=response.json();};
 await save({checklist:row.data.checklist.map((i:any)=>({...i,checked:i.id==='a'}))});assert.equal(row.data.status,'In Progress');assert.equal(row.data.progress,50);
 await save({checklist:row.data.checklist.map((i:any)=>({...i,checked:true}))});assert.equal(row.data.status,'Completed');assert.equal(row.data.progress,100);
 await save({checklist:[{...row.data.checklist[1],checked:false},{...row.data.checklist[0],text:'Edited'}]});assert.equal(row.data.status,'In Progress');assert.equal(row.data.checklist[0].id,'b');
 await save({checklist:[row.data.checklist[0]]});assert.equal(row.data.status,'In Progress');
 await save({checklist:[],status:'On Hold'});assert.equal(row.data.status,'On Hold');
 const columns=(await db.query('SELECT company_id,category_id,project_id FROM records WHERE id=$1',[row.id])).rows[0];assert.deepEqual(columns,{company_id:company.id,category_id:category.id,project_id:project.id});
 assert.equal((await req('POST','/api/records',{kind:'tasks',title:'Foreign reference',data:{companyId:company.id}},true)).statusCode,400);
 assert.equal((await req('POST','/api/records',{kind:'tasks',title:'Wrong kind',data:{companyId:category.id}})).statusCode,400);
 for(const kind of ['work','employments','trainings','certificates']){const response=await req('POST','/api/records',{kind,title:'Relation '+kind,data:{companyId:company.id,categoryId:category.id,projectId:project.id}});assert.equal(response.statusCode,200,response.body);}
 const child=(await req('POST','/api/records',{kind:'tasks',title:'Child task',data:{parent:row.id}})).json();
 assert.equal((await req('PUT','/api/records/'+row.id,{...row,data:{...row.data,parent:child.id}})).statusCode,400);
 assert.equal((await req('PUT','/api/records/'+row.id,{...row,data:{...row.data,parent:row.id}})).statusCode,400);
 assert.equal((await req('PATCH','/api/preferences/workspace',{expandedCategories:['Workspace']})).statusCode,200);
 await app.close(); app=await makeApp(db,{origin,secure:false,storage});
 assert.deepEqual((await req('GET','/api/auth/me')).json().user.preferences.expandedCategories,['Workspace']);
 const persisted=(await req('GET','/api/records?kind=tasks')).json().items.find((r:any)=>r.id===row.id);assert.equal(persisted.data.companyId,company.id);assert.equal(persisted.data.status,'On Hold');
 assert.equal((await req('DELETE','/api/records/'+row.id)).statusCode,200);
 assert.equal((await req('POST','/api/records/'+row.id+'/restore')).statusCode,200);
});

test('v1.1 subscriptions, recurring scheduler, delivery deduplication and expired devices',async()=>{
 const {runPush,pushKeys}=await import('../apps/api/src/push');const webpush=(await import('web-push')).default;
 const publicKeys=await req('GET','/api/push');assert.equal(publicKeys.statusCode,200);assert.ok(publicKeys.json().publicKey);assert.equal(publicKeys.json().privateKey,undefined);
 const vapid=webpush.generateVAPIDKeys();
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/regression',keys:{p256dh:vapid.publicKey,auth:'AAAAAAAAAAAAAAAAAAAAAA'}};
 assert.equal((await req('POST','/api/push',{subscription:{...sub,endpoint:'https://127.0.0.1/private'},label:'Invalid'})).statusCode,400);
 assert.equal((await req('POST','/api/push',{subscription:sub,label:'Regression device'})).statusCode,200);
 assert.equal((await req('POST','/api/push',{subscription:sub,label:'Stolen device'},true)).statusCode,409);
 const devices=(await req('GET','/api/push')).json().devices;const device=devices.find((d:any)=>d.label==='Regression device');
 assert.equal((await req('DELETE','/api/push/'+device.id,undefined,true)).statusCode,200);
 assert.ok((await req('GET','/api/push')).json().devices.some((d:any)=>d.id===device.id));
 const at=new Date(Date.now()+120000);const response=await req('POST','/api/records',{kind:'tasks',title:'Scheduled task',data:{reminder:at.toISOString(),reminderRepeat:'Daily'}});assert.equal(response.statusCode,200,response.body);const row=response.json();
 let sends=0;const send:any=async()=>{sends++;return {statusCode:201,body:'',headers:{}};};
 await runPush(db,at,send);const first=sends;assert.ok(first>0);await runPush(db,at,send);assert.equal(sends,first);
 const retryId='retry:'+randomUUID();
 await db.query('INSERT INTO notifications(id,owner_id,title) VALUES($1,$2,$3)',[retryId,owner,'Retry regression']);
 await runPush(db,at,async()=>{throw Object.assign(new Error('temporary'),{statusCode:503})});
 assert.equal((await db.query('SELECT status FROM push_deliveries WHERE notification_id=$1',[retryId])).rows[0].status,'failed');
 await runPush(db,at,send);assert.equal(sends,first);
 await db.query("UPDATE push_deliveries SET claimed_at=now()-interval '6 minutes' WHERE notification_id=$1",[retryId]);
 await runPush(db,at,send);assert.equal(sends,first+1);
 assert.equal((await db.query('SELECT status FROM push_deliveries WHERE notification_id=$1',[retryId])).rows[0].status,'sent');
 const reminder=(await db.query('SELECT reminder_at FROM records WHERE id=$1',[row.id])).rows[0];assert.ok(new Date(reminder.reminder_at)>at);
 const notifications=(await db.query("SELECT * FROM notifications WHERE record_id=$1 AND id LIKE 'reminder:%'",[row.id])).rows;assert.equal(notifications.length,1);
 await runPush(db,new Date(at.getTime()+86400000),async()=>{throw Object.assign(new Error('expired'),{statusCode:410})});
 assert.equal((await db.query('SELECT id FROM push_subscriptions WHERE id=$1',[device.id])).rows.length,0);
 assert.ok((await pushKeys(db)).private_key);
});

 test('server table pagination searches tags and filters relationships with stable sorting',async()=>{
 const company=(await req('POST','/api/records',{kind:'companies',title:'Page master',data:{}})).json();
 for(const title of ['Page C','Page A','Page B'])assert.equal((await req('POST','/api/records',{kind:'tasks',title,tags:['pagination-token'],data:{companyId:company.id,status:'To Do'}})).statusCode,200);
 const base='/api/records?kind=tasks&q=pagination-token&sort=title&limit=2&status=To%20Do&related='+company.id;
 const first=(await req('GET',base)).json();assert.equal(first.total,3);assert.deepEqual(first.items.map((r:any)=>r.title),['Page A','Page B']);
 const second=(await req('GET',base+'&offset=2')).json();assert.equal(second.total,3);assert.deepEqual(second.items.map((r:any)=>r.title),['Page C']);
 });


test('Bento V2: priority filtering, company project integrity, preferences and sessions',async()=>{
 const company=(await req('POST','/api/records',{kind:'companies',title:'Bento Company',data:{}})).json();
 const otherCompany=(await req('POST','/api/records',{kind:'companies',title:'Another Company',data:{}})).json();
 const project=(await req('POST','/api/records',{kind:'projects',title:'Bento Project',data:{companyId:company.id}})).json();
 assert.equal((await req('POST','/api/records',{kind:'tasks',title:'Wrong company',data:{companyId:otherCompany.id,projectId:project.id}})).statusCode,400);
 let row=(await req('POST','/api/records',{kind:'tasks',title:'Bento persisted task',data:{companyId:company.id,projectId:project.id,priority:'Urgent',checklist:[{id:'a',text:'Only item',checked:false}]}})).json();
 assert.equal(row.data.status,'To Do');
 for(const checked of [true,false]){const response=await req('PUT','/api/records/'+row.id,{...row,data:{...row.data,checklist:[{...row.data.checklist[0],checked}]}});assert.equal(response.statusCode,200,response.body);row=response.json();assert.equal(row.data.status,checked?'Completed':'In Progress');}
 const urgent=await req('GET','/api/records?kind=tasks&priority=Urgent&related='+company.id);assert.equal(urgent.json().total,1);assert.equal(urgent.json().items[0].id,row.id);
 assert.equal((await req('GET','/api/records?priority=Invalid')).statusCode,400);
 assert.equal((await req('PUT','/api/preferences',{name:'Owner',timezone:'Asia/Jakarta',theme:'dark',maskMoney:false,widgets:['tasks','projects','goals']})).statusCode,200);
 assert.equal((await req('GET','/api/auth/me')).json().user.preferences.theme,'dark');
 const sessions=await req('GET','/api/auth/sessions');assert.equal(sessions.statusCode,200);assert.ok(sessions.json().items.some((s:any)=>s.current));assert.equal(sessions.json().items[0].id,undefined);assert.equal(sessions.json().items[0].csrf,undefined);
 assert.equal((await req('POST','/api/auth/sessions/revoke-others',{})).statusCode,200);
 assert.equal((await req('GET','/api/auth/me')).statusCode,200);
 assert.equal((await req('GET','/api/auth/me',undefined,true)).statusCode,200);
});

test('V1.2 checklist protected statuses, conflicts, trash separation and ownership',async()=>{
 let row=(await req('POST','/api/records',{kind:'tasks',title:'V12 checklist',data:{status:'To Do',checklist:[{id:'first',text:'First',checked:false}]}})).json();
 const save=async(data:any)=>{const r=await req('PUT','/api/records/'+row.id,{...row,data:{...row.data,...data}});assert.equal(r.statusCode,200,r.body);row=r.json();};
 const stale={...row};
 await save({checklist:[{id:'first',text:'First',checked:true}]});assert.equal(row.data.status,'Completed');
 await save({checklist:[...row.data.checklist,{id:'next',text:'Next',checked:false}]});assert.equal(row.data.status,'In Progress');assert.equal(row.data.progress,50);
 assert.equal((await req('PUT','/api/records/'+row.id,stale)).statusCode,409);
 for(const status of ['On Hold','Cancelled']){await save({status});await save({checklist:row.data.checklist.map((i:any)=>({...i,checked:true}))});assert.equal(row.data.status,status);assert.equal(row.data.progress,100);await save({checklist:row.data.checklist.map((i:any)=>({...i,checked:false}))});assert.equal(row.data.status,status);}
 assert.equal((await req('GET','/api/records/'+row.id,undefined,true)).statusCode,404);
 assert.equal((await req('POST','/api/records/'+row.id+'/trash',{},true)).statusCode,404);
 const fetched=await req('GET','/api/records/'+row.id);assert.equal(fetched.json().data.status,'Cancelled');
 await req('POST','/api/records/'+row.id+'/trash',{});
 assert.equal((await req('GET','/api/records?kind=tasks&q=V12%20checklist')).json().total,0);
 assert.equal((await req('GET','/api/records?kind=tasks&archived=true&q=V12%20checklist')).json().total,0);
 assert.equal((await req('GET','/api/records?kind=tasks&trash=true&q=V12%20checklist')).json().total,1);
 assert.equal((await req('DELETE','/api/records/'+row.id+'/permanent',{confirmation:row.title})).statusCode,409);
 row=(await req('POST','/api/records/'+row.id+'/restore',{})).json();assert.equal(row.deletedAt,null);assert.equal(row.archivedAt,null);
 assert.equal((await req('GET','/api/records?kind=tasks&q=V12%20checklist')).json().statusCounts[0].count,1);
 const zero=(await req('POST','/api/records',{kind:'tasks',title:'Zero checklist',data:{status:'Inbox',checklist:[]}})).json();assert.equal(zero.data.status,'Inbox');
 const purge=(await req('POST','/api/records',{kind:'notes',title:'Unlinked purge fixture',data:{}})).json();await req('POST','/api/records/'+purge.id+'/trash',{});
 await db.query("UPDATE records SET deleted_at=now()-interval '31 days' WHERE id=$1",[purge.id]);
 assert.equal((await req('DELETE','/api/records/'+purge.id+'/permanent',{confirmation:'wrong'})).statusCode,409);
 const purged=await req('DELETE','/api/records/'+purge.id+'/permanent',{confirmation:purge.title});assert.equal(purged.statusCode,200,purged.body);assert.equal((await req('GET','/api/records/'+purge.id)).statusCode,404);
});

test('V1.2 archived master IDs remain editable without permitting a project-company mismatch',async()=>{
 const company=(await req('POST','/api/records',{kind:'companies',title:'Archive-safe company',data:{}})).json();
 const otherCompany=(await req('POST','/api/records',{kind:'companies',title:'Different company',data:{}})).json();
 const project=(await req('POST','/api/records',{kind:'projects',title:'Archive-safe project',data:{companyId:company.id}})).json();
 let task=(await req('POST','/api/records',{kind:'tasks',title:'Retain archived IDs',data:{companyId:company.id,projectId:project.id}})).json();
 await req('DELETE','/api/records/'+company.id);await req('DELETE','/api/records/'+project.id);
 const saved=await req('PUT','/api/records/'+task.id,{...task,title:'Edited with archived masters'});assert.equal(saved.statusCode,200,saved.body);task=saved.json();
 assert.equal(task.data.companyId,company.id);assert.equal(task.data.projectId,project.id);
 assert.equal((await req('PUT','/api/records/'+task.id,{...task,data:{...task.data,companyId:otherCompany.id}})).statusCode,400);
 assert.equal((await req('POST','/api/records',{kind:'tasks',title:'No new links to archived masters',data:{companyId:company.id}})).statusCode,400);
});
