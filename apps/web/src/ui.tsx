import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, Plus } from "lucide-react";
export const cn = (...args: any[]) => twMerge(clsx(args));
// shadcn/ui composition pattern: locally owned Radix primitives + CVA variants.
const variants = cva("button", {
  variants: {
    variant: {
      default: "primary",
      outline: "outline",
      ghost: "ghost",
      danger: "danger",
    },
  },
  defaultVariants: { variant: "default" },
});
export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof variants> & { asChild?: boolean }
>(({ className, variant, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(variants({ variant }), className)}
      ref={ref}
      {...props}
    />
  );
});
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const previousFocus = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay" />
        <DialogPrimitive.Content className="modal"
          onOpenAutoFocus={() => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={event => {
            // Dialogs are opened by shared shell actions rather than Radix Trigger.
            // Avoid moving focus out of another dialog during Quick Add handoff.
            if (document.querySelector('[role="dialog"][data-state="open"]')) { event.preventDefault(); return; }
            const previous = previousFocus.current;
            const target = previous?.isConnected && previous !== document.body ? previous :
              Array.from(document.querySelectorAll<HTMLElement>('.quick-add, .desktop-quick')).find(element => element.getClientRects().length > 0) || document.querySelector<HTMLElement>('#main button');
            if (target) { event.preventDefault(); target.focus(); }
          }}>

          <header>
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                {description || "Isi informasi lalu simpan perubahan."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" aria-label="Tutup">
                <X size={20} />
              </Button>
            </DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Empty({
  title = "Belum ada catatan",
  text = "Mulai dengan satu hal yang ingin Anda simpan.",
  onAdd,
}: {
  title?: string;
  text?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <Plus size={22} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {onAdd && (
        <Button onClick={onAdd}>
          <Plus size={16} /> Tambah pertama
        </Button>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="header-actions">{children}</div>
    </div>
  );
}
export function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="error">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}

export function BentoGrid({children,className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn("bento-grid",className)} {...props}>{children}</div>;}
export function BentoCard({children,className,span=4,...props}:React.HTMLAttributes<HTMLElement>&{span?:3|4|6|8|12}){return <section className={cn("panel","bento-card",`bento-span-${span}`,className)} {...props}>{children}</section>;}
export function StatusBadge({children,status}: {children?:React.ReactNode;status?:string}){return <span className={cn("badge",status==="Completed"&&"success",status==="In Progress"&&"in-progress",status==="To Do"&&"to-do")}>{children || status}</span>;}
export function ProgressCard({title,value,total=100,children}: {title:string;value:number;total?:number;children?:React.ReactNode}){const progress=total>0?Math.max(0,Math.min(100,value/total*100)):0;return <BentoCard><div className="section-heading"><h2>{title}</h2><span>{Math.round(progress)}%</span></div><progress aria-label={title} max={100} value={progress}/>{children}</BentoCard>;}
export function StatCard({title,value,description}: {title:string;value:React.ReactNode;description?:string}){return <BentoCard span={3} className="stat"><span>{title}</span><strong>{value}</strong>{description&&<small>{description}</small>}</BentoCard>;}
export function FilterDropdown({label,options,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{label:string;options:{value:string;label:string}[]}){return <Field label={label}><select {...props}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;}
export function SearchableSelect({label,options,value,onChange,placeholder="Pilih…",disabled=false}: {label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void;placeholder?:string;disabled?:boolean}){const [query,setQuery]=React.useState("");const id=React.useId();const selected=options.find(o=>o.value===value);const filtered=options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));return <div className="searchable-select"><label htmlFor={id+"-search"}>{label}</label><input id={id+"-search"} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={"Cari "+label.toLocaleLowerCase()} disabled={disabled}/><select id={id} aria-label={label} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}><option value="">{placeholder}</option>{selected&&!filtered.includes(selected)&&<option value={selected.value}>{selected.label}</option>}{filtered.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>{query&&!filtered.length&&<small role="status">Tidak ada hasil.</small>}</div>;}
export const ResponsiveModal = Modal;
export const BottomSheet = Modal;
export const EmptyState = Empty;
export function LoadingSkeleton({label="Memuat…"}:{label?:string}){return <div className="skeleton" role="status" aria-label={label}><span className="sr-only">{label}</span></div>;}
export function ConfirmationDialog({open,onOpenChange,title,description,onConfirm,busy=false}: {open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;onConfirm:()=>void;busy?:boolean}){return <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}><div className="row-actions"><Button variant="outline" onClick={()=>onOpenChange(false)} disabled={busy}>Batal</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy?"Memproses…":"Konfirmasi"}</Button></div></Modal>;}

export const SkeletonLoader = LoadingSkeleton;
