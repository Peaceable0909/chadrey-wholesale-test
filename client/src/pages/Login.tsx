import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const auth = firebaseAuth();
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replace("Firebase: ", "") : "Unable to authenticate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="confirmation-page">
      <Link href="/" className="back-link">← Back to Chadrey Wholesale</Link>
      <div className="document-card" style={{ maxWidth: 480, width: "100%" }}>
        <span className="eyebrow">CUSTOMER ACCESS</span>
        <h1>{mode === "signin" ? "Welcome back." : "Create your workspace."}</h1>
        <p>Use your secure Firebase account to manage quotes, invoices, payments, and deliveries.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {mode === "signup" && <input className="form-input" placeholder="Full name" value={name} onChange={event => setName(event.target.value)} required />}
          <input className="form-input" type="email" placeholder="Business email" value={email} onChange={event => setEmail(event.target.value)} required />
          <input className="form-input" type="password" placeholder="Password (at least 6 characters)" value={password} onChange={event => setPassword(event.target.value)} minLength={6} required />
          {error && <p role="alert" style={{ color: "#a53b2a", margin: 0 }}>{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="text-link" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} style={{ marginTop: 18 }}>
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
