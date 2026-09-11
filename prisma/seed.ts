import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      name: "Administrator",
      role: "ADMIN",
    },
  });

  console.log(`Seeded admin user: ${admin.username} (password: ${password})`);

  const mmk = await prisma.currency.upsert({
    where: { code: "MMK" },
    update: {},
    create: { code: "MMK", name: "Myanmar Kyat", isDefault: true, exchangeRate: 1 },
  });
  console.log(`Seeded default currency: ${mmk.code}`);

  const retail = await prisma.priceGroup.upsert({
    where: { name: "Retail" },
    update: {},
    create: { name: "Retail", isDefault: true },
  });
  console.log(`Seeded default price group: ${retail.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
