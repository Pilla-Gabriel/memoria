"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";

type Leader = { id: string; name: string };

export default function RegisterPage() {
  const router = useRouter();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/register")
      .then((r) => r.json())
      .then((data) => setLeaders(data.leaders ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, leaderId: leaderId || null }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível concluir o cadastro.");
      return;
    }

    router.push("/login");
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold mb-1">Criar conta</h2>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
        Comece a registrar seus compromissos hoje mesmo.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="name">
            Nome completo
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>

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
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>

        {leaders.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="leader">
              Seu líder (opcional)
            </label>
            <select
              id="leader"
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none bg-transparent"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="">Nenhum</option>
              {leaders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#fee2e2", color: "#991b1b" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="text-sm mt-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold" style={{ color: "var(--color-primary)" }}>
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
