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

function cleanProjectName(input: unknown) {
  if (typeof input !== "string") return null;

  const name = input.trim().replace(/\s+/g, " ");

  if (!name) return null;

  return name.length > 50 ? name.slice(0, 50).trim() : name;
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

    const name = cleanProjectName(body.name);

    if (!name) {
      return Response.json(
        { error: "Tên project không hợp lệ." },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      return Response.json(
        { error: "Không tìm thấy project." },
        { status: 404 }
      );
    }

    const updatedProject = await prisma.project.update({
      where: {
        id,
      },
      data: {
        name,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });

    return Response.json({
      project: updatedProject,
    });
  } catch (error) {
    console.error("PATCH_PROJECT_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không cập nhật được project.",
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

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      return Response.json(
        { error: "Không tìm thấy project." },
        { status: 404 }
      );
    }

    await prisma.project.delete({
      where: {
        id,
      },
    });

    return Response.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE_PROJECT_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không xóa được project.",
      },
      { status: 500 }
    );
  }
}