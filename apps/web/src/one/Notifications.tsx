import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CalendarClock, CheckCheck, Landmark, Zap, X, Circle, CircleCheck, Trash2 } from "lucide-react";
import * as store from "../store";
import { kindMeta } from "./kinds";
import { Segmented, Empty, ErrorNote, PageHead, cx } from "./ui";
import { todayKey, dayKey, addDays } from "./data";

export type Notice = { id: string; title: string; record_id: string | null; record_kind: string | null; read_at: string | null; created_at: string; kind: "debt" | "reminder" | "automation" | "due" };

export const useNotifications = () =>
  useQuery<Notice[]>({ queryKey: ["notifications"], queryFn: () => store.api("/notifications?limit=200"), refetchInterval: 60_000 });

const kindInfo: Record<Notice["kind"], { label: string; icon: any; tint: string }> = {
  debt: { label: "Cicilan", icon: Landmark, tint: "var(--warn)" },
  reminder: { label: "Pengingat", icon: BellRing, tint: "var(--c-today)" },
  automation: { label: "Otomasi", icon: Zap, tint: "var(--c-notes)" },
  due: { label: "Jatuh tempo", icon: CalendarClock, tint: "var(--c-work)" },
};

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function group(iso: string) {
  const d = dayKey(iso), t = todayKey();
  if (d === t) return "Hari ini";
  if (d === addDays(t, -1)) return "Kemarin";
  if (d >= addDays(t, -6)) return "Minggu ini";
  return "Lebih lama";
}
export const noticeLink = (n: Notice) => (n.kind === "debt" ? "/debts" : n.record_id ? `/r/${n.record_id}` : null);

/** The full notification centre: used in the bell sheet and on /notifications. */
export function NotificationCenter({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const q = useQueryClient();
  const navigate = useNavigate();
  const list = useNotifications();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>();
  const items = list.data || [];
  const unread = items.filter((n) => !n.read_at);
  const shown = tab === "unread" ? unread : items;
  const groups = useMemo(() => {
    const m = new Map<string, Notice[]>();
    for (const n of shown) m.set(group(n.created_at), [...(m.get(group(n.created_at)) || []), n]);
    return [...m.entries()];
  }, [shown]);

  async function act(key: string, path: string) {
    setBusy(key); setError(undefined);
    // Optimistic: the list reflects the change at once; the refetch confirms it.
    q.setQueryData<Notice[]>(["notifications"], (old = []) => {
      if (path.endsWith("/read-all")) return old.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }));
      if (path.endsWith("/clear-read")) return old.filter((n) => !n.read_at);
      const id = decodeURIComponent(path.split("/")[2] || "");
      if (path.endsWith("/dismiss")) return old.filter((n) => n.id !== id);
      if (path.endsWith("/unread")) return old.map((n) => (n.id === id ? { ...n, read_at: null } : n));
      if (path.endsWith("/read")) return old.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n));
      return old;
    });
    try { await store.api(path, "POST", {}); }
    catch (e) { setError(e); }
    finally { setBusy(""); await q.invalidateQueries({ queryKey: ["notifications"] }); }
  }
  const path = (n: Notice, action: string) => `/notifications/${encodeURIComponent(n.id)}/${action}`;
  const open = async (n: Notice) => {
    if (!n.read_at) act(n.id, path(n, "read"));
    const to = noticeLink(n);
    if (to) { onNavigate?.(); navigate(to); }
  };

  return (
    <div className={cx("o-notices", compact && "compact")}>
      <div className="o-notice-bar">
        <Segmented label="Filter notifikasi" value={tab} onChange={setTab}
          options={[{ value: "unread", label: "Belum dibaca", count: unread.length }, { value: "all", label: "Semua" }]} />
        <div className="o-page-actions">
          <button className="o-btn small" disabled={!unread.length || !!busy} onClick={() => act("all", "/notifications/read-all")}><CheckCheck size={15} /> Tandai semua dibaca</button>
          {tab === "all" && <button className="o-btn small ghost" disabled={!items.some((n) => n.read_at) || !!busy} onClick={() => act("clear", "/notifications/clear-read")}><Trash2 size={14} /> Bersihkan yang dibaca</button>}
        </div>
      </div>
      <ErrorNote error={error || list.error} />
      {list.isPending ? <div className="o-skel" /> : groups.length ? groups.map(([title, rows]) => (
        <section key={title} className="o-section">
          <header><h2>{title}</h2></header>
          <div className="o-list">
            {rows.map((n) => {
              const info = kindInfo[n.kind] || kindInfo.due;
              const Icon = n.record_kind ? kindMeta(n.record_kind).icon : info.icon;
              const link = noticeLink(n);
              return (
                <div key={n.id} className={cx("o-notice", !n.read_at && "unread")}>
                  <button type="button" className="o-notice-main" onClick={() => open(n)} disabled={!link && !!n.read_at}>
                    <span className="o-notice-dot" aria-hidden />
                    <span className="o-kind-icon" style={{ "--tint": info.tint } as React.CSSProperties}><Icon size={16} /></span>
                    <span className="o-row-main">
                      <span className="o-row-title">{n.title}</span>
                      <span className="o-row-meta"><span>{info.label}</span><span>·</span><span>{ago(n.created_at)}</span>{!n.read_at && <span className="sr-only">Belum dibaca</span>}</span>
                    </span>
                  </button>
                  <div className="o-notice-actions">
                    <button type="button" className="o-icon-btn" disabled={busy === n.id}
                      aria-label={n.read_at ? `Tandai belum dibaca: ${n.title}` : `Tandai dibaca: ${n.title}`} title={n.read_at ? "Tandai belum dibaca" : "Tandai dibaca"}
                      onClick={() => act(n.id, path(n, n.read_at ? "unread" : "read"))}>
                      {n.read_at ? <Circle size={16} /> : <CircleCheck size={17} />}
                    </button>
                    <button type="button" className="o-icon-btn" disabled={busy === n.id} aria-label={`Hapus notifikasi: ${n.title}`} title="Hapus"
                      onClick={() => act(n.id, path(n, "dismiss"))}><X size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )) : (
        <Empty icon={<Bell size={18} />} title={tab === "unread" ? "Semua sudah dibaca" : "Belum ada notifikasi"}
          text={tab === "unread" ? "Notifikasi baru tentang task, agenda, dan cicilan akan muncul di sini." : "Pengingat task, agenda, dan cicilan akan muncul di sini."} />
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <>
      <PageHead title="Notifikasi" subtitle="Pengingat task, agenda, otomasi, dan cicilan." />
      <NotificationCenter />
    </>
  );
}
