import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { getActiveBaseId } from "@/lib/active-base";
import { runWithBase } from "@/lib/base-context";

// Toda rota de API que toca uma das 7 entidades raiz (diretamente ou via um
// lib/services/*) precisa passar por aqui: resolve a sessão, confirma que o
// usuário ainda tem acesso à base do cookie (getActiveBaseId nunca confia
// nele sozinho) e só então entra em runWithBase — é o que faz
// getCurrentBaseId() responder corretamente dentro da extensão do Prisma em
// qualquer ponto da chamada, sem precisar passar baseId manualmente por
// cada função.
export function withBase<Ctx = { params: Promise<Record<string, string>> }>(
  handler: (request: Request, ctx: Ctx, session: Session, baseId: string) => Promise<Response>
) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const baseId = await getActiveBaseId(session.user);
    if (!baseId) {
      return NextResponse.json(
        { error: "Nenhuma base ativa ou sem acesso à base selecionada." },
        { status: 403 }
      );
    }

    return runWithBase(baseId, () => handler(request, ctx, session, baseId));
  };
}
