import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient, supabaseConfig } from "@/lib/supabase/client";
import { getMyMembership } from "@/lib/supabase/membership";

/* One shared sign-in state for the whole page, so many components can ask
   "who is signed in?" without each opening its own listener. */
type SessionState = { loading: boolean; user: User | null };

let state: SessionState = { loading: supabaseConfig.isConfigured, user: null };
const listeners = new Set<() => void>();
let started = false;

function emit(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started || !supabaseConfig.isConfigured) return;
  started = true;
  const client = getSupabaseClient();
  client.auth.getSession().then(({ data }) => emit({ loading: false, user: data.session?.user ?? null }));
  client.auth.onAuthStateChange((_event, session) => emit({ loading: false, user: session?.user ?? null }));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Who is signed in on the public site. Cheap: no database calls. */
export function useMemberSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** The signed-in person's membership status (pending, active, grace, expired, suspended). */
export function useMembership(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["membership", userId],
    queryFn: getMyMembership,
    enabled: Boolean(userId),
    staleTime: 20_000,
    retry: 1,
  });
}

/** Everything a page needs to decide what a visitor may see. */
export function useMemberAccess() {
  const session = useMemberSession();
  const membership = useMembership(session.user?.id);
  const waiting = session.loading || (Boolean(session.user) && membership.isPending);
  return {
    loading: waiting,
    signedIn: Boolean(session.user),
    membership: membership.data,
    hasAccess: membership.data?.hasAccess === true,
    failed: Boolean(session.user) && membership.isError,
    retry: () => void membership.refetch(),
  };
}
