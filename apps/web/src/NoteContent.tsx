import type { ReactNode } from "react";

/** Render stored TipTap JSON or legacy Markdown as safe React elements. */
export default function NoteContent({ value }: { value: unknown }) {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (parsed && typeof parsed === "object" && (parsed as {type?:string}).type === "doc") {
    return <div className="fh-note-content">{renderNodes((parsed as {content?:unknown[]}).content || [])}</div>;
  }
  const lines = raw.split(/\r?\n/);
  return <div className="fh-note-content">{lines.map((line,i)=>{
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {return <div className={"fh-note-heading level-"+heading[1].length} key={i}>{heading[2]}</div>;}
    const check=/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if(check)return <p key={i} className="fh-note-check"><input type="checkbox" readOnly checked={check[1].toLowerCase()==="x"}/> {check[2]}</p>;
    const bullet=/^\s*[-*]\s+(.+)$/.exec(line);
    if(bullet)return <p key={i} className="fh-note-bullet">• {bullet[1]}</p>;
    return line?<p key={i}>{line}</p>:<br key={i}/>;
  })}</div>;
}
type Node = {type?:string;text?:string;content?:Node[];attrs?:Record<string,unknown>;marks?:{type?:string;attrs?:Record<string,unknown>}[]};
function renderNodes(nodes:unknown[]):ReactNode {
  return nodes.map((input,i)=>{
    if(!input||typeof input!=="object")return null;
    const node=input as Node;
    if(node.type==="text"){
      let child:ReactNode=node.text||"";
      for(const mark of node.marks||[]){
        if(mark.type==="bold")child=<strong>{child}</strong>;
        else if(mark.type==="italic")child=<em>{child}</em>;
        else if(mark.type==="strike")child=<s>{child}</s>;
        else if(mark.type==="code")child=<code>{child}</code>;
        else if(mark.type==="link"){const href=String(mark.attrs?.href||"");if(/^https?:\/\//i.test(href))child=<a href={href} target="_blank" rel="noopener noreferrer">{child}</a>;}
      }
      return <span key={i}>{child}</span>;
    }
    const children=renderNodes(node.content||[]);
    switch(node.type){
      case "paragraph":return <p key={i}>{children}</p>;
      case "heading":return <div key={i} className={"fh-note-heading level-"+String(node.attrs?.level||2)}>{children}</div>;
      case "bulletList":return <ul key={i}>{children}</ul>;
      case "orderedList":return <ol key={i}>{children}</ol>;
      case "listItem":return <li key={i}>{children}</li>;
      case "taskList":return <ul key={i} className="fh-note-tasks">{children}</ul>;
      case "taskItem":return <li key={i}><input type="checkbox" checked={node.attrs?.checked===true} readOnly/> {children}</li>;
      case "blockquote":return <blockquote key={i}>{children}</blockquote>;
      case "codeBlock":return <pre key={i}><code>{(node.content||[]).map(n=>n.text||"").join("")}</code></pre>;
      case "hardBreak":return <br key={i}/>;
      case "horizontalRule":return <hr key={i}/>;
      default:return <div key={i}>{children}</div>;
    }
  });
}
