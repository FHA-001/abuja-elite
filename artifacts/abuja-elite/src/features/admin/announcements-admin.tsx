import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useModal } from "@/hooks/use-modal";
import { formatDate } from "@/lib/supabase/membership";

type Row = { id: string; title: string; body: string; pinned: boolean; published: boolean; published_at: string };

export function AnnouncementsPanel({ userId }: { userId: string }) {
  const [editing, setEditing] = useState<Row | "new">();
  const list = useQuery({
    queryKey: ["admin", userId, "announcements"],
    retry: 1,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await getSupabaseClient()
        .from("announcements")
        .select("id,title,body,pinned,published,published_at")
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw new Error("Announcements could not load.");
      return data ?? [];
    },
  });
  const rows = list.data ?? [];

  return (
    <>
      <div className="ae-section-heading">
        <div>
          <p className="ae-kicker">Membership</p>
          <h1 className="ae-page-title mt-3">Announcements</h1>
        </div>
        <button className="gold-button" onClick={() => setEditing("new")}>New announcement</button>
      </div>
      <p className="body-copy mb-6">Short news for paid members. Published announcements appear on every member’s account page, with pinned ones first. Drafts stay hidden.</p>

      {list.isPending ? <p role="status">Loading…</p>
        : list.isError ? <p role="alert">Could not load announcements. <button className="ae-text-button" onClick={() => list.refetch()}>Retry</button></p>
        : rows.length === 0 ? <div className="ae-empty">No announcements yet. Press “New announcement” to write the first one.</div>
        : (
          <div className="ae-inbox-list">
            {rows.map((r) => (
              <button key={r.id} className="ae-inbox-row" onClick={() => setEditing(r)}>
                <strong>{r.pinned && <Pin size={14} className="inline mr-1" aria-label="Pinned" />}{r.title}</strong>
                <span><span className={`ae-badge ${r.published ? "ae-badge-green" : "ae-badge-muted"}`}>{r.published ? "Published" : "Draft"}</span></span>
                <small>{formatDate(r.published_at)}</small>
              </button>
            ))}
          </div>
        )}

      {editing && <Editor userId={userId} row={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}

function Editor({ userId, row, onClose }: { userId: string; row: Row | undefined; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useModal(ref, onClose);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [pinned, setPinned] = useState(row?.pinned ?? false);
  const [published, setPublished] = useState(row?.published ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", userId] });
    await queryClient.invalidateQueries({ queryKey: ["dash-announcements"] });
  }

  async function save() {
    if (busy) return;
    const t = title.trim();
    const b = body.trim();
    if (!t) { setError("Give the announcement a title."); return; }
    if (t.length > 160) { setError("The title is too long (160 characters maximum)."); return; }
    if (!b) { setError("Write the announcement text."); return; }
    if (b.length > 3000) { setError("The text is too long (3000 characters maximum)."); return; }
    setBusy(true);
    setError("");
    try {
      const client = getSupabaseClient();
      if (!row) {
        const { error: e } = await client.from("announcements").insert({ title: t, body: b, pinned, published });
        if (e) throw e;
      } else {
        // Publishing a draft for the first time shows it as new today.
        const stamp = !row.published && published ? { published_at: new Date().toISOString() } : {};
        const { error: e } = await client.from("announcements").update({ title: t, body: b, pinned, published, ...stamp }).eq("id", row.id);
        if (e) throw e;
      }
      await refresh();
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!row || busy) return;
    if (!window.confirm(`Delete “${row.title}”? Members will no longer see it.`)) return;
    setBusy(true);
    setError("");
    try {
      const { error: e } = await getSupabaseClient().from("announcements").delete().eq("id", row.id);
      if (e) throw e;
      await refresh();
      onClose();
    } catch {
      setError("Could not delete. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="ae-drawer-backdrop">
      <aside ref={ref} className="ae-drawer" role="dialog" aria-modal="true" aria-label={row ? "Edit announcement" : "New announcement"}>
        <div className="ae-drawer-head">
          <h2>{row ? "Edit announcement" : "New announcement"}</h2>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="ae-drawer-body ae-settings">
          <label className="ae-field">Title
            <input className="ae-input ae-field-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </label>
          <label className="ae-field">Text
            <textarea className="ae-input ae-field-input" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
          </label>
          <p className="ae-hint">{body.length}/3000</p>
          <label className="ae-toggle-row"><span>Pin to the top</span><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /></label>
          <label className="ae-toggle-row"><span>Published (visible to paid members)</span><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /></label>
          {error && <p className="ae-inline-error" role="alert">{error}</p>}
        </div>
        <div className="ae-drawer-foot">
          <div className="ae-review-actions">
            <button className="gold-button" disabled={busy} onClick={save}>{busy ? "Saving…" : published ? "Save and publish" : "Save draft"}</button>
            {row && <button className="outline-button" disabled={busy} onClick={remove}>Delete</button>}
          </div>
        </div>
      </aside>
    </div>
  );
}
