import { Injectable, OnModuleInit } from '@nestjs/common';
import { fileTypeFromFile } from 'file-type';
import { chmod, mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  AttachmentFileStore,
  OpenedFile,
} from '../application/ports/attachment-file-store';
import { resolveUploadDir } from '../attachments.config';

const STORED_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const DIRECTORY_MODE = 0o700;

@Injectable()
export class DiskAttachmentFileStore
  implements AttachmentFileStore, OnModuleInit
{
  async onModuleInit(): Promise<void> {
    const directory = resolveUploadDir();
    await mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
    await chmod(directory, DIRECTORY_MODE);
  }

  async detectMimeType(storedName: string): Promise<string | null> {
    const detected = await fileTypeFromFile(this.pathOf(storedName));
    return detected?.mime ?? null;
  }

  async open(storedName: string): Promise<OpenedFile | null> {
    let handle;
    try {
      handle = await open(this.pathOf(storedName), 'r');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    try {
      const { size } = await handle.stat();
      return { stream: handle.createReadStream(), size };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async remove(storedName: string): Promise<void> {
    await rm(this.pathOf(storedName), { force: true });
  }

  private pathOf(storedName: string): string {
    const directory = resolveUploadDir();
    const resolved = path.resolve(directory, storedName);
    if (!STORED_NAME.test(storedName) || path.dirname(resolved) !== directory) {
      throw new Error('Nama file tersimpan tidak valid');
    }
    return resolved;
  }
}
