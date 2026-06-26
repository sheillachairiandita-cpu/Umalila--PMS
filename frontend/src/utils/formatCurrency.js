export function formatRp(value) {
  const n = Number(value) || 0;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export const formatCurrency = formatRp;
