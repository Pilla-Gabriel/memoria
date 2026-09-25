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

export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 0;
  const int = parseInt(match[1], 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const INK = "#0b1928";

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function darken(hex: string, amount: number): string {
  const int = parseInt(hex.replace("#", ""), 16);
  const channel = (shift: number) => Math.round(((int >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, "0")).join("")}`;
}

// A cor da base é dado (paleta categórica ou escolha do admin), não token de
// tema — branco fixo por cima falha contraste em 6 das 8 cores da paleta.
// Escolhe o texto (branco ou navy) com mais contraste; tons médios (roxo,
// índigo) não passam de 4.5:1 com nenhum dos dois, então o fundo escurece
// só o necessário, preservando o matiz.
export function readableBadgeColors(hex: string): { background: string; color: string } {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return { background: hex, color: "#ffffff" };
  let background = hex.startsWith("#") ? hex : `#${hex}`;
  for (let i = 0; i < 12; i++) {
    const color = contrastRatio("#ffffff", background) >= contrastRatio(INK, background) ? "#ffffff" : INK;
    if (contrastRatio(color, background) >= 4.5) return { background, color };
    background = darken(background, 0.05);
  }
  return { background, color: "#ffffff" };
}

export function initialsForName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
