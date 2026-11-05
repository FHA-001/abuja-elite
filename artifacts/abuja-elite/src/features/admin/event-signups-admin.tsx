import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useModal } from "@/hooks/use-modal";
import { formatDate, formatMoney } from "@/lib/supabase/membership";

type Status = "going" | "pending" | "approved" | "rejected" | "cancelled";
type Row = {
  id: string; event_id: string; user_id: string; status: Status; receipt_path: string | null;
  member_note: string | null; fee_amount: number; admin_comment: string | null; created_at: string; reviewed_at: string | null;
};
type Person = { user_id: string; full_name: string; email: string; phone: string | null };
type EventLite = { id: string; title: string; starts_at: string };

const COLUMNS = "id,event_id,user_id,status,receipt_path,member_note,fee_amount,admin_comment,created_at,reviewed_at";
type Filter = "pending" | "going" | "rejected" | "all";
const FILTERS: Array<[Filter, string]> = [["pending", "Waiting"], ["going", "Registered"], ["rejected", "Not approved"], ["all", "All"]];
const LABEL: Record<Status, string> = { going: "Going", pending: "Waiting", approved: "Approved", rejected: "Not approved", cancelled: "Cancelled" };
const TONE: Record<Status, "green" | "gold" | "red" | "muted"> = { going: "green", pending: "gold", approved: "green", rejected: "red", cancelled: "muted" };

function friendly(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (text.includes("signup_already_reviewed")) return "Someone has already reviewed this sign-up. Refresh the list.";
  if (text.includes("comment_required")) return "Write a short reason (at least 3 letters) so the member knows what to fix.";
  if (text.includes("forbidden")) return "Your account is not allowed to do this.";
  return "The request failed. Please check your connection and try again.";
}

export function EventSignupsPanel({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [eventId, setEventId] = useState("");
  const [selected, setSelected] = useState<{ row: Row; person?: Person; event?: EventLite }>();

  const events = useQuery({
    queryKey: ["admin", userId, "signup-events"],
    retry: 1,
    queryFn: async (): Promise<EventLite[]> => {
      const { data, error } = await getSupabaseClient().from("events").select("id,title,starts_at").order("starts_at", { ascending: false }).limit(100);
      if (error) throw new Error("Events could not load.");
      return data ?? [];
    },
  });

  const list = useQuery({
    queryKey: ["admin", userId, "event-signups", filter, eventId],
    refetchInterval: 30_000,
    retry: 1,
    queryFn: async () => {
      const client = getSupabaseClient();
      let q = client.from("event_registrations").select(COLUMNS).order("created_at", { ascending: filter === "pending" }).limit(200);
      if (filter === "going") q = q.in("status", ["going", "approved"]);
      else if (filter !== "all") q = q.eq("status", filter);
      if (eventId) q = q.eq("event_id", eventId);
      const { data, error } = await q;
      if (error) throw new Error("Sign-ups could not load.");
      const rows = (data ?? []) as Row[];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const people = new Map<string, Person>();
      if (ids.length) {
        const p = await client.from("profiles").select("user_id,full_name,email,phone").in("user_id", ids);
        (p.data ?? []).forEach((x) => people.set(x.user_id, x as Person));
      }
      return { rows, people };
    },
  });

  const rows = list.data?.rows ?? [];
  const eventById = new Map((events.data ?? []).map((e) => [e.id, e]));

  return (
    <>
      <div className="ae-section-heading">
        <div>
          <p className="ae-kicker">Membership</p>
          <h1 className="ae-page-title mt-3">Event sign-ups</h1>
        </div>
      </div>
      <p className="body-copy mb-6">Free events confirm on their own. For paid events, open the receipt and approve it to confirm the member’s spot. Set a ticket price on an event to make it paid.</p>

      <label className="ae-field mb-4">Event
        <select className="ae-input ae-field-input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">All events</option>
          {(events.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.title} · {formatDate(e.starts_at)}</option>)}
        </select>
      </label>
      <div className="ae-tabs" role="group" aria-label="Filter sign-ups">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`ae-tab ${filter === id ? "ae-tab-active" : ""}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {list.isPending ? <p role="status">Loading sign-ups…</p>
        : list.isError ? <p role="alert">Could not load sign-ups. <button className="ae-text-button" onClick={() => list.refetch()}>Retry</button></p>
        : rows.length === 0 ? <div className="ae-empty">{filter === "pending" ? "No paid sign-ups are waiting." : "Nothing here yet."}</div>
        : (
          <div className="ae-inbox-list">
            {rows.map((r) => {
              const person = list.data?.people.get(r.user_id);
              const ev = eventById.get(r.event_id);
              return (
                <button key={r.id} className="ae-inbox-row" onClick={() => setSelected({ row: r, person, event: ev })}>
                  <strong>{person?.full_name ?? "Unknown member"}</strong>
                  <span><span className={`ae-badge ae-badge-${TONE[r.status]}`}>{LABEL[r.status]}</span></span>
                  <small>{ev?.title ?? "Event"} · {r.fee_amount > 0 ? formatMoney(r.fee_amount, "NGN") : "Free"} · {formatDate(r.created_at, true)}</small>
                </button>
              );
            })}
          </div>
        )}
      <p className="ae-hint mt-4">{rows.length} shown (most recent 200)</p>

      {selected && <SignupDrawer userId={userId} {...selected} onClose={() => setSelected(undefined)} />}
    </>
  );
}

function SignupDrawer({ userId, row, person, event, onClose }: { userId: string; row: Row; person?: Person; event?: EventLite; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useModal(ref, onClose);
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const isPdf = row.receipt_path ? /\.pdf$/i.test(row.receipt_path) : false;

  const receipt = useQuery({
    queryKey: ["admin", userId, "event-receipt", row.receipt_path],
    enabled: Boolean(row.receipt_path),
    staleTime: 240_000,
    retry: 1,
    queryFn: async () => {
      const { data, error: e } = await getSupabaseClient().storage.from("payment-receipts").createSignedUrl(row.receipt_path as string, 600);
      if (e || !data) throw new Error("The receipt file could not be opened.");
      return data.signedUrl;
    },
  });

  async function decide(approve: boolean) {
    if (busy) return;
    if (approve && !window.confirm(`Approve ${person?.full_name ?? "this member"}’s payment for ${event?.title ?? "this event"}?`)) return;
    if (!approve && comment.trim().length < 3) { setError(friendly("comment_required")); return; }
    setBusy(true);
    setError("");
    try {
      const { error: e } = await getSupabaseClient().rpc("admin_review_event_signup", {
        p_registration_id: row.id, p_approve: approve, p_comment: approve ? null : comment.trim(),
      });
      if (e) throw e;
      setResult(approve ? "Approved. The member has been told their spot is confirmed." : "Sent back. The member can see your reason and upload a new receipt.");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", userId] });
    }
  }

  return (
    <div className="ae-drawer-backdrop">
      <aside ref={ref} className="ae-drawer" role="dialog" aria-modal="true" aria-label="Review event sign-up">
        <div className="ae-drawer-head">
          <h2>Event sign-up</h2>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="ae-drawer-body">
          <p className="ae-review-summary">
            <strong>{person?.full_name ?? "Unknown member"}</strong>
            <span>{row.fee_amount > 0 ? formatMoney(row.fee_amount, "NGN") : "Free"} · {formatDate(row.created_at, true)}</span>
          </p>
          <p className="ae-hint">{event?.title ?? "Event"}{event ? ` · ${formatDate(event.starts_at, true)}` : ""}</p>

          {row.receipt_path && (
            <div className="ae-receipt-box">
              <p className="ae-field-label">Receipt</p>
              {receipt.isPending ? <p role="status">Opening the receipt…</p>
                : receipt.isError ? <p role="alert">{receipt.error.message} <button className="ae-text-button" onClick={() => receipt.refetch()}>Retry</button></p>
                : isPdf ? <a className="outline-button" href={receipt.data} target="_blank" rel="noopener noreferrer">Open the PDF receipt ↗</a>
                : <a href={receipt.data} target="_blank" rel="noopener noreferrer"><img className="ae-receipt-image" src={receipt.data} alt="Payment receipt uploaded by the member" /></a>}
            </div>
          )}

          {result && <div className="ae-status-line mt-6" role="status">{result}</div>}

          <dl className="ae-detail-fields mt-6">
            <div><dt>Status</dt><dd>{LABEL[row.status]}</dd></div>
            {person?.email && <div><dt>Email</dt><dd>{person.email}</dd></div>}
            {person?.phone && <div><dt>Phone</dt><dd>{person.phone}</dd></div>}
            {row.member_note && <div><dt>Note from member</dt><dd>{row.member_note}</dd></div>}
            {row.admin_comment && <div><dt>Reason given</dt><dd>{row.admin_comment}</dd></div>}
          </dl>
        </div>
        {!result && row.status === "pending" && (
          <div className="ae-drawer-foot ae-review-foot">
            {error && <p className="ae-inline-error" role="alert">{error}</p>}
            {!rejecting ? (
              <div className="ae-review-actions">
                <button className="gold-button" disabled={busy} onClick={() => decide(true)}>{busy ? "Working…" : "Approve payment"}</button>
                <button className="outline-button" disabled={busy} onClick={() => setRejecting(true)}>Send back…</button>
              </div>
            ) : (
              <div className="ae-review-reject">
                <label className="ae-field">Reason for the member (they will see this)
                  <textarea className="ae-input ae-field-input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example: the receipt is blurry, or the amount does not match." />
                </label>
                <div className="ae-review-actions">
                  <button className="gold-button" disabled={busy} onClick={() => decide(false)}>{busy ? "Sending…" : "Send back to member"}</button>
                  <button className="outline-button" disabled={busy} onClick={() => { setRejecting(false); setError(""); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
