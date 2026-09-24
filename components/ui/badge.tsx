export type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral" | "muted" | "info";

const TONE_VARS: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: "var(--badge-primary-bg)", fg: "var(--badge-primary-fg)" },
  success: { bg: "var(--badge-success-bg)", fg: "var(--badge-success-fg)" },
  warning: { bg: "var(--badge-warning-bg)", fg: "var(--badge-warning-fg)" },
  danger: { bg: "var(--badge-danger-bg)", fg: "var(--badge-danger-fg)" },
  neutral: { bg: "var(--badge-neutral-bg)", fg: "var(--badge-neutral-fg)" },
  muted: { bg: "var(--badge-neutral-bg)", fg: "var(--badge-muted-fg)" },
  info: { bg: "var(--badge-info-bg)", fg: "var(--badge-info-fg)" },
};

export function Badge({
  tone,
  size = "default",
  children,
}: {
  tone: BadgeTone;
  // "compact" existe só pra StateCategoryBadge, mais denso pra caber numa
  // tabela de itens do Azure DevOps sem alargar as linhas.
  size?: "default" | "compact";
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        size === "compact"
          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
          : "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      }
      style={{ background: TONE_VARS[tone].bg, color: TONE_VARS[tone].fg }}
    >
      {children}
    </span>
  );
}
