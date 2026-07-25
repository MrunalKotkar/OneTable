import type { BeliefRevision, DinerProfile } from "@/domain/contracts";
import { beliefLabel } from "@/lib/compatibility";

interface BeliefRevisionPanelProps {
  revision: BeliefRevision;
  diner: DinerProfile | undefined;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function BeliefRevisionPanel({ revision, diner }: BeliefRevisionPanelProps) {
  return (
    <section className="revisionPanel" aria-label="Belief revision history">
      <h3>Belief update — {diner?.name ?? revision.dinerId}</h3>
      <div className="revisionRow">
        <span className="revisionPrevious">{beliefLabel(revision.previous)}</span>
        <span className="revisionArrow" aria-hidden="true">
          →
        </span>
        <span className="revisionCurrent">{beliefLabel(revision.current)}</span>
      </div>
      <p className="revisionMeta">
        Updated now · {formatTime(revision.current.updatedAt)}
      </p>
    </section>
  );
}
