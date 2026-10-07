import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  APNG,
  EXE,
  HTML,
  JPEG,
  PDF,
  PNG,
  WEBP,
} from '../../../../test/fixtures/files';
import { DiskAttachmentFileStore } from './disk-attachment-file-store';

const NAME = '3f2b8c1e-5a47-4d9b-8e60-1c2d3e4f5a6b';

describe('DiskAttachmentFileStore', () => {
  let directory: string;
  let outside: string;
  const store = new DiskAttachmentFileStore();
  const previousUploadDir = process.env.UPLOAD_DIR;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'eticket-store-'));
    directory = path.join(root, 'uploads');
    outside = path.join(root, 'secret.txt');
    process.env.UPLOAD_DIR = directory;
    await writeFile(outside, 'jangan disentuh');
    await mkdir(directory);
  });

  afterEach(async () => {
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    await rm(path.dirname(directory), { recursive: true, force: true });
  });

  describe('detectMimeType', () => {
    it.each([
      ['png', PNG, 'image/png'],
      ['animated png', APNG, 'image/apng'],
      ['jpeg', JPEG, 'image/jpeg'],
      ['webp', WEBP, 'image/webp'],
      ['pdf', PDF, 'application/pdf'],
    ])(
      'reads the type of a real %s from its bytes',
      async (_l, bytes, mime) => {
        await writeFile(path.join(directory, NAME), bytes);
        await expect(store.detectMimeType(NAME)).resolves.toBe(mime);
      },
    );

    it('reports what the content really is', async () => {
      await writeFile(path.join(directory, NAME), EXE);
      await expect(store.detectMimeType(NAME)).resolves.toBe(
        'application/x-msdownload',
      );
    });

    it('returns null for content it cannot recognize', async () => {
      await writeFile(path.join(directory, NAME), HTML);
      await expect(store.detectMimeType(NAME)).resolves.toBeNull();
    });

    it('fails when the file does not exist', async () => {
      await expect(store.detectMimeType(NAME)).rejects.toThrow();
    });
  });

  describe('open', () => {
    it('streams the stored bytes and reports the size', async () => {
      await writeFile(path.join(directory, NAME), PDF);

      const file = await store.open(NAME);

      expect(file?.size).toBe(PDF.length);
      const chunks: Buffer[] = [];
      for await (const chunk of file!.stream) chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks).equals(PDF)).toBe(true);
    });

    it('returns null when the file does not exist', async () => {
      await expect(store.open(NAME)).resolves.toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the file', async () => {
      await writeFile(path.join(directory, NAME), PNG);
      await store.remove(NAME);
      await expect(readdir(directory)).resolves.toEqual([]);
    });

    it('does not fail when the file is already gone', async () => {
      await expect(store.remove(NAME)).resolves.toBeUndefined();
    });
  });

  describe('onModuleInit', () => {
    it('creates the folder, including missing parents', async () => {
      const nested = path.join(path.dirname(directory), 'a', 'b', 'uploads');
      process.env.UPLOAD_DIR = nested;

      await store.onModuleInit();

      expect((await stat(nested)).isDirectory()).toBe(true);
    });

    it('is safe to run on an existing folder with files in it', async () => {
      await writeFile(path.join(directory, NAME), PNG);
      await store.onModuleInit();
      await expect(readdir(directory)).resolves.toEqual([NAME]);
    });

    (process.platform === 'win32' ? it.skip : it)(
      'restricts the folder to its owner, even when it already existed with looser permissions',
      async () => {
        await chmod(directory, 0o777);

        await store.onModuleInit();

        expect((await stat(directory)).mode & 0o777).toBe(0o700);
      },
    );
  });

  describe('path containment', () => {
    it.each([
      '../secret.txt',
      '..\\secret.txt',
      '/etc/passwd',
      'sub/../../secret.txt',
      'sub/a',
      'a',
      `${NAME}.png`,
      `${NAME}.exe`,
      `${NAME}\n`,
      NAME.toUpperCase(),
      `../${NAME}`,
      '..',
      '.',
      '',
    ])('refuses the stored name %p', async (name) => {
      await expect(store.detectMimeType(name)).rejects.toThrow(
        'Nama file tersimpan tidak valid',
      );
      await expect(store.open(name)).rejects.toThrow(
        'Nama file tersimpan tidak valid',
      );
      await expect(store.remove(name)).rejects.toThrow(
        'Nama file tersimpan tidak valid',
      );
      await expect(readdir(path.dirname(outside))).resolves.toContain(
        'secret.txt',
      );
    });
  });
});
