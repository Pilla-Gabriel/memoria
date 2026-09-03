import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccessibleBases } from "@/lib/active-base";
import { AuthShell } from "@/components/layout/auth-shell";
import { BaseSelector } from "@/components/base/base-selector";

export default async function SelecionarBasePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const bases = await getAccessibleBases(session.user);

  if (bases.length === 0) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-bold mb-1">Nenhuma base disponível</h2>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Sua conta ainda não tem acesso a nenhuma base. Fale com um administrador para liberar o acesso.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BaseSelector bases={bases} />
    </AuthShell>
  );
}
