import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";

export type AuthState = {
  event: AuthChangeEvent | "INITIAL_SESSION";
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
};

export async function signInWithPassword(email: string, password: string) {
  const client = getSupabaseClient();
  return client.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const client = getSupabaseClient();
  return client.auth.signOut();
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  return client.auth.getSession();
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("is_current_user_admin");

  if (error) {
    throw new Error(`Unable to verify administrator access: ${error.message}`);
  }

  return data === true;
}

export async function getCurrentAuthState(): Promise<AuthState> {
  const {
    data: { session },
  } = await getCurrentSession();

  return {
    event: "INITIAL_SESSION",
    session,
    user: session?.user ?? null,
    isAdmin: session ? await isCurrentUserAdmin() : false,
  };
}

export function subscribeToAuthChanges(
  callback: (state: AuthState) => void,
  onError?: (error: Error) => void,
) {
  const client = getSupabaseClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, session) => {
    void (async () => {
      try {
        callback({
          event,
          session,
          user: session?.user ?? null,
          isAdmin: session ? await isCurrentUserAdmin() : false,
        });
      } catch (error) {
        onError?.(
          error instanceof Error
            ? error
            : new Error("Unable to resolve administrator access."),
        );
      }
    })();
  });

  return () => subscription.unsubscribe();
}