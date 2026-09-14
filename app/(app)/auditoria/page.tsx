import { auth } from "@/auth";
import { AuditoriaPageClient } from "./auditoria-client";

export default async function AuditoriaPage() {
  const session = await auth();

  if (session?.user.role !== "ADMIN") {
    return <p style={{ color: "var(--color-danger)" }}>Acesso restrito a administradores</p>;
  }

  return <AuditoriaPageClient />;
}
