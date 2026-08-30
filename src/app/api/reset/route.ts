import { NextResponse } from "next/server";
import { resetAll } from "@/server/table-store";

export async function POST() {
  await resetAll();
  return NextResponse.json({ ok: true });
}
