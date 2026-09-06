import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/permissions";
import { Auth } from "@/components/UserScreens";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/dashboard");
  return <Auth />;
}
