const SOURCE_LABEL: Record<string, string> = {
  AZURE_DEVOPS: "Azure DevOps",
  TEAMS: "Teams",
  SLACK: "Slack",
  DOCUMENTACAO_INTERNA: "Documentação interna",
  OUTRA: "Outra fonte",
};

export function RiskBadge({ isAtRisk }: { isAtRisk: boolean }) {
  if (!isAtRisk) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
        style={{ background: "rgba(34,197,94,0.12)", color: "#166534" }}
      >
        No prazo
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: "rgba(239,68,68,0.12)", color: "#991b1b" }}
    >
      Em risco
    </span>
  );
}

export function BlockerStatusBadge({ status }: { status: string }) {
  const open = status === "ABERTO";
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        background: open ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
        color: open ? "#991b1b" : "#166534",
      }}
    >
      {open ? "Aberto" : "Resolvido"}
    </span>
  );
}

export function SourceLabel({
  source,
  detail,
  linkify = true,
}: {
  source: string;
  detail?: string | null;
  linkify?: boolean;
}) {
  const label = SOURCE_LABEL[source] ?? source;
  if (linkify && detail?.startsWith("http")) {
    return (
      <a
        href={detail}
        target="_blank"
        rel="noreferrer"
        className="hover:underline"
        style={{ color: "var(--color-primary)" }}
      >
        {label} ↗
      </a>
    );
  }
  return (
    <>
      {label}
      {detail ? ` — ${detail}` : ""}
    </>
  );
}

export function ReportStatusBadge({ status }: { status: string }) {
  const published = status === "PUBLICADO";
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        background: published ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
        color: published ? "#166534" : "#92400e",
      }}
    >
      {published ? "Publicado" : "Rascunho"}
    </span>
  );
}
