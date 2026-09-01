export function formatTaskCode(sequence: number) {
  return `T-${String(sequence).padStart(4, "0")}`;
}
