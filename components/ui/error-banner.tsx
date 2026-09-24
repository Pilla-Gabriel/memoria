export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm rounded-lg px-3 py-2"
      style={{ background: "var(--badge-danger-bg)", color: "var(--badge-danger-fg)" }}
    >
      {children}
    </p>
  );
}
