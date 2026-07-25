import { NextResponse } from "next/server";
import { approveTable, getTable } from "@/server/table-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = approveTable(id);
  if (!result.ok) {
    const status = result.reason === "Table not found." ? 404 : 409;
    return NextResponse.json({ error: "cannot_approve", message: result.reason }, { status });
  }
  return NextResponse.json(await getTable(id));
}
