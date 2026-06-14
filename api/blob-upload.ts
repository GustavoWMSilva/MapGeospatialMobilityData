import { put } from '@vercel/blob';
import type { PutBlobResult } from '@vercel/blob';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_SERVER_UPLOAD_SIZE_BYTES = 4.5 * 1024 * 1024;

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
  url?: string;
};
type BlobPutBody = Parameters<typeof put>[1];

function sendJson(response: ServerResponse, status: number, data: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestUrl(request: VercelRequest): URL {
  const host = getHeaderValue(request.headers.host) ?? 'localhost';
  return new URL(request.url ?? '/', `https://${host}`);
}

function isAllowedDatasetPath(pathname: string): boolean {
  return /^datasets\/[a-z0-9][a-z0-9_-]*\/profile\.json$/i.test(pathname);
}

function getUploadBody(request: VercelRequest): BlobPutBody {
  if (request.body === undefined || request.body === null) {
    return request as BlobPutBody;
  }

  if (
    typeof request.body === 'string' ||
    request.body instanceof Blob ||
    request.body instanceof ArrayBuffer
  ) {
    return request.body;
  }

  if (Buffer.isBuffer(request.body)) {
    return request.body as BlobPutBody;
  }

  return JSON.stringify(request.body);
}

export default async function handler(request: VercelRequest, response: ServerResponse): Promise<void> {
  if (request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      route: '/api/blob-upload',
      mode: 'server-put',
    });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  const blobReadWriteToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobReadWriteToken) {
    sendJson(response, 500, {
      error:
        'BLOB_READ_WRITE_TOKEN nao configurado. Conecte um Blob Store no Vercel ou adicione essa variavel de ambiente.',
    });
    return;
  }

  const requestUrl = getRequestUrl(request);
  const pathname = requestUrl.searchParams.get('pathname') ?? '';

  if (!isAllowedDatasetPath(pathname)) {
    sendJson(response, 400, {
      error: 'Caminho de upload invalido. Use datasets/{id}/profile.json.',
    });
    return;
  }

  const contentLength = Number(getHeaderValue(request.headers['content-length']) ?? 0);
  if (contentLength > MAX_SERVER_UPLOAD_SIZE_BYTES) {
    sendJson(response, 413, {
      error: 'Arquivo muito grande para upload pelo servidor. Use no maximo 4.5 MB.',
    });
    return;
  }

  try {
    const blob: PutBlobResult = await put(pathname, getUploadBody(request), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: getHeaderValue(request.headers['content-type']) ?? 'application/json',
      token: blobReadWriteToken,
    });

    sendJson(response, 200, blob);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Erro ao salvar arquivo no Vercel Blob.',
    });
  }
}
