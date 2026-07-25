import { NextResponse } from "next/server";
import { resetAll } from "@/server/table-store";

export async function POST() {
  resetAll();
  return NextResponse.json({ ok: true });
}
