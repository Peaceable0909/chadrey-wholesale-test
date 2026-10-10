import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AuthShell, GoogleMark } from "@/components/auth/AuthShell";
import { Badge, Button, Field, Notice, TextInput } from "@/components/ios";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatAuthError } from "@/lib/authErrors";
import { getSupabaseClient, isGoogleSignInAvailable, isSupabaseConfigured } from "@/lib/supabase";
import { getOrCreateSupabaseProfile, type SupabaseProfile } from "@/lib/userProfile";

export default function AdminLogin() {
  usePageTitle("Admin sign in");
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const profile = await getOrCreateSupabaseProfile(data.session.user);
      if (profile.role === "admin") navigate("/admin");
    }).catch(() => undefined);
  }, [navigate]);

  async function confirmAdmin(profilePromise: Promise<SupabaseProfile>) {
    const profile = await profilePromise;
    if (profile.role !== "admin") {
      await getSupabaseClient().auth.signOut();
      throw new Error("This account does not have administrator access.");
    }
    navigate("/admin");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase is not configured for this environment.");
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("No signed-in account was returned.");
      await confirmAdmin(getOrCreateSupabaseProfile(data.user));
    } catch (caught) {
      setError(formatAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      if (!isGoogleSignInAvailable()) throw new Error("Supabase is not configured for this environment.");
      const { error: signInError } = await getSupabaseClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/admin/login` } });
      if (signInError) throw signInError;
    } catch (caught) {
      setError(formatAuthError(caught));
      setGoogleBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <main className="min-h-dvh">
        <AuthShell title="Admin sign-in is not configured" badge={<Badge tone="blue">Admin</Badge>} description="Add the Supabase browser variables to this deployment, then reload the page.">
          <Link href="/" className="block text-center text-subhead text-tint-text">
            Back to store
          </Link>
        </AuthShell>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <AuthShell title="Operations sign in" badge={<Badge tone="blue">Admin</Badge>} description="Use the account that has been granted administrator access.">
        <form onSubmit={submit} className="space-y-4 rounded-group bg-surface p-4">
          <Field label="Administrator email">
            <TextInput type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password">
            <TextInput type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          </Field>
          {error && <Notice tone="red">{error}</Notice>}
          <Button type="submit" size="lg" full loading={busy} disabled={googleBusy}>
            Sign in
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-footnote text-label-2" aria-hidden>
          <span className="h-px flex-1 bg-separator" />
          or
          <span className="h-px flex-1 bg-separator" />
        </div>
        <Button variant="outline" size="lg" full onClick={continueWithGoogle} loading={googleBusy} disabled={busy}>
          {!googleBusy && <GoogleMark />}
          Continue with Google
        </Button>
        <p className="mt-6 text-center text-footnote text-label-2">Admin access is restricted. Customer accounts stay in the customer area.</p>
        <Link href="/" className="mt-3 block text-center text-subhead text-tint-text">
          Back to store
        </Link>
      </AuthShell>
    </main>
  );
}
