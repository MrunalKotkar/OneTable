import { NextResponse } from "next/server";
import { getDinerProfile, getGroupHistory } from "@/server/table-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const diner = getDinerProfile(id);
  if (!diner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ diner, history: getGroupHistory() });
}
