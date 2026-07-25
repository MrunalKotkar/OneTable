import type {
  BeliefKind,
  BeliefRevision,
  GroupContext,
  MealOutcome,
} from "@/domain/contracts";

export interface ReviseBeliefInput {
  dinerId: string;
  sessionId: string;
  kind: BeliefKind;
  value: string | number;
  correctionText: string;
}

export interface MemoryGateway {
  recallGroupContext(
    groupId: string,
    dinerIds: string[],
    intent: string,
  ): Promise<GroupContext>;
  reviseBelief(input: ReviseBeliefInput): Promise<BeliefRevision>;
  getBeliefHistory(
    dinerId: string,
    kind: BeliefKind,
  ): Promise<BeliefRevision | null>;
  saveMealOutcome(outcome: MealOutcome): Promise<void>;
}

