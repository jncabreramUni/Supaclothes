const moneyFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const money = (amount: number) => moneyFormat.format(amount);

export function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function positiveQuantity(value: string) {
  const quantity = Number(value);
  return /^\d+$/.test(value.trim()) && Number.isInteger(quantity) && quantity > 0 && quantity <= 2147483647
    ? quantity : null;
}

export function isLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dateRangeError(from: string, to: string, maxDays?: number) {
  if ((from && !isLocalDate(from)) || (to && !isLocalDate(to))) return 'Usa fechas válidas con formato AAAA-MM-DD.';
  if (from && to && from > to) return 'La fecha desde debe ser anterior o igual a la fecha hasta.';
  if (from && to && maxDays !== undefined && (Date.parse(to) - Date.parse(from)) / 86400000 >= maxDays) {
    return `El rango admite hasta ${maxDays} días.`;
  }
  return '';
}
