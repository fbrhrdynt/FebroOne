import Dexie, { type Table } from "dexie";
import {
  validateRecord,
  txSchema,
  minor,
  major,
  postings,
  debtSchema,
  nextOccurrence,
  dueNotifications,
} from "../../../packages/shared/domain";
import type { RecordItem } from "../../../packages/shared/catalog";
export const trial = import.meta.env.VITE_TRIAL === "true";
export class LocalDB extends Dexie {
  records!: Table<RecordItem, string>;
  state!: Table<{ key: string; value: any }, string>;
  files!: Table<any, string>;
  queue!: Table<any, string>;
  versions!: Table<any, string>;
  constructor() {
    super(trial ? "febro-one-trial-v1" : "febro-one-offline-v1");
    this.version(1).stores({
      records: "id,kind,updatedAt",
      state: "key",
      files: "id,record_id",
      queue: "id",
      versions: "id,recordId",
    });
  }
}
export const local = new LocalDB();
let csrf = "";
export async function api(path: string, method = "GET", body?: any) {
  const res = await fetch("/api" + path, {
    method,
    headers: {
      ...(body === undefined || body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "x-csrf-token": csrf,
    },
    credentials: "same-origin",
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || "Permintaan gagal");
    err.status = res.status;
    err.current = data.current;
    throw err;
  }
  return data;
}
export const getState = async (key: string, fallback: any) =>
  (await local.state.get(key))?.value ?? fallback;
export const putState = async (key: string, value: any) =>
  local.state.put({ key, value });
export async function identity() {
  if (trial)
    return {
      user: await getState("profile", {
        id: "trial",
        name: "Workspace saya",
        email: "",
        preferences: {
          timezone: "Asia/Jakarta",
          widgets: ["tasks", "agenda", "finance", "career", "notes"],
          theme: "light",
        },
      }),
    };
  const r = await api("/auth/me");
  csrf = r.csrf;
  return r;
}
export async function login(email: string, password: string) {
  const r = await api("/auth/login", "POST", { email, password });
  csrf = r.csrf;
  return r;
}
export async function logout() {
  if (!trial) await api("/auth/logout", "POST");
  csrf = "";
  await local.delete();
  location.reload();
}
export async function records(
  kind?: string,
  archived = false,
): Promise<RecordItem[]> {
  if (trial) {
    const rows = (await local.records.toArray()).filter(
      (r) => (!kind || r.kind === kind) && !!r.archivedAt === archived,
    );
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  try {
    let items: RecordItem[] = [],
      offset = 0,
      total = 0;
    do {
      const page = await api(
        `/records?limit=500&offset=${offset}&archived=${archived}${kind ? "&kind=" + encodeURIComponent(kind) : ""}`,
      );
      items.push(...page.items);
      total = page.total;
      offset += 500;
    } while (offset < total);
    if (!kind && !archived) {
      await local.records.clear();
      await local.records.bulkPut(items);
    }
    return items;
  } catch (e) {
    if (navigator.onLine) throw e;
    return (await local.records.toArray()).filter(
      (r) => (!kind || r.kind === kind) && !!r.archivedAt === archived,
    );
  }
}
export async function saveRecord(raw: any): Promise<RecordItem> {
  const parsed = validateRecord(raw);
  if (!trial && navigator.onLine) {
    const saved = await api(
      parsed.id ? "/records/" + parsed.id : "/records",
      parsed.id ? "PUT" : "POST",
      parsed,
    );
    await local.records.put(saved);
    return saved;
  }
  if (!trial && parsed.kind !== "notes")
    throw new Error("Offline: hanya draft catatan yang dapat disimpan.");
  const now = new Date().toISOString();
  const rid = parsed.id || crypto.randomUUID();
  return local.transaction(
    "rw",
    local.records,
    local.queue,
    local.versions,
    async () => {
      const old = await local.records.get(rid);
      if (old && parsed.version !== old.version)
        throw new Error("Konflik versi: buka ulang catatan terbaru.");
      if (parsed.kind === "tasks") {
        const deps = String(parsed.data.dependencies || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (deps.includes(rid))
          throw new Error("Tugas bergantung pada dirinya");
        for (const dep of deps) {
          const d = await local.records.get(dep);
          if (!d || d.kind !== "tasks")
            throw new Error("Dependensi tidak ditemukan");
          if (
            parsed.data.status === "Completed" &&
            d.data.status !== "Completed"
          )
            throw new Error("Selesaikan dependensi terlebih dahulu");
        }
      }
      if (old)
        await local.versions.put({
          id: rid + ":" + old.version,
          recordId: rid,
          version: old.version,
          snapshot: old,
          created_at: now,
        });
      const r: RecordItem = {
        ...parsed,
        id: rid,
        data: parsed.data,
        version: (old?.version || 0) + 1,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      await local.records.put(r);
      if (!trial) {
        const prior = await local.queue.get(rid);
        await local.queue.put({
          id: rid,
          payload: {
            ...parsed,
            id: rid,
            version: prior?.payload?.version ?? parsed.version,
          },
          isNew: prior?.isNew ?? !old,
          status: "pending",
        });
      }
      if (
        trial &&
        r.kind === "tasks" &&
        r.data.status === "Completed" &&
        old?.data.status !== "Completed" &&
        r.data.due
      ) {
        const due = nextOccurrence(r.data.due, r.data.recurrence);
        if (due)
          await local.records.put({
            ...r,
            id: crypto.randomUUID(),
            data: { ...r.data, due, status: "To Do", progress: 0 },
            version: 1,
          });
      }
      return r;
    },
  );
}
export async function archiveRecord(r: RecordItem) {
  if (!trial) return api("/records/" + r.id, "DELETE");
  await local.records.update(r.id, {
    archivedAt: new Date().toISOString(),
    version: r.version + 1,
  });
}
export async function restoreRecord(id: string) {
  if (!trial) return api("/records/" + id + "/restore", "POST");
  const r = await local.records.get(id);
  if (r)
    await local.records.update(id, {
      archivedAt: null,
      version: r.version + 1,
    });
}
export async function versions(id: string) {
  return trial
    ? local.versions.where("recordId").equals(id).reverse().toArray()
    : api("/records/" + id + "/versions");
}
export async function syncQueue() {
  if (trial) return;
  for (const q of await local.queue.toArray()) {
    if (q.status === "conflict") continue;
    try {
      const saved = await api(
        q.isNew ? "/records" : "/records/" + q.id,
        q.isNew ? "POST" : "PUT",
        q.payload,
      );
      await local.records.put(saved);
      await local.queue.delete(q.id);
    } catch (e: any) {
      if (e.status === 409)
        await local.queue.update(q.id, {
          status: "conflict",
          current: e.current,
        });
      else throw e;
    }
  }
}
export async function finance() {
  return trial
    ? getState("finance", { accounts: [], transactions: [], debts: [] })
    : api("/finance");
}
async function financeMutation(fn: (s: any) => any) {
  return local.transaction("rw", local.state, async () => {
    const s = await finance();
    const out = fn(s);
    await putState("finance", s);
    return out;
  });
}
function addTx(s: any, t: any) {
  const old = s.transactions.find((v: any) => v.key === t.key);
  if (old) {
    if (old.request !== JSON.stringify(t))
      throw new Error("Idempotency key berbeda");
    return old;
  }
  const p = postings(t);
  for (const row of p) {
    if (!row.accountId) continue;
    const a = s.accounts.find((a: any) => a.id === row.accountId);
    if (!a) throw new Error("Akun tidak ditemukan");
  }
  for (const row of p) {
    if (!row.accountId) continue;
    const a = s.accounts.find((a: any) => a.id === row.accountId);
    a.balance = major(BigInt(new DecimalSafe(a.balance).minor) + row.amount);
  }
  const out = { ...t, id: crypto.randomUUID(), request: JSON.stringify(t) };
  s.transactions.unshift(out);
  return out;
}
class DecimalSafe {
  minor: string;
  constructor(v: string) {
    const sign = v.startsWith("-") ? -1n : 1n;
    this.minor = (minor(v.replace("-", "")) * sign).toString();
  }
}
export async function addAccount(name: string, type: string, opening: string) {
  if (!name.trim()) throw new Error("Nama akun wajib diisi");
  minor(opening);
  if (!trial) return api("/accounts", "POST", { name, type, opening });
  return financeMutation((s) => {
    const a = {
      id: crypto.randomUUID(),
      name,
      type,
      currency: "IDR",
      balance: "0.00",
    };
    s.accounts.push(a);
    if (minor(opening) > 0n)
      addTx(s, {
        kind: "opening",
        accountId: a.id,
        amount: opening,
        key: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        category: "Opening",
        description: "Opening balance",
      });
    return a;
  });
}
export async function addTransaction(raw: any) {
  const p = txSchema.parse(raw);
  if (!trial) return api("/transactions", "POST", p);
  return financeMutation((s) => addTx(s, p));
}
export async function importTransactions(rows: any[]) {
  const parsed=rows.map(r=>txSchema.parse(r));
  if(!trial)return api('/transactions/import','POST',{rows:parsed});
  return financeMutation(s=>parsed.map(t=>addTx(s,t)));
}
export async function reverseTransaction(id: string) {
  if (!trial) return api("/transactions/" + id + "/reverse", "POST");
  return financeMutation((s) => {
    const t = s.transactions.find((t: any) => t.id === id);
    if (!t || t.reversed || ["opening", "reversal"].includes(t.kind))
      throw new Error("Tidak dapat dibatalkan");
    for (const p of postings(t)) {
      if (!p.accountId) continue;
      const a = s.accounts.find((a: any) => a.id === p.accountId);
      a.balance = major(BigInt(new DecimalSafe(a.balance).minor) - p.amount);
    }
    t.reversed = true;
    if (t.debtId) {
      const d = s.debts.find((d: any) => d.id === t.debtId);
      d.paid = major(minor(d.paid) - minor(t.principal));
    }
    s.transactions.unshift({
      ...t,
      id: crypto.randomUUID(),
      kind: "reversal",
      reversed: false,
      description: "Reversal: " + t.description,
    });
  });
}
export async function addDebt(raw: any) {
  const p = debtSchema.parse(raw);
  if (!trial) return api("/debts", "POST", p);
  return financeMutation((s) => {
    const d = { ...p, id: crypto.randomUUID(), paid: "0.00" };
    s.debts.push(d);
    return d;
  });
}
export async function payDebt(id: string, p: any) {
  minor(p.principal);
  minor(p.interest);
  if (!trial) return api("/debts/" + id + "/pay", "POST", p);
  return financeMutation((s) => {
    const d = s.debts.find((d: any) => d.id === id);
    if (!d) throw new Error("Utang tidak ditemukan");
    const raw = {
      kind: d.direction === "lent" ? "debt_receipt" : "debt_payment",
      accountId: p.accountId,
      amount: major(minor(p.principal) + minor(p.interest)),
      key: p.key,
      date: p.date,
      category: "Debt payment",
      description: d.name,
      debtId: d.id,
      principal: p.principal,
      interest: p.interest,
    };
    const old = s.transactions.find((t: any) => t.key === p.key);
    if (old) {
      if (old.request !== JSON.stringify(raw))
        throw new Error("Idempotency key berbeda");
      return old;
    }
    if (
      minor(p.principal) <= 0n ||
      minor(d.paid) + minor(p.principal) > minor(d.principal)
    )
      throw new Error("Pokok pembayaran tidak valid");
    const t = addTx(s, raw);
    d.paid = major(minor(d.paid) + minor(p.principal));
    return t;
  });
}
export async function getFiles() {
  return trial ? local.files.toArray() : api("/files");
}
export async function uploadFile(recordId: string, file: File) {
  if (file.size > 10485760 || file.size === 0)
    throw new Error("Ukuran file 1 byte–10 MB");
  if (
    !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(
      file.type,
    )
  )
    throw new Error("Hanya PDF, PNG, JPEG, WebP");
  if (trial) {
    const total = (await local.files.toArray()).reduce((a, f) => a + f.size, 0);
    if (total + file.size > 104857600)
      throw new Error("Kuota 100 MB terlampaui");
    return local.files.put({
      id: crypto.randomUUID(),
      record_id: recordId,
      name: file.name,
      mime: file.type,
      size: file.size,
      blob: file,
      created_at: new Date().toISOString(),
    });
  }
  const form = new FormData();
  form.append("file", file);
  return api("/files/" + recordId, "POST", form);
}
export async function downloadFile(f: any, preview = false) {
  let url;
  if (trial) url = URL.createObjectURL(f.blob);
  else {
    const r = await fetch("/api/files/" + f.id, { credentials: "same-origin" });
    if (!r.ok) throw new Error("File tidak tersedia");
    url = URL.createObjectURL(await r.blob());
  }
  if (preview) window.open(url, "_blank", "noopener");
  else {
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function deleteFile(id: string) {
  if (trial) return local.files.delete(id);
  return api("/files/" + id, "DELETE");
}
export async function getLinks() {
  return trial ? getState("links", []) : api("/links");
}
export async function addLink(
  sourceId: string,
  targetId: string,
  relation: string,
) {
  if (sourceId === targetId) throw new Error("Pilih record lain");
  if (!trial) return api("/links", "POST", { sourceId, targetId, relation });
  const links = await getLinks();
  if (
    !links.some(
      (l: any) =>
        l.source_id === sourceId &&
        l.target_id === targetId &&
        l.relation === relation,
    )
  ) {
    links.push({ source_id: sourceId, target_id: targetId, relation });
    await putState("links", links);
  }
}
export async function notifications() {
  if (!trial) return api("/notifications");
  const rs = await records();
  const read = await getState("readNotifications", []);
  return dueNotifications(rs).map((n) => ({
    ...n,
    record_id: n.recordId,
    read_at: read.includes(n.id) ? new Date().toISOString() : null,
  }));
}
export async function markRead(id: string) {
  if (!trial)
    return api("/notifications/" + encodeURIComponent(id) + "/read", "POST");
  await putState("readNotifications", [
    ...(await getState("readNotifications", [])),
    id,
  ]);
}
export async function preferences(p: any) {
  if (!trial) return api("/preferences", "PUT", p);
  await putState("profile", {
    ...(await identity()).user,
    name: p.name,
    preferences: p,
  });
}
export async function exportData() {
  return trial
    ? {
        format: "febro-one-v1",
        records: await local.records.toArray(),
        finance: await finance(),
        links: await getLinks(),
      }
    : api("/export");
}
export function download(name: string, body: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
