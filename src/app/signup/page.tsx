"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const signupRes = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const signupBody = await signupRes.json().catch(() => null);
    if (!signupRes.ok) {
      setError(signupBody?.message ?? "Could not create account.");
      setBusy(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Account created, but sign-in failed — try signing in.");
      setBusy(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            1T
          </span>
          <div>
            <strong>OneTable</strong>
            <span>Create account</span>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="intro intro--compact">
          <p className="eyebrow">Get started</p>
          <h1>Create your account</h1>
        </div>

        <section className="panel" aria-labelledby="signup-title">
          <div className="panelHeading">
            <h2 id="signup-title">Name, email, password</h2>
          </div>
          <div className="panelBody">
            <form onSubmit={submit}>
              <input
                className="intentInput"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                aria-label="Name"
                autoComplete="name"
                autoFocus
              />
              <input
                className="intentInput"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email"
                autoComplete="email"
              />
              <input
                className="intentInput"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password (min. 8 characters)"
                aria-label="Password"
                autoComplete="new-password"
              />
              <button
                type="submit"
                className="primaryButton"
                disabled={busy || !name || !email || !password}
              >
                {busy ? "Creating account…" : "Create account"}
              </button>
              {error && <p className="checkoutFailed">{error}</p>}
            </form>
            <p className="inlineHint">
              Already have an account?{" "}
              <Link href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link>.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
