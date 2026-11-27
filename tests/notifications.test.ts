import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrate } from "../scripts/migrate";
import { makeApp } from "../apps/api/src/app";
import { hashPassword } from "../apps/api/src/auth";
import type { DB } from "../apps/api/src/db";

const origin = "http://localhost:4173";
const owner = randomUUID();
let pg: PGlite, db: DB, app: any, storage: string, cookie = "", csrf = "";

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
const req = (method: string, url: string, payload?: any) =>
  app.inject({ method, url, payload, headers: { origin, cookie, "x-csrf-token": csrf } });
const note = (id: string, title: string, recordId: string | null = null) =>
  db.query("INSERT INTO notifications(id,owner_id,title,record_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [id, owner, title, recordId]);
const feed = async (status = "all") => (await req("GET", `/api/notifications?status=${status}`)).json();

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = adapter(pg);
  await migrate(db);
  storage = await mkdtemp(path.join(os.tmpdir(), "febro-notif-"));
  await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)", [owner, "n@example.test", "N", await hashPassword("notif-password-123")]);
  app = await makeApp(db, { origin, storage, secure: false });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "n@example.test", password: "notif-password-123" }, headers: { origin } });
  cookie = String(r.headers["set-cookie"]).split(";")[0];
  csrf = r.json().csrf;
});
after(async () => {
  await app.close();
  await pg.close();
  await rm(storage, { recursive: true, force: true });
});

test("notifications can be read, unread, read in bulk and dismissed for good", async () => {
  await note("reminder:a:1", "Reminder A");
  await note("rule:b:1", "Rule B");
  await note("debt-due:c:2026-11", "Debt C");
  let all = await feed();
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((n: any) => n.kind).sort(), ["automation", "debt", "reminder"]);

  await req("POST", "/api/notifications/reminder%3Aa%3A1/read");
  assert.equal((await feed("unread")).length, 2);
  await req("POST", "/api/notifications/reminder%3Aa%3A1/unread");
  assert.equal((await feed("unread")).length, 3);

  const bulk = (await req("POST", "/api/notifications/read-all")).json();
  assert.equal(bulk.count, 3);
  assert.equal((await feed("unread")).length, 0);

  await req("POST", "/api/notifications/rule%3Ab%3A1/dismiss");
  await note("rule:b:1", "Rule B"); // the scheduler re-inserts by id every minute
  all = await feed();
  assert.equal(all.length, 2, "a dismissed notification does not come back");

  const cleared = (await req("POST", "/api/notifications/clear-read")).json();
  assert.equal(cleared.count, 2);
  assert.equal((await feed()).length, 0);
});

test("paying an instalment or completing a task resolves its notification", async () => {
  const debt = (await req("POST", "/api/debts", { name: "Card", monthlyPayment: "100000", dueDay: 5, repaymentStart: "2026-10", installmentCount: 6 })).json();
  await note(`debt-due:${debt.id}:2026-11`, "Pembayaran terlambat: Card");
  const task = (await req("POST", "/api/records", { kind: "tasks", title: "Kirim invoice", data: { status: "To Do" } })).json();
  await note(`${task.id}:2026-11-20T10:00:00.000Z`, "Kirim invoice", task.id);
  assert.equal((await feed("unread")).length, 2);

  assert.equal((await req("POST", "/api/debt-installments", { debtId: debt.id, periods: ["2026-11"], amount: "100000", paid: true })).statusCode, 200);
  await req("PUT", `/api/records/${task.id}`, { ...task, data: { ...task.data, status: "Completed" } });
  assert.equal((await feed("unread")).length, 0);
});

test("audit view pages through the latest 300 events only, with search", async () => {
  await db.query(
    "INSERT INTO audit_logs(owner_id,action,entity_id,created_at) SELECT $1, CASE WHEN g%2=0 THEN 'record.update' ELSE 'auth.login' END, NULL, now() - g * interval '1 minute' FROM generate_series(1,420) g",
    [owner],
  );
  const first = (await req("GET", "/api/audit?page=0&size=50")).json();
  assert.equal(first.total, 300);
  assert.equal(first.items.length, 50);
  const last = (await req("GET", "/api/audit?page=5&size=50")).json();
  assert.equal(last.items.length, 50);
  const beyond = (await req("GET", "/api/audit?page=6&size=50")).json();
  assert.equal(beyond.items.length, 0);
  const search = (await req("GET", "/api/audit?q=auth.login&size=100")).json();
  assert.ok(search.total > 0 && search.total <= 300);
  assert.ok(search.items.every((r: any) => r.action === "auth.login"));
  assert.ok(new Date(first.items[0].created_at) >= new Date(first.items[49].created_at), "newest first");
});
