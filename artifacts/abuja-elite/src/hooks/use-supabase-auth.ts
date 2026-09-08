import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, SupabaseConfigurationError } from '@/lib/supabase/client';
export type SupabaseAuthState = { status: 'loading'|'authenticated'|'unauthenticated'|'error'; session: Session|null; user: User|null; isAdmin: boolean; error: Error|null; retry: () => void; userId: string|null };
const initial = { status: 'loading' as const, session: null, user: null, isAdmin: false, error: null, userId: null as string|null };
export function useSupabaseAuth(): SupabaseAuthState {
  const [state,setState] = useState<Omit<SupabaseAuthState,'retry'>>(initial);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let alive = true, generation = 0;
    let cancel = () => {}; let abort: AbortController|undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    try {
      const client = getSupabaseClient();
      const accept = (session: Session|null) => {
        const ticket = ++generation; abort?.abort();
        if (!alive) return;
        setState({ ...initial, status: session ? 'authenticated' : 'unauthenticated', session, user: session?.user ?? null, isAdmin: false, error: null, userId: session?.user?.id ?? null });
        if (!session) return;
        // Leave the auth callback before asking the client for an authenticated RPC.
        const timer = setTimeout(async () => {
          timers.delete(timer); if (!alive || ticket !== generation) return;
          const controller = new AbortController(); abort = controller;
          const timeout = setTimeout(() => controller.abort(),15000);
          try {
            const {data,error} = await client.rpc('is_current_user_admin').abortSignal(controller.signal);
            if (error) throw error;
            if (alive && ticket === generation) setState({status:'authenticated',session,user:session.user,isAdmin:data===true,error:null,userId:session.user.id});
          } catch {
            if (alive && ticket === generation) setState({status:'error',session,user:session.user,isAdmin:false,error:new Error('Unable to verify access. Check your connection and retry.'),userId:session.user.id});
          } finally { clearTimeout(timeout); }
        },0); timers.add(timer);
      };
      const {data:{subscription}} = client.auth.onAuthStateChange((_event,session) => accept(session));
      cancel = () => subscription.unsubscribe();
      void client.auth.getSession().then(({data,error}) => {
        if (!alive || generation !== 0) return;
        if (error) throw error;
        accept(data.session);
      }).catch(() => { if(alive && generation===0) setState({...initial,status:'error',error:new Error('Unable to restore your session.'),userId:null}); });
    } catch(error) { setState({...initial,status:'error',error:error instanceof Error ? error : new Error('Authentication unavailable.'),userId:null}); }
    return () => {alive=false;generation++;abort?.abort();timers.forEach(clearTimeout);cancel();};
  },[attempt]);
  const retry=useCallback(()=>{setState(initial);setAttempt(n=>n+1);},[]);
  return {...state,retry};
}
export function isSupabaseConfigurationError(error:Error|null){return error instanceof SupabaseConfigurationError;}
