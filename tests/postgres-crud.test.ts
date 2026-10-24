import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { database } from "../apps/api/src/db";
import { makeApp } from "../apps/api/src/app";
import { hashToken } from "../apps/api/src/auth";
import { catalog } from "../packages/shared/catalog";

// Opt in explicitly. All writes use a synthetic owner inside an outer rollback.
test("PostgreSQL production adapter: arrays and shared record CRUD", {
  skip: !process.env.FEBRO_TEST_DATABASE_URL,
}, async () => {
  const connection = database(process.env.FEBRO_TEST_DATABASE_URL!);
  const owner = randomUUID();
  const token = randomBytes(32).toString("hex");
  const csrf = randomBytes(24).toString("hex");
  const origin = "http://localhost:4173";
  const storage = await mkdtemp(path.join(os.tmpdir(), "febro-pg-test-"));
  const rollback = new Error("intentional test rollback");
  try {
    await assert.rejects(connection.db.transaction(async (tx) => {
      for (const tags of [[], ["one"], ["comma,quote\"", "brace{}", "slash\\", "日本語"]]) {
        assert.deepEqual((await tx.query("SELECT $1::text[] AS tags", [tags])).rows[0].tags, tags);
      }
      await tx.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
        [owner, `${owner}@example.test`, "Isolated CRUD regression", "!unused"]);
      await tx.query("INSERT INTO sessions(id,owner_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
        [hashToken(token), owner, csrf]);
      const app = await makeApp(tx, { origin, secure: false, storage });
      let requestIndex = 0;
      const req = (method: any, url: string, payload?: any) => app.inject({
        method, url, payload, remoteAddress: `127.1.0.${(++requestIndex % 250) + 1}`, headers: { origin, cookie: `session=${token}`, "x-csrf-token": csrf },
      });
      try {
        for (const m of Object.values(catalog)) {
          const data: any = {};
          for (const f of m.fields) {
            if (f.type === "select") data[f.key] = f.options![0];
            if (f.required) data[f.key] = f.type === "datetime-local" ? "2026-10-23T10:00"
              : f.type === "url" ? "https://example.com" : f.type === "number" ? "100"
              : f.key === "month" ? "2026-10" : "Value";
          }
          if (m.key === "events") data.end = "2026-10-23T11:00";
          const created = await req("POST", "/api/records", { kind: m.key, title: "Isolated regression", tags: [], data });
          assert.equal(created.statusCode, 200, `${m.key}: ${created.body}`);
          let row = created.json();
          assert.deepEqual(row.tags, []);
          for (const tags of [["single"], ["comma,value", "quote\"", "日本語"]]) {
            const edited = await req("PUT", `/api/records/${row.id}`, { ...row, title: "Edited", tags });
            assert.equal(edited.statusCode, 200, edited.body);
            row = edited.json();
            assert.deepEqual(row.tags, tags);
          }
          if (m.key === "tasks") {
            const completed = await req("PUT", `/api/records/${row.id}`, { ...row, data: { ...row.data, status: "Completed", progress: 100 } });
            assert.equal(completed.statusCode, 200, completed.body);
            row = completed.json();
            assert.equal(row.data.status, "Completed");
          }
          const persisted = (await tx.query("SELECT * FROM records WHERE id=$1 AND owner_id=$2", [row.id, owner])).rows[0];
          assert.deepEqual(persisted.tags, row.tags);
          assert.deepEqual(persisted.data, row.data);
          const listed = await req("GET", `/api/records?kind=${m.key}&q=Edited`);
          assert.equal(listed.statusCode, 200, listed.body);
          assert.equal(listed.json().items[0].id, row.id);
          assert.ok((await req("GET", `/api/records/${row.id}/versions`)).json().length >= 2);
          assert.equal((await req("DELETE", `/api/records/${row.id}`)).statusCode, 200);
          assert.equal((await req("GET", `/api/records?kind=${m.key}`)).json().items.length, 0);
          assert.equal((await req("POST", `/api/records/${row.id}/restore`)).statusCode, 200);
        }

        const company=(await req("POST","/api/records",{kind:"companies",title:"Related company",data:{}})).json();
        const task=(await req("POST","/api/records",{kind:"tasks",title:"Related PostgreSQL task",data:{companyId:company.id}})).json();
        const linked=await req("GET","/api/records?kind=tasks&q=Related%20PostgreSQL");assert.equal(linked.statusCode,200,linked.body);assert.equal(linked.json().references[0].id,company.id);assert.equal(linked.json().statusCounts[0].count,1);
        await req("POST",`/api/records/${task.id}/trash`,{});assert.equal((await req("GET","/api/records?kind=tasks&trash=true")).json().items[0].id,task.id);
        const purge=(await req("POST","/api/records",{kind:"notes",title:"PostgreSQL purge fixture",data:{}})).json();await req("POST",`/api/records/${purge.id}/trash`,{});
        assert.equal((await req("DELETE",`/api/records/${purge.id}/permanent`,{confirmation:purge.title})).statusCode,409);
        await tx.query("UPDATE records SET deleted_at=now()-interval '31 days' WHERE id=$1",[purge.id]);
        const purged=await req("DELETE",`/api/records/${purge.id}/permanent`,{confirmation:purge.title});assert.equal(purged.statusCode,200,purged.body);
        console.log("Verified native PostgreSQL relation arrays, board counts, Trash and guarded permanent deletion");
      } finally { await app.close(); }
      throw rollback;
    }), (error: unknown) => error === rollback);
    assert.equal((await connection.db.query("SELECT count(*)::int n FROM users WHERE id=$1", [owner])).rows[0].n, 0);
    assert.equal((await connection.db.query("SELECT count(*)::int n FROM records WHERE owner_id=$1", [owner])).rows[0].n, 0);
  } finally {
    await connection.close();
    await rm(storage, { recursive: true, force: true });
  }
});
