import { z } from 'zod';
const optionalText = z.string().trim().max(10000).nullable().optional();
const url = z.string().trim().url().refine(v => /^https?:\/\//i.test(v),'Use an http or https URL.').nullable().optional();
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Use lowercase words separated by hyphens.').max(180);
const path = z.string().max(500).refine(v => !v.includes('..') && !v.startsWith('/') && !v.includes('://'),'Choose an uploaded image.').nullable().optional();
const flags = {published:z.boolean().default(false),featured:z.boolean().default(false)};
const order = {sort_order:z.number().int().min(-100000).max(100000).default(0)};
const base = {slug,...flags};
const stamp = z.string().datetime({offset:true}).nullable().optional();
const schemas = {
 members:z.object({...base,...order,name:z.string().trim().min(1).max(160),bio:optionalText,role:optionalText,category:optionalText,location:optionalText,profile_image_path:path,instagram_url:url,website_url:url}),
 collaborations:z.object({...base,...order,name:z.string().trim().min(1).max(160),description:optionalText,category:optionalText,logo_path:path,cover_image_path:path,instagram_url:url,website_url:url}),
 events:z.object({...base,title:z.string().trim().min(1).max(200),description:optionalText,starts_at:z.string().datetime({offset:true}),ends_at:stamp,location:optionalText,cover_image_path:path,registration_url:url,status:z.enum(['scheduled','cancelled'])}).refine(v=>!v.ends_at||Date.parse(v.ends_at)>=Date.parse(v.starts_at),'End time must follow start time.'),
 stories:z.object({...base,title:z.string().trim().min(1).max(220),excerpt:optionalText,content:z.string().trim().min(1).max(100000),cover_image_path:path,category:optionalText,author_name:optionalText,published_at:stamp}).refine(v=>!v.published||!!v.published_at,'Set a publication time before publishing.'),
 gallery_items:z.object({...base,...order,slug:z.undefined().optional(),image_path:path.refine(v=>Boolean(v),'Choose an uploaded image.'),thumbnail_path:path,caption:optionalText,alt_text:z.string().trim().min(1).max(300),category:optionalText,event_id:z.string().uuid().nullable().optional(),story_id:z.string().uuid().nullable().optional(),collaboration_id:z.string().uuid().nullable().optional()}),
 site_settings:z.object({setting_key:z.string().trim().min(1).max(120),value:z.unknown(),is_public:z.boolean().default(false)})
};
export type ContentResource=keyof typeof schemas;
export function validateContent(resource:ContentResource,payload:Record<string,unknown>) {
 const result=schemas[resource].safeParse(payload);
 if(!result.success) throw new Error(result.error.issues.map(i=>`${i.path.join('.')||'Record'}: ${i.message}`).join('\n'));
 return result.data;
}
export function safeExternalUrl(value:unknown):string|undefined {
 if(typeof value!=='string')return undefined;
 try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:undefined;}catch{return undefined;}
}
export function toLagosInput(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'':new Date(d.getTime()+3600000).toISOString().slice(0,16);}
export function fromLagosInput(value:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Choose a valid date and time.');const d=new Date(value+':00+01:00');if(Number.isNaN(d.getTime()))throw new Error('Choose a valid date and time.');return d.toISOString();}
