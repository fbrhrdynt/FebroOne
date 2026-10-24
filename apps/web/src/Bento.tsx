import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Home, CalendarDays, Plus, CheckSquare, Grid2X2, BriefcaseBusiness, GraduationCap, Heart, FolderLock, Wallet, BookOpen, Sparkles, Calculator } from 'lucide-react';
import { BentoCard, cn } from './ui';
export function ModuleHeader({title,to,children}:{title:string;to?:string;children?:ReactNode}) {
  return <div className="section-heading"><h2>{title}</h2>{to ? <Link to={to} aria-label={'Buka '+title}><ArrowUpRight size={18}/></Link> : children}</div>;
}
export function ActivityCard({title,to,children,className}:{title:string;to?:string;children:ReactNode;className?:string}) {
  return <BentoCard className={className}><ModuleHeader title={title} to={to}/>{children}</BentoCard>;
}
export function ChartCard({title,description,children}:{title:string;description:string;children:ReactNode}) {
  return <BentoCard className="cashflow-card"><ModuleHeader title={title} to="/finance"/><p className="hint">{description}</p>{children}</BentoCard>;
}
export function QuickAction({icon,children,onClick}:{icon:ReactNode;children:ReactNode;onClick:()=>void}) {
  return <button className="quick-action" onClick={onClick}>{icon}<span>{children}</span><Plus size={16}/></button>;
}
export function MobileBottomNavigation({onQuickAdd}:{onQuickAdd:()=>void}) {
  return <nav className="bottom-nav" aria-label="Navigasi mobile"><NavLink to="/" end><Home size={21}/><span>Home</span></NavLink><NavLink to="/calendar"><CalendarDays size={21}/><span>Calendar</span></NavLink><button className="quick-add" onClick={onQuickAdd} aria-label="Quick Add"><span><Plus size={24}/></span><small>Quick Add</small></button><NavLink to="/records/tasks"><CheckSquare size={21}/><span>Tasks</span></NavLink><NavLink to="/more"><Grid2X2 size={21}/><span>More</span></NavLink></nav>;
}
export function CompletionRing({value,label}:{value:number;label:string}) {
  const percent=Math.round(Math.max(0,Math.min(100,value)));
  return <div className="completion-ring" role="img" aria-label={label+': '+percent+'%'}><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="41"/><circle cx="50" cy="50" r="41" pathLength="100" strokeDasharray={`${percent} 100`}/></svg><strong>{percent}%</strong></div>;
}
export function StatusDot({status}:{status:string}) {return <span className={cn('status-dot',status==='Completed'?'status-complete':status==='In Progress'?'status-progress':'status-todo')} aria-hidden="true"/>;}
export function ModuleIcon({group}:{group:string}) {
  const icons: Record<string,typeof CheckSquare> = {Produktivitas:CheckSquare,Pengetahuan:BookOpen,Kehidupan:Heart,Workspace:BriefcaseBusiness,Karier:GraduationCap,Berkas:FolderLock,Keuangan:Wallet,Intelligence:Sparkles,Tools:Calculator};
  const Icon = icons[group] || Grid2X2;
  return <span className="module-icon" data-group={group}><Icon size={16}/></span>;
}
