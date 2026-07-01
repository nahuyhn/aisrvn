import { prisma } from "@/lib/prisma";

export type AccessibleModel = {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  description: string | null;
  category: string;
  isFree: boolean;
  supportsImage: boolean;
  supportsFile: boolean;
  sortOrder: number;
  isActive: boolean;
};

export class ModelAccessError extends Error {
  status = 403;

  constructor(message = "Bạn chưa có quyền sử dụng AI này. Vui lòng nâng cấp gói.") {
    super(message);
    this.name = "ModelAccessError";
  }
}

const modelSelect = {
  id: true,
  provider: true,
  model: true,
  displayName: true,
  description: true,
  category: true,
  isFree: true,
  supportsImage: true,
  supportsFile: true,
  sortOrder: true,
  isActive: true,
} as const;

function sortModels(models: AccessibleModel[]) {
  return [...models].sort((a, b) => {
    if (a.isFree !== b.isFree) {
      return a.isFree ? 1 : -1;
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.displayName.localeCompare(b.displayName, "vi");
  });
}

function dedupeModels(models: AccessibleModel[]) {
  const modelMap = new Map<string, AccessibleModel>();

  for (const model of models) {
    modelMap.set(model.id, model);
  }

  return sortModels(Array.from(modelMap.values()));
}

export function toPublicAiModel(model: AccessibleModel) {
  return {
    id: model.id,
    displayName: model.isFree ? "AI SITIKI" : "AI SITIKI Pro",
    description: model.isFree
      ? "Trợ lý AI miễn phí của AI SITIKI."
      : "Trợ lý AI nâng cấp dành cho tài khoản đã mua gói.",
    category: model.category,
    supportsImage: model.supportsImage,
    supportsFile: model.supportsFile,
    isFree: model.isFree,
    sortOrder: model.sortOrder,
  };
}

export async function getAccessibleModelsForUser(userId?: string | null) {
  const now = new Date();

  const freeModels = await prisma.modelConfig.findMany({
    where: {
      isActive: true,
      isFree: true,
    },
    select: modelSelect,
  });

  if (!userId) {
    return sortModels(freeModels);
  }

  const [activeSubscriptions, directModelAccesses] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        userId,
        status: "ACTIVE",
        startAt: {
          lte: now,
        },
        endAt: {
          gt: now,
        },
      },
      include: {
        plan: {
          include: {
            planModels: {
              include: {
                model: {
                  select: modelSelect,
                },
              },
            },
          },
        },
      },
    }),
    prisma.userModelAccess.findMany({
      where: {
        userId,
        expiresAt: {
          gt: now,
        },
        model: {
          isActive: true,
        },
      },
      include: {
        model: {
          select: modelSelect,
        },
      },
    }),
  ]);

  const subscriptionModels = activeSubscriptions.flatMap((subscription) =>
    subscription.plan.planModels
      .map((planModel) => planModel.model)
      .filter((model) => model.isActive),
  );

  const directModels = directModelAccesses.map((access) => access.model);

  return dedupeModels([...freeModels, ...subscriptionModels, ...directModels]);
}

export async function getSelectedAccessibleModel(
  userId: string | null,
  modelId: string | null,
) {
  const accessibleModels = await getAccessibleModelsForUser(userId);

  if (accessibleModels.length === 0) {
    throw new Error("Chưa có AI nào đang hoạt động.");
  }

  if (!modelId) {
    return accessibleModels[0];
  }

  const selectedModel = accessibleModels.find((model) => model.id === modelId);

  if (!selectedModel) {
    throw new ModelAccessError();
  }

  return selectedModel;
}
