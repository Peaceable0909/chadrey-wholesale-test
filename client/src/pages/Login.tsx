import { FormEvent, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { AuthShell, GoogleMark } from "@/components/auth/AuthShell";
import { Button, Field, Notice, SegmentedControl, TextInput } from "@/components/ios";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatAuthError } from "@/lib/authErrors";
import { safeNextPath } from "@/lib/authRedirect";
import { getSupabaseClient, isGoogleSignInAvailable, isSupabaseConfigured } from "@/lib/supabase";
import { dashboardPathForRole, getOrCreateSupabaseProfile } from "@/lib/userProfile";

type Mode = "signin" | "signup" | "reset";

const COPY: Record<Mode, { title: string; description: string; action: string }> = {
  signin: { title: "Welcome back", description: "Sign in to see your quotes, orders and saved details.", action: "Sign in" },
  signup: { title: "Create your account", description: "Request quotes and track your orders in one place.", action: "Create account" },
  reset: { title: "Reset your password", description: "Enter your account email and we will send you a link to set a new password.", action: "Send reset link" },
};

export default function Login() {
  usePageTitle("Sign in");
  const [, navigate] = useLocation();
  const search = useSearch();
  const next = safeNextPath(search);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ tone: "red" | "green"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Already signed in (or just returned from Google): go straight to where they were headed.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void getSupabaseClient().auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const profile = await getOrCreateSupabaseProfile(data.session.user);
      navigate(next ?? dashboardPathForRole(profile.role));
    }).catch(() => undefined);
  }, [navigate, next]);

  const switchMode = (value: Mode) => {
    setMode(value);
    setNotice(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase is not configured for this environment.");
      const client = getSupabaseClient();
      if (mode === "reset") {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
        if (resetError) throw resetError;
        setNotice({ tone: "green", text: "If an account exists for that email, a reset link is on its way." });
        return;
      }
      if (mode === "signup") {
        const { error: signUpError } = await client.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
        if (signUpError) throw signUpError;
        setNotice({ tone: "green", text: "Account created. Check your email if confirmation is required, then sign in." });
        return;
      }
      const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      const { data: sessionData } = await client.auth.getSession();
      const profile = sessionData.session?.user ? await getOrCreateSupabaseProfile(sessionData.session.user) : null;
      navigate(next ?? dashboardPathForRole(profile?.role ?? "user"));
    } catch (caught) {
      setNotice({ tone: "red", text: formatAuthError(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setGoogleBusy(true);
    setNotice(null);
    try {
      if (!isGoogleSignInAvailable()) throw new Error("Supabase is not configured for this environment.");
      const redirectTo = `${window.location.origin}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      const { error: signInError } = await getSupabaseClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (signInError) throw signInError;
    } catch (caught) {
      setNotice({ tone: "red", text: formatAuthError(caught) });
      setGoogleBusy(false);
    }
  }

  const copy = COPY[mode];

  return (
    <SiteLayout footer={false}>
      <AuthShell title={copy.title} description={copy.description}>
        {mode !== "reset" && (
          <SegmentedControl
            aria-label="Sign in or create an account"
            className="mb-5"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />
        )}

        <form onSubmit={submit} className="space-y-4 rounded-group bg-surface p-4">
          {mode === "signup" && (
            <Field label="Full name">
              <TextInput autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" required />
            </Field>
          )}
          <Field label="Email">
            <TextInput type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required />
          </Field>
          {mode !== "reset" && (
            <Field label="Password">
              <TextInput
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </Field>
          )}
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <Button type="submit" size="lg" full loading={busy} disabled={googleBusy}>
            {copy.action}
          </Button>
          {mode === "signin" && (
            <button type="button" onClick={() => switchMode("reset")} className="mx-auto block text-subhead text-tint-text">
              Forgot password?
            </button>
          )}
          {mode === "reset" && (
            <button type="button" onClick={() => switchMode("signin")} className="mx-auto block text-subhead text-tint-text">
              Back to sign in
            </button>
          )}
        </form>

        {mode !== "reset" && (
          <>
            <div className="my-5 flex items-center gap-3 text-footnote text-label-2" aria-hidden>
              <span className="h-px flex-1 bg-separator" />
              or
              <span className="h-px flex-1 bg-separator" />
            </div>
            <Button variant="outline" size="lg" full onClick={continueWithGoogle} loading={googleBusy} disabled={busy}>
              {!googleBusy && <GoogleMark />}
              Continue with Google
            </Button>
          </>
        )}
      </AuthShell>
    </SiteLayout>
  );
}
