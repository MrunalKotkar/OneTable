import { NextResponse } from "next/server";
import { catalogGateway } from "@/features/catalog";
import { requireAdmin } from "../../_guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const cuisine = typeof body?.cuisine === "string" ? body.cuisine.trim() : undefined;

  try {
    const restaurant = await catalogGateway.updateRestaurant(id, { name, cuisine });
    return NextResponse.json({ restaurant });
  } catch (error) {
    return NextResponse.json(
      { error: "update_failed", message: error instanceof Error ? error.message : "Failed to update restaurant." },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  try {
    await catalogGateway.deleteRestaurant(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "delete_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete restaurant — it may still be referenced by a table's order history.",
      },
      { status: 409 },
    );
  }
}
