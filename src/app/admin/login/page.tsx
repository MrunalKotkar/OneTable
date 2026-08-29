"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/restaurants");
      return;
    }

    const data = await res.json().catch(() => null);
    setError(data?.message ?? "Sign-in failed.");
    setBusy(false);
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
            <span>Admin</span>
          </div>
        </div>
        <span className="status">catalog admin</span>
      </header>

      <section className="workspace">
        <div className="intro intro--compact">
          <p className="eyebrow">Restricted</p>
          <h1>Admin sign-in</h1>
          <p>
            Temporary shared-password gate for the restaurant catalog. Replaced
            by real sign-in once accounts land.
          </p>
        </div>

        <section className="panel" aria-labelledby="login-title">
          <div className="panelHeading">
            <div>
              <h2 id="login-title">Enter admin password</h2>
            </div>
          </div>
          <div className="panelBody">
            <form onSubmit={submit}>
              <input
                className="intentInput"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Admin password"
                aria-label="Admin password"
                autoFocus
              />
              <button type="submit" className="primaryButton" disabled={busy || !password}>
                {busy ? "Checking…" : "Sign in"}
              </button>
              {error && <p className="checkoutFailed">{error}</p>}
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
