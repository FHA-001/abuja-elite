import {ArrowDownRight,ArrowUpRight} from 'lucide-react';
import {lazy,Suspense,type ReactNode} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Route,Switch,Link,useLocation,Router as WouterRouter} from 'wouter';
import {ErrorBoundary} from '@/components/error-boundary';
import {SectionHeading} from '@/components/section-heading';
import {PublicNav,PublicFooter,Metadata,FeaturedCollection,CollectionPage,DetailPage,AboutPage,ConnectPage,InformationPage,PublicShell} from '@/features/public/public-site';
import {ConnectForm} from '@/features/public/submission-form';
import {useSettings,type PublicResource} from '@/features/public/data';
import logoPath from '@assets/image_1787638883470.png';
const AdminWorkspace=lazy(()=>import('@/features/admin/admin-workspace'));
const ResetPassword=lazy(()=>import('@/features/admin/reset-password'));
const queryClient=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true}}});
function Marquee() {
  const items = ['Abuja / Nigeria', 'The good life, considered', 'Ambition with a point of view', 'Make room at the table'];
  return (
    <div className="marquee" aria-label="Abuja Elite principles">
      <div className="marquee-track">
        {[...items, ...items].map((item, index) => (
          <span key={`${item}-${index}`}><span className="marquee-dot mr-5" aria-hidden="true">/</span>{item}</span>
        ))}
      </div>
    </div>
  );
}

function Home(){const{data:settings}=useSettings();return <div className="elite-page noise min-h-[100dvh]"><Metadata title="Abuja Elite" description="People, stories and shared experiences shaping Abuja. Discover the Abuja Elite community."/><a className="skip-link" href="#main-content">Skip to content</a><PublicNav/><main id="main-content">        <section id="home" className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-orbit" aria-hidden="true" />
          <div className="elite-shell grid w-full gap-16 md:grid-cols-[1.1fr_.9fr] md:items-center">
            <div className="hero-copy">
              <p className="eyebrow reveal mb-7">A public living room for Abuja</p>
              <h1 className="hero-title display-font reveal reveal-delay-1">{settings?.hero_title || <>Live from<br /><em>the top.</em></>}</h1>
              <p className="body-copy reveal reveal-delay-2 mt-8 max-w-[440px]">{settings?.hero_description || 'Abuja Elite is a considered collection of people, places, stories and shared experiences shaping a city with somewhere to go.'}</p>
              <div className="reveal reveal-delay-3 mt-9 flex flex-wrap gap-3">
                <a href="#about" className="gold-button focus-ring" data-testid="button-hero-discover">Discover the movement <ArrowDownRight size={15} /></a>
                <a href="#connect" className="outline-button focus-ring" data-testid="button-hero-connect">Pull up a chair</a>
              </div>
              <div className="mt-16 flex items-center gap-4 text-[#756f62]">
                <span className="h-px w-12 bg-[#d5b264]" />
                <span className="font-mono text-[.62rem] uppercase tracking-[.16em]">09° 04′ N / 07° 29′ E</span>
              </div>
            </div>
            <div className="hero-side" aria-label="Abuja Elite brand mark">
              <div className="hero-mark">
                <img src={logoPath} alt="Abuja Elite — The Elite logo" />
              </div>
            </div>
          </div>
        </section>

        <Marquee />

        <section id="about" className="section">
          <div className="elite-shell">
            <SectionHeading index="01 / 07" kicker="The point of view" title="Not a club. A signal." detail="A place to find the people, perspectives and possibilities that make Abuja feel like home." />
            <div className="grid gap-12 md:grid-cols-[1.1fr_.9fr] md:gap-24">
              <p className="manifesto display-font">The city is not waiting to be discovered. <span>It is already in motion — in the rooms, on the terraces, at the tables and in the ideas worth staying late for.</span></p>
              <div className="md:pt-2">
                <p className="body-copy">We are building a public platform for a private feeling: the spark that happens when ambitious people gather with generosity, taste and intent. Abuja Elite is editorial, social and always in conversation with the city.</p>
                <a href="#community" className="focus-ring mt-9 inline-flex items-center gap-3 border-b border-[#d5b264] pb-2 font-mono text-[.67rem] uppercase tracking-[.14em] text-[#f1e9d4]" data-testid="link-about-community">Meet the community <ArrowUpRight size={14} /></a>
              </div>
            </div>
          </div>
        </section>


{([['community','02 / 08','The people','Room for your next chapter.','members'],['experiences','03 / 08','The calendar','Go where the energy is.','events'],['collaborations','04 / 08','In good company','Better together.','collaborations'],['journey','05 / 08','The journey','A story still being written.','stories'],['gallery','06 / 08','Visual archive','The moments between.','gallery_items']] as const).map(([id,index,kicker,title,resource])=><section id={id} className="section" key={id}><div className="elite-shell"><SectionHeading index={index} kicker={kicker} title={title}/><FeaturedCollection resource={resource}/></div></section>)}
<section id="connect" className="section"><div className="elite-shell"><div className="connect-box connect-layout p-7 sm:p-12"><div><p className="eyebrow">07 / 08 — Connect</p><h2 className="section-title display-font mt-5">Leave the door open.</h2><p className="body-copy mt-7">For membership enquiries, event interest, collaboration ideas or a note from the city — this is the place.</p><p className="mt-7">Abuja, Nigeria</p><a href="https://www.instagram.com/the.elite_ng" target="_blank" rel="noopener noreferrer" className="public-more">@the.elite_ng ↗</a></div><ConnectForm/></div></div></section></main><PublicFooter/></div>;}
function RoutedErrorBoundary({children}:{children:ReactNode}){const[location]=useLocation();return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;}
function Admin({loginOnly=false}:{loginOnly?:boolean}){return <><Metadata title="Editorial desk" description="Abuja Elite administration." noindex/><AdminWorkspace loginOnly={loginOnly}/></>;}
function App(){return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><RoutedErrorBoundary><Suspense fallback={<div className="public-empty" role="status">Opening the page…</div>}><Switch>
<Route path="/" component={Home}/><Route path="/admin/reset-password" component={ResetPassword}/><Route path="/admin/login"><Admin loginOnly/></Route><Route path="/admin"><Admin/></Route><Route path="/about" component={AboutPage}/><Route path="/connect" component={ConnectPage}/><Route path="/privacy"><InformationPage/></Route><Route path="/terms"><InformationPage terms/></Route>
{([['members','members'],['community','members'],['collaborations','collaborations'],['experiences','events'],['stories','stories'],['journey','stories']] as const).flatMap(([route,resource])=>[<Route key={route+'detail'} path={'/'+route+'/:slug'}>{params=><DetailPage resource={resource} slug={String((params as Record<string,unknown>).slug)}/>}</Route>,<Route key={route} path={'/'+route}><CollectionPage key={resource} resource={resource}/></Route>])}
<Route path="/gallery"><CollectionPage resource="gallery_items"/></Route><Route><PublicShell title="Page not found" description="Return to the Abuja Elite website."><Metadata title="Page not found" description="This page is not available." noindex/><div className="elite-shell collection-head"><h1 className="display-font">A different direction.</h1><p className="body-copy mt-6">That page could not be found.</p><Link href="/" className="gold-button mt-7">Back to Abuja Elite</Link></div></PublicShell></Route>
</Switch></Suspense></RoutedErrorBoundary></WouterRouter></QueryClientProvider>;}
export default App;
