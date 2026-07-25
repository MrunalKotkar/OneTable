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

  const togglePriya = () =>
    setState((prev) =>
      prev.screen === "create-table"
        ? { ...prev, priyaSelected: !prev.priyaSelected }
        : prev,
    );

  const setIntent = (intent: string) =>
    setState((prev) => ({ ...prev, intent }));

  const createTable = async () => {
    setState((prev) => ({ ...prev, phase: "recalling", errorMessage: null }));
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
  };

  const addPriya = async () => {
    setState((prev) => ({ ...prev, phase: "recalling" }));
    await wait(DELAY.rebalanceRecall);
    setState((prev) => ({ ...prev, phase: "rebalancing", priyaSelected: true }));
    await wait(DELAY.rebalance);
    setState((prev) => ({
      ...prev,
      phase: "ready",
      previousRecommendation: prev.recommendation,
      recommendation: recommendationV2,
    }));
  };

  const reviseJordanBelief = async () => {
    setState((prev) => ({ ...prev, phase: "revising_belief" }));
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
  };

  const approve = async () => {
    setState((prev) => ({ ...prev, screen: "fresh-session", phase: "recalling" }));
    await wait(DELAY.freshRecall);
    setState((prev) => ({ ...prev, phase: "ready" }));
  };

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
