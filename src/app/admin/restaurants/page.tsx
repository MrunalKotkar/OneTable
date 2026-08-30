import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { catalogGateway } from "@/features/catalog";
import { AdminRestaurantsClient } from "./AdminRestaurantsClient";

export default async function AdminRestaurantsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/signin?callbackUrl=/admin/restaurants");
  }

  const restaurants = await catalogGateway.listRestaurants();
  return <AdminRestaurantsClient initialRestaurants={restaurants} />;
}
