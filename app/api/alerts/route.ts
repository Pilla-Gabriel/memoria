import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const alerts = await prisma.alert.findMany({
    where: {
      userId: session.user.id,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ alerts });
}
