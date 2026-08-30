import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDinerForUser } from "@/server/identity";
import { TableClient } from "./TableClient";

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/table/${id}`)}`);
  }

  const diner = await getDinerForUser(session.user.id);
  if (!diner) {
    // Shouldn't happen — authorize() always ensures a diner exists — but
    // fail safe rather than render with no identity at all.
    redirect("/signin");
  }

  return <TableClient tableId={id} you={diner.id} />;
}
