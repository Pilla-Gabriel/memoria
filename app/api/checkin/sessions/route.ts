import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async (_request, _ctx, session) => {
  const sessions = await prisma.checkInSession.findMany({
    where: { userId: session.user.id },
    include: { slot: true, answers: true },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json({ sessions });
});
