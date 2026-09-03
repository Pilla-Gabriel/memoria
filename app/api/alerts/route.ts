import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async (_request, _ctx, session) => {
  const alerts = await prisma.alert.findMany({
    where: {
      userId: session.user.id,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ alerts });
});
