export type Kind='contact'|'application'|'newsletter'|'event';
export type Payload={email:string;name:string;message:string;phone:string;interest:string;subject:string;consent:true;event_id?:string};
export function validateSubmission(input:unknown):{kind:Kind;payload:Payload;token:string}{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid request');
 const r=input as Record<string,unknown>,p=r.payload as Record<string,unknown>;
 if(!['contact','application','newsletter','event'].includes(String(r.kind))||!p||typeof p!=='object'||Array.isArray(p)||r.website)throw new Error('Invalid request');
 const kind=r.kind as Kind;
 const text=(key:string,max:number,min=0)=>{const v=p[key];if(v!==undefined&&v!==null&&typeof v!=='string')throw new Error('Invalid field');const s=((v as string)||'').trim();if(s.length<min||s.length>max||s.includes('\0'))throw new Error('Invalid field');return s;};
 const email=text('email',320,3).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||p.consent!==true)throw new Error('Invalid request');
 if(typeof r.token!=='string'||!r.token||r.token.length>2048)throw new Error('Invalid request');
 const payload:Payload={email,name:text('name',160,kind==='newsletter'?0:1),message:text('message',5000,['contact','application'].includes(kind)?10:0),phone:text('phone',40),interest:text('interest',160,kind==='application'?1:0),subject:text('subject',200),consent:true};
 if(kind==='event'){const id=text('event_id',36,36);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid event');payload.event_id=id;}
 return{kind,payload,token:r.token};
}
export async function rateKey(email:string,secret:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(email));return Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');}
export type Environment=(name:string)=>string|undefined;
export function submissionHandler(env:Environment,requestFetch:typeof fetch=fetch){return async(req:Request)=>{
 const origin=req.headers.get('origin')||'',origins=(env('PUBLIC_SITE_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const allowed=origins.includes(origin);const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization, x-client-info, apikey, content-type';headers['Access-Control-Allow-Methods']='POST, OPTIONS';}
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(!allowed)return reply(403,{error:'Request unavailable'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Request unavailable'});
 const secret=env('TURNSTILE_SECRET_KEY'),hosts=(env('TURNSTILE_HOSTNAMES')||'').split(',').map(s=>s.trim()).filter(Boolean),rateSecret=env('FORM_RATE_SECRET'),url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!secret||!hosts.length||!rateSecret||rateSecret.length<32||!url||!key)return reply(503,{error:'Temporarily unavailable'});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'Invalid request'});
 if(Number(req.headers.get('content-length'))>16000)return reply(413,{error:'Invalid request'});
 let submission:ReturnType<typeof validateSubmission>;
 try{const reader=req.body?.getReader();if(!reader)throw new Error();let size=0;const chunks:Uint8Array[]=[];while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();return reply(413,{error:'Invalid request'});}chunks.push(value);}const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}submission=validateSubmission(JSON.parse(new TextDecoder().decode(bytes)));}catch{return reply(400,{error:'Please check the form fields'});}
 try{
  const verification=await requestFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:submission.token}),signal:AbortSignal.timeout(10000)});
  if(!verification.ok)return reply(503,{error:'Security check unavailable'});
  const challenge=await verification.json();if(challenge.success!==true||challenge.action!=='abuja_enquiry'||!hosts.includes(challenge.hostname)||challenge.hostname!==new URL(origin).hostname)return reply(400,{error:'Please repeat the security check'});
  const response=await requestFetch(url+'/rest/v1/rpc/submit_public_enquiry',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_kind:submission.kind,p_payload:submission.payload,p_rate_key:await rateKey(submission.payload.email,rateSecret)}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){const failure=await response.json().catch(()=>({}));if(failure.message==='rate_limit')return reply(429,{error:'Please try again later'});if(failure.message==='invalid_submission')return reply(400,{error:'Please check the form fields'});return reply(503,{error:'Temporarily unavailable'});}
  return reply(200,{received:true});
 }catch{return reply(503,{error:'Temporarily unavailable'});}
};}
