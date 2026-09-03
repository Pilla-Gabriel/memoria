import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";

export const POST = withBase(async (_request, _ctx, session) => {
  await prisma.alert.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
});
