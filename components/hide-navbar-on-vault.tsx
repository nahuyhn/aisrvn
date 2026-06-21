"use client";

import { usePathname } from "next/navigation";

export default function HideNavbarOnVault({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const shouldHideNavbar =
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/vault-hbn");

  if (shouldHideNavbar) {
    return null;
  }

  return <>{children}</>;
}