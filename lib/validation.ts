import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome completo"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  leaderId: z.string().optional().nullable(),
});

export const adminUserCreateSchema = z.object({
  name: z.string().min(2, "Informe o nome completo"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  role: z.enum(["USER", "LEADER", "ADMIN"]).default("USER"),
  leaderId: z.string().optional().nullable(),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email("E-mail inválido").optional(),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").optional(),
  role: z.enum(["USER", "LEADER", "ADMIN"]).optional(),
  leaderId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().min(3, "Informe um título"),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  ownerId: z.string().optional(),
  category: z.string().optional().nullable(),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  origin: z.enum(["MANUAL", "CHECKIN", "REVISAO_SEMANAL"]).default("MANUAL"),
  checkInAnswerId: z.string().optional(),
});

export const taskUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z
    .enum(["PENDENTE", "EM_ANDAMENTO", "AGUARDANDO_TERCEIROS", "CONCLUIDA", "CANCELADA", "ATRASADA"])
    .optional(),
  category: z.string().optional().nullable(),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
});

export const extensionRequestSchema = z.object({
  newDueDate: z.string().datetime(),
  justification: z.string().min(10, "Justifique a prorrogação com pelo menos 10 caracteres"),
});

const goalUnitFields = z.object({
  unitType: z.enum(["PERCENTAGE", "NUMBER"]),
  unitLabel: z.string().optional().nullable(),
});

export const goalCreateSchema = z
  .object({
    title: z.string().min(3),
    description: z.string().optional().nullable(),
    type: z.enum(["DIARIA", "SEMANAL", "MENSAL", "TRIMESTRAL", "ANUAL"]),
    indicator: z.string().min(2),
    targetValue: z.number().positive(),
    startDate: z.string().datetime(),
    dueDate: z.string().datetime(),
    successCriteria: z.string().min(3),
    ownerId: z.string().optional(),
  })
  .merge(goalUnitFields)
  .refine((data) => data.unitType !== "NUMBER" || Boolean(data.unitLabel?.trim()), {
    message: "Informe o rótulo da unidade (ex.: clientes, itens)",
    path: ["unitLabel"],
  });

export const goalUpdateSchema = z
  .object({
    title: z.string().min(3).optional(),
    description: z.string().optional().nullable(),
    type: z.enum(["DIARIA", "SEMANAL", "MENSAL", "TRIMESTRAL", "ANUAL"]).optional(),
    indicator: z.string().min(2).optional(),
    targetValue: z.number().positive().optional(),
    startDate: z.string().datetime().optional(),
    dueDate: z.string().datetime().optional(),
    successCriteria: z.string().min(3).optional(),
    status: z.enum(["EM_ANDAMENTO", "ATINGIDA", "EM_RISCO", "VENCIDA", "CANCELADA"]).optional(),
  })
  .merge(goalUnitFields.partial());

export const goalProgressSchema = z.object({
  value: z.number(),
  note: z.string().optional().nullable(),
});

export const goalProgressUpdateSchema = z.object({
  value: z.number(),
  note: z.string().optional().nullable(),
});

export const checkInAnswerSchema = z.object({
  questionId: z.string(),
  text: z.string().min(1, "Responda a pergunta antes de continuar"),
});

export const frenteCreateSchema = z.object({
  name: z.string().min(3, "Informe o nome da frente"),
  description: z.string().optional().nullable(),
  indicator: z.string().min(2, "Informe o indicador"),
  unit: z.string().min(1, "Informe a unidade"),
  baselineValue: z.number(),
  targetValue: z.number(),
  targetDate: z.string().datetime(),
  source: z.enum(["AZURE_DEVOPS", "TEAMS", "SLACK", "DOCUMENTACAO_INTERNA", "OUTRA"]).default("OUTRA"),
  sourceDetail: z.string().optional().nullable(),
  ownerId: z.string().optional(),
});

export const frenteUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  indicator: z.string().min(2).optional(),
  unit: z.string().min(1).optional(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
  targetDate: z.string().datetime().optional(),
  source: z.enum(["AZURE_DEVOPS", "TEAMS", "SLACK", "DOCUMENTACAO_INTERNA", "OUTRA"]).optional(),
  sourceDetail: z.string().optional().nullable(),
  azureWorkItemTypes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const frenteSnapshotSchema = z.object({
  value: z.number(),
  note: z.string().optional().nullable(),
});

export const deliveryCreateSchema = z.object({
  title: z.string().min(3, "Informe o que ficou pronto"),
  evidence: z.string().min(3, "Informe o ID, registro ou link da evidência"),
  taskId: z.string().optional().nullable(),
});

export const blockerCreateSchema = z.object({
  description: z.string().min(5, "Descreva o que está travado"),
  impact: z.string().min(3, "Descreva o impacto"),
  ownerToUnblockId: z.string().optional().nullable(),
  ownerToUnblockName: z.string().optional().nullable(),
});

export const weeklyReportUpdateSchema = z.object({
  hoje: z.string().optional().nullable(),
  semana: z.string().optional().nullable(),
  vitoria: z.string().optional().nullable(),
  status: z.enum(["RASCUNHO", "PUBLICADO"]).optional(),
});
