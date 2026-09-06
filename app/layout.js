import { Inter, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { getOptionalUser } from "@/lib/permissions";
import { ADMIN_NAV, canSeeAdminNav } from "@/lib/adminNav";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/ToastProvider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata = {
  title: "FEAR Bets — parimutuel betting",
  description: "In-game parimutuel racing betting for the FEAR FiveM roleplay server.",
};

export default async function RootLayout({ children }) {
  const sessionUser = await getOptionalUser();
  const perms = sessionUser?.role?.perms || [];
  const adminHref = sessionUser?.role
    ? (ADMIN_NAV.find(item => canSeeAdminNav(item, perms))?.href || null)
    : null;

  return (
    <html lang="en" className={`${inter.variable} ${plex.variable}`}>
      <body>
        <ToastProvider>
          <Nav sessionUser={sessionUser} balance={sessionUser?.confirmedBalance || 0} adminHref={adminHref} />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
