type LogoProps = {
  variant?: "onLight" | "onDark";
  className?: string;
  showWordmark?: boolean;
};

export function Logo({ variant = "onLight", className = "", showWordmark = true }: LogoProps) {
  const textColor = variant === "onDark" ? "#FFFFFF" : "var(--color-text)";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="10" fill="#06A9F4" />
        <path
          d="M9 20.5V13l4.2 5.2L17.4 13v7.5"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 13.2c1.9-.6 4 .5 4.5 2.4.5 2-.9 3.6-2.7 4.3l-1.6.6"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="27.2" cy="8.2" r="2.6" fill="#FFF200" />
      </svg>
      {showWordmark && (
        <span
          className="font-semibold tracking-tight leading-none"
          style={{ color: textColor, fontSize: "1.15rem" }}
        >
          MEMÓRIA
        </span>
      )}
    </div>
  );
}
