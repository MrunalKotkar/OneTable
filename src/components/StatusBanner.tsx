import type { Phase } from "@/lib/phase";

interface StatusBannerProps {
  phase: Phase;
  /** Specific reason from the failed attempt, when there is one. */
  message?: string | null;
  onRetry?: () => void;
}

const COPY: Record<Phase, { label: string; tone: string } | null> = {
  idle: null,
  recalling: { label: "Recalling group context…", tone: "info" },
  negotiating: { label: "Negotiating a table order…", tone: "info" },
  ready: { label: "Recommendation ready", tone: "success" },
  revising_belief: { label: "Saving Jordan's correction…", tone: "info" },
  rebalancing: { label: "Rebalancing the order…", tone: "info" },
  no_feasible_result: {
    label: "No feasible result — active constraints can't be satisfied by the current catalog.",
    tone: "warning",
  },
  error: { label: "The memory service didn't respond.", tone: "danger" },
};

export function StatusBanner({ phase, message, onRetry }: StatusBannerProps) {
  const copy = COPY[phase];
  if (!copy) return null;

  const showsMessage = phase === "no_feasible_result" || phase === "error";

  return (
    <div className={`statusBanner statusBanner--${copy.tone}`} role="status">
      {(phase === "recalling" ||
        phase === "negotiating" ||
        phase === "revising_belief" ||
        phase === "rebalancing") && <span className="statusSpinner" aria-hidden="true" />}
      <span>{showsMessage && message ? message : copy.label}</span>
      {phase === "error" && onRetry && (
        <button type="button" className="statusRetry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
