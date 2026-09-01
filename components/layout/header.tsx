"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Menu, Bell, Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

const ROLE_LABEL: Record<string, string> = {
  USER: "Usuário",
  LEADER: "Líder",
  ADMIN: "Administrador",
};

const UNREAD_POLL_MS = 45_000;

export function Header({
  name,
  role,
  unreadCount,
  onMenuClick,
}: {
  name: string;
  role: string;
  unreadCount: number;
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

      <div className="hidden md:block" />

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
