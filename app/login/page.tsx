"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/layout/auth-shell";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <>
      <h2 className="text-2xl font-bold mb-1">Entrar</h2>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
        Acesse seu painel de compromissos e cobranças.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)" }}
            placeholder="voce@empresa.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "var(--color-border)" }}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fee2e2", color: "#991b1b" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-sm mt-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
        Ainda não tem conta?{" "}
        <Link href="/registrar" className="font-semibold" style={{ color: "var(--color-primary)" }}>
          Cadastre-se
        </Link>
      </p>

      {process.env.NODE_ENV !== "production" && process.env.SHOW_DEV_CREDENTIALS === "true" && (
        <div
          className="mt-8 rounded-xl px-4 py-3 text-xs"
          style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}
        >
          <p className="font-semibold mb-1">Contas de demonstração</p>
          <p>admin@memoria.app · lider@memoria.app · usuario@memoria.app</p>
          <p>senha: memoria123</p>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
