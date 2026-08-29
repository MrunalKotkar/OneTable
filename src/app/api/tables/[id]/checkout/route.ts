import { NextResponse } from "next/server";
import { getTable, startCheckout } from "@/server/table-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await startCheckout(id);
  if (!result.ok) {
    const status = result.reason === "Table not found." ? 404 : 409;
    return NextResponse.json({ error: "cannot_start_checkout", message: result.reason }, { status });
  }
  return NextResponse.json(await getTable(id));
}
