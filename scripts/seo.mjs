// Runs after Vite. No invented production domain or content is emitted.
import {loadEnv} from '../artifacts/abuja-elite/node_modules/vite/dist/node/index.js';
import {writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const project=resolve('artifacts/abuja-elite'),out=resolve(project,'dist/public');
const env={...loadEnv('production',project,'VITE_'),...process.env};
const origin=env.VITE_SITE_URL?.trim().replace(/\/$/,'');
if(!origin){await writeFile(resolve(out,'robots.txt'),'User-agent: *\nDisallow: /admin\n');console.log('SEO: set VITE_SITE_URL to generate canonical URLs and a sitemap.');process.exit(0);}
const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash)throw new Error('VITE_SITE_URL must be a full HTTPS origin with no path.');
const xml=v=>v.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const paths=['/','/about','/members','/experiences','/collaborations','/stories','/gallery','/connect','/privacy','/terms'];
if(env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_PUBLISHABLE_KEY){
 for(const[table,route]of [['members','members'],['events','experiences'],['collaborations','collaborations'],['stories','stories']]){
  let offset=0;while(true){const endpoint=new URL(env.VITE_SUPABASE_URL+'/rest/v1/'+table);endpoint.search=new URLSearchParams({select:'slug',published:'eq.true',order:'id',limit:'500',offset:String(offset),...(table==='stories'?{published_at:'lte.'+new Date().toISOString()}:{} )}).toString();const response=await fetch(endpoint,{headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`Cannot generate sitemap from ${table}: ${response.status}`);const rows=await response.json();for(const row of rows)if(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug))paths.push('/'+route+'/'+row.slug);if(rows.length<500)break;offset+=500;if(offset>100000)throw new Error('Sitemap exceeds expected size; split it before publishing.');}
 }
}
await writeFile(resolve(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>`<url><loc>${xml(origin+path)}</loc></url>`).join('')+'</urlset>\n');
await writeFile(resolve(out,'robots.txt'),`User-agent: *\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`);
let html=await readFile(resolve(out,'index.html'),'utf8');html=html.replace('</head>',`<meta property="og:image" content="${xml(origin)}/favicon.png"/><meta property="og:url" content="${xml(origin)}/"/></head>`);await writeFile(resolve(out,'index.html'),html);console.log(`SEO: sitemap generated with ${paths.length} public routes.`);
