import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const plans = [
    {
      name: "Gói 1 ngày",
      price: 10000,
      durationDays: 1,
      messageLimitPerDay: 50,
    },
    {
      name: "Gói 3 ngày",
      price: 25000,
      durationDays: 3,
      messageLimitPerDay: 80,
    },
    {
      name: "Gói 7 ngày",
      price: 49000,
      durationDays: 7,
      messageLimitPerDay: 100,
    },
    {
      name: "Gói 30 ngày",
      price: 149000,
      durationDays: 30,
      messageLimitPerDay: 150,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {
        name: plan.name,
      },
      update: {
        price: plan.price,
        durationDays: plan.durationDays,
        messageLimitPerDay: plan.messageLimitPerDay,
        isActive: true,
      },
      create: {
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        messageLimitPerDay: plan.messageLimitPerDay,
        isActive: true,
      },
    });
  }

  console.log("Seed plans successfully!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });