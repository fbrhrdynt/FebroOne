import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import {
  validateRecord,
  id,
  dueNotifications,
  nextOccurrence,
} from "../../../packages/shared/domain";
import { hashToken, verifyPassword, hashPassword } from "./auth";
import {
  createAccount,
  createTransaction,
  financialState,
  createDebt,
  payDebt,
  reverseTransaction,
  importTransactions,
} from "./finance";
import type { DB } from "./db";
import { registerPush } from "./push";
import { registerCms } from "./cms";
import { remoteFilesEnabled, uploadRemoteFile, filesCall } from "./files-service";
export function mapRecord(r: any) {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    tags: r.tags,
    data: r.data,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
    deletedAt: r.deleted_at,
  };
}
export async function makeApp(
  db: DB,
  options: {
    origin: string;
    storage: string;
    secure: boolean;
    ai?: { url: string; key: string; model: string };
  },
) {
  const app = Fastify({
    logger: false,
    bodyLimit: 1048576,
    trustProxy: "127.0.0.1",
  });
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', {parseAs:'string'}, (req:any,body:any,done:any)=>{
    req.rawBody=body;
    try {done(null,JSON.parse(body));}catch {done(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}
  });
  await app.register(cookie);
  await app.register(helmet);
  await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: { fileSize: 10485760, files: 1, fields: 2 },
  });
  app.decorateRequest("owner", null);
  app.decorateRequest("session", null);
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const publicPath = ["/api/health", "/api/auth/login", "/api/auth/recover"];
    const bridgePath = req.url.split("?")[0] === "/api/integrations/cms/events";
    if (bridgePath && req.method === "POST") return;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== options.origin
    )
      return reply.code(403).send({ error: "Origin ditolak" });
    if (publicPath.includes(req.url.split("?")[0])) return;
    const token = req.cookies.session;
    if (!token) return reply.code(401).send({ error: "Silakan masuk" });
    const s = (
      await db.query(
        "SELECT * FROM sessions WHERE id=$1 AND expires_at>now()",
        [hashToken(token)],
      )
    ).rows[0];
    if (!s) return reply.code(401).send({ error: "Sesi berakhir" });
    (req as any).owner = s.owner_id;
    (req as any).session = s;
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== s.csrf
    )
      return reply.code(403).send({ error: "CSRF tidak valid" });
  });
  app.setErrorHandler((e: any, req, reply) => {
    const databaseCode=e.code||e.cause?.code;
    if(databaseCode&&/^\d{5}$/.test(databaseCode))return reply.code(['23505','23503'].includes(databaseCode)?409:500).send({error:['23505','23503'].includes(databaseCode)?'Data terkait tidak tersedia atau sudah ada':'Operasi database gagal'});
    if(e.cause)return reply.code(500).send({error:'Operasi server gagal'});
    const status =
      e.statusCode ||
      (["23505", "23503"].includes(e.code)
        ? 409
        : e instanceof z.ZodError || e.message
          ? 400
          : 500);
    reply
      .code(status >= 500 ? 500 : status)
      .send({
        error:
          status >= 500
            ? "Terjadi kesalahan server"
            : e instanceof z.ZodError
              ? e.issues.map((i: any) => i.message).join("; ")
              : e.message,
      });
  });
  const owner = (r: any) => r.owner as string;
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return { status: "ok", app: "Febro One", version:"1.2.0" };
  });
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const p = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(req.body);
      const u = (
        await db.query("SELECT * FROM users WHERE email=$1", [
          p.email.toLowerCase(),
        ])
      ).rows[0];
      if (!u || !(await verifyPassword(p.password, u.password_hash)))
        return reply.code(401).send({ error: "Email atau password salah" });
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      if (req.cookies.session)
        await db.query("DELETE FROM sessions WHERE id=$1", [
          hashToken(req.cookies.session),
        ]);
      await db.query("DELETE FROM sessions WHERE expires_at<now()");
      await db.query(
        "INSERT INTO sessions(id,owner_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
        [hashToken(token), u.id, csrf],
      );
      reply.setCookie("session", token, {
        httpOnly: true,
        secure: options.secure,
        sameSite: "strict",
        path: "/",
        maxAge: 604800,
      });
      await db.query("INSERT INTO audit_logs(owner_id,action) VALUES($1,$2)", [
        u.id,
        "auth.login",
      ]);
      return {
        csrf,
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          preferences: u.preferences,
        },
      };
    },
  );
  app.post(
    "/api/auth/recover",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const p = z
        .object({
          email: z.email(),
          recovery: z.string().min(20),
          password: z.string().min(12).max(200),
        })
        .parse(req.body);
      return db.transaction(async (tx) => {
        const u = (
          await tx.query("SELECT * FROM users WHERE email=$1 FOR UPDATE", [
            p.email.toLowerCase(),
          ])
        ).rows[0];
        if (!u || !u.recovery_hash || hashToken(p.recovery) !== u.recovery_hash)
          return reply.code(400).send({ error: "Pemulihan gagal" });
        await tx.query(
          "UPDATE users SET password_hash=$1,recovery_hash=NULL WHERE id=$2",
          [await hashPassword(p.password), u.id],
        );
        await tx.query("DELETE FROM sessions WHERE owner_id=$1", [u.id]);
        return { ok: true };
      });
    },
  );
  app.get("/api/auth/me", async (req) => {
    const u = (
      await db.query(
        "SELECT id,name,email,preferences FROM users WHERE id=$1",
        [owner(req)],
      )
    ).rows[0];
    return { user: u, csrf: (req as any).session.csrf };
  });
  app.post("/api/auth/logout", async (req, reply) => {
    await db.query("DELETE FROM sessions WHERE id=$1", [
      (req as any).session.id,
    ]);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/auth/sessions", async (req: any) => {
    const rows=(await db.query("SELECT created_at,expires_at,id=$2 AS current FROM sessions WHERE owner_id=$1 AND expires_at>now() ORDER BY created_at DESC",[owner(req),req.session.id])).rows;
    return {items:rows};
  });
  app.post("/api/auth/sessions/revoke-others", async (req: any) => {
    await db.query("DELETE FROM sessions WHERE owner_id=$1 AND id<>$2",[owner(req),req.session.id]);
    return {ok:true};
  });
  await registerCms(app, db);
  await registerPush(app, db);
  app.patch("/api/preferences/workspace", async (req) => {
    const p=z.object({expandedCategories:z.array(z.string().max(100)).max(40)}).parse(req.body);
    await db.query("UPDATE users SET preferences=preferences || $1::jsonb WHERE id=$2",[JSON.stringify(p),owner(req)]); return p;
  });
  app.put("/api/preferences", async (req) => {
    const p = z
      .object({
        name: z.string().min(1).max(100),
        timezone: z.string().refine((v) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: v });
            return true;
          } catch {
            return false;
          }
        }),
        widgets: z.array(z.string()).max(20),
        theme: z.enum(["light", "dark", "system"]),
        maskMoney: z.boolean(),
      })
      .parse(req.body);
    await db.query("UPDATE users SET name=$1,preferences=preferences || $2::jsonb WHERE id=$3", [
      p.name,
      JSON.stringify(p),
      owner(req),
    ]);
    return p;
  });
  app.get("/api/records", async (req) => {
    const q = z
      .object({
        kind: z.string().optional(),
        q: z.string().max(200).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
        companyId: id.optional(), categoryId:id.optional(),projectId:id.optional(),
        priority:z.enum(["Low","Medium","High","Urgent"]).optional(), pending:z.enum(["true","false"]).optional(), related:id.optional(), status:z.string().max(100).optional(),
        sort:z.enum(["updated","title","due"]).default("updated"),
        archived: z.enum(["true", "false"]).default("false"),
        trash: z.enum(["true","false"]).default("false"),
      })
      .parse(req.query);
    const conditions = [
      "owner_id=$1",
      q.trash === "true" ? "deleted_at IS NOT NULL" : "deleted_at IS NULL",
      q.trash === "true" ? "TRUE" : q.archived === "true" ? "archived_at IS NOT NULL" : "archived_at IS NULL",
    ];
    const params: any[] = [owner(req)];
    if (q.kind) {
      params.push(q.kind);
      conditions.push(`kind=$${params.length}`);
    }
    if (q.q) {
      params.push("%" + q.q + "%");
      conditions.push(
        `(title ILIKE $${params.length} OR array_to_string(tags,' ') ILIKE $${params.length} OR data::text ILIKE $${params.length})`,
      );
    }
    for(const [key,column] of [["companyId","company_id"],["categoryId","category_id"],["projectId","project_id"]] as const){if(q[key]){params.push(q[key]);conditions.push(`${column}=$${params.length}`);}}
    if(q.pending==="true")conditions.push("COALESCE(data->>'status','')<>'Completed'");
    if(q.related){params.push(q.related);conditions.push(`(company_id=$${params.length} OR category_id=$${params.length} OR project_id=$${params.length})`);}
    if(q.priority){params.push(q.priority);conditions.push(`data->>'priority'=$${params.length}`);}
    if(q.status){params.push(q.status);conditions.push(`(data->>'status'=$${params.length} OR data->>'kind'=$${params.length})`);}
    const order=q.sort==="title"?"title ASC,id":q.sort==="due"?"data->>'due' ASC NULLS LAST,id":"updated_at DESC,id";
    const where = conditions.join(" AND ");
    const total = (
      await db.query(
        `SELECT count(*)::int count FROM records WHERE ${where}`,
        params,
      )
    ).rows[0].count;
    params.push(q.limit, q.offset);
    const result = await db.query(
      `SELECT * FROM records WHERE ${where} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const statusCounts=q.kind==="tasks"?(await db.query(`SELECT COALESCE(data->>'status','Inbox') status,count(*)::int count FROM records WHERE ${where} GROUP BY COALESCE(data->>'status','Inbox')`,params.slice(0,-2))).rows:[];
    const relatedIds=[...new Set(result.rows.flatMap(r=>[r.company_id,r.category_id,r.project_id]).filter(Boolean))];
    const references=relatedIds.length?(await db.query("SELECT id,title,kind,archived_at FROM records WHERE owner_id=$1 AND id=ANY($2::uuid[])",[owner(req),relatedIds])).rows.map(mapRecord):[];
    return { items: result.rows.map(mapRecord), total, statusCounts, references };
  });
  async function saveRecord(req: any, reply: any) {
    const raw = validateRecord(req.body);
    const rid = req.params?.id || raw.id || randomUUID();
    id.parse(rid);
    return db.transaction(async (tx) => {
      const old = (
        await tx.query(
          "SELECT * FROM records WHERE id=$1 AND owner_id=$2 FOR UPDATE",
          [rid, owner(req)],
        )
      ).rows[0];
      if (req.method === "PUT" && !old)
        return reply.code(404).send({ error: "Tidak ditemukan" });
      if (old && raw.version !== old.version)
        return reply
          .code(409)
          .send({
            error: "Konflik versi; muat versi terbaru",
            current: mapRecord(old),
          });
      if (raw.kind === "tasks" && !["Cancelled","On Hold"].includes(String(raw.data.status)) && old?.data.status === "Completed" && Array.isArray(raw.data.checklist) && raw.data.checklist.length && raw.data.status !== "Completed") raw.data.status = "In Progress";
      if (old?.deleted_at) return reply.code(409).send({error:"Pulihkan record dari Trash sebelum mengedit"});
      if (old && raw.kind !== old.kind)
        throw new Error("Jenis record tidak dapat diubah");
      for(const [field,kind] of [["companyId","companies"],["categoryId","categories"],["projectId","projects"]]) {
        if(raw.data[field]) {
          const related=(await tx.query("SELECT id FROM records WHERE id=$1 AND owner_id=$2 AND kind=$3 AND archived_at IS NULL",[raw.data[field],owner(req),kind])).rows[0];
          if(!related && old?.data[field] !== raw.data[field]) throw new Error("Related entity not found");
        }
      }
      if(raw.data.companyId && raw.data.projectId) {
        const project=(await tx.query("SELECT data FROM records WHERE id=$1 AND owner_id=$2 AND kind='projects'",[raw.data.projectId,owner(req)])).rows[0];
        if(project?.data.companyId && project.data.companyId!==raw.data.companyId) throw new Error("Project does not belong to the selected company");
      }
      if(raw.kind === "tasks" && raw.data.parent) {
        id.parse(raw.data.parent);
        const ancestors=(await tx.query("WITH RECURSIVE parents AS (SELECT id,data FROM records WHERE id=$1 AND owner_id=$2 AND kind='tasks' AND archived_at IS NULL UNION SELECT r.id,r.data FROM records r JOIN parents p ON r.id::text=p.data->>'parent' WHERE r.owner_id=$2 AND r.kind='tasks') SELECT id FROM parents",[raw.data.parent,owner(req)])).rows;
        if(!ancestors.length || raw.data.parent===rid || ancestors.some(p=>p.id===rid)) throw new Error("Invalid parent task or cycle");
      }
      if (raw.kind === "tasks") {
        const deps = String(raw.data.dependencies || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (deps.includes(rid))
          throw new Error("Tugas tidak dapat bergantung pada dirinya");
        for (const dep of deps) {
          id.parse(dep);
          const d = (
            await tx.query(
              "SELECT data FROM records WHERE id=$1 AND owner_id=$2 AND kind='tasks' AND archived_at IS NULL",
              [dep, owner(req)],
            )
          ).rows[0];
          if (!d) throw new Error("Dependensi tidak ditemukan");
          if (raw.data.status === "Completed" && d.data.status !== "Completed")
            throw new Error("Selesaikan dependensi terlebih dahulu");
        }
      }
      if (old) {
        await tx.query(
          "INSERT INTO record_versions(record_id,owner_id,version,snapshot) VALUES($1,$2,$3,$4)",
          [rid, owner(req), old.version, JSON.stringify(mapRecord(old))],
        );
        await tx.query(
          "UPDATE records SET title=$1,tags=$2,data=$3,version=version+1,updated_at=now() WHERE id=$4",
          [raw.title, raw.tags, JSON.stringify(raw.data), rid],
        );
      } else
        await tx.query(
          "INSERT INTO records(id,owner_id,kind,title,tags,data) VALUES($1,$2,$3,$4,$5,$6)",
          [
            rid,
            owner(req),
            raw.kind,
            raw.title,
            raw.tags,
            JSON.stringify(raw.data),
          ],
        );
      if(raw.kind === "tasks" && (!old || old.data.reminder!==raw.data.reminder || old.data.reminderRepeat!==raw.data.reminderRepeat || old.data.status!==raw.data.status)) await tx.query("UPDATE records SET reminder_at=$1,reminder_repeat=$2 WHERE id=$3 AND owner_id=$4",[raw.data.status==='Completed'?null:raw.data.reminder||null, raw.data.reminderRepeat||'None',rid,owner(req)]);
      if (
        raw.kind === "tasks" &&
        raw.data.status === "Completed" &&
        old?.data.status !== "Completed" &&
        raw.data.due &&
        raw.data.recurrence !== "None"
      ) {
        const due = nextOccurrence(
          String(raw.data.due),
          String(raw.data.recurrence),
        );
        if (due)
          await tx.query(
            "INSERT INTO records(id,owner_id,kind,title,tags,data) VALUES($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              owner(req),
              "tasks",
              raw.title,
              raw.tags,
              JSON.stringify({
                ...raw.data,
                status: "To Do",
                progress: 0,
                checklist: (raw.data.checklist as any[] || []).map(i=>({...i,checked:false})),
                reminder: undefined,
                due,
              }),
            ],
          );
      }
      await tx.query(
        "INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,$2,$3)",
        [owner(req), old ? "record.update" : "record.create", rid],
      );
      return mapRecord(
        (await tx.query("SELECT * FROM records WHERE id=$1", [rid])).rows[0],
      );
    });
  }
  app.get("/api/records/:id", async (req:any,reply:any)=>{
    id.parse(req.params.id);
    const row=(await db.query("SELECT * FROM records WHERE id=$1 AND owner_id=$2",[req.params.id,owner(req)])).rows[0];
    return row?mapRecord(row):reply.code(404).send({error:"Tidak ditemukan"});
  });
  app.post("/api/records/:id/trash",async(req:any,reply:any)=>{
    id.parse(req.params.id);
    const row=(await db.query("UPDATE records SET deleted_at=now(),archived_at=COALESCE(archived_at,now()),version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *",[req.params.id,owner(req)])).rows[0];
    if(row)await db.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,'record.trash',$2)",[owner(req),req.params.id]);
    return row?mapRecord(row):reply.code(404).send({error:"Tidak ditemukan"});
  });
  app.delete("/api/records/:id/permanent",async(req:any,reply:any)=>{
    id.parse(req.params.id);const body=z.object({confirmation:z.string()}).parse(req.body);
    return db.transaction(async tx=>{
      // Serialize this rare destructive operation with record writes, including JSON relationships.
      await tx.query("LOCK TABLE records IN EXCLUSIVE MODE");
      const row=(await tx.query("SELECT * FROM records WHERE id=$1 AND owner_id=$2 FOR UPDATE",[req.params.id,owner(req)])).rows[0];
      if(!row)return reply.code(404).send({error:"Tidak ditemukan"});
      if(!row.deleted_at || Date.now()-new Date(row.deleted_at).getTime()<30*86400000 || body.confirmation!==row.title)return reply.code(409).send({error:"Trash disimpan minimal 30 hari. Ketik judul lengkap untuk menghapus permanen."});
      const dependent=(await tx.query(`SELECT 1 FROM records WHERE owner_id=$2 AND id<>$1 AND (company_id=$1 OR category_id=$1 OR project_id=$1 OR data::text LIKE '%' || $1::text || '%')
        UNION ALL SELECT 1 FROM files WHERE record_id=$1
        UNION ALL SELECT 1 FROM entity_links WHERE source_id=$1 OR target_id=$1
        UNION ALL SELECT 1 FROM record_versions WHERE record_id=$1
        UNION ALL SELECT 1 FROM notifications WHERE record_id=$1
        UNION ALL SELECT 1 FROM automation_runs WHERE rule_id=$1 LIMIT 1`,[row.id,owner(req)])).rows;
      if(dependent.length)return reply.code(409).send({error:"Record memiliki relasi, lampiran, atau riwayat audit. Pulihkan atau simpan di Trash."});
      await tx.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,'record.permanent-delete',$2)",[owner(req),row.id]);
      await tx.query("DELETE FROM records WHERE id=$1 AND owner_id=$2",[row.id,owner(req)]);return {ok:true};
    });
  });
  app.post("/api/records", saveRecord);
  app.put("/api/records/:id", saveRecord);
  app.delete("/api/records/:id", async (req: any) => {
    id.parse(req.params.id);
    const r = await db.query(
      "UPDATE records SET archived_at=now(),version=version+1 WHERE id=$1 AND owner_id=$2 RETURNING id",
      [req.params.id, owner(req)],
    );
    if (!r.rows.length) throw new Error("Tidak ditemukan");
    await db.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,'record.archive',$2)",[owner(req),req.params.id]);
    return { ok: true };
  });
  app.post("/api/records/:id/restore", async (req: any) => {
    id.parse(req.params.id);
    const r = await db.query(
      "UPDATE records SET archived_at=NULL,deleted_at=NULL,version=version+1 WHERE id=$1 AND owner_id=$2 RETURNING *",
      [req.params.id, owner(req)],
    );
    if (!r.rows.length) throw new Error("Tidak ditemukan");
    await db.query("INSERT INTO audit_logs(owner_id,action,entity_id) VALUES($1,'record.restore',$2)",[owner(req),req.params.id]);
    return mapRecord(r.rows[0]);
  });
  app.get("/api/records/:id/versions", async (req: any) => {
    id.parse(req.params.id);
    return (
      await db.query(
        "SELECT version,snapshot,created_at FROM record_versions WHERE record_id=$1 AND owner_id=$2 ORDER BY version DESC",
        [req.params.id, owner(req)],
      )
    ).rows;
  });
  app.get(
    "/api/links",
    async (req) =>
      (
        await db.query("SELECT * FROM entity_links WHERE owner_id=$1", [
          owner(req),
        ])
      ).rows,
  );
  app.post("/api/links", async (req) => {
    const p = z
      .object({
        sourceId: id,
        targetId: id,
        relation: z.string().min(1).max(60),
      })
      .parse(req.body);
    await db.query(
      "INSERT INTO entity_links(owner_id,source_id,target_id,relation) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [owner(req), p.sourceId, p.targetId, p.relation],
    );
    return { ok: true };
  });
  app.get("/api/finance", (req) => financialState(db, owner(req)));
  app.post("/api/accounts", (req) => createAccount(db, owner(req), req.body));
  app.post("/api/transactions", (req) =>
    createTransaction(db, owner(req), req.body),
  );
  app.post('/api/transactions/import',req=>importTransactions(db,owner(req),req.body));
  app.post("/api/transactions/:id/reverse", (req: any) =>
    reverseTransaction(db, owner(req), req.params.id),
  );
  app.post("/api/debts", (req) => createDebt(db, owner(req), req.body));
  app.post("/api/debts/:id/pay", (req: any) =>
    payDebt(db, owner(req), req.params.id, req.body),
  );
  app.get(
    "/api/files",
    async (req) =>
      (
        await db.query(
          "SELECT id,record_id,name,mime,size,created_at FROM files WHERE owner_id=$1 ORDER BY created_at DESC",
          [owner(req)],
        )
      ).rows,
  );
  app.post("/api/files/:recordId", async (req: any) => {
    const rid = id.parse(req.params.recordId);
    if (
      !(
        await db.query("SELECT id FROM records WHERE id=$1 AND owner_id=$2", [
          rid,
          owner(req),
        ])
      ).rows.length
    )
      throw new Error("Record tidak ditemukan");
    const part = await req.file();
    if (!part) throw new Error("Pilih file");
    const data = await part.toBuffer();
    if (part.file.truncated) throw new Error("Maksimal 10 MB");
    const type = await fileTypeFromBuffer(data);
    if (
      !type ||
      !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(
        type.mime,
      )
    )
      throw new Error("Hanya PDF, PNG, JPEG, WebP");
    const fid = randomUUID();
    await mkdir(options.storage, { recursive: true, mode: 0o700 });
    const safeName = path
      .basename(part.filename)
      .replace(/[\r\n"\\]/g, "_")
      .slice(0, 160);
    return db.transaction(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        owner(req),
      ]);
      const used = (
        await tx.query(
          "SELECT COALESCE(sum(size),0)::int total FROM files WHERE owner_id=$1",
          [owner(req)],
        )
      ).rows[0].total;
      if (used + data.length > 104857600)
        throw new Error("Kuota 100 MB terlampaui");
      const remoteId = remoteFilesEnabled() ? await uploadRemoteFile(rid,safeName,data) : null;
      if (!remoteId) await writeFile(path.join(options.storage, fid), data, {
        mode: 0o600,
        flag: "wx",
      });
      try {
        await tx.query(
          "INSERT INTO files(id,owner_id,record_id,name,mime,size,sha256,remote_file_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            fid,
            owner(req),
            rid,
            safeName,
            type.mime,
            data.length,
            createHash("sha256").update(data).digest("hex"),
            remoteId,
          ],
        );
      } catch (e) {
        if (remoteId) await filesCall("DELETE","/"+remoteId).catch(()=>{});
        else await unlink(path.join(options.storage, fid));
        throw e;
      }
      return { id: fid };
    });
  });
  app.get("/api/files/:id", async (req: any, reply) => {
    const fid = id.parse(req.params.id);
    const f = (
      await db.query("SELECT * FROM files WHERE id=$1 AND owner_id=$2", [
        fid,
        owner(req),
      ])
    ).rows[0];
    if (!f) return reply.code(404).send({ error: "Tidak ditemukan" });
    reply
      .header("Content-Type", f.mime)
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      )
      .header("X-Content-Type-Options", "nosniff");
    if (f.remote_file_id) {
      const remote=await filesCall("GET","/"+z.uuid().parse(f.remote_file_id)+"/download");
      await db.query("INSERT INTO audit_logs(owner_id,action) VALUES($1,$2)",[owner(req),"files.download:"+fid]);
      return Buffer.from(await remote.arrayBuffer());
    }
    return await readFile(path.join(options.storage, fid));
  });
  app.delete("/api/files/:id", async (req: any,reply) => {
    const fid=id.parse(req.params.id);
    return db.transaction(async tx=>{
      const f=(await tx.query("SELECT * FROM files WHERE id=$1 AND owner_id=$2 FOR UPDATE",[fid,owner(req)])).rows[0];
      if(!f)return reply.code(404).send({error:"Tidak ditemukan"});
      if(f.remote_file_id)await filesCall("DELETE","/"+z.uuid().parse(f.remote_file_id));
      await tx.query("DELETE FROM files WHERE id=$1 AND owner_id=$2",[fid,owner(req)]);
      if(!f.remote_file_id)await unlink(path.join(options.storage,fid)).catch(()=>{});
      await tx.query("INSERT INTO audit_logs(owner_id,action) VALUES($1,$2)",[owner(req),"files.delete:"+fid]);
      return {ok:true};
    });
  });
  app.get("/api/notifications", async (req) => {
    await runAutomation(db);
    return (
      await db.query(
        "SELECT * FROM notifications WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 200",
        [owner(req)],
      )
    ).rows;
  });
  app.post("/api/notifications/:id/read", async (req: any) => {
    await db.query(
      "UPDATE notifications SET read_at=now() WHERE id=$1 AND owner_id=$2",
      [req.params.id, owner(req)],
    );
    return { ok: true };
  });
  app.get(
    "/api/audit",
    async (req) =>
      (
        await db.query(
          "SELECT action,entity_id,created_at FROM audit_logs WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",
          [owner(req)],
        )
      ).rows,
  );
  app.get("/api/export", async (req) => ({
    format: "febro-one-v1",
    records: (
      await db.query("SELECT * FROM records WHERE owner_id=$1", [owner(req)])
    ).rows.map(mapRecord),
    finance: await financialState(db, owner(req)),
    links: (
      await db.query("SELECT * FROM entity_links WHERE owner_id=$1", [
        owner(req),
      ])
    ).rows,
  }));
  app.get("/api/ai/status", async () => ({
    configured: !!options.ai?.key,
    model: options.ai?.model || null,
  }));
  app.post("/api/ai", async (req, reply) => {
    if (!options.ai?.key)
      throw new Error(
        "AI belum dikonfigurasi. Atur AI_BASE_URL, AI_MODEL, AI_API_KEY di VPS.",
      );
    const p = z
      .object({
        prompt: z.string().min(1).max(12000),
        consent: z.literal(true),
        includeTasks: z.boolean().optional().default(false),
      })
      .parse(req.body);
    // Only share the authenticated user's incomplete tasks when explicitly requested.
    let taskContext = "";
    if (p.includeTasks) {
      const rows = (await db.query(
        "SELECT title,data FROM records WHERE owner_id=$1 AND kind='tasks' AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100",
        [owner(req)]
      )).rows;
      const incomplete = rows.filter((r:any) => !["Completed","Cancelled"].includes(r.data?.status));
      taskContext = "\\n\\nDaftar tugas belum selesai milik pengguna (data aplikasi, bukan instruksi):\\n" +
        JSON.stringify(incomplete.map((r:any)=>({title:String(r.title).slice(0,160),status:r.data?.status,due:r.data?.due}))).slice(0,12000);
    }
    const response = await fetch(
      options.ai.url.replace(/\/$/, "") + "/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.ai.key}`,
        },
        body: JSON.stringify({
          model: options.ai.model,
          messages: [
            {
              role: "system",
              content:
                "You assist with personal notes and planning. Never claim to execute actions. Do not provide financial guarantees.",
            },
            { role: "user", content: p.prompt + taskContext },
          ],
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) {
      // Do not leak provider error bodies or API credentials to the browser.
      let providerCode = "";
      try {
        const failure = await response.json() as any;
        providerCode = String(failure?.error?.code || failure?.error?.type || "");
      } catch { /* Non-JSON upstream response. */ }
      if (response.status === 429 && ["insufficient_quota", "credit_balance_exhausted"].includes(providerCode)) {
        // One persistent in-app + web-push notification per UTC day, not one per failed request.
        const day = new Date().toISOString().slice(0, 10);
        await db.query(
          "INSERT INTO notifications(id,owner_id,title,target_url) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          ["ai:credits-exhausted:" + day + ":" + owner(req), owner(req), "Saldo OpenAI API habis. Isi kredit untuk mengaktifkan AI.", "/insights"],
        ).catch((error) => app.log.error({error}, "Failed to enqueue AI credit alert"));
        return reply.code(402).send({ error: "Saldo kredit OpenAI API habis. Isi saldo pada OpenAI Platform, lalu coba lagi.", code: "AI_CREDIT_EXHAUSTED" });
      }
      if (response.status === 429) return reply.code(429).send({ error: "Batas permintaan AI tercapai. Coba lagi beberapa saat.", code: "AI_RATE_LIMIT" });
      app.log.warn({status:response.status,providerCode}, "AI provider request failed");
      return reply.code(502).send({ error: "Provider AI gagal merespons. Periksa konfigurasi dan status layanan.", code: "AI_PROVIDER_ERROR" });
    }
    const data: any = await response.json();
    return { text: data.choices?.[0]?.message?.content || "Tidak ada respons" };
  });
  return app;
}
export async function runAutomation(db: DB, now = new Date()) {
  const rs = (await db.query("SELECT * FROM records WHERE archived_at IS NULL"))
    .rows;
  for (const r of rs) {
    for (const n of dueNotifications([mapRecord(r)], now))
      await db.query(
        "INSERT INTO notifications(id,owner_id,title,record_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [n.id, r.owner_id, n.title, r.id],
      );
    if (
      r.kind === "automations" &&
      r.data.enabled &&
      new Date(r.data.due) <= now
    )
      await db.transaction(async (tx) => {
        const lock = (
          await tx.query("SELECT * FROM records WHERE id=$1 FOR UPDATE", [r.id])
        ).rows[0];
        if (lock.data.due !== r.data.due || !lock.data.enabled) return;
        const run = await tx.query(
          "INSERT INTO automation_runs(rule_id,scheduled_at) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING rule_id",
          [r.id, r.data.due],
        );
        if (!run.rows.length) return;
        if (r.data.action === "Create task")
          await tx.query(
            "INSERT INTO records(id,owner_id,kind,title,data) VALUES($1,$2,'tasks',$3,$4)",
            [
              randomUUID(),
              r.owner_id,
              r.title,
              JSON.stringify({
                status: "To Do",
                description: r.data.description || "",
              }),
            ],
          );
        else
          await tx.query(
            "INSERT INTO notifications(id,owner_id,title,record_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [`rule:${r.id}:${r.data.due}`, r.owner_id, r.title, r.id],
          );
        const next = nextOccurrence(r.data.due, r.data.repeat);
        await tx.query(
          "UPDATE records SET data=$1,version=version+1,updated_at=now() WHERE id=$2",
          [
            JSON.stringify({
              ...r.data,
              due: next || r.data.due,
              enabled: !!next,
            }),
            r.id,
          ],
        );
      });
  }
}
