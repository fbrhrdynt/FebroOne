import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minor,
  major,
  postings,
  amortize,
  occurrences,
  localDay,
  streak,
  calculate,
  conversions,
  validateRecord,
  dueNotifications,
  nextOccurrence,
} from "../packages/shared/domain";
const record = (data: any, kind = "events"): any => ({
  id: "00000000-0000-4000-8000-000000000001",
  kind,
  title: "Test",
  tags: [],
  version: 1,
  data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
test("decimal money exact and rejects invalid precision", () => {
  assert.equal(minor("0.10") + minor("0.20"), 30n);
  assert.equal(major(30n), "0.30");
  assert.throws(() => minor("0.001"));
  assert.throws(() => minor("-1"));
});
test("transfer conserves money and is not income", () => {
  const p = postings({
    kind: "transfer",
    accountId: "a",
    toAccountId: "b",
    amount: "100.01",
  });
  assert.equal(
    p.reduce((a, p) => a + p.amount, 0n),
    0n,
  );
  assert.equal(p[0].amount, -10001n);
  assert.throws(() =>
    postings({
      kind: "transfer",
      accountId: "a",
      toAccountId: "a",
      amount: "1",
    }),
  );
});
test("expense ledger has equal balancing posting", () => {
  const p = postings({ kind: "expense", accountId: "a", amount: "123.45" });
  assert.equal(
    p.reduce((a, p) => a + p.amount, 0n),
    0n,
  );
  assert.equal(p[0].amount, -12345n);
});
test("amortization known 1200 12% 12 months", () => {
  const s = amortize("1200", 12, 12);
  assert.equal(s.rows[0].payment, "106.62");
  assert.equal(s.rows[0].interest, "12.00");
  assert.equal(s.rows.at(-1)?.balance, "0.00");
  assert.equal(
    s.rows.reduce((a, r) => a + minor(r.principal), 0n),
    120000n,
  );
});
test("zero APR, flat interest, extra payments, variable interest", () => {
  assert.equal(amortize("1200", 0, 12).rows[0].payment, "100.00");
  assert.equal(amortize("1200", 12, 12, "flat").totalInterest, "144.00");
  assert.ok(amortize("1200", 12, 12, "reducing", "100").months < 12);
  const variable = amortize("1200", 12, 12, "reducing", "0", [
    { month: 2, apr: 24 },
  ]);
  assert.ok(
    Number(variable.rows[1].interest) > Number(variable.rows[0].interest),
  );
});
test("recurrence exclusion and end date persist through serialized data", () => {
  const r = record({
    start: "2026-10-20T09:00:00+07:00",
    end: "2026-10-20T10:00:00+07:00",
    recurrence: "Daily",
    exceptions: "2026-10-21",
    until: "2026-10-22",
  });
  const events = occurrences(
    JSON.parse(JSON.stringify(r)),
    new Date("2026-10-20"),
    new Date("2026-10-25"),
  );
  assert.equal(events.length, 2);
  assert.equal(localDay(new Date(events[1].data.start)), "2026-10-22");
});
test("monthly recurrence clamps end of month", () => {
  assert.equal(
    nextOccurrence("2026-01-31T08:00:00Z", "Monthly"),
    "2026-02-28T08:00:00.000Z",
  );
});
test("Asia Jakarta dates and habit streak", () => {
  assert.equal(localDay(new Date("2026-10-22T18:00:00Z")), "2026-10-23");
  assert.equal(
    streak(
      [
        record({ habitId: "h", date: "2026-10-22", value: 1 }, "habitEntries"),
        record({ habitId: "h", date: "2026-10-21", value: 1 }, "habitEntries"),
      ],
      "h",
      "2026-10-23",
    ),
    2,
  );
});
test("certificate reminder expiry threshold", () => {
  const rs = [
    record({ expiry: "2026-11-01", reminderDays: 30 }, "certificates"),
  ];
  assert.equal(dueNotifications(rs, new Date("2026-10-20")).length, 1);
  assert.equal(dueNotifications(rs, new Date("2026-09-01")).length, 0);
});
test("validation rejects unknown fields and invalid dates", () => {
  assert.throws(() =>
    validateRecord({
      kind: "events",
      title: "X",
      data: { start: "bad", end: "bad" },
    }),
  );
  assert.throws(() =>
    validateRecord({ kind: "notes", title: "X", data: { hack: "x" } }),
  );
  assert.throws(() =>
    validateRecord({ kind: "tasks", title: "X", data: { progress: 101 } }),
  );
});
test("engineering reference values and bounds", () => {
  assert.equal(calculate("ohm", { v: 24, r: 12 }).result, 2);
  assert.equal(calculate("box", { l: 2, w: 3, h: 4 }).result, 24);
  assert.ok(
    Math.abs(calculate("cylinder", { d: 2, l: 1 }).result - Math.PI) < 1e-12,
  );
  assert.equal(calculate("flow", { v: 60, t: 30 }).result, 2);
  assert.equal(calculate("pressure", { rho: 1000, h: 10 }).result, 98066.5);
  assert.ok(
    Math.abs(
      calculate("torque", { p: 1000, rpm: 1000 }).result - 9.5492965855,
    ) < 1e-8,
  );
  assert.throws(() => calculate("ohm", { v: 24, r: 0 }));
  assert.throws(() =>
    calculate("threephase", { p: 1000, v: 400, pf: 2, eff: 0.9 }),
  );
  assert.equal(conversions.pressure.bar, 100000);
  assert.equal(conversions.length.in, 0.0254);
});

test('negative reconciliation changes balance without an expense classification', () => {
  const p = postings({ kind: 'reconciliation', accountId: 'account', amount: '25.50', adjustmentDirection: 'decrease' });
  assert.equal(p[0].amount, -2550n);
  assert.equal(p.reduce((n, r) => n + r.amount, 0n), 0n);
});
