import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const stages = await p.caseStage.findMany({
    where: { dueDate: { not: null } },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      period: {
        select: {
          id: true,
          status: true,
          case: { select: { number: true, status: true } },
        },
      },
    },
  });

  const periods = await p.period.findMany({
    select: {
      id: true,
      status: true,
      case: { select: { number: true, status: true } },
    },
  });

  const cases = await p.case.findMany({
    select: { number: true, status: true },
  });

  console.log("=== CaseStages with dueDate ===");
  console.log(JSON.stringify(stages, null, 2));
  console.log("=== Periods ===");
  console.log(JSON.stringify(periods, null, 2));
  console.log("=== Cases ===");
  console.log(JSON.stringify(cases, null, 2));

  await p.$disconnect();
}

main();