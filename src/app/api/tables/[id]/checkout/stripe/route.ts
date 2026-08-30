import { NextResponse } from "next/server";
import { startStripeCheckout } from "@/server/table-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await startStripeCheckout(id);
  if (!result.ok) {
    return NextResponse.json({ error: "cannot_start_stripe_checkout", message: result.reason }, { status: 409 });
  }
  return NextResponse.json({ url: result.url });
}
