"use client";

import { usePathname } from "next/navigation";

export default function HideNavbarOnVault({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/vault-hbn")) {
    return null;
  }

  return <>{children}</>;
}