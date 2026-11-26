import {
  Sun, BriefcaseBusiness, Wallet, NotebookPen, Sprout, CheckSquare, CalendarDays,
  Building2, FolderKanban, Clock3, IdCard, GraduationCap, Award, Trophy, FileText,
  FolderLock, LayoutTemplate, Repeat, Target, Flag, HeartPulse, Cake, Plane, Package,
  BookOpen, Bell, Coins, PiggyBank, Receipt, Landmark, Tags, Zap, AppWindow, Calculator,
  Activity, Gauge, type LucideIcon,
} from "lucide-react";

export type AreaKey = "today" | "work" | "money" | "notes" | "life";
export const areas: { key: AreaKey; label: string; path: string; icon: LucideIcon; color: string }[] = [
  { key: "today", label: "Hari Ini", path: "/", icon: Sun, color: "var(--c-today)" },
  { key: "work", label: "Kerja", path: "/work", icon: BriefcaseBusiness, color: "var(--c-work)" },
  { key: "money", label: "Uang", path: "/finance", icon: Wallet, color: "var(--c-money)" },
  { key: "notes", label: "Catatan", path: "/notes", icon: NotebookPen, color: "var(--c-notes)" },
  { key: "life", label: "Hidup", path: "/life", icon: Sprout, color: "var(--c-life)" },
];

type KindMeta = { label: string; plural: string; icon: LucideIcon; area: AreaKey; hidden?: boolean };
// Every record kind belongs to exactly one area. Kinds marked hidden are
// folded into another view (reminders live in tasks, check-ins in habits)
// or kept only so existing data stays readable.
export const kinds: Record<string, KindMeta> = {
  tasks: { label: "Task", plural: "Task", icon: CheckSquare, area: "work" },
  events: { label: "Agenda", plural: "Agenda", icon: CalendarDays, area: "today" },
  reminders: { label: "Pengingat", plural: "Pengingat", icon: Bell, area: "today", hidden: true },
  companies: { label: "Perusahaan", plural: "Perusahaan", icon: Building2, area: "work" },
  projects: { label: "Proyek", plural: "Proyek", icon: FolderKanban, area: "work" },
  timesheets: { label: "Jam kerja", plural: "Jam kerja", icon: Clock3, area: "work" },
  employments: { label: "Riwayat kerja", plural: "Riwayat kerja", icon: IdCard, area: "work" },
  work: { label: "Catatan kerja", plural: "Catatan kerja", icon: BriefcaseBusiness, area: "work", hidden: true },
  achievements: { label: "Prestasi", plural: "Prestasi", icon: Trophy, area: "work" },
  trainings: { label: "Pelatihan", plural: "Pelatihan", icon: GraduationCap, area: "work" },
  certificates: { label: "Sertifikat", plural: "Sertifikat", icon: Award, area: "work" },
  competencies: { label: "Kompetensi", plural: "Kompetensi", icon: Gauge, area: "work", hidden: true },
  learning: { label: "Rencana belajar", plural: "Rencana belajar", icon: BookOpen, area: "work", hidden: true },
  notes: { label: "Catatan", plural: "Catatan", icon: FileText, area: "notes" },
  documents: { label: "Dokumen", plural: "Dokumen", icon: FolderLock, area: "notes" },
  templates: { label: "Template", plural: "Template", icon: LayoutTemplate, area: "notes" },
  habits: { label: "Kebiasaan", plural: "Kebiasaan", icon: Repeat, area: "life" },
  habitEntries: { label: "Check-in", plural: "Check-in", icon: Repeat, area: "life", hidden: true },
  goals: { label: "Tujuan", plural: "Tujuan", icon: Target, area: "life" },
  milestones: { label: "Milestone", plural: "Milestone", icon: Flag, area: "life", hidden: true },
  wellness: { label: "Jurnal", plural: "Jurnal", icon: HeartPulse, area: "life" },
  reviews: { label: "Refleksi", plural: "Refleksi", icon: BookOpen, area: "life", hidden: true },
  activities: { label: "Aktivitas", plural: "Aktivitas", icon: Activity, area: "life", hidden: true },
  importantDates: { label: "Tanggal penting", plural: "Tanggal penting", icon: Cake, area: "life" },
  travel: { label: "Perjalanan", plural: "Perjalanan", icon: Plane, area: "life" },
  inventory: { label: "Barang", plural: "Barang", icon: Package, area: "life", hidden: true },
  incomePlans: { label: "Rencana keuangan", plural: "Rencana keuangan", icon: Coins, area: "money", hidden: true },
  debts: { label: "Utang", plural: "Utang", icon: Landmark, area: "money", hidden: true },
  budgets: { label: "Anggaran", plural: "Anggaran", icon: Coins, area: "money", hidden: true },
  bills: { label: "Tagihan", plural: "Tagihan", icon: Receipt, area: "money", hidden: true },
  savings: { label: "Tabungan", plural: "Tabungan", icon: PiggyBank, area: "money", hidden: true },
  assets: { label: "Aset", plural: "Aset", icon: Landmark, area: "money", hidden: true },
  categories: { label: "Kategori", plural: "Kategori", icon: Tags, area: "money", hidden: true },
  automations: { label: "Otomasi", plural: "Otomasi", icon: Zap, area: "today", hidden: true },
  integrations: { label: "Aplikasi", plural: "Aplikasi", icon: AppWindow, area: "notes", hidden: true },
  calculations: { label: "Kalkulasi", plural: "Kalkulasi", icon: Calculator, area: "notes", hidden: true },
};
export const kindMeta = (kind: string): KindMeta =>
  kinds[kind] || { label: kind, plural: kind, icon: FileText, area: "notes" };
export const areaColor = (kind: string) => areas.find((a) => a.key === kindMeta(kind).area)!.color;

// Kinds a person can link anything to: the "hubs" of the workspace.
export const hubKinds = ["projects", "companies", "goals", "travel", "habits", "notes", "tasks", "events", "documents"];

export const statusLabel: Record<string, string> = {
  Inbox: "Inbox", "To Do": "Akan dikerjakan", "In Progress": "Berjalan", "On Hold": "Ditunda",
  Completed: "Selesai", Cancelled: "Batal", Planned: "Direncanakan",
};
export const priorityLabel: Record<string, string> = { Low: "Rendah", Medium: "Sedang", High: "Tinggi", Urgent: "Mendesak" };
