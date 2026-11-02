import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemberSession, useMembership } from "@/hooks/use-member";
import { getMyProfile, normalizeUrl, saveMyProfile, uploadProfilePhoto, type ProfileEdits } from "@/lib/supabase/directory";
import { MemberAvatar } from "./member-avatar";
import { MemberShell } from "./member-shell";

type Form = {
  full_name: string; profession: string; business_name: string; industry: string; location: string; bio: string;
  skills: string[]; phone: string; whatsapp: string; linkedin_url: string; instagram_url: string; website_url: string;
  show_email: boolean; show_phone: boolean; show_whatsapp: boolean; listed: boolean;
};

const PHONE = /^[0-9 +()\-]*$/;

function SkillsInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!cleaned) return;
    if (value.some((s) => s.toLowerCase() === cleaned.toLowerCase()) || value.length >= 20) { setDraft(""); return; }
    onChange([...value, cleaned]);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  }
  return (
    <div className="skills-box">
      <div className="skills-chips">
        {value.map((s) => (
          <span key={s} className="skill-chip">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={() => onChange(value.filter((x) => x !== s))}><X size={13} /></button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(",", ""))}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        placeholder={value.length >= 20 ? "Maximum 20 skills" : "Type a skill and press Enter"}
        maxLength={40}
        disabled={value.length >= 20}
        aria-label="Add a skill"
      />
    </div>
  );
}

export default function ProfilePage() {
  const session = useMemberSession();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const user = session.user;
  const membership = useMembership(user?.id);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session.loading && !user) navigate("/login?next=/account/profile", { replace: true });
  }, [session.loading, user, navigate]);

  const profile = useQuery({ queryKey: ["my-profile", user?.id], queryFn: () => getMyProfile(user!.id), enabled: Boolean(user), retry: 1 });
  const [form, setForm] = useState<Form | null>(null);
  const [loadedAt, setLoadedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = profile.data;
    if (p && p.updated_at !== loadedAt && !busy) {
      setLoadedAt(p.updated_at);
      setForm({
        full_name: p.full_name, profession: p.profession ?? "", business_name: p.business_name ?? "", industry: p.industry ?? "",
        location: p.location ?? "", bio: p.bio ?? "", skills: p.skills ?? [], phone: p.phone ?? "", whatsapp: p.whatsapp ?? "",
        linkedin_url: p.linkedin_url ?? "", instagram_url: p.instagram_url ?? "", website_url: p.website_url ?? "",
        show_email: p.show_email, show_phone: p.show_phone, show_whatsapp: p.show_whatsapp, listed: p.listed,
      });
    }
  }, [profile.data, loadedAt, busy]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => { setForm((f) => (f ? { ...f, [key]: value } : f)); setSaved(false); };
  const text = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never);

  async function onPhoto(file: File | undefined) {
    if (!file || !user) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await uploadProfilePhoto(user.id, file);
      await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["directory"] });
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "The photo could not be uploaded.");
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !user || busy) return;
    setError("");
    const name = form.full_name.trim();
    if (!name) { setError("Your name cannot be empty."); return; }
    if (form.bio.length > 2000) { setError("Your bio is too long (2000 characters maximum)."); return; }
    if (!PHONE.test(form.phone) || !PHONE.test(form.whatsapp)) { setError("Phone numbers can only contain digits, spaces, + ( ) and -."); return; }
    const urls: Record<string, string | null> = {};
    for (const [key, label] of [["linkedin_url", "LinkedIn"], ["instagram_url", "Instagram"], ["website_url", "Website"]] as const) {
      const raw = form[key].trim();
      if (!raw) { urls[key] = null; continue; }
      const clean = normalizeUrl(raw);
      if (!clean) { setError(`The ${label} address does not look right. Use a full web address such as https://example.com.`); return; }
      urls[key] = clean;
    }
    const orNull = (v: string) => (v.trim() ? v.trim() : null);
    const values: ProfileEdits = {
      full_name: name, profession: orNull(form.profession), business_name: orNull(form.business_name), industry: orNull(form.industry),
      location: orNull(form.location), bio: orNull(form.bio), skills: form.skills,
      phone: orNull(form.phone), whatsapp: orNull(form.whatsapp),
      linkedin_url: urls.linkedin_url, instagram_url: urls.instagram_url, website_url: urls.website_url,
      show_email: form.show_email, show_phone: form.show_phone && Boolean(orNull(form.phone)), show_whatsapp: form.show_whatsapp && Boolean(orNull(form.whatsapp)),
      listed: form.listed,
    };
    setBusy(true);
    try {
      await saveMyProfile(user.id, values);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["profile-name", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["directory"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (session.loading || !user || profile.isPending || !form) {
    return (
      <MemberShell title="Your profile" description="Edit your Abuja Elite member profile.">
        <section className="elite-shell member-head">
          {profile.isError
            ? <p role="alert" className="member-error">Your profile could not load. <button className="ae-text-button" onClick={() => profile.refetch()}>Try again</button></p>
            : <p role="status" className="member-hint">Loading your profile…</p>}
        </section>
      </MemberShell>
    );
  }

  const paying = membership.data?.state === "active" || membership.data?.state === "grace";
  const complete = Boolean(form.profession.trim() || form.business_name.trim());
  let visibility = "You appear on the Community page.";
  let visible = true;
  if (!form.listed) { visibility = "You are hidden from the Community page (switched off below)."; visible = false; }
  else if (!complete) { visibility = "Add your profession or business to appear on the Community page."; visible = false; }
  else if (!paying) { visibility = "You will appear on the Community page once your membership is active."; visible = false; }

  return (
    <MemberShell title="Your profile" description="Edit your Abuja Elite member profile.">
      <section className="elite-shell member-head">
        <p className="eyebrow">Your profile</p>
        <h1 className="display-font">How members see you.</h1>
        <p className={`profile-visibility ${visible ? "is-visible" : ""}`} role="status">{visibility}</p>
      </section>

      <section className="elite-shell profile-grid">
        <form className="public-form member-form profile-form" onSubmit={onSubmit} aria-label="Edit profile">
          <div className="member-card profile-photo-card">
            <MemberAvatar path={profile.data?.photo_path ?? null} name={form.full_name || "Member"} size="lg" />
            <div>
              <h2 className="display-font">Your photo</h2>
              <p className="member-hint">A clear face photo works best. It is resized automatically.</p>
              <label className="outline-button profile-photo-button">
                {photoBusy ? "Uploading…" : profile.data?.photo_path ? "Change photo" : "Add a photo"}
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              {photoError && <p className="member-error" role="alert">{photoError}</p>}
            </div>
          </div>

          <div className="member-card">
            <h2 className="display-font">About you</h2>
            <label>Full name<input value={form.full_name} onChange={text("full_name")} maxLength={160} required /></label>
            <div className="profile-two">
              <label>Profession<input value={form.profession} onChange={text("profession")} maxLength={160} placeholder="Architect" /></label>
              <label>Business<input value={form.business_name} onChange={text("business_name")} maxLength={160} placeholder="Okafor Studio" /></label>
            </div>
            <div className="profile-two">
              <label>Industry<input value={form.industry} onChange={text("industry")} maxLength={160} placeholder="Design" /></label>
              <label>Location<input value={form.location} onChange={text("location")} maxLength={160} placeholder="Maitama, Abuja" /></label>
            </div>
            <label>About you<textarea value={form.bio} onChange={text("bio")} rows={5} maxLength={2000} placeholder="What you do, and what you are looking for." /></label>
            <p className="member-hint">{form.bio.length}/2000</p>
          </div>

          <div className="member-card">
            <h2 className="display-font">Skills</h2>
            <p className="member-hint">Members can search by these. Up to 20.</p>
            <SkillsInput value={form.skills} onChange={(next) => set("skills", next)} />
          </div>

          <div className="member-card">
            <h2 className="display-font">Contact and links</h2>
            <div className="profile-two">
              <label>Phone<input value={form.phone} onChange={text("phone")} maxLength={40} inputMode="tel" placeholder="0803 000 0000" /></label>
              <label>WhatsApp number<input value={form.whatsapp} onChange={text("whatsapp")} maxLength={40} inputMode="tel" placeholder="0803 000 0000" /></label>
            </div>
            <label>LinkedIn<input value={form.linkedin_url} onChange={text("linkedin_url")} maxLength={300} placeholder="linkedin.com/in/yourname" /></label>
            <label>Instagram<input value={form.instagram_url} onChange={text("instagram_url")} maxLength={300} placeholder="instagram.com/yourname" /></label>
            <label>Website<input value={form.website_url} onChange={text("website_url")} maxLength={300} placeholder="yourbusiness.com" /></label>
          </div>

          <div className="member-card">
            <h2 className="display-font">Who can see what</h2>
            <p className="member-hint">Only paid members can see the Community page. You choose which contact details they can see. Links you add above are always shown.</p>
            <label className="member-check"><input type="checkbox" checked={form.listed} onChange={(e) => set("listed", e.target.checked)} />Show me on the Community page</label>
            <label className="member-check"><input type="checkbox" checked={form.show_email} onChange={(e) => set("show_email", e.target.checked)} />Share my email ({profile.data?.email})</label>
            <label className="member-check"><input type="checkbox" checked={form.show_phone && Boolean(form.phone.trim())} disabled={!form.phone.trim()} onChange={(e) => set("show_phone", e.target.checked)} />Share my phone number, with a call button</label>
            <label className="member-check"><input type="checkbox" checked={form.show_whatsapp && Boolean(form.whatsapp.trim())} disabled={!form.whatsapp.trim()} onChange={(e) => set("show_whatsapp", e.target.checked)} />Share my WhatsApp number, with a chat button</label>
          </div>

          {error && <p className="member-error" role="alert">{error}</p>}
          {saved && <p className="member-saved" role="status">Saved. Your profile is up to date.</p>}
          <div className="profile-actions">
            <button className="gold-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
            <Link className="outline-button" href="/account">Back to my account</Link>
            {paying && <Link className="outline-button" href="/members">Open the Community page</Link>}
          </div>
        </form>
      </section>
    </MemberShell>
  );
}
