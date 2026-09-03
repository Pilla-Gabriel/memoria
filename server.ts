import { createServer } from "http";
import next from "next";
import { schedule } from "node-cron";
import { prisma } from "@/lib/prisma";
import { runWithBase, runUnscoped } from "@/lib/base-context";
import { ensureSessionsForSlot, ensureWeeklyReviewSessions } from "@/lib/services/checkin";
import { runDailyAlertsJob } from "@/lib/services/alerts";
import { ensureWeeklyReportDrafts } from "@/lib/services/weekly-report";
import { syncAllAzureFrentes } from "@/lib/services/frentes";
import { isAzureDevOpsConfigured } from "@/lib/services/azure-devops";

// Todo job agendado roda uma vez por base, cada um dentro de runWithBase —
// sem isso, getCurrentBaseId() responde undefined dentro do job e a
// extensão do Prisma trata a operação como sem base (fail-closed): nada
// seria criado/alterado em base nenhuma. O erro de uma base não interrompe
// as demais.
async function forEachBase(jobName: string, fn: (base: { id: string; slug: string }) => Promise<unknown>) {
  const bases = await runUnscoped(() => prisma.base.findMany({ select: { id: true, slug: true } }));
  for (const base of bases) {
    try {
      await runWithBase(base.id, () => fn(base));
    } catch (err) {
      console.error(`[cron] erro em "${jobName}" na base ${base.slug}:`, err);
    }
  }
}

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
// Turbopack spawns a separate "node" process (via PATH) to run PostCSS for
// globals.css. This machine has no system-wide Node install, and some
// sandboxed spawn environments don't inherit a PATH that resolves it, which
// crashes Turbopack with "spawning node pooled process ... No such file or
// directory". Webpack's PostCSS loader runs in-process, avoiding that.
const app = next({ dev, turbopack: false, webpack: true });
const handle = app.getRequestHandler();

function currentHHmm() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function checkAndDispatchSlots() {
  const nowLabel = currentHHmm();
  const slots = await prisma.checkInSlot.findMany({ where: { active: true, time: nowLabel } });
  for (const slot of slots) {
    const created = await ensureSessionsForSlot(slot.id);
    if (created.length) {
      console.log(`[cron] ${created.length} check-in(s) criado(s) para o slot "${slot.label}" (${slot.time})`);
    }
  }
}

// A sincronização automática precisa de um usuário para atribuir os registros
// de auditoria — usamos o admin ativo mais antigo como responsável "de
// sistema" pelas sincronizações em segundo plano.
async function runScheduledAzureSync() {
  if (!(await isAzureDevOpsConfigured())) return;

  const systemActor = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!systemActor) {
    console.log("[cron] sincronização do Azure DevOps pulada: nenhum admin ativo encontrado.");
    return;
  }

  const results = await syncAllAzureFrentes(systemActor.id);
  if (results.length) {
    const ok = results.filter((r) => r.ok).length;
    console.log(`[cron] Azure DevOps sincronizado: ${ok}/${results.length} frente(s) com sucesso.`);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  // Encaminha upgrades de WebSocket (HMR do Turbopack) para o Next.js.
  httpServer.on("upgrade", app.getUpgradeHandler());

  httpServer.listen(port, () => {
    console.log(`> MEMÓRIA rodando em http://localhost:${port} (${dev ? "development" : "production"})`);
  });

  // Verifica a cada minuto, de segunda a sexta, se algum horário de check-in bate com o horário atual.
  schedule("* * * * 1-5", () => {
    forEachBase("checkAndDispatchSlots", checkAndDispatchSlots).catch((err) =>
      console.error("[cron] erro ao disparar check-ins:", err)
    );
  });

  // Revisão semanal de segunda-feira às 08:30.
  schedule("30 8 * * 1", () => {
    forEachBase("ensureWeeklyReviewSessions(MONDAY_REVIEW)", () => ensureWeeklyReviewSessions("MONDAY_REVIEW")).catch(
      (err) => console.error("[cron] erro ao criar revisão de segunda:", err)
    );
  });

  // Revisão semanal de sexta-feira às 08:30.
  schedule("30 8 * * 5", () => {
    forEachBase("ensureWeeklyReviewSessions(FRIDAY_REVIEW)", () => ensureWeeklyReviewSessions("FRIDAY_REVIEW")).catch(
      (err) => console.error("[cron] erro ao criar revisão de sexta:", err)
    );
  });

  // Rascunho do relatório de Entrega Semanal — segunda-feira às 08:00.
  schedule("0 8 * * 1", () => {
    forEachBase("ensureWeeklyReportDrafts(SEGUNDA)", () => ensureWeeklyReportDrafts("SEGUNDA")).catch((err) =>
      console.error("[cron] erro ao criar relatório de segunda:", err)
    );
  });

  // Rascunho do relatório de Entrega Semanal — sexta-feira às 08:00.
  schedule("0 8 * * 5", () => {
    forEachBase("ensureWeeklyReportDrafts(SEXTA)", () => ensureWeeklyReportDrafts("SEXTA")).catch((err) =>
      console.error("[cron] erro ao criar relatório de sexta:", err)
    );
  });

  // Recalcula prazos, atrasos e risco de metas todos os dias às 00:05.
  schedule("5 0 * * *", () => {
    forEachBase("runDailyAlertsJob", runDailyAlertsJob).catch((err) =>
      console.error("[cron] erro ao gerar alertas diários:", err)
    );
  });

  // Sincroniza frentes ligadas ao Azure DevOps a cada 2 horas, em horário
  // comercial (seg-sex, 8h-18h) — o botão manual continua existindo como
  // atalho para forçar uma sincronização fora desse ciclo.
  schedule("0 8-18/2 * * 1-5", () => {
    forEachBase("runScheduledAzureSync", runScheduledAzureSync).catch((err) =>
      console.error("[cron] erro ao sincronizar Azure DevOps:", err)
    );
  });

  console.log("> Agendador de check-ins e alertas ativo.");
});
