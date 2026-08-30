"use client";

import { useState } from "react";
import type { BeliefKind } from "@/domain/contracts";

interface BeliefCorrectionFormProps {
  busy: boolean;
  onSubmit: (kind: BeliefKind, value: string | number, correctionText: string) => void;
}

const KIND_OPTIONS: { value: BeliefKind; label: string; placeholder: string }[] = [
  { value: "allergy", label: "Allergy", placeholder: "e.g. shellfish" },
  { value: "diet", label: "Diet", placeholder: "e.g. vegetarian" },
  { value: "budget", label: "Budget", placeholder: "e.g. 20" },
  { value: "goal", label: "Goal", placeholder: "e.g. high protein" },
  { value: "preference", label: "Preference", placeholder: "e.g. spicy food" },
  { value: "dislike", label: "Dislike", placeholder: "e.g. cilantro" },
];

/**
 * Replaces the demo's hardcoded "Correct my belief to shellfish allergy"
 * button (Phase 5) — any signed-in, seated diner can correct any belief
 * kind now that there's no fixed cast to hardcode against.
 */
export function BeliefCorrectionForm({ busy, onSubmit }: BeliefCorrectionFormProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BeliefKind>("allergy");
  const [value, setValue] = useState("");
  const [correctionText, setCorrectionText] = useState("");

  const kindOption = KIND_OPTIONS.find((option) => option.value === kind)!;

  if (!open) {
    return (
      <button type="button" className="secondaryButton" onClick={() => setOpen(true)} disabled={busy}>
        Correct a belief
      </button>
    );
  }

  const submit = () => {
    if (!value.trim()) return;
    const finalValue = kind === "budget" ? Number(value) : value.trim();
    const text = correctionText.trim() || `Actually, ${kindOption.label.toLowerCase()}: ${finalValue}.`;
    onSubmit(kind, finalValue, text);
    setOpen(false);
    setValue("");
    setCorrectionText("");
  };

  return (
    <div className="adminForm" role="form" aria-label="Correct a belief">
      <select value={kind} onChange={(event) => setKind(event.target.value as BeliefKind)}>
        {KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        className="intentInput"
        type={kind === "budget" ? "number" : "text"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={kindOption.placeholder}
        aria-label={`New ${kindOption.label.toLowerCase()} value`}
      />
      <input
        className="intentInput"
        type="text"
        value={correctionText}
        onChange={(event) => setCorrectionText(event.target.value)}
        placeholder={`Optional note (e.g. "Actually I'm allergic to shellfish")`}
        aria-label="Correction note"
      />
      <button type="button" className="primaryButton" onClick={submit} disabled={busy || !value.trim()}>
        Save correction
      </button>
      <button type="button" className="secondaryButton" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </button>
    </div>
  );
}
