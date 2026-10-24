import { inflateRawSync } from 'node:zlib';
import {
  TicketDetailExport,
  TicketDetailExportHistoryRow,
} from '../application/ports/ticket-detail-export-writer';
import {
  HISTORY_HEADERS,
  HISTORY_SHEET_NAME,
  INFORMATION_LABELS,
  INFORMATION_SHEET_NAME,
  REASON_HEADER,
  XlsxTicketDetailExportWriter,
} from './xlsx-ticket-detail-export-writer';

function readZipEntry(zip: Buffer, name: string): string {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const entries = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);

  for (let i = 0; i < entries; i += 1) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const entryName = zip.toString(
      'utf8',
      offset + 46,
      offset + 46 + nameLength,
    );

    if (entryName === name) {
      const dataStart =
        localOffset +
        30 +
        zip.readUInt16LE(localOffset + 26) +
        zip.readUInt16LE(localOffset + 28);
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`entry ${name} tidak ditemukan`);
}

const historyRow = (
  overrides: Partial<TicketDetailExportHistoryRow> = {},
): TicketDetailExportHistoryRow => ({
  action: 'Dibuat',
  actor: 'Ayu Lestari',
  divisi: 'IT',
  createdAt: new Date('2026-10-09T16:00:00.000Z'),
  reason: null,
  ...overrides,
});

const detail = (
  overrides: Partial<TicketDetailExport> = {},
): TicketDetailExport => ({
  information: {
    id: 'IT-20261008-001',
    fromDivisi: 'YouTube',
    toDivisi: 'Digital Marketing',
    createdBy: 'Ayu Lestari',
    createdAt: new Date('2026-10-09T16:00:00.000Z'),
    status: 'Diproses',
    description: 'Printer lantai 2 tidak bisa mencetak',
  },
  history: [historyRow()],
  includeReason: false,
  ...overrides,
});

describe('XlsxTicketDetailExportWriter', () => {
  const writer = new XlsxTicketDetailExportWriter();

  const write = async (data: TicketDetailExport) => {
    const file = await writer.write(data);
    return {
      file,
      information: readZipEntry(file, 'xl/worksheets/sheet1.xml'),
      history: readZipEntry(file, 'xl/worksheets/sheet2.xml'),
      strings: readZipEntry(file, 'xl/sharedStrings.xml'),
      workbook: readZipEntry(file, 'xl/workbook.xml'),
    };
  };

  it('menghasilkan file XLSX (ZIP) yang valid', async () => {
    const { file } = await write(detail());

    expect(file.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('membuat dua sheet bernama Informasi dan Riwayat', async () => {
    const { workbook } = await write(detail());

    expect(workbook).toContain(`name="${INFORMATION_SHEET_NAME}"`);
    expect(workbook).toContain(`name="${HISTORY_SHEET_NAME}"`);
    expect(workbook.match(/<sheet /g)).toHaveLength(2);
  });

  it('menulis pasangan label dan nilai pada sheet Informasi', async () => {
    const { information, strings } = await write(detail());

    for (const label of INFORMATION_LABELS) {
      expect(strings).toContain(`<t>${label}</t>`);
    }
    for (const value of [
      'IT-20261008-001',
      'YouTube',
      'Digital Marketing',
      'Ayu Lestari',
      'Diproses',
      'Printer lantai 2 tidak bisa mencetak',
    ]) {
      expect(strings).toContain(`<t>${value}</t>`);
    }
    expect(information).toMatch(/r="B5"[^>]*><v>46305<\/v>/);
    expect(information).not.toMatch(/r="A8"/);
  });

  it('menulis kolom Alasan hanya bila diminta', async () => {
    const withReason = await write(
      detail({
        includeReason: true,
        history: [historyRow({ reason: 'Kebutuhan mendesak sekali' })],
      }),
    );
    const without = await write(detail());

    for (const header of [...HISTORY_HEADERS, REASON_HEADER]) {
      expect(withReason.strings).toContain(`<t>${header}</t>`);
    }
    expect(withReason.history).toMatch(/r="E1"/);
    expect(withReason.strings).toContain('<t>Kebutuhan mendesak sekali</t>');

    for (const header of HISTORY_HEADERS) {
      expect(without.strings).toContain(`<t>${header}</t>`);
    }
    expect(without.strings).not.toContain(`<t>${REASON_HEADER}</t>`);
    expect(without.history).not.toMatch(/r="E\d+"/);
  });

  it('tidak membocorkan alasan ke berkas tanpa kolom Alasan', async () => {
    const { strings } = await write(
      detail({
        includeReason: false,
        history: [historyRow({ reason: 'Alasan rahasia manajer' })],
      }),
    );

    expect(strings).not.toContain('Alasan rahasia manajer');
  });

  it('membekukan baris judul riwayat dan menulis waktu dalam jam dinding WITA', async () => {
    const { history } = await write(detail());

    expect(history).toContain('ySplit="1"');
    expect(history).toMatch(/r="D2"[^>]*><v>46305<\/v>/);
  });

  it('mengosongkan sel divisi dan alasan yang tidak ada', async () => {
    const { history } = await write(
      detail({
        includeReason: true,
        history: [historyRow({ divisi: null, reason: null })],
      }),
    );

    expect(history).not.toMatch(/r="C2"/);
    expect(history).not.toMatch(/r="E2"/);
  });

  it('menulis satu baris riwayat per entri', async () => {
    const { history } = await write(
      detail({
        history: [historyRow(), historyRow(), historyRow()],
      }),
    );

    expect(history).toMatch(/r="A4"/);
    expect(history).not.toMatch(/r="A5"/);
  });

  it('tidak pernah membuat formula dari teks bebas', async () => {
    const formula = '=HYPERLINK("http://x","klik")';
    const { information, history, strings } = await write(
      detail({
        includeReason: true,
        information: {
          ...detail().information,
          description: formula,
          createdBy: '+cmd|calc',
        },
        history: [
          historyRow({ actor: '@SUM(1+1)', reason: '-2+3', action: formula }),
        ],
      }),
    );

    expect(information).not.toContain('<f>');
    expect(history).not.toContain('<f>');
    expect(strings).toContain(`<t>${formula}</t>`);
    for (const text of ['+cmd|calc', '@SUM(1+1)', '-2+3']) {
      expect(strings).toContain(`<t>${text}</t>`);
    }
  });

  it('meng-escape karakter XML di dalam sel', async () => {
    const { strings } = await write(
      detail({
        information: {
          ...detail().information,
          description: '</t><f>1+1</f>&',
        },
      }),
    );

    expect(strings).toContain('&lt;/t&gt;&lt;f&gt;1+1&lt;/f&gt;&amp;');
  });

  it('menulis sheet riwayat berisi judul saja untuk riwayat kosong', async () => {
    const { history } = await write(detail({ history: [] }));

    expect(history).toContain('r="A1"');
    expect(history).not.toContain('r="A2"');
  });
});
