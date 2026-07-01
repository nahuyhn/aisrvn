import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAccessibleModelsForUser,
  toPublicAiModel,
} from "@/lib/model-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    let userId: string | null = null;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (user?.status === "BANNED") {
        return Response.json(
          {
            error: "Tài khoản của bạn đã bị khóa.",
          },
          { status: 403 },
        );
      }

      userId = user?.id || null;
    }

    const models = await getAccessibleModelsForUser(userId);

    return Response.json({
      models: models.map(toPublicAiModel),
    });
  } catch (error) {
    console.error("GET_MODELS_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tải được AI.",
      },
      { status: 500 },
    );
  }
}
