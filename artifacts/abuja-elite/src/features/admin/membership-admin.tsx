import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useModal } from "@/hooks/use-modal";
import { formatDate, formatMoney } from "@/lib/supabase/membership";

/* ------------------------------------------------------------------ helpers */

const GRACE_MS = 24 * 60 * 60 * 1000;
type MemberState = "pending" | "active" | "grace" | "expired" | "suspended";

function stateOf(expiresAt: string | null, suspended: boolean): MemberState {
  if (suspended) return "suspended";
  if (!expiresAt) return "pending";
  const t = new Date(expiresAt).getTime();
  const now = Date.now();
  if (now <= t) return "active";
  if (now <= t + GRACE_MS) return "grace";
  return "expired";
}

const STATE_LABEL: Record<MemberState, string> = {
  pending: "Not paid yet",
  active: "Active",
  grace: "Grace period",
  expired: "Expired",
  suspended: "Suspended",
};
const STATE_TONE: Record<MemberState, "gold" | "green" | "red" | "muted"> = {
  pending: "muted",
  active: "green",
  grace: "gold",
  expired: "red",
  suspended: "red",
};

function Badge({ tone, children }: { tone: "gold" | "green" | "red" | "muted"; children: React.ReactNode }) {
  return <span className={`ae-badge ae-badge-${tone}`}>{children}</span>;
}

function friendly(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (text.includes("submission_already_reviewed")) return "Someone has already reviewed this receipt. Refresh the list.";
  if (text.includes("comment_required")) return "Write a short reason (at least 3 letters) so the member knows what to fix.";
  if (text.includes("forbidden")) return "Your account is not allowed to do this.";
  if (text.includes("submission_not_found") || text.includes("member_not_found")) return "That record could not be found.";
  return "The request failed. Please check your connection and try again.";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

/* ------------------------------------------------------------------ summary */

export type MembershipSummary = {
  waitingReceipts: number;
  notPaidYet: number;
  active: number;
  expiringSoon: number;
  grace: number;
  expired: number;
  suspended: number;
  adminIds: string[];
};

export function useMembershipSummary(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", userId, "membership-summary"],
    enabled: enabled && Boolean(userId),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
    queryFn: async (): Promise<MembershipSummary> => {
      const { data, error } = await getSupabaseClient().rpc("admin_membership_summary");
      if (error) throw new Error("Membership counts could not load.");
      const d = (data ?? {}) as Record<string, unknown>;
      return {
        waitingReceipts: asNumber(d.waiting_receipts),
        notPaidYet: asNumber(d.not_paid_yet),
        active: asNumber(d.active),
        expiringSoon: asNumber(d.expiring_soon),
        grace: asNumber(d.grace),
        expired: asNumber(d.expired),
        suspended: asNumber(d.suspended),
        adminIds: Array.isArray(d.admin_ids) ? d.admin_ids.filter((x): x is string => typeof x === "string") : [],
      };
    },
  });
}

export function MembershipOverview({
  summary, loading, error, onOpen,
}: {
  summary: MembershipSummary | undefined;
  loading: boolean;
  error: boolean;
  onOpen: (section: "payments" | "accounts") => void;
}) {
  if (error) return <p className="ae-error-row" role="alert">Membership counts could not load.</p>;
  const cards: Array<[string, string, number | undefined, "payments" | "accounts", boolean]> = [
    ["waiting", "Receipts waiting", summary?.waitingReceipts, "payments", true],
    ["active", "Active members", summary?.active, "accounts", false],
    ["soon", "Expiring in 7 days", summary?.expiringSoon, "accounts", false],
    ["grace", "In grace period", summary?.grace, "accounts", false],
    ["expired", "Expired", summary?.expired, "accounts", false],
    ["new", "Not paid yet", summary?.notPaidYet, "accounts", false],
  ];
  return (
    <section aria-label="Membership" className="ae-membership-band">
      <p className="ae-kicker mb-3">Membership</p>
      <div className="ae-overview-grid">
        {cards.map(([key, label, value, target, highlight]) => (
          <button
            key={key}
            className={`ae-metric text-left ${highlight && (value ?? 0) > 0 ? "ae-metric-active" : ""}`}
            onClick={() => onOpen(target)}
          >
            <span className="ae-kicker">{label}</span>
            <strong className="ae-count">{loading ? "—" : value ?? 0}</strong>
            <span className="text-xs">Open <ArrowRight size={12} className="inline" /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ types */

type Submission = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  fee_amount: number;
  currency: string;
  member_note: string | null;
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
  period_start: string | null;
  period_end: string | null;
  receipt_path: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  business_name: string | null;
  profession: string | null;
  industry: string | null;
  location: string | null;
  bio: string | null;
  created_at: string;
};

const SUBMISSION_COLUMNS =
  "id,user_id,status,fee_amount,currency,member_note,admin_comment,created_at,reviewed_at,period_start,period_end,receipt_path";
const PROFILE_COLUMNS =
  "user_id,full_name,email,phone,whatsapp,business_name,profession,industry,location,bio,created_at";

async function loadProfiles(ids: string[]): Promise<Map<string, ProfileRow>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await getSupabaseClient().from("profiles").select(PROFILE_COLUMNS).in("user_id", ids);
  if (error) throw new Error("Member details could not load.");
  return new Map((data ?? []).map((p) => [p.user_id, p as ProfileRow]));
}

/* ------------------------------------------------------------------ payments */

type Filter = "pending" | "approved" | "rejected" | "all";
const FILTERS: Array<[Filter, string]> = [["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Not approved"], ["all", "All"]];
const PAGE = 20;

export function PaymentsPanel({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ row: Submission; profile: ProfileRow | undefined }>();

  const list = useQuery({
    queryKey: ["admin", userId, "payments", filter, page],
    refetchInterval: 30_000,
    retry: 1,
    queryFn: async () => {
      let q = getSupabaseClient()
        .from("payment_submissions")
        .select(SUBMISSION_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: filter === "pending" })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error, count } = await q;
      if (error) throw new Error("Payments could not load.");
      const rows = (data ?? []) as Submission[];
      const profiles = await loadProfiles([...new Set(rows.map((r) => r.user_id))]);
      return { rows, profiles, total: count ?? 0 };
    },
  });

  const rows = list.data?.rows ?? [];

  return (
    <>
      <div className="ae-section-heading">
        <div>
          <p className="ae-kicker">Membership</p>
          <h1 className="ae-page-title mt-3">Payments</h1>
        </div>
      </div>
      <p className="body-copy mb-6">Open a receipt to check it, then approve it or send it back with a reason. Approving gives the member one month of access.</p>

      <div className="ae-tabs" role="group" aria-label="Filter payments">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`ae-tab ${filter === id ? "ae-tab-active" : ""}`} aria-pressed={filter === id} onClick={() => { setFilter(id); setPage(0); }}>
            {label}
          </button>
        ))}
      </div>

      {list.isPending ? <p role="status">Loading payments…</p>
        : list.isError ? <p role="alert">Could not load payments. <button className="ae-text-button" onClick={() => list.refetch()}>Retry</button></p>
        : rows.length === 0 ? <div className="ae-empty">{filter === "pending" ? "No receipts are waiting. You are all caught up." : "Nothing here yet."}</div>
        : (
          <div className="ae-inbox-list">
            {rows.map((r) => {
              const profile = list.data?.profiles.get(r.user_id);
              return (
                <button key={r.id} className="ae-inbox-row" onClick={() => setSelected({ row: r, profile })}>
                  <strong>{profile?.full_name ?? "Unknown member"}</strong>
                  <span>
                    <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "gold"}>
                      {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Not approved" : "Waiting"}
                    </Badge>
                  </span>
                  <small>{formatDate(r.created_at, true)} · {formatMoney(r.fee_amount, r.currency)}</small>
                </button>
              );
            })}
          </div>
        )}

      <div className="ae-pagination">
        <button disabled={page === 0 || list.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page + 1} · {list.data?.total ?? "—"} receipts</span>
        <button disabled={list.isFetching || (page + 1) * PAGE >= (list.data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {selected && (
        <ReviewDrawer
          userId={userId}
          row={selected.row}
          profile={selected.profile}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}

function ReviewDrawer({
  userId, row, profile, onClose,
}: { userId: string; row: Submission; profile: ProfileRow | undefined; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useModal(ref, onClose);
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const isPdf = /\.pdf$/i.test(row.receipt_path);
  const receipt = useQuery({
    queryKey: ["admin", userId, "receipt", row.receipt_path],
    staleTime: 240_000,
    retry: 1,
    queryFn: async () => {
      const { data, error: e } = await getSupabaseClient().storage.from("payment-receipts").createSignedUrl(row.receipt_path, 600);
      if (e || !data) throw new Error("The receipt file could not be opened.");
      return data.signedUrl;
    },
  });
  const membership = useQuery({
    queryKey: ["admin", userId, "membership-of", row.user_id],
    retry: 1,
    queryFn: async () => {
      const { data } = await getSupabaseClient().from("memberships").select("access_expires_at,suspended").eq("user_id", row.user_id).maybeSingle();
      return data;
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", userId] });
  }

  async function approve() {
    if (busy) return;
    if (!window.confirm(`Approve this payment from ${profile?.full_name ?? "this member"}? They will get access straight away.`)) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: e } = await getSupabaseClient().rpc("admin_approve_payment", { p_submission_id: row.id });
      if (e) throw e;
      const until = (data as Record<string, unknown> | null)?.access_expires_at;
      setResult(`Approved. ${profile?.full_name ?? "The member"} now has access until ${typeof until === "string" ? formatDate(until) : "next month"}.`);
      await refresh();
    } catch (e) {
      setError(friendly(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (busy) return;
    if (comment.trim().length < 3) { setError(friendly("comment_required")); return; }
    setBusy(true);
    setError("");
    try {
      const { error: e } = await getSupabaseClient().rpc("admin_reject_payment", { p_submission_id: row.id, p_comment: comment.trim() });
      if (e) throw e;
      setResult("Sent back. The member can see your reason and upload a new receipt.");
      await refresh();
    } catch (e) {
      setError(friendly(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const state = membership.data ? stateOf(membership.data.access_expires_at, membership.data.suspended) : null;

  return (
    <div className="ae-drawer-backdrop">
      <aside ref={ref} className="ae-drawer" role="dialog" aria-modal="true" aria-label="Review payment">
        <div className="ae-drawer-head">
          <h2>Review payment</h2>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="ae-drawer-body">
          <p className="ae-review-summary">
            <strong>{profile?.full_name ?? "Unknown member"}</strong>
            <span>{formatMoney(row.fee_amount, row.currency)} · {formatDate(row.created_at, true)}</span>
          </p>

          <div className="ae-receipt-box">
            <p className="ae-field-label">Receipt</p>
            {receipt.isPending ? <p role="status">Opening the receipt…</p>
              : receipt.isError ? <p role="alert">{receipt.error.message} <button className="ae-text-button" onClick={() => receipt.refetch()}>Retry</button></p>
              : isPdf ? <a className="outline-button" href={receipt.data} target="_blank" rel="noopener noreferrer">Open the PDF receipt ↗</a>
              : (
                <a href={receipt.data} target="_blank" rel="noopener noreferrer" aria-label="Open the receipt image in a new tab">
                  <img className="ae-receipt-image" src={receipt.data} alt="Payment receipt uploaded by the member" />
                </a>
              )}
          </div>

          {result && <div className="ae-status-line mt-6" role="status">{result}</div>}

          <dl className="ae-detail-fields mt-6">
            <div><dt>Member</dt><dd>{profile?.full_name ?? "Unknown"}</dd></div>
            <div><dt>Email</dt><dd>{profile?.email || "—"}</dd></div>
            {profile?.phone && <div><dt>Phone</dt><dd>{profile.phone}</dd></div>}
            <div><dt>Submitted</dt><dd>{formatDate(row.created_at, true)}</dd></div>
            <div><dt>Monthly fee then</dt><dd>{formatMoney(row.fee_amount, row.currency)}</dd></div>
            {state && (
              <div>
                <dt>Membership now</dt>
                <dd>{STATE_LABEL[state]}{membership.data?.access_expires_at ? ` · until ${formatDate(membership.data.access_expires_at)}` : ""}</dd>
              </div>
            )}
            {row.member_note && <div><dt>Note from member</dt><dd>{row.member_note}</dd></div>}
            {row.status !== "pending" && (
              <div>
                <dt>Decision</dt>
                <dd>
                  {row.status === "approved" ? `Approved ${formatDate(row.reviewed_at)}${row.period_end ? ` · covers until ${formatDate(row.period_end)}` : ""}` : `Not approved ${formatDate(row.reviewed_at)}`}
                  {row.admin_comment ? ` · Reason: ${row.admin_comment}` : ""}
                </dd>
              </div>
            )}
          </dl>

        </div>
        {!result && row.status === "pending" && (
          <div className="ae-drawer-foot ae-review-foot">
            {error && <p className="ae-inline-error" role="alert">{error}</p>}
            {!rejecting ? (
              <div className="ae-review-actions">
                <button className="gold-button" disabled={busy} onClick={approve}>{busy ? "Working…" : "Approve payment"}</button>
                <button className="outline-button" disabled={busy} onClick={() => setRejecting(true)}>Send back…</button>
              </div>
            ) : (
              <div className="ae-review-reject">
                <label className="ae-field">
                  Reason for the member (they will see this)
                  <textarea className="ae-input ae-field-input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example: the receipt is blurry, or the amount does not match." />
                </label>
                <div className="ae-review-actions">
                  <button className="gold-button" disabled={busy} onClick={reject}>{busy ? "Sending…" : "Send back to member"}</button>
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

/* ------------------------------------------------------------------ accounts */

type AccountRow = ProfileRow & { access_expires_at: string | null; suspended: boolean; state: MemberState; isAdmin: boolean };
const STATE_FILTERS: Array<["all" | MemberState, string]> = [
  ["all", "Everyone"], ["active", "Active"], ["grace", "Grace"], ["expired", "Expired"], ["pending", "Not paid yet"], ["suspended", "Suspended"],
];

export function AccountsPanel({ userId, adminIds }: { userId: string; adminIds: string[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | MemberState>("all");
  const [selected, setSelected] = useState<AccountRow>();

  const accounts = useQuery({
    queryKey: ["admin", userId, "accounts"],
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async (): Promise<AccountRow[]> => {
      const client = getSupabaseClient();
      const [profiles, memberships] = await Promise.all([
        client.from("profiles").select(PROFILE_COLUMNS).order("created_at", { ascending: false }).limit(500),
        client.from("memberships").select("user_id,access_expires_at,suspended").limit(500),
      ]);
      if (profiles.error || memberships.error) throw new Error("Accounts could not load.");
      const byUser = new Map((memberships.data ?? []).map((m) => [m.user_id, m]));
      return (profiles.data ?? []).map((p) => {
        const m = byUser.get(p.user_id);
        return { ...(p as ProfileRow), access_expires_at: m?.access_expires_at ?? null, suspended: m?.suspended ?? false, state: stateOf(m?.access_expires_at ?? null, m?.suspended ?? false), isAdmin: false };
      });
    },
  });

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (accounts.data ?? []).map((a) => ({ ...a, isAdmin: adminIds.includes(a.user_id) })).filter((a) =>
      (filter === "all" || (!a.isAdmin && a.state === filter)) &&
      (!needle || `${a.full_name} ${a.email} ${a.business_name ?? ""} ${a.profession ?? ""}`.toLowerCase().includes(needle)));
  }, [accounts.data, adminIds, search, filter]);

  return (
    <>
      <div className="ae-section-heading">
        <div>
          <p className="ae-kicker">Membership</p>
          <h1 className="ae-page-title mt-3">Member accounts</h1>
        </div>
      </div>
      <p className="body-copy mb-6">Everyone who has signed up, and where their membership stands.</p>

      <label className="ae-field mb-4">Search by name, email or business
        <input className="ae-input ae-field-input" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <div className="ae-tabs" role="group" aria-label="Filter accounts">
        {STATE_FILTERS.map(([id, label]) => (
          <button key={id} className={`ae-tab ${filter === id ? "ae-tab-active" : ""}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {accounts.isPending ? <p role="status">Loading accounts…</p>
        : accounts.isError ? <p role="alert">Could not load accounts. <button className="ae-text-button" onClick={() => accounts.refetch()}>Retry</button></p>
        : shown.length === 0 ? <div className="ae-empty">No matching accounts.</div>
        : (
          <div className="ae-inbox-list">
            {shown.map((a) => (
              <button key={a.user_id} className="ae-inbox-row" onClick={() => setSelected(a)}>
                <strong>{a.full_name}</strong>
                <span>{a.isAdmin ? <Badge tone="gold">Admin</Badge> : <Badge tone={STATE_TONE[a.state]}>{STATE_LABEL[a.state]}</Badge>}</span>
                <small>{a.email}{!a.isAdmin && a.access_expires_at ? ` · until ${formatDate(a.access_expires_at)}` : ""}</small>
              </button>
            ))}
          </div>
        )}
      <p className="ae-hint mt-4">{accounts.data ? `${shown.length} of ${accounts.data.length} accounts` : ""}</p>

      {selected && <AccountDrawer userId={userId} account={selected} onClose={() => setSelected(undefined)} />}
    </>
  );
}

function AccountDrawer({ userId, account, onClose }: { userId: string; account: AccountRow; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useModal(ref, onClose);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suspended, setSuspended] = useState(account.suspended);

  const history = useQuery({
    queryKey: ["admin", userId, "account-history", account.user_id],
    retry: 1,
    queryFn: async () => {
      const { data, error: e } = await getSupabaseClient()
        .from("payment_submissions")
        .select("id,status,fee_amount,currency,created_at,period_end,admin_comment")
        .eq("user_id", account.user_id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (e) throw new Error("Payment history could not load.");
      return data ?? [];
    },
  });

  async function toggleSuspend() {
    const next = !suspended;
    if (!window.confirm(next ? `Suspend ${account.full_name}? They lose access straight away, even if they have paid.` : `Restore access for ${account.full_name}?`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: e } = await getSupabaseClient().rpc("admin_set_suspended", { p_user_id: account.user_id, p_suspended: next });
      if (e) throw e;
      setSuspended(next);
      await queryClient.invalidateQueries({ queryKey: ["admin", userId] });
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  const state = stateOf(account.access_expires_at, suspended);
  const fields: Array<[string, string | null]> = [
    ["Email", account.email], ["Phone", account.phone], ["WhatsApp", account.whatsapp], ["Business", account.business_name],
    ["Profession", account.profession], ["Industry", account.industry], ["Location", account.location], ["Joined", formatDate(account.created_at)],
  ];

  return (
    <div className="ae-drawer-backdrop">
      <aside ref={ref} className="ae-drawer" role="dialog" aria-modal="true" aria-label="Member account">
        <div className="ae-drawer-head">
          <h2>{account.full_name}</h2>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="ae-drawer-body">
          <p className="mb-4">{account.isAdmin ? <Badge tone="gold">Admin</Badge> : <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>}{!account.isAdmin && account.access_expires_at ? <span className="ae-hint"> · access until {formatDate(account.access_expires_at, true)}</span> : null}</p>
          <dl className="ae-detail-fields">
            {fields.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            {account.bio && <div><dt>About</dt><dd>{account.bio}</dd></div>}
          </dl>

          <h3 className="ae-field-label mt-6">Payment history</h3>
          {history.isPending ? <p role="status">Loading…</p>
            : history.isError ? <p role="alert">{history.error.message}</p>
            : history.data.length === 0 ? <p className="ae-hint">No receipts submitted yet.</p>
            : (
              <ul className="ae-history">
                {history.data.map((h) => (
                  <li key={h.id}>
                    <span>{formatDate(h.created_at)} · {formatMoney(h.fee_amount, h.currency)}</span>
                    <Badge tone={h.status === "approved" ? "green" : h.status === "rejected" ? "red" : "gold"}>{h.status === "approved" ? "Approved" : h.status === "rejected" ? "Not approved" : "Waiting"}</Badge>
                  </li>
                ))}
              </ul>
            )}

          {error && <p className="ae-inline-error mt-4" role="alert">{error}</p>}
          {account.isAdmin ? (
            <p className="ae-hint mt-6">This is an admin account, so it always has access.</p>
          ) : (
            <>
              <button className={`${suspended ? "gold-button" : "outline-button"} mt-6`} disabled={busy} onClick={toggleSuspend}>
                {busy ? "Working…" : suspended ? "Restore access" : "Suspend account"}
              </button>
              <p className="ae-hint mt-3">Suspending blocks access even if the member has paid. To delete an account completely, use the Supabase dashboard.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ payment settings */

export function PaymentSettingsPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", userId, "payment-settings"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("payment_settings")
        .select("monthly_fee_amount,currency,bank_name,account_name,account_number,payment_instructions,updated_at")
        .eq("id", 1)
        .single();
      if (error) throw new Error("Payment settings could not load.");
      return data;
    },
  });

  const [form, setForm] = useState({ fee: "", currency: "NGN", bank: "", name: "", number: "", notes: "" });
  const [loadedAt, setLoadedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const d = query.data;
    if (d && d.updated_at !== loadedAt) {
      setLoadedAt(d.updated_at);
      setForm({
        fee: d.monthly_fee_amount ? String(d.monthly_fee_amount) : "",
        currency: d.currency || "NGN",
        bank: d.bank_name ?? "",
        name: d.account_name ?? "",
        number: d.account_number ?? "",
        notes: d.payment_instructions ?? "",
      });
    }
  }, [query.data, loadedAt]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setMessage("");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    const fee = Number(form.fee.replace(/,/g, ""));
    if (!Number.isFinite(fee) || fee <= 0) { setError("Enter the monthly fee as a number greater than zero."); return; }
    if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) { setError("The currency should be a 3-letter code such as NGN."); return; }
    if (!form.bank.trim() || !form.number.trim()) { setError("Enter the bank name and the account number."); return; }
    if (!/^[0-9 -]{6,40}$/.test(form.number.trim())) { setError("The account number should contain only digits."); return; }
    setBusy(true);
    try {
      const { data, error: e2 } = await getSupabaseClient()
        .from("payment_settings")
        .update({
          monthly_fee_amount: Math.round(fee * 100) / 100,
          currency: form.currency.trim().toUpperCase(),
          bank_name: form.bank.trim(),
          account_name: form.name.trim() || null,
          account_number: form.number.trim(),
          payment_instructions: form.notes.trim() || null,
        })
        .eq("id", 1)
        .select("id")
        .single();
      if (e2 || !data) throw e2 ?? new Error("No change was saved.");
      setMessage("Saved. Members see the new details straight away.");
      await queryClient.invalidateQueries({ queryKey: ["admin", userId, "payment-settings"] });
    } catch {
      setError("Could not save. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="ae-section-heading">
        <div>
          <p className="ae-kicker">Membership</p>
          <h1 className="ae-page-title mt-3">Payment settings</h1>
        </div>
      </div>
      <p className="body-copy mb-6">This is what members see when they pay. Changing the fee does not change receipts that were already submitted.</p>

      {query.isPending ? <p role="status">Loading…</p>
        : query.isError ? <p role="alert">{query.error.message} <button className="ae-text-button" onClick={() => query.refetch()}>Retry</button></p>
        : (
          <form className="ae-settings" onSubmit={save}>
            <div className="ae-two-col">
              <label className="ae-field">Monthly fee
                <input className="ae-input ae-field-input" inputMode="decimal" value={form.fee} onChange={set("fee")} placeholder="15000" required />
              </label>
              <label className="ae-field">Currency
                <input className="ae-input ae-field-input" value={form.currency} onChange={set("currency")} maxLength={3} required />
              </label>
            </div>
            <label className="ae-field">Bank name
              <input className="ae-input ae-field-input" value={form.bank} onChange={set("bank")} maxLength={160} required />
            </label>
            <label className="ae-field">Account name
              <input className="ae-input ae-field-input" value={form.name} onChange={set("name")} maxLength={160} />
            </label>
            <label className="ae-field">Account number
              <input className="ae-input ae-field-input" inputMode="numeric" value={form.number} onChange={set("number")} maxLength={40} required />
            </label>
            <label className="ae-field">Notes for members (optional)
              <textarea className="ae-input ae-field-input" rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} placeholder="For example: use your full name as the transfer reference." />
            </label>
            {error && <p className="ae-inline-error" role="alert">{error}</p>}
            {message && <p className="ae-status-line" role="status">{message}</p>}
            <button className="gold-button" disabled={busy}>{busy ? "Saving…" : "Save payment settings"}</button>
          </form>
        )}
    </>
  );
}
