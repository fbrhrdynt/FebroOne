import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrate } from "../scripts/migrate";
import { makeApp } from "../apps/api/src/app";
import { hashPassword, hashToken, tokenHashEquals, verifyPasswordOrDummy } from "../apps/api/src/auth";
import type { DB } from "../apps/api/src/db";

const origin = "http://localhost:4173";
const owner = randomUUID();
const email = "security@example.test";
const recovery = "recovery-secret-value-0123456789";
let pg: PGlite, db: DB, app: any, storage: string;

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
const post = (url: string, payload: any) =>
  app.inject({ method: "POST", url, payload, headers: { origin } });

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = adapter(pg);
  await migrate(db);
  storage = await mkdtemp(path.join(os.tmpdir(), "febro-sec-"));
  await db.query(
    "INSERT INTO users(id,email,name,password_hash,recovery_hash) VALUES($1,$2,$3,$4,$5)",
    [owner, email, "Security", await hashPassword("correct-password-123"), hashToken(recovery)],
  );
  app = await makeApp(db, { origin, storage, secure: false });
});
after(async () => {
  await app.close();
  await pg.close();
  await rm(storage, { recursive: true, force: true });
});

test("auth helpers: dummy verification never succeeds, token hashes compare safely", async () => {
  assert.equal(await verifyPasswordOrDummy("anything", undefined), false);
  assert.equal(await verifyPasswordOrDummy("anything", null), false);
  assert.equal(tokenHashEquals(recovery, hashToken(recovery)), true);
  assert.equal(tokenHashEquals("wrong", hashToken(recovery)), false);
  assert.equal(tokenHashEquals(recovery, null), false);
  assert.equal(tokenHashEquals(recovery, "short"), false);
});

test("unknown email and wrong password give the same login answer", async () => {
  const unknown = await post("/api/auth/login", { email: "nobody@example.test", password: "x" });
  const wrong = await post("/api/auth/login", { email, password: "wrong-password" });
  assert.equal(unknown.statusCode, 401);
  assert.equal(wrong.statusCode, 401);
  assert.deepEqual(unknown.json(), wrong.json());
  const ok = await post("/api/auth/login", { email, password: "correct-password-123" });
  assert.equal(ok.statusCode, 200);
});

test("account recovery is single-use and audited", async () => {
  const bad = await post("/api/auth/recover", { email, recovery: "not-the-recovery-secret", password: "new-password-12345" });
  assert.equal(bad.statusCode, 400);
  const ok = await post("/api/auth/recover", { email, recovery, password: "new-password-12345" });
  assert.equal(ok.statusCode, 200);
  const audit = await db.query("SELECT action FROM audit_logs WHERE owner_id=$1 AND action='auth.recover'", [owner]);
  assert.equal(audit.rows.length, 1);
  const again = await post("/api/auth/recover", { email, recovery, password: "another-password-123" });
  assert.equal(again.statusCode, 400);
});
