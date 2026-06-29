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

function cleanTitle(input: unknown) {
  if (typeof input !== "string") return null;

  const title = input.trim().replace(/\s+/g, " ");

  if (!title) return null;

  return title.length > 60 ? title.slice(0, 60).trim() : title;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.status === "BANNED") {
      return Response.json(
        { error: "Tài khoản của bạn đã bị khóa." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chatSession) {
      return Response.json(
        { error: "Không tìm thấy cuộc trò chuyện." },
        { status: 404 }
      );
    }

    return Response.json({ chatSession });
  } catch (error) {
    console.error("GET_CHAT_SESSION_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tải được cuộc trò chuyện.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.status === "BANNED") {
      return Response.json(
        { error: "Tài khoản của bạn đã bị khóa." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();

    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!chatSession) {
      return Response.json(
        { error: "Không tìm thấy cuộc trò chuyện." },
        { status: 404 }
      );
    }

    const data: {
      title?: string;
      projectId?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if ("title" in body) {
      const title = cleanTitle(body.title);

      if (!title) {
        return Response.json(
          { error: "Tên cuộc trò chuyện không hợp lệ." },
          { status: 400 }
        );
      }

      data.title = title;
    }

    if ("projectId" in body) {
      if (body.projectId === null || body.projectId === "") {
        data.projectId = null;
      } else if (typeof body.projectId === "string") {
        const project = await prisma.project.findFirst({
          where: {
            id: body.projectId,
            userId: user.id,
          },
          select: {
            id: true,
          },
        });

        if (!project) {
          return Response.json(
            { error: "Project không tồn tại." },
            { status: 404 }
          );
        }

        data.projectId = project.id;
      } else {
        return Response.json(
          { error: "Project không hợp lệ." },
          { status: 400 }
        );
      }
    }

    const updatedChatSession = await prisma.chatSession.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        title: true,
        projectId: true,
        updatedAt: true,
      },
    });

    return Response.json({
      chatSession: updatedChatSession,
    });
  } catch (error) {
    console.error("PATCH_CHAT_SESSION_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không cập nhật được cuộc trò chuyện.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.status === "BANNED") {
      return Response.json(
        { error: "Tài khoản của bạn đã bị khóa." },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!chatSession) {
      return Response.json(
        { error: "Không tìm thấy cuộc trò chuyện." },
        { status: 404 }
      );
    }

    await prisma.chatMessage.deleteMany({
      where: {
        sessionId: id,
      },
    });

    await prisma.chatSession.delete({
      where: {
        id,
      },
    });

    return Response.json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE_CHAT_SESSION_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không xóa được cuộc trò chuyện.",
      },
      { status: 500 }
    );
  }
}