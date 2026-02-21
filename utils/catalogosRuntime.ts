import { openDB } from 'idb';
import type { Departamento } from '../catalogos/departamentosMunicipios';
import type { ActividadEconomica } from '../catalogos/actividadesEconomicas';
import { emitGlobalToast } from './globalToast';

type CatalogKey = 'departamentosMunicipios' | 'actividadesEconomicas';

type CatalogValueMap = {
  departamentosMunicipios: { departamentos: Departamento[] };
  actividadesEconomicas: { actividadesEconomicas: ActividadEconomica[]; actividadesComunes: string[] };
};

interface CatalogEntry<K extends CatalogKey> {
  key: K;
  value: CatalogValueMap[K];
  updatedAt: number;
}

const DB_NAME = 'dte-catalogos-db';
const DB_VERSION = 1;
const STORE_NAME = 'catalogos';

const CATALOGOS_URL_VERSION = '2';

const memoryCache = new Map<CatalogKey, CatalogValueMap[CatalogKey]>();
let offlineToastShown = false;

const openCatalogosDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    },
  });
};

const showOfflineToastOnce = () => {
  if (offlineToastShown) return;
  offlineToastShown = true;
  emitGlobalToast('Sin acceso a internet.', 'error');
};

const getCached = async <K extends CatalogKey>(key: K): Promise<CatalogValueMap[K] | undefined> => {
  const mem = memoryCache.get(key);
  if (mem) return mem as CatalogValueMap[K];

  const db = await openCatalogosDb();
  const entry = (await db.get(STORE_NAME, key)) as CatalogEntry<K> | undefined;
  if (entry?.value) {
    memoryCache.set(key, entry.value);
    return entry.value;
  }
  return undefined;
};

const setCached = async <K extends CatalogKey>(key: K, value: CatalogValueMap[K]) => {
  memoryCache.set(key, value);
  const db = await openCatalogosDb();
  const entry: CatalogEntry<K> = { key, value, updatedAt: Date.now() };
  await db.put(STORE_NAME, entry);
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
};

export const loadDepartamentosMunicipios = async (): Promise<CatalogValueMap['departamentosMunicipios']> => {
  const cached = await getCached('departamentosMunicipios');
  if (cached && cached.departamentos.length > 0) return cached;

  try {
    const data = await fetchJson<CatalogValueMap['departamentosMunicipios']>(
      `/catalogos/departamentosMunicipios.json?v=${CATALOGOS_URL_VERSION}`
    );
    await setCached('departamentosMunicipios', data);
    return data;
  } catch {
    showOfflineToastOnce();
    return cached || { departamentos: [] };
  }
};

export const loadActividadesEconomicas = async (): Promise<CatalogValueMap['actividadesEconomicas']> => {
  const cached = await getCached('actividadesEconomicas');
  if (cached && cached.actividadesEconomicas.length > 0) return cached;

  try {
    const data = await fetchJson<CatalogValueMap['actividadesEconomicas']>(
      `/catalogos/actividadesEconomicas.json?v=${CATALOGOS_URL_VERSION}`
    );
    await setCached('actividadesEconomicas', data);
    return data;
  } catch {
    showOfflineToastOnce();
    return cached || { actividadesEconomicas: [], actividadesComunes: [] };
  }
};
