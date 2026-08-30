import { NextResponse } from "next/server";
import { getOwnedGroupIdForDiner } from "@/server/identity";
import { getDinerProfile, getGroupHistory } from "@/server/table-store";
import { requireDiner } from "../../tables/_session";

/** A diner can only ever look at their own profile — no public profile browsing. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await requireDiner();
  if (!who.ok) return who.response;

  const { id } = await params;
  if (id !== who.diner.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const diner = await getDinerProfile(id);
  if (!diner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const groupId = await getOwnedGroupIdForDiner(id);
  const history = groupId ? await getGroupHistory(groupId) : [];
  return NextResponse.json({ diner, history });
}
