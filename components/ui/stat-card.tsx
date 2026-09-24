import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Ícone deixou de ser desenhado — a identidade de referência (Lovable) usa só
// tipografia nos blocos de estatística, sem badge colorido de ícone. Mantido
// na assinatura do componente pra não obrigar a tocar cada call site.
export function StatCard({
  label,
  value,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  href?: string;
}) {
  // --color-primary/-success/-warning/-danger são calibradas pra
  // preenchimento (barra de progresso, ponto de status), não pra texto —
  // em claro ficam abaixo de 3:1, e --color-primary-dark especificamente
  // fica ilegível no dark mode (não tem override próprio pro tema escuro,
  // vira navy-escuro sobre fundo navy-escuro). --badge-*-fg é a mesma
  // família de cor escurecida e com contraparte de dark mode, já usada
  // nos badges de status — segura nos dois temas.
  const toneFg: Record<string, string> = {
    default: "var(--color-text-secondary)",
    primary: "var(--badge-primary-fg)",
    success: "var(--badge-success-fg)",
    warning: "var(--badge-warning-fg)",
    danger: "var(--badge-danger-fg)",
  };

  const content = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: toneFg[tone] }}>
        {label}
      </span>
      <p
        className="font-display font-bold mt-1.5 leading-none"
        style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--badge-primary-fg)" }}
      >
        {value}
      </p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex flex-col p-4 md:p-5 hover:bg-black/[0.02] transition-colors">
        {content}
      </Link>
    );
  }

  return <div className="flex flex-col p-4 md:p-5">{content}</div>;
}
