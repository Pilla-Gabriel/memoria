// Cor estável derivada do slug — usada como fallback para uma base que não
// tenha uma cor própria já gravada (as 5 bases atuais sempre têm uma, ver
// prisma/seed.ts). Determinístico: o mesmo slug sempre gera a mesma cor, sem
// precisar de coordenação manual ao criar uma base nova.
const PALETTE = ["#06a9f4", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

export function colorForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function initialsForName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
