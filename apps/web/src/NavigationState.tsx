import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
const positions=new Map<string,number>();
export default function NavigationState(){
 const location=useLocation();const type=useNavigationType();
 useEffect(()=>{
  const key=location.pathname+location.search;
  let stop=false;const target=type==='POP'?(positions.get(key)||0):0;
  window.scrollTo(0,target);
  const observer=new ResizeObserver(()=>{if(!stop&&target)window.scrollTo(0,target)});observer.observe(document.body);
  const timer=setTimeout(()=>{stop=true;observer.disconnect()},1200);
  const moved=()=>{stop=true;};window.addEventListener('touchstart',moved,{passive:true});window.addEventListener('wheel',moved,{passive:true});
  const save=()=>positions.set(key,window.scrollY);window.addEventListener('scroll',save,{passive:true});
  return ()=>{clearTimeout(timer);observer.disconnect();window.removeEventListener('touchstart',moved);window.removeEventListener('wheel',moved);window.removeEventListener('scroll',save)};
 },[location.pathname,location.search,type]);
 return null;
}
