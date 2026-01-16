const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");

beforeAll(async () => {
  // Ensure we're using the test database
  if (process.env.NODE_ENV !== "test") {
    process.env.NODE_ENV = "test";
  }

  // Clear and seed the database
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  // Create test users
  for (let i = 1; i <= 5; i++) {
    await prisma.user.create({
      data: {
        email: `seed${i}@test.com`,
        password,
        role: i === 1 ? "ADMIN" : "USER",
      },
    });
  }
});

afterAll(async () => {
  // Disconnect from Prisma
  await prisma.$disconnect();
});
