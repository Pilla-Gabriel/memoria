import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const DAILY_QUESTIONS = [
  "O que ficou pendente ontem?",
  "Você assumiu alguma responsabilidade hoje?",
  "Existe algum cliente aguardando seu retorno?",
  "Existe algo discutido em reunião que precisa virar ação?",
  "Há alguma entrega que precisa de prazo?",
  "Existe alguma atividade dependendo de terceiros?",
  "Qual é sua prioridade mais importante neste momento?",
  "Existe alguma meta da semana em risco?",
];

const MONDAY_QUESTIONS = [
  "O que ficou pendente da semana anterior?",
  "O que precisa ser priorizado?",
  "Existe alguma tarefa esquecida?",
];

const FRIDAY_QUESTIONS = [
  "O que foi concluído?",
  "O que continuará na próxima semana?",
  "Existe alguma atividade que precisa ser replanejada?",
];

async function main() {
  const existingSlots = await prisma.checkInSlot.count();
  if (existingSlots === 0) {
    await prisma.checkInSlot.createMany({
      data: [
        { time: "09:00", label: "Check-in da manhã" },
        { time: "14:00", label: "Check-in da tarde" },
        { time: "17:00", label: "Check-in de fechamento" },
      ],
    });
  }

  const existingQuestions = await prisma.checkInQuestion.count();
  if (existingQuestions === 0) {
    await prisma.checkInQuestion.createMany({
      data: [
        ...DAILY_QUESTIONS.map((text, i) => ({
          text,
          category: "DAILY" as const,
          order: i,
        })),
        ...MONDAY_QUESTIONS.map((text, i) => ({
          text,
          category: "MONDAY_REVIEW" as const,
          order: i,
        })),
        ...FRIDAY_QUESTIONS.map((text, i) => ({
          text,
          category: "FRIDAY_REVIEW" as const,
          order: i,
        })),
      ],
    });
  }

  const passwordHash = await bcrypt.hash("memoria123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@memoria.app" },
    update: {},
    create: {
      name: "Administrador MEMÓRIA",
      email: "admin@memoria.app",
      passwordHash,
      role: "ADMIN",
    },
  });

  const leader = await prisma.user.upsert({
    where: { email: "lider@memoria.app" },
    update: {},
    create: {
      name: "Líder de Equipe",
      email: "lider@memoria.app",
      passwordHash,
      role: "LEADER",
    },
  });

  await prisma.user.upsert({
    where: { email: "usuario@memoria.app" },
    update: {},
    create: {
      name: "Usuário Demonstração",
      email: "usuario@memoria.app",
      passwordHash,
      role: "USER",
      leaderId: leader.id,
    },
  });

  const existingFrentes = await prisma.frente.count();
  if (existingFrentes === 0) {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.frente.createMany({
      data: [
        {
          name: "Backlog, entregas e qualidade",
          description: "Itens de backlog planejados, entregues e validados com qualidade.",
          indicator: "% do backlog entregue com qualidade",
          unit: "%",
          baselineValue: 0,
          currentValue: 0,
          targetValue: 80,
          targetDate: in30Days,
          source: "AZURE_DEVOPS",
          sourceDetail: "https://dev.azure.com/onclickbr/Nord/",
          azureWorkItemTypes: "Product Backlog Item,Bug",
          ownerId: admin.id,
        },
        {
          name: "Acompanhamento e validação dos clientes",
          description: "Clientes contatados, acompanhados e com retorno validado.",
          indicator: "Clientes validados no período",
          unit: "clientes",
          baselineValue: 0,
          currentValue: 0,
          targetValue: 10,
          targetDate: in30Days,
          source: "TEAMS",
          sourceDetail: "Canal de acompanhamento de clientes no Teams",
          ownerId: admin.id,
        },
        {
          name: "Migração KPL para NORD",
          description: "Progresso da migração de dados/processos de KPL para NORD.",
          indicator: "% da migração concluída",
          unit: "%",
          baselineValue: 0,
          currentValue: 0,
          targetValue: 100,
          targetDate: in30Days,
          source: "AZURE_DEVOPS",
          sourceDetail: "https://dev.azure.com/onclickbr/Nord/",
          ownerId: admin.id,
        },
      ],
    });
  }

  console.log("Seed concluído.");
  console.log("Admin:", admin.email, "/ senha: memoria123");
  console.log("Líder:", leader.email, "/ senha: memoria123");
  console.log("Usuário: usuario@memoria.app / senha: memoria123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
