import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DbChatMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

type AiMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};

type SelectedModel = {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  category: string;
  isFree: boolean;
  supportsImage: boolean;
  supportsFile: boolean;
};

async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
  });
}

function createTitle(message: string) {
  const clean = message.trim().replace(/\s+/g, " ");

  if (!clean) return "Cuộc trò chuyện mới";

  if (clean.length <= 50) return clean;

  return clean.slice(0, 50) + "...";
}

async function getSelectedModel(modelId: string | null) {
  let selectedModel: SelectedModel | null = null;

  if (modelId) {
    selectedModel = await prisma.modelConfig.findFirst({
      where: {
        id: modelId,
        isActive: true,
        isFree: true,
      },
      select: {
        id: true,
        provider: true,
        model: true,
        displayName: true,
        category: true,
        isFree: true,
        supportsImage: true,
        supportsFile: true,
      },
    });
  }

  if (!selectedModel) {
    selectedModel = await prisma.modelConfig.findFirst({
      where: {
        isActive: true,
        isFree: true,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          displayName: "asc",
        },
      ],
      select: {
        id: true,
        provider: true,
        model: true,
        displayName: true,
        category: true,
        isFree: true,
        supportsImage: true,
        supportsFile: true,
      },
    });
  }

  if (!selectedModel) {
    throw new Error("Chưa có model miễn phí nào đang hoạt động.");
  }

  return selectedModel;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : null;

    const projectId =
      typeof body.projectId === "string" ? body.projectId : null;
    const modelId =
      typeof body.modelId === "string" ? body.modelId : null;

    const message = body.message;
    const attachments: ChatAttachment[] = Array.isArray(body.attachments)
  ? body.attachments.filter(
      (file: ChatAttachment) =>
        typeof file.name === "string" &&
        typeof file.type === "string" &&
        typeof file.dataUrl === "string" &&
        file.type.startsWith("image/")
    )
  : [];

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Tin nhắn không hợp lệ." },
        { status: 400 }
      );
    }
    const selectedModel = await getSelectedModel(modelId);
    if (attachments.length > 0 && !selectedModel.supportsImage) {
  return Response.json(
    {
      error: `Model ${selectedModel.displayName} chưa hỗ trợ hình ảnh.`,
    },
    { status: 400 }
  );
}
    const userContent =
  attachments.length > 0
    ? [
        {
          type: "text" as const,
          text: message,
        },
        ...attachments.map((file) => ({
          type: "image" as const,
          image: file.dataUrl,
        })),
      ]
    : message;

    const user = await getCurrentUser();
    if (user?.status === "BANNED") {
  return Response.json(
    { error: "Tài khoản của bạn đã bị khóa." },
    { status: 403 }
  );
}

    /**
     * Guest mode:
     * Người chưa đăng nhập vẫn được chat thử.
     * Không tạo ChatSession.
     * Không lưu ChatMessage.
     * Không lưu UsageLog.
     * Refresh trang là mất đoạn chat.
     */
    if (!user) {
      const result = await generateText({
  model: google(selectedModel.model),
  messages: [
    {
      role: "user",
      content: userContent,
    },
  ],
});

      return Response.json({
  sessionId: null,
  chatSession: null,
  answer: result.text,
  isGuest: true,
  model: {
    id: selectedModel.id,
    provider: selectedModel.provider,
    model: selectedModel.model,
    displayName: selectedModel.displayName,
  },
});
    }

    let chatSession:
      | Awaited<ReturnType<typeof prisma.chatSession.findFirst>>
      | Awaited<ReturnType<typeof prisma.chatSession.create>>
      | null = null;

    if (sessionId) {
      chatSession = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId: user.id,
        },
      });
    }

    if (!chatSession) {
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            userId: user.id,
          },
        });

        if (!project) {
          return Response.json(
            { error: "Project không tồn tại." },
            { status: 404 }
          );
        }
      }

      chatSession = await prisma.chatSession.create({
        data: {
          userId: user.id,
          projectId,
          title: createTitle(message),
        },
      });
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "USER",
        content: message,
      },
    });

    const history: DbChatMessage[] = await prisma.chatMessage.findMany({
      where: {
        sessionId: chatSession.id,
      },
      select: {
        role: true,
        content: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 20,
    });

    const aiMessages: AiMessage[] = history.map((item: DbChatMessage) => ({
      role:
        item.role === "USER"
          ? "user"
          : item.role === "ASSISTANT"
            ? "assistant"
            : "system",
      content: item.content,
    }));

    const result = await generateText({
  model: google(selectedModel.model),
  messages:
    attachments.length > 0
      ? [
          {
            role: "user",
            content: userContent,
          },
        ]
      : aiMessages,
});

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "ASSISTANT",
        content: result.text,
      },
    });

    const updatedChatSession = await prisma.chatSession.update({
      where: {
        id: chatSession.id,
      },
      data: {
        updatedAt: new Date(),
        title:
          chatSession.title === "Cuộc trò chuyện mới"
            ? createTitle(message)
            : chatSession.title,
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        updatedAt: true,
      },
    });

    await prisma.usageLog.create({
  data: {
    userId: user.id,
    provider: selectedModel.provider,
    model: selectedModel.model,
    inputTextLength: result.usage?.inputTokens ?? 0,
    outputTextLength: result.usage?.outputTokens ?? 0,
  },
});

    return Response.json({
  sessionId: updatedChatSession.id,
  chatSession: updatedChatSession,
  answer: assistantMessage.content,
  isGuest: false,
  model: {
    id: selectedModel.id,
    provider: selectedModel.provider,
    model: selectedModel.model,
    displayName: selectedModel.displayName,
  },
});
  } catch (error) {
    console.error("CHAT_API_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Có lỗi khi gọi AI.",
      },
      { status: 500 }
    );
  }
}