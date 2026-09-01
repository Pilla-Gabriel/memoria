import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: IconComponent,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  href?: string;
}) {
  const toneColors: Record<string, { bg: string; fg: string }> = {
    default: { bg: "rgba(107,114,128,0.1)", fg: "var(--color-text-secondary)" },
    primary: { bg: "rgba(6,169,244,0.12)", fg: "var(--color-primary)" },
    success: { bg: "rgba(34,197,94,0.12)", fg: "var(--color-success)" },
    warning: { bg: "rgba(245,158,11,0.12)", fg: "var(--color-warning)" },
    danger: { bg: "rgba(239,68,68,0.12)", fg: "var(--color-danger)" },
  };
  const colors = toneColors[tone];

  const content = (
    <>
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: colors.bg, color: colors.fg }}
      >
        <IconComponent size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight" style={{ fontSize: "clamp(1.1rem, 2vw, 1.4rem)" }}>
          {value}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card p-4 md:p-5 flex items-center gap-3.5 hover:shadow-lg transition-shadow">
        {content}
      </Link>
    );
  }

  return <div className="card p-4 md:p-5 flex items-center gap-3.5">{content}</div>;
}
