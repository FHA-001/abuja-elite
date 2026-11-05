import {useEffect,useId,useRef,useState} from 'react';
import {Link} from 'wouter';
import {publicClient} from './data';
type Turnstile={render:(el:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void;reset:(id:string)=>void};
declare global{interface Window{turnstile?:Turnstile}}
let loader:Promise<Turnstile>|undefined;
function loadChallenge(){return loader??=new Promise<Turnstile>((resolve,reject)=>{if(window.turnstile){resolve(window.turnstile);return;}const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=()=>window.turnstile?resolve(window.turnstile):reject(new Error('Security check unavailable'));s.onerror=()=>{loader=undefined;s.remove();reject(new Error('Security check unavailable'));};document.head.append(s);});}
export function ConnectForm(){
 const id=useId(),[busy,setBusy]=useState(false),[result,setResult]=useState(''),[success,setSuccess]=useState(false),[token,setToken]=useState(''),[challengeError,setChallengeError]=useState(false),[attempt,setAttempt]=useState(0);
 const container=useRef<HTMLDivElement>(null),widget=useRef<string|undefined>(undefined);
 const siteKey=import.meta.env.VITE_TURNSTILE_SITE_KEY;const enabled=Boolean(siteKey&&import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
 useEffect(()=>{if(!enabled||success)return;let disposed=false;setChallengeError(false);loadChallenge().then(api=>{if(disposed||!container.current)return;widget.current=api.render(container.current,{sitekey:siteKey,action:'abuja_enquiry',theme:'dark',callback:(v:string)=>setToken(v),'expired-callback':()=>setToken(''),'error-callback':()=>{setToken('');setChallengeError(true);}});}).catch(()=>setChallengeError(true));return()=>{disposed=true;if(widget.current)window.turnstile?.remove(widget.current);widget.current=undefined;setToken('');};},[enabled,siteKey,success,attempt]);
 if(!enabled)return <div className="public-empty"><h3>Ask us anything.</h3><p>Online questions will open soon. For now, message us on Instagram.</p><a className="gold-button mt-5" href="https://www.instagram.com/the.elite_ng" target="_blank" rel="noopener noreferrer">Message @the.elite_ng ↗</a></div>;
 if(success)return <div className="public-empty" role="status"><h3>Thank you.</h3><p>We have your question and will reply to the email address you gave us.</p><button className="outline-button mt-5" onClick={()=>{setSuccess(false);setResult('');}}>Ask something else</button></div>;
 return <form className="public-form" aria-label="Ask Abuja Elite a question" onSubmit={async e=>{e.preventDefault();if(busy||!token)return;const form=e.currentTarget,fields=new FormData(form);setBusy(true);setResult('');try{const payload={name:fields.get('name'),email:fields.get('email'),message:fields.get('message'),consent:fields.get('consent')==='on'};const{data,error}=await publicClient().functions.invoke('submit-interest',{body:{kind:'contact',payload,token,website:fields.get('website')}});if(error||data?.received!==true)throw new Error('We could not send your question. Please retry shortly or message us on Instagram.');form.reset();setSuccess(true);}catch(err){setResult(err instanceof Error?err.message:'Unable to send. Please retry.');}finally{setBusy(false);setToken('');if(widget.current)window.turnstile?.reset(widget.current);}}}>
 <h2>Ask us anything</h2>
 <label htmlFor={id+'message'}>What would you like to know?<textarea id={id+'message'} name="message" rows={5} required minLength={10} maxLength={5000} placeholder="Membership, events, working with us…"/></label>
 <label htmlFor={id+'name'}>Your name<input id={id+'name'} name="name" autoComplete="name" required maxLength={160}/></label>
 <label htmlFor={id+'email'}>Email address<input id={id+'email'} name="email" type="email" autoComplete="email" required maxLength={320}/></label>
 <div className="form-honeypot" aria-hidden="true"><label>Leave this blank<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
 <label className="consent"><input name="consent" type="checkbox" required/><span>I agree that Abuja Elite may use these details to reply to my question. <Link href="/privacy">Privacy information</Link></span></label>
 <div ref={container}/>{challengeError&&<p role="alert">The security check could not load. <button type="button" className="public-more" onClick={()=>setAttempt(v=>v+1)}>Retry security check</button></p>}
 <button className="gold-button" disabled={busy||!token}>{busy?'Sending…':'Send question ↗'}</button>{result&&<p role="alert">{result}</p>}
 </form>;
}
