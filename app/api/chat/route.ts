import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSelectedAccessibleModel,
  ModelAccessError,
  toPublicAiModel,
  type AccessibleModel,
} from "@/lib/model-access";
import { generateTextWithAiRouter } from "@/lib/ai-router";

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
  kind?: "image" | "file";
  dataUrl?: string;
  textContent?: string;
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

const SUMMARY_SYSTEM_PROMPT = `
Bạn là bộ phận tóm tắt nội bộ của AI SITIKI.
Nhiệm vụ: cập nhật bản tóm tắt ngắn của cuộc trò chuyện.
Chỉ giữ thông tin quan trọng: mục tiêu, yêu cầu, quyết định đã chốt, dữ liệu người dùng đưa, lỗi đang xử lý, bước tiếp theo.
Không thêm suy đoán.
Không viết dài.
Tối đa khoảng 1200 ký tự.
`.trim();

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_MESSAGE_CHARS = 1200;
const SUMMARY_TRIGGER_MESSAGE_COUNT = 16;
const SUMMARY_UPDATE_EVERY_MESSAGES = 12;
const MAX_SUMMARY_CHARS = 1800;
const MAX_SUMMARY_SOURCE_MESSAGE_CHARS = 800;

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

function parseAttachments(bodyAttachments: unknown) {
  const attachments: ChatAttachment[] = Array.isArray(bodyAttachments)
    ? bodyAttachments
        .filter(
          (file: ChatAttachment) =>
            typeof file.name === "string" &&
            typeof file.type === "string" &&
            (file.kind === "image" || file.kind === "file" || !file.kind),
        )
        .slice(0, MAX_IMAGE_ATTACHMENTS + MAX_FILE_ATTACHMENTS)
    : [];

  const imageAttachments = attachments
    .filter(
      (file) =>
        (file.kind === "image" || !file.kind) &&
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
  selectedModel: AccessibleModel;
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

async function maybeUpdateChatSummary(params: {
  sessionId: string;
  currentSummary: string | null;
  summaryMessageCount: number;
  selectedModel: AccessibleModel;
}) {
  const { sessionId, currentSummary, summaryMessageCount, selectedModel } =
    params;

  const totalMessages = await prisma.chatMessage.count({
    where: {
      sessionId,
    },
  });

  if (totalMessages < SUMMARY_TRIGGER_MESSAGE_COUNT) {
    return;
  }

  if (totalMessages - summaryMessageCount < SUMMARY_UPDATE_EVERY_MESSAGES) {
    return;
  }

  const messagesCoveredByNewSummary = Math.max(
    0,
    totalMessages - MAX_HISTORY_MESSAGES,
  );

  if (messagesCoveredByNewSummary <= summaryMessageCount) {
    return;
  }

  const newMessagesToSummarizeCount =
    messagesCoveredByNewSummary - summaryMessageCount;

  if (newMessagesToSummarizeCount <= 0) {
    return;
  }

  const messagesToSummarize = await prisma.chatMessage.findMany({
    where: {
      sessionId,
    },
    select: {
      role: true,
      content: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    skip: summaryMessageCount,
    take: newMessagesToSummarizeCount,
  });

  if (messagesToSummarize.length === 0) {
    return;
  }

  const sourceText = messagesToSummarize
    .map((item) => {
      const role =
        item.role === "USER"
          ? "Người dùng"
          : item.role === "ASSISTANT"
            ? "AI"
            : "Hệ thống";

      return `${role}: ${truncateText(
        item.content,
        MAX_SUMMARY_SOURCE_MESSAGE_CHARS,
      )}`;
    })
    .join("\n\n");

  const result = await generateTextWithAiRouter({
    selectedModel,
    maxOutputTokens: 500,
    requiresVision: false,
    messages: [
      {
        role: "system",
        content: SUMMARY_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `
Tóm tắt cũ:
${currentSummary?.trim() || "(chưa có)"}

Tin nhắn mới cần nhập vào tóm tắt:
${sourceText}

Hãy tạo bản tóm tắt mới ngắn gọn, đủ ngữ cảnh để AI tiếp tục hỗ trợ người dùng ở các câu sau.
`.trim(),
      },
    ],
  });

  await prisma.chatSession.update({
    where: {
      id: sessionId,
    },
    data: {
      summary: truncateText(result.text.trim(), MAX_SUMMARY_CHARS),
      summaryMessageCount: messagesCoveredByNewSummary,
    },
  });
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

    const user = await getCurrentUser();

    if (user?.status === "BANNED") {
      return Response.json(
        { error: "Tài khoản của bạn đã bị khóa." },
        { status: 403 },
      );
    }

    let selectedModel: AccessibleModel;

    try {
      selectedModel = await getSelectedAccessibleModel(user?.id || null, modelId);
    } catch (error) {
      if (error instanceof ModelAccessError) {
        return Response.json(
          { error: error.message },
          { status: error.status },
        );
      }

      throw error;
    }

    const { imageAttachments, fileAttachments } = parseAttachments(
      body.attachments,
    );

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

      const result = await generateTextWithAiRouter({
        selectedModel,
        maxOutputTokens: getOutputBudget(cleanMessage, false),
        requiresVision: false,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: cleanMessage,
          },
        ],
      });

      return Response.json({
        sessionId: null,
        chatSession: null,
        answer: result.text,
        isGuest: true,
        remainingGuestMessages: guestLimit.remaining,
        model: toPublicAiModel(selectedModel),
      });
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

    const messagesForAi: any[] =
      imageAttachments.length > 0
        ? [
            {
              role: "system" as const,
              content: SYSTEM_PROMPT,
            },
            {
              role: "user" as const,
              content: userContent,
            },
          ]
        : [
            ...aiMessages,
            {
              role: "user" as const,
              content: userContent as string,
            },
          ];

    const result = await generateTextWithAiRouter({
      selectedModel,
      maxOutputTokens: getOutputBudget(
        cleanMessage,
        selectedModel.isFree === false,
      ),
      requiresVision: imageAttachments.length > 0,
      messages: messagesForAi as any,
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
            ? createTitle(cleanMessage)
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
        provider: result.provider,
        model: result.model,
        inputTextLength: cleanMessage.length,
        outputTextLength: result.text.length,
      },
    });

    await maybeUpdateChatSummary({
      sessionId: chatSession.id,
      currentSummary: chatSession.summary,
      summaryMessageCount: chatSession.summaryMessageCount,
      selectedModel,
    });

    return Response.json({
      sessionId: updatedChatSession.id,
      chatSession: updatedChatSession,
      answer: assistantMessage.content,
      isGuest: false,
      usage: {
        usedToday: dailyLimit.usedToday + 1,
        limit: dailyLimit.limit,
        remaining: Math.max(0, dailyLimit.remaining - 1),
      },
      model: toPublicAiModel(selectedModel),
    });
  } catch (error) {
    console.error("CHAT_API_ERROR:", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Có lỗi khi gọi AI.",
      },
      { status: 500 },
    );
  }
}
