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
let pg: PGlite, db: DB, app: any, storage: string;
const sessions: Record<string, { cookie: string; csrf: string }> = {};

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
async function req(who: string, method: string, url: string, payload?: any) {
  const s = sessions[who];
  return app.inject({ method, url, payload, headers: { origin, cookie: s.cookie, "x-csrf-token": s.csrf } });
}
async function login(who: string, email: string) {
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "relations-password-1" }, headers: { origin } });
  assert.equal(r.statusCode, 200);
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  sessions[who] = { cookie, csrf: r.json().csrf };
}
async function create(who: string, kind: string, title: string, data: Record<string, unknown> = {}) {
  const r = await req(who, "POST", "/api/records", { kind, title, data });
  assert.equal(r.statusCode, 200, r.body);
  return r.json();
}

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = adapter(pg);
  await migrate(db);
  storage = await mkdtemp(path.join(os.tmpdir(), "febro-rel-"));
  const hash = await hashPassword("relations-password-1");
  for (const [email, name] of [["me@example.test", "Me"], ["other@example.test", "Other"]])
    await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)", [randomUUID(), email, name, hash]);
  app = await makeApp(db, { origin, storage, secure: false });
  await login("me", "me@example.test");
  await login("other", "other@example.test");
});
after(async () => {
  await app.close();
  await pg.close();
  await rm(storage, { recursive: true, force: true });
});

test("a company hub gathers its projects, tasks, links and the money spent on them", async () => {
  const company = await create("me", "companies", "Acme");
  const project = await create("me", "projects", "Website", { companyId: company.id, status: "In Progress" });
  const task = await create("me", "tasks", "Draft homepage", { companyId: company.id, projectId: project.id, status: "To Do" });
  const note = await create("me", "notes", "Kickoff notes");
  assert.equal((await req("me", "POST", "/api/links", { sourceId: note.id, targetId: company.id, relation: "related" })).statusCode, 200);

  const account = (await req("me", "POST", "/api/accounts", { name: "Bank", type: "Bank", opening: "1000000.00" })).json();
  const spend = await req("me", "POST", "/api/transactions", {
    kind: "expense", accountId: account.id, amount: "250000.00", category: "Hosting",
    date: "2026-11-20", description: "Server", key: randomUUID(), recordId: project.id,
  });
  assert.equal(spend.statusCode, 200, spend.body);

  const hub = (await req("me", "GET", `/api/records/${company.id}/related`)).json();
  assert.deepEqual(hub.children.map((r: any) => r.title).sort(), ["Draft homepage", "Website"]);
  assert.equal(hub.links.length, 1);
  assert.equal(hub.links[0].direction, "in");
  assert.equal(hub.links[0].record.title, "Kickoff notes");
  assert.equal(hub.transactions.length, 1, "money spent on a child project rolls up to the company");
  assert.equal(hub.transactions[0].amount, "250000.00");

  const taskView = (await req("me", "GET", `/api/records/${task.id}/related`)).json();
  assert.deepEqual(taskView.references.map((r: any) => r.title).sort(), ["Acme", "Website"]);

  const finance = (await req("me", "GET", "/api/finance")).json();
  assert.equal(finance.transactions.find((t: any) => t.description === "Server").recordId, project.id);

  assert.equal((await req("me", "DELETE", "/api/links", { sourceId: note.id, targetId: company.id, relation: "related" })).statusCode, 200);
  assert.equal((await req("me", "GET", `/api/records/${company.id}/related`)).json().links.length, 0);
});

test("transactions can be re-linked or unlinked, but never to another owner's record", async () => {
  const goal = await create("me", "goals", "Emergency fund");
  const foreign = await create("other", "projects", "Not yours");
  const account = (await req("me", "POST", "/api/accounts", { name: "Cash", type: "Cash", opening: "0.00" })).json();
  const tx = (await req("me", "POST", "/api/transactions", {
    kind: "income", accountId: account.id, amount: "50000.00", category: "Gift",
    date: "2026-11-21", description: "Gift", key: randomUUID(),
  })).json();

  assert.equal((await req("me", "PATCH", `/api/transactions/${tx.id}/record`, { recordId: goal.id })).statusCode, 200);
  assert.equal((await req("me", "GET", `/api/records/${goal.id}/related`)).json().transactions.length, 1);
  assert.equal((await req("me", "PATCH", `/api/transactions/${tx.id}/record`, { recordId: null })).statusCode, 200);
  assert.equal((await req("me", "GET", `/api/records/${goal.id}/related`)).json().transactions.length, 0);

  const crossOwner = await req("me", "PATCH", `/api/transactions/${tx.id}/record`, { recordId: foreign.id });
  assert.equal(crossOwner.statusCode, 409);
  const crossBooking = await req("me", "POST", "/api/transactions", {
    kind: "expense", accountId: account.id, amount: "1000.00", category: "X",
    date: "2026-11-21", description: "X", key: randomUUID(), recordId: foreign.id,
  });
  assert.equal(crossBooking.statusCode, 409);
  assert.equal((await req("other", "GET", `/api/records/${goal.id}/related`)).statusCode, 404);
  assert.equal((await req("other", "PATCH", `/api/transactions/${tx.id}/record`, { recordId: foreign.id })).statusCode, 404);
});

test("deleting a linked record keeps the transaction and clears its link", async () => {
  const trip = await create("me", "travel", "Bali");
  const account = (await req("me", "POST", "/api/accounts", { name: "Trip card", type: "Bank", opening: "0.00" })).json();
  const tx = (await req("me", "POST", "/api/transactions", {
    kind: "income", accountId: account.id, amount: "10.00", category: "Refund",
    date: "2026-11-22", description: "Refund", key: randomUUID(), recordId: trip.id,
  })).json();
  await db.query("DELETE FROM records WHERE id=$1", [trip.id]);
  const row = (await db.query("SELECT record_id FROM ledger_transactions WHERE id=$1", [tx.id])).rows[0];
  assert.equal(row.record_id, null);
});
