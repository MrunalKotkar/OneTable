/**
 * End-to-end negotiation test driven through the real MemoryGateway
 * (mock or xtrace, controlled entirely by MEMORY_PROVIDER) rather than the
 * static demo-stages.ts fixtures __manual-test.ts uses.
 *
 * This is what actually exercises the "swap mockMemoryGateway for
 * xtraceMemoryGateway with no engine changes" guarantee end to end:
 * recallGroupContext -> rebalance -> reviseBelief -> recallGroupContext ->
 * rebalance, same as the flow documented in docs/HANDOFF_TO_PERSON2.md.
 *
 *   MEMORY_PROVIDER=xtrace npx tsx --env-file-if-exists=.env \
 *     src/features/negotiation/__gateway-e2e-test.ts
 */
import type { Recommendation } from "@/domain/contracts";
import { demoRestaurants } from "@/data/restaurant-catalog";
import { memoryGateway } from "@/features/memory";
import { RuleBasedNegotiationEngine, NoFeasibleRestaurantError } from "./engine";

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

function logRecommendation(rec: Recommendation) {
  console.log(`  restaurantId: ${rec.restaurantId}`);
  for (const selection of rec.selections) {
    const rest = demoRestaurants.find((r) => r.id === rec.restaurantId);
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
  console.log(`Using provider: ${process.env.MEMORY_PROVIDER === "xtrace" ? "xtrace" : "mock"}\n`);

  const GROUP = "demo-group";

  console.log("=== v1: recallGroupContext(Alex, Sam, Jordan) -> rebalance ===");
  const ctx1 = await memoryGateway.recallGroupContext(
    GROUP,
    ["alex", "sam", "jordan"],
    "quick lunch, around $20 each"
  );
  let v1: Recommendation | null = null;
  try {
    v1 = await engine.rebalance({ context: ctx1, restaurants: demoRestaurants });
    logRecommendation(v1);
  } catch (err) {
    if (err instanceof NoFeasibleRestaurantError) {
      console.error(`  NoFeasibleRestaurantError: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n=== v2: Priya joins -> recallGroupContext -> rebalance ===");
  const ctx2 = await memoryGateway.recallGroupContext(
    GROUP,
    ["alex", "sam", "jordan", "priya"],
    "quick lunch, around $20 each"
  );
  let v2: Recommendation | null = null;
  try {
    if (!v1) throw new Error("v1 result missing, cannot proceed");
    v2 = await engine.rebalance({
      context: ctx2,
      restaurants: demoRestaurants,
      previousRecommendation: v1,
    });
    logRecommendation(v2);
    console.log("  changes:", JSON.stringify(v2.changes, null, 2));
  } catch (err) {
    if (err instanceof NoFeasibleRestaurantError) {
      console.error(`  NoFeasibleRestaurantError: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n=== v3: Jordan revises belief (shellfish allergy) -> recall -> rebalance ===");
  await memoryGateway.reviseBelief({
    dinerId: "jordan",
    sessionId: "e2e-demo",
    kind: "allergy",
    value: "shellfish",
    correctionText: "Actually I'm allergic to shellfish",
  });
  const ctx3 = await memoryGateway.recallGroupContext(
    GROUP,
    ["alex", "sam", "jordan", "priya"],
    "quick lunch, around $20 each"
  );
  let v3: Recommendation | null = null;
  try {
    if (!v2) throw new Error("v2 result missing, cannot proceed");
    v3 = await engine.rebalance({
      context: ctx3,
      restaurants: demoRestaurants,
      previousRecommendation: v2,
    });
    logRecommendation(v3);
    console.log("  changes:", JSON.stringify(v3.changes, null, 2));
  } catch (err) {
    if (err instanceof NoFeasibleRestaurantError) {
      console.error(`  NoFeasibleRestaurantError: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log("\n=== Assertions ===");

  check("v1 diet belief for Jordan is unrestricted", ctx1.diners.some(
    (d) => d.id === "jordan" && d.beliefs.some((b) => b.value === "no dietary restrictions")
  ));

  check("v3: Jordan's active beliefs no longer include 'no dietary restrictions'", !ctx3.diners.some(
    (d) => d.id === "jordan" && d.beliefs.some((b) => b.value === "no dietary restrictions")
  ));
  check("v3: Jordan has active shellfish allergy belief", ctx3.diners.some(
    (d) => d.id === "jordan" && d.beliefs.some((b) => b.kind === "allergy" && b.value === "shellfish")
  ));

  if (v3) {
    const { dish: jordanDish } = dinerDish(v3, "jordan");
    check(
      "v3: Jordan's selected dish does NOT contain shellfish",
      !!jordanDish && !jordanDish.allergens.includes("shellfish")
    );
  } else {
    check("v3: Jordan's selected dish does NOT contain shellfish", false);
  }

  for (const [label, rec] of [
    ["v1", v1],
    ["v2", v2],
    ["v3", v3],
  ] as const) {
    if (!rec) {
      check(`${label}: Priya's dish never has peanuts`, false);
      check(`${label}: Alex's dish always vegetarian`, false);
      continue;
    }
    const priya = dinerDish(rec, "priya");
    check(
      `${label}: Priya's dish never has peanuts`,
      priya.selection === undefined || (!!priya.dish && !priya.dish.allergens.includes("peanuts"))
    );
    const alex = dinerDish(rec, "alex");
    check(`${label}: Alex's dish always vegetarian`, !!alex.dish && alex.dish.tags.includes("vegetarian"));
  }

  console.log(`\n=== Summary: ${passCount} passed, ${failCount} failed ===`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exitCode = 1;
});
