import type { DinerProfile } from "@/domain/contracts";
import { activeBeliefs, beliefLabel } from "@/lib/compatibility";

interface IdentityPickerProps {
  diners: DinerProfile[];
  seatedIds: string[];
  onPick: (dinerId: string) => void;
  busy?: boolean;
}

export function IdentityPicker({ diners, seatedIds, onPick, busy }: IdentityPickerProps) {
  return (
    <div className="identityPicker">
      <p className="identityPickerHint">
        Tap the profile that&apos;s yours. If you&apos;re not on the list yet, tap your
        name to join the table.
      </p>
      <div className="dinerRoster">
        {diners.map((diner) => {
          const seated = seatedIds.includes(diner.id);
          const constraints = activeBeliefs(diner).map(beliefLabel);
          return (
            <button
              type="button"
              key={diner.id}
              className="dinerCard dinerCard--interactive"
              onClick={() => onPick(diner.id)}
              disabled={busy}
            >
              <span className={`avatar avatar--${diner.id}`}>{diner.initials}</span>
              <div>
                <h3>{diner.name}</h3>
                <p>{constraints.join(" · ") || "No active constraint"}</p>
              </div>
              <span className={`seatBadge ${seated ? "seatBadge--in" : "seatBadge--out"}`}>
                {seated ? "I'm them" : "Join as them"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
