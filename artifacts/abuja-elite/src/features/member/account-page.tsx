import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { signOut } from "@/lib/supabase/auth";
import {
  daysUntil, formatDate, formatMoney, getMyProfileName, getPaymentSettings, listMyPayments,
  type MyMembership, type MyPayment, type PaymentSettings,
} from "@/lib/supabase/membership";
import { useMemberSession, useMembership } from "@/hooks/use-member";
import { MemberShell } from "./member-shell";
import { ReceiptForm } from "./receipt-form";

function Badge({ tone, children }: { tone: "gold" | "green" | "red" | "muted"; children: ReactNode }) {
  return <span className={`member-badge member-badge-${tone}`}>{children}</span>;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard can be blocked; the number is still on screen */ }
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function isConfigured(s: PaymentSettings | null | undefined): s is PaymentSettings {
  return Boolean(s && s.monthly_fee_amount > 0 && s.bank_name && s.account_number);
}

function PaymentDetails({ settings, first }: { settings: PaymentSettings | null | undefined; first: boolean }) {
  if (!isConfigured(settings)) {
    return (
      <aside className={`member-card pay-card${first ? " pay-card-first" : ""}`} aria-label="Payment details">
        <p className="eyebrow">How to pay</p>
        <h2 className="display-font">Details coming soon.</h2>
        <p className="member-hint">The bank details are being set up. Please check back shortly.</p>
      </aside>
    );
  }
  return (
    <aside className={`member-card pay-card${first ? " pay-card-first" : ""}`} aria-label="Payment details">
      <p className="eyebrow">How to pay</p>
      <h2 className="display-font">{formatMoney(settings.monthly_fee_amount, settings.currency)}<small> / month</small></h2>
      <dl className="pay-list">
        <div><dt>Bank</dt><dd>{settings.bank_name}</dd></div>
        {settings.account_name && <div><dt>Account name</dt><dd>{settings.account_name}</dd></div>}
        <div>
          <dt>Account number</dt>
          <dd className="pay-number">
            <span>{settings.account_number}</span>
            <CopyButton value={settings.account_number ?? ""} label="account number" />
          </dd>
        </div>
      </dl>
      {settings.payment_instructions && <p className="member-hint pay-notes">{settings.payment_instructions}</p>}
    </aside>
  );
}

function statusCopy(m: MyMembership, pending: MyPayment | undefined, rejected: MyPayment | undefined) {
  const until = formatDate(m.accessExpiresAt);
  switch (m.state) {
    case "active": {
      const left = daysUntil(m.accessExpiresAt);
      return { tone: "green" as const, badge: "Active", title: "Your membership is active.",
        body: `Active until ${until}${left !== null && left >= 0 ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""}.` };
    }
    case "grace":
      return { tone: "gold" as const, badge: "Renew now", title: "Renew to keep your access.",
        body: `Your membership ended on ${until}. You keep access until ${formatDate(m.graceEndsAt, true)}.` };
    case "expired":
      return { tone: "red" as const, badge: "Expired", title: "Your membership has expired.",
        body: `It ended on ${until}. Renew to open the members-only pages again.` };
    case "suspended":
      return { tone: "red" as const, badge: "On hold", title: "Your account is on hold.",
        body: "Please get in touch with us so we can help." };
    default:
      if (pending) {
        return { tone: "gold" as const, badge: "In review", title: "Your receipt is being reviewed.",
          body: `Submitted ${formatDate(pending.created_at, true)}. This page updates once it has been reviewed.` };
      }
      if (rejected) {
        return { tone: "red" as const, badge: "Not approved", title: "Your last receipt was not approved.",
          body: rejected.admin_comment ? `Reason: ${rejected.admin_comment}` : "Please upload a new receipt." };
      }
      return { tone: "muted" as const, badge: "Not active yet", title: "Complete your membership.",
        body: "Pay the monthly fee, upload your receipt, and we will open your access once it is approved." };
  }
}

export default function AccountPage() {
  const session = useMemberSession();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const user = session.user;
  const [renewOpen, setRenewOpen] = useState(false);

  useEffect(() => {
    if (!session.loading && !user) navigate("/login?next=/account", { replace: true });
  }, [session.loading, user, navigate]);

  const membership = useMembership(user?.id);
  const settings = useQuery({ queryKey: ["payment-settings"], queryFn: getPaymentSettings, enabled: Boolean(user), staleTime: 60_000 });
  const payments = useQuery({ queryKey: ["payments", user?.id], queryFn: () => listMyPayments(user!.id), enabled: Boolean(user) });
  const profileName = useQuery({ queryKey: ["profile-name", user?.id], queryFn: () => getMyProfileName(user!.id), enabled: Boolean(user), staleTime: 300_000 });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["payments", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["membership", user?.id] });
  }

  async function logOut() {
    await signOut();
    queryClient.clear();
    navigate("/", { replace: true });
  }

  if (session.loading || !user) {
    return (
      <MemberShell title="Your account" description="Your Abuja Elite membership.">
        <section className="elite-shell member-head"><p role="status" className="member-hint">Loading your account…</p></section>
      </MemberShell>
    );
  }

  const m = membership.data;
  const list = payments.data ?? [];
  const pending = list.find((p) => p.status === "pending");
  const rejected = list[0]?.status === "rejected" ? list[0] : undefined;
  const display = profileName.data || (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "member";
  const firstName = display.trim().split(/\s+/)[0];
  const copy = m ? statusCopy(m, pending, rejected) : null;
  const left = m ? daysUntil(m.accessExpiresAt) : null;
  const canPay = Boolean(m) && m!.state !== "suspended" && !pending && isConfigured(settings.data);
  const isActive = m?.state === "active";
  const showRenew = isActive && (renewOpen || (left !== null && left <= 7));

  return (
    <MemberShell title="Your account" description="Your Abuja Elite membership.">
      <section className="elite-shell member-head">
        <p className="eyebrow">Your membership</p>
        <h1 className="display-font">Hello, {firstName}.</h1>
      </section>

      <section className="elite-shell member-grid">
        <div className="member-stack">
          {membership.isError && (
            <div className="member-card" role="alert">
              <p className="member-error">We could not load your membership.</p>
              <button className="outline-button mt-4" onClick={() => membership.refetch()}>Try again</button>
            </div>
          )}

          {copy && (
            <div className="member-card member-status">
              <Badge tone={copy.tone}>{copy.badge}</Badge>
              <h2 className="display-font">{copy.title}</h2>
              <p className="body-copy">{copy.body}</p>
              {m?.state === "suspended" && <Link className="outline-button mt-5" href="/connect">Contact us</Link>}
              {m?.hasAccess && (
                <div className="member-links" aria-label="Members-only pages">
                  <Link href="/members">Community</Link>
                  <Link href="/experiences">Experiences</Link>
                  <Link href="/collaborations">Collaborations</Link>
                  <Link href="/stories">Stories</Link>
                </div>
              )}
              {m?.isAdmin && <Link className="member-admin-link" href="/admin">Open the editorial desk →</Link>}
            </div>
          )}

          {m && m.state !== "suspended" && !pending && (
            <div className="member-card">
              {m.state === "pending" && (
                <ol className="member-steps">
                  <li><strong>Pay</strong> the monthly fee into the account shown on this page.</li>
                  <li><strong>Upload</strong> your receipt below.</li>
                  <li><strong>Wait</strong> for approval. Your access opens as soon as it is approved.</li>
                </ol>
              )}
              {(m.state === "pending" || m.state === "grace" || m.state === "expired") && (
                <>
                  <h2 className="display-font">{m.state === "pending" ? "Upload your receipt" : "Renew your membership"}</h2>
                  {canPay
                    ? <ReceiptForm userId={user.id} submitLabel={m.state === "pending" ? "Submit receipt" : "Submit renewal receipt"} onSubmitted={refreshAll} />
                    : <p className="member-hint">Uploads open once the payment details are ready.</p>}
                </>
              )}
              {isActive && (
                <>
                  <h2 className="display-font">Renew early</h2>
                  <p className="body-copy">Renewing before your membership ends adds a full month on top of your current end date, so you lose no days.</p>
                  {!showRenew
                    ? <button className="outline-button mt-4" onClick={() => setRenewOpen(true)}>Renew now</button>
                    : canPay
                      ? <ReceiptForm userId={user.id} submitLabel="Submit renewal receipt" onSubmitted={() => { setRenewOpen(false); refreshAll(); }} />
                      : <p className="member-hint">Uploads open once the payment details are ready.</p>}
                </>
              )}
            </div>
          )}

          {list.length > 0 && (
            <div className="member-card">
              <h2 className="display-font">Payment history</h2>
              <ul className="history-list">
                {list.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{formatDate(p.created_at)}</strong>
                      <span className="member-hint">{formatMoney(p.fee_amount, p.currency)}</span>
                      {p.status === "approved" && p.period_end && <span className="member-hint">Covers you until {formatDate(p.period_end)}</span>}
                      {p.status === "rejected" && p.admin_comment && <span className="member-hint">Reason: {p.admin_comment}</span>}
                    </div>
                    <Badge tone={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "gold"}>
                      {p.status === "approved" ? "Approved" : p.status === "rejected" ? "Not approved" : "In review"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="member-account-row">
            <span className="member-hint">Signed in as {user.email}</span>
            <button className="outline-button" onClick={logOut}>Log out</button>
          </div>
        </div>

        <PaymentDetails settings={settings.data} first={Boolean(m) && m!.state !== "active" && m!.state !== "suspended" && !pending} />
      </section>
    </MemberShell>
  );
}
