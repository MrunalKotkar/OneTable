import type { BeliefRevision, DinerProfile, GroupMealSummary } from "@/domain/contracts";
import { activeBeliefs, beliefLabel } from "@/lib/compatibility";

interface FreshSessionPanelProps {
  diners: DinerProfile[];
  history: GroupMealSummary[];
  revision: BeliefRevision | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FreshSessionPanel({ diners, history, revision }: FreshSessionPanelProps) {
  return (
    <div className="freshSession">
      <p className="freshSessionNote">
        New session opened. No onboarding was shown — every diner&apos;s current
        beliefs loaded from memory.
      </p>

      <div className="dinerRoster">
        {diners.map((diner) => {
          const corrected = revision !== null && diner.id === revision.dinerId;
          return (
            <article
              key={diner.id}
              className={`dinerCard dinerCard--present ${corrected ? "isChanged" : ""}`}
            >
              <span className={`avatar avatar--${diner.id}`}>{diner.initials}</span>
              <div>
                <h3>{diner.name}</h3>
                <p>{activeBeliefs(diner).map(beliefLabel).join(" · ")}</p>
                {corrected && (
                  <p className="freshSessionCorrectedTag">Corrected earlier this session</p>
                )}
                {diner.pastOrders.length > 0 && (
                  <ul className="pastOrderList">
                    {diner.pastOrders.map((order, index) => (
                      <li key={`${order.restaurant}-${order.dish}-${index}`}>
                        {order.liked ? "Liked" : "Didn't love"} {order.dish} at {order.restaurant}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="groupHistory" aria-label="Group meal history">
        <h3>Group history</h3>
        {history.length === 0 ? (
          <p>No previous meals on file.</p>
        ) : (
          <ul>
            {history.map((meal) => (
              <li key={`${meal.restaurant}-${meal.occurredAt}`}>
                <strong>{meal.restaurant}</strong>
                <span>{formatDate(meal.occurredAt)}</span>
                <span aria-label={`Rated ${meal.rating} out of 5`}>
                  {"★".repeat(meal.rating)}
                  {"☆".repeat(5 - meal.rating)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
