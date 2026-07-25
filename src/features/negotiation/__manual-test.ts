import type { Recommendation } from "@/domain/contracts";
import { demoRestaurants } from "@/data/demo-restaurants";
import { demoDiners } from "@/data/demo-fixtures";
import { stage1Context, stage2Context, stage3Context } from "@/data/demo-stages";
import {
  NoFeasibleRestaurantError,
  RuleBasedNegotiationEngine,
  selectDish,
} from "./engine";

const engine = new RuleBasedNegotiationEngine();

let passCount = 0;
let failCount = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    passCount += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failCount += 1;
    console.error(`  FAIL: ${label}`);
  }
}

function logRecommendation(rec: Recommendation, restaurant = demoRestaurants) {
  console.log(`  restaurantId: ${rec.restaurantId}`);
  for (const selection of rec.selections) {
    const rest = restaurant.find((r) => r.id === rec.restaurantId);
    const dish = rest?.menu.find((d) => d.id === selection.dishId);
    console.log(
      `  - ${selection.dinerId}: ${dish?.name ?? "?"} ($${selection.price}) — "${selection.reason}"`
    );
  }
}

function dinerDish(rec: Recommendation, dinerId: string) {
  const selection = rec.selections.find((s) => s.dinerId === dinerId);
  const restaurant = demoRestaurants.find((r) => r.id === rec.restaurantId);
  const dish = restaurant?.menu.find((d) => d.id === selection?.dishId);
  return { selection, dish };
}

async function main() {
  console.log("=== Isolated test: past-order preference in selectDish ===");
  const alexBase = demoDiners.find((d) => d.id === "alex");
  const thaiBasil = demoRestaurants.find((r) => r.id === "thai-basil");
  if (!alexBase || !thaiBasil) {
    throw new Error("fixtures missing alex or thai-basil");
  }

  const alexNoHistory = {
    ...alexBase,
    beliefs: alexBase.beliefs.map((b) => ({ ...b })),
    pastOrders: [],
  };
  const alexWithHistory = {
    ...alexBase,
    beliefs: alexBase.beliefs.map((b) => ({ ...b })),
    pastOrders: [
      { restaurant: "thai-basil", dish: "Tofu Curry", liked: true },
    ],
  };

  const dishNoHistory = selectDish(alexNoHistory, thaiBasil);
  const dishWithHistory = selectDish(alexWithHistory, thaiBasil);

  console.log(`  Alex (no history):   ${dishNoHistory.name} ($${dishNoHistory.price})`);
  console.log(`  Alex (liked Tofu Curry before): ${dishWithHistory.name} ($${dishWithHistory.price})`);

  check(
    "selectDish prefers Alex's past-liked dish (Tofu Curry) when history is present",
    dishWithHistory.name === "Tofu Curry"
  );

  console.log("\n=== Step 1: stage1Context (Alex, Sam, Jordan) ===");
  let step1: Recommendation | null = null;
  try {
    step1 = await engine.rebalance({
      context: stage1Context,
      restaurants: demoRestaurants,
    });
    logRecommendation(step1);
  } catch (err) {
    if (err instanceof NoFeasibleRestaurantError) {
      console.error(`  NoFeasibleRestaurantError: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n=== Step 2: stage2Context (+ Priya) ===");
  let step2: Recommendation | null = null;
  try {
    if (!step1) throw new Error("step1 result missing, cannot proceed");
    step2 = await engine.rebalance({
      context: stage2Context,
      restaurants: demoRestaurants,
      previousRecommendation: step1,
    });
    logRecommendation(step2);
    console.log("  changes:", JSON.stringify(step2.changes, null, 2));
  } catch (err) {
    if (err instanceof NoFeasibleRestaurantError) {
      console.error(`  NoFeasibleRestaurantError: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n=== Step 3: stage3Context (Jordan -> shellfish allergy) ===");
  let step3: Recommendation | null = null;
  try {
    if (!step2) throw new Error("step2 result missing, cannot proceed");
    step3 = await engine.rebalance({
      context: stage3Context,
      restaurants: demoRestaurants,
      previousRecommendation: step2,
    });
    logRecommendation(step3);
    console.log("  changes:", JSON.stringify(step3.changes, null, 2));
  } catch (err) {
    if (err instanceof NoFeasibleRestaurantError) {
      console.error(`  NoFeasibleRestaurantError: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n=== Assertions ===");

  console.log("Step 1:");
  check('restaurantId === "harbor-grill"', step1?.restaurantId === "harbor-grill");

  console.log("Step 2:");
  check('restaurantId === "thai-basil"', step2?.restaurantId === "thai-basil");

  console.log("Step 3:");
  check('restaurantId === "thai-basil" (no switch)', step3?.restaurantId === "thai-basil");

  if (step3) {
    const { dish: jordanDish } = dinerDish(step3, "jordan");
    check(
      "Jordan's dish does NOT contain shellfish allergen",
      !!jordanDish && !jordanDish.allergens.includes("shellfish")
    );
  } else {
    check("Jordan's dish does NOT contain shellfish allergen", false);
  }

  if (step3) {
    const nonJordanChanges = step3.changes.filter(
      (c) => !c.summary.toLowerCase().includes("jordan")
    );
    // Jordan's pre-allergy dish (Pad See Ew) happens to already be
    // shellfish-free, so his new allergy belief doesn't force a dish swap.
    // The real invariant is just: nothing changed for anyone else.
    check(
      "Step 3 changes only mention Jordan, if anyone (Alex/Sam/Priya unchanged)",
      nonJordanChanges.length === 0
    );
  } else {
    check("Step 3 changes only mention Jordan (Alex/Sam/Priya unchanged)", false);
  }

  console.log("All steps:");
  for (const [label, rec] of [
    ["Step 1", step1],
    ["Step 2", step2],
    ["Step 3", step3],
  ] as const) {
    if (!rec) {
      check(`${label}: Priya's dish never has peanuts`, false);
      check(`${label}: Alex's dish always vegetarian`, false);
      check(`${label}: Sam's dish <= $20 and high-protein`, false);
      continue;
    }

    const priya = dinerDish(rec, "priya");
    check(
      `${label}: Priya's dish never has peanuts`,
      priya.selection === undefined || (!!priya.dish && !priya.dish.allergens.includes("peanuts"))
    );

    const alex = dinerDish(rec, "alex");
    check(
      `${label}: Alex's dish always vegetarian`,
      !!alex.dish && alex.dish.tags.includes("vegetarian")
    );

    const sam = dinerDish(rec, "sam");
    check(
      `${label}: Sam's dish <= $20 and high-protein`,
      !!sam.dish &&
        sam.dish.price <= 20 &&
        sam.dish.tags.includes("high-protein")
    );
  }

  console.log(`\n=== Summary: ${passCount} passed, ${failCount} failed ===`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exitCode = 1;
});
