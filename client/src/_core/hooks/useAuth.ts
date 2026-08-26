import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getOrCreateSupabaseProfile, type SupabaseProfile } from "@/lib/userProfile";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [user, setUser] = useState<SupabaseProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const { data, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      const nextUser = data.session?.user ? await getOrCreateSupabaseProfile(data.session.user) : null;
      setUser(nextUser);
      setError(null);
      return nextUser;
    } catch (caught) {
      setUser(null);
      setError(caught);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const client = getSupabaseClient();
    void refresh();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      void getOrCreateSupabaseProfile(session.user)
        .then(profile => { setUser(profile); setError(null); })
        .catch(caught => { setUser(null); setError(caught); })
        .finally(() => setLoading(false));
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) await getSupabaseClient().auth.signOut();
    setUser(null);
  }, []);

  const state = useMemo(() => ({
    user,
    loading: loading,
    error,
    isAuthenticated: Boolean(user),
  }), [error, loading, user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [loading, redirectOnUnauthenticated, redirectPath, user]);

  return { ...state, refresh, logout };
}
