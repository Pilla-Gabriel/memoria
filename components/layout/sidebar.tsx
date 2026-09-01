"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Icon, type IconName } from "@/components/ui/icon";
import type { NavItem } from "@/lib/navigation";

export function Sidebar({
  items,
  open,
  onClose,
}: {
  items: NavItem[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={`fixed z-50 inset-y-0 left-0 w-64 flex flex-col border-r transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <Logo />
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--color-primary)" : "transparent",
                  color: active ? "#ffffff" : "var(--color-text)",
                }}
              >
                <Icon name={item.icon as IconName} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          Powered by ONCLICK
        </div>
      </aside>
    </>
  );
}
