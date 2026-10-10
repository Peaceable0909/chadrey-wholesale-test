import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getOrCreateSupabaseProfile, type SupabaseProfile } from "@/lib/userProfile";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type AuthState = {
  user: SupabaseProfile | null;
  loading: boolean;
  error: unknown;
  isAuthenticated: boolean;
  refresh: () => Promise<SupabaseProfile | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Loads the signed-in profile once for the whole app. Every page reads the same result through
 * `useAuth()`, so navigating no longer repeats the session lookup (and the header avatar no longer flickers).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [error, setError] = useState<unknown>(null);
  const loadedUid = useRef<string | null>(null);

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
      loadedUid.current = nextUser?.uid ?? null;
      setUser(nextUser);
      setError(null);
      return nextUser;
    } catch (caught) {
      loadedUid.current = null;
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
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        loadedUid.current = null;
        setUser(null);
        setLoading(false);
        return;
      }
      // The initial session and token refreshes for an already-loaded user need no second profile write.
      if ((event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") && loadedUid.current === session.user.id) return;
      void getOrCreateSupabaseProfile(session.user)
        .then(profile => {
          loadedUid.current = profile.uid;
          setUser(profile);
          setError(null);
        })
        .catch(caught => {
          loadedUid.current = null;
          setUser(null);
          setError(caught);
        })
        .finally(() => setLoading(false));
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) await getSupabaseClient().auth.signOut();
    loadedUid.current = null;
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, error, isAuthenticated: Boolean(user), refresh, logout }),
    [error, loading, logout, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(options?: UseAuthOptions) {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const { loading, user } = context;

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [loading, redirectOnUnauthenticated, redirectPath, user]);

  return context;
}
