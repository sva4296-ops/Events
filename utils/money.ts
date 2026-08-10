/** e.g. formatMoney(4650, 'RON') → "4.650 RON" */
export function formatMoney(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString('ro-RO')} ${currency}`;
}
