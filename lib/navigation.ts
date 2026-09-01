export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles?: Array<"USER" | "LEADER" | "ADMIN">;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: "layout-dashboard" },
  { href: "/checkin", label: "Check-in", icon: "message-circle-question" },
  { href: "/tarefas", label: "Tarefas", icon: "list-checks" },
  { href: "/metas", label: "Metas", icon: "target" },
  { href: "/revisao-semanal", label: "Revisão Semanal", icon: "calendar-check" },
  { href: "/entrega-semanal", label: "Entrega Semanal", icon: "send" },
  { href: "/alertas", label: "Alertas", icon: "bell" },
  { href: "/executivo", label: "Dashbord", icon: "bar-chart-3", roles: ["LEADER", "ADMIN"] },
  { href: "/auditoria", label: "Auditoria", icon: "shield-check", roles: ["LEADER", "ADMIN"] },
  { href: "/admin", label: "Administração", icon: "settings-2", roles: ["ADMIN"] },
  { href: "/configuracoes", label: "Configurações", icon: "user-cog", roles: ["USER", "LEADER", "ADMIN"] },
];

export function navItemsForRole(role: string) {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role as "USER" | "LEADER" | "ADMIN"));
}
