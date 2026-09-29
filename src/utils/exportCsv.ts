/**
 * Utility for exporting datasets to CSV format with proper UTF-8 BOM and sanitization
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

export function exportToCsv<T>(filename: string, data: T[], columns: CsvColumn<T>[]): void {
  if (!data || data.length === 0) {
    throw new Error('No data records available to export.');
  }

  // 1. Create header row
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(',');

  // 2. Create data rows
  const dataRows = data.map((item) =>
    columns
      .map((col) => {
        const val = col.accessor(item);
        if (val === null || val === undefined) return '""';
        return escapeCsvCell(String(val));
      })
      .join(',')
  );

  // 3. Assemble CSV string with UTF-8 BOM for Excel compatibility
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

  // 4. Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  const sanitizedFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', sanitizedFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(cell: string): string {
  // Prevent CSV Injection (DDE) by prefixing leading special formula triggers
  let sanitized = cell;
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = `'${sanitized}`;
  }

  // Escape double quotes by doubling them
  const escaped = sanitized.replace(/"/g, '""');
  return `"${escaped}"`;
}
