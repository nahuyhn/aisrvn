import { getCurrentUser } from "@/lib/get-current-user";
import { getActiveSubscription } from "@/lib/subscription";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ subscription: null }, { status: 200 });
  }

  if (user.status === "BANNED") {
    return Response.json(
      { error: "Tài khoản của bạn đã bị khóa." },
      { status: 403 }
    );
  }

  const subscription = await getActiveSubscription(user.id);

  return Response.json({
    subscription,
  });
}