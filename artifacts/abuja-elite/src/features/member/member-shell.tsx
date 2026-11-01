import type { ReactNode } from "react";
import { Metadata, PublicFooter, PublicNav } from "@/features/public/public-site";
import "./member.css";

/** Same frame as the public pages, but kept out of search engines. */
export function MemberShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="elite-page noise">
      <Metadata title={title} description={description} noindex />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <PublicNav />
      <main id="main-content" className="public-main member-main">{children}</main>
      <PublicFooter />
    </div>
  );
}
