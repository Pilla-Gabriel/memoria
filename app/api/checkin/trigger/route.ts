import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureSessionsForSlot, ensureWeeklyReviewSessions } from "@/lib/services/checkin";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
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
}
