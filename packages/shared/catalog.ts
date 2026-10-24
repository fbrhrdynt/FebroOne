export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "datetime-local"
    | "number"
    | "select"
    | "checkbox"
    | "url"
    | "color";
  options?: string[];
  required?: boolean;
};
export type Module = {
  key: string;
  title: string;
  group: string;
  description: string;
  fields: Field[];
};
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  options?: string[],
  required = false,
): Field => ({ key, label, type, options, required });
const date = f("date", "Tanggal", "date");
const status = f("status", "Status", "select", [
  "Inbox",
  "To Do",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
]);
const description = f("description", "Catatan", "textarea");
export const modules: Module[] = [
  {
    key: "tasks",
    title: "Tasks",
    group: "Produktivitas",
    description:
      "Satu langkah berikutnya. Atur prioritas, pecah pekerjaan, dan pantau progres.",
    fields: [
      status,
      f("priority", "Prioritas", "select", ["Low", "Medium", "High", "Urgent"]),
      f("due", "Tenggat", "datetime-local"),
      f("category", "Kategori"),
      f("project", "Proyek"),
      f("parent", "Tugas induk"),
      f("dependencies", "ID dependensi (pisahkan koma)"),
      f("checklist", "Checklist", "textarea"),
      f("recurrence", "Pengulangan", "select", [
        "None",
        "Daily",
        "Weekly",
        "Monthly",
      ]),
      f("progress", "Progres (%)", "number"),
      description,
    ],
  },
  {
    key: "events",
    title: "Calendar",
    group: "Produktivitas",
    description: "Ruang untuk pekerjaan, keluarga, dan diri sendiri.",
    fields: [
      f("start", "Mulai", "datetime-local", undefined, true),
      f("end", "Selesai", "datetime-local", undefined, true),
      f("allDay", "Sepanjang hari", "checkbox"),
      f("calendar", "Kalender"),
      f("category", "Kategori", "select", [
        "Personal",
        "Work",
        "Training",
        "Family",
      ]),
      f("color", "Warna", "color"),
      f("location", "Lokasi"),
      f("recurrence", "Pengulangan", "select", [
        "None",
        "Daily",
        "Weekly",
        "Monthly",
        "Yearly",
      ]),
      f("until", "Ulang sampai", "date"),
      f("exceptions", "Lewati tanggal (YYYY-MM-DD, pisahkan koma)"),
      f("reminderMinutes", "Pengingat (menit sebelumnya)", "number"),
      description,
    ],
  },
  {
    key: "notes",
    title: "Notes",
    group: "Pengetahuan",
    description: "Pikiran, keputusan, dan hal yang ingin Anda ingat.",
    fields: [
      f("folder", "Folder / subfolder"),
      f("kind", "Jenis", "select", [
        "Note",
        "Daily journal",
        "Meeting",
        "Technical",
        "Knowledge",
        "Idea",
        "Bookmark",
      ]),
      f("pinned", "Sematkan", "checkbox"),
      f("favorite", "Favorit", "checkbox"),
      f("content", "Isi Markdown", "textarea"),
      f("url", "Tautan sumber", "url"),
    ],
  },
  {
    key: "reminders",
    title: "Reminders",
    group: "Produktivitas",
    description:
      "Pengingat tersimpan; pemberitahuan masuk ke notification center.",
    fields: [
      f("due", "Waktu", "datetime-local", undefined, true),
      f("done", "Sudah selesai", "checkbox"),
      description,
    ],
  },
  {
    key: "habits",
    title: "Habits",
    group: "Kehidupan",
    description: "Bangun kebiasaan kecil. Tandai pencapaian setiap hari.",
    fields: [
      f("target", "Target harian", "number"),
      f("unit", "Satuan"),
      f("frequency", "Frekuensi", "select", ["Daily", "Weekly"]),
      description,
    ],
  },
  {
    key: "habitEntries",
    title: "Habit check-ins",
    group: "Kehidupan",
    description: "Catatan pencapaian kebiasaan.",
    fields: [
      f("habitId", "ID kebiasaan", undefined, undefined, true),
      date,
      f("value", "Jumlah", "number"),
      description,
    ],
  },
  {
    key: "goals",
    title: "Goals",
    group: "Kehidupan",
    description: "Tujuan pribadi dan milestone yang dapat diukur.",
    fields: [
      f("targetDate", "Tanggal target", "date"),
      f("progress", "Progres (%)", "number"),
      f("category", "Kategori"),
      status,
      description,
    ],
  },
  {
    key: "milestones",
    title: "Milestones",
    group: "Kehidupan",
    description: "Hubungkan pencapaian dengan tujuan dan tugas.",
    fields: [
      f("goalId", "ID tujuan"),
      f("taskId", "ID tugas"),
      date,
      f("completed", "Selesai", "checkbox"),
      description,
    ],
  },
  {
    key: "activities",
    title: "Daily activities",
    group: "Kehidupan",
    description: "Rekam hari Anda tanpa harus mengingat semuanya.",
    fields: [
      date,
      f("category", "Kategori"),
      f("minutes", "Durasi (menit)", "number"),
      description,
    ],
  },
  {
    key: "importantDates",
    title: "Family & dates",
    group: "Kehidupan",
    description: "Tanggal penting dan acara keluarga.",
    fields: [
      date,
      f("person", "Nama"),
      f("annual", "Setiap tahun", "checkbox"),
      description,
    ],
  },
  {
    key: "travel",
    title: "Travel",
    group: "Kehidupan",
    description: "Rencana perjalanan, agenda, dan barang bawaan.",
    fields: [
      f("destination", "Tujuan"),
      f("startDate", "Berangkat", "date"),
      f("endDate", "Pulang", "date"),
      f("packing", "Packing checklist ([x] selesai)", "textarea"),
      f("itinerary", "Rencana harian", "textarea"),
      description,
    ],
  },
  {
    key: "inventory",
    title: "Personal inventory",
    group: "Kehidupan",
    description: "Barang pribadi, lokasi, dan masa garansi.",
    fields: [
      f("category", "Kategori"),
      f("quantity", "Jumlah", "number"),
      f("location", "Lokasi"),
      f("serial", "Nomor seri"),
      f("purchased", "Dibeli", "date"),
      f("expiry", "Garansi berakhir", "date"),
      description,
    ],
  },
  {
    key: "wellness",
    title: "Wellness journal",
    group: "Kehidupan",
    description:
      "Refleksi pribadi tentang energi, suasana hati, dan istirahat. Bukan diagnosis medis.",
    fields: [
      date,
      f("mood", "Suasana hati", "select", [
        "Great",
        "Good",
        "Okay",
        "Low",
        "Difficult",
      ]),
      f("sleep", "Tidur (jam)", "number"),
      f("energy", "Energi (1–5)", "number"),
      description,
    ],
  },
  {
    key: "reviews",
    title: "Life reviews",
    group: "Kehidupan",
    description:
      "Berhenti sejenak, lihat progres, tentukan langkah berikutnya.",
    fields: [
      date,
      f("period", "Periode", "select", ["Daily", "Weekly", "Monthly"]),
      f("wins", "Pencapaian", "textarea"),
      f("lessons", "Pelajaran", "textarea"),
      f("next", "Fokus berikutnya", "textarea"),
    ],
  },
  {
    key: "work",
    title: "Work records",
    group: "Workspace",
    description:
      "Catat kontribusi pribadi. Jangan unggah informasi rahasia perusahaan atau klien.",
    fields: [
      date,
      f("endDate", "Sampai", "date"),
      f("company", "Perusahaan"),
      f("role", "Peran"),
      f("project", "Proyek"),
      f("skills", "Skill diterapkan"),
      f("responsibilities", "Tanggung jawab", "textarea"),
      f("contribution", "Kontribusi", "textarea"),
      f("lessons", "Pelajaran", "textarea"),
    ],
  },
  {
    key: "employments",
    title: "Employment history",
    group: "Workspace",
    description: "Riwayat perusahaan, posisi, dan perjalanan karier.",
    fields: [
      f("company", "Perusahaan"),
      f("position", "Posisi"),
      f("startDate", "Mulai", "date"),
      f("endDate", "Selesai", "date"),
      f("location", "Lokasi"),
      description,
    ],
  },
  {
    key: "companies",
    title: "Companies",
    group: "Workspace",
    description: "Direktori perusahaan dalam riwayat karier pribadi.",
    fields: [
      f("industry", "Industri"),
      f("website", "Website", "url"),
      f("location", "Lokasi"),
      description,
    ],
  },
  {
    key: "projects",
    title: "Projects & assignments",
    group: "Workspace",
    description: "Proyek pribadi dan ringkasan penugasan profesional.",
    fields: [
      status,
      f("startDate", "Mulai", "date"),
      f("endDate", "Selesai", "date"),
      f("role", "Peran"),
      f("skills", "Skills"),
      description,
    ],
  },
  {
    key: "timesheets",
    title: "Time tracking",
    group: "Workspace",
    description: "Waktu fokus dan aktivitas kerja.",
    fields: [
      date,
      f("taskId", "ID tugas"),
      f("project", "Proyek"),
      f("minutes", "Durasi (menit)", "number"),
      f("kind", "Jenis", "select", ["Work", "Focus", "Learning"]),
      description,
    ],
  },
  {
    key: "achievements",
    title: "Achievements",
    group: "Workspace",
    description: "Pencapaian dan dampaknya untuk perkembangan karier.",
    fields: [
      date,
      f("company", "Perusahaan"),
      f("impact", "Dampak", "textarea"),
      description,
    ],
  },
  {
    key: "trainings",
    title: "Training",
    group: "Karier",
    description: "Pelatihan, jam belajar, dan bukti kompetensi.",
    fields: [
      f("provider", "Penyelenggara"),
      f("category", "Kategori"),
      date,
      f("hours", "Jam belajar", "number"),
      f("status", "Status", "select", ["Planned", "In Progress", "Completed"]),
      f("skills", "Skill / kompetensi"),
      description,
    ],
  },
  {
    key: "competencies",
    title: "Competency matrix",
    group: "Karier",
    description: "Peta skill dengan level, penilaian, dan bukti.",
    fields: [
      f("category", "Kategori"),
      f("level", "Level", "select", [
        "Awareness",
        "Beginner",
        "Working",
        "Proficient",
        "Expert",
      ]),
      f("targetLevel", "Target", "select", [
        "Awareness",
        "Beginner",
        "Working",
        "Proficient",
        "Expert",
      ]),
      f("assessed", "Tanggal penilaian", "date"),
      f("assessor", "Penilai"),
      description,
    ],
  },
  {
    key: "certificates",
    title: "Certificates",
    group: "Karier",
    description:
      "Sertifikat dan masa berlakunya. Lampiran hanya dapat diakses pemilik.",
    fields: [
      f("issuer", "Penerbit"),
      f("number", "Nomor sertifikat"),
      f("issued", "Diterbitkan", "date"),
      f("expiry", "Kedaluwarsa", "date"),
      f("reminderDays", "Pengingat (hari sebelumnya)", "number"),
      description,
    ],
  },
  {
    key: "learning",
    title: "Learning roadmap",
    group: "Karier",
    description: "Rencana belajar menuju kompetensi berikutnya.",
    fields: [
      f("skill", "Skill"),
      f("resource", "Sumber belajar", "url"),
      f("targetDate", "Target", "date"),
      f("hours", "Target jam", "number"),
      status,
      description,
    ],
  },
  {
    key: "documents",
    title: "Documents & vault",
    group: "Berkas",
    description: "Dokumen pribadi, metadata, dan lampiran yang tersimpan aman.",
    fields: [
      f("folder", "Folder / subfolder"),
      f("category", "Kategori"),
      f("issued", "Diterbitkan", "date"),
      f("expiry", "Kedaluwarsa", "date"),
      description,
    ],
  },
  {
    key: "templates",
    title: "Templates",
    group: "Pengetahuan",
    description: "Template catatan yang dapat digunakan kembali.",
    fields: [f("kind", "Jenis"), f("content", "Isi template", "textarea")],
  },
  {
    key: "budgets",
    title: "Budgets",
    group: "Keuangan",
    description: "Batas pengeluaran per kategori dan bulan (IDR).",
    fields: [
      f("month", "Bulan (YYYY-MM)", undefined, undefined, true),
      f("category", "Kategori", undefined, undefined, true),
      f("amount", "Anggaran IDR", "number", undefined, true),
      description,
    ],
  },
  {
    key: "bills",
    title: "Bills & subscriptions",
    group: "Keuangan",
    description:
      "Pengingat tagihan. Pencatatan transaksi tetap memerlukan konfirmasi.",
    fields: [
      f("amount", "Nominal IDR", "number"),
      f("due", "Jatuh tempo", "date"),
      f("frequency", "Frekuensi", "select", ["Monthly", "Yearly", "Weekly"]),
      f("category", "Kategori"),
      description,
    ],
  },
  {
    key: "savings",
    title: "Savings goals",
    group: "Keuangan",
    description:
      "Target tabungan dan dana darurat; progres manual tidak mengubah saldo akun.",
    fields: [
      f("target", "Target IDR", "number"),
      f("saved", "Terkumpul IDR", "number"),
      f("targetDate", "Target tanggal", "date"),
      f("kind", "Jenis", "select", ["Savings", "Emergency fund"]),
      description,
    ],
  },
  {
    key: "assets",
    title: "Assets & liabilities",
    group: "Keuangan",
    description:
      "Nilai aset dan kewajiban di luar rekening dan utang yang sudah dicatat.",
    fields: [
      f("kind", "Jenis", "select", ["Asset", "Liability"]),
      f("amount", "Nilai IDR", "number"),
      date,
      description,
    ],
  },
  {
    key: "categories",
    title: "Finance categories",
    group: "Keuangan",
    description: "Kategori dan subkategori transaksi.",
    fields: [
      f("kind", "Jenis", "select", ["Income", "Expense"]),
      f("parent", "Kategori induk"),
      description,
    ],
  },
  {
    key: "automations",
    title: "Automation rules",
    group: "Intelligence",
    description:
      "Aturan pengingat berdasarkan tanggal. Tidak melakukan transaksi keuangan otomatis.",
    fields: [
      f("due", "Jalankan", "datetime-local", undefined, true),
      f("action", "Aksi", "select", ["Notify", "Create task"]),
      f("repeat", "Ulang", "select", ["None", "Daily", "Weekly", "Monthly"]),
      f("enabled", "Aktif", "checkbox"),
      description,
    ],
  },
  {
    key: "integrations",
    title: "App launcher",
    group: "Tools",
    description:
      "Tambahkan aplikasi Anda. SSO belum diaktifkan; kompatibilitas harus diverifikasi.",
    fields: [
      f("url", "URL aplikasi", "url", undefined, true),
      f("category", "Kategori"),
      description,
    ],
  },
  {
    key: "calculations",
    title: "Saved calculations",
    group: "Tools",
    description: "Riwayat rumus, input, hasil, dan asumsi.",
    fields: [
      date,
      f("formula", "Rumus"),
      f("inputs", "Input", "textarea"),
      f("result", "Hasil"),
      f("assumptions", "Asumsi", "textarea"),
    ],
  },
];
export const catalog = Object.fromEntries(modules.map((m) => [m.key, m]));
export type RecordItem = {
  id: string;
  kind: string;
  title: string;
  tags: string[];
  data: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  deletedAt?: string | null;
};
export const statuses = [
  "Inbox",
  "To Do",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];
export const groupNames = [...new Set(modules.map((m) => m.group))];
