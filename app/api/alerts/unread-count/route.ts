import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBase } from "@/lib/with-base";

export const GET = withBase(async (_request, _ctx, session) => {
  const count = await prisma.alert.count({ where: { userId: session.user.id, read: false } });
  return NextResponse.json({ count });
});
