import { NextResponse } from "next/server";
import type { ZodError } from "zod";

// `field` é o nome do campo do payload que falhou — os formulários usam pra
// mostrar o erro ao lado do input certo em vez de só num banner genérico.
export function validationErrorResponse(error: ZodError) {
  const issue = error.issues[0];
  return NextResponse.json(
    {
      error: issue?.message ?? "Dados inválidos",
      field: issue && issue.path.length > 0 ? String(issue.path[0]) : null,
    },
    { status: 400 },
  );
}
