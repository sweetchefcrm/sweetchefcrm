import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MapClient from "@/components/map/MapClient";

export default async function MapPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <MapClient />;
}
