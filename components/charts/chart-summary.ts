// Resumo em texto dos gráficos de barras para leitor de tela (UI/UX Pro Max
// `screen-reader-summary`): o SVG do Recharts não diz nada sozinho.
type Row = Record<string, string | number | null | undefined>;

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function summarizeBars(title: string, data: Row[], series: { key: string; label: string }[], nameKey = "name") {
  if (data.length === 0) return `${title}: sem dados.`;
  const parts = series.map(({ key, label }) => {
    const total = data.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const top = data.reduce((best, r) => ((Number(r[key]) || 0) > (Number(best[key]) || 0) ? r : best), data[0]);
    return `${label}: total ${fmt(total)}, maior em ${top[nameKey]} (${fmt(Number(top[key]) || 0)})`;
  });
  return `${title}, ${data.length} ${data.length === 1 ? "item" : "itens"}. ${parts.join(". ")}.`;
}
