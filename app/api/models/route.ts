import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    const models = await prisma.modelConfig.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        model: true,
        displayName: true,
        description: true,
        category: true,
        supportsImage: true,
        supportsFile: true,
        isFree: true,
        sortOrder: true,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          displayName: "asc",
        },
      ],
    });

    /**
     * Hiện tại:
     * - Guest: chỉ thấy model free
     * - User đăng nhập: tạm thời cũng chỉ thấy model free
     *
     * Sau này:
     * - User mua gói model nào thì trả thêm model đó.
     */
    const visibleModels = session?.user?.email
      ? models.filter((model) => model.isFree)
      : models.filter((model) => model.isFree);

    return Response.json({
      models: visibleModels,
    });
  } catch (error) {
    console.error("GET_MODELS_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách model.",
      },
      { status: 500 }
    );
  }
}