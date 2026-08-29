import type { Dish, Restaurant } from "@/domain/contracts";

export interface CreateRestaurantInput {
  id: string;
  name: string;
  cuisine: string;
}

export interface UpdateRestaurantInput {
  name?: string;
  cuisine?: string;
}

export interface CreateDishInput {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  tags: string[];
  allergens: string[];
  allergenStatus: "verified" | "unknown";
  preparationMinutes: number;
  available?: boolean;
}

export interface UpdateDishInput {
  name?: string;
  price?: number;
  tags?: string[];
  allergens?: string[];
  allergenStatus?: "verified" | "unknown";
  preparationMinutes?: number;
  available?: boolean;
}

/**
 * The restaurant catalog, admin-managed in Postgres (Phase 2 of
 * PRODUCTION_REBUILD_PLAN.md) instead of the static `demoRestaurants`
 * fixture. `NegotiationEngine` still just receives a plain `Restaurant[]`
 * (its contract is untouched) — this is what produces that array now.
 */
export interface CatalogGateway {
  listRestaurants(): Promise<Restaurant[]>;
  /** Only the restaurants whose id is in `ids`, in no particular order. Missing ids are silently skipped. */
  getRestaurants(ids: string[]): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;

  createRestaurant(input: CreateRestaurantInput): Promise<Restaurant>;
  updateRestaurant(id: string, input: UpdateRestaurantInput): Promise<Restaurant>;
  /** Cascades to that restaurant's dishes (see the FK's onDelete: "cascade" in src/db/schema.ts). */
  deleteRestaurant(id: string): Promise<void>;

  createDish(input: CreateDishInput): Promise<Dish>;
  updateDish(restaurantId: string, dishId: string, input: UpdateDishInput): Promise<Dish>;
  deleteDish(restaurantId: string, dishId: string): Promise<void>;
}
