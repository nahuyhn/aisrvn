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

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
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
  });
}