import { tr } from "./i18n";
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
  Eye,
  EyeOff,
  Globe2,
  Fingerprint,
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
const CmsRequest = lazy(() => import("./CmsPage").then(module => ({ default: module.CmsRequestPage })));
const languageStorageKey = "febro-one-language";
type Language = "id" | "en";
const copy = {
  id: { email:"Email", password:"Kata sandi", show:"Tampilkan kata sandi", hide:"Sembunyikan kata sandi", login:"Masuk", recover:"Pulihkan akun", recovery:"Kode pemulihan", newPassword:"Kata sandi baru (minimal 12 karakter)", back:"Kembali ke login", working:"Memproses…", settings:"Pengaturan" },
  en: { email:"Email", password:"Password", show:"Show password", hide:"Hide password", login:"Sign in", recover:"Recover account", recovery:"Recovery code", newPassword:"New password (at least 12 characters)", back:"Back to sign in", working:"Working…", settings:"Settings" }
} as const;
function LanguageSwitch({value,onChange}:{value:Language;onChange:(v:Language)=>void}) {
  return <div className="language-switch" role="group" aria-label={tr("Language")}>
    <Globe2 size={14}/><button type="button" aria-pressed={value==="id"} onClick={()=>onChange("id")}>{tr("ID")}</button>
    <span>/</span><button type="button" aria-pressed={value==="en"} onClick={()=>onChange("en")}>{tr("EN")}</button>
  </div>;
}
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
function Login({ onDone, language, setLanguage }: { onDone: () => void; language: Language; setLanguage:(v:Language)=>void }) {
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [passwordMode,setPasswordMode]=useState(false);
  const t=copy[language];
  return (
    <div className="login-page">
      <div className="login-card"><div className="login-language"><LanguageSwitch value={language} onChange={setLanguage}/></div>
        <div className="brand">
          <span className="brand-mark">{tr("f.")}</span>
          <strong>{tr("Febro One")}</strong>
        </div>
        <h1>{recovery ? t.recover : language==="id" ? "Selamat datang kembali." : "Welcome back."}</h1>
        <p>{tr("Your Entire Life. One Workspace.")}</p>
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
                setError(language==="id"?"Kata sandi diganti. Silakan masuk.":"Password updated. Please sign in.");
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
          {(recovery || passwordMode) && <Field label={t.email}>
            <input name="email" type="email" autoComplete="username" required />
          </Field>}
          {recovery && (
            <Field label={t.recovery}>
              <input name="recovery" autoComplete="off" required />
            </Field>
          )}
          {(recovery || passwordMode) && <Field label={recovery ? t.newPassword : t.password}>
            <div className="password-input-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={recovery ? "new-password" : "current-password"} minLength={recovery ? 12 : 1} required/><button className="password-visibility" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?t.hide:t.show} title={showPassword?t.hide:t.show}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          </Field>}
          <ErrorText error={error} />
          {(recovery || passwordMode) && <Button disabled={busy} type="submit">
            {busy ? t.working : recovery ? (language==="id"?"Ganti kata sandi":"Reset password") : t.login}
          </Button>}
          {!recovery && <>
            {!passwordMode && <Button className="passkey-primary" type="button" disabled={busy} onClick={async()=>{
              setBusy(true);setError(undefined);
              try{await store.passkeyLogin();onDone();}
              catch(e){setError(e);}
              finally{setBusy(false);}
            }}><Fingerprint size={18}/>{busy ? t.working : language==="id"?"Lanjutkan dengan Passkey":"Continue with Passkey"}</Button>}
            <Button variant="ghost" type="button" onClick={()=>{setPasswordMode(v=>!v);setError(undefined);}}>
              {passwordMode ? (language==="id"?"Kembali ke Passkey":"Back to Passkey") : (language==="id"?"Masuk dengan email dan kata sandi":"Use email and password")}
            </Button>
          </>}
          <Button variant="ghost" type="button" onClick={() => {setRecovery(!recovery);setPasswordMode(false);setError(undefined);}}>
            {recovery ? t.back : t.recover}
          </Button>
        </form>
        <small>{language==="id"?"Akun pertama dibuat melalui perintah admin di VPS.":"The first account is created using the VPS admin command."}</small>
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
  const [language,setLanguageState]=useState<Language>(()=>localStorage.getItem(languageStorageKey)==="en"?"en":"id");
  const setLanguage=(v:Language)=>{setLanguageState(v);localStorage.setItem(languageStorageKey,v);};
  useEffect(()=>{const syncLanguage=()=>setLanguageState(localStorage.getItem(languageStorageKey)==="en"?"en":"id");window.addEventListener("febro-language-change",syncLanguage);return()=>window.removeEventListener("febro-language-change",syncLanguage);},[]);
  const t=copy[language];
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
    if (!identity.data?.user) {
      document.documentElement.classList.add("dark");
      return;
    }
    const user = identity.data.user;
    const migrationKey = "febro-observatory-theme-restored-v1";
    let theme = user.preferences?.theme || localStorage.getItem("theme") || "dark";
    if (!localStorage.getItem(migrationKey)) {
      localStorage.setItem(migrationKey, "1");
      if (theme === "light") {
        theme = "dark";
        localStorage.setItem("theme", "dark");
        void store.preferences({
          timezone: "Asia/Jakarta",
          widgets: ["tasks", "agenda", "finance", "career", "notes"],
          maskMoney: false,
          ...user.preferences,
          name: user.name,
          theme: "dark",
        }).then(() => q.invalidateQueries({ queryKey: ["identity"] })).catch(() => {
          // Keep the restored dark appearance locally if preference sync is unavailable.
        });
      }
    }
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [identity.data?.user.preferences?.theme, identity.data?.user.id]);
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
        <span className="brand-mark">{tr("f.")}</span>
        <p>{tr("Membuka workspace…")}</p>
      </div>
    );
  if (!identity.data) return <Login language={language} setLanguage={setLanguage} onDone={() => q.invalidateQueries()} />;
  const current =
    nav.find((n) => n[0] === location.pathname)?.[1] ||
    catalog[location.pathname.split("/")[2]]?.title ||
    "Workspace";
  const matches = search.trim()
    ? rs.data
        ?.filter((r) =>
          (r.title + " " + r.tags.join(" ") + " " + JSON.stringify(r.data))
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 30)
    : [];
  return (
    <div data-module={location.pathname.split("/")[2] || location.pathname.split("/")[1] || "home"} className={"app " + (collapsed ? "collapsed" : "")}>
      <a href="#main" className="skip-link">{tr("Skip to content")}</a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">{tr("f.")}</span>
          <strong>
            Febro One<span>{tr("PERSONAL WORKSPACE")}</span>
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
        <nav aria-label={tr("Navigasi utama")}>
          {nav.map(([path, label, Icon], i) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={i === 4 ? "nav-divider" : ""}
            >
              <Icon size={18} />
              <span>{(language==="id" ? ({Home:"Beranda",Calendar:"Kalender",Tasks:"Tugas",Notes:"Catatan",Finance:"Keuangan",Debt:"Utang",Workspace:"Ruang kerja",Career:"Karier",Life:"Aktivitas",Documents:"Dokumen",Tools:"Alat",Insights:"Analisis"} as Record<string,string>) : ({Home:"Home",Calendar:"Calendar",Tasks:"Tasks",Notes:"Notes",Finance:"Finance",Debt:"Debt",Workspace:"Workspace",Career:"Career",Life:"Life",Documents:"Documents",Tools:"Tools",Insights:"Insights"} as Record<string,string>))[label]}</span>
              {label === "Tasks" && !!pending.data && <small>{pending.data}</small>}
            </NavLink>
          ))}
          {!collapsed && <div className="sidebar-categories">{groupNames.map(group => <div key={group}>
            <button className="sidebar-category-toggle" aria-expanded={expanded.includes(group)} onClick={() => toggleCategory(group)}>{tr(group)}<ChevronRight size={14} className={expanded.includes(group) ? "rotate" : ""} /></button>
            {expanded.includes(group) && <div className="sidebar-category-links">{modules.filter(m => m.group === group).map(m => <NavLink key={m.key} to={m.key === "events" ? "/calendar" : "/records/"+m.key}><ModuleIcon group={m.group}/>{tr(m.title)}</NavLink>)}</div>}
          </div>)}</div>}
          <NavLink to="/more">
            <Grid2X2 size={18} />
            <span>{tr("Semua modul")}</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/settings">
            <SettingsIcon size={18} />
            {t.settings}
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
              aria-label={tr("Toggle sidebar")}
              aria-expanded={!collapsed}
              onClick={() => { localStorage.setItem("febro-sidebar-collapsed", String(!collapsed)); setCollapsed(!collapsed); }}
            >
              <PanelLeftClose size={18} />
            </Button>
            <span>{tr("Workspace")}</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="row-actions">
            <LanguageSwitch value={language} onChange={setLanguage}/>
            <Button
              variant="ghost"
              className="search-trigger"
              aria-label={tr("Cari seluruh workspace")}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
              <span className="desktop-only">{tr("Cari apa saja")}</span>
              <kbd className="desktop-only">{tr("⌘ K")}</kbd>
            </Button>
            <Button
              variant="ghost"
              aria-label={tr("Ganti tema")}
              disabled={themeBusy}
              onClick={toggleTheme}
            >
              <span className="theme-light"><Sun size={18} /></span><span className="theme-dark"><Moon size={18} /></span>
            </Button>
            <Button
              variant="ghost"
              aria-label={tr("Notifications")}
              className="notification-trigger"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={18} />
              {ns.data?.some((n: any) => !n.read_at) && <i />}
            </Button>
            <Button variant="ghost" aria-label={tr("Profile menu")} onClick={() => setProfileOpen(true)}><UserRound size={18} /></Button>
          </div>
        </header>
        {store.trial && (
          <div className="trial-banner">
            <span className="status-dot" />
            <strong>{tr("Trial pribadi")}</strong>
            <span>{tr("Data tersimpan di browser ini.")}</span>
            <Link to="/settings">
              Export data <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        {offline && (
          <div className="offline-banner">
            <CloudOff size={16} />
            Offline ·{tr(" ")}
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
              <Route path="/cms/:kind/:id" element={<CmsRequest />} />
              <Route
                path="/more"
                element={
                  <>
                    <PageHeader
                      title={tr("Your workspace")}
                      description={tr("Semua bagian kehidupan, terhubung dalam satu tempat.")}
                    />
                    <div className="more-grid">
                      <WorkspaceCategories />
                      <section className="panel">
                        <h2>{tr("Workspace")}</h2>
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
                element={<Empty title={tr("Halaman tidak ditemukan")} />}
              />
            </Routes>
          </Suspense>
          <footer className="main-footer">
            Febro One <span>{tr("by Febro Herdyanto")}</span>
          </footer>
        </main>
      </div>
      <MobileBottomNavigation onQuickAdd={() => setQuick(true)}/>
      <Button className="desktop-quick" onClick={() => setQuick(true)}>
        <Plus size={19} />
        Quick Add
      </Button>
      <Modal open={profileOpen} onOpenChange={setProfileOpen} title={tr("Your account")} description={identity.data.user.email || "Personal workspace"}>
        <div className="profile-summary"><span className="avatar">{identity.data.user.name.slice(0,1)}</span><strong>{identity.data.user.name}</strong></div>
        <div className="form-stack"><Button variant="outline" onClick={() => {navigate("/settings");setProfileOpen(false);}}><SettingsIcon size={18}/> {tr("Profile & settings")}</Button>
        <Button variant="outline" onClick={() => {navigate("/more");setProfileOpen(false);}}><Grid2X2 size={18}/> {tr("All modules")}</Button>
        {!store.trial && <Button variant="ghost" onClick={() => store.logout().catch(setShellError)}><LogOut size={18}/> {tr("Sign out")}</Button>}</div>
      </Modal>
      <Modal
        open={quick}
        onOpenChange={setQuick}
        title={tr("Quick Add")}
        description={tr("Apa yang ingin Anda simpan?")}
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
        title={tr("Search workspace")}
        description={tr("Cari judul, tags, atau isi catatan.")}
      >
        <label className="search-input">
          <Search size={20} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={tr("Cari seluruh workspace")}
            placeholder={tr("Cari apa saja…")}
          />
        </label>
        <div className="search-results">
          {nav.filter(([,label])=>!search || label.toLowerCase().includes(search.toLowerCase())).map(([path,label,Icon])=><button key={path} onClick={()=>{navigate(path);setSearchOpen(false);}}><Icon size={18}/><strong>{label}</strong><small>{tr("Modul")}</small></button>)}
          {modules.filter(m=>search && m.title.toLowerCase().includes(search.toLowerCase())).map(m=><button key={m.key} onClick={()=>{navigate(m.key==='events'?'/calendar':'/records/'+m.key);setSearchOpen(false);}}><strong>{m.title}</strong><small>{tr(m.group)}</small></button>)}
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
          {search && !matches?.length && <p>{tr("Tidak ada hasil.")}</p>}
          {!search && (
            <p className="hint">{tr("Mulai ketik untuk mencari di seluruh modul.")}</p>
          )}
        </div>
      </Modal>
      <Modal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        title={tr("Notification center")}
      >
        <div className="form-stack">
          {!ns.data?.length && (
            <Empty
              title={tr("Semua tenang")}
              text="Pengingat dan masa berlaku dokumen akan muncul di sini."
            />
          )}
          {ns.data?.map((n: any) => (
            <div className="row" key={n.id}>
              <div>
                <strong>{n.title}</strong>
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
