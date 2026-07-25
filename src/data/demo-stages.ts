import type { Belief, GroupContext } from "@/domain/contracts";
import { demoDiners } from "@/data/demo-fixtures";

const dinerById = (id: string) => {
  const diner = demoDiners.find((d) => d.id === id);
  if (!diner) {
    throw new Error(`demo-stages: unknown diner id "${id}"`);
  }
  return diner;
};

export const stage1Context: GroupContext = {
  groupId: "demo-group",
  intent: "quick lunch, around $20 each",
  diners: [dinerById("alex"), dinerById("sam"), dinerById("jordan")].map(
    (diner) => ({
      ...diner,
      beliefs: diner.beliefs.map((belief) => ({ ...belief })),
      pastOrders: diner.pastOrders.map((order) => ({ ...order })),
    })
  ),
  history: [
    {
      restaurant: "harbor-grill",
      occurredAt: "2026-07-18T18:30:00.000Z",
      rating: 4,
    },
  ],
};

export const stage2Context: GroupContext = {
  ...stage1Context,
  diners: [
    dinerById("alex"),
    dinerById("sam"),
    dinerById("jordan"),
    dinerById("priya"),
  ].map((diner) => ({
    ...diner,
    beliefs: diner.beliefs.map((belief) => ({ ...belief })),
    pastOrders: diner.pastOrders.map((order) => ({ ...order })),
  })),
};

const jordanOldDietBelief: Belief = {
  ...dinerById("jordan").beliefs[0],
  status: "superseded",
};

const jordanShellfishAllergyBelief: Belief = {
  id: "jordan-allergy-1",
  kind: "allergy",
  value: "shellfish",
  status: "active",
  updatedAt: "2026-07-25T12:00:00.000Z",
  supersedes: jordanOldDietBelief.id,
};

export const stage3Context: GroupContext = {
  ...stage2Context,
  diners: stage2Context.diners.map((diner) =>
    diner.id === "jordan"
      ? {
          ...diner,
          beliefs: [jordanOldDietBelief, jordanShellfishAllergyBelief],
        }
      : diner
  ),
};
