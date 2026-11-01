import { useEffect, useRef, useState, type FormEvent } from "react";
import { RECEIPT_ACCEPT, submitReceipt, validateReceiptFile } from "@/lib/supabase/membership";

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ReceiptForm({
  userId, submitLabel, onSubmitted,
}: { userId: string; submitLabel: string; onSubmitted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
    return undefined;
  }, [file]);

  function choose(chosen: File | null) {
    setError("");
    if (!chosen) { setFile(null); return; }
    const problem = validateReceiptFile(chosen);
    if (problem) { setFile(null); setError(problem); if (input.current) input.current.value = ""; return; }
    setFile(chosen);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      await submitReceipt(userId, file, note);
      setFile(null);
      setNote("");
      if (input.current) input.current.value = "";
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not submit your receipt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="public-form member-form receipt-form" onSubmit={onSubmit} aria-label="Upload payment receipt">
      <label className="receipt-drop">
        <span className="receipt-drop-title">{file ? "Change file" : "Choose your receipt"}</span>
        <span className="member-hint">PDF, JPG, PNG or WebP · up to 10 MB</span>
        <input ref={input} type="file" accept={RECEIPT_ACCEPT} onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <div className="receipt-chosen" role="status">
          {preview ? <img src={preview} alt="Preview of your receipt" /> : <span className="receipt-pdf" aria-hidden="true">PDF</span>}
          <div>
            <strong>{file.name}</strong>
            <span className="member-hint">{sizeLabel(file.size)}</span>
          </div>
        </div>
      )}
      <label>
        Note for the admin (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="For example, the bank you paid from or the name on the transfer." />
      </label>
      {error && <p className="member-error" role="alert">{error}</p>}
      <button className="gold-button" disabled={!file || busy}>{busy ? "Uploading…" : submitLabel}</button>
    </form>
  );
}
