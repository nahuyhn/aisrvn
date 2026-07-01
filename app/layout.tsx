import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import HideNavbarOnVault from "@/components/hide-navbar-on-vault";
import "./globals.css";
import SessionProviderWrapper from "@/components/session-provider";

export const metadata: Metadata = {
  title: "AI SITIKI - AI siêu tiết kiệm",
  description: "Trợ lý AI gọn nhẹ cho học tập, công việc và xử lý tài liệu.",
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