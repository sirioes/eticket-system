import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { diskStorage } from 'multer';
import {
  hasAllowedExtension,
  MAX_ATTACHMENT_BYTES,
  UNSUPPORTED_FILE_TYPE_MESSAGE,
} from './domain/attachment-rules';

export const UPLOAD_FIELD_NAME = 'file';

export const UPLOAD_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

export function resolveUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

export const attachmentMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => callback(null, resolveUploadDir()),

    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },
  defParamCharset: 'utf8',

  fileFilter: (_req, file, callback) => {
    if (!hasAllowedExtension(file.originalname)) {
      callback(new BadRequestException(UNSUPPORTED_FILE_TYPE_MESSAGE), false);
      return;
    }
    callback(null, true);
  },
};
