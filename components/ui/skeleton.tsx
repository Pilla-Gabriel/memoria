export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none rounded-lg ${className}`}
      style={{ background: "var(--color-border)", ...style }}
    />
  );
}
