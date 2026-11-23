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
    `SELECT d.*,d.start::text start,(COALESCE((SELECT sum(p.principal) FROM debt_payments p WHERE p.debt_id=d.id AND NOT EXISTS(SELECT 1 FROM ledger_transactions t WHERE t.reversal_of=p.transaction_id)),0)+COALESCE((SELECT sum(i.amount) FROM debt_installments i WHERE i.debt_id=d.id AND i.status='paid'),0))::text paid FROM debts d WHERE owner_id=$1 AND archived_at IS NULL ORDER BY created_at DESC`,
    [owner],
  );
  const installments = await db.query(
    `SELECT id,debt_id,period::text period,due_date::text due_date,amount::text amount,status,paid_at,notes FROM debt_installments WHERE owner_id=$1 ORDER BY period`,
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
      ...(d.details || {}),
      settledAt: d.settled_at ? (typeof d.settled_at === "string" ? d.settled_at : d.settled_at.toISOString()) : null,
      principal: major(d.principal),
      paid: major(d.paid),
      apr: Number(d.apr),
      start: d.start ? (typeof d.start === "string" ? d.start : d.start.toISOString().slice(0, 10)) : null,
    })),
    installments: installments.rows.map((item) => ({...item,debtId:item.debt_id,paidAt:item.paid_at,amount:item.amount===null?null:major(item.amount)})),
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
    "INSERT INTO debts(id,owner_id,name,principal,apr,months,start,direction,model,rates,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      did,
      owner,
      d.name,
      minor(d.principal).toString(),
      d.apr,
      d.months,
      d.start || null,
      d.direction,
      d.model,
      JSON.stringify(d.rates),
      JSON.stringify({dueDate:d.dueDate||null,repaymentMode:d.repaymentMode||"installment",monthlyPayment:d.monthlyPayment||null,paymentBank:d.paymentBank||"",paymentAccount:d.paymentAccount||"",paymentType:d.paymentType||"",creditorType:d.creditorType||"other",agreementDate:d.agreementDate||null,repaymentStart:d.repaymentStart||null,dueDay:d.dueDay||null,notes:d.notes||"",reminderDays:d.reminderDays??7,installmentCount:d.installmentCount||null}),
    ],
  );
  return { id: did };
}
export async function updateDebt(db: DB, owner: string, did: string, raw: any) {
  id.parse(did);
  const d = debtSchema.parse(raw);
  const result = await db.query(
    "UPDATE debts SET name=$1,principal=$2,apr=$3,months=$4,start=$5,direction=$6,model=$7,rates=$8,details=$9 WHERE id=$10 AND owner_id=$11 AND archived_at IS NULL RETURNING id",
    [d.name,minor(d.principal).toString(),d.apr,d.months,d.start||null,d.direction,d.model,JSON.stringify(d.rates),JSON.stringify({dueDate:d.dueDate||null,repaymentMode:d.repaymentMode||"installment",monthlyPayment:d.monthlyPayment||null,paymentBank:d.paymentBank||"",paymentAccount:d.paymentAccount||"",paymentType:d.paymentType||"",creditorType:d.creditorType||"other",agreementDate:d.agreementDate||null,repaymentStart:d.repaymentStart||null,dueDay:d.dueDay||null,notes:d.notes||"",reminderDays:d.reminderDays??7,installmentCount:d.installmentCount||null}),did,owner]
  );
  if (!result.rows.length) throw new Error("Utang tidak ditemukan");
  return {id:did};
}
export async function setDebtInstallmentPaid(db: DB, owner: string, raw: any) {
  const input=z.object({debtId:id,periods:z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).min(1).max(24),amount:money.optional(),dueDate:z.iso.date().optional(),notes:z.string().max(1000).optional(),paid:z.boolean().default(true)}).parse(raw);
  if(new Set(input.periods).size!==input.periods.length)throw new Error("Periode pembayaran duplikat");
  return db.transaction(async tx=>{
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner]);
    const debt=(await tx.query("SELECT id FROM debts WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL FOR UPDATE",[input.debtId,owner])).rows[0];
    if(!debt)throw new Error("Utang tidak ditemukan");
    const result=[];
    for(const period of input.periods){
      const saved=await tx.query(
        `INSERT INTO debt_installments(id,owner_id,debt_id,period,due_date,amount,status,paid_at,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT(debt_id,period) DO UPDATE SET due_date=EXCLUDED.due_date,amount=EXCLUDED.amount,status=EXCLUDED.status,paid_at=EXCLUDED.paid_at,notes=EXCLUDED.notes
         RETURNING id,status,period::text period`,
        [randomUUID(),owner,input.debtId,period+"-01",input.dueDate||null,input.amount?minor(input.amount).toString():null,input.paid?"paid":"scheduled",input.paid?new Date().toISOString():null,input.notes||""]
      );
      result.push(saved.rows[0]);
    }
    await tx.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,$2,$3)",[owner,input.paid?"debt.installments_paid":"debt.installments_scheduled",input.debtId]);
    return {items:result};
  });
}
export async function runDebtReminders(db: DB) {
  await db.query(`
    INSERT INTO notifications(id,owner_id,title,record_id)
    SELECT
      'debt-due:'||d.id::text||':'||to_char(m.period,'YYYY-MM'),
      d.owner_id,
      CASE WHEN due.due_date < CURRENT_DATE THEN 'Pembayaran terlambat: '||d.name ELSE 'Jadwal pembayaran: '||d.name END,
      NULL
    FROM debts d
    CROSS JOIN LATERAL generate_series(
      date_trunc('month',CURRENT_DATE - interval '1 month')::date,
      date_trunc('month',CURRENT_DATE + interval '2 months')::date,
      interval '1 month'
    ) AS m(period)
    CROSS JOIN LATERAL (
      SELECT (m.period + (LEAST(
        COALESCE(NULLIF(d.details->>'dueDay','')::int,1),
        EXTRACT(day FROM (m.period + interval '1 month - 1 day'))::int
      ) - 1) * interval '1 day')::date AS due_date
    ) due
    WHERE d.owner_id IS NOT NULL
      AND d.archived_at IS NULL
      AND d.settled_at IS NULL
      AND d.direction='borrowed'
      AND COALESCE(NULLIF(d.details->>'monthlyPayment','')::numeric,0)>0
      AND NULLIF(d.details->>'dueDay','') IS NOT NULL
      AND (NULLIF(d.details->>'repaymentStart','') IS NOT NULL AND m.period >= date_trunc('month',(d.details->>'repaymentStart')::date)::date)
      AND (d.details->>'installmentCount' IS NULL OR m.period < (date_trunc('month',(d.details->>'repaymentStart')::date) + ((d.details->>'installmentCount')::int * interval '1 month'))::date)
      AND (due.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + COALESCE((d.details->>'reminderDays')::int,7) OR due.due_date < CURRENT_DATE)
      AND NOT EXISTS (
        SELECT 1 FROM debt_installments i
        WHERE i.debt_id=d.id AND i.period=m.period AND i.status='paid'
      )
    ON CONFLICT(id) DO NOTHING
  `);
}
export async function settleDebt(db: DB, owner: string, did: string) {
  id.parse(did);
  const result=await db.query("UPDATE debts SET settled_at=now() WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL AND settled_at IS NULL RETURNING id",[did,owner]);
  if(!result.rows.length)throw new Error("Utang tidak ditemukan atau sudah lunas");
  await db.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,'debt.settled',$2)",[owner,did]);
  return {ok:true};
}
export async function archiveDebt(db: DB, owner: string, did: string) {
  id.parse(did);
  const result=await db.query("UPDATE debts SET archived_at=now() WHERE id=$1 AND owner_id=$2 AND archived_at IS NULL RETURNING id",[did,owner]);
  if(!result.rows.length)throw new Error("Utang tidak ditemukan");
  await db.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,'debt.archive',$2)",[owner,did]);
  return {ok:true};
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
    if(d.direction==="borrowed" && d.details?.repaymentMode==="installment" && d.details?.dueDate){
      await tx.query("UPDATE debts SET details=jsonb_set(details,'{dueDate}',to_jsonb(((details->>'dueDate')::date + interval '1 month')::date::text)) WHERE id=$1 AND owner_id=$2",[did,owner]);
    }
    return result;
  });
}
