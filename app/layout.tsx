import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import HideNavbarOnVault from "@/components/hide-navbar-on-vault";
import "./globals.css";
import SessionProviderWrapper from "@/components/session-provider";

export const metadata: Metadata = {
  title: "AI SITIKI",
  description: "AI siêu tiết kiệm",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <SessionProviderWrapper>
        <HideNavbarOnVault>
          <Navbar />
        </HideNavbarOnVault>
        {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}