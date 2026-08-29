import { NextResponse } from "next/server";
import { catalogGateway } from "@/features/catalog";
import { requireAdmin } from "../../../../_guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; dishId: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id: restaurantId, dishId } = await params;
  const body = await request.json().catch(() => ({}));

  const update: Parameters<typeof catalogGateway.updateDish>[2] = {};
  if (typeof body?.name === "string") update.name = body.name.trim();
  if (body?.price !== undefined && Number.isFinite(Number(body.price))) update.price = Number(body.price);
  if (Array.isArray(body?.tags)) update.tags = body.tags.filter((t: unknown) => typeof t === "string");
  if (Array.isArray(body?.allergens))
    update.allergens = body.allergens.filter((a: unknown) => typeof a === "string");
  if (body?.allergenStatus === "verified" || body?.allergenStatus === "unknown")
    update.allergenStatus = body.allergenStatus;
  if (body?.preparationMinutes !== undefined && Number.isFinite(Number(body.preparationMinutes)))
    update.preparationMinutes = Number(body.preparationMinutes);
  if (typeof body?.available === "boolean") update.available = body.available;

  try {
    const dish = await catalogGateway.updateDish(restaurantId, dishId, update);
    return NextResponse.json({ dish });
  } catch (error) {
    return NextResponse.json(
      { error: "update_failed", message: error instanceof Error ? error.message : "Failed to update dish." },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; dishId: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id: restaurantId, dishId } = await params;
  await catalogGateway.deleteDish(restaurantId, dishId);
  return NextResponse.json({ ok: true });
}
