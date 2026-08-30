import { NextResponse } from "next/server";
import { getTable, joinTable } from "@/server/table-store";
import { requireDiner } from "../../_session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await requireDiner();
  if (!who.ok) return who.response;

  const { id } = await params;
  const result = await joinTable(id, who.diner.id);
  if (!result.ok) {
    return NextResponse.json({ error: "not_found", message: result.reason }, { status: 404 });
  }
  return NextResponse.json(await getTable(id));
}
