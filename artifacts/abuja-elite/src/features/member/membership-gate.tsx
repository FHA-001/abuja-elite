import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMemberAccess } from "@/hooks/use-member";
import { usePublicList, type PublicResource } from "@/features/public/data";
import { ContentCard } from "@/features/public/public-site";
import { MemberShell } from "./member-shell";

type GatedResource = Exclude<PublicResource, "gallery_items">;

const SECTION: Record<GatedResource, string> = {
  members: "the community",
  collaborations: "collaborations",
  events: "experiences",
  stories: "stories",
};

/** A small glimpse of featured items, so visitors can see what is behind the door. */
function Previews({ resource }: { resource: GatedResource }) {
  const q = usePublicList(resource, 0, "", "", true, 3);
  const rows = q.data?.rows ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="gate-previews">
      <p className="eyebrow">A glimpse inside</p>
      <div className="public-grid">
        {rows.map((r) => <ContentCard key={r.id} resource={resource} record={r} />)}
      </div>
    </div>
  );
}

/** Wrap a members-only page. Members (and admins) see the page; everyone else sees this. */
export function MembershipGate({ resource, label, children }: { resource?: GatedResource; label?: string; children: ReactNode }) {
  const access = useMemberAccess();
  const [location] = useLocation();
  const name = label ?? (resource ? SECTION[resource] : "this area");
  const shown = name.charAt(0).toUpperCase() + name.slice(1);

  if (access.hasAccess) return <>{children}</>;

  if (access.loading) {
    return (
      <MemberShell title={shown} description="Members-only section of Abuja Elite.">
        <section className="elite-shell member-head">
          <p role="status" className="member-hint">Checking your membership…</p>
        </section>
      </MemberShell>
    );
  }

  const state = access.membership?.state;
  let eyebrow = `Members only · ${shown}`;
  let title = "This part of Abuja Elite is for members.";
  let body = "Create an account and complete your membership to unlock this part of Abuja Elite.";
  let actions = (
    <>
      <Link className="gold-button" href="/join">Join Abuja Elite</Link>
      <Link className="outline-button" href={`/login?next=${encodeURIComponent(location)}`}>Log in</Link>
    </>
  );

  if (access.failed) {
    title = "We could not check your membership.";
    body = "Please check your connection and try again.";
    actions = <button className="gold-button" onClick={access.retry}>Try again</button>;
  } else if (access.signedIn && state === "expired") {
    eyebrow = "Membership expired";
    title = "Renew to come back inside.";
    body = "Your membership has ended. Submit a new receipt and your access opens again once it is approved.";
    actions = <Link className="gold-button" href="/account">Renew my membership</Link>;
  } else if (access.signedIn && state === "suspended") {
    eyebrow = "Account on hold";
    title = "Your account is on hold.";
    body = "Please get in touch with us so we can help.";
    actions = <Link className="gold-button" href="/connect">Contact us</Link>;
  } else if (access.signedIn) {
    eyebrow = "Membership required";
    title = `Finish your membership to unlock ${name}.`;
    body = "Pay the monthly fee and upload your receipt. Your access opens as soon as it is approved.";
    actions = <Link className="gold-button" href="/account">Complete my membership</Link>;
  }

  return (
    <MemberShell title={shown} description="Members-only section of Abuja Elite.">
      <section className="elite-shell member-gate">
        <div className="member-card member-gate-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-font">{title}</h1>
          <p className="body-copy">{body}</p>
          <div className="member-gate-actions">{actions}</div>
        </div>
        {resource && <Previews resource={resource} />}
      </section>
    </MemberShell>
  );
}
