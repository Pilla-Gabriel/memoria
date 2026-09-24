"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Web Push exige a chave pública VAPID como Uint8Array, não como a string
// base64url que ela chega no .env.
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushOptIn() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
    setSupported(ok);
    if (!ok) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      })
      .catch(() => {});
  }, []);

  async function subscribe() {
    setError(null);
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permissão negada — habilite notificações para este site nas configurações do navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch {
      setError("Não foi possível ativar as notificações.");
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {VAPID_PUBLIC_KEY
          ? "Seu navegador não suporta notificações de área de trabalho."
          : "Notificações de área de trabalho não configuradas neste servidor."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {subscribed
          ? "Ativadas neste computador — você recebe alertas (check-in pendente, tarefa atrasada...) mesmo com o MEMÓRIA fechado."
          : "Receba alertas direto na área de trabalho, mesmo com o app fechado — em vez de depender de abrir o sininho."}
      </p>
      {error && (
        <p className="text-xs" style={{ color: "var(--badge-danger-fg)" }}>
          {error}
        </p>
      )}
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={subscribed ? "px-4 py-2 text-sm rounded-xl border disabled:opacity-60" : "btn-primary px-4 py-2 text-sm disabled:opacity-60"}
        style={subscribed ? { borderColor: "var(--color-border)" } : undefined}
      >
        {loading ? "Aguarde..." : subscribed ? "Desativar notificações" : "Ativar notificações no computador"}
      </button>
    </div>
  );
}
