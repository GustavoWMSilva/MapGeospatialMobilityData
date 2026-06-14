import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024 * 1024;

function readRequestBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(data));
}

function isAllowedDatasetPath(pathname: string): boolean {
  return (
    /^datasets\/[a-z0-9][a-z0-9_-]*\/(processed|lookup)\/[^/]+$/i.test(pathname) ||
    /^datasets\/[a-z0-9][a-z0-9_-]*\/profile\.json$/i.test(pathname)
  );
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  try {
    const body = await readRequestBody(request) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAllowedDatasetPath(pathname)) {
          throw new Error('Caminho de upload invalido.');
        }

        return {
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: MAX_UPLOAD_SIZE_BYTES,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Erro ao preparar upload para o Blob.',
    });
  }
}
