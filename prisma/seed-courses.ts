/* eslint-disable no-console */
// Adds or updates the class-wise NCTB courses without touching users or progress:
//   npm run db:courses
import { PrismaClient } from "@prisma/client";
import { seedCourses } from "./courses";

const prisma = new PrismaClient();

seedCourses(prisma)
  .then((r) => console.log(`📚 Courses ready: ${r.courses} courses, ${r.chapters} chapters, ${r.topics} topics`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
