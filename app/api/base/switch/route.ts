import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAccessibleBases, ACTIVE_BASE_COOKIE } from "@/lib/active-base";

const schema = z.object({ baseId: z.string() });

// Nunca confia no baseId do cliente sozinho: revalida contra as bases que o
// usuário realmente pode acessar antes de gravar o cookie — é o que impede
// alguém de simplesmente escrever o cookie na mão e "entrar" numa base sem
// permissão (o fail-closed de getActiveBaseId cobre a leitura; isto cobre a escrita).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const accessible = await getAccessibleBases(session.user);
  const base = accessible.find((b) => b.id === parsed.data.baseId);
  if (!base) {
    return NextResponse.json({ error: "Você não tem acesso a esta base." }, { status: 403 });
  }

  const response = NextResponse.json({ base });
  response.cookies.set(ACTIVE_BASE_COOKIE, base.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
