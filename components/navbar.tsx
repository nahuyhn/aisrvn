import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const navItems = [
  {
    href: "/chat",
    label: "Chat",
  },
  {
    href: "/billing",
    label: "Thanh toán",
  },
  {
    href: "/terms",
    label: "Điều khoản",
  },
];

export default async function Navbar() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 text-white backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/chat" className="shrink-0 leading-tight">
          <span className="block text-lg font-bold tracking-tight">
            AI SITIKI
          </span>

          <span className="block text-[10px] text-white/45">
            AI siêu tiết kiệm
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-sm text-white/65 sm:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap px-1 py-2 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {session?.user ? (
          <Link
            href="/api/auth/signout"
            className="hidden shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10 sm:block"
          >
            Đăng xuất
          </Link>
        ) : (
          <Link
            href="/login"
            className="hidden shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 sm:block"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}