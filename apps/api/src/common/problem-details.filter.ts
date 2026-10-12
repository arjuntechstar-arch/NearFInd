import { ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

function normalizeCode(title: string): string {
  return title
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, 80) || 'REQUEST_FAILED';
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = isHttp ? exception.getResponse() : null;
    const body = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
    const rawMessage = body.message;
    const errors = Array.isArray(rawMessage) ? rawMessage.filter((item): item is string => typeof item === 'string').slice(0, 20) : [];
    const title =
      typeof rawMessage === 'string'
        ? rawMessage
        : typeof body.error === 'string'
          ? body.error
          : status >= 500
            ? 'Internal server error'
            : 'Request failed';
    const code = typeof body.code === 'string' ? body.code : normalizeCode(title);
    reply.status(status).send({
      type: `https://errors.nearfind.app/${code.toLowerCase().replaceAll('_', '-')}`,
      title,
      status,
      code,
      traceId: request.id,
      errors,
    });
  }
}
