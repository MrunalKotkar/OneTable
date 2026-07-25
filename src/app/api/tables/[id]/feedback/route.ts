import { NextResponse } from "next/server";
import { getTable, submitFeedback } from "@/server/table-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const dinerId = typeof body?.dinerId === "string" ? body.dinerId : "";
  const liked = body?.liked === true;
  const note = typeof body?.note === "string" && body.note.length > 0 ? body.note : undefined;

  const result = await submitFeedback(id, dinerId, liked, note);
  if (!result.ok) {
    const status = result.reason === "Table not found." ? 404 : 409;
    return NextResponse.json({ error: "cannot_submit_feedback", message: result.reason }, { status });
  }
  return NextResponse.json(await getTable(id));
}
