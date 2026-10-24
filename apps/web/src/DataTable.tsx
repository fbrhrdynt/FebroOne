import type {ReactNode} from 'react';
export type Column<T>={key:string;label:string;render:(row:T)=>ReactNode};
export default function DataTable<T extends {id:string}>({rows,columns,card,onOpen}:{rows:T[];columns:Column<T>[];card:(row:T)=>ReactNode;onOpen:(row:T)=>void}){
 return <><div className="responsive-table"><table><thead><tr>{columns.map(c=><th key={c.key} scope="col">{c.label}</th>)}<th scope="col">Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>{columns.map(c=><td key={c.key}>{c.render(r)}</td>)}<td><button onClick={()=>onOpen(r)}>Edit</button></td></tr>)}</tbody></table></div><div className="mobile-data-cards">{rows.map(card)}</div></>;
}
