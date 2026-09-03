"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, Bell, Sun, Moon, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { initialsForName, hexToRgba } from "@/lib/base-color";

// Tempo em que o botão "Confirmar" fica desabilitado após abrir o passo de
// confirmação — pequeno o bastante para não incomodar quem está prestando
// atenção, grande o bastante para quebrar o "clique no piloto automático"
// de quem clica em tudo sem ler.
const CONFIRM_DELAY_MS = 600;

const ROLE_LABEL: Record<string, string> = {
  USER: "Usuário",
  LEADER: "Líder",
  ADMIN: "Administrador",
};

const UNREAD_POLL_MS = 45_000;

type AccessibleBase = { id: string; slug: string; name: string; color: string };

function BaseIndicator({
  activeBase,
  accessibleBases,
}: {
  activeBase: AccessibleBase;
  accessibleBases: AccessibleBase[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Base cujo pedido de troca está aguardando confirmação explícita — evita
  // que um clique acidental no menu troque toda a base de dados sem aviso.
  const [pending, setPending] = useState<AccessibleBase | null>(null);
  const [switching, setSwitching] = useState(false);
  // Fica true por CONFIRM_DELAY_MS depois de abrir a confirmação — sem isso,
  // alguém acostumado a clicar em sequência sem ler emenda os dois cliques
  // (base errada → Confirmar) antes mesmo do texto aparecer.
  const [confirmReady, setConfirmReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canSwitch = accessibleBases.length > 1;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!pending) {
      setConfirmReady(false);
      return;
    }
    const id = setTimeout(() => setConfirmReady(true), CONFIRM_DELAY_MS);
    return () => clearTimeout(id);
  }, [pending]);

  async function confirmSwitch(base: AccessibleBase) {
    setSwitching(true);
    try {
      const res = await fetch("/api/base/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseId: base.id }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      setPending(null);
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  const badge = (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: activeBase.color }}
    >
      {initialsForName(activeBase.name)}
    </span>
  );

  // Pilula com o tom da própria base — o indicador de base é a informação
  // mais consequente do cabeçalho (define que dados você está vendo/criando)
  // e não pode competir visualmente em pé de igualdade com ícones
  // secundários como tema e sino.
  const pillStyle = {
    background: hexToRgba(activeBase.color, 0.12),
    borderColor: hexToRgba(activeBase.color, 0.35),
  };

  if (!canSwitch) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded-full border"
        style={pillStyle}
        aria-label={`Base ativa: ${activeBase.name}`}
        title="Sua conta só tem acesso a esta base."
      >
        {badge}
        <div className="hidden sm:flex flex-col leading-tight text-left">
          <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            Base
          </span>
          <span className="text-sm font-bold">{activeBase.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setPending(null);
        }}
        className="flex items-center gap-2 px-2.5 py-1 rounded-full border hover:brightness-95"
        style={pillStyle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {badge}
        <div className="hidden sm:flex flex-col leading-tight text-left">
          <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            Base
          </span>
          <span className="text-sm font-bold">{activeBase.name}</span>
        </div>
        <ChevronDown size={15} style={{ color: "var(--color-text-secondary)" }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border shadow-lg z-40 overflow-hidden"
          style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
        >
          {pending ? (
            <div className="p-3.5">
              <p className="text-sm font-semibold mb-1">Trocar para {pending.name}?</p>
              <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
                Tarefas, metas, frentes e relatórios passam a ser dessa base.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => confirmSwitch(pending)}
                  disabled={switching || !confirmReady}
                  className="btn-primary flex-1 py-1.5 text-xs disabled:opacity-60"
                >
                  {switching ? "Trocando..." : confirmReady ? "Confirmar" : "Aguarde..."}
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  disabled={switching}
                  className="flex-1 py-1.5 text-xs rounded-lg border"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <ul className="py-1 max-h-72 overflow-y-auto">
              {accessibleBases.map((base) => (
                <li key={base.id}>
                  <button
                    type="button"
                    onClick={() => (base.id === activeBase.id ? setOpen(false) : setPending(base))}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-black/5 text-left"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: base.color }}
                    >
                      {initialsForName(base.name)}
                    </span>
                    <span className="flex-1">{base.name}</span>
                    {base.id === activeBase.id && (
                      <span className="text-[10px] font-semibold" style={{ color: "var(--color-primary)" }}>
                        atual
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({
  name,
  role,
  unreadCount,
  activeBase,
  accessibleBases,
  onMenuClick,
}: {
  name: string;
  role: string;
  unreadCount: number;
  activeBase: AccessibleBase;
  accessibleBases: AccessibleBase[];
  onMenuClick: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);

  useEffect(() => {
    setLiveUnreadCount(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch("/api/alerts/unread-count")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setLiveUnreadCount(data.count);
        })
        .catch(() => {});
    };
    const id = setInterval(poll, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 border-b sticky top-0 z-30"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      <button className="md:hidden p-2 -ml-2" onClick={onMenuClick} aria-label="Abrir menu">
        <Menu size={22} />
      </button>

      <BaseIndicator activeBase={activeBase} accessibleBases={accessibleBases} />

      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-black/5"
          aria-label="Alternar tema"
          title="Alternar tema claro/escuro"
        >
          {theme === "DARK" ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <Link
          href="/alertas"
          className="relative p-2 rounded-full hover:bg-black/5"
          aria-label="Alertas"
        >
          <Bell size={19} />
          {liveUnreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: "var(--color-danger)" }}
            >
              {liveUnreadCount > 9 ? "9+" : liveUnreadCount}
            </span>
          )}
        </Link>

        <div className="hidden sm:flex flex-col text-right leading-tight">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {ROLE_LABEL[role] ?? role}
          </span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-full hover:bg-black/5"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
