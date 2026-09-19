import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createItem, defaultsOnly, effectiveListFor } from "@/lib/services/personalization";

const schema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Use o formato HH:mm"),
  label: z.string().min(2),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const isDefaultScope = new URL(request.url).searchParams.get("scope") === "default";
  if (isDefaultScope && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const slots = isDefaultScope
    ? await defaultsOnly(prisma.checkInSlot)
    : await effectiveListFor(prisma.checkInSlot, session.user.id);
  slots.sort((a, b) => a.time.localeCompare(b.time));
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const slot = await createItem(prisma.checkInSlot, session.user, parsed.data);
  return NextResponse.json({ slot });
}
