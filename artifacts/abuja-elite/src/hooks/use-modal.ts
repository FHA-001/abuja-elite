import { useEffect, useRef, type RefObject } from 'react';
export function useModal(ref:RefObject<HTMLElement|null>,onClose:()=>void,enabled=true){
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  if(!enabled)return;
  const old=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const element=ref.current;
  const controls=()=>Array.from(element?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')??[]).filter(e=>e.getClientRects().length>0);
  const timer=setTimeout(()=>controls()[0]?.focus(),0);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close.current();}if(e.key==='Tab'){const all=controls();const first=all[0],last=all.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||!element?.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!element?.contains(document.activeElement))){e.preventDefault();first.focus();}}};
  document.addEventListener('keydown',key);
  return()=>{clearTimeout(timer);document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus();};
 },[enabled,ref]);
}
