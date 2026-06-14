import type { PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import type { DatasetProfileSource } from '../constants/datasetProfiles';

export type DatasetBlobFileKey =
  | 'baseFlow'
  | 'baseCentroids'
  | 'baseBoundaries'
  | 'aggregateCentroids'
  | 'aggregateLookup'
  | 'aggregateBoundaries';

export type DatasetBlobFiles = Partial<Record<DatasetBlobFileKey, File>>;
export type DatasetBlobPublishFiles = DatasetBlobFiles & {
  dimensions?: Record<string, File | undefined>;
};

export interface DatasetBlobPublishProgress {
  currentFileLabel: string;
  loaded: number;
  total: number;
  percentage: number;
}

export interface DatasetBlobPublishResult {
  profileUrl: string;
  profile: DatasetProfileSource;
  remoteBaseUrl?: string;
  lookupUrls: Partial<Record<Exclude<DatasetBlobFileKey, 'baseFlow'>, string>>;
  uploadedBlobs: PutBlobResult[];
}

const fileLabels: Record<DatasetBlobFileKey | 'profile', string> = {
  baseFlow: 'Parquet principal',
  baseCentroids: 'Centroides base',
  baseBoundaries: 'Fronteiras base',
  aggregateCentroids: 'Centroides agregados',
  aggregateLookup: 'Lookup agregado',
  aggregateBoundaries: 'Fronteiras agregadas',
  profile: 'JSON do dataset',
};

function sanitizeDatasetId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function sanitizeFileName(value: string): string {
  return value
    .trim()
    .replace(/[/\\]+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getContentType(file: File): string | undefined {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.csv')) return 'text/csv';
  if (lowerName.endsWith('.geojson')) return 'application/geo+json';
  if (lowerName.endsWith('.json')) return 'application/json';
  if (lowerName.endsWith('.parquet')) return 'application/octet-stream';
  return undefined;
}

function getProcessedBaseUrl(blobUrl: string, fileName: string): string {
  const encodedFileName = encodeURIComponent(fileName);
  if (blobUrl.endsWith(`/${encodedFileName}`)) {
    return blobUrl.slice(0, -encodedFileName.length);
  }

  if (blobUrl.endsWith(`/${fileName}`)) {
    return blobUrl.slice(0, -fileName.length);
  }

  return blobUrl.slice(0, blobUrl.lastIndexOf('/') + 1);
}

async function uploadDatasetBlob(
  pathname: string,
  file: File | Blob,
  label: string,
  contentType: string | undefined,
  onProgress?: (progress: DatasetBlobPublishProgress) => void
): Promise<PutBlobResult> {
  try {
    return await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/blob-upload',
      multipart: file.size > 100 * 1024 * 1024,
      contentType,
      onUploadProgress: (progress) => {
        onProgress?.({
          currentFileLabel: label,
          loaded: progress.loaded,
          total: progress.total,
          percentage: progress.percentage,
        });
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Failed to retrieve the client token')) {
      throw new Error(
        'Nao foi possivel obter o token do Vercel Blob. Confira se o Blob Store esta conectado ao projeto e se BLOB_READ_WRITE_TOKEN existe no ambiente do Vercel.'
      );
    }

    throw error;
  }
}

export async function publishDatasetProfileToBlob(
  profile: DatasetProfileSource,
  files: DatasetBlobPublishFiles,
  onProgress?: (progress: DatasetBlobPublishProgress) => void
): Promise<DatasetBlobPublishResult> {
  const datasetId = sanitizeDatasetId(profile.id);
  if (!datasetId) {
    throw new Error('Informe um id valido antes de publicar no Blob.');
  }

  const uploadedBlobs: PutBlobResult[] = [];
  const lookupUrls: DatasetBlobPublishResult['lookupUrls'] = {};
  let remoteBaseUrl: string | undefined;

  const baseFlowFile = files.baseFlow;
  if (baseFlowFile) {
    const fileName = sanitizeFileName(baseFlowFile.name);
    const blob = await uploadDatasetBlob(
      `datasets/${datasetId}/processed/${fileName}`,
      baseFlowFile,
      fileLabels.baseFlow,
      getContentType(baseFlowFile),
      onProgress
    );
    uploadedBlobs.push(blob);
    remoteBaseUrl = getProcessedBaseUrl(blob.url, fileName);
  }

  const uploadedDimensionFileNames = new Map<string, string>();
  for (const dimension of profile.demographicDimensions) {
    const file = files.dimensions?.[dimension.key];
    if (!file) continue;

    const fileName = sanitizeFileName(file.name);
    const blob = await uploadDatasetBlob(
      `datasets/${datasetId}/processed/${fileName}`,
      file,
      dimension.label || dimension.key,
      getContentType(file),
      onProgress
    );

    uploadedBlobs.push(blob);
    uploadedDimensionFileNames.set(dimension.key, fileName);
    remoteBaseUrl ??= getProcessedBaseUrl(blob.url, fileName);
  }

  const lookupFileEntries: Array<[Exclude<DatasetBlobFileKey, 'baseFlow'>, File | undefined]> = [
    ['baseCentroids', files.baseCentroids],
    ['baseBoundaries', files.baseBoundaries],
    ['aggregateCentroids', files.aggregateCentroids],
    ['aggregateLookup', files.aggregateLookup],
    ['aggregateBoundaries', files.aggregateBoundaries],
  ];

  for (const [key, file] of lookupFileEntries) {
    if (!file) continue;

    const fileName = sanitizeFileName(file.name);
    const blob = await uploadDatasetBlob(
      `datasets/${datasetId}/lookup/${fileName}`,
      file,
      fileLabels[key],
      getContentType(file),
      onProgress
    );

    uploadedBlobs.push(blob);
    lookupUrls[key] = blob.url;
  }

  const nextProfile: DatasetProfileSource = {
    ...profile,
    storage: {
      ...profile.storage,
      remoteBaseUrl: remoteBaseUrl ?? profile.storage.remoteBaseUrl,
    },
    lookup: {
      ...profile.lookup,
      baseCentroidsPath: lookupUrls.baseCentroids ?? profile.lookup.baseCentroidsPath,
      baseBoundariesPath: lookupUrls.baseBoundaries ?? profile.lookup.baseBoundariesPath,
      aggregateCentroidsPath: lookupUrls.aggregateCentroids ?? profile.lookup.aggregateCentroidsPath,
      aggregateLookupPath: lookupUrls.aggregateLookup ?? profile.lookup.aggregateLookupPath,
      aggregateBoundariesPath: lookupUrls.aggregateBoundaries ?? profile.lookup.aggregateBoundariesPath,
    },
    baseFlowDataset: {
      ...profile.baseFlowDataset,
      fileName: baseFlowFile ? sanitizeFileName(baseFlowFile.name) : profile.baseFlowDataset.fileName,
    },
    demographicDimensions: profile.demographicDimensions.map((dimension) => ({
      ...dimension,
      dataset: {
        ...dimension.dataset,
        fileName: uploadedDimensionFileNames.get(dimension.key) ?? dimension.dataset.fileName,
      },
    })),
  };

  const profileBlob = new Blob([JSON.stringify(nextProfile, null, 2)], {
    type: 'application/json',
  });
  const profileUpload = await uploadDatasetBlob(
    `datasets/${datasetId}/profile.json`,
    profileBlob,
    fileLabels.profile,
    'application/json',
    onProgress
  );
  uploadedBlobs.push(profileUpload);

  return {
    profileUrl: profileUpload.url,
    profile: nextProfile,
    remoteBaseUrl,
    lookupUrls,
    uploadedBlobs,
  };
}
