export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Short and unambiguous: "17 Aug 2026, 14:32". */
export function formatModified(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Splits `report.pdf` into `report` and `.pdf` so a rename can preselect the
 * part people actually change.
 */
export function splitFileName(name: string): { stem: string; extension: string } {
  const lastDot = name.lastIndexOf('.');

  if (lastDot <= 0) return { stem: name, extension: '' };

  return { stem: name.slice(0, lastDot), extension: name.slice(lastDot) };
}
