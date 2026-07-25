import type { DinerProfile } from "@/domain/contracts";
import { activeBeliefs, beliefLabel } from "./lib/compatibility";

interface DinerRosterProps {
  diners: DinerProfile[];
  presentIds: string[];
  onTogglePriya?: () => void;
}

export function DinerRoster({ diners, presentIds, onTogglePriya }: DinerRosterProps) {
  return (
    <div className="dinerRoster">
      {diners.map((diner) => {
        const present = presentIds.includes(diner.id);
        const constraints = activeBeliefs(diner).map(beliefLabel);
        const isPriya = diner.id === "priya";
        const interactive = isPriya && Boolean(onTogglePriya);

        const card = (
          <>
            <span className={`avatar avatar--${diner.id}`}>{diner.initials}</span>
            <div>
              <h3>{diner.name}</h3>
              <p>{constraints.join(" · ") || "No active constraint"}</p>
            </div>
            {isPriya && (
              <span className={`seatBadge ${present ? "seatBadge--in" : "seatBadge--out"}`}>
                {present ? "At the table" : "Tap to add"}
              </span>
            )}
          </>
        );

        if (interactive) {
          return (
            <button
              type="button"
              key={diner.id}
              className={`dinerCard dinerCard--interactive ${present ? "dinerCard--present" : ""}`}
              onClick={onTogglePriya}
              aria-pressed={present}
            >
              {card}
            </button>
          );
        }

        return (
          <article
            key={diner.id}
            className={`dinerCard ${present ? "dinerCard--present" : "dinerCard--absent"}`}
          >
            {card}
          </article>
        );
      })}
    </div>
  );
}
