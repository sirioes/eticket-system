import { inflateRawSync } from 'node:zlib';
import { Divisi } from '../../common/enums/divisi.enum';
import { TicketExportRow } from '../application/ports/ticket-query.repository';
import {
  EXPORT_HEADERS,
  EXPORT_SHEET_NAME,
  XlsxTicketExportWriter,
} from './xlsx-ticket-export-writer';

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
    const entryName = zip.toString('utf8', offset + 46, offset + 46 + nameLength);

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

const row = (overrides: Partial<TicketExportRow> = {}): TicketExportRow => ({
  id: 'IT-2026-0001',
  fromDivisi: Divisi.IT,
  toDivisi: Divisi.DIGITAL_MARKETING,
  processedAt: null,
  completedAt: null,
  ...overrides,
});

describe('XlsxTicketExportWriter', () => {
  const writer = new XlsxTicketExportWriter();

  const write = async (rows: TicketExportRow[]) => {
    const file = await writer.write(rows);
    return {
      file,
      sheet: readZipEntry(file, 'xl/worksheets/sheet1.xml'),
      strings: readZipEntry(file, 'xl/sharedStrings.xml'),
      workbook: readZipEntry(file, 'xl/workbook.xml'),
    };
  };

  it('menghasilkan file XLSX (ZIP) yang valid', async () => {
    const { file } = await write([row()]);

    expect(file.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('menulis hanya lima kolom dengan judul yang disepakati', async () => {
    const { sheet, strings } = await write([row()]);

    for (const header of EXPORT_HEADERS) {
      expect(strings).toContain(`<t>${header}</t>`);
    }
    expect(sheet).not.toMatch(/r="F\d+"/);
  });

  it('memberi nama sheet dan membekukan baris judul', async () => {
    const { sheet, workbook } = await write([row()]);

    expect(workbook).toContain(`name="${EXPORT_SHEET_NAME}"`);
    expect(sheet).toContain('ySplit="1"');
  });

  it('menulis kode enum divisi apa adanya', async () => {
    const { strings } = await write([row()]);

    expect(strings).toContain('<t>IT</t>');
    expect(strings).toContain('<t>DIGITAL_MARKETING</t>');
  });

  it('menulis waktu sebagai datetime asli dalam jam dinding WITA', async () => {
    const { sheet } = await write([
      row({
        processedAt: new Date('2026-10-09T16:00:00.000Z'),
        completedAt: new Date('2026-10-10T04:30:00.000Z'),
      }),
    ]);

    expect(sheet).toMatch(/r="D2"[^>]*><v>46305<\/v>/);
    expect(sheet).toMatch(/r="E2"[^>]*><v>46305\.5208333\d*<\/v>/);
  });

  it('mengosongkan sel waktu yang belum terjadi', async () => {
    const { sheet } = await write([row()]);

    expect(sheet).not.toMatch(/r="D2"/);
    expect(sheet).not.toMatch(/r="E2"/);
  });

  it('tidak pernah membuat formula dari isi sel', async () => {
    const { sheet, strings } = await write([
      row({ id: '=HYPERLINK("http://x","klik")' }),
    ]);

    expect(sheet).not.toContain('<f>');
    expect(strings).toContain('<t>=HYPERLINK("http://x","klik")</t>');
  });

  it('meng-escape karakter XML di dalam sel', async () => {
    const { strings } = await write([row({ id: '</t><f>1+1</f>&' })]);

    expect(strings).toContain('&lt;/t&gt;&lt;f&gt;1+1&lt;/f&gt;&amp;');
  });

  it('menulis file berisi judul saja untuk hasil kosong', async () => {
    const { sheet } = await write([]);

    expect(sheet).toContain('r="A1"');
    expect(sheet).not.toContain('r="A2"');
  });
});
