"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { createTableRequest } from "@/lib/api";

export function HomeClient({ dinerName }: { dinerName: string }) {
  const router = useRouter();
  const [intent, setIntent] = useState("");
  const [creating, setCreating] = useState(false);

  const createTable = async () => {
    setCreating(true);
    const result = await createTableRequest(intent);
    if (result) {
      router.push(`/table/${result.id}`);
      return;
    }
    setCreating(false);
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
            <span>Group dining agent</span>
          </div>
        </div>
        <button type="button" className="secondaryButton" onClick={() => signOut()}>
          Sign out
        </button>
      </header>

      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">Welcome back, {dinerName}</p>
          <h1>One table. Current beliefs. One order.</h1>
          <p>
            OneTable recalls each diner&apos;s active constraints before it
            negotiates. Create a table, then share the link so everyone else
            can join from their own device.
          </p>
        </div>

        <section className="panel" aria-labelledby="intent-title">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">Dining intent</p>
              <h2 id="intent-title">What is the table looking for?</h2>
            </div>
          </div>
          <div className="panelBody">
            <input
              className="intentInput"
              type="text"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="quick lunch, around $20 each"
              aria-label="Dining intent"
            />
            <button
              type="button"
              className="primaryButton"
              onClick={createTable}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create table"}
            </button>
            <p className="inlineHint">
              Creates a table with you seated, and gives you a link to share
              with everyone else.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
