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
  const toneFg: Record<string, string> = {
    default: "var(--color-text-secondary)",
    primary: "var(--color-primary-dark)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
  };

  const content = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: toneFg[tone] }}>
        {label}
      </span>
      <p
        className="font-display font-bold mt-1.5 leading-none"
        style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--color-primary-dark)" }}
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
