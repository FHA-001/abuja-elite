import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDate, formatMoney, listMyRegistrations } from "@/lib/supabase/membership";
import { listAnnouncements, listNewMembers, listOpportunities, listUpcomingEvents } from "@/lib/supabase/dashboard";
import { MemberAvatar } from "./member-avatar";

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="member-card dash-block">
      <div className="dash-block-head">
        <h2 className="display-font">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Status({ pending, error, empty, onRetry }: { pending: boolean; error: boolean; empty: string | null; onRetry: () => void }) {
  if (pending) return <p role="status" className="member-hint">Loading…</p>;
  if (error) return <p role="alert" className="member-error">Could not load this just now. <button className="ae-text-button" onClick={onRetry}>Try again</button></p>;
  if (empty) return <p className="member-hint">{empty}</p>;
  return null;
}

/** What a paid member sees on their account page: news, events and people. */
export function MemberDashboard({ userId }: { userId: string }) {
  const [allNews, setAllNews] = useState(false);
  const news = useQuery({ queryKey: ["dash-announcements", userId], queryFn: listAnnouncements, staleTime: 30_000, retry: 1 });
  const events = useQuery({ queryKey: ["dash-events", userId], queryFn: listUpcomingEvents, staleTime: 60_000, retry: 1 });
  const regs = useQuery({ queryKey: ["dash-regs", userId], queryFn: () => listMyRegistrations(userId), staleTime: 30_000, retry: 1 });
  const people = useQuery({ queryKey: ["dash-people", userId], queryFn: listNewMembers, staleTime: 60_000, retry: 1 });
  const opps = useQuery({ queryKey: ["dash-opps", userId], queryFn: listOpportunities, staleTime: 60_000, retry: 1 });

  const items = news.data ?? [];
  const visible = allNews ? items : items.slice(0, 3);

  return (
    <>
      <Block title="Announcements">
        <Status pending={news.isPending} error={news.isError} empty={!news.isPending && !news.isError && items.length === 0 ? "No announcements right now." : null} onRetry={() => news.refetch()} />
        {visible.length > 0 && (
          <ul className="dash-news">
            {visible.map((a) => (
              <li key={a.id}>
                <div className="dash-news-head">
                  <strong>{a.title}</strong>
                  {a.pinned && <span className="member-badge member-badge-gold">Pinned</span>}
                </div>
                <span className="member-hint">{formatDate(a.published_at)}</span>
                <p className="dash-news-body">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
        {items.length > 3 && (
          <button className="ae-text-button dash-more" onClick={() => setAllNews((v) => !v)}>
            {allNews ? "Show fewer" : `Show all ${items.length}`}
          </button>
        )}
      </Block>

      <Block title="Upcoming events" action={<Link className="dash-link" href="/experiences">All events →</Link>}>
        <Status pending={events.isPending} error={events.isError} empty={!events.isPending && !events.isError && (events.data?.length ?? 0) === 0 ? "No events are scheduled yet. Check back soon." : null} onRetry={() => events.refetch()} />
        {(events.data?.length ?? 0) > 0 && (
          <ul className="dash-events">
            {events.data!.map((e) => (
              <li key={e.id}>
                <Link href={`/experiences/${e.slug}`}>
                  <span className="dash-event-date"><CalendarDays size={16} aria-hidden="true" />{formatDate(e.starts_at, true)}</span>
                  <strong>{e.title}</strong>
                  <span className="dash-event-tags">
                    <span className={`member-badge ${e.price_amount > 0 ? "member-badge-gold" : "member-badge-green"}`}>{e.price_amount > 0 ? formatMoney(e.price_amount, "NGN") : "Free"}</span>
                    {(regs.data?.[e.id] === "going" || regs.data?.[e.id] === "approved") && <span className="member-badge member-badge-green">You are going</span>}
                    {regs.data?.[e.id] === "pending" && <span className="member-badge member-badge-gold">Payment in review</span>}
                  </span>
                  {e.location && <span className="dir-meta"><MapPin size={13} aria-hidden="true" /> {e.location}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="New in the community" action={<Link className="dash-link" href="/members">Meet everyone →</Link>}>
        <Status pending={people.isPending} error={people.isError} empty={!people.isPending && !people.isError && (people.data?.length ?? 0) === 0 ? "New members will appear here as they complete their profiles." : null} onRetry={() => people.refetch()} />
        {(people.data?.length ?? 0) > 0 && (
          <ul className="dash-people">
            {people.data!.map((m) => (
              <li key={m.user_id}>
                <Link href="/members" aria-label={`${m.full_name}, ${[m.profession, m.business_name].filter(Boolean).join(", ")}`}>
                  <MemberAvatar path={m.photo_path} name={m.full_name} />
                  <span><strong>{m.full_name}</strong><small>{[m.profession, m.business_name].filter(Boolean).join(" · ")}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Collaboration opportunities" action={<Link className="dash-link" href="/collaborations">See all →</Link>}>
        <Status pending={opps.isPending} error={opps.isError} empty={!opps.isPending && !opps.isError && (opps.data?.length ?? 0) === 0 ? "No opportunities posted yet." : null} onRetry={() => opps.refetch()} />
        {(opps.data?.length ?? 0) > 0 && (
          <ul className="dash-opps">
            {opps.data!.map((o) => (
              <li key={o.id}>
                <Link href={`/collaborations/${o.slug}`}><strong>{o.name}</strong>{o.category && <small>{o.category}</small>}</Link>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}
