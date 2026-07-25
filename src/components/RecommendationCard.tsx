import type { DinerProfile, Recommendation, Restaurant } from "@/domain/contracts";
import { checkDishAgainstDiner } from "@/lib/compatibility";

interface RecommendationCardProps {
  recommendation: Recommendation;
  previousRecommendation: Recommendation | null;
  restaurants: Restaurant[];
  diners: DinerProfile[];
}

export function RecommendationCard({
  recommendation,
  previousRecommendation,
  restaurants,
  diners,
}: RecommendationCardProps) {
  const restaurant = restaurants.find((r) => r.id === recommendation.restaurantId);
  const alternative = restaurants.find(
    (r) => r.id === recommendation.alternativeRestaurantId,
  );
  const restaurantChanged =
    previousRecommendation !== null &&
    previousRecommendation.restaurantId !== recommendation.restaurantId;

  if (!restaurant) return null;

  return (
    <div className="recommendationCard">
      <div className={`recommendationHeader ${restaurantChanged ? "isChanged" : ""}`}>
        <div>
          <span className="versionTag">Version {recommendation.version}</span>
          <h2>{restaurant.name}</h2>
          <p className="cuisine">{restaurant.cuisine}</p>
        </div>
        <div className="recommendationTotals">
          <div>
            <span className="totalsLabel">Total</span>
            <strong>${recommendation.total}</strong>
          </div>
          <div>
            <span className="totalsLabel">ETA</span>
            <strong>{recommendation.etaMinutes} min</strong>
          </div>
        </div>
      </div>

      <p className="recommendationExplanation">{recommendation.explanation}</p>

      <div className="selectionList">
        {recommendation.selections.map((selection) => {
          const diner = diners.find((d) => d.id === selection.dinerId);
          const dish = restaurant.menu.find((d) => d.id === selection.dishId);
          if (!diner || !dish) return null;

          const previousSelection = previousRecommendation?.selections.find(
            (s) => s.dinerId === selection.dinerId,
          );
          const dishChanged =
            previousRecommendation !== null &&
            previousSelection?.dishId !== selection.dishId;

          const checks = checkDishAgainstDiner(dish, diner);

          return (
            <article
              key={selection.dinerId}
              className={`selectionRow ${dishChanged ? "isChanged" : ""}`}
            >
              <div className="selectionDiner">
                <span className={`avatar avatar--${diner.id}`}>{diner.initials}</span>
                <span>{diner.name}</span>
              </div>
              <div className="selectionDish">
                <strong>{dish.name}</strong>
                <span className="selectionPrice">${selection.price}</span>
                <p className="selectionReason">{selection.reason}</p>
                <ul className="checkList">
                  {checks.map((check) => (
                    <li
                      key={check.label}
                      className={check.satisfied ? "check--pass" : "check--fail"}
                    >
                      <span aria-hidden="true">{check.satisfied ? "✓" : "✗"}</span>
                      {check.label} — {check.detail}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      {alternative && (
        <p className="alternativeNote">Alternative: {alternative.name}</p>
      )}

      {recommendation.changes.length > 0 && (
        <div className="changeSummary">
          <h3>What changed</h3>
          <ul>
            {recommendation.changes.map((change) => (
              <li key={change.summary}>{change.summary}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
