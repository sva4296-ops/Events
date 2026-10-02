import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';
import type { TFunction } from 'i18next';

import type { AppEvent, Guest, RsvpStatus } from '@/types/event';
import type { DetailsContent } from '@/types/guest';
import { formatPhoneDisplay } from '@/utils/countryCodes';

/**
 * Organizer export for the venue/restaurant: one .xlsx with three sheets
 * (guests, tables with menu counts per table, menus with portions and
 * dietary counts). Written by hand as a minimal OOXML package zipped with
 * fflate, so there's no spreadsheet library. Counts use confirmed guests only.
 */

type Cell = string | number | null;

interface Sheet {
  name: string;
  rows: Cell[][];
  widths: number[];
  /** Row indexes drawn bold besides the header (row 0 is always bold). */
  boldRows?: number[];
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const STATUS_ORDER: Record<RsvpStatus, number> = { confirmed: 0, pending: 1, declined: 2 };

const byName = (a: string, b: string) => a.localeCompare(b, 'ro', { numeric: true, sensitivity: 'base' });

export async function shareGuestWorkbook(event: AppEvent, details: DetailsContent, t: TFunction): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(t('export.unavailable'));
  }
  const bytes = buildWorkbook(guestSheets(event, details, t));
  const slug = event.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const file = new File(Paths.cache, `${t('export.fileName')}${slug.length > 0 ? `-${slug}` : ''}.xlsx`);
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: t('export.dialogTitle'),
  });
}

function guestSheets(event: AppEvent, details: DetailsContent, t: TFunction): Sheet[] {
  const tables = [...details.seatingTables].sort((a, b) => byName(a.name, b.name));
  const options = details.menuOptions;
  const tableName = new Map(tables.map((table) => [table.id, table.name]));
  const optionName = new Map(options.map((option) => [option.id, option.name]));
  const confirmed = event.guests.filter((guest) => guest.status === 'confirmed');
  const statusLabel: Record<RsvpStatus, string> = {
    confirmed: t('export.statusConfirmed'),
    pending: t('export.statusPending'),
    declined: t('export.statusDeclined'),
  };
  const tableOf = (guest: Guest) => (guest.tableId !== null ? tableName.get(guest.tableId) ?? null : null);
  const menuOf = (guest: Guest) => (guest.menuOptionId !== null ? optionName.get(guest.menuOptionId) ?? null : null);

  // Guests: confirmed first, then by table (unseated last), then name.
  const guests = [...event.guests].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      byName(tableOf(a) ?? '￿', tableOf(b) ?? '￿') ||
      byName(a.name, b.name),
  );
  const guestRows: Cell[][] = [
    [
      t('export.colName'),
      t('export.colPhone'),
      t('export.colStatus'),
      t('export.colTable'),
      t('export.colMenu'),
      t('export.colDietary'),
      t('export.colResponded'),
    ],
    ...guests.map((guest) => [
      guest.name,
      guest.phone !== null ? formatPhoneDisplay(guest.phone) : null,
      statusLabel[guest.status],
      tableOf(guest),
      menuOf(guest),
      guest.dietaryPreferences.join(', ') || null,
      guest.respondedAt !== null ? formatDateTime(guest.respondedAt) : null,
    ]),
  ];

  // Tables: confirmed guests per table, split by menu choice.
  const menuCounts = (group: Guest[]): number[] => [
    ...options.map((option) => group.filter((guest) => guest.menuOptionId === option.id).length),
    group.filter((guest) => menuOf(guest) === null).length,
  ];
  const tableRow = (name: string, label: string | null, seats: number | null, group: Guest[]): Cell[] => [
    name,
    label,
    seats,
    group.length,
    ...menuCounts(group),
    group
      .map((guest) => guest.name)
      .sort(byName)
      .join(', ') || null,
  ];
  const unseated = confirmed.filter((guest) => tableOf(guest) === null);
  const tableRows: Cell[][] = [
    [
      t('export.colTable'),
      t('export.colLabel'),
      t('export.colSeats'),
      t('export.colSeated'),
      ...options.map((option) => option.name),
      t('export.noMenu'),
      t('export.colGuests'),
    ],
    ...tables.map((table) =>
      tableRow(
        table.name,
        table.label || null,
        table.seat_count,
        confirmed.filter((guest) => guest.tableId === table.id),
      ),
    ),
    ...(unseated.length > 0 ? [tableRow(t('export.noTable'), null, null, unseated)] : []),
  ];
  const tableTotal: Cell[] = [
    t('export.total'),
    null,
    tables.reduce((sum, table) => sum + table.seat_count, 0),
    confirmed.length,
    ...menuCounts(confirmed),
    null,
  ];
  tableRows.push(tableTotal);

  // Menus: portions per option, then dietary preferences.
  const dietary = new Map<string, number>();
  for (const guest of confirmed) {
    for (const preference of guest.dietaryPreferences) {
      dietary.set(preference, (dietary.get(preference) ?? 0) + 1);
    }
  }
  const menuRows: Cell[][] = [
    [t('export.colMenu'), t('export.colPortions'), t('export.colCourses')],
    ...options.map((option) => [
      option.name,
      confirmed.filter((guest) => guest.menuOptionId === option.id).length,
      option.courses
        .filter((course) => course.dish.trim().length > 0)
        .map((course) => `${course.name}: ${course.dish}`)
        .join(' · ') || null,
    ]),
    [t('export.noMenu'), confirmed.filter((guest) => menuOf(guest) === null).length, null],
    [t('export.total'), confirmed.length, null],
  ];
  const dietaryHeader = menuRows.length + 1;
  if (dietary.size > 0) {
    menuRows.push([], [t('export.colDietary'), t('export.colCount'), null]);
    for (const [preference, count] of [...dietary].sort((a, b) => byName(a[0], b[0]))) {
      menuRows.push([preference, count, null]);
    }
  }

  return [
    { name: t('export.sheetGuests'), rows: guestRows, widths: [28, 18, 14, 16, 18, 26, 18] },
    {
      name: t('export.sheetTables'),
      rows: tableRows,
      widths: [18, 16, 10, 10, ...options.map(() => 14), 16, 60],
      boldRows: [tableRows.length - 1],
    },
    {
      name: t('export.sheetMenus'),
      rows: menuRows,
      widths: [24, 20, 80],
      boldRows: dietary.size > 0 ? [options.length + 2, dietaryHeader] : [options.length + 2],
    },
  ];
}

function formatDateTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ---- Minimal .xlsx writer ----

const escapeXml = (value: string) =>
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function sheetXml(sheet: Sheet): string {
  const bold = new Set([0, ...(sheet.boldRows ?? [])]);
  const rows = sheet.rows
    .map((row, r) => {
      const style = bold.has(r) ? ' s="1"' : '';
      const cells = row
        .map((value, c) => {
          if (value === null || value === '') return '';
          const ref = `${columnName(c)}${r + 1}`;
          return typeof value === 'number'
            ? `<c r="${ref}"${style}><v>${value}</v></c>`
            : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const cols = sheet.widths
    .map((width, c) => `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`
  );
}

function buildWorkbook(sheets: Sheet[]): Uint8Array {
  // Sheet names: max 31 chars, none of []:*?/\ (Excel rejects the file otherwise).
  const names = sheets.map((sheet) => escapeXml(sheet.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    ),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return zipSync(files);
}
