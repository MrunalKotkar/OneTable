import { NextResponse } from "next/server";
import { createTable } from "@/server/table-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const intent = typeof body?.intent === "string" ? body.intent : "";
  const table = createTable(intent);
  return NextResponse.json({ id: table.id });
}
