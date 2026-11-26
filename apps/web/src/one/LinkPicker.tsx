import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { RecordItem } from "../../../../packages/shared/catalog";
import { useRecords } from "./data";
import { kindMeta, hubKinds } from "./kinds";
import { Sheet, Row, KindIcon, Segmented, Empty } from "./ui";

/** Search-and-pick any record to link to. `only` narrows the kinds offered. */
export function LinkPicker({ open, onOpenChange, onPick, exclude = [], only, title = "Tautkan ke…" }: {
  open: boolean; onOpenChange: (v: boolean) => void; onPick: (r: RecordItem) => void;
  exclude?: string[]; only?: string[]; title?: string;
}) {
  const all = useRecords();
  const [q, setQ] = useState("");
  const offered = only ?? hubKinds;
  const [kind, setKind] = useState<string>(offered.length === 1 ? offered[0] : "all");
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all.data || [])
      .filter((r) => offered.includes(r.kind) && !exclude.includes(r.id) && !r.archivedAt)
      .filter((r) => kind === "all" || r.kind === kind)
      .filter((r) => !needle || r.title.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 60);
  }, [all.data, q, kind, offered, exclude]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all.data || []) if (offered.includes(r.kind) && !r.archivedAt) m.set(r.kind, (m.get(r.kind) || 0) + 1);
    return m;
  }, [all.data, offered]);
  const tabs = offered.filter((k) => counts.get(k));
  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQ(""); }} title={title}>
      <label className="o-search"><Search size={16} />
        <input autoFocus placeholder="Cari judul…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari record" />
      </label>
      {tabs.length > 1 && (
        <Segmented label="Jenis" value={kind} onChange={setKind}
          options={[{ value: "all", label: "Semua" }, ...tabs.map((k) => ({ value: k, label: kindMeta(k).plural, count: counts.get(k) }))]} />
      )}
      <div className="o-picker-results">
        {items.length ? (
          <div className="o-list">
            {items.map((r) => (
              <Row key={r.id} icon={<KindIcon kind={r.kind} />} title={r.title} meta={kindMeta(r.kind).label}
                onClick={() => { onPick(r); onOpenChange(false); setQ(""); }} />
            ))}
          </div>
        ) : (
          <Empty title={all.isPending ? "Memuat…" : "Tidak ada yang cocok"} text="Coba kata lain, atau buat dulu record yang ingin ditautkan." />
        )}
      </div>
    </Sheet>
  );
}
