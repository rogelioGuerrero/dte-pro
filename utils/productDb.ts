import { openDB } from 'idb';

export interface ProductData {
  id?: number;
  key: string;
  codigo: string;
  descripcion: string;
  uniMedida: number;
  tipoItem: number;
  precioUni: number;
  stockMin?: number;
  favorite?: boolean;
  image?: string | null;
  timestamp: number;
}

const DB_NAME = 'dte-products-db';
const DB_VERSION = 2;
const STORE_NAME = 'products';

const normalizeText = (value: string): string => {
  return (value || '').trim().replace(/\s+/g, ' ').toUpperCase();
};

const buildProductKey = (codigo: string, descripcion: string, uniMedida: number): string => {
  const cod = (codigo || '').trim();
  if (cod) return `COD:${cod}`;
  return `DESC:${normalizeText(descripcion)}|UNI:${String(uniMedida ?? '')}`;
};

export const openProductsDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('key', 'key', { unique: true });
        store.createIndex('codigo', 'codigo', { unique: false });
        store.createIndex('favorite', 'favorite', { unique: false });
        return;
      }

      const store = transaction.objectStore(STORE_NAME);
      if (!store.indexNames.contains('favorite')) {
        store.createIndex('favorite', 'favorite', { unique: false });
      }
    },
  });
};

export const getProducts = async (): Promise<ProductData[]> => {
  const db = await openProductsDb();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => b.timestamp - a.timestamp);
};

export const addProduct = async (product: Omit<ProductData, 'id'>): Promise<void> => {
  const db = await openProductsDb();
  await db.add(STORE_NAME, {
    stockMin: 0,
    favorite: false,
    image: null,
    ...product,
  });
};

export const updateProduct = async (product: ProductData): Promise<void> => {
  const db = await openProductsDb();
  await db.put(STORE_NAME, {
    stockMin: 0,
    favorite: false,
    image: null,
    ...product,
  });
};

export const deleteProduct = async (id: number): Promise<void> => {
  const db = await openProductsDb();
  await db.delete(STORE_NAME, id);
};

export const clearProducts = async (): Promise<void> => {
  const db = await openProductsDb();
  await db.clear(STORE_NAME);
};

export const exportProducts = async (): Promise<string> => {
  const products = await getProducts();
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    products: products.map(({ id, ...rest }) => rest),
  };
  return JSON.stringify(exportData, null, 2);
};

type DTEItem = {
  codigo?: string;
  descripcion?: string;
  uniMedida?: number;
  precioUni?: number;
  tipoItem?: number;
};

type DTEParsed = {
  cuerpoDocumento?: DTEItem[];
};

export const importProducts = async (jsonString: string): Promise<{ imported: number; updated: number; skipped: number }> => {
  const data = JSON.parse(jsonString);

  if (!data.products || !Array.isArray(data.products)) {
    throw new Error('Formato de archivo inválido');
  }

  const db = await openProductsDb();
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of data.products) {
    const codigo = (p.codigo || '').trim();
    const descripcion = (p.descripcion || '').trim();
    const uniMedida = typeof p.uniMedida === 'number' ? p.uniMedida : 0;
    const tipoItem = typeof p.tipoItem === 'number' ? p.tipoItem : 1;
    const precioUni = typeof p.precioUni === 'number' ? p.precioUni : 0;
    const stockMin = typeof p.stockMin === 'number' ? p.stockMin : 0;
    const key = (p.key || '').trim() || buildProductKey(codigo, descripcion, uniMedida);

    if (!key || (!codigo && !descripcion)) {
      skipped++;
      continue;
    }

    const existing = await db.getFromIndex(STORE_NAME, 'key', key);
    if (existing) {
      await db.put(STORE_NAME, {
        ...existing,
        codigo,
        descripcion,
        uniMedida,
        tipoItem,
        precioUni,
        stockMin: typeof p.stockMin === 'number' ? p.stockMin : (existing.stockMin ?? 0),
        favorite: typeof p.favorite === 'boolean' ? p.favorite : (existing.favorite ?? false),
        image: typeof p.image === 'string' ? p.image : (existing.image ?? null),
        timestamp: Date.now(),
      });
      updated++;
      continue;
    }

    await db.add(STORE_NAME, {
      key,
      codigo,
      descripcion,
      uniMedida,
      tipoItem,
      precioUni,
      stockMin,
      favorite: typeof p.favorite === 'boolean' ? p.favorite : false,
      image: typeof p.image === 'string' ? p.image : null,
      timestamp: Date.now(),
    });
    imported++;
  }

  return { imported, updated, skipped };
};

export const importProductsFromDTE = async (
  jsonString: string
): Promise<{ imported: number; updated: number; skipped: number }> => {
  const parsed = JSON.parse(jsonString);
  const dtes: DTEParsed[] = Array.isArray(parsed) ? parsed : [parsed];

  const db = await openProductsDb();
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const dte of dtes) {
    const items = Array.isArray(dte?.cuerpoDocumento) ? dte.cuerpoDocumento : [];
    for (const item of items) {
      const codigo = (item?.codigo || '').trim();
      const descripcion = (item?.descripcion || '').trim();
      const uniMedida = typeof item?.uniMedida === 'number' ? item.uniMedida : 0;
      const tipoItem = typeof item?.tipoItem === 'number' ? item.tipoItem : 1;
      const precioUni = typeof item?.precioUni === 'number' ? item.precioUni : 0;

      if (!codigo && !descripcion) {
        skipped++;
        continue;
      }

      const key = buildProductKey(codigo, descripcion, uniMedida);
      const existing = await db.getFromIndex(STORE_NAME, 'key', key);

      if (existing) {
        await db.put(STORE_NAME, {
          ...existing,
          codigo: codigo || existing.codigo,
          descripcion: descripcion || existing.descripcion,
          uniMedida,
          tipoItem,
          precioUni,
          stockMin: existing.stockMin ?? 0,
          favorite: existing.favorite ?? false,
          image: existing.image ?? null,
          timestamp: Date.now(),
        });
        updated++;
        continue;
      }

      await db.add(STORE_NAME, {
        key,
        codigo,
        descripcion,
        uniMedida,
        tipoItem,
        precioUni,
        stockMin: 0,
        favorite: false,
        image: null,
        timestamp: Date.now(),
      });
      imported++;
    }
  }

  return { imported, updated, skipped };
};
