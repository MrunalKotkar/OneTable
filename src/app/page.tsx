import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDinerForUser } from "@/server/identity";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  const diner = await getDinerForUser(session.user.id);
  if (!diner) {
    redirect("/signin");
  }

  return <HomeClient dinerName={diner.name} />;
}
