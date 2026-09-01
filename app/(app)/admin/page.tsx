import { auth } from "@/auth";
import { AdminPageClient } from "./admin-client";

export default async function AdminPage() {
  const session = await auth();

  if (session?.user.role !== "ADMIN") {
    return <p style={{ color: "var(--color-danger)" }}>Acesso restrito a administradores</p>;
  }

  return <AdminPageClient />;
}
