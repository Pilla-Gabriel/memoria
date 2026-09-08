import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <div className="brand-wave relative overflow-hidden text-white flex flex-col justify-between gap-8 px-8 py-10 md:w-1/2 md:px-16 md:py-16">
        <svg
          className="absolute -right-24 -bottom-24 opacity-20 pointer-events-none"
          width="420"
          height="420"
          viewBox="0 0 420 420"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="210" cy="210" r="210" fill="#FFFFFF" />
        </svg>
        <svg
          className="absolute -left-16 top-1/3 opacity-20 pointer-events-none hidden md:block"
          width="260"
          height="260"
          viewBox="0 0 260 260"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="130" cy="130" r="130" fill="#FFF200" />
        </svg>

        <Logo variant="onDark" />

        <div
          className="relative z-10 max-w-md"
          style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.35)" }}
        >
          <h1
            className="font-bold mb-4"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.1 }}
          >
            Se foi combinado, o MEMÓRIA garante que será lembrado.
          </h1>
          <div
            className="text-white/95 space-y-3"
            style={{ fontSize: "clamp(0.95rem, 1.4vw, 1.05rem)" }}
          >
            <p>
              Reuniões e conversas geram compromissos que não podem depender só da
              memória. O MEMÓRIA transforma tudo isso em tarefas com responsável, prazo
              e acompanhamento contínuo.
            </p>
            <p>
              Com check-ins diários, você registra ações e acompanha validações — nada
              fica perdido em mensagens, anotações ou na memória de alguém.
            </p>
            <p className="font-semibold text-white">
              Lembrar é importante. Executar é essencial.
            </p>
          </div>
        </div>

        <p
          className="relative z-10 text-xs text-white/85"
          style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)" }}
        >
          Uma solução ONCLICK
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
