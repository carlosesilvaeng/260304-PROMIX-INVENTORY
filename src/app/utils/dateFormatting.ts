const MONTH_LABELS_ES: Record<string, string> = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
  '04': 'abril',
  '05': 'mayo',
  '06': 'junio',
  '07': 'julio',
  '08': 'agosto',
  '09': 'septiembre',
  '10': 'octubre',
  '11': 'noviembre',
  '12': 'diciembre',
};

export function formatYearMonthLabel(yearMonth?: string | null): string {
  if (!yearMonth) return 'Sin mes';

  const [year, month] = String(yearMonth).split('-');
  if (!year || !month) return yearMonth;

  return `${MONTH_LABELS_ES[month] || month} de ${year}`;
}
