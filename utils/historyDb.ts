import { openDB } from 'idb';
import type { HistoryEntry } from '../types';

const DB_NAME = 'dte-converter-history';
const DB_VERSION = 1;
const STORE_NAME = 'history';

export const openHistoryDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
};

export const addHistoryEntry = async (entry: Omit<HistoryEntry, 'id'>): Promise<void> => {
  const db = await openHistoryDb();
  await db.add(STORE_NAME, entry);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('dte-history-updated'));
  }
};

export const getHistoryEntries = async (): Promise<HistoryEntry[]> => {
  const db = await openHistoryDb();
  const all = await db.getAll(STORE_NAME);
  // Ordenar por fecha descendente
  return all.sort((a, b) => b.timestamp - a.timestamp);
};

export const clearHistory = async (): Promise<void> => {
  const db = await openHistoryDb();
  await db.clear(STORE_NAME);
};

export const computeSHA256 = async (content: string): Promise<string> => {
  if (typeof window === 'undefined' || !('crypto' in window) || !window.crypto.subtle) {
    // Fallback simple (no criptográficamente fuerte, pero evita romper en entornos sin Web Crypto)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const chr = content.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash.toString(16);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
};
