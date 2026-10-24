import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Download,
  Upload,
  Wallet,
  Undo2,
} from "lucide-react";
import Decimal from "decimal.js";
import { amortize, localDay } from "../../../packages/shared/domain";
import * as store from "./store";
import { Button, PageHeader, Modal, Field, Empty, ErrorText } from "./ui";
import { rp, total } from "./money";
export { rp, total } from "./money";
export default function FinancePage() {
  const location = useLocation();
  const debtPage = location.pathname.startsWith("/debts");
  const base=debtPage?"/debts":"/finance";const navigate=useNavigate();const {action}=useParams();
  const q = useQueryClient();
  const { data: state, error: loadError } = useQuery({
    queryKey: ["finance"],
    queryFn: store.finance,
  });
  const { data: rs = [] } = useQuery({
    queryKey: ["records"],
    queryFn: () => store.records(),
  });
  const s = state || { accounts: [], transactions: [], debts: [] };
  const modal=action||"";
  const setModal=(value:string)=>navigate(value?`${base}/new/${value}`:base);
  const [reverseId,setReverseId]=useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const profile = useQuery({queryKey:["identity"],queryFn:store.identity});
  const [maskOverride, setMask] = useState<boolean>();
  const mask = maskOverride ?? !!profile.data?.user.preferences?.maskMoney;
  const [search, setSearch] = useState("");
  const [transactionKind, setTransactionKind] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [txPage,setTxPage]=useState(0);
  const [txSort,setTxSort]=useState("date-desc");
  const [month, setMonth] = useState(localDay().slice(0, 7));
  const selectedId=new URLSearchParams(location.search).get("selected");
  const selected=[...s.accounts,...s.debts].find((r:any)=>r.id===selectedId);
  const [extra, setExtra] = useState("0");
  const [strategy, setStrategy] = useState("avalanche");
  const [csv, setCsv] = useState<any[] | null>(null);
  const [key, setKey] = useState(crypto.randomUUID());
  const financeDraftKey=`finance-draft:${profile.data?.user.id||""}:${modal}:${selectedId||"new"}`;
  const draftCommitted=useRef(false);
  useEffect(()=>{
    if(!modal||!state||!profile.data?.user.id)return;
    const form=document.querySelector<HTMLFormElement>('.record-form-page form');if(!form)return;
    draftCommitted.current=false;let requestKey=key;
    try{const draft=JSON.parse(sessionStorage.getItem(financeDraftKey)||'null');if(draft){for(const [name,value] of Object.entries(draft.fields||{})){const field=form.elements.namedItem(name);if(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement)field.value=String(value);}if(draft.key){requestKey=draft.key;setKey(draft.key);}}}catch{}
    const persist=()=>{if(draftCommitted.current)return;try{sessionStorage.setItem(financeDraftKey,JSON.stringify({fields:Object.fromEntries([...new FormData(form)].filter(([,v])=>typeof v==='string')),key:requestKey}));}catch{}};
    form.addEventListener('input',persist);form.addEventListener('change',persist);
    return ()=>{persist();form.removeEventListener('input',persist);form.removeEventListener('change',persist)};
  },[modal,selectedId,!!state,profile.data?.user.id]);
  const money = (v: any) => (mask ? "••••••" : rp(v));
  const txs = s.transactions.filter(
    (t: any) => !t.reversed && !["reversal", "opening"].includes(t.kind),
  );
  const monthTx = txs.filter((t: any) => t.date.startsWith(month));
  const income = total(
    monthTx.filter((t: any) => t.kind === "income"),
    "amount",
  );
  const expense = total(
    monthTx.filter((t: any) => t.kind === "expense"),
    "amount",
  ).plus(
    total(
      monthTx.filter((t: any) => t.kind === "debt_payment"),
      "interest",
    ),
  );
  const cash = total(s.accounts, "balance");
  const liability = s.debts
    .filter((d: any) => d.direction === "borrowed")
    .reduce(
      (a: Decimal, d: any) => a.plus(new Decimal(d.principal).minus(d.paid)),
      new Decimal(0),
    );
  const receivable = s.debts
    .filter((d: any) => d.direction === "lent")
    .reduce(
      (a: Decimal, d: any) => a.plus(new Decimal(d.principal).minus(d.paid)),
      new Decimal(0),
    );
  const assets = rs
    .filter((r) => r.kind === "assets")
    .reduce(
      (a, r) =>
        a.plus(
          new Decimal(r.data.amount || 0).mul(
            r.data.kind === "Liability" ? -1 : 1,
          ),
        ),
      new Decimal(0),
    );
  const txVisible = s.transactions.filter(
    (t: any) =>
      t.date.startsWith(month) &&
      (!transactionKind || t.kind === transactionKind) &&
      (!accountFilter || t.accountId === accountFilter || t.toAccountId === accountFilter) &&
      (t.description + " " + t.category + " " + t.amount)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const sortedTransactions=txVisible.filter((t:any)=>!debtPage||t.debtId).sort((a:any,b:any)=>txSort==="amount-desc"?Number(b.amount)-Number(a.amount)||a.id.localeCompare(b.id):txSort==="date-asc"?a.date.localeCompare(b.date)||a.id.localeCompare(b.id):b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  useEffect(()=>setTxPage(0),[search,month,txSort,debtPage,transactionKind,accountFilter]);
  const currentTxPage=Math.min(txPage,Math.max(0,Math.ceil(sortedTransactions.length/30)-1));
  function show(v: string, d?: any) {
    setError(null);
    navigate(`${base}/new/${v}${d?"?selected="+encodeURIComponent(d.id):""}`);
    setKey(crypto.randomUUID());
  }
  useEffect(()=>{if(new URLSearchParams(location.search).get("quick")==="expense") show("transaction");},[location.key]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    setError(null);
    const d = Object.fromEntries(new FormData(e.currentTarget)) as any;
    try {
      if (modal === "account")
        await store.addAccount(d.name, d.type, d.opening);
      if (modal === "transaction") {
        if (d.kind !== "transfer") delete d.toAccountId;
        await store.addTransaction({ ...d, key });
      }
      if (modal === "debt") {
        d.rates = d.rates ? JSON.parse(d.rates) : [];
        await store.addDebt(d);
      }
      if (modal === "pay") await store.payDebt(selected.id, { ...d, key });
      draftCommitted.current=true;sessionStorage.removeItem(financeDraftKey);
      await q.invalidateQueries();
      setModal("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function importCSV(file: File) {
    try {
      const {parseFinanceFile}=await import('./financeFiles');
      setCsv(await parseFinanceFile(file));
      show("import");
    } catch (e) {
      setError(e);
    }
  }
  async function confirmImport() {
    setBusy(true);
    try {
      const {prepareImport}=await import('./financeFiles');
      await store.importTransactions(await prepareImport(csv||[]));
      await q.invalidateQueries();
      setModal("");
      setCsv(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportCSV() {
    const Papa = (await import("papaparse")).default;
    store.download(
      "febro-one-transactions.csv",
      Papa.unparse(s.transactions.filter((t:any)=>['income','expense','transfer'].includes(t.kind)&&!t.reversed).map((t:any)=>({kind:t.kind,accountId:t.accountId,toAccountId:t.kind==='transfer'?t.toAccountId:'',amount:t.amount,category:t.category,date:t.date,description:t.description,reference:t.id})), { escapeFormulae: true }),
      "text/csv",
    );
  }
  const schedule =
    selected && modal === "schedule"
      ? amortize(
          new Decimal(selected.principal).minus(selected.paid).toFixed(2),
          selected.apr,
          selected.months,
          selected.model,
          extra,
          selected.rates,
        )
      : null;
  if (!state) return <><PageHeader title={debtPage ? "Debt & receivables" : "Finance"} description={loadError ? "Data keuangan belum dapat dimuat." : "Memuat data keuangan…"}/>{loadError ? <><ErrorText error={loadError}/><Button onClick={()=>q.invalidateQueries({queryKey:["finance"]})}>Coba lagi</Button></> : <div className="skeleton dashboard-loading" role="status" aria-label="Memuat keuangan"/>}</>;
  if(["pay","schedule","reconcile"].includes(modal)&&!selected)return <><Button onClick={()=>setModal("")}>← Kembali</Button><Empty title="Pilih akun atau utang terlebih dahulu"/></>;
  return (
    <>
      {!modal&&<>
      <PageHeader
        eyebrow="Keuangan pribadi"
        title={debtPage ? "Debt & receivables" : "Finance"}
        description={
          debtPage
            ? "Lihat kewajiban dengan jelas. Rencanakan langkah pelunasannya."
            : "Setiap pemasukan dan pengeluaran, dalam satu tempat."
        }
      >
        <Button
          variant="ghost"
          aria-label="Sembunyikan nominal"
          onClick={() => setMask(!mask)}
        >
          {mask ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
        <Button onClick={() => show(debtPage ? "debt" : "transaction")}>
          <Plus size={17} />
          {debtPage ? "Tambah utang" : "Transaksi"}
        </Button>
      </PageHeader>
      <ErrorText error={loadError || (!modal && error)} />
      <div className="stat-grid">
        <div className="stat">
          <span>Saldo rekening</span>
          <strong>{money(cash)}</strong>
          <small>{s.accounts.length} akun terdaftar</small>
        </div>
        <div className="stat">
          <span>{debtPage ? "Sisa utang" : "Pemasukan bulan ini"}</span>
          <strong>{money(debtPage ? liability : income)}</strong>
          <small>
            {debtPage
              ? "Pokok belum terbayar"
              : "Transfer antar akun dikecualikan"}
          </small>
        </div>
        <div className="stat">
          <span>{debtPage ? "Piutang" : "Pengeluaran bulan ini"}</span>
          <strong>{money(debtPage ? receivable : expense)}</strong>
          <small>
            {debtPage
              ? "Pokok belum diterima"
              : "Termasuk bunga, tanpa pokok utang"}
          </small>
        </div>
        <div className="stat">
          <span>Net worth</span>
          <strong>
            {money(cash.plus(receivable).plus(assets).minus(liability))}
          </strong>
          <small>Rekening + aset + piutang − kewajiban</small>
        </div>
      </div>
      <div className="tabs page-tabs">
        <Link className={!debtPage ? "active" : ""} to="/finance">
          Overview
        </Link>
        <Link className={debtPage ? "active" : ""} to="/debts">
          Debt
        </Link>
        <Link to="/records/budgets">Budgets</Link>
        <Link to="/records/bills">Bills</Link>
        <Link to="/records/savings">Savings</Link>
        <Link to="/records/assets">Assets</Link>
        <Link to="/records/categories">Categories</Link>
      </div>
      {debtPage ? (
        <>
          <div className="section-heading">
            <h2>Daftar utang & piutang</h2>
            <select
              aria-label="Strategi pelunasan"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="avalanche">Avalanche · bunga tertinggi</option>
              <option value="snowball">Snowball · saldo terkecil</option>
            </select>
          </div>
          <p className="hint">
            Urutan prioritas simulasi. Bunga dan pembayaran masa depan merupakan
            estimasi; cocokkan dengan kontrak pemberi pinjaman.
          </p>
          {!s.debts.length ? (
            <Empty
              title="Belum ada utang atau piutang"
              onAdd={() => show("debt")}
            />
          ) : (
            <div className="debt-grid">
              {[...s.debts]
                .sort((a: any, b: any) =>
                  strategy === "avalanche"
                    ? b.apr - a.apr
                    : new Decimal(a.principal)
                        .minus(a.paid)
                        .minus(new Decimal(b.principal).minus(b.paid))
                        .toNumber(),
                )
                .map((d: any, i: number) => (
                  <article className="panel" key={d.id}>
                    <div className="section-heading">
                      <span className="eyebrow">
                        {d.direction === "lent"
                          ? "Piutang"
                          : "Prioritas " + (i + 1)}
                      </span>
                      <span className="badge">{d.apr}% APR</span>
                    </div>
                    <h2>{d.name}</h2>
                    <strong className="balance">
                      {money(new Decimal(d.principal).minus(d.paid))}
                    </strong>
                    <p>
                      dari {money(d.principal)} ·{" "}
                      {d.model === "flat" ? "Flat" : "Saldo menurun"}
                    </p>
                    <progress max={d.principal} value={d.paid} />
                    <div className="row-actions">
                      <Button
                        variant="outline"
                        onClick={() => show("schedule", d)}
                      >
                        Jadwal & simulasi
                      </Button>
                      <Button
                        disabled={new Decimal(d.paid).gte(d.principal)}
                        onClick={() => show("pay", d)}
                      >
                        {d.direction === "lent" ? "Terima" : "Bayar"}
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="section-heading">
            <h2>Rekening & dompet</h2>
            <Button variant="ghost" onClick={() => show("account")}>
              <Plus size={16} />
              Akun
            </Button>
          </div>
          {!s.accounts.length ? (
            <Empty
              title="Mulai dari akun pertama"
              text="Tambahkan rekening, uang tunai, atau e-wallet beserta saldo awal."
              onAdd={() => show("account")}
            />
          ) : (
            <div className="account-grid">
              {s.accounts.map((a: any) => (
                <div className="account-card" key={a.id}>
                  <div className="section-heading">
                    <Wallet size={18} />
                    <span>{a.type}</span>
                  </div>
                  <h3>{a.name}</h3>
                  <strong>{money(a.balance)}</strong>
                  <button
                    className="text-button"
                    onClick={() => {
                      show("reconcile", a);
                    }}
                  >
                    Rekonsiliasi
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="section-heading">
            <h2>Anggaran bulan ini</h2>
            <Link to="/records/budgets">Kelola →</Link>
          </div>
          {rs.filter((r) => r.kind === "budgets" && r.data.month === month)
            .length === 0 ? (
            <p className="hint">Belum ada anggaran untuk {month}.</p>
          ) : (
            <div className="budget-grid">
              {rs
                .filter((r) => r.kind === "budgets" && r.data.month === month)
                .map((b) => {
                  const spent = total(
                    monthTx.filter(
                      (t: any) =>
                        t.kind === "expense" && t.category === b.data.category,
                    ),
                    "amount",
                  );
                  return (
                    <div className="panel" key={b.id}>
                      <strong>{b.data.category}</strong>
                      <p>
                        {money(spent)} / {money(b.data.amount)}
                      </p>
                      <progress
                        max={b.data.amount || 1}
                        value={spent.toNumber()}
                      />
                      {spent.gt(b.data.amount) && (
                        <small className="text-warn">Melebihi anggaran</small>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
      <div className="section-heading">
        <h2>{debtPage ? "Riwayat pembayaran" : "Transaksi"}</h2>
        <div className="row-actions">
          <Button variant="ghost" onClick={() => exportCSV().catch(setError)}>
            <Download size={16} />
            CSV
          </Button>
          <Button variant="ghost" onClick={()=>import('./financeFiles').then(m=>m.exportExcel(s.transactions)).catch(setError)}>Excel</Button>
          <label className="button ghost">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              onChange={(e) =>
                e.target.files?.[0] && importCSV(e.target.files[0])
              }
            />
          </label>
        </div>
      </div>
      <div className="list-toolbar">
        <select aria-label="Jenis transaksi" value={transactionKind} onChange={e=>setTransactionKind(e.target.value)}><option value="">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Transfer</option><option value="debt_payment">Pembayaran utang</option><option value="debt_receipt">Penerimaan piutang</option></select>
        <select aria-label="Rekening transaksi" value={accountFilter} onChange={e=>setAccountFilter(e.target.value)}><option value="">Semua rekening</option>{s.accounts.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <input
          aria-label="Bulan transaksi"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <input
          placeholder="Cari transaksi…"
          aria-label="Cari transaksi"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="record-list">
        <select aria-label="Urutkan transaksi" value={txSort} onChange={e=>setTxSort(e.target.value)}><option value="date-desc">Tanggal terbaru</option><option value="date-asc">Tanggal terlama</option><option value="amount-desc">Jumlah terbesar</option></select>
        {sortedTransactions
          .slice(currentTxPage*30,(currentTxPage+1)*30)
          .map((t: any) => (
            <div
              className={"transaction-row " + (t.reversed ? "reversed" : "")}
              key={t.id}
            >
              <div className={"transaction-icon " + t.kind}>
                {t.kind === "transfer" ? (
                  <ArrowLeftRight size={18} />
                ) : ["income", "opening", "debt_receipt"].includes(t.kind) ? (
                  <ArrowDownLeft size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}
              </div>
              <div className="grow">
                <strong>{t.description || t.category}</strong>
                <p>
                  {t.date} ·{" "}
                  {s.accounts.find((a: any) => a.id === t.accountId)?.name} ·{" "}
                  {t.category}
                  {t.reversed ? " · Dibatalkan" : ""}
                </p>
              </div>
              <strong>{money(t.amount)}</strong>
              {!t.reversed && !["opening", "reversal"].includes(t.kind) && (
                <Button
                  variant="ghost"
                  aria-label="Batalkan transaksi"
                  onClick={async () => {
                    if(reverseId!==t.id){setReverseId(t.id);return;}
                    try {
                      await store.reverseTransaction(t.id);
                      await q.invalidateQueries();
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  {reverseId===t.id?"Konfirmasi pembalikan":<Undo2 size={16} />}
                </Button>
              )}
            </div>
          ))}
        {sortedTransactions.length>30&&<div className="pagination"><Button disabled={!currentTxPage} onClick={()=>setTxPage(currentTxPage-1)}>Sebelumnya</Button><span>{currentTxPage+1} / {Math.ceil(sortedTransactions.length/30)}</span><Button disabled={(currentTxPage+1)*30>=sortedTransactions.length} onClick={()=>setTxPage(currentTxPage+1)}>Berikutnya</Button></div>}
        {!sortedTransactions.length && (
          <Empty
            title="Belum ada transaksi bulan ini"
            text="Catat transaksi pertama saat Anda siap."
          />
        )}
      </div>
      </>}
      {modal&&<section className="panel record-form-page"><Button variant="ghost" onClick={()=>setModal("")}>← Kembali / Batal</Button><h1>{({account:"Tambah akun",transaction:"Catat transaksi",debt:"Tambah utang / piutang",pay:"Catat pembayaran",schedule:"Jadwal & simulasi",import:"Preview impor CSV / Excel",reconcile:"Rekonsiliasi saldo"} as any)[modal]||"Keuangan"}</h1>
        <ErrorText error={error} />
        {["account", "transaction", "debt", "pay"].includes(modal) && (
          <form className="form-stack" onSubmit={submit}>
            {modal === "account" && (
              <>
                <Field label="Nama akun">
                  <input
                    name="name"
                    required
                    placeholder="Contoh: Rekening utama"
                  />
                </Field>
                <Field label="Jenis">
                  <select name="type">
                    <option>Bank</option>
                    <option>Cash</option>
                    <option>E-wallet</option>
                  </select>
                </Field>
                <Field label="Saldo awal IDR">
                  <input
                    name="opening"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </Field>
              </>
            )}
            {modal === "transaction" && (
              <>
                <Field label="Jenis">
                  <select name="kind">
                    <option value="expense">Pengeluaran</option>
                    <option value="income">Pemasukan</option>
                    <option value="transfer">Transfer internal</option>
                  </select>
                </Field>
                <Field label="Dari / akun">
                  <select name="accountId" required>
                    <option value="">Pilih akun</option>
                    {s.accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Akun tujuan (hanya transfer)">
                  <select name="toAccountId">
                    <option value="">Tidak digunakan</option>
                    {s.accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nominal IDR">
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Kategori">
                  <input
                    name="category"
                    list="categories"
                    defaultValue="Uncategorized"
                    required
                  />
                  <datalist id="categories">
                    {rs
                      .filter((r) => r.kind === "categories")
                      .map((r) => (
                        <option key={r.id}>{r.title}</option>
                      ))}
                  </datalist>
                </Field>
                <Field label="Tanggal">
                  <input
                    type="date"
                    name="date"
                    defaultValue={localDay()}
                    required
                  />
                </Field>
                <Field label="Deskripsi">
                  <input name="description" />
                </Field>
                <p className="hint">
                  Transfer memindahkan saldo tanpa menambah pemasukan. Lampirkan
                  bukti pada Documents dan beri tag ID transaksi.
                </p>
              </>
            )}
            {modal === "debt" && (
              <>
                <Field label="Nama pinjaman / pihak">
                  <input name="name" required />
                </Field>
                <Field label="Jenis">
                  <select name="direction">
                    <option value="borrowed">Saya berutang</option>
                    <option value="lent">Piutang saya</option>
                  </select>
                </Field>
                <Field label="Pokok IDR">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="principal"
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Bunga tahunan (%)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      name="apr"
                      defaultValue="0"
                      required
                    />
                  </Field>
                  <Field label="Tenor (bulan)">
                    <input
                      type="number"
                      min="1"
                      max="600"
                      name="months"
                      defaultValue="12"
                      required
                    />
                  </Field>
                </div>
                <Field label="Mulai">
                  <input
                    type="date"
                    name="start"
                    defaultValue={localDay()}
                    required
                  />
                </Field>
                <Field label="Model bunga">
                  <select name="model">
                    <option value="reducing">Saldo menurun / anuitas</option>
                    <option value="flat">Flat atas pokok awal</option>
                  </select>
                </Field>
                <details>
                  <summary>Perubahan bunga terjadwal</summary>
                  <Field label={'JSON, contoh: [{"month":7,"apr":9}]'}>
                    <textarea name="rates" defaultValue="[]" />
                  </Field>
                </details>
                <p className="hint">
                  Pencatatan utang tidak otomatis menambah saldo akun. Catat
                  pencairan secara terpisah menggunakan rekonsiliasi agar tidak
                  dihitung sebagai pendapatan.
                </p>
              </>
            )}
            {modal === "pay" && (
              <>
                <p>
                  Sisa pokok:{" "}
                  {money(new Decimal(selected.principal).minus(selected.paid))}
                </p>
                <Field label="Akun pembayaran">
                  <select required name="accountId">
                    <option value="">Pilih akun</option>
                    {s.accounts.map((a: any) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pokok dibayar (IDR)">
                  <input
                    name="principal"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                  />
                </Field>
                <Field label="Bunga dibayar (IDR)">
                  <input
                    name="interest"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </Field>
                <Field label="Tanggal">
                  <input
                    name="date"
                    type="date"
                    defaultValue={localDay()}
                    required
                  />
                </Field>
                <p className="hint">
                  Saldo berubah sebesar pokok + bunga. Hanya bunga dihitung
                  sebagai pengeluaran dalam laporan laba/rugi pribadi.
                </p>
              </>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Konfirmasi & simpan"}
            </Button>
          </form>
        )}
        {modal === "schedule" && schedule && (
          <>
            <Field label="Pembayaran pokok ekstra per bulan IDR">
              <input
                type="number"
                min="0"
                value={extra}
                onChange={(e) => setExtra(e.target.value || "0")}
              />
            </Field>
            <p>
              Estimasi {schedule.months} bulan · total bunga{" "}
              {rp(schedule.totalInterest)}. Simulasi dimulai dari sisa pokok
              dengan tenor yang tercatat; bukan jadwal kontrak aktual.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th>Pokok</th>
                    <th>Bunga</th>
                    <th>Cicilan</th>
                    <th>Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.rows.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{rp(r.principal)}</td>
                      <td>{rp(r.interest)}</td>
                      <td>{rp(r.payment)}</td>
                      <td>{rp(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" onClick={() => window.print()}>
              Cetak / PDF
            </Button>
          </>
        )}
        {modal === "import" && (
          <>
            <p>
              {csv?.length} baris akan divalidasi dan disimpan sebagai satu batch.
              Baris identik menggunakan ID yang sama agar
              impor ulang tidak menggandakan saldo.
            </p>
            <p className="hint">
              Kolom: kind, accountId, toAccountId, amount, category, date,
              description. Gunakan Export CSV untuk melihat ID akun. Format
              tanggal YYYY-MM-DD.
            </p>
            <pre>{JSON.stringify(csv?.slice(0, 5), null, 2)}</pre>
            <Button disabled={busy} onClick={confirmImport}>
              {busy ? "Mengimpor…" : "Konfirmasi impor"}
            </Button>
          </>
        )}
        {modal === "reconcile" && selected && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              const actual = String(
                new FormData(e.currentTarget).get("actual"),
              );
              const diff = new Decimal(actual).minus(selected.balance);
              if (diff.eq(0)) {
                setError("Saldo sudah sesuai.");
                return;
              }
              try {
                await store.addTransaction({
                  kind: "reconciliation",
                  adjustmentDirection: diff.gt(0) ? "increase" : "decrease",
                  accountId: selected.id,
                  amount: diff.abs().toFixed(2),
                  category: "Reconciliation",
                  date: localDay(),
                  description: "Reconciliation adjustment",
                  key,
                });
                await q.invalidateQueries();
                setModal("");
              } catch (e) {
                setError(e);
              }
            }}
          >
            <p>Saldo tercatat {money(selected.balance)}</p>
            <Field label="Saldo aktual IDR">
              <input name="actual" type="number" min="0" step="0.01" required />
            </Field>
            <p className="hint">
              Selisih dicatat sebagai penyesuaian saldo, tanpa menambah
              pendapatan atau pengeluaran. Catatan tetap dapat diaudit.
            </p>
            <Button type="submit">Konfirmasi penyesuaian</Button>
          </form>
        )}
      </section>}
    </>
  );
}
