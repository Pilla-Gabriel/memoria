import { prisma } from "@/lib/prisma";
import { requireBaseId } from "@/lib/base-context";
import { sendPushToUser } from "@/lib/services/push";

// União central dos tipos de Alert — reexportada por lib/services/alerts.ts
// em vez de manter duas listas manuais em arquivos diferentes.
export type AlertKind =
  | "PRAZO_7D"
  | "PRAZO_3D"
  | "PRAZO_1D"
  | "VENCE_HOJE"
  | "ATRASADA"
  | "SEM_PRAZO"
  | "META_RISCO"
  | "META_VENCIDA"
  | "CHECKIN_PENDENTE"
  | "FRENTE_EM_RISCO"
  | "FRENTE_SEM_ATUALIZACAO"
  | "BLOQUEIO_ABERTO"
  | "PRORROGACAO_PENDENTE"
  | "CHECKIN_NAO_CONFIGURADO";

// Mesmo mapeamento de app/(app)/alertas/page.tsx (LINK_BY_TYPE) — duplicado
// de propósito: um é lido no servidor pra montar a URL do push, o outro é
// client-side pra montar o link da lista. Mantidos em arquivos separados
// porque um pequeno mapa de 6 linhas não vale a indireção de compartilhar
// entre bundle de servidor e de cliente.
function urlForAlert(relatedType: string, relatedId: string): string | undefined {
  if (relatedType === "Task") return `/tarefas/${relatedId}`;
  if (relatedType === "Goal") return `/metas/${relatedId}`;
  if (relatedType === "CheckInSession") return `/checkin/${relatedId}`;
  if (relatedType === "Frente") return `/entrega-semanal/frentes/${relatedId}`;
  if (relatedType === "WeeklyReport") return `/entrega-semanal/relatorios/${relatedId}`;
  if (relatedType === "CheckInConfig") return "/configuracoes";
  return undefined;
}

/**
 * Ponto único de criação de Alert no app: grava a linha e, se o usuário tiver
 * ao menos um dispositivo inscrito (ver lib/services/push.ts), dispara a
 * notificação de verdade pra área de trabalho — sem isso, o alerta ficava só
 * dentro do sininho in-app, que ninguém com o perfil esquecido/acomodado
 * abre por conta própria (ver auditoria da personalização de check-in).
 */
export async function notifyUser(params: {
  userId: string;
  type: AlertKind;
  relatedType: string;
  relatedId: string;
  message: string;
}) {
  const alert = await prisma.alert.create({ data: { ...params, baseId: requireBaseId() } });

  await sendPushToUser(params.userId, {
    title: "MEMÓRIA",
    body: params.message,
    url: urlForAlert(params.relatedType, params.relatedId),
  });

  return alert;
}
