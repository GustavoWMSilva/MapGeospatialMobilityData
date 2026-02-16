export const isDevMode = import.meta.env.DEV;

export function debugLog(...args: unknown[]) {
  if (isDevMode) {
    console.log(...args);
  }
}

export function debugWarn(...args: unknown[]) {
  if (isDevMode) {
    console.warn(...args);
  }
}

export function getAnalyticsErrorMessage(error: unknown): string {
  const fallback = 'Nao foi possivel carregar os dados. Tente novamente.';

  if (!error) return fallback;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  return fallback;
}
