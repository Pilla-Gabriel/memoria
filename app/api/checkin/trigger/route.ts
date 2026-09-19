import { NextResponse } from "next/server";
import { dispatchAllActiveSlotSessions, ensureWeeklyReviewSessions } from "@/lib/services/checkin";
import { withBase } from "@/lib/with-base";

export const POST = withBase(async (_request, _ctx, session) => {
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem disparar check-ins manualmente" }, { status: 403 });
  }

  let created = (await dispatchAllActiveSlotSessions()).length;

  const weekday = new Date().getDay();
  if (weekday === 1) created += (await ensureWeeklyReviewSessions("MONDAY_REVIEW")).length;
  if (weekday === 5) created += (await ensureWeeklyReviewSessions("FRIDAY_REVIEW")).length;

  return NextResponse.json({ created });
});
