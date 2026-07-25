/**
 * Live end-to-end proof of the XTrace-backed MemoryGateway. Hits real XTrace:
 * seeds the four demo diners, runs the v1 -> revise -> v3 flow, and asserts the
 * active-beliefs-only guarantee — the same checks as verify.ts, but through
 * XTrace instead of the mock.
 *
 *   npm run verify:xtrace
 *
 * Requires XTRACE_API_KEY (loaded from .env below).
 */
import {
  xtraceMemoryGateway as g,
  resetXtraceProcessState,
} from "@/features/memory";

// Load .env so the client sees XTRACE_API_KEY (Node >= 20.12). The gateway/client
// read env lazily at call time, so loading it here (after imports) is fine.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional if XTRACE_API_KEY is already exported in the shell.
}

let failures = 0;
function assert(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

async function main() {
  resetXtraceProcessState();
  const GROUP = "demo-group";
  const three = ["alex", "sam", "jordan"];

  console.log("Seeding + recalling from live XTrace (first call is slow)...\n");

  // 1. Initial recall: Jordan unrestricted, all beliefs active.
  const ctx1 = await g.recallGroupContext(GROUP, three, "quick lunch ~$20");
  const jordan1 = ctx1.diners.find((d) => d.id === "jordan")!;
  assert(
    "1. Initial recall: Jordan is unrestricted (diet: no dietary restrictions)",
    jordan1.beliefs.some(
      (b) => b.kind === "diet" && b.value === "no dietary restrictions",
    ),
  );
  assert(
    "   Recall returns only active beliefs",
    ctx1.diners.every((d) => d.beliefs.every((b) => b.status === "active")),
  );
  assert(
    "   Alex vegetarian + Sam budget/goal recalled from XTrace",
    ctx1.diners.find((d) => d.id === "alex")!.beliefs.some((b) => b.value === "vegetarian") &&
      ctx1.diners.find((d) => d.id === "sam")!.beliefs.some((b) => b.kind === "budget"),
  );

  // 2. Revision returns previous + current.
  const rev = await g.reviseBelief({
    dinerId: "jordan",
    sessionId: "s1",
    kind: "allergy",
    value: "shellfish",
    correctionText: "Actually I'm allergic to shellfish",
  });
  assert(
    "2. Revision returns previous (superseded) + current (active)",
    rev.previous.value === "no dietary restrictions" &&
      rev.previous.status === "superseded" &&
      rev.current.value === "shellfish" &&
      rev.current.status === "active" &&
      rev.current.supersedes === rev.previous.id,
  );

  // 3. New recall returns shellfish allergy.
  const ctx2 = await g.recallGroupContext(GROUP, three, "quick lunch ~$20");
  const jordan2 = ctx2.diners.find((d) => d.id === "jordan")!;
  assert(
    "3. New recall: Jordan has active shellfish allergy",
    jordan2.beliefs.some((b) => b.kind === "allergy" && b.value === "shellfish"),
  );

  // 4. Old unrestricted belief is gone from live XTrace recall (deleted).
  assert(
    "4. Old 'no dietary restrictions' belief is NOT active after revision",
    !jordan2.beliefs.some((b) => b.value === "no dietary restrictions"),
  );

  // 5. Fresh session (same process) still returns shellfish allergy.
  const fresh = await g.recallGroupContext(GROUP, three, "dinner");
  const jordanFresh = fresh.diners.find((d) => d.id === "jordan")!;
  assert(
    "5. Fresh session still returns shellfish allergy",
    jordanFresh.beliefs.some(
      (b) => b.kind === "allergy" && b.value === "shellfish",
    ),
  );

  // History for the audit UI.
  const hist = await g.getBeliefHistory("jordan", "allergy");
  assert(
    "   Belief history accessible (previous + current)",
    hist !== null &&
      hist.previous.value === "no dietary restrictions" &&
      hist.current.value === "shellfish",
  );

  // 6. saveMealOutcome feeds group history.
  await g.saveMealOutcome({
    groupId: GROUP,
    recommendationVersion: 3,
    restaurantId: "safe-bistro",
    feedback: [{ dinerId: "jordan", dishId: "d1", liked: true }],
    completedAt: new Date().toISOString(),
  });
  const ctx3 = await g.recallGroupContext(GROUP, three, "next time");
  assert(
    "6. Saved meal outcome appears in group history",
    ctx3.history.some((h) => h.restaurant === "safe-bistro"),
  );

  console.log(
    failures === 0
      ? "\nAll XTrace memory acceptance checks passed."
      : `\n${failures} check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
