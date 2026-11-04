export function cents(value: number) { return Math.round(value * 100); }
export function amountFromCents(value: number) { return (value / 100).toFixed(2); }
export function financialYear(date: string) { const [year, month] = date.split("-").map(Number); const start = month >= 4 ? year : year - 1; return `${start}-${String((start + 1) % 100).padStart(2, "0")}`; }
export function calculateTaxLine(quantity: number, unitPrice: number, taxRate: number) {
  if (![quantity, unitPrice, taxRate].every(Number.isFinite) || quantity <= 0 || unitPrice < 0 || taxRate < 0 || taxRate > 100) throw new Error("Invalid tax line");
  const subtotalCents = cents(quantity * unitPrice);
  const taxCents = Math.round(subtotalCents * taxRate / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
