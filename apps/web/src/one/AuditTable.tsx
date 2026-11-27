import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import * as store from "../store";
import { ErrorNote } from "./ui";

const actionLabel: Record<string, string> = {
  "auth.login": "Masuk dengan kata sandi", "auth.login.passkey": "Masuk dengan passkey", "auth.recover": "Pemulihan akun",
  "auth.passkey.register": "Passkey ditambahkan", "auth.passkey.remove": "Passkey dihapus",
  "record.create": "Membuat data", "record.update": "Mengubah data", "record.archive": "Mengarsipkan data",
  "record.restore": "Memulihkan data", "record.trash": "Memindahkan ke Trash", "record.permanent-delete": "Menghapus permanen",
  "finance.create": "Mencatat transaksi", "finance.link": "Menautkan transaksi", "finance.reverse": "Membatalkan transaksi",
  "debt.installments_paid": "Menandai cicilan dibayar", "debt.installment_deleted": "Membatalkan pembayaran cicilan",
  "debt.settled": "Menandai utang lunas", "debt.archive": "Mengarsipkan utang",
};
const label = (a: string) => actionLabel[a] || (a.startsWith("cms.") ? "Keputusan CMS" : a);
const tone = (a: string) => (a.startsWith("auth") ? "accent" : a.includes("delete") || a.includes("trash") ? "danger" : a.startsWith("finance") || a.startsWith("debt") ? "ok" : "");

type Page = { items: { action: string; entity_id: string | null; created_at: string }[]; total: number; window: number };

export function AuditTable() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => { setQ(input.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [input]);
  const result = useQuery<Page>({
    queryKey: ["audit", page, size, q],
    queryFn: () => store.api(`/audit?page=${page}&size=${size}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const total = result.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? page * size + 1 : 0, to = Math.min(total, (page + 1) * size);
  return (
    <div className="o-audit">
      <div className="o-audit-bar">
        <label className="o-search" style={{ margin: 0, flex: 1 }}><Search size={16} />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Cari aktivitas, mis. login atau transaksi" aria-label="Cari audit log" /></label>
        <select className="o-input" style={{ width: "auto", minHeight: 44 }} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} aria-label="Baris per halaman">
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / halaman</option>)}
        </select>
      </div>
      <ErrorNote error={result.error} />
      <div className="o-table-scroll" aria-busy={result.isFetching}>
        <table className="o-table">
          <thead><tr><th>Waktu</th><th>Aktivitas</th><th>Ref.</th></tr></thead>
          <tbody>
            {(result.data?.items || []).map((r, i) => (
              <tr key={`${r.created_at}-${i}`}>
                <td className="nowrap">{new Date(r.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</td>
                <td><span className={`o-tag ${tone(r.action)}`}>{label(r.action)}</span></td>
                <td className="mono" title={r.entity_id || ""}>{r.entity_id ? r.entity_id.slice(0, 8) : "—"}</td>
              </tr>
            ))}
            {!result.isPending && !result.data?.items.length && <tr><td colSpan={3} className="o-table-empty">{q ? "Tidak ada aktivitas yang cocok." : "Belum ada aktivitas."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="o-pager">
        <span>{total ? `${from}–${to} dari ${total}` : "0"}{result.data && !q && total >= result.data.window ? ` · ${result.data.window} aktivitas terbaru` : ""}</span>
        <div className="o-pager-btns">
          <button className="o-icon-btn" aria-label="Halaman pertama" disabled={page === 0} onClick={() => setPage(0)}><ChevronsLeft size={17} /></button>
          <button className="o-icon-btn" aria-label="Halaman sebelumnya" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={17} /></button>
          <span className="o-pager-num">{page + 1} / {pages}</span>
          <button className="o-icon-btn" aria-label="Halaman berikutnya" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight size={17} /></button>
          <button className="o-icon-btn" aria-label="Halaman terakhir" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}><ChevronsRight size={17} /></button>
        </div>
      </div>
    </div>
  );
}
