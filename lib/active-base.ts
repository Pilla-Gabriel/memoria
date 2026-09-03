import { cookies } from "next/headers";
import { getAccessibleBases, type AccessibleBase } from "@/lib/base-access";

export { getAccessibleBases, getActiveUserIdsWithBaseAccess } from "@/lib/base-access";
export type { AccessibleBase } from "@/lib/base-access";

// Nome do cookie que guarda a base ativa da sessão. httpOnly: não precisa
// (nem deve) ser lido/escrito por JS no cliente — a troca de base sempre
// passa por app/api/base/switch, que revalida o acesso no servidor antes de
// gravar o cookie.
export const ACTIVE_BASE_COOKIE = "active-base";

// Lê o cookie de base ativa e confirma que o usuário atual ainda tem acesso
// a ela — nunca confia no valor do cookie sozinho. Retorna null quando não
// há cookie, quando a base não existe mais, ou quando o acesso foi revogado
// desde que o cookie foi gravado (fail-closed).
//
// Só pode ser importado a partir de código que roda dentro do runtime do
// Next.js (rotas de API, Server Components) — next/headers falha só de ser
// importado fora dele. lib/services/*.ts usados pelo cron em server.ts
// importam de lib/base-access.ts em vez deste arquivo por causa disso.
export async function getActiveBaseId(user: { id: string; role: string }): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACTIVE_BASE_COOKIE)?.value;
  if (!cookieValue) return null;

  const accessible = await getAccessibleBases(user);
  const match = accessible.find((b: AccessibleBase) => b.id === cookieValue);
  return match?.id ?? null;
}
