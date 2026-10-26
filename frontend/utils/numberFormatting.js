export function formatCompactNumber(value, currency = false) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-PH', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: Math.abs(amount) < 1000 && currency ? 2 : 1,
    ...(currency ? { style: 'currency', currency: 'PHP', minimumFractionDigits: Math.abs(amount) < 1000 ? 2 : 0 } : {}),
  }).format(amount);
}
