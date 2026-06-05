import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : null;

    const projectId =
      typeof body.projectId === "string" ? body.projectId : null;

    const message = body.message;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Tin nhắn không hợp lệ." },
        { status: 400 }
      );
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

    type AiMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type DbChatMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

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
      model: google("gemini-2.5-flash"),
      messages: aiMessages,
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
        provider: "Google",
        model: "gemini-2.5-flash",
        inputTextLength: result.usage?.inputTokens ?? 0,
        outputTextLength: result.usage?.outputTokens ?? 0,
      },
    });

    return Response.json({
      sessionId: updatedChatSession.id,
      chatSession: updatedChatSession,
      answer: assistantMessage.content,
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