import { NextResponse } from "next/server";
import { getTable, reviseJordanBelief } from "@/server/table-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await reviseJordanBelief(id);
  if (!result.ok) {
    return NextResponse.json({ error: "not_found", message: result.reason }, { status: 404 });
  }
  return NextResponse.json(await getTable(id));
}
