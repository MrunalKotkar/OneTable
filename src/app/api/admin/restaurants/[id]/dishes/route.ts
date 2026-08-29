import { NextResponse } from "next/server";
import { catalogGateway } from "@/features/catalog";
import { requireAdmin, slugify } from "../../../_guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id: restaurantId } = await params;
  const body = await request.json().catch(() => ({}));

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = Number(body?.price);
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];
  const allergens = Array.isArray(body?.allergens)
    ? body.allergens.filter((a: unknown) => typeof a === "string")
    : [];
  const allergenStatus = body?.allergenStatus === "unknown" ? "unknown" : "verified";
  const preparationMinutes = Number(body?.preparationMinutes);
  const available = body?.available !== false;

  if (!name || !Number.isFinite(price) || !Number.isFinite(preparationMinutes)) {
    return NextResponse.json(
      { error: "invalid_input", message: "Name, price, and preparation minutes are required." },
      { status: 400 },
    );
  }

  const id = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const dish = await catalogGateway.createDish({
      id,
      restaurantId,
      name,
      price,
      tags,
      allergens,
      allergenStatus,
      preparationMinutes,
      available,
    });
    return NextResponse.json({ dish }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "create_failed", message: error instanceof Error ? error.message : "Failed to create dish." },
      { status: 500 },
    );
  }
}
