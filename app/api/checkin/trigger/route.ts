import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSessionsForSlot, ensureWeeklyReviewSessions } from "@/lib/services/checkin";
import { withBase } from "@/lib/with-base";

export const POST = withBase(async (_request, _ctx, session) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem disparar check-ins manualmente" }, { status: 403 });
  }

  const slots = await prisma.checkInSlot.findMany({ where: { active: true } });
  let created = 0;
  for (const slot of slots) {
    created += (await ensureSessionsForSlot(slot.id)).length;
  }

  const weekday = new Date().getDay();
  if (weekday === 1) created += (await ensureWeeklyReviewSessions("MONDAY_REVIEW")).length;
  if (weekday === 5) created += (await ensureWeeklyReviewSessions("FRIDAY_REVIEW")).length;

  return NextResponse.json({ created });
});
