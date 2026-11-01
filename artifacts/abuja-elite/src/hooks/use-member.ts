import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient, supabaseConfig } from "@/lib/supabase/client";
import { getMyMembership } from "@/lib/supabase/membership";

/** Who is signed in on the public site. Cheap: no database calls. */
export function useMemberSession() {
  const [state, setState] = useState<{ loading: boolean; user: User | null }>({
    loading: supabaseConfig.isConfigured,
    user: null,
  });

  useEffect(() => {
    if (!supabaseConfig.isConfigured) return undefined;
    let alive = true;
    const client = getSupabaseClient();
    client.auth.getSession().then(({ data }) => {
      if (alive) setState({ loading: false, user: data.session?.user ?? null });
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) setState({ loading: false, user: session?.user ?? null });
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
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
