import type { Readable } from 'node:stream';

export interface OpenedFile {
  readonly stream: Readable;
  readonly size: number;
}

export abstract class AttachmentFileStore {
  abstract detectMimeType(storedName: string): Promise<string | null>;

  abstract open(storedName: string): Promise<OpenedFile | null>;

  abstract remove(storedName: string): Promise<void>;
}
