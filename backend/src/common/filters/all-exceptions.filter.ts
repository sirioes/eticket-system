import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

interface ExposedClientError {
  status: number;
  message: string;
}

function asExposedClientError(exception: unknown): ExposedClientError | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { status, expose, message } = exception as Record<string, unknown>;
  if (
    typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 400 &&
    status < 500 &&
    expose === true &&
    typeof message === 'string'
  ) {
    return { status, message };
  }
  return null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : { statusCode: status, ...body },
        );
      return;
    }

    const clientError = asExposedClientError(exception);
    if (clientError) {
      response
        .status(clientError.status)
        .json({ statusCode: clientError.status, message: clientError.message });
      return;
    }

    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
    });
  }
}
