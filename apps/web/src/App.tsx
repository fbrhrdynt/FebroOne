import { lazy, Suspense, useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Home as HomeIcon,
  CalendarDays,
  Plus,
  CheckSquare,
  Grid2X2,
  Search,
  Bell,
  FileText,
  Wallet,
  BriefcaseBusiness,
  GraduationCap,
  Heart,
  FolderLock,
  Calculator,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ChevronRight,
  PanelLeftClose,
  Sun,
  Moon,
  Inbox,
  CloudOff,
  ArrowUpRight,
  LogOut,
  UserRound,
} from "lucide-react";
import { catalog, modules, groupNames } from "../../../packages/shared/catalog";
import * as store from "./store";
import { Button, Modal, Field, PageHeader, Empty, ErrorText } from "./ui";
import WorkspaceCategories from "./WorkspaceCategories";
import { MobileBottomNavigation, ModuleIcon } from "./Bento";
import RecordForm from "./RecordForm";
const RecordPage = lazy(()=>import("./RecordPage"));
const Home = lazy(() => import("./Home"));
const Records = lazy(() => import("./RecordsPage"));
const Calendar = lazy(() => import("./CalendarPage"));
const Finance = lazy(() => import("./FinancePage"));
const Tools = lazy(() => import("./ToolsPage"));
const Insights = lazy(() => import("./Insights"));
const Settings = lazy(() => import("./Settings"));
const Cms = lazy(() => import("./CmsPage"));
const CmsRequest = lazy(() => import("./CmsPage").then(module => ({default: module.CmsRequestPage})));
const nav = [
  ["/", "Home", HomeIcon],
  ["/calendar", "Calendar", CalendarDays],
  ["/records/tasks", "Tasks", CheckSquare],
  ["/records/notes", "Notes", FileText],
  ["/finance", "Finance", Wallet],
  ["/debts", "Debt", ChartNoAxesCombined],
  ["/records/work", "Workspace", BriefcaseBusiness],
  ["/records/trainings", "Career", GraduationCap],
  ["/records/activities", "Life", Heart],
  ["/records/documents", "Documents", FolderLock],
  ["/tools", "Tools", Calculator],
  ["/insights", "Insights", ChartNoAxesCombined],
  ["/cms", "CMS", Inbox],
] as const;
function Login({ onDone }: { onDone: () => void }) {
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">f.</span>
          <strong>Febro One</strong>
        </div>
        <h1>{recovery ? "Pulihkan akun" : "Selamat datang kembali."}</h1>
        <p>Your Entire Life. One Workspace.</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const d = Object.fromEntries(new FormData(e.currentTarget)) as any;
            try {
              if (recovery) {
                await store.api("/auth/recover", "POST", d);
                setRecovery(false);
                setError("Password diganti. Silakan masuk.");
              } else {
                await store.login(d.email, d.password);
                onDone();
              }
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email">
            <input name="email" type="email" autoComplete="username" required />
          </Field>
          {recovery && (
            <Field label="Kode pemulihan">
              <input name="recovery" autoComplete="off" required />
            </Field>
          )}
          <Field
            label={
              recovery ? "Password baru (minimal 12 karakter)" : "Password"
            }
          >
            <input
              name="password"
              type="password"
              autoComplete={recovery ? "new-password" : "current-password"}
              minLength={recovery ? 12 : 1}
              required
            />
          </Field>
          <ErrorText error={error} />
          <Button disabled={busy} type="submit">
            {busy ? "Memproses…" : recovery ? "Ganti password" : "Masuk"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setRecovery(!recovery)}
          >
            {recovery ? "Kembali ke login" : "Pulihkan akun"}
          </Button>
        </form>
        <small>Akun pertama dibuat melalui perintah admin di VPS.</small>
      </div>
    </div>
  );
}
export default function App() {
  const identity = useQuery({
    queryKey: ["identity"],
    queryFn: store.identity,
    retry: false,
  });
  const q = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [shellError, setShellError] = useState<unknown>();
  const [themeBusy, setThemeBusy] = useState(false);
  const [quick, setQuick] = useState(false);
  const [kind, setKind] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("febro-sidebar-collapsed") === "true");
  const [offline, setOffline] = useState(!navigator.onLine);
  const location = useLocation();
  const navigate = useNavigate();
  const expanded: string[] = identity.data?.user.preferences?.expandedCategories ?? groupNames;
  async function toggleCategory(group: string) {
    const value = expanded.includes(group) ? expanded.filter(g => g !== group) : [...expanded, group];
    try {
      if (store.trial) await store.preferences({...identity.data.user.preferences, name: identity.data.user.name, expandedCategories: value});
      else await store.api("/preferences/workspace", "PATCH", {expandedCategories: value});
      await q.invalidateQueries({queryKey:["identity"]});
    } catch (e) { setShellError(e); }
  }
  async function toggleTheme() {
    const theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    const user = identity.data.user;
    setThemeBusy(true);
    try {
      await store.preferences({ timezone:"Asia/Jakarta", widgets:["tasks","agenda","finance","career","notes"], maskMoney:false, ...user.preferences, name:user.name, theme });
      localStorage.setItem("theme", theme);
      await q.invalidateQueries({queryKey:["identity"]});
    } catch(e) { setShellError(e); } finally { setThemeBusy(false); }
  }
  useEffect(() => {
    const theme = identity.data?.user.preferences?.theme || localStorage.getItem("theme") || "light";
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [identity.data?.user.preferences?.theme]);
  const rs = useQuery({
    queryKey: ["records", "global-search",search],
    queryFn: async ():Promise<import("../../../packages/shared/catalog").RecordItem[]> => store.trial ? store.records() : (await store.api("/records?limit=30&q="+encodeURIComponent(search))).items,
    enabled: !!identity.data && searchOpen && !!search.trim(),
  });
  const pending=useQuery({queryKey:["records","pending-count"],queryFn:async()=>store.trial?(await store.records("tasks")).filter(r=>r.data.status!=="Completed").length:(await store.api("/records?kind=tasks&pending=true&limit=1")).total,enabled:!!identity.data});
  const ns = useQuery({
    queryKey: ["notifications"],
    queryFn: store.notifications,
    enabled: !!identity.data,
    refetchInterval: 60000,
  });
  useEffect(() => {
    const on = () => {
      setOffline(false);
      store
        .syncQueue()
        .then(() => q.invalidateQueries())
        .catch(() => {});
    };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("keydown", key);
    };
  }, [q]);
  if (identity.isLoading)
    return (
      <div className="app-loading">
        <span className="brand-mark">f.</span>
        <p>Membuka workspace…</p>
      </div>
    );
  if (!identity.data) return <Login onDone={() => q.invalidateQueries()} />;
  const current =
    (location.pathname.startsWith("/cms") ? "CMS" : nav.find((n) => n[0] === location.pathname)?.[1]) ||
    catalog[location.pathname.split("/")[2]]?.title ||
    "Workspace";
  const searchNeedle = search.trim().toLocaleLowerCase("id");
  const matches = search.trim()
    ? rs.data
        ?.filter((r) =>
          (r.title + " " + (r.tags || []).join(" ") + " " + JSON.stringify(r.data))
            .toLowerCase()
            .includes(searchNeedle),
        )
        .slice(0, 30)
    : [];
  return (
    <div data-module={location.pathname.split("/")[2] || location.pathname.split("/")[1] || "home"} className={"app " + (collapsed ? "collapsed" : "")}>
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">f.</span>
          <strong>
            Febro One<span>PERSONAL WORKSPACE</span>
          </strong>
        </Link>
        <button
          className="workspace-label"
          onClick={() => setProfileOpen(true)}
        >
          <span className="avatar">{identity.data.user.name.slice(0, 1)}</span>
          <span>
            {identity.data.user.name}
            <small>{store.trial ? "Browser trial" : "Personal account"}</small>
          </span>
          <ChevronRight size={14} />
        </button>
        <nav aria-label="Navigasi utama">
          {nav.map(([path, label, Icon], i) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={i === 4 ? "nav-divider" : ""}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Tasks" && !!pending.data && <small>{pending.data}</small>}
            </NavLink>
          ))}
          {!collapsed && <div className="sidebar-categories">{groupNames.map(group => <div key={group}>
            <button className="sidebar-category-toggle" aria-expanded={expanded.includes(group)} onClick={() => toggleCategory(group)}>{group}<ChevronRight size={14} className={expanded.includes(group) ? "rotate" : ""} /></button>
            {expanded.includes(group) && <div className="sidebar-category-links">{modules.filter(m => m.group === group).map(m => <NavLink key={m.key} to={m.key === "events" ? "/calendar" : "/records/"+m.key}><ModuleIcon group={m.group}/>{m.title}</NavLink>)}</div>}
          </div>)}</div>}
          <NavLink to="/more">
            <Grid2X2 size={18} />
            <span>Semua modul</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/settings">
            <SettingsIcon size={18} />
            Settings
          </NavLink>
          <small>
            Your Entire Life.
            <br />
            One Workspace.
          </small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              className="desktop-only"
              aria-label="Toggle sidebar"
              aria-expanded={!collapsed}
              onClick={() => { localStorage.setItem("febro-sidebar-collapsed", String(!collapsed)); setCollapsed(!collapsed); }}
            >
              <PanelLeftClose size={18} />
            </Button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="row-actions">
            <Button
              variant="ghost"
              className="search-trigger"
              aria-label="Cari seluruh workspace"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
              <span className="desktop-only">Cari apa saja</span>
              <kbd className="desktop-only">⌘ K</kbd>
            </Button>
            <Button
              variant="ghost"
              aria-label="Ganti tema"
              disabled={themeBusy}
              onClick={toggleTheme}
            >
              <span className="theme-light"><Sun size={18} /></span><span className="theme-dark"><Moon size={18} /></span>
            </Button>
            <Button
              variant="ghost"
              aria-label="Notifications"
              className="notification-trigger"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={18} />
              {ns.data?.some((n: any) => !n.read_at) && <i />}
            </Button>
            <Button variant="ghost" aria-label="Profile menu" onClick={() => setProfileOpen(true)}><UserRound size={18} /></Button>
          </div>
        </header>
        {store.trial && (
          <div className="trial-banner">
            <span className="status-dot" />
            <strong>Trial pribadi</strong>
            <span>Data tersimpan di browser ini.</span>
            <Link to="/settings">
              Export data <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        {offline && (
          <div className="offline-banner">
            <CloudOff size={16} />
            Offline ·{" "}
            {store.trial
              ? "Data lokal tetap tersedia."
              : "Hanya draft notes yang dapat diedit."}
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <ErrorText error={shellError} />
          <Suspense fallback={<div className="skeleton" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/records/:kind" element={<Records key={location.pathname} />} />
              <Route path="/records/:kind/new" element={<RecordPage edit />} />
              <Route path="/records/:kind/:id" element={<RecordPage />} />
              <Route path="/records/:kind/:id/edit" element={<RecordPage edit />} />
              <Route path="/finance/new/:action" element={<Finance />} />
              <Route path="/debts/new/:action" element={<Finance />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/debts" element={<Finance />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/cms" element={<Cms />} />
              <Route path="/cms/:kind/:id" element={<CmsRequest key={location.pathname} />} />
              <Route
                path="/more"
                element={
                  <>
                    <PageHeader
                      title="Your workspace"
                      description="Semua bagian kehidupan, terhubung dalam satu tempat."
                    />
                    <div className="more-grid">
                      <WorkspaceCategories />
                      <section className="panel">
                        <h2>Workspace</h2>
                        <Link to="/cms">CMS inbox<ChevronRight size={15} /></Link>
                        <Link to="/settings">
                          Settings
                          <ChevronRight size={15} />
                        </Link>
                        <Link to="/insights">
                          Insights & AI
                          <ChevronRight size={15} />
                        </Link>
                        <Link to="/finance">
                          Finance overview
                          <ChevronRight size={15} />
                        </Link>
                        <Link to="/debts">
                          Debt & receivables
                          <ChevronRight size={15} />
                        </Link>
                        <Link to="/tools">
                          Engineering desk
                          <ChevronRight size={15} />
                        </Link>
                      </section>
                    </div>
                  </>
                }
              />
              <Route
                path="*"
                element={<Empty title="Halaman tidak ditemukan" />}
              />
            </Routes>
          </Suspense>
          <footer className="main-footer">
            Febro One <span>by Febro Herdyanto</span>
          </footer>
        </main>
      </div>
      <MobileBottomNavigation onQuickAdd={() => setQuick(true)}/>
      <Button className="desktop-quick" onClick={() => setQuick(true)}>
        <Plus size={19} />
        Quick Add
      </Button>
      <Modal open={profileOpen} onOpenChange={setProfileOpen} title="Your account" description={identity.data.user.email || "Personal workspace"}>
        <div className="profile-summary"><span className="avatar">{identity.data.user.name.slice(0,1)}</span><strong>{identity.data.user.name}</strong></div>
        <div className="form-stack"><Button variant="outline" onClick={() => {navigate("/settings");setProfileOpen(false);}}><SettingsIcon size={18}/> Profile & settings</Button>
        <Button variant="outline" onClick={() => {navigate("/more");setProfileOpen(false);}}><Grid2X2 size={18}/> All modules</Button>
        {!store.trial && <Button variant="ghost" onClick={() => store.logout().catch(setShellError)}><LogOut size={18}/> Sign out</Button>}</div>
      </Modal>
      <Modal
        open={quick}
        onOpenChange={setQuick}
        title="Quick Add"
        description="Apa yang ingin Anda simpan?"
      >
        <div className="quick-grid">
          {[
            ["tasks", "Task", CheckSquare],
            ["notes", "Note", FileText],
            ["events", "Event", CalendarDays],
            ["expense", "Expense", Wallet],
            ["activities", "Activity", Heart],
            ["work", "Work record", BriefcaseBusiness],
          ].map(([k, label, Icon]: any) => (
            <button
              key={k}
              onClick={() => {
                setQuick(false);
                if (k === "expense") navigate("/finance?quick=expense");
                else setKind(k);
              }}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </Modal>
      {kind && <RecordForm kind={kind} onClose={() => setKind("")} />}
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search workspace"
        description="Cari judul, tags, atau isi catatan."
      >
        <label className="search-input">
          <Search size={20} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari seluruh workspace"
            placeholder="Cari apa saja…"
          />
        </label>
        <div className="search-results">
          {nav.filter(([path,label])=>!search || (label+" "+path).toLocaleLowerCase("id").includes(searchNeedle)).map(([path,label,Icon])=><button key={path} onClick={()=>{navigate(path);setSearchOpen(false);}}><Icon size={18}/><strong>{label}</strong><small>Modul</small></button>)}
          {modules.filter(m=>search && (m.title+" "+m.group+" "+m.key).toLocaleLowerCase("id").includes(searchNeedle)).map(m=><button key={m.key} onClick={()=>{navigate(m.key==='events'?'/calendar':'/records/'+m.key);setSearchOpen(false);}}><strong>{m.title}</strong><small>{m.group}</small></button>)}
          {matches?.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                navigate(
                  "/records/" + r.kind + "/" + r.id,
                );
                setSearchOpen(false);
              }}
            >
              <strong>{r.title}</strong>
              <small>{catalog[r.kind]?.title}</small>
            </button>
          ))}
          {search && !matches?.length && !modules.some(m=>(m.title+" "+m.group+" "+m.key).toLocaleLowerCase("id").includes(searchNeedle)) && !nav.some(([path,label])=>(label+" "+path).toLocaleLowerCase("id").includes(searchNeedle)) && !rs.isFetching && <p>Tidak ada hasil.</p>}{rs.isFetching && search && <p className="hint">Mencari catatan, tugas, agenda dan data lainnya…</p>}
          {!search && (
            <p className="hint">Mulai ketik untuk mencari di seluruh modul.</p>
          )}
        </div>
      </Modal>
      <Modal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        title="Notification center"
      >
        <div className="form-stack">
          {!ns.data?.length && (
            <Empty
              title="Semua tenang"
              text="Pengingat dan masa berlaku dokumen akan muncul di sini."
            />
          )}
          {ns.data?.map((n: any) => (
            <div className="row" key={n.id}>
              <div>
                {typeof n.target_url === "string" && /^\/cms\/(document|cv|contact)\/[^/]+$/.test(n.target_url) ? <Link to={n.target_url} onClick={() => setNotificationsOpen(false)}>{n.title}</Link> : <strong>{n.title}</strong>}
                <small>{n.read_at ? "Sudah dibaca" : "Pengingat aktif"}</small>
              </div>
              <Button
                variant="ghost"
                onClick={async () => {
                  await store.markRead(n.id);
                  await q.invalidateQueries({ queryKey: ["notifications"] });
                }}
              >
                Tandai dibaca
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
