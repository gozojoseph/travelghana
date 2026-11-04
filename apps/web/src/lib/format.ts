/** Money formatting at the UI edge (D8: integer minor units never leak raw). */
export function formatGhs(minor: number): string {
  return `GHS ${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** GHS display input → integer minor units (pesewas never leak to the UI). */
export function toMinorUnits(cedis: string): number {
  return Math.round(Number.parseFloat(cedis) * 100);
}

/** Integer minor units → GHS display input value (e.g. "4500.00"). */
export function toCedisDisplay(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Formats any ISO 4217 currency from integer minor units. */
export function formatMoney(amountMinor: number, currencyCode = "GHS"): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
