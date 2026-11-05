import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Mail, MapPin, MessageCircle, Phone, X } from "lucide-react";
import { useModal } from "@/hooks/use-modal";
import {
  DIRECTORY_PAGE, getDirectoryFilters, searchDirectory, telLink, whatsappLink, type DirectoryMember,
} from "@/lib/supabase/directory";
import { usePublicList } from "@/features/public/data";
import { ContentCard } from "@/features/public/public-site";
import { MemberAvatar } from "./member-avatar";
import { MemberShell } from "./member-shell";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function line(m: DirectoryMember) {
  return [m.profession, m.business_name].filter(Boolean).join(" · ");
}

function ProfileModal({ member, onClose }: { member: DirectoryMember; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useModal(ref, onClose);
  const wa = member.whatsapp ? whatsappLink(member.whatsapp) : null;
  const tel = member.phone ? telLink(member.phone) : null;
  const hasContact = Boolean(wa || tel || member.email);
  const links: Array<[string, string | null]> = [["LinkedIn", member.linkedin_url], ["Instagram", member.instagram_url], ["Website", member.website_url]];
  return (
    <div className="dir-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} className="dir-modal member-card" role="dialog" aria-modal="true" aria-label={`Profile of ${member.full_name}`}>
        <button className="dir-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="dir-modal-head">
          <MemberAvatar path={member.photo_path} name={member.full_name} size="lg" />
          <div>
            <h2 className="display-font">{member.full_name}</h2>
            {line(member) && <p className="dir-line">{line(member)}</p>}
            {member.location && <p className="dir-meta"><MapPin size={14} /> {member.location}</p>}
          </div>
        </div>
        {member.bio && <p className="body-copy dir-bio">{member.bio}</p>}
        {member.skills.length > 0 && (
          <div className="dir-skills" aria-label="Skills">{member.skills.map((s) => <span key={s} className="skill-chip">{s}</span>)}</div>
        )}
        <div className="dir-actions">
          {wa && <a className="gold-button" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
          {tel && <a className="outline-button" href={tel}><Phone size={16} /> Call</a>}
          {member.email && <a className="outline-button" href={`mailto:${member.email}`}><Mail size={16} /> Email</a>}
        </div>
        {!hasContact && <p className="member-hint">{member.full_name.split(" ")[0]} has chosen not to share contact details here.</p>}
        {links.some(([, u]) => u) && (
          <p className="dir-links">
            {links.filter(([, u]) => u).map(([label, u]) => <a key={label} href={u as string} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}
          </p>
        )}
      </aside>
    </div>
  );
}

export default function DirectoryPage() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [skill, setSkill] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<DirectoryMember>();
  const query = useDebounced(search, 300);

  useEffect(() => { setPage(0); }, [query, industry, location, skill]);

  const featured = usePublicList("members", 0, "", "", true, 6);
  const featuredRows = featured.data?.rows ?? [];
  const filters = useQuery({ queryKey: ["directory-filters"], queryFn: getDirectoryFilters, staleTime: 60_000 });
  const results = useQuery({
    queryKey: ["directory", query, industry, location, skill, page],
    queryFn: () => searchDirectory({ query, industry, location, skill, page }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const rows = results.data?.rows ?? [];
  const total = results.data?.total ?? 0;
  const filtered = Boolean(query || industry || location || skill);
  const clear = () => { setSearch(""); setIndustry(""); setLocation(""); setSkill(""); };
  const lastPage = Math.max(0, Math.ceil(total / DIRECTORY_PAGE) - 1);

  return (
    <MemberShell title="Community" description="Find and connect with Abuja Elite members.">
      <section className="elite-shell member-head">
        <p className="eyebrow">Community</p>
        <h1 className="display-font">Find your people.</h1>
        <p className="body-copy">Search by name, business, profession, skill or location. <Link className="dir-self-link" href="/account/profile">Edit my own profile</Link></p>
      </section>

      {!filtered && featuredRows.length > 0 && (
        <section className="elite-shell community-featured" aria-label="Featured profiles">
          <p className="eyebrow">Featured profiles</p>
          <div className="public-grid">
            {featuredRows.map((r) => <ContentCard key={r.id} resource="members" record={r} />)}
          </div>
        </section>
      )}

      <section className="elite-shell dir-section">
        {!filtered && featuredRows.length > 0 && <p className="eyebrow">All members</p>}
        <div className="public-form dir-filters" role="search">
          <label>Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, business, skill…" maxLength={80} /></label>
          <label>Industry
            <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">All industries</option>
              {(filters.data?.industries ?? []).map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label>Location
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {(filters.data?.locations ?? []).map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label>Skill
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Any skill</option>
              {(filters.data?.skills ?? []).map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          {filtered && <button type="button" className="outline-button dir-clear" onClick={clear}>Clear</button>}
        </div>

        {results.isPending ? <p role="status" className="member-hint">Loading members…</p>
          : results.isError ? <p role="alert" className="member-error">The member list could not load. <button className="ae-text-button" onClick={() => results.refetch()}>Try again</button></p>
          : rows.length === 0 ? (
            <div className="public-empty">
              <h3>{filtered ? "No members match that." : "No members to show yet."}</h3>
              <p>{filtered ? "Try a different word or clear the filters." : "Members appear here once they add a profession or business to their profile."}</p>
              {filtered ? <button className="outline-button mt-5" onClick={clear}>Clear filters</button> : <Link className="gold-button mt-5" href="/account/profile">Complete my profile</Link>}
            </div>
          ) : (
            <>
              <p className="member-hint dir-count" role="status">{total} member{total === 1 ? "" : "s"}</p>
              <div className="dir-grid">
                {rows.map((m) => (
                  <button key={m.user_id} className="dir-card member-card" onClick={() => setOpen(m)} aria-label={`Open profile of ${m.full_name}`}>
                    <MemberAvatar path={m.photo_path} name={m.full_name} />
                    <span className="dir-card-text">
                      <strong className="display-font">{m.full_name}</strong>
                      {line(m) && <span className="dir-line">{line(m)}</span>}
                      {m.location && <span className="dir-meta"><MapPin size={13} /> {m.location}</span>}
                      {m.skills.length > 0 && <span className="dir-skills">{m.skills.slice(0, 3).map((s) => <span key={s} className="skill-chip">{s}</span>)}</span>}
                    </span>
                  </button>
                ))}
              </div>
              {total > DIRECTORY_PAGE && (
                <div className="dir-pager">
                  <button className="outline-button" disabled={page === 0 || results.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <span className="member-hint">Page {page + 1} of {lastPage + 1}</span>
                  <button className="outline-button" disabled={page >= lastPage || results.isFetching} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
      </section>

      {open && <ProfileModal member={open} onClose={() => setOpen(undefined)} />}
    </MemberShell>
  );
}
