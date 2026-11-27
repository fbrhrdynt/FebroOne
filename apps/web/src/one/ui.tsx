import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import { Check as CheckIcon, ChevronRight, X } from "lucide-react";
import { kindMeta, areaColor } from "./kinds";
import type { RecordItem } from "../../../../packages/shared/catalog";
// Kept local so these primitives can load without the data layer (and its store).
const recordHref = (r: { id: string }) => `/r/${r.id}`;

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Sheet({ open, onOpenChange, title, children, wide = false }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="o-overlay" />
        <Dialog.Content className={cx("o-sheet", wide && "wide")} aria-describedby={undefined}>
          <div className="o-sheet-grip" aria-hidden />
          <header className="o-sheet-head">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="o-icon-btn" aria-label="Tutup"><X size={18} /></Dialog.Close>
          </header>
          <div className="o-sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function KindIcon({ kind, size = 16, boxed = true }: { kind: string; size?: number; boxed?: boolean }) {
  const Icon = kindMeta(kind).icon;
  if (!boxed) return <Icon size={size} style={{ color: areaColor(kind) }} aria-hidden />;
  return (
    <span className="o-kind-icon" style={{ "--tint": areaColor(kind) } as React.CSSProperties} aria-hidden>
      <Icon size={size} />
    </span>
  );
}

export function Section({ title, action, children, className, count }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; count?: number;
}) {
  return (
    <section className={cx("o-section", className)}>
      <header>
        <h2>{title}{count !== undefined && <span className="o-count">{count}</span>}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Row({ to, onClick, icon, title, meta, trailing, leading, muted, strike }: {
  to?: string; onClick?: () => void; icon?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode;
  trailing?: React.ReactNode; leading?: React.ReactNode; muted?: boolean; strike?: boolean;
}) {
  const body = (
    <>
      {icon}
      <span className="o-row-main">
        <span className={cx("o-row-title", strike && "strike")}>{title}</span>
        {meta && <span className="o-row-meta">{meta}</span>}
      </span>
      {trailing}
      {(to || onClick) && <ChevronRight size={16} className="o-row-chev" aria-hidden />}
    </>
  );
  return (
    <div className={cx("o-row", muted && "muted")}>
      {leading}
      {to ? <Link to={to} className="o-row-link">{body}</Link>
        : onClick ? <button type="button" className="o-row-link" onClick={onClick}>{body}</button>
        : <div className="o-row-link static">{body}</div>}
    </div>
  );
}

export function RecordRow({ record, meta, trailing, leading }: {
  record: RecordItem; meta?: React.ReactNode; trailing?: React.ReactNode; leading?: React.ReactNode;
}) {
  return <Row to={recordHref(record)} icon={leading ? undefined : <KindIcon kind={record.kind} />} leading={leading}
    title={record.title} meta={meta ?? kindMeta(record.kind).label} trailing={trailing} />;
}

export function Chip({ record, to, children, tone }: { record?: RecordItem; to?: string; children?: React.ReactNode; tone?: string }) {
  const content = <>{record && <KindIcon kind={record.kind} size={12} boxed={false} />}<span>{children ?? record?.title}</span></>;
  const style = tone ? ({ "--tint": tone } as React.CSSProperties) : undefined;
  const href = to ?? (record ? recordHref(record) : undefined);
  return href
    ? <Link className="o-chip" style={style} to={href} onClick={(e) => e.stopPropagation()}>{content}</Link>
    : <span className="o-chip" style={style}>{content}</span>;
}

export function Check({ checked, onChange, label, busy }: { checked: boolean; onChange: () => void; label: string; busy?: boolean }) {
  return (
    <button type="button" className={cx("o-check", checked && "on")} role="checkbox" aria-checked={checked}
      aria-label={label} disabled={busy} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(); }}>
      {checked && <CheckIcon size={14} strokeWidth={3} />}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string;
}) {
  return (
    <div className="o-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}{o.count ? <span className="o-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, total, tone }: { value: number; total: number; tone?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <span className="o-progress" style={tone ? ({ "--tint": tone } as React.CSSProperties) : undefined}
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: pct + "%" }} />
    </span>
  );
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="o-empty">
      {icon && <div className="o-empty-icon">{icon}</div>}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function PageHead({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <header className="o-page-head">
      <div>
        {eyebrow && <div className="o-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="o-page-actions">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div className="o-stat" style={tone ? ({ "--tint": tone } as React.CSSProperties) : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="o-error" role="alert">{error instanceof Error ? error.message : String(error)}</p>;
}
