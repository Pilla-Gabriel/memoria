"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, Sun, Moon, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { initialsForName, readableBadgeColors } from "@/lib/base-color";
import { Logo } from "@/components/brand/logo";
import type { NavItem } from "@/lib/navigation";

// Cabeçalho de duas faixas do protótipo de referência (Lovable weekly-wrapup):
// barra azul-marinho de 40px (logo à esquerda; base, tema, alertas, usuário e
// sair em células à direita) + faixa branca com a navegação horizontal. A
// referência pinta o texto da barra com --primary-foreground (azul-escuro
// sobre azul-marinho, 1.47:1); aqui é branco, que é a intenção visível.

// Tempo em que o botão "Confirmar" fica desabilitado após abrir o passo de
// confirmação — pequeno o bastante para não incomodar quem está prestando
// atenção, grande o bastante para quebrar o "clique no piloto automático"
// de quem clica em tudo sem ler.
const CONFIRM_DELAY_MS = 600;

const ROLE_LABEL: Record<string, string> = {
  USER: "Usuário",
  ADMIN: "Administrador",
};

const UNREAD_POLL_MS = 45_000;

function unreadLabel(count: number) {
  return count === 1 ? "1 alerta não lido" : `${count} alertas não lidos`;
}

type AccessibleBase = { id: string; slug: string; name: string; color: string };

// Célula da barra superior: altura cheia, separada por filete claro.
const CELL = "flex h-full items-center border-l border-white/15 text-white/75 transition-colors hover:text-white";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const canSwitch = accessibleBases.length > 1;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
      }
    }
    // Esc fecha e devolve o foco ao botão — antes o painel se anunciava como
    // role="menu" sem nenhum teclado de menu (auditoria Impeccable 2026-09-29).
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || !ref.current?.contains(document.activeElement)) return;
      setOpen(false);
      setPending(null);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
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

  // A base é a informação mais consequente do cabeçalho (define que dados
  // você está vendo/criando): leva a cor da própria base no quadradinho.
  const content = (
    <>
      <span
        className="flex size-6 shrink-0 items-center justify-center text-[0.625rem] font-bold"
        style={readableBadgeColors(activeBase.color)}
      >
        {initialsForName(activeBase.name)}
      </span>
      <span className="hidden flex-col text-left leading-tight sm:flex">
        <span className="text-[0.5625rem] font-semibold uppercase text-white/65">Base</span>
        <span className="text-xs font-semibold text-white">{activeBase.name}</span>
      </span>
    </>
  );

  if (!canSwitch) {
    return (
      <div
        className={`${CELL} gap-2 px-3`}
        aria-label={`Base ativa: ${activeBase.name}`}
        title="Sua conta só tem acesso a esta base."
      >
        {content}
      </div>
    );
  }

  return (
    <div className="relative h-full" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setPending(null);
        }}
        className={`${CELL} gap-2 px-3`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Base ativa: ${activeBase.name}. Trocar de base`}
      >
        {content}
        <ChevronDown className="size-3 text-white/60" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-md border shadow-lg z-40 overflow-hidden"
          style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
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
                  className="flex-1 py-1.5 text-xs rounded-md border"
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
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-[var(--color-hover)] text-left"
                    aria-current={base.id === activeBase.id ? "true" : undefined}
                  >
                    <span
                      className="flex size-6 items-center justify-center text-[0.625rem] font-bold shrink-0"
                      style={readableBadgeColors(base.color)}
                    >
                      {initialsForName(base.name)}
                    </span>
                    <span className="flex-1">{base.name}</span>
                    {base.id === activeBase.id && (
                      <span className="text-[0.625rem] font-semibold" style={{ color: "var(--color-primary-ink)" }}>
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
  navItems,
  name,
  role,
  unreadCount,
  activeBase,
  accessibleBases,
}: {
  navItems: NavItem[];
  name: string;
  role: string;
  unreadCount: number;
  activeBase: AccessibleBase;
  accessibleBases: AccessibleBase[];
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [liveUnreadCount, setLiveUnreadCount] = useState(unreadCount);
  const [announcement, setAnnouncement] = useState("");
  const lastCountRef = useRef(unreadCount);
  const navRef = useRef<HTMLElement>(null);
  const [navOverflow, setNavOverflow] = useState(false);

  // No celular a faixa tem ~940px em 375px de tela: a aba ativa (Auditoria,
  // Configurações...) ficava fora da vista. Centraliza a aba ativa na faixa
  // (só rolagem horizontal da própria faixa, a página não se mexe) e marca
  // se ainda sobra conteúdo à direita para mostrar o degradê.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    const update = () => setNavOverflow(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4);
    const frame = requestAnimationFrame(update);
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  useEffect(() => {
    setLiveUnreadCount(unreadCount);
    lastCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch("/api/alerts/unread-count")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          // Anuncia só quando chega alerta novo — não a cada poll nem no
          // carregamento, pra não virar ruído no leitor de tela.
          if (data.count > lastCountRef.current) setAnnouncement(unreadLabel(data.count));
          lastCountRef.current = data.count;
          setLiveUnreadCount(data.count);
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
    <header className="sticky top-0 z-30" style={{ background: "var(--color-bg)" }}>
      <div className="topbar" style={{ background: "var(--color-primary-dark)" }}>
        <div className="mx-auto flex h-11 max-w-[1320px] items-center justify-between px-4 md:h-10 md:px-6">
          <Link href="/dashboard" aria-label="MEMÓRIA — início" className="shrink-0">
            <span className="sm:hidden">
              <Logo variant="onDark" showWordmark={false} />
            </span>
            <span className="hidden sm:block">
              <Logo variant="onDark" />
            </span>
          </Link>

          <div className="flex h-full min-w-0 items-center border-r border-white/15">
            <BaseIndicator activeBase={activeBase} accessibleBases={accessibleBases} />

            <button
              type="button"
              onClick={toggleTheme}
              className={`${CELL} w-10 justify-center max-sm:hidden`}
              aria-label="Alternar tema"
              title="Alternar tema claro/escuro"
            >
              {theme === "DARK" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <Link
              href="/alertas"
              className={`${CELL} relative w-10 justify-center`}
              aria-label={
                liveUnreadCount > 0
                  ? `Alertas, ${liveUnreadCount === 1 ? "1 não lido" : `${liveUnreadCount} não lidos`}`
                  : "Alertas"
              }
              title={liveUnreadCount > 0 ? unreadLabel(liveUnreadCount) : "Alertas"}
            >
              <Bell className="size-4" />
              {liveUnreadCount > 0 && (
                <span aria-hidden="true" className="absolute right-3 top-2 size-1.5" style={{ background: "var(--color-accent)" }} />
              )}
            </Link>
            <span role="status" aria-live="polite" className="sr-only">
              {announcement}
            </span>

            <div className={`${CELL} gap-2 px-3 text-xs font-semibold hover:text-white/75`} title={`${name} · ${ROLE_LABEL[role] ?? role}`}>
              <span className="flex size-6 items-center justify-center bg-white/10 text-[0.625rem] text-white">
                {initialsForName(name)}
              </span>
              <span className="hidden flex-col leading-tight md:flex">
                <span className="text-white">{name}</span>
                <span className="text-[0.5625rem] font-semibold uppercase text-white/65">{ROLE_LABEL[role] ?? role}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className={`${CELL} w-10 justify-center`}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative border-b" style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}>
        <nav
          ref={navRef}
          className="main-nav mx-auto flex max-w-[1320px] gap-6 overflow-x-auto px-4 md:px-6"
          aria-label="Navegação principal"
        >
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-11 shrink-0 items-center whitespace-nowrap text-[0.6875rem] font-semibold transition-colors ${
                  active ? "text-[var(--color-heading)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform motion-reduce:transition-none"
                  style={{ background: "var(--color-primary)", transform: active ? "scaleX(1)" : "scaleX(0)" }}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {navOverflow && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10"
            style={{ background: "linear-gradient(to right, transparent, var(--color-card))" }}
          />
        )}
      </div>
    </header>
  );
}
