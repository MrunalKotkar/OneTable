import { redirect } from "next/navigation";
import { catalogGateway } from "@/features/catalog";
import { isAdminRequest } from "@/lib/admin-auth";
import { AdminRestaurantsClient } from "./AdminRestaurantsClient";

export default async function AdminRestaurantsPage() {
  const authorized = await isAdminRequest();
  if (!authorized) {
    redirect("/admin/login");
  }

  const restaurants = await catalogGateway.listRestaurants();
  return <AdminRestaurantsClient initialRestaurants={restaurants} />;
}
