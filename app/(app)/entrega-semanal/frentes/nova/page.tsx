import { Suspense } from "react";
import { auth } from "@/auth";
import { isManager } from "@/lib/rbac";
import { NovaFrenteForm } from "./form";

export default async function NovaFrentePage() {
  const session = await auth();

  if (!session?.user || !isManager(session.user.role)) {
    return <p style={{ color: "var(--color-danger)" }}>Acesso restrito a líderes e administradores</p>;
  }

  return (
    <Suspense fallback={<p style={{ color: "var(--color-text-secondary)" }}>Carregando...</p>}>
      <NovaFrenteForm />
    </Suspense>
  );
}
