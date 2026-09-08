import { createClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/lib/supabase/database.types';
import { SupabaseConfigurationError } from '@/lib/supabase/client';
export type PublicResource='members'|'collaborations'|'events'|'stories'|'gallery_items';
export type PublicRecord={id:string;slug?:string;name?:string;title?:string;bio?:string|null;description?:string|null;excerpt?:string|null;content?:string;role?:string|null;category?:string|null;location?:string|null;website_url?:string|null;instagram_url?:string|null;registration_url?:string|null;profile_image_path?:string|null;cover_image_path?:string|null;logo_path?:string|null;image_path?:string;caption?:string|null;alt_text?:string;starts_at?:string;ends_at?:string|null;status?:string;published_at?:string|null;author_name?:string|null;featured?:boolean;};
export const resourceInfo={members:{title:'The community',kicker:'People with a point of view',description:'Meet the people bringing ambition, perspective and possibility to Abuja.',route:'/members',bucket:'member-images',search:'name'},collaborations:{title:'In good company.',kicker:'Shared ambition',description:'Discover approved collaborations and the people and businesses behind them.',route:'/collaborations',bucket:'collaboration-images',search:'name'},events:{title:'Go where the energy is.',kicker:'Experiences / Abuja',description:'Gatherings, conversations and moments worth making time for.',route:'/experiences',bucket:'event-images',search:'title'},stories:{title:'A city in its own words.',kicker:'The journal',description:'Stories of community, business, ambition and the everyday pursuit of excellence.',route:'/stories',bucket:'story-images',search:'title'},gallery_items:{title:'The moments between.',kicker:'Visual archive',description:'Approved photographs from the Abuja Elite community.',route:'/gallery',bucket:'gallery-images',search:'caption'}} as const;
let client:ReturnType<typeof createClient<Database>>|undefined;
export function publicClient(){const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new SupabaseConfigurationError();return client??=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'abuja-elite-public'}});}
export function usePublicList(resource:PublicResource,page=0,search='',category='',featured=false,limit=12,eventFilter='all'){
 return useQuery({queryKey:['public',resource,page,search,category,featured,limit,eventFilter],queryFn:async({signal})=>{
  let q=publicClient().from(resource).select('*',{count:'exact'}).eq('published',true);
  if(resource==='stories')q=q.not('published_at','is',null).lte('published_at',new Date().toISOString());
  if(resource==='events'&&eventFilter==='upcoming')q=q.filter('status','eq','scheduled').gte('starts_at',new Date().toISOString());
  if(resource==='events'&&eventFilter==='past')q=q.lt('starts_at',new Date().toISOString());
  if(featured)q=q.eq('featured',true);
  if(search)q=q.ilike(resourceInfo[resource].search,'%'+search.replace(/[\\%_]/g,'\\$&')+'%');
  if(category)q=q.filter('category','eq',category);
  q=q.order('featured',{ascending:false});
  if(['members','collaborations','gallery_items'].includes(resource))q=q.order('sort_order');
  else q=q.order(resource==='events'?'starts_at':'published_at',{ascending:resource==='events'&&eventFilter!=='past'});
  const{data,error,count}=await q.order('id').range(page*limit,page*limit+limit-1).abortSignal(signal);if(error)throw error;return{rows:(data??[]) as PublicRecord[],total:count??0};
 },staleTime:30000,retry:1});
}
export function usePublicRecord(resource:Exclude<PublicResource,'gallery_items'>,slug:string){return useQuery({queryKey:['public','detail',resource,slug],queryFn:async({signal})=>{let q=publicClient().from(resource).select('*').eq('published',true).eq('slug',slug);if(resource==='stories')q=q.not('published_at','is',null).lte('published_at',new Date().toISOString());const{data,error}=await q.abortSignal(signal).maybeSingle();if(error)throw error;return data as PublicRecord|null;},staleTime:30000,retry:1});}
export function useSettings(){return useQuery({queryKey:['public','settings'],queryFn:async({signal})=>{const{data,error}=await publicClient().from('site_settings').select('setting_key,value').eq('is_public',true).in('setting_key',['hero_title','hero_description','contact_email','instagram_url','footer_text']).abortSignal(signal);if(error)throw error;return Object.fromEntries((data??[]).filter(r=>typeof r.value==='string'&&r.value.trim()).map(r=>[r.setting_key,r.value as string]));},retry:1,staleTime:60000});}
export function imagePath(record:PublicRecord){return record.profile_image_path||record.cover_image_path||record.logo_path||record.image_path;}
export function dateLabel(value?:string|null){if(!value)return '';return new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',dateStyle:'long',timeStyle:'short'}).format(new Date(value));}
