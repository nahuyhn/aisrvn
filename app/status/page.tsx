import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trạng thái hệ thống | AI SITIKI",
  description: "Kiểm tra trạng thái cơ bản của AI SITIKI.",
};

export default async function StatusPage() {
  let databaseOk = true;
  let message = "Hoạt động bình thường";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseOk = false;
    message = error instanceof Error ? error.message : "Không kiểm tra được database";
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Trạng thái hệ thống</h1>
        <p className="mt-3 text-white/55">Kiểm tra nhanh kết nối database và trạng thái website.</p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm text-white/45">Database</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${databaseOk ? "bg-green-400" : "bg-red-400"}`} />
            <p className="font-semibold">{databaseOk ? "Đang hoạt động" : "Có lỗi"}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/60">{message}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/chat" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85">
            Về Chat
          </Link>
          <Link href="/contact" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/10">
            Báo lỗi
          </Link>
        </div>
      </div>
    </main>
  );
}
