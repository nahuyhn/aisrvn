import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import HideNavbarOnVault from "@/components/hide-navbar-on-vault";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Wrapper",
  description: "AI Wrapper SaaS web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <HideNavbarOnVault>
          <Navbar />
        </HideNavbarOnVault>
        {children}
      </body>
    </html>
  );
}