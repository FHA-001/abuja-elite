import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useMemberSession } from "@/hooks/use-member";
import {
  cancelEventRegistration, formatDate, formatMoney, getMyRegistration, getPaymentSettings,
  registerForEvent, submitEventReceipt,
} from "@/lib/supabase/membership";
import { ReceiptForm } from "./receipt-form";

type EventLike = { id: string; title?: string; starts_at?: string; ends_at?: string | null; status?: string; price_amount?: number | null };

/** Sign-up box on an event page: free = one tap, paid = bank transfer + receipt. */
export function EventSignup({ event }: { event: EventLike }) {
  const session = useMemberSession();
  const user = session.user;
  const queryClient = useQueryClient();
  const price = Number(event.price_amount ?? 0);
  const isPaid = price > 0;
  const over = !event.starts_at || Date.parse(event.ends_at || event.starts_at) < Date.now();
  const cancelled = event.status === "cancelled";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const reg = useQuery({
    queryKey: ["event-reg", event.id, user?.id],
    queryFn: () => getMyRegistration(event.id, user!.id),
    enabled: Boolean(user) && !over && !cancelled,
    retry: 1,
  });
  const settings = useQuery({ queryKey: ["payment-settings"], queryFn: getPaymentSettings, enabled: Boolean(user) && isPaid && !over, staleTime: 60_000 });

  if (over || cancelled || !user) return null;

  const status = reg.data?.status;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["event-reg", event.id, user.id] });
    void queryClient.invalidateQueries({ queryKey: ["dash-regs"] });
  };

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const s = settings.data;
  const bankReady = Boolean(s && s.bank_name && s.account_number);

  return (
    <section className="member-card event-signup" aria-label="Sign up for this event">
      <div className="event-signup-head">
        <p className="eyebrow">Sign up</p>
        <span className={`member-badge ${isPaid ? "member-badge-gold" : "member-badge-green"}`}>{isPaid ? formatMoney(price, s?.currency ?? "NGN") : "Free"}</span>
      </div>

      {reg.isPending ? <p role="status" className="member-hint">Checking your sign-up…</p>
        : reg.isError ? <p role="alert" className="member-error">We could not check your sign-up. <button className="ae-text-button" onClick={() => reg.refetch()}>Try again</button></p>
        : status === "going" || status === "approved" ? (
          <>
            <h2 className="display-font"><Check size={22} className="event-check" aria-hidden="true" /> You are registered.</h2>
            <p className="body-copy">{status === "approved" ? "Your payment was approved. We look forward to seeing you." : "We have saved your spot. We look forward to seeing you."}</p>
            {status === "going" && <button className="outline-button" disabled={busy} onClick={() => run(() => cancelEventRegistration(event.id))}>{busy ? "Working…" : "Cancel my spot"}</button>}
            {status === "approved" && <p className="member-hint">To cancel a paid sign-up, please contact us.</p>}
          </>
        ) : status === "pending" ? (
          <>
            <h2 className="display-font">Your receipt is being reviewed.</h2>
            <p className="body-copy">We will confirm your spot as soon as the payment is approved. This page updates by itself.</p>
            <button className="outline-button" disabled={busy} onClick={() => run(() => cancelEventRegistration(event.id))}>{busy ? "Working…" : "Withdraw my sign-up"}</button>
          </>
        ) : !isPaid ? (
          <>
            <h2 className="display-font">Save your spot.</h2>
            <p className="body-copy">This event is free for members. One tap and you are on the list.</p>
            <button className="gold-button" disabled={busy} onClick={() => run(() => registerForEvent(event.id))}>{busy ? "Registering…" : "Register"}</button>
          </>
        ) : (
          <>
            {status === "rejected" && (
              <p className="member-error" role="alert">Your last receipt was not approved{reg.data?.admin_comment ? `: ${reg.data.admin_comment.replace(/[.!?\s]+$/, "")}.` : "."} Please upload a new one.</p>
            )}
            <h2 className="display-font">{status === "rejected" ? "Try again." : "Pay and register."}</h2>
            {bankReady ? (
              <>
                <p className="body-copy">Transfer {formatMoney(price, s!.currency)} to the account below, then upload your receipt. We will confirm your spot once it is approved.</p>
                <dl className="pay-list event-pay">
                  <div><dt>Bank</dt><dd>{s!.bank_name}</dd></div>
                  {s!.account_name && <div><dt>Account name</dt><dd>{s!.account_name}</dd></div>}
                  <div>
                    <dt>Account number</dt>
                    <dd className="pay-number">
                      <span>{s!.account_number}</span>
                      <button type="button" className="copy-btn" aria-label="Copy account number" onClick={async () => {
                        try { await navigator.clipboard.writeText(s!.account_number ?? ""); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* number is on screen */ }
                      }}>{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? "Copied" : "Copy"}</span></button>
                    </dd>
                  </div>
                </dl>
                <ReceiptForm userId={user.id} submitLabel="Submit receipt" submit={(file, note) => submitEventReceipt(event.id, user.id, file, note)} onSubmitted={refresh} />
              </>
            ) : <p className="member-hint">Payment details are being set up. Please check back shortly.</p>}
          </>
        )}

      {error && <p className="member-error" role="alert">{error}</p>}
      {status === "cancelled" && !isPaid && <p className="member-hint">You cancelled earlier. You can register again any time.</p>}
      <p className="member-hint event-date-note">{event.starts_at ? `Starts ${formatDate(event.starts_at, true)}` : ""}</p>
    </section>
  );
}
