import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Sheet, cx } from "./ui";

export type SelectOption = { value: string; label: string; group?: string; hint?: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("id");

/**
 * A dropdown that opens a searchable list. Works controlled (value/onChange)
 * or inside a plain <form> (name/defaultValue): the chosen value is posted
 * through a hidden field, and `required` still blocks an empty submit.
 */
export function SearchSelect({
  options, value, defaultValue = "", onChange, name, label, placeholder = "Pilih…", emptyLabel,
  required, disabled, className, onSearch, loading,
}: {
  options: SelectOption[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; name?: string;
  label: string; placeholder?: string; emptyLabel?: string; required?: boolean; disabled?: boolean; className?: string;
  /** When set, the query is handed to the parent (e.g. to search the server) instead of only filtering locally. */
  onSearch?: (q: string) => void; loading?: boolean;
}) {
  const [inner, setInner] = useState(value ?? defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => { if (value !== undefined) setInner(value); }, [value]);
  useEffect(() => { if (!onSearch) return; const t = setTimeout(() => onSearch(q.trim()), 250); return () => clearTimeout(t); }, [q, onSearch]);

  const all = useMemo(() => (emptyLabel !== undefined ? [{ value: "", label: emptyLabel }, ...options] : options), [options, emptyLabel]);
  const selected = all.find((o) => o.value === current);
  const shown = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle || onSearch) return all;
    return all.filter((o) => fold(`${o.label} ${o.group || ""} ${o.hint || ""}`).includes(needle));
  }, [all, q, onSearch]);
  useEffect(() => { setActive(Math.max(0, shown.findIndex((o) => o.value === current))); }, [open, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const choose = (v: string) => { if (value === undefined) setInner(v); onChange?.(v); setOpen(false); setQ(""); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active].value); }
  };

  let lastGroup: string | undefined;
  return (
    <>
      <button type="button" className={cx("o-select-trigger", !selected?.label && "placeholder", className)} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${selected?.label || placeholder}`} onClick={() => setOpen(true)}>
        <span>{selected?.label || placeholder}</span>
        {selected?.hint && <small>{selected.hint}</small>}
        <ChevronDown size={16} aria-hidden />
      </button>
      {name && <input className="o-select-proxy" tabIndex={-1} aria-hidden name={name} value={current} required={required} onChange={() => {}}
        onInvalid={(e) => { e.preventDefault(); setOpen(true); }} />}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }} title={label}>
        <label className="o-search"><Search size={16} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={`Cari ${label.toLocaleLowerCase("id")}…`}
            aria-label={`Cari ${label}`} aria-controls={id} aria-activedescendant={shown[active] ? `${id}-${active}` : undefined} role="combobox" aria-expanded />
        </label>
        <div className="o-picker-results" ref={listRef}>
          {shown.length ? (
            <div className="o-list" role="listbox" id={id} aria-label={label}>
              {shown.map((o, i) => {
                const head = o.group && o.group !== lastGroup ? o.group : null;
                lastGroup = o.group;
                return (
                  <div key={`${o.value}-${i}`}>
                    {head && <div className="o-select-group">{head}</div>}
                    <button type="button" role="option" id={`${id}-${i}`} data-i={i} aria-selected={o.value === current}
                      className={cx("o-select-option", i === active && "active", o.value === current && "on")}
                      onMouseEnter={() => setActive(i)} onClick={() => choose(o.value)}>
                      <span className="o-row-main"><span className="o-row-title">{o.label}</span>{o.hint && <span className="o-row-meta">{o.hint}</span>}</span>
                      {o.value === current && <Check size={16} aria-hidden />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : <div className="o-empty"><strong>{loading ? "Mencari…" : "Tidak ada yang cocok"}</strong><p>Coba kata kunci lain.</p></div>}
        </div>
      </Sheet>
    </>
  );
}

/** Time zones grouped by region, labelled with their current offset (and WIB/WITA/WIT where it applies). */
export function timeZoneOptions(current?: string): SelectOption[] {
  let zones: string[];
  try { zones = (Intl as any).supportedValuesOf("timeZone"); } catch { zones = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "UTC"]; }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  const now = new Date();
  const name = (tz: string, style: "short" | "shortOffset") => {
    try { return new Intl.DateTimeFormat("id-ID", { timeZone: tz, timeZoneName: style }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value || ""; }
    catch { return ""; }
  };
  const indonesia = ["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"];
  return zones.map((tz) => {
    const [region, ...rest] = tz.split("/");
    const short = name(tz, "short"), offset = name(tz, "shortOffset");
    return {
      value: tz,
      label: rest.length ? rest.join(" / ").replace(/_/g, " ") : tz,
      group: indonesia.includes(tz) ? "Indonesia" : region,
      hint: [short && short !== offset ? short : "", offset].filter(Boolean).join(" · "),
    };
  }).sort((a, b) => {
    const ra = indonesia.indexOf(a.value), rb = indonesia.indexOf(b.value);
    if (ra >= 0 || rb >= 0) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    return a.group!.localeCompare(b.group!) || a.label.localeCompare(b.label);
  });
}
