import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Bell, Plus, Settings, CalendarDays, LogOut, Inbox, Calculator, ChartNoAxesCombined, CloudOff } from "lucide-react";
import * as store from "../store";
import { Login } from "../App";
import { areas, kindMeta, type AreaKey } from "./kinds";
import { useIdentity, useRecords, recordHref, relDay, dayKey, setTimezone } from "./data";
import { Sheet, Row, KindIcon, Empty, cx } from "./ui";
import { QuickAdd, type QuickPreset } from "./QuickAdd";
import { QuickContext } from "./quick";
import Today from "./Today";
import Work from "./Work";
import Notes from "./Notes";
import Life from "./Life";
import RecordView from "./RecordView";
import Debts from "./Debts";
import SettingsPage from "./Settings";
import NotificationsPage, { NotificationCenter, useNotifications } from "./Notifications";
import { MoneyNav, moneyKinds, isMoneyPath } from "./MoneyNav";

const RecordPage = lazy(() => import("../RecordPage"));
const RecordsPage = lazy(() => import("../RecordsPage"));
const Calendar = lazy(() => import("../CalendarPage"));
const Finance = lazy(() => import("../FinancePage"));
const FinancePlan = lazy(() => import("../FinancePlanPage"));
const Tools = lazy(() => import("../ToolsPage"));
const Insights = lazy(() => import("../Insights"));
const Cms = lazy(() => import("../CmsPage"));
const CmsRequest = lazy(() => import("../CmsPage").then((m) => ({ default: m.CmsRequestPage })));

/** Old list URLs land on the area that now owns that kind. */
const kindHome: Record<string, string> = {
  tasks: "/work/tasks", projects: "/work/projects", companies: "/work/companies", timesheets: "/work/time",
  employments: "/work/career", trainings: "/work/career", certificates: "/work/career", achievements: "/work/career",
  work: "/work/career", competencies: "/work/career", learning: "/work/career",
  notes: "/notes", documents: "/notes/documents", templates: "/notes/templates",
  habits: "/life/habits", habitEntries: "/life/habits", goals: "/life/goals", milestones: "/life/goals",
  wellness: "/life/journal", reviews: "/life/journal", activities: "/life/journal",
  importantDates: "/life/dates", travel: "/life/travel", events: "/calendar", reminders: "/work/tasks",
  debts: "/debts", incomePlans: "/finance/plans",
};
/** Money screens share one sub-navigation that never disappears. */
const Money = ({ children }: { children: React.ReactNode }) => <><MoneyNav /><div className="o-legacy o-money">{children}</div></>;
function RecordsRoute() {
  const { kind = "" } = useParams();
  if (kindHome[kind]) return <Navigate to={kindHome[kind]} replace />;
  if (moneyKinds.includes(kind)) return <Money><RecordsPage key={kind} /></Money>;
  return <div className="o-legacy"><RecordsPage key={kind} /></div>;
}
function OldDetailRoute() {
  const { id = "" } = useParams();
  return <Navigate to={`/r/${id}`} replace />;
}

function areaOf(path: string): AreaKey {
  if (path.startsWith("/work") || /^\/records\/(tasks|projects|companies|timesheets|employments|trainings|certificates|achievements)/.test(path)) return "work";
  if (isMoneyPath(path)) return "money";
  if (path.startsWith("/notes") || /^\/records\/(notes|documents|templates)/.test(path)) return "notes";
  if (path.startsWith("/life") || /^\/records\/(habits|goals|wellness|importantDates|travel)/.test(path)) return "life";
  return "today";
}

export default function OneApp() {
  const identity = useIdentity();
  const q = useQueryClient();
  const [language, setLanguage] = useState<"id" | "en">("id");
  if (identity.isPending) return <div className="one"><div className="o-main"><div className="o-skel" style={{ marginTop: 80 }} /></div></div>;
  if (identity.error || !identity.data?.user)
    return <div className="one dark"><Login language={language} setLanguage={setLanguage} onDone={() => q.invalidateQueries()} /></div>;
  return <Shell />;
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const identity = useIdentity();
  const [quick, setQuick] = useState<{ open: boolean; preset?: QuickPreset }>({ open: false });
  const [search, setSearch] = useState(false);
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const notifications = useNotifications();
  const [fabHidden, setFabHidden] = useState(false);
  const unread = (notifications.data || []).filter((n) => !n.read_at).length;
  const allRecords = useRecords();
  const viewing = location.pathname.startsWith("/r/") ? allRecords.data?.find((r) => r.id === location.pathname.slice(3)) : undefined;
  const area = viewing ? kindMeta(viewing.kind).area : areaOf(location.pathname);
  // Settings and notifications belong to no area, so no tab lights up there.
  const navArea = /^\/(settings|notifications)/.test(location.pathname) ? null : area;
  const openQuick = useMemo(() => (preset?: QuickPreset) => setQuick({ open: true, preset }), []);
  const user = identity.data?.user;
  setTimezone(user?.preferences?.timezone);

  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 4);
      // Tuck the + button away while scrolling down so it never covers a control.
      if (Math.abs(y - last) > 6) { setFabHidden(y > last && y > 80); last = y; }
    };
    const net = () => setOffline(!navigator.onLine);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("online", net); window.addEventListener("offline", net);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("online", net); window.removeEventListener("offline", net); };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); setFabHidden(false); }, [location.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { if (navigator.onLine) store.syncQueue().catch(() => {}); }, [offline]);

  const title = location.pathname.startsWith("/settings") ? "Pengaturan" : location.pathname.startsWith("/notifications") ? "Notifikasi" : areas.find((a) => a.key === area)!.label;
  const initials = String(user?.name || "F").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <QuickContext.Provider value={openQuick}>
      <div className="one dark">
        <div className="o-shell">
          <aside className="o-side" aria-label="Navigasi utama">
            <Link to="/" className="o-brand"><span className="o-brand-mark">f</span>Febro One</Link>
            <button className="o-btn primary o-side-add" onClick={() => openQuick()}><Plus size={16} /> Tambah</button>
            <nav>
              {areas.map((a) => (
                <NavLink key={a.key} to={a.path} end={a.path === "/"} className={() => cx(navArea === a.key && "active")} style={{ "--tint": a.color } as React.CSSProperties}>
                  <a.icon size={18} />{a.label}
                </NavLink>
              ))}
            </nav>
            <div className="o-side-label">Lainnya</div>
            <nav>
              <NavLink to="/calendar"><CalendarDays size={18} />Kalender</NavLink>
              <NavLink to="/insights"><ChartNoAxesCombined size={18} />Analisis</NavLink>
              <NavLink to="/tools"><Calculator size={18} />Alat</NavLink>
              <NavLink to="/cms"><Inbox size={18} />CMS</NavLink>
            </nav>
            <div className="o-side-foot">
              <NavLink to="/settings"><Settings size={18} />Pengaturan</NavLink>
            </div>
          </aside>

          <div className="o-main-wrap">
            <header className={cx("o-top", scrolled && "scrolled")}>
              <div className="o-top-title">
                <span className="o-brand"><span className="o-brand-mark">f</span><span>{title}</span></span>
              </div>
              {offline && <span className="o-tag warn" title="Offline"><CloudOff size={13} /> Offline</span>}
              <button className="o-icon-btn" aria-label="Cari (Ctrl+K)" onClick={() => setSearch(true)}><Search size={20} /></button>
              <button className="o-icon-btn" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`} onClick={() => setBell(true)}><Bell size={20} />{unread > 0 && <span className="dot" />}</button>
              <button className="o-icon-btn" aria-label="Menu profil" onClick={() => setMenu(true)}><span className="o-avatar">{initials}</span></button>
            </header>

            <main className="o-main" id="main">
              <Suspense fallback={<div className="o-skel" />}>
                <Routes>
                  <Route path="/" element={<Today />} />
                  <Route path="/work" element={<Work />} />
                  <Route path="/work/:tab" element={<Work />} />
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/notes/:tab" element={<Notes />} />
                  <Route path="/life" element={<Life />} />
                  <Route path="/life/:tab" element={<Life />} />
                  <Route path="/r/:id" element={<RecordView />} />
                  <Route path="/calendar" element={<div className="o-legacy"><Calendar /></div>} />
                  <Route path="/finance" element={<Money><Finance /></Money>} />
                  <Route path="/finance/new/:action" element={<Money><Finance /></Money>} />
                  <Route path="/finance/plans" element={<Money><FinancePlan /></Money>} />
                  <Route path="/debts" element={<><MoneyNav /><Debts /></>} />
                  <Route path="/debts/new/:action" element={<Money><Finance /></Money>} />
                  <Route path="/records/:kind" element={<RecordsRoute />} />
                  <Route path="/records/:kind/new" element={<div className="o-legacy"><RecordPage edit /></div>} />
                  <Route path="/records/:kind/:id/edit" element={<div className="o-legacy"><RecordPage edit /></div>} />
                  <Route path="/records/:kind/:id" element={<OldDetailRoute />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/tools" element={<div className="o-legacy"><Tools /></div>} />
                  <Route path="/insights" element={<div className="o-legacy"><Insights /></div>} />
                  <Route path="/cms" element={<div className="o-legacy"><Cms /></div>} />
                  <Route path="/cms/:kind/:id" element={<div className="o-legacy"><CmsRequest /></div>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>

        <nav className="o-bottom" aria-label="Navigasi utama">
          {areas.map((a) => (
            <NavLink key={a.key} to={a.path} end={a.path === "/"} className={() => cx(navArea === a.key && "active")} style={{ "--tint": a.color } as React.CSSProperties}>
              <a.icon size={22} strokeWidth={navArea === a.key ? 2.3 : 1.8} />{a.label}
            </NavLink>
          ))}
        </nav>
        <button className={cx("o-fab", (fabHidden || /^\/(settings|notifications)/.test(location.pathname)) && "away")} aria-label="Tambah cepat" onClick={() => openQuick()}><Plus size={26} strokeWidth={2.4} /></button>

        <QuickAdd open={quick.open} preset={quick.preset} onOpenChange={(open) => setQuick((s) => ({ ...s, open }))} />
        <GlobalSearch open={search} onOpenChange={setSearch} />
        <Sheet open={bell} onOpenChange={setBell} title="Notifikasi" wide>
          <NotificationCenter compact onNavigate={() => setBell(false)} />
          <Link to="/notifications" className="o-btn ghost block" style={{ marginTop: 6 }} onClick={() => setBell(false)}>Buka halaman notifikasi</Link>
        </Sheet>
        <Sheet open={menu} onOpenChange={setMenu} title={user?.name || "Profil"}>
          <div className="o-list">
            <Row onClick={() => { setMenu(false); navigate("/calendar"); }} icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-today)" } as React.CSSProperties}><CalendarDays size={16} /></span>} title="Kalender" />
            <Row onClick={() => { setMenu(false); navigate("/insights"); }} icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-work)" } as React.CSSProperties}><ChartNoAxesCombined size={16} /></span>} title="Analisis" />
            <Row onClick={() => { setMenu(false); navigate("/tools"); }} icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-notes)" } as React.CSSProperties}><Calculator size={16} /></span>} title="Alat & kalkulator" />
            <Row onClick={() => { setMenu(false); navigate("/cms"); }} icon={<span className="o-kind-icon" style={{ "--tint": "var(--c-life)" } as React.CSSProperties}><Inbox size={16} /></span>} title="CMS" />
            <Row onClick={() => { setMenu(false); navigate("/settings"); }} icon={<span className="o-kind-icon" style={{ "--tint": "var(--muted)" } as React.CSSProperties}><Settings size={16} /></span>} title="Pengaturan" meta={user?.email} />
          </div>
          <button className="o-btn danger block" style={{ marginTop: 14 }} onClick={() => store.logout()}><LogOut size={16} /> Keluar</button>
        </Sheet>
      </div>
    </QuickContext.Provider>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const records = useRecords();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return (records.data || []).filter((r) => !kindMeta(r.kind).hidden).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
    return (records.data || [])
      .filter((r) => r.kind !== "habitEntries" && (r.title + " " + r.tags.join(" ") + " " + JSON.stringify(r.data)).toLowerCase().includes(needle))
      .sort((a, b) => Number(!a.title.toLowerCase().includes(needle)) - Number(!b.title.toLowerCase().includes(needle)) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40);
  }, [records.data, needle]);
  const go = (path: string) => { onOpenChange(false); setQ(""); navigate(path); };
  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQ(""); }} title="Cari">
      <label className="o-search"><Search size={16} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Task, proyek, catatan, orang…" aria-label="Cari di semua data"
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(recordHref(results[0])); }} />
      </label>
      <div className="o-picker-results">
        {results.length ? (
          <>
            {!needle && <div className="o-eyebrow" style={{ margin: "4px 2px 8px" }}>Terakhir diubah</div>}
            <div className="o-list">{results.map((r) => (
              <Row key={r.id} onClick={() => go(recordHref(r))} icon={<KindIcon kind={r.kind} />} title={r.title} meta={kindMeta(r.kind).label} />
            ))}</div>
          </>
        ) : <Empty title="Tidak ditemukan" text="Coba kata kunci lain." />}
      </div>
    </Sheet>
  );
}
