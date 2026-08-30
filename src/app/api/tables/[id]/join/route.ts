import { NextResponse } from "next/server";
import { getTable, joinTable } from "@/server/table-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const dinerId = typeof body?.dinerId === "string" ? body.dinerId : "";
  const result = await joinTable(id, dinerId);
  if (!result.ok) {
    return NextResponse.json({ error: "not_found", message: result.reason }, { status: 404 });
  }
  return NextResponse.json(await getTable(id));
}
