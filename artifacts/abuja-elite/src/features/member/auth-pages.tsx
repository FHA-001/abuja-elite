import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { getSupabaseClient, supabaseConfig } from "@/lib/supabase/client";
import { requestPasswordReset, signInMember, signUpMember } from "@/lib/supabase/membership";
import { useMemberSession, useMembership } from "@/hooks/use-member";
import { MemberShell } from "./member-shell";

const MIN_PASSWORD = 10;

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes(":")) return "/account";
  return raw;
}

function Unavailable() {
  return (
    <div className="public-empty">
      <h3>Accounts open soon.</h3>
      <p>Member sign-in is not available right now. Please check back shortly or reach out through the connect page.</p>
      <Link className="outline-button mt-5" href="/connect">Connect with us</Link>
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; show: boolean; autoComplete: string }) {
  return (
    <label>
      {label}
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        minLength={MIN_PASSWORD}
        maxLength={128}
        required
      />
    </label>
  );
}

/* ------------------------------------------------------------------ Join */
export function JoinPage() {
  const [, navigate] = useLocation();
  const session = useMemberSession();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (session.user && !checkEmail) navigate("/account", { replace: true });
  }, [session.user, checkEmail, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    if (form.get("website")) { // honeypot: real people never fill this in
      setCheckEmail(true);
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await signUpMember({ fullName, email, password });
      if (result.signedIn) navigate("/account", { replace: true });
      else setCheckEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberShell title="Join Abuja Elite" description="Create your Abuja Elite membership account.">
      <section className="member-auth-wrap elite-shell">
        <div className="member-auth member-card">
          <p className="eyebrow">Membership</p>
          <h1 className="display-font">Take your seat.</h1>
          {!supabaseConfig.isConfigured ? <Unavailable /> : checkEmail ? (
            <div role="status" className="member-notice">
              <h2 className="display-font">Check your email.</h2>
              <p>
                If this address can be registered, we have sent a link to confirm it. Open it to finish creating your
                account, then log in to complete your membership.
              </p>
              <Link className="outline-button mt-5" href="/login">Go to log in</Link>
            </div>
          ) : (
            <>
              <p className="body-copy">
                Create your account first. Next you will see how to pay for your membership and upload your receipt.
                Access opens once we approve it.
              </p>
              <form className="public-form member-form" onSubmit={onSubmit} aria-label="Create an account">
                <label>
                  Full name
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={160} required />
                </label>
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={320} required />
                </label>
                <PasswordField label="Password" value={password} onChange={setPassword} show={show} autoComplete="new-password" />
                <label className="member-check">
                  <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                  Show password
                </label>
                <p className="member-hint">Use at least {MIN_PASSWORD} characters.</p>
                <label className="member-check member-consent">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
                  <span>
                    I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy notice</Link>.
                  </span>
                </label>
                <div className="member-honeypot" aria-hidden="true">
                  <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>
                {error && <p className="member-error" role="alert">{error}</p>}
                <button className="gold-button" disabled={busy || !agree}>{busy ? "Creating account…" : "Create my account"}</button>
              </form>
              <p className="member-switch">Already a member? <Link href="/login">Log in</Link></p>
            </>
          )}
        </div>
      </section>
    </MemberShell>
  );
}

/* ----------------------------------------------------------------- Login */
export function LoginPage() {
  const [, navigate] = useLocation();
  const session = useMemberSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = safeNext(new URLSearchParams(window.location.search).get("next"));
  const membership = useMembership(session.user?.id);

  // One login form for everyone: once we know who signed in, send admins to the admin desk
  // and members to their account (or to the page they were trying to reach).
  useEffect(() => {
    if (!session.user || membership.isPending) return;
    const isAdmin = membership.data?.isAdmin === true;
    navigate(isAdmin && next === "/account" ? "/admin" : next, { replace: true });
  }, [session.user, membership.isPending, membership.data, next, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signInMember(email, password);
      // No redirect here on purpose: the effect above sends admins and members to the right place
      // once it knows who signed in.
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not log you in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberShell title="Log in" description="Log in to your Abuja Elite membership account.">
      <section className="member-auth-wrap elite-shell">
        <div className="member-auth member-card">
          <p className="eyebrow">Members</p>
          <h1 className="display-font">Welcome back.</h1>
          {!supabaseConfig.isConfigured ? <Unavailable /> : session.user ? (
            <p role="status" className="member-hint">Signing you in…</p>
          ) : (
            <>
              <form className="public-form member-form" onSubmit={onSubmit} aria-label="Log in">
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
                <label>
                  Password
                  <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </label>
                <label className="member-check">
                  <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                  Show password
                </label>
                {error && <p className="member-error" role="alert">{error}</p>}
                <button className="gold-button" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
              </form>
              <p className="member-switch"><Link href="/forgot-password">Forgot your password?</Link></p>
              <p className="member-switch">New here? <Link href="/join">Create an account</Link></p>
            </>
          )}
        </div>
      </section>
    </MemberShell>
  );
}

/* ------------------------------------------------------- Forgot password */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberShell title="Reset your password" description="Reset your Abuja Elite account password.">
      <section className="member-auth-wrap elite-shell">
        <div className="member-auth member-card">
          <p className="eyebrow">Account recovery</p>
          <h1 className="display-font">A fresh start.</h1>
          {!supabaseConfig.isConfigured ? <Unavailable /> : sent ? (
            <div role="status" className="member-notice">
              <p>If an account exists for that address, a reset link is on its way. It can take a few minutes to arrive.</p>
              <Link className="outline-button mt-5" href="/login">Back to log in</Link>
            </div>
          ) : (
            <>
              <p className="body-copy">Enter your email and we will send you a link to choose a new password.</p>
              <form className="public-form member-form" onSubmit={onSubmit} aria-label="Reset password">
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
                {error && <p className="member-error" role="alert">{error}</p>}
                <button className="gold-button" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
              </form>
              <p className="member-switch"><Link href="/login">Back to log in</Link></p>
            </>
          )}
        </div>
      </section>
    </MemberShell>
  );
}

/* -------------------------------------------------------- Set new password */
export function ResetMemberPasswordPage() {
  const [loading, setLoading] = useState(supabaseConfig.isConfigured);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseConfig.isConfigured) return undefined;
    let alive = true;
    const client = getSupabaseClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) { setReady(Boolean(session)); setLoading(false); }
    });
    client.auth.getSession().then(({ data }) => {
      if (alive) { setReady(Boolean(data.session)); setLoading(false); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) { setError(`Your password needs at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    setError("");
    try {
      const client = getSupabaseClient();
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      await client.auth.signOut();
      setPassword(""); setConfirm("");
      setDone(true);
    } catch {
      setError("We could not update the password. Try a stronger one, or request a new link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberShell title="Choose a new password" description="Set a new password for your Abuja Elite account.">
      <section className="member-auth-wrap elite-shell">
        <div className="member-auth member-card">
          <p className="eyebrow">Account recovery</p>
          <h1 className="display-font">New password.</h1>
          {loading ? <p role="status">Checking your link…</p> : done ? (
            <div role="status" className="member-notice">
              <p>Your password has been updated.</p>
              <Link className="gold-button mt-5" href="/login">Log in</Link>
            </div>
          ) : !ready ? (
            <div className="member-notice">
              <p>This link is invalid or has expired.</p>
              <Link className="outline-button mt-5" href="/forgot-password">Request a new link</Link>
            </div>
          ) : (
            <form className="public-form member-form" onSubmit={onSubmit} aria-label="Choose a new password">
              <PasswordField label="New password" value={password} onChange={setPassword} show={show} autoComplete="new-password" />
              <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} show={show} autoComplete="new-password" />
              <label className="member-check">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                Show passwords
              </label>
              <p className="member-hint">Use at least {MIN_PASSWORD} characters.</p>
              {error && <p className="member-error" role="alert">{error}</p>}
              <button className="gold-button" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
            </form>
          )}
        </div>
      </section>
    </MemberShell>
  );
}
