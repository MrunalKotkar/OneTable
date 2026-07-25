import type { DinerProfile } from "@/domain/contracts";
import { activeBeliefs, beliefLabel } from "@/lib/compatibility";

interface DinerRosterProps {
  diners: DinerProfile[];
  presentIds: string[];
  youId?: string | null;
}

export function DinerRoster({ diners, presentIds, youId }: DinerRosterProps) {
  return (
    <div className="dinerRoster">
      {diners.map((diner) => {
        const present = presentIds.includes(diner.id);
        const constraints = activeBeliefs(diner).map(beliefLabel);
        const isYou = diner.id === youId;

        return (
          <article
            key={diner.id}
            className={`dinerCard ${present ? "dinerCard--present" : "dinerCard--absent"}`}
          >
            <span className={`avatar avatar--${diner.id}`}>{diner.initials}</span>
            <div>
              <h3>{diner.name}</h3>
              <p>{constraints.join(" · ") || "No active constraint"}</p>
            </div>
            {isYou ? (
              <span className="seatBadge seatBadge--in">You</span>
            ) : (
              <span className={`seatBadge ${present ? "seatBadge--in" : "seatBadge--out"}`}>
                {present ? "At the table" : "Not joined"}
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
