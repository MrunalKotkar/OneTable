import { NextResponse } from "next/server";
import { getTable, submitFeedback } from "@/server/table-store";
import { requireDiner } from "../../_session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await requireDiner();
  if (!who.ok) return who.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const liked = body?.liked === true;
  const note = typeof body?.note === "string" && body.note.length > 0 ? body.note : undefined;

  const result = await submitFeedback(id, who.diner.id, liked, note);
  if (!result.ok) {
    const status = result.reason === "Table not found." ? 404 : 409;
    return NextResponse.json({ error: "cannot_submit_feedback", message: result.reason }, { status });
  }
  return NextResponse.json(await getTable(id));
}
