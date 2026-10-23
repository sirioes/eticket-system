import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { resolveUploadDir } from '../attachments/attachments.config';
import {
  hasAllowedCompletionExtension,
  MAX_COMPLETION_FILE_BYTES,
  MAX_COMPLETION_FILES,
  UNSUPPORTED_COMPLETION_FILE_MESSAGE,
} from '../domain/completion-file-rules';

export const COMPLETION_FIELD_NAME = 'files';

export const completionMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => callback(null, resolveUploadDir()),
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: MAX_COMPLETION_FILE_BYTES,
    files: MAX_COMPLETION_FILES,
    fields: 0,
    parts: MAX_COMPLETION_FILES,
  },
  defParamCharset: 'utf8',
  fileFilter: (_req, file, callback) => {
    if (!hasAllowedCompletionExtension(file.originalname)) {
      callback(
        new BadRequestException(UNSUPPORTED_COMPLETION_FILE_MESSAGE),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
