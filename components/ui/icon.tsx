import {
  LayoutDashboard,
  MessageCircleQuestion,
  ListChecks,
  Target,
  CalendarCheck,
  Bell,
  BarChart3,
  ShieldCheck,
  Settings2,
  UserCog,
  Send,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  "layout-dashboard": LayoutDashboard,
  "message-circle-question": MessageCircleQuestion,
  "list-checks": ListChecks,
  target: Target,
  "calendar-check": CalendarCheck,
  bell: Bell,
  "bar-chart-3": BarChart3,
  "shield-check": ShieldCheck,
  "settings-2": Settings2,
  "user-cog": UserCog,
  send: Send,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Component = ICONS[name];
  return <Component {...props} />;
}
