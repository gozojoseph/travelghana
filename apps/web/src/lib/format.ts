/** Money formatting at the UI edge (D8: integer minor units never leak raw). */
export function formatGhs(minor: number): string {
  return `GHS ${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
