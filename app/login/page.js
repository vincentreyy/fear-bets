import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/permissions";
import { Auth } from "@/components/UserScreens";

export default async function LoginPage() {
  const user = await getOptionalUser();
  // A user who still has mustChangePassword can't be sent to /dashboard yet —
  // Next.js re-runs this server component right after the login Server
  // Action resolves, so redirecting here unconditionally would skip the
  // forced password-change step the Auth component is about to show.
  if (user && !user.mustChangePassword) redirect("/dashboard");
  return <Auth forcePasswordChange={!!user?.mustChangePassword} />;
}
