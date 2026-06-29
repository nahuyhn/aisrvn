import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const model = await prisma.modelConfig.findFirst({
      where: {
        isActive: true,
        isFree: true,
      },
      select: {
        id: true,
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

    return Response.json({
      models: model
        ? [
            {
              ...model,
              displayName: "AI SITIKI",
              description: "Trợ lý AI của AI SITIKI.",
            },
          ]
        : [],
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
      { status: 500 }
    );
  }
}