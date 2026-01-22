/**
 * Serviço de cache no navegador usando IndexedDB
 * Armazena GeoJSON e outros dados para evitar downloads repetidos
 */

const DB_NAME = 'mobility-cache';
const DB_VERSION = 1;
const STORE_NAME = 'geojson-cache';

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  size: number;
}

class CacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('Cache DB inicializado');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Criar object store se não existir
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Salvar dados no cache
   */
  async set(key: string, data: unknown): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB não inicializado');

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      size: JSON.stringify(data).length
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`Cache salvo: ${key} (${(entry.size / 1024).toFixed(2)} KB)`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Buscar dados do cache
   */
  async get(key: string): Promise<unknown> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (entry) {
          console.log(`Cache hit: ${key} (${(entry.size / 1024).toFixed(2)} KB)`);
          resolve(entry.data);
        } else {
          console.log(`Cache miss: ${key}`);
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Verificar se existe no cache
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Remover entrada do cache
   */
  async delete(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        console.log(`Cache removido: ${key}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Limpar todo o cache
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('Cache limpo');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obter tamanho total do cache
   */
  async getSize(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Listar todas as chaves no cache
   */
  async keys(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const cacheService = new CacheService();

/**
 * Helper para fazer fetch com cache
 */
export async function fetchWithCache(url: string, forceRefresh = false): Promise<unknown> {
  const cacheKey = `fetch:${url}`;

  // Verificar cache primeiro
  if (!forceRefresh) {
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;
  }

  // Fazer fetch
  console.log(`Baixando: ${url}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Salvar no cache
  await cacheService.set(cacheKey, data);

  return data;
}
