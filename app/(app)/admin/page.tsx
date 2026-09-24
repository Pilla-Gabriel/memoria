import { auth } from "@/auth";
import { AdminPageClient } from "./admin-client";

export default async function AdminPage() {
  const session = await auth();

  if (session?.user.role !== "ADMIN") {
    return <p style={{ color: "var(--badge-danger-fg)" }}>Acesso restrito a administradores</p>;
  }

  return <AdminPageClient />;
}
