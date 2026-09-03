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

// Mesmo org (onclickbr) para as 5 bases, projetos diferentes — conforme
// especificado pelo usuário. Cores fixas para identidade visual estável.
const BASES = [
  { slug: "nord", name: "NORD", color: "#06a9f4", azureOrg: "onclickbr", azureProject: "Nord" },
  { slug: "kpl", name: "KPL", color: "#8b5cf6", azureOrg: "onclickbr", azureProject: "KPL" },
  { slug: "apiecomm", name: "APIECOMM", color: "#22c55e", azureOrg: "onclickbr", azureProject: "APIECOMM" },
  { slug: "produtos", name: "Produtos", color: "#f59e0b", azureOrg: "onclickbr", azureProject: "Onclick - Produtos" },
  { slug: "implantacao", name: "Implantação", color: "#ec4899", azureOrg: "onclickbr", azureProject: "Implantação" },
];

async function main() {
  const bases: Record<string, { id: string }> = {};
  for (const b of BASES) {
    bases[b.slug] = await prisma.base.upsert({
      where: { slug: b.slug },
      update: {},
      create: b,
    });
  }
  const nord = bases.nord;

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

  const usuario = await prisma.user.upsert({
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

  // ADMIN enxerga todas as bases implicitamente (lib/base-context.ts) e não
  // precisa de UserBase. Líder e usuário de demonstração começam só com
  // acesso à NORD, que é onde os dados de demonstração já existentes vivem.
  for (const userId of [leader.id, usuario.id]) {
    await prisma.userBase.upsert({
      where: { userId_baseId: { userId, baseId: nord.id } },
      update: {},
      create: { userId, baseId: nord.id },
    });
  }

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
          baseId: nord.id,
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
          baseId: nord.id,
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
          baseId: nord.id,
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
