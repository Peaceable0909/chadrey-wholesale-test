import { startLogin } from "@/const";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { getOrCreateFirebaseProfile, type FirebaseProfile } from "@/lib/userProfile";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

const firebaseEnabled = isFirebaseConfigured();

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<FirebaseProfile | null>(null);
  const [firebaseError, setFirebaseError] = useState<unknown>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) {
      setFirebaseLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth(), user => {
      setFirebaseUser(user);
      if (!user) {
        setFirebaseProfile(null);
        setFirebaseError(null);
        setFirebaseLoading(false);
        return;
      }
      setFirebaseLoading(true);
      getOrCreateFirebaseProfile(user)
        .then(profile => {
          setFirebaseProfile(profile);
          setFirebaseError(null);
        })
        .catch(error => setFirebaseError(error))
        .finally(() => setFirebaseLoading(false));
    });
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !firebaseEnabled,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.setData(undefined, null),
  });

  const logout = useCallback(async () => {
    try {
      if (firebaseEnabled) await firebaseSignOut(firebaseAuth());
      else await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      throw error;
    } finally {
      try {
        sessionStorage.removeItem("manus-cookie");
        localStorage.removeItem("manus-runtime-user-info");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const user = (firebaseEnabled ? firebaseProfile : meQuery.data) ?? null;
  const state = useMemo(() => {
    try { localStorage.setItem("manus-runtime-user-info", JSON.stringify(user)); } catch {}
    return {
      user,
      loading: firebaseLoading || meQuery.isLoading || logoutMutation.isPending,
      error: firebaseError ?? meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [firebaseError, firebaseLoading, meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending, user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || state.loading || state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) window.location.href = redirectPath;
    else startLogin();
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  return { ...state, refresh: async () => { if (firebaseUser) setFirebaseProfile(await getOrCreateFirebaseProfile(firebaseUser)); else await meQuery.refetch(); }, logout };
}
