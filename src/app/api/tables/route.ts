import { NextResponse } from "next/server";
import { createTable } from "@/server/table-store";
import { requireDiner } from "./_session";

export async function POST(request: Request) {
  const who = await requireDiner();
  if (!who.ok) return who.response;

  const body = await request.json().catch(() => ({}));
  const intent = typeof body?.intent === "string" ? body.intent : "";
  const table = await createTable(who.diner.id, intent);
  return NextResponse.json({ id: table.id });
}
