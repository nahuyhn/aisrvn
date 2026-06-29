import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
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
  kind: "image" | "file";
  dataUrl?: string;
  textContent?: string;
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

type CurrentChatSession = {
  id: string;
  title: string;
  projectId: string | null;
  summary: string | null;
  summaryMessageCount: number;
};

const GUEST_DAILY_LIMIT_PER_IP = 3;
const FREE_USER_DAILY_LIMIT = 20;
const GUEST_MAX_MESSAGE_LENGTH = 800;
const USER_MAX_MESSAGE_LENGTH = 4000;

const MAX_IMAGE_ATTACHMENTS = 2;
const MAX_FILE_ATTACHMENTS = 1;
const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;
const MAX_FILE_TEXT_CHARS = 12_000;

const SYSTEM_PROMPT = `
Bạn là AI SITIKI, trợ lý AI tiếng Việt.
Trả lời trực tiếp, rõ ý, không lan man.
Ưu tiên câu trả lời ngắn nhưng đủ dùng.
Nếu câu hỏi cần nhiều bước, hãy chia thành từng bước ngắn.
Nếu nội dung quá dài, hãy làm phần quan trọng trước và nói người dùng nhắn "tiếp" để làm tiếp.
Không tự nhắc lại toàn bộ câu hỏi của người dùng.
Không viết mở bài/kết bài dài nếu không cần.
`.trim();

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_CHARS = 1200;
const MAX_SUMMARY_CHARS = 1800;

const guestUsageMap = new Map<string, { count: number; resetAt: number }>();

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

function cleanUserInput(input: string) {
  return input
    .replace(/\u200B/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;

  return (
    text.slice(0, maxChars).trim() +
    "\n\n[Nội dung phía sau đã được rút gọn để tiết kiệm xử lý.]"
  );
}

function getOutputBudget(message: string, isPaidUser: boolean) {
  const lower = message.toLowerCase();

  const wantsLongAnswer =
    lower.includes("chi tiết") ||
    lower.includes("đầy đủ") ||
    lower.includes("báo cáo") ||
    lower.includes("viết bài") ||
    lower.includes("phân tích") ||
    lower.includes("code") ||
    lower.includes("source") ||
    lower.includes("giải thích");

  const wantsVeryShortAnswer =
    lower.includes("ngắn gọn") ||
    lower.includes("trả lời nhanh") ||
    lower.includes("tóm tắt") ||
    lower.includes("ý chính");

  if (wantsVeryShortAnswer) {
    return isPaidUser ? 700 : 500;
  }

  if (wantsLongAnswer) {
    return isPaidUser ? 1600 : 900;
  }

  return isPaidUser ? 1000 : 700;
}

function optimizeHistoryForAi(
  history: DbChatMessage[],
  summary: string | null,
) {
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);

  const messages: AiMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
  ];

  if (summary?.trim()) {
    messages.push({
      role: "system",
      content:
        "Tóm tắt ngữ cảnh cũ của cuộc trò chuyện:\n" +
        truncateText(summary.trim(), MAX_SUMMARY_CHARS),
    });
  }

  for (const item of recentHistory) {
    messages.push({
      role:
        item.role === "USER"
          ? "user"
          : item.role === "ASSISTANT"
            ? "assistant"
            : "system",
      content: truncateText(item.content, MAX_HISTORY_MESSAGE_CHARS),
    });
  }

  return messages;
}

function createTitle(message: string) {
  let clean = message
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^hãy\s+/i, "")
    .replace(/^giúp tôi\s+/i, "")
    .replace(/^làm cho tôi\s+/i, "")
    .replace(/^cho tôi\s+/i, "")
    .replace(/^tôi muốn\s+/i, "")
    .replace(/^bạn hãy\s+/i, "");

  if (!clean) return "Cuộc trò chuyện mới";

  const separators = [".", "?", "!", "\n"];

  for (const sep of separators) {
    const index = clean.indexOf(sep);

    if (index > 8) {
      clean = clean.slice(0, index);
      break;
    }
  }

  if (clean.length <= 36) return clean;

  return clean.slice(0, 36).trim() + "...";
}

function getAiModel(selectedModel: SelectedModel) {
  const provider = selectedModel.provider.toLowerCase().trim();

  if (provider === "google") {
    return google(selectedModel.model);
  }

  if (provider === "openai") {
    return openai(selectedModel.model);
  }

  throw new Error(`Provider AI chưa được hỗ trợ: ${selectedModel.provider}`);
}

function getTodayStart() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function getTomorrowStartMs() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  ).getTime();
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return realIp || "unknown";
}

function checkGuestLimit(req: Request) {
  const ip = getClientIp(req);
  const now = Date.now();
  const key = `guest:${ip}`;

  const current = guestUsageMap.get(key);

  if (!current || current.resetAt <= now) {
    guestUsageMap.set(key, {
      count: 1,
      resetAt: getTomorrowStartMs(),
    });

    return {
      allowed: true,
      remaining: GUEST_DAILY_LIMIT_PER_IP - 1,
    };
  }

  if (current.count >= GUEST_DAILY_LIMIT_PER_IP) {
    return {
      allowed: false,
      remaining: 0,
    };
  }

  current.count += 1;
  guestUsageMap.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, GUEST_DAILY_LIMIT_PER_IP - current.count),
  };
}

async function getUserDailyLimit(userId: string) {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      endAt: {
        gt: new Date(),
      },
    },
    include: {
      plan: true,
    },
    orderBy: {
      endAt: "desc",
    },
  });

  return activeSubscription?.plan.messageLimitPerDay || FREE_USER_DAILY_LIMIT;
}

async function checkUserDailyLimit(userId: string) {
  const limit = await getUserDailyLimit(userId);

  const usedToday = await prisma.usageLog.count({
    where: {
      userId,
      createdAt: {
        gte: getTodayStart(),
      },
    },
  });

  return {
    allowed: usedToday < limit,
    usedToday,
    limit,
    remaining: Math.max(0, limit - usedToday),
  };
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
    throw new Error("Chưa có AI miễn phí nào đang hoạt động.");
  }

  return selectedModel;
}

function parseAttachments(bodyAttachments: unknown) {
  const attachments: ChatAttachment[] = Array.isArray(bodyAttachments)
    ? bodyAttachments
        .filter(
          (file: ChatAttachment) =>
            typeof file.name === "string" &&
            typeof file.type === "string" &&
            (file.kind === "image" || file.kind === "file"),
        )
        .slice(0, MAX_IMAGE_ATTACHMENTS + MAX_FILE_ATTACHMENTS)
    : [];

  const imageAttachments = attachments
    .filter(
      (file) =>
        file.kind === "image" &&
        typeof file.dataUrl === "string" &&
        file.type.startsWith("image/"),
    )
    .slice(0, MAX_IMAGE_ATTACHMENTS);

  const fileAttachments = attachments
    .filter(
      (file) => file.kind === "file" && typeof file.textContent === "string",
    )
    .slice(0, MAX_FILE_ATTACHMENTS);

  return {
    imageAttachments,
    fileAttachments,
  };
}

function buildUserContent(params: {
  cleanMessage: string;
  imageAttachments: ChatAttachment[];
  fileAttachments: ChatAttachment[];
}) {
  const { cleanMessage, imageAttachments, fileAttachments } = params;

  const fileContext =
    fileAttachments.length > 0
      ? fileAttachments
          .map((file, index) => {
            const text = truncateText(
              (file.textContent || "").trim(),
              MAX_FILE_TEXT_CHARS,
            );

            return `TÀI LIỆU ĐÍNH KÈM ${index + 1}
Tên file: ${file.name}

NỘI DUNG ĐÃ TRÍCH XUẤT:
${text}`;
          })
          .join("\n\n====================\n\n")
      : "";

  const basePrompt =
    cleanMessage ||
    (imageAttachments.length > 0
      ? "Hãy phân tích ảnh được gửi kèm."
      : "Hãy đọc và xử lý tài liệu được gửi kèm.");

  const textPrompt = fileContext
    ? `${basePrompt}

Lưu ý quan trọng:
Người dùng đã gửi file. Nội dung file đã được hệ thống trích xuất bên dưới.
Bạn phải đọc phần NỘI DUNG ĐÃ TRÍCH XUẤT để trả lời.
Không được nói rằng bạn không thể truy cập file.

${fileContext}`
    : imageAttachments.length > 0
      ? `${basePrompt}

Lưu ý quan trọng:
Người dùng đã gửi ảnh trực tiếp trong request này.
Bạn phải phân tích ảnh được gửi kèm.
Không được nói rằng bạn không thể xem ảnh.`
      : basePrompt;

  if (imageAttachments.length === 0) {
    return textPrompt;
  }

  return [
    {
      type: "text" as const,
      text: textPrompt,
    },
    ...imageAttachments.map((file) => ({
      type: "image" as const,
      image: file.dataUrl!,
      mediaType: file.type || "image/jpeg",
    })),
  ];
}

function validateAttachments(params: {
  imageAttachments: ChatAttachment[];
  fileAttachments: ChatAttachment[];
  selectedModel: SelectedModel;
}) {
  const { imageAttachments, fileAttachments, selectedModel } = params;

  for (const file of imageAttachments) {
    if ((file.dataUrl || "").length > MAX_IMAGE_DATA_URL_LENGTH) {
      return Response.json(
        {
          error: "Ảnh quá lớn. Vui lòng gửi ảnh nhẹ hơn để giảm chi phí xử lý.",
        },
        { status: 400 },
      );
    }
  }

  for (const file of fileAttachments) {
    if ((file.textContent || "").length > MAX_FILE_TEXT_CHARS) {
      return Response.json(
        {
          error: "Nội dung file quá dài. Vui lòng rút gọn file.",
        },
        { status: 400 },
      );
    }
  }

  if (imageAttachments.length > 0 && !selectedModel.supportsImage) {
    return Response.json(
      {
        error: `AI ${selectedModel.displayName} hiện chưa hỗ trợ hình ảnh.`,
      },
      { status: 400 },
    );
  }

  if (fileAttachments.length > 0 && !selectedModel.supportsFile) {
    return Response.json(
      {
        error: `AI ${selectedModel.displayName} hiện chưa hỗ trợ tệp đính kèm.`,
      },
      { status: 400 },
    );
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : null;

    const projectId =
      typeof body.projectId === "string" ? body.projectId : null;

    const modelId = typeof body.modelId === "string" ? body.modelId : null;

    const message = body.message;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Tin nhắn không hợp lệ." },
        { status: 400 },
      );
    }

    const cleanMessage = cleanUserInput(message);

    if (!cleanMessage) {
      return Response.json(
        { error: "Tin nhắn không được để trống." },
        { status: 400 },
      );
    }

    const selectedModel = await getSelectedModel(modelId);

    const { imageAttachments, fileAttachments } = parseAttachments(
      body.attachments,
    );

    console.log("ATTACHMENT_DEBUG:", {
  rawAttachments: Array.isArray(body.attachments)
    ? body.attachments.length
    : 0,
  imageCount: imageAttachments.length,
  fileCount: fileAttachments.length,
  firstImageLength: imageAttachments[0]?.dataUrl?.length || 0,
  firstFileChars: fileAttachments[0]?.textContent?.length || 0,
});

    const attachmentError = validateAttachments({
      imageAttachments,
      fileAttachments,
      selectedModel,
    });

    if (attachmentError) {
      return attachmentError;
    }

    const userContent = buildUserContent({
      cleanMessage,
      imageAttachments,
      fileAttachments,
    });

    const user = await getCurrentUser();

    if (user?.status === "BANNED") {
      return Response.json(
        { error: "Tài khoản của bạn đã bị khóa." },
        { status: 403 },
      );
    }

    if (!user) {
      if (cleanMessage.length > GUEST_MAX_MESSAGE_LENGTH) {
        return Response.json(
          {
            error: `Tin nhắn dùng thử quá dài. Vui lòng nhập tối đa ${GUEST_MAX_MESSAGE_LENGTH} ký tự.`,
          },
          { status: 400 },
        );
      }

      if (imageAttachments.length > 0 || fileAttachments.length > 0) {
        return Response.json(
          {
            error:
              "Khách dùng thử chưa được gửi ảnh hoặc file. Vui lòng đăng nhập để sử dụng.",
          },
          { status: 403 },
        );
      }

      const guestLimit = checkGuestLimit(req);

      if (!guestLimit.allowed) {
        return Response.json(
          {
            error:
              "Bạn đã hết lượt dùng thử hôm nay. Vui lòng đăng nhập để tiếp tục sử dụng.",
          },
          { status: 429 },
        );
      }

      const messagesForAi =
  imageAttachments.length > 0
    ? [
        {
          role: "system" as const,
          content: SYSTEM_PROMPT,
        },
        {
          role: "user" as const,
          content: userContent as any,
        },
      ]
    : [
        ...aiMessages,
        {
          role: "user" as const,
          content: userContent as string,
        },
      ];

console.log("AI_INPUT_DEBUG:", {
  cleanMessage,
  imageCount: imageAttachments.length,
  fileCount: fileAttachments.length,
  firstImageType: imageAttachments[0]?.type || "",
  firstImageLength: imageAttachments[0]?.dataUrl?.length || 0,
  firstFileName: fileAttachments[0]?.name || "",
  firstFileChars: fileAttachments[0]?.textContent?.length || 0,
  userContentPreview:
    typeof userContent === "string"
      ? userContent.slice(0, 500)
      : JSON.stringify(userContent).slice(0, 500),
});

const result = streamText({
  model: getAiModel(selectedModel),
  maxOutputTokens: getOutputBudget(
    cleanMessage,
    selectedModel.isFree === false,
  ),
  messages: messagesForAi,
});

      const encoder = new TextEncoder();

      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              for await (const textDelta of result.textStream) {
                controller.enqueue(encoder.encode(textDelta));
              }

              controller.close();
            } catch (error) {
              console.error("GUEST_STREAM_ERROR:", error);
              controller.error(error);
            }
          },
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "x-is-guest": "true",
          },
        },
      );
    }

    if (cleanMessage.length > USER_MAX_MESSAGE_LENGTH) {
      return Response.json(
        {
          error: `Tin nhắn quá dài. Vui lòng nhập tối đa ${USER_MAX_MESSAGE_LENGTH} ký tự để tiết kiệm xử lý.`,
        },
        { status: 400 },
      );
    }

    const dailyLimit = await checkUserDailyLimit(user.id);

    if (!dailyLimit.allowed) {
      return Response.json(
        {
          error: `Bạn đã dùng hết ${dailyLimit.limit} lượt hôm nay. Vui lòng quay lại ngày mai hoặc nâng cấp gói.`,
          usedToday: dailyLimit.usedToday,
          limit: dailyLimit.limit,
          remaining: 0,
        },
        { status: 429 },
      );
    }

    let chatSession: CurrentChatSession | null = null;

    if (sessionId) {
      chatSession = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          userId: user.id,
        },
        select: {
          id: true,
          title: true,
          projectId: true,
          summary: true,
          summaryMessageCount: true,
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
            { status: 404 },
          );
        }
      }

      chatSession = await prisma.chatSession.create({
        data: {
          userId: user.id,
          projectId,
          title: createTitle(cleanMessage),
        },
        select: {
          id: true,
          title: true,
          projectId: true,
          summary: true,
          summaryMessageCount: true,
        },
      });
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "USER",
        content: cleanMessage,
      },
    });

    const recentHistoryDesc: DbChatMessage[] =
      await prisma.chatMessage.findMany({
        where: {
          sessionId: chatSession.id,
        },
        select: {
          role: true,
          content: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: MAX_HISTORY_MESSAGES,
      });

    const history = recentHistoryDesc.reverse();

    const aiMessages = optimizeHistoryForAi(history, chatSession.summary);

    const result = streamText({
      model: getAiModel(selectedModel),
      maxOutputTokens: getOutputBudget(
        cleanMessage,
        selectedModel.isFree === false,
      ),
      messages:
        imageAttachments.length > 0
          ? [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: userContent as any,
              },
            ]
          : fileAttachments.length > 0
            ? [
                ...aiMessages,
                {
                  role: "user",
                  content: userContent as string,
                },
              ]
            : aiMessages,
    });

    const encoder = new TextEncoder();
    const currentSessionId = chatSession.id;
    const currentSessionTitle = chatSession.title;
    const currentProjectId = chatSession.projectId || "";

    return new Response(
      new ReadableStream({
        async start(controller) {
          let fullText = "";

          try {
            for await (const textDelta of result.textStream) {
              fullText += textDelta;
              controller.enqueue(encoder.encode(textDelta));
            }

            await prisma.chatMessage.create({
              data: {
                sessionId: currentSessionId,
                role: "ASSISTANT",
                content: fullText,
              },
            });

            await prisma.chatSession.update({
              where: {
                id: currentSessionId,
              },
              data: {
                updatedAt: new Date(),
              },
            });

            await prisma.usageLog.create({
              data: {
                userId: user.id,
                provider: selectedModel.provider,
                model: selectedModel.model,
                inputTextLength: cleanMessage.length,
                outputTextLength: fullText.length,
              },
            });

            controller.close();
          } catch (error) {
            console.error("USER_STREAM_ERROR:", error);
            controller.error(error);
          }
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "x-is-guest": "false",
          "x-session-id": currentSessionId,
          "x-session-title": encodeURIComponent(currentSessionTitle),
          "x-project-id": currentProjectId,
        },
      },
    );
  } catch (error) {
    console.error("CHAT_STREAM_API_ERROR:", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Có lỗi khi stream AI.",
      },
      { status: 500 },
    );
  }
}
