import { z } from "zod";

// Texto obrigatório de verdade: corta espaços das pontas antes de contar e
// exige ao menos uma letra ou número — "   ", "." e "..." passavam como
// título/justificativa válidos (achado G-01 da auditoria Gengar).
export function texto(min: number, message?: string) {
  return z
    .string()
    .trim()
    .min(min, message)
    .refine((v) => /[\p{L}\p{N}]/u.test(v), { message: message ?? "Escreva um texto com letras ou números" });
}

// E-mail sempre comparado em minúsculas e sem espaço nas pontas — o
// autopreenchimento do Safari/iCloud costuma deixar um espaço no fim ou
// capitalizar a primeira letra (achado G-17).
export const emailField = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido"));

// Teto para valores numéricos digitados: acima disso o número perde precisão
// no banco (99999999999999999999 virava 100000000000000000000).
export const MAX_NUMERO = 1_000_000_000_000;
const numero = (message = "Informe um número válido") =>
  z.number({ message }).finite(message).max(MAX_NUMERO, "Valor alto demais");

const DIA_MS = 24 * 60 * 60 * 1000;

export const adminUserCreateSchema = z.object({
  name: texto(2, "Informe o nome completo"),
  email: emailField,
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
  baseIds: z.array(z.string()).optional(),
});

export const adminUserUpdateSchema = z.object({
  name: texto(2).optional(),
  email: emailField.optional(),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  baseIds: z.array(z.string()).optional(),
});

export const taskCreateSchema = z.object({
  title: texto(3, "O título precisa ter ao menos 3 caracteres"),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime("Data de prazo inválida").optional().nullable(),
  ownerId: z.string().optional(),
  category: z.string().optional().nullable(),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  origin: z.enum(["MANUAL", "CHECKIN", "REVISAO_SEMANAL"]).default("MANUAL"),
  checkInAnswerId: z.string().optional(),
});

export const taskUpdateSchema = z.object({
  title: texto(3, "O título precisa ter ao menos 3 caracteres").optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime("Data de prazo inválida").optional().nullable(),
  // ATRASADA é do sistema (job diário em lib/services/alerts.ts), não se escolhe à mão.
  status: z
    .enum(["PENDENTE", "EM_ANDAMENTO", "AGUARDANDO_TERCEIROS", "CONCLUIDA", "CANCELADA"], {
      message: "Status inválido. \"Atrasada\" é marcado pelo sistema quando o prazo passa.",
    })
    .optional(),
  category: z.string().optional().nullable(),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
});

export const extensionRequestSchema = z.object({
  newDueDate: z.string().datetime(),
  justification: texto(10, "Justifique a prorrogação com pelo menos 10 caracteres"),
});

const goalUnitFields = z.object({
  unitType: z.enum(["PERCENTAGE", "NUMBER"]),
  unitLabel: z.string().optional().nullable(),
});

export const goalCreateSchema = z
  .object({
    title: texto(3, "O título precisa ter ao menos 3 caracteres"),
    description: z.string().optional().nullable(),
    type: z.enum(["DIARIA", "SEMANAL", "MENSAL", "TRIMESTRAL", "ANUAL"]),
    indicator: texto(2, "Informe o indicador"),
    targetValue: numero().positive("A meta precisa ser maior que zero"),
    startDate: z.string().datetime("Informe a data de início"),
    dueDate: z.string().datetime("Informe o prazo"),
    successCriteria: texto(3, "Descreva o critério de sucesso"),
    ownerId: z.string().optional(),
  })
  .merge(goalUnitFields)
  .refine((data) => data.unitType !== "NUMBER" || Boolean(data.unitLabel?.trim()), {
    message: "Informe o rótulo da unidade (ex.: clientes, itens)",
    path: ["unitLabel"],
  })
  // Datas invertidas e prazo já vencido geravam meta "em andamento" com
  // "−N dias restantes" (achado G-07). Um dia de folga cobre fuso horário.
  .refine((data) => new Date(data.dueDate) > new Date(data.startDate), {
    message: "O prazo precisa ser depois da data de início",
    path: ["dueDate"],
  })
  .refine((data) => new Date(data.dueDate).getTime() >= Date.now() - DIA_MS, {
    message: "O prazo não pode estar no passado",
    path: ["dueDate"],
  });

export const goalUpdateSchema = z
  .object({
    title: texto(3, "O título precisa ter ao menos 3 caracteres").optional(),
    description: z.string().optional().nullable(),
    type: z.enum(["DIARIA", "SEMANAL", "MENSAL", "TRIMESTRAL", "ANUAL"]).optional(),
    indicator: texto(2, "Informe o indicador").optional(),
    targetValue: numero().positive("A meta precisa ser maior que zero").optional(),
    startDate: z.string().datetime("Informe a data de início").optional(),
    dueDate: z.string().datetime("Informe o prazo").optional(),
    successCriteria: texto(3, "Descreva o critério de sucesso").optional(),
    status: z.enum(["EM_ANDAMENTO", "ATINGIDA", "EM_RISCO", "VENCIDA", "CANCELADA"]).optional(),
  })
  .merge(goalUnitFields.partial())
  .refine((data) => !data.startDate || !data.dueDate || new Date(data.dueDate) > new Date(data.startDate), {
    message: "O prazo precisa ser depois da data de início",
    path: ["dueDate"],
  });

export const goalProgressSchema = z.object({
  value: numero().min(0, "O valor não pode ser negativo"),
  note: z.string().optional().nullable(),
});

export const goalProgressUpdateSchema = z.object({
  value: numero().min(0, "O valor não pode ser negativo"),
  note: z.string().optional().nullable(),
});

export const checkInAnswerSchema = z.object({
  questionId: z.string(),
  text: texto(1, "Responda a pergunta antes de continuar"),
});

export const frenteCreateSchema = z.object({
  name: texto(3, "Informe o nome da frente"),
  description: z.string().optional().nullable(),
  indicator: texto(2, "Informe o indicador"),
  unit: texto(1, "Informe a unidade"),
  baselineValue: numero(),
  targetValue: numero(),
  targetDate: z.string().datetime("Informe o prazo da meta"),
  source: z.enum(["AZURE_DEVOPS", "TEAMS", "SLACK", "DOCUMENTACAO_INTERNA", "OUTRA"]).default("OUTRA"),
  sourceDetail: z.string().optional().nullable(),
  ownerId: z.string().optional(),
});

export const frenteUpdateSchema = z.object({
  name: texto(3, "Informe o nome da frente").optional(),
  description: z.string().optional().nullable(),
  indicator: texto(2, "Informe o indicador").optional(),
  unit: texto(1, "Informe a unidade").optional(),
  baselineValue: numero().optional(),
  targetValue: numero().optional(),
  targetDate: z.string().datetime("Informe o prazo da meta").optional(),
  source: z.enum(["AZURE_DEVOPS", "TEAMS", "SLACK", "DOCUMENTACAO_INTERNA", "OUTRA"]).optional(),
  sourceDetail: z.string().optional().nullable(),
  azureWorkItemTypes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const frenteSnapshotSchema = z.object({
  value: numero(),
  note: z.string().optional().nullable(),
});

export const deliveryCreateSchema = z.object({
  title: texto(3, "Informe o que ficou pronto"),
  evidence: texto(3, "Informe o ID, registro ou link da evidência"),
  taskId: z.string().optional().nullable(),
});

export const blockerCreateSchema = z.object({
  description: texto(5, "Descreva o que está travado"),
  impact: texto(3, "Descreva o impacto"),
  ownerToUnblockId: z.string().optional().nullable(),
  ownerToUnblockName: z.string().optional().nullable(),
});

export const weeklyReportUpdateSchema = z.object({
  hoje: z.string().optional().nullable(),
  semana: z.string().optional().nullable(),
  vitoria: z.string().optional().nullable(),
  status: z.enum(["RASCUNHO", "PUBLICADO"]).optional(),
});
