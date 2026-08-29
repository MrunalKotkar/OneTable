import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { dishes, restaurants } from "@/db/schema";
import type { Dish, Restaurant } from "@/domain/contracts";
import type {
  CatalogGateway,
  CreateDishInput,
  CreateRestaurantInput,
  UpdateDishInput,
  UpdateRestaurantInput,
} from "./contract";

type RestaurantRow = typeof restaurants.$inferSelect;
type DishRow = typeof dishes.$inferSelect;

const toDish = (row: DishRow): Dish => ({
  id: row.id,
  name: row.name,
  price: row.price,
  tags: row.tags,
  allergens: row.allergens,
  allergenStatus: row.allergenStatus,
  preparationMinutes: row.preparationMinutes,
  available: row.available,
});

function groupRestaurants(
  restaurantRows: RestaurantRow[],
  dishRows: DishRow[],
): Restaurant[] {
  const dishesByRestaurant = new Map<string, Dish[]>();
  for (const row of dishRows) {
    const list = dishesByRestaurant.get(row.restaurantId) ?? [];
    list.push(toDish(row));
    dishesByRestaurant.set(row.restaurantId, list);
  }

  return restaurantRows.map((row) => ({
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    menu: dishesByRestaurant.get(row.id) ?? [],
  }));
}

export const dbCatalogGateway: CatalogGateway = {
  async listRestaurants(): Promise<Restaurant[]> {
    const [restaurantRows, dishRows] = await Promise.all([
      db.select().from(restaurants),
      db.select().from(dishes),
    ]);
    return groupRestaurants(restaurantRows, dishRows);
  },

  async getRestaurants(ids: string[]): Promise<Restaurant[]> {
    if (ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)];
    const [restaurantRows, dishRows] = await Promise.all([
      db.select().from(restaurants).where(inArray(restaurants.id, uniqueIds)),
      db.select().from(dishes).where(inArray(dishes.restaurantId, uniqueIds)),
    ]);
    return groupRestaurants(restaurantRows, dishRows);
  },

  async getRestaurant(id: string): Promise<Restaurant | null> {
    const [result] = await dbCatalogGateway.getRestaurants([id]);
    return result ?? null;
  },

  async createRestaurant(input: CreateRestaurantInput): Promise<Restaurant> {
    const [row] = await db
      .insert(restaurants)
      .values({ id: input.id, name: input.name, cuisine: input.cuisine })
      .returning();
    return { id: row.id, name: row.name, cuisine: row.cuisine, menu: [] };
  },

  async updateRestaurant(
    id: string,
    input: UpdateRestaurantInput,
  ): Promise<Restaurant> {
    const [row] = await db
      .update(restaurants)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(restaurants.id, id))
      .returning();
    if (!row) throw new Error(`Unknown restaurant: ${id}`);
    const restaurant = await dbCatalogGateway.getRestaurant(id);
    if (!restaurant) throw new Error(`Unknown restaurant: ${id}`);
    return restaurant;
  },

  async deleteRestaurant(id: string): Promise<void> {
    await db.delete(restaurants).where(eq(restaurants.id, id));
  },

  async createDish(input: CreateDishInput): Promise<Dish> {
    const [row] = await db
      .insert(dishes)
      .values({
        id: input.id,
        restaurantId: input.restaurantId,
        name: input.name,
        price: input.price,
        tags: input.tags,
        allergens: input.allergens,
        allergenStatus: input.allergenStatus,
        preparationMinutes: input.preparationMinutes,
        available: input.available ?? true,
      })
      .returning();
    return toDish(row);
  },

  async updateDish(
    restaurantId: string,
    dishId: string,
    input: UpdateDishInput,
  ): Promise<Dish> {
    const [row] = await db
      .update(dishes)
      .set(input)
      .where(eq(dishes.id, dishId))
      .returning();
    if (!row || row.restaurantId !== restaurantId) {
      throw new Error(`Unknown dish: ${dishId}`);
    }
    return toDish(row);
  },

  async deleteDish(restaurantId: string, dishId: string): Promise<void> {
    await db
      .delete(dishes)
      .where(and(eq(dishes.id, dishId), eq(dishes.restaurantId, restaurantId)));
  },
};
