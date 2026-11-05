import type { Json } from "./database.types";
import { getSupabaseClient } from "./client";

export type MembershipState = "pending" | "active" | "grace" | "expired" | "suspended";

export type MyMembership = {
  state: MembershipState;
  hasAccess: boolean;
  isAdmin: boolean;
  accessExpiresAt: string | null;
  graceEndsAt: string | null;
};

const STATES: MembershipState[] = ["pending", "active", "grace", "expired", "suspended"];

function parseMembership(data: Json | null): MyMembership {
  const d = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, Json | undefined>;
  const state = STATES.includes(d.state as MembershipState) ? (d.state as MembershipState) : "pending";
  return {
    state,
    hasAccess: d.has_access === true,
    isAdmin: d.is_admin === true,
    accessExpiresAt: typeof d.access_expires_at === "string" ? d.access_expires_at : null,
    graceEndsAt: typeof d.grace_ends_at === "string" ? d.grace_ends_at : null,
  };
}

export async function getMyMembership(): Promise<MyMembership> {
  const { data, error } = await getSupabaseClient().rpc("get_my_membership");
  if (error) throw new Error("Unable to load your membership. Please try again.");
  return parseMembership(data);
}

export type PaymentSettings = {
  monthly_fee_amount: number;
  currency: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  payment_instructions: string | null;
};

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const { data, error } = await getSupabaseClient()
    .from("payment_settings")
    .select("monthly_fee_amount,currency,bank_name,account_name,account_number,payment_instructions")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Unable to load the payment details. Please try again.");
  return data;
}

export type MyPayment = {
  id: string;
  status: "pending" | "approved" | "rejected";
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
  fee_amount: number;
  currency: string;
  period_end: string | null;
};

export async function listMyPayments(userId: string): Promise<MyPayment[]> {
  const { data, error } = await getSupabaseClient()
    .from("payment_submissions")
    .select("id,status,admin_comment,created_at,reviewed_at,fee_amount,currency,period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error("Unable to load your payment history.");
  return data ?? [];
}

export async function getMyProfileName(userId: string): Promise<string | null> {
  const { data } = await getSupabaseClient()
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}

/* ---------- Receipts ---------- */

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function validateReceiptFile(file: File): string {
  if (!RECEIPT_TYPES[file.type]) return "Please choose a PDF, JPG, PNG or WebP file.";
  if (file.size > RECEIPT_MAX_BYTES) return "That file is larger than 10 MB. Please choose a smaller one.";
  if (file.size === 0) return "That file looks empty. Please choose another.";
  return "";
}

function friendlyPaymentError(message: string): string {
  if (message.includes("pending_submission_exists")) return "You already have a receipt waiting for review.";
  if (message.includes("too_many_submissions")) return "You have submitted too many receipts today. Please try again tomorrow.";
  if (message.includes("account_suspended")) return "Your account is suspended. Please contact us.";
  if (message.includes("receipt_not_uploaded")) return "The upload did not finish. Please try again.";
  return "We could not submit your receipt. Please check your connection and try again.";
}

async function uploadReceiptFile(userId: string, file: File): Promise<string> {
  const problem = validateReceiptFile(file);
  if (problem) throw new Error(problem);
  const path = `${userId}/${crypto.randomUUID()}.${RECEIPT_TYPES[file.type]}`;
  const upload = await getSupabaseClient()
    .storage.from("payment-receipts")
    .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (upload.error) {
    throw new Error("The file could not be uploaded. Please check your connection and try again.");
  }
  return path;
}

export async function submitReceipt(userId: string, file: File, note: string): Promise<void> {
  const path = await uploadReceiptFile(userId, file);
  const { error } = await getSupabaseClient().rpc("submit_payment", {
    p_receipt_path: path,
    p_note: note.trim() ? note.trim().slice(0, 500) : null,
  });
  if (error) throw new Error(friendlyPaymentError(error.message));
}

/* ---------- Event sign-up ---------- */

export type EventRegistration = {
  status: "going" | "pending" | "approved" | "rejected" | "cancelled";
  admin_comment: string | null;
};

function friendlyEventError(message: string): string {
  if (message.includes("event_over")) return "This event has already taken place.";
  if (message.includes("event_cancelled")) return "This event has been cancelled.";
  if (message.includes("event_not_found")) return "This event is not available.";
  if (message.includes("payment_required")) return "This is a paid event. Upload your payment receipt to register.";
  if (message.includes("event_is_free")) return "This event is free. Just tap Register.";
  if (message.includes("already_pending")) return "Your receipt is already waiting for review.";
  if (message.includes("already_registered")) return "You are already registered for this event.";
  if (message.includes("contact_admin")) return "Your payment was approved, so please contact us to cancel.";
  if (message.includes("forbidden")) return "Only members with an active membership can sign up.";
  return "We could not complete that. Please check your connection and try again.";
}

export async function getMyRegistration(eventId: string, userId: string): Promise<EventRegistration | null> {
  const { data, error } = await getSupabaseClient()
    .from("event_registrations")
    .select("status,admin_comment")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Your sign-up status could not load.");
  return data;
}

export async function listMyRegistrations(userId: string): Promise<Record<string, EventRegistration["status"]>> {
  const { data, error } = await getSupabaseClient().from("event_registrations").select("event_id,status").eq("user_id", userId);
  if (error) throw new Error("Your sign-ups could not load.");
  return Object.fromEntries((data ?? []).map((r) => [r.event_id, r.status]));
}

export async function registerForEvent(eventId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("register_for_event", { p_event_id: eventId });
  if (error) throw new Error(friendlyEventError(error.message));
}

export async function cancelEventRegistration(eventId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("cancel_event_registration", { p_event_id: eventId });
  if (error) throw new Error(friendlyEventError(error.message));
}

export async function submitEventReceipt(eventId: string, userId: string, file: File, note: string): Promise<void> {
  const path = await uploadReceiptFile(userId, file);
  const { error } = await getSupabaseClient().rpc("submit_event_payment", {
    p_event_id: eventId,
    p_receipt_path: path,
    p_note: note.trim() ? note.trim().slice(0, 500) : null,
  });
  if (error) throw new Error(friendlyEventError(error.message));
}

/* ---------- Sign up / sign in / recovery ---------- */

export function siteUrl(path = ""): string {
  const origin = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${origin}${base === "/" ? "" : base}${path}`;
}

export type AuthProblem = { message: string };

function authMessage(error: { code?: string; message?: string; status?: number }, fallback: string): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials") return "The email or password is incorrect.";
  if (code === "email_not_confirmed") return "Please confirm your email first. Check your inbox for the link.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (code === "weak_password") return "That password is too weak. Use at least 10 characters with a mix of letters and numbers.";
  return fallback;
}

export async function signUpMember(input: { fullName: string; email: string; password: string }) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: { full_name: input.fullName.trim() },
      emailRedirectTo: siteUrl("/account"),
    },
  });
  if (error) {
    throw new Error(
      authMessage(
        error,
        "We could not create the account. If you already have one, log in or reset your password.",
      ),
    );
  }
  return { signedIn: Boolean(data.session) };
}

export async function signInMember(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(authMessage(error, "We could not log you in. Please try again."));
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: siteUrl("/reset-password"),
  });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    throw new Error("Too many attempts. Please wait a few minutes and try again.");
  }
  // Any other outcome looks the same to the visitor so we never reveal which emails have accounts.
}

/* ---------- Formatting ---------- */

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
