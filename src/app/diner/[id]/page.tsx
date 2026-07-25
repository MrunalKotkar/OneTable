"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { DinerProfile, GroupMealSummary } from "@/domain/contracts";
import { FreshSessionPanel } from "@/components/FreshSessionPanel";
import { fetchDinerProfile } from "@/lib/api";

export default function DinerProfilePage() {
  const params = useParams<{ id: string }>();
  const dinerId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [diner, setDiner] = useState<DinerProfile | null>(null);
  const [history, setHistory] = useState<GroupMealSummary[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchDinerProfile(dinerId).then((result) => {
      if (!result) {
        setNotFound(true);
        return;
      }
      setDiner(result.diner);
      setHistory(result.history);
    });
  }, [dinerId]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            1T
          </span>
          <div>
            <strong>OneTable</strong>
            <span>MenuSifu Track 1</span>
          </div>
        </div>
        <span className="status">new session</span>
      </header>

      <section className="workspace">
        <div className="intro intro--compact">
          <p className="eyebrow">Brand-new browser session</p>
          <h1>Your profile</h1>
        </div>

        {notFound && (
          <p className="inlineHint">
            No diner named &quot;{dinerId}&quot; on file. <Link href="/">Go home</Link>.
          </p>
        )}

        {diner && <FreshSessionPanel diners={[diner]} history={history} revision={null} />}
      </section>
    </main>
  );
}
