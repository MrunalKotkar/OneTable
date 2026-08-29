/**
 * Seeds the restaurant catalog from the existing `demoRestaurants` fixture
 * (src/data/restaurant-catalog.ts), verbatim, so behavior doesn't regress
 * when table-store.ts switches from the static import to the DB gateway
 * (Phase 2 of PRODUCTION_REBUILD_PLAN.md).
 *
 * Idempotent: safe to run against a DB that's already been seeded (upserts
 * by id) — run it again after editing restaurant-catalog.ts.
 *
 *   npm run db:seed
 */
import { demoRestaurants } from "@/data/restaurant-catalog";
import { db } from "./client";
import { dishes, restaurants } from "./schema";

async function main() {
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

  console.log(`\nDone: ${demoRestaurants.length} restaurants seeded.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
