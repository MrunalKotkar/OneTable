"use client";

import { useState } from "react";
import type { BeliefRevision, DinerProfile, Recommendation } from "@/domain/contracts";
import {
  buildJordanRevision,
  demoDiners,
  recommendationV1,
  recommendationV2,
  recommendationV3,
} from "@/data/demo-fixtures";
import { NoFeasibleResultError } from "./lib/errors";

export type Phase =
  | "idle"
  | "recalling"
  | "negotiating"
  | "ready"
  | "revising_belief"
  | "rebalancing"
  | "no_feasible_result"
  | "error";

export type Screen = "create-table" | "table" | "fresh-session";

interface DemoState {
  screen: Screen;
  phase: Phase;
  intent: string;
  priyaSelected: boolean;
  diners: DinerProfile[];
  recommendation: Recommendation | null;
  previousRecommendation: Recommendation | null;
  revision: BeliefRevision | null;
  errorMessage: string | null;
  pendingAction: (() => void) | null;
}

const DELAY = {
  recall: 550,
  negotiate: 700,
  revise: 550,
  rebalanceRecall: 400,
  rebalance: 650,
  freshRecall: 500,
};

function cloneDiners(): DinerProfile[] {
  return demoDiners.map((diner) => ({
    ...diner,
    beliefs: diner.beliefs.map((belief) => ({ ...belief })),
  }));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initialState(): DemoState {
  return {
    screen: "create-table",
    phase: "idle",
    intent: "",
    priyaSelected: false,
    diners: cloneDiners(),
    recommendation: null,
    previousRecommendation: null,
    revision: null,
    errorMessage: null,
    pendingAction: null,
  };
}

export function useDemoFlow() {
  const [state, setState] = useState<DemoState>(initialState);

  /**
   * Runs one attempt of a multi-step transition (recall/negotiate/etc.)
   * and translates a thrown failure into a graceful UI state instead of
   * an unhandled rejection or a silently frozen screen:
   *
   * - NoFeasibleResultError: a safe, explicit outcome (the catalog has
   *   no restaurant that satisfies every active constraint). Not
   *   retried automatically — whatever recommendation was already on
   *   screen is left in place, since it is still the last valid,
   *   approved-safe result.
   * - Anything else: treated as an external service failure. Offers a
   *   retry that re-runs the exact same attempt.
   *
   * Nothing in today's fixture-driven demo throws yet — this is the
   * boundary Person 2's real NegotiationEngine (and Person 1's
   * MemoryGateway) will call into once they replace the fixtures.
   */
  const runAttempt = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      if (error instanceof NoFeasibleResultError) {
        setState((prev) => ({
          ...prev,
          phase: "no_feasible_result",
          errorMessage: error.message,
          pendingAction: null,
        }));
        return;
      }
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setState((prev) => ({
        ...prev,
        phase: "error",
        errorMessage: message,
        pendingAction: () => runAttempt(work),
      }));
    }
  };

  const togglePriya = () =>
    setState((prev) =>
      prev.screen === "create-table"
        ? { ...prev, priyaSelected: !prev.priyaSelected }
        : prev,
    );

  const setIntent = (intent: string) =>
    setState((prev) => ({ ...prev, intent }));

  const createTable = () =>
    runAttempt(async () => {
      setState((prev) => ({
        ...prev,
        phase: "recalling",
        errorMessage: null,
        pendingAction: null,
      }));
      await wait(DELAY.recall);
      setState((prev) => ({ ...prev, phase: "negotiating" }));
      await wait(DELAY.negotiate);
      setState((prev) => {
        const base = prev.priyaSelected ? recommendationV2 : recommendationV1;
        return {
          ...prev,
          screen: "table",
          phase: "ready",
          recommendation: { ...base, changes: [] },
          previousRecommendation: null,
        };
      });
    });

  const addPriya = () =>
    runAttempt(async () => {
      setState((prev) => ({ ...prev, phase: "recalling", errorMessage: null }));
      await wait(DELAY.rebalanceRecall);
      setState((prev) => ({ ...prev, phase: "rebalancing", priyaSelected: true }));
      await wait(DELAY.rebalance);
      setState((prev) => ({
        ...prev,
        phase: "ready",
        previousRecommendation: prev.recommendation,
        recommendation: recommendationV2,
      }));
    });

  const reviseJordanBelief = () =>
    runAttempt(async () => {
      setState((prev) => ({ ...prev, phase: "revising_belief", errorMessage: null }));
      await wait(DELAY.revise);
      const revision = buildJordanRevision(new Date().toISOString());
      setState((prev) => ({
        ...prev,
        diners: prev.diners.map((diner) =>
          diner.id === "jordan"
            ? { ...diner, beliefs: [{ ...revision.previous }, { ...revision.current }] }
            : diner,
        ),
        revision,
        phase: "recalling",
      }));
      await wait(DELAY.rebalanceRecall);
      setState((prev) => ({ ...prev, phase: "rebalancing" }));
      await wait(DELAY.rebalance);
      setState((prev) => ({
        ...prev,
        phase: "ready",
        previousRecommendation: prev.recommendation,
        recommendation: recommendationV3,
      }));
    });

  const approve = () =>
    runAttempt(async () => {
      setState((prev) => ({
        ...prev,
        screen: "fresh-session",
        phase: "recalling",
        errorMessage: null,
      }));
      await wait(DELAY.freshRecall);
      setState((prev) => ({ ...prev, phase: "ready" }));
    });

  const restart = () => setState(initialState());

  return {
    state,
    actions: {
      togglePriya,
      setIntent,
      createTable,
      addPriya,
      reviseJordanBelief,
      approve,
      restart,
    },
  };
}
