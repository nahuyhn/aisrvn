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

export async function GET() {
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

    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return Response.json(projects);
  } catch (error) {
    console.error("GET_PROJECTS_ERROR", error);

    return Response.json(
      { error: "Có lỗi xảy ra khi lấy danh sách project." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();

    const project = await prisma.project.create({
      data: {
        name: body.name || "Project mới",
        userId: user.id,
      },
    });

    return Response.json(project);
  } catch (error) {
    console.error("CREATE_PROJECT_ERROR", error);

    return Response.json(
      { error: "Có lỗi xảy ra khi tạo project." },
      { status: 500 }
    );
  }
}