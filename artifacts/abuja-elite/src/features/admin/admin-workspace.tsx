import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Menu, X, LogOut, ExternalLink, Eye, EyeOff, Plus, ArrowRight, RefreshCw } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { getSupabaseClient, supabaseConfig } from '@/lib/supabase/client';
import { getAdminDashboardCounts } from '@/lib/supabase/content';
import { uploadAdminMedia, createAdminMediaPreview, type MediaBucket } from '@/lib/supabase/storage';
import { Editor, RecordList, type DashboardResource } from '@/pages/admin-dashboard';
import { validateContent, type ContentResource } from '@/lib/content-validation';
import { useModal } from '@/hooks/use-modal';
import { getDraft, setDraft, clearDraft, clearUserDrafts } from '@/lib/admin-draft-store';
import '@/pages/admin-dashboard.css';
import './admin-extra.css';

const resources = {members:'Members',collaborations:'Collaborations',events:'Experiences',stories:'Stories',gallery_items:'Gallery',site_settings:'Homepage & settings'} as const;
const inboxes = {applications:'Applications',contact_messages:'Messages',event_interests:'Event interest',newsletter_subscribers:'Newsletter'} as const;
type Inbox=keyof typeof inboxes;
type Section='overview'|ContentResource|Inbox;
type Row=Record<string,unknown>&{id:string};
const buckets:Record<ContentResource,MediaBucket>={members:'member-images',collaborations:'collaboration-images',events:'event-images',stories:'story-images',gallery_items:'gallery-images',site_settings:'site-assets'};
const inboxStatuses:Partial<Record<Inbox,string[]>>={applications:['new','reviewed','contacted','accepted','declined','archived'],contact_messages:['new','reviewed','replied','archived'],newsletter_subscribers:['pending','subscribed','unsubscribed']};
const settingFields=[['hero_title','Hero headline'],['hero_description','Hero introduction'],['contact_email','Contact email'],['instagram_url','Instagram URL'],['footer_text','Footer message']] as const;
function errorText(error:unknown){return error instanceof Error?error.message:'The request failed. Please retry.';}

export default function AdminWorkspace({loginOnly=false}:{loginOnly?:boolean}){
 const auth=useSupabaseAuth();const cache=useQueryClient();const[,navigate]=useLocation();
 const [section,setSection]=useState<Section>('overview'),[page,setPage]=useState(0),[search,setSearch]=useState(''),[nav,setNav]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [editor,setEditor]=useState<{resource:ContentResource;record?:Row}>(),[selected,setSelected]=useState<Row>();
 const navRef=useRef<HTMLElement>(null);useModal(navRef,()=>setNav(false),nav);
 const admin=auth.status==='authenticated'&&auth.isAdmin;
 useEffect(()=>{cache.cancelQueries({queryKey:['admin']});cache.removeQueries({queryKey:['admin']});setEditor(undefined);setSelected(undefined);setMessage('');if(auth.user?.id)clearUserDrafts(auth.user.id);},[auth.user?.id,cache]);
 useEffect(()=>{if(!admin){cache.cancelQueries({queryKey:['admin']});cache.removeQueries({queryKey:['admin']});}},[admin,cache]);
 useEffect(()=>{if(auth.status==='unauthenticated'&&!loginOnly)navigate('/admin/login',{replace:true});if(admin&&loginOnly)navigate('/admin',{replace:true});},[auth.status,admin,loginOnly,navigate]);
 const counts=useQuery({queryKey:['admin',auth.user?.id,'counts'],queryFn:getAdminDashboardCounts,enabled:admin&&section==='overview',staleTime:15000,retry:1});
 const records=useQuery({queryKey:['admin',auth.user?.id,section,page],queryFn:async({signal})=>{
  if(section==='overview')return {rows:[] as Row[],total:0};
  const q=getSupabaseClient().from(section).select('*',{count:'exact'}).order(section==='site_settings'?'setting_key':'created_at',{ascending:section==='site_settings'}).order('id').range(page*30,page*30+29).abortSignal(signal);
  const {data,error,count}=await q;if(error)throw new Error(error.message);return{rows:(data??[]) as unknown as Row[],total:count??0};
 },enabled:admin&&section!=='overview',retry:1});
 const choose=(value:Section)=>{setSection(value);setPage(0);setSearch('');setSelected(undefined);setNav(false);setMessage('');};
 async function logout(){setBusy(true);setMessage('');try{const{error}=await getSupabaseClient().auth.signOut();if(error)throw error;cache.removeQueries({queryKey:['admin']});if(auth.user?.id)clearUserDrafts(auth.user.id);auth.retry();navigate('/admin/login',{replace:true});}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}
 async function save(resource:ContentResource,payload:Record<string,unknown>,id?:string){
  const validated=validateContent(resource,payload);
  const q=id?getSupabaseClient().from(resource).update(validated as never).eq('id',id):getSupabaseClient().from(resource).insert(validated as never);
  const {data,error}=await q.select('id').single();if(error||!data)throw new Error(error?.message||'No record changed. Your access may have changed.');
  await cache.invalidateQueries({queryKey:['admin']});cache.invalidateQueries({queryKey:['public']});
 }
 async function remove(resource:ContentResource,id:string){
  if(!window.confirm('Delete this record? Its uploaded images will be kept so shared images remain available.'))return;
  try{const{data,error}=await getSupabaseClient().from(resource).delete().eq('id',id).select('id').single();if(error||!data)throw error||new Error('Nothing was deleted.');await cache.invalidateQueries({queryKey:['admin']});cache.invalidateQueries({queryKey:['public']});}catch(e){setMessage(errorText(e));}
 }
 async function upload(file:File,ctx:{resource:DashboardResource;field:string;recordId?:string}){const bucket=buckets[ctx.resource];const path=await uploadAdminMedia(bucket,file,`${ctx.resource}/${ctx.recordId||'drafts'}/${ctx.field}`);return{path,previewUrl:await createAdminMediaPreview(bucket,path)};}
 async function preview(path:string){const r=path.split('/')[0] as ContentResource;if(!buckets[r])throw new Error('Unknown image category.');return createAdminMediaPreview(buckets[r],path);}
 if(!admin||loginOnly)return <div className="ae-admin"><main className="ae-gate"><div className="ae-gate-card"><Link href="/" className="ae-brand-lockup">ABUJA ELITE</Link><p className="ae-kicker mt-8">The editorial desk</p>
 {auth.status==='loading'||(admin&&loginOnly)?<><h1 className="ae-gate-title">Opening the desk.</h1><p role="status">Checking your session…</p></>:auth.status==='error'?<><h1 className="ae-gate-title">Let’s try that again.</h1><p role="alert">{auth.error?.message}</p><button className="gold-button mt-6" onClick={auth.retry}>Retry access check</button>{auth.session&&<button className="outline-button mt-4" onClick={logout} disabled={busy}>Sign out</button>}</>:auth.status==='authenticated'?<><h1 className="ae-gate-title">Access restricted.</h1><p>This account is not authorized to manage Abuja Elite.</p><button className="gold-button mt-6" onClick={logout} disabled={busy}>Sign out</button></>:<><h1 className="ae-gate-title">Welcome back.</h1><p className="body-copy mt-4">Sign in to manage the people, stories and experiences.</p><form className="mt-8 space-y-5" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{const{error}=await getSupabaseClient().auth.signInWithPassword({email:email.trim(),password});if(error)throw new Error('Unable to sign in. Check your email and password.');setPassword('');}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}}>
 <label className="ae-field">Email<Input value={email} onChange={setEmail} type="email" autoComplete="email" required/></label>
 <label className="ae-field">Password<span className="ae-password-wrap"><Input value={password} onChange={setPassword} type={show?'text':'password'} autoComplete="current-password" required/><button type="button" aria-label={show?'Hide password':'Show password'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
 <button className="gold-button w-full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><button className="ae-text-button mt-5" disabled={busy||!supabaseConfig.isConfigured} onClick={async()=>{if(!email.trim()){setMessage('Enter your email address first.');return;}setBusy(true);try{const{error}=await getSupabaseClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/admin/reset-password'});if(error)throw error;setMessage('If this account can receive a reset email, a link will arrive shortly.');}catch{setMessage('Unable to request a reset. Please retry later.');}finally{setBusy(false);}}}>Forgot your password?</button></>}
 {message&&<p role="status" className="ae-inline-error mt-5">{message}</p>}</div></main></div>;
 const isContent=section in resources;
 const rows=records.data?.rows??[];
 const inboxRows=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
 return <div className="ae-admin"><a className="skip-link" href="#admin-main">Skip to content</a><aside ref={navRef} className={`ae-sidebar ${nav?'ae-sidebar-open':''}`} role={nav?'dialog':undefined} aria-modal={nav||undefined} aria-label="Admin navigation">
 <div className="ae-sidebar-brand"><span className="ae-monogram">AE</span><strong>Abuja Elite</strong><button className="ae-icon-button md:hidden ml-auto" onClick={()=>setNav(false)} aria-label="Close menu"><X/></button></div>
 <nav className="ae-nav-scroll mt-8" aria-label="Editorial sections">{Object.entries({overview:'Overview',...resources,...inboxes}).map(([id,label])=><button key={id} className={`ae-nav-item ${section===id?'ae-nav-item-active':''}`} aria-current={section===id?'page':undefined} onClick={()=>choose(id as Section)}>{label}</button>)}</nav>
 <div className="mt-auto pt-5"><p className="text-xs break-all mb-3">{auth.user?.email}</p><button className="ae-signout" onClick={logout} disabled={busy}><LogOut size={16}/> Sign out</button></div></aside>{nav&&<div className="ae-sidebar-overlay md:hidden" onClick={()=>setNav(false)}/>}
 <div className="ae-main"><header className="ae-topbar"><button className="ae-icon-button md:hidden" onClick={()=>setNav(true)} aria-label="Open menu" aria-expanded={nav}><Menu/></button><span>{section==='overview'?'Overview':({...resources,...inboxes})[section]}</span><Link href="/" className="ae-icon-button ml-auto" aria-label="View public website"><ExternalLink size={18}/></Link></header>
 <main className="ae-content" id="admin-main">{message&&<p className="ae-error-row" role="alert">{message}<button className="ml-auto" onClick={()=>setMessage('')} aria-label="Dismiss"><X size={16}/></button></p>}
 {section==='overview'?<><p className="ae-kicker">Your city. Your stories.</p><h1 className="ae-page-title mt-3">Keep the signal clear.</h1><p className="body-copy mt-5 mb-8">Build a living record of Abuja. Publish only approved people, images and stories.</p>{counts.isError?<p className="ae-error-row" role="alert">Counts could not load. <button onClick={()=>counts.refetch()}>Retry</button></p>:<div className="ae-overview-grid">{[['members','Members','members'],['collaborations','Collaborations','collaborations'],['events','Experiences','events'],['stories','Stories','stories'],['gallery_items','Gallery images','gallery_items'],['new_applications','New applications','applications'],['new_contact_messages','New messages','contact_messages'],['event_interests','Event interest','event_interests'],['subscribed_newsletters','Subscribers','newsletter_subscribers']].map(([key,label,target])=><button className="ae-metric text-left" key={key} onClick={()=>choose(target as Section)}><span className="ae-kicker">{label}</span><strong className="ae-count">{counts.isPending?'—':counts.data?.[key as keyof typeof counts.data]}</strong><span className="text-xs">Open section <ArrowRight size={12} className="inline"/></span></button>)}</div>}<div className="ae-empty mt-8"><h2>Ready for the next chapter.</h2><p>Add content as a draft, upload approved photography, then publish when it is ready. Dates use Abuja time.</p><button className="gold-button mt-5" onClick={()=>choose('members')}>Manage members</button></div></>:
 <><div className="ae-section-heading"><div><p className="ae-kicker">Editorial workspace</p><h1 className="ae-page-title mt-3">{({...resources,...inboxes})[section]}</h1></div>{isContent&&<button className="gold-button" onClick={()=>setEditor({resource:section as ContentResource})}><Plus size={15}/> Add record</button>}</div>
 {section==='site_settings'&&<Settings save={save}/>}
 {isContent?<RecordList resource={section as ContentResource} records={rows as never} isLoading={records.isPending} error={records.error?errorText(records.error):null} query={search} onQueryChange={setSearch} onEdit={r=>setEditor({resource:section as ContentResource,record:r as unknown as Row})} onDelete={r=>remove(section as ContentResource,r.id)} onRetry={()=>records.refetch()}/>:
 <><label className="ae-field mb-5">Search this page<Input value={search} onChange={setSearch}/></label>{records.isPending?<p role="status">Loading records…</p>:records.isError?<p role="alert">Could not load records. <button onClick={()=>records.refetch()}>Retry</button></p>:inboxRows.length===0?<div className="ae-empty">No matching records yet.</div>:<div className="ae-inbox-list">{inboxRows.map(r=><button key={r.id} className="ae-inbox-row" onClick={()=>setSelected(r)}><strong>{String(r.name||r.normalized_email||r.email)}</strong><span>{String(r.status||'Received')}</span><small>{new Date(String(r.created_at)).toLocaleDateString('en-NG',{timeZone:'Africa/Lagos'})}</small></button>)}</div>}</>}
 <div className="ae-pagination"><button disabled={page===0||records.isFetching} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} · {records.data?.total??'—'} records</span><button disabled={records.isFetching||(page+1)*30>=(records.data?.total??0)} onClick={()=>setPage(p=>p+1)}>Next</button></div></>}
 </main></div>
 {editor&&<Editor resource={editor.resource} record={editor.record as never} onClose={()=>setEditor(undefined)} onCreate={(r,p)=>save(r,p)} onUpdate={(r,id,p)=>save(r,p,id)} onUploadMedia={upload} createMediaPreview={preview} userId={auth.user?.id}/>}
 {selected&&<InboxDetail row={selected} kind={section as Inbox} onClose={()=>setSelected(undefined)} onChanged={()=>{cache.invalidateQueries({queryKey:['admin']});setSelected(undefined);}}/>}</div>;
}
function Input({value,onChange,...props}:{value:string;onChange:(v:string)=>void;type?:string;autoComplete?:string;required?:boolean}){return <input className="ae-input" value={value} onChange={e=>onChange(e.target.value)} {...props}/>;}
function InboxDetail({row,kind,onClose,onChanged}:{row:Row;kind:Inbox;onClose:()=>void;onChanged:()=>void}){
 const ref=useRef<HTMLElement>(null);useModal(ref,onClose);const[status,setStatus]=useState(String(row.status||'')),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <div className="ae-drawer-backdrop"><aside ref={ref} className="ae-drawer" role="dialog" aria-modal="true" aria-label="Submission details"><div className="ae-drawer-head"><h2>{inboxes[kind]}</h2><button onClick={onClose} aria-label="Close"><X/></button></div><div className="ae-drawer-body"><dl className="ae-detail-fields">{Object.entries(row).filter(([k])=>!['updated_at','id','normalized_email'].includes(k)||k==='normalized_email'&&!row.email).map(([k,v])=><div key={k}><dt>{k.replaceAll('_',' ')}</dt><dd>{typeof v==='boolean'?(v?'Yes':'No'):String(v??'—')}</dd></div>)}</dl>{inboxStatuses[kind]&&<label className="ae-field mt-6">Review status<select className="ae-input" value={status} onChange={e=>setStatus(e.target.value)}>{inboxStatuses[kind]!.map(s=><option key={s}>{s}</option>)}</select></label>}{kind==='newsletter_subscribers'&&<p className="mt-4 text-sm">Only mark subscribed after confirming the person’s permission. This dashboard does not send campaigns.</p>}{error&&<p role="alert">{error}</p>}
 {inboxStatuses[kind]&&<button disabled={busy} className="gold-button mt-6" onClick={async()=>{setBusy(true);setError('');try{if(kind==='newsletter_subscribers'&&status==='subscribed'&&row.consent!==true)throw new Error('Consent is required before subscribing.');const patch:Record<string,unknown>={status};if(kind==='newsletter_subscribers'){patch.unsubscribed_at=status==='unsubscribed'?new Date().toISOString():null;if(status==='subscribed')patch.subscribed_at=row.subscribed_at||new Date().toISOString();}const{data,error}=await getSupabaseClient().from(kind).update(patch as never).eq('id',row.id).select('id').single();if(error||!data)throw error||new Error('No record changed.');onChanged();}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>{busy?'Saving…':'Save status'}</button>}
 <button className="ae-text-button mt-6" disabled={busy} onClick={async()=>{if(!window.confirm('Permanently delete this submission and its personal information?'))return;setBusy(true);try{const{data,error}=await getSupabaseClient().from(kind).delete().eq('id',row.id).select('id').single();if(error||!data)throw error||new Error('No record deleted.');onChanged();}catch(e){setError(errorText(e));}finally{setBusy(false);}}}>Delete record</button></div></aside></div>;
}
function Settings({save}:{save:(r:ContentResource,p:Record<string,unknown>,id?:string)=>Promise<void>}){
 const auth=useSupabaseAuth();
 const[values,setValues]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
 const query=useQuery({queryKey:['admin','settings-form'],queryFn:async()=>{const{data,error}=await getSupabaseClient().from('site_settings').select('*').in('setting_key',settingFields.map(([key])=>key));if(error)throw error;return data;}});
 useEffect(()=>{
  if(query.data&&!dirty){
   const serverValues=Object.fromEntries(query.data.map(r=>[r.setting_key,typeof r.value==='string'?r.value:'']));
   const draft=getDraft(auth.user?.id||'','site_settings','settings-form') as Record<string,string>|null;
   setValues(draft||serverValues);
  }
 },[query.data,dirty,auth.user?.id]);
 useEffect(()=>{
  if(dirty&&auth.user?.id)setDraft(auth.user.id,'site_settings','settings-form',values);
 },[dirty,values,auth.user?.id]);
 const handleChange=(key:string,value:string)=>{setDirty(true);setValues({...values,[key]:value});};
 const handleClose=()=>{if(auth.user?.id)clearDraft(auth.user.id,'site_settings','settings-form');setDirty(false);};
 return <form className="ae-settings" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{for(const[key]of settingFields){const value=(values[key]||'').trim();if(key==='instagram_url'&&value&&!/^https:\/\/www\.instagram\.com\//.test(value))throw new Error('Use a full https://www.instagram.com/ URL.');if(key==='contact_email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Enter a valid contact email.');const existing=query.data?.find(r=>r.setting_key===key);await save('site_settings',{setting_key:key,value,is_public:true},existing?.id);}setMessage('Settings saved.');handleClose();}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}}><h2 className="text-xl mb-4">Public website settings</h2><p className="mb-5 text-sm">Blank values use the default brand copy. Only enter approved public contact information.</p>{query.isError?<p role="alert">Settings could not load. <button type="button" onClick={()=>query.refetch()}>Retry</button></p>:settingFields.map(([key,label])=><label key={key} className="ae-field mb-4">{label}<Input value={values[key]||''} onChange={v=>handleChange(key,v)}/></label>)}<button className="gold-button" disabled={busy||query.isPending||query.isError}>{busy?'Saving…':'Save website settings'}</button>{message&&<p role="status" className="mt-4">{message}</p>}<p className="mt-8 text-sm">Advanced records below are available for additional structured settings.</p></form>;
}
