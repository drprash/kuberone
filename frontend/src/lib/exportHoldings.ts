import ExcelJS from 'exceljs';

export interface HoldingExportRow {
  symbol: string;
  name: string;
  asset_type: string;
  account: string;
  quantity: number;
  avg_buy_price: number;
  avg_buy_price_currency: string;
  current_price: number | null;
  current_price_currency: string;
  invested: number;
  current_value: number | null;
  profit_loss: number | null;
  profit_loss_percentage: number | null;
}

function buildColumns(includeAccount: boolean, baseCurrency: string): { key: keyof HoldingExportRow; header: string }[] {
  const columns: { key: keyof HoldingExportRow; header: string }[] = [
    { key: 'symbol', header: 'Symbol' },
    { key: 'name', header: 'Name' },
    { key: 'asset_type', header: 'Type' },
  ];
  if (includeAccount) columns.push({ key: 'account', header: 'Account' });
  columns.push(
    { key: 'quantity', header: 'Quantity' },
    { key: 'avg_buy_price', header: 'Avg Buy Price' },
    { key: 'avg_buy_price_currency', header: 'Avg Price Currency' },
    { key: 'current_price', header: 'Current Price' },
    { key: 'current_price_currency', header: 'Current Price Currency' },
    { key: 'invested', header: `Invested (${baseCurrency})` },
    { key: 'current_value', header: `Current Value (${baseCurrency})` },
    { key: 'profit_loss', header: `P&L (${baseCurrency})` },
    { key: 'profit_loss_percentage', header: 'Return %' }
  );
  return columns;
}

function cellValue(row: HoldingExportRow, key: keyof HoldingExportRow): string | number {
  const value = row[key];
  return value === null || value === undefined ? '' : value;
}

function escapeCSVField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportHoldingsToCSV(
  rows: HoldingExportRow[],
  includeAccount: boolean,
  baseCurrency: string,
  filename: string
): void {
  const columns = buildColumns(includeAccount, baseCurrency);
  const lines = [
    columns.map((c) => escapeCSVField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCSVField(cellValue(row, c.key))).join(',')),
  ];
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename);
}

export async function exportHoldingsToXLSX(
  rows: HoldingExportRow[],
  includeAccount: boolean,
  baseCurrency: string,
  filename: string
): Promise<void> {
  const columns = buildColumns(includeAccount, baseCurrency);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Holdings');
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key as string, width: 18 }));
  rows.forEach((row) => {
    sheet.addRow(
      columns.reduce((acc, c) => {
        acc[c.key as string] = cellValue(row, c.key);
        return acc;
      }, {} as Record<string, string | number>)
    );
  });
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );
}
