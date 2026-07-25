import { NextResponse } from "next/server";
import { getTable, reviseJordanBelief } from "@/server/table-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const table = reviseJordanBelief(id);
  if (!table) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(getTable(id));
}
