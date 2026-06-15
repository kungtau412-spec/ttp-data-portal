import { format } from 'date-fns';

export function safeFormat(
  dateStr: string | null | undefined,
  formatStr: string = 'MMM d, yyyy'
): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), formatStr);
  } catch (e) {
    return '-';
  }
}

export function safeLocaleDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch (e) {
    return '-';
  }
}
