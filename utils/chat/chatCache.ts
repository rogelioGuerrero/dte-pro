// Cache de respuestas del chat por pregunta, vía sessionStorage.
// Evita llamadas repetidas al LLM en la misma sesión (ahorra tokens).

import type { ChatResponse } from './types';

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 min
const MAX_ENTRIES = 50;

interface CacheEntry {
  response: ChatResponse;
  ts: number;
}

const keyFor = (domainId: string, question: string): string => {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, ' ');
  return `chat_cache::${domainId}::${normalized}`;
};

const storageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.sessionStorage;
  } catch {
    return false;
  }
};

export const getCachedResponse = (
  domainId: string,
  question: string,
  ttlMs: number = DEFAULT_TTL_MS
): ChatResponse | null => {
  if (!storageAvailable()) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(domainId, question));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.ts > ttlMs) {
      sessionStorage.removeItem(keyFor(domainId, question));
      return null;
    }
    return { ...entry.response, source: 'cache' };
  } catch {
    return null;
  }
};

export const setCachedResponse = (
  domainId: string,
  question: string,
  response: ChatResponse
): void => {
  if (!storageAvailable()) return;
  try {
    // GC simple: si hay demasiadas entries del mismo dominio, limpia las más viejas.
    const prefix = `chat_cache::${domainId}::`;
    const ownKeys: Array<{ k: string; ts: number }> = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      try {
        const entry = JSON.parse(sessionStorage.getItem(k) || '{}') as CacheEntry;
        ownKeys.push({ k, ts: entry.ts || 0 });
      } catch {
        sessionStorage.removeItem(k);
      }
    }
    if (ownKeys.length >= MAX_ENTRIES) {
      ownKeys.sort((a, b) => a.ts - b.ts);
      const toDelete = ownKeys.slice(0, ownKeys.length - MAX_ENTRIES + 1);
      toDelete.forEach((e) => sessionStorage.removeItem(e.k));
    }

    const entry: CacheEntry = { response, ts: Date.now() };
    sessionStorage.setItem(keyFor(domainId, question), JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
};

export const clearChatCache = (domainId?: string): void => {
  if (!storageAvailable()) return;
  try {
    const prefix = domainId ? `chat_cache::${domainId}::` : 'chat_cache::';
    const toDelete: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) toDelete.push(k);
    }
    toDelete.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
};
