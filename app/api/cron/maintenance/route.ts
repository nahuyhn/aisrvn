import { NextRequest, NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Thiếu CRON_SECRET. Hãy thêm biến môi trường CRON_SECRET trước khi bật cron.",
      },
      { status: 500 },
    );
  }

  const urlToken = request.nextUrl.searchParams.get("secret") || "";
  const bearerToken = getBearerToken(request);

  if (urlToken !== cronSecret && bearerToken !== cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Không có quyền chạy maintenance.",
      },
      { status: 401 },
    );
  }

  const result = await runMaintenance({
    pendingOrderMaxAgeHours: 24,
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}
