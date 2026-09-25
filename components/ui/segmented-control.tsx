const SIZE_CLASS = {
  xs: "px-3 py-1.5 text-xs",
  sm: "px-3 py-2 text-sm",
  md: "px-3.5 py-2 text-sm",
} as const;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <div
      className={`flex rounded-xl border overflow-hidden w-fit ${className}`}
      style={{ borderColor: "var(--color-border)" }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`${SIZE_CLASS[size]} font-medium`}
            style={{ background: active ? "var(--color-primary)" : "transparent", color: active ? "var(--color-on-primary)" : "var(--color-text)" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
