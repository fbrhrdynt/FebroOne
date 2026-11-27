import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, LogOut, Download, RefreshCw, HardDrive, BellRing, X, Smartphone, MonitorSmartphone, Save } from "lucide-react";
import * as store from "../store";
import { useIdentity } from "./data";
import { Section, Row, ErrorNote, PageHead, cx } from "./ui";
import { AuditTable } from "./AuditTable";

const when = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const zones = (() => {
  try { return (Intl as any).supportedValuesOf("timeZone").filter((z: string) => /^(Asia|Australia|Europe|America|Pacific|UTC)/.test(z)); }
  catch { return ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "UTC"]; }
})();

function Status({ text, error }: { text?: string; error?: unknown }) {
  if (error) return <ErrorNote error={error} />;
  return text ? <p className="o-row-meta" role="status" style={{ margin: "8px 2px 0" }}>{text}</p> : null;
}

export default function Settings() {
  return (
    <>
      <PageHead title="Pengaturan" subtitle="Profil, keamanan, notifikasi, dan data." />
      <div className="o-grid-2">
        <div><Profile /><Passkeys /><Sessions /></div>
        <div><DevicePush /><DataTools /><Account /></div>
      </div>
      <Section title="Audit log" action={<span className="o-row-meta">300 aktivitas terbaru</span>}><AuditTable /></Section>
    </>
  );
}

function Profile() {
  const identity = useIdentity();
  const q = useQueryClient();
  const user = identity.data?.user;
  const prefs = user?.preferences || {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<unknown>();
  if (!user) return <div className="o-skel" />;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(""); setError(undefined);
    try {
      await store.preferences({
        name: String(f.get("name") || "").trim(), timezone: String(f.get("timezone")),
        widgets: Array.isArray(prefs.widgets) ? prefs.widgets.slice(0, 20) : ["tasks", "agenda", "finance"],
        theme: "dark", maskMoney: f.get("maskMoney") === "on",
      });
      await q.invalidateQueries({ queryKey: ["identity"] });
      setMsg("Tersimpan.");
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return (
    <Section title="Profil">
      <form className="o-card o-form" style={{ padding: 16 }} onSubmit={save}>
        <label className="o-field"><span>Nama</span><input className="o-input" name="name" defaultValue={user.name} required maxLength={100} /></label>
        <label className="o-field"><span>Email</span><input className="o-input" value={user.email} disabled /></label>
        <label className="o-field"><span>Zona waktu</span>
          <select className="o-input" name="timezone" defaultValue={prefs.timezone || "Asia/Jakarta"}>
            {[...new Set([prefs.timezone || "Asia/Jakarta", ...zones])].map((z) => <option key={z}>{z}</option>)}
          </select></label>
        <label className="o-toggle"><input type="checkbox" name="maskMoney" defaultChecked={!!prefs.maskMoney} /><span><b>Sembunyikan nominal uang</b><small>Saldo disamarkan sampai Anda menampilkannya.</small></span></label>
        <button className="o-btn primary" disabled={busy}><Save size={15} /> {busy ? "Menyimpan…" : "Simpan profil"}</button>
        <Status text={msg} error={error} />
      </form>
    </Section>
  );
}

function Passkeys() {
  const q = useQueryClient();
  const list = useQuery<{ items: any[] }>({ queryKey: ["passkeys"], queryFn: () => store.api("/auth/passkeys") });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<unknown>();
  const [confirm, setConfirm] = useState("");
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key); setMsg(""); setError(undefined);
    try { await fn(); await q.invalidateQueries({ queryKey: ["passkeys"] }); setMsg(ok); setConfirm(""); } catch (e) { setError(e); } finally { setBusy(""); }
  };
  const items = list.data?.items || [];
  return (
    <Section title="Passkey" count={items.length || undefined}>
      <div className="o-list">
        {items.map((p) => (
          <Row key={p.id} icon={<span className="o-kind-icon" style={{ "--tint": "var(--accent)" } as React.CSSProperties}><Fingerprint size={16} /></span>}
            title={p.name} meta={`Dibuat ${when(p.created_at)}${p.last_used_at ? ` · dipakai ${when(p.last_used_at)}` : ""}`}
            trailing={confirm === p.id
              ? <span style={{ display: "flex", gap: 6 }}><button className="o-btn small danger" disabled={!!busy} onClick={() => run(p.id, () => store.api(`/auth/passkeys/${p.id}`, "DELETE"), "Passkey dihapus.")}>Hapus</button><button className="o-btn small ghost" onClick={() => setConfirm("")}>Batal</button></span>
              : <button className="o-icon-btn" aria-label={`Hapus passkey ${p.name}`} onClick={() => setConfirm(p.id)}><X size={16} /></button>} />
        ))}
        {!items.length && !list.isPending && <div style={{ padding: 14 }} className="o-row-meta">Belum ada passkey. Passkey memakai Face ID / Touch ID sehingga tidak perlu mengetik kata sandi.</div>}
      </div>
      <button className="o-btn primary block" style={{ marginTop: 10 }} disabled={!supported || busy === "add"}
        onClick={() => run("add", () => store.registerPasskey(`Febro One · ${new Date().toLocaleDateString("id-ID")}`), "Passkey ditambahkan.")}>
        <Fingerprint size={16} /> {busy === "add" ? "Menunggu Face ID / Touch ID…" : "Tambah passkey perangkat ini"}
      </button>
      {!supported && <p className="o-row-meta" style={{ marginTop: 8 }}>Browser ini tidak mendukung passkey.</p>}
      <Status text={msg} error={error} />
    </Section>
  );
}

function Sessions() {
  const q = useQueryClient();
  const list = useQuery<{ items: any[] }>({ queryKey: ["sessions"], queryFn: () => store.api("/auth/sessions") });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<unknown>();
  const items = list.data?.items || [];
  const others = items.filter((s) => !s.current).length;
  return (
    <Section title="Sesi aktif" count={items.length || undefined}>
      <div className="o-list">
        {items.map((s, i) => (
          <Row key={i} icon={<span className="o-kind-icon" style={{ "--tint": s.current ? "var(--c-money)" : "var(--muted)" } as React.CSSProperties}><MonitorSmartphone size={16} /></span>}
            title={s.current ? "Perangkat ini" : "Perangkat lain"} meta={`Masuk ${when(s.created_at)} · berakhir ${when(s.expires_at)}`}
            trailing={s.current ? <span className="o-tag ok">Aktif</span> : undefined} />
        ))}
      </div>
      <button className="o-btn block" style={{ marginTop: 10 }} disabled={!others || busy}
        onClick={async () => { setBusy(true); setMsg(""); setError(undefined); try { await store.api("/auth/sessions/revoke-others", "POST", {}); await q.invalidateQueries({ queryKey: ["sessions"] }); setMsg("Sesi lain sudah diakhiri."); } catch (e) { setError(e); } finally { setBusy(false); } }}>
        {others ? `Akhiri ${others} sesi lain` : "Tidak ada sesi lain"}
      </button>
      <Status text={msg} error={error} />
    </Section>
  );
}

function DevicePush() {
  const q = useQueryClient();
  const push = useQuery<any>({ queryKey: ["push"], queryFn: () => store.api("/push") });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<unknown>();
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone;
  async function enable() {
    setBusy(true); setMsg(""); setError(undefined);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Izin notifikasi belum diberikan. Ubah di pengaturan browser atau iPhone.");
      const reg = await navigator.serviceWorker.ready;
      const key = push.data.publicKey as string;
      const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }));
      await store.api("/push", "POST", { subscription: sub.toJSON(), label: /iPhone|iPad/.test(navigator.userAgent) ? "iPhone / iPad" : /Android/.test(navigator.userAgent) ? "Android" : "Browser desktop" });
      await q.invalidateQueries({ queryKey: ["push"] });
      setMsg("Perangkat ini akan menerima notifikasi.");
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  const devices: any[] = push.data?.devices || [];
  return (
    <Section title="Notifikasi perangkat" count={devices.length || undefined}>
      {devices.length > 0 && (
        <div className="o-list" style={{ marginBottom: 10 }}>
          {devices.map((d) => (
            <Row key={d.id} icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-today)" } as React.CSSProperties}><Smartphone size={16} /></span>}
              title={d.label} meta={`Terdaftar ${when(d.created_at)}`}
              trailing={<button className="o-icon-btn" aria-label={`Hapus perangkat ${d.label}`} onClick={async () => { try { await store.api(`/push/${d.id}`, "DELETE"); await q.invalidateQueries({ queryKey: ["push"] }); } catch (e) { setError(e); } }}><X size={16} /></button>} />
          ))}
        </div>
      )}
      <button className="o-btn primary block" disabled={!supported || busy || !push.data} onClick={enable}>
        <BellRing size={16} /> {busy ? "Meminta izin…" : "Aktifkan notifikasi di perangkat ini"}
      </button>
      {!supported && (
        <p className="o-row-meta" style={{ marginTop: 8 }}>
          {/iPhone|iPad/.test(navigator.userAgent) && !standalone
            ? "Di iPhone: buka one.febro.id di Safari → Bagikan → Tambahkan ke Layar Utama, lalu buka dari ikon itu (iOS 16.4+)."
            : "Browser ini belum mendukung notifikasi push. Notifikasi tetap tersedia di ikon lonceng."}
        </p>
      )}
      <Status text={msg} error={error} />
    </Section>
  );
}

function DataTools() {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<unknown>();
  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key); setMsg(""); setError(undefined);
    try { setMsg(await fn()); } catch (e) { setError(e); } finally { setBusy(""); }
  };
  return (
    <Section title="Data">
      <div className="o-list">
        <Row onClick={() => run("export", async () => { store.download(`febro-one-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await store.exportData(), null, 2), "application/json"); return "File ekspor diunduh."; })}
          icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-work)" } as React.CSSProperties}><Download size={16} /></span>}
          title={busy === "export" ? "Menyiapkan…" : "Ekspor semua data (JSON)"} meta="Catatan, task, keuangan, dan tautan" />
        <Row onClick={() => run("sync", async () => { await store.syncQueue(); return "Sinkronisasi selesai."; })}
          icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-money)" } as React.CSSProperties}><RefreshCw size={16} /></span>}
          title={busy === "sync" ? "Menyinkronkan…" : "Sinkronkan sekarang"} meta="Kirim draf catatan yang dibuat saat offline" />
        <Row onClick={() => run("persist", async () => (navigator.storage?.persist && (await navigator.storage.persist()) ? "Browser menyimpan data offline secara persisten." : "Browser menolak; data offline tetap bisa dihapus browser saat penyimpanan penuh."))}
          icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-notes)" } as React.CSSProperties}><HardDrive size={16} /></span>}
          title="Simpan data offline secara persisten" meta="Minta browser agar tidak menghapus cache otomatis" />
      </div>
      <Status text={msg} error={error} />
    </Section>
  );
}

function Account() {
  const [confirm, setConfirm] = useState(false);
  return (
    <Section title="Akun">
      {confirm ? (
        <div className="o-card" style={{ padding: 14, display: "grid", gap: 10 }}>
          <span>Keluar dari perangkat ini? Cache lokal juga dihapus.</span>
          <div className="o-page-actions"><button className="o-btn danger small" onClick={() => store.logout()}><LogOut size={15} /> Ya, keluar</button><button className="o-btn ghost small" onClick={() => setConfirm(false)}>Batal</button></div>
        </div>
      ) : <button className={cx("o-btn danger block")} onClick={() => setConfirm(true)}><LogOut size={16} /> Keluar</button>}
    </Section>
  );
}

