import { describe, expect, it } from "vitest";
import { deriveDisplayPhase, deriveFulfillmentStatus, derivePaymentDisplayStatus } from "./elapsed";

const at = (ms: number) => new Date(ms);

describe("deriveDisplayPhase", () => {
  it("returns the real phase when no action is pending", () => {
    expect(deriveDisplayPhase("ready", null, null, at(1000))).toBe("ready");
  });

  it("walks the create milestones, then settles to the real phase", () => {
    const started = at(0);
    expect(deriveDisplayPhase("ready", "create", started, at(0))).toBe("recalling");
    expect(deriveDisplayPhase("ready", "create", started, at(599))).toBe("recalling");
    expect(deriveDisplayPhase("ready", "create", started, at(600))).toBe("negotiating");
    expect(deriveDisplayPhase("ready", "create", started, at(1299))).toBe("negotiating");
    expect(deriveDisplayPhase("ready", "create", started, at(1300))).toBe("ready");
  });

  it("walks the revise milestones in order", () => {
    const started = at(0);
    expect(deriveDisplayPhase("ready", "revise", started, at(0))).toBe("revising_belief");
    expect(deriveDisplayPhase("ready", "revise", started, at(550))).toBe("recalling");
    expect(deriveDisplayPhase("ready", "revise", started, at(950))).toBe("rebalancing");
    expect(deriveDisplayPhase("ready", "revise", started, at(1600))).toBe("ready");
  });

  it("reveals whatever the real terminal phase is, including a failure", () => {
    expect(deriveDisplayPhase("no_feasible_result", "join", at(0), at(1050))).toBe(
      "no_feasible_result",
    );
    expect(deriveDisplayPhase("error", "join", at(0), at(1050))).toBe("error");
  });
});

describe("deriveFulfillmentStatus", () => {
  it("returns null before payment", () => {
    expect(deriveFulfillmentStatus(null, at(1000))).toBeNull();
  });

  it("steps through every status on schedule", () => {
    const paidAt = at(0);
    expect(deriveFulfillmentStatus(paidAt, at(0))).toBe("submitted");
    expect(deriveFulfillmentStatus(paidAt, at(899))).toBe("submitted");
    expect(deriveFulfillmentStatus(paidAt, at(900))).toBe("accepted");
    expect(deriveFulfillmentStatus(paidAt, at(1800))).toBe("preparing");
    expect(deriveFulfillmentStatus(paidAt, at(2700))).toBe("ready");
    expect(deriveFulfillmentStatus(paidAt, at(3600))).toBe("out_for_delivery");
    expect(deriveFulfillmentStatus(paidAt, at(4500))).toBe("completed");
    expect(deriveFulfillmentStatus(paidAt, at(100_000))).toBe("completed");
  });
});

describe("derivePaymentDisplayStatus", () => {
  it("shows processing for the reveal window on a settled outcome", () => {
    const startedAt = at(0);
    expect(derivePaymentDisplayStatus("paid", startedAt, at(0))).toBe("processing");
    expect(derivePaymentDisplayStatus("paid", startedAt, at(699))).toBe("processing");
    expect(derivePaymentDisplayStatus("paid", startedAt, at(700))).toBe("paid");
    expect(derivePaymentDisplayStatus("failed", startedAt, at(700))).toBe("failed");
  });

  it("passes through non-terminal statuses unchanged", () => {
    expect(derivePaymentDisplayStatus("idle", at(0), at(0))).toBe("idle");
  });
});
