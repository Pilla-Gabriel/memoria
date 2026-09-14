import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Notificação de verdade pra área de trabalho (Web Push): funciona mesmo com
// a aba fechada, diferente do sininho in-app. Opcional de propósito — sem as
// chaves VAPID no .env, isPushConfigured() volta false e o resto do app
// simplesmente não manda push (os alertas in-app continuam funcionando
// normalmente). Assim como Azure DevOps, não é obrigatório pra rodar o app.
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:contato@onclick.com.br";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!vapidPublicKey || !vapidPrivateKey) return false;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

export type PushPayload = { title: string; body: string; url?: string };

// Manda pra todos os dispositivos inscritos do usuário, em paralelo. Uma
// inscrição que o navegador não reconhece mais (410/404 — usuário
// desinstalou, limpou dados, trocou de navegador) é removida na hora; outros
// erros só ficam no log, sem derrubar o restante do fluxo que criou o alerta.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[push] falha ao notificar usuário ${userId}:`, err);
        }
      }
    })
  );
}
