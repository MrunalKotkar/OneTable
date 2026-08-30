import { NextResponse } from "next/server";
import type { BeliefKind } from "@/domain/contracts";
import { getTable, reviseBelief } from "@/server/table-store";
import { requireDiner } from "../../_session";

const VALID_KINDS: BeliefKind[] = ["allergy", "diet", "budget", "goal", "preference", "dislike"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await requireDiner();
  if (!who.ok) return who.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const kind = typeof body?.kind === "string" && VALID_KINDS.includes(body.kind as BeliefKind)
    ? (body.kind as BeliefKind)
    : null;
  const value =
    kind === "budget"
      ? Number(body?.value)
      : typeof body?.value === "string"
        ? body.value.trim()
        : "";
  const correctionText = typeof body?.correctionText === "string" ? body.correctionText.trim() : "";

  if (!kind || value === "" || (kind === "budget" && !Number.isFinite(value)) || !correctionText) {
    return NextResponse.json(
      { error: "invalid_input", message: "kind, value, and correctionText are required." },
      { status: 400 },
    );
  }

  const result = await reviseBelief(id, who.diner.id, kind, value, correctionText);
  if (!result.ok) {
    const status = result.reason === "Table not found." ? 404 : 409;
    return NextResponse.json({ error: "cannot_revise", message: result.reason }, { status });
  }
  return NextResponse.json(await getTable(id));
}
