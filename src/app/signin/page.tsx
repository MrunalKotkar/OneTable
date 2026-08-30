"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Incorrect email or password.");
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
            <span>Sign in</span>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="intro intro--compact">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in</h1>
        </div>

        <section className="panel" aria-labelledby="signin-title">
          <div className="panelHeading">
            <h2 id="signin-title">Email and password</h2>
          </div>
          <div className="panelBody">
            <form onSubmit={submit}>
              <input
                className="intentInput"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email"
                autoComplete="email"
                autoFocus
              />
              <input
                className="intentInput"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
              />
              <button type="submit" className="primaryButton" disabled={busy || !email || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              {error && <p className="checkoutFailed">{error}</p>}
            </form>
            <p className="inlineHint">
              No account yet?{" "}
              <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Create one</Link>.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
