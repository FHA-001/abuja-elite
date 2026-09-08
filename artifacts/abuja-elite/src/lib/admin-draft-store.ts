/**
 * In-memory draft store for admin forms.
 * Scoped by user ID, resource type, and record ID (or 'new' for new records).
 * Drafts are cleared on sign-out, account change, page refresh, or explicit closure.
 * Never persists to localStorage/sessionStorage or database.
 */

type DraftKey = `${string}|${string}|${string}`;
type DraftValue = Record<string, unknown>;

const drafts = new Map<DraftKey, DraftValue>();

/**
 * Get a draft key for a specific user, resource, and record.
 */
function getDraftKey(userId: string, resource: string, recordId: string | undefined): DraftKey {
  return `${userId}|${resource}|${recordId || 'new'}`;
}

/**
 * Get a draft if it exists.
 */
export function getDraft(userId: string, resource: string, recordId: string | undefined): DraftValue | null {
  const key = getDraftKey(userId, resource, recordId);
  return drafts.get(key) ?? null;
}

/**
 * Set a draft. Replaces any existing draft for the same key.
 */
export function setDraft(userId: string, resource: string, recordId: string | undefined, values: DraftValue): void {
  const key = getDraftKey(userId, resource, recordId);
  drafts.set(key, { ...values });
}

/**
 * Clear a specific draft.
 */
export function clearDraft(userId: string, resource: string, recordId: string | undefined): void {
  const key = getDraftKey(userId, resource, recordId);
  drafts.delete(key);
}

/**
 * Clear all drafts for a specific user (called on sign-out or account change).
 */
export function clearUserDrafts(userId: string): void {
  const prefix = `${userId}|`;
  for (const key of drafts.keys()) {
    if (key.startsWith(prefix)) {
      drafts.delete(key);
    }
  }
}

/**
 * Clear all drafts (called on page refresh - in-memory only).
 */
export function clearAllDrafts(): void {
  drafts.clear();
}

/**
 * Check if a draft exists for the given key.
 */
export function hasDraft(userId: string, resource: string, recordId: string | undefined): boolean {
  const key = getDraftKey(userId, resource, recordId);
  return drafts.has(key);
}

// Clear all drafts on page refresh (beforeunload event)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearAllDrafts();
  });
}
