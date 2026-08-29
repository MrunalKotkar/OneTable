import { NextResponse } from "next/server";
import { catalogGateway } from "@/features/catalog";
import { requireAdmin, slugify } from "../_guard";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const restaurants = await catalogGateway.listRestaurants();
  return NextResponse.json({ restaurants });
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const cuisine = typeof body?.cuisine === "string" ? body.cuisine.trim() : "";

  if (!name || !cuisine) {
    return NextResponse.json(
      { error: "invalid_input", message: "Name and cuisine are required." },
      { status: 400 },
    );
  }

  const id = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const restaurant = await catalogGateway.createRestaurant({ id, name, cuisine });
    return NextResponse.json({ restaurant }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "create_failed", message: error instanceof Error ? error.message : "Failed to create restaurant." },
      { status: 500 },
    );
  }
}
