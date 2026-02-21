import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { MonthlyTaxAccumulator } from './types';

interface TaxDB extends DBSchema {
  tax_books: {
    key: string; // Periodo "YYYY-MM"
    value: MonthlyTaxAccumulator;
  };
}

const DB_NAME = 'dte-tax-db';
const STORE_NAME = 'tax_books';

let dbPromise: Promise<IDBPDatabase<TaxDB>>;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<TaxDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'period' });
        }
      },
    });
  }
  return dbPromise;
};

export const getAccumulator = async (period: { key: string }): Promise<MonthlyTaxAccumulator | undefined> => {
  const db = await getDB();
  return db.get(STORE_NAME, period.key);
};

export const saveAccumulator = async (acc: MonthlyTaxAccumulator): Promise<void> => {
  const db = await getDB();
  await db.put(STORE_NAME, acc);
};

export const getAllAccumulators = async (): Promise<MonthlyTaxAccumulator[]> => {
  const db = await getDB();
  return db.getAll(STORE_NAME);
};
