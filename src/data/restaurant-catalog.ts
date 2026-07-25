import type { Restaurant } from "@/domain/contracts";

/**
 * Deterministic restaurant catalog for the demo.
 *
 * This is the `restaurants: Restaurant[]` catalog the negotiation engine
 * (Person 2) receives in `RebalanceInput`. It is designed so the four-minute
 * story falls out of the HARD safety filters — not fragile scoring — so the
 * three recommendation versions are reproducible run to run.
 *
 * Allergen strings match the belief `value`s exactly ("peanuts", "shellfish")
 * so the engine can string-match a diner's allergy against a dish's allergens
 * with no normalisation. Per the shared safety rules:
 *   - a dish whose `allergens` include a diner's allergy is unsafe for them;
 *   - `allergenStatus: "unknown"` is unsafe for ANY diner who has ANY allergy
 *     (we cannot confirm the dish is free of their allergen) but is fine for a
 *     diner with no allergy.
 *
 * ── Intended demo trajectory ──────────────────────────────────────────────
 * The demo diners are: Alex (vegetarian), Sam (high-protein goal, $20 budget),
 * Jordan (unrestricted → later shellfish allergy), Priya (peanut allergy).
 *
 * v1  Table = Alex, Sam, Jordan (all unrestricted-ish; only Alex's diet binds).
 *     → NOODLE REPUBLIC is feasible and the cheap/fast pick. Its unknown-status
 *       and peanut dishes are fine here because nobody at the table has an
 *       allergy. Jordan/Sam get high-protein noodles, Alex gets a veg dish.
 *
 * v2  Priya joins (peanut allergy).
 *     → NOODLE REPUBLIC is HARD-REMOVED: every one of its mains is either a
 *       peanut dish or unknown-status, so Priya has no safe main there. The
 *       engine must move the whole table. HARBOR & VINE is the next feasible
 *       restaurant and it is shellfish-forward, so an unrestricted Jordan is
 *       served the signature Shrimp Scampi (a shellfish dish). Visible change:
 *       restaurant + every dish row.
 *
 * v3  Jordan corrects his belief to a shellfish allergy.
 *     → Harbor & Vine stays technically feasible (Jordan can fall back to the
 *       veg orzo / chicken skewers), but its entire draw — the shellfish — is
 *       now off-limits to Jordan, so its group score collapses. GREEN FORK
 *       KITCHEN, which is fully verified and safe for all four diners in every
 *       belief state, becomes the winner. This is the safe fallback the plan
 *       requires.
 *
 * Green Fork Kitchen is the universal safety net: it can serve all four diners
 * under any combination of the demo beliefs, so the engine always has a
 * feasible answer and never needs to fabricate safety.
 */
export const demoRestaurants: Restaurant[] = [
  {
    id: "noodle-republic",
    name: "Noodle Republic",
    cuisine: "Pan-Asian",
    menu: [
      {
        // Peanut + shellfish: unsafe for both Priya and post-revision Jordan.
        id: "nr-pad-thai",
        name: "Classic Pad Thai",
        price: 13,
        tags: ["high-protein", "noodles"],
        allergens: ["peanuts", "shellfish"],
        allergenStatus: "verified",
        preparationMinutes: 14,
        available: true,
      },
      {
        // Peanut: unsafe for Priya.
        id: "nr-dan-dan",
        name: "Dan Dan Noodles",
        price: 12,
        tags: ["high-protein", "spicy"],
        allergens: ["peanuts"],
        allergenStatus: "verified",
        preparationMinutes: 12,
        available: true,
      },
      {
        // Vegetarian, but a shared wok line means shellfish/peanut cannot be
        // ruled out — unknown status makes it unsafe for any allergic diner.
        id: "nr-garden-fried-rice",
        name: "Garden Fried Rice",
        price: 11,
        tags: ["vegetarian"],
        allergens: [],
        allergenStatus: "unknown",
        preparationMinutes: 10,
        available: true,
      },
      {
        id: "nr-ginger-tofu",
        name: "Ginger Tofu Stir-fry",
        price: 12,
        tags: ["vegetarian", "high-protein"],
        allergens: ["soy"],
        allergenStatus: "unknown",
        preparationMinutes: 11,
        available: true,
      },
      {
        id: "nr-beef-noodle-soup",
        name: "Braised Beef Noodle Soup",
        price: 15,
        tags: ["high-protein"],
        allergens: [],
        allergenStatus: "unknown",
        preparationMinutes: 18,
        available: true,
      },
    ],
  },
  {
    id: "harbor-and-vine",
    name: "Harbor & Vine",
    cuisine: "Seafood & Grill",
    menu: [
      {
        // Jordan's signature pick while unrestricted; the "shellfish dish" the
        // v2 recommendation hands him, invalidated by his v3 revision.
        id: "hv-shrimp-scampi",
        name: "Garlic Butter Shrimp Scampi",
        price: 19,
        tags: ["shellfish", "high-protein", "chef-signature"],
        allergens: ["shellfish"],
        allergenStatus: "verified",
        preparationMinutes: 18,
        available: true,
      },
      {
        // High-protein but $21 > Sam's $20 hard cap: excluded for Sam.
        id: "hv-cedar-salmon",
        name: "Cedar Seared Salmon",
        price: 21,
        tags: ["high-protein", "pescatarian"],
        allergens: ["fish"],
        allergenStatus: "verified",
        preparationMinutes: 20,
        available: true,
      },
      {
        // Alex's safe vegetarian main; also a safe fallback for a
        // shellfish-allergic Jordan and for Priya.
        id: "hv-charred-orzo",
        name: "Charred Vegetable Orzo",
        price: 17,
        tags: ["vegetarian"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 16,
        available: true,
      },
      {
        // Sam's under-budget high-protein pick at Harbor & Vine.
        id: "hv-chicken-skewers",
        name: "Grilled Chicken Skewers",
        price: 16,
        tags: ["high-protein"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 15,
        available: true,
      },
      {
        // Vegetarian AND high-protein, but peanut — a deliberate trap the
        // engine must never hand to Priya.
        id: "hv-peanut-grain-bowl",
        name: "Crunchy Peanut Grain Bowl",
        price: 15,
        tags: ["vegetarian", "high-protein"],
        allergens: ["peanuts"],
        allergenStatus: "verified",
        preparationMinutes: 12,
        available: true,
      },
    ],
  },
  {
    id: "green-fork-kitchen",
    name: "Green Fork Kitchen",
    cuisine: "Farm-to-table",
    menu: [
      {
        // The workhorse: vegetarian AND high-protein AND cheap AND fast.
        // Safe for every demo diner in every belief state.
        id: "gf-quinoa-power-bowl",
        name: "Quinoa Power Bowl",
        price: 14,
        tags: ["vegetarian", "high-protein"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 10,
        available: true,
      },
      {
        id: "gf-herb-chicken-plate",
        name: "Herb Grilled Chicken Plate",
        price: 18,
        tags: ["high-protein"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 16,
        available: true,
      },
      {
        id: "gf-mushroom-wellington",
        name: "Mushroom Wellington",
        price: 19,
        tags: ["vegetarian", "chef-signature"],
        allergens: ["gluten"],
        allergenStatus: "verified",
        preparationMinutes: 22,
        available: true,
      },
      {
        id: "gf-falafel-plate",
        name: "Falafel & Hummus Plate",
        price: 13,
        tags: ["vegetarian", "high-protein"],
        allergens: ["sesame"],
        allergenStatus: "verified",
        preparationMinutes: 12,
        available: true,
      },
      {
        // Premium high-protein option over Sam's budget; a treat for the
        // diners with no budget cap. 86'd for the demo: Green Fork's menu
        // is otherwise so uniformly safe for every belief combination that
        // it out-scored both Noodle Republic (v1) and Harbor & Vine (v2),
        // even before either restaurant's hard-elimination was supposed to
        // matter — collapsing the three-version story to one restaurant
        // the whole time. Marking this unavailable (not changing any tag
        // or allergen) trims just enough of that structural advantage for
        // the documented v1/v2/v3 trajectory above to actually hold; it
        // does not change whether Green Fork remains a fully safe fallback
        // for all four diners in every belief state.
        id: "gf-steak-frites",
        name: "Grass-fed Steak Frites",
        price: 24,
        tags: ["high-protein", "chef-signature"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 20,
        available: false,
      },
    ],
  },
];

/** Look up a restaurant by id (handy for rendering a recommendation). */
export function getRestaurant(id: string): Restaurant | undefined {
  return demoRestaurants.find((r) => r.id === id);
}
