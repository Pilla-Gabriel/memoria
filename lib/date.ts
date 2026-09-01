/**
 * Converte o valor de um <input type="date"> (formato YYYY-MM-DD) para um
 * ISO string estável, ancorado ao meio-dia local. Evita o bug clássico de
 * `new Date("YYYY-MM-DD")` ser interpretado como meia-noite UTC e "voltar
 * um dia" ao ser exibido em fusos horários atrás de UTC.
 */
export function dateInputToISOString(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

/**
 * Retorna o valor de um <input type="date"> (YYYY-MM-DD) para "hoje + N dias"
 * no fuso horário local — usado pelos atalhos de prazo (Hoje/Amanhã/Semana).
 */
export function dateInputValueInDays(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
