/**
 * Seeds:
 *  - the restaurant catalog from `demoRestaurants` (src/data/restaurant-catalog.ts)
 *  - the demo diners/group/beliefs from `demoDiners` (src/data/demo-fixtures.ts)
 *
 * verbatim, so behavior doesn't regress when table-store.ts and the memory
 * gateway switch from static imports / the in-memory mock to the DB
 * (Phases 2 and 3 of PRODUCTION_REBUILD_PLAN.md).
 *
 * The "demo-group" id and the four diner ids ("alex"/"sam"/"jordan"/"priya")
 * match the constants table-store.ts hardcodes (GROUP_ID, ALL_DINER_IDS) —
 * both go away once Phase 5 replaces the fixed cast with real accounts.
 *
 * Idempotent: safe to run again after editing either fixture (upserts by id).
 *
 *   npm run db:seed
 */
import { demoDiners } from "@/data/demo-fixtures";
import { demoRestaurants } from "@/data/restaurant-catalog";
import { db } from "./client";
import { beliefs, dishes, diners, groupMembers, groups, restaurants } from "./schema";

const DEMO_GROUP_ID = "demo-group";

async function seedCatalog() {
  for (const restaurant of demoRestaurants) {
    await db
      .insert(restaurants)
      .values({
        id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
      })
      .onConflictDoUpdate({
        target: restaurants.id,
        set: { name: restaurant.name, cuisine: restaurant.cuisine, updatedAt: new Date() },
      });

    for (const dish of restaurant.menu) {
      await db
        .insert(dishes)
        .values({
          id: dish.id,
          restaurantId: restaurant.id,
          name: dish.name,
          price: dish.price,
          tags: dish.tags,
          allergens: dish.allergens,
          allergenStatus: dish.allergenStatus,
          preparationMinutes: dish.preparationMinutes,
          available: dish.available,
        })
        .onConflictDoUpdate({
          target: dishes.id,
          set: {
            restaurantId: restaurant.id,
            name: dish.name,
            price: dish.price,
            tags: dish.tags,
            allergens: dish.allergens,
            allergenStatus: dish.allergenStatus,
            preparationMinutes: dish.preparationMinutes,
            available: dish.available,
          },
        });
    }

    console.log(`Seeded ${restaurant.name} (${restaurant.menu.length} dishes)`);
  }
  console.log(`Catalog done: ${demoRestaurants.length} restaurants seeded.\n`);
}

async function seedDemoGroup() {
  await db
    .insert(groups)
    .values({ id: DEMO_GROUP_ID })
    .onConflictDoNothing({ target: groups.id });

  for (const diner of demoDiners) {
    await db
      .insert(diners)
      .values({ id: diner.id, name: diner.name, initials: diner.initials })
      .onConflictDoUpdate({
        target: diners.id,
        set: { name: diner.name, initials: diner.initials },
      });

    await db
      .insert(groupMembers)
      .values({ groupId: DEMO_GROUP_ID, dinerId: diner.id })
      .onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.dinerId] });

    for (const belief of diner.beliefs) {
      await db
        .insert(beliefs)
        .values({
          id: belief.id,
          dinerId: diner.id,
          kind: belief.kind,
          value: String(belief.value),
          status: belief.status,
          updatedAt: new Date(belief.updatedAt),
          supersedes: belief.supersedes,
        })
        .onConflictDoUpdate({
          target: beliefs.id,
          set: {
            kind: belief.kind,
            value: String(belief.value),
            status: belief.status,
            updatedAt: new Date(belief.updatedAt),
            supersedes: belief.supersedes,
          },
        });
    }

    console.log(`Seeded diner ${diner.name} (${diner.beliefs.length} beliefs)`);
  }
  console.log(`Demo group done: ${demoDiners.length} diners in "${DEMO_GROUP_ID}".\n`);
}

async function main() {
  await seedCatalog();
  await seedDemoGroup();
  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
