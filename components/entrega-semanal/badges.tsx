import { Badge, type BadgeTone } from "@/components/ui/badge";

const SOURCE_LABEL: Record<string, string> = {
  AZURE_DEVOPS: "Azure DevOps",
  TEAMS: "Teams",
  SLACK: "Slack",
  DOCUMENTACAO_INTERNA: "Documentação interna",
  OUTRA: "Outra fonte",
};

export function RiskBadge({ isAtRisk }: { isAtRisk: boolean }) {
  return <Badge tone={isAtRisk ? "danger" : "success"}>{isAtRisk ? "Em risco" : "No prazo"}</Badge>;
}

export function BlockerStatusBadge({ status }: { status: string }) {
  const open = status === "ABERTO";
  return <Badge tone={open ? "danger" : "success"}>{open ? "Aberto" : "Resolvido"}</Badge>;
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
        style={{ color: "var(--badge-primary-fg)" }}
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

// Cor por categoria do estado (Proposed/InProgress/Resolved/Completed/Removed),
// vinda de /_apis/wit/workitemtypes/{tipo}/states — nunca do texto do estado
// em si, já que o nome exibido (`state`) varia por tipo/processo mas a
// categoria é estável. "Resolved" usa o tom "info" (só ele usa) porque não
// tem equivalente semântico em primary/success/warning/danger.
const STATE_CATEGORY_TONE: Record<string, BadgeTone> = {
  Completed: "success",
  InProgress: "primary",
  Resolved: "info",
  Proposed: "neutral",
  Removed: "danger",
  Other: "neutral",
};

export function StateCategoryBadge({ state, stateCategory }: { state: string; stateCategory: string }) {
  const tone = STATE_CATEGORY_TONE[stateCategory] ?? STATE_CATEGORY_TONE.Other;
  return (
    <Badge tone={tone} size="compact">
      {state}
    </Badge>
  );
}

export function ReportStatusBadge({ status }: { status: string }) {
  const published = status === "PUBLICADO";
  return <Badge tone={published ? "success" : "warning"}>{published ? "Publicado" : "Rascunho"}</Badge>;
}
