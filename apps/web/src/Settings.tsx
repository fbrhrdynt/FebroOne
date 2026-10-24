import PushSettings from "./PushSettings";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, PageHeader, Field, ErrorText } from "./ui";
import * as store from "./store";
export default function Settings() {
  const q = useQueryClient();
  const [discardId,setDiscardId]=useState("");
  const { data } = useQuery({
    queryKey: ["identity"],
    queryFn: store.identity,
  });
  const { data: files = [] } = useQuery({
    queryKey: ["files"],
    queryFn: store.getFiles,
  });
  const queue = useQuery({
    queryKey: ["queue"],
    queryFn: () => store.local.queue.toArray(),
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => (store.trial ? Promise.resolve([]) : store.api("/audit")),
  });
  const sessions = useQuery({queryKey:["sessions"],queryFn:()=>store.api("/auth/sessions"),enabled:!store.trial});
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Tampilan, privasi, dan data Anda."
      />
      <ErrorText error={error} />
      {message && <div className="notice">{message}</div>}
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Profil & tampilan</h2>
          {data && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const d = Object.fromEntries(new FormData(e.currentTarget));
                  await store.preferences({
                    ...d,
                    maskMoney: d.maskMoney === "on",
                    widgets: data.user.preferences.widgets || [
                      "tasks",
                      "agenda",
                      "finance",
                      "career",
                      "notes",
                    ],
                  });
                  await q.invalidateQueries();
                  document.documentElement.classList.toggle(
                    "dark",
                    d.theme === "dark" ||
                      (d.theme === "system" &&
                        matchMedia("(prefers-color-scheme: dark)").matches),
                  );
                  localStorage.setItem("theme", String(d.theme));
                  setMessage("Pengaturan disimpan.");
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <Field label="Nama">
                <input name="name" required defaultValue={data.user.name} />
              </Field>
              <Field label="Zona waktu">
                <select
                  name="timezone"
                  defaultValue={
                    data.user.preferences.timezone || "Asia/Jakarta"
                  }
                >
                  {[
                    "Asia/Jakarta",
                    "Asia/Makassar",
                    "Asia/Jayapura",
                    "UTC",
                  ].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tema">
                <select
                  name="theme"
                  defaultValue={data.user.preferences.theme || "light"}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </Field>
              <Field label="Sembunyikan saldo pada dashboard">
                <input
                  type="checkbox"
                  name="maskMoney"
                  defaultChecked={data.user.preferences.maskMoney}
                />
              </Field>
              <Button type="submit">Simpan pengaturan</Button>
            </form>
          )}
        </section>
        <section className="panel">
          <h2>Data & backup</h2>
          <p>
            {store.trial
              ? "Trial menyimpan data hanya di browser ini. Hapus data browser akan menghapus workspace trial."
              : "Data utama tersimpan di PostgreSQL. Draft catatan offline disimpan di perangkat ini sampai tersinkron."}
          </p>
          <p>
            Penyimpanan lampiran:{" "}
            {(
              files.reduce((a: number, f: any) => a + f.size, 0) / 1048576
            ).toFixed(2)}{" "}
            / 100 MB
          </p>
          <div className="form-stack">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  store.download(
                    "febro-one-export.json",
                    JSON.stringify(await store.exportData(), null, 2),
                    "application/json",
                  );
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Export data JSON
            </Button>
            <p className="hint">
              Ekspor JSON berisi record dan data finansial, tanpa file lampiran.
              Backup lengkap VPS memakai script backup terenkripsi.
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.storage?.persist?.();
                setMessage(
                  "Permintaan penyimpanan persisten dikirim ke browser. Tetap simpan backup.",
                );
              }}
            >
              Minta penyimpanan browser persisten
            </Button>
          </div>
        </section>
        <section className="panel">
          <h2>Sinkronisasi offline</h2>
          <p>
            {store.trial
              ? "Semua perubahan trial disimpan secara lokal; tidak disinkronkan ke VPS."
              : "Draft notes offline memiliki antrian dan pemeriksaan versi. Transaksi finansial memerlukan koneksi."}
          </p>
          {!store.trial && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await store.syncQueue();
                  await q.invalidateQueries();
                  setMessage("Sinkronisasi selesai.");
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Sinkronkan sekarang
            </Button>
          )}
          {queue.data?.map((item) => (
            <div key={item.id} className="notice">
              {item.payload.title} · {item.status}
              {item.status === "conflict" && (
                <>
                  <p>
                    Server sudah memiliki versi baru. Download draft sebelum
                    mengambil versi server.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      store.download(
                        "conflict-draft.json",
                        JSON.stringify(item.payload, null, 2),
                      )
                    }
                  >
                    Download draft
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if(discardId!==item.id){setDiscardId(item.id);return;}
                      await store.local.records.put(item.current);
                      await store.local.queue.delete(item.id);
                      await q.invalidateQueries();
                    }}
                  >
                    {discardId===item.id?"Konfirmasi buang draft lokal":"Gunakan server"}
                  </Button>
                </>
              )}
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Security & integrations</h2>
          <p>
            SSO: belum diaktifkan. Endpoint Febro Ecosystem belum diverifikasi.
            Gunakan login lokal pada instalasi VPS.
          </p>
          <p>
            MFA: belum tersedia pada rilis ini. Pemulihan akun memakai kode
            sekali pakai yang diberikan saat membuat admin.
          </p>
          <p>
            {store.trial
              ? "Trial ini berada pada Site privat. Jangan gunakan browser bersama untuk data sensitif."
              : "Sesi memakai cookie HttpOnly, Secure, dan SameSite. Logout menghapus cache lokal perangkat."}
          </p>
          {!store.trial && (
            <Button
              variant="outline"
              onClick={() => store.logout().catch(setError)}
            >
              Keluar & hapus cache lokal
            </Button>
          )}
        </section>
      </div>
      <div className="settings-security-grid">
      <PushSettings />
      {!store.trial && <section className="panel"><h2>Sesi aktif</h2><p>Kelola akses akun Anda pada perangkat lain.</p><ErrorText error={sessions.error}/>{sessions.data?.items.map((s:any,i:number)=><div className="row" key={i}><div><strong>{s.current?"Perangkat ini":"Sesi lainnya"}</strong><small>Dibuka {new Date(s.created_at).toLocaleString("id-ID")} · Berakhir {new Date(s.expires_at).toLocaleDateString("id-ID")}</small></div></div>)}<Button variant="outline" onClick={async()=>{try{await store.api("/auth/sessions/revoke-others","POST",{});await q.invalidateQueries({queryKey:["sessions"]});setMessage("Sesi perangkat lain telah diakhiri.");}catch(e){setError(e)}}}>Akhiri sesi perangkat lain</Button></section>}
      </div>
      {!store.trial && (
        <section className="panel">
          <h2>Audit log terbaru</h2>
          {audit.data?.map((a: any, i: number) => (
            <p key={i}>
              {new Date(a.created_at).toLocaleString("id-ID")} · {a.action}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
