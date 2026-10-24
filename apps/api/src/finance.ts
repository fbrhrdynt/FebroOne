import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  minor,
  major,
  postings,
  txSchema,
  debtSchema,
  money,
  id,
} from "../../../packages/shared/domain";
import type { DB } from "./db";
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function financialState(db: DB, owner: string) {
  const a = await db.query(
    `SELECT a.*,COALESCE(sum(p.amount),0)::text balance FROM accounts a LEFT JOIN ledger_postings p ON p.account_id=a.id WHERE a.owner_id=$1 GROUP BY a.id ORDER BY a.created_at`,
    [owner],
  );
  const t = await db.query(
    `SELECT t.*,t.date::text date,p.account_id,p.amount::text, (SELECT account_id FROM ledger_postings WHERE transaction_id=t.id AND amount>0 AND account_id IS NOT NULL LIMIT 1) to_account_id,EXISTS(SELECT 1 FROM ledger_transactions x WHERE x.reversal_of=t.id) reversed,dp.debt_id,dp.principal::text,dp.interest::text FROM ledger_transactions t JOIN ledger_postings p ON p.transaction_id=t.id AND p.account_id IS NOT NULL LEFT JOIN debt_payments dp ON dp.transaction_id=t.id WHERE t.owner_id=$1 AND (t.kind<>'transfer' OR p.amount<0) ORDER BY t.date DESC,t.created_at DESC`,
    [owner],
  );
  const d = await db.query(
    `SELECT d.*,d.start::text start,COALESCE((SELECT sum(p.principal) FROM debt_payments p WHERE p.debt_id=d.id AND NOT EXISTS(SELECT 1 FROM ledger_transactions t WHERE t.reversal_of=p.transaction_id)),0)::text paid FROM debts d WHERE owner_id=$1 ORDER BY created_at DESC`,
    [owner],
  );
  return {
    accounts: a.rows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: major(a.balance),
    })),
    transactions: t.rows.map((t) => ({
      id: t.id,
      kind: t.kind,
      accountId: t.account_id,
      toAccountId: t.to_account_id,
      amount: major(BigInt(t.amount) < 0n ? -BigInt(t.amount) : t.amount),
      category: t.category,
      date:
        typeof t.date === "string" ? t.date : t.date.toISOString().slice(0, 10),
      description: t.description,
      key: t.idempotency_key,
      reversed: t.reversed,
      debtId: t.debt_id,
      principal: t.principal ? major(t.principal) : undefined,
      interest: t.interest ? major(t.interest) : undefined,
    })),
    debts: d.rows.map((d) => ({
      ...d,
      principal: major(d.principal),
      paid: major(d.paid),
      apr: Number(d.apr),
      start:
        typeof d.start === "string"
          ? d.start
          : d.start.toISOString().slice(0, 10),
    })),
  };
}
export async function createAccount(db: DB, owner: string, raw: any) {
  const data = z
    .object({
      name: z.string().trim().min(1).max(120),
      type: z.enum(["Bank", "Cash", "E-wallet"]),
      opening: money,
    })
    .parse(raw);
  return db.transaction(async (tx) => {
    const accountId = randomUUID();
    await tx.query(
      "INSERT INTO accounts(id,owner_id,name,type) VALUES($1,$2,$3,$4)",
      [accountId, owner, data.name, data.type],
    );
    if (minor(data.opening) > 0n)
      await book(tx, owner, {
        kind: "opening",
        accountId,
        amount: data.opening,
        date: new Date().toISOString().slice(0, 10),
        category: "Opening",
        description: "Opening balance",
        key: randomUUID(),
      });
    return { id: accountId };
  });
}
export async function book(db: DB, owner: string, t: any) {
  const requestHash = hash(t);
  const existing = await db.query(
    "SELECT id,request_hash FROM ledger_transactions WHERE owner_id=$1 AND idempotency_key=$2",
    [owner, t.key],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== requestHash)
      throw new Error("Idempotency key digunakan untuk transaksi berbeda");
    return { id: existing.rows[0].id };
  }
  for (const a of [t.accountId, t.toAccountId].filter(Boolean)) {
    const found = await db.query(
      "SELECT id FROM accounts WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, a],
    );
    if (!found.rows.length) throw new Error("Akun tidak ditemukan");
  }
  const tid = randomUUID();
  await db.query(
    "INSERT INTO ledger_transactions(id,owner_id,kind,category,date,description,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [tid, owner, t.kind, t.category, t.date, t.description, t.key, requestHash],
  );
  for (const p of postings(t))
    await db.query(
      "INSERT INTO ledger_postings(owner_id,transaction_id,account_id,amount) VALUES($1,$2,$3,$4)",
      [owner, tid, p.accountId, p.amount.toString()],
    );
  await db.query(
    "INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,$2,$3)",
    [owner, "finance.create", tid],
  );
  return { id: tid };
}
export async function createTransaction(db: DB, owner: string, raw: any) {
  const t = txSchema.parse(raw);
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [owner]);
    return book(tx, owner, t);
  });
}
export async function importTransactions(db: DB,owner:string,raw:unknown){
  const {rows}=z.object({rows:z.array(txSchema).min(1).max(1000)}).parse(raw);
  return db.transaction(async tx=>{
    await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner]);
    const result=[];
    for(const row of rows)result.push(await book(tx,owner,row));
    return {count:result.length,items:result};
  });
}
export async function reverseTransaction(db: DB, owner: string, tid: string) {
  id.parse(tid);
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [owner]);
    const t = (
      await tx.query(
        "SELECT * FROM ledger_transactions WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [tid, owner],
      )
    ).rows[0];
    if (!t || ["opening", "reversal"].includes(t.kind))
      throw new Error("Transaksi tidak dapat dibatalkan");
    if (
      (
        await tx.query(
          "SELECT id FROM ledger_transactions WHERE reversal_of=$1",
          [tid],
        )
      ).rows.length
    )
      throw new Error("Sudah dibatalkan");
    const rid = randomUUID();
    await tx.query(
      `INSERT INTO ledger_transactions(id,owner_id,kind,category,date,description,idempotency_key,request_hash,reversal_of) VALUES($1,$2,'reversal',$3,$4,'Reversal',$5,$6,$7)`,
      [rid, owner, t.category, t.date, randomUUID(), hash(tid), tid],
    );
    await tx.query(
      "INSERT INTO ledger_postings(owner_id,transaction_id,account_id,amount) SELECT owner_id,$1,account_id,-amount FROM ledger_postings WHERE transaction_id=$2",
      [rid, tid],
    );
    await tx.query(
      "INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,$2,$3)",
      [owner, "finance.reverse", tid],
    );
    return { id: rid };
  });
}
export async function createDebt(db: DB, owner: string, raw: any) {
  const d = debtSchema.parse(raw);
  const did = randomUUID();
  await db.query(
    "INSERT INTO debts(id,owner_id,name,principal,apr,months,start,direction,model,rates) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      did,
      owner,
      d.name,
      minor(d.principal).toString(),
      d.apr,
      d.months,
      d.start,
      d.direction,
      d.model,
      JSON.stringify(d.rates),
    ],
  );
  return { id: did };
}
export async function payDebt(db: DB, owner: string, did: string, raw: any) {
  id.parse(did);
  const p = z
    .object({
      accountId: id,
      principal: money.refine((v) => minor(v) > 0n),
      interest: money,
      date: z.iso.date(),
      key: id,
    })
    .parse(raw);
  return db.transaction(async (tx) => {
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [owner]);
    const old = (
      await tx.query(
        "SELECT t.id,t.request_hash FROM ledger_transactions t WHERE owner_id=$1 AND idempotency_key=$2",
        [owner, p.key],
      )
    ).rows[0];
    const d = (
      await tx.query(
        "SELECT * FROM debts WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [did, owner],
      )
    ).rows[0];
    if (!d) throw new Error("Utang tidak ditemukan");
    const t = {
      kind: d.direction === "lent" ? "debt_receipt" : "debt_payment",
      accountId: p.accountId,
      amount: major(minor(p.principal) + minor(p.interest)),
      category: "Debt payment",
      date: p.date,
      description: d.name,
      key: p.key,
      debtId: did,
      principal: p.principal,
      interest: p.interest,
    };
    if (old) {
      if (old.request_hash !== hash(t))
        throw new Error("Idempotency key berbeda");
      return { id: old.id };
    }
    const paid = (
      await tx.query(
        "SELECT COALESCE(sum(principal),0)::text paid FROM debt_payments p WHERE debt_id=$1 AND NOT EXISTS(SELECT 1 FROM ledger_transactions t WHERE t.reversal_of=p.transaction_id)",
        [did],
      )
    ).rows[0].paid;
    if (BigInt(paid) + minor(p.principal) > BigInt(d.principal))
      throw new Error("Pembayaran melebihi sisa pokok");
    const result = await book(tx, owner, t);
    await tx.query(
      "INSERT INTO debt_payments(id,owner_id,debt_id,transaction_id,principal,interest) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        owner,
        did,
        result.id,
        minor(p.principal).toString(),
        minor(p.interest).toString(),
      ],
    );
    return result;
  });
}
