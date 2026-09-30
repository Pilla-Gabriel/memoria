// O Recharts pinta o texto da legenda com a cor da série (azul/laranja/vermelho
// sobre branco = 1.9–4.4:1). O quadradinho continua colorido; o texto vai
// para a cor secundária do tema (auditoria Impeccable 2026-09-29).
export function legendText(value: string) {
  return <span style={{ color: "var(--color-text-secondary)" }}>{value}</span>;
}
