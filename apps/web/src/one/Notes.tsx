import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FileText, Pin, Plus, Search } from "lucide-react";
import type { RecordItem } from "../../../../packages/shared/catalog";
import { plainContent } from "../RecordForm";
import { useRecords, byId, fmtDay, dayKey } from "./data";
import { Section, RecordRow, Empty, PageHead, Segmented } from "./ui";
import { useQuickAdd } from "./quick";

type Tab = "notes" | "documents" | "templates";
const noteKind: Record<string, string> = { Note: "Catatan", "Daily journal": "Jurnal", Meeting: "Rapat", Technical: "Teknis", Knowledge: "Pengetahuan", Idea: "Ide", Bookmark: "Bookmark" };

export default function Notes() {
  const { tab = "notes" } = useParams();
  const navigate = useNavigate();
  const quick = useQuickAdd();
  const records = useRecords();
  const all = records.data || [];
  const index = useMemo(() => byId(all), [all]);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const kind = tab === "documents" ? "documents" : tab === "templates" ? "templates" : "notes";
  const rows = all.filter((r) => r.kind === kind);
  const folders = [...new Set(rows.map((r) => String(r.data.folder || "")).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  const visible = rows
    .filter((r) => !folder || String(r.data.folder || "") === folder)
    .filter((r) => !needle || (r.title + " " + plainContent(String(r.data.content || "")) + " " + r.tags.join(" ")).toLowerCase().includes(needle))
    .sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const snippet = (r: RecordItem) => plainContent(String(r.data.content || r.data.description || "")).replace(/\s+/g, " ").slice(0, 90);
  return (
    <>
      <PageHead title={{ notes: "Catatan", documents: "Dokumen", templates: "Template" }[kind]!}
        actions={kind === "notes"
          ? <button className="o-btn primary small" onClick={() => quick({ kind: "notes" })}><Plus size={15} /> Catatan</button>
          : <Link className="o-btn primary small" to={`/records/${kind}/new`}><Plus size={15} /> Tambah</Link>} />
      <Segmented<Tab> label="Jenis catatan" value={tab as Tab} onChange={(v) => { setFolder(""); navigate(`/notes/${v}`, { replace: true }); }}
        options={[
          { value: "notes", label: "Catatan", count: all.filter((r) => r.kind === "notes").length },
          { value: "documents", label: "Dokumen", count: all.filter((r) => r.kind === "documents").length },
          { value: "templates", label: "Template", count: all.filter((r) => r.kind === "templates").length },
        ]} />
      <label className="o-search"><Search size={16} /><input placeholder="Cari judul, isi, atau tag…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari catatan" /></label>
      {folders.length > 0 && (
        <div className="o-pills">
          <button className="o-pill" style={{ cursor: "pointer", ...(folder === "" ? { borderColor: "var(--accent)" } : {}) }} onClick={() => setFolder("")}>Semua</button>
          {folders.map((f) => <button key={f} className="o-pill" style={{ cursor: "pointer", ...(folder === f ? { borderColor: "var(--accent)" } : {}) }} onClick={() => setFolder(folder === f ? "" : f)}>{f}</button>)}
        </div>
      )}
      {records.isPending ? <div className="o-skel" /> : visible.length ? (
        <Section title={needle ? "Hasil" : "Terbaru"} count={visible.length}>
          <div className="o-list">{visible.map((r) => (
            <RecordRow key={r.id} record={r}
              meta={<>
                {r.data.pinned && <Pin size={12} style={{ color: "var(--c-notes)" }} />}
                <span>{fmtDay(dayKey(r.updatedAt))}</span>
                {r.data.kind && <span className="o-tag">{noteKind[String(r.data.kind)] || String(r.data.kind)}</span>}
                {snippet(r) && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{snippet(r)}</span>}
              </>} />
          ))}</div>
        </Section>
      ) : <Empty icon={<FileText size={20} />} title={needle ? "Tidak ada yang cocok" : "Belum ada isi"} text={kind === "notes" ? "Catat ide, rapat, atau keputusan — lalu tautkan ke proyek atau tujuan." : undefined} />}
      {index.size === 0 && null}
    </>
  );
}
