import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const sessions = await prisma.checkInSession.findMany({
    where: { userId: session.user.id },
    include: { slot: true, answers: true },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json({ sessions });
}
