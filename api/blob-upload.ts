import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024 * 1024;

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function isAllowedDatasetPath(pathname: string): boolean {
  return (
    /^datasets\/[a-z0-9][a-z0-9_-]*\/(processed|lookup)\/[^/]+$/i.test(pathname) ||
    /^datasets\/[a-z0-9][a-z0-9_-]*\/profile\.json$/i.test(pathname)
  );
}

export function GET() {
  return jsonResponse({ ok: true, route: '/api/blob-upload' });
}

export async function POST(request: Request) {
  const blobReadWriteToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!blobReadWriteToken) {
    return jsonResponse(
      {
        error:
          'BLOB_READ_WRITE_TOKEN nao configurado. Conecte um Blob Store no Vercel ou adicione essa variavel de ambiente.',
      },
      500
    );
  }

  try {
    const body = await request.json() as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      token: blobReadWriteToken,
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

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Erro ao preparar upload para o Blob.',
      },
      400
    );
  }
}
