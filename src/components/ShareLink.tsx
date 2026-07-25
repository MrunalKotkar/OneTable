"use client";

import { useState } from "react";

interface ShareLinkProps {
  tableId: string;
}

export function ShareLink({ tableId }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/table/${tableId}`
      : `/table/${tableId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context); the
      // link is still selectable as plain text.
    }
  };

  return (
    <div className="shareLink">
      <div>
        <span className="eyebrow">Table link</span>
        <p className="shareLinkUrl">{url}</p>
      </div>
      <button type="button" className="secondaryButton" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
