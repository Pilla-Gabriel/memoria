import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { getCurrentBaseId, NO_BASE_SENTINEL } from "@/lib/base-context";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClientExtended | undefined;
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

// As 7 entidades raiz que carregam baseId. Entidades filhas (Blocker,
// TaskComment, TaskAttachment, TaskExtensionRequest, CheckInAnswer,
// GoalProgress, FrenteSnapshot, Delivery, TaskCode) e as globais
// (User, TaskCategory, CheckInQuestion, CheckInSlot, Base, UserBase) não
// entram aqui de propósito — isolamento das filhas é feito validando o pai
// escopado antes de qualquer operação (ver lib/base-guards.ts).
const SCOPED_MODELS = new Set([
  "Task",
  "Goal",
  "Frente",
  "CheckInSession",
  "Alert",
  "WeeklyReport",
  "AuditLog",
]);

// Operações que recebem um `where` e devem ser restritas à base ativa.
// create/createMany ficam de fora de propósito: baseId é campo obrigatório
// no schema, então omiti-lo já é erro de compilação — não precisa de lógica
// aqui, e assim uma escrita nunca fica sujeita a esquecimento de escopo.
const SCOPED_WHERE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

function createExtendedClient() {
  return createClient().$extends({
    name: "base-scoping",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && SCOPED_MODELS.has(model) && SCOPED_WHERE_OPS.has(operation)) {
            const baseId = getCurrentBaseId() ?? NO_BASE_SENTINEL;
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...a.where, baseId };
          }
          return query(args);
        },
      },
    },
  });
}

type PrismaClientExtended = ReturnType<typeof createExtendedClient>;

export const prisma: PrismaClientExtended = global.__prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
