import type {Environment} from './submissions.ts';
const resources={members:{bucket:'member-images',fields:['profile_image_path']},collaborations:{bucket:'collaboration-images',fields:['cover_image_path','logo_path']},events:{bucket:'event-images',fields:['cover_image_path']},stories:{bucket:'story-images',fields:['cover_image_path']},gallery_items:{bucket:'gallery-images',fields:['image_path']}} as const;
export function mediaHandler(env:Environment,requestFetch:typeof fetch=fetch){return async(req:Request)=>{
 const fail=(status=404)=>new Response(null,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(req.method!=='GET'&&req.method!=='HEAD')return fail(405);
 const u=new URL(req.url),resource=u.searchParams.get('resource'),id=u.searchParams.get('id');
 if(!resource||!Object.hasOwn(resources,resource)||!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return fail();
 const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!anon||!service)return fail(503);
 const info=resources[resource as keyof typeof resources];
 try{
  // The anonymous role applies the same RLS as the public website, including linked-gallery visibility.
  const lookup=new URL(url+'/rest/v1/'+resource);lookup.searchParams.set('id','eq.'+id);lookup.searchParams.set('published','eq.true');lookup.searchParams.set('select',info.fields.join(','));lookup.searchParams.set('limit','1');if(resource==='stories')lookup.searchParams.set('published_at','lte.'+new Date().toISOString());
  const result=await requestFetch(lookup,{headers:{apikey:anon,Authorization:'Bearer '+anon},signal:AbortSignal.timeout(8000)});if(!result.ok)return fail(503);const rows=await result.json();const row=rows[0];if(!row)return fail();const path=info.fields.map(f=>row[f]).find(v=>typeof v==='string'&&v.length>0);
  if(typeof path!=='string'||path.includes('..')||path.startsWith('/')||path.includes('://'))return fail();
  const object=await requestFetch(url+'/storage/v1/object/authenticated/'+info.bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{method:req.method,headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(10000)});
  if(!object.ok)return fail(object.status===404?404:503);
  const type=object.headers.get('content-type')?.split(';')[0]||'';if(!['image/jpeg','image/png','image/webp'].includes(type))return fail();
  return new Response(req.method==='HEAD'?null:object.body,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=30, must-revalidate','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Access-Control-Allow-Origin':'*'}});
 }catch{return fail(503);}
};}
