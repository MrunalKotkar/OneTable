"use client";

import { useState } from "react";
import type { Dish, Restaurant } from "@/domain/contracts";

interface Props {
  initialRestaurants: Restaurant[];
}

interface NewDishDraft {
  name: string;
  price: string;
  tags: string;
  allergens: string;
  allergenStatus: "verified" | "unknown";
  preparationMinutes: string;
  available: boolean;
}

const emptyDraft: NewDishDraft = {
  name: "",
  price: "",
  tags: "",
  allergens: "",
  allergenStatus: "verified",
  preparationMinutes: "",
  available: true,
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

async function api(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? "Request failed.");
  return data;
}

export function AdminRestaurantsClient({ initialRestaurants }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants);
  const [error, setError] = useState<string | null>(null);
  const [newRestaurant, setNewRestaurant] = useState({ name: "", cuisine: "" });
  const [drafts, setDrafts] = useState<Record<string, NewDishDraft>>({});

  const draftFor = (restaurantId: string): NewDishDraft => drafts[restaurantId] ?? emptyDraft;
  const setDraft = (restaurantId: string, next: Partial<NewDishDraft>) =>
    setDrafts((prev) => ({ ...prev, [restaurantId]: { ...draftFor(restaurantId), ...next } }));

  const refresh = async () => {
    const data = await api("/api/admin/restaurants");
    setRestaurants(data.restaurants);
  };

  const guarded = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const createRestaurant = () =>
    guarded(async () => {
      if (!newRestaurant.name || !newRestaurant.cuisine) return;
      await api("/api/admin/restaurants", {
        method: "POST",
        body: JSON.stringify(newRestaurant),
      });
      setNewRestaurant({ name: "", cuisine: "" });
      await refresh();
    });

  const saveRestaurant = (id: string, name: string, cuisine: string) =>
    guarded(async () => {
      await api(`/api/admin/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, cuisine }),
      });
      await refresh();
    });

  const deleteRestaurant = (id: string) =>
    guarded(async () => {
      await api(`/api/admin/restaurants/${id}`, { method: "DELETE" });
      await refresh();
    });

  const saveDish = (restaurantId: string, dish: Dish) =>
    guarded(async () => {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, {
        method: "PATCH",
        body: JSON.stringify(dish),
      });
      await refresh();
    });

  const deleteDish = (restaurantId: string, dishId: string) =>
    guarded(async () => {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dishId}`, {
        method: "DELETE",
      });
      await refresh();
    });

  const createDish = (restaurantId: string) =>
    guarded(async () => {
      const draft = draftFor(restaurantId);
      if (!draft.name || !draft.price || !draft.preparationMinutes) return;
      await api(`/api/admin/restaurants/${restaurantId}/dishes`, {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          price: Number(draft.price),
          tags: splitList(draft.tags),
          allergens: splitList(draft.allergens),
          allergenStatus: draft.allergenStatus,
          preparationMinutes: Number(draft.preparationMinutes),
          available: draft.available,
        }),
      });
      setDrafts((prev) => ({ ...prev, [restaurantId]: emptyDraft }));
      await refresh();
    });

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            1T
          </span>
          <div>
            <strong>OneTable</strong>
            <span>Admin</span>
          </div>
        </div>
        <button type="button" className="secondaryButton" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="workspace">
        <div className="intro intro--compact">
          <p className="eyebrow">Catalog admin</p>
          <h1>Restaurants &amp; dishes</h1>
        </div>

        {error && <p className="checkoutFailed">{error}</p>}

        <section className="panel" aria-labelledby="new-restaurant-title">
          <div className="panelHeading">
            <h2 id="new-restaurant-title">Add a restaurant</h2>
          </div>
          <div className="panelBody adminForm">
            <input
              className="intentInput"
              placeholder="Name"
              value={newRestaurant.name}
              onChange={(e) => setNewRestaurant((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="intentInput"
              placeholder="Cuisine"
              value={newRestaurant.cuisine}
              onChange={(e) => setNewRestaurant((p) => ({ ...p, cuisine: e.target.value }))}
            />
            <button type="button" className="primaryButton" onClick={createRestaurant}>
              Add restaurant
            </button>
          </div>
        </section>

        {restaurants.map((restaurant) => (
          <RestaurantEditor
            key={restaurant.id}
            restaurant={restaurant}
            draft={draftFor(restaurant.id)}
            onDraftChange={(next) => setDraft(restaurant.id, next)}
            onSaveRestaurant={(name, cuisine) => saveRestaurant(restaurant.id, name, cuisine)}
            onDeleteRestaurant={() => deleteRestaurant(restaurant.id)}
            onSaveDish={(dish) => saveDish(restaurant.id, dish)}
            onDeleteDish={(dishId) => deleteDish(restaurant.id, dishId)}
            onCreateDish={() => createDish(restaurant.id)}
          />
        ))}
      </section>
    </main>
  );
}

function RestaurantEditor({
  restaurant,
  draft,
  onDraftChange,
  onSaveRestaurant,
  onDeleteRestaurant,
  onSaveDish,
  onDeleteDish,
  onCreateDish,
}: {
  restaurant: Restaurant;
  draft: NewDishDraft;
  onDraftChange: (next: Partial<NewDishDraft>) => void;
  onSaveRestaurant: (name: string, cuisine: string) => void;
  onDeleteRestaurant: () => void;
  onSaveDish: (dish: Dish) => void;
  onDeleteDish: (dishId: string) => void;
  onCreateDish: () => void;
}) {
  const [name, setName] = useState(restaurant.name);
  const [cuisine, setCuisine] = useState(restaurant.cuisine);

  return (
    <section className="panel" aria-labelledby={`restaurant-${restaurant.id}`}>
      <div className="panelHeading">
        <div>
          <p className="eyebrow">{restaurant.id}</p>
          <h2 id={`restaurant-${restaurant.id}`}>{restaurant.name}</h2>
        </div>
        <span>{restaurant.menu.length} dishes</span>
      </div>
      <div className="panelBody">
        <div className="adminForm">
          <input className="intentInput" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="intentInput" value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
          <button type="button" className="secondaryButton" onClick={() => onSaveRestaurant(name, cuisine)}>
            Save
          </button>
          <button type="button" className="secondaryButton" onClick={onDeleteRestaurant}>
            Delete restaurant
          </button>
        </div>

        <div className="adminTableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Tags</th>
                <th>Allergens</th>
                <th>Status</th>
                <th>Prep min</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {restaurant.menu.map((dish) => (
                <DishRow key={dish.id} dish={dish} onSave={onSaveDish} onDelete={onDeleteDish} />
              ))}
              <tr>
                <td>
                  <input
                    className="intentInput"
                    placeholder="New dish name"
                    value={draft.name}
                    onChange={(e) => onDraftChange({ name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="intentInput"
                    placeholder="0.00"
                    value={draft.price}
                    onChange={(e) => onDraftChange({ price: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="intentInput"
                    placeholder="tag, tag"
                    value={draft.tags}
                    onChange={(e) => onDraftChange({ tags: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="intentInput"
                    placeholder="allergen, allergen"
                    value={draft.allergens}
                    onChange={(e) => onDraftChange({ allergens: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={draft.allergenStatus}
                    onChange={(e) =>
                      onDraftChange({ allergenStatus: e.target.value as "verified" | "unknown" })
                    }
                  >
                    <option value="verified">verified</option>
                    <option value="unknown">unknown</option>
                  </select>
                </td>
                <td>
                  <input
                    className="intentInput"
                    placeholder="min"
                    value={draft.preparationMinutes}
                    onChange={(e) => onDraftChange({ preparationMinutes: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={draft.available}
                    onChange={(e) => onDraftChange({ available: e.target.checked })}
                  />
                </td>
                <td>
                  <button type="button" className="primaryButton" onClick={onCreateDish}>
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DishRow({
  dish,
  onSave,
  onDelete,
}: {
  dish: Dish;
  onSave: (dish: Dish) => void;
  onDelete: (dishId: string) => void;
}) {
  const [draft, setDraft] = useState<Dish>(dish);

  return (
    <tr>
      <td>
        <input
          className="intentInput"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </td>
      <td>
        <input
          className="intentInput"
          value={draft.price}
          onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) || 0 }))}
        />
      </td>
      <td>
        <input
          className="intentInput"
          value={draft.tags.join(", ")}
          onChange={(e) => setDraft((d) => ({ ...d, tags: splitList(e.target.value) }))}
        />
      </td>
      <td>
        <input
          className="intentInput"
          value={draft.allergens.join(", ")}
          onChange={(e) => setDraft((d) => ({ ...d, allergens: splitList(e.target.value) }))}
        />
      </td>
      <td>
        <select
          value={draft.allergenStatus}
          onChange={(e) =>
            setDraft((d) => ({ ...d, allergenStatus: e.target.value as "verified" | "unknown" }))
          }
        >
          <option value="verified">verified</option>
          <option value="unknown">unknown</option>
        </select>
      </td>
      <td>
        <input
          className="intentInput"
          value={draft.preparationMinutes}
          onChange={(e) =>
            setDraft((d) => ({ ...d, preparationMinutes: Number(e.target.value) || 0 }))
          }
        />
      </td>
      <td>
        <input
          type="checkbox"
          checked={draft.available}
          onChange={(e) => setDraft((d) => ({ ...d, available: e.target.checked }))}
        />
      </td>
      <td className="adminRowActions">
        <button type="button" className="secondaryButton" onClick={() => onSave(draft)}>
          Save
        </button>
        <button type="button" className="secondaryButton" onClick={() => onDelete(dish.id)}>
          Delete
        </button>
      </td>
    </tr>
  );
}
