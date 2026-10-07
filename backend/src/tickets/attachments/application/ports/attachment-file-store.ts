export abstract class AttachmentFileStore {
  abstract detectMimeType(storedName: string): Promise<string | null>;

  abstract remove(storedName: string): Promise<void>;
}
