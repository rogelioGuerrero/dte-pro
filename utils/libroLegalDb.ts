import { openDB } from 'idb';
import { GroupedData } from '../types';

const DB_NAME = 'dte-libros-db';
const DB_VERSION = 1;
const STORE_NAME = 'libros';

export interface LibroData {
  id: string; // formato: 'compras-YYYY-MM' o 'ventas-YYYY-MM'
  mode: 'compras' | 'ventas';
  month: string; // YYYY-MM
  groupedData: GroupedData;
  updatedAt: number;
}

const openLibrosDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
        });
      }
    },
  });
};

export const saveLibroData = async (
  mode: 'compras' | 'ventas',
  month: string,
  groupedData: GroupedData
): Promise<void> => {
  const db = await openLibrosDb();
  const id = `${mode}-${month}`;
  const data: LibroData = {
    id,
    mode,
    month,
    groupedData,
    updatedAt: Date.now(),
  };
  await db.put(STORE_NAME, data);
};

export const getLibroData = async (
  mode: 'compras' | 'ventas',
  month: string
): Promise<LibroData | null> => {
  const db = await openLibrosDb();
  const id = `${mode}-${month}`;
  return await db.get(STORE_NAME, id);
};

export const getAllLibrosData = async (
  mode: 'compras' | 'ventas'
): Promise<GroupedData> => {
  const db = await openLibrosDb();
  const all = await db.getAll(STORE_NAME);
  const result: GroupedData = {};

  all
    .filter((item: LibroData) => item.mode === mode)
    .forEach((item: LibroData) => {
      // Merge groupedData
      Object.entries(item.groupedData).forEach(([month, files]) => {
        if (!result[month]) {
          result[month] = [];
        }
        // Evitar duplicados basándonos en el id del archivo
        const existingIds = new Set(result[month].map(f => f.id));
        files.forEach(file => {
          if (!existingIds.has(file.id)) {
            result[month].push(file);
          }
        });
      });
    });

  return result;
};

export const deleteLibroData = async (
  mode: 'compras' | 'ventas',
  month: string
): Promise<void> => {
  const db = await openLibrosDb();
  const id = `${mode}-${month}`;
  await db.delete(STORE_NAME, id);
};

export const clearAllLibrosData = async (): Promise<void> => {
  const db = await openLibrosDb();
  await db.clear(STORE_NAME);
};
