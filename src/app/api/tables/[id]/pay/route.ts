import { NextResponse } from "next/server";
import { getTable, payForTable } from "@/server/table-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const forceFailure = body?.forceFailure === true;
  const result = payForTable(id, { forceFailure });
  if (!result.ok) {
    const status = result.reason === "Table not found." ? 404 : 409;
    return NextResponse.json({ error: "cannot_pay", message: result.reason }, { status });
  }
  return NextResponse.json(await getTable(id));
}
