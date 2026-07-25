import { NextResponse } from "next/server";
import { getAllDinerProfiles } from "@/server/table-store";

export async function GET() {
  return NextResponse.json({ diners: await getAllDinerProfiles() });
}
