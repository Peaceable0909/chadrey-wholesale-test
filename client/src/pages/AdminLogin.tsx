import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured, isGoogleSignInAvailable } from "@/lib/firebase";
import { formatFirebaseAuthError } from "@/lib/authErrors";
import { trpc } from "@/lib/trpc";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = firebaseAuth();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const result = await me.refetch();
      if (result.data?.role === "admin") navigate("/admin");
    });
  }, [me, navigate]);

  async function confirmAdmin(user: FirebaseUser) {
    const result = await me.refetch();
    const profile = result.data;
    if (profile?.role !== "admin") {
      await signOut(firebaseAuth());
      throw new Error("This Firebase account does not have administrator access.");
    }
    navigate("/admin");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!isFirebaseConfigured()) throw new Error("Firebase is not configured for this environment.");
      const result = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      await confirmAdmin(result.user);
    } catch (caught) {
      setError(formatFirebaseAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      if (!isGoogleSignInAvailable()) throw new Error("Firebase Google sign-in is not configured for this environment.");
      const result = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      await confirmAdmin(result.user);
    } catch (caught) {
      setError(formatFirebaseAuthError(caught));
    } finally {
      setGoogleBusy(false);
    }
  }

  if (!isFirebaseConfigured()) {
    return <main className="confirmation-page">
      <Link href="/" className="back-link">← Back to Chadrey Wholesale</Link>
      <div className="document-card" style={{ maxWidth: 480, width: "100%" }}>
        <span className="eyebrow">ADMIN OPERATIONS</span>
        <h1>Admin sign-in is not configured.</h1>
        <p>Add the `VITE_FIREBASE_*` environment variables to this deployment, then reload the page.</p>
      </div>
    </main>;
  }

  return (
    <main className="confirmation-page">
      <Link href="/" className="back-link">← Back to Chadrey Wholesale</Link>
      <div className="document-card" style={{ maxWidth: 480, width: "100%" }}>
        <span className="eyebrow">ADMIN OPERATIONS</span>
        <h1>Operations sign in.</h1>
        <p>Use the Firebase account that has been granted Chadrey Wholesale administrator access.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
          <input className="form-input" type="email" placeholder="Administrator email" value={email} onChange={event => setEmail(event.target.value)} required />
          <input className="form-input" type="password" placeholder="Password" value={password} onChange={event => setPassword(event.target.value)} required />
          {error && <p role="alert" style={{ color: "#a53b2a", margin: 0 }}>{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy || googleBusy}>{busy ? "Checking access…" : "Sign in to operations"}</button>
        </form>
        <div className="login-divider"><span>or</span></div>
        <button className="google-login-button" type="button" onClick={continueWithGoogle} disabled={busy || googleBusy}>
          <span className="google-mark">G</span>
          {googleBusy ? "Checking access…" : "Continue with Google"}
        </button>
        <p style={{ color: "#7b8982", fontSize: 12, margin: "18px 0 0" }}>Admin access is restricted. Customer accounts remain in the customer workspace.</p>
      </div>
    </main>
  );
}
