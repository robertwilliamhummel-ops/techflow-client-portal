// Exact copy of roundToTwo from calculator.js — do not change this
export const roundToTwo = (num) =>
  Math.round((num + Number.EPSILON) * 100) / 100;

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundToTwo(typeof amount === 'number' ? amount : parseFloat(amount) || 0));

// Formats "2026-03-07" → "March 7, 2026" — matches original invoice.js formatDate()
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  // Add T12:00:00 to avoid timezone-related off-by-one issues
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Short format for display in tables: "Mar 7, 2026"
export const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Today's date as YYYY-MM-DD for input[type=date] default value
export const todayISO = () => new Date().toISOString().split('T')[0];
