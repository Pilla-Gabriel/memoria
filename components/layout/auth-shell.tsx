import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div
        className="h-16 flex items-center px-4 md:px-6 text-white"
        style={{ background: "var(--color-primary-dark)" }}
      >
        <Logo variant="onDark" />
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
        <div
          className="relative flex flex-col justify-between gap-8 px-8 py-10 md:w-1/2 md:px-16 md:py-16 border-b md:border-b-0 md:border-r"
          style={{ borderColor: "var(--color-text)" }}
        >
          <div className="max-w-md">
            <h1
              className="font-bold mb-4"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", lineHeight: 1.1, color: "var(--color-text)" }}
            >
              Se foi combinado, o MEMÓRIA garante que será lembrado.
            </h1>
            <div
              className="space-y-3"
              style={{ fontSize: "clamp(0.95rem, 1.4vw, 1.05rem)", color: "var(--color-text-secondary)" }}
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
              <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                Lembrar é importante. Executar é essencial.
              </p>
            </div>
          </div>

          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Uma solução ONCLICK
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
