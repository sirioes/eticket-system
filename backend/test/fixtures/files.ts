import { crc32 } from 'node:zlib';

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

export const APNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAABAAAAALQt6aAAAAANSURBVHicY/jPwPAfAAUAAf+rzjaJAAAAAElFTkSuQmCC',
  'base64',
);

export const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

export const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(14),
]);

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

export const EXE = Buffer.concat([
  Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
  Buffer.alloc(64),
]);

export const HTML = Buffer.from('<script>alert(document.cookie)</script>');

export const SVG = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

export function padded(head: Buffer, size: number): Buffer {
  return Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length))]);
}

function zipOf(entries: readonly (readonly [string, string])[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const contentTypes = (mainPart: string) =>
  `<?xml version="1.0"?><Types><Override PartName="/part" ContentType="${mainPart}"/></Types>`;

export const DOCX = zipOf([
  [
    '[Content_Types].xml',
    contentTypes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    ),
  ],
  ['_rels/.rels', '<Relationships/>'],
  ['word/document.xml', '<document/>'],
]);

export const XLSX = zipOf([
  [
    '[Content_Types].xml',
    contentTypes(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    ),
  ],
  ['_rels/.rels', '<Relationships/>'],
  ['xl/workbook.xml', '<workbook/>'],
]);

export const ZIP = zipOf([['catatan.txt', 'bukan dokumen kantor']]);
